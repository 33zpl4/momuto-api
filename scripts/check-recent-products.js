'use strict';

/**
 * READ-ONLY. Is the platform product API answering, and what are the newest / most recently updated products per store?
 * Prints id, title, status, price, created/updated times (no customer data). Preview products ("Your custom design ...")
 * are the design server's own writes through the same API + per-store tokens manage.momuto.com uses, so their newest
 * timestamp says when the design server last wrote successfully.
 * Env: OEMSAAS_TOKEN_<ST>, STORES (default EN,US), N (default 12)
 */
const HOST = 'https://openapi.oemapps.com';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const iso = t => (t && /^\d{9,13}$/.test(String(t)) ? new Date(Number(t) * (String(t).length > 11 ? 1 : 1000)).toISOString().replace('T', ' ').slice(0, 19) : (t || '?'));

async function api(token, p) {
  const t0 = Date.now();
  for (let i = 0; i < 4; i++) {
    const res = await fetch(HOST + p, { headers: { token } });
    const txt = await res.text();
    let j; try { j = JSON.parse(txt); } catch { throw new Error(`HTTP ${res.status} not JSON: ${txt.slice(0, 160)}`); }
    if (j.code === 0 || j.code === 200) return { data: j.data, ms: Date.now() - t0, http: res.status };
    if (!(j.code === 1000 || /Too many/i.test(j.msg || '')) || i === 3) throw new Error(`HTTP ${res.status} code ${j.code}: ${j.msg}`);
    await sleep(1500 * (i + 1));
  }
}

(async () => {
  const stores = (process.env.STORES || 'EN,US').split(',').map(s => s.trim()).filter(Boolean);
  const N = Number(process.env.N || 12);
  for (const st of stores) {
    const token = process.env['OEMSAAS_TOKEN_' + st];
    if (!token) { console.log(`== ${st}: no token`); continue; }
    try {
      const all = []; let since = '';
      let first = null;
      for (let pg = 0; pg < 30; pg++) {
        const r = await api(token, `/products?limit=200${since ? `&since_id=${since}` : ''}`);
        if (!first) first = r;
        const rows = Array.isArray(r.data) ? r.data : [];
        all.push(...rows);
        if (rows.length < 200) break;
        since = rows[rows.length - 1].id; await sleep(300);
      }
      console.log(`\n== ${st}: API answers (HTTP ${first.http}, ${first.ms} ms), ${all.length} products`);
      const key = p => Number(p.id) || 0;
      const byId = [...all].sort((a, b) => key(b) - key(a)).slice(0, N);
      console.log(`  newest ${N} by id:`);
      for (const p of byId) console.log(`   id=${p.id} status=${p.status} created=${iso(p.created_at)} updated=${iso(p.updated_at)} price=${[...new Set((p.variants || []).map(v => v.price))].join('/')} title=${JSON.stringify(String(p.title || '').slice(0, 70))}`);
      const upd = [...all].filter(p => p.updated_at).sort((a, b) => Number(b.updated_at) - Number(a.updated_at)).slice(0, 6);
      console.log(`  most recently updated:`);
      for (const p of upd) console.log(`   id=${p.id} updated=${iso(p.updated_at)} title=${JSON.stringify(String(p.title || '').slice(0, 70))}`);
      const prev = all.filter(p => /your custom design|tu diseño personalizado|votre design/i.test(String(p.title || ''))).sort((a, b) => key(b) - key(a))[0];
      console.log(`  last checkout preview product: ${prev ? `id=${prev.id} created=${iso(prev.created_at)}` : 'none found'}`);
    } catch (e) { console.log(`\n== ${st}: API FAILED: ${e.message}`); }
  }
  console.log(`\nnow: ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`);
})();
