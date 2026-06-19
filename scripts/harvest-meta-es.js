/**
 * ES Phase-1 harvest: set SEO meta (title + description) on es.momuto.com
 * pages that already rank on/near page 1, WITHOUT touching page content —
 * so the before/after CTR read stays clean (one variable changed).
 *
 * Only /pages/ handles are handled here. Collections, blog posts and the
 * homepage use other endpoints and are applied via the CMS (see harvest pack).
 *
 * Env:
 *   OEMSAAS_TOKEN_ES  - required
 *   DRY_RUN=true      - preview without writing
 *
 * Idempotent: skips a page whose meta already matches the target.
 */

const HOST = 'https://openapi.oemapps.com';
const TOKEN = process.env.OEMSAAS_TOKEN_ES;
const DRY_RUN = process.env.DRY_RUN === 'true';

// Exact titles/metas from the ES Phase-1 Harvest Pack (verified vs GSC export).
const TARGETS = [
  {
    handle: 'equipos-momuto', // pos 1.2 · 1001 impr · CTR 2.4% — REAL TEAM PHOTOS (social proof, NOT a selling page)
    meta_title: 'Equipos que Visten MOMUTO: Equipaciones Reales | MOMUTO',
    meta_descript: 'Mira a clubes y equipos reales con sus equipaciones MOMUTO personalizadas, sus camisetas en acción. Diseña la de tu equipo sin pedido mínimo.'
  },
  {
    handle: 'solicitud-de-diseno-personalizado', // pos 1.5 · 898 impr · CTR 1.0%
    meta_title: 'Solicita tu Diseño de Equipación Gratis | MOMUTO',
    meta_descript: 'Cuéntanos tu idea o envía una referencia y nuestra IA crea tu concepto de equipación gratis. Edítalo en 3D y pídelo sin pedido mínimo.'
  },
  {
    handle: 'camisetas-futbol-personalizadas-madrid', // pos 12.9 · 840 impr · CTR 1.7%
    meta_title: 'Equipaciones de Fútbol Personalizadas en Madrid | MOMUTO',
    meta_descript: 'Equipaciones y camisetas personalizadas para equipos de Madrid. Diseño 3D + IA, sin pedido mínimo y entrega rápida en toda la Comunidad.'
  },
  {
    handle: 'zentral-opiniones-alternativa', // pos 6.9 · 336 impr · CTR 2.1%
    meta_title: 'Alternativa a Zentral: Equipaciones Comparadas | MOMUTO',
    meta_descript: '¿Buscas una alternativa a Zentral? Compara diseño 3D + IA, plazos, mínimos y precio para crear la equipación de tu equipo.'
  },
  {
    handle: 'camisetas-futbol-personalizadas-canarias', // pos 7.8 · 55 impr · CTR 3.6%
    meta_title: 'Equipaciones de Fútbol Personalizadas en Canarias | MOMUTO',
    meta_descript: 'Equipaciones y camisetas personalizadas para equipos de Canarias. Diseño 3D + IA, sin pedido mínimo y envío a todas las islas.'
  },
  {
    handle: 'equipaciones-superleague-aragon', // pos 7.5 · 54 impr · CTR 3.7%
    meta_title: 'Equipaciones Personalizadas Superleague Aragón | MOMUTO',
    meta_descript: 'Equipaciones personalizadas para equipos de la Superleague Aragón. Diséñalas en 3D, sin pedido mínimo y a tiempo para la liga.'
  }
];

async function getPageByHandle(handle) {
  const res = await fetch(`${HOST}/pages?handle=${handle}`, { headers: { token: TOKEN } });
  const json = await res.json();
  if (!res.ok || json.code !== 0) throw new Error(`GET /pages?handle=${handle} failed: ${JSON.stringify(json)}`);
  const pages = json.data?.list || json.data || [];
  return Array.isArray(pages) ? (pages.find(p => p.handle === handle) || null) : null;
}

async function putMeta(page, t) {
  // Preserve content + title; change only the SEO meta fields.
  const res = await fetch(`${HOST}/pages/${page.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', token: TOKEN },
    body: JSON.stringify({
      content: page.content,
      title: page.title,
      meta_title: t.meta_title,
      meta_keywords: page.meta_keywords,
      meta_descript: t.meta_descript,
      handle: page.handle
    })
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) throw new Error(`PUT /pages/${page.id} failed: ${JSON.stringify(json)}`);
}

async function main() {
  if (!TOKEN) { console.error('❌ OEMSAAS_TOKEN_ES not set'); process.exit(1); }
  console.log(`Dry run: ${DRY_RUN}\n`);
  const errors = [];
  for (const t of TARGETS) {
    try {
      const page = await getPageByHandle(t.handle);
      if (!page) { console.warn(`⚠️  ${t.handle}: not found — skipping`); continue; }
      if (page.meta_title === t.meta_title && page.meta_descript === t.meta_descript) {
        console.log(`✓ ${t.handle}: already set`);
        continue;
      }
      console.log(`${t.handle}:`);
      console.log(`   title: "${page.meta_title || ''}" → "${t.meta_title}"`);
      if (DRY_RUN) { console.log('   DRY_RUN — no write'); continue; }
      await putMeta(page, t);
      console.log(`   ✓ updated (content preserved)`);
    } catch (e) {
      console.error(`❌ ${t.handle}: ${e.message}`);
      errors.push(t.handle);
    }
  }
  if (errors.length) { console.error(`\n${errors.length} error(s): ${errors.join(', ')}`); process.exit(1); }
  console.log('\n✅ Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
