'use strict';
/**
 * Set (or just read) the price of ONE platform product on one store.
 *
 *   STORE=us PRODUCT_ID=16913789 PRICE=4.90 DRY_RUN=true  node scripts/set-product-price.js
 *
 * Built 19 Sep 2026 for the socks ruling (€3.90 / $4.90 flat): the reprice
 * tool only recovers FX-converted clone prices, it cannot move a product that
 * already sits on the .90 ladder. This one takes the target outright.
 *
 * Write path (docs/oemsaas-api-notes.md): batchsave cannot change prices, so
 * PUT /products/{id} read-modify-write with every variant set to PRICE
 * (compare_at_price cleared unless KEEP_COMPARE=true). PUT regenerates
 * variant ids, so the read-back matches by position + size. Refuses to write
 * without title/variants on the GET. Always run DRY_RUN=true first — it
 * prints the live product (title, handle, variants, prices) and exits.
 *
 * Env: OEMSAAS_TOKEN_<STORE> (en/es/fr/it/us), STORE, PRODUCT_ID, PRICE
 *      (omit PRICE to read only), DRY_RUN (default true), KEEP_COMPARE.
 * Runs on the GitHub runner — the sandbox cannot reach openapi.oemapps.com.
 */

const HOST = 'https://openapi.oemapps.com';
const STORE = (process.env.STORE || '').trim().toLowerCase();
const ID = (process.env.PRODUCT_ID || '').trim();
const PRICE = (process.env.PRICE || '').trim();
const DRY_RUN = process.env.DRY_RUN !== 'false';
const KEEP_COMPARE = process.env.KEEP_COMPARE === 'true';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function api(token, method, endpoint, body, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${HOST}${endpoint}`, {
      method, headers: { 'Content-Type': 'application/json', token },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { throw new Error(`HTTP ${res.status} non-JSON: ${text.slice(0, 200)}`); }
    if (json.code === 0 || json.code === 200) return json;
    const throttled = json.code === 1000 || /Too many/i.test(json.msg || '');
    if (!throttled || i === tries - 1) throw new Error(`API code ${json.code}: ${json.msg}`);   // a throttled GET must THROW, never read as "not found"
    await sleep(1500 * (i + 1));
  }
}

function show(p) {
  console.log(`${p.handle}  (id ${p.id})  "${p.title}"`);
  for (const v of p.variants || []) {
    console.log(`  variant ${v.id}  ${v.option1_value_title || v.title || ''}  price=${v.price}  compare_at=${v.compare_at_price || 0}`);
  }
  console.log(`  images=${(p.images || []).length}`);
}

async function main() {
  if (!['en', 'es', 'fr', 'it', 'us'].includes(STORE)) { console.error('❌ STORE must be en|es|fr|it|us'); process.exit(1); }
  if (!/^\d+$/.test(ID)) { console.error('❌ PRODUCT_ID must be numeric'); process.exit(1); }
  if (PRICE && !/^\d+(\.\d{1,2})?$/.test(PRICE)) { console.error('❌ PRICE must look like 4.90'); process.exit(1); }
  const token = process.env[`OEMSAAS_TOKEN_${STORE.toUpperCase()}`];
  if (!token) { console.error(`❌ OEMSAAS_TOKEN_${STORE.toUpperCase()} missing`); process.exit(1); }

  const live = (await api(token, 'GET', `/products/${ID}`)).data;
  if (!live || !live.title) { console.error('❌ GET returned no title — refusing to touch it'); process.exit(1); }
  console.log(`[${STORE}] live product:`); show(live);

  if (!PRICE) { console.log('\n(read only — no PRICE given)'); return; }
  if (!live.variants || !live.variants.length) { console.error('❌ no variants on GET — refusing to PUT (would drop sizes)'); process.exit(1); }
  const already = live.variants.every(v => Number(v.price) === Number(PRICE));
  console.log(`\ntarget: every variant → ${PRICE}${KEEP_COMPARE ? '' : ' (compare_at cleared)'}${already ? '  — already there' : ''}`);
  if (DRY_RUN) { console.log('DRY RUN — nothing written'); return; }
  if (already && KEEP_COMPARE) { console.log('nothing to do'); return; }

  const variants = live.variants.map(v => ({ ...v, price: PRICE, compare_at_price: KEEP_COMPARE ? v.compare_at_price : '0' }));
  await api(token, 'PUT', `/products/${ID}`, { ...live, variants });
  await sleep(800);
  const after = (await api(token, 'GET', `/products/${ID}`)).data;   // an acknowledgement is not evidence
  console.log('\nafter:'); show(after);
  const sizes = (p) => (p.variants || []).map(v => v.option1_value_title || v.title || '');
  const ok = after.title === live.title
    && (after.variants || []).length === live.variants.length
    && sizes(after).join('|') === sizes(live).join('|')
    && (after.variants || []).every(v => Number(v.price) === Number(PRICE))
    && (after.images || []).length === (live.images || []).length;
  if (!ok) { console.error('\n❌ read-back mismatch — check the product in the store admin'); process.exit(1); }
  console.log('\n✅ verified');
}

main().catch(e => { console.error(e); process.exit(1); });
