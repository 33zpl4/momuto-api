/**
 * One-off cleanup: find any live references to the dead `perche-momuto` handle
 * on it.momuto.com and repoint them to the renamed comparison page
 * (`confronto-fornitori-maglie-calcio-2026`).
 *
 * The IT comparison page was originally a stub at /pages/perche-momuto, then
 * renamed in place, so that handle no longer resolves. Any href still pointing
 * at it (e.g. the "Perché MOMUTO?" CTA baked into older team pages) is a 404.
 *
 * Scans page + post + collection content. Auto-fixes pages and posts (known
 * PUT shapes via the OEMSaaS API); collections are report-only (this repo
 * updates collections via xlsx import, not the API).
 *
 * Usage:
 *   OEMSAAS_TOKEN_IT=xxx node scripts/fix-perche-momuto-links.js            # dry run (default)
 *   OEMSAAS_TOKEN_IT=xxx DRY_RUN=false node scripts/fix-perche-momuto-links.js
 */

'use strict';

const IT = {
  host: 'https://openapi.oemapps.com',
  token: process.env.OEMSAAS_TOKEN_IT,
  label: 'it.momuto.com',
};

const OLD = 'perche-momuto';
const NEW = 'confronto-fornitori-maglie-calcio-2026';
const DRY_RUN = process.env.DRY_RUN !== 'false';
// Pause between writes to stay under the OEMSaaS rate limit (code 1000).
const THROTTLE_MS = Number(process.env.THROTTLE_MS || 600);

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchAll(endpoint) {
  let page = 1;
  const pagesize = 50;
  const items = [];
  while (true) {
    const url = `${IT.host}/${endpoint}?page=${page}&pagesize=${pagesize}`;
    let result;
    try {
      const res = await fetch(url, { headers: { token: IT.token } });
      result = await res.json();
      if (!res.ok || result.code !== 0) {
        if (page === 1) console.warn(`  ⚠️  ${endpoint}: ${JSON.stringify(result)}`);
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

// Which string fields to inspect for the dead handle, per content type.
const TEXT_FIELDS = ['content', 'meta_descript', 'meta_title', 'summary', 'title', 'description'];

function matchingFields(item) {
  return TEXT_FIELDS.filter(f => typeof item[f] === 'string' && item[f].includes(OLD));
}

async function put(endpoint, id, body, maxAttempts = 5) {
  const delays = [2000, 4000, 8000, 16000];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res, json;
    try {
      res = await fetch(`${IT.host}/${endpoint}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', token: IT.token },
        body: JSON.stringify(body),
      });
      json = await res.json();
    } catch (err) {
      json = { msg: err.message };
    }
    if (res && res.ok && json && json.code === 0) return json;

    const msg = json?.msg || `HTTP ${res?.status}`;
    const rateLimited = res?.status === 429 || json?.code === 1000 || /too many requests/i.test(msg);
    if (rateLimited && attempt < maxAttempts) {
      const delay = delays[attempt - 1] ?? 16000;
      console.log(`    ⏳ rate limited — retrying in ${delay / 1000}s (attempt ${attempt}/${maxAttempts})`);
      await sleep(delay);
      continue;
    }
    throw new Error(`PUT /${endpoint}/${id} failed: ${JSON.stringify(json)}`);
  }
}

// Replace the dead handle everywhere in `content` only (where hrefs live).
// Other matched fields are surfaced in the report but left untouched unless they
// are `content`, to avoid unintended edits to titles/descriptions.
const fix = s => s.split(OLD).join(NEW);

async function fixPages() {
  const pages = await fetchAll('pages');
  console.log(`\nPages: ${pages.length} fetched`);
  let fixed = 0;
  for (const p of pages) {
    const fields = matchingFields(p);
    if (fields.length === 0) continue;
    console.log(`  • page "${p.handle}" (id ${p.id}) — match in: ${fields.join(', ')}`);
    if (!String(p.content || '').includes(OLD)) {
      console.log(`    ⚠️  match is NOT in content (in ${fields.join(', ')}) — needs manual edit`);
    }
    if (DRY_RUN) continue;
    await put('pages', p.id, {
      content: fix(p.content || ''),
      title: p.title,
      meta_title: p.meta_title,
      meta_keywords: p.meta_keywords,
      meta_descript: p.meta_descript,
      handle: p.handle,
    });
    console.log(`    ✓ updated`);
    fixed++;
    await sleep(THROTTLE_MS);
  }
  return { scanned: pages.length, fixed };
}

async function fixPosts() {
  const posts = await fetchAll('posts');
  console.log(`\nPosts: ${posts.length} fetched`);
  let fixed = 0;
  for (const p of posts) {
    const fields = matchingFields(p);
    if (fields.length === 0) continue;
    console.log(`  • post "${p.handle}" (id ${p.id}) — match in: ${fields.join(', ')}`);
    if (DRY_RUN) continue;
    await put('posts', p.id, {
      title: p.title,
      handle: p.handle,
      summary: p.summary || '',
      content: fix(p.content || ''),
      meta_title: p.meta_title,
      meta_descript: p.meta_descript,
    });
    console.log(`    ✓ updated`);
    fixed++;
    await sleep(THROTTLE_MS);
  }
  return { scanned: posts.length, fixed };
}

async function reportCollections() {
  const cols = await fetchAll('collections');
  console.log(`\nCollections: ${cols.length} fetched (report-only)`);
  let hits = 0;
  for (const c of cols) {
    const fields = matchingFields(c);
    if (fields.length === 0) continue;
    hits++;
    console.log(`  • collection "${c.handle || c.alias || c.id}" — match in: ${fields.join(', ')} — FIX MANUALLY (collections are updated via xlsx import)`);
  }
  return { scanned: cols.length, hits };
}

async function main() {
  if (!IT.token) throw new Error('OEMSAAS_TOKEN_IT not set');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (will update pages + posts)'}`);
  console.log(`Replacing "${OLD}" → "${NEW}" on ${IT.label}`);

  const pages = await fixPages();
  const posts = await fixPosts();
  const cols = await reportCollections();

  console.log('\n────────── SUMMARY ──────────');
  console.log(`Pages:       ${pages.scanned} scanned, ${DRY_RUN ? '(dry run)' : pages.fixed + ' fixed'}`);
  console.log(`Posts:       ${posts.scanned} scanned, ${DRY_RUN ? '(dry run)' : posts.fixed + ' fixed'}`);
  console.log(`Collections: ${cols.scanned} scanned, ${cols.hits} match(es) needing manual fix`);
  if (DRY_RUN) console.log('\nDRY RUN — re-run with DRY_RUN=false to apply page + post fixes.');
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
