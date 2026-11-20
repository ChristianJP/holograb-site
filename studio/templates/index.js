// holograb poster template registry. Add a new template = add a module to a pack and list it there.
// Packs keep teams from editing the same file: pack-takeaway.js, pack-cafe.js, pack-minimal.js (+ future packs).
import modernTakeaway from './pack-modern-takeaway.js';
import modernCafe from './pack-modern-cafe.js';
import takeaway from './pack-takeaway.js';
import cafe from './pack-cafe.js';
import minimal from './pack-minimal.js';
export { FORMATS } from './lib.js';
// Modern (2026 UK) packs first so they lead the gallery; classic packs after.
const ORDER = ['window-price', 'big-type', 'editorial', 'late-night', 'tape', 'meal-deal', 'fresh-bright', 'podium',
  'minimal-hero', 'minimal-hero-cream', 'caff', 'menu-board', 'the-sum', 'two-tone', 'minimal-specimen', 'minimal-card',
  'hot-deal', 'day-special', 'breakfast', 'chalkboard'];   // critic's order (2026 UK look first, Classic last); new ids go after
const rank = (t) => { const i = ORDER.indexOf(t.id); return i < 0 ? ORDER.length : i; };
export const TEMPLATES = [...modernTakeaway, ...modernCafe, ...takeaway, ...cafe, ...minimal]
  .map((t, i) => [t, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([t]) => t);
export const STYLES = [...new Set(TEMPLATES.map((t) => t.style))];
export const byId = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
