// Tape — pizza & kebab deal on flour cream: cobalt caps with one hard navy offset, two tilted tape bands repeating the
// shop's own line, the real dish sitting on the tapes, a navy price stamp.
import { frame, readAll, ensureExtra, font, headFit, isTwoFor, drawCaps, gapFor, pick, track, trackW, fitPx, clip, micro, price, wasLine, cutRect, dishAt, putDish, aspect, circle, rotated, priceParts, grain } from './mt-kit.js';
import { roundRect as rr } from './lib.js';

const SANS = 'Archivo', HAND = 'Caveat';
const C = { field: '#E9DFCC', cobalt: '#1F4BD8', navy: '#0F2A7A', flour: '#F7F2E8', contact: 'rgba(15,42,122,0.28)' };
const BANKS = {
  pizza: ['SLICE OF THE WEEK', 'NIGHT IN, SORTED', 'PIZZA NIGHT'],
  kebab: ["DONER O'CLOCK", 'NIGHT IN, SORTED', 'WRAPPED UP'],
  any: ['NIGHT IN, SORTED', 'SORTED FOR TONIGHT'],
  two: ['TWO FOR THE SOFA'], // only when there really are two (2 dishes, or the deal says "2 for" / "any two")
};
const BANK = [...new Set([...BANKS.pizza, ...BANKS.kebab, ...BANKS.any, ...BANKS.two])];
const bankFor = (name, n = 1, includes = '') => {
  const base = /pizza|margherita|pepperoni|calzone|slice/i.test(name) ? BANKS.pizza : /doner|döner|kebab|shawarma|gyro|grill|wrap/i.test(name) ? BANKS.kebab : BANKS.any;
  return n >= 2 || isTwoFor(includes) ? [...base, ...BANKS.two] : base;
};

/** A full-bleed tape band centred on cy, rotated a, repeating `words` with flour dots. A repeat starts at canvas x = startX. */
function tape(ctx, W, cy, th, a, bg, words, startX = 0) {
  ctx.save();
  ctx.translate(W / 2, cy); ctx.rotate(a);
  const len = W * 1.5;
  ctx.fillStyle = bg; ctx.fillRect(-len / 2, -th / 2, len, th);
  const px = th * 0.46, em = 0.08, f = font(px, SANS, 700);
  const dotR = px * 0.13, gap = px * 0.9;
  const segs = words.filter(Boolean).map((w) => w.toUpperCase());
  const segW = segs.reduce((s, w) => s + trackW(ctx, w, f, em, px) + gap * 2 + dotR * 2, 0);
  const sx = startX - W / 2;
  let x = segW > 0 ? sx - Math.ceil((sx + len / 2) / segW) * segW : -len / 2;
  const by = px * 0.36;
  while (x < len / 2) {
    for (const w of segs) {
      const ww = track(ctx, w, x, by, f, C.flour, { em, px });
      x += ww + gap;
      circle(ctx, x + dotR, 0, dotR, C.flour);
      x += dotR * 2 + gap;
    }
  }
  ctx.restore();
}

/** Navy stamp: Caveat lead-in, Archivo 900 price, was underneath. */
function stamp(ctx, d, cx, cy, R, head = '') {
  rotated(ctx, cx, cy, 5 * Math.PI / 180, () => {
    circle(ctx, 0, 0, R, C.navy);
    const isText = priceParts(d.price).text != null;
    // "any two for" only when the deal really is a two-for — never because includes lists 2+ items
    const lead = isText ? '' : isTwoFor(head, d.headline, d.includes, d.price) ? 'any two for' : 'only';
    const leadPx = R * 0.26, wasPx = d.was ? R * 0.14 : 0, iw = R * 1.55;
    const pH = R * (d.was ? 0.56 : 0.66);
    const meas = price(ctx, d.price, 0, 0, iw, pH, { family: SANS, weight: 900, measureOnly: true, spacing: -0.02 });
    const tot = (lead ? leadPx * 0.95 : 0) + meas.height + (d.was ? wasPx * 1.8 : 0);
    let y = -tot / 2;
    if (lead) { track(ctx, lead, 0, y + leadPx * 0.62, font(leadPx, HAND, 700), C.flour, { align: 'center' }); y += leadPx * 0.95; }
    price(ctx, d.price, 0, y, iw, pH, { family: SANS, weight: 900, fill: C.flour, align: 'center', spacing: -0.02 });
    y += meas.height;
    if (d.was) wasLine(ctx, d.was, 0, y + wasPx * 1.65, wasPx, { family: SANS, weight: 700, fill: C.flour, strike: C.flour, align: 'center', prefix: 'WAS ', em: 0.06 });
  });
}

/** Outlined flour pill with a hard navy offset. (x, y) top-left. */
function pill(ctx, text, x, y, h, maxW, u) {
  const px = h * 0.38, em = 0.14, f = font(px, SANS, 700);
  const p = fitPx(ctx, text, SANS, 700, px, maxW - h * 1.1, { em, min: px * 0.7 });
  const w = Math.min(maxW, trackW(ctx, text, font(p, SANS, 700), em, p) + h * 1.1);
  const o = Math.max(3, h * 0.09), lw = Math.max(2, h * 0.05);
  ctx.save();
  ctx.fillStyle = C.navy; rr(ctx, x + o, y + o, w, h, h / 2); ctx.fill();
  ctx.fillStyle = C.flour; rr(ctx, x, y, w, h, h / 2); ctx.fill();
  ctx.strokeStyle = C.navy; ctx.lineWidth = lw; rr(ctx, x + lw / 2, y + lw / 2, w - lw, h - lw, h / 2); ctx.stroke();
  ctx.restore();
  track(ctx, text, x + w / 2, y + h / 2 + p * 0.36, font(p, SANS, 700), C.navy, { align: 'center', em, px: p });
  return w;
}

export default {
  id: 'tape',
  name: 'Tape',
  style: 'Takeaway',
  description: 'Pizza & kebab deal on flour cream — two tilted tape bands with your shop name, navy price stamp',
  formats: ['a4', 'a3', 'ig-post', 'ig-story', 'square', 'screen'],
  dishes: { min: 1, max: 2 },
  fonts: [SANS],
  defaults: { headline: '' },
  headlines: BANK,
  async render(ctx, W, H, data) {
    await ensureExtra('Caveat:wght@400;700', HAND, ['700']);
    const f = frame(W, H), { u, m, mt, mb, L, story, sq } = f;
    const d = readAll(data);
    const head = (d.headline || pick(bankFor(d.dishName, d.images.length, d.includes), d.name + d.dishName)).toUpperCase();
    const spec = d.list.length ? d.list.join(' · ') : d.dishName;
    const imgs = d.images.slice(0, 2);
    const cw = W - 2 * m;

    ctx.fillStyle = C.field; ctx.fillRect(0, 0, W, H);

    // micro row
    const mpx = Math.max(W * (L ? 0.0095 : 0.0165), 17 * u);
    const used = micro(ctx, d.name, d.when, m, W - m, mt + mpx * 0.8, mpx, { family: SANS, weight: 700, fill: C.navy, em: 0.2 });
    const top = mt + used + mpx * 1.6;

    // headline with the one sanctioned effect: a hard 0-blur navy offset
    const gap = gapFor(ctx, SANS, 900, 0.88);
    const colW = L ? W * (imgs.length > 1 ? 0.42 : 0.5) - m : cw;
    const hf = headFit(ctx, head, colW, L ? H * 0.42 : H * (story ? 0.22 : sq ? 0.3 : 0.33), { family: SANS, weight: 900, maxLines: 3, gap, spacing: -0.015 });
    const off = hf.cap * 0.05;
    drawCaps(ctx, hf, m, top, { fill: C.cobalt, shadow: { color: C.navy, dx: off, dy: off } });
    let y = top + hf.height + hf.cap * 0.32;
    if (spec) {
      const sp = Math.max(hf.size * (L ? 0.1 : 0.085), 20 * u);
      const p = fitPx(ctx, spec.toUpperCase(), SANS, 700, sp, colW, { em: 0.12, min: sp * 0.7 });
      track(ctx, clip(ctx, spec.toUpperCase(), font(p, SANS, 700), 0.12, p, colW), m, y + p * 0.8, font(p, SANS, 700), C.navy, { em: 0.12, px: p });
      y += p * 1.6;
    }

    // band A carries the shop name, band B the line — each short enough that a whole repeat always shows
    const wordsA = [d.name || 'Fresh tonight'], wordsB = [head];
    const R = L ? H * 0.17 : W * (sq ? 0.13 : 0.15);
    let main = null;
    if (!L) {
      // dish zone: lower part, cropped by the bottom edge
      const img = imgs[0];
      const asp = img ? aspect(img) : 1.6;
      const th = Math.max(H * (story ? 0.042 : sq ? 0.062 : 0.05), W * 0.072); // tape text ≥ 3.2% W
      const zoneTop = y + th * 3.3; // both tapes sit between the type and the food, above the dish
      let Dw = W * (story ? 1.3 : sq ? 0.86 : 1.1), Dh = Dw / asp;
      const maxDh = (H - zoneTop) / (story ? 1.25 : 0.9);
      if (Dh > maxDh) { Dh = maxDh; Dw = Dh * asp; }
      // a second dish stands behind, a little higher — leave room for it under the tapes too
      const rise = imgs[1] ? Dh * 0.1 : 0;
      const dy = story ? Math.max(zoneTop + rise, H - mb * 0.35 - Dh) : Math.max(zoneTop + rise, H - Dh * 0.9);
      main = dishAt(img, W / 2 - Dw / 2 + W * (imgs[1] ? 0.08 : 0.03), dy, Dw);
      const r2 = imgs[1] && main ? dishAt(imgs[1], main.x - main.w * 0.3, main.y - rise, main.w * 0.6) : null;
      const dTop = main ? Math.min(main.y, r2 ? r2.y : main.y) : H * 0.75;
      tape(ctx, W, dTop - th * 2.4, th, -4 * Math.PI / 180, C.cobalt, wordsA, m);
      tape(ctx, W, dTop - th * 0.7, th, 3 * Math.PI / 180, C.navy, wordsB, m * 1.6);
      if (r2) putDish(ctx, imgs[1], r2, { shadow: C.contact });
      if (img) putDish(ctx, img, main, { shadow: C.contact });
      if (d.price) {
        const cx = main ? Math.min(W - m - R * 0.95, main.x + main.w * 0.86) : W - m - R;
        const cy = main ? Math.max(main.y + R * 0.1, y + R * 1.05) : H * 0.6;
        stamp(ctx, d, cx, cy, R, head);
      }
      const ph = Math.max(W * (story ? 0.075 : 0.06), 44 * u);
      pill(ctx, data.qr ? 'Order at the counter' : 'Order at the counter', m, H - mb - ph - Math.max(3, ph * 0.09), ph, cw * 0.62, u);
    } else {
      // landscape: headline left, dish right, tapes across the bottom third
      const img = imgs[0];
      const asp = img ? aspect(img) : 1.6;
      let Dw = W * (imgs.length > 1 ? 0.46 : 0.5), Dh = Dw / asp;
      if (Dh > H * 0.82) { Dh = H * 0.82; Dw = Dh * asp; }
      main = dishAt(img, W - m * 0.5 - Dw, H - Dh * 0.92, Dw);
      const th = H * 0.085;
      tape(ctx, W, H * 0.66, th, -3 * Math.PI / 180, C.cobalt, wordsA, m);
      tape(ctx, W, H * 0.66 + th * 2.0, th, 2.2 * Math.PI / 180, C.navy, wordsB, m * 1.6);
      if (imgs[1] && main) { const r2 = dishAt(imgs[1], main.x - main.w * 0.15, main.y - main.h * 0.16, main.w * 0.6); putDish(ctx, imgs[1], r2, { shadow: C.contact }); }
      if (img) putDish(ctx, img, main, { shadow: C.contact });
      if (d.price) stamp(ctx, d, main ? Math.min(W - m - R, main.x + main.w * 0.88) : W - m - R, main ? Math.max(mt + used + R * 1.1, main.y + R * 0.1) : H * 0.4, R, head);
      const ph = H * 0.075;
      pill(ctx, 'Order at the counter', m, Math.min(y + ph * 0.6, H * 0.6), ph, W * 0.4, u);
    }
    grain(ctx, 0, 0, W, H, 0.03);
  },
};
