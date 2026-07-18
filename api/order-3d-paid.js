'use strict';

/**
 * POST /api/order-3d-paid
 *
 * Called by the design server (WebhookAction.php) when the store platform
 * reports a 3D-tool order as PAID (financial_status 230, unpaid→paid
 * transition only). Sends the branded confirmation email with the customer's
 * actual jersey renders + roster, and enrolls the order in the existing
 * day-4 / day-10 / tracking / delivered lifecycle (same KV shape as
 * api/orders.js, so cron-orders picks it up with zero changes).
 *
 * Auth: x-webhook-secret header must equal D3_ORDER_SECRET (Vercel env).
 * The same value goes into WebhookAction::MOMUTO_API_SECRET on the design
 * server. While either side is unset, this endpoint refuses loudly (503)
 * instead of silently doing nothing — misconfiguration must be visible.
 *
 * Idempotent: webhook re-fires for an already-processed order return 200
 * without sending anything again.
 *
 * Payload (see server-patches/WebhookAction.php):
 *   { order_no, plant_order_no, email, name, lang, total, currency,
 *     designs: [{ suit, front, back, players: [{number,name,size,qty}] }] }
 */

const { kv } = require('@vercel/kv');
const { emailConfirmation3D } = require('../lib/emails');

const RESEND_KEY  = process.env.RESEND_API_KEY;
const FROM_EMAIL  = process.env.FROM_EMAIL_ORDERS || process.env.FROM_EMAIL || 'orders@momuto.com';
const SECRET      = process.env.D3_ORDER_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'info@momuto.com';

function readJSON(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', reject);
  });
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
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!SECRET) {
    console.error('[order-3d-paid] D3_ORDER_SECRET not set — refusing');
    return res.status(503).json({ error: 'D3_ORDER_SECRET not configured' });
  }
  if (req.headers['x-webhook-secret'] !== SECRET) {
    return res.status(401).json({ error: 'Bad secret' });
  }
  if (!RESEND_KEY) {
    console.error('[order-3d-paid] RESEND_API_KEY not set — refusing');
    return res.status(503).json({ error: 'RESEND_API_KEY not configured' });
  }

  const body = await readJSON(req);
  const { order_no, plant_order_no, email, name, lang, total, currency, designs } = body;

  if (!order_no || !email) {
    return res.status(400).json({ error: 'order_no and email are required' });
  }

  const id = `3d_${order_no}`;

  // Idempotency: the platform re-fires webhooks; only the first one acts.
  const existing = await kv.get(`order:${id}`);
  if (existing && existing.paidAt) {
    console.log(`[order-3d-paid] ${id} already processed — dedup`);
    return res.status(200).json({ ok: true, dedup: true });
  }

  const players = (designs || []).flatMap(d => d.players || []).filter(Boolean);
  const qty = players.reduce((n, p) => n + (parseInt(p.qty, 10) || 1), 0) || '—';

  const order = {
    id,
    name:  name || 'Coach',
    email,
    team:  name || `Order ${order_no}`,
    qty,
    ref:   order_no,
    plantOrderNo: plant_order_no || null,
    total: total || null,
    currency: currency || 'EUR',
    designs: designs || [],
    invoiceDate: new Date().toISOString().slice(0, 10),
    notes: '3d-tool order (auto via design-server webhook)',
    lang:  ['en', 'es', 'fr', 'it'].includes(lang) ? lang : 'en',
    paidAt: new Date().toISOString(),
    emailsSent: ['confirmation'],
    trackingNumber: null,
    trackingUrl: null,
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  await kv.set(`order:${id}`, order);
  await kv.sadd('orders:all', id);
  await kv.sadd('orders:active', id);

  try {
    const { subject, html } = emailConfirmation3D(order);
    await sendEmail(order.email, subject, html);
  } catch (e) {
    // order is stored either way; surface the send failure to the caller log
    console.error(`[order-3d-paid] ${id} confirmation send FAILED:`, e.message);
    return res.status(502).json({ ok: false, stored: true, error: e.message });
  }

  // Best-effort heads-up to the team — never fails the request.
  try {
    await sendEmail(
      ADMIN_EMAIL,
      `🟢 3D order PAID — ${order_no} (${order.currency} ${order.total || '?'}, ${order.lang})`,
      `<p>Order <strong>${order_no}</strong> (platform ${plant_order_no || '?'}) paid by ${order.name} &lt;${email}&gt;.</p>` +
      `<p>${qty} jerseys · inspect: <a href="https://design.momuto.com/3d-configurator/inspect.html?configId=${order_no}">design inspector</a></p>`
    );
  } catch (e) {
    console.warn('[order-3d-paid] admin notify failed:', e.message);
  }

  console.log(`[order-3d-paid] ${id} confirmed (${order.lang}) — lifecycle started`);
  return res.status(200).json({ ok: true });
};
