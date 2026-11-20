// Meal Deal Combo (2026 refresh) — flat ink field, a big flat cream "MEAL / DEAL" to the right margin, up to 3 real
// dishes with contact shadows only, one flat tomato price disc (rotated -6°), a straight mustard band with
// "Burger + Fries + Drink" and a mono micro strip instead of the old name-and-phone bar.
import { frame, readAll, headFit, drawCaps, gapFor, capRatio, font, micro, price, wasLine, track, fitPx, clip, cutRect, putDish, circle, rotated, priceParts, grain } from './mt-kit.js';

const DISPLAY = 'Anton', MONO = 'Geist Mono';
const C = { field: '#141110', cream: '#F6EEDF', mustard: '#F2B705', tomato: '#E4251B', ink: '#141110', contact: 'rgba(0,0,0,0.55)' };

/** "BURGER + FRIES + DRINK" in one weight, plus signs in ink like the words. Centred on cx, cap-top y, cap ≤ h. */
export function plusRow(ctx, list, cx, y, maxW, h, { fill = C.ink, family = DISPLAY } = {}) {
  const cr = capRatio(ctx, family, 400);
  const sep = '  +  ';
  const txt = list.join(sep);
  ctx.save(); ctx.font = font(100, family, 400);
  let S = Math.min(h / cr, (maxW / ctx.measureText(txt).width) * 100);
  ctx.font = font(S, family, 400); ctx.fillStyle = fill; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(txt, cx, y + S * cr);
  ctx.restore();
  return { height: S * cr };
}

/**
 * 1–3 dishes as a neat numbered index, not a heap: a row of cells (the hero's a little wider), all standing on one
 * floor line, no overlap, a tiny mono "01 BURGER" over each. Contact shadows only. Returns the dish rects.
 */
export function indexRow(ctx, dishes, x, y, w, h, { lpx = 16, fill = C.cream } = {}) {
  const list = dishes.filter((ds) => ds && ds.image).slice(0, 3), n = list.length;
  if (!n) return [];
  const weights = n === 1 ? [1] : n === 2 ? [1.25, 1] : [1.3, 1, 1];
  const g = n > 1 ? w * 0.04 : 0, tot = weights.reduce((a, b) => a + b, 0), avail = w - g * (n - 1);
  const labH = n > 1 ? lpx * 2.4 : 0;
  const out = []; let cx = x;
  list.forEach((ds, i) => {
    const cw = (avail * weights[i]) / tot;
    const r = cutRect(ds.image, cx, y + labH, cw, h - labH, { anchor: 'bottom' });
    putDish(ctx, ds.image, r, { shadow: C.contact });
    if (labH && r) {
      const lab = `${String(i + 1).padStart(2, '0')}  ${String(ds.name || '').toUpperCase()}`;
      const p = fitPx(ctx, lab, MONO, 400, lpx, cw, { em: 0.16, min: lpx * 0.75 });
      track(ctx, clip(ctx, lab, font(p, MONO, 400), 0.16, p, cw), r.x, r.y - p * 0.9, font(p, MONO, 400), fill, { em: 0.16, px: p, alpha: 0.7 });
    }
    out.push(r); cx += cw + g;
  });
  return out;
}

/** Flat tomato disc, cream price (raised £ and pence), small was with one thin strike. Rotated -6°. */
export function priceDisc(ctx, d, cx, cy, R) {
  rotated(ctx, cx, cy, -6 * Math.PI / 180, () => {
    circle(ctx, 0, 0, R, C.tomato);
    const isText = priceParts(d.price).text != null;
    const lead = isText ? '' : 'ONLY';
    const leadPx = R * 0.16, wasPx = d.was ? R * 0.13 : 0, iw = R * 1.55;
    const pH = R * (d.was ? 0.66 : 0.76);
    const meas = price(ctx, d.price, 0, 0, iw, pH, { family: DISPLAY, weight: 400, measureOnly: true, spacing: 0 });
    const tot = (lead ? leadPx * 1.25 : 0) + meas.height + (d.was ? wasPx * 1.9 : 0);
    let y = -tot / 2;
    if (lead) { track(ctx, lead, 0, y + leadPx * 0.78, font(leadPx, MONO, 500), C.cream, { align: 'center', em: 0.2, px: leadPx }); y += leadPx * 1.25; }
    price(ctx, d.price, 0, y, iw, pH, { family: DISPLAY, weight: 400, fill: C.cream, align: 'center', spacing: 0 });
    y += meas.height;
    if (d.was) wasLine(ctx, d.was, 0, y + wasPx * 1.7, wasPx, { family: MONO, fill: C.cream, strike: C.cream, align: 'center' });
  });
}

export default {
  id: 'meal-deal',
  name: 'Meal Deal Combo',
  style: 'Takeaway',
  description: 'Flat ink with a big cream MEAL DEAL, up to 3 dishes in a neat row, tomato price disc and a mustard "Burger + Fries + Drink" band',
  formats: ['a4', 'a3', 'ig-post', 'ig-story', 'square', 'screen'],
  dishes: { min: 1, max: 3 },
  fonts: [DISPLAY, MONO],
  defaults: { headline: 'MEAL DEAL' },
  render(ctx, W, H, data) {
    const f = frame(W, H), { u, m, mt, mb, L, story, sq } = f;
    const d = readAll(data);
    const head = d.headline || (d.dishes.length > 1 ? 'COMBO DEAL' : d.dishName) || 'MEAL DEAL';
    let list = d.list.length ? d.list : d.dishes.length > 1 ? d.dishes.map((x) => x.name.split(/\s+/).slice(-1)[0]) : [];
    list = list.map((s) => s.toUpperCase());
    const cw = W - 2 * m;

    ctx.fillStyle = C.field; ctx.fillRect(0, 0, W, H);

    // straight mustard band at the bottom: items row + mono micro strip
    const mpx = Math.max(W * (L ? 0.0095 : 0.016), 17 * u);
    const rowH = list.length ? (L ? H * 0.07 : sq ? H * 0.06 : story ? H * 0.034 : H * 0.045) : 0;
    const pad = Math.max(rowH * 0.7, mpx * 1.6);
    const bandTop = H - mb - mpx * 1.3 - (rowH ? rowH + pad * 1.3 : 0) - pad;
    ctx.fillStyle = C.mustard; ctx.fillRect(0, bandTop, W, H - bandTop);
    // 2–3 dishes: the price disc sits on the band's top edge at the right, so the index row stays clear and the
    // items line keeps to the left of it
    const nD = Math.min(3, d.images.length);
    // the disc's lower part sits in the band, clear of the micro strip; its top just tips over the last plate's rim
    const discR = Math.min(W * (sq ? 0.14 : story ? 0.17 : 0.15), (H - mb - mpx * 1.7 - bandTop) / 1.15);
    const discInBand = !L && nD >= 2 && !!d.price && discR > W * 0.09;
    const rowW = discInBand ? cw - discR * 2 - m * 0.4 : cw;
    if (rowH) plusRow(ctx, list, m + rowW / 2, bandTop + pad, rowW, rowH);
    micro(ctx, d.name, d.when || d.phone, m, W - m, H - mb, mpx, { family: MONO, fill: C.ink, em: 0.2 });

    const gap = gapFor(ctx, DISPLAY, 400, 0.88);
    if (!L) {
      // headline first, fitted to the full measure; the dish row takes what's left
      const hf = headFit(ctx, head, cw, H * (story ? 0.4 : sq ? 0.36 : f.ar > 1.35 ? 0.48 : 0.42), { family: DISPLAY, weight: 400, maxLines: 3, gap });
      drawCaps(ctx, hf, m, mt, { fill: C.cream });
      const headBot = mt + hf.height;
      let R = W * (sq ? 0.15 : story ? 0.2 : 0.17);
      const dTop = headBot + H * 0.03, dBot = bandTop + H * 0.012;
      const n = Math.min(3, d.images.length);
      const rs = indexRow(ctx, d.dishes, m, dTop, discInBand ? cw - discR * 1.3 : cw * (n === 1 && sq ? 0.8 : 1), dBot - dTop, { lpx: mpx });
      if (d.price) {
        if (!discInBand) priceDisc(ctx, d, W - m - R * 0.95, Math.max(dTop + R, bandTop - R * 1.02), R);
        else priceDisc(ctx, d, W - m - discR, bandTop + discR * 0.15, discR);
      }
    } else {
      const colW = W * 0.42;
      const hf = headFit(ctx, head, colW, (bandTop - mt) * 0.48, { family: DISPLAY, weight: 400, maxLines: 2, gap });
      const R = Math.min(H * 0.19, colW * 0.42, (bandTop - mt - hf.height - H * 0.05) / 2);
      drawCaps(ctx, hf, m, mt, { fill: C.cream });
      const dx0 = m + colW + m * 0.4;
      indexRow(ctx, d.dishes, dx0, mt, W - m - dx0, bandTop + H * 0.012 - mt, { lpx: mpx });
      if (d.price) priceDisc(ctx, d, m + R, mt + hf.height + H * 0.035 + R, R);
    }
    grain(ctx, 0, 0, W, H, 0.025);
  },
};
