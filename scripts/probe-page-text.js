#!/usr/bin/env node
// Read-only: open each URL in Chromium (runner), print the visible text lines that match KEYWORDS
// (with one line of context after), plus the page title. For competitor fact-checks (fabric, price)
// that the sandbox cannot reach. Env: URLS (comma/newline), KEYWORDS (regex, case-insensitive), MAX (lines per page).
const { chromium } = require('playwright');
const urls = (process.env.URLS || '').split(/[\n,]/).map(s => s.trim()).filter(Boolean);
const kw = new RegExp(process.env.KEYWORDS || 'elast|poli[eé]ster|polyester|tejido|fabric|tissu|material|gsm|g/m|power 170|cio-tex|precio|price|prix|€|\\$', 'i');
const MAX = parseInt(process.env.MAX || '60', 10);
const FOLLOW = process.env.FOLLOW ? new RegExp(process.env.FOLLOW, 'i') : null;   // also open links whose href matches (max 12)
const queue = [...urls]; const seen = new Set();
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ locale: 'es-ES', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' });
  while (queue.length) {
    const u = queue.shift(); if (seen.has(u)) continue; seen.add(u);
    const page = await ctx.newPage();
    try {
      const r = await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(4000);
      for (const sel of ['#onetrust-accept-btn-handler', 'button:has-text("Aceptar")', 'button:has-text("Accept")', 'button:has-text("Akzeptieren")']) { try { await page.click(sel, { timeout: 800 }); break; } catch (e) {} }
      // expand "show more" style toggles
      for (const t of ['mostrar más', 'ver más', 'show more', 'read more', 'mehr anzeigen']) { try { await page.click(`text=${t}`, { timeout: 600 }); } catch (e) {} }
      await page.waitForTimeout(1200);
      const text = await page.evaluate(() => document.body.innerText);
      const lines = text.split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
      console.log(`\n=== ${u}\n    HTTP ${r && r.status()} · title: ${await page.title()} · ${lines.length} lines`);
      let n = 0;
      for (let i = 0; i < lines.length && n < MAX; i++) {
        if (kw.test(lines[i])) { console.log('  > ' + lines[i].slice(0, 300) + (lines[i + 1] && !kw.test(lines[i + 1]) ? '  ‖ ' + lines[i + 1].slice(0, 160) : '')); n++; }
      }
      if (!n) console.log('  (no matching lines)');
      if (FOLLOW && urls.includes(u)) {
        const hrefs = await page.evaluate(() => Array.from(document.querySelectorAll('a[href]')).map(a => a.href));
        const pick = [...new Set(hrefs.filter(h => FOLLOW.test(h)))].slice(0, 12);
        console.log('    following: ' + pick.join(' '));
        queue.push(...pick);
      }
    } catch (e) { console.log(`\n=== ${u}\n    ERROR ${e.message.slice(0, 200)}`); }
    await page.close();
  }
  await browser.close();
})();
