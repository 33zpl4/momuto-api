'use strict';
// Reads the LIVE sitemap.xml of each store and requests every listed URL (pages, blogs, collections and the root by default), reporting
// any that does not answer 200. Why: Google's index audit found the Italian sitemap listing 23 pages that return 404 and the US one 8;
// this is our own direct check so a regression is caught the night the sitemap is rebuilt, not weeks later in Search Console.
// Read only (GET requests only). Uses Playwright's request context because plain fetch gets Cloudflare's challenge from runners.
//
// Env: STORES (comma list, default www,es,fr,it,us), KINDS (default pages,blogs,collections; add "products" to include /products/),
//      CONCURRENCY (default 2), PAUSE_MS before each request (default 350), LIMIT (max URLs per store, default 800).
// Classes: ok (200), redirected (200 but final URL differs, trailing slash ignored), dead (404/410), other (anything else).
// Writes sitemap-links/<store>.json. Exit 1 if any dead URL exists, else 0.
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

function parseLocs(xml) {
  const out = [];
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml))) out.push(m[1].replace(/&amp;/g, '&'));
  return out;
}

function pathOf(u) {
  try { const x = new URL(u); return x.pathname + x.search; } catch (e) { return u; }
}

function wanted(u, kinds) {
  let p;
  try { p = new URL(u).pathname; } catch (e) { return false; }
  if (p === '/' || p === '') return true;
  return kinds.some(k => p.startsWith('/' + k + '/'));
}

const stripSlash = u => u.replace(/\/+$/, '');

function classify(listed, status, finalUrl) {
  if (status === 200) return stripSlash(finalUrl) === stripSlash(listed) ? 'ok' : 'redirected';
  if (status === 404 || status === 410) return 'dead';
  return 'other';
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getOnce(ctx, url) {
  const r = await ctx.get(url, { timeout: 45000, maxRedirects: 10 });
  return { status: r.status(), finalUrl: r.url() };
}

// The stores rate-limit bursts (HTTP 429 after ~100 quick requests, first run 14 Nov 2026). Every request waits PAUSE_MS first,
// and a 429 / 5xx / network error backs off 6 s, 20 s, 45 s before it is reported.
const PAUSE_MS = Math.max(0, parseInt(process.env.PAUSE_MS, 10) || 350);
async function check(ctx, url) {
  let res;
  const waits = [6000, 20000, 45000];
  for (let attempt = 0; attempt <= waits.length; attempt++) {
    await sleep(PAUSE_MS);
    try {
      res = await getOnce(ctx, url);
      if (res.status < 500 && res.status !== 429) break;
    } catch (e) {
      res = { status: 0, finalUrl: url, error: e.message };
    }
    if (attempt < waits.length) await sleep(waits[attempt]);
  }
  return { url, status: res.status, finalUrl: res.finalUrl, error: res.error, cls: classify(url, res.status, res.finalUrl) };
}

async function pool(items, n, fn) {
  const results = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; results[k] = await fn(items[k]); }
  }));
  return results;
}

function summarize(store, results) {
  const c = { ok: 0, redirected: 0, dead: 0, other: 0 };
  results.forEach(r => c[r.cls]++);
  const lines = [`${c.dead ? '✗' : '✓'} ${store}: ${results.length} checked, ok=${c.ok} redirected=${c.redirected} dead=${c.dead} other=${c.other}`];
  for (const cls of ['dead', 'redirected', 'other']) {
    for (const r of results.filter(x => x.cls === cls)) {
      const extra = cls === 'redirected' ? ` -> ${pathOf(r.finalUrl)}` : '';
      lines.push(`  ${cls.padEnd(10)} ${r.status || 'ERR'} ${pathOf(r.url)}${extra}${r.error ? ' (' + r.error + ')' : ''}`);
    }
  }
  return { counts: c, lines };
}

async function main() {
  const stores = (process.env.STORES || 'www,es,fr,it,us').split(',').map(s => s.trim()).filter(Boolean);
  const kinds = (process.env.KINDS || 'pages,blogs,collections').split(',').map(s => s.trim()).filter(Boolean);
  const conc = Math.max(1, parseInt(process.env.CONCURRENCY, 10) || 2);
  const limit = Math.max(1, parseInt(process.env.LIMIT, 10) || 800);
  const { chromium } = require('playwright');
  const b = await chromium.launch();
  const bctx = await b.newContext({ userAgent: UA });
  fs.mkdirSync('sitemap-links', { recursive: true });
  let dead = 0, total = 0;
  for (const store of stores) {
    const base = `https://${store}.momuto.com`;
    let locs;
    try {
      let r = null;
      for (const w of [0, 8000, 25000, 60000]) { await sleep(w); r = await bctx.request.get(`${base}/sitemap.xml`, { timeout: 45000 }); if (r.status() !== 429 && r.status() < 500) break; }
      if (r.status() !== 200) throw new Error('sitemap http ' + r.status());
      locs = parseLocs(await r.text());
    } catch (e) {
      console.log(`✗ ${store}: could not read sitemap (${e.message})`);
      fs.writeFileSync(path.join('sitemap-links', `${store}.json`), JSON.stringify({ store, error: e.message }, null, 2));
      dead++;
      continue;
    }
    const picked = [...new Set(locs.filter(u => wanted(u, kinds)))];
    const urls = picked.slice(0, limit);
    const results = await pool(urls, conc, u => check(bctx.request, u));
    const { counts, lines } = summarize(store, results);
    if (picked.length > urls.length) lines[0] += ` (LIMIT: ${picked.length - urls.length} more not checked)`;
    console.log(lines.join('\n'));
    fs.writeFileSync(path.join('sitemap-links', `${store}.json`), JSON.stringify({ store, listed: locs.length, selected: picked.length, checked: urls.length, counts, results }, null, 2));
    dead += counts.dead; total += results.length;
  }
  await b.close();
  console.log(`TOTAL: ${total} URLs checked, ${dead} dead`);
  if (dead) process.exit(1);
}

module.exports = { parseLocs, wanted, classify, summarize, pathOf };
if (require.main === module) main().catch(e => { console.error('FAILED', e.message); process.exit(1); });
