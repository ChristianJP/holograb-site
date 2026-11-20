// Caff — London caff revival: a white tile wall, a navy enamel-sign headline, the real plate served on a
// Formica-green counter, and a yolk-yellow price sticker. Signature device: the enamel sign over the counter.
import { unit, grain } from './lib.js';
import { F, tx, tw, info, sentence, fitBlock, fitSize, clip, items, aspect, dish, drawPrice, fitPrice, drawWas, sticker, rr } from './mc-kit.js';

const C = { tile: '#FAF8F2', grout: '#DCE7DE', counter: '#CFE3D4', lip: '#B7D2BF', navy: '#1C2A44', cream: '#FAF8F2', yolk: '#F7B500', bean: '#E0662A' };
const DISP = 'Bagel Fat One', SANS = 'Hanken Grotesk';

function tiles(ctx, W, ct, T, lw) {
  ctx.fillStyle = C.tile; ctx.fillRect(0, 0, W, ct);
  ctx.fillStyle = C.grout;
  const ox = ((W / 2) % T) - T / 2;           // centre the grid on the poster
  for (let x = ox; x < W; x += T) ctx.fillRect(Math.round(x - lw / 2), 0, lw, ct);
  for (let y = ct - T; y > -T; y -= T) ctx.fillRect(0, Math.round(y - lw / 2), W, lw);   // whole tiles sit on the counter
}

/** Enamel sign: navy rounded plate with screw dots, headline + micro line centred. */
function sign(ctx, x, y, w, h, head, micro, S) {
  ctx.fillStyle = C.navy; rr(ctx, x, y, w, h, S * 0.04); ctx.fill();
  const sr = Math.max(2, S * 0.0065), si = S * 0.028;
  ctx.fillStyle = 'rgba(250,248,242,0.38)';
  for (const [a, b] of [[x + si, y + si], [x + w - si, y + si], [x + si, y + h - si], [x + w - si, y + h - si]]) { ctx.beginPath(); ctx.arc(a, b, sr, 0, Math.PI * 2); ctx.fill(); }
  const ms = Math.max(S / 48, Math.min(S / 34, h * 0.075));
  const hf = fitBlock(ctx, head, w * 0.84, h * (micro ? 0.6 : 0.74), { family: DISP, weight: 400, maxSize: h * 0.5, minSize: S * 0.04, lh: 0.98, em: -0.01, maxLines: 2 });
  const hH = (hf.lines.length - 1) * hf.size * 0.98 + hf.size * 0.74;
  const block = hH + (micro ? ms * 2.3 : 0);
  let b = y + (h - block) / 2 + hf.size * 0.74;
  hf.lines.forEach((l, i) => tx(ctx, l, x + w / 2, b + i * hf.size * 0.98, F(hf.size, DISP, 400), C.cream, { align: 'center', em: -0.01, size: hf.size }));
  if (micro) {
    const t = micro.toUpperCase(), mf = (s) => F(s, SANS, 700);
    const s = fitSize(ctx, t, w * 0.84, ms, ms * 0.6, mf, 0.18);
    tx(ctx, t, x + w / 2, b + (hf.lines.length - 1) * hf.size * 0.98 + ms * 2.3, mf(s), C.cream, { align: 'center', em: 0.18, size: s, alpha: 0.85 });
  }
}

function priceSticker(ctx, cx, cy, R, I) {
  sticker(ctx, cx, cy, R, C.yolk, 7 * Math.PI / 180, (g) => {
    const lead = I.hasDeal ? 'only' : 'just';
    const ls = R * 0.17;
    const o = { family: DISP, weight: 400, sym: 0.5, pence: 0.46 };
    const ps = fitPrice(g, I.price, R * 1.42, R * (I.was ? 0.68 : 0.76), o);
    const by = I.was ? R * 0.26 : R * 0.34;
    const pr = drawPrice(g, I.price, 0, by, ps, { ...o, fill: C.navy, align: 'center' });
    tx(g, lead, 0, pr.top - ls * 0.55, F(ls, SANS, 700), C.navy, { align: 'center', size: ls });
    if (I.was) drawWas(g, I.was, 0, by + R * 0.3, R * 0.17, { family: SANS, weight: 700, fill: C.navy, strike: C.bean, align: 'center', lw: 0.1 });
  });
}

export default {
  id: 'caff',
  name: 'Caff',
  style: 'Breakfast',
  description: 'London caff revival — a white tile wall, a navy enamel-sign headline, the plate on a Formica-green counter and a yolk-yellow price sticker',
  formats: ['a4', 'a3', 'ig-post', 'ig-story', 'square', 'screen', 'table-card'],
  dishes: { min: 1, max: 2 },
  fonts: [DISP, SANS],
  defaults: { headline: '' },
  headlines: ['Full English', 'Big breakfast, small price', 'Brew + bacon roll', 'Eggs, your way'],
  render(ctx, W, H, data) {
    const u = unit(W, H), I = info(data), r = H / W, S = Math.min(W, H);
    const wide = r < 0.8, square = !wide && r < 1.2, story = r > 1.6;
    const m = S * 0.07;
    const BRKY = /breakfast|english|fry.?up|eggs?\b|bacon|sausage|beans|toast/i;
    // 'Full English' only for a breakfast plate — a burger or chicken dish gets its own name (or a bank line)
    const head = sentence(I.headline || (BRKY.test(I.dishName) ? 'Full English' : (I.dishName || 'Brew + bacon roll')));
    const microTxt = I.when || I.name;
    const ds = I.dishes.slice(0, 2);
    let incl = I.includes ? items(I.includes) : [];
    if (incl.length && incl.every((p) => !/[a-z]/.test(p))) incl = incl.map((p) => p.toLowerCase());
    const inclTxt = incl.join('  ·  ');
    const ct = Math.round(H * (wide ? 0.64 : story ? 0.57 : square ? 0.62 : 0.65));
    const T = wide ? H / 6 : W / 8;
    tiles(ctx, W, ct, T, Math.max(1.5, 2.2 * u));
    ctx.fillStyle = C.counter; ctx.fillRect(0, ct, W, H - ct);
    const lip = S * 0.018;
    ctx.fillStyle = C.lip; ctx.fillRect(0, ct, W, lip);
    grain(ctx, 0, 0, W, H, 0.02, 9);
    const ms = S / 46;
    const footer = (x0, x1, y, align = 'left') => {
      const t = (I.when ? [I.name, I.address] : [I.address || I.name]).filter(Boolean).join('  ·  ').toUpperCase();
      const f = (s) => F(s, SANS, 400);
      const avail = x1 - x0 - (I.phone && !wide ? tw(ctx, I.phone.toUpperCase(), f(ms * 0.8), 0.16, ms * 0.8) + ms * 2.5 : 0);
      const s = fitSize(ctx, t, avail, ms, ms * 0.8, f, 0.16);
      tx(ctx, clip(ctx, t, avail, f(s), 0.16, s), align === 'center' ? (x0 + x1) / 2 : x0, y, f(s), C.navy, { em: 0.16, size: s, alpha: 0.72, align });
      if (I.phone && !wide && align === 'left') tx(ctx, I.phone.toUpperCase(), x1, y, f(s), C.navy, { align: 'right', em: 0.16, size: s, alpha: 0.72 });
    };

    if (!wide) {
      const top = story ? H * 0.13 : m;   // stories: sign on the 14% safe line, counter raised so the plate fills the frame
      const sh = H * (square ? 0.22 : story ? 0.16 : r < 1.3 ? 0.2 : 0.2);
      sign(ctx, m, top, W - 2 * m, sh, head, microTxt, S);
      const bottom = H - (story ? H * 0.1 : m);
      // plate on the counter edge, ~40% of it into the counter
      const two = ds.length > 1;
      const a0 = ds[0] ? aspect(ds[0].image) : 1.5;
      let dw = W * (two ? (story ? 0.7 : 0.64) : story ? 0.92 : square ? 0.6 : 0.78);
      const inclRoom = inclTxt ? ms * 3.4 : 0;
      let pb = ct + (H - ct) * (story ? 0.3 : 0.4);
      pb = Math.min(pb, bottom - ms * 2.5 - inclRoom - ms);
      const maxH = pb - (top + sh + S * 0.06);
      if (dw / a0 > maxH) dw = maxH * a0;
      const cx0 = two ? W * 0.4 : W * 0.5;
      const d0 = ds[0] ? dish(ctx, ds[0].image, cx0 - dw / 2, pb - dw / a0, dw, dw / a0, { anchor: 'bottom', contact: 'rgba(28,42,68,0.3)', spread: 0.86, flat: 0.06 }) : null;
      let d1 = null;
      if (two) {
        const a1 = aspect(ds[1].image), w1 = Math.min(W * 0.36, dw * 0.56);
        d1 = dish(ctx, ds[1].image, Math.min(W - m * 0.4 - w1, (d0 ? d0.x + d0.w : W * 0.7) - w1 * 0.12), pb - w1 / a1 + w1 / a1 * 0.02, w1, w1 / a1, { anchor: 'bottom', contact: 'rgba(28,42,68,0.3)', spread: 0.86, flat: 0.06 });
      }
      // includes, centred on the counter under the plate
      if (inclTxt) {
        const f = (s) => F(s, SANS, 700);
        const s = fitSize(ctx, inclTxt, W - 2 * m, S / 30, S / 50, f, 0);
        const y = Math.min(bottom - ms * 2.6, pb + (bottom - ms * 2.6 - pb) * (story ? 0.38 : 0.55) + s * 0.35);
        tx(ctx, clip(ctx, inclTxt, W - 2 * m, f(s)), W / 2, y, f(s), C.navy, { align: 'center', size: s });
      }
      footer(m, W - m, bottom);
      // yolk sticker overlapping the plate's right edge
      if (I.price) {
        const R = W * (square ? 0.13 : 0.15);
        const ref = d0 || { x: W * 0.2, y: ct - R, w: W * 0.6, h: R };
        const cx = Math.min(W - m * 0.5 - R, ref.x + ref.w - R * 0.25);
        const cy = Math.max(top + sh + R * 0.85, ref.y + R * 0.5);
        priceSticker(ctx, cx, cy, R, I);
      }
      return;
    }

    // screen: sign top-left, plate centre-right, sticker overlapping, includes on the counter at the left
    const sw = W * 0.44, sh = H * 0.42;
    sign(ctx, m, m, sw, sh, head, microTxt, S);
    const pb = ct + (H - ct) * 0.42;
    const two = ds.length > 1;
    const a0 = ds[0] ? aspect(ds[0].image) : 1.5;
    let dw = Math.min(W * (two ? 0.36 : 0.42), (pb - m) * a0);
    const cx0 = two ? W * 0.68 : W * 0.72;
    const d0 = ds[0] ? dish(ctx, ds[0].image, cx0 - dw / 2, pb - dw / a0, dw, dw / a0, { anchor: 'bottom', contact: 'rgba(28,42,68,0.3)', spread: 0.86, flat: 0.06 }) : null;
    if (two) {
      const a1 = aspect(ds[1].image), w1 = dw * 0.5;
      dish(ctx, ds[1].image, Math.min(W - m * 0.4 - w1, (d0 ? d0.x + d0.w : W * 0.8) - w1 * 0.1), pb - w1 / a1, w1, w1 / a1, { anchor: 'bottom', contact: 'rgba(28,42,68,0.3)', spread: 0.86, flat: 0.06 });
    }
    if (inclTxt) {
      const f = (s) => F(s, SANS, 700);
      const s = fitSize(ctx, inclTxt, sw, S / 26, S / 46, f, 0);
      tx(ctx, clip(ctx, inclTxt, sw, f(s)), m, ct + (H - ct) * 0.45, f(s), C.navy, { size: s });
    }
    footer(m, m + sw, H - m);
    if (I.phone) tx(ctx, I.phone.toUpperCase(), W - m, H - m, F(ms, SANS, 400), C.navy, { align: 'right', em: 0.16, size: ms, alpha: 0.72 });
    if (I.price) {
      const R = H * 0.17;
      const ref = d0 || { x: W * 0.5, y: H * 0.3, w: W * 0.4, h: H * 0.3 };
      priceSticker(ctx, Math.min(W - m - R * 0.6, ref.x + ref.w - R * 0.3), Math.max(m + R, ref.y + R * 0.2), R, I);
    }
  },
};
