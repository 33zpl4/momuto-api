#!/usr/bin/env node
/**
 * Mark ONE design-server order paid (orders.pay_status = 2, the 已支付 in manage.momuto.com) for an order paid OUTSIDE the platform
 * (Stripe payment link). Uses the same endpoint the hourly paid poller uses for every platform-paid order (design-momuto server-patches
 * README §12): POST design.momuto.com/pay/callback {order_no, payStatus:'success', type:'oem', plant_order_no}. PayAction.php only updates
 * pay_status (+ fills plant_order_no when empty) and logs; it sends NO email and calls nothing else. Idempotent.
 *
 * Guards, in order (any failure aborts before the write):
 *   1. the order exists on the design server (GET /Order/getGoods?order_no=…, key names only, no roster values);
 *   2. momuto-api already holds the order with the confirmation email SENT (admin-orders find), so the late "Order Update" webhook, if the
 *      platform ever fires it, hits order-3d-paid's dedup and sends nothing;
 *   3. LIVE=1 AND CONFIRM equal to the order_no.
 * Dry run by default. Read-back: the callback's JSON answer; the 已支付 flag itself is for the owner to check in manage.momuto.com
 * (no endpoint exposes pay_status).
 *   ORDER_NO=78nmn3osnc PLANT_ORDER_NO=2026110633635073 [LIVE=1 CONFIRM=78nmn3osnc] MOMUTO_API_SECRET=… node scripts/mark-design-paid.js
 */
const ORDER_NO = process.env.ORDER_NO, PLANT = process.env.PLANT_ORDER_NO || '';
const LIVE = process.env.LIVE === '1', CONFIRM = process.env.CONFIRM || '';
const SECRET = process.env.MOMUTO_API_SECRET;
const DESIGN = 'https://design.momuto.com';
const API = 'https://momuto-api.vercel.app/api/admin-orders';
(async () => {
  if (!ORDER_NO || !/^[a-z0-9]{6,16}$/i.test(ORDER_NO)) throw new Error('ORDER_NO missing or malformed');
  console.log(`mode=${LIVE ? 'LIVE' : 'DRY RUN'} order_no=${ORDER_NO} plant_order_no=${PLANT || '(none)'}`);
  // 1. exists on the design server
  let txt = await (await fetch(`${DESIGN}/Order/getGoods?order_no=${encodeURIComponent(ORDER_NO)}&oem_no=&uuid=`)).text();
  const b = txt.indexOf('{'); if (b > 0) txt = txt.slice(b);
  let g; try { g = JSON.parse(txt); } catch { throw new Error('getGoods non-JSON: ' + txt.slice(0, 100)); }
  const designs = Array.isArray(g.data) ? g.data : [];
  console.log(`1. design server getGoods: code=${g.code} designs=${designs.length} keys=${designs[0] ? Object.keys(designs[0]).join(',') : '-'}`);
  if (g.code !== 200 || !designs.length) throw new Error('order not found on the design server — nothing to mark');
  // 2. momuto-api has it, confirmation already sent
  if (!SECRET) throw new Error('MOMUTO_API_SECRET not set');
  const f = await (await fetch(`${API}?action=find&q=${encodeURIComponent(ORDER_NO)}`, { headers: { 'x-webhook-secret': SECRET } })).json();
  const rec = (f.found || [])[0];
  console.log(`2. momuto-api record: ${rec ? `status=${rec.status} paidAt=${rec.paidAt} emailsSent=${JSON.stringify(rec.emailsSent)} stopLifecycle=${rec.stopLifecycle} plantOrderNo=${rec.plantOrderNo}` : 'NOT FOUND'}`);
  if (!rec || !(rec.emailsSent || []).includes('confirmation')) throw new Error('no confirmed record in momuto-api: a late webhook could send a confirmation — aborting');
  const body = new URLSearchParams({ order_no: ORDER_NO, payStatus: 'success', type: 'oem', plant_order_no: PLANT, source: 'momuto-api-manual' });
  console.log(`3. POST ${DESIGN}/pay/callback ${body.toString()}`);
  if (!LIVE) { console.log('DRY RUN — nothing written.'); return; }
  if (CONFIRM !== ORDER_NO) throw new Error('LIVE needs CONFIRM equal to the order_no');
  const r = await fetch(`${DESIGN}/pay/callback`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
  const out = await r.text();
  console.log(`   → HTTP ${r.status} ${out.slice(0, 160)}`);
  if (r.status !== 200 || !/"code"\s*:\s*200/.test(out)) throw new Error('callback did not answer success');
  console.log('DONE: callback accepted. Check manage.momuto.com: the order should read 已支付 (pay-callback.log line "paid ' + ORDER_NO + ' via momuto-api-manual").');
})().catch(e => { console.error('ABORTED: ' + e.message); process.exit(1); });
