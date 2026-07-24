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

### Unverified — check on the first product

**`spec_mode: 2` (size variants) is being established by trial.** The only
worked example in the repo is Pornic, which is `spec_mode: 1` with empty
`options`, so the shape came from the API doc's field list rather than a
known-good response.

Established so far, from real API responses:

| Field | Value | How we know |
|---|---|---|
| `options[].option_name` | `"Size"` | `option_title` → `option_name不能为空` |
| `variants[].option1_title` / `option1_value_title` | `"Size"` / `"XS"` | present on the live Pornic product |

Note `variants[].option1` and `option1_value` exist on Pornic as **numbers**
(0) and look like internal ids. If a later error names them, they likely need
the ids the API assigns when it creates the option — meaning options may have
to be created before variants can reference them.

So: create **one** product hidden, on **one** store, and check in manage that
sizes XS–XXL appear as selectable options and the Détail body rendered intact.
Only then batch the rest. Same for `--update`: `batchsave` is documented as a
partial update and is only known to carry SEO fields — whether it accepts
`body_html` needs one real call to establish.

After a create, record the returned id as `"product_id"` in the product JSON so
`--update` can target it later.
