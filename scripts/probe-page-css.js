#!/usr/bin/env node
/**
 * Where does a page's CSS come from? Loads a live page in Chromium and prints, per stylesheet (inline <style> with its id / position / location,
 * or the linked href), every rule whose selector matches PATTERN (default: the hero), including rules nested in @media.
 * Read-only. The store theme's CSS lives in the platform (CMS blocks, custom code), not in this repo (docs/store-theme-css.md): this is how
 * to see it. URL=https://www.momuto.com/ PATTERN='momuto-hero|btn-primary|btn-link' node scripts/probe-page-css.js
 */
const { chromium } = require('playwright');
const URL_ = process.env.URL || 'https://www.momuto.com/';
const PATTERN = process.env.PATTERN || 'momuto-hero|btn-primary|btn-link';
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3500);
  const out = await page.evaluate((pat) => {
    const re = new RegExp(pat);
    const res = [];
    const all = Array.from(document.styleSheets);
    all.forEach((sh, idx) => {
      const node = sh.ownerNode;
      let where = sh.href ? `LINK ${sh.href}` : `INLINE <style${node && node.id ? ' id="' + node.id + '"' : ''}${node && node.className ? ' class="' + node.className + '"' : ''}> in <${node && node.parentElement ? node.parentElement.tagName.toLowerCase() : '?'}>` + (node && node.closest && node.closest('[class]') && node.parentElement.tagName !== 'HEAD' ? ' inside .' + String(node.parentElement.className).split(' ')[0] : '');
      let rules; try { rules = sh.cssRules; } catch (e) { res.push({ sheet: idx, where, error: 'cross-origin, unreadable' }); return; }
      const hits = [];
      const walk = (list, ctx) => Array.from(list).forEach(r => {
        if (r.cssRules && r.conditionText !== undefined) walk(r.cssRules, `@media ${r.conditionText}`);
        else if (r.selectorText && re.test(r.selectorText)) hits.push((ctx ? ctx + ' { ' : '') + r.cssText.slice(0, 520) + (ctx ? ' }' : ''));
      });
      walk(rules, '');
      if (hits.length) res.push({ sheet: idx, of: all.length, where, rules: hits, bytes: (node && node.textContent ? node.textContent.length : null) });
    });
    return res;
  }, PATTERN);
  console.log(`URL ${URL_}  PATTERN /${PATTERN}/  stylesheets with matches: ${out.length}`);
  for (const s of out) {
    console.log(`\n--- sheet ${s.sheet}${s.of ? '/' + s.of : ''}: ${s.where}${s.bytes ? ' (' + s.bytes + ' chars)' : ''}${s.error ? ' ' + s.error : ''}`);
    (s.rules || []).forEach(r => console.log('  ' + r));
  }
  if (process.env.DUMP) {
    const full = await page.evaluate((pat) => Array.from(document.querySelectorAll('style')).filter(n => new RegExp(pat).test(n.textContent)).map(n => n.textContent), process.env.DUMP_MATCH || 'momuto-hero-container');
    full.forEach((t, i) => console.log(`\n=== BEGIN full inline style ${i + 1}/${full.length} (${t.length} chars)\n${t}\n=== END`));
  }
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
