'use strict';
/**
 * Kit gallery pages (5 stores): set the SEO title / meta_title / meta_descript (and keywords) of the LIVE page.
 * The gallery pages are pipeline-owned (team cards are injected live), so this reads the live page, changes ONLY the
 * meta fields, and PUTs the same object back with its content untouched — never a repo copy (a stale copy erased
 * 29 US cards on 1 Oct 2026). Dry run by default: prints OLD → NEW per store and writes nothing.
 *
 *   DRY_RUN=true|false  [STORES=en,es,fr,it,us]  OEMSAAS_TOKEN_EN/ES/FR/IT/US   node scripts/patch-gallery-meta.js
 *
 * Owner, 6 Nov 2026: the titles still said "100+ designs" while the galleries hold hundreds; estate-wide claims are
 * 250+ teams, 15+ countries, 500+ designs (docs/us-launch-status.md). Titles also carry the "jersey design" head term
 * the gallery is the natural page for (GSC, Nov 2026: "football jersey design" 3.8k impressions/28 d at 0.5 % CTR).
 */
const HOST = 'https://openapi.oemapps.com';
const DRY_RUN = process.env.DRY_RUN !== 'false';
const ONLY = (process.env.STORES || 'en,es,fr,it,us').split(',').map(s => s.trim());
const META = {
  en: { handle: 'custom-kit-gallery', token: process.env.OEMSAAS_TOKEN_EN,
        title: 'Football Kit Design Gallery | 500+ Real Team Kits | MOMUTO',
        meta_descript: 'Hundreds of 100% custom football kits for real teams in 15+ countries: AI concepts and sketches made into real jerseys by our designers. No minimum order.',
        keywords: ['football kit design', 'custom football kit gallery', 'football jersey design ideas', 'custom team kits', 'MOMUTO'] },
  us: { handle: 'custom-kit-gallery', token: process.env.OEMSAAS_TOKEN_US,
        title: 'Soccer Jersey Design Gallery | 500+ Real Team Kits | MOMUTO',
        meta_descript: 'Hundreds of 100% custom soccer jerseys for real teams in 15+ countries: AI concepts and sketches made into real uniforms by our designers. No minimum order.',
        keywords: ['soccer jersey design', 'custom soccer jersey gallery', 'soccer jersey design ideas', 'custom team uniforms', 'MOMUTO'] },
  es: { handle: 'galeria-equipaciones-personalizadas', token: process.env.OEMSAAS_TOKEN_ES,
        title: 'Galería: 500+ equipaciones de fútbol personalizadas | MOMUTO',
        meta_descript: 'Cientos de equipaciones 100 % personalizadas para equipos reales de 15+ países: conceptos de IA y bocetos hechos camiseta real por diseñadores. Sin mínimo.',
        keywords: ['diseño camisetas de fútbol', 'galería equipaciones personalizadas', 'ideas camisetas de fútbol', 'equipaciones para equipos', 'MOMUTO'] },
  fr: { handle: 'galerie-maillots-foot-sur-mesure', token: process.env.OEMSAAS_TOKEN_FR,
        title: 'Galerie : 500+ maillots de foot personnalisés sur mesure | MOMUTO',
        meta_descript: "Des centaines de tenues 100 % personnalisées pour de vraies équipes dans 15+ pays : concepts IA et croquis devenus de vrais maillots. Sans minimum.",
        keywords: ['design maillot de foot', 'galerie maillots personnalisés', 'idées maillot de foot', 'maillots pour équipes', 'MOMUTO'] },
  it: { handle: 'galleria-maglie-personalizzate', token: process.env.OEMSAAS_TOKEN_IT,
        title: 'Galleria: 500+ divise da calcio personalizzate | MOMUTO',
        meta_descript: 'Centinaia di divise 100 % personalizzate per squadre reali in 15+ paesi: concept IA e schizzi diventati maglie reali. Nessun ordine minimo.',
        keywords: ['design maglie da calcio', 'galleria maglie personalizzate', 'idee maglie da calcio', 'divise per squadre', 'MOMUTO'] },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function withRetry(fn) {
  for (let i = 0; i < 5; i++) {
    try { return await fn(); } catch (e) { if (/Too many requests|"code":1000/.test(e.message) && i < 4) { await sleep(2000 * (i + 1)); continue; } throw e; }
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
  let failed = 0;
  for (const loc of ONLY) {
    const s = META[loc]; if (!s) { console.log(`${loc}: unknown store`); continue; }
    try {
      if (s.title.length > 65 || s.meta_descript.length > 160) throw new Error(`new title ${s.title.length}/65 or description ${s.meta_descript.length}/160 too long`);
      if (!s.token) { console.log(`${loc}: no token — skipped`); continue; }
      const page = await withRetry(() => getPage(s.token, s.handle));
      if (!page) throw new Error('page not found');
      const cards = (page.content.match(/class="gallery-card|data-team=|"name":\s*"/g) || []).length;
      console.log(`${loc}: page ${page.id}, ${page.content.length} chars, ~${cards} card markers (content untouched)`);
      console.log(`   title:       ${page.title}\n             → ${s.title}`);
      console.log(`   meta_title:  ${page.meta_title}\n             → ${s.title}`);
      console.log(`   description: ${page.meta_descript}\n             → ${s.meta_descript}`);
      console.log(`   keywords:    ${JSON.stringify(page.meta_keywords)} → ${JSON.stringify(s.keywords)}`);
      if (page.title === s.title && page.meta_title === s.title && page.meta_descript === s.meta_descript) { console.log(`${loc}: already set`); continue; }
      if (DRY_RUN) continue;
      await withRetry(async () => {
        const body = { content: page.content, title: s.title, meta_title: s.title, meta_keywords: s.keywords, meta_descript: s.meta_descript, handle: page.handle };
        if (page.og_image) body.og_image = page.og_image;
        const r = await fetch(`${HOST}/pages/${page.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', token: s.token }, body: JSON.stringify(body) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.code !== 0) throw new Error(`PUT /pages/${page.id} failed: ${JSON.stringify(j).slice(0, 200)}`);
      });
      await sleep(800);
      const back = await withRetry(() => getPage(s.token, s.handle));
      const ok = back && back.title === s.title && back.meta_descript === s.meta_descript && back.content.length === page.content.length;
      console.log(`${loc}: ${ok ? 'VERIFIED' : 'MISMATCH'} title/description written, content ${back ? back.content.length : '?'} chars`);
      if (!ok) failed++;
    } catch (e) { console.error(`${loc}: ❌ ${e.message}`); failed++; }
  }
  if (DRY_RUN) console.log('DRY RUN — nothing written.');
  if (failed) process.exit(1);
})();
