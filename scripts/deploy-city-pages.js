/**
 * Deploy ES city/local landing pages ("Equipaciones y Camisetas de Fútbol
 * Personalizadas en <Ciudad>"). One reusable template, one config entry per
 * city. Create-if-missing: creates the page on first run, updates thereafter.
 *
 * Why these pages: local intent is a proven ES lever — the Madrid page is a
 * top-3 ES page by clicks. GSC shows local queries like "camisetas de futbol
 * en <ciudad>", "tiendas de camisetas de futbol <ciudad>" and "marcaje de
 * equipaciones <ciudad>"; the FAQ answers them honestly (we're an online
 * maker that ships to the city — NO physical-store / LocalBusiness claim, to
 * keep schema truthful for AI citation).
 *
 * Env:
 *   OEMSAAS_TOKEN_ES  - required (skipped if missing)
 *   CITY_KEYS=barcelona,valencia  - restrict to specific cities (default: all)
 *   DRY_RUN=true      - preview without writing to the CMS
 */

const fs = require('fs');
const path = require('path');

const HOST = 'https://openapi.oemapps.com';
const TOKEN = process.env.OEMSAAS_TOKEN_ES;
const LABEL = 'es.momuto.com';
const DRY_RUN = process.env.DRY_RUN === 'true';

const CONFIGURATOR = 'https://design.momuto.com/3d-configurator/configurator.html?userId=userIdUrl&amp;configId=ypi9qc1z&amp;suitName=mamuto3suit1&amp;lang=es&amp;langguage=es';

// Real MOMUTO teams (from pages/equipos-momuto) used as honest social proof.
const T = {
  mango:   { img: 'https://cdn.staticsoe.com/uploads/52561/cart/resources/20251121/dd28e60057b6b0b9917d329a19e3b9da.jpg', name: 'Mango CF', loc: 'Madrid · Madrid Fútbol 7' },
  astra:   { img: 'https://cdn.staticsoe.com/uploads/52561/cart/resources/20251121/d9088919fcf1cfa3c9ce49a5e6fd45ed.jpg', name: 'Astra Rhei', loc: 'Vizcaya · Fútbol 7' },
  guanche: { img: 'https://cdn.staticsoe.com/uploads/52561/cart/resources/20251121/2b9ec9a1ce27ace175d313491e048486.jpg', name: 'Atlético Guanche', loc: 'Las Palmas · Superliga LPGC' },
  naranja: { img: 'https://cdn.staticsoe.com/uploads/52561/cart/resources/20251202/7ff8ff86e2e70bfea0465eac372339aa.webp', name: 'Naranja Mecánica FC', loc: 'Zaragoza · MLA Sport' },
  alcarajo:{ img: 'https://cdn.staticsoe.com/pics/1ab6bb594575da8b31fed6b65fe8bf3837bc24e8498b1ef31fe3a0de4d00fdcd.jpg', name: 'Al-Carajo', loc: 'Madrid · ETSII' },
  elche:   { img: 'https://cdn.staticsoe.com/uploads/52561/cart/resources/20251121/66d7951f787950758d0e61bb08d85767.jpg', name: 'Elche Koslovaco', loc: 'Las Palmas · Superliga LPGC' },
};
// A representative national mix for cities where we don't yet have a local team.
const GENERAL = [T.mango, T.astra, T.guanche, T.naranja];

const CITIES = {
  barcelona: {
    handle: 'camisetas-futbol-personalizadas-barcelona',
    city: 'Barcelona', region: 'toda Cataluña',
    teams: GENERAL,
    localLine: '',
    meta_keywords: ['camisetas de futbol personalizadas barcelona','equipaciones de futbol barcelona','tiendas de camisetas de futbol barcelona','marcaje de equipaciones barcelona','camisetas de futbol en barcelona','MOMUTO'],
  },
  valencia: {
    handle: 'camisetas-futbol-personalizadas-valencia',
    city: 'Valencia', region: 'toda la Comunidad Valenciana',
    teams: GENERAL,
    localLine: '',
    meta_keywords: ['camisetas de futbol personalizadas valencia','equipaciones de futbol valencia','tiendas de camisetas de futbol valencia','marcaje de equipaciones valencia','camisetas de futbol en valencia','MOMUTO'],
  },
  sevilla: {
    handle: 'camisetas-futbol-personalizadas-sevilla',
    city: 'Sevilla', region: 'toda Andalucía',
    teams: GENERAL,
    localLine: '',
    meta_keywords: ['camisetas de futbol personalizadas sevilla','equipaciones de futbol sevilla','tiendas de camisetas de futbol sevilla','marcaje de equipaciones sevilla','camisetas de futbol en sevilla','MOMUTO'],
  },
  bilbao: {
    handle: 'camisetas-futbol-personalizadas-bilbao',
    city: 'Bilbao', region: 'toda Vizcaya',
    teams: [T.astra, T.guanche, T.mango, T.naranja],
    localLine: 'Equipos como <strong>Astra Rhei</strong> (Vizcaya) ya visten MOMUTO.',
    meta_keywords: ['camisetas de futbol personalizadas bilbao','equipaciones de futbol bilbao','equipaciones de futbol vizcaya','tiendas de camisetas de futbol bilbao','marcaje de equipaciones bilbao','MOMUTO'],
  },
};

function proofCards(teams) {
  return teams.map(t => `<figure class="sj-proof"><img src="${t.img}" alt="Equipación de fútbol personalizada MOMUTO — ${t.name}, ${t.loc}" loading="lazy"><figcaption class="cap"><span class="t">${t.name}</span><span class="l">${t.loc}</span></figcaption></figure>`).join('\n');
}

function render(c) {
  const { city, region } = c;
  const faq = [
    [`¿Hacéis camisetas de fútbol personalizadas en ${city}?`, `Sí. MOMUTO diseña y fabrica equipaciones y camisetas de fútbol personalizadas para equipos, peñas, clubes y academias de ${city} y ${region}. El pedido es online: diseñas tu equipación y te la enviamos a domicilio en 25-30 días, sin pedido mínimo.`],
    [`¿Tenéis tienda física en ${city}?`, `No hace falta. MOMUTO trabaja online para todo ${city}: diseñas en el configurador 3D o eliges un diseño Ready-to-Play, lo ves al instante y recibes el pedido en casa o en el club en 25-30 días. Así el precio es más ajustado que en tienda y el diseño no tiene límites.`],
    [`¿Hacéis marcaje de nombres, dorsales y sponsors?`, `Sí, incluido. Todo se imprime por sublimación total sobre el tejido —nombres, dorsales, escudo y sponsors ilimitados—, en colores ilimitados y sin que se cuartee. No es vinilo pegado: forma parte de la tela.`],
    [`¿Cuánto tarda el envío a ${city}?`, `La entrega es de 25-30 días desde que apruebas el diseño (producción + envío directo de fábrica). Envío gratuito en pedidos superiores a 50 €.`],
    [`¿Hay pedido mínimo?`, `No. Puedes pedir una sola camiseta o equipar a todo el club. El precio por camiseta baja con la cantidad, desde 21,90 € a 10 unidades hasta 16,90 € a partir de 100.`],
    [`¿Cuánto cuesta una equipación personalizada?`, `Desde 38,90 € la camiseta suelta y desde 21,90 € por camiseta a partir de 10 unidades (equipación completa camiseta + pantalón desde 26,90 € por jugador). El configurador 3D y la colección Ready-to-Play son gratis; el diseño a medida con un diseñador lleva 15 € para empezar, completamente descontados en pedidos de 5+ camisetas.`],
  ];
  const faqLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '') } })),
  };
  const webLd = {
    '@context': 'https://schema.org', '@type': 'WebPage',
    name: `Equipaciones y Camisetas de Fútbol Personalizadas en ${city} | MOMUTO`,
    description: `Equipaciones y camisetas de fútbol personalizadas para equipos de ${city} y ${region}. Diseño 3D + IA, sin pedido mínimo, sublimación total y entrega en 25-30 días.`,
    url: `https://${LABEL}/pages/${c.handle}`, inLanguage: 'es-ES',
    publisher: { '@type': 'Organization', name: 'MOMUTO', url: `https://${LABEL}` },
  };

  return `<script type="application/ld+json">
${JSON.stringify(webLd, null, 2)}
</script>
<script type="application/ld+json">
${JSON.stringify(faqLd, null, 2)}
</script>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
<style>
html, body { background-color: #0a0a0a !important; color: #f5f5f5; }
h1.title, .title, .page-title { display: none !important; }
.container_wrapper, .page-width, .container, .main-content { max-width:100%!important; width:100%!important; padding:0!important; margin:0!important; overflow:visible!important; }
*, *::before, *::after { box-sizing: border-box; }
:root { --mg-bg:#0a0a0a; --mg-panel:#111; --mg-border:rgba(255,255,255,0.06); --mg-border-hover:rgba(255,255,255,0.12); --mg-white:#f5f5f5; --mg-muted:#a1a1aa; --mg-dim:#71717a; --mg-red:#c8352e; --mg-red-hover:#e04038; --font-display:'Bebas Neue',sans-serif; --font-body:'Outfit',sans-serif; }
.sj-page { font-family:var(--font-body); background:var(--mg-bg); color:var(--mg-white); width:100%; padding-bottom:80px; }
.sj-container { max-width:1100px; margin:0 auto; padding:0 40px; }
.sj-hero { background:var(--mg-bg); border-bottom:1px solid var(--mg-border); padding:64px 40px 56px; display:flex; flex-direction:column; align-items:center; text-align:center; }
.sj-badge { display:inline-block; font-size:0.6rem; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:var(--mg-red); background:rgba(200,53,46,0.1); border:1px solid rgba(200,53,46,0.15); padding:6px 14px; margin-bottom:20px; }
.sj-hero h1 { font-family:var(--font-display); font-size:clamp(2.2rem,6vw,4rem); font-weight:400; text-transform:uppercase; letter-spacing:0.03em; line-height:0.98; color:var(--mg-white); margin:0 auto 18px; max-width:20ch; }
.sj-hero h1 .hl { color:var(--mg-red); }
.sj-lede { font-size:1.05rem; font-weight:300; color:var(--mg-muted); line-height:1.7; max-width:64ch; margin:0 auto 28px; }
.sj-cta-row { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; }
.sj-btn { display:inline-block; background:var(--mg-red); color:#fff; font-weight:800; font-size:0.82rem; text-transform:uppercase; letter-spacing:0.1em; padding:16px 34px; text-decoration:none; border:1px solid var(--mg-red); transition:background 0.2s ease; }
.sj-btn:hover { background:var(--mg-red-hover); border-color:var(--mg-red-hover); }
.sj-btn.secondary { background:transparent; color:var(--mg-white); border:1px solid var(--mg-border-hover); }
.sj-trust { font-size:0.8rem; color:var(--mg-dim); margin-top:18px; letter-spacing:0.04em; }
.sj-trust a { color:var(--mg-muted); text-decoration:underline; }
.sj-bluf { padding:40px 0 0; }
.sj-bluf p { font-size:1rem; font-weight:300; color:var(--mg-muted); line-height:1.8; margin-bottom:1.1em; }
.sj-bluf p strong { color:var(--mg-white); font-weight:600; }
.sj-facts { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:14px; margin:36px 0 0; }
.sj-fact { background:rgba(255,255,255,0.03); border:1px solid var(--mg-border); padding:20px; }
.sj-fact .k { font-family:var(--font-display); font-size:1.7rem; color:var(--mg-white); line-height:1; letter-spacing:0.02em; }
.sj-fact .l { font-size:0.78rem; color:var(--mg-muted); margin-top:8px; line-height:1.5; }
.sj-h2 { font-family:var(--font-display); font-size:clamp(1.6rem,3vw,2.2rem); font-weight:400; text-transform:uppercase; letter-spacing:0.04em; color:var(--mg-white); margin:60px 0 18px 0; line-height:1; padding-left:16px; border-left:3px solid var(--mg-red); }
.sj-p { font-size:0.95rem; font-weight:300; color:var(--mg-muted); line-height:1.8; margin-bottom:1.2em; }
.sj-p strong { color:var(--mg-white); font-weight:600; }
.sj-p a { color:var(--mg-white); text-decoration:underline; }
.sj-proof-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:14px; margin:1.5em 0; }
.sj-proof { position:relative; aspect-ratio:4/5; overflow:hidden; border:1px solid var(--mg-border); margin:0; }
.sj-proof img { width:100%; height:100%; object-fit:cover; }
.sj-proof .cap { position:absolute; bottom:0; left:0; right:0; background:linear-gradient(transparent,rgba(0,0,0,0.9)); padding:16px 14px 12px; display:flex; flex-direction:column; }
.sj-proof .cap .t { font-family:var(--font-display); font-size:1.15rem; letter-spacing:0.02em; color:#fff; line-height:1.05; }
.sj-proof .cap .l { font-size:0.72rem; color:var(--mg-muted); margin-top:3px; }
.sj-table-wrap { overflow-x:auto; margin:1.5em 0; border:1px solid var(--mg-border); }
.sj-price { width:100%; border-collapse:collapse; font-size:0.88rem; background:#111; }
.sj-price thead tr { background:#fff; }
.sj-price th { color:#111; font-weight:700; text-transform:uppercase; font-size:0.65rem; letter-spacing:0.1em; padding:14px 18px; text-align:left; }
.sj-price td { padding:13px 18px; border-bottom:1px solid var(--mg-border); color:var(--mg-muted); }
.sj-price tr:last-child td { border-bottom:none; }
.sj-price .tot { font-weight:700; color:var(--mg-white); }
.sj-price .best td { background:rgba(200,53,46,0.06); }
.sj-uc-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px; margin:1.5em 0; }
.sj-uc { background:var(--mg-panel); border:1px solid var(--mg-border); padding:24px; }
.sj-uc i { color:var(--mg-red); font-size:1.2rem; margin-bottom:12px; display:block; }
.sj-uc h3 { font-weight:700; font-size:0.95rem; color:var(--mg-white); margin:0 0 8px; }
.sj-uc p { font-size:0.84rem; color:var(--mg-muted); line-height:1.6; margin:0; }
.sj-faq { margin:1.5em 0; }
.sj-faq details { border:1px solid var(--mg-border); border-left:3px solid var(--mg-red); background:var(--mg-panel); margin-bottom:10px; padding:0 22px; }
.sj-faq summary { font-weight:600; font-size:0.95rem; color:var(--mg-white); padding:18px 0; cursor:pointer; list-style:none; }
.sj-faq summary::-webkit-details-marker { display:none; }
.sj-faq summary::after { content:"+"; float:right; color:var(--mg-red); font-weight:700; }
.sj-faq details[open] summary::after { content:"−"; }
.sj-faq details p { font-size:0.9rem; color:var(--mg-muted); line-height:1.75; margin:0 0 18px; font-weight:300; }
.sj-note { font-size:0.75rem; color:var(--mg-dim); margin-top:10px; font-weight:300; }
.sj-cta-block { background:var(--mg-red); padding:60px 40px; text-align:center; margin:64px 0 0; }
.sj-cta-block h2 { font-family:var(--font-display); font-size:clamp(1.8rem,4vw,2.8rem); font-weight:400; text-transform:uppercase; letter-spacing:0.04em; color:#fff; line-height:1; margin:0 0 12px; }
.sj-cta-block p { color:rgba(255,255,255,0.85); font-size:0.95rem; font-weight:300; margin-bottom:26px; }
.sj-cta-block .sj-btn { background:#fff; color:#000; border-color:#fff; }
.sj-cta-block .sj-btn.secondary { background:transparent; color:#fff; border-color:rgba(255,255,255,0.5); }
@media (max-width:768px){ .sj-container{padding:0 20px;} .sj-hero{padding:44px 20px 40px;} .sj-cta-block{padding:40px 20px;} .sj-price{font-size:0.78rem;} .sj-price th,.sj-price td{padding:10px 12px;} }
</style>
<div class="sj-page">
<div class="sj-hero">
<div class="sj-badge">Equipaciones personalizadas · ${city}</div>
<h1>Equipaciones de F&uacute;tbol Personalizadas en <span class="hl">${city}</span></h1>
<p class="sj-lede">La mayor&iacute;a de los equipos de ${city} pasan semanas decidiendo el dise&ntilde;o &mdash; y muchos llegan tarde a la temporada. Con MOMUTO lo dise&ntilde;&aacute;is en 3D y lo ve&iacute;s al instante, o eleg&iacute;s un dise&ntilde;o Ready-to-Play listo para personalizar. Sin pedido m&iacute;nimo y con entrega en 25-30 d&iacute;as.</p>
<div class="sj-cta-row"><a href="${CONFIGURATOR}" class="sj-btn">Dise&ntilde;ar en 3D — gratis</a> <a href="/pages/solicitud-de-diseno-personalizado" class="sj-btn secondary">Empezar mi dise&ntilde;o</a></div>
<p class="sj-trust">Valorado 4,4/5 en <a href="https://es.trustpilot.com/review/momuto.com" rel="nofollow">Trustpilot</a> &mdash; la confianza de m&aacute;s de 150 clubes.</p>
</div>
<div class="sj-container">
<div class="sj-bluf">
<p>MOMUTO fabrica <strong>equipaciones y camisetas de f&uacute;tbol personalizadas</strong> para clubes, academias, equipos amateur y pe&ntilde;as de <strong>${city}</strong> y ${region}. El pedido es online y directo de f&aacute;brica: dise&ntilde;&aacute;is en el <strong>configurador 3D</strong> (o eleg&iacute;s un dise&ntilde;o <strong>Ready-to-Play</strong>), y recib&iacute;s la equipaci&oacute;n en <strong>25-30 d&iacute;as</strong>. Sublimaci&oacute;n total sobre tejido de poli&eacute;ster-elastano, con <strong>nombre, dorsal, escudo y sponsors incluidos</strong>, <strong>sin pedido m&iacute;nimo</strong> (1 camiseta o el equipo entero) y con tallas de ni&ntilde;o a adulto.${c.localLine ? ' ' + c.localLine : ''}</p>
<div class="sj-facts">
<div class="sj-fact"><div class="k">Sin m&iacute;nimo</div><div class="l">Pedid 1 camiseta o el equipo entero</div></div>
<div class="sj-fact"><div class="k">3D + IA</div><div class="l">Ved la equipaci&oacute;n al instante, antes de pedir</div></div>
<div class="sj-fact"><div class="k">25-30 d&iacute;as</div><div class="l">Env&iacute;o a ${city} y ${region}, directo de f&aacute;brica</div></div>
<div class="sj-fact"><div class="k">Marcaje incluido</div><div class="l">Nombres, dorsales, escudo y sponsors por sublimaci&oacute;n</div></div>
</div>
</div>
<!-- PRUEBA REAL -->
<h2 class="sj-h2">Equipos reales que visten MOMUTO</h2>
<p class="sj-p">Equipos reales, camisetas reales &mdash; de ligas locales y de f&uacute;tbol 7 a torneos internacionales. Mira m&aacute;s en <a href="/pages/equipos-momuto">equipos que visten MOMUTO</a>.</p>
<div class="sj-proof-grid">
${proofCards(c.teams)}
</div>
<!-- PRECIOS -->
<h2 class="sj-h2">Precios &mdash; dise&ntilde;a gratis en 3D</h2>
<p class="sj-p">Precios por volumen, sin pedido m&iacute;nimo y sin costes ocultos. El configurador 3D y la colecci&oacute;n <strong>Ready-to-Play</strong> son gratis; el dise&ntilde;o a medida con un dise&ntilde;ador lleva <strong>15 € para empezar, completamente descontados en pedidos de 5+ camisetas</strong>.</p>
<div class="sj-table-wrap">
<table class="sj-price">
<thead><tr><th>Cantidad</th><th>Camiseta</th><th>Pantal&oacute;n</th><th>Equipaci&oacute;n completa</th></tr></thead>
<tbody>
<tr><td>1 unidad</td><td>38,90 €</td><td>17,90 €</td><td class="tot">56,80 €</td></tr>
<tr><td>5 a 9 uds.</td><td>26,90 €</td><td>11,90 €</td><td class="tot">38,80 € / ud.</td></tr>
<tr class="best"><td>10 a 19 uds.</td><td>21,90 €</td><td>6,00 €</td><td class="tot">26,90 € / ud.</td></tr>
<tr><td>20 a 49 uds.</td><td>18,90 €</td><td>6,00 €</td><td class="tot">24,90 € / ud.</td></tr>
<tr><td>100+ uds.</td><td>16,90 €</td><td>5,00 €</td><td class="tot">21,90 € / ud.</td></tr>
</tbody>
</table>
</div>
<p class="sj-note">Env&iacute;o gratuito en pedidos superiores a 50 €. Tejido poli&eacute;ster-elastano de serie.</p>
<!-- COMO -->
<h2 class="sj-h2">C&oacute;mo dise&ntilde;ar la vuestra</h2>
<div class="sj-uc-grid">
<div class="sj-uc"><i class="fas fa-cube"></i><h3>Configurador 3D — gratis</h3><p>Eleg&iacute;s plantilla, patrones, colores y sponsors ilimitados, y ve&iacute;s la equipaci&oacute;n en 3D al instante antes de pedir.</p></div>
<div class="sj-uc"><i class="fas fa-bolt"></i><h3>Ready-to-Play — −10%</h3><p>Dise&ntilde;os de &eacute;xito listos para personalizar: pon&eacute;is vuestros colores y escudo y ped&iacute;s en minutos, sin fase de dise&ntilde;o.</p></div>
<div class="sj-uc"><i class="fas fa-pen-ruler"></i><h3>Dise&ntilde;o a medida</h3><p>Un dise&ntilde;ador crea vuestra equipaci&oacute;n desde cero o adapta vuestra idea (incluso un concepto de IA). 15 € para empezar, descontados en pedidos de 5+.</p></div>
</div>
<!-- FAQ -->
<h2 class="sj-h2">Preguntas frecuentes &mdash; ${city}</h2>
<div class="sj-faq">
${faq.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('\n')}
</div>
<p class="sj-p">Empezad por la <a href="/pages/equipaciones-futbol-personalizadas">p&aacute;gina de equipaciones personalizadas</a>, mirad la <a href="/pages/galeria-equipaciones-personalizadas">galer&iacute;a de dise&ntilde;os</a>, los <a href="/pages/equipos-momuto">equipos reales que visten MOMUTO</a> o, si sois un club, las <a href="/pages/equipaciones-para-clubes-academias">equipaciones para clubes y academias</a>.</p>
</div>
<div class="sj-cta-block">
<h2>Vuestra equipaci&oacute;n en ${city}</h2>
<p>Dise&ntilde;adla en 3D gratis o eleg&iacute;d un dise&ntilde;o Ready-to-Play (−10%). Sin pedido m&iacute;nimo, entrega en 25-30 d&iacute;as.</p>
<a href="${CONFIGURATOR}" class="sj-btn">Dise&ntilde;ar en 3D</a> <a href="/pages/solicitud-de-diseno-personalizado" class="sj-btn secondary">Empezar mi dise&ntilde;o</a>
<p class="sj-note" style="color:rgba(255,255,255,0.75);">Sin pedido m&iacute;nimo · Marcaje incluido · Tallas ni&ntilde;o a adulto · Entrega 25-30 d&iacute;as</p>
</div>
</div>`;
}

function sanity(html, key) {
  if (!html.includes('Bebas Neue') || !html.includes('Outfit')) throw new Error(`${key}: missing fonts`);
  const h1 = (html.match(/<h1\b/g) || []).length;
  if (h1 !== 1) throw new Error(`${key}: must have exactly 1 <h1> (found ${h1})`);
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g; let m;
  while ((m = re.exec(html))) JSON.parse(m[1]);
}

async function findByHandle(handle) {
  const res = await fetch(`${HOST}/pages?handle=${handle}`, { headers: { token: TOKEN } });
  const json = await res.json();
  if (!res.ok || json.code !== 0) return null;
  const list = json.data?.list || json.data || [];
  return Array.isArray(list) ? (list.find(p => p.handle === handle) || null) : null;
}

function payload(c, html) {
  return {
    is_default: 0,
    title: `Equipaciones y Camisetas de Fútbol Personalizadas en ${c.city} | MOMUTO`,
    content: html,
    meta_title: `Camisetas de Fútbol Personalizadas en ${c.city} | Equipaciones | MOMUTO`,
    meta_descript: `Equipaciones y camisetas de fútbol personalizadas para equipos de ${c.city} y ${c.region}. Diseño 3D + IA, sin pedido mínimo, sublimación total, marcaje incluido y entrega en 25-30 días.`,
    meta_keywords: c.meta_keywords,
    handle: c.handle,
  };
}

async function deployCity(key) {
  const c = CITIES[key];
  if (!c) throw new Error(`Unknown city: ${key}`);
  const html = render(c);
  sanity(html, key);
  if (DRY_RUN) { console.log(`  DRY_RUN — ${c.handle}: renders OK (${html.length} chars, sanity passed)`); return; }
  const existing = await findByHandle(c.handle);
  const method = existing ? 'PUT' : 'POST';
  const url = existing ? `${HOST}/pages/${existing.id}` : `${HOST}/pages`;
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', token: TOKEN }, body: JSON.stringify(payload(c, html)) });
  const json = await res.json();
  if (!res.ok || json.code !== 0) throw new Error(`${method} ${c.handle} failed: ${JSON.stringify(json)}`);
  console.log(`✓ ${existing ? 'Updated' : 'Created'} ${c.handle} → https://${LABEL}/pages/${c.handle}`);
}

async function main() {
  console.log(`Dry run: ${DRY_RUN}`);
  if (!TOKEN) { console.warn('⚠️  No OEMSAAS_TOKEN_ES — skipping'); return; }
  const keys = (process.env.CITY_KEYS || Object.keys(CITIES).join(',')).split(',').map(s => s.trim()).filter(Boolean);
  const errors = [];
  for (const k of keys) {
    try { await deployCity(k); } catch (e) { console.error(`❌ ${e.message}`); errors.push(k); }
  }
  if (errors.length) { console.error(`\n${errors.length} error(s): ${errors.join(', ')}`); process.exit(1); }
  console.log('\n✓ Done');
}

main();
