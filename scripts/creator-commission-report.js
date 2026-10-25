'use strict';

/**
 * creator-commission-report.js — orders and commission per creator code. READ-ONLY (writes nothing to any store).
 *
 * Why: the creator program (docs/creator-program.md) pays a creator 5 % of the order (after the discount, shipping
 * excluded) on DELIVERED, non-refunded orders placed with their personal coupon code. The platform's orders surface is only
 * partly verified, so the code is found by searching the whole order object for the coupon code (whatever field it lives in)
 * and every other field is read through candidate names. `--probe` prints the raw shape of the orders that carry a code
 * so the field names can be pinned down after the first real test order.
 *
 * Usage (runs on the GitHub runner — the sandbox cannot reach openapi.oemapps.com):
 *   node scripts/creator-commission-report.js [--days 60] [--code CODE] [--probe]
 * Env: OEMSAAS_TOKEN_EN/ES/FR/IT/US. Config: creators/creators.json. Output: console + $GITHUB_STEP_SUMMARY.
 *
 * Rules applied (docs/creator-program.md): payable = paid AND not cancelled AND not refunded AND delivered.
 * If the delivered state cannot be read from the order it is reported as "paid — confirm delivery", never as payable.
 * An order dated outside the creator's start/end window is listed but not counted.
 */
const fs = require('fs');
const path = require('path');

const HOST = 'https://openapi.oemapps.com';
const STORES = { en: 'OEMSAAS_TOKEN_EN', es: 'OEMSAAS_TOKEN_ES', fr: 'OEMSAAS_TOKEN_FR', it: 'OEMSAAS_TOKEN_IT', us: 'OEMSAAS_TOKEN_US' };
const PAGE = 50, MAX_PAGES = 40;

const args = { days: 60, code: null, probe: false };
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i];
  if (k === '--days') args.days = parseInt(process.argv[++i], 10) || 60;
  else if (k === '--code') args.code = String(process.argv[++i] || '').trim();
  else if (k === '--probe') args.probe = true;
  else { console.error(`Unknown argument ${k}`); process.exit(1); }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function platform(pathname, token, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${HOST}${pathname}`, { headers: { token } });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { throw new Error(`HTTP ${res.status} non-JSON: ${text.slice(0, 160)}`); }
    if (json.code === 0 || json.code === 200) return json.data;
    const throttled = json.code === 1000 || /Too many/i.test(json.msg || '');
    if (!throttled || i === tries - 1) throw new Error(`API code ${json.code}: ${json.msg}`);   // a failed read must throw, never look like "no orders"
    await sleep(1500 * (i + 1));
  }
}
const field = (o, names) => { for (const n of names) if (o && o[n] !== undefined && o[n] !== null && o[n] !== '') return o[n]; return null; };
const asList = (d) => Array.isArray(d) ? d : (d && (d.orders || d.list || d.rows || d.data)) || null;
const num = (v) => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? null : n; };
function toMillis(v) { if (!v) return 0; const n = parseInt(v, 10); if (n > 1e12) return n; if (n > 1e9) return n * 1000; const t = Date.parse(v); return isNaN(t) ? 0 : t; }
const day = (ms) => ms ? new Date(ms).toISOString().slice(0, 10) : '';

async function fetchRecent(token, days) {
  const cutoff = Date.now() - days * 86400000; const out = []; let lastFirst = null;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await platform(`/orders?limit=${PAGE}&page=${page}`, token);
    const list = asList(data);
    if (!list) throw new Error(`unrecognised orders payload — keys ${data && typeof data === 'object' ? Object.keys(data).join(',') : typeof data}`);
    if (!list.length) break;
    const firstId = field(list[0], ['id']);
    if (page > 1 && firstId && firstId === lastFirst) break;          // `page` not honoured: same page again
    lastFirst = firstId;
    let older = 0;
    for (const o of list) { const c = toMillis(field(o, ['created_at', 'create_time', 'createdAt'])); if (c && c < cutoff) { older++; continue; } out.push(o); }
    if (older === list.length || list.length < PAGE) break;
    await sleep(400);
  }
  return out;
}

// --- classification (field names are candidates; see the module header) ---
const hasCode = (o, code) => new RegExp(`(^|[^A-Za-z0-9])${code.replace(/[^A-Za-z0-9]/g, '\\$&')}([^A-Za-z0-9]|$)`, 'i').test(JSON.stringify(o));
function state(o) {
  const st = field(o, ['status', 'order_status']), fs_ = field(o, ['financial_status']);
  const cancelled = parseInt(st, 10) === 190 || /cancel/i.test(String(st));
  const refunded = /refund/i.test(String(fs_)) || /refund/i.test(String(st)) || num(field(o, ['refund_price', 'refunded_amount', 'total_refund'])) > 0;
  const paid = parseInt(fs_, 10) === 230 || /paid/i.test(String(fs_)) || toMillis(field(o, ['first_pay_at', 'pay_at', 'paid_at'])) > 0;
  const ful = String(field(o, ['fulfillment_status', 'shipping_status', 'delivery_status', 'logistics_status']) || '');
  const delivered = /deliver|complete|finish|received/i.test(ful) || /deliver|complete/i.test(String(st)) ? true : (ful ? false : null);   // null = cannot tell
  return { cancelled, refunded, paid, delivered, raw: `status=${st} fin=${fs_} ful=${ful || '-'}` };
}
function money(o) {
  const total = num(field(o, ['total_price', 'current_total_price', 'pay_price', 'total']));
  const ship = num(field(o, ['shipping_price', 'shipping_fee', 'freight', 'total_shipping_price', 'shipping_cost']));
  const discount = num(field(o, ['discount_price', 'total_discounts', 'discount_amount', 'coupon_price']));
  return { total, ship, discount, base: total === null ? null : Math.max(0, total - (ship || 0)), shipKnown: ship !== null };
}

async function main() {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'creators', 'creators.json'), 'utf8'));
  let creators = (cfg.creators || []).filter(c => c.active !== false);
  if (args.code) creators = [{ code: args.code, name: args.code, stores: Object.keys(STORES), rate: 0.05, active: true }];
  if (!creators.length) { console.log('No active creators in creators/creators.json (set active:true, or pass --code).'); return; }

  const stores = [...new Set(creators.flatMap(c => c.stores || ['us']))];
  const orders = {};
  for (const s of stores) {
    const token = process.env[STORES[s]];
    if (!token) { console.warn(`⚠️  no token for ${s} — skipped`); continue; }
    orders[s] = await fetchRecent(token, args.days);
    console.log(`${s}: ${orders[s].length} orders in the last ${args.days} days`);
  }

  let md = `# Creator commission report — last ${args.days} days\n`;
  for (const c of creators) {
    const rate = c.rate ?? 0.05, from = c.start ? Date.parse(c.start) : 0, to = c.end ? Date.parse(c.end) + 86400000 : Infinity;
    const rows = [];
    for (const s of c.stores || ['us']) for (const o of (orders[s] || [])) if (hasCode(o, c.code)) rows.push({ s, o });
    console.log(`\n=== ${c.code} (${c.name}) — ${rows.length} order(s) carry the code ===`);
    md += `\n## ${c.code} — ${c.name}\nRate ${(rate * 100).toFixed(1)} % of the order after discount, shipping excluded. Payable = paid, not cancelled, not refunded, delivered.\n\n| store | order | date | state | total | base | commission | note |\n|---|---|---|---|---:|---:|---:|---|\n`;
    let payable = 0, pending = 0;
    for (const { s, o } of rows) {
      const st = state(o), m = money(o), created = toMillis(field(o, ['created_at', 'create_time', 'createdAt']));
      const no = field(o, ['order_number', 'order_no', 'orderNumber', 'name']) || field(o, ['id']);
      const inWindow = created >= from && created < to;
      let kind = 'payable', note = '';
      if (!inWindow) { kind = 'outside window'; }
      else if (st.cancelled) kind = 'cancelled';
      else if (st.refunded) kind = 'refunded';
      else if (!st.paid) kind = 'unpaid';
      else if (st.delivered === null) { kind = 'paid — confirm delivery'; note = 'delivery state not readable'; }
      else if (!st.delivered) kind = 'paid — not delivered yet';
      if (m.base === null) note += ' total not readable';
      else if (!m.shipKnown) note += ' shipping field not found: base = total';
      // total is AFTER the coupon: add it back before comparing with the minimum
      if (c.min_order_usd && m.total !== null && m.total + (m.discount ?? c.discount_usd ?? 0) < c.min_order_usd) note += ` below the ${c.min_order_usd} minimum?`;
      const comm = m.base === null ? null : +(m.base * rate).toFixed(2);
      if (kind === 'payable' && comm !== null) payable += comm; else if (/^paid/.test(kind) && comm !== null) pending += comm;
      md += `| ${s} | ${no} | ${day(created)} | ${kind} | ${m.total ?? '?'} | ${m.base ?? '?'} | ${comm ?? '?'} | ${note.trim()} |\n`;
      console.log(`  ${s} ${no} ${day(created)} ${kind} total=${m.total} base=${m.base} commission=${comm} [${st.raw}] ${note}`);
      if (args.probe) console.log('  RAW KEYS:', Object.keys(o).join(','), '\n  RAW:', JSON.stringify(o).slice(0, 2500));
    }
    md += `\n**Payable now: ${payable.toFixed(2)}** · pending (paid, delivery to confirm): ${pending.toFixed(2)} · orders carrying the code: ${rows.length}\n`;
    console.log(`  → payable ${payable.toFixed(2)} · pending ${pending.toFixed(2)}`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}
main().catch(e => { console.error(e); process.exit(1); });
