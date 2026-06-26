/**
 * Fetches blog post(s) from momuto.com (EN), translates each to the target
 * locale (FR / ES / IT) using Claude, fixes per-store internal links, and
 * upserts to <locale>.momuto.com.
 *
 * Usage:
 *   TARGET_LOCALE=fr node scripts/translate-blog-posts.js                 # all EN posts -> FR
 *   TARGET_LOCALE=es POST_HANDLE=my-post-slug node scripts/...            # one post -> ES
 *   TARGET_LOCALE=it DRY_RUN=true node scripts/...                        # preview
 *
 * Env:
 *   ANTHROPIC_API_KEY            - required
 *   OEMSAAS_TOKEN_EN             - required (source)
 *   OEMSAAS_TOKEN_{FR,ES,IT}     - required (destination, by TARGET_LOCALE)
 *   TARGET_LOCALE                - fr | es | it  (default: it)
 *   POST_HANDLE                  - optional: restrict to one EN post handle
 *   DRY_RUN=true                 - optional: print translation, skip API writes
 */

'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const HOST = 'https://openapi.oemapps.com';

const EN = { host: HOST, token: process.env.OEMSAAS_TOKEN_EN, label: 'momuto.com', baseUrl: 'https://www.momuto.com' };

// Destination locales. requestHandle = each store's Custom-Design (deposit) page slug,
// so the EN link /pages/request-custom-kit-design gets remapped per store.
const LOCALES = {
  fr: { token: process.env.OEMSAAS_TOKEN_FR, label: 'fr.momuto.com', baseUrl: 'https://fr.momuto.com',
        lang: 'French',  requestHandle: 'demande-de-design-professionnel-de-maillots' },
  es: { token: process.env.OEMSAAS_TOKEN_ES, label: 'es.momuto.com', baseUrl: 'https://es.momuto.com',
        lang: 'Spanish', requestHandle: 'solicitud-de-diseno-personalizado' },
  it: { token: process.env.OEMSAAS_TOKEN_IT, label: 'it.momuto.com', baseUrl: 'https://it.momuto.com',
        lang: 'Italian', requestHandle: 'richiesta-design-personalizzato' },
};

const TARGET = (process.env.TARGET_LOCALE || 'it').toLowerCase();
const DEST = LOCALES[TARGET] ? { ...LOCALES[TARGET], host: HOST } : null;
const DRY_RUN = process.env.DRY_RUN === 'true';
const HANDLE_FILTER = process.env.POST_HANDLE || '';

async function withRetry(fn, maxAttempts = 4) {
  const delays = [5000, 15000, 30000];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try { return await fn(); }
    catch (err) {
      if (attempt === maxAttempts) throw err;
      const delay = delays[attempt - 1] ?? 30000;
      console.warn(`    Attempt ${attempt} failed: ${err.message}. Retrying in ${delay / 1000}s...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

async function fetchAll(domain, endpoint) {
  let page = 1; const pagesize = 50; const items = [];
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

const getHandle = (item) => item.handle || item.alias || item.slug || item.url_key || null;

// Remap EN internal links to the destination store (request page slug + configurator lang).
function localizeLinks(html) {
  return html
    .replace(/request-custom-kit-design/g, DEST.requestHandle)
    .replace(/lang=en&amp;langguage=en/g, `lang=${TARGET}&amp;langguage=${TARGET}`)
    .replace(/lang=en&langguage=en/g, `lang=${TARGET}&langguage=${TARGET}`);
}

async function translatePost(post) {
  const handle = getHandle(post);
  const preamble = `You are translating content for MOMUTO (${DEST.label}), a ${DEST.lang}-language custom football kit website.
Rules:
- Do NOT translate: MOMUTO, brand names, product names, URLs, CSS class names, HTML attributes, JSON-LD keys
- Use natural ${DEST.lang} — not word-for-word`;

  const metaSource = {
    title: post.title || '', handle: handle || '',
    summary: post.summary || post.excerpt || '',
    meta_title: post.meta_title || post.title || '',
    meta_descript: post.meta_descript || post.summary || '',
  };
  const metaPrompt = `${preamble}

Translate the following blog post metadata from English to ${DEST.lang}.
- The handle (URL slug) must be ${DEST.lang}: lowercase, hyphens only, SEO-friendly (not word-for-word)
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
    model: 'claude-sonnet-4-6', max_tokens: 1024, messages: [{ role: 'user', content: metaPrompt }],
  }));

  const metaLines = {};
  const metaRaw = metaResponse.content[0].text.trim();
  for (const line of metaRaw.split('\n')) {
    const colon = line.indexOf(':'); if (colon === -1) continue;
    metaLines[line.slice(0, colon).trim().toUpperCase()] = line.slice(colon + 1).trim();
  }
  const meta = {
    title: metaLines['TITLE'] || metaSource.title,
    handle: metaLines['HANDLE'] || metaSource.handle,
    summary: metaLines['SUMMARY'] || metaSource.summary,
    meta_title: metaLines['META_TITLE'] || metaSource.meta_title,
    meta_descript: metaLines['META_DESC'] || metaSource.meta_descript,
  };
  if (!meta.title || !meta.handle) throw new Error(`Metadata translation incomplete. Raw:\n${metaRaw.slice(0, 500)}`);

  const contentPrompt = `${preamble}

Translate the following HTML blog post content from English to ${DEST.lang}.
- Preserve ALL HTML tags and structure exactly — only translate visible text content
- Return ONLY the translated HTML — no JSON, no markdown fences, no explanation

${post.content || ''}`;

  const contentResponse = await withRetry(() => client.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 8000, messages: [{ role: 'user', content: contentPrompt }],
  }));

  const translatedContent = localizeLinks(
    contentResponse.content[0].text.trim().replace(/<style[\s\S]*?<\/style>/gi, '').trim()
  );

  return { title: meta.title, handle: meta.handle, summary: meta.summary,
    content: translatedContent, meta_title: meta.meta_title, meta_descript: meta.meta_descript };
}

async function createPost(postData) {
  const res = await fetch(`${DEST.host}/posts`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', token: DEST.token }, body: JSON.stringify(postData),
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) throw new Error(`POST /posts failed on ${DEST.label}: ${JSON.stringify(json)}`);
  return json;
}

async function updatePost(postId, postData) {
  const res = await fetch(`${DEST.host}/posts/${postId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', token: DEST.token }, body: JSON.stringify(postData),
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) throw new Error(`PUT /posts/${postId} failed on ${DEST.label}: ${JSON.stringify(json)}`);
  return json;
}

async function main() {
  if (!DEST) throw new Error(`Unknown TARGET_LOCALE "${TARGET}" — use fr | es | it`);
  if (!EN.token) throw new Error('OEMSAAS_TOKEN_EN not set');
  if (!DEST.token) throw new Error(`token for ${DEST.label} not set`);

  console.log(`Target: ${TARGET} (${DEST.label}) | Dry run: ${DRY_RUN}${HANDLE_FILTER ? ` | Filter: ${HANDLE_FILTER}` : ''}`);

  const enPosts = await fetchAll(EN, 'posts');
  console.log(`Found ${enPosts.length} EN post(s)`);
  if (enPosts.length === 0) return;

  const toProcess = HANDLE_FILTER ? enPosts.filter(p => getHandle(p) === HANDLE_FILTER) : enPosts;
  if (toProcess.length === 0) { console.error(`No EN post with handle "${HANDLE_FILTER}"`); process.exit(1); }

  const destPosts = await fetchAll(DEST, 'posts');
  console.log(`Found ${destPosts.length} existing ${TARGET} post(s)`);

  const errors = [];
  for (const post of toProcess) {
    const enHandle = getHandle(post);
    console.log(`\n[${enHandle}] Translating -> ${TARGET}...`);
    let translated;
    try {
      translated = await translatePost(post);
      console.log(`  -> ${translated.handle} | ${translated.title}`);
    } catch (err) {
      console.error(`  ❌ Translation failed: ${err.message}`);
      errors.push({ handle: enHandle, error: err.message }); continue;
    }
    if (DRY_RUN) { console.log('  DRY_RUN — skipping upsert'); continue; }

    const postData = {
      title: translated.title, handle: translated.handle, summary: translated.summary,
      content: translated.content, meta_title: translated.meta_title, meta_descript: translated.meta_descript,
      status: post.status ?? 1,
      ...(post.src ? { src: post.src } : {}),
      ...(post.image_alt ? { image_alt: post.image_alt } : {}),
      ...(post.author_name ? { author_name: post.author_name } : {}),
    };
    const existing = destPosts.find(p => getHandle(p) === translated.handle);
    try {
      if (existing) { await updatePost(existing.id, postData); console.log(`  ✓ Updated -> ${DEST.baseUrl}/blogs/${translated.handle}`); }
      else { await createPost(postData); console.log(`  ✓ Created -> ${DEST.baseUrl}/blogs/${translated.handle}`); }
    } catch (err) {
      console.error(`  ❌ Upsert failed: ${err.message}`);
      errors.push({ handle: enHandle, error: err.message });
    }
  }

  if (errors.length > 0) {
    console.error(`\n⚠️  Completed with ${errors.length} error(s):`);
    errors.forEach(e => console.error(`  - [${e.handle}] ${e.error}`));
    process.exit(1);
  }
  console.log(`\n✅ ${TARGET} translation complete.`);
}

main().catch(err => { console.error('❌ Fatal:', err.message); process.exit(1); });
