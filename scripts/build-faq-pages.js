'use strict';

/**
 * Builds the FAQ page for every store from faq/faq.<locale>.json and writes it
 * INTO the pulled CMS page object cms/pages/<locale>/<handle>.json (content,
 * title, meta_*), so `Deploy CMS Page` (changed_since / push) ships it. A
 * readable copy lands in pages/faq/<locale>.html for review.
 *
 * Why data + template: five stores, one visual system (the product-page FAQ
 * look: dark, Bebas/Outfit, accordion), five sets of numbers. The numbers
 * live in the JSON, the HTML lives here — nobody hand-edits five pages.
 *
 * Every question is emitted twice: as an accordion for people and as
 * FAQPage JSON-LD for search engines and LLMs. The pricing ladder is a real
 * <table> with an #pricing anchor (the "I couldn't find prices" fix).
 *
 * Usage: node scripts/build-faq-pages.js [en,es,fr,it,us]
 * Sanity checks mirror deploy-us-pages.js (fonts, one h1, JSON-LD parses,
 * meta lengths, no € on the US store).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LOCALES = (process.argv[2] || 'en,es,fr,it,us').split(',').map(s => s.trim()).filter(Boolean);

const esc = (s) => String(s).replace(/&(?![a-z#0-9]+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const strip = (h) => String(h).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/\s+/g, ' ').trim();

function jsonld(d) {
  const url = `${d.base}/pages/${d.handle}`;
  const web = {
    '@context': 'https://schema.org', '@type': 'WebPage', name: d.meta.title, description: d.meta.meta_descript, url, inLanguage: d.lang,
    breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: d.base },
      { '@type': 'ListItem', position: 2, name: strip(d.hero.h1), item: url },
    ] },
  };
  const faq = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: d.sections.flatMap(s => s.items.map(([q, a]) => ({
      '@type': 'Question', name: strip(q), acceptedAnswer: { '@type': 'Answer', text: strip(a) },
    }))),
  };
  return [web, faq].map(o => `<script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n</script>`).join('\n');
}

const CSS = require('./lib/estate-css.js');

function render(d) {
  const nav = [{ id: d.pricing.id, title: d.pricing.title }, ...d.sections.map(s => ({ id: s.id, title: s.title }))]
    .map(s => `<li><a href="#${s.id}">${esc(s.title)}</a></li>`).join('');
  const quick = d.quick.map(([k, l]) => `<div class="q"><div class="k">${esc(k)}</div><div class="l">${esc(l)}</div></div>`).join('');
  const rows = d.pricing.rows.map(r => {
    const pop = r[4] === true;
    const cells = r.slice(0, 4).map((c, i) => `<td>${esc(c)}${pop && i === 0 ? `<span class="pill">${esc(d.pricing.popular)}</span>` : ''}</td>`).join('');
    return `<tr${pop ? ' class="pop"' : ''}>${cells}</tr>`;
  }).join('\n');
  const notes = d.pricing.notes.map(n => `<li><span class="ck">&check;</span><span>${n}</span></li>`).join('\n');
  const sections = d.sections.map((s, i) => `
<section class="sec${i % 2 ? ' alt' : ''}" id="${s.id}">
<div class="wrap">
<h2>${esc(s.title)}</h2>
<div class="faq">
${s.items.map(([q, a]) => `<details><summary>${esc(q)}</summary><div class="a">${a}</div></details>`).join('\n')}
</div>
</div>
</section>`).join('\n');
  const more = d.more.links.map(([u, t]) => `<a href="${u}">${esc(t)}</a>`).join(' &middot; ');

  return `${jsonld(d)}
<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" /><link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&amp;family=Outfit:wght@300;400;500;600;700;800&amp;display=swap" rel="stylesheet" />
<style>${CSS}</style>
<div class="faqpage">
<section class="hero">
<div class="badge">${esc(d.hero.label)}</div>
<h1 class="h1">${d.hero.h1}</h1>
<p class="sub">${d.hero.sub}</p>
<div class="quick">${quick}</div>
</section>
<nav class="faqnav"><ul>${nav}</ul></nav>

<section class="sec" id="${d.pricing.id}">
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
</div>
</section>
${sections}

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
  // URLs may carry legacy handles (…-football-kit-…); the lexicon rule is for prose only.
  const prose = html.replace(/href="[^"]*"/g, '').replace(/"item": "[^"]*"|"url": "[^"]*"/g, '');
  if (d.locale === 'us' && /€|\bEUR\b|\bfootball\b/i.test(prose)) throw new Error('us: contains €/EUR/football');
  if (!html.includes('design.momuto.com/3d-configurator/configurator.html')) throw new Error(`${d.locale}: missing 3D designer deep link`);
}

for (const locale of LOCALES) {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'faq', `faq.${locale}.json`), 'utf8'));
  const html = render(d);
  sanity(d, html);
  fs.mkdirSync(path.join(ROOT, 'pages', 'faq'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'pages', 'faq', `${locale}.html`), html);
  const cmsFile = path.join(ROOT, 'cms', 'pages', locale, `${d.handle}.json`);
  if (!fs.existsSync(cmsFile)) { console.warn(`⚠️  ${locale}: no pulled page at cms/pages/${locale}/${d.handle}.json — preview only (pull it first)`); continue; }
  const page = JSON.parse(fs.readFileSync(cmsFile, 'utf8'));
  Object.assign(page, { content: html, title: d.meta.title, meta_title: d.meta.meta_title, meta_descript: d.meta.meta_descript, meta_keywords: d.meta.keywords });
  fs.writeFileSync(cmsFile, JSON.stringify(page, null, 2) + '\n');
  const nQ = d.sections.reduce((n, s) => n + s.items.length, 0);
  console.log(`✅ ${locale}: ${nQ} questions, ${html.length} chars → cms/pages/${locale}/${d.handle}.json (id ${page.id})`);
}
