'use strict';

/**
 * GET/POST /api/admin-orders  — lifecycle admin for 3D-tool orders.
 *
 * Why this exists: WebhookAction fired confirmation emails for a batch of OLD,
 * already-fulfilled orders when the notify bridge was first activated (the
 * platform re-delivered their PAID webhooks; the design-DB pay_status was
 * still != 2, so each looked like a fresh unpaid->paid transition). Those
 * orders got enrolled in orders:active and would otherwise receive the normal
 * day-4 / day-10 / tracking sequence. This endpoint lets us LIST what is
 * currently active and EXCLUDE specific orders from all further lifecycle mail
 * without deleting the record.
 *
 * Auth: x-admin-token == ADMIN_TOKEN, OR x-webhook-secret == D3_ORDER_SECRET
 * (either works, so the value already in Vercel can be reused).
 *
 *   List:        GET  /api/admin-orders?action=list
 *   Find:        GET  /api/admin-orders?action=find&q=<ref | platform order no | email>
 *                Searches ALL stored orders (not just active) — the CMS admin
 *                shows the PLATFORM order number (e.g. 2026081633552986), which
 *                is stored as plantOrderNo, so this is how you locate an order
 *                when a customer writes in. Returns full email/lifecycle state.
 *   Resend:      POST /api/admin-orders   { "action":"resend-confirmation",
 *                                           "order":"<ref | platform no | email>",
 *                                           "force": false }
 *                Manual override for "customer says no email arrived": re-sends
 *                the branded confirmation NOW via Resend, even if it was already
 *                marked sent (a resend of an identical email is harmless; spam
 *                folders are the common culprit). Refuses multi-matches, and
 *                refuses status test/backfill/excluded unless force:true —
 *                those were withheld on purpose. Every send is logged on the
 *                record under manualResends[].
 *   Ingest:      POST /api/admin-orders   { "action":"ingest-and-send",
 *                  "order_no":"kz1cgjw0oh", "email":"…", "name":"…",
 *                  "lang":"en", "plant_order_no":"2026081633552986",
 *                  "total":"62.80", "currency":"EUR", "qty":2,
 *                  "paid_at":"2026-08-16", "image":"https://…" }
 *                For orders the design-server webhook MISSED (no stored record
 *                at all): builds the order from CMS-admin facts, sends the
 *                branded confirmation now, and enrolls the normal day-4/day-10
 *                lifecycle. order_no + email + name are required; image is the
 *                customer's render URL (the €0 preview line's product image in
 *                the CMS admin) and is optional — without it the email simply
 *                has no kit picture. Refuses if a record already exists (use
 *                resend-confirmation for those). Every webhook miss ingested
 *                here is ALSO a bug to chase in the design server's
 *                momuto-notify.log.
 *   Exclude:     POST /api/admin-orders   { "action":"exclude",
 *                                           "orders":["iwq7a4uhzv","1bs1zottea", ...] }
 *                (order refs may be given raw or already "3d_"-prefixed)
 *   Exclude ALL: POST /api/admin-orders   { "action":"exclude-all" }
 *                (kill switch: excludes every order currently in orders:active;
 *                 the response lists each order's id/ref/email for the record)
 *   Re-add:      POST /api/admin-orders   { "action":"reactivate", "orders":[...] }
 *
 * Exclude sets status:'excluded' + stopLifecycle:true and removes the id from
 * orders:active. The record stays in orders:all and order:<id> for history.
 *
 * scripts/resend-order-email.ps1 wraps find + resend-confirmation for the
 * command line (prompts for the admin token, shows the diagnosis, confirms
 * before sending).
 */

const { kv } = require('@vercel/kv');
const { emailConfirmation3D } = require('../lib/emails');

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const SECRET      = process.env.D3_ORDER_SECRET;
const RESEND_KEY  = process.env.RESEND_API_KEY;
const FROM_EMAIL  = process.env.FROM_EMAIL_ORDERS || process.env.FROM_EMAIL || 'orders@momuto.com';

function isAuthorised(req) {
  if (ADMIN_TOKEN && req.headers['x-admin-token'] === ADMIN_TOKEN) return true;
  if (SECRET && req.headers['x-webhook-secret'] === SECRET) return true;
  return false;
}

function readJSON(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

// Accept "iwq7a4uhzv" or "3d_iwq7a4uhzv" or "order:3d_iwq7a4uhzv" -> "3d_iwq7a4uhzv"
function toId(ref) {
  let s = String(ref || '').trim();
  if (s.startsWith('order:')) s = s.slice(6);
  return s.startsWith('3d_') ? s : `3d_${s}`;
}

// True when q names this order: the local ref/id, the PLATFORM order number
// (plantOrderNo — what the CMS admin shows), or the customer email.
function matchesQuery(id, o, q) {
  const needle = String(q || '').trim().toLowerCase();
  if (!needle) return false;
  return id.toLowerCase() === needle
    || id.toLowerCase() === `3d_${needle}`
    || String((o && o.ref) || '').toLowerCase() === needle
    || String((o && o.plantOrderNo) || '').toLowerCase() === needle
    || String((o && o.email) || '').toLowerCase() === needle;
}

// Load every stored order (orders:all) in batches and return [id, order] pairs.
async function loadAllOrders() {
  const ids = (await kv.smembers('orders:all')) || [];
  const pairs = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const loaded = await Promise.all(batch.map(id => kv.get(`order:${id}`)));
    batch.forEach((id, j) => pairs.push([id, loaded[j]]));
  }
  return pairs;
}

function diagnose(id, o) {
  if (!o) return { id, missing: true };
  return {
    id,
    ref:          o.ref || null,
    plantOrderNo: o.plantOrderNo || null,
    email:        o.email || null,
    name:         o.name || null,
    team:         o.team || null,
    total:        o.total || null,
    currency:     o.currency || null,
    lang:         o.lang || null,
    status:       o.status || null,
    stopLifecycle: !!o.stopLifecycle,
    paidAt:       o.paidAt || null,
    createdAt:    o.createdAt || null,
    emailsSent:   o.emailsSent || [],
    manualResends: o.manualResends || [],
    designs:      Array.isArray(o.designs) ? o.designs.length : 0,
  };
}

async function sendEmail(to, subject, html) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `MOMUTO <${FROM_EMAIL}>`, to: [to], reply_to: 'info@momuto.com', subject, html }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'x-admin-token, x-webhook-secret, content-type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!ADMIN_TOKEN && !SECRET) {
    return res.status(503).json({ error: 'Neither ADMIN_TOKEN nor D3_ORDER_SECRET configured' });
  }
  if (!isAuthorised(req)) return res.status(401).json({ error: 'Unauthorised' });

  const body   = req.method === 'POST' ? await readJSON(req) : {};
  const action = req.query.action || body.action || 'list';

  // ---- LIST -------------------------------------------------------------
  if (action === 'list') {
    const ids = (await kv.smembers('orders:active')) || [];
    const orders = [];
    for (const id of ids) {
      const o = await kv.get(`order:${id}`);
      if (!o) { orders.push({ id, missing: true }); continue; }
      orders.push({
        id,
        ref:        o.ref || null,
        email:      o.email || null,
        name:       o.name || null,
        total:      o.total || null,
        currency:   o.currency || null,
        lang:       o.lang || null,
        paidAt:     o.paidAt || null,
        createdAt:  o.createdAt || null,
        emailsSent: o.emailsSent || [],
      });
    }
    orders.sort((a, b) => String(a.paidAt || '').localeCompare(String(b.paidAt || '')));
    return res.status(200).json({ ok: true, count: orders.length, active: orders });
  }

  // ---- FIND (search ALL orders by ref / platform order no / email) ------
  if (action === 'find') {
    const q = req.query.q || body.q || body.order || '';
    if (!String(q).trim()) return res.status(400).json({ error: 'q is required' });
    const pairs = await loadAllOrders();
    const found = pairs.filter(([id, o]) => matchesQuery(id, o, q))
      .map(([id, o]) => diagnose(id, o));
    return res.status(200).json({
      ok: true, q, count: found.length, found,
      hint: found.length ? undefined
        : 'No stored order matches. The order never reached the email pipeline: ' +
          'either the design-server webhook did not fire for it, or it was a ' +
          'direct store purchase outside the 3D flow (no local order row). ' +
          'Check the CMS admin for the customer email and the platform\'s own ' +
          'confirmation-email setting.',
    });
  }

  // ---- RESEND CONFIRMATION (manual override) ---------------------------
  if (action === 'resend-confirmation') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    if (!RESEND_KEY) return res.status(503).json({ error: 'RESEND_API_KEY not configured' });
    const q = body.order || body.q || '';
    if (!String(q).trim()) return res.status(400).json({ error: 'order is required (ref, platform order no, or email)' });

    const pairs = await loadAllOrders();
    const found = pairs.filter(([id, o]) => o && matchesQuery(id, o, q));
    if (!found.length) {
      return res.status(404).json({
        error: 'No stored order matches — nothing to resend. The order never ' +
          'reached the email pipeline (webhook miss or non-3D purchase); a ' +
          'manual email from the inbox is the fallback.',
        q,
      });
    }
    if (found.length > 1) {
      return res.status(409).json({
        error: 'Query matches more than one order — resend by its exact ref instead.',
        q, matches: found.map(([id, o]) => diagnose(id, o)),
      });
    }

    const [id, order] = found[0];
    // test/backfill/excluded records were withheld from customer mail on
    // purpose — resending those needs an explicit force.
    const withheld = order.stopLifecycle || (order.status && order.status !== 'active');
    if (withheld && body.force !== true) {
      return res.status(409).json({
        error: `Order status is "${order.status}" (customer email was withheld on purpose). ` +
          'Pass force:true to send anyway.',
        order: diagnose(id, order),
      });
    }
    if (!order.email) {
      return res.status(422).json({ error: 'Order record has no email address', order: diagnose(id, order) });
    }

    const { subject, html } = emailConfirmation3D(order);
    await sendEmail(order.email, subject, html);
    // mark only after Resend accepted — same discipline as order-3d-paid
    if (!(order.emailsSent || []).includes('confirmation')) {
      order.emailsSent = [...(order.emailsSent || []), 'confirmation'];
    }
    order.manualResends = [...(order.manualResends || []), new Date().toISOString()];
    await kv.set(`order:${id}`, order);
    console.log(`[admin-orders] confirmation manually resent for ${id} -> ${order.email}`);
    return res.status(200).json({ ok: true, resent: true, to: order.email, order: diagnose(id, order) });
  }

  // ---- INGEST AND SEND (webhook-miss recovery) --------------------------
  if (action === 'ingest-and-send') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    if (!RESEND_KEY) return res.status(503).json({ error: 'RESEND_API_KEY not configured' });

    const orderNo = String(body.order_no || '').trim();
    const email   = String(body.email || '').trim();
    const name    = String(body.name || '').trim();
    if (!orderNo || !email || !name) {
      return res.status(400).json({ error: 'order_no, email and name are required' });
    }

    const id = toId(orderNo);
    if (await kv.get(`order:${id}`)) {
      return res.status(409).json({ error: `Order ${id} already exists — use resend-confirmation instead.` });
    }

    // paid_at: ISO date from the CMS admin; the delivery window in the email
    // counts from it, so use the REAL payment date, not today.
    const paidAt = body.paid_at
      ? new Date(body.paid_at).toISOString()
      : new Date().toISOString();
    if (isNaN(Date.parse(paidAt))) return res.status(400).json({ error: 'paid_at is not a date' });

    const designs = body.image
      ? [{ front: String(body.image), back: body.image_back ? String(body.image_back) : null, players: [] }]
      : [];
    const order = {
      id,
      name,
      email,
      team:  name,
      qty:   parseInt(body.qty, 10) || '—',
      ref:   orderNo.replace(/^3d_/, ''),
      plantOrderNo: body.plant_order_no ? String(body.plant_order_no) : null,
      total: body.total || null,
      currency: body.currency || 'EUR',
      designs,
      invoiceDate: paidAt.slice(0, 10),
      notes: 'manual ingest via admin-orders (design-server webhook missed this order)',
      lang:  ['en', 'es', 'fr', 'it'].includes(body.lang) ? body.lang : 'en',
      paidAt,
      platformPaidAt: body.paid_at ? paidAt : null,
      emailsSent: [],
      trackingNumber: null,
      trackingUrl: null,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    await kv.set(`order:${id}`, order);
    await kv.sadd('orders:all', id);
    await kv.sadd('orders:active', id);

    const { subject, html } = emailConfirmation3D(order);
    await sendEmail(order.email, subject, html);
    order.emailsSent = ['confirmation'];
    order.manualResends = [new Date().toISOString()];
    await kv.set(`order:${id}`, order);
    console.log(`[admin-orders] manual ingest+send for ${id} -> ${order.email}`);
    return res.status(200).json({ ok: true, ingested: true, sent: true, to: order.email, order: diagnose(id, order) });
  }

  // ---- EXCLUDE ALL (kill switch) ---------------------------------------
  // Stops lifecycle mail for EVERY currently-active order in one call. New
  // orders enrolled after this call proceed normally — this only drains the
  // active set as it stands right now.
  if (action === 'exclude-all') {
    const ids = (await kv.smembers('orders:active')) || [];
    const excludedAt = new Date().toISOString();
    const results = [];
    for (const id of ids) {
      const o = await kv.get(`order:${id}`);
      if (!o) {
        await kv.srem('orders:active', id);
        results.push({ id, status: 'removed_missing' });
        continue;
      }
      await kv.set(`order:${id}`, { ...o, status: 'excluded', stopLifecycle: true, excludedAt });
      await kv.srem('orders:active', id);
      results.push({
        id,
        status:     'excluded',
        ref:        o.ref || null,
        email:      o.email || null,
        paidAt:     o.paidAt || null,
        emailsSent: o.emailsSent || [],
      });
    }
    return res.status(200).json({ ok: true, action, count: results.length, results });
  }

  // ---- EXCLUDE / REACTIVATE --------------------------------------------
  if (action === 'exclude' || action === 'reactivate') {
    const refs = Array.isArray(body.orders) ? body.orders : [];
    if (!refs.length) return res.status(400).json({ error: 'orders[] is required' });

    const results = [];
    for (const ref of refs) {
      const id = toId(ref);
      const o = await kv.get(`order:${id}`);
      if (!o) { results.push({ id, status: 'not_found' }); continue; }

      if (action === 'exclude') {
        await kv.set(`order:${id}`, {
          ...o, status: 'excluded', stopLifecycle: true,
          excludedAt: new Date().toISOString(),
        });
        await kv.srem('orders:active', id);
        results.push({ id, status: 'excluded', email: o.email });
      } else {
        const { stopLifecycle, excludedAt, ...rest } = o;
        await kv.set(`order:${id}`, { ...rest, status: 'active' });
        await kv.sadd('orders:active', id);
        results.push({ id, status: 'reactivated', email: o.email });
      }
    }
    return res.status(200).json({ ok: true, action, results });
  }

  return res.status(400).json({ error: `Unknown action "${action}"` });
};
