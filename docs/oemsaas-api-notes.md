# OEMSaaS API — behaviour we had to learn the hard way

`openapi.oemapps.com` is the API behind manage.momuto.com. Its published docs
describe fields; they do not describe what the endpoints actually *do* with
them. Everything below was established by running against the live stores and
reading the result back — not inferred, not assumed.

Read this before writing anything that creates or updates a product. Every item
here cost a failed run, a wrong conclusion, or both.

---

## The one rule

> **`code: 0` means the request was accepted. It does not mean your field was.**

`batchsave` returns `code 0` for a payload it silently discards half of. This is
the single most expensive lesson in this document, and every other rule is a
consequence of it.

So: **read the record back after every write.** `scripts/create-iconic-products.js
--audit` exists for exactly this and is worth copying for any other resource.
An acknowledgement is not evidence.

---

## Endpoint semantics

| Endpoint | What it really is |
|---|---|
| `POST /products` | Create. Full payload. Returns `data.id`. |
| `POST /products/batchsave` | **Partial update, SEO/editorial fields only.** Ignores anything else *without complaining* — see below. |
| `PUT /products/{id}` | **Full REPLACE.** Validates the whole product; a partial body is rejected. |
| `GET /products?limit=100&since_id=` | List. **Omits heavyweight fields.** Cursor-paginated on `since_id`. |
| `GET /products/{id}` | Single product, complete. Use this whenever a field's *value* matters. |
| `DELETE /products/{id}` | Hard delete. |
| `GET /collections?page=&pagesize=` | List collections (this is how you find `collection_id`). |
| `GET /collections/{id}` | Single collection — **includes the page body**, see below. |
| `PUT /collections/{id}` | Update a collection. Assume REPLACE, like products. |
| `PUT /pages/{id}` | CMS pages. |

### A collection carries its own page

`GET /collections/{id}` returns, alongside the SEO fields:

```
title, meta_title, meta_descript, meta_keywords[]
top_descript      ← THE COLLECTION PAGE HTML, in full
bottom_descript
handle, src, sort_order, product_count, created_at, updated_at, metafields[]
```

`top_descript` is where a custom collection page actually lives. So collection
pages are **API-updatable** — they do not have to be pasted into the CMS.

This corrects a note in `scripts/fix-perche-momuto-links.js`, which records
collections as "report-only … updated via xlsx import". That was never true of
the API; it just hadn't been tried. Anything that skipped collections on that
basis is worth revisiting.

`product_count`, `created_at` and `updated_at` come back on the read and are
presumably derived. Read-modify-write sends them back untouched, which is the
safest thing available — don't hand-build the body.

### `batchsave` silently drops fields

Sending `images` through `batchsave` returns `code 0` on every product, the SEO
lands, and **the gallery does not change**. No error, no warning, no partial
success indicator. The only way to find out is to read the product back.

Assume `batchsave` carries: `title`, `subtitle`, `mini_detail`, `body_html`,
`meta_title`, `meta_descript`. Assume it carries nothing else until proven
otherwise, *by reading back*.

### `PUT` replaces — so read-modify-write

`PUT /products/{id}` with `{ id, images }` returns:

```
API code 500: title不能为空
```

It validates the entire product, which means a body you compose by hand
replaces everything you didn't think to include. The dangerous case is
`variants`: a PUT without them takes the six sizes and the buy button with
them, and returns `code 0` while doing it.

The only safe shape:

```js
const live = await fetchProduct(id, token);   // GET /products/{id}
if (!live?.title) throw new Error('refusing to PUT blind');
if (!live.variants?.length) throw new Error('refusing to PUT — would drop the sizes');
await send(`${HOST}/products/${id}`, 'PUT', token, { ...live, images: ours });
```

Guard on the read-back before sending. If the GET failed, the correct action is
to stop, not to send a payload assembled from what you happen to have.

**PUT regenerates variant ids.** Confirmed 5 Sep 2026 on the US store
(`reprice-us-products.js`): a PUT that sends the GET'd `variants` back with a
new `price` keeps count, sizes, SKUs, images and title, but every variant
comes back under a NEW id (167967568 → 170067570). Anything bound to a
variant id (a cart line, a per-variant promotion, a feed) is orphaned. Verify
by position/size after a PUT, never by id. `batchsave` cannot change prices at
all (code 0, price unchanged — confirmed the same day), so a price change
means accepting the id churn.

⚠️ `scripts/cleanup-preview-products.js` sends `{ id, status: 0 }` to this
endpoint. Given the validation above, that call is very likely failing — it
logs a warning and continues, so nobody would notice products staying visible.
**Unverified; check before trusting it.**

### The list endpoint omits fields

`GET /products` returns `body_html` as an empty string. This is not the
product's state — it is the list endpoint economising. We built a whole
conclusion on a false zero ("drop 01 has no body_html, so content must live in
templates") before catching it.

**Never infer emptiness from a list response.** Re-read the single product. If
a tool reports a field length, it must also report which endpoint the number
came from.

---

## Product payload — the shapes that work

### Size variants (`spec_mode: 2`)

Established by `--probe`, which created throwaway hidden products with four
candidate shapes rather than guessing a fifth time:

| Shape | Result |
|---|---|
| options declared + variants carrying titles | ✅ API assigns and links the ids |
| same, with `option1`/`option1_value` zeroed | ✅ the zeros are ignored |
| options only, one bare variant | ❌ `option1_title不能为空` |
| variants only, no options array | ❌ `产品属性错误` |

```json
{
  "spec_mode": 2,
  "options": [{
    "option_name": "Size",
    "position": 0,
    "values": [{ "option_value": "XS", "position": 0 }, { "option_value": "S", "position": 1 }]
  }],
  "variants": [
    { "price": "39.00", "option1_title": "Size", "option1_value_title": "XS", "sku": "…", "position": 0 }
  ]
}
```

Three traps in that block:

- **`option_name`, not `option_title`.** Wrong key → `option_name不能为空`.
- **`position` is 0-based**, on both the option and its values. Sending 1–6 for
  six values returns `数据不存在` — the API resolves a position that doesn't
  exist. This error names *nothing*, which is why it cost a whole cycle.
- **Don't send `inventory_tracking` on variants.**

The variants reference the option by *id* on a live product
(`option1: 7294970`). Those ids are assigned at create time — you send titles
and the API links them. Do not try to send ids you invented.

### Collections

`collections: [{ "collection_id": 129055 }]`. **Without this the product exists
only at its direct URL and appears on no collection page.** It is not implied by
anything else in the payload.

### `POST /products` is not idempotent

A create with a handle that already exists does **not** refuse — it makes a
second product and suffixes the URL. That is worse than it sounds, because a
partly-failed run is the *normal* case: one product rejected, four created. The
obvious response — re-run it — is precisely what duplicates the store.

So a create loop needs an existence check of its own. Read the catalogue once
(`GET /products`, handle → product) and skip what's already there, rather than
trusting the API to reject a duplicate. It won't.

### Ids are per store

Collection ids **and** product ids are per-store. EN's `129055` is meaningless
on the FR store. This is the kind of mistake that writes to the wrong record and
looks like it worked.

Both settings in this repo take `{ en, es, fr, it }`, and the code fails loudly
when the current locale has no id rather than falling back to another store's.
Find ids with `--collections <filter> --lang <store>`.

### `body_html` is stored trimmed

The CMS strips the trailing newline. A repo file ending in `\n` therefore reads
as a permanent 1-character drift on every product. Compare trimmed.

---

## Errors are in Chinese

The `msg` field is the only thing that tells you which field is wrong, and it is
not in English. Worth decoding rather than pattern-matching on:

| Message | Means |
|---|---|
| `X不能为空` | X cannot be empty (X is the field name — the useful part) |
| `数据不存在` | data does not exist — usually a bad reference or an out-of-range `position` |
| `产品属性错误` | product attribute error — the options/variants structure is wrong |

`create-iconic-products.js` extracts the field name out of the message and
prints it in English. Copy that; guessing at a whole payload because the error
looked opaque is how several of these cycles were spent.

---

## Storefront / CMS templates

Not the API, but the same class of hard-won:

- **A `<script>` injected via `innerHTML` never executes.** Per the HTML spec.
  A `<style>` injected the same way *does* apply. So a page that needs
  behaviour needs a real `<script>` tag in the template, not markup smuggled
  through a content field.
- **DIY / static files serve from the site root** — `https://www.momuto.com/<file>`,
  not from a subfolder. A wrong path gives a 404 that looks exactly like a
  script that loaded and did nothing.
- **Content in a custom template and content in `body_html` both render.**
  Pushing `body_html` to a product whose template already has the content shows
  the page twice. Strip the template first, then push — never the reverse.
- **Invalid hex colours fail silently.** `#ffff` (four `f`s) and `#fffff` (five)
  were live in production for months; the rule simply never applied.

---

## Email notification templates (API surface, Aug 2026)

The vendor API documentation lists a notification-template surface we had
never used (titles from the doc index — paths were not given):

- `GET  Get email notification list`
- `GET  Get email notification details`
- `PUT  Email notification of changes`
- `PUT  Email notification status modification`

Real paths (from the vendor doc page, Aug 2026):

- `GET /eventnotices?email_event_type=<recovery|customer|admin>` — list.
  Each row: `event_id`, `event_name` (e.g. "Shopping cart recall (Phase
  1)"), `event_code` (`carts/recovery_1`), `status` (0 off / 1 on),
  **`event_notice_id` (0 = never configured — nothing to fetch)**,
  `coupon` (abandoned-cart coupon code), `delay_time`, `email_cover`.
- `GET /eventnotices/{event_notice_id}` — details: `email_title`,
  **`top_html_oss_bucket` + `bottom_html_oss_bucket`** (the custom HTML
  blocks ABOVE and BELOW the platform-rendered core — cart lines, buttons),
  `delay_time`, `coupon`, `status`.
- `PUT Email notification of changes` / `PUT … status modification` —
  read-modify-write like every other PUT on this API.

So the abandoned-cart email is NOT free-form: a redesign = title + top
block + bottom block per store/phase (recovery has phases with their own
delays/coupons). `scripts/dump-email-notifications.js` dumps every event +
configured template per store into `cms/email-notifications/<lang>/` via
the "Dump email notification templates" workflow (auto-runs on merge; also
workflow_dispatch) — the read-before-write baseline for the redesign.

Motivation (Aug 2026): redesigning the abandoned-cart email — since the
per-design €0 preview products ride in the platform cart, its abandoned-cart
email can show the customer THEIR OWN design.

---

## Orders (read) — UNVERIFIED surface (Aug 2026)

`scripts/poll-paid-orders.js` (hourly via the "Poll paid orders" workflow)
reads `GET /orders?limit=` + `GET /orders/{id}` to send confirmation emails
at payment time, because the platform's own webhooks arrive in sweeps DAYS
late (see design-momuto server-patches/README.md §3b). Nothing about this
surface has been probed against the live API yet — the script codes
defensively (multiple field-name candidates, single-order re-fetch when the
list omits a field, `--probe` mode that dumps the raw shape) and every
assumption in it should be checked against a `--probe` run before trusting
live output. Facts we DO have: `financial_status` 230 = paid (the constant
WebhookAction keys on), and every 3D order carries a €0 preview line whose
`inner_title` is `{"type":"3d-preview","order_no":"<local ref>"}` — the join
key back to our pipeline. Update this section with the real shapes after the
first probe.

---

## Method, not just facts

The findings above came from four habits worth reusing on any similar task:

1. **Read an existing record before writing a new one.** The live product is
   the specification. `--inspect` on a working product settled the payload
   shape, the metadata format and the 0-based `position` bug — each after
   guessing had already failed.
2. **Probe with throwaway hidden products.** Four candidate shapes in one run
   beat four failed attempts against real products, and cost nothing but two
   deletes.
3. **Verify the write, don't trust the ack.** Build the audit *before* you need
   it. Every silent-failure mode in this document was found by diffing live
   state against intended state.
4. **When a number looks impossible, question the instrument.** `body_html: 0`
   on a page that visibly renders content was the instrument lying, not the
   data. Check where the number came from before building on it.

---

## Related

- [cms-product-create-api.md](./cms-product-create-api.md) — the create payload, field by field
- [iconic-series.md](./iconic-series.md) — the pipeline these findings came out of
- `scripts/create-iconic-products.js` — `--inspect`, `--probe`, `--audit`, `--update`

## Navigation + logistics endpoints (from the vendor's Apizza docs, 1 Sep 2026)

Previously assumed admin-only; both are on the same OpenAPI host/token.
Tooling: `scripts/sync-store-nav.js` (+ `sync-store-nav.yml`, dispatch-only,
inspect-first — read a store's live JSON before the first write).

- **`GET /navs`** — menus with children (3 levels). **`POST /navs`** —
  update; a menu whose `nav_name` matches an existing one is OVERWRITTEN
  ("duplicate menu names will be overwritten") → posting one menu upserts
  it. `url_json.type`: 0 none · 1 homepage · 2 album details · 3 product
  details · 4 blog details · 5 custom page · 6 custom URL · 7 product
  album · 14 blog list · … (full map in the Apizza doc). Custom URL (6)
  with root-relative paths works for everything and needs no source ids.
- **`GET /shippingzones?type=`** (1 general, 2 custom) — logistics
  solutions with `shippingZonePlan[]`; each plan's `param` keys a fee to a
  rule: `rule` = total_price|total_quantity|total_weight, `rule_min`/
  `rule_max` (blank max = ∞), `fee_method` 1 fixed fee (2 first+add'l
  weight, 3 first+add'l items), `fee`. **A free-shipping threshold is two
  plans on one zone: [0..T) → fee X, [T..∞) → fee 0.**
- **`GET /shippingzones/{id}`** — details incl. `areas` (country objects;
  US country_id = 229, default_currency USD) and bound products (empty
  product_ids = all products).
- **`POST /shippingzones`** — create solution (name, type, areas[
  {country_id, provinces:[]}], plan[], product_ids[]). **`PUT`** —
  "Logistics plan modification" (path per the Apizza doc).
- **`GET /couriers`** — carrier list (id, name, code, homepage).
- **`GET /seoplans`** / **`PUT /seoplans`** — HOMEPAGE SEO (meta_title,
  meta_descript, meta_keywords — keywords is an ARRAY, same rule as pages).
  The one homepage surface we previously couldn't reach from code.
