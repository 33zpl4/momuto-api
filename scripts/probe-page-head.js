#!/usr/bin/env node
/**
 * probe-page-head.js — read-only: fetch live URLs from a GitHub Actions runner (the sandbox cannot reach the stores)
 * and print what search engines see in <head>: HTTP status + redirects, <title>, canonical, meta robots, meta description,
 * hreflang <link> tags, H1s, and whether the URL is listed (with which alternates) in its host's /sitemap.xml.
 * Env: URLS (comma or newline separated). Writes probe-page-head/report.json.
 * Uses Playwright Chromium (the stores sit behind a Cloudflare managed challenge that answers plain fetch with 403 "Just a moment").
 */
'use strict';
const fs = require('fs');
const { chromium } = require('playwright');
let browser, ctx;
async function getHtml(url) {
  if (!browser) { browser = await chromium.launch(); ctx = await browser.newContext({ userAgent: UA, locale: 'en-US' }); }
  const page = await ctx.newPage();
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    let status = resp ? resp.status() : 0;
    for (let i = 0; i < 6 && /just a moment/i.test(await page.title()); i++) await page.waitForTimeout(3000); // Cloudflare challenge
    const html = await page.content();
    if (/just a moment/i.test(await page.title())) status = 'CF-CHALLENGE';
    return { status, finalUrl: page.url(), html, headers: resp ? resp.headers() : {} };
  } finally { await page.close(); }
}
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const urls = (process.env.URLS || '').split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
if (!urls.length) { console.error('URLS is empty'); process.exit(1); }

const pick = (html, re) => { const m = html.match(re); return m ? m[1].replace(/\s+/g, ' ').trim() : null; };
const all = (html, re) => { const out = []; let m; while ((m = re.exec(html))) out.push(m); return out; };
const attr = (tag, name) => { const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i')); return m ? m[1] : null; };

const sitemapCache = {};
async function sitemapFor(host) {
  if (sitemapCache[host]) return sitemapCache[host];
  try {
    const r = await getHtml(`https://${host}/sitemap.xml`);
    const xml = String(r.html || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    const entries = {};
    for (const m of all(xml, /<url>([\s\S]*?)<\/url>/g)) {
      const loc = pick(m[1], /<loc>\s*([^<]+?)\s*<\/loc>/);
      if (!loc) continue;
      entries[loc.replace(/\/$/, '')] = all(m[1], /<xhtml:link[^>]*>/g).map((t) => `${attr(t[0], 'hreflang')}→${attr(t[0], 'href')}`);
    }
    sitemapCache[host] = { status: r.status, count: Object.keys(entries).length, entries };
  } catch (e) { sitemapCache[host] = { status: 'ERR ' + e.message, count: 0, entries: {} }; }
  return sitemapCache[host];
}

(async () => {
  const report = [];
  for (const url of urls) {
    const row = { url };
    try {
      const r = await getHtml(url);
      row.status = r.status; row.finalUrl = r.finalUrl; row.xRobotsTag = r.headers['x-robots-tag'] || null;
      const html = r.html;
      const head = (html.match(/<head[\s\S]*?<\/head>/i) || [html.slice(0, 200000)])[0];
      row.title = pick(head, /<title[^>]*>([\s\S]*?)<\/title>/i);
      row.canonical = (all(head, /<link[^>]+rel=["']canonical["'][^>]*>/gi).map((m) => attr(m[0], 'href')));
      row.metaRobots = all(head, /<meta[^>]+name=["']robots["'][^>]*>/gi).map((m) => attr(m[0], 'content'));
      row.metaDescription = all(head, /<meta[^>]+name=["']description["'][^>]*>/gi).map((m) => attr(m[0], 'content'));
      row.hreflangTags = all(head, /<link[^>]+hreflang=[^>]*>/gi).map((m) => `${attr(m[0], 'hreflang')}→${attr(m[0], 'href')}`);
      row.h1 = all(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi).map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()).slice(0, 5);
      row.htmlBytes = html.length;
      const host = new URL(url).host; const sm = await sitemapFor(host);
      row.sitemap = { status: sm.status, urls: sm.count, listed: Object.prototype.hasOwnProperty.call(sm.entries, url.replace(/\/$/, '')), alternates: sm.entries[url.replace(/\/$/, '')] || [] };
    } catch (e) { row.error = e.message; }
    report.push(row);
    console.log(`\n=== ${url}`);
    for (const [k, v] of Object.entries(row)) if (k !== 'url') console.log(`  ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
  }
  fs.mkdirSync('probe-page-head', { recursive: true });
  fs.writeFileSync('probe-page-head/report.json', JSON.stringify(report, null, 1));
  if (browser) await browser.close();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
