const fs = require('fs');
const path = require('path');

const DOMAINS = {
  en: {
    token: process.env.OEMSAAS_TOKEN_EN,
    label: 'momuto.com',
    host: 'https://openapi.oemapps.com',
    staticDir: path.join('static', 'momuto.com'),
    files: ['robots.txt', 'sitemap.xml', 'llms.txt']
  },
  es: {
    token: process.env.OEMSAAS_TOKEN_ES,
    label: 'es.momuto.com',
    host: 'https://openapi.oemapps.com',
    staticDir: path.join('static', 'es.momuto.com'),
    files: ['robots.txt', 'sitemap.xml', 'llms.txt']
  },
  fr: {
    token: process.env.OEMSAAS_TOKEN_FR,
    label: 'fr.momuto.com',
    host: 'https://openapi.oemapps.com',
    staticDir: path.join('static', 'fr.momuto.com'),
    files: ['robots.txt', 'sitemap.xml', 'llms.txt']
  }
};

// For EN, llms.txt lives in static/shared/
const SHARED_DIR = path.join('static', 'shared');

function getFilePath(domain, filename) {
  if (filename === 'llms.txt' && domain.label === 'momuto.com') {
    return path.join(SHARED_DIR, 'llms.txt');
  }
  return path.join(domain.staticDir, filename);
}

async function getDiyFile(domain, filename) {
  const response = await fetch(`${domain.host}/diy-files?name=${encodeURIComponent(filename)}`, {
    headers: { token: domain.token }
  });
  const result = await response.json();
  if (!response.ok || result.code !== 0) return null;
  const files = result.data?.list || result.data || [];
  return Array.isArray(files) ? (files.find(f => f.name === filename) || null) : null;
}

async function createDiyFile(domain, filename, content) {
  const response = await fetch(`${domain.host}/diy-files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token: domain.token },
    body: JSON.stringify({ name: filename, content })
  });
  const result = await response.json();
  if (!response.ok || result.code !== 0) {
    throw new Error(`Create failed: ${JSON.stringify(result)}`);
  }
  return result;
}

async function updateDiyFile(domain, fileId, filename, content) {
  const response = await fetch(`${domain.host}/diy-files/${fileId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', token: domain.token },
    body: JSON.stringify({ name: filename, content })
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
    await updateDiyFile(domain, existing.id, filename, content);
    console.log(`  ✓ Updated ${filename} on ${domain.label}`);
  } else {
    await createDiyFile(domain, filename, content);
    console.log(`  ✓ Created ${filename} on ${domain.label}`);
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
