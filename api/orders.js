'use strict';

/**
 * GET  /api/orders          — list all orders (admin)
 * POST /api/orders          — create order, send confirmation email
 *
 * Auth: x-admin-token header must match ADMIN_TOKEN env var
 */

const { kv } = require('@vercel/kv');

const RESEND_KEY  = process.env.RESEND_API_KEY;
const FROM_EMAIL  = process.env.FROM_EMAIL_ORDERS || process.env.FROM_EMAIL || 'orders@momuto.com';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// ── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorised(req) {
  return req.headers['x-admin-token'] === ADMIN_TOKEN;
}

// ── Body parser ───────────────────────────────────────────────────────────────

function readJSON(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

// ── Email ─────────────────────────────────────────────────────────────────────

async function sendEmail(to, subject, html) {
  if (!RESEND_KEY) { console.warn('[orders] RESEND_API_KEY not set'); return; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `MOMUTO <${FROM_EMAIL}>`, to: [to], subject, html }),
  });
  if (!r.ok) console.error('[orders] Resend error:', r.status, await r.text());
}

function emailConfirmation(order) {
  const subject = `Your MOMUTO order is confirmed — ${order.ref}`;
  const html = `
<div style="font-family:'Outfit',Arial,sans-serif;max-width:580px;margin:0 auto;border:1px solid #e4e4e7">
  <div style="background:#0a0a0a;padding:18px 24px">
    <span style="font-size:1.4rem;font-weight:800;color:#fff;letter-spacing:0.08em">MOMUTO</span>
  </div>
  <div style="padding:32px 24px">
    <p style="margin:0 0 8px;font-size:0.82rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#c8352e">Order Confirmed</p>
    <h2 style="margin:0 0 24px;font-size:1.3rem;color:#0a0a0a;font-weight:700">Hi ${order.name},<br>your kits are in the works.</h2>
    <p style="margin:0 0 24px;font-size:0.95rem;color:#3a3a3a;line-height:1.7">
      We've received your order for <strong>${order.team}</strong> (${order.qty} kits).<br>
      Our design team is finalising everything and production will kick off shortly.
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
      We'll keep you updated at each step. Next update: when your kits enter production.
    </p>
    <p style="font-size:0.75rem;color:#a1a1aa;margin:0;padding-top:16px;border-top:1px solid #e4e4e7">
      Questions? Reply to this email — we're always here.
    </p>
  </div>
</div>`;
  return { subject, html };
}

// ── KV helpers ────────────────────────────────────────────────────────────────

async function saveOrder(order) {
  await kv.set(`order:${order.id}`, order);
  await kv.sadd('orders:active', order.id);
}

async function listOrders() {
  const ids = (await kv.smembers('orders:active')) || [];
  if (!ids.length) return [];
  const orders = await Promise.all(ids.map(id => kv.get(`order:${id}`)));
  return orders
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// ── Handler ───────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'x-admin-token, content-type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!isAuthorised(req)) return res.status(401).json({ error: 'Unauthorised' });

  // ── GET: list orders ──────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const orders = await listOrders();
    return res.status(200).json({ orders });
  }

  // ── POST: create order ────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = await readJSON(req);
    const { name, email, team, qty, ref, orderDate, notes, backdated } = body;

    if (!name || !email || !team) {
      return res.status(400).json({ error: 'name, email and team are required' });
    }

    const id = `ord_${Date.now()}`;
    const order = {
      id,
      name,
      email,
      team,
      qty:       qty || '—',
      ref:       ref || id,
      orderDate: orderDate || new Date().toISOString().slice(0, 10),
      notes:     notes || null,
      emailsSent:     backdated ? ['confirmation', 'day4', 'day10'] : ['confirmation'],
      trackingNumber: null,
      trackingUrl:    null,
      status:    'active',
      createdAt: new Date().toISOString(),
    };

    await saveOrder(order);

    const { subject, html } = emailConfirmation(order);
    await sendEmail(order.email, subject, html);

    console.log(`[orders] created ${id} for ${team} (${email})`);
    return res.status(201).json({ ok: true, id });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
