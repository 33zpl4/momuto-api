/**
 * Fetches all blog posts from momuto.com (EN), translates each one to Italian
 * using Claude, and upserts them to it.momuto.com.
 *
 * Usage:
 *   node scripts/translate-blog-posts.js          # translate all posts
 *   DRY_RUN=true node scripts/translate-blog-posts.js   # preview only
 *   POST_HANDLE=my-post-slug node scripts/...     # translate one post
 *
 * Env:
 *   ANTHROPIC_API_KEY      - required
 *   OEMSAAS_TOKEN_EN       - required (source)
 *   OEMSAAS_TOKEN_IT       - required (destination)
 *   POST_HANDLE            - optional: restrict to one EN post handle
 *   DRY_RUN=true           - optional: print translation, skip API writes
 */

'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EN = {
  host: 'https://openapi.oemapps.com',
  token: process.env.OEMSAAS_TOKEN_EN,
  label: 'momuto.com',
  baseUrl: 'https://www.momuto.com',
};

const IT = {
  host: 'https://openapi.oemapps.com',
  token: process.env.OEMSAAS_TOKEN_IT,
  label: 'it.momuto.com',
  baseUrl: 'https://it.momuto.com',
};

const DRY_RUN = process.env.DRY_RUN === 'true';
const HANDLE_FILTER = process.env.POST_HANDLE || '';

async function withRetry(fn, maxAttempts = 4) {
  const delays = [5000, 15000, 30000];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      const delay = delays[attempt - 1] ?? 30000;
      console.warn(`    Attempt ${attempt} failed: ${err.message}. Retrying in ${delay / 1000}s...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

async function fetchAll(domain, endpoint) {
  let page = 1;
  const pagesize = 50;
  const items = [];
  while (true) {
    const url = `${domain.host}/${endpoint}?page=${page}&pagesize=${pagesize}`;
    let result;
    try {
      const response = await fetch(url, { headers: { token: domain.token } });
      result = await response.json();
      if (!response.ok || result.code !== 0) {
        if (page === 1) console.warn(`  ⚠️  ${endpoint} error on ${domain.label}: ${JSON.stringify(result)}`);
        break;
      }
    } catch (err) {
      if (page === 1) console.warn(`  ⚠️  ${endpoint} fetch failed on ${domain.label}: ${err.message}`);
      break;
    }
    const list = result.data?.list ?? (Array.isArray(result.data) ? result.data : []);
    if (!Array.isArray(list) || list.length === 0) break;
    items.push(...list);
    if (list.length < pagesize) break;
    page++;
  }
  return items;
}

function getHandle(item) {
  return item.handle || item.alias || item.slug || item.url_key || null;
}

async function translatePost(post) {
  const handle = getHandle(post);
  const preamble = `You are translating content for MOMUTO (it.momuto.com), an Italian-language custom football kit website.
Rules:
- Do NOT translate: MOMUTO, brand names, product names, URLs, CSS class names, HTML attributes, JSON-LD keys
- Use natural Italian — not word-for-word`;

  // Call 1: metadata only (safe small JSON)
  const metaSource = {
    title: post.title || '',
    handle: handle || '',
    summary: post.summary || post.excerpt || '',
    meta_title: post.meta_title || post.title || '',
    meta_descript: post.meta_descript || post.summary || '',
  };
  const metaPrompt = `${preamble}

Translate the following blog post metadata from English to Italian.
- The handle (URL slug) must be Italian: lowercase, hyphens only, SEO-friendly (not word-for-word)
- META_TITLE must be under 60 characters
- META_DESC must be under 155 characters

Source:
TITLE: ${metaSource.title}
HANDLE: ${metaSource.handle}
SUMMARY: ${metaSource.summary}
META_TITLE: ${metaSource.meta_title}
META_DESC: ${metaSource.meta_descript}

Reply with EXACTLY these 5 lines and nothing else — no JSON, no HTML, no extra text:
TITLE: <translated>
HANDLE: <slug>
SUMMARY: <translated>
META_TITLE: <translated>
META_DESC: <translated>`;

  const metaResponse = await withRetry(() => client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: metaPrompt }],
  }));

  const metaRaw = metaResponse.content[0].text.trim();
  const metaLines = {};
  for (const line of metaRaw.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().toUpperCase();
    const val = line.slice(colon + 1).trim();
    metaLines[key] = val;
  }
  const meta = {
    title: metaLines['TITLE'] || metaSource.title,
    handle: metaLines['HANDLE'] || metaSource.handle,
    summary: metaLines['SUMMARY'] || metaSource.summary,
    meta_title: metaLines['META_TITLE'] || metaSource.meta_title,
    meta_descript: metaLines['META_DESC'] || metaSource.meta_descript,
  };
  if (!meta.title || !meta.handle) {
    throw new Error(`Metadata translation incomplete. Raw response:\n${metaRaw.slice(0, 500)}`);
  }

  // Call 2: HTML content only — returned as raw HTML, no JSON wrapper
  const contentPrompt = `${preamble}

Translate the following HTML blog post content from English to Italian.
- Preserve ALL HTML tags and structure exactly — only translate visible text content
- Return ONLY the translated HTML — no JSON, no markdown fences, no explanation

${post.content || ''}`;

  const contentResponse = await withRetry(() => client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: contentPrompt }],
  }));

  // Strip inline <style> blocks — covered by the shared blog.css DIY file
  const translatedContent = contentResponse.content[0].text.trim()
    .replace(/<style[\s\S]*?<\/style>/gi, '').trim();

  return {
    title: meta.title,
    handle: meta.handle,
    summary: meta.summary,
    content: translatedContent,
    meta_title: meta.meta_title,
    meta_descript: meta.meta_descript,
  };
}

async function createPost(postData) {
  const res = await fetch(`${IT.host}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token: IT.token },
    body: JSON.stringify(postData),
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) {
    throw new Error(`POST /posts failed on ${IT.label}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function updatePost(postId, postData) {
  const res = await fetch(`${IT.host}/posts/${postId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', token: IT.token },
    body: JSON.stringify(postData),
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) {
    throw new Error(`PUT /posts/${postId} failed on ${IT.label}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function main() {
  if (!EN.token) throw new Error('OEMSAAS_TOKEN_EN not set');
  if (!IT.token) throw new Error('OEMSAAS_TOKEN_IT not set');

  console.log(`Dry run: ${DRY_RUN}`);
  if (HANDLE_FILTER) console.log(`Filter: ${HANDLE_FILTER}`);

  console.log(`\nFetching posts from ${EN.label}...`);
  const enPosts = await fetchAll(EN, 'posts');
  console.log(`Found ${enPosts.length} post(s)`);

  if (enPosts.length === 0) {
    console.log('No posts on EN site — nothing to do.');
    return;
  }

  const toProcess = HANDLE_FILTER
    ? enPosts.filter(p => getHandle(p) === HANDLE_FILTER)
    : enPosts;

  if (toProcess.length === 0) {
    console.error(`No post found with handle "${HANDLE_FILTER}"`);
    process.exit(1);
  }

  console.log(`\nFetching existing posts from ${IT.label}...`);
  const itPosts = await fetchAll(IT, 'posts');
  console.log(`Found ${itPosts.length} existing post(s)`);

  const errors = [];

  for (const post of toProcess) {
    const enHandle = getHandle(post);
    console.log(`\n[${enHandle}] Translating...`);

    let translated;
    try {
      translated = await translatePost(post);
      console.log(`  → handle:     ${translated.handle}`);
      console.log(`  → title:      ${translated.title}`);
      console.log(`  → meta_title: ${translated.meta_title}`);
    } catch (err) {
      console.error(`  ❌ Translation failed: ${err.message}`);
      errors.push({ handle: enHandle, error: `translation: ${err.message}` });
      continue;
    }

    if (DRY_RUN) {
      console.log('  DRY_RUN — skipping upsert');
      console.log('  Translated summary:', translated.summary?.slice(0, 120));
      continue;
    }

    const postData = {
      title: translated.title,
      handle: translated.handle,
      summary: translated.summary,
      content: translated.content,
      meta_title: translated.meta_title,
      meta_descript: translated.meta_descript,
      // Mirror the EN post's published status so IT posts go live immediately
      ...(post.status !== undefined ? { status: post.status } : {}),
      ...(post.is_published !== undefined ? { is_published: post.is_published } : {}),
      ...(post.published !== undefined ? { published: post.published } : {}),
      ...(post.image ? { image: post.image } : {}),
      ...(post.cover ? { cover: post.cover } : {}),
      ...(post.author ? { author: post.author } : {}),
    };

    const existing = itPosts.find(p => getHandle(p) === translated.handle);

    try {
      if (existing) {
        await updatePost(existing.id, postData);
        console.log(`  ✓ Updated  → ${IT.baseUrl}/blogs/${translated.handle}`);
      } else {
        await createPost(postData);
        console.log(`  ✓ Created  → ${IT.baseUrl}/blogs/${translated.handle}`);
      }
    } catch (err) {
      console.error(`  ❌ Upsert failed: ${err.message}`);
      // If POST is unsupported, give a clear action
      if (err.message.includes('POST /posts failed')) {
        console.error(`     The OEMSaaS /posts API may not support creation via API.`);
        console.error(`     Create the post manually on ${IT.label}, then re-run to update it.`);
      }
      errors.push({ handle: enHandle, error: `upsert: ${err.message}` });
    }
  }

  if (errors.length > 0) {
    console.error(`\n⚠️  Completed with ${errors.length} error(s):`);
    errors.forEach(e => console.error(`  - [${e.handle}] ${e.error}`));
    process.exit(1);
  }

  console.log('\n✅ Blog post translation complete.');
}

main().catch(err => {
  console.error('❌ Fatal:', err.message);
  process.exit(1);
});
