'use strict';
// node scripts/test-account-brand.js — the generated paste-in file (docs/account-brand/account-brand-entry.html) in a real Chromium, on three kinds of page.
// Proves the entry is inert outside the account pages: no font request, no MutationObserver, no restyle; and that it works on /account/* and the order page.
// Needs playwright (or playwright-core) and a Chromium: CHROMIUM=/path/to/chromium if the default is not installed. Mock pages only; no network to the stores.
const fs = require('fs');
const path = require('path');
const http = require('http');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('playwright-core')); }
const ENTRY = fs.readFileSync(path.join(__dirname, '..', 'docs', 'account-brand', 'account-brand-entry.html'), 'utf8');

const HEADER = '<div class="order-header"><div class="order-header-status"><span class="mo-tag">SHIPPED</span></div></div>';
const PAGES = {
  '/pages/my-order': `<h1 class="title">Plain page</h1><a class="secondary_btn" href="#">btn</a><div class="main_btn">x</div>`,
  '/account/login': `<div id="customer_login"><h1 class="header-title">Log In</h1><div id="confirm" class="main_btn form_btn">CONFIRM</div></div>`,
  '/account/orders/231549-2026026': `<div id="account_orderDetail"><h1 class="title">Order Detail</h1>${HEADER}
    <div class="order-table"><div class="order-table-body"><div class="tracking-warp"><div class="tracking-header">Tracking</div>
    <div class="tracking-item"><div class="tracking-item-header"><div class="tracking-item-title">USPS : AB123456789US</div></div><div class="tracking-item-des">http://www.usps.com/</div></div></div></div></div></div>`,
  '/account/orders/777': `<div id="account_orderDetail"><h1 class="title">Order Detail</h1>${HEADER}
    <div class="order-table"><div class="order-table-body"><div class="tracking-warp"><div class="tracking-header">Tracking</div>
    <div class="tracking-item"><div class="tracking-item-header"><div class="tracking-item-title">Colis Prive : 99887766</div></div><div class="tracking-item-des"><a href="https://www.colisprive.fr/">colisprive</a></div></div></div></div></div></div>`,
};
const page = (body, withEntry) => `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="background:#fff;color:#000;font-family:Georgia">${body}${withEntry ? ENTRY : ''}</body></html>`;

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); c ? pass++ : fail++; };

(async () => {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); const p = u.pathname, bare = u.searchParams.has('bare');
    if (!PAGES[p]) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(page(PAGES[p], !bare));
  }).listen(0);
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });

  async function visit(p, bare) {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const pg = await ctx.newPage(); const font = [];
    await pg.route('**/*', r => { const u = r.request().url(); if (/fonts\.(googleapis|gstatic)\.com/.test(u)) { font.push(u); return r.abort(); } return r.continue(); });
    await pg.addInitScript(() => { window.__obs = 0; const O = window.MutationObserver; window.MutationObserver = function (cb) { window.__obs++; return new O(cb); }; window.MutationObserver.prototype = O.prototype; });
    await pg.goto(base + p + (bare ? '?bare=1' : ''), { waitUntil: 'load' }); await pg.waitForTimeout(400);
    const r = await pg.evaluate(() => {
      const h = document.querySelector('h1'), b = document.querySelector('.main_btn, .secondary_btn'), cs = e => e && getComputedStyle(e);
      return { obs: window.__obs, fontLink: !!document.getElementById('mo-account-fonts'), panel: !!document.querySelector('.mo-track'),
        h1font: cs(h).fontFamily, h1color: cs(h).color, bodyBg: cs(document.body).backgroundColor, btnBg: b && cs(b).backgroundColor,
        track: [...document.querySelectorAll('.mo-track a.mo-track-btn')].map(a => a.getAttribute('href')), hidden: (() => { const t = document.querySelector('.tracking-warp'); return t ? getComputedStyle(t).display : null; })(),
        skinVar: getComputedStyle(document.documentElement).getPropertyValue('--mo-account-skin').trim() };
    });
    await ctx.close(); return { ...r, fontRequests: font.length };
  }

  // 1. an ordinary store page (here: our "My order" page path): the entry must change nothing and cost nothing
  const plainBare = await visit('/pages/my-order', true), plain = await visit('/pages/my-order', false);
  ok(plain.obs === 0, 'ordinary page: no MutationObserver started');
  ok(plain.fontRequests === 0 && !plain.fontLink, 'ordinary page: no Google Fonts request, no font link');
  ok(!plain.panel, 'ordinary page: no tracking panel');
  ok(plain.h1font === plainBare.h1font && plain.h1color === plainBare.h1color && plain.bodyBg === plainBare.bodyBg && plain.btnBg === plainBare.btnBg,
    `ordinary page: styles identical with and without the entry (h1 ${plain.h1font}/${plain.h1color}, body ${plain.bodyBg}, btn ${plain.btnBg})`);
  ok(plain.skinVar === 'v1', 'ordinary page: only the version marker (--mo-account-skin) is visible, so the probe can tell the entry is pasted');

  // 2. an account page that is not an order: skinned + fonts, but no observer and no panel
  const login = await visit('/account/login', false);
  ok(login.fontLink && login.fontRequests >= 1, 'login page: font link added and requested (blocked in the test)');
  ok(login.obs === 0 && !login.panel, 'login page: no observer, no panel');
  ok(/Bebas Neue/.test(login.h1font) && login.bodyBg === 'rgb(11, 11, 12)' && login.btnBg === 'rgb(200, 53, 46)', `login page: skinned (h1 ${login.h1font}, body ${login.bodyBg}, button ${login.btnBg})`);

  // 3. an order page with tracking
  const ord = await visit('/account/orders/231549-2026026', false);
  ok(ord.panel && ord.hidden === 'none', 'order page: tracking panel built, platform block hidden');
  ok(ord.track.length === 1 && ord.track[0] === 'https://tools.usps.com/go/TrackConfirmAction?tLabels=AB123456789US', 'order page: USPS button deep-links the number: ' + ord.track.join(','));
  const ord2 = await visit('/account/orders/777', false);
  ok(ord2.panel && ord2.track.length === 1 && ord2.track[0] === 'https://www.colisprive.fr/', 'order page, unknown carrier: button falls back to the carrier site from the platform: ' + ord2.track.join(','));

  await browser.close(); srv.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
