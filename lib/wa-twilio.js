'use strict';
/**
 * Twilio WhatsApp channel for the assistant (16 Oct 2026): a TEST path while Meta's own app cannot get the WhatsApp product
 * (docs/live-chat-whatsapp.md). Twilio POSTs form fields to /api/wa-webhook (same rewrite as Meta; told apart by the
 * X-Twilio-Signature header) and we answer in the HTTP response as TwiML, so there are no outbound API calls and the only
 * secret is TWILIO_AUTH_TOKEN (used to check the signature).
 *
 * Env: TWILIO_AUTH_TOKEN (required), TWILIO_LIVE=true to reply (anything else = DRY RUN: empty reply + log),
 *      TWILIO_WEBHOOK_URL (default https://momuto-api.vercel.app/api/wa-webhook; must equal the URL typed in the Twilio console),
 *      WA_ALLOW_RESET=true lets a tester send "/reset" to clear their own state (e.g. after a handoff mutes the bot for 12 h).
 * Differences from Meta: menus are numbered text (lib/wa-render-text.js); there is NO Business-app echo, so nothing mutes the
 * bot when a human answers from a phone; the owner only sees chats in the Twilio console.
 */
const crypto = require('crypto');
const bot = require('./wa-bot');
const { renderText } = require('./wa-render-text');

const DEFAULT_URL = 'https://momuto-api.vercel.app/api/wa-webhook';
const STATE_TTL = 2 * 86400;

/** Twilio's documented scheme: base64(HMAC-SHA1(token, url + each POST param name+value, names sorted)). */
function twilioSignature(url, params, token) {
  const data = url + Object.keys(params).sort().map(k => k + params[k]).join('');
  return crypto.createHmac('sha1', token).update(data).digest('base64');
}
function validTwilioSignature(url, params, header, token) {
  if (!header || !token) return false;
  const want = Buffer.from(twilioSignature(url, params, token)), got = Buffer.from(String(header));
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const twiml = bodies => `<?xml version="1.0" encoding="UTF-8"?><Response>${bodies.map(b => `<Message>${esc(b)}</Message>`).join('')}</Response>`;

/** One verified inbound message -> { xml, event }. store = { key, get, set, once, hit } as in wa-webhook-handler. */
async function processTwilio(params, { store, now, live, allowReset }) {
  const from = String(params.From || '').replace(/^whatsapp:/, '');
  if (!from) return { xml: twiml([]), event: 'ignored' };
  if (params.MessageSid && !(await store.once('wa:seen:' + params.MessageSid, 86400))) return { xml: twiml([]), event: 'duplicate' };
  const sk = 'wa:s:' + store.key(from);
  const text = String(params.Body || '');
  if (allowReset && text.trim().toLowerCase() === '/reset') {
    await store.set(sk, {}, STATE_TTL);
    return { xml: live ? twiml(['OK, reset.']) : twiml([]), event: 'reset' };
  }
  const media = +params.NumMedia > 0;
  const res = bot.respond({ msg: media ? { kind: 'media' } : { kind: 'text', text }, state: (await store.get(sk)) || {}, now });
  await store.set(sk, res.state, STATE_TTL);
  const bodies = renderText(res.actions, res.state.lang);
  const name = res.event.split(':')[0];
  console.log(`[wa/twilio] event=${res.event} lang=${res.state.lang} messages=${bodies.length} live=${live}`);
  if (name !== 'muted') await store.hit('wa_bot_' + name, store.key(from)).catch(() => {});
  if (!live) { console.log('[wa/twilio] DRY RUN would reply', JSON.stringify(bodies).slice(0, 400)); return { xml: twiml([]), event: res.event }; }
  return { xml: twiml(bodies), event: res.event };
}

module.exports = { processTwilio, twilioSignature, validTwilioSignature, twiml, DEFAULT_URL };
