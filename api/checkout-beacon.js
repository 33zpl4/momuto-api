'use strict';

/**
 * POST /api/checkout-beacon — telemetry from the stores' checkSumbit handoff pages.
 *
 * The 3D checkout handoff (design server -> platform cart) runs in the
 * customer's browser on the store domain, so a failed /homeapi/cart/add used
 * to leave no trace anywhere — order j59hcqcb3y (July 2026) reached checkout
 * with only the 0-euro preview line in the cart and was paid as shipping-only,
 * and we had nothing to diagnose it with. The hardened checkSumbit pages now
 * send ONE report per handoff via navigator.sendBeacon (a plain string, so it
 * posts as text/plain with no preflight).
 *
 * Body (JSON): { source, store, status: 'ok'|'aborted', order_no, events: [...] }
 *
 * Every report is stored in KV (beacon:<id> + set checkout_beacons:all); any
 * report that is not a clean 'ok' also emails the team so a broken handoff is
 * known within minutes, not when the customer's order looks wrong.
 * Best-effort on both ends: always answers 200, never blocks checkout.
 *
 * Env: RESEND_API_KEY, TEAM_EMAIL, FROM_EMAIL (same as /api/lead)
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

// sendBeacon posts text/plain, which Vercel leaves as a raw string body.
function getBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try { return Promise.resolve(JSON.parse(req.body)); } catch (_) { return Promise.resolve({}); }
  }
  return new Promise(resolve => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch (_) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

const clip = (v, n) => String(v == null ? '' : v).slice(0, n);

function sanitizeEvents(events) {
  if (!Array.isArray(events)) return [];
  return events.slice(0, 20).map(e => {
    const out = {};
    for (const [k, v] of Object.entries(e && typeof e === 'object' ? e : {})) {
      out[clip(k, 40)] = clip(typeof v === 'object' ? JSON.stringify(v) : v, 300);
    }
    return out;
  });
}

async function notifyTeam(entry) {
  if (!RESEND_KEY) return;
  const rows = entry.events.map(e =>
    `<tr><td style="padding:4px 10px;color:#c8352e;font-weight:700">${e.t || '?'}</td>
     <td style="padding:4px 10px;font-family:monospace;font-size:.78rem">${
       Object.entries(e).filter(([k]) => k !== 't').map(([k, v]) => `${k}=${v}`).join(' · ') || '—'
     }</td></tr>`).join('');
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;border:1px solid #e4e4e7">
      <div style="background:#0a0a0a;padding:14px 20px;color:#fff;font-weight:800;letter-spacing:.08em">MOMUTO
        <span style="float:right;background:#c8352e;font-size:.7rem;padding:3px 9px;letter-spacing:.1em">CHECKOUT HANDOFF ${entry.status.toUpperCase()}</span></div>
      <div style="padding:20px;font-size:.9rem;color:#1a1a1a">
        <p>3D order <strong>${entry.order_no || '(no order_no)'}</strong> on <strong>${entry.store}</strong>
           did not hand off cleanly to the platform cart.</p>
        <table style="border-collapse:collapse;background:#fafafa;border:1px solid #e4e4e7;width:100%">${rows}</table>
        <p style="color:#71717a;font-size:.8rem;margin-top:14px">
          status=${entry.status} · ${entry.receivedAt} · beacon ${entry.id}<br>
          If status is "aborted" the customer was sent to /cart with a CLEANED cart
          (nothing sellable) — the local order exists but was not paid. Check the
          design-server order and re-contact the customer if needed.</p>
      </div>
    </div>`;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `MOMUTO Orders <${FROM_EMAIL}>`, to: [TEAM_EMAIL],
      subject: `3D checkout handoff ${entry.status} — order ${entry.order_no || '?'} (${entry.store})`, html,
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
    const entry = {
      id: `beacon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      receivedAt: new Date().toISOString(),
      source: clip(body.source, 40) || 'unknown',
      store: clip(body.store, 60) || origin.replace('https://', ''),
      status: clip(body.status, 20) || 'unknown',
      order_no: clip(body.order_no, 40) || null,
      events: sanitizeEvents(body.events),
      ua: clip(req.headers['user-agent'], 200),
    };

    await kv.set(`beacon:${entry.id}`, entry);
    await kv.sadd('checkout_beacons:all', entry.id);
    console.log('[checkout-beacon]', JSON.stringify(entry));

    // 'ok' with zero events is the healthy heartbeat; anything else gets eyes on it.
    if (entry.status !== 'ok' || entry.events.length > 0) {
      try { await notifyTeam(entry); } catch (e) { console.error('[checkout-beacon] notify failed:', e.message); }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[checkout-beacon] error:', err.message);
    return res.status(200).json({ ok: false }); // telemetry must never matter to the caller
  }
};
