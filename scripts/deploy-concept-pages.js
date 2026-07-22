'use strict';

/**
 * Deploy the "concept-to-real" landing pages: the AI-concept expert hub
 * (EN/FR/ES/IT) and the stag/despedida vertical pages (EN/FR/ES).
 *
 * Page bodies live in pages/<handle> as CMS-ready HTML fragments (same
 * conventions as the gallery pages: inline <style>, JSON-LD blocks, no
 * <html>/<head> wrapper). This script upserts each one to its store by
 * handle — create if missing, update in place if it exists (live body is
 * archived to cms/concept-pages/archive/ first).
 *
 * Env:
 *   OEMSAAS_TOKEN_EN / _FR / _ES / _IT   store tokens (page skipped if missing)
 *   DRY_RUN=true    preview only, no writes (default true)
 *   ONLY=<handle>   deploy just one page
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HOST = 'https://openapi.oemapps.com';
const DRY_RUN = process.env.DRY_RUN !== 'false';
const ONLY = (process.env.ONLY || '').trim();

const TOKENS = {
  en: process.env.OEMSAAS_TOKEN_EN,
  fr: process.env.OEMSAAS_TOKEN_FR,
  es: process.env.OEMSAAS_TOKEN_ES,
  it: process.env.OEMSAAS_TOKEN_IT,
};
const DOMAIN = { en: 'www.momuto.com', fr: 'fr.momuto.com', es: 'es.momuto.com', it: 'it.momuto.com' };

const PAGES = [
  {
    handle: 'ai-concept-to-real-kit', locale: 'en',
    meta_title: 'AI Concept to Real Football Kit — We Make It Wearable | MOMUTO',
    meta_descript: 'Turn any AI-generated jersey concept (ChatGPT, Midjourney, Gemini) into a manufactured, wearable football kit. Designer recreation in 48h. €15 deposit, credited in full at 5+ jerseys.',
    keywords: 'ai football kit generator, ai jersey design real, turn ai design into real jersey, concept kit made real, custom football kit from ai',
  },
  {
    handle: 'maillot-ia-concept-reel', locale: 'fr',
    meta_title: 'Concept IA en Vrai Maillot de Foot — On le Fabrique | MOMUTO',
    meta_descript: 'Transformez un concept de maillot généré par IA (ChatGPT, Midjourney, Gemini) en vrai maillot fabriqué et portable. Recréation par un designer en 48h. Acompte de 15 €, crédité dès 5 maillots.',
    keywords: 'maillot ia, créer maillot foot ia, générateur maillot ia, transformer design ia en vrai maillot, maillot personnalisé ia',
  },
  {
    handle: 'camiseta-ia-concepto-real', locale: 'es',
    meta_title: 'De Concepto IA a Camiseta de Fútbol Real — La Fabricamos | MOMUTO',
    meta_descript: 'Convierte un concepto de camiseta generado con IA (ChatGPT, Midjourney, Gemini) en una camiseta real fabricada. Recreación por un diseñador en 48h. Depósito de 15 €, abonado a partir de 5 camisetas.',
    keywords: 'camiseta ia, diseñar camiseta futbol ia, generador camisetas ia, convertir diseño ia en camiseta real, equipacion personalizada ia',
  },
  {
    handle: 'maglia-ia-concetto-reale', locale: 'it',
    meta_title: 'Da Concept IA a Maglia da Calcio Reale — La Fabbrichiamo | MOMUTO',
    meta_descript: 'Trasforma un concept di maglia generato con IA (ChatGPT, Midjourney, Gemini) in una maglia vera, fabbricata. Ricreazione da parte di un designer in 48h. Deposito di 15 €, accreditato da 5 maglie.',
    keywords: 'maglia ia, creare maglia calcio ia, generatore maglie ia, trasformare design ia in maglia vera, maglia personalizzata ia',
  },
  {
    handle: 'bachelor-party-football-shirts', locale: 'en',
    meta_title: 'Custom Football Shirts for Stag Dos & Bachelor Parties | MOMUTO',
    meta_descript: 'One custom football kit for the whole stag squad — nicknames and numbers on every back. Design it free in 3D or send an AI concept. From €21.90/shirt at 10+. Order 5 weeks ahead.',
    keywords: 'stag do football shirts, bachelor party soccer jerseys, custom stag shirts, personalised stag do tops, hen party football shirts',
  },
  {
    handle: 'maillot-evg-personnalise', locale: 'fr',
    meta_title: 'Maillot de Foot Personnalisé EVG & EVJF | MOMUTO',
    meta_descript: 'Un maillot de foot personnalisé pour tout le groupe d\'EVG — surnoms et numéros sur chaque dos. Créez-le gratuitement en 3D ou envoyez un concept IA. Dès 20,90 €/maillot à partir de 10.',
    keywords: 'maillot evg personnalisé, maillot enterrement de vie de garçon, tee shirt evg foot, maillot evjf, maillot personnalisé groupe evg',
  },
  {
    handle: 'camisetas-despedida-de-soltero', locale: 'es',
    meta_title: 'Camisetas Personalizadas para Despedidas de Soltero y Soltera | MOMUTO',
    meta_descript: 'Una camiseta de fútbol personalizada para toda la despedida — apodos y dorsales en cada espalda. Diséñala gratis en 3D o envía un concepto de IA. Desde 21,90 €/camiseta a partir de 10.',
    keywords: 'camisetas despedida de soltero, camisetas despedida de soltera personalizadas, camiseta futbol despedida, equipacion despedida de soltero',
  },
];

function validate(p, html) {
  const errs = [];
  if (html.length < 5000) errs.push(`suspiciously short (${html.length} chars)`);
  if (/diseño gratis|design gratuit\b|free design proposal/i.test(html)) errs.push('pre-deposit "free design" wording detected');
  for (const m of html.matchAll(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/g)) {
    try { JSON.parse(m[1]); } catch (e) { errs.push(`bad JSON-LD: ${e.message}`); }
  }
  const otherDomains = Object.entries(DOMAIN).filter(([l]) => l !== p.locale).map(([, d]) => d)
    .filter(d => d !== 'www.momuto.com' && html.includes(d));
  if (otherDomains.length) errs.push(`links to wrong store domain(s): ${otherDomains.join(', ')}`);
  if (errs.length) throw new Error(`${p.handle}: ${errs.join(' | ')}`);
}

async function getExisting(handle, token) {
  const res = await fetch(`${HOST}/pages?handle=${handle}`, { headers: { token } });
  const json = await res.json();
  if (!res.ok || json.code !== 0) return null;
  const pages = json.data?.list || json.data || [];
  return Array.isArray(pages) ? (pages.find(pg => pg.handle === handle) || null) : null;
}

function pageData(p, content) {
  return { is_default: 0, title: p.meta_title, content, meta_title: p.meta_title,
    meta_keywords: p.keywords, meta_descript: p.meta_descript, handle: p.handle };
}

async function upsert(p, content) {
  const token = TOKENS[p.locale];
  if (!token) { console.log(`  [${p.handle}] no ${p.locale.toUpperCase()} token — skipped`); return; }
  const existing = await getExisting(p.handle, token);
  if (DRY_RUN) { console.log(`  DRY_RUN — would ${existing ? 'update' : 'create'} ${p.handle} on ${DOMAIN[p.locale]} (${content.length} chars)`); return; }
  if (existing) {
    try {
      const dir = path.join(ROOT, 'cms/concept-pages/archive');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${p.handle}.${Date.now()}.html`), existing.content || '');
    } catch (e) { console.log(`  (archive skipped: ${e.message})`); }
    const res = await fetch(`${HOST}/pages/${existing.id}`, { method: 'PUT',
      headers: { 'Content-Type': 'application/json', token },
      body: JSON.stringify({ ...pageData(p, content), id: existing.id }) });
    const json = await res.json();
    if (!res.ok || json.code !== 0) throw new Error(`PUT ${p.handle}: ${JSON.stringify(json)}`);
    console.log(`  ✓ updated ${p.handle}`);
  } else {
    const res = await fetch(`${HOST}/pages`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', token },
      body: JSON.stringify(pageData(p, content)) });
    const json = await res.json();
    if (!res.ok || json.code !== 0) throw new Error(`POST ${p.handle}: ${JSON.stringify(json)}`);
    console.log(`  ✓ created ${p.handle}`);
  }
  console.log(`    live: https://${DOMAIN[p.locale]}/pages/${p.handle}`);
}

(async () => {
  const pages = PAGES.filter(p => !ONLY || p.handle === ONLY);
  if (!pages.length) throw new Error(`no page matches ONLY=${ONLY}`);
  console.log(`deploy-concept-pages — ${pages.length} page(s), dry_run=${DRY_RUN}`);
  for (const p of pages) {
    const html = fs.readFileSync(path.join(ROOT, 'pages', p.handle), 'utf8');
    validate(p, html);
    await upsert(p, html);
  }
  console.log(DRY_RUN ? '\nDRY RUN complete — dispatch with dry_run=false to publish.' : '\nDeploy complete.');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
