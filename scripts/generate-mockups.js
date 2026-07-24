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
const PRINTS_DIR = path.join(ROOT, 'mockups', 'prints');
const OUTPUT_DIR = path.join(ROOT, 'mockups', 'output');
const RASTER_RE = /\.(png|jpe?g)$/;

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

// Mountable artwork: .svg files, or composed print masters (.png/.jpg from
// scripts/compose-print.js). In batch mode an .svg with a sidecar .json is
// skipped — it gets composed into a print first, and the print is what mounts.
function isMountable(p) {
  return p.endsWith('.svg') || RASTER_RE.test(p);
}

function findArtwork(target) {
  if (target) {
    const start = path.resolve(target);
    if (!fs.existsSync(start)) return [];
    if (fs.statSync(start).isFile()) return isMountable(start) ? [start] : [];
    const found = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (isMountable(p)) found.push(p);
      }
    })(start);
    return found.sort();
  }
  const found = [];
  (function walk(dir, exts) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('_')) continue; // demo/test, explicit only
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p, exts);
      else if (exts.test(p)) {
        if (p.endsWith('.svg') && fs.existsSync(p.replace(/\.svg$/, '.json'))) continue;
        found.push(p);
      }
    }
  })(ARTWORK_DIR, /\.svg$/);
  (function walkPrints(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('_')) continue;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walkPrints(p);
      else if (RASTER_RE.test(p)) found.push(p);
    }
  })(PRINTS_DIR);
  return found.sort();
}

// ── Rendering ────────────────────────────────────────────────────────────────

async function prepArtwork(artPath, boxW, boxH) {
  if (RASTER_RE.test(artPath)) {
    return sharp(artPath)
      .resize({ width: boxW, height: boxH, fit: 'inside', withoutEnlargement: false })
      .png()
      .toBuffer();
  }
  return rasterizeSvg(artPath, boxW, boxH);
}

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

// Make the print react to the garment: lift the shirt's own luminance under
// the print box (the wrinkles are already in the photo), recentre it around
// neutral grey scaled by `strength`, and hard-light it onto the print —
// the code equivalent of the mockup PSD's Hard-Light/28%-Fill smart object.
async function applyFabric(art, artMeta, imagePath, left, top, strength) {
  const shading = await sharp(imagePath)
    .extract({ left, top, width: artMeta.width, height: artMeta.height })
    .greyscale()
    .blur(2)
    .linear(strength, 128 * (1 - strength))
    .toBuffer();
  const alpha = await sharp(art).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  const shaded = await sharp(art)
    .composite([{ input: shading, blend: 'hard-light' }])
    .removeAlpha()
    .toBuffer();
  return sharp(shaded)
    .joinChannel(alpha.data, { raw: { width: alpha.info.width, height: alpha.info.height, channels: 1 } })
    .png()
    .toBuffer();
}

async function generateOne(template, svgPath, outDir) {
  const { config, imagePath, name } = template;
  const { print } = config;
  const out = config.output || {};

  let art = await prepArtwork(svgPath, print.width, print.height);
  const artMeta = await sharp(art).metadata();
  const { left, top } = placeInBox(artMeta, print);
  if (config.fabric) {
    art = await applyFabric(art, artMeta, imagePath, left, top, config.fabric);
  }

  let img = sharp(imagePath).flatten({ background: out.background || '#ffffff' });
  img = img.composite([{ input: art, left, top, blend: config.blend || 'over' }]);

  // Composite coordinates are in template pixels, so resize only afterwards.
  // `size` forces exact square output — the garment PSDs export 3992x3993, so
  // maxWidth alone would yield 1500x1501 and not match the drop 01 assets.
  if (out.size) {
    img = sharp(await img.toBuffer())
      .resize({ width: out.size, height: out.size, fit: 'fill' });
  } else if (out.maxWidth) {
    img = sharp(await img.toBuffer()).resize({ width: out.maxWidth, withoutEnlargement: true });
  }

  const format = (out.format || 'jpg').replace('jpeg', 'jpg');
  const srcDir = RASTER_RE.test(svgPath) ? PRINTS_DIR : ARTWORK_DIR;
  const rel = path.relative(srcDir, svgPath).replace(/\.(svg|png|jpe?g)$/, '');
  const base = rel.startsWith('..') ? path.basename(rel) : rel;
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
    if (args.template) {
      console.error(`No template named "${args.template}" in mockups/templates/`);
      process.exit(1);
    }
    console.log('No garment templates in mockups/templates/ yet — nothing to mount.');
    return;
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
    // Pair artwork to templates: config "match"/"skip" are regexes tested
    // against the artwork basename (front lockups vs back prints).
    const eligible = artwork.filter(a => {
      const base = path.basename(a);
      if (t.config.match && !new RegExp(t.config.match).test(base)) return false;
      if (t.config.skip && new RegExp(t.config.skip).test(base)) return false;
      return true;
    });
    for (const svg of eligible) {
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
