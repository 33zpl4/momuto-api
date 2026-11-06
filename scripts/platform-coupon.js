'use strict';
/**
 * Platform coupons over the OEMSaaS open API (docs/oemsaas-api-notes.md). Shape read from GET /coupons on ES, 6 Nov 2026:
 *   { id, coupon_name, coupon_code, product_range: 0 (whole store), starts_at, ends_at (unix | -1), usage_limit (-1 = none),
 *     param: { condition: {type: 0, value: 0}, discount: {type: 1 = percent | 2 = fixed, value}, product_ids: [], ends_at },
 *     times_used, status (2 active, 3 ended) }
 * The WRITE shape (POST /coupons, DELETE /coupons/{id}) is a guess from that read until scripts/probe-coupon-write.js has
 * run live once — see docs/lifecycle-emails.md for the verified result.
 */
const HOST = 'https://openapi.oemapps.com';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(method, pathname, token, body, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${HOST}${pathname}`, { method, headers: { token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { throw new Error(`HTTP ${res.status} non-JSON: ${text.slice(0, 200)}`); }
    if (json.code === 0 || json.code === 200) return json.data;
    const throttled = json.code === 1000 || /Too many/i.test(json.msg || '');
    if (!throttled || i === tries - 1) throw new Error(`API code ${json.code}: ${json.msg} (${method} ${pathname})`);
    await sleep(1500 * (i + 1));
  }
}
const rows = d => (Array.isArray(d) ? d : (d && (d.list || d.coupons || d.rows)) || []);

/** Find a coupon by code (exact, case-insensitive) in the first pages of the list; null when absent. */
async function findCoupon(token, code) {
  const want = String(code).toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const d = await api('GET', `/coupons?limit=250&page=${page}`, token);
    const list = rows(d);
    const hit = list.find(c => String(c.coupon_code || '').toLowerCase() === want);
    if (hit) return hit;
    if (list.length < 250) return null;
    await sleep(400);
  }
  return null;
}

/** Payload for a percent-off, whole-store, single-use coupon valid from now for `days`. */
function percentCoupon({ code, name, percent, days, usageLimit = 1 }) {
  const now = Math.floor(Date.now() / 1000);
  const ends = now + days * 86400;
  const endsStr = new Date(ends * 1000).toISOString().replace('T', ' ').slice(0, 19);
  return {
    coupon_name: name || code, coupon_code: code, product_range: 0,
    starts_at: now, ends_at: ends, usage_limit: usageLimit, status: 2,
    param: { condition: { type: 0, value: 0 }, discount: { type: 1, value: percent }, product_ids: [], ends_at: endsStr, sort_by: 'created-descending' },
  };
}

const createCoupon = (token, payload) => api('POST', '/coupons', token, payload);
const deleteCoupon = (token, id) => api('DELETE', `/coupons/${id}`, token);
const getCoupon = (token, id) => api('GET', `/coupons/${id}`, token);

module.exports = { api, findCoupon, percentCoupon, createCoupon, deleteCoupon, getCoupon, rows };
