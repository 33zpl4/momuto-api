/**
 * Deploy (or update) a Ready-to-Play template across all 3 domains:
 *   - Deploys the template page body (ready-to-play/templates/{slug}/{lang}.html)
 *     to the CMS at the handle defined by ready-to-play/config.json
 *   - Injects or updates the card on each localized collection page
 *     (ready-to-play/collection/{lang}.html) and redeploys it
 *   - Writes the updated local collection HTML back to disk so the workflow
 *     can commit it
 *
 * Env vars:
 *   TEMPLATE_SLUG          - required, folder name under ready-to-play/templates/
 *   ANTHROPIC_API_KEY      - required (used for auto-gen of meta title/desc)
 *   OEMSAAS_TOKEN_EN/ES/FR - required
 *   DRY_RUN=true           - optional, skips all CMS writes
 */

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const ROOT = path.resolve(__dirname, '..');
const RTP_DIR = path.join(ROOT, 'ready-to-play');

const DOMAINS = {
  en: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_EN,
    label: 'momuto.com',
    baseUrl: 'https://www.momuto.com',
    collectionPath: '/collections/ready-to-play',
    titleTemplate: (name) => `${name} — Ready-to-Play Football Kit | MOMUTO`,
    metaKeywords: ['ready-to-play', 'football kit', 'pre-designed jersey', 'MOMUTO'],
    langInstruction: 'Write all text content in English.'
  },
  es: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_ES,
    label: 'es.momuto.com',
    baseUrl: 'https://es.momuto.com',
    collectionPath: '/collections/ready-to-play',
    titleTemplate: (name) => `${name} — Equipación Ready-to-Play | MOMUTO`,
    metaKeywords: ['ready-to-play', 'equipación de fútbol', 'camiseta prediseñada', 'MOMUTO'],
    langInstruction: 'Write all text content in Spanish (Spain). Use "equipación" for kit and "camiseta" for jersey.'
  },
  fr: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_FR,
    label: 'fr.momuto.com',
    baseUrl: 'https://fr.momuto.com',
    collectionPath: '/collections/ready-to-play',
    titleTemplate: (name) => `${name} — Maillot Ready-to-Play | MOMUTO`,
    metaKeywords: ['ready-to-play', 'maillot de foot', 'maillot pré-conçu', 'MOMUTO'],
    langInstruction: 'Write all text content in French. Use "maillot" for jersey and "tenue" for kit.'
  },
  it: {
    host: 'https://openapi.oemapps.com',
    token: process.env.OEMSAAS_TOKEN_IT,
    label: 'it.momuto.com',
    baseUrl: 'https://it.momuto.com',
    collectionPath: '/collections/ready-to-play',
    titleTemplate: (name) => `${name} — Maglia Ready-to-Play | MOMUTO`,
    metaKeywords: ['ready-to-play', 'maglia calcio', 'maglia pre-disegnata', 'MOMUTO'],
    langInstruction: 'Write all text content in Italian. Use "maglia" for jersey and "kit" for kit.'
  }
};

const DRY_RUN = process.env.DRY_RUN === 'true';

// ─── Config loaders ────────────────────────────────────────────────────────

function loadSharedConfig() {
  const p = path.join(RTP_DIR, 'config.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadTemplateConfig(slug) {
  const p = path.join(RTP_DIR, 'templates', slug, 'config.json');
  if (!fs.existsSync(p)) throw new Error(`Template config not found: ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadTemplateHTML(slug, lang) {
  const p = path.join(RTP_DIR, 'templates', slug, `${lang}.html`);
  if (!fs.existsSync(p)) throw new Error(`Template HTML not found: ${p}`);
  return fs.readFileSync(p, 'utf8');
}

function loadCollectionHTML(lang) {
  const p = path.join(RTP_DIR, 'collection', `${lang}.html`);
  if (!fs.existsSync(p)) throw new Error(`Collection HTML not found: ${p}`);
  return fs.readFileSync(p, 'utf8');
}

function saveCollectionHTML(lang, html) {
  const p = path.join(RTP_DIR, 'collection', `${lang}.html`);
  fs.writeFileSync(p, html, 'utf8');
}

// ─── OEMSaaS API ───────────────────────────────────────────────────────────

async function getPageByHandle(domain, handle) {
  try {
    const r = await fetch(`${domain.host}/pages?handle=${handle}`, { headers: { token: domain.token } });
    const j = await r.json();
    if (!r.ok || j.code !== 0) return null;
    const pages = j.data?.list || j.data || [];
    return Array.isArray(pages) ? (pages.find(p => p.handle === handle) || null) : null;
  } catch {
    return null;
  }
}

async function upsertPage(domain, handle, pageData) {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] would upsert ${handle} on ${domain.label}`);
    return { dryRun: true };
  }
  const existing = await getPageByHandle(domain, handle);
  const url = existing
    ? `${domain.host}/pages/${existing.id}`
    : `${domain.host}/pages`;
  const method = existing ? 'PUT' : 'POST';
  const body = { ...pageData, handle };

  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', token: domain.token },
    body: JSON.stringify(body)
  });
  const j = await r.json();
  if (!r.ok || j.code !== 0) {
    throw new Error(`${method} ${handle} on ${domain.label} failed: ${JSON.stringify(j)}`);
  }
  return j;
}

// ─── Meta generation (Claude) ──────────────────────────────────────────────

async function generateMeta(template, domain, lang) {
  // Allow override via config.json — set template.meta.{lang} = { title, description }
  const override = template.meta?.[lang];
  if (override?.title && override?.description) {
    return { title: override.title, description: override.description };
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are writing SEO metadata for a Ready-to-Play football kit product page on MOMUTO.

${domain.langInstruction}

Design name: ${template.name}
Category: ${template.category?.[lang] || template.category?.en || template.category}
Description: ${template.description?.[lang] || template.description?.en || template.description}

Ready-to-Play context: pre-designed kits created by MOMUTO designers, already worn by real clubs. Teams pick a design, customise colours + badge, receive mockup in 24h. 10% cheaper than custom designs. Same premium quality.

Return ONLY a JSON object:
{
  "meta_title": "SEO title under 60 characters mentioning design name, Ready-to-Play, and MOMUTO",
  "meta_description": "SEO description under 160 characters highlighting the design, colour customisation, 24h preview, and -10% pricing"
}`;

  const msg = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = msg.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Claude returned non-JSON: ${text}`);
  const parsed = JSON.parse(jsonMatch[0]);
  return { title: parsed.meta_title, description: parsed.meta_description };
}

// ─── Collection card injection ─────────────────────────────────────────────

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildCardHTML(template, lang, sharedCfg, productUrl) {
  const name = escapeHtml(template.name);
  const category = escapeHtml(template.category?.[lang] || template.category?.en || '');
  const tagsArr = template.tags?.[lang] || template.tags?.en || [];
  const cardDesc = escapeHtml(template.card_description?.[lang] || template.description?.[lang] || template.description?.en || '');
  const heroImage = template.hero_image;
  const p = sharedCfg.pricing;
  const altText = `${template.name} — ${template.category?.en || ''} football kit by MOMUTO`;

  const tagsHtml = tagsArr.map((tag, i) => {
    const cls = i === 0 && /popular/i.test(tag) ? 'rtp-col-tag rtp-col-tag-red' : 'rtp-col-tag';
    return `          <span class="${cls}">${escapeHtml(tag)}</span>`;
  }).join('\n');

  const priceCurrent = `€${p.jersey_current.toFixed(2)}`;
  const priceOriginal = `€${p.jersey_original.toFixed(2)}`;
  const perLabel = { en: '/ jersey', es: '/ camiseta', fr: '/ maillot' }[lang];
  const badgeLabel = `-${p.discount_pct}% READY-TO-PLAY`;
  // Purchase card (matches the hand-maintained collection): "Customize & buy" → the product page.
  const buyCta = { en: 'Customize &amp; buy', es: 'Personaliza y compra', fr: 'Personnaliser &amp; acheter', it: 'Personalizza e acquista' }[lang];
  const specsByLang = {
    en: [['fa-bolt', 'Live preview'], ['fa-check', 'Free proof before print'], ['fa-truck', '25-30 days']],
    es: [['fa-bolt', 'Vista previa en vivo'], ['fa-check', 'Prueba gratis antes de imprimir'], ['fa-truck', '25-30 días']],
    fr: [['fa-bolt', 'Aperçu en direct'], ['fa-check', 'Bon à tirer gratuit'], ['fa-truck', '25-30 jours']],
    it: [['fa-bolt', 'Anteprima dal vivo'], ['fa-check', 'Bozza gratuita'], ['fa-truck', '25-30 giorni']],
  };
  const specsHtml = (specsByLang[lang] || specsByLang.en)
    .map(function (s) { return `          <div class="rtp-col-spec"><i class="fas ${s[0]}"></i> ${s[1]}</div>`; })
    .join('\n');

  return `    <!-- ${name} -->
    <article class="rtp-col-card" itemscope itemtype="https://schema.org/Product" onclick="window.location.href='${productUrl}'">
      <div class="rtp-col-card-img">
        <div class="rtp-col-tags">
${tagsHtml}
        </div>
        <img src="${heroImage}" alt="${escapeHtml(altText)}" itemprop="image" loading="lazy" width="400" height="400">
      </div>
      <div class="rtp-col-card-details">
        <span class="rtp-col-card-series" itemprop="category">${category}</span>
        <h2 class="rtp-col-card-title" itemprop="name">${name}</h2>
        <p class="rtp-col-card-desc" itemprop="description">${cardDesc}</p>
        <div class="rtp-col-card-price">
          <span class="rtp-col-card-price-current">${priceCurrent}</span>
          <span class="rtp-col-card-price-old">${priceOriginal}</span>
          <span class="rtp-col-card-price-per">${perLabel}</span>
          <span class="rtp-col-card-price-badge">${badgeLabel}</span>
        </div>
        <div class="rtp-col-card-specs">
${specsHtml}
        </div>
        <div class="rtp-col-card-btn">${buyCta} <i class="fas fa-arrow-right"></i></div>
      </div>
    </article>`;
}

function upsertCardInCollection(collectionHTML, cardHTML, templateName) {
  // Find existing card by iterating article blocks and matching the h2 title
  // inside each one. A naive single-regex approach with `[^]*?` can span
  // multiple sibling cards, which would wipe them all on replace.
  const nameEscaped = escapeHtml(templateName);
  const nameRegexEscaped = nameEscaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const articleRe = /<article\b[^>]*\bclass="rtp-col-card"[^>]*>[\s\S]*?<\/article>/gi;
  const titleRe = new RegExp(
    `<h2\\s[^>]*\\bclass="rtp-col-card-title"[^>]*>\\s*${nameRegexEscaped}\\s*</h2>`,
    'i'
  );

  let match;
  while ((match = articleRe.exec(collectionHTML)) !== null) {
    if (!titleRe.test(match[0])) continue;

    let start = match.index;
    const end = match.index + match[0].length;

    // If immediately preceded by a "<!-- TEMPLATE NAME -->" comment, consume it
    // too so we don't leave a stale comment behind after the replace.
    const precedingSlice = collectionHTML.slice(Math.max(0, start - 200), start);
    const leadingCommentRe = new RegExp(
      `\\s*<!--[^-]*?${nameRegexEscaped}[^-]*?-->\\s*$`,
      'i'
    );
    const leadMatch = precedingSlice.match(leadingCommentRe);
    if (leadMatch) start -= leadMatch[0].length;

    return collectionHTML.slice(0, start) + '\n' + cardHTML + collectionHTML.slice(end);
  }

  // Insert at end of <main class="rtp-col-grid"> (before closing </main>)
  const mainClose = /(<main[^>]*class="rtp-col-grid"[^>]*>[\s\S]*?)(\s*<\/main>)/;
  if (mainClose.test(collectionHTML)) {
    return collectionHTML.replace(mainClose, (_, before, close) => `${before}\n${cardHTML}\n${close}`);
  }

  throw new Error('Could not locate <main class="rtp-col-grid"> in collection HTML');
}

// ─── Orchestration ─────────────────────────────────────────────────────────

async function main() {
  const slug = process.env.TEMPLATE_SLUG;
  if (!slug) throw new Error('TEMPLATE_SLUG env var not set');

  const shared = loadSharedConfig();
  const template = loadTemplateConfig(slug);

  console.log(`Deploying Ready-to-Play template: ${template.name} (slug: ${slug})`);
  console.log(`Status: ${template.status || 'published'}`);
  console.log(`Dry run: ${DRY_RUN}`);

  const errors = [];

  for (const [lang, domain] of Object.entries(DOMAINS)) {
    try {
      if (!domain.token && !DRY_RUN) {
        console.warn(`⚠️  No token for ${domain.label} — skipping`);
        continue;
      }

      const handle = shared.template_handle_pattern[lang].replace('{slug}', slug);
      const templatePageUrl = `${domain.baseUrl}${shared.template_path_pattern[lang].replace('{slug}', slug)}`;
      const collectionHandle = shared.collection_handle[lang];

      console.log(`\n── ${domain.label} ──`);
      console.log(`  template handle:   ${handle}`);
      console.log(`  template url:      ${templatePageUrl}`);
      console.log(`  collection handle: ${collectionHandle}`);

      // 1. Generate SEO metadata
      console.log(`  Generating meta...`);
      const meta = await generateMeta(template, domain, lang);
      console.log(`  ✓ title: ${meta.title}`);

      // 2. Deploy template page
      const templateHTML = loadTemplateHTML(slug, lang);
      await upsertPage(domain, handle, {
        is_default: 0,
        title: domain.titleTemplate(template.name),
        content: templateHTML,
        meta_title: meta.title,
        meta_keywords: [...domain.metaKeywords, template.name],
        meta_descript: meta.description,
        og_image: template.hero_image
      });
      console.log(`  ✓ template page deployed`);

      // 3. Inject/update card in local collection HTML and redeploy
      const collectionHTML = loadCollectionHTML(lang);
      const productUrl = `${domain.baseUrl}/products/${slug}`;
      const cardHTML = buildCardHTML(template, lang, shared, productUrl);
      const updatedCollection = upsertCardInCollection(collectionHTML, cardHTML, template.name);

      saveCollectionHTML(lang, updatedCollection);
      console.log(`  ✓ local collection/${lang}.html updated`);

      // 4. Deploy collection page (preserve existing meta)
      const existingCollection = await getPageByHandle(domain, collectionHandle);
      if (existingCollection) {
        await upsertPage(domain, collectionHandle, {
          is_default: existingCollection.is_default ?? 0,
          title: existingCollection.title,
          content: updatedCollection,
          meta_title: existingCollection.meta_title,
          meta_keywords: existingCollection.meta_keywords,
          meta_descript: existingCollection.meta_descript,
          og_image: existingCollection.og_image
        });
        console.log(`  ✓ collection page redeployed`);
      } else {
        console.warn(`  ⚠️  collection page not found on ${domain.label} — skipping collection update`);
      }
    } catch (e) {
      console.error(`✗ ${domain.label}: ${e.message}`);
      errors.push({ domain: domain.label, error: e.message });
    }
  }

  if (errors.length > 0) {
    console.error(`\nCompleted with ${errors.length} error(s):`);
    errors.forEach(e => console.error(`  ${e.domain}: ${e.error}`));
    process.exit(1);
  }

  console.log(`\n✓ Done. ${template.name} deployed across all domains.`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
