'use strict';
const { deliveryEstimate } = require('./delivery');

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

// Delivery window (lib/delivery.js is the ONE derivation, shared with the My order page): payment + 25–30 days, or 18–23 when the
// order carries the per-order FAST LANE (priority production + priority
// shipping, ~7 days saved; 23 Sep 2026). One helper so every lifecycle email
// quotes the same dates.
function orderWindow(order, lang) {
  const e = deliveryEstimate(order);
  if (e) return formatRange(e.from, e.to, lang);
  // no usable payment date: same fallback the old code had
  return order.fastLane ? deliveryWindow(order.paidAt, 18, 23, lang) : deliveryWindow(order.paidAt, 25, 30, lang);
}

const FAST_LANE_LINE = {
  en: 'Fast lane — priority production and priority shipping.',
  es: 'Vía rápida — producción y envío prioritarios.',
  fr: 'Voie rapide — production et expédition prioritaires.',
  it: 'Corsia veloce — produzione e spedizione prioritarie.',
};
function fastLaneNote(order, lang) {
  if (!order.fastLane) return '';
  return `<p style="font-size:0.85rem;line-height:1.6;margin:0 0 16px;color:#c8352e;font-weight:600">&#9889; ${FAST_LANE_LINE[lang] || FAST_LANE_LINE.en}</p>`;
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


// "See your order" link (30 Sep 2026) — 3D-tool orders only; other orders have no page.
const ORDER_LINK = { en: 'See your order', es: 'Ver mi pedido', fr: 'Voir ma commande', it: 'Vedi il mio ordine' };
function orderLink(order, lang) {
  const url = require('./order-view').viewUrl(order);
  return url ? cta(url, ORDER_LINK[lang] || ORDER_LINK.en) : '';
}

// "Share your new kit" block (18 Oct 2026): opens the design in the 3D designer with the share-card ready. Only when the
// order carries the design's configId + the buyer's uuid (orders paid after the webhook patch); nothing otherwise.
const CARD = {
  en: { h: 'Share your new kit', t: 'Make a post-ready picture of your kit with your team name on it, then share it with one tap.', b: 'Create my kit image' },
  es: { h: 'Comparte tu nueva equipación', t: 'Crea una imagen lista para publicar con el nombre de tu equipo y compártela con un toque.', b: 'Crear mi imagen' },
  fr: { h: 'Partagez votre nouvelle tenue', t: "Créez une image prête à publier avec le nom de votre équipe, puis partagez-la d'un geste.", b: 'Créer mon image' },
  it: { h: 'Condividi la tua nuova divisa', t: "Crea un'immagine pronta da pubblicare con il nome della tua squadra e condividila con un tocco.", b: 'Crea la mia immagine' },
};
function cardBlock(order, lang) {
  const url = require('./order-view').firstCardUrl(order);
  if (!url) return '';
  const c = CARD[lang] || CARD.en;
  return `<div style="border-top:1px solid #e4e4e7;margin:8px 0 22px;padding-top:18px">` +
    `<p style="font-size:0.95rem;font-weight:700;margin:0 0 6px">${c.h}</p>` +
    `<p style="font-size:0.88rem;line-height:1.7;margin:0 0 12px;color:#52525b">${c.t}</p>` +
    `<a href="${url.replace(/&/g, '&amp;')}" style="display:inline-block;border:2px solid #0a0a0a;color:#0a0a0a;padding:10px 22px;font-weight:700;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.1em;text-decoration:none">${c.b} →</a></div>`;
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
  const range = orderWindow(order, lang);
  const { subject, body } = (CONFIRMED[lang] || CONFIRMED.en)(order, range);
  return { subject, html: wrap(`${body}${fastLaneNote(order, lang)}${ref(order)}${sig()}`) };
};

// Same confirmation, but for 3D-tool orders: embeds the customer's actual
// jersey renders and the per-player roster (design.momuto.com webhook flow).
exports.emailConfirmation3D = function(order) {
  const lang  = order.lang || 'en';
  const range = orderWindow(order, lang);
  const { subject, body } = (CONFIRMED[lang] || CONFIRMED.en)(order, range);

  const TH = {
    en: ['Name', 'No.', 'Size', 'Qty'],
    es: ['Nombre', 'Dorsal', 'Talla', 'Cant.'],
    fr: ['Nom', 'N°', 'Taille', 'Qté'],
    it: ['Nome', 'N.', 'Taglia', 'Qtà'],
  }[lang] || ['Name', 'No.', 'Size', 'Qty'];

  let designsHtml = '';
  (order.designs || []).forEach(d => {
    const imgs = [d.front, d.back].filter(Boolean).map(u =>
      `<img src="${u}" width="150" style="max-width:150px;border:1px solid #e4e4e7;margin:0 8px 8px 0" alt="kit"/>`
    ).join('');
    let table = '';
    const players = (d.players || []).filter(p => p && (p.name || p.number || p.size));
    if (players.length) {
      const rows = players.map(p =>
        `<tr><td style="padding:4px 10px;border-bottom:1px solid #f0f0f0">${p.name || ''}</td>` +
        `<td style="padding:4px 10px;border-bottom:1px solid #f0f0f0">${p.number || ''}</td>` +
        `<td style="padding:4px 10px;border-bottom:1px solid #f0f0f0">${p.size || ''}</td>` +
        `<td style="padding:4px 10px;border-bottom:1px solid #f0f0f0">${p.qty || 1}</td></tr>`
      ).join('');
      table = `<table style="border-collapse:collapse;font-size:0.82rem;margin:4px 0 16px">` +
        `<tr>${TH.map(h => `<th style="text-align:left;padding:4px 10px;border-bottom:2px solid #0a0a0a">${h}</th>`).join('')}</tr>${rows}</table>`;
    }
    designsHtml += `<div style="margin:0 0 12px">${imgs}${table}</div>`;
  });

  // Order summary (22 Sep 2026): a customer asked for "an email with the
  // details of the order" — the confirmation only said "payment received".
  // Rendered when the record carries the facts (poller + manual ingest do;
  // the design-server webhook path carries qty via the roster tables above).
  const SUM = {
    en: { units: 'Jerseys', paid: 'Paid', date: 'Payment date', order: 'Store order', shorts: 'Shorts', socks: 'Socks', longSleeves: 'Long sleeves', collars: 'Polo collars' },
    es: { units: 'Camisetas', paid: 'Pagado', date: 'Fecha de pago', order: 'Pedido tienda', shorts: 'Pantalones', socks: 'Calcetines', longSleeves: 'Manga larga', collars: 'Cuellos polo' },
    fr: { units: 'Maillots', paid: 'Payé', date: 'Date de paiement', order: 'Commande boutique', shorts: 'Shorts', socks: 'Chaussettes', longSleeves: 'Manches longues', collars: 'Cols polo' },
    it: { units: 'Maglie', paid: 'Pagato', date: 'Data di pagamento', order: 'Ordine negozio', shorts: 'Pantaloncini', socks: 'Calzettoni', longSleeves: 'Maniche lunghe', collars: 'Colletti polo' },
  }[lang] || { units: 'Jerseys', paid: 'Paid', date: 'Payment date', order: 'Store order', shorts: 'Shorts', socks: 'Socks', longSleeves: 'Long sleeves', collars: 'Polo collars' };
  const money = (v, c) => {
    const n = Number(v); if (!isFinite(n)) return String(v);
    const sym = { EUR: '€', USD: '$', GBP: '£' }[String(c || 'EUR').toUpperCase()];
    return sym ? `${sym}${n.toFixed(2)}` : `${n.toFixed(2)} ${c}`;
  };
  const rowsSum = [];
  if (order.qty && order.qty !== '—') rowsSum.push([SUM.units, order.qty]);
  // add-ons and kit pieces listed on their own rows — never folded into the jersey count
  for (const k of ['shorts', 'socks', 'longSleeves', 'collars']) {
    const n = order.extras && parseInt(order.extras[k], 10);
    if (n > 0) rowsSum.push([SUM[k], n]);
  }
  if (order.total) rowsSum.push([SUM.paid, money(order.total, order.currency)]);
  if (order.platformPaidAt || order.paidAt) rowsSum.push([SUM.date, String(order.platformPaidAt || order.paidAt).slice(0, 10)]);
  if (order.plantOrderNo) rowsSum.push([SUM.order, order.plantOrderNo]);
  const summaryHtml = rowsSum.length
    ? `<table style="border-collapse:collapse;font-size:0.88rem;margin:8px 0 16px">${rowsSum.map(([k, v]) =>
        `<tr><td style="padding:3px 14px 3px 0;color:#71717a">${k}</td><td style="padding:3px 0;font-weight:600">${v}</td></tr>`).join('')}</table>`
    : '';

  return { subject, html: wrap(`${body}${fastLaneNote(order, lang)}${summaryHtml}${designsHtml}${cardBlock(order, lang)}${ref(order)}${orderLink(order, lang)}${sig()}`) };
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
  return { subject, html: wrap(`${body}${cardBlock(order, lang)}${orderLink(order, lang)}${sig()}`) };
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
  const range = orderWindow(order, lang);
  const { subject, body } = (DAY10[lang] || DAY10.en)(order, range);
  return { subject, html: wrap(`${body}${orderLink(order, lang)}${sig()}`) };
};

// ── Email 4 — Shipped (dark brand layout, 19 Oct 2026) ───────────────────────
// Sent once per order: by the poller (scripts/poll-shipped-orders.js -> admin-orders `ship`) or by the manual admin
// route (api/order-tracking.js). Carries the carrier + tracking number + deep link, the delivery window, and both
// places the buyer can see the order: our token page (no login) and the store account (needs the same email).

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SHIPPED = {
  en: { kicker: 'Order shipped', h: 'Your order is on its way.', hi: n => `Hi ${n},`, intro: c => `your order has left us and is now with ${c}.`, introNoCarrier: 'your order has left us and is now with the carrier.',
        carrier: 'Carrier', number: 'Tracking number', track: 'Track my parcel', eta: 'Estimated delivery', etaNote: 'The carrier page can take a day or two to show the first scan.', order: 'Your order', orderText: 'Your design, order details and this tracking, in one place. No login needed.', see: 'See my order',
        acct: (e, no, u) => `Prefer the store account? <a href="${u}" style="color:#f4f4f5">Sign in</a> or create an account with <strong style="color:#f4f4f5">${e}</strong> to see order ${no}.`,
        help: 'Questions? Write to', subject: t => `${t} — Your order is on its way 🔥`, subjectPlain: 'Your MOMUTO order is on its way 🔥' },
  es: { kicker: 'Pedido enviado', h: 'Tu pedido está en camino.', hi: n => `Hola ${n},`, intro: c => `tu pedido ya ha salido y está con ${c}.`, introNoCarrier: 'tu pedido ya ha salido y está con el transportista.',
        carrier: 'Transportista', number: 'Número de seguimiento', track: 'Seguir mi envío', eta: 'Entrega estimada', etaNote: 'La página del transportista puede tardar uno o dos días en mostrar el primer escaneo.', order: 'Tu pedido', orderText: 'Tu diseño, los datos del pedido y este seguimiento, en un solo sitio. Sin iniciar sesión.', see: 'Ver mi pedido',
        acct: (e, no, u) => `¿Prefieres la cuenta de la tienda? <a href="${u}" style="color:#f4f4f5">Inicia sesión</a> o crea una cuenta con <strong style="color:#f4f4f5">${e}</strong> para ver el pedido ${no}.`,
        help: '¿Dudas? Escribe a', subject: t => `${t} — Tu pedido está en camino 🔥`, subjectPlain: 'Tu pedido de MOMUTO está en camino 🔥' },
  fr: { kicker: 'Commande expédiée', h: 'Votre commande est en route.', hi: n => `Bonjour ${n},`, intro: c => `votre commande est partie et se trouve chez ${c}.`, introNoCarrier: 'votre commande est partie et se trouve chez le transporteur.',
        carrier: 'Transporteur', number: 'Numéro de suivi', track: 'Suivre mon colis', eta: 'Livraison estimée', etaNote: 'La page du transporteur peut mettre un jour ou deux à afficher le premier scan.', order: 'Votre commande', orderText: 'Votre design, les détails de la commande et ce suivi, au même endroit. Sans connexion.', see: 'Voir ma commande',
        acct: (e, no, u) => `Vous préférez le compte boutique ? <a href="${u}" style="color:#f4f4f5">Connectez-vous</a> ou créez un compte avec <strong style="color:#f4f4f5">${e}</strong> pour voir la commande ${no}.`,
        help: 'Une question ? Écrivez à', subject: t => `${t} — Votre commande est en route 🔥`, subjectPlain: 'Votre commande MOMUTO est en route 🔥' },
  it: { kicker: 'Ordine spedito', h: 'Il tuo ordine è in viaggio.', hi: n => `Ciao ${n},`, intro: c => `il tuo ordine è partito ed è ora con ${c}.`, introNoCarrier: 'il tuo ordine è partito ed è ora con il corriere.',
        carrier: 'Corriere', number: 'Numero di tracking', track: 'Traccia il pacco', eta: 'Consegna stimata', etaNote: 'La pagina del corriere può impiegare un giorno o due a mostrare la prima scansione.', order: 'Il tuo ordine', orderText: 'Il tuo design, i dettagli dell\'ordine e questo tracking, in un unico posto. Senza accedere.', see: 'Vedi il mio ordine',
        acct: (e, no, u) => `Preferisci l'account del negozio? <a href="${u}" style="color:#f4f4f5">Accedi</a> o crea un account con <strong style="color:#f4f4f5">${e}</strong> per vedere l'ordine ${no}.`,
        help: 'Domande? Scrivi a', subject: t => `${t} — Il tuo ordine è in viaggio 🔥`, subjectPlain: 'Il tuo ordine MOMUTO è in viaggio 🔥' },
};

const DK = { bg: '#0b0b0c', card: '#151517', line: '#2a2a2d', text: '#f4f4f5', mute: '#a1a1aa', red: '#c8352e' };
const DK_BTN = (href, label, solid) => `<a href="${esc(href)}" style="display:block;text-align:center;${solid ? `background:${DK.red};color:#fff;border:2px solid ${DK.red}` : `background:transparent;color:${DK.text};border:2px solid ${DK.text}`};padding:14px 20px;font-weight:700;font-size:0.82rem;text-transform:uppercase;letter-spacing:0.12em;text-decoration:none">${esc(label)} &rarr;</a>`;

exports.emailTracking = function(order) {
  const lang = SHIPPED[order.lang] ? order.lang : 'en';
  const t = SHIPPED[lang];
  // the window is counted from the PAYMENT date, same as the confirmation email and the My order page (lib/delivery.js, owner 27 Oct 2026)
  // No payment date on record (a store order we have no local record for and the platform gave none): no estimate row, never a guess.
  const est = deliveryEstimate(order);
  const range = est ? formatRange(est.from, est.to, lang) : null;
  const view = require('./order-view');
  const orderUrl = view.viewUrl(order);
  const st = view.STORES[view.storeKey(order)];
  const acctUrl = order.plantOrderNo && order.email ? `${st.host}/account/orders/${encodeURIComponent(order.plantOrderNo)}` : null;
  const who = esc(order.name || '').trim() || 'Coach';
  const team = esc(order.team || '');
  const hasTeam = order.team && order.team !== order.name;
  const carrier = order.carrier ? esc(order.carrier) : null;
  const row = (k, v) => `<div style="padding:10px 0;border-top:1px solid ${DK.line}"><div style="font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:${DK.mute};margin-bottom:4px">${k}</div><div style="font-size:1rem;color:${DK.text}">${v}</div></div>`;
  const body = `<div style="font-family:'Outfit',Arial,sans-serif;max-width:560px;margin:0 auto;background:${DK.bg};color:${DK.text};border:1px solid ${DK.line}">
  <div style="padding:18px 24px;border-bottom:1px solid ${DK.line}"><span style="font-size:1.3rem;font-weight:800;color:#fff;letter-spacing:0.08em">MOMUTO</span></div>
  <div style="padding:30px 24px 8px">
    <div style="font-size:0.72rem;letter-spacing:0.18em;text-transform:uppercase;color:${DK.red};font-weight:700;margin-bottom:8px">${t.kicker}</div>
    <div style="font-family:'Bebas Neue',Impact,'Arial Narrow',sans-serif;font-size:2.4rem;line-height:1.05;letter-spacing:0.02em;color:#fff;margin:0 0 14px">${t.h}</div>
    <p style="font-size:0.95rem;line-height:1.7;margin:0 0 22px;color:${DK.text}">${t.hi(who)} ${carrier ? t.intro(carrier) : t.introNoCarrier}</p>
    <div style="background:${DK.card};border:1px solid ${DK.line};padding:6px 18px 18px;margin-bottom:22px">
      ${carrier ? row(t.carrier, carrier) : ''}
      ${row(t.number, `<span style="font-family:'Courier New',monospace;font-size:1.25rem;font-weight:700;letter-spacing:0.06em;word-break:break-all">${esc(order.trackingNumber)}</span>`)}
      ${range ? row(t.eta, esc(range)) : ''}
      ${order.trackingUrl ? `<div style="padding-top:14px">${DK_BTN(order.trackingUrl, t.track, true)}</div><p style="font-size:0.78rem;line-height:1.6;color:${DK.mute};margin:10px 0 0">${t.etaNote}</p>` : ''}
    </div>
    ${orderUrl ? `<div style="border-top:1px solid ${DK.line};padding:18px 0 4px"><div style="font-size:0.95rem;font-weight:700;margin-bottom:6px">${t.order}${hasTeam ? ` · ${team}` : ''}</div><p style="font-size:0.88rem;line-height:1.7;color:${DK.mute};margin:0 0 14px">${t.orderText}</p>${DK_BTN(orderUrl, t.see, false)}</div>` : ''}
    ${acctUrl ? `<p style="font-size:0.8rem;line-height:1.7;color:${DK.mute};margin:16px 0 0">${t.acct(esc(order.email), esc(order.plantOrderNo), esc(acctUrl))}</p>` : ''}
  </div>
  <div style="padding:20px 24px 26px"><p style="font-size:0.8rem;color:${DK.mute};margin:0 0 6px">${t.help} <a href="mailto:info@momuto.com" style="color:${DK.text}">info@momuto.com</a></p><p style="font-size:0.9rem;margin:0;color:${DK.text}">— MOMUTO</p></div>
</div>`;
  return { subject: hasTeam ? t.subject(order.team) : t.subjectPlain, html: body };
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
  return { subject, html: wrap(`${body}${orderLink(order, lang)}${sig()}`) };
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
  us: 'https://us.momuto.com/pages/request-custom-kit-design',
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

const usd = r => ({ ...r, body: r.body.replace(/€15/g, () => '$15') });
// A deposit lead's email language. The US page posts locale 'en', so older leads are told apart by the store URL they came from.
exports.leadLang = lead => (lead && /^https?:\/\/us\./.test(lead.source || '') ? 'us' : (lead && lead.locale) || 'en');
const forLang = (table, lang) => (...a) => (lang === 'us' ? usd(table.en(...a)) : (table[lang] || table.en)(...a));

exports.emailConceptReceived = function(lead) {
  const lang = lead.lang || 'en';
  const who  = (lead.name || lead.team || '').trim();
  const { subject, body } = forLang(CONCEPT_RECEIVED, lang)(who);
  return { subject, html: wrap(`${body}${sig()}`) };
};

// ── Email A2 — Deposit Paid (paid at Stripe, brief maybe not submitted yet) ──
// Dual-purpose: confirms the deposit AND prompts the brief. Works whether they
// paid-then-filled (normal) or paid-and-bounced (the gap we're closing). CTA
// deep-links the ?paid=true page that unlocks the form directly.

const DEPOSIT_PAID = {
  en: (who, url) => ({
    subject: `We've got your deposit — send us the vision 🔥`,
    body: `<p style="${P}">Hey${who ? ' ' + who : ''}!</p>
<p style="${P}">Your deposit's in — thank you. Our designers are ready to go.</p>
<p style="${P}"><strong>Haven't sent your team details yet?</strong> It takes 2 minutes — do it here and we'll get straight to work.</p>
${cta(url, 'Finish my brief')}
<p style="${P}">Already sent them? Perfect — we're on it, and your first mockup lands in <strong>24–48 hours</strong>.</p>
<p style="${P2}">One design, made for your team. Let's build it.</p>`,
  }),
  es: (who, url) => ({
    subject: `Tenemos tu depósito — cuéntanos tu visión 🔥`,
    body: `<p style="${P}">¡Hola${who ? ' ' + who : ''}!</p>
<p style="${P}">Tu depósito está confirmado — gracias. Nuestros diseñadores están listos.</p>
<p style="${P}"><strong>¿Aún no nos has enviado los datos de tu equipo?</strong> Son 2 minutos — hazlo aquí y nos ponemos manos a la obra.</p>
${cta(url, 'Completar mi brief')}
<p style="${P}">¿Ya los enviaste? Perfecto — estamos con ello, y tu primer mockup llega en <strong>24–48 horas</strong>.</p>
<p style="${P2}">Un diseño, hecho para tu equipo. Vamos a crearlo.</p>`,
  }),
  fr: (who, url) => ({
    subject: `On a votre acompte — montrez-nous votre vision 🔥`,
    body: `<p style="${P}">Salut${who ? ' ' + who : ''} !</p>
<p style="${P}">Votre acompte est confirmé — merci. Nos designers sont prêts.</p>
<p style="${P}"><strong>Vous ne nous avez pas encore envoyé les détails de votre équipe ?</strong> C'est 2 minutes — faites-le ici et on s'y met tout de suite.</p>
${cta(url, 'Compléter mon brief')}
<p style="${P}">Déjà envoyés ? Parfait — on s'en occupe, et votre première maquette arrive sous <strong>24–48 heures</strong>.</p>
<p style="${P2}">Un design, fait pour votre équipe. On le crée.</p>`,
  }),
  it: (who, url) => ({
    subject: `Abbiamo il tuo deposito — mostraci la tua visione 🔥`,
    body: `<p style="${P}">Ciao${who ? ' ' + who : ''}!</p>
<p style="${P}">Il tuo deposito è confermato — grazie. I nostri designer sono pronti.</p>
<p style="${P}"><strong>Non ci hai ancora inviato i dettagli della tua squadra?</strong> Bastano 2 minuti — fallo qui e ci mettiamo subito al lavoro.</p>
${cta(url, 'Completa il mio brief')}
<p style="${P}">Già inviati? Perfetto — ci siamo, e il tuo primo mockup arriva in <strong>24–48 ore</strong>.</p>
<p style="${P2}">Un design, fatto per la tua squadra. Costruiamolo.</p>`,
  }),
};

exports.emailDepositPaid = function(lead) {
  const lang = lead.lang || 'en';
  const who  = (lead.name || '').trim();
  const url  = (REQUEST_URLS[lang] || REQUEST_URLS.en) + '?paid=true';
  const { subject, body } = forLang(DEPOSIT_PAID, lang)(who, url);
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
  const { subject, body } = forLang(DEPOSIT_NUDGE, lang)(url);
  return { subject, html: wrap(`${body}${sig()}`) };
};
