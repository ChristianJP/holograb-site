// Shared kit for the modern-takeaway pack (2026 UK look): flat fields, huge tight grotesques, mono micrographics,
// typographic prices (raised £, superscript pence, no ".00"), real dish cut-outs with a contact shadow only.
// Builds on lib.js + takeaway-kit.js (cap-height fitting, trimmed cut-outs, price parsing). No glows, no blurred drop shadows.
import { font, grain } from './lib.js';
import { capRatio, fitCaps, drawCaps, priceParts, trimBox, items, read, hsl } from './takeaway-kit.js';

export { font, grain, capRatio, fitCaps, drawCaps, priceParts, trimBox, items, read, hsl };

/** Layout facts. m ≈ 6% of the short side; stories keep Instagram's top/bottom UI zones clear. */
export function frame(W, H) {
  const u = Math.min(W, H) / 1080;
  const ar = H / W;
  const kind = ar > 1.6 ? 'story' : ar > 1.12 ? 'portrait' : ar < 0.85 ? 'landscape' : 'square';
  const m = Math.round(Math.min(W, H) * (kind === 'landscape' ? 0.065 : 0.06));
  const mt = kind === 'story' ? Math.round(H * 0.085) : m;
  const mb = kind === 'story' ? Math.round(H * 0.11) : m;
  return { u, ar, kind, m, mt, mb, L: kind === 'landscape', story: kind === 'story', sq: kind === 'square', portrait: kind === 'portrait' };
}

// ---- fonts that Google can't serve at 400/700/900 (DM Mono, IBM Plex Mono, Caveat, Bricolage 800) ----
const extra = new Map();
/** Load a raw Google Fonts css2 family spec, e.g. 'DM+Mono:wght@400;500' — then wait for the given weights. */
export function ensureExtra(spec, family, weights = ['400']) {
  if (typeof document === 'undefined') return Promise.resolve();
  if (extra.has(spec)) return extra.get(spec);
  const p = (async () => {
    const href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
    if (!document.querySelector(`link[data-poster-fonts="${href}"]`)) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.dataset.posterFonts = href;
      document.head.appendChild(l);
      await new Promise((r) => { l.onload = r; l.onerror = r; setTimeout(r, 4000); });
    }
    await Promise.all(weights.map((w) => document.fonts.load(`${w} 64px "${family}"`).catch(() => {})));
  })();
  extra.set(spec, p);
  return p;
}

// ---- tracked text --------------------------------------------------------------------------------------------
const hasLS = (ctx) => 'letterSpacing' in ctx;
/** Width of text at a font string with tracking em (fraction of px). */
export function trackW(ctx, txt, fontStr, em = 0, px = 0) {
  const t = String(txt || ''); if (!t) return 0;
  ctx.save(); ctx.font = fontStr;
  let w;
  if (hasLS(ctx)) { ctx.letterSpacing = `${em * px}px`; w = ctx.measureText(t).width; }
  else w = ctx.measureText(t).width + Math.max(0, t.length - 1) * em * px;
  ctx.restore();
  return w;
}
/** Draw tracked text. baseline 'alphabetic' by default. Returns width. */
export function track(ctx, txt, x, y, fontStr, fill, { align = 'left', em = 0, px = 0, baseline = 'alphabetic', alpha = 1 } = {}) {
  const t = String(txt || ''); if (!t) return 0;
  ctx.save();
  ctx.font = fontStr; ctx.fillStyle = fill; ctx.textBaseline = baseline; ctx.textAlign = 'left'; ctx.globalAlpha *= alpha;
  const sp = em * px;
  let w;
  if (hasLS(ctx)) { ctx.letterSpacing = `${sp}px`; w = ctx.measureText(t).width; } else w = ctx.measureText(t).width + Math.max(0, t.length - 1) * sp;
  const lx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  if (hasLS(ctx) || !sp) ctx.fillText(t, lx, y);
  else { let cx = lx; for (const ch of t) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + sp; } }
  ctx.restore();
  return w;
}
/** Shrink px until a tracked line fits maxW (not below min). */
export function fitPx(ctx, txt, family, weight, px0, maxW, { em = 0, min = px0 * 0.6 } = {}) {
  let px = px0;
  while (px > min && trackW(ctx, txt, font(px, family, weight), em, px) > maxW) px *= 0.95;
  return Math.max(px, min);
}
/** Cut a tracked line with an ellipsis until it fits. */
export function clip(ctx, txt, fontStr, em, px, maxW) {
  let t = String(txt || '');
  if (trackW(ctx, t, fontStr, em, px) <= maxW) return t;
  while (t.length > 1 && trackW(ctx, t + '…', fontStr, em, px) > maxW) t = t.slice(0, -1).trimEnd();
  return t + '…';
}

/**
 * Mono micrographics row: `left` from x0, `right` right-aligned at x1, both CAPS, tracked. Shrinks to share the line;
 * if they still collide, the right one drops below. y = baseline. Returns the height used (≥ one line).
 */
export function micro(ctx, left, right, x0, x1, y, px, { family = 'Geist Mono', weight = 400, fill = '#000', em = 0.2, alpha = 1 } = {}) {
  const L = String(left || '').toUpperCase(), R = String(right || '').toUpperCase();
  const full = x1 - x0, gap = px * 2.5;
  const f = (p) => font(p, family, weight);
  let p = px;
  const need = (pp) => trackW(ctx, L, f(pp), em, pp) + (R ? trackW(ctx, R, f(pp), em, pp) + gap : 0);
  while (p > px * 0.75 && need(p) > full) p *= 0.95;
  if (need(p) <= full) {
    track(ctx, L, x0, y, f(p), fill, { em, px: p, alpha });
    if (R) track(ctx, R, x1, y, f(p), fill, { em, px: p, align: 'right', alpha });
    return px * 1.2;
  }
  const lp = fitPx(ctx, L, family, weight, px, full, { em, min: px * 0.7 });
  track(ctx, clip(ctx, L, f(lp), em, lp, full), x0, y, f(lp), fill, { em, px: lp, alpha });
  if (R) { const rp = fitPx(ctx, R, family, weight, px, full, { em, min: px * 0.7 }); track(ctx, clip(ctx, R, f(rp), em, rp, full), x0, y + px * 1.7, f(rp), fill, { em, px: rp, alpha }); }
  return R ? px * 2.9 : px * 1.2;
}

// ---- headline ------------------------------------------------------------------------------------------------
/** Gap (as a fraction of cap height) that gives a line pitch of `leading` × font size. */
export const gapFor = (ctx, family, weight, leading) => Math.max(0.04, leading / capRatio(ctx, family, weight) - 1);

/** Deterministic pick from a bank, so each restaurant/dish gets its own default headline. */
export function pick(bank, seed) {
  let h = 2166136261; for (const ch of String(seed || '')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return bank[h % bank.length];
}

/**
 * Headline fit that reads like a person set it: tries every way to break the words into ≤ maxLines lines and keeps the
 * biggest size, but prefers breaking right after a comma ('NIGHT IN, / SORTED'), and avoids orphan lines ('IN,') and
 * commas stranded mid-line. Same return shape as fitCaps. Falls back to fitCaps for very long headlines.
 */
export function headFit(ctx, text, maxW, maxH, { family, weight = 900, maxLines = 3, gap = 0.1, spacing = 0, minSize = 10 } = {}) {
  const t = String(text || '').toUpperCase().trim();
  const words = t.split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 9) return fitCaps(ctx, t, maxW, maxH, { family, weight, maxLines, gap, spacing });
  const cr = capRatio(ctx, family, weight);
  ctx.save(); ctx.font = font(100, family, weight);
  const w100 = (s) => ctx.measureText(s).width + Math.max(0, s.length - 1) * spacing * 100;
  const cands = [];
  const rec = (start, lines) => {
    if (start === words.length) { cands.push(lines); return; }
    if (lines.length >= maxLines) return;
    for (let e = start + 1; e <= words.length; e++) rec(e, [...lines, words.slice(start, e).join(' ')]);
  };
  rec(0, []);
  let best = null;
  for (const lines of cands) {
    const n = lines.length, ws = lines.map(w100), wMax = Math.max(...ws);
    const S = Math.min((maxW / wMax) * 100, maxH / (cr * (n + (n - 1) * gap)));
    let score = S;
    if (n > 1) {
      if (Math.min(...ws) < wMax * 0.42) score *= 0.8;               // orphan line
      for (let i = 0; i < n - 1; i++) if (/[,.:;!?]$/.test(lines[i])) score *= 1.12; // break at punctuation
      for (const l of lines) if (/[,;:] /.test(l)) score *= 0.9;      // comma left mid-line
    }
    if (!best || score > best.score) best = { lines, S, score };
  }
  ctx.restore();
  const size = Math.max(minSize, Math.floor(best.S * 0.995));
  ctx.save(); ctx.font = font(size, family, weight);
  const sp = spacing * size;
  const width = Math.max(...best.lines.map((l) => ctx.measureText(l).width + Math.max(0, l.length - 1) * sp));
  ctx.restore();
  const cap = size * cr, n = best.lines.length;
  return { lines: best.lines, size, cap, pitch: cap * (1 + gap), height: n * cap + (n - 1) * cap * gap, width, family, weight, spacing: sp };
}

/** Real "two for" offer? (headline / includes / price say '2 for', 'any two', '2 pizzas' …) — never inferred from item count. */
export const isTwoFor = (...texts) => texts.some((s) => /\b(?:2|two)\s*(?:for|x)\b|\bany\s*(?:2|two)\b|\b(?:2|two)\s+(?:pizzas?|kebabs?|burgers?|wraps?|meals?|mains?|large|medium|small)\b/i.test(String(s || '')));

/** Shorten a dish name for inline use: drop "with …" / "and …" tails. */
export const shortName = (s) => String(s || '').split(/\s+(?:with|and|&|served)\s+/i)[0].trim();

// ---- price ---------------------------------------------------------------------------------------------------
/**
 * Typographic price: main figures at cap height ≤ maxH, £ at `sym` size raised to the cap line, pence superscript,
 * no ".00", no underline, no shadow (optional hard offset `offset: { color, dx, dy }`). Text prices ("2 FOR £15") fit as caps.
 * (x, y) = cap-top; align left|center|right. Returns { width, height, size }.
 */
export function price(ctx, lbl, x, y, maxW, maxH, { family, weight = 900, fill = '#000', align = 'left', small = 0.46, sym = 0.46, measureOnly = false, offset = null, spacing = -0.01 } = {}) {
  const pp = priceParts(lbl);
  if (!String(lbl || '').trim()) return { width: 0, height: 0, size: 0 };
  if (pp.text != null) {
    const f = fitCaps(ctx, pp.text, maxW, maxH * 0.8, { family, weight, maxLines: 2, gap: 0.12 });
    if (!measureOnly) drawCaps(ctx, f, x, y, { align, fill, shadow: offset });
    return { width: f.width, height: f.height, size: f.size };
  }
  const cr = capRatio(ctx, family, weight);
  const frac = (pp.fraction || '').replace(/^[.,]/, '');
  const parts = (S) => {
    const out = [];
    if (pp.symbol) out.push({ t: pp.symbol, s: S * sym, top: true, after: S * 0.02 });
    out.push({ t: pp.main, s: S, top: false, after: frac ? S * 0.03 : 0 });
    if (frac) out.push({ t: frac, s: S * small, top: true, after: 0 });
    if (pp.suffix) out.push({ t: pp.suffix, s: S * small, top: true, after: 0 });
    return out;
  };
  const wOf = (S) => parts(S).reduce((a, p) => { ctx.font = font(p.s, family, weight); return a + ctx.measureText(p.t).width + Math.max(0, p.t.length - 1) * spacing * p.s + p.after; }, 0);
  let S = maxH / cr;
  S = Math.min(S, (maxW / wOf(100)) * 100);
  const total = wOf(S), capH = S * cr;
  if (measureOnly) return { width: total, height: capH, size: S };
  ctx.save(); ctx.textBaseline = 'alphabetic';
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  for (const p of parts(S)) {
    ctx.font = font(p.s, family, weight);
    const by = p.top ? y + p.s * cr : y + capH;
    const sp = spacing * p.s;
    const put = (col, ox, oy) => {
      ctx.fillStyle = col;
      if (!sp) { ctx.fillText(p.t, cx + ox, by + oy); return; }
      let xx = cx + ox; for (const ch of p.t) { ctx.fillText(ch, xx, by + oy); xx += ctx.measureText(ch).width + sp; }
    };
    if (offset) put(offset.color, offset.dx, offset.dy);
    put(fill, 0, 0);
    cx += ctx.measureText(p.t).width + Math.max(0, p.t.length - 1) * sp + p.after;
  }
  ctx.restore();
  return { width: total, height: capH, size: S };
}

/**
 * "was £6.50" — small, with ONE thin strike through the price only. y = baseline. Returns width.
 * prefix '' to draw just the struck price.
 */
export function wasLine(ctx, lbl, x, y, px, { family = 'Geist Mono', weight = 400, fill = '#000', strike = fill, em = 0.04, align = 'left', prefix = 'was ', upper = false, alpha = 1, lineW } = {}) {
  if (!lbl) return 0;
  const clean = String(lbl).replace(/\.00$/, '');
  const pre = upper ? prefix.toUpperCase() : prefix, val = upper ? clean.toUpperCase() : clean;
  const f = font(px, family, weight);
  const wPre = trackW(ctx, pre, f, em, px), wVal = trackW(ctx, val, f, em, px), wSp = pre ? 0 : 0;
  const total = wPre + wVal + wSp;
  const lx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  track(ctx, pre + val, lx, y, f, fill, { em, px, alpha });
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.fillStyle = strike;
  const th = lineW || Math.max(1.5, px * 0.075);
  ctx.fillRect(lx + wPre - px * 0.08, y - px * 0.33 - th / 2, wVal + px * 0.16, th);
  ctx.restore();
  return total;
}

// ---- dishes --------------------------------------------------------------------------------------------------
/** Rect a trimmed dish takes when contained in (x, y, w, h) × scale. */
export function cutRect(img, x, y, w, h, { anchor = 'center', halign = 'center', scale = 1 } = {}) {
  if (!img) return null;
  const b = trimBox(img);
  const s = Math.min(w / b.w, h / b.h) * scale;
  const dw = b.w * s, dh = b.h * s;
  const dx = halign === 'left' ? x : halign === 'right' ? x + w - dw : x + (w - dw) / 2;
  const dy = anchor === 'top' ? y : anchor === 'bottom' ? y + h - dh : y + (h - dh) / 2;
  return { x: dx, y: dy, w: dw, h: dh, b };
}
/** Draw a dish at an exact rect (from cutRect / dishAt) with a soft contact ellipse ONLY — no halo, no blurred drop shadow. */
export function putDish(ctx, img, r, { shadow = 'rgba(0,0,0,0.30)', contact = 0.9, spread = 0.44 } = {}) {
  if (!img || !r) return r;
  const b = r.b || trimBox(img);
  if (shadow) {
    ctx.save();
    ctx.fillStyle = shadow;
    ctx.filter = `blur(${Math.max(1, Math.round(r.w * 0.022))}px)`;
    ctx.beginPath(); ctx.ellipse(r.x + r.w / 2, r.y + r.h * contact, r.w * spread, r.h * 0.075, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.drawImage(img, b.x, b.y, b.w, b.h, r.x, r.y, r.w, r.h);
  return r;
}
/** Dish of width w with its top-left at (x, y) — for crops off the edge. */
export function dishAt(img, x, y, w) {
  if (!img) return null;
  const b = trimBox(img);
  return { x, y, w, h: w * b.h / b.w, b };
}
export const aspect = (img) => { const b = trimBox(img); return b ? b.w / b.h : 1.5; };

// ---- shapes --------------------------------------------------------------------------------------------------
export function circle(ctx, cx, cy, r, fill) { ctx.save(); ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
/** Run fn inside a rotation about (cx, cy). */
export function rotated(ctx, cx, cy, a, fn) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(a); fn(); ctx.restore(); }

/** Owner accent is green-ish (for alternate colourways). */
export function isGreen(accent) { const c = hsl(accent); return !!(c && c.s > 0.25 && c.h >= 80 && c.h <= 170); }
export function isYellow(accent) { const c = hsl(accent); return !!(c && c.s > 0.4 && c.h >= 40 && c.h < 80); }

/** Restaurant + deal fields, cleaned. */
export function readAll(data) {
  const d = read(data);
  const r = data.restaurant || {};
  d.address = String(r.address || '').trim();
  d.list = items(d.includes);
  return d;
}

/** Sentence-case a typed line: 'MEAL DEAL' → 'Meal deal'. Leaves mixed-case input alone. */
export function sentence(s) {
  const t = String(s || '').trim();
  if (!t) return t;
  if (t === t.toUpperCase() && /[A-Z]/.test(t)) { const l = t.toLowerCase(); return l[0].toUpperCase() + l.slice(1); }
  return t;
}
