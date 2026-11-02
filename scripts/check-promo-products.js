'use strict';

/**
 * READ-ONLY. Lists every store product whose title carries the fixed-price "Promo" marker (design-momuto
 * server-patches README section 13) and flags the ones whose title ALSO contains the words the quantity-discount
 * campaigns match on (personalizad* / personalis* / personnalis* / custom, kit) - those get the rebate stacked on the fixed price.
 * Prints store, id, handle, title, price, status and every collection field the product carries. No customer data.
 *
 * Exits 1 when any product is at risk (daily workflow Check Promo Products goes red).
 * Env: OEMSAAS_TOKEN_EN / _ES / _FR / _IT / _US, STORES (default all five)
 */
const HOST = 'https://openapi.oemapps.com';
const MARKER = /\bpromo\b|fixed[\s-]*price|precio[\s-]*fijo|prix[\s-]*fixe|prezzo[\s-]*fisso/iu;
const CAMPAIGN_WORDS = /personali[sz]ad|personali[sz]e|personnalis|personalizz|custom/iu;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(token, p) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(HOST + p, { headers: { token } });
    const j = JSON.parse(await res.text());
    if (j.code === 0 || j.code === 200) return j.data;
    if (!(j.code === 1000 || /Too many/i.test(j.msg || '')) || i === 3) throw new Error(`code ${j.code}: ${j.msg}`);
    await sleep(1500 * (i + 1));
  }
}
async function allProducts(token) {
  const all = []; let since = ''; const limit = 200;
  for (;;) {
    const arr = await api(token, `/products?limit=${limit}${since ? `&since_id=${since}` : ''}`);
    const rows = Array.isArray(arr) ? arr : [];
    all.push(...rows);
    if (rows.length < limit) break;
    since = rows[rows.length - 1].id; await sleep(400);
  }
  return all;
}
const colls = p => Object.keys(p).filter(k => /collect/i.test(k)).map(k => `${k}=${JSON.stringify(p[k]).slice(0, 160)}`).join(' ');

(async () => {
  let atRisk = 0;
  const stores = (process.env.STORES || 'EN,ES,FR,IT,US').split(',').map(s => s.trim()).filter(Boolean);
  for (const st of stores) {
    const token = process.env['OEMSAAS_TOKEN_' + st];
    if (!token) { console.log(`== ${st}: no token`); continue; }
    const prods = await allProducts(token);
    const promo = prods.filter(p => MARKER.test(String(p.title || '')));
    console.log(`\n== ${st}: ${prods.length} products, ${promo.length} with the Promo marker`);
    for (const p of promo) {
      const risk = CAMPAIGN_WORDS.test(String(p.title || ''));
      if (risk) atRisk++;
      const prices = [...new Set((p.variants || []).map(v => v.price))].join('/');
      console.log(`  ${risk ? 'AT RISK' : 'ok     '} id=${p.id} status=${p.status} price=${prices} title=${JSON.stringify(p.title)}  ${colls(p)}`);
    }
  }
  if (atRisk) {
    console.error(`\n${atRisk} Promo product(s) carry a discount-campaign word in the title: the platform rebate stacks on the fixed price.\n` +
      'Rename them without personalizada/o / custom (keep "Promo" and the kit/jersey word) and check the product left the campaign collection.');
    process.exit(1);
  }
  console.log('\nAll Promo products are clear of the campaign words.');
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
