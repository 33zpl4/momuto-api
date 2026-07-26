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

// Leave empty to inspect whatever document is already open.
// Windows paths: use forward slashes — "C:/Users/you/mockups/jersey.psd"
var TEMPLATE = '';

function px(n) { return Math.round(n.as('px')); }

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

  out.push(pad + layer.name + '   · ' + kind + box + (layer.visible ? '' : '   (hidden)'));
}

function main() {
  if (TEMPLATE) app.open(new File(TEMPLATE));
  if (!app.documents.length) {
    alert('No document open, and TEMPLATE is empty. Open the mockup PSD first, or set TEMPLATE at the top of this script.');
    return;
  }
  var doc = app.activeDocument;

  var out = [];
  out.push('template : ' + doc.name);
  out.push('canvas   : ' + px(doc.width) + ' × ' + px(doc.height) + ' @ ' + doc.resolution + ' dpi');
  out.push('mode     : ' + String(doc.mode).replace('DocumentMode.', ''));
  out.push('');
  out.push('LAYERS (top to bottom — the ones marked SMART OBJECT are the drop-in slots)');
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
