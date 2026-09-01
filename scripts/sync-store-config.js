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
  // the Iconic Series collections were cloned to the US store (owner, 1 Sep 2026);
  // custom URLs, not type-2 album ids — the US collection ids differ from EN's
  item('Iconic Series', 2, 0, '', [
    item('Drop 01', 0, 6, '/collections/iconic-football-series'),
    item('Drop 02', 1, 6, '/collections/iconic-series-drop-02'),
  ]),
  item('Guides', 3, 0, '', [
    item('Custom soccer uniforms: the complete guide', 0, 6, '/blogs/custom-soccer-uniforms-for-your-team-complete-guide'),
    item('When to order: season calendar', 1, 6, '/blogs/when-to-order-team-uniforms-season-calendar'),
    item('All guides', 2, 14, '/blogs'),
  ]),
  item('Support', 4, 0, '', [
    // these three pages exist on the US store (confirmed via GET /navs, 1 Sep 2026)
    item('FAQ', 0, 6, '/pages/faq'),
    item('Printing & Materials', 1, 6, '/pages/printing'),
    item('Size guide', 2, 6, '/pages/size-guide'),
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

  // ── shipping (owner rulings 1 Sep 2026: threshold $59, fee $4.90 below it;
  //    the cloned "EMS via Royal Mail" zone becomes USPS) ────────────────────
  const THRESH = 59, FEE = 4.90;

  async function zoneDetails(token, id) {
    const { ok, json } = await api(token, 'GET', `/shippingzones/${id}`);
    if (!ok) throw new Error(`GET /shippingzones/${id}: ${JSON.stringify(json).slice(0, 300)}`);
    return json.data;
  }

  if (MODE === 'inspect-zones') {
    const store = (process.env.TARGET_STORE || 'us').toLowerCase();
    const token = TOKENS[store];
    if (!token) { console.error(`No token for "${store}"`); process.exit(1); }
    const { ok, json } = await api(token, 'GET', '/shippingzones?type=1');
    if (!ok) { console.error(JSON.stringify(json)); process.exit(1); }
    for (const z of json.data.shippingzones || []) {
      const det = await zoneDetails(token, z.id);
      const sz = det.shippingzone || {};
      const areas = Object.values(sz.areas || {}).map(a => `${a.country_code_2}:${a.country_name}`);
      console.log(`\n===== zone ${z.id} "${z.plan_name}" — ${areas.length} area(s) =====`);
      console.log('areas:', JSON.stringify(areas));
      console.log('plans (from list):', JSON.stringify(z.shippingZonePlan, null, 2));
      console.log('details product_list length:', (det.product_list || sz.product_list || []).length);
    }
    return;
  }

  if (MODE === 'apply-shipping') {
    const store = (process.env.TARGET_STORE || 'us').toLowerCase();
    if (store !== 'us') { console.error('apply-shipping is curated for the us store only'); process.exit(1); }
    const token = TOKENS[store];
    if (!token) { console.error('No us token'); process.exit(1); }

    const below = () => ({ rule: 'total_price', rule_min: 0, rule_max: THRESH, fee_method: 1, fee: FEE,
      module_rule: { module_logical_operator: 'and', module_rules: [
        { field: 'total_price', comparison_operator: 'egt', value: 0 },
        { field: 'total_price', comparison_operator: 'elt', value: THRESH } ] } });
    const above = () => ({ rule: 'total_price', rule_min: THRESH, fee_method: 1, fee: 0,
      module_rule: { module_logical_operator: 'and', module_rules: [
        { field: 'total_price', comparison_operator: 'egt', value: THRESH } ] } });

    const { ok, json } = await api(token, 'GET', '/shippingzones?type=1');
    if (!ok) { console.error(JSON.stringify(json)); process.exit(1); }
    for (const z of json.data.shippingzones || []) {
      const det = await zoneDetails(token, z.id);
      const sz = det.shippingzone || {};
      const areas = Object.values(sz.areas || {}).map(a => ({ country_id: a.id, provinces: [] }));
      let name = z.plan_name;
      let plans = (z.shippingZonePlan || []).map(p => ({
        id: p.id, store_id: p.store_id, shipping_zone_id: p.shipping_zone_id,
        plan_name: p.plan_name, descript: p.descript || '', param: p.param,
        created_at: p.created_at, updated_at: p.updated_at,
      }));

      if (z.plan_name === 'FREE EMS Shipping') {
        // the live checkout zone: retarget the converted $58.02/$4.53 to $59/$4.90
        for (const p of plans) {
          const paid = Number(p.param?.fee) > 0;
          p.param = paid ? below() : above();
          p.plan_name = 'Certified Courier | 25-30 Days Delivery';
        }
      } else if (z.plan_name === 'EMS via Royal Mail') {
        // clone leftover: carrier becomes USPS, claims align to the one set of numbers
        name = 'USPS';
        for (const p of plans) {
          p.plan_name = 'USPS | 25-30 Days Delivery';
          p.descript = 'Estimated delivery: 25-30 days';
        }
        // rules left untouched deliberately — see the run log for its area(s)
      } else {
        console.log(`  · zone ${z.id} "${z.plan_name}" — no curated change, skipped`);
        continue;
      }

      const payload = { name, type: z.type, areas,
        plan: plans.map((p, i) => ({ ...p, index: i })), product_ids: [] };
      console.log(`\nPUT /shippingzones/${z.id} (${areas.length} area(s)):`);
      console.log(JSON.stringify(payload, null, 2));
      if (DRY_RUN) { console.log('DRY_RUN — not sent.'); continue; }
      const res = await api(token, 'PUT', `/shippingzones/${z.id}`, payload);
      if (!res.ok) { console.error(`  ❌ ${JSON.stringify(res.json).slice(0, 300)}`); process.exit(1); }
      console.log(`  ✅ zone ${z.id} updated`);
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
