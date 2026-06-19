/**
 * Export live CMS page(s) into the repo — body + SEO meta — for any handle on
 * any locale/subdomain (en/es/fr/it). Reusable for review/rebuild.
 *
 * Two modes:
 *   BULK    — set MANIFEST=<path to JSON array of {handle, locale, outfile?}>.
 *             Exports every entry. (Driven by sync/export-manifest.json + a
 *             push trigger, so it needs no manual dispatch.)
 *   SINGLE  — set HANDLE + LOCALE (+ optional OUTFILE). For one-off dispatch.
 *
 * Writes per page:
 *   <outfile>            (page body; default pages/export-<handle>)
 *   <outfile>.meta.json  (title, meta_title, meta_descript, meta_keywords)
 *
 * Env: OEMSAAS_TOKEN_EN / _ES / _FR / _IT (the matching locale token is used).
 */

const fs = require('fs');
const path = require('path');

const HOST = 'https://openapi.oemapps.com';
const TOKENS = {
  en: process.env.OEMSAAS_TOKEN_EN,
  es: process.env.OEMSAAS_TOKEN_ES,
  fr: process.env.OEMSAAS_TOKEN_FR,
  it: process.env.OEMSAAS_TOKEN_IT
};
const LABEL = { en: 'momuto.com', es: 'es.momuto.com', fr: 'fr.momuto.com', it: 'it.momuto.com' };

async function getPage(token, handle, label) {
  const res = await fetch(`${HOST}/pages?handle=${handle}`, { headers: { token } });
  const json = await res.json();
  if (!res.ok || json.code !== 0) throw new Error(`GET ?handle=${handle} on ${label} failed: ${JSON.stringify(json)}`);
  const pages = json.data?.list || json.data || [];
  return Array.isArray(pages) ? (pages.find(p => p.handle === handle) || null) : null;
}

async function exportOne({ handle, locale, outfile }) {
  locale = (locale || 'es').trim();
  const token = TOKENS[locale];
  if (!handle) throw new Error('entry missing "handle"');
  if (!token) throw new Error(`no token for locale "${locale}"`);

  const page = await getPage(token, handle, LABEL[locale]);
  if (!page) throw new Error(`page "${handle}" not found on ${LABEL[locale]}`);

  const out = (outfile && outfile.trim()) || `pages/export-${handle}`;
  const metaFile = `${out}.meta.json`;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, page.content || '', 'utf8');
  fs.writeFileSync(metaFile, JSON.stringify({
    handle: page.handle,
    locale,
    url: `https://${LABEL[locale]}/pages/${page.handle}`,
    title: page.title || '',
    meta_title: page.meta_title || '',
    meta_descript: page.meta_descript || '',
    meta_keywords: page.meta_keywords || ''
  }, null, 2) + '\n', 'utf8');

  console.log(`✓ ${handle} (${locale}) → ${out} (${(page.content || '').length} chars)`);
  return [out, metaFile];
}

async function main() {
  const manifestPath = (process.env.MANIFEST || '').trim();
  const written = [];
  const errors = [];

  let entries;
  if (manifestPath) {
    if (!fs.existsSync(manifestPath)) { console.log(`Manifest ${manifestPath} not found — nothing to do.`); }
    else {
      entries = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (!Array.isArray(entries)) throw new Error(`${manifestPath} must be a JSON array`);
      console.log(`Bulk export: ${entries.length} entr(ies) from ${manifestPath}\n`);
    }
  } else {
    entries = [{ handle: process.env.HANDLE, locale: process.env.LOCALE, outfile: process.env.OUTFILE }];
  }

  for (const e of (entries || [])) {
    try { written.push(...await exportOne(e)); }
    catch (err) { console.error(`❌ ${e.handle || '(no handle)'}: ${err.message}`); errors.push(e.handle); }
  }

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `files=${written.join(' ')}\n`);
  }
  console.log(`\n✓ ${written.length} file(s) written` + (errors.length ? `, ${errors.length} error(s)` : ''));
  if (errors.length) process.exit(1);
}

main().catch(e => { console.error(`❌ ${e.message}`); process.exit(1); });
