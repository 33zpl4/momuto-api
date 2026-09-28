'use strict';
// Runs the REAL scripts/set-order-line-tiles.js against a local mock of the platform API
// and of the tile host. node scripts/test-set-order-line-tiles.js
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

// async (NOT spawnSync): the mock API runs in this process and must keep answering while the script runs
function runNode(env) {
  return new Promise(resolve => {
    const c = spawn('node', ['scripts/set-order-line-tiles.js'], { env });
    let out = ''; c.stdout.on('data', d => out += d); c.stderr.on('data', d => out += d);
    c.on('close', status => resolve({ status, all: out }));
  });
}

const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(7000, 1)]);
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };

function startServer(state) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x');
      if (u.pathname.startsWith('/tiles/')) {
        const f = u.pathname.split('/').pop();
        if (state.missingTiles && state.missingTiles.includes(f)) { res.writeHead(404); return res.end('nope'); }
        res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG);
      }
      const m = u.pathname.match(/^\/products\/(\d+)$/);
      const json = (o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (!m) return json({ code: 404, msg: 'no route' });
      const p = state.products[m[1]];
      state.log.push(`${req.method} ${m[1]}`);
      if (req.method === 'GET') {
        if (state.throttleFirstGet && !state.throttled[m[1]]) { state.throttled[m[1]] = true; return json({ code: 1000, msg: 'Too many requests' }); }
        return p ? json({ code: 0, data: JSON.parse(JSON.stringify(p)) }) : json({ code: 404, msg: 'not found' });
      }
      let body = ''; req.on('data', c => body += c); req.on('end', () => {
        const put = JSON.parse(body);
        if (!put.variants || !put.variants.length) return json({ code: 500, msg: 'no variants' });
        if (state.dropImages) { /* platform accepts but ignores the images */ }
        else p.images = put.images.map((i, k) => ({ src: i.src.startsWith('http://127') ? `https://cdn.example/${m[1]}-${k}.jpg` : i.src, alt: i.alt }));
        if (state.regenIds) p.variants = p.variants.map(v => ({ ...v, id: v.id + 1000 }));
        state.puts.push({ id: m[1], images: put.images });
        json({ code: 0, data: { id: Number(m[1]) } });
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}
const product = (id, title, imgs = ['https://cdn.example/old.jpg']) => ({ id, title, status: 1, handle: 'h' + id, variants: [{ id: id * 10, price: '38.90', option1_value_title: 'One size' }], images: imgs.map(s => ({ src: s })) });

async function run(port, env) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'tiles-'));
  const r = await runNode({ ...process.env, OEM_HOST: `http://127.0.0.1:${port}`, TILE_BASE: `http://127.0.0.1:${port}/tiles/`, OEMSAAS_TOKEN_EN: 't', OEMSAAS_TOKEN_US: 't', OUT_DIR: out, LANGS: 'en,us', ...env });
  return { ...r, out };
}

(async () => {
  // ids used by the real products.json for KINDS=jersey,fastlane on en+us
  const base = () => ({ products: { 4174483: product(4174483, 'MOMUTO Pro Jersey'), 16913785: product(16913785, 'MOMUTO Pro Jersey'), 10622488: product(10622488, 'Fast lane', ['https://cdn.example/stock.jpg']), 17370625: product(17370625, 'Fast lane') }, log: [], puts: [], throttled: {} });

  // 1 dry run writes nothing
  let st = base(); let srv = await startServer(st); let r = await run(srv.address().port, { KINDS: 'jersey,fastlane', DRY_RUN: 'true' });
  check('dry run: plans 4 products, sends no PUT', r.status === 0 && st.puts.length === 0 && (r.all.match(/→ order-tile-/g) || []).length === 4, `puts=${st.puts.length}`);
  check('dry run: US uses the English tile', /\[us\] fastlane 17370625[^\n]*order-tile-fastlane-en\.png/.test(r.all));
  srv.close();

  // 2 live run: images replaced, verified, rollback written
  st = base(); srv = await startServer(st); r = await run(srv.address().port, { KINDS: 'jersey,fastlane', DRY_RUN: 'false' });
  const rb = fs.readdirSync(r.out).filter(f => f.startsWith('rollback-'));
  check('live: 4 PUTs, all verified', r.status === 0 && st.puts.length === 4 && (r.all.match(/DONE ✅/g) || []).length === 4, r.all.split('\n').filter(l => /ERROR|MISMATCH/.test(l)).join(' | '));
  check('live: the sent image is the tile, alt marks it', st.puts.every(p => /order-tile-(jersey|fastlane)-en\.png$/.test(p.images[0].src) && /\(order line tile\)$/.test(p.images[0].alt)));
  const rbj = rb.length ? JSON.parse(fs.readFileSync(path.join(r.out, rb[0]), 'utf8')) : null;
  check('live: rollback file keeps the previous images', rbj && rbj.entries.length === 4 && rbj.entries.find(e => e.id === '10622488').images_before[0].src === 'https://cdn.example/stock.jpg');
  const rollbackPath = rb.length ? path.join(r.out, rb[0]) : null;

  // 3 re-run is idempotent (already the tile -> no PUT)
  const before = st.puts.length; r = await run(srv.address().port, { KINDS: 'jersey,fastlane', DRY_RUN: 'false' });
  check('re-run: nothing to do, no PUT', r.status === 0 && st.puts.length === before && (r.all.match(/already the tile/g) || []).length === 4, `puts ${before}→${st.puts.length}`);

  // 4 rollback restores
  if (rollbackPath) {
    r = await runNode({ ...process.env, OEM_HOST: `http://127.0.0.1:${srv.address().port}`, OEMSAAS_TOKEN_EN: 't', OEMSAAS_TOKEN_US: 't', ROLLBACK_FILE: rollbackPath, DRY_RUN: 'false' });
    check('rollback: previous images are back', r.status === 0 && st.products[10622488].images[0].src === 'https://cdn.example/stock.jpg', r.all.split('\n').slice(-3).join(' | '));
  }
  srv.close();

  // 5 tile not deployed yet -> everything skipped, nothing written
  st = base(); srv = await startServer(st); st.missingTiles = ['order-tile-jersey-en.png', 'order-tile-fastlane-en.png'];
  r = await run(srv.address().port, { KINDS: 'jersey,fastlane', DRY_RUN: 'false' });
  check('tile missing: skipped with a clear reason, no PUT', st.puts.length === 0 && /SKIP tile not reachable/.test(r.all));
  srv.close();

  // 6 platform ignores the images -> MISMATCH, exit 1
  st = base(); st.dropImages = true; srv = await startServer(st);
  r = await run(srv.address().port, { KINDS: 'fastlane', DRY_RUN: 'false' });
  check('platform ignores images: caught by the read-back, exit 1', r.status === 1 && /MISMATCH image unchanged/.test(r.all), r.all.split('\n').filter(l => /MISMATCH/.test(l))[0]);
  srv.close();

  // 7 variant ids regenerated -> reported, still verified
  st = base(); st.regenIds = true; srv = await startServer(st);
  r = await run(srv.address().port, { KINDS: 'fastlane', DRY_RUN: 'false' });
  check('variant-id churn is reported as evidence', r.status === 0 && /variant ids regenerated/.test(r.all));
  srv.close();

  // 8 throttled GET retries instead of reading as not found
  st = base(); st.throttleFirstGet = true; srv = await startServer(st);
  r = await run(srv.address().port, { KINDS: 'fastlane', LANGS: 'en', DRY_RUN: 'true' });
  check('throttled GET is retried, not treated as missing', r.status === 0 && /→ order-tile-fastlane-en/.test(r.all), r.all.split('\n').slice(-3).join(' | '));
  srv.close();

  // 9 a product with no variants is never PUT
  st = base(); st.products[10622488].variants = []; srv = await startServer(st);
  r = await run(srv.address().port, { KINDS: 'fastlane', LANGS: 'en', DRY_RUN: 'false' });
  check('no variants on GET: refuses to PUT', st.puts.length === 0 && /no variants/.test(r.all) && r.status === 1);
  srv.close();

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
