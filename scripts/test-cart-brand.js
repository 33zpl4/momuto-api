'use strict';
// node scripts/test-cart-brand.js — the generated paste-in file (docs/cart-brand/cart-brand-entry.html) in a real Chromium on the REAL markup captured from the live stores
// (scripts/fixtures/cart-page.html, cart-popup.html): proves the entry is inert on an ordinary page, skins /cart and the pop-up, requests fonts on /cart only,
// and fixes the FR/IT checkout labels. Needs playwright (or playwright-core) + Chromium (CHROMIUM=/path). Mock pages only, no network to the stores.
const fs = require('fs'), path = require('path'), http = require('http');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('playwright-core')); }
const ENTRY = fs.readFileSync(path.join(__dirname, '..', 'docs', 'cart-brand', 'cart-brand-entry.html'), 'utf8');
const CART = fs.readFileSync(path.join(__dirname, 'fixtures', 'cart-page.html'), 'utf8');
const POPUP = fs.readFileSync(path.join(__dirname, 'fixtures', 'cart-popup.html'), 'utf8');
const THEME = '<style>body{background:#fff;color:#1d1f21;font-family:Georgia}.main_btn{background:#1d1f21;color:#fff}h1.title{font-family:Georgia;font-size:20px}</style>';
const PAGES = {
  '/products/x': `<h1 class="title">Plain page</h1><a class="main_btn" href="#">btn</a>`,
  '/cart': CART,
  '/pop': `<h1 class="title">Product</h1><div id="slot"></div>`,
};
const page = (body, withEntry) => `<!doctype html><html><head><meta charset="utf-8"><title>t</title>${THEME}</head><body>${body}${withEntry ? ENTRY : ''}</body></html>`;
let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); c ? pass++ : fail++; };

(async () => {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); const p = u.pathname;
    if (!PAGES[p]) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(page(PAGES[p], !u.searchParams.has('bare')));
  }).listen(0);
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  async function visit(p, opts = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } }); const pg = await ctx.newPage(); const font = [];
    await pg.route('**/*', r => { const u = r.request().url(); if (/fonts\.(googleapis|gstatic)\.com/.test(u)) { font.push(u); return r.abort(); } return r.continue(); });
    await pg.goto(base + p + (opts.bare ? '?bare=1' : ''), { waitUntil: 'load' });
    if (opts.popup) { await pg.evaluate(h => { const d = document.createElement('div'); d.innerHTML = h; document.body.appendChild(d.firstElementChild); }, POPUP); }
    await pg.waitForTimeout(300);
    const r = await pg.evaluate(() => {
      const cs = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null; };
      const b = cs('.checkout.main_btn') || cs('.cart-buyNow') || cs('.main_btn');
      return { bodyBg: getComputedStyle(document.body).backgroundColor, h1: (cs('h1') || {}).fontFamily, btnBg: b && b.backgroundColor, btnFont: b && b.fontFamily,
        summaryBg: (cs('.cart_order_summary_wrapper') || {}).backgroundColor, popBg: (cs('.mo-popup-content') || {}).backgroundColor, hdrBg: (cs('.cart-header') || {}).backgroundColor,
        names: [...document.querySelectorAll('.product_info_name, .cart-product-name span')].map(e => getComputedStyle(e).color),
        fontLink: !!document.getElementById('mo-cart-fonts'), btnText: ((document.querySelector('.checkout.main_btn, .cart-buyNow span') || {}).textContent || '').trim(),
        tick: [...document.querySelectorAll('.cart-header > svg:not(.cart-header-claer) path')].map(p => getComputedStyle(p).fill),
        skin: getComputedStyle(document.documentElement).getPropertyValue('--mo-cart-skin').trim() };
    });
    await ctx.close(); return { ...r, fontRequests: font.length };
  }
  const bare = await visit('/products/x', { bare: true }), plain = await visit('/products/x');
  ok(plain.bodyBg === bare.bodyBg && plain.h1 === bare.h1 && plain.btnBg === bare.btnBg, `ordinary page: styles identical with and without the entry (body ${plain.bodyBg}, btn ${plain.btnBg})`);
  ok(plain.fontRequests === 0 && !plain.fontLink, 'ordinary page: no font request, no font link');
  ok(plain.skin === 'v1', 'ordinary page: only the version marker is visible (the probe uses it)');
  const cart = await visit('/cart');
  ok(cart.bodyBg === 'rgb(11, 11, 12)' && /Bebas Neue/.test(cart.h1) && cart.btnBg === 'rgb(200, 53, 46)', `cart page: skinned (body ${cart.bodyBg}, h1 ${cart.h1}, checkout ${cart.btnBg})`);
  ok(cart.summaryBg === 'rgb(20, 20, 22)' && cart.names.every(c => c === 'rgb(255, 255, 255)'), 'cart page: summary card dark, product name white');
  ok(cart.fontLink && cart.fontRequests >= 1, 'cart page: font link added and requested (blocked in the test)');
  const pop = await visit('/pop', { popup: true });
  ok(pop.tick && pop.tick[0] === 'rgb(255, 255, 255)' && pop.tick[1] === 'rgb(11, 11, 12)', 'pop-up: white disc, black tick ' + JSON.stringify(pop.tick));
  ok(pop.popBg === 'rgb(20, 20, 22)' && pop.hdrBg === 'rgb(26, 26, 29)' && pop.btnBg === 'rgb(200, 53, 46)', `pop-up: dark card ${pop.popBg}, header ${pop.hdrBg}, Checkout ${pop.btnBg}`);
  ok(pop.fontRequests === 0 && !pop.fontLink, 'pop-up on a product page: no font request');
  ok(pop.bodyBg === 'rgb(255, 255, 255)', 'pop-up on a product page: the page itself keeps its own background');
  // FR / IT label fix: the same entry with the host swapped, a pop-up whose button says "Caisse" / "Cassa"
  for (const [host, bad, good] of [['fr.momuto.com', 'Caisse', 'Passer la commande'], ['it.momuto.com', 'Cassa', 'Procedi al pagamento'], ['us.momuto.com', 'Checkout', 'Checkout']]) {
    const ctx = await browser.newContext(); const pg = await ctx.newPage();
    await pg.route('**/*', r => r.request().url().startsWith('http://127') ? r.continue() : r.abort());
    await pg.setContent(page('<h1>x</h1>', false).replace('</body>', ENTRY.replace('location.hostname', "'" + host + "'") + '</body>'));
    await pg.evaluate(h => { const d = document.createElement('div'); d.innerHTML = h; document.body.appendChild(d.firstElementChild); }, POPUP.replace('>Checkout<', '>' + bad + '<'));
    await pg.waitForTimeout(200);
    const t = await pg.evaluate(() => (document.querySelector('.cart-buyNow span') || {}).textContent.trim());
    ok(t === good, `${host}: pop-up button "${bad}" -> "${t}"`);
    await ctx.close();
  }
  await browser.close(); srv.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
