# momuto-api — session guide

MOMUTO sells custom football kits (www/es/fr/it.momuto.com + the 3D tool at
design.momuto.com, separate repo `design-momuto`). This repo holds CMS page
fragments, deploy scripts, GitHub Actions deploys, and the strategy docs.
Read the doc that owns a topic BEFORE editing that surface.

## Canonical docs (read before touching their surface)

- `docs/product-architecture.md` — taxonomy + **naming grammar (hard rules)**:
  "Ready to Play" names the catalogue; the seasonal −10% promo has NO name
  (badge + one line only); "studio" is lowercase authorship, never a place;
  the tool is "the 3D designer". Editions never customize, never join promos.
- `docs/cms-page-gotchas.md` — the theme fights every `pages/*` fragment:
  title-hide rule, body-paint for full-bleed, `.mo-editor-reset` centering,
  qualified-`!important` lists. All four bugs recur; all are documented.
- `docs/editorial-strategy.md` — content/GEO strategy, canonical facts table,
  guardrails (clubs named in editorial ONLY; deposit copy never
  refund-forward outside the four gate pages).
- `docs/design-page-template.md`, `docs/rtp-collection.md` (historical),
  `docs/it-site-recovery.md`, `docs/10x-plan.md`.

## Hard rules that have burned us

1. **CMS API**: PUT replaces the whole object — send every field back.
   `meta_keywords` MUST be an array (string → Chinese error
   `meta_keywords必须是数组`). Preserve `og_image` on upserts.
2. **The sandbox cannot reach momuto.com or the CMS API** (network policy;
   CONNECT 403). Only GitHub Actions runners can. Never diagnose live pages
   from the sandbox — ask the owner for a screenshot; never claim a deploy
   worked without a green run.
3. **Some workflows deploy from ANY branch push** (historically the
   collection deploy). Check a workflow's `on.push` for a `branches` filter
   before pushing files it watches — there is no staging.
4. **Never name real clubs/brands/players on product surfaces** ("Real
   Madrid rule"). Editorial (blog) is the only surface that may.
5. **Deposit copy**: "€15 deposit, credited in full to orders of 5+ jerseys
   — free for a team order." Never refund-forward in marketing/GEO surfaces
   (incl. `static/shared/llms.txt` — it drifted once).
6. **One set of numbers**: production 7–12 d, shipping 10–15 d, 25–30 door
   to door, mockup 24–48 h, €38.90 single, from €21.90 at 10+, seasonal
   selection −10%. A surface with different numbers is a bug.
7. `static/shared/llms.txt` is the machine-readable fact feed for LLMs —
   update it in the same commit as any fact change.

## Agent-ops gotchas (tooling walls already hit)

- **Workflow-tool subagents can hit a permission-handler bug** that strips
  EVERY tool parameter (`updatedInput ... required parameter missing`),
  including structured output — 12/12 agents failed after a full run
  (5 Aug 2026, ~516k tokens, zero output). Direct `Agent`-tool subagents
  were healthy at the same time. Rules: **probe with one cheap agent before
  any fan-out**; on mass "StructuredOutput retry cap" failures read the
  run's `journal.jsonl` / an `agent-*.jsonl` transcript BEFORE re-running;
  give research agents a fallback ("if Write fails, return the text").
- Commit trailer convention: see the session's system rules; never put model
  IDs in pushed artifacts.

## Deploys

Page fragments in `pages/<handle>` (file name = CMS handle) deploy via
`scripts/deploy-*.js` + `.github/workflows/*` on push to main (unless noted
otherwise — see rule 3). Scripts carry sanity checks (fonts, single h1,
JSON-LD parses, keyword arrays, meta lengths); replicate them locally with
node before pushing.
