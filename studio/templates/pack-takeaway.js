// takeaway templates — export default an array of template modules (see lib.js for the contract).
// Classic takeaway: the loud 2010s high-street window looks some chicken shops still want (style 'Classic takeaway').
// The refreshed Meal Deal and Window Price moved to pack-modern-takeaway.js so they sit in the modern Takeaway row.
// Shared drawing helpers live in takeaway-kit.js (cap-height type fitting, trimmed dish cut-outs, price type, shapes).
import hotDeal from './takeaway-hot-deal.js';
import daySpecial from './takeaway-day-special.js';
const order = [hotDeal, daySpecial];
order.forEach((t, i) => { t.rank = 100 + i; });
export default order;
