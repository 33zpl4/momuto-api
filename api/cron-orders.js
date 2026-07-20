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
const { emailDay4, emailDay10 } = require('../lib/emails');

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

    // Excluded orders (e.g. historical orders the webhook picked up on a
    // platform re-sync) must never receive lifecycle mail, even if they are
    // still listed in orders:active. admin-orders removes them, this is belt.
    if (order.stopLifecycle || order.status === 'excluded') {
      await kv.srem('orders:active', id);
      results.skipped.push(id);
      continue;
    }

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
