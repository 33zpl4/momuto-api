'use strict';

/**
 * GET /api/cron-orders
 *
 * Runs daily via Vercel Cron (08:00 UTC).
 * Sends day-4 and day-10 lifecycle emails for active orders.
 *
 * Vercel sets Authorization: Bearer {CRON_SECRET} automatically.
 */

const { kv } = require('@vercel/kv');

const RESEND_KEY  = process.env.RESEND_API_KEY;
const FROM_EMAIL  = process.env.FROM_EMAIL_ORDERS || process.env.FROM_EMAIL || 'orders@momuto.com';
const CRON_SECRET = process.env.CRON_SECRET;

function isAuthorised(req) {
  if (!CRON_SECRET) return true; // dev fallback
  return req.headers['authorization'] === `Bearer ${CRON_SECRET}`;
}

async function sendEmail(to, subject, html) {
  if (!RESEND_KEY) { console.warn('[cron] RESEND_API_KEY not set'); return; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `MOMUTO <${FROM_EMAIL}>`, to: [to], subject, html }),
  });
  if (!r.ok) console.error('[cron] Resend error:', r.status, await r.text());
}

function emailDay4(order) {
  const subject = `Your MOMUTO kits are now in production — ${order.ref}`;
  const html = `
<div style="font-family:'Outfit',Arial,sans-serif;max-width:580px;margin:0 auto;border:1px solid #e4e4e7">
  <div style="background:#0a0a0a;padding:18px 24px">
    <span style="font-size:1.4rem;font-weight:800;color:#fff;letter-spacing:0.08em">MOMUTO</span>
  </div>
  <div style="padding:32px 24px">
    <p style="margin:0 0 8px;font-size:0.82rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#c8352e">Production Update</p>
    <h2 style="margin:0 0 24px;font-size:1.3rem;color:#0a0a0a;font-weight:700">Production has kicked off, ${order.name}.</h2>
    <p style="margin:0 0 24px;font-size:0.95rem;color:#3a3a3a;line-height:1.7">
      Great news — the <strong>${order.team}</strong> kits have entered production.<br>
      Our manufacturing team is working on them and everything is on track.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
      <tr>
        <td style="padding:10px 14px;border:1px solid #e4e4e7;font-weight:600;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;background:#f9f9f9;width:140px">Order ref</td>
        <td style="padding:10px 14px;border:1px solid #e4e4e7;font-size:0.9rem;color:#1a1a1a">${order.ref}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e4e4e7;font-weight:600;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;background:#f9f9f9">Team</td>
        <td style="padding:10px 14px;border:1px solid #e4e4e7;font-size:0.9rem;color:#1a1a1a">${order.team}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e4e4e7;font-weight:600;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;background:#f9f9f9">Qty</td>
        <td style="padding:10px 14px;border:1px solid #e4e4e7;font-size:0.9rem;color:#1a1a1a">${order.qty} kits</td>
      </tr>
    </table>
    <p style="margin:0 0 24px;font-size:0.9rem;color:#3a3a3a;line-height:1.7">
      Next update: when your kits are finishing up and nearly ready to ship.
    </p>
    <p style="font-size:0.75rem;color:#a1a1aa;margin:0;padding-top:16px;border-top:1px solid #e4e4e7">
      Questions? Reply to this email — we're always here.
    </p>
  </div>
</div>`;
  return { subject, html };
}

function emailDay10(order) {
  const subject = `Your MOMUTO kits are almost ready — ${order.ref}`;
  const html = `
<div style="font-family:'Outfit',Arial,sans-serif;max-width:580px;margin:0 auto;border:1px solid #e4e4e7">
  <div style="background:#0a0a0a;padding:18px 24px">
    <span style="font-size:1.4rem;font-weight:800;color:#fff;letter-spacing:0.08em">MOMUTO</span>
  </div>
  <div style="padding:32px 24px">
    <p style="margin:0 0 8px;font-size:0.82rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#c8352e">Almost There</p>
    <h2 style="margin:0 0 24px;font-size:1.3rem;color:#0a0a0a;font-weight:700">Your kits are finishing up, ${order.name}.</h2>
    <p style="margin:0 0 24px;font-size:0.95rem;color:#3a3a3a;line-height:1.7">
      The <strong>${order.team}</strong> kits are in the final stages of production.<br>
      We'll send your tracking number as soon as they're handed to the courier.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
      <tr>
        <td style="padding:10px 14px;border:1px solid #e4e4e7;font-weight:600;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;background:#f9f9f9;width:140px">Order ref</td>
        <td style="padding:10px 14px;border:1px solid #e4e4e7;font-size:0.9rem;color:#1a1a1a">${order.ref}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e4e4e7;font-weight:600;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;background:#f9f9f9">Team</td>
        <td style="padding:10px 14px;border:1px solid #e4e4e7;font-size:0.9rem;color:#1a1a1a">${order.team}</td>
      </tr>
    </table>
    <p style="margin:0 0 24px;font-size:0.9rem;color:#3a3a3a;line-height:1.7">
      You'll receive your tracking link by email shortly — keep an eye on your inbox.
    </p>
    <p style="font-size:0.75rem;color:#a1a1aa;margin:0;padding-top:16px;border-top:1px solid #e4e4e7">
      Questions? Reply to this email — we're always here.
    </p>
  </div>
</div>`;
  return { subject, html };
}

function daysSince(dateStr) {
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((now - start) / 86400000);
}

module.exports = async function handler(req, res) {
  if (!isAuthorised(req)) return res.status(401).json({ error: 'Unauthorised' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const ids = (await kv.smembers('orders:active')) || [];
  console.log(`[cron] checking ${ids.length} active orders`);

  const results = { day4: [], day10: [], skipped: [] };

  for (const id of ids) {
    const order = await kv.get(`order:${id}`);
    if (!order || !order.paidAt) continue;  // only process paid orders

    const days = daysSince(order.paidAt);   // clock starts from payment date
    const sent = order.emailsSent || [];

    try {
      if (days >= 4 && !sent.includes('day4')) {
        const { subject, html } = emailDay4(order);
        await sendEmail(order.email, subject, html);
        const updated = { ...order, emailsSent: [...sent, 'day4'] };
        await kv.set(`order:${id}`, updated);
        results.day4.push(id);
        console.log(`[cron] day4 sent for ${id} (${order.team})`);
      } else if (days >= 10 && !sent.includes('day10')) {
        const { subject, html } = emailDay10(order);
        await sendEmail(order.email, subject, html);
        const updated = { ...order, emailsSent: [...sent, 'day10'] };
        await kv.set(`order:${id}`, updated);
        results.day10.push(id);
        console.log(`[cron] day10 sent for ${id} (${order.team})`);
      } else {
        results.skipped.push(id);
      }
    } catch (err) {
      console.error(`[cron] error on ${id}:`, err.message);
    }
  }

  return res.status(200).json({ ok: true, ...results });
};
