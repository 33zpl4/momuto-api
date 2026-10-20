'use strict';
/**
 * READ-ONLY. Shows where the platform exposes fulfillment / tracking on ONE shipped order, so a "poll shipped orders" job can be written against the real shape.
 *   ORDER_NO=231549-2026026 PROBE_LANG=us node scripts/probe-order-shipping.js
 * Finds the order in GET /orders (matching any field equal to ORDER_NO), re-reads GET /orders/{id}, prints the key tree with values.
 * Masked in the log (public repo runs): emails, phones, street/name fields are dropped; tracking numbers show first 3 + last 2 characters.
 */
const HOST = process.env.OEMSAAS_HOST || 'https://openapi.oemapps.com';
const lang = (process.env.PROBE_LANG || 'us').toUpperCase();
const token = process.env['OEMSAAS_TOKEN_' + lang];
const want = process.env.ORDER_NO || '231549-2026026';
if (!token) { console.log('no token for ' + lang); process.exit(0); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function api(p) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(HOST + p, { headers: { token } });
    const j = JSON.parse(await res.text());
    if (j.code === 0 || j.code === 200) return j.data;
    if (!(j.code === 1000 || /Too many/i.test(j.msg || '')) || i === 3) throw new Error(`code ${j.code}: ${j.msg}`);
    await sleep(1500 * (i + 1));
  }
}
const DROP = /(email|phone|mobile|tel|address|name|street|city|zip|postal|province|company|ip$)/i;
const TRACK = /(track|waybill|logistic|express|number|no$)/i;
function mask(k, v) {
  if (typeof v !== 'string') return v;
  if (v.includes('@')) return '<email>';
  if (TRACK.test(k) && /^[A-Za-z0-9]{8,}$/.test(v)) return v.slice(0, 3) + '…' + v.slice(-2) + ` (len ${v.length})`;
  return v.length > 120 ? v.slice(0, 120) + '…' : v;
}
function walk(o, k = '', depth = 0, out = []) {
  const pad = '  '.repeat(depth);
  if (Array.isArray(o)) { out.push(`${pad}${k}: [${o.length}]`); o.slice(0, 2).forEach((x, i) => walk(x, `[${i}]`, depth + 1, out)); }
  else if (o && typeof o === 'object') { out.push(`${pad}${k}:`); Object.keys(o).forEach(c => (depth > 0 && DROP.test(c) && !/^(shipping_?(method|name)|logistics_?name|carrier|express_?name)$/i.test(c)) ? out.push(`${pad}  ${c}: <dropped>`) : walk(o[c], c, depth + 1, out)); }
  else out.push(`${pad}${k}: ${JSON.stringify(mask(k, o))}`);
  return out;
}
(async () => {
  const list = await api('/orders?limit=50');
  const rows = Array.isArray(list) ? list : (list.orders || list.list || list.rows || []);
  console.log(`list rows: ${rows.length}; list-row keys: ${rows[0] ? Object.keys(rows[0]).join(',') : '-'}`);
  const hit = rows.find(o => Object.values(o).some(v => String(v) === want || String(v).includes(want)));
  if (!hit) { console.log('order ' + want + ' not in the latest 50. order numbers seen: ' + rows.slice(0, 10).map(o => o.order_no || o.name || o.id).join(', ')); return; }
  const id = hit.id || hit.order_id;
  console.log('matched; id field present: ' + !!id);
  console.log('--- LIST ROW ---\n' + walk(hit, 'row').join('\n'));
  await sleep(700);
  const det = await api('/orders/' + id);
  console.log('--- DETAIL ---\n' + walk(det, 'detail').join('\n'));
})().catch(e => { console.error(e.message); process.exit(1); });
