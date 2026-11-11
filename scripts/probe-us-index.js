'use strict';
/**
 * probe-us-index.js — why does Google not serve us.momuto.com to US searchers? Read only, runs on a GitHub runner.
 * For each www page and its us twin it prints (a) Google's own verdict from the Search Console URL Inspection API
 * (index state, the canonical Google CHOSE vs the one we declare, last crawl) and (b) what the live HTML says:
 * canonical, hreflang link tags, robots meta, title, h1, and how similar the two bodies are (duplicate pressure).
 * Also reads the live robots.txt and sitemap hreflang rows for the pair. Writes nothing.
 * Env: GSC_SERVICE_ACCOUNT (secret), GSC_SITE (default sc-domain:momuto.com), PAIRS="/pages/x,/pages/y" (default list below); the live HTML is read with Playwright (plain fetch gets Cloudflare's 403)
 */
const crypto = require('crypto');
const { chromium } = require('playwright');
const b64u = b => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
async function token(sa) {
  const now = Math.floor(Date.now() / 1000), h = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const c = b64u(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: 'https://oauth2.googleapis.com/token', exp: now + 3300, iat: now }));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${h}.${c}.${b64u(crypto.sign('RSA-SHA256', Buffer.from(`${h}.${c}`), sa.private_key))}` });
  const j = await r.json(); if (!j.access_token) throw new Error('token ' + JSON.stringify(j).slice(0, 160)); return j.access_token;
}
const PATHS = (process.env.PAIRS || '/,/pages/design-your-own-soccer-jersey,/pages/custom-soccer-jersey-designer,/pages/jersey-maker,/pages/ready-to-play,/pages/custom-kit-gallery,/pages/request-custom-kit-design,/pages/best-custom-soccer-jersey-makers-2026,/pages/about-us').split(',').map(s => s.trim()).filter(Boolean);
const HOSTS = { www: 'https://www.momuto.com', us: 'https://us.momuto.com' };

async function inspect(tk, site, url) {
  const r = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', { method: 'POST', headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ inspectionUrl: url, siteUrl: site, languageCode: 'en-US' }) });
  const j = await r.json(); if (!r.ok) return { error: `${r.status} ${(j.error && j.error.message) || ''}`.slice(0, 120) };
  const i = (j.inspectionResult || {}).indexStatusResult || {};
  return { verdict: i.verdict, state: i.coverageState, robots: i.robotsTxtState, indexing: i.indexingState, fetched: i.pageFetchState, lastCrawl: (i.lastCrawlTime || '').slice(0, 10), userCanonical: i.userCanonical, googleCanonical: i.googleCanonical, sitemaps: (i.sitemap || []).length, referring: (i.referringUrls || []).length };
}
const strip = h => h.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
function shingles(t) { const w = t.split(' '), s = new Set(); for (let i = 0; i + 5 <= w.length; i++) s.add(w.slice(i, i + 5).join(' ')); return s; }
const jaccard = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; for (const x of a) if (b.has(x)) n++; return n / (a.size + b.size - n); };
let CTX = null;
async function live(url) {
  // Cloudflare answers plain fetch() from runners with a 403 challenge, so read the page with a real browser.
  try {
    const page = await CTX.newPage();
    const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1500);
    const h = await page.content(), status = r ? r.status() : 0, finalUrl = page.url();
    await page.close();
    const tag = re => (h.match(re) || [])[1] || '';
    const hreflangs = [...h.matchAll(/<link[^>]+rel=["']alternate["'][^>]*>/gi)].map(m => m[0]).filter(t => /hreflang/i.test(t)).map(t => `${(t.match(/hreflang=["']([^"']+)/i) || [])[1]}→${(t.match(/href=["']([^"']+)/i) || [])[1]}`);
    return { status, finalUrl, canonical: tag(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)/i) || tag(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical/i), robotsMeta: tag(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)/i), title: tag(/<title[^>]*>([^<]*)/i).trim().slice(0, 90), h1: strip(tag(/<h1[^>]*>([\s\S]*?)<\/h1>/i)).slice(0, 80), hreflangs, text: strip(h), bytes: h.length };
  } catch (e) { return { error: e.message.slice(0, 100) }; }
}

(async () => {
  const sa = process.env.GSC_SERVICE_ACCOUNT ? JSON.parse(process.env.GSC_SERVICE_ACCOUNT) : null;
  const site = process.env.GSC_SITE || 'sc-domain:momuto.com';
  const tk = sa ? await token(sa) : null;
  const browser = await chromium.launch(); CTX = await browser.newContext({ locale: 'en-US', viewport: { width: 1366, height: 900 } });
  console.log(`US indexing probe — ${new Date().toISOString().slice(0, 16)}Z  site=${site}  inspection=${tk ? 'on' : 'OFF (no secret)'}\n`);

  for (const h of Object.values(HOSTS)) {
    try { const t = await (await fetch(h + '/robots.txt')).text(); console.log(`robots.txt ${h}: ${t.split('\n').filter(l => /^(user-agent|disallow|sitemap)/i.test(l)).slice(0, 14).join(' | ').slice(0, 420)}`); } catch (e) { console.log('robots', h, e.message); }
  }
  console.log('');

  for (const p of PATHS) {
    console.log(`=== ${p}`);
    const res = {};
    for (const [k, base] of Object.entries(HOSTS)) {
      const url = base + p, L = await live(url), G = tk ? await inspect(tk, site, url) : null;
      res[k] = { L, G };
      console.log(`  [${k}] http=${L.status || L.error}${L.finalUrl && L.finalUrl !== url ? ' → ' + L.finalUrl : ''}  bytes=${L.bytes || '-'}`);
      console.log(`       title: ${L.title || '-'} | h1: ${L.h1 || '-'}`);
      console.log(`       canonical(declared): ${L.canonical || '(none)'}  robots-meta: ${L.robotsMeta || '-'}  hreflang-tags: ${L.hreflangs ? L.hreflangs.length : 0}${L.hreflangs && L.hreflangs.length ? ' ' + L.hreflangs.slice(0, 6).join(' ') : ''}`);
      if (G) console.log(G.error ? `       GOOGLE: ${G.error}` : `       GOOGLE: ${G.verdict} / ${G.state} / indexing=${G.indexing} fetch=${G.fetched} lastCrawl=${G.lastCrawl}\n       google-canonical: ${G.googleCanonical || '-'}   user-canonical: ${G.userCanonical || '-'}${G.googleCanonical && G.userCanonical && G.googleCanonical !== G.userCanonical ? '   ⚠ GOOGLE CHOSE A DIFFERENT CANONICAL' : ''}`);
    }
    if (res.www.L.text && res.us.L.text) console.log(`  → body similarity www↔us (5-word shingles, Jaccard): ${(jaccard(shingles(res.www.L.text), shingles(res.us.L.text)) * 100).toFixed(0)}%`);
    console.log('');
  }
  await browser.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
