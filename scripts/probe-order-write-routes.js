#!/usr/bin/env node
/**
 * Which order WRITE routes exist, without touching a real order. Every request targets an order id that does not exist (999999999): an undefined
 * route answers code 404 / 接口未定义; a defined route answers with its own error (order not found, or a validation message naming the fields it
 * wants). No create route is tried (a defined POST /orders with defaults could create junk). Nothing is written.
 *   STORE=es node scripts/probe-order-write-routes.js
 */
const STORE = (process.env.STORE || 'es').toUpperCase();
const token = process.env['OEMSAAS_TOKEN_' + STORE];
const ID = '999999999';
const CANDIDATES = [
  ['PUT', `/orders/${ID}`, { financial_status: 230 }],
  ['PATCH', `/orders/${ID}`, { financial_status: 230 }],
  ['PUT', `/orders/${ID}/financial_status`, { financial_status: 230 }],
  ['PUT', `/orders/${ID}/status`, { status: 110 }],
  ['PUT', `/orders/${ID}/pay`, {}], ['POST', `/orders/${ID}/pay`, {}],
  ['PUT', `/orders/${ID}/paid`, {}], ['POST', `/orders/${ID}/paid`, {}],
  ['POST', `/orders/${ID}/payments`, {}], ['POST', `/orders/${ID}/payment`, {}], ['PUT', `/orders/${ID}/payment`, {}],
  ['POST', `/orders/${ID}/transactions`, {}],
  ['PUT', `/orders/${ID}/offlinepay`, {}], ['POST', `/orders/${ID}/offlinepay`, {}], ['POST', `/orders/${ID}/offline_pay`, {}], ['PUT', `/orders/${ID}/offline_pay`, {}],
  ['PUT', `/orders/${ID}/confirm_pay`, {}], ['PUT', `/orders/${ID}/confirm_payment`, {}], ['POST', `/orders/${ID}/confirm_payment`, {}],
  ['POST', `/orders/${ID}/mark_paid`, {}], ['PUT', `/orders/${ID}/mark_paid`, {}],
  ['POST', `/orders/${ID}/fulfillments`, {}], ['PUT', `/orders/${ID}/fulfillments`, {}],
  ['PUT', `/orders/${ID}/note`, {}], ['PUT', `/orders/${ID}/remark`, {}],
  ['POST', `/orders/${ID}/cancel`, {}], ['PUT', `/orders/${ID}/cancel`, {}],
];
(async () => {
  if (!token) throw new Error('no token');
  for (const [m, p, body] of CANDIDATES) {
    const r = await fetch('https://openapi.oemapps.com' + p, { method: m, headers: { token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { code: 'non-json', msg: t.slice(0, 60) }; }
    const undefinedRoute = j.code === 404 && /未定义/.test(String(j.msg));
    console.log(`${undefinedRoute ? '  ---' : '  >>> EXISTS'} ${m.padEnd(5)} ${p.replace(ID, '{id}')} → HTTP ${r.status} code=${j.code} msg=${String(j.msg).slice(0, 110)}`);
    await new Promise(x => setTimeout(x, 450));
  }
})().catch(e => { console.error(e.message); process.exit(1); });
