// Menu Board (2026 refresh) — in-store TV / specials board as a strict typographic list on near-black espresso:
// numbered rows, a dish cut-out per row (contact shadow only), serif names, aligned price column (dot leaders on wide
// formats), 1px rules, and one flat tomato deal block. Two families: Instrument Serif + Inter Tight.
import { unit, grain } from './lib.js';
import { F, tx, tw, info, sentence, fitBlock, drawBlock, fitSize, clip, wrap, aspect, dish, drawPrice, fitPrice, priceW, drawWas, cleanPrice, microRow } from './mc-kit.js';

const SERIF = 'Instrument Serif', SANS = 'Inter Tight';
const C = { bg: '#1A1412', cream: '#F0EDE5', muted: 'rgba(240,237,229,0.58)', rule: 'rgba(240,237,229,0.25)', tomato: '#E4251B' };
/** Description cut at a sentence or comma so it fits maxLines; '' if even the first clause won't fit. */
function descLines(ctx, text, maxW, f, maxLines) {
  const parts = String(text || '').trim().split(/(?<=[.,;:])\s+/);
  let acc = '', out = [];
  for (const p of parts) {
    const n = acc ? acc + ' ' + p : p, L = wrap(ctx, n.replace(/[,;:]$/, ''), maxW, f);
    if (L.length > maxLines) break;
    acc = n; out = L;
  }
  if (out.length) out[out.length - 1] = out[out.length - 1].replace(/[,;:]$/, '');
  return out;
}
const noCur = (l) => cleanPrice(l).replace(/^[£$€]\s*/, '');

export default {
  id: 'menu-board',
  name: 'Menu Board',
  style: 'Café',
  description: 'In-store TV screen / specials board — a calm numbered list of 1–4 dishes with prices, optional deal block',
  formats: ['screen', 'a4', 'a3', 'square'],
  dishes: { min: 1, max: 4 },
  fonts: [SERIF, SANS],
  defaults: { headline: '' },
  render(ctx, W, H, data) {
    const u = unit(W, H), I = info(data), r = H / W, S = Math.min(W, H);
    const wide = r < 0.8, square = !wide && r < 1.15;
    const m = S * (wide ? 0.065 : 0.07), ms = S / 46;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    grain(ctx, 0, 0, W, H, 0.03, 9);
    const dishes = (data.dishes || []).slice(0, 4), n = Math.max(1, dishes.length);
    const micro = (s) => F(s, SANS, 700);

    // header: name in the serif, day-part label in tracked caps, hairline
    let y = m;
    const ns = fitSize(ctx, I.name, W - 2 * m - (wide ? W * 0.3 : 0), S * (wide ? 0.09 : square ? 0.08 : 0.1), S * 0.04, (s) => F(s, SERIF, 400), -0.01);
    tx(ctx, I.name, m, y + ns * 0.78, F(ns, SERIF, 400), C.cream, { em: -0.01, size: ns });
    const label = (I.when ? I.when : "Today's specials").toUpperCase();
    if (wide) tx(ctx, clip(ctx, label, W * 0.3, micro(ms), 0.2, ms), W - m, y + ns * 0.78, micro(ms), C.muted, { align: 'right', em: 0.2, size: ms });
    y += ns * 1.0;
    if (!wide) { tx(ctx, clip(ctx, label, W - 2 * m, micro(ms), 0.2, ms), m, y + ms * 1.4, micro(ms), C.muted, { em: 0.2, size: ms }); y += ms * 2.4; }
    y += ms * 1.2;
    ctx.fillStyle = C.rule; ctx.fillRect(m, y, W - 2 * m, Math.max(1, 1.2 * u));
    y += ms * 0.5;

    // deal block: one flat tomato block, full-bleed at the bottom, left-aligned
    let bottom = H - m * 0.6;
    if (I.hasDeal) {
      const bh = S * (wide ? 0.17 : square ? 0.19 : 0.17);
      const by = H - bh;
      ctx.fillStyle = C.tomato; ctx.fillRect(0, by, W, bh);
      const o = { family: SERIF, weight: 400, sym: 0.5, pence: 0.44 };
      const wasS = I.was ? bh * 0.16 : 0;
      const ps = I.price ? fitPrice(ctx, I.price, W * 0.3, bh * 0.66, o) : 0;
      const pw = I.price ? priceW(ctx, I.price, ps, o) : 0;
      const wasW = I.was ? tw(ctx, I.was, F(wasS, SANS, 400)) + bh * 0.2 : 0;
      const leftW = W - 2 * m - pw - wasW - bh * 0.3;
      const lines = [I.includes, I.when && wide ? '' : ''].filter(Boolean).join('  ·  ');
      const title = I.headline ? sentence(I.headline) : 'Deal.';
      const hf = fitBlock(ctx, title, leftW, bh * (lines ? 0.42 : 0.6), { family: SERIF, weight: 400, maxSize: bh * (lines ? 0.42 : 0.52), minSize: bh * 0.2, lh: 0.95, maxLines: 1 });
      const hb = by + bh * (lines ? 0.5 : 0.62);
      tx(ctx, clip(ctx, hf.lines.join(' '), leftW, F(hf.size, SERIF, 400)), m, hb, F(hf.size, SERIF, 400), C.cream, { size: hf.size });
      if (lines) {
        const s = fitSize(ctx, lines, leftW, bh * 0.15, bh * 0.1, (q) => F(q, SANS, 400), 0);
        tx(ctx, clip(ctx, lines, leftW, F(s, SANS, 400)), m, hb + bh * 0.24, F(s, SANS, 400), C.cream, { size: s, alpha: 0.9 });
      }
      if (I.price) {
        const pb = by + bh / 2 + ps * 0.36;
        drawPrice(ctx, I.price, W - m, pb, ps, { ...o, fill: C.cream, align: 'right' });
        if (I.was) drawWas(ctx, I.was, W - m - pw - bh * 0.18, pb, wasS, { family: SANS, weight: 400, fill: C.cream, align: 'right', alpha: 0.8, lw: 0.06 });
      }
      bottom = by - ms * 1.2;
    } else if (I.phone || I.small) {
      const t = [I.phone, I.small].filter(Boolean).join('  ·  ').toUpperCase();
      tx(ctx, clip(ctx, t, W - 2 * m, micro(ms * 0.9), 0.2, ms * 0.9), m, H - m, micro(ms * 0.9), C.muted, { em: 0.2, size: ms * 0.9 });
      bottom = H - m - ms * 2.4;
    }

    // rows
    const areaH = bottom - y;
    const priceO = { family: SERIF, weight: 400, inline: true };
    const prices = dishes.map((d) => noCur(d.priceLabel || (d.price != null ? `£${Number(d.price).toFixed(2)}` : '')));
    const priceCol = W - m;
    if (n === 1 && !wide) {
      // single dish on a tall board: the dish big across the column, then one numbered row under it (name wraps, never cut)
      const d = dishes[0] || {};
      const nameMax = S * (square ? 0.075 : 0.085);
      const pS = prices[0] ? fitPrice(ctx, prices[0], W * 0.3, nameMax * 1.25, priceO) : 0;
      const pW = prices[0] ? priceW(ctx, prices[0], pS, priceO) : 0;
      const numW = ms * 3.2, nx = m + numW, nameW = priceCol - pW - ms * 2.5 - nx;
      const nf0 = fitBlock(ctx, d.name || '', nameW, nameMax * 3.2, { family: SERIF, weight: 400, maxSize: nameMax, minSize: nameMax * 0.5, lh: 1.02, maxLines: 3 });
      const nS = nf0.size, nf = F(nS, SERIF, 400);
      const descS = Math.max(ms * 1.05, S / 34), dF = F(descS, SANS, 400);
      const desc = d.description ? descLines(ctx, d.description, nameW, dF, square ? 1 : 3) : [];
      const textH = ms * 2 + nf0.lines.length * nS * 1.02 + (desc.length ? descS * 0.9 + desc.length * descS * 1.4 : 0);
      const imgH = Math.max(areaH * 0.35, areaH - textH - ms * 2);
      const dr = d.image ? dish(ctx, d.image, m, y + ms, W - 2 * m, imgH - ms, { anchor: 'center', contact: 'rgba(0,0,0,0.45)', spread: 0.85, flat: 0.07 }) : null;
      let ty = (dr ? Math.max(dr.y + dr.h, y + imgH * 0.6) : y + imgH) + ms * 2;
      ctx.fillStyle = C.rule; ctx.fillRect(m, ty - ms * 0.8, W - 2 * m, Math.max(1, u));
      let b = ty + ms * 0.8 + nS * 0.78;
      tx(ctx, '01', m, b - nS * 0.18, micro(ms), C.muted, { em: 0.2, size: ms });
      nf0.lines.forEach((l, k) => tx(ctx, l, nx, b + k * nS * 1.02, nf, C.cream, { size: nS }));
      if (prices[0]) drawPrice(ctx, prices[0], priceCol, b, pS, { ...priceO, fill: C.cream, align: 'right' });
      const lastB = b + (nf0.lines.length - 1) * nS * 1.02;
      desc.forEach((l, k) => tx(ctx, l, nx, lastB + descS * 1.9 + k * descS * 1.4, dF, C.muted, { size: descS }));
      return;
    }
    const rh = n === 1 ? Math.min(areaH, S * 0.6) : Math.min(areaH / n, S * (wide ? 0.34 : 0.4));
    const y0 = y + (areaH - rh * n) / 2 * (n === 1 ? 1 : 0.4);
    const numW = ms * 3.2;
    const imgW = n === 1 ? Math.min(rh * 1.4, W * 0.36) : Math.min(rh * (wide ? 1.35 : 1.2), W * (wide ? 0.16 : 0.22));
    const tx0 = m + numW + imgW + ms * 1.6;
    const nameMax = Math.min(rh * 0.3, S * (n === 1 ? 0.09 : wide ? 0.06 : 0.07));
    const descS = Math.max(ms * 0.95, Math.min(nameMax * 0.4, S / 36));
    // one shared name size and price size down the list
    const pS = Math.min(nameMax * 1.1, ...prices.map((p) => (p ? fitPrice(ctx, p, W * 0.16, nameMax * 1.1, priceO) : Infinity)));
    const pWmax = Math.max(0, ...prices.map((p) => (p ? priceW(ctx, p, pS, priceO) : 0)));
    const nameW = priceCol - pWmax - ms * 2 - tx0;
    const maxL = n === 1 ? 3 : 2;
    // names wrap (2 lines in a list, 3 for a lone dish) and shrink — never cut with an ellipsis
    const nS = Math.min(...dishes.map((d) => fitBlock(ctx, d.name || '', nameW, rh * 0.62, { family: SERIF, weight: 400, maxSize: nameMax, minSize: nameMax * 0.55, lh: 1, maxLines: maxL }).size));
    dishes.forEach((d, i) => {
      const ty = y0 + i * rh;
      if (i > 0) { ctx.fillStyle = C.rule; ctx.fillRect(m, ty, W - 2 * m, Math.max(1, u)); }
      const cy = ty + rh / 2;
      tx(ctx, String(i + 1).padStart(2, '0'), m, cy - nS * 0.18, micro(ms), C.muted, { em: 0.2, size: ms });
      if (d.image) dish(ctx, d.image, m + numW, ty + rh * 0.1, imgW, rh * 0.8, { anchor: 'center', contact: 'rgba(0,0,0,0.45)', spread: 0.85, flat: 0.07 });
      const nf = F(nS, SERIF, 400);
      const lines = wrap(ctx, d.name || '', nameW, nf);
      const dW = (wide ? priceCol - pWmax * 0.5 : priceCol - pWmax - ms * 2) - tx0, dF = F(descS, SANS, 400);
      let desc = d.description ? descLines(ctx, d.description, dW, dF, wide || square ? 1 : 2) : [];
      if (rh < nS * lines.length + descS * (1.4 * desc.length + 1.2)) desc = [];
      const blockH = lines.length * nS + desc.length * descS * 1.4 + (desc.length ? descS * 0.5 : 0);
      let b = cy - blockH / 2 + nS * 0.78;
      lines.forEach((l, k) => tx(ctx, l, tx0, b + k * nS, nf, C.cream, { size: nS }));
      const lastB = b + (lines.length - 1) * nS;
      if (prices[i]) {
        drawPrice(ctx, prices[i], priceCol, lastB, pS, { ...priceO, fill: C.cream, align: 'right' });
        if (wide) {
          // dot leaders from the end of the name to the price column
          const x1 = tx0 + tw(ctx, lines[lines.length - 1], nf) + ms * 1.2, x2 = priceCol - priceW(ctx, prices[i], pS, priceO) - ms * 1.2;
          ctx.fillStyle = C.rule;
          for (let x = x1; x < x2; x += ms * 0.9) { ctx.beginPath(); ctx.arc(x, lastB - ms * 0.15, Math.max(1, ms * 0.09), 0, Math.PI * 2); ctx.fill(); }
        }
      }
      desc.forEach((l, k) => tx(ctx, l, tx0, lastB + descS * 1.9 + k * descS * 1.4, dF, C.muted, { size: descS }));
    });
  },
};
