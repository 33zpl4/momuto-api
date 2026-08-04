'use strict';

/**
 * Deploy the "Ready to Play" hub page — the wall of finished designs and the
 * landing for the 3D kit designer (docs/product-architecture.md). EN first;
 * other locales join this map when translated. The handle keeps its original
 * "the-studio" slug — the URL stays intact by owner decision (4 Aug); only the
 * brand layer changed.
 *
 * Page body lives in pages/<file> as a CMS-ready HTML fragment (inline
 * <style>, JSON-LD blocks, no <html>/<head> wrapper). Upserts by handle:
 * create if missing, update in place if it exists.
 *
 * Env:
 *   OEMSAAS_TOKEN_EN (etc. as locales are added)
 *   DRY_RUN=true|false   default true
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HOST = 'https://openapi.oemapps.com';
const DRY_RUN = process.env.DRY_RUN !== 'false';

const PAGES = [
  {
    locale: 'en',
    token: () => process.env.OEMSAAS_TOKEN_EN,
    domain: 'www.momuto.com',
    handle: 'the-studio-3d-kit-designer',
    file: path.join(ROOT, 'pages', 'the-studio-3d-kit-designer'),
    title: 'Ready to Play — Free 3D Football Kit Designer | MOMUTO',
    meta_title: 'Free 3D Football Kit Designer — Ready to Play | MOMUTO',
    meta_descript: 'Design a real football kit in 3D, free. Every Ready to Play design loads finished — recolour it, add your crest, name and number, and order from one jersey.',
    keywords: [
      '3d football kit designer',
      'football kit designer free',
      '3d jersey designer',
      'jersey maker 3d',
      'design football jersey online free',
      'football kit creator',
      'custom football kit designer',
    ],
  },
];

function sanityCheck(p, content) {
  if (!content.includes('Bebas Neue') || !content.includes('Outfit')) {
    throw new Error(`${p.handle}: missing Bebas Neue + Outfit fonts`);
  }
  const h1Count = (content.match(/<h1\b/g) || []).length;
  if (h1Count !== 1) throw new Error(`${p.handle}: must have exactly 1 <h1> (found ${h1Count})`);
  for (const blk of content.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || []) {
    JSON.parse(blk.replace(/<\/?script[^>]*>/g, ''));
  }
  if (!Array.isArray(p.keywords)) throw new Error(`${p.handle}: keywords must be an array (CMS rejects strings)`);
  if (p.meta_title.length > 65) throw new Error(`${p.handle}: meta_title ${p.meta_title.length}/65`);
  if (p.meta_descript.length > 160) throw new Error(`${p.handle}: meta_descript ${p.meta_descript.length}/160`);
  // the tool link must exist and carry the locale
  if (!content.includes('design.momuto.com/3d-configurator/configurator.html')) {
    throw new Error(`${p.handle}: missing the Studio deep link`);
  }
}

async function getExisting(handle, token) {
  const res = await fetch(`${HOST}/pages?handle=${handle}`, { headers: { token } });
  const json = await res.json();
  if (!res.ok || json.code !== 0) return null;
  const pages = json.data?.list || json.data || [];
  return Array.isArray(pages) ? (pages.find(pg => pg.handle === handle) || null) : null;
}

async function upsert(p) {
  const token = p.token();
  if (!token) { console.log(`  [${p.handle}] no ${p.locale.toUpperCase()} token — skipped`); return; }

  const content = fs.readFileSync(p.file, 'utf8');
  sanityCheck(p, content);

  const payload = {
    is_default: 0, title: p.title, content,
    meta_title: p.meta_title, meta_keywords: p.keywords,
    meta_descript: p.meta_descript, handle: p.handle,
  };

  const existing = await getExisting(p.handle, token);
  if (DRY_RUN) {
    console.log(`  DRY_RUN — would ${existing ? 'update' : 'create'} ${p.handle} on ${p.domain} (${content.length} chars)`);
    return;
  }

  const res = await fetch(existing ? `${HOST}/pages/${existing.id}` : `${HOST}/pages`, {
    method: existing ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json', token },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) {
    throw new Error(`${existing ? 'PUT' : 'POST'} ${p.handle}: ${JSON.stringify(json).slice(0, 200)}`);
  }
  console.log(`  ✅ ${existing ? 'updated' : 'created'} https://${p.domain}/pages/${p.handle}`);
}

async function main() {
  console.log(`deploy-studio-page — ${PAGES.length} page(s), dry_run=${DRY_RUN}`);
  let failed = 0;
  for (const p of PAGES) {
    try { await upsert(p); }
    catch (e) { console.error(`  FAILED ${p.handle}: ${e.message}`); failed++; }
  }
  if (failed) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
