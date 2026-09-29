'use strict';
// node scripts/test-order-lines.js — line classification + the two emails' counts.
const assert = require('assert');
const { classifyLine, countLines } = require('../lib/order-lines');
const { emailConfirmation3D } = require('../lib/emails');
let pass = 0; const t = (name, fn) => { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { console.log('FAIL ' + name + '\n   ' + e.message); process.exitCode = 1; } };

const preview = { product_id: 99, title: 'Your custom design — order c4zw4sv0pk', price: '0.00', quantity: 1, inner_title: JSON.stringify({ type: '3d-preview', order_no: 'c4zw4sv0pk' }) };
const isPreview = (it) => { try { return JSON.parse(it.inner_title || '{}').type === '3d-preview'; } catch { return false; } };
const L = (product_id, title, quantity, price = '10', variant_title = '') => ({ product_id, title, quantity, price, variant_title });

// The Egarenca shape (es store): 22 jerseys over three lines + 18 shorts = 40 lines' worth of units
const egarenca = [preview,
  L(3800026, 'Camiseta MOMUTO Pro', 16, '21.90', 'M'), L(3800026, 'Camiseta MOMUTO Pro', 3, '21.90', 'L'), L(3800026, 'Camiseta MOMUTO Pro', 3, '21.90', 'S'),
  L(3800028, 'Pantalones MOMUTO', 18, '5.00', 'M')];

t('Egarenca: 22 jerseys, 18 shorts — not 40 jerseys', () => {
  const c = countLines(egarenca, isPreview);
  assert.strictEqual(c.jerseys, 22); assert.strictEqual(c.shorts, 18); assert.strictEqual(c.socks, 0);
});

t('every kind, every store title, by title only (no product id)', () => {
  const k = (title) => classifyLine({ title });
  assert.strictEqual(k('MOMUTO Pro Jersey'), 'jersey'); assert.strictEqual(k('Maillot MOMUTO Pro'), 'jersey'); assert.strictEqual(k('Camiseta MOMUTO Pro'), 'jersey');
  for (const s of ['MOMUTO Shorts Pro', 'Pantalones MOMUTO', 'MOMUTO Pro Short', 'Pantaloncini MOMUTO']) assert.strictEqual(k(s), 'shorts', s);
  for (const s of ['MOMUTO Socks', 'Medias técnicas', 'MOMUTO Chaussettes', 'Calzettoni tecnici']) assert.strictEqual(k(s), 'socks', s);
  for (const s of ['Long sleeves', 'Manga larga', 'Manches longues', 'Maniche lunghe']) assert.strictEqual(k(s), 'longSleeves', s);
  for (const s of ['Polo collar', 'Cuello polo', 'Col polo', 'Colletto polo']) assert.strictEqual(k(s), 'collar', s);
  for (const s of ['Fast lane', 'Vía rápida', 'Voie rapide', 'Corsia veloce']) assert.strictEqual(k(s), 'fastLane', s);
  for (const s of ['Deposit', 'Acompte', 'Depósito', 'Acconto']) assert.strictEqual(k(s), 'deposit', s);
});

t('a short-SLEEVE jersey is a jersey', () => {
  assert.strictEqual(classifyLine({ title: 'Short sleeve jersey' }), 'jersey');
  assert.strictEqual(classifyLine({ title: 'Camiseta manga corta', variant_title: 'M' }), 'jersey');
});

t('product id beats the title (a renamed shorts product still counts as shorts)', () => {
  assert.strictEqual(classifyLine({ product_id: '3800028', title: 'Some new name' }), 'shorts');
  assert.strictEqual(classifyLine({ product_id: 4174485, title: 'x' }), 'socks');
  assert.strictEqual(classifyLine({ product_id: 16913602, title: 'x' }), 'longSleeves');
});

t('full order: jerseys + shorts + socks + long sleeves + collar + fast lane + deposit', () => {
  const c = countLines([preview, L(3800026, 'Camiseta MOMUTO Pro', 10), L(3800028, 'Pantalones MOMUTO', 10), L(3800023, 'Medias técnicas', 4),
    L(11070065, 'Manga larga', 3), L(11072429, 'Cuello polo', 10), L(11081200, 'Vía rápida', 1), L(1, 'Depósito', 1, '15')], isPreview);
  assert.deepStrictEqual(c, { jerseys: 10, shorts: 10, socks: 4, longSleeves: 3, collars: 10, fastLane: true, deposits: 1 });
});

t('unknown product stays a jersey (custom kit / RTP items)', () => {
  assert.strictEqual(countLines([L(555, 'Maillot Pornic FC', 2)], isPreview).jerseys, 2);
});

t('buyer email: jersey count + own rows, never 40', () => {
  const c = countLines(egarenca, isPreview);
  const base = { lang: 'es', name: 'Club', team: 'Club', ref: 'c4zw4sv0pk', qty: c.jerseys, extras: { shorts: c.shorts }, total: '491.92', currency: 'EUR', paidAt: '2026-09-28', plantOrderNo: '2026092833610482', designs: [] };
  const html = emailConfirmation3D(base).html;
  assert(/Camisetas<\/td><td[^>]*>22</.test(html), 'jersey row 22');
  assert(/Pantalones<\/td><td[^>]*>18</.test(html), 'shorts row 18');
  assert(!/>40</.test(html), 'no 40');
  const old = emailConfirmation3D({ ...base, qty: 40, extras: undefined }).html;   // records stored before the fix still render
  assert(/Camisetas<\/td><td[^>]*>40</.test(old));
});

t('buyer email: other languages label the rows', () => {
  for (const [lang, u, s] of [['en', 'Jerseys', 'Shorts'], ['fr', 'Maillots', 'Shorts'], ['it', 'Maglie', 'Pantaloncini']]) {
    const html = emailConfirmation3D({ lang, name: 'x', team: 'x', ref: 'r', qty: 5, extras: { shorts: 5, longSleeves: 2 }, total: '1', currency: 'EUR', designs: [] }).html;
    assert(html.includes(`>${u}<`) && html.includes(`>${s}<`), lang);
  }
});
console.log(`\n${pass} passed`);
