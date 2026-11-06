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
  // POST /coupons answered 404 接口未定义 on 6 Nov 2026 (run 42221448904): try the other spellings the vendor uses elsewhere
  // (the notification surface is /eventnotices, products are /products, so a coupon write may sit under a different noun).
  const PATHS = (process.env.POST_PATHS || '/coupons,/coupons/create,/coupon,/coupon/create,/coupons/add,/discount_codes,/discounts,/marketing/coupons,/promotions/coupon,/coupon_codes').split(',');
  let created = null;
  for (const pth of PATHS) {
    try { created = await C.api('POST', pth.trim(), token, payload); console.log(`POST ${pth} → ${JSON.stringify(created).slice(0, 600)}`); break; }
    catch (e) { console.log(`POST ${pth} FAILED: ${e.message}`); if (!/404|未定义/.test(e.message)) break; }
    await new Promise(r => setTimeout(r, 500));
  }
  if (!created) { console.log('NO coupon write path found'); return; }
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
