'use strict';

/**
 * One-off TEST 2: create a product via `POST /products` WITH an `inner_title`
 * (the 3D-configurator pointer) to confirm the "Personnalisez votre design"
 * customizer wires up on API-create — the only field that made Metz/Pornic
 * behave differently. Reuses the Metz design's productId (17283); configId is
 * derived as "mamuto3" + productId (the pattern seen on both Metz & Pornic).
 *
 * Runs on the GitHub runner (the sandbox can't reach openapi.oemapps.com).
 * Published so the page renders; delete it after checking.
 * FR store · handle: zz-api-test-3d-delete-me
 */

const HOST  = 'https://openapi.oemapps.com';
const TOKEN = process.env.OEMSAAS_TOKEN_FR;

// Reuse a real saved design's productId to prove the customizer links up.
const DESIGN_PRODUCT_ID = '17283';                 // Metz design
const SUIT = 'mamuto3';
const INNER = JSON.stringify({
  type: '3d',
  mudel: `configId=${SUIT}${DESIGN_PRODUCT_ID}&suitName=${SUIT}`,  // configId = suitName + productId
  activity: '',
  productId: DESIGN_PRODUCT_ID,
});

async function main() {
  if (!TOKEN) { console.error('No OEMSAAS_TOKEN_FR'); process.exit(1); }

  const body = {
    title: 'ZZ API TEST 3D — delete me',
    handle: 'zz-api-test-3d-delete-me',
    spec_mode: 1,
    variants: [{ price: '25.90' }],
    images: [{ src: 'https://cdn.staticsoe.com/pics/2cb10a0b0e8d3a67c7e768edce1a31d321097b8e26180eea525f683bf4df933b.jpg', alt: 'API 3D test' }],
    inner_title: INNER,       // ← the 3D customizer pointer
    status: 1,                // published so the product page renders + button shows
    subtitle: 'API create test — with 3D inner_title',
    product_detail: 1,
  };

  console.log('POST', `${HOST}/products`);
  console.log('inner_title we send:', INNER);

  const res = await fetch(`${HOST}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token: TOKEN },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log('HTTP', res.status);
  let json; try { json = JSON.parse(text); } catch { console.log('RAW', text.slice(0, 2000)); process.exit(1); }
  console.log('code:', json.code, '| msg:', json.msg);
  const d = json.data || {};
  const pick = (o, keys) => keys.reduce((a, k) => (o && o[k] !== undefined ? (a[k] = o[k], a) : a), {});
  console.log('RETURNED:', JSON.stringify(pick(d, ['id', 'handle', 'spu', 'inner_title', 'status', 'title']), null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
