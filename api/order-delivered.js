'use strict';

/**
 * POST /api/order-delivered
 * Body: { id }
 * Manually triggered once delivery is confirmed.
 * Sends Email 5 (post-delivery / review request).
 */

const { kv } = require('@vercel/kv');
const { emailDelivered } = require('../lib/emails');

const RESEND_KEY  = process.env.RESEND_API_KEY;
const FROM_EMAIL  = process.env.FROM_EMAIL_ORDERS || process.env.FROM_EMAIL || 'orders@momuto.com';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

function isAuthorised(req) {
  return req.headers['x-admin-token'] === ADMIN_TOKEN;
}

function readJSON(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

async function sendEmail(to, subject, html) {
  if (!RESEND_KEY) { console.warn('[order-delivered] RESEND_API_KEY not set'); return; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `MOMUTO <${FROM_EMAIL}>`, to: [to], subject, html }),
  });
  if (!r.ok) console.error('[order-delivered] Resend error:', r.status, await r.text());
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'x-admin-token, content-type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!isAuthorised(req)) return res.status(401).json({ error: 'Unauthorised' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = await readJSON(req);
  if (!id) return res.status(400).json({ error: 'id is required' });

  const order = await kv.get(`order:${id}`);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if ((order.emailsSent || []).includes('delivered')) {
    return res.status(409).json({ error: 'Delivery email already sent' });
  }

  const updated = {
    ...order,
    status:     'delivered',
    emailsSent: [...(order.emailsSent || []), 'delivered'],
    deliveredAt: new Date().toISOString(),
  };

  await kv.set(`order:${id}`, updated);
  await kv.srem('orders:shipped', id);
  await kv.sadd('orders:delivered', id);

  const { subject, html } = emailDelivered(updated);
  await sendEmail(updated.email, subject, html);

  console.log(`[order-delivered] post-delivery email sent for ${id}`);
  return res.status(200).json({ ok: true });
};
