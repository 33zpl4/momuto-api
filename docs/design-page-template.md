# Design page template — one permanent page per catalogue design

Written 31 July 2026. Implements Door 1 of `docs/product-architecture.md`: the
permanent, keyword-bearing page every catalogue design gets. Modelled on the
two proven data+template patterns in this repo (`ready-to-play/templates/*/
config.json` and `cms/city-pages/es/cities.json` + `deploy-city-pages.js`).

## The two rules that shape everything

1. **One page per design, forever.** RTP membership is a *state* on the page
   (badge + −10% price + link to the selection), never a separate page. When
   the design rotates out, the badge comes off and the URL, content and
   equity stay. The RTP *collection* page is where the spotlight aesthetics
   live — that is the visually distinct RTP surface.
2. **One primary CTA per page: "Open it in 3D."** The page exists to carry
   keywords and route into the tool. A visitor should never face a choice
   more complicated than *customise this* — everything else (RTP selection,
   Bespoke, siblings) is secondary navigation. This is the
   no-overcomplication guarantee: the catalogue adds pages, not decisions.

## Common vs unique — the template split

### Shared template (identical across all designs, written once per locale)

| Block | Content | Why shared |
|---|---|---|
| Layout & CSS | dark theme, Bebas/Outfit, same grammar as the estate | one visual system |
| CTA block | "Open it in 3D" deep link + price line | same action everywhere |
| Spec strip | poliestere-elastan, full sublimation, no minimum, 25–30 days | the four truths never vary |
| How-you-get-it | 3 steps (customise → preview → order) | process is process |
| RTP state layer | badge + −10% + "in this season's selection" (rendered only when member) | merchandising, not content |
| Bespoke pointer | one line: "want something no design can do? → Bespoke" | door cross-reference |
| JSON-LD skeleton | Product + FAQPage structure | schema is structural |

### Per-design data (the only thing authored per design)

```
{
  "slug": "the-meridian",
  "sport": "football",
  "name": "THE MERIDIAN",
  "style": { "en": "Retro striped", "es": "Rayas retro", ... },   // the keyword niche
  "story": { "en": "2–3 sentences. What the design is doing and who it's for.", ... },
  "keywords": { "en": [...], ... },          // the niche queries the page targets
  "meta_title": { "en": "...", ... },        // ≤65, leads with the style niche
  "meta_descript": { "en": "...", ... },     // ≤160
  "handle": { "en": "retro-striped-jersey-the-meridian", ... },
  "renders": ["...front.png", "...back.png", "...detail.png"],
  "colorways": [ { "name": "...", "thumb": "..." }, ... ],   // proof of "never blank"
  "deep_link": { "configId": "...", "suitName": "..." },
  "siblings": ["the-apex", "the-grid"],      // same-style cross-links, 2–3
  "worn_by": ["team-page-handle", ...],      // optional; gallery proof
  "rtp_member": false                        // the rotating state
}
```

The authored surface per design is deliberately tiny — a style niche, a
3-sentence story, meta, and assets. "Nothing long": the page's job is
keywords + routing, and the renders do the selling.

### Handle strategy

- **New designs**: keyword-bearing handles per locale —
  `retro-striped-jersey-the-meridian` / `camiseta-rayas-retro-the-meridian`.
  The style niche in the URL is a ranking signal; the design name keeps it
  brand.
- **The existing 7**: keep their `ready-to-play-<slug>` handles. Renaming is
  URL churn for zero gain (the IT audit lesson) — grandfather them, migrate
  their *content* to the template, and their handles simply read as heritage.

## Visual differentiation, resolved

- **Design pages**: editorial register. Big render, story, colorway strip,
  one CTA. Catalogue calm.
- **RTP collection page**: the spotlight. Seasonal framing, the −10%, the
  rotation date, the "this season" energy. This page is *supposed* to feel
  different — it is the front table.
- A design page in-selection wears only the badge and price of RTP, not its
  aesthetics. Out of selection, nothing changes but the badge and price.

## The seasonal cadence (canonical wording)

Owner decision: seasonal, not monthly — sport-native and premium.

| | Wording |
|---|---|
| EN | **This season's selection · −10% · rotates each season** |
| ES | La selección de esta temporada · −10% · rota cada temporada |
| FR | La sélection de la saison · −10% · change chaque saison |
| IT | La selezione di questa stagione · −10% · ruota ogni stagione |

"Season" needs no definition and never expires awkwardly — a new selection
simply arrives. The rotation script (collection membership + price flip per
locale, both directions) remains the gate on shipping this copy.

## Why this is good for SEO *and* UX (the owner's test)

SEO: each page is a distinct style-niche keyword target with a permanent URL,
rich renders, Product schema, and internal links (siblings, RTP, tool). The
catalogue becomes a keyword estate that grows one design at a time, across
all locales, with authored effort measured in sentences.

UX: the visitor's experience is *simpler*, not busier — a searcher landing on
"retro striped football jersey" sees exactly that design, finished, with one
action. Site navigation gains no new concepts: designs are reached through
the tool, the gallery, the RTP selection and search. Nobody is ever asked to
understand the difference between a "design page" and an "RTP page", because
from the customer's side there is no difference — just designs, some of which
are in this season's selection.

## Build order

1. Data file (`cms/design-pages/designs.json`) + `deploy-design-pages.js`
   following the city-pages pattern (shared template in the script, data in
   the JSON, per-locale deploy, sanity checks: meta lengths, handle
   uniqueness, every colorway has a thumb, deep link resolves).
2. Migrate the 7 existing designs into the data file (content from their
   `ready-to-play/templates/*/config.json`), keeping their handles.
3. First new designs ship with the basketball surfacing (lever 2) — the
   template is the landing surface basketball needs anyway.
4. RTP state layer + seasonal copy ship together with the rotation script —
   not before (architecture doc, rotation rule 2).
