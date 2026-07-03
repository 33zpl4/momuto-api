'use strict';

/**
 * POST /api/lead — lightweight pre-payment lead capture for the Custom Design gate.
 *
 * The deposit gate asks for an email before sending the visitor to Stripe. This
 * captures that email into the SAME KV lead list used by /api/submit (so it shows
 * in the admin view) and pings the team — so an abandoned Stripe checkout is still
 * a recoverable lead. Best-effort: the frontend proceeds to Stripe regardless.
 *
 * Body (JSON or x-www-form-urlencoded): { email, locale, source }
 * Env: RESEND_API_KEY, TEAM_EMAIL, FROM_EMAIL (same as /api/submit)
 */

const { kv } = require('@vercel/kv');

const RESEND_KEY = process.env.RESEND_API_KEY;
const TEAM_EMAIL = process.env.TEAM_EMAIL || 'info@momuto.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'leads@momuto.com';

const ALLOWED_ORIGINS = [
  'https://momuto.com',
  'https://www.momuto.com',
  'https://es.momuto.com',
  'https://fr.momuto.com',
  'https://it.momuto.com',
];

function originOf(req) {
  const origin = req.headers['origin'] || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  const referer = req.headers['referer'] || '';
  const hit = ALLOWED_ORIGINS.find(o => referer.startsWith(o));
  return hit || null;
}

function getBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise(resolve => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      try { return resolve(JSON.parse(raw || '{}')); }
      catch (_) {
        const o = {};
        (raw || '').split('&').forEach(p => {
          const i = p.indexOf('=');
          if (i > 0) o[decodeURIComponent(p.slice(0, i))] = decodeURIComponent(p.slice(i + 1).replace(/\+/g, ' '));
        });
        resolve(o);
      }
    });
    req.on('error', () => resolve({}));
  });
}

const validEmail = v => typeof v === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());

async function notifyTeam(lead) {
  if (!RESEND_KEY) return;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;border:1px solid #e4e4e7">
      <div style="background:#0a0a0a;padding:14px 20px;color:#fff;font-weight:800;letter-spacing:.08em">MOMUTO
        <span style="float:right;background:#c8352e;font-size:.7rem;padding:3px 9px;letter-spacing:.1em">DEPOSIT INTENT</span></div>
      <div style="padding:20px;font-size:.9rem;color:#1a1a1a">
        <p><strong>${lead.email}</strong> started the €15 Custom Design checkout.</p>
        <p style="color:#71717a;font-size:.82rem">Locale: ${lead.locale || '—'} &middot; ${lead.source || ''}</p>
        <p style="color:#71717a;font-size:.8rem;margin-top:14px">If no payment lands, follow up — they raised their hand.</p>
      </div>
    </div>`;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `MOMUTO Leads <${FROM_EMAIL}>`, to: [TEAM_EMAIL], reply_to: lead.email,
      subject: `Deposit intent — ${lead.email} (${lead.locale || 'en'})`, html,
    }),
  });
}

module.exports = async function handler(req, res) {
  const origin = originOf(req);
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!origin) return res.status(403).json({ error: 'Forbidden' });

  try {
    const body = await getBody(req);
    const email = (body.email || '').trim();
    if (!validEmail(email)) return res.status(400).json({ error: 'Invalid email' });

    // Dedupe: the gate can fire twice (double-click, blur + pay-click). If an
    // unpaid deposit_intent lead already exists for this email, don't create a
    // second one and don't re-notify — one intent per email, one email out.
    const idxKey = `depositlead:${email.toLowerCase()}`;
    const existingId = await kv.get(idxKey);
    if (existingId) {
      const existing = await kv.get(`lead:${existingId}`);
      if (existing && !existing.paid) {
        return res.status(200).json({ ok: true, deduped: true });
      }
    }

    const lead = {
      id: `lead_${Date.now()}`,
      receivedAt: new Date().toISOString(),
      type: 'deposit_intent',
      email,
      locale: body.locale || null,
      source: body.source || req.headers['referer'] || null,
      name: null, team: null, qty: null, emailSent: false, emailError: null,
    };
    await kv.set(`lead:${lead.id}`, lead);
    await kv.sadd('leads:all', lead.id);
    await kv.set(idxKey, lead.id); // email -> lead index for dedupe
    try { await notifyTeam(lead); await kv.set(`lead:${lead.id}`, { ...lead, emailSent: true }); }
    catch (e) { await kv.set(`lead:${lead.id}`, { ...lead, emailError: e.message }); }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[lead] error:', err.message);
    return res.status(200).json({ ok: false }); // never block the user's path to Stripe
  }
};
