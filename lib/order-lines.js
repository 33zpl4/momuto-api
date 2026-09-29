'use strict';
/**
 * Classify the lines of a platform order, so every surface counts the same thing.
 *
 * Why (28 Sep 2026, order 2026092833610482): the buyer email printed "Camisetas 40"
 * for a 22-jersey order because the poller summed EVERY positive-price line (jerseys +
 * shorts + socks + long sleeves + collars + fast lane), and the factory sheet's
 * fallback `jerseys += qty` did the same for shorts and socks ("名单数量 21 与平台数量 40").
 *
 * Kinds: preview (caller's job) | jersey | kit | shorts | socks | longSleeves | collar |
 *        fastLane | deposit. Anything unrecognised stays a jersey (custom kit products,
 *        Ready-to-Play items) — same default the sheet always had.
 * `kit` (29 Sep 2026): a fixed-price kit product ("Kit Completo Pecados Capitales" at its own
 * price, design-momuto server-patches README §13) is ONE billed line that covers a jersey AND
 * a shorts per unit — countLines adds it to both, so the shorts are not lost from the emails.
 * Product ids from cms/order-line-tiles/products.json win over the title regexes.
 */
const fs = require('fs');
const path = require('path');

const RE = {
  longSleeves: /long sleeve|manga larga|manches longues|maniche lunghe/i,
  collar:      /polo collar|cuello polo|col polo|colletto polo/i,
  fastLane:    /fast lane|v[ií]a r[aá]pida|voie rapide|corsia veloce/i,
  deposit:     /deposit|acompte|dep[oó]sito|acconto/i,
  // "short sleeve" is a jersey, not shorts
  shorts:      /\bshorts?\b(?![\s-]*sleeve)|pantal[oó]n(?:es)?\b|pantaloncini|culotte/i,
  socks:       /\bsocks?\b|calcetines|\bmedias\b|chaussettes|calzettoni|calzini/i,
  // a billed line whose title says "kit" (checked AFTER shorts/socks/add-ons, so "Kit … shorts" stays shorts)
  kit:         /\bkit\b/i,
};

const KIND_OF_TABLE = { jersey: 'jersey', basketjersey: 'jersey', shorts: 'shorts', basketshorts: 'shorts',
  socks: 'socks', longsleeves: 'longSleeves', polocollar: 'collar', fastlane: 'fastLane' };

let idKinds = null;
function idTable() {
  if (idKinds) return idKinds;
  idKinds = new Map();
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'cms', 'order-line-tiles', 'products.json'), 'utf8'));
    for (const [tableKind, byStore] of Object.entries(cfg.products || {})) {
      for (const id of Object.values(byStore)) idKinds.set(String(id), KIND_OF_TABLE[tableKind]);
    }
  } catch { /* titles alone still work */ }
  return idKinds;
}

const pick = (o, keys) => { for (const k of keys) if (o && o[k] != null && o[k] !== '') return o[k]; return undefined; };

function classifyLine(item) {
  const id = pick(item, ['product_id', 'productId']);
  if (id != null && idTable().has(String(id))) return idTable().get(String(id));
  const text = `${pick(item, ['product_title', 'title', 'name']) || ''} ${pick(item, ['variant_title']) || ''}`;
  for (const k of ['longSleeves', 'collar', 'fastLane', 'deposit', 'shorts', 'socks', 'kit']) if (RE[k].test(text)) return k;
  return 'jersey';
}

/** counts of billed units per kind; `isPreview(item)` skips the €0 3D-preview lines */
function countLines(items, isPreview = () => false) {
  const c = { jerseys: 0, shorts: 0, socks: 0, longSleeves: 0, collars: 0, fastLane: false, deposits: 0, kits: 0 };
  for (const it of items || []) {
    if (isPreview(it)) continue;
    const qty = parseInt(pick(it, ['quantity', 'qty']) ?? 1, 10) || 1;
    switch (classifyLine(it)) {
      case 'jersey':      c.jerseys += qty; break;
      case 'kit':         c.jerseys += qty; c.shorts += qty; c.kits += qty; break;
      case 'shorts':      c.shorts += qty; break;
      case 'socks':       c.socks += qty; break;
      case 'longSleeves': c.longSleeves += qty; break;
      case 'collar':      c.collars += qty; break;
      case 'fastLane':    c.fastLane = true; break;
      case 'deposit':     c.deposits += qty; break;
    }
  }
  return c;
}

module.exports = { classifyLine, countLines, RE };
