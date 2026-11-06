'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { emailAbandoned, emailReorder } = require('../lib/emails');
const LANGS = ['en', 'us', 'es', 'fr', 'it'];
const clean = (html) => { assert(!/undefined|null|\[object|\$\{/.test(html), 'leftover placeholder'); assert(/<div style="font-family/.test(html)); };
test('abandoned: every language renders, with renders, count, cart link and reply line', () => {
  for (const lang of LANGS) {
    const { subject, html } = emailAbandoned({ lang, name: 'Lina', images: ['https://cdn.staticsoe.com/pics/a.jpg', 'https://cdn.staticsoe.com/pics/b.jpg', 'http://x/c.jpg'], itemCount: 26, total: lang === 'us' ? '$349.70' : '349,70 €', cartUrl: 'https://es.momuto.com/cart' });
    assert(subject.length > 10); clean(html);
    assert.strictEqual((html.match(/<img /g) || []).length, 2, 'two https renders only');
    assert(html.includes('Lina,')); assert(html.includes('/cart')); assert(html.includes('26'));
    assert(html.includes(lang === 'us' ? '$45.90' : '38,90') || html.includes('€38.90'));
    assert(!html.includes('refund'));
  }
});
test('abandoned: no name, no renders, no count still renders', () => {
  const { html } = emailAbandoned({ lang: 'fr', images: [], itemCount: 0 });
  clean(html); assert(!html.includes('<img')); assert(html.includes('Bonjour,'));
});
test('reorder: every language carries the code, the expiry, the fabric, 10% and the CTA', () => {
  for (const lang of LANGS) {
    const { subject, html } = emailReorder({ lang, name: 'Marc', team: 'FC Grinta', code: 'KIT10-ABC123', expires: '20 November 2026', image: 'https://cdn.staticsoe.com/pics/a.jpg', ctaUrl: 'https://www.momuto.com/pages/jersey-maker', priceUrl: 'https://www.momuto.com/pages/custom-football-kit-prices' });
    assert(subject.includes('FC Grinta') && /10 ?%/.test(subject)); clean(html);
    assert(html.includes('KIT10-ABC123') && html.includes('20 November 2026') && /92 ?% /.test(html) && html.includes('jersey-maker'));
    assert(!/38,90|21,90|\$45|\$25/.test(html), 'no ladder prices in the reorder mail');
  }
});
test('reorder: html-escapes team and code', () => {
  const { html } = emailReorder({ lang: 'en', team: '<b>x</b>', code: 'A<B', expires: 'x' });
  assert(!html.includes('<b>x</b>')); assert(html.includes('A&lt;B'));
});
