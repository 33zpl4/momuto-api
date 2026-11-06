#!/usr/bin/env node
/**
 * Abandoned-checkout email, ours (Resend) instead of the platform's `carts/recovery_1` (docs/lifecycle-emails.md).
 *
 * Signal: the platform creates the ORDER when the customer reaches checkout, before payment (order
 * 2026110633635073, 6 Nov 2026: financial_status 200, pay_at 0, with the customer's email and the €0 preview lines
 * carrying the design renders). So an unpaid order older than MIN_AGE is an abandoned checkout, no cart API needed.
 *
 * For every store: GET /orders?financial_status=200 (also filtered client-side), keep orders created between
 * MIN_AGE_MIN and MAX_AGE_H ago, with an email, not test, not cancelled, whose email has NOT paid any order since
 * (newest paid list), then POST each one to /api/lifecycle kind=abandoned — which dedups per order in KV and sends.
 * Dry run by default: prints the decisions (emails masked). LIVE=1 to send.
 *
 *   node scripts/poll-abandoned-checkouts.js [--lang es] [--min 60] [--max 72]
 */
const HOST = 'https://openapi.oemapps.com';
const API  = (process.env.MOMUTO_API_BASE || 'https://momuto-api.vercel.app') + '/api/lifecycle';
const SECRET = process.env.MOMUTO_API_SECRET;
const LIVE = process.env.LIVE === '1';
const STORES = {
  en: { host: 'www.momuto.com', tokenEnv: 'OEMSAAS_TOKEN_EN', lang: 'en', cur: 'EUR' },
  es: { host: 'es.momuto.com',  tokenEnv: 'OEMSAAS_TOKEN_ES', lang: 'es', cur: 'EUR' },
  fr: { host: 'fr.momuto.com',  tokenEnv: 'OEMSAAS_TOKEN_FR', lang: 'fr', cur: 'EUR' },
  it: { host: 'it.momuto.com',  tokenEnv: 'OEMSAAS_TOKEN_IT', lang: 'it', cur: 'EUR' },
  us: { host: 'us.momuto.com',  tokenEnv: 'OEMSAAS_TOKEN_US', lang: 'us', cur: 'USD' },
};
const args = { lang: 'all', min: 60, max: 72 };
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k === '--lang') args.lang = process.argv[++i]; else if (k === '--min') args.min = +process.argv[++i]; else if (k === '--max') args.max = +process.argv[++i]; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const field = (o, names) => { for (const n of names) if (o && o[n] !== undefined && o[n] !== null && o[n] !== '') return o[n]; return null; };
const rows = d => (Array.isArray(d) ? d : (d && (d.list || d.orders || d.rows)) || []);
const mask = e => String(e || '').replace(/^(.{2})[^@]*(@.*)$/, '$1***$2');
const money = (v, cur, lang) => { const n = Number(v); if (!isFinite(n)) return ''; return cur === 'USD' ? `$${n.toFixed(2)}` : `${n.toFixed(2).replace('.', ',')} €`; };

async function platform(pathname, token, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${HOST}${pathname}`, { headers: { token } });
    const text = await res.text(); let json;
    try { json = JSON.parse(text); } catch { throw new Error(`HTTP ${res.status} non-JSON: ${text.slice(0, 160)}`); }
    if (json.code === 0 || json.code === 200) return json.data;
    if (!(json.code === 1000 || /Too many/i.test(json.msg || '')) || i === tries - 1) throw new Error(`API code ${json.code}: ${json.msg}`);
    await sleep(1500 * (i + 1));
  }
}
const emailOf = o => String(field(o, ['email', 'customer_email', 'contact_email']) || (o.customer && o.customer.email) || '').trim().toLowerCase();
const nameOf = o => {
  const a = o.shipping_address || o.billing_address || (Array.isArray(o.addresses) && o.addresses[0]) || {};
  const first = field(o, ['first_name', 'customer_first_name']) || (o.customer && o.customer.first_name) || a.first_name || '';
  const full = field(o, ['customer_name', 'name', 'contact_name']) || '';
  return String(first || String(full).split(' ')[0] || '').trim();
};
const items = o => field(o, ['products', 'line_items', 'items', 'order_items', 'goods']) || [];
const isPreview = it => { try { const j = JSON.parse(field(it, ['inner_title', 'innerTitle']) || ''); return j && j.type === '3d-preview' ? j : null; } catch { return null; } };

async function post(body) {
  const res = await fetch(API, { method: 'POST', headers: { 'x-webhook-secret': SECRET, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

(async () => {
  const langs = args.lang === 'all' ? Object.keys(STORES) : [args.lang];
  const now = Date.now(), minMs = args.min * 60000, maxMs = args.max * 3600000;
  console.log(`mode=${LIVE ? 'LIVE' : 'DRY RUN'} window=${args.min}min..${args.max}h stores=${langs.join(',')}`);
  if (LIVE && !SECRET) throw new Error('LIVE needs MOMUTO_API_SECRET');
  const report = { candidates: 0, sent: 0, dedup: 0, skipped: 0, errors: [] };
  for (const lang of langs) {
    const S = STORES[lang]; const token = process.env[S.tokenEnv];
    if (!token) { report.errors.push(`${lang}: missing ${S.tokenEnv}`); continue; }
    console.log(`\n=== ${lang.toUpperCase()}`);
    let unpaid, recent;
    try { unpaid = rows(await platform('/orders?limit=100&financial_status=200', token)); await sleep(600); recent = rows(await platform('/orders?limit=100', token)); }
    catch (e) { report.errors.push(`${lang}: ${e.message}`); continue; }
    const paidSince = new Map();   // email -> latest pay_at ms
    for (const o of recent) { const p = (+field(o, ['first_pay_at', 'pay_at']) || 0) * 1000; const e = emailOf(o); if (p && e) paidSince.set(e, Math.max(p, paidSince.get(e) || 0)); }
    for (const o of unpaid) {
      const fs = +field(o, ['financial_status']); const payAt = +field(o, ['pay_at']) || 0; const created = (+field(o, ['created_at']) || 0) * 1000;
      const age = now - created; const email = emailOf(o); const id = o.id;
      const why = fs !== 200 || payAt ? 'paid' : +field(o, ['cancelled_at']) ? 'cancelled' : +field(o, ['is_test']) === 1 ? 'test' : !email ? 'no email' : age < minMs ? 'too fresh' : age > maxMs ? 'too old' : (paidSince.get(email) || 0) > created ? 'bought since' : null;
      if (why) { report.skipped++; if (why !== 'too old') console.log(`  skip ${id} (${why})`); continue; }
      report.candidates++;
      const its = items(o); const previews = its.map(isPreview).filter(Boolean);
      const images = its.filter(it => isPreview(it)).map(it => field(it, ['src', 'image'])).filter(Boolean);
      const count = its.filter(it => !isPreview(it)).reduce((n, it) => n + (+field(it, ['quantity', 'qty']) || 0), 0);
      const ctx = { kind: 'abandoned', key: `${lang}:${id}`, email, lang: S.lang, name: nameOf(o), images, itemCount: count,
        total: money(field(o, ['total_price', 'current_total_price']), S.cur, S.lang), cartUrl: `https://${S.host}/cart`, ref: previews[0] ? previews[0].order_no : null, dry: !LIVE };
      console.log(`  ${LIVE ? 'SEND' : 'would send'} ${id} → ${mask(email)} · ${count} item(s) ${ctx.total} · ${images.length} render(s) · ref ${ctx.ref || '-'} · ${Math.round(age / 3600000)} h old`);
      if (!SECRET) continue;
      try {
        const r = await post(ctx);
        if (r.json.sent) report.sent++; else if (r.json.dedup || r.json.suppressed) report.dedup++;
        console.log(`    → ${r.status} ${JSON.stringify(r.json).slice(0, 160)}`);
      } catch (e) { report.errors.push(`${lang}:${id}: ${e.message}`); }
      await sleep(400);
    }
  }
  console.log(`\nSUMMARY ${JSON.stringify(report)}`);
  if (report.errors.length) process.exit(1);
})().catch(e => { console.error(e.message); process.exit(1); });
