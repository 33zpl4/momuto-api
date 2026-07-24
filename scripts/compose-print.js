'use strict';

/**
 * Iconic Series print composer (drop 02+).
 *
 * Raw artwork SVG + three strings (title / plate / number) → finished back
 * print, using the frame template extracted from the drop 01 geometry
 * (mockups/frames/iconic-frame.svg: drop 01 frame verbatim + mirrored plate
 * rail + Trajan Pro text slots).
 *
 *   node scripts/compose-print.js mockups/artwork/iconic-series/drop-02/el-himno.svg
 *
 * Each artwork needs a sidecar .json next to it:
 *   { "title": "EL HIMNO", "plate": "ARG 2–1 ENG · 15.07.26", "number": "IM-07",
 *     "panel": "#EFE7D8", "recolor": { "#e67929": "panel" } }
 *
 * "recolor" rewrites fill colors in the artwork before rendering (value
 * "panel" = the panel color) — this is how the vectorization-helper orange
 * background becomes the series cream.
 *
 * Output: mockups/prints/<collection>/<drop>/<design>.png — a 2048x3072
 * screen-resolution print master the mockup generator mounts on the shirt.
 * Production print files still come from the illustrator's working file.
 *
 * Text is set live in Trajan Pro, so the fonts in mockups/fonts/ are synced
 * to ~/.fonts before rendering (librsvg finds fonts via fontconfig only).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'mockups', 'frames', 'iconic-frame.svg');
const FONTS_DIR = path.join(ROOT, 'mockups', 'fonts');
const ARTWORK_DIR = path.join(ROOT, 'mockups', 'artwork');
const PRINTS_DIR = path.join(ROOT, 'mockups', 'prints');

const SCALE = 2; // template is 1024x1536; render the print master at 2x
const PANEL = { x: 183, y: 313, width: 658, height: 824 }; // template px (art stops above the plate band)

function ensureFonts() {
  const dest = path.join(os.homedir(), '.fonts');
  fs.mkdirSync(dest, { recursive: true });
  for (const f of fs.readdirSync(FONTS_DIR)) {
    const to = path.join(dest, f);
    if (!fs.existsSync(to)) fs.copyFileSync(path.join(FONTS_DIR, f), to);
  }
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function renderArtwork(svgPath, spec) {
  let svg = fs.readFileSync(svgPath, 'utf8');
  for (const [from, to] of Object.entries(spec.recolor || {})) {
    const color = to === 'panel' ? spec.panel : to;
    if (!color) throw new Error(`recolor target "${to}" needs "panel" set in the sidecar`);
    svg = svg.split(`fill="${from}"`).join(`fill="${color}"`);
  }
  const buf = Buffer.from(svg);
  const meta = await sharp(buf).metadata();
  const boxW = PANEL.width * SCALE;
  const boxH = PANEL.height * SCALE;
  // Render dense enough that cover-cropping never upscales.
  const density = 72 * Math.max(boxW / meta.width, boxH / meta.height);
  return sharp(buf, { density: Math.min(density, 2400) })
    .resize({ width: boxW, height: boxH, fit: 'cover' })
    .png()
    .toBuffer();
}

async function composeOne(svgPath) {
  const sidecarPath = svgPath.replace(/\.svg$/, '.json');
  if (!fs.existsSync(sidecarPath)) {
    throw new Error(`missing sidecar ${path.basename(sidecarPath)} (title/plate/number)`);
  }
  const spec = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
  for (const k of ['title', 'plate', 'number']) {
    if (!spec[k]) throw new Error(`sidecar is missing "${k}"`);
  }

  const art = await renderArtwork(svgPath, spec);
  const printSvg = fs.readFileSync(TEMPLATE, 'utf8')
    .replace('{{PANEL}}', spec.panel || '#ffffff')
    .replace('{{ART_HREF}}', `data:image/png;base64,${art.toString('base64')}`)
    .replace('{{TITLE}}', escapeXml(spec.title))
    .replace('{{PLATE}}', escapeXml(spec.plate))
    .replace('{{NUMBER}}', escapeXml(spec.number));

  const rel = path.relative(ARTWORK_DIR, svgPath).replace(/\.svg$/, '.png');
  const outPath = path.join(PRINTS_DIR, rel.startsWith('..') ? path.basename(rel) : rel);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await sharp(Buffer.from(printSvg), { density: 72 * SCALE }).png().toFile(outPath);
  return outPath;
}

// No args: compose every artwork that has a sidecar (skipping _demo/_incoming files).
function findComposable(dir) {
  const found = [];
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findComposable(p));
    else if (entry.name.endsWith('.svg') && fs.existsSync(p.replace(/\.svg$/, '.json'))) found.push(p);
  }
  return found;
}

(async () => {
  const targets = process.argv.slice(2).length ? process.argv.slice(2) : findComposable(ARTWORK_DIR);
  if (!targets.length) {
    console.log('Nothing to compose (no artwork with a title/plate/number sidecar).');
    return;
  }
  let failed = 0;
  for (const t of targets) {
    try {
      ensureFonts();
      const out = await composeOne(path.resolve(t));
      console.log(`✓ ${path.relative(ROOT, out)}`);
    } catch (err) {
      failed++;
      console.error(`✗ ${path.basename(t)}: ${err.message}`);
    }
  }
  if (failed) process.exit(1);
})();
