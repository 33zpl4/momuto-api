#!/usr/bin/env node
/**
 * Hero CTA check on the LIVE page's real theme CSS (the hero CSS lives in a separate pasted CMS block, not in this repo).
 * For each viewport: measure the buttons as currently live ("LIVE"), then replace .momuto-hero-ctas with the markup from the repo block
 * (pages/homepage/hero.<locale>.html) and measure again ("REPO"). Per element: text, size, lines, colours, border, and the WCAG contrast of
 * its text against the first non-transparent background behind it. Flags: wrapped label (>1 line), contrast < 4.5 (text) / < 3 (border).
 *   URL=https://www.momuto.com/ HERO_FILE=pages/homepage/hero.en.html node scripts/probe-hero-buttons.js
 */
const fs = require('fs');
const { chromium } = require('playwright');
const URL_ = process.env.URL || 'https://www.momuto.com/';
const FILE = process.env.HERO_FILE || 'pages/homepage/hero.en.html';
const src = fs.readFileSync(FILE, 'utf8');
const m = /<div class="momuto-hero-ctas">[\s\S]*?\n {12}<\/div>/.exec(src);
if (!m) throw new Error('no momuto-hero-ctas block found in ' + FILE);
const REPO_CTAS = m[0].replace(/^<div class="momuto-hero-ctas">/, '').replace(/<\/div>$/, '');
const VIEWPORTS = [[1440, 900], [1024, 800], [768, 900], [390, 844]];

function measure() {
  const lum = (c) => { const a = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(a[0]) + .7152 * f(a[1]) + .0722 * f(a[2]); };
  const ratio = (a, b) => { const A = lum(a), B = lum(b); return (Math.max(A, B) + .05) / (Math.min(A, B) + .05); };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; const n = c.match(/[\d.]+/g).map(Number); if (n.length < 4 || n[3] > .5) return c; } return 'rgb(255, 255, 255)'; };
  const box = document.querySelector('.momuto-hero-ctas');
  if (!box) return { error: 'no .momuto-hero-ctas on the page' };
  const cs = getComputedStyle(box), r = box.getBoundingClientRect();
  const out = { container: { w: Math.round(r.width), h: Math.round(r.height), display: cs.display, wrap: cs.flexWrap, gap: cs.gap, dir: cs.flexDirection }, items: [] };
  for (const a of box.querySelectorAll('a')) {
    const s = getComputedStyle(a), b = a.getBoundingClientRect();
    const lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.2;
    const inner = b.height - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom) - parseFloat(s.borderTopWidth) * 2;
    const bg = s.backgroundColor.match(/[\d.]+/g).map(Number)[3] === 0 ? bgOf(a.parentElement) : s.backgroundColor;
    out.items.push({ text: a.textContent.replace(/\s+/g, ' ').trim(), w: Math.round(b.width), h: Math.round(b.height), lines: Math.max(1, Math.round(inner / lh)),
      color: s.color, bg: s.backgroundColor, behind: bg, border: s.border.replace(/\s+/g, ' ').slice(0, 60), opacity: s.opacity, font: s.fontSize + ' ' + s.fontWeight,
      pad: s.padding, textContrast: +ratio(s.color, bg).toFixed(2), borderContrast: parseFloat(s.borderTopWidth) > 0 ? +ratio(s.borderTopColor, bgOf(a.parentElement)).toFixed(2) : null });
  }
  return out;
}

(async () => {
  const browser = await chromium.launch();
  let bad = 0;
  for (const [w, h] of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'en-GB' });
    const page = await ctx.newPage();
    await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3500);
    console.log(`\n===== ${w}x${h}`);
    for (const phase of ['LIVE', 'REPO']) {
      if (phase === 'REPO') await page.evaluate((html) => { document.querySelector('.momuto-hero-ctas').innerHTML = html; }, REPO_CTAS);
      await page.waitForTimeout(400);
      const r = await page.evaluate(measure);
      if (r.error) { console.log(`  ${phase}: ${r.error}`); break; }
      console.log(`  ${phase} container ${r.container.w}x${r.container.h} ${r.container.display} wrap=${r.container.wrap} gap=${r.container.gap} dir=${r.container.dir}`);
      for (const i of r.items) {
        const flags = [];
        if (i.lines > 1) flags.push(`WRAPS ${i.lines} lines`);
        if (i.textContrast < 4.5) flags.push(`LOW TEXT CONTRAST ${i.textContrast}`);
        if (i.borderContrast !== null && i.border.includes('solid') && i.borderContrast < 3 && i.bg.includes('0, 0, 0, 0')) flags.push(`LOW BORDER CONTRAST ${i.borderContrast}`);
        if (phase === 'REPO' && flags.length) bad++;
        console.log(`    "${i.text}" ${i.w}x${i.h} lines=${i.lines} color=${i.color} bg=${i.bg} behind=${i.behind} contrast=${i.textContrast} border=[${i.border}] pad=${i.pad} font=${i.font}${flags.length ? '  <<< ' + flags.join(', ') : ''}`);
      }
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`\nREPO problems: ${bad}`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e.message); process.exit(1); });
