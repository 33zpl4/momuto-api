'use strict';

/**
 * Flat-garment mockup generator (Iconic Series t-shirts, drop 02+).
 *
 * Composites raw SVG artwork onto a flat product photo (TIFF/PNG/JPG) so
 * every mockup comes out with identical placement, scale and export settings.
 *
 *   node scripts/generate-mockups.js                     # all artwork x all templates
 *   node scripts/generate-mockups.js --template tshirt-black-flat
 *   node scripts/generate-mockups.js --artwork mockups/artwork/iconic-series/drop-02/the-volley.svg
 *   node scripts/generate-mockups.js --debug             # draw the print box on each template
 *
 * Templates live in mockups/templates/: an image file plus a .json config with
 * the same basename (see mockups/README.md for the schema). Artwork is any
 * .svg under mockups/artwork/ (text must be outlined — no font loading here).
 * Output lands in mockups/output/<artwork-path>--<template>.<ext>.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT, 'mockups', 'templates');
const ARTWORK_DIR = path.join(ROOT, 'mockups', 'artwork');
const OUTPUT_DIR = path.join(ROOT, 'mockups', 'output');

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { template: null, artwork: null, out: OUTPUT_DIR, debug: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--template') args.template = argv[++i];
    else if (a === '--artwork') args.artwork = argv[++i];
    else if (a === '--out') args.out = path.resolve(argv[++i]);
    else if (a === '--debug') args.debug = true;
    else {
      console.error(`Unknown argument: ${a}`);
      process.exit(1);
    }
  }
  return args;
}

// ── Discovery ────────────────────────────────────────────────────────────────

function loadTemplates(onlyName) {
  const templates = [];
  for (const file of fs.readdirSync(TEMPLATES_DIR)) {
    if (!file.endsWith('.json') || file.endsWith('.example.json')) continue;
    const name = file.replace(/\.json$/, '');
    if (onlyName ? name !== onlyName : name.startsWith('_')) continue; // _ = demo/test, explicit only
    const config = JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf8'));
    const imagePath = path.join(TEMPLATES_DIR, config.image || '');
    if (!config.image || !fs.existsSync(imagePath)) {
      console.warn(`⚠ ${file}: template image "${config.image}" not found — skipping`);
      continue;
    }
    if (!config.print || !['x', 'y', 'width', 'height'].every(k => Number.isFinite(config.print[k]))) {
      console.warn(`⚠ ${file}: "print" box needs numeric x/y/width/height — skipping`);
      continue;
    }
    templates.push({ name, config, imagePath });
  }
  return templates;
}

function findArtwork(target) {
  const start = target ? path.resolve(target) : ARTWORK_DIR;
  if (!fs.existsSync(start)) return [];
  if (fs.statSync(start).isFile()) return start.endsWith('.svg') ? [start] : [];
  const skipUnderscore = !target; // _ = demo/test, included only when asked for explicitly
  const found = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skipUnderscore && entry.name.startsWith('_')) continue;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith('.svg')) found.push(p);
    }
  })(start);
  return found.sort();
}

// ── Rendering ────────────────────────────────────────────────────────────────

async function rasterizeSvg(svgPath, boxW, boxH) {
  const svg = fs.readFileSync(svgPath);
  const meta = await sharp(svg).metadata();
  if (!meta.width || !meta.height) {
    throw new Error('SVG has no intrinsic size — add width/height or a viewBox');
  }
  // Render at the density that makes the SVG fill the print box, so we never
  // upscale a low-res raster. Sharp treats SVGs as 72 dpi at intrinsic size.
  const scale = Math.min(boxW / meta.width, boxH / meta.height);
  const density = Math.min(72 * scale, 2400);
  return sharp(svg, { density })
    .resize({
      width: Math.round(meta.width * scale),
      height: Math.round(meta.height * scale),
      fit: 'inside',
    })
    .png()
    .toBuffer();
}

function placeInBox(artMeta, print) {
  const gravity = print.gravity || 'center';
  const left = print.x + Math.round((print.width - artMeta.width) / 2);
  let top;
  if (gravity === 'north') top = print.y;
  else if (gravity === 'south') top = print.y + print.height - artMeta.height;
  else top = print.y + Math.round((print.height - artMeta.height) / 2);
  return { left, top };
}

async function generateOne(template, svgPath, outDir) {
  const { config, imagePath, name } = template;
  const { print } = config;
  const out = config.output || {};

  const art = await rasterizeSvg(svgPath, print.width, print.height);
  const artMeta = await sharp(art).metadata();
  const { left, top } = placeInBox(artMeta, print);

  let img = sharp(imagePath).flatten({ background: out.background || '#ffffff' });
  img = img.composite([{ input: art, left, top, blend: config.blend || 'over' }]);

  if (out.maxWidth) {
    // Composite coordinates are in template pixels, so resize only afterwards.
    img = sharp(await img.toBuffer()).resize({ width: out.maxWidth, withoutEnlargement: true });
  }

  const format = (out.format || 'jpg').replace('jpeg', 'jpg');
  const rel = path.relative(ARTWORK_DIR, svgPath).replace(/\.svg$/, '');
  const base = rel.startsWith('..') ? path.basename(svgPath, '.svg') : rel;
  const outPath = path.join(outDir, `${base}--${name}.${format}`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  if (format === 'png') await img.png().toFile(outPath);
  else await img.jpeg({ quality: out.quality || 90 }).toFile(outPath);
  return outPath;
}

// Draw the print box on the template so placement can be calibrated by eye.
async function debugPlacement(template, outDir) {
  const { config, imagePath, name } = template;
  const { x, y, width, height } = config.print;
  const meta = await sharp(imagePath).metadata();
  const overlay = Buffer.from(
    `<svg width="${meta.width}" height="${meta.height}">
       <rect x="${x}" y="${y}" width="${width}" height="${height}"
             fill="rgba(255,0,0,0.15)" stroke="red" stroke-width="6"/>
     </svg>`
  );
  const outPath = path.join(outDir, `_debug--${name}-placement.jpg`);
  fs.mkdirSync(outDir, { recursive: true });
  await sharp(imagePath)
    .flatten({ background: '#ffffff' })
    .composite([{ input: overlay }])
    .jpeg({ quality: 85 })
    .toFile(outPath);
  return outPath;
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  const args = parseArgs(process.argv);
  const templates = loadTemplates(args.template);
  if (!templates.length) {
    console.error(args.template
      ? `No template named "${args.template}" in mockups/templates/`
      : 'No templates found in mockups/templates/ (need image + <name>.json)');
    process.exit(1);
  }

  if (args.debug) {
    for (const t of templates) {
      console.log(`debug: ${path.relative(ROOT, await debugPlacement(t, args.out))}`);
    }
    return;
  }

  const artwork = findArtwork(args.artwork);
  if (!artwork.length) {
    console.error(`No .svg artwork found in ${args.artwork || path.relative(ROOT, ARTWORK_DIR)}`);
    process.exit(1);
  }

  let failed = 0;
  for (const t of templates) {
    for (const svg of artwork) {
      try {
        const outPath = await generateOne(t, svg, args.out);
        console.log(`✓ ${path.relative(ROOT, outPath)}`);
      } catch (err) {
        failed++;
        console.error(`✗ ${path.basename(svg)} on ${t.name}: ${err.message}`);
      }
    }
  }
  if (failed) process.exit(1);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
