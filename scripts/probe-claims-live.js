'use strict';
// Read the LIVE pages and report the claims they carry: team counts, Trustpilot counts (visible text and JSON-LD reviewCount). Read only.
const { chromium } = require('playwright');
const URLS = (process.env.URLS || ['https://www.momuto.com/pages/teams-clubs-momuto', 'https://us.momuto.com/pages/teams-clubs-momuto', 'https://es.momuto.com/pages/equipos-momuto', 'https://fr.momuto.com/pages/equipes-clubs-momuto', 'https://it.momuto.com/pages/squadre-club-momuto',
  'https://www.momuto.com/pages/custom-soccer-jerseys', 'https://www.momuto.com/pages/design-your-own-soccer-jersey', 'https://www.momuto.com/pages/faq', 'https://us.momuto.com/pages/custom-soccer-jerseys', 'https://www.momuto.com/', 'https://www.momuto.com/llms.txt'].join(',')).split(',');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ locale: 'en-US' }); let bad = 0;
  for (const url of URLS) {
    const r = await ctx.request.get(url, { timeout: 45000 }); const html = await r.text();
    const text = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const old250 = (html.match(/250\+|(?:más de|plus de|più di|oltre|over) 250\b/gi) || []).length, new300 = (html.match(/300\+|(?:más de|plus de|più di|oltre|over) 300\b/gi) || []).length;
    const rc = [...html.matchAll(/reviewCount\\?"\s*:\s*\\?"?(\d+)/g)].map(m => m[1]), txt = [...text.matchAll(/(\d{2,3}) (?:Trustpilot )?(?:reviews|reseñas|avis|recensioni)/gi)].map(m => m[1]);
    const stale = old250 > 0 || rc.some(x => x !== '57') || txt.some(x => ['51', '53'].includes(x));
    if (stale) bad++;
    console.log(`${stale ? '✗' : '✓'} http=${r.status()} ${url.replace('https://', '')}  300+:${new300} 250+:${old250} reviewCount:[${[...new Set(rc)].join(',')}] "N reviews" text:[${[...new Set(txt)].join(',')}]`);
  }
  await b.close(); if (bad) process.exit(1);
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
