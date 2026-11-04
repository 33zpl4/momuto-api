'use strict';
/**
 * probe-3d-entry.js — READ-ONLY live check of the 3D designer's entry (4 Nov 2026): opens public launch links on
 * design.momuto.com in Chromium the way a visitor does (no save, no cart), waits for the tool's state, and prints
 * the configId in the URL, window.__momutoMintedConfigId_ and window.__momutoOw.configId. Expectation after the
 * design-momuto "one configId per visit" deploy: public links get a fresh, different id per visit; the tool's state
 * equals it; a share-copy link keeps its id; the leaked about-page user id is replaced. Exit 1 on any mismatch.
 */
const { chromium } = require('playwright');
const B = 'https://design.momuto.com/3d-configurator/configurator.html?';
const cases = [
  ['public soccer #1', B + 'userId=userIdUrl&configId=ypi9qc1z&suitName=mamuto3suit1&lang=en', 'mint'],
  ['public soccer #2', B + 'userId=userIdUrl&configId=ypi9qc1z&suitName=mamuto3suit1&lang=es', 'mint'],
  ['public basketball', B + 'userId=userIdUrl&configId=avy6d4xt&suitName=basketball&lang=en', 'mint'],
  ['old about-page link', B + 'userId=446703ab1ed3128104&configId=ypi9qc1z&suitName=mamuto3suit1&lang=fr', 'mint-user'],
  ['share copy', B + 'configId=qs45v87d&suitName=mamuto3suit1&useGetShare=true&u=836a7538c524d21956&lang=en', 'keep'],
];
(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader-webgl'] });
  const ids = new Set(); let fails = 0;
  for (const [name, url, expect] of cases) {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    let st = null;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      for (let i = 0; i < 60; i++) { st = await page.evaluate(() => ({ url: new URL(location.href).searchParams.get('configId'), user: new URL(location.href).searchParams.get('userId'), minted: window.__momutoMintedConfigId_ || null, ow: window.__momutoOw ? window.__momutoOw.configId : null })); if (st.ow) break; await page.waitForTimeout(1000); }
    } catch (e) { st = { error: e.message }; }
    const orig = new URL(url).searchParams.get('configId');
    let ok;
    if (expect === 'keep') ok = st && st.url === orig && !st.minted && (!st.ow || st.ow === orig);
    else ok = st && st.minted && st.minted.from === orig && st.url === st.minted.to && /^[a-z][a-z0-9]{7}$/.test(st.url) && st.ow === st.url && !ids.has(st.url) && (expect !== 'mint-user' || st.user !== '446703ab1ed3128104');
    if (st && st.url && expect !== 'keep') ids.add(st.url);
    console.log((ok ? 'PASS' : 'FAIL'), name.padEnd(20), JSON.stringify(st));
    if (!ok) fails++;
    await ctx.close();
  }
  await browser.close(); process.exit(fails ? 1 : 0);
})();
