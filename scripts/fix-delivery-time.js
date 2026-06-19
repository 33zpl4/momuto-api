/**
 * Standardize delivery time to 25-30 days across surfaces that the normal
 * page-deploy pipeline can't reach with a clean repo edit:
 *   - gallery pages (deployed via head/tail merge that PRESERVES the live tail)
 *   - team "proof" pages (no dedicated deploy script)
 *
 * Operates on LIVE CMS content by handle: fetches each page, applies the
 * locale-specific string replacements to content + meta_descript, and PUTs it
 * back only if something changed. Idempotent and fully reversible.
 *
 * Env: OEMSAAS_TOKEN_EN / _ES / _FR / _IT   ·   DRY_RUN=true to preview.
 */

const HOST = 'https://openapi.oemapps.com';
const DRY_RUN = process.env.DRY_RUN === 'true';

const TOKENS = {
  en: process.env.OEMSAAS_TOKEN_EN,
  es: process.env.OEMSAAS_TOKEN_ES,
  fr: process.env.OEMSAAS_TOKEN_FR,
  it: process.env.OEMSAAS_TOKEN_IT
};

// Replacement sets per locale (wrong delivery figures → 25-30).
const R = {
  en: [['20-25 days', '25-30 days'], ['3 weeks', '25-30 days']],
  es: [['20-25 días', '25-30 días'], ['3 semanas', '25-30 días']],
  fr: [['20-25 jours', '25-30 jours'], ['3 semaines', '25-30 jours']],
  it: [['20-25 giorni', '25-30 giorni']]
};

// handle → locale. Galleries + proof pages + (insurance) request pages.
const TARGETS = [
  // galleries (live tail is preserved by deploy-kit-gallery-pages.js)
  { handle: 'custom-kit-gallery', locale: 'en' },
  { handle: 'galeria-equipaciones-personalizadas', locale: 'es' },
  { handle: 'galerie-maillots-foot-sur-mesure', locale: 'fr' },
  { handle: 'galleria-maglie-personalizzate', locale: 'it' },
  // team "proof" pages (no dedicated deploy script)
  { handle: 'teams-clubs-momuto', locale: 'en' },
  { handle: 'equipos-momuto', locale: 'es' },
  { handle: 'equipes-clubs-momuto', locale: 'fr' },
  { handle: 'squadre-club-momuto', locale: 'it' },
  // request pages (also fixed by their own workflow; harmless idempotent insurance)
  { handle: 'request-custom-kit-design', locale: 'en' },
  { handle: 'solicitud-de-diseno-personalizado', locale: 'es' },
  { handle: 'demande-de-design-professionnel-de-maillots', locale: 'fr' },
  { handle: 'richiesta-design-personalizzato', locale: 'it' }
];

function applyAll(str, pairs) {
  let out = str || '';
  for (const [from, to] of pairs) out = out.split(from).join(to);
  return out;
}

async function getPage(token, handle) {
  const res = await fetch(`${HOST}/pages?handle=${handle}`, { headers: { token } });
  const json = await res.json();
  if (!res.ok || json.code !== 0) throw new Error(`GET ${handle}: ${JSON.stringify(json)}`);
  const pages = json.data?.list || json.data || [];
  return Array.isArray(pages) ? (pages.find(p => p.handle === handle) || null) : null;
}

async function putPage(token, page, content, meta_descript) {
  const res = await fetch(`${HOST}/pages/${page.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', token },
    body: JSON.stringify({
      content,
      title: page.title,
      meta_title: page.meta_title,
      meta_keywords: page.meta_keywords,
      meta_descript,
      handle: page.handle
    })
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) throw new Error(`PUT ${page.handle}: ${JSON.stringify(json)}`);
}

async function main() {
  console.log(`Dry run: ${DRY_RUN}\n`);
  const errors = [];
  for (const t of TARGETS) {
    const token = TOKENS[t.locale];
    if (!token) { console.warn(`⚠️  ${t.handle}: no ${t.locale} token — skipping`); continue; }
    try {
      const page = await getPage(token, t.handle);
      if (!page) { console.warn(`⚠️  ${t.handle}: not found — skipping`); continue; }
      const pairs = R[t.locale];
      const newContent = applyAll(page.content, pairs);
      const newMeta = applyAll(page.meta_descript, pairs);
      if (newContent === (page.content || '') && newMeta === (page.meta_descript || '')) {
        console.log(`✓ ${t.handle}: already 25-30`);
        continue;
      }
      console.log(`${t.handle}: delivery strings normalized → 25-30`);
      if (DRY_RUN) continue;
      await putPage(token, page, newContent, newMeta);
      console.log(`   ✓ updated`);
    } catch (e) {
      console.error(`❌ ${t.handle}: ${e.message}`);
      errors.push(t.handle);
    }
  }
  if (errors.length) { console.error(`\n${errors.length} error(s): ${errors.join(', ')}`); process.exit(1); }
  console.log('\n✅ Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
