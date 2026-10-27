'use strict';
/**
 * READ-ONLY: open the customer's real share link (27 Oct 2026: "it shows the default jersey, not our design") and the variants that differ from the link that
 * works (the admin's "view" link), each in a fresh anonymous browser, and screenshot what the share page shows. Viewing a share link changes nothing.
 *   A  the customer's exact link  (leading "?&", lang=es)
 *   B  the admin link that works    (no lang, no leading "&")
 *   C  lang=es, no leading "&"
 *   D  no lang, leading "?&"
 */
const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const OUT = path.join(__dirname, '..', 'probe-share-out'); fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.log('HARD TIMEOUT'); process.exit(2); }, 9 * 60 * 1000);
const BASE = 'https://design.momuto.com/3d-configurator/share.html';
const Q = 'configId=1tvltp1p&suitName=mamuto3suit1&u=866adf8c44dfd91205&useGetShare=true';
const VARIANTS = {
  A: `${BASE}?&configId=1tvltp1p&suitName=mamuto3suit1&lang=es&u=866adf8c44dfd91205&useGetShare=true`,
  B: `${BASE}?${Q}`,
  C: `${BASE}?${Q}&lang=es`,
  D: `${BASE}?&${Q}`,
};
const ONLY = (process.env.PROBE_VARIANTS || 'A,B,C,D').split(',');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const k of ONLY) {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 900 }, locale: 'es-ES' }); const p = await ctx.newPage();
    const calls = [];
    p.on('response', async r => { try { const u = r.url(); if (/\.(png|jpe?g|webp|svg|gif|woff2?|css|ico|glb|js|map|ttf)(\?|$)/i.test(u) || /google|facebook|hotjar|clarity/.test(u)) return; let b = ''; try { b = (await r.text()).slice(0, 200).replace(/\s+/g, ' '); } catch (e) {} calls.push(`${r.request().method()} ${r.status()} ${u.replace('https://design.momuto.com', '').slice(0, 140)} ${(r.request().postData() || '').slice(0, 120)} => ${b}`); } catch (e) {} });
    console.log(`\n===== ${k}: ${VARIANTS[k]}`);
    await p.goto(VARIANTS[k], { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => console.log('goto', e.message.slice(0, 80)));
    await sleep(50000);
    await p.screenshot({ path: path.join(OUT, `link-${k}.png`), timeout: 60000 }).catch(e => console.log('shot', k, e.message.slice(0, 60)));
    console.log(calls.filter(c => !/^GET 200 \/3d-configurator\/share\.html/.test(c)).slice(0, 14).join('\n'));
    await ctx.close().catch(() => {});
  }
  console.log('done'); await browser.close().catch(() => {}); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
