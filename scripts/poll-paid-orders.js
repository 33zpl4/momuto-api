'use strict';

/**
 * Poll the store platform for PAID orders and trigger the confirmation email
 * pipeline for any 3D-tool order the design-server webhook hasn't delivered.
 *
 * WHY: momuto-notify.log (Aug 2026) proved the platform delivers paid-order
 * webhooks in SWEEPS days apart, not at payment time. This poller closes the
 * gap: it reads the orders API directly every hour and hands anything new to
 * the existing admin-orders ingest machinery on Vercel — so customers get
 * "you paid, here's your order" within the hour, and the late webhook sweep
 * simply dedups against the record.
 *
 *   node scripts/poll-paid-orders.js --probe [--lang en]   # dump raw API shape, no writes
 *   node scripts/poll-paid-orders.js [--lang all]          # dry run (default): decide, send nothing
 *   node scripts/poll-paid-orders.js --live                # poll + ingest + email
 *
 * How an order is linked to its 3D design: every 3D checkout adds a €0
 * preview product whose title ends "— order <localref>" and whose
 * inner_title is {"type":"3d-preview","order_no":"<localref>", ...}; its
 * product images are the customer's own front/back renders. Orders WITHOUT
 * that line (direct store purchases, or the rare preview-create failure) are
 * skipped and counted — the webhook sweep or the platform's own email covers
 * those.
 *
 * ⚠️ The vendor's ORDERS read API is an UNVERIFIED surface (see
 * docs/oemsaas-api-notes.md — list endpoints omit fields, acks lie). The
 * code reads defensively, re-fetches the single order when the list omits
 * the paid status, and --probe exists to check the real shape before
 * trusting a live run. financial_status 230 = paid — the same constant
 * WebhookAction keys on.
 *
 * Env (GitHub Actions):
 *   OEMSAAS_TOKEN_EN / _ES / _FR  — store API tokens (IT has no checkout)
 *   MOMUTO_API_SECRET             — the Vercel D3_ORDER_SECRET value; used as
 *                                   x-webhook-secret against admin-orders.
 *                                   MISSING = the poller reports "not armed"
 *                                   and exits 0, so the scheduled workflow is
 *                                   safe to merge before the secret exists.
 *
 * Runs on the GitHub runner; the sandbox cannot reach openapi.oemapps.com.
 */

const HOST = 'https://openapi.oemapps.com';
const API  = 'https://momuto-api.vercel.app/api/admin-orders';

const POLL_WINDOW_DAYS = 14;   // ignore anything paid earlier (matches BACKFILL_DAYS)
const LIST_LIMIT = 50;

const STORES = {
  en: { tokenEnv: 'OEMSAAS_TOKEN_EN' },
  es: { tokenEnv: 'OEMSAAS_TOKEN_ES' },
  fr: { tokenEnv: 'OEMSAAS_TOKEN_FR' },
};

const SECRET = process.env.MOMUTO_API_SECRET;

function parseArgs(argv) {
  const a = { live: false, probe: false, lang: 'all' };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--live') a.live = true;
    else if (k === '--dry-run') a.live = false;
    else if (k === '--probe') a.probe = true;
    else if (k === '--lang') a.lang = argv[++i];
    else { console.error(`Unknown argument: ${k}`); process.exit(1); }
  }
  if (a.lang !== 'all' && !STORES[a.lang]) {
    console.error(`Unknown lang "${a.lang}"`); process.exit(1);
  }
  return a;
}

async function platform(pathname, token) {
  const res = await fetch(`${HOST}${pathname}`, { headers: { token } });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error(`HTTP ${res.status} non-JSON: ${text.slice(0, 200)}`); }
  if (json.code !== 0 && json.code !== 200) {
    throw new Error(`API code ${json.code}: ${json.msg}`);
  }
  return json.data;
}

// The list payload shape is unverified — accept a bare array or the common
// wrappers without assuming which one this API uses.
function asOrderList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.orders)) return data.orders;
  if (data && Array.isArray(data.list)) return data.list;
  if (data && Array.isArray(data.rows)) return data.rows;
  return null;
}

function field(o, names) {
  for (const n of names) {
    if (o && o[n] !== undefined && o[n] !== null && o[n] !== '') return o[n];
  }
  return null;
}

// Platform clocks arrive as unix seconds (WebhookAction precedent) but guard
// for ISO strings too.
function toMillis(v) {
  if (!v) return 0;
  const n = parseInt(v, 10);
  if (n > 1e12) return n;            // already ms
  if (n > 1e9) return n * 1000;      // unix seconds
  const t = Date.parse(v);
  return isNaN(t) ? 0 : t;
}

function isPaid(o) {
  const fs = field(o, ['financial_status', 'financialStatus', 'pay_status']);
  if (fs === null) return null;      // unknown — caller re-fetches the detail
  return parseInt(fs, 10) === 230 || String(fs).toLowerCase() === 'paid';
}

function itemsOf(o) {
  return field(o, ['line_items', 'lineItems', 'items', 'order_items', 'goods']) || [];
}

// Extract the local 3D order ref from the €0 preview line.
function previewRef(item) {
  const inner = field(item, ['inner_title', 'innerTitle']);
  if (inner) {
    try {
      const j = JSON.parse(inner);
      if (j && j.type === '3d-preview' && j.order_no) return String(j.order_no);
    } catch { /* not JSON — fall through to the title */ }
  }
  const title = String(field(item, ['title', 'name']) || '');
  const m = /—\s*order\s+([a-z0-9]+)/i.exec(title);
  return m ? m[1] : null;
}

async function vercel(method, pathQ, body) {
  const res = await fetch(`${API}${pathQ}`, {
    method,
    headers: { 'x-webhook-secret': SECRET, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function run() {
  const args = parseArgs(process.argv);
  const langs = args.lang === 'all' ? Object.keys(STORES) : [args.lang];
  const report = { ingested: [], alreadyKnown: [], noPreviewLine: [], notPaidOrOld: 0, unknownStatus: [], errors: [] };

  if (!args.probe && !SECRET) {
    console.log('MOMUTO_API_SECRET not set — poller not armed yet, nothing to do.');
    console.log('(Add it as a GitHub Actions secret — same value as the Vercel D3_ORDER_SECRET — to arm the hourly poll.)');
    return;
  }

  for (const lang of langs) {
    const token = process.env[STORES[lang].tokenEnv];
    if (!token) { report.errors.push(`${lang}: missing ${STORES[lang].tokenEnv}`); continue; }
    console.log(`\n=== ${lang.toUpperCase()} ===`);

    let data;
    try {
      data = await platform(`/orders?limit=${LIST_LIMIT}`, token);
    } catch (e) {
      report.errors.push(`${lang}: orders list failed — ${e.message}`);
      console.error(`orders list failed: ${e.message}`);
      continue;
    }

    if (args.probe) {
      // Raw shape dump (truncated; emails masked) — verify before trusting live runs.
      const masked = JSON.stringify(data, (k, v) =>
        (typeof v === 'string' && v.includes('@')) ? v.replace(/^(.).*(@.*)$/, '$1***$2') : v
      );
      console.log(masked.length > 6000 ? masked.slice(0, 6000) + ' …[truncated]' : masked);
      continue;
    }

    const list = asOrderList(data);
    if (!list) {
      report.errors.push(`${lang}: unrecognised orders payload shape — run --probe`);
      console.error('unrecognised payload shape — run --probe. Keys:', data && typeof data === 'object' ? Object.keys(data) : typeof data);
      continue;
    }
    console.log(`${list.length} orders in the latest page`);

    for (let o of list) {
      const platNo = String(field(o, ['order_number', 'order_no', 'orderNumber', 'name', 'id']) || '');
      try {
        let paid = isPaid(o);
        let paidMs = toMillis(field(o, ['first_pay_at', 'pay_at', 'paid_at', 'payAt']));
        // The list endpoint omitting fields is a DOCUMENTED trap — re-read the
        // single order whenever the list copy can't answer.
        if ((paid === null || (paid && !paidMs) || !itemsOf(o).length) && field(o, ['id'])) {
          o = await platform(`/orders/${field(o, ['id'])}`, token) || o;
          paid = isPaid(o);
          paidMs = toMillis(field(o, ['first_pay_at', 'pay_at', 'paid_at', 'payAt']));
        }
        if (paid === null) { report.unknownStatus.push(`${lang}:${platNo}`); continue; }
        if (!paid || !paidMs || (Date.now() - paidMs) > POLL_WINDOW_DAYS * 86400000) {
          report.notPaidOrOld++; continue;
        }

        // locate the 3D preview line -> local ref
        let ref = null, previewProductId = null;
        for (const item of itemsOf(o)) {
          const r = previewRef(item);
          if (r) { ref = r; previewProductId = field(item, ['product_id', 'productId']); break; }
        }
        if (!ref) { report.noPreviewLine.push(`${lang}:${platNo}`); continue; }

        // already in the pipeline?
        const found = await vercel('GET', `?action=find&q=${encodeURIComponent(ref)}`);
        if (found.status === 200 && found.json.count > 0) {
          report.alreadyKnown.push(`${lang}:${ref}`);
          continue;
        }

        // customer + money fields (defensive names)
        const cust  = o.customer || {};
        const email = field(o, ['email', 'customer_email']) || field(cust, ['email']);
        const name  = field(o, ['customer_name', 'consignee_name']) || field(cust, ['name'])
          || [field(cust, ['first_name', 'firstName']), field(cust, ['last_name', 'lastName'])].filter(Boolean).join(' ')
          || 'Coach';
        const total = field(o, ['total_price', 'total', 'pay_price']);
        const currency = field(o, ['currency', 'currency_code']) || 'EUR';
        if (!email) { report.errors.push(`${lang}:${ref}: paid order but no customer email in payload`); continue; }

        // renders from the preview product
        let image = null, imageBack = null;
        if (previewProductId) {
          try {
            const p = await platform(`/products/${previewProductId}`, token);
            const imgs = (p && p.images || []).map(i => i && i.src).filter(Boolean);
            image = imgs[0] || null; imageBack = imgs[1] || null;
          } catch (e) { console.warn(`${ref}: preview product read failed (${e.message}) — sending without images`); }
        }

        const qty = itemsOf(o)
          .filter(it => !previewRef(it) && parseFloat(field(it, ['price', 'unit_price']) || 0) > 0)
          .reduce((n, it) => n + (parseInt(field(it, ['quantity', 'qty']), 10) || 0), 0) || undefined;

        const payload = {
          action: 'ingest-and-send',
          order_no: ref, email, name, lang,
          plant_order_no: platNo, total, currency, qty,
          paid_at: new Date(paidMs).toISOString(),
          image, image_back: imageBack,
        };
        if (!args.live) {
          console.log(`[dry run] WOULD ingest+send ${ref} (${platNo}) -> ${String(email).replace(/^(.).*(@.*)$/, '$1***$2')}`);
          report.ingested.push(`${lang}:${ref} (dry)`);
          continue;
        }
        const ing = await vercel('POST', '', payload);
        if (ing.status === 200) {
          console.log(`INGESTED + SENT ${ref} (${platNo})`);
          report.ingested.push(`${lang}:${ref}`);
        } else if (ing.status === 409) {
          report.alreadyKnown.push(`${lang}:${ref}`);  // raced with the webhook — fine
        } else {
          report.errors.push(`${lang}:${ref}: ingest ${ing.status} ${JSON.stringify(ing.json).slice(0, 200)}`);
        }
      } catch (e) {
        report.errors.push(`${lang}:${platNo}: ${e.message}`);
      }
    }
  }

  if (!args.probe) {
    console.log('\n=== SUMMARY ===');
    console.log(JSON.stringify(report, null, 2));
    if (report.errors.length) process.exit(1);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
