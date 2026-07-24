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
  const a = { slug: null, drop: null, lang: 'en', dryRun: false, publish: false, update: false, verbose: false };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--slug') a.slug = argv[++i];
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
    // spec_mode 2 = size options. The option object wants `option_name` —
    // `option_title` returns "option_name不能为空" (option_name cannot be
    // empty). `option1_title`/`option1_value_title` on the variants match the
    // field names on the live Pornic product.
    spec_mode: 2,
    options: [{ option_name: 'Size', position: 1, values: SIZES.map((s, i) => ({ option_value: s, position: i + 1 })) }],
    variants: SIZES.map(s => ({
      price,
      option1_title: 'Size',
      option1_value_title: s,
      sku: `${item.number.replace(/[–—]/g, '-')}-${s}`,
      inventory_tracking: 0,
    })),
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

async function main() {
  const args = parseArgs(process.argv);

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
