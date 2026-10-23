'use strict';
/**
 * Kit gallery pages (5 stores): set the "Countries" stat number ("15+").
 * The gallery pages are pipeline-owned (team cards are injected live), so this reads the LIVE page,
 * changes ONLY the number, and writes the same object back — never a repo copy (a stale copy erased
 * 29 US cards on 1 Oct 2026). Dry run by default.
 *
 *   DRY_RUN=true|false  VALUE=15+  OEMSAAS_TOKEN_EN/ES/FR/IT/US
 */
const HOST = 'https://openapi.oemapps.com';
const DRY_RUN = process.env.DRY_RUN !== 'false';
const VALUE = String(process.env.VALUE || '15+');
const STORES = [
  { loc: 'en', handle: 'custom-kit-gallery',                 token: process.env.OEMSAAS_TOKEN_EN },
  { loc: 'es', handle: 'galeria-equipaciones-personalizadas', token: process.env.OEMSAAS_TOKEN_ES },
  { loc: 'fr', handle: 'galerie-maillots-foot-sur-mesure',    token: process.env.OEMSAAS_TOKEN_FR },
  { loc: 'it', handle: 'galleria-maglie-personalizzate',      token: process.env.OEMSAAS_TOKEN_IT },
  { loc: 'us', handle: 'custom-kit-gallery',                 token: process.env.OEMSAAS_TOKEN_US },
];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function withRetry(fn) {
  for (let i = 0; i < 5; i++) {
    try { return await fn(); } catch (e) {
      if (/Too many requests|"code":1000/.test(e.message) && i < 4) { await sleep(2000 * (i + 1)); continue; }
      throw e;
    }
  }
}
// A failed/throttled GET must THROW — never read as "not found".
async function getPage(token, handle) {
  const res = await fetch(`${HOST}/pages?handle=${encodeURIComponent(handle)}`, { headers: { token } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.code !== 0) throw new Error(`GET /pages?handle=${handle} failed: ${JSON.stringify(json).slice(0, 200)}`);
  const list = json.data?.list || json.data || [];
  return Array.isArray(list) ? (list.find(p => p.handle === handle) || null) : null;
}

// The stat tile whose label is the country word in each locale (labels may be HTML-entity encoded in the live page).
const RE = /(<span class=\\?"stat-number\\?">)([^<]*)(<\/span>\s*<span class=\\?"stat-label\\?">(?:Countries|Pa(?:&iacute;|í)ses|Pays|Paesi)<\/span>)/;

(async () => {
  let failed = 0;
  for (const s of STORES) {
    try {
      if (!s.token) { console.log(`${s.loc}: no token — skipped`); continue; }
      const page = await withRetry(() => getPage(s.token, s.handle));
      if (!page) throw new Error('page not found');
      const m = RE.exec(page.content || '');
      if (!m) { console.log(`${s.loc}: no Countries stat tile found — left alone`); continue; }
      if (m[2] === VALUE) { console.log(`${s.loc}: already ${VALUE}`); continue; }
      const content = page.content.replace(RE, (_, a, _v, c) => a + VALUE + c);
      const delta = content.length - page.content.length;
      if (Math.abs(delta) > 2) throw new Error(`unexpected length change ${delta}`);
      console.log(`${s.loc}: Countries ${m[2]} -> ${VALUE} (page ${page.id}, ${page.content.length} chars, designs untouched)`);
      if (DRY_RUN) continue;
      await withRetry(async () => {
        const body = { content, title: page.title, meta_title: page.meta_title,
          meta_keywords: Array.isArray(page.meta_keywords) ? page.meta_keywords : [],
          meta_descript: page.meta_descript, handle: page.handle };
        if (page.og_image) body.og_image = page.og_image;
        const r = await fetch(`${HOST}/pages/${page.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', token: s.token }, body: JSON.stringify(body) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.code !== 0) throw new Error(`PUT /pages/${page.id} failed: ${JSON.stringify(j).slice(0, 200)}`);
      });
      console.log(`${s.loc}: ✅ written`);
      await sleep(800);
    } catch (e) { console.error(`${s.loc}: ❌ ${e.message}`); failed++; }
  }
  if (DRY_RUN) console.log('DRY RUN — nothing written.');
  if (failed) process.exit(1);
})();
