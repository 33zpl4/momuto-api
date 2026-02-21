const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DOMAINS = {
  en: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_EN,
    lang: 'en',
    label: 'momuto.com'
  },
  es: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_ES,
    lang: 'es',
    label: 'es.momuto.com'
  },
  fr: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_FR,
    lang: 'fr',
    label: 'fr.momuto.com'
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
  "disclaimer_text": "short confidential preview disclaimer mentioning team name and MOMUTO",
  "gallery_tagline": "short tagline like 'Join 50+ teams who trust us with their identity'",
  "whatsapp_share_message": "message to share on WhatsApp mentioning team name and kit"
}

Return ONLY the JSON object, no other text.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text.trim();
  return JSON.parse(text);
}

function buildPageHTML(config, content, lang) {
  const teamSlug = config.team_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const accentColor = config.accent_color || config.primary_color || '#e63946';

  return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "${config.team_name} Custom Kit Design — MOMUTO",
  "serviceType": "Custom Football Kit Design",
  "provider": {
    "@type": "Organization",
    "name": "MOMUTO",
    "url": "https://www.momuto.com"
  },
  "description": "${content.design_story_short.replace(/"/g, '\\"')}",
  "image": "${config.image_url}",
  "inLanguage": "${lang}",
  "areaServed": "Worldwide",
  "offers": {
    "@type": "Offer",
    "price": "20.90",
    "priceCurrency": "EUR",
    "url": "https://www.momuto.com/pages/request-custom-kit-design"
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
.disclaimer { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 1rem; margin: 2rem auto; max-width: 600px; font-size: 0.8rem; color: var(--text-muted); text-align: center; border-radius: 4px; }
</style>

<section class="hero">
  <div class="status-badge">${content.status_badge}</div>
  <h1 class="team-name">${config.team_name}</h1>
  <p class="subtitle">${content.subtitle}</p>
  <div class="jersey-stage" onclick="openLightbox()">
    <img src="${config.image_url}" class="jersey-img" alt="${config.team_name} custom kit design by MOMUTO" />
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
  <div class="spec-item"><span class="spec-val">PRO</span><span class="spec-label">Quality</span></div>
  <div class="spec-item"><span class="spec-val">100%</span><span class="spec-label">Custom</span></div>
  <div class="spec-item"><span class="spec-val">20-25 DAYS</span><span class="spec-label">Delivery</span></div>
</div>

<div class="story-container">
  <div class="story-content">
    <h2 class="story-heading">${content.design_story_heading}</h2>
    <p class="story-p">${content.design_story_short}</p>
    <br/>
    <p class="story-p" style="opacity:0.7;font-size:0.85rem;">${content.design_story_full}</p>
  </div>
</div>

<div class="performance-section">
  <h2 class="performance-title">Performance Fabric. Precision Fit.</h2>
  <p class="performance-subtitle">Built for the game</p>
  <div class="features-grid">
    <div class="feature-item">
      <div class="feature-icon"><svg class="feature-icon-svg" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
      <div class="feature-name">Moisture Control</div>
      <div class="feature-desc">Wicks sweat. Stays dry.</div>
    </div>
    <div class="feature-item">
      <div class="feature-icon"><svg class="feature-icon-svg" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>
      <div class="feature-name">Stretch Fabric</div>
      <div class="feature-desc">Moves with you. Never restricts.</div>
    </div>
    <div class="feature-item">
      <div class="feature-icon"><svg class="feature-icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>
      <div class="feature-name">Built to Last</div>
      <div class="feature-desc">Pro-grade durability.</div>
    </div>
  </div>
</div>

<div class="disclaimer">
  <p><strong>Confidential Preview:</strong> ${content.disclaimer_text}</p>
</div>

<div class="trust-section">
  <h3 style="color:white;text-transform:uppercase;font-weight:900;margin-bottom:10px;">MOMUTO</h3>
  <p style="color:#888;font-size:0.9rem;">${content.gallery_tagline}</p>
  <div class="trust-links">
    <a href="https://www.momuto.com/pages/custom-kit-gallery" class="trust-link">View Gallery</a>
    <a href="https://www.momuto.com/pages/momuto-vs-jersix-owayo-spized-comparison" class="trust-link">Why MOMUTO?</a>
  </div>
</div>

<div class="sticky-share">
  <button class="btn-whatsapp" onclick="shareToWhatsApp()">📲 ${content.share_button_text}</button>
</div>

<div id="lightbox" class="lightbox-overlay">
  <div class="lightbox-close" onclick="closeLightbox()">&times;</div>
  <img id="zoomImg" src="${config.image_url}" class="lightbox-img" />
</div>

<script>
function selectReaction(btn, type) {
  document.querySelectorAll('.reaction-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}
function openLightbox() {
  document.getElementById('zoomImg').src = '${config.image_url}';
  document.getElementById('lightbox').classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('active');
  document.body.style.overflow = '';
}
function shareToWhatsApp() {
  const text = encodeURIComponent('${content.whatsapp_share_message}');
  const url = encodeURIComponent(window.location.href);
  window.open('https://wa.me/?text=' + text + '%20' + url, '_blank');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });
<\/script>`;
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
  if (!response.ok) {
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
  console.log(`Processing team: ${config.team_name}`);

  for (const [lang, domain] of Object.entries(DOMAINS)) {
    console.log(`\nGenerating ${lang.toUpperCase()} content...`);
    const content = await generatePageContent(config, lang);

    const html = buildPageHTML(config, content, lang);
    const handle = `${teamSlug}-custom-kit-design`;

    const pageData = {
      is_default: 0,
      title: content.meta_title,
      content: html,
      meta_title: content.meta_title,
      meta_keywords: ['custom football kit', 'custom jersey', config.team_name, 'MOMUTO'],
      meta_descript: content.meta_description,
      handle: handle
    };

    console.log(`Deploying to ${domain.label}...`);
    const result = await createPage(domain, pageData);
    console.log(`✓ Created on ${domain.label}:`, result);
  }

  console.log('\n✅ All three domains updated successfully.');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
