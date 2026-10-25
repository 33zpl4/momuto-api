'use strict';
/**
 * READ-ONLY probe of the 3D designer -> checkout path, per language (en/es/fr/it) on desktop + phone. Run by .github/workflows/probe-3d-checkout.yml on a GitHub
 * runner (the sandbox cannot reach the stores). Anonymous throwaway browser, NO customisation: open the launch link exactly as the site links it, wait for the
 * 3D model, press ADD TO CART, record the page it lands on (design.momuto.com/cart), look at what the cart says (roster prompts count), press the checkout
 * button and record where that lands. STOPS there: no roster typed, nothing paid, no order created.
 * Records per step: URL, HTTP status, visible text, buttons, console/page errors, failed or 4xx/5xx requests, screenshots.
 * Output: probe-3d-out/<lang>-<viewport>.json + screenshots; PASS/FAIL table at the end of the log. Docs: docs/verification-map.md.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const OUT = path.join(__dirname, '..', 'probe-3d-out'); fs.mkdirSync(OUT, { recursive: true });
const LANGS = (process.env.PROBE_LANGS || 'en,es,fr,it').split(',').map(s => s.trim());
const VIEWPORTS = [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]];
const ADD_RE = /add to cart|añadir al carrito|ajouter au panier|aggiungi al carrello/i;
const CHECKOUT_RE = /check ?out|proceed|place order|continue|completar|finalizar|tramitar|pagar|commander|passer|paiement|procedi|cassa|continua|continuar|continuer/i;
const NOISE = /google|googletagmanager|doubleclick|facebook|fbevents|clarity\.ms|hotjar|tiktok|pinterest|trustpilot|analytics|sentry|gtag|hubspot/i;
const NEXT_RE = /^\s*(next|continue|start|got it|skip|siguiente|continuar|empezar|saltar|suivant|continuer|commencer|passer|avanti|continua|inizia|salta)\b/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const facts = () => ({
  url: location.href, title: document.title, textLen: (document.body.innerText || '').trim().length,
  text: (document.body.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 600),
  buttons: [...document.querySelectorAll('button, a, input[type=submit], [role=button]')].filter(e => e.getBoundingClientRect().width > 0).map(e => (e.innerText || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 40)).filter(Boolean).slice(0, 25),
  canvas: [...document.querySelectorAll('canvas')].map(c => `${c.width}x${c.height}`),
});

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const table = [];
  for (const lang of LANGS) for (const [vp, size] of VIEWPORTS) {
    const tag = `${lang}-${vp}`, rep = { lang, viewport: vp, steps: [], console: [], pageErrors: [], badRequests: [] };
    const ctx = await browser.newContext({ viewport: size, isMobile: vp === 'phone', locale: lang === 'en' ? 'en-GB' : lang });
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') rep.console.push(m.text().slice(0, 200)); });
    page.on('pageerror', e => rep.pageErrors.push(String(e.message).slice(0, 200)));
    page.on('requestfailed', r => { if (!NOISE.test(r.url())) rep.badRequests.push(`FAILED ${r.url().slice(0, 140)} ${(r.failure() || {}).errorText || ''}`); });
    page.on('response', r => { if (r.status() >= 400 && !NOISE.test(r.url())) rep.badRequests.push(`${r.status()} ${r.url().slice(0, 140)}`); });
    const step = (n, ok, note) => rep.steps.push({ n, ok, note });
    try {
      const url = `https://design.momuto.com/3d-configurator/configurator.html?userId=userIdUrl&configId=ypi9qc1z&suitName=mamuto3suit1&lang=${lang}&langguage=${lang}`;
      const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('canvas', { timeout: 45000 }).catch(() => {}); await sleep(15000);
      rep.tool = await page.evaluate(facts);
      step('tool opens', r.status() < 400 && rep.tool.canvas.length > 0, `HTTP ${r.status()} canvas ${JSON.stringify(rep.tool.canvas)} | buttons ${JSON.stringify(rep.tool.buttons.slice(0, 12))}`);
      await page.screenshot({ path: path.join(OUT, `${tag}-1-tool.png`) });
      // first-visit intro ("Your club's colours... NEXT"): a new customer clicks through it, so does the probe (max 8 steps)
      rep.intro = 0;
      for (let i = 0; i < 8; i++) {
        const nx = page.locator('button, [role=button], a, div').filter({ hasText: NEXT_RE }).filter({ visible: true }).last();
        const addVisible = await page.locator('button, [role=button]').filter({ hasText: ADD_RE }).filter({ visible: true }).count();
        if (!await nx.count() || (addVisible && !(await page.locator('div').filter({ hasText: /club.s colou?rs|tus colores|vos couleurs|i colori/i }).filter({ visible: true }).count()))) break;
        await nx.click({ timeout: 4000 }).catch(() => {}); rep.intro++; await sleep(1500);
        if (i === 0) await page.screenshot({ path: path.join(OUT, `${tag}-1b-intro.png`) });
      }
      step('intro clicked through', true, `${rep.intro} step(s)`);
      await page.screenshot({ path: path.join(OUT, `${tag}-1c-after-intro.png`) });
      const add = page.locator('button, [role=button]').filter({ hasText: ADD_RE }).filter({ visible: true }).last();
      if (!await add.count()) throw new Error('no ADD TO CART control visible in the tool');
      rep.addText = (await add.innerText().catch(() => '')).trim().slice(0, 40);
      await add.scrollIntoViewIfNeeded().catch(() => {});
      const nav = page.waitForURL(/\/cart|checkouts|sign|login/i, { timeout: 60000 }).catch(() => null);
      await add.click({ timeout: 8000 }); await nav; await sleep(6000);
      rep.cart = await page.evaluate(facts);
      step('add to cart -> cart', /\/cart/.test(rep.cart.url) && rep.cart.textLen > 60, `${rep.cart.url.slice(0, 100)} | ${rep.cart.textLen} chars | ${rep.cart.text.slice(0, 160)}`);
      await page.screenshot({ path: path.join(OUT, `${tag}-2-cart.png`), fullPage: true });
      const co = page.locator('button, a, input[type=submit], [role=button]').filter({ hasText: CHECKOUT_RE }).filter({ visible: true }).last();
      if (!await co.count()) throw new Error('no checkout button in the design cart');
      rep.checkoutText = (await co.innerText().catch(() => '')).trim().slice(0, 40);
      const nav2 = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
      await co.click({ timeout: 8000 }).catch(e => { rep.clickError = e.message.slice(0, 120); }); const resp = await nav2; await sleep(6000);
      rep.landing = await page.evaluate(facts);
      const onCheckout = /checkouts?\//.test(rep.landing.url);
      step('cart -> checkout', onCheckout && (!resp || resp.status() < 400), `${rep.landing.url.slice(0, 100)} | HTTP ${resp && resp.status()} | ${rep.landing.text.slice(0, 200)}`);
      await page.screenshot({ path: path.join(OUT, `${tag}-3-landing.png`), fullPage: true });
    } catch (e) { step('ERROR', false, e.message.slice(0, 200)); await page.screenshot({ path: path.join(OUT, `${tag}-error.png`) }).catch(() => {}); }
    fs.writeFileSync(path.join(OUT, `${tag}.json`), JSON.stringify(rep, null, 1));
    table.push(`${rep.steps.every(s => s.ok) ? 'PASS' : 'FAIL'} ${tag.padEnd(12)} ${rep.steps.map(s => (s.ok ? 'ok ' : 'XX ') + s.n).join(' > ')} | page errors ${rep.pageErrors.length} | bad requests ${rep.badRequests.length}`);
    for (const s of rep.steps.filter(s => !s.ok)) table.push('     ' + s.n + ': ' + s.note);
    await ctx.close();
  }
  await browser.close();
  console.log('\n===== 3D CHECKOUT PROBE =====\n' + table.join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
