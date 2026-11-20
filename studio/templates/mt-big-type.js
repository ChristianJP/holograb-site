// Big Type — headline-led deal poster: huge condensed caps on flat tomato, one real dish cropped off the edge,
// a cream price stamp. Mono micro strip instead of a name-and-phone bar. Chicken, wings, burgers.
import { frame, readAll, headFit, drawCaps, gapFor, pick, price, wasLine, micro, track, trackW, font, fitPx, clip, dishAt, putDish, aspect, circle, rotated, isGreen, grain, priceParts } from './mt-kit.js';

const DISPLAY = 'Big Shoulders Display', MONO = 'Geist Mono';
const BANK = ['WINGS, PROPERLY HOT', 'THE BIG ONE', 'LUNCH SORTED', 'MEAL DEAL'];
// only promise wings when the dish is chicken
const bankFor = (name) => /wing|chicken|tender|strip|popcorn|fried/i.test(name) ? BANK : BANK.slice(1);
const RED = { field: '#E4251B', cream: '#F6EEDF', ink: '#141110', accent: '#F2B705', contact: 'rgba(60,0,0,0.30)' };
const GREEN = { field: '#1F9D55', cream: '#F4F1E8', ink: '#101410', accent: '#F2B705', contact: 'rgba(0,40,15,0.32)' };

/** Cream stamp: Only / price / was. (cx, cy) centre, radius R, rotated a. */
function stamp(ctx, d, cx, cy, R, a, C) {
  rotated(ctx, cx, cy, a, () => {
    circle(ctx, 0, 0, R, C.cream);
    const iw = R * 1.62;
    const textPrice = priceParts(d.price).text != null;
    const leadPx = R * 0.19, wasPx = d.was ? R * 0.12 : 0;
    const pH = R * (d.was ? 0.7 : 0.82);
    const meas = price(ctx, d.price, 0, 0, iw, pH, { family: DISPLAY, measureOnly: true });
    const lead = textPrice ? '' : 'Only';
    const tot = (lead ? leadPx * 0.95 : 0) + meas.height + (d.was ? wasPx * 1.9 : 0);
    let y = -tot / 2;
    if (lead) { track(ctx, lead, 0, y + leadPx * 0.72, font(leadPx, DISPLAY, 700), C.ink, { align: 'center' }); y += leadPx * 0.95; }
    price(ctx, d.price, 0, y, iw, pH, { family: DISPLAY, fill: C.ink, align: 'center' });
    y += meas.height;
    if (d.was) wasLine(ctx, d.was, 0, y + wasPx * 1.75, wasPx, { family: MONO, fill: C.ink, strike: C.ink, align: 'center' });
  });
}

/** Kicker: small mustard dot + Big Shoulders 700 sentence case. y = baseline. */
function kicker(ctx, text, x, y, px, maxW, C) {
  if (!text) return;
  const r = px * 0.18;
  const p = fitPx(ctx, text, DISPLAY, 700, px, maxW - r * 4, { min: px * 0.7 });
  const t = clip(ctx, text, font(p, DISPLAY, 700), 0, p, maxW - r * 4);
  circle(ctx, x + r, y - p * 0.36, r, C.accent);
  track(ctx, t, x + r * 3.2, y, font(p, DISPLAY, 700), C.cream);
}

export default {
  id: 'big-type',
  name: 'Big Type',
  style: 'Takeaway',
  description: 'Huge condensed caps on flat tomato red, one dish cropped off the edge, cream price stamp — chicken, wings, burgers',
  formats: ['a4', 'a3', 'ig-post', 'ig-story', 'square', 'screen'],
  dishes: { min: 1, max: 1 },
  fonts: [DISPLAY, MONO],
  defaults: { headline: '' },
  headlines: BANK,
  render(ctx, W, H, data) {
    const f = frame(W, H), { u, m, mt, mb, L, story, sq } = f;
    const d = readAll(data);
    const C = isGreen(d.accent) ? GREEN : RED;
    const head = (d.headline || pick(bankFor(d.dishName), d.name + d.dishName)).toUpperCase();
    const kick = d.includes ? d.list.join(' · ') : (d.dishName && d.dishName.toUpperCase() !== head ? d.dishName : 'Perfect for 1');
    const img = d.images[0];

    ctx.fillStyle = C.field; ctx.fillRect(0, 0, W, H);

    // micro strip: name left, when (or phone) right, hairline under
    const mpx = Math.max(W * (L ? 0.0105 : 0.0175), 19 * u);
    const used = micro(ctx, d.name, d.when || d.phone, m, W - m, mt + mpx * 0.8, mpx, { family: MONO, fill: C.cream });
    const ruleY = mt + mpx * 0.8 + used - mpx * 0.55;
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = C.cream; ctx.fillRect(m, ruleY, W - 2 * m, Math.max(1, 1.6 * u)); ctx.restore();
    const top = ruleY + mpx * 2.4;

    const gap = gapFor(ctx, DISPLAY, 900, 0.86);
    const R = L ? H * 0.19 : W * (sq ? 0.15 : story ? 0.18 : 0.17);
    const colW = L ? W * 0.55 - m : W - 2 * m;
    const stampTop = L ? H - m - R * 2 : H - mb - R * 2;
    // width first: the caps should run margin to margin; height may take up to ~half the poster
    const headMaxH = L ? H * 0.5 : H * (story ? 0.28 : sq ? 0.38 : f.ar > 1.35 ? 0.46 : 0.42);
    const hf = headFit(ctx, head, colW, headMaxH, { family: DISPLAY, weight: 900, maxLines: 3, gap, spacing: -0.01 });
    const kpx = Math.min(Math.max(hf.size / 6, 24 * u), W * (L ? 0.03 : 0.05));
    kicker(ctx, kick, m, top + kpx * 0.8, kpx, colW, C);
    const hy = top + kpx * 1.5;
    drawCaps(ctx, hf, m, hy, { fill: C.cream });
    const headBot = hy + hf.height;
    const overlap = hf.cap * (story ? -0.3 : 0.1); // the food may just kiss the last line — never hide it

    // the dish: big, drawn over the headline's last line, cropped off the right (and bottom) edges
    if (img) {
      const asp = aspect(img);
      let r;
      if (story) {
        const zoneTop = headBot - overlap, zoneBot = H - mb - R * 0.25;
        let Dw = Math.min(W * 1.45, (zoneBot - zoneTop) * 1.05 * asp), Dh = Dw / asp;
        r = dishAt(img, W - Dw * (Dw > W ? 0.9 : 0.97), zoneTop + Math.max(0, (zoneBot - zoneTop - Dh) * 0.4), Dw);
      } else if (!L) {
        const avail = H - headBot + overlap;
        let Dh = avail / 0.88, Dw = Dh * asp;
        Dw = Math.min(Dw, W * (sq ? 1.0 : 1.05)); Dh = Dw / asp;
        // short headlines leave a red gap: let the plate grow (≤ 1.2 W) until it just kisses the last line
        if (H - Dh * 0.86 > headBot - overlap + H * 0.03) { Dw = Math.min(W * (sq ? 1.1 : 1.2), ((H - headBot + overlap) / 0.86) * asp); Dh = Dw / asp; }
        const y = Math.max(headBot - overlap, H - Dh * 0.86);
        const x = Dw > W * 0.9 ? W - Dw * 0.93 : W - Dw * 0.96;
        r = dishAt(img, x, y, Dw);
      } else {
        let Dh = H * 0.98, Dw = Dh * asp;
        Dw = Math.min(Dw, W * 0.6); Dh = Dw / asp;
        r = dishAt(img, Math.max(W - Dw * 0.9, m + hf.width + W * 0.012), Math.max(H - Dh * 0.94, H * 0.12), Dw);
      }
      putDish(ctx, img, r, { shadow: C.contact });
    }

    if (d.price) {
      // screen: the stamp lives in the right column (dish's lower-left), never over the headline column
      let cx = L ? Math.max(W * 0.55 + R * 1.05, m + hf.width + W * 0.02 + R) : m + R * 1.02;
      let cy = (L ? H - m : H - mb) - R;
      let RR = R;
      // never let the stamp touch the headline box: its top stays ≥ 2% W under the last line
      const clearTop = headBot + W * 0.02;
      const hitsHead = (r, x) => cy - r < clearTop && x - r < m + hf.width;
      if (hitsHead(RR, cx)) { const room = (cy + RR - clearTop) / 2; RR = Math.max(R * 0.7, Math.min(RR, room)); cy = Math.max(cy, clearTop + RR); }
      if (L && cx + RR > W - m) cx = W - m - RR;
      stamp(ctx, d, cx, cy, RR, -6 * Math.PI / 180, C);
    }
    grain(ctx, 0, 0, W, H, 0.03);
  },
};
