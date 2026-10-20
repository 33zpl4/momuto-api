'use strict';
// node --test test/wa-twilio.test.js  (offline: in-memory store, no Twilio, no KV)
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const tw = require('../lib/wa-twilio');
const { renderText, MAX } = require('../lib/wa-render-text');
const answers = require('../lib/wa-bot-answers.json');
const bot = require('../lib/wa-bot');

const OPEN = new Date('2026-10-16T10:00:00Z');
function memStore() {
  const m = new Map();
  return { m, key: p => 'h' + crypto.createHash('sha1').update(String(p)).digest('hex').slice(0, 12), get: async k => m.get(k), set: async (k, v) => { m.set(k, v); },
    once: async k => { if (m.has(k)) return false; m.set(k, 1); return true; }, hit: async () => {} };
}
let n = 0;
const msg = (Body, extra = {}) => ({ From: 'whatsapp:+34600111222', To: 'whatsapp:+14155238886', MessageSid: 'SM' + (++n), Body, NumMedia: '0', ...extra });
const run = (p, store, live = true, allowReset = false) => tw.processTwilio(p, { store, now: OPEN, live, allowReset });
const bodies = xml => [...xml.matchAll(/<Message>([\s\S]*?)<\/Message>/g)].map(m => m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'));

test("signature: Twilio's documented example, and tampering is rejected", () => {
  const url = 'https://mycompany.com/myapp.php?foo=1&bar=2';
  const params = { CallSid: 'CA1234567890ABCDE', Caller: '+12349013030', Digits: '1234', From: '+12349013030', To: '+18005551212' };
  assert.equal(tw.twilioSignature(url, params, '12345'), '0/KCTR6DLpKmkAf8muzZqo1nDgQ=');
  assert.ok(tw.validTwilioSignature(url, params, '0/KCTR6DLpKmkAf8muzZqo1nDgQ=', '12345'));
  assert.ok(!tw.validTwilioSignature(url, { ...params, Digits: '9999' }, '0/KCTR6DLpKmkAf8muzZqo1nDgQ=', '12345'));
  assert.ok(!tw.validTwilioSignature(url, params, undefined, '12345')); assert.ok(!tw.validTwilioSignature(url, params, 'x', '12345'));
});
test('prefill greets with the numbered menu; a number answers like a tap; 0 = menu; 10 = person', async () => {
  const st = memStore();
  let r = await run(msg('Hi MOMUTO, I have a question about… (design ref: abc123)'), st);
  let b = bodies(r.xml); assert.equal(r.event, 'greet'); assert.equal(b.length, 1);
  assert.match(b[0], /1 · Prices\n2 · Delivery time/); assert.match(b[0], /10 · Talk to a person/);
  r = await run(msg('1'), st); b = bodies(r.xml); assert.equal(r.event, 'answer:prices'); assert.match(b[0], /€38\.90/); assert.match(b[1], /0 · More topics\n10 · Talk to a person/);
  r = await run(msg('0'), st); assert.match(bodies(r.xml)[0], /Choose a topic:\n1 · Prices/);
  r = await run(msg('10'), st); assert.equal(r.event, 'handoff'); assert.match(bodies(r.xml)[0], /generally within 1–2 hours/);
  r = await run(msg('hello?'), st); assert.equal(r.event, 'muted'); assert.deepEqual(bodies(r.xml), []);
});
test('US store prefill answers in dollars; Spanish in Spanish', async () => {
  assert.match(bodies((await run(msg('Hi MOMUTO, I have a question about the price (US)'), memStore())).xml)[0], /\$45\.90/);
  assert.match(bodies((await run(msg('Hola MOMUTO, tengo una pregunta sobre los plazos de entrega'), memStore())).xml)[0], /25–30 días/);
});
test('dry run replies with nothing; duplicate MessageSid ignored; media hands off; /reset only when allowed', async () => {
  const st = memStore();
  assert.deepEqual(bodies((await run(msg('1'), st, false)).xml), []);
  const dup = msg('1'); await run(dup, st); assert.equal((await run(dup, st)).event, 'duplicate');
  assert.equal((await run(msg('', { NumMedia: '1' }), memStore())).event, 'handoff:media');
  await run(msg('10'), st);
  assert.equal((await run(msg('/reset'), st, true, false)).event, 'muted');           // not allowed: treated as a normal (muted) message
  assert.equal((await run(msg('/reset'), st, true, true)).event, 'reset');
  assert.equal((await run(msg('1'), st)).event, 'answer:prices');
});
test('XML is escaped and every body fits Twilio\'s 1600-character WhatsApp limit', () => {
  assert.equal(tw.twiml(['a & <b>']), '<?xml version="1.0" encoding="UTF-8"?><Response><Message>a &amp; &lt;b&gt;</Message></Response>');
  for (const lang of Object.keys(answers)) for (const t of Object.keys(answers[lang])) for (const b of renderText([{ kind: 'text', body: answers[lang][t] }], lang)) assert.ok(b.length <= MAX, `${lang}.${t}`);
  const long = Array.from({ length: 12 }, (_, i) => 'párrafo '.repeat(40) + i).join('\n\n');
  const parts = renderText([{ kind: 'text', body: long }], 'es'); assert.ok(parts.length > 1 && parts.every(p => p.length <= MAX));
  for (const lang of ['en', 'es', 'fr', 'it']) { const w = renderText([bot.respond({ msg: { kind: 'text', text: 'hi' }, state: { lang }, now: OPEN }).actions[0]], lang); assert.ok(w.join('').includes('10 · ')); }
});
