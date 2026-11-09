#!/usr/bin/env node
/**
 * Hero CTA check on the LIVE page's real theme CSS (the hero CSS lives in a separate pasted CMS block, not in this repo).
 * Per store and viewport: measure the CTAs as currently live ("LIVE"), then inject the repo block's <style id="momuto-hero-cta-fix"> and its
 * .momuto-hero-ctas markup and measure again ("REPO"). The background behind each element is SAMPLED FROM THE RENDERED PIXELS (the hero's
 * dark background is not a plain background-color on any parent). Checks: label wraps (>1 line; >2 on phones), text contrast >= 4.5,
 * border contrast >= 3, and the hover state of .btn-outline.
 *   PAIRS="https://www.momuto.com/|pages/homepage/hero.en.html;https://es.momuto.com/|pages/homepage/hero.es.html" node scripts/probe-hero-buttons.js
 */
const fs = require('fs');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const PAIRS = (process.env.PAIRS || 'https://www.momuto.com/|pages/homepage/hero.en.html').split(';').map(x => x.trim()).filter(Boolean).map(x => x.split('|'));
const VIEWPORTS = [[1440, 900], [1024, 800], [768, 900], [390, 844], [360, 740]];

const parse = (c) => { const n = String(c).match(/[\d.]+/g).map(Number); return { r: n[0], g: n[1], b: n[2], a: n.length > 3 ? n[3] : 1 }; };
const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
const lum = (c) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
const ratio = (a, b) => { const A = lum(a), B = lum(b); return +((Math.max(A, B) + .05) / (Math.min(A, B) + .05)).toFixed(2); };
const hex = (c) => '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

function measureInPage() {
  const box = document.querySelector('.momuto-hero-ctas');
  if (!box) return { error: 'no .momuto-hero-ctas on the page' };
  box.scrollIntoView({ block: 'center' });
  const cs = getComputedStyle(box), r = box.getBoundingClientRect();
  const out = { container: { w: Math.round(r.width), h: Math.round(r.height), display: cs.display, wrap: cs.flexWrap, dir: cs.flexDirection }, items: [] };
  for (const a of box.querySelectorAll('a')) {
    const s = getComputedStyle(a), b = a.getBoundingClientRect();
    const lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.2;
    const inner = b.height - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom) - parseFloat(s.borderTopWidth) * 2;
    out.items.push({ text: a.textContent.replace(/\s+/g, ' ').trim(), cls: a.className, w: Math.round(b.width), h: Math.round(b.height), lines: Math.max(1, Math.round(inner / lh)),
      color: s.color, bg: s.backgroundColor, borderW: parseFloat(s.borderTopWidth), borderColor: s.borderTopColor, rect: { x: b.x, y: b.y, w: b.width, h: b.height } });
  }
  return out;
}

async function sample(page, rect) {
  const png = PNG.sync.read(await page.screenshot());
  const px = (x, y) => { x = Math.max(0, Math.min(png.width - 1, Math.round(x))); y = Math.max(0, Math.min(png.height - 1, Math.round(y))); const i = (png.width * y + x) * 4; return { r: png.data[i], g: png.data[i + 1], b: png.data[i + 2], a: 1 }; };
  const y = rect.y + rect.h / 2;
  return rect.x > 14 ? px(rect.x - 8, y) : px(rect.x + rect.w + 8, y);
}

(async () => {
  const browser = await chromium.launch();
  let bad = 0;
  for (const [url, file] of PAIRS) {
    const src = fs.readFileSync(file, 'utf8');
    const m = /<div class="momuto-hero-ctas">[\s\S]*?\n {12}<\/div>/.exec(src);
    if (!m) throw new Error('no momuto-hero-ctas block in ' + file);
    const html = m[0].replace(/^<div class="momuto-hero-ctas">/, '').replace(/<\/div>$/, '');
    const sm = /<style id="momuto-hero-cta-fix">([\s\S]*?)<\/style>/.exec(src);
    console.log(`\n########## ${url}  (${file}${sm ? ', with cta-fix style' : ', NO cta-fix style'})`);
    for (const [w, h] of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'en-GB' });
      const page = await ctx.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3500);
      console.log(`\n===== ${w}x${h}`);
      for (const phase of ['LIVE', 'REPO']) {
        if (phase === 'REPO') await page.evaluate(({ html, css }) => { if (css) { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); } document.querySelector('.momuto-hero-ctas').innerHTML = html; }, { html, css: sm ? sm[1] : '' });
        await page.waitForTimeout(500);
        const r = await page.evaluate(measureInPage);
        if (r.error) { console.log(`  ${phase}: ${r.error}`); break; }
        console.log(`  ${phase} container ${r.container.w}x${r.container.h} ${r.container.display} wrap=${r.container.wrap} dir=${r.container.dir}`);
        for (const i of r.items) {
          const behind = await sample(page, i.rect);
          const bg = parse(i.bg), solid = bg.a > .5;
          const under = solid ? blend(bg, behind) : behind;
          const flags = [];
          const maxLines = w <= 480 ? 2 : 1;
          if (i.lines > maxLines) flags.push(`WRAPS ${i.lines} lines`);
          const tc = ratio(blend(parse(i.color), under), under);
          if (tc < 4.5) flags.push(`LOW TEXT CONTRAST ${tc}`);
          let bc = null;
          if (i.borderW > 0 && !solid) { bc = ratio(blend(parse(i.borderColor), behind), behind); if (bc < 3) flags.push(`LOW BORDER CONTRAST ${bc}`); }
          let hover = '';
          if (/btn-outline/.test(i.cls)) {
            await page.hover('.momuto-hero-ctas a.btn-outline'); await page.waitForTimeout(450);
            const hv = await page.evaluate(() => { const a = document.querySelector('.momuto-hero-ctas a.btn-outline'), s = getComputedStyle(a); return { color: s.color, bg: s.backgroundColor }; });
            const hb = blend(parse(hv.bg), behind), hc = ratio(blend(parse(hv.color), hb), hb);
            hover = ` hover[text ${hex(blend(parse(hv.color), hb))} on ${hex(hb)} = ${hc}]`; if (hc < 4.5) flags.push(`LOW HOVER CONTRAST ${hc}`);
            await page.mouse.move(2, 2);
          }
          if (phase === 'REPO' && flags.length) bad++;
          console.log(`    "${i.text}" ${i.w}x${i.h} lines=${i.lines} text ${hex(parse(i.color))} on ${hex(under)} = ${tc}${bc !== null ? ` border ${bc}` : ''}${hover}${flags.length ? '  <<< ' + flags.join(', ') : ''}`);
        }
      }
      await ctx.close();
    }
  }
  await browser.close();
  console.log(`\nREPO problems: ${bad}`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e.message); process.exit(1); });
