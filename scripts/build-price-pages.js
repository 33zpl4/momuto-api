'use strict';
/**
 * Builds the per-market price pages from ONE source of numbers: the pricing block of faq/faq.<locale>.json (the ladder, add-ons,
 * shipping, deposit — already vetted against CLAUDE.md rule 6 and the US ladder) plus the page copy in pricing/price-page.<locale>.json.
 * Output: cms/pages/<locale>/<handle>.json (a pulled page if present, else an id-less stub that deploy-cms-page.js creates).
 *
 * Why (docs/ai-radar-opportunities-2026-11.md §5.1): price prompts are 7 of the radar's 48 and MOMUTO is named in 1–13% of the answers,
 * because our numbers lived in the FAQ and in JSON-LD only. Engines quote a sentence with a number in it; this page is that sentence,
 * in every market, with worked totals for 11 / 15 / 20 players, a browser-side calculator on the same ladder, and Product offers per tier.
 *
 * Usage: node scripts/build-price-pages.js [en,us,es,fr,it]
 */
const fs = require('fs');
const path = require('path');
const CSS = require('./lib/estate-css.js');
const ROOT = path.resolve(__dirname, '..');
const LOCALES = (process.argv[2] || 'en,us,es,fr,it').split(',').map(s => s.trim()).filter(Boolean);
const esc = (s) => String(s).replace(/&(?![a-z#0-9]+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const strip = (h) => String(h).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const amp = (u) => u.replace(/&(?!amp;)/g, '&amp;');
const DESIGNER = 'https://design.momuto.com/3d-configurator/configurator.html?userId=userIdUrl&configId=ypi9qc1z&suitName=mamuto3suit1&lang=en&langguage=en';
const REQUEST = { en: '/pages/request-custom-kit-design', us: '/pages/request-custom-kit-design', es: '/pages/solicitud-de-diseno-personalizado', fr: '/pages/demande-de-design-professionnel-de-maillots', it: '/pages/richiesta-design-personalizzato' };

// "38,90 €" | "€38.90" | "$45.90" -> 38.9 ; tier label "10–19 units" -> [10,19]; "100+" -> [100, Infinity]
const num = (s) => parseFloat(String(s).replace(/[^\d,.]/g, '').replace(',', '.'));
const tierOf = (label) => { const m = String(label).match(/(\d+)\s*[–-]\s*(\d+)/); if (m) return [+m[1], +m[2]]; const p = String(label).match(/(\d+)\s*\+/); if (p) return [+p[1], Infinity]; const o = String(label).match(/(\d+)/); return [+o[1], +o[1]]; };
function money(v, locale) {
  const n = v.toFixed(2);
  if (locale === 'us') return '$' + n;
  if (locale === 'en') return '€' + n;
  return n.replace('.', ',') + ' €';
}
function ladder(d) {
  return d.pricing.rows.map(r => ({ label: r[0], range: tierOf(r[0]), jersey: num(r[1]), shorts: num(r[2]), kit: num(r[3]), pop: r[4] === true }));
}
function priceAt(rows, qty, key) { const t = rows.find(r => qty >= r.range[0] && qty <= r.range[1]) || rows[rows.length - 1]; return t[key]; }
// add-on numbers are read from the FAQ notes (so a change there propagates): socks per pair, long sleeves, fast lane, free-shipping threshold, shipping fee
function addons(d, locale) {
  const txt = d.pricing.notes.map(strip).join('\n');
  const find = (re) => { const m = txt.match(re); return m ? num(m[1]) : null; };
  const a = {
    socks: find(/(?:Socks|Medias|Chaussettes|Calzettoni)[^\d$€]*([\d.,]+\s?€|\$[\d.,]+|€[\d.,]+)/i),
    ls: find(/(?:Long sleeves|Manga larga|Manches longues|Maniche lunghe)[^\d$€]*\+?\s*([\d.,]+\s?€|\$[\d.,]+|€[\d.,]+)/i),
    fast: find(/(?:Fast lane|Vía rápida|Voie rapide|Corsia veloce)[^\d$€]*\+?\s*([\d.,]+\s?€|\$[\d.,]+|€[\d.,]+)/i),
    freeOver: find(/(?:over|a partir de|dès|da)\s*([\d.,]+\s?€|\$[\d.,]+|€[\d.,]+)/i),
    fee: find(/(?:shipping is|el envío cuesta|la livraison coûte|la spedizione costa)\s*([\d.,]+\s?€|\$[\d.,]+|€[\d.,]+)/i),
  };
  for (const k of Object.keys(a)) if (a[k] == null || Number.isNaN(a[k])) throw new Error(`${locale}: could not read add-on "${k}" from the FAQ pricing notes`);
  return a;
}
function jsonld(d, c, rows, locale) {
  const url = `${d.base}/pages/${c.handle}`;
  const cur = locale === 'us' ? 'USD' : 'EUR';
  const web = { '@context': 'https://schema.org', '@type': 'WebPage', name: c.title, description: c.meta_descript, url, inLanguage: d.lang,
    breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: d.base }, { '@type': 'ListItem', position: 2, name: strip(c.h1), item: url }] } };
  const offers = rows.map(r => ({ '@type': 'Offer', priceCurrency: cur, price: r.jersey.toFixed(2), availability: 'https://schema.org/InStock', url,
    eligibleQuantity: { '@type': 'QuantitativeValue', minValue: r.range[0], ...(Number.isFinite(r.range[1]) ? { maxValue: r.range[1] } : {}), unitText: 'jersey' }, name: `${strip(c.calc.jersey)} · ${r.label}` }));
  const product = { '@context': 'https://schema.org', '@type': 'Product', name: strip(c.calc.jersey) + ' — MOMUTO', description: c.meta_descript, brand: { '@type': 'Brand', name: 'MOMUTO' },
    offers: { '@type': 'AggregateOffer', priceCurrency: cur, lowPrice: rows[rows.length - 1].jersey.toFixed(2), highPrice: rows[0].jersey.toFixed(2), offerCount: rows.length, availability: 'https://schema.org/InStock', url, offers } };
  const faq = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: c.faq.map(([q, a]) => ({ '@type': 'Question', name: strip(q), acceptedAnswer: { '@type': 'Answer', text: strip(a) } })) };
  return [web, product, faq].map(o => `<script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n</script>`).join('\n');
}
const EXTRA_CSS = `
.hero .ctas{display:flex;gap:.8rem;justify-content:center;flex-wrap:wrap;margin-top:1.8rem}
table.ladder.ex td:nth-child(n+2){text-align:right;white-space:nowrap}
.calc{background:rgba(255,255,255,.03);border:1px solid var(--border);padding:22px 24px;max-width:720px}
.calc .row{display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin:0 0 12px}
.calc label{font-size:.9rem;color:var(--muted);display:flex;align-items:center;gap:8px}
.calc input[type=number],.calc select{background:#0b0b0c;color:var(--white);border:1px solid var(--border);padding:8px 10px;font-family:var(--fb);font-size:1rem;width:110px}
.calc select{width:auto}
.calc .out{font-family:var(--fd);font-size:2.2rem;color:var(--white);line-height:1;margin-top:10px}
.calc .out small{font-family:var(--fb);font-size:.9rem;color:var(--muted);display:block;margin-top:6px}
.plink{margin-top:1.2rem;font-size:.88rem}.plink a{color:var(--white);border-bottom:1px solid var(--red);text-decoration:none}
`;
function render(d, c, locale) {
  const rows = ladder(d); const a = addons(d, locale);
  const fmt = (v) => money(v, locale);
  const quick = c.quick.map(([k, l]) => `<div class="q"><div class="k">${esc(k)}</div><div class="l">${esc(l)}</div></div>`).join('');
  const ladderRows = d.pricing.rows.map(r => `<tr${r[4] === true ? ' class="pop"' : ''}>${r.slice(0, 4).map((x, i) => `<td>${esc(x)}${r[4] === true && i === 0 ? `<span class="pill">${esc(d.pricing.popular)}</span>` : ''}</td>`).join('')}</tr>`).join('\n');
  const notes = d.pricing.notes.map(n => `<li><span class="ck">&check;</span><span>${n}</span></li>`).join('\n');
  const ship = (total) => total >= a.freeOver ? 0 : a.fee;
  const ex = [11, 15, 20].map(n => { const j = n * priceAt(rows, n, 'jersey'), k = n * priceAt(rows, n, 'kit'); const jt = j + ship(j), kt = k + ship(k);
    return `<tr><td>${n} ${esc(c.players)}</td><td>${fmt(jt)}</td><td>${fmt(jt / n)}</td><td>${fmt(kt)}</td><td>${fmt(kt / n)}</td></tr>`; }).join('\n');
  const faq = c.faq.map(([q, an]) => `<details><summary>${esc(q)}</summary><div class="a"><p>${an}</p></div></details>`).join('\n');
  const more = c.more.map(([u, t]) => `<a href="${u}">${esc(t)}</a>`).join(' &middot; ');
  const data = { rows: rows.map(r => ({ min: r.range[0], max: Number.isFinite(r.range[1]) ? r.range[1] : 1e9, jersey: r.jersey, kit: r.kit })), socks: a.socks, ls: a.ls, fast: a.fast, freeOver: a.freeOver, fee: a.fee, cur: locale === 'us' ? '$' : '€', after: !(locale === 'us' || locale === 'en'), dec: (locale === 'us' || locale === 'en') ? '.' : ',' };
  const calcJs = `(function(){var el=document.getElementById('mo-price-calc');if(!el)return;var D=JSON.parse(el.getAttribute('data-ladder'));var q=function(s){return el.querySelector(s)};
function f(v){var s=v.toFixed(2);if(D.dec===','){s=s.replace('.',',');}return D.after?s+' '+D.cur:D.cur+s}
function tier(n){for(var i=0;i<D.rows.length;i++){if(n>=D.rows[i].min&&n<=D.rows[i].max)return D.rows[i]}return D.rows[D.rows.length-1]}
function run(){var n=Math.max(1,Math.min(999,parseInt(q('#mo-n').value,10)||1));var t=tier(n);var kit=q('#mo-item').value==='kit';var unit=kit?t.kit:t.jersey;var sub=n*unit;if(q('#mo-ls').checked)sub+=n*D.ls;if(q('#mo-socks').checked)sub+=n*D.socks;var sh=sub>=D.freeOver?0:D.fee;var fast=q('#mo-fast').checked?D.fast:0;var total=sub+sh+fast;
q('#mo-total').textContent=f(total);q('#mo-per').textContent=f(total/n)+' '+el.getAttribute('data-per')+' · '+el.getAttribute('data-ship')+' '+(sh?f(sh):'0')}
['change','input','keyup'].forEach(function(e){el.addEventListener(e,run)});run()})();`;
  return `${jsonld(d, c, rows, locale)}
<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" /><link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&amp;family=Outfit:wght@300;400;500;600;700;800&amp;display=swap" rel="stylesheet" />
<style>${CSS}${EXTRA_CSS}</style>
<div class="faqpage">
<section class="hero">
<div class="badge">${esc(c.label)}</div>
<h1 class="h1">${c.h1}</h1>
<p class="sub">${c.sub}</p>
<div class="ctas"><a href="${amp(DESIGNER)}" class="btn">${esc(c.cta_btn)}</a><a href="${REQUEST[locale]}" class="btn2">${esc(c.cta_btn2)}</a></div>
<div class="quick">${quick}</div>
</section>

<section class="sec" id="ladder">
<div class="wrap">
<h2>${esc(c.ladder_h)}</h2>
<p class="lead">${c.ladder_lead}</p>
<div class="tablewrap"><table class="ladder">
<thead><tr>${d.pricing.cols.map(x => `<th>${esc(x)}</th>`).join('')}</tr></thead>
<tbody>
${ladderRows}
</tbody></table></div>
</div>
</section>

<section class="sec alt" id="examples">
<div class="wrap">
<h2>${esc(c.ex_h)}</h2>
<p class="lead">${c.ex_lead}</p>
<div class="tablewrap"><table class="ladder ex">
<thead><tr>${c.ex_cols.map(x => `<th>${esc(x)}</th>`).join('')}</tr></thead>
<tbody>
${ex}
</tbody></table></div>
</div>
</section>

<section class="sec" id="addons">
<div class="wrap">
<h2>${esc(c.addons_h)}</h2>
<ul class="notes">
${notes}
</ul>
</div>
</section>

<section class="sec alt" id="calculator">
<div class="wrap">
<h2>${esc(c.calc_h)}</h2>
<p class="lead">${c.calc_lead}</p>
<div class="calc" id="mo-price-calc" data-ladder='${esc(JSON.stringify(data)).replace(/'/g, '&#39;')}' data-per="${esc(c.calc.per)}" data-ship="${esc(c.calc.ship)}">
<div class="row"><label>${esc(c.calc.players)} <input type="number" id="mo-n" min="1" max="999" value="15"></label>
<label>${esc(c.calc.item)} <select id="mo-item"><option value="jersey">${esc(c.calc.jersey)}</option><option value="kit" selected>${esc(c.calc.kit)}</option></select></label></div>
<div class="row"><label><input type="checkbox" id="mo-socks"> ${esc(c.calc.socks)}</label><label><input type="checkbox" id="mo-ls"> ${esc(c.calc.ls)}</label><label><input type="checkbox" id="mo-fast"> ${esc(c.calc.fast)}</label></div>
<div class="out"><span id="mo-total">—</span><small>${esc(c.calc.total)} · <span id="mo-per"></span></small></div>
</div>
<script>${calcJs}</script>
</div>
</section>

<section class="sec" id="questions">
<div class="wrap">
<h2>${esc(c.faq_h)}</h2>
<div class="faq">
${faq}
</div>
</div>
</section>

<section class="cta-end">
<h2>${esc(c.cta_h)}</h2>
<p>${c.cta_p}</p>
<a href="${amp(DESIGNER)}" class="btn">${esc(c.cta_btn)}</a>
<a href="${REQUEST[locale]}" class="btn2">${esc(c.cta_btn2)}</a>
</section>
<div class="more">${esc(c.more_label)} ${more}</div>
</div>
`;
}
function sanity(locale, c, html) {
  if (!html.includes('Bebas Neue') || !html.includes('Outfit')) throw new Error(`${locale}: fonts`);
  if ((html.match(/<h1\b/g) || []).length !== 1) throw new Error(`${locale}: h1 count`);
  for (const blk of html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || []) JSON.parse(blk.replace(/<\/?script[^>]*>/g, ''));
  if (c.meta_title.length > 65) throw new Error(`${locale}: meta_title ${c.meta_title.length}/65`);
  if (c.meta_descript.length > 160) throw new Error(`${locale}: meta_descript ${c.meta_descript.length}/160`);
  if (!Array.isArray(c.keywords)) throw new Error(`${locale}: keywords must be an array`);
  const prose = html.replace(/href="[^"]*"/g, '').replace(/"item": "[^"]*"|"url": "[^"]*"/g, '');
  if (locale === 'us' && /€|&euro;|\bEUR\b|\bfootball\b|colour|\bshirt/i.test(prose)) throw new Error('us: contains €/EUR/football/shirt/British spelling');
  if (locale !== 'us' && /\$\d/.test(prose)) throw new Error(`${locale}: contains a $ price`);
  if (/\b20[.,]90\s?€|€20[.,]90|\$24[.,]90 each/.test(prose)) throw new Error(`${locale}: stale price`);
  if (/refund|reembols|rembours|rimbors/i.test(prose)) throw new Error(`${locale}: refund wording on a price page (rule 5)`);
  const t = html.match(/<tr><td>15 [^<]*<\/td><td>([^<]*)<\/td>/); if (!t) throw new Error(`${locale}: worked example row for 15 players missing`);
}
for (const locale of LOCALES) {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'faq', `faq.${locale}.json`), 'utf8'));
  const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'pricing', `price-page.${locale}.json`), 'utf8'));
  const html = render(d, c, locale);
  sanity(locale, c, html);
  fs.mkdirSync(path.join(ROOT, 'pages', 'pricing'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'pages', 'pricing', `${locale}.html`), html);
  const cmsFile = path.join(ROOT, 'cms', 'pages', locale, `${c.handle}.json`);
  const page = fs.existsSync(cmsFile) ? JSON.parse(fs.readFileSync(cmsFile, 'utf8')) : { handle: c.handle };
  Object.assign(page, { content: html, title: c.title, meta_title: c.meta_title, meta_descript: c.meta_descript, meta_keywords: c.keywords, handle: c.handle });
  fs.writeFileSync(cmsFile, JSON.stringify(page, null, 2) + '\n');
  const m15 = html.match(/<tr><td>15 [^<]*<\/td><td>([^<]*)<\/td><td>[^<]*<\/td><td>([^<]*)<\/td>/);
  console.log(`✅ ${locale}: ${html.length} chars → cms/pages/${locale}/${c.handle}.json (${page.id ? 'id ' + page.id : 'NEW'}) · 15 players: jerseys ${m15[1]}, kits ${m15[2]}`);
}
