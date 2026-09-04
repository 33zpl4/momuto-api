'use strict';

/**
 * Builds the "jersey maker" landing page (US: Soccer Jersey Maker, EN:
 * Football Jersey Maker) from maker/maker.<locale>.json into the pulled CMS
 * page object cms/pages/<locale>/<handle>.json — same pattern as the FAQ /
 * shipping / returns generators; Deploy CMS Page (changed_since) ships it.
 *
 * Why: GSC (Jun–Sep 2026) shows the maker/creator/designer cluster is where
 * the volume is ("jersey maker" 12k impr, "football jersey maker" 4.9k,
 * "soccer jersey maker" pos 23, "custom soccer jersey maker" pos 28…) and
 * no page on either store carried "Jersey Maker" in its title. The handle
 * custom-soccer-jersey-designer was a broken template scaffold on both
 * stores ("Discover MOMUTO", placeholder CSS href) — reused, not created.
 *
 * Usage: node scripts/build-maker-pages.js [us,en]
 */

const fs = require('fs');
const path = require('path');
const CSS = require('./lib/estate-css.js');

const ROOT = path.resolve(__dirname, '..');
const LOCALES = (process.argv[2] || 'us,en').split(',').map(s => s.trim()).filter(Boolean);

const esc = (s) => String(s).replace(/&(?![a-z#0-9]+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const strip = (h) => String(h).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/\s+/g, ' ').trim();
const amp = (u) => u.replace(/&(?!amp;)/g, '&amp;');

const EXTRA_CSS = `
.hero .ctas{display:flex;gap:.8rem;justify-content:center;flex-wrap:wrap;margin-top:1.8rem}
.grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}
.card{background:rgba(255,255,255,.03);border:1px solid var(--border);padding:22px 24px}
.card h3{font-size:1.35rem;margin:0 0 .5rem;color:var(--white)}
.card p{font-size:.9rem;color:var(--muted);line-height:1.6;margin:0}
.card .go{display:inline-block;margin-top:.9rem;font-size:.78rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--white);text-decoration:none;border-bottom:1px solid var(--red)}
.card .go:hover{color:var(--red)}
.syn{max-width:820px;font-size:1rem;color:var(--muted);line-height:1.7}
.syn b{color:var(--white);font-weight:600}
.syn a{color:var(--white);border-bottom:1px solid var(--red);text-decoration:none}
ol.steps{list-style:none !important;margin:0 !important;padding:0 !important;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;counter-reset:s}
ol.steps > li{list-style:none !important;background:rgba(255,255,255,.03);border:1px solid var(--border);padding:20px 22px;font-size:.88rem;color:var(--muted);line-height:1.6}
ol.steps > li::marker{content:none}
ol.steps > li .n{font-family:var(--fd);font-size:2rem;color:var(--red);line-height:1;display:block;margin-bottom:.4rem}
ol.steps > li strong{color:var(--white);font-weight:600;display:block;margin-bottom:.3rem;font-size:1rem}
.plink{margin-top:1.2rem;font-size:.88rem}
.plink a{color:var(--white);border-bottom:1px solid var(--red);text-decoration:none}
`;

function jsonld(d) {
  const url = `${d.base}/pages/${d.handle}`;
  const web = {
    '@context': 'https://schema.org', '@type': 'WebPage', name: d.meta.title, description: d.meta.meta_descript, url, inLanguage: d.lang,
    breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: d.base },
      { '@type': 'ListItem', position: 2, name: strip(d.hero.h1), item: url },
    ] },
  };
  const app = {
    '@context': 'https://schema.org', '@type': 'WebApplication', name: `MOMUTO 3D ${strip(d.hero.h1)}`, url: 'https://design.momuto.com/3d-configurator/configurator.html',
    applicationCategory: 'DesignApplication', operatingSystem: 'Web browser', browserRequirements: 'Requires JavaScript', isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: d.currency },
    description: strip(d.hero.sub), publisher: { '@type': 'Organization', name: 'MOMUTO', url: d.base },
  };
  const single = strip(d.pricing.rows[0][1]).replace(/[^\d.]/g, '');
  const product = {
    '@context': 'https://schema.org', '@type': 'Product', name: strip(d.pricing.title).replace(/^What a |costs$/g, '').trim(),
    description: d.meta.meta_descript, brand: { '@type': 'Brand', name: 'MOMUTO' },
    offers: { '@type': 'AggregateOffer', priceCurrency: d.currency, lowPrice: strip(d.pricing.rows[d.pricing.rows.length - 1][1]).replace(/[^\d.]/g, ''), highPrice: single, offerCount: d.pricing.rows.length, availability: 'https://schema.org/InStock', url },
  };
  const faq = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: d.faq.items.map(([q, a]) => ({ '@type': 'Question', name: strip(q), acceptedAnswer: { '@type': 'Answer', text: strip(a) } })),
  };
  return [web, app, product, faq].map(o => `<script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n</script>`).join('\n');
}

function render(d) {
  const quick = d.quick.map(([k, l]) => `<div class="q"><div class="k">${esc(k)}</div><div class="l">${esc(l)}</div></div>`).join('');
  const feats = d.features.items.map(([h, p]) => `<div class="card"><h3>${h}</h3><p>${p}</p></div>`).join('\n');
  const ways = d.ways.items.map(([h, p, u, l]) => `<div class="card"><h3>${esc(h)}</h3><p>${p}</p><a class="go" href="${amp(u)}">${esc(l)} &rarr;</a></div>`).join('\n');
  const rows = d.pricing.rows.map((r, i) => `<tr${i === d.pricing.pop ? ' class="pop"' : ''}>${r.map((c, j) => `<td>${c}${i === d.pricing.pop && j === 0 ? '<span class="pill">Most popular</span>' : ''}</td>`).join('')}</tr>`).join('\n');
  const notes = d.pricing.notes.map(n => `<li><span class="ck">&check;</span><span>${n}</span></li>`).join('\n');
  const steps = d.steps.items.map(([h, p], i) => `<li><span class="n">${i + 1}</span><strong>${esc(h)}</strong>${p}</li>`).join('\n');
  const faq = d.faq.items.map(([q, a]) => `<details><summary>${esc(q)}</summary><div class="a">${a}</div></details>`).join('\n');
  const more = d.more.links.map(([u, t]) => `<a href="${u}">${t}</a>`).join(' &middot; ');
  return `${jsonld(d)}
<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" /><link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&amp;family=Outfit:wght@300;400;500;600;700;800&amp;display=swap" rel="stylesheet" />
<style>${CSS}${EXTRA_CSS}</style>
<div class="faqpage">
<section class="hero">
<div class="badge">${esc(d.hero.label)}</div>
<h1 class="h1">${d.hero.h1}</h1>
<p class="sub">${d.hero.sub}</p>
<div class="ctas"><a href="${amp(d.hero.btn_url)}" class="btn">${esc(d.hero.btn)}</a><a href="${amp(d.hero.btn2_url)}" class="btn2">${esc(d.hero.btn2)}</a></div>
<div class="quick">${quick}</div>
</section>

<section class="sec" id="features">
<div class="wrap">
<h2>${esc(d.features.title)}</h2>
<p class="lead">${d.features.lead}</p>
<div class="grid3">
${feats}
</div>
</div>
</section>

<section class="sec alt" id="tool">
<div class="wrap">
<h2>${esc(d.synonyms.title)}</h2>
<p class="syn">${d.synonyms.body}</p>
</div>
</section>

<section class="sec" id="start">
<div class="wrap">
<h2>${esc(d.ways.title)}</h2>
<div class="grid3">
${ways}
</div>
</div>
</section>

<section class="sec alt" id="pricing">
<div class="wrap">
<h2>${esc(d.pricing.title)}</h2>
<p class="lead">${d.pricing.lead}</p>
<div class="tablewrap"><table class="ladder">
<thead><tr>${d.pricing.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
<tbody>
${rows}
</tbody></table></div>
<ul class="notes">
${notes}
</ul>
<p class="plink"><a href="${d.pricing.more}">${esc(d.pricing.more_label)} &rarr;</a></p>
</div>
</section>

<section class="sec" id="how">
<div class="wrap">
<h2>${esc(d.steps.title)}</h2>
<ol class="steps">
${steps}
</ol>
</div>
</section>

<section class="sec alt" id="questions">
<div class="wrap">
<h2>${esc(d.faq.title)}</h2>
<div class="faq">
${faq}
</div>
</div>
</section>

<section class="cta-end">
<h2>${esc(d.cta.h2)}</h2>
<p>${d.cta.p}</p>
<a href="${amp(d.cta.btn_url)}" class="btn">${esc(d.cta.btn)}</a>
<a href="${amp(d.cta.btn2_url)}" class="btn2">${esc(d.cta.btn2)}</a>
</section>
<div class="more">${esc(d.more.label)} ${more}</div>
</div>
`;
}

function sanity(d, html) {
  if (!html.includes('Bebas Neue') || !html.includes('Outfit')) throw new Error(`${d.locale}: fonts`);
  if ((html.match(/<h1\b/g) || []).length !== 1) throw new Error(`${d.locale}: h1 count`);
  for (const blk of html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || []) JSON.parse(blk.replace(/<\/?script[^>]*>/g, ''));
  if (d.meta.meta_title.length > 65) throw new Error(`${d.locale}: meta_title ${d.meta.meta_title.length}/65`);
  if (d.meta.meta_descript.length > 160) throw new Error(`${d.locale}: meta_descript ${d.meta.meta_descript.length}/160`);
  if (!Array.isArray(d.meta.keywords)) throw new Error(`${d.locale}: keywords must be an array`);
  const prose = html.replace(/href="[^"]*"/g, '').replace(/"item": "[^"]*"|"url": "[^"]*"/g, '');
  if (d.locale === 'us' && /€|&euro;|\bEUR\b|\bfootball\b|colour|\bshirt/i.test(prose)) throw new Error('us: contains €/EUR/football/shirt/British spelling');
  if (!html.includes('design.momuto.com/3d-configurator/configurator.html')) throw new Error(`${d.locale}: missing 3D designer deep link`);
  const h1 = strip(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1]).toLowerCase();
  if (!/jersey maker/.test(h1)) throw new Error(`${d.locale}: h1 must carry "jersey maker"`);
  if (!/jersey maker/i.test(d.meta.meta_title)) throw new Error(`${d.locale}: meta_title must carry "jersey maker"`);
  if (/path-to-your|Discover MOMUTO|Shop Now/.test(html)) throw new Error(`${d.locale}: template scaffold leaked`);
  if (/\b30 ?(€|\$)|(€|\$) ?30(?![.,]\d)\b/.test(strip(html))) throw new Error(`${d.locale}: stale €30 deposit`);
}

for (const locale of LOCALES) {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'maker', `maker.${locale}.json`), 'utf8'));
  const html = render(d);
  sanity(d, html);
  fs.mkdirSync(path.join(ROOT, 'pages', 'maker'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'pages', 'maker', `${locale}.html`), html);
  const cmsFile = path.join(ROOT, 'cms', 'pages', locale, `${d.handle}.json`);
  if (!fs.existsSync(cmsFile)) { console.warn(`⚠️  ${locale}: no pulled page at cms/pages/${locale}/${d.handle}.json — preview only (pull it first)`); continue; }
  const page = JSON.parse(fs.readFileSync(cmsFile, 'utf8'));
  Object.assign(page, { content: html, title: d.meta.title, meta_title: d.meta.meta_title, meta_descript: d.meta.meta_descript, meta_keywords: d.meta.keywords });
  fs.writeFileSync(cmsFile, JSON.stringify(page, null, 2) + '\n');
  console.log(`✅ ${locale}: ${html.length} chars → cms/pages/${locale}/${d.handle}.json (id ${page.id})`);
}
