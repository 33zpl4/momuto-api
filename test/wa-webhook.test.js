'use strict';
// node --test test/wa-webhook.test.js  (offline: in-memory store, captured sends, no Meta, no KV)
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const h = require('../lib/wa-webhook-handler');

const NOW = new Date('2026-10-16T10:00:00Z');
function memStore() {
  const m = new Map(), hits = [];
  return { m, hits, key: p => 'h' + crypto.createHash('sha1').update(String(p)).digest('hex').slice(0, 12), get: async k => m.get(k), set: async (k, v) => { m.set(k, v); },
    once: async k => { if (m.has(k)) return false; m.set(k, 1); return true; }, hit: async (n) => { hits.push(n); } };
}
const inbound = (id, from, msg) => ({ entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: 'PID' }, messages: [{ id, from, ...msg }] } }] }] });
const text = body => ({ type: 'text', text: { body } });
const run = (p, store, sent) => h.processPayload(p, { store, now: NOW, phoneId: 'PID', send: async (to, a) => { sent.push({ to, a }); return 'wamid.' + sent.length; } });

test('signature: valid passes, tampered / missing / wrong secret fail', () => {
  const body = Buffer.from('{"a":"é"}'), good = 'sha256=' + crypto.createHmac('sha256', 's3cret').update(body).digest('hex');
  assert.ok(h.validSignature(body, good, 's3cret'));
  assert.ok(!h.validSignature(Buffer.from('{"a":"e"}'), good, 's3cret'));
  assert.ok(!h.validSignature(body, good, 'other')); assert.ok(!h.validSignature(body, undefined, 's3cret')); assert.ok(!h.validSignature(body, 'sha256=x', 's3cret'));
});
test('a prefill message gets the welcome buttons; a retry of the same id is ignored', async () => {
  const st = memStore(), sent = [];
  await run(inbound('m1', '34600', text('Hi MOMUTO, I have a question about… (US)')), st, sent);
  assert.equal(sent.length, 1); assert.equal(sent[0].a.kind, 'buttons'); assert.equal(sent[0].to, '34600');
  await run(inbound('m1', '34600', text('Hi MOMUTO, I have a question about… (US)')), st, sent);
  assert.equal(sent.length, 1);
  assert.ok(st.hits.includes('wa_bot_greet'));
});
test('a list tap is answered with text + follow-up buttons; phone number never stored in the clear', async () => {
  const st = memStore(), sent = [];
  await run(inbound('m2', '34600', { type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 't:prices', title: 'Prices' } } }), st, sent);
  assert.deepEqual(sent.map(s => s.a.kind), ['text', 'buttons']);
  assert.ok(![...st.m.keys()].some(k => k.includes('34600')));
});
test('handoff mutes the thread; an owner echo from the Business app mutes it too, our own echo does not', async () => {
  const st = memStore(), sent = [];
  await run(inbound('m3', '34601', text('can I talk to a person')), st, sent);
  const n = sent.length;
  await run(inbound('m4', '34601', text('hello??')), st, sent);
  assert.equal(sent.length, n);                                         // muted
  const st2 = memStore(), s2 = [];
  await run(inbound('m5', '34602', text('price')), st2, s2);            // bot answered (state.botSentAt set)
  const echo = id => ({ entry: [{ changes: [{ field: 'smb_message_echoes', value: { metadata: { phone_number_id: 'PID' }, message_echoes: [{ id, to: '34602' }] } }] }] });
  await run(echo('wamid.1'), st2, s2);                                  // our own message echoed: ignored
  await run(inbound('m6', '34602', text('delivery?')), st2, s2);
  assert.ok(s2.length > 2);                                             // still answering
  const k2 = 'wa:s:' + st2.key('34602'); st2.m.set(k2, { ...st2.m.get(k2), botSentAt: 0 });
  await run(echo('wamid.zzz'), st2, s2);                                // the owner typing from the phone
  const before = s2.length;
  await run(inbound('m7', '34602', text('and sizes?')), st2, s2);
  assert.equal(s2.length, before);
});
test('voice notes / images hand off; reactions and other numbers are ignored', async () => {
  const st = memStore(), sent = [];
  await run(inbound('m8', '34603', { type: 'image', image: { id: 'x' } }), st, sent);
  assert.match(sent[0].a.body, /studio/);
  await run(inbound('m9', '34604', { type: 'reaction', reaction: { emoji: '👍' } }), st, sent);
  const other = inbound('m10', '34605', text('price')); other.entry[0].changes[0].value.metadata.phone_number_id = 'OTHER';
  const n = sent.length; await run(other, st, sent); assert.equal(sent.length, n);
});
test('Cloud API payload shapes', () => {
  const b = h.payloadFor('1', { kind: 'buttons', body: 'x', buttons: [{ id: 'a', title: 'A' }] });
  assert.equal(b.interactive.action.buttons[0].reply.title, 'A');
  const l = h.payloadFor('1', { kind: 'list', body: 'x', button: 'Topics', rows: [{ id: 't:prices', title: 'Prices' }] });
  assert.equal(l.interactive.action.sections[0].rows[0].id, 't:prices');
});
