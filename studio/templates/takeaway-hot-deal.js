// Hot Deal — red sunburst, giant outlined headline, yellow price burst, white "when" sash, black name bar.
import { frame, read, items, fitCaps, drawCaps, bigPrice, priceParts, wasPrice, drawCut, cutAspect, rays, burst, roundRect, warmRed, hslStr, INK, YELLOW, WHITE, RED } from './takeaway-kit.js';

/** Black name bar along the bottom edge; text sits inside the safe margin. Returns the bar's top y. */
export function nameBar(ctx, W, H, f, name, phone, { bg = INK, fg = WHITE, accent = YELLOW, textH } = {}) {
  const { m, mb } = f;
  const th = textH || (f.kind === 'landscape' ? H * 0.055 : f.kind === 'square' ? H * 0.045 : H * 0.032);
  const pad = th * 0.55;
  const top = H - mb - th - pad;
  // story: a floating bar sized to the text, above Instagram's reply zone (the poster continues underneath);
  // everything else: the bar runs to the bottom edge.
  ctx.fillStyle = bg;
  if (f.kind === 'story') ctx.fillRect(0, top - pad * 0.15, W, th + pad * 1.3);
  else ctx.fillRect(0, top, W, H - top);
  const avail = W - 2 * m;
  let phoneW = 0;
  if (phone) {
    const pf = fitCaps(ctx, phone, avail * (String(name).length > 22 ? 0.3 : 0.42), th * 0.78, { family: 'Oswald', weight: 700, maxLines: 1 });
    phoneW = pf.width;
    drawCaps(ctx, pf, W - m, top + pad * 0.5 + (th - pf.height) / 2 + (th - pf.height) * 0, { align: 'right', fill: accent });
  }
  if (name) {
    const nw = avail - (phoneW ? phoneW + th * 1.2 : 0);
    let nf = fitCaps(ctx, name, nw, th, { family: 'Anton', maxLines: 1 });
    if (nf.height < th * 0.62) nf = fitCaps(ctx, name, nw, th * 1.15, { family: 'Anton', maxLines: 2, gap: 0.18 }); // long names: two lines
    drawCaps(ctx, nf, phone ? m : W / 2, top + pad * 0.5 + (th - nf.height) / 2, { align: phone ? 'left' : 'center', fill: fg });
  }
  return top;
}

/** Tilted sash with text. Centre (cx, cy), length len, thickness th, angle a. */
export function sash(ctx, text, cx, cy, len, th, a, { bg = WHITE, fg = RED, edge = INK, family = 'Anton', maxTextW = len * 0.86, textDx = 0 } = {}) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(-len / 2 + th * 0.08, -th / 2 + th * 0.12, len, th);
  ctx.fillStyle = bg; ctx.fillRect(-len / 2, -th / 2, len, th);
  if (edge) { ctx.fillStyle = edge; ctx.fillRect(-len / 2, -th / 2, len, th * 0.06); ctx.fillRect(-len / 2, th / 2 - th * 0.06, len, th * 0.06); }
  const f = fitCaps(ctx, text, Math.min(len * 0.86, maxTextW), th * 0.5, { family, maxLines: 1 });
  drawCaps(ctx, f, textDx, -f.height / 2, { align: 'center', fill: fg });
  ctx.restore();
}

/** Price burst with ONLY / price / WAS. */
export function priceBurst(ctx, d, cx, cy, r, f, { fill = YELLOW, rim = INK, price = RED, shadowCol = null } = {}) {
  burst(ctx, cx, cy, r, fill, rim, f.u, 20);
  const inner = r * 0.74;
  const hasWas = !!d.was;
  const isText = priceParts(d.price).text != null;
  const topTxt = hasWas || isText ? '' : 'ONLY';
  const pH = inner * (hasWas || topTxt ? 0.78 : 0.95);
  const pw = inner * 1.62;
  const meas = bigPrice(ctx, d.price, cx, 0, pw, pH, { measureOnly: true });
  const lineH = inner * 0.2, gap = inner * 0.1;
  const total = meas.height + (topTxt ? lineH * 0.85 + gap : 0) + (hasWas ? lineH + gap : 0);
  let y = cy - total / 2;
  if (topTxt) { const tf = fitCaps(ctx, topTxt, pw, lineH * 0.85, { family: 'Oswald', weight: 700, maxLines: 1, spacing: 0.08 }); drawCaps(ctx, tf, cx, y, { align: 'center', fill: INK }); y += lineH * 0.85 + gap; }
  bigPrice(ctx, d.price, cx, y, pw, pH, { fill: price, shadow: shadowCol ? { color: shadowCol, dx: r * 0.018, dy: r * 0.022 } : null });
  y += meas.height + gap;
  if (hasWas) wasPrice(ctx, d.was, cx, y, lineH, { fill: INK, strike: RED, maxW: pw });
}

export default {
  id: 'hot-deal',
  name: 'Hot Deal',
  style: 'Classic takeaway',
  description: 'Red sunburst, giant yellow headline and a price burst — chicken shops, burgers, kebabs',
  formats: ['a4', 'a3', 'ig-post', 'ig-story', 'square', 'screen'],
  dishes: { min: 1, max: 2 },
  fonts: ['Anton', 'Oswald'],
  defaults: { headline: 'HOT DEAL' },
  render(ctx, W, H, data) {
    const f = frame(W, H), { u, m, mt } = f;
    const d = read(data);
    const head = d.headline || d.dishName || 'HOT DEAL';
    const red = warmRed(d.accent);
    const base = hslStr(red.h, red.s, red.l), lite = hslStr(red.h, red.s, Math.min(0.58, red.l + 0.07)), deep = hslStr(red.h, red.s, red.l * 0.55);
    const L = f.kind === 'landscape';

    // ---- regions
    const barTop = H - f.mb - (L ? H * 0.055 : f.kind === 'square' ? H * 0.045 : H * 0.032) * 1.55;
    let dish, headBox, incBox, burstC, sashC, hf;
    if (!L) {
      const story = f.kind === 'story', sq = f.kind === 'square';
      const hh = H * (story ? 0.25 : sq ? 0.2 : 0.22);
      hf = fitCaps(ctx, head, W - 2 * m, hh, { maxLines: story ? 3 : 2, gap: 0.12 });
      const gap = H * (sq ? 0.025 : 0.022);
      headBox = { x: m, y: mt + (story ? H * 0.02 : 0), w: W - 2 * m, h: hf.height };
      const incH = d.includes ? H * (sq ? 0.07 : story ? 0.045 : 0.058) : 0;
      incBox = { x: m, y: headBox.y + hf.height + gap * 1.3, w: W - 2 * m, h: incH };
      const sashH = d.when ? H * (sq ? 0.075 : story ? 0.05 : 0.058) : 0;
      const dTop = incBox.y + incH + (d.includes ? gap * 0.6 : gap);
      const dBot = barTop - (d.when ? sashH * 1.35 : H * 0.02);
      sashC = d.when ? { x: W / 2, y: barTop - sashH * 0.78, len: W * 1.2, th: sashH } : null;
      const print = f.ar > 1.35; // a4 / a3: read from across the road
      const r = Math.min(W * (sq ? 0.19 : print ? 0.285 : 0.235), (dBot - dTop) * (print ? 0.52 : 0.47));
      // dish wants its natural (wide) aspect; centre it vertically in the space we have
      const asp = d.images[0] ? cutAspect(d.images[0]) : 1.5;
      const dw = story ? W * 1.12 : W - 2 * m;
      const dh = Math.min(dBot - dTop, (dw / asp) * (story ? 1.35 : 1.12));
      const dy = dTop + ((dBot - dTop) - dh) * (story ? 0.45 : 0.5);
      dish = { x: story ? -W * 0.1 : m, y: dy, w: dw, h: dh };
      burstC = { x: W - m - r * 0.92, y: Math.min(dBot - r * 0.85, dy + dh * 0.78), r };
      // the burst's lower points reach the sash: keep the sash words in the clear part on the left
      if (sashC) { sashC.textDx = -r * 0.85; sashC.maxTextW = W - 2.4 * m - r * 1.7; }
    } else {
      const colX = W * 0.54, colW = W - m - colX;
      headBox = { x: colX, y: mt, w: colW, h: H * 0.34 };
      hf = fitCaps(ctx, head, colW, headBox.h, { maxLines: 3, gap: 0.12 });
      const incH = d.includes ? H * 0.06 : 0;
      incBox = { x: colX, y: headBox.y + hf.height + H * 0.045, w: colW, h: incH };
      const sashH = d.when ? H * 0.085 : 0;
      dish = { x: m * 0.5, y: mt, w: colX - m * 1.2, h: barTop - mt - (d.when ? sashH * 1.5 : H * 0.03) };
      sashC = d.when ? { x: W / 2, y: barTop - sashH * 0.85, len: W * 1.1, th: sashH, a: -0.03, textDx: (colX - m) / 2 + m * 0.3 - W / 2 } : null;
      const below = incBox.y + incH + H * 0.025;
      const r = Math.min(H * 0.23, (barTop - below) * 0.5, colW * 0.5);
      burstC = { x: colX + colW / 2, y: below + (barTop - below) / 2, r };
    }

    // ---- background: red, rays from the dish, edge vignette
    ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
    const rc = { x: dish.x + dish.w / 2, y: dish.y + dish.h * 0.5 };
    rays(ctx, rc.x, rc.y, Math.hypot(W, H), 28, lite, { rotation: 0.05 });
    const vg = ctx.createRadialGradient(rc.x, rc.y, Math.min(W, H) * 0.25, rc.x, rc.y, Math.hypot(W, H) * 0.62);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(40,0,0,0.45)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

    // ---- headline
    const sw = Math.min(hf.cap * 0.1, 40 * u);
    drawCaps(ctx, hf, L ? headBox.x : W / 2, headBox.y, { align: L ? 'left' : 'center', fill: YELLOW, stroke: INK, strokeWidth: sw, shadow: { color: deep, dx: hf.cap * 0.06, dy: hf.cap * 0.07 } });

    // ---- includes: white type on a black pill
    if (d.includes) {
      const txt = items(d.includes).join('  +  ').toUpperCase() || d.includes;
      const th = incBox.h * 0.56;
      const inf = fitCaps(ctx, txt, incBox.w - incBox.h * 1.2, th, { family: 'Oswald', weight: 700, maxLines: 1 });
      const pw = inf.width + incBox.h * 0.9;
      const px = L ? incBox.x : W / 2 - pw / 2;
      ctx.fillStyle = INK; roundRect(ctx, px, incBox.y, pw, incBox.h, incBox.h / 2); ctx.fill();
      drawCaps(ctx, inf, px + pw / 2, incBox.y + (incBox.h - inf.height) / 2, { align: 'center', fill: WHITE });
    }

    // ---- dish (1 or 2)
    const imgs = d.images.slice(0, 2);
    if (imgs.length === 2) {
      const a = { ...dish, w: dish.w * 0.62, h: dish.h * 0.8 };
      drawCut(ctx, imgs[1], dish.x + dish.w * 0.38, dish.y, a.w, a.h, { u });
      drawCut(ctx, imgs[0], dish.x, dish.y + dish.h * 0.2, dish.w * 0.7, dish.h * 0.8, { u, shadow: 'rgba(0,0,0,0.5)' });
    } else if (imgs[0]) {
      drawCut(ctx, imgs[0], dish.x, dish.y, dish.w, dish.h, { u, shadow: 'rgba(0,0,0,0.45)', scale: f.kind === 'story' || L ? 1.08 : 1 });
    }

    // ---- when sash
    if (sashC) sash(ctx, d.when, sashC.x, sashC.y, sashC.len, sashC.th, sashC.a ?? -0.045, { maxTextW: sashC.maxTextW || (L ? W * 0.54 - 2.5 * m : W - 2.6 * m), textDx: sashC.textDx || 0 });

    // ---- price burst
    if (d.price) priceBurst(ctx, d, burstC.x, burstC.y, burstC.r, f);

    // ---- name bar
    nameBar(ctx, W, H, f, d.name, d.phone);
  },
};
