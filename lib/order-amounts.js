'use strict';

/**
 * What the customer actually paid, from a platform order row.
 *
 * The platform keeps two totals: `current_total_price` is BEFORE promotions (it equals `current_subtotal_price` plus
 * shipping/tax) and `total_price` is the charged amount after `current_promotion_price` / `current_coupon_price`.
 * Real order 2026110133580840 (3 Nov 2026): subtotal 2173.50, promotion -1173.69, current_total 2173.50, total_price 999.81.
 * The warehouse email printed 2173.50 because it read `current_total_price` first.
 *
 * Returns strings with 2 decimals: { paid, gross, off } where off is the discount amount (positive) or '0.00'.
 */
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const first = (o, keys) => { for (const k of keys) { const n = num(o && o[k]); if (n !== null) return n; } return null; };

function orderAmounts(o) {
  const subtotal = first(o, ['current_subtotal_price', 'subtotal_price']);
  const ship = first(o, ['current_shipping_price', 'shipping_price']) || 0;
  const currentTotal = first(o, ['current_total_price']);
  const gross = currentTotal !== null ? currentTotal : (subtotal !== null ? subtotal + ship : null);
  const off = Math.abs(first(o, ['current_promotion_price']) || 0) + Math.abs(first(o, ['current_coupon_price']) || 0);
  let paid = first(o, ['total_price', 'total']);
  if (paid === null && gross !== null) paid = gross - off;
  const f = n => (n === null ? '' : n.toFixed(2));
  return { paid: f(paid), gross: f(gross), off: off > 0.004 ? off.toFixed(2) : '0.00' };
}

/** "999.81 USD（折扣前 2173.50，优惠 -1173.69）" — the paid amount first, the discount only when there is one. */
function amountText(o, currency) {
  const a = orderAmounts(o);
  const cur = currency ? ` ${currency}` : '';
  return `${a.paid}${cur}` + (a.off !== '0.00' && a.gross ? `（折扣前 ${a.gross}，优惠 -${a.off}）` : '');
}

module.exports = { orderAmounts, amountText };
