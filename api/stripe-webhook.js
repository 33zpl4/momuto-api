'use strict';

/**
 * POST /api/stripe-webhook — marks a deposit lead PAID when Stripe confirms it.
 *
 * Subscribe this endpoint in Stripe to `checkout.session.completed`. On a paid
 * session we match the payer's email to the deposit_intent lead captured at the
 * gate (/api/lead) and set paid:true. That makes "paid" a real signal: the nudge
 * cron then never emails someone who already paid. If no lead matches (e.g. they
 * paid without ever touching the gate), we create a deposit_paid lead so nothing
 * is lost.
 *
 * Security: verifies the Stripe-Signature header via HMAC-SHA256 against
 * STRIPE_WEBHOOK_SECRET (the endpoint's whsec_… signing secret). No Stripe SDK.
 *
 * Env: STRIPE_WEBHOOK_SECRET (required), RESEND_API_KEY/TEAM_EMAIL (optional alert).
 */

const crypto = require('crypto');
const { kv } = require('@vercel/kv');
const { emailDepositPaid } = require('../lib/emails');

const SECRET     = process.env.STRIPE_WEBHOOK_SECRET;
const RESEND_KEY = process.env.RESEND_API_KEY;
const TEAM_EMAIL = process.env.TEAM_EMAIL || 'info@momuto.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'leads@momuto.com';
const TOLERANCE  = 60 * 5; // 5 min, like Stripe's default

// Read the raw request body (signature must be checked against exact bytes).
function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// Verify "t=…,v1=…" signature header. Returns true if any v1 matches.
function verify(payload, header, secret, nowSec) {
  if (!header || !secret) return false;
  const parts = {};
  header.split(',').forEach(kv => { const i = kv.indexOf('='); if (i > 0) (parts[kv.slice(0, i)] ||= []).push(kv.slice(i + 1)); });
  const t = parts.t && parts.t[0];
  const v1 = parts.v1 || [];
  if (!t || !v1.length) return false;
  if (Math.abs(nowSec - Number(t)) > TOLERANCE) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${payload}`, 'utf8').digest('hex');
  const exp = Buffer.from(expected);
  return v1.some(sig => {
    const got = Buffer.from(sig);
    return got.length === exp.length && crypto.timingSafeEqual(got, exp);
  });
}

const norm = e => (e || '').trim().toLowerCase();

async function notifyTeam(email, amount, currency) {
  if (!RESEND_KEY) return;
  const amt = amount != null ? `${(amount / 100).toFixed(2)} ${(currency || 'eur').toUpperCase()}` : '';
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `MOMUTO <${FROM_EMAIL}>`, to: [TEAM_EMAIL],
      subject: `✅ Deposit PAID — ${email} (${amt})`,
      html: `<p><strong>${email}</strong> paid the custom-design deposit${amt ? ` (${amt})` : ''}.</p>
             <p style="color:#71717a;font-size:.85rem">Marked paid in KV — they're out of the nudge list.</p>`,
    }),
  }).catch(() => {});
}

// Customer-facing: confirm the deposit + prompt the brief (?paid=true CTA). Sent
// once per payer (guarded by the paid checks below), localized from the lead.
async function notifyCustomer(email, locale) {
  if (!RESEND_KEY) return;
  const { subject, html } = emailDepositPaid({ lang: locale || 'en' });
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'MOMUTO <info@momuto.com>', to: [email], reply_to: 'info@momuto.com', subject, html }),
  }).catch(() => {});
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SECRET) { console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET not set'); return res.status(500).json({ error: 'Not configured' }); }

  let payload;
  try { payload = await rawBody(req); } catch { return res.status(400).json({ error: 'Bad body' }); }

  const nowSec = Math.floor(Date.now() / 1000);
  if (!verify(payload, req.headers['stripe-signature'], SECRET, nowSec)) {
    console.warn('[stripe-webhook] signature verification failed');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event;
  try { event = JSON.parse(payload); } catch { return res.status(400).json({ error: 'Bad JSON' }); }

  // Ack immediately for anything we don't act on.
  if (event.type !== 'checkout.session.completed') return res.status(200).json({ received: true });

  try {
    const session  = event.data?.object || {};
    if (session.payment_status && session.payment_status !== 'paid') return res.status(200).json({ received: true });
    const email    = norm(session.customer_details?.email || session.customer_email);
    const amount   = session.amount_total;
    const currency = session.currency;
    const paidAt   = new Date().toISOString();

    if (!email) { console.warn('[stripe-webhook] no email on session', session.id); return res.status(200).json({ received: true }); }

    const ids = (await kv.smembers('leads:all')) || [];
    const leads = await Promise.all(ids.map(async id => [id, await kv.get(`lead:${id}`)]));
    const match = leads.find(([, l]) => l && l.type === 'deposit_intent' && norm(l.email) === email);
    // Already-paid guard makes the whole handler idempotent on Stripe retries —
    // the customer "deposit received" email fires exactly once per payer.
    const alreadyPaid = leads.some(([, l]) => l && l.paid && norm(l.email) === email);

    if (match) {
      const [id, lead] = match;
      if (!lead.paid) {
        await kv.set(`lead:${id}`, { ...lead, paid: true, paidAt, stripeAmount: amount, stripeCurrency: currency, stripeSessionId: session.id });
        await notifyTeam(email, amount, currency);
        await notifyCustomer(email, lead.locale);
        console.log(`[stripe-webhook] marked paid: ${email} (${id})`);
      }
    } else if (!alreadyPaid) {
      const id = `lead_${Date.now()}`;
      await kv.set(`lead:${id}`, { id, receivedAt: paidAt, type: 'deposit_paid', email, paid: true, paidAt,
        locale: null, stripeAmount: amount, stripeCurrency: currency, stripeSessionId: session.id });
      await kv.sadd('leads:all', id);
      await notifyTeam(email, amount, currency);
      await notifyCustomer(email, null);
      console.log(`[stripe-webhook] paid, no prior lead — created: ${email}`);
    }
  } catch (err) {
    console.error('[stripe-webhook] error:', err.message);
    // Still 200 so Stripe doesn't retry forever on our internal error.
  }
  return res.status(200).json({ received: true });
};

// Best-effort: ask Vercel not to pre-parse the body so rawBody() sees exact bytes.
module.exports.config = { api: { bodyParser: false } };
