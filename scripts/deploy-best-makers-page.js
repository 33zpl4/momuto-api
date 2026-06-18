/**
 * Deploy the US "Best Custom Soccer Jersey Makers (2026 Compared)" page.
 *
 *   EN: https://www.momuto.com/pages/best-custom-soccer-jersey-makers-2026
 *
 * Independent US comparison (MOMUTO vs Icarus FC vs spized vs owayo) in
 * soccer vocabulary. Additive — a new page on the existing English store.
 * Upserts: creates if the handle does not exist, updates in place otherwise.
 *
 * Env:
 *   OEMSAAS_TOKEN_EN  - required (page skipped if missing)
 *   DRY_RUN=true      - preview without writing to the CMS
 */

const fs = require('fs');
const path = require('path');
const { submitUrls } = require('../lib/indexnow');

const ROOT = path.resolve(__dirname, '..');

const DOMAIN = {
  host: 'https://openapi.oemapps.com',
  token: process.env.OEMSAAS_TOKEN_EN,
  label: 'momuto.com',
  handle: 'best-custom-soccer-jersey-makers-2026',
  file: path.join(ROOT, 'pages', 'best-custom-soccer-jersey-makers-2026'),
  title: 'Best Custom Soccer Jersey Makers (2026 Compared)',
  meta_title: 'Best Custom Soccer Jersey Makers (2026 Compared)',
  meta_descript: 'Compare the best custom soccer jersey makers in 2026 — MOMUTO, Icarus FC, spized, owayo — on minimum order, turnaround, customization, and price.',
  meta_keywords: [
    'best custom soccer jersey makers',
    'custom soccer jerseys',
    'custom soccer jersey maker',
    'soccer jersey maker comparison',
    'icarus fc alternative',
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
  const res = await fetch(`${domain.host}/pages?handle=${domain.handle}`, {
    headers: { token: domain.token }
  });
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
  if (!res.ok || json.code !== 0) {
    throw new Error(`POST /pages on ${domain.label} failed: ${JSON.stringify(json)}`);
  }
  return json;
}

async function updatePage(domain, page, content) {
  const res = await fetch(`${domain.host}/pages/${page.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', token: domain.token },
    body: JSON.stringify(buildPageData(domain, content))
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) {
    throw new Error(`PUT /pages/${page.id} on ${domain.label} failed: ${JSON.stringify(json)}`);
  }
  return json;
}

async function main() {
  console.log(`Dry run: ${DRY_RUN}`);

  if (!DOMAIN.token) {
    console.warn(`⚠️  No OEMSAAS_TOKEN_EN — skipping ${DOMAIN.label}`);
    return;
  }
  if (!fs.existsSync(DOMAIN.file)) {
    throw new Error(`Source file not found: ${DOMAIN.file}`);
  }

  const content = fs.readFileSync(DOMAIN.file, 'utf8');
  sanityCheck(content, DOMAIN.file);

  const existing = await getExistingPage(DOMAIN);

  if (existing && (existing.content || '') === content) {
    console.log(`✓ ${DOMAIN.label}: already up to date (${content.length} chars)`);
    return;
  }

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
    console.log(`  Live at: https://www.momuto.com/pages/${DOMAIN.handle}`);
  }

  await submitUrls([`https://www.momuto.com/pages/${DOMAIN.handle}`]);
}

main().catch(e => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
