'use strict';
// Read-only: which live pages still mention PayPal (text, icons, scripts)? Run by find-paypal.yml on a runner.
const STORES = ['https://www.momuto.com', 'https://us.momuto.com', 'https://es.momuto.com', 'https://fr.momuto.com', 'https://it.momuto.com', 'https://design.momuto.com'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(u) { try { const r = await fetch(u, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 momuto-audit' } }); return r.ok ? await r.text() : ''; } catch { return ''; } }
(async () => {
  let hits = 0;
  for (const base of STORES) {
    let urls = [base + '/', base + '/cart'];
    const sm = await get(base + '/sitemap.xml');
    const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    // sitemap index? follow child sitemaps
    let all = [];
    for (const l of locs) { if (/sitemap.*\.xml/i.test(l)) { const c = await get(l); all.push(...[...c.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])); } else all.push(l); }
    urls.push(...all.filter(u => /\/pages\//.test(u)), ...all.filter(u => /\/products\//.test(u)).slice(0, 4), ...all.filter(u => /\/collections\//.test(u)).slice(0, 3));
    urls = [...new Set(urls)];
    console.log(`\n### ${base}: scanning ${urls.length} URLs (sitemap had ${all.length})`);
    let i = 0;
    const worker = async () => { while (i < urls.length) { const u = urls[i++]; const h = await get(u); const ms = [...h.matchAll(/paypal/gi)]; if (ms.length) { hits++; const m = ms[0]; console.log(`  HIT ${u} x${ms.length}: ...${h.slice(Math.max(0, m.index - 140), m.index + 140).replace(/\s+/g, ' ')}...`); } await sleep(150); } };
    await Promise.all([1, 2, 3, 4].map(worker));
  }
  console.log(`\nDONE: ${hits} page(s) mention PayPal`);
})();
