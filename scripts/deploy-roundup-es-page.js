/**
 * Deploy the ES roundup page "Mejores webs para crear equipaciones de fútbol
 * personalizadas (2026)".
 *
 *   ES: https://es.momuto.com/pages/mejores-webs-equipaciones-futbol-personalizadas-2026
 *
 * Multi-competitor comparativa (MOMUTO vs Zentral vs Aimar Sport vs Owayo vs
 * Spized) mirroring the FR comparatif. Upserts: creates the page on first run,
 * updates it thereafter.
 *
 * Env:
 *   OEMSAAS_TOKEN_ES  - required (skipped if missing)
 *   DRY_RUN=true      - preview without writing to the CMS
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const DOMAIN = {
  host: 'https://openapi.oemapps.com',
  token: process.env.OEMSAAS_TOKEN_ES,
  label: 'es.momuto.com',
  handle: 'mejores-webs-equipaciones-futbol-personalizadas-2026',
  file: path.join(ROOT, 'pages', 'roundup-es'),
  title: 'Mejores Webs para Crear Equipaciones de Fútbol Personalizadas (2026) | MOMUTO',
  meta_title: 'Mejores Webs para Equipaciones de Fútbol Personalizadas 2026 | MOMUTO',
  meta_descript: 'Comparativa 2026 de las mejores webs para crear equipaciones de fútbol personalizadas: MOMUTO, Zentral, Aimar Sport, Owayo y Spized. Precios, plazos, pedido mínimo y diseño comparados.',
  meta_keywords: [
    'mejores webs equipaciones futbol personalizadas',
    'crear equipacion de futbol',
    'equipaciones de futbol personalizadas',
    'donde comprar equipaciones personalizadas',
    'comparativa equipaciones futbol',
    'zentral alternativa',
    'aimar sport',
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
  if (!DOMAIN.token) { console.warn(`⚠️  No OEMSAAS_TOKEN_ES — skipping ${DOMAIN.label}`); return; }
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
  console.log(`  Live at: https://es.momuto.com/pages/${DOMAIN.handle}`);
}

main().catch(e => { console.error(`❌ ${e.message}`); process.exit(1); });
