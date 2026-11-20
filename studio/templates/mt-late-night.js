// Late Night — after-dark kebab & chicken poster: near-black seamless, wide off-white caps, one real dish huge and
// cropped off the bottom, hot-orange price and hours. No glow on the food — just a faint floor pool and a contact shadow.
import { frame, readAll, ensureExtra, font, headFit, drawCaps, gapFor, pick, track, trackW, fitPx, clip, micro, price, wasLine, dishAt, putDish, aspect, isGreen, isYellow, grain } from './mt-kit.js';

const WIDE = 'Unbounded', MONO = 'IBM Plex Mono';
const BASE = { field: '#101418', pool: '#1C2229', type: '#F5F5F0', signal: '#FF6A13', contact: 'rgba(0,0,0,0.55)' };
const BANK = ['AFTER HOURS', 'DONER, DONE RIGHT', 'LATE ONE?', 'MIXED GRILL'];
// a default headline may only name a product when the dish IS that product
const bankFor = (name) => /doner|döner|kebab|shawarma|gyro/i.test(name) ? ['DONER, DONE RIGHT', 'AFTER HOURS', 'LATE ONE?']
  : /mixed\s*grill|grill/i.test(name) ? ['MIXED GRILL', 'AFTER HOURS', 'LATE ONE?'] : ['AFTER HOURS', 'LATE ONE?'];
const mono = (px, w = 400) => font(px, MONO, w);

/** Faint elliptical floor pool under the dish (very low contrast, never a halo on the food). */
function pool(ctx, cx, cy, rx, ry, col) {
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(28,34,41,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Hours line: square bullet + mono caps in the signal colour. y = baseline. */
function hours(ctx, text, x, y, px, maxW, col) {
  const t = text.toUpperCase();
  const s = px * 0.62;
  const p = fitPx(ctx, t, MONO, 700, px, maxW - s * 2, { em: 0.08, min: px * 0.7 });
  ctx.fillStyle = col; ctx.fillRect(x, y - p * 0.68, s, s);
  track(ctx, clip(ctx, t, mono(p, 700), 0.08, p, maxW - s * 2), x + s * 1.9, y, mono(p, 700), col, { em: 0.08, px: p });
  return p;
}

/** Price, right-aligned at xr with cap-top y; was to its left; thin signal rule underneath. */
function priceBlock(ctx, d, xr, y, maxW, capH, C, u) {
  const meas = price(ctx, d.price, xr, y, maxW, capH, { family: WIDE, weight: 900, measureOnly: true, sym: 0.45, spacing: -0.03 });
  price(ctx, d.price, xr, y, maxW, capH, { family: WIDE, weight: 900, fill: C.signal, align: 'right', sym: 0.45, spacing: -0.03 });
  const ruleY = y + meas.height + meas.height * 0.22, rh = Math.max(3, 4 * u);
  ctx.fillStyle = C.signal; ctx.fillRect(xr - meas.width, ruleY, meas.width, rh);
  if (d.was) {
    // was-price sits up with the pence (top-aligned, left of the price) — never under the block, on the food
    const wp = Math.max(meas.height * 0.2, 16 * u);
    const ww = trackW(ctx, 'was ' + d.was, mono(wp), 0.04, wp);
    const room = xr - meas.width - wp * 1.2;
    if (ww < room - wp) wasLine(ctx, d.was, xr - meas.width - wp * 1.2, y + wp * 0.78, wp, { family: MONO, fill: C.type, strike: C.type, align: 'right', alpha: 0.85 });
    else wasLine(ctx, d.was, xr, y - wp * 0.7, wp, { family: MONO, fill: C.type, strike: C.type, align: 'right', alpha: 0.85 });
  }
  return { ...meas, bottom: ruleY + rh };
}

export default {
  id: 'late-night',
  name: 'Late Night',
  style: 'Takeaway',
  description: 'After-dark kebab & chicken poster — near-black, wide white caps, one dish huge, hot-orange price and hours',
  formats: ['a4', 'a3', 'ig-post', 'ig-story', 'square', 'screen'],
  dishes: { min: 1, max: 1 },
  fonts: [WIDE],
  defaults: { headline: '' },
  headlines: BANK,
  async render(ctx, W, H, data) {
    await ensureExtra('IBM+Plex+Mono:wght@400;700', MONO, ['400', '700']);
    const f = frame(W, H), { u, m, mt, mb, L, story, sq } = f;
    const d = readAll(data);
    const C = { ...BASE, signal: isGreen(d.accent) || isYellow(d.accent) ? '#C7F000' : BASE.signal };
    const head = (d.headline || pick(bankFor(d.dishName), d.name + d.dishName)).toUpperCase();
    const spec = d.list.length ? d.list.join(' · ') : d.dishName;
    const hrs = d.when || '';
    const img = d.images[0];
    const cw = W - 2 * m;

    ctx.fillStyle = C.field; ctx.fillRect(0, 0, W, H);

    // micro strip (top): name · address left, phone right — 60% off-white
    const mpx = Math.max(W * (L ? 0.0095 : 0.016), 17 * u);
    const nameLine = d.address && !story && !sq ? `${d.name}  ·  ${d.address}` : d.name;
    const used = micro(ctx, nameLine, d.phone, m, W - m, mt + mpx * 0.8, mpx, { family: MONO, fill: C.type, em: 0.16, alpha: 0.6 });
    const top = mt + used + mpx * 2.2;

    const gap = gapFor(ctx, WIDE, 900, 0.9);
    const colW = L ? W * 0.48 - m : cw * 0.94;
    const hf = headFit(ctx, head, colW, L ? H * 0.34 : H * (story ? 0.17 : sq ? 0.22 : 0.25), { family: WIDE, weight: 900, maxLines: 2, gap, spacing: -0.02 });
    drawCaps(ctx, hf, m, top, { fill: C.type });
    let y = top + hf.height + hf.cap * 0.55;
    const hpx = Math.max(hf.size * (L ? 0.17 : 0.15), 20 * u);
    if (hrs) { hours(ctx, hrs, m, y + hpx * 0.8, hpx, colW, C.signal); y += hpx * 1.7; }
    if (spec) {
      const sp = Math.max(hf.size / (L ? 6 : 7), 20 * u);
      const p = fitPx(ctx, spec, WIDE, 400, sp, colW, { em: -0.01, min: sp * 0.7 });
      track(ctx, clip(ctx, spec, font(p, WIDE, 400), -0.01, p, colW), m, y + p * 0.95, font(p, WIDE, 400), C.type, { em: -0.01, px: p });
      y += p * 1.8;
    }

    if (!L) {
      const capH = W * (story ? 0.12 : sq ? 0.1 : 0.115);
      const asp = img ? aspect(img) : 1.6;
      // dish: lower centre, cropped by the bottom edge
      // price block (cap + rule) and a clear 3% H gap above the food
      const pBlock = d.price ? capH * 1.22 + Math.max(3, 4 * u) : 0, clearGap = H * 0.03;
      const py0 = y + capH * (d.was ? 0.3 : 0.15);
      const zoneTop = d.price ? py0 + pBlock + clearGap : y + H * 0.01;
      let Dw = W * (story ? 1.05 : sq ? 0.92 : 1.0), Dh = Dw / asp;
      const maxDh = (H - zoneTop) / (story ? 0.95 : 0.86);
      if (Dh > maxDh) { Dh = maxDh; Dw = Dh * asp; }
      const dy = story ? Math.max(zoneTop, H - mb - Dh * 0.8) : Math.max(zoneTop, H - Dh * 0.86);
      const r = dishAt(img, (W - Dw) / 2, dy, Dw);
      if (r) {
        pool(ctx, W / 2, r.y + r.h * 0.78, W * 0.62, r.h * 0.42, C.pool);
        putDish(ctx, img, r, { shadow: C.contact });
      }
      if (d.price) {
        const py = r ? Math.max(py0, r.y - clearGap - pBlock) : H * 0.6;
        priceBlock(ctx, d, W - m, py, cw * 0.62, capH, C, u);
      }
    } else {
      const asp = img ? aspect(img) : 1.6;
      let Dh = H * 0.92, Dw = Dh * asp;
      if (Dw > W * 0.62) { Dw = W * 0.62; Dh = Dw / asp; }
      const r = dishAt(img, W - Dw * 0.92, H - Dh * 0.9, Dw);
      if (r) { pool(ctx, r.x + r.w / 2, r.y + r.h * 0.8, r.w * 0.7, r.h * 0.4, C.pool); putDish(ctx, img, r, { shadow: C.contact }); }
      if (d.price) {
        // fit the block (was line + figures + rule) between the spec line and the bottom margin
        const room = H - mb - (y + H * 0.03);
        const capH = Math.min(H * 0.17, room / (d.was ? 1.75 : 1.3));
        const meas = price(ctx, d.price, 0, 0, colW, capH, { family: WIDE, weight: 900, measureOnly: true, sym: 0.45, spacing: -0.03 });
        // the was-price sits above the figures here (no room to their left) — keep it off the spec line
        const wasRoom = d.was ? Math.max(meas.height * 0.2, 16 * u) * 1.9 : 0;
        const py = Math.min(Math.max(y + H * 0.03 + wasRoom, H - mb - meas.height - H * 0.12), H - mb - meas.height * 1.22 - Math.max(3, 4 * u));
        priceBlock(ctx, d, m + meas.width, py, colW, capH, C, u);
      }
    }
    grain(ctx, 0, 0, W, H, 0.04);
  },
};
