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

var VERSION = '2026-07-26 · shoulders addressed by position, partial sets, nudge, PNG keeps alpha';

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
  // `count` asserts how many layers the address resolves to. If a template is
  // edited and the number shifts, the run STOPS — a silently unreplaced
  // shoulder panel is the exact failure this prevents.

  templates: [
    {
      psd: 'admiral-psd.tif',                        // 6200×6200
      suffix: 'front',
      size: 1500,
      slots: [
        { layer: 'JERSEY DESIGN', at: [1725, 959],  file: 'front',                        count: 1, required: true },
        { layer: 'JERSEY DESIGN', at: [1723, 736],  file: ['shoulderleft',  'shoulders'], count: 1 },
        { layer: 'JERSEY DESIGN', at: [3596, 746],  file: ['shoulderright', 'shoulders'], count: 1 },
        { layer: 'SLEEVE DESIGN', at: [1242, 995],  file: ['sleeveleft',    'sleeves'],   count: 1, nudge: [0, -25] },
        { layer: 'SLEEVE DESIGN', at: [3845, 1040], file: ['sleeveright',   'sleeves'],   count: 1, nudge: [0, 0] },
        { layer: 'COLLAR TOP',    file: 'collartop',    count: 1 },
        { layer: 'COLLAR BOTTOM', file: 'collarbottom', count: 1 }
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

  format: 'png'   // 'png' (what the proposal pages use) or 'jpg'
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
        if (!kinds[kind]) out.push(name + '  (no slot wants "' + kind + '")');
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

          var swaps = 0;
          for (var j = 0; j < jobs.length; j++) {
            for (var r = 0; r < jobs[j].slot.refs.length; r++) {
              replaceSmartObject(doc, jobs[j].slot.refs[r], jobs[j].file);
              swaps++;
            }
            dirty[jobs[j].index] = true;
          }

          // Nudge, export, un-nudge. Reversing it is what stops a 10-design
          // batch from drifting the sleeves 250px up the shirt.
          for (var n = 0; n < jobs.length; n++) {
            var nd = jobs[n].slot.nudge;
            if (!nd) continue;
            for (var q = 0; q < jobs[n].slot.refs.length; q++) nudgeLayer(doc, jobs[n].slot.refs[q], nd[0], nd[1]);
          }

          exportFlat(doc, view.size, new File(CONFIG.outDir + '/' + slugs[i] + '-' + view.suffix + '.' + CONFIG.format));

          for (var n2 = 0; n2 < jobs.length; n2++) {
            var nd2 = jobs[n2].slot.nudge;
            if (!nd2) continue;
            for (var q2 = 0; q2 < jobs[n2].slot.refs.length; q2++) nudgeLayer(doc, jobs[n2].slot.refs[q2], -nd2[0], -nd2[1]);
          }
          log.push('    ✓ ' + slugs[i] + '-' + view.suffix + '.' + CONFIG.format + '  (' + swaps + ' slots)' +
            (blank.length ? '  · template default kept for: ' + blank.join(', ') : ''));
          made++;
        }
      } catch (inner) {
        log.push('    ✗ ' + inner.message);
      } finally {
        // Leaves the template exactly as it was on disk.
        doc.close(SaveOptions.DONOTSAVECHANGES);
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
