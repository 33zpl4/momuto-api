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

var VERSION = '2026-07-26d · also lists what is INSIDE each slot';

// Leave empty to inspect whatever document is already open.
// Windows paths: use forward slashes — "C:/Users/you/mockups/jersey.psd"
var TEMPLATE = '';

function px(n) { return Math.round(n.as('px')); }

/**
 * The size artwork should be AUTHORED at.
 *
 * replaceContents fits the incoming file into the slot's frame preserving
 * aspect ratio, so artwork whose canvas differs from the slot's gets scaled and
 * centred — and every positioned element inside it (logos, crest, sponsor)
 * moves. Matching this size makes the placement exact.
 *
 * This is NOT the layer's bounds: the content usually extends past its mask.
 * The screenshot case had bounds 2764x4201 but a source canvas of 3060x4431.
 */
function smartObjectSource(layer) {
  var doc = app.activeDocument;
  doc.activeLayer = layer;

  // FAST PATH — the descriptor, if this Photoshop exposes it. Key names and
  // value types vary by version, so try the plausible ones rather than assume.
  try {
    var ref = new ActionReference();
    ref.putEnumerated(charIDToTypeID('Lyr '), charIDToTypeID('Ordn'), charIDToTypeID('Trgt'));
    var d = executeActionGet(ref);
    var soKey = stringIDToTypeID('smartObject');
    if (d.hasKey(soKey)) {
      var so = d.getObjectValue(soKey);
      var sizeKey = stringIDToTypeID('size');
      if (so.hasKey(sizeKey)) {
        var sz = so.getObjectValue(sizeKey);
        var read = function (obj, key) {
          var id = stringIDToTypeID(key);
          if (!obj.hasKey(id)) return null;
          try { return obj.getUnitDoubleValue(id); } catch (e1) {}
          try { return obj.getDouble(id); } catch (e2) {}
          try { return obj.getInteger(id); } catch (e3) {}
          return null;
        };
        var w = read(sz, 'width'), h = read(sz, 'height');
        if (w != null && h != null) return { w: Math.round(w), h: Math.round(h), how: 'descriptor' };
      }
    }
  } catch (eFast) {}

  // SLOW PATH — open the embedded contents and read the canvas directly. Slower
  // but version-proof: it is the same thing you would see by double-clicking the
  // slot. Closed without saving, so the template is untouched.
  //
  // Also lists what is INSIDE. That matters enormously: a slot whose .psb holds
  // construction layers (collar stripes, edge rectangles) is destroyed by
  // replaceContents, which substitutes the whole document. Such a slot needs the
  // artwork PLACED INTO it as a layer instead.
  try {
    executeAction(stringIDToTypeID('placedLayerEditContents'), undefined, DialogModes.NO);
    var inner = app.activeDocument;
    var names = [];
    try {
      for (var li = 0; li < inner.layers.length; li++) {
        names.push(inner.layers[li].name + (inner.layers[li].visible ? '' : ' (hidden)'));
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
          src += '\n' + pad + '        contents: ' + so.inner.join(' | ');
          if (so.inner.length > 1) {
            src += '\n' + pad + '        ⚠ ' + so.inner.length + ' layers inside — replaceContents would DESTROY them.' +
                   '\n' + pad + '          This slot needs the artwork PLACED INTO it, not substituted.';
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
  out.push('exact size and the placement is exact. Any other size gets scaled and');
  out.push('centred to fit, which moves every logo inside it.');
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
