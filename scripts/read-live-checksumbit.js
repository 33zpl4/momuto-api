'use strict';
/**
 * READ-ONLY: download the live /checkSumbit.html of each store (the DIY file pasted in the platform admin) and print which version of the hand-off code is
 * really live: markers, the cart/clean call lines, and the header comment. Nothing is posted.
 */
const { chromium } = require('playwright');
const STORES = [['www', 'https://www.momuto.com'], ['us', 'https://us.momuto.com'], ['es', 'https://es.momuto.com'], ['fr', 'https://fr.momuto.com'], ['it', 'https://it.momuto.com']];
setTimeout(() => { console.log('HARD TIMEOUT'); process.exit(2); }, 3 * 60 * 1000);
(async () => {
  const browser = await chromium.launch();
  for (const [k, base] of STORES) {
    const ctx = await browser.newContext({ locale: 'en-GB' }); const page = await ctx.newPage();
    let doc = null;
    page.on('response', async r => { try { if (/\/checkSumbit\.html/.test(r.url()) && r.request().resourceType() === 'document' && doc === null) doc = await r.text(); } catch (e) {} });
    await page.goto(base + '/checkSumbit.html?data=' + encodeURIComponent('{"goods":{},"oem":[]}'), { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2500));
    console.log('\n==== ' + k + ' ' + base + '/checkSumbit.html  ' + (doc === null ? 'NOT CAPTURED' : doc.length + ' chars'));
    if (doc) {
      const has = n => doc.includes(n);
      console.log('markers: cleanCart=' + has('cleanCart') + ' requestWithRetry=' + has('function requestWithRetry') + ' syncAjaxRequestWithRetry=' + has('syncAjaxRequestWithRetry') + " type:method=" + has("method || 'POST'") + ' checkout-beacon=' + has('checkout-beacon') + ' abortToCart=' + has('abortToCart') + ' hardenedV3=' + /hardened handoff, v3/.test(doc));
      console.log('lines mentioning cart/clean:'); doc.split('\n').forEach((l, i) => { if (/cart\/clean/.test(l)) console.log('  ' + (i + 1) + ': ' + l.trim().slice(0, 170)); });
      console.log('header comment: ' + (doc.match(/MOMUTO hardened[^\n]*/) || ['(none)'])[0]);
    }
    await ctx.close().catch(() => {});
  }
  await browser.close().catch(() => {}); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
