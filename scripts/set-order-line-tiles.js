'use strict';
/**
 * Replace the catalog image of the generic billable / option products with the
 * order-line tiles (design-momuto scripts/order-line-tiles, v2), on every store.
 *
 *   DRY_RUN=true  node scripts/set-order-line-tiles.js            # default: plan only, writes nothing
 *   DRY_RUN=false node scripts/set-order-line-tiles.js            # apply
 *   ROLLBACK_FILE=cms/order-line-tiles/rollback-….json DRY_RUN=false node scripts/set-order-line-tiles.js
 *
 * Env: KINDS  (default jersey,shorts,socks,longsleeves,polocollar,fastlane; opt-in:
 *              basketjersey,basketshorts)
 *      LANGS  (default en,es,fr,it,us)
 *      OEMSAAS_TOKEN_<STORE>, DRY_RUN (default true), ROLLBACK_FILE, TILE_BASE
 *
 * Why these products: the platform cart / CMS order / confirmation email show the
 * product's catalog image, and the cart API has no per-line image (server-patches
 * README §3). The tile says "made to your custom design" instead of showing a
 * stock jersey (fast lane used to carry one).
 *
 * Write path (docs/oemsaas-api-notes.md): there is no image-only endpoint and
 * batchsave silently drops `images`, so PUT /products/{id} read-modify-write:
 * `{ ...live, images: [tile] }`. Guards:
 *   - refuses without title / variants on the GET (a blind PUT drops the sizes)
 *   - the tile URL must answer 200 image/png first (merge design-momuto and let
 *     Deploy SFTP finish, or every product is skipped with a clear reason)
 *   - reads every product back: title, status, variant count / sizes / prices and
 *     images (1, changed) must match; reports whether variant ids were regenerated
 *     (a PUT with a new price did regenerate them, 5 Sep 2026 — checkout adds
 *     lines by product id, so it is not expected to matter; the report is evidence)
 *   - writes 700 ms apart; throttled (code 1000) GETs/PUTs retry with backoff and
 *     a throttled GET THROWS (never reads as "not found")
 *   - the previous image list of every product is written to
 *     rollback-<timestamp>.json (the workflow commits it) so a rollout can be undone.
 * Runs on the GitHub runner — the sandbox cannot reach openapi.oemapps.com.
 */

const fs = require('fs');
const path = require('path');

// tests point this at a local mock (scripts/test-set-order-line-tiles.js); nothing else may override it
const HOST = /^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.OEM_HOST || '') ? process.env.OEM_HOST : 'https://openapi.oemapps.com';
const OUT_DIR = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : null;
const ROOT = path.join(__dirname, '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'cms', 'order-line-tiles', 'products.json'), 'utf8'));
const TILE_BASE = (process.env.TILE_BASE || CFG.tileBase).replace(/\/?$/, '/');
const DRY_RUN = process.env.DRY_RUN !== 'false';
const KINDS = (process.env.KINDS || 'jersey,shorts,socks,longsleeves,polocollar,fastlane').split(',').map(s => s.trim()).filter(Boolean);
const LANGS = (process.env.LANGS || 'en,es,fr,it,us').split(',').map(s => s.trim()).filter(Boolean);
const ROLLBACK_FILE = (process.env.ROLLBACK_FILE || '').trim();

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function api(token, method, endpoint, body, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${HOST}${endpoint}`, {
      method, headers: { 'Content-Type': 'application/json', token },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { throw new Error(`HTTP ${res.status} non-JSON: ${text.slice(0, 200)}`); }
    if (json.code === 0 || json.code === 200) return json;
    const throttled = json.code === 1000 || /Too many/i.test(json.msg || '');
    if (!throttled || i === tries - 1) throw new Error(`API code ${json.code}: ${json.msg}`);
    await sleep(1500 * (i + 1));
  }
}

// ids: cms/*/ids.json for the option kinds (value is a string or {id}), then the table above
function idFor(kind, store) {
  const table = (CFG.products[kind] || {})[store];
  const f = CFG.optionIdFiles[kind];
  if (f) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
      const v = j[store]; const fromFile = v && (typeof v === 'object' ? v.id : v);
      if (fromFile && table && String(fromFile) !== String(table)) console.log(`⚠️  ${kind}/${store}: ${f} says ${fromFile}, products.json says ${table} — using ${f}`);
      if (fromFile) return String(fromFile);
    } catch { /* fall through to the table */ }
  }
  return table ? String(table) : null;
}

const tileCache = new Map();
async function tileOk(url) {
  if (tileCache.has(url)) return tileCache.get(url);
  let out;
  try {
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get('content-type') || '';
    out = res.ok && /image\/png/i.test(type) && buf.length > 5000 ? { ok: true, bytes: buf.length }
      : { ok: false, why: `HTTP ${res.status} ${type} ${buf.length} bytes` };
  } catch (e) { out = { ok: false, why: e.message }; }
  tileCache.set(url, out);
  return out;
}

const sizes = (p) => (p.variants || []).map(v => v.option1_value_title || v.title || '');
const vids = (p) => (p.variants || []).map(v => v.id).join(',');

async function main() {
  const rows = [];          // summary table
  const rollback = [];      // previous images, for undo
  let bad = 0;

  // ---- rollback mode: restore the recorded image lists ---------------------
  if (ROLLBACK_FILE) {
    const entries = JSON.parse(fs.readFileSync(path.resolve(ROOT, ROLLBACK_FILE), 'utf8')).entries;
    console.log(`ROLLBACK from ${ROLLBACK_FILE}: ${entries.length} product(s)${DRY_RUN ? ' — DRY RUN' : ''}`);
    for (const e of entries) {
      const token = process.env[`OEMSAAS_TOKEN_${e.store.toUpperCase()}`];
      if (!token) { console.log(`[${e.store}] no token — skipped ${e.id}`); bad++; continue; }
      const live = (await api(token, 'GET', `/products/${e.id}`)).data;
      if (!live || !live.title || !live.variants || !live.variants.length) { console.log(`❌ ${e.store}/${e.id}: unusable GET — skipped`); bad++; continue; }
      console.log(`${e.store} ${e.kind} ${e.id} "${live.title}": images ${(live.images || []).length} → ${e.images_before.length}`);
      if (DRY_RUN) continue;
      await api(token, 'PUT', `/products/${e.id}`, { ...live, images: e.images_before });
      await sleep(800);
      const after = (await api(token, 'GET', `/products/${e.id}`)).data;
      const ok = after.title === live.title && (after.images || []).length === e.images_before.length;
      console.log(ok ? `   ✅ restored (${(after.images || [])[0] && after.images[0].src})` : '   ❌ read-back mismatch');
      if (!ok) bad++;
      await sleep(700);
    }
    process.exit(bad ? 1 : 0);
  }

  console.log(`kinds=${KINDS.join(',')}  langs=${LANGS.join(',')}  tiles=${TILE_BASE}  ${DRY_RUN ? 'DRY RUN — nothing is written' : 'LIVE'}`);
  for (const kind of KINDS) {
    if (!CFG.products[kind]) { console.log(`❌ unknown kind "${kind}"`); bad++; continue; }
    for (const store of LANGS) {
      const id = idFor(kind, store);
      if (!id) continue;                                   // e.g. no US long-sleeves row, no IT garments
      const token = process.env[`OEMSAAS_TOKEN_${store.toUpperCase()}`];
      const row = { store, kind, id, state: '' };
      rows.push(row);
      if (!token) { row.state = 'SKIP no token'; continue; }
      const tile = `${TILE_BASE}order-tile-${kind}-${CFG.tileLang[store] || store}.png`;
      const t = await tileOk(tile);
      if (!t.ok) { row.state = `SKIP tile not reachable (${t.why})`; continue; }

      let live;
      try { live = (await api(token, 'GET', `/products/${id}`)).data; }
      catch (e) { row.state = `ERROR GET ${e.message}`; bad++; continue; }
      if (!live || !live.title) { row.state = 'SKIP GET returned no title'; bad++; continue; }
      if (!live.variants || !live.variants.length) { row.state = 'SKIP no variants on GET (would drop the buy button)'; bad++; continue; }
      row.title = live.title; row.before = (live.images || []).map(i => i.src);
      const alreadyTile = (live.images || []).length === 1 && (/\(order line tile\)$/.test(live.images[0].alt || '') || live.images[0].src === tile);
      if (alreadyTile) { row.state = 'OK already the tile'; continue; }
      console.log(`[${store}] ${kind} ${id} "${live.title}": ${row.before.length} image(s) → ${tile.split('/').pop()}  (variants ${live.variants.length})`);
      if (DRY_RUN) { row.state = 'PLAN'; continue; }

      rollback.push({ store, kind, id, title: live.title, images_before: live.images || [] });
      try {
        await api(token, 'PUT', `/products/${id}`, { ...live, images: [{ src: tile, alt: `${live.title} (order line tile)` }] });
        await sleep(800);
        const after = (await api(token, 'GET', `/products/${id}`)).data;     // code 0 is an ack, not evidence
        const prices = (p) => (p.variants || []).map(v => Number(v.price)).join(',');
        const problems = [];
        if (after.title !== live.title) problems.push('title changed');
        if (after.status !== live.status) problems.push(`status ${live.status}→${after.status}`);
        if ((after.variants || []).length !== live.variants.length) problems.push('variant count changed');
        if (sizes(after).join('|') !== sizes(live).join('|')) problems.push('variant sizes changed');
        if (prices(after) !== prices(live)) problems.push(`prices ${prices(live)}→${prices(after)}`);
        if ((after.images || []).length !== 1 || !after.images[0].src) problems.push(`images after: ${(after.images || []).length}`);
        else if (row.before.length === 1 && after.images[0].src === row.before[0]) problems.push('image unchanged');
        row.after = (after.images || []).map(i => i.src);
        row.variantIds = vids(after) === vids(live) ? 'unchanged' : 'regenerated';
        row.state = problems.length ? `MISMATCH ${problems.join('; ')}` : 'DONE ✅';
        if (problems.length) bad++;
      } catch (e) { row.state = `ERROR PUT ${e.message}`; bad++; }
      await sleep(700);
    }
  }

  console.log('\n──── summary ────');
  for (const r of rows) console.log(`${r.store}\t${r.kind}\t${r.id}\t${r.state}${r.variantIds ? `\t(variant ids ${r.variantIds})` : ''}${r.title ? `\t"${r.title}"` : ''}`);
  if (!DRY_RUN && rollback.length) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dir = OUT_DIR || path.join(ROOT, 'cms', 'order-line-tiles');
    const file = path.join(dir, `rollback-${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), tileBase: TILE_BASE, entries: rollback }, null, 2) + '\n');
    console.log(`\nrollback file: ${OUT_DIR ? file : 'cms/order-line-tiles/' + path.basename(file)} (${rollback.length} products) — restore with ROLLBACK_FILE`);
  }
  if (bad) { console.error(`\n❌ ${bad} problem(s) — read the lines above`); process.exit(1); }
  console.log(DRY_RUN ? '\nDRY RUN complete.' : '\n✅ all verified');
}

main().catch(e => { console.error(e); process.exit(1); });
