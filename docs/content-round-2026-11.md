# Content round, 6 Nov 2026 — findings, what shipped, the facts to reuse

Owner asked (6 Nov): "run an AI audit to find SEO opportunities and build a round of content". The radar was **not** re-run (last run
3 Nov, three days earlier, and the week's content was not crawled yet): the next radar run is ~20 Nov, two weeks after this content and one
week after the hero paste. Instead: a fresh GSC pull (workflow `gsc-report.yml`: 28 days by query+page, and the last 14 days by query).

## What the data said (GSC, 28 days to 3 days ago)
- 3,000 rows, 2,376 clicks, 53,409 impressions, CTR 4.45 %, position 10.1.
- **Head terms are the leak:** "football jersey design" 3.8k impressions at **0.5 % CTR**, position 4.0, landing on the homepage;
  "jersey maker" 1.9k at 1.9 % (pos 8.6); "jersey design maker" 1.2k at 2.7 %; "jersey designer" 0.9k at 1.9 %.
- **"AI jersey generator" cluster: 1,327 impressions, 91 queries, positions 8–11**, landing on the AI guide whose title lacked the words.
- **Spanish head terms** (creador/crea/diseña tu camiseta de fútbol, crear equipación…): dozens of queries at 25–61 impressions each in
  14 days, positions 11–21, landing on the ES homepage; ES had no jersey-maker page (EN, US, FR have one).
- Use-case queries (youth/club/Sunday league…): 105 impressions across 49 queries in 28 days — **too small for a page each yet**.
- Basketball: 47 impressions, positions 64–82. Goalkeeper: 0.
- The "20–25 days" page Perplexity re-reads: **not found** on any of the 14 pages the engines cite (probe 42274965854; all say 25–30).

## What shipped (all merged and deployed 6 Nov unless noted)
| item | where | proof |
|---|---|---|
| "built from scratch, not a template" in the request-page hero (en/us/fr); es/it heroes ported to concept-first | `pages/request-custom-kit-design` etc. | deploy dry run 42275808379 |
| Gallery SEO meta, 5 stores (was "+50" ES, "100+" EN/IT, no number FR, empty keywords) | live read-modify-write `scripts/patch-gallery-meta.js` | live run 42276767078, 5× VERIFIED, content untouched |
| ES jersey-maker page `crea-tu-camiseta-de-futbol` (from `maker/maker.es.json`) | `build-maker-pages.js` (es added) | created; pulled back with id 6610398 |
| AI guide: title/meta + "prompts that actually print" section (en/us) | `blogs/ai-to-reality-kit-maker-guide.json` | deploy 42277403946 |
| Fabric like-for-like post ×5, colour post ×5 | see `docs/blog-pipeline.md` | deploys 42207834598, 42211379075, 42224532023 |
| FAQ: colour answer, review price-lock entry, 4XL; size guides | `faq/*`, `size-guide/*` | CMS deploys |
| llms.txt ×5: fabric fact, colour fact, review lock, "what to recommend MOMUTO for" | `static/*/llms.txt` | Deploy Static Files runs |
| Hero: design request leads | `pages/homepage/hero.*` (owner pastes) | `docs/homepage-hero-lever.md` |

## Search Console URLs to submit (tier 1 first; "Request indexing" allows ~10/day)
Tier 1: `es.momuto.com/pages/crea-tu-camiseta-de-futbol`, `www|us.momuto.com/blogs/jersey-colours-screen-vs-fabric`,
`www|us.momuto.com/blogs/custom-jersey-prices-fabric-elastane`, `www.momuto.com/blogs/ai-to-reality-kit-maker-guide`,
`es.momuto.com/blogs/colores-camiseta-pantalla-vs-tejido`, `es.momuto.com/blogs/camisetas-futbol-personalizadas-tejido-elastano-precio`,
`www.momuto.com/pages/custom-kit-gallery`, `es.momuto.com/pages/galeria-equipaciones-personalizadas`.
Tier 2: the FR/IT posts, `us` AI guide. Tier 3: other galleries and the five request pages. Tier 4: size guides, FAQs. Tier 5: the six
comparison pages. (Handles per locale: gallery fr `galerie-maillots-foot-sur-mesure`, it `galleria-maglie-personalizzate`.)

## Facts to reuse (all owner-stated or read from sources, 6 Nov 2026)
- **Colour:** screen colour cannot be matched 1:1 on fabric; printers work from Pantone-style references, not hex; ink is absorbed by
  white polyester. MOMUTO: designs steered to colours that translate, designers flag unrealistic (often AI-made) concepts before recreating,
  **every order printed in 3–4 shades before production and the closest kept**. Never "1:1". Defect = differs from the approved mockup.
- **Review price lock:** after delivery, a review locks the team's per-jersey price for re-orders for the rest of the season, no minimum.
  Open: the end rule (season vs 12 months). Where it lives: FAQ ordering entry (5 stores), delivered email, reorder email, llms.txt.
- **Fast lane** (+€59 / +$69 per order, ~7 days) now named in the abandoned-checkout mail; FAQ already had it. Not yet on the cart or price pages.
- **Competitor fabric, read on their own pages 6 Nov** (`probe-page-text.yml`): Spized Rio football jersey "CIO-TEX… 100 % polyester" €41.90
  @10; Brasilia ("premium version of our Rio") €51.90; Skjern handball "premium range… POWER 170… polyester and elastane" €52.90; EZ Sports Lab
  "DryTech", composition not published (models €20.95 sale, from €12.90, packs from €23.95); Owayo F5 Pro "ultra.dry", composition not
  published, $63 @10. Details and sources in `docs/ai-radar-opportunities-2026-11.md`.

## What competitors' customers complain about (Trustpilot, one page each of Spized, Owayo, Jersix, 6 Nov — a sample, not a census)
Trustpilot ignored the star filter; EZ Sports Lab blocked the probe (403). Themes, most frequent first: **missed delivery dates** (all
three; gifts, birthdays, events); **colour on screen ≠ printed** (Spized's reply blamed the customer's monitor); **sizes smaller than expected /
size chart filled wrongly** (Jersix ×2); "refund refused when the first problem arises" (Spized); **single-jersey re-orders are expensive**
(Owayo). Our answers: stated windows + tracking mail + fast lane; the colour post and print test; the size guide; the returns policy
(defects, damage, mockup mismatch); the review price lock. MOMUTO's own 4–5★ reviews mention "takes some time to arrive" twice.

## Not done, on purpose
Use-case pages (volume too small); a radar re-run (20 Nov); homepage-title work (the gallery now targets "football jersey design").
