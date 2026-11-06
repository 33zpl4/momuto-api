#!/usr/bin/env node
/**
 * Blog integrity check (6 Nov 2026). Two bugs found in localized posts:
 *  1. FAQPage JSON-LD that does not match the visible FAQ (left in English after translation, or describing
 *     questions that are not on the page). Google ignores/penalizes FAQ markup for invisible content and LLMs read
 *     the wrong language. Fix: regenerate the JSON-LD from the post's visible FAQ (details/summary, h3 + answer,
 *     or <p><strong>Q</strong><br>A</p>).
 *  2. ES/FR/IT posts linking to /blogs/<english-handle>, which does not exist on that store (404). Fix: map via
 *     BLOG_CLUSTERS (scripts/rebuild-sitemap.js) to the locale's handle; with no translation, link the English post
 *     absolutely (https://www.momuto.com/blogs/<handle>). US is not link-checked (the US store has live posts that
 *     are not in the repo).
 * Usage: node scripts/check-blog-integrity.js          (check, exit 1 on any problem)
 *        node scripts/check-blog-integrity.js --write  (fix what can be fixed mechanically, report the rest)
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const WRITE = process.argv.includes('--write');
const LOCALES = ['en', 'us', 'es', 'fr', 'it'];

function clusters() {
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'rebuild-sitemap.js'), 'utf8');
  const block = src.slice(src.indexOf('const BLOG_CLUSTERS'), src.indexOf('];', src.indexOf('const BLOG_CLUSTERS')));
  return [...block.matchAll(/\{([^}]*)\}/g)].map(m => Object.fromEntries([...m[1].matchAll(/(en|us|es|fr|it):\s*'([^']+)'/g)].map(x => [x[1], x[2]])));
}
const files = (l) => { const d = l === 'en' ? path.join(ROOT, 'blogs') : path.join(ROOT, 'blogs', l); return fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.json')).map(f => path.join(d, f)) : []; };
const ent = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', euro: '€', middot: '·', hellip: '…', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };
const unent = (t) => t.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ent[e.toLowerCase()] ?? m));
const strip = (t) => unent(t.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function visibleFaq(c, scriptAt, n) {
  const before = c.slice(0, scriptAt);
  const h2s = [...before.matchAll(/<h2[^>]*>[\s\S]*?<\/h2>/g)];
  for (let i = h2s.length - 1; i >= 0 && i >= h2s.length - 4; i--) {
    let seg = before.slice(h2s[i].index + h2s[i][0].length);
    const nx = seg.search(/<h2[^>]*>/); if (nx >= 0) seg = seg.slice(0, nx);
    const cut = seg.search(/<p style="margin-top:28px">|<div class="cta-card"/); if (cut >= 0) seg = seg.slice(0, cut);
    let qa = [...seg.matchAll(/<details[^>]*>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)].map(m => [strip(m[1]), strip(m[2])]);
    if (!qa.length) { const p = seg.split(/<h3[^>]*>([\s\S]*?)<\/h3>/); for (let k = 1; k + 1 < p.length; k += 2) qa.push([strip(p[k]), strip(p[k + 1])]); }
    if (!qa.length) qa = [...seg.matchAll(/<p[^>]*>\s*<strong>([\s\S]*?)<\/strong>\s*<br\s*\/?>([\s\S]*?)<\/p>/g)].map(m => [strip(m[1]), strip(m[2])]);
    qa = qa.filter(([q, a]) => q && a);
    if (qa.length && (qa.length === n || i === h2s.length - 1 && qa.length >= 2)) return qa;
  }
  return [];
}

const C = clusters();
const have = Object.fromEntries(LOCALES.map(l => [l, new Set(files(l).map(f => path.basename(f, '.json')))]));
const problems = []; let fixed = 0;
for (const l of LOCALES) {
  for (const f of files(l)) {
    const rel = path.relative(ROOT, f);
    const post = JSON.parse(fs.readFileSync(f, 'utf8'));
    let c = post.content || ''; const orig = c;
    // 1. FAQ JSON-LD vs visible FAQ
    c = c.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (whole, body, at) => {
      let d; try { d = JSON.parse(body); } catch (e) { problems.push(`${rel}: JSON-LD does not parse`); return whole; }
      if (d['@type'] !== 'FAQPage') return whole;
      const visText = strip(c.replace(/<script[\s\S]*?<\/script>/g, ''));
      const names = (d.mainEntity || []).map(q => strip(q.name || ''));
      const missing = names.filter(nm => !visText.includes(nm));
      if (!missing.length) return whole;
      const vis = visibleFaq(c, at, names.length);
      if (!vis.length) { problems.push(`${rel}: FAQPage JSON-LD (${names.length} questions) has no matching visible FAQ — add one or remove the markup`); return whole; }
      problems.push(`${rel}: FAQPage JSON-LD did not match the visible FAQ (${missing.length}/${names.length}, e.g. "${missing[0].slice(0, 50)}")${WRITE ? ' → regenerated from the visible FAQ' : ''}`);
      fixed += WRITE ? 1 : 0;
      return '<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: vis.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }) + '</script>';
    });
    // 2. localized internal blog links
    if (['es', 'fr', 'it'].includes(l)) {
      c = c.replace(/href="\/blogs\/([a-z0-9-]+)"/g, (whole, h) => {
        if (have[l].has(h) || C.some(cl => cl[l] === h)) return whole;
        const cl = C.find(x => Object.values(x).includes(h));
        const to = cl && cl[l] ? `/blogs/${cl[l]}` : (have.en.has(h) || (cl && cl.en) ? `https://www.momuto.com/blogs/${cl && cl.en || h}` : null);
        problems.push(`${rel}: link /blogs/${h} does not exist on the ${l} store${to ? (WRITE ? ` → ${to}` : ` (fix: ${to})`) : ' (no target found — fix by hand)'}`);
        if (WRITE && to) { fixed++; return `href="${to}"`; }
        return whole;
      });
    }
    if (WRITE && c !== orig) { post.content = c; fs.writeFileSync(f, JSON.stringify(post, null, 2) + '\n'); }
  }
}
problems.forEach(p => console.log((WRITE && / → /.test(p) ? 'FIXED ' : 'FAIL  ') + p));
const left = problems.filter(p => !(WRITE && / → /.test(p))).length;
console.log(`\n${problems.length} problem(s)${WRITE ? `, ${fixed} fixed, ${left} left` : ''}.`);
process.exit(left ? 1 : 0);
