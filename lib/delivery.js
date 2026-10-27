'use strict';
/**
 * ONE place that derives the delivery estimate of an order, used by every email and by the "My order" page.
 *
 * Rule (owner, 27 Oct 2026): the estimate is ALWAYS counted from the PAYMENT date — payment + 25–30 d (fast lane 18–23) — and never moves when the
 * order ships. Shipments are often made on the usual dates and only recorded in the CMS a couple of days later, so a window counted from the date
 * we typed the tracking number would promise customers a later arrival than the one they will really get.
 * (22 Oct 2026 had made it ship date + 10–15 d after shipping so the confirmation and shipped emails would not contradict each other; the owner
 * reversed that: one window, from the order date, on every surface.)
 */
const DAY = 86400000;

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
 * { from, to, basis: 'paid', first, changed: false } with Dates; null if there is no payment date.
 * (`first` and `changed` stay for callers written when the window could move after shipping; it no longer does. `opts` is ignored.)
 */
function deliveryEstimate(order, opts = {}) {
  const first = firstWindow(order);
  if (!first) return null;
  return { from: first.from, to: first.to, basis: 'paid', first, changed: false };
}

module.exports = { deliveryEstimate, firstWindow, isoDay };
