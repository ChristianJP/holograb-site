// holograb shared page helpers (BRAND). Plain ES module, no deps.

export const FALLBACK_PLANS = [
  { id: 'menu', name: 'Menu', setupFee: 249, monthly: 29, currency: 'GBP', highlight: false,
    features: ['Up to 40 dishes', 'All menu templates', 'QR menu site', 'Website embeds', 'Posters'] },
  { id: 'studio', name: 'Studio', setupFee: 499, monthly: 59, currency: 'GBP', highlight: true,
    features: ['Unlimited dishes', 'All templates', 'Custom domain', 'Turntable videos', 'Analytics', 'Quarterly re-scan visit'] },
  { id: 'custom', name: 'Custom build', setupFee: 1500, monthly: 99, currency: 'GBP', highlight: false, from: true,
    features: ['Bespoke site designed around your dishes', 'On-site scan day', 'Priority support'] },
];

// ---- session (Bearer token, SPEC §10) — localStorage can throw (private mode, blocked storage) ----
const TOKEN_KEY = 'holograb.token';
let memToken = null;
export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || memToken; } catch { return memToken; }
}
export function setToken(t) {
  memToken = t || null;
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {}
}
export const clearToken = () => setToken(null);
export function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Error from the API: .status (HTTP, 0 = network), .code (body.error), .message (body.message or a plain fallback). */
export class ApiError extends Error {
  constructor(status, body, fallback) {
    super((body && body.message) || fallback);
    this.status = status; this.code = body?.error || null; this.body = body || null;
  }
}

/** fetch JSON from the holograb API; always sends the Bearer token when signed in. */
export async function api(path, opts = {}) {
  const { json, ...rest } = opts;
  const init = { ...rest, headers: { ...authHeaders(), ...(opts.headers || {}) } };
  if (json !== undefined) {
    init.body = JSON.stringify(json);
    init.headers['Content-Type'] = 'application/json';
  }
  let res;
  try { res = await fetch(path, init); }
  catch { throw new ApiError(0, null, 'Can’t reach holograb — check your connection and try again.'); }
  const ct = res.headers.get('content-type') || '';
  if (!res.ok) {
    let body = null;
    if (ct.includes('json')) { try { body = await res.json(); } catch {} }
    throw new ApiError(res.status, body, `${init.method || 'GET'} ${path} → ${res.status}`);
  }
  return ct.includes('json') ? res.json() : res;
}

let toastEl, toastTimer;
export function toast(msg, ms = 1800) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'hg-toast hgx-toast';
    toastEl.setAttribute('role', 'status');
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('on'), ms);
}

export function money(n, currency = 'GBP') {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  } catch { return '£' + n; }
}

let viewerMod;
/** Import the HoloViewer module; resolves null if it is missing/broken so pages still render. */
export async function loadViewer() {
  if (viewerMod !== undefined) return viewerMod;
  try { viewerMod = await import('/viewer/holo-viewer.js'); }
  catch (e) { console.warn('[holograb] viewer unavailable', e); viewerMod = null; }
  return viewerMod;
}

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Irregular RGB vertical scanlines on a canvas (the brand glow band). */
export function drawScanlines(canvas, { density = 1, seed = 7 } = {}) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const paint = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    s = seed;
    const cols = ['255,59,59', '43,217,107', '59,107,255'];
    let x = 0;
    while (x < w) {
      x += (2 + rnd() * 14) / density;
      const c = cols[Math.floor(rnd() * 3)];
      const a = 0.25 + rnd() * 0.75;
      const top = rnd() * h * 0.18, bot = h - rnd() * h * 0.18;
      const grad = g.createLinearGradient(0, top, 0, bot);
      grad.addColorStop(0, `rgba(${c},0)`);
      grad.addColorStop(0.5, `rgba(${c},${a})`);
      grad.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = grad;
      g.fillRect(Math.round(x), top, rnd() < 0.15 ? 2 : 1, bot - top);
    }
  };
  paint();
  let raf;
  addEventListener('resize', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(paint); });
  return paint;
}
