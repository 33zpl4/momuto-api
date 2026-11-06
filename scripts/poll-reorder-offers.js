#!/usr/bin/env node
/**
 * Day-90 reorder offer (owner, 6 Nov 2026): ~90 days after a PAID order, one email with a 10 % single-use coupon
 * valid 14 days on a new kit (docs/lifecycle-emails.md).
 *
 * Source = the platform orders of every store (so direct store buys count too): financial_status 230, pay_at between
 * DAY_FROM and DAY_TO days ago, with an email, not test, not cancelled, no refund. One offer per email per run and per
 * 180 days (KV, lib/lifecycle-mail.js).
 * Coupon: the platform has NO coupon write API (POST /coupons and 9 other spellings → 404, runs 42221448904 /
 * 42221734410), so the code is ONE SHARED CODE PER STORE created by the owner in the admin (10 %, whole store, one use
 * per customer) and given to this script as REORDER_CODES='{"es":"KIT10","fr":"KIT10",...}' or REORDER_CODE=KIT10 for
 * all stores. Before any email the code is read back from GET /coupons and must be active (status 2) and not expired;
 * otherwise the store is skipped with an error. The "valid 14 days" in the mail is therefore not enforced per customer.
 * Dry run by default. LIVE=1 to send.
 *
 *   node scripts/poll-reorder-offers.js [--lang es] [--from 90] [--to 104]
 */
const C = require('./platform-coupon');
const API  = (process.env.MOMUTO_API_BASE || 'https://momuto-api.vercel.app') + '/api/lifecycle';
const SECRET = process.env.MOMUTO_API_SECRET;
const LIVE = process.env.LIVE === '1';
const DAYS_VALID = 14;
const CODES = (() => { try { return JSON.parse(process.env.REORDER_CODES || '{}'); } catch { return {}; } })();
const codeFor = lang => CODES[lang] || process.env.REORDER_CODE || '';
const STORES = {
  en: { host: 'www.momuto.com', tokenEnv: 'OEMSAAS_TOKEN_EN', lang: 'en', cta: 'https://www.momuto.com/pages/jersey-maker', price: 'https://www.momuto.com/pages/custom-football-kit-prices' },
  es: { host: 'es.momuto.com',  tokenEnv: 'OEMSAAS_TOKEN_ES', lang: 'es', cta: 'https://es.momuto.com/pages/equipaciones-futbol-personalizadas', price: 'https://es.momuto.com/pages/precios-equipaciones-futbol-personalizadas' },
  fr: { host: 'fr.momuto.com',  tokenEnv: 'OEMSAAS_TOKEN_FR', lang: 'fr', cta: 'https://fr.momuto.com/pages/maillot-foot-personnalise', price: 'https://fr.momuto.com/pages/prix-maillot-foot-personnalise' },
  it: { host: 'it.momuto.com',  tokenEnv: 'OEMSAAS_TOKEN_IT', lang: 'it', cta: 'https://it.momuto.com/pages/prezzi-maglie-calcio-personalizzate', price: 'https://it.momuto.com/pages/prezzi-maglie-calcio-personalizzate' },
  us: { host: 'us.momuto.com',  tokenEnv: 'OEMSAAS_TOKEN_US', lang: 'us', cta: 'https://us.momuto.com/pages/jersey-maker', price: 'https://us.momuto.com/pages/custom-soccer-jersey-prices' },
};
const args = { lang: 'all', from: 90, to: 104 };
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k === '--lang') args.lang = process.argv[++i]; else if (k === '--from') args.from = +process.argv[++i]; else if (k === '--to') args.to = +process.argv[++i]; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const field = (o, names) => { for (const n of names) if (o && o[n] !== undefined && o[n] !== null && o[n] !== '') return o[n]; return null; };
const mask = e => String(e || '').replace(/^(.{2})[^@]*(@.*)$/, '$1***$2');
const emailOf = o => String(field(o, ['email', 'customer_email']) || (o.customer && o.customer.email) || '').trim().toLowerCase();
const nameOf = o => { const a = o.shipping_address || o.billing_address || {}; return String(field(o, ['first_name']) || (o.customer && o.customer.first_name) || a.first_name || String(field(o, ['customer_name', 'name']) || '').split(' ')[0] || '').trim(); };
const items = o => field(o, ['products', 'line_items', 'items', 'order_items', 'goods']) || [];
const preview = it => { try { const j = JSON.parse(field(it, ['inner_title', 'innerTitle']) || ''); return j && j.type === '3d-preview' ? j : null; } catch { return null; } };
const fmtDate = (ms, lang) => new Date(ms).toLocaleDateString({ en: 'en-GB', us: 'en-US', es: 'es-ES', fr: 'fr-FR', it: 'it-IT' }[lang] || 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const teamOf = o => { for (const it of items(o)) { const p = preview(it); if (p) { const t = String(field(it, ['title', 'variant_title', 'product_title']) || ''); const m = /^(.*?)\s+[—-]\s/.exec(t); if (m && !/custom design|diseño personalizado|design personnalisé|design personalizzato/i.test(m[1])) return m[1].trim(); } } return ''; };

async function listPaid(token, fromMs, toMs) {
  const out = []; let since = '';
  for (let page = 0; page < 12; page++) {
    const d = await C.api('GET', `/orders?limit=200${since ? `&since_id=${since}` : ''}`, token);
    const list = C.rows(d); if (!list.length) break;
    for (const o of list) { const p = (+field(o, ['first_pay_at', 'pay_at']) || 0) * 1000; if (p >= fromMs && p <= toMs) out.push(o); }
    const oldest = Math.min(...list.map(o => (+field(o, ['created_at']) || 0) * 1000));
    if (oldest < fromMs - 30 * 86400000 || list.length < 200) break;
    since = list[list.length - 1].id; await sleep(500);
  }
  return out;
}
async function post(body) {
  const res = await fetch(API, { method: 'POST', headers: { 'x-webhook-secret': SECRET, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

(async () => {
  const langs = args.lang === 'all' ? Object.keys(STORES) : [args.lang];
  const now = Date.now(), fromMs = now - args.to * 86400000, toMs = now - args.from * 86400000;
  console.log(`mode=${LIVE ? 'LIVE' : 'DRY RUN'} paid between ${args.to} and ${args.from} days ago · stores=${langs.join(',')}`);
  if (LIVE && !SECRET) throw new Error('LIVE needs MOMUTO_API_SECRET');
  const report = { candidates: 0, sent: 0, dedup: 0, skipped: 0, errors: [] };
  const seenEmail = new Set();
  for (const lang of langs) {
    const S = STORES[lang]; const token = process.env[S.tokenEnv];
    if (!token) { report.errors.push(`${lang}: missing ${S.tokenEnv}`); continue; }
    console.log(`\n=== ${lang.toUpperCase()}`);
    const code = codeFor(lang);
    if (!code) { console.log(`  no REORDER_CODES entry for ${lang} — nothing can be offered here`); if (LIVE) report.errors.push(`${lang}: no coupon code configured`); }
    let live = null;
    if (code) {
      try { live = await C.findCoupon(token, code); } catch (e) { report.errors.push(`${lang}: coupon read ${e.message}`); continue; }
      const ok = live && +live.status === 2 && (+live.ends_at === -1 || +live.ends_at * 1000 > now);
      console.log(`  coupon ${code}: ${live ? `found, status ${live.status}, ends ${+live.ends_at === -1 ? 'never' : new Date(live.ends_at * 1000).toISOString().slice(0, 10)}, used ${live.times_used}` : 'NOT FOUND in the store'}${ok ? '' : ' → not usable'}`);
      if (!ok && LIVE) { report.errors.push(`${lang}: coupon ${code} not active on the store`); continue; }
    }
    let paid; try { paid = await listPaid(token, fromMs, toMs); } catch (e) { report.errors.push(`${lang}: ${e.message}`); continue; }
    for (const o of paid) {
      const email = emailOf(o); const id = o.id;
      const why = +field(o, ['financial_status']) !== 230 ? 'not paid' : +field(o, ['cancelled_at']) ? 'cancelled' : +field(o, ['is_test']) === 1 ? 'test' : (field(o, ['refund_status']) != null && +field(o, ['refund_status']) !== 100) ? `refund status ${field(o, ['refund_status'])}` : !email ? 'no email' : seenEmail.has(email) ? 'same email this run' : null;
      if (why) { report.skipped++; console.log(`  skip ${id} (${why})`); continue; }
      seenEmail.add(email); report.candidates++;
      const ref = (items(o).map(preview).find(Boolean) || {}).order_no;
      const image = (items(o).find(preview) || {}).src || null;
      const ctx = { kind: 'reorder', key: `${lang}:${id}`, email, lang: S.lang, name: nameOf(o), team: teamOf(o) || '', code, expires: fmtDate(now + DAYS_VALID * 86400000, S.lang), image, ctaUrl: S.cta, priceUrl: S.price, dry: !LIVE };
      console.log(`  ${LIVE ? 'OFFER' : 'would offer'} ${id} → ${mask(email)} · paid ${Math.round((now - (+field(o, ['first_pay_at', 'pay_at']) || 0) * 1000) / 86400000)} d ago · code ${code || '(none)'} · team "${ctx.team}"`);
      if (!LIVE || !code) continue;
      try {
        const r = await post(ctx);
        if (r.json.sent) report.sent++; else if (r.json.dedup || r.json.suppressed) report.dedup++;
        console.log(`    mail → ${r.status} ${JSON.stringify(r.json).slice(0, 160)}`);
      } catch (e) { report.errors.push(`${lang}:${id}: ${e.message}`); }
      await sleep(500);
    }
  }
  console.log(`\nSUMMARY ${JSON.stringify(report)}`);
  if (report.errors.length) process.exit(1);
})().catch(e => { console.error(e.message); process.exit(1); });
