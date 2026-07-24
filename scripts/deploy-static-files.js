const fs = require('fs');
const path = require('path');

// NOTE: sitemap.xml is intentionally NOT deployed here. It is owned by
// scripts/rebuild-sitemap.js, which generates the sitemap dynamically from the
// live CMS (including cross-locale hreflang annotations) and pushes it to the
// DIY file. The static/*/sitemap.xml files are legacy snapshots; deploying them
// would overwrite the richer dynamic sitemap with stale, hreflang-less content.

const DOMAINS = {
  en: {
    token: process.env.OEMSAAS_TOKEN_EN,
    label: 'momuto.com',
    host: 'https://openapi.oemapps.com',
    staticDir: path.join('static', 'momuto.com'),
    files: ['robots.txt', 'llms.txt', 'blog.css', '0137a8dc25c5cd9835ec4170134b07b4.txt', 'rtp-content.js', 'custom-content.js', 'rtp-loader.js', 'pricing.js', 'iconic-content.js']
  },
  es: {
    token: process.env.OEMSAAS_TOKEN_ES,
    label: 'es.momuto.com',
    host: 'https://openapi.oemapps.com',
    staticDir: path.join('static', 'es.momuto.com'),
    files: ['robots.txt', 'llms.txt', 'blog.css', 'rtp-content.js']
  },
  fr: {
    token: process.env.OEMSAAS_TOKEN_FR,
    label: 'fr.momuto.com',
    host: 'https://openapi.oemapps.com',
    staticDir: path.join('static', 'fr.momuto.com'),
    files: ['robots.txt', 'llms.txt', 'blog.css', 'rtp-content.js']
  },
  it: {
    token: process.env.OEMSAAS_TOKEN_IT,
    label: 'it.momuto.com',
    host: 'https://openapi.oemapps.com',
    staticDir: path.join('static', 'it.momuto.com'),
    files: ['robots.txt', 'llms.txt', 'blog.css', 'rtp-content.js']
  }
};

// For EN, llms.txt lives in static/shared/
const SHARED_DIR = path.join('static', 'shared');

function getFilePath(domain, filename) {
  // Shared files served identically across all stores
  if (filename === 'blog.css') return path.join(SHARED_DIR, 'blog.css');
  if (filename === 'llms.txt' && domain.label === 'momuto.com') return path.join(SHARED_DIR, 'llms.txt');
  // Shared RTP product-page content script (same file, all stores; data-lang picks locale).
  // Lives under public/configurator/ so an ordinary push to static/** never triggers a full
  // static deploy — deploy it surgically with the workflow's file=rtp-content.js input.
  if (filename === 'rtp-content.js') return path.join('public', 'configurator', 'rtp-content.js');
  // Shared custom-product page content script (same file, all stores; data-lang picks locale).
  if (filename === 'custom-content.js') return path.join('public', 'configurator', 'custom-content.js');
  if (filename === 'iconic-content.js') return path.join('iconic-series', 'shared', 'iconic-content.js');
  // Canonical kit pricing (single source of truth). EN-hosted, referenced by
  // custom-content.js (3D PDP estimator) and embed.js (RTP widget) — one file to
  // update when prices change. See public/configurator/pricing.js.
  if (filename === 'pricing.js') return path.join('public', 'configurator', 'pricing.js');
  // Stable loader the product-page blocks reference — derives assets from data-template
  // and cache-busts embed/content at runtime so engine updates need no ?v= bump / re-paste.
  if (filename === 'rtp-loader.js') return path.join('public', 'configurator', 'rtp-loader.js');
  // Configurator engine + per-template asset bundles. Locale-independent (same file
  // every store; embed.js reads data-lang). Self-host per store so updates propagate
  // via this workflow. Deploy surgically with the file=embed.js / file=assets-<slug>.js input.
  if (filename === 'embed.js') return path.join('public', 'configurator', 'embed.js');
  if (/^assets-[a-z]+\.js$/.test(filename)) return path.join('public', 'configurator', filename);
  return path.join(domain.staticDir, filename);
}

async function getDiyFile(domain, filename) {
  let page = 1;
  const pagesize = 50;
  while (true) {
    const url = `${domain.host}/diyfiles?page=${page}&pagesize=${pagesize}`;
    const response = await fetch(url, { headers: { token: domain.token } });
    const result = await response.json();
    if (!response.ok || result.code !== 0) return null;
    const files = result.data?.list || result.data || [];
    if (!Array.isArray(files) || files.length === 0) return null;
    const found = files.find(f => f.file_name === filename);
    if (found) return found;
    if (files.length < pagesize) return null;
    page++;
  }
}

async function updateDiyFile(domain, fileId, filename, type, content) {
  const response = await fetch(`${domain.host}/diyfiles/${fileId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', token: domain.token },
    body: JSON.stringify({ file_name: filename, type: type, content: content })
  });
  const result = await response.json();
  if (!response.ok || result.code !== 0) {
    throw new Error(`Update failed: ${JSON.stringify(result)}`);
  }
  return result;
}

async function deployFile(domain, filename) {
  const filePath = getFilePath(domain, filename);

  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  ${filename} not found at ${filePath} — skipping`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const existing = await getDiyFile(domain, filename);

  if (existing) {
    await updateDiyFile(domain, existing.id, filename, existing.type, content);
    console.log(`  ✓ Updated ${filename} on ${domain.label}`);
  } else {
    // OEMSaaS DiyFile API does not support POST (create). The file must be
    // created manually in the OEMSaaS admin panel first (Settings → DIY Files),
    // then this script can update it.
    throw new Error(
      `${filename} does not exist on ${domain.label} — create it manually in the OEMSaaS admin panel (Settings → DIY Files) with an empty body, then re-run this workflow`
    );
  }
}

async function main() {
  const targetDomain = process.env.TARGET_DOMAIN; // optional: 'en', 'es', or 'fr'
  const targetFile = process.env.TARGET_FILE;     // optional: 'robots.txt', 'llms.txt', 'sitemap.xml'

  const domainsToProcess = targetDomain
    ? { [targetDomain]: DOMAINS[targetDomain] }
    : DOMAINS;

  const errors = [];

  for (const [lang, domain] of Object.entries(domainsToProcess)) {
    if (!domain) {
      console.error(`❌ Unknown domain key: ${targetDomain}`);
      process.exit(1);
    }
    if (!domain.token) {
      console.warn(`⚠️  No token for ${domain.label} — skipping`);
      continue;
    }

    console.log(`\nDeploying static files to ${domain.label}...`);

    if (targetFile === 'sitemap.xml') {
      console.error('❌ sitemap.xml is managed by scripts/rebuild-sitemap.js — run that instead.');
      process.exit(1);
    }
    const filesToDeploy = targetFile ? [targetFile] : domain.files;

    for (const filename of filesToDeploy) {
      try {
        await deployFile(domain, filename);
      } catch (err) {
        console.error(`  ❌ ${filename} on ${domain.label}: ${err.message}`);
        errors.push({ domain: domain.label, file: filename, error: err.message });
      }
    }
  }

  if (errors.length > 0) {
    console.error(`\n⚠️  Completed with ${errors.length} error(s):`);
    errors.forEach(e => console.error(`  - [${e.domain}] ${e.file}: ${e.error}`));
    process.exit(1);
  }

  console.log('\n✅ All static files deployed successfully.');
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
