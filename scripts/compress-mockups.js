#!/usr/bin/env node
'use strict';

/**
 * Replaces the tinypng.com step.
 *
 * TinyPNG's trick is palette quantisation — reduce the image to N colours and
 * the PNG shrinks hard, which is why it works so well on flat vector artwork
 * like these kit designs. sharp does the same thing locally, so the manual
 * upload-check-reupload loop becomes a binary search for the highest colour
 * count that still fits under the cap.
 *
 * Offline by design: no API key, no upload, nothing phones home. Runs whether
 * or not the machine has network.
 *
 *   node scripts/compress-mockups.js <dir-or-file> [--max 325] [--min 300] [--out DIR]
 *
 * Default cap is 325 KB. Quality is maximised subject to the cap rather than
 * driven down to a target, so a design that compresses well keeps its colours.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function parseArgs(argv) {
  const a = { inputs: [], max: 325, min: 300, out: null };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--max') a.max = Number(argv[++i]);
    else if (k === '--min') a.min = Number(argv[++i]);
    else if (k === '--out') a.out = argv[++i];
    else if (k.startsWith('--')) { console.error(`Unknown argument: ${k}`); process.exit(1); }
    else a.inputs.push(k);
  }
  return a;
}

const KB = 1024;

async function encode(buf, colours) {
  return sharp(buf).png({
    palette: true,
    colours,
    dither: 1.0,
    effort: 10,
    compressionLevel: 9,
  }).toBuffer();
}

/**
 * Highest colour count whose encode lands at or under maxBytes. Fewer colours
 * is monotonically smaller, so a plain binary search is exact — no guessing at
 * a quality number and re-checking by eye.
 */
async function fit(buf, maxBytes) {
  const full = await encode(buf, 256);
  if (full.length <= maxBytes) return { out: full, colours: 256, capped: false };

  let lo = 2, hi = 256, best = null;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = await encode(buf, mid);
    if (candidate.length <= maxBytes) { best = { out: candidate, colours: mid, capped: false }; lo = mid + 1; }
    else hi = mid - 1;
  }
  // Even 2 colours over the cap means the cap is unreachable by quantisation
  // alone. Report it rather than silently shipping something too big.
  return best || { out: await encode(buf, 2), colours: 2, capped: true };
}

async function run() {
  const args = parseArgs(process.argv);
  if (!args.inputs.length) {
    console.error('Usage: node scripts/compress-mockups.js <dir-or-file> [--max 325] [--min 300] [--out DIR]');
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
  console.log(`cap ${args.max} KB · ${files.length} file(s)\n`);

  for (const file of files) {
    const src = fs.readFileSync(file);
    const meta = await sharp(src).metadata();
    const { out, colours, capped } = await fit(src, maxBytes);

    const dir = args.out || path.dirname(file);
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, path.basename(file).replace(/\.png$/i, '') + '.min.png');
    fs.writeFileSync(dest, out);

    const kb = n => (n / KB).toFixed(0).padStart(4);
    const flag = capped ? '  ⚠ OVER CAP — quantisation alone cannot reach it' :
                 out.length < args.min * KB ? '' : '';
    console.log(`${capped ? '⚠' : '✓'} ${path.basename(dest).padEnd(30)} ${kb(src.length)} → ${kb(out.length)} KB` +
      `  (${meta.width}×${meta.height}, ${colours} colours)${flag}`);
    if (capped) over++;
  }

  if (over) {
    console.log(`\n${over} file(s) still over ${args.max} KB at 2 colours — that is not a compression problem.`);
    console.log('Check the export: a stray photographic layer or noise/gradient in the artwork defeats palette');
    console.log('quantisation. Flat vector kit designs should land far under the cap.');
    process.exit(1);
  }
}

run().catch(e => { console.error(e.message); process.exit(1); });
