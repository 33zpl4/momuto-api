// Rebuilds sitemap.xml for all domains by fetching all content from the CMS API.
// Discovers pages, blog articles, products, and collections dynamically.
//
// Usage:
//   node scripts/rebuild-sitemap.js           # fetch + push to CMS
//   node scripts/rebuild-sitemap.js --dry-run  # fetch + print XML, no push

const DRY_RUN = process.argv.includes('--dry-run');

const DOMAINS = {
  en: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_EN,
    label: 'momuto.com',
    baseUrl: 'https://www.momuto.com',
  },
  es: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_ES,
    label: 'es.momuto.com',
    baseUrl: 'https://es.momuto.com',
  },
  fr: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_FR,
    label: 'fr.momuto.com',
    baseUrl: 'https://fr.momuto.com',
  },
};

// Pages that deserve higher priority in the sitemap
const HIGH_PRIORITY_HANDLES = new Set([
  'custom-kit-gallery',
  'request-custom-kit-design',
  'faq',
  'printing',
  'ready-to-play',
  'momuto-vs-jersix-owayo-spized-comparison',
  'zentral-opiniones-alternativa',
  'comparatif-fournisseur-maillot-foot-2026',
  'galeria-equipaciones-personalizadas',
  'galerie-maillots-foot-sur-mesure',
  'about-us',
  'teams-clubs-momuto',
  'special-discounts',
  'idea-submission',
  'size-guide',
  'contact',
]);

async function fetchAll(domain, endpoint) {
  let page = 1;
  const pagesize = 50;
  const items = [];
  while (true) {
    const url = `${domain.host}/${endpoint}?page=${page}&pagesize=${pagesize}`;
    let result;
    try {
      const response = await fetch(url, { headers: { token: domain.token } });
      result = await response.json();
      if (!response.ok || result.code !== 0) {
        if (page === 1) {
          console.warn(`  ⚠️  ${endpoint} returned error on ${domain.label}: ${JSON.stringify(result)}`);
        }
        break;
      }
    } catch (err) {
      if (page === 1) console.warn(`  ⚠️  ${endpoint} fetch failed on ${domain.label}: ${err.message}`);
      break;
    }
    const list = result.data?.list || (Array.isArray(result.data) ? result.data : []);
    if (!Array.isArray(list) || list.length === 0) break;
    items.push(...list);
    if (list.length < pagesize) break;
    page++;
  }
  return items;
}

// Get the slug field from a CMS item (field name varies by endpoint)
function getSlug(item) {
  return item.handle || item.alias || item.slug || item.url_key || null;
}

// Get the last-modified date from a CMS item
function getLastmod(item, fallback) {
  const raw = item.updated_at || item.update_time || item.created_at || item.create_time;
  if (!raw) return fallback;
  const d = new Date(typeof raw === 'number' ? raw * 1000 : raw);
  return isNaN(d.getTime()) ? fallback : d.toISOString().split('T')[0];
}

function buildXml(entries) {
  const urlBlocks = entries.map(e =>
    `  <url>\n    <loc>${e.loc}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\n${urlBlocks}\n\n</urlset>\n`;
}

async function getDiyFile(domain, filename) {
  let page = 1;
  const pagesize = 50;
  while (true) {
    const url = `${domain.host}/diyfiles?page=${page}&pagesize=${pagesize}`;
    const response = await fetch(url, { headers: { token: domain.token } });
    const result = await response.json();
    if (!response.ok || result.code !== 0) return null;
    const files = result.data?.list || (Array.isArray(result.data) ? result.data : []);
    if (!Array.isArray(files) || files.length === 0) return null;
    const found = files.find(f => f.file_name === filename);
    if (found) return found;
    if (files.length < pagesize) return null;
    page++;
  }
}

async function pushSitemap(domain, xml) {
  const existing = await getDiyFile(domain, 'sitemap.xml');
  if (!existing) {
    console.error(`  ✗ sitemap.xml not found in DiyFiles on ${domain.label} — cannot push`);
    return false;
  }
  const response = await fetch(`${domain.host}/diyfiles/${existing.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', token: domain.token },
    body: JSON.stringify({ file_name: 'sitemap.xml', type: String(existing.type), url: '', content: xml }),
  });
  const result = await response.json();
  if (!response.ok || result.code !== 0) {
    console.error(`  ✗ Push failed on ${domain.label}: ${JSON.stringify(result)}`);
    return false;
  }
  return true;
}

async function rebuildDomain(domain) {
  console.log(`\n[${domain.label}] Fetching content from CMS...`);

  const [pages, posts, products, collections] = await Promise.all([
    fetchAll(domain, 'pages'),
    fetchAll(domain, 'posts'),
    fetchAll(domain, 'products'),
    fetchAll(domain, 'collections'),
  ]);

  console.log(`  pages: ${pages.length}, posts: ${posts.length}, products: ${products.length}, collections: ${collections.length}`);

  const today = new Date().toISOString().split('T')[0];
  const entries = [];

  // Homepage
  entries.push({ loc: `${domain.baseUrl}/`, lastmod: today, changefreq: 'weekly', priority: '1.0' });

  // All CMS pages → /pages/[handle]
  for (const p of pages) {
    const slug = getSlug(p);
    if (!slug) continue;
    const priority = HIGH_PRIORITY_HANDLES.has(slug) ? '0.8' : '0.7';
    entries.push({ loc: `${domain.baseUrl}/pages/${slug}`, lastmod: getLastmod(p, today), changefreq: 'monthly', priority });
  }

  // Collections index + individual collection pages
  entries.push({ loc: `${domain.baseUrl}/collections`, lastmod: today, changefreq: 'weekly', priority: '0.8' });
  for (const c of collections) {
    const slug = getSlug(c);
    if (!slug) continue;
    entries.push({ loc: `${domain.baseUrl}/collections/${slug}`, lastmod: getLastmod(c, today), changefreq: 'weekly', priority: '0.8' });
  }

  // Products → /products/[handle]
  for (const p of products) {
    const slug = getSlug(p);
    if (!slug) continue;
    entries.push({ loc: `${domain.baseUrl}/products/${slug}`, lastmod: getLastmod(p, today), changefreq: 'monthly', priority: '0.8' });
  }

  // Blog index + posts → /blogs/[handle]
  entries.push({ loc: `${domain.baseUrl}/blogs`, lastmod: today, changefreq: 'weekly', priority: '0.7' });
  for (const a of posts) {
    const slug = getSlug(a);
    if (!slug) continue;
    entries.push({ loc: `${domain.baseUrl}/blogs/${slug}`, lastmod: getLastmod(a, today), changefreq: 'monthly', priority: '0.6' });
  }

  const xml = buildXml(entries);
  console.log(`  Built sitemap with ${entries.length} URLs`);

  if (DRY_RUN) {
    console.log(`\n--- DRY RUN: sitemap.xml for ${domain.label} ---`);
    console.log(xml);
    return;
  }

  const ok = await pushSitemap(domain, xml);
  if (ok) {
    console.log(`  ✓ sitemap.xml pushed to ${domain.label}`);
  }
}

async function main() {
  if (DRY_RUN) console.log('DRY RUN — no changes will be pushed\n');

  for (const domain of Object.values(DOMAINS)) {
    if (!domain.token) {
      console.warn(`[${domain.label}] Skipping — token not set`);
      continue;
    }
    await rebuildDomain(domain);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
