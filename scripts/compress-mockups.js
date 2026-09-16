#!/usr/bin/env node
'use strict';

/**
 * Replaces the tinypng.com step.
 *
 * TinyPNG's trick is palette quantisation — reduce the image to N colours and
 * the PNG shrinks hard, which is why it works so well on flat vector artwork.
 * sharp does the same thing locally.
 *
 * Offline by design: no API key, no upload, nothing phones home. Runs whether
 * or not the machine has network.
 *
 *   node scripts/compress-mockups.js <dir-or-file> [--max 325] [--min-colours 256] [--dither 1.0] [--out DIR]
 *
 * QUALITY HAS A FLOOR AND THE CAP DOES NOT OVERRIDE IT. `--min-colours` is the
 * fewest colours a file may be reduced to, default 256 — which is a PNG
 * palette's maximum, so by default nothing is quantised below full palette at
 * all. Earlier versions searched all the way down to 2 colours to get under
 * the cap, and on a mockup that means posterised shading a customer can see.
 * Now a file that will not fit under the cap at the floor is shipped at the
 * floor and reported, not crushed further.
 *
 * With the floor at 256 the one lever left that keeps every colour is
 * `--dither`. 1.0 (default) is full Floyd–Steinberg, which is what keeps the
 * template's shadows smooth at 256 colours; it also adds noise the encoder
 * cannot compress. Lowering it shrinks the file but bands the shading, so it
 * is opt-in — try 0.5 on a file that is over and judge it by eye.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const PALETTE_MAX = 256;

function parseArgs(argv) {
  const a = { inputs: [], max: 325, minColours: PALETTE_MAX, dither: 1.0, out: null };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--max') a.max = Number(argv[++i]);
    else if (k === '--min-colours' || k === '--min-colors') a.minColours = Number(argv[++i]);
    else if (k === '--dither') a.dither = Number(argv[++i]);
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--min') i++;   // former "min KB" flag; never did anything, accepted so old commands still run
    else if (k.startsWith('--')) { console.error(`Unknown argument: ${k}`); process.exit(1); }
    else a.inputs.push(k);
  }
  if (!(a.minColours >= 2 && a.minColours <= PALETTE_MAX)) {
    console.error(`--min-colours must be between 2 and ${PALETTE_MAX} (got ${a.minColours})`);
    process.exit(1);
  }
  if (!(a.dither >= 0 && a.dither <= 1)) {
    console.error(`--dither must be between 0 and 1 (got ${a.dither})`);
    process.exit(1);
  }
  return a;
}

const KB = 1024;

async function encode(buf, colours, dither) {
  return sharp(buf).png({
    palette: true,
    colours,
    dither,
    effort: 10,
    compressionLevel: 9,
  }).toBuffer();
}

/**
 * The most colours that land at or under maxBytes, never fewer than `floor`.
 *
 * Fewer colours is monotonically smaller, so a binary search between the floor
 * and the palette maximum is exact. When the floor IS the maximum — the default
 * — there is nothing to search: one encode, and the answer is whatever size it
 * is. `over` reports that the cap was not reached; the file is returned at the
 * floor regardless, because the floor is the point.
 */
async function fit(buf, maxBytes, floor, dither) {
  const full = await encode(buf, PALETTE_MAX, dither);
  if (full.length <= maxBytes) return { out: full, colours: PALETTE_MAX, over: false };
  if (floor >= PALETTE_MAX) return { out: full, colours: PALETTE_MAX, over: true };

  let lo = floor, hi = PALETTE_MAX - 1, best = null;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = await encode(buf, mid, dither);
    if (candidate.length <= maxBytes) { best = { out: candidate, colours: mid, over: false }; lo = mid + 1; }
    else hi = mid - 1;
  }
  if (best) return best;
  return { out: await encode(buf, floor, dither), colours: floor, over: true };
}

async function run() {
  const args = parseArgs(process.argv);
  if (!args.inputs.length) {
    console.error('Usage: node scripts/compress-mockups.js <dir-or-file> [--max 325] [--min-colours 256] [--dither 1.0] [--out DIR]');
    process.exit(1);
  }

  const files = [];
  for (const input of args.inputs) {
    const st = fs.statSync(input);
    if (st.isDirectory()) {
      for (const f of fs.readdirSync(input)) {
        if (/\.png$/i.test(f) && !/\.min\.png$/i.test(f)) files.push(path.join(input, f));
      }
    } else files.push(input);
  }
  if (!files.length) { console.error('No .png files found.'); process.exit(1); }

  const maxBytes = args.max * KB;
  let over = 0;
  console.log(`cap ${args.max} KB · floor ${args.minColours} colours · dither ${args.dither} · ${files.length} file(s)\n`);

  for (const file of files) {
    const src = fs.readFileSync(file);
    const meta = await sharp(src).metadata();
    const r = await fit(src, maxBytes, args.minColours, args.dither);

    const dir = args.out || path.dirname(file);
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, path.basename(file).replace(/\.png$/i, '') + '.min.png');
    fs.writeFileSync(dest, r.out);

    const kb = n => (n / KB).toFixed(0).padStart(4);
    console.log(`${r.over ? '⚠' : '✓'} ${path.basename(dest).padEnd(30)} ${kb(src.length)} → ${kb(r.out.length)} KB` +
      `  (${meta.width}×${meta.height}, ${r.colours} colours)` +
      (r.over ? `  over the cap by ${kb(r.out.length - maxBytes).trim()} KB — kept at the floor` : ''));
    if (r.over) over++;
  }

  if (over) {
    console.log(`\n${over} file(s) over ${args.max} KB at the ${args.minColours}-colour floor. Shipped at full quality anyway —`);
    console.log('the floor wins over the cap by design. The only lever that keeps every colour is --dither');
    console.log('(try 0.5; it helps most on flat artwork, little on heavy shading, and can band gradients —');
    console.log('judge by eye). To lose colours instead, lower --min-colours.');
  }
}

run().catch(e => { console.error(e.message); process.exit(1); });
