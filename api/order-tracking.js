'use strict';

/**
 * POST /api/order-tracking
 * Body: { id, trackingNumber, trackingUrl }
 *
 * Marks the order as shipped and sends the tracking email immediately.
 */

const { kv } = require('@vercel/kv');

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
  if (!RESEND_KEY) { console.warn('[order-tracking] RESEND_API_KEY not set'); return; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `MOMUTO <${FROM_EMAIL}>`, to: [to], subject, html }),
  });
  if (!r.ok) console.error('[order-tracking] Resend error:', r.status, await r.text());
}

function emailTracking(order) {
  const subject = `Your MOMUTO kits are on their way — ${order.ref}`;
  const html = `
<div style="font-family:'Outfit',Arial,sans-serif;max-width:580px;margin:0 auto;border:1px solid #e4e4e7">
  <div style="background:#0a0a0a;padding:18px 24px">
    <span style="font-size:1.4rem;font-weight:800;color:#fff;letter-spacing:0.08em">MOMUTO</span>
  </div>
  <div style="padding:32px 24px">
    <p style="margin:0 0 8px;font-size:0.82rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#c8352e">Shipped</p>
    <h2 style="margin:0 0 24px;font-size:1.3rem;color:#0a0a0a;font-weight:700">Your kits are on their way, ${order.name}.</h2>
    <p style="margin:0 0 24px;font-size:0.95rem;color:#3a3a3a;line-height:1.7">
      The <strong>${order.team}</strong> kits have been shipped and are heading your way.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
      <tr>
        <td style="padding:10px 14px;border:1px solid #e4e4e7;font-weight:600;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;background:#f9f9f9;width:140px">Order ref</td>
        <td style="padding:10px 14px;border:1px solid #e4e4e7;font-size:0.9rem;color:#1a1a1a">${order.ref}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e4e4e7;font-weight:600;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;background:#f9f9f9">Tracking</td>
        <td style="padding:10px 14px;border:1px solid #e4e4e7;font-size:0.9rem;color:#1a1a1a">
          <strong>${order.trackingNumber}</strong>
        </td>
      </tr>
    </table>
    <a href="${order.trackingUrl}"
       style="display:inline-block;background:#c8352e;color:#fff;padding:13px 28px;
              font-weight:700;font-size:0.82rem;text-transform:uppercase;letter-spacing:0.1em;
              text-decoration:none;margin-bottom:28px">
      Track My Order →
    </a>
    <p style="font-size:0.75rem;color:#a1a1aa;margin:0;padding-top:16px;border-top:1px solid #e4e4e7">
      Questions? Reply to this email — we're always here.
    </p>
  </div>
</div>`;
  return { subject, html };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'x-admin-token, content-type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!isAuthorised(req)) return res.status(401).json({ error: 'Unauthorised' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id, trackingNumber, trackingUrl } = await readJSON(req);
  if (!id || !trackingNumber || !trackingUrl) {
    return res.status(400).json({ error: 'id, trackingNumber and trackingUrl are required' });
  }

  const order = await kv.get(`order:${id}`);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const updated = {
    ...order,
    trackingNumber,
    trackingUrl,
    status: 'shipped',
    emailsSent: [...(order.emailsSent || []), 'tracking'],
    shippedAt: new Date().toISOString(),
  };

  await kv.set(`order:${id}`, updated);
  await kv.srem('orders:active', id);
  await kv.sadd('orders:shipped', id);

  const { subject, html } = emailTracking(updated);
  await sendEmail(updated.email, subject, html);

  console.log(`[order-tracking] tracking sent for ${id}`);
  return res.status(200).json({ ok: true });
};
