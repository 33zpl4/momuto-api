# Roadmap — start here

Single entry point for what we are doing and why. Written 6 August 2026,
reconciling the editorial synthesis with the search data that followed it.
Everything below points into a doc that holds the detail; this file holds
only the order and the blockers.

## Where to read what

| Question | Doc |
|---|---|
| What is the offer, what do we call things? | `docs/product-architecture.md` — taxonomy + naming grammar |
| What are we publishing, and why that way? | `docs/editorial-strategy.md` — pillars, series, guardrails, publishing rules |
| Which articles, ranked, with sources? | `docs/editorial-research/00-synthesis.md` — **the shelf** (15 articles), flagships, gems, gaps, GEO notes |
| Where did the evidence come from? | `docs/editorial-research/01–12-*.md` — 12 sourced dossiers |
| What is search telling us right now? | `docs/search-position-2026-08.md` |
| What do I (owner) need to supply? | Synthesis §4 — **the first-party shopping list** |
| How do pages get built and deployed? | `docs/design-page-template.md`, `docs/cms-page-gotchas.md`, `CLAUDE.md` |

## The three things blocked on the owner

Nothing below moves without these. In priority order:

1. **Merge the branch.** The four-locale Ready to Play wall is written,
   validated and unmerged. It is the biggest single traffic action available
   (see "Why the wall is first" below).
2. **Pull the Tier-1 data** — synthesis §4. Minimum viable: decision lag
   (median + p90 from first contact to confirmed order), the
   decision-to-production ratio, and the on-time record. Plus two quotes:
   founder on the bottleneck, factory on what the production days contain.
   **Wave 1 does not publish without these** — see the hard precondition in
   synthesis §6.
3. **Mint the seed configIds** — nine wall tiles currently open the generic
   tool instead of their design preloaded (finder runbook in `design-momuto`,
   `docs/design-finder.md`).

## Order of work

### Now — ship what exists
1. **Merge the Ready to Play wall** (EN/ES/FR/IT). Deploys on merge.
2. **Nav + homepage** point at the wall; retire the old collection entry.
3. **Seed configIds** swapped into the nine new tiles when minted.

*Why the wall is first:* 21 queries sit at position ≤10 with CTR under 5%,
because the homepage absorbs three-quarters of all impressions and a homepage
is not an answer page. Fixing which page ranks is worth more than any new
ranking, and the page is already built.

### Next — Wave 1 editorial (unblocked by the data pull)
4. **"Count Backwards From Kickoff"** — the facts page. Ships **first or
   joint-first**: it is the answer surface an LLM reaches for. Needs the
   on-time record + the factory quote. FAQPage JSON-LD, permanent URL,
   `llms.txt` updated in the same commit.
5. **"The Slowest Part of Making a Football Kit Isn't Manufacturing"** — the
   thesis piece. Needs decision lag + the ratio + the founder quote. Same
   week as #4, mutually linked.

### Then — the differentiated middle
6. **EN AI-to-real hub**, built on the *generator* vocabulary the query data
   actually shows, modelled on the French post that already ranks at 6.3.
   Carries the AI-brief share — a figure nobody else in the category can
   publish.
7. **"Three Million Pre-Orders: Anatomy of a Number Nobody Checked"** — the
   Nigeria piece as a fact-check rather than a retelling. **Publish in French
   too**; the concept audience is French and already at our door.
8. **"The Decade Colour Became Free"** — sublimation abolished per-colour
   pricing. Externally verifiable, needs one factory quote, makes the
   commercial argument without arguing it.
9. **US surface** — vocabulary first (*soccer*, *uniform* page family), store
   second, announcement third. **Never announce before the surface exists.**

### Standing backlog
- Design pages per model (template exists) — the long-tail keyword estate.
- Basketball, from zero, own category, US-first.
- Rotation script — gates the seasonal −10% copy we already publish.
- IT: confirmation page id, checkout flow. ES/FR/IT wall translations of any
  new editorial.
- Comparison pages: the FR one is our best commercial page; replicate and
  refresh annually.

## The two rules that govern everything published

1. **Be exact about what we do, directional about how big we are.**
   Operational facts precise; business scale as trajectory only.
2. **Ready to Play is the conclusion, never the premise.** Series 5 (the
   commercial pillar) waits until the authority base exists.
