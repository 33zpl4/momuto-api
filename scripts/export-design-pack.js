'use strict';

/**
 * READ-ONLY. Design pack (zip) for ONE saved design, with what the factory inspector shows
 * (design-momuto 3d-configurator/inspect.html): per piece the template SVG, the element colours / patterns / gradient stops, the
 * printing layers (names, numbers, fonts, positions), the uploaded logo files, the font files used, and the saved front/back
 * screenshots of the model. Source: design server `POST /v1/listSuit` (the inspector's own call) and, when REF3D is given,
 * `GET /Order/getGoods?order_no=<ref>` for the order item's snapshots (oem_no sent EMPTY: the endpoint writes only when oem_no is set).
 *
 *   CONFIG_ID=dprcls8j REF3D=zbhoj8fg9a ITEM=2 node scripts/export-design-pack.js
 *
 * Writes <OUT_DIR>/<name>/ and <OUT_DIR>/<name>.zip. The zip holds a customer's logo: it is a workflow artifact with a short
 * retention, never committed. The log prints counts and file names only (no layer text, no personal data); the raw JSON in the
 * pack has emails / phones / addresses / tokens removed.
 *
 * Env: CONFIG_ID (required), REF3D, ITEM (label only), USER_ID (the inspector's optional `u`), OUT_DIR (default design-pack),
 *      FIXTURE=<listSuit.json> (offline test of the packaging; downloads then fail and are listed in MISSING.txt)
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DESIGN_HOST = 'https://design.momuto.com';
const BASE = `${DESIGN_HOST}/3d-configurator/`;
const CONFIG = String(process.env.CONFIG_ID || '').trim();
const REF3D = String(process.env.REF3D || '').trim();
const ITEM = String(process.env.ITEM || '').trim();
const USER_ID = String(process.env.USER_ID || '').trim();
const OUT = process.env.OUT_DIR || 'design-pack';
if (!/^[a-z0-9]{6,16}$/i.test(CONFIG)) { console.error('CONFIG_ID required (letters/digits)'); process.exit(1); }

// font display name -> file basename (copy of the inspector's / the app's registry) and the desktop format
const FONT_FILES = {
  'UnionBold': 'UnionBold', 'SpurHead': 'SpurHead', 'Terrace': 'Terrace', 'Floodlight': 'Floodlight', 'Aurora BdCn BT': 'aurora',
  'Carbon Block': 'carbon block regular', 'Square721 BT': 'Square721 BT', 'Trendex Black SSi -bold -italic': 'TrendexSSi-BoldItalic',
  'AmaticSC': 'AmaticSC-Regular', 'Bangers': 'Bangers-Regular', 'Bungee': 'Bungee-Regular', 'ChakraPetch': 'ChakraPetch-Regular',
  'Crushed': 'Crushed-Regular', 'Farsan': 'Farsan-Regular', 'Monoton': 'Monoton-Regular', 'Nosifer': 'Nosifer-Regular',
  'Permanent Marker': 'PermanentMarker-Regular', 'Piedra': 'Piedra-Regular', 'PoiretOne': 'PoiretOne-Regular',
  'SairaStencilOne': 'SairaStencilOne-Regular', 'ShadowsIntoLight': 'ShadowsIntoLight-Regular', 'SirinStencil': 'SirinStencil-Regular',
  'SixCaps': 'SixCaps-Regular', 'VastShadow': 'VastShadow-Regular', 'Voltaire': 'Voltaire-Regular',
};
const FONT_DESKTOP_EXT = { SpurHead: 'otf', Terrace: 'otf', Floodlight: 'otf' };
const FONT_DIR = `${BASE}asset/ut/assets/fonts/momuto/`;

const missing = [];
const files = [];                 // relative paths inside the pack
const safe = s => String(s || 'x').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'x';
const absUrl = u => { try { return new URL(u, BASE).href; } catch { return null; } };

async function get(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
async function save(dir, rel, url, label) {
  const u = absUrl(url);
  if (!u) { missing.push(`${label}: bad url`); return null; }
  try {
    const buf = await get(u);
    const p = path.join(dir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, buf);
    files.push(path.relative(path.dirname(dir), p));
    return { path: p, buf, url: u };
  } catch (e) { missing.push(`${label}: ${u} -> ${e.message}`); return null; }
}
function redact(o) {
  if (Array.isArray(o)) return o.map(redact);
  if (o && typeof o === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(o)) out[k] = /e-?mail|phone|mobile|tel$|address|street|token|password|secret|passwd|ip$/i.test(k) ? '<removed>' : redact(v);
    return out;
  }
  return o;
}
function extOf(url, fallback) { const m = /\.([a-z0-9]{2,5})(\?|$)/i.exec(String(url || '').split('#')[0]); return m ? m[1].toLowerCase() : fallback; }

// gradient zones: selColor "url(#id)" resolved from the template SVG text
function gradientStops(svg, ref) {
  const m = /url\(\s*['"]?#([^'")\s]+)/.exec(String(ref || '')); if (!m || !svg) return null;
  const id = m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const blk = new RegExp(`<(linearGradient|radialGradient)\\b[^>]*\\bid=["']${id}["'][\\s\\S]*?</\\1>`, 'i').exec(svg);
  if (!blk) return null;
  const stops = [...blk[0].matchAll(/<stop\b([^>]*)>/gi)].map(s => {
    const a = n => { const x = new RegExp(`${n}=["']([^"']+)["']`, 'i').exec(s[1]); return x ? x[1] : ''; };
    const style = a('style'); const sc = a('stop-color') || (/stop-color\s*:\s*([^;]+)/i.exec(style) || [])[1] || '';
    return { color: sc.trim(), offset: a('offset'), opacity: a('stop-opacity') || (/stop-opacity\s*:\s*([^;]+)/i.exec(style) || [])[1] || '' };
  });
  return { type: blk[1].toLowerCase().startsWith('radial') ? 'radial' : 'linear', stops };
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  const name = `design-${REF3D || 'order'}${ITEM ? '-item' + ITEM : ''}-${CONFIG}`;
  const dir = path.join(OUT, name); fs.mkdirSync(dir, { recursive: true });

  // 1. the saved design, exactly as the inspector asks for it
  let data;
  if (process.env.FIXTURE) data = JSON.parse(fs.readFileSync(process.env.FIXTURE, 'utf8'));
  else {
    const params = new URLSearchParams({ configId: CONFIG, share: '0' }); if (USER_ID) params.append('u', USER_ID);
    const r = await fetch(`${DESIGN_HOST}/v1/listSuit`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
    let text = await r.text(); const b = text.indexOf('{'); if (b > 0) text = text.slice(b);
    try { data = JSON.parse(text); } catch { throw new Error(`listSuit: HTTP ${r.status}, not JSON: ${text.slice(0, 120)}`); }
  }
  if (!data || !data.status) throw new Error(`listSuit: status=false for configId ${CONFIG} (try USER_ID=<u from the share link>)`);
  const cols = data.cart && data.cart.suit && data.cart.suit.collections;
  if (!Array.isArray(cols) || !cols.length) throw new Error('listSuit: no collections in the response');
  fs.writeFileSync(path.join(dir, 'listSuit.raw.json'), JSON.stringify(redact(data), null, 2)); files.push(`${name}/listSuit.raw.json`);

  const summary = [], colorsJson = [], md = [`# Design ${CONFIG}${REF3D ? ` — order ${REF3D}` : ''}${ITEM ? `, item ${ITEM}` : ''}`, '', `Source: design server listSuit (the factory inspector's data). Generated ${new Date().toISOString()}.`, ''];
  const fontsWanted = new Set();

  for (let i = 0; i < cols.length; i++) {
    const col = cols[i]; const res = (col.design && col.design.result) || {};
    const pieceDir = `piece-${i + 1}-${safe(col.name)}`;
    const urlDesign = res.urlDesign || (col.design && col.design.urlDesign) || '';
    const elements = res.elements || [];
    const layers = res.layers || (col.design && col.design.layers) || [];
    md.push(`## Piece ${i + 1}: ${col.name}`, '');

    // screenshots of the model (the saved front/back snapshots)
    const shots = [];
    for (const [k, u] of [['front', col.urlThumbnailFront], ['back', col.urlThumbnailBack]]) {
      if (!u) continue;
      const got = await save(dir, `${pieceDir}/screenshot-${k}.${extOf(u, 'png')}`, u, `${pieceDir} ${k} screenshot`);
      if (got) shots.push(k);
    }
    // template
    let svgText = '';
    if (urlDesign) {
      const tpl = await save(dir, `${pieceDir}/template-${safe(urlDesign.split('?')[0].split('/').pop())}`, urlDesign, `${pieceDir} template`);
      if (tpl) svgText = tpl.buf.toString('utf8');
      md.push(`Template: \`${urlDesign}\``, '');
    } else md.push('Template: none on this config', '');

    // element colours + patterns
    md.push('| Element | Colour | Pattern |', '|---|---|---|');
    const el = [];
    for (let j = 0; j < elements.length; j++) {
      const e = elements[j]; const pat = e.selPattern || {}; const color = e.selColor || '';
      let colorTxt = color.toUpperCase();
      const grad = /^url\(/i.test(color) ? gradientStops(svgText, color) : null;
      if (grad) colorTxt = `${grad.type} gradient: ` + grad.stops.map(s => `${String(s.color).toUpperCase()}${s.offset ? ' @' + s.offset : ''}${s.opacity ? ' op ' + s.opacity : ''}`).join(' → ');
      else if (/^url\(/i.test(color)) colorTxt = `gradient ${color} (not resolved)`;
      let patTxt = 'none';
      if (pat.active && pat.urlPattern) {
        const pn = safe(pat.urlPattern.split('?')[0].split('/').pop());
        await save(dir, `${pieceDir}/patterns/${pn}`, pat.urlPattern, `${pieceDir} pattern ${pn}`);
        patTxt = `${pn.replace(/\.svg$/i, '')}${pat.patternColor ? ' · ' + String(pat.patternColor).toUpperCase() : ''}${pat.scale != null ? ' · scale ' + pat.scale : ''}${pat.angle ? ' · angle ' + pat.angle : ''}`;
      }
      md.push(`| ${e.elementName || 'Other'} | ${colorTxt || '—'} | ${patTxt} |`);
      el.push({ element: e.elementName || 'Other', color, gradient: grad || undefined, pattern: pat.active ? { url: pat.urlPattern, color: pat.patternColor, scale: pat.scale, angle: pat.angle } : null });
    }
    md.push('');

    // printing layers (placeholders the customer cleared are skipped, as in the inspector)
    const used = layers.filter(l => (l.type || 'text').toLowerCase() === 'logo' || !!l.logo || String(l.text == null ? '' : l.text).trim() !== '');
    let logoN = 0; const lay = [];
    if (used.length) md.push('### Printing layers', '', '| # | Type | Content | Font | Colours | Size | cx | cy | Angle |', '|---|---|---|---|---|---|---|---|---|');
    for (let k = 0; k < used.length; k++) {
      const l = used[k]; const type = (l.type || 'text').toLowerCase();
      let content = '', font = '—', cols2 = '—', logoFile = null;
      if (type === 'logo' || l.logo) {
        const lg = l.logo || {}; const url = lg.url || lg.urlLogo || lg.src || l.url || '';
        if (url) { logoN++; const got = await save(dir, `${pieceDir}/logos/logo-${logoN}-${safe(String(url).split('?')[0].split('/').pop())}`, url, `${pieceDir} logo ${logoN}`); logoFile = got ? path.basename(got.path) : null; }
        content = logoFile ? `logo file: ${logoFile}` : 'logo (file not downloaded)';
      } else {
        content = String(l.text == null ? '' : l.text).replace(/\|/g, '\\|');
        const fn = l.font && l.font.name ? l.font.name : (typeof l.font === 'string' ? l.font : '');
        font = fn || 'no font'; if (fn) fontsWanted.add(fn);
        cols2 = [l.color && `fill ${String(l.color).toUpperCase()}`, l.outline && `outline ${String(l.outline).toUpperCase()}${l.outlineStrength != null ? ' (str ' + l.outlineStrength + ')' : ''}`, l.background && `bg ${l.background}`].filter(Boolean).join(', ') || '—';
      }
      md.push(`| ${k + 1} | ${type} | ${content} | ${font} | ${cols2} | ${l.size ?? '?'} | ${l.cx != null ? Math.round(l.cx) : '?'} | ${l.cy != null ? Math.round(l.cy) : '?'} | ${l.angle || 0} |`);
      lay.push({ type, text: type === 'logo' ? undefined : l.text, font: font === '—' ? undefined : font, color: l.color, outline: l.outline, outlineStrength: l.outlineStrength, background: l.background, size: l.size, cx: l.cx, cy: l.cy, angle: l.angle, logoFile: logoFile || undefined });
    }
    md.push('');
    if (res.brandPick) md.push(`MOMUTO mark (customer's choice): ${res.brandPick}`, '');
    if (res.logoColor) md.push(`Logo colour override: ${res.logoColor}`, '');
    if (res.markTint) md.push(`MOMUTO mark tint: ${JSON.stringify(res.markTint)}`, '');
    colorsJson.push({ piece: col.name, template: urlDesign, elements: el, layers: lay, brandPick: res.brandPick || null, logoColor: res.logoColor || null, markTint: res.markTint || null });
    summary.push(`piece ${i + 1} ${col.name}: template ${urlDesign ? 'yes' : 'none'}, ${elements.length} element(s), ${used.length} layer(s), ${logoN} logo file(s), screenshots: ${shots.join('+') || 'none'}`);
  }

  // font files used by the text layers
  for (const fn of fontsWanted) {
    const base = FONT_FILES[fn];
    if (!base) { missing.push(`font "${fn}" is not in the registry`); continue; }
    const ext = FONT_DESKTOP_EXT[base] || 'ttf';
    await save(dir, `fonts/${base}.${ext}`, encodeURI(`${FONT_DIR}${base}.${ext}`), `font ${fn}`);
  }

  // the order item's own snapshots (design server getGoods), when the order ref is known
  if (REF3D) {
    try {
      const r = await fetch(`${DESIGN_HOST}/Order/getGoods?order_no=${encodeURIComponent(REF3D)}&oem_no=&uuid=`);
      let text = await r.text(); const b = text.indexOf('{'); if (b > 0) text = text.slice(b);
      const j = JSON.parse(text);
      if (j.code === 200 && Array.isArray(j.data)) {
        const idx = ITEM ? Number(ITEM) - 1 : 0; const g = j.data[idx];
        summary.push(`getGoods: ${j.data.length} item(s) in the order, using item ${idx + 1}${g ? ` (${g.suit_name || g.suit || 'suit ?'})` : ' (not found)'}`);
        if (g) for (const [k, u] of [['front', g.urlThumbnailFront || g.front], ['back', g.urlThumbnailBack || g.back]]) if (u) await save(dir, `order-item/screenshot-${k}.${extOf(u, 'png')}`, u, `order item ${k} snapshot`);
      } else summary.push(`getGoods: code ${j.code}`);
    } catch (e) { missing.push(`getGoods: ${e.message}`); }
  }

  fs.writeFileSync(path.join(dir, 'colors.md'), md.join('\n')); files.push(`${name}/colors.md`);
  fs.writeFileSync(path.join(dir, 'colors.json'), JSON.stringify(colorsJson, null, 2)); files.push(`${name}/colors.json`);
  if (missing.length) fs.writeFileSync(path.join(dir, 'MISSING.txt'), missing.join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'README.txt'), [
    `Design pack for configId ${CONFIG}${REF3D ? `, order ${REF3D}` : ''}${ITEM ? `, item ${ITEM}` : ''}.`, '',
    'colors.md / colors.json : element colours, patterns, gradient stops, printing layers and positions, as the factory inspector shows them',
    'piece-*/template-*.svg   : the template file(s) the design was made on',
    'piece-*/screenshot-*     : the saved front/back screenshots of the model',
    'piece-*/logos/           : the logo file(s) the customer uploaded',
    'piece-*/patterns/        : pattern files in use',
    'fonts/                   : font files used by the name / number / text layers',
    'order-item/              : the order item\'s own snapshots from the design server (when the order ref was given)',
    'listSuit.raw.json        : the raw design (personal fields removed)',
    missing.length ? 'MISSING.txt             : files that could not be downloaded' : '', ''].filter(x => x !== '').join('\n'));

  const zip = path.join(OUT, `${name}.zip`);
  execFileSync('zip', ['-r', '-q', path.resolve(zip), name], { cwd: OUT });
  console.log(`pack ${name}`); summary.forEach(s => console.log('  ' + s));
  console.log(`  ${files.length + 3} file(s) in the pack, zip ${(fs.statSync(zip).size / 1024).toFixed(0)} KB`);
  const listing = execFileSync('unzip', ['-Z1', path.resolve(zip)]).toString().trim().split('\n');
  listing.forEach(f => console.log('   - ' + f));
  if (missing.length) { console.log(`  NOT DOWNLOADED (${missing.length}):`); missing.forEach(m => console.log('   ! ' + m)); }
}
main().catch(e => { console.error('FAILED', e.message); process.exit(1); });
