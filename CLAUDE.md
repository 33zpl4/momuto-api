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
- `docs/us-launch-status.md` — what actually shipped for us.momuto.com,
  the standing EUR→USD conversion table, and owner rulings (incl. **no
  geo-redirect www→us**; hreflang steers, banner at most).
- `docs/store-config-shipping.md` — live shipping zones for all 5 stores +
  the `sync-store-config.js` tool (navs/SEO/shipping); read BEFORE any
  zone, nav, or seoplan write. Zone overlap/permission gotchas live there.
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
- **A "failed" agent may have already done the work.** When credits ran out
  mid-run (5 Aug), 8/12 research agents reported failure — but every dossier
  was already on disk; the error hit at their final-summary step. **Always
  `ls` the output directory before re-running anything.** Re-running would
  have burned another full research pass to reproduce files that existed.
- **Pull CMS Content dispatched on a non-main branch**: the pull itself
  works and LOGS the result, but the commit-back step can die
  non-fast-forward (it rebases onto main). Read the run log for the
  answer before re-running; the pulled file may not land in git.
- Commit trailer convention: see the session's system rules; never put model
  IDs in pushed artifacts (commit messages, PR bodies — API `model:` params
  in scripts are configuration, not attribution, and are fine).
- **Model policy (owner ruling, Aug 2026)**: the orchestrating session plans;
  execution runs on the cheaper tier. Anthropic API calls in repo
  scripts/workflows use `claude-sonnet-5` (parse-invoice stays on Haiku —
  already below Sonnet). Subagents/workflow-tool agents spawned from a
  session run on Sonnet unless the owner says otherwise.

## Deploys

Page fragments in `pages/<handle>` (file name = CMS handle) deploy via
`scripts/deploy-*.js` + `.github/workflows/*` on push to main (unless noted
otherwise — see rule 3). Scripts carry sanity checks (fonts, single h1,
JSON-LD parses, keyword arrays, meta lengths); replicate them locally with
node before pushing.

- **Deploy Static Files auto-runs — never ask the owner to click Run after
  a merge that touched its paths.** Its `on.push` (NO branch filter — rule 3
  applies: a BRANCH push touching these paths deploys live immediately)
  watches `static/**`, `public/configurator/custom-content.js` and
  `rtp-loader.js`. A push-triggered run has empty TARGET_FILE/TARGET_DOMAIN,
  which the script treats as "ALL files, ALL stores" — so it ships every
  file in its list (pricing.js, llms.txt, robots.txt…) even ones whose own
  paths are not push-watched. Verified Aug 2026: one PR produced TWO full
  deploys, branch push + merge push. Manual workflow_dispatch is only
  needed when a listed file (e.g. `pricing.js`, `embed.js`) changes WITHOUT
  any watched path in the same push.
