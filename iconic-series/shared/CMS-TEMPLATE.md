# The shared Iconic Series product template

One CMS template for **every** Iconic Series product, replacing the
one-template-per-model setup drop 01 uses. Per-product content arrives as
`body_html` through the API — the template itself carries nothing
product-specific.

## What the template must contain

**1. The stock product chrome** — gallery, title, price, size selector, add to
cart. Unchanged; `shared/iconic-content.js` restyles it.

**2. The product description / detail block**, wherever you want the page
content to sit. This is where `body_html` renders. Everything we generate —
banner, product details accordion, the moment, the series grid — comes through
this one block.

**3. This script tag, in the template markup:**

```html
<script src="https://www.momuto.com/iconic-content.js" defer></script>
```

⚠️ **The path is the site root, not `/configurator/`.** CMS "DIY files" are
served from `https://www.momuto.com/<file>` — `rtp-loader.js` hard-codes that
same base. A `/configurator/...` URL is the Vercel app and 404s here, which
looks exactly like "the page renders but nothing is styled".

Deploy the file with the other theme scripts rather than pasting it:
`scripts/deploy-static-files.js` now maps `iconic-content.js` →
`iconic-series/shared/iconic-content.js`, so it ships on the EN store with
`custom-content.js` and friends and stays in sync with the repo.

⚠️ **It must live in the template, not in `body_html`.** A `<script>` tag inside
an HTML string injected via `innerHTML` never executes — that is the HTML spec,
not a CMS quirk. Put it in the template and it is parsed normally.

Nothing else. No CSS, no per-product blocks, no accordion markup — the script
brings all of it.

## What the template must NOT contain

- the four drop 01 blocks (banner / dark-mode CSS / accordions / moment+grid) —
  those now come from `body_html`, and leaving them in renders everything twice
- any hard-coded `IM–0X` reference — that is how the live drop 01 pages all
  ended up reading `IM–01`

## Same template, all drops, all stores

**One template covers drop 01 and drop 02** — and every future drop. Nothing in
it is drop-specific; the drop label, edition and copy all arrive via
`body_html`.

**The same script tag goes on all four stores**, pointing at the EN-hosted
file:

```html
<script src="https://www.momuto.com/iconic-content.js" defer></script>
```

That is the house pattern — `custom-content.js` and `pricing.js` are EN-hosted
and shared the same way. Do not deploy per-store copies; they drift.

The script localises itself from `data-lang`, which the page template stamps on
the marker div. The size-guide modal carries en/es/fr/it, so it opens in the
right language on each store.

## Assigning it

- **Drop 02** — point the new products at this template. They have no template
  of their own, so nothing to undo.
- **Drop 01 retrofit** — switch each product from its custom template to this
  one, *then* push its `body_html`. Doing it the other way round shows the page
  content twice until the switch lands.

## Checking it worked

On the first hidden product:

1. sizes XS–XXL appear as selectable options
2. the product appears under `/collections/iconic-football-series`
3. banner, accordions, the moment and the series grid all render
4. accordions open/close, the size-guide modal opens — proves the script tag is
   in the template and executing
5. page background is dark, "Buy it now" and the quantity box are hidden — the
   same proof from the other direction

If 3 renders but 4 and 5 don't, the script tag is in `body_html` instead of the
template.
