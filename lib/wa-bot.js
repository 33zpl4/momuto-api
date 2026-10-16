'use strict';
/**
 * WhatsApp assistant brain (16 Oct 2026). PURE: no network, no KV, no clock of its own, so it is unit-testable
 * (test/wa-bot.test.js) and can be dry-run from a terminal. lib/wa-webhook-handler.js does the I/O around it.
 *
 * Deliberately NOT an LLM: every answer is canned text built from faq/faq.<locale>.json
 * (scripts/build-wa-bot-answers.js -> lib/wa-bot-answers.json), so a price here is the price on the FAQ page.
 * Only UI strings (menu, handoff, hours phrasing) live in this file; they carry no prices.
 *
 *   respond({ msg, state, now })  ->  { actions, state, event }
 *   msg   = { kind: 'text'|'reply'|'media', text, id }          (reply = tapped button / list row)
 *   state = { lang, miss, muteFrom, muteUntil }                  (persisted per customer by the handler)
 *   actions = [{ kind: 'text', body } | { kind: 'buttons', body, buttons: [{id,title}] } | { kind: 'list', body, button, rows: [{id,title}] }]
 *
 * Human handoff: the "Talk to a person" row/button, a request in free text, a complaint word, a file/voice note,
 * or two unanswered messages in a row. After a handoff the bot goes quiet for 12 h from the moment the team is on
 * (state.muteFrom..muteUntil), and the handler also mutes it when the owner replies from the WhatsApp Business app.
 */
const ANSWERS = require('./wa-bot-answers.json');
const hours = require('./wa-hours');

const MUTE_MS = 12 * 3600 * 1000;
const LANGS = ['en', 'us', 'es', 'fr', 'it'];

// ---- UI strings (no prices, no promises beyond the approved "generally within 1-2 hours") --------------------
const UI = {
  en: {
    welcome: "Hi! 👋 I'm the MOMUTO assistant. Tap a topic or type your question. Type *person* any time and someone from the studio will take over.",
    buttons: { prices: 'Prices', delivery: 'Delivery time', more: 'More topics' },
    listBody: 'Choose a topic:', listButton: 'Topics', follow: 'Anything else?', person: 'Talk to a person', menu: 'More topics',
    handoffOpen: 'Got it, thanks. A person from the studio will reply here, generally within 1–2 hours.',
    handoffClosed: l => `Got it, thanks. The studio is closed right now and opens ${l}. A person will reply here then. I can still answer the basics meanwhile.`,
    miss: "Sorry, I didn't catch that.", offline: l => `The team is offline right now (back ${l}), but I can answer the basics.`,
    online: 'The team is online: we generally reply within 1–2 hours.', hoursTitle: 'Opening hours',
    rows: { prices: 'Prices', delivery: 'Delivery time', extras: 'Extras & options', fabric: 'Fabric', printing: 'Printing & logos', sizes: 'Sizes & fit', design: 'I have a design in mind', returns: 'Returns & changes', hours: 'Opening hours', human: 'Talk to a person' },
  },
  es: {
    welcome: '¡Hola! 👋 Soy el asistente de MOMUTO. Toca un tema o escribe tu pregunta. Escribe *persona* cuando quieras y alguien del estudio te atenderá.',
    buttons: { prices: 'Precios', delivery: 'Plazos de entrega', more: 'Más temas' },
    listBody: 'Elige un tema:', listButton: 'Temas', follow: '¿Algo más?', person: 'Hablar con persona', menu: 'Más temas',
    handoffOpen: 'Entendido, gracias. Una persona del estudio te responderá aquí, normalmente en 1–2 horas.',
    handoffClosed: l => `Entendido, gracias. El estudio está cerrado ahora y abre ${l}. Una persona te responderá aquí entonces. Mientras tanto puedo responder lo básico.`,
    miss: 'Perdona, no te he entendido.', offline: l => `El equipo no está conectado ahora (vuelve ${l}), pero puedo responder lo básico.`,
    online: 'El equipo está conectado: normalmente respondemos en 1–2 horas.', hoursTitle: 'Horario',
    rows: { prices: 'Precios', delivery: 'Plazos de entrega', extras: 'Extras y opciones', fabric: 'Tejido', printing: 'Estampado y escudos', sizes: 'Tallas y ajuste', design: 'Tengo un diseño en mente', returns: 'Devoluciones y cambios', hours: 'Horario', human: 'Hablar con persona' },
  },
  fr: {
    welcome: "Bonjour ! 👋 Je suis l'assistant MOMUTO. Touchez un sujet ou écrivez votre question. Écrivez *personne* à tout moment et quelqu'un du studio prendra le relais.",
    buttons: { prices: 'Prix', delivery: 'Délais de livraison', more: 'Autres sujets' },
    listBody: 'Choisissez un sujet :', listButton: 'Sujets', follow: 'Autre chose ?', person: "Parler à quelqu'un", menu: 'Autres sujets',
    handoffOpen: "C'est noté, merci. Une personne du studio vous répondra ici, généralement sous 1 à 2 heures.",
    handoffClosed: l => `C'est noté, merci. Le studio est fermé pour le moment et rouvre ${l}. Une personne vous répondra ici à ce moment-là. Je peux répondre aux questions courantes en attendant.`,
    miss: "Désolé, je n'ai pas compris.", offline: l => `L'équipe n'est pas en ligne pour le moment (retour ${l}), mais je peux répondre aux questions courantes.`,
    online: "L'équipe est en ligne : réponse généralement sous 1 à 2 heures.", hoursTitle: 'Horaires',
    rows: { prices: 'Prix', delivery: 'Délais de livraison', extras: 'Options et extras', fabric: 'Tissu', printing: 'Impression et logos', sizes: 'Tailles et coupe', design: "J'ai une idée de design", returns: 'Retours et annulation', hours: 'Horaires', human: "Parler à quelqu'un" },
  },
  it: {
    welcome: "Ciao! 👋 Sono l'assistente di MOMUTO. Tocca un argomento o scrivi la tua domanda. Scrivi *persona* in qualsiasi momento e qualcuno dello studio prenderà il controllo.",
    buttons: { prices: 'Prezzi', delivery: 'Tempi di consegna', more: 'Altri argomenti' },
    listBody: 'Scegli un argomento:', listButton: 'Argomenti', follow: 'Altro?', person: 'Parla con qualcuno', menu: 'Altri argomenti',
    handoffOpen: 'Perfetto, grazie. Una persona dello studio ti risponderà qui, di solito entro 1–2 ore.',
    handoffClosed: l => `Perfetto, grazie. Lo studio è chiuso al momento e riapre ${l}. Una persona ti risponderà qui. Nel frattempo posso rispondere alle domande più comuni.`,
    miss: 'Scusa, non ho capito.', offline: l => `Il team non è online adesso (torna ${l}), ma posso rispondere alle domande più comuni.`,
    online: 'Il team è online: di solito rispondiamo entro 1–2 ore.', hoursTitle: 'Orari',
    rows: { prices: 'Prezzi', delivery: 'Tempi di consegna', extras: 'Extra e opzioni', fabric: 'Tessuto', printing: 'Stampa e loghi', sizes: 'Taglie e vestibilità', design: "Ho già un'idea di design", returns: 'Resi e annullamenti', hours: 'Orari', human: 'Parla con qualcuno' },
  },
};
UI.us = UI.en;
const ROW_ORDER = ['prices', 'delivery', 'extras', 'fabric', 'printing', 'sizes', 'design', 'returns', 'hours', 'human'];

// ---- understanding -------------------------------------------------------------------------------------------
// Keywords run on normalised text (lower case, accents stripped, punctuation -> space) as word PREFIXES.
// Order = tie-break priority. Add a keyword here when a real customer message was missed (see the handoff log).
const KEYWORDS = [
  ['human', ['person', 'human', 'agent', 'someone', 'somebody', 'real person', 'talk to', 'speak to', 'speak with', 'operator', 'staff', 'complain', 'problem', 'issue', 'damaged', 'defect', 'broken', 'missing', 'lost', 'tracking', 'where is my', 'my order status',
    'persona', 'humano', 'alguien', 'hablar con', 'queja', 'problema', 'danado', 'defectuos', 'roto', 'falta', 'perdido', 'seguimiento', 'donde esta mi',
    'personne', 'humain', 'quelqu', 'parler a', 'conseiller', 'reclamation', 'probleme', 'endommage', 'manque', 'perdu', 'suivi', 'ou est ma',
    'umano', 'qualcuno', 'parlare con', 'operatore', 'reclamo', 'danneggiat', 'difett', 'mancan', 'tracciamento', 'dov e il mio']],
  ['hours', ['opening hours', 'open', 'hours', 'schedule', 'horario', 'abierto', 'abren', 'horaire', 'ouvert', 'orari', 'aperto']],
  ['prices', ['price', 'prices', 'pricing', 'cost', 'costs', 'how much', 'quote', 'cheap', 'minimum', 'per jersey', 'precio', 'cuanto', 'cuesta', 'tarifa', 'barato', 'minimo', 'prix', 'combien', 'tarif', 'coute', 'prezzo', 'prezzi', 'quanto', 'costa', 'costo', 'usd', '\\$', '€']],
  ['delivery', ['deliver', 'delivery', 'shipping', 'ship', 'how long', 'arrive', 'when will', 'turnaround', 'entrega', 'envio', 'cuanto tarda', 'cuanto tiempo', 'plazo', 'tarda', 'llega', 'livraison', 'delai', 'expedition', 'combien de temps', 'arrive', 'consegna', 'spedizione', 'tempi', 'quanto ci vuole', 'arriva']],
  ['extras', ['long sleeve', 'sleeves', 'polo', 'sock', 'socks', 'fast lane', 'rush', 'express', 'urgent', 'extras', 'options', 'manga larga', 'calcetines', 'urgente', 'opciones', 'manches', 'chaussettes', 'urgence', 'maniche', 'calzettoni', 'calzini', 'opzioni']],
  ['fabric', ['fabric', 'material', 'polyester', 'elastane', 'breathable', 'tela', 'tejido', 'poliester', 'tissu', 'matiere', 'polyester', 'tessuto', 'materiale', 'poliestere']],
  ['printing', ['logo', 'print', 'sewn', 'embroider', 'sublim', 'badge', 'crest', 'name', 'number', 'sponsor', 'escudo', 'estamp', 'bordad', 'nombre', 'dorsal', 'imprim', 'ecusson', 'flocage', 'nom', 'numero', 'stamp', 'stemma', 'ricam', 'nome']],
  ['sizes', ['size', 'sizes', 'fit', 'kids', 'youth', 'talla', 'tallas', 'ninos', 'taille', 'tailles', 'enfant', 'taglia', 'taglie', 'misure', 'bambin']],
  ['design', ['design', '3d', 'mockup', 'deposit', 'sketch', 'idea', 'customi', 'bespoke', 'custom design', 'exact', 'specific', 'reference', 'can you make', 'a medida', 'exacto', 'referencia', 'pueden hacer', 'sur mesure', 'exactement', 'reference', 'pouvez vous faire', 'su misura', 'esatt', 'riferimento', 'potete fare', 'diseno', 'personaliz', 'boceto', 'deposito', 'acompte', 'maquette', 'anticipo', 'caparra', 'bozza']],
  ['returns', ['return', 'refund', 'cancel', 'exchange', 'devolucion', 'reembolso', 'cancelar', 'retour', 'rembours', 'annul', 'echange', 'reso', 'rimborso', 'annull']],
];
const KW_RE = KEYWORDS.map(([topic, kws]) => [topic, kws.map(k => new RegExp(`(^| )${k}`))]);
const LANG_HINT = {
  es: /(^| )(hola|buenas|gracias|precio|cuanto|cuesta|tengo|quiero|pedido|equipacion|camiseta|entrega)/,
  fr: /(^| )(bonjour|bonsoir|merci|prix|combien|livraison|j ai|je voudrais|commande|maillot)/,
  it: /(^| )(ciao|buongiorno|grazie|prezzo|quanto|spedizione|ho una|vorrei|ordine|maglia)/,
};
const US_RE = /(^| )(usd|dollar|dollars|usa|united states|american|\$)/;
const GREET_RE = /^(hi|hello|hey|hola|buenas|buenos dias|bonjour|bonsoir|salut|ciao|buongiorno|ola|menu|help|ayuda|aide|aiuto|info|start)?( momuto)?$/;
// the sentences the website button prefills (wa-chat.js, current + 14 Oct wording), stripped before matching
const STUB_RE = /(hi|hola|bonjour|ciao) momuto|i have a question about( my order)?|i need help with my design|tengo una pregunta sobre( mi pedido)?|necesito ayuda con mi diseno|j ai une question sur( ma commande)?|j ai besoin d aide pour mon design|ho una domanda su(l mio ordine)?|ho bisogno di aiuto con il mio design|design ref|ref del diseno|ref du design|rif del design/g;

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9$€]+/g, ' ').replace(/\s+/g, ' ').trim();
}
/** Pull the website button's context out of the raw text: store tag "(US)" and the design ref. */
function context(raw) {
  const t = String(raw || '');
  const ref = (/\((?:design ref|ref\. del diseño|réf\. du design|rif\. del design): ([A-Za-z0-9_-]{3,40})\)/.exec(t) || [])[1] || null;
  const isStub = /^(hi|hola|bonjour|ciao) momuto/i.test(t.trim());
  const us = isStub && /\(US\)/.test(t);
  const stripped = t.replace(/\((?:design ref|ref\. del diseño|réf\. du design|rif\. del design): [^)]*\)/g, ' ').replace(/\(US\)/g, ' ');
  return { ref, us, isStub, stripped };
}
function detectLang(n, raw, prev) {
  const c = context(raw);
  if (c.isStub) {
    const g = /^(hi|hola|bonjour|ciao)/i.exec(String(raw).trim())[1].toLowerCase();
    return g === 'hola' ? 'es' : g === 'bonjour' ? 'fr' : g === 'ciao' ? 'it' : (c.us ? 'us' : 'en');
  }
  for (const l of ['es', 'fr', 'it']) if (LANG_HINT[l].test(n)) return l;
  if (US_RE.test(n) && (!prev || prev === 'en' || prev === 'us')) return 'us';
  return prev || 'en';
}
function topicOf(n) {
  let best = null, bestScore = 0;
  for (const [topic, res] of KW_RE) {
    if (topic === 'human' && res.some(r => r.test(n))) return 'human';
    const score = res.filter(r => r.test(n)).length;
    if (score > bestScore) { best = topic; bestScore = score; }
  }
  return best;
}

// ---- actions -------------------------------------------------------------------------------------------------
const text = body => ({ kind: 'text', body });
function menuList(lang) {
  const u = UI[lang];
  return { kind: 'list', body: u.listBody, button: u.listButton, rows: ROW_ORDER.map(id => ({ id: `t:${id}`, title: u.rows[id] })) };
}
function welcome(lang, now) {
  const u = UI[lang];
  const note = hours.isOpen(now) ? '' : `\n\n${u.offline(hours.nextOpenLabel(now, lang))}`;
  return { kind: 'buttons', welcome: true, body: u.welcome + note, buttons: [{ id: 't:prices', title: u.buttons.prices }, { id: 't:delivery', title: u.buttons.delivery }, { id: 'menu', title: u.buttons.more }] };
}
function followUp(lang) {
  const u = UI[lang];
  return { kind: 'buttons', body: u.follow, buttons: [{ id: 'menu', title: u.menu }, { id: 't:human', title: u.person }] };
}
function handoff(lang, state, now) {
  const u = UI[lang];
  const open = hours.isOpen(now);
  const from = open ? now : hours.nextOpen(now) || now;
  state.muteFrom = from.getTime();
  state.muteUntil = from.getTime() + MUTE_MS;
  state.miss = 0;
  return text(open ? u.handoffOpen : u.handoffClosed(hours.nextOpenLabel(now, lang)));
}
function answer(topic, lang, now) {
  const u = UI[lang];
  if (topic === 'hours') {
    const status = hours.isOpen(now) ? u.online : u.offline(hours.nextOpenLabel(now, lang));
    return `*${u.hoursTitle}*\n${hours.hoursLine(now, lang)}\n\n${status}`;
  }
  return ANSWERS[lang][topic];
}

function respond({ msg, state, now }) {
  const st = { lang: 'en', miss: 0, muteFrom: 0, muteUntil: 0, ...(state || {}) };
  const t = now.getTime();
  if (st.muteFrom <= t && t < st.muteUntil) return { actions: [], state: st, event: 'muted' };

  // button / list taps carry an id; free text and the website prefill carry words
  if (msg.kind === 'reply') {
    const id = String(msg.id || '');
    if (id === 'menu') return { actions: [menuList(st.lang)], state: st, event: 'menu' };
    const topic = id.startsWith('t:') ? id.slice(2) : null;
    if (topic === 'human') return { actions: [handoff(st.lang, st, now)], state: st, event: 'handoff' };
    if (topic && (ROW_ORDER.includes(topic))) { st.miss = 0; return { actions: [text(answer(topic, st.lang, now)), followUp(st.lang)], state: st, event: 'answer:' + topic }; }
    return { actions: [menuList(st.lang)], state: st, event: 'menu' };
  }
  if (msg.kind === 'media') return { actions: [handoff(st.lang, st, now)], state: st, event: 'handoff:media' };

  // text-only channels (lib/wa-render-text.js) number their menus: a bare number is a tap on that row ("0" = the topic list)
  const digits = /^\s*(\d{1,2})\s*$/.exec(String(msg.text || ''));
  if (digits) {
    const k = +digits[1], id = k === 0 ? 'menu' : ROW_ORDER[k - 1] ? 't:' + ROW_ORDER[k - 1] : null;
    if (id) return respond({ msg: { kind: 'reply', id }, state, now });
  }
  const c = context(msg.text);
  let n = norm(c.stripped).replace(STUB_RE, ' ').replace(/\s+/g, ' ').trim();
  st.lang = detectLang(n, msg.text, st.lang);
  if (LANGS.indexOf(st.lang) < 0) st.lang = 'en';
  if (c.ref) st.ref = c.ref;
  if (n === '' || GREET_RE.test(n)) { st.miss = 0; return { actions: [welcome(st.lang, now)], state: st, event: 'greet' }; }

  const topic = topicOf(n);
  if (topic === 'human') return { actions: [handoff(st.lang, st, now)], state: st, event: 'handoff:request' };
  if (topic) { st.miss = 0; return { actions: [text(answer(topic, st.lang, now)), followUp(st.lang)], state: st, event: 'answer:' + topic }; }
  st.miss += 1;
  if (st.miss >= 2) return { actions: [handoff(st.lang, st, now)], state: st, event: 'handoff:miss' };
  return { actions: [text(UI[st.lang].miss), welcome(st.lang, now)], state: st, event: 'miss' };
}

module.exports = { respond, UI, ROW_ORDER, KEYWORDS, norm, context, topicOf, MUTE_MS };
