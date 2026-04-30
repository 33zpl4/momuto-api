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
  const source = {
    title: post.title || '',
    handle: handle || '',
    summary: post.summary || post.excerpt || '',
    content: post.content || '',
    meta_title: post.meta_title || post.title || '',
    meta_descript: post.meta_descript || post.summary || '',
  };

  const prompt = `You are translating a blog post for MOMUTO (it.momuto.com), an Italian-language custom football kit website.

Translate the following blog post from English to Italian. Rules:
- Preserve ALL HTML tags and structure exactly — only translate visible text content
- Do NOT translate: MOMUTO, brand names, product names, URLs, CSS class names, HTML attributes, JSON-LD keys
- The handle (URL slug) must be Italian: lowercase, hyphens only, SEO-friendly natural Italian (not word-for-word)
- meta_title and meta_descript must be natural Italian SEO copy, under 60 and 155 characters respectively
- Return ONLY valid JSON — no markdown fences, no explanation

Source post:
${JSON.stringify(source, null, 2)}

Return this exact JSON structure:
{
  "title": "...",
  "handle": "...",
  "summary": "...",
  "content": "...",
  "meta_title": "...",
  "meta_descript": "..."
}`;

  const response = await withRetry(() => client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  }));

  const raw = response.content[0].text.trim();
  const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(`Claude returned invalid JSON: ${err.message}\n---\n${raw.slice(0, 500)}`);
  }
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
