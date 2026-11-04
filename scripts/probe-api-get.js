'use strict';
/**
 * probe-api-get.js — READ-ONLY: GET a list of OEMSaaS open-API paths on one store and print HTTP status, the API's
 * code/msg and a short shape of `data` (keys, list length, first item keys). Never sends anything but GET.
 * Used to discover whether an admin surface (e.g. payment methods) is exposed to the store token before asking
 * the owner to click it. Env: STORE (en|es|fr|it|us, default fr), PATHS (comma/newline list), OEMSAAS_TOKEN_<STORE>.
 */
const HOST = 'https://openapi.oemapps.com';
const store = (process.env.STORE || 'fr').toLowerCase();
const token = process.env[`OEMSAAS_TOKEN_${store.toUpperCase()}`];
if (!token) { console.error(`no token for ${store}`); process.exit(1); }
const paths = (process.env.PATHS || '').split(/[\n,]/).map(s => s.trim()).filter(Boolean);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function shape(d) {
  if (d == null) return String(d);
  if (Array.isArray(d)) return `array(${d.length})${d[0] && typeof d[0] === 'object' ? ' keys=' + Object.keys(d[0]).slice(0, 20).join(',') : ''}`;
  if (typeof d === 'object') {
    const ks = Object.keys(d);
    const list = ['list', 'data', 'items', 'payments', 'payment_methods', 'gateways'].find(k => Array.isArray(d[k]));
    return `object keys=${ks.slice(0, 25).join(',')}` + (list ? ` | ${list}: ${shape(d[list])}` : '');
  }
  return typeof d + ' ' + String(d).slice(0, 80);
}
(async () => {
  console.log(`store=${store}  GET-only  ${paths.length} path(s)`);
  for (const p of paths) {
    try {
      const r = await fetch(HOST + p, { headers: { token } });
      const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch (_) {}
      const line = j ? `code=${j.code} msg=${String(j.msg).slice(0, 60)} data: ${shape(j.data)}` : `non-JSON ${txt.slice(0, 80).replace(/\s+/g, ' ')}`;
      console.log(`${String(r.status).padEnd(4)} ${p.padEnd(34)} ${line}`);
      if (j && j.code === 0 && process.env.DUMP === 'true') console.log(JSON.stringify(j.data, null, 1).slice(0, 3000));
    } catch (e) { console.log(`ERR  ${p.padEnd(34)} ${e.message}`); }
    await sleep(400);
  }
})();
