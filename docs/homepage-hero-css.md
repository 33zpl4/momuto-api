# Homepage hero: where its CSS lives (found 7 Nov 2026)

The five hero blocks in `pages/homepage/hero.<locale>.html` are **HTML only** (their header says "the hero CSS lives in a separate CMS block").
That separate block is a **platform custom-code `<style>` injected into the `<head>` of the store pages**: on www it is stylesheet 12 of 57,
11,687 characters, headed "MOMUTO HERO v3 — Premium Brand Block". It is not in this repo, not readable through the API, and not deployed from
here: the owner pastes it in the store admin (like the cart and account skins, `docs/store-theme-css.md`).

- **Snapshot of the live text, 7 Nov 2026:** `docs/homepage-hero-css/hero-v3.snapshot.css`, extracted from the rendered page by
  `scripts/probe-page-css.js` (workflow "Probe hero buttons", `DUMP=1`). **The platform copy is the source of truth** — this file is a
  reference to read and diff against, not a mirror to deploy.
- To re-read it at any time: dispatch "Probe hero buttons" (or `URL=… PATTERN='momuto-hero' DUMP=1 node scripts/probe-page-css.js`); it
  prints which stylesheet each matching rule comes from and, with `DUMP=1`, the whole inline `<style>`.
- Same rules on all five stores: the probe measured identical button metrics (padding, gap, 11.2px labels) on www/us/es/fr/it.

## What the base CSS does (the parts that matter for the CTAs)
- Hero is near-black: `linear-gradient(135deg, #000 … #111 … #000)` on `.momuto-hero-container`, plus grain and soft radial lights. **Never style
  hero buttons for a light page.**
- Grid `2fr 3fr`, text column padding `0 4rem`: on a 1440px screen the CTA column is only ~448px wide. `.momuto-hero-ctas` is `display:flex;
  gap:1.25rem` with **no wrap**; `.btn-primary` is white-on-red `padding 1.1rem 2.5rem`; `.btn-link` is a light-grey underlined text link.
- At <=768px the CTAs stack (`flex-direction:column`, buttons full width); the image strip becomes a swipe carousel.
- It was designed for ONE button beside ONE text link.

## What went wrong on 6–7 Nov, and the fix
The design-request push (`docs/homepage-hero-lever.md`) made the hero three actions. Two bugs, both mine:
1. The middle button was styled dark (`#0a0a0a` text and border) on the near-black hero: contrast **1.04**, i.e. invisible.
2. Three items in a no-wrap row inside the ~448px column squeezed the labels onto 3–4 lines ("SEND / US / YOUR / IDEA").
Fix, carried **inside each hero block** so it ships with the paste (no change to the platform CSS block needed): a
`<style id="momuto-hero-cta-fix">` that sets `flex-wrap:wrap`, `white-space:nowrap` on labels (normal on phones <=480px), and a
`.btn-outline` variant (white text, white 78% border, hover = white fill with dark text). It out-ranks the base rules by specificity.
Measured on the live theme CSS with `scripts/probe-hero-buttons.js` (backgrounds sampled from the rendered pixels), 5 stores x 5 widths
(1440, 1024, 768, 390, 360): **0 problems** — one-line labels (<=2 lines on phones), text contrast ~19, border ~11.5, hover ~19.8.
If the CTAs are ever merged into the platform CSS block, move these four rules there and delete the style tag from the hero blocks.

## Checking a hero change before pasting
`probe-hero-buttons.yml` runs on every push that touches `pages/homepage/hero.*.html`: it loads the live pages, swaps in the repo's CTA markup and
`cta-fix` style, and reports wrapping and contrast per store and width (exit 1 on a problem). Read it before asking the owner to paste.
