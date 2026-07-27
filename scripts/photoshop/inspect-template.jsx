// ============================================================================
// inspect-template.jsx — READ-ONLY. Dumps a mockup PSD's layer tree.
//
// Run this FIRST. It changes nothing and saves nothing; it writes a .txt next
// to the PSD listing every layer, whether it is a smart object, and its bounds.
// That tells us the real slot names instead of guessing at them.
//
// Photoshop ▸ File ▸ Scripts ▸ Browse… ▸ pick this file.
// (Or set TEMPLATE below and run with no document open.)
// ============================================================================

#target photoshop

var VERSION = '2026-07-27a · inner layers now report their box, for sponsor placement';

// Leave empty to inspect whatever document is already open.
// Windows paths: use forward slashes — "C:/Users/you/mockups/jersey.psd"
var TEMPLATE = '';

function px(n) { return Math.round(n.as('px')); }

/**
 * The size artwork should be AUTHORED at, plus what is currently inside.
 *
 * The builder places artwork INSIDE this canvas and scales it to fit, so an
 * artwork authored at exactly this size needs no resample and every logo in it
 * lands where it was drawn. Any other size still works — it is scaled — but a
 * different ASPECT RATIO will distort.
 *
 * This is NOT the layer's bounds: the content usually extends past its mask.
 * The screenshot case had bounds 2764x4201 but a source canvas of 3060x4431.
 */
function smartObjectSource(layer) {
  var doc = app.activeDocument;
  doc.activeLayer = layer;

  // Open the embedded contents and read the canvas directly — the same thing you
  // would see by double-clicking the slot. There is a descriptor route
  // (smartObject ▸ size) that avoids the open, but its key names and value types
  // vary by Photoshop version and it read as absent on the machine this runs on.
  // Opening is slower and always right, and it is the only route that can also
  // report what is inside. Closed without saving, so the template is untouched.
  //
  // The inner layer BOUNDS are the reason this matters beyond curiosity: they are
  // in the slot's own canvas coordinates, which is exactly the coordinate space
  // build-jersey-mockups.jsx places into. Run this on a mockup you assembled by
  // hand and the sponsor layer's line IS the `box` to paste into SPONSOR.
  try {
    executeAction(stringIDToTypeID('placedLayerEditContents'), undefined, DialogModes.NO);
    var inner = app.activeDocument;
    var names = [];
    try {
      for (var li = 0; li < inner.layers.length; li++) {
        var il = inner.layers[li];
        var where = '';
        try {
          var ib = il.bounds;
          var bx = px(ib[0]), by = px(ib[1]);
          where = '  box: [' + bx + ', ' + by + ', ' + (px(ib[2]) - bx) + ', ' + (px(ib[3]) - by) + ']';
        } catch (eB) {}
        names.push(il.name + (il.visible ? '' : ' (hidden)') + where);
      }
    } catch (eNames) {}
    var res = { w: px(inner.width), h: px(inner.height), how: 'opened', inner: names };
    inner.close(SaveOptions.DONOTSAVECHANGES);
    app.activeDocument = doc;
    return res;
  } catch (eSlow) {
    try { app.activeDocument = doc; } catch (eRestore) {}
    return null;
  }
}

function describeLayer(layer, depth, out) {
  var pad = '';
  for (var i = 0; i < depth; i++) pad += '  ';

  if (layer.typename === 'LayerSet') {
    out.push(pad + '[group] ' + layer.name + (layer.visible ? '' : '   (hidden)'));
    for (var j = 0; j < layer.layers.length; j++) describeLayer(layer.layers[j], depth + 1, out);
    return;
  }

  var kind = 'raster';
  try {
    if (layer.kind === LayerKind.SMARTOBJECT) kind = 'SMART OBJECT  ← replaceable';
    else if (layer.kind === LayerKind.TEXT) kind = 'text: "' + layer.textItem.contents.replace(/[\r\n]+/g, ' ') + '"';
    else kind = String(layer.kind).replace('LayerKind.', '').toLowerCase();
  } catch (e) { kind = 'unknown (' + e.message + ')'; }

  var box = '';
  try {
    var b = layer.bounds;
    box = '  [' + px(b[0]) + ',' + px(b[1]) + ' → ' + px(b[2]) + ',' + px(b[3]) +
          '  ' + (px(b[2]) - px(b[0])) + '×' + (px(b[3]) - px(b[1])) + ']';
  } catch (e2) { box = '  [no bounds]'; }

  // How a layer COMPOSITES decides whether it reaches the artwork below it.
  // A 'shadows' layer clipped to the layer beneath, or set to Normal at 100%,
  // behaves completely differently from one set to Multiply — and none of that
  // shows up in the layer name. This is what to read when a mockup looks flat.
  var comp = [];
  try {
    var bm = String(layer.blendMode).replace('BlendMode.', '').toLowerCase();
    if (bm !== 'normal') comp.push(bm);
    if (Math.round(layer.opacity) !== 100) comp.push('opacity ' + Math.round(layer.opacity) + '%');
    if (Math.round(layer.fillOpacity) !== 100) comp.push('fill ' + Math.round(layer.fillOpacity) + '%');
    if (layer.grouped) comp.push('CLIPPED to layer below');
  } catch (e3) { comp.push('composite unknown'); }
  try { if (layer.kind === LayerKind.SMARTOBJECT && layer.grouped) comp.push('clipped'); } catch (e4) {}

  var src = '';
  try {
    if (layer.kind === LayerKind.SMARTOBJECT) {
      var so = smartObjectSource(layer);
      if (so) {
        src = '   AUTHOR ARTWORK AT ' + so.w + '×' + so.h;
        if (so.inner && so.inner.length) {
          src += '\n' + pad + '        contents (box is [x, y, w, h] in THIS slot\'s canvas):';
          for (var ci = 0; ci < so.inner.length; ci++) {
            src += '\n' + pad + '          · ' + so.inner[ci];
          }
        }
      } else {
        src = '   (source size unreadable — double-click the slot and check Image ▸ Image Size)';
      }
    }
  } catch (e5) {}

  out.push(pad + layer.name + '   · ' + kind + box +
    (comp.length ? '   {' + comp.join(', ') + '}' : '') +
    src + (layer.visible ? '' : '   (hidden)'));
}

function main() {
  if (TEMPLATE) app.open(new File(TEMPLATE));
  if (!app.documents.length) {
    alert('No document open, and TEMPLATE is empty. Open the mockup PSD first, or set TEMPLATE at the top of this script.');
    return;
  }
  var doc = app.activeDocument;

  var out = [];
  out.push('inspector: ' + VERSION);
  out.push('template : ' + doc.name);
  out.push('canvas   : ' + px(doc.width) + ' × ' + px(doc.height) + ' @ ' + doc.resolution + ' dpi');
  out.push('mode     : ' + String(doc.mode).replace('DocumentMode.', ''));
  out.push('');
  out.push('LAYERS (top to bottom — the ones marked SMART OBJECT are the drop-in slots)');
  out.push('Anything in {braces} is non-default compositing: blend mode, opacity,');
  out.push('or CLIPPED, which limits a layer to the one directly beneath it.');
  out.push('');
  out.push('AUTHOR ARTWORK AT is the slot\'s own source canvas. Build the SVG at that');
  out.push('exact size and it drops in with no resample at all. Any other size is');
  out.push('scaled to fit — fine, unless the ASPECT RATIO differs, which distorts.');
  out.push('');
  out.push('Under each slot, "contents" lists the layers inside it with their box');
  out.push('[x, y, w, h] in that slot\'s coordinates. Run this on a mockup you built');
  out.push('by hand and a sponsor layer\'s box is exactly what goes into SPONSOR in');
  out.push('build-jersey-mockups.jsx — no measuring by hand.');
  out.push('');
  for (var i = 0; i < doc.layers.length; i++) describeLayer(doc.layers[i], 0, out);

  var text = out.join('\n');

  var target;
  try { target = new File(doc.path + '/' + doc.name.replace(/\.[^.]+$/, '') + '-layers.txt'); }
  catch (e) { target = new File(Folder.desktop + '/psd-layers.txt'); }  // unsaved doc

  target.open('w');
  target.encoding = 'UTF-8';
  target.write(text);
  target.close();

  alert('Layer tree written to:\n' + target.fsName + '\n\nSend me that file and I will finish the builder against your real slot names.');
}

main();
