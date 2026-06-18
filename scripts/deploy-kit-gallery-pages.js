/**
 * Deploy the three kit-gallery pages (EN/ES/FR) to their CMS pages.
 *
 *   EN: https://www.momuto.com/pages/custom-kit-gallery
 *   ES: https://es.momuto.com/pages/galeria-equipaciones-personalizadas
 *   FR: https://fr.momuto.com/pages/galerie-maillots-foot-sur-mesure
 *
 * Surgical deploy strategy:
 *   1. Fetch the live CMS content for each gallery page.
 *   2. Split both repo and CMS content at `<section class="gallery-container">`.
 *      The head covers the font <link>, <style> block, and the hero section
 *      (including the stats strip). The tail covers the gallery grid, CTA,
 *      the `const designs = [...]` script, and the JSON-LD schemas.
 *   3. Replace head with the repo version, keep tail from the live CMS.
 *   4. Clean up two legacy inline CTA styles that reference the old
 *      `--text-muted` variable (removed from the new styles).
 *   5. PUT the merged content back to the CMS.
 *
 * The `const designs = [ ... ]` array that appears inside the gallery
 * JS block is NEVER touched. This matters because `update-gallery`
 * (scripts/generate-and-deploy.js with GALLERY_ONLY=true) writes new
 * team entries directly to the CMS without committing them back to the
 * repo, so the repo array is often stale relative to what's live.
 *
 * Env:
 *   OEMSAAS_TOKEN_EN / _ES / _FR  - required per locale (locale skipped if missing)
 *   LOCALES=en,fr                 - restrict which locales to deploy (default: all three)
 *   DRY_RUN=true                  - preview changes without writing to the CMS
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const DOMAINS = {
  en: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_EN,
    label: 'momuto.com',
    handle: 'custom-kit-gallery',
    file: path.join(ROOT, 'pages', 'custom-kit-gallery.html')
  },
  es: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_ES,
    label: 'es.momuto.com',
    handle: 'galeria-equipaciones-personalizadas',
    file: path.join(ROOT, 'pages', 'galeria-equipaciones-personalizadas')
  },
  fr: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_FR,
    label: 'fr.momuto.com',
    handle: 'galerie-maillots-foot-sur-mesure',
    file: path.join(ROOT, 'pages', 'galerie-maillots-foot-sur-mesure'),
    // Commercial-intent meta to lift this page beyond brand sitelinks
    // (was 1 click / 722 impressions, ranking only under the "momuto" brand SERP).
    title: 'Galerie de Maillots de Foot Personnalisés sur Mesure',
    meta_title: 'Galerie de Maillots de Foot Personnalisés sur Mesure',
    meta_descript: 'Découvrez nos maillots de foot personnalisés sur mesure créés pour des clubs du monde entier. Sans minimum de commande, sublimation intégrale, design gratuit.',
    meta_keywords: ['maillot de foot personnalisé', 'maillot foot sur mesure', 'galerie maillots personnalisés', 'maillot club personnalisé', 'MOMUTO']
  },
  it: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_IT,
    label: 'it.momuto.com',
    handle: 'galleria-maglie-personalizzate',
    file: path.join(ROOT, 'pages', 'galleria-maglie-personalizzate')
  }
};

const DRY_RUN = process.env.DRY_RUN === 'true';
const LOCALES = (process.env.LOCALES || 'en,es,fr,it')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const SPLIT_MARKER = '<section class="gallery-container">';

function splitHead(content) {
  const idx = content.indexOf(SPLIT_MARKER);
  if (idx < 0) return null;
  return {
    head: content.slice(0, idx),
    tail: content.slice(idx)
  };
}

function cleanLegacyCtaInlineStyles(content) {
  // These inline styles reference --text-muted, which was removed when the
  // gallery pages were restyled to the new Bebas Neue + Outfit system.
  // The new .cta-section h2 / .cta-section p rules fully cover them.
  return content
    .replace(
      /<h2\s+style="font-size:\s*2\.5rem;\s*margin-bottom:\s*1rem;">/g,
      '<h2>'
    )
    .replace(
      /<p\s+style="color:\s*var\(--text-muted\);\s*margin-bottom:\s*2rem;">/g,
      '<p>'
    );
}

async function getPageByHandle(domain) {
  const url = `${domain.host}/pages?handle=${domain.handle}`;
  const res = await fetch(url, { headers: { token: domain.token } });
  const json = await res.json();
  if (!res.ok || json.code !== 0) {
    throw new Error(`GET /pages?handle=${domain.handle} on ${domain.label} failed: ${JSON.stringify(json)}`);
  }
  const pages = json.data?.list || json.data || [];
  const page = Array.isArray(pages) ? pages.find(p => p.handle === domain.handle) : null;
  if (!page) throw new Error(`Page ${domain.handle} not found on ${domain.label}`);
  return page;
}

async function updatePage(domain, page, content) {
  const res = await fetch(`${domain.host}/pages/${page.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', token: domain.token },
    body: JSON.stringify({
      content,
      title: domain.title || page.title,
      meta_title: domain.meta_title || page.meta_title,
      meta_keywords: domain.meta_keywords || page.meta_keywords,
      meta_descript: domain.meta_descript || page.meta_descript,
      handle: page.handle
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
  const repoSplit = splitHead(repoContent);
  if (!repoSplit) throw new Error(`Split marker '${SPLIT_MARKER}' not found in source ${domain.file}`);

  // Sanity: make sure we're about to deploy the NEW styling, not the old one.
  if (!repoSplit.head.includes('Bebas Neue') || !repoSplit.head.includes('Outfit')) {
    throw new Error(`Source ${domain.file} does not contain Bebas Neue + Outfit — refusing to deploy`);
  }

  const page = await getPageByHandle(domain);
  const liveContent = page.content || '';
  const liveSplit = splitHead(liveContent);
  if (!liveSplit) throw new Error(`Split marker '${SPLIT_MARKER}' not found in live CMS content for ${domain.label}`);

  // Sanity: the preserved tail MUST still contain the designs array.
  // If the CMS page doesn't look like a gallery, abort rather than overwrite.
  if (!/const\s+designs\s*=\s*\[/.test(liveSplit.tail)) {
    throw new Error(`Live CMS tail on ${domain.label} is missing 'const designs = [' — aborting to avoid data loss`);
  }

  const mergedContent = cleanLegacyCtaInlineStyles(repoSplit.head + liveSplit.tail);

  // A meta override differing from what's live also warrants a PUT, even if
  // the page body itself is unchanged.
  const metaInSync =
    (!domain.title || domain.title === page.title) &&
    (!domain.meta_title || domain.meta_title === page.meta_title) &&
    (!domain.meta_descript || domain.meta_descript === page.meta_descript);

  if (mergedContent === liveContent && metaInSync) {
    console.log(`✓ ${domain.label}: already up to date (${liveContent.length} chars)`);
    return { locale, unchanged: true };
  }

  console.log(`${domain.label}: ${liveContent.length} → ${mergedContent.length} chars`);
  console.log(`  head replaced (${liveSplit.head.length} → ${repoSplit.head.length} chars), tail preserved (${liveSplit.tail.length} chars)`);

  if (DRY_RUN) {
    console.log(`  DRY_RUN — skipping PUT`);
    return { locale, dryRun: true };
  }

  await updatePage(domain, page, mergedContent);
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
