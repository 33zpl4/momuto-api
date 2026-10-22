'use strict';
/**
 * ONE place that derives the delivery estimate of an order, used by every email and by the "My order" page.
 *
 * Why (22 Oct 2026, a customer's question "¿Cuál es la buena?"): three surfaces each did their own date maths.
 *   confirmation / day-4 / day-10 emails + "My order" page: payment date + 25–30 d (fast lane 18–23)
 *   shipped email:                                          ship date  + 10–15 d
 * An order that left late (paid 28 Sep, shipped 21 Oct) got "23–28 Oct" in the first email, kept "23–28 Oct" on the page
 * after shipping (the page never switched), and "31 Oct – 5 Nov" in the shipped email. All three were "right" by their own
 * rule and together contradicted each other.
 *
 * Rule now: before it ships the estimate is paid + 25–30 (fast lane 18–23); once the order has a ship date it is
 * ship date + 10–15 (rule 6: shipping 10–15 d) — the real clock beats the original promise — everywhere at once.
 * `first` is the original quote, so the shipped email and the page can say "this replaces <first>" instead of silently
 * showing a different date. (Fast lane keeps 10–15 after shipping: no owner figure for priority shipping alone.)
 */
const DAY = 86400000;
const SHIP_DAYS = [10, 15];

const asDate = v => { if (v == null || v === '') return null; const d = new Date(v); return isNaN(d) ? null : d; };
const plus = (d, n) => new Date(+d + n * DAY);
const isoDay = d => new Date(d).toISOString().slice(0, 10);

/** the original quote: payment date + 25–30 d (fast lane 18–23); null without a payment date */
function firstWindow(order) {
  const paid = asDate(order && order.paidAt);
  if (!paid) return null;
  const [a, b] = order.fastLane ? [18, 23] : [25, 30];
  return { from: plus(paid, a), to: plus(paid, b) };
}

/**
 * { from, to, basis: 'paid' | 'shipped', first, changed } with Dates; null if there is no usable base date.
 * `opts.shippedAt` lets the shipped email pass "now" when the record has no ship date yet.
 */
function deliveryEstimate(order, opts = {}) {
  const first = firstWindow(order);
  const shipped = asDate((opts && opts.shippedAt) || (order && order.shippedAt));
  if (shipped) {
    const from = plus(shipped, SHIP_DAYS[0]), to = plus(shipped, SHIP_DAYS[1]);
    const changed = !first || isoDay(first.from) !== isoDay(from) || isoDay(first.to) !== isoDay(to);
    return { from, to, basis: 'shipped', first, changed };
  }
  if (!first) return null;
  return { from: first.from, to: first.to, basis: 'paid', first, changed: false };
}

module.exports = { deliveryEstimate, firstWindow, isoDay, SHIP_DAYS };
