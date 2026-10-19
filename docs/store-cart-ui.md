# Store cart page + "Added to cart" pop-up (19 Oct 2026)

What the buyer sees on the 5 stores after clicking Add to cart (the pop-up) and on `/cart`. Both are the platform theme's own screens; we skin them with one pasted script-manager entry.

## What we measured (probe `scripts/probe-cart-ui.js`, live, desktop 1440 + phone 390, all 5 stores)
Default theme look: white pop-up with a mint-green header and a charcoal Checkout button; a white `/cart` page between our black header and footer; thin Jost "Your Cart"; an orange-red Checkout button
that is not brand red; a grey Apply button; Jost everywhere (we have been moving away from it). No horizontal overflow on any store.
Wrong or untranslated strings:
- FR "Caisse" and IT "Cassa" on the Checkout button mean the shop till. Fixed by the skin's script (FR "Passer la commande", IT "Procedi al pagamento"). ES "Completar pedido" is fine.
- The "Size:XS" label is the product option's own name in the product data (English on every store, not a theme string): fix it in the products, not here.
- The pop-up's "Añadir a la cesta con éxito" (ES) / "Aggiungi al carrello con successo" (IT) are theme language-pack strings: not changed.
- www and IT showed `$` prices from the US runner: store currency follows the visitor's location. Not investigated further.

## The skin (`docs/cart-brand/`)
- `cart-brand.css` (source), `cart-brand.js` (FR/IT label fix + fonts on /cart only), `cart-brand-entry.html` (GENERATED: `node scripts/build-cart-brand-entry.js`, PR check `--check`), `preview-snippet.js` (generated, for a console preview).
- Paste `cart-brand-entry.html` as ONE new script-manager entry **"MOMUTO cart skin v1"** in each of the 5 stores (www, us, es, fr, it), identical; separate from the nav script and from "MOMUTO account skin v1". NOT deployed from the repo.
- Scope: every CSS rule starts with `html body:has(#cart_list)` (the cart page) or `html body:has(.layer-add-cart-success)` (the pop-up while it is open); the builder fails on any other selector, on `@import`, `</style`/`</script`, unbalanced braces, a JS syntax error, or a missing `--mo-cart-skin` marker.
- Cost on other pages: the CSS is inert; fonts (Bebas Neue + Outfit) are requested on `/cart` only; one MutationObserver on `<body>`'s direct children exists only on the FR and IT stores (for the label fix). The pop-up keeps the theme font (Jost) so product pages request nothing new.
- Undo: disable or delete the entry. Version bump on every paste (entry name + `--mo-cart-skin`); the probe reads the marker (`css: none` run shows what is live).
- Tests: `NODE_PATH=<playwright> CHROMIUM=/path node scripts/test-cart-brand.js` (12 checks, real markup from the live stores in `scripts/fixtures/cart-page.html`, `cart-popup.html`: inert on an ordinary page, skinned cart + pop-up, font requests, FR/IT labels).
  Live before/after: the probe with `css = docs/cart-brand/cart-brand.css` injects the stylesheet BEFORE the page scripts run (screenshots on the throwaway branch `probe-cart-shots`; run mode `cleanup` deletes it).

## Not done / not verified
- The header mini-cart drawer (`.minicart`, empty until opened): markup not seen yet, not skinned.
- Safari/iOS; the ES/FR/IT stores were measured but the skin was checked live on US desktop + phone only; the FR/IT label fix is tested on mock markup, not live.
- The injected-CSS runs use fallback fonts (no fonts script), so headings look like Arial in those screenshots; the real entry loads Bebas Neue.
- The platform may change its class names (all selectors are the theme's own).
