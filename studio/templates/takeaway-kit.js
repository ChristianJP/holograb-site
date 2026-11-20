// Shared drawing kit for the Takeaway pack (hot-deal, meal-deal, day-special, window-price).
// Adds cap-height-accurate type fitting, trimmed dish cut-outs, price typography and high-street shapes on top of lib.js.
import { font, splitPrice, roundRect, starburst } from './lib.js';

export const INK = '#141010';
export const YELLOW = '#ffd60a';
export const RED = '#e3171e';
export const WHITE = '#ffffff';

/** Layout facts for a format. m = ~5% print-safe margin; story keeps extra room for Instagram's UI. */
export function frame(W, H) {
  const u = Math.min(W, H) / 1080;
  const ar = H / W;
  const kind = ar > 1.6 ? 'story' : ar > 1.12 ? 'portrait' : ar < 0.85 ? 'landscape' : 'square';
  const m = Math.round(Math.min(W, H) * 0.05);
  const mt = kind === 'story' ? Math.round(H * 0.07) : m;
  const mb = kind === 'story' ? Math.round(H * 0.075) : m;
  return { u, ar, kind, m, mt, mb, portrait: kind === 'portrait' || kind === 'story' };
}

// ---- type ------------------------------------------------------------------------------------------
const capCache = new Map();
/** Cap height of a family as a fraction of font size (measured, cached). */
export function capRatio(ctx, family, weight) {
  const k = family + weight;
  if (!capCache.has(k)) {
    ctx.save(); ctx.font = font(200, family, weight);
    const r = (ctx.measureText('HE').actualBoundingBoxAscent || 140) / 200; ctx.restore();
    capCache.set(k, r);
  }
  return capCache.get(k);
}

/**
 * Fit upper-case display type by CAP height (not em box) so stacked condensed headlines can sit tight.
 * Returns { lines, size, cap, pitch, height, width, family, weight, spacing }.
 */
export function fitCaps(ctx, text, maxW, maxH, { family = 'Anton', weight = 400, maxSize = 600, minSize = 10, gap = 0.2, maxLines = 3, upper = true, spacing = 0 } = {}) {
  const t = (upper ? String(text || '').toUpperCase() : String(text || '')).trim();
  const cr = capRatio(ctx, family, weight);
  const words = t.split(/\s+/).filter(Boolean);
  let best = null;
  for (let size = Math.max(minSize, Math.floor(Math.min(maxSize, maxH / cr))); size >= minSize; size = Math.floor(size * 0.96)) {
    ctx.font = font(size, family, weight);
    const sp = spacing * size;
    const mw = (s) => ctx.measureText(s).width + Math.max(0, s.length - 1) * sp;
    // try every line count up to maxLines, balanced: pick the split with the smallest widest line
    for (let n = 1; n <= Math.min(maxLines, words.length || 1); n++) {
      const lines = balance(words, n, mw);
      const width = Math.max(...lines.map(mw));
      const cap = size * cr, height = lines.length * cap + (lines.length - 1) * cap * gap;
      if (width <= maxW && height <= maxH) { best = { lines, size, cap, pitch: cap * (1 + gap), height, width, family, weight, spacing: sp }; break; }
    }
    if (best) return best;
    if (size <= minSize) break;
  }
  ctx.font = font(minSize, family, weight);
  const cap = minSize * cr;
  return { lines: [t], size: minSize, cap, pitch: cap * (1 + gap), height: cap, width: ctx.measureText(t).width, family, weight, spacing: 0 };
}

function balance(words, n, mw) {
  if (n <= 1 || words.length <= 1) return [words.join(' ')];
  if (n === 2) {
    let bestL = null, bestW = Infinity;
    for (let i = 1; i < words.length; i++) {
      const l = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
      const w = Math.max(mw(l[0]), mw(l[1]));
      if (w < bestW) { bestW = w; bestL = l; }
    }
    return bestL;
  }
  // n >= 3: greedy against a target width, then fall back to word-per-line
  const total = mw(words.join(' '));
  const target = total / n;
  const lines = []; let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (cur && mw(test) > target * 1.15 && lines.length < n - 1) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Draw a fitCaps result. y = top of the caps of the first line. Hard offset shadow + outline = the classic shop-window look. */
export function drawCaps(ctx, fit, x, y, { align = 'left', fill = WHITE, stroke = null, strokeWidth = 0, shadow = null } = {}) {
  ctx.save();
  ctx.font = font(fit.size, fit.family, fit.weight);
  ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  fit.lines.forEach((line, i) => {
    const w = ctx.measureText(line).width + Math.max(0, line.length - 1) * fit.spacing;
    const lx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    const by = y + fit.cap + i * fit.pitch;
    const put = (fn, ox = 0, oy = 0) => {
      if (!fit.spacing) { fn(line, lx + ox, by + oy); return; }
      let cx = lx + ox; for (const ch of line) { fn(ch, cx, by + oy); cx += ctx.measureText(ch).width + fit.spacing; }
    };
    if (shadow) {
      ctx.fillStyle = shadow.color; ctx.strokeStyle = shadow.color; ctx.lineWidth = strokeWidth || 0.001;
      if (strokeWidth) put((s, a, b) => ctx.strokeText(s, a, b), shadow.dx, shadow.dy);
      put((s, a, b) => ctx.fillText(s, a, b), shadow.dx, shadow.dy);
    }
    if (stroke && strokeWidth) { ctx.strokeStyle = stroke; ctx.lineWidth = strokeWidth; put((s, a, b) => ctx.strokeText(s, a, b)); }
    ctx.fillStyle = fill; put((s, a, b) => ctx.fillText(s, a, b));
  });
  ctx.restore();
  return fit.height;
}

/** One-line label fitted to a box and drawn centred vertically on (y + h/2). */
export function label(ctx, text, x, y, w, h, opts = {}) {
  const f = fitCaps(ctx, text, w, h, { maxLines: 1, ...opts });
  const ax = opts.align === 'center' ? x + w / 2 : opts.align === 'right' ? x + w : x;
  drawCaps(ctx, f, ax, y + (h - f.height) / 2, opts);
  return f;
}

// ---- price -----------------------------------------------------------------------------------------
/** Price parts; non-numeric labels ("FREE", "2 FOR £6") come back as { text }. */
export function priceParts(lbl) {
  const s = String(lbl || '').trim();
  const p = splitPrice(s);
  if (!/^\d[\d,]*$/.test(p.main)) return { text: s.toUpperCase() };
  // whole-pound prices read better without ".00"
  const frac = p.fraction === '.00' ? '' : p.fraction;
  return { symbol: p.symbol, main: p.main, fraction: frac, suffix: p.suffix };
}

/**
 * Shop-window price: huge figures, £ and pence at 46% size top-aligned to the figures' cap height.
 * Fits into maxW × maxH (cap-height box). Returns { width, height, size }.
 * mode 'measure' draws nothing.
 */
export function bigPrice(ctx, lbl, cx, y, maxW, maxH, { family = 'Anton', weight = 400, fill = INK, stroke = null, strokeWidth = 0, shadow = null, align = 'center', measureOnly = false, small = 0.46 } = {}) {
  const pp = priceParts(lbl);
  if (pp.text != null) {
    // text deals ("2 FOR £6", "FREE"): a touch smaller than numerals, drawn from the TOP so the returned height is the drawn height
    const f = fitCaps(ctx, pp.text, maxW, maxH * 0.8, { family, weight, maxLines: 2, gap: 0.12 });
    if (!measureOnly) drawCaps(ctx, f, cx, y, { align, fill, stroke, strokeWidth, shadow });
    return { width: f.width, height: f.height, size: f.size };
  }
  const cr = capRatio(ctx, family, weight);
  const widthAt = (S) => {
    ctx.font = font(S * small, family, weight); const a = ctx.measureText(pp.symbol).width + (pp.symbol ? S * 0.03 : 0);
    ctx.font = font(S, family, weight); const b = ctx.measureText(pp.main).width;
    ctx.font = font(S * small, family, weight); const c = pp.fraction ? ctx.measureText(pp.fraction.replace(/^[.,]/, '')).width + S * 0.04 : 0;
    return a + b + c;
  };
  let S = maxH / cr;
  const w100 = widthAt(100);
  S = Math.min(S, (maxW / w100) * 100);
  const total = widthAt(S), capH = S * cr;
  if (measureOnly) return { width: total, height: capH, size: S };
  ctx.save(); ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  let x = align === 'center' ? cx - total / 2 : align === 'right' ? cx - total : cx;
  const base = y + capH;
  const sCap = S * small * cr;
  const parts = [];
  if (pp.symbol) parts.push([pp.symbol, S * small, y + sCap, S * 0.03]);
  parts.push([pp.main, S, base, 0]);
  if (pp.fraction) parts.push([pp.fraction.replace(/^[.,]/, ''), S * small, y + sCap, 0, true]);
  for (const [txt, sz, by, after, isFrac] of parts) {
    if (isFrac) x += S * 0.04;
    ctx.font = font(sz, family, weight);
    if (shadow) { ctx.fillStyle = shadow.color; ctx.strokeStyle = shadow.color; ctx.lineWidth = strokeWidth || 0.001; if (strokeWidth) ctx.strokeText(txt, x + shadow.dx, by + shadow.dy); ctx.fillText(txt, x + shadow.dx, by + shadow.dy); }
    if (stroke && strokeWidth) { ctx.strokeStyle = stroke; ctx.lineWidth = strokeWidth; ctx.strokeText(txt, x, by); }
    ctx.fillStyle = fill; ctx.fillText(txt, x, by);
    if (isFrac) { // underline under the pence — classic ticket style
      const fw = ctx.measureText(txt).width;
      ctx.fillRect(x + fw * 0.06, y + sCap + S * 0.06, fw * 0.88, Math.max(2, S * 0.045));
    }
    x += ctx.measureText(txt).width + after;
  }
  ctx.restore();
  return { width: total, height: capH, size: S };
}

/** "WAS £6.50" with a strike line through the price. Centred at cx, cap-top at y, cap-height h. */
export function wasPrice(ctx, lbl, cx, y, h, { family = 'Oswald', weight = 700, fill = WHITE, strike = RED, maxW = Infinity, align = 'center' } = {}) {
  if (!lbl) return 0;
  const f = fitCaps(ctx, 'WAS ' + lbl, maxW, h, { family, weight, maxLines: 1, upper: true, maxSize: h / capRatio(ctx, family, weight) });
  const x = align === 'center' ? cx : cx;
  drawCaps(ctx, f, x, y, { align, fill });
  ctx.save(); ctx.font = font(f.size, family, weight);
  const wWas = ctx.measureText('WAS ').width, wAll = f.width;
  const left = align === 'center' ? cx - wAll / 2 : align === 'right' ? cx - wAll : cx;
  ctx.strokeStyle = strike; ctx.lineWidth = Math.max(2, f.cap * 0.16); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(left + wWas - f.cap * 0.1, y + f.cap * 0.62); ctx.lineTo(left + wAll + f.cap * 0.1, y + f.cap * 0.38); ctx.stroke();
  ctx.restore();
  return f.height;
}

// ---- dishes ----------------------------------------------------------------------------------------
const trimCache = new WeakMap();
/** Alpha bounding box of a cut-out (scans a downscaled copy), so dishes fill their boxes instead of their padding. */
export function trimBox(img) {
  if (!img) return null;
  if (trimCache.has(img)) return trimCache.get(img);
  const iw = img.width || img.naturalWidth || 1, ih = img.height || img.naturalHeight || 1;
  let box = { x: 0, y: 0, w: iw, h: ih };
  try {
    const s = Math.min(1, 256 / Math.max(iw, ih));
    const cw = Math.max(1, Math.round(iw * s)), ch = Math.max(1, Math.round(ih * s));
    const c = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(cw, ch) : Object.assign(document.createElement('canvas'), { width: cw, height: ch });
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, cw, ch);
    const d = g.getImageData(0, 0, cw, ch).data;
    let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
    for (let yy = 0; yy < ch; yy++) for (let xx = 0; xx < cw; xx++) {
      if (d[(yy * cw + xx) * 4 + 3] > 20) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
    }
    if (x1 >= x0 && y1 >= y0) box = { x: Math.max(0, (x0 - 1) / s), y: Math.max(0, (y0 - 1) / s), w: Math.min(iw, (x1 - x0 + 3) / s), h: Math.min(ih, (y1 - y0 + 3) / s) };
  } catch { /* tainted or no canvas — use the whole image */ }
  trimCache.set(img, box);
  return box;
}

/**
 * Draw the trimmed dish contained in (x, y, w, h). anchor: 'bottom' | 'center' | 'top'; halign: 'center' | 'left' | 'right'.
 * Soft drop shadow underneath so it sits ON the poster. Returns the drawn rect.
 */
export function drawCut(ctx, img, x, y, w, h, { anchor = 'center', halign = 'center', shadow = 'rgba(0,0,0,0.38)', u = 1, rotate = 0, scale = 1 } = {}) {
  if (!img) return null;
  const b = trimBox(img);
  const s = Math.min(w / b.w, h / b.h) * scale;
  const dw = b.w * s, dh = b.h * s;
  const dx = halign === 'left' ? x : halign === 'right' ? x + w - dw : x + (w - dw) / 2;
  const dy = anchor === 'top' ? y : anchor === 'bottom' ? y + h - dh : y + (h - dh) / 2;
  ctx.save();
  if (rotate) { ctx.translate(dx + dw / 2, dy + dh / 2); ctx.rotate(rotate); ctx.translate(-(dx + dw / 2), -(dy + dh / 2)); }
  if (shadow) {
    ctx.save();
    ctx.fillStyle = shadow.replace(/[\d.]+\)$/, '0.30)');
    ctx.filter = `blur(${Math.round(dw * 0.03)}px)`;
    ctx.beginPath(); ctx.ellipse(dx + dw / 2, dy + dh * 0.93, dw * 0.46, dh * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.shadowColor = shadow; ctx.shadowBlur = dw * 0.05; ctx.shadowOffsetY = dw * 0.025;
  }
  ctx.drawImage(img, b.x, b.y, b.w, b.h, dx, dy, dw, dh);
  ctx.restore();
  return { x: dx, y: dy, w: dw, h: dh };
}

/** Aspect (w/h) of the trimmed dish, for layout. */
export const cutAspect = (img) => { const b = trimBox(img); return b ? b.w / b.h : 1.5; };

// ---- shapes ----------------------------------------------------------------------------------------
/** Radiating sunburst rays (the classic takeaway backdrop). */
export function rays(ctx, cx, cy, R, n, color, { rotation = 0 } = {}) {
  ctx.save(); ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a0 = rotation + (i * 2 * Math.PI) / n, a1 = a0 + Math.PI / n;
    ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R); ctx.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R); ctx.closePath();
  }
  ctx.fill(); ctx.restore();
}

/** Diagonal hazard / candy stripes clipped to a rect. */
export function stripes(ctx, x, y, w, h, c1, c2, period, angle = Math.PI / 4) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = c1; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = c2;
  const L = w + h;
  ctx.translate(x + w / 2, y + h / 2); ctx.rotate(angle);
  for (let i = -L; i < L; i += period) ctx.fillRect(i, -L, period / 2, 2 * L);
  ctx.restore();
}

/** Checkerboard strip (diner style). */
export function checker(ctx, x, y, w, h, cell, c1, c2) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = c1; ctx.fillRect(x, y, w, h); ctx.fillStyle = c2;
  const rows = Math.ceil(h / cell), cols = Math.ceil(w / cell) + 1;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if ((r + c) % 2 === 0) ctx.fillRect(x + c * cell, y + r * cell, cell, cell);
  ctx.restore();
}

/** Swing price tag (pointed left end with a punched hole). Path only; caller fills. */
export function tagPath(ctx, x, y, w, h) {
  const p = h * 0.42, r = h * 0.12;
  ctx.beginPath();
  ctx.moveTo(x + p, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + p, y + h); ctx.lineTo(x, y + h / 2); ctx.closePath();
}

/** Burst with a darker rim — reads as a sticker. */
export function burst(ctx, cx, cy, r, fill, rim, u, points = 18) {
  starburst(ctx, cx + r * 0.04, cy + r * 0.06, r, r * 0.84, points, 'rgba(0,0,0,0.35)');
  starburst(ctx, cx, cy, r, r * 0.84, points, rim);
  starburst(ctx, cx, cy, r * 0.93, r * 0.78, points, fill);
}

export { roundRect, starburst };

// ---- colour ----------------------------------------------------------------------------------------
export function hsl(hex) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s, l };
}
export const hslStr = (h, s, l, a = 1) => `hsla(${h.toFixed(1)},${(s * 100).toFixed(1)}%,${(l * 100).toFixed(1)}%,${a})`;

/** Owner accent if it's a warm, saturated red/orange-red, pushed to a deep poster red; else the classic red. */
export function warmRed(accent) {
  const c = hsl(accent);
  if (c && c.s > 0.45 && (c.h >= 345 || c.h <= 22) && c.l > 0.25 && c.l < 0.7) return { h: c.h, s: Math.max(0.8, c.s), l: Math.min(0.48, Math.max(0.4, c.l)) };
  return { h: 357, s: 0.86, l: 0.47 };
}

// ---- data ------------------------------------------------------------------------------------------
export function read(data, defaults = {}) {
  const deal = data.deal || {};
  const dishes = (data.dishes || []).filter(Boolean);
  const d0 = dishes[0] || {};
  const r = data.restaurant || {};
  return {
    name: String(r.name || '').trim(),
    phone: String(r.phone || '').trim(),
    accent: r.accent,
    dishes,
    images: dishes.map((d) => d.image).filter(Boolean),
    hasDeal: !!(deal.headline || deal.price || deal.includes || deal.when),
    headline: String(deal.headline || '').trim(),
    price: String(deal.price || d0.priceLabel || '').trim(),
    was: String(deal.wasPrice || '').trim(),
    includes: String(deal.includes || '').trim(),
    when: String(deal.when || '').trim(),
    small: String(deal.smallPrint || '').trim(),
    dishName: String(d0.name || '').trim(),
  };
}

/** Split an includes line into items: "Burger · Fries · Drink" → ['Burger', 'Fries', 'Drink']. */
export const items = (s) => String(s || '').split(/\s*(?:[·•|+,&\/]|\band\b|\bwith\b)\s*/i).map((x) => x.trim()).filter(Boolean);
