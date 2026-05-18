/**
 * Patches delivery text across all team pages on all domains.
 * Fetches each page, does a string replace, pushes back — no AI calls needed.
 *
 * Usage: node scripts/patch-delivery-text.js
 * Optional: TARGET_DOMAIN=en node scripts/patch-delivery-text.js
 */

const DOMAINS = {
  en: {
    token: process.env.OEMSAAS_TOKEN_EN,
    host: 'https://openapi.oemapps.com',
    label: 'momuto.com',
    handleSuffix: 'custom-kit-design',
    replacements: [['20-25 DAYS', '25-30 DAYS']]
  },
  es: {
    token: process.env.OEMSAAS_TOKEN_ES,
    host: 'https://openapi.oemapps.com',
    label: 'es.momuto.com',
    handleSuffix: 'diseno-equipacion',
    replacements: [['20-25 DÍAS', '25-30 DÍAS']]
  },
  fr: {
    token: process.env.OEMSAAS_TOKEN_FR,
    host: 'https://openapi.oemapps.com',
    label: 'fr.momuto.com',
    handleSuffix: 'design-maillot',
    replacements: [['20-25 J', '25-30 J']]
  },
  it: {
    token: process.env.OEMSAAS_TOKEN_IT,
    host: 'https://openapi.oemapps.com',
    label: 'it.momuto.com',
    handleSuffix: 'design-maglia',
    replacements: [['20-25 GG', '25-30 GG']]
  }
};

async function getAllTeamPages(domain) {
  const pages = [];
  let page = 1;
  const pagesize = 50;
  while (true) {
    const res = await fetch(`${domain.host}/pages?page=${page}&pagesize=${pagesize}`, {
      headers: { token: domain.token }
    });
    const result = await res.json();
    if (!res.ok || result.code !== 0) throw new Error(`Failed to list pages: ${JSON.stringify(result)}`);
    const list = result.data?.list || result.data || [];
    if (!Array.isArray(list) || list.length === 0) break;
    const teamPages = list.filter(p => p.handle && p.handle.endsWith(`-${domain.handleSuffix}`));
    pages.push(...teamPages);
    if (list.length < pagesize) break;
    page++;
  }
  return pages;
}

async function patchPage(domain, p) {
  let content = p.content || '';
  let changed = false;
  for (const [from, to] of domain.replacements) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed = true;
    }
  }
  if (!changed) return false;

  const res = await fetch(`${domain.host}/pages/${p.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', token: domain.token },
    body: JSON.stringify({
      title: p.title,
      content,
      meta_title: p.meta_title,
      meta_keywords: p.meta_keywords,
      meta_descript: p.meta_descript,
      handle: p.handle
    })
  });
  const result = await res.json();
  if (!res.ok || result.code !== 0) throw new Error(`Failed to update page ${p.handle}: ${JSON.stringify(result)}`);
  return true;
}

async function main() {
  const targetDomain = process.env.TARGET_DOMAIN;
  const domainsToProcess = targetDomain
    ? { [targetDomain]: DOMAINS[targetDomain] }
    : DOMAINS;

  const errors = [];

  for (const [lang, domain] of Object.entries(domainsToProcess)) {
    if (!domain?.token) {
      console.warn(`⚠️  No token for ${domain?.label || lang} — skipping`);
      continue;
    }
    console.log(`\nFetching team pages from ${domain.label}...`);
    const pages = await getAllTeamPages(domain);
    console.log(`  Found ${pages.length} team pages`);

    let patched = 0;
    let skipped = 0;
    for (const p of pages) {
      try {
        const updated = await patchPage(domain, p);
        if (updated) {
          console.log(`  ✓ Patched: ${p.handle}`);
          patched++;
        } else {
          skipped++;
        }
      } catch (err) {
        console.error(`  ❌ ${p.handle}: ${err.message}`);
        errors.push({ domain: domain.label, handle: p.handle, error: err.message });
      }
    }
    console.log(`  Done: ${patched} patched, ${skipped} already up to date`);
  }

  if (errors.length > 0) {
    console.error(`\n⚠️  Completed with ${errors.length} error(s):`);
    errors.forEach(e => console.error(`  - [${e.domain}] ${e.handle}: ${e.error}`));
    process.exit(1);
  }
  console.log('\n✅ All pages patched successfully.');
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
