'use strict';
/**
 * READ-ONLY (anonymous throwaway cart): which cart endpoints do the stores' OWN pages call today? Opens a public product, clicks add-to-cart, opens /cart,
 * clicks the cart's own remove / clear controls, and prints every non-asset request the page made at each step (method + URL + status + body start).
 * Why: the checkout hand-off page (checkSumbit.html) calls POST /homeapi/cart/clean, which the platform answers {"code":404,"msg":"接口未定义"}.
 */
const { chromium } = require('playwright');
const STORES = [['www', 'https://www.momuto.com'], ['us', 'https://us.momuto.com'], ['es', 'https://es.momuto.com'], ['fr', 'https://fr.momuto.com'], ['it', 'https://it.momuto.com']];
const ONLY = (process.env.PROBE_STORES || 'www').split(',');
const ADD_RE = /add to (cart|bag)|añadir al (carrito|cesta)|agregar al carrito|ajouter au panier|aggiungi al carrello/i;
const NOISE = /google|doubleclick|facebook|clarity|hotjar|tiktok|pinterest|hubspot|hs-|twitter|ads-|gtag|trustpilot|sentry|\.(png|jpe?g|webp|svg|gif|woff2?|css|ico)(\?|$)/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch();
  for (const [k, base] of STORES) {
    if (!ONLY.includes(k) && !ONLY.includes('all')) continue;
    console.log('\n========== ' + k + ' ' + base);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-GB' }); const page = await ctx.newPage();
    let step = 'start'; const log = [];
    page.on('response', async r => { try { const u = r.url(), q = r.request(); if (NOISE.test(u) || !new URL(u).host.endsWith('momuto.com')) return; if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(q.method()) && !/homeapi|\/api\/|cart/i.test(u)) return; let b = ''; try { b = (await r.text()).slice(0, 160).replace(/\s+/g, ' '); } catch (e) {} if (/^<!doctype|^<html/i.test(b)) b = '(html)'; log.push(`[${step}] ${q.method()} ${r.status()} ${u.slice(0, 150)}  ${(q.postData() || '').slice(0, 120)}  => ${b}`); } catch (e) {} });
    try {
      await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(2500);
      const prod = await page.evaluate(() => { const a = [...document.querySelectorAll('a[href*="/products/"]')].map(a => a.getAttribute('href')).filter(h => /\/products\//.test(h) && !/fast.?lane/i.test(h)); return a[0] || null; });
      step = 'product'; await page.goto(new URL(prod, base).href, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(3000);
      await page.evaluate(() => { document.querySelectorAll('[class*=variant] [class*=item]:not([class*=disabled]):not([class*=active]), [class*=sku] [class*=item]:not([class*=disabled]):not([class*=active]), [class*=option] li:not([class*=disabled]):not([class*=active])').forEach((e, i) => { if (i < 3) e.click(); }); }); await sleep(600);
      step = 'add-to-cart'; const btn = page.locator('button, a, div[role=button], [class*=btn], [class*=button]').filter({ hasText: ADD_RE }).first(); await btn.click({ timeout: 8000 }); await sleep(3500);
      step = 'cart page'; await page.goto(base + '/cart', { waitUntil: 'networkidle', timeout: 60000 }); await sleep(2500);
      const ctl = await page.evaluate(() => [...document.querySelectorAll('[class*=delete],[class*=remove],[class*=trash],[class*=clear],[class*=del-]')].filter(e => e.getBoundingClientRect().width > 0).map(e => e.tagName + '.' + String(e.className).slice(0, 50)));
      console.log('cart remove/clear controls:', JSON.stringify(ctl.slice(0, 8)));
      step = 'delete-all control';
      page.on('dialog', d => d.accept().catch(() => {}));
      const all = page.locator('.cart_list_delete_all').filter({ visible: true }).first();
      if (await all.count()) {
        await all.click({ timeout: 5000 }).catch(e => console.log('click failed', e.message.slice(0, 80))); await sleep(1500);
        step = 'delete-all confirm';
        const ok = page.locator('button, a, div, span').filter({ hasText: /^\s*(ok|yes|confirm|delete|remove|sí|si|oui|confirmar|supprimer|elimina|eliminar|确定|确认)\s*$/i }).filter({ visible: true }).first();
        if (await ok.count()) { console.log('confirm control:', (await ok.innerText().catch(() => '')).trim()); await ok.click({ timeout: 4000 }).catch(() => {}); }
        await sleep(3500);
      } else console.log('no visible delete-all control');
      step = 'cart after';
      console.log('cart text after:', (await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 200))));
    } catch (e) { console.log('ERROR', e.message.slice(0, 200)); }
    console.log(log.join('\n') || '(no requests recorded)');
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
