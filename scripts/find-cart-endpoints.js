'use strict';
/**
 * READ-ONLY: which /homeapi/ cart endpoints do the stores' OWN scripts call today? Downloads the public /cart page of each store and every same-site script
 * it loads, then prints every "homeapi/..." string with its context (cart-related ones in full). Nothing is posted anywhere.
 * Why: the checkout hand-off page (checkSumbit.html) calls POST /homeapi/cart/clean, which the platform now answers {"code":404,"msg":"接口未定义"}.
 */
const STORES = [['www', 'https://www.momuto.com'], ['us', 'https://us.momuto.com'], ['es', 'https://es.momuto.com'], ['fr', 'https://fr.momuto.com'], ['it', 'https://it.momuto.com']];
const get = async u => { const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (probe)' } }); return { s: r.status, t: await r.text() }; };
(async () => {
  for (const [k, base] of STORES) {
    console.log('\n========== ' + k + ' ' + base);
    const page = await get(base + '/cart');
    console.log('cart page', page.s, page.t.length, 'chars');
    const srcs = [...page.t.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m => new URL(m[1], base).href).filter(u => new URL(u).host.endsWith('momuto.com'));
    console.log('same-site scripts:', srcs.length);
    const found = new Map();
    const scan = (label, text) => { for (const m of text.matchAll(/["'`]([^"'`\s]*homeapi\/[^"'`\s]*)["'`]/g)) { const e = m[1]; if (!found.has(e)) found.set(e, { label, ctx: text.slice(Math.max(0, m.index - 120), m.index + e.length + 140).replace(/\s+/g, ' ') }); } };
    scan('inline cart page', page.t);
    for (const u of srcs) { try { const r = await get(u); console.log('  ', r.s, u.replace(base, '').slice(0, 90), r.t.length); scan(u.replace(base, '').slice(0, 60), r.t); } catch (e) { console.log('  ERR', u, e.message); } }
    const all = [...found.keys()].sort();
    console.log('\nALL homeapi endpoints seen (' + all.length + '):\n' + all.join('\n'));
    console.log('\nCART-RELATED, with context:');
    for (const [e, v] of found) if (/cart|checkout|order/i.test(e)) console.log('- ' + e + '   [' + v.label + ']\n    ' + v.ctx.slice(0, 300));
  }
})().catch(e => { console.error(e); process.exit(1); });
