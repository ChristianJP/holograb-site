// holograb — HoloViewer: zero-dependency WebGL2 Gaussian-splat viewer (antimatter15-style).
// Per-splat centre + 3D covariance + colour packed into a uint texture, instanced quads, 2D covariance
// projection in the vertex shader, depth sort (16-bit counting sort) in an inline Web Worker,
// front-to-back "under" blending -> premultiplied output that composites cleanly on transparent pages.
// +Y up orbit camera. See SPEC §6.

const COV_SCALE = 256; // covariance stored ×256 as half floats for precision on tiny splats

const VERT = `#version 300 es
precision highp float;
precision highp int;
uniform highp usampler2D u_tex;
uniform mat4 u_proj, u_view;
uniform vec2 u_focal, u_viewport;
in vec2 a_pos;
in int a_index;
out vec4 vColor;
out vec2 vPos;
void main() {
  uvec4 cen = texelFetch(u_tex, ivec2((uint(a_index) & 0x3ffu) << 1, uint(a_index) >> 10), 0);
  vec4 cam = u_view * vec4(uintBitsToFloat(cen.xyz), 1.0);
  vec4 p2 = u_proj * cam;
  float clip = 1.2 * p2.w;
  if (p2.z < -clip || p2.x < -clip || p2.x > clip || p2.y < -clip || p2.y > clip || cam.z <= 0.0) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return;
  }
  uvec4 cov = texelFetch(u_tex, ivec2(((uint(a_index) & 0x3ffu) << 1) | 1u, uint(a_index) >> 10), 0);
  vec2 u1 = unpackHalf2x16(cov.x), u2 = unpackHalf2x16(cov.y), u3 = unpackHalf2x16(cov.z);
  mat3 Vrk = mat3(u1.x, u1.y, u2.x, u1.y, u2.y, u3.x, u2.x, u3.x, u3.y) * (1.0 / ${COV_SCALE}.0);
  mat3 J = mat3(
    u_focal.x / cam.z, 0., -(u_focal.x * cam.x) / (cam.z * cam.z),
    0., -u_focal.y / cam.z, (u_focal.y * cam.y) / (cam.z * cam.z),
    0., 0., 0.);
  mat3 T = transpose(mat3(u_view)) * J;
  mat3 c2 = transpose(T) * Vrk * T;
  c2[0][0] += 0.3; c2[1][1] += 0.3;
  float mid = 0.5 * (c2[0][0] + c2[1][1]);
  float rad = length(vec2(0.5 * (c2[0][0] - c2[1][1]), c2[0][1]));
  float l1 = mid + rad, l2 = mid - rad;
  if (l2 < 0.0) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  vec2 dv = normalize(vec2(c2[0][1], l1 - c2[0][0]));
  vec2 major = min(sqrt(2.0 * l1), 1024.0) * dv;
  vec2 minor = min(sqrt(2.0 * l2), 1024.0) * vec2(dv.y, -dv.x);
  uint c = cov.w;
  vColor = clamp(p2.z / p2.w + 1.0, 0.0, 1.0) *
    vec4(float(c & 0xffu), float((c >> 8) & 0xffu), float((c >> 16) & 0xffu), float((c >> 24) & 0xffu)) / 255.0;
  vPos = a_pos;
  vec2 ctr = p2.xy / p2.w;
  // major/minor are in drawing-buffer pixels (u_focal is in pixels); NDC spans 2 units per viewport → ×2.
  // Without it every splat is drawn at half its true σ and trained (sparser) models look see-through.
  gl_Position = vec4(ctr + 2.0 * (a_pos.x * major + a_pos.y * minor) / u_viewport, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec4 vColor;
in vec2 vPos;
out vec4 fragColor;
void main() {
  float A = -dot(vPos, vPos);
  if (A < -4.0) discard;
  float B = exp(A) * vColor.a;
  fragColor = vec4(B * vColor.rgb, B);
}`;

// ---------------------------------------------------------------- worker (pack + sort)
const WORKER_SRC = `
let positions = null, count = 0, depthIndex = null, sizes = null, counts = null, starts = null;
const f2h = (() => {
  const f = new Float32Array(1), i = new Int32Array(f.buffer);
  return (v) => {
    f[0] = v; const x = i[0];
    let bits = (x >> 16) & 0x8000, m = (x >> 12) & 0x07ff; const e = (x >> 23) & 0xff;
    if (e < 103) return bits;
    if (e > 142) return bits | 0x7bff;
    if (e < 113) { m |= 0x0800; bits |= (m >> (114 - e)) + ((m >> (113 - e)) & 1); return bits; }
    bits |= ((e - 112) << 10) | (m >> 1); bits += m & 1; return bits;
  };
})();
const ph = (a, b) => (f2h(a) | (f2h(b) << 16)) >>> 0;
function pack(buf) {
  const u8 = new Uint8Array(buf), f32 = new Float32Array(buf, 0, (u8.length >> 2));
  count = Math.floor(u8.length / 32);
  const rows = Math.ceil(count / 1024) || 1;
  const tex = new Uint32Array(2048 * rows * 4);
  const tf = new Float32Array(tex.buffer);
  positions = new Float32Array(count * 3);
  const xs = new Float32Array(count), ys = new Float32Array(count), zs = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const x = f32[8 * i], y = f32[8 * i + 1], z = f32[8 * i + 2];
    positions[3 * i] = x; positions[3 * i + 1] = y; positions[3 * i + 2] = z;
    xs[i] = x; ys[i] = y; zs[i] = z;
    tf[8 * i] = x; tf[8 * i + 1] = y; tf[8 * i + 2] = z;
    const sx = f32[8 * i + 3], sy = f32[8 * i + 4], sz = f32[8 * i + 5];
    let w = (u8[32 * i + 28] - 128) / 128, qx = (u8[32 * i + 29] - 128) / 128, qy = (u8[32 * i + 30] - 128) / 128, qz = (u8[32 * i + 31] - 128) / 128;
    const n = Math.hypot(w, qx, qy, qz) || 1; w /= n; qx /= n; qy /= n; qz /= n;
    const M = [
      (1 - 2 * (qy * qy + qz * qz)) * sx, 2 * (qx * qy + w * qz) * sx, 2 * (qx * qz - w * qy) * sx,
      2 * (qx * qy - w * qz) * sy, (1 - 2 * (qx * qx + qz * qz)) * sy, 2 * (qy * qz + w * qx) * sy,
      2 * (qx * qz + w * qy) * sz, 2 * (qy * qz - w * qx) * sz, (1 - 2 * (qx * qx + qy * qy)) * sz];
    const K = ${COV_SCALE};
    const s0 = (M[0] * M[0] + M[3] * M[3] + M[6] * M[6]) * K, s1 = (M[0] * M[1] + M[3] * M[4] + M[6] * M[7]) * K,
      s2 = (M[0] * M[2] + M[3] * M[5] + M[6] * M[8]) * K, s3 = (M[1] * M[1] + M[4] * M[4] + M[7] * M[7]) * K,
      s4 = (M[1] * M[2] + M[4] * M[5] + M[7] * M[8]) * K, s5 = (M[2] * M[2] + M[5] * M[5] + M[8] * M[8]) * K;
    tex[8 * i + 4] = ph(s0, s1); tex[8 * i + 5] = ph(s2, s3); tex[8 * i + 6] = ph(s4, s5);
    tex[8 * i + 7] = (u8[32 * i + 24] | (u8[32 * i + 25] << 8) | (u8[32 * i + 26] << 16) | (u8[32 * i + 27] << 24)) >>> 0;
  }
  // robust bounds (2..98 percentile) so floaters do not wreck auto-framing
  const pct = (arr) => { const s = arr.slice().sort(); const n = s.length; if (!n) return [-1, 1];
    return [s[Math.floor(n * 0.02)], s[Math.min(n - 1, Math.floor(n * 0.98))]]; };
  const step = Math.max(1, Math.floor(count / 50000));
  const sub = (a) => { const o = new Float32Array(Math.ceil(count / step)); for (let i = 0, j = 0; i < count; i += step) o[j++] = a[i]; return o; };
  const bx = pct(sub(xs)), by = pct(sub(ys)), bz = pct(sub(zs));
  depthIndex = new Uint32Array(count); sizes = new Int32Array(count);
  counts = new Uint32Array(65536); starts = new Uint32Array(65536);
  postMessage({ type: 'packed', tex, rows, count, bounds: { min: [bx[0], by[0], bz[0]], max: [bx[1], by[1], bz[1]] } }, [tex.buffer]);
}
function sort(vp, id) {
  if (!positions) return;
  let mx = -Infinity, mn = Infinity;
  for (let i = 0; i < count; i++) {
    const d = ((vp[2] * positions[3 * i] + vp[6] * positions[3 * i + 1] + vp[10] * positions[3 * i + 2]) * 4096) | 0;
    sizes[i] = d; if (d > mx) mx = d; if (d < mn) mn = d;
  }
  const inv = (256 * 256 - 1) / ((mx - mn) || 1);
  counts.fill(0);
  for (let i = 0; i < count; i++) { sizes[i] = ((sizes[i] - mn) * inv) | 0; counts[sizes[i]]++; }
  starts[0] = 0; for (let i = 1; i < 65536; i++) starts[i] = starts[i - 1] + counts[i - 1];
  const out = new Uint32Array(count);
  for (let i = 0; i < count; i++) out[starts[sizes[i]]++] = i;
  postMessage({ type: 'sorted', index: out, id }, [out.buffer]);
}
onmessage = (e) => { const d = e.data; if (d.type === 'pack') pack(d.buffer); else if (d.type === 'sort') sort(d.viewProj, d.id); };
`;
let workerURL = null;
// ?holosync=1 runs pack/sort on the main thread (deterministic headless screenshots with virtual time).
const SYNC = typeof location !== 'undefined' && /[?&]holosync=1/.test(location.search);
function makeWorker() {
  if (SYNC) {
    const fake = { onmessage: null, onerror: null, terminate() { fake.dead = true; } };
    const handler = new Function('postMessage', 'let onmessage;' + WORKER_SRC + '\nreturn onmessage;')(
      (data) => setTimeout(() => !fake.dead && fake.onmessage?.({ data }), 0));
    fake.postMessage = (data) => setTimeout(() => !fake.dead && handler({ data }), 0);
    return fake;
  }
  if (!workerURL) workerURL = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
  return new Worker(workerURL);
}

// ---------------------------------------------------------------- math
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const DEG = Math.PI / 180;
function lookAt(eye, target) {
  let fx = target[0] - eye[0], fy = target[1] - eye[1], fz = target[2] - eye[2];
  let n = Math.hypot(fx, fy, fz) || 1; fx /= n; fy /= n; fz /= n;
  // right = f × up(0,1,0)
  let rx = -fz, ry = 0, rz = fx; n = Math.hypot(rx, rz) || 1; rx /= n; rz /= n;
  // camUp = r × f ; down = -camUp
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  const dx = -ux, dy = -uy, dz = -uz;
  const dot = (a, b, c) => a * eye[0] + b * eye[1] + c * eye[2];
  return new Float32Array([rx, dx, fx, 0, ry, dy, fy, 0, rz, dz, fz, 0, -dot(rx, ry, rz), -dot(dx, dy, dz), -dot(fx, fy, fz), 1]);
}
function projection(fx, fy, w, h, near, far) {
  return new Float32Array([(2 * fx) / w, 0, 0, 0, 0, -(2 * fy) / h, 0, 0, 0, 0, far / (far - near), 1, 0, 0, -(far * near) / (far - near), 0]);
}
function mul4(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s;
  }
  return o;
}
function parseColor(c) {
  if (!c || c === 'transparent') return null;
  let h = String(c).trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return '#' + h.toLowerCase();
}

// ---------------------------------------------------------------- viewer
const DEFAULTS = {
  src: null, background: 'transparent', autoRotate: true, autoRotateSpeed: 0.35, interactive: true,
  yaw: 0, pitch: 0.5, distance: null, fov: 35, target: null,
  pixelRatio: Math.min(globalThis.devicePixelRatio || 1, 2), preserveDrawingBuffer: false,
  onProgress: null, onLoad: null, onError: null,
  // OPT-IN, default off (used only by holo-stage.js): a host that shares this canvas's GL context and composites
  // the splats itself. When set, the viewer never presents to the canvas — it calls compositor(viewer) whenever a
  // new frame is due and the host draws the splats into its own framebuffer with viewer.drawTo(fbo, w, h).
  compositor: null,
};

export class HoloViewer {
  static async create(el, opts = {}) {
    const v = new HoloViewer(el, opts);
    if (v.opts.src) await v.load(v.opts.src).catch((e) => { v.opts.onError?.(e); throw e; });
    return v;
  }

  constructor(el, opts = {}) {
    this.opts = { ...DEFAULTS, ...opts };
    if (el instanceof HTMLCanvasElement) { this.canvas = el; this.container = el.parentElement; this._ownCanvas = false; }
    else {
      this.container = el;
      this.canvas = document.createElement('canvas');
      Object.assign(this.canvas.style, { display: 'block', width: '100%', height: '100%' });
      el.appendChild(this.canvas); this._ownCanvas = true;
    }
    const cs = this.canvas.style;
    cs.userSelect = 'none'; cs.webkitUserSelect = 'none'; cs.webkitTapHighlightColor = 'transparent';
    cs.outline = 'none';
    this.yaw = this.opts.yaw; this.pitch = clamp(this.opts.pitch, 5 * DEG, 80 * DEG);
    this.distance = this.opts.distance || 3.2; this._userDistance = !!this.opts.distance;
    this.target = this.opts.target ? [...this.opts.target] : [0, 0.3, 0];
    this._autoFrame = { radius: 1 };
    this.count = 0; this._vel = { yaw: 0, pitch: 0 }; this._lastInteract = -1e9; this._autoBlend = 1;
    this._dirty = true; this._raf = 0; this._destroyed = false; this._sortId = 0; this._sortBusy = false;
    this._lastSortVP = null; this._pointers = new Map();
    this._setBackground(this.opts.background);
    this._initGL();
    this._worker = makeWorker();
    this._worker.onmessage = (e) => this._onWorker(e.data);
    this._worker.onerror = (e) => console.error('holo-viewer worker:', e.message, e.lineno);
    if (this.opts.interactive) this._bindInput();
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(this.container || this.canvas);
    this.resize();
  }

  _setBackground(bg) {
    this._bg = parseColor(bg);
    this.canvas.style.background = this._bg || 'transparent';
  }

  _initGL() {
    const gl = this.canvas.getContext('webgl2', {
      antialias: false, alpha: true, premultipliedAlpha: true, depth: false, stencil: false,
      preserveDrawingBuffer: !!this.opts.preserveDrawingBuffer, powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 not available');
    this.gl = gl;
    if (!this._ctxBound) {
      this._ctxBound = true;
      this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this._lost = true; cancelAnimationFrame(this._raf); this._raf = 0; });
      this.canvas.addEventListener('webglcontextrestored', () => { this._lost = false; this._initGL(); if (this._texData) this._uploadTex(); if (this._index) this._uploadIndex(this._index); this._kick(); });
    }
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    this.prog = p;
    gl.useProgram(p);
    this.u = {};
    for (const n of ['u_tex', 'u_proj', 'u_view', 'u_focal', 'u_viewport']) this.u[n] = gl.getUniformLocation(p, n);
    this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
    const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-2, -2, 2, -2, 2, 2, -2, 2]), gl.STATIC_DRAW);
    const ap = gl.getAttribLocation(p, 'a_pos'); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
    this.idxBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.idxBuf);
    const ai = gl.getAttribLocation(p, 'a_index'); gl.enableVertexAttribArray(ai);
    gl.vertexAttribIPointer(ai, 1, gl.INT, 0, 0); gl.vertexAttribDivisor(ai, 1);
    this.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.uniform1i(this.u.u_tex, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE_MINUS_DST_ALPHA, gl.ONE, gl.ONE_MINUS_DST_ALPHA, gl.ONE);
    gl.blendEquation(gl.FUNC_ADD);
  }

  _uploadTex() {
    const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32UI, 2048, this._texRows, 0, gl.RGBA_INTEGER, gl.UNSIGNED_INT, this._texData);
  }
  _uploadIndex(idx) {
    const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, this.idxBuf);
    gl.bufferData(gl.ARRAY_BUFFER, idx, gl.DYNAMIC_DRAW);
    this._drawCount = idx.length;
  }

  async load(src) {
    this.opts.src = src;
    const token = (this._loadToken = (this._loadToken || 0) + 1);
    const res = await fetch(src);
    if (!res.ok) throw new Error(`HoloViewer: ${res.status} loading ${src}`);
    const total = +res.headers.get('content-length') || 0;
    let buf;
    if (res.body && total) {
      const reader = res.body.getReader(); const out = new Uint8Array(total); let got = 0;
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        if (got + value.length > out.length) { /* length lied (gzip) — fall back */ out.set(value.subarray(0, out.length - got), got); got = out.length; break; }
        out.set(value, got); got += value.length;
        this.opts.onProgress?.(Math.min(0.95, got / total));
      }
      buf = out.buffer.slice(0, got - (got % 32));
    } else {
      buf = await res.arrayBuffer(); buf = buf.slice(0, buf.byteLength - (buf.byteLength % 32));
    }
    if (token !== this._loadToken || this._destroyed) return;
    return new Promise((resolve) => {
      this._pendingLoad = resolve;
      this._worker.postMessage({ type: 'pack', buffer: buf }, [buf]);
    });
  }

  /** Load from an in-memory ArrayBuffer of .splat bytes. */
  loadBuffer(buffer) {
    const buf = buffer.slice(0, buffer.byteLength - (buffer.byteLength % 32));
    return new Promise((resolve) => { this._pendingLoad = resolve; this._worker.postMessage({ type: 'pack', buffer: buf }, [buf]); });
  }

  _onWorker(d) {
    if (this._destroyed) return;
    if (d.type === 'packed') {
      this._texData = d.tex; this._texRows = d.rows; this.count = d.count;
      if (!this._lost) this._uploadTex();
      this._frame(d.bounds);
      this._index = null; this._drawCount = 0; this._lastSortVP = null;
      this._requestSort(true);
    } else if (d.type === 'sorted') {
      this._sortBusy = false;
      this._index = d.index;
      if (!this._lost) this._uploadIndex(d.index);
      this._dirty = true; this._kick();
      if (this._pendingLoad) {
        const r = this._pendingLoad; this._pendingLoad = null;
        this.opts.onProgress?.(1); this.opts.onLoad?.(); r(this);
      }
      if (this._sortAgain) { this._sortAgain = false; this._requestSort(); }
    }
  }

  _frame(b) {
    const ext = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
    const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
    const h = Math.max(0, ext[1]);
    if (!this.opts.target) this.target = [cx, b.min[1] + h * 0.4, cz];
    const horiz = Math.max(Math.max(ext[0], ext[2]) / 2, Math.hypot(ext[0], ext[2]) / 2 * 0.85);
    this._autoFrame.radius = Math.max(horiz, h * 0.75, 0.05);
    if (!this._userDistance) this.distance = this._fitDistance();
    this._dirty = true;
  }
  _fitDistance(aspect = this._aspect || 1) {
    const fy = (this.opts.fov * DEG) / 2;
    const half = aspect < 1 ? Math.atan(Math.tan(fy) * aspect) : fy;
    return this._autoFrame.radius / (Math.tan(half) * 0.64);
  }

  _camera(w, h) {
    const fovY = this.opts.fov * DEG;
    const fy = h / (2 * Math.tan(fovY / 2)), fx = fy;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const eye = [this.target[0] + this.distance * Math.sin(this.yaw) * cp, this.target[1] + this.distance * sp, this.target[2] + this.distance * Math.cos(this.yaw) * cp];
    const view = lookAt(eye, this.target);
    const near = Math.max(0.01, this.distance * 0.02), far = this.distance * 50 + 10;
    const proj = projection(fx, fy, w, h, near, far);
    return { view, proj, fx, fy };
  }

  _requestSort(force) {
    if (!this.count) return;
    const { view, proj } = this._camera(this.canvas.width || 1, this.canvas.height || 1);
    const vp = mul4(proj, view);
    if (!force && this._lastSortVP) {
      const l = this._lastSortVP;
      const dot = l[2] * vp[2] + l[6] * vp[6] + l[10] * vp[10];
      const n1 = Math.hypot(l[2], l[6], l[10]), n2 = Math.hypot(vp[2], vp[6], vp[10]);
      if (Math.abs(dot / (n1 * n2) - 1) < 0.0004) return;
    }
    if (this._sortBusy) { this._sortAgain = true; return; }
    this._sortBusy = true; this._lastSortVP = vp;
    this._worker.postMessage({ type: 'sort', viewProj: vp, id: ++this._sortId });
  }

  resize() {
    if (this._destroyed) return;
    const pr = this.opts.pixelRatio || 1;
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * pr)), h = Math.max(1, Math.round(r.height * pr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    const aspect = r.width / Math.max(1, r.height);
    if (aspect !== this._aspect && r.width > 0) {
      const ratio = this._userDistance ? 1 : this.distance / this._fitDistance(this._aspect || aspect);
      this._aspect = aspect;
      if (!this._userDistance) this.distance = this._fitDistance(aspect) * (isFinite(ratio) && ratio > 0 ? ratio : 1);
    }
    this._dirty = true; this._kick();
  }

  setAutoRotate(b) { this.opts.autoRotate = !!b; this._kick(); }
  setBackground(bg) { this._setBackground(bg); this._dirty = true; this._kick(); }
  setView({ yaw, pitch, distance } = {}) {
    if (yaw != null) this.yaw = yaw;
    if (pitch != null) this.pitch = clamp(pitch, 5 * DEG, 80 * DEG);
    if (distance != null) { this.distance = distance; }
    this._dirty = true; this._kick();
  }
  getView() { return { yaw: this.yaw, pitch: this.pitch, distance: this.distance, target: [...this.target] }; }

  _kick() { if (!this._raf && !this._destroyed && !this._lost) this._raf = requestAnimationFrame((t) => this._tick(t)); }

  _tick(t) {
    this._raf = 0;
    if (this._destroyed || this._lost) return;
    const dt = this._lastT ? Math.min(0.05, (t - this._lastT) / 1000) : 1 / 60;
    this._lastT = t;
    let animating = false;
    const now = performance.now();
    const interacting = this._pointers.size > 0;
    // inertia
    if (!interacting && (Math.abs(this._vel.yaw) > 1e-4 || Math.abs(this._vel.pitch) > 1e-4)) {
      this.yaw += this._vel.yaw; this.pitch = clamp(this.pitch + this._vel.pitch, 5 * DEG, 80 * DEG);
      const k = Math.pow(0.0025, dt); this._vel.yaw *= k; this._vel.pitch *= k;
      this._dirty = true; animating = true;
    }
    if (this.opts.autoRotate && this.count) {
      const idle = now - this._lastInteract > 3000 && !interacting;
      const targetBlend = idle ? 1 : 0;
      this._autoBlend += (targetBlend - this._autoBlend) * Math.min(1, dt * 1.5);
      if (this._autoBlend > 0.001) { this.yaw += this.opts.autoRotateSpeed * dt * this._autoBlend; this._dirty = true; }
      animating = true;
    }
    if (this._dirty) { this._render(); this._dirty = false; this._requestSort(); }
    if (animating || this._sortBusy) this._kick();
    else this._lastT = 0;
  }

  _draw(w, h) {
    const gl = this.gl;
    const { view, proj, fx, fy } = this._camera(w, h);
    gl.useProgram(this.prog); gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniformMatrix4fv(this.u.u_proj, false, proj); gl.uniformMatrix4fv(this.u.u_view, false, view);
    gl.uniform2fv(this.u.u_focal, [fx, fy]); gl.uniform2fv(this.u.u_viewport, [w, h]);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    if (this._drawCount) gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, this._drawCount);
  }

  _render() {
    if (this.opts.compositor) { this.opts.compositor(this); return; } // opt-in: the host presents (see DEFAULTS)
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this._draw(this.canvas.width, this.canvas.height);
  }

  /** Opt-in companion to opts.compositor: draw the current view into `framebuffer` (w×h, RGBA, premultiplied) of this
   *  viewer's GL context. Sets every piece of GL state the splat pass needs, so a host sharing the context can run
   *  its own passes in between. Leaves `framebuffer` bound. Not used by the viewer itself. */
  drawTo(framebuffer, w, h) {
    const gl = this.gl;
    if (this._destroyed || this._lost) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.SCISSOR_TEST); gl.colorMask(true, true, true, true);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE_MINUS_DST_ALPHA, gl.ONE, gl.ONE_MINUS_DST_ALPHA, gl.ONE);
    gl.blendEquation(gl.FUNC_ADD);
    this._draw(w, h);
  }

  /** Offscreen render at any size → Blob (straight alpha; background composited unless transparent). */
  async snapshot({ width = 2048, height = 2048, type = 'image/png', quality = 0.92, background } = {}) {
    const gl = this.gl;
    const max = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
    const w = Math.min(width, max), h = Math.min(height, max);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    // fit framing to the snapshot aspect
    const saved = this.distance;
    if (!this._userDistance) this.distance = saved * (this._fitDistance(w / h) / this._fitDistance(this._aspect || 1));
    // the existing sort order is valid for the same view direction
    this._draw(w, h);
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    this.distance = saved;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.deleteTexture(tex);
    // un-premultiply + flip
    const img = new ImageData(w, h);
    for (let y = 0; y < h; y++) {
      const src = (h - 1 - y) * w * 4, dst = y * w * 4;
      for (let x = 0; x < w * 4; x += 4) {
        const a = px[src + x + 3];
        if (a) { const k = 255 / a; img.data[dst + x] = Math.min(255, px[src + x] * k); img.data[dst + x + 1] = Math.min(255, px[src + x + 1] * k); img.data[dst + x + 2] = Math.min(255, px[src + x + 2] * k); }
        img.data[dst + x + 3] = a;
      }
    }
    const bg = background !== undefined ? parseColor(background) : (type === 'image/jpeg' ? (this._bg || '#0b0b0b') : this._bg);
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
    const ctx = c.getContext('2d');
    if (bg) {
      const tmp = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
      tmp.getContext('2d').putImageData(img, 0, 0);
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); ctx.drawImage(tmp, 0, 0);
    } else ctx.putImageData(img, 0, 0);
    this._dirty = true; this._kick();
    if (c.convertToBlob) return c.convertToBlob({ type, quality });
    return new Promise((r) => c.toBlob(r, type, quality));
  }

  _bindInput() {
    const c = this.canvas;
    c.style.touchAction = 'none'; c.style.cursor = 'grab';
    let last = null, pinch = null;
    const mark = () => { this._lastInteract = performance.now(); this._autoBlend = 0; };
    const onDown = (e) => {
      c.setPointerCapture?.(e.pointerId);
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this._vel.yaw = this._vel.pitch = 0; mark(); c.style.cursor = 'grabbing';
      if (this._pointers.size === 2) {
        const [a, b] = [...this._pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: this.distance };
      }
      last = performance.now();
      this._kick();
    };
    const onMove = (e) => {
      const p = this._pointers.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      mark();
      if (this._pointers.size === 1) {
        const r = c.getBoundingClientRect(); const s = 3.2 / Math.max(240, Math.min(r.width, r.height) * 1.4);
        const dyaw = -dx * s, dpitch = dy * s;
        this.yaw += dyaw; this.pitch = clamp(this.pitch + dpitch, 5 * DEG, 80 * DEG);
        const now = performance.now(), dt = Math.max(1, now - (last || now)); last = now;
        const k = Math.min(1, 16 / dt);
        this._vel.yaw = this._vel.yaw * 0.4 + dyaw * k * 0.6; this._vel.pitch = this._vel.pitch * 0.4 + dpitch * k * 0.6;
      } else if (this._pointers.size === 2 && pinch) {
        const [a, b] = [...this._pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this._zoomTo(pinch.dist * (pinch.d / Math.max(1, d)));
      }
      this._dirty = true; this._kick();
    };
    const onUp = (e) => {
      this._pointers.delete(e.pointerId); mark();
      if (this._pointers.size < 2) pinch = null;
      if (performance.now() - last > 80) this._vel.yaw = this._vel.pitch = 0;
      if (!this._pointers.size) c.style.cursor = 'grab';
      this._kick();
    };
    c.addEventListener('pointerdown', onDown);
    c.addEventListener('pointermove', onMove);
    c.addEventListener('pointerup', onUp);
    c.addEventListener('pointercancel', onUp);
    c.addEventListener('wheel', (e) => {
      e.preventDefault(); mark();
      this._zoomTo(this.distance * Math.exp(e.deltaY * (e.deltaMode ? 0.05 : 0.0015)));
    }, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('dblclick', () => { mark(); this._userDistance = false; this.distance = this._fitDistance(); this._dirty = true; this._kick(); });
  }
  _zoomTo(d) {
    const base = this._fitDistance();
    this.distance = clamp(d, base * 0.35, base * 2.5);
    this._dirty = true; this._kick();
  }

  destroy() {
    this._destroyed = true;
    cancelAnimationFrame(this._raf);
    this._ro?.disconnect(); this._worker?.terminate();
    const gl = this.gl;
    try { gl.deleteTexture(this.tex); gl.deleteBuffer(this.idxBuf); gl.deleteProgram(this.prog); gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch {}
    if (this._ownCanvas) this.canvas.remove();
  }
}

// ---------------------------------------------------------------- <holo-splat>
if (typeof customElements !== 'undefined' && !customElements.get('holo-splat')) {
  customElements.define('holo-splat', class extends HTMLElement {
    static get observedAttributes() { return ['src', 'auto-rotate', 'background']; }
    connectedCallback() {
      if (!this.style.display) this.style.display = 'block';
      if (!this.style.position) this.style.position = 'relative';
      if (this.viewer) return;
      const num = (n) => (this.hasAttribute(n) ? parseFloat(this.getAttribute(n)) : undefined);
      const opts = {
        background: this.getAttribute('background') || 'transparent',
        autoRotate: this.hasAttribute('auto-rotate') && this.getAttribute('auto-rotate') !== 'false',
        interactive: this.hasAttribute('interactive') && this.getAttribute('interactive') !== 'false',
      };
      for (const [a, k] of [['yaw', 'yaw'], ['pitch', 'pitch'], ['distance', 'distance'], ['fov', 'fov'], ['auto-rotate-speed', 'autoRotateSpeed']]) {
        const v = num(a); if (v !== undefined && !isNaN(v)) opts[k] = v;
      }
      opts.onProgress = (f) => this.dispatchEvent(new CustomEvent('progress', { detail: f }));
      opts.onLoad = () => this.dispatchEvent(new CustomEvent('load'));
      this.viewer = new HoloViewer(this, opts);
      const src = this.getAttribute('src');
      if (src) this.viewer.load(src).catch((e) => this.dispatchEvent(new CustomEvent('error', { detail: e })));
    }
    disconnectedCallback() { this.viewer?.destroy(); this.viewer = null; }
    attributeChangedCallback(name, old, val) {
      if (!this.viewer || old === val) return;
      if (name === 'src' && val) this.viewer.load(val).catch(() => {});
      if (name === 'auto-rotate') this.viewer.setAutoRotate(val !== null && val !== 'false');
      if (name === 'background') this.viewer.setBackground(val);
    }
  });
}

export default HoloViewer;
