/**
 * Deploy the US "Custom Youth & Club Soccer Uniforms" page to momuto.com.
 *
 *   EN: https://www.momuto.com/pages/custom-youth-club-soccer-uniforms
 *
 * Tier-3 US page targeting youth/club "soccer uniforms" intent. Additive —
 * a new page on the existing English store. Upserts: creates if the handle
 * does not exist, updates in place otherwise.
 *
 * Env:
 *   OEMSAAS_TOKEN_EN  - required (page skipped if missing)
 *   DRY_RUN=true      - preview without writing to the CMS
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const DOMAIN = {
  host: 'https://openapi.oemapps.com',
  token: process.env.OEMSAAS_TOKEN_EN,
  label: 'momuto.com',
  handle: 'custom-youth-club-soccer-uniforms',
  file: path.join(ROOT, 'pages', 'custom-youth-club-soccer-uniforms'),
  title: 'Custom Youth & Club Soccer Uniforms — No Minimum',
  meta_title: 'Custom Youth & Club Soccer Uniforms — No Minimum',
  meta_descript: 'Outfit your youth or club soccer team in custom uniforms. No minimum order, youth-to-adult sizing, per-player names & numbers, full sublimation, free design.',
  meta_keywords: [
    'custom youth soccer uniforms',
    'youth soccer jerseys',
    'kids custom soccer jerseys',
    'custom club soccer jerseys',
    'soccer team jerseys',
    'custom soccer uniforms',
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
}

main().catch(e => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
