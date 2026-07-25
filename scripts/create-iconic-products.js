'use strict';

/**
 * Create (or update) Iconic Series products via the OEMSaaS OpenAPI.
 *
 *   node scripts/create-iconic-products.js --slug el-himno --dry-run [--verbose]
 *   node scripts/create-iconic-products.js --slug el-himno --lang en
 *   node scripts/create-iconic-products.js --drop drop-02 --lang en
 *
 * Reads product data from iconic-series/<drop>/<slug>.json and the page body
 * from iconic-series/build/<drop>/<slug>.<lang>.html (run build-iconic-pages
 * first). Sends title, handle, size variants, images, body_html and SEO in a
 * single POST /products — see docs/cms-product-create-api.md.
 *
 * SAFETY, deliberately:
 *   - products are created HIDDEN (status 0) unless --publish is passed
 *   - nothing runs without --slug or --drop; there is no implicit "all"
 *   - --dry-run prints the exact JSON body and sends nothing
 *   - --update PATCHes body_html/SEO on an existing product id instead of
 *     creating a duplicate (drop 01 retrofit)
 *
 * These shirts have no 3D customizer, so `inner_title` is omitted entirely —
 * the configId/productId dependency in the docs does not apply here.
 *
 * Runs on the GitHub runner; the sandbox cannot reach openapi.oemapps.com.
 */

const fs = require('fs');
const path = require('path');

const HOST = 'https://openapi.oemapps.com';
const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'iconic-series');
const config = JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8'));

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

function parseArgs(argv) {
  const a = { slug: null, drop: null, lang: 'en', dryRun: false, publish: false, update: false, verbose: false, inspect: null, probe: false, delete: null, collections: null, audit: null, writeIds: false };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--audit') a.audit = argv[++i];
    else if (k === '--write-ids') a.writeIds = true;
    else if (k === '--collections') a.collections = argv[++i] || 'all';
    else if (k === '--delete') a.delete = argv[++i];
    else if (k === '--probe') a.probe = true;
    else if (k === '--inspect') a.inspect = argv[++i];
    else if (k === '--slug') a.slug = argv[++i];
    else if (k === '--drop') a.drop = argv[++i];
    else if (k === '--lang') a.lang = argv[++i];
    else if (k === '--dry-run') a.dryRun = true;
    else if (k === '--publish') a.publish = true;
    else if (k === '--update') a.update = true;
    else if (k === '--verbose') a.verbose = true;
    else { console.error(`Unknown argument: ${k}`); process.exit(1); }
  }
  return a;
}

function findProduct(slug, drop) {
  const drops = drop ? [drop] : Object.keys(config.drops);
  for (const d of drops) {
    const p = path.join(DIR, d, `${slug}.json`);
    if (fs.existsSync(p)) return { ...JSON.parse(fs.readFileSync(p, 'utf8')), drop: d };
  }
  return null;
}

function loadDrop(drop) {
  const dir = path.join(DIR, drop);
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => ({ ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), drop }))
    .sort((a, b) => a.number.localeCompare(b.number));
}

/**
 * The size options + variants half of the payload.
 *
 * On a live product the variants reference the option and value by *id*
 * (`option1: 7294970`, `option1_value: 36429091`) — ids the API assigns at
 * create time, so they cannot be sent on the create itself. Sending titles
 * alone returned `数据不存在` (data does not exist).
 *
 * SHAPE is which way round we ask for it; `--probe` establishes the answer
 * empirically against throwaway hidden products. Set via ICONIC_SIZE_SHAPE.
 */
const SHAPES = {
  // options declared; variants carry titles only and the API links them
  titles: (item, price) => ({
    options: [{ option_name: 'Size', position: 0, values: SIZES.map((s, i) => ({ option_value: s, position: i })) }],
    variants: SIZES.map((s, i) => ({
      price, option1_title: 'Size', option1_value_title: s,
      sku: `${item.number.replace(/[–—]/g, '-')}-${s}`, position: i,
    })),
  }),
  // as above but with the id fields explicitly zeroed, as they appear on a
  // spec_mode 1 product where they are unused
  zeroed: (item, price) => ({
    options: [{ option_name: 'Size', position: 0, values: SIZES.map((s, i) => ({ option_value: s, position: i })) }],
    variants: SIZES.map((s, i) => ({
      price, option1_title: 'Size', option1_value_title: s, option1: 0, option1_value: 0,
      sku: `${item.number.replace(/[–—]/g, '-')}-${s}`, position: i,
    })),
  }),
  // declare the options and let the API generate the variant matrix itself
  optionsonly: (item, price) => ({
    options: [{ option_name: 'Size', position: 0, values: SIZES.map((s, i) => ({ option_value: s, position: i })) }],
    variants: [{ price }],
  }),
  // variants describe the sizes; no separate options array
  variantsonly: (item, price) => ({
    variants: SIZES.map((s, i) => ({
      price, option1_title: 'Size', option1_value_title: s,
      sku: `${item.number.replace(/[–—]/g, '-')}-${s}`, position: i,
    })),
  }),
};

/**
 * "titles" is the established shape — --probe confirmed it produces all six
 * size variants, with the API assigning the option/value ids and linking the
 * variants itself. The earlier `数据不存在` was 1-based `position` on values
 * the API expects to be 0-based, not the linkage.
 */
function sizeShape(item, price) {
  const name = process.env.ICONIC_SIZE_SHAPE || 'titles';
  const fn = SHAPES[name];
  if (!fn) throw new Error(`unknown ICONIC_SIZE_SHAPE "${name}" (${Object.keys(SHAPES).join(', ')})`);
  return fn(item, price);
}

/**
 * Collection ids are PER STORE — the EN series collection is 129055, the ES /
 * FR / IT stores have their own. Both config fields accept either a plain
 * number (legacy, EN-only) or a { en, es, fr, it } object.
 */
function idFor(value, lang) {
  if (value == null) return null;
  return typeof value === 'object' ? (value[lang] ?? null) : value;
}

/**
 * Product ids are PER STORE, like collection ids. Accepts either a bare string
 * (legacy, EN-only) or a { en, es, fr, it } object.
 */
function productIdFor(item, lang) {
  const v = item.product_id;
  if (v == null) return null;
  return typeof v === 'object' ? (v[lang] ?? null) : (lang === 'en' ? v : null);
}

function collectionsFor(drop, lang) {
  const series = idFor(config.collection_id, lang);
  const dropId = idFor(config.drops[drop]?.collection?.collection_id, lang);
  const ids = [series, dropId].filter(id => id != null);
  const unique = [...new Set(ids)];
  if (!unique.length) {
    throw new Error(`no collection id for lang "${lang}" — run --collections to find it, ` +
      `then set collection_id.${lang} in iconic-series/config.json`);
  }
  return unique.map(collection_id => ({ collection_id }));
}

function buildBody(item, lang, { publish }) {
  const copy = item.page?.[lang];
  if (!copy?.moment_body) throw new Error(`no ${lang} copy — nothing to publish`);

  const bodyPath = path.join(DIR, 'build', item.drop, `${item.slug}.${lang}.html`);
  if (!fs.existsSync(bodyPath)) {
    throw new Error(`missing ${path.relative(ROOT, bodyPath)} — run scripts/build-iconic-pages.js first`);
  }
  const bodyHtml = fs.readFileSync(bodyPath, 'utf8');

  if (!item.image) throw new Error('no product image set (iconic-series/<drop>/<slug>.json "image")');

  const price = Number(String(config.price).replace(/[^\d.]/g, '')).toFixed(2);
  const alt = `${item.display_title} — ${config.strings[lang].series_name} ${item.number}`;

  // Back view first: the framed artwork is the product, and it's what the
  // collection grid already leads with.
  const images = [{ src: item.image, alt: `${alt}, back` }];
  if (item.image_front) images.push({ src: item.image_front, alt: `${alt}, front` });

  const dropCfg = config.drops[item.drop];
  const strings = config.strings[lang];

  // mini_detail is the short block above the buy button. Shape copied verbatim
  // from im-01-the-volley: ref + title, price as an h2, then the spec line.
  // Note the number uses an EN DASH here but a HYPHEN in meta_title — that is
  // how the live products read, so it is reproduced rather than normalised.
  const enDash = item.number.replace(/-/g, '–');
  const hyphen = item.number.replace(/[–—]/g, '-');
  const miniDetail = `<p><strong>${enDash} // ${item.display_title}</strong></p>` +
    `<h2>${config.price}</h2><p>${strings.spec_line}</p>`;

  return {
    title: item.display_title,
    handle: item.handle,
    // spec_mode 2 = size options. Shape mirrors the live im-01-the-volley
    // product read back via --inspect: option_name (not option_title), and
    // 0-based `position` on both the option and its values.
    spec_mode: 2,
    ...sizeShape(item, price),
    images,
    body_html: bodyHtml,
    status: publish ? 1 : 0,
    subtitle: dropCfg.subtitle[lang] || dropCfg.subtitle.en,
    mini_detail: miniDetail,
    meta_title: copy.meta_title || `${item.display_title} – ${strings.series_name} ${hyphen} | MOMUTO`,
    meta_descript: copy.meta_description,
    // Every product joins the SERIES collection; a drop with its own
    // collection adds a second membership. Without any of this the product
    // exists only at its direct URL and appears on no collection page.
    collections: collectionsFor(item.drop, lang),
    ...config.product_defaults,
    product_detail: 1,
  };
}

/**
 * The --update body. Sends the whole editorial surface, not just body_html: a
 * product created before a payload fix keeps its stale subtitle/mini_detail
 * otherwise, and those are the fields visible above the buy button.
 *
 * `images` matters when mockups are re-rendered — the CDN URL changes and the
 * gallery is the one surface body_html cannot reach. Whether batchsave replaces
 * the array or ignores it is unproven, so confirm with --audit afterwards.
 *
 * Not sent: collections. Membership stays as set in the CMS.
 */
function updatePayload(item, body, lang) {
  const id = productIdFor(item, lang);
  if (!id) throw new Error(`--update needs product_id.${lang} in the product JSON`);
  return {
    products: [{
      id,
      title: body.title,
      subtitle: body.subtitle,
      mini_detail: body.mini_detail,
      body_html: body.body_html,
      meta_title: body.meta_title,
      meta_descript: body.meta_descript,
      images: body.images,
    }],
  };
}

/**
 * The gallery, sent separately.
 *
 * `batchsave` is documented as a partial update carrying SEO fields, and a
 * clean 5-product run confirmed it silently drops `images` — meta landed, the
 * photos didn't. `PUT /products/{id}` is the endpoint that takes them;
 * scripts/cleanup-preview-products.js already uses it to flip `status`.
 *
 * PUT is a REPLACE, not a merge: `{ id, images }` came back `title不能为空`.
 * So the only safe payload is the live product read straight back with nothing
 * changed but `images` — anything we compose ourselves risks dropping a field
 * we never knew the product had. `variants` above all: a PUT without them
 * would take the six sizes and the buy button with them.
 */
async function putImages(item, body, lang, token) {
  const id = productIdFor(item, lang);
  if (!id) throw new Error(`needs product_id.${lang} in the product JSON`);

  const live = await fetchProduct(id, token);
  if (!live) throw new Error(`could not read product ${id} back — refusing to PUT blind`);
  if (!live.title) throw new Error(`product ${id} read back without a title — refusing to PUT`);
  if (!Array.isArray(live.variants) || !live.variants.length) {
    throw new Error(`product ${id} read back with no variants — refusing to PUT (it would drop the sizes)`);
  }

  return send(`${HOST}/products/${id}`, 'PUT', token, { ...live, images: body.images });
}

/** Single-product read. The list endpoint omits heavyweight fields. */
async function fetchProduct(id, token) {
  try {
    const res = await fetch(`${HOST}/products/${id}`, { headers: { token } });
    const json = await res.json().catch(() => ({}));
    if (json.code !== 0) return null;
    const p = json.data?.product || json.data || null;
    return p && typeof p === 'object' && !Array.isArray(p) ? p : null;
  } catch { return null; }
}

function summarise(payload, verbose) {
  if (verbose) return payload;
  const elide = b => ({ ...b, body_html: `<${String(b.body_html || '').length} chars of HTML — pass --verbose to print it>` });
  if (Array.isArray(payload.products)) return { products: payload.products.map(elide) };
  return elide(payload);
}

async function send(url, method, token, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', token },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch {
    throw new Error(`HTTP ${res.status}, non-JSON response: ${text.slice(0, 500)}`);
  }
  if (json.code !== 0) {
    // Errors come back in Chinese; surface the offending field plainly so the
    // next fix targets it instead of guessing at the whole payload again.
    const field = /([a-z_0-9.]+)\s*(不能为空|不能為空|格式|错误|無效|无效)/i.exec(json.msg);
    const hint = field ? `  (field: "${field[1]}" — 不能为空 = cannot be empty)` : '';
    throw new Error(`API code ${json.code}: ${json.msg}${hint}`);
  }
  return json.data || {};
}

/**
 * READ-ONLY. Page through GET /products and dump the options/variants shape of
 * an existing product. The drop 01 shirts already have XS–XXL sizes, so their
 * object is the known-good spec_mode 2 payload — worth reading rather than
 * guessing at. Same cursor pagination as scripts/pull-cms.js.
 */
async function inspect(handleOrUrl, token) {
  // Accept a pasted product URL as well as a bare handle.
  const handle = String(handleOrUrl).trim()
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/^\/?products\//, '')
    .replace(/[/?#].*$/, '');
  if (handle !== String(handleOrUrl).trim()) console.log(`handle: ${handle}`);
  const limit = 100;
  let since = '';
  for (let page = 0; page < 50; page++) {
    const res = await fetch(`${HOST}/products?limit=${limit}${since ? `&since_id=${since}` : ''}`, { headers: { token } });
    const json = await res.json();
    if (json.code !== 0) throw new Error(`API code ${json.code}: ${json.msg}`);
    const items = json.data?.products || json.data?.list || json.data || [];
    if (!Array.isArray(items) || !items.length) break;

    const hit = items.find(p => p.handle === handle || String(p.id) === handle);
    if (hit) {
      console.log(`FOUND "${hit.title}" · id ${hit.id} · handle ${hit.handle}`);
      console.log(`spec_mode: ${hit.spec_mode}`);

      // Everything we have to match when creating a sibling product. Dumped
      // rather than guessed — body_html is elided, it's the one field we own.
      const META = ['title', 'handle', 'subtitle', 'mini_detail', 'meta_title', 'meta_descript',
        'meta_keywords', 'tags', 'product_type', 'vendor', 'spu', 'status',
        'free_shipping', 'taxable', 'inventory_tracking', 'inventory_policy', 'collections'];
      console.log('\n── metadata ──');
      for (const k of META) {
        if (hit[k] === undefined) continue;
        const v = hit[k];
        console.log(`${k}: ${typeof v === 'object' ? JSON.stringify(v) : JSON.stringify(v)}`);
      }
      // hit comes from the LIST endpoint, which may omit body_html. Re-read the
      // product on its own before reporting a length anyone might act on.
      let bodySrc = 'list', body = hit.body_html || '';
      const one = await fetchProduct(hit.id, token);
      if (one && one.body_html !== undefined) { body = one.body_html || ''; bodySrc = 'GET /products/{id}'; }
      console.log(`body_html: <${body.length} chars> (source: ${bodySrc})`);
      console.log(`images: ${(hit.images || []).length}` +
        ((hit.images || [])[0] ? ` · first alt ${JSON.stringify(hit.images[0].alt)}` : ''));

      console.log(`\n── options ──\n${JSON.stringify(hit.options, null, 2)}`);
      const v = (hit.variants || [])[0];
      console.log(`\nvariants: ${(hit.variants || []).length}`);
      if (v) {
        const optFields = Object.fromEntries(Object.entries(v).filter(([k]) => /^option/i.test(k)));
        console.log(`variant[0] option fields:\n${JSON.stringify(optFields, null, 2)}`);
        console.log(`variant[0] price/sku/weight: ${v.price} / ${v.sku} / ${v.weight}`);
        console.log(`variant[0] inventory: qty ${v.inventory_quantity}, tracking ${v.inventory_tracking}, policy ${v.inventory_policy}`);
      }
      return;
    }
    since = items[items.length - 1].id;
    if (items.length < limit) break;
  }
  console.error(`No product matching "${handle}". Pass a handle (im-05-the-116th) or a numeric id.`);
  process.exit(1);
}

/**
 * Try each size shape against the real API with a throwaway hidden product,
 * and report which one it accepts. One run settles the question instead of a
 * round trip per guess. Products are created hidden with a zz- handle; the
 * ids are printed so they can be deleted afterwards.
 */
async function probe(token) {
  const stamp = process.env.GITHUB_RUN_ID || 'local';
  const created = [];
  let winner = null;

  for (const name of Object.keys(SHAPES)) {
    const item = {
      number: 'ZZ-00', display_title: `ZZ probe ${name} — delete me`,
      handle: `zz-iconic-probe-${name}-${stamp}`,
      image: 'https://cdn.staticsoe.com/pics/13a865fb887709ed02d9f3b2a116bf420ff89e230b08db9c795f6b9cded3730d.webp',
    };
    const body = {
      title: item.display_title,
      handle: item.handle,
      spec_mode: name === 'variantsonly' ? 2 : 2,
      ...SHAPES[name](item, '39.00'),
      images: [{ src: item.image, alt: 'probe' }],
      status: 0,
      product_detail: 1,
    };
    try {
      const data = await send(`${HOST}/products`, 'POST', token, body);
      created.push({ name, id: data.id });
      console.log(`✓ ${name.padEnd(13)} accepted → product id ${data.id}`);
      const opts = data.options?.[0];
      const v0 = (data.variants || [])[0];
      console.log(`  variants: ${(data.variants || []).length}` +
        (opts ? ` · option id ${opts.id} "${opts.option_name}" with ${opts.values?.length} values` : ' · no options returned') +
        (v0 ? ` · variant[0] option1=${v0.option1} option1_value=${v0.option1_value} "${v0.option1_value_title}"` : ''));
      if (!winner && (data.variants || []).length === SIZES.length) winner = name;
    } catch (err) {
      console.log(`✗ ${name.padEnd(13)} ${err.message}`);
    }
  }

  console.log('\n────────────────────────────────────────');
  if (winner) {
    console.log(`WINNER: "${winner}" produced all ${SIZES.length} size variants.`);
    console.log(`Set it in the workflow env: ICONIC_SIZE_SHAPE=${winner}`);
  } else if (created.length) {
    console.log('Some shapes were accepted but none produced the full size matrix.');
    console.log('Check the variant counts above and inspect one in manage.');
  } else {
    console.log('No shape was accepted. Paste this output and we go again.');
  }
  if (created.length) {
    console.log(`\nDELETE THESE probe products: ${created.map(c => `${c.name}=${c.id}`).join(', ')}`);
    console.log('(handles start zz-iconic-probe-, all created hidden)');
  }
}

// Hard-delete products by id. Used to clear the throwaway probe products;
// same endpoint scripts/cleanup-preview-products.js uses in MODE=delete.
async function deleteProducts(ids, token) {
  for (const id of ids) {
    const res = await fetch(`${HOST}/products/${id}`, { method: 'DELETE', headers: { token } });
    const text = await res.text();
    let json = {};
    try { json = JSON.parse(text); } catch { /* some deletes return empty */ }
    if (res.ok && (json.code === 0 || json.code === undefined)) console.log(`✓ deleted ${id}`);
    else console.error(`✗ ${id}: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
}

/**
 * READ-ONLY. List the store's collections with their ids, so the per-store
 * collection_id can be recorded without hunting through the CMS. Ids differ
 * per store — the EN series collection is 129055, the others are not.
 */
async function listCollections(token, filter) {
  const seen = [];
  let page = 1;
  for (; page <= 20; page++) {
    const res = await fetch(`${HOST}/collections?page=${page}&pagesize=50`, { headers: { token } });
    const json = await res.json().catch(() => ({}));
    if (json.code !== 0) throw new Error(`API code ${json.code}: ${json.msg}`);
    const items = json.data?.collections || json.data?.list || json.data || [];
    if (!Array.isArray(items) || !items.length) break;
    seen.push(...items);
    if (items.length < 50) break;
  }
  const rx = filter && filter !== 'all' ? new RegExp(filter, 'i') : null;
  const rows = seen.filter(c => !rx || rx.test(c.handle || '') || rx.test(c.title || ''));
  console.log(`${seen.length} collections on this store; ${rows.length} shown\n`);
  for (const c of rows) {
    console.log(`id ${String(c.id).padEnd(10)} handle ${String(c.handle || '—').padEnd(34)} ${c.title || ''}`);
  }
  console.log('\nRecord these in iconic-series/config.json:');
  console.log('  collection_id.<lang>                        = the SERIES collection');
  console.log('  drops.drop-02.collection.collection_id.<lang> = the drop 02 collection');
}

/**
 * READ-ONLY. Fetch every product of a drop and diff the live record against
 * what the current payload would send. Products created before a payload fix
 * keep the old values silently — this is how you find out which, and it also
 * reports each product_id so --update can target them.
 */
async function audit(drop, lang, token, writeIds = false) {
  const items = loadDrop(drop);
  const byHandle = new Map(items.map(i => [i.handle, i]));

  // one pass over the catalogue rather than a request per product
  const live = new Map();
  let since = '';
  for (let page = 0; page < 50; page++) {
    const res = await fetch(`${HOST}/products?limit=100${since ? `&since_id=${since}` : ''}`, { headers: { token } });
    const json = await res.json().catch(() => ({}));
    if (json.code !== 0) throw new Error(`API code ${json.code}: ${json.msg}`);
    const batch = json.data?.products || json.data?.list || json.data || [];
    if (!Array.isArray(batch) || !batch.length) break;
    for (const p of batch) if (byHandle.has(p.handle)) live.set(p.handle, p);
    since = batch[batch.length - 1].id;
    if (batch.length < 100) break;
  }

  const FIELDS = ['title', 'subtitle', 'mini_detail', 'meta_title', 'meta_descript'];
  let drifted = 0, missing = 0;

  // The list endpoint is the only reader this script has ever used, and list
  // endpoints routinely omit heavyweight fields. A body_html of 0 chars read
  // that way does NOT prove the product has no body — and acting on it would
  // push a duplicate page. Re-read each product on its own before believing it.
  const single = new Map();
  let singleWorks = null;
  for (const item of items) {
    const p = live.get(item.handle);
    if (!p) continue;
    const one = await fetchProduct(p.id, token);
    if (one) { single.set(item.handle, one); singleWorks = true; }
    else if (singleWorks === null) singleWorks = false;
  }
  console.log(singleWorks
    ? 'body_html read per product (GET /products/{id})\n'
    : '⚠ GET /products/{id} unavailable — body_html below comes from the LIST\n' +
      '  endpoint, which may omit it. Do NOT read 0 chars as "no body_html".\n');

  for (const item of items) {
    const p = live.get(item.handle);
    if (!p) { console.log(`✗ ${item.handle} — NOT on this store`); missing++; continue; }
    const full = single.get(item.handle) || p;

    const want = buildBody({ ...item }, lang, { publish: false });
    const diffs = FIELDS.filter(f => String(p[f] ?? '') !== String(want[f] ?? ''));

    const liveColls = (p.collections || []).map(c => c.id).sort();
    const wantColls = want.collections.map(c => c.collection_id).sort();
    const collDrift = JSON.stringify(liveColls) !== JSON.stringify(wantColls);

    // The CMS stores body_html trimmed, so a repo file's trailing newline shows
    // up as a permanent 1-char drift on every product. Compare trimmed.
    const liveBody = String(full.body_html ?? '');
    const bodyDrift = liveBody.trim() !== want.body_html.trim();
    const variants = (p.variants || []).length;

    const liveImgs = (p.images || []).map(i => i.src);
    const wantImgs = want.images.map(i => i.src);
    const imgDrift = JSON.stringify(liveImgs) !== JSON.stringify(wantImgs);

    if (!diffs.length && !collDrift && !bodyDrift && !imgDrift && variants === SIZES.length) {
      console.log(`✓ ${item.handle.padEnd(22)} id ${p.id} — in sync`);
    } else {
      drifted++;
      console.log(`⚠ ${item.handle.padEnd(22)} id ${p.id}`);
      for (const f of diffs) {
        console.log(`    ${f}`);
        console.log(`      live: ${JSON.stringify(String(p[f] ?? '').slice(0, 90))}`);
        console.log(`      repo: ${JSON.stringify(String(want[f] ?? '').slice(0, 90))}`);
      }
      if (collDrift) console.log(`    collections  live: [${liveColls}]  repo: [${wantColls}]`);
      if (imgDrift) {
        console.log(`    images       live: ${liveImgs.length}  repo: ${wantImgs.length}`);
        for (let i = 0; i < Math.max(liveImgs.length, wantImgs.length); i++) {
          if (liveImgs[i] === wantImgs[i]) continue;
          console.log(`      [${i}] live: ${liveImgs[i] || '—'}`);
          console.log(`      [${i}] repo: ${wantImgs[i] || '—'}`);
        }
      }
      if (bodyDrift) {
        console.log(`    body_html    live: ${liveBody.length} chars  repo: ${want.body_html.length} chars`);
        // Our pages carry this marker. Finding it means the content is already
        // on the page from somewhere else — a custom template — and pushing
        // body_html would render the whole thing twice. This is the drop 01
        // retrofit trap, and it does not announce itself.
        if (!liveBody.includes('data-iconic-page') && singleWorks) {
          console.log('      ↳ no body_html on the product. If the page already renders our');
          console.log('        content, it comes from a template — strip that FIRST or the');
          console.log('        page will duplicate.');
        }
      }
      if (variants !== SIZES.length) console.log(`    variants     live: ${variants}  expected: ${SIZES.length}`);
    }
  }

  console.log(`\n${live.size}/${items.length} found · ${drifted} drifted · ${missing} missing`);

  // Only the EN store's ids belong in the shared product JSON — every other
  // store assigns its own, and writing those would point --update at the
  // wrong products.
  if (writeIds) {
    let wrote = 0;
    for (const item of items) {
      const p = live.get(item.handle);
      if (!p) continue;
      const file = path.join(DIR, drop, `${item.slug}.json`);
      const json = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (typeof json.product_id === 'string') json.product_id = { en: json.product_id };
      json.product_id = json.product_id || {};
      if (String(json.product_id[lang] ?? '') === String(p.id)) continue;
      json.product_id[lang] = String(p.id);
      fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
      console.log(`  recorded ${item.slug} → product_id.${lang} ${p.id}`);
      wrote++;
    }
    console.log(wrote ? `\n${wrote} id(s) written — commit them, then run with update: true.`
                      : '\nAll ids already recorded.');
  }

  if (drifted) {
    const noId = items.filter(i => live.has(i.handle) && !productIdFor(i, lang)).map(i => i.slug);
    if (noId.length && !writeIds) {
      console.log(`\n${noId.join(', ')} have no product_id.${lang} — re-run with write_ids, then update: true.`);
    } else if (!noId.length) {
      console.log('\nAll ids recorded — run with update: true to push the drift above.');
    }
    console.log('NOTE: --update sends title/subtitle/mini_detail/body_html/SEO/images — NOT collections.');
    console.log('Collection membership stays as set in the CMS.');
  }
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.audit) {
    const tv = `OEMSAAS_TOKEN_${args.lang.toUpperCase()}`;
    if (!process.env[tv]) { console.error(`No ${tv} in the environment.`); process.exit(1); }
    await audit(args.audit, args.lang, process.env[tv], args.writeIds);
    return;
  }

  if (args.collections) {
    const tv = `OEMSAAS_TOKEN_${args.lang.toUpperCase()}`;
    if (!process.env[tv]) { console.error(`No ${tv} in the environment.`); process.exit(1); }
    await listCollections(process.env[tv], args.collections);
    return;
  }

  if (args.delete) {
    const tv = `OEMSAAS_TOKEN_${args.lang.toUpperCase()}`;
    if (!process.env[tv]) { console.error(`No ${tv} in the environment.`); process.exit(1); }
    await deleteProducts(args.delete.split(',').map(s => s.trim()).filter(Boolean), process.env[tv]);
    return;
  }

  if (args.probe) {
    const tv = `OEMSAAS_TOKEN_${args.lang.toUpperCase()}`;
    if (!process.env[tv]) { console.error(`No ${tv} in the environment.`); process.exit(1); }
    await probe(process.env[tv]);
    return;
  }

  if (args.inspect) {
    const tv = `OEMSAAS_TOKEN_${args.lang.toUpperCase()}`;
    if (!process.env[tv]) { console.error(`No ${tv} in the environment.`); process.exit(1); }
    await inspect(args.inspect, process.env[tv]);
    return;
  }

  if (!args.slug && !args.drop) {
    console.error('Refusing to run without a target. Pass --slug <slug> or --drop <drop-0N>.');
    process.exit(1);
  }

  const items = args.slug
    ? [findProduct(args.slug, args.drop)].filter(Boolean)
    : loadDrop(args.drop);

  if (!items.length) {
    console.error(`No product data found for ${args.slug || args.drop}`);
    process.exit(1);
  }

  const tokenVar = `OEMSAAS_TOKEN_${args.lang.toUpperCase()}`;
  const token = process.env[tokenVar];
  if (!args.dryRun && !token) {
    console.error(`No ${tokenVar} in the environment. This script runs on the GitHub runner.`);
    process.exit(1);
  }

  console.log(`${args.dryRun ? 'DRY RUN — nothing will be sent' : 'LIVE'} · store ${args.lang.toUpperCase()} · ` +
    `${items.length} product(s) · status ${args.publish ? '1 (published)' : '0 (hidden)'}\n`);

  // A create has no natural idempotency: POST /products with a handle that
  // already exists makes a SECOND product at a suffixed URL rather than
  // refusing. A partly-failed run is the normal case (one product rejected,
  // the rest created), so the obvious next move — re-run it — is exactly what
  // duplicates the store. Read the catalogue once and skip what's already there.
  const existing = (!args.update && !args.dryRun) ? await liveHandles(token) : new Map();

  let failed = 0, skipped = 0;
  for (const item of items) {
    try {
      if (existing.has(item.handle)) {
        const hit = existing.get(item.handle);
        console.log(`⊘ ${item.slug} already on this store (id ${hit.id}) — not creating a duplicate.`);
        console.log(`  record it: set "product_id": { "${args.lang}": "${hit.id}" } in iconic-series/${item.drop}/${item.slug}.json`);
        console.log('  then use update: true to push copy, SEO and images.');
        skipped++;
        continue;
      }

      const body = buildBody(item, args.lang, { publish: args.publish });

      // A dry run has to print what would actually go out. Build the exact
      // payload for whichever path is selected, then either show it or send it.
      const endpoint = args.update ? `${HOST}/products/batchsave` : `${HOST}/products`;
      const payload = args.update ? updatePayload(item, body, args.lang) : body;

      if (args.dryRun) {
        console.log(`── ${item.slug} ${'─'.repeat(Math.max(0, 60 - item.slug.length))}`);
        console.log(`POST ${endpoint}`);
        console.log(JSON.stringify(summarise(payload, args.verbose), null, 2));
        if (args.update) {
          console.log(`\nthen GET ${HOST}/products/${productIdFor(item, args.lang)}`);
          console.log('     PUT it back unchanged except for these images:');
          console.log(JSON.stringify(body.images, null, 2));
        }
        console.log();
        continue;
      }

      if (args.update) {
        const data = await send(endpoint, 'POST', token, payload);
        console.log(`✓ updated ${item.slug} (id ${productIdFor(item, args.lang)})`, JSON.stringify(data).slice(0, 200));
        // batchsave is documented as a partial update and observed to ignore
        // `images` — the gallery stayed on the old mockups after a clean run.
        // PUT /products/{id} takes them, but replaces rather than merges, so
        // putImages reads the live product back and changes only the gallery.
        const img = await putImages(item, body, args.lang, token);
        console.log(`  images → PUT`, JSON.stringify(img).slice(0, 120));
      } else {
        const data = await send(`${HOST}/products`, 'POST', token, body);
        console.log(`✓ created ${item.slug} → id ${data.id} · /products/${body.handle} · status ${body.status}`);
        console.log(`  record it: set "product_id": { "${args.lang}": "${data.id}" } in iconic-series/${item.drop}/${item.slug}.json`);
      }
    } catch (err) {
      failed++;
      console.error(`✗ ${item.slug}: ${err.message}`);
      if (/数据不存在/.test(err.message)) {
        console.error('    数据不存在 = "data does not exist" — the API resolved a reference');
        console.error('    that isn\'t there. Past cause: a `position` outside the range the');
        console.error('    API expects (they are 0-based). Check the collection ids for this');
        console.error(`    store too: ${JSON.stringify(collectionsFor(item.drop, args.lang))}`);
      }
    }
  }

  if (skipped) console.log(`\n${skipped} skipped (already on this store) · re-running is safe.`);
  if (failed) process.exit(1);
}

/**
 * handle → live product, for the whole store. One catalogue pass, so the create
 * loop can tell "already there" from "needs creating" without a request each.
 */
async function liveHandles(token) {
  const map = new Map();
  let since = '';
  for (let page = 0; page < 50; page++) {
    const res = await fetch(`${HOST}/products?limit=100${since ? `&since_id=${since}` : ''}`, { headers: { token } });
    const json = await res.json().catch(() => ({}));
    if (json.code !== 0) throw new Error(`API code ${json.code}: ${json.msg}`);
    const batch = json.data?.products || json.data?.list || json.data || [];
    if (!Array.isArray(batch) || !batch.length) break;
    for (const p of batch) map.set(p.handle, p);
    since = batch[batch.length - 1].id;
    if (batch.length < 100) break;
  }
  return map;
}

main().catch(e => { console.error(e); process.exit(1); });
