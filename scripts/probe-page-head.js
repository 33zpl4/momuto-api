#!/usr/bin/env node
/**
 * probe-page-head.js — read-only: fetch live URLs from a GitHub Actions runner (the sandbox cannot reach the stores)
 * and print what search engines see in <head>: HTTP status + redirects, <title>, canonical, meta robots, meta description,
 * hreflang <link> tags, H1s, and whether the URL is listed (with which alternates) in its host's /sitemap.xml.
 * Env: URLS (comma or newline separated). Writes probe-page-head/report.json.
 */
'use strict';
const fs = require('fs');
const UA = 'Mozilla/5.0 (compatible; momuto-probe/1.0; +https://www.momuto.com)';
const urls = (process.env.URLS || '').split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
if (!urls.length) { console.error('URLS is empty'); process.exit(1); }

const pick = (html, re) => { const m = html.match(re); return m ? m[1].replace(/\s+/g, ' ').trim() : null; };
const all = (html, re) => { const out = []; let m; while ((m = re.exec(html))) out.push(m); return out; };
const attr = (tag, name) => { const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i')); return m ? m[1] : null; };

const sitemapCache = {};
async function sitemapFor(host) {
  if (sitemapCache[host]) return sitemapCache[host];
  try {
    const r = await fetch(`https://${host}/sitemap.xml`, { headers: { 'User-Agent': UA } });
    const xml = r.ok ? await r.text() : '';
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
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow' });
      row.status = r.status; row.finalUrl = r.url; row.xRobotsTag = r.headers.get('x-robots-tag');
      const html = await r.text();
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
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
