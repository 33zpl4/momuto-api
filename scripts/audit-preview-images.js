'use strict';

/**
 * READ-ONLY. Do the checkout "preview" lines ("Your custom design — this is what we produce — order X") have a live cover image?
 * For every 3D order of the last DAYS days on one store: find its preview line(s), read the preview product (GET /products/{id}),
 * HEAD each stored image on the platform CDN, and report the result per order plus totals by shipping country, by UTC time of day and
 * by day. Prints order numbers, shipping COUNTRY CODE, hour and image status only: no names, emails or addresses.
 *
 * Why: a grey tile in the CMS order list = a preview image the platform confirmed but never stored (6 Oct, 5 Nov, 12 Nov 2026).
 * Env: OEMSAAS_TOKEN_<STORE>, STORE (default EN), DAYS (default 14), MAX_PAGES (default 8)
 */
const HOST = 'https://openapi.oemapps.com';
const STORE = String(process.env.STORE || 'EN').toUpperCase();
const token = process.env['OEMSAAS_TOKEN_' + STORE];
const DAYS = Number(process.env.DAYS || 14);
const MAX_PAGES = Number(process.env.MAX_PAGES || 8);
const sleep = ms => new Promise(r => setTimeout(r, ms));
if (!token) { console.log(`no token for ${STORE}`); process.exit(0); }

async function api(p) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(HOST + p, { headers: { token } });
    const j = JSON.parse(await res.text());
    if (j.code === 0 || j.code === 200) return j.data;
    if (!(j.code === 1000 || /Too many/i.test(j.msg || '')) || i === 3) throw new Error(`code ${j.code}: ${j.msg}`);
    await sleep(1500 * (i + 1));
  }
}
const rowsOf = d => (Array.isArray(d) ? d : (d && (d.orders || d.list || d.rows)) || []);
const items = o => o.line_items || o.items || o.products || o.lines || [];
const isPreview = l => /3d-preview/.test(String(l.inner_title || ''));
async function head(url) {
  for (let i = 0; i < 2; i++) {
    try { const r = await fetch(url, { method: 'HEAD' }); return r.status; } catch (e) { await sleep(300); }
  }
  return 0;
}
const country = d => {
  const a = d.shipping_address || d.shippingAddress || d.address || {};
  return String(a.country_code || a.countryCode || a.country || d.country_code || d.shipping_country || '?').toUpperCase().slice(0, 3);
};

(async () => {
  const cutoff = Date.now() / 1000 - DAYS * 86400;
  const orders = []; let since = '';
  for (let pg = 0; pg < MAX_PAGES; pg++) {
    const rows = rowsOf(await api(`/orders?limit=200${since ? `&since_id=${since}` : ''}`));
    if (!rows.length) break;
    for (const o of rows) if (Number(o.created_at) >= cutoff) orders.push(o);
    const last = rows[rows.length - 1];
    if (rows.length < 200 || Number(last.created_at) < cutoff) break;
    since = last.id || last.order_id; await sleep(400);
  }
  console.log(`${STORE}: ${orders.length} orders in the last ${DAYS} days`);
  const out = [];
  for (const o of orders) {
    let d = o;
    if (!items(o).length || !o.shipping_address) { try { await sleep(350); d = await api('/orders/' + (o.id || o.order_id)); } catch (e) { continue; } }
    const prev = items(d).filter(isPreview);
    if (!prev.length) continue;
    const cc = country(d);
    const created = new Date(Number(d.created_at || o.created_at) * 1000).toISOString();
    const st = [];
    for (const l of prev) {
      try {
        await sleep(300);
        const p = await api('/products/' + l.product_id); const prod = (p && p.product) || p || {};
        const imgs = (prod.images || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
        if (!imgs.length) { st.push('noimg'); continue; }
        const codes = []; for (const im of imgs) codes.push(await head(im.src));
        st.push(codes.map(c => (c >= 200 && c < 400 ? 'ok' : c === 0 ? 'err' : String(c))).join('+'));
      } catch (e) { st.push('read-fail'); }
    }
    const cover = st.map(s => s.split('+')[0]);
    const bad = cover.some(c => c !== 'ok');
    const allDead = st.some(s => s.split('+').every(c => c !== 'ok'));
    out.push({ no: d.order_number || o.order_number, created, hour: new Date(created).getUTCHours(), cc, designs: prev.length, st, bad, allDead });
  }
  out.sort((a, b) => a.created.localeCompare(b.created));
  console.log(`\n${out.length} 3D orders with a preview line. Per order (BAD = a cover that does not load):`);
  for (const r of out) console.log(`  ${r.no} ${r.created.slice(0, 13)}h UTC  ${r.cc.padEnd(3)} ${r.designs} design(s)  images: ${r.st.join(' | ')}${r.bad ? '   <-- BAD' : ''}`);
  const agg = (keyFn) => { const m = {}; for (const r of out) { const k = keyFn(r); m[k] = m[k] || { n: 0, bad: 0 }; m[k].n++; if (r.bad) m[k].bad++; } return m; };
  const show = (title, m) => { console.log(`\n${title}`); Object.entries(m).sort().forEach(([k, v]) => console.log(`  ${String(k).padEnd(12)} ${String(v.bad).padStart(3)} bad of ${String(v.n).padStart(3)}  (${Math.round(100 * v.bad / v.n)}%)`)); };
  show('By shipping country', agg(r => r.cc));
  show('By UTC time of day', agg(r => r.hour < 6 ? '00-05h' : r.hour < 12 ? '06-11h' : r.hour < 18 ? '12-17h' : '18-23h'));
  show('By day', agg(r => r.created.slice(0, 10)));
  const bad = out.filter(r => r.bad).length;
  console.log(`\nTOTAL ${bad} bad of ${out.length} (${out.length ? Math.round(100 * bad / out.length) : 0}%); both images dead: ${out.filter(r => r.allDead).length}`);
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
