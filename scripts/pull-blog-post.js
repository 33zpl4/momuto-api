'use strict';

/**
 * Pulls a single blog post from the CMS into the repo so it can be edited and
 * redeployed. Writes blogs/<handle>.json (EN) or blogs/<locale>/<handle>.json.
 *
 * The round-tripped fields match what scripts/deploy-blog-post.js sends back, so
 * a pulled file deploys cleanly with no drift.
 *
 * Env:
 *   POST_HANDLE                 - required (CMS url handle)
 *   LOCALE                      - en | fr | es | it (default: fr)
 *   OEMSAAS_TOKEN_{EN,FR,ES,IT} - token for the chosen locale
 */

const fs = require('fs');
const path = require('path');

const HOST = 'https://openapi.oemapps.com';

const DOMAIN_MAP = {
  en: { token: process.env.OEMSAAS_TOKEN_EN, url: 'https://www.momuto.com' },
  fr: { token: process.env.OEMSAAS_TOKEN_FR, url: 'https://fr.momuto.com' },
  es: { token: process.env.OEMSAAS_TOKEN_ES, url: 'https://es.momuto.com' },
  it: { token: process.env.OEMSAAS_TOKEN_IT, url: 'https://it.momuto.com' },
};

const getHandle = (post) => post.handle || post.alias || post.slug || post.url_key || null;

async function fetchPosts(token) {
  let page = 1; const pagesize = 50; const items = [];
  while (true) {
    const res = await fetch(`${HOST}/posts?page=${page}&pagesize=${pagesize}`, { headers: { token } });
    const json = await res.json();
    if (!res.ok || json.code !== 0) break;
    const list = json.data?.list ?? (Array.isArray(json.data) ? json.data : []);
    if (!list.length) break;
    items.push(...list);
    if (list.length < pagesize) break;
    page++;
  }
  return items;
}

function blogDirFor(locale) {
  return locale === 'en'
    ? path.join(__dirname, '..', 'blogs')
    : path.join(__dirname, '..', 'blogs', locale);
}

async function main() {
  const handle = process.env.POST_HANDLE;
  const locale = (process.env.LOCALE || 'fr').toLowerCase();
  if (!handle) { console.error('POST_HANDLE required'); process.exit(1); }
  const domain = DOMAIN_MAP[locale];
  if (!domain) { console.error(`Unknown LOCALE "${locale}"`); process.exit(1); }
  if (!domain.token) { console.error(`No ${locale} token set`); process.exit(1); }

  const posts = await fetchPosts(domain.token);
  const post = posts.find(p => getHandle(p) === handle);
  if (!post) { console.error(`"${handle}" not found in CMS on ${domain.url} (${posts.length} posts scanned)`); process.exit(1); }

  const out = {
    handle,
    title:         post.title || '',
    meta_title:    post.meta_title || post.title || '',
    meta_descript: post.meta_descript || post.summary || '',
    summary:       post.summary || post.excerpt || '',
    author:        post.author || post.author_name || '',
    status:        post.status ?? 1,
    ...(post.src ? { src: post.src } : {}),
    ...(post.image_alt ? { image_alt: post.image_alt } : {}),
    content:       post.content || '',
  };

  const dir = blogDirFor(locale);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${handle}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n');

  const rel = path.relative(path.join(__dirname, '..'), file);
  console.log(`✅ Pulled "${post.title}"`);
  console.log(`   → ${rel}`);
  console.log(`   content ${out.content.length} chars · meta_title ${out.meta_title.length}/65 · desc ${out.meta_descript.length}/160`);
}

main().catch(err => { console.error(err); process.exit(1); });
