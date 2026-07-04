# CMS product-create API — `POST /products`

The OEMSaaS OpenAPI **can create a product** (what manage.momuto.com does under the
hood). This is how we can turn a validated design into an orderable product from a
chat command — no manual manage step. Source: the OpenAPI "New / 新增 product" doc,
cross-checked against the live `cms/products/fr/maillot-pornic-fc.json`.

## Endpoint
```
POST https://openapi.oemapps.com/products
Header: token = <store token>   (OEMSAAS_TOKEN_EN/FR/ES/IT — one per store)
Body:   application/json
→ { "code": 0, "msg": "success", "data": { "id": "<new product id>" } }
```

## Required fields
- `title` (string)
- `variants` (array) — each variant needs `variants.price` (string, required)
- `images` (array) — each needs `images.src` (string, required — full CDN path)
- `spec_mode` (number) — `1` = single specification, `2` = multiple (size options)

## Other useful fields
- `handle` (string) — URL slug
- `status` (number) — `1` = available for purchase, `0` = hidden
- `subtitle`, `mini_detail` (short description), `body_html` (the "Détail" tab HTML)
- **`inner_title` (string) — the 3D customizer pointer** (doc calls it "Internal name").
  On a real custom product it holds the JSON that wires the "Personnalisez votre design"
  button to that design's configurator:
  ```
  {"type":"3d","mudel":"configId=<CONFIG>&suitName=mamuto3","activity":"","productId":"<PID>"}
  ```
- SEO: `meta_title`, `meta_descript`, `meta_keywords` (array), `tags` (array) — set at create time.
- `options` / `options.values.option_value` + `variants.option1_title/…_value_title` — only for `spec_mode:2` (size variants).
- `collections` / `collections.collection_id`, `product_type`, `vendor`, `spu`,
  `free_shipping`, `taxable`, `inventory_tracking`, `inventory_policy`,
  `variants.sku` / `.barcode` / `.inventory_quantity` / `.weight` / `.compare_at_price` / `.src`.
- `product_detail` — `0` = response returns just the new product id; `1` = full object.

## Custom-jersey product — the shape that works (from the live Pornic product)
Pornic is **`spec_mode:1`, a single variant, one price** (sizes handled in the 3D
customizer, not as product variants). So a custom product is simpler than RTP:

```json
POST /products
{
  "title": "Maillot Pornic FC",
  "handle": "maillot-pornic-fc",
  "spec_mode": 1,
  "variants": [{ "price": "25.90" }],
  "images": [
    { "src": "https://cdn.staticsoe.com/pics/<front>.jpg" },
    { "src": "https://cdn.staticsoe.com/pics/<back>.jpg" }
  ],
  "inner_title": "{\"type\":\"3d\",\"mudel\":\"configId=<CONFIG>&suitName=mamuto3\",\"activity\":\"\",\"productId\":\"<PID>\"}",
  "status": 1,
  "subtitle": "Custom Football Kit — Your Names & Numbers",
  "mini_detail": "…",
  "meta_title": "…",
  "meta_descript": "…",
  "meta_keywords": ["custom football kit", "…"]
}
```

SEO ships in the same call (no separate `/products/batchsave`). After create, the
`custom-content.js` theme block auto-decorates the page (trust / delivery / FAQ).

## Per-design inputs (the only variables)
1. **`title`** — the design/team name.
2. **`images[].src`** — the design's rendered front/back URLs (reuse the gallery assets).
3. **`price`** — set by us.
4. **`inner_title` → `configId` + `productId`** — the design's 3D-configurator ids.
   These come from the **3D tool (design.momuto.com) when the design is saved**, and are
   the one thing not derivable from the product itself.
   - ⚠️ Do **not** assume a formula. Pornic's `configId` (`mamuto317228`) happens to equal
     `suitName`+`productId` (`mamuto3`+`17228`), but the RTP generic config is `ypi9qc1z`
     (a different shape). Source `configId`/`productId` from the 3D tool / gallery flow.

## How it plugs into the pipeline
- **Create** with the body above → new product id.
- **Decorate** — the `custom-content.js` theme block (already built) applies automatically.
- **SEO** — set inline in the create body (or later via `/products/batchsave`, which we already use).
- Result: "validated design → orderable product" becomes one API call driven from the
  same chat/automation that builds the gallery page. The remaining dependency is handing
  the create call the design's `configId`/`productId`.

## Related (already in this repo)
- `scripts/push-product-seo.js` — `POST /products/batchsave` (partial **update**: SEO fields only).
- `cms/products/fr/maillot-pornic-fc.json` — a real product object (field reference).
- `public/configurator/custom-content.js` — the theme block that decorates custom product pages.
- `public/configurator/ADDING-A-TEMPLATE.md` §6 — the (now-supersedable) manual manage.momuto.com create step.
