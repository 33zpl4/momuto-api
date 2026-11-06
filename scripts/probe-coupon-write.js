#!/usr/bin/env node
/**
 * Verify the coupon WRITE shape on one store with a throwaway coupon: POST a 1 % single-use code valid 1 day,
 * read it back (by id and in the list), then DELETE it and confirm it is gone. Dry run by default (prints the payload).
 *   STORE=es LIVE=1 node scripts/probe-coupon-write.js
 */
const C = require('./platform-coupon');
const STORE = (process.env.STORE || 'es').toLowerCase();
const token = process.env['OEMSAAS_TOKEN_' + STORE.toUpperCase()];
const LIVE = process.env.LIVE === '1';
(async () => {
  if (!token) throw new Error(`no token for ${STORE}`);
  const code = `TEST-${Date.now().toString(36).toUpperCase()}`;
  const payload = C.percentCoupon({ code, name: 'probe (delete me)', percent: 1, days: 1 });
  console.log(`store=${STORE} mode=${LIVE ? 'LIVE' : 'DRY'}\npayload: ${JSON.stringify(payload)}`);
  if (!LIVE) { console.log('dry run: nothing written'); return; }
  let created;
  try { created = await C.createCoupon(token, payload); console.log('POST /coupons →', JSON.stringify(created).slice(0, 600)); }
  catch (e) { console.log('POST /coupons FAILED:', e.message); return; }
  const id = created && (created.id || created.coupon_id);
  await new Promise(r => setTimeout(r, 800));
  const byList = await C.findCoupon(token, code);
  console.log('in list:', byList ? JSON.stringify(byList).slice(0, 600) : 'NOT FOUND');
  if (id) { try { console.log('GET by id →', JSON.stringify(await C.getCoupon(token, id)).slice(0, 400)); } catch (e) { console.log('GET by id failed:', e.message); } }
  const delId = id || (byList && byList.id);
  if (!delId) { console.log('no id to delete — DELETE THE TEST COUPON BY HAND:', code); return; }
  try { console.log('DELETE →', JSON.stringify(await C.deleteCoupon(token, delId)).slice(0, 300)); }
  catch (e) { console.log('DELETE failed:', e.message, '— delete by hand:', code); }
  await new Promise(r => setTimeout(r, 800));
  const after = await C.findCoupon(token, code);
  console.log(after ? `VERIFIED create, delete FAILED (still listed, status ${after.status}) — delete by hand: ${code}` : 'VERIFIED create + delete');
})().catch(e => { console.error(e.message); process.exit(1); });
