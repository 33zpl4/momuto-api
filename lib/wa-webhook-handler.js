'use strict';
/**
 * WhatsApp Cloud API webhook (16 Oct 2026): the I/O around lib/wa-bot.js. Served at /api/wa-webhook, which vercel.json
 * rewrites onto api/stripe-webhook.js?type=wa-webhook (api/ is full at 12 functions; that function already reads the
 * raw body, which Meta's X-Hub-Signature-256 check needs). Runbook: docs/live-chat-whatsapp.md.
 *
 *   GET  ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…   Meta's one-time subscription handshake
 *   POST signed delivery: customer messages (field "messages") and, with coexistence, the owner's own replies
 *        from the WhatsApp Business app (field "smb_message_echoes", name per Meta docs, NOT yet seen live)
 *
 * Env: WA_VERIFY_TOKEN, WA_APP_SECRET, WA_ACCESS_TOKEN, WA_PHONE_NUMBER_ID, WA_GRAPH_VERSION (default v23.0, check
 *      Meta's current version), WA_LIVE=true to actually send (anything else = DRY RUN: the actions are logged, nothing is sent).
 * Privacy: no message text is stored. Per customer we keep {lang, miss, mute window, design ref} under a keyed hash of the
 * phone number for 2 days; counters are HyperLogLog + totals under the same ev:* keys as the funnel beacon.
 */
const crypto = require('crypto');
const bot = require('./wa-bot');
const tw = require('./wa-twilio');
const { isoWeek } = require('./iso-week');

const STATE_TTL = 2 * 86400;
const ECHO_GUARD_MS = 20 * 1000;      // an echo this soon after our own send is treated as ours

function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function validSignature(buf, header, secret) {
  if (!header || !secret) return false;
  const want = Buffer.from('sha256=' + crypto.createHmac('sha256', secret).update(buf).digest('hex'));
  const got = Buffer.from(String(header));
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}
const keyOf = (phone, secret) => crypto.createHmac('sha256', secret || 'x').update(String(phone)).digest('hex').slice(0, 32);

/** Cloud API message object -> the bot's { kind, text, id }, or null to ignore (reactions, stickers, statuses…). */
function toMsg(m) {
  if (m.type === 'text') return { kind: 'text', text: (m.text && m.text.body) || '' };
  if (m.type === 'interactive' && m.interactive) {
    const r = m.interactive.button_reply || m.interactive.list_reply;
    return r ? { kind: 'reply', id: r.id } : null;
  }
  if (['image', 'audio', 'voice', 'video', 'document', 'location', 'contacts'].includes(m.type)) return { kind: 'media' };
  return null;
}
function payloadFor(to, a) {
  const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to };
  if (a.kind === 'text') return { ...base, type: 'text', text: { body: a.body, preview_url: false } };
  if (a.kind === 'buttons') return { ...base, type: 'interactive', interactive: { type: 'button', body: { text: a.body }, action: { buttons: a.buttons.map(b => ({ type: 'reply', reply: { id: b.id, title: b.title } })) } } };
  return { ...base, type: 'interactive', interactive: { type: 'list', body: { text: a.body }, action: { button: a.button, sections: [{ rows: a.rows.map(r => ({ id: r.id, title: r.title })) }] } } };
}

function liveSender(cfg) {
  return async function send(to, a) {
    const url = `https://graph.facebook.com/${cfg.version}/${cfg.phoneId}/messages`;
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payloadFor(to, a)) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) return j.messages && j.messages[0] && j.messages[0].id;
      if (r.status < 500) throw new Error(`graph ${r.status} ${JSON.stringify(j.error || j).slice(0, 300)}`);
    }
    throw new Error('graph 5xx twice');
  };
}
function dryRunSender() {
  return async (to, a) => { console.log('[wa] DRY RUN would send', a.kind, JSON.stringify(a).slice(0, 400)); return null; };
}
function kvStore(secret) {
  const { kv } = require('@vercel/kv');
  return {
    key: p => keyOf(p, secret),
    get: k => kv.get(k),
    set: (k, v, ex) => kv.set(k, v, { ex }),
    once: async (k, ex) => (await kv.set(k, 1, { nx: true, ex })) !== null,
    hit: async (name, who) => { const wk = isoWeek(new Date()); await Promise.all([kv.pfadd(`ev:${wk}:${name}`, who), kv.incr(`evn:${wk}:${name}`)]); },
  };
}

/** Process one verified delivery. Pure of Express; store/send/now are injected so test/wa-webhook.test.js runs it offline. */
async function processPayload(payload, { store, send, now, phoneId, secret }) {
  const out = [];
  for (const entry of (payload && payload.entry) || []) for (const ch of entry.changes || []) {
    const v = ch.value || {};
    if (phoneId && v.metadata && v.metadata.phone_number_id && v.metadata.phone_number_id !== phoneId) continue;
    if (ch.field === 'smb_message_echoes') {                        // the owner answered from the Business app: bot steps back
      for (const e of v.message_echoes || []) {
        const sk = 'wa:s:' + store.key(e.to), st = (await store.get(sk)) || {};
        if (await store.get('wa:own:' + e.id)) continue;           // our own send echoed back
        if (st.botSentAt && now.getTime() - st.botSentAt < ECHO_GUARD_MS) continue;
        st.muteFrom = now.getTime(); st.muteUntil = now.getTime() + bot.MUTE_MS;
        await store.set(sk, st, STATE_TTL); out.push({ echo: true });
      }
      continue;
    }
    if (ch.field !== 'messages') continue;
    for (const m of v.messages || []) {
      const msg = toMsg(m);
      if (!msg || !m.from) continue;
      if (!(await store.once('wa:seen:' + m.id, 86400))) continue;  // Meta retries; never answer twice
      const sk = 'wa:s:' + store.key(m.from);
      const res = bot.respond({ msg, state: (await store.get(sk)) || {}, now });
      let sent = 0;
      try {
        for (const a of res.actions) { const id = await send(m.from, a); sent++; if (id) await store.set('wa:own:' + id, 1, 86400); }
      } catch (err) { console.error('[wa] send failed:', err.message); }
      if (sent) res.state.botSentAt = now.getTime();
      await store.set(sk, res.state, STATE_TTL);
      const name = res.event.split(':')[0];
      console.log(`[wa] event=${res.event} lang=${res.state.lang} sent=${sent}`);
      if (name !== 'muted') await store.hit('wa_bot_' + name, store.key(m.from)).catch(() => {});
      out.push({ event: res.event, sent });
    }
  }
  return out;
}

async function twilioHandler(req, res) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) { console.error('[wa/twilio] TWILIO_AUTH_TOKEN not set'); return res.status(500).json({ error: 'Not configured' }); }
  let buf;
  try { buf = await rawBody(req); } catch { return res.status(400).json({ error: 'Bad body' }); }
  const params = Object.fromEntries(new URLSearchParams(buf.toString('utf8')));
  const url = process.env.TWILIO_WEBHOOK_URL || tw.DEFAULT_URL;
  if (!tw.validTwilioSignature(url, params, req.headers['x-twilio-signature'], token)) { console.warn('[wa/twilio] bad signature (is TWILIO_WEBHOOK_URL exactly the URL in the Twilio console?)'); return res.status(403).send('Invalid signature'); }
  let xml = tw.twiml([]);
  try {
    const out = await tw.processTwilio(params, { store: kvStore(token), now: new Date(), live: process.env.TWILIO_LIVE === 'true', allowReset: process.env.WA_ALLOW_RESET === 'true' });
    xml = out.xml;
  } catch (err) { console.error('[wa/twilio] processing error:', err.message); }
  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send(xml);
}

async function handler(req, res) {
  const cfg = {
    verify: process.env.WA_VERIFY_TOKEN, secret: process.env.WA_APP_SECRET, token: process.env.WA_ACCESS_TOKEN,
    phoneId: process.env.WA_PHONE_NUMBER_ID, version: process.env.WA_GRAPH_VERSION || 'v23.0', live: process.env.WA_LIVE === 'true',
  };
  if (req.method === 'GET') {
    const q = req.query || {};
    if (cfg.verify && q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === cfg.verify) return res.status(200).send(String(q['hub.challenge'] || ''));
    return res.status(403).send('Forbidden');
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers['x-twilio-signature']) return twilioHandler(req, res);   // Twilio test channel (lib/wa-twilio.js)
  if (!cfg.secret) { console.error('[wa] WA_APP_SECRET not set'); return res.status(500).json({ error: 'Not configured' }); }
  let buf;
  try { buf = await rawBody(req); } catch { return res.status(400).json({ error: 'Bad body' }); }
  if (!validSignature(buf, req.headers['x-hub-signature-256'], cfg.secret)) { console.warn('[wa] bad signature'); return res.status(401).json({ error: 'Invalid signature' }); }
  let payload;
  try { payload = JSON.parse(buf.toString('utf8')); } catch { return res.status(400).json({ error: 'Bad JSON' }); }
  try {
    const send = cfg.live && cfg.token && cfg.phoneId ? liveSender(cfg) : dryRunSender();
    await processPayload(payload, { store: kvStore(cfg.secret), send, now: new Date(), phoneId: cfg.phoneId, secret: cfg.secret });
  } catch (err) { console.error('[wa] processing error:', err.message); }   // still 200: Meta must not retry-storm
  return res.status(200).json({ received: true });
}

module.exports = handler;
module.exports.processPayload = processPayload;
module.exports.validSignature = validSignature;
module.exports.toMsg = toMsg;
module.exports.payloadFor = payloadFor;
