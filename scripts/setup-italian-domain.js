/**
 * One-time setup script for it.momuto.com.
 * Creates all required pages on the Italian CMS domain via POST.
 * Safe to re-run — skips pages that already exist (by handle).
 *
 * Usage:
 *   OEMSAAS_TOKEN_IT=xxx node scripts/setup-italian-domain.js
 *   OEMSAAS_TOKEN_IT=xxx node scripts/setup-italian-domain.js --dry-run
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RTP_DIR = path.join(ROOT, 'ready-to-play');
const HOST = 'https://openapi.oemapps.com';
const TOKEN = process.env.OEMSAAS_TOKEN_IT;
const DRY_RUN = process.argv.includes('--dry-run');

if (!TOKEN && !DRY_RUN) {
  console.error('OEMSAAS_TOKEN_IT env var is required');
  process.exit(1);
}

function read(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

const PAGES = [
  {
    handle: 'squadre-club-momuto',
    title: 'Squadre e Club — MOMUTO | Maglie da Calcio Personalizzate',
    meta_title: 'Squadre che indossano maglie MOMUTO | Galleria club calcio',
    meta_keywords: ['maglie calcio personalizzate', 'kit calcio personalizzato', 'squadre MOMUTO', 'sublimazione calcio'],
    meta_descript: 'Scopri le squadre e i club che hanno scelto MOMUTO per le loro maglie da calcio personalizzate. Qualità PRO, consegna in 3 settimane, senza ordine minimo.',
    contentFile: path.join(ROOT, 'pages', 'squadre-club-momuto'),
  },
  {
    handle: 'galleria-maglie-personalizzate',
    title: 'Galleria Maglie Personalizzate | MOMUTO',
    meta_title: 'Galleria Kit Calcio Personalizzati | MOMUTO Italia',
    meta_keywords: ['galleria maglie calcio', 'kit personalizzati', 'maglie su misura', 'MOMUTO'],
    meta_descript: 'Esplora la galleria di maglie da calcio personalizzate MOMUTO. Oltre 100 design unici per squadre amatoriali con stampa a sublimazione totale.',
    contentFile: path.join(ROOT, 'pages', 'galleria-maglie-personalizzate'),
  },
  {
    handle: 'chi-siamo',
    title: 'Chi Siamo — MOMUTO | Maglie da Calcio Personalizzate',
    meta_title: 'Chi Siamo — MOMUTO | Maglie da Calcio per Squadre Amateur',
    meta_keywords: ['chi siamo MOMUTO', 'brand maglie calcio', 'produttore kit calcio'],
    meta_descript: 'MOMUTO è un brand europeo di maglie da calcio personalizzate. Design professionale gratuito, stampa a sublimazione totale, consegna in 20-25 giorni senza ordine minimo.',
    contentFile: path.join(ROOT, 'pages', 'about-us-it'),
  },
  {
    handle: 'richiesta-design-personalizzato',
    title: 'Richiedi il Tuo Design Personalizzato | MOMUTO',
    meta_title: 'Richiesta Design Gratuito Maglie Calcio | MOMUTO',
    meta_keywords: ['richiesta design maglia calcio', 'design personalizzato maglie', 'maglie su misura'],
    meta_descript: 'Invia la tua proposta e ricevi un mockup professionale gratuito in 24-48 ore. Design gratuito, senza ordine minimo, consegna in 20-25 giorni.',
    content: '<p>Pagina in costruzione.</p>',
  },
  {
    handle: 'perche-momuto',
    title: 'Perché MOMUTO | Confronto fornitori maglie calcio',
    meta_title: 'Perché scegliere MOMUTO per le maglie da calcio',
    meta_keywords: ['confronto fornitori maglie calcio', 'perché MOMUTO', 'alternativa maglie calcio'],
    meta_descript: 'Scopri perché MOMUTO è la scelta migliore per maglie da calcio personalizzate. Confronto con altri fornitori su qualità, prezzo e servizio.',
    content: '<p>Pagina in costruzione.</p>',
  },
  {
    handle: 'collezione-ready-to-play',
    title: 'Collezione Ready-to-Play | Maglie Calcio Pre-Disegnate | MOMUTO',
    meta_title: 'Maglie Ready-to-Play — Collezione MOMUTO Italia',
    meta_keywords: ['ready-to-play', 'maglia calcio pre-disegnata', 'kit calcio pronto', 'MOMUTO'],
    meta_descript: 'Design creati dai nostri designer, indossati da veri club. Nessuna fase di design. Risparmia tempo e risparmia il 10%. Consegna in 20-25 giorni.',
    contentFile: path.join(RTP_DIR, 'collection', 'it.html'),
  },
  {
    handle: 'ready-to-play-the-kinetic',
    title: 'The Kinetic — Maglia Ready-to-Play | MOMUTO',
    meta_title: 'The Kinetic — Maglia Calcio Geometrica Moderna | MOMUTO',
    meta_keywords: ['the kinetic', 'maglia calcio geometrica', 'ready-to-play MOMUTO'],
    meta_descript: 'Aggressività nel design. Grafiche fratturate che simulano il movimento ad alta velocità. Scegli i tuoi colori, anteprima in 24h.',
    contentFile: path.join(RTP_DIR, 'templates', 'the-kinetic', 'it.html'),
  },
  {
    handle: 'ready-to-play-the-legacy',
    title: 'The Legacy — Maglia Ready-to-Play | MOMUTO',
    meta_title: 'The Legacy — Maglia Calcio Retro Classica | MOMUTO',
    meta_keywords: ['the legacy', 'maglia calcio retro', 'ready-to-play MOMUTO'],
    meta_descript: 'Autorità senza tempo. Doppia architettura verticale a pilastri con una precisa striscia centrale. Scegli i tuoi colori, anteprima in 24h.',
    contentFile: path.join(RTP_DIR, 'templates', 'the-legacy', 'it.html'),
  },
  {
    handle: 'ready-to-play-the-apex',
    title: 'The Apex — Maglia Ready-to-Play | MOMUTO',
    meta_title: 'The Apex — Maglia Calcio Aerodinamica | MOMUTO',
    meta_keywords: ['the apex', 'maglia calcio aerodinamica', 'ready-to-play MOMUTO'],
    meta_descript: 'Progettata per la velocità. Pannelli laterali aerodinamici ispirati agli anni 2000. Scegli i tuoi colori, anteprima in 24h.',
    contentFile: path.join(RTP_DIR, 'templates', 'the-apex', 'it.html'),
  },
  {
    handle: 'ready-to-play-the-mosaic',
    title: 'The Mosaic — Maglia Ready-to-Play | MOMUTO',
    meta_title: 'The Mosaic — Maglia Calcio Pattern Anni 90 | MOMUTO',
    meta_keywords: ['the mosaic', 'maglia calcio pattern', 'ready-to-play MOMUTO'],
    meta_descript: "Scacchiera frammentata anni '90. Una griglia densa e irregolare con zona badge solida. Scegli i tuoi colori, anteprima in 24h.",
    contentFile: path.join(RTP_DIR, 'templates', 'the-mosaic', 'it.html'),
  },
  {
    handle: 'ready-to-play-the-fracture',
    title: 'The Fracture — Maglia Ready-to-Play | MOMUTO',
    meta_title: 'The Fracture — Maglia Calcio Texture Moderna | MOMUTO',
    meta_keywords: ['the fracture', 'maglia calcio texture', 'ready-to-play MOMUTO'],
    meta_descript: 'Terreno spezzato. Pattern diagonale grezzo con profondità a tre toni dai tuoi colori squadra. Scegli i tuoi colori, anteprima in 24h.',
    contentFile: path.join(RTP_DIR, 'templates', 'the-fracture', 'it.html'),
  },
];

async function getExisting(handle) {
  const res = await fetch(`${HOST}/pages?handle=${handle}`, { headers: { token: TOKEN } });
  const j = await res.json();
  if (!res.ok || j.code !== 0) return null;
  const pages = j.data?.list || j.data || [];
  return Array.isArray(pages) ? (pages.find(p => p.handle === handle) || null) : null;
}

async function createPage(pageData) {
  const res = await fetch(`${HOST}/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token: TOKEN },
    body: JSON.stringify(pageData),
  });
  const j = await res.json();
  if (!res.ok || j.code !== 0) throw new Error(JSON.stringify(j));
  return j;
}

async function updatePage(id, pageData) {
  const res = await fetch(`${HOST}/pages/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', token: TOKEN },
    body: JSON.stringify(pageData),
  });
  const j = await res.json();
  if (!res.ok || j.code !== 0) throw new Error(JSON.stringify(j));
  return j;
}

async function main() {
  console.log(`Dry run: ${DRY_RUN}`);
  console.log(`Setting up ${PAGES.length} pages on it.momuto.com\n`);

  const errors = [];

  for (const page of PAGES) {
    const content = page.contentFile ? read(page.contentFile) : (page.content || '');
    if (!content && !DRY_RUN) {
      console.warn(`⚠️  ${page.handle}: no content file found at ${page.contentFile} — skipping`);
      continue;
    }

    const payload = {
      is_default: 0,
      title: page.title,
      content,
      meta_title: page.meta_title,
      meta_keywords: page.meta_keywords,
      meta_descript: page.meta_descript,
      handle: page.handle,
    };

    if (DRY_RUN) {
      console.log(`[DRY RUN] would create/update: ${page.handle} (${content.length} chars)`);
      continue;
    }

    try {
      const existing = await getExisting(page.handle);
      if (existing) {
        await updatePage(existing.id, payload);
        console.log(`✓ Updated: ${page.handle}`);
      } else {
        await createPage(payload);
        console.log(`✓ Created: ${page.handle}`);
      }
    } catch (e) {
      console.error(`❌ ${page.handle}: ${e.message}`);
      errors.push(page.handle);
    }
  }

  if (errors.length) {
    console.error(`\n${errors.length} error(s): ${errors.join(', ')}`);
    process.exit(1);
  }
  console.log('\n✓ Done. All Italian pages set up.');
}

main().catch(e => { console.error(e); process.exit(1); });
