'use strict';
// node scripts/test-order-view.js — order-view lib + API (mock KV, mock design server) + email links + page build.
const assert = require('assert');
const Module = require('module');
process.env.ORDER_VIEW_SECRET = 'test-secret';

// mock @vercel/kv
const store = new Map(); const counters = new Map();
const kvMock = { get: async k => store.get(k) ?? null, set: async (k, v) => { store.set(k, v); }, incr: async k => { const n = (counters.get(k) || 0) + 1; counters.set(k, n); return n; }, expire: async () => {} };
const origLoad = Module._load;
Module._load = function (req, ...a) { return req === '@vercel/kv' ? { kv: kvMock } : origLoad.call(this, req, ...a); };

const V = require('../lib/order-view');
const handler = require('../lib/order-view-handler');
const { emailConfirmation3D, emailDay4, emailDay10, emailTracking, emailDelivered, emailConfirmation } = require('../lib/emails');
let pass = 0; const t = async (name, fn) => { try { await fn(); pass++; console.log('PASS ' + name); } catch (e) { console.log('FAIL ' + name + '\n   ' + e.stack); process.exitCode = 1; } };

const paid = new Date(Date.now() - 6 * 86400000).toISOString();
const base = { id: '3d_abc12345', ref: 'abc12345', name: 'Emilio Perez', email: 'Emilio@Club.es', team: 'Emilio Perez', lang: 'es', currency: 'EUR', total: '999.00',
  paidAt: paid, status: 'active', emailsSent: ['confirmation'], plantOrderNo: '2026092833610482', extras: { shorts: 3 },
  designs: [{ front: 'https://cdn.example/f.png', back: 'http://insecure/b.png', players: [
    { number: 10, name: 'ANA', size: 'M · SHORTS L', qty: 1 }, { number: 7, name: 'BEA', size: 'L · JERSEY ONLY', qty: 1 },
    { number: 9, name: 'CAM', size: 'XL · LONG', qty: 1 }, { number: 4, name: 'DIA', size: 'S', qty: 1 }] }] };
store.set('order:3d_abc12345', base);

const call = async (body, headers = {}) => { let out = { code: 0, body: null, headers: {} };
  const res = { setHeader: (k, v) => { out.headers[k] = v; }, status: c => { out.code = c; return res; }, json: b => { out.body = b; return res; }, end: () => res };
  await handler({ method: 'POST', headers: { origin: 'https://es.momuto.com', 'x-forwarded-for': headers.ip || '1.1.1.1' }, body }, res); return out; };

(async () => {
  await t('link: per-store host + handle, token, us for USD, none for non-3D', () => {
    assert.match(V.viewUrl(base), /^https:\/\/es\.momuto\.com\/pages\/mi-pedido\?ref=abc12345&k=[0-9a-f]{32}$/);
    assert.match(V.viewUrl({ ...base, lang: 'en', currency: 'USD' }), /^https:\/\/us\.momuto\.com\/pages\/my-order/);
    assert.match(V.viewUrl({ ...base, lang: 'fr' }), /fr\.momuto\.com\/pages\/mon-commande/);
    assert.match(V.viewUrl({ ...base, lang: 'it' }), /it\.momuto\.com\/pages\/il-mio-ordine/);
    assert.strictEqual(V.viewUrl({ ...base, id: 'shopify_1' }), null);
  });
  await t('token accepts its own ref only', () => { const k = V.viewToken('abc12345'); assert(V.tokenOk('abc12345', k)); assert(!V.tokenOk('abc12346', k)); assert(!V.tokenOk('abc12345', 'x')); });
  await t('roster suffixes: shorts size, jersey only, long, plain', () => {
    const r = base.designs[0].players.map(V.normalisePlayer);
    assert.deepStrictEqual([r[0].shorts, r[0].shortsSize], ['size', 'L']); assert.strictEqual(r[1].shorts, 'none');
    assert.strictEqual(r[2].sleeve, 'long'); assert.strictEqual(r[3].shorts, 'plain');
  });
  await t('plain-size shorts resolved from the billed shorts total', () => {
    const o = V.publicOrder(base, base.designs);   // 3 shorts billed: ANA explicit + CAM + DIA same-size
    assert(o.shortsResolved); assert.strictEqual(o.totals.shorts, 3);
    const p = o.designs[0].players; assert.deepStrictEqual(p.map(x => x.shorts), ['size', 'none', 'same', 'same']);
    const o2 = V.publicOrder({ ...base, extras: { shorts: 1 } }, base.designs);   // only ANA has shorts
    assert.deepStrictEqual(o2.designs[0].players.map(x => x.shorts), ['size', 'none', 'none', 'none']);
    const o3 = V.publicOrder({ ...base, extras: { shorts: 2 } }, base.designs);   // ambiguous within one design
    assert(!o3.shortsResolved);
  });
  await t('status timeline + windows (25-30 d, fast lane 18-23 d)', () => {
    assert.strictEqual(V.buildStatus(base).current, 'production');
    assert.strictEqual(V.buildStatus({ ...base, paidAt: new Date().toISOString(), emailsSent: [] }).current, 'paid');
    assert.strictEqual(V.buildStatus({ ...base, status: 'shipped', trackingNumber: 'T1' }).current, 'shipped');
    assert.strictEqual(V.buildStatus({ ...base, status: 'delivered' }).current, 'delivered');
    const w = V.deliveryWindowISO({ paidAt: '2026-09-01T10:00:00Z' }); assert.deepStrictEqual([w.from, w.to], ['2026-09-26', '2026-10-01']);
    const f = V.deliveryWindowISO({ paidAt: '2026-09-01T10:00:00Z', fastLane: true }); assert.deepStrictEqual([f.from, f.to], ['2026-09-19', '2026-09-24']);
  });
  await t('API: token access returns whitelist, no PII/prices, https images only', async () => {
    const r = await call({ ref: 'abc12345', k: V.viewToken('abc12345') });
    assert.strictEqual(r.code, 200); const s = JSON.stringify(r.body);
    assert(!/club\.es|999\.00|"total"|"email"/i.test(s), 'leak: ' + s.slice(0, 200));
    assert.strictEqual(r.body.order.designs[0].back, null); assert.strictEqual(r.body.order.firstName, 'Emilio');
    assert.strictEqual(r.headers['Cache-Control'], 'no-store'); assert.match(r.headers['X-Robots-Tag'], /noindex/);
    assert.strictEqual(r.headers['Access-Control-Allow-Origin'], 'https://es.momuto.com');
  });
  await t('API: email fallback (case-insensitive); wrong email / wrong token / unknown ref = same 404', async () => {
    assert.strictEqual((await call({ ref: 'abc12345', email: 'emilio@club.es' }, { ip: '2.2.2.2' })).code, 200);
    const bad = [await call({ ref: 'abc12345', email: 'no@x.com' }, { ip: '3.3.3.3' }), await call({ ref: 'abc12345', k: 'f'.repeat(32) }, { ip: '3.3.3.3' }), await call({ ref: 'zzzzzzzz', email: 'a@b.c' }, { ip: '3.3.3.3' }), await call({ ref: 'abc12345' }, { ip: '3.3.3.3' })];
    for (const b of bad) { assert.strictEqual(b.code, 404); assert.deepStrictEqual(b.body, { ok: false, error: 'not_found' }); }
  });
  await t('API: a backfill order (paid, late-ingested) is visible', async () => {
    store.set('order:3d_bf000001', { ...base, id: '3d_bf000001', ref: 'bf000001', status: 'backfill', stopLifecycle: true, emailsSent: [] });
    const r = await call({ ref: 'bf000001', email: 'emilio@club.es' }, { ip: '8.8.8.8' });
    assert.strictEqual(r.code, 200); assert.strictEqual(r.body.order.ref, 'bf000001');
  });
  await t('API: excluded/test orders hidden; bad ref shape rejected', async () => {
    store.set('order:3d_test0001', { ...base, id: '3d_test0001', ref: 'test0001', status: 'excluded' });
    store.set('order:3d_test0002', { ...base, id: '3d_test0002', ref: 'test0002', status: 'test' });
    assert.strictEqual((await call({ ref: 'test0001', k: V.viewToken('test0001') }, { ip: '4.4.4.4' })).code, 404);
    assert.strictEqual((await call({ ref: 'test0002', k: V.viewToken('test0002') }, { ip: '4.4.4.4' })).code, 404);
    assert.strictEqual((await call({ ref: '../x', k: 'a' }, { ip: '4.4.4.4' })).code, 404);
  });
  await t('API: email guesses rate-limited per ref (8/h)', async () => {
    let last; for (let i = 0; i < 10; i++) last = await call({ ref: 'abc12345', email: `g${i}@x.com` }, { ip: '5.5.5.' + i });
    assert.strictEqual(last.code, 429);
  });
  await t('API: roster fetched from design server when the record has none', async () => {
    store.set('order:3d_nop00001', { ...base, id: '3d_nop00001', ref: 'nop00001', designs: [{ front: null, back: null, players: [] }], extras: {} });
    const orig = global.fetch; let url;
    global.fetch = async u => { url = String(u); return { json: async () => ({ code: 200, data: [{ urlThumbnailFront: 'https://d/f.png', urlThumbnailBack: 'https://d/b.png', info: [{ number: 1, name: 'X', size: 'M', qty: 2 }] }] }) }; };
    const r = await call({ ref: 'nop00001', k: V.viewToken('nop00001') }, { ip: '6.6.6.6' }); global.fetch = orig;
    assert.match(url, /getGoods\?order_no=nop00001&oem_no=&uuid=$/); assert.strictEqual(r.body.order.totals.jerseys, 2); assert(!r.body.order.rosterPending);
    global.fetch = async () => { throw new Error('down'); };
    const r2 = await call({ ref: 'nop00001', k: V.viewToken('nop00001') }, { ip: '6.6.6.7' }); global.fetch = orig;
    assert.strictEqual(r2.code, 200); assert(r2.body.order.rosterPending);
  });
  await t('emails: the link is in all five 3D lifecycle emails, and absent for non-3D', () => {
    const re = /es\.momuto\.com\/pages\/mi-pedido\?ref=abc12345&(amp;)?k=/;   // the shipped email escapes & in hrefs
    for (const f of [emailConfirmation3D, emailDay4, emailDay10, emailTracking, emailDelivered]) assert(re.test(f(base).html), f.name);
    assert(!/mi-pedido/.test(emailDay4({ ...base, id: 'shop_9' }).html));
    assert(/Ver mi pedido/.test(emailDay4(base).html) && /See your order/.test(emailDay4({ ...base, lang: 'en' }).html));
    assert(!/mi-pedido/.test(emailConfirmation({ ...base, id: 'x', lang: 'es' }).html));
  });
  const withCard = { ...base, uuid: 'u8k2p9x1', designs: [{ ...base.designs[0], suit: 'mamuto3suit1', configId: 'c4f9a2b7' }] };
  await t('card link: share-load primitive + card=1, lang, us host, null without configId/suit/uuid or on hostile ids', () => {
    assert.strictEqual(V.cardUrl(withCard, withCard.designs[0]),
      'https://design.momuto.com/3d-configurator/configurator.html?configId=c4f9a2b7&suitName=mamuto3suit1&useGetShare=true&u=u8k2p9x1&lang=es&card=1');
    assert.match(V.cardUrl({ ...withCard, lang: 'en', currency: 'USD' }, withCard.designs[0]), /&lang=en&card=1&fromUrlHost=https%3A%2F%2Fus\.momuto\.com$/);
    assert.strictEqual(V.cardUrl(base, base.designs[0]), null);                                   // an order from before the webhook patch
    assert.strictEqual(V.cardUrl({ ...withCard, uuid: null }, withCard.designs[0]), null);
    assert.strictEqual(V.cardUrl(withCard, { ...withCard.designs[0], suit: '' }), null);          // never guess a suit
    for (const bad of ['a b', 'a&card=0', '../x', 'x'.repeat(65), '<s>']) {
      assert.strictEqual(V.cardUrl(withCard, { ...withCard.designs[0], configId: bad }), null);
      assert.strictEqual(V.cardUrl({ ...withCard, uuid: bad }, withCard.designs[0]), null);
    }
  });
  await t('card link: in the public order JSON only when buildable; the stored uuid itself is never a field', () => {
    const pub = V.publicOrder(withCard, withCard.designs), old = V.publicOrder(base, base.designs);
    assert.match(pub.designs[0].cardUrl, /^https:\/\/design\.momuto\.com\/3d-configurator\/configurator\.html\?configId=c4f9a2b7/);
    assert.strictEqual(old.designs[0].cardUrl, null);
    assert(!('uuid' in pub) && !('email' in pub));
  });
  await t('emails: card block in confirmation + day-4 only with a card link, localised, & escaped; none for old orders', () => {
    for (const [lang, h] of [['es', 'Comparte tu nueva equipación'], ['en', 'Share your new kit'], ['fr', 'Partagez votre nouvelle tenue'], ['it', 'Condividi la tua nuova divisa']]) {
      for (const fn of [emailConfirmation3D, emailDay4]) {
        const html = fn({ ...withCard, lang }).html;
        assert(html.includes(h), lang + ' ' + fn.name);
        assert(html.includes('configId=c4f9a2b7&amp;suitName=mamuto3suit1&amp;useGetShare=true&amp;u=u8k2p9x1') && html.includes('card=1'));
      }
    }
    for (const fn of [emailConfirmation3D, emailDay4, emailDay10, emailTracking, emailDelivered]) assert(!/useGetShare/.test(fn(base).html), 'old order: no block');
    assert(!/useGetShare/.test(emailDay10(withCard).html) && !/useGetShare/.test(emailDelivered(withCard).html));   // only confirmation + day 4
  });
  await t('pages: 5 stubs exist, noindex, one h1, only info@momuto.com, kept out of sitemap', () => {
    const fs = require('fs');
    for (const [l, h] of [['en', 'my-order'], ['us', 'my-order'], ['es', 'mi-pedido'], ['fr', 'mon-commande'], ['it', 'il-mio-ordine']]) {
      const p = JSON.parse(fs.readFileSync(`cms/pages/${l}/${h}.json`, 'utf8'));
      assert.strictEqual(p.handle, h); assert(Array.isArray(p.meta_keywords)); assert(p.content.includes('noindex'));
      assert.strictEqual((p.content.match(/<h1\b/g) || []).length, 1);
    }
    assert(fs.readFileSync('scripts/rebuild-sitemap.js', 'utf8').includes('ORDER_VIEW_HANDLES.has(slug)'));
    for (const [l, h] of [['en', 'my-order'], ['es', 'mi-pedido'], ['fr', 'mon-commande'], ['it', 'il-mio-ordine']]) assert(JSON.parse(fs.readFileSync(`cms/pages/${l}/${h}.json`, 'utf8')).content.includes('cardH'), l + ': card button string');
  });
  await t('two designs: jersey 13 + shorts-only 12 -> 13 jerseys, 12 shorts (order oofxswi4sj, 21 Oct 2026: page read 25)', () => {
    const jr = Array.from({ length: 13 }, (_, i) => ({ number: i + 1, name: 'P' + i, size: 'M', qty: 1 }));
    const sh = Array.from({ length: 12 }, (_, i) => ({ number: i + 1, name: 'P' + i, size: 'M', qty: 1 }));
    const o = V.publicOrder({ ...base, extras: { shorts: 12 } }, [{ suit: 'mamuto3', players: jr }, { suit: 'mamuto3shorts1', players: sh }]);
    assert.strictEqual(o.totals.jerseys, 13);
    assert.strictEqual(o.totals.shorts, 12);
    assert.deepStrictEqual(o.designs.map(d => d.kind), ['jersey', 'shorts']);
    // the same order with no suit on the rows (older records) keeps the old behaviour: everything is a jersey
    const old = V.publicOrder({ ...base, extras: { shorts: 12 } }, [{ players: jr }, { players: sh }]);
    assert.strictEqual(old.totals.jerseys, 25);
  });
  await t('design kinds + roster units', () => {
    const K = require('../lib/design-kind');
    assert.deepStrictEqual(['mamuto3', 'mamuto2', 'mamuto3suit1', 'mamuto3shorts1', 'mamuto2shorts1', 'mamuto2socks1', 'polo', '', undefined].map(K.designKind),
      ['jersey', 'jersey', 'jersey', 'shorts', 'shorts', 'socks', 'jersey', 'jersey', 'jersey']);
    assert.deepStrictEqual(K.rosterUnits([{ suit: 'mamuto3', players: [{ qty: 3 }, { qty: 2 }] }, { suit: 'mamuto3shorts1', players: [{ qty: 4 }] }, { suit: 'mamuto2socks1', players: [{}] }]),
      { jerseys: 5, shorts: 4, socks: 1 });
  });
  await t('delivery: always payment + 25-30 d (fast lane 18-23); shipping, even recorded days late, never moves it (owner 27 Oct 2026)', () => {
    const D = require('../lib/delivery');
    const late = { paidAt: '2026-09-28T09:00:00Z', lang: 'es' };
    const a = D.deliveryEstimate(late);
    assert.deepStrictEqual([a.basis, D.isoDay(a.from), D.isoDay(a.to), a.changed], ['paid', '2026-10-23', '2026-10-28', false]);
    // shipped on 21 Oct (recorded late): the window is still 23-28 Oct, on every path that can pass a ship date
    const b = D.deliveryEstimate({ ...late, shippedAt: '2026-10-21T08:00:00Z' });
    assert.deepStrictEqual([b.basis, D.isoDay(b.from), D.isoDay(b.to), b.changed], ['paid', '2026-10-23', '2026-10-28', false]);
    const c = D.deliveryEstimate(late, { shippedAt: '2026-10-26T08:00:00Z' });
    assert.deepStrictEqual([D.isoDay(c.from), D.isoDay(c.to)], ['2026-10-23', '2026-10-28']);
    // the page reads the same estimate and never says "updated"
    const w = V.deliveryWindowISO({ ...late, shippedAt: '2026-10-21T08:00:00Z' });
    assert.deepStrictEqual([w.from, w.to, w.basis, w.first], ['2026-10-23', '2026-10-28', 'paid', undefined]);
    assert.strictEqual(V.deliveryWindowISO(late).basis, 'paid');
    assert.strictEqual(D.deliveryEstimate({}), null);
    // fast lane: 18-23, before and after shipping
    const f = D.deliveryEstimate({ paidAt: '2026-09-28T09:00:00Z', fastLane: true, shippedAt: '2026-10-05T08:00:00Z' });
    assert.deepStrictEqual([D.isoDay(f.from), D.isoDay(f.to)], ['2026-10-16', '2026-10-21']);
  });
  await t('emails: confirmation, shipped email and the page all quote the SAME window, counted from payment', () => {
    const o = { ...base, paidAt: '2026-09-28T09:00:00Z', lang: 'es', shippedAt: '2026-10-21T08:00:00Z', trackingNumber: 'TN1', carrier: 'DHL', trackingUrl: 'https://dhl.example/t/TN1' };
    const conf = emailConfirmation3D({ ...o, shippedAt: undefined, trackingNumber: undefined });
    assert(conf.html.includes('23–28 de octubre'), 'confirmation: 23-28 oct');
    const ship = emailTracking(o);
    assert(ship.html.includes('23–28 de octubre'), 'shipped email: the same 23-28 oct');
    assert(!ship.html.includes('31 de octubre') && !ship.html.includes('sustituye'), 'shipped email: no ship-date window, no "replaces" note');
    const en = emailTracking({ ...o, lang: 'en' });
    assert(!/replaces the estimate/.test(en.html) && /October 23\s*[–-]\s*28|23\s*[–-]\s*28 October|Oct(ober)? 23/.test(en.html), 'EN shipped email: payment-based window, no "replaces"');
    // shipped with no ship date recorded yet (the poller passes "now"): still payment-based
    const now = emailTracking({ ...o, shippedAt: undefined });
    assert(now.html.includes('23–28 de octubre'));
  });
  await t('deploy: api/ stays at 12 functions; /api/order-view rewrites onto lead.js', () => {
    const fs = require('fs');
    assert(fs.readdirSync('api').filter(f => f.endsWith('.js')).length <= 12);
    const vj = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
    assert(vj.rewrites.some(r => r.source === '/api/order-view' && r.destination === '/api/lead?type=order-view'));
    assert(/orderView\(req, res\)/.test(fs.readFileSync('api/lead.js', 'utf8')));
  });
  console.log(`\n${pass} passed`);
})();
