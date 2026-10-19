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
const ACCOUNT_PATHS = ['/account/login', '/account/register', '/account', '/account/orders'];
const ONLY = (process.env.PROBE_STORES || 'all').toLowerCase().split(',').map(x => x.trim());
const ORDER_PATH = process.env.PROBE_ORDER || '';
// PROBE_CSS=<file> (or 'none'): inject that stylesheet into every page after load (page.addStyleTag), to see a proposed skin on the LIVE pages before anything is pasted into the store. Output files get a -css suffix.
const CSS = process.env.PROBE_CSS && fs.existsSync(process.env.PROBE_CSS) ? fs.readFileSync(process.env.PROBE_CSS, 'utf8') : '';
const JS = process.env.PROBE_JS && fs.existsSync(process.env.PROBE_JS) ? fs.readFileSync(process.env.PROBE_JS, 'utf8') : '';   // PROBE_JS=<file>: also inject that script after the CSS
const SUF = CSS ? '-css' : '';
const emit = (tag, kind, label, text) => { console.log(`${kind.toUpperCase()} ${tag} ${label}` + (String(text).length < 4000 ? '\n' + text : ' (' + String(text).length + ' chars, see file)')); try { fs.writeFileSync(path.join(OUT, `${tag}-${kind}-${String(label).replace(/\W+/g, '_')}.txt`), String(text)); } catch (e) {} };
const mask = (t) => String(t).replace(/([\w.+-])[\w.+-]*@([\w-]+\.[\w.]+)/g, '$1***@$2');
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
const styleFacts = () => {
  const cs = (el) => { if (!el) return null; const c = getComputedStyle(el), r = el.getBoundingClientRect(); return { sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''), font: c.fontFamily.split(',')[0].replace(/["']/g, ''), size: c.fontSize, weight: c.fontWeight, color: c.color, bg: c.backgroundColor, radius: c.borderRadius, tt: c.textTransform, ls: c.letterSpacing, w: Math.round(r.width), h: Math.round(r.height) }; };
  const vis = (e) => e && e.getBoundingClientRect().width > 0;
  const q = (sel) => [...document.querySelectorAll(sel)].find(vis);
  return { body: cs(document.body), h1: cs(q('h1')), h2: cs(q('h2')), h3: cs(q('h3')), label: cs(q('label')), input: cs(q('input:not([type=hidden]):not([type=checkbox])')), primary: cs(q('button[type=submit], input[type=submit], .btn-primary, button.button, a.button')), link: cs(q('main a, #MainContent a, .page-content a, form a')), table: cs(q('table')) };
};
const outline = (maxDepth) => {
  const root = document.querySelector('main') || document.querySelector('#MainContent') || document.querySelector('.page-content') || document.body;
  const out = [], walk = (el, d) => { if (d > (maxDepth || 3) || out.length > 110) return; [...el.children].forEach(c => { if (['SCRIPT', 'STYLE', 'SVG', 'PATH', 'NOSCRIPT'].includes(c.tagName.toUpperCase())) return; const r = c.getBoundingClientRect(); if (r.width < 1) return; out.push('  '.repeat(d) + c.tagName.toLowerCase() + (c.id ? '#' + c.id : '') + (typeof c.className === 'string' && c.className.trim() ? '.' + c.className.trim().split(/\s+/).slice(0, 3).join('.') : '') + (c.children.length ? '' : ' "' + (c.textContent || '').trim().slice(0, 30) + '"')); walk(c, d + 1); }); };
  walk(root, 0); return out;
};
const mainHtml = () => { const el = document.querySelector('.container_wrapper') || document.querySelector('main') || document.body; const c = el.cloneNode(true); c.querySelectorAll('script,style,svg,noscript,link,iframe').forEach(n => n.remove()); return c.outerHTML.replace(/\s+/g, ' ').replace(/ (data-[\w-]+|style|srcset|sizes|loading)="[^"]*"/g, '').slice(0, 24000); };
const textLines = () => document.body.innerText.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 140);

async function main() {
  const browser = await chromium.launch();
  const summary = [];
  for (const [key, host, handle] of STORES) for (const [vpName, vp] of VIEWPORTS) {
    if (ONLY[0] !== 'all' && !ONLY.includes(key)) continue;
    const tag = `${key}-${vpName}${SUF}`, res = { store: key, host, viewport: vpName };
    const ctx = await browser.newContext({ viewport: vp, isMobile: vpName === 'phone', hasTouch: vpName === 'phone' });
    const p = await ctx.newPage();
    await p.addInitScript(`window.LINK_RE = ${LINK_RE.toString()};`);
    const go = async (url) => { try { const r = await p.goto(url, { waitUntil: 'networkidle', timeout: 45000 }); if (CSS) { await p.addStyleTag({ content: CSS }).catch(() => {}); if (JS) await p.addScriptTag({ content: JS }).catch(() => {}); await p.waitForTimeout(900); } return r ? r.status() : 0; } catch (e) { try { await p.waitForTimeout(1500); return -1; } catch (_) { return -2; } } };
    try {
      res.homeStatus = await go(host + '/');
      res.home = await p.evaluate(pageFacts);
      // is the pasted entry live on this store? (--mo-account-skin is declared on :root by account-brand.css; meaningless when PROBE_CSS injects it)
      res.skin = (await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--mo-account-skin').trim()).catch(() => '')) || '';
      res.injected = !!CSS;
      await p.screenshot({ path: path.join(OUT, `${tag}-home.png`) });
      res.account = [];
      for (const ap of ACCOUNT_PATHS) {
        const status = await go(host + ap);
        const f = await p.evaluate(pageFacts).catch(() => ({})), form = await p.evaluate(formFacts).catch(() => ({}));
        res.account.push({ path: ap, status, finalUrl: p.url().slice(0, 120), title: f.title, h1: f.h1, form });
        if (key === ONLY[0] || ONLY[0] === 'all') { emit(tag, 'style', ap, JSON.stringify(await p.evaluate(styleFacts).catch(() => null), null, 1)); if (vpName === 'desktop') { emit(tag, 'outline', ap, (await p.evaluate(outline, 6).catch(() => [])).join('\n')); emit(tag, 'html', ap, await p.evaluate(mainHtml).catch(() => '')); } }
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
          await p.fill('input[type=email], input[name*=mail i], input[name*=user i], input[type=text]:visible', email, { timeout: 8000 });
          await p.fill('input[type=password]', pass, { timeout: 8000 });
          // the platform's sign-in control is a script-driven div (div#confirm.main_btn.form_btn), not a button / form submit
          await p.click('#confirm, .main_btn.form_btn', { timeout: 8000 });
          await p.waitForURL(u => !/\/account\/login/.test(String(u)), { timeout: 15000 }).catch(() => {});
          await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
          await p.waitForTimeout(2500);
          res.login.landed = p.url().slice(0, 120); res.login.stillOnLogin = /login/i.test(p.url());
          res.loggedIn = [];
          for (const ap of ['/account', '/account/orders'].concat(ORDER_PATH ? [ORDER_PATH] : [])) {
            await go(host + ap);
            await p.waitForTimeout(1500);
            const lines = (await p.evaluate(textLines)).map(mask);
            res.loggedIn.push({ path: ap, finalUrl: p.url().slice(0, 120), lines });
            await p.screenshot({ path: path.join(OUT, `${tag}-in-${ap.replace(/\W+/g, '_')}.png`), fullPage: true });
            emit(tag, 'loggedin', ap + ' -> ' + p.url().replace(host, ''), lines.slice(0, 120).map(l => '   | ' + l).join('\n'));
            if (ap === ORDER_PATH) emit(tag, 'panel', 'live', JSON.stringify(await p.evaluate(() => ({ trackingPanel: !!document.querySelector('.mo-track'), originalTrackingBlockHidden: (() => { const t = document.querySelector('.tracking-warp'); return t ? getComputedStyle(t).display === 'none' : null; })(), fontLink: !!document.getElementById('mo-account-fonts'), skinVar: getComputedStyle(document.documentElement).getPropertyValue('--mo-account-skin').trim() })).catch(() => null)));
            emit(tag, 'style', 'in' + ap, JSON.stringify(await p.evaluate(styleFacts).catch(() => null), null, 1));
            if (vpName === 'desktop') { emit(tag, 'outline', 'in' + ap, (await p.evaluate(outline, 6).catch(() => [])).join('\n')); emit(tag, 'html', 'in' + ap, (await p.evaluate(mainHtml).catch(() => '')).replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, 'x@x')); }
            // follow the injected "Track package" button to the carrier (read-only; what a buyer's click does): does the carrier page open and show the number?
            if (ap === ORDER_PATH && vpName === 'desktop' && JS) {
              const href = await p.evaluate(() => { const a = document.querySelector('.mo-track a.mo-track-btn'); return a && !a.classList.contains('mo-track-2') ? a.href : ''; }).catch(() => '');
              if (href) {
                const cp = await ctx.newPage(); let info = { href: href.replace(/(tLabels=|tracknum=|AWB=|trknbr=)[^&]+/, '$1<number>') };
                try { const r = await cp.goto(href, { waitUntil: 'domcontentloaded', timeout: 30000 }); await cp.waitForTimeout(5000); info.status = r && r.status(); info.finalUrl = cp.url().replace(/(tLabels=|tracknum=|AWB=|trknbr=)[^&]+/, '$1<number>'); info.title = await cp.title(); info.lines = (await cp.evaluate(() => document.body.innerText.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 40))).map(l => l.replace(/[A-Z]{2}\d{9}[A-Z]{2}|\d{20,}/g, '<number>')); await cp.screenshot({ path: path.join(OUT, `${tag}-carrier.png`) }); } catch (e) { info.error = String(e.message || e).split('\n')[0].slice(0, 160); }
                await cp.close(); emit(tag, 'carrier', 'usps-track', JSON.stringify(info, null, 1));
              } else emit(tag, 'carrier', 'usps-track', 'no Track package button found');
            }
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
      + (res.account || []).map(a => `${a.path} ${a.status}→${a.finalUrl.replace(host, '')}`).join(' , ') + ` | account skin: ${res.injected ? '(injected by the probe, not a live check)' : (res.skin || 'NOT PASTED')}` + ` | order page ${res.orderPage ? res.orderPage.status : '?'}${res.login ? ' | login ' + (res.login.error ? 'ERR ' + res.login.error : (res.login.stillOnLogin ? 'FAILED (still on login)' : 'ok')) : ''}`);
    await ctx.close();
  }
  await browser.close();
  console.log('\n===== SUMMARY =====\n' + summary.join('\n'));
}
main().catch(e => { console.error(e); process.exit(1); });
