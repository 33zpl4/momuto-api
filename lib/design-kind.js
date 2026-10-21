'use strict';
/**
 * What a design (cart product) of a 3D-tool order contains, from its suit name. One order can hold several designs: a jersey
 * design AND a separate shorts design (the platform bills "Tu diseño personalizado 1 de 2 / 2 de 2"). Each design carries its
 * own roster, so summing every roster row as "jerseys" counts the shorts design's rows too.
 * Bug (21 Oct 2026, order oofxswi4sj, 13 jerseys + 12 shorts): the "My order" page read "25 camisetas · 12 pantalones",
 * the warehouse sheet warned "名单数量 25 与平台数量 13", and the roster backfill would have stored qty 25.
 *   'shorts' : a shorts-only design  (mamuto3shorts1, mamuto2shorts1, ...)   rows = shorts
 *   'socks'  : a socks-only design   (mamuto2socks1)                           rows = socks
 *   'jersey' : everything else, incl. kit suits (mamuto3suit1: one row = one jersey, shorts ride on the row)
 * Unknown suits stay 'jersey' (same default as lib/order-lines.js).
 */
function designKind(suit) {
  const s = String(suit || '').toLowerCase();
  if (/socks?\b|socks\d/.test(s)) return 'socks';
  if (/shorts/.test(s) && !/suit/.test(s)) return 'shorts';
  return 'jersey';
}

const qtyOf = p => Math.max(1, parseInt(p && p.qty, 10) || 1);
const rows = d => (d && Array.isArray(d.players) ? d.players : []).filter(Boolean);

/** roster units per kind: { jerseys, shorts, socks } over a designs[] list ({suit, players}) */
function rosterUnits(designs) {
  const u = { jerseys: 0, shorts: 0, socks: 0 };
  for (const d of designs || []) {
    const n = rows(d).reduce((a, p) => a + qtyOf(p), 0);
    const k = designKind(d && d.suit);
    if (k === 'shorts') u.shorts += n; else if (k === 'socks') u.socks += n; else u.jerseys += n;
  }
  return u;
}

module.exports = { designKind, rosterUnits };
