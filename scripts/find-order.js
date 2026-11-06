'use strict';

/**
 * READ-ONLY. Which store holds an order? Pages through GET /orders on every store and reports the stores whose
 * rows contain NEEDLE in any field (order number, local ref ...).
 *   NEEDLE=2026101933577829 STORES=EN,ES,FR,IT,US node scripts/find-order.js
 * Prints only non-personal facts (store, ids, status, dates, currency/total, line count, country); no emails, names or addresses.
 */
const HOST = process.env.OEMSAAS_HOST || 'https://openapi.oemapps.com';
const needle = String(process.env.NEEDLE || '').trim();
const stores = (process.env.STORES || 'EN,ES,FR,IT,US').split(',').map(s => s.trim()).filter(Boolean);
const MAX_PAGES = Number(process.env.MAX_PAGES || 25);
if (!needle) { console.error('NEEDLE required'); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function api(token, p) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(HOST + p, { headers: { token } });
    const j = JSON.parse(await res.text());
    if (j.code === 0 || j.code === 200) return j.data;
    if (!(j.code === 1000 || /Too many/i.test(j.msg || '')) || i === 3) throw new Error(`code ${j.code}: ${j.msg}`);
    await sleep(1500 * (i + 1));
  }
}
const rowsOf = d => (Array.isArray(d) ? d : (d && (d.orders || d.list || d.rows)) || []);
const pick = (o, ks) => { for (const k of ks) if (o[k] != null && o[k] !== '') return o[k]; return null; };
const hay = o => Object.values(o).some(v => (typeof v === 'string' || typeof v === 'number') && String(v).includes(needle));

(async () => {
  for (const st of stores) {
    const token = process.env['OEMSAAS_TOKEN_' + st];
    if (!token) { console.log(`== ${st}: no token, skipped`); continue; }
    let since = '', seen = 0, hit = null, oldest = null, newest = null, pages = 0, err = null;
    try {
      for (; pages < MAX_PAGES; pages++) {
        const rows = rowsOf(await api(token, `/orders?limit=200${since ? `&since_id=${since}` : ''}`));
        if (!rows.length) break;
        seen += rows.length;
        for (const o of rows) {
          const c = pick(o, ['created_at', 'create_time', 'createdAt']);
          if (c && (!oldest || String(c) < String(oldest))) oldest = c;
          if (c && (!newest || String(c) > String(newest))) newest = c;
          if (!hit && hay(o)) hit = o;
        }
        if (hit || rows.length < 200) break;
        const last = rows[rows.length - 1];
        const nid = last.id || last.order_id;
        if (!nid || String(nid) === String(since)) break;
        since = nid;
        await sleep(500);
      }
    } catch (e) { err = e.message; }
    console.log(`== ${st}: scanned ${seen} orders in ${pages + 1} page(s), created range ${oldest || '?'} .. ${newest || '?'}${err ? '  ERROR ' + err : ''}`);
    if (hit) {
      console.log(`   FOUND on ${st}`);
      for (const k of ['id', 'order_number', 'order_no', 'name', 'financial_status', 'fulfillment_status', 'status', 'created_at', 'pay_at', 'first_pay_at', 'currency', 'total_price', 'total', 'lang', 'source', 'country', 'shipping_country']) {
        if (hit[k] != null && typeof hit[k] !== 'object') console.log(`   ${k}: ${hit[k]}`);
      }
      // every numeric money field (subtotal, discounts, shipping, total ...): no personal data
      const money = Object.entries(hit).filter(([k, v]) => /price|total|discount|promot|coupon|rebate|shipping|tax|fee/i.test(k) && (typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v)))).map(([k, v]) => `${k}=${v}`);
      console.log(`   money: ${money.join(' ')}`);
      const items = hit.line_items || hit.items || hit.products;
      if (Array.isArray(items)) console.log(`   lines: ${items.length}`);
      // per line: product/variant ids, titles, image, custom properties (no personal data)
      if (Array.isArray(items)) items.forEach((it, i) => {
        const flat = Object.entries(it).filter(([k, v]) => v != null && typeof v !== 'object').map(([k, v]) => `${k}=${String(v).slice(0, 160)}`);
        console.log(`   line ${i + 1}: ${flat.join(' | ')}`);
        for (const [k, v] of Object.entries(it)) if (v && typeof v === 'object') console.log(`     ${k}: ${JSON.stringify(v).slice(0, 600)}`);
      });
    }
  }
})().catch(e => { console.error(e.message); process.exit(1); });
