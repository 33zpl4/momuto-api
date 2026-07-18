'use strict';

/**
 * Unpublish (or delete) stale per-order "3d-preview" products on the stores.
 *
 * GoodInfoAction::createPreviewProduct publishes one product per 3D checkout
 * so the platform cart / CMS order / platform emails show the customer's real
 * design. They only need to exist from checkout until the platform copies the
 * images into the order line — after that they are unpolished customer
 * designs sitting live on /products/... . This script sweeps them.
 *
 * Selection: inner_title contains "3d-preview" OR title starts with the
 * per-locale "Your custom design" prefix, AND older than AGE_DAYS.
 *
 * Action: PUT /products/:id { status: 0 } (unpublish — reversible). Set
 * MODE=delete to hard-delete instead once unpublish is proven safe.
 *
 * Env:
 *   OEMSAAS_TOKEN_EN / _FR / _ES   store tokens (locale skipped if missing)
 *   DRY_RUN=true                   list what would change, write nothing (default true)
 *   AGE_DAYS=3                     minimum age before sweeping
 *   MODE=unpublish|delete          default unpublish
 */

const HOST = 'https://openapi.oemapps.com';
const DRY_RUN = process.env.DRY_RUN !== 'false';
const AGE_DAYS = parseInt(process.env.AGE_DAYS || '3', 10);
const MODE = process.env.MODE === 'delete' ? 'delete' : 'unpublish';

const DOMAINS = [
  { locale: 'en', label: 'momuto.com',    token: process.env.OEMSAAS_TOKEN_EN },
  { locale: 'fr', label: 'fr.momuto.com', token: process.env.OEMSAAS_TOKEN_FR },
  { locale: 'es', label: 'es.momuto.com', token: process.env.OEMSAAS_TOKEN_ES },
];

const PREVIEW_TITLE = /^(Your custom design|Votre design personnalisé|Tu diseño personalizado|Il tuo design personalizzato)\b/;

function itemDate(p) {
  const raw = p.updated_at || p.update_time || p.created_at || p.create_time;
  if (!raw) return null;
  const d = new Date(typeof raw === 'number' ? raw * 1000 : raw);
  return isNaN(d.getTime()) ? null : d;
}

async function fetchAll(domain) {
  let page = 1;
  const items = [];
  while (true) {
    const res = await fetch(`${HOST}/products?page=${page}&pagesize=50`, { headers: { token: domain.token } });
    const json = await res.json();
    if (!res.ok || json.code !== 0) break;
    const list = json.data && (json.data.list || json.data) || [];
    if (!Array.isArray(list) || !list.length) break;
    items.push(...list);
    if (list.length < 50) break;
    page++;
  }
  return items;
}

async function sweep(domain) {
  if (!domain.token) { console.log(`[${domain.label}] no token — skipped`); return; }
  const products = await fetchAll(domain);
  const cutoff = Date.now() - AGE_DAYS * 86400 * 1000;

  const previews = products.filter(p => {
    const isPreview = String(p.inner_title || '').includes('3d-preview') || PREVIEW_TITLE.test(String(p.title || ''));
    if (!isPreview) return false;
    if (MODE === 'unpublish' && p.status === 0) return false; // already swept
    const d = itemDate(p);
    return !d || d.getTime() < cutoff; // unknown date counts as old
  });

  console.log(`[${domain.label}] ${products.length} products, ${previews.length} stale previews (>${AGE_DAYS}d)`);

  for (const p of previews) {
    const desc = `#${p.id} "${String(p.title).slice(0, 50)}"`;
    if (DRY_RUN) { console.log(`  DRY_RUN — would ${MODE} ${desc}`); continue; }
    let res;
    if (MODE === 'delete') {
      res = await fetch(`${HOST}/products/${p.id}`, { method: 'DELETE', headers: { token: domain.token } });
    } else {
      res = await fetch(`${HOST}/products/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', token: domain.token },
        body: JSON.stringify({ id: p.id, status: 0 }),
      });
    }
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.code === 0) console.log(`  ✓ ${MODE}ed ${desc}`);
    else console.warn(`  ✗ ${MODE} FAILED ${desc}: HTTP ${res.status} ${JSON.stringify(json).slice(0, 120)}`);
  }
}

(async () => {
  console.log(`cleanup-preview-products — mode=${MODE}, age>=${AGE_DAYS}d, dry_run=${DRY_RUN}`);
  for (const d of DOMAINS) await sweep(d);
  console.log(DRY_RUN ? '\nDRY RUN complete — dispatch with dry_run=false to apply.' : '\nSweep complete.');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
