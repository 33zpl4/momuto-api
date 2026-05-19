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
