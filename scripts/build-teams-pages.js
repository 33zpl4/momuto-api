'use strict';
/**
 * "Teams that trust MOMUTO" — real teams wearing our kits, all five stores, one source.
 *
 *   teams/photos.json  one row per team photo, newest first (the ONLY thing added when a photo comes in)
 *   teams/copy.json    wording, meta and numbers per locale
 *   -> cms/pages/<locale>/<handle>.json  (the pulled CMS objects; `content` + meta are replaced, every other
 *      field of the pulled object is kept, so a PUT never drops og_image & co — CLAUDE.md rule 1)
 *
 * Deploy: Deploy CMS Page (push to main) or `PAGE_HANDLE=… LOCALE=… DRY_RUN=false node scripts/deploy-cms-page.js`.
 * Built to docs/cms-page-gotchas.md (title-hide, body paint, .mo-editor-reset centring, qualified !important lists).
 *
 *   node scripts/build-teams-pages.js            write the five page objects
 *   node scripts/build-teams-pages.js --check    build in memory, run the checks, write nothing
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CHECK_ONLY = process.argv.includes('--check');
const photos = JSON.parse(fs.readFileSync(path.join(ROOT, 'teams', 'photos.json'), 'utf8'));
const copy = JSON.parse(fs.readFileSync(path.join(ROOT, 'teams', 'copy.json'), 'utf8'));
const LOCALES = ['en', 'us', 'es', 'fr', 'it'];
const REGION_MIN = 3;   // a region gets its own filter button once it has this many photos

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fill = (tpl, v) => tpl.replace(/\{(\w+)\}/g, (_, k) => (v[k] == null ? '' : v[k]));
const baseLang = l => (l === 'us' ? 'en' : l);

const CSS = `
.title, .page-title { display: none !important; }
:root { --bg:#0a0a0a; --panel:#111; --border:rgba(255,255,255,0.07); --white:#f5f5f5; --muted:#a1a1aa; --dim:#71717a; --red:#c8352e; --red-h:#e04038; --fd:'Bebas Neue',sans-serif; --fb:'Outfit',sans-serif; }
*{margin:0;padding:0;box-sizing:border-box;-webkit-font-smoothing:antialiased}
body{font-family:var(--fb);font-weight:300;background:var(--bg);color:var(--white);line-height:1.65;overflow-x:hidden}
h1,h2,h3{font-family:var(--fd);font-weight:400;text-transform:uppercase;letter-spacing:.03em;line-height:1}
.tpage{margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw)}
.wrap{max-width:1240px;margin:0 auto;padding:0 1.5rem}
.hero{padding:5rem 1.5rem 3.5rem;text-align:center;background:radial-gradient(circle at 50% 0%,#1a1a1a 0%,var(--bg) 70%);border-bottom:1px solid var(--border)}
.badge{background:rgba(200,53,46,.1);border:1px solid rgba(200,53,46,.18);color:var(--red);font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.14em;padding:6px 14px;display:inline-block;margin-bottom:1.4rem}
.h1{font-size:clamp(2.6rem,6vw,4.2rem);max-width:880px;margin:0 auto 1.2rem}
.sub{color:var(--muted);font-size:1rem;max-width:660px;margin:0 auto;text-align:center}
.mo-editor-reset .sub{margin-inline:auto}
.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;max-width:760px;margin:2.6rem auto 0;text-align:left}
.mo-editor-reset .stats{margin-inline:auto}
.stat{background:rgba(255,255,255,.03);border:1px solid var(--border);padding:18px 20px;text-decoration:none;display:block}
.stat .k{font-family:var(--fd);font-size:1.7rem;color:var(--white);line-height:1;letter-spacing:.02em;display:block}
.stat .l{font-size:.78rem;color:var(--muted);margin-top:8px;line-height:1.5;display:block}
a.stat:hover{border-color:var(--red)}
.gal{padding:3.5rem 0 4rem;background:var(--panel);border-bottom:1px solid var(--border)}
.gal h2{font-size:clamp(1.8rem,4vw,2.4rem);text-align:center;margin-bottom:.4rem}
.gal .lead{color:var(--muted);text-align:center;font-size:.95rem;margin-bottom:1.8rem}
.filters{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-bottom:1.6rem}
.filters button{background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:0;text-transform:uppercase;font-family:var(--fb);font-size:.72rem;letter-spacing:.12em;padding:.7rem 1.3rem;font-weight:700;cursor:pointer;transition:all .2s}
.filters button:hover,.filters button.on{background:var(--red);color:#fff;border-color:var(--red)}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.tile{position:relative;display:block;aspect-ratio:4/3;overflow:hidden;border:0;padding:0;background:#000;cursor:pointer;text-align:left;font-family:var(--fb)}
.tile[hidden]{display:none}
.tile img{width:100%;height:100%;object-fit:cover;object-position:center 30%;display:block;transition:transform .5s ease}
.tile:hover img,.tile:focus-visible img{transform:scale(1.04)}
.tile:focus-visible{outline:2px solid var(--red);outline-offset:-2px}
.cap{position:absolute;left:0;right:0;bottom:0;padding:2.2rem 1.1rem .95rem;background:linear-gradient(to bottom,transparent 0%,rgba(0,0,0,.55) 45%,rgba(0,0,0,.92) 100%);color:#fff}
.cap b{display:block;font-family:var(--fd);font-weight:400;font-size:1.2rem;letter-spacing:.03em;text-transform:uppercase;line-height:1.1}
.cap span{display:block;font-size:.78rem;color:rgba(255,255,255,.82);margin-top:3px}
.bridge{padding:3.5rem 1.5rem;text-align:center;background:var(--bg);border-bottom:1px solid var(--border)}
.bridge h2{font-size:clamp(1.6rem,3.5vw,2.2rem);margin-bottom:.7rem}
.bridge p{color:var(--muted);max-width:540px;margin:0 auto 1.6rem;font-size:.95rem}
.mo-editor-reset .bridge p{margin-inline:auto}
.btn{display:inline-block;background:var(--red);color:#fff;padding:16px 40px;font-weight:700;font-size:.82rem;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;border:1px solid var(--red);transition:transform .2s,background .2s}
.btn:hover{background:var(--red-h);transform:translateY(-2px)}
.btn2{display:inline-block;background:transparent;color:var(--white);border:1px solid rgba(255,255,255,.18);padding:14px 34px;font-weight:600;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;margin-left:10px;transition:all .2s}
.btn2:hover{border-color:var(--red);color:var(--red)}
.ugc{padding:3rem 1.5rem;text-align:center;background:var(--bg);border-bottom:1px solid var(--border)}
.ugc h3{font-size:1.7rem;margin-bottom:.6rem}
.ugc p{color:var(--muted);max-width:520px;margin:0 auto 1.4rem;font-size:.92rem}
.mo-editor-reset .ugc p{margin-inline:auto}
.cta-end{padding:4.5rem 1.5rem;text-align:center;background:var(--panel)}
.cta-end h2{font-size:clamp(2rem,4vw,2.8rem);margin-bottom:1rem}
.cta-end p{color:var(--muted);max-width:560px;margin:0 auto 2rem;font-size:.95rem}
.mo-editor-reset .cta-end p{margin-inline:auto}
.lb{position:fixed;inset:0;z-index:9999;background:rgba(10,10,10,.96);display:none;align-items:center;justify-content:center;padding:3.5rem 1rem 2rem}
.lb.on{display:flex}
.lb figure{max-width:min(1100px,100%);max-height:100%;margin:0;text-align:center}
.lb img{max-width:100%;max-height:78vh;display:block;margin:0 auto}
.lb figcaption{margin-top:.9rem;color:var(--muted);font-size:.85rem}
.lb figcaption b{color:var(--white);font-family:var(--fd);font-weight:400;font-size:1.25rem;letter-spacing:.03em;text-transform:uppercase;margin-right:.6rem}
.lb button{position:absolute;background:transparent;border:0;color:#fff;cursor:pointer;font-size:2rem;line-height:1;padding:.6rem .9rem;font-family:var(--fb)}
.lb button:hover{color:var(--red)}
.lb .x{top:.6rem;right:.8rem}
.lb .pv{left:.4rem;top:50%;transform:translateY(-50%)}
.lb .nx{right:.4rem;top:50%;transform:translateY(-50%)}
@media(max-width:900px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){.grid{grid-template-columns:1fr}.stats{grid-template-columns:1fr}.btn2{margin-left:0;margin-top:.8rem}.hero{padding:3.5rem 1.2rem 2.5rem}}
@media(prefers-reduced-motion:reduce){.tile img,.btn{transition:none}}
`.replace(/\n+/g, '\n').trim();

const JS = `
(function(){
  var tiles=[].slice.call(document.querySelectorAll('.tpage .tile')),btns=[].slice.call(document.querySelectorAll('.tpage .filters button')),
      lb=document.getElementById('tlb'),im=lb.querySelector('img'),nm=lb.querySelector('b'),ds=lb.querySelector('span'),cur=-1;
  function vis(){return tiles.filter(function(t){return !t.hidden;});}
  btns.forEach(function(b){b.addEventListener('click',function(){
    btns.forEach(function(x){x.classList.remove('on');x.setAttribute('aria-pressed','false');});b.classList.add('on');b.setAttribute('aria-pressed','true');
    var f=b.getAttribute('data-f');tiles.forEach(function(t){t.hidden=!(f==='all'||t.getAttribute('data-c')===f||t.getAttribute('data-r')===f);});});});
  function show(t){cur=tiles.indexOf(t);var p=t.querySelector('img');im.src=p.currentSrc||p.src;im.alt=p.alt;nm.textContent=t.getAttribute('data-n');ds.textContent=t.getAttribute('data-d');lb.classList.add('on');document.body.style.overflow='hidden';lb.querySelector('.x').focus();}
  function hide(){lb.classList.remove('on');document.body.style.overflow='';if(cur>-1)tiles[cur].focus();}
  function step(d){var v=vis();if(!v.length)return;var i=v.indexOf(tiles[cur]);show(v[(i+d+v.length)%v.length]);}
  tiles.forEach(function(t){t.addEventListener('click',function(){show(t);});});
  lb.addEventListener('click',function(e){if(e.target===lb)hide();});
  lb.querySelector('.x').addEventListener('click',hide);lb.querySelector('.pv').addEventListener('click',function(){step(-1);});lb.querySelector('.nx').addEventListener('click',function(){step(1);});
  document.addEventListener('keydown',function(e){if(!lb.classList.contains('on'))return;if(e.key==='Escape')hide();else if(e.key==='ArrowLeft')step(-1);else if(e.key==='ArrowRight')step(1);});
})();`.trim();

function label(table, key, lang, fallback) {
  const row = table[key];
  return (row && (row[lang] || row.en)) || fallback || key;
}

function build(locale) {
  const L = copy.locales[locale];
  const lang = baseLang(locale);
  const place = p => (p.place && (p.place[lang] || p.place.en)) || '';
  const rating = ['es', 'fr', 'it'].includes(lang) ? copy.stats.rating.replace('.', ',') : copy.stats.rating;
  const designer = `https://design.momuto.com/3d-configurator/configurator.html?userId=userIdUrl&amp;configId=ypi9qc1z&amp;suitName=mamuto3suit1&amp;lang=${lang}&amp;langguage=${lang}`;

  // filters: every country present (largest first), then regions with >= REGION_MIN photos
  const count = (key, f) => photos.reduce((m, p) => (f(p) ? m.set(f(p), (m.get(f(p)) || 0) + 1) : m), new Map());
  const countries = [...count('c', p => p.country).entries()].sort((a, b) => b[1] - a[1]);
  const regions = [...count('r', p => p.region).entries()].filter(([, n]) => n >= REGION_MIN).sort((a, b) => b[1] - a[1]);
  const filters = [`<button type="button" class="on" aria-pressed="true" data-f="all">${esc(L.all)}</button>`]
    .concat(countries.map(([c]) => `<button type="button" aria-pressed="false" data-f="c:${esc(c)}">${esc(label(copy.countries, c, lang))}</button>`))
    .concat(regions.map(([r]) => `<button type="button" aria-pressed="false" data-f="r:${esc(r)}">${esc(label(copy.regions, r, lang))}</button>`));

  const tiles = photos.map(p => {
    const v = { team: p.team, place: place(p), league: p.league };
    const detail = [place(p), p.league].filter(Boolean).join(' · ');
    return `<button type="button" class="tile" data-c="c:${esc(p.country)}" data-r="${p.region ? 'r:' + esc(p.region) : ''}" data-n="${esc(p.team)}" data-d="${esc(detail)}" aria-label="${esc(L.openPhoto)}: ${esc(p.team)}">` +
      `<img src="${esc(p.image)}" alt="${esc(fill(L.alt, v))}" loading="lazy" decoding="async" />` +
      `<span class="cap"><b>${esc(p.team)}</b><span>${esc(detail)}</span></span></button>`;
  });

  const ld = [{
    '@context': 'https://schema.org', '@type': 'ImageGallery', name: L.ldName, description: L.ldDescription,
    url: `${L.site}/pages/${L.handle}`, inLanguage: L.inLanguage,
    author: { '@type': 'Organization', name: 'MOMUTO', url: L.site },
    mainEntity: {
      '@type': 'ItemList', numberOfItems: photos.length,
      itemListElement: photos.map((p, i) => ({
        '@type': 'ListItem', position: i + 1,
        item: { '@type': 'ImageObject', name: fill(L.imgName, { team: p.team }), description: fill(L.imgDescription, { team: p.team, place: place(p), league: p.league }), contentUrl: p.image },
      })),
    },
  }];

  const html = [
    `<script type="application/ld+json">\n${JSON.stringify(ld[0], null, 2)}\n</script>`,
    '<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" /><link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&amp;family=Outfit:wght@300;400;500;600;700;800&amp;display=swap" rel="stylesheet" />',
    `<style>\n${CSS}\n</style>`,
    '<div class="tpage">',
    `<header class="hero"><span class="badge">${esc(L.badge)}</span><h1 class="h1">${esc(L.title)}</h1><p class="sub">${esc(L.sub)}</p>`,
    `<div class="stats"><div class="stat"><span class="k">${esc(copy.stats.teams)}</span><span class="l">${esc(L.statTeams)}</span></div>` +
      `<div class="stat"><span class="k">${esc(copy.stats.countries)}</span><span class="l">${esc(L.statCountries)}</span></div>` +
      `<a class="stat" href="https://www.trustpilot.com/review/momuto.com" rel="noopener" target="_blank"><span class="k">${esc(rating)}</span><span class="l">${esc(fill(L.statReviews, { n: copy.stats.reviews }))}</span></a></div></header>`,
    `<section class="gal"><div class="wrap"><h2>${esc(L.galleryH2)}</h2><p class="lead">${esc(L.gallerySub)}</p>`,
    `<div class="filters" role="group" aria-label="${esc(L.filtersLabel)}">${filters.join('')}</div>`,
    `<div class="grid" role="list" aria-label="${esc(L.photosLabel)}">${tiles.join('\n')}</div></div></section>`,
    `<section class="bridge"><h2>${esc(L.bridgeH2)}</h2><p>${esc(L.bridgeP)}</p><a class="btn" href="/pages/${esc(L.gallery)}">${esc(L.bridgeBtn)}</a></section>`,
    `<section class="ugc"><h3>${esc(L.ugcH2)}</h3><p>${esc(L.ugcP)}</p><a class="btn2" style="margin-left:0" href="mailto:info@momuto.com?subject=${encodeURIComponent(L.ugcSubject)}">${esc(L.ugcBtn)}</a></section>`,
    `<section class="cta-end"><h2>${esc(L.ctaH2)}</h2><p>${esc(L.ctaP)}</p><a class="btn" href="${designer}">${esc(L.ctaBtn)}</a><a class="btn2" href="/pages/${esc(L.request)}">${esc(L.ctaBtn2)}</a></section>`,
    '</div>',
    `<div id="tlb" class="lb" role="dialog" aria-modal="true"><button type="button" class="x" aria-label="${esc(L.close)}">&times;</button><button type="button" class="pv" aria-label="${esc(L.prev)}">&#8249;</button><figure><img alt="" /><figcaption><b></b><span></span></figcaption></figure><button type="button" class="nx" aria-label="${esc(L.next)}">&#8250;</button></div>`,
    `<script>\n${JS}\n</script>`,
  ].join('\n');

  return { html, L, ld };
}

function checks(locale, html, L, ld) {
  const problems = [];
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ');
  if (L.metaTitle.length > 65) problems.push(`meta_title ${L.metaTitle.length} > 65`);
  if (L.metaDescript.length > 160) problems.push(`meta_descript ${L.metaDescript.length} > 160`);
  if (!Array.isArray(L.keywords) || !L.keywords.length) problems.push('meta_keywords must be a non-empty array');
  if ((html.match(/<h1[\s>]/g) || []).length !== 1) problems.push('need exactly one <h1>');
  if (/Jost/i.test(html)) problems.push('Jost found');
  if (/3[- ]?week|98\s?%/i.test(text + L.sub)) problems.push('stale claim (3-week / 98%)');
  if (/free design(?! for)/i.test(text)) problems.push('bare "free design"');
  if (locale === 'us' && /€/.test(text)) problems.push('€ on the US page');
  for (const k of Object.keys(L)) if (typeof L[k] === 'string' && /\{[a-z]+\}/i.test(L[k]) && !['alt', 'imgName', 'imgDescription', 'statReviews'].includes(k)) problems.push(`unfilled placeholder in ${k}`);
  try { JSON.parse(JSON.stringify(ld[0])); } catch (e) { problems.push('JSON-LD: ' + e.message); }
  if (ld[0].mainEntity.numberOfItems !== photos.length) problems.push('numberOfItems mismatch');
  const imgs = (html.match(/<img src="/g) || []).length;
  if (imgs !== photos.length) problems.push(`tile images ${imgs} ≠ photos ${photos.length}`);
  const urls = new Set(photos.map(p => p.image));
  if (urls.size !== photos.length) problems.push('duplicate image URL in photos.json');
  for (const p of photos) if (!/^https:\/\//.test(p.image)) problems.push(`non-https image: ${p.team}`);
  return problems;
}

let bad = 0;
for (const locale of LOCALES) {
  const { html, L, ld } = build(locale);
  const problems = checks(locale, html, L, ld);
  const file = path.join(ROOT, 'cms', 'pages', locale, `${L.handle}.json`);
  if (!fs.existsSync(file)) { console.error(`❌ ${locale}: ${path.relative(ROOT, file)} missing — pull it first (Pull CMS Content, type page)`); bad++; continue; }
  const page = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (page.handle !== L.handle) { console.error(`❌ ${locale}: handle mismatch (${page.handle})`); bad++; continue; }
  if (problems.length) { console.error(`❌ ${locale}: ${problems.join('; ')}`); bad++; continue; }
  const before = { title: page.title, meta_title: page.meta_title, meta_descript: page.meta_descript, kw: (page.meta_keywords || []).length };
  page.title = L.title; page.meta_title = L.metaTitle; page.meta_descript = L.metaDescript; page.meta_keywords = L.keywords; page.content = html;
  if (!CHECK_ONLY) fs.writeFileSync(file, JSON.stringify(page, null, 2) + '\n', 'utf8');
  console.log(`✓ ${locale} ${L.handle}: ${photos.length} photos, ${html.length} chars, meta_title ${L.metaTitle.length}/65, meta_descript ${L.metaDescript.length}/160${CHECK_ONLY ? ' (check only)' : ''}`);
  if (process.env.SHOW_META) console.log(`    was: "${before.meta_title}" | keywords ${before.kw}`);
}
if (bad) { console.error(`\n${bad} locale(s) failed`); process.exit(1); }
