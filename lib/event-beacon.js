'use strict';

/**
 * POST /api/event — anonymous funnel counters (weekly scorecard).
 *
 * Served THROUGH /api/lead via a vercel.json rewrite (Hobby: 12 functions, api/ holds exactly 12 — same trick as
 * checkout-beacon and order-view). The tool, the cart page and the checkout hand-off each send ONE tiny beacon per step:
 *
 *   tool_open → design_saved → cart_added → cart_viewed → checkout_clicked   (→ checkout hand-off = checkout-beacon,
 *                                                                              → paid = orders)
 *   wa_chat_click = a click on any WhatsApp link of the on-page assistant (tool + cart), outside the funnel: a help-seeking signal.
 *   faq_open / faq_topic / faq_calc = the assistant panel opened / an answer read / the price calculator used (17 Oct).
 *   card_open / card_made / card_share / card_download = the 3D designer's "Share image" modal opened / the picture rendered /
 *   the share sheet completed / the PNG downloaded (18 Oct; design-momuto static/share-card.js). Outside the funnel: a word-of-mouth signal.
 *
 * Body (JSON as text/plain, via navigator.sendBeacon): { event, sid, store }
 *   sid   = random per-browser-session id made by the page (sessionStorage), NOT a cookie, NOT tied to an account or email.
 *   Stored only as a HyperLogLog (PFADD) + a raw counter per ISO week: you can count distinct sessions but never read one back.
 * Best-effort: always answers 200, never blocks the page.
 */
const { kv } = require('@vercel/kv');
const { isoWeek } = require('./iso-week');

const EVENTS = ['tool_open', 'design_saved', 'cart_added', 'cart_viewed', 'checkout_clicked', 'wa_chat_click', 'faq_open', 'faq_topic', 'faq_calc', 'card_open', 'card_made', 'card_share', 'card_download'];
const STORES = ['www', 'es', 'fr', 'it', 'us', 'design'];
const ALLOWED_ORIGINS = [
  'https://momuto.com', 'https://www.momuto.com', 'https://es.momuto.com', 'https://fr.momuto.com',
  'https://it.momuto.com', 'https://us.momuto.com', 'https://design.momuto.com',
];

function originOf(req) {
  const origin = req.headers['origin'] || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  const referer = req.headers['referer'] || '';
  return ALLOWED_ORIGINS.find(o => referer.startsWith(o)) || null;
}
function getBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') { try { return Promise.resolve(JSON.parse(req.body)); } catch (_) { return Promise.resolve({}); } }
  return new Promise(resolve => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (_) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

module.exports = async function handler(req, res) {
  const origin = originOf(req);
  if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!origin) return res.status(403).json({ error: 'Forbidden' });
  try {
    const body = await getBody(req);
    const event = String(body.event || '');
    const sid = String(body.sid || '');
    if (!EVENTS.includes(event) || !/^[a-z0-9]{8,40}$/i.test(sid)) return res.status(200).json({ ok: false });
    let store = String(body.store || '').toLowerCase();
    if (!STORES.includes(store)) store = origin.replace('https://', '').split('.')[0] === 'momuto' ? 'www' : origin.replace('https://', '').split('.')[0];
    const wk = isoWeek(new Date());
    await Promise.all([
      kv.pfadd(`ev:${wk}:${event}`, sid),
      kv.pfadd(`ev:${wk}:${event}:${store}`, sid),
      kv.incr(`evn:${wk}:${event}`),
    ]);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[event-beacon] error:', err.message);
    return res.status(200).json({ ok: false });
  }
};
module.exports.EVENTS = EVENTS;
