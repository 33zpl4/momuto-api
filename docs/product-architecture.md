# Product architecture — Ready to Play / the 3D designer / Bespoke

Written 30 July 2026, revised 31 July with the rotation model, revised
4 August with the naming collapse (owner decisions): **"The Studio" is retired
as a customer-facing name. Ready to Play names the design catalogue — the
whole wall of finished designs. The seasonal −10% selection has no name at
all** — a badge and one line of copy. This is the canonical taxonomy for how MOMUTO presents
its offer, agreed while planning the model-page expansion (`docs/10x-plan.md`
lever 5). Every page, PDP, homepage block and piece of copy should be
consistent with this document. When a new surface doesn't know how to describe
something, the answer is here.

## The thesis

Owayo and Spized are kit **suppliers**: configurators whose templates load as
blank shapes in default colours. MOMUTO aspires to be a sports **brand**. The
difference is opinions: a supplier has capabilities, a brand has finished
designs it stands behind — named, curated, dropped, worn. The visible proof is
already in the product: a Spized template loads flat blue; a MOMUTO design
loads finished, in an intentional colourway. This architecture makes that
difference legible to customers and to search.

## The three doors

Every customer is standing in exactly one of three doors, and every page
should make it obvious which one.

### Door 1 — Ready to Play *(the brand catalogue)*

Every finished design the studio stands behind: the current models (THE APEX,
THE KHALA…), the expansion to 25+, basketball when it surfaces. All of them
share the same properties: **designed to completion** (curated colourways,
never blank), **named**, **worn** (real teams in the gallery), customisable in
3D — and all of them, literally, ready to play. Base price; membership of the
seasonal −10% selection is a separate, rotating decision.

Each design gets a **permanent page per locale** — a short story, the design
vocabulary it targets (striped / gradient / retro / camo / sash / hooped…),
renders, and one primary CTA: *open it in 3D*, deep-linked with the design
pre-loaded. Nothing long; the page exists to carry keywords and route into the
tool. These pages never disappear and never change URL. The full template
specification — common blocks vs per-design data, handle strategy, the
RTP-as-state rule — is `docs/design-page-template.md`.

#### The seasonal selection — a badge, not a name

**Inversion, 4 August (owner decision):** the 31 July revision defined
Ready-to-Play as the rotating promo program. That is now flipped. **Ready to
Play names the design class — the whole catalogue.** The rotating −10%
program names nothing: it is a tile badge (**"−10% · This season"**) plus one
line of copy — *"Each season our design studio picks a few on-trend designs
and runs them at −10%; the selection rotates, the designs stay."* (Seasonal,
not monthly — sport-native and premium. Canonical per-locale wording in
`docs/design-page-template.md`.) The selection is merchandising, not
taxonomy: any catalogue design can rotate in or out. What rotation buys:

- **Honest urgency**: "THE APEX is in this season's selection — 10% off." A
  real deadline with no fake scarcity — the design stays; the discount rotates
  with the season.
- **A return cadence**: rotation day is a newsletter, a social post, and a
  freshness signal on a stable collection URL that keeps its SEO equity.
- **Curation as the brand signal**: everything in the store is ours; the front
  table changes. Selection, not caps, is what says "studio".

Rotation rules (hard):
1. **Pages never rotate — only membership and price do.** A design leaving the
   selection keeps its permanent page at base price. The Ready to Play hub
   page keeps its URL forever.
2. **Promise only the cadence ops can keep.** The seasonal wording ships only
   when the rotation script exists (collection membership + price flip on the
   store products, both directions, per locale). A season is a generous window
   — but it is still a public promise.
3. Selection size stays small — 6–10 designs in rotation at any time. The
   spotlight only works if it is a spotlight.

### Door 2 — The 3D designer *(the tool)*

The catalogue surfaces as **the wall of designs**: the Ready to Play hub page
(**`/pages/ready-to-play`** — the wall took over the aged collection URL in
place, owner decision 4 Aug, so its equity transfers with no redirect risk)
presents the idea in two sentences and then shows the full catalogue as
clickable tiles, each routing through its design page into the tool. One
register, not two: the workshop look — monochrome, graphite chips carrying
the style vocabulary, red reserved for the "Open in 3D" action — with the
seasonal −10% badges sitting directly on the discounted tiles. The
short-lived `/pages/the-studio-3d-kit-designer` is deleted by the deploy's
retire step and gets a 301 → `/pages/ready-to-play` in the CMS admin if the
platform supports redirects. FR/ES/IT keep their old collection pages until
the wall is translated.

The 3D configurator. Design from any catalogue base or from scratch —
**starting points, never blank canvases**: every base loads looking finished,
in an intentional colourway. This is a hard product rule and the visible moat
vs Owayo/Spized, whose templates load as flat shapes in default colours. The
tool is free; the resulting jersey is full price, because you did the
designing.

### Door 3 — Bespoke *(the service)*

Our designers make it for you, from anything: an AI render, a sketch, a
moodboard, a brief. **€15 deposit to put a designer on it, credited in full
from 5 jerseys** — free for a team order. First mockup 24–48h, revisions
included. The refund promise lives on the gate page only.

### Editions *(finished pieces — their own thing, not a door variant)*

Country concepts, collabs and the Iconic Series are **Editions**: finished,
non-customisable pieces sold as they are. They do **not** load in the 3D tool,
do **not** join the seasonal selection, and are not Ready to Play catalogue
designs — a different promise (a drop you buy, not a start you make yours),
on their own surfaces. Sport is a second, independent axis: basketball gets
its own category on the site when it surfaces, but a basketball catalogue
design is still Ready to Play — Editions vs catalogue is about
customisability, not sport.

## The pricing logic, in one breath

> **Bespoke takes a deposit because our designers work on your concept.
> Ready to Play designs — and anything you build yourself in the 3D designer —
> are base price because the design work is either already done or done by
> you. The seasonal selection is −10% because it is this season's front
> table.**

Never explain a price any other way. Note the story that moved: "you skip the
design phase" is now the *catalogue vs bespoke* story (true of every finished
design), not the RTP story — RTP's story is the rotation.

**Copy migration is a sweep, not a drift.** "−10% because you skip the design
phase" currently lives on the comparison pages, request pages and FAQs across
four locales. When the rotation framing ships, it ships everywhere in one
pass — mixed old/new price stories across locales is exactly the failure mode
the deposit-truth sweeps kept finding.

## How the doors reference each other

- PDPs may say "want to change more than colours? → open it in the 3D
  designer" (every Ready to Play design is loadable in 3D — that stays).
- Design pages point down: "want something no template can do? → Bespoke".
- Bespoke pages show the transform examples (concept → production) and may
  point at the 3D designer as the free self-serve alternative — that framing
  is already live on the request pages.
- The three-path section on the request-design pages IS this architecture and
  should adopt this vocabulary as pages get touched.

## Naming on pages (per locale)

| Door | EN | ES | FR | IT |
|---|---|---|---|---|
| 1 | Ready to Play | Ready to Play | Ready to Play | Ready to Play |
| 2 | 3D Designer | Diseñador 3D | Créateur 3D | Designer 3D |
| 3 | Bespoke / Custom Design | Diseño a Medida | Design sur Mesure | Design su Misura |

"Ready to Play" stays untranslated everywhere — it is a line name, i.e. brand
vocabulary, like a Nike line name would be. Written **unhyphenated** in
customer-facing copy going forward; legacy "Ready-to-Play" instances get swept
as their surfaces are touched, not in a dedicated pass.

## The naming grammar (hard rules)

- **Ready to Play is the catalogue, never the promo.** It names the wall of
  finished designs. The seasonal −10% selection is never given a name — a
  badge ("−10% · This season") plus one line of copy is the whole identity.
  If the promo ever seems to need a name, that is the fragmentation alarm.
- **"Studio" survives only lowercase, as authorship** — "designed by our
  design studio", "Studio-designed kits" (homepage). Never capitalised as a
  place, never a nav item, never a destination. The places customers go are
  the Ready to Play page and the 3D designer.
- **The tool is "the 3D designer"** (per-locale table above) — descriptive
  and keyword-bearing, not a brand entity.
- The hub lives at `/pages/ready-to-play` — the aged URL, matching the line
  name. The temporary `the-studio-3d-kit-designer` slug is retired (deleted +
  301).

## What this unlocks (and what it forbids)

Unlocks:
- The 25-model expansion with zero brand confusion — every new design joins
  the catalogue at base price with a permanent keyword-bearing page;
  membership of the seasonal selection is a separate, rotating decision.
- Basketball slots cleanly in: catalogue basketball designs first (the tool
  already has the body), rotated into the seasonal selection when the studio
  wants to spotlight them.
- Honest urgency on every badged tile: "in this season's selection."

Forbids:
- Rotating or deleting design *pages* — only selection membership and price
  rotate.
- Publishing a rotation cadence ops cannot keep.
- Designer bases that load as blank shapes or single flat colours.
- Rotating Editions into the seasonal selection — their moment comes from
  their own drops, not the promo.
- Naming the seasonal selection, or using "The Studio" as a customer-facing
  place-name.
- Explaining the −10% with the old "skip the design phase" story once the
  rotation framing ships — one story estate-wide, migrated in a single sweep.
