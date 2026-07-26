// ============================================================================
// build-jersey-mockups.jsx — batch the drag-and-drop step.
//
// One template PSD per view, each with several drop-in smart objects and its own
// export size. Point it at a folder of raw artwork and it produces every view of
// every design in one pass.
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

// ── SET THESE THREE ONCE. They persist in this file; you never touch them again.
//    Only the contents of artworkDir changes from design to design.
//    Windows paths use FORWARD slashes.
var CONFIG = {
  artworkDir:   'C:/Users/ayala/momuto/incoming',      // drop the .svg sets here
  outDir:       'C:/Users/ayala/momuto/mockups-out',   // created if missing
  templatesDir: 'C:/Users/ayala/momuto/templates',     // the three .tif files

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
  // `count` asserts how many layers the address resolves to. If a template is
  // edited and the number shifts, the run STOPS — a silently unreplaced
  // shoulder panel is the exact failure this prevents.

  templates: [
    {
      psd: 'admiral-psd.tif',                        // 6200×6200
      suffix: 'front',
      size: 1500,
      slots: [
        { layer: 'JERSEY DESIGN', at: [1725, 959], file: 'front',                          count: 1 },  // body
        { layer: 'JERSEY DESIGN', at: [1723, 736], file: ['shoulderleft',  'shoulders'],   count: 1 },
        { layer: 'JERSEY DESIGN', at: [3596, 746], file: ['shoulderright', 'shoulders'],   count: 1 },
        { layer: 'SLEEVE DESIGN', at: [1242, 995], file: ['sleeveleft',    'sleeves'],     count: 1 },
        { layer: 'SLEEVE DESIGN', at: [3845, 1040], file: ['sleeveright',  'sleeves'],     count: 1 },
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
        { layer: 'JERSEY DESIGN',       file: 'back',                            count: 1 },
        { layer: 'LEFT SLEEVE DESIGN',  file: ['sleeveleft',  'sleeves'],        count: 1 },
        { layer: 'RIGHT SLEEVE DESIGN', file: ['sleeveright', 'sleeves'],        count: 1 },
        { layer: 'COLLAR DESIGN',       file: 'collarback',                      count: 1 }
        // No shoulder slots on the back template — its SHOULDERS layer is a
        // solid fill, not a smart object, so back shoulders take a flat colour.
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

function nearestFirst(layers, at) {
  var hits = [];
  for (var i = 0; i < layers.length; i++) {
    var tl = topLeft(layers[i]);
    if (Math.abs(tl[0] - at[0]) <= AT_TOLERANCE && Math.abs(tl[1] - at[1]) <= AT_TOLERANCE) hits.push(layers[i]);
  }
  return hits;
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

// A template's `psd` may be a bare filename (resolved against templatesDir) or
// a full path, so moving the templates means editing one line, not three.
function templatePath(psd) {
  return (/[\/\\]/.test(psd) ? psd : CONFIG.templatesDir + '/' + psd);
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
      usable = nearestFirst(usable, slot.at);
      addr += ' @ ' + slot.at[0] + ',' + slot.at[1];
    } else if (hidden) {
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

  var slugs = findSlugs();
  if (!slugs.length) {
    alert('No designs found in:\n' + CONFIG.artworkDir +
          '\n\nExpecting files named <slug>-' + active[0].suffix + '.' + CONFIG.extensions[0]);
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
          var jobs = [], missing = [];
          for (var s = 0; s < view.slots.length; s++) {
            var art = artworkFor(slugs[i], view.slots[s].file);
            if (art) jobs.push({ slot: view.slots[s], file: art });
            else missing.push(kindLabel(view.slots[s].file));
          }
          if (missing.length) {
            if (!view.optional) { log.push('    · ' + slugs[i] + ' — no ' + missing.join(' / ') + ' file, skipped'); want++; }
            continue;
          }
          want++;

          var swaps = 0;
          for (var j = 0; j < jobs.length; j++) {
            for (var r = 0; r < jobs[j].slot.refs.length; r++) {
              replaceSmartObject(doc, jobs[j].slot.refs[r], jobs[j].file);
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
        '\n\nNext: node compress-mockups.js "' + CONFIG.outDir + '"');
}

main();
