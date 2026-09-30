'use strict';
// node scripts/test-order-lines.js — line classification + the two emails' counts.
const assert = require('assert');
const { classifyLine, countLines } = require('../lib/order-lines');
const { emailConfirmation3D } = require('../lib/emails');
let pass = 0; const t = (name, fn) => { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { console.log('FAIL ' + name + '\n   ' + e.message); process.exitCode = 1; } };

const preview = { product_id: 99, title: 'Your custom design — order c4zw4sv0pk', price: '0.00', quantity: 1, inner_title: JSON.stringify({ type: '3d-preview', order_no: 'c4zw4sv0pk' }) };
const isPreview = (it) => { try { return JSON.parse(it.inner_title || '{}').type === '3d-preview'; } catch { return false; } };
const L = (product_id, title, quantity, price = '10', variant_title = '') => ({ product_id, title, quantity, price, variant_title });

// Order 2026092833610482 (es store), from the manage roster: 21 players over 3 designs (14+4+3),
// 2 of them 'JERSEY ONLY' -> 21 jerseys + 19 shorts = the '40' the old code printed as jerseys
const egarenca = [preview,
  L(3800026, 'Camiseta MOMUTO Pro', 14, '21.90', 'M'), L(3800026, 'Camiseta MOMUTO Pro', 4, '21.90', 'L'), L(3800026, 'Camiseta MOMUTO Pro', 3, '21.90', 'XL'),
  L(3800028, 'Pantalones MOMUTO', 19, '5.00', 'M')];

t('Egarenca: 21 jerseys, 19 shorts — not 40 jerseys', () => {
  const c = countLines(egarenca, isPreview);
  assert.strictEqual(c.jerseys, 21); assert.strictEqual(c.shorts, 19); assert.strictEqual(c.socks, 0);
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
  assert(/Camisetas<\/td><td[^>]*>21</.test(html), 'jersey row 21');
  assert(/Pantalones<\/td><td[^>]*>19</.test(html), 'shorts row 19');
  assert(!/>40</.test(html), 'no 40');
  assert.strictEqual(c.jerseys, 21, 'equals the roster (21), so the sheet no longer warns');
  const old = emailConfirmation3D({ ...base, qty: 40, extras: undefined }).html;   // records stored before the fix still render
  assert(/Camisetas<\/td><td[^>]*>40</.test(old));
});

t('buyer email: other languages label the rows', () => {
  for (const [lang, u, s] of [['en', 'Jerseys', 'Shorts'], ['fr', 'Maillots', 'Shorts'], ['it', 'Maglie', 'Pantaloncini']]) {
    const html = emailConfirmation3D({ lang, name: 'x', team: 'x', ref: 'r', qty: 5, extras: { shorts: 5, longSleeves: 2 }, total: '1', currency: 'EUR', designs: [] }).html;
    assert(html.includes(`>${u}<`) && html.includes(`>${s}<`), lang);
  }
});

t('fixed-price kit line: one line = a jersey AND a shorts per unit (Pecados Capitales at its own price)', () => {
  assert.strictEqual(classifyLine({ title: 'Kit Completo Pecados Capitales' }), 'kit');
  const c = countLines([preview, L(11111111, 'Kit Completo Pecados Capitales', 3, '26.90'), L(22222222, 'Camiseta Pecados Capitales', 1, '21.90'),
    L(11070065, 'Manga larga', 1, '3.00')], isPreview);
  assert.strictEqual(c.jerseys, 4); assert.strictEqual(c.shorts, 3); assert.strictEqual(c.kits, 3); assert.strictEqual(c.longSleeves, 1);
});

t('"kit" never steals shorts / socks / add-ons', () => {
  for (const [title, kind] of [['Kit shorts', 'shorts'], ['Kit socks', 'socks'], ['Fast lane kit', 'fastLane'], ['Manchester Fiti — Kit Personalizado', 'kit']])
    assert.strictEqual(classifyLine({ title }), kind, title);
});

t('buyer email: a fixed-price kit order lists jerseys and shorts', () => {
  const c = countLines([preview, L(11111111, 'Kit Completo Pecados Capitales', 10, '26.90')], isPreview);
  const html = emailConfirmation3D({ lang: 'es', name: 'x', team: 'x', ref: 'r', qty: c.jerseys, extras: { shorts: c.shorts }, total: '269', currency: 'EUR', designs: [] }).html;
  assert(/Camisetas<\/td><td[^>]*>10</.test(html) && /Pantalones<\/td><td[^>]*>10</.test(html));
});

t('"Promo" fixed-price titles: kit stays a kit, jersey stays a jersey', () => {
  assert.strictEqual(classifyLine({ title: 'Kit Completo Pecados Capitales · Promo' }), 'kit');
  assert.strictEqual(classifyLine({ title: 'Camiseta Pecados Capitales · Promo' }), 'jersey');
  const c = countLines([preview, L(1, 'Kit Completo Pecados Capitales · Promo', 4, '26.90'), L(2, 'Camiseta Pecados Capitales · Promo', 2, '21.90')], isPreview);
  assert.strictEqual(c.jerseys, 6); assert.strictEqual(c.shorts, 4);
});
console.log(`\n${pass} passed`);
