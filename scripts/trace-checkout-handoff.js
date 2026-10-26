'use strict';
/**
 * READ-ONLY probe of the 3D designer -> checkout path, per language (en/es/fr/it) on desktop + phone. Run by .github/workflows/probe-3d-checkout.yml on a GitHub
 * runner (the sandbox cannot reach the stores). Anonymous throwaway browser, NO customisation: open the launch link exactly as the site links it, wait for the
 * 3D model, press ADD TO CART, record the page it lands on (design.momuto.com/cart), look at what the cart says (roster prompts count), press the checkout
 * button and record where that lands. STOPS there: no roster typed, nothing paid, no order created.
 * Records per step: URL, HTTP status, visible text, buttons, console/page errors, failed or 4xx/5xx requests, screenshots.
 * Output: trace-out/<lang>-<viewport>.json + screenshots; PASS/FAIL table at the end of the log. Docs: docs/verification-map.md.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const OUT = path.join(__dirname, '..', 'trace-out'); fs.mkdirSync(OUT, { recursive: true });
const LANGS = (process.env.PROBE_LANGS || 'es,en').split(',').map(s => s.trim());
const ENTRIES = (process.env.PROBE_ENTRIES || 'direct').split(',').map(x => x.trim());   // store = start on the store home and click its 3D link (customer path); direct = open the designer URL cold
const HOSTS = { en: 'https://www.momuto.com', es: 'https://es.momuto.com', fr: 'https://fr.momuto.com', it: 'https://it.momuto.com' };
const VIEWPORTS = [['desktop', { width: 1440, height: 900 }]];
const ADD_RE = /add to cart|añadir al carrito|añadir a la cesta|ajouter au panier|aggiungi al carrello/i;
const CHECKOUT_RE = /check ?out|proceed|place order|continue|completar|finalizar|tramitar|pagar|commander|passer|paiement|procedi|cassa|continua|continuar|continuer/i;
const NOISE = /google|googletagmanager|doubleclick|facebook|fbevents|clarity\.ms|hotjar|tiktok|pinterest|trustpilot|analytics|sentry|gtag|hubspot/i;
const NEXT_RE = /^\s*(next|siguiente|suivant|avanti)\b/i;
const NOT_ON_KIT_RE = /not on this kit|no en este kit|pas sur ce kit|non su questo kit/i;
// after the add the tool shows "LOGO RECEIVED - GOT IT" and "KIT ADDED - GOALKEEPER TOO?" (YES / NO THANKS - GO TO CART): a customer who just wants the cart says no
const TO_CART_RE = /go to cart|ir al carrito|ir a la cesta|aller au panier|vai al carrello/i;
const GOT_IT_RE = /^\s*(got it|entendido|compris|capito|ok)\s*$/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const facts = () => (!document.body ? { url: location.href, title: '', textLen: 0, text: '', buttons: [], canvas: [] } : {
  url: location.href, title: document.title, textLen: (document.body.innerText || '').trim().length,
  text: (document.body.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 600),
  buttons: [...document.querySelectorAll('button, a, input[type=submit], [role=button]')].filter(e => e.getBoundingClientRect().width > 0).map(e => (e.innerText || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 40)).filter(Boolean).slice(0, 25),
  canvas: [...document.querySelectorAll('canvas')].map(c => `${c.width}x${c.height}`),
});

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const table = [];
  for (const lang of LANGS) for (const [vp, size] of VIEWPORTS) for (const entry of ENTRIES) {
    const tag = `${lang}-${vp}-${entry}`, rep = { lang, viewport: vp, entry, steps: [], console: [], pageErrors: [], badRequests: [] };
    const ctx = await browser.newContext({ viewport: size, isMobile: vp === 'phone', locale: lang === 'en' ? 'en-GB' : lang });
    const page = await ctx.newPage();
    { const _s = page.screenshot.bind(page); page.screenshot = o => _s({ ...o, timeout: 12000 }).catch(() => null); }   // software-rendered 3D can stall a screenshot; never let that fail the probe
    page.on('console', m => { if (m.type() === 'error') rep.console.push(m.text().slice(0, 200)); });
    page.on('pageerror', e => rep.pageErrors.push(String(e.message).slice(0, 200)));
    page.on('requestfailed', r => { if (!NOISE.test(r.url())) rep.badRequests.push(`FAILED ${r.url().slice(0, 140)} ${(r.failure() || {}).errorText || ''}`); });
    page.on('response', r => { if (r.status() >= 400 && !NOISE.test(r.url())) rep.badRequests.push(`${r.status()} ${r.url().slice(0, 140)}`); });
    rep.trace = []; rep.tracing = false;
    page.on('response', async r => { if (!rep.tracing) return; const u = r.url(); if (NOISE.test(u) || /\.(png|jpe?g|webp|svg|woff2?|css|gif)(\?|$)/i.test(u)) return;
      let body = ''; try { const ct = r.headers()['content-type'] || ''; if (/json|text|html/.test(ct) && r.request().method() !== 'OPTIONS') body = (await r.text()).slice(0, 600); } catch (e) {}
      rep.trace.push({ t: Date.now(), m: r.request().method(), s: r.status(), u: u.slice(0, 200), post: (r.request().postData() || '').slice(0, 400), body }); });
    page.on('framenavigated', f => { if (rep.tracing && f === page.mainFrame()) rep.trace.push({ nav: f.url().slice(0, 300) }); });
    page.on('console', m => { if (rep.tracing) rep.trace.push({ console: m.type() + ': ' + m.text().slice(0, 300) }); });
    const step = (n, ok, note) => rep.steps.push({ n, ok, note });
    try {
      const url = `https://design.momuto.com/3d-configurator/configurator.html?userId=userIdUrl&configId=ypi9qc1z&suitName=mamuto3suit1&lang=${lang}&langguage=${lang}`;
      let r;
      if (entry === 'store') {
        // customer path: land on the store, then follow the store's own 3D link (carries the store's guest session to the designer)
        const sh = await page.goto(HOSTS[lang] + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(3000);
        const link = await page.evaluate(() => { const a = [...document.querySelectorAll('a[href*="design.momuto.com/3d-configurator"]')].find(e => e.getBoundingClientRect().width > 0) || document.querySelector('a[href*="design.momuto.com/3d-configurator"]'); return a ? a.href : null; });
        rep.storeLink = link;
        if (!link) throw new Error('no 3D designer link on the ' + lang + ' store home page');
        r = await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 60000 });
      } else {
        r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      }
      await page.waitForSelector('canvas', { timeout: 45000 }).catch(() => {}); await sleep(15000);
      rep.tool = await page.evaluate(facts);
      step('tool opens', r.status() < 400 && rep.tool.canvas.length > 0, `HTTP ${r.status()} canvas ${JSON.stringify(rep.tool.canvas)} | buttons ${JSON.stringify(rep.tool.buttons.slice(0, 12))}`);
      await page.screenshot({ path: path.join(OUT, `${tag}-1-tool.png`) });
      // first-visit intro ("Your club's colours... NEXT"): a new customer clicks through it, so does the probe (max 8 steps)
      rep.intro = 0;
      for (let i = 0; i < 8; i++) {
        const nx = page.locator(':text-matches("^\\s*(next|siguiente|suivant|avanti)\\s*$", "i")').filter({ visible: true }).last();
        if (!await nx.count()) break;
        await nx.click({ timeout: 4000 }).catch(() => {}); rep.intro++; await sleep(1500);
        if (i === 0) await page.screenshot({ path: path.join(OUT, `${tag}-1b-intro.png`) });
      }
      step('intro clicked through', true, `${rep.intro} step(s)`);
      await page.screenshot({ path: path.join(OUT, `${tag}-1c-after-intro.png`) });
      const add = page.locator('button, [role=button]').filter({ hasText: ADD_RE }).filter({ visible: true }).last();
      if (!await add.count()) throw new Error('no ADD TO CART control visible in the tool');
      rep.addText = (await add.innerText().catch(() => '')).trim().slice(0, 40);
      await add.scrollIntoViewIfNeeded().catch(() => {});
      await add.click({ timeout: 8000 }); await sleep(3500);
      // names & numbers prompt ("Add them" / "Not on this kit"): a customer who has not designed a roster answers "Not on this kit", then the add goes through
      const skip = page.locator('button, [role=button]').filter({ hasText: NOT_ON_KIT_RE }).filter({ visible: true }).first();
      if (await skip.count()) {
        rep.prompt = 'names-and-numbers prompt shown';
        await page.screenshot({ path: path.join(OUT, `${tag}-2a-prompt.png`) });
        const nav0 = page.waitForURL(/\/cart|checkouts|sign|login/i, { timeout: 25000 }).catch(() => null);
        await skip.click({ timeout: 5000 }).catch(() => {}); await nav0; await sleep(3000);
        if (!/\/cart|checkouts/.test(page.url())) {
          const nav1 = page.waitForURL(/\/cart|checkouts|sign|login/i, { timeout: 40000 }).catch(() => null);
          const add2 = page.locator('button, [role=button]').filter({ hasText: ADD_RE }).filter({ visible: true }).last();
          if (await add2.count()) await add2.click({ timeout: 5000 }).catch(() => {});
          await nav1;
        }
      } else { await page.waitForURL(/\/cart|checkouts|sign|login/i, { timeout: 40000 }).catch(() => null); }
      for (let i = 0; i < 6 && !/\/cart/.test(page.url()); i++) {
        const toCart = page.locator('button, [role=button], a').filter({ hasText: TO_CART_RE }).filter({ visible: true }).last();
        const gotIt = page.locator('button, [role=button]').filter({ hasText: GOT_IT_RE }).filter({ visible: true }).last();
        const nv = page.waitForURL(/\/cart/, { timeout: 15000 }).catch(() => null);
        if (await toCart.count()) { rep.afterAdd = (rep.afterAdd || []).concat('go to cart'); await toCart.click({ timeout: 5000 }).catch(() => {}); await nv; }
        else if (await gotIt.count()) { rep.afterAdd = (rep.afterAdd || []).concat('got it'); await gotIt.click({ timeout: 5000 }).catch(() => {}); await sleep(2500); }
        else { await sleep(3000); }
      }
      await sleep(5000);
      await page.waitForLoadState('domcontentloaded').catch(() => {}); rep.addClickAt = rep.addClickAt || null; await page.waitForSelector(':text-matches("/\\s*(jersey|kit|camiseta|maillot|maglia)", "i")', { timeout: 20000 }).catch(() => {}); rep.cart = await page.evaluate(facts); rep.cartTiming = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return n ? { ttfbMs: Math.round(n.responseStart), domContentLoadedMs: Math.round(n.domContentLoadedEventEnd), loadMs: Math.round(n.loadEventEnd) } : null; }).catch(() => null);
      step('add to cart -> cart', /\/cart/.test(rep.cart.url) && rep.cart.textLen > 60, `${rep.cart.url.slice(0, 100)} | ${rep.cart.textLen} chars | ${rep.cart.text.slice(0, 160)}`);
      await page.screenshot({ path: path.join(OUT, `${tag}-2-cart.png`), fullPage: true });
      const co = page.locator(':text-matches("^\\s*(check ?out|finalizar compra|completar pedido|tramitar pedido|passer la commande|procedi al pagamento|paiement|cassa)\\s*$", "i")').filter({ visible: true }).last();
      if (!await co.count()) throw new Error('no checkout button in the design cart');
      rep.checkoutText = (await co.innerText().catch(() => '')).trim().slice(0, 40); rep.tracing = true; rep.t0 = Date.now();
      const nav2 = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
      await co.click({ timeout: 8000 }).catch(e => { rep.clickError = e.message.slice(0, 120); }); const resp = await nav2; await sleep(6000);
      await sleep(8000); rep.landing = await page.evaluate(facts);
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
