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
    // GSC 4 Sep 2026: the maker/creator cluster carries the volume — the
    // handle is the rebuilt "Soccer Jersey Maker" page (build-maker-pages.js)
    item('Jersey Maker — free 3D tool', 1, 6, '/pages/custom-soccer-jersey-designer'),
    item('Custom design request ($15)', 2, 6, '/pages/request-custom-kit-design'),
    item('AI concept to real jersey', 3, 6, '/pages/ai-concept-to-real-kit'),
  ]),
  item('Basketball', 1, 6, '/pages/custom-basketball-jerseys'),
  // the Iconic Series collections were cloned to the US store (owner, 1 Sep 2026);
  // custom URLs, not type-2 album ids — the US collection ids differ from EN's
  item('Iconic Series', 2, 0, '', [
    item('Drop 01', 0, 6, '/collections/iconic-football-series'),
    item('Drop 02', 1, 6, '/collections/iconic-series-drop-02'),
  ]),
  item('Support', 3, 0, '', [
    // these three pages exist on the US store (confirmed via GET /navs, 1 Sep 2026)
    item('FAQ', 0, 6, '/pages/faq'),
    item('Printing & Materials', 1, 6, '/pages/custom-football-kit-materials-printing'),
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
    const only = (process.env.TARGET_STORE || '').toLowerCase();
    for (const [store, token] of Object.entries(TOKENS)) {
      if (only && store !== only) continue;
      if (!token) { console.log(`[${store}] no token — skipped`); continue; }
      for (const t of [1, 2]) {
        const { ok, json } = await api(token, 'GET', `/shippingzones?type=${t}`);
        if (!ok) { console.error(`[${store}] type=${t}: ${JSON.stringify(json).slice(0, 200)}`); continue; }
        for (const z of json.data.shippingzones || []) {
          const det = await zoneDetails(token, z.id);
          const sz = det.shippingzone || {};
          const areas = Object.values(sz.areas || {}).map(a => `${a.country_code_2}:${a.country_name}`);
          const KEY = ['US', 'GB', 'FR', 'ES', 'IT', 'DE', 'IC', 'CA'];
          const keyHits = areas.filter(a => KEY.includes(a.split(':')[0]));
          console.log(`\n===== [${store}] zone ${z.id} "${z.plan_name}" (type ${t}) — ${areas.length} area(s) =====`);
          console.log(areas.length <= 12 ? `areas: ${JSON.stringify(areas)}`
            : `areas: [${areas.length} — elided] key countries present: ${JSON.stringify(keyHits)}`);
          for (const p of z.shippingZonePlan || []) {
            console.log(`  plan ${p.id} "${p.plan_name}" desc="${p.descript}" rule=${p.param?.rule} min=${p.param?.rule_min ?? ''} max=${p.param?.rule_max ?? ''} fee_method=${p.param?.fee_method} fee=${p.param?.fee} first_w=${p.param?.first_weight_fee ?? ''} status=${p.status}`);
          }
          console.log(`  bound products: ${(det.product_list || sz.product_list || []).length}`);
        }
      }
    }
    return;
  }

  if (MODE === 'apply-shipping') {
    // Owner rulings 1 Sep 2026: US $59 threshold / $4.90 fee; EU stores €50 / €3.90
    // everywhere; FR carrier Colis Privé; ES carrier CTT Express (Correos for the
    // Canary Islands); UK zones aligned to the same fee+threshold; all claims 25-30 days.
    const store = (process.env.TARGET_STORE || 'us').toLowerCase();
    const token = TOKENS[store];
    if (!token) { console.error(`No token for "${store}"`); process.exit(1); }

    const belowT = (t, f) => ({ rule: 'total_price', rule_min: 0, rule_max: t, fee_method: 1, fee: f,
      module_rule: { module_logical_operator: 'and', module_rules: [
        { field: 'total_price', comparison_operator: 'egt', value: 0 },
        { field: 'total_price', comparison_operator: 'elt', value: t } ] } });
    const aboveT = (t) => ({ rule: 'total_price', rule_min: t, fee_method: 1, fee: 0,
      module_rule: { module_logical_operator: 'and', module_rules: [
        { field: 'total_price', comparison_operator: 'egt', value: t } ] } });

    const listZones = async () => {
      const { ok, json } = await api(token, 'GET', '/shippingzones?type=1');
      if (!ok) { console.error(JSON.stringify(json)); process.exit(1); }
      return json.data.shippingzones || [];
    };
    const areasOf = async (id) => Object.values(((await zoneDetails(token, id)).shippingzone || {}).areas || {});
    const twoPlans = (z, name, descBelow, descAbove, t, f) => {
      const ids = (z.shippingZonePlan || []).map(p => p.id);
      const proto = { store_id: z.store_id, shipping_zone_id: z.id, created_at: 0, updated_at: 0 };
      return [
        { ...proto, id: ids[0] ?? 0, plan_name: name, descript: descBelow, param: belowT(t, f), index: 0 },
        { ...proto, id: ids[1] ?? 0, plan_name: name, descript: descAbove, param: aboveT(t), index: 1 },
      ];
    };
    const putZone = async (z, name, plans, areaList) => {
      const payload = { name, type: z.type, areas: areaList.map(a => ({ country_id: a.id, provinces: [] })),
        plan: plans, product_ids: [] };
      console.log(`\nPUT /shippingzones/${z.id} "${name}" (${areaList.length} areas) plans: ${plans.map(p => `[${p.param.rule_min}..${p.param.rule_max ?? '∞'} → ${p.param.fee}] "${p.plan_name}"`).join('  ')}`);
      if (DRY_RUN) { console.log('  DRY_RUN — not sent.'); return true; }
      const res = await api(token, 'PUT', `/shippingzones/${z.id}`, payload);
      if (!res.ok) { console.error(`  ❌ ${JSON.stringify(res.json).slice(0, 300)}`); return false; }
      console.log('  ✅ updated'); return true;
    };
    const postZone = async (name, areaIds, planName, descBelow, descAbove, t, f) => {
      const payload = { name, type: 1, areas: areaIds.map(id => ({ country_id: id, provinces: [] })),
        plan: [
          { plan_name: planName, descript: descBelow, param: belowT(t, f) },
          { plan_name: planName, descript: descAbove, param: aboveT(t) },
        ], product_ids: [] };
      console.log(`\nPOST /shippingzones "${name}" areas=${JSON.stringify(areaIds)} plans [0..${t} → ${f}] [${t}..∞ → 0] "${planName}"`);
      if (DRY_RUN) { console.log('  DRY_RUN — not sent.'); return true; }
      const res = await api(token, 'POST', '/shippingzones', payload);
      if (!res.ok) { console.error(`  ❌ ${JSON.stringify(res.json).slice(0, 300)}`); return false; }
      console.log(`  ✅ created (id ${res.json.data?.shippingzone?.id})`); return true;
    };

    const T_EU = 50, F_EU = 3.9;
    const zones = await listZones();
    const byName = (...names) => zones.find(z => names.includes(z.plan_name));

    if (store === 'us') {
      const usps = byName('EMS via Royal Mail', 'USPS');
      const world = byName('FREE EMS Shipping');
      let uspsOk = false;
      if (usps) uspsOk = await putZone(usps, 'USPS',
        twoPlans(usps, 'USPS | 25-30 Days Delivery', 'Estimated delivery: 25-30 days', 'Estimated delivery: 25-30 days', 59, 4.9),
        [{ id: 229 }]); // United States
      if (world) {
        const wAreas = (await areasOf(world.id)).filter(a => !(uspsOk && a.country_code_2 === 'US'));
        await putZone(world, world.plan_name,
          twoPlans(world, 'Certified Courier | 25-30 Days Delivery', '', '', 59, 4.9), wAreas);
      }
    } else if (store === 'en' || store === 'it') {
      const wName = store === 'en' ? 'Certified Courier | 25-30 Days Delivery' : 'Corriere certificato | Consegna in 25-30 giorni';
      const dB = store === 'en' ? 'Estimated delivery: 25-30 days' : 'Consegna stimata: 25-30 giorni';
      const dA = store === 'en' ? 'FREE - Estimated delivery: 25-30 days' : 'GRATIS - Consegna stimata: 25-30 giorni';
      const gb = byName('EMS via Royal Mail', 'Royal Mail');
      if (gb) await putZone(gb, 'Royal Mail',
        twoPlans(gb, 'Royal Mail | 25-30 Days Delivery', 'Estimated delivery: 25-30 days', 'FREE - Estimated delivery: 25-30 days', T_EU, F_EU),
        await areasOf(gb.id));
      const world = byName('FREE EMS Shipping');
      if (world) await putZone(world, world.plan_name, twoPlans(world, wName, dB, dA, T_EU, F_EU), await areasOf(world.id));
    } else if (store === 'fr') {
      const world = byName('LIVRAISON GRATUITE');
      if (!world) { console.error('zone "LIVRAISON GRATUITE" introuvable'); process.exit(1); }
      await putZone(world, world.plan_name,
        twoPlans(world, 'Colis Privé | Livraison 25-30 jours', 'Gratuit dès 50€.', 'GRATUIT - Livraison estimée : 25-30 jours', T_EU, F_EU),
        await areasOf(world.id));
    } else if (store === 'es') {
      const world = byName('Envío certificado');
      if (!world) { console.error('zona "Envío certificado" no encontrada'); process.exit(1); }
      const all = await areasOf(world.id);
      const es = all.find(a => a.country_code_2 === 'ES');
      const ic = all.find(a => a.country_code_2 === 'IC');
      const worldPlans = () => twoPlans(world, 'Envío certificado (25-30 días)', 'Gratis desde 50€.', 'GRATIS 🎁', T_EU, F_EU);
      // Type-1 zones may not overlap areas ("数据已存在"), so the countries must
      // LEAVE the worldwide zone before their carrier zones can be created.
      const carve = all.filter(a => a.country_code_2 !== 'ES' && a.country_code_2 !== 'IC');
      const shrunk = await putZone(world, world.plan_name, worldPlans(), carve);
      if (!shrunk) { console.error('worldwide shrink failed — carrier zones not attempted'); process.exit(1); }
      let ok1 = !!byName('CTT Express'), ok2 = !!byName('Correos');
      if (es && !ok1) ok1 = await postZone('CTT Express', [es.id], 'CTT Express (25-30 días)', 'Gratis desde 50€.', 'GRATIS 🎁', T_EU, F_EU);
      if (ic && !ok2) ok2 = await postZone('Correos', [ic.id], 'Correos (25-30 días)', 'Gratis desde 50€.', 'GRATIS 🎁', T_EU, F_EU);
      // rollback: any country whose carrier zone failed goes back into the worldwide zone
      const back = all.filter(a => !(ok1 && a.country_code_2 === 'ES') && !(ok2 && a.country_code_2 === 'IC'));
      if (back.length !== carve.length) {
        console.log('rolling uncovered countries back into the worldwide zone…');
        await putZone(world, world.plan_name, worldPlans(), back);
      }
    } else { console.error(`no curated shipping for "${store}"`); process.exit(1); }
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

  const MENUS = { us: US_MENU_CHILDREN };
  const children = MENUS[store];
  if (!children) { console.error(`No curated menu for store "${store}" — apply-nav would overwrite its header with another store's tree. Curate one in MENUS first.`); process.exit(1); }

  const payload = {
    navs: [{
      nav_name: navName,                    // same name → vendor-documented overwrite
      type: existing.type ?? 0,
      nav_admin_id: existing.nav_admin_id ?? 0,
      children,
    }],
  };

  console.log(`Overwriting menu "${navName}" on ${store} with ${children.length} top-level item(s):`);
  console.log(JSON.stringify(payload, null, 2));
  if (DRY_RUN) { console.log('\nDRY_RUN — nothing posted.'); return; }

  const res = await api(token, 'POST', '/navs', payload);
  if (!res.ok) { console.error(`POST /navs failed: ${JSON.stringify(res.json).slice(0, 400)}`); process.exit(1); }
  console.log('✅ menu updated — verify in the storefront header.');
}

main().catch(err => { console.error(err); process.exit(1); });
