'use strict';

/**
 * Deploy the "Ready to Play" hub page — the wall of finished designs and the
 * landing for the 3D kit designer (docs/product-architecture.md). All four
 * locales — each wall took over its store's aged collection URL in place.
 *
 * URL decision (4 Aug, owner): the wall lives at each store's collection
 * handle (en ready-to-play, es coleccion-, fr collection-, it collezione-),
 * upserted in place so the URL equity transfers. The short-lived EN
 * /pages/the-studio-3d-kit-designer is deleted by the retire step below;
 * add the 301 (the-studio-3d-kit-designer → ready-to-play) in the CMS
 * admin if the platform supports URL redirects.
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
    handle: 'ready-to-play',
    file: path.join(ROOT, 'pages', 'ready-to-play'),
    retire: 'the-studio-3d-kit-designer',
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
  {
    locale: 'es',
    token: () => process.env.OEMSAAS_TOKEN_ES,
    domain: 'es.momuto.com',
    handle: 'coleccion-ready-to-play',
    file: path.join(ROOT, 'pages', 'coleccion-ready-to-play'),
    title: 'Ready to Play — Diseñador 3D de Camisetas | MOMUTO',
    meta_title: 'Crea tu Camiseta de Fútbol en 3D Gratis — Ready to Play | MOMUTO',
    meta_descript: 'Diseña una camiseta de fútbol real en 3D, gratis. Cada diseño Ready to Play carga terminado: colores, escudo, nombres y dorsales — y pide desde una unidad.',
    keywords: [
      'diseñador de camisetas de futbol 3d',
      'crear camiseta de futbol online gratis',
      'diseñar camiseta de futbol',
      'creador de equipaciones de futbol',
      'camisetas de futbol personalizadas 3d',
      'hacer camiseta de futbol personalizada',
      'diseñador de equipaciones',
    ],
  },
  {
    locale: 'fr',
    token: () => process.env.OEMSAAS_TOKEN_FR,
    domain: 'fr.momuto.com',
    handle: 'collection-ready-to-play',
    file: path.join(ROOT, 'pages', 'collection-ready-to-play'),
    title: 'Ready to Play — Créateur de Maillot de Foot 3D | MOMUTO',
    meta_title: 'Créateur de Maillot de Foot 3D Gratuit — Ready to Play | MOMUTO',
    meta_descript: 'Créez un vrai maillot de foot en 3D, gratuitement. Chaque design Ready to Play se charge fini : couleurs, écusson, noms et numéros — commandez dès un maillot.',
    keywords: [
      'créateur de maillot de foot 3d',
      'créer son maillot de foot gratuit',
      'designer maillot de football',
      'maillot de foot personnalisé 3d',
      'configurateur maillot de foot',
      'faire son maillot de foot',
      'créateur de maillot en ligne',
    ],
  },
  {
    locale: 'it',
    token: () => process.env.OEMSAAS_TOKEN_IT,
    domain: 'it.momuto.com',
    handle: 'collezione-ready-to-play',
    file: path.join(ROOT, 'pages', 'collezione-ready-to-play'),
    title: 'Ready to Play — Designer 3D di Maglie da Calcio | MOMUTO',
    meta_title: 'Crea la tua Maglia da Calcio 3D Gratis — Ready to Play | MOMUTO',
    meta_descript: 'Crea una vera maglia da calcio in 3D, gratis. Ogni design Ready to Play si carica già finito: colori, stemma, nomi e numeri — ordina anche una sola maglia.',
    keywords: [
      'creare maglia da calcio online',
      'designer maglie da calcio 3d',
      'crea la tua maglia da calcio gratis',
      'maglie da calcio personalizzate 3d',
      'configuratore maglie da calcio',
      'disegnare maglia da calcio',
      'creatore di maglie da calcio',
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

  const existing = await getExisting(p.handle, token);
  const payload = {
    is_default: 0, title: p.title, content,
    meta_title: p.meta_title, meta_keywords: p.keywords,
    meta_descript: p.meta_descript, handle: p.handle,
    ...(existing?.og_image ? { og_image: existing.og_image } : {}), // PUT replaces whole object — don't drop the social image
  };

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

// One-shot takeover cleanup: once the wall lives at its final handle, the old
// page must not stay live as a duplicate. Deletes it if the API allows;
// otherwise tells the operator to remove/301 it in the CMS admin.
async function retireOld(p) {
  if (!p.retire) return;
  const token = p.token();
  if (!token) return;
  const old = await getExisting(p.retire, token);
  if (!old) { console.log(`  ·  retired handle ${p.retire} is no longer on ${p.domain}`); return; }
  if (DRY_RUN) { console.log(`  DRY_RUN — would DELETE /pages/${old.id} (${p.retire})`); return; }
  const res = await fetch(`${HOST}/pages/${old.id}`, { method: 'DELETE', headers: { token } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || (json.code !== undefined && json.code !== 0)) {
    console.warn(`  ⚠️  could not delete ${p.retire}: ${JSON.stringify(json).slice(0, 150)} — remove or 301 it in the CMS admin`);
    return;
  }
  console.log(`  🗑  deleted /pages/${p.retire} — add the 301 → /pages/${p.handle} in the CMS admin if available`);
}

async function main() {
  console.log(`deploy-ready-to-play-page — ${PAGES.length} page(s), dry_run=${DRY_RUN}`);
  let failed = 0;
  for (const p of PAGES) {
    try { await upsert(p); await retireOld(p); }
    catch (e) { console.error(`  FAILED ${p.handle}: ${e.message}`); failed++; }
  }
  if (failed) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
