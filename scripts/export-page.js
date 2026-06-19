/**
 * Export a live CMS page into the repo, for any handle on any locale/subdomain.
 *
 * Fetches GET /pages?handle=<HANDLE> with the locale's token and writes:
 *   - the page body  → <OUTFILE>                (default: pages/export-<handle>)
 *   - the SEO meta   → <OUTFILE>.meta.json       (title, meta_title, meta_descript, meta_keywords)
 *
 * Reusable for pulling any page from any subdomain (en/es/fr/it) into the repo
 * so it can be reviewed, rebuilt, and brought into the deploy pipeline.
 *
 * Env:
 *   HANDLE   - required (e.g. zentral-opiniones-alternativa)
 *   LOCALE   - en | es | fr | it (default: es)
 *   OUTFILE  - optional output path (default: pages/export-<HANDLE>)
 *   OEMSAAS_TOKEN_EN / _ES / _FR / _IT - the matching locale token is required
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

const HANDLE = (process.env.HANDLE || '').trim();
const LOCALE = (process.env.LOCALE || 'es').trim();
const OUTFILE = (process.env.OUTFILE || '').trim() || `pages/export-${HANDLE}`;

async function main() {
  if (!HANDLE) { console.error('❌ HANDLE not set'); process.exit(1); }
  const token = TOKENS[LOCALE];
  if (!token) { console.error(`❌ No token for locale "${LOCALE}"`); process.exit(1); }

  const res = await fetch(`${HOST}/pages?handle=${HANDLE}`, { headers: { token } });
  const json = await res.json();
  if (!res.ok || json.code !== 0) throw new Error(`GET /pages?handle=${HANDLE} on ${LABEL[LOCALE]} failed: ${JSON.stringify(json)}`);
  const pages = json.data?.list || json.data || [];
  const page = Array.isArray(pages) ? pages.find(p => p.handle === HANDLE) : null;
  if (!page) throw new Error(`Page "${HANDLE}" not found on ${LABEL[LOCALE]}`);

  const metaFile = `${OUTFILE}.meta.json`;
  fs.mkdirSync(path.dirname(OUTFILE), { recursive: true });
  fs.writeFileSync(OUTFILE, page.content || '', 'utf8');
  fs.writeFileSync(metaFile, JSON.stringify({
    handle: page.handle,
    locale: LOCALE,
    url: `https://${LABEL[LOCALE]}/pages/${page.handle}`,
    title: page.title || '',
    meta_title: page.meta_title || '',
    meta_descript: page.meta_descript || '',
    meta_keywords: page.meta_keywords || ''
  }, null, 2) + '\n', 'utf8');

  console.log(`✓ Exported ${HANDLE} from ${LABEL[LOCALE]}`);
  console.log(`   body  → ${OUTFILE} (${(page.content || '').length} chars)`);
  console.log(`   meta  → ${metaFile}`);
  console.log(`   meta_title: ${page.meta_title || '(none)'}`);

  // Hand the file paths to the workflow's commit step.
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `outfile=${OUTFILE}\nmetafile=${metaFile}\n`);
  }
}

main().catch(e => { console.error(`❌ ${e.message}`); process.exit(1); });
