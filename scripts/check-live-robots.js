'use strict';
// Reads the LIVE robots.txt of the five stores (browser request context: plain fetch gets Cloudflare's challenge) and checks it carries the
// tracking-parameter and per-order-preview rules from static/<host>/robots.txt. Read only.
const { chromium } = require('playwright');
const NEED = ['Disallow: /*?*spm=', 'Disallow: /*?*data_from=', 'Disallow: /*?*sku_code=', 'Disallow: /products/your-custom-design', 'Disallow: /comments/tu-dise', 'Disallow: /account/', 'Sitemap:'];
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' });
  let bad = 0;
  for (const h of ['www', 'es', 'fr', 'it', 'us']) {
    const r = await ctx.request.get(`https://${h}.momuto.com/robots.txt`, { timeout: 45000 });
    const t = await r.text(); const miss = NEED.filter(n => !t.includes(n)); const groups = (t.match(/^user-agent:/gim) || []).length, spm = (t.match(/^Disallow: \/\*\?\*spm=/gm) || []).length;
    console.log(`${miss.length ? '✗' : '✓'} ${h}: http=${r.status()} ${t.length} bytes, ${groups} UA groups, spm rule in ${spm} groups${miss.length ? ', MISSING: ' + miss.join(' | ') : ''}`);
    if (miss.length || r.status() !== 200) bad++;
  }
  await b.close(); if (bad) process.exit(1);
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
