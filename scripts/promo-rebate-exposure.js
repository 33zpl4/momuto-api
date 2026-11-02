'use strict';

/**
 * READ-ONLY. For each store, scans recent orders for lines whose title carries the fixed-price "Promo" marker and
 * prints, per order: order number, created date, payment status, the Promo line (title, qty, unit price) and every
 * numeric discount-like field on the order (so a rebate stacked on a fixed price is visible).
 * No customer data (no email, name, address). Env: OEMSAAS_TOKEN_<ST>, STORES (default EN,ES), MAX_PAGES (default 6).
 */
const HOST = 'https://openapi.oemapps.com';
const MARKER = /\bpromo\b|fixed[\s-]*price|precio[\s-]*fijo|prix[\s-]*fixe|prezzo[\s-]*fisso/iu;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function api(token, p) {
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
const titleOf = l => String(l.title || l.name || l.product_title || '');
const day = t => (t ? new Date(Number(t) * 1000).toISOString().slice(0, 10) : '?');
const money = o => Object.entries(o).filter(([k, v]) => /discount|promot|rebate|coupon|reduc|subtotal|sub_total|total/i.test(k) && (typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v)))).map(([k, v]) => `${k}=${v}`).join(' ');

(async () => {
  const stores = (process.env.STORES || 'EN,ES').split(',').map(s => s.trim()).filter(Boolean);
  const maxPages = Number(process.env.MAX_PAGES || 6);
  for (const st of stores) {
    const token = process.env['OEMSAAS_TOKEN_' + st];
    if (!token) { console.log(`== ${st}: no token`); continue; }
    let since = '', seen = 0, hits = 0;
    console.log(`\n== ${st}`);
    for (let pg = 0; pg < maxPages; pg++) {
      const rows = rowsOf(await api(token, `/orders?limit=200${since ? `&since_id=${since}` : ''}`));
      if (!rows.length) break;
      for (const o of rows) {
        seen++;
        let lines = items(o);
        let promo = lines.filter(l => MARKER.test(titleOf(l)));
        if (!promo.length && !lines.length) continue;
        if (!promo.length) continue;
        let d = o;
        try { await sleep(350); d = await api(token, '/orders/' + (o.id || o.order_id)); } catch (e) { /* keep list row */ }
        lines = items(d).length ? items(d) : lines;
        promo = lines.filter(l => MARKER.test(titleOf(l)));
        hits++;
        console.log(`  order ${d.order_number || o.order_number || o.id} created ${day(d.created_at || o.created_at)} fin=${d.financial_status} ${money(d)}`);
        for (const l of promo) console.log(`     promo line: ${JSON.stringify(titleOf(l))} qty=${l.quantity || l.qty} price=${l.price}`);
      }
      if (rows.length < 200) break;
      const last = rows[rows.length - 1]; since = last.id || last.order_id;
      await sleep(500);
    }
    console.log(`  scanned ${seen} orders, ${hits} with a Promo line`);
  }
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
