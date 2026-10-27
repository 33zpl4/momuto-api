'use strict';
/**
 * Reproduce a GUEST share on the 3D designer (customer report 27 Oct 2026: "I press share, send the link, and the link shows the default jersey, not our design").
 * Anonymous throwaway browser, like a customer: open the designer from a site launch link, click through the intro, change the design (second thumbnail), press
 * Share, copy the link, then open that link in a SECOND fresh browser (a teammate) and compare. Records the design-server calls made when Share is pressed.
 * Creates one guest share record on the design server, exactly as a customer does. Read-only otherwise.
 */
const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const OUT = path.join(__dirname, '..', 'probe-share-out'); fs.mkdirSync(OUT, { recursive: true });
const LANG = process.env.PROBE_LANG || 'es';
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.log('HARD TIMEOUT'); process.exit(2); }, 9 * 60 * 1000);
const NOISE = /google|doubleclick|facebook|clarity|hotjar|tiktok|pinterest|hubspot|twitter|trustpilot|sentry|\.(png|jpe?g|webp|svg|gif|woff2?|css|ico|glb|js|map)(\?|$)/i;
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: LANG, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage(); const calls = []; let phase = 'load';
  page.on('response', async r => { try { const u = r.url(); if (NOISE.test(u) || /momuto\.com\/(app-|homeapi)/.test(u)) return; let b = ''; try { b = (await r.text()).slice(0, 220).replace(/\s+/g, ' '); } catch (e) {} calls.push(`[${phase}] ${r.request().method()} ${r.status()} ${u.replace('https://design.momuto.com', '').slice(0, 150)} ${(r.request().postData() || '').slice(0, 160)} => ${b}`); } catch (e) {} });
  page.on('console', m => { if (m.type() === 'error') calls.push(`[${phase}] console.error ${m.text().slice(0, 160)}`); });
  const url = `https://design.momuto.com/3d-configurator/configurator.html?userId=userIdUrl&configId=ypi9qc1z&suitName=mamuto3suit1&lang=${LANG}&langguage=${LANG}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('canvas', { timeout: 45000 }).catch(() => {}); await sleep(15000);
  for (let i = 0; i < 6; i++) { const nx = page.locator(':text-matches("^\\\\s*(next|siguiente|suivant|avanti)\\\\s*$", "i")').filter({ visible: true }).last(); if (!await nx.count()) break; await nx.click({ timeout: 4000 }).catch(() => {}); await sleep(1500); }
  await sleep(3000);
  await page.screenshot({ path: path.join(OUT, '1-tool-start.png'), timeout: 15000 }).catch(() => {});
  phase = 'edit';
  await page.mouse.click(155, 245); await sleep(8000);                       // FIRST design thumbnail (blue stripes): clearly not the default teal
  await page.screenshot({ path: path.join(OUT, '2-tool-edited.png'), timeout: 15000 }).catch(() => {});
  const ids = await page.evaluate(() => ({ UUID3D: localStorage.getItem('UUID3D'), cookie: (document.cookie.match(/_US_2613_=([^;]*)/) || [])[1] || null, href: location.href }));
  console.log('ids before share:', JSON.stringify(ids));
  phase = 'share';
  const sh = page.locator('button, div, span').filter({ hasText: /^\s*(compartir|share)\s*$/i }).filter({ visible: true }).first();
  console.log('share control found:', await sh.count());
  await sh.click({ timeout: 30000, force: true }).catch(e => console.log('share click failed', e.message.slice(0, 80)));
  const t0 = Date.now();
  const dlg = await page.waitForSelector(':text-matches("^\\s*(copiar enlace|copy link)\\s*$", "i")', { timeout: 150000, state: 'visible' }).then(() => true).catch(() => false);
  console.log('share dialog appeared:', dlg, 'after', Math.round((Date.now() - t0) / 1000), 's');
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, '3-share-dialog.png'), timeout: 30000 }).catch(() => {});
  const cp = page.locator('button, div, span').filter({ hasText: /^\s*(copiar enlace|copy link)\s*$/i }).filter({ visible: true }).first();
  let link = null;
  if (await cp.count()) { await cp.click({ timeout: 5000 }).catch(() => {}); await sleep(1500); link = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null); }
  console.log('copied link:', link);
  const ids2 = await page.evaluate(() => ({ UUID3D: localStorage.getItem('UUID3D'), cookie: (document.cookie.match(/_US_2613_=([^;]*)/) || [])[1] || null }));
  console.log('ids after share:', JSON.stringify(ids2));
  console.log('--- design-server calls (non-asset) ---\n' + calls.join('\n'));
  const target = link && /share\.html/.test(link) ? link : `https://design.momuto.com/3d-configurator/share.html?&configId=ypi9qc1z&suitName=mamuto3suit1&lang=${LANG}&u=${ids2.UUID3D}&useGetShare=true`;
  console.log('opening link in a fresh browser:', target);
  const ctx2 = await browser.newContext({ viewport: { width: 1000, height: 800 }, locale: LANG }); const p2 = await ctx2.newPage();
  await p2.goto(target, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => console.log('goto2', e.message.slice(0, 80)));
  await sleep(45000);
  await p2.screenshot({ path: path.join(OUT, '4-shared-view.png'), timeout: 60000 }).catch(e => console.log('shot4', e.message.slice(0, 60)));
  console.log('done'); await browser.close().catch(() => {}); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
