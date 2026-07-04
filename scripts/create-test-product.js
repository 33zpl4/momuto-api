'use strict';

/**
 * One-off: create a TEST product via the OEMSaaS OpenAPI `POST /products` to
 * verify the create contract end-to-end (what id/fields come back). Runs on the
 * GitHub runner (which can reach openapi.oemapps.com; the sandbox can't).
 *
 * Creates it on the FR store as a HIDDEN product (status:0) so it never shows on
 * the live storefront — but it's visible in the CMS/manage for verification.
 * Handle: zz-api-test-delete-me  →  delete it in manage after checking.
 */

const HOST  = 'https://openapi.oemapps.com';
const TOKEN = process.env.OEMSAAS_TOKEN_FR;

async function main() {
  if (!TOKEN) { console.error('No OEMSAAS_TOKEN_FR'); process.exit(1); }

  const body = {
    title: 'ZZ API TEST — delete me',
    handle: 'zz-api-test-delete-me',
    spec_mode: 1,                       // single specification
    variants: [{ price: '19.90' }],     // price required
    images: [{                          // src required — reuse an existing CDN image so it validates
      src: 'https://cdn.staticsoe.com/pics/2cb10a0b0e8d3a67c7e768edce1a31d321097b8e26180eea525f683bf4df933b.jpg',
      alt: 'API test',
    }],
    status: 0,                          // hidden from storefront; visible in CMS
    subtitle: 'API create test',
    mini_detail: 'Created via POST /products to test the create contract.',
    meta_title: 'API Test Product',
    product_detail: 1,                  // return the FULL new product object, not just the id
  };

  console.log('POST', `${HOST}/products`);
  console.log('BODY', JSON.stringify(body));

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
  // Surface the fields that matter for the "create product from a design" question:
  const pick = (o, keys) => keys.reduce((a, k) => (o && o[k] !== undefined ? (a[k] = o[k], a) : a), {});
  console.log('RETURNED id / key fields:', JSON.stringify(pick(d, [
    'id', 'handle', 'spu', 'inner_title', 'status', 'title', 'detail_url',
  ]), null, 2));
  // Dump a trimmed full object so we can see everything the create produced.
  const trimmed = { ...d };
  if (trimmed.variants) trimmed.variants = `[${trimmed.variants.length} variant(s)]`;
  if (trimmed.images)   trimmed.images   = `[${trimmed.images.length} image(s)]`;
  console.log('FULL (trimmed):', JSON.stringify(trimmed).slice(0, 2500));
}

main().catch(e => { console.error(e); process.exit(1); });
