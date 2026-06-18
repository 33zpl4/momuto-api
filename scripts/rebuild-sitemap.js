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
  it: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_IT,
    label: 'it.momuto.com',
    baseUrl: 'https://it.momuto.com',
  },
};

// Pages that deserve higher priority in the sitemap
const HIGH_PRIORITY_HANDLES = new Set([
  'custom-kit-gallery',
  'custom-soccer-jerseys',
  'custom-youth-club-soccer-uniforms',
  'design-your-own-soccer-jersey',
  'best-custom-soccer-jersey-makers-2026',
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

// ─── hreflang (cross-locale) configuration ──────────────────────────────────────
//
// Pages are deployed through OEMSaaS, where we only control the page body +
// meta_title/meta_descript — NOT the theme <head>. So in-page <link rel="alternate"
// hreflang> tags are not reliably available. The robust, fully-controllable method
// is hreflang annotations in the XML sitemap (Google/Bing treat these as equivalent
// to head tags). This file is the live sitemap source, so the cluster lives here.
//
// A cluster is only emitted when a page actually exists in ≥2 locales (verified
// against the handles fetched live from each CMS), so we never emit return-tag
// errors by pointing at pages that don't exist yet.

const LOCALES = ['en', 'es', 'fr', 'it'];

// ISO hreflang per locale. en is the international default; es/fr/it are
// region-targeted (Spain / France / Italy). x-default falls back to en.
const HREFLANG = { en: 'en', es: 'es-ES', fr: 'fr-FR', it: 'it-IT' };

// Curated cross-locale clusters for CMS /pages/{handle}. Handles confirmed from
// the per-locale deploy scripts (deploy-about-pages, deploy-request-design-page,
// deploy-kit-gallery-pages, deploy-comparison-pages, ready-to-play/config.json).
const STATIC_CLUSTERS = [
  { en: 'custom-kit-gallery',                  es: 'galeria-equipaciones-personalizadas', fr: 'galerie-maillots-foot-sur-mesure',           it: 'galleria-maglie-personalizzate' },
  { en: 'teams-clubs-momuto',                  es: 'equipos-momuto',                      fr: 'equipes-clubs-momuto',                       it: 'squadre-club-momuto' },
  { en: 'about-us',                            es: 'sobre-nosotros',                      fr: 'a-propos-de-nous',                           it: 'chi-siamo' },
  { en: 'request-custom-kit-design',           es: 'solicitud-de-diseno-personalizado',   fr: 'demande-de-design-professionnel-de-maillots', it: 'richiesta-design-personalizzato' },
  { en: 'momuto-vs-jersix-owayo-spized-comparison', es: 'zentral-opiniones-alternativa',  fr: 'comparatif-fournisseur-maillot-foot-2026',   it: 'confronto-fornitori-maglie-calcio-2026' },
  { en: 'ready-to-play',                       es: 'coleccion-ready-to-play',             fr: 'collection-ready-to-play',                   it: 'collezione-ready-to-play' },
];

// Programmatic clusters — handles share a locale-agnostic slug.
// Team pages: `{slug}-{suffix}` (suffix per locale, from generate-and-deploy.js).
const TEAM_SUFFIX = { en: 'custom-kit-design', es: 'diseno-equipacion', fr: 'design-maillot', it: 'design-maglia' };
// Ready-to-Play templates: `{prefix}{slug}` (from ready-to-play/config.json).
const RTP_PREFIX = { en: 'ready-to-play-', es: 'ready-to-play-', fr: 'maillot-', it: 'ready-to-play-' };

// Handles that belong to curated clusters — excluded from pattern detection so a
// page like `request-custom-kit-design` is never mis-read as a team page (slug
// "request", suffix "-custom-kit-design").
const CLUSTERED_HANDLES = new Set(STATIC_CLUSTERS.flatMap(c => LOCALES.map(l => c[l]).filter(Boolean)));

/**
 * Builds a Map from a page URL (loc) → array of hreflang alternates (incl. x-default).
 * @param {Object} handleSets  { [locale]: Set<handle> } of handles that exist live per locale.
 */
function buildAlternatesMap(handleSets) {
  const map = new Map();
  const pageLoc = (locale, handle) => `${DOMAINS[locale].baseUrl}/pages/${handle}`;
  const rootLoc = (locale, p) => `${DOMAINS[locale].baseUrl}${p}`;

  const register = (members) => {
    if (members.length < 2) return; // a single-locale cluster adds no SEO value
    const alts = members.map(m => ({ hreflang: HREFLANG[m.locale], href: m.loc }));
    const fallback = (members.find(m => m.locale === 'en') || members[0]).loc;
    const withDefault = [...alts, { hreflang: 'x-default', href: fallback }];
    for (const m of members) map.set(m.loc, withDefault);
  };

  // Site-wide same-path clusters — these exist on every locale.
  for (const p of ['/', '/collections', '/blogs']) {
    register(LOCALES.map(locale => ({ locale, loc: rootLoc(locale, p) })));
  }

  // Curated /pages clusters — include a locale only if the handle exists live there.
  for (const cluster of STATIC_CLUSTERS) {
    const members = LOCALES
      .filter(locale => cluster[locale] && handleSets[locale]?.has(cluster[locale]))
      .map(locale => ({ locale, loc: pageLoc(locale, cluster[locale]) }));
    register(members);
  }

  // Pattern-detected clusters (team pages + RTP templates), grouped by shared slug.
  const teams = new Map();  // slug → { [locale]: handle }
  const rtp = new Map();
  for (const locale of LOCALES) {
    const suffix = `-${TEAM_SUFFIX[locale]}`;
    const prefix = RTP_PREFIX[locale];
    for (const handle of (handleSets[locale] || [])) {
      if (CLUSTERED_HANDLES.has(handle)) continue;
      if (handle.endsWith(suffix)) {
        const slug = handle.slice(0, -suffix.length);
        if (slug) (teams.get(slug) || teams.set(slug, {}).get(slug))[locale] = handle;
      } else if (handle.startsWith(prefix)) {
        const slug = handle.slice(prefix.length);
        if (slug) (rtp.get(slug) || rtp.set(slug, {}).get(slug))[locale] = handle;
      }
    }
  }
  for (const byLocale of [...teams.values(), ...rtp.values()]) {
    register(Object.entries(byLocale).map(([locale, handle]) => ({ locale, loc: pageLoc(locale, handle) })));
  }

  return map;
}

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
  const urlBlocks = entries.map(e => {
    const alts = (e.alternates || [])
      .map(a => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}"/>`)
      .join('\n');
    return `  <url>\n    <loc>${e.loc}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>${alts ? '\n' + alts : ''}\n  </url>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n\n${urlBlocks}\n\n</urlset>\n`;
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

async function rebuildDomain(domain, fetched, alternatesMap) {
  const { pages, posts, products, collections } = fetched;
  console.log(`\n[${domain.label}] pages: ${pages.length}, posts: ${posts.length}, products: ${products.length}, collections: ${collections.length}`);

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

  // Attach hreflang alternates to any entry that belongs to a cross-locale cluster.
  let clustered = 0;
  for (const e of entries) {
    const alts = alternatesMap.get(e.loc);
    if (alts) { e.alternates = alts; clustered++; }
  }

  const xml = buildXml(entries);
  console.log(`  Built sitemap with ${entries.length} URLs (${clustered} with hreflang)`);

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

  // Pass 1: fetch all content from every locale up front, so we can build the
  // cross-locale hreflang clusters from handles that actually exist live.
  const fetched = {};
  const handleSets = {};
  for (const [locale, domain] of Object.entries(DOMAINS)) {
    if (!domain.token) {
      console.warn(`[${domain.label}] Skipping — token not set`);
      continue;
    }
    console.log(`[${domain.label}] Fetching content from CMS...`);
    const [pages, posts, products, collections] = await Promise.all([
      fetchAll(domain, 'pages'),
      fetchAll(domain, 'posts'),
      fetchAll(domain, 'products'),
      fetchAll(domain, 'collections'),
    ]);
    fetched[locale] = { pages, posts, products, collections };
    handleSets[locale] = new Set(pages.map(getSlug).filter(Boolean));
  }

  const alternatesMap = buildAlternatesMap(handleSets);
  console.log(`\nBuilt hreflang clusters covering ${alternatesMap.size} URL(s).`);

  // Pass 2: build + push each locale's sitemap with alternates attached.
  for (const [locale, domain] of Object.entries(DOMAINS)) {
    if (!fetched[locale]) continue;
    await rebuildDomain(domain, fetched[locale], alternatesMap);
  }

  console.log('\nDone.');
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { buildAlternatesMap, buildXml };
