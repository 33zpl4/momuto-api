'use strict';
/**
 * noindex-pages.js — keep conversion-only pages (thank-you, design-confirmed, paid gate) out of Google's index, on the LIVE pages.
 * Why: on 2 Nov 2026 Google folded www/pages/design-your-own-soccer-jersey (~40 clicks/day, our best non-brand page) into
 * www/pages/ready-to-play-thank-you, which has no robots meta; clicks went to ~0 (docs/us-indexing-2026-11.md).
 * Reads each live page, shows its keys (to see how the already-noindex pages carry the flag), and — only when not DRY_RUN —
 * prepends a robots meta (+ a tiny head-mover, since the CMS puts page content in <body>) and PUTs the whole object back, then reads it back.
 *   DRY_RUN=true|false (default true)   TARGETS="en:ready-to-play-thank-you,us:..."  (default list below)
 *   OEMSAAS_TOKEN_EN/ES/FR/IT/US
 */
const HOST = 'https://openapi.oemapps.com';
const DRY_RUN = process.env.DRY_RUN !== 'false';
const TOKENS = { en: process.env.OEMSAAS_TOKEN_EN, es: process.env.OEMSAAS_TOKEN_ES, fr: process.env.OEMSAAS_TOKEN_FR, it: process.env.OEMSAAS_TOKEN_IT, us: process.env.OEMSAAS_TOKEN_US };
const DEFAULT = ['en:ready-to-play-thank-you', 'us:ready-to-play-thank-you', 'en:custom-kit-design-studio-paid-true', 'us:custom-kit-design-studio-paid-true', 'it:design-personalizzato-confermato',
  // reference: these already answer noindex live; read-only comparison of their object shape
  'en:customized-design-confirmed', 'fr:design-personnalise-confirme'];
const REFERENCE = new Set(['en:customized-design-confirmed', 'fr:design-personnalise-confirme']);
const TARGETS = (process.env.TARGETS || DEFAULT.join(',')).split(',').map(s => s.trim()).filter(Boolean);
const MARK = '<!-- momuto-noindex -->';
const SNIPPET = `${MARK}<meta name="robots" content="noindex, nofollow"><script>(function(){var m=document.querySelector('meta[name="robots"][content*="noindex"]');if(m&&document.head&&m.parentNode!==document.head){document.head.appendChild(m);}})();</script>\n`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function withRetry(fn) { for (let i = 0; i < 5; i++) { try { return await fn(); } catch (e) { if (/Too many requests|"code":1000/.test(e.message) && i < 4) { await sleep(2000 * (i + 1)); continue; } throw e; } } }
async function getPage(token, handle) {
  const res = await fetch(`${HOST}/pages?handle=${encodeURIComponent(handle)}`, { headers: { token } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.code !== 0) throw new Error(`GET /pages?handle=${handle} failed: ${JSON.stringify(json).slice(0, 200)}`);
  const list = json.data?.list || json.data || [];
  return Array.isArray(list) ? (list.find(p => p.handle === handle) || null) : null;
}
(async () => {
  let failed = 0;
  for (const t of TARGETS) {
    const [loc, handle] = t.split(':');
    try {
      const token = TOKENS[loc]; if (!token) { console.log(`${t}: no token — skipped`); continue; }
      const page = await withRetry(() => getPage(token, handle));
      if (!page) { console.log(`${t}: not found on the store`); continue; }
      const c = String(page.content || '');
      const has = /<meta[^>]+name=["']robots["'][^>]*noindex/i.test(c);
      const flags = Object.entries(page).filter(([k]) => /index|robot|seo|hide|status|visible|show/i.test(k)).map(([k, v]) => `${k}=${JSON.stringify(v).slice(0, 40)}`);
      console.log(`${t}: id ${page.id}, ${c.length} chars, keys=[${Object.keys(page).join(',')}]${flags.length ? '\n   flag-like fields: ' + flags.join(' ') : ''}\n   robots meta in content: ${has ? 'yes' : 'no'}${REFERENCE.has(t) ? ' (reference page: never written)' : ''}`);
      if (REFERENCE.has(t) || has) continue;
      if (DRY_RUN) { console.log('   would prepend the noindex meta + head-mover'); continue; }
      await withRetry(async () => {
        const body = { content: SNIPPET + c, title: page.title, meta_title: page.meta_title, meta_descript: page.meta_descript, meta_keywords: Array.isArray(page.meta_keywords) ? page.meta_keywords : (() => { try { return JSON.parse(page.meta_keywords || '[]'); } catch (_) { return []; } })(), handle: page.handle };
        if (page.og_image) body.og_image = page.og_image;
        const r = await fetch(`${HOST}/pages/${page.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', token }, body: JSON.stringify(body) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.code !== 0) throw new Error(`PUT /pages/${page.id} failed: ${JSON.stringify(j).slice(0, 200)}`);
      });
      await sleep(800);
      const back = await withRetry(() => getPage(token, handle));
      const ok = back && back.content.startsWith(MARK) && back.content.length === SNIPPET.length + c.length && back.title === page.title;
      console.log(`   ${ok ? 'VERIFIED' : 'MISMATCH'}: content now ${back ? back.content.length : '?'} chars (was ${c.length})`);
      if (!ok) failed++;
    } catch (e) { console.error(`${t}: ❌ ${e.message}`); failed++; }
  }
  if (DRY_RUN) console.log('DRY RUN — nothing written.');
  if (failed) process.exit(1);
})();
