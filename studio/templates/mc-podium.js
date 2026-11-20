// Podium — bakery "today's bakes": each bake stands on a flat forest-green podium (number, name, price on its face)
// under a warm sentence-case serif headline, with an inked rubber stamp carrying the deal price.
import { unit, grain } from './lib.js';
import { F, tx, tw, info, sentence, stop, fitBlock, drawBlock, fitSize, clip, wrap, aspect, dish, dishRect, drawPrice, fitPrice, drawWas, microRow, ringText, mkCanvas, rng, cleanPrice } from './mc-kit.js';

const C = { cream: '#F4EBDC', black: '#111111', forest: '#2E4A32' };
const SERIF = 'Fraunces', MONO = 'DM Mono';

/** Inked rubber stamp: two thin rings, ring text, price in the middle, knocked out with grain so it reads as ink. */
function stamp(ctx, cx, cy, R, rot, { ring, price, was, seed = 5 }) {
  const sz = Math.ceil(R * 2.3), c = mkCanvas(sz, sz), g = c.getContext('2d');
  g.translate(sz / 2, sz / 2);
  g.strokeStyle = C.forest; g.lineWidth = Math.max(1.5, R * 0.03);
  g.beginPath(); g.arc(0, 0, R * 0.98, 0, Math.PI * 2); g.stroke();
  g.lineWidth = Math.max(1, R * 0.018);
  g.beginPath(); g.arc(0, 0, R * 0.7, 0, Math.PI * 2); g.stroke();
  // ring text, repeated to go all the way round
  const rs = R * 0.105;
  g.font = F(rs, MONO, 500);
  let t = ring; const circ = Math.PI * 2 * R * 0.84;
  if (g.measureText(t).width > 0) while (g.measureText(t + ring).width < circ * 0.98) t += ring;
  ringText(g, t, 0, 0, R * 0.84, rs, MONO, C.forest, { weight: 500 });
  // centre
  if (price) {
    const ps = fitPrice(g, price, R * 1.18, R * 0.6, { family: SERIF, weight: 900, sym: 0.48, pence: 0.44 });
    const by = was ? R * 0.16 : R * 0.22;
    drawPrice(g, price, 0, by, ps, { family: SERIF, weight: 900, fill: C.forest, align: 'center', sym: 0.48, pence: 0.44 });
    if (was) drawWas(g, was, 0, by + R * 0.28, R * 0.13, { family: MONO, weight: 500, fill: C.forest, align: 'center', lw: 0.08 });
  } else {
    const s = R * 0.3;
    tx(g, 'Baked', 0, -s * 0.05, F(s, SERIF, 900), C.forest, { align: 'center' });
    tx(g, 'today', 0, s * 0.9, F(s, SERIF, 900), C.forest, { align: 'center' });
  }
  // knock out with deterministic grain holes (≈10%) + a couple of dry streaks
  const rnd = rng(seed);
  g.globalCompositeOperation = 'destination-out';
  const n = Math.round(900 * Math.min(2, R / 300) + 400);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R, rad = R * (0.004 + rnd() * rnd() * 0.02);
    g.globalAlpha = 0.5 + rnd() * 0.5;
    g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, rad, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 0.35;
  for (let i = 0; i < 3; i++) { const y = (rnd() - 0.5) * R * 1.4; g.fillRect(-R, y, R * 2, R * (0.01 + rnd() * 0.02)); }
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.globalAlpha = 0.95; ctx.drawImage(c, -sz / 2, -sz / 2); ctx.restore();
}

/** Podium row: rects rising from `floor`, bakes standing on top. Numbered left to right; names wrap to 3 lines and shrink
 *  (never cut); the tallest podium is capped at `maxPod` so spare height goes to the bakes, not to empty green. */
function podiums(ctx, list, x0, x1, floor, maxTop, S, edge, maxPod = Infinity) {
  const n = list.length || 1, gap = S * 0.02;
  const pw = n === 1 ? Math.min(x1 - x0, S * 0.74) : (x1 - x0 - gap * (n - 1)) / n;
  const startX = n === 1 ? (x0 + x1) / 2 - pw / 2 : x0;
  const pad = Math.max(S * 0.028, pw * 0.08), padB = edge ? Math.max(pad, S * 0.055) : pad;
  const noS = S / 62;
  const priceO = { family: MONO, weight: 400, inline: true };
  const faceW = pw - 2 * pad;
  const order = n === 3 ? [1, 0, 2] : n === 2 ? [0, 1] : [0];       // the first bake takes the tall middle podium
  const hk = n === 3 ? [1.2, 1.45, 1.0] : n === 2 ? [1.0, 1.0] : [1.0];
  const rows = list.map((d) => {
    const pl = cleanPrice(d.priceLabel || (d.price != null ? `£${Number(d.price).toFixed(2)}` : ''));
    const ps = pl ? fitPrice(ctx, pl, n === 1 ? faceW * 0.4 : faceW, Math.min(S / 15, pw * 0.22), priceO) : 0;
    return { d, pl, ps };
  });
  const ps = Math.min(...rows.map((r) => r.ps || Infinity));
  const pw1 = isFinite(ps) && n === 1 ? tw(ctx, rows[0].pl, F(ps, MONO, 400)) + pad : 0;
  // one name size for the row: shrink until every name fits in 3 lines
  let nameS = Math.max(S / 46, Math.min(S / 34, pw * 0.075));
  const minName = nameS * 0.62;
  const wrapAll = () => rows.forEach((r) => { r.lines = wrap(ctx, String(r.d.name || '').toUpperCase(), faceW - pw1, F(nameS, MONO, 500), 0.04, nameS); });
  wrapAll();
  while (nameS > minName && rows.some((r) => r.lines.length > 3)) { nameS *= 0.94; wrapAll(); }
  const nf = F(nameS, MONO, 500);
  const maxL = Math.max(1, ...rows.map((r) => r.lines.length));
  const need = n === 1
    ? pad + noS * 1.9 + Math.max(maxL * nameS * 1.25, isFinite(ps) ? ps : 0) + padB
    : pad + noS * 1.9 + maxL * nameS * 1.25 + (isFinite(ps) ? nameS * 0.8 + ps : 0) + padB;
  const grow = n === 3 ? 1.1 : n === 2 ? 1.08 : 1.06;              // bakes may grow a touch past their podium width
  const slots = order.map((idx, k) => {
    const img = rows[idx].d.image, a = img ? aspect(img) : 1.4;
    const bw = pw * (n === 1 ? 0.92 : 1.0);
    return { idx, k, a, bw, x: startX + k * (pw + gap), h: need * hk[k] };
  });
  // fit bakes to the same scale (up to `grow`), then let podiums take what's left — but never past maxPod
  let scale = grow;
  for (const s of slots) { const room = floor - s.h - maxTop; if (s.bw * scale / s.a > room) scale = Math.min(scale, Math.max(0.3, room / (s.bw / s.a))); }
  const spare = Math.min(...slots.map((s) => floor - s.h - maxTop - (s.bw * scale) / s.a));
  const tallest = Math.max(...slots.map((s) => s.h));
  const add = Math.max(0, Math.min(spare * 0.8, maxPod - tallest));
  if (add > 0) slots.forEach((s) => { s.h += add * (s.h / tallest); });
  slots.forEach((s) => {
    const r = rows[s.idx], top = floor - s.h;
    ctx.fillStyle = C.forest; ctx.fillRect(s.x, top, pw, s.h + 2);
    let y = top + pad + noS * 0.75;
    tx(ctx, `NO. ${String(s.k + 1).padStart(2, '0')}`, s.x + pad, y, F(noS, MONO, 400), C.cream, { em: 0.18, size: noS, alpha: 0.72 });
    y += noS * 1.15 + nameS * 0.95;
    r.lines.forEach((l, i) => tx(ctx, l, s.x + pad, y + i * nameS * 1.25, nf, C.cream, { em: 0.04, size: nameS }));
    if (r.pl && isFinite(ps)) {
      if (n === 1) drawPrice(ctx, r.pl, s.x + pw - pad, y - nameS * 0.95 + ps * 0.74, ps, { ...priceO, fill: C.cream, align: 'right' });
      else drawPrice(ctx, r.pl, s.x + pad, top + s.h - padB, ps, { ...priceO, fill: C.cream });
    }
  });
  // bakes last, so one that overhangs its podium sits in front of the neighbour. Returns the highest bake top.
  let hi = floor;
  slots.forEach((s) => {
    const img = rows[s.idx].d.image, top = floor - s.h;
    if (!img) return;
    const bw = s.bw * scale, bh = bw / s.a;
    hi = Math.min(hi, top - bh * 0.96);
    dish(ctx, img, s.x + pw / 2 - bw / 2, top - bh + bh * 0.04, bw, bh, { anchor: 'bottom', contact: 'rgba(20,30,20,0.35)', spread: 0.85, flat: 0.06, lift: 0.96 });
  });
  return hi;
}

export default {
  id: 'podium',
  name: 'Podium',
  style: 'Bakery',
  description: "Bakery 'today's bakes' — each bake stands on a flat forest-green podium with a number and price, under a warm serif and an inked stamp",
  formats: ['a4', 'a3', 'ig-post', 'ig-story', 'square', 'screen', 'table-card'],
  dishes: { min: 1, max: 3 },
  fonts: [SERIF, MONO],
  defaults: { headline: 'Fresh out at 7.' },
  headlines: ['Fresh out at 7.', 'Floury, not fancy.', "Today's bakes.", "Cinnamon o'clock."],
  render(ctx, W, H, data) {
    const u = unit(W, H), I = info(data), r = H / W, S = Math.min(W, H);
    const wide = r < 0.8, square = !wide && r < 1.2, story = r > 1.6;
    const m = S * 0.07, ms = S / 44;
    const head = stop(sentence(I.headline || "Today's bakes"));
    const list = (data.dishes || []).filter((d) => d && d.image).slice(0, 3);
    const dealOn = I.hasDeal || !!(data.deal && data.deal.price);
    const ringTxt = `${I.name.toUpperCase()} · ${(I.when || 'BAKED DAILY').toUpperCase()} · `;
    const right = 'BAKED HERE · DAILY';

    ctx.fillStyle = C.cream; ctx.fillRect(0, 0, W, H);

    if (!wide) {
      const top = story ? H * 0.085 : m;
      const ry = top + ms;
      const used = microRow(ctx, I.name, right, m, W - m, ry, ms, MONO, C.black, { weight: 400, em: 0.22 });
      const hTop = ry + used - ms + ms * 2.6;
      const R = W * (square ? 0.13 : r < 1.3 ? 0.15 : 0.165);
      const maxS = W * (square ? 0.12 : story ? 0.19 : r < 1.3 ? 0.15 : 0.18);
      const hf = fitBlock(ctx, head, W - 2 * m, H * (square ? 0.26 : 0.24), { family: SERIF, weight: 900, maxSize: maxS, minSize: W * 0.05, lh: 0.92, em: -0.015, maxLines: 3 });
      const hBot = drawBlock(ctx, hf, m, hTop, C.black, { cap: 0.72 });
      // stamp: top-right, overlapping the end of the headline when the last line is short, else tucked under it
      const lastW = tw(ctx, hf.lines[hf.lines.length - 1] || '', F(hf.size, SERIF, 900), -0.015, hf.size);
      const cx = W - m - R * 0.92;
      let cy = hBot - hf.size * 0.2 + R * 0.55;
      if (m + lastW > cx - R * 0.9) cy = hBot + R * 1.05;
      // podium row from the bottom edge
      const floor = H - (story ? H * 0.06 : 0);
      if (story) { ctx.fillStyle = C.forest; ctx.fillRect(0, floor, W, H - floor); }
      const bakeTop = podiums(ctx, list, m, W - m, floor, Math.max(hBot + ms * 3, cy + R * (square ? 0.75 : 0.95)), S, !story, H * (story ? 0.26 : 0.3));
      if (story) microRow(ctx, I.phone || I.address, '', m, W - m, floor + (H - floor) * 0.45, ms * 0.9, MONO, C.cream, { em: 0.2 });
      // a tall frame with short names leaves a band of cream between headline and bakes: the stamp drops into it
      if (bakeTop - (cy + R) > R * 0.5) cy = Math.min(Math.max(cy, (hBot + bakeTop) / 2), bakeTop - R * 1.08);
      stamp(ctx, cx, cy, R, -10 * Math.PI / 180, { ring: ringTxt, price: dealOn ? I.price : '', was: dealOn ? I.was : '' });
      grain(ctx, 0, 0, W, H, 0.03, 17);
      return;
    }

    // screen: headline + stamp left, podium row right
    const ry = m + ms;
    microRow(ctx, I.name, right, m, W - m, ry, ms, MONO, C.black, { weight: 400, em: 0.22 });
    const colW = W * 0.38;
    const hTop = ry + ms * 3;
    const hf = fitBlock(ctx, head, colW, H * 0.4, { family: SERIF, weight: 900, maxSize: H * 0.17, minSize: H * 0.06, lh: 0.92, em: -0.015, maxLines: 3 });
    const hBot = drawBlock(ctx, hf, m, hTop, C.black);
    const R = Math.min(H * 0.2, (H - m - hBot) * 0.42);
    podiums(ctx, list, W * 0.45, W - m, H, ry + ms * 3, S, true, H * 0.42);
    stamp(ctx, m + R * 1.05, Math.max(hBot + R * 1.25, H - m - R * 1.0), R, -10 * Math.PI / 180, { ring: ringTxt, price: dealOn ? I.price : '', was: dealOn ? I.was : '' });
    grain(ctx, 0, 0, W, H, 0.03, 17);
  },
};
