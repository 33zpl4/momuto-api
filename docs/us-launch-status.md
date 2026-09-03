# us.momuto.com — launch ledger (1 Sep 2026)

The build record for the US store, written the week it went live. Read this
before touching any US surface; `docs/us-hub-plan.md` is the original plan,
THIS is what actually shipped and what's still open. Estate-wide shipping
config lives in `docs/store-config-shipping.md`.

## Live and verified (green Actions runs, per-write log evidence)

- **Domain**: bound per `docs/domain-binding-runbook.md` (A record `us` →
  104.18.20.248, bound grey-cloud, verified). Token `OEMSAAS_TOKEN_US` in
  GitHub Actions secrets.
- **Pages** (`pages/us/*`, deployed via `deploy-us-pages.yml`):
  ready-to-play, request-custom-kit-design (live Stripe link
  `buy.stripe.com/8x2fZhe204q8ge32KV3wQ0M`, $15 deposit),
  ai-concept-to-real-kit, custom-basketball-jerseys (tool-only launch,
  `suitName=mamuto3basket3`).
- **Blog**: 8 posts in `blogs/us/*.json`, US lexicon (soccer, USD), live.
  Store URLs are `/blogs/<handle>` — NO `/us/` segment (store-per-domain).
- **Products**: 7 RTP products cloned from EN at **$40.90** (owner-ruled
  from €35.00), ids 16910217–16910223, inner_title 3D pointers rewired —
  `scripts/create-us-rtp-products.js`.
- **Nav**: curated "Header Menu" via `sync-store-config.js apply-nav` —
  Custom Jerseys ▾ (Ready to Play / Custom design request ($15) / AI
  concept), Basketball, Iconic Series ▾ (Drop 01/02), Support ▾
  (FAQ / Printing / Size guide). Guides removed (owner ruling). The
  gallery is NOT in the menu yet (cloned later — see below).
- **Homepage SEO**: via `apply-seo` — title/descript/keywords in
  `sync-store-config.js` (`HOMEPAGE_SEO.us`).
- **Shipping**: USPS zone (US only) $4.90 under $59 / free at $59+;
  worldwide zone excludes the US. See the shipping doc.
- **Static**: `static/us.momuto.com/` robots.txt + llms.txt (USD/soccer
  lexicon), blog.css, sitemap with hreflang en ↔ en-US clusters
  (x-default = en) via `rebuild-sitemap.js`.
- **Gallery** (`/pages/custom-kit-gallery`): owner cloned it + ~130 team
  design pages from EN in the admin (1 Sep). SEO then fixed via
  `cms/pages/us/custom-kit-gallery.json` + `deploy-cms-page.yml`
  (us locale added): soccer lexicon, USD JSON-LD ($25.90/$45.90, $15
  deposit, free over $59), 500+ claim, meta_keywords array, and all
  131 design-card links made RELATIVE (they pointed at www cross-store;
  probe-pull of `dmc-football-club-custom-kit-design` with the US token
  proved the team pages exist on the US store).

## Standing US conversions (owner-ruled — "pump slightly, .90 endings")

€21.90→$25.90 · €38.90→$45.90 · €35→$40.90 · €59→$69 · €19.70→$23.30 ·
€15→$15 · threshold €50↔$59 · fee €3.90↔$4.90 · €24.90→$28.90 ·
€26.90→$30.90 · €24.20→$27.80. Homepage-block extras: €39→$46, €40→$47,
€54.90→$64.90, €49.90→$58.90, €64.90→$76.90 (derived; owner may adjust).
Never invent a pair — unmapped prices fail loudly by design.

## Rulings to respect (owner, 1 Sep 2026)

- **No geo-redirect from www to us.momuto.com.** Google crawls from US
  IPs; a forced redirect hides www (which holds the rankings and the
  growing US traffic) from Googlebot. hreflang is the steering mechanism.
  If anything, a dismissible "Shopping from the US?" banner on www —
  link, never redirect. Revisit only when us. is fully checkout-wired,
  indexed, and outranking www for US queries.
- Claims estate-wide: **250+ teams, 15+ countries, 500+ designs**.
  momuto.com frames Europe-wide (not France/Spain — those have stores);
  the US site highlights the US.
- US free-shipping threshold in copy: **$59** everywhere.

## Still open

1. **Checkout wiring** (`docs/domain-binding-runbook.md` Part 4): US base
   jersey/shorts/socks product ids in a `checkSumbit.html` DiyFile,
   `GoodInfoAction` PHP routing on the design server, `us` in
   `embed.js` STORE3D/CONFIG3D. Until done, the 3D→cart→checkout flow is
   NOT first-class — this also gates any push of US visitors to the store.
2. Owner manual: paste `pages/homepage/*.us.html` blocks (7 files, USD);
   US announcement banner text "$59" (www banner "€50"); GSC property for
   us.momuto.com + sitemap submit; test the $15 Stripe flow end-to-end;
   `customized-design-confirmed` stub page (gate redirect target).
3. Gallery in the US nav: not linked yet (owner's call; `apply-nav` in
   `sync-store-config.js` already carries the menu — add a child and
   dispatch).
4. The ~130 cloned team design pages keep EN football-lexicon meta
   ("… Custom Kit Design Preview"). Acceptable as portfolio pages;
   a meta sweep is optional future work.

## US-lexicon pass over the cloned estate (3 Sep 2026)

**Why**: GSC (Jun–Sep 2026, momuto.com property): United States = 26k
impressions, 537 clicks, position 19.4, CTR 2% — the weakest big market,
because www ranks on the football/shirt query family while Americans
search the "soccer" one (*soccer jersey maker* 637 imp @23, *custom soccer
jersey maker* 561 @28, *3d soccer jersey designer* 549 @12, *create your
own soccer jersey online free* 511 @6.5, *custom soccer jersey creator*
429 @34, *custom soccer jerseys* 222 @25). The owner's wholesale clone of
www onto us.momuto.com (758 objects: 202 pages, 43 posts, 513 products)
carried the UK lexicon, EUR prices, stale claims and absolute www links.

**Tooling (all in repo, re-runnable)**:
- `Pull CMS Content` workflow, `cms_type=dump locale=us` → raw objects
  under `cms/{pages,posts,products}/us/` (commit-back is branch-safe now).
- `scripts/audit-us-lexicon.py` — per-object hit table + target-keyword
  coverage; `--json` for machine output.
- `scripts/us-lexicon-fix.py [--write]` — text nodes only (never URLs,
  tags, `<style>`, JS); football→soccer with proper nouns protected
  (`DMC FOOTBALL CLUB` stays), shirt→jersey (not t-shirt/polo), pitch→
  field, boots→cleats, British→US spelling, EUR→USD **only via the
  owner map** (unmapped € reported, untouched), JSON-LD currency, stale
  claims, www links → relative. Cloned EN posts are emitted as
  `blogs/us/<handle>.json`; the 8 EN twins of US-native posts are skipped
  (unpublished via `cms/unpublish.json` "us").
- Bulk deploys: `Deploy CMS Page` / `Deploy Blog Post` now take
  `changed_since=<git ref>` (deploys every file changed since that ref).
- Sitemap: any page/post handle live on BOTH en and us auto-pairs as an
  hreflang cluster (curated clusters still win).

**Result (3 Sep)**: 194 pages + 26 posts rewritten and deployed; money
pages got keyword arrays, ≤160-char metas, "Explore 500+ Custom Soccer
Jersey Designs" and a "Create Your Own Soccer Jersey Online — Free" CTA
(largest un-anchored US query). Team pages (163) done mechanically.

**Left deliberately untouched — owner rulings needed**:
1. **Product prices on the US store are NOT the owner's USD pairs.** The
   platform clone converted at an FX rate: 45.14 / 45.26 / 57.91 / 65.92 /
   59.30 / 49.79 … (e.g. €38.90 → $45.14, ruling says $45.90). Only the 7
   RTP jerseys we created ($40.90) follow the rule. 422 "Your custom design
   — this is what we produce" order-mockup products sit at $0 (already
   excluded from the sitemap; still status 1). Decide: reprice by rule via
   a script (`/products/batchsave` takes partial updates), or delete the
   per-order mockups from the US store.
2. Unmapped € on pages: `momuto-vs-jersix-owayo-spized-comparison` carries
   an old EN volume ladder (€34.90/26.90/18.90/17.90/16.90 + shorts) and
   competitor EUR prices; `contact` says "€30 deposit may apply"; bachelor
   page "€22 per head"; `faq`/legacy gate had €20.90 (mapped to $25.90 as
   the same fact). Rule on the ladder before touching that page again.
3. 36 products carry football/EUR in title/body — fixable through
   batchsave (partial), not done yet.
4. `teams-clubs-momuto` + EN twin still say "100+ clubs" in body copy on
   www (EN is out of this pass's scope) — same stale claim exists there.

## Tooling gotchas hit this week (beyond CLAUDE.md's list)

- **Pull CMS Content on a non-main branch**: its commit step runs
  `git pull --rebase origin main` + plain `git push` — on a branch whose
  history diverges from main the push fails non-fast-forward AND the
  wanted file is lost with the run. The PULL itself still logs
  (`✅ Pulled page …`), so a probe ("does handle X exist on store Y?")
  is answerable from the run log even when the run ends red.
- `workflow_dispatch` validates inputs against the workflow file at the
  DISPATCHED ref — new inputs/options work from a branch as soon as the
  branch has them (the workflow just has to exist on main to be listed).
- Deploy CMS Page's push trigger fires on MAIN pushes of
  `cms/pages/**/*.json` — merging a branch that edited those files
  re-deploys them automatically (idempotent, but know it happens).
