// holograb poster templates — shared helpers + contract. Every template is a module that default-exports:
//
//   {
//     id: 'hot-deal',                       // unique, kebab-case
//     name: 'Hot Deal',                     // shown in the gallery
//     style: 'Takeaway',                    // gallery group: 'Takeaway' | 'Café' | 'Bakery' | 'Breakfast' | 'Minimal' | 'Seasonal'
//     description: 'Red & yellow price burst — chicken shops, burgers, kebabs',
//     formats: ['a4', 'a3', 'ig-post', 'ig-story', 'square', 'screen'],   // keys of FORMATS it supports (looks right in each)
//     dishes: { min: 1, max: 3 },           // how many dish cut-outs it shows
//     fonts: ['Anton', 'Archivo Black'],    // Google Fonts families it needs (loaded by ensureFonts before render)
//     defaults: { headline: 'MEAL DEAL' },  // default deal text when the owner hasn't typed any
//     render(ctx, W, H, data, h) { … }      // draw the whole poster (sync or async). Never throws on missing optional data.
//   }
//
// data = {
//   restaurant: { name, phone, address, website, accent /* '#ff4d2e' — owner's brand colour */ },
//   dishes: [{ name, priceLabel /* '£4.99' */, price /* 4.99 */, description, image /* CanvasImageSource, transparent cut-out */ }],
//   deal: { headline /* 'MEAL DEAL' */, price /* '£4.99' — deal price, may be '' → use dishes[0].priceLabel */,
//           wasPrice /* '£6.50' or '' */, includes /* 'Burger · Fries · Drink' */, when /* 'Mon–Fri · 12–3pm' */, smallPrint },
//   qr: CanvasImageSource | null,          // QR to the restaurant's live menu
//   currency: '£',
// }
// Rules: real food only (the cut-outs ARE the restaurant's scanned dishes — never draw fake food); no holograb branding;
// readable from across the road on A4/A3 (huge headline + price); everything scales with u = min(W, H) / 1080.

export const FORMATS = {
  'a4':         { w: 2480, h: 3508, name: 'A4 poster' },
  'a3':         { w: 3508, h: 4961, name: 'A3 poster' },
  'ig-post':    { w: 1080, h: 1350, name: 'Instagram post' },
  'ig-story':   { w: 1080, h: 1920, name: 'Instagram story' },
  'square':     { w: 1080, h: 1080, name: 'Square post' },
  'screen':     { w: 1920, h: 1080, name: 'TV screen 16:9' },
  'table-card': { w: 1500, h: 2100, name: 'Table card' },
};

/** Unit: 1 = 1px on a 1080-wide square; multiply all sizes by it. */
export const unit = (W, H) => Math.min(W, H) / 1080;

const loaded = new Set();
/** Load Google Fonts families (all weights 400–900 where available) and wait until usable on canvas. */
export async function ensureFonts(families = []) {
  const todo = families.filter((f) => !loaded.has(f));
  if (todo.length && typeof document !== 'undefined') {
    const q = todo.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;700;900`).join('&');
    const href = `https://fonts.googleapis.com/css2?${q}&display=swap`;
    if (!document.querySelector(`link[data-poster-fonts="${href}"]`)) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.dataset.posterFonts = href;
      document.head.appendChild(l);
      await new Promise((r) => { l.onload = r; l.onerror = r; setTimeout(r, 4000); });
    }
    await Promise.all(todo.flatMap((f) => ['400', '700', '900'].map((w) => document.fonts.load(`${w} 64px "${f}"`).catch(() => {}))));
    todo.forEach((f) => loaded.add(f));
  }
}

/** CSS font string. */
export const font = (size, family, weight = 900, style = '') => `${style ? style + ' ' : ''}${weight} ${Math.round(size)}px "${family}", "Arial Black", Impact, sans-serif`;

/** Measure with optional letter-spacing (px). */
export function measure(ctx, text, spacing = 0) {
  return ctx.measureText(text).width + Math.max(0, text.length - 1) * spacing;
}

/**
 * Fit text into a box: wraps on spaces, shrinks from maxSize down to minSize until it fits maxW × maxH.
 * Returns { lines, size, lineHeight }. Use with drawLines.
 */
export function fitText(ctx, text, maxW, maxH, { family = 'Anton', weight = 900, maxSize = 300, minSize = 12, lineHeight = 1.0, upper = false, spacing = 0, maxLines = 4 } = {}) {
  const t = upper ? String(text || '').toUpperCase() : String(text || '');
  for (let size = maxSize; size >= minSize; size = Math.floor(size * 0.94)) {
    ctx.font = font(size, family, weight);
    const sp = spacing * size;
    const words = t.split(/\s+/).filter(Boolean);
    const lines = []; let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (measure(ctx, test, sp) <= maxW || !cur) cur = test; else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    const tooWide = lines.some((l) => measure(ctx, l, sp) > maxW);
    if (!tooWide && lines.length <= maxLines && lines.length * size * lineHeight <= maxH) return { lines, size, lineHeight, family, weight, spacing: sp };
  }
  ctx.font = font(minSize, family, weight);
  return { lines: [t], size: minSize, lineHeight, family, weight, spacing: spacing * minSize };
}

/** Draw fitted lines. align: 'left' | 'center' | 'right'; y = top of the first line. Options: fill, stroke, strokeWidth, shadow. */
export function drawLines(ctx, fit, x, y, { align = 'left', fill = '#000', stroke = null, strokeWidth = 0, shadow = null } = {}) {
  ctx.save();
  ctx.font = font(fit.size, fit.family, fit.weight);
  ctx.textBaseline = 'top';
  if (shadow) { ctx.shadowColor = shadow.color; ctx.shadowBlur = shadow.blur; ctx.shadowOffsetX = shadow.x || 0; ctx.shadowOffsetY = shadow.y || 0; }
  fit.lines.forEach((line, i) => {
    const w = measure(ctx, line, fit.spacing);
    let lx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    const ly = y + i * fit.size * fit.lineHeight;
    const draw = (fn) => {
      if (!fit.spacing) { fn(line, lx, ly); return; }
      let cx = lx; for (const ch of line) { fn(ch, cx, ly); cx += ctx.measureText(ch).width + fit.spacing; }
    };
    if (stroke && strokeWidth) { ctx.lineJoin = 'round'; ctx.lineWidth = strokeWidth; ctx.strokeStyle = stroke; draw((s, a, b) => ctx.strokeText(s, a, b)); }
    ctx.fillStyle = fill; draw((s, a, b) => ctx.fillText(s, a, b));
  });
  ctx.restore();
  return fit.lines.length * fit.size * fit.lineHeight;
}

/** Draw a dish cut-out contained in a box (keeps aspect), anchored bottom-centre by default, with an optional soft contact shadow. */
export function drawDish(ctx, img, x, y, w, h, { anchor = 'bottom', shadow = true, scale = 1 } = {}) {
  if (!img) return null;
  const iw = img.width || img.naturalWidth || 1, ih = img.height || img.naturalHeight || 1;
  const s = Math.min(w / iw, h / ih) * scale;
  const dw = iw * s, dh = ih * s;
  const dx = x + (w - dw) / 2;
  const dy = anchor === 'top' ? y : anchor === 'center' ? y + (h - dh) / 2 : y + h - dh;
  if (shadow) {
    ctx.save();
    const g = ctx.createRadialGradient(dx + dw / 2, dy + dh * 0.86, 0, dx + dw / 2, dy + dh * 0.86, dw * 0.5);
    g.addColorStop(0, 'rgba(0,0,0,0.28)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.translate(0, 0); ctx.scale(1, 1);
    ctx.beginPath(); ctx.ellipse(dx + dw / 2, dy + dh * 0.86, dw * 0.48, dh * 0.12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.drawImage(img, dx, dy, dw, dh);
  return { x: dx, y: dy, w: dw, h: dh };
}

/** Star/price burst path filled (and optionally stroked). */
export function starburst(ctx, cx, cy, rOuter, rInner, points, fill, { stroke = null, strokeWidth = 0, rotation = -Math.PI / 2 } = {}) {
  ctx.save(); ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? rInner : rOuter, a = rotation + (i * Math.PI) / points;
    const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  if (stroke && strokeWidth) { ctx.lineWidth = strokeWidth; ctx.strokeStyle = stroke; ctx.stroke(); }
  ctx.restore();
}

/** Rounded-rect path (call ctx.fill()/stroke() after). */
export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath();
}

/** '£4.99' → { symbol: '£', main: '4', fraction: '.99' }; '€12' → { symbol: '€', main: '12', fraction: '' }. */
export function splitPrice(label) {
  const s = String(label || '').trim();
  const m = /^([^\d\s.,-]*)\s*([\d,]+)([.,]\d+)?\s*([^\d\s]*)$/.exec(s);
  if (!m) return { symbol: '', main: s, fraction: '', suffix: '' };
  return { symbol: m[1] || '', main: m[2], fraction: m[3] || '', suffix: m[4] || '' };
}

/** Classic price typography: big main number, smaller raised symbol + pence. Returns drawn width. (x = left, y = top) */
export function drawPrice(ctx, label, x, y, size, { family = 'Anton', weight = 900, fill = '#fff', stroke = null, strokeWidth = 0, align = 'left' } = {}) {
  const p = splitPrice(label);
  const small = size * 0.45;
  ctx.save(); ctx.textBaseline = 'top';
  ctx.font = font(small, family, weight); const wSym = ctx.measureText(p.symbol).width;
  ctx.font = font(size, family, weight); const wMain = ctx.measureText(p.main).width;
  ctx.font = font(small, family, weight); const wFrac = ctx.measureText(p.fraction).width;
  const total = wSym + wMain + wFrac + size * 0.02;
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const parts = [[p.symbol, small, y + size * 0.08], [p.main, size, y], [p.fraction, small, y + size * 0.08]];
  for (const [txt, sz, ty] of parts) {
    if (!txt) continue;
    ctx.font = font(sz, family, weight);
    if (stroke && strokeWidth) { ctx.lineJoin = 'round'; ctx.lineWidth = strokeWidth; ctx.strokeStyle = stroke; ctx.strokeText(txt, cx, ty); }
    ctx.fillStyle = fill; ctx.fillText(txt, cx, ty);
    cx += ctx.measureText(txt).width;
  }
  ctx.restore();
  return total;
}

/** Subtle film-grain / paper texture over a region (deterministic). */
export function grain(ctx, x, y, w, h, amount = 0.05, seed = 7) {
  const tile = 256, c = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(tile, tile) : Object.assign(document.createElement('canvas'), { width: tile, height: tile });
  const g = c.getContext('2d'), id = g.createImageData(tile, tile);
  let s = seed >>> 0;
  for (let i = 0; i < id.data.length; i += 4) {
    s = (s * 1664525 + 1013904223) >>> 0; const v = (s >>> 24);
    id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = Math.round(255 * amount);
  }
  g.putImageData(id, 0, 0);
  ctx.save(); ctx.fillStyle = ctx.createPattern(c, 'repeat'); ctx.fillRect(x, y, w, h); ctx.restore();
}

/** QR block with a quiet white pad and caption underneath. */
export function drawQR(ctx, qr, x, y, size, { caption = 'Scan for our menu', captionColor = '#000', family = 'Archivo', pad = 0.08 } = {}) {
  if (!qr) return 0;
  ctx.save();
  ctx.fillStyle = '#fff'; roundRect(ctx, x, y, size, size, size * 0.06); ctx.fill();
  const p = size * pad; ctx.imageSmoothingEnabled = false; ctx.drawImage(qr, x + p, y + p, size - 2 * p, size - 2 * p);
  if (caption) { ctx.fillStyle = captionColor; ctx.font = font(size * 0.11, family, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(caption, x + size / 2, y + size * 1.05); }
  ctx.restore();
  return size * 1.2;
}

/** Deal price fallback: deal.price, else the first dish's price. */
export const dealPrice = (data) => (data.deal && data.deal.price) || (data.dishes[0] && data.dishes[0].priceLabel) || '';
