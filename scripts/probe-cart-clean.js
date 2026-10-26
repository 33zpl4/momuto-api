'use strict';
/**
 * READ-ONLY-ish (anonymous, empty throwaway cart): POST /homeapi/cart/clean exactly as the checkSumbit hand-off page does (same origin, body []), once per store,
 * and print status + body. Tells which stores' platform still answers the endpoint. Also prints the same for /homeapi/cart/add with NO body (a safe malformed call)
 * so a missing route (404 "接口未定义") can be told from a present-but-unhappy one.
 */
const { chromium } = require('playwright');
const STORES = [['www', 'https://www.momuto.com'], ['us', 'https://us.momuto.com'], ['es', 'https://es.momuto.com'], ['fr', 'https://fr.momuto.com'], ['it', 'https://it.momuto.com']];
(async () => {
  const browser = await chromium.launch();
  for (const [k, base] of STORES) {
    const ctx = await browser.newContext({ locale: 'en-GB' }); const page = await ctx.newPage();
    await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2500));
    for (const [name, path, body] of [['clean', '/homeapi/cart/clean', '[]'], ['add (empty body)', '/homeapi/cart/add', '']]) {
      const out = await page.evaluate(async ([p, b]) => { try { const r = await fetch(p, { method: 'POST', headers: b ? { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' } : {}, body: b || undefined }); return r.status + ' ' + (await r.text()).slice(0, 200).replace(/\s+/g, ' '); } catch (e) { return 'ERR ' + e.message; } }, [path, body]);
      console.log(`${k.padEnd(4)} ${name.padEnd(17)} ${out}`);
    }
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
