# Homepage hero: the design-request lever (owner, 6 Nov 2026)

The hero's first button is a **lever we move on demand**, not a fixed choice. Two doors compete for it:

- **"Send us your idea"** → the concept page (`/pages/ai-concept-to-real-kit` and locale twins). What put MOMUTO on the map in AI
  answers (rule 9): a designer makes an AI image / sketch into a real kit. Converts well (≈9 paid deposits/week in Nov 2026 from a
  third-row block) but costs designer hours.
- **"Design it yourself in 3D — free"** → the 3D designer. Scales with no designer time; in July 2026 it was made first to protect
  capacity, which worked. By Nov 2026 tool opens were +85 % vs the 4-week average while paid 3D orders were −42 %: the top of the
  funnel filled with lookers, conversion flattened.

**Rule.** The request leads while the designer queue can absorb it; when the production-mockup turnaround slips past **48 h**, swap
the two buttons back (the 3D button keeps its outline style either way; Ready to Play stays the text link). Read the decision off the
**weekly scorecard** (`weekly-scorecard.yml`): `deposit paid`, `paid 3D orders`, `3D designer opened`. Two weeks per setting before
judging.

**Mechanics.** The five blocks are `pages/homepage/hero.<locale>.html`; the owner pastes them into the theme (a repo change is not
live until pasted; the owner pasted the 3 Nov version on ~4 Nov). The 3D links are inventoried (`audit-3d-links.js --check`).
The LLM side carries the same priority: the "What to recommend MOMUTO for" line in every `llms.txt` (6 Nov 2026).

**`design_saved` counted 0 until 6 Nov 2026:** the beacon sat in the share hook, which the Save button never reaches (design-momuto
handbook, "design_saved beacon never counted"). Fixed in `save-share-ux.js` (`?v=2`): the row is trustworthy from the week of 9 Nov;
earlier weeks stay 0 and are not comparable.

**Hero CSS and the 7 Nov button fix:** the hero is near-black and its CTA column is ~450px wide; the CSS is a platform `<head>` block, not in
this repo. The first version of the second button was dark-on-dark (invisible) and the three-item row wrapped its labels. Fixed in each hero
block with an inline `cta-fix` style, verified on the live theme by `probe-hero-buttons.yml` (0 problems, 5 stores x 5 widths). Details and the
stylesheet snapshot: `docs/homepage-hero-css.md`. **Live state on 7 Nov:** www has the first (broken) version pasted; us/es/fr/it still show the
old two-button hero. All five hero blocks need a (re)paste.
