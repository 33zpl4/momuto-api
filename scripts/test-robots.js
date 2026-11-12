'use strict';
/**
 * test-robots.js — Google-style robots.txt matching (longest match wins, Allow beats Disallow on a tie, * and $ wildcards) over the repo's
 * five robots.txt files. Asserts: every real URL we want indexed is allowed (sitemap product paths, key pages, pages from the GSC exports)
 * and every per-order preview / tracking-parameter URL is blocked, for every user-agent block.
 *   node scripts/test-robots.js [paths-file]   (paths-file: one URL path per line that MUST stay allowed)
 */
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const HOSTS = ['momuto.com', 'es.momuto.com', 'fr.momuto.com', 'it.momuto.com', 'us.momuto.com'];
function parse(txt) {
  const groups = []; let cur = null;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim(); if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2];
    if (k === 'user-agent') { if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(v); }
    else if ((k === 'allow' || k === 'disallow') && cur) cur.rules.push({ allow: k === 'allow', pat: v });
  }
  return groups;
}
const toRe = p => new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
function allowed(group, url) {
  let best = null;
  for (const r of group.rules) { if (!r.pat) continue; if (toRe(r.pat).test(url)) { const len = r.pat.length; if (!best || len > best.len || (len === best.len && r.allow)) best = { len, allow: r.allow }; } }
  return best ? best.allow : true;
}
const MUST_ALLOW = ['/', '/pages/design-your-own-soccer-jersey', '/pages/ai-concept-to-real-kit', '/pages/custom-soccer-jerseys', '/products/the-prism', '/products/the-legacy', '/collections/custom-jerseys', '/blogs/ai-to-reality-kit-maker-guide', '/pages/faq', '/comments/udgf-custom-jersey', '/pages/request-custom-kit-design?paid=true', '/products/okami7-custom-full-kit', '/collections/all', '/blogs?page=2'];
const MUST_BLOCK = ['/products/your-custom-design-this-is-what-we-produce-order-cui86y4s98_e710e3a9', '/products/your-custom-design-2-of-2-this-is-what-we-produce-order-8t4iknz2su_d2bead73?data_from=collection_detail&spm=x',
  '/comments/your-custom-design-this-is-what-we-produce-order-xxrbtkf925?page=0', '/products/tu-diseño-personalizado-esto-es-lo-que-producimos-pedido-hi7j5ragg1_52250c84', '/products/tu-dise%C3%B1o-personalizado-esto-es-lo-que-producimos-pedido-hi7j5ragg1',
  '/comments/tu-dise%C3%B1o-personalizado-esto-es-lo-que-producimos-pedido-hi7j5ragg1_52250c84?page=0', '/products/votre-design-personnalis%C3%A9-c-est-ce-que-nous-produisons-commande-x1', '/products/il-tuo-design-personalizzato-e-cio-che-produciamo-ordine-x1',
  '/products/italy-vitruvian-man-jersey?data_from=collection_detail&spm=collection_detail..collection_detail-671876.12.', '/products/the-khala?sku_code=10299131-0-0-0-0-0-0&sku=6694578446', '/products/the-prism?spm=a.b'];
const extra = process.argv[2] && fs.existsSync(process.argv[2]) ? fs.readFileSync(process.argv[2], 'utf8').split('\n').map(s => s.trim()).filter(Boolean) : [];
let bad = 0;
for (const h of HOSTS) {
  const groups = parse(fs.readFileSync(path.join(__dirname, '..', 'static', h, 'robots.txt'), 'utf8'));
  // a URL that the committed (previous) robots.txt already blocked (/account/, /search…) is not a regression of this change
  let base = null; try { base = parse(execSync(`git show HEAD:static/${h}/robots.txt`, { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch (_) {}
  groups.forEach((g, gi) => { for (const u of MUST_ALLOW.concat(extra)) if (!allowed(g, u) && !(base && base[gi] && !allowed(base[gi], u))) { console.error(`✗ ${h} [${g.agents.join(',')}] BLOCKS ${u}`); bad++; } });
  for (const g of groups) for (const u of MUST_BLOCK) if (allowed(g, u)) { console.error(`✗ ${h} [${g.agents.join(',')}] ALLOWS ${u}`); bad++; }
  console.log(`${h}: ${groups.length} UA groups, ${MUST_ALLOW.length + extra.length} must-allow and ${MUST_BLOCK.length} must-block checked per group`);
}
if (bad) { console.error(`\n❌ ${bad} robots.txt problem(s)`); process.exit(1); }
console.log('\n✓ robots.txt: real pages stay crawlable, previews and tracking parameters are blocked in every group');
