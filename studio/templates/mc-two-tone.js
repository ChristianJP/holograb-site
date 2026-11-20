// Two Tone — coffee & drinks social post: an oversized lowercase name stacked behind, bleeding off both edges,
// cut by a cream "blank window" the drink stands in, with a pill-button price. Signature device: the window.
import { unit, grain } from './lib.js';
import { F, tx, tw, info, family, fitSize, clip, aspect, dish, rr, cleanPrice, microRow } from './mc-kit.js';

const SANS = 'Schibsted Grotesk', MONO = 'Geist Mono';
const WAYS = {
  matcha: { field: '#BFD8A6', ink: '#1E3B2B', win: '#F7F3EA', pill: '#1E3B2B', pillFg: '#F7F3EA', micro: '#1E3B2B' },
  orange: { field: '#FF7A2F', ink: '#1E3B2B', win: '#F7F3EA', pill: '#1E3B2B', pillFg: '#F7F3EA', micro: '#1E3B2B' },
  pink:   { field: '#F4C7C3', ink: '#3B2A22', win: '#F7F3EA', pill: '#3B2A22', pillFg: '#F7F3EA', micro: '#3B2A22' },
};
const STOP = /^(the|a|an|our|my|your|new|fresh|classic|house|big|small|large|regular|hot|iced|cold|with|and|&|of)$/i;
/** Keep the stacked headline short enough to read: ≤2 words / ≤16 chars as typed, else the first meaningful word, else a bank line. */
function shortHead(raw) {
  const words = raw.split(' ').filter(Boolean);
  if (words.length <= 3 && raw.length <= 16 && words.every((w) => w.length <= 11)) return raw;
  const first = words.find((w) => !STOP.test(w) && w.length >= 4 && w.length <= 11);
  return first || 'your usual?';
}
const way = (accent) => { const f = family(accent); return f === 'red' || f === 'orange' ? WAYS.orange : f === 'pink' ? WAYS.pink : WAYS.matcha; };

/** Stack the words one per line from y0 to y1 (repeating), centred on cx, tracking -0.04em, leading 0.82. */
function stack(ctx, words, cx, y0, y1, size, fill, align = 'center') {
  const f = F(size, SANS, 900), lh = size * 0.82;
  let i = 0;
  for (let b = y0 + size * 0.74; b - size * 0.74 < y1; b += lh, i++) tx(ctx, words[i % words.length], cx, b, f, fill, { align, em: -0.04, size });
}

/** Pill button: '£4.20 · was £4.80' (was part at 70% with a hairline strike). Returns {w,h}. */
function pill(ctx, cx, cy, h, maxW, price, was, extra, P) {
  const s0 = h * 0.42, f = (s) => F(s, SANS, 700);
  const pr = cleanPrice(price);
  let tail = was ? `was ${cleanPrice(was)}` : extra;
  let full = tail ? `${pr}  ·  ${tail}` : pr;
  let s = fitSize(ctx, full, maxW - h, s0, s0 * 0.45, f, 0);
  let pre = was ? 'was ' : '';
  if (tail && tw(ctx, full, f(s)) > maxW - h) {
    if (was) { pre = ''; tail = cleanPrice(was); } else tail = '';
    full = tail ? `${pr}  ·  ${tail}` : pr; s = fitSize(ctx, full, maxW - h, s0, s0 * 0.45, f, 0);
  }
  const w = Math.min(maxW, tw(ctx, full, f(s)) + h * 1.0);
  ctx.fillStyle = P.pill; rr(ctx, cx - w / 2, cy - h / 2, w, h, h / 2); ctx.fill();
  const x = cx - w / 2 + (w - tw(ctx, full, f(s))) / 2, b = cy + s * 0.36;
  const head = tail ? `${pr}  ·  ` : pr;
  const hw = tx(ctx, head, x, b, f(s), P.pillFg, { size: s });
  if (tail) {
    const tw2 = tx(ctx, tail, x + tw(ctx, head + 'x', f(s)) - tw(ctx, 'x', f(s)), b, f(s), P.pillFg, { size: s, alpha: 0.7 });
    if (was) {
      const x0 = x + tw(ctx, head + pre + 'x', f(s)) - tw(ctx, 'x', f(s)), x1 = x + tw(ctx, head + tail + 'x', f(s)) - tw(ctx, 'x', f(s));
      ctx.save(); ctx.globalAlpha = 0.7; ctx.fillStyle = P.pillFg; ctx.fillRect(x0 - s * 0.05, b - s * 0.33, x1 - x0 + s * 0.1, Math.max(1, s * 0.06)); ctx.restore();
    }
  }
  return { w, h };
}

export default {
  id: 'two-tone',
  name: 'Two Tone',
  style: 'Café',
  description: "Coffee & drinks post — the drink's name huge and lowercase in two tones, a cream window the drink stands in, a pill-button price",
  formats: ['ig-post', 'ig-story', 'square', 'a4', 'table-card', 'screen'],
  dishes: { min: 1, max: 1 },
  fonts: [SANS, MONO],
  defaults: { headline: '' },
  headlines: ['', 'matcha, properly', 'your usual?', 'iced, obviously'],
  render(ctx, W, H, data) {
    const u = unit(W, H), I = info(data), r = H / W, S = Math.min(W, H);
    const wide = r < 0.8, story = r > 1.6;
    const P = way(I.accent);
    const m = S * 0.07, ms = S / 46;
    const typed = (I.headline || I.dishName || I.name || 'coffee').toLowerCase().replace(/\s+/g, ' ').trim();
    const raw = shortHead(typed);
    const words = raw.split(' ').filter(Boolean);
    const img = I.dishes[0] && I.dishes[0].image;
    const extra = I.hasDeal && I.dishName && I.dishName.toLowerCase() !== raw ? I.dishName.toLowerCase() : '';
    const print = !wide && W >= 1500;   // a4, a3, table-card

    ctx.fillStyle = P.field; ctx.fillRect(0, 0, W, H);
    const top = story ? H * 0.085 : m;
    const ry = top + ms;
    const typeTop = ry + ms * 2.2;
    // name top-left, hours top-right
    microRow(ctx, I.name, I.when, m, W - m, ry, ms, MONO, P.micro, { weight: 500, em: 0.2 });
    const longest = words.reduce((a, b) => (b.length > a.length ? b : a), words[0] || 'x');
    const w100 = tw(ctx, longest, F(100, SANS, 900), -0.04, 100);

    let win;
    if (!wide) {
      // one complete instance of the headline sits above the window (longest word edge to edge, uncut); the stack then
      // repeats behind the window and on down, so the window cuts the type
      const bot = H - (story ? H * 0.12 : m * 1.2);
      const minWh = H * (story ? 0.42 : r < 1.15 ? 0.46 : 0.44), gap = S * 0.03;
      let size = ((W - m * 0.9) / w100) * 100;
      const maxAbove = bot - minWh - gap - typeTop;
      size = Math.min(size, maxAbove / (words.length * 0.82 + 0.12));
      const above = typeTop + size * (words.length * 0.82 + 0.1) + gap;
      ctx.save(); ctx.beginPath(); ctx.rect(0, typeTop - size * 0.05, W, H); ctx.clip();
      stack(ctx, words, W / 2, typeTop, H, size, P.ink);
      ctx.restore();
      const ww = W * (story ? 0.7 : 0.6);
      const wy = Math.max(above, Math.min(bot - H * (story ? 0.5 : 0.54), H * (story ? 0.52 : 0.55) - H * 0.27));
      win = { x: W / 2 - ww / 2, y: wy, w: ww, h: Math.min(H * (story ? 0.5 : r < 1.15 ? 0.56 : 0.54), bot - wy) };
    } else {
      const ww = W * 0.38, wh = H * 0.74;
      win = { x: Math.min(W * 0.58, W - m - ww), y: typeTop + (H - typeTop - wh) * 0.55, w: ww, h: wh };
      // left column: the words stacked, each one whole, repeating down and cropping off the bottom
      const colW = win.x - m - S * 0.04;
      const size = Math.min((colW / w100) * 100, (H - typeTop - m) / (Math.min(words.length, 3) * 0.82 + 0.1));
      ctx.save(); ctx.beginPath(); ctx.rect(0, typeTop - size * 0.05, win.x - S * 0.02, H); ctx.clip();
      stack(ctx, words, m, typeTop, H, size, P.ink, 'left');
      ctx.restore();
    }
    // the blank window, cutting the type
    ctx.fillStyle = P.win; rr(ctx, win.x, win.y, win.w, win.h, S * 0.06); ctx.fill();
    // pill inside the window foot, drink standing above it
    const ph = print ? Math.max(W * 0.13, Math.min(W * 0.15, win.h * 0.16)) : Math.max(S * 0.075, Math.min(S * 0.095, win.h * 0.12));
    const pcy = win.y + win.h - ph / 2 - win.w * 0.07;
    if (I.price) pill(ctx, win.x + win.w / 2, pcy, ph, win.w * 0.9, I.price, I.was, extra, P);
    const floorY = (I.price ? pcy - ph / 2 : win.y + win.h) - win.h * 0.06;
    if (img) {
      const a = aspect(img), bh = (floorY - win.y) - win.h * 0.08, bw = Math.min(win.w * 0.82, bh * a);
      dish(ctx, img, win.x + win.w / 2 - bw / 2, floorY - bw / a, bw, bw / a, { anchor: 'bottom', contact: 'rgba(30,40,30,0.28)', spread: 0.8, flat: 0.06, lift: 0.96 });
    }
    grain(ctx, 0, 0, W, H, 0.02, 3);
  },
};
