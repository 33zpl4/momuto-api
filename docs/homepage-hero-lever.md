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

**Known gap.** The `design_saved` beacon reads 0 (tshirt-client `onAfterSaveShare`, fires only for a plain Save, `!shareType`); the
other funnel steps count normally, so judge the lever on cart/checkout/paid rows until that beacon is fixed.
