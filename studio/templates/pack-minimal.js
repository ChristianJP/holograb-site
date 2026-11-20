// minimal templates — export default an array of template modules (see lib.js for the contract).
// Quiet, gallery-like posters: one dish, lots of negative space, noir or cream. Ported from the first Studio layouts
// (hero / specimen / menu card), now driven by the deal fields. No holograb mark — the poster is the restaurant's.
import { unit, fitText, roundRect, dealPrice } from './lib.js';
import { price as typePrice } from './mt-kit.js';

const TONES = {
  noir:  { bg: '#0b0b0b', fg: '#f4f4f2', mu: '#8a8a86', rule: 'rgba(244,244,242,.28)', glow: 'rgba(255,255,255,.07)', shadow: 'rgba(0,0,0,.55)' },
  cream: { bg: '#efeee6', fg: '#141414', mu: '#77766f', rule: 'rgba(20,20,20,.3)',      glow: 'rgba(0,0,0,.06)',        shadow: 'rgba(40,30,10,.22)' },
};
const SANS = 'Archivo', MONO = 'JetBrains Mono';
const FONTS = [SANS, MONO];
const sansF = (px, w = 800) => `${w} ${Math.round(px)}px "${SANS}", "Helvetica Neue", Arial, sans-serif`;
const monoF = (px, w = 500) => `${w} ${Math.round(px)}px "${MONO}", ui-monospace, Menlo, monospace`;
const hasLS = (ctx) => 'letterSpacing' in ctx;

// ───────── helpers ─────────

/** Draw text with tracking (em fraction). align: left | center | right. Returns drawn width. */
function track(ctx, txt, x, y, fontStr, color, { align = 'left', em = 0, px = 0, baseline = 'alphabetic' } = {}) {
  const t = String(txt || '');
  if (!t) return 0;
  ctx.save();
  ctx.font = fontStr; ctx.fillStyle = color; ctx.textBaseline = baseline; ctx.textAlign = 'left';
  const sp = em * px;
  let w;
  if (hasLS(ctx)) { ctx.letterSpacing = `${sp}px`; w = ctx.measureText(t).width; }
  else w = ctx.measureText(t).width + Math.max(0, t.length - 1) * sp;
  const lx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  if (hasLS(ctx) || !sp) ctx.fillText(t, lx, y);
  else { let cx = lx; for (const ch of t) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + sp; } }
  ctx.restore();
  return w;
}
function trackW(ctx, txt, fontStr, em, px) {
  ctx.save(); ctx.font = fontStr;
  const t = String(txt || ''); let w;
  if (hasLS(ctx)) { ctx.letterSpacing = `${em * px}px`; w = ctx.measureText(t).width; }
  else w = ctx.measureText(t).width + Math.max(0, t.length - 1) * em * px;
  ctx.restore(); return w;
}
const label = (ctx, txt, x, y, px, color, align = 'left') => track(ctx, String(txt || '').toUpperCase(), x, y, monoF(px), color, { align, em: 0.24, px });
const labelW = (ctx, txt, px) => trackW(ctx, String(txt || '').toUpperCase(), monoF(px), 0.24, px);
/** Ellipsise a label until it fits maxW at px. */
function clipLabel(ctx, txt, px, maxW) {
  let t = String(txt || '');
  if (labelW(ctx, t, px) <= maxW) return t;
  while (t.length > 1 && labelW(ctx, t + '…', px) > maxW) t = t.slice(0, -1).trimEnd();
  return t + '…';
}
/** The top line: `left` label, `right` label right-aligned. The right one shrinks a little to clear the left; if it still
 *  won't fit it drops to its own line under the left one. Returns the extra height used (0 or one label line). */
function topRow(ctx, left, right, m, W, y, lab, u, color) {
  const full = W - 2 * m, gap = 40 * u, MIN = 0.78;
  const shrink = (txt, maxW) => { let px = lab; while (px > lab * MIN && labelW(ctx, txt, px) > maxW) px *= 0.94; return px; };
  const lpx = shrink(left, full), L = clipLabel(ctx, left, lpx, full);
  if (L) label(ctx, L, m, y, lpx, color);
  if (!right) return 0;
  const avail = full - (L ? labelW(ctx, L, lpx) + gap : 0);
  const rpx = shrink(right, avail);
  if (labelW(ctx, right, rpx) <= avail) { label(ctx, right, W - m, y, rpx, color, 'right'); return 0; }
  const px2 = shrink(right, full);
  label(ctx, clipLabel(ctx, right, px2, full), m, y + lab * 1.8, px2, color);
  return lab * 1.8;
}
const display = (ctx, txt, x, y, px, color, align = 'left', w = 800) => track(ctx, txt, x, y, sansF(px, w), color, { align, em: -0.045, px });
const displayW = (ctx, txt, px, w = 800) => trackW(ctx, txt, sansF(px, w), -0.045, px);

/** Shrink a single line until it fits maxW (never below min). */
function fitLine(ctx, txt, maxW, px0, min, w = 800) {
  let px = px0;
  while (px > min && displayW(ctx, txt, px, w) > maxW) px *= 0.95;
  return Math.max(px, min);
}
/** Wrap into ≤ maxLines lines at a fixed font; last line ellipsised. */
function wrapLines(ctx, txt, fontStr, maxW, maxLines) {
  ctx.save(); ctx.font = fontStr;
  const words = String(txt || '').split(/\s+/).filter(Boolean), out = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t;
  }
  if (cur) out.push(cur);
  if (out.length > maxLines) {
    out.length = maxLines;
    let last = out[maxLines - 1] + '…';
    while (last.length > 2 && ctx.measureText(last).width > maxW) last = last.slice(0, -2).trimEnd() + '…';
    out[maxLines - 1] = last;
  }
  ctx.restore(); return out;
}
function para(ctx, lines, x, y, fontStr, color, lh, align = 'left') {
  ctx.save(); ctx.font = fontStr; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
  ctx.restore();
  return lines.length * lh;
}

/** The scanned cut-outs carry transparent padding — crop to the food so it fills its box. Cached per image. */
const trimCache = new WeakMap();
function trimmed(img) {
  if (!img) return null;
  if (trimCache.has(img)) return trimCache.get(img);
  let out = img;
  try {
    const iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight;
    const step = Math.max(1, Math.round(Math.max(iw, ih) / 512));
    const c = mk(iw, ih), g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, iw, ih).data;
    let x0 = iw, y0 = ih, x1 = -1, y1 = -1;
    for (let y = 0; y < ih; y += step) for (let x = 0; x < iw; x += step) {
      if (d[(y * iw + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 > x0 && y1 > y0) {
      const p = step * 2;
      x0 = Math.max(0, x0 - p); y0 = Math.max(0, y0 - p); x1 = Math.min(iw - 1, x1 + p); y1 = Math.min(ih - 1, y1 + p);
      const w = x1 - x0 + 1, h = y1 - y0 + 1, t = mk(w, h);
      t.getContext('2d').drawImage(img, x0, y0, w, h, 0, 0, w, h);
      out = t;
    }
  } catch { out = img; }
  trimCache.set(img, out);
  return out;
}
function mk(w, h) { return typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }); }

/** Contain a trimmed dish in a box, bottom-anchored, with a soft silhouette shadow. */
function dish(ctx, img, x, y, w, h, tone, u, { anchor = 'bottom', fill = 0.92 } = {}) {
  const im = trimmed(img);
  if (!im) return null;
  const iw = im.width, ih = im.height, s = Math.min(w / iw, h / ih) * fill, dw = iw * s, dh = ih * s;
  const dx = x + (w - dw) / 2, dy = anchor === 'center' ? y + (h - dh) / 2 : y + h - dh;
  ctx.save();
  ctx.shadowColor = tone.shadow; ctx.shadowBlur = 50 * u; ctx.shadowOffsetY = 22 * u;
  ctx.drawImage(im, dx, dy, dw, dh);
  ctx.restore();
  return { x: dx, y: dy, w: dw, h: dh };
}
function floorGlow(ctx, cx, cy, r, tone) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, tone.glow); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
}
function qrBlock(ctx, qr, x, y, s, tone, caption) {
  if (!qr) return;
  ctx.save();
  ctx.fillStyle = '#fff'; roundRect(ctx, x, y, s, s, s * 0.08); ctx.fill();
  const p = s * 0.08; ctx.imageSmoothingEnabled = false; ctx.drawImage(qr, x + p, y + p, s - 2 * p, s - 2 * p);
  ctx.restore();
  if (caption) label(ctx, caption, x + s / 2, y + s + s * 0.16, s * 0.085, tone.mu, 'center');
}
/** Price with an optional struck "was" price above it, right-aligned at x. Returns total height. */
function priceStack(ctx, price, was, x, baseY, px, tone) {
  display(ctx, price, x, baseY, px, tone.fg, 'right', 700);
  if (was) {
    const wpx = px * 0.36, wy = baseY - px * 0.95;
    const w = display(ctx, was, x, wy, wpx, tone.mu, 'right', 500);
    ctx.save(); ctx.strokeStyle = tone.mu; ctx.lineWidth = Math.max(1, wpx * 0.07);
    ctx.beginPath(); ctx.moveTo(x - w - wpx * 0.1, wy - wpx * 0.32); ctx.lineTo(x + wpx * 0.1, wy - wpx * 0.32); ctx.stroke(); ctx.restore();
  }
}
/** Hero price: ~1.5× the old size, raised £ and superscript pence, no ".00"; struck was-price above. Right-aligned at x,
 *  baseline baseY. measure: true → just { width, height }. */
function heroPrice(ctx, price, was, x, baseY, capH, maxW, tone, { measure = false } = {}) {
  const o = { family: SANS, weight: 700, small: 0.46, sym: 0.46, spacing: -0.03 };
  const meas = typePrice(ctx, price, 0, 0, maxW, capH, { ...o, measureOnly: true });
  if (measure) return meas;
  typePrice(ctx, price, x, baseY - meas.height, maxW, capH, { ...o, fill: tone.fg, align: 'right' });
  if (was) {
    const wpx = Math.max(capH * 0.3, 16), wy = baseY - meas.height - wpx * 0.6;
    const w = display(ctx, was.replace(/\.00$/, ''), x, wy, wpx, tone.mu, 'right', 500);
    ctx.save(); ctx.strokeStyle = tone.mu; ctx.lineWidth = Math.max(1, wpx * 0.07);
    ctx.beginPath(); ctx.moveTo(x - w - wpx * 0.1, wy - wpx * 0.32); ctx.lineTo(x + wpx * 0.1, wy - wpx * 0.32); ctx.stroke(); ctx.restore();
  }
  return meas;
}
/** Wrap a description into ≤ maxLines, cutting at a sentence end or a comma rather than mid-phrase with "…". */
function clipDesc(ctx, txt, fontStr, maxW, maxLines) {
  const t = String(txt || '').trim();
  const fits = (s) => { const l = wrapLines(ctx, s, fontStr, maxW, maxLines + 1); return l.length <= maxLines ? l : null; };
  const whole = fits(t); if (whole) return whole;
  const cuts = [];
  for (const m of t.matchAll(/[.!?](?=\s)|[,;:–—](?=\s)/g)) cuts.push(m.index);
  for (let i = cuts.length - 1; i >= 0; i--) {
    let s2 = t.slice(0, cuts[i] + 1).trim();
    if (/[,;:–—]$/.test(s2)) s2 = s2.slice(0, -1) + '.';
    const l = fits(s2); if (l) return l;
  }
  return wrapLines(ctx, t, fontStr, maxW, maxLines);
}
function read(data, defaults) {
  const deal = data.deal || {}, r = data.restaurant || {};
  const d0 = (data.dishes || [])[0] || {};
  return {
    r, d0, dishes: data.dishes || [],
    headline: (deal.headline ?? defaults.headline ?? '').trim(),
    price: dealPrice(data),
    was: (deal.wasPrice || '').trim(),
    includes: (deal.includes || '').trim(),
    when: (deal.when || '').trim(),
    small: (deal.smallPrint || '').trim(),
    phone: (r.phone || '').trim(),
  };
}

// ───────── Hero: the dish huge, name + price underneath ─────────
function hero(tone) {
  return async function render(ctx, W, H, data) {
    const T = TONES[tone], u = unit(W, H), m = Math.round(W * 0.07);
    const D = read(data, {});
    ctx.save();
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
    const lab = 20 * u;
    // top row
    const top2 = topRow(ctx, D.r.name, D.when, m, W, m + lab, lab, u, T.mu);

    const qrS = data.qr ? Math.round(150 * u) : 0;
    const footH = Math.max(qrS + 46 * u, D.small || D.phone ? 70 * u : 0);
    const bottom = H - m - footH;
    // text block (measured bottom-up)
    const big = D.headline || D.d0.name || '';
    const sub = D.headline ? D.d0.name : '';
    const pCap = 84 * u, pMaxW = W * 0.42;
    const priceW = D.price ? heroPrice(ctx, D.price, '', 0, 0, pCap, pMaxW, T, { measure: true }).width + 36 * u : 0;
    const fit = fitText(ctx, big, W - 2 * m - priceW, 260 * u, { family: SANS, weight: 800, maxSize: 132 * u, minSize: 48 * u, lineHeight: 0.92, maxLines: 2 });
    const bodyFont = sansF(30 * u, 400);
    const body = clipDesc(ctx, D.includes || D.d0.description, bodyFont, W * 0.62, 2);
    const bodyH = body.length * 40 * u;
    const nameH = fit.lines.length * fit.size * 0.92;
    const subH = sub ? 44 * u : 0;
    let blockTop = bottom - bodyH - 24 * u - nameH - subH;

    // dish fills the space above the text
    const dTop = m + lab + top2 + 40 * u;
    let dH = Math.max(120 * u, blockTop - dTop - 30 * u);
    const im = trimmed(D.d0.image);
    if (H / W > 1.6 && im) {
      // stories: the dish can't use all that height (it's width-bound) — keep dish + type together under the top
      // safe zone instead of leaving the top third empty
      const natH = Math.min(dH, (W / im.width) * im.height * 0.96);
      const groupTop = Math.max(dTop, H * 0.12);
      const shift = Math.max(0, blockTop - (groupTop + natH + 30 * u));
      blockTop -= shift * 0.85;
      dH = Math.max(120 * u, blockTop - groupTop - 30 * u);
      floorGlow(ctx, W / 2, groupTop + dH * 0.8, Math.min(W, dH) * 0.5, T);
      dish(ctx, D.d0.image, 0, groupTop, W, dH, T, u, { fill: 0.96 });
    } else {
      floorGlow(ctx, W / 2, dTop + dH * 0.8, Math.min(W, dH) * 0.5, T);
      dish(ctx, D.d0.image, 0, dTop, W, dH, T, u, { fill: 0.96 });
    }

    let y = blockTop;
    if (sub) { label(ctx, sub, m, y + 22 * u, 22 * u, T.mu); y += subH; }
    fit.lines.forEach((ln, i) => display(ctx, ln, m - 4 * u, y + fit.size * 0.8 + i * fit.size * 0.92, fit.size, T.fg));
    const lastBase = y + fit.size * 0.8 + (fit.lines.length - 1) * fit.size * 0.92;
    if (D.price) heroPrice(ctx, D.price, D.was, W - m, lastBase, pCap, pMaxW, T);
    y += nameH + 24 * u;
    para(ctx, body, m, y + 28 * u, bodyFont, T.mu, 40 * u);

    // footer
    if (qrS) qrBlock(ctx, data.qr, W - m - qrS, H - m - qrS - 30 * u, qrS, T, 'Scan for our menu');
    let fy = H - m;
    if (D.small) { para(ctx, wrapLines(ctx, D.small, sansF(20 * u, 400), W - 2 * m - qrS - 40 * u, 2).reverse(), m, fy, sansF(20 * u, 400), T.mu, -26 * u); fy -= 64 * u; }
    if (D.phone) label(ctx, D.phone, m, fy, 22 * u, T.fg);
    ctx.restore();
  };
}

// ───────── Specimen: the dish as a catalogue plate, hairline annotations ─────────
function specimen(tone) {
  return async function render(ctx, W, H, data) {
    const T = TONES[tone], u = unit(W, H), m = Math.round(W * 0.07);
    const D = read(data, {});
    ctx.save();
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
    const lab = 20 * u;
    // the owner's headline is the title; the dish name then labels the plate's leader line (never an includes item)
    const head = D.headline && D.headline !== 'No. 01' ? D.headline : '';
    const top2 = topRow(ctx, 'No. 01', D.r.name, m, W, m + lab, lab, u, T.mu);

    const s = Math.min(W * 0.74, H * 0.46);
    const d = { x: (W - s) / 2, y: m + lab + top2 + Math.max(50 * u, H * 0.07), w: s, h: s };
    floorGlow(ctx, W / 2, d.y + d.h * 0.78, s * 0.5, T);
    dish(ctx, D.d0.image, d.x, d.y, d.w, d.h, T, u, { anchor: 'center' });

    // hairline leaders
    ctx.save(); ctx.strokeStyle = T.rule; ctx.lineWidth = Math.max(1, 1.4 * u);
    const ay = d.y + d.h * 0.36, by = d.y + d.h * 0.72;
    // dish-name label: stacks onto up to 3 short lines above the leader rather than being cut
    const lw0 = Math.max(W * 0.2, d.x + d.w * 0.2 - m - 10 * u), leftLines = [];
    if (head && D.d0.name) for (const w of String(D.d0.name).split(/\s+/)) {
      const cur = leftLines.length ? leftLines[leftLines.length - 1] + ' ' + w : null;
      if (cur && labelW(ctx, cur, 17 * u) <= lw0) leftLines[leftLines.length - 1] = cur; else leftLines.push(w);
    }
    const leftTxt = leftLines.length ? leftLines[leftLines.length - 1] : '';
    leftLines.slice(0, -1).forEach((l, i, a) => label(ctx, l, m, ay - (a.length - i) * 26 * u, 17 * u, T.mu));
    const pLab = (D.price || '').replace(/\.00$/, ''), wLab = (D.was || '').replace(/\.00$/, '');
    if (leftTxt) { ctx.beginPath(); ctx.moveTo(m, ay + 16 * u); ctx.lineTo(d.x + d.w * 0.2, ay + 16 * u); ctx.stroke(); }
    if (pLab) { ctx.beginPath(); ctx.moveTo(W - m, by + 16 * u); ctx.lineTo(d.x + d.w * 0.8, by + 16 * u); ctx.stroke(); }
    ctx.restore();
    if (leftTxt) label(ctx, leftTxt, m, ay, 17 * u, T.mu);
    if (pLab) {
      label(ctx, pLab, W - m, by, 22 * u, T.fg, 'right');
      if (wLab) { const w = labelW(ctx, wLab, 15 * u); label(ctx, wLab, W - m, by - 30 * u, 15 * u, T.mu, 'right');
        ctx.save(); ctx.strokeStyle = T.mu; ctx.lineWidth = Math.max(1, u * 1.2); ctx.beginPath(); ctx.moveTo(W - m - w, by - 35 * u); ctx.lineTo(W - m, by - 35 * u); ctx.stroke(); ctx.restore(); }
    }
    if (D.when) label(ctx, D.when, m, d.y + d.h + 16 * u, 15 * u, T.mu);

    // name + description, centred; clear the QR in the bottom-left on short formats
    const qrS = data.qr ? Math.round(120 * u) : 0, qrTop = H - m - qrS - 26 * u;
    const ty = d.y + d.h + 90 * u;
    const name = head || D.d0.name || '';
    const blk = (colW) => {
      const f = fitText(ctx, name, colW, 200 * u, { family: SANS, weight: 800, maxSize: 96 * u, minSize: 40 * u, lineHeight: 0.94, maxLines: 2 });
      const desc = clipDesc(ctx, D.includes || D.d0.description, sansF(28 * u, 400), Math.min(W * 0.7, colW), 2);
      return { f, desc, bottom: ty + f.lines.length * f.size * 0.94 + 20 * u + desc.length * 38 * u };
    };
    let b = blk(W - 2 * m);
    if (qrS && b.bottom > qrTop - 12 * u) b = blk(W - 2 * (m + qrS + 28 * u));
    b.f.lines.forEach((ln, i) => display(ctx, ln, W / 2, ty + b.f.size * 0.8 + i * b.f.size * 0.94, b.f.size, T.fg, 'center'));
    para(ctx, b.desc, W / 2, ty + b.f.lines.length * b.f.size * 0.94 + 40 * u, sansF(28 * u, 400), T.mu, 38 * u, 'center');

    if (qrS) qrBlock(ctx, data.qr, m, qrTop, qrS, T, 'Our menu');
    let fy = H - m;
    const fx = W - m;
    if (D.small) { ctx.save(); para(ctx, wrapLines(ctx, D.small, sansF(19 * u, 400), W * 0.5, 2).reverse(), fx, fy, sansF(19 * u, 400), T.mu, -25 * u, 'right'); ctx.restore(); fy -= 62 * u; }
    if (D.phone) label(ctx, D.phone, fx, fy, 20 * u, T.fg, 'right');
    ctx.restore();
  };
}

// ───────── Menu card: several dishes, each from its scan ─────────
function card(tone) {
  return async function render(ctx, W, H, data) {
    const T = TONES[tone], u = unit(W, H), m = Math.round(W * 0.07);
    const D = read(data, {});
    ctx.save();
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
    const lab = 20 * u;
    const top2 = topRow(ctx, D.headline || 'Menu', D.when, m, W, m + lab, lab, u, T.mu);
    const npx = fitLine(ctx, D.r.name || '', W - 2 * m, 110 * u, 44 * u);
    display(ctx, D.r.name || '', m - 4 * u, m + lab + top2 + 40 * u + npx * 0.8, npx, T.fg);

    const qrS = data.qr ? Math.round(140 * u) : 0;
    const dealLine = data.deal && data.deal.price ? data.deal.price : '';
    const stackH = (D.small ? 60 * u : 0) + (D.phone ? 50 * u : 0) + (dealLine ? 72 * u + (D.was ? 30 * u : 0) + (D.includes ? 34 * u : 0) : 0);
    const footH = Math.max(qrS + 50 * u, stackH + 20 * u) + 30 * u;
    const top = m + lab + top2 + 40 * u + npx + 50 * u, bottom = H - m - footH;
    const list = D.dishes.slice(0, 5);
    const rowH = (bottom - top) / Math.max(1, list.length);
    list.forEach((x, i) => {
      const y = top + i * rowH, ts = Math.min(rowH * 0.9, 300 * u, W * 0.3);
      if (x.image) dish(ctx, x.image, m - 10 * u, y + (rowH - ts) / 2, ts, ts, T, u * 0.6, { anchor: 'center', fill: 0.95 });
      const tx = m + ts + 26 * u, my = y + rowH / 2;
      const xp = (x.priceLabel || '').replace(/\.00$/, '');      // '£12' not '£12.00'
      const room = W - tx - m - (xp ? labelW(ctx, xp, 22 * u) + 28 * u : 0);
      const px0 = Math.min(48 * u, rowH * 0.3), pxMin = 30 * u;
      let px = fitLine(ctx, x.name || '', room, px0, pxMin, 750), nameLines = [x.name || ''];
      if (displayW(ctx, x.name || '', px, 750) > room) {
        // long names wrap to 2 lines (shrinking a little) before anything is cut
        for (px = px0; ; px *= 0.94) { nameLines = wrapLines(ctx, x.name || '', sansF(px, 750), room, 2); if (!nameLines[1] || !nameLines[1].endsWith('…') || px <= 24 * u) break; }
      }
      const nlh = px * 0.98, nTop = my - 2 * u - (nameLines.length - 1) * nlh;
      nameLines.forEach((l, k) => display(ctx, l, tx, nTop + k * nlh, px, T.fg, 'left', 750));
      if (rowH > 150 * u) {
        // descriptions end at a sentence or comma — or are left out — never cut mid-word
        let desc = clipDesc(ctx, x.description, sansF(24 * u, 400), W - tx - m - 60 * u, rowH > 260 * u && nameLines.length === 1 ? 2 : 1);
        if (desc.length && desc[desc.length - 1].endsWith('…')) desc = [];
        if (my + 38 * u + (desc.length - 1) * 32 * u < y + rowH - 8 * u) para(ctx, desc, tx, my + 38 * u, sansF(24 * u, 400), T.mu, 32 * u);
      }
      if (xp) label(ctx, xp, W - m, nTop - 4 * u, 22 * u, T.fg, 'right');
    });

    // footer: QR left, deal price / phone right
    if (qrS) qrBlock(ctx, data.qr, m, H - m - qrS - 24 * u, qrS, T, 'Scan for our menu');
    const fx = W - m;
    let fy = H - m;
    if (D.small) { para(ctx, wrapLines(ctx, D.small, sansF(19 * u, 400), W * 0.5, 2).reverse(), fx, fy, sansF(19 * u, 400), T.mu, -25 * u, 'right'); fy -= 60 * u; }
    if (D.phone) { label(ctx, D.phone, fx, fy, 20 * u, T.fg, 'right'); fy -= 50 * u; }
    if (dealLine) {
      priceStack(ctx, dealLine.replace(/\.00$/, ''), D.was.replace(/\.00$/, ''), fx, fy, 72 * u, T);
      if (D.includes) label(ctx, D.includes, fx, fy - 72 * u - (D.was ? 30 * u : 0), 16 * u, T.mu, 'right');
    }
    ctx.restore();
  };
}

const base = { style: 'Minimal', fonts: FONTS };
const PORTRAIT = ['a4', 'a3', 'ig-post', 'ig-story', 'square', 'table-card'];

export default [
  { ...base, id: 'minimal-hero', name: 'Hero', description: 'One dish, huge, on black — name and price underneath',
    formats: PORTRAIT, dishes: { min: 1, max: 1 }, defaults: { headline: '' }, render: hero('noir') },
  { ...base, id: 'minimal-hero-cream', name: 'Hero Cream', description: 'The hero layout on warm off-white paper',
    formats: PORTRAIT, dishes: { min: 1, max: 1 }, defaults: { headline: '' }, render: hero('cream') },
  { ...base, id: 'minimal-specimen', name: 'Specimen', description: 'Your dish as a catalogue plate, with fine labels',
    formats: PORTRAIT, dishes: { min: 1, max: 1 }, defaults: { headline: '' }, render: specimen('cream') },
  { ...base, id: 'minimal-card', name: 'Menu Card', description: 'Up to five dishes listed with their prices',
    formats: ['a4', 'a3', 'ig-story', 'table-card', 'ig-post'], dishes: { min: 3, max: 5 }, defaults: { headline: 'Menu' }, render: card('noir') },
];
