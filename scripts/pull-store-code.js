// Pull every DIY file and every injected custom script from all four OEMSaaS
// stores into the repo, so the two admin "custom code" sections (Online Store →
// DIY files, and the custom-script manager) are versioned like everything else.
//
// Three passes per store:
//   1. DIY files    — full listing via GET /diyfiles (paginated), content saved
//                     verbatim to store-code/<store>/diy-files/<file_name>,
//                     plus an index.json with id/type/name per file.
//   2. Scripts API  — GET /scripts (discovered by probing on 2026-07-29; item
//                     GET /scripts/{id} is NOT defined). Returns id,
//                     script_name, display_routes, display_position, status,
//                     detail (the code). The endpoint serves 10 per page and
//                     ignores pagesize, so we walk `page` until a page repeats
//                     or comes back empty. Content goes verbatim to
//                     custom-scripts/<id>-<slug>.html, metadata to index.json.
//   3. Rendered     — guaranteed fallback: fetch the public storefront pages
//      storefront     and cut out every <!-- script N Start/End --> block the
//                     platform injected. Saved to
//                     store-code/<store>/rendered-scripts/script-<N>.html with
//                     a header noting which pages carried it. Checkout-only
//                     scripts appear here only if they're injected site-wide
//                     (most are — they guard on location.pathname themselves).
//
// Runs in GitHub Actions (pull-store-code.yml) where the OEMSAAS_TOKEN_* live.

const fs = require('fs');
const path = require('path');

const HOST = 'https://openapi.oemapps.com';

const STORES = {
  en: { token: process.env.OEMSAAS_TOKEN_EN, label: 'momuto.com', site: 'https://www.momuto.com' },
  es: { token: process.env.OEMSAAS_TOKEN_ES, label: 'es.momuto.com', site: 'https://es.momuto.com' },
  fr: { token: process.env.OEMSAAS_TOKEN_FR, label: 'fr.momuto.com', site: 'https://fr.momuto.com' },
  it: { token: process.env.OEMSAAS_TOKEN_IT, label: 'it.momuto.com', site: 'https://it.momuto.com' },
};

const OUT_ROOT = 'store-code';

// Public pages to scrape for injected script blocks. Broad on purpose: the
// script manager can scope entries to page types, so home alone is not enough.
const SCRAPE_PATHS = ['/', '/cart', '/account/login', '/account/register', '/collections/all'];


function safeName(name) {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, '_') || '_unnamed_';
}

function writeFile(relPath, content) {
  const full = path.join(OUT_ROOT, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  console.log(`  wrote ${full} (${Buffer.byteLength(content)} bytes)`);
}

async function api(store, apiPath) {
  const res = await fetch(`${HOST}/${apiPath}`, { headers: { token: store.token } });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) { /* non-JSON answer */ }
  return { status: res.status, json, text };
}

// ---------- 1. DIY files ----------

async function pullDiyFiles(store) {
  const all = [];
  const pagesize = 50;
  for (let page = 1; ; page++) {
    const { status, json } = await api(store, `diyfiles?page=${page}&pagesize=${pagesize}`);
    if (status !== 200 || !json || json.code !== 0) {
      console.log(`  diyfiles list failed on ${store.label}: HTTP ${status} code ${json && json.code}`);
      break;
    }
    const files = (json.data && json.data.list) || json.data || [];
    if (!Array.isArray(files) || files.length === 0) break;
    all.push(...files);
    if (files.length < pagesize) break;
  }

  const index = [];
  for (const f of all) {
    let content = f.content;
    if (content === undefined || content === null) {
      const { json } = await api(store, `diyfiles/${f.id}`);
      content = json && json.data && (json.data.content !== undefined ? json.data.content : json.data.file_content);
    }
    const fname = safeName(f.file_name || `id-${f.id}`);
    index.push({ id: f.id, file_name: f.file_name, type: f.type, saved_as: fname, has_content: content != null });
    writeFile(path.join(store.label, 'diy-files', fname), content != null ? String(content) : '');
  }
  writeFile(path.join(store.label, 'diy-files', 'index.json'), JSON.stringify(index, null, 2) + '\n');
  console.log(`  ${store.label}: ${all.length} DIY files`);
  return all.length;
}

// ---------- 2. custom scripts via GET /scripts ----------

// GET /scripts serves 10 per page and, unlike /diyfiles, ignores the
// page/pagesize params — so we don't know its pagination vocabulary. Try the
// common conventions and use the first one where page 2 actually returns
// different ids than page 1; record every attempt for diagnosis.
const PAGINATION_CONVENTIONS = [
  ['page&pagesize', p => `scripts?page=${p}&pagesize=10`],
  ['page&page_size', p => `scripts?page=${p}&page_size=10`],
  ['pageindex', p => `scripts?pageindex=${p}&pagesize=10`],
  ['page_no', p => `scripts?page_no=${p}&page_size=10`],
  ['pagenum', p => `scripts?pagenum=${p}&pagesize=10`],
  ['pageNum&pageSize', p => `scripts?pageNum=${p}&pageSize=10`],
  ['offset&limit', p => `scripts?offset=${(p - 1) * 10}&limit=10`],
  ['start&limit', p => `scripts?start=${(p - 1) * 10}&limit=10`],
];

function scriptList(json) {
  const list = json && json.code === 0 && ((json.data && json.data.list) || json.data);
  return Array.isArray(list) ? list : null;
}

async function pullCustomScripts(store) {
  const report = { store: store.label, attempts: [], chosen: null };
  let makeUrl = null;
  let firstPage = null;
  for (const [name, fn] of PAGINATION_CONVENTIONS) {
    const p1 = scriptList((await api(store, fn(1))).json);
    const p2 = scriptList((await api(store, fn(2))).json);
    const ids1 = p1 ? p1.map(s => s.id) : null;
    const ids2 = p2 ? p2.map(s => s.id) : null;
    const advances = !!(ids1 && ids2 && ids2.length && !ids2.some(id => ids1.includes(id)));
    report.attempts.push({ convention: name, page1: ids1 && ids1.slice(0, 3), page2: ids2 && ids2.slice(0, 3), advances });
    if (advances) {
      report.chosen = name;
      makeUrl = fn;
      firstPage = p1;
      break;
    }
    if (!firstPage && p1) firstPage = p1; // best effort if nothing advances
  }
  writeFile(path.join(store.label, 'custom-scripts', 'pagination-report.json'), JSON.stringify(report, null, 2) + '\n');
  if (!report.chosen) console.log(`  !! ${store.label}: no pagination convention advanced past page 1 — snapshot may be partial`);

  const seen = new Set();
  const all = [];
  (firstPage || []).forEach(s => { seen.add(s.id); all.push(s); });
  if (makeUrl) {
    for (let page = 2; page <= 200; page++) {
      const { status, json } = await api(store, makeUrl(page));
      const list = scriptList(json);
      if (status !== 200 || !list || list.length === 0) break;
      const fresh = list.filter(s => !seen.has(s.id));
      if (fresh.length === 0) break;
      fresh.forEach(s => seen.add(s.id));
      all.push(...fresh);
    }
  }

  const index = [];
  for (const s of all) {
    const slug = s.script_name ? '-' + safeName(s.script_name).slice(0, 60) : '';
    const fname = `${s.id}${slug}.html`;
    index.push({
      id: s.id,
      script_name: s.script_name,
      display_routes: s.display_routes,
      display_scope: s.display_scope,
      display_position: s.display_position,
      display_checkout: s.display_checkout,
      position: s.position,
      status: s.status,
      script_type: s.script_type,
      created_at: s.created_at,
      updated_at: s.updated_at,
      saved_as: fname,
    });
    writeFile(path.join(store.label, 'custom-scripts', fname), s.detail != null ? String(s.detail) : '');
  }
  writeFile(path.join(store.label, 'custom-scripts', 'index.json'), JSON.stringify(index, null, 2) + '\n');
  console.log(`  ${store.label}: ${all.length} custom scripts`);
  return all.length;
}

// ---------- 3. rendered storefront scrape ----------

async function scrapeRenderedScripts(store) {
  const found = new Map(); // id -> { content, pages: [] }
  for (const p of SCRAPE_PATHS) {
    let html;
    try {
      const res = await fetch(store.site + p, {
        headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36' },
        redirect: 'follow',
      });
      html = await res.text();
      console.log(`  GET ${store.site + p} -> ${res.status} (${html.length} bytes)`);
    } catch (e) {
      console.log(`  GET ${store.site + p} failed: ${e.message}`);
      continue;
    }
    const re = /<!--\s*script\s+(\d+)\s+Start\s*-->([\s\S]*?)<!--\s*script\s+\1\s+End\s*-->/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const id = m[1];
      const content = m[2].trim();
      if (!found.has(id)) found.set(id, { content, pages: [] });
      found.get(id).pages.push(p);
    }
  }
  const index = [];
  for (const [id, info] of [...found.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    index.push({ id: Number(id), pages: info.pages, bytes: Buffer.byteLength(info.content) });
    const header = `<!-- pulled from rendered storefront HTML of ${store.label} (pages: ${info.pages.join(' ')}).\n     This is the CONTENT of platform custom-script entry ${id}; the platform\n     adds the "script ${id} Start/End" markers itself on injection. -->\n`;
    writeFile(path.join(store.label, 'rendered-scripts', `script-${id}.html`), header + info.content + '\n');
  }
  writeFile(path.join(store.label, 'rendered-scripts', 'index.json'), JSON.stringify(index, null, 2) + '\n');
  console.log(`  ${store.label}: ${found.size} injected scripts seen on public pages`);
  return found.size;
}

// ---------- main ----------

async function main() {
  for (const [key, store] of Object.entries(STORES)) {
    console.log(`\n=== ${store.label} (${key}) ===`);
    if (!store.token) {
      console.log('  no token in env — skipping API passes');
    } else {
      await pullDiyFiles(store);
      await pullCustomScripts(store);
    }
    await scrapeRenderedScripts(store);
  }
  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
