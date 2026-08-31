'use strict';

/**
 * Clones the Ready to Play product set from the EN store (www.momuto.com) to
 * the US store (us.momuto.com) with USD prices, so the US wall's product
 * cards stop 404ing (docs/us-hub-plan.md §A.5 — "either via CMS admin or the
 * product-create API", docs/cms-product-create-api.md).
 *
 * Which products: parsed live from pages/us/ready-to-play — every
 * /products/<handle> card on the wall. The wall is the source of truth, so
 * the set never drifts from what the page links to.
 *
 * Pricing: EUR → USD via the explicit owner-ruled map below ("pump
 * slightly", 14 Aug). Any EUR price found on an EN product that has no USD
 * mapping FAILS THE PRODUCT LOUDLY (listed at the end) instead of being
 * converted silently — one set of numbers is the law, and only the owner
 * sets it.
 *
 * inner_title (the 3D-customizer pointer) carries the product's own id, so
 * cloning is create-then-rewire: POST without productId, then PUT the
 * returned id back into inner_title.
 *
 * Collections are NOT cloned (US collection ids don't exist yet) — attach
 * in the CMS admin or a follow-up if wanted.
 *
 * Env:
 *   OEMSAAS_TOKEN_EN  - source store token (required)
 *   OEMSAAS_TOKEN_US  - target store token (required; missing = clean skip)
 *   DRY_RUN=true|false - default true (preview payloads, write nothing)
 *   TARGET_HANDLE      - optional: clone just this one handle
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HOST = 'https://openapi.oemapps.com';
const DRY_RUN = process.env.DRY_RUN !== 'false';

// Owner-ruled EUR → USD map (docs/us-hub-plan.md §A.3). Extend ONLY with
// owner-confirmed pairs.
const PRICE_MAP = {
  '21.90': '25.90',  // jersey at 10+ (owner-set)
  '38.90': '45.90',  // single jersey (derived by the owner's rule)
  '19.70': '23.30',  // 21.90 −10% seasonal → 25.90 −10%, rounded to .x0
  '24.90': '28.90',  // long-sleeve jersey (+€3 → +$3, same rule shape)
  '26.90': '30.90',  // full kit original
  '24.20': '27.80',  // full kit −10% seasonal (30.90 −10%, rounded)
  '59.00': '69.00',  // fast lane
  '15.00': '15.00',  // deposit (kept flat)
};

function mapPrice(eur, ctx, missing) {
  if (eur == null || eur === '') return eur;
  const key = Number(eur).toFixed(2);
  if (PRICE_MAP[key]) return PRICE_MAP[key];
  missing.add(`${key} (${ctx})`);
  return null;
}

async function api(token, method, endpoint, body) {
  const res = await fetch(`${HOST}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json', token },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.code !== 0) {
    throw new Error(`${method} ${endpoint}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json;
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

const getHandle = (p) => p.handle || p.alias || p.slug || p.url_key || null;

// The wall is the source of truth for which products the US store needs.
function wallHandles() {
  const wall = fs.readFileSync(path.join(ROOT, 'pages', 'us', 'ready-to-play'), 'utf8');
  const handles = new Set();
  for (const m of wall.matchAll(/href="\/products\/([a-z0-9-]+)"/g)) handles.add(m[1]);
  return [...handles];
}

// Build the POST payload for the US clone of an EN product.
function clonePayload(src, missing) {
  const variants = (src.variants || []).map(v => {
    const out = {
      price: mapPrice(v.price, `${getHandle(src)} variant price`, missing),
      ...(v.compare_at_price ? { compare_at_price: mapPrice(v.compare_at_price, `${getHandle(src)} compare_at`, missing) } : {}),
    };
    for (const k of ['sku', 'barcode', 'weight', 'src',
      'option1_title', 'option1_value_title',
      'option2_title', 'option2_value_title',
      'option3_title', 'option3_value_title']) {
      if (v[k] != null && v[k] !== '') out[k] = v[k];
    }
    return out;
  });

  const payload = {
    title: src.title,
    handle: getHandle(src),
    spec_mode: src.spec_mode ?? 1,
    status: src.status ?? 1,
    variants,
    images: (src.images || []).map(i => ({ src: i.src })).filter(i => i.src),
  };
  for (const k of ['subtitle', 'mini_detail', 'body_html', 'meta_title', 'meta_descript', 'product_type', 'vendor', 'spu', 'free_shipping', 'taxable']) {
    if (src[k] != null && src[k] !== '') payload[k] = src[k];
  }
  if (Array.isArray(src.meta_keywords) && src.meta_keywords.length) payload.meta_keywords = src.meta_keywords;
  if (Array.isArray(src.tags) && src.tags.length) payload.tags = src.tags;
  if (Array.isArray(src.options) && src.options.length) payload.options = src.options;
  return payload;
}

async function main() {
  const tokenEN = process.env.OEMSAAS_TOKEN_EN;
  const tokenUS = process.env.OEMSAAS_TOKEN_US;
  console.log(`create-us-rtp-products — dry_run=${DRY_RUN}`);
  if (!tokenEN) { console.error('❌ OEMSAAS_TOKEN_EN required (source store)'); process.exit(1); }
  if (!tokenUS) {
    console.warn('⚠️  OEMSAAS_TOKEN_US not set — US store not provisioned yet (docs/us-hub-plan.md §A). Skipping cleanly.');
    return;
  }

  const only = (process.env.TARGET_HANDLE || '').trim();
  let wanted = wallHandles();
  if (only) wanted = wanted.filter(h => h === only);
  console.log(`Wall references ${wanted.length} product handle(s): ${wanted.join(', ')}`);

  console.log('Fetching EN products…');
  const enProducts = await fetchAllProducts(tokenEN);
  console.log(`  ${enProducts.length} products on EN`);
  console.log('Fetching US products (for idempotency)…');
  const usProducts = await fetchAllProducts(tokenUS);
  const usByHandle = new Map(usProducts.map(p => [getHandle(p), p]));

  const errors = [];
  for (const handle of wanted) {
    const src = enProducts.find(p => getHandle(p) === handle);
    if (!src) { console.warn(`  ⚠️  ${handle}: not found on EN store — skipping`); errors.push(handle); continue; }
    if (usByHandle.has(handle)) { console.log(`  ·  ${handle}: already on US store (id ${usByHandle.get(handle).id}) — skipping`); continue; }

    const missing = new Set();
    const payload = clonePayload(src, missing);
    if (missing.size) {
      console.error(`  ❌ ${handle}: EUR price(s) with no owner-ruled USD mapping: ${[...missing].join('; ')} — add to PRICE_MAP after owner confirms`);
      errors.push(handle);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  DRY_RUN — would create ${handle}: "${payload.title}", ${payload.variants.length} variant(s) [${payload.variants.map(v => '$' + v.price).join(', ')}], ${payload.images.length} image(s), spec_mode ${payload.spec_mode}`);
      continue;
    }

    try {
      const created = await api(tokenUS, 'POST', '/products', payload);
      const newId = created.data?.id;
      console.log(`  ✅ created ${handle} (id ${newId})`);

      // Rewire the 3D-customizer pointer to the NEW product's own id.
      if (src.inner_title && newId) {
        let inner;
        try { inner = JSON.parse(src.inner_title); } catch { inner = null; }
        if (inner && inner.type === '3d') {
          inner.productId = String(newId);
          await api(tokenUS, 'PUT', `/products/${newId}`, { inner_title: JSON.stringify(inner) });
          console.log(`     ↪ inner_title rewired (productId ${newId})`);
        } else if (src.inner_title.includes('3d-preview')) {
          // per-order preview tag — never clone
        } else if (inner === null) {
          console.warn(`     ⚠️  inner_title on EN isn't JSON — left unset on US, check manually`);
        }
      }
    } catch (e) {
      console.error(`  ❌ ${handle}: ${e.message}`);
      errors.push(handle);
    }
  }

  if (errors.length) { console.error(`\n${errors.length} product(s) failed/skipped: ${errors.join(', ')}`); process.exit(1); }
  console.log('\n✅ Done. Reminder: collections are not cloned — attach US products to a collection in the admin if needed.');
}

main().catch(err => { console.error(err); process.exit(1); });
