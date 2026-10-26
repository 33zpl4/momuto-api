'use strict';
/**
 * READ-ONLY-ish (anonymous, empty throwaway cart): POST /homeapi/cart/clean exactly like the checkSumbit hand-off page (same origin, empty body, jQuery-style headers),
 * 5 times per store, and print status, body and the response headers that say which server answered. Hard time limits everywhere (an earlier version hung).
 */
const { chromium } = require('playwright');
const STORES = [['www', 'https://www.momuto.com'], ['us', 'https://us.momuto.com'], ['es', 'https://es.momuto.com'], ['fr', 'https://fr.momuto.com'], ['it', 'https://it.momuto.com']];
setTimeout(() => { console.log('HARD TIMEOUT'); process.exit(2); }, 4 * 60 * 1000);
(async () => {
  const browser = await chromium.launch();
  for (const [k, base] of STORES) {
    const ctx = await browser.newContext({ locale: 'en-GB' }); const page = await ctx.newPage();
    await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(e => console.log(k, 'goto', e.message.slice(0, 60)));
    await new Promise(r => setTimeout(r, 2000));
    for (let i = 1; i <= 5; i++) {
      const out = await page.evaluate(async () => {
        const c = new AbortController(); const t = setTimeout(() => c.abort(), 15000);
        try {
          const r = await fetch('/homeapi/cart/clean', { method: 'POST', signal: c.signal, headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', 'x-requested-with': 'XMLHttpRequest', 'accept': 'application/json, text/javascript, */*; q=0.01' } });
          const h = {}; for (const n of ['server', 'via', 'cf-ray', 'x-request-id', 'x-trace-id', 'x-served-by', 'x-cache', 'date']) { const v = r.headers.get(n); if (v) h[n] = v; }
          return JSON.stringify({ status: r.status, body: (await r.text()).slice(0, 160).replace(/\s+/g, ' '), headers: h });
        } catch (e) { return 'ERR ' + e.message; } finally { clearTimeout(t); }
      });
      console.log(`${k.padEnd(4)} #${i} ${out}`);
      await new Promise(r => setTimeout(r, 1500));
    }
    await ctx.close().catch(() => {});
  }
  await browser.close().catch(() => {});
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
