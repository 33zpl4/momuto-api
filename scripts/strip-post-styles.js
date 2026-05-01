/**
 * Strips inline <style> blocks from all blog posts on a given store.
 * Use this after moving to the shared blog.css DIY file.
 *
 * Usage:
 *   OEMSAAS_TOKEN_IT=xxx node scripts/strip-post-styles.js
 *   OEMSAAS_TOKEN_EN=xxx STORE=en node scripts/strip-post-styles.js
 *   DRY_RUN=false ... node scripts/strip-post-styles.js
 *
 * Env:
 *   OEMSAAS_TOKEN_IT  - token for it.momuto.com (default store)
 *   OEMSAAS_TOKEN_EN  - token for momuto.com
 *   STORE=it|en       - which store to clean (default: it)
 *   POST_HANDLE       - optional: restrict to one post handle
 *   DRY_RUN=true|false - default true (safe)
 */

'use strict';

const STORE_KEY = process.env.STORE || 'it';
const TOKEN = process.env[`OEMSAAS_TOKEN_${STORE_KEY.toUpperCase()}`];
const DOMAIN = {
  it: { host: 'https://openapi.oemapps.com', label: 'it.momuto.com' },
  en: { host: 'https://openapi.oemapps.com', label: 'momuto.com' },
  es: { host: 'https://openapi.oemapps.com', label: 'es.momuto.com' },
  fr: { host: 'https://openapi.oemapps.com', label: 'fr.momuto.com' },
}[STORE_KEY];

const DRY_RUN = process.env.DRY_RUN !== 'false';
const HANDLE_FILTER = process.env.POST_HANDLE || '';

if (!TOKEN) { console.error(`OEMSAAS_TOKEN_${STORE_KEY.toUpperCase()} not set`); process.exit(1); }
if (!DOMAIN) { console.error(`Unknown STORE: ${STORE_KEY}`); process.exit(1); }

async function fetchAll() {
  let page = 1;
  const pagesize = 50;
  const items = [];
  while (true) {
    const url = `${DOMAIN.host}/posts?page=${page}&pagesize=${pagesize}`;
    const response = await fetch(url, { headers: { token: TOKEN } });
    const result = await response.json();
    if (!response.ok || result.code !== 0) break;
    const list = result.data?.list ?? (Array.isArray(result.data) ? result.data : []);
    if (!Array.isArray(list) || list.length === 0) break;
    items.push(...list);
    if (list.length < pagesize) break;
    page++;
  }
  return items;
}

async function updatePost(id, postData) {
  const res = await fetch(`${DOMAIN.host}/posts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', token: TOKEN },
    body: JSON.stringify(postData),
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) throw new Error(JSON.stringify(json));
  return json;
}

async function main() {
  console.log(`Store:    ${DOMAIN.label}`);
  console.log(`Mode:     ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  if (HANDLE_FILTER) console.log(`Filter:   ${HANDLE_FILTER}`);

  console.log(`\nFetching posts...`);
  const posts = await fetchAll();
  console.log(`Found ${posts.length} post(s)`);

  const toProcess = HANDLE_FILTER ? posts.filter(p => p.handle === HANDLE_FILTER) : posts;

  let cleaned = 0;
  let skipped = 0;
  const errors = [];

  for (const post of toProcess) {
    const original = post.content || '';
    const stripped = original.replace(/<style[\s\S]*?<\/style>/gi, '').trim();

    if (stripped === original) {
      skipped++;
      console.log(`  ✓ ${post.handle} — no inline styles`);
      continue;
    }

    const removedBytes = original.length - stripped.length;
    console.log(`  🧹 ${post.handle} — removing ${removedBytes} chars of inline CSS`);

    if (!DRY_RUN) {
      try {
        await updatePost(post.id, {
          title: post.title,
          handle: post.handle,
          summary: post.summary || '',
          content: stripped,
          meta_title: post.meta_title || '',
          meta_descript: post.meta_descript || '',
          ...(post.image ? { image: post.image } : {}),
          ...(post.cover ? { cover: post.cover } : {}),
        });
        cleaned++;
        console.log(`    ✅ Updated`);
      } catch (err) {
        console.error(`    ❌ Failed: ${err.message}`);
        errors.push({ handle: post.handle, error: err.message });
      }
    } else {
      cleaned++;
    }
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Posts with inline styles: ${cleaned}`);
  console.log(`Posts already clean:      ${skipped}`);
  if (!DRY_RUN) console.log(`Updated:                  ${cleaned - errors.length}`);
  if (errors.length) {
    console.error(`Errors:                   ${errors.length}`);
    errors.forEach(e => console.error(`  - ${e.handle}: ${e.error}`));
    process.exit(1);
  }
  if (DRY_RUN && cleaned > 0) console.log(`\nRe-run with DRY_RUN=false to apply.`);
  else console.log(`\n✅ Done.`);
}

main().catch(err => { console.error('❌ Fatal:', err.message); process.exit(1); });
