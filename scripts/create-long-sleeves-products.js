'use strict';

/**
 * Create the "Long sleeves" surcharge product on each store (EN/ES/FR/IT).
 *
 *   node scripts/create-long-sleeves-products.js                 # dry run (default)
 *   node scripts/create-long-sleeves-products.js --live          # create for real
 *   node scripts/create-long-sleeves-products.js --live --lang fr
 *
 * One €3.00 product per store. It is the billing vehicle for the per-player
 * long-sleeve option: the cart adds qty = number of long-sleeve jerseys in
 * the roster. Flat +3 € at every quantity tier — the customer-facing surfaces
 * show resulting unit prices (e.g. 21,90 → 24,90), never a "+3 €" fee line;
 * this product is the only place the bare 3.00 exists.
 *
 * Deliberately:
 *   - spec_mode 1, single variant, no sizes — quantity carries the count
 *   - status 1 (must be purchasable to be billable) but in NO collection,
 *     so it is never browsable from the storefront nav
 *   - no promos/collections attached — the seasonal −10% must not touch it
 *   - idempotent: reads the store catalogue first and skips handles that
 *     already exist (POST /products happily duplicates — see
 *     docs/oemsaas-api-notes.md), recording the existing id instead
 *   - read-back verification after every create: code 0 is an ack, not
 *     evidence (same doc, "The one rule")
 *   - ids land in cms/long-sleeves/ids.json (committed back by the
 *     workflow) — the server-side cart patch reads its per-store id there
 *
 * Runs on the GitHub runner; the sandbox cannot reach openapi.oemapps.com.
 */

const fs = require('fs');
const path = require('path');

const HOST = 'https://openapi.oemapps.com';
const ROOT = path.join(__dirname, '..');
const IDS_FILE = path.join(ROOT, 'cms', 'long-sleeves', 'ids.json');

const PRICE = '3.00';
const HANDLE = 'long-sleeves';

// Neutral jersey asset already on the store CDN. images[].src is required by
// POST /products; swap for a dedicated sleeve visual later via manage (the
// product page is never browsed — the cart line shows title + price).
const IMAGE_SRC = process.env.LS_IMAGE_SRC
  || 'https://cdn.staticsoe.com/pics/2cb10a0b0e8d3a67c7e768edce1a31d321097b8e26180eea525f683bf4df933b.jpg';

const STORES = {
  en: {
    tokenEnv: 'OEMSAAS_TOKEN_EN',
    title: 'Long sleeves',
    subtitle: 'Long-sleeve jersey option',
    mini_detail: 'Per-jersey long-sleeve option — one unit per long-sleeve jersey in your squad. Added automatically from your cart roster.',
  },
  es: {
    tokenEnv: 'OEMSAAS_TOKEN_ES',
    title: 'Manga larga',
    subtitle: 'Opción de camiseta de manga larga',
    mini_detail: 'Opción de manga larga por camiseta: una unidad por cada camiseta de manga larga de tu plantilla. Se añade automáticamente desde el carrito.',
  },
  fr: {
    tokenEnv: 'OEMSAAS_TOKEN_FR',
    title: 'Manches longues',
    subtitle: 'Option maillot manches longues',
    mini_detail: 'Option manches longues par maillot : une unité par maillot manches longues de votre effectif. Ajoutée automatiquement depuis le panier.',
  },
  it: {
    tokenEnv: 'OEMSAAS_TOKEN_IT',
    title: 'Maniche lunghe',
    subtitle: 'Opzione maglia a maniche lunghe',
    mini_detail: 'Opzione maniche lunghe per maglia: una unità per ogni maglia a maniche lunghe della tua rosa. Aggiunta automaticamente dal carrello.',
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
  if (json.code !== 0) {
    throw new Error(`API code ${json.code}: ${json.msg}${decodeMsg(json.msg)}`);
  }
  return json.data;
}

// POST /products is not idempotent — a duplicate handle creates a second
// product with a suffixed URL. Read the catalogue first and match by handle.
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
    variants: [{ price: PRICE }],
    images: [{ src: IMAGE_SRC, alt: store.title }],
    status: 1,
    subtitle: store.subtitle,
    mini_detail: store.mini_detail,
    meta_title: store.title,
    meta_descript: store.mini_detail,
    product_detail: 0,
  };
}

function loadIds() {
  try { return JSON.parse(fs.readFileSync(IDS_FILE, 'utf8')); }
  catch { return {}; }
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
    console.log(`\n=== ${lang.toUpperCase()} — "${store.title}" @ €${PRICE} ===`);

    if (!args.live) {
      console.log('[dry run] would POST /products with:');
      console.log(JSON.stringify(body, null, 2));
      continue;
    }
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
      const ok = live && live.title === store.title && String(price) === PRICE && live.status === 1;
      console.log(`read-back: title="${live && live.title}" price=${price} status=${live && live.status} → ${ok ? 'VERIFIED' : 'MISMATCH'}`);
      if (!ok && !existing) { failed = true; continue; }
      if (!ok && existing) {
        // A pre-existing product with this handle but different shape is a
        // decision for the owner, not something to overwrite blind.
        console.error(`existing product ${id} does not match the expected shape — fix it in manage or delete it, then re-run`);
        failed = true;
        continue;
      }

      ids[lang] = { id: String(id), handle: HANDLE, title: store.title, price: PRICE, verifiedAt: new Date().toISOString() };
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
