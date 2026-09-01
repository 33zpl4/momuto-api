'use strict';

/**
 * Store navigation via the OpenAPI /navs endpoints (found in the vendor's
 * Apizza docs, 1 Sep 2026 — previously assumed admin-only):
 *   GET  /navs  — list menus (id, nav_name, children tree up to 3 levels)
 *   POST /navs  — update; a menu whose nav_name matches an existing one is
 *                 OVERWRITTEN (vendor: "Duplicate menu names will be
 *                 overwritten"), so posting one menu upserts that menu.
 *
 * url_json.type map (vendor doc): 0 none · 1 homepage · 5 custom page ·
 * 6 custom URL · 14 blog list … — we use 6 (custom URL) with root-relative
 * paths for everything except the homepage (1) and blog list (14): it works
 * for every target and never depends on internal ids.
 *
 * Modes (MODE env):
 *   inspect (default) — GET /navs for every store with a token and print
 *                       the full JSON. ALWAYS run this before the first
 *                       apply on a store: the payload we post is shaped
 *                       from what the platform actually returns.
 *   apply             — overwrite ONE menu (TARGET_NAV_NAME) on ONE store
 *                       (TARGET_STORE) with the curated US menu below.
 *                       Refuses if the store's /navs doesn't contain a menu
 *                       with that exact name (no accidental extra menus).
 *
 * Env: OEMSAAS_TOKEN_{EN,ES,FR,IT,US}, MODE, TARGET_STORE, TARGET_NAV_NAME,
 *      DRY_RUN (apply only; default true — print the payload, POST nothing)
 */

const HOST = 'https://openapi.oemapps.com';
const TOKENS = {
  en: process.env.OEMSAAS_TOKEN_EN,
  es: process.env.OEMSAAS_TOKEN_ES,
  fr: process.env.OEMSAAS_TOKEN_FR,
  it: process.env.OEMSAAS_TOKEN_IT,
  us: process.env.OEMSAAS_TOKEN_US,
};
const MODE = (process.env.MODE || 'inspect').toLowerCase();
const DRY_RUN = process.env.DRY_RUN !== 'false';

async function api(token, method, endpoint, body) {
  const res = await fetch(`${HOST}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json', token },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && json.code === 0, json };
}

// ── The curated US main menu ─────────────────────────────────────────────────
// setting_json defaults mirror what GET /navs returns for vanilla items.
const S = { open: '', model: 1, seo: '', color: '', style: '', bold: '', decoration: '' };
const item = (name, position, urlType, url, children = []) => ({
  nav_item_name: name,
  position,
  url_json: { source_id: '', title: name, type: urlType, url },
  setting_json: S,
  src: '',
  children,
});

const US_MENU_CHILDREN = [
  item('Custom Jerseys', 0, 0, '', [
    item('Ready to Play — 3D designer', 0, 6, '/pages/ready-to-play'),
    item('Custom design request ($15)', 1, 6, '/pages/request-custom-kit-design'),
    item('AI concept to real jersey', 2, 6, '/pages/ai-concept-to-real-kit'),
  ]),
  item('Basketball', 1, 6, '/pages/custom-basketball-jerseys'),
  item('Guides', 2, 0, '', [
    item('Custom soccer uniforms: the complete guide', 0, 6, '/blogs/custom-soccer-uniforms-for-your-team-complete-guide'),
    item('When to order: season calendar', 1, 6, '/blogs/when-to-order-team-uniforms-season-calendar'),
    item('All guides', 2, 14, '/blogs'),
  ]),
  item('Support', 3, 0, '', [
    item('Size guide', 0, 6, '/pages/size-guide'),
    item('Contact', 1, 6, '/pages/contact'),
  ]),
];

// Curated homepage SEO per store (PUT /seoplans). meta_keywords is an array
// (same CMS rule as pages). Only stores listed here can be applied.
const HOMEPAGE_SEO = {
  us: {
    meta_title: 'Custom Soccer Jerseys & Uniforms — Free 3D Designer | MOMUTO',
    meta_descript: 'Design custom soccer jerseys and team uniforms in a free 3D designer. No minimum order, from $25.90/jersey at 10+, delivered across the US in 25-30 days.',
    meta_keywords: ['custom soccer jerseys', 'custom soccer uniforms', 'soccer jersey maker', '3d soccer jersey designer', 'custom basketball jerseys', 'MOMUTO'],
  },
};

async function main() {
  if (MODE === 'inspect') {
    // Menus + logistics in one read-only sweep (endpoints from the vendor's
    // Apizza docs, 1 Sep 2026 — recorded in docs/oemsaas-api-notes.md).
    const READS = ['/navs', '/seoplans', '/shippingzones?type=1', '/shippingzones?type=2', '/couriers'];
    for (const [store, token] of Object.entries(TOKENS)) {
      if (!token) { console.log(`[${store}] no token — skipped`); continue; }
      for (const ep of READS) {
        const { ok, json } = await api(token, 'GET', ep);
        console.log(`\n===== [${store}] GET ${ep} ${ok ? '' : '(ERROR)'} =====`);
        // couriers is a huge static list — count it instead of dumping it
        if (ep === '/couriers' && ok) { console.log(`(${(json.data || []).length} couriers — list elided)`); continue; }
        console.log(JSON.stringify(json, null, 2));
      }
    }
    return;
  }

  if (MODE === 'apply-seo') {
    const store = (process.env.TARGET_STORE || 'us').toLowerCase();
    const token = TOKENS[store];
    if (!token) { console.error(`No token for store "${store}"`); process.exit(1); }
    const seo = HOMEPAGE_SEO[store];
    if (!seo) { console.error(`No curated homepage SEO for "${store}" — add it to HOMEPAGE_SEO first`); process.exit(1); }
    if (seo.meta_title.length > 65 || seo.meta_descript.length > 160) { console.error('meta length breach'); process.exit(1); }
    const cur = await api(token, 'GET', '/seoplans');
    console.log(`Current homepage SEO on ${store}: ${JSON.stringify(cur.json.data)}`);
    console.log(`New: ${JSON.stringify(seo)}`);
    if (DRY_RUN) { console.log('DRY_RUN — nothing written.'); return; }
    const res = await api(token, 'PUT', '/seoplans', seo);
    if (!res.ok) { console.error(`PUT /seoplans failed: ${JSON.stringify(res.json).slice(0, 300)}`); process.exit(1); }
    console.log('✅ homepage SEO updated.');
    return;
  }

  if (MODE !== 'apply-nav') { console.error(`Unknown MODE "${MODE}" — inspect | apply-nav | apply-seo`); process.exit(1); }

  const store = (process.env.TARGET_STORE || 'us').toLowerCase();
  const navName = process.env.TARGET_NAV_NAME || '';
  const token = TOKENS[store];
  if (!token) { console.error(`No token for store "${store}"`); process.exit(1); }
  if (!navName) { console.error('TARGET_NAV_NAME required for apply (run inspect to see the store\'s menu names)'); process.exit(1); }

  const { ok, json } = await api(token, 'GET', '/navs');
  if (!ok) { console.error(`GET /navs failed: ${JSON.stringify(json).slice(0, 300)}`); process.exit(1); }
  const menus = json.data || [];
  const existing = menus.find(m => m.nav_name === navName);
  if (!existing) {
    console.error(`Menu "${navName}" not found on ${store} — menus there: ${menus.map(m => JSON.stringify(m.nav_name)).join(', ')}. Refusing to create a new menu (the theme binds by menu, so an extra menu would be invisible).`);
    process.exit(1);
  }

  const payload = {
    navs: [{
      nav_name: navName,                    // same name → vendor-documented overwrite
      type: existing.type ?? 0,
      nav_admin_id: existing.nav_admin_id ?? 0,
      children: US_MENU_CHILDREN,
    }],
  };

  console.log(`Overwriting menu "${navName}" on ${store} with ${US_MENU_CHILDREN.length} top-level item(s):`);
  console.log(JSON.stringify(payload, null, 2));
  if (DRY_RUN) { console.log('\nDRY_RUN — nothing posted.'); return; }

  const res = await api(token, 'POST', '/navs', payload);
  if (!res.ok) { console.error(`POST /navs failed: ${JSON.stringify(res.json).slice(0, 400)}`); process.exit(1); }
  console.log('✅ menu updated — verify in the storefront header.');
}

main().catch(err => { console.error(err); process.exit(1); });
