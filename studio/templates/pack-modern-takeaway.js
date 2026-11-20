// modern-takeaway templates (2026 UK look) — export default an array of template modules (contract: lib.js).
// Flat colour, huge tight grotesques, mono micrographics, typographic prices; shared helpers in mt-kit.js.
// Gallery order = array order (the studio groups by `style`, then keeps registry order): the strongest window posters
// lead the Takeaway row. `rank` mirrors it so a future gallery sort can use it explicitly.
// The refreshed Meal Deal and Window Price live here (style 'Takeaway'); the untouched classics stay in pack-takeaway.js.
import bigType from './mt-big-type.js';
import windowPrice from './takeaway-window-price.js';
import lateNight from './mt-late-night.js';
import theSum from './mt-the-sum.js';
import tape from './mt-tape.js';
import mealDeal from './takeaway-meal-deal.js';
const order = [bigType, windowPrice, lateNight, theSum, tape, mealDeal];
order.forEach((t, i) => { t.rank = i + 1; });
export default order;
