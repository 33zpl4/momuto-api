/**
 * Audits all blog posts on momuto.com (EN) for:
 *   1. Language — detects posts still written in French and auto-translates them
 *   2. GEO weaknesses — checks each post against the 2026 Knowledge Graph Blueprint
 *
 * Modes:
 *   DRY_RUN=true   Fetch + audit + print report. No writes.
 *   DRY_RUN=false  Same, plus: translate any French posts and PUT them back to momuto.com
 *
 * Env:
 *   ANTHROPIC_API_KEY    - required
 *   OEMSAAS_TOKEN_EN     - required
 *   POST_HANDLE          - optional: restrict to one post handle
 *   DRY_RUN=true|false   - default false
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

const DRY_RUN = process.env.DRY_RUN !== 'false'; // safe default: dry run unless explicitly false
const HANDLE_FILTER = process.env.POST_HANDLE || '';

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
      if (page === 1) console.warn(`  ⚠️  ${endpoint} fetch failed: ${err.message}`);
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

// ─── Code-level checks (fast, no API cost) ───────────────────────────────────

function codeAudit(post) {
  const content = post.content || '';
  const issues = [];

  if (!post.meta_title) issues.push('missing meta_title');
  else if (post.meta_title.length > 65) issues.push(`meta_title too long (${post.meta_title.length} chars, max 65)`);

  if (!post.meta_descript) issues.push('missing meta_descript');
  else if (post.meta_descript.length > 160) issues.push(`meta_descript too long (${post.meta_descript.length} chars, max 160)`);

  if (!post.summary && !post.excerpt) issues.push('missing post summary/excerpt');

  const h1Count = (content.match(/<h1[\s>]/gi) || []).length;
  if (h1Count === 0) issues.push('no <h1> tag');
  else if (h1Count > 1) issues.push(`multiple <h1> tags (${h1Count}) — only one allowed`);

  if (!/<h2[\s>]/i.test(content)) issues.push('no <h2> headings');
  if (!/<h3[\s>]/i.test(content)) issues.push('no <h3> headings');

  const hasTable = /<table[\s>]/i.test(content);
  const hasChecklist = /checklist|<ul[\s>]/i.test(content);
  if (!hasTable && !hasChecklist) issues.push('no data interstitial (table or checklist)');

  if (!content.includes('Bebas Neue') && !content.includes('bebas')) {
    issues.push('missing Bebas Neue font (brand typography not loaded)');
  }

  // Rough word count from stripped HTML
  const wordCount = content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  if (wordCount < 300) issues.push(`very short post (~${wordCount} words)`);

  return { issues, wordCount, h1Count, hasTable, hasChecklist };
}

// ─── Claude audit (language + semantic GEO checks) ───────────────────────────

async function claudeAudit(post) {
  const handle = getHandle(post);
  // Send full content but cap at 6000 chars to stay well within token budget.
  // For long posts keep the top (GEO signals are usually in first/last 500 words).
  const content = post.content || '';
  const truncated = content.length > 6000
    ? content.slice(0, 4000) + '\n...[truncated]...\n' + content.slice(-1500)
    : content;

  const prompt = `You are auditing a blog post for MOMUTO (momuto.com), a custom football kit brand.

Analyse this post and return a JSON audit. Be precise and strict.

Post metadata:
- handle: ${handle}
- title: ${post.title || '(none)'}
- meta_title: ${post.meta_title || '(none)'}
- meta_descript: ${post.meta_descript || '(none)'}
- summary: ${(post.summary || post.excerpt || '').slice(0, 300)}

Post content (HTML):
${truncated}

Return ONLY this JSON (no markdown, no explanation):
{
  "language": "en" | "fr" | "es" | "other",
  "language_note": "one sentence — which language and how confident",
  "geo": {
    "has_tldr_box": true | false,
    "tldr_note": "brief explanation",
    "has_author_attribution": true | false,
    "author_note": "brief explanation",
    "h2_as_problem_solution": true | false,
    "h2_note": "brief explanation",
    "h3_as_questions": true | false,
    "h3_note": "brief explanation",
    "has_end_cta": true | false,
    "cta_note": "brief explanation"
  },
  "geo_issues": ["human-readable list of GEO issues found, empty array if none"]
}`;

  const response = await withRetry(() => client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  }));

  const raw = response.content[0].text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Claude returned invalid JSON: ${err.message}\n---\n${raw.slice(0, 400)}`);
  }
}

// ─── French → English translation ─────────────────────────────────────────────

async function translateToEnglish(post) {
  const handle = getHandle(post);
  const source = {
    title: post.title || '',
    handle: handle || '',
    summary: post.summary || post.excerpt || '',
    content: post.content || '',
    meta_title: post.meta_title || post.title || '',
    meta_descript: post.meta_descript || post.summary || '',
  };

  const prompt = `You are translating a blog post from French to English for MOMUTO (momuto.com), a custom football kit brand.

Rules:
- Preserve ALL HTML tags and structure exactly — only translate visible text content
- Do NOT translate: MOMUTO, brand names, product names, URLs, CSS class names, HTML attributes
- The handle (URL slug) must be English: lowercase, hyphens only, SEO-friendly
- meta_title: natural English SEO copy, max 65 characters
- meta_descript: natural English SEO copy, max 155 characters
- Return ONLY valid JSON — no markdown fences, no explanation

Source post (French):
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

  const raw = response.content[0].text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Claude returned invalid JSON for translation: ${err.message}\n---\n${raw.slice(0, 400)}`);
  }
}

// ─── CMS write ────────────────────────────────────────────────────────────────

async function updatePost(postId, postData) {
  const res = await fetch(`${EN.host}/posts/${postId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', token: EN.token },
    body: JSON.stringify(postData),
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) {
    throw new Error(`PUT /posts/${postId} failed: ${JSON.stringify(json)}`);
  }
  return json;
}

// ─── Report rendering ─────────────────────────────────────────────────────────

function renderRow(label, ok, note = '') {
  const icon = ok ? '✅' : '❌';
  return `    ${icon} ${label}${note ? ` — ${note}` : ''}`;
}

function renderReport(results) {
  const bar = '═'.repeat(64);
  console.log(`\n╔${bar}╗`);
  console.log(`║  EN BLOG POST AUDIT  —  ${new Date().toISOString().split('T')[0]}${' '.repeat(38 - new Date().toISOString().split('T')[0].length)}║`);
  console.log(`╚${bar}╝`);

  const geoIssueCounts = {};
  let frenchCount = 0;
  let postsWithIssues = 0;

  for (const r of results) {
    const allIssues = [...r.codeIssues, ...(r.claudeAudit?.geo_issues || [])];
    if (allIssues.length > 0) postsWithIssues++;
    if (r.claudeAudit?.language !== 'en') frenchCount++;

    console.log(`\n┌─ [${r.index}/${results.length}] ${r.handle}`);
    console.log(`│  Title: ${r.title || '(none)'}`);
    console.log(`│  Words: ~${r.wordCount}`);

    // Language
    const lang = r.claudeAudit?.language ?? '?';
    const langIcon = lang === 'en' ? '✅' : '🚨';
    console.log(`│  ${langIcon} Language: ${lang.toUpperCase()}${r.claudeAudit?.language_note ? ` — ${r.claudeAudit.language_note}` : ''}`);
    if (r.translated) {
      console.log(`│  🔄 Translated FR→EN: new handle "${r.translated.handle}"`);
      if (r.updateError) console.log(`│  ❌ Update failed: ${r.updateError}`);
      else if (!DRY_RUN) console.log(`│  ✅ Updated on momuto.com`);
      else console.log(`│  ⚠️  DRY_RUN — update skipped`);
    }

    // Code-level issues
    if (r.codeIssues.length > 0) {
      console.log('│');
      console.log('│  Code checks:');
      for (const issue of r.codeIssues) {
        console.log(`│    ❌ ${issue}`);
        geoIssueCounts[issue] = (geoIssueCounts[issue] || 0) + 1;
      }
    }

    // GEO checks
    if (r.claudeAudit) {
      const geo = r.claudeAudit.geo;
      console.log('│');
      console.log('│  GEO checks:');
      console.log(renderRow('TL;DR / Key Takeaways box', geo.has_tldr_box, geo.tldr_note));
      console.log(renderRow('Author attribution', geo.has_author_attribution, geo.author_note));
      console.log(renderRow('H2s as problem/solution', geo.h2_as_problem_solution, geo.h2_note));
      console.log(renderRow('H3s as questions', geo.h3_as_questions, geo.h3_note));
      console.log(renderRow('End CTA block', geo.has_end_cta, geo.cta_note));

      for (const issue of r.claudeAudit.geo_issues) {
        geoIssueCounts[issue] = (geoIssueCounts[issue] || 0) + 1;
      }
    }

    if (r.auditError) console.log(`│  ⚠️  Audit error: ${r.auditError}`);

    console.log('└' + '─'.repeat(64));
  }

  // Summary
  console.log(`\n${'═'.repeat(66)}`);
  console.log('SUMMARY');
  console.log(`${'─'.repeat(66)}`);
  console.log(`  Total posts:           ${results.length}`);
  console.log(`  Non-English posts:     ${frenchCount}${frenchCount > 0 && !DRY_RUN ? ' → translated and updated' : frenchCount > 0 ? ' → DRY_RUN (not updated)' : ''}`);
  console.log(`  Posts with any issue:  ${postsWithIssues}/${results.length}`);

  if (Object.keys(geoIssueCounts).length > 0) {
    console.log(`\n  Most common issues (sorted by frequency):`);
    const sorted = Object.entries(geoIssueCounts).sort((a, b) => b[1] - a[1]);
    for (const [issue, count] of sorted) {
      const bar = '█'.repeat(count);
      console.log(`    ${bar} (${count}/${results.length})  ${issue}`);
    }
  }

  console.log(`${'═'.repeat(66)}\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!EN.token) throw new Error('OEMSAAS_TOKEN_EN not set');
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');

  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (will update French posts)'}`);
  if (HANDLE_FILTER) console.log(`Filter: ${HANDLE_FILTER}`);

  console.log(`\nFetching posts from ${EN.label}...`);
  const posts = await fetchAll(EN, 'posts');
  console.log(`Found ${posts.length} post(s)`);

  if (posts.length === 0) {
    console.log('No posts found — nothing to audit.');
    return;
  }

  const toProcess = HANDLE_FILTER
    ? posts.filter(p => getHandle(p) === HANDLE_FILTER)
    : posts;

  if (toProcess.length === 0) {
    console.error(`No post found with handle "${HANDLE_FILTER}"`);
    process.exit(1);
  }

  const results = [];
  let hasErrors = false;

  for (let i = 0; i < toProcess.length; i++) {
    const post = toProcess[i];
    const handle = getHandle(post);
    process.stdout.write(`\nAuditing [${i + 1}/${toProcess.length}] ${handle}...`);

    const { issues: codeIssues, wordCount } = codeAudit(post);

    let claudeAuditResult = null;
    let auditError = null;
    let translated = null;
    let updateError = null;

    try {
      claudeAuditResult = await claudeAudit(post);
    } catch (err) {
      auditError = err.message;
      hasErrors = true;
      console.log(' ⚠️  audit error');
    }

    // Translate if French (and token present)
    if (claudeAuditResult?.language === 'fr') {
      process.stdout.write(' [translating FR→EN]');
      try {
        translated = await translateToEnglish(post);
        if (!DRY_RUN) {
          const postData = {
            title: translated.title,
            handle: translated.handle,
            summary: translated.summary,
            content: translated.content,
            meta_title: translated.meta_title,
            meta_descript: translated.meta_descript,
            ...(post.image ? { image: post.image } : {}),
            ...(post.cover ? { cover: post.cover } : {}),
          };
          await updatePost(post.id, postData);
        }
      } catch (err) {
        updateError = err.message;
        hasErrors = true;
      }
    }

    console.log(' done');

    results.push({
      index: i + 1,
      handle,
      title: post.title,
      wordCount,
      codeIssues,
      claudeAudit: claudeAuditResult,
      auditError,
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
