'use strict';
/**
 * Builds lib/wa-bot-answers.json (the WhatsApp bot's canned answers) from the FAQ source files.
 *
 *   node scripts/build-wa-bot-answers.js          write lib/wa-bot-answers.json
 *   node scripts/build-wa-bot-answers.js --check  exit 1 if the committed file is stale (PR check)
 *
 * One set of numbers (CLAUDE.md rule 6): every price/time in the bot comes from faq/faq.<locale>.json, the same
 * files that render the five FAQ pages. Never edit lib/wa-bot-answers.json by hand; edit the FAQ and re-run.
 * Topics are picked by section id + item index; the script asserts the shape so a reordered FAQ fails loudly
 * instead of sending the wrong answer to a customer.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'lib', 'wa-bot-answers.json');
const OUT_WIDGET = path.join(ROOT, 'public', 'wa-faq.json');   // fetched by the on-page assistant (design-momuto wa-chat.js)
const LOCALES = ['en', 'us', 'es', 'fr', 'it'];

// topic -> [section id, item index, expected opening of the question (EN/US only, shape guard)]
const PICKS = {
  delivery: [['delivery', 0, /how long/i], ['delivery', 1, /faster/i]],
  fabric: [['fabric', 0, /fabric/i]],
  printing: [['fabric', 1, /printed/i], ['customization', 0, /extra/i], ['customization', 1, /logo/i]],
  sizes: [['sizes', 1, /sizes exist/i], ['sizes', 0, /fit/i]],
  returns: [['returns', 0, /return a custom/i], ['returns', 3, /cancel/i]],
};
// pricing notes shown by the "extras" topic (index into pricing.notes) and the one shown under the ladder
const EXTRAS_NOTES = [2, 3, 4, 6];   // the deposit line (7) now lives in the design answer
const LADDER_NOTE = 5;
const GIFT_FROM = 10;     // owner, 17 Oct: a free team flag + captain armband from 10 kits (jersey + shorts) up. ONE place to change the threshold.
const GIFT_LINE = {      // customer-facing copy: a proposal for the owner to approve (not yet on the FAQ pages or llms.txt: see docs/live-chat-whatsapp.md)
  en: 'From 10 kits: a free team flag + captain armband.', us: 'From 10 kits: a free team flag + captain armband.',
  es: 'A partir de 10 kits: bandera del equipo + brazalete de capitán de regalo.', fr: "Dès 10 kits : drapeau de l'équipe + brassard de capitaine offerts.", it: "Da 10 kit: bandiera della squadra + fascia da capitano in regalo.",
};
const DEPOSIT_NOTE = 7;   // "Custom design deposit: €15 … credited in full to orders of 5+ jerseys" (the only numbers in the design answer)

// "I have a design in mind" (owner, 16 Oct): 1) build it yourself in the 3D designer, you may end up liking it more,
// 2) if it cannot be done exactly there, the 100% custom design service, deposit line from the FAQ, link to that page.
// Framing text carries NO numbers; wording is the owner's to approve (proposal, 16 Oct). Page = the per-store custom design page.
const CUSTOM_PAGE = { en: 'request-custom-kit-design', us: 'request-custom-kit-design', es: 'solicitud-de-diseno-personalizado', fr: 'demande-de-design-professionnel-de-maillots', it: 'richiesta-design-personalizzato' };
const CUSTOM_INTRO = {
  en: ["Already know the jersey you want? Build it your way in the 3D designer: colours, patterns, crest, names and numbers. You might even end up with something you like more than the one in your head.",
    "Can't get it exactly right there? Our 100% custom design service has a MOMUTO designer build it for you from your sketch, a reference or an AI render.", 'Start here:'],
  us: ["Already know the jersey you want? Build it your way in the 3D designer: colors, patterns, crest, names and numbers. You might even end up with something you like more than the one in your head.",
    "Can't get it exactly right there? Our 100% custom design service has a MOMUTO designer build it for you from your sketch, a reference or an AI render.", 'Start here:'],
  es: ['¿Ya sabes qué camiseta quieres? Constrúyela a tu manera en el diseñador 3D: colores, patrones, escudo, nombres y números. Puede que acabes con algo que te guste más que lo que tenías en la cabeza.',
    '¿No consigues clavarlo ahí? Con nuestro servicio de diseño 100% a medida, un diseñador de MOMUTO lo crea por ti a partir de tu boceto, una referencia o un render de IA.', 'Empieza aquí:'],
  fr: ["Vous savez déjà quel maillot vous voulez ? Créez-le à votre façon dans le designer 3D : couleurs, motifs, écusson, noms et numéros. Vous pourriez même obtenir mieux que ce que vous aviez en tête.",
    "Vous n'arrivez pas à le reproduire exactement ? Avec notre service de design 100 % sur mesure, un designer MOMUTO le crée pour vous à partir de votre croquis, d'une référence ou d'un rendu IA.", 'Commencez ici :'],
  it: ["Sai già quale maglia vuoi? Costruiscila a modo tuo nel designer 3D: colori, motivi, stemma, nomi e numeri. Potresti ottenere qualcosa che ti piace più di quello che avevi in mente.",
    "Non riesci a ottenerla esattamente? Con il nostro servizio di design 100% su misura, un designer MOMUTO la crea per te partendo dal tuo schizzo, da un riferimento o da un render IA.", 'Inizia qui:'],
};

const CURRENCY = { en: ['EUR', 'en-GB'], us: ['USD', 'en-US'], es: ['EUR', 'es-ES'], fr: ['EUR', 'fr-FR'], it: ['EUR', 'it-IT'] };
const num = str => { const m = /(\d+(?:[.,]\d+)?)/.exec(String(str).replace(/\s/g, '')); if (!m) throw new Error('no number in ' + str); return parseFloat(m[1].replace(',', '.')); };
/** The price ladder as numbers for the on-page calculator, parsed from the FAQ rows (so it can never differ from the FAQ). */
function calcData(loc, p) {
  const tiers = p.rows.map(r => {
    const m = /^(\d+)(?:\s*[–-]\s*(\d+)|\s*\+)?/.exec(r[0]); if (!m) throw new Error(`${loc}: cannot read tier "${r[0]}"`);
    const jersey = num(r[1]), shorts = num(r[2]), kit = num(r[3]);
    if (Math.abs(jersey + shorts - kit) > 0.005) throw new Error(`${loc}: ${r[0]}: jersey + shorts != kit`);
    return [+m[1], m[2] ? +m[2] : (/\+/.test(r[0]) ? null : +m[1]), jersey, kit];
  });
  tiers.forEach((t, i) => { if (i && t[0] !== tiers[i - 1][1] + 1) throw new Error(`${loc}: tiers are not contiguous at ${t[0]}`); });
  const nums = String(p.notes[LADDER_NOTE]).replace(/<[^>]+>/g, '').match(/\d+(?:[.,]\d+)?/g) || [];
  if (nums.length < 2) throw new Error(`${loc}: shipping note no longer has a threshold and a fee`);
  const kitLabel = /^(.*?)\s*\((.*)\)\s*$/.exec(p.cols[3]) || [null, p.cols[3], ''];
  return { currency: CURRENCY[loc][0], locale: CURRENCY[loc][1], tiers, freeFrom: parseFloat(nums[0].replace(',', '.')), shipFee: parseFloat(nums[1].replace(',', '.')), giftFrom: GIFT_FROM,
    jersey: p.cols[1], kit: kitLabel[1], kitHint: kitLabel[2] };
}

function text(html, base) {
  return String(html)
    .replace(/<a [^>]*href="mailto:([^"]+)"[^>]*>[^<]*<\/a>/gi, '$1')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, (_, h, t) => `${t} (${/^https?:/.test(h) ? h : base + h})`)
    .replace(/<b>([^<]*)<\/b>/gi, '*$1*')
    .replace(/<[^>]+>/g, '')
    .replace(/&rsquo;|&#8217;/g, '’').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/\s+\n/g, '\n').trim();
}
const ITEM_Q = it => it[0], ITEM_A = it => it[1];

const CALC = {};
function build() {
  const out = {};
  for (const loc of LOCALES) {
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'faq', `faq.${loc}.json`), 'utf8'));
    const sec = Object.fromEntries(d.sections.map(s => [s.id, s.items]));
    const base = d.base;
    const A = {};
    for (const [topic, picks] of Object.entries(PICKS)) {
      A[topic] = picks.map(([sid, i, guard]) => {
        const item = sec[sid] && sec[sid][i];
        if (!item) throw new Error(`${loc}: no item ${sid}[${i}]`);
        if ((loc === 'en' || loc === 'us') && !guard.test(ITEM_Q(item))) throw new Error(`${loc}: ${sid}[${i}] is "${ITEM_Q(item)}", expected ${guard}`);
        return text(ITEM_A(item), base);
      }).join('\n\n');
    }
    const p = d.pricing;
    if (p.rows.length !== 7 || p.cols.length !== 4) throw new Error(`${loc}: pricing table shape changed`);
    const ladder = p.rows.map(r => `${r[0]}: ${r[1]} · ${r[3]}`).join('\n');
    A.prices = `*${p.title}* (${p.cols[1]} · ${p.cols[3]})\n${ladder}\n\n${text(p.lead.split('.').slice(1, 2).join('.') + '.', base).trim()}\n${text(p.notes[LADDER_NOTE], base)}\n${GIFT_LINE[loc]}`;
    if (!CUSTOM_INTRO[loc] || !CUSTOM_PAGE[loc]) throw new Error(`${loc}: no custom-design copy`);
    if (!/15/.test(p.notes[DEPOSIT_NOTE]) || !/acompte|acconto|deposit|dep[oó]sito|anticipo|caparra/i.test(p.notes[DEPOSIT_NOTE])) throw new Error(`${loc}: pricing.notes[${DEPOSIT_NOTE}] is no longer the deposit line`);
    const [i1, i2, go] = CUSTOM_INTRO[loc];
    A.design = `${i1}\n\n${i2}\n\n${text(p.notes[DEPOSIT_NOTE], base)}\n\n${go} ${base}/pages/${CUSTOM_PAGE[loc]}`;
    A.extras = EXTRAS_NOTES.map(i => text(p.notes[i], base)).join('\n\n');
    out[loc] = A;
    CALC[loc] = calcData(loc, p);
  }
  return JSON.stringify(out, null, 2) + '\n';
}

const json = build();

/** public/wa-faq.json: what the on-page assistant (wa-chat.js on the 3D designer + cart) shows. Same answers as the WhatsApp bot,
 *  plus the topic titles, the price calculator's numbers (parsed from the FAQ) and the widget's own strings, so there is ONE place
 *  for facts and wording. No free-text matching: the panel is topic buttons only (owner, 17 Oct). */
function buildWidget(answersJson) {
  const { UI, ROW_ORDER } = require('../lib/wa-bot');
  const ans = JSON.parse(answersJson);
  const W = {   // widget-only strings (no prices). {t} = a topic, {l} = a time label, {n} = a count, {p} = a price
    en: { title: 'How can we help?', pick: 'Pick a topic:', back: 'All topics', close: 'Close',
      other: 'Other questions? Talk to a person', human: 'Talk to a person on WhatsApp', still: 'Still need help? Chat with us on WhatsApp',
      waAbout: 'Hi MOMUTO, I have a question about {t}.', today: 'today', tomorrow: 'tomorrow', at: 'at', madrid: 'Madrid time',
      cQty: 'Quantity', cMinus: 'Fewer', cPlus: 'More', cUnit: 'Price per unit', cSub: 'Subtotal', cShip: 'Shipping', cFree: 'Free', cTotal: 'Total',
      cGift: 'A free team flag + captain armband are included', cGiftMore: 'Add {n} more and get a free team flag + captain armband', cNext: 'Add {n} more: {p} each',
      cNote: 'Names, numbers and logos are included. Long sleeves, polo collar, socks and the fast lane are extra (see Extras & options).', cLadder: 'See the full price ladder' },
    es: { title: '¿En qué podemos ayudarte?', pick: 'Elige un tema:', back: 'Todos los temas', close: 'Cerrar',
      other: '¿Otras dudas? Habla con una persona', human: 'Hablar con una persona por WhatsApp', still: '¿Sigues con dudas? Escríbenos por WhatsApp',
      waAbout: 'Hola MOMUTO, tengo una pregunta sobre {t}.', today: 'hoy', tomorrow: 'mañana', at: 'a las', madrid: 'hora de Madrid',
      cQty: 'Cantidad', cMinus: 'Menos', cPlus: 'Más', cUnit: 'Precio por unidad', cSub: 'Subtotal', cShip: 'Envío', cFree: 'Gratis', cTotal: 'Total',
      cGift: 'Incluye bandera del equipo + brazalete de capitán de regalo', cGiftMore: 'Añade {n} más y llévate bandera del equipo + brazalete de capitán de regalo', cNext: 'Añade {n} más: {p} la unidad',
      cNote: 'Nombres, números y logos incluidos. Mangas largas, cuello polo, calcetines y vía rápida son extras (ver Extras y opciones).', cLadder: 'Ver la tabla completa de precios' },
    fr: { title: 'Comment pouvons-nous vous aider ?', pick: 'Choisissez un sujet :', back: 'Tous les sujets', close: 'Fermer',
      other: "Autres questions ? Parlez à quelqu'un", human: "Parler à quelqu'un sur WhatsApp", still: "Besoin d'aide ? Écrivez-nous sur WhatsApp",
      waAbout: "Bonjour MOMUTO, j'ai une question sur {t}.", today: "aujourd'hui", tomorrow: 'demain', at: 'à', madrid: 'heure de Madrid',
      cQty: 'Quantité', cMinus: 'Moins', cPlus: 'Plus', cUnit: 'Prix unitaire', cSub: 'Sous-total', cShip: 'Livraison', cFree: 'Offerte', cTotal: 'Total',
      cGift: "Drapeau de l'équipe + brassard de capitaine offerts", cGiftMore: "Ajoutez-en {n} de plus et recevez drapeau de l'équipe + brassard de capitaine offerts", cNext: 'Ajoutez-en {n} : {p} pièce',
      cNote: 'Noms, numéros et logos inclus. Manches longues, col polo, chaussettes et voie rapide en supplément (voir Options et extras).', cLadder: 'Voir la grille complète des prix' },
    it: { title: 'Come possiamo aiutarti?', pick: 'Scegli un argomento:', back: 'Tutti gli argomenti', close: 'Chiudi',
      other: 'Altre domande? Parla con una persona', human: 'Parla con una persona su WhatsApp', still: 'Hai ancora dubbi? Scrivici su WhatsApp',
      waAbout: 'Ciao MOMUTO, ho una domanda su {t}.', today: 'oggi', tomorrow: 'domani', at: 'alle', madrid: 'ora di Madrid',
      cQty: 'Quantità', cMinus: 'Meno', cPlus: 'Più', cUnit: 'Prezzo unitario', cSub: 'Subtotale', cShip: 'Spedizione', cFree: 'Gratuita', cTotal: 'Totale',
      cGift: 'Bandiera della squadra + fascia da capitano in regalo', cGiftMore: 'Aggiungine {n} e ricevi bandiera della squadra + fascia da capitano in regalo', cNext: 'Aggiungine {n}: {p} l\'uno',
      cNote: 'Nomi, numeri e loghi inclusi. Maniche lunghe, colletto polo, calzettoni e corsia veloce sono extra (vedi Extra e opzioni).', cLadder: 'Vedi il listino completo' },
  };
  W.us = { ...W.en };
  const locales = {};
  for (const loc of LOCALES) {
    const u = UI[loc], hoursWeek = { en: 'Mon–Fri 8:00–20:00, Sat 8:00–12:00', us: 'Mon–Fri 8:00–20:00, Sat 8:00–12:00', es: 'lun–vie 8:00–20:00, sáb 8:00–12:00', fr: 'lun–ven 8h00–20h00, sam 8h00–12h00', it: 'lun–ven 8:00–20:00, sab 8:00–12:00' }[loc];
    const topics = ROW_ORDER.filter(t => t !== 'human').map(t => ({ id: t, title: u.rows[t], answer: ans[loc][t] || null }));   // hours: answer null = computed live by the widget
    locales[loc] = { ui: { ...W[loc], hoursTitle: u.hoursTitle, hoursWeek, online: u.online, offline: u.offline('{l}') }, topics, calc: CALC[loc] };
  }
  return JSON.stringify({ v: 2, locales }) + '\n';
}
const widgetJson = buildWidget(json);
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  const curW = fs.existsSync(OUT_WIDGET) ? fs.readFileSync(OUT_WIDGET, 'utf8') : '';
  if (cur !== json || curW !== widgetJson) { console.error('lib/wa-bot-answers.json or public/wa-faq.json is stale: run node scripts/build-wa-bot-answers.js'); process.exit(1); }
  console.log('wa-bot-answers: up to date');
} else {
  fs.writeFileSync(OUT, json);
  fs.writeFileSync(OUT_WIDGET, widgetJson);
  console.log(`wrote ${path.relative(ROOT, OUT)} (${LOCALES.length} locales, ${json.length} bytes)`);
}
