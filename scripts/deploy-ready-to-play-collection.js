/**
 * Deploy the Ready-to-Play collection pages (ready-to-play/collection/{en,es,fr}.html)
 * to their CMS pages on each domain, preserving the existing CMS-level meta.
 *
 * Use when collection-level changes (card URL fixes, layout tweaks, SEO edits)
 * need to ship without modifying any template.
 *
 * Env vars:
 *   OEMSAAS_TOKEN_EN / _ES / _FR - required (per domain)
 *   DRY_RUN=true                 - optional, skips CMS writes
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RTP_DIR = path.join(ROOT, 'ready-to-play');

const DOMAINS = {
  // en removed 4 Aug 2026: /pages/ready-to-play on www is now the Ready to
  // Play WALL, deployed by deploy-ready-to-play-page.js. Re-adding en here
  // would silently overwrite the wall with the old card grid — the exact
  // revert class documented in docs/rtp-collection.md.
  es: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_ES,
    label: 'es.momuto.com'
  },
  fr: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_FR,
    label: 'fr.momuto.com'
  },
  it: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_IT,
    label: 'it.momuto.com'
  }
};

const DRY_RUN = process.env.DRY_RUN === 'true';

function loadSharedConfig() {
  return JSON.parse(fs.readFileSync(path.join(RTP_DIR, 'config.json'), 'utf8'));
}

function loadCollectionHTML(lang) {
  return fs.readFileSync(path.join(RTP_DIR, 'collection', `${lang}.html`), 'utf8');
}

async function getPageByHandle(domain, handle) {
  const r = await fetch(`${domain.host}/pages?handle=${handle}`, { headers: { token: domain.token } });
  const j = await r.json();
  if (!r.ok || j.code !== 0) throw new Error(`GET /pages?handle=${handle} on ${domain.label} failed: ${JSON.stringify(j)}`);
  const pages = j.data?.list || j.data || [];
  const page = Array.isArray(pages) ? pages.find(p => p.handle === handle) : null;
  if (!page) throw new Error(`Collection page not found on ${domain.label} (handle: ${handle})`);
  return page;
}

async function updatePage(domain, pageId, body) {
  const r = await fetch(`${domain.host}/pages/${pageId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', token: domain.token },
    body: JSON.stringify(body)
  });
  const j = await r.json();
  if (!r.ok || j.code !== 0) throw new Error(`PUT /pages/${pageId} on ${domain.label} failed: ${JSON.stringify(j)}`);
  return j;
}

async function main() {
  const shared = loadSharedConfig();
  console.log(`Dry run: ${DRY_RUN}`);

  const errors = [];

  for (const [lang, domain] of Object.entries(DOMAINS)) {
    try {
      if (!domain.token && !DRY_RUN) {
        console.warn(`⚠️  No token for ${domain.label} — skipping`);
        continue;
      }
      const handle = shared.collection_handle[lang];
      const html = loadCollectionHTML(lang);

      console.log(`\n── ${domain.label} (${handle}) ──`);

      if (DRY_RUN) {
        console.log(`  [DRY RUN] would PUT ${html.length} chars to /pages/${handle}`);
        continue;
      }

      const existing = await getPageByHandle(domain, handle);
      await updatePage(domain, existing.id, {
        is_default: existing.is_default ?? 0,
        title: existing.title,
        content: html,
        meta_title: existing.meta_title,
        meta_keywords: existing.meta_keywords,
        meta_descript: existing.meta_descript,
        og_image: existing.og_image,
        handle: handle
      });
      console.log(`  ✓ deployed (${html.length} chars)`);
    } catch (e) {
      console.error(`✗ ${domain.label}: ${e.message}`);
      errors.push({ domain: domain.label, error: e.message });
    }
  }

  if (errors.length > 0) {
    console.error(`\nCompleted with ${errors.length} error(s):`);
    errors.forEach(e => console.error(`  ${e.domain}: ${e.error}`));
    process.exit(1);
  }

  console.log(`\n✓ Done. Collection pages deployed.`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
