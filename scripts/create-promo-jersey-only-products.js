'use strict';

/**
 * Create the hidden "jersey only (promo rate)" helper products — one per kit-ladder row per store.
 *
 *   node scripts/create-promo-jersey-only-products.js                 # dry run (default)
 *   node scripts/create-promo-jersey-only-products.js --live          # create for real
 *   node scripts/create-promo-jersey-only-products.js --live --lang es
 *
 * WHY (owner, 21-22 Oct 2026). A "Promo" store product locks a kit at its ladder price (26.90 at 10-19, 23.90 at 20-49).
 * A player who wants the jersey only used to pay the full kit price: the platform bills "units of a product at that
 * product's price", so there is no way to say "kit minus shorts" at checkout. The ladder tells us the answer for every
 * locked price (jersey-only = kit price - the shorts price of the same row: 26.90 -> 21.90, 23.90 -> 18.90), so ONE small
 * generic set per store is enough — nothing per team, no SQL row: the design server (GoodInfoAction, design-momuto
 * server-patches) bills one unit of the matching helper for each jersey-only player of a promo kit.
 *
 * Rows (owner: only 10-19 and 20-49 for now; the lower rows can be added here later):
 *   EUR stores (en/es/fr/it):  kit 26.90 -> jersey 21.90   |  kit 23.90 -> jersey 18.90
 *   us (USD):                  kit 30.90 -> jersey 25.90   |  kit 26.90 -> jersey 21.90
 * (docs: rule 6 in CLAUDE.md, docs/us-launch-status.md ladder, the pricing tables on the kit-pricing page.)
 *
 * Same pattern as create-fast-lane-products.js: spec_mode 1, single variant, status 1 (must be purchasable to be billable)
 * but in NO collection (never browsable), no promos attached, idempotent by handle, read-back after every create.
 * Image = the image of the store's existing custom-jersey product (cms/order-line-tiles/products.json "jersey"), so it is
 * already on the store's own CDN (the US store requires that) and reads as the same jersey.
 * ids land in cms/promo-jersey-only/ids.json: { store: { "<kit price>": { id, handle, title, price, kitPrice } } } and the
 * server patch reads them.
 *
 * Runs on the GitHub runner; the sandbox cannot reach openapi.oemapps.com.
 */

const fs = require('fs');
const path = require('path');

const HOST = 'https://openapi.oemapps.com';
const ROOT = path.join(__dirname, '..');
const IDS_FILE = path.join(ROOT, 'cms', 'promo-jersey-only', 'ids.json');
const TILES = JSON.parse(fs.readFileSync(path.join(ROOT, 'cms', 'order-line-tiles', 'products.json'), 'utf8'));

// kit locked price -> jersey-only price (the same ladder row minus its shorts)
const ROWS = {
  en: [['26.90', '21.90'], ['23.90', '18.90']],
  es: [['26.90', '21.90'], ['23.90', '18.90']],
  fr: [['26.90', '21.90'], ['23.90', '18.90']],
  it: [['26.90', '21.90'], ['23.90', '18.90']],
  us: [['30.90', '25.90'], ['26.90', '21.90']],
};

// The titles must NOT contain kit / shorts / socks / long sleeve / collar / deposit / fast-lane words:
// lib/order-lines.js classifies platform order lines by title and the default (jersey) is what we want.
const STORES = {
  en: { tokenEnv: 'OEMSAAS_TOKEN_EN', title: p => `Jersey, promo rate ${p}`, sub: 'Jersey only at the promo kit rate',
        mini: 'Billing line for a jersey-only player on a promo kit. Added automatically at checkout.' },
  es: { tokenEnv: 'OEMSAAS_TOKEN_ES', title: p => `Camiseta, tarifa promo ${p.replace('.', ',')}`, sub: 'Solo camiseta a tarifa promo del kit',
        mini: 'Línea de cobro para un jugador solo camiseta en un kit promo. Se añade automáticamente al pagar.' },
  fr: { tokenEnv: 'OEMSAAS_TOKEN_FR', title: p => `Maillot, tarif promo ${p.replace('.', ',')}`, sub: 'Maillot seul au tarif promo de la tenue',
        mini: 'Ligne de facturation pour un joueur maillot seul sur une tenue promo. Ajoutée automatiquement au paiement.' },
  it: { tokenEnv: 'OEMSAAS_TOKEN_IT', title: p => `Maglia, tariffa promo ${p.replace('.', ',')}`, sub: 'Solo maglia alla tariffa promo del kit',
        mini: 'Riga di fatturazione per un giocatore solo maglia su un kit promo. Aggiunta automaticamente al pagamento.' },
  us: { tokenEnv: 'OEMSAAS_TOKEN_US', title: p => `Jersey, promo rate ${p}`, sub: 'Jersey only at the promo kit rate',
        mini: 'Billing line for a jersey-only player on a promo kit. Added automatically at checkout.' },
};

const handleOf = jerseyPrice => `jersey-only-promo-${jerseyPrice.replace('.', '-')}`;

function parseArgs(argv) {
  const a = { live: false, lang: 'all' };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--live') a.live = true;
    else if (k === '--dry-run') a.live = false;
    else if (k === '--lang') a.lang = argv[++i];
    else { console.error(`Unknown argument: ${k}`); process.exit(1); }
  }
  if (a.lang !== 'all' && !STORES[a.lang]) { console.error(`Unknown lang "${a.lang}"`); process.exit(1); }
  return a;
}

async function api(pathname, method, token, body) {
  const res = await fetch(`${HOST}${pathname}`, { method, headers: { 'Content-Type': 'application/json', token }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { throw new Error(`HTTP ${res.status} — non-JSON: ${text.slice(0, 300)}`); }
  if (json.code !== 0) throw new Error(`API code ${json.code}: ${json.msg}`);
  return json.data;
}

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

/** the store's own custom-jersey product image (already on that store's CDN) */
async function jerseyImage(lang, token) {
  const id = TILES.products.jersey[lang];
  if (!id || !token) return null;
  try {
    const p = await api(`/products/${id}`, 'GET', token);
    const src = p && p.images && p.images[0] && p.images[0].src;
    return src || null;
  } catch (e) { console.log(`  (could not read the jersey product ${id}: ${e.message})`); return null; }
}

function buildBody(store, jerseyPrice, imageSrc) {
  const title = store.title(jerseyPrice);
  return {
    title, handle: handleOf(jerseyPrice), spec_mode: 1, variants: [{ price: jerseyPrice }],
    images: [{ src: imageSrc, alt: title }], status: 1,
    subtitle: store.sub, mini_detail: store.mini, meta_title: title, meta_descript: store.mini, product_detail: 0,
  };
}

const loadIds = () => { try { return JSON.parse(fs.readFileSync(IDS_FILE, 'utf8')); } catch { return {}; } };
const saveIds = ids => { fs.mkdirSync(path.dirname(IDS_FILE), { recursive: true }); fs.writeFileSync(IDS_FILE, JSON.stringify(ids, null, 2) + '\n'); };

async function run() {
  const args = parseArgs(process.argv);
  const langs = args.lang === 'all' ? Object.keys(STORES) : [args.lang];
  const ids = loadIds();
  let failed = false;

  for (const lang of langs) {
    const store = STORES[lang];
    const token = process.env[store.tokenEnv];
    const img = await jerseyImage(lang, token);
    console.log(`\n=== ${lang.toUpperCase()} === image: ${img || '(none yet — needs the token on the runner)'}`);
    for (const [kitPrice, jerseyPrice] of ROWS[lang]) {
      const body = buildBody(store, jerseyPrice, img || 'IMAGE_FROM_STORE_JERSEY_PRODUCT');
      console.log(`\n-- kit ${kitPrice} -> jersey-only ${jerseyPrice}: "${body.title}" (${body.handle})`);
      if (!args.live) { console.log('[dry run] would POST /products with:'); console.log(JSON.stringify(body, null, 2)); continue; }
      if (!token) { console.error(`MISSING ${store.tokenEnv} — skipping ${lang}`); failed = true; continue; }
      if (!img) { console.error(`${lang}: no jersey image found — refusing to create a product without a photo`); failed = true; continue; }
      try {
        const existing = await findByHandle(token, body.handle);
        let id;
        if (existing) { id = existing.id; console.log(`already exists: id ${id} ("${existing.title}") — not creating a duplicate`); }
        else {
          const created = await api('/products', 'POST', token, body);
          id = created && created.id;
          if (!id) throw new Error(`create returned no id: ${JSON.stringify(created).slice(0, 300)}`);
          console.log(`created: id ${id}`);
        }
        const live = await api(`/products/${id}`, 'GET', token);
        const price = live && live.variants && live.variants[0] && live.variants[0].price;
        const ok = live && live.title === body.title && Number(price).toFixed(2) === jerseyPrice && live.status === 1;
        console.log(`read-back: title="${live && live.title}" price=${price} status=${live && live.status} → ${ok ? 'VERIFIED' : 'MISMATCH'}`);
        if (!ok) { console.error(`product ${id} does not match the expected shape — fix it in manage or delete it, then re-run`); failed = true; continue; }
        ids[lang] = ids[lang] || {};
        ids[lang][kitPrice] = { id: String(id), handle: body.handle, title: body.title, price: jerseyPrice, kitPrice, verifiedAt: new Date().toISOString() };
      } catch (e) { console.error(`${lang} ${kitPrice} FAILED: ${e.message}`); failed = true; }
    }
  }

  if (args.live) { saveIds(ids); console.log(`\nids written to ${path.relative(ROOT, IDS_FILE)}:\n${JSON.stringify(ids, null, 2)}`); }
  else console.log('\n[dry run] no requests sent, no ids written. Re-run with --live to create.');
  if (failed) process.exit(1);
}

if (require.main === module) run().catch(e => { console.error(e); process.exit(1); });
module.exports = { ROWS, handleOf };
