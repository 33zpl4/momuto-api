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

## Open

- `image` is empty for all drop-02 products — set each one after the mockups
  are uploaded to the CMS, then rebuild (the grid renders a TODO comment
  meanwhile).
- Drop 01 `moment_*` copy exists only for `the-116th`; the other four need
  their live copy pasted in, or new copy written.
- `es` / `fr` / `it` strings, drop blurbs and `product-details.<lang>.html`
  are not written yet.
