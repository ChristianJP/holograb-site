// holograb — HoloStage: "the brand's light is the projector".
// A real scanned dish (Gaussian splat, drawn by HoloViewer) floats in a column of the brand's RGB hairlines that rises
// from a faint projector ring on the floor. Zero dependencies; imports only ./holo-viewer.js (relative, so the three
// files can be bundled anywhere, e.g. inside the iPhone app).
//
//   const stage = await HoloStage.create(container, {
//     dishes: ['/assets/demo/burger.splat', …]  or  [{ src, name, poster }],
//     cycleSeconds: 9,        // 0 = never cycle on its own (stage.next() still works)
//     intro: true,            // materialise sweep for the first dish
//     interactive: true,      // drag to turn (inertia), tap = re-scan pulse
//     beams: true, ring: true, glitch: true,
//     pixelRatio,             // default min(devicePixelRatio, 2)
//     background: 'transparent',   // or '#0b0b0b' etc. (painted behind the canvas)
//     onReady(stage), onDish(index, dish),
//     onError(error),         // optional: no dish could be shown at all (every .splat and every poster failed)
//   });
//   stage.next()  stage.pulse()  stage.setTilt(x, y)  stage.pause()  stage.resume()  stage.destroy()
//   <holo-stage dishes="/a.splat,/b.splat" cycle="9" interactive></holo-stage>   (fires 'ready', 'dish' and 'error' events)
//
// Loading and failure: while the first .splat downloads, the dish's `poster` PNG stands in faintly. A dish whose .splat
// fails is skipped; if none loads, the stage shows the PNG cut-outs over a CSS beam (the same fallback as no WebGL2).
//
// How it draws: ONE WebGL2 context. HoloViewer renders the splats into a framebuffer of the stage canvas's context
// (its opt-in `compositor` hook — no canvas→texture copies, which are slow in WebKit), then a single full-screen
// pass composites dish + hologram treatment + beams + ring. Everything on screen is a pure function of the stage
// clock T, which only runs while the stage is visible.
//
// Deterministic test hooks (for screenshots only — read from the PAGE's query string):
//   ?freeze=<seconds>  pins the stage clock: 0.5 = mid-materialise, 4 = idle, (cycle − 0.4) = de-materialising,
//                      (cycle + 0.6) = second dish materialising, …
//   ?state=glitch      forces a glitch frame (implies freeze=4 unless freeze is given)
//   ?state=loading     the first dish never arrives: shows the still that stands in while a .splat downloads
//   (?holosync=1 is HoloViewer's own switch: synchronous pack/sort for headless Chrome with virtual time.)

import { HoloViewer } from './holo-viewer.js';

const IN = 1.6;      // materialise sweep, seconds
const OUT = 0.9;     // de-materialise sweep
const PULSE = 1.15;  // re-scan pulse
const GLITCH = 0.12; // glitch length
const SPEED = 0.3;   // auto-rotation, rad/s
// Layout, in stage units (1 = the shorter side of the canvas), origin at the canvas centre, +y up.
const RING_Y = -0.305, RING_RX = 0.27, RING_RY = 0.094, DISH_Y = 0.055;
const ZOOM = 1.42;   // camera distance vs. HoloViewer's auto-fit → the dish spans about half the stage
const PITCH = 0.42;

const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const FORCE_GLITCH = Q.get('state') === 'glitch';
const FORCE_LOADING = Q.get('state') === 'loading';
const FREEZE = Q.has('freeze') && isFinite(parseFloat(Q.get('freeze'))) ? Math.max(0, parseFloat(Q.get('freeze'))) : (FORCE_GLITCH ? 4 : null);

const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_dish;   // the splats, premultiplied, same size as the canvas, with mips
uniform vec2 u_res;         // drawing buffer, px
uniform float u_dpr;        // device px per css px
uniform float u_S;          // stage unit, px
uniform vec2 u_c;           // stage origin, px (+y up)
uniform vec2 u_dishOff;     // where the dish image sits relative to the canvas centre, px
uniform float u_time, u_yaw;
uniform vec3 u_line;        // sweep line: y (stage units), intensity, cut (1 = dish exists only below the line)
uniform float u_show;       // dish opacity
uniform vec2 u_glitch;      // strength, seed
uniform vec3 u_on;          // beams, ring, motion (0 = prefers-reduced-motion)
uniform vec3 u_ring;        // y, rx, ry (stage units)
uniform float u_lod;        // mip level used for the halo
out vec4 o;

const vec3 RED = vec3(1.0, 0.231, 0.231), GRN = vec3(0.169, 0.851, 0.42), BLU = vec3(0.231, 0.42, 1.0);
float h11(float n) { return fract(sin(n * 127.1 + 1.7) * 43758.5453); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec4 dishAt(vec2 fc, float lod) {
  vec2 uv = (fc - u_dishOff) / u_res;
  vec2 in01 = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  return textureLod(u_dish, uv, lod) * (in01.x * in01.y * u_show);
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  vec2 p = (fc - u_c) / u_S;
  float px = u_dpr;                         // one css px, in device px
  float motion = u_on.z;

  // ---- the dish (true colours) -------------------------------------------------------------------------------
  float gact = 0.0, gshift = 0.0;
  if (u_glitch.x > 0.0) {                   // rare, short: a few horizontal slices slip sideways
    float band = floor(p.y * 36.0 + u_glitch.y * 9.0);
    gact = step(0.72, h11(band + u_glitch.y * 3.1)) * u_glitch.x;
    gshift = (h11(band * 1.7 + u_glitch.y) - 0.5) * 0.055 * u_S * gact;
  }
  vec2 dfc = fc + vec2(gshift, 0.0);
  vec4 d = dishAt(dfc, 0.0);
  if (gact > 0.0) {
    d.r = dishAt(dfc + vec2(2.5 * px, 0.0), 0.0).r;
    d.b = dishAt(dfc - vec2(2.5 * px, 0.0), 0.0).b;
  }
  float aL = dishAt(dfc + vec2(1.25 * px, 0.0), 0.0).a;
  float aR = dishAt(dfc - vec2(1.25 * px, 0.0), 0.0).a;

  // soft halo: a few taps of a low mip of the dish
  vec4 hs = dishAt(dfc, u_lod + 1.0) * 0.34;
  if (dishAt(dfc, u_lod + 2.5).a > 0.002) {      // (skip the taps where the dish is nowhere near)
    for (int i = 0; i < 6; i++) {
      float a = float(i) * 1.0472 + 0.4;
      hs += dishAt(dfc + vec2(cos(a), sin(a)) * 0.04 * u_S, u_lod) * 0.11;
    }
  }

  // materialise / de-materialise: the dish exists only below the sweep line, dissolving in fine noise near it
  float ly = u_line.x, below = ly - p.y;
  float vis = 1.0, hvis = 1.0;
  if (u_line.z > 0.5) {
    float n = h21(floor(fc / max(1.0, px * 0.75)) + 0.5);
    vis = smoothstep(n - 0.04, n + 0.04, below / 0.07 - 0.04);
    hvis = smoothstep(-0.03, 0.12, below);
  }
  float edge = max(aR - d.a, 0.0), edgeB = max(aL - d.a, 0.0);
  d *= vis; hs *= hvis;

  // fine scan-lines drifting up, on the dish only (≤ 12 % modulation)
  float sl = 0.5 + 0.5 * sin(fc.y / px * 2.0944 - u_time * 2.4 * motion);
  d.rgb *= 1.05 - 0.115 * sl;
  // the sweep leaves the freshly scanned band a little hot
  float hot = u_line.y * step(0.0, below) * exp(-below / 0.03);
  d.rgb += d.a * hot * 0.5 * vec3(0.86, 0.94, 1.0);

  // ---- the light: beams, haze, ring ------------------------------------------------------------------------
  vec3 back = vec3(0.0), front = vec3(0.0);
  float xr = p.x / u_ring.y;                // x in ring radii
  if (u_on.x > 0.5) {
    const float CW = 7.0;                   // one hairline per 7 css px cell, at an irregular offset
    float X = (fc.x - u_c.x) / px;
    float id = floor(X / CW);
    float r1 = h11(id * 1.31 + 7.0), r2 = h11(id * 2.17 + 1.0), r3 = h11(id * 3.71 + 3.0);
    float r4 = h11(id * 5.3 + 11.0), r5 = h11(id * 7.9 + 2.0);
    float lx = id * CW + floor(r1 * (CW - 1.0)) + 0.5;
    float wide = step(r5, 0.14);
    float m = step(abs(X - lx - 0.5 * wide), 0.5 + 0.5 * wide);
    if (m > 0.0) {
      vec3 lc = r2 < 0.3333 ? RED : (r2 < 0.6667 ? GRN : BLU);
      float xn = lx * px / u_S / u_ring.y;
      float z = r4 * 2.0 - 1.0;             // where on the ring's disc the line stands: −1 back … +1 front
      float inRing = step(abs(xn), 1.0);
      float yb = u_ring.x - z * u_ring.z * sqrt(max(1.0 - xn * xn, 0.0)) + (1.0 - inRing) * (r4 - 0.5) * 0.1;
      float top = 0.98 * (0.72 + 0.28 * r3) * exp(-0.3 * xn * xn);
      float u = (p.y - yb) / top;
      float vert = mix(smoothstep(0.0, 0.12, u), step(0.0, u), inRing) * pow(max(1.0 - u, 0.0), 1.45);
      float horiz = exp(-1.15 * xn * xn);
      float tw = 1.0 + motion * (0.2 * sin(u_yaw * 2.0 + r1 * 40.0) + 0.1 * sin(u_time * 0.4 + r3 * 31.0)
        + 0.1 * sin(p.y * 7.0 - u_time * 0.55 + r2 * 6.28));
      vec3 L = lc * (m * (0.25 + 0.75 * r5) * vert * horiz * tw * 1.12);
      if (z > 0.0 && inRing > 0.5) front = L; else back = L;
    }
    // faint haze in the column
    float hu = (p.y - u_ring.x) / 0.85;
    back += vec3(0.55, 0.66, 1.0) * 0.04 * exp(-2.0 * xr * xr) * step(0.0, hu) * pow(max(1.0 - hu, 0.0), 2.2);
  }
  // light scatters round the object: the beam is a little stronger near the dish
  float halo = hs.a;
  back *= 1.0 + 1.1 * halo; front *= 1.0 + 1.1 * halo;

  if (u_on.y > 0.5) {
    vec2 q = vec2(p.x, p.y - u_ring.x);
    float e = length(q / u_ring.yz);
    float grad = length(q / (u_ring.yz * u_ring.yz)) / max(e, 1e-4);
    float dpx = (e - 1.0) / max(grad, 1e-4) * u_S / px;      // signed distance to the ring, css px
    float near = smoothstep(u_ring.z, -u_ring.z, q.y);       // the front arc is nearer → brighter
    float k = mix(0.3, 1.0, near);
    vec3 hair = vec3(exp(-pow((dpx - 0.9) / 0.75, 2.0)), exp(-pow(dpx / 0.75, 2.0)), exp(-pow((dpx + 0.9) / 0.75, 2.0)));
    back += hair * 0.42 * k + vec3(0.7, 0.8, 1.0) * (exp(-abs(dpx) / 9.0) * 0.07 * k);
    // the floor inside the ring: a breath of light and a faint, broken-up reflection of the dish
    float disc = smoothstep(1.0, 0.55, e);
    back += vec3(0.6, 0.72, 1.0) * 0.035 * disc;
    float row = floor(fc.y / (px * 2.0));
    vec2 rfc = vec2(fc.x + (h11(row) - 0.5) * 10.0 * px, u_res.y * 0.5 + u_dishOff.y - q.y * u_S / 0.42);
    vec4 rf = dishAt(rfc, 3.0) * mix(1.0, smoothstep(-0.18, 0.3, ly), u_line.z);   // appears as the dish does
    back += rf.rgb * disc * 0.13 * (0.35 + 0.65 * step(0.5, fract(row * 0.5 + 0.25)));
  }

  // halo + RGB fringe at the silhouette (outside the dish only)
  vec3 hcol = mix(hs.rgb, vec3(hs.a) * vec3(0.78, 0.86, 1.0), 0.55);
  back += hcol * 0.27;
  back += (RED * edge + BLU * edgeB) * vis * 0.9;

  // the light never meets the edge of the canvas
  vec2 ed = min(fc, u_res - fc) / (0.07 * u_S);
  float fade = smoothstep(0.0, 1.0, min(ed.x, ed.y));
  back *= fade; front *= fade;

  vec3 col = back * (1.0 - d.a) + d.rgb + front * (1.0 - 0.9 * d.a);

  // the sweep line itself: white-hot, a hint of dispersion, brighter where it meets the dish
  if (u_line.y > 0.0) {
    float dy = (p.y - ly) * u_S / px;
    float hit = dishAt(vec2(dfc.x, ly * u_S + u_c.y), 2.0).a;
    float k = u_line.y * smoothstep(0.36, 0.08, abs(p.x)) * (0.28 + 1.0 * hit);
    col += vec3(1.0) * exp(-dy * dy / 1.1) * k
      + RED * exp(-pow((dy - 1.8) / 1.2, 2.0)) * k * 0.6
      + BLU * exp(-pow((dy + 1.8) / 1.2, 2.0)) * k * 0.6
      + vec3(0.75, 0.86, 1.0) * exp(-abs(dy) / 12.0) * k * 0.22;
  }

  col += (h21(fc + fract(u_time) * 61.0 * motion) - 0.5) / 255.0;   // dither the dark gradients
  col = clamp(col, 0.0, 1.0);
  float a = clamp(max(d.a, max(col.r, max(col.g, col.b))), 0.0, 1.0);
  o = vec4(col, a);
}`;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const pretty = (src) => String(src).split(/[?#]/)[0].split('/').pop().replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ');

function normDishes(list) {
  return (Array.isArray(list) ? list : String(list || '').split(','))
    .map((d) => (typeof d === 'string' ? { src: d.trim() } : { ...d }))
    .filter((d) => d && d.src)
    .map((d) => ({ ...d, name: d.name || pretty(d.src), poster: d.poster || d.src.replace(/\.splat(?=$|[?#])/i, '.png') }));
}

const DEFAULTS = {
  dishes: [], cycleSeconds: 9, intro: true, interactive: true, beams: true, ring: true, glitch: true,
  pixelRatio: null, background: 'transparent', onReady: null, onDish: null, onError: null,
};

export class HoloStage {
  /** Resolves once the first dish is on stage (or the still fallback is up). Never rejects for a missing WebGL2. */
  static async create(container, opts = {}) {
    const s = new HoloStage(container, opts);
    await s._ready;
    return s;
  }

  constructor(container, opts = {}) {
    this.opts = { ...DEFAULTS, ...opts };
    this.dishes = normDishes(this.opts.dishes);
    this.container = container;
    this.index = 0; this.T = 0; this._tStart = 0; this._tOut = Infinity;
    this._tPulse = -1e9; this._gAt = -1e9; this._gNext = 7 + Math.random() * 5; this._gSeed = 0.37;
    this.yaw = 0.55; this.pitch = PITCH; this._vel = { yaw: 0, pitch: 0 }; this._auto = 1; this._lastInteract = -1e9;
    this._tilt = { x: 0, y: 0, tx: 0, ty: 0 };
    this._pointers = new Map(); this._bytes = new Map();
    this._running = false; this._paused = false; this._visible = true; this._hasDish = false; this._swapping = false;
    this._destroyed = false; this._raf = 0; this._last = 0; this._cleanup = [];
    this._reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._pr = this.opts.pixelRatio || Math.min(globalThis.devicePixelRatio || 1, 2);
    this._tickB = (t) => this._tick(t);

    const cs = getComputedStyle(container);
    if (cs.position === 'static') container.style.position = 'relative';
    if (this.opts.background && this.opts.background !== 'transparent') container.style.background = this.opts.background;

    if (FREEZE != null) {                      // test hook: jump straight to the frozen moment
      const P = this.opts.cycleSeconds, n = this.dishes.length;
      const k = P > 0 && n > 1 ? Math.floor(FREEZE / P) : 0;
      this.index = n ? k % n : 0; this._tStart = k * P; this.T = FREEZE;
      this.yaw += SPEED * FREEZE;
      if (k > 0) this._introDone = true;
    }
    this._ready = this._start();
  }

  // ------------------------------------------------------------------------------------------------ set-up
  async _start() {
    const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); this._cleanup.push(() => t.removeEventListener(ev, fn, o)); };
    on(document, 'visibilitychange', () => this._sync());
    if (typeof IntersectionObserver !== 'undefined') {
      this._io = new IntersectionObserver((es) => { this._visible = es[es.length - 1].isIntersecting; this._sync(); }, { rootMargin: '80px' });
      this._io.observe(this.container);
    }
    const c = (this.canvas = document.createElement('canvas'));
    Object.assign(c.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block',
      touchAction: 'pan-y', opacity: FREEZE != null ? '1' : '0', transition: 'opacity 1.4s ease' });
    c.setAttribute('aria-hidden', 'true');
    this.container.appendChild(c);
    try {
      this.viewer = new HoloViewer(c, {
        background: 'transparent', autoRotate: false, interactive: false, pixelRatio: this._pr,
        yaw: this.yaw, pitch: this.pitch, compositor: () => {},   // the stage presents every frame itself
      });
      this.gl = this.viewer.gl;
      this._initGL();
    } catch (e) {
      try { this.viewer?.destroy(); } catch {}
      this.viewer = null; this.gl = null; c.remove(); this.canvas = null;
      this._fallback();
      return;
    }
    on(c, 'webglcontextlost', () => { this._lost = true; });
    on(c, 'webglcontextrestored', () => { this._lost = false; try { this._initGL(); } catch {} this._kick(); });
    if (this.opts.interactive) this._bindInput(on); else c.style.pointerEvents = 'none';
    this._sync();
    requestAnimationFrame(() => { if (this.canvas) this.canvas.style.opacity = '1'; });

    if (!this.dishes.length) { this.opts.onReady?.(this); return; }
    // a .splat is a few MB: if it is not here quickly, the dish's still stands in, faintly, until the scan arrives
    this._ghostT = setTimeout(() => this._ghost(), FORCE_LOADING ? 0 : 350);
    await this._show(this.index, true);
    if (!this._fb && !this._destroyed) this.opts.onReady?.(this);   // (the still fallback has already said it is ready)
  }

  _ghost() {
    const d = this.dishes[this.index];
    if (this._gh || this._hasDish || this._destroyed || !this.canvas || !d || !d.poster) return;
    const box = (this._gh = document.createElement('div'));
    box.setAttribute('aria-hidden', 'true');
    box.style.cssText = 'position:absolute;inset:0;overflow:hidden;container-type:size;pointer-events:none';
    const img = new Image();
    img.alt = '';
    // same place and size as the still in _fallback(): 64 % of the stage unit, centred 8 % above the middle
    img.style.cssText = 'position:absolute;left:50%;top:50%;width:calc(.64*min(100cqw,100cqh));height:calc(.64*min(100cqw,100cqh));'
      + 'transform:translate(-50%,-62.5%);object-fit:contain;opacity:0;transition:opacity .7s ease';
    img.onload = () => { if (!this._hasDish && this._gh === box) img.style.opacity = '.3'; };
    img.onerror = () => { if (this._gh === box) this._ghostOff(true); };
    box.appendChild(img);
    this.container.insertBefore(box, this.canvas);     // under the canvas, so the beam still crosses it
    img.src = d.poster;
  }
  _ghostOff(now) {
    clearTimeout(this._ghostT);
    const box = this._gh; if (!box) return;
    this._gh = null;
    if (now) { box.remove(); return; }
    box.firstChild.style.opacity = '0';
    setTimeout(() => box.remove(), 800);
  }

  _initGL() {
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('holo-stage shader: ' + gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('holo-stage link: ' + gl.getProgramInfoLog(p));
    gl.deleteShader(vs); gl.deleteShader(fs);
    this._prog = p; this._u = {};
    for (const n of ['u_dish', 'u_res', 'u_dpr', 'u_S', 'u_c', 'u_dishOff', 'u_time', 'u_yaw', 'u_line', 'u_show', 'u_glitch', 'u_on', 'u_ring', 'u_lod'])
      this._u[n] = gl.getUniformLocation(p, n);
    this._vao = gl.createVertexArray();
    this._fbo = gl.createFramebuffer(); this._tex = gl.createTexture(); this._fw = this._fh = 0;
  }

  _target(w, h) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this._tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._tex, 0);
    this._fw = w; this._fh = h;
  }

  // ------------------------------------------------------------------------------------------------ dishes
  _fetch(i) {
    if (!this._bytes.has(i)) {
      const src = this.dishes[i].src;
      const p = FORCE_LOADING ? new Promise(() => {}) : fetch(src).then(async (r) => {
        if (!r.ok) throw new Error(`HoloStage: ${r.status} loading ${src}`);
        const buf = await r.arrayBuffer();
        if (buf.byteLength < 32 || /text\/html/i.test(r.headers.get('content-type') || '')) throw new Error(`HoloStage: ${src} is not a .splat`);
        return buf;
      });
      // a dish that failed is tried again, but not more than once a minute (it is skipped in the meantime)
      p.catch(() => setTimeout(() => { if (this._bytes.get(i) === p) this._bytes.delete(i); }, 60000));
      this._bytes.set(i, p);
    }
    return this._bytes.get(i);
  }

  async _show(i, first) {
    this._swapping = true;
    const n = this.dishes.length;
    let shown = false;
    for (let k = 0; k < n && !shown; k++) {             // a dish that fails to load is skipped
      const j = (i + k) % n;
      if (k && this._hasDish && j === this.index) { shown = true; break; }   // all the others failed: keep the one on stage
      try {
        const buf = await this._fetch(j);
        if (this._destroyed) return;
        await this.viewer.loadBuffer(buf);
        if (this._destroyed) return;
        this.viewer.setView({ distance: this.viewer.getView().distance * ZOOM });
        this.index = j; this._hasDish = true; shown = true;
      } catch (e) {
        if (this._destroyed) return;
        console.warn('[holo-stage]', e);
      }
    }
    if (!shown) { this._swapping = false; this._toStill(); return; }   // nothing loaded: the PNG cut-outs over a CSS beam
    this._ghostOff();
    if (FREEZE == null) this._tStart = first ? 0 : this.T;
    if (first && FREEZE == null) this.T = 0;
    if (first && !this.opts.intro && FREEZE == null) this._tStart = -IN;
    const P = this.opts.cycleSeconds;
    this._tOut = P > 0 && this.dishes.length > 1 ? this._tStart + Math.max(P, IN + OUT + 0.5) - OUT : Infinity;
    if (first && !this.opts.intro) this._tOut += IN;
    this._swapping = false;
    const dish = this.dishes[this.index];
    this.opts.onDish?.(this.index, dish);
    this.container.dispatchEvent(new CustomEvent('dish', { detail: { index: this.index, dish } }));
    if (this.dishes.length > 1) this._fetch((this.index + 1) % this.dishes.length).catch(() => {});   // preload the next one
  }

  /** De-materialise the current dish, then materialise the next. */
  next() {
    if (this._fb) return this._fb.next();
    if (this.dishes.length < 2 || this._swapping || FREEZE != null) return;
    this._tOut = Math.min(this._tOut, Math.max(this.T, this._tStart + IN * 0.6));
  }
  /** Re-scan: the sweep line runs bottom → top over the visible dish. */
  pulse() { if (!this._reduce && this.T > this._tStart + IN && this.T < this._tOut) this._tPulse = this.T; }
  /** Device-tilt parallax, x and y in −1..1. */
  setTilt(x, y) { this._tilt.tx = clamp(+x || 0, -1, 1); this._tilt.ty = clamp(+y || 0, -1, 1); }
  pause() { this._paused = true; this._sync(); }
  resume() { this._paused = false; this._sync(); }

  // ------------------------------------------------------------------------------------------------ loop
  _sync() {
    const run = !this._paused && this._visible && !document.hidden && !this._destroyed;
    if (run === this._running) return;
    this._running = run; this._last = 0;
    if (run && this.gl) this._kick(); else { cancelAnimationFrame(this._raf); this._raf = 0; }
    this._fb?.sync(run);
  }
  _kick() { if (this._running && !this._raf && this.gl) this._raf = requestAnimationFrame(this._tickB); }

  _tick(now) {
    this._raf = 0;
    if (!this._running) return;
    this._kick();
    const dt = this._last ? Math.min(0.05, (now - this._last) / 1000) : 0;
    this._last = now;
    if (this._lost) return;
    const live = FREEZE == null;
    if (live && this._hasDish && !this._swapping) this.T += dt;
    const T = this.T;

    // cycle
    if (live && this._hasDish && !this._swapping && T >= this._tOut + OUT) this._show((this.index + 1) % this.dishes.length, false);

    // turn: drag + inertia, auto-rotation eases back in after a few seconds
    const held = this._pointers.size > 0;
    if (!held && (Math.abs(this._vel.yaw) > 1e-4 || Math.abs(this._vel.pitch) > 1e-4)) {
      this.yaw += this._vel.yaw; this.pitch = clamp(this.pitch + this._vel.pitch, 0.16, 0.85);
      const k = Math.pow(0.0025, dt); this._vel.yaw *= k; this._vel.pitch *= k;
    }
    const idle = !held && performance.now() - this._lastInteract > 3000;
    this._auto += ((idle ? 1 : 0) - this._auto) * Math.min(1, dt * 1.5);
    if (live) this.yaw += SPEED * (this._reduce ? 0.6 : 1) * dt * this._auto;
    const tl = this._tilt; tl.x += (tl.tx - tl.x) * Math.min(1, dt * 6); tl.y += (tl.ty - tl.y) * Math.min(1, dt * 6);
    const vy = this.yaw + tl.x * 0.3, vp = this.pitch - tl.y * 0.1;
    if (vy !== this._vy || vp !== this._vp) { this._vy = vy; this._vp = vp; this.viewer.setView({ yaw: vy, pitch: vp }); }

    // glitch: ~120 ms every 7–12 s, never during a sweep
    let glitch = 0;
    const sweeping = T < this._tStart + IN || T > this._tOut || T < this._tPulse + PULSE;
    if (FORCE_GLITCH) glitch = 1;
    else if (live && this.opts.glitch && !this._reduce && this._hasDish) {
      if (T >= this._gNext) { this._gNext = T + 7 + Math.random() * 5; if (!sweeping) { this._gAt = T; this._gSeed = Math.random(); } }
      if (T < this._gAt + GLITCH) glitch = 1;
    }
    this._draw(T, glitch);
  }

  _draw(T, glitch) {
    const gl = this.gl, c = this.canvas, w = c.width, h = c.height;
    if (!w || !h) return;
    if (w !== this._fw || h !== this._fh) this._target(w, h);
    this.viewer.drawTo(this._fbo, w, h);

    // sweep state
    const Y0 = DISH_Y - 0.24, Y1 = DISH_Y + 0.28;
    let line = [0, 0, 0], show = this._hasDish && !this._swapping ? 1 : 0;
    const tin = (T - this._tStart) / IN, tout = (T - this._tOut) / OUT, tp = (T - this._tPulse) / PULSE;
    if (this._reduce) {                                   // no sweep: a plain fade
      show *= ease(tin * 2) * (1 - ease(tout));
    } else if (tout > 0) {
      line = [Y1 + (Y0 - Y1) * ease(tout), Math.min(1, tout * 6) * (1 - ease((tout - 0.85) / 0.15)), 1];
    } else if (tin < 1) {
      line = [Y0 + (Y1 - Y0) * ease(tin), Math.min(1, tin * 8) * (1 - ease((tin - 0.86) / 0.14)), 1];
    } else if (tp >= 0 && tp < 1) {
      line = [Y0 + (Y1 - Y0) * ease(tp), 0.85 * Math.min(1, tp * 8) * (1 - ease((tp - 0.8) / 0.2)), 0];
    }
    if (this._swapping && this._hasDish) { line = [Y0, 0, 1]; show = 0; }

    const S = Math.min(w, h), pr = this._pr, tl = this._tilt;
    const bob = this._reduce ? 0 : Math.sin(T * 0.85) * 3.2 * pr;
    const cx = Math.round(w / 2 - tl.x * 0.012 * S), cy = Math.round(h / 2);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.BLEND);
    gl.useProgram(this._prog); gl.bindVertexArray(this._vao);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this._tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    const u = this._u;
    gl.uniform1i(u.u_dish, 0);
    gl.uniform2f(u.u_res, w, h); gl.uniform1f(u.u_dpr, pr); gl.uniform1f(u.u_S, S); gl.uniform2f(u.u_c, cx, cy);
    gl.uniform2f(u.u_dishOff, tl.x * 0.022 * S, DISH_Y * S + bob + tl.y * 0.01 * S);
    gl.uniform1f(u.u_time, T % 600); gl.uniform1f(u.u_yaw, this.yaw);
    gl.uniform3f(u.u_line, line[0], line[1], line[2]);
    gl.uniform1f(u.u_show, show);
    gl.uniform2f(u.u_glitch, glitch, this._gSeed + (T - this._gAt < 1 ? Math.floor((T - this._gAt) / 0.06) * 0.173 : 0));
    gl.uniform3f(u.u_on, this.opts.beams ? 1 : 0, this.opts.ring ? 1 : 0, this._reduce ? 0 : 1);
    gl.uniform3f(u.u_ring, RING_Y, RING_RX, RING_RY);
    gl.uniform1f(u.u_lod, Math.max(2, Math.log2(S * 0.024)));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  // ------------------------------------------------------------------------------------------------ input
  _bindInput(on) {
    const c = this.canvas;
    c.style.cursor = 'grab';
    let last = 0, start = null;
    const mark = () => { this._lastInteract = performance.now(); this._auto = 0; };
    on(c, 'pointerdown', (e) => {
      try { c.setPointerCapture(e.pointerId); } catch {}
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      start = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
      this._vel.yaw = this._vel.pitch = 0; last = performance.now(); c.style.cursor = 'grabbing';
    });
    on(c, 'pointermove', (e) => {
      const p = this._pointers.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (start) start.moved += Math.abs(dx) + Math.abs(dy);
      if (!start || start.moved < 4) return;
      mark();
      const r = c.getBoundingClientRect(), s = 3.2 / Math.max(240, Math.min(r.width, r.height) * 1.4);
      const dyaw = -dx * s, dpitch = e.pointerType === 'touch' ? 0 : dy * s;   // touch keeps vertical for page scroll
      this.yaw += dyaw; this.pitch = clamp(this.pitch + dpitch, 0.16, 0.85);
      const now = performance.now(), k = Math.min(1, 16 / Math.max(1, now - last)); last = now;
      this._vel.yaw = this._vel.yaw * 0.4 + dyaw * k * 0.6; this._vel.pitch = this._vel.pitch * 0.4 + dpitch * k * 0.6;
    });
    const up = (e) => {
      if (!this._pointers.delete(e.pointerId)) return;
      if (performance.now() - last > 80) this._vel.yaw = this._vel.pitch = 0;
      if (e.type === 'pointerup' && start && start.moved < 6 && performance.now() - start.t < 450) this.pulse();
      else if (start && start.moved >= 4) mark();
      if (!this._pointers.size) c.style.cursor = 'grab';
    };
    on(c, 'pointerup', up); on(c, 'pointercancel', up);
  }

  // ------------------------------------------------------------------------------------------------ no WebGL2 / no splat
  // The dish's PNG cut-out over a CSS version of the beam and ring.
  _toStill() {                                 // WebGL is up but no .splat could be loaded: hand over to the still
    cancelAnimationFrame(this._raf); this._raf = 0; this._running = false;
    this._ghostOff(true);
    this._freeGL();
    this._fallback();
  }
  _freeGL() {
    const gl = this.gl;
    if (gl) { try { gl.deleteProgram(this._prog); gl.deleteFramebuffer(this._fbo); gl.deleteTexture(this._tex); gl.deleteVertexArray(this._vao); } catch {} }
    try { this.viewer?.destroy(); } catch {}     // also releases the shared GL context
    this.canvas?.remove();
    this.viewer = this.gl = this.canvas = null;
  }

  _fallback() {
    const box = document.createElement('div');
    box.setAttribute('aria-hidden', 'true');
    box.style.cssText = 'position:absolute;inset:0;overflow:hidden;container-type:size';
    const L = (c, a) => `rgba(${c},${a})`, R = '255,59,59', G = '43,217,107', B = '59,107,255';
    const beam = `repeating-linear-gradient(90deg,transparent 0 6px,${L(R, .8)} 6px 7px,transparent 7px 17px,${L(G, .6)} 17px 18px,transparent 18px 21px,${L(B, .9)} 21px 22px,transparent 22px 36px,${L(R, .45)} 36px 37px,transparent 37px 41px,${L(B, .55)} 41px 42px,transparent 42px 55px,${L(G, .8)} 55px 56px,transparent 56px 62px)`;
    const mask = 'radial-gradient(ellipse 30% 78% at 50% 100%,#000 0%,rgba(0,0,0,.5) 45%,transparent 78%)';
    box.innerHTML = `
      <div style="position:absolute;left:50%;top:50%;width:min(100cqw,100cqh);height:min(100cqw,100cqh);transform:translate(-50%,-50%)">
        <div style="position:absolute;left:0;right:0;top:0;height:80.5%;background:${beam};-webkit-mask-image:${mask};mask-image:${mask};opacity:.8"></div>
        <div style="position:absolute;left:23%;width:54%;top:71.1%;height:18.8%;border-radius:50%;box-shadow:0 0 0 1px rgba(255,255,255,.34),0 0 22px rgba(190,210,255,.14),inset 0 0 26px rgba(190,210,255,.08)"></div>
        <img alt="" style="position:absolute;left:18%;width:64%;top:10%;height:64%;object-fit:contain;opacity:0;transition:opacity .9s ease">
      </div>`;
    this.container.appendChild(box);
    const img = box.querySelector('img');
    let timer = 0, i = this.index, token = 0, shownOnce = false;
    const show = (k, tries = 0) => {
      const n = this.dishes.length;
      if (!n || this._destroyed) return;
      if (tries >= n) {                        // not one still could be loaded either: say so, the beam stays on its own
        if (!shownOnce) {
          const err = new Error('HoloStage: no dish could be loaded');
          console.warn('[holo-stage]', err);
          this.opts.onError?.(err);
          this.container.dispatchEvent(new CustomEvent('error', { detail: err }));
        }
        return;
      }
      const j = k % n, my = ++token, pre = new Image();
      pre.onload = () => {
        if (my !== token || this._destroyed) return;
        img.style.opacity = '0';
        setTimeout(() => {
          if (my !== token || this._destroyed) return;
          img.src = pre.src; img.style.opacity = '1';
          i = this.index = j;
          this.opts.onDish?.(j, this.dishes[j]);
          this.container.dispatchEvent(new CustomEvent('dish', { detail: { index: j, dish: this.dishes[j] } }));
        }, shownOnce ? 700 : 0);
        shownOnce = this._hasDish = true;
      };
      pre.onerror = () => { if (my === token && !this._destroyed) show(j + 1, tries + 1); };   // skip a missing still
      pre.src = this.dishes[j].poster;
    };
    const P = this.opts.cycleSeconds;
    this._fb = {
      box, next: () => show(i + 1),
      sync: (run) => { clearInterval(timer); timer = 0; if (run && P > 0 && this.dishes.length > 1 && FREEZE == null) timer = setInterval(() => show(i + 1), P * 1000); },
      destroy: () => { clearInterval(timer); box.remove(); },
    };
    show(this.index);
    this._sync();
    this.opts.onReady?.(this);
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true; this._running = false;
    cancelAnimationFrame(this._raf);
    this._io?.disconnect();
    for (const f of this._cleanup) f();
    this._cleanup = []; this._bytes.clear();
    this._fb?.destroy();
    this._ghostOff(true);
    this._freeGL();
  }
}

// ---------------------------------------------------------------- <holo-stage>
if (typeof customElements !== 'undefined' && !customElements.get('holo-stage')) {
  customElements.define('holo-stage', class extends HTMLElement {
    connectedCallback() {
      if (!this.style.display) this.style.display = 'block';
      if (!this.style.position) this.style.position = 'relative';
      if (this.stage) return;
      const flag = (n, def) => (this.hasAttribute(n) ? this.getAttribute(n) !== 'false' : def);
      const cyc = parseFloat(this.getAttribute('cycle'));
      this.stage = new HoloStage(this, {
        dishes: this.getAttribute('dishes') || '',
        cycleSeconds: isFinite(cyc) ? cyc : 9,
        interactive: flag('interactive', false), intro: flag('intro', true),
        beams: flag('beams', true), ring: flag('ring', true), glitch: flag('glitch', true),
        background: this.getAttribute('background') || 'transparent',
        onReady: () => this.dispatchEvent(new CustomEvent('ready')),
      });
    }
    disconnectedCallback() { this.stage?.destroy(); this.stage = null; }
    next() { this.stage?.next(); }
    pulse() { this.stage?.pulse(); }
    setTilt(x, y) { this.stage?.setTilt(x, y); }
    pause() { this.stage?.pause(); }
    resume() { this.stage?.resume(); }
  });
}

export default HoloStage;
