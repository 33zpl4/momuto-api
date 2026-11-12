'use strict';
/**
 * index-audit.js — what does Google say about EVERY page we list in the sitemaps? Search Console URL Inspection API (quota 2,000/day/property),
 * for the /pages/ and /blogs/ URLs of each store (products are 3,000+ and mostly per-order previews: skip). Read only.
 * Prints per store: counts by Google coverage state; the pages that are not indexed with their state; every page where Google chose a
 * DIFFERENT canonical than we declare, and which one it chose (grouped, so one wrong target shows as one line). Writes index-audit/<store>.json.
 * Resumable per store: STORES=fr,it,us. Env: GSC_SERVICE_ACCOUNT, GSC_SITE (default sc-domain:momuto.com), STORES=www,es,fr,it,us, LIMIT (per store, default 700), KINDS="pages,blogs"
 */
const crypto = require('crypto'); const fs = require('fs');
const { chromium } = require('playwright');
const b64u = b => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const STORES = (process.env.STORES || 'www,es,fr,it,us').split(',').map(s => s.trim());
const LIMIT = +(process.env.LIMIT || 700), KINDS = (process.env.KINDS || 'pages,blogs').split(',').map(s => s.trim());
async function token(sa) {
  const now = Math.floor(Date.now() / 1000), h = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const c = b64u(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: 'https://oauth2.googleapis.com/token', exp: now + 3300, iat: now }));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${h}.${c}.${b64u(crypto.sign('RSA-SHA256', Buffer.from(`${h}.${c}`), sa.private_key))}` });
  const j = await r.json(); if (!j.access_token) throw new Error('token ' + JSON.stringify(j).slice(0, 160)); return j.access_token;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  if (!process.env.GSC_SERVICE_ACCOUNT) throw new Error('GSC_SERVICE_ACCOUNT not set');
  const site = process.env.GSC_SITE || 'sc-domain:momuto.com', sa = JSON.parse(process.env.GSC_SERVICE_ACCOUNT);
  let tk = await token(sa), tkAt = Date.now();   // tokens live 55 min; the audit runs longer, so refresh every 40 min and on a 401
  const browser = await chromium.launch(); const ctx = await browser.newContext({ locale: 'en-US' });
  fs.mkdirSync('index-audit', { recursive: true });
  let total = 0;
  for (const st of STORES) {
    const host = `https://${st}.momuto.com`;
    const r = await ctx.request.get(`${host}/sitemap.xml`, { timeout: 60000 });
    const urls = [...(await r.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]).filter(u => KINDS.some(k => u.startsWith(`${host}/${k}/`)) || u === host + '/').slice(0, LIMIT);
    console.log(`\n=== ${st}: ${urls.length} URLs from the sitemap (${KINDS.join('+')})`);
    const rows = []; let n = 0;
    for (const url of urls) {
      let j = null;
      for (let a = 0; a < 3; a++) {
        if (Date.now() - tkAt > 40 * 60000) { tk = await token(sa); tkAt = Date.now(); }
        const x = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', { method: 'POST', headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ inspectionUrl: url, siteUrl: site, languageCode: 'en-US' }) });
        if (x.status === 401) { tk = await token(sa); tkAt = Date.now(); continue; }
        if (x.status === 429 || x.status >= 500) { await sleep(3000 * (a + 1)); continue; }
        j = await x.json(); if (!x.ok) j = { error: (j.error && j.error.message) || x.status }; break;
      }
      const i = ((j && j.inspectionResult) || {}).indexStatusResult || {};
      rows.push({ url, verdict: i.verdict || 'ERR', state: i.coverageState || (j && j.error) || '?', last: (i.lastCrawlTime || '').slice(0, 10), userCanonical: i.userCanonical || '', googleCanonical: i.googleCanonical || '', sitemap: (i.sitemap || []).length });
      n++; total++; await sleep(120);
    }
    fs.writeFileSync(`index-audit/${st}.json`, JSON.stringify(rows, null, 1));
    const by = {}; rows.forEach(r => { by[r.state] = (by[r.state] || 0) + 1; });
    console.log('  coverage: ' + Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} × ${k}`).join(' | '));
    const norm = u => String(u || '').replace(/\/$/, '');
    const wrong = rows.filter(r => r.googleCanonical && norm(r.googleCanonical) !== norm(r.userCanonical || r.url));
    const byTarget = {}; wrong.forEach(r => { (byTarget[r.googleCanonical] = byTarget[r.googleCanonical] || []).push(r.url); });
    console.log(`  Google chose a DIFFERENT canonical on ${wrong.length} page(s):`);
    Object.entries(byTarget).sort((a, b) => b[1].length - a[1].length).slice(0, 12).forEach(([t, us]) => console.log(`    → ${t.replace(/^https:\/\//, '')}  ← ${us.length}: ${us.slice(0, 4).map(u => u.replace(host, '')).join(' , ')}${us.length > 4 ? ' …' : ''}`));
    const notIdx = rows.filter(r => r.verdict !== 'PASS' && !wrong.includes(r));
    console.log(`  not indexed (other reasons): ${notIdx.length}`);
    notIdx.slice(0, 40).forEach(r => console.log(`    ${r.state} | last ${r.last || 'never'} | ${r.url.replace(host, '')}`));
  }
  console.log(`\ninspected ${total} URLs`);
  await browser.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
