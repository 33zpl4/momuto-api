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

const CSS = `
.title, .page-title { display: none !important; }
:root { --bg:#0a0a0a; --panel:#111; --border:rgba(255,255,255,0.07); --white:#f5f5f5; --muted:#a1a1aa; --dim:#71717a; --red:#c8352e; --red-h:#e04038; --fd:'Bebas Neue',sans-serif; --fb:'Outfit',sans-serif; }
*{margin:0;padding:0;box-sizing:border-box;-webkit-font-smoothing:antialiased}
body{font-family:var(--fb);font-weight:300;background:var(--bg);color:var(--white);line-height:1.65;overflow-x:hidden}
h1,h2,h3{font-family:var(--fd);font-weight:400;text-transform:uppercase;letter-spacing:.03em;line-height:1}
.acc{color:var(--red)}
.faqpage{margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw)}
.wrap{max-width:1060px;margin:0 auto;padding:0 1.5rem}
.hero{padding:5rem 1.5rem 3.5rem;text-align:center;background:radial-gradient(circle at 50% 0%,#1a1a1a 0%,var(--bg) 70%);border-bottom:1px solid var(--border)}
.badge{background:rgba(200,53,46,.1);border:1px solid rgba(200,53,46,.18);color:var(--red);font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.14em;padding:6px 14px;display:inline-block;margin-bottom:1.4rem}
.h1{font-size:clamp(2.6rem,6vw,4.2rem);max-width:880px;margin:0 auto 1.2rem}
.sub{color:var(--muted);font-size:1rem;max-width:660px;margin:0 auto;text-align:center}
.mo-editor-reset .sub{margin-inline:auto}
.quick{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;max-width:1060px;margin:2.4rem auto 0;padding:0 1.5rem;text-align:left}
.mo-editor-reset .quick{margin-inline:auto}
.q{background:rgba(255,255,255,.03);border:1px solid var(--border);padding:18px 20px}
.q .k{font-family:var(--fd);font-size:1.7rem;color:var(--white);line-height:1;letter-spacing:.02em}
.q .l{font-size:.78rem;color:var(--muted);margin-top:8px;line-height:1.5}
nav.faqnav{position:sticky;top:0;z-index:5;background:rgba(10,10,10,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--border)}
nav.faqnav ul{list-style:none !important;margin:0 auto !important;padding:0 1rem !important;max-width:1060px;display:flex !important;gap:.2rem;overflow-x:auto;scrollbar-width:none}
nav.faqnav ul::-webkit-scrollbar{display:none}
nav.faqnav li{list-style:none !important;display:block !important;flex-shrink:0}
nav.faqnav li::marker{content:none}
nav.faqnav a{display:block;padding:14px 12px;font-size:.72rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);text-decoration:none;border-bottom:2px solid transparent;white-space:nowrap}
nav.faqnav a:hover{color:var(--white);border-color:var(--red)}
.sec{padding:3.5rem 0;scroll-margin-top:60px}
.sec h2{font-size:clamp(1.8rem,4vw,2.4rem);margin-bottom:.4rem}
.sec .lead{color:var(--muted);max-width:720px;margin:0 0 1.8rem;font-size:.95rem}
.sec.alt{background:var(--panel);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.faq details{border-top:1px solid rgba(255,255,255,.1)}
.faq details:last-child{border-bottom:1px solid rgba(255,255,255,.1)}
.faq summary{list-style:none;cursor:pointer;padding:18px 4px;font-size:1rem;font-weight:600;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:16px}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:'+';font-size:24px;color:var(--red);font-weight:300;line-height:1;flex-shrink:0}
.faq details[open] summary::after{content:'\\2013'}
.faq .a{margin:0 4px 18px;font-size:.9rem;color:var(--muted);line-height:1.7;max-width:820px}
.faq .a b{color:#e5e5e5;font-weight:600}
.faq .a a{color:var(--white);border-bottom:1px solid var(--red);text-decoration:none}
.tablewrap{overflow-x:auto;border:1px solid var(--border);background:var(--panel)}
table.ladder{width:100%;border-collapse:collapse;min-width:560px;font-size:.92rem}
table.ladder th{font-family:var(--fd);font-weight:400;font-size:1rem;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);text-align:left;padding:14px 16px;border-bottom:1px solid var(--border)}
table.ladder td{padding:13px 16px;border-bottom:1px solid var(--border);color:var(--white)}
table.ladder tr:last-child td{border-bottom:none}
table.ladder td:first-child{color:var(--muted)}
table.ladder tr.pop td{background:rgba(200,53,46,.08);color:#fff;font-weight:600}
table.ladder .pill{display:inline-block;margin-left:8px;background:var(--red);color:#fff;font-size:.6rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:3px 8px;vertical-align:middle}
ul.notes{list-style:none !important;margin:1.4rem 0 0 !important;padding:0 !important;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px 24px}
ul.notes > li{display:flex !important;list-style:none !important;gap:.6rem;align-items:flex-start;font-size:.86rem;color:var(--muted);line-height:1.55}
ul.notes > li::marker{content:none}
ul.notes > li .ck{color:var(--red);font-weight:700;flex-shrink:0}
ul.notes b{color:#e5e5e5;font-weight:600}
.btn{display:inline-block;background:var(--red);color:#fff;padding:16px 40px;font-weight:700;font-size:.82rem;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;border:1px solid var(--red);transition:all .2s}
.btn:hover{background:var(--red-h);transform:translateY(-2px)}
.btn2{display:inline-block;background:transparent;color:var(--white);border:1px solid rgba(255,255,255,.18);padding:14px 34px;font-weight:600;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;transition:all .2s;margin-left:.6rem}
.btn2:hover{border-color:var(--red);color:var(--red)}
.cta-end{padding:4.5rem 1.5rem;text-align:center;background:var(--panel);border-top:1px solid var(--border)}
.cta-end h2{font-size:clamp(2rem,4vw,2.8rem);margin-bottom:1rem}
.cta-end p{color:var(--muted);max-width:560px;margin:0 auto 2rem;font-size:.95rem}
.mo-editor-reset .cta-end p{margin-inline:auto}
.more{padding:2.5rem 1.5rem;text-align:center;font-size:.85rem;color:var(--dim)}
.more a{color:var(--muted)}
@media(max-width:520px){.btn2{margin-left:0;margin-top:.8rem}}
`;

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
