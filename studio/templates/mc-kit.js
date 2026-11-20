// modern-cafe kit — shared helpers for the 2026 café / bakery / breakfast templates (Editorial, Podium, Caff, Two Tone)
// and the refreshed classic café posters. Builds on lib.js. Rules baked in: flat colour, no blur shadows (contact
// shadows only), tracked micro caps instead of name/phone bars, prices as type with a raised £ + superscript pence, no '.00'.
import { font, splitPrice, dealPrice } from './lib.js';

export const mkCanvas = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));

/** Deterministic RNG. */
export function rng(seed = 1) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ───────── colour ─────────
export const hex = (c) => { const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c || '').trim()); if (!m) return null; let h = m[1]; if (h.length === 3) h = h.split('').map((x) => x + x).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
export const rgba = (a, al = 1) => `rgba(${a.map((v) => Math.round(Math.max(0, Math.min(255, v)))).join(',')},${al})`;
export function hue(c) {
  const a = hex(c); if (!a) return null;
  const [r, g, b] = a.map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d < 0.08) return { h: 0, s: 0, l: (mx + mn) / 2 };
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  const l = (mx + mn) / 2, s = d / (1 - Math.abs(2 * l - 1));
  return { h, s, l };
}
/** Snap the owner's brand colour to the 2026 palette family it belongs to. */
export function family(accent) {
  const k = hue(accent);
  if (!k || k.s < 0.18) return 'neutral';
  const h = k.h;
  if ((h < 20 || h >= 345) && k.l > 0.78) return 'pink';
  if (h < 20 || h >= 345) return 'red';
  if (h < 45) return 'orange';
  if (h < 70) return 'yellow';
  if (h < 170) return 'green';
  if (h < 255) return 'blue';
  if (h < 345) return 'pink';
  return 'red';
}

// ───────── dish cut-outs ─────────
const trimCache = new WeakMap();
/** Scanned cut-outs carry transparent padding — crop to the visible food. */
export function trimmed(img) {
  if (!img) return null;
  if (trimCache.has(img)) return trimCache.get(img);
  let out = img;
  try {
    const iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight;
    const c = mkCanvas(iw, ih), g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, iw, ih).data;
    let x0 = iw, y0 = ih, x1 = -1, y1 = -1;
    for (let y = 0; y < ih; y += 2) for (let x = 0; x < iw; x += 2) {
      if (d[(y * iw + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 > x0 && y1 > y0) {
      x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(iw - 1, x1 + 2); y1 = Math.min(ih - 1, y1 + 2);
      const w = x1 - x0 + 1, h = y1 - y0 + 1, t = mkCanvas(w, h);
      t.getContext('2d').drawImage(img, x0, y0, w, h, 0, 0, w, h);
      out = t;
    }
  } catch (e) { out = img; }
  trimCache.set(img, out);
  return out;
}
/** Aspect (w/h) of the trimmed dish (1.4 if unknown). */
export const aspect = (img) => { const t = trimmed(img); return t ? (t.width / t.height) : 1.4; };

/** Where a dish would land inside a box (contain). */
export function dishRect(img, x, y, w, h, { anchor = 'bottom', align = 'center', scale = 1 } = {}) {
  const im = trimmed(img); if (!im || w <= 0 || h <= 0) return null;
  const s = Math.min(w / im.width, h / im.height) * scale, dw = im.width * s, dh = im.height * s;
  const dx = align === 'left' ? x : align === 'right' ? x + w - dw : x + (w - dw) / 2;
  const dy = anchor === 'top' ? y : anchor === 'center' ? y + (h - dh) / 2 : y + h - dh;
  return { x: dx, y: dy, w: dw, h: dh };
}
/** Draw a dish with only a soft contact ellipse under it (no blur shadow, no halo). Returns the drawn rect. */
export function dish(ctx, img, x, y, w, h, { anchor = 'bottom', align = 'center', scale = 1, contact = 'rgba(40,25,10,0.28)', spread = 0.92, flat = 0.085, lift = 0.95 } = {}) {
  const r = dishRect(img, x, y, w, h, { anchor, align, scale });
  if (!r) return null;
  if (contact) {
    const cx = r.x + r.w / 2, cy = r.y + r.h * lift, rx = r.w * 0.5 * spread, ry = Math.max(1, r.h * flat);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, contact); g.addColorStop(0.55, contact.replace(/[\d.]+\)$/, (m) => `${parseFloat(m) * 0.45})`)); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.drawImage(trimmed(img), r.x, r.y, r.w, r.h);
  return r;
}

// ───────── fonts ─────────
const extraLoaded = new Map();
/** Load extra Google Fonts axes/styles lib's ensureFonts doesn't (italics, wider weight ranges). */
export function ensureExtra(spec, probes = []) {
  if (typeof document === 'undefined') return Promise.resolve();
  if (extraLoaded.has(spec)) return extraLoaded.get(spec);
  const p = (async () => {
    const href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
    await new Promise((r) => { l.onload = r; l.onerror = r; setTimeout(r, 4000); });
    await Promise.all(probes.map((pr) => document.fonts.load(pr).catch(() => {})));
  })();
  extraLoaded.set(spec, p);
  return p;
}

// ───────── text ─────────
const hasLS = (ctx) => 'letterSpacing' in ctx;
/** Font string with a family-appropriate fallback. */
export const F = (size, family, weight = 400, style = '') => `${style ? style + ' ' : ''}${weight} ${Math.max(1, Math.round(size))}px "${family}", "Helvetica Neue", Arial, sans-serif`;

/** Width of text at a font with tracking (em). */
export function tw(ctx, str, fontStr, em = 0, size = 0) {
  ctx.save(); ctx.font = fontStr;
  let w;
  if (hasLS(ctx)) { ctx.letterSpacing = `${em * size}px`; w = ctx.measureText(String(str)).width; }
  else w = ctx.measureText(String(str)).width;
  ctx.restore();
  // canvas adds tracking after the last glyph too — take it back off so alignment is optical
  return w - (hasLS(ctx) && String(str).length ? em * size : 0);
}
/** Draw text with tracking (em). baseline default alphabetic. Returns width. */
export function tx(ctx, str, x, y, fontStr, fill, { align = 'left', em = 0, size = 0, baseline = 'alphabetic', alpha = 1 } = {}) {
  const s = String(str == null ? '' : str); if (!s) return 0;
  const w = tw(ctx, s, fontStr, em, size);
  ctx.save(); ctx.font = fontStr; ctx.fillStyle = fill; ctx.textBaseline = baseline; ctx.textAlign = 'left'; ctx.globalAlpha *= alpha;
  if (hasLS(ctx)) ctx.letterSpacing = `${em * size}px`;
  const lx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.fillText(s, lx, y);
  ctx.restore();
  return w;
}
/** Shrink a single line from size until it fits maxW (not below min). */
export function fitSize(ctx, str, maxW, size, min, fontFn, em = 0) {
  let s = size;
  while (s > min && tw(ctx, str, fontFn(s), em, s) > maxW) s *= 0.95;
  return Math.max(s, min);
}
/** Ellipsise str (at a fixed font) until it fits maxW. Cuts at a comma/sentence first if one fits. */
export function clip(ctx, str, maxW, fontStr, em = 0, size = 0) {
  let t = String(str || '').trim();
  if (tw(ctx, t, fontStr, em, size) <= maxW) return t;
  const parts = t.split(/(?<=[.,;:—–])\s+/);
  let acc = '';
  for (const p of parts) { const n = acc ? acc + ' ' + p : p; if (tw(ctx, n.replace(/[,;:—–]$/, ''), fontStr, em, size) <= maxW) acc = n; else break; }
  if (acc) return acc.replace(/[,;:—–]$/, '');
  while (t.length > 1 && tw(ctx, t + '…', fontStr, em, size) > maxW) t = t.slice(0, -1).trimEnd();
  return t + '…';
}
/** Wrap words at a fixed font. Honors '\n'. */
export function wrap(ctx, str, maxW, fontStr, em = 0, size = 0) {
  const out = [];
  for (const para of String(str || '').split(/\n/)) {
    const words = para.split(/\s+/).filter(Boolean); let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (!cur || tw(ctx, t, fontStr, em, size) <= maxW) cur = t; else { out.push(cur); cur = w; } }
    if (cur) out.push(cur);
  }
  return out;
}
/** Fit a block: biggest size ≤ maxSize where wrapped lines fit maxW × maxH and ≤ maxLines. */
export function fitBlock(ctx, str, maxW, maxH, { family, weight = 400, style = '', maxSize = 200, minSize = 10, lh = 1, em = 0, maxLines = 3 } = {}) {
  let size = maxSize, lines = [];
  for (; size >= minSize; size *= 0.96) {
    const f = F(size, family, weight, style);
    lines = wrap(ctx, str, maxW, f, em, size);
    const wide = lines.some((l) => tw(ctx, l, f, em, size) > maxW);
    if (!wide && lines.length <= maxLines && (lines.length - 1) * size * lh + size * 0.8 <= maxH) break;
  }
  size = Math.max(size, minSize);
  lines = wrap(ctx, str, maxW, F(size, family, weight, style), em, size);
  return { lines, size, lh, family, weight, style, em };
}
/** Draw a fitted block with alphabetic baselines; y = top of the first line's caps (approx). Returns bottom (last baseline). */
export function drawBlock(ctx, fit, x, y, fill, { align = 'left', cap = 0.72 } = {}) {
  const f = F(fit.size, fit.family, fit.weight, fit.style);
  let b = y + fit.size * cap;
  fit.lines.forEach((l, i) => { tx(ctx, l, x, b + i * fit.size * fit.lh, f, fill, { align, em: fit.em, size: fit.size }); });
  return b + (fit.lines.length - 1) * fit.size * fit.lh;
}
/** Cap-height ratio for a family (digits/caps). */
const capCache = new Map();
export function capH(ctx, family, weight = 400, style = '') {
  const k = family + weight + style; if (capCache.has(k)) return capCache.get(k);
  ctx.save(); ctx.font = F(100, family, weight, style); const m = ctx.measureText('H0');
  ctx.restore(); const v = (m.actualBoundingBoxAscent || 72) / 100;
  if (typeof document === 'undefined' || document.fonts.check(F(100, family, weight, style))) capCache.set(k, v);
  return v;
}

// ───────── copy ─────────
/** 'MEAL DEAL' → 'Meal deal' (only when the owner typed all caps); keeps mixed case as typed. */
export function sentence(s) {
  const t = String(s || '').trim();
  if (!t || /[a-z]/.test(t) || !/[A-Z]/.test(t)) return t;
  const low = t.toLowerCase();
  return low.charAt(0).toUpperCase() + low.slice(1);
}
/** Add a full stop to short sentence-case headlines that end in a letter/number. */
export const stop = (s) => (/[A-Za-z0-9)]$/.test(s) && s.split(/\s+/).length <= 6 ? s + '.' : s);
/** 'Burger · Fries · Drink' → 'Burger, fries and drink.' */
export function listSentence(s) {
  const t = String(s || '').trim(); if (!t) return '';
  const parts = t.split(/\s*(?:·|\+|\||\/|•|,|&| and )\s*/i).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return /[.!?]$/.test(t) ? t : t + '.';
  const caps = parts.every((p) => !/[a-z]/.test(p));
  const items = parts.map((p, i) => { const q = caps ? p.toLowerCase() : p; return i === 0 ? q.charAt(0).toUpperCase() + q.slice(1) : (/^[A-Z][a-z]/.test(q) ? q.charAt(0).toLowerCase() + q.slice(1) : q); });
  return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1] + '.';
}
/** 'Burger · Fries · Drink' → ['Burger','Fries','Drink'] */
export const items = (s) => String(s || '').split(/\s*(?:·|\+|\||•|,)\s*/).map((p) => p.trim()).filter(Boolean);

/** Normalised deal info + graceful fallbacks. */
export function info(data) {
  const deal = data.deal || {}, R = data.restaurant || {}, d0 = (data.dishes || [])[0] || {};
  const headline = String(deal.headline || '').trim();
  return {
    name: String(R.name || '').trim(),
    phone: String(R.phone || '').trim(),
    address: String(R.address || '').trim(),
    accent: R.accent || '',
    hasDeal: !!(headline || String(deal.price || '').trim() || String(deal.includes || '').trim()),
    headline,
    dishName: String(d0.name || '').trim(),
    price: cleanPrice(dealPrice(data)),
    was: cleanPrice(String(deal.wasPrice || '').trim()),
    includes: String(deal.includes || '').trim(),
    when: String(deal.when || '').trim(),
    small: String(deal.smallPrint || '').trim(),
    dishes: (data.dishes || []).filter((d) => d && d.image),
    qr: data.qr || null,
  };
}

// ───────── prices ─────────
/** '£4.00' → '£4'; '£4.50' stays. */
export const cleanPrice = (l) => String(l || '').trim().replace(/([.,])00(?=\D*$)/, '');
/** Price layout: big numerals, a smaller raised £ and superscript pence (top-aligned to the numerals). */
function priceLayout(ctx, label, size, { family, weight = 400, style = '', sym = 0.5, pence = 0.46, gap = 0.03, inline = false }) {
  const p = splitPrice(cleanPrice(label));
  const frac = p.fraction ? (inline ? p.fraction : p.fraction.slice(1)) : '';
  const ss = inline ? size : size * sym, fs = inline ? size : size * pence;
  ctx.save();
  ctx.font = F(size, family, weight, style); const mm = ctx.measureText(p.main || ' ');
  ctx.font = F(ss, family, weight, style); const sm = ctx.measureText(p.symbol || ' ');
  ctx.font = F(fs, family, weight, style); const fm = ctx.measureText(frac || ' ');
  ctx.restore();
  const asc = mm.actualBoundingBoxAscent || size * 0.72;
  const wS = p.symbol ? sm.width + size * gap : 0, wM = mm.width, wF = frac ? fm.width + size * gap * 0.6 : 0;
  return { p, frac, ss, fs, asc, sAsc: sm.actualBoundingBoxAscent || ss * 0.72, fAsc: fm.actualBoundingBoxAscent || fs * 0.72, wS, wM, wF, w: wS + wM + wF, inline };
}
export const priceW = (ctx, label, size, o) => priceLayout(ctx, label, size, o).w;
/** Largest size ≤ maxSize whose price fits maxW (and whose numeral height fits maxH if given). */
export function fitPrice(ctx, label, maxW, maxSize, o, maxH = Infinity) {
  let s = maxSize;
  while (s > 6) { const L = priceLayout(ctx, label, s, o); if (L.w <= maxW && L.asc <= maxH) break; s *= 0.95; }
  return s;
}
/** Draw the price; (x by align, y = baseline of the numerals). Returns { w, top, asc }. */
export function drawPrice(ctx, label, x, y, size, { family, weight = 400, style = '', fill = '#000', align = 'left', sym = 0.5, pence = 0.46, gap = 0.03, inline = false } = {}) {
  const L = priceLayout(ctx, label, size, { family, weight, style, sym, pence, gap, inline });
  let cx = align === 'center' ? x - L.w / 2 : align === 'right' ? x - L.w : x;
  const top = y - L.asc;
  ctx.save(); ctx.fillStyle = fill; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  if (L.p.symbol) { ctx.font = F(L.ss, family, weight, style); ctx.fillText(L.p.symbol, cx, inline ? y : top + L.sAsc); cx += L.wS; }
  ctx.font = F(size, family, weight, style); ctx.fillText(L.p.main, cx, y); cx += L.wM;
  if (L.frac) { ctx.font = F(L.fs, family, weight, style); ctx.fillText(L.frac, cx + size * gap * 0.6, inline ? y : top + L.fAsc); }
  ctx.restore();
  return { w: L.w, top, asc: L.asc };
}
/** Small was-price with one thin strike. (x by align, y = baseline). Returns width. */
export function drawWas(ctx, label, x, y, size, { family, weight = 400, style = '', fill = '#000', strike = null, align = 'left', alpha = 1, em = 0, lw = 0.07 } = {}) {
  const t = cleanPrice(label); if (!t) return 0;
  const f = F(size, family, weight, style);
  const w = tx(ctx, t, x, y, f, fill, { align, alpha, em, size });
  const lx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = strike || fill; ctx.lineWidth = Math.max(1, size * lw);
  ctx.beginPath(); ctx.moveTo(lx - size * 0.06, y - size * 0.33); ctx.lineTo(lx + w + size * 0.06, y - size * 0.33); ctx.stroke(); ctx.restore();
  return w;
}

// ───────── furniture ─────────
/** Micro strip: tracked caps left + right on one line; right shrinks then drops under if it can't fit. Returns height used. */
export function microRow(ctx, left, right, x0, x1, y, size, family, fill, { weight = 400, em = 0.2, gapMin = 0 } = {}) {
  const L = String(left || '').toUpperCase(), Rt = String(right || '').toUpperCase();
  const full = x1 - x0, gap = gapMin || size * 2.5;
  const fl = (s) => F(s, family, weight);
  const ls = fitSize(ctx, L, full, size, size * 0.7, fl, em);
  const lt = clip(ctx, L, full, fl(ls), em, ls);
  const lw = lt ? tx(ctx, lt, x0, y, fl(ls), fill, { em, size: ls }) : 0;
  if (!Rt) return size;
  const avail = full - lw - (lw ? gap : 0);
  const rs = fitSize(ctx, Rt, avail, size, size * 0.8, fl, em);
  if (tw(ctx, Rt, fl(rs), em, rs) <= avail) { tx(ctx, Rt, x1, y, fl(rs), fill, { align: 'right', em, size: rs }); return size; }
  const r2 = fitSize(ctx, Rt, full, size, size * 0.7, fl, em);
  tx(ctx, clip(ctx, Rt, full, fl(r2), em, r2), x0, y + size * 1.7, fl(r2), fill, { em, size: r2 });
  return size * 2.7;
}
/** Text set around a circle (clockwise from the top). */
export function ringText(ctx, str, cx, cy, r, size, family, fill, { weight = 400, startAngle = -Math.PI / 2, fit = true } = {}) {
  ctx.save(); ctx.font = F(size, family, weight); ctx.fillStyle = fill; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const chars = [...String(str)];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0);
  const k = fit ? (Math.PI * 2 * r) / total : 1;
  let a = startAngle;
  chars.forEach((c, i) => {
    const step = (widths[i] * k) / r;
    const m = a + step / 2;
    ctx.save(); ctx.translate(cx + Math.cos(m) * r, cy + Math.sin(m) * r); ctx.rotate(m + Math.PI / 2); ctx.fillText(c, 0, 0); ctx.restore();
    a += step;
  });
  ctx.restore();
}
/** Flat circle sticker, rotated; draw(ctx) is called with the origin at its centre and the rotation applied. */
export function sticker(ctx, cx, cy, r, fill, rot, draw) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  if (draw) draw(ctx);
  ctx.restore();
}
/** Rounded rect path. */
export function rr(ctx, x, y, w, h, r) {
  const q = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + q, y); ctx.arcTo(x + w, y, x + w, y + h, q); ctx.arcTo(x + w, y + h, x, y + h, q);
  ctx.arcTo(x, y + h, x, y, q); ctx.arcTo(x, y, x + w, y, q); ctx.closePath();
}
/** Small QR on a quiet pad with a micro caption. Returns height used. */
export function qrBlock(ctx, qr, x, y, size, { caption = 'MENU', family, fill = '#000', pad = '#fff', capSize = 0 } = {}) {
  if (!qr) return 0;
  ctx.save(); ctx.fillStyle = pad; rr(ctx, x, y, size, size, size * 0.05); ctx.fill();
  const p = size * 0.08; ctx.imageSmoothingEnabled = false; ctx.drawImage(qr, x + p, y + p, size - 2 * p, size - 2 * p); ctx.restore();
  const cs = capSize || size * 0.1;
  if (caption) tx(ctx, caption.toUpperCase(), x + size / 2, y + size + cs * 1.6, F(cs, family, 400), fill, { align: 'center', em: 0.2, size: cs });
  return size + cs * 2;
}
