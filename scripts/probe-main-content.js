'use strict';
/**
 * probe-main-content.js — what a crawler sees as the MAIN content of each URL (the #MainContent text, scripts and styles excluded),
 * and how similar each pair is (5-word shingles, Jaccard). For duplicate-canonical diagnosis (docs/us-indexing-2026-11.md).
 * Env: URLS (comma list, required)  SHOW=700 (chars of text to print)
 */
const { chromium } = require('playwright');
const URLS = (process.env.URLS || '').split(',').map(s => s.trim()).filter(Boolean);
const SHOW = +(process.env.SHOW || 700);
const shingles = t => { const w = t.toLowerCase().replace(/\s+/g, ' ').trim().split(' '), s = new Set(); for (let i = 0; i + 5 <= w.length; i++) s.add(w.slice(i, i + 5).join(' ')); return s; };
const jac = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; for (const x of a) if (b.has(x)) n++; return n / (a.size + b.size - n); };
(async () => {
  if (!URLS.length) throw new Error('URLS missing');
  const browser = await chromium.launch(); const ctx = await browser.newContext({ locale: 'en-US', viewport: { width: 1366, height: 900 } });
  const out = [];
  for (const url of URLS) {
    const p = await ctx.newPage(); const resp = await p.goto(url, { waitUntil: 'load', timeout: 60000 }); await p.waitForTimeout(2500);
    const d = await p.evaluate(() => {
      const m = document.querySelector('#MainContent') || document.body;
      const clone = m.cloneNode(true); clone.querySelectorAll('script,style,noscript,template').forEach(e => e.remove());
      const heads = [...m.querySelectorAll('h1,h2,h3')].map(h => h.tagName + ': ' + h.textContent.trim().replace(/\s+/g, ' ').slice(0, 70)).slice(0, 10);
      return { text: clone.innerText.replace(/\s+/g, ' ').trim(), heads, title: document.title, canonical: (document.querySelector('link[rel=canonical]') || {}).href, robots: (document.querySelector('meta[name=robots]') || {}).content, links: m.querySelectorAll('a').length, imgs: m.querySelectorAll('img').length, iframes: m.querySelectorAll('iframe').length };
    });
    out.push({ url, status: resp.status(), ...d });
    console.log(`\n### ${url}  http=${resp.status()}\n  title: ${d.title}\n  canonical: ${d.canonical}  robots: ${d.robots || '-'}\n  main text: ${d.text.length} chars, links=${d.links} imgs=${d.imgs} iframes=${d.iframes}\n  headings: ${d.heads.join(' | ')}\n  text: ${d.text.slice(0, SHOW)}`);
    await p.close();
  }
  if (out.length > 1) { console.log('\n### pairwise similarity of main content'); for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) console.log(`  ${(jac(shingles(out[i].text), shingles(out[j].text)) * 100).toFixed(0).padStart(3)}%  ${out[i].url.replace(/^https:\/\//, '')}  ↔  ${out[j].url.replace(/^https:\/\//, '')}`); }
  await browser.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
