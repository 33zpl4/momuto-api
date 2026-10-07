'use strict';
/**
 * ES team design pages (<team>-diseno-equipacion): repoint the "¿Por qué Momuto?"
 * trust link from the Zentral-only page to the 5-brand roundup (owner, 6 Oct 2026).
 * New pages get it from generate-and-deploy.js; this refreshes the ones already live.
 *
 *   DRY_RUN=true (default) lists what would change; DRY_RUN=false writes.
 * Writes are spaced and retried on the CMS throttle (code 1000). Gallery pages untouched.
 */
const HOST = 'https://openapi.oemapps.com';
const TOKEN = process.env.OEMSAAS_TOKEN_ES;
const DRY_RUN = process.env.DRY_RUN !== 'false';
const SUFFIX = '-diseno-equipacion';
const FROM = 'https://es.momuto.com/pages/zentral-opiniones-alternativa';
const TO = 'https://es.momuto.com/pages/mejores-webs-equipaciones-futbol-personalizadas-2026';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function api(method, url, body) {
  for (let i = 0; i < 5; i++) {
    const res = await fetch(`${HOST}${url}`, { method, headers: { 'Content-Type': 'application/json', token: TOKEN }, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.code === 0) return json;
    if (/Too many requests|"code":1000/.test(JSON.stringify(json)) || json.code === 1000) { await sleep(2000 * (i + 1)); continue; }
    throw new Error(`${method} ${url} failed: ${JSON.stringify(json).slice(0, 200)}`);
  }
  throw new Error(`${method} ${url} throttled out`);
}

(async () => {
  if (!TOKEN) { console.log('no OEMSAAS_TOKEN_ES — nothing to do'); return; }
  const pages = [];
  for (let page = 1; ; page++) {
    const j = await api('GET', `/pages?page=${page}&pagesize=50`);
    const list = j.data?.list || j.data || [];
    if (!Array.isArray(list) || !list.length) break;
    pages.push(...list.filter(p => p.handle && p.handle.endsWith(SUFFIX)));
    if (list.length < 50) break;
    await sleep(400);
  }
  console.log(`${pages.length} ES team pages found (DRY_RUN=${DRY_RUN})`);
  let changed = 0, same = 0, failed = 0;
  for (const p of pages) {
    const content = p.content || '';
    if (!content.includes(FROM)) { same++; continue; }
    if (DRY_RUN) { console.log(`  would patch ${p.handle}`); changed++; continue; }
    try {
      await api('PUT', `/pages/${p.id}`, {
        content: content.split(FROM).join(TO), title: p.title, meta_title: p.meta_title,
        meta_keywords: Array.isArray(p.meta_keywords) ? p.meta_keywords : [], meta_descript: p.meta_descript, handle: p.handle,
      });
      console.log(`  ✓ ${p.handle}`); changed++;
    } catch (e) { console.error(`  ❌ ${p.handle}: ${e.message}`); failed++; }
    await sleep(600);
  }
  console.log(`done: ${changed} ${DRY_RUN ? 'to patch' : 'patched'}, ${same} without the link, ${failed} failed`);
  if (failed) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
