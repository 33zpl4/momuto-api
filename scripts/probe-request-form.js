'use strict';
/**
 * probe-request-form.js — walks the paid custom-design brief form on all five stores like a customer, WITHOUT submitting:
 * ?paid=true → step 1 (name, email, team, league) → NEXT → step 2 (badge upload, colour picker, style) → CONTINUE → step 3 (terms) → SUBMIT.
 * The POST to /api/submit and the redirect page are intercepted (fulfilled locally), so no lead, email or CMS write happens.
 * Reports per store × viewport: inject markers left in the HTML, step script present, each step reached, colour modal, submit fired + fields.
 * Screenshots: probe-out/<store>-<vp>-<step>.png. Exit 1 if any store fails.  Env: STORES=en,us,es,fr,it (default all)
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const PAGES = {
  en: 'https://www.momuto.com/pages/request-custom-kit-design',
  us: 'https://us.momuto.com/pages/request-custom-kit-design',
  es: 'https://es.momuto.com/pages/solicitud-de-diseno-personalizado',
  fr: 'https://fr.momuto.com/pages/demande-de-design-professionnel-de-maillots',
  it: 'https://it.momuto.com/pages/richiesta-design-personalizzato',
};
const VPS = { desktop: { width: 1366, height: 900 }, mobile: { width: 390, height: 844, isMobile: true, hasTouch: true } };
const OUT = 'probe-out'; fs.mkdirSync(OUT, { recursive: true });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const crest = path.join(OUT, 'crest.png'); fs.writeFileSync(crest, PNG);
const stores = (process.env.STORES || 'en,us,es,fr,it').split(',').map(s => s.trim()).filter(Boolean);

async function walk(browser, store, vpName) {
  const vp = VPS[vpName];
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const r = { store, vp: vpName, steps: [], problems: [] };
  const errors = []; page.on('pageerror', e => errors.push(e.message.slice(0, 140)));
  let submitted = null;
  await page.route(/momuto-api\.vercel\.app\/api\/submit/, async (route) => {
    const req = route.request(); const body = req.postData() || '';
    const names = [...new Set([...body.matchAll(/name="([^"]+)"/g)].map(m => m[1]))];
    submitted = { method: req.method(), fields: names };
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"probe":true}' });
  });
  await page.route(/customized-design-confirmed|diseno-personalizado-confirmado|design-confirme|design-confermato/, r2 => r2.fulfill({ status: 200, contentType: 'text/html', body: '<h1>probe: redirect reached</h1>' }));
  await page.route(/momuto-api\.vercel\.app\/api\/(lead|track|beacon)/, r2 => r2.fulfill({ status: 204, body: '' }));
  const shot = (n) => page.screenshot({ path: path.join(OUT, `${store}-${vpName}-${n}.png`), fullPage: false }).catch(() => {});
  try {
    await page.goto(PAGES[store] + '?paid=true', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3500);
    const html = await page.content();
    r.markers = (html.match(/<!-- inject:[^>]+-->/g) || []);
    if (r.markers.length) r.problems.push('inject markers still in the page (step script/CSS not injected): ' + r.markers.join(' '));
    r.stepScript = await page.evaluate(() => typeof window.nextStep === 'function' && typeof window.openColorModal === 'function');
    if (!r.stepScript) r.problems.push('nextStep/openColorModal not defined (no step script)');
    const formVisible = await page.isVisible('#brief-form-section');
    if (!formVisible) { r.problems.push('brief form not visible with ?paid=true'); await shot('0-noform'); return r; }
    await page.locator('#step1').scrollIntoViewIfNeeded();
    await page.fill('#customerName', 'Probe Test'); await page.fill('#customerEmail', 'probe@example.com');
    await page.fill('#teamName', 'Probe FC'); await page.fill('#leagueName', 'Probe League');
    await shot('1-details');
    await page.click('#step1 .next-step');
    await page.waitForTimeout(800);
    if (!(await page.evaluate(() => document.getElementById('step2').classList.contains('active') && document.getElementById('step2').offsetParent !== null))) { r.problems.push('NEXT STEP did not open step 2 (Style)'); await shot('2-stuck'); return r; }
    r.steps.push('step2');
    // the badge is required by validateCurrentStep — check CONTINUE refuses without it, then upload
    await page.click('#step2 .next-step'); await page.waitForTimeout(400);
    r.badgeRequired = await page.evaluate(() => document.getElementById('step2').classList.contains('active'));
    r.afterNoBadge = await page.evaluate(() => ['step1','step2','step3'].map(id => { const e = document.getElementById(id); return id + ':' + (e.classList.contains('active') ? 'A' : '-') + (e.offsetParent ? 'V' : 'h'); }).join(' ')
      + ' crestInValidator=' + (typeof validateCurrentStep === 'function' && /clubCrest/.test(validateCurrentStep.toString()))
      + ' circleVisible=' + !!(document.getElementById('primaryColorCircle') || {}).offsetParent
      + ' modalAt=' + (() => { const c = document.getElementById('primaryColorCircle'); if (!c) return 'none'; const b = c.getBoundingClientRect(); const top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return top ? (top.id || top.className || top.tagName).toString().slice(0, 40) : 'offscreen'; })());
    if (!r.badgeRequired && await page.evaluate(() => document.getElementById('step3').classList.contains('active'))) { await page.click('#step3 .prev-step'); await page.waitForTimeout(500); }
    await page.setInputFiles('#clubCrest', crest);
    await page.locator('#primaryColorCircle').scrollIntoViewIfNeeded(); r.circleTop = await page.evaluate(() => { const c = document.getElementById('primaryColorCircle'); const b = c.getBoundingClientRect(); const t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return t ? (t.id || String(t.className) || t.tagName).slice(0, 60) : 'none'; }); await page.click('#primaryColorCircle', { timeout: 8000 }); await page.waitForTimeout(300);
    const modal = await page.isVisible('#colorModal');
    if (!modal) r.problems.push('colour picker did not open');
    else { await page.locator('#colorSwatches .color-swatch').nth(2).click(); await page.waitForTimeout(200); r.primaryColor = await page.inputValue('#primaryColorValue'); if (r.primaryColor.toLowerCase() !== '#0000ff') r.problems.push('colour not applied: ' + r.primaryColor); }
    await page.locator('#stylePreference').fill('8').catch(() => {});
    await shot('2-style');
    await page.click('#step2 .next-step'); await page.waitForTimeout(800);
    if (!(await page.evaluate(() => document.getElementById('step3').classList.contains('active')))) { r.problems.push('CONTINUE did not open step 3 (Submit)'); await shot('3-stuck'); return r; }
    r.steps.push('step3');
    await page.check('#termsAccept');
    await shot('3-submit');
    await Promise.all([page.waitForLoadState('domcontentloaded').catch(() => {}), page.click('#step3 .submit-form')]);
    await page.waitForTimeout(3000);
    r.submit = submitted;
    if (!submitted) r.problems.push('SUBMIT BRIEF sent nothing to /api/submit');
    else { r.steps.push('submit'); for (const f of ['firstname', 'email', 'company', 'upload_file', 'primaryColorValue', 'stylePreference']) if (!submitted.fields.includes(f)) r.problems.push('submit missing field ' + f); }
    await shot('4-after');
  } catch (e) { r.problems.push('error: ' + e.message.slice(0, 160)); await shot('x-error'); }
  finally { r.jsErrors = errors.slice(0, 5); await ctx.close(); }
  return r;
}

(async () => {
  const browser = await chromium.launch();
  const all = [];
  for (const s of stores) for (const v of Object.keys(VPS)) {
    const r = await walk(browser, s, v); all.push(r);
    console.log(`${r.problems.length ? '❌' : '✅'} ${s.padEnd(2)} ${v.padEnd(7)} steps=${r.steps.join('>') || '-'} badgeRequired=${r.badgeRequired} colour=${r.primaryColor || '-'} submitFields=${r.submit ? r.submit.fields.length : 0}`);
    r.problems.forEach(p => console.log('     · ' + p)); if (r.afterNoBadge) console.log('     state: ' + r.afterNoBadge + ' circleTop=' + r.circleTop);
    if (r.jsErrors.length) console.log('     js errors: ' + r.jsErrors.join(' | '));
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(all, null, 2));
  const bad = all.filter(r => r.problems.length).length;
  console.log(`\n${bad ? 'FAIL' : 'PASS'}: ${all.length - bad}/${all.length} store×viewport walks completed the form`);
  process.exit(bad ? 1 : 0);
})();
