'use strict';

/**
 * Poll the store platform for SHIPPED orders and send OUR "order shipped" email (lib/emails.js emailTracking, Resend).
 *
 * WHY (19 Oct 2026): the platform's own shipped email is generic, off-brand, English on ES/IT, and arrives on its own
 * schedule (its webhooks come in sweeps days late). The order API exposes the shipment the moment it is made in the CMS:
 * `fulfillments[]` {tracking_number, courier_id, courier_code, note, created_at} (probe of order 231549-2026026, 19 Oct).
 * This job reads it hourly and calls admin-orders `ship`, which sends one branded email per order (deduped server side) and,
 * for 3D orders, marks the record shipped so the My order page shows the tracking and the day-4/day-10 mails stop.
 *
 *   node scripts/poll-shipped-orders.js [--lang all|en|us|es|fr|it] [--live]     (default = DRY RUN: asks the endpoint to render, sends nothing)
 *
 * Env: OEMSAAS_TOKEN_EN/_ES/_FR/_IT/_US; MOMUTO_API_SECRET (= Vercel D3_ORDER_SECRET; missing = "not armed", exit 0).
 *      SHIP_NOT_BEFORE (ISO): shipments created before this instant are never emailed (default = go-live, 19 Oct 2026 06:30 UTC: earlier shipments already got the platform email).
 * Runs on the GitHub runner; the sandbox cannot reach openapi.oemapps.com. Docs: docs/shipped-email.md.
 */
const { describeFulfillment } = require('../lib/carriers');

const HOST = 'https://openapi.oemapps.com';
const API = 'https://momuto-api.vercel.app/api/admin-orders';
const SECRET = process.env.MOMUTO_API_SECRET;
const NOT_BEFORE_MS = Date.parse(process.env.SHIP_NOT_BEFORE || '2026-10-19T06:30:00Z');
const WINDOW_DAYS = 60;
const LIST_LIMIT = 50;
const STORES = { en: 'OEMSAAS_TOKEN_EN', es: 'OEMSAAS_TOKEN_ES', fr: 'OEMSAAS_TOKEN_FR', it: 'OEMSAAS_TOKEN_IT', us: 'OEMSAAS_TOKEN_US' };

const sleep = ms => new Promise(r => setTimeout(r, ms));
const field = (o, names) => { for (const n of names) if (o && o[n] !== undefined && o[n] !== null && o[n] !== '') return o[n]; return null; };
const mask = e => String(e).replace(/^(.).*(@.*)$/, '$1***$2');
const ms = v => { const n = parseInt(v, 10); return !n ? 0 : n > 1e12 ? n : n * 1000; };

async function platform(pathname, token, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${HOST}${pathname}`, { headers: { token } });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { throw new Error(`HTTP ${res.status} non-JSON: ${text.slice(0, 200)}`); }
    if (json.code === 0 || json.code === 200) return json.data;
    if (!(json.code === 1000 || /Too many/i.test(json.msg || '')) || i === tries - 1) throw new Error(`API code ${json.code}: ${json.msg}`);
    await sleep(1500 * (i + 1));
  }
}

// the local 3D ref from the €0 preview line (same join key as poll-paid-orders.js)
function previewRef(item) {
  try { const j = JSON.parse(field(item, ['inner_title']) || ''); if (j && j.type === '3d-preview' && j.order_no) return String(j.order_no); } catch { /* not JSON */ }
  const m = /—\s*order\s+([a-z0-9]+)/i.exec(String(field(item, ['product_title', 'title', 'name']) || ''));
  return m ? m[1] : null;
}

async function ship(payload) {
  const res = await fetch(API, { method: 'POST', headers: { 'x-webhook-secret': SECRET, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function main() {
  const a = process.argv.slice(2);
  const live = a.includes('--live');
  const lang = a.includes('--lang') ? a[a.indexOf('--lang') + 1] : 'all';
  const langs = lang === 'all' ? Object.keys(STORES) : [lang];
  const report = { sent: [], dry: [], already: [], notShipped: 0, errors: [] };
  if (!SECRET) { console.log('MOMUTO_API_SECRET not set — shipped poller not armed, nothing to do.'); return; }
  console.log(live ? 'LIVE: shipped emails will be sent' : 'DRY RUN: the endpoint renders each email, nothing is sent or stored');

  for (const l of langs) {
    const token = process.env[STORES[l]];
    if (!token) { report.errors.push(`${l}: missing ${STORES[l]}`); continue; }
    console.log(`\n=== ${l.toUpperCase()} ===`);
    let list;
    try { const d = await platform(`/orders?limit=${LIST_LIMIT}`, token); list = Array.isArray(d) ? d : (d && (d.orders || d.list || d.rows)); }
    catch (e) { report.errors.push(`${l}: orders list failed — ${e.message}`); continue; }
    if (!Array.isArray(list)) { report.errors.push(`${l}: unrecognised orders payload`); continue; }

    for (const row of list) {
      const no = String(field(row, ['order_number', '_id', 'id']) || '');
      try {
        // cheap pre-filter on the list row: paid, recent, and showing a ship time (delivery_at) or fulfilled status (320)
        const created = ms(field(row, ['created_at', 'pay_at']));
        const shipHint = ms(row.delivery_at) >= NOT_BEFORE_MS || parseInt(row.fulfillment_status, 10) === 320;
        if (parseInt(row.financial_status, 10) !== 230 || !shipHint || (created && Date.now() - created > WINDOW_DAYS * 86400000)) { report.notShipped++; continue; }

        await sleep(600);
        const o = await platform(`/orders/${field(row, ['id', 'order_id'])}`, token);
        const fs = (o.fulfillments || []).filter(f => f && String(f.tracking_number || '').trim() && ms(f.created_at) >= NOT_BEFORE_MS);
        if (!fs.length) { report.notShipped++; continue; }
        const f = fs[0];                                   // partial shipments: the first one carries the email
        const { carrier, trackingUrl } = describeFulfillment(f);
        const ref = (o.products || []).map(previewRef).find(Boolean) || null;
        const payload = {
          action: 'ship', dry: !live, order_no: ref, plant_order_no: String(o.order_number || no),
          email: o.customer_email, name: (o.customer_name || '').trim() ? String(o.customer_name).replace(/\b\w/g, c => c.toUpperCase()).split(' ')[0] : 'Coach',
          lang: l, currency: o.currency_code, tracking_number: String(f.tracking_number).trim(), tracking_url: trackingUrl, carrier,
          shipped_at: new Date(ms(f.created_at)).toISOString(),
          // the delivery window is counted from the payment date (owner 27 Oct 2026), also for store orders with no local record
          ...(created ? { paid_at: new Date(created).toISOString() } : {}),
        };
        if (!payload.email) { report.errors.push(`${l}:${no}: shipped but no customer email`); continue; }
        const r = await ship(payload);
        if (r.status !== 200) { report.errors.push(`${l}:${no}: ship ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`); continue; }
        if (r.json.already) { report.already.push(`${l}:${no}`); continue; }
        const line = `${l}:${no} -> ${mask(payload.email)} carrier=${carrier || '?'} link=${trackingUrl ? 'yes' : 'no'} record=${!!r.json.record}${r.json.dry ? ` subject="${r.json.subject}" myOrderLink=${r.json.viewLink}` : ''}`;
        console.log((live ? 'SENT ' : 'WOULD SEND ') + line);
        (live ? report.sent : report.dry).push(`${l}:${no}`);
      } catch (e) { report.errors.push(`${l}:${no}: ${e.message}`); }
    }
  }
  console.log('\n=== SUMMARY ===\n' + JSON.stringify(report, null, 2));
  if (report.errors.length) process.exit(1);
}
main().catch(e => { console.error(e); process.exit(1); });
