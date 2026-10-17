'use strict';
// node --test test/wa-faq-json.test.js : public/wa-faq.json (fetched by the on-page assistant in design-momuto wa-chat.js)
const test = require('node:test');
const assert = require('node:assert');
const j = require('../public/wa-faq.json');
const answers = require('../lib/wa-bot-answers.json');

const LOCALES = ['en', 'us', 'es', 'fr', 'it'];
const UI_KEYS = ['title', 'pick', 'ask', 'send', 'back', 'close', 'other', 'human', 'still', 'noMatch', 'waAbout', 'waFree', 'today', 'tomorrow', 'at', 'madrid', 'hoursTitle', 'hoursWeek', 'online', 'offline'];
test('every locale has the 9 topics, all UI strings and the same ids', () => {
  for (const loc of LOCALES) {
    const d = j.locales[loc];
    assert.deepEqual(d.topics.map(t => t.id), ['prices', 'delivery', 'extras', 'fabric', 'printing', 'sizes', 'design', 'returns', 'hours'], loc);
    for (const k of UI_KEYS) assert.ok(d.ui[k] && String(d.ui[k]).length >= 1, `${loc}.ui.${k}`);
    assert.match(d.ui.offline, /\{l\}/); assert.match(d.ui.waAbout, /\{t\}/); assert.match(d.ui.waFree, /\{t\}/);
    for (const t of d.topics) { assert.ok(t.title.length > 2); if (t.id === 'hours') assert.equal(t.answer, null); else assert.equal(t.answer, answers[loc][t.id], `${loc}.${t.id} = the WhatsApp bot answer`); }
  }
});
test('keywords compile as the widget compiles them, and every topic plus "human" has some', () => {
  for (const topic of ['human', 'hours', 'prices', 'delivery', 'extras', 'fabric', 'printing', 'sizes', 'design', 'returns']) {
    assert.ok(j.keywords[topic] && j.keywords[topic].length > 3, topic);
    for (const k of j.keywords[topic]) assert.doesNotThrow(() => new RegExp('(^| )' + k), `${topic}: ${k}`);
  }
});
test('the widget JSON stays small (loaded on first panel open)', () => assert.ok(JSON.stringify(j).length < 45000));
