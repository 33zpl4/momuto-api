'use strict';

/**
 * Push the redesigned abandoned-cart (recovery phase 1) email to every store.
 *
 * Source of truth: cms/email-notifications/src/recovery-1.<lang>.json
 * ({ email_title, top_html_oss_bucket, bottom_html_oss_bucket }).
 *
 * Read-modify-write per docs/oemsaas-api-notes.md: for each store it GETs
 * the recovery event list, finds carts/recovery_1, GETs the live template,
 * logs the OLD values (rollback data — the pre-change dumps also live in
 * cms/email-notifications/<lang>/), PUTs the live object with ONLY the three
 * copy fields replaced (delay, coupon, on/off status, logo stay untouched),
 * then reads it back and verifies the title landed.
 *
 * DRY_RUN=true prints what would change without writing.
 * Runs on the GitHub runner (sandbox cannot reach openapi.oemapps.com).
 */

const fs   = require('fs');
const path = require('path');

const HOST = 'https://openapi.oemapps.com';
const SRC  = path.join(__dirname, '..', 'cms', 'email-notifications', 'src');
const DRY  = process.env.DRY_RUN === 'true';

const STORES = [
  ['en', process.env.OEMSAAS_TOKEN_EN],
  ['es', process.env.OEMSAAS_TOKEN_ES],
  ['fr', process.env.OEMSAAS_TOKEN_FR],
  ['it', process.env.OEMSAAS_TOKEN_IT],
].filter(([, t]) => t);

async function call(method, url, token, body) {
  const res = await fetch(url, {
    method,
    headers: { token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text: text.slice(0, 300) };
}

const ok = r => r.status === 200 && r.json && r.json.code === 0;

async function main() {
  if (!STORES.length) { console.error('no OEMSAAS_TOKEN_* set'); process.exit(1); }
  let failures = 0;

  for (const [lang, token] of STORES) {
    console.log(`\n===== ${lang} ${DRY ? '(DRY RUN)' : ''} =====`);
    const srcFile = path.join(SRC, `recovery-1.${lang}.json`);
    if (!fs.existsSync(srcFile)) { console.log(`no source file for ${lang} — skipping`); continue; }
    const src = JSON.parse(fs.readFileSync(srcFile, 'utf8'));

    const list = await call('GET', `${HOST}/eventnotices?email_event_type=recovery`, token);
    if (!ok(list)) { console.error(`${lang}: list failed http ${list.status} ${list.text}`); failures++; continue; }
    const row = ((list.json.data && list.json.data.list) || []).find(r => r.event_code === 'carts/recovery_1');
    if (!row) { console.error(`${lang}: carts/recovery_1 not in list`); failures++; continue; }
    if (!(row.event_notice_id > 0)) { console.error(`${lang}: recovery_1 has no configuration (event_notice_id 0) — configure once in the admin first`); failures++; continue; }

    const det = await call('GET', `${HOST}/eventnotices/${row.event_notice_id}`, token);
    if (!ok(det) || !det.json.data || !det.json.data.email_title) {
      console.error(`${lang}: detail read failed or empty — refusing to PUT blind (http ${det.status} ${det.text})`);
      failures++; continue;
    }
    const live = det.json.data;
    console.log(`${lang}: notice ${live.id} | status ${live.status} | delay ${live.delay_time}s`);
    console.log(`  OLD title: ${live.email_title}`);
    console.log(`  NEW title: ${src.email_title}`);

    if (DRY) { console.log('  dry run — no write'); continue; }

    const body = {
      ...live,
      email_title: src.email_title,
      top_html_oss_bucket: src.top_html_oss_bucket,
      bottom_html_oss_bucket: src.bottom_html_oss_bucket,
      // optional per-store delay override (e.g. FR aligned to ~30 min)
      ...(src.delay_time ? { delay_time: src.delay_time } : {}),
    };
    const put = await call('PUT', `${HOST}/eventnotices/${live.id}`, token, body);
    if (!ok(put)) { console.error(`${lang}: PUT failed http ${put.status} ${put.text}`); failures++; continue; }

    // verify the write, don't trust the ack
    const check = await call('GET', `${HOST}/eventnotices/${live.id}`, token);
    const landedTitle = check.json && check.json.data && check.json.data.email_title;
    if (landedTitle === src.email_title) {
      console.log(`${lang}: VERIFIED — new template live`);
    } else {
      console.error(`${lang}: PUT acked but read-back shows: ${landedTitle}`);
      failures++;
    }
  }

  if (failures) { console.error(`\n${failures} store(s) failed`); process.exit(1); }
  console.log('\nall stores done');
}

main().catch(e => { console.error(e); process.exit(1); });
