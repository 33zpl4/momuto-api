'use strict';

/**
 * Deploys blog post(s) from blogs/<locale>/<handle>.json (or blogs/<handle>.json for EN).
 *
 * Two modes:
 *   PUSH  — set CHANGED_FILES="blogs/a.json blogs/fr/b.json ..." (space/newline
 *           separated). Locale + handle are derived from each path. Used by the
 *           push trigger so blog edits deploy automatically — no dispatch.
 *   SINGLE— set POST_HANDLE (+ LOCALE) for a one-off dispatch.
 *
 * Env:
 *   DRY_RUN=true|false  - default true (set false to write)
 *   OEMSAAS_TOKEN_EN/FR/ES/IT - token per locale
 */

const fs = require('fs');
const path = require('path');

const HOST = 'https://openapi.oemapps.com';
const DRY_RUN = process.env.DRY_RUN !== 'false';

const DOMAIN_MAP = {
  en: { token: process.env.OEMSAAS_TOKEN_EN, url: 'https://www.momuto.com' },
  fr: { token: process.env.OEMSAAS_TOKEN_FR, url: 'https://fr.momuto.com' },
  es: { token: process.env.OEMSAAS_TOKEN_ES, url: 'https://es.momuto.com' },
  it: { token: process.env.OEMSAAS_TOKEN_IT, url: 'https://it.momuto.com' },
  us: { token: process.env.OEMSAAS_TOKEN_US, url: 'https://us.momuto.com' },
};

function blogDirFor(locale) {
  return locale === 'en'
    ? path.join(__dirname, '..', 'blogs')
    : path.join(__dirname, '..', 'blogs', locale);
}

async function fetchPosts(token) {
  let page = 1;
  const pagesize = 50;
  const items = [];
  while (true) {
    const res = await fetch(`${HOST}/posts?page=${page}&pagesize=${pagesize}`, { headers: { token } });
    const json = await res.json();
    // A failed listing must NEVER read as "no posts" — that turned updates
    // into POST /posts (duplicates) under throttling on 3 Sep 2026.
    if (!res.ok || json.code !== 0) throw new Error(`GET /posts failed: ${JSON.stringify(json)}`);
    const list = json.data?.list ?? (Array.isArray(json.data) ? json.data : []);
    if (!list.length) break;
    items.push(...list);
    if (list.length < pagesize) break;
    page++;
  }
  return items;
}

const getHandle = (post) => post.handle || post.alias || post.slug || post.url_key || null;

async function updatePost(token, id, data) {
  const res = await fetch(`${HOST}/posts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', token },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) throw new Error(`PUT /posts/${id} failed: ${JSON.stringify(json)}`);
  return json;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function withRetry(fn, label, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) {
      const throttled = /Too many requests|"code":1000/.test(e.message);
      if (!throttled || i === tries - 1) throw e;
      const wait = 2000 * (i + 1);
      console.log(`   ⏳ throttled on ${label} — retry ${i + 1}/${tries - 1} in ${wait / 1000}s`);
      await sleep(wait);
    }
  }
}
// One listing per locale per run (was one per post — 26 posts × 43-post
// listings is what tripped the CMS throttle).
const POST_CACHE = {};
async function postsFor(locale, token) {
  if (!POST_CACHE[locale]) POST_CACHE[locale] = await withRetry(() => fetchPosts(token), `list ${locale}`);
  return POST_CACHE[locale];
}

async function createPost(token, data) {
  const res = await fetch(`${HOST}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) throw new Error(`POST /posts failed: ${JSON.stringify(json)}`);
  return json;
}

// blogs/<handle>.json → en ; blogs/<locale>/<handle>.json → that locale
function parsePath(file) {
  let m = file.match(/^blogs\/(en|fr|es|it|us)\/(.+)\.json$/);
  if (m) return { locale: m[1], handle: m[2] };
  m = file.match(/^blogs\/([^/]+)\.json$/);
  if (m) return { locale: 'en', handle: m[1] };
  return null;
}

async function deployOne(locale, handle) {
  const domain = DOMAIN_MAP[locale];
  if (!domain) { console.warn(`⚠️  ${handle}: unknown locale "${locale}" — skipping`); return; }
  if (!domain.token) { console.warn(`⚠️  ${handle}: no ${locale} token — skipping`); return; }

  const dataFile = path.join(blogDirFor(locale), `${handle}.json`);
  if (!fs.existsSync(dataFile)) { console.warn(`⚠️  ${handle}: no file ${dataFile} — skipping`); return; }

  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  if (data.handle && data.handle !== handle) {
    throw new Error(`${handle}: file handle "${data.handle}" ≠ path handle`);
  }

  console.log(`• ${locale} ${handle} — "${data.title}" (meta_title ${data.meta_title?.length ?? 0}/65, desc ${data.meta_descript?.length ?? 0}/160)`);
  if (DRY_RUN) { console.log('   DRY RUN — no write'); return; }

  const payload = {
    title: data.title,
    content: data.content,
    meta_title: data.meta_title,
    meta_descript: data.meta_descript,
    summary: data.summary ?? '',
    author: data.author ?? '',
    handle,
    // round-trip publish state when the file declares it (0 = draft/unpublished)
    ...(data.status != null ? { status: data.status } : {}),
  };

  const posts = await postsFor(locale, domain.token);
  const post = posts.find(p => getHandle(p) === handle);
  if (post) {
    await withRetry(() => updatePost(domain.token, post.id, payload), handle);
  } else {
    const created = await withRetry(() => createPost(domain.token, payload), handle);   // new post → create instead of failing
    if (created?.data) posts.push({ ...payload, id: created.data.id });
    console.log(`   ✨ created`);
  }
  await sleep(600);
  console.log(`   ✅ ${domain.url}/blogs/${handle}`);
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  let targets;
  const changed = (process.env.CHANGED_FILES || '').trim();
  if (changed) {
    const seen = new Set();
    targets = changed.split(/\s+/).filter(Boolean).map(parsePath).filter(Boolean)
      .filter(t => { const k = `${t.locale}/${t.handle}`; if (seen.has(k)) return false; seen.add(k); return true; });
    if (!targets.length) { console.log('No blog JSON files changed — nothing to deploy.'); return; }
  } else {
    const handle = process.env.POST_HANDLE;
    if (!handle) { console.error('POST_HANDLE required (or set CHANGED_FILES)'); process.exit(1); }
    targets = [{ locale: (process.env.LOCALE || 'en').toLowerCase(), handle }];
  }

  const errors = [];
  for (const t of targets) {
    try { await deployOne(t.locale, t.handle); }
    catch (e) { console.error(`❌ ${e.message}`); errors.push(t.handle); }
  }
  if (errors.length) { console.error(`\n${errors.length} error(s)`); process.exit(1); }
  console.log('\n✅ Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
