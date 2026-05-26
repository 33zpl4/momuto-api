'use strict';

/**
 * Deploys a single blog post from blogs/<locale>/<handle>.json (or blogs/<handle>.json for EN).
 *
 * Env:
 *   LOCALE=en|fr|es|it  - default en
 *   OEMSAAS_TOKEN_EN/FR/ES/IT  - token for the selected locale
 *   POST_HANDLE         - required: matches filename in blogs/<locale>/
 *   DRY_RUN=true|false  - default true
 */

const fs = require('fs');
const path = require('path');

const HOST = 'https://openapi.oemapps.com';
const LOCALE = (process.env.LOCALE || 'en').toLowerCase();
const HANDLE = process.env.POST_HANDLE;
const DRY_RUN = process.env.DRY_RUN !== 'false';

const DOMAIN_MAP = {
  en: { token: process.env.OEMSAAS_TOKEN_EN, url: 'https://www.momuto.com' },
  fr: { token: process.env.OEMSAAS_TOKEN_FR, url: 'https://fr.momuto.com' },
  es: { token: process.env.OEMSAAS_TOKEN_ES, url: 'https://es.momuto.com' },
  it: { token: process.env.OEMSAAS_TOKEN_IT, url: 'https://it.momuto.com' },
};

const domain = DOMAIN_MAP[LOCALE];
if (!domain) { console.error(`Unknown locale: ${LOCALE}`); process.exit(1); }
const TOKEN = domain.token;

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchPosts() {
  let page = 1;
  const pagesize = 50;
  const items = [];
  while (true) {
    const url = `${HOST}/posts?page=${page}&pagesize=${pagesize}`;
    const res = await fetch(url, { headers: { token: TOKEN } });
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

function getHandle(post) {
  return post.handle || post.alias || post.slug || post.url_key || null;
}

async function updatePost(id, data) {
  const res = await fetch(`${HOST}/posts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', token: TOKEN },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) throw new Error(`PUT /posts/${id} failed: ${JSON.stringify(json)}`);
  return json;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!TOKEN) { console.error(`OEMSAAS_TOKEN_${LOCALE.toUpperCase()} is required`); process.exit(1); }
  if (!HANDLE) { console.error('POST_HANDLE is required'); process.exit(1); }

  // EN posts live in blogs/, other locales in blogs/<locale>/
  const blogDir = LOCALE === 'en'
    ? path.join(__dirname, '..', 'blogs')
    : path.join(__dirname, '..', 'blogs', LOCALE);

  const dataFile = path.join(blogDir, `${HANDLE}.json`);
  if (!fs.existsSync(dataFile)) {
    console.error(`No content file found: blogs/${LOCALE === 'en' ? '' : LOCALE + '/'}${HANDLE}.json`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

  if (data.handle && data.handle !== HANDLE) {
    console.error(`Handle mismatch: file says "${data.handle}", POST_HANDLE is "${HANDLE}"`);
    process.exit(1);
  }

  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log(`Locale: ${LOCALE} → ${domain.url}`);
  console.log(`Handle: ${HANDLE}`);
  console.log(`Title: ${data.title}`);
  console.log(`Meta title length: ${data.meta_title?.length ?? 0} (max 65)`);
  console.log(`Meta desc length: ${data.meta_descript?.length ?? 0} (max 160)`);
  console.log(`Content length: ${data.content?.length ?? 0} chars\n`);

  if (DRY_RUN) {
    console.log('[DRY RUN] Content preview (first 400 chars):');
    console.log(data.content?.slice(0, 400) + '...');
    console.log('\nSet DRY_RUN=false to deploy.');
    return;
  }

  console.log('Fetching posts from CMS...');
  const posts = await fetchPosts();
  console.log(`Found ${posts.length} posts`);

  const post = posts.find(p => getHandle(p) === HANDLE);
  if (!post) {
    console.error(`Post not found in CMS with handle: ${HANDLE}`);
    process.exit(1);
  }

  console.log(`Updating post id=${post.id}...`);
  await updatePost(post.id, {
    title: data.title,
    content: data.content,
    meta_title: data.meta_title,
    meta_descript: data.meta_descript,
    summary: data.summary ?? '',
    author: data.author ?? '',
    handle: HANDLE,
  });

  console.log(`✅ Done: ${domain.url}/blogs/${HANDLE}`);
}

main().catch(err => { console.error(err); process.exit(1); });
