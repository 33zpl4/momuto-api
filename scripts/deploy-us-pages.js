'use strict';

/**
 * Deploys the US store's page estate (us.momuto.com) from pages/us/<handle>.
 *
 * Upserts by handle (create if missing, update in place), modeled on
 * deploy-ready-to-play-page.js. The whole script is a clean no-op until the
 * owner provisions OEMSAAS_TOKEN_US (docs/us-hub-plan.md §A) — a missing
 * token skips every page with a warning instead of failing the run.
 *
 * The request gate ships with the __STRIPE_LINK_US__ placeholder until the
 * US (USD) Stripe payment link exists — same discipline as the IT gate: a
 * page whose pay button goes nowhere is worse than no page, so deploy of
 * that page (and only that page) is refused while the placeholder remains.
 *
 * Env:
 *   OEMSAAS_TOKEN_US     - US store API token
 *   DRY_RUN=true|false   - default true (set false to write)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HOST = 'https://openapi.oemapps.com';
const DRY_RUN = process.env.DRY_RUN !== 'false';
const DOMAIN = 'us.momuto.com';

const PAGES = [
  {
    handle: 'ready-to-play',
    title: 'Ready to Play — Free 3D Soccer Jersey Designer | MOMUTO',
    meta_title: 'Free 3D Soccer Jersey Designer — Ready to Play | MOMUTO',
    meta_descript: 'Design a real soccer jersey in 3D, free. Every Ready to Play design loads finished — recolor it, add your crest, names and numbers, and order from one jersey.',
    keywords: [
      '3d soccer jersey designer',
      'soccer jersey designer free',
      'custom soccer jerseys',
      'custom soccer uniforms',
      'soccer uniform designer',
      'design soccer jersey online free',
      'soccer jersey maker',
      'jersey creator',
      'custom team uniforms',
    ],
  },
  {
    handle: 'request-custom-kit-design',
    title: 'Custom Soccer Jersey Design Service | MOMUTO',
    meta_title: 'Custom Soccer Jersey Design — First Mockup in 24-48h | MOMUTO',
    meta_descript: 'A $15 deposit puts a designer on your concept. First mockup in 24-48 hours, revisions included — the deposit is credited in full to orders of 5+ jerseys.',
    keywords: [
      'custom soccer jersey design',
      'custom soccer uniform design service',
      'soccer jersey designer',
      'team uniform design',
      'custom jersey mockup',
      'MOMUTO',
    ],
  },
  {
    handle: 'ai-concept-to-real-kit',
    title: 'AI Soccer Jersey Generator — Concept to Real Jersey | MOMUTO',
    meta_title: 'AI Soccer Jersey Generator to Real Custom Jersey | MOMUTO',
    meta_descript: 'Made a soccer jersey concept with ChatGPT, Gemini or Midjourney? We turn AI jersey designs into real, wearable custom uniforms. $15 deposit, mockup in 24-48h.',
    keywords: [
      'ai soccer jersey generator',
      'ai jersey design',
      'ai generated soccer jersey',
      'chatgpt jersey design real',
      'midjourney soccer jersey',
      'custom soccer jersey from ai',
    ],
  },
  {
    handle: 'custom-basketball-jerseys',
    title: 'Custom Basketball Jerseys — Free 3D Designer | MOMUTO',
    meta_title: 'Custom Basketball Jerseys — Design in 3D, No Minimum | MOMUTO',
    meta_descript: 'Design custom basketball jerseys in a free 3D designer. Full dye-sublimation, per-player names and numbers, no minimum order, US delivery in 25-30 days.',
    keywords: [
      'custom basketball jerseys',
      'custom basketball uniforms',
      'basketball jersey designer',
      'basketball jersey maker',
      'design basketball jersey online',
      'basketball uniform creator',
      'reversible basketball jerseys custom',
    ],
  },
];

function sanityCheck(p, content) {
  if (!content.includes('Bebas Neue') || !content.includes('Outfit')) {
    throw new Error(`${p.handle}: missing Bebas Neue + Outfit fonts`);
  }
  const h1Count = (content.match(/<h1\b/g) || []).length;
  if (h1Count !== 1) throw new Error(`${p.handle}: must have exactly 1 <h1> (found ${h1Count})`);
  for (const blk of content.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || []) {
    JSON.parse(blk.replace(/<\/?script[^>]*>/g, ''));
  }
  if (!Array.isArray(p.keywords)) throw new Error(`${p.handle}: keywords must be an array (CMS rejects strings)`);
  if (p.meta_title.length > 65) throw new Error(`${p.handle}: meta_title ${p.meta_title.length}/65`);
  if (p.meta_descript.length > 160) throw new Error(`${p.handle}: meta_descript ${p.meta_descript.length}/160`);
  if (!content.includes('design.momuto.com/3d-configurator/configurator.html')) {
    throw new Error(`${p.handle}: missing the 3D designer deep link`);
  }
  // One set of numbers: the US store is USD-only. Any euro sign is a bug.
  if (/€|EUR/.test(content)) throw new Error(`${p.handle}: contains € / EUR — US store is USD-only`);
  // US Stripe link gate — same rule as the IT gate (see deploy-request-design-page.js).
  if (content.includes('__STRIPE_LINK_US__')) {
    throw new Error(
      `${p.handle}: still contains the __STRIPE_LINK_US__ placeholder — create the US (USD) ` +
      `Stripe payment link, replace every occurrence, and redeploy. See docs/us-hub-plan.md §A.5.`
    );
  }
  const hasGate = content.includes('id="payment-gate"');
  if (hasGate) {
    for (const id of ['paidBanner', 'brief-form-section', 'cta-form', 'gatePayBtn']) {
      if (!content.includes(id)) throw new Error(`${p.handle}: payment gate missing ${id}`);
    }
    const stripeLinks = new Set(content.match(/https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+/g) || []);
    if (stripeLinks.size !== 1) {
      throw new Error(`${p.handle}: ${stripeLinks.size} distinct Stripe links — expected exactly 1`);
    }
  }
}

async function getExisting(handle, token) {
  const res = await fetch(`${HOST}/pages?handle=${handle}`, { headers: { token } });
  const json = await res.json();
  if (!res.ok || json.code !== 0) return null;
  const pages = json.data?.list || json.data || [];
  return Array.isArray(pages) ? (pages.find(pg => pg.handle === handle) || null) : null;
}

async function upsert(p, token) {
  const file = path.join(ROOT, 'pages', 'us', p.handle);
  if (!fs.existsSync(file)) { console.log(`  [${p.handle}] no fragment at pages/us/${p.handle} — skipped`); return; }
  const content = fs.readFileSync(file, 'utf8');
  sanityCheck(p, content);

  const existing = await getExisting(p.handle, token);
  const payload = {
    is_default: 0, title: p.title, content,
    meta_title: p.meta_title, meta_keywords: p.keywords,
    meta_descript: p.meta_descript, handle: p.handle,
    ...(existing?.og_image ? { og_image: existing.og_image } : {}), // PUT replaces whole object — don't drop the social image
  };

  if (DRY_RUN) {
    console.log(`  DRY_RUN — would ${existing ? 'update' : 'create'} ${p.handle} on ${DOMAIN} (${content.length} chars)`);
    return;
  }

  const res = await fetch(existing ? `${HOST}/pages/${existing.id}` : `${HOST}/pages`, {
    method: existing ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json', token },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) {
    throw new Error(`${existing ? 'PUT' : 'POST'} ${p.handle}: ${JSON.stringify(json).slice(0, 200)}`);
  }
  console.log(`  ✅ ${existing ? 'updated' : 'created'} https://${DOMAIN}/pages/${p.handle}`);
}

async function main() {
  const token = process.env.OEMSAAS_TOKEN_US;
  console.log(`deploy-us-pages — ${PAGES.length} page(s), dry_run=${DRY_RUN}`);
  if (!token) {
    console.warn('⚠️  OEMSAAS_TOKEN_US not set — US store not provisioned yet, nothing to deploy (see docs/us-hub-plan.md §A). Skipping cleanly.');
    return;
  }
  const only = (process.env.TARGET_HANDLE || '').trim();
  let failed = 0;
  for (const p of PAGES) {
    if (only && p.handle !== only) continue;
    try { await upsert(p, token); }
    catch (e) { console.error(`  FAILED ${p.handle}: ${e.message}`); failed++; }
  }
  if (failed) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
