// ============================================================================
// build-jersey-mockups.jsx — batch the drag-and-drop step.
//
// One template PSD per view (front / back / shorts), each with its own drop-in
// smart object and its own export size. Point it at a folder of raw artwork and
// it produces every view of every design in one pass.
//
//   incoming/kalikamis-front.svg     →  out/kalikamis-front.png   1500×1500
//   incoming/kalikamis-back.svg      →  out/kalikamis-back.png    1500×1500
//   incoming/kalikamis-shorts.svg    →  out/kalikamis-shorts.png  1000×1000
//
// Photoshop ▸ File ▸ Scripts ▸ Browse… ▸ pick this file.
//
// Entirely local — opens files, exports files, nothing else. No network at any
// point, so it behaves identically with wifi off.
//
// Afterwards, replace the tinypng.com step with:
//   node scripts/compress-mockups.js <outDir>
// ============================================================================

#target photoshop

var CONFIG = {
  // Windows paths: forward slashes. "C:/Users/you/momuto/incoming"
  artworkDir: '',
  outDir: '',

  // One entry per view. `slot` is the smart-object layer name inside that PSD —
  // confirm it against inspect-template.jsx output before the first run.
  // `optional: true` means a design with no such file is skipped quietly
  // (shorts are not part of every proposal).
  templates: [
    { psd: '',  slot: 'FRONT_ART',  suffix: 'front',  size: 1500 },
    { psd: '',  slot: 'BACK_ART',   suffix: 'back',   size: 1500 },
    { psd: '',  slot: 'SHORTS_ART', suffix: 'shorts', size: 1000, optional: true }
  ],

  // Tried in order. Photoshop places SVG into a smart object when the slot was
  // authored from vector; if a replace throws on .svg, export PNG at ~2× the
  // slot's bounds (inspect-template.jsx prints them) and drop that instead.
  extensions: ['svg', 'png', 'tif', 'psd'],

  format: 'png'   // 'png' (what the proposal pages use) or 'jpg'
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

function artworkFor(slug, suffix) {
  for (var i = 0; i < CONFIG.extensions.length; i++) {
    var f = new File(CONFIG.artworkDir + '/' + slug + '-' + suffix + '.' + CONFIG.extensions[i]);
    if (f.exists) return f;
  }
  return null;
}

// Slugs come from the first NON-optional view, so a stray shorts file on its
// own never invents a design.
function findSlugs() {
  var lead = null;
  for (var t = 0; t < CONFIG.templates.length; t++) {
    if (!CONFIG.templates[t].optional) { lead = CONFIG.templates[t].suffix; break; }
  }
  if (!lead) lead = CONFIG.templates[0].suffix;

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
    // Force BOTH dimensions: a template canvas may be a pixel off square (the
    // oversized-shirt templates are 3992×3993), and a width-only resize then
    // yields 1500×1501.
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

function main() {
  if (!CONFIG.artworkDir || !CONFIG.outDir) {
    alert('Set artworkDir and outDir at the top of this script first.');
    return;
  }
  var active = [];
  for (var t = 0; t < CONFIG.templates.length; t++) {
    var tpl = CONFIG.templates[t];
    if (!tpl.psd) continue;                      // unconfigured view — skip it
    if (!new File(tpl.psd).exists) { alert('Template not found:\n' + tpl.psd); return; }
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
    // Each template is opened ONCE and every design run through it, rather than
    // reopening per design — that is where the time goes on a batch.
    for (var a = 0; a < active.length; a++) {
      var view = active[a];
      var doc = app.open(new File(view.psd));
      try {
        var slot = findLayer(doc, view.slot);
        if (!slot) throw new Error('no layer named "' + view.slot + '" — run inspect-template.jsx and fix CONFIG');
        if (slot.kind !== LayerKind.SMARTOBJECT) throw new Error('layer "' + view.slot + '" is not a smart object, so replacing its contents would do nothing. Convert it in the template and re-save.');

        for (var i = 0; i < slugs.length; i++) {
          var art = artworkFor(slugs[i], view.suffix);
          if (!art) {
            if (!view.optional) { log.push('· ' + slugs[i] + ' — no ' + view.suffix + ' file, skipped'); want++; }
            continue;
          }
          want++;
          replaceSmartObject(doc, slot, art);
          exportFlat(doc, view.size, new File(CONFIG.outDir + '/' + slugs[i] + '-' + view.suffix + '.' + CONFIG.format));
          log.push('✓ ' + slugs[i] + '-' + view.suffix + '.' + CONFIG.format + '  ' + view.size + '×' + view.size);
          made++;
        }
      } catch (inner) {
        log.push('✗ ' + view.suffix + ' template: ' + inner.message);
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
