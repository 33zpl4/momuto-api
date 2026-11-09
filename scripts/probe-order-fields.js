#!/usr/bin/env node
/**
 * Read-only: for ONE platform order, print every top-level KEY NAME and the VALUES of a whitelist of non-personal status fields. The full
 * order object holds the customer's name, address, phone and email, and Actions logs on this repo are public, so values are never dumped.
 *   STORE=es ORDER_ID=33635073 [PATHS=/orders/33635073/payments,...] node scripts/probe-order-fields.js
 * With PATHS: GET each path (read-only) and print only the code / msg and the key names of the answer, to learn which sub-routes exist.
 */
const STORE = (process.env.STORE || 'es').toUpperCase();
const token = process.env['OEMSAAS_TOKEN_' + STORE];
const ID = process.env.ORDER_ID;
const SAFE = ['id', 'order_number', 'financial_status', 'fulfillment_status', 'status', 'refund_status', 'payment_method', 'payment_type', 'purchase_type',
  'submit_type', 'pay_at', 'first_pay_at', 'created_at', 'updated_at', 'act_at', 'closed_at', 'cancelled_at', 'is_test', 'tags', 'total_price', 'current_total_price',
  'total_num', 'recart_mail_sended', 'coupon_id', 'current_coupon_price', 'current_promotion_price', 'current_shipping_price', 'utm_source', 'utm_medium'];
async function get(path) {
  const r = await fetch('https://openapi.oemapps.com' + path, { headers: { token } });
  const t = await r.text(); try { return JSON.parse(t); } catch { return { code: 'non-json', msg: t.slice(0, 80) }; }
}
(async () => {
  if (!token || !ID) throw new Error('need token and ORDER_ID');
  const j = await get(`/orders/${ID}`);
  console.log(`GET /orders/${ID}: code=${j.code} msg=${j.msg}`);
  const o = j.data || {};
  console.log('KEYS:', Object.keys(o).join(', '));
  for (const k of SAFE) if (k in o && (typeof o[k] !== 'object' || o[k] === null || Array.isArray(o[k]))) console.log(`  ${k} = ${JSON.stringify(o[k])}`);
  for (const k of Object.keys(o)) if (/pay|transaction|paid|gateway|stripe|offline/i.test(k) && !SAFE.includes(k)) console.log(`  [${k}] = ${typeof o[k] === 'object' ? 'object keys=' + Object.keys(o[k] || {}).join(',') : JSON.stringify(o[k]).slice(0, 80)}`);
  for (const p of (process.env.PATHS || '').split(',').map(s => s.trim()).filter(Boolean)) {
    const r = await get(p); const d = r.data;
    console.log(`GET ${p}: code=${r.code} msg=${String(r.msg).slice(0, 60)}${d && typeof d === 'object' ? ' keys=' + (Array.isArray(d) ? 'array(' + d.length + ') ' + Object.keys(d[0] || {}).join(',') : Object.keys(d).join(',')) : ''}`);
    await new Promise(x => setTimeout(x, 500));
  }
})().catch(e => { console.error(e.message); process.exit(1); });
