'use strict';
/**
 * READ-ONLY probe of the stores' add-to-cart pop-up and cart page (www, us, es, fr, it). Run by .github/workflows/probe-cart-ui.yml on a GitHub runner
 * (the sandbox cannot reach the stores). Anonymous: no account, no checkout, nothing submitted except one "add to cart" click on a public product
 * in a throwaway browser session.
 * Per store, desktop (1440) and phone (390): open a product page, click add-to-cart, record + screenshot whatever overlay appears (computed styles, text,
 * buttons), then open /cart and record the same plus layout problems (horizontal overflow, small tap targets, broken images, fonts in use, button contrast).
 * Output: probe-cart-out/<store>-<viewport>-{product,popup,cart}.png + <store>-<viewport>.json, summary at the end of the log. Docs: docs/store-cart-ui.md.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const OUT = path.join(__dirname, '..', 'probe-cart-out'); fs.mkdirSync(OUT, { recursive: true });
const STORES = [['www', 'https://www.momuto.com'], ['us', 'https://us.momuto.com'], ['es', 'https://es.momuto.com'], ['fr', 'https://fr.momuto.com'], ['it', 'https://it.momuto.com']];
const VIEWPORTS = [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]];
const ONLY = (process.env.PROBE_STORES || 'all').toLowerCase().split(',').map(s => s.trim());
const ADD_RE = /add to (cart|bag)|añadir al (carrito|cesta)|agregar al carrito|ajouter au panier|aggiungi al carrello/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));
// PROBE_CSS=<file> (or 'none'): stylesheet injected into every page of the session, BEFORE the page scripts run, so the pop-up that appears on click is skinned too
const CSS = process.env.PROBE_CSS && fs.existsSync(process.env.PROBE_CSS) ? fs.readFileSync(process.env.PROBE_CSS, 'utf8') : '';
const SUF = CSS ? '-css' : '';
const slim = h => String(h).replace(/<svg[\s\S]*?<\/svg>/gi, '<svg/>').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/\s(data-[\w-]+|srcset|sizes|loading)="[^"]*"/g, '').replace(/\s+/g, ' ');

// runs in the page: facts about an element subtree
const facts = (root) => {
  const R = root || document.body;
  const vis = e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none' && +c.opacity > 0; };
  const sty = e => { const c = getComputedStyle(e), r = e.getBoundingClientRect(); return { tag: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.') : ''),
    text: (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 70), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
    font: c.fontFamily.split(',')[0].replace(/["']/g, ''), size: c.fontSize, weight: c.fontWeight, ls: c.letterSpacing, tt: c.textTransform, color: c.color, bg: c.backgroundColor,
    border: c.borderTopWidth + ' ' + c.borderTopStyle + ' ' + c.borderTopColor, radius: c.borderRadius, shadow: c.boxShadow === 'none' ? '' : c.boxShadow.slice(0, 60), z: c.zIndex, pos: c.position }; };
  const lum = s => { const m = s.match(/[\d.]+/g); if (!m) return null; const [r, g, b] = m.slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); if (x == null || y == null) return null; const [hi, lo] = x > y ? [x, y] : [y, x]; return +((hi + .05) / (lo + .05)).toFixed(2); };
  const effBg = e => { for (let n = e; n; n = n.parentElement) { const bg = getComputedStyle(n).backgroundColor; if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg; } return 'rgb(255, 255, 255)'; };
  const all = [...R.querySelectorAll('*')].filter(vis);
  const fam = {}; all.forEach(e => { const t = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(''); if (t) { const f = getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, ''); fam[f] = (fam[f] || 0) + t.length; } });
  const ctrl = all.filter(e => e.matches('button, a.button, [role=button], input[type=submit], a[class*=btn], div[class*=btn], [class*=button]') && (e.innerText || e.value || '').trim()).slice(0, 14)
    .map(e => ({ ...sty(e), contrast: contrast(getComputedStyle(e).color, effBg(e)) }));
  const heads = all.filter(e => /^H[1-6]$/.test(e.tagName) || /title|name/i.test(typeof e.className === 'string' ? e.className : '')).filter(e => (e.innerText || '').trim().length < 90).slice(0, 10).map(sty);
  const small = all.filter(e => e.matches('button, a[href], [role=button], input:not([type=hidden]), select, [class*=btn], [class*=close], [class*=qty], [class*=quantity] *')).map(e => ({ e, r: e.getBoundingClientRect() }))
    .filter(o => o.r.width > 0 && (o.r.height < 36 || o.r.width < 36)).slice(0, 12).map(o => ({ ...sty(o.e), note: 'tap target < 36px' }));
  const imgs = [...R.querySelectorAll('img')].filter(vis).map(i => ({ src: (i.currentSrc || i.src || '').slice(-60), w: Math.round(i.getBoundingClientRect().width), h: Math.round(i.getBoundingClientRect().height), broken: !i.complete || i.naturalWidth === 0 })).slice(0, 10);
  return { fonts: fam, controls: ctrl, headings: heads, smallTargets: small, images: imgs, text: (R.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 900) };
};
// runs in the page: the overlay (pop-up / drawer) that appeared, if any
const findOverlay = () => {
  const vw = innerWidth, vh = innerHeight;
  const cand = [...document.querySelectorAll('body *')].filter(e => { const c = getComputedStyle(e), r = e.getBoundingClientRect();
    return (c.position === 'fixed' || c.position === 'absolute') && r.width > 180 && r.height > 120 && c.display !== 'none' && c.visibility !== 'hidden' && +c.opacity > 0 && !e.closest('header, footer')
      && /cart|carrito|panier|carrello|checkout|continue|seguir|continuer|continua|view|ver |voir|vedi/i.test(e.innerText || '') && r.bottom > 0 && r.right > 0 && r.left < vw && r.top < vh; });
  cand.sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height);
  return cand[0] || null;
};

(async () => {
  const browser = await chromium.launch();
  const summary = [];
  for (const [key, base] of STORES) {
    if (!(ONLY.includes('all') || ONLY.includes(key))) continue;
    for (const [vp, size] of VIEWPORTS) {
      const tag = `${key}-${vp}${SUF}`, rep = { store: key, viewport: vp };
      const ctx = await browser.newContext({ viewport: size, isMobile: vp === 'phone', locale: 'en-US' });
      const page = await ctx.newPage();
      if (CSS) await page.addInitScript(css => { const add = () => { const st = document.createElement('style'); st.id = 'mo-probe-css'; st.textContent = css; (document.head || document.documentElement).appendChild(st); }; if (document.head) add(); else document.addEventListener('DOMContentLoaded', add); }, CSS);
      try {
        await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(2500);
        const prod = await page.evaluate(() => { const a = [...document.querySelectorAll('a[href*="/products/"]')].map(a => a.getAttribute('href')).filter(h => /\/products\//.test(h) && !/fast.?lane/i.test(h)); return a[0] || null; });
        rep.productUrl = prod;
        if (!prod) { rep.error = 'no product link on the home page'; summary.push(`${tag}: ${rep.error}`); continue; }
        await page.goto(new URL(prod, base).href, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(3000);
        await page.screenshot({ path: path.join(OUT, `${tag}-product.png`) });
        // try to pick a first value for any option group so add-to-cart is allowed (best effort, no submit)
        await page.evaluate(() => { document.querySelectorAll('[class*=variant] [class*=item]:not([class*=disabled]):not([class*=active]), [class*=sku] [class*=item]:not([class*=disabled]):not([class*=active]), [class*=option] li:not([class*=disabled])').forEach((e, i) => { if (i < 3) try { e.click(); } catch (_) {} }); });
        await sleep(600);
        const btn = page.locator('button, a, div[role=button], [class*=btn], [class*=button]').filter({ hasText: ADD_RE }).first();
        rep.addButton = await btn.count() ? await btn.evaluate(e => ({ text: (e.innerText || '').trim().slice(0, 40) })) : null;
        if (rep.addButton) {
          await btn.scrollIntoViewIfNeeded().catch(() => {}); await btn.click({ timeout: 8000 }).catch(e => { rep.clickError = e.message.slice(0, 120); });
          await sleep(2200);
          const ov = await page.evaluateHandle(findOverlay); const el = ov.asElement();
          if (el) { rep.popup = await el.evaluate(facts).catch(e => ({ error: e.message })); rep.popupBox = await el.evaluate(e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bg: c.backgroundColor, radius: c.borderRadius, shadow: c.boxShadow.slice(0, 80), z: c.zIndex, pos: c.position, tag: e.tagName.toLowerCase() + '.' + String(e.className).slice(0, 80) }; }); }
          rep.popupFound = !!el;
          if (el) fs.writeFileSync(path.join(OUT, `${tag}-popup.html`), slim(await el.evaluate(e => (e.closest('[class*=popup], [class*=modal], [class*=drawer]') || e).outerHTML)).slice(0, 30000));
          await page.screenshot({ path: path.join(OUT, `${tag}-popup.png`) });
        } else { rep.error = 'no add-to-cart button found on the product page'; }
        await page.goto(base + '/cart', { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(3500);
        rep.cartUrl = page.url();
        rep.cart = await page.evaluate(facts, await page.evaluateHandle(() => document.body));
        rep.cartLayout = await page.evaluate(() => ({ hScroll: document.documentElement.scrollWidth > innerWidth + 1, scrollW: document.documentElement.scrollWidth, innerW: innerWidth, bodyBg: getComputedStyle(document.body).backgroundColor, bodyFont: getComputedStyle(document.body).fontFamily.slice(0, 60), title: document.title, h1: [...document.querySelectorAll('h1')].map(h => h.innerText.trim().slice(0, 60)) }));
        await page.screenshot({ path: path.join(OUT, `${tag}-cart.png`), fullPage: true });
        fs.writeFileSync(path.join(OUT, `${tag}-cart.html`), slim(await page.evaluate(() => { const m = document.querySelector('#MainContent, main, [id*=cart]') ; return (document.querySelector('[class*=cart-page], [class*=cart_page], #cart, [id*=cart_]') || m || document.body).outerHTML; })).slice(0, 40000));
        rep.cartStyles = await page.evaluate(() => { const q = s => document.querySelector(s), cs = e => e && ({ tag: e.tagName + '.' + String(e.className).slice(0, 60), bg: getComputedStyle(e).backgroundColor, color: getComputedStyle(e).color, font: getComputedStyle(e).fontFamily.slice(0, 40), size: getComputedStyle(e).fontSize }); return { bar: cs(q('[class*=announcement], [class*=top-bar], [class*=topbar]')), header: cs(q('header')), footer: cs(q('footer')) }; });
      } catch (e) { rep.error = (rep.error ? rep.error + ' | ' : '') + e.message.slice(0, 200); }
      fs.writeFileSync(path.join(OUT, `${tag}.json`), JSON.stringify(rep, null, 1));
      summary.push(`${tag}: product ${rep.productUrl || '-'} | add btn ${rep.addButton ? '"' + rep.addButton.text + '"' : 'NO'} | popup ${rep.popupFound ? 'YES ' + (rep.popupBox ? rep.popupBox.w + 'x' + rep.popupBox.h : '') : 'no'} | cart ${rep.cartUrl || '-'} hScroll=${rep.cartLayout && rep.cartLayout.hScroll} fonts=${JSON.stringify(rep.cart && rep.cart.fonts)}${rep.error ? ' | ERROR ' + rep.error : ''}`);
      await ctx.close();
    }
  }
  await browser.close();
  console.log('\n===== SUMMARY =====\n' + summary.join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
