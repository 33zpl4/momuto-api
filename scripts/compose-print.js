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
const FRONT_TEMPLATE = path.join(ROOT, 'mockups', 'frames', 'front-lockup.svg');
const FONTS_DIR = path.join(ROOT, 'mockups', 'fonts');
const ARTWORK_DIR = path.join(ROOT, 'mockups', 'artwork');
const PRINTS_DIR = path.join(ROOT, 'mockups', 'prints');

const SCALE = 2; // template is 782x1098; render the print master at 2x
const PANEL = { x: 262.6, y: 150.5, width: 729, height: 906.5 }; // frame opening, template px

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

// The plate line should fill the gap between its flanking rules regardless of
// how long the string is. Measure the rendered ink at a base size, then scale
// size + tracking to hit the target width (capped so short plates don't balloon).
const PLATE_GAP = 474; // usable width between the plate rule stacks, template px
const PLATE_BAND_CENTER = 1092.75; // vertical center of the plate rules
async function fitPlate(text) {
  const base = 30, baseTracking = 3.2, maxSize = 33;
  const probe = `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="120">
    <text x="10" y="80" style="font-weight:bold;font-size:${base}px;font-family:'Trajan Pro';letter-spacing:${baseTracking}px;fill:#fff">${escapeXml(text)}</text></svg>`;
  const { info } = await sharp(Buffer.from(probe), { density: 288 })
    .trim({ threshold: 10 })
    .toBuffer({ resolveWithObject: true });
  const naturalWidth = info.width / 4; // rendered at 4x
  const f = Math.min(PLATE_GAP / naturalWidth, maxSize / base);
  const size = base * f;
  return {
    size: size.toFixed(2),
    spacing: (baseTracking * f).toFixed(2),
    // caps sit optically centered on the rules band (cap height ≈ 0.78 em)
    y: (PLATE_BAND_CENTER + size * 0.39).toFixed(1),
  };
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
  const boxW = Math.round(PANEL.width * SCALE);
  const boxH = Math.round(PANEL.height * SCALE);
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
  const plate = await fitPlate(spec.plate);
  const printSvg = fs.readFileSync(TEMPLATE, 'utf8')
    .replace('{{PANEL}}', spec.panel || '#ffffff')
    .replace('{{ART_HREF}}', `data:image/png;base64,${art.toString('base64')}`)
    .replace('{{TITLE}}', escapeXml(spec.title))
    .replace('{{PLATE}}', escapeXml(spec.plate))
    .replace('{{PLATE_SIZE}}', plate.size)
    .replace('{{PLATE_SPACING}}', plate.spacing)
    .replace('{{PLATE_Y}}', plate.y)
    .replace('{{NUMBER}}', escapeXml(spec.number));

  const rel = path.relative(ARTWORK_DIR, svgPath).replace(/\.svg$/, '.png');
  const outPath = path.join(PRINTS_DIR, rel.startsWith('..') ? path.basename(rel) : rel);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await sharp(Buffer.from(printSvg), { density: 72 * SCALE }).png().toFile(outPath);

  await composeFront(spec, outPath.replace(/\.png$/, '-front.png'));
  return outPath;
}

// Front chest lockup: momuto wordmark + accession number (drop 01 sets the
// number with an en dash — IM–05 — so a hyphen in the sidecar is upgraded).
async function composeFront(spec, outPath) {
  const number = spec.number.replace('-', '–');
  const svg = fs.readFileSync(FRONT_TEMPLATE, 'utf8').replace('{{NUMBER}}', escapeXml(number));
  // Lockup doc is in mm units, where librsvg applies density twice (ink width
  // scales with density squared): 184 lands ≈ 2000px wide. Trimmed to ink.
  await sharp(Buffer.from(svg), { density: 184 })
    .trim({ threshold: 10 })
    .png()
    .toFile(outPath);
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
