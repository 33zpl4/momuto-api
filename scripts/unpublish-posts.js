'use strict';

/**
 * Takes CMS blog posts out of publication without touching their content.
 *
 * deploy-blog-post.js can only act on posts that exist as repo files. Posts
 * that live only in the CMS — foreign-language strays, duplicate handles — have
 * no file to flip, so they need this.
 *
 * The list is declared in cms/unpublish.json:
 *   {
 *     "it": [
 *       { "handle": "high-quality-soccer-kits", "reason": "English post on the Italian store; lives on www" }
 *     ]
 *   }
 *
 * Every post is archived to cms/unpublished/<locale>/<handle>.json before it is
 * flipped, so nothing is lost and a post can be restored by moving the archive
 * into blogs/<locale>/ with status 1 and pushing.
 *
 * Env:
 *   DRY_RUN=true|false          - default true (set false to write)
 *   LOCALE                      - optional: restrict to one locale
 *   OEMSAAS_TOKEN_EN/FR/ES/IT   - token per locale
 */

const fs = require('fs');
const path = require('path');

const HOST = 'https://openapi.oemapps.com';
const DRY_RUN = process.env.DRY_RUN !== 'false';
const ONLY_LOCALE = (process.env.LOCALE || '').toLowerCase();
const ROOT = path.join(__dirname, '..');
const LIST_FILE = path.join(ROOT, 'cms', 'unpublish.json');

const TOKENS = {
  en: process.env.OEMSAAS_TOKEN_EN,
  fr: process.env.OEMSAAS_TOKEN_FR,
  es: process.env.OEMSAAS_TOKEN_ES,
  it: process.env.OEMSAAS_TOKEN_IT,
  us: process.env.OEMSAAS_TOKEN_US,
};

const DOMAIN = {
  en: 'https://www.momuto.com',
  fr: 'https://fr.momuto.com',
  es: 'https://es.momuto.com',
  it: 'https://it.momuto.com',
  us: 'https://us.momuto.com',
};

async function withRetry(fn, maxAttempts = 4) {
  const delays = [2000, 4000, 8000];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      await new Promise(r => setTimeout(r, delays[attempt - 1]));
    }
  }
}

const getHandle = (post) => post.handle || post.alias || post.slug || post.url_key || null;

async function fetchPosts(token) {
  let page = 1;
  const pagesize = 50;
  const items = [];
  while (true) {
    const json = await withRetry(async () => {
      const res = await fetch(`${HOST}/posts?page=${page}&pagesize=${pagesize}`, { headers: { token } });
      const body = await res.json();
      if (!res.ok || body.code !== 0) throw new Error(`GET /posts page ${page}: ${JSON.stringify(body).slice(0, 200)}`);
      return body;
    });
    const list = json.data?.list ?? (Array.isArray(json.data) ? json.data : []);
    if (!list.length) break;
    items.push(...list);
    if (list.length < pagesize) break;
    page++;
  }
  return items;
}

// PUT replaces, so send the post back whole with only status changed.
async function setStatus(token, post, handle, status) {
  const payload = {
    title: post.title || '',
    content: post.content || '',
    meta_title: post.meta_title || post.title || '',
    meta_descript: post.meta_descript || post.summary || '',
    summary: post.summary || post.excerpt || '',
    author: post.author || post.author_name || '',
    handle,
    status,
    ...(post.src ? { src: post.src } : {}),
    ...(post.image_alt ? { image_alt: post.image_alt } : {}),
  };
  return withRetry(async () => {
    const res = await fetch(`${HOST}/posts/${post.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', token },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok || body.code !== 0) throw new Error(`PUT /posts/${post.id}: ${JSON.stringify(body).slice(0, 200)}`);
    return body;
  });
}

function archive(locale, handle, post) {
  const dir = path.join(ROOT, 'cms', 'unpublished', locale);
  fs.mkdirSync(dir, { recursive: true });
  const shaped = {
    handle,
    title: post.title || '',
    meta_title: post.meta_title || post.title || '',
    meta_descript: post.meta_descript || post.summary || '',
    summary: post.summary || post.excerpt || '',
    author: post.author || post.author_name || '',
    status: 0,
    ...(post.src ? { src: post.src } : {}),
    ...(post.image_alt ? { image_alt: post.image_alt } : {}),
    content: post.content || '',
  };
  fs.writeFileSync(path.join(dir, `${handle}.json`), JSON.stringify(shaped, null, 2) + '\n', 'utf8');
}

async function runLocale(locale, entries) {
  const token = TOKENS[locale];
  if (!token) { console.warn(`⚠️  ${locale}: no token — skipping ${entries.length} post(s)`); return { done: 0, missing: [], failed: [] }; }

  console.log(`\n=== ${locale} (${DOMAIN[locale]}) — ${entries.length} post(s) ===`);
  const posts = await fetchPosts(token);
  const byHandle = new Map(posts.map(p => [getHandle(p), p]));

  let done = 0;
  const missing = [];
  const failed = [];

  for (const entry of entries) {
    const handle = typeof entry === 'string' ? entry : entry.handle;
    const reason = (typeof entry === 'object' && entry.reason) || '';
    const post = byHandle.get(handle);

    if (!post) { console.log(`  ∅ ${handle} — not on this store`); missing.push(handle); continue; }
    if (post.status === 0) { console.log(`  ·  ${handle} — already unpublished`); continue; }

    console.log(`  → ${handle}${reason ? `  (${reason})` : ''}`);
    if (DRY_RUN) { console.log('     DRY RUN — no write'); continue; }

    try {
      archive(locale, handle, post);
      await setStatus(token, post, handle, 0);
      console.log(`     ✅ unpublished, archived to cms/unpublished/${locale}/${handle}.json`);
      done++;
    } catch (err) {
      console.error(`     ❌ ${err.message}`);
      failed.push(handle);
    }
  }
  return { done, missing, failed };
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);

  if (!fs.existsSync(LIST_FILE)) {
    console.error(`No ${path.relative(ROOT, LIST_FILE)} — nothing declared.`);
    process.exit(1);
  }
  const list = JSON.parse(fs.readFileSync(LIST_FILE, 'utf8'));

  const locales = Object.keys(list).filter(l => !ONLY_LOCALE || l === ONLY_LOCALE);
  if (!locales.length) { console.log('Nothing to do.'); return; }

  let total = 0;
  const allMissing = [];
  const allFailed = [];
  for (const locale of locales) {
    const entries = (list[locale] || []).filter(e => (typeof e === 'string' ? e : e.handle));
    if (!entries.length) continue;
    const r = await runLocale(locale, entries);
    total += r.done;
    allMissing.push(...r.missing.map(h => `${locale}/${h}`));
    allFailed.push(...r.failed.map(h => `${locale}/${h}`));
  }

  console.log(`\n${total} post(s) unpublished.`);
  if (allMissing.length) console.log(`Not found (check the handle): ${allMissing.join(', ')}`);
  if (allFailed.length) { console.error(`Failed: ${allFailed.join(', ')}`); process.exit(1); }
}

main().catch(err => { console.error(err); process.exit(1); });
