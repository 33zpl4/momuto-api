// ============================================================================
// build-jersey-mockups.jsx — batch the drag-and-drop step.
//
// One template PSD per view, each with SEVERAL drop-in smart objects and its own
// export size. Point it at a folder of raw artwork and it produces every view of
// every design in one pass.
//
//   incoming/kalikamis-front.svg    →  out/kalikamis-front.png    1500×1500
//   incoming/kalikamis-back.svg     →  out/kalikamis-back.png     1500×1500
//   incoming/kalikamis-shorts.svg   →  out/kalikamis-shorts.png   1000×1000
//
// Photoshop ▸ File ▸ Scripts ▸ Browse… ▸ pick this file.
//
// Entirely local: opens files, exports files, nothing else. No network at any
// point, so it behaves identically with wifi off.
//
// Afterwards, instead of tinypng.com:
//   node scripts/compress-mockups.js <outDir>
// ============================================================================

#target photoshop

// ── SET THESE THREE ONCE. They persist in this file; you never touch them again.
//    Only the contents of artworkDir changes from design to design.
//    Windows paths use FORWARD slashes.
var CONFIG = {
  artworkDir:   'C:/Users/ayala/momuto/incoming',      // drop the .svg sets here
  outDir:       'C:/Users/ayala/momuto/mockups-out',   // created if missing
  templatesDir: 'C:/Users/ayala/momuto/templates',     // the three .tif/.psd files

  // Layer names below are taken verbatim from inspect-template.jsx output.
  //
  // `count` is how many layers of that name the inspector found. It is an
  // ASSERTION, not a hint: if the template changes and the number no longer
  // matches, the run stops. A silently-unreplaced shoulder panel is exactly the
  // failure this is here to prevent.
  templates: [
    {
      psd: 'admiral-psd.tif',                        // 6200×6200
      suffix: 'front',
      size: 1500,
      slots: [
        { layer: 'JERSEY DESIGN',  file: 'front',        count: 3 },   // body + both shoulders
        { layer: 'SLEEVE DESIGN',  file: 'sleeves',      count: 2 },   // left + right
        { layer: 'COLLAR TOP',     file: 'collartop',    count: 1 },
        { layer: 'COLLAR BOTTOM',  file: 'collarbottom', count: 1 }
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
        { layer: 'JERSEY DESIGN',       file: 'back',       count: 1 },
        { layer: 'LEFT SLEEVE DESIGN',  file: 'sleeves',    count: 1 },
        { layer: 'RIGHT SLEEVE DESIGN', file: 'sleeves',    count: 1 },
        { layer: 'COLLAR DESIGN',       file: 'collarback', count: 1 }
      ]
    },
    {
      psd: '141087-mens-shorts.tif',                 // 5000×5000
      suffix: 'shorts',
      size: 1000,
      optional: true,
      slots: [
        { layer: 'L LEG DESIGN',  file: 'shorts', count: 1 },
        { layer: 'R LEG DESIGN',  file: 'shorts', count: 1 },
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

// ---------------------------------------------------------------------------

// EVERY layer of that name, not the first. admiral-psd has three called
// 'JERSEY DESIGN' and two called 'SLEEVE DESIGN'; replacing only the first
// leaves a half-applied design and reports success.
function findLayers(container, name, found) {
  for (var i = 0; i < container.layers.length; i++) {
    var l = container.layers[i];
    if (l.typename === 'LayerSet') { findLayers(l, name, found); continue; }
    if (l.name === name) found.push(l);
  }
  return found;
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
// 'collar-back'): findSlugs() matches on a trailing '-<view>', so a file called
// <slug>-collar-back.svg would be read as the design 'x-collar' the day the
// lead view changes. Unhyphenated kinds cannot collide under any ordering.
// A template's `psd` may be a bare filename (resolved against templatesDir) or
// a full path, so moving the templates means editing one line, not three.
function templatePath(psd) {
  return (/[\/\\]/.test(psd) ? psd : CONFIG.templatesDir + '/' + psd);
}

function artworkFor(slug, kind) {
  for (var i = 0; i < CONFIG.extensions.length; i++) {
    var f = new File(CONFIG.artworkDir + '/' + slug + '-' + kind + '.' + CONFIG.extensions[i]);
    if (f.exists) return f;
  }
  return null;
}

// Slugs come from the first NON-optional view, so a stray shorts file on its own
// never invents a design.
function findSlugs() {
  var lead = null;
  for (var t = 0; t < CONFIG.templates.length; t++) {
    if (CONFIG.templates[t].psd && !CONFIG.templates[t].optional) { lead = CONFIG.templates[t].suffix; break; }
  }
  if (!lead) return [];

  var files = new Folder(CONFIG.artworkDir).getFiles();
  var slugs = [], seen = {};
  var rx = new RegExp('^(.+)-' + lead + '\\.(' + CONFIG.extensions.join('|') + ')$', 'i');
  for (var i = 0; i < files.length; i++) {
    if (!(files[i] instanceof File)) continue;
    var m = decodeURI(files[i].name).match(rx);
    if (m && !seen[m[1]]) { seen[m[1]] = true; slugs.push(m[1]); }
  }
  return slugs;
}

function exportFlat(doc, size, outFile) {
  var dup = doc.duplicate();
  try {
    dup.flatten();
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

// Resolve and validate every slot in a template before writing anything.
function resolveSlots(doc, view, log) {
  for (var s = 0; s < view.slots.length; s++) {
    var slot = view.slots[s];
    var all = findLayers(doc, slot.layer, []);
    if (!all.length) throw new Error('no layer named "' + slot.layer + '"');

    var usable = [], hidden = 0;
    for (var i = 0; i < all.length; i++) {
      if (all[i].kind !== LayerKind.SMARTOBJECT) {
        throw new Error('"' + slot.layer + '" is not a smart object — replacing its contents would do nothing');
      }
      if (all[i].visible) usable.push(all[i]); else hidden++;
    }
    if (hidden) log.push('    · ' + slot.layer + ': ' + hidden + ' hidden copy skipped');

    if (slot.count && usable.length !== slot.count) {
      throw new Error('expected ' + slot.count + ' visible "' + slot.layer + '" layer(s), found ' + usable.length +
        '. The template changed — re-run inspect-template.jsx and update CONFIG.');
    }
    slot.refs = usable;
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
    alert('templatesDir does not exist:\n' + CONFIG.templatesDir + '\n\nPut the three template files there, or correct the path.');
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

  var slugs = findSlugs();
  if (!slugs.length) {
    alert('No designs found in:\n' + CONFIG.artworkDir +
          '\n\nExpecting files named <slug>-<view>.' + CONFIG.extensions[0]);
    return;
  }

  var prevDialogs = app.displayDialogs;
  app.displayDialogs = DialogModes.NO;

  var log = [], made = 0, want = 0;

  try {
    // Each template opens ONCE and every design runs through it — that is where
    // the time goes on a batch, not in any single swap.
    for (var a = 0; a < active.length; a++) {
      var view = active[a];
      var doc = app.open(new File(view.path));
      try {
        log.push('── ' + view.suffix + ' (' + view.size + '×' + view.size + ')');
        resolveSlots(doc, view, log);

        for (var i = 0; i < slugs.length; i++) {
          var files = [], missing = [];
          for (var s = 0; s < view.slots.length; s++) {
            var art = artworkFor(slugs[i], view.slots[s].file);
            if (art) files.push({ slot: view.slots[s], file: art });
            else if (missing.join(',').indexOf(view.slots[s].file) === -1) missing.push(view.slots[s].file);
          }
          if (missing.length) {
            if (!view.optional) { log.push('    · ' + slugs[i] + ' — no ' + missing.join(', ') + ' file, skipped'); want++; }
            continue;
          }
          want++;

          var swaps = 0;
          for (var f = 0; f < files.length; f++) {
            for (var r = 0; r < files[f].slot.refs.length; r++) {
              replaceSmartObject(doc, files[f].slot.refs[r], files[f].file);
              swaps++;
            }
          }

          exportFlat(doc, view.size, new File(CONFIG.outDir + '/' + slugs[i] + '-' + view.suffix + '.' + CONFIG.format));
          log.push('    ✓ ' + slugs[i] + '-' + view.suffix + '.' + CONFIG.format + '  (' + swaps + ' slots)');
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

  alert(made + ' of ' + want + ' exported from ' + slugs.length + ' design(s)\n\n' + log.join('\n') +
        '\n\nNext: node scripts/compress-mockups.js "' + CONFIG.outDir + '"');
}

main();
