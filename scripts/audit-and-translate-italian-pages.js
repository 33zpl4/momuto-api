/**
 * Audits all pages on it.momuto.com for language, then translates anything
 * that is not Italian - English or French - back into Italian.
 *
 * The IT store demonstrably carries both: 24 of its 65 blog posts were French
 * or English. Pages were never audited against the current inventory.
 *
 * CAUTION: translating rewrites the handle, which changes the live URL. Check
 * GSC for impressions on the old handle before running with DRY_RUN=false.
 *
 * Modes:
 *   DRY_RUN=true   Fetch + detect language + print report. No writes.
 *   DRY_RUN=false  Same, plus: translate English pages and PUT to it.momuto.com
 *
 * Env:
 *   ANTHROPIC_API_KEY    - required
 *   OEMSAAS_TOKEN_IT     - required
 *   PAGE_HANDLE          - optional: restrict to one page handle
 *   DRY_RUN=true|false   - default true (safe)
 */

'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const IT = {
  host: 'https://openapi.oemapps.com',
  token: process.env.OEMSAAS_TOKEN_IT,
  label: 'it.momuto.com',
  baseUrl: 'https://it.momuto.com',
};

const DRY_RUN = process.env.DRY_RUN !== 'false';
const HANDLE_FILTER = process.env.PAGE_HANDLE || '';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

async function fetchAllPages(domain) {
  let page = 1;
  const pagesize = 50;
  const items = [];
  while (true) {
    const url = `${domain.host}/pages?page=${page}&pagesize=${pagesize}`;
    let result;
    try {
      const response = await fetch(url, { headers: { token: domain.token } });
      result = await response.json();
      if (!response.ok || result.code !== 0) {
        if (page === 1) console.warn(`  ⚠️  pages error on ${domain.label}: ${JSON.stringify(result)}`);
        break;
      }
    } catch (err) {
      if (page === 1) console.warn(`  ⚠️  pages fetch failed: ${err.message}`);
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

// ─── Language detection ───────────────────────────────────────────────────────

async function detectLanguage(page) {
  const content = page.content || '';
  const wordCount = content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

  // Skip stubs — nothing meaningful to detect or translate
  if (wordCount < 20) return { language: 'stub', language_note: `Very short page (~${wordCount} words) — likely a stub` };

  const truncated = content.length > 4000
    ? content.slice(0, 3000) + '\n...[truncated]...\n' + content.slice(-800)
    : content;

  const prompt = `Detect the language of this CMS page content for it.momuto.com (Italian football kit website).

Page metadata:
- handle: ${page.handle}
- title: ${page.title || '(none)'}
- meta_title: ${page.meta_title || '(none)'}
- meta_descript: ${page.meta_descript || '(none)'}

Page content (HTML):
${truncated}

Return ONLY this JSON (no markdown):
{
  "language": "it" | "en" | "fr" | "es" | "other" | "mixed",
  "language_note": "one sentence — which language, confidence level, and any notable observations"
}`;

  const response = await withRetry(() => client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  }));

  const raw = response.content[0].text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Claude returned invalid JSON for language detection: ${err.message}\n---\n${raw.slice(0, 300)}`);
  }
}

// ─── Translation ──────────────────────────────────────────────────────────────

async function translatePage(page) {
  const preamble = `You are translating a website page for MOMUTO (it.momuto.com), an Italian-language custom football kit website.
Rules:
- Do NOT translate: MOMUTO, brand names, product names, URLs, CSS class names, HTML attributes, JSON-LD keys
- Use natural Italian — not word-for-word`;

  // Call 1: metadata as KEY:VALUE lines — avoids JSON escaping issues entirely
  const metaPrompt = `${preamble}

Translate the following page metadata from English to Italian.
- handle (URL slug): Italian, lowercase, hyphens only, SEO-friendly
- META_TITLE: under 60 characters
- META_DESC: under 155 characters
- META_KEYWORDS: comma-separated Italian keywords (5–8 terms)

Source:
TITLE: ${page.title || ''}
HANDLE: ${page.handle || ''}
META_TITLE: ${page.meta_title || ''}
META_DESC: ${page.meta_descript || ''}
META_KEYWORDS: ${Array.isArray(page.meta_keywords) ? page.meta_keywords.join(', ') : (page.meta_keywords || '')}

Reply with EXACTLY these 5 lines and nothing else — no JSON, no HTML, no extra text:
TITLE: <translated>
HANDLE: <slug>
META_TITLE: <translated>
META_DESC: <translated>
META_KEYWORDS: <keyword1>, <keyword2>, ...`;

  const metaResponse = await withRetry(() => client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
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

  const title = metaLines['TITLE'] || page.title || '';
  const handle = metaLines['HANDLE'] || page.handle || '';
  if (!title || !handle) {
    throw new Error(`Metadata translation incomplete. Raw response:\n${metaRaw.slice(0, 500)}`);
  }

  const meta_keywords = (metaLines['META_KEYWORDS'] || '')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);

  // Call 2: HTML content as raw string — no JSON wrapper
  const contentPrompt = `${preamble}

Translate the following HTML page content from English to Italian.
- Preserve ALL HTML tags and structure exactly — only translate visible text content
- Return ONLY the translated HTML — no JSON, no markdown fences, no explanation

${page.content || ''}`;

  const contentResponse = await withRetry(() => client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: contentPrompt }],
  }));

  return {
    title,
    handle,
    meta_title: metaLines['META_TITLE'] || page.meta_title || '',
    meta_descript: metaLines['META_DESC'] || page.meta_descript || '',
    meta_keywords,
    content: contentResponse.content[0].text.trim(),
  };
}

// ─── CMS write ────────────────────────────────────────────────────────────────

async function updatePage(pageId, pageData) {
  const res = await fetch(`${IT.host}/pages/${pageId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', token: IT.token },
    body: JSON.stringify(pageData),
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) {
    throw new Error(`PUT /pages/${pageId} failed: ${JSON.stringify(json)}`);
  }
  return json;
}

// ─── Report ───────────────────────────────────────────────────────────────────

function renderReport(results) {
  const bar = '═'.repeat(64);
  console.log(`\n╔${bar}╗`);
  console.log(`║  IT PAGES AUDIT  —  ${new Date().toISOString().split('T')[0]}${' '.repeat(43 - new Date().toISOString().split('T')[0].length)}║`);
  console.log(`╚${bar}╝`);

  let foreignCount = 0;
  const foreignByLang = {};
  let stubCount = 0;
  let translatedCount = 0;

  for (const r of results) {
    const lang = r.detection?.language ?? '?';
    const langIcon = lang === 'it' ? '✅' : lang === 'stub' ? '⚪' : '🚨';

    console.log(`\n┌─ [${r.index}/${results.length}] ${r.handle}`);
    console.log(`│  Title:  ${r.title || '(none)'}`);
    console.log(`│  Words:  ~${r.wordCount}`);
    console.log(`│  ${langIcon} Language: ${lang.toUpperCase()}${r.detection?.language_note ? ` — ${r.detection.language_note}` : ''}`);

    if (lang !== 'it' && lang !== 'stub') {
      foreignCount++;
      foreignByLang[lang] = (foreignByLang[lang] || 0) + 1;
    }
    if (lang === 'stub') stubCount++;

    if (r.translated) {
      console.log(`│  🔄 Translated ${(r.detection?.language ?? '?').toUpperCase()}→IT:`);
      console.log(`│     title:  ${r.translated.title}`);
      console.log(`│     handle: ${r.translated.handle}`);
      if (r.updateError) {
        console.log(`│  ❌ Update failed: ${r.updateError}`);
      } else if (!DRY_RUN) {
        translatedCount++;
        console.log(`│  ✅ Updated on ${IT.label} → ${IT.baseUrl}/pages/${r.translated.handle}`);
      } else {
        console.log(`│  ⚠️  DRY_RUN — update skipped`);
      }
    }

    if (r.detectionError) console.log(`│  ⚠️  Detection error: ${r.detectionError}`);

    console.log('└' + '─'.repeat(64));
  }

  console.log(`\n${'═'.repeat(66)}`);
  console.log('SUMMARY');
  console.log(`${'─'.repeat(66)}`);
  console.log(`  Total pages:        ${results.length}`);
  console.log(`  Already Italian:    ${results.length - foreignCount - stubCount}`);
  console.log(`  Stubs (skipped):    ${stubCount}`);
  const breakdown = Object.entries(foreignByLang).map(([l, n]) => `${l}:${n}`).join(' ');
  console.log(`  Not Italian:        ${foreignCount}${breakdown ? ` (${breakdown})` : ''}${foreignCount > 0 && !DRY_RUN ? ` → ${translatedCount} translated` : foreignCount > 0 ? ' → DRY_RUN (not updated)' : ''}`);
  // Translation renames the handle, which changes the live URL. On a page that
  // already has impressions, redirect the old handle before running non-dry.
  if (foreignCount > 0) console.log('  NOTE: translating renames the handle — check GSC for the old URL first.');
  console.log(`${'═'.repeat(66)}\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!IT.token) throw new Error('OEMSAAS_TOKEN_IT not set');
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');

  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (will update English pages)'}`);
  if (HANDLE_FILTER) console.log(`Filter: ${HANDLE_FILTER}`);

  console.log(`\nFetching pages from ${IT.label}...`);
  const pages = await fetchAllPages(IT);
  console.log(`Found ${pages.length} page(s)`);

  if (pages.length === 0) {
    console.log('No pages found — nothing to audit.');
    return;
  }

  const toProcess = HANDLE_FILTER
    ? pages.filter(p => p.handle === HANDLE_FILTER)
    : pages;

  if (toProcess.length === 0) {
    console.error(`No page found with handle "${HANDLE_FILTER}"`);
    process.exit(1);
  }

  const results = [];
  let hasErrors = false;

  for (let i = 0; i < toProcess.length; i++) {
    const page = toProcess[i];
    const handle = page.handle;
    const content = page.content || '';
    const wordCount = content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

    process.stdout.write(`\nAuditing [${i + 1}/${toProcess.length}] ${handle}...`);

    let detection = null;
    let detectionError = null;
    let translated = null;
    let updateError = null;

    try {
      detection = await detectLanguage(page);
    } catch (err) {
      detectionError = err.message;
      hasErrors = true;
      console.log(' ⚠️  detection error');
    }

    const lang = detection?.language;

    // Translate if English (not stub, not already Italian)
    if (lang && lang !== 'it' && lang !== 'stub') {
      process.stdout.write(` [translating ${lang.toUpperCase()}→IT]`);
      try {
        translated = await translatePage(page);
        if (!DRY_RUN) {
          await updatePage(page.id, {
            title: translated.title,
            handle: translated.handle,
            content: translated.content,
            meta_title: translated.meta_title,
            meta_descript: translated.meta_descript,
            meta_keywords: translated.meta_keywords,
          });
        }
      } catch (err) {
        updateError = err.message;
        hasErrors = true;
        console.log(' ❌');
      }
    }

    console.log(' done');

    results.push({
      index: i + 1,
      handle,
      title: page.title,
      wordCount,
      detection,
      detectionError,
      translated,
      updateError,
    });
  }

  renderReport(results);

  if (hasErrors) process.exit(1);
}

main().catch(err => {
  console.error('❌ Fatal:', err.message);
  process.exit(1);
});
