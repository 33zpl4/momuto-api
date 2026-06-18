/**
 * Deploy the US "Custom Soccer Jerseys & Uniforms" hub page to momuto.com.
 *
 *   EN: https://www.momuto.com/pages/custom-soccer-jerseys
 *
 * This is a US-vocabulary (en-US) landing page targeting "custom soccer
 * jerseys / uniforms / maker / designer" intent. It is additive — a new
 * page on the existing English store, not a rewrite of any ranking page.
 *
 * The script upserts: it creates the page if the handle does not exist yet,
 * and updates it in place on subsequent runs.
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
  handle: 'custom-soccer-jerseys',
  file: path.join(ROOT, 'pages', 'custom-soccer-jerseys'),
  title: 'Custom Soccer Jerseys & Uniforms — Design Your Team’s Kit',
  meta_title: 'Custom Soccer Jerseys & Uniforms — No Minimum',
  meta_descript: 'Design custom soccer jerseys online with our free 3D tool. No minimums, full sublimation, every size from youth to adult. Free pro design in 1–2 days.',
  meta_keywords: [
    'custom soccer jerseys',
    'custom soccer jersey maker',
    'soccer jersey maker',
    'design your own soccer jersey',
    'custom soccer uniforms',
    'youth soccer jerseys',
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
