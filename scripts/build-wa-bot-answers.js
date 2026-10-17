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
    A.prices = `*${p.title}* (${p.cols[1]} · ${p.cols[3]})\n${ladder}\n\n${text(p.lead.split('.').slice(1, 2).join('.') + '.', base).trim()}\n${text(p.notes[LADDER_NOTE], base)}`;
    if (!CUSTOM_INTRO[loc] || !CUSTOM_PAGE[loc]) throw new Error(`${loc}: no custom-design copy`);
    if (!/15/.test(p.notes[DEPOSIT_NOTE]) || !/acompte|acconto|deposit|dep[oó]sito|anticipo|caparra/i.test(p.notes[DEPOSIT_NOTE])) throw new Error(`${loc}: pricing.notes[${DEPOSIT_NOTE}] is no longer the deposit line`);
    const [i1, i2, go] = CUSTOM_INTRO[loc];
    A.design = `${i1}\n\n${i2}\n\n${text(p.notes[DEPOSIT_NOTE], base)}\n\n${go} ${base}/pages/${CUSTOM_PAGE[loc]}`;
    A.extras = EXTRAS_NOTES.map(i => text(p.notes[i], base)).join('\n\n');
    out[loc] = A;
  }
  return JSON.stringify(out, null, 2) + '\n';
}

const json = build();

/** public/wa-faq.json: what the on-page assistant (wa-chat.js on the 3D designer + cart) shows. Same answers as the WhatsApp bot,
 *  plus the topic titles, the keyword lists and the widget's own strings, so there is ONE place for facts and wording. */
function buildWidget(answersJson) {
  const { UI, ROW_ORDER, KEYWORDS } = require('../lib/wa-bot');
  const ans = JSON.parse(answersJson);
  const W = {   // widget-only strings (no prices). {t} = topic or typed text, {l} = a time label
    en: { title: 'How can we help?', pick: 'Pick a topic or ask your own question:', ask: 'Type your question…', send: 'Send', back: 'All topics', close: 'Close',
      other: 'Other questions? Talk to a person', human: 'Talk to a person on WhatsApp', still: 'Still need help? Chat with us on WhatsApp', noMatch: "I couldn't find an answer to that. A person can help you on WhatsApp.",
      waAbout: 'Hi MOMUTO, I have a question about {t}.', waFree: 'Hi MOMUTO, {t}', today: 'today', tomorrow: 'tomorrow', at: 'at', madrid: 'Madrid time' },
    es: { title: '¿En qué podemos ayudarte?', pick: 'Elige un tema o escribe tu pregunta:', ask: 'Escribe tu pregunta…', send: 'Enviar', back: 'Todos los temas', close: 'Cerrar',
      other: '¿Otras dudas? Habla con una persona', human: 'Hablar con una persona por WhatsApp', still: '¿Sigues con dudas? Escríbenos por WhatsApp', noMatch: 'No he encontrado respuesta a eso. Una persona puede ayudarte por WhatsApp.',
      waAbout: 'Hola MOMUTO, tengo una pregunta sobre {t}.', waFree: 'Hola MOMUTO, {t}', today: 'hoy', tomorrow: 'mañana', at: 'a las', madrid: 'hora de Madrid' },
    fr: { title: 'Comment pouvons-nous vous aider ?', pick: 'Choisissez un sujet ou posez votre question :', ask: 'Écrivez votre question…', send: 'Envoyer', back: 'Tous les sujets', close: 'Fermer',
      other: "Autres questions ? Parlez à quelqu'un", human: 'Parler à quelqu\'un sur WhatsApp', still: 'Besoin d\'aide ? Écrivez-nous sur WhatsApp', noMatch: "Je n'ai pas trouvé de réponse. Une personne peut vous aider sur WhatsApp.",
      waAbout: "Bonjour MOMUTO, j'ai une question sur {t}.", waFree: 'Bonjour MOMUTO, {t}', today: "aujourd'hui", tomorrow: 'demain', at: 'à', madrid: 'heure de Madrid' },
    it: { title: 'Come possiamo aiutarti?', pick: 'Scegli un argomento o scrivi la tua domanda:', ask: 'Scrivi la tua domanda…', send: 'Invia', back: 'Tutti gli argomenti', close: 'Chiudi',
      other: 'Altre domande? Parla con una persona', human: 'Parla con una persona su WhatsApp', still: 'Hai ancora dubbi? Scrivici su WhatsApp', noMatch: 'Non ho trovato una risposta. Una persona può aiutarti su WhatsApp.',
      waAbout: 'Ciao MOMUTO, ho una domanda su {t}.', waFree: 'Ciao MOMUTO, {t}', today: 'oggi', tomorrow: 'domani', at: 'alle', madrid: 'ora di Madrid' },
  };
  W.us = { ...W.en };
  const locales = {};
  for (const loc of LOCALES) {
    const u = UI[loc], hoursWeek = { en: 'Mon–Fri 8:00–20:00, Sat 8:00–12:00', us: 'Mon–Fri 8:00–20:00, Sat 8:00–12:00', es: 'lun–vie 8:00–20:00, sáb 8:00–12:00', fr: 'lun–ven 8h00–20h00, sam 8h00–12h00', it: 'lun–ven 8:00–20:00, sab 8:00–12:00' }[loc];
    const topics = ROW_ORDER.filter(t => t !== 'human').map(t => ({ id: t, title: u.rows[t], answer: ans[loc][t] || null }));   // hours: answer null = computed live by the widget
    locales[loc] = { ui: { ...W[loc], hoursTitle: u.hoursTitle, hoursWeek, online: u.online, offline: u.offline('{l}') }, topics };
  }
  const keywords = {}; for (const [t, list] of KEYWORDS) keywords[t] = list;   // all languages merged, same for every locale
  return JSON.stringify({ v: 1, keywords, locales }) + '\n';
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
