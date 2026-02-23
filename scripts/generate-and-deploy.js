const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Sanitize strings used inside template literals
const safe = str => String(str).replace(/`/g, "'").replace(/\$/g, '&#36;');

const DOMAINS = {
  en: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_EN,
    lang: 'en',
    label: 'momuto.com',
    baseUrl: 'https://www.momuto.com',
    handleSuffix: 'custom-kit-design',
    galleryUrl: 'https://www.momuto.com/pages/custom-kit-gallery',
    galleryHandle: 'custom-kit-gallery',
    comparisonUrl: 'https://www.momuto.com/pages/momuto-vs-jersix-owayo-spized-comparison',
    galleryLabel: 'View Gallery',
    comparisonLabel: 'Why MOMUTO?',
    orderUrl: 'https://www.momuto.com/pages/request-custom-kit-design',
    features: [
      { name: 'Moisture Control', desc: 'Wicks sweat. Stays dry.' },
      { name: 'Stretch Fabric', desc: 'Moves with you. Never restricts.' },
      { name: 'Built to Last', desc: 'Pro-grade durability.' }
    ],
    performanceTitle: 'Performance Fabric. Precision Fit.',
    performanceSubtitle: 'Built for the game',
    specsLabels: { quality: 'Quality', custom: 'Custom', delivery: 'Delivery' },
    deliveryText: '20-25 DAYS'
  },
  es: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_ES,
    lang: 'es',
    label: 'es.momuto.com',
    baseUrl: 'https://es.momuto.com',
    handleSuffix: 'diseno-equipacion',
    galleryUrl: 'https://es.momuto.com/pages/equipos-momuto',
    galleryHandle: 'equipos-momuto',
    comparisonUrl: 'https://es.momuto.com/pages/zentral-opiniones-alternativa',
    galleryLabel: 'Ver Galería',
    comparisonLabel: '¿Por qué Momuto?',
    orderUrl: 'https://es.momuto.com/pages/request-custom-kit-design',
    features: [
      { name: 'Control de Humedad', desc: 'Absorbe el sudor. Siempre seco.' },
      { name: 'Tejido Elástico', desc: 'Se mueve contigo. Sin restricciones.' },
      { name: 'Duración Profesional', desc: 'Resistencia de alto rendimiento.' }
    ],
    performanceTitle: 'Tejido de Alto Rendimiento. Corte Preciso.',
    performanceSubtitle: 'Diseñado para el juego',
    specsLabels: { quality: 'Calidad', custom: 'Personalizado', delivery: 'Entrega' },
    deliveryText: '20-25 DÍAS'
  },
  fr: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_FR,
    lang: 'fr',
    label: 'fr.momuto.com',
    baseUrl: 'https://fr.momuto.com',
    handleSuffix: 'design-maillot',
    galleryUrl: 'https://fr.momuto.com/pages/equipes-clubs-momuto',
    galleryHandle: 'equipes-clubs-momuto',
    comparisonUrl: 'https://fr.momuto.com/pages/comparatif-fournisseur-maillot-foot-2026',
    galleryLabel: 'Voir la Galerie',
    comparisonLabel: 'Pourquoi Momuto ?',
    orderUrl: 'https://fr.momuto.com/pages/request-custom-kit-design',
    features: [
      { name: "Gestion de l'Humidité", desc: 'Évacue la sueur. Reste au sec.' },
      { name: 'Tissu Extensible', desc: 'Suit vos mouvements. Sans contrainte.' },
      { name: 'Durabilité Pro', desc: 'Résistance de niveau professionnel.' }
    ],
    performanceTitle: 'Tissu Haute Performance. Coupe Précise.',
    performanceSubtitle: 'Conçu pour le jeu',
    specsLabels: { quality: 'Qualité', custom: 'Personnalisé', delivery: 'Livraison' },
    deliveryText: '20-25 J'
  }
};

async function generatePageContent(config, lang) {
  const langInstructions = {
    en: 'Write all text content in English.',
    es: 'Write all text content in Spanish (Spain). Use "equipación" for kit, "camiseta" for jersey.',
    fr: 'Write all text content in French. Use "maillot" for jersey, "tenue" for kit.'
  };

  const prompt = `You are creating a custom football kit design proposal page for MOMUTO (momuto.com), a custom football kit brand.

${langInstructions[lang]}

Team details:
- Team name: ${config.team_name}
- Design name: ${config.design_name}
- Design description: ${config.design_description}
- Primary color: ${config.primary_color}
- Secondary color: ${config.secondary_color}
- Image URL: ${config.image_url}
- Language: ${lang}

Generate a JSON object with these exact fields:
{
  "meta_title": "SEO title under 60 chars mentioning team name, custom kit, and MOMUTO",
  "meta_description": "SEO description under 160 chars with team name, design name, key visual details, and MOMUTO",
  "status_badge": "short badge text like 'Exclusive Proposal' or 'Propuesta Exclusiva' or 'Proposition Exclusive'",
  "subtitle": "subtitle like 'Design Concept 2026'",
  "design_story_heading": "heading for the design story section",
  "design_story_short": "1 sentence teaser for the design",
  "design_story_full": "2-3 sentences detailed description of the design concept and visual elements",
  "share_button_text": "WhatsApp share button text",
  "gallery_tagline": "short tagline like 'Join 50+ teams who trust us with their identity'",
  "whatsapp_share_message": "message to share on WhatsApp mentioning team name and kit"
}

Return ONLY the JSON object, no markdown, no code fences, no other text.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text.trim();
  const clean = text.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(clean);
}

async function generateGalleryDesc(config) {
  const prompt = `Given this football kit design description: "${config.design_description}"

Write a SHORT gallery caption of exactly 4 to 6 words that captures the essence of the design.
Examples of good captions: "Bold gradient with black sleeves", "Classic red and white stripes", "Navy fade with gold trim"

Return ONLY the caption text, nothing else. No quotes, no punctuation at the end.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 50,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text.trim().replace(/^["']|["']$/g, '').replace(/\.$/, '');
}

function buildPageHTML(config, content, domain) {
  const accentColor = config.accent_color || config.primary_color || '#e63946';

  return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "${safe(config.team_name)} Custom Kit Design — MOMUTO",
  "serviceType": "Custom Football Kit Design",
  "provider": {
    "@type": "Organization",
    "name": "MOMUTO",
    "url": "${domain.baseUrl}"
  },
  "description": "${safe(content.design_story_short)}",
  "image": "${safe(config.image_url)}",
  "inLanguage": "${domain.lang}",
  "areaServed": "Worldwide",
  "offers": {
    "@type": "Offer",
    "price": "20.90",
    "priceCurrency": "EUR",
    "url": "${domain.orderUrl}"
  }
}
<\/script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Jost:wght@400;500;700;900&display=swap');
:root {
  --accent: ${accentColor};
  --bg-dark: #050505;
  --text-white: #ffffff;
  --text-muted: #a1a1aa;
}
* { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
body { font-family: 'Jost', sans-serif; background-color: var(--bg-dark); color: var(--text-white); overflow-x: hidden; padding-bottom: 90px; }
.title { display: none; }
.hero { position: relative; padding: 2rem 1rem 0; display: flex; flex-direction: column; align-items: center; background: radial-gradient(circle at 50% 30%, #1a1a1a 0%, var(--bg-dark) 70%); }
.status-badge { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: var(--text-white); font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; padding: 6px 16px; margin-bottom: 1.5rem; display: inline-block; }
.team-name { font-size: clamp(2rem, 7vw, 3.5rem); font-weight: 900; text-transform: uppercase; line-height: 0.9; text-align: center; letter-spacing: -0.02em; margin-bottom: 0.5rem; }
.subtitle { color: var(--text-muted); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 2rem; }
.jersey-stage { width: 100%; max-width: 600px; position: relative; margin-bottom: 2rem; cursor: zoom-in; }
.jersey-img { width: 100%; height: auto; display: block; filter: drop-shadow(0 25px 50px rgba(0,0,0,0.5)); }
.expand-hint { position: absolute; bottom: 20px; right: 20px; background: rgba(0,0,0,0.5); backdrop-filter: blur(5px); padding: 8px; border-radius: 8px; opacity: 0.7; pointer-events: none; }
.expand-icon { width: 20px; height: 20px; fill: white; display: block; }
.reaction-container { width: 100%; max-width: 450px; margin: 0 auto 3rem; display: flex; gap: 10px; padding: 0 1rem; }
.reaction-btn { flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-muted); padding: 12px 5px; border-radius: 4px; font-family: 'Jost', sans-serif; font-weight: 700; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; cursor: pointer; transition: all 0.2s ease; display: flex; flex-direction: column; align-items: center; gap: 5px; }
.reaction-btn:hover { background: rgba(255,255,255,0.1); }
.reaction-btn.selected { background: var(--accent); color: white; border-color: var(--accent); transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
.emoji-icon { font-size: 1.2rem; }
.specs-container { display: grid; grid-template-columns: repeat(3, 1fr); width: 100%; max-width: 800px; margin: 0 auto 3rem; border-top: 1px solid rgba(255,255,255,0.1); border-bottom: 1px solid rgba(255,255,255,0.1); }
.spec-item { padding: 1.5rem 0.5rem; text-align: center; border-right: 1px solid rgba(255,255,255,0.1); }
.spec-item:last-child { border-right: none; }
.spec-val { font-weight: 800; display: block; font-size: 1rem; margin-bottom: 4px; color: var(--accent); }
.spec-label { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em; }
.story-container { max-width: 600px; margin: 0 auto 4rem; padding: 0 1.5rem; }
.story-content { border-left: 3px solid var(--accent); padding-left: 1.5rem; }
.story-heading { font-weight: 800; text-transform: uppercase; margin-bottom: 1rem; color: white; }
.story-p { color: #ccc; line-height: 1.6; font-size: 0.95rem; }
.performance-section { max-width: 700px; margin: 0 auto 4rem; padding: 0 1.5rem; }
.performance-title { font-weight: 900; font-size: 1.8rem; text-transform: uppercase; margin-bottom: 0.5rem; color: white; text-align: center; }
.performance-subtitle { color: var(--text-muted); font-size: 0.9rem; text-align: center; margin-bottom: 3rem; }
.features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 2rem; }
.feature-item { text-align: center; }
.feature-icon { width: 50px; height: 50px; margin: 0 auto 1rem; background: var(--accent); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.feature-icon-svg { width: 24px; height: 24px; stroke: white; fill: none; stroke-width: 2; }
.feature-name { font-weight: 700; margin-bottom: 0.5rem; font-size: 0.9rem; }
.feature-desc { font-size: 0.85rem; color: var(--text-muted); }
.trust-section { background: #111; padding: 4rem 1.5rem; text-align: center; }
.trust-links { display: flex; gap: 1rem; justify-content: center; margin-top: 2rem; flex-wrap: wrap; }
.trust-link { color: white; text-decoration: none; border: 1px solid #333; padding: 12px 25px; text-transform: uppercase; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.1em; transition: 0.3s; }
.trust-link:hover { border-color: var(--accent); background: var(--accent); }
.sticky-share { position: fixed; bottom: 0; left: 0; width: 100%; background: rgba(0,0,0,0.9); backdrop-filter: blur(10px); padding: 15px; z-index: 100; border-top: 1px solid #222; display: flex; justify-content: center; }
.btn-whatsapp { background: #25D366; color: white; width: 100%; max-width: 400px; padding: 14px; border: none; font-family: 'Jost', sans-serif; font-weight: 800; text-transform: uppercase; font-size: 0.9rem; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; cursor: pointer; }
.lightbox-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: black; z-index: 9999; }
.lightbox-overlay.active { display: flex; justify-content: center; align-items: center; }
.lightbox-img { max-width: 100%; max-height: 100%; }
.lightbox-close { position: absolute; top: 20px; right: 20px; width: 40px; height: 40px; background: rgba(255,255,255,0.1); border-radius: 50%; display: flex; justify-content: center; align-items: center; color: white; font-size: 24px; cursor: pointer; z-index: 10001; }
</style>

<section class="hero">
  <div class="status-badge">${safe(content.status_badge)}</div>
  <h1 class="team-name">${safe(config.team_name)}</h1>
  <p class="subtitle">${safe(content.subtitle)}</p>
  <div class="jersey-stage" onclick="openLightbox()">
    <img src="${safe(config.image_url)}" class="jersey-img" alt="${safe(config.team_name)} custom kit design by MOMUTO" />
    <div class="expand-hint">
      <svg class="expand-icon" viewBox="0 0 24 24"><path d="M15 3l2.3 2.3-2.89 2.87 1.42 1.42L18.7 6.7 21 9V3h-6zM3 9l2.3-2.3 2.87 2.89 1.42-1.42L6.7 5.3 9 3H3v6zm6 12l-2.3-2.3 2.89-2.87-1.42-1.42L5.3 17.3 3 15v6h6zm12-6l-2.3 2.3-2.87-2.89-1.42 1.42L17.3 18.7 15 21h6v-6z"/></svg>
    </div>
  </div>
  <div class="reaction-container">
    <button class="reaction-btn" onclick="selectReaction(this,'fire')"><span class="emoji-icon">🔥</span> Fire</button>
    <button class="reaction-btn" onclick="selectReaction(this,'love')"><span class="emoji-icon">⚡</span> Love It</button>
  </div>
</section>

<div class="specs-container">
  <div class="spec-item"><span class="spec-val">PRO</span><span class="spec-label">${domain.specsLabels.quality}</span></div>
  <div class="spec-item"><span class="spec-val">100%</span><span class="spec-label">${domain.specsLabels.custom}</span></div>
  <div class="spec-item"><span class="spec-val">${domain.deliveryText}</span><span class="spec-label">${domain.specsLabels.delivery}</span></div>
</div>

<div class="story-container">
  <div class="story-content">
    <h2 class="story-heading">${safe(content.design_story_heading)}</h2>
    <p class="story-p">${safe(content.design_story_short)}</p>
    <br/>
    <p class="story-p" style="opacity:0.7;font-size:0.85rem;">${safe(content.design_story_full)}</p>
  </div>
</div>

<div class="performance-section">
  <h2 class="performance-title">${domain.performanceTitle}</h2>
  <p class="performance-subtitle">${domain.performanceSubtitle}</p>
  <div class="features-grid">
    <div class="feature-item">
      <div class="feature-icon"><svg class="feature-icon-svg" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
      <div class="feature-name">${domain.features[0].name}</div>
      <div class="feature-desc">${domain.features[0].desc}</div>
    </div>
    <div class="feature-item">
      <div class="feature-icon"><svg class="feature-icon-svg" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>
      <div class="feature-name">${domain.features[1].name}</div>
      <div class="feature-desc">${domain.features[1].desc}</div>
    </div>
    <div class="feature-item">
      <div class="feature-icon"><svg class="feature-icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>
      <div class="feature-name">${domain.features[2].name}</div>
      <div class="feature-desc">${domain.features[2].desc}</div>
    </div>
  </div>
</div>

<div class="trust-section">
  <h3 style="color:white;text-transform:uppercase;font-weight:900;margin-bottom:10px;">MOMUTO</h3>
  <p style="color:#888;font-size:0.9rem;">${safe(content.gallery_tagline)}</p>
  <div class="trust-links">
    <a href="${domain.galleryUrl}" class="trust-link">${domain.galleryLabel}</a>
    <a href="${domain.comparisonUrl}" class="trust-link">${domain.comparisonLabel}</a>
  </div>
</div>

<div class="sticky-share">
  <button class="btn-whatsapp" onclick="shareToWhatsApp()">📲 ${safe(content.share_button_text)}</button>
</div>

<div id="lightbox" class="lightbox-overlay">
  <div class="lightbox-close" onclick="closeLightbox()">&times;</div>
  <img id="zoomImg" src="${safe(config.image_url)}" class="lightbox-img" />
</div>

<script>
function selectReaction(btn, type) {
  document.querySelectorAll('.reaction-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}
function openLightbox() {
  document.getElementById('zoomImg').src = '${safe(config.image_url)}';
  document.getElementById('lightbox').classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('active');
  document.body.style.overflow = '';
}
function shareToWhatsApp() {
  const text = encodeURIComponent('${safe(content.whatsapp_share_message)}');
  const url = encodeURIComponent(window.location.href);
  window.open('https://wa.me/?text=' + text + '%20' + url, '_blank');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });
<\/script>`;
}

async function getGalleryPage(domain) {
  const response = await fetch(`${domain.host}/pages?handle=${domain.galleryHandle}`, {
    headers: { 'token': domain.token }
  });
  const result = await response.json();
  if (!response.ok || result.code !== 0) {
    throw new Error(`Failed to fetch gallery on ${domain.label}: ${JSON.stringify(result)}`);
  }
  const pages = result.data?.list || result.data || [];
  const gallery = Array.isArray(pages)
    ? pages.find(p => p.handle === domain.galleryHandle)
    : null;
  if (!gallery) throw new Error(`Gallery page not found on ${domain.label}`);
  return gallery;
}

async function updateGallery(domain, teamSlug, config, galleryDesc) {
  const gallery = await getGalleryPage(domain);
  const teamPageUrl = `${domain.baseUrl}/pages/${teamSlug}-${domain.handleSuffix}`;

  const currentContent = gallery.content || '';

  // Check if this team already exists in the gallery
  if (currentContent.includes(`url: "${teamPageUrl}"`) || currentContent.includes(`team: "${config.team_name}"`)) {
    console.log(`✓ Gallery on ${domain.label} already contains ${config.team_name} — skipping`);
    return;
  }

  // Use short gallery description (4-6 words) instead of full design_description
  const shortDesc = galleryDesc || config.design_description;

  // New entry injected at the START of the designs array so newest appears first
  const newEntry = `    {\n        team: "${config.team_name}",\n        desc: "${shortDesc}",\n        image: "${config.image_url}",\n        url: "${teamPageUrl}"\n    },`;

  const marker = 'const designs = [';
  let updatedContent = currentContent;

  if (updatedContent.includes(marker)) {
    updatedContent = updatedContent.replace(marker, `${marker}\n${newEntry}`);
  } else {
    console.warn(`⚠️ Could not find designs array in gallery on ${domain.label} — skipping gallery update`);
    return;
  }

  const response = await fetch(`${domain.host}/pages/${gallery.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'token': domain.token
    },
    body: JSON.stringify({
      content: updatedContent,
      title: gallery.title,
      meta_title: gallery.meta_title,
      meta_keywords: gallery.meta_keywords,
      meta_descript: gallery.meta_descript,
      handle: gallery.handle
    })
  });

  const result = await response.json();
  if (!response.ok || result.code !== 0) {
    throw new Error(`Failed to update gallery on ${domain.label}: ${JSON.stringify(result)}`);
  }
  console.log(`✓ Gallery updated on ${domain.label} — ${config.team_name} added first`);
  return result;
}

async function updateSitemap(domain, teamSlug) {
  const handle = `${teamSlug}-${domain.handleSuffix}`;
  const newPageUrl = `${domain.baseUrl}/pages/${handle}`;

  // Fetch current sitemap via DiyFile API
  const listResponse = await fetch(`${domain.host}/diy-files?name=sitemap.xml`, {
    headers: { 'token': domain.token }
  });
  const listResult = await listResponse.json();
  if (!listResponse.ok || listResult.code !== 0) {
    console.warn(`⚠️ Could not fetch sitemap on ${domain.label}: ${JSON.stringify(listResult)} — skipping sitemap update`);
    return;
  }

  const files = listResult.data?.list || listResult.data || [];
  const sitemap = Array.isArray(files)
    ? files.find(f => f.name === 'sitemap.xml')
    : null;

  if (!sitemap) {
    console.warn(`⚠️ sitemap.xml not found on ${domain.label} — skipping sitemap update`);
    return;
  }

  // Check if this URL already exists in the sitemap
  const content = sitemap.content || '';
  if (content.includes(newPageUrl)) {
    console.log(`✓ Sitemap on ${domain.label} already contains ${handle} — skipping`);
    return;
  }

  // Inject new <url> entry before </urlset>
  const today = new Date().toISOString().split('T')[0];
  const newEntry = `<url>\n  <loc>${newPageUrl}</loc>\n  <lastmod>${today}</lastmod>\n  <changefreq>monthly</changefreq>\n  <priority>0.6</priority>\n</url>\n`;

  const updatedContent = content.replace('</urlset>', `${newEntry}</urlset>`);

  const putResponse = await fetch(`${domain.host}/diy-files/${sitemap.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'token': domain.token
    },
    body: JSON.stringify({
      name: sitemap.name,
      content: updatedContent
    })
  });

  const putResult = await putResponse.json();
  if (!putResponse.ok || putResult.code !== 0) {
    console.warn(`⚠️ Failed to update sitemap on ${domain.label}: ${JSON.stringify(putResult)}`);
    return;
  }
  console.log(`✓ Sitemap updated on ${domain.label} — added ${handle}`);
}

async function pageExists(domain, handle) {
  try {
    const response = await fetch(`${domain.host}/pages?handle=${handle}`, {
      headers: { 'token': domain.token }
    });
    const result = await response.json();
    if (!response.ok || result.code !== 0) return false;
    const pages = result.data?.list || result.data || [];
    return Array.isArray(pages) && pages.some(p => p.handle === handle);
  } catch {
    return false;
  }
}

async function createPage(domain, pageData) {
  const response = await fetch(`${domain.host}/pages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'token': domain.token
    },
    body: JSON.stringify(pageData)
  });

  const result = await response.json();
  if (!response.ok || result.code !== 0) {
    throw new Error(`Failed to create page on ${domain.label}: ${JSON.stringify(result)}`);
  }
  return result;
}

async function main() {
  const teamSlug = process.env.TEAM_SLUG;
  if (!teamSlug) throw new Error('TEAM_SLUG env var not set');

  const configPath = path.join('teams', teamSlug, 'config.json');
  if (!fs.existsSync(configPath)) throw new Error(`Config not found: ${configPath}`);

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const updateGalleryFlag = process.env.UPDATE_GALLERY === 'true';
  const galleryOnly = process.env.GALLERY_ONLY === 'true';

  console.log(`Processing team: ${config.team_name}`);
  console.log(`Mode: ${galleryOnly ? 'GALLERY ONLY' : 'FULL DEPLOY'}`);
  console.log(`Gallery update: ${updateGalleryFlag || galleryOnly ? 'YES' : 'NO'}`);

  // Generate a short gallery description (4-6 words) once, reuse for all domains
  let galleryDesc = null;
  if (updateGalleryFlag || galleryOnly) {
    console.log('Generating short gallery description...');
    galleryDesc = await generateGalleryDesc(config);
    console.log(`Gallery description: "${galleryDesc}"`);
  }

  const errors = [];

  for (const [lang, domain] of Object.entries(DOMAINS)) {
    try {
      if (!galleryOnly) {
        const handle = `${teamSlug}-${domain.handleSuffix}`;

        // Check if page already exists to prevent duplicates
        const exists = await pageExists(domain, handle);
        if (exists) {
          console.log(`\n⏭️ Page already exists on ${domain.label} with handle: ${handle} — skipping creation`);
        } else {
          console.log(`\nGenerating ${lang.toUpperCase()} content...`);
          const content = await generatePageContent(config, lang);

          const html = buildPageHTML(config, content, domain);

          const pageData = {
            is_default: 0,
            title: content.meta_title,
            content: html,
            meta_title: content.meta_title,
            meta_keywords: ['custom football kit', 'custom jersey', config.team_name, 'MOMUTO'],
            meta_descript: content.meta_description,
            handle: handle
          };

          console.log(`Deploying to ${domain.label} with handle: ${handle}`);
          const result = await createPage(domain, pageData);
          console.log(`✓ Created on ${domain.label}:`, JSON.stringify(result));
        }

        console.log(`Updating sitemap on ${domain.label}...`);
        await updateSitemap(domain, teamSlug);
      }

      if (updateGalleryFlag || galleryOnly) {
        console.log(`Updating gallery on ${domain.label}...`);
        await updateGallery(domain, teamSlug, config, galleryDesc);
      }
    } catch (err) {
      console.error(`❌ Error processing ${domain.label}: ${err.message}`);
      errors.push({ domain: domain.label, error: err.message });
    }
  }

  if (errors.length > 0) {
    console.error(`\n⚠️ Completed with ${errors.length} error(s):`);
    errors.forEach(e => console.error(`  - ${e.domain}: ${e.error}`));
    process.exit(1);
  }

  console.log('\n✅ All three domains updated successfully.');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
