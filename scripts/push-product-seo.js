const fs = require('fs');
const path = require('path');

// Pushes RTP product SEO to the storefront via the OEMSaaS OpenAPI
// `POST /products/batchsave` (Batch editing) endpoint.
//
// Why batchsave: only `products.id` is required — every other field is optional,
// so this is a PARTIAL update. We send id + the five SEO fields and nothing else,
// leaving price, variants, media and the `inner_title` (type:3d cart pointer)
// completely untouched. No GET/merge needed.
//
// Source of truth: ready-to-play/seo/rtp-seo.<locale>.json (carries product_id +
// the SEO copy per handle). Run per language store with its own token.

const DOMAINS = {
  en: { token: process.env.OEMSAAS_TOKEN_EN, label: 'momuto.com',    host: 'https://openapi.oemapps.com', seo: 'rtp-seo.en.json' },
  es: { token: process.env.OEMSAAS_TOKEN_ES, label: 'es.momuto.com', host: 'https://openapi.oemapps.com', seo: 'rtp-seo.es.json' },
  fr: { token: process.env.OEMSAAS_TOKEN_FR, label: 'fr.momuto.com', host: 'https://openapi.oemapps.com', seo: 'rtp-seo.fr.json' },
  it: { token: process.env.OEMSAAS_TOKEN_IT, label: 'it.momuto.com', host: 'https://openapi.oemapps.com', seo: 'rtp-seo.it.json' },
};

const SEO_DIR = path.join('ready-to-play', 'seo');

const ORDER = [
  'the-apex', 'the-apex-full-kit', 'the-kinetic', 'the-kinetic-full-kit',
  'the-khala', 'the-khala-full-kit', 'the-legacy', 'the-legacy-full-kit',
  'the-mosaic', 'the-mosaic-full-kit', 'the-prism', 'the-prism-full-kit',
  'the-fracture', 'the-fracture-full-kit',
];

// Resolve handle -> product id from the live store via GET /products.
// Lets the same SEO JSON drive any store without hand-maintaining per-locale ids:
// after the per-domain manage.momuto.com models are created, this picks up their ids.
async function idByHandle(domain) {
  const map = {};
  let since = '';
  const limit = 200;
  while (true) {
    const url = `${domain.host}/products?limit=${limit}${since ? `&since_id=${since}` : ''}`;
    const res = await fetch(url, { headers: { token: domain.token } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.code !== 0) throw new Error(`GET /products failed on ${domain.label}: ${JSON.stringify(json)}`);
    const arr = json.data || [];
    for (const p of arr) if (p.handle) map[p.handle] = p.id;
    if (arr.length < limit) break;
    since = arr[arr.length - 1].id;
  }
  return map;
}

function buildProducts(seo, only, idMap) {
  let handles = ORDER.filter(h => seo[h]);
  if (only && only.length) handles = handles.filter(h => only.includes(h));
  const built = [], missing = [];
  for (const h of handles) {
    const e = seo[h];
    const id = (idMap && idMap[h] != null) ? idMap[h] : parseInt(e.product_id, 10);
    if (!Number.isFinite(id)) { missing.push(h); continue; }
    built.push({
      id,
      subtitle: e.subtitle,
      meta_title: e.seo_title,
      meta_descript: e.meta,
      meta_keywords: e.keywords.split(',').map(s => s.trim()).filter(Boolean),
      mini_detail: e.short,
    });
  }
  return { built, missing };
}

async function batchsave(domain, products) {
  const res = await fetch(`${domain.host}/products/batchsave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token: domain.token },
    body: JSON.stringify({ products }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.code !== 0) {
    throw new Error(`batchsave failed on ${domain.label} (HTTP ${res.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

async function main() {
  const target = process.env.TARGET_DOMAIN;            // optional: en|es|fr|it
  const dryRun = String(process.env.DRY_RUN || '').toLowerCase() === 'true';
  const only = (process.env.TARGET_HANDLES || '')     // optional: comma list, e.g. "the-apex"
    .split(',').map(s => s.trim()).filter(Boolean);
  const domains = target ? { [target]: DOMAINS[target] } : DOMAINS;

  const errors = [];
  for (const [lang, domain] of Object.entries(domains)) {
    if (!domain) { console.error(`❌ Unknown domain key: ${target}`); process.exit(1); }
    const seoPath = path.join(SEO_DIR, domain.seo);
    if (!fs.existsSync(seoPath)) { console.log(`  ⚠️  ${domain.seo} not found — skipping ${domain.label}`); continue; }

    const seo = JSON.parse(fs.readFileSync(seoPath, 'utf8'));

    // Resolve ids by handle from the live store (needs a token). Dry runs and
    // tokenless stores fall back to the product_id baked into the SEO JSON.
    let idMap = null;
    if (!dryRun && domain.token) {
      try { idMap = await idByHandle(domain); }
      catch (err) { console.error(`  ❌ ${domain.label}: ${err.message}`); errors.push(err.message); continue; }
    }

    const { built, missing } = buildProducts(seo, only, idMap);
    if (missing.length) console.warn(`  ⚠️  ${domain.label}: no product found for handle(s): ${missing.join(', ')} — skipped (create the model in manage.momuto.com first)`);
    if (!built.length) { console.log(`  ⚠️  No resolvable products${only.length ? ` for handles [${only.join(', ')}]` : ''} — skipping ${domain.label}`); continue; }
    console.log(`\n${domain.label}: ${built.length} product(s) from ${domain.seo}${idMap ? ' (ids resolved by handle)' : ' (ids from JSON)'}${only.length ? ` (filtered: ${only.join(', ')})` : ''}`);

    if (dryRun) {
      console.log(JSON.stringify({ products: built }, null, 2));
      console.log(`  (dry run — nothing sent)`);
      continue;
    }
    if (!domain.token) { console.warn(`  ⚠️  No token for ${domain.label} — skipping`); continue; }
    try {
      await batchsave(domain, built);
      console.log(`  ✓ Updated SEO on ${built.length} products (${domain.label})`);
    } catch (err) {
      console.error(`  ❌ ${domain.label}: ${err.message}`);
      errors.push(err.message);
    }
  }

  if (errors.length) { console.error(`\n⚠️  Completed with ${errors.length} error(s).`); process.exit(1); }
  console.log('\n✅ Product SEO pushed successfully.');
}

main().catch(err => { console.error('❌ Fatal error:', err.message); process.exit(1); });
