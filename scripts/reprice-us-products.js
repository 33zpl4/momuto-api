'use strict';

/**
 * Reprices the US store's cloned products from the platform's FX-converted
 * numbers (EUR × 1.1605 → 45.14, 65.92, 57.91 …) to the owner-ruled USD
 * ladder (.90 endings, docs/us-launch-status.md), and fixes football/EUR
 * text in product copy while it is there.
 *
 * How: every live US product's variant price is divided by the clone ratio
 * to recover the EUR it came from; that EUR is looked up in USD_OF_EUR. A
 * EUR with no ruling is reported and left alone — never invented.
 *
 * Write path: PUT /products/{id} read-modify-write (batchsave drops variants — only id + the
 * fields we send; see docs/oemsaas-api-notes.md). Variants are sent as
 * { id, price, compare_at_price } only.
 *
 * Env: OEMSAAS_TOKEN_US (required), DRY_RUN=true|false (default true),
 *      TARGET_HANDLE (optional: one product), VERIFY=true (re-GET after save)
 */

const HOST = 'https://openapi.oemapps.com';
const DRY_RUN = process.env.DRY_RUN !== 'false';
const ONLY = (process.env.TARGET_HANDLE || '').trim();
const CLONE_RATIO = 1.1605;           // measured on the 3 Sep 2026 dump (45.14/38.90 …)

// EUR (EN store) → USD (US store). Owner pairs first, then the .90 rule
// (EUR × ~1.18 to the nearest .90). Extend only with the owner.
const USD_OF_EUR = {
  '38.90': '45.90', '21.90': '25.90', '35.00': '40.90', '59.00': '69.00', '19.70': '23.30',
  '15.00': '15.00', '24.90': '28.90', '26.90': '30.90', '24.20': '27.80', '49.90': '58.90',
  '54.90': '64.90', '64.90': '76.90',
  // ladder (comparison page) — derived 3 Sep 2026
  '34.90': '41.90', '18.90': '21.90', '17.90': '20.90', '16.90': '19.90',
  '15.90': '18.90', '11.90': '13.90', '6.00': '6.90', '5.50': '5.90', '5.00': '5.00',
  '56.80': '66.80', '50.80': '60.80', '38.80': '44.80', '23.40': '25.90',
  // product-only prices seen on the dump
  '39.00': '45.90', '40.00': '46.90', '41.90': '49.90', '42.90': '50.90', '55.90': '65.90',
  '80.00': '94.90', '20.90': '24.90', '19.90': '23.90', '10.00': '11.90', '3.00': '3.00',
  '51.10': '59.90',   // Ready to Play full kit (RTP −10%)
  '50.00': '59.00',   // free-shipping threshold in product blurbs
};
// Junk/test products the clone brought along — never touched.
const SKIP = new Set(['test', '测试商品', 'whole-body-product']);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function api(token, method, endpoint, body, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${HOST}${endpoint}`, {
      method, headers: { 'Content-Type': 'application/json', token },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.code === 0) return json;
    const throttled = json.code === 1000 || /Too many requests/.test(JSON.stringify(json));
    if (!throttled || i === tries - 1) throw new Error(`${method} ${endpoint}: ${JSON.stringify(json).slice(0, 300)}`);
    await sleep(2000 * (i + 1));
  }
}
async function fetchAllProducts(token) {
  const all = []; let since = ''; const limit = 200;
  while (true) {
    const json = await api(token, 'GET', `/products?limit=${limit}${since ? `&since_id=${since}` : ''}`);
    const arr = json.data || [];
    all.push(...arr);
    if (arr.length < limit) break;
    since = arr[arr.length - 1].id;
  }
  return all;
}

const unmapped = new Set();
function usdOf(price, ctx) {
  const n = Number(price);
  if (!n) return null;                                   // 0 = unpriced mockup products
  const eur = n / CLONE_RATIO;
  for (const [k, v] of Object.entries(USD_OF_EUR)) {
    if (Math.abs(Number(k) - eur) <= 0.06) return v;
    if (Math.abs(Number(v) - n) < 0.001) return null;    // already at the USD target
  }
  unmapped.add(`${n} (≈€${eur.toFixed(2)}) on ${ctx}`);
  return null;
}

// Text: football→soccer (proper nouns kept), € amounts via the same map, EUR→USD.
function fixText(s, ctx) {
  if (!s || typeof s !== 'string') return s;
  let t = s.replace(/\bfootball\b/gi, m => m === m.toUpperCase() ? m : (m[0] === 'F' ? 'Soccer' : 'soccer'));
  t = t.replace(/(?:€|&euro;)\s?(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s?(?:€|&euro;|EUR\b)/g, (m, a, b) => {
    const eur = Number((a || b).replace(',', '.')).toFixed(2);
    const usd = USD_OF_EUR[eur];
    if (!usd) { unmapped.add(`${m} in text of ${ctx}`); return m; }
    return `$${usd}`;
  });
  t = t.replace(/\bEUR\b/g, 'USD');
  return t;
}

async function main() {
  const token = process.env.OEMSAAS_TOKEN_US;
  if (!token) { console.error('❌ OEMSAAS_TOKEN_US required'); process.exit(1); }
  console.log(`reprice-us-products — dry_run=${DRY_RUN}${ONLY ? ` handle=${ONLY}` : ''}\n`);

  const products = await fetchAllProducts(token);
  console.log(`${products.length} products on the US store\n`);
  const batch = [];
  for (const p of products) {
    if (SKIP.has(p.handle) || (ONLY && p.handle !== ONLY)) continue;
    const entry = { id: p.id };
    const variants = [];
    for (const v of p.variants || []) {
      const price = usdOf(v.price, `${p.handle} variant ${v.id}`);
      const cmp = v.compare_at_price ? usdOf(v.compare_at_price, `${p.handle} compare_at ${v.id}`) : null;
      if (price || cmp) variants.push({ id: v.id, price: price || String(v.price), compare_at_price: cmp || String(v.compare_at_price || 0) });
    }
    if (variants.length) entry.variants = variants;
    for (const k of ['title', 'subtitle', 'mini_detail', 'body_html', 'meta_title', 'meta_descript']) {
      const fixed = fixText(p[k], `${p.handle}.${k}`);
      if (fixed !== p[k]) entry[k] = fixed;
    }
    if (Object.keys(entry).length === 1) continue;
    // batchsave rejects any product without a title (500 "title不能为空", 5 Sep 2026) — always send it
    if (!entry.title) entry.title = p.title;
    batch.push(entry);
    const pr = (entry.variants || []).map(v => `${v.id}: ${p.variants.find(x => x.id === v.id)?.price}→${v.price}${Number(v.compare_at_price) ? ` (cmp→${v.compare_at_price})` : ''}`).join(', ');
    console.log(`• ${p.handle}  ${pr}${Object.keys(entry).filter(k => !['id', 'variants'].includes(k) && !(k === 'title' && entry.title === p.title)).length ? '  text:' + Object.keys(entry).filter(k => !['id', 'variants'].includes(k) && !(k === 'title' && entry.title === p.title)).join(',') : ''}`);
  }
  console.log(`\n${batch.length} product(s) to update`);
  if (unmapped.size) { console.log('\n⚠️  NOT changed — no owner ruling for:'); for (const u of unmapped) console.log('   ', u); }
  if (DRY_RUN) { console.log('\nDRY RUN — nothing written'); return; }

  // Write path: PUT /products/{id} read-modify-write. batchsave silently drops
  // `variants` (docs/oemsaas-api-notes.md — code 0, price unchanged; confirmed
  // live 5 Sep 2026 on pasta-la-vista), so prices can only move through a full
  // PUT of the GET'd product. Guards: refuse to PUT without title or variants.
  let failed = 0;
  for (const e of batch) {
    const live = (await api(token, 'GET', `/products/${e.id}`)).data;
    if (!live?.title) { console.error(`❌ ${e.id}: GET returned no title — refusing to PUT blind`); failed++; continue; }
    if (!live.variants?.length) { console.error(`❌ ${live.handle}: no variants on GET — refusing to PUT (would drop sizes)`); failed++; continue; }
    const want = new Map((e.variants || []).map(v => [v.id, v]));
    const variants = live.variants.map(v => want.has(v.id) ? { ...v, price: want.get(v.id).price, compare_at_price: want.get(v.id).compare_at_price } : v);
    const body = { ...live, variants };
    // text fixes recomputed on the FULL object (the list endpoint omits body_html)
    for (const k of ['title', 'subtitle', 'mini_detail', 'body_html', 'meta_title', 'meta_descript']) {
      const fixed = fixText(live[k], `${live.handle}.${k}`);
      if (fixed !== live[k]) body[k] = fixed;
    }
    await api(token, 'PUT', `/products/${e.id}`, body);
    await sleep(600);
    // read back — an acknowledgement is not evidence
    const after = (await api(token, 'GET', `/products/${e.id}`)).data;
    const bad = (e.variants || []).filter(v => { const a = (after.variants || []).find(x => x.id === v.id); return !a || Number(a.price) !== Number(v.price); });
    const ok = !bad.length && (after.variants || []).length === live.variants.length && !!after.title;
    console.log(`${ok ? '✅' : '❌'} ${live.handle}: prices=${(after.variants || []).map(v => v.price).join('/')} variants=${(after.variants || []).length}/${live.variants.length} images=${(after.images || []).length}/${(live.images || []).length} title="${after.title}"`);
    if (!ok) { failed++; console.error(`   mismatch detail: want=${JSON.stringify(e.variants)} after=${JSON.stringify((after.variants || []).map(v => ({ id: v.id, t: typeof v.id, price: v.price, cmp: v.compare_at_price })))}`); }
    await sleep(600);
  }
  if (failed) { console.error(`\n❌ ${failed} product(s) did not verify`); process.exit(1); }
  console.log('\n✅ Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
