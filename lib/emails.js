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

const STUDIO_SIG = {
  en: '— The MOMUTO design studio',
  es: '— El estudio de diseño de MOMUTO',
  fr: '— Le studio de design MOMUTO',
  it: '— Lo studio di design MOMUTO',
};

function studioSig(lang) {
  return `<p style="font-size:0.9rem;margin:0">${STUDIO_SIG[lang] || STUDIO_SIG.en}</p>`;
}

function pill(text, color) {
  return `<div style="display:inline-block;background:${color};color:#fff;font-size:0.68rem;font-weight:700;
    letter-spacing:0.1em;text-transform:uppercase;padding:5px 11px;margin:0 0 18px">${text}</div>`;
}

// Per-store Custom Design (deposit) page — used by the nudge CTA.
const REQUEST_URLS = {
  en: 'https://www.momuto.com/pages/request-custom-kit-design',
  fr: 'https://fr.momuto.com/pages/demande-de-design-professionnel-de-maillots',
  es: 'https://es.momuto.com/pages/solicitud-de-diseno-personalizado',
  it: 'https://it.momuto.com/pages/richiesta-design-personalizzato',
};

// ── Email A — Concept Received (brief submitted, paid) ───────────────────────

const CONCEPT_RECEIVED = {
  en: (who) => ({
    subject: `Your concept's in the studio — a designer's on it`,
    pill: pill('Concept received ✓', '#16a34a'),
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 16px">Hi${who ? ' ' + who : ' there'} —</p>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 16px">Your idea just stopped being a screenshot. We've got your concept, and your €15 is in — right now it's on a senior designer's desk. A real person, not a queue.</p>
<p style="font-size:0.95rem;line-height:1.7;margin:0 0 8px;font-weight:700">Here's exactly what happens next:</p>
<ul style="font-size:0.95rem;line-height:1.7;margin:0 0 18px;padding-left:20px">
  <li style="margin-bottom:6px"><strong>Within 24 hours</strong> — a senior designer picks up your concept.</li>
  <li style="margin-bottom:6px"><strong>24–48 hours</strong> — your first mockup lands in this inbox.</li>
  <li><strong>Then</strong> — we revise it with you until it's right. We only produce it once you say yes.</li>
</ul>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 16px">Your <strong>€15 is credited in full</strong> to any order of 5 jerseys or more — a deposit on your design, not a fee.</p>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 16px">Nothing to do now but keep an eye on this inbox. Anything to add — more references, the story behind the kit, a colour you forgot — just hit reply. A real person reads every one.</p>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 24px">We've turned 150+ teams' ideas into real kits — including an 8-year-old who drew his dream flame kit and got to wear it. Yours is next.</p>`,
  }),
  es: (who) => ({
    subject: `Tu concepto ya está en el estudio — un diseñador se encarga`,
    pill: pill('Concepto recibido ✓', '#16a34a'),
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 16px">¡Hola${who ? ' ' + who : ''}!</p>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 16px">Tu idea acaba de dejar de ser una captura de pantalla. Tenemos tu concepto y tus 15 € están dentro — ahora mismo está en la mesa de un diseñador senior. Una persona real, no una cola.</p>
<p style="font-size:0.95rem;line-height:1.7;margin:0 0 8px;font-weight:700">Esto es exactamente lo que pasa ahora:</p>
<ul style="font-size:0.95rem;line-height:1.7;margin:0 0 18px;padding-left:20px">
  <li style="margin-bottom:6px"><strong>En menos de 24 horas</strong> — un diseñador senior coge tu concepto.</li>
  <li style="margin-bottom:6px"><strong>24–48 horas</strong> — tu primer mockup llega a este correo.</li>
  <li><strong>Después</strong> — lo revisamos contigo hasta que esté perfecto. Solo lo producimos cuando tú das el sí.</li>
</ul>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 16px">Tus <strong>15 € se acreditan íntegros</strong> a cualquier pedido de 5 equipaciones o más — un depósito sobre tu diseño, no una tarifa.</p>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 16px">No tienes que hacer nada más que estar atento a este correo. ¿Algo que añadir — más referencias, la historia del kit, un color que olvidaste? Responde a este mensaje. Lo lee una persona real.</p>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 24px">Hemos convertido las ideas de más de 150 equipos en kits reales — incluido un niño de 8 años que dibujó su kit de fuego soñado y acabó vistiéndolo. El tuyo es el siguiente.</p>`,
  }),
  fr: (who) => ({
    subject: `Votre concept est au studio — un designer s'en occupe`,
    pill: pill('Concept reçu ✓', '#16a34a'),
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 16px">Salut${who ? ' ' + who : ''} !</p>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 16px">Votre idée vient d'arrêter d'être une capture d'écran. On a votre concept, et vos 15 € sont validés — il est en ce moment sur le bureau d'un designer senior. Une vraie personne, pas une file d'attente.</p>
<p style="font-size:0.95rem;line-height:1.7;margin:0 0 8px;font-weight:700">Voici exactement ce qui se passe maintenant :</p>
<ul style="font-size:0.95rem;line-height:1.7;margin:0 0 18px;padding-left:20px">
  <li style="margin-bottom:6px"><strong>Sous 24 heures</strong> — un designer senior prend votre concept en main.</li>
  <li style="margin-bottom:6px"><strong>24–48 heures</strong> — votre première maquette arrive dans cette boîte mail.</li>
  <li><strong>Ensuite</strong> — on la révise avec vous jusqu'à ce qu'elle soit parfaite. On ne produit qu'une fois que vous dites oui.</li>
</ul>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 16px">Vos <strong>15 € sont crédités intégralement</strong> sur toute commande de 5 maillots ou plus — un acompte sur votre design, pas des frais.</p>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 16px">Rien à faire maintenant, sauf garder un œil sur cette boîte mail. Quelque chose à ajouter — d'autres références, l'histoire du maillot, une couleur oubliée ? Répondez à ce message. Une vraie personne lit chacun d'eux.</p>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 24px">On a transformé les idées de plus de 150 équipes en maillots réels — dont un enfant de 8 ans qui a dessiné son maillot de feu et a fini par le porter. Le vôtre est le prochain.</p>`,
  }),
  it: (who) => ({
    subject: `Il tuo concept è in studio — un designer ci sta lavorando`,
    pill: pill('Concept ricevuto ✓', '#16a34a'),
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 16px">Ciao${who ? ' ' + who : ''}!</p>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 16px">La tua idea ha appena smesso di essere uno screenshot. Abbiamo il tuo concept e i tuoi 15 € sono dentro — in questo momento è sulla scrivania di un designer senior. Una persona vera, non una coda.</p>
<p style="font-size:0.95rem;line-height:1.7;margin:0 0 8px;font-weight:700">Ecco esattamente cosa succede ora:</p>
<ul style="font-size:0.95rem;line-height:1.7;margin:0 0 18px;padding-left:20px">
  <li style="margin-bottom:6px"><strong>Entro 24 ore</strong> — un designer senior prende in mano il tuo concept.</li>
  <li style="margin-bottom:6px"><strong>24–48 ore</strong> — il primo mockup arriva in questa casella.</li>
  <li><strong>Poi</strong> — lo rivediamo insieme finché non è giusto. Produciamo solo quando dici di sì.</li>
</ul>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 16px">I tuoi <strong>15 € sono accreditati per intero</strong> su qualsiasi ordine di 5 maglie o più — un acconto sul tuo design, non una tariffa.</p>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 16px">Non devi fare altro che tenere d'occhio questa casella. Qualcosa da aggiungere — altre referenze, la storia del kit, un colore dimenticato? Rispondi a questo messaggio. Lo legge una persona vera.</p>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 24px">Abbiamo trasformato le idee di oltre 150 squadre in kit reali — incluso un bambino di 8 anni che ha disegnato la sua maglia di fuoco e ha finito per indossarla. Il tuo è il prossimo.</p>`,
  }),
};

exports.emailConceptReceived = function(lead) {
  const lang = lead.lang || 'en';
  const who  = (lead.name || lead.team || '').trim();
  const { subject, pill: p, body } = (CONCEPT_RECEIVED[lang] || CONCEPT_RECEIVED.en)(who);
  return { subject, html: wrap(`${p}${body}${studioSig(lang)}`) };
};

// ── Email B — Deposit Nudge (email entered at gate, never paid) ──────────────

const DEPOSIT_NUDGE = {
  en: (url) => ({
    subject: `Any questions before you start?`,
    pill: pill('We saved your spot', '#0a0a0a'),
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 16px">Hi there —</p>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 18px">You came to turn your concept into a real kit, and stopped at the last step. Totally fair — €15 is a small bet, but it's still a bet on people you haven't met yet. So let's clear the air.</p>
<p style="font-size:0.95rem;line-height:1.7;margin:0 0 8px;font-weight:700">A few things people usually ask:</p>
<ul style="font-size:0.95rem;line-height:1.7;margin:0 0 18px;padding-left:20px">
  <li style="margin-bottom:8px"><strong>"Is the €15 really credited back?"</strong> Yes — in full, on any order of 5+ jerseys. A deposit on your design, not a fee.</li>
  <li style="margin-bottom:8px"><strong>"Can you actually make MY idea?"</strong> An AI render, a napkin sketch, an 8-year-old's drawing of a flame kit — we've turned all three into real jerseys. Bring whatever you've got.</li>
  <li><strong>"What do I actually get?"</strong> A senior designer on your concept within 24h, your first mockup in 24–48h, and unlimited revisions until it's right. We only produce it once you say yes.</li>
</ul>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 22px">Still have a question we didn't answer? Just reply to this email — a real person reads every one.</p>
${cta(url, 'Pick up where I left off')}`,
  }),
  es: (url) => ({
    subject: `¿Alguna duda antes de empezar?`,
    pill: pill('Te guardamos el sitio', '#0a0a0a'),
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 16px">¡Hola!</p>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 18px">Viniste a convertir tu concepto en un kit real y te paraste en el último paso. Es totalmente normal — 15 € es una apuesta pequeña, pero sigue siendo una apuesta por gente que aún no conoces. Así que aclaremos las dudas.</p>
<p style="font-size:0.95rem;line-height:1.7;margin:0 0 8px;font-weight:700">Lo que la gente suele preguntar:</p>
<ul style="font-size:0.95rem;line-height:1.7;margin:0 0 18px;padding-left:20px">
  <li style="margin-bottom:8px"><strong>"¿Los 15 € se devuelven de verdad?"</strong> Sí — íntegros, en cualquier pedido de 5+ equipaciones. Un depósito sobre tu diseño, no una tarifa.</li>
  <li style="margin-bottom:8px"><strong>"¿Podéis hacer MI idea?"</strong> Un render de IA, un boceto en una servilleta, el dibujo de un niño de 8 años de un kit de fuego — hemos convertido los tres en equipaciones reales. Trae lo que tengas.</li>
  <li><strong>"¿Qué recibo exactamente?"</strong> Un diseñador senior con tu concepto en menos de 24h, tu primer mockup en 24–48h y revisiones ilimitadas hasta que esté perfecto. Solo producimos cuando das el sí.</li>
</ul>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 22px">¿Te queda alguna duda sin responder? Responde a este correo — lo lee una persona real.</p>
${cta(url, 'Retomar donde lo dejé')}`,
  }),
  fr: (url) => ({
    subject: `Des questions avant de commencer ?`,
    pill: pill('On vous a gardé votre place', '#0a0a0a'),
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 16px">Salut !</p>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 18px">Vous êtes venu transformer votre concept en vrai maillot, et vous vous êtes arrêté à la dernière étape. C'est tout à fait normal — 15 €, c'est un petit pari, mais c'est quand même un pari sur des gens que vous ne connaissez pas encore. Alors mettons les choses au clair.</p>
<p style="font-size:0.95rem;line-height:1.7;margin:0 0 8px;font-weight:700">Ce que les gens demandent souvent :</p>
<ul style="font-size:0.95rem;line-height:1.7;margin:0 0 18px;padding-left:20px">
  <li style="margin-bottom:8px"><strong>« Les 15 € sont vraiment crédités ? »</strong> Oui — intégralement, sur toute commande de 5 maillots ou plus. Un acompte sur votre design, pas des frais.</li>
  <li style="margin-bottom:8px"><strong>« Vous pouvez vraiment faire MON idée ? »</strong> Un rendu IA, un croquis sur une serviette, le dessin d'un enfant de 8 ans d'un maillot de feu — on a transformé les trois en vrais maillots. Apportez ce que vous avez.</li>
  <li><strong>« Qu'est-ce que je reçois exactement ? »</strong> Un designer senior sur votre concept sous 24h, votre première maquette en 24–48h, et des révisions illimitées jusqu'à ce que ce soit parfait. On ne produit qu'une fois que vous dites oui.</li>
</ul>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 22px">Une question sans réponse ? Répondez simplement à cet e-mail — une vraie personne lit chacun d'eux.</p>
${cta(url, 'Reprendre où je me suis arrêté')}`,
  }),
  it: (url) => ({
    subject: `Domande prima di iniziare?`,
    pill: pill('Ti abbiamo tenuto il posto', '#0a0a0a'),
    body: `<p style="font-size:0.95rem;line-height:1.8;margin:0 0 16px">Ciao!</p>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 18px">Sei venuto per trasformare il tuo concept in una maglia vera, e ti sei fermato all'ultimo passo. Più che comprensibile — 15 € è una piccola scommessa, ma è pur sempre una scommessa su persone che non hai ancora incontrato. Quindi chiariamo tutto.</p>
<p style="font-size:0.95rem;line-height:1.7;margin:0 0 8px;font-weight:700">Quello che di solito ci chiedono:</p>
<ul style="font-size:0.95rem;line-height:1.7;margin:0 0 18px;padding-left:20px">
  <li style="margin-bottom:8px"><strong>"I 15 € vengono davvero accreditati?"</strong> Sì — per intero, su qualsiasi ordine di 5+ maglie. Un acconto sul tuo design, non una tariffa.</li>
  <li style="margin-bottom:8px"><strong>"Potete davvero realizzare la MIA idea?"</strong> Un render IA, uno schizzo su un tovagliolo, il disegno di un bambino di 8 anni di una maglia di fuoco — li abbiamo trasformati tutti e tre in maglie vere. Porta quello che hai.</li>
  <li><strong>"Cosa ricevo esattamente?"</strong> Un designer senior sul tuo concept entro 24h, il primo mockup in 24–48h e revisioni illimitate finché non è giusto. Produciamo solo quando dici di sì.</li>
</ul>
<p style="font-size:0.95rem;line-height:1.8;margin:0 0 22px">Hai ancora una domanda senza risposta? Rispondi a questa email — la legge una persona vera.</p>
${cta(url, 'Riprendi da dove ho lasciato')}`,
  }),
};

exports.emailDepositNudge = function(lead) {
  const lang = lead.lang || 'en';
  const url  = REQUEST_URLS[lang] || REQUEST_URLS.en;
  const { subject, pill: p, body } = (DEPOSIT_NUDGE[lang] || DEPOSIT_NUDGE.en)(url);
  return { subject, html: wrap(`${p}${body}${studioSig(lang)}`) };
};
