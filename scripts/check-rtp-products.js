'use strict';

/**
 * Read-only: which Ready to Play products (the-<slug>, the-<slug>-full-kit) exist on each store,
 * with status, variant prices and whether the 3D-customizer pointer (inner_title) carries the
 * product's own id. Writes nothing.
 *
 * Env: OEMSAAS_TOKEN_EN / _IT / _ES / _FR / _US (missing = skipped), STORES (default "EN,IT")
 */

const HOST = 'https://openapi.oemapps.com';
const SLUGS = ['fracture', 'kinetic', 'legacy', 'apex', 'mosaic', 'prism', 'khala'];

async function api(token, endpoint) {
  const res = await fetch(`${HOST}${endpoint}`, { headers: { 'Content-Type': 'application/json', token } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.code !== 0) throw new Error(`GET ${endpoint}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

async function allProducts(token) {
  const all = []; let since = ''; const limit = 200;
  for (;;) {
    const json = await api(token, `/products?limit=${limit}${since ? `&since_id=${since}` : ''}`);
    const arr = json.data || [];
    all.push(...arr);
    if (arr.length < limit) break;
    since = arr[arr.length - 1].id;
  }
  return all;
}

const handleOf = (p) => p.handle || p.alias || p.slug || p.url_key || null;

(async () => {
  const stores = (process.env.STORES || 'EN,IT').split(',').map(s => s.trim()).filter(Boolean);
  const want = SLUGS.flatMap(s => [`the-${s}`, `the-${s}-full-kit`]);
  for (const st of stores) {
    const token = process.env[`OEMSAAS_TOKEN_${st}`];
    if (!token) { console.log(`\n== ${st}: no token, skipped`); continue; }
    const prods = await allProducts(token);
    console.log(`\n== ${st}: ${prods.length} products in store`);
    const byHandle = new Map(prods.map(p => [handleOf(p), p]));
    for (const h of want) {
      const p = byHandle.get(h);
      if (!p) { console.log(`  MISSING  ${h}`); continue; }
      const prices = [...new Set((p.variants || []).map(v => v.price))].join('/');
      const inner = p.inner_title != null ? String(p.inner_title).slice(0, 60) : '';
      console.log(`  ok       ${h}  id=${p.id} status=${p.status} prices=${prices} images=${(p.images || []).length} inner_title=${inner}`);
    }
  }
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
