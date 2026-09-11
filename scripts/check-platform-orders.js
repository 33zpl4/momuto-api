'use strict';

/**
 * Ask the store platform (the source of truth for payment) about orders.
 *
 *   node scripts/check-platform-orders.js --order 2026091033559596 [--lang all|en|es|fr|it|us]
 *   node scripts/check-platform-orders.js --recent 30 [--lang all]
 *   node scripts/check-platform-orders.js --probe [--lang en]
 *
 * WHY (11 Sep 2026): manage.momuto.com shows our own pay_status, which only
 * flips when the platform's webhook arrives — and those arrive in sweeps days
 * late — or when someone clicks the admin's "Payment successful" button. A
 * plant_order_no on a row means the customer REACHED checkout, not that they
 * paid. This script reads the platform directly: financial_status 230 = paid
 * (the constant WebhookAction keys on), status 190 = cancelled.
 *
 * The orders read surface is only partly verified (docs/oemsaas-api-notes.md):
 * every field is read through candidate names, a single-order re-fetch fills
 * gaps the list omits, and --probe dumps the raw shape. Runs on the GitHub
 * runner (the sandbox cannot reach openapi.oemapps.com). Writes nothing.
 *
 * Output: console + $GITHUB_STEP_SUMMARY (markdown) when present; an email
 * digest via Resend when RESEND_API_KEY is set (optional).
 */

const fs = require('fs');
const HOST = 'https://openapi.oemapps.com';
const STORES = { en: 'OEMSAAS_TOKEN_EN', es: 'OEMSAAS_TOKEN_ES', fr: 'OEMSAAS_TOKEN_FR', it: 'OEMSAAS_TOKEN_IT', us: 'OEMSAAS_TOKEN_US' };
const LABEL  = { en: 'www.momuto.com', es: 'es.momuto.com', fr: 'fr.momuto.com', it: 'it.momuto.com', us: 'us.momuto.com' };
const PAGE = 50, MAX_PAGES = 20;

const args = { order: null, recent: 0, probe: false, lang: 'all' };
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i];
  if (k === '--order') args.order = String(process.argv[++i] || '').trim();
  else if (k === '--recent') args.recent = parseInt(process.argv[++i], 10) || 30;
  else if (k === '--probe') args.probe = true;
  else if (k === '--lang') args.lang = process.argv[++i];
  else { console.error(`Unknown argument ${k}`); process.exit(1); }
}
if (!args.order && !args.recent && !args.probe) { console.error('Need --order <no>, --recent <days> or --probe'); process.exit(1); }

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function platform(pathname, token, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${HOST}${pathname}`, { headers: { token } });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { throw new Error(`HTTP ${res.status} non-JSON: ${text.slice(0, 160)}`); }
    if (json.code === 0 || json.code === 200) return json.data;
    const throttled = json.code === 1000 || /Too many/i.test(json.msg || '');
    if (!throttled || i === tries - 1) throw new Error(`API code ${json.code}: ${json.msg}`);
    await sleep(1500 * (i + 1));
  }
}
const field = (o, names) => { for (const n of names) if (o && o[n] !== undefined && o[n] !== null && o[n] !== '') return o[n]; return null; };
const asList = (d) => Array.isArray(d) ? d : (d && (d.orders || d.list || d.rows || d.data)) || null;
function toMillis(v) { if (!v) return 0; const n = parseInt(v, 10); if (n > 1e12) return n; if (n > 1e9) return n * 1000; const t = Date.parse(v); return isNaN(t) ? 0 : t; }
const iso = (ms) => ms ? new Date(ms).toISOString().replace('T', ' ').slice(0, 16) : '';
const mask = (e) => e ? String(e).replace(/^(.{2}).*(@.*)$/, '$1***$2') : '';

// Verified against a live --probe (11 Sep 2026): the list is data.list[];
// unpaid orders carry pay_at 0 and status 100; a paid one carried pay_at set
// and status 110; cancelled = status 190 / cancelled_at > 0 (WebhookAction).
// financial_status 230 is the webhook's paid constant; pay_at is the belt.
function classify(o) {
  const fs = field(o, ['financial_status', 'financialStatus']);
  const st = field(o, ['status', 'order_status']);
  if (parseInt(st, 10) === 190 || toMillis(field(o, ['cancelled_at'])) > 0) return 'cancelled';
  if (parseInt(fs, 10) === 230 || String(fs).toLowerCase() === 'paid' || toMillis(field(o, ['first_pay_at', 'pay_at'])) > 0) return 'paid';
  if (fs === null && st === null) return 'unknown';
  return 'unpaid';
}
// the €0 preview line carries our local (manage.momuto.com) order_no
function ref3d(o) {
  for (const it of (field(o, ['products', 'line_items', 'items']) || [])) {
    try { const j = JSON.parse(field(it, ['inner_title']) || ''); if (j && j.type === '3d-preview' && j.order_no) return String(j.order_no); } catch {}
  }
  return '';
}
function summarize(o, lang) {
  return {
    store: lang,
    order_number: String(field(o, ['order_number', 'order_no', 'orderNumber', 'name']) || ''),
    id: field(o, ['id']),
    state: classify(o),
    financial_status: field(o, ['financial_status', 'financialStatus']),
    status: field(o, ['status', 'order_status']),
    total: field(o, ['total_price', 'current_total_price', 'pay_price', 'current_subtotal_price', 'total']),
    currency: field(o, ['currency', 'currency_code']) || '',
    email: mask(field(o, ['email', 'customer_email']) || field(o.customer || {}, ['email'])),
    created: iso(toMillis(field(o, ['created_at', 'create_time', 'createdAt']))),
    paid: iso(toMillis(field(o, ['first_pay_at', 'pay_at', 'paid_at', 'payAt']))),
    items: (field(o, ['products', 'line_items', 'lineItems', 'items', 'order_items', 'goods']) || []).length,
    ref3d: ref3d(o),
    domain: field(o, ['domain']) || '',
  };
}

async function fetchRecent(token, days) {
  const cutoff = Date.now() - days * 86400000; const out = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await platform(`/orders?limit=${PAGE}&page=${page}`, token);
    const list = asList(data);
    if (!list) throw new Error(`unrecognised orders payload — keys ${data && typeof data === 'object' ? Object.keys(data).join(',') : typeof data}`);
    if (!list.length) break;
    const firstId = field(list[0], ['id']);
    if (page > 1 && firstId && firstId === fetchRecent.lastFirst) break;   // `page` not honoured → same page again
    fetchRecent.lastFirst = firstId;
    let older = 0;
    for (const o of list) { const c = toMillis(field(o, ['created_at', 'create_time', 'createdAt'])); if (c && c < cutoff) { older++; continue; } out.push(o); }
    if (older === list.length || list.length < PAGE) break;
    await sleep(400);
  }
  return out;
}

async function findOrder(token, no) {
  for (const p of [`/orders/ordernumber/${no}`, `/orders?order_number=${no}`, `/orders?order_no=${no}`, `/orders?keyword=${no}`]) {
    try {
      const d = await platform(p, token);
      const list = asList(d) || (d && typeof d === 'object' && !Array.isArray(d) ? [d.order || d] : []);
      const hit = list.find(o => String(field(o, ['order_number', 'order_no', 'orderNumber', 'name']) || '') === no);
      if (hit) return { hit, via: p };
    } catch (e) { /* try the next form */ }
  }
  // fall back: scan recent pages
  const recent = await fetchRecent(token, 120);
  const hit = recent.find(o => String(field(o, ['order_number', 'order_no', 'orderNumber', 'name']) || '') === no);
  return hit ? { hit, via: 'list scan' } : null;
}

function table(rows) {
  const cols = ['store', 'order_number', 'ref3d', 'state', 'status', 'total', 'currency', 'created', 'paid', 'email', 'items'];
  const md = [`| ${cols.join(' | ')} |`, `| ${cols.map(() => '---').join(' | ')} |`, ...rows.map(r => `| ${cols.map(c => String(r[c] ?? '')).join(' | ')} |`)];
  return md.join('\n');
}

async function emailDigest(subject, md) {
  const key = process.env.RESEND_API_KEY; if (!key) return false;
  const to = (process.env.ADMIN_EMAILS || 'info@momuto.com,ilovebillxie@hotmail.com').split(',').map(x => x.trim()).filter(Boolean);
  const html = `<pre style="font:13px/1.5 monospace;white-space:pre-wrap">${md.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`;
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.FROM_EMAIL || 'MOMUTO <orders@momuto.com>', to, subject, html }) });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  return true;
}

(async () => {
  const langs = args.lang === 'all' ? Object.keys(STORES) : [args.lang];
  const summary = [];
  if (args.probe) {
    for (const lang of langs) {
      const token = process.env[STORES[lang]]; if (!token) { console.log(`[${lang}] no token`); continue; }
      const d = await platform(`/orders?limit=3&page=1`, token);
      const s = JSON.stringify(d, (k, v) => (typeof v === 'string' && v.includes('@')) ? mask(v) : v);
      console.log(`\n===== [${lang}] GET /orders?limit=3 =====\n${s.slice(0, 5000)}${s.length > 5000 ? ' …' : ''}`);
      const list = asList(d);
      if (list && list[0] && field(list[0], ['id'])) {
        const one = await platform(`/orders/${field(list[0], ['id'])}`, token);
        const s1 = JSON.stringify(one, (k, v) => (typeof v === 'string' && v.includes('@')) ? mask(v) : v);
        console.log(`\n===== [${lang}] GET /orders/{id} =====\n${s1.slice(0, 5000)}${s1.length > 5000 ? ' …' : ''}`);
      }
    }
    return;
  }
  if (args.order) {
    let found = null;
    for (const lang of langs) {
      const token = process.env[STORES[lang]]; if (!token) continue;
      const r = await findOrder(token, args.order).catch(e => { console.error(`[${lang}] ${e.message}`); return null; });
      if (r) { found = { lang, ...r }; break; }
    }
    if (!found) { const msg = `Order ${args.order} not found on any store (${langs.join(', ')}).`; console.log(msg); summary.push(msg); }
    else {
      let o = found.hit;
      if (field(o, ['id'])) { try { o = await platform(`/orders/${field(o, ['id'])}`, process.env[STORES[found.lang]]) || o; } catch {} }
      const row = summarize(o, found.lang);
      console.log(`\nOrder ${args.order} on ${LABEL[found.lang]} (via ${found.via})`);
      console.log(JSON.stringify(row, null, 2));
      summary.push(`## Order ${args.order} — ${LABEL[found.lang]}\n\n**${row.state.toUpperCase()}**\n\n${table([row])}`);
    }
  }
  if (args.recent) {
    const rows = [];
    for (const lang of langs) {
      const token = process.env[STORES[lang]]; if (!token) { console.log(`[${lang}] no token — skipped`); continue; }
      try { for (const o of await fetchRecent(token, args.recent)) rows.push(summarize(o, lang)); }
      catch (e) { console.error(`[${lang}] ${e.message}`); summary.push(`- ${lang}: ERROR ${e.message}`); }
      await sleep(400);
    }
    rows.sort((a, b) => (b.created > a.created ? 1 : -1));
    const by = (s) => rows.filter(r => r.state === s);
    const head = `## Platform orders — last ${args.recent} days\n\nPaid **${by('paid').length}** · Unpaid (reached checkout, never paid) **${by('unpaid').length}** · Cancelled **${by('cancelled').length}** · Unknown **${by('unknown').length}**`;
    const md = [head, '### Paid', table(by('paid')), '### Unpaid — reached checkout, never paid', table(by('unpaid')), '### Cancelled', table(by('cancelled')), by('unknown').length ? '### Unknown status (shape not recognised)\n' + table(by('unknown')) : ''].join('\n\n');
    console.log('\n' + md);
    summary.push(md);
    try { if (await emailDigest(`MOMUTO platform orders — ${by('paid').length} paid / ${by('unpaid').length} unpaid (last ${args.recent} d)`, md)) console.log('\n📧 digest emailed'); }
    catch (e) { console.error('digest email failed:', e.message); }
  }
  if (process.env.GITHUB_STEP_SUMMARY && summary.length) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n\n') + '\n');
})().catch(e => { console.error(e); process.exit(1); });
