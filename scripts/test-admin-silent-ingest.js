'use strict';
// node scripts/test-admin-silent-ingest.js — silent ingest stores a backfill record: no email, no lifecycle, order page can read it.
const assert = require('assert');
const Module = require('module');
process.env.D3_ORDER_SECRET = 'sec'; process.env.ORDER_VIEW_SECRET = 'vs'; delete process.env.RESEND_API_KEY;
const st = new Map(), sets = new Map();
const kv = { get: async k => st.get(k) ?? null, set: async (k, v) => { st.set(k, v); }, sadd: async (k, v) => { (sets.get(k) || sets.set(k, new Set()).get(k)).add(v); }, smembers: async k => [...(sets.get(k) || [])], incr: async () => 1, expire: async () => {} };
const L = Module._load; Module._load = function (r, ...a) { return r === '@vercel/kv' ? { kv } : L.call(this, r, ...a); };
let fetched = 0; global.fetch = async () => { fetched++; return { ok: true, json: async () => ({ code: 200, data: [] }) }; };
const admin = require('../api/admin-orders'); const view = require('../lib/order-view-handler');
const call = async (h, req) => { const o = {}; const res = { setHeader() {}, status(c) { o.c = c; return res; }, json(b) { o.b = b; return res; }, end() { return res; } }; const rq = new (require('events'))(); Object.assign(rq, { headers: { 'x-webhook-secret': 'sec', origin: 'https://es.momuto.com' }, query: {}, ...req });
    const done = h(rq, res); setImmediate(() => { if (req.body) rq.emit('data', JSON.stringify(req.body)); rq.emit('end'); }); await done; return o; };
let pass = 0; const t = async (n, f) => { try { await f(); pass++; console.log('PASS ' + n); } catch (e) { console.log('FAIL ' + n + '\n  ' + e.stack); process.exitCode = 1; } };
(async () => {
  await t('silent ingest: no RESEND key needed, no name needed, stored as backfill, not enrolled, no email', async () => {
    const r = await call(admin, { method: 'POST', body: { action: 'ingest-and-send', silent: true, order_no: '3f4wddo3vw', email: 'a@b.com', plant_order_no: '2026091033559480', paid_at: '2026-09-10' } });
    assert.strictEqual(r.c, 200, JSON.stringify(r.b)); assert.strictEqual(r.b.sent, false);
    const o = st.get('order:3d_3f4wddo3vw');
    assert.strictEqual(o.status, 'backfill'); assert.strictEqual(o.stopLifecycle, true); assert.deepStrictEqual(o.emailsSent, []);
    assert(!(sets.get('orders:active') || new Set()).has('3d_3f4wddo3vw')); assert((sets.get('orders:all')).has('3d_3f4wddo3vw'));
  });
  await t('silent ingest of an already-shipped order keeps tracking, status shipped, still no email', async () => {
    const r = await call(admin, { method: 'POST', body: { action: 'ingest-and-send', silent: true, order_no: 'shipd00001', email: 'a@b.com', name: 'Tania Gaspar', qty: 1, extras: { shorts: 0, longSleeves: 1 }, paid_at: '2026-09-10', tracking_number: '4200', tracking_url: 'https://tools.usps.com/x?y=4200', shipped_at: '2026-09-25' } });
    assert.strictEqual(r.c, 200, JSON.stringify(r.b)); const o = st.get('order:3d_shipd00001');
    assert.strictEqual(o.status, 'shipped'); assert.strictEqual(o.trackingNumber, '4200'); assert.strictEqual(o.shippedAt.slice(0, 10), '2026-09-25'); assert.strictEqual(o.stopLifecycle, true);
    const v = await call(view, { method: 'POST', body: { ref: 'shipd00001', email: 'a@b.com' } });
    assert.strictEqual(v.b.order.status.current, 'shipped'); assert.strictEqual(v.b.order.tracking.number, '4200'); assert.strictEqual(v.b.order.firstName, 'Tania'); assert.strictEqual(v.b.order.totals.longSleeves, 0);
  });
  await t('non-silent ingest still needs name + RESEND key', async () => {
    const r = await call(admin, { method: 'POST', body: { action: 'ingest-and-send', order_no: 'zzzz0000aa', email: 'a@b.com', name: 'X' } });
    assert.strictEqual(r.c, 503);
  });
  await t('the order page opens the silent record by email, not by a wrong one', async () => {
    const ok = await call(view, { method: 'POST', body: { ref: '3f4wddo3vw', email: 'A@B.com' } });
    assert.strictEqual(ok.c, 200); assert.strictEqual(ok.b.order.firstName, ''); assert.strictEqual(ok.b.order.storeOrderNo, '2026091033559480');
    assert.strictEqual((await call(view, { method: 'POST', body: { ref: '3f4wddo3vw', email: 'x@y.com' } })).c, 404);
  });
  console.log(`\n${pass} passed`);
})();
