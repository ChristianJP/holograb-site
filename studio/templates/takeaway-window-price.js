// Window Price (2026 refresh) — flat yellow card: a small kicker and flat ink headline top-left, the real dish big and
// cropped off the right edge, an enormous left-aligned ink price (raised £ and pence, no ".00"), a mono was-price,
// an optional round ink "when" sticker and a mono micro strip. Built to be read from across the road.
import { frame, readAll, headFit, drawCaps, gapFor, font, micro, price, wasLine, track, trackW, fitPx, clip, dishAt, putDish, aspect, circle, rotated, grain } from './mt-kit.js';

const DISPLAY = 'Anton', MONO = 'Geist Mono';
const C = { field: '#FFD23F', ink: '#141110', cream: '#FFF6D8', contact: 'rgba(90,60,0,0.35)' };

/** Round ink sticker with `when` in cream mono, up to two lines. */
function sticker(ctx, when, cx, cy, R) {
  const t = when.toUpperCase();
  const parts = t.split(/\s*[·•|]\s*/).filter(Boolean);
  let lines;
  if (parts.length >= 2) lines = [parts[0], parts.slice(1).join(' · ')];
  else { const w = t.split(' '); const k = Math.ceil(w.length / 2); lines = w.length > 1 && t.length > 9 ? [w.slice(0, k).join(' '), w.slice(k).join(' ')] : [t]; }
  rotated(ctx, cx, cy, 7 * Math.PI / 180, () => {
    circle(ctx, 0, 0, R, C.ink);
    let px = R * 0.24;
    for (const l of lines) px = Math.min(px, fitPx(ctx, l, MONO, 500, R * 0.24, R * 1.5, { em: 0.12, min: R * 0.1 }));
    const lh = px * 1.3, y0 = -((lines.length - 1) * lh) / 2 + px * 0.36;
    lines.forEach((l, i) => track(ctx, clip(ctx, l, font(px, MONO, 500), 0.12, px, R * 1.5), 0, y0 + i * lh, font(px, MONO, 500), C.cream, { align: 'center', em: 0.12, px }));
  });
}

export default {
  id: 'window-price',
  name: 'Window Price',
  style: 'Takeaway',
  description: 'Flat yellow window card — the dish big, an enormous ink price you can read from the street',
  formats: ['a4', 'a3', 'ig-post', 'ig-story', 'square', 'screen'],
  dishes: { min: 1, max: 1 },
  fonts: [DISPLAY, MONO],
  defaults: { headline: '' },
  render(ctx, W, H, data) {
    const f = frame(W, H), { u, m, mt, mb, L, story, sq } = f;
    const d = readAll(data);
    const head = (d.headline || d.dishName || 'Special').toUpperCase();
    const kick = d.headline && d.dishName && d.dishName.toUpperCase() !== head ? d.dishName : 'Today';
    const incl = d.list.length ? d.list.join(' + ').toUpperCase() : '';
    const img = d.images[0];
    const cw = W - 2 * m;

    ctx.fillStyle = C.field; ctx.fillRect(0, 0, W, H);
    const mpx = Math.max(W * (L ? 0.0095 : 0.016), 17 * u);
    micro(ctx, d.name, d.phone, m, W - m, H - mb, mpx, { family: MONO, fill: C.ink, em: 0.2 });
    ctx.fillStyle = C.ink; ctx.fillRect(m, H - mb - mpx * 1.9, cw, Math.max(1, 1.5 * u));
    const floor = H - mb - mpx * 1.9;

    const gap = gapFor(ctx, DISPLAY, 400, 0.9);
    const kpx = Math.max(W * (L ? 0.011 : 0.02), 18 * u);
    const colW = L ? W * 0.46 - m : cw;
    const kp = fitPx(ctx, kick.toUpperCase(), MONO, 500, kpx, colW, { em: 0.2, min: kpx * 0.7 });
    track(ctx, clip(ctx, kick.toUpperCase(), font(kp, MONO, 500), 0.2, kp, colW), m, mt + kp * 0.8, font(kp, MONO, 500), C.ink, { em: 0.2, px: kp });
    const hy = mt + kp * 2.2;
    const hf = headFit(ctx, head, colW, L ? H * 0.3 : H * (story ? 0.13 : sq ? 0.15 : 0.15), { family: DISPLAY, weight: 400, maxLines: 2, gap });
    drawCaps(ctx, hf, m, hy, { fill: C.ink });
    const headBot = hy + hf.height;

    // price block (bottom-left, above the strip)
    const capH = L ? H * 0.3 : H * (story ? 0.16 : sq ? 0.2 : 0.25);
    const pMeas = d.price ? price(ctx, d.price, m, 0, colW * (L ? 1 : 0.78), capH, { family: DISPLAY, weight: 400, measureOnly: true, spacing: 0 }) : { height: 0, width: 0 };
    const inclPx = incl ? Math.max(mpx * 1.15, 18 * u) : 0;
    let py = floor - (incl ? inclPx * 2.6 : 0) - mpx * 1.8 - pMeas.height;

    if (!L) {
      // dish: big, cropped off the right edge, between the headline and the price
      if (img) {
        const asp = aspect(img);
        const top = headBot + H * 0.02, bot = py - H * 0.015;
        let Dw = W * (story ? 1.25 : sq ? 1.0 : 1.18), Dh = Dw / asp;
        if (Dh > (bot - top) * 1.08) { Dh = (bot - top) * 1.08; Dw = Dh * asp; }
        const r = dishAt(img, Math.min(m * 0.6, W - Dw * 0.9), top + (bot - top - Dh) * 0.55, Dw);
        putDish(ctx, img, r, { shadow: C.contact });
        if (d.when) { const R = W * (sq ? 0.1 : 0.12); sticker(ctx, d.when, W - m - R, Math.max(headBot + R * 1.2, r.y + R * 0.1), R); }
      } else if (d.when) { const R = W * 0.12; sticker(ctx, d.when, W - m - R, headBot + R * 1.4, R); }
    } else {
      if (img) {
        const asp = aspect(img);
        let Dh = H * 0.9, Dw = Dh * asp;
        if (Dw > W * 0.6) { Dw = W * 0.6; Dh = Dw / asp; }
        const r = dishAt(img, W - Dw * 0.9, (floor - Dh) * 0.55, Dw);
        putDish(ctx, img, r, { shadow: C.contact });
        if (d.when) {
          // placed after the headline is measured: clear of its right edge by ≥ 2% W (or below it)
          const R = H * 0.13, cy = r.y + R * 0.9;
          let cx = r.x + R * 0.6;
          if (cy - R < headBot + H * 0.02) cx = Math.max(cx, m + hf.width + W * 0.02 + R);
          sticker(ctx, d.when, Math.min(cx, W - m - R), cy, R);
        }
      }
    }
    if (d.price) {
      price(ctx, d.price, m, py, colW * (L ? 1 : 0.78), capH, { family: DISPLAY, weight: 400, fill: C.ink, spacing: 0 });
      if (d.was) {
        const wp = Math.max(pMeas.height * 0.13, 18 * u);
        const ww = trackW(ctx, 'was ' + d.was, font(wp, MONO, 400), 0.04, wp);
        if (m + pMeas.width + wp * 1.5 + ww < W - m) wasLine(ctx, d.was, m + pMeas.width + wp * 1.5, py + pMeas.height, wp, { family: MONO, fill: C.ink, strike: C.ink });
        else wasLine(ctx, d.was, m, py - wp * 1.2, wp, { family: MONO, fill: C.ink, strike: C.ink });
      }
    }
    if (incl) {
      const ip = fitPx(ctx, incl, MONO, 500, inclPx, colW, { em: 0.16, min: inclPx * 0.7 });
      track(ctx, clip(ctx, incl, font(ip, MONO, 500), 0.16, ip, colW), m, floor - mpx * 1.8, font(ip, MONO, 500), C.ink, { em: 0.16, px: ip });
    }
    grain(ctx, 0, 0, W, H, 0.025);
  },
};
