// drive-pdp-estimator.js: the PDP price estimator (public/configurator/custom-content.js) with the gift line, in headless Chromium.
//   NODE_PATH=/opt/node-tools/node_modules node scripts/drive-pdp-estimator.js
// Stub product page (#momuto-custom + #goto3d); pricing.js is served from this repo in place of https://www.momuto.com/pricing.js.
const { chromium } = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'public', 'configurator');
const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u.startsWith('/page')) { const q = new URL(req.url, 'http://x').searchParams; res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(`<!doctype html><html lang="${q.get('lang')}"><head><meta charset="utf-8"><title>${q.get('title') || 'Custom jersey'}</title></head><body><div class="control-product_detail-title">${q.get('title') || 'Custom jersey'}</div><button id="goto3d">Customise</button><div id="momuto-custom" data-lang="${q.get('lang')}" data-kit="${q.get('kit')}"></div><script src="/custom-content.js"></script></body></html>`); }
  try { res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' }); res.end(fs.readFileSync(path.join(DIR, u))); } catch (e) { res.writeHead(404); res.end(); }
}).listen(8955);
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const run = async (lang, kit, qty) => {
    const p = await b.newPage();
    await p.route('https://www.momuto.com/pricing.js*', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(DIR, 'pricing.js'), 'utf8') }));
    p.on('pageerror', e => console.log('PAGEERR', e.message));
    await p.goto(`http://127.0.0.1:8955/page?lang=${lang}&kit=${kit}`); await p.waitForSelector('.mest-out', { timeout: 8000 });
    if (qty) { await p.fill('.mest input', String(qty)); await p.waitForTimeout(100); }
    const r = { gift: await p.$('.mest-gift') ? await p.textContent('.mest-gift') : null, sum: await p.textContent('.mest-sum') };
    await p.close(); return r;
  };
  let r = await run('en', 'kit');            ok(/Includes a free team flag \+ captain armband/.test(r.gift), 'kit PDP, default 10: gift included -> ' + r.gift);
  r = await run('en', 'kit', 9);             ok(/from 10 kits/.test(r.gift), 'kit PDP, 9: "from 10 kits" -> ' + r.gift);
  r = await run('en', 'jersey');             ok(r.gift === null, 'JERSEY PDP, 10: no gift line at all');
  r = await run('en', 'jersey', 100);        ok(r.gift === null, 'JERSEY PDP, 100: no gift line');
  r = await run('es', 'kit', 12);            ok(/brazalete de capit/.test(r.gift), 'ES kit PDP, 12 -> ' + r.gift);
  r = await run('fr', 'kit', 3);             ok(/dès 10 kits/.test(r.gift), 'FR kit PDP, 3 -> ' + r.gift);
  r = await run('it', 'kit', 20);            ok(/fascia da capitano/.test(r.gift), 'IT kit PDP, 20 -> ' + r.gift);
  await b.close(); srv.close(); process.exit(fails ? 2 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
