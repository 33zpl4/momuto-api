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
  const a = { slug: null, drop: null, lang: 'en', dryRun: false, publish: false, update: false, verbose: false, inspect: null, probe: false, delete: null };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--delete') a.delete = argv[++i];
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
    subtitle: copy.subtitle || `${config.strings[lang].series_name} · ${item.number}`,
    meta_title: copy.meta_title,
    meta_descript: copy.meta_description,
    product_detail: 1,
  };
}

function summarise(body, verbose) {
  if (verbose) return body;
  const { body_html, ...rest } = body;
  return { ...rest, body_html: `<${body_html.length} chars of HTML — pass --verbose to print it>` };
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
      console.log(`\noptions:\n${JSON.stringify(hit.options, null, 2)}`);
      const v = (hit.variants || [])[0];
      console.log(`\nvariants: ${(hit.variants || []).length}`);
      if (v) {
        const optFields = Object.fromEntries(Object.entries(v).filter(([k]) => /^option/i.test(k)));
        console.log(`variant[0] option fields:\n${JSON.stringify(optFields, null, 2)}`);
        console.log(`variant[0] price/sku: ${v.price} / ${v.sku}`);
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

async function main() {
  const args = parseArgs(process.argv);

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

  let failed = 0;
  for (const item of items) {
    try {
      const body = buildBody(item, args.lang, { publish: args.publish });

      if (args.dryRun) {
        console.log(`── ${item.slug} ${'─'.repeat(Math.max(0, 60 - item.slug.length))}`);
        console.log(`POST ${HOST}/products`);
        console.log(JSON.stringify(summarise(body, args.verbose), null, 2));
        console.log();
        continue;
      }

      if (args.update) {
        if (!item.product_id) throw new Error('--update needs "product_id" in the product JSON');
        const data = await send(`${HOST}/products/batchsave`, 'POST', token, {
          products: [{ id: item.product_id, body_html: body.body_html,
            meta_title: body.meta_title, meta_descript: body.meta_descript }],
        });
        console.log(`✓ updated ${item.slug} (id ${item.product_id})`, JSON.stringify(data).slice(0, 200));
      } else {
        const data = await send(`${HOST}/products`, 'POST', token, body);
        console.log(`✓ created ${item.slug} → id ${data.id} · /products/${body.handle} · status ${body.status}`);
        console.log(`  record it: set "product_id": "${data.id}" in iconic-series/${item.drop}/${item.slug}.json`);
      }
    } catch (err) {
      failed++;
      console.error(`✗ ${item.slug}: ${err.message}`);
    }
  }

  if (failed) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
