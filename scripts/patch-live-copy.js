'use strict';
/**
 * Apply a list of exact text replacements to LIVE CMS pages (read live → replace → write the same object back).
 * Use it instead of deploying a repo copy when the repo copy may be stale or the page is pipeline-owned (galleries).
 * Dry run by default.
 *
 *   SPEC=scripts/live-copy-fixes/2026-10-12.json DRY_RUN=true|false  OEMSAAS_TOKEN_EN/ES/FR/IT/US
 * Spec: [{ store, handle, why, replace: [[from, to], ...], fields?: ['content','title',...] }]
 * Replacements run in order on title, meta_title, meta_descript and content. A replacement that matches nothing is
 * reported (it may already be applied); the run only fails on a failed read/write.
 */
const fs = require('fs');
const path = require('path');
const HOST = 'https://openapi.oemapps.com';
const DRY_RUN = process.env.DRY_RUN !== 'false';
const SPEC = path.resolve(process.env.SPEC || '');
const TOKENS = { en: process.env.OEMSAAS_TOKEN_EN, es: process.env.OEMSAAS_TOKEN_ES, fr: process.env.OEMSAAS_TOKEN_FR, it: process.env.OEMSAAS_TOKEN_IT, us: process.env.OEMSAAS_TOKEN_US };
const FIELDS = ['title', 'meta_title', 'meta_descript', 'content'];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function withRetry(fn) {
  for (let i = 0; i < 5; i++) {
    try { return await fn(); } catch (e) {
      if (/Too many requests|"code":1000/.test(e.message) && i < 4) { await sleep(2000 * (i + 1)); continue; }
      throw e;
    }
  }
}
async function getPage(token, handle) {
  const res = await fetch(`${HOST}/pages?handle=${encodeURIComponent(handle)}`, { headers: { token } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.code !== 0) throw new Error(`GET /pages?handle=${handle} failed: ${JSON.stringify(json).slice(0, 200)}`);
  const list = json.data?.list || json.data || [];
  return Array.isArray(list) ? (list.find(p => p.handle === handle) || null) : null;
}

(async () => {
  if (!SPEC || !fs.existsSync(SPEC)) { console.error('SPEC file not found'); process.exit(1); }
  const items = JSON.parse(fs.readFileSync(SPEC, 'utf8'));
  let failed = 0;
  for (const it of items) {
    const tag = `${it.store}/${it.handle}`;
    try {
      const token = TOKENS[it.store];
      if (!token) { console.log(`${tag}: no token — skipped`); continue; }
      const page = await withRetry(() => getPage(token, it.handle));
      if (!page) throw new Error('page not found');
      const next = {};
      let total = 0;
      for (const f of FIELDS) {
        let v = typeof page[f] === 'string' ? page[f] : '';
        for (const [from, to] of it.replace) {
          const n = v.split(from).length - 1;
          if (n) { v = v.split(from).join(to); total += n; }
        }
        next[f] = v;
      }
      const unmatched = it.replace.filter(([from]) => !FIELDS.some(f => typeof page[f] === 'string' && page[f].includes(from))).map(r => r[0]);
      console.log(`${tag}: ${total} replacement(s) (${it.why})${unmatched.length ? `; no match for: ${unmatched.map(u => JSON.stringify(u.slice(0, 40))).join(', ')}` : ''}`);
      if (!total) continue;
      if (DRY_RUN) continue;
      await withRetry(async () => {
        const body = { content: next.content, title: next.title, meta_title: next.meta_title,
          meta_keywords: Array.isArray(page.meta_keywords) ? page.meta_keywords : [], meta_descript: next.meta_descript, handle: page.handle };
        if (page.og_image) body.og_image = page.og_image;
        const r = await fetch(`${HOST}/pages/${page.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', token }, body: JSON.stringify(body) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.code !== 0) throw new Error(`PUT /pages/${page.id} failed: ${JSON.stringify(j).slice(0, 200)}`);
      });
      // read back: none of the replaced source strings may remain
      const after = await withRetry(() => getPage(token, it.handle));
      const left = it.replace.filter(([from]) => FIELDS.some(f => typeof after[f] === 'string' && after[f].includes(from)) && !it.replace.some(([, to]) => to.includes(from)));
      console.log(left.length ? `${tag}: ⚠ still contains ${left.map(l => JSON.stringify(l[0].slice(0, 40))).join(', ')}` : `${tag}: ✅ written and verified`);
      if (left.length) failed++;
      await sleep(800);
    } catch (e) { console.error(`${tag}: ❌ ${e.message}`); failed++; }
  }
  if (DRY_RUN) console.log('DRY RUN — nothing written.');
  if (failed) process.exit(1);
})();
