'use strict';
/**
 * Builds the per-market "best sites for custom kits" roundup pages (EN/UK, FR, IT) from roundup/roundup.<locale>.json
 * into cms/pages/<locale>/<handle>.json (pulled page if present, else an id-less stub for deploy-cms-page.js to create).
 *
 * Why (docs/ai-radar-opportunities-2026-11.md, 3 Nov 2026): the ES roundup (pages/roundup-es, "mejores webs…") is MOMUTO's most-cited
 * page in AI answers and lifted the ES market to 25%; "best site" prompts are the largest category in the radar (90 of 382 answers)
 * and the one we win least (5). FR and IT had a "vs" page only; the UK had a US-flavoured one. Same format, one builder.
 * The CSS is the ES page's own <style> block (read at build time, so the four roundups stay identical in look); the MOMUTO ladder comes
 * from faq/faq.<locale>.json (one source of numbers); competitor cells are the copy file's, each page lists its sources.
 *
 * Usage: node scripts/build-roundup-pages.js [en,fr,it]
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const LOCALES = (process.argv[2] || 'en,fr,it').split(',').map(s => s.trim()).filter(Boolean);
const esc = (s) => String(s).replace(/&(?![a-z#0-9]+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const strip = (h) => String(h).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#10003;/g, '✓').replace(/\s+/g, ' ').trim();
const DESIGNER = 'https://design.momuto.com/3d-configurator/configurator.html?userId=userIdUrl&amp;configId=ypi9qc1z&amp;suitName=mamuto3suit1&amp;lang=en&amp;langguage=en';
const es = fs.readFileSync(path.join(ROOT, 'pages', 'roundup-es'), 'utf8');
const CSS = (es.match(/<style>([\s\S]*?)<\/style>/) || [])[1];
if (!CSS) throw new Error('pages/roundup-es: <style> block not found (the roundups share its CSS)');
const FONTS = (es.match(/<link[^>]*fonts\.googleapis[^>]*>/) || [''])[0];

function jsonld(d) {
  const url = `${d.base}/pages/${d.handle}`;
  const web = { '@context': 'https://schema.org', '@type': 'WebPage', name: d.title, description: d.meta_descript, url, inLanguage: d.lang,
    datePublished: '2026-11-03', dateModified: '2026-11-03', speakable: { '@type': 'SpeakableSpecification', cssSelector: ['.verdict-section', '.analysis-section'] },
    publisher: { '@id': 'https://www.momuto.com/#organization' } };
  const faq = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: d.faq.map(([q, a]) => ({ '@type': 'Question', name: strip(q), acceptedAnswer: { '@type': 'Answer', text: strip(a) } })) };
  const list = { '@context': 'https://schema.org', '@type': 'ItemList', name: strip(d.h1), itemListOrder: 'https://schema.org/ItemListUnordered',
    itemListElement: d.cols.map((name, i) => { const src = d.sources.find(([n]) => name.toLowerCase().startsWith(n.toLowerCase().split(' ')[0])); return { '@type': 'ListItem', position: i + 1, name: strip(name), ...(i === 0 ? { url: d.base } : src ? { url: src[1] } : {}) }; }) };
  return [web, faq, list].map(o => `<script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n</script>`).join('\n');
}
function render(d, faqSrc) {
  const p = faqSrc.pricing;
  const ladder = p.rows.map(r => `<tr${r[4] === true ? ' class="cmp-best-value"' : ''}><td>${esc(r[0])}${r[4] === true ? ` <span class="cmp-best-value-badge">${esc(p.popular)}</span>` : ''}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td class="cmp-kit-total">${esc(r[3])}</td></tr>`).join('\n');
  const head = d.cols.map(c => `<th>${esc(c)}</th>`).join('');
  const rows = d.rows.map(r => `<tr><td>${esc(r[0])}</td>${r.slice(1).map((c, i) => `<td>${i === 0 ? `<strong>${c}</strong>` : c}</td>`).join('')}</tr>`).join('\n');
  const profiles = d.profiles.map(([h, t]) => `<h3 class="cmp-h3">${esc(h)}</h3>\n<p class="cmp-p">${t}</p>`).join('\n');
  const verdict = d.verdict.map(([h, items]) => `<p class="cmp-p"><strong>${esc(h)}</strong></p>\n<ul>\n${items.map(i => `<li>${i}</li>`).join('\n')}\n</ul>`).join('\n');
  const faq = d.faq.map(([q, a]) => `<h3 class="cmp-h3">${esc(q)}</h3>\n<p class="cmp-p">${a}</p>`).join('\n');
  const sources = d.sources.map(([n, u]) => `<li><a href="${u}" rel="nofollow noopener" target="_blank">${esc(n)}</a> — <span style="opacity:.7">${esc(u.replace(/^https?:\/\//, '').slice(0, 60))}</span></li>`).join('\n');
  const more = d.more.map(([u, t]) => `<a href="${u}">${esc(t)}</a>`).join(' &middot; ');
  return `${jsonld(d)}
${FONTS}
<style>${CSS}</style>
<div class="cmp-page">
<div class="cmp-header">
<div class="cmp-header-badge">${esc(d.badge)}</div>
<h1>${d.h1}</h1>
<p class="cmp-last-updated">${esc(d.updated)}</p>
</div>
<div class="cmp-container">
<div class="cmp-answer-box">
<span class="cmp-answer-box-label">${{ en: 'Quick answer', fr: 'Réponse rapide', it: 'Risposta rapida' }[d.locale]}</span>
<p>${d.answer}</p>
</div>
<div>
${d.intro.map(t => `<p class="cmp-p">${t}</p>`).join('\n')}
<p class="cmp-p">${d.links}</p>
</div>
<h2 class="cmp-h2">${esc(d.prices_h)}</h2>
<p class="cmp-p">${d.prices_p}</p>
<div class="cmp-table-wrap"><div style="overflow-x: auto;">
<table class="cmp-pricing-table">
<thead><tr>${p.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
<tbody>
${ladder}
</tbody></table>
</div></div>
<p class="cmp-note">${d.prices_note}</p>
<h2 class="cmp-h2">${esc(d.table_h)}</h2>
<div class="cmp-table-wrap"><div style="overflow-x: auto;">
<table class="cmp-master-table">
<thead><tr><th>${esc(d.crit)}</th>${head}</tr></thead>
<tbody>
${rows}
</tbody></table>
</div></div>
<p class="cmp-note">${d.table_note}</p>
<h2 class="cmp-h2 analysis-section">${esc(d.an_h)}</h2>
${profiles}
<h2 class="cmp-h2 verdict-section">${esc(d.verdict_h)}</h2>
<div class="cmp-highlight-box">
${verdict}
</div>
<p class="cmp-p">${d.conclusion}</p>
<h2 class="cmp-h2">${esc(d.faq_h)}</h2>
${faq}
<h2 class="cmp-h2">${esc(d.sources_h)}</h2>
<ul>
${sources}
</ul>
<div class="cmp-cta-block">
<h3>${esc(d.cta_h)}</h3>
<p>${d.cta_p}</p>
<a href="${d.cta_btn_url}" class="cmp-cta-btn">${esc(d.cta_btn)}</a> <a href="${DESIGNER}" class="cmp-cta-btn">${esc(d.cta_btn2)}</a>
</div>
<p class="cmp-note">${esc(d.more_label)} ${more}</p>
</div>
</div>
`;
}
function sanity(d, html) {
  if ((html.match(/<h1\b/g) || []).length !== 1) throw new Error(`${d.locale}: h1 count`);
  for (const blk of html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || []) JSON.parse(blk.replace(/<\/?script[^>]*>/g, ''));
  if (d.meta_title.length > 65) throw new Error(`${d.locale}: meta_title ${d.meta_title.length}/65`);
  if (d.meta_descript.length > 160) throw new Error(`${d.locale}: meta_descript ${d.meta_descript.length}/160`);
  const prose = strip(html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/href="[^"]*"/g, ''));
  if (/20[–-]25 (days|jours|giorni)|20[.,]90 ?€|€20[.,]90/i.test(prose)) throw new Error(`${d.locale}: stale number`);
  if (/refund|rembours|rimbors/i.test(prose)) throw new Error(`${d.locale}: refund wording (rule 5)`);
  if (!/25[–-]30/.test(prose) || !/21[.,]90/.test(prose) || !/26[.,]90/.test(prose)) throw new Error(`${d.locale}: canonical numbers missing`);
  if (!/53/.test(prose)) throw new Error(`${d.locale}: Trustpilot count missing`);
  for (const r of d.rows) if (r.length !== d.cols.length + 1) throw new Error(`${d.locale}: row "${r[0]}" has ${r.length - 1} cells for ${d.cols.length} suppliers`);
  if (/\bReal Madrid|Barcelona|Juventus|Manchester/i.test(prose)) throw new Error(`${d.locale}: club name on a product surface (rule 4)`);
}
for (const locale of LOCALES) {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'roundup', `roundup.${locale}.json`), 'utf8'));
  const faqSrc = JSON.parse(fs.readFileSync(path.join(ROOT, 'faq', `faq.${locale}.json`), 'utf8'));
  const html = render(d, faqSrc);
  sanity(d, html);
  fs.mkdirSync(path.join(ROOT, 'pages', 'roundup'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'pages', 'roundup', `${locale}.html`), html);
  const cmsFile = path.join(ROOT, 'cms', 'pages', locale, `${d.handle}.json`);
  const page = fs.existsSync(cmsFile) ? JSON.parse(fs.readFileSync(cmsFile, 'utf8')) : { handle: d.handle };
  Object.assign(page, { content: html, title: d.title, meta_title: d.meta_title, meta_descript: d.meta_descript, meta_keywords: d.keywords, handle: d.handle });
  fs.writeFileSync(cmsFile, JSON.stringify(page, null, 2) + '\n');
  console.log(`✅ ${locale}: ${html.length} chars → cms/pages/${locale}/${d.handle}.json (${page.id ? 'id ' + page.id : 'NEW'})`);
}
