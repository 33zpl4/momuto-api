'use strict';
/**
 * probe-html-weight.js — how big is the raw HTML Googlebot fetches, and where does the page's own content start?
 * Googlebot reads only the first 2 MB of an HTML file (uncompressed); anything after is not indexed. Reports per URL: raw bytes, byte offset of
 * #MainContent, bytes in <head>, the biggest inline <script>/<style> blocks (so we know what to move out), and the share before the content.
 * Env: URLS (comma list)  DUMP=regex (also print inline scripts matching it)  DUMP_CHARS=2600
 */
const { chromium } = require('playwright');
const URLS = (process.env.URLS || 'https://www.momuto.com/pages/design-your-own-soccer-jersey,https://www.momuto.com/pages/ready-to-play-thank-you,https://www.momuto.com/pages/custom-soccer-jerseys,https://www.momuto.com/,https://us.momuto.com/pages/design-your-own-soccer-jersey,https://es.momuto.com/pages/crea-tu-camiseta-de-futbol').split(',').map(s => s.trim());
const kb = n => (n / 1024).toFixed(0) + ' KB';
(async () => {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ locale: 'en-US' });
  for (const url of URLS) {
    const page = await ctx.newPage();
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const buf = await resp.body(); const html = buf.toString('utf8');
    const enc = (await resp.allHeaders())['content-encoding'] || 'none';
    const mc = html.search(/id=["']MainContent["']/), headEnd = html.indexOf('</head>'), bodyStart = html.search(/<body/i);
    const blocks = [...html.matchAll(/<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map(m => ({ tag: m[1], len: Buffer.byteLength(m[0]), at: m.index, head: m[2].trim().slice(0, 70).replace(/\s+/g, ' '), src: (m[0].match(/^<script[^>]*src=["']([^"']+)/i) || [])[1] })).sort((a, b) => b.len - a.len);
    const inlineTotal = blocks.reduce((a, b) => a + b.len, 0);
    console.log(`\n${url}\n  raw HTML ${buf.length} bytes (${kb(buf.length)}, content-encoding ${enc}) — Googlebot limit 2,097,152 (${(100 * buf.length / 2097152).toFixed(0)}% used)\n  <body> at byte ${bodyStart}, #MainContent at byte ${mc} (${(100 * mc / buf.length).toFixed(0)}% into the file), </head> at ${headEnd}\n  inline script+style total ${kb(inlineTotal)} (${(100 * inlineTotal / buf.length).toFixed(0)}% of the HTML), ${blocks.length} blocks`);
    blocks.slice(0, 8).forEach(b => console.log(`    ${kb(b.len).padStart(8)} <${b.tag}> at byte ${b.at}: ${b.src ? 'src=' + b.src.slice(0, 60) : b.head}`));
    if (process.env.DUMP) {
      const re = new RegExp(process.env.DUMP);
      blocks.filter(b => b.tag === 'script' && !b.src).forEach(b => {
        const full = html.slice(b.at, b.at + b.len);
        if (re.test(full)) console.log(`\n  ---- inline <script> ${kb(b.len)} at byte ${b.at} matching /${process.env.DUMP}/ ----\n${full.replace(/\n\s*\n/g, '\n').slice(0, +(process.env.DUMP_CHARS || 2600))}`);
      });
    }
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
