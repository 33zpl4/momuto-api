'use strict';
/**
 * probe-speed-schema.js — two read-only checks that had never been run (docs/seo-opportunities-2026-09.md "owner-side checks"):
 *  1. Core Web Vitals via the PageSpeed Insights API: lab LCP/CLS/TBT and, when Google has it, the real-user (CrUX) LCP/CLS/INP, mobile + desktop.
 *  2. Structured data on live product pages: every JSON-LD block, and for Product the fields Google needs for review stars and merchant listings.
 * Env: URLS="https://...,https://..." (default list), PRODUCTS=4 (how many /products/ URLs to take from the www sitemap), PSI_KEY (optional)
 */
const { chromium } = require('playwright');
const URLS = (process.env.URLS || 'https://www.momuto.com/,https://www.momuto.com/pages/design-your-own-soccer-jersey,https://www.momuto.com/pages/custom-soccer-jerseys,https://us.momuto.com/,https://es.momuto.com/,https://design.momuto.com/3d-configurator/configurator.html').split(',').map(s => s.trim()).filter(Boolean);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function psi(url, strategy) {
  const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance${process.env.PSI_KEY ? '&key=' + process.env.PSI_KEY : ''}`;
  for (let i = 0; i < 4; i++) {
    const r = await fetch(api); const j = await r.json();
    if (r.ok) {
      const a = j.lighthouseResult.audits, f = (j.loadingExperience || {}).metrics || {}, o = (j.originLoadingExperience || {}).metrics || {};
      const field = m => (m ? `${m.percentile}${m.category ? ' ' + m.category[0] : ''}` : '-');
      return { perf: Math.round((j.lighthouseResult.categories.performance.score || 0) * 100), lcp: a['largest-contentful-paint'].displayValue, cls: a['cumulative-layout-shift'].displayValue, tbt: a['total-blocking-time'].displayValue, si: a['speed-index'].displayValue,
        pageLCP: field(f.LARGEST_CONTENTFUL_PAINT_MS), pageCLS: field(f.CUMULATIVE_LAYOUT_SHIFT_SCORE), pageINP: field(f.INTERACTION_TO_NEXT_PAINT),
        originLCP: field(o.LARGEST_CONTENTFUL_PAINT_MS), originCLS: field(o.CUMULATIVE_LAYOUT_SHIFT_SCORE), originINP: field(o.INTERACTION_TO_NEXT_PAINT), fieldVerdict: (j.originLoadingExperience || j.loadingExperience || {}).overall_category || '-' };
    }
    if (r.status === 429 || r.status >= 500) { await sleep(8000 * (i + 1)); continue; }
    return { error: `${r.status} ${(j.error && j.error.message || '').slice(0, 100)}` };
  }
  return { error: 'rate limited / unavailable after retries' };
}

function summariseLd(blocks) {
  const out = [];
  const walk = (n) => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) return n.forEach(walk); if (n['@graph']) walk(n['@graph']);
    const t = [].concat(n['@type'] || []); if (t.length) out.push(n); Object.values(n).forEach(v => { if (v && typeof v === 'object') walk(v); }); };
  blocks.forEach(walk);
  return out;
}

(async () => {
  console.log(`Speed + schema probe ${new Date().toISOString().slice(0, 16)}Z\n`);
  console.log('== PageSpeed Insights (lab score; "page"/"origin" = real users from CrUX when Google has data; p75 values, G/N/P = good/needs-improvement/poor)');
  for (const u of URLS) for (const s of ['mobile', 'desktop']) {
    const r = await psi(u, s);
    console.log(r.error ? `  ${s.padEnd(7)} ${u}\n          ERROR ${r.error}` : `  ${s.padEnd(7)} ${u}\n          perf=${r.perf}  lab: LCP ${r.lcp} | CLS ${r.cls} | TBT ${r.tbt} | SI ${r.si}\n          real users page: LCP ${r.pageLCP}ms CLS ${r.pageCLS} INP ${r.pageINP}ms | origin: LCP ${r.originLCP}ms CLS ${r.originCLS} INP ${r.originINP}ms | origin verdict ${r.fieldVerdict}`);
    await sleep(1500);
  }

  console.log('\n== Structured data on live pages');
  const browser = await chromium.launch(); const ctx = await browser.newContext({ locale: 'en-US' });
  const sm = await ctx.newPage(); await sm.goto('https://www.momuto.com/sitemap.xml', { waitUntil: 'domcontentloaded' });
  const xml = await sm.content(); await sm.close();
  const products = [...xml.matchAll(/<loc>(https:\/\/www\.momuto\.com\/products\/[^<]+)<\/loc>/g)].map(m => m[1]);
  const pick = products.filter(p => !/custom-full-kit|preview/.test(p)).slice(0, +(process.env.PRODUCTS || 4)).concat(products.filter(p => /custom-full-kit/.test(p)).slice(0, 2));
  const pages = ['https://www.momuto.com/', 'https://www.momuto.com/pages/faq', ...pick];
  for (const url of pages) {
    const p = await ctx.newPage();
    try {
      await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }); await p.waitForTimeout(1500);
      const raw = await p.$$eval('script[type="application/ld+json"]', ss => ss.map(s => s.textContent));
      const blocks = []; let bad = 0; raw.forEach(t => { try { blocks.push(JSON.parse(t)); } catch (e) { bad++; } });
      const nodes = summariseLd(blocks), types = nodes.flatMap(n => [].concat(n['@type']));
      console.log(`  ${url}\n     blocks=${raw.length} unparsable=${bad} types=${[...new Set(types)].join(',') || '-'}`);
      for (const n of nodes.filter(n => [].concat(n['@type']).includes('Product'))) {
        const offer = [].concat(n.offers || [])[0] || {}; const ar = n.aggregateRating || {};
        const need = { name: !!n.name, image: !!n.image, description: !!n.description, 'offers.price': offer.price != null || offer.lowPrice != null, 'offers.priceCurrency': !!offer.priceCurrency, 'offers.availability': !!offer.availability, 'offers.priceValidUntil': !!offer.priceValidUntil, 'offers.shippingDetails': !!offer.shippingDetails, 'offers.hasMerchantReturnPolicy': !!offer.hasMerchantReturnPolicy, 'aggregateRating.ratingValue': ar.ratingValue != null, 'aggregateRating.reviewCount|ratingCount': (ar.reviewCount || ar.ratingCount) != null, review: !!n.review, brand: !!n.brand, sku_or_gtin: !!(n.sku || n.gtin || n.gtin13 || n.mpn) };
        console.log(`     Product "${String(n.name || '').slice(0, 50)}": ${Object.entries(need).map(([k, v]) => (v ? '✓' : '✗') + k).join(' ')}${ar.ratingValue != null ? `  rating=${ar.ratingValue}/${ar.reviewCount || ar.ratingCount}` : ''}`);
      }
    } catch (e) { console.log(`  ${url}\n     ERROR ${e.message.slice(0, 100)}`); }
    await p.close();
  }
  await browser.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
