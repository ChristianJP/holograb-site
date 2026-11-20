// Fresh & Bright (2026 refresh) — warm cream ground, one flat brand-colour circle cropped off the right edge with the
// dish sitting on it, a left-aligned sentence-case grotesque headline, an ink price roundel and mono micrographics.
import { unit, grain } from './lib.js';
import { F, tx, tw, info, family, sentence, stop, listSentence, fitBlock, drawBlock, fitSize, clip, aspect, dish, drawPrice, fitPrice, drawWas, microRow, sticker } from './mc-kit.js';

const HEAD = 'Bricolage Grotesque', MONO = 'DM Mono';
const C = { paper: '#F6EEDF', ink: '#1A1410', muted: 'rgba(26,20,16,0.62)' };
const ACC = { red: '#E4251B', orange: '#E4251B', pink: '#E4251B', neutral: '#E4251B', green: '#1F9D55', blue: '#1F4BD8', yellow: '#F2B705' };

export default {
  id: 'fresh-bright',
  name: 'Fresh & Bright',
  style: 'Café',
  description: 'Warm cream, one flat colour circle off the edge and a friendly sentence-case headline — cafés, bakeries, brunch',
  formats: ['a4', 'a3', 'ig-post', 'ig-story', 'square', 'table-card'],
  dishes: { min: 1, max: 2 },
  fonts: [HEAD, MONO],
  defaults: { headline: 'Fresh today.' },
  headlines: ['Fresh today.', 'Meal deal.', 'Brunch, sorted.', 'New on the counter.'],
  render(ctx, W, H, data) {
    const u = unit(W, H), I = info(data), r = H / W, S = Math.min(W, H);
    const wide = r < 1.15, story = r > 1.6;
    const acc = ACC[family(I.accent)] || ACC.red;
    const m = S * 0.07, ms = S / 44;
    const top = story ? H * 0.085 : m, bottom = H - (story ? H * 0.11 : m);
    const head = stop(sentence(I.headline || I.dishName || 'Fresh today'));
    const sub = I.hasDeal && I.includes ? listSentence(I.includes) : '';
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);

    // the one shape: a perfect circle, cropped off the right edge
    const circ = wide ? { x: W * 0.93, y: H * 0.56, r: H * 0.48 } : { x: W * 0.84, y: H * (story ? 0.6 : 0.64), r: W * (story ? 0.56 : 0.52) };
    // keep the circle clear of the micro strip (square / wide formats would otherwise run it under the name + hours)
    const stripB = top + ms * 2.6;
    if (circ.y - circ.r < stripB) { const d = stripB - (circ.y - circ.r); circ.r -= d / 2; circ.y += d / 2; }
    // tall formats: the includes line must stay on cream, so the circle starts below the predicted text block
    if (!wide && sub) {
      const colW0 = W - 2 * m, hTop0 = top + ms * 1.0 + ms * 2.8;
      const hf0 = fitBlock(ctx, head, colW0, H * 0.22, { family: HEAD, weight: 700, maxSize: S * 0.17, minSize: S * 0.05, lh: 0.92, em: -0.02, maxLines: 3 });
      const s0 = S / 30, f0 = fitBlock(ctx, sub, colW0, s0 * 2.5, { family: HEAD, weight: 400, maxSize: s0, minSize: s0 * 0.75, lh: 1.25, maxLines: 2 });
      const subB = hTop0 + hf0.size * 0.74 + (hf0.lines.length - 1) * hf0.size * 0.92 + hf0.size * 0.42 + f0.size * 0.74 + (f0.lines.length - 1) * f0.size * 1.25 + ms * 1.6;
      const d = subB - (circ.y - circ.r);
      if (d > 0) circ.y += d;
    }
    /** Left edge of the circle across a band of y (Infinity where the band misses it). */
    const circLeft = (y0, y1) => {
      const yy = Math.max(y0, Math.min(y1, circ.y));
      const dy = Math.abs(yy - circ.y);
      return dy >= circ.r ? Infinity : circ.x - Math.sqrt(circ.r * circ.r - dy * dy);
    };
    ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(circ.x, circ.y, circ.r, 0, Math.PI * 2); ctx.fill();
    grain(ctx, 0, 0, W, H, 0.025, 12);

    const ry = top + ms;
    const used = microRow(ctx, I.name, I.when, m, W - m, ry, ms, MONO, C.ink, { weight: 500, em: 0.2 });
    const hTop = ry + used - ms + ms * 2.8;
    const colW = wide ? W * 0.5 - m : W - 2 * m;
    const hf = fitBlock(ctx, head, colW, H * (wide ? 0.34 : 0.22), { family: HEAD, weight: 700, maxSize: S * (wide ? 0.15 : 0.17), minSize: S * 0.05, lh: 0.92, em: -0.02, maxLines: 3 });
    let y = drawBlock(ctx, hf, m, hTop, C.ink, { cap: 0.74 });
    if (sub) {
      // the includes line wraps at the circle's left tangent so grey text never sits on the colour; if the gap is too
      // narrow it keeps the full column and goes to full ink (readable on the colour too)
      const s = S / 30, sTop = y + hf.size * 0.42;
      const xl = circLeft(sTop - s, sTop + s * 3.6) - ms * 1.4;
      const narrow = Math.min(colW, xl - m);
      const o = { family: HEAD, weight: 400, maxSize: s, minSize: s * 0.75, lh: 1.25, maxLines: 3 };
      let f = narrow >= colW * 0.36 ? fitBlock(ctx, sub, narrow, s * 3.8, o) : null;
      const fits = !!f && f.lines.length <= 3;
      if (!fits) f = fitBlock(ctx, sub, colW, s * 3.8, o);
      const hit = !fits || f.lines.some((l, i) => m + tw(ctx, l, F(f.size, HEAD, 400)) > circLeft(sTop + i * f.size * 1.25 - f.size, sTop + i * f.size * 1.25 + f.size * 0.3));
      y = drawBlock(ctx, f, m, sTop, hit ? C.ink : C.muted, { cap: 0.74 });
    }

    // dish(es) sitting on the circle
    const ds = I.dishes.slice(0, 2);
    let box = wide ? { x: W * 0.5, y: H * 0.18, w: W * 0.48, h: H * 0.66 } : { x: W * 0.2, y: y + S * 0.06, w: W * 0.76, h: 0 };
    if (!wide) box.h = Math.min(circ.y + circ.r * 0.55 - box.y, W * 0.66);
    let d0 = null;
    if (ds.length === 2) {
      const w1 = box.w * 0.52;
      dish(ctx, ds[1].image, box.x + box.w - w1, box.y + box.h * 0.1, w1, box.h * 0.62, { anchor: 'bottom', contact: 'rgba(30,10,0,0.3)' });
      d0 = dish(ctx, ds[0].image, box.x, box.y + box.h * 0.22, box.w * 0.72, box.h * 0.78, { anchor: 'bottom', contact: 'rgba(30,10,0,0.3)' });
    } else if (ds.length) d0 = dish(ctx, ds[0].image, box.x, box.y, box.w, box.h, { anchor: 'center', contact: 'rgba(30,10,0,0.3)' });

    // ink price roundel, rotated -6°
    if (I.price) {
      const R = Math.min(S * (wide ? 0.15 : 0.17), (bottom - y) * 0.45);
      const cx = m + R, cy = wide ? bottom - R - ms * 2.5 : Math.max(y + R + S * 0.03, bottom - R - ms * 2.6);
      sticker(ctx, cx, cy, R, C.ink, -6 * Math.PI / 180, (g) => {
        const o = { family: HEAD, weight: 700, sym: 0.5, pence: 0.46 };
        const ps = fitPrice(g, I.price, R * 1.45, R * 0.72, o);
        const by = R * 0.3;
        const pr = drawPrice(g, I.price, 0, by, ps, { ...o, fill: C.paper, align: 'center' });
        if (I.was) drawWas(g, I.was, 0, pr.top - R * 0.14, R * 0.17, { family: MONO, weight: 500, fill: C.paper, align: 'center', alpha: 0.8, lw: 0.08 });
        else if (I.hasDeal) tx(g, 'ONLY', 0, pr.top - R * 0.14, F(R * 0.14, MONO, 500), C.paper, { align: 'center', em: 0.2, size: R * 0.14, alpha: 0.8 });
      });
    }
    // bottom micro: phone / small print
    const foot = [I.phone, I.small].filter(Boolean).join('  ·  ').toUpperCase();
    if (foot) {
      const f = (s) => F(s, MONO, 500);
      const s = fitSize(ctx, foot, W * 0.5, ms * 0.9, ms * 0.6, f, 0.2);
      tx(ctx, clip(ctx, foot, W * 0.55, f(s), 0.2, s), m, bottom, f(s), C.ink, { em: 0.2, size: s });
    }
  },
};
