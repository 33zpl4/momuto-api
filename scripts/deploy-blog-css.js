/**
 * Deploys static/shared/blog.css to the OEMSaaS /scripts endpoint
 * for Post Detail and Post List pages on all four stores.
 *
 * The CSS is wrapped in <style> tags and injected into the <head>
 * of every blog page via the CMS custom scripts feature.
 * A named entry ("momuto-blog-styles") is used so the script can
 * find and update it on subsequent runs rather than creating duplicates.
 *
 * Usage:
 *   node scripts/deploy-blog-css.js
 *   DRY_RUN=true node scripts/deploy-blog-css.js
 *   TARGET_DOMAIN=it node scripts/deploy-blog-css.js
 *
 * Env:
 *   OEMSAAS_TOKEN_EN / _ES / _FR / _IT  - per store
 *   TARGET_DOMAIN                        - optional: en | es | fr | it
 *   DRY_RUN=true                         - preview only, no writes
 */

'use strict';

const fs = require('fs');
const path = require('path');

const CSS_FILE = path.join(__dirname, '..', 'static', 'shared', 'blog.css');
const SCRIPT_NAME = 'momuto-blog-styles';

// Routes to inject into (Post Detail + Post List)
const ROUTES = ['news/detail', 'news/list'];

const DOMAINS = {
  en: { host: 'https://openapi.oemapps.com', token: process.env.OEMSAAS_TOKEN_EN, label: 'momuto.com' },
  es: { host: 'https://openapi.oemapps.com', token: process.env.OEMSAAS_TOKEN_ES, label: 'es.momuto.com' },
  fr: { host: 'https://openapi.oemapps.com', token: process.env.OEMSAAS_TOKEN_FR, label: 'fr.momuto.com' },
  it: { host: 'https://openapi.oemapps.com', token: process.env.OEMSAAS_TOKEN_IT, label: 'it.momuto.com' },
};

const DRY_RUN = process.env.DRY_RUN === 'true';
const TARGET_DOMAIN = process.env.TARGET_DOMAIN || '';

async function fetchScripts(domain) {
  let page = 1;
  const pagesize = 50;
  const items = [];
  while (true) {
    const url = `${domain.host}/scripts?page=${page}&pagesize=${pagesize}`;
    const res = await fetch(url, { headers: { token: domain.token } });
    const json = await res.json();
    if (!res.ok || json.code !== 0) break;
    const list = json.data?.list ?? (Array.isArray(json.data) ? json.data : []);
    if (!Array.isArray(list) || list.length === 0) break;
    items.push(...list);
    if (list.length < pagesize) break;
    page++;
  }
  return items;
}

async function createScript(domain, payload) {
  const res = await fetch(`${domain.host}/scripts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token: domain.token },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) throw new Error(`POST /scripts failed: ${JSON.stringify(json)}`);
  return json;
}

async function updateScript(domain, id, payload) {
  const res = await fetch(`${domain.host}/scripts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', token: domain.token },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) throw new Error(`PUT /scripts/${id} failed: ${JSON.stringify(json)}`);
  return json;
}

async function deployToDomain(domain, cssDetail) {
  if (!domain.token) {
    console.warn(`  ⚠️  No token — skipping ${domain.label}`);
    return;
  }

  const existing = await fetchScripts(domain);

  for (const route of ROUTES) {
    const scriptName = `${SCRIPT_NAME}-${route.replace('/', '-')}`;
    const found = existing.find(s => s.script_name === scriptName);

    const payload = {
      script_name: scriptName,
      detail: cssDetail,
      display_routes: route,
      display_scope: 0,
      display_position: 0,
      display_checkout: 0,
      position: 0,   // 0 = header
      status: 1,
      bot_status: 1,
      domain_names: [],
    };

    if (DRY_RUN) {
      console.log(`  DRY_RUN — would ${found ? 'update' : 'create'} "${scriptName}" on ${domain.label}`);
      continue;
    }

    if (found) {
      await updateScript(domain, found.id, payload);
      console.log(`  ✓ Updated  "${scriptName}" on ${domain.label}`);
    } else {
      await createScript(domain, payload);
      console.log(`  ✓ Created  "${scriptName}" on ${domain.label}`);
    }
  }
}

async function main() {
  if (!fs.existsSync(CSS_FILE)) throw new Error(`CSS file not found: ${CSS_FILE}`);

  const css = fs.readFileSync(CSS_FILE, 'utf8');
  const cssDetail = `<style>\n${css}\n</style>`;

  console.log(`Blog CSS: ${css.length} chars`);
  console.log(`Dry run:  ${DRY_RUN}`);
  if (TARGET_DOMAIN) console.log(`Target:   ${TARGET_DOMAIN}`);

  const domainsToProcess = TARGET_DOMAIN
    ? { [TARGET_DOMAIN]: DOMAINS[TARGET_DOMAIN] }
    : DOMAINS;

  if (TARGET_DOMAIN && !DOMAINS[TARGET_DOMAIN]) {
    console.error(`❌ Unknown domain: ${TARGET_DOMAIN}`);
    process.exit(1);
  }

  const errors = [];

  for (const [lang, domain] of Object.entries(domainsToProcess)) {
    console.log(`\nDeploying to ${domain.label}...`);
    try {
      await deployToDomain(domain, cssDetail);
    } catch (err) {
      console.error(`  ❌ ${domain.label}: ${err.message}`);
      errors.push(`${domain.label}: ${err.message}`);
    }
  }

  if (errors.length > 0) {
    console.error(`\n⚠️  ${errors.length} error(s):`);
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log('\n✅ Blog CSS deployed successfully.');
}

main().catch(err => {
  console.error('❌ Fatal:', err.message);
  process.exit(1);
});
