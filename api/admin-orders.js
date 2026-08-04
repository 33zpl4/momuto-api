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
 */

const { kv } = require('@vercel/kv');

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const SECRET      = process.env.D3_ORDER_SECRET;

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
