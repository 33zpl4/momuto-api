'use strict';

/**
 * Builds the returns & exchanges page for every store from
 * policies/returns.<locale>.json into the pulled CMS page object
 * cms/pages/<locale>/<handle>.json (content, title, meta_*), the same way
 * build-faq-pages.js / build-shipping-pages.js do — Deploy CMS Page
 * (changed_since) ships it.
 *
 * Policy facts (must match faq/*.json "returns" section): custom goods →
 * returns only for manufacturing defects, transit damage, or a kit that
 * differs from the approved mockup; contact customer@momuto.com within 7 days
 * with photos; RMA before anything ships back; refund incl. return shipping
 * within 14 days of approval; full refund on cancellation before production
 * starts; no size exchanges; mockup gate + lifetime print guarantee.
 *
 * Usage: node scripts/build-returns-pages.js [en,es,fr,it,us]
 */

const fs = require('fs');
const path = require('path');
const CSS = require('./lib/estate-css.js');

const ROOT = path.resolve(__dirname, '..');
const LOCALES = (process.argv[2] || 'en,es,fr,it,us').split(',').map(s => s.trim()).filter(Boolean);

const esc = (s) => String(s).replace(/&(?![a-z#0-9]+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const strip = (h) => String(h).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/\s+/g, ' ').trim();

const EXTRA_CSS = `
ul.timeline{list-style:none !important;margin:0 !important;padding:0 !important;max-width:820px}
ul.timeline > li{display:flex !important;list-style:none !important;gap:1.2rem;align-items:flex-start;padding:1.1rem 0;border-bottom:1px solid var(--border);font-size:.92rem;color:var(--muted);line-height:1.6}
ul.timeline > li::marker{content:none}
ul.timeline > li .d{font-family:var(--fd);font-size:1.35rem;color:var(--red);min-width:132px;line-height:1.15;flex-shrink:0}
ul.timeline > li strong{color:var(--white);font-weight:600}
table.ladder td .sub{display:block;font-size:.78rem;color:var(--dim);font-weight:300}
table.ladder td b{color:var(--white);font-weight:600}
table.ladder td a{color:var(--white);border-bottom:1px solid var(--red);text-decoration:none}
.cancel{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;max-width:1060px}
.cancel .c{background:rgba(255,255,255,.03);border:1px solid var(--border);padding:20px 22px}
.cancel .c h3{font-size:1.3rem;margin:0 0 .5rem;color:var(--white)}
.cancel .c p{font-size:.88rem;color:var(--muted);line-height:1.6;margin:0}
.cancel .c b{color:#e5e5e5;font-weight:600}
.cancel .c a{color:var(--white);border-bottom:1px solid var(--red);text-decoration:none}
.faq h3{font-size:1.4rem;margin:0 0 .6rem}
@media(max-width:600px){ul.timeline > li{flex-direction:column;gap:.3rem}}
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
  const policy = {
    '@context': 'https://schema.org', '@type': 'MerchantReturnPolicy', name: strip(d.hero.h1), url,
    applicableCountry: d.locale === 'us' ? 'US' : ['ES', 'FR', 'IT', 'GB', 'DE', 'PT', 'NL', 'BE', 'IE', 'AT'],
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: 7,
    returnMethod: 'https://schema.org/ReturnByMail',
    returnFees: 'https://schema.org/FreeReturn',
    refundType: ['https://schema.org/FullRefund', 'https://schema.org/ExchangeRefund'],
    itemCondition: 'https://schema.org/DamagedCondition',
    customerRemorseReturnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
    description: strip(d.hero.sub),
  };
  const faq = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: d.faq.items.map(([q, a]) => ({ '@type': 'Question', name: strip(q), acceptedAnswer: { '@type': 'Answer', text: strip(a) } })),
  };
  return [web, policy, faq].map(o => `<script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n</script>`).join('\n');
}

function render(d) {
  const quick = d.quick.map(([k, l]) => `<div class="q"><div class="k">${esc(k)}</div><div class="l">${esc(l)}</div></div>`).join('');
  const rows = d.covered.rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('\n');
  const notes = d.covered.notes.map(n => `<li><span class="ck">&check;</span><span>${n}</span></li>`).join('\n');
  const steps = d.process.steps.map(([when, body]) => `<li><span class="d">${esc(when)}</span><span>${body}</span></li>`).join('\n');
  const cancel = d.cancel.items.map(([h, p]) => `<div class="c"><h3>${esc(h)}</h3><p>${p}</p></div>`).join('\n');
  const faq = d.faq.items.map(([q, a]) => `<details><summary>${esc(q)}</summary><div class="a">${a}</div></details>`).join('\n');
  const more = d.more.links.map(([u, t]) => `<a href="${u}">${esc(t)}</a>`).join(' &middot; ');
  return `${jsonld(d)}
<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" /><link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&amp;family=Outfit:wght@300;400;500;600;700;800&amp;display=swap" rel="stylesheet" />
<style>${CSS}${EXTRA_CSS}</style>
<div class="faqpage">
<section class="hero">
<div class="badge">${esc(d.hero.label)}</div>
<h1 class="h1">${d.hero.h1}</h1>
<p class="sub">${d.hero.sub}</p>
<div class="quick">${quick}</div>
</section>

<section class="sec" id="covered">
<div class="wrap">
<h2>${esc(d.covered.title)}</h2>
<p class="lead">${d.covered.lead}</p>
<div class="tablewrap"><table class="ladder">
<thead><tr>${d.covered.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
<tbody>
${rows}
</tbody></table></div>
<ul class="notes">
${notes}
</ul>
</div>
</section>

<section class="sec alt" id="process">
<div class="wrap">
<h2>${esc(d.process.title)}</h2>
<p class="lead">${d.process.lead}</p>
<ul class="timeline">
${steps}
</ul>
</div>
</section>

<section class="sec" id="cancellations">
<div class="wrap">
<h2>${esc(d.cancel.title)}</h2>
<p class="lead">${d.cancel.lead}</p>
<div class="cancel">
${cancel}
</div>
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
<a href="${d.cta.btn_url}" class="btn">${esc(d.cta.btn)}</a>
<a href="${d.cta.btn2_url.replace(/&(?!amp;)/g, '&amp;')}" class="btn2">${esc(d.cta.btn2)}</a>
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
  if (d.locale === 'us' && /€|&euro;|\bEUR\b|\bfootball\b|colour|prioritise|Authorisation|customised/i.test(prose)) throw new Error('us: contains €/EUR/football/British spelling');
  if (!html.includes('design.momuto.com/3d-configurator/configurator.html')) throw new Error(`${d.locale}: missing 3D designer deep link`);
  if (!/customer@momuto\.com/.test(html)) throw new Error(`${d.locale}: missing customer@momuto.com`);
  // The policy facts every locale must carry.
  if (!/\b7\b/.test(strip(html)) || !/\b14\b/.test(strip(html))) throw new Error(`${d.locale}: 7-day / 14-day facts missing`);
  if (/14 days after the receipt|unused and in the same condition|within a certain amount of days/.test(html)) throw new Error(`${d.locale}: stale generic-theme copy`);
  if (/\b30 ?(€|\$)|(€|\$) ?30\b/.test(strip(html))) throw new Error(`${d.locale}: stale €30 deposit`);
}

for (const locale of LOCALES) {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'policies', `returns.${locale}.json`), 'utf8'));
  const html = render(d);
  sanity(d, html);
  fs.mkdirSync(path.join(ROOT, 'pages', 'returns'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'pages', 'returns', `${locale}.html`), html);
  const cmsFile = path.join(ROOT, 'cms', 'pages', locale, `${d.handle}.json`);
  if (!fs.existsSync(cmsFile)) { console.warn(`⚠️  ${locale}: no pulled page at cms/pages/${locale}/${d.handle}.json — preview only (pull it first)`); continue; }
  const page = JSON.parse(fs.readFileSync(cmsFile, 'utf8'));
  Object.assign(page, { content: html, title: d.meta.title, meta_title: d.meta.meta_title, meta_descript: d.meta.meta_descript, meta_keywords: d.meta.keywords });
  fs.writeFileSync(cmsFile, JSON.stringify(page, null, 2) + '\n');
  console.log(`✅ ${locale}: ${html.length} chars → cms/pages/${locale}/${d.handle}.json (id ${page.id})`);
}
