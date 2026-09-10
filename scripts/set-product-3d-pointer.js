#!/usr/bin/env node
/**
 * set-product-3d-pointer.js — repoint a product's 3D-customizer link
 * (the `mudel` inside its `inner_title` JSON) from a per-store list.
 *
 * Source of truth: cms/product-3d-pointers/<store>.json
 *   [{ "id": 16913848, "handle": "maillot-momuto-basket-pro",
 *      "mudel": "configId=avy6d4xt&suitName=basketball", "note": "…" }]
 *
 * For each entry: GET /products/{id} (the single endpoint — the list omits
 * fields), refuse to touch anything that does not look like the product we
 * expect (title, variants, handle, a parseable type:"3d" inner_title), then
 * PUT the FULL live object back with only inner_title.mudel changed (CLAUDE.md
 * rule 1: PUT replaces the whole object). Read back and verify — the ack is
 * not evidence. Writes are spaced and retried on throttling.
 *
 * Env:
 *   OEMSAAS_TOKEN_<STORE>  - store token (EN/ES/FR/IT/US)
 *   DRY_RUN=true|false     - default true (push-triggered runs set false)
 *   TARGET_STORE           - one store (blank = every file in the folder)
 *   CHANGED_FILES          - push runs: only the listed pointer files
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'cms', 'product-3d-pointers');
const HOST = 'https://openapi.oemapps.com';
const DRY_RUN = process.env.DRY_RUN !== 'false';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(token, method, endpoint, body) {
  const res = await fetch(`${HOST}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json', token },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.code !== 0) throw new Error(`${method} ${endpoint}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

async function withRetry(fn, label, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      const throttled = /Too many requests|"code":1000/.test(e.message);
      if (!throttled || i === tries - 1) throw e;
      const wait = 2000 * (i + 1);
      console.log(`   ⏳ throttled on ${label} — retry ${i + 1}/${tries - 1} in ${wait / 1000}s`);
      await sleep(wait);
    }
  }
}

// A throttled GET must throw (it does, via api()) — never read as "not found".
async function fetchProduct(token, id) {
  const json = await withRetry(() => api(token, 'GET', `/products/${id}`), `GET ${id}`);
  const p = (json.data && json.data.product) || json.data;
  return p && typeof p === 'object' && !Array.isArray(p) ? p : null;
}

function wantedInner(live, mudel) {
  let inner;
  try { inner = JSON.parse(live.inner_title); } catch { throw new Error(`inner_title is not JSON: ${String(live.inner_title).slice(0, 120)}`); }
  if (!inner || inner.type !== '3d') throw new Error(`inner_title is not a type:"3d" pointer: ${String(live.inner_title).slice(0, 120)}`);
  return { current: inner.mudel, next: JSON.stringify({ ...inner, mudel }) };
}

async function processEntry(token, entry) {
  const label = `${entry.handle || entry.id} (id ${entry.id})`;
  if (!entry.id || !entry.mudel) throw new Error(`${label}: entry needs id + mudel`);
  const live = await fetchProduct(token, entry.id);
  // Guard on the read-back before sending anything (docs/oemsaas-api-notes.md).
  if (!live || !live.title) throw new Error(`${label}: refusing to PUT blind — GET returned no product/title`);
  if (!Array.isArray(live.variants) || !live.variants.length) throw new Error(`${label}: refusing to PUT — would drop the variants`);
  if (entry.handle && live.handle !== entry.handle) throw new Error(`${label}: live handle is "${live.handle}" — wrong product, not touching it`);
  const { current, next } = wantedInner(live, entry.mudel);
  if (current === entry.mudel) { console.log(`  ·  ${label}: already "${entry.mudel}" — up to date`); return 'skip'; }
  console.log(`  ${label}: "${current}" → "${entry.mudel}"`);
  if (DRY_RUN) { console.log(`  DRY_RUN — would PUT /products/${entry.id} (full object, inner_title only changed)`); return 'dry'; }
  await withRetry(() => api(token, 'PUT', `/products/${entry.id}`, { ...live, inner_title: next }), `PUT ${entry.id}`);
  await sleep(600);
  const back = await fetchProduct(token, entry.id);
  const got = (() => { try { return JSON.parse(back.inner_title).mudel; } catch { return null; } })();
  if (got !== entry.mudel) throw new Error(`${label}: read-back mudel is "${got}" — PUT not effective`);
  if (!Array.isArray(back.variants) || back.variants.length !== live.variants.length) throw new Error(`${label}: read-back variant count changed (${live.variants.length} → ${back.variants && back.variants.length})`);
  console.log(`  ✅ ${label}: verified — ${back.detail_url || ''}`);
  return 'ok';
}

async function main() {
  console.log(`set-product-3d-pointer — dry_run=${DRY_RUN}`);
  let files = fs.readdirSync(DIR).filter(f => /^[a-z]{2}\.json$/.test(f));
  const only = (process.env.TARGET_STORE || '').trim().toLowerCase();
  if (only) files = files.filter(f => f === `${only}.json`);
  const changed = (process.env.CHANGED_FILES || '').trim();
  if (changed) {
    const set = new Set(changed.split(/\s+/).map(p => path.basename(p)));
    files = files.filter(f => set.has(f));
  }
  if (!files.length) { console.log('nothing to do (no pointer files selected)'); return; }
  let failed = false;
  for (const f of files) {
    const store = f.replace('.json', '');
    const token = process.env[`OEMSAAS_TOKEN_${store.toUpperCase()}`];
    const entries = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
    console.log(`\n${store}: ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`);
    if (!token) { console.error(`  ❌ OEMSAAS_TOKEN_${store.toUpperCase()} not set`); failed = true; continue; }
    for (const entry of entries) {
      try { await processEntry(token, entry); }
      catch (e) { console.error(`  ❌ ${e.message}`); failed = true; }
      await sleep(600);
    }
  }
  if (failed) process.exit(1);
}

module.exports = { processEntry, wantedInner };
if (require.main === module) main().catch(err => { console.error(err); process.exit(1); });
