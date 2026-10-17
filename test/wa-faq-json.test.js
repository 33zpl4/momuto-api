'use strict';
// node --test test/wa-faq-json.test.js : public/wa-faq.json (fetched by the on-page assistant in design-momuto wa-chat.js)
const test = require('node:test');
const assert = require('node:assert');
const j = require('../public/wa-faq.json');
const answers = require('../lib/wa-bot-answers.json');

const LOCALES = ['en', 'us', 'es', 'fr', 'it'];
const UI_KEYS = ['title', 'pick', 'back', 'close', 'other', 'human', 'still', 'waAbout', 'today', 'tomorrow', 'at', 'madrid', 'hoursTitle', 'hoursWeek', 'online', 'offline',
  'cQty', 'cMinus', 'cPlus', 'cUnit', 'cSub', 'cShip', 'cFree', 'cTotal', 'cGift', 'cGiftMore', 'cGiftKit', 'cNext', 'cNote', 'cLadder'];
test('every locale has the 9 topics, all UI strings and the same ids', () => {
  for (const loc of LOCALES) {
    const d = j.locales[loc];
    assert.deepEqual(d.topics.map(t => t.id), ['prices', 'delivery', 'extras', 'fabric', 'printing', 'sizes', 'design', 'returns', 'hours'], loc);
    for (const k of UI_KEYS) assert.ok(d.ui[k] && String(d.ui[k]).length >= 1, `${loc}.ui.${k}`);
    assert.match(d.ui.offline, /\{l\}/); assert.match(d.ui.waAbout, /\{t\}/); assert.match(d.ui.cGiftMore, /\{n\}/); assert.match(d.ui.cNext, /\{n\}.*\{p\}|\{p\}.*\{n\}/);
    for (const t of d.topics) { assert.ok(t.title.length > 2); if (t.id === 'hours') assert.equal(t.answer, null); else assert.equal(t.answer, answers[loc][t.id], `${loc}.${t.id} = the WhatsApp bot answer`); }
  }
});
test('no free-text matching data any more (the panel is topic buttons only)', () => { assert.equal(j.keywords, undefined); for (const loc of LOCALES) assert.equal(j.locales[loc].ui.ask, undefined); });
test('price calculator data = the FAQ ladder, per locale', () => {
  for (const loc of LOCALES) {
    const faq = require(`../faq/faq.${loc}.json`).pricing, c = j.locales[loc].calc;
    assert.equal(c.tiers.length, 7); assert.equal(c.tiers[0][0], 1); assert.equal(c.tiers[6][1], null); assert.equal(c.giftFrom, 10);
    c.tiers.forEach((t, i) => { const n = s => parseFloat(String(s).replace(/[^\d.,]/g, '').replace(',', '.')); assert.equal(t[2], n(faq.rows[i][1]), `${loc} jersey ${t[0]}`); assert.equal(t[3], n(faq.rows[i][3]), `${loc} kit ${t[0]}`); });
    assert.equal(c.currency, loc === 'us' ? 'USD' : 'EUR');
    assert.equal(c.freeFrom, loc === 'us' ? 59 : 50); assert.equal(c.shipFee, loc === 'us' ? 4.9 : 3.9);
    assert.ok(c.jersey && c.kit);
  }
});
test('the flag + captain armband is for 10 KITS (jersey + shorts) on every prices answer, never for jerseys alone', () => { for (const loc of LOCALES) { assert.match(answers[loc].prices, /10 kits? \(/i, loc); assert.match(j.locales[loc].ui.cGiftKit, /10 kits? \(/i, loc); } });
test('the widget JSON stays small (loaded on first panel open)', () => assert.ok(JSON.stringify(j).length < 45000));
