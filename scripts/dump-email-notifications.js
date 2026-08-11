'use strict';

/**
 * Dump the store platform's EMAIL NOTIFICATION templates (abandoned cart,
 * order confirmation, shipping…) into the repo, per store.
 *
 * The OEMSaaS API doc lists the surface ("Get email notification list",
 * "Get email notification details", "Email notification of changes") but we
 * have never touched it and the doc index gives titles, not paths — so this
 * script PROBES a list of likely endpoint paths (GET only, zero risk), uses
 * whichever answers with the platform's code:0 envelope, then dumps the list
 * AND per-notification details verbatim into cms/email-notifications/<lang>/.
 *
 * Read-before-write doctrine (docs/oemsaas-api-notes.md): these dumps are the
 * specification for the later PUT that redesigns the abandoned-cart email.
 * Every probe result is logged so even a miss teaches us the API's shape.
 *
 * Runs on the GitHub runner (sandbox cannot reach openapi.oemapps.com):
 *   OEMSAAS_TOKEN_EN=… node scripts/dump-email-notifications.js
 */

const fs   = require('fs');
const path = require('path');

const HOST = 'https://openapi.oemapps.com';
const OUT  = path.join(__dirname, '..', 'cms', 'email-notifications');

const STORES = [
  ['en', process.env.OEMSAAS_TOKEN_EN],
  ['es', process.env.OEMSAAS_TOKEN_ES],
  ['fr', process.env.OEMSAAS_TOKEN_FR],
  ['it', process.env.OEMSAAS_TOKEN_IT],
].filter(([, t]) => t);

// Candidate list endpoints, most-likely first (existing known endpoints are
// lowercase plural nouns: /products, /collections, /pages).
const CANDIDATES = [
  '/emailnotifys',
  '/emailnotify',
  '/email_notifys',
  '/email_notify',
  '/emailNotify',
  '/email-notifications',
  '/emailnotifications',
  '/notifys',
  '/notify/email',
  '/emailtemplates',
  '/email_template',
];

async function get(url, token) {
  try {
    const res = await fetch(url, { headers: { token } });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text: text.slice(0, 300) };
  } catch (e) {
    return { status: 0, json: null, text: e.message };
  }
}

function ok(r) {
  return r.status === 200 && r.json && (r.json.code === 0 || r.json.code === 200);
}

async function main() {
  if (!STORES.length) { console.error('no OEMSAAS_TOKEN_* set'); process.exit(1); }
  const summary = {};

  for (const [lang, token] of STORES) {
    console.log(`\n===== ${lang} =====`);
    let base = null, listResp = null;

    for (const cand of CANDIDATES) {
      const r = await get(`${HOST}${cand}`, token);
      const hit = ok(r);
      console.log(`probe ${cand} -> http ${r.status} code ${r.json ? r.json.code : '-'} ${hit ? 'HIT' : ''} ${!hit ? String(r.text).slice(0, 80) : ''}`);
      if (hit) { base = cand; listResp = r; break; }
    }

    if (!base) {
      console.log(`${lang}: no candidate answered — paste the real path from the API doc into CANDIDATES`);
      summary[lang] = { endpoint: null };
      continue;
    }

    const dir = path.join(OUT, lang);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '_list.json'), JSON.stringify(listResp.json, null, 2));

    // Pull details for every entry the list exposes. Shape unknown — look for
    // an array anywhere in data and an id-ish key on its items.
    const data = listResp.json.data;
    const rows = Array.isArray(data) ? data
      : (data && (data.list || data.items || data.rows)) || [];
    console.log(`${lang}: endpoint ${base}, ${rows.length} notifications`);
    const got = [];
    for (const row of rows) {
      const id = row.id ?? row.notify_id ?? row.template_id;
      if (id == null) continue;
      const det = await get(`${HOST}${base}/${id}`, token);
      const name = String(row.title || row.name || row.type || id)
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
      if (det.json) {
        fs.writeFileSync(path.join(dir, `${name}-${id}.json`), JSON.stringify(det.json, null, 2));
        got.push(`${name}-${id}`);
      } else {
        console.log(`  detail ${id} failed: http ${det.status} ${det.text.slice(0, 80)}`);
      }
    }
    summary[lang] = { endpoint: base, count: rows.length, saved: got };
  }

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(summary, null, 2));
  console.log('\nsummary:', JSON.stringify(summary, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
