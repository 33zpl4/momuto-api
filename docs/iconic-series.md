# Iconic Series — pages from data

Product pages for the Iconic Series are **generated**, not hand-built. One
template plus one JSON per product produces every page in every locale.

## Why it's split the way it is

The drop 01 pages were four hand-pasted CMS blocks, ~900 lines each, of which
about **25 lines were actually per-product**. Copy-pasting that five times
produced three defects that were live on the site:

- the **IM-05** page's product-details accordion read `collection reference (IM–01)`
- `color: #ffff` (four `f`s) — invalid, so the `h1` colour silently never applied
- `.series-heading { color: #fffff }` (five `f`s) — same silent failure

So the split is:

| Where | What | Why |
|---|---|---|
| `shared/iconic-content.js` | all CSS, theme overrides, accordion behaviour, size-guide modal | no SEO value; one cached file instead of ~600 lines inlined per page |
| baked into each page | banner, moment copy, accordion **text**, series-grid links, meta | this is the only content distinguishing the pages in search |

**Do not move page copy into the JS.** The moment copy is the sole unique
editorial text on these pages. JS-injected content depends on a deferred
second-pass render that Google does not guarantee and that Bing, social
scrapers and AI crawlers handle worse. Ten pages shipping near-identical HTML
also invites a duplicate-content read. Deduplicate in the repo, not in the
browser.

Same reasoning for the series grid: those are internal links spreading crawl
equity across the collection. They stay in the HTML.

## Layout

```
iconic-series/
├── config.json                      shared strings, drop labels, grid rule, price
├── page-template.html               the structure (~80 lines)
├── shared/
│   ├── iconic-content.js            ONE runtime file for every page/store
│   └── product-details.<lang>.html  accordion copy, written once
├── drop-01/<slug>.json              per-product data + localised copy
├── drop-02/<slug>.json
└── build/                           generated output (do not hand-edit)
```

## Build

```
node scripts/build-iconic-pages.js                 # every drop, every locale
node scripts/build-iconic-pages.js --drop drop-02
node scripts/build-iconic-pages.js --lang en
```

Output: `iconic-series/build/<drop>/<slug>.<lang>.html` — paste into the
product's *Détail* body, or push via the CMS `body_html` field.

A product with empty `moment_body` for a locale is **skipped, not failed** —
that's how a locale gets rolled out gradually.

## The number cross-check

Both the print sidecar (`mockups/artwork/iconic-series/<drop>/<slug>.json`) and
the page data carry the accession number. One is a copy, so the builder
**verifies rather than trusts** and aborts on a mismatch. That's the check drop
01 didn't have.

## Translation rule

**Titles and plate lines never translate.** `EL HIMNO` stays Spanish on the
French store; `LE RECORD` stays French on the Spanish one. They are artwork
names — translating them breaks the collection.

Localised fields are `moment_title`, `moment_body`, `technique`, `meta_*` and
the shared `strings`/`drop_blurbs`. Write them **natively per locale**, not
word-for-word from English: the copy is short and literary, and a literal
translation reads like a translation. Where a phrase has no natural equivalent,
rewrite the sentence rather than forcing it.

## Deploying

Building does **not** deploy. Keep the deploy step `workflow_dispatch`-only and
branch-filtered. `docs/rtp-collection.md` records what happens otherwise: the
RTP collection deploy has no branch filter, so pushing a feature branch writes
straight to the live stores with no staging. It has bitten us twice.

## Defects the retrofit fixes

All five drop 01 pages read `collection reference (IM–01)` — correct on
IM-01 by luck, wrong on the other four. The IM-01 page's own series grid also
labelled the IM-04 card `alt="The Bicycle"`. Both classes of error are
structurally impossible now: the number comes from data and is cross-checked,
and card `alt` text is derived from `display_title`.

## Open

- `image` is empty for all drop-02 products — set each one after the mockups
  are uploaded to the CMS, then rebuild (the grid renders a TODO comment
  meanwhile).
- `es` / `fr` / `it` strings, drop blurbs and `product-details.<lang>.html`
  are not written yet. EN is complete for all ten products.

## Creating the products

`scripts/create-iconic-products.js` turns a built page into a live product via
`POST /products` (see `docs/cms-product-create-api.md`). These shirts have no 3D
customizer, so `inner_title` is omitted — the configId/productId dependency in
that doc does not apply.

```
node scripts/create-iconic-products.js --slug el-himno --dry-run [--verbose]
```

Run it from the **Create Iconic Series Products** workflow (`workflow_dispatch`
only — no push trigger, for the reason in the Deploying section). Defaults:
`dry_run` on, `publish` off, so a mis-click prints a payload instead of
publishing a product.

Guards:
- refuses to run without `--slug` or `--drop` (no implicit "all")
- creates **hidden** (`status: 0`) unless `--publish`
- the workflow rebuilds the pages and **fails if `iconic-series/build` is stale**,
  so what ships always matches the committed source
- `--update` writes `body_html`/SEO to an existing `product_id` instead of
  creating a duplicate — this is the drop 01 retrofit path

### The size-variant shape (settled)

`spec_mode: 2` with **`ICONIC_SIZE_SHAPE=titles`** — the default. Established by
`--probe`, which tried four candidate shapes against the real API:

| Shape | Result |
|---|---|
| **`titles`** | ✅ all 6 variants, API assigns and links the option/value ids |
| `zeroed` | ✅ also works (`option1: 0` is ignored) |
| `optionsonly` | ❌ `option1_title不能为空` — variants must name the option |
| `variantsonly` | ❌ `产品属性错误` — the `options` array is required |

Two details that cost a failed create before `--inspect` showed the truth:

- **`position` is 0-based**, on both the option and its values. Sending 1–6
  for six values returned `数据不存在` — the API was resolving a position that
  didn't exist. This, not the id linkage, was the actual cause.
- **Don't send `inventory_tracking`** on the variants.

The variants reference the option by id on a live product (`option1: 7294970`,
`option1_value: 36429091`), but those are assigned by the API — you send the
titles and it links them. Read the live shape any time with:

```
node scripts/create-iconic-products.js --inspect im-01-the-volley
```

### Product fields, matched to the live shirts

Read off `im-01-the-volley` via `--inspect` and reproduced, rather than
invented:

| Field | Value | Note |
|---|---|---|
| `subtitle` | `Iconic Series — Drop 02, Summer 2026` | per-drop, in `config.drops` |
| `mini_detail` | `<p><strong>IM–06 // El Himno</strong></p><h2>€39</h2><p>…spec line…</p>` | short block above the buy button |
| `meta_title` | `El Himno – Iconic Series IM-06 \| MOMUTO` | en-dash separator |
| `collections` | `[{ collection_id: 129055 }]` | **without this the product never joins the collection page** |
| `free_shipping` / `taxable` | `1` / `0` | `config.product_defaults` |
| `inventory_tracking` / `_policy` | `0` / `1` | ditto |

`meta_keywords`, `tags`, `product_type` and `vendor` are all empty on the live
products, so they are not sent. `spu` is server-assigned.

Quirk worth preserving: the live products write the accession number with an
**en dash in `mini_detail`** (`IM–01`) and a **hyphen in `meta_title`**
(`IM-01`). Reproduced as-is.

### ⚠️ body_html may be the wrong channel

`im-01-the-volley` has **`body_html: 0 chars`**. The four-block page content on
the drop 01 products lives in the CMS page-builder (the block ids in their CSS —
`#block-section-6301440` — confirm this), not on the product record.

So sending our generated page as `body_html` puts it in the *Détail* tab, which
may not be where the drop 01 blocks render. This is the next thing to verify on
the first hidden product: create it, look at the page, and check whether the
banner/moment/grid appear where they do on a drop 01 shirt.

If they don't, the options are (a) keep `body_html` and accept a different
layout position, or (b) find whether product decoration blocks are writable —
`scripts/deploy-ready-to-play-collection.js` does `PUT /pages/{id}` for CMS
*pages*, but product blocks are a different surface and may be builder-only.

### Diagnostics and cleanup

- `--inspect <handle|url>` — read-only dump of an existing product's options
  and variant fields.
- `--probe` — re-run the shape experiment (creates hidden `zz-iconic-probe-*`
  products and prints their ids).
- `--delete <id,id>` — hard-delete by id, for clearing probe leftovers.

`batchsave` carrying `body_html` (the `--update` path for the drop 01 retrofit)
is still unproven — it's documented as a partial update and only known to
carry SEO fields.

After a create, record the returned id as `"product_id"` in the product JSON so
`--update` can target it later.
