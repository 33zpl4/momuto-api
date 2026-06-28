'use strict';

/**
 * GET /api/cron-nudge
 *
 * Runs daily via Vercel Cron. Sends a single gentle "any questions?" nudge to
 * anyone who entered their email at the €15 Custom Design gate (type
 * 'deposit_intent', written by /api/lead) but never completed the brief — our
 * best available proxy for "never paid", since there's no Stripe webhook.
 *
 * Guards:
 *   - only deposit_intent leads
 *   - older than MIN_AGE_H (not mid-checkout) and younger than MAX_AGE_DAYS
 *     (don't spam an old backlog on first deploy)
 *   - nudgeSent !== true (idempotent)
 *   - skipped if a *completed brief* exists for the same email (they got the
 *     concept-received email instead — they're in)
 *
 * Vercel sets Authorization: Bearer {CRON_SECRET} automatically.
 */

const { kv } = require('@vercel/kv');
const { emailDepositNudge } = require('../lib/emails');

const RESEND_KEY  = process.env.RESEND_API_KEY;
const FROM_EMAIL  = process.env.FROM_EMAIL || 'leads@momuto.com';
const TEAM_EMAIL  = process.env.TEAM_EMAIL || 'info@momuto.com';
const CRON_SECRET = process.env.CRON_SECRET;

const MIN_AGE_H     = 2;    // wait past the checkout window
const MAX_AGE_DAYS  = 14;   // don't nudge ancient leads

function isAuthorised(req) {
  if (!CRON_SECRET) return true; // dev fallback
  return req.headers['authorization'] === `Bearer ${CRON_SECRET}`;
}

async function sendNudge(to, subject, html) {
  if (!RESEND_KEY) { console.warn('[cron-nudge] RESEND_API_KEY not set'); return; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `MOMUTO <info@momuto.com>`, to: [to], reply_to: 'info@momuto.com', subject, html,
    }),
  });
  if (!r.ok) console.error('[cron-nudge] Resend error:', r.status, await r.text());
}

const norm = e => (e || '').trim().toLowerCase();
const hoursSince = ts => (Date.now() - new Date(ts).getTime()) / 3600000;

module.exports = async function handler(req, res) {
  if (!isAuthorised(req)) return res.status(401).json({ error: 'Unauthorised' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const ids = (await kv.smembers('leads:all')) || [];
  const leads = (await Promise.all(ids.map(id => kv.get(`lead:${id}`)))).filter(Boolean);

  // Emails that completed a brief (any non-deposit_intent lead) → they're in, never nudge.
  const completed = new Set(
    leads.filter(l => l.type !== 'deposit_intent' && l.email).map(l => norm(l.email))
  );
  // Emails that actually PAID (set by /api/stripe-webhook) → real signal, never nudge.
  const paidEmails = new Set(
    leads.filter(l => l.paid && l.email).map(l => norm(l.email))
  );

  const results = { sent: [], skipped: 0 };

  for (const lead of leads) {
    if (lead.type !== 'deposit_intent') continue;
    if (lead.nudgeSent) { results.skipped++; continue; }
    if (lead.paid || paidEmails.has(norm(lead.email))) { results.skipped++; continue; }
    if (!lead.email || completed.has(norm(lead.email))) { results.skipped++; continue; }

    const age = hoursSince(lead.receivedAt);
    if (age < MIN_AGE_H || age > MAX_AGE_DAYS * 24) { results.skipped++; continue; }

    try {
      const { subject, html } = emailDepositNudge({ lang: lead.locale || 'en' });
      await sendNudge(lead.email, subject, html);
      await kv.set(`lead:${lead.id}`, { ...lead, nudgeSent: true, nudgeAt: new Date().toISOString() });
      results.sent.push(lead.email);
      console.log(`[cron-nudge] nudged ${lead.email} (${lead.locale || 'en'})`);
    } catch (err) {
      console.error(`[cron-nudge] error on ${lead.id}:`, err.message);
    }
  }

  return res.status(200).json({ ok: true, ...results });
};
