// Read-only: lists every product on each store via the CMS API and prints the
// ones whose title or handle matches MATCH (a case-insensitive regex; default:
// basketball words in the five store languages). Use it to find product ids
// for checkSumbit maps and pointer files. Never writes. One GET per page,
// 400 ms apart (cursor pagination: limit + since_id).
const STORES = { en: 'OEMSAAS_TOKEN_EN', es: 'OEMSAAS_TOKEN_ES', fr: 'OEMSAAS_TOKEN_FR', it: 'OEMSAAS_TOKEN_IT', us: 'OEMSAAS_TOKEN_US' };
const HOST = 'https://openapi.oemapps.com';
const MATCH = new RegExp(process.env.MATCH || 'basket|baloncesto|pallacanestro', 'i');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function listAll(token) {
  const out = [];
  let since = '';
  for (let i = 0; i < 100; i++) {
    const res = await fetch(`${HOST}/products?limit=100${since ? `&since_id=${since}` : ''}`, { headers: { token } });
    const json = await res.json();
    if (!res.ok || json.code !== 0) throw new Error(`since_id=${since || '-'}: ${JSON.stringify(json).slice(0, 200)}`);
    const d = json.data;
    const list = (d && (d.products || d.list)) || (Array.isArray(d) ? d : []);
    if (!list.length) break;
    out.push(...list);
    const last = String(list[list.length - 1].id);
    if (last === since) break;
    since = last;
    await sleep(400);
  }
  return out;
}

(async () => {
  console.log(`MATCH = ${MATCH}`);
  for (const [store, env] of Object.entries(STORES)) {
    const token = process.env[env];
    if (!token) { console.log(`[${store}] no token — skipped`); continue; }
    const items = await listAll(token);
    const hits = items.filter(p => MATCH.test(`${p.title || ''} ${p.handle || ''}`));
    console.log(`\n[${store}] ${items.length} products, ${hits.length} match`);
    for (const p of hits) {
      const v = (p.variants || p.skus || [])[0] || {};
      console.log(`   id=${p.id} status=${p.status} price=${p.price ?? v.price ?? '?'} sku=${v.sku_code || v.sku || '?'} handle=${p.handle} title=${p.title}`);
    }
  }
})().catch(e => { console.error(e); process.exit(1); });
