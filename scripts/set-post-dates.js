'use strict';

/**
 * set-post-dates.js — gives API-created posts that still show 1969-12-31 a real `published_at`.
 *
 * Owner ruling (15 Oct 2026): the dates are nominal, spread over the last 2-5 weeks (14-35 days before today),
 * derived from the handle so a re-run gives the same date. Posts that already have a real date are never touched.
 *
 * PUT replaces the whole post, so each one is sent back whole with only published_at changed (same payload shape as
 * unpublish-posts.js), then the store is listed again and every post is read back: VERIFIED or MISMATCH.
 *
 * Env: DRY_RUN=false to write (default true) · LOCALES=en,us,es,fr,it (default all) · TODAY=YYYY-MM-DD (default: now, UTC)
 *      OEMSAAS_TOKEN_EN/US/ES/FR/IT
 */
const crypto = require('crypto');

const HOST = 'https://openapi.oemapps.com';
const DRY_RUN = process.env.DRY_RUN !== 'false';
const LOCALES = (process.env.LOCALES || 'en,us,es,fr,it').split(',').map(s => s.trim()).filter(Boolean);
const TOKENS = { en: process.env.OEMSAAS_TOKEN_EN, us: process.env.OEMSAAS_TOKEN_US, es: process.env.OEMSAAS_TOKEN_ES, fr: process.env.OEMSAAS_TOKEN_FR, it: process.env.OEMSAAS_TOKEN_IT };
const TODAY = process.env.TODAY || new Date().toISOString().slice(0, 10);

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function withRetry(fn, label, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      if (!/Too many requests|"code":1000/.test(e.message) || i === tries - 1) throw e;
      console.log(`   ⏳ throttled on ${label} — retry ${i + 1}/${tries - 1}`);
      await sleep(2000 * (i + 1));
    }
  }
}
const getHandle = p => p.handle || p.alias || p.slug || p.url_key || null;
const isEpoch = d => !d || /^(1969|1970|0000)/.test(String(d));

async function fetchPosts(token) {
  let page = 1; const items = [];
  while (true) {
    const json = await withRetry(async () => {
      const res = await fetch(`${HOST}/posts?page=${page}&pagesize=50`, { headers: { token } });
      const body = await res.json();
      if (!res.ok || body.code !== 0) throw new Error(`GET /posts page ${page}: ${JSON.stringify(body).slice(0, 200)}`);   // never read a failed listing as "no posts"
      return body;
    }, `list p${page}`);
    const list = json.data?.list ?? (Array.isArray(json.data) ? json.data : []);
    if (!list.length) break;
    items.push(...list);
    if (list.length < 50) break;
    page++;
  }
  return items;
}

// 14..35 days before TODAY, stable per handle
function dateFor(handle) {
  const n = crypto.createHash('sha1').update(handle).digest().readUInt16BE(0) % 22;   // 0..21
  const d = new Date(TODAY + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - (14 + n));
  return d.toISOString().slice(0, 10);
}

function payloadFor(post, handle, published_at) {
  let kw = post.meta_keywords;
  if (typeof kw === 'string') { try { kw = JSON.parse(kw); } catch (_) { kw = []; } }   // meta_keywords MUST be an array
  return {
    title: post.title || '',
    content: post.content || '',
    meta_title: post.meta_title || post.title || '',
    meta_descript: post.meta_descript || post.summary || '',
    summary: post.summary || post.excerpt || '',
    author: post.author || post.author_name || '',
    handle,
    status: Number(post.status ?? 1),
    published_at,
    ...(Array.isArray(kw) ? { meta_keywords: kw } : {}),
    ...(post.src ? { src: post.src } : {}),
    ...(post.image_alt ? { image_alt: post.image_alt } : {}),
  };
}

async function runLocale(locale) {
  const token = TOKENS[locale];
  if (!token) { console.warn(`⚠️  ${locale}: no token — skipped`); return { bad: 0 }; }
  console.log(`\n=== ${locale} ===`);
  const posts = await fetchPosts(token);
  const todo = posts.filter(p => getHandle(p) && isEpoch(p.published_at) && Number(p.status ?? 1) === 1);
  console.log(`${posts.length} posts, ${todo.length} with no real date (published ones only)`);
  let bad = 0; const written = [];
  for (const p of todo) {
    const handle = getHandle(p), date = dateFor(handle);
    console.log(`  → ${handle}: ${p.published_at || '(none)'} → ${date}${DRY_RUN ? '   DRY RUN' : ''}`);
    if (DRY_RUN) continue;
    try {
      await withRetry(async () => {
        const res = await fetch(`${HOST}/posts/${p.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', token }, body: JSON.stringify(payloadFor(p, handle, date)) });
        const body = await res.json();
        if (!res.ok || body.code !== 0) throw new Error(`PUT /posts/${p.id}: ${JSON.stringify(body).slice(0, 200)}`);
      }, handle);
      written.push({ handle, date });
    } catch (e) { console.error(`     ❌ ${e.message}`); bad++; }
    await sleep(600);
  }
  if (!DRY_RUN && written.length) {
    const fresh = await fetchPosts(token);
    const by = new Map(fresh.map(p => [getHandle(p), p]));
    for (const w of written) {
      const got = by.get(w.handle);
      const ok = got && String(got.published_at).slice(0, 10) === w.date && String(got.content || '').length > 0;
      console.log(`  ${ok ? 'VERIFIED' : 'MISMATCH'} ${w.handle} published_at ${got ? got.published_at : '(gone)'} (sent ${w.date})`);
      if (!ok) bad++;
    }
  }
  return { bad };
}

(async () => {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'} · today ${TODAY} · locales ${LOCALES.join(',')}`);
  let bad = 0;
  for (const l of LOCALES) bad += (await runLocale(l)).bad;
  if (bad) { console.error(`\n${bad} problem(s)`); process.exit(1); }
  console.log('\n✅ Done.');
})().catch(e => { console.error(e); process.exit(1); });
