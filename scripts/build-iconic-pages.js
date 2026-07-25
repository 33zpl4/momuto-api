'use strict';

/**
 * Build Iconic Series product pages from data.
 *
 *   node scripts/build-iconic-pages.js                 # every drop, every locale
 *   node scripts/build-iconic-pages.js --drop drop-02  # one drop
 *   node scripts/build-iconic-pages.js --lang en       # one locale
 *
 * Sources
 *   iconic-series/config.json            shared strings, drop labels, grid rule
 *   iconic-series/<drop>/<slug>.json     per-product data + localised copy
 *   iconic-series/page-template.html     the structure
 *   iconic-series/shared/product-details.<lang>.html
 *
 * Output: iconic-series/build/<drop>/<slug>.<lang>.html — static, crawlable
 * HTML for the product's "Détail" body. All CSS/behaviour is loaded once from
 * shared/iconic-content.js and deliberately NOT inlined per page.
 *
 * Nothing here deploys. Pushing pages to the stores is a separate, explicitly
 * dispatched step — see docs/iconic-series.md for why (RTP taught us that a
 * push-triggered deploy with no branch filter goes straight to live).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'iconic-series');
const BUILD = path.join(DIR, 'build');
const MOCKUP_ARTWORK = path.join(ROOT, 'mockups', 'artwork', 'iconic-series');

const config = JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8'));

function parseArgs(argv) {
  const args = { drop: null, lang: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--drop') args.drop = argv[++i];
    else if (argv[i] === '--lang') args.lang = argv[++i];
    else {
      console.error(`Unknown argument: ${argv[i]}`);
      process.exit(1);
    }
  }
  return args;
}

function loadDrop(drop) {
  const dir = path.join(DIR, drop);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => ({ ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), drop }))
    .sort((a, b) => a.number.localeCompare(b.number));
}

// The print sidecar (mockups/) and the page data both carry the accession
// number. One of them is a copy, so verify rather than trust: drop 01 shipped
// a page reading "IM-01" on the IM-05 product because nothing checked.
function crossCheckWithMockups(item) {
  const sidecar = path.join(MOCKUP_ARTWORK, item.drop, `${item.slug}.json`);
  if (!fs.existsSync(sidecar)) return null;
  const print = JSON.parse(fs.readFileSync(sidecar, 'utf8'));
  const normalise = s => String(s).replace(/[–—]/g, '-').toUpperCase();
  if (normalise(print.number) !== normalise(item.number)) {
    throw new Error(
      `${item.drop}/${item.slug}: number mismatch — page says "${item.number}", ` +
      `print sidecar says "${print.number}"`
    );
  }
  return print;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function titleCase(s) {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function buildSeriesCards(all, current, lang) {
  const gridDrop = config.series_grid_drop;
  const siblings = all.filter(p => p.drop === gridDrop && p.handle !== current.handle);
  if (!siblings.length) return { html: '', missingImages: [] };

  const missingImages = siblings.filter(p => !p.image).map(p => p.slug);
  const html = siblings.map(p => {
    const name = escapeHtml(p.display_title);
    const img = p.image
      ? `<img loading="lazy" src="${p.image}" alt="${name}">`
      : `<!-- TODO image for ${p.slug}: upload the mockup to the CMS, then set "image" in iconic-series/${p.drop}/${p.slug}.json -->`;
    return [
      `        <a href="/products/${p.handle}" class="series-card">`,
      `          <div class="series-card-image">${img}</div>`,
      `          <div class="series-card-ref">${escapeHtml(p.number)}</div>`,
      `          <div class="series-card-name">${name}</div>`,
      `          <div class="series-card-price">${escapeHtml(config.price)}</div>`,
      `        </a>`,
    ].join('\n');
  }).join('\n');

  return { html, missingImages };
}

function renderPage(item, all, lang) {
  const strings = config.strings[lang];
  if (!strings) throw new Error(`no strings for locale "${lang}" in config.json`);
  const copy = item.page?.[lang];
  if (!copy || !copy.moment_body) {
    throw new Error(`${item.drop}/${item.slug}: no ${lang} copy yet (moment_body is empty)`);
  }

  const dropCfg = config.drops[item.drop];
  const detailsPath = path.join(DIR, 'shared', `product-details.${lang}.html`);
  if (!fs.existsSync(detailsPath)) {
    throw new Error(`missing shared/product-details.${lang}.html`);
  }

  const details = fs.readFileSync(detailsPath, 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '') // authoring notes stay in source, not output
    .replace(/\{\{NUMBER\}\}/g, escapeHtml(item.number))
    .replace(/\{\{EDITION\}\}/g, escapeHtml(dropCfg.edition[lang] || dropCfg.edition.en))
    .trim()
    .split('\n').map(l => (l.trim() ? '        ' + l : l)).join('\n');

  const bannerSubtitle = strings.banner_subtitle
    .replace('{{NUMBER}}', escapeHtml(item.number))
    .replace('{{DROP_BLURB}}', config.drop_blurbs[lang][item.drop]);

  const cards = buildSeriesCards(all, item, lang);

  const html = fs.readFileSync(path.join(DIR, 'page-template.html'), 'utf8')
    .replace(/\{\{LANG\}\}/g, lang)
    .replace(/\{\{CART_LABEL\}\}/g, strings.cart_label || 'ADD TO CART')
    .replace(/\{\{DROP_LABEL\}\}/g, dropCfg.label)
    .replace(/\{\{DROP_LABEL_TITLECASE\}\}/g, titleCase(dropCfg.label))
    .replace(/\{\{TITLE\}\}/g, escapeHtml(item.display_title))
    .replace(/\{\{BANNER_SUBTITLE\}\}/g, bannerSubtitle)
    .replace(/\{\{PRODUCT_DETAILS\}\}/g, details)
    .replace(/\{\{NUMBER\}\}/g, escapeHtml(item.number))
    .replace(/\{\{MOMENT_LABEL_SUFFIX\}\}/g, strings.moment_label_suffix)
    .replace(/\{\{MOMENT_TITLE\}\}/g, copy.moment_title) // trusted HTML: carries <em>
    .replace(/\{\{MOMENT_BODY\}\}/g, escapeHtml(copy.moment_body))
    .replace(/\{\{L_TECHNIQUE\}\}/g, strings.detail_technique)
    .replace(/\{\{TECHNIQUE\}\}/g, escapeHtml(copy.technique))
    .replace(/\{\{L_SERIES\}\}/g, strings.detail_series)
    .replace(/\{\{SERIES_NAME\}\}/g, strings.series_name)
    .replace(/\{\{L_EDITION\}\}/g, strings.detail_edition)
    .replace(/\{\{L_FORMAT\}\}/g, strings.detail_format)
    .replace(/\{\{FORMAT_VALUE\}\}/g, strings.format_value)
    .replace(/\{\{SERIES_LABEL\}\}/g, strings.series_label)
    .replace(/\{\{SERIES_HEADING\}\}/g, strings.series_heading)
    .replace(/\{\{SERIES_CARDS\}\}/g, cards.html)
    .replace(/\{\{COLLECTION_HANDLE\}\}/g, config.collection_handle)
    .replace(/\{\{BACK_LINK\}\}/g, strings.back_to_top)
    ;

  const left = html.match(/\{\{[A-Z_]+\}\}/g);
  if (left) throw new Error(`${item.slug}.${lang}: unfilled placeholders ${[...new Set(left)].join(', ')}`);

  return { html, missingImages: cards.missingImages };
}

// ── Collection page ──────────────────────────────────────────────────────────

/**
 * One collection page per drop per locale, generated from the same product
 * data as the product pages. Drop 01's copy is reproduced verbatim from the
 * live page so regenerating it changes nothing that already ranks.
 *
 * Self-contained HTML with inline <style> — this is a CMS *page*, with no
 * template to hang a script tag on, and a <style> injected via innerHTML does
 * apply (unlike <script>).
 */
function renderCollection(drop, items, lang) {
  const dropCfg = config.drops[drop];
  const coll = dropCfg.collection;
  if (!coll) throw new Error(`no collection config for ${drop}`);
  const copy = coll.copy[lang];
  if (!copy) throw new Error(`no ${lang} collection copy for ${drop}`);
  const strings = config.strings[lang];

  const mine = items.filter(p => p.drop === drop);
  const missing = [];

  const cards = mine.map(p => {
    if (!p.image || !p.image_front) missing.push(`${p.slug} (${!p.image ? 'back' : 'front'})`);
    const name = escapeHtml(p.display_title);
    return [
      `    <div class="product-card">`,
      `      <div class="card-image">`,
      `        <div class="swap">`,
      `          <img class="back" loading="lazy" src="${p.image || ''}" alt="${name} – ${escapeHtml(strings.detail_series)}">`,
      `          <img class="front" loading="lazy" src="${p.image_front || ''}" alt="${name}">`,
      `        </div>`,
      `      </div>`,
      `      <div class="card-meta">`,
      `        <div>`,
      `          <div class="card-ref">${escapeHtml(p.number)}</div>`,
      `          <div class="card-name"><a href="/products/${p.handle}" class="card-name-link">${name}</a></div>`,
      `        </div>`,
      `        <div class="card-price">${escapeHtml(config.price)}</div>`,
      `      </div>`,
      `    </div>`,
    ].join('\n');
  }).join('\n');

  const archive = mine.map(p => {
    const status = p.archive_status === 'signature' ? strings.status_signature : strings.status_available;
    return `      <div class="archive-item"><span class="archive-ref">${escapeHtml(p.number)}</span> ` +
      `<span class="archive-name">${escapeHtml(p.display_title)}</span> ` +
      `<span class="archive-status">${escapeHtml(status)}</span></div>`;
  }).join('\n');

  const other = Object.keys(config.drops).find(d => d !== drop);
  const otherHandle = config.drops[other]?.collection?.handle || config.collection_handle;

  const html = fs.readFileSync(path.join(DIR, 'collection-template.html'), 'utf8')
    .replace(/\{\{HERO_EYEBROW\}\}/g, escapeHtml(copy.eyebrow))
    .replace(/\{\{HERO_TITLE_1\}\}/g, escapeHtml(copy.t1))
    .replace(/\{\{HERO_TITLE_2\}\}/g, escapeHtml(copy.t2))
    .replace(/\{\{HERO_SUB\}\}/g, escapeHtml(copy.sub))
    .replace(/\{\{HERO_CTA\}\}/g, escapeHtml(copy.cta))
    .replace(/\{\{INTRO_LABEL\}\}/g, escapeHtml(copy.intro_label))
    .replace(/\{\{INTRO_HEADING\}\}/g, copy.intro_heading) // trusted: carries <br>/<em>
    .replace(/\{\{INTRO_BODY\}\}/g, escapeHtml(copy.intro_body))
    .replace(/\{\{INTRO_NO_IMAGE\}\}/g, coll.intro_image ? '' : ' no-image')
    .replace(/\{\{INTRO_IMAGE\}\}/g, coll.intro_image
      ? `<img src="${coll.intro_image}" alt="${escapeHtml(copy.eyebrow)}">`
      : '')
    .replace(/\{\{PRODUCT_CARDS\}\}/g, cards)
    .replace(/\{\{SYSTEM_LABEL\}\}/g, escapeHtml(strings.series_label))
    .replace(/\{\{SYSTEM_TITLE\}\}/g, copy.system_title) // trusted: carries <br>/<em>
    .replace(/\{\{ARCHIVE_ITEMS\}\}/g, archive)
    .replace(/\{\{OTHER_DROP_URL\}\}/g, `/collections/${otherHandle}`)
    .replace(/\{\{OTHER_DROP_LABEL\}\}/g, escapeHtml(strings.other_drop));

  const left = html.match(/\{\{[A-Z_0-9]+\}\}/g);
  if (left) throw new Error(`collection ${drop}.${lang}: unfilled ${[...new Set(left)].join(', ')}`);
  return { html, missing };
}

// ── Main ─────────────────────────────────────────────────────────────────────

const args = parseArgs(process.argv);
const drops = args.drop ? [args.drop] : Object.keys(config.drops);
const langs = args.lang ? [args.lang] : config.locales;

const all = drops.flatMap(loadDrop);
if (!all.length) {
  console.error('No product data found under iconic-series/<drop>/');
  process.exit(1);
}
all.forEach(crossCheckWithMockups);

let written = 0, skipped = 0, failed = 0;
const missingImages = new Set();

for (const item of all) {
  for (const lang of langs) {
    try {
      const { html, missingImages: mi } = renderPage(item, all, lang);
      mi.forEach(s => missingImages.add(s));
      const out = path.join(BUILD, item.drop, `${item.slug}.${lang}.html`);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, html);
      console.log(`✓ ${path.relative(ROOT, out)}`);
      written++;
    } catch (err) {
      if (/no \w+ copy yet|no strings for locale|missing shared\/product-details/.test(err.message)) {
        console.log(`· skipped ${item.slug}.${lang} — ${err.message.replace(/^.*?: /, '')}`);
        skipped++;
      } else {
        console.error(`✗ ${item.slug}.${lang}: ${err.message}`);
        failed++;
      }
    }
  }
}

// Collection pages: one per drop per locale, from the same data.
for (const drop of drops) {
  for (const lang of langs) {
    try {
      const { html, missing } = renderCollection(drop, all, lang);
      missing.forEach(m => missingImages.add(m));
      const out = path.join(BUILD, 'collection', `${drop}.${lang}.html`);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, html);
      console.log(`✓ ${path.relative(ROOT, out)}`);
      written++;
    } catch (err) {
      if (/no \w+ collection copy|no collection config/.test(err.message)) { skipped++; }
      else { console.error(`✗ collection ${drop}.${lang}: ${err.message}`); failed++; }
    }
  }
}

console.log(`\n${written} written, ${skipped} skipped, ${failed} failed`);
if (missingImages.size) {
  console.log(`\n⚠ series-grid images not set yet: ${[...missingImages].join(', ')}`);
  console.log('  Upload the mockups to the CMS, then set "image" in each product JSON and rebuild.');
}
if (failed) process.exit(1);
