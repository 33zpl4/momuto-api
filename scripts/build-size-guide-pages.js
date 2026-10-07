'use strict';
/**
 * Size guide (EN/ES/FR/IT): size-guide/<locale> is the editable source fragment;
 * this writes it into the pulled CMS page object cms/pages/<locale>/<handle>.json
 * (content only — id, title and meta stay as pulled) so Deploy CMS Page ships it.
 * US keeps its own page (cms/pages/us/size-guide.json, edited directly).
 *
 * Usage: node scripts/build-size-guide-pages.js [en,es,fr,it]
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const PAGES = { en: 'size-guide', es: 'guia-tallas', fr: 'guide-des-tailles', it: 'guida-alle-taglie' };
const only = (process.argv[2] || Object.keys(PAGES).join(',')).split(',');

for (const loc of only) {
  const handle = PAGES[loc];
  if (!handle) { console.error(`unknown locale ${loc}`); process.exit(1); }
  const src = path.join(ROOT, 'size-guide', loc);
  const out = path.join(ROOT, 'cms', 'pages', loc, `${handle}.json`);
  const content = fs.readFileSync(src, 'utf8');
  const page = JSON.parse(fs.readFileSync(out, 'utf8'));
  if (!page.id) throw new Error(`${out}: no id — pull the page first`);
  if ((content.match(/<h1\b/g) || []).length !== 1) throw new Error(`${loc}: expected exactly one <h1>`);
  if (/<td>176<\/td>/.test(content)) throw new Error(`${loc}: size 176 is not offered (factory maps it to adult S)`);
  if (!Array.isArray(page.meta_keywords)) throw new Error(`${loc}: meta_keywords must be an array`);
  const changed = page.content !== content;
  page.content = content;
  fs.writeFileSync(out, JSON.stringify(page, null, 2) + '\n');
  console.log(`${changed ? '✅' : '·'} ${loc}: ${handle} (${content.length} chars) → ${path.relative(ROOT, out)}`);
}
