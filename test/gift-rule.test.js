'use strict';
// node --test test/gift-rule.test.js : the free team flag + captain armband is for 10 KITS (jersey + shorts), never for jerseys alone (owner, 17 Oct 2026)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const P = require('../public/configurator/pricing.js');
const widget = require('../public/wa-faq.json');

test('pricing.js: 10 or more KITS qualify, jerseys never do', () => {
  assert.equal(P.GIFT_MIN_KITS, 10);
  assert.equal(P.giftEligible('kit', 10), true); assert.equal(P.giftEligible('kit', '12'), true); assert.equal(P.giftEligible('kit', 9), false);
  assert.equal(P.giftEligible('jersey', 10), false); assert.equal(P.giftEligible('jersey', 500), false); assert.equal(P.giftEligible('shorts', 50), false);
});
test('every surface states the same rule: FAQ note + FAQ question (5 locales), llms.txt (EU + US), widget JSON', () => {
  for (const loc of ['en', 'us', 'es', 'fr', 'it']) {
    const faq = require(`../faq/faq.${loc}.json`);
    assert.ok(faq.pricing.notes.some(n => /\b10\b/.test(n) && /kit/i.test(n)), `${loc}: pricing note`);
    assert.ok(faq.sections.find(s => s.id === 'ordering').items.some(i => /\b10\b/.test(i[1]) && /kit/i.test(i[1])), `${loc}: ordering question`);
    assert.equal(widget.locales[loc].calc.giftFrom, P.GIFT_MIN_KITS, `${loc}: widget threshold = pricing.js`);
  }
  for (const f of ['static/shared/llms.txt', 'static/us.momuto.com/llms.txt']) {
    const t = fs.readFileSync(f, 'utf8');
    assert.match(t, /^- Gift: orders of 10 or more full kits \(jersey \+ shorts\) include a free team flag and captain armband\. Jersey-only orders do not receive the gift\.$/m, f);
  }
});

test('Ready to Play widget (embed.js) states the gift as "10+ kits" in all 4 languages, never "pieces", and only in kit mode', () => {
  const src = fs.readFileSync('public/configurator/embed.js', 'utf8');
  assert.equal((src.match(/10\+ kits?/g) || []).length, 8);   // flag + armband x en/fr/es/it
  assert.doesNotMatch(src, /10\+ (pieces|pi[èe]ces|piezas|pezzi)/);
  assert.match(src, /getElementById\("promo"\)\.style\.display=\(state\.kit==="kit"\)\?"block":"none"/);
});
