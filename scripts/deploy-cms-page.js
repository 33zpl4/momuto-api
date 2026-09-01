'use strict';

/**
 * Round-trips a CMS page pulled into cms/pages/<locale>/<handle>.json back to
 * the CMS. The pull step (scripts/pull-cms.js) writes the full raw page object
 * (including its numeric `id`), so we can PUT the edited content straight back.
 *
 * The sandbox can't reach the CMS API (egress policy), so this runs on the
 * GitHub runner via .github/workflows/deploy-cms-page.yml.
 *
 * Modes:
 *   PUSH  — CHANGED_FILES="cms/pages/fr/a.json cms/pages/en/b.json ..."
 *           (locale + handle derived from each path). Used by the push trigger.
 *   SINGLE— PAGE_HANDLE (+ LOCALE) for a one-off dispatch.
 *
 * Env:
 *   DRY_RUN=true|false          - default true (set false to write)
 *   OEMSAAS_TOKEN_{EN,FR,ES,IT} - token per locale
 */

const fs = require('fs');
const path = require('path');

const HOST = 'https://openapi.oemapps.com';
const DRY_RUN = process.env.DRY_RUN !== 'false';

const TOKENS = {
  en: process.env.OEMSAAS_TOKEN_EN,
  fr: process.env.OEMSAAS_TOKEN_FR,
  es: process.env.OEMSAAS_TOKEN_ES,
  it: process.env.OEMSAAS_TOKEN_IT,
  us: process.env.OEMSAAS_TOKEN_US,
};
const LABEL = { en: 'momuto.com', fr: 'fr.momuto.com', es: 'es.momuto.com', it: 'it.momuto.com', us: 'us.momuto.com' };

// cms/pages/<locale>/<handle>.json
function parsePath(file) {
  const m = file.match(/^cms\/pages\/(en|fr|es|it|us)\/(.+)\.json$/);
  return m ? { locale: m[1], handle: m[2] } : null;
}

async function updatePage(token, page) {
  const res = await fetch(`${HOST}/pages/${page.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', token },
    body: JSON.stringify({
      content: page.content,
      title: page.title,
      meta_title: page.meta_title,
      meta_keywords: page.meta_keywords,
      meta_descript: page.meta_descript,
      handle: page.handle,
    }),
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) throw new Error(`PUT /pages/${page.id} failed: ${JSON.stringify(json)}`);
  return json;
}

async function deployOne(locale, handle) {
  const token = TOKENS[locale];
  if (!token) { console.warn(`⚠️  ${handle}: no ${locale} token — skipping`); return; }

  const file = path.join(__dirname, '..', 'cms', 'pages', locale, `${handle}.json`);
  if (!fs.existsSync(file)) { console.warn(`⚠️  ${handle}: no file ${file} — skipping`); return; }

  const page = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!page.id) throw new Error(`${handle}: pulled page has no id — re-pull it first`);
  if (page.handle && page.handle !== handle) throw new Error(`${handle}: file handle "${page.handle}" ≠ path handle`);

  console.log(`• ${locale} ${handle} — "${page.title}" (${String(page.content || '').length} chars)`);
  if (DRY_RUN) { console.log('   DRY RUN — no write'); return; }

  await updatePage(token, page);
  console.log(`   ✅ https://${LABEL[locale]}/pages/${handle}`);
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  let targets;
  const changed = (process.env.CHANGED_FILES || '').trim();
  if (changed) {
    const seen = new Set();
    targets = changed.split(/\s+/).filter(Boolean).map(parsePath).filter(Boolean)
      .filter(t => { const k = `${t.locale}/${t.handle}`; if (seen.has(k)) return false; seen.add(k); return true; });
    if (!targets.length) { console.log('No cms/pages JSON changed — nothing to deploy.'); return; }
  } else {
    const handle = process.env.PAGE_HANDLE;
    if (!handle) { console.error('PAGE_HANDLE required (or set CHANGED_FILES)'); process.exit(1); }
    targets = [{ locale: (process.env.LOCALE || 'en').toLowerCase(), handle }];
  }

  const errors = [];
  for (const t of targets) {
    try { await deployOne(t.locale, t.handle); }
    catch (e) { console.error(`❌ ${e.message}`); errors.push(t.handle); }
  }
  if (errors.length) { console.error(`\n${errors.length} error(s)`); process.exit(1); }
  console.log('\n✅ Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
