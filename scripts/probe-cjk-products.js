// Read-only probe: lists every product on each store via the CMS API and
// reports any whose title or handle contains CJK characters (the July 2026
// "测试商品" test product that got indexed). Never writes. Throttle-safe:
// one GET per page, 400 ms apart.
const STORES = { en: 'OEMSAAS_TOKEN_EN', es: 'OEMSAAS_TOKEN_ES', fr: 'OEMSAAS_TOKEN_FR', it: 'OEMSAAS_TOKEN_IT', us: 'OEMSAAS_TOKEN_US' };
const HOST = 'https://openapi.oemapps.com';
const CJK = /[㐀-鿿豈-﫿]/;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function listAll(token) {
  const out = [];
  for (let page = 1; page < 200; page++) {
    const res = await fetch(`${HOST}/products?page=${page}&pagesize=50`, { headers: { token } });
    const json = await res.json();
    if (!res.ok || json.code !== 0) throw new Error(`page ${page}: ${JSON.stringify(json).slice(0, 200)}`);
    const list = (json.data && (json.data.list || json.data)) || [];
    if (!Array.isArray(list) || !list.length) break;
    out.push(...list);
    if (list.length < 50) break;
    await sleep(400);
  }
  return out;
}

(async () => {
  let found = 0;
  for (const [store, env] of Object.entries(STORES)) {
    const token = process.env[env];
    if (!token) { console.log(`[${store}] no token — skipped`); continue; }
    const items = await listAll(token);
    const hits = items.filter(p => CJK.test(`${p.title || ''} ${p.handle || ''}`));
    found += hits.length;
    console.log(`[${store}] ${items.length} products, ${hits.length} with CJK in title/handle`);
    for (const p of hits) console.log(`   id=${p.id} status=${p.status} handle=${p.handle} title=${p.title}`);
  }
  console.log(found ? `\n${found} CJK product(s) still present.` : '\nNo CJK products on any store.');
})().catch(e => { console.error(e); process.exit(1); });
