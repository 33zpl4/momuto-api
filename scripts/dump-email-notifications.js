'use strict';

/**
 * Dump the store platform's EMAIL NOTIFICATION templates (abandoned-cart
 * recovery, customer + admin notices) into the repo, per store.
 *
 * Real API surface (vendor doc, Aug 2026):
 *   GET {host}/eventnotices?email_event_type=<recovery|customer|admin>
 *     -> data.list[]: { event_id, event_name, event_code (e.g.
 *        "carts/recovery_1"), email_event_type, status (0 off / 1 on),
 *        event_notice_id (0 = NOT CONFIGURED), coupon, delay_time,
 *        email_cover }
 *   GET {host}/eventnotices/{event_notice_id}
 *     -> data: { id, event_id, delay_time, coupon, top_html_oss_bucket,
 *        bottom_html_oss_bucket, email_title, status }
 *
 * The template model is NOT free-form HTML: email_title + a TOP html block
 * and a BOTTOM html block wrapped around the platform-rendered core (cart
 * lines, buttons). Redesigning the abandoned-cart email therefore means
 * writing those two blocks + title per store/phase, via
 * PUT /eventnotices/... (read-modify-write; PUT replaces).
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

const TYPES = ['recovery', 'customer', 'admin'];

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

const ok = r => r.status === 200 && r.json && r.json.code === 0;
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

async function main() {
  if (!STORES.length) { console.error('no OEMSAAS_TOKEN_* set'); process.exit(1); }
  const summary = {};

  for (const [lang, token] of STORES) {
    console.log(`\n===== ${lang} =====`);
    const dir = path.join(OUT, lang);
    fs.mkdirSync(dir, { recursive: true });
    summary[lang] = {};

    for (const type of TYPES) {
      const r = await get(`${HOST}/eventnotices?email_event_type=${type}`, token);
      if (!ok(r)) {
        console.log(`${lang}/${type}: list failed http ${r.status} ${r.text.slice(0, 120)}`);
        summary[lang][type] = { error: `http ${r.status}` };
        continue;
      }
      fs.writeFileSync(path.join(dir, `_list-${type}.json`), JSON.stringify(r.json, null, 2));
      const rows = (r.json.data && r.json.data.list) || [];
      console.log(`${lang}/${type}: ${rows.length} events`);
      const events = [];
      for (const row of rows) {
        const ev = {
          event_code: row.event_code, event_name: row.event_name,
          status: row.status, event_notice_id: row.event_notice_id,
          delay_time: row.delay_time, coupon: row.coupon,
        };
        // event_notice_id 0 = never configured — nothing to fetch
        if (row.event_notice_id > 0) {
          const det = await get(`${HOST}/eventnotices/${row.event_notice_id}`, token);
          if (ok(det)) {
            const f = `${slug(row.event_code || row.event_name)}-${row.event_notice_id}.json`;
            fs.writeFileSync(path.join(dir, f), JSON.stringify(det.json, null, 2));
            ev.file = f;
          } else {
            ev.detail_error = `http ${det.status} ${det.text.slice(0, 80)}`;
            console.log(`  detail ${row.event_notice_id} failed: ${ev.detail_error}`);
          }
        }
        events.push(ev);
        console.log(`  ${row.status === 1 ? 'ON ' : 'off'} ${row.event_code} "${row.event_name}" notice_id=${row.event_notice_id} delay=${row.delay_time} coupon=${row.coupon || '-'}`);
      }
      summary[lang][type] = events;
    }
  }

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(summary, null, 2));
  console.log('\ndone');
}

main().catch(e => { console.error(e); process.exit(1); });
