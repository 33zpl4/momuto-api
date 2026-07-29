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

// GET /scripts serves the same first 10 no matter which page-number
// vocabulary is used, and rejects ?limit with code 1000 — so its real
// parameter set is unknown. Until a working cursor/filter is found, harvest
// the plain first page and (EN only) run a battery of parameter experiments,
// recording each result to scripts-api-experiments.json for diagnosis.
function scriptList(json) {
  const list = json && json.code === 0 && ((json.data && json.data.list) || json.data);
  return Array.isArray(list) ? list : null;
}

const SCRIPTS_API_EXPERIMENTS = [
  'scripts?pagesize=5',
  'scripts?page=2&pagesize=5',
  'scripts?since_id=348493',
  'scripts?since_id=348493&pagesize=10',
  'scripts?last_id=348493',
  'scripts?start_id=348493',
  'scripts?min_id=348494',
  'scripts?max_id=99999999',
  'scripts?id=348500',
  'scripts?ids=348500',
  'scripts?script_name=checkout',
  'scripts?name=checkout',
  'scripts?keyword=checkout',
  'scripts?search=checkout',
  'scripts?title=checkout',
  'scripts?status=1',
  'scripts?display_routes=all',
  'scripts?position=1',
  'scripts?script_type=2',
  'scripts?sort=id&order=desc',
  'scripts?order=desc',
  'scripts?sort=desc',
  'scripts?orderby=id_desc',
  'scripts?order_by=id%20desc',
  'scripts?desc=1',
  'scripts?sort_field=id&sort_type=desc',
];

async function runScriptsApiExperiments(store) {
  const results = [];
  for (const url of SCRIPTS_API_EXPERIMENTS) {
    const { status, json, text } = await api(store, url);
    const list = scriptList(json);
    results.push({
      url,
      status,
      code: json && json.code,
      count: list ? list.length : null,
      first_ids: list ? list.slice(0, 3).map(s => s.id) : null,
      snippet: list ? undefined : text.slice(0, 150),
    });
  }
  writeFile('scripts-api-experiments.json', JSON.stringify(results, null, 2) + '\n');
}

async function pullCustomScripts(store) {
  const seen = new Set();
  const all = [];
  const { status, json } = await api(store, 'scripts');
  const list = scriptList(json);
  if (status !== 200 || !list) {
    console.log(`  scripts list failed on ${store.label}: HTTP ${status} code ${json && json.code}`);
  } else {
    list.forEach(s => { if (!seen.has(s.id)) { seen.add(s.id); all.push(s); } });
  }
  if (store.label === 'momuto.com') await runScriptsApiExperiments(store);

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
