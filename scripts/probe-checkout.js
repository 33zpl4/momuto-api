'use strict';
/**
 * READ-ONLY probe of the checkout path on all five stores (www, us, es, fr, it), desktop + phone. Run by .github/workflows/probe-checkout.yml on a GitHub
 * runner (the sandbox cannot reach the stores). Anonymous throwaway browser: home -> a public product -> add to cart -> /cart -> click the checkout
 * button -> record where it lands and whether that page really loaded. It STOPS there: nothing is typed, no payment or order is submitted.
 * Per run it records: the landing URL, HTTP status of the document, visible form fields / pay buttons, console + page errors, failed or 4xx/5xx requests,
 * slow requests, and a screenshot. Also loads design.momuto.com (/ and /cart) with the same error capture.
 * Output: probe-checkout-out/<store>-<viewport>.json + screenshots, summary + a PASS/FAIL table at the end of the log. Docs: docs/verification-map.md.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const OUT = path.join(__dirname, '..', 'probe-checkout-out'); fs.mkdirSync(OUT, { recursive: true });
const STORES = [['www', 'https://www.momuto.com'], ['us', 'https://us.momuto.com'], ['es', 'https://es.momuto.com'], ['fr', 'https://fr.momuto.com'], ['it', 'https://it.momuto.com']];
const VIEWPORTS = [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]];
const ONLY = (process.env.PROBE_STORES || 'all').toLowerCase().split(',').map(s => s.trim());
const ADD_RE = /add to (cart|bag)|añadir al (carrito|cesta)|agregar al carrito|ajouter au panier|aggiungi al carrello/i;
const CHECKOUT_RE = /check ?out|proceed|place order|pay now|finalizar|tramitar|pagar|commander|passer la commande|paiement|procedi|cassa|ordina/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const NOISE = /google-analytics|googletagmanager|doubleclick|facebook|fbevents|clarity\.ms|hotjar|tiktok|pinterest|trustpilot|analytics|sentry|gtag/i;

function watch(page, rep) {
  rep.console = []; rep.pageErrors = []; rep.badRequests = []; rep.slow = [];
  const t0 = new Map();
  page.on('console', m => { if (m.type() === 'error') rep.console.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => rep.pageErrors.push(String(e.message).slice(0, 200)));
  page.on('request', r => t0.set(r, Date.now()));
  page.on('requestfailed', r => { if (!NOISE.test(r.url())) rep.badRequests.push(`FAILED ${r.url().slice(0, 140)} ${(r.failure() || {}).errorText || ''}`); });
  page.on('response', r => {
    const u = r.url(), s = r.status(), ms = Date.now() - (t0.get(r.request()) || Date.now());
    if (s >= 400 && !NOISE.test(u)) rep.badRequests.push(`${s} ${u.slice(0, 140)}`);
    if (ms > 6000 && !NOISE.test(u)) rep.slow.push(`${ms}ms ${u.slice(0, 120)}`);
  });
}
const pageFacts = () => ({
  url: location.href, title: document.title, textLen: (document.body.innerText || '').trim().length,
  text: (document.body.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 500),
  inputs: [...document.querySelectorAll('input:not([type=hidden]), select, textarea')].filter(e => e.getBoundingClientRect().width > 0).length,
  payButtons: [...document.querySelectorAll('button, input[type=submit], a')].filter(e => e.getBoundingClientRect().width > 0 && /pay|place order|complete|continue|pagar|payer|paga|continuar|continuer|continua/i.test((e.innerText || e.value || '').trim())).slice(0, 5).map(e => (e.innerText || e.value || '').trim().slice(0, 40)),
  hScroll: document.documentElement.scrollWidth > innerWidth + 1,
});

(async () => {
  const browser = await chromium.launch();
  const table = [];
  for (const [key, base] of STORES) {
    if (!(ONLY.includes('all') || ONLY.includes(key))) continue;
    for (const [vp, size] of VIEWPORTS) {
      const tag = `${key}-${vp}`, rep = { store: key, viewport: vp, steps: [] };
      const ctx = await browser.newContext({ viewport: size, isMobile: vp === 'phone', locale: 'en-GB' });
      const page = await ctx.newPage(); watch(page, rep);
      const step = (n, ok, note) => { rep.steps.push({ n, ok, note }); };
      try {
        const home = await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(2500);
        step('home', !!home && home.status() < 400, `HTTP ${home && home.status()}`);
        const prod = await page.evaluate(() => { const a = [...document.querySelectorAll('a[href*="/products/"]')].map(a => a.getAttribute('href')).filter(h => /\/products\//.test(h) && !/fast.?lane/i.test(h)); return a[0] || null; });
        if (!prod) throw new Error('no product link on the home page');
        const pr = await page.goto(new URL(prod, base).href, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(3000);
        step('product', pr.status() < 400, `${prod} HTTP ${pr.status()}`);
        await page.evaluate(() => { document.querySelectorAll('[class*=variant] [class*=item]:not([class*=disabled]):not([class*=active]), [class*=sku] [class*=item]:not([class*=disabled]):not([class*=active]), [class*=option] li:not([class*=disabled]):not([class*=active])').forEach((e, i) => { if (i < 3) e.click(); }); });
        await sleep(600);
        const btn = page.locator('button, a, div[role=button], [class*=btn], [class*=button]').filter({ hasText: ADD_RE }).first();
        if (!await btn.count()) throw new Error('no add-to-cart button on the product page');
        await btn.scrollIntoViewIfNeeded().catch(() => {}); await btn.click({ timeout: 8000 }); await sleep(2500);
        step('add to cart', true, 'clicked');
        const cr = await page.goto(base + '/cart', { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(3500);
        rep.cart = await page.evaluate(pageFacts);
        step('cart page', cr.status() < 400 && rep.cart.textLen > 80, `HTTP ${cr.status()}, ${rep.cart.textLen} chars of text`);
        await page.screenshot({ path: path.join(OUT, `${tag}-cart.png`), fullPage: true });
        const co = page.locator('button, a, input[type=submit], div[role=button], [class*=btn], [class*=button]').filter({ hasText: CHECKOUT_RE }).filter({ visible: true }).first();
        if (!await co.count()) throw new Error('no checkout button on /cart');
        rep.checkoutButton = (await co.innerText().catch(() => '')).trim().slice(0, 40);
        await co.scrollIntoViewIfNeeded().catch(() => {});
        const nav = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
        await co.click({ timeout: 8000 }); const resp = await nav; await sleep(5000);
        rep.landing = await page.evaluate(pageFacts);
        rep.landingStatus = resp ? resp.status() : null;
        const loaded = rep.landing.textLen > 80 && (rep.landing.inputs > 0 || rep.landing.payButtons.length > 0) && !(resp && resp.status() >= 400);
        step('checkout page', loaded, `${rep.landing.url.slice(0, 90)} | HTTP ${rep.landingStatus} | ${rep.landing.inputs} inputs | buttons ${JSON.stringify(rep.landing.payButtons)}`);
        await page.screenshot({ path: path.join(OUT, `${tag}-checkout.png`), fullPage: true });
      } catch (e) { rep.error = e.message.slice(0, 200); step('ERROR', false, rep.error); await page.screenshot({ path: path.join(OUT, `${tag}-error.png`) }).catch(() => {}); }
      fs.writeFileSync(path.join(OUT, `${tag}.json`), JSON.stringify(rep, null, 1));
      const ok = rep.steps.every(s => s.ok);
      table.push(`${ok ? 'PASS' : 'FAIL'} ${tag.padEnd(14)} ${rep.steps.map(s => (s.ok ? 'ok ' : 'XX ') + s.n).join(' > ')} | console errors ${rep.console.length} | page errors ${rep.pageErrors.length} | bad requests ${rep.badRequests.length} | slow ${rep.slow.length}`);
      if (!ok) table.push('     ' + rep.steps.filter(s => !s.ok).map(s => s.n + ': ' + s.note).join(' ; '));
      await ctx.close();
    }
  }
  // the 3D designer host (cart lives there for custom designs)
  if (ONLY.includes('all') || ONLY.includes('design')) for (const [vp, size] of VIEWPORTS) {
    const tag = `design-${vp}`, rep = { store: 'design', viewport: vp, steps: [] };
    const ctx = await browser.newContext({ viewport: size, isMobile: vp === 'phone', locale: 'en-GB' }); const page = await ctx.newPage(); watch(page, rep);
    try {
      for (const u of ['https://design.momuto.com/', 'https://design.momuto.com/cart']) {
        const r = await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(5000);
        const f = await page.evaluate(pageFacts);
        rep.steps.push({ n: u.replace('https://design.momuto.com', 'design') || 'design/', ok: r.status() < 400 && f.textLen > 20, note: `HTTP ${r.status()} ${f.textLen} chars | ${f.text.slice(0, 80)}` });
        await page.screenshot({ path: path.join(OUT, `${tag}-${u.endsWith('cart') ? 'cart' : 'home'}.png`) });
      }
    } catch (e) { rep.steps.push({ n: 'ERROR', ok: false, note: e.message.slice(0, 200) }); }
    fs.writeFileSync(path.join(OUT, `${tag}.json`), JSON.stringify(rep, null, 1));
    table.push(`${rep.steps.every(s => s.ok) ? 'PASS' : 'FAIL'} ${tag.padEnd(14)} ${rep.steps.map(s => (s.ok ? 'ok ' : 'XX ') + s.n).join(' > ')} | bad requests ${rep.badRequests.length}`);
    await ctx.close();
  }
  await browser.close();
  console.log('\n===== CHECKOUT PROBE =====\n' + table.join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
