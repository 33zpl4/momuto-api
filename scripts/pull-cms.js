'use strict';

/**
 * Pulls a single CMS object (blog post, page, or product) into the repo so it
 * can be inspected, edited, and redeployed. The sandbox can't reach the CMS API
 * (egress policy), so this runs on the GitHub runner via the Pull CMS Content
 * workflow.
 *
 * Output paths:
 *   post    → blogs/<handle>.json (EN) or blogs/<locale>/<handle>.json
 *             (curated to match scripts/deploy-blog-post.js so it round-trips)
 *   page    → cms/pages/<locale>/<handle>.json     (full raw CMS object)
 *   product → cms/products/<locale>/<handle>.json  (full raw CMS object)
 *
 * Env:
 *   CMS_TYPE                    - post | page | product (default: post)
 *   LOCALE                      - en | fr | es | it     (default: fr)
 *   HANDLE                      - CMS url handle (or numeric id) of the object
 *   OEMSAAS_TOKEN_{EN,FR,ES,IT} - token for the chosen locale
 */

const fs = require('fs');
const path = require('path');

const HOST = 'https://openapi.oemapps.com';

const TOKENS = {
  en: process.env.OEMSAAS_TOKEN_EN,
  fr: process.env.OEMSAAS_TOKEN_FR,
  es: process.env.OEMSAAS_TOKEN_ES,
  it: process.env.OEMSAAS_TOKEN_IT,
  us: process.env.OEMSAAS_TOKEN_US,
};

const ENDPOINT = { post: 'posts', page: 'pages', product: 'products' };

const getHandle = (o) => o.handle || o.alias || o.slug || o.url_key || null;

async function fetchAll(endpoint, token) {
  // The /products endpoint uses cursor pagination (?limit&since_id) and returns
  // json.data as a flat array — unlike posts/pages (?page&pagesize, json.data.list).
  if (endpoint === 'products') return fetchAllProducts(token);

  let page = 1; const pagesize = 50; const items = [];
  while (true) {
    const res = await fetch(`${HOST}/${endpoint}?page=${page}&pagesize=${pagesize}`, { headers: { token } });
    const json = await res.json();
    if (!res.ok || json.code !== 0) {
      if (page === 1) console.error(`  ${endpoint} error: ${JSON.stringify(json).slice(0, 200)}`);
      break;
    }
    const list = json.data?.list ?? (Array.isArray(json.data) ? json.data : []);
    if (!list.length) break;
    items.push(...list);
    if (list.length < pagesize) break;
    page++;
  }
  return items;
}

async function fetchAllProducts(token) {
  const all = []; let since = ''; const limit = 200;
  while (true) {
    const res = await fetch(`${HOST}/products?limit=${limit}${since ? `&since_id=${since}` : ''}`, { headers: { token } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.code !== 0) { console.error(`  products error: ${JSON.stringify(json).slice(0, 200)}`); break; }
    const arr = json.data || [];
    all.push(...arr);
    if (arr.length < limit) break;
    since = arr[arr.length - 1].id;
  }
  return all;
}

const ROOT = path.join(__dirname, '..');

function outPath(type, locale, handle) {
  if (type === 'post') {
    return locale === 'en'
      ? path.join(ROOT, 'blogs', `${handle}.json`)
      : path.join(ROOT, 'blogs', locale, `${handle}.json`);
  }
  return path.join(ROOT, 'cms', `${type}s`, locale, `${handle}.json`);
}

// Curated shape for posts — matches what deploy-blog-post.js sends back.
function shapePost(p, handle) {
  return {
    handle,
    title:         p.title || '',
    meta_title:    p.meta_title || p.title || '',
    meta_descript: p.meta_descript || p.summary || '',
    summary:       p.summary || p.excerpt || '',
    author:        p.author || p.author_name || '',
    status:        p.status ?? 1,
    ...(p.src ? { src: p.src } : {}),
    ...(p.image_alt ? { image_alt: p.image_alt } : {}),
    content:       p.content || '',
  };
}

async function main() {
  const type   = (process.env.CMS_TYPE || 'post').toLowerCase();
  const locale = (process.env.LOCALE || 'fr').toLowerCase();
  const handle = process.env.HANDLE || process.env.POST_HANDLE;
  const token  = TOKENS[locale];
  if (!token) { console.error(`No ${locale} token set`); process.exit(1); }

  // Inventory mode: list every post + page (handle/title/status) into a manifest.
  if (type === 'inventory') {
    const inv = {};
    for (const [t, ep] of [['posts', 'posts'], ['pages', 'pages']]) {
      const items = await fetchAll(ep, token);
      inv[t] = items.map(o => ({ handle: getHandle(o), title: o.title || o.name || '', status: o.status ?? null }))
                    .filter(x => x.handle)
                    .sort((a, b) => a.handle.localeCompare(b.handle));
    }
    const file = path.join(ROOT, 'cms', 'inventory', `${locale}.json`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(inv, null, 2) + '\n');
    console.log(`✅ Inventory ${locale}: ${inv.posts.length} posts, ${inv.pages.length} pages → cms/inventory/${locale}.json`);
    return;
  }

  if (!ENDPOINT[type]) { console.error(`Unknown CMS_TYPE "${type}" — use post | page | product | inventory`); process.exit(1); }
  if (!handle) { console.error('HANDLE required'); process.exit(1); }

  const items = await fetchAll(ENDPOINT[type], token);
  const item = items.find(o => getHandle(o) === handle || String(o.id) === String(handle));
  if (!item) { console.error(`${type} "${handle}" not found on ${locale} (${items.length} ${type}s scanned)`); process.exit(1); }

  // Posts are curated for round-trip; pages/products keep the full raw object so
  // nothing is lost on the way in.
  const out  = type === 'post' ? shapePost(item, handle) : item;
  const file = outPath(type, locale, handle);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n');

  const rel = path.relative(ROOT, file);
  console.log(`✅ Pulled ${type} "${item.title || item.name || handle}"`);
  console.log(`   → ${rel}`);
  if (out.content) console.log(`   content ${String(out.content).length} chars`);
}

main().catch(err => { console.error(err); process.exit(1); });
