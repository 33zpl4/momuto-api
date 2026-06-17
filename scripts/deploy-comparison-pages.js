/**
 * Deploy the comparison pages (EN / FR / IT) to their CMS pages.
 *
 *   EN: https://www.momuto.com/pages/momuto-vs-jersix-owayo-spized-comparison
 *   FR: https://fr.momuto.com/pages/comparatif-fournisseur-maillot-foot-2026
 *   IT: https://it.momuto.com/pages/confronto-fornitori-maglie-calcio-2026
 *
 * Env:
 *   OEMSAAS_TOKEN_EN / _FR / _IT  - required per locale (locale skipped if missing)
 *   LOCALES=en,fr,it              - restrict which locales to deploy (default: all)
 *   DRY_RUN=true                  - preview changes without writing to the CMS
 *
 * A locale's `meta` block (if present) overwrites the live title/meta on deploy.
 * Locales without a `meta` block preserve whatever is already live.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const DOMAINS = {
  en: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_EN,
    label: 'momuto.com',
    handle: 'momuto-vs-jersix-owayo-spized-comparison',
    file: path.join(ROOT, 'pages', 'comparison-en')
  },
  fr: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_FR,
    label: 'fr.momuto.com',
    handle: 'comparatif-fournisseur-maillot-foot-2026',
    file: path.join(ROOT, 'pages', 'comparison-fr')
  },
  it: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_IT,
    label: 'it.momuto.com',
    handle: 'confronto-fornitori-maglie-calcio-2026',
    previousHandle: 'momuto-vs-jersix-owayo-spized-comparison',
    file: path.join(ROOT, 'pages', 'comparison-it'),
    // IT page was previously deployed with English title/meta — force them to Italian.
    meta: {
      title: 'Confronto Fornitori Maglie Calcio 2026 — MOMUTO',
      meta_title: 'Migliori Fornitori Maglie Calcio Personalizzate 2026 | MOMUTO',
      meta_descript: 'Confronto indipendente 2026 tra MOMUTO, Jersix, Owayo e Spized: prezzi, consegna, tessuto e design a confronto. Scopri perché le squadre scelgono MOMUTO.',
      meta_keywords: [
        'confronto fornitori maglie calcio',
        'migliori fornitori maglie calcio personalizzate',
        'maglie calcio personalizzate 2026',
        'kit calcio personalizzati',
        'fornitore maglie calcio',
        'MOMUTO vs Owayo'
      ]
    }
  }
};

const DRY_RUN = process.env.DRY_RUN === 'true';
const LOCALES = (process.env.LOCALES || 'en,fr,it')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function sanityCheck(content, file) {
  if (!content.includes('Bebas Neue') || !content.includes('Outfit')) {
    throw new Error(`Source ${file} does not contain Bebas Neue + Outfit — refusing to deploy legacy styling`);
  }
  const h1Matches = content.match(/<h1\b/g) || [];
  if (h1Matches.length !== 1) {
    throw new Error(`Source ${file} must have exactly 1 <h1> (found ${h1Matches.length})`);
  }
}

async function findByHandle(domain, handle) {
  const res = await fetch(`${domain.host}/pages?handle=${handle}`, { headers: { token: domain.token } });
  const json = await res.json();
  if (!res.ok || json.code !== 0) {
    throw new Error(`GET /pages?handle=${handle} on ${domain.label} failed: ${JSON.stringify(json)}`);
  }
  const pages = json.data?.list || json.data || [];
  return Array.isArray(pages) ? (pages.find(p => p.handle === handle) || null) : null;
}

async function getPageByHandle(domain) {
  // Look up by the target handle first; fall back to previousHandle so this
  // script can rename a page (e.g. English slug -> localized slug) in place and
  // stay idempotent on re-run.
  let page = await findByHandle(domain, domain.handle);
  if (!page && domain.previousHandle) {
    page = await findByHandle(domain, domain.previousHandle);
    if (page) console.log(`  ↻ ${domain.label}: found at previous handle "${domain.previousHandle}" — will rename to "${domain.handle}"`);
  }
  if (!page) {
    const tried = [domain.handle, domain.previousHandle].filter(Boolean).join(' or ');
    throw new Error(`Page ${tried} not found on ${domain.label}`);
  }
  return page;
}

async function updatePage(domain, page, content) {
  const m = domain.meta || {};
  const res = await fetch(`${domain.host}/pages/${page.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', token: domain.token },
    body: JSON.stringify({
      content,
      // Locale `meta` (if defined) overrides live values; otherwise preserve them.
      title: m.title ?? page.title,
      meta_title: m.meta_title ?? page.meta_title,
      meta_keywords: m.meta_keywords ?? page.meta_keywords,
      meta_descript: m.meta_descript ?? page.meta_descript,
      handle: domain.handle
    })
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) {
    throw new Error(`PUT /pages/${page.id} on ${domain.label} failed: ${JSON.stringify(json)}`);
  }
  return json;
}

async function deployLocale(locale) {
  const domain = DOMAINS[locale];
  if (!domain) throw new Error(`Unknown locale: ${locale}`);

  if (!domain.token) {
    console.warn(`⚠️  No token for ${domain.label} — skipping`);
    return { locale, skipped: true };
  }

  if (!fs.existsSync(domain.file)) {
    throw new Error(`Source file not found: ${domain.file}`);
  }

  const repoContent = fs.readFileSync(domain.file, 'utf8');
  sanityCheck(repoContent, domain.file);

  const page = await getPageByHandle(domain);
  const liveContent = page.content || '';

  // A push is also needed when the handle must change (rename) or when a meta
  // override differs from what's live — not only when the body content changes.
  const m = domain.meta || {};
  const needsRename = page.handle !== domain.handle;
  const needsMeta = !!m.meta_title && (
    m.title !== page.title ||
    m.meta_title !== page.meta_title ||
    m.meta_descript !== page.meta_descript
  );

  if (repoContent === liveContent && !needsRename && !needsMeta) {
    console.log(`✓ ${domain.label}: already up to date (${liveContent.length} chars)`);
    return { locale, unchanged: true };
  }

  const reasons = [
    repoContent !== liveContent ? `content ${liveContent.length}→${repoContent.length}` : null,
    needsRename ? `rename ${page.handle}→${domain.handle}` : null,
    needsMeta ? 'meta' : null,
  ].filter(Boolean).join(', ');
  console.log(`${domain.label}: ${reasons}`);

  if (DRY_RUN) {
    console.log(`  DRY_RUN — skipping PUT`);
    return { locale, dryRun: true };
  }

  await updatePage(domain, page, repoContent);
  console.log(`✓ Deployed ${domain.handle} to ${domain.label}`);
  return { locale, deployed: true };
}

async function main() {
  console.log(`Dry run: ${DRY_RUN}`);
  console.log(`Locales: ${LOCALES.join(', ')}`);

  const errors = [];
  for (const locale of LOCALES) {
    if (!DOMAINS[locale]) {
      errors.push(`${locale}: unknown locale`);
      console.error(`❌ Unknown locale: ${locale}`);
      continue;
    }
    try {
      await deployLocale(locale);
    } catch (e) {
      errors.push(`${locale}: ${e.message}`);
      console.error(`❌ ${locale}: ${e.message}`);
    }
  }

  if (errors.length) {
    console.error(`\n${errors.length} error(s):`);
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log('\n✓ Done');
}

main();
