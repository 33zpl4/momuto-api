'use strict';

/**
 * GET   /api/orders  — list all orders
 * POST  /api/orders  — create order (no email — awaiting payment)
 * PATCH /api/orders  — mark order as paid → sends confirmation, starts lifecycle
 */

const { kv } = require('@vercel/kv');
const { emailConfirmation } = require('../lib/emails');

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

// ── KV helpers ────────────────────────────────────────────────────────────────

async function saveOrder(order) {
  await kv.set(`order:${order.id}`, order);
  await kv.sadd('orders:all', order.id);
}

async function listOrders() {
  const ids = (await kv.smembers('orders:all')) || [];
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

  // ── GET: list all orders ──────────────────────────────────────────────────
  if (req.method === 'GET') {
    const orders = await listOrders();
    return res.status(200).json({ orders });
  }

  // ── POST: create order (pending payment, no email) ────────────────────────
  if (req.method === 'POST') {
    const body = await readJSON(req);
    const { name, email, team, qty, ref, orderDate, notes, lang } = body;

    if (!name || !email || !team) {
      return res.status(400).json({ error: 'name, email and team are required' });
    }

    const id = `ord_${Date.now()}`;
    const order = {
      id,
      name,
      email,
      team,
      qty:         qty || '—',
      ref:         ref || id,
      invoiceDate: orderDate || new Date().toISOString().slice(0, 10),
      notes:       notes || null,
      lang:        ['en','es','fr','it'].includes(lang) ? lang : 'en',
      paidAt:      null,
      emailsSent:     [],
      trackingNumber: null,
      trackingUrl:    null,
      status:    'pending_payment',
      createdAt: new Date().toISOString(),
    };

    await saveOrder(order);
    console.log(`[orders] created ${id} for ${team} — awaiting payment`);
    return res.status(201).json({ ok: true, id });
  }

  // ── PATCH: mark as paid → send confirmation, start lifecycle ──────────────
  if (req.method === 'PATCH') {
    const { id } = await readJSON(req);
    if (!id) return res.status(400).json({ error: 'id is required' });

    const order = await kv.get(`order:${id}`);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.paidAt) return res.status(409).json({ error: 'Already marked as paid' });

    const updated = {
      ...order,
      paidAt:     new Date().toISOString(),
      status:     'active',
      emailsSent: ['confirmation'],
    };

    await kv.set(`order:${id}`, updated);
    await kv.sadd('orders:active', id);

    const { subject, html } = emailConfirmation(updated);
    await sendEmail(updated.email, subject, html);

    console.log(`[orders] ${id} marked as paid — confirmation sent`);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
