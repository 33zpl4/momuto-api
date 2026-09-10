'use strict';

/**
 * Create the "MOMUTO Pro Basketball Shorts" billable product (US store first).
 *
 *   node scripts/create-basketball-shorts-product.js                 # dry run (default)
 *   node scripts/create-basketball-shorts-product.js --live          # create for real
 *   node scripts/create-basketball-shorts-product.js --live --lang us
 *
 * Owner ruling 10 Sep 2026: basketball shares the football ladder, so the
 * shorts are $20.90 like "MOMUTO Shorts Pro" (16913798) and sit in the same
 * "customized" collection as the other generic billables. The 3D tool has no
 * basketball-shorts model yet, so like the football shorts the product carries
 * no 3D pointer (empty inner_title) — it is the order line the tool will bill
 * once basketball shorts ship, and the product the quantity-discount campaign
 * is attached to.
 *
 * Deliberately (same shape as create-long-sleeves-products.js):
 *   - spec_mode 1, single variant, no sizes — sizes ride the 3D roster
 *   - idempotent: reads the catalogue and skips handles that already exist
 *     (POST /products duplicates happily — docs/oemsaas-api-notes.md)
 *   - read-back verification after every create: code 0 is an ack, not evidence
 *   - ids land in cms/basketball-shorts/ids.json (committed back by the workflow)
 *   - the catalogue photo starts as the football shorts tile already on the
 *     store CDN (images[].src must be a CDN path); swap it for
 *     custom-design-basketshorts-en.png in the admin (no image-upload API)
 *
 * Runs on the GitHub runner; the sandbox cannot reach openapi.oemapps.com.
 */

const fs = require('fs');
const path = require('path');

const HOST = 'https://openapi.oemapps.com';
const ROOT = path.join(__dirname, '..');
const IDS_FILE = path.join(ROOT, 'cms', 'basketball-shorts', 'ids.json');
const HANDLE = 'momuto-pro-basketball-shorts';

const STORES = {
  us: {
    tokenEnv: 'OEMSAAS_TOKEN_US',
    price: '20.90',
    title: 'MOMUTO Pro Basketball Shorts',
    subtitle: 'Custom basketball shorts, made to order',
    mini_detail: 'This line is your made-to-order basketball shorts. Your actual design is pictured on its own line of the order.',
    // "customized" — the collection MOMUTO Pro Jersey / Shorts Pro / the basketball jersey sit in
    collection_id: 558092,
    // MOMUTO Shorts Pro's tile, already on the US CDN — placeholder until the basketball tile is uploaded
    image_src: 'https://cdn.statics-cdn-abc.com/pics/56643e1d7c881e2208d1449056e34f5f5bd2e83025faaecc3f76c635db3f2b2e.jpg',
  },
};

function parseArgs(argv) {
  const a = { live: false, lang: 'all' };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--live') a.live = true;
    else if (k === '--dry-run') a.live = false;
    else if (k === '--lang') a.lang = argv[++i];
    else { console.error(`Unknown argument: ${k}`); process.exit(1); }
  }
  if (a.lang !== 'all' && !STORES[a.lang]) {
    console.error(`Unknown lang "${a.lang}" — use all|${Object.keys(STORES).join('|')}`);
    process.exit(1);
  }
  return a;
}

function decodeMsg(msg) {
  const field = /([a-z_0-9.]+)\s*(不能为空|不能為空|格式|错误|無效|无效)/i.exec(msg || '');
  return field ? `  (field: "${field[1]}" — 不能为空 = cannot be empty)` : '';
}

async function api(pathname, method, token, body) {
  const res = await fetch(`${HOST}${pathname}`, {
    method,
    headers: { 'Content-Type': 'application/json', token },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error(`HTTP ${res.status} — non-JSON: ${text.slice(0, 300)}`); }
  if (json.code !== 0) throw new Error(`API code ${json.code}: ${json.msg}${decodeMsg(json.msg)}`);
  return json.data;
}

// POST /products is not idempotent — read the catalogue first and match by handle.
async function findByHandle(token, handle) {
  let since = '';
  for (;;) {
    const page = await api(`/products?limit=100${since ? `&since_id=${since}` : ''}`, 'GET', token);
    const list = Array.isArray(page) ? page : (page && page.products) || [];
    if (!list.length) return null;
    const hit = list.find(p => p.handle === handle);
    if (hit) return hit;
    if (list.length < 100) return null;
    since = list[list.length - 1].id;
  }
}

function buildBody(store) {
  return {
    title: store.title,
    handle: HANDLE,
    spec_mode: 1,
    variants: [{ price: store.price }],
    images: [{ src: store.image_src, alt: store.title }],
    status: 1,
    subtitle: store.subtitle,
    mini_detail: store.mini_detail,
    meta_title: store.title,
    meta_descript: store.mini_detail,
    meta_keywords: ['custom basketball shorts', 'basketball uniform shorts', 'MOMUTO'],
    collections: [{ collection_id: store.collection_id }],
    product_detail: 0,
  };
}

function loadIds() {
  try { return JSON.parse(fs.readFileSync(IDS_FILE, 'utf8')); } catch { return {}; }
}
function saveIds(ids) {
  fs.mkdirSync(path.dirname(IDS_FILE), { recursive: true });
  fs.writeFileSync(IDS_FILE, JSON.stringify(ids, null, 2) + '\n');
}

async function run() {
  const args = parseArgs(process.argv);
  const langs = args.lang === 'all' ? Object.keys(STORES) : [args.lang];
  const ids = loadIds();
  let failed = false;

  for (const lang of langs) {
    const store = STORES[lang];
    const token = process.env[store.tokenEnv];
    const body = buildBody(store);
    console.log(`\n=== ${lang.toUpperCase()} — "${store.title}" @ ${store.price} ===`);
    if (!args.live) { console.log('[dry run] would POST /products with:'); console.log(JSON.stringify(body, null, 2)); continue; }
    if (!token) { console.error(`MISSING ${store.tokenEnv} — skipping ${lang}`); failed = true; continue; }

    try {
      const existing = await findByHandle(token, HANDLE);
      let id;
      if (existing) {
        id = existing.id;
        console.log(`already exists: id ${id} ("${existing.title}") — not creating a duplicate`);
      } else {
        const created = await api('/products', 'POST', token, body);
        id = created && created.id;
        if (!id) throw new Error(`create returned no id: ${JSON.stringify(created).slice(0, 300)}`);
        console.log(`created: id ${id}`);
      }
      // Read back — the ack is not evidence.
      const live = await api(`/products/${id}`, 'GET', token);
      const price = live && live.variants && live.variants[0] && live.variants[0].price;
      const ok = live && live.title === store.title && Number(price).toFixed(2) === store.price && live.status === 1;
      console.log(`read-back: title="${live && live.title}" price=${price} status=${live && live.status} → ${ok ? 'VERIFIED' : 'MISMATCH'}`);
      if (!ok) {
        console.error(existing
          ? `existing product ${id} does not match the expected shape — fix it in manage or delete it, then re-run`
          : `created product ${id} failed read-back verification`);
        failed = true; continue;
      }
      ids[lang] = { id: String(id), handle: HANDLE, title: store.title, price: store.price, verifiedAt: new Date().toISOString() };
    } catch (e) {
      console.error(`${lang} FAILED: ${e.message}`);
      failed = true;
    }
  }

  if (args.live) {
    saveIds(ids);
    console.log(`\nids written to ${path.relative(ROOT, IDS_FILE)}:`);
    console.log(JSON.stringify(ids, null, 2));
  } else {
    console.log('\n[dry run] no requests sent, no ids written. Re-run with --live to create.');
  }
  if (failed) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
