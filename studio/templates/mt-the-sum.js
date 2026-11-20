// The Sum — a combo deal written as an equation: numbered dish specimens joined by "+", then a giant "= £4.99" in hot
// orange. Warm white field, ink type, mono labels. Burger, kebab and chicken combos.
import { trimBox } from './takeaway-kit.js';
import { shortName } from './mt-kit.js';
import { frame, readAll, ensureExtra, font, track, trackW, fitPx, clip, micro, price, wasLine, cutRect, putDish, circle, rotated, pick, priceParts, grain } from './mt-kit.js';

const SANS = 'Bricolage Grotesque', MONO = 'DM Mono';
const C = { field: '#F1EEE6', ink: '#111111', orange: '#FF5A1F', cream: '#F1EEE6', hair: 'rgba(17,17,17,0.18)', contact: 'rgba(40,25,10,0.26)' };
// the kicker has to be true of what's pictured: one dish is "the usual", two is company, three is everything
const BANKS = { 1: ['the usual.', 'lunch, sorted.'], 2: ["two's company.", 'lunch, sorted.'], 3: ['one of everything.', 'lunch, sorted.', 'the full set.'] };
const BANK = [...new Set(Object.values(BANKS).flat())];
const sans = (px, w = 700) => font(px, SANS, w);
const mono = (px, w = 400) => font(px, MONO, w);

/** Lowercase kicker wrapped into ≤ 2 lines at px. */
function wrap(ctx, txt, px, maxW) {
  const words = txt.split(/\s+/).filter(Boolean), out = []; let cur = '';
  ctx.save(); ctx.font = sans(px);
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (cur && ctx.measureText(t).width > maxW) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur);
  ctx.restore();
  return out;
}
function fitKicker(ctx, txt, px0, maxW, maxLines = 2) {
  let px = px0;
  for (; px > px0 * 0.5; px *= 0.94) {
    const lines = wrap(ctx, txt, px, maxW);
    if (lines.length <= maxLines && lines.every((l) => trackW(ctx, l, sans(px), -0.02, px) <= maxW)) return { lines, px };
  }
  return { lines: wrap(ctx, txt, px, maxW).slice(0, maxLines), px };
}

/** Round ink sticker with `when` in two mono lines. */
function sticker(ctx, when, cx, cy, R) {
  const t = when.toUpperCase();
  const parts = t.split(/\s*[·•|]\s*/).filter(Boolean);
  let lines;
  if (parts.length >= 2) lines = [parts[0], parts.slice(1).join(' · ')];
  else { const w = t.split(' '); const k = Math.ceil(w.length / 2); lines = w.length > 1 ? [w.slice(0, k).join(' '), w.slice(k).join(' ')] : [t]; }
  rotated(ctx, cx, cy, 8 * Math.PI / 180, () => {
    circle(ctx, 0, 0, R, C.ink);
    const maxW = R * 1.5;
    let px = R * 0.24;
    for (const l of lines) px = Math.min(px, fitPx(ctx, l, MONO, 500, R * 0.24, maxW, { em: 0.12, min: R * 0.1 }));
    const lh = px * 1.3, y0 = -((lines.length - 1) * lh) / 2 + px * 0.36;
    lines.forEach((l, i) => track(ctx, clip(ctx, l, mono(px, 500), 0.12, px, maxW), 0, y0 + i * lh, mono(px, 500), C.cream, { align: 'center', em: 0.12, px }));
  });
}

/** One specimen: "01 — BURGER" label above, dish contained below. */
function specimen(ctx, dish, i, x, y, w, h, lpx, { label = true } = {}) {
  if (!label) { const r = dish.image ? cutRect(dish.image, x, y, w, h, { anchor: 'center' }) : null; if (r) putDish(ctx, dish.image, r, { shadow: C.contact }); return; }
  const lab = `${String(i + 1).padStart(2, '0')} — ${String(dish.name || '').toUpperCase()}`;
  const lp = fitPx(ctx, lab, MONO, 400, lpx, w, { em: 0.12, min: lpx * 0.75 });
  // label sits just above the food, like a catalogue plate
  const r = dish.image ? cutRect(dish.image, x, y + lpx * 2.2, w, h - lpx * 2.2, { anchor: 'center' }) : null;
  const ly = r ? r.y - lp * 1.1 : y + lp;
  track(ctx, clip(ctx, lab, mono(lp), 0.12, lp, w), x, ly, mono(lp), C.ink, { em: 0.12, px: lp });
  if (r) putDish(ctx, dish.image, r, { shadow: C.contact });
}

/** "+" glyph centred on (cx, cy). */
function plus(ctx, cx, cy, px) {
  ctx.save(); ctx.font = sans(px, 700); ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText('+'); ctx.fillText('+', cx, cy + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
  ctx.restore();
}

/** "= £4⁹⁹": = in ink, price in orange, fitted into maxW × capH. x left, y cap-top. Returns { width, height, size }. */
function equals(ctx, lbl, x, y, maxW, capH, { measureOnly = false, pre = '' } = {}) {
  const preW = (S) => { if (!pre) return 0; ctx.font = sans(S, 700); return ctx.measureText(pre).width + S * 0.18; };
  const eqW = (S) => { ctx.font = sans(S, 800); return preW(S) + ctx.measureText('=').width + S * 0.12; };
  const opts = { family: SANS, weight: 800, small: 0.46, sym: 0.5, spacing: -0.02 };
  const at = (S) => eqW(S) + price(ctx, lbl, 0, 0, 1e9, S * 0.72, { ...opts, measureOnly: true }).width;
  // price() sizes by cap height: cap ≈ 0.72 S for Bricolage
  let S = capH / 0.72;
  const w100 = at(100); S = Math.min(S, (maxW / w100) * 100);
  const m = price(ctx, lbl, 0, 0, 1e9, S * 0.72, { ...opts, measureOnly: true });
  const width = eqW(S) + m.width;
  if (!measureOnly) {
    if (pre) { ctx.save(); ctx.font = sans(S, 700); ctx.fillStyle = C.ink; ctx.textBaseline = 'alphabetic'; ctx.fillText(pre, x, y + m.height); ctx.restore(); }
    ctx.save(); ctx.font = sans(S, 800); ctx.fillStyle = C.ink; ctx.textBaseline = 'middle';
    // centre "=" on the figures' x-height middle
    ctx.fillText('=', x + preW(S), y + m.height * 0.52);
    ctx.restore();
    price(ctx, lbl, x + eqW(S), y, 1e9, S * 0.72, { ...opts, fill: C.orange });
  }
  return { width, height: m.height, size: S, priceX: x + eqW(S), priceW: m.width };
}

export default {
  id: 'the-sum',
  name: 'The Sum',
  style: 'Takeaway',
  description: 'Combo deal as an equation — numbered dishes joined by +, then a giant "= £4.99" in hot orange',
  formats: ['a4', 'a3', 'ig-post', 'ig-story', 'square', 'screen'],
  dishes: { min: 1, max: 3 },
  fonts: [],
  defaults: { headline: '' },
  headlines: BANK,
  async render(ctx, W, H, data) {
    await Promise.all([
      ensureExtra('Bricolage+Grotesque:opsz,wght@12..96,200..800', SANS, ['700', '800']),
      ensureExtra('DM+Mono:wght@400;500', MONO, ['400', '500']),
    ]);
    const f = frame(W, H), { u, m, mt, mb, L, story, sq } = f;
    const d = readAll(data);
    const dishes = d.dishes.slice(0, 3);
    const n = Math.max(1, dishes.length);
    const head = (d.headline ? d.headline.toLowerCase() : pick(BANKS[Math.min(3, n)], d.name + d.dishName));
    // one dish: the equation is "smash burger = £4.99" (no orphan "=" with nothing on its left)
    const one = n === 1 && dishes.length === 1;
    const pre = one ? shortName(d.dishName).toLowerCase() : '';
    const cw = W - 2 * m;

    ctx.fillStyle = C.field; ctx.fillRect(0, 0, W, H);

    // top: lowercase kicker (left), when sticker (right)
    const R = d.when ? (L ? H * 0.12 : W * (story ? 0.11 : 0.09)) : 0;
    if (d.when) sticker(ctx, d.when, W - m - R, mt + R * 0.95, R);
    const kMaxW = (L ? W * 0.62 : cw) - (R && !L ? R * 2.3 : 0);
    const k = fitKicker(ctx, head, L ? H * 0.12 : W * (story ? 0.11 : 0.1), kMaxW, 2);
    k.lines.forEach((l, i) => track(ctx, l, m - k.px * 0.04, mt + k.px * 0.78 + i * k.px * 0.98, sans(k.px), C.ink, { em: -0.02, px: k.px }));
    let top = Math.max(mt + k.px * 0.78 + (k.lines.length - 1) * k.px * 0.98 + k.px * 0.45, R ? mt + R * 2.05 : 0);

    // bottom: micro strip
    const mpx = Math.max(W * (L ? 0.0095 : 0.016), 17 * u);
    const stripY = H - mb;
    const nameLine = d.address && !story ? `${d.name}  ·  ${d.address}` : d.name;
    micro(ctx, nameLine, d.phone, m, W - m, stripY, mpx, { family: MONO, fill: C.ink, em: 0.16 });
    const lpx = Math.max(W * (L ? 0.0095 : 1 / 55), 16 * u);
    const incl = d.list.length ? d.list.join(' + ').toUpperCase() : '';
    const isText = priceParts(d.price).text != null;

    if (!L) {
      // price block from the bottom up
      let yb = stripY - mpx * 3.2;
      if (incl) { const ip = fitPx(ctx, incl, MONO, 400, lpx * 1.1, cw, { em: 0.12, min: lpx * 0.8 }); track(ctx, clip(ctx, incl, mono(ip), 0.12, ip, cw), m, yb, mono(ip), C.ink, { em: 0.12, px: ip }); yb -= ip * 2.6; }
      const capH = H * (story ? 0.13 : sq ? 0.13 : 0.17);
      const wasPx = d.was ? Math.max(capH * 0.16, 18 * u) : 0;
      // the equation fills ~80% of the measure (all of it in the one-dish "name = price" form)
      let eqPre = pre;
      let eqm = d.price ? equals(ctx, d.price, m, 0, cw * (isText || pre ? 1 : 0.8), capH, { measureOnly: true, pre: eqPre }) : null;
      let preLine = null;
      if (eqm && pre && eqm.height < capH * 0.62) {
        // name too long to share the line: it sits on its own line above "= £4.99"
        eqPre = ''; eqm = equals(ctx, d.price, m, 0, cw * (isText ? 1 : 0.8), capH, { measureOnly: true });
        const pp = fitPx(ctx, pre, SANS, 700, eqm.size * 0.5, cw, { min: eqm.size * 0.22 });
        preLine = { px: pp, txt: clip(ctx, pre, sans(pp), 0, pp, cw) };
      }
      let wasBelow = false;
      if (d.was && eqm) {
        const ww = trackW(ctx, 'was ' + d.was, mono(wasPx), 0.04, wasPx);
        wasBelow = eqm.width + wasPx * 1.5 + ww > cw;
        if (wasBelow) { wasLine(ctx, d.was, eqm.priceX - m + m, yb, wasPx, { family: MONO, fill: C.ink, strike: C.ink, lineW: Math.max(2, 2 * u) }); yb -= wasPx * 1.9; }
      }
      if (eqm) {
        const py = yb - eqm.height;
        equals(ctx, d.price, m, py, cw * (isText || eqPre ? 1 : 0.8), capH, { pre: eqPre });
        if (d.was && !wasBelow) wasLine(ctx, d.was, m + eqm.width + wasPx * 1.5, py + wasPx * 1.1, wasPx, { family: MONO, fill: C.ink, strike: C.ink, lineW: Math.max(2, 2 * u) });
        yb = py - capH * 0.32;
        if (preLine) { track(ctx, preLine.txt, m, yb, sans(preLine.px), C.ink, { em: -0.02, px: preLine.px }); yb -= preLine.px * 1.25; }
      }
      // hairline
      ctx.fillStyle = C.hair; ctx.fillRect(m, yb, cw, Math.max(1, 1.5 * u));
      const bot = yb - capH * 0.18;
      top += H * 0.015;
      const ppx = Math.min(W * 0.09, 90 * u * (story ? 1 : 1));
      // stack the specimens when that shows the food bigger (always on stories; wide dishes on A4/A3)
      const plusW0 = ppx * 1.2, plusH0 = ppx * 1.1, lab = lpx * 2.2;
      const sc = (bw, bh) => Math.min(...dishes.filter((x) => x.image).map((x) => { const b = trimBox(x.image); return Math.min(bw / b.w, (bh - lab) / b.h); }), 1e9);
      const across = sc((cw - (n - 1) * plusW0) / n, bot - top), stacked = sc(cw * 0.8, (bot - top - (n - 1) * plusH0) / n);
      // 2 + 1 grid for three dishes on tall formats: each dish gets ≥ ~40% of the width instead of a row of thumbnails
      const gridRowH = (bot - top - plusH0) / 2, gridCellW = (cw - plusW0) / 2;
      const grid = n === 3 ? sc(gridCellW, gridRowH) : 0;
      if (n === 3 && !sq && grid > Math.max(across, stacked) * 1.05) {
        const x2 = m + gridCellW + plusW0;
        specimen(ctx, dishes[0], 0, m, top, gridCellW, gridRowH, lpx);
        plus(ctx, m + gridCellW + plusW0 / 2, top + lpx * 2.2 + (gridRowH - lpx * 2.2) / 2, ppx);
        specimen(ctx, dishes[1], 1, x2, top, gridCellW, gridRowH, lpx);
        plus(ctx, W / 2, top + gridRowH + plusH0 / 2, ppx);
        specimen(ctx, dishes[2], 2, m + (cw - gridCellW) / 2, top + gridRowH + plusH0, gridCellW, gridRowH, lpx);
      } else if (n > 1 && (story || (!sq && stacked > across * 1.15))) {
        // stacked: dish / + / dish / + / dish
        const plusH = plusH0, cellH = (bot - top - (n - 1) * plusH) / n;
        dishes.forEach((ds, i) => {
          const y = top + i * (cellH + plusH);
          specimen(ctx, ds, i, m + (story ? 0 : cw * 0.1), y, story ? cw : cw * 0.8, cellH, lpx);
          if (i < n - 1) plus(ctx, W / 2, y + cellH + plusH / 2, ppx);
        });
      } else {
        const plusW = n > 1 ? ppx * 1.2 : 0;
        const cellW = n > 1 ? (cw - (n - 1) * plusW) / n : cw * (sq ? 0.8 : 0.9);
        const cellH = bot - top;
        dishes.forEach((ds, i) => {
          const x = n > 1 ? m + i * (cellW + plusW) : m + (cw - cellW) / 2;
          specimen(ctx, ds, i, x, top, cellW, cellH, lpx, { label: !one });
          if (i < n - 1) plus(ctx, x + cellW + plusW / 2, top + lpx * 2.2 + (cellH - lpx * 2.2) / 2, ppx);
        });
      }
    } else {
      // landscape: specimens across the left 65%, "= price" in the right column
      const leftW = W * 0.65 - m, colX = W * 0.65 + m * 0.4, colW = W - m - colX;
      const bot = stripY - mpx * 3, ppx = H * 0.08;
      top += H * 0.02;
      const plusW = n > 1 ? ppx * 1.1 : 0, cellW = n > 1 ? (leftW - (n - 1) * plusW) / n : leftW * 0.8, cellH = bot - top;
      dishes.forEach((ds, i) => {
        const x = m + i * (cellW + plusW);
        specimen(ctx, ds, i, n > 1 ? x : m + (leftW - cellW) / 2, top, cellW, cellH, lpx, { label: !one });
        if (i < n - 1) plus(ctx, x + cellW + plusW / 2, top + lpx * 2.2 + (cellH - lpx * 2.2) / 2, ppx);
      });
      ctx.fillStyle = C.hair; ctx.fillRect(colX - m * 0.7, top, Math.max(1, 1.5 * u), bot - top);
      const capH = H * 0.2, wasPx = d.was ? H * 0.032 : 0;
      const eqm = d.price ? equals(ctx, d.price, colX, 0, colW, capH, { measureOnly: true }) : null;
      const prePx = pre && eqm ? fitPx(ctx, pre, SANS, 700, eqm.size * 0.42, colW, { min: eqm.size * 0.18 }) : 0;
      const blockH = (prePx ? prePx * 1.3 : 0) + (eqm ? eqm.height : 0) + (d.was ? wasPx * 2.2 : 0) + (incl ? lpx * 3 : 0);
      let y = top + (bot - top - blockH) / 2;
      if (prePx) { track(ctx, clip(ctx, pre, sans(prePx), 0, prePx, colW), colX, y + prePx * 0.8, sans(prePx), C.ink, { em: -0.02, px: prePx }); y += prePx * 1.3; }
      if (eqm) { equals(ctx, d.price, colX, y, colW, capH); y += eqm.height; }
      if (d.was) { y += wasPx * 2; wasLine(ctx, d.was, eqm ? eqm.priceX : colX, y, wasPx, { family: MONO, fill: C.ink, strike: C.ink, lineW: Math.max(2, 2 * u) }); }
      if (incl) { y += lpx * 2.8; const ip = fitPx(ctx, incl, MONO, 400, lpx, colW, { em: 0.12, min: lpx * 0.7 }); track(ctx, clip(ctx, incl, mono(ip), 0.12, ip, colW), colX, y, mono(ip), C.ink, { em: 0.12, px: ip }); }
    }
    grain(ctx, 0, 0, W, H, 0.02);
  },
};
