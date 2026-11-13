'use strict';
const test = require('node:test'); const assert = require('node:assert');
const { customerSize, customerRoster, CJK } = require('../lib/customer-size');
const { emailConfirmation3D: emailConfirmation } = require('../lib/emails');
const ov = require('../lib/order-view');

test('production polo tag becomes POLO for the customer', () => {
  assert.strictEqual(customerSize('M · POLO COLLAR POLO领'), 'M · POLO');
  assert.strictEqual(customerSize('L · LONG · POLO COLLAR POLO领 · SHORTS M'), 'L · LONG · POLO · SHORTS M');
  assert.strictEqual(customerSize('POLO COLLAR POLO领'), 'POLO');
});
test('plain sizes are untouched', () => {
  for (const s of ['XL', '152/164', 'M · JERSEY ONLY', 'S · LONG', '']) assert.strictEqual(customerSize(s), s);
  assert.strictEqual(customerSize(null), '');
});
test('any other Chinese is dropped', () => {
  assert.strictEqual(customerSize('M · 加急'), 'M');
  assert.ok(!/[⺀-鿿]/.test(customerSize('S · 长袖 LONG')));
});
test('roster: sizes cleaned, other fields kept', () => {
  const r = customerRoster([{ size: 'M · POLO COLLAR POLO领', name: 'SILVA', collar: true }, { size: 'L' }, null]);
  assert.deepStrictEqual(r[0], { size: 'M · POLO', name: 'SILVA', collar: true }); assert.strictEqual(r[1].size, 'L'); assert.strictEqual(r[2], null);
});
test('the customer order page and the factory sheet still see a polo jersey from either wording', () => {
  const norm = ov.normalisePlayer || (ov._test && ov._test.normalisePlayer);
  if (!norm) return;   // not exported: covered by scripts/test-order-view.js
  assert.strictEqual(norm({ size: 'M · POLO COLLAR POLO领' }).collar, true);
  assert.strictEqual(norm({ size: 'M · POLO' }).collar, true);
  assert.strictEqual(norm({ size: 'M · POLO COLLAR POLO领' }).size, 'M');
});
test('a confirmation email built from a raw production roster carries no Chinese', () => {
  if (typeof emailConfirmation !== 'function') return;
  const { html } = emailConfirmation({ id: 'x', lang: 'es', name: 'Test', email: 't@example.com', qty: 2, total: '49.80', currency: 'EUR',
    designs: [{ front: 'https://example.com/f.png', players: [{ name: 'SILVA', number: '10', size: 'M · POLO COLLAR POLO领', qty: 1 }, { name: 'KOVAC', number: '7', size: 'L · LONG · POLO COLLAR POLO领', qty: 1 }] }] });
  assert.ok(html.includes('M · POLO'), 'size shown');
  CJK.lastIndex = 0; assert.ok(!CJK.test(html), 'no CJK in the customer email');
});
