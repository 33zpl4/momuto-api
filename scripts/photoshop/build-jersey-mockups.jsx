// ============================================================================
// build-jersey-mockups.jsx — batch the drag-and-drop step.
//
// One template PSD per view, each with several drop-in smart objects and its own
// export size. Point it at a folder of raw artwork and it produces whatever
// views that artwork supports — all three, or just the front, or just shorts.
//
// Photoshop ▸ File ▸ Scripts ▸ Browse… ▸ pick this file.
//
// Entirely local: opens files, exports files, nothing else. No network at any
// point, so it behaves identically with wifi off.
//
// Afterwards, instead of tinypng.com:
//   node compress-mockups.js <outDir>
// ============================================================================

#target photoshop

var VERSION = '2026-07-26g · placeOnly mode: place and stop, no export';

// ── SET THESE THREE ONCE. They persist in this file; you never touch them again.
//    Only the contents of artworkDir changes from design to design.
//    Windows paths use FORWARD slashes.
var CONFIG = {
  artworkDir:   'C:/Users/ayala/momuto/incoming',      // drop the .svg sets here
  outDir:       'C:/Users/ayala/momuto/mockups-out',   // created if missing
  templatesDir: 'C:/Users/ayala/momuto/templates',     // the template files

  // ── Slot addressing ──────────────────────────────────────────────────────
  // `layer` alone  → every visible layer of that name gets the same file.
  // `layer` + `at` → only the copy whose top-left corner is at [x, y].
  //
  // `at` exists because admiral-psd has THREE layers called 'JERSEY DESIGN'
  // (body plus both shoulder panels) and TWO called 'SLEEVE DESIGN'. Names
  // cannot separate them; positions can. Coordinates come straight from
  // inspect-template.jsx and are matched within AT_TOLERANCE px.
  //
  // `file` may be a list — the first artwork that exists wins. So a design can
  // supply <slug>-shoulderleft.svg and -shoulderright.svg separately, or a
  // single shared <slug>-shoulders.svg, with no config change either way.
  //
  // `required: true` means the view cannot be exported without that artwork.
  // Everything else is OPTIONAL: if the file is absent the slot keeps the
  // template's own placeholder and the run reports it. That is what makes a
  // front-only approval set work without generating collar and shoulder files.
  //
  // `nudge: [dx, dy]` shifts the slot in px before export and shifts it BACK
  // afterwards, so a batch never accumulates offsets. Positive dy is DOWN, so
  // "left sleeve up 25px" is nudge: [0, -25].
  //
  // `expect: [w, h]` is the slot's own SOURCE canvas, measured by
  // inspect-template.jsx.
  //
  // replaceContents does NOT fit artwork to the frame — it keeps the slot's
  // existing transform and drops the new file in at its natural pixel size. A
  // file at 2/3 of the expected canvas therefore renders at 2/3 size, with the
  // garment's solid fills showing around it.
  //
  // So the script compensates: it scales the slot by expect/actual after
  // replacing, and scales it back after export. Artwork at any canvas size
  // works, as long as elements are positioned proportionally within it.
  //
  // `count` asserts how many layers the address resolves to. If a template is
  // edited and the number shifts, the run STOPS — a silently unreplaced
  // shoulder panel is the exact failure this prevents.

  templates: [
    {
      psd: 'admiral-psd.tif',                        // 6200×6200
      suffix: 'front',
      size: 1500,
      slots: [
        { layer: 'JERSEY DESIGN', at: [1725, 959],  file: 'front',                        count: 1, required: true, expect: [4469, 5904] },
        { layer: 'JERSEY DESIGN', at: [1723, 736],  file: ['shoulderleft',  'shoulders'], count: 1, expect: [1671, 679] },
        { layer: 'JERSEY DESIGN', at: [3596, 746],  file: ['shoulderright', 'shoulders'], count: 1, expect: [1671, 679] },
        { layer: 'SLEEVE DESIGN', at: [1242, 995],  file: ['sleeveleft',    'sleeves'],   count: 1, expect: [1348, 2494] },
        { layer: 'SLEEVE DESIGN', at: [3845, 1040], file: ['sleeveright',   'sleeves'],   count: 1, expect: [1348, 2520] },
        { layer: 'COLLAR TOP',    file: 'collartop',    count: 1, expect: [1500, 252] },
        { layer: 'COLLAR BOTTOM', file: 'collarbottom', count: 1, expect: [2171, 355] }
        // TAPE DESIGN is deliberately absent — it stays white, so leaving the
        // slot untouched keeps whatever the template already holds.
        // INNER DESIGN is hidden in the template and is skipped automatically.
      ]
    },
    {
      psd: '52183 - Men\u2019s Crew Neck Soccer Jersey Mockup - Back View.tif',   // 6000×6000
      suffix: 'back',
      size: 1500,
      slots: [
        { layer: 'JERSEY DESIGN',       file: 'back',                     count: 1, required: true },
        { layer: 'LEFT SLEEVE DESIGN',  file: ['sleeveleft',  'sleeves'], count: 1 },
        { layer: 'RIGHT SLEEVE DESIGN', file: ['sleeveright', 'sleeves'], count: 1 },
        { layer: 'COLLAR DESIGN',       file: 'collarback',               count: 1 }
        // No shoulder slots on the back template — its SHOULDERS layer is a
        // solid fill, not a smart object, so back shoulders take a flat colour.
      ]
    },
    {
      psd: '141087-mens-shorts.tif',                 // 5000×5000
      suffix: 'shorts',
      size: 1000,
      slots: [
        { layer: 'L LEG DESIGN',  file: 'shorts', count: 1, required: true },
        { layer: 'R LEG DESIGN',  file: 'shorts', count: 1, required: true },
        { layer: 'BELT DESIGN',   file: 'belt',   count: 1 }   // the waistband
      ]
    }
  ],

  // Tried in order. Photoshop places SVG into a smart object when the slot was
  // authored from vector; if a replace throws on .svg, export PNG at ~2× the
  // slot's bounds (the inspector prints them) and drop that in instead.
  extensions: ['svg', 'png', 'tif', 'psd'],

  format: 'png',  // 'png' (what the proposal pages use) or 'jpg'

  // DEBUG. Place the FIRST design into every template, then stop: no export, no
  // undo of the rescale/nudge, and the documents are LEFT OPEN so the placement
  // can be inspected and exported by hand. Set back to false for normal runs.
  //
  // ⚠ The templates are open and MODIFIED. Close them WITHOUT saving.
  placeOnly: false
};

// Two slots on the same template are never within this many px of each other —
// the closest pair (body 1725,959 vs left shoulder 1723,736) differs by 223 in y.
var AT_TOLERANCE = 50;

// ---------------------------------------------------------------------------

// EVERY layer of that name, not the first.
function findLayers(container, name, found) {
  for (var i = 0; i < container.layers.length; i++) {
    var l = container.layers[i];
    if (l.typename === 'LayerSet') { findLayers(l, name, found); continue; }
    if (l.name === name) found.push(l);
  }
  return found;
}

function topLeft(layer) {
  var b = layer.bounds;
  return [Math.round(b[0].as('px')), Math.round(b[1].as('px'))];
}

function atPosition(layers, at) {
  var hits = [];
  for (var i = 0; i < layers.length; i++) {
    var tl = topLeft(layers[i]);
    if (Math.abs(tl[0] - at[0]) <= AT_TOLERANCE && Math.abs(tl[1] - at[1]) <= AT_TOLERANCE) hits.push(layers[i]);
  }
  return hits;
}

/**
 * A smart object's layer mask is normally LINKED to the layer, so translating
 * moves mask and content together and nothing appears to shift. Unlink first,
 * move, relink. Wrapped because if the action ever changes name the nudge should
 * degrade to a no-op, not kill the run.
 */
function setMaskLinked(linked) {
  try {
    var d = new ActionDescriptor();
    var r = new ActionReference();
    r.putEnumerated(charIDToTypeID('Lyr '), charIDToTypeID('Ordn'), charIDToTypeID('Trgt'));
    d.putReference(charIDToTypeID('null'), r);
    var props = new ActionDescriptor();
    props.putBoolean(stringIDToTypeID('userMaskLinked'), linked);
    d.putObject(charIDToTypeID('T   '), charIDToTypeID('Lyr '), props);
    executeAction(charIDToTypeID('setd'), d, DialogModes.NO);
    return true;
  } catch (e) { return false; }
}

/**
 * Undo the size difference between the artwork and the slot's own canvas.
 *
 * Handles a non-matching aspect ratio too, by scaling each axis independently —
 * which distorts, but distorting is visibly wrong and therefore better than
 * silently cropping or letterboxing the design.
 */
function rescaleLayer(doc, layer, fromWH, toWH) {
  var sx = toWH[0] / fromWH[0] * 100;
  var sy = toWH[1] / fromWH[1] * 100;
  if (Math.abs(sx - 100) < 0.01 && Math.abs(sy - 100) < 0.01) return false;
  doc.activeLayer = layer;
  var hadMask = setMaskLinked(false);
  layer.resize(sx, sy, AnchorPosition.MIDDLECENTER);
  if (hadMask) setMaskLinked(true);
  return true;
}

function nudgeLayer(doc, layer, dx, dy) {
  if (!dx && !dy) return;
  doc.activeLayer = layer;
  var hadMask = setMaskLinked(false);
  layer.translate(UnitValue(dx, 'px'), UnitValue(dy, 'px'));
  if (hadMask) setMaskLinked(true);
}

// No DOM method for this — the action is the documented idiom.
function replaceSmartObject(doc, layer, file) {
  doc.activeLayer = layer;
  var d = new ActionDescriptor();
  d.putPath(charIDToTypeID('null'), file);
  d.putInteger(charIDToTypeID('PgNm'), 1);
  executeAction(stringIDToTypeID('placedLayerReplaceContents'), d, DialogModes.NO);
}

// Kind names deliberately carry no internal hyphen ('collarback', not
// 'collar-back'): slug discovery matches on a trailing '-<kind>', so a file
// called <slug>-collar-back.svg would be read as a design named 'x-collar'.
function artworkFor(slug, kinds) {
  var list = (kinds instanceof Array) ? kinds : [kinds];
  for (var k = 0; k < list.length; k++) {
    for (var i = 0; i < CONFIG.extensions.length; i++) {
      var f = new File(CONFIG.artworkDir + '/' + slug + '-' + list[k] + '.' + CONFIG.extensions[i]);
      if (f.exists) return f;
    }
  }
  return null;
}

/**
 * An SVG's canvas, without rasterising it. Inkscape writes both width/height
 * and a viewBox; the viewBox is the reliable one because width/height may carry
 * units (mm, pt) while the viewBox is always user units.
 */
/**
 * A PNG's dimensions from its IHDR chunk — bytes 16..23, big-endian.
 * Needed because a PNG is the escape hatch when Photoshop mis-renders an SVG
 * (text on a path, a font it cannot resolve), and an unmeasured file gets no
 * scale compensation.
 */
function pngCanvas(file) {
  try {
    file.encoding = 'BINARY';
    file.open('r');
    var head = file.read(24);
    file.close();
    if (head.length < 24 || head.substr(1, 3) !== 'PNG') return null;
    var be32 = function (off) {
      return ((head.charCodeAt(off) << 24) | (head.charCodeAt(off + 1) << 16) |
              (head.charCodeAt(off + 2) << 8) | head.charCodeAt(off + 3)) >>> 0;
    };
    var w = be32(16), h = be32(20);
    return (w && h) ? { w: w, h: h } : null;
  } catch (e) { try { file.close(); } catch (e2) {} return null; }
}

function artworkCanvas(file) {
  if (/\.png$/i.test(file.name)) return pngCanvas(file);
  return svgCanvas(file);
}

function svgCanvas(file) {
  try {
    if (!/\.svg$/i.test(file.name)) return null;    // only SVG is cheap to read
    file.open('r');
    var head = file.read(4000);                      // the <svg> tag is at the top
    file.close();
    var vb = head.match(/viewBox\s*=\s*["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)/i);
    if (vb) return { w: Math.round(parseFloat(vb[1])), h: Math.round(parseFloat(vb[2])) };
    var w = head.match(/\swidth\s*=\s*["']([\d.]+)/i);
    var h = head.match(/\sheight\s*=\s*["']([\d.]+)/i);
    if (w && h) return { w: Math.round(parseFloat(w[1])), h: Math.round(parseFloat(h[1])) };
    return null;
  } catch (e) { try { file.close(); } catch (e2) {} return null; }
}

function kindLabel(kinds) {
  return (kinds instanceof Array) ? kinds.join(' or ') : kinds;
}

/**
 * A design exists if ANY view's required artwork is present — so a front-only
 * set, a shorts-only revision, or the full kit all get discovered. Scanning only
 * the front would make a back-only or shorts-only run report "no designs found".
 *
 * Only REQUIRED kinds create a slug. A stray <slug>-collartop.svg on its own
 * therefore never invents a design.
 */
function findSlugs(active) {
  var kinds = [], seenKind = {};
  for (var a = 0; a < active.length; a++) {
    for (var s = 0; s < active[a].slots.length; s++) {
      var slot = active[a].slots[s];
      if (!slot.required) continue;
      var list = (slot.file instanceof Array) ? slot.file : [slot.file];
      for (var k = 0; k < list.length; k++) {
        if (!seenKind[list[k]]) { seenKind[list[k]] = true; kinds.push(list[k]); }
      }
    }
  }
  if (!kinds.length) return [];

  var rx = new RegExp('^(.+)-(' + kinds.join('|') + ')\\.(' + CONFIG.extensions.join('|') + ')$', 'i');
  var files = new Folder(CONFIG.artworkDir).getFiles();
  var slugs = [], seen = {};
  for (var i = 0; i < files.length; i++) {
    if (!(files[i] instanceof File)) continue;
    var m = decodeURI(files[i].name).match(rx);
    if (m && !seen[m[1]]) { seen[m[1]] = true; slugs.push(m[1]); }
  }
  return slugs;
}

/**
 * Every artwork kind any slot can consume. Anything in artworkDir that looks
 * like <slug>-<kind> but whose kind is not in here is almost certainly a typo —
 * 'collarbotom' for 'collarbottom' — and would otherwise pass as a deliberately
 * absent optional file. Reported loudly instead.
 */
function claimedKinds(active) {
  var kinds = {};
  for (var a = 0; a < active.length; a++) {
    for (var s = 0; s < active[a].slots.length; s++) {
      var list = (active[a].slots[s].file instanceof Array) ? active[a].slots[s].file : [active[a].slots[s].file];
      for (var k = 0; k < list.length; k++) kinds[list[k].toLowerCase()] = true;
    }
  }
  return kinds;
}

// Cheap edit distance, so an unclaimed file can name what it probably meant.
function editDistance(a, b) {
  var prev = [], cur = [], i, j;
  for (j = 0; j <= b.length; j++) prev[j] = j;
  for (i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1,
                        prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
    }
    for (j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

function nearestKind(kind, kinds) {
  var best = null, bestD = 99;
  for (var k in kinds) {
    if (!kinds.hasOwnProperty(k)) continue;
    var d = editDistance(kind, k);
    if (d < bestD) { bestD = d; best = k; }
  }
  return bestD <= 3 ? best : null;
}

function unclaimedFiles(active, slugs) {
  var kinds = claimedKinds(active);
  var files = new Folder(CONFIG.artworkDir).getFiles();
  var out = [];
  var extRx = new RegExp('\\.(' + CONFIG.extensions.join('|') + ')$', 'i');
  for (var i = 0; i < files.length; i++) {
    if (!(files[i] instanceof File)) continue;
    var name = decodeURI(files[i].name);
    if (!extRx.test(name)) continue;
    var stem = name.replace(extRx, '');
    for (var s = 0; s < slugs.length; s++) {
      if (stem.length > slugs[s].length + 1 && stem.substring(0, slugs[s].length + 1) === slugs[s] + '-') {
        var kind = stem.substring(slugs[s].length + 1).toLowerCase();
        if (!kinds[kind]) {
          var did = nearestKind(kind, kinds);
          out.push(name + '  → no slot wants "' + kind + '"' +
                   (did ? '  ·  DID YOU MEAN "' + did + '"?' : ''));
        }
        break;
      }
    }
  }
  return out;
}

// A template's `psd` may be a bare filename (resolved against templatesDir) or
// a full path, so moving the templates means editing one line, not three.
function templatePath(psd) {
  return (/[\/\\]/.test(psd) ? psd : CONFIG.templatesDir + '/' + psd);
}

function exportFlat(doc, size, outFile) {
  var dup = doc.duplicate();
  try {
    // Do NOT flatten() for PNG. Document.flatten() fills transparent areas with
    // WHITE, and these templates have their BACKGROUND layer hidden — the shirt
    // is meant to come out on transparency. Saving a layered document as PNG
    // writes the composite anyway, so adjustment layers, blend modes, shadows
    // and highlights all bake in exactly as they render on screen.
    // JPEG has no alpha, so flattening is the right thing there.
    if (CONFIG.format === 'jpg') dup.flatten();

    // Force BOTH dimensions. These canvases are square (6200, 6000, 5000) but
    // the t-shirt templates are 3992×3993, where a width-only resize yields
    // 1500×1501.
    dup.resizeImage(UnitValue(size, 'px'), UnitValue(size, 'px'), 72, ResampleMethod.BICUBICSHARPER);

    if (CONFIG.format === 'jpg') {
      var jpg = new JPEGSaveOptions();
      jpg.quality = 11;
      jpg.embedColorProfile = true;
      dup.saveAs(outFile, jpg, true, Extension.LOWERCASE);
    } else {
      var png = new PNGSaveOptions();
      png.interlaced = false;
      dup.saveAs(outFile, png, true, Extension.LOWERCASE);
    }
  } finally {
    dup.close(SaveOptions.DONOTSAVECHANGES);
  }
}

// Resolve and validate every slot in a template. Called on each open, because
// layer references do not survive closing the document.
function resolveSlots(doc, view, log, quiet) {
  for (var s = 0; s < view.slots.length; s++) {
    var slot = view.slots[s];
    var named = findLayers(doc, slot.layer, []);
    if (!named.length) throw new Error('no layer named "' + slot.layer + '"');

    var usable = [], hidden = 0;
    for (var i = 0; i < named.length; i++) {
      if (named[i].kind !== LayerKind.SMARTOBJECT) {
        throw new Error('"' + slot.layer + '" is not a smart object — replacing its contents would do nothing');
      }
      if (named[i].visible) usable.push(named[i]); else hidden++;
    }

    var addr = slot.layer;
    if (slot.at) {
      usable = atPosition(usable, slot.at);
      addr += ' @ ' + slot.at[0] + ',' + slot.at[1];
    } else if (hidden && !quiet) {
      log.push('    · ' + slot.layer + ': ' + hidden + ' hidden copy skipped');
    }

    if (slot.count && usable.length !== slot.count) {
      throw new Error('expected ' + slot.count + ' visible "' + addr + '", found ' + usable.length +
        '. The template changed — re-run inspect-template.jsx and update CONFIG.');
    }
    slot.refs = usable;
    slot.addr = addr;
  }
}

function main() {
  if (!CONFIG.artworkDir || !CONFIG.outDir) {
    alert('Set artworkDir and outDir at the top of this script first.');
    return;
  }
  if (!new Folder(CONFIG.artworkDir).exists) {
    alert('artworkDir does not exist:\n' + CONFIG.artworkDir + '\n\nCreate it, or correct the path at the top of this script.');
    return;
  }
  if (!new Folder(CONFIG.templatesDir).exists) {
    alert('templatesDir does not exist:\n' + CONFIG.templatesDir + '\n\nPut the template files there, or correct the path.');
    return;
  }

  var active = [];
  for (var t = 0; t < CONFIG.templates.length; t++) {
    var tpl = CONFIG.templates[t];
    if (!tpl.psd) continue;                                   // unconfigured view
    tpl.path = templatePath(tpl.psd);
    if (!new File(tpl.path).exists) { alert('Template not found:\n' + tpl.path); return; }
    active.push(tpl);
  }
  if (!active.length) { alert('No template PSD paths set in CONFIG.templates.'); return; }
  if (!new Folder(CONFIG.outDir).exists) new Folder(CONFIG.outDir).create();

  var slugs = findSlugs(active);
  if (!slugs.length) {
    alert('No designs found in:\n' + CONFIG.artworkDir +
          '\n\nA design needs at least one of: <slug>-front, <slug>-back, <slug>-shorts');
    return;
  }

  var log = [], made = 0;

  var orphans = unclaimedFiles(active, slugs);
  if (orphans.length) {
    log.push('⚠ files no slot claims — check for a typo:');
    for (var o = 0; o < orphans.length; o++) log.push('    ' + orphans[o]);
    log.push('');
  }

  if (CONFIG.placeOnly) {
    slugs = slugs.slice(0, 1);
    log.push('PLACE-ONLY: "' + slugs[0] + '" only. Nothing is exported, nothing is undone,');
    log.push('and the templates are left OPEN and MODIFIED — close them WITHOUT saving.');
    log.push('');
  }

  var prevDialogs = app.displayDialogs;
  app.displayDialogs = DialogModes.NO;

  try {
    // Each template opens ONCE and every design runs through it — that is where
    // the time goes on a batch, not in any single swap.
    for (var a = 0; a < active.length; a++) {
      var view = active[a];
      var doc = app.open(new File(view.path));
      var dirty = {};      // slot index → holds a previous design's artwork

      try {
        log.push('── ' + view.suffix + ' (' + view.size + '×' + view.size + ')');
        resolveSlots(doc, view, log, false);

        for (var i = 0; i < slugs.length; i++) {
          // Work out what this design can fill before touching anything.
          var jobs = [], fills = {}, blank = [], lacks = null;
          for (var s = 0; s < view.slots.length; s++) {
            var slot = view.slots[s];
            var art = artworkFor(slugs[i], slot.file);
            if (art) { jobs.push({ index: s, slot: slot, file: art }); fills[s] = true; }
            else if (slot.required) { lacks = kindLabel(slot.file); break; }
            else blank.push(kindLabel(slot.file));
          }

          if (lacks) {
            // Not an error — a front-only or jersey-only set is a normal thing
            // to ask for. Say what was skipped and why, then carry on.
            log.push('    – ' + slugs[i] + ': no ' + lacks + ' artwork, view skipped');
            continue;
          }

          // A slot this design does not fill still holds the LAST design's
          // artwork, because the template stays open across the batch. Reopening
          // resets every slot to the template's own placeholder. Without this a
          // front-only set silently inherits the previous team's collar.
          var stale = false;
          for (var d in dirty) { if (dirty.hasOwnProperty(d) && !fills[d]) { stale = true; break; } }
          if (stale) {
            doc.close(SaveOptions.DONOTSAVECHANGES);
            doc = app.open(new File(view.path));
            resolveSlots(doc, view, log, true);
            dirty = {};
            for (var j2 = 0; j2 < jobs.length; j2++) jobs[j2].slot = view.slots[jobs[j2].index];
          }

          // Measure every artwork BEFORE replacing, so the compensation factor
          // is known and can be reversed cleanly afterwards.
          for (var w0 = 0; w0 < jobs.length; w0++) {
            var exp = jobs[w0].slot.expect;
            jobs[w0].fix = null;
            if (!exp) continue;
            var got = artworkCanvas(jobs[w0].file);
            if (!got) continue;                       // not an SVG, or unreadable
            if (got.w === exp[0] && got.h === exp[1]) continue;
            jobs[w0].fix = { from: [got.w, got.h], to: exp };
            var ar = Math.abs((got.w / got.h) - (exp[0] / exp[1])) / (exp[0] / exp[1]);
            log.push('    · ' + jobs[w0].file.name + ' is ' + got.w + '×' + got.h +
                     ' vs ' + exp[0] + '×' + exp[1] + ' — rescaled' +
                     (ar > 0.01 ? '  ⚠ ASPECT RATIO DIFFERS, it will distort' : ''));
          }

          var swaps = 0;
          for (var j = 0; j < jobs.length; j++) {
            for (var r = 0; r < jobs[j].slot.refs.length; r++) {
              replaceSmartObject(doc, jobs[j].slot.refs[r], jobs[j].file);
              swaps++;
            }
            dirty[jobs[j].index] = true;
          }

          // Rescale and nudge, export, then undo both. Reversing is what stops
          // a 10-design batch from compounding every correction.
          for (var f0 = 0; f0 < jobs.length; f0++) {
            if (!jobs[f0].fix) continue;
            for (var q0 = 0; q0 < jobs[f0].slot.refs.length; q0++) {
              rescaleLayer(doc, jobs[f0].slot.refs[q0], jobs[f0].fix.from, jobs[f0].fix.to);
            }
          }
          for (var n = 0; n < jobs.length; n++) {
            var nd = jobs[n].slot.nudge;
            if (!nd) continue;
            for (var q = 0; q < jobs[n].slot.refs.length; q++) nudgeLayer(doc, jobs[n].slot.refs[q], nd[0], nd[1]);
          }

          if (CONFIG.placeOnly) {
            log.push('    ⏸ ' + slugs[i] + '-' + view.suffix + ': ' + swaps + ' slots placed, left open for inspection');
            made++;
            continue;   // no export, and the undo below is skipped with it
          }

          exportFlat(doc, view.size, new File(CONFIG.outDir + '/' + slugs[i] + '-' + view.suffix + '.' + CONFIG.format));

          for (var n2 = 0; n2 < jobs.length; n2++) {
            var nd2 = jobs[n2].slot.nudge;
            if (!nd2) continue;
            for (var q2 = 0; q2 < jobs[n2].slot.refs.length; q2++) nudgeLayer(doc, jobs[n2].slot.refs[q2], -nd2[0], -nd2[1]);
          }
          for (var f2 = 0; f2 < jobs.length; f2++) {
            if (!jobs[f2].fix) continue;
            for (var q3 = 0; q3 < jobs[f2].slot.refs.length; q3++) {
              rescaleLayer(doc, jobs[f2].slot.refs[q3], jobs[f2].fix.to, jobs[f2].fix.from);
            }
          }
          log.push('    ✓ ' + slugs[i] + '-' + view.suffix + '.' + CONFIG.format + '  (' + swaps + ' slots)' +
            (blank.length ? '  · template default kept for: ' + blank.join(', ') : ''));
          made++;
        }
      } catch (inner) {
        log.push('    ✗ ' + inner.message);
      } finally {
        // Leaves the template exactly as it was on disk — unless placeOnly, where
        // the whole point is to leave it open with the artwork in place.
        if (!CONFIG.placeOnly) doc.close(SaveOptions.DONOTSAVECHANGES);
      }
    }
  } finally {
    app.displayDialogs = prevDialogs;
  }

  alert('build-jersey-mockups  [' + VERSION + ']\n\n' +
    made + ' image(s) exported from ' + slugs.length + ' design(s)\n\n' + log.join('\n') +
        '\n\nNext: node compress-mockups.js "' + CONFIG.outDir + '"');
}

main();
