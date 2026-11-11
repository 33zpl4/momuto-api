'use strict';
/**
 * probe-cls.js — what moves, and when. Loads each URL in Chromium (desktop + mobile), records every layout-shift entry with its sources
 * (element, rect before/after), the time it happened, and what the page was doing then (fonts loading, stylesheets arriving).
 * Env: URLS (comma list; default the three key pages)
 */
const { chromium } = require('playwright');
const URLS = (process.env.URLS || 'https://www.momuto.com/pages/design-your-own-soccer-jersey,https://www.momuto.com/pages/custom-soccer-jerseys,https://www.momuto.com/').split(',').map(s => s.trim());
(async () => {
  const browser = await chromium.launch();
  for (const [name, vp] of Object.entries({ desktop: { width: 1366, height: 800 }, mobile: { width: 390, height: 800, isMobile: true, hasTouch: true } })) {
    for (const url of URLS) {
      for (let run = 1; run <= 2; run++) {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, locale: 'en-US' });
        const page = await ctx.newPage();
        await page.addInitScript(() => {
          window.__shifts = []; window.__marks = [];
          new PerformanceObserver(l => { for (const e of l.getEntries()) window.__shifts.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), input: e.hadRecentInput, src: (e.sources || []).map(s => ({ n: (s.node && (s.node.id ? '#' + s.node.id : s.node.nodeName + (s.node.className && typeof s.node.className === 'string' ? '.' + s.node.className.split(' ')[0] : ''))) || '?', from: [s.previousRect.y | 0, s.previousRect.height | 0], to: [s.currentRect.y | 0, s.currentRect.height | 0] })) }); }).observe({ type: 'layout-shift', buffered: true });
          document.addEventListener('DOMContentLoaded', () => window.__marks.push('DCL@' + Math.round(performance.now())));
          window.addEventListener('load', () => window.__marks.push('load@' + Math.round(performance.now())));
        });
        const fonts = []; page.on('requestfinished', r => { if (/font|woff|fonts\.g/i.test(r.url())) fonts.push(r.url().replace(/^https?:\/\//, '').slice(0, 60) + '@' + Math.round(performance.now())); });
        await page.goto(url, { waitUntil: 'load', timeout: 60000 }); await page.waitForTimeout(4000);
        const r = await page.evaluate(() => ({ shifts: window.__shifts, marks: window.__marks, fontsReady: document.fonts ? [...document.fonts].map(f => f.family + ':' + f.status).slice(0, 8) : [], h1: (document.querySelector('h1') || {}).textContent, titleBlock: !!document.querySelector('.page-title, .main-title, h1.title') }));
        const total = r.shifts.filter(s => !s.input).reduce((a, s) => a + s.v, 0);
        console.log(`${name} run${run} ${url}\n  CLS=${total.toFixed(3)} marks=${r.marks.join(' ')} fonts=${r.fontsReady.join(',') || '-'}`);
        r.shifts.filter(s => !s.input && s.v >= 0.01).forEach(s => console.log(`  shift ${s.v} @${s.t}ms: ${s.src.map(x => `${x.n} y ${x.from[0]}→${x.to[0]} h ${x.from[1]}→${x.to[1]}`).join(' ; ')}`));
        await ctx.close();
      }
    }
  }
  await browser.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
