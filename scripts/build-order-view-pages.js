'use strict';

/**
 * Builds the customer "My order" page for every store into
 * cms/pages/<locale>/<handle>.json (stub without id: Deploy CMS Page creates it on merge).
 * The page is a static shell; its script POSTs { ref, k | email } to
 * https://momuto-api.vercel.app/api/order-view and renders the answer with textContent only.
 * Noindex, and excluded from the sitemap (scripts/rebuild-sitemap.js). Docs: docs/order-view.md.
 *
 * Usage: node scripts/build-order-view-pages.js [en,us,es,fr,it]
 */
const fs = require('fs');
const path = require('path');
const CSS = require('./lib/estate-css.js');
const { STORES } = require('../lib/order-view');

const ROOT = path.resolve(__dirname, '..');
const LOCALES = (process.argv[2] || 'en,us,es,fr,it').split(',').map(s => s.trim()).filter(Boolean);
const API = 'https://momuto-api.vercel.app/api/order-view';

const T = {
  en: {
    title: 'My order', meta_title: 'My order | MOMUTO', meta_descript: 'Follow your MOMUTO order: status, delivery window, tracking and your roster.',
    h1: 'MY <span class="acc">ORDER</span>', sub: 'Status, delivery window, tracking and your roster, in one place.',
    hi: n => n ? `Hi ${n}, here is your order.` : 'Here is your order.', ref: 'Order reference', store: 'Store order',
    steps: ['Paid', 'In production', 'Shipped', 'Delivered'], window: 'Estimated delivery', windowFast: 'Estimated delivery · Fast lane',
    track: 'Track your parcel', tracking: 'Tracking number', design: 'Your design', front: 'Front', back: 'Back',
    roster: 'Roster', cols: { number: 'No.', name: 'Name', size: 'Jersey', shorts: 'Shorts', sleeve: 'Sleeve', qty: 'Qty' },
    long: 'Long', short: 'Short', none: 'Jersey only', polo: 'Polo collar', same: 'Same size',
    pending: 'Your roster is being loaded. Check back shortly.', totals: (t) => `${t.jerseys} jerseys` + (t.shorts != null ? ` · ${t.shorts} shorts` : ''),
    helpH: 'Something not right?', helpP: 'Tell us and we fix it. Include what you see and what it should say.', helpBtn: 'Email us',
    helpSub: r => `Order ${r}`, formH: 'Find your order', formP: 'Enter your order reference and the email you used at checkout.',
    fRef: 'Order reference', fEmail: 'Email', fBtn: 'Show my order', notFound: 'We could not find that order. Check the reference and email.',
    rate: 'Too many attempts. Try again in an hour.', err: 'Something went wrong. Try again in a moment.', loading: 'Loading…', locale: 'en-GB',
    reuseH: 'Reuse this design', reuseP: 'Want the same kit again, or a variation? Your saved designs live in the 3D designer (sign in there).', reuseB: 'Open my designs',
  },
  es: {
    title: 'Mi pedido', meta_title: 'Mi pedido | MOMUTO', meta_descript: 'Sigue tu pedido de MOMUTO: estado, plazo de entrega, seguimiento y tu plantilla.',
    h1: 'MI <span class="acc">PEDIDO</span>', sub: 'Estado, plazo de entrega, seguimiento y tu plantilla, en un solo sitio.',
    hi: n => n ? `Hola ${n}, este es tu pedido.` : 'Este es tu pedido.', ref: 'Referencia del pedido', store: 'Pedido de la tienda',
    steps: ['Pagado', 'En producción', 'Enviado', 'Entregado'], window: 'Entrega estimada', windowFast: 'Entrega estimada · Fast lane',
    track: 'Seguir el paquete', tracking: 'Número de seguimiento', design: 'Tu diseño', front: 'Delante', back: 'Detrás',
    roster: 'Plantilla', cols: { number: 'Dorsal', name: 'Nombre', size: 'Camiseta', shorts: 'Pantalón', sleeve: 'Manga', qty: 'Cant.' },
    long: 'Larga', short: 'Corta', none: 'Solo camiseta', polo: 'Cuello polo', same: 'Misma talla',
    pending: 'Estamos cargando tu plantilla. Vuelve a mirar en un momento.', totals: (t) => `${t.jerseys} camisetas` + (t.shorts != null ? ` · ${t.shorts} pantalones` : ''),
    helpH: '¿Algo no está bien?', helpP: 'Cuéntanoslo y lo arreglamos. Indica qué ves y qué debería poner.', helpBtn: 'Escríbenos',
    helpSub: r => `Pedido ${r}`, formH: 'Busca tu pedido', formP: 'Introduce la referencia del pedido y el email que usaste al pagar.',
    fRef: 'Referencia del pedido', fEmail: 'Email', fBtn: 'Ver mi pedido', notFound: 'No encontramos ese pedido. Revisa la referencia y el email.',
    rate: 'Demasiados intentos. Prueba de nuevo dentro de una hora.', err: 'Algo ha fallado. Inténtalo de nuevo en un momento.', loading: 'Cargando…', locale: 'es-ES',
    reuseH: 'Reutiliza este diseño', reuseP: '¿Quieres repetir la equipación o una variante? Tus diseños guardados están en el diseñador 3D (inicia sesión allí).', reuseB: 'Abrir mis diseños',
  },
  fr: {
    title: 'Ma commande', meta_title: 'Ma commande | MOMUTO', meta_descript: 'Suivez votre commande MOMUTO : statut, délai de livraison, suivi et votre liste de joueurs.',
    h1: 'MA <span class="acc">COMMANDE</span>', sub: 'Statut, délai de livraison, suivi et votre liste de joueurs, au même endroit.',
    hi: n => n ? `Bonjour ${n}, voici votre commande.` : 'Voici votre commande.', ref: 'Référence de commande', store: 'Commande boutique',
    steps: ['Payée', 'En production', 'Expédiée', 'Livrée'], window: 'Livraison estimée', windowFast: 'Livraison estimée · Fast lane',
    track: 'Suivre le colis', tracking: 'Numéro de suivi', design: 'Votre design', front: 'Face', back: 'Dos',
    roster: 'Liste des joueurs', cols: { number: 'N°', name: 'Nom', size: 'Maillot', shorts: 'Short', sleeve: 'Manches', qty: 'Qté' },
    long: 'Longues', short: 'Courtes', none: 'Maillot seul', polo: 'Col polo', same: 'Même taille',
    pending: 'Votre liste est en cours de chargement. Revenez dans un instant.', totals: (t) => `${t.jerseys} maillots` + (t.shorts != null ? ` · ${t.shorts} shorts` : ''),
    helpH: 'Un souci ?', helpP: 'Dites-le-nous, on corrige. Précisez ce que vous voyez et ce qui devrait s\'afficher.', helpBtn: 'Écrivez-nous',
    helpSub: r => `Commande ${r}`, formH: 'Retrouvez votre commande', formP: 'Saisissez la référence de commande et l\'email utilisé au paiement.',
    fRef: 'Référence de commande', fEmail: 'Email', fBtn: 'Voir ma commande', notFound: 'Commande introuvable. Vérifiez la référence et l\'email.',
    rate: 'Trop de tentatives. Réessayez dans une heure.', err: 'Une erreur est survenue. Réessayez dans un instant.', loading: 'Chargement…', locale: 'fr-FR',
    reuseH: 'Réutiliser ce design', reuseP: "Envie du même maillot, ou d'une variante ? Vos designs enregistrés sont dans le configurateur 3D (connexion requise).", reuseB: 'Ouvrir mes designs',
  },
  it: {
    title: 'Il mio ordine', meta_title: 'Il mio ordine | MOMUTO', meta_descript: 'Segui il tuo ordine MOMUTO: stato, data di consegna, tracking e la tua lista giocatori.',
    h1: 'IL MIO <span class="acc">ORDINE</span>', sub: 'Stato, data di consegna, tracking e la tua lista giocatori, in un unico posto.',
    hi: n => n ? `Ciao ${n}, ecco il tuo ordine.` : 'Ecco il tuo ordine.', ref: 'Riferimento ordine', store: 'Ordine negozio',
    steps: ['Pagato', 'In produzione', 'Spedito', 'Consegnato'], window: 'Consegna stimata', windowFast: 'Consegna stimata · Fast lane',
    track: 'Traccia il pacco', tracking: 'Numero di tracking', design: 'Il tuo design', front: 'Fronte', back: 'Retro',
    roster: 'Lista giocatori', cols: { number: 'N.', name: 'Nome', size: 'Maglia', shorts: 'Pantaloncini', sleeve: 'Maniche', qty: 'Qtà' },
    long: 'Lunghe', short: 'Corte', none: 'Solo maglia', polo: 'Colletto polo', same: 'Stessa taglia',
    pending: 'Stiamo caricando la tua lista. Riprova tra un momento.', totals: (t) => `${t.jerseys} maglie` + (t.shorts != null ? ` · ${t.shorts} pantaloncini` : ''),
    helpH: 'Qualcosa non va?', helpP: 'Scrivici e sistemiamo. Indica cosa vedi e cosa dovrebbe esserci.', helpBtn: 'Scrivici',
    helpSub: r => `Ordine ${r}`, formH: 'Trova il tuo ordine', formP: 'Inserisci il riferimento dell\'ordine e l\'email usata al pagamento.',
    fRef: 'Riferimento ordine', fEmail: 'Email', fBtn: 'Vedi il mio ordine', notFound: 'Ordine non trovato. Controlla riferimento ed email.',
    rate: 'Troppi tentativi. Riprova tra un\'ora.', err: 'Qualcosa è andato storto. Riprova tra un momento.', loading: 'Caricamento…', locale: 'it-IT',
    reuseH: 'Riutilizza questo design', reuseP: 'Vuoi lo stesso kit o una variante? I tuoi design salvati sono nel designer 3D (accedi lì).', reuseB: 'Apri i miei design',
  },
};
T.us = { ...T.en, locale: 'en-US' };
// the page function serialises to the browser; functions can't be JSON-stringified
const serial = (t) => JSON.stringify(t, (k, v) => typeof v === 'function' ? { __fn: v.toString() } : v);

const EXTRA_CSS = `
.ov{max-width:860px;margin:0 auto;padding:2rem 1.25rem 4rem}
.mo-editor-reset .ov{margin-inline:auto}
.ov [hidden]{display:none !important}
.ov .hi{font-size:1.05rem;color:var(--white);margin:0 0 1.2rem}
.ov .refs{display:flex;flex-wrap:wrap;gap:.4rem 1.6rem;color:var(--muted);font-size:.85rem;margin-bottom:1.6rem}
.ov .refs b{color:var(--white);font-weight:600;letter-spacing:.04em}
.ov .card{background:rgba(255,255,255,.03);border:1px solid var(--border);padding:20px 22px;margin-bottom:14px}
.ov h2{font-size:1.5rem;margin:0 0 .8rem;color:var(--white)}
.ov ol.tl{list-style:none !important;margin:0 !important;padding:0 !important;display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.ov ol.tl>li{list-style:none !important;border-top:3px solid var(--border);padding-top:10px;font-size:.78rem;color:var(--dim);line-height:1.35}
.ov ol.tl>li::marker{content:none}
.ov ol.tl>li.done{border-color:var(--red);color:var(--white)}
.ov ol.tl>li.cur{font-weight:700}
.ov ol.tl>li small{display:block;color:var(--muted);font-weight:300;margin-top:2px}
.ov .win{margin-top:1.1rem;font-size:.95rem;color:var(--muted)}
.ov .win b{color:var(--white);font-weight:600}
.ov a.go{display:inline-block;margin-top:.8rem;color:var(--white);border-bottom:1px solid var(--red);text-decoration:none;font-size:.9rem}
.ov .imgs{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.ov .imgs figure{margin:0;flex:1 1 140px;max-width:240px;text-align:center;font-size:.72rem;color:var(--muted)}
.ov .imgs img{width:100%;height:auto;aspect-ratio:5/6;object-fit:contain;background:#fff;border:1px solid var(--border);display:block;margin-bottom:4px}
.ov .tw{overflow-x:auto;border:1px solid var(--border)}
.ov table{width:100%;border-collapse:collapse;font-size:.82rem;min-width:0}
.ov th{font-family:var(--fd);font-weight:400;letter-spacing:.02em;text-transform:uppercase;color:var(--muted);text-align:left;padding:10px 8px;font-size:.8rem;border-bottom:1px solid var(--border)}
.ov td{padding:9px 8px;border-bottom:1px solid var(--border);color:var(--white)}
.ov tr:last-child td{border-bottom:none}
.ov .tot{color:var(--muted);font-size:.85rem;margin-top:.6rem}
.ov .muted{color:var(--muted);font-size:.9rem}
.ov form{display:grid;gap:12px;max-width:420px}
.ov label{font-size:.78rem;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;display:grid;gap:5px}
.ov input{background:#000;border:1px solid rgba(255,255,255,.18);color:#fff;padding:12px 14px;font:inherit;font-size:1rem}
.ov button.btn{cursor:pointer;font-family:inherit}
.ov .msg{color:#f0a19c;font-size:.88rem;margin-top:10px}
@media(max-width:520px){.ov ol.tl{grid-template-columns:1fr 1fr}}
`;

// Browser script. Text only via textContent; only https image URLs (also enforced by the API).
const SCRIPT = `(function(){
var T=JSON.parse(document.getElementById('ov-t').textContent);
['hi','totals','helpSub'].forEach(function(k){var f=T[k];if(f&&f.__fn)T[k]=(new Function('return '+f.__fn))();});
var API=${JSON.stringify(API)},root=document.getElementById('ov');
var q=new URLSearchParams(location.search),ref=(q.get('ref')||'').trim(),k=(q.get('k')||'').trim();
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e;}
function day(s){return s?new Date(s+'T12:00:00Z').toLocaleDateString(T.locale,{day:'numeric',month:'short'}):'';}
function post(b){return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(function(r){return r.json().catch(function(){return{}}).then(function(j){j.status=r.status;return j;});});}
function form(msg){
  root.textContent='';var c=el('div','card');c.appendChild(el('h2',0,T.formH));c.appendChild(el('p','muted',T.formP));
  var f=document.createElement('form'),l1=el('label',0,T.fRef),i1=el('input');i1.value=ref;i1.required=true;i1.autocomplete='off';l1.appendChild(i1);
  var l2=el('label',0,T.fEmail),i2=el('input');i2.type='email';i2.required=true;i2.autocomplete='email';l2.appendChild(i2);
  var b=el('button','btn',T.fBtn);b.type='submit';f.appendChild(l1);f.appendChild(l2);f.appendChild(b);c.appendChild(f);
  if(msg)c.appendChild(el('p','msg',msg));root.appendChild(c);
  f.addEventListener('submit',function(e){e.preventDefault();b.disabled=true;load({ref:i1.value.trim(),email:i2.value.trim()});});
}
function render(o){
  root.textContent='';
  root.appendChild(el('p','hi',T.hi(o.firstName)));
  var r=el('div','refs');var a=el('span',0,T.ref+' ');a.appendChild(el('b',0,o.ref));r.appendChild(a);
  if(o.storeOrderNo){var s=el('span',0,T.store+' ');s.appendChild(el('b',0,o.storeOrderNo));r.appendChild(s);}root.appendChild(r);
  var c=el('div','card'),ol=el('ol','tl');
  o.status.steps.forEach(function(s,i){var li=el('li',(s.done?'done':'')+(s.current?' cur':''),T.steps[i]);if(s.date)li.appendChild(el('small',0,day(s.date)));ol.appendChild(li);});
  c.appendChild(ol);
  var w=o.status.window;if(w&&o.status.current!=='delivered'){var p=el('p','win',(o.fastLane?T.windowFast:T.window)+': ');p.appendChild(el('b',0,day(w.from)+' – '+day(w.to)));c.appendChild(p);}
  if(o.tracking){var t=el('p','win',T.tracking+': ');t.appendChild(el('b',0,o.tracking.number));c.appendChild(t);
    if(o.tracking.url){var g=el('a','go',T.track+' →');g.href=o.tracking.url;g.target='_blank';g.rel='noopener';c.appendChild(g);}}
  root.appendChild(c);
  var imgs=[];o.designs.forEach(function(d){[[d.front,T.front],[d.back,T.back]].forEach(function(x){if(x[0]&&/^https:\\/\\//.test(x[0]))imgs.push(x);});});
  if(imgs.length){var dc=el('div','card');dc.appendChild(el('h2',0,T.design));var w2=el('div','imgs');
    imgs.forEach(function(x,i){var fg=el('figure'),im=document.createElement('img');im.alt=x[1];im.decoding='async';im.width=240;im.height=288;if(i===0){im.fetchPriority='high';}else{im.loading='lazy';}im.src=x[0];fg.appendChild(im);fg.appendChild(el('figcaption',0,x[1]));w2.appendChild(fg);});
    dc.appendChild(w2);root.appendChild(dc);}
  var rc=el('div','card');rc.appendChild(el('h2',0,T.roster));
  var rows=[];o.designs.forEach(function(d){d.players.forEach(function(p){rows.push(p);});});
  if(!rows.length){rc.appendChild(el('p','muted',T.pending));}
  else{
    var has=function(f){return rows.some(f);};
    var cols=[['number',has(function(p){return p.number;})],['name',has(function(p){return p.name;})],['size',true],
      ['shorts',has(function(p){return p.shorts==='size'||p.shorts==='same'||p.shorts==='none';})],['sleeve',has(function(p){return p.sleeve==='long'||p.collar;})],['qty',has(function(p){return p.qty>1;})]]
      .filter(function(c){return c[1];}).map(function(c){return c[0];});
    var wrap=el('div','tw'),tb=document.createElement('table'),hd=document.createElement('tr');
    cols.forEach(function(c){hd.appendChild(el('th',0,T.cols[c]));});tb.appendChild(hd);
    rows.forEach(function(p){var tr=document.createElement('tr');cols.forEach(function(c){var v='';
      if(c==='number')v=p.number;else if(c==='name')v=p.name;else if(c==='size')v=p.size;
      else if(c==='shorts')v=p.shorts==='none'?T.none:(p.shorts==='size'?p.shortsSize:(p.shorts==='same'?p.size:''));
      else if(c==='sleeve')v=(p.sleeve==='long'?T.long:T.short)+(p.collar?' · '+T.polo:'');
      else if(c==='qty')v=String(p.qty);
      tr.appendChild(el('td',0,v));});tb.appendChild(tr);});
    wrap.appendChild(tb);rc.appendChild(wrap);rc.appendChild(el('p','tot',T.totals(o.totals)));}
  root.appendChild(rc);
  var uc=el('div','card');uc.appendChild(el('h2',0,T.reuseH));uc.appendChild(el('p','muted',T.reuseP));
  var ua=el('a','btn2',T.reuseB);ua.href='https://design.momuto.com/userInfo/designs';ua.style.marginLeft='0';ua.style.marginTop='12px';uc.appendChild(ua);root.appendChild(uc);
  var hc=el('div','card');hc.appendChild(el('h2',0,T.helpH));hc.appendChild(el('p','muted',T.helpP));
  var m=el('a','btn2',T.helpBtn);m.style.marginLeft='0';m.style.marginTop='12px';
  m.href='mailto:'+o.helpEmail+'?subject='+encodeURIComponent(T.helpSub(o.ref));hc.appendChild(m);root.appendChild(hc);
}
function load(b){
  root.textContent='';root.appendChild(el('p','muted',T.loading));
  post(b).then(function(j){
    if(j.ok){render(j.order);return;}
    form(j.status===429?T.rate:(j.status===404?(b.email?T.notFound:''):T.err));
  }).catch(function(){form(T.err);});
}
if(ref&&k)load({ref:ref,k:k});else form('');
})();`;

function render(locale) {
  const t = T[locale];
  return `<meta name="robots" content="noindex,nofollow" />
<link rel="preconnect" href="https://design.momuto.com" crossorigin="" /><link rel="preconnect" href="https://momuto-api.vercel.app" crossorigin="" />
<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" /><link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&amp;family=Outfit:wght@300;400;500;600;700;800&amp;display=swap" rel="stylesheet" />
<style>${CSS}${EXTRA_CSS}</style>
<div class="faqpage">
<section class="hero">
<h1 class="h1">${t.h1}</h1>
<p class="sub">${t.sub}</p>
</section>
<div class="ov" id="ov" aria-live="polite"></div>
</div>
<script type="application/json" id="ov-t">${serial(t).replace(/</g, '\\u003c')}</script>
<script>${SCRIPT}</script>
`;
}

function sanity(locale, html) {
  if (!html.includes('Bebas Neue') || !html.includes('Outfit')) throw new Error(`${locale}: fonts`);
  if ((html.match(/<h1\b/g) || []).length !== 1) throw new Error(`${locale}: h1 count`);
  if (!html.includes('noindex')) throw new Error(`${locale}: noindex missing`);
  if (/customer@|orders@/.test(html)) throw new Error(`${locale}: only info@momuto.com may appear`);
  if (T[locale].meta_title.length > 65 || T[locale].meta_descript.length > 160) throw new Error(`${locale}: meta lengths`);
  JSON.parse(html.match(/id="ov-t">([\s\S]*?)<\/script>/)[1]);
  new Function(html.match(/<script>([\s\S]*?)<\/script>/)[1]);   // syntax check
}

for (const locale of LOCALES) {
  const handle = STORES[locale].handle;
  const t = T[locale];
  const html = render(locale);
  sanity(locale, html);
  const file = path.join(ROOT, 'cms', 'pages', locale, `${handle}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let page = {};
  if (fs.existsSync(file)) page = JSON.parse(fs.readFileSync(file, 'utf8'));
  Object.assign(page, { content: html, title: t.title, meta_title: t.meta_title, meta_descript: t.meta_descript, meta_keywords: [], handle });
  fs.writeFileSync(file, JSON.stringify(page, null, 2) + '\n');
  console.log(`✅ ${locale}: ${html.length} chars → cms/pages/${locale}/${handle}.json`);
}
