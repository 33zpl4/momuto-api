'use strict';
/**
 * POST /api/lifecycle  (served through /api/lead?type=lifecycle — Hobby plan: 12 functions, api/ is full)
 *
 * One sender for the lifecycle emails our GitHub pollers decide on (docs/lifecycle-emails.md):
 *   kind 'abandoned' — unpaid platform checkout, 1 h+ old (scripts/poll-abandoned-checkouts.js, hourly)
 *   kind 'reorder'   — paid order ~90 days old + a 10 % coupon (scripts/poll-reorder-offers.js, daily)
 * The pollers hold the store tokens (GitHub secrets); this side holds KV + Resend. Dedup lives HERE, in KV, so a
 * poller can be re-run freely: `lifecycle:<kind>:<key>` is set with NX before any send; a send that Resend
 * rejects deletes the mark so the next run retries. A reorder offer is also capped to one per email per 180 days.
 * Suppression: emails in the KV set `lifecycle:suppress` never get either mail (admin adds them by hand).
 *
 * Body (JSON): { kind, key, email, lang, dry?, ...ctx for lib/emails.emailAbandoned / emailReorder }
 * Auth: x-webhook-secret == D3_ORDER_SECRET (same value the pollers carry as MOMUTO_API_SECRET).
 * `dry: true` renders and answers { subject, bytes } without sending or marking.
 */
const { kv } = require('@vercel/kv');
const { emailAbandoned, emailReorder } = require('./emails');

const SECRET     = process.env.D3_ORDER_SECRET;
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL_ORDERS || process.env.FROM_EMAIL || 'orders@momuto.com';
const REORDER_EMAIL_TTL = 180 * 86400;
const KINDS = { abandoned: emailAbandoned, reorder: emailReorder };
const validEmail = v => typeof v === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());

function readJSON(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise(resolve => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 64 * 1024) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

async function send(to, subject, html) {
  if (!RESEND_KEY) return { ok: false, error: 'RESEND_API_KEY not set' };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `MOMUTO <${FROM_EMAIL}>`, to: [to], reply_to: 'info@momuto.com', subject, html }),
  });
  return r.ok ? { ok: true } : { ok: false, error: `Resend ${r.status} ${(await r.text()).slice(0, 200)}` };
}

async function paidSince(email, sinceMs) {
  try {
    const ids = (await kv.smembers('orders:all')) || [];
    for (let i = 0; i < ids.length; i += 50) {
      const batch = await Promise.all(ids.slice(i, i + 50).map(id => kv.get(`order:${id}`)));
      if (batch.some(o => o && o.email && String(o.email).toLowerCase() === email && o.paidAt && Date.parse(o.paidAt) >= sinceMs - 6 * 3600000)) return true;
    }
  } catch (e) { console.error('[lifecycle] paidSince:', e.message); }
  return false;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  if (!SECRET || req.headers['x-webhook-secret'] !== SECRET) return res.status(401).json({ ok: false, error: 'unauthorised' });
  const b = await readJSON(req);
  const render = KINDS[b.kind];
  if (!render) return res.status(400).json({ ok: false, error: 'kind must be abandoned|reorder' });
  if (!b.key || !validEmail(b.email)) return res.status(400).json({ ok: false, error: 'key and a valid email are required' });
  const email = String(b.email).trim().toLowerCase();
  const { subject, html } = render(b);
  if (b.dry) return res.status(200).json({ ok: true, dry: true, subject, bytes: html.length });

  if (await kv.sismember('lifecycle:suppress', email)) return res.status(200).json({ ok: true, suppressed: true });
  // Abandoned: a customer who paid OUTSIDE the platform (Stripe payment link, ingested by admin-orders) is still "unpaid"
  // there — order 2026110633635073, 6 Nov 2026. Our own records know: any paid order with this email after the checkout.
  if (b.kind === 'abandoned' && b.createdAt && await paidSince(email, Date.parse(b.createdAt))) return res.status(200).json({ ok: true, skipped: 'paid elsewhere' });
  const mark = `lifecycle:${b.kind}:${b.key}`;
  const stamp = { email, at: new Date().toISOString(), subject };
  if ((await kv.set(mark, stamp, { nx: true })) !== 'OK') return res.status(200).json({ ok: true, dedup: true });
  if (b.kind === 'reorder') {
    const perEmail = `lifecycle:reorder:email:${email}`;
    if ((await kv.set(perEmail, stamp, { nx: true, ex: REORDER_EMAIL_TTL })) !== 'OK') {
      await kv.del(mark);
      return res.status(200).json({ ok: true, dedup: true, reason: 'one reorder offer per customer per 180 days' });
    }
  }
  const out = await send(email, subject, html);
  if (!out.ok) {
    await kv.del(mark);
    if (b.kind === 'reorder') await kv.del(`lifecycle:reorder:email:${email}`);
    console.error(`[lifecycle] ${b.kind} ${b.key}: ${out.error}`);
    return res.status(502).json({ ok: false, error: out.error });
  }
  await kv.sadd('lifecycle:sent', `${b.kind}:${b.key}`);
  console.log(`[lifecycle] ${b.kind} sent for ${b.key} (${b.lang})`);
  return res.status(200).json({ ok: true, sent: true, subject });
};
