'use strict';
/**
 * READ-ONLY: which /homeapi/ cart endpoints do the stores' OWN scripts call today? Opens each store's public /cart page in a real browser (a plain download
 * gets 403), records every same-site script it loads, and prints every "homeapi/..." string with its context. Nothing is posted anywhere.
 * Why: the checkout hand-off page (checkSumbit.html) calls POST /homeapi/cart/clean, which the platform now answers {"code":404,"msg":"接口未定义"}.
 */
const { chromium } = require('playwright');
const STORES = [['www', 'https://www.momuto.com'], ['us', 'https://us.momuto.com'], ['es', 'https://es.momuto.com'], ['fr', 'https://fr.momuto.com'], ['it', 'https://it.momuto.com']];
const ONLY = (process.env.PROBE_STORES || 'www').split(',');
(async () => {
  const browser = await chromium.launch();
  for (const [k, base] of STORES) {
    if (!ONLY.includes(k) && !ONLY.includes('all')) continue;
    console.log('\n========== ' + k + ' ' + base);
    const ctx = await browser.newContext({ locale: 'en-GB' }); const page = await ctx.newPage();
    const scripts = new Map();
    page.on('response', async r => { try { const u = r.url(); const ct = r.headers()['content-type'] || ''; if (new URL(u).host.endsWith('momuto.com') && /javascript|html|json/.test(ct)) scripts.set(u, await r.text()); } catch (e) {} });
    const resp = await page.goto(base + '/cart', { waitUntil: 'networkidle', timeout: 60000 }).catch(e => { console.log('goto error', e.message); return null; });
    console.log('cart page', resp && resp.status(), 'captured', scripts.size, 'same-site responses');
    const found = new Map();
    for (const [u, text] of scripts) for (const m of text.matchAll(/["'`]([^"'`\s]*homeapi\/[^"'`\s]*)["'`]/g)) { const e = m[1]; if (!found.has(e)) found.set(e, { label: u.replace(base, '').slice(0, 70), ctx: text.slice(Math.max(0, m.index - 140), m.index + e.length + 160).replace(/\s+/g, ' ') }); }
    const all = [...found.keys()].sort();
    console.log('\nALL homeapi endpoints seen (' + all.length + '):\n' + all.join('\n'));
    console.log('\nCART-RELATED, with context:');
    for (const [e, v] of found) if (/cart|checkout|order/i.test(e)) console.log('- ' + e + '   [' + v.label + ']\n    ' + v.ctx.slice(0, 340));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
