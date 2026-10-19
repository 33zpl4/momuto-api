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
- **FAQ, shipping-policy and returns pages (all 5 stores)** are generated:
  content in `faq/faq.<locale>.json` / `policies/shipping.<locale>.json` /
  `policies/returns.<locale>.json` / `maker/maker.<locale>.json` (jersey-maker
  landing, US+EN); `scripts/build-faq-pages.js` / `build-shipping-pages.js` /
  `build-returns-pages.js` / `build-maker-pages.js` render into the pulled
  `cms/pages/<locale>/<handle>.json`
  (deploy via Deploy CMS Page `changed_since`). Numbers there must match rule 6
  and the US ladder in `docs/us-launch-status.md`; never hand-edit the built JSON.
- **Size-guide pages EN/ES/FR/IT** are generated too: edit the fragment `size-guide/<locale>`, run
  `node scripts/build-size-guide-pages.js` (writes `cms/pages/<locale>/<handle>.json`, deploy via Deploy CMS Page);
  US is edited directly in `cms/pages/us/size-guide.json`. Sizes must match the cart dropdowns in
  `design-momuto/templates/*/cartItem.html` (no 176 — factory maps it to adult S).
- `docs/shipped-email.md` — our branded "order shipped" email (Resend) driven by the platform order API (`poll-shipped-orders`, admin-orders `ship`), arming steps, what is not verified. Read BEFORE touching shipped/tracking emails.
- `docs/store-cart-ui.md` — the store `/cart` page + "Added to cart" pop-up: what the theme ships, the brand skin in `docs/cart-brand/` (one pasted script-manager entry per store, NOT deployed from the repo), probe `probe-cart-ui`. Read BEFORE touching cart/pop-up styling.
- `docs/blog-pipeline.md` — blog files, schema, deploy, translation workflow + its failure modes, post dates (the 1969-12-31 gotcha), image hosting. Read BEFORE touching `blogs/**`.
- `docs/live-chat-whatsapp.md` — the WhatsApp chat button (tool + cart), what a message with a design ref means and how to open that design.
- `docs/seo-opportunities-2026-09.md` — SEO audit of every plan vs what
  shipped (25 Sep 2026): what was fixed, the ranked backlog of what's next,
  owner-side checks. Start here before picking SEO work.
- **hreflang lives only in the sitemap** (`scripts/rebuild-sitemap.js`,
  nightly). Any new page or post that exists in ≥2 locales under DIFFERENT
  handles must get a row in `STATIC_CLUSTERS` / `BLOG_CLUSTERS` in the same
  commit, or Google gets no locale signal for it. Same-handle en↔us pairs
  are automatic. One URL may appear in one cluster only (the script now logs
  and skips a duplicate).
- `docs/store-theme-css.md` — the live store custom-CSS script (CMS name `PC端你也喜欢产品调准css`),
  the Jost audit and measured header/footer numbers; read BEFORE touching nav fonts or header styling.
- `docs/store-account-area.md` — the platform's customer account (login, orders, order detail, tracking) on the 5 stores: the three order surfaces, what is verified,
  the brand skin + tracking panel in `docs/account-brand/` (sources + generated paste-in `account-brand-entry.html`, one new script-manager entry per store, NOT deployed from the repo), the `probe-store-account` workflow, open decisions. Read BEFORE touching the account area, the header account icon or the footer "Order Status".
- `docs/warehouse-sheet.md` — factory 生产单 generator (`build-warehouse-sheet.js`,
  runs daily inside `check-platform-orders.yml`); sources + known roster gap.
- `docs/design-page-template.md`, `docs/rtp-collection.md` (historical),
  `docs/it-site-recovery.md`, `docs/10x-plan.md`.

## Team kits + gallery: ALWAYS delegate to Haiku

Adding a team, updating a team's images, and adding/refreshing a team in the
gallery are **always** delegated to a subagent on Haiku (`Agent` tool,
`model: "haiku"`) — owner ruling 26 Sep 2026, overrides the Sonnet default
below. `ADD_TEAM.md` §0 is the subagent's full runbook, including the exact
prompt to send (§0.1); pass the user's message verbatim and relay the §0.4
report. When a run fails for a reason outside the runbook, the orchestrator
fixes scripts/workflows and documents the new failure mode in `ADD_TEAM.md`
§10 so the next Haiku agent can handle it.
Pushing `claude/*` branches is pre-approved in `.claude/settings.json`
(owner ruling 28 Sep 2026) — no per-team push approval; the Haiku agent
pushes and verifies the run itself.

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
   Scope (owner, 25 Sep 2026): the rule protects product pages, product and
   design names, and anything that could read as a replica or licensed kit.
   Citing a well-known kit as the style reference teams bring us (e.g.
   France's Versailles-inspired kit) is fine in fact feeds like llms.txt.
5. **Deposit copy**: "€15 deposit, credited in full to orders of 5+ jerseys
   — free for a team order." Never refund-forward in marketing/GEO surfaces
   (incl. `static/shared/llms.txt` — it drifted once).
   **"Free design for teams" is the approved positioning (owner, 30 Sep 2026)** —
   search data shows free-intent queries are a top winner and US teams treat $15 as a
   non-issue. Always say WHO and WHEN in the same breath: "free design for teams"
   plus the deposit line ("€15 / $15 deposit, credited in full on orders of 5+
   jerseys"). Never a bare "free design" / "design is always free", never "refund"
   (it is a credit). The 3D designer itself is free (no deposit, no account).
6. **One set of numbers**: production 7–12 d, shipping 10–15 d, 25–30 door
   to door, mockup 24–48 h, €38.90 single, from €21.90 at 10+, seasonal
   selection −10%. Shorts €5.00 flat from 10 (17.90/15.90/11.90 below);
   kit = jersey + shorts at every tier (26.90 / 23.90 / 22.90 / 21.90 from
   10+; owner ruling 14 Sep 2026). Long sleeves +€3.00 per jersey (per
   player) and polo collar +€3.00 per jersey (per design, title marker;
   15 Sep 2026), both flat at every tier. Socks €3.90 per pair flat ($4.90 US;
   19 Sep 2026) — optional per player, NOT custom-printed (plain matching
   sock, most colours). Fast lane €59 / $69 per ORDER (23 Sep 2026): priority
   production + priority shipping, saves ~7 days (window 18–23 d instead of
   25–30; never promises a specific carrier). A surface with different numbers is a bug.
   Fabric: **92% polyester / 8% elastane**, 145–160 GSM micro-interlock, four-way stretch (owner, 15 Oct 2026).
7. `static/shared/llms.txt` is the machine-readable fact feed for LLMs —
   update it in the same commit as any fact change.
8. **One customer email: info@momuto.com** (owner ruling 5 Sep 2026).
   customer@ / orders@ never appear in customer-facing copy; `api/*.js`
   FROM_EMAIL defaults are transactional senders and are exempt.

## Agent-ops gotchas (tooling walls already hit)

- **"Not secure" / `ERR_CERT_AUTHORITY_INVALID` on the stores, reported from Spain (17 Oct 2026):** it was the Spanish ISP block of
  Cloudflare IPs during LaLiga match windows, not a site fault (outside check clean, no mixed content, Cloudflare Full strict).
  Read `docs/incident-2026-10-17-not-secure-spain.md` BEFORE hunting; check `whynopadlock.com` first.

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
- **Gallery pages are pipeline-owned — never edit or deploy `cms/pages/*/custom-kit-gallery.json`.**
  Deploy CMS Page pushed a stale US snapshot on 1 Oct 2026 and erased 29 team cards; the guard in
  `deploy-cms-page.js` now refuses gallery handles. Repair + details: `ADD_TEAM.md` §10.
- **Translate Blog Posts / Pull CMS Content (15 Oct 2026):** the translate script crashed when the model reply began with a non-text block (fixed, see `docs/blog-pipeline.md`); the translated handle changes on every run, so dry-run handles are not the live ones; dispatch Pull CMS Content one locale at a time (three at once raced on the commit-back).
- **Posts created through the API show 1969-12-31** unless `published_at` is sent (`docs/blog-pipeline.md`). A `PUT` without it can reset a real date; `deploy-blog-post.js` now preserves the live one.
- **A branch push that touches `static/**` deploys llms.txt etc. live to all stores** (Deploy Static Files has no branch filter); blog and CMS-page deploys only run on merge to main.
- **The CMS API throttles bursts of writes** (`code 1000 "Too many
  requests"`, ~7–130 calls in). Bulk deploys must space writes (~600 ms)
  and retry with backoff — `deploy-cms-page.js` / `deploy-blog-post.js`
  do since 3 Sep 2026; copy `withRetry` into any new bulk script. A
  throttled GET must throw, never read as "not found" (that turned
  updates into POST-creates once).
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

## Working practices (12 Oct 2026) — verify, build the lever, turn corrections into checks

- **Done means the surface's proof in `docs/verification-map.md`**, with the run id / green check named in the report. A push is not a proof;
  say plainly what was NOT verified (e.g. "the delay is not read back").
- **Dry run → read the log → live → read-back**, in that order, for every write to a store, the CMS or the design server.
  New writers copy `scripts/push-recovery-email.js` / `patch-gallery-review-count.js` (dry run by default, whole-object PUT, spaced and
  retried, `VERIFIED` line). A workflow can be dispatched from a `claude/*` branch before merge when the dry run was clean.
- **Build the lever on the second repetition.** The first manual fix is fine; the second becomes a script or workflow (the gallery
  review count, the recovery push, the inspector hide-empty rule all started as one-off diagnoses). Keep judgment with the model, mechanics in scripts.
- **A correction made twice becomes a check.** Owner corrections of copy go into `scripts/check-copy-rules.js` (PR check, baseline only
  shrinks); failures of the team pipeline go into `ADD_TEAM.md` §10; surface-specific traps go into `docs/verification-map.md`.
- **Never edit a pipeline-owned object from a repo copy** (gallery pages); read live, change one thing, write back.
- **Claims need a source.** Superlatives and statistics in copy ("fastest-growing", review counts) are the owner's call: say where each
  one comes from, or flag it as unsourced in the PR.
- **Autonomy boundary.** Without asking: `claude/*` branch pushes, dry runs, read-only checks, and live runs of an already-verified,
  idempotent workflow the owner asked for. Ask first: new reads of the production design server, anything the permission layer denies
  (do not route around it), merges the repo's protections reserve to the owner, new outbound email behaviour.
- **3D launch links are inventoried** (`docs/3d-tool-links.md`, generated by `scripts/audit-3d-links.js`; the PR check fails if it is stale). A new page or
  post with a launch link means: run the script and commit its output. The opening design is NOT in the links: it is `designQDefault` in `design-momuto/3d-configurator/asset/defines-ext.js`.
  Homepage blocks (`pages/homepage/*`) are pasted into the theme by the owner: a repo change there is not live until pasted.
