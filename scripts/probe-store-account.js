'use strict';
/**
 * READ-ONLY probe of the stores' customer-account area (www, us, es, fr, it). Run by .github/workflows/probe-store-account.yml
 * on a GitHub Actions runner (the sandbox cannot reach the stores).
 *
 * For every store, on desktop (1440) and phone (390):
 *   1. home page: every link that points at an account / order / tracking page (text, href, in header|footer|other, VISIBLE or hidden by CSS)
 *   2. the account URLs a visitor can reach (/account/login, /account, /account/orders): final URL, HTTP status, title, h1, form labels, screenshot
 *   3. our own order page (/pages/<handle>, docs/order-view.md): does it exist live, does the ref + email form render
 *   4. ONLY if STORE_<KEY>_EMAIL / STORE_<KEY>_PASSWORD are set (repo secrets, KEY = WWW|US|ES|FR|IT): best-effort login, then the
 *      account + orders pages: screenshots and the visible text lines (which words/labels the buyer sees: order no., status, tracking...).
 * It never submits anything except that login form, never places an order, never prints a secret.
 * Output: probe-account-out/<store>-<viewport>.json + screenshots (uploaded as an artifact) and a summary in the log.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { STORES: ORDER_PAGES } = require('../lib/order-view');

const OUT = path.join(__dirname, '..', 'probe-account-out');
fs.mkdirSync(OUT, { recursive: true });
const STORES = [
  ['www', 'https://www.momuto.com', ORDER_PAGES.en.handle], ['us', 'https://us.momuto.com', ORDER_PAGES.us.handle],
  ['es', 'https://es.momuto.com', ORDER_PAGES.es.handle], ['fr', 'https://fr.momuto.com', ORDER_PAGES.fr.handle],
  ['it', 'https://it.momuto.com', ORDER_PAGES.it.handle],
];
const VIEWPORTS = [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]];
const ACCOUNT_PATHS = ['/account/login', '/account', '/account/orders'];
const LINK_RE = /account|login|sign.?in|orders?\b|tracking|track|my-order|mi-pedido|mon-commande|il-mio-ordine|pedido|commande|ordine|cuenta|compte|conto/i;

const pageFacts = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(), c = getComputedStyle(el); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none' && c.opacity !== '0'; };
  const where = (el) => (el.closest('header') ? 'header' : el.closest('footer') ? 'footer' : el.closest('nav') ? 'nav' : 'other');
  const links = [...document.querySelectorAll('a[href]')].filter(a => LINK_RE.test(a.getAttribute('href') + ' ' + (a.textContent || '') + ' ' + (a.getAttribute('aria-label') || '') + ' ' + a.className))
    .map(a => ({ text: (a.textContent || a.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40), href: a.getAttribute('href').slice(0, 100), where: where(a), visible: vis(a), cls: String(a.className).slice(0, 60) }));
  const icons = [...document.querySelectorAll('header a[href], .page-header a[href]')].filter(a => vis(a) && /login|account|user|person|profile/i.test(a.getAttribute('href') + a.className + (a.getAttribute('aria-label') || '') + a.innerHTML.slice(0, 300))).map(a => a.outerHTML.replace(/\s+/g, ' ').slice(0, 220)).slice(0, 4);
  return { icons, title: document.title, h1: [...document.querySelectorAll('h1')].map(h => h.textContent.trim().slice(0, 80)), links };
};
const formFacts = () => ({
  labels: [...document.querySelectorAll('label, input[placeholder], button, [type=submit]')].filter(e => e.getBoundingClientRect().width > 0)
    .map(e => (e.textContent || e.getAttribute('placeholder') || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 50)).filter(Boolean).slice(0, 24),
  inputs: [...document.querySelectorAll('input')].filter(i => i.getBoundingClientRect().width > 0).map(i => i.type).slice(0, 10),
});
const textLines = () => document.body.innerText.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 140);

async function main() {
  const browser = await chromium.launch();
  const summary = [];
  for (const [key, host, handle] of STORES) for (const [vpName, vp] of VIEWPORTS) {
    const tag = `${key}-${vpName}`, res = { store: key, host, viewport: vpName };
    const ctx = await browser.newContext({ viewport: vp, isMobile: vpName === 'phone', hasTouch: vpName === 'phone' });
    const p = await ctx.newPage();
    await p.addInitScript(`window.LINK_RE = ${LINK_RE.toString()};`);
    const go = async (url) => { try { const r = await p.goto(url, { waitUntil: 'networkidle', timeout: 45000 }); return r ? r.status() : 0; } catch (e) { try { await p.waitForTimeout(1500); return -1; } catch (_) { return -2; } } };
    try {
      res.homeStatus = await go(host + '/');
      res.home = await p.evaluate(pageFacts);
      await p.screenshot({ path: path.join(OUT, `${tag}-home.png`) });
      res.account = [];
      for (const ap of ACCOUNT_PATHS) {
        const status = await go(host + ap);
        const f = await p.evaluate(pageFacts).catch(() => ({})), form = await p.evaluate(formFacts).catch(() => ({}));
        res.account.push({ path: ap, status, finalUrl: p.url().slice(0, 120), title: f.title, h1: f.h1, form });
        await p.screenshot({ path: path.join(OUT, `${tag}-${ap.replace(/\W+/g, '_')}.png`) });
      }
      const ostatus = await go(`${host}/pages/${handle}`);
      await p.waitForTimeout(1200);
      const of = await p.evaluate(pageFacts).catch(() => ({})), oform = await p.evaluate(formFacts).catch(() => ({}));
      res.orderPage = { handle, status: ostatus, finalUrl: p.url().slice(0, 120), title: of.title, h1: of.h1, form: oform };
      await p.screenshot({ path: path.join(OUT, `${tag}-orderpage.png`) });

      const KEY = key.toUpperCase(), email = process.env[`STORE_${KEY}_EMAIL`], pass = process.env[`STORE_${KEY}_PASSWORD`];
      if (email && pass) {
        res.login = { attempted: true };
        await go(host + '/account/login');
        try {
          await p.fill('input[type=email], input[name*=mail i], input[name*=user i]', email, { timeout: 8000 });
          await p.fill('input[type=password]', pass, { timeout: 8000 });
          await Promise.all([p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {}), p.click('button[type=submit], input[type=submit], button:has-text("Log"), button:has-text("Sign"), button:has-text("Iniciar"), button:has-text("Connexion"), button:has-text("Accedi")', { timeout: 8000 })]);
          await p.waitForTimeout(2500);
          res.login.landed = p.url().slice(0, 120); res.login.stillOnLogin = /login/i.test(p.url());
          res.loggedIn = [];
          for (const ap of ['/account', '/account/orders']) {
            await go(host + ap);
            await p.waitForTimeout(1500);
            res.loggedIn.push({ path: ap, finalUrl: p.url().slice(0, 120), lines: await p.evaluate(textLines) });
            await p.screenshot({ path: path.join(OUT, `${tag}-in-${ap.replace(/\W+/g, '_')}.png`), fullPage: true });
          }
          // first order detail, if the list links to one (still read-only)
          const href = await p.evaluate(() => { const a = [...document.querySelectorAll('a[href]')].find(x => /orders?\/[^/?#]+|order_detail|order-detail/i.test(x.getAttribute('href'))); return a && a.href; });
          if (href) { await go(href); await p.waitForTimeout(1500); res.orderDetail = { url: p.url().slice(0, 140), lines: await p.evaluate(textLines) }; await p.screenshot({ path: path.join(OUT, `${tag}-in-order-detail.png`), fullPage: true }); }
        } catch (e) { res.login.error = String(e.message || e).split('\n')[0].slice(0, 160); }
      }
    } catch (e) { res.error = String(e.message || e).split('\n')[0].slice(0, 200); }
    fs.writeFileSync(path.join(OUT, `${tag}.json`), JSON.stringify(res, null, 1));
    if (vpName === 'phone' || key === 'es') console.log(`DETAIL ${tag} ` + JSON.stringify({ icons: res.home && res.home.icons, loginPage: res.account && res.account[0] && { title: res.account[0].title, h1: res.account[0].h1, labels: res.account[0].form && res.account[0].form.labels }, orderPage: res.orderPage && { status: res.orderPage.status, title: res.orderPage.title, h1: res.orderPage.h1, labels: res.orderPage.form && res.orderPage.form.labels } }));
    const hdr = (res.home && res.home.links || []).filter(l => l.where === 'header');
    summary.push(`${tag.padEnd(14)} home ${res.homeStatus} | header account-ish links: ${hdr.map(l => (l.visible ? '' : '(hidden)') + l.text + '→' + l.href).join(' ; ') || 'none'} | `
      + (res.account || []).map(a => `${a.path} ${a.status}→${a.finalUrl.replace(host, '')}`).join(' , ') + ` | order page ${res.orderPage ? res.orderPage.status : '?'}${res.login ? ' | login ' + (res.login.error ? 'ERR ' + res.login.error : (res.login.stillOnLogin ? 'FAILED (still on login)' : 'ok')) : ''}`);
    await ctx.close();
  }
  await browser.close();
  console.log('\n===== SUMMARY =====\n' + summary.join('\n'));
}
main().catch(e => { console.error(e); process.exit(1); });
