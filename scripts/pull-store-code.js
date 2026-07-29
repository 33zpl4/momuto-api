// Pull every DIY file and every injected custom script from all four OEMSaaS
// stores into the repo, so the two admin "custom code" sections (Online Store →
// DIY files, and the custom-script manager) are versioned like everything else.
//
// Three passes per store:
//   1. DIY files    — full listing via GET /diyfiles (paginated), content saved
//                     verbatim to store-code/<store>/diy-files/<file_name>,
//                     plus an index.json with id/type/name per file.
//   2. Scripts API  — the custom-script section has no endpoint we know of, so
//                     probe likely paths (GET only). Anything that answers like
//                     the OEMSaaS API (code:0 + a list) is harvested the same
//                     way; every probe's outcome lands in probe-report.json so
//                     a dead end is documented, not silent.
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

// Candidate paths for the custom-script section's API. GET only — probing
// reads, never writes.
const SCRIPT_ENDPOINT_CANDIDATES = [
  'scripts', 'script', 'customscripts', 'custom_scripts', 'custom-scripts',
  'shopscripts', 'shop_scripts', 'storescripts', 'scriptmanage', 'script_manage',
  'scripttags', 'script_tags', 'trackingcodes', 'tracking_codes', 'codes',
];

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

// ---------- 2. custom-scripts endpoint probe ----------

async function probeScriptEndpoints(store, report) {
  for (const cand of SCRIPT_ENDPOINT_CANDIDATES) {
    const { status, json, text } = await api(store, `${cand}?page=1&pagesize=50`);
    const entry = { endpoint: cand, status, code: json && json.code, snippet: text.slice(0, 200) };
    report.push(entry);
    const list = json && json.code === 0 && ((json.data && json.data.list) || json.data);
    if (Array.isArray(list) && list.length) {
      console.log(`  !! ${store.label}: /${cand} answered with a list — harvesting`);
      entry.harvested = list.length;
      const index = [];
      for (const s of list) {
        const id = s.id || s.script_id || 'unknown';
        const title = s.title || s.name || '';
        index.push({ id, title, keys: Object.keys(s) });
        const body = s.content || s.script || s.html || JSON.stringify(s, null, 2);
        writeFile(path.join(store.label, 'custom-scripts', `${id}${title ? '-' + safeName(title) : ''}.html`), String(body));
      }
      writeFile(path.join(store.label, 'custom-scripts', 'index.json'), JSON.stringify(index, null, 2) + '\n');
    }
  }
  // Direct shot at the known EN checkout script id, in case list is gated but
  // item GET works.
  if (store.label === 'momuto.com') {
    for (const cand of ['scripts', 'script', 'customscripts']) {
      const { status, json, text } = await api(store, `${cand}/348500`);
      report.push({ endpoint: `${cand}/348500`, status, code: json && json.code, snippet: text.slice(0, 200) });
    }
  }
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
  const probeReport = {};
  for (const [key, store] of Object.entries(STORES)) {
    console.log(`\n=== ${store.label} (${key}) ===`);
    if (!store.token) {
      console.log('  no token in env — skipping API passes');
    } else {
      await pullDiyFiles(store);
      probeReport[store.label] = [];
      await probeScriptEndpoints(store, probeReport[store.label]);
    }
    await scrapeRenderedScripts(store);
  }
  writeFile('probe-report.json', JSON.stringify(probeReport, null, 2) + '\n');
  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
