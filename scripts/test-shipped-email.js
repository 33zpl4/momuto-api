'use strict';
// node scripts/test-shipped-email.js [--write-previews]
// The shipped email in 4 languages x {3D order, store order, no carrier link}: links, escaping, language, no leftovers. Optionally writes docs/email-previews/.
const fs = require('fs'), path = require('path');
process.env.ORDER_VIEW_SECRET = 'test-secret';
const { emailTracking } = require('../lib/emails');
const { describeFulfillment } = require('../lib/carriers');
let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); c ? pass++ : fail++; };

const f = { tracking_number: 'AB123456789US', courier_id: 4629, courier_code: '21051', note: 'http://www.usps.com/' };
const d = describeFulfillment(f);
ok(d.carrier === 'USPS' && d.trackingUrl === 'https://tools.usps.com/go/TrackConfirmAction?tLabels=AB123456789US', 'USPS fulfillment -> name + deep link');
const u = describeFulfillment({ tracking_number: 'X1', courier_id: 999, tracking_company: 'Colis Prive', note: 'https://www.colisprive.fr/' });
ok(u.carrier === 'Colis Prive' && u.trackingUrl === 'https://www.colisprive.fr/', 'unknown courier -> platform name + https note');
const ctt = describeFulfillment({ tracking_number: '01234567890123', courier_id: 3659, courier_code: '100114', note: 'https://www.cttexpress.com/' });
ok(ctt.carrier === 'CTT Express' && ctt.trackingUrl === 'https://cttexpress.com/localizador-de-envios/', 'CTT Express by courier id 3659 -> name + tracking page');
const ctt2 = describeFulfillment({ tracking_number: '01234567890123', courier_id: 12345, tracking_company: 'CTT Express' });
ok(ctt2.carrier === 'CTT Express' && ctt2.trackingUrl === 'https://cttexpress.com/localizador-de-envios/', 'CTT Express by name when the courier id is not the known one');
const ctty = describeFulfillment({ tracking_number: 'X1', courier_id: 5317, tracking_company: 'CTTYEX', note: 'https://www.cttyvip888.com/' });
ok(ctty.carrier === 'CTTYEX' && ctty.trackingUrl === 'https://www.cttyvip888.com/', 'CTTYEX (a different carrier) is not mistaken for CTT Express');
ok(describeFulfillment({ tracking_number: 'X1', courier_id: 999, note: 'http://insecure.example/' }).trackingUrl === null, 'unknown courier + http note -> no link (never a guess)');

const base = { name: 'Alberto', team: 'Los Halcones <FC>', email: 'a@b.com', ref: 'abc123xyz9', id: '3d_abc123xyz9', plantOrderNo: '231549-2026026', currency: 'EUR',
  trackingNumber: d.trackingNumber || f.tracking_number, trackingUrl: d.trackingUrl, carrier: d.carrier, shippedAt: '2026-10-19T05:13:00Z' };
const need = { en: 'on its way', es: 'en camino', fr: 'en route', it: 'in viaggio' };
const out = {};
for (const lang of ['en', 'es', 'fr', 'it']) {
  const m = emailTracking({ ...base, lang }); out[`shipped-3d-${lang}`] = m.html;
  ok(m.html.includes(need[lang]) && m.subject.includes(need[lang]), `${lang}: translated, subject "${m.subject}"`);
  ok(m.html.includes('AB123456789US') && m.html.includes('tools.usps.com/go/TrackConfirmAction'), `${lang}: tracking number + carrier link`);
  ok(/\/pages\/(my-order|mi-pedido|mon-commande|il-mio-ordine)\?ref=abc123xyz9&amp;k=[0-9a-f]{32}/.test(m.html), `${lang}: My order link with token`);
  ok(m.html.includes('/account/orders/231549-2026026'), `${lang}: store account order link`);
  ok(!m.html.includes('<FC>') && m.html.includes('&lt;FC&gt;'), `${lang}: team name is escaped`);
  ok(!/undefined|null|\[object/.test(m.html), `${lang}: no undefined/null leftovers`);
  ok(/10[–-]15|1[0-5]/.test(m.html) && !/2026-/.test(m.html.replace(/https?:\/\/\S+/g, '')), `${lang}: delivery window rendered`);
}
const us = emailTracking({ ...base, lang: 'en', currency: 'USD' });
ok(us.html.includes('us.momuto.com/pages/my-order') && us.html.includes('us.momuto.com/account/orders/'), 'USD order points at the US store (page + account)');
// store order (no 3D record), no carrier, no link
const plain = emailTracking({ name: 'Sam', email: 's@x.com', lang: 'en', plantOrderNo: '231549-77', trackingNumber: 'ZZ99', trackingUrl: null, carrier: null, shippedAt: '2026-10-19T00:00:00Z', currency: 'USD' });
out['shipped-store-order-en'] = plain.html;
ok(plain.subject === 'Your MOMUTO order is on its way 🔥' && !plain.html.includes('my-order?ref') && plain.html.includes('/account/orders/231549-77'), 'store order: plain subject, no My order link, account link kept');
ok(!plain.html.includes('Track my parcel') && plain.html.includes('ZZ99') && plain.html.includes('with the carrier'), 'no tracking URL: number shown, no dead button, generic carrier line');
ok(plain.html.includes('info@momuto.com') && !/customer@|orders@/.test(plain.html), 'only info@momuto.com is named as the contact');
if (process.argv.includes('--write-previews')) {
  const dir = path.join(__dirname, '..', 'docs', 'email-previews'); fs.mkdirSync(dir, { recursive: true });
  for (const [k, h] of Object.entries(out)) fs.writeFileSync(path.join(dir, k + '.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="margin:0;padding:24px 8px;background:#e4e4e7">${h}</body>`);
  console.log('previews written to docs/email-previews/');
}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
