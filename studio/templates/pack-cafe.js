// cafe templates — export default an array of template modules (see lib.js for the contract).
// Café / bakery / coffee shop / breakfast spot posters: Fresh & Bright, Menu Board (both refreshed for 2026, in mc-*.js),
// plus the Classic café looks Chalkboard and Breakfast Special (kept for owners who like them; style 'Classic café').
import freshBright from './mc-fresh-bright.js';
import menuBoard from './mc-menu-board.js';
import { unit, font, fitText, drawLines, roundRect, splitPrice, drawPrice, grain, starburst, dealPrice } from './lib.js';

// ───────────────────────── shared helpers (pack-local) ─────────────────────────

/** Deterministic RNG. */
function rng(seed = 1) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

const mkCanvas = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));

/** The scanned cut-outs carry lots of transparent padding — crop to the visible food so it can fill its box. */
const trimCache = new WeakMap();
function trimmed(img) {
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

/** Draw a (trimmed) dish cut-out contained in a box, with a silhouette drop shadow. Returns the drawn rect. */
function cutout(ctx, img, x, y, w, h, { anchor = 'bottom', align = 'center', shadow = 'rgba(40,20,0,0.32)', blur = 30, dy: sdy = 16, scale = 1 } = {}) {
  const im = trimmed(img);
  if (!im || w <= 0 || h <= 0) return null;
  const iw = im.width, ih = im.height;
  const s = Math.min(w / iw, h / ih) * scale, dw = iw * s, dh = ih * s;
  const dx = align === 'left' ? x : align === 'right' ? x + w - dw : x + (w - dw) / 2;
  const dy = anchor === 'top' ? y : anchor === 'center' ? y + (h - dh) / 2 : y + h - dh;
  ctx.save();
  if (shadow) { ctx.shadowColor = shadow; ctx.shadowBlur = blur; ctx.shadowOffsetY = sdy; }
  ctx.drawImage(im, dx, dy, dw, dh);
  ctx.restore();
  return { x: dx, y: dy, w: dw, h: dh };
}

/** Measure a price the way lib's drawPrice draws it. */
function priceWidth(ctx, label, size, family, weight) {
  const p = splitPrice(label); const small = size * 0.45;
  ctx.save();
  ctx.font = font(small, family, weight); const a = ctx.measureText(p.symbol).width + ctx.measureText(p.fraction).width;
  ctx.font = font(size, family, weight); const b = ctx.measureText(p.main).width;
  ctx.restore();
  return a + b + size * 0.02;
}
/** Largest price size (≤ maxSize) that fits maxW. gap = extra space after the currency symbol (× size). */
function fitPrice(ctx, label, maxW, maxSize, family, weight, gap = 0) {
  const g = gap && splitPrice(label).symbol ? gap : 0;
  let s = maxSize;
  while (s > 8 && priceWidth(ctx, label, s, family, weight) + g * s > maxW) s *= 0.94;
  return s;
}
/** Like lib drawPrice, but with a little breathing room after the £ so it never touches the numeral. (x by align, y = top) */
function drawPriceGap(ctx, label, x, y, size, { family, weight = 700, fill = '#fff', align = 'left', gap = 0.06 } = {}) {
  const p = splitPrice(label), small = size * 0.45, g = p.symbol ? gap * size : 0;
  const parts = [[p.symbol, small, size * 0.08, g], [p.main, size, 0, 0], [p.fraction, small, size * 0.08, 0]];
  ctx.save(); ctx.textBaseline = 'top'; ctx.fillStyle = fill;
  let total = size * 0.02;
  for (const [t, s, , gg] of parts) { if (!t) continue; ctx.font = font(s, family, weight); total += ctx.measureText(t).width + gg; }
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  for (const [t, s, dy, gg] of parts) { if (!t) continue; ctx.font = font(s, family, weight); ctx.fillText(t, cx, y + dy); cx += ctx.measureText(t).width + gg; }
  ctx.restore();
  return total;
}
/** Word-wrap at a fixed size (no shrinking). Returns a drawLines-compatible fit. */
function wrapAt(ctx, str, maxW, size, family, weight = 400, lineHeight = 1.1) {
  ctx.font = font(size, family, weight);
  const words = String(str || '').split(/\s+/).filter(Boolean), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } }
  if (cur) lines.push(cur);
  return { lines, size, lineHeight, family, weight, spacing: 0 };
}
/** Did fitText really fit? (its fallback returns one unwrapped line at minSize) */
function fitOk(ctx, f, maxW, maxLines = 99) {
  ctx.save(); ctx.font = font(f.size, f.family, f.weight);
  const ok = f.lines.length <= maxLines && f.lines.every((l) => ctx.measureText(l).width <= maxW + 1);
  ctx.restore(); return ok;
}

/** Single line of text shrunk to fit a width. Returns size used. */
function fitLine(ctx, text, maxW, maxSize, family, weight = 400, style = '', spacing = 0) {
  let s = maxSize;
  for (; s > 6; s *= 0.95) {
    ctx.font = font(s, family, weight, style);
    if (ctx.measureText(text).width + Math.max(0, text.length - 1) * spacing * s <= maxW) break;
  }
  return s;
}
function text(ctx, str, x, y, size, family, { weight = 400, style = '', fill = '#000', align = 'left', baseline = 'alphabetic', spacing = 0, alpha = 1 } = {}) {
  ctx.save();
  ctx.font = font(size, family, weight, style); ctx.fillStyle = fill; ctx.textAlign = align; ctx.textBaseline = baseline; ctx.globalAlpha = alpha;
  if (spacing && 'letterSpacing' in ctx) ctx.letterSpacing = `${spacing * size}px`;
  ctx.fillText(str, x, y);
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

/** Organic soft blob path. */
function blobPath(ctx, cx, cy, rx, ry, seed = 3, n = 8, wob = 0.07) {
  const r = rng(seed), pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3, k = 1 + wob * (r() * 2 - 1);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  ctx.beginPath();
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  let m0 = mid(pts[n - 1], pts[0]); ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], m = mid(p, q); ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]); }
  ctx.closePath();
}

const hex = (c) => { const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c || '').trim()); if (!m) return null; let h = m[1]; if (h.length === 3) h = h.split('').map((x) => x + x).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const rgb = (a) => `rgb(${a.map((v) => Math.round(Math.max(0, Math.min(255, v)))).join(',')})`;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const lum = (a) => (0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]) / 255;

/** Normalised deal info + graceful fallbacks. */
function info(data) {
  const deal = data.deal || {}, d0 = (data.dishes || [])[0] || {};
  const headline = String(deal.headline || '').trim();
  return {
    name: String((data.restaurant && data.restaurant.name) || '').trim(),
    phone: String((data.restaurant && data.restaurant.phone) || '').trim(),
    hasDeal: !!headline,
    headline,
    dishName: String(d0.name || '').trim(),
    price: dealPrice(data),
    was: String(deal.wasPrice || '').trim(),
    includes: String(deal.includes || '').trim(),
    when: String(deal.when || '').trim(),
    small: String(deal.smallPrint || '').trim(),
    imgs: (data.dishes || []).map((d) => d.image).filter(Boolean),
  };
}

/** Extra font styles lib's ensureFonts doesn't fetch (italics). */
const extraLoaded = new Set();
async function ensureExtra(spec, probe) {
  if (extraLoaded.has(spec) || typeof document === 'undefined') return;
  extraLoaded.add(spec);
  const href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
  await new Promise((r) => { l.onload = r; l.onerror = r; setTimeout(r, 4000); });
  await document.fonts.load(probe).catch(() => {});
}

// ───────────────────────── chalk helpers ─────────────────────────

/** Wobbly chalk stroke through points (several jittered passes). */
function chalkLine(ctx, pts, width, seed = 5, { color = '#fff', passes = 3 } = {}) {
  const r = rng(seed);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color;
  for (let p = 0; p < passes; p++) {
    ctx.globalAlpha = p === 0 ? 0.95 : 0.45; ctx.lineWidth = width * (p === 0 ? 1 : 0.6);
    const j = width * 0.35;
    ctx.beginPath();
    pts.forEach(([x, y], i) => { const px = x + (r() - 0.5) * j, py = y + (r() - 0.5) * j; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
    ctx.stroke();
  }
  ctx.restore();
}
/** Points along a quadratic curve. */
function curvePts(x0, y0, cx, cy, x1, y1, n = 40) {
  const out = [];
  for (let i = 0; i <= n; i++) { const t = i / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; out.push([a * x0 + b * cx + c * x1, a * y0 + b * cy + c * y1]); }
  return out;
}
/** Hand-drawn circle: two loose overlapping loops. */
function chalkCircle(ctx, cx, cy, r, width, seed = 9) {
  const rr = rng(seed);
  for (let loop = 0; loop < 2; loop++) {
    const pts = [], start = -2.2 + rr() * 0.6, ph = rr() * 6, turn = loop ? 1.0 : 1.12;
    for (let i = 0; i <= 90; i++) {
      const t = i / 90, a = start + t * Math.PI * 2 * turn;
      const k = 1 + 0.035 * Math.sin(a * 2 + ph) + (loop ? 0.04 : 0) + 0.015 * t;
      pts.push([cx + Math.cos(a) * r * k * 1.04, cy + Math.sin(a) * r * k * 0.96]);
    }
    chalkLine(ctx, pts, width * (loop ? 0.7 : 1), seed + loop * 7, { passes: 2 });
  }
}
/** Hand-drawn arrow along a curve, head at the end. */
function chalkArrow(ctx, x0, y0, cx, cy, x1, y1, width, seed = 11) {
  const pts = curvePts(x0, y0, cx, cy, x1, y1);
  chalkLine(ctx, pts, width, seed);
  const [px, py] = pts[pts.length - 4], a = Math.atan2(y1 - py, x1 - px), L = width * 6.5;
  chalkLine(ctx, [[x1 - Math.cos(a - 0.5) * L, y1 - Math.sin(a - 0.5) * L], [x1, y1], [x1 - Math.cos(a + 0.5) * L, y1 - Math.sin(a + 0.5) * L]], width, seed + 3);
}
/** Swoosh underline under a word. */
function chalkUnderline(ctx, x0, x1, y, width, seed = 21) {
  const w = x1 - x0;
  chalkLine(ctx, curvePts(x0, y + width, x0 + w * 0.5, y - width * 2.2, x1, y - width * 0.4), width, seed);
  chalkLine(ctx, curvePts(x0 + w * 0.12, y + width * 3.4, x0 + w * 0.55, y + width * 1.4, x1 - w * 0.08, y + width * 2.2), width * 0.7, seed + 5);
}
/** Eat into a chalk layer so strokes look powdery. */
function erodeChalk(lctx, W, H, u, seed = 4) {
  const tile = 256, c = mkCanvas(tile, tile), g = c.getContext('2d'), id = g.createImageData(tile, tile), r = rng(seed);
  for (let i = 0; i < id.data.length; i += 4) { const v = r(); id.data[i + 3] = Math.round(255 * Math.min(1, Math.pow(v, 4) * 1.05)); }
  g.putImageData(id, 0, 0);
  // a few horizontal drag streaks
  g.fillStyle = 'rgba(0,0,0,0.5)';
  for (let k = 0; k < 40; k++) g.fillRect(r() * tile, r() * tile, 6 + r() * 40, 1);
  const pat = lctx.createPattern(c, 'repeat');
  if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(Math.max(1, u * 1.1)));
  lctx.save(); lctx.globalCompositeOperation = 'destination-out'; lctx.fillStyle = pat; lctx.fillRect(0, 0, W, H); lctx.restore();
}
/** Slate board: deep green, vignette, eraser smudges, dust. */
function slate(ctx, W, H, u) {
  const g = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.62);
  g.addColorStop(0, '#36473d'); g.addColorStop(0.6, '#2a3830'); g.addColorStop(1, '#1a241e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const r = rng(77);
  ctx.save(); ctx.filter = `blur(${Math.round(40 * u)}px)`;
  for (let i = 0; i < 9; i++) {   // eraser swipes
    ctx.globalAlpha = 0.035 + r() * 0.04; ctx.strokeStyle = '#e8efe9'; ctx.lineCap = 'round'; ctx.lineWidth = (90 + r() * 140) * u;
    const x = r() * W, y = r() * H, len = (300 + r() * 600) * u, a = -0.3 + r() * 0.6;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + len * 0.5, y - 60 * u, x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  for (let i = 0; i < 1400 * (W * H) / (1080 * 1350); i++) { // chalk dust specks
    ctx.globalAlpha = 0.05 + r() * 0.18; ctx.fillStyle = '#f2f6f2';
    const s = (0.6 + r() * 2.2) * u; ctx.fillRect(r() * W, r() * H, s, s);
  }
  ctx.restore();
  grain(ctx, 0, 0, W, H, 0.05, 31);
}

// ───────────────────────── 1. Chalkboard ─────────────────────────

const CH = { head: 'Caveat Brush', body: 'Kalam', mark: 'Permanent Marker' };

const chalkboard = {
  id: 'chalkboard',
  name: 'Chalkboard',
  style: 'Classic café',
  description: 'Hand-chalked specials board — cafés, coffee shops, delis',
  formats: ['a4', 'a3', 'ig-post', 'ig-story', 'square', 'table-card'],
  dishes: { min: 1, max: 2 },
  fonts: ['Caveat Brush', 'Kalam', 'Permanent Marker'],
  defaults: { headline: "TODAY'S SPECIAL" },
  render(ctx, W, H, data) {
    const u = unit(W, H), I = info(data), r = H / W;
    slate(ctx, W, H, u);
    const layer = mkCanvas(W, H), L = layer.getContext('2d');
    const chalk = '#f4f1e8';
    const mx = W * 0.065, my = H * 0.05;
    const headline = I.hasDeal ? I.headline : (I.dishName || 'Today\'s special');
    const kicker = I.hasDeal ? I.name : "Today's special";
    const note = I.hasDeal ? I.dishName : 'treat yourself!';
    const wide = r < 1.15;
    const lw = 7 * u;  // chalk line width

    // price circle content
    const drawPriceCircle = (cx, cy, R) => {
      // board-coloured disc underneath so the chalk price stays readable over a white plate
      ctx.save(); ctx.fillStyle = '#2c3a32'; ctx.shadowColor = '#2c3a32'; ctx.shadowBlur = 24 * u;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.04, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      grain(ctx, cx - R * 1.1, cy - R * 1.1, R * 2.2, R * 2.2, 0.03, 31);
      chalkCircle(L, cx, cy, R, lw * 1.1, 13);
      const label = I.was ? `was ${I.was}` : (I.hasDeal ? 'only' : '');
      const ps = fitPrice(L, I.price, R * 1.45, label ? R * 0.8 : R * 0.92, CH.mark, 400, 0.03);
      // label sits in the top cap of the circle; price below it with clear air between
      const py = label ? cy - R * 0.26 : cy - ps * 0.55;
      drawPriceGap(L, I.price, cx, py, ps, { family: CH.mark, weight: 400, fill: chalk, align: 'center', gap: 0.03 });
      if (label) {
        const ws = R * 0.2, ly = cy - R * 0.5;
        const tw = text(L, label, cx, ly, ws, CH.body, { weight: 700, fill: chalk, align: 'center', alpha: 0.88 });
        if (I.was) chalkLine(L, [[cx - tw * 0.12, ly - ws * 0.3], [cx + tw * 0.52, ly - ws * 0.38]], lw * 0.5, 3);
      }
    };

    if (!wide) {
      // ── portrait / story / table card ──
      let y = my + 10 * u;
      // kicker with flourishes
      const ks = fitLine(ctx, kicker, W * 0.6, 54 * u, CH.body, 700);
      const kw = text(L, kicker, W / 2, y + ks, ks, CH.body, { weight: 700, fill: chalk, align: 'center' });
      chalkLine(L, [[W / 2 - kw / 2 - 120 * u, y + ks * 0.62], [W / 2 - kw / 2 - 30 * u, y + ks * 0.66]], lw * 0.6, 41);
      chalkLine(L, [[W / 2 + kw / 2 + 30 * u, y + ks * 0.66], [W / 2 + kw / 2 + 120 * u, y + ks * 0.62]], lw * 0.6, 42);
      y += ks * 1.55;
      // headline
      const hf = fitText(L, headline, W - 2 * mx, H * (r > 1.6 ? 0.2 : 0.2), { family: CH.head, weight: 400, maxSize: 250 * u, minSize: 40 * u, lineHeight: 0.98, maxLines: 2 });
      L.save(); L.translate(W / 2, y); L.rotate(-0.025);
      const hh = drawLines(L, hf, 0, 0, { align: 'center', fill: chalk });
      L.font = font(hf.size, CH.head, 400);
      const lastW = Math.min(W - 2 * mx, L.measureText(hf.lines[hf.lines.length - 1]).width);
      chalkUnderline(L, -lastW * 0.48, lastW * 0.48, hh + 8 * u, lw * 0.9);
      L.restore();
      y += hh + 50 * u;

      // footer block (bottom up)
      let fy = H - my - 6 * u;
      const foot = [];
      if (I.hasDeal) {
        if (I.when) foot.push({ t: I.when, s: 48 * u, f: CH.body, w: 400 });
        if (I.includes) foot.push({ t: I.includes, s: 66 * u, f: CH.body, w: 700 });
      } else {
        foot.push({ t: I.name, s: 70 * u, f: CH.head, w: 400 });
      }
      if (I.small) foot.unshift({ t: I.small, s: 28 * u, f: CH.body, w: 400 });
      for (const ln of foot) {
        const s = fitLine(ctx, ln.t, W - 2 * mx, ln.s, ln.f, ln.w);
        text(L, ln.t, W / 2, fy, s, ln.f, { weight: ln.w, fill: chalk, align: 'center' });
        fy -= s * 1.3;
      }
      fy -= 20 * u;

      // dish region
      const regTop = y, regH = Math.max(100 * u, fy - regTop);
      const R = Math.min(W * 0.2, regH * 0.3);
      const colW = R * 2.3;
      const dishW = W - 2 * mx - colW * 0.72;
      const imgs = I.imgs.slice(0, 2);
      let main = null;
      const t0 = trimmed(imgs[0]), wideDish = !!t0 && ((imgs.length === 1 && t0.width / t0.height > 1.15) || regH / (W - 2 * mx) > 0.98);
      if (wideDish) {
        const bx = mx, by = regTop + regH * 0.12, bw = W - 2 * mx, bh = regH * 0.88 - R * 1.1;
        if (imgs.length === 2) {
          cutout(ctx, imgs[1], bx, by, bw * 0.62, bh * 0.66, { anchor: 'bottom', blur: 40 * u, dy: 20 * u, shadow: 'rgba(0,0,0,0.45)' });
          main = cutout(ctx, imgs[0], bx + bw * 0.38, by + bh * 0.28, bw * 0.62, bh * 0.72, { anchor: 'bottom', blur: 40 * u, dy: 20 * u, shadow: 'rgba(0,0,0,0.5)' });
        } else main = cutout(ctx, imgs[0], bx, by, bw, bh, { anchor: 'center', blur: 40 * u, dy: 20 * u, shadow: 'rgba(0,0,0,0.5)' });
      } else if (imgs.length === 2) {
        const b = cutout(ctx, imgs[1], mx, regTop + regH * 0.06, dishW * 0.62, regH * 0.78, { anchor: 'bottom', blur: 40 * u, dy: 20 * u, shadow: 'rgba(0,0,0,0.45)' });
        main = cutout(ctx, imgs[0], mx + dishW * 0.34, regTop + regH * 0.16, dishW * 0.66, regH * 0.84, { anchor: 'bottom', blur: 40 * u, dy: 20 * u, shadow: 'rgba(0,0,0,0.5)' }) || b;
      } else if (imgs.length) {
        main = cutout(ctx, imgs[0], mx, regTop + regH * 0.04, dishW, regH * 0.96, { anchor: 'center', blur: 40 * u, dy: 20 * u, shadow: 'rgba(0,0,0,0.5)' });
      }
      // right column: note + arrow + price circle
      // price circle tucked bottom-right, over the front plate's edge
      const cx = W - mx - R * 1.0, cy = regTop + regH - R * 1.0;
      // the note: up to 2 lines, never smaller than 30u — if it can't be read, leave it (and the arrow) off
      const noteFit = (maxW) => {
        if (!note) return null;
        const f = fitText(L, note, maxW, 58 * u * 2.3, { family: CH.body, weight: 700, maxSize: 58 * u, minSize: 30 * u, lineHeight: 1.05, maxLines: 2 });
        return fitOk(L, f, maxW, 2) ? f : null;
      };
      // arrow that never runs through the price circle: try a few bends, else skip it
      const safeArrow = (ax0, ay0, tx, ty, circ) => {
        if (Math.hypot(tx - ax0, ty - ay0) < 110 * u) return;
        const cands = [[tx + (ax0 - tx) * 0.15, ay0 + (ty - ay0) * 0.12], [tx, ay0], [tx - (ax0 - tx) * 0.15, ay0 - 30 * u]];
        for (const [qx, qy] of cands) {
          const pts = curvePts(ax0, ay0, qx, qy, tx, ty);
          if (!circ || pts.every(([px, py]) => Math.hypot(px - circ.x, py - circ.y) > circ.R * 1.15)) { chalkArrow(L, ax0, ay0, qx, qy, tx, ty, lw * 0.85); return; }
        }
      };
      if (main && !wideDish) {
        const nf = noteFit(colW * 1.05);
        if (nf) {
          const nTop = regTop - nf.size * 0.1;
          L.save(); L.translate(W - mx, nTop); L.rotate(0.04);
          drawLines(L, nf, 0, 0, { align: 'right', fill: chalk });
          L.restore();
          const ax0 = W - mx - colW * 0.45, ay0 = nTop + nf.lines.length * nf.size * 1.05 + 24 * u;
          // aim at the visible top of the front cut-out
          const tx = main.x + main.w * 0.6, ty = main.y + main.h * 0.1 - 18 * u;
          safeArrow(ax0, ay0, tx, ty, { x: cx, y: cy, R });
        }
      }
      if (wideDish && main) {
        // note + arrow from the top-right corner down onto the dish
        const nf = noteFit(W * 0.5);
        const two = imgs.length === 2;
        const pcx = two ? mx + R : W - mx - R, pcy = Math.min(regTop + regH - R, main.y + main.h + R * (two ? 0.2 : 0.25));
        if (nf) {
          const nTop = regTop - nf.size * 0.55;
          drawLines(L, nf, W - mx, nTop, { align: 'right', fill: chalk });
          const ax0 = W - mx - W * 0.12, ay0 = nTop + nf.lines.length * nf.size * 1.05 + 14 * u;
          const tx = main.x + main.w * (two ? 0.5 : 0.72), ty = main.y + main.h * (two ? 0.02 : 0.12) - (two ? 14 * u : 0);
          safeArrow(ax0, ay0, tx, ty, { x: pcx, y: pcy, R });
        }
        drawPriceCircle(pcx, pcy, R);
      } else drawPriceCircle(cx, cy, R);
    } else {
      // ── square: text left, dish right ──
      const colW = W * 0.45;
      let y = my + 10 * u;
      const ks = fitLine(ctx, kicker, colW, 44 * u, CH.body, 700);
      const kw = text(L, kicker, mx, y + ks, ks, CH.body, { weight: 700, fill: chalk });
      chalkLine(L, [[mx + kw + 20 * u, y + ks * 0.66], [Math.min(W - mx, mx + kw + 110 * u), y + ks * 0.62]], lw * 0.55, 41);
      y += ks * 1.6;
      const hf = fitText(L, headline, colW, H * 0.36, { family: CH.head, weight: 400, maxSize: 190 * u, minSize: 36 * u, lineHeight: 0.98, maxLines: 3 });
      L.save(); L.translate(mx, y); L.rotate(-0.02);
      const hh = drawLines(L, hf, 0, 0, { align: 'left', fill: chalk });
      L.font = font(hf.size, CH.head, 400);
      const lastW = Math.min(colW, L.measureText(hf.lines[hf.lines.length - 1]).width);
      chalkUnderline(L, 0, lastW * 0.95, hh + 6 * u, lw * 0.8);
      L.restore();
      const headBottom = y + hh + 40 * u;
      // one dish cluster on the right: back dish raised, front dish overlapping in front of it
      const dx = W * 0.44, dw = W - mx - dx;
      const imgs = I.imgs.slice(0, 2);
      const R = W * 0.17;
      const dTop = my, dH = H - my - dTop;
      let front = null;
      if (imgs.length === 2) {
        cutout(ctx, imgs[1], dx + dw * 0.3, dTop, dw * 0.7, dH * 0.52, { anchor: 'bottom', align: 'right', blur: 30 * u, dy: 14 * u, shadow: 'rgba(0,0,0,0.45)' });
        front = cutout(ctx, imgs[0], dx + dw * 0.14, dTop + dH * 0.28, dw * 0.86, dH * 0.56, { anchor: 'bottom', align: 'left', blur: 30 * u, dy: 14 * u, shadow: 'rgba(0,0,0,0.5)' });
      } else if (imgs.length) {
        front = cutout(ctx, imgs[0], dx, dTop + dH * 0.04, dw, dH * 0.74, { anchor: 'center', blur: 30 * u, dy: 14 * u, shadow: 'rgba(0,0,0,0.5)' });
      }
      // price circle overlaps the front plate's lower-left
      const pcx = Math.max(mx + W * 0.3 + R * 1.1, front ? front.x - R * 0.3 : dx + R * 0.4);
      const pcy = H - my - R * 1.02;
      drawPriceCircle(pcx, pcy, R);
      // left column, bottom-up: name/phone, then when, then includes (kept clear of the circle)
      const lw2 = Math.max(W * 0.3, pcx - R * 1.1 - mx);
      let by = H - my;
      const foot = I.hasDeal ? I.phone : I.name;
      if (foot) {
        const fam = I.hasDeal ? CH.body : CH.head;
        const ns = fitLine(ctx, foot, lw2, (I.hasDeal ? 38 : 60) * u, fam, 400);
        text(L, foot, mx, by, ns, fam, { fill: chalk, alpha: I.hasDeal ? 0.8 : 1 });
        by -= ns * 1.6;
      }
      if (I.hasDeal && I.when) {
        const s = fitLine(ctx, I.when, lw2, 40 * u, CH.body, 400);
        text(L, I.when, mx, by, s, CH.body, { fill: chalk, alpha: 0.9 });
        by -= s * 1.35;
      }
      if (I.hasDeal && I.includes) {
        let f = fitText(L, I.includes, lw2, 150 * u, { family: CH.body, weight: 700, maxSize: 50 * u, minSize: 28 * u, lineHeight: 1.12, maxLines: 3 });
        if (!fitOk(L, f, lw2, 3)) f = wrapAt(L, I.includes, lw2, 28 * u, CH.body, 700, 1.12);
        const fh = f.lines.length * f.size * 1.12;
        drawLines(L, f, mx, Math.max(headBottom, by - fh), { fill: chalk });
      }
    }
    erodeChalk(L, W, H, u);
    ctx.save(); ctx.shadowColor = 'rgba(255,255,255,0.22)'; ctx.shadowBlur = 6 * u; ctx.drawImage(layer, 0, 0); ctx.restore();
  },
};

// 2. Fresh & Bright — refreshed for 2026, lives in mc-fresh-bright.js

// ───────────────────────── 3. Breakfast Special ─────────────────────────

const BK = { head: 'Fredoka', serif: 'Playfair Display', body: 'Poppins' };

const breakfast = {
  id: 'breakfast',
  name: 'Breakfast Special',
  style: 'Classic café',
  description: 'Sunny yellow sunburst — breakfast deals, morning coffee & cake, until-11:30 offers',
  formats: ['a4', 'a3', 'ig-post', 'ig-story', 'square', 'table-card'],
  dishes: { min: 1, max: 2 },
  fonts: ['Fredoka', 'Playfair Display', 'Poppins'],
  defaults: { headline: 'BREAKFAST DEAL' },
  async render(ctx, W, H, data) {
    await ensureExtra('Playfair+Display:ital,wght@1,700', `italic 700 64px "Playfair Display"`);
    const u = unit(W, H), I = info(data), r = H / W;
    const brown = '#4a2008', red = '#d9381e', cream = '#fff7e2';
    const mx = W * 0.07, my = H * 0.05;
    const wide = r < 1.15;
    const headline = I.hasDeal ? I.headline : (I.dishName || 'Breakfast');

    // sun centre = where the dishes sit
    const sun = wide ? { x: W * 0.7, y: H * 0.56 } : { x: W * 0.5, y: H * (r > 1.6 ? 0.56 : 0.6) };
    const g = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, Math.hypot(W, H) * 0.7);
    g.addColorStop(0, '#ffe680'); g.addColorStop(0.45, '#ffc93a'); g.addColorStop(1, '#ff9f1c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // rays
    ctx.save(); ctx.translate(sun.x, sun.y);
    const n = 28, Rr = Math.hypot(W, H);
    for (let i = 0; i < n; i++) {
      if (i % 2) continue;
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, Rr * 0.7);
      rg.addColorStop(0, 'rgba(255,255,240,0.55)'); rg.addColorStop(1, 'rgba(255,255,240,0.05)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, Rr, a0, a1); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    grain(ctx, 0, 0, W, H, 0.03, 5);

    // text block
    let y = my;
    const tx = wide ? mx : W / 2, align = wide ? 'left' : 'center', colW = wide ? W * 0.5 : W - 2 * mx;
    const nameS = fitLine(ctx, I.name.toUpperCase(), colW, 34 * u, BK.body, 700, '', 0.18);
    text(ctx, I.name.toUpperCase(), tx, y + nameS, nameS, BK.body, { weight: 700, fill: brown, align, spacing: 0.18 });
    y += nameS * 2.1;
    const kick = 'Good morning';
    const ks = fitLine(ctx, kick, colW, 72 * u, BK.serif, 700, 'italic');
    text(ctx, kick, tx, y + ks * 0.85, ks, BK.serif, { weight: 700, style: 'italic', fill: red, align });
    y += ks * 1.1;
    const hf = fitText(ctx, headline, colW, H * (wide ? 0.32 : 0.2), { family: BK.head, weight: 700, maxSize: (wide ? 150 : 210) * u, minSize: 40 * u, lineHeight: 0.92, upper: true, maxLines: wide ? 3 : 2 });
    y += drawLines(ctx, hf, tx, y, { align, fill: brown, shadow: { color: 'rgba(255,250,230,0.9)', blur: 0, x: 0, y: 6 * u } }) + 20 * u;
    if (I.when) {
      const s = fitLine(ctx, I.when, colW * 0.85, 40 * u, BK.body, 600);
      ctx.save(); ctx.font = font(s, BK.body, 600); const tw = ctx.measureText(I.when).width; ctx.restore();
      const pw = tw + s * 1.8, ph = s * 1.9, px = wide ? mx : W / 2 - pw / 2;
      ctx.fillStyle = brown; roundRect(ctx, px, y, pw, ph, ph / 2); ctx.fill();
      text(ctx, I.when, px + pw / 2, y + ph * 0.66, s, BK.body, { weight: 600, fill: cream, align: 'center' });
      y += ph + 10 * u;
    }

    // bottom band (includes) or name/phone
    const bandText = I.hasDeal && I.includes ? I.includes : (I.phone ? `${I.name}${I.name ? '  ·  ' : ''}${I.phone}` : I.name);
    let bandTop = H - my;
    if (bandText) {
      const bw = wide ? W * 0.5 - mx * 0.5 : W - 2 * mx;
      const fam = I.hasDeal && I.includes ? BK.head : BK.body;   // measure in the family we draw with
      const s = fitLine(ctx, bandText, bw - 60 * u, (I.hasDeal && I.includes ? 50 : 36) * u, fam, 600);
      const bh = s * 2.1;
      bandTop = H - my - bh;
      if (!wide) {
        ctx.fillStyle = cream; roundRect(ctx, mx, bandTop, bw, bh, bh / 2); ctx.fill();
        text(ctx, bandText, W / 2, bandTop + bh * 0.66, s, I.hasDeal && I.includes ? BK.head : BK.body, { weight: 600, fill: brown, align: 'center' });
      } else {
        const tw = (ctx.font = font(s, fam, 600), ctx.measureText(bandText).width);
        const pw = Math.min(W - 2 * mx, tw + 60 * u);
        ctx.fillStyle = cream; roundRect(ctx, mx, bandTop, pw, bh, bh / 2); ctx.fill();
        text(ctx, bandText, mx + 30 * u, bandTop + bh * 0.66, s, fam, { weight: 600, fill: brown });
      }
    }

    // plate disc + dishes
    let disc;
    if (!wide) {
      const top = y + 20 * u, bot = bandTop - 30 * u;
      const rad = Math.min(W * 0.4, (bot - top) * 0.5);
      disc = { x: W / 2, y: top + (bot - top) * 0.5, r: rad };
    } else {
      disc = { x: W * 0.7, y: H * 0.5, r: Math.min(W * 0.225, H * 0.36) };
    }
    ctx.save(); ctx.shadowColor = 'rgba(150,70,0,0.35)'; ctx.shadowBlur = 50 * u; ctx.shadowOffsetY = 20 * u;
    ctx.fillStyle = cream; ctx.beginPath(); ctx.arc(disc.x, disc.y, disc.r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.strokeStyle = 'rgba(217,56,30,0.25)'; ctx.lineWidth = 4 * u; ctx.setLineDash([2 * u, 14 * u]); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(disc.x, disc.y, disc.r * 0.92, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    const imgs = I.imgs.slice(0, 2), D = disc.r;
    if (imgs.length === 2) {
      // two equal-height boxes side by side on the plate; the hero (first) dish in front on the left
      const bh2 = D * 1.25, bw2 = D * 1.0, by2 = disc.y - D * 0.66;
      cutout(ctx, imgs[1], disc.x - D * 0.04, by2, bw2, bh2, { anchor: 'center', blur: 30 * u, dy: 14 * u });
      cutout(ctx, imgs[0], disc.x - D * 0.96, by2 + D * 0.06, bw2, bh2, { anchor: 'center', blur: 30 * u, dy: 14 * u });
    } else if (imgs.length) {
      cutout(ctx, imgs[0], disc.x - D * 0.92, disc.y - D * 0.95, D * 1.84, D * 1.8, { anchor: 'center', blur: 30 * u, dy: 14 * u });
    }
    // price badge (scalloped)
    const R = wide ? Math.min(H * 0.15, (bandTop - y) * 0.45) : Math.min(D * 0.62, W * 0.16);
    const bx = wide ? mx + R * 1.05 : Math.min(W - mx - R, disc.x + D * 0.84), by = wide ? Math.min(y + R + 20 * u, bandTop - R - 24 * u) : Math.min(disc.y + D * 0.6, bandTop - R * 0.95);
    ctx.save(); ctx.shadowColor = 'rgba(120,30,0,0.35)'; ctx.shadowBlur = 24 * u; ctx.shadowOffsetY = 10 * u;
    starburst(ctx, bx, by, R, R * 0.93, 22, red); ctx.restore();
    ctx.save(); ctx.strokeStyle = 'rgba(255,247,226,0.7)'; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.arc(bx, by, R * 0.82, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    const lab = !!(I.was || I.hasDeal);
    const ps = fitPrice(ctx, I.price, R * 1.4, R * (lab ? 0.88 : 0.92), BK.head, 700, 0.03);
    drawPriceGap(ctx, I.price, bx, by - ps * (lab ? 0.3 : 0.45), ps, { family: BK.head, weight: 700, fill: cream, align: 'center', gap: 0.03 });
    if (I.was) {
      const ws = R * 0.21, wy = by - R * 0.4; text(ctx, `was ${I.was}`, bx, wy, ws, BK.body, { weight: 600, fill: 'rgba(255,247,226,0.9)', align: 'center' });
      ctx.save(); ctx.font = font(ws, BK.body, 600); const tw = ctx.measureText(`was ${I.was}`).width; ctx.restore();
      ctx.save(); ctx.strokeStyle = cream; ctx.lineWidth = ws * 0.1; ctx.beginPath(); ctx.moveTo(bx - tw * 0.1, wy - ws * 0.33); ctx.lineTo(bx + tw * 0.52, wy - ws * 0.33); ctx.stroke(); ctx.restore();
    } else if (I.hasDeal) {
      text(ctx, 'ONLY', bx, by - R * 0.4, R * 0.2, BK.body, { weight: 700, fill: cream, align: 'center', spacing: 0.15 });
    }
    if (wide && I.name && bandText !== I.name && !(I.phone)) { /* name already at top */ }
    if (I.small) text(ctx, I.small, W - mx, H - my * 0.55, 20 * u, BK.body, { weight: 500, fill: brown, align: 'right', alpha: 0.8 });
  },
};

// 4. Menu Board — refreshed for 2026, lives in mc-menu-board.js

export default [freshBright, menuBoard, chalkboard, breakfast];
