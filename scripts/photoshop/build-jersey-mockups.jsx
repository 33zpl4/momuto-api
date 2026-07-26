// ============================================================================
// build-jersey-mockups.jsx — batch the drag-and-drop step.
//
// For every design in ARTWORK_DIR it replaces the template's smart objects with
// that design's files and exports a 1500×1500 image. The daily manual loop —
// drag three files in, export — for as many designs as are sitting in a folder.
//
// Photoshop ▸ File ▸ Scripts ▸ Browse… ▸ pick this file.
//
// The template is NEVER saved. Every export happens on a duplicate, and the
// original's smart objects are restored by closing without saving at the end.
// ============================================================================

#target photoshop

var CONFIG = {
  // Windows paths: forward slashes. "C:/Users/you/momuto/jersey-mockup.psd"
  template: '',
  artworkDir: '',
  outDir: '',

  // Layer name in the PSD  →  filename suffix in artworkDir.
  // Confirm these against inspect-template.jsx output before the first run.
  slots: [
    { layer: 'FRONT_ART',  suffix: 'front'   },
    { layer: 'BACK_ART',   suffix: 'back'    },
    { layer: 'SLEEVE_ART', suffix: 'sleeves' }
  ],

  // Artwork extensions to look for, in order of preference. Photoshop places
  // SVG into a smart object fine when the slot was authored from vector; if a
  // replace fails on .svg, export PNG at 2× the slot's box and use that.
  extensions: ['svg', 'png', 'tif', 'psd'],

  size: 1500,
  format: 'jpg',        // 'jpg' or 'png'
  quality: 90,          // jpg only
  background: '#ffffff' // flattened behind any transparency
};

// ---------------------------------------------------------------------------

function findLayer(container, name) {
  for (var i = 0; i < container.layers.length; i++) {
    var l = container.layers[i];
    if (l.name === name) return l;
    if (l.typename === 'LayerSet') {
      var hit = findLayer(l, name);
      if (hit) return hit;
    }
  }
  return null;
}

// No DOM method for this — the action is the documented idiom.
function replaceSmartObject(doc, layer, file) {
  doc.activeLayer = layer;
  var d = new ActionDescriptor();
  d.putPath(charIDToTypeID('null'), file);
  d.putInteger(charIDToTypeID('PgNm'), 1);
  executeAction(stringIDToTypeID('placedLayerReplaceContents'), d, DialogModes.NO);
}

function artworkFor(dir, slug, suffix) {
  for (var i = 0; i < CONFIG.extensions.length; i++) {
    var f = new File(dir + '/' + slug + '-' + suffix + '.' + CONFIG.extensions[i]);
    if (f.exists) return f;
  }
  return null;
}

// Slugs are inferred from the FIRST slot's suffix, so a folder of
// kalikamis-front / kalikamis-back / kalikamis-sleeves yields "kalikamis".
function findSlugs(dir) {
  var lead = CONFIG.slots[0].suffix;
  var files = new Folder(dir).getFiles();
  var slugs = [], seen = {};
  for (var i = 0; i < files.length; i++) {
    if (!(files[i] instanceof File)) continue;
    var m = decodeURI(files[i].name).match(new RegExp('^(.+)-' + lead + '\\.(' + CONFIG.extensions.join('|') + ')$', 'i'));
    if (m && !seen[m[1]]) { seen[m[1]] = true; slugs.push(m[1]); }
  }
  return slugs;
}

function exportFlat(doc, outFile) {
  var dup = doc.duplicate();
  try {
    dup.flatten();
    // Force both dimensions: the PSD canvas may be a pixel off square
    // (the oversized-shirt templates are 3992×3993), and a width-only
    // resize then yields 1500×1501.
    dup.resizeImage(UnitValue(CONFIG.size, 'px'), UnitValue(CONFIG.size, 'px'), 72, ResampleMethod.BICUBICSHARPER);

    if (CONFIG.format === 'png') {
      var png = new PNGSaveOptions();
      png.interlaced = false;
      dup.saveAs(outFile, png, true, Extension.LOWERCASE);
    } else {
      var jpg = new JPEGSaveOptions();
      jpg.quality = Math.round(CONFIG.quality / 100 * 12);
      jpg.embedColorProfile = true;
      dup.saveAs(outFile, jpg, true, Extension.LOWERCASE);
    }
  } finally {
    dup.close(SaveOptions.DONOTSAVECHANGES);
  }
}

function main() {
  if (!CONFIG.template || !CONFIG.artworkDir || !CONFIG.outDir) {
    alert('Set template, artworkDir and outDir at the top of this script first.');
    return;
  }
  var tpl = new File(CONFIG.template);
  if (!tpl.exists) { alert('Template not found:\n' + CONFIG.template); return; }
  if (!new Folder(CONFIG.outDir).exists) new Folder(CONFIG.outDir).create();

  var slugs = findSlugs(CONFIG.artworkDir);
  if (!slugs.length) {
    alert('No designs found in:\n' + CONFIG.artworkDir +
          '\n\nExpecting files named <slug>-' + CONFIG.slots[0].suffix + '.' + CONFIG.extensions[0]);
    return;
  }

  var prevDialogs = app.displayDialogs;
  app.displayDialogs = DialogModes.NO;

  var doc = app.open(tpl);
  var log = [], made = 0;

  try {
    // Resolve every slot once, before touching anything — a typo in a layer
    // name should stop the run, not half-build a batch.
    for (var s = 0; s < CONFIG.slots.length; s++) {
      CONFIG.slots[s].ref = findLayer(doc, CONFIG.slots[s].layer);
      if (!CONFIG.slots[s].ref) throw new Error('No layer named "' + CONFIG.slots[s].layer + '" in the template. Run inspect-template.jsx and fix CONFIG.slots.');
      if (CONFIG.slots[s].ref.kind !== LayerKind.SMARTOBJECT) throw new Error('Layer "' + CONFIG.slots[s].layer + '" is not a smart object, so its contents cannot be replaced. Convert it in the template first (right-click ▸ Convert to Smart Object) and re-save.');
    }

    for (var i = 0; i < slugs.length; i++) {
      var slug = slugs[i];
      var files = [], missing = [];
      for (var j = 0; j < CONFIG.slots.length; j++) {
        var f = artworkFor(CONFIG.artworkDir, slug, CONFIG.slots[j].suffix);
        if (f) files.push({ slot: CONFIG.slots[j], file: f });
        else missing.push(CONFIG.slots[j].suffix);
      }
      if (missing.length) { log.push('· ' + slug + ' skipped — no ' + missing.join(', ') + ' file'); continue; }

      for (var k = 0; k < files.length; k++) replaceSmartObject(doc, files[k].slot.ref, files[k].file);

      exportFlat(doc, new File(CONFIG.outDir + '/' + slug + '.' + CONFIG.format));
      log.push('✓ ' + slug + '.' + CONFIG.format);
      made++;
    }
  } catch (e) {
    log.push('✗ STOPPED: ' + e.message);
  } finally {
    // Leaves the template exactly as it was on disk.
    doc.close(SaveOptions.DONOTSAVECHANGES);
    app.displayDialogs = prevDialogs;
  }

  alert(made + ' of ' + slugs.length + ' exported at ' + CONFIG.size + '×' + CONFIG.size + '\n\n' + log.join('\n'));
}

main();
