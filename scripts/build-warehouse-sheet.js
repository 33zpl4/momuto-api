'use strict';

/**
 * Build the warehouse production sheet (生产单) for a paid order — the Excel
 * the factory used to assemble by hand for every order: customer + shipping
 * block, the front/back renders of the design, and one row per jersey
 * (sleeve, size, number, name, qty). Chinese labels, same reading order as
 * the hand-made file (order 2026091033559480, 11 Sep 2026), cleaned up.
 *
 *   node scripts/build-warehouse-sheet.js --order <platform order no> [--lang en]
 *   node scripts/build-warehouse-sheet.js --paid-since <hours>  [--lang all]
 *   node scripts/build-warehouse-sheet.js --order <no> --roster roster.json   # roster override
 *
 * Data sources (all read-only):
 *   1. Store platform  GET /orders/ordernumber/<no>   — customer, address,
 *      phone, zip, email, note, payment method, shipping plan, totals, lines.
 *   2. Store platform  GET /products/<preview id>     — the €0 "Your custom
 *      design — order <ref>" line's product carries the customer's own
 *      front/back renders as its images.
 *   3. Roster (name / number / size / sleeve / qty per jersey) lives on the
 *      design server only. Read, in order: --roster file; the design server
 *      itself (GET /Order/getGoods — unauthenticated on the server); momuto-api
 *      `admin-orders?action=detail` (needs MOMUTO_API_SECRET, the record the
 *      design-server webhook stored); else the sheet carries a red
 *      "名单未获取" row and the jersey count from the platform lines, so the
 *      factory still gets everything else and knows what to look up.
 *
 * Output: sheets/<order_no>.xlsx (+ emailed via Resend when RESEND_API_KEY is
 * set: WAREHOUSE_EMAILS, default info@momuto.com + ilovebillxie@hotmail.com).
 * Runs on the GitHub runner; the sandbox cannot reach the platform.
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const HOST = 'https://openapi.oemapps.com';
const MOMUTO_API = 'https://momuto-api.vercel.app/api/admin-orders';
const STORES = { en: 'OEMSAAS_TOKEN_EN', es: 'OEMSAAS_TOKEN_ES', fr: 'OEMSAAS_TOKEN_FR', it: 'OEMSAAS_TOKEN_IT', us: 'OEMSAAS_TOKEN_US' };
const OUT_DIR = process.env.SHEET_OUT_DIR || 'sheets';

const args = { order: null, paidSince: 0, lang: 'all', roster: null, dry: false };
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i];
  if (k === '--order') args.order = String(process.argv[++i] || '').trim();
  else if (k === '--paid-since') args.paidSince = parseFloat(process.argv[++i]) || 24;
  else if (k === '--lang') args.lang = process.argv[++i];
  else if (k === '--roster') args.roster = process.argv[++i];
  else if (k === '--dry') args.dry = true;           // build only, no email
  else { console.error(`Unknown argument ${k}`); process.exit(1); }
}
if (!args.order && !args.paidSince) { console.error('Need --order <no> or --paid-since <hours>'); process.exit(1); }

// ---------------------------------------------------------------- platform
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function platform(pathname, token, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${HOST}${pathname}`, { headers: { token } });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { throw new Error(`HTTP ${res.status} non-JSON: ${text.slice(0, 160)}`); }
    if (json.code === 0 || json.code === 200) return json.data;
    const throttled = json.code === 1000 || /Too many/i.test(json.msg || '');
    if (!throttled || i === tries - 1) throw new Error(`API code ${json.code}: ${json.msg}`);
    await sleep(1500 * (i + 1));
  }
}
const field = (o, names) => { for (const n of names) if (o && o[n] !== undefined && o[n] !== null && o[n] !== '') return o[n]; return null; };
const asList = (d) => Array.isArray(d) ? d : (d && (d.orders || d.list || d.rows || d.data)) || null;
function toMillis(v) { if (!v) return 0; const n = parseInt(v, 10); if (n > 1e12) return n; if (n > 1e9) return n * 1000; const t = Date.parse(v); return isNaN(t) ? 0 : t; }
const iso = (ms) => ms ? new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '';
function isPaid(o) {
  const fs_ = field(o, ['financial_status', 'financialStatus']);
  return parseInt(fs_, 10) === 230 || toMillis(field(o, ['first_pay_at', 'pay_at'])) > 0;
}

async function findOrder(token, no) {
  for (const p of [`/orders/ordernumber/${encodeURIComponent(no)}`, `/orders/${encodeURIComponent(no)}`]) {
    try {
      const d = await platform(p, token);
      const o = (d && d.order) || d;
      if (o && field(o, ['order_number', 'order_no', 'id'])) return o;
    } catch (e) { if (!/not found|不存在|404|code 4/i.test(e.message)) console.error(`  ${p}: ${e.message}`); }
  }
  return null;
}
async function paidSince(token, hours) {
  const cutoff = Date.now() - hours * 3600 * 1000, out = [];
  for (let page = 1; page <= 10; page++) {
    const d = await platform(`/orders?limit=50&page=${page}`, token);
    const list = asList(d) || [];
    if (!list.length) break;
    let older = false;
    for (const o of list) {
      const created = toMillis(field(o, ['created_at']));
      const paid = toMillis(field(o, ['first_pay_at', 'pay_at']));
      if (created && created < cutoff - 30 * 86400000) older = true;
      if (isPaid(o) && paid >= cutoff) out.push(o);
    }
    if (older || list.length < 50) break;
    await sleep(600);
  }
  return out;
}

// ---------------------------------------------------------------- shape
// Line kinds: the €0 preview line (our 3D ref + renders), paid add-ons
// ("Long sleeves"), and the jersey lines themselves.
function parseLines(o) {
  const lines = field(o, ['products', 'line_items', 'items']) || [];
  const out = { ref3d: null, previewIds: [], jerseys: 0, longSleeves: 0, items: [] };
  for (const it of lines) {
    const title = String(field(it, ['product_title', 'title', 'name']) || '');
    const vt = String(field(it, ['variant_title']) || '');
    const qty = parseInt(field(it, ['quantity', 'qty']) || 1, 10) || 1;
    let inner = field(it, ['inner_title']);
    if (typeof inner === 'string' && inner.startsWith('{')) { try { inner = JSON.parse(inner); } catch { inner = null; } }
    if (inner && inner.type === '3d-preview') { out.ref3d = out.ref3d || inner.order_no; out.previewIds.push(field(it, ['product_id'])); continue; }
    if (/^your custom design|— order [a-z0-9]{10}$/i.test(title)) { out.previewIds.push(field(it, ['product_id'])); continue; }
    if (/long sleeve|manga larga|manches longues|maniche lunghe/i.test(title + ' ' + vt)) { out.longSleeves += qty; continue; }
    if (/deposit|acompte|dep[oó]sito|acconto/i.test(title)) { out.items.push({ title, qty, kind: 'deposit' }); continue; }
    out.jerseys += qty;
    out.items.push({ title: vt && vt !== title ? `${title} / ${vt}` : title, qty, kind: 'jersey', price: field(it, ['price']) });
  }
  return out;
}

function shape(o, lang) {
  const a = field(o, ['shipping_address', 'shippingAddress', 'address']) || {};
  const name = [field(a, ['first_name', 'firstname']), field(a, ['last_name', 'lastname'])].filter(Boolean).join(' ')
    || field(a, ['name', 'full_name']) || field(o, ['customer_name', 'customerName']) || '';
  const addrParts = [field(a, ['address1', 'address_1', 'street']), field(a, ['address2', 'address_2']),
    field(a, ['city']), field(a, ['province', 'state', 'area']), field(a, ['zip', 'postcode', 'postal_code']), field(a, ['country', 'country_name'])];
  const address = field(a, ['full_address']) || addrParts.filter(Boolean).join(', ');
  const lines = parseLines(o);
  const subtotal = parseFloat(field(o, ['current_subtotal_price', 'subtotal_price']) || 0);
  const ship = parseFloat(field(o, ['current_shipping_price', 'shipping_price']) || 0);
  const total = field(o, ['current_total_price', 'total_price', 'total']) || (subtotal + ship).toFixed(2);
  return {
    store: lang,
    order_number: String(field(o, ['order_number', 'order_no', 'orderNumber']) || ''),
    platform_id: field(o, ['id']),
    created: iso(toMillis(field(o, ['created_at']))),
    paid: iso(toMillis(field(o, ['first_pay_at', 'pay_at']))),
    name, address,
    country: field(a, ['country', 'country_name']) || '',
    country_code: field(a, ['country_code', 'country_iso']) || '',
    phone: String(field(a, ['phone', 'tel', 'mobile']) || field(o, ['phone', 'customer_phone']) || ''),
    zip: String(field(a, ['zip', 'postcode', 'postal_code']) || ''),
    email: field(o, ['customer_email', 'email']) || '',
    note: field(o, ['note', 'customer_note', 'remark']) || '',
    payment: field(o, ['payment_method', 'payment_type', 'gateway']) || '',
    shipping_plan: field(o, ['shipping_plan_name', 'shipping_name', 'shipping_method', 'free_shipping_plan_name']) || '',
    shipping_price: ship,
    total: String(total), currency: field(o, ['currency_code', 'currency']) || '',
    total_num: parseInt(field(o, ['total_num', 'total_quantity']) || 0, 10) || null,
    domain: field(o, ['domain']) || '',
    is_test: parseInt(field(o, ['is_test']) || 0, 10) === 1,
    ...lines,
  };
}

// front/back renders: the preview product's images (order = front, back, …)
async function renders(token, previewIds) {
  const out = [];
  for (const id of previewIds.filter(Boolean)) {
    try {
      const d = await platform(`/products/${id}`, token);
      const p = (d && d.product) || d;
      const imgs = (field(p, ['images', 'image_list', 'imgs']) || []).map(x => typeof x === 'string' ? x : field(x, ['src', 'url', 'image']))
        .filter(Boolean);
      out.push({ front: imgs[0] || null, back: imgs[1] || null, all: imgs });
    } catch (e) { console.error(`  preview product ${id}: ${e.message}`); }
    await sleep(600);
  }
  return out;
}

// roster: [{ number, name, size, qty, sleeve?, shortSize? }]
function normaliseRoster(players) {
  return (players || []).map(p => {
    const raw = String(p.size || '');
    const parts = raw.split(' · ').map(s => s.trim());
    const size = parts[0] || '';
    let sleeve = p.sleeve || (parts.some(s => /^long$/i.test(s)) ? 'long' : 'short');
    const shorts = p.shortSize || (parts.find(s => /^SHORTS /i.test(s)) || '').replace(/^SHORTS /i, '');
    return { number: String(p.number ?? ''), name: String(p.name ?? ''), size, sleeve, shorts, qty: parseInt(p.qty, 10) || 1 };
  });
}
// Design server, direct: GET /Order/getGoods?order_no=<ref> — the routed
// endpoint the store side calls at checkout (OrderAction::getGoods, read
// 11 Sep 2026). It carries NO auth check (its Token constant is unused), so
// nothing is sent. oem_no is deliberately OMITTED: when present the endpoint
// WRITES plant_order_no onto our order, and a read-only tool must not write.
// Response: { code: 200, data: [{ urlThumbnailFront, urlThumbnailBack,
//             info: [{number,name,size,qty,...}], suit_name, defind_type }] }
const DESIGN_HOST = 'https://design.momuto.com';
async function rosterFromDesignServer(ref3d) {
  if (!ref3d) return null;
  const r = await fetch(`${DESIGN_HOST}/Order/getGoods?order_no=${encodeURIComponent(ref3d)}`);
  const text = await r.text();
  let j; try { j = JSON.parse(text); } catch { console.error(`  design-server getGoods: HTTP ${r.status} non-JSON ${text.slice(0, 120)}`); return null; }
  if (j.code !== 200 || !Array.isArray(j.data)) { console.error(`  design-server getGoods: code ${j.code} ${j.message || text.slice(0, 120)}`); return null; }
  const designs = j.data.map(g => {
    let players = field(g, ['info', 'goods_info', 'players']) || [];
    if (typeof players === 'string') { try { players = JSON.parse(players); } catch { players = []; } }
    return { suit: field(g, ['suit_name', 'suit']) || '', front: abs(field(g, ['urlThumbnailFront', 'front'])), back: abs(field(g, ['urlThumbnailBack', 'back'])), players: normaliseRoster(players) };
  });
  return designs.some(x => x.players.length) ? designs : null;
}
const abs = (u) => !u ? null : (/^https?:/i.test(u) ? u : `${DESIGN_HOST}${u.startsWith('/') ? '' : '/'}${u}`);

async function rosterFromMomutoApi(ref3d) {
  const secret = process.env.MOMUTO_API_SECRET; if (!secret || !ref3d) return null;
  const hdr = { headers: { 'x-webhook-secret': secret } };
  const r = await fetch(`${MOMUTO_API}?action=detail&q=${encodeURIComponent(ref3d)}`, hdr);
  if (!r.ok) {
    console.error(`  momuto-api detail ${r.status}: ${(await r.text()).slice(0, 200)}`);
    // diagnostics: how many records does the API hold at all? (404 = this ref never reached it)
    try {
      const l = await (await fetch(`${MOMUTO_API}?action=list`, hdr)).json();
      const f = await (await fetch(`${MOMUTO_API}?action=find&q=${encodeURIComponent(ref3d)}`, hdr)).json();
      console.error(`  momuto-api holds ${l.count ?? '?'} active orders; find(${ref3d}) → ${f.count ?? '?'} match(es)` +
        (Array.isArray(l.active) && l.active.length ? `; newest active paidAt ${l.active[l.active.length - 1].paidAt} (${l.active[l.active.length - 1].ref})` : ''));
    } catch (e) { console.error(`  momuto-api diagnostics failed: ${e.message}`); }
    return null;
  }
  const j = await r.json();
  const o = j && j.order; if (!o || !Array.isArray(o.designs)) return null;
  const designs = o.designs.map(d => ({ suit: d.suit || '', front: d.front || null, back: d.back || null, players: normaliseRoster(d.players) }));
  return designs.some(d => d.players.length) ? designs : null;
}

// ---------------------------------------------------------------- xlsx
const SLEEVE_ZH = { long: '长袖', short: '短袖' };
const PAY_ZH = (s) => /credit|debit|card|stripe/i.test(s) ? `信用卡/借记卡 (${s})` : /paypal/i.test(s) ? `PayPal (${s})` : s;
const STORE_ZH = { en: '英国/国际站 www', es: '西班牙站 es', fr: '法国站 fr', it: '意大利站 it', us: '美国站 us' };

async function fetchImage(url) {
  try {
    const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const ext = /\.jpe?g(\?|$)/i.test(url) || buf[0] === 0xff ? 'jpeg' : 'png';
    return { buffer: buf, extension: ext };
  } catch (e) { console.error(`  image ${url}: ${e.message}`); return null; }
}

async function buildSheet(order, designs, warnings) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MOMUTO';
  const ws = wb.addWorksheet('订单', { views: [{ showGridLines: true }] });
  ws.columns = [{ width: 12 }, { width: 46 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 12 }, { width: 12 }];
  const label = (c) => { c.font = { name: '宋体', size: 11, bold: true }; c.alignment = { vertical: 'top' }; };
  const value = (c) => { c.font = { name: 'Arial', size: 11 }; c.alignment = { vertical: 'top', wrapText: true }; };

  let r = 1;
  const title = ws.getCell(r, 1); title.value = `MOMUTO 生产单 · 订单 ${order.order_number}`; title.font = { name: '宋体', size: 14, bold: true };
  ws.mergeCells(r, 1, r, 6); r += 1;
  const meta = ws.getCell(r, 1); meta.value = `自动生成 ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC · 数据来源：店铺平台订单 + 3D设计服务器`; meta.font = { name: 'Arial', size: 9, color: { argb: 'FF808080' } };
  ws.mergeCells(r, 1, r, 6); r += 2;

  const jerseyQty = designs.reduce((n, d) => n + d.players.reduce((m, p) => m + p.qty, 0), 0) || order.jerseys || null;
  const rows = [
    ['订单ID', order.order_number],
    ['3D设计编号', order.ref3d || '（非3D订单）'],
    ['店铺', `${STORE_ZH[order.store] || order.store} · ${order.domain}`],
    ['下单时间', order.created], ['付款时间', order.paid || '未付款'],
    ['姓名', order.name], ['地址', order.address], ['国家', [order.country, order.country_code].filter(Boolean).join(' / ')],
    ['电话', order.phone], ['邮编', order.zip], ['邮箱', order.email], ['留言', order.note || '（无）'],
    ['总数量', jerseyQty != null ? `${jerseyQty} 件` + (order.longSleeves ? `（其中长袖 ${order.longSleeves} 件）` : '') : ''],
    ['货运方式', order.shipping_plan ? `${order.shipping_plan}（运费 ${order.shipping_price} ${order.currency}）` : `运费 ${order.shipping_price} ${order.currency}`],
    ['支付方式', PAY_ZH(order.payment)], ['总金额', `${order.total} ${order.currency}`],
  ];
  for (const [k, v] of rows) {
    label(ws.getCell(r, 1)); ws.getCell(r, 1).value = k;
    const c = ws.getCell(r, 2); c.value = v == null ? '' : v; value(c);
    if (k === '订单ID' || k === '总数量') c.font = { name: 'Arial', size: 11, bold: true };
    if (k === '电话' || k === '邮编') c.numFmt = '@';
    ws.mergeCells(r, 2, r, 6); r += 1;
  }
  // warehouse-only column, left for them (carrier line, e.g. 美国专线小包一衣0.3KG)
  ws.getCell(r, 1).value = '仓库备注'; label(ws.getCell(r, 1)); ws.getCell(r, 2).value = ''; ws.getCell(r, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
  ws.mergeCells(r, 2, r, 6); r += 2;
  if (order.is_test) { const c = ws.getCell(r, 1); c.value = '⚠ 平台标记为测试订单'; c.font = { name: '宋体', size: 11, bold: true, color: { argb: 'FFC00000' } }; r += 1; }
  for (const w of warnings) { const c = ws.getCell(r, 1); c.value = `⚠ ${w}`; c.font = { name: '宋体', size: 11, bold: true, color: { argb: 'FFC00000' } }; ws.mergeCells(r, 1, r, 6); r += 1; }
  if (warnings.length) r += 1;

  // one block per design: renders, then roster table
  const IMG_ROWS = 24, IMG_H = 24 * 20; // 24 rows × 20px ≈ 480px tall
  for (let di = 0; di < designs.length; di++) {
    const d = designs[di];
    const h = ws.getCell(r, 1); h.value = designs.length > 1 ? `设计 ${di + 1} / ${designs.length}${d.suit ? ` · ${d.suit}` : ''}` : `设计图${d.suit ? ` · ${d.suit}` : ''}`;
    h.font = { name: '宋体', size: 12, bold: true }; ws.mergeCells(r, 1, r, 6); r += 1;
    ws.getCell(r, 2).value = '正面'; ws.getCell(r, 5).value = '背面'; label(ws.getCell(r, 2)); label(ws.getCell(r, 5)); r += 1;
    const imgTop = r;
    for (const [side, col] of [['front', 1], ['back', 4]]) {
      if (!d[side]) continue;
      const im = await fetchImage(d[side]); if (!im) continue;
      const id = wb.addImage({ buffer: im.buffer, extension: im.extension });
      ws.addImage(id, { tl: { col: col, row: imgTop - 1 }, ext: { width: 300, height: IMG_H } });
    }
    for (let i = 0; i < IMG_ROWS; i++) ws.getRow(imgTop + i).height = 15;
    r = imgTop + IMG_ROWS + 1;
    const links = [d.front && `正面原图: ${d.front}`, d.back && `背面原图: ${d.back}`].filter(Boolean).join('\n');
    if (links) { const c = ws.getCell(r, 1); c.value = links; c.font = { name: 'Arial', size: 8, color: { argb: 'FF808080' } }; c.alignment = { wrapText: true }; ws.mergeCells(r, 1, r, 6); ws.getRow(r).height = 26; r += 1; }
    r += 1;

    const head = ['序号', '袖长', '尺码', '号码', '名字', '数量', '短裤尺码'];
    head.forEach((t, i) => { const c = ws.getCell(r, i + 1); c.value = t; c.font = { name: '宋体', size: 11, bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }; c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }; c.alignment = { horizontal: 'center' }; });
    r += 1;
    if (!d.players.length) {
      const c = ws.getCell(r, 1); c.value = `名单未获取 — 请在 manage.momuto.com 订单 ${order.ref3d || order.order_number} 核对号码/名字/尺码` + (jerseyQty ? `（平台数量 ${jerseyQty} 件${order.longSleeves ? `，长袖 ${order.longSleeves} 件` : ''}）` : '');
      c.font = { name: '宋体', size: 11, bold: true, color: { argb: 'FFC00000' } }; ws.mergeCells(r, 1, r, 7); r += 1;
    }
    d.players.forEach((p, i) => {
      const vals = [i + 1, SLEEVE_ZH[p.sleeve] || p.sleeve, p.size, p.number, p.name, p.qty, p.shorts || ''];
      vals.forEach((v, j) => { const c = ws.getCell(r, j + 1); c.value = v; c.font = { name: 'Arial', size: 11, bold: j === 3 || j === 4 }; c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }; c.alignment = { horizontal: 'center' }; if (j === 3) c.numFmt = '@'; });
      r += 1;
    });
    if (d.players.length) {
      const c = ws.getCell(r, 5); c.value = '合计'; c.font = { name: '宋体', size: 11, bold: true }; c.alignment = { horizontal: 'right' };
      const s = ws.getCell(r, 6); s.value = { formula: `SUM(F${r - d.players.length}:F${r - 1})`, result: d.players.reduce((n, p) => n + p.qty, 0) }; s.font = { name: 'Arial', size: 11, bold: true }; s.alignment = { horizontal: 'center' };
      r += 1;
    }
    r += 1;
  }
  ws.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  return wb;
}

// ---------------------------------------------------------------- email
async function emailSheet(order, filePath, warnings) {
  const key = process.env.RESEND_API_KEY; if (!key || args.dry) return false;
  const to = (process.env.WAREHOUSE_EMAILS || 'info@momuto.com,ilovebillxie@hotmail.com').split(',').map(s => s.trim()).filter(Boolean);
  const qty = order.jerseys ? `${order.jerseys} 件` : '';
  const subject = `生产单 ${order.order_number} · ${order.country || order.store}${qty ? ' · ' + qty : ''}${order.longSleeves ? ' · 含长袖' : ''}${warnings.length ? ' · ⚠ 需核对' : ''}`;
  const html = `<p>订单 <strong>${order.order_number}</strong>（3D ${order.ref3d || '-'}）· ${order.name} · ${order.country} · ${order.total} ${order.currency}</p>` +
    `<p>生产单见附件。${warnings.length ? '<br><strong style="color:#c00">⚠ ' + warnings.join('<br>⚠ ') + '</strong>' : ''}</p>` +
    `<p style="color:#888;font-size:12px">MOMUTO 自动生成 · 平台订单 + 3D设计服务器 · 如有疑问回复 info@momuto.com</p>`;
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.FROM_EMAIL || 'MOMUTO <orders@momuto.com>', to, subject, html,
      attachments: [{ filename: path.basename(filePath), content: fs.readFileSync(filePath).toString('base64') }] }) });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  return true;
}

// ---------------------------------------------------------------- main
async function processOrder(lang, raw, token) {
  const order = shape(raw, lang);
  const warnings = [];
  console.log(`\n[${lang}] ${order.order_number} · ${order.name} · ${order.country} · ${order.total} ${order.currency} · ref3d ${order.ref3d || '-'}`);
  if (!order.ref3d && !order.previewIds.length) warnings.push('平台订单中没有3D设计行（非3D订单或预览行缺失）');

  let designs = null;
  if (args.roster) {
    const j = JSON.parse(fs.readFileSync(args.roster, 'utf8'));
    designs = (Array.isArray(j) ? j : j.designs || [j]).map(d => ({ suit: d.suit || '', front: d.front || null, back: d.back || null, players: normaliseRoster(d.players || d) }));
    console.log(`  roster: --roster file (${designs.length} design(s))`);
  } else {
    designs = await rosterFromDesignServer(order.ref3d).catch(e => { console.error(`  roster: ${e.message}`); return null; });
    if (designs) console.log(`  roster: design server (${designs.reduce((n, d) => n + d.players.length, 0)} rows)`);
    else {
      designs = await rosterFromMomutoApi(order.ref3d).catch(e => { console.error(`  roster: ${e.message}`); return null; });
      if (designs) console.log(`  roster: momuto-api record (${designs.reduce((n, d) => n + d.players.length, 0)} rows)`);
    }
  }
  const previewRenders = await renders(token, order.previewIds);
  if (!designs) {
    designs = previewRenders.length ? previewRenders.map(p => ({ suit: '', front: p.front, back: p.back, players: [] })) : [{ suit: '', front: null, back: null, players: [] }];
    warnings.push('名单（号码/名字/尺码）未获取：3D设计服务器记录不可用，请在 manage.momuto.com 核对');
  } else {
    designs.forEach((d, i) => { const p = previewRenders[i]; if (p) { d.front = d.front || p.front; d.back = d.back || p.back; } });
  }
  const rosterQty = designs.reduce((n, d) => n + d.players.reduce((m, p) => m + p.qty, 0), 0);
  if (rosterQty && order.jerseys && rosterQty !== order.jerseys) warnings.push(`名单数量 ${rosterQty} 与平台数量 ${order.jerseys} 不一致，请核对`);
  const rosterLong = designs.reduce((n, d) => n + d.players.filter(p => p.sleeve === 'long').reduce((m, p) => m + p.qty, 0), 0);
  if (rosterQty && rosterLong !== order.longSleeves) warnings.push(`长袖数量：名单 ${rosterLong} 件，平台加购 ${order.longSleeves} 件，请核对`);

  const wb = await buildSheet(order, designs, warnings);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${order.order_number}_生产单.xlsx`);
  await wb.xlsx.writeFile(file);
  console.log(`  wrote ${file}${warnings.length ? ' · ⚠ ' + warnings.join(' | ') : ''}`);
  const sent = await emailSheet(order, file, warnings).catch(e => { console.error(`  email: ${e.message}`); return false; });
  if (sent) console.log('  📧 emailed');
  return { order: order.order_number, store: lang, file, warnings, emailed: !!sent };
}

(async () => {
  const langs = args.lang === 'all' ? Object.keys(STORES) : [args.lang];
  const results = [];
  if (args.order) {
    let done = false;
    for (const lang of langs) {
      const token = process.env[STORES[lang]]; if (!token) continue;
      const raw = await findOrder(token, args.order).catch(e => { console.error(`[${lang}] ${e.message}`); return null; });
      if (raw) { results.push(await processOrder(lang, raw, token)); done = true; break; }
    }
    if (!done) { console.error(`Order ${args.order} not found on ${langs.join(', ')}`); process.exit(1); }
  } else {
    for (const lang of langs) {
      const token = process.env[STORES[lang]]; if (!token) { console.log(`[${lang}] no token — skipped`); continue; }
      const list = await paidSince(token, args.paidSince).catch(e => { console.error(`[${lang}] ${e.message}`); return []; });
      console.log(`[${lang}] ${list.length} paid in the last ${args.paidSince} h`);
      for (const o of list) {
        // the list omits some fields; re-read the full order
        const no = String(field(o, ['order_number', 'order_no']) || '');
        const raw = (await findOrder(token, no).catch(() => null)) || o;
        results.push(await processOrder(lang, raw, token).catch(e => { console.error(`  ${no}: ${e.message}`); return { order: no, store: lang, error: e.message }; }));
        await sleep(600);
      }
    }
  }
  const md = ['## 生产单 / warehouse sheets', '', '| store | order | file | warnings | emailed |', '| --- | --- | --- | --- | --- |',
    ...results.map(x => `| ${x.store} | ${x.order} | ${x.file || ''} | ${(x.warnings || [x.error]).filter(Boolean).join('; ')} | ${x.emailed ? '✅' : ''} |`)].join('\n');
  console.log('\n' + md);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
})().catch(e => { console.error(e); process.exit(1); });
