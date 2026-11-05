#!/usr/bin/env node
// GET-only: read a platform product's images and download each one, so we can
// see what the platform actually stored (dead CDN url vs a real but blank image).
// Env: STORE (en|fr|es|it|us), PRODUCT_IDS (comma list), OUT (dir for the files).
const fs = require('fs');
const path = require('path');
const store = (process.env.STORE || 'us').toUpperCase();
const token = process.env['OEMSAAS_TOKEN_' + store];
const ids = String(process.env.PRODUCT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const out = process.env.OUT || 'product-images';
const sleep = ms => new Promise(r => setTimeout(r, ms));
function jpegSize(b) {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  for (let i = 2; i < b.length - 9;) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return `${b.readUInt16BE(i + 7)}x${b.readUInt16BE(i + 5)}`;
    i += 2 + len;
  }
  return null;
}
function pngSize(b) { return b.slice(1, 4).toString() === 'PNG' ? `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}` : null; }
(async () => {
  if (!token) throw new Error('no token for ' + store);
  fs.mkdirSync(out, { recursive: true });
  for (const id of ids) {
    const r = await fetch('https://openapi.oemapps.com/products/' + id, { headers: { token } });
    const j = await r.json().catch(() => null);
    if (!j || j.code !== 0) { console.log(`${id}: code=${j && j.code} msg=${j && j.msg}`); continue; }
    const d = j.data;
    const imgs = (d.images || []).map(im => (typeof im === 'string' ? { src: im } : im));
    console.log(`${id}: "${d.title}" created_at=${d.created_at} (${new Date(d.created_at * 1000).toISOString()}) cover=${d.src}`);
    console.log(`   images: ${imgs.length}`);
    for (const [i, im] of imgs.entries()) {
      const meta = Object.entries(im).filter(([k, v]) => k !== 'src' && v != null && typeof v !== 'object').map(([k, v]) => `${k}=${v}`).join(' ');
      try {
        const res = await fetch(im.src);
        const buf = Buffer.from(await res.arrayBuffer());
        const ct = res.headers.get('content-type') || '';
        const dim = jpegSize(buf) || pngSize(buf) || '?';
        const ext = /png/.test(ct) ? 'png' : /webp/.test(ct) ? 'webp' : 'jpg';
        const f = path.join(out, `${id}-${i + 1}.${ext}`);
        if (res.ok) fs.writeFileSync(f, buf);
        console.log(`   [${i + 1}] http=${res.status} type=${ct} bytes=${buf.length} dim=${dim} ${im.src} ${meta}`);
      } catch (e) { console.log(`   [${i + 1}] FETCH ERROR ${e.message} ${im.src}`); }
      await sleep(200);
    }
    await sleep(600);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
