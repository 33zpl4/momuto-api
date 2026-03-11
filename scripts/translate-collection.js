#!/usr/bin/env node
'use strict';

/**
 * translate-collection.js
 *
 * Generates ES and FR xlsx import files for the Iconic Football Series collection.
 * Reads the EN xlsx files, applies translations, and writes new xlsx files.
 *
 * Usage: node scripts/translate-collection.js
 * Output: collections_es.xlsx, products_es.xlsx, collections_fr.xlsx, products_fr.xlsx
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── TRANSLATIONS ─────────────────────────────────────────────────────────────

const TRANSLATIONS = {
  es: {
    collectionTitle: 'Camisetas Momentos Icónicos del Fútbol | MOMUTO',
    collectionSeoTitle: 'Camisetas Momentos Icónicos del Fútbol | MOMUTO',
    collectionSeoDesc: 'Camisetas de fútbol premium con ilustraciones de los momentos más icónicos del juego. Descubre la Iconic Series de MOMUTO – Drop 01.',
    productSubtitle: 'Iconic Series — Drop 01, Edición Archivo',

    // HTML text replacements applied to the decoded top-description HTML.
    // Each entry is [searchString, replaceString] where both are raw HTML.
    htmlReplacements: [
      ['Drop 01 // Archive Limited', 'Drop 01 // Archivo Limitado'],
      ['Defining moments in football. Reframed.', 'Los momentos que definieron el fútbol. Reencuadrados.'],
      ['Explore Collection', 'Explorar la Colección'],
      ['The Archive 01', 'El Archivo 01'],
      [
        'Football history,<br />',
        'La historia del fútbol,<br />'
      ],
      ['<em>reinterpreted.</em>', '<em>reinterpretada.</em>'],
      [
        'The Iconic Series captures defining moments through expressive sketch illustration, framed in a museum-inspired format. Collectible by design. Limited by intent.',
        'La Iconic Series captura momentos definitivos a través de ilustraciones en boceto expresivo, enmarcadas en un formato inspirado en museos. Coleccionable por diseño. Limitada por intención.'
      ],
      ['Model wearing Iconic Series', 'Modelo vistiendo la Iconic Series'],
      // Archive section
      ['The Collection', 'La Colección'],
      ['Five moments.<br />', 'Cinco momentos.<br />'],
      ['<em>One series.</em>', '<em>Una serie.</em>'],
      // Archive item statuses
      ['>Available<', '>Disponible<'],
    ],

    // Per-product translations keyed by SEO URL handle
    products: {
      'im-01-the-volley': {
        seoTitle: 'The Volley – Iconic Series IM-01 | MOMUTO',
        seoDesc: 'Algunos goles se marcan. Otros se esculpen. IM-01 de la Iconic Series captura el remate más definitorio del fútbol en formato sketch de archivo. Camiseta de algodón premium 220 GSM.',
        shortDesc: '<p><strong>IM\u201301 // The Volley</strong></p><h2>\u20ac39</h2><p>Algod\u00f3n premium 220 GSM \u00b7 Corte relajado \u00b7 Serigraf\u00eda mate \u00b7 Formato archivo</p>',
      },
      'im-02-the-bicycle': {
        seoTitle: 'The Bicycle – Iconic Series IM-02 | MOMUTO',
        seoDesc: 'La gravedad perd\u00ed\u00f3 brevemente su autoridad. IM-02 de la Iconic Series captura el remate acrobático más teatral del fútbol en formato sketch de archivo. Camiseta de algodón premium 220 GSM.',
        shortDesc: '<p><strong>IM\u201302 // The Bicycle</strong></p><h2>\u20ac39</h2><p>Un jugador se eleva, gira y remata en el aire \u2014 lo imposible haciéndose inevitable. El remate de chilena es el gesto más teatral del fútbol, donde la imaginación derrota a la física.</p><p>Algodón premium 220 GSM \u00b7 Corte relajado \u00b7 Serigrafía mate \u00b7 Formato archivo</p>',
      },
      'im-03-the-run': {
        seoTitle: 'The Run – Iconic Series IM-03 | MOMUTO',
        seoDesc: 'Un jugador, un balón, toda la defensa derrumbándose a su espalda. IM-03 de la Iconic Series captura la carrera individual más icónica del fútbol en formato sketch de archivo. Camiseta de algodón premium 220 GSM.',
        shortDesc: '<p><strong>IM\u201303 // The Run</strong></p><h2>\u20ac39</h2><p>Un jugador, un balón, toda la defensa derrumbándose a su espalda. Una carrera que dobló el espacio y el tiempo, convirtiendo el caos en inevitabilidad. Momentos así nos recuerdan por qué el fútbol sigue pareciendo magia.</p><p>Algodón premium 220 GSM \u00b7 Corte relajado \u00b7 Serigrafía mate \u00b7 Formato archivo</p>',
      },
      'im-04-the-hand': {
        seoTitle: 'The Hand – Iconic Series IM-04 | MOMUTO',
        seoDesc: 'No todas las leyendas obedecen las reglas. IM-04 de la Iconic Series captura el momento más controvertido del fútbol en formato sketch de archivo. Camiseta de algodón premium 220 GSM.',
        shortDesc: '<p><strong>IM\u201304 // The Hand</strong></p><h2>\u20ac39</h2><p>No todas las leyendas obedecen las reglas. En un área atestada, un toque fugaz cambió la historia del fútbol para siempre \u2014 un momento suspendido entre la controversia, la audacia y el mito.</p><p>Algodón premium 220 GSM \u00b7 Corte relajado \u00b7 Serigrafía mate \u00b7 Formato archivo</p>',
      },
      'im-05-the-116th': {
        seoTitle: 'The 116th – Iconic Series IM-05 | MOMUTO',
        seoDesc: 'Cuando el cansancio se apodera, el carácter lo decide todo. IM-05 de la Iconic Series captura el remate más dramático del tiempo extra en formato sketch de archivo. Camiseta de algodón premium 220 GSM.',
        shortDesc: '<p><strong>IM\u201305 // The 116th</strong></p><h2>\u20ac39</h2><p>Cuando el cansancio se apodera, el carácter lo decide todo. En lo profundo del tiempo extra, un último remate reescribió el destino \u2014 prueba de que los mejores momentos del fútbol llegan cuando ya no queda nada.</p><p>Algodón premium 220 GSM \u00b7 Corte relajado \u00b7 Serigrafía mate \u00b7 Formato archivo</p>',
      },
    },
  },

  fr: {
    collectionTitle: 'T-Shirts Moments Iconiques du Football | MOMUTO',
    collectionSeoTitle: 'T-Shirts Moments Iconiques du Football | MOMUTO',
    collectionSeoDesc: 'T-shirts de football premium avec illustrations des moments les plus iconiques du jeu. Découvrez la Iconic Series de MOMUTO \u2013 Drop 01.',
    productSubtitle: 'Iconic Series \u2014 Drop 01, \u00c9dition Archive',

    htmlReplacements: [
      ['Drop 01 // Archive Limited', 'Drop 01 // Archive Limit\u00e9e'],
      ['Defining moments in football. Reframed.', 'Les moments qui ont d\u00e9fini le football. Recadr\u00e9s.'],
      ['Explore Collection', 'D\u00e9couvrir la Collection'],
      ['The Archive 01', 'Archive 01'],
      [
        'Football history,<br />',
        "L'histoire du football,<br />"
      ],
      ['<em>reinterpreted.</em>', '<em>r\u00e9interpr\u00e9t\u00e9e.</em>'],
      [
        'The Iconic Series captures defining moments through expressive sketch illustration, framed in a museum-inspired format. Collectible by design. Limited by intent.',
        'La Iconic Series capture des moments d\u00e9cisifs \u00e0 travers des illustrations au trait expressif, encadr\u00e9es dans un format inspir\u00e9 des mus\u00e9es. Collectionnable par design. Limit\u00e9e par intention.'
      ],
      ['Model wearing Iconic Series', 'Mod\u00e8le portant la Iconic Series'],
      ['The Collection', 'La Collection'],
      ['Five moments.<br />', 'Cinq moments.<br />'],
      ['<em>One series.</em>', '<em>Une s\u00e9rie.</em>'],
      ['>Available<', '>Disponible<'],
    ],

    products: {
      'im-01-the-volley': {
        seoTitle: 'The Volley \u2013 Iconic Series IM-01 | MOMUTO',
        seoDesc: "Certains buts sont marqu\u00e9s. D'autres sont sculpt\u00e9s. IM-01 de la Iconic Series capture la vol\u00e9e la plus d\u00e9finitive du football en format sketch d'archive. T-shirt en coton premium 220 GSM.",
        shortDesc: '<p><strong>IM\u201301 // The Volley</strong></p><h2>\u20ac39</h2><p>Coton premium 220 GSM \u00b7 Coupe d\u00e9contract\u00e9e \u00b7 S\u00e9rigraphie mate \u00b7 Format archive</p>',
      },
      'im-02-the-bicycle': {
        seoTitle: 'The Bicycle \u2013 Iconic Series IM-02 | MOMUTO',
        seoDesc: "La gravit\u00e9 a bri\u00e8vement perdu son autorit\u00e9. IM-02 de la Iconic Series capture le retourn\u00e9 acrobatique le plus th\u00e9\u00e2tral du football en format sketch d'archive. T-shirt en coton premium 220 GSM.",
        shortDesc: "<p><strong>IM\u201302 // The Bicycle</strong></p><h2>\u20ac39</h2><p>Un joueur s'\u00e9l\u00e8ve, pivote et frappe en l'air \u2014 l'impossible devenant in\u00e9vitable. Le retourn\u00e9 acrobatique est le geste le plus th\u00e9\u00e2tral du football, l\u00e0 o\u00f9 l'imagination d\u00e9fie la physique.</p><p>Coton premium 220 GSM \u00b7 Coupe d\u00e9contract\u00e9e \u00b7 S\u00e9rigraphie mate \u00b7 Format archive</p>",
      },
      'im-03-the-run': {
        seoTitle: 'The Run \u2013 Iconic Series IM-03 | MOMUTO',
        seoDesc: "Un joueur, un ballon, toute la d\u00e9fense s'effondrant derri\u00e8re lui. IM-03 de la Iconic Series capture la course individuelle la plus iconique du football en format sketch d'archive. T-shirt en coton premium 220 GSM.",
        shortDesc: "<p><strong>IM\u201303 // The Run</strong></p><h2>\u20ac39</h2><p>Un joueur, un ballon, toute la d\u00e9fense s'effondrant derri\u00e8re lui. Une course qui a courb\u00e9 l'espace et le temps, transformant le chaos en in\u00e9vitabilit\u00e9. Ces moments nous rappellent pourquoi le football ressemble encore \u00e0 de la magie.</p><p>Coton premium 220 GSM \u00b7 Coupe d\u00e9contract\u00e9e \u00b7 S\u00e9rigraphie mate \u00b7 Format archive</p>",
      },
      'im-04-the-hand': {
        seoTitle: 'The Hand \u2013 Iconic Series IM-04 | MOMUTO',
        seoDesc: "Toutes les l\u00e9gendes n'ob\u00e9issent pas aux r\u00e8gles. IM-04 de la Iconic Series capture le moment le plus controvers\u00e9 du football en format sketch d'archive. T-shirt en coton premium 220 GSM.",
        shortDesc: "<p><strong>IM\u201304 // The Hand</strong></p><h2>\u20ac39</h2><p>Toutes les l\u00e9gendes n'ob\u00e9issent pas aux r\u00e8gles. Dans une surface bond\u00e9e, un bref contact a chang\u00e9 l'histoire du football pour toujours \u2014 un moment suspendu entre controverse, audace et mythe.</p><p>Coton premium 220 GSM \u00b7 Coupe d\u00e9contract\u00e9e \u00b7 S\u00e9rigraphie mate \u00b7 Format archive</p>",
      },
      'im-05-the-116th': {
        seoTitle: 'The 116th \u2013 Iconic Series IM-05 | MOMUTO',
        seoDesc: "Quand la fatigue prend le dessus, le caract\u00e8re d\u00e9cide de tout. IM-05 de la Iconic Series capture la frappe la plus dramatique de la prolongation en format sketch d'archive. T-shirt en coton premium 220 GSM.",
        shortDesc: "<p><strong>IM\u201305 // The 116th</strong></p><h2>\u20ac39</h2><p>Quand la fatigue prend le dessus, le caract\u00e8re d\u00e9cide de tout. En pleine prolongation, une derni\u00e8re frappe a r\u00e9\u00e9crit le destin \u2014 la preuve que les plus grands moments du football arrivent souvent quand il ne reste plus rien.</p><p>Coton premium 220 GSM \u00b7 Coupe d\u00e9contract\u00e9e \u00b7 S\u00e9rigraphie mate \u00b7 Format archive</p>",
      },
    },
  },
};

// ─── XML HELPERS ──────────────────────────────────────────────────────────────

function decodeFromXml(str) {
  // Order matters: decode &#xa; and other numerics first, then named entities,
  // and &amp; last to avoid double-decoding.
  return str
    .replace(/&#xa;/g, '\n')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

function encodeForXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '&#xa;');
}

/**
 * Get the raw (XML-encoded) content of an inline-string cell.
 */
function getCellRawContent(xml, cellRef) {
  const startTag = `<c r="${cellRef}"`;
  const startIdx = xml.indexOf(startTag);
  if (startIdx === -1) return null;

  const isOpenStr = '<is><t>';
  const isCloseStr = '</t></is></c>';
  const isOpenIdx = xml.indexOf(isOpenStr, startIdx);
  const isCloseIdx = xml.indexOf(isCloseStr, isOpenIdx);
  if (isOpenIdx === -1 || isCloseIdx === -1) return null;

  return xml.slice(isOpenIdx + isOpenStr.length, isCloseIdx);
}

/**
 * Replace the content of an inline-string cell with new plain text/HTML.
 * newContent is the raw string; it will be XML-encoded before insertion.
 */
function replaceCellContent(xml, cellRef, newContent) {
  const startTag = `<c r="${cellRef}"`;
  const startIdx = xml.indexOf(startTag);
  if (startIdx === -1) {
    console.warn(`  ⚠ Cell ${cellRef} not found`);
    return xml;
  }

  const isOpenStr = '<is><t>';
  const isCloseStr = '</t></is></c>';
  const isOpenIdx = xml.indexOf(isOpenStr, startIdx);
  const isCloseIdx = xml.indexOf(isCloseStr, isOpenIdx);
  if (isOpenIdx === -1 || isCloseIdx === -1) {
    console.warn(`  ⚠ Could not find <is><t> for cell ${cellRef}`);
    return xml;
  }

  return (
    xml.slice(0, isOpenIdx + isOpenStr.length) +
    encodeForXml(newContent) +
    xml.slice(isCloseIdx)
  );
}

/**
 * Remove a numeric cell (t="n") — used to clear Product IDs / Collection IDs.
 */
function removeNumericCell(xml, cellRef) {
  return xml.replace(
    new RegExp(`<c r="${cellRef}"[^>]*t="n"[^>]*><v>[^<]*</v></c>`),
    ''
  );
}

/**
 * Remove an inline-string cell — used to clear Created-at timestamps.
 * Safe for cells with short content (no nested </c>).
 */
function removeInlineStringCell(xml, cellRef) {
  const startTag = `<c r="${cellRef}"`;
  const startIdx = xml.indexOf(startTag);
  if (startIdx === -1) return xml;

  const endStr = '</c>';
  const endIdx = xml.indexOf(endStr, startIdx) + endStr.length;
  return xml.slice(0, startIdx) + xml.slice(endIdx);
}

// ─── XLSX HELPERS ─────────────────────────────────────────────────────────────

function unpackXlsx(srcFile, tmpDir) {
  fs.mkdirSync(tmpDir, { recursive: true });
  execSync(`unzip -o "${srcFile}" -d "${tmpDir}"`, { stdio: 'pipe' });
}

function repackXlsx(tmpDir, destFile) {
  // zip must be run from inside the directory so paths are relative
  execSync(`cd "${tmpDir}" && zip -r "${destFile}" .`, { stdio: 'pipe' });
}

// ─── COLLECTIONS TRANSLATION ──────────────────────────────────────────────────

function translateCollections(srcFile, lang, destFile) {
  console.log(`\n[collections] Generating ${lang.toUpperCase()} → ${destFile}`);
  const t = TRANSLATIONS[lang];

  const tmpDir = path.join(os.tmpdir(), `momuto_col_${lang}_${Date.now()}`);
  unpackXlsx(srcFile, tmpDir);

  const sheetPath = path.join(tmpDir, 'xl', 'worksheets', 'sheet1.xml');
  let xml = fs.readFileSync(sheetPath, 'utf8');

  // ── Row 3: the actual collection data ──

  // A3: Collection ID — clear (new import)
  xml = removeNumericCell(xml, 'A3');

  // B3: Title
  xml = replaceCellContent(xml, 'B3', t.collectionTitle);

  // D3: Top description HTML — decode, apply text replacements, re-encode
  const rawD3 = getCellRawContent(xml, 'D3');
  if (rawD3) {
    let html = decodeFromXml(rawD3);
    for (const [search, replace] of t.htmlReplacements) {
      html = html.split(search).join(replace);
    }
    xml = replaceCellContent(xml, 'D3', html);
    // Note: replaceCellContent re-encodes, so we pass decoded html
  } else {
    console.warn('  ⚠ Could not read D3');
  }

  // G3: SEO Title
  xml = replaceCellContent(xml, 'G3', t.collectionSeoTitle);

  // H3: SEO Description
  xml = replaceCellContent(xml, 'H3', t.collectionSeoDesc);

  fs.writeFileSync(sheetPath, xml, 'utf8');
  repackXlsx(tmpDir, path.resolve(destFile));
  execSync(`rm -rf "${tmpDir}"`);

  console.log(`  ✓ Written: ${destFile}`);
}

// ─── PRODUCTS TRANSLATION ─────────────────────────────────────────────────────

// Map: row number → SEO handle (column L)
const PRODUCT_ROWS = {
  3:  'im-05-the-116th',
  10: 'im-04-the-hand',
  17: 'im-03-the-run',
  24: 'im-02-the-bicycle',
  31: 'im-01-the-volley',
};

// Variant rows per product (P-type rows that need no translation)
// These are kept as-is except we clear Product-ID-specific fields.
const VARIANT_ROWS = {
  3:  [4, 5, 6, 7, 8, 9],
  10: [11, 12, 13, 14, 15, 16],
  17: [18, 19, 20, 21, 22, 23],
  24: [25, 26, 27, 28, 29, 30],
  31: [32, 33, 34, 35, 36, 37],
};

function translateProducts(srcFile, lang, destFile) {
  console.log(`\n[products] Generating ${lang.toUpperCase()} → ${destFile}`);
  const t = TRANSLATIONS[lang];

  const tmpDir = path.join(os.tmpdir(), `momuto_prod_${lang}_${Date.now()}`);
  unpackXlsx(srcFile, tmpDir);

  const sheetPath = path.join(tmpDir, 'xl', 'worksheets', 'sheet1.xml');
  let xml = fs.readFileSync(sheetPath, 'utf8');

  for (const [rowStr, handle] of Object.entries(PRODUCT_ROWS)) {
    const row = rowStr;
    const prod = t.products[handle];
    if (!prod) {
      console.warn(`  ⚠ No translation found for handle: ${handle}`);
      continue;
    }

    console.log(`  Processing row ${row} (${handle})`);

    // Clear store-specific identifiers
    xml = removeNumericCell(xml, `A${row}`);       // Product ID
    xml = removeInlineStringCell(xml, `B${row}`);  // Created at

    // Translate text fields
    xml = replaceCellContent(xml, `F${row}`, t.productSubtitle);
    xml = replaceCellContent(xml, `H${row}`, prod.shortDesc);
    xml = replaceCellContent(xml, `J${row}`, prod.seoTitle);
    xml = replaceCellContent(xml, `K${row}`, prod.seoDesc);
    xml = replaceCellContent(xml, `T${row}`, t.collectionTitle);

    // Clear store-specific SKU and variant URL from variant rows
    for (const vRow of VARIANT_ROWS[row] || []) {
      xml = removeInlineStringCell(xml, `AB${vRow}`);  // Product SKU
      xml = removeInlineStringCell(xml, `AH${vRow}`);  // Variant URL
    }
  }

  fs.writeFileSync(sheetPath, xml, 'utf8');
  repackXlsx(tmpDir, path.resolve(destFile));
  execSync(`rm -rf "${tmpDir}"`);

  console.log(`  ✓ Written: ${destFile}`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

function main() {
  // Find source xlsx files (most recent by name pattern)
  const files = fs.readdirSync('.');
  const colSrc = files.find(f => f.startsWith('collections_') && f.endsWith('.xlsx'));
  const prodSrc = files.find(f => f.startsWith('products_') && f.endsWith('.xlsx'));

  if (!colSrc) throw new Error('No collections_*.xlsx found in project root');
  if (!prodSrc) throw new Error('No products_*.xlsx found in project root');

  console.log(`Source collections: ${colSrc}`);
  console.log(`Source products:    ${prodSrc}`);

  for (const lang of ['es', 'fr']) {
    translateCollections(colSrc, lang, `collections_${lang}.xlsx`);
    translateProducts(prodSrc, lang, `products_${lang}.xlsx`);
  }

  console.log('\n✅ Done. Generated files:');
  console.log('  collections_es.xlsx');
  console.log('  products_es.xlsx');
  console.log('  collections_fr.xlsx');
  console.log('  products_fr.xlsx');
  console.log('\nImport instructions:');
  console.log('  ES store: import collections_es.xlsx, then products_es.xlsx');
  console.log('  FR store: import collections_fr.xlsx, then products_fr.xlsx');
  console.log('  (Always import collection first so products can be linked to it)');
}

main();
