const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const SHARED_CSS = path.join(ROOT, 'shared', 'design-request.css');
const SHARED_JS  = path.join(ROOT, 'shared', 'design-request.js');

function injectShared(template) {
  const css = fs.readFileSync(SHARED_CSS, 'utf8');
  const js  = fs.readFileSync(SHARED_JS,  'utf8');
  return template
    .replace('<!-- inject:design-request.css -->', `<style>\n${css}\n</style>`)
    .replace('<!-- inject:design-request.js -->',  `<script>\n${js}\n</script>`);
}

const DOMAINS = {
  en: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_EN,
    label: 'momuto.com',
    handle: 'request-custom-kit-design',
    file: path.join(ROOT, 'pages', 'request-custom-kit-design')
  },
  es: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_ES,
    label: 'es.momuto.com',
    handle: 'solicitud-de-diseno-personalizado',
    file: path.join(ROOT, 'pages', 'solicitud-de-diseno-personalizado')
  },
  fr: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_FR,
    label: 'fr.momuto.com',
    handle: 'demande-de-design-professionnel-de-maillots',
    file: path.join(ROOT, 'pages', 'demande-de-design-professionnel-de-maillots')
  },
  it: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_IT,
    label: 'it.momuto.com',
    handle: 'richiesta-design-personalizzato',
    file: path.join(ROOT, 'pages', 'richiesta-design-personalizzato')
  }
};

const DRY_RUN = process.env.DRY_RUN === 'true';
const LOCALES = (process.env.LOCALES || 'en,es,fr,it')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function sanityCheck(content, file) {
  if (!content.includes('Bebas Neue') || !content.includes('Outfit')) {
    throw new Error(`${file} missing Bebas Neue + Outfit — refusing to deploy`);
  }
  const h1Count = (content.match(/<h1\b/g) || []).length;
  if (h1Count !== 1) {
    throw new Error(`${file} must have exactly 1 <h1> (found ${h1Count})`);
  }
}

async function getPageByHandle(domain) {
  const url = `${domain.host}/pages?handle=${domain.handle}`;
  const res = await fetch(url, { headers: { token: domain.token } });
  const json = await res.json();
  if (!res.ok || json.code !== 0) {
    throw new Error(`GET /pages?handle=${domain.handle} on ${domain.label} failed: ${JSON.stringify(json)}`);
  }
  const pages = json.data?.list || json.data || [];
  const page = Array.isArray(pages) ? pages.find(p => p.handle === domain.handle) : null;
  if (!page) throw new Error(`Page ${domain.handle} not found on ${domain.label}`);
  return page;
}

async function updatePage(domain, page, content) {
  const res = await fetch(`${domain.host}/pages/${page.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', token: domain.token },
    body: JSON.stringify({
      content,
      title: page.title,
      meta_title: page.meta_title,
      meta_keywords: page.meta_keywords,
      meta_descript: page.meta_descript,
      handle: page.handle
    })
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) {
    throw new Error(`PUT /pages/${page.id} on ${domain.label} failed: ${JSON.stringify(json)}`);
  }
  return json;
}

async function deployLocale(locale) {
  const domain = DOMAINS[locale];
  if (!domain) throw new Error(`Unknown locale: ${locale}`);

  if (!domain.token) {
    console.warn(`⚠️  No token for ${domain.label} — skipping`);
    return { locale, skipped: true };
  }

  if (!fs.existsSync(domain.file)) {
    throw new Error(`Source file not found: ${domain.file}`);
  }

  const template = fs.readFileSync(domain.file, 'utf8');
  const repoContent = injectShared(template);
  sanityCheck(repoContent, domain.file);

  const page = await getPageByHandle(domain);
  const liveContent = page.content || '';

  if (repoContent === liveContent) {
    console.log(`✓ ${domain.label}: already up to date (${liveContent.length} chars)`);
    return { locale, unchanged: true };
  }

  console.log(`${domain.label}: ${liveContent.length} → ${repoContent.length} chars`);

  if (DRY_RUN) {
    console.log(`  DRY_RUN — skipping PUT`);
    return { locale, dryRun: true };
  }

  await updatePage(domain, page, repoContent);
  console.log(`✓ Deployed ${domain.handle} to ${domain.label}`);
  return { locale, deployed: true };
}

async function main() {
  console.log(`Dry run: ${DRY_RUN}`);
  console.log(`Locales: ${LOCALES.join(', ')}`);

  const errors = [];
  for (const locale of LOCALES) {
    if (!DOMAINS[locale]) {
      errors.push(`${locale}: unknown locale`);
      console.error(`❌ Unknown locale: ${locale}`);
      continue;
    }
    try {
      await deployLocale(locale);
    } catch (e) {
      errors.push(`${locale}: ${e.message}`);
      console.error(`❌ ${locale}: ${e.message}`);
    }
  }

  if (errors.length) {
    console.error(`\n${errors.length} error(s):`);
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log('\n✓ Done');
}

main();
