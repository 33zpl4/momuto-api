'use strict';

/**
 * All customer-facing order lifecycle email templates.
 * Each function receives the full order object and returns { subject, html }.
 * Language is read from order.lang (en / es / fr / it — defaults to en).
 */

// ── Date helpers ──────────────────────────────────────────────────────────────

const MONTHS = {
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  es: ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'],
  fr: ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'],
  it: ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'],
};

function formatRange(from, to, lang) {
  const m  = MONTHS[lang] || MONTHS.en;
  const d1 = from.getDate(), d2 = to.getDate();
  const m1 = m[from.getMonth()], m2 = m[to.getMonth()];
  const sameMonth = from.getMonth() === to.getMonth();
  switch (lang) {
    case 'es': return sameMonth ? `${d1}–${d2} de ${m1}`      : `${d1} de ${m1} – ${d2} de ${m2}`;
    case 'fr': return sameMonth ? `${d1}–${d2} ${m1}`          : `${d1} ${m1} – ${d2} ${m2}`;
    case 'it': return sameMonth ? `${d1}–${d2} ${m1}`          : `${d1} ${m1} – ${d2} ${m2}`;
    default:   return sameMonth ? `${m1} ${d1}–${d2}`          : `${m1} ${d1} – ${m2} ${d2}`;
  }
}

function deliveryWindow(baseDate, minDays, maxDays, lang) {
  const base = new Date(baseDate);
  const from = new Date(base); from.setDate(from.getDate() + minDays);
  const to   = new Date(base); to.setDate(to.getDate() + maxDays);
  return formatRange(from, to, lang);
}

// ── Base layout ───────────────────────────────────────────────────────────────

function wrap(body) {
  return `<div style="font-family:'Outfit',Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e4e4e7">
  <div style="background:#0a0a0a;padding:16px 24px">
    <span style="font-size:1.3rem;font-weight:800;color:#fff;letter-spacing:0.08em">MOMUTO</span>
  </div>
  <div style="padding:32px 28px;color:#1a1a1a">
    ${body}
  </div>
</div>`;
}

function ref(order) {
  const labels = { en: 'Order ref', es: 'Ref. pedido', fr: 'Réf. commande', it: 'Rif. ordine' };
  return `<p style="font-size:0.82rem;color:#71717a;margin:0 0 24px">${labels[order.lang] || labels.en}: ${order.ref}</p>`;
}

function sig() {
  return `<p style="font-size:0.9rem;margin:0">— MOMUTO</p>`;
}

function cta(href, label) {
  return `<a href="${href}" style="display:inline-block;background:#c8352e;color:#fff;padding:12px 26px;font-weight:700;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.1em;text-decoration:none;margin-bottom:20px">${label} →</a>`;
}

// ── Email 1 — Order Confirmed ─────────────────────────────────────────────────

const CONFIRMED = {
  en: (o, range) => ({
    subject: `${o.team} x MOMUTO — We're on it 🔥`,
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 8px">Hi ${o.name}! Payment received — your kits are in the works. Expect them around <strong>${range}</strong>.</p>`,
  }),
  es: (o, range) => ({
    subject: `${o.team} x MOMUTO — ¡Ya estamos con ello! 🔥`,
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 8px">¡Hola ${o.name}! Pago recibido — vuestras equipaciones están en marcha. Os llegará en torno al <strong>${range}</strong>.</p>`,
  }),
  fr: (o, range) => ({
    subject: `${o.team} x MOMUTO — C'est parti ! 🔥`,
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 8px">Salut ${o.name} ! Paiement reçu — vos maillots sont en préparation. Comptez sur une livraison aux alentours du <strong>${range}</strong>.</p>`,
  }),
  it: (o, range) => ({
    subject: `${o.team} x MOMUTO — Ci siamo! 🔥`,
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 8px">Ciao ${o.name}! Pagamento ricevuto — le vostre maglie sono in lavorazione. Contatelo per <strong>${range}</strong>.</p>`,
  }),
};

exports.emailConfirmation = function(order) {
  const lang  = order.lang || 'en';
  const range = deliveryWindow(order.paidAt, 20, 25, lang);
  const { subject, body } = (CONFIRMED[lang] || CONFIRMED.en)(order, range);
  return { subject, html: wrap(`${body}${ref(order)}${sig()}`) };
};

// ── Email 2 — Production Started (Day 4) ─────────────────────────────────────

const DAY4 = {
  en: o => ({
    subject: `${o.team} — Production has kicked off`,
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 20px">Hi ${o.name}! Your kits are now being made. We'll be back when they're in the final stages.</p>`,
  }),
  es: o => ({
    subject: `${o.team} — La producción ha comenzado`,
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 20px">¡Hola ${o.name}! Vuestras equipaciones están ya en producción. Os avisamos cuando estén en la recta final.</p>`,
  }),
  fr: o => ({
    subject: `${o.team} — La production a démarré`,
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 20px">Salut ${o.name} ! Vos maillots sont en production. On vous recontacte quand ils sont en phase finale.</p>`,
  }),
  it: o => ({
    subject: `${o.team} — La produzione è iniziata`,
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 20px">Ciao ${o.name}! Le vostre maglie sono in produzione. Vi aggiorniamo quando sono in fase finale.</p>`,
  }),
};

exports.emailDay4 = function(order) {
  const lang = order.lang || 'en';
  const { subject, body } = (DAY4[lang] || DAY4.en)(order);
  return { subject, html: wrap(`${body}${sig()}`) };
};

// ── Email 3 — Almost Ready (Day 10) ──────────────────────────────────────────

const DAY10 = {
  en: (o, range) => ({
    subject: `${o.team} — Almost there`,
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 20px">Hi ${o.name}! Your kits are in the final stages. Tracking number coming very soon — delivery still on track for <strong>${range}</strong>.</p>`,
  }),
  es: (o, range) => ({
    subject: `${o.team} — Ya casi están`,
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 20px">¡Hola ${o.name}! Vuestras equipaciones están en la fase final. El número de seguimiento llega muy pronto — entrega prevista en torno al <strong>${range}</strong>.</p>`,
  }),
  fr: (o, range) => ({
    subject: `${o.team} — On y est presque`,
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 20px">Salut ${o.name} ! Vos maillots sont en phase finale. Le numéro de suivi arrive très bientôt — livraison toujours prévue aux alentours du <strong>${range}</strong>.</p>`,
  }),
  it: (o, range) => ({
    subject: `${o.team} — Ci siamo quasi`,
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 20px">Ciao ${o.name}! Le vostre maglie sono in fase finale. Il numero di tracking arriva a breve — consegna ancora prevista per <strong>${range}</strong>.</p>`,
  }),
};

exports.emailDay10 = function(order) {
  const lang  = order.lang || 'en';
  const range = deliveryWindow(order.paidAt, 20, 25, lang);
  const { subject, body } = (DAY10[lang] || DAY10.en)(order, range);
  return { subject, html: wrap(`${body}${sig()}`) };
};

// ── Email 4 — Tracking ────────────────────────────────────────────────────────

const TRACKING = {
  en: (o, range) => ({
    subject: `${o.team} — Your kits are on their way 🔥`,
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 20px">Hi ${o.name}! They're shipped. Track your order here:</p>
${cta(o.trackingUrl, 'Track my order')}
<p style="font-size:0.82rem;color:#71717a;margin:0 0 24px">Tracking: ${o.trackingNumber} &nbsp;·&nbsp; Estimated delivery: ${range}</p>`,
  }),
  es: (o, range) => ({
    subject: `${o.team} — Vuestras equipaciones están en camino 🔥`,
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 20px">¡Hola ${o.name}! Han salido. Seguí el pedido aquí:</p>
${cta(o.trackingUrl, 'Seguir mi pedido')}
<p style="font-size:0.82rem;color:#71717a;margin:0 0 24px">Seguimiento: ${o.trackingNumber} &nbsp;·&nbsp; Entrega estimada: ${range}</p>`,
  }),
  fr: (o, range) => ({
    subject: `${o.team} — Vos maillots sont en route 🔥`,
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 20px">Salut ${o.name} ! C'est parti. Suivez votre commande ici :</p>
${cta(o.trackingUrl, 'Suivre ma commande')}
<p style="font-size:0.82rem;color:#71717a;margin:0 0 24px">Suivi : ${o.trackingNumber} &nbsp;·&nbsp; Livraison estimée : ${range}</p>`,
  }),
  it: (o, range) => ({
    subject: `${o.team} — Le vostre maglie sono in viaggio 🔥`,
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 20px">Ciao ${o.name}! Sono partite. Traccia il tuo ordine qui:</p>
${cta(o.trackingUrl, 'Traccia il mio ordine')}
<p style="font-size:0.82rem;color:#71717a;margin:0 0 24px">Tracking: ${o.trackingNumber} &nbsp;·&nbsp; Consegna stimata: ${range}</p>`,
  }),
};

exports.emailTracking = function(order) {
  const lang  = order.lang || 'en';
  const range = deliveryWindow(new Date(), 10, 15, lang);
  const { subject, body } = (TRACKING[lang] || TRACKING.en)(order, range);
  return { subject, html: wrap(`${body}${sig()}`) };
};

// ── Email 5 — Post Delivery (manual) ─────────────────────────────────────────

const TRUSTPILOT = 'https://www.trustpilot.com/review/momuto.com';

const DELIVERED = {
  en: o => ({
    subject: `${o.team} — How are the kits?`,
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 20px">Hi ${o.name}! Your kits should be with you by now — hope the team loves them 🔥</p>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 16px">If you have a minute, a quick review means a lot to us:</p>
${cta(TRUSTPILOT, 'Leave a review')}
<p style="font-size:0.9rem;line-height:1.8;margin:0 0 24px">And if you get a photo of the team in the kits, we'd love to feature you on our site.</p>`,
  }),
  es: o => ({
    subject: `${o.team} — ¿Qué tal las equipaciones?`,
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 20px">¡Hola ${o.name}! Ya deberían estar con vosotros — esperamos que al equipo le encanten 🔥</p>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 16px">Si tenéis un momento, una reseña nos ayuda muchísimo:</p>
${cta(TRUSTPILOT, 'Dejar una reseña')}
<p style="font-size:0.9rem;line-height:1.8;margin:0 0 24px">Y si tenéis una foto del equipo con las camisetas, nos encantaría incluiros en nuestra web.</p>`,
  }),
  fr: o => ({
    subject: `${o.team} — Les maillots sont arrivés ?`,
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 20px">Salut ${o.name} ! Vos maillots devraient être là — on espère que l'équipe adore 🔥</p>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 16px">Si vous avez deux minutes, un avis nous aide vraiment :</p>
${cta(TRUSTPILOT, 'Laisser un avis')}
<p style="font-size:0.9rem;line-height:1.8;margin:0 0 24px">Et si vous avez une photo de l'équipe avec les maillots, on adorerait vous mettre en avant sur le site.</p>`,
  }),
  it: o => ({
    subject: `${o.team} — Come sono le maglie?`,
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 20px">Ciao ${o.name}! Dovrebbero essere già da voi — speriamo che la squadra le adori 🔥</p>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 16px">Se avete un minuto, una recensione ci fa davvero piacere:</p>
${cta(TRUSTPILOT, 'Lascia una recensione')}
<p style="font-size:0.9rem;line-height:1.8;margin:0 0 24px">E se avete una foto della squadra con le maglie, ci piacerebbe includervi sul nostro sito.</p>`,
  }),
};

exports.emailDelivered = function(order) {
  const lang = order.lang || 'en';
  const { subject, body } = (DELIVERED[lang] || DELIVERED.en)(order);
  return { subject, html: wrap(`${body}${sig()}`) };
};

// ── Custom-design studio emails ───────────────────────────────────────────────
// These are NOT order-lifecycle emails. They serve the €15 Custom Design deposit
// flow: a relief email once the brief is submitted (paid), and a gentle nudge for
// someone who entered their email at the gate but never paid.
// Tone: calm authority — confirm, state plainly, invite. No proof-stacking, no
// objection-handling. Sign-off is plain "— MOMUTO" (sig()).

// Per-store Custom Design (deposit) page — used by the nudge CTA.
const REQUEST_URLS = {
  en: 'https://www.momuto.com/pages/request-custom-kit-design',
  fr: 'https://fr.momuto.com/pages/demande-de-design-professionnel-de-maillots',
  es: 'https://es.momuto.com/pages/solicitud-de-diseno-personalizado',
  it: 'https://it.momuto.com/pages/richiesta-design-personalizzato',
};

const P  = 'font-size:0.95rem;line-height:1.8;margin:0 0 16px';
const P2 = 'font-size:0.95rem;line-height:1.8;margin:0 0 22px';

// ── Email A — Concept Received (brief submitted, paid) ───────────────────────

const CONCEPT_RECEIVED = {
  en: (who) => ({
    subject: who ? `${who} — we're on it 🔥` : `We're on it 🔥`,
    body: `<p style="${P}">Hey${who ? ' ' + who : ''}!</p>
<p style="${P}">We've got your concept! One of our designers will get to work on it shortly.</p>
<p style="${P}">You'll have a first mockup in <strong>24–48 hours</strong>. We shape it with you from there, and nothing goes to production until it's right.</p>
<p style="${P}">Your <strong>€15 is credited in full</strong> to any order of five jerseys or more — so if you're kitting out a team, the design effectively costs you nothing.</p>
<p style="${P2}">If there's more you want us to see — references, colours, the story behind the kit — just reply.</p>`,
  }),
  es: (who) => ({
    subject: who ? `${who} — ¡manos a la obra! 🔥` : `¡Manos a la obra! 🔥`,
    body: `<p style="${P}">¡Hola${who ? ' ' + who : ''}!</p>
<p style="${P}">¡Tenemos tu concepto! Uno de nuestros diseñadores se pondrá con él en breve.</p>
<p style="${P}">Tendrás un primer mockup en <strong>24–48 horas</strong>. A partir de ahí lo damos forma contigo, y nada pasa a producción hasta que esté perfecto.</p>
<p style="${P}">Tus <strong>15 € se acreditan íntegros</strong> a cualquier pedido de cinco equipaciones o más — así que si vistes a todo un equipo, el diseño te sale prácticamente gratis.</p>
<p style="${P2}">Si hay algo más que quieras enseñarnos — referencias, colores, la historia del kit — solo responde.</p>`,
  }),
  fr: (who) => ({
    subject: who ? `${who} — on s'en occupe 🔥` : `On s'en occupe 🔥`,
    body: `<p style="${P}">Salut${who ? ' ' + who : ''} !</p>
<p style="${P}">On a votre concept ! L'un de nos designers s'y met très vite.</p>
<p style="${P}">Vous aurez une première maquette sous <strong>24–48 heures</strong>. On la façonne avec vous ensuite, et rien ne part en production tant que ce n'est pas parfait.</p>
<p style="${P}">Vos <strong>15 € sont crédités intégralement</strong> sur toute commande de cinq maillots ou plus — donc si vous équipez toute une équipe, le design est quasiment gratuit.</p>
<p style="${P2}">S'il y a autre chose à nous montrer — références, couleurs, l'histoire du maillot — répondez simplement.</p>`,
  }),
  it: (who) => ({
    subject: who ? `${who} — ci siamo 🔥` : `Ci siamo 🔥`,
    body: `<p style="${P}">Ciao${who ? ' ' + who : ''}!</p>
<p style="${P}">Abbiamo il tuo concept! Uno dei nostri designer ci si mette a breve.</p>
<p style="${P}">Avrai un primo mockup in <strong>24–48 ore</strong>. Da lì lo modelliamo insieme a te, e niente va in produzione finché non è perfetto.</p>
<p style="${P}">I tuoi <strong>15 € sono accreditati per intero</strong> su qualsiasi ordine di cinque maglie o più — quindi se vesti tutta una squadra, il design è praticamente gratis.</p>
<p style="${P2}">Se c'è altro che vuoi mostrarci — referenze, colori, la storia del kit — rispondi e basta.</p>`,
  }),
};

exports.emailConceptReceived = function(lead) {
  const lang = lead.lang || 'en';
  const who  = (lead.name || lead.team || '').trim();
  const { subject, body } = (CONCEPT_RECEIVED[lang] || CONCEPT_RECEIVED.en)(who);
  return { subject, html: wrap(`${body}${sig()}`) };
};

// ── Email B — Deposit Nudge (email entered at gate, never paid) ──────────────

const DEPOSIT_NUDGE = {
  en: (url) => ({
    subject: `Your design is waiting — finish in 2 minutes`,
    body: `<p style="${P}">You came to make your kit real and stopped before the last step. No problem.</p>
<p style="${P}">Send us your idea, and in <strong>24–48 hours</strong> you'll see it as a real kit. €15 to start — credited in full to any order of five or more, so for a team it's effectively free. We refine it with you until it's right.</p>
${cta(url, 'Make my kit')}
<p style="${P2}">Or just reply, and we'll answer anything.</p>`,
  }),
  es: (url) => ({
    subject: `Tu diseño te espera — termínalo en 2 minutos`,
    body: `<p style="${P}">Viniste a hacer realidad tu kit y te paraste justo antes del último paso. Sin problema.</p>
<p style="${P}">Envíanos tu idea y en <strong>24–48 horas</strong> la verás como un kit real. 15 € para empezar — se acreditan íntegros a cualquier pedido de cinco o más, así que para un equipo es prácticamente gratis. Lo refinamos contigo hasta que esté perfecto.</p>
${cta(url, 'Crear mi kit')}
<p style="${P2}">O simplemente responde, y te contamos lo que quieras saber.</p>`,
  }),
  fr: (url) => ({
    subject: `Votre design vous attend — terminez en 2 minutes`,
    body: `<p style="${P}">Vous êtes venu donner vie à votre maillot et vous vous êtes arrêté juste avant la dernière étape. Pas de souci.</p>
<p style="${P}">Envoyez-nous votre idée et sous <strong>24–48 heures</strong> vous la verrez en vrai maillot. 15 € pour commencer — crédités intégralement sur toute commande de cinq ou plus, donc pour une équipe c'est quasiment gratuit. On l'affine avec vous jusqu'à ce que ce soit parfait.</p>
${cta(url, 'Créer mon maillot')}
<p style="${P2}">Ou répondez simplement, et on vous dit tout.</p>`,
  }),
  it: (url) => ({
    subject: `Il tuo design ti aspetta — finisci in 2 minuti`,
    body: `<p style="${P}">Sei venuto per dare vita al tuo kit e ti sei fermato proprio prima dell'ultimo passo. Nessun problema.</p>
<p style="${P}">Mandaci la tua idea e in <strong>24–48 ore</strong> la vedrai come una maglia vera. 15 € per iniziare — accreditati per intero su qualsiasi ordine di cinque o più, quindi per una squadra è praticamente gratis. Lo perfezioniamo con te finché non è giusto.</p>
${cta(url, 'Crea il mio kit')}
<p style="${P2}">Oppure rispondi e basta, e ti diciamo tutto.</p>`,
  }),
};

exports.emailDepositNudge = function(lead) {
  const lang = lead.lang || 'en';
  const url  = REQUEST_URLS[lang] || REQUEST_URLS.en;
  const { subject, body } = (DEPOSIT_NUDGE[lang] || DEPOSIT_NUDGE.en)(url);
  return { subject, html: wrap(`${body}${sig()}`) };
};
