'use strict';
/**
 * "Mi pedido" — the customer-facing order page for 3D-tool orders (30 Sep 2026).
 * Shared by api/order-view.js (the read endpoint), lib/emails.js (the link in every
 * lifecycle email) and the tests. Pure functions only: no network, no KV.
 * Docs: docs/order-view.md.
 */
const crypto = require('crypto');

// One page per store, on the store's own domain. US shares the English UI but is its own store.
const STORES = {
  en: { host: 'https://www.momuto.com', handle: 'my-order' },
  us: { host: 'https://us.momuto.com', handle: 'my-order' },
  es: { host: 'https://es.momuto.com', handle: 'mi-pedido' },
  fr: { host: 'https://fr.momuto.com', handle: 'mon-commande' },
  it: { host: 'https://it.momuto.com', handle: 'il-mio-ordine' },
};
const PAGE_HANDLES = [...new Set(Object.values(STORES).map(s => s.handle))];
const REF_RE = /^[a-z0-9]{6,16}$/i;
const VISIBLE_STATUSES = ['active', 'shipped', 'delivered'];   // never test / backfill / excluded records

// ---- access token: an HMAC of the order ref. The link in our emails carries it, so the
// customer opens the page with one click; without it the page asks for ref + email.
function secret() {
  return process.env.ORDER_VIEW_SECRET || process.env.D3_ORDER_SECRET || process.env.ADMIN_TOKEN || '';
}
function viewToken(ref) {
  const s = secret();
  if (!s || !ref) return null;
  return crypto.createHmac('sha256', s).update('order-view:' + String(ref).toLowerCase()).digest('hex').slice(0, 32);
}
function tokenOk(ref, k) {
  const t = viewToken(ref);
  if (!t || typeof k !== 'string' || k.length !== t.length) return false;
  return crypto.timingSafeEqual(Buffer.from(t), Buffer.from(k));
}

function storeKey(order) {
  if (String(order && order.currency || '').toUpperCase() === 'USD') return 'us';
  return STORES[order && order.lang] ? order.lang : 'en';
}
function is3D(order) {
  return !!order && String(order.id || '').startsWith('3d_') && REF_RE.test(String(order.ref || ''));
}
/** The page link for an order's emails, or null (non-3D orders have no page). */
function viewUrl(order) {
  if (!is3D(order)) return null;
  const st = STORES[storeKey(order)];
  const k = viewToken(order.ref);
  return `${st.host}/pages/${st.handle}?ref=${encodeURIComponent(order.ref)}${k ? '&k=' + k : ''}`;
}

// ---- roster
const httpsUrl = (u, host) => {
  if (!u) return null;
  const s = String(u);
  if (/^https:\/\//i.test(s)) return s;
  if (/^\//.test(s) && host) return host + s;
  return null;
};

/**
 * One roster row as the design server / webhook delivers it, sizes carrying suffixes:
 * "M · LONG · SHORTS L", "L · JERSEY ONLY", "XL · POLO". Returns a clean row.
 * shorts: 'size' (explicit) | 'none' (jersey only) | 'plain' (not stated — see resolveShorts)
 */
function normalisePlayer(p) {
  const raw = String(p && p.size || '');
  const parts = raw.split(' · ').map(s => s.trim()).filter(Boolean);
  const size = parts[0] || '';
  const sleeve = (p && p.sleeve === 'long') || parts.some(s => /^long$/i.test(s)) ? 'long' : 'short';
  let shortsSize = (p && p.shortSize) || (parts.find(s => /^SHORTS /i.test(s)) || '').replace(/^SHORTS /i, '');
  const jerseyOnly = !!(p && p.noShorts === true) || parts.some(s => /^JERSEY ONLY$/i.test(s));
  const collar = !!(p && p.collar === true) || parts.some(s => /^POLO$/i.test(s));
  return {
    number: String(p && p.number != null ? p.number : '').slice(0, 4),
    name: String(p && p.name != null ? p.name : '').slice(0, 40),
    size: size.slice(0, 12),
    sleeve,
    collar,
    shorts: jerseyOnly ? 'none' : (shortsSize ? 'size' : 'plain'),
    shortsSize: jerseyOnly ? '' : String(shortsSize || '').slice(0, 12),
    qty: Math.max(1, parseInt(p && p.qty, 10) || 1),
  };
}

/**
 * A plain size ("XL") does not say whether the player also has shorts: a kit design gives them a
 * same-size pair, a jersey-only design gives none. The ORDER's billed shorts total settles it:
 *   need = totalShorts - (players with an explicit shorts size)
 * all plain players have shorts if need == sum(plain), none if need == 0, otherwise the set of
 * designs whose plain-player counts add up to `need` (every design is one or the other). Only a
 * UNIQUE answer is used; anything else leaves plain rows unresolved (shown without a shorts claim).
 * Mutates the rows: plain -> 'same' (= jersey size) | 'none' | stays 'plain'.
 */
function resolveShorts(designs, totalShorts) {
  const total = parseInt(totalShorts, 10);
  const plainOf = d => d.players.filter(p => p.shorts === 'plain').reduce((n, p) => n + p.qty, 0);
  const explicit = designs.reduce((n, d) => n + d.players.filter(p => p.shorts === 'size').reduce((m, p) => m + p.qty, 0), 0);
  const counts = designs.map(plainOf);
  const allPlain = counts.reduce((a, b) => a + b, 0);
  if (!allPlain) return { resolved: true };
  if (!Number.isFinite(total) || total < 0) return { resolved: false };
  const need = total - explicit;
  if (need < 0 || need > allPlain) return { resolved: false };
  let yes = null;
  if (need === allPlain) yes = counts.map((c, i) => c > 0);
  else if (need === 0) yes = counts.map(() => false);
  else {
    const idx = counts.map((c, i) => i).filter(i => counts[i] > 0);
    const hits = [];
    for (let mask = 1; mask < (1 << idx.length); mask++) {
      let s = 0;
      idx.forEach((i, b) => { if (mask & (1 << b)) s += counts[i]; });
      if (s === need) hits.push(mask);
    }
    if (hits.length === 1) yes = counts.map(() => false), idx.forEach((i, b) => { if (hits[0] & (1 << b)) yes[i] = true; });
  }
  if (!yes) return { resolved: false };
  designs.forEach((d, i) => d.players.forEach(p => { if (p.shorts === 'plain') p.shorts = yes[i] ? 'same' : 'none'; }));
  return { resolved: true };
}

// ---- status
const DAY = 86400000;
function isoDay(d) { return new Date(d).toISOString().slice(0, 10); }
/** Door-to-door window from payment (rule 6): 25-30 days, 18-23 with fast lane. */
function deliveryWindowISO(order) {
  const paid = new Date(order.paidAt);
  if (isNaN(paid)) return null;
  const [a, b] = order.fastLane ? [18, 23] : [25, 30];
  return { from: isoDay(+paid + a * DAY), to: isoDay(+paid + b * DAY), fastLane: !!order.fastLane };
}
/** paid -> production -> shipped -> delivered; `current` is the last reached. */
function buildStatus(order, now = new Date()) {
  const sent = order.emailsSent || [];
  const paid = new Date(order.paidAt);
  const days = isNaN(paid) ? 0 : Math.floor((+now - +paid) / DAY);
  const delivered = order.status === 'delivered' || sent.includes('delivered');
  const shipped = delivered || order.status === 'shipped' || !!order.trackingNumber;
  const production = shipped || days >= 4 || sent.includes('day4');
  const steps = [
    { key: 'paid', done: true, date: isNaN(paid) ? null : isoDay(paid) },
    { key: 'production', done: production, date: null },
    { key: 'shipped', done: shipped, date: order.shippedAt ? isoDay(order.shippedAt) : null },
    { key: 'delivered', done: delivered, date: order.deliveredAt ? isoDay(order.deliveredAt) : null },
  ];
  const current = delivered ? 'delivered' : shipped ? 'shipped' : production ? 'production' : 'paid';
  steps.forEach(s => { s.current = s.key === current; });
  return { current, steps, window: deliveryWindowISO(order) };
}

/** Everything the page may show. A WHITELIST: no email, address, phone or amounts. */
function publicOrder(order, designsIn, now = new Date()) {
  const host = 'https://design.momuto.com';
  const designs = (designsIn || []).map(d => ({
    front: httpsUrl(d.front, host),
    back: httpsUrl(d.back, host),
    players: (d.players || []).map(normalisePlayer),
  }));
  const extras = order.extras || {};
  const shortsInfo = resolveShorts(designs, extras.shorts);
  const all = designs.flatMap(d => d.players);
  const sum = f => all.filter(f).reduce((n, p) => n + p.qty, 0);
  const jerseys = sum(() => true);
  const status = buildStatus(order, now);
  const delivered = status.current === 'delivered' || status.current === 'shipped';
  return {
    ref: String(order.ref),
    storeOrderNo: order.plantOrderNo ? String(order.plantOrderNo) : null,
    lang: STORES[order.lang] ? order.lang : 'en',
    store: storeKey(order),
    firstName: String(order.name || '').trim().split(/\s+/)[0].slice(0, 30),
    fastLane: !!order.fastLane,
    status,
    tracking: (delivered || order.trackingNumber) && order.trackingNumber
      ? { number: String(order.trackingNumber).slice(0, 60), url: /^https:\/\//i.test(order.trackingUrl || '') ? String(order.trackingUrl) : null }
      : null,
    designs,
    totals: {
      jerseys,
      shorts: shortsInfo.resolved ? sum(p => p.shorts === 'size' || p.shorts === 'same') : (Number.isFinite(parseInt(extras.shorts, 10)) ? parseInt(extras.shorts, 10) : null),
      longSleeves: sum(p => p.sleeve === 'long'),
      collars: sum(p => p.collar),
    },
    shortsResolved: shortsInfo.resolved,
    rosterPending: jerseys === 0,
    helpEmail: 'info@momuto.com',
  };
}

module.exports = { STORES, PAGE_HANDLES, REF_RE, VISIBLE_STATUSES, viewToken, tokenOk, viewUrl, storeKey, is3D,
  normalisePlayer, resolveShorts, buildStatus, deliveryWindowISO, publicOrder, httpsUrl };
