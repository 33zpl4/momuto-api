/**
 * Deploy the FR "Maillot de Foot Personnalisé sur Mesure" hub to fr.momuto.com.
 *
 *   FR: https://fr.momuto.com/pages/maillot-foot-personnalise
 *
 * Upgrades the existing thin /pages/maillot-foot-personnalise URL into a full
 * commercial hub targeting the core FR term "maillot de foot personnalisé"
 * (which sat at ~position 45 with no page truly owning it). Upserts: creates
 * if the handle is missing, updates in place otherwise, and sets meta.
 *
 * Env:
 *   OEMSAAS_TOKEN_FR  - required (skipped if missing)
 *   DRY_RUN=true      - preview without writing to the CMS
 */

const fs = require('fs');
const path = require('path');
const { submitUrls } = require('../lib/indexnow');

const ROOT = path.resolve(__dirname, '..');

const DOMAIN = {
  host: 'https://openapi.oemapps.com',
  token: process.env.OEMSAAS_TOKEN_FR,
  label: 'fr.momuto.com',
  handle: 'maillot-foot-personnalise',
  file: path.join(ROOT, 'pages', 'maillot-foot-personnalise'),
  title: 'Maillot de Foot Personnalisé sur Mesure | MOMUTO',
  meta_title: 'Maillot de Foot Personnalisé sur Mesure | MOMUTO',
  meta_descript: 'Créez votre maillot de foot personnalisé : configurateur 3D gratuit ou design pro en 1-2 jours. Sans minimum, sublimation intégrale, livraison 25-30 jours.',
  meta_keywords: [
    'maillot de foot personnalisé',
    'maillot foot personnalisé',
    'maillot de foot sur mesure',
    'créer maillot de foot',
    'configurateur maillot 3d',
    'fournisseur maillot de foot',
    'MOMUTO'
  ]
};

const DRY_RUN = process.env.DRY_RUN === 'true';

function sanityCheck(content, file) {
  if (!content.includes('Bebas Neue') || !content.includes('Outfit')) {
    throw new Error(`Source ${file} does not contain Bebas Neue + Outfit — refusing to deploy legacy styling`);
  }
  const h1Matches = content.match(/<h1\b/g) || [];
  if (h1Matches.length !== 1) {
    throw new Error(`Source ${file} must have exactly 1 <h1> (found ${h1Matches.length})`);
  }
}

async function getExistingPage(domain) {
  const res = await fetch(`${domain.host}/pages?handle=${domain.handle}`, { headers: { token: domain.token } });
  const json = await res.json();
  if (!res.ok || json.code !== 0) return null;
  const pages = json.data?.list || json.data || [];
  return Array.isArray(pages) ? (pages.find(p => p.handle === domain.handle) || null) : null;
}

function buildPageData(domain, content) {
  return {
    is_default: 0,
    title: domain.title,
    content,
    meta_title: domain.meta_title,
    meta_keywords: domain.meta_keywords,
    meta_descript: domain.meta_descript,
    handle: domain.handle
  };
}

async function createPage(domain, content) {
  const res = await fetch(`${domain.host}/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token: domain.token },
    body: JSON.stringify(buildPageData(domain, content))
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) throw new Error(`POST /pages on ${domain.label} failed: ${JSON.stringify(json)}`);
  return json;
}

async function updatePage(domain, page, content) {
  const res = await fetch(`${domain.host}/pages/${page.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', token: domain.token },
    body: JSON.stringify(buildPageData(domain, content))
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) throw new Error(`PUT /pages/${page.id} on ${domain.label} failed: ${JSON.stringify(json)}`);
  return json;
}

async function main() {
  console.log(`Dry run: ${DRY_RUN}`);
  if (!DOMAIN.token) { console.warn(`⚠️  No OEMSAAS_TOKEN_FR — skipping ${DOMAIN.label}`); return; }
  if (!fs.existsSync(DOMAIN.file)) throw new Error(`Source file not found: ${DOMAIN.file}`);

  const content = fs.readFileSync(DOMAIN.file, 'utf8');
  sanityCheck(content, DOMAIN.file);

  const existing = await getExistingPage(DOMAIN);

  if (DRY_RUN) {
    console.log(`  DRY_RUN — would ${existing ? 'update' : 'create'} ${DOMAIN.handle} (${content.length} chars)`);
    return;
  }

  if (existing) {
    await updatePage(DOMAIN, existing, content);
    console.log(`✓ Updated ${DOMAIN.handle} on ${DOMAIN.label}`);
  } else {
    await createPage(DOMAIN, content);
    console.log(`✓ Created ${DOMAIN.handle} on ${DOMAIN.label}`);
  }
  console.log(`  Live at: https://fr.momuto.com/pages/${DOMAIN.handle}`);

  await submitUrls([`https://fr.momuto.com/pages/${DOMAIN.handle}`]);
}

main().catch(e => { console.error(`❌ ${e.message}`); process.exit(1); });
