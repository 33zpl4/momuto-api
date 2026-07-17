/**
 * Build + deploy the ES local city pages ("camisetas de fútbol personalizadas
 * en <ciudad>") from per-city data + one shared template.
 *
 *   Data:     cms/city-pages/es/cities.json  (ONLY what is genuinely local)
 *   Template: buildPage() below — hero, facts, RTP+3D block, pricing, shared
 *             trust blocks and shared FAQ live here, single-sourced.
 *
 * The copy reflects the post-deposit model: RTP models + 3D designer are the
 * free self-serve paths; the professional design service carries a 15 € señal
 * that is discounted from the order. Do NOT reintroduce "diseño gratis".
 *
 * Env:
 *   OEMSAAS_TOKEN_ES  - required to deploy (not needed for OUTDIR builds)
 *   DRY_RUN=true      - preview only (default true; set 'false' to write)
 *   CITY=<slug>       - only this city (e.g. CITY=madrid); default all
 *   OUTDIR=<path>     - also write built HTML per city (local preview/QA)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HOST = 'https://openapi.oemapps.com';
const TOKEN = process.env.OEMSAAS_TOKEN_ES;
const DRY_RUN = process.env.DRY_RUN !== 'false';
const ONLY = (process.env.CITY || '').trim();
const OUTDIR = (process.env.OUTDIR || '').trim();

const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'cms/city-pages/es/cities.json'), 'utf8'));
const RTP = JSON.parse(fs.readFileSync(path.join(ROOT, 'ready-to-play/config.json'), 'utf8'));

const RTP_PATH = RTP.collection_path.es;               // /pages/coleccion-ready-to-play
const D3_URL = 'https://design.momuto.com/3d-configurator/configurator.html?userId=userIdUrl&amp;configId=ypi9qc1z&amp;suitName=mamuto3suit1&amp;lang=es&amp;langguage=es';
const PRICE = RTP.pricing; // jersey_current 19.70, kit_current 24.20, min_quantity 10

// ---------------------------------------------------------------- shared CSS
// Identical design system to pages/equipaciones-futbol-personalizadas (sj-*).
const CSS = fs.readFileSync(path.join(ROOT, 'pages/equipaciones-futbol-personalizadas'), 'utf8')
  .match(/<style>[\s\S]*?<\/style>/)[0];

const FONTS = '<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&amp;family=Outfit:wght@300;400;500;600;700;800&amp;display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">';

// ---------------------------------------------------------- shared FAQ items
// (city FAQ = these + city.faq_local; also emitted as FAQPage JSON-LD)
const FAQ_SHARED = [
  { q: '¿Hay pedido mínimo?', a: 'No. MOMUTO no exige pedido mínimo — pedid una sola camiseta o equipad a todo el club. El precio por unidad baja con la cantidad, sin recargos por mínimos.' },
  { q: '¿Puedo ver la camiseta antes de pedirla?', a: 'Sí, siempre. Los modelos Ready-to-Play se personalizan en el configurador 3D y los veis girar en tiempo real antes de pedir. Y todo pedido pasa además por nuestros diseñadores, que revisan y preparan el arte final para imprenta.' },
  { q: '¿El diseño profesional es gratis?', a: 'Los caminos exprés sí: elegir un modelo Ready-to-Play o diseñar desde cero en el configurador 3D no cuesta nada hasta que pedís. Si queréis que nuestros diseñadores creen un diseño a medida para vosotros, pedimos una señal de 15 €, descontada íntegra del pedido a partir de 5 camisetas.' },
  { q: '¿Puedo añadir el escudo y los sponsors?', a: 'Sí. Subís vuestro escudo y logos: la sublimación total los imprime en la tela, en colores ilimitados, sin límite de tamaño y sin que se cuarteen.' },
  { q: '¿Cada jugador puede llevar nombre y dorsal distintos?', a: 'Sí, sin coste adicional. La personalización forma parte de la impresión, no es un extra.' },
  { q: '¿Hacéis tallas de niño y de adulto?', a: 'Sí, el mismo diseño en todas las categorías, desde el fútbol base hasta el primer equipo.' }
];

const esc = s => s.replace(/&(?!amp;|lt;|gt;|quot;|#)/g, '&amp;');
const stripTags = s => s.replace(/<[^>]+>/g, '');

// -------------------------------------------------------------- page builder
function buildPage(c) {
  const url = `https://es.momuto.com/pages/${c.handle}`;
  const faqs = FAQ_SHARED.concat(c.faq_local);
  const byslug = Object.fromEntries(DATA.cities.map(x => [x.slug, x]));
  const sibs = c.siblings.map(s => byslug[s]).filter(Boolean);

  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebPage', name: c.meta_title, description: c.meta_descript, url, inLanguage: 'es-ES',
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['.sj-bluf', '.sj-faq'] },
      publisher: { '@type': 'Organization', name: 'MOMUTO', url: 'https://es.momuto.com' } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://es.momuto.com/' },
      { '@type': 'ListItem', position: 2, name: 'Equipaciones de fútbol personalizadas', item: 'https://es.momuto.com/pages/equipaciones-futbol-personalizadas' },
      { '@type': 'ListItem', position: 3, name: `Camisetas de fútbol personalizadas ${c.en_ciudad}`, item: url } ] },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(f => (
      { '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: stripTags(f.a) } })) },
    { '@context': 'https://schema.org', '@type': 'Service', name: `Camisetas de fútbol personalizadas ${c.en_ciudad}`,
      serviceType: 'Camisetas y equipaciones de fútbol personalizadas', provider: { '@type': 'Organization', name: 'MOMUTO', url: 'https://es.momuto.com' },
      areaServed: { '@type': 'AdministrativeArea', name: `${c.name} (${c.region})` } }
  ].map(o => `<script type="application/ld+json">\n${JSON.stringify(o, null, 1)}\n</script>`).join('\n');

  const proof = c.proof ? `
<div class="sj-ai">
<span class="tag">${c.proof.tag}</span>
<h3>${c.proof.title}</h3>
<p>${c.proof.text}</p>
</div>` : '';

  return `${ld}
${FONTS}
${CSS}
<div class="sj-page">
<div class="sj-hero">
<div class="sj-badge">Equipos de ${c.name} · sin pedido mínimo</div>
<h1>Camisetas de Fútbol <span class="hl">Personalizadas</span> ${c.en_ciudad}</h1>
<p class="sj-lede">Equipaciones a medida para los equipos de ${c.name}: elegid un modelo Ready-to-Play y ponedlo a vuestros colores en 3D, diseñad desde cero en el configurador, o encargádselo a nuestros diseñadores. Sin pedido mínimo y con entrega puerta a puerta ${c.en_ciudad}.</p>
<div class="sj-cta-row"><a href="${RTP_PATH}" class="sj-btn">Ver modelos Ready-to-Play</a> <a href="${D3_URL}" class="sj-btn secondary">Diseñar en 3D</a></div>
<p class="sj-trust">Valorado 4,5/5 en <a href="https://es.trustpilot.com/review/momuto.com" rel="nofollow">Trustpilot</a> — la confianza de más de 150 clubes.</p>
</div>
<div class="sj-container">
<div class="sj-bluf">
<p>${c.intro[0]}</p>
<p>${c.intro[1]}</p>
<div class="sj-facts">
<div class="sj-fact"><div class="k">Sin mínimo</div><div class="l">Pedid 1 camiseta o el equipo entero, sin recargos</div></div>
<div class="sj-fact"><div class="k">3D al instante</div><div class="l">Ved la equipación girar en tiempo real, antes de pedir</div></div>
<div class="sj-fact"><div class="k">−10 % RTP</div><div class="l">Modelos Ready-to-Play desde ${String(PRICE.jersey_current).replace('.', ',')} €/ud (10+)</div></div>
<div class="sj-fact"><div class="k">Puerta a puerta</div><div class="l">Entrega ${c.en_ciudad} en 25-30 días desde el OK al diseño</div></div>
</div>
</div>
${proof}
<h2 class="sj-h2">El fútbol de ${c.name}, equipado a medida</h2>
<div class="sj-uc-grid">
${c.scene.map(s => `<div class="sj-uc"><i class="fas ${s.icon}"></i><h3>${s.title}</h3><p>${s.text}</p></div>`).join('\n')}
</div>
<!-- RTP + 3D -->
<div class="sj-ai">
<span class="tag">La vía rápida</span>
<h3>Modelos listos para jugar, a los colores de tu equipo</h3>
<p>Modelos diseñados por nuestro estudio — una colección que no deja de crecer — listos para personalizar: cambiadles los colores con el juego de colores de la página del modelo, seguid en el <strong>configurador 3D</strong> con dorsales, nombres y vuestro escudo, y pedid al momento — sin esperar maqueta. ${c.color_note}</p>
<p><strong>Camiseta desde ${String(PRICE.jersey_current).replace('.', ',')} €/ud y equipación completa desde ${String(PRICE.kit_current).replace('.', ',')} €/ud</strong> a partir de ${PRICE.min_quantity} unidades, con el −${PRICE.discount_pct} % Ready-to-Play ya aplicado. Y si preferís algo 100 % vuestro, nuestros diseñadores lo crean a medida: señal de 15 €, descontada íntegra del pedido a partir de 5 camisetas.</p>
<div class="sj-cta-row" style="justify-content:flex-start;"><a href="${RTP_PATH}" class="sj-btn">Ver la colección</a> <a href="/pages/solicitud-de-diseno-personalizado" class="sj-btn secondary">Encargar un diseño a medida</a></div>
</div>
<!-- PRECIOS -->
<h2 class="sj-h2">Precios claros, sin mínimos</h2>
<p class="sj-p">Precios por volumen para diseños propios del configurador 3D o de nuestro estudio. Los <a href="${RTP_PATH}">modelos Ready-to-Play</a> llevan además un −${PRICE.discount_pct} % permanente.</p>
<div class="sj-table-wrap">
<table class="sj-price">
<thead><tr><th>Cantidad</th><th>Camiseta</th><th>Pantalón</th><th>Equipación completa</th></tr></thead>
<tbody>
<tr><td>1 unidad</td><td>38,90 €</td><td>17,90 €</td><td class="tot">56,80 €</td></tr>
<tr><td>5 a 9 uds.</td><td>26,90 €</td><td>11,90 €</td><td class="tot">38,80 € / ud.</td></tr>
<tr class="best"><td>10 a 19 uds.</td><td>21,90 €</td><td>6,00 €</td><td class="tot">26,90 € / ud.</td></tr>
<tr><td>20 a 49 uds.</td><td>18,90 €</td><td>6,00 €</td><td class="tot">24,90 € / ud.</td></tr>
<tr><td>100+ uds.</td><td>16,90 €</td><td>5,00 €</td><td class="tot">21,90 € / ud.</td></tr>
</tbody>
</table>
</div>
<p class="sj-note">Tejido poliéster-elastano de serie. Nombre y dorsal de cada jugador incluidos. Todo pedido lo revisa un diseñador antes de imprenta.</p>
<!-- FAQ -->
<h2 class="sj-h2">Preguntas frecuentes</h2>
<div class="sj-faq">
${faqs.map(f => `<details><summary>${f.q}</summary><p>${f.a}</p></details>`).join('\n')}
</div>
<p class="sj-p">¿Quieres ver más? Mira la <a href="/pages/equipaciones-futbol-personalizadas">página de equipaciones personalizadas</a>, los <a href="/pages/equipos-momuto">equipos que ya visten MOMUTO</a> y la <a href="/pages/galeria-equipaciones-personalizadas">galería de diseños</a>. También servimos a equipos de ${sibs.map(s => `<a href="/pages/${s.handle}">${s.name}</a>`).join(', ')}.</p>
</div>
<div class="sj-cta-block">
<h2>Vestid a vuestro equipo de ${c.name}</h2>
<p>Elegid un modelo Ready-to-Play y ponedlo a vuestros colores, o diseñad el vuestro en 3D — sin compromiso hasta que pedís.</p>
<a href="${RTP_PATH}" class="sj-btn">Ver modelos Ready-to-Play</a> <a href="${D3_URL}" class="sj-btn secondary">Diseñar en 3D</a>
<p class="sj-note">Sin pedido mínimo · Sublimación total · Tallas niño a adulto · Entrega puerta a puerta ${c.en_ciudad}</p>
</div>
</div>`;
}

// ------------------------------------------------------------------- checks
function sanityCheck(c, html) {
  const errs = [];
  if (!html.includes('Bebas Neue') || !html.includes('Outfit')) errs.push('missing house fonts');
  const h1 = (html.match(/<h1\b/g) || []).length;
  if (h1 !== 1) errs.push(`h1 count ${h1}`);
  const cityCount = (html.match(new RegExp(c.name.normalize('NFC'), 'g')) || []).length;
  if (cityCount < 6) errs.push(`city name appears only ${cityCount}x`);
  if (/diseño (siempre )?es gratis|diseño gratis/i.test(html)) errs.push('pre-deposit "diseño gratis" wording detected');
  for (const m of html.matchAll(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/g)) {
    try { JSON.parse(m[1]); } catch (e) { errs.push(`bad JSON-LD: ${e.message}`); }
  }
  if (errs.length) throw new Error(`${c.slug}: ${errs.join(' | ')}`);
}

// -------------------------------------------------------------------- deploy
async function getExisting(handle) {
  const res = await fetch(`${HOST}/pages?handle=${handle}`, { headers: { token: TOKEN } });
  const json = await res.json();
  if (!res.ok || json.code !== 0) return null;
  const pages = json.data?.list || json.data || [];
  return Array.isArray(pages) ? (pages.find(p => p.handle === handle) || null) : null;
}

function pageData(c, content) {
  return { is_default: 0, title: c.meta_title, content, meta_title: c.meta_title,
    meta_keywords: c.keywords, meta_descript: c.meta_descript, handle: c.handle };
}

async function upsert(c, content) {
  const existing = await getExisting(c.handle);
  if (DRY_RUN) { console.log(`  DRY_RUN — would ${existing ? 'update' : 'create'} ${c.handle} (${content.length} chars)`); return; }
  if (existing) {
    // archive the live body before overwriting (one-off recovery net)
    try {
      const dir = path.join(ROOT, 'cms/city-pages/es/archive');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${c.handle}.${Date.now()}.html`), existing.content || '');
    } catch (e) { console.log(`  (archive skipped: ${e.message})`); }
    const res = await fetch(`${HOST}/pages/${existing.id}`, { method: 'PUT',
      headers: { 'Content-Type': 'application/json', token: TOKEN },
      body: JSON.stringify({ ...pageData(c, content), id: existing.id }) });
    const json = await res.json();
    if (!res.ok || json.code !== 0) throw new Error(`PUT ${c.handle}: ${JSON.stringify(json)}`);
    console.log(`  ✓ updated ${c.handle}`);
  } else {
    const res = await fetch(`${HOST}/pages`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', token: TOKEN },
      body: JSON.stringify(pageData(c, content)) });
    const json = await res.json();
    if (!res.ok || json.code !== 0) throw new Error(`POST ${c.handle}: ${JSON.stringify(json)}`);
    console.log(`  ✓ created ${c.handle}`);
  }
  console.log(`    live: https://es.momuto.com/pages/${c.handle}`);
}

(async () => {
  const cities = DATA.cities.filter(c => !ONLY || c.slug === ONLY);
  if (!cities.length) throw new Error(`no city matches CITY=${ONLY}`);
  const titles = new Set();
  for (const c of cities) {
    const html = esc(buildPage(c));
    sanityCheck(c, html);
    if (titles.has(c.meta_title)) throw new Error(`duplicate title: ${c.meta_title}`);
    titles.add(c.meta_title);
    if (OUTDIR) { fs.mkdirSync(OUTDIR, { recursive: true }); fs.writeFileSync(path.join(OUTDIR, `${c.slug}.html`), html); }
    console.log(`${c.slug}: built ${html.length} chars, ${(html.match(/<details>/g) || []).length} FAQs`);
    if (!OUTDIR || TOKEN) {
      if (!TOKEN) { console.log('  (no OEMSAAS_TOKEN_ES — build only)'); continue; }
      await upsert(c, html);
    }
  }
  console.log(DRY_RUN ? '\nDRY RUN complete — set DRY_RUN=false to deploy.' : '\nDeploy complete.');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
