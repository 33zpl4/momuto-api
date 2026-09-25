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
  // US store — inert until OEMSAAS_TOKEN_US is provisioned (token check below
  // skips it), then joins the daily rebuild and the hreflang clusters.
  us: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_US,
    label: 'us.momuto.com',
    baseUrl: 'https://us.momuto.com',
  },
};

// Pages that deserve higher priority in the sitemap
const HIGH_PRIORITY_HANDLES = new Set([
  'custom-kit-gallery',
  'custom-soccer-jerseys',
  'custom-youth-club-soccer-uniforms',
  'design-your-own-soccer-jersey',
  'best-custom-soccer-jersey-makers-2026',
  'maillot-foot-personnalise',
  'creer-son-maillot-de-foot',
  'equipaciones-futbol-personalizadas',
  'equipaciones-para-clubes-academias',
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

const LOCALES = ['en', 'es', 'fr', 'it', 'us'];

// ISO hreflang per locale. en is the international default; es/fr/it are
// region-targeted (Spain / France / Italy); us is US English. x-default
// falls back to en (www stays the international default).
const HREFLANG = { en: 'en', es: 'es-ES', fr: 'fr-FR', it: 'it-IT', us: 'en-US' };

// Curated cross-locale clusters for CMS /pages/{handle}. Handles confirmed from
// the per-locale deploy scripts (deploy-about-pages, deploy-request-design-page,
// deploy-kit-gallery-pages, deploy-comparison-pages, ready-to-play/config.json).
const STATIC_CLUSTERS = [
  { en: 'custom-kit-gallery',                  es: 'galeria-equipaciones-personalizadas', fr: 'galerie-maillots-foot-sur-mesure',           it: 'galleria-maglie-personalizzate' },
  { en: 'teams-clubs-momuto',                  es: 'equipos-momuto',                      fr: 'equipes-clubs-momuto',                       it: 'squadre-club-momuto' },
  { en: 'about-us',                            es: 'sobre-nosotros',                      fr: 'a-propos-de-nous',                           it: 'chi-siamo' },
  { en: 'request-custom-kit-design',           es: 'solicitud-de-diseno-personalizado',   fr: 'demande-de-design-professionnel-de-maillots', it: 'richiesta-design-personalizzato', us: 'request-custom-kit-design' },
  { en: 'momuto-vs-jersix-owayo-spized-comparison', es: 'zentral-opiniones-alternativa',  fr: 'comparatif-fournisseur-maillot-foot-2026',   it: 'confronto-fornitori-maglie-calcio-2026' },
  { en: 'ready-to-play',                       es: 'coleccion-ready-to-play',             fr: 'collection-ready-to-play',                   it: 'collezione-ready-to-play', us: 'ready-to-play' },
  // Added 25 Sep 2026 (docs/seo-opportunities-2026-09.md §1): the translated
  // pages that had no cross-locale annotation at all. Generated pages first
  // (faq/, policies/, maker/ — handles from those JSON sources).
  { en: 'faq',                                 es: 'preguntas-frecuentes',                fr: 'questions-frequentes',                       it: 'faq',                     us: 'faq' },
  { en: 'shipping-policy',                     es: 'envios-metodos-y-plazos',             fr: 'politique-de-livraison',                     it: 'politica-di-spedizione',  us: 'shipping-policy' },
  { en: 'return-policy',                       es: 'cambios-devoluciones',                fr: 'retours-echanges',                           it: 'politica-resi',           us: 'return-policy' },
  { en: 'contact',                             es: 'contacto',                            fr: 'contactez-nous',                             it: 'contattaci',              us: 'contact' },
  { en: 'custom-soccer-jersey-designer',                                                  fr: 'creer-son-maillot-de-foot',                                                 us: 'custom-soccer-jersey-designer' },
  { en: 'ai-concept-to-real-kit',              es: 'camiseta-ia-concepto-real',           fr: 'maillot-ia-concept-reel',                    it: 'maglia-ia-concetto-reale', us: 'ai-concept-to-real-kit' },
  { en: 'bachelor-party-football-shirts',      es: 'camisetas-despedida-de-soltero',      fr: 'maillot-evg-personnalise',                                                  us: 'bachelor-party-football-shirts' },
  // Custom-kit hubs (www soccer hub ↔ ES equipaciones hub ↔ FR personnalisé hub).
  { en: 'custom-soccer-jerseys',               es: 'equipaciones-futbol-personalizadas',  fr: 'maillot-foot-personnalise',                                                 us: 'custom-soccer-jerseys' },
  { en: 'custom-youth-club-soccer-uniforms',   es: 'equipaciones-para-clubes-academias',                                                                                   us: 'custom-youth-club-soccer-uniforms' },
];

// Curated cross-locale clusters for BLOG POSTS (/blogs/{handle}). The en/us
// rows started as the US mirror of the EN team-kits hub (docs/us-hub-plan.md);
// es/fr/it translations were added 25 Sep 2026. A locale is only emitted when
// the post exists live on that store. Market-specific comparison posts are
// deliberately NOT clustered — they review different competitor sets, so they
// are not translations of each other.
const BLOG_CLUSTERS = [
  { en: 'custom-football-kits-for-your-team-complete-guide', us: 'custom-soccer-uniforms-for-your-team-complete-guide', es: 'equipaciones-de-futbol-para-tu-equipo-guia-completa', fr: 'maillots-de-foot-pour-club-guide-complet', it: 'maglie-da-calcio-per-la-tua-squadra-guida-completa' },
  { en: 'custom-football-kits-amateur-grassroots-club',      us: 'custom-soccer-uniforms-club-team',            es: 'equipaciones-futbol-club-amateur',        fr: 'maillots-foot-club-amateur',        it: 'maglie-calcio-squadra-dilettantistica' },
  { en: 'custom-futsal-5-a-side-jerseys',                    us: 'custom-futsal-indoor-soccer-jerseys',         es: 'camisetas-futbol-sala-personalizadas',    fr: 'maillots-five-futsal-personnalises', it: 'maglie-calcetto-futsal-personalizzate' },
  { en: 'custom-jerseys-7-a-side-sunday-league',             us: 'custom-soccer-jerseys-adult-rec-league',      es: 'equipaciones-futbol-7-ligas-locales',     fr: 'maillots-foot-loisir-district',     it: 'maglie-calcio-a-7-leghe-locali' },
  { en: 'custom-football-kits-corporate-events',             us: 'custom-soccer-jerseys-corporate-events',      es: 'equipaciones-futbol-empresas',            fr: 'maillots-foot-entreprise',          it: 'maglie-calcio-aziende' },
  { en: 'custom-jerseys-football-tournaments',               us: 'custom-soccer-jerseys-tournaments',           es: 'camisetas-futbol-torneos',                fr: 'maillots-foot-tournoi',             it: 'maglie-calcio-tornei' },
  { en: 'when-to-order-team-kits-season-calendar',           us: 'when-to-order-team-uniforms-season-calendar', es: 'cuando-encargar-equipaciones-equipo',     fr: 'quand-commander-maillots-equipe',   it: 'quando-ordinare-maglie-squadra' },
  { en: 'fund-team-kits-sponsors-fundraising',               us: 'fund-team-uniforms-sponsors-fundraising',     es: 'financiar-equipaciones-club-patrocinadores', fr: 'financer-maillots-club-sponsors-cagnotte', it: 'finanziare-maglie-squadra-sponsor' },
  // Wave 1 thesis piece — same handle on en/us.
  { en: 'the-slowest-part-of-making-a-football-kit',         us: 'the-slowest-part-of-making-a-football-kit',   es: 'lo-mas-lento-de-hacer-una-camiseta-de-futbol', fr: 'la-partie-la-plus-lente-d-un-maillot-de-foot', it: 'la-parte-piu-lenta-di-una-maglia-da-calcio' },
  // Evergreen translations of the same article.
  { en: 'how-to-create-the-perfect-football-kit-colour-guide', us: 'how-to-create-the-perfect-football-kit-colour-guide', es: 'como-crear-la-camiseta-de-futbol-ideal-guia-de-colores', fr: 'comment-creer-le-maillot-de-football-ideal-guide-des-couleurs', it: 'guida-colori-kit-calcio-personalizzato' },
  { en: 'concept-football-kits-the-art-history-and-future-of-fan-created-jerseys', us: 'concept-football-kits-the-art-history-and-future-of-fan-created-jerseys', es: 'el-arte-de-los-conceptos-de-camisetas-como-los-aficionados-reinventan-el-futbol', fr: 'l-art-des-concepts-de-maillots-comment-les-fans-reinventent-le-football', it: 'maglie-calcio-concept-arte-storia-futuro' },
  { en: 'ai-to-reality-kit-maker-guide',                     us: 'ai-to-reality-kit-maker-guide',               es: 'diseno-camisetas-chatgpt-ia-realidad',    fr: 'creer-maillot-foot-ia-chatgpt-gemini', it: 'creare-kit-calcio-con-intelligenza-artificiale' },
  { en: 'why-create-a-football-kit-for-your-club-with-the-momuto-3d-configurator', us: 'why-create-a-football-kit-for-your-club-with-the-momuto-3d-configurator', es: 'por-que-crear-una-camiseta-de-futbol-para-club-con-el-configurador-3d-momuto', fr: 'pourquoi-creer-un-maillot-de-foot-pour-club-avec-le-configurateur-3d-momuto', it: 'divisa-calcio-personalizzata-club-configuratore-3d' },
  { en: 'craft-your-perfect-custom-soccer-jersey-with-momuto-s-3d-configurator-guide', es: 'crea-tu-camiseta-de-futbol-unica-con-el-configurador-3d-momuto', fr: 'creez-votre-maillot-de-football-unique-avec-le-configurateur-3d-momuto', it: 'crea-maglia-calcio-personalizzata-configuratore-3d' },
  { en: 'why-personalize-your-football-kit-and-how-to-do-it', us: 'why-personalize-your-football-kit-and-how-to-do-it', es: 'por-que-personalizar-tu-camiseta-de-futbol-y-como-hacerlo', fr: 'pourquoi-customiser-votre-maillot-de-foot-et-comment-le-faire', it: 'perche-personalizzare-il-kit-da-calcio-e-come-farlo' },
  { en: 'why-you-should-choose-customizable-football-team-kits', us: 'why-you-should-choose-customizable-football-team-kits', es: 'flexibilidad-equipamientos-de-futbol-personalizables', fr: 'l-incroyable-flexibilite-des-kits-d-equipe-de-foot-personnalisables', it: 'divise-da-calcio-personalizzate-perche-scegliere-momuto' },
  { en: 'high-quality-soccer-kits',                          us: 'high-quality-soccer-kits',                    es: 'camisetas-futbol-premium-materiales-tecnicas', fr: 'qualite-maillot-football',        it: 'kit-calcio-alta-qualita-tessuti-tecniche' },
];

// Programmatic clusters — handles share a locale-agnostic slug.
// Team pages: `{slug}-{suffix}` (suffix per locale, from generate-and-deploy.js).
const TEAM_SUFFIX = { en: 'custom-kit-design', es: 'diseno-equipacion', fr: 'design-maillot', it: 'design-maglia', us: 'custom-kit-design' };
// Ready-to-Play templates: `{prefix}{slug}` (from ready-to-play/config.json).
const RTP_PREFIX = { en: 'ready-to-play-', es: 'ready-to-play-', fr: 'maillot-', it: 'ready-to-play-', us: 'ready-to-play-' };

// Handles that belong to curated clusters — excluded from pattern detection so a
// page like `request-custom-kit-design` is never mis-read as a team page (slug
// "request", suffix "-custom-kit-design").
const CLUSTERED_HANDLES = new Set(STATIC_CLUSTERS.flatMap(c => LOCALES.map(l => c[l]).filter(Boolean)));

/**
 * Builds a Map from a page URL (loc) → array of hreflang alternates (incl. x-default).
 * @param {Object} handleSets  { [locale]: Set<handle> } of page handles that exist live per locale.
 * @param {Object} postSets    { [locale]: Set<handle> } of blog-post handles that exist live per locale.
 */
function buildAlternatesMap(handleSets, postSets = {}) {
  const map = new Map();
  const pageLoc = (locale, handle) => `${DOMAINS[locale].baseUrl}/pages/${handle}`;
  const postLoc = (locale, handle) => `${DOMAINS[locale].baseUrl}/blogs/${handle}`;
  const rootLoc = (locale, p) => `${DOMAINS[locale].baseUrl}${p}`;
  // Locales actually fetched this run (token present) — a store we could not
  // see must never be referenced as an alternate.
  const liveLocales = LOCALES.filter(l => handleSets[l]);

  const register = (members) => {
    if (members.length < 2) return; // a single-locale cluster adds no SEO value
    const alts = members.map(m => ({ hreflang: HREFLANG[m.locale], href: m.loc }));
    // A URL in two clusters would get two conflicting alternate sets (the
    // second silently overwriting the first → return-tag errors). Keep the
    // first cluster, drop the later one, and say so in the run log.
    const dup = members.find(m => map.has(m.loc));
    if (dup) {
      console.warn(`  ⚠️  hreflang: ${dup.loc} already clustered — skipping cluster [${members.map(m => m.locale).join(',')}]`);
      return;
    }
    const fallback = (members.find(m => m.locale === 'en') || members[0]).loc;
    const withDefault = [...alts, { hreflang: 'x-default', href: fallback }];
    for (const m of members) map.set(m.loc, withDefault);
  };

  // Site-wide same-path clusters — these exist on every live locale.
  for (const p of ['/', '/collections', '/blogs']) {
    register(liveLocales.map(locale => ({ locale, loc: rootLoc(locale, p) })));
  }

  // Curated blog-post clusters (EN ↔ US mirror) — include a locale only if
  // the post exists live there.
  for (const cluster of BLOG_CLUSTERS) {
    const members = LOCALES
      .filter(locale => cluster[locale] && postSets[locale]?.has(cluster[locale]))
      .map(locale => ({ locale, loc: postLoc(locale, cluster[locale]) }));
    register(members);
  }

  // Curated /pages clusters — include a locale only if the handle exists live there.
  for (const cluster of STATIC_CLUSTERS) {
    const members = LOCALES
      .filter(locale => cluster[locale] && handleSets[locale]?.has(cluster[locale]))
      .map(locale => ({ locale, loc: pageLoc(locale, cluster[locale]) }));
    register(members);
  }

  // Same-handle EN ↔ US mirrors — the US store was cloned wholesale from www
  // (Sep 2026), so any page or post whose handle exists on both stores and is
  // not already clustered above is the same document in two lexicons.
  if (handleSets.en && handleSets.us) {
    for (const handle of handleSets.us) {
      if (!handleSets.en.has(handle)) continue;
      const loc = pageLoc('us', handle);
      if (map.has(loc) || map.has(pageLoc('en', handle))) continue;
      register([{ locale: 'en', loc: pageLoc('en', handle) }, { locale: 'us', loc }]);
    }
  }
  if (postSets.en && postSets.us) {
    for (const handle of postSets.us) {
      if (!postSets.en.has(handle)) continue;
      const loc = postLoc('us', handle);
      if (map.has(loc) || map.has(postLoc('en', handle))) continue;
      register([{ locale: 'en', loc: postLoc('en', handle) }, { locale: 'us', loc }]);
    }
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
  // Per-order "3d-preview" products (created at checkout so the platform cart
  // shows the customer's actual design) must NEVER reach the sitemap: they are
  // unpolished customer designs and thin near-duplicate pages. Tagged via
  // inner_title at creation; title-prefix match is the fallback net.
  let skippedPreviews = 0;
  const PREVIEW_TITLE = /^(Your custom design|Votre design personnalisé|Tu diseño personalizado|Il tuo design personalizzato)\b/;
  for (const p of products) {
    const slug = getSlug(p);
    if (!slug) continue;
    const inner = String(p.inner_title || '');
    if (inner.includes('3d-preview') || PREVIEW_TITLE.test(String(p.title || ''))) { skippedPreviews++; continue; }
    entries.push({ loc: `${domain.baseUrl}/products/${slug}`, lastmod: getLastmod(p, today), changefreq: 'monthly', priority: '0.8' });
  }
  if (skippedPreviews) console.log(`  (excluded ${skippedPreviews} 3d-preview order products from sitemap)`);

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
  const postSets = {};
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
    postSets[locale] = new Set(posts.map(getSlug).filter(Boolean));
  }

  const alternatesMap = buildAlternatesMap(handleSets, postSets);
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
