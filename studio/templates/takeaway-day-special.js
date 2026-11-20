// Day Special — "WING WEDNESDAY" / "TACO TUESDAY": headline in a big angled black band, diner checker, candy-stripe disc
// behind the dish, red swing price tag.
import { frame, read, items, fitCaps, drawCaps, bigPrice, wasPrice, drawCut, cutAspect, checker, stripes, tagPath, INK, YELLOW, WHITE, RED } from './takeaway-kit.js';
import { nameBar } from './takeaway-hot-deal.js';

const CREAM = '#fff3dc';

/** Red swing tag with the price (and WAS) — rotated a touch. (cx, cy) centre. */
export function priceTag(ctx, d, cx, cy, w, h, a, { fill = RED, ink = WHITE } = {}) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; tagPath(ctx, -w / 2 + h * 0.05, -h / 2 + h * 0.08, w, h); ctx.fill();
  ctx.fillStyle = fill; tagPath(ctx, -w / 2, -h / 2, w, h); ctx.fill();
  // punched hole + string
  const hx = -w / 2 + h * 0.3;
  ctx.fillStyle = CREAM; ctx.beginPath(); ctx.arc(hx, 0, h * 0.075, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(2, h * 0.015); ctx.setLineDash([h * 0.05, h * 0.035]);
  ctx.beginPath(); tagPath(ctx, -w / 2 + h * 0.08, -h / 2 + h * 0.08, w - h * 0.16, h - h * 0.16); ctx.stroke(); ctx.setLineDash([]);
  const x0 = -w / 2 + h * 0.48, iw = w - h * 0.48 - h * 0.14;
  const wasH = d.was ? h * 0.12 : 0;
  const pH = h * (d.was ? 0.56 : 0.66);
  const meas = bigPrice(ctx, d.price, 0, 0, iw, pH, { measureOnly: true });
  const tot = meas.height + (d.was ? wasH + h * 0.07 : 0);
  let y = -tot / 2;
  bigPrice(ctx, d.price, x0 + iw / 2, y, iw, pH, { fill: ink, shadow: { color: '#7d0006', dx: h * 0.02, dy: h * 0.025 } });
  if (d.was) wasPrice(ctx, d.was, x0 + iw / 2, y + meas.height + h * 0.07, wasH, { fill: YELLOW, strike: WHITE, maxW: iw });
  ctx.restore();
}

/** Angled black band with the headline. Returns the band's vertical extent { top, bottom } (axis-aligned). */
function band(ctx, text, cx, cy, len, maxTextW, maxTextH, a, f) {
  const hf = fitCaps(ctx, text, maxTextW, maxTextH, { maxLines: 2, gap: 0.1 });
  const th = hf.height + hf.cap * 0.75;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
  ctx.fillStyle = RED; ctx.fillRect(-len / 2, -th / 2 - th * 0.07, len, th + th * 0.14);
  ctx.fillStyle = INK; ctx.fillRect(-len / 2, -th / 2, len, th);
  drawCaps(ctx, hf, 0, -hf.height / 2, { align: 'center', fill: YELLOW, shadow: { color: RED, dx: hf.cap * 0.05, dy: hf.cap * 0.05 } });
  ctx.restore();
  const ext = Math.abs(Math.sin(a)) * len / 2 + th * 0.57 * Math.cos(a);
  return { th, top: cy - ext, bottom: cy + ext, inner: th * 0.57 };
}

export default {
  id: 'day-special',
  name: 'Day Special',
  style: 'Classic takeaway',
  description: 'Angled headline band, diner checker and a red price tag — Wing Wednesday, Taco Tuesday',
  formats: ['a4', 'a3', 'ig-post', 'ig-story', 'square', 'screen'],
  dishes: { min: 1, max: 1 },
  fonts: ['Anton', 'Oswald'],
  defaults: { headline: 'WING WEDNESDAY' },
  render(ctx, W, H, data) {
    const f = frame(W, H), { u, m, mt } = f;
    const d = read(data);
    const L = f.kind === 'landscape', story = f.kind === 'story', sq = f.kind === 'square';
    const head = d.headline || d.dishName || 'TODAY\'S SPECIAL';
    const sub = [d.when, d.includes ? items(d.includes).join(' + ') : ''].filter(Boolean);
    if (!d.hasDeal && d.dishName && d.dishName.toUpperCase() !== head.toUpperCase()) sub.push(d.dishName);

    ctx.fillStyle = CREAM; ctx.fillRect(0, 0, W, H);
    const cell = Math.round(Math.min(W, H) * 0.035);
    const print = f.kind === 'portrait' && f.ar > 1.35; // a4 / a3
    const chkY = print ? Math.round(m * 0.5) : 0;
    const chkH = Math.max(cell * 2, Math.ceil(mt * 0.9 / cell) * cell) + chkY;
    checker(ctx, 0, chkY, W, chkH - chkY, cell, RED, WHITE);

    const barTop = H - f.mb - (L ? H * 0.055 : sq ? H * 0.045 : H * 0.032) * 1.55;
    const a = L ? -0.045 : -0.075;
    const bandLen = Math.hypot(W, W * 0.2) * 1.1;
    const est = L ? H * 0.125 : H * (story ? 0.12 : sq ? 0.13 : 0.14);
    const bandCy = chkH + Math.abs(Math.sin(a)) * W / 2 + est * 0.62 + H * 0.025;
    const b = band(ctx, head, W / 2, bandCy, bandLen, W * (L ? 0.78 : 0.86), est, a, f);

    // sub lines (when / includes) in red + ink under the band
    let y = b.bottom + H * (L ? 0.035 : 0.025);
    const subH = L ? H * 0.036 : sq ? H * 0.042 : H * 0.03;
    const colX = L ? m : 0, colW = L ? W * 0.42 : W;
    const subs = sub.slice(0, 2);
    const drawSubs = (y0) => {
      let yy = y0;
      subs.forEach((t, i) => {
        const sf = fitCaps(ctx, t, colW - (L ? 0 : 2 * m), subH * (i ? 0.8 : 1), { family: 'Oswald', weight: 700, maxLines: 1, spacing: 0.03 });
        drawCaps(ctx, sf, L ? colX : W / 2, yy, { align: L ? 'left' : 'center', fill: i ? INK : RED });
        yy += sf.height + subH * 0.55;
      });
      return yy;
    };
    if (!L) y = drawSubs(y);

    // dish + candy-stripe disc
    let dish, tag;
    if (!L) {
      const dTop = y + H * 0.015, dBot = barTop - H * (story ? 0.08 : 0.025);
      const tagW = W * (sq ? 0.46 : print ? 0.7 : 0.56), tagH = tagW * 0.42;
      const asp = d.images[0] ? cutAspect(d.images[0]) : 1.5;
      const room = dBot - dTop - tagH * (sq ? 0.2 : print ? 0.55 : 0.45);
      const ex0 = W / 2 - (sq ? W * 0.08 : 0);
      const dwMax = 2 * (Math.min(ex0 - m, W - m - ex0) - W * 0.03);
      const dw = Math.min(dwMax, room * asp * (sq ? 1.15 : 1)), dh = Math.min(room, dw / asp * 1.1);
      dish = { x: ex0 - dw / 2, y: dTop + (room - dh) * 0.5, w: dw, h: dh };
      tag = { x: W - m - tagW / 2 - W * 0.01, y: Math.min(dBot - tagH * 0.55, dish.y + dish.h + tagH * (sq ? -0.15 : 0.05)), w: tagW, h: tagH, a: -0.07 };
    } else {
      const dx0 = W * 0.44;
      dish = { x: dx0, y: b.bottom - H * 0.02, w: W - m * 0.6 - dx0, h: barTop - b.bottom - H * 0.02 };
      const subsH = subs.length ? subH * (1 + (subs.length > 1 ? 0.8 : 0)) + subH * 0.55 * subs.length : 0;
      const tTop = b.bottom + H * 0.02;
      const tagW = Math.min(W * 0.43, (barTop - tTop - subsH - H * 0.035) / (0.42 * 1.12)), tagH = tagW * 0.42;
      tag = { x: m + tagW / 2 + W * 0.005, y: tTop + tagH * 0.56, w: tagW, h: tagH, a: -0.05 };
      drawSubs(tTop + tagH * 1.12 + H * 0.025);
    }
    // candy-stripe halo: an ellipse a bit larger than the drawn dish, peeking out above and around the plate
    const asp = d.images[0] ? cutAspect(d.images[0]) : 1.5;
    const sc = L ? 1.05 : 1;
    const drawnW = Math.min(dish.w, dish.h * asp) * sc, drawnH = drawnW / asp;
    const ex = dish.x + dish.w / 2, ey = dish.y + dish.h / 2 - drawnH * 0.12;
    const rx = Math.min(drawnW * 0.5 + W * 0.03, ex - m, W - m - ex), ry = Math.max(drawnH * 0.4, Math.min(drawnH * 0.5 + H * 0.05, ey - (L ? b.bottom : y) + H * 0.005));
    ctx.save(); ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
    stripes(ctx, ex - rx, ey - ry, rx * 2, ry * 2, RED, '#ff5446', Math.min(W, H) * 0.06, Math.PI / 4);
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = Math.min(W, H) * 0.008; ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    if (d.images[0]) drawCut(ctx, d.images[0], dish.x, dish.y, dish.w, dish.h, { u, shadow: 'rgba(60,0,0,0.5)', scale: L ? 1.05 : 1 });

    if (d.price) priceTag(ctx, d, tag.x, tag.y, tag.w, tag.h, tag.a);

    nameBar(ctx, W, H, f, d.name, d.phone, { bg: INK, fg: WHITE, accent: YELLOW });
  },
};
