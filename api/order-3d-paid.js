'use strict';

/**
 * POST /api/order-3d-paid
 *
 * Called server-to-server by design.momuto.com (WebhookAction) when the store
 * platform reports a 3D-configurator order as PAID (financial_status 230).
 * Sends the customer a MOMUTO confirmation email showing their ACTUAL jersey
 * (front/back renders + per-player roster) — the platform's own email can only
 * show the generic product photo — and enrolls the order in the standard
 * lifecycle (day-4 / day-10 crons, tracking, delivered).
 *
 * Auth: x-webhook-secret header must equal env D3_ORDER_SECRET.
 *
 * Body:
 * {
 *   order_no:       "d59t8fts70",          // design-server order number
 *   plant_order_no: "2026071033549226",    // platform order number (customer-facing ref)
 *   email:          "customer@x.com",
 *   name:           "Lu Na Ba",            // platform customer_name
 *   lang:           "en" | "fr" | "es" | "it",
 *   total:          "398.00",              // platform total_price (string, optional)
 *   currency:       "EUR",
 *   designs: [{
 *     suit:    "mamuto3suit1",
 *     front:   "https://design.momuto.com/upload/....png",
 *     back:    "https://design.momuto.com/upload/....png",
 *     players: [{ number, name, size, qty }]
 *   }]
 * }
 *
 * Idempotent: one confirmation per order_no (KV order id `3d_{order_no}`).
 */

const { kv } = require('@vercel/kv');
const { emailConfirmation3D } = require('../lib/emails');

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL_ORDERS || process.env.FROM_EMAIL || 'orders@momuto.com';
const SECRET     = process.env.D3_ORDER_SECRET;

function readJSON(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

async function sendEmail(to, subject, html) {
  if (!RESEND_KEY) { console.warn('[order-3d-paid] RESEND_API_KEY not set'); return; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `MOMUTO <${FROM_EMAIL}>`, to: [to], reply_to: 'info@momuto.com', subject, html }),
  });
  if (!r.ok) console.error('[order-3d-paid] Resend error:', r.status, await r.text());
}

module.exports = async function handler(req, res) {
  if (!SECRET) return res.status(503).json({ error: 'D3_ORDER_SECRET not configured' });
  if (req.headers['x-webhook-secret'] !== SECRET) return res.status(401).json({ error: 'Unauthorised' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = await readJSON(req);
  const { order_no, plant_order_no, email, name, lang, total, currency, designs } = body;

  if (!order_no || !email) {
    return res.status(400).json({ error: 'order_no and email are required' });
  }

  const id = `3d_${order_no}`;
  const existing = await kv.get(`order:${id}`);
  if (existing && (existing.emailsSent || []).includes('confirmation')) {
    return res.status(200).json({ ok: true, dedup: true });
  }

  const qty = (designs || []).reduce(
    (sum, d) => sum + (d.players || []).reduce((s, p) => s + (Number(p.qty) || 1), 0), 0
  );

  const order = {
    id,
    source:      '3d',
    name:        name || '',
    team:        name || '',                 // lifecycle emails address the buyer
    email,
    qty:         qty || '—',
    ref:         plant_order_no || order_no,
    orderNo:     order_no,
    invoiceDate: new Date().toISOString().slice(0, 10),
    lang:        ['en', 'es', 'fr', 'it'].includes(lang) ? lang : 'en',
    total:       total || null,
    currency:    currency || 'EUR',
    designs:     designs || [],
    notes:       null,
    paidAt:      new Date().toISOString(),
    emailsSent:     ['confirmation'],
    trackingNumber: null,
    trackingUrl:    null,
    status:    'active',
    createdAt: (existing && existing.createdAt) || new Date().toISOString(),
  };

  await kv.set(`order:${id}`, order);
  await kv.sadd('orders:all', id);
  await kv.sadd('orders:active', id);

  const { subject, html } = emailConfirmation3D(order);
  await sendEmail(order.email, subject, html);

  console.log(`[order-3d-paid] ${id} (${plant_order_no || order_no}) — confirmation sent to ${email}`);
  return res.status(200).json({ ok: true, id });
};
