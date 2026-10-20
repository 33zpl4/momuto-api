'use strict';
/**
 * Switch ONE platform email notification on/off in every store (read-modify-write, dry run by default).
 *   EVENT=orders/fulfilled STATUS=0 [STORES=en,es,fr,it,us] [DRY_RUN=false] node scripts/set-email-notification-status.js
 *
 * For each store: list the event groups (recovery|customer|admin), find the event_code, GET the live notice, log OLD status,
 * PUT the whole live object with only `status` changed (PUT replaces — CLAUDE.md rule 1), read back and print VERIFIED.
 * Rollback = run again with the opposite STATUS (the pre-change templates are also in cms/email-notifications/<lang>/).
 * Runs on the GitHub runner (the sandbox cannot reach openapi.oemapps.com). Docs: docs/shipped-email.md.
 */
const HOST = 'https://openapi.oemapps.com';
const EVENT = process.env.EVENT;
const STATUS = parseInt(process.env.STATUS, 10);
const DRY = process.env.DRY_RUN !== 'false';
const wanted = (process.env.STORES || 'en,es,fr,it,us').split(',').map(s => s.trim());
const STORES = wanted.map(l => [l, process.env['OEMSAAS_TOKEN_' + l.toUpperCase()]]).filter(([, t]) => t);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ok = r => r.status === 200 && r.json && r.json.code === 0;

async function call(method, url, token, body) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, { method, headers: { token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch { /* keep text */ }
    if (json && (json.code === 1000 || /Too many/i.test(json.msg || '')) && i < 3) { await sleep(1500 * (i + 1)); continue; }   // throttled: never read as "not found"
    return { status: res.status, json, text: text.slice(0, 300) };
  }
}

(async () => {
  if (!EVENT || ![0, 1].includes(STATUS)) { console.error('EVENT (e.g. orders/fulfilled) and STATUS (0|1) are required'); process.exit(1); }
  if (!STORES.length) { console.error('no OEMSAAS_TOKEN_* for the requested stores'); process.exit(1); }
  console.log(`${DRY ? 'DRY RUN — ' : ''}set ${EVENT} -> ${STATUS ? 'ON' : 'OFF'} in: ${STORES.map(s => s[0]).join(', ')}`);
  let failures = 0;
  for (const [lang, token] of STORES) {
    let row = null;
    for (const type of ['customer', 'recovery', 'admin']) {
      const list = await call('GET', `${HOST}/eventnotices?email_event_type=${type}`, token);
      if (!ok(list)) { console.error(`${lang}: list ${type} failed http ${list.status} ${list.text}`); failures++; row = false; break; }
      row = ((list.json.data && list.json.data.list) || []).find(r => r.event_code === EVENT) || null;
      if (row) break;
      await sleep(400);
    }
    if (row === false) continue;
    if (!row) { console.error(`${lang}: ${EVENT} not found`); failures++; continue; }
    if (!(row.event_notice_id > 0)) { console.error(`${lang}: ${EVENT} has no configuration (event_notice_id 0) — configure once in the admin first`); failures++; continue; }
    const det = await call('GET', `${HOST}/eventnotices/${row.event_notice_id}`, token);
    if (!ok(det) || !det.json.data || !det.json.data.email_title) { console.error(`${lang}: detail read failed — refusing to PUT blind (http ${det.status} ${det.text})`); failures++; continue; }
    const live = det.json.data;
    console.log(`${lang}: notice ${live.id} "${live.email_title}" | status now ${live.status}`);
    if (live.status === STATUS) { console.log(`${lang}: already ${STATUS ? 'ON' : 'OFF'} — nothing to do`); continue; }
    if (DRY) { console.log(`${lang}: dry run — would PUT status ${STATUS}`); continue; }
    await sleep(600);
    const put = await call('PUT', `${HOST}/eventnotices/${live.id}`, token, { ...live, status: STATUS });
    if (!ok(put)) { console.error(`${lang}: PUT failed http ${put.status} ${put.text}`); failures++; continue; }
    await sleep(600);
    const check = await call('GET', `${HOST}/eventnotices/${live.id}`, token);
    const got = check.json && check.json.data && check.json.data.status;
    if (got === STATUS) console.log(`${lang}: VERIFIED — ${EVENT} is now ${STATUS ? 'ON' : 'OFF'}`);
    else { console.error(`${lang}: PUT acked but read-back shows status ${got}`); failures++; }
    await sleep(600);
  }
  if (failures) { console.error(`\n${failures} store(s) failed`); process.exit(1); }
  console.log('\nall stores done');
})().catch(e => { console.error(e); process.exit(1); });
