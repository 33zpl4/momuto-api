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

Localised fields are `moment_title`, `moment_body`, `technique`, `meta_*`, plus
the shared `strings`, `drop_blurbs`, and the per-locale `edition` / `subtitle`
on each drop. Write them **natively per locale**, not word-for-word from
English: the copy is short and literary, and a literal translation reads like
one. Where a phrase has no natural equivalent, rewrite the sentence.

Choices made in the existing copy, worth keeping consistent:

- **Move names use the term each language actually uses.** The bicycle kick is
  `Chilena` (es) / `Retourné Acrobatique` (fr) / `Rovesciata` (it) — not a
  translation of "bicycle".
- **`220 GSM` becomes `220 g/m²`** everywhere but EN. It is the unit these
  markets read.
- **Artwork names stay put inside the sentence.** `The Volley que detuvo el
  tiempo`, `Il record che resta solo` — the name is the constant, the sentence
  around it is the translation.
- Meta descriptions are kept **≤200 characters** to match the live EN ones.

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
- All four locales are complete: 40 pages (10 products × en/es/fr/it).
- Drop 01 products still render from their own custom templates — repoint them
  at the shared template *before* pushing `body_html`, or the page duplicates.

## Collection pages

Generated from the same product data, one per drop per locale
(`build/collection/<drop>.<lang>.html`, 8 files).

Unlike the product pages these are **self-contained** — CSS is inline rather
than in `iconic-content.js`. They are CMS *pages* with no template to hang a
script tag on, and a `<style>` injected via innerHTML does apply (only
`<script>` doesn't). 8 pages is bounded duplication; 40 would not be.

| | drop 01 | drop 02 |
|---|---|---|
| handle | `iconic-football-series` | `iconic-series-drop-02` |
| h1 | "Iconic Series" | "World Cup 2026" (localised per store) |

**Drop 01's copy is reproduced verbatim from the live page**, so regenerating
it changes nothing that already ranks — only the structure becomes data-driven.

**Drop 02 deliberately gets a different `<h1>`.** Two collection pages sharing
"Iconic Series" as their heading would compete for the same query; "World Cup
2026" catches the tournament intent instead, while the eyebrow carries the
brand. It is localised per store — *Mundial 2026*, *Coupe du Monde 2026*,
*Mondiali 2026* — via `t1`/`t2` in `config.drops.drop-02.collection.copy`.

`config.drops.drop-02.collection.meta` holds the SEO title and description for
the **CMS collection record** itself. The build does not consume it — it is
recorded so the four stores get the same text rather than four improvised
versions.

The naming of the tournament is deliberate and confined to prose and meta. The
`edition` and `subtitle` fields keep the seasonal label ("Drop 02 – Summer
2026") because that is an edition name, not a search target, and it frames the
drop rather than describing it.

Each page links to the other at the foot, so neither drop is orphaned.

Drop 02 launches **without an intro photo** — the intro collapses to a single
centred column rather than leaving an empty grid cell. Set
`config.drops.drop-02.collection.intro_image` when the shoot happens and
rebuild; the two-column layout returns on its own.

### Two pages ≠ two collections, unless you make it so

`/collections/<handle>` needs a real **CMS collection** to own the URL;
`/pages/<handle>` is just a page (that is how RTP does its "collection" page —
see `docs/rtp-collection.md`). Both patterns exist in the store.

We use collections, so drop 02 needs one created in the CMS with handle
`iconic-series-drop-02`. Membership is then **both**:

| | joins |
|---|---|
| drop 01 products | series collection `129055` |
| drop 02 products | series collection `129055` **and** the new drop 02 collection |

`config.collection_id` is the series; `config.drops.<drop>.collection.collection_id`
is that drop's own. Set the drop 02 id once the CMS assigns it — until then it
is `null` and the create script simply sends the series membership.

Keeping every product in the series collection is what stops the archive from
fragmenting a drop at a time. The custom page HTML decides what is *displayed*;
collection membership decides what the CMS *knows*.

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

### body_html vs per-product templates

`im-01-the-volley` has **`body_html: 0 chars`**. Drop 01 works differently: each
product has its **own custom CMS template** with the four blocks pasted into it
by hand. Ten products means ten templates to build and maintain.

Drop 02 uses `body_html` instead — the content arrives through the API and every
product shares **one** template. That is the entire point of this pipeline: no
CMS builder step per product.

This costs nothing in search terms. Crawlers read the HTML source, and
`body_html` *is* in the source. If it renders in a position you don't want,
`shared/iconic-content.js` already loads on the page and can move or restyle
the node — cosmetic, and under our control.

**⚠️ The drop 01 retrofit trap.** Those products already render their content
from a custom template. Pushing `body_html` to them via `--update` would make
the page show **everything twice** — once from the template, once from
`body_html`. So the retrofit is a two-step per product: strip the blocks from
that product's custom template (or point it at the shared one) *first*, then
push `body_html`. Do not run `--update` across drop 01 blind.

### Live debugging

`iconic-content.js` logs one line on every page:

```
[iconic] ready · lang en · banner found · cart found
```

- **no line at all** → the script isn't loading. Check the tag is in the
  template (not `body_html`) and points at `https://www.momuto.com/iconic-content.js`
- **`banner MISSING`** → `body_html` didn't render; the marker guard bailed
- **`cart MISSING`** → the theme hasn't mounted the buy controls, or the
  product is hidden (`status: 0`) and the storefront omits them in preview

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
