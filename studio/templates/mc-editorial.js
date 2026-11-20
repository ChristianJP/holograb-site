// Editorial — calm café poster: huge sentence-case serif on warm white, the dish sitting on a flat mocha split,
// the price set in the serif on the mocha. Signature device: the straight colour-block split the plate sits across.
import { unit, grain } from './lib.js';
import { F, tx, tw, info, sentence, stop, listSentence, fitBlock, fitSize, clip, aspect, dish, drawPrice, fitPrice, priceW, drawWas, microRow, sticker, qrBlock, ensureExtra } from './mc-kit.js';

const C = { white: '#F0EDE5', mocha: '#8B6A55', esp: '#3B2A22', pist: '#BFD8A6' };
const SERIF = 'Instrument Serif', SANS = 'Inter Tight';
const DAY = /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*$|^(today|weekends?|daily|new)$/i;

/** Serif headline, last word italic. fit from fitBlock (upright metrics; the italic is narrower so it always fits). */
function drawHead(ctx, fit, x, y, fill) {
  const up = F(fit.size, SERIF, 400), it = F(fit.size, SERIF, 400, 'italic');
  const sp = tw(ctx, ' ', up);
  let b = y + fit.size * 0.7;
  const many = fit.lines.join(' ').split(/\s+/).length > 1;
  fit.lines.forEach((line, i) => {
    const by = b + i * fit.size * fit.lh;
    if (i === fit.lines.length - 1 && many) {
      const words = line.split(' '), last = words.pop(), head = words.join(' ');
      let cx = x;
      if (head) cx += tx(ctx, head, cx, by, up, fill, { em: -0.01, size: fit.size }) + sp;
      tx(ctx, last, cx, by, it, fill, { em: -0.01, size: fit.size });
    } else tx(ctx, line, x, by, up, fill, { em: -0.01, size: fit.size });
  });
  return b + (fit.lines.length - 1) * fit.size * fit.lh;
}

export default {
  id: 'editorial',
  name: 'Editorial',
  style: 'Café',
  description: 'Calm café poster — a huge sentence-case serif on warm white, the dish sitting on a mocha colour block, the price in serif',
  formats: ['a4', 'a3', 'ig-post', 'ig-story', 'square', 'screen', 'table-card'],
  dishes: { min: 1, max: 1 },
  fonts: [SERIF, SANS],
  defaults: { headline: 'Lunch, sorted.' },
  headlines: ['Lunch, sorted.', 'Good bread, every morning.', 'Fresh out at 7.', 'Iced, finally.'],
  async render(ctx, W, H, data) {
    await ensureExtra('Instrument+Serif:ital@0;1', ['italic 400 64px "Instrument Serif"', '400 64px "Instrument Serif"']);
    const u = unit(W, H), I = info(data), r = H / W, S = Math.min(W, H);
    const wide = r < 0.8, square = !wide && r < 1.2, story = r > 1.6;
    const m = S * 0.07;
    const head = stop(sentence(I.headline || I.dishName || I.name));
    const img = I.dishes[0] && I.dishes[0].image, a = img ? aspect(img) : 1.5;
    const ms = S / 44;                                   // micro size
    const micro = (s) => F(s, SANS, 700);
    const sel = DAY.test(I.when) ? I.when : (I.hasDeal ? 'New' : 'Today');
    const stickerTxt = sel.length > 8 ? 'New' : sel;
    const incl = I.includes ? listSentence(I.includes) : '';
    const priceO = { family: SERIF, weight: 400, sym: 0.5, pence: 0.42, gap: 0.02 };

    ctx.fillStyle = C.white; ctx.fillRect(0, 0, W, H);

    if (!wide) {
      // ── tall + square: horizontal split ──
      const sy = Math.round(H * (story ? 0.6 : square ? 0.6 : r < 1.3 ? 0.59 : 0.58));
      ctx.fillStyle = C.mocha; ctx.fillRect(0, sy, W, H - sy);
      grain(ctx, 0, 0, W, H, 0.02, 21);
      // micro row + hairline
      const top = story ? H * 0.085 : m;
      const ry = top + ms;
      const used = microRow(ctx, I.name, I.when, m, W - m, ry, ms, SANS, C.esp, { weight: 700, em: 0.18 });
      const ruleY = ry + used - ms + ms * 0.9;
      ctx.fillStyle = C.esp; ctx.globalAlpha = 0.7; ctx.fillRect(m, ruleY, W - 2 * m, Math.max(1, 1.4 * u)); ctx.globalAlpha = 1;
      const hTop = ruleY + ms * 2.6;
      // dish: honest scale (55–60% W), right of centre, base well into the mocha. Headline: one line across the width when
      // it can be set big enough, else up to 3 lines; the dish gives way first (down to half width), then the headline.
      const dropIn = (H - sy) * (square ? 0.16 : 0.2);
      let dw = W * (story ? 0.76 : square ? 0.56 : 0.6), dTop;
      const maxS = W * (square ? 0.16 : story ? 0.25 : r < 1.3 ? 0.2 : 0.235);
      const hOpt = (maxSize, maxLines) => ({ family: SERIF, weight: 400, maxSize, minSize: W * 0.06, lh: 0.9, em: -0.01, maxLines });
      const one = fitBlock(ctx, head, W - 2 * m, maxS, hOpt(maxS, 1));
      let hf = one.lines.length === 1 && one.size >= W * (square ? 0.1 : 0.13) ? one : fitBlock(ctx, head, W - 2 * m, H * 0.3, hOpt(maxS, 3));
      const hBot = (f) => hTop + (f.lines.length - 1) * f.size * 0.9 + f.size * 0.78 + ms * 2.2;
      for (let k = 0; k < 30; k++) {
        dTop = sy + dropIn - dw / a;
        if (dTop >= hBot(hf)) break;
        if (dw > W * 0.5) dw *= 0.96;
        else if (hf.size > W * 0.065) hf = fitBlock(ctx, head, W - 2 * m, H * 0.3, hOpt(hf.size * 0.93, 3));
        else break;
      }
      // a one-line headline leaves air: let the dish take it (up to ~70% W, wider on stories)
      const gapH = sy + dropIn - dw / a - hBot(hf) - H * 0.035;
      if (gapH > 0) dw = Math.max(dw, Math.min(W * (story ? 0.86 : square ? 0.62 : 0.7), dw + gapH * a));
      dTop = sy + dropIn - dw / a;
      drawHead(ctx, hf, m, hTop, C.esp);
      const dx = Math.min(W - m * 0.6 - dw, W * 0.58 - dw / 2);
      const dr = img ? dish(ctx, img, dx, dTop, dw, dw / a, { anchor: 'bottom', contact: 'rgba(59,42,34,0.32)', spread: 0.86, flat: 0.07, lift: 0.95 }) : null;
      // pistachio sticker at the dish's top-right
      if (dr) {
        const R = W * (square ? 0.07 : 0.08);
        const cx = Math.min(W - m - R * 0.6, dr.x + dr.w * 0.9), cy = Math.max(hTop + hf.lines.length * hf.size * 0.9 + R * 0.4, dr.y + dr.h * 0.12);
        sticker(ctx, cx, cy, R, C.pist, -8 * Math.PI / 180, (g) => {
          const s = fitSize(g, stickerTxt, R * 1.5, R * 0.42, R * 0.2, (q) => F(q, SANS, 700), 0);
          tx(g, stickerTxt, 0, s * 0.36, F(s, SANS, 700), C.esp, { align: 'center', size: s });
        });
      }
      // mocha block: price, was, includes; QR / phone bottom-right
      const qrS = I.qr && !square && r < 1.6 ? W * 0.13 : 0;
      const base = H - (story ? H * 0.11 : m);
      let y = base;
      const rightW = qrS ? qrS + m * 0.6 : 0;
      const colW = W - 2 * m - rightW;
      if (incl) {
        const s = Math.max(ms * 1.25, S / 30);
        const f = fitBlock(ctx, incl, colW, s * 2.6, { family: SANS, weight: 400, maxSize: s, minSize: s * 0.7, lh: 1.25, maxLines: 2 });
        const fs = F(f.size, SANS, 400);
        f.lines.slice(0, 2).forEach((l, i, arr) => tx(ctx, l, m, y - (arr.length - 1 - i) * f.size * 1.25, fs, C.white, { size: f.size }));
        y -= (Math.min(2, f.lines.length) - 1) * f.size * 1.25 + f.size * 1.9;
      } else if (I.phone && !qrS) { tx(ctx, I.phone.toUpperCase(), m, y, micro(ms), C.white, { em: 0.18, size: ms }); y -= ms * 3; }
      if (I.price) {
        const room = (y - (dr ? Math.max(sy, dr.y + dr.h) : sy)) - ms * 2;
        const wasS = I.was ? W * 0.034 : 0;
        const wasW = I.was ? tw(ctx, I.was, F(wasS, SANS, 400)) + W * 0.03 : 0;
        const ps = fitPrice(ctx, I.price, colW - wasW, W * (square ? 0.17 : story ? 0.34 : 0.28), priceO, room / 0.72);
        const pr = drawPrice(ctx, I.price, m, y, ps, { ...priceO, fill: C.white });
        if (I.was) drawWas(ctx, I.was, m + pr.w + W * 0.03, y - pr.asc + wasS * 0.95, wasS, { family: SANS, weight: 400, fill: C.white, alpha: 0.72, lw: 0.05 });
      }
      if (qrS) qrBlock(ctx, I.qr, W - m - qrS, base - qrS - ms * 1.9, qrS, { caption: 'Menu', family: SANS, fill: C.white, pad: C.white, capSize: ms * 0.85 });
      else if (I.phone && incl) tx(ctx, I.phone.toUpperCase(), W - m, base, micro(ms * 0.9), C.white, { align: 'right', em: 0.18, size: ms * 0.9 });
      return;
    }

    // ── screen: vertical split, headline on the warm white, dish crossing the split ──
    const sx = Math.round(W * 0.56);
    ctx.fillStyle = C.mocha; ctx.fillRect(sx, 0, W - sx, H);
    grain(ctx, 0, 0, W, H, 0.02, 21);
    const ry = m + ms;
    microRow(ctx, I.name, '', m, sx - m, ry, ms, SANS, C.esp, { weight: 700, em: 0.18 });
    if (I.when) { const s = fitSize(ctx, I.when.toUpperCase(), W - sx - 2 * m, ms, ms * 0.7, micro, 0.18); tx(ctx, I.when.toUpperCase(), W - m, ry, micro(s), C.white, { align: 'right', em: 0.18, size: s }); }
    const ruleY = ry + ms * 0.9;
    ctx.globalAlpha = 0.7; ctx.fillStyle = C.esp; ctx.fillRect(m, ruleY, sx - 2 * m, Math.max(1, 1.4 * u));
    ctx.fillStyle = C.white; ctx.fillRect(sx + m, ruleY, W - sx - 2 * m, Math.max(1, 1.4 * u)); ctx.globalAlpha = 1;
    // dish crossing the split
    let dh = H * 0.5, dw = dh * a;
    if (dw > W * 0.44) { dw = W * 0.44; dh = dw / a; }
    const dcx = sx + W * 0.03, dcy = H * 0.52;
    const dr = img ? dish(ctx, img, dcx - dw / 2, dcy - dh / 2, dw, dh, { anchor: 'center', contact: 'rgba(59,42,34,0.3)', spread: 0.86, flat: 0.07 }) : null;
    // headline: left column, clear of the dish
    const hTop = ruleY + ms * 3;
    const hw = (dr ? dr.x : sx) - m - ms * 2;
    const incl2 = incl ? 1 : 0;
    const hf = fitBlock(ctx, head, hw, H - hTop - m - (incl2 ? ms * 5 : 0), { family: SERIF, weight: 400, maxSize: H * 0.22, minSize: H * 0.07, lh: 0.9, em: -0.01, maxLines: 3 });
    drawHead(ctx, hf, m, hTop, C.esp);
    if (incl) {
      const f = F(ms * 1.35, SANS, 400);
      tx(ctx, clip(ctx, incl, sx - 2 * m, f), m, H - m, f, C.esp, { size: ms * 1.35 });
    } else if (I.phone) tx(ctx, I.phone.toUpperCase(), m, H - m, micro(ms), C.esp, { em: 0.18, size: ms });
    if (dr) {
      const R = H * 0.085;
      sticker(ctx, Math.min(W - m - R, dr.x + dr.w * 0.9), Math.max(ruleY + R * 1.4, dr.y + dr.h * 0.1), R, C.pist, -8 * Math.PI / 180, (g) => {
        const s = fitSize(g, stickerTxt, R * 1.5, R * 0.42, R * 0.2, (q) => F(q, SANS, 700), 0);
        tx(g, stickerTxt, 0, s * 0.36, F(s, SANS, 700), C.esp, { align: 'center', size: s });
      });
    }
    if (I.price) {
      const colW = W - sx - 2 * m;
      const wasS = I.was ? H * 0.036 : 0;
      const ps = fitPrice(ctx, I.price, colW, H * 0.28, priceO, H - (dr ? dr.y + dr.h : H * 0.7) - m - ms * 2);
      const pr = drawPrice(ctx, I.price, W - m, H - m, ps, { ...priceO, fill: C.white, align: 'right' });
      if (I.was) drawWas(ctx, I.was, W - m - pr.w - H * 0.03, H - m - pr.asc + wasS * 0.95, wasS, { family: SANS, weight: 400, fill: C.white, alpha: 0.72, align: 'right', lw: 0.05 });
    }
  },
};
