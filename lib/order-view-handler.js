'use strict';

/**
  * POST /api/order-view   Body: { ref, k?, email? }
 * Read-only feed behind the customer "My order" page on each store (docs/order-view.md).
 * Access = valid link token `k` (from our emails) OR the order's email. Every refusal is the
 * same generic 404 so refs cannot be probed. Response is a whitelist (lib/order-view.js):
 * no email, address or prices.
 */
const { kv } = require('@vercel/kv');
const V = require('./order-view');

const ORIGIN_RE = /^https:\/\/([a-z0-9-]+\.)?momuto\.com$/i;
const DESIGN_API = 'https://design.momuto.com/Order/getGoods';

function cors(req, res) {
  const o = req.headers.origin || '';
  if (ORIGIN_RE.test(o)) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
}
function readJSON(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise(resolve => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 4096) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}
async function hit(key, limit, ttl) {
  try {
    const n = await kv.incr(key);
    if (n === 1) await kv.expire(key, ttl);
    return n > limit;
  } catch { return false; }   // rate-limit store down: fail open, the token/email check still applies
}
const notFound = res => res.status(404).json({ ok: false, error: 'not_found' });

async function fetchRoster(ref) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(`${DESIGN_API}?order_no=${encodeURIComponent(ref)}&oem_no=&uuid=`, { signal: ctl.signal });
    const j = await r.json();
    if (!j || j.code !== 200 || !Array.isArray(j.data)) return null;
    return j.data.map(g => ({ front: g.urlThumbnailFront, back: g.urlThumbnailBack, players: g.info || [] }));
  } catch { return null; } finally { clearTimeout(t); }
}

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' });

  const body = await readJSON(req);
  const ref = String(body.ref || '').trim();
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  if (await hit(`ov:ip:${ip}`, 30, 3600)) return res.status(429).json({ ok: false, error: 'rate' });
  if (!V.REF_RE.test(ref)) return notFound(res);

  let order = null;
  try { order = await kv.get(`order:3d_${ref.toLowerCase()}`) || await kv.get(`order:3d_${ref}`); } catch { return res.status(503).json({ ok: false, error: 'unavailable' }); }

  let allowed = false;
  if (order && V.tokenOk(ref, body.k)) allowed = true;
  else if (typeof body.email === 'string' && body.email) {
    if (await hit(`ov:ref:${ref.toLowerCase()}`, 8, 3600)) return res.status(429).json({ ok: false, error: 'rate' });
    allowed = !!order && String(order.email || '').trim().toLowerCase() === body.email.trim().toLowerCase();
  }
  if (!allowed || !V.is3D(order) || !V.VISIBLE_STATUSES.includes(order.status || 'active')) return notFound(res);

  let designs = (order.designs || []).filter(d => d && (d.players || []).length);
  if (!designs.length) designs = await fetchRoster(order.ref) || order.designs || [];
  return res.status(200).json({ ok: true, order: V.publicOrder(order, designs) });
};
