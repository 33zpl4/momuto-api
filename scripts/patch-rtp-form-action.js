'use strict';
/**
 * Patch the form action on all Ready-to-Play template pages in the CMS.
 * Fetches each live page, replaces only the content body, preserves all meta.
 *
 * Env vars: OEMSAAS_TOKEN_EN / _ES / _FR / _IT
 */

const fs   = require('fs');
const path = require('path');

const ROOT    = path.resolve(__dirname, '..');
const RTP_DIR = path.join(ROOT, 'ready-to-play');

const config = JSON.parse(fs.readFileSync(path.join(RTP_DIR, 'config.json'), 'utf8'));

const TEMPLATES = ['the-kinetic', 'the-apex', 'the-fracture', 'the-legacy', 'the-mosaic'];

const DOMAINS = {
  en: { host: 'https://openapi.oemapps.com', token: process.env.OEMSAAS_TOKEN_EN, label: 'momuto.com' },
  es: { host: 'https://openapi.oemapps.com', token: process.env.OEMSAAS_TOKEN_ES, label: 'es.momuto.com' },
  fr: { host: 'https://openapi.oemapps.com', token: process.env.OEMSAAS_TOKEN_FR, label: 'fr.momuto.com' },
  it: { host: 'https://openapi.oemapps.com', token: process.env.OEMSAAS_TOKEN_IT, label: 'it.momuto.com' },
};

const DRY_RUN = process.env.DRY_RUN === 'true';

async function getPage(domain, handle) {
  const r = await fetch(`${domain.host}/pages?handle=${handle}`, { headers: { token: domain.token } });
  const j = await r.json();
  if (!r.ok || j.code !== 0) throw new Error(`GET ${handle} on ${domain.label}: ${JSON.stringify(j)}`);
  const list = j.data?.list || j.data || [];
  return Array.isArray(list) ? (list.find(p => p.handle === handle) || null) : null;
}

async function putPage(domain, page, newContent) {
  if (DRY_RUN) { console.log(`  [DRY RUN] would PUT ${page.handle}`); return; }
  const r = await fetch(`${domain.host}/pages/${page.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', token: domain.token },
    body: JSON.stringify({
      handle:       page.handle,
      title:        page.title,
      content:      newContent,
      is_default:   page.is_default,
      meta_title:   page.meta_title,
      meta_keywords: page.meta_keywords,
      meta_descript: page.meta_descript,
      og_image:     page.og_image,
    }),
  });
  const j = await r.json();
  if (!r.ok || j.code !== 0) throw new Error(`PUT ${page.handle} on ${domain.label}: ${JSON.stringify(j)}`);
}

async function main() {
  const errors = [];

  for (const slug of TEMPLATES) {
    console.log(`\n══ ${slug} ══`);
    for (const [lang, domain] of Object.entries(DOMAINS)) {
      if (!domain.token) { console.log(`  [${lang}] no token — skip`); continue; }

      const handle = config.template_handle_pattern[lang].replace('{slug}', slug);
      const localHTML = fs.readFileSync(path.join(RTP_DIR, 'templates', slug, `${lang}.html`), 'utf8');

      try {
        const page = await getPage(domain, handle);
        if (!page) { console.log(`  [${lang}] page not found on ${domain.label} (${handle})`); continue; }
        await putPage(domain, page, localHTML);
        console.log(`  [${lang}] ✓ ${domain.label} — ${handle}`);
      } catch (err) {
        console.error(`  [${lang}] ✗ ${err.message}`);
        errors.push(`${slug}/${lang}: ${err.message}`);
      }
    }
  }

  if (errors.length) {
    console.error(`\n${errors.length} error(s):\n`, errors.join('\n'));
    process.exit(1);
  }
  console.log('\nAll done.');
}

main();
