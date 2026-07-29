// Probe whether the OEMSaaS /scripts endpoint supports writes, the way
// /diyfiles does (PUT /diyfiles/{id} is how deploy-static-files.js deploys).
// EN store only. Ordered from safest to least safe, stopping as soon as the
// question is answered:
//
//   1. POST /scripts — create a brand-new DISABLED (status 0) test entry whose
//      content is just an HTML comment. If create works, all further testing
//      happens on that throwaway entry: PUT to change it, list to verify,
//      DELETE to clean up.
//   2. Only if create is undefined: a NO-OP update on the smallest real script
//      (348474, 89 bytes, "remove list-page quick view") — send its exact
//      current field values via PUT /scripts/348474 (and, if that route is
//      undefined, the other verbs the platform might use), then re-fetch and
//      verify the content is byte-identical to the pre-test snapshot.
//
// Every request/response lands in store-code/scripts-write-test.json so the
// result is documented either way. Rollback safety net: the full content of
// every script is already committed under store-code/momuto.com/custom-scripts/.

const fs = require('fs');
const path = require('path');

const HOST = 'https://openapi.oemapps.com';
const TOKEN = process.env.OEMSAAS_TOKEN_EN;
const NOOP_TARGET_ID = 348474;

const report = { store: 'momuto.com', steps: [] };

async function call(method, apiPath, body) {
  const res = await fetch(`${HOST}/${apiPath}`, {
    method,
    headers: { 'Content-Type': 'application/json', token: TOKEN },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) { /* non-JSON */ }
  const entry = { method, path: apiPath, status: res.status, code: json && json.code, msg: json && json.msg };
  if (body) entry.sent = body;
  if (json && json.data && !Array.isArray(json.data)) entry.data = json.data;
  report.steps.push(entry);
  console.log(`${method} /${apiPath} -> HTTP ${res.status} code ${json && json.code} ${json && json.msg ? json.msg : ''}`);
  return { status: res.status, json, text };
}

function listOf(json) {
  const list = json && json.code === 0 && ((json.data && json.data.list) || json.data);
  return Array.isArray(list) ? list : null;
}

// Walk the since_id cursor until the entry with `id` is found (or the walk ends).
async function findScript(id) {
  let since = '';
  for (let i = 0; i < 1000; i++) {
    const res = await fetch(`${HOST}/scripts${since ? `?since_id=${since}` : ''}`, { headers: { token: TOKEN } });
    const json = await res.json().catch(() => null);
    const list = listOf(json);
    if (!list || list.length === 0) return null;
    const hit = list.find(s => s.id === id);
    if (hit) return hit;
    const last = list[list.length - 1].id;
    if (last === since) return null;
    since = last;
  }
  return null;
}

async function main() {
  const ok = v => v && v.json && v.json.code === 0;

  // ---- 1. try CREATE ----
  const testEntry = {
    script_name: 'MOMUTO api write test (safe to delete)',
    detail: '<!-- momuto scripts-api write test -->',
    display_routes: 'all',
    position: 1,
    status: 0,
  };
  let created = await call('POST', 'scripts', testEntry);
  let testId = ok(created) && created.json.data && (created.json.data.id || created.json.data.script_id);
  if (!testId && ok(created)) {
    // Create answered success but returned no id — look the entry up by name.
    let since = '';
    for (let i = 0; i < 1000 && !testId; i++) {
      const res = await fetch(`${HOST}/scripts${since ? `?since_id=${since}` : ''}`, { headers: { token: TOKEN } });
      const json = await res.json().catch(() => null);
      const list = listOf(json);
      if (!list || list.length === 0) break;
      const hit = list.find(s => s.script_name === testEntry.script_name);
      if (hit) testId = hit.id;
      const last = list[list.length - 1].id;
      if (last === since) break;
      since = last;
    }
    report.steps.push({ note: 'looked up created entry by name', found_id: testId || null });
  }

  if (testId) {
    console.log(`create works — testing update/delete on throwaway entry ${testId}`);
    // ---- update the throwaway entry ----
    const upd = await call('PUT', `scripts/${testId}`, { ...testEntry, detail: '<!-- momuto scripts-api write test v2 -->' });
    if (!ok(upd)) await call('POST', `scripts/${testId}`, { ...testEntry, detail: '<!-- momuto scripts-api write test v2 -->' });
    const after = await findScript(testId);
    report.steps.push({ note: 'throwaway entry after update', detail: after && after.detail, status: after && after.status });
    // ---- delete the throwaway entry ----
    const del = await call('DELETE', `scripts/${testId}`);
    if (!ok(del)) await call('POST', `scripts/${testId}/delete`);
    const gone = await findScript(testId);
    report.steps.push({ note: 'throwaway entry after delete', still_exists: !!gone, status: gone && gone.status });
    if (gone) console.log(`!! cleanup incomplete: test entry ${testId} still exists (status ${gone.status}) — remove it in the admin`);
  } else {
    console.log('create not available — falling back to a NO-OP update on the real script ' + NOOP_TARGET_ID);
    const before = await findScript(NOOP_TARGET_ID);
    if (!before) {
      report.steps.push({ note: 'could not fetch no-op target — aborting without writing' });
    } else {
      report.steps.push({ note: 'no-op target before', detail: before.detail, script_name: before.script_name });
      const payload = {
        script_name: before.script_name,
        detail: before.detail,
        display_routes: before.display_routes,
        display_scope: before.display_scope,
        display_position: before.display_position,
        display_checkout: before.display_checkout,
        position: before.position,
        status: before.status,
        script_type: before.script_type,
      };
      let put = await call('PUT', `scripts/${NOOP_TARGET_ID}`, payload);
      if (!ok(put)) put = await call('POST', `scripts/${NOOP_TARGET_ID}`, payload);
      if (!ok(put)) put = await call('PUT', 'scripts', { id: NOOP_TARGET_ID, ...payload });
      const after = await findScript(NOOP_TARGET_ID);
      const unchanged = !!(after && after.detail === before.detail && after.status === before.status);
      report.steps.push({ note: 'no-op target after', unchanged, detail_after: after && after.detail });
      if (!unchanged) console.log('!! no-op target CHANGED — restore from store-code/momuto.com/custom-scripts/ in the admin');
    }
  }

  fs.mkdirSync('store-code', { recursive: true });
  fs.writeFileSync(path.join('store-code', 'scripts-write-test.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('report written to store-code/scripts-write-test.json');
}

main().catch(e => { console.error(e); process.exit(1); });
