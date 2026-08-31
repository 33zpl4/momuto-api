# US English hub (`us.momuto.com`) — build plan & mirror strategy

**Status: BUILD IN PROGRESS — owner decision, 14 Aug 2026.** The data verdict
at the bottom of this doc recommended waiting for a trigger; the owner
overruled: *"we start building now because it'll take time."* Lead time is
the argument — store provisioning, content cloning, basketball design
production and indexing all have latency, and the US demand curve is
doubling meanwhile. The old trigger conditions (soccer cluster ~top 12,
sustained volume) are now **launch-readiness checks**, not start conditions.
Basketball is included at launch by owner decision — as its own category,
with the honest caveat recorded: zero measured US search demand yet, so its
job at launch is to start the clock, not carry the launch.
**Owner context:** MOMUTO custom football kit e-commerce. Four live locales today —
EN `www.momuto.com`, FR `fr.momuto.com`, ES `es.momuto.com`, IT `it.momuto.com`.
There is currently **one** English site (`www.momuto.com`) serving both
international and US audiences on the same URLs, with blended "football kit /
soccer uniform" copy.

## Why this exists (the problem)

A single English URL can only rank once per query. A US searcher ("custom
**soccer jerseys**", "team **uniforms**") and a UK/INT searcher ("custom
**football kit**") hit the *same* page, and we can't optimize the `<title>`, H1
and slug for both vocabularies at once. The existing EN pages lean UK/INT in
their slugs (`custom-football-kits-...`), so they under-target US "soccer/uniform"
queries where the URL string is a ranking signal.

**Goal of this project:** a dedicated US-English property in the *soccer/uniform*
lexicon, cross-linked to the INT pages via `hreflang`, so each vocabulary ranks
on its own terms without cannibalizing the other.

## Decision still needed from the owner (ask before building)

**Subdomain `us.momuto.com` vs subfolder `www.momuto.com/us/`.**
- The owner explicitly asked for `us.momuto.com` (subdomain) — treat that as the
  default unless they change their mind.
- Subdomain requires the CMS/hosting to provision a new store/domain and a new
  `OEMSAAS_TOKEN_US` API token. **This is a prerequisite the agent cannot do
  itself** — it needs the owner to create the US store in the CMS (oemapps) and
  add the token to GitHub secrets + Vercel. Confirm this is done before deploying.
- SEO note for the record: a subfolder on the existing domain would inherit
  `www.momuto.com`'s domain authority immediately; a subdomain starts closer to
  scratch for authority but is cleaner for geo-targeting and is what was
  requested. Either way the *content* mirror below is identical.

## Prerequisites checklist (blocking — verify first)

1. [ ] US store exists in the CMS (oemapps) for `us.momuto.com`.
2. [ ] `OEMSAAS_TOKEN_US` added to **GitHub repo secrets** (Settings → Secrets →
       Actions) AND to **Vercel** env if any API route needs it.
3. [ ] The following US pages exist in the CMS (the hub links to them; create as
       stubs if needed, in US lexicon):
       - `/pages/request-custom-kit-design` (the €15 brief gate)
       - `/pages/ready-to-play`
       - `/pages/size-guide`
       - `/pages/custom-soccer-uniform-materials-printing` (or reuse EN handle)
       - a supplier-comparison page (optional)
4. [ ] 3D configurator link works with `lang=en` (same asset as EN; no US variant
       needed — reuse the EN configurator URL verbatim).

If the store/token don't exist yet, STOP and tell the owner exactly what to
provision. Do not fake a deploy.

## Wire up the pipeline for a new `us` locale

The whole content pipeline is push-triggered (the sandbox can't reach the CMS
API; only the GitHub runner can). To add `us` as a locale, edit these three
files. Keep the pattern identical to the existing `en/fr/es/it` handling.

### a) `scripts/deploy-blog-post.js`
Add `us` to `DOMAIN_MAP`:
```js
us: { token: process.env.OEMSAAS_TOKEN_US, url: 'https://us.momuto.com' },
```
And add `us` to the path regex in `parsePath()`:
```js
let m = file.match(/^blogs\/(en|fr|es|it|us)\/(.+)\.json$/);
```
US posts live in `blogs/us/<handle>.json` (US is NOT top-level like EN — EN is
top-level `blogs/*.json`; every other locale is `blogs/<locale>/`).

### b) `scripts/pull-cms.js`
Add `us` to `TOKENS`:
```js
us: process.env.OEMSAAS_TOKEN_US,
```
`outPath()` already routes any non-`en` locale to `blogs/<locale>/<handle>.json`,
so `us` needs no change there.

### c) `.github/workflows/deploy-blog-post.yml` and `pull-blog-post.yml`
- Both already glob `blogs/**/*.json`, so `blogs/us/` deploys automatically.
- Add `OEMSAAS_TOKEN_US: ${{ secrets.OEMSAAS_TOKEN_US }}` to the `env:` block of
  the deploy step in `deploy-blog-post.yml` and the pull step in
  `pull-blog-post.yml` (mirror the existing `OEMSAAS_TOKEN_IT` lines).
- Add `us` to the `locale` choice `options: [en, fr, es, it, us]` in both
  `workflow_dispatch` inputs (cosmetic; the push path is what we use).

Commit these plumbing changes first, in one commit, before any content.

## The mirror: EN → US page map

Mirror all 8 EN hub pages. Source files are top-level `blogs/*.json`. Target
files go in `blogs/us/*.json`. **Rewrite the copy into US soccer/uniform
lexicon — do not just copy the EN text.** Change slugs, titles, H1s, body,
FAQ and the internal-link targets to the US handles.

| EN source (`blogs/…`) | US target (`blogs/us/…`) |
|---|---|
| `custom-football-kits-for-your-team-complete-guide` | `custom-soccer-uniforms-for-your-team-complete-guide` |
| `custom-football-kits-amateur-grassroots-club` | `custom-soccer-uniforms-club-team` |
| `custom-futsal-5-a-side-jerseys` | `custom-futsal-indoor-soccer-jerseys` |
| `custom-jerseys-7-a-side-sunday-league` | `custom-soccer-jerseys-adult-rec-league` |
| `custom-football-kits-corporate-events` | `custom-soccer-jerseys-corporate-events` |
| `custom-jerseys-football-tournaments` | `custom-soccer-jerseys-tournaments` |
| `when-to-order-team-kits-season-calendar` | `when-to-order-team-uniforms-season-calendar` |
| `fund-team-kits-sponsors-fundraising` | `fund-team-uniforms-sponsors-fundraising` |

### Lexicon substitutions (INT → US)
- football kit → **soccer uniform** (and "kit" → "uniform/jersey" contextually)
- football (the sport) → **soccer**
- jersey stays jersey; "shirt" → **jersey**
- Sunday league / 7-a-side → **adult rec league / co-ed league / pickup**
- pitch → **field**
- boots → cleats (only if boots ever appear)
- Keep "futsal" (same word in US); add "indoor soccer" as a synonym.
- trousers/shorts fine as-is.

### US authority sources to cite (replace EN's US Soccer / US Youth Soccer / The FA)
- US Soccer — https://www.ussoccer.com/
- US Youth Soccer — https://www.usyouthsoccer.org/
- US Adult Soccer Association (USASA) — https://www.usasa.com/
- AYSO (American Youth Soccer Organization) — https://www.ayso.org/
- US Futsal — https://www.usfutsal.com/
(Drop The FA — it's a UK body; keep US-only for the US property.)

## The page template (must match the other hubs exactly)

Every hub page uses this GEO-first structure. Copy the shape from any ES/EN
pillar or cluster; the class names come from `blog.css` (theme). Do NOT invent
new classes.

- **Answer-first capsule:** `<div class="ai-capsule"><span class="ai-capsule-label">Quick answer</span><p class="body-p" style="margin-bottom:0">…</p></div>`
- **Headings:** `<h2 class="h2-heading">`, `<h3 class="h3-subheading">`, body `<p class="body-p">`.
- **Routes/pricing table:** inline-styled `<table>` (dark header `#161616`,
  borders `#2a2a2a`) — copy verbatim from the EN pillar and swap link targets.
- **Inline FAQ + FAQPage JSON-LD:** an `<h2>Frequently asked questions</h2>` with
  `<h3>`/`<p>` pairs, followed by
  `<script type="application/ld+json">{…FAQPage…}</script>` whose questions match
  the visible ones exactly.
- **Sources:** `<h2>Sources</h2><ul class="body-p">…rel="nofollow" target="_blank"…</ul>`
- **See also:** internal links to the US pillar + 2 US clusters.
- **Final CTA:** `<section class="cta-card dark">…<a href="/pages/request-custom-kit-design" class="cta-btn">Send your concept · $XX</a> <a href="{CFG}" class="cta-btn" …>3D configurator (free)</a></section>`

### Facts / constants to reuse (verify pricing/currency for the US store!)
- Routes: **free 3D configurator** · **Ready-to-Play** (−10% vs custom) ·
  **Custom design** (deposit to start, credited from 5 jerseys).
- Timeline: first draft **24–48 h**, delivery **25–30 days**, **no minimum order**.
- Season: for a fall-season start, order **~5 weeks ahead**. (US seasons vary by
  region — spring & fall rec seasons; phrase generically, don't hard-code "September".)
- **CURRENCY IS AN OPEN QUESTION.** The EN/FR/ES/IT stores price in **€**
  (€21.90/jersey at 10+, €38.90 single, €15 deposit). If the US store prices in
  **USD**, convert and update every price token + the CTA (`$` not `€`). CONFIRM
  with the owner before writing prices. Do not silently keep euros on a US site.
- 3D configurator URL (reuse EN verbatim):
  `https://design.momuto.com/3d-configurator/configurator.html?userId=userIdUrl&configId=ypi9qc1z&suitName=mamuto3suit1&lang=en&langguage=en`

## hreflang cross-linking (critical — this is the whole point)

Without hreflang, the US and INT pages compete. After both sets are live, add
reciprocal hreflang tags so Google shows the right one per region. Preferred:
per-page `<link rel="alternate" hreflang="…">` in the page `<head>`.

For each mirrored pair (INT `www` ↔ US `us`):
```html
<link rel="alternate" hreflang="en-gb" href="https://www.momuto.com/blogs/<int-handle>" />
<link rel="alternate" hreflang="en-us" href="https://us.momuto.com/blogs/<us-handle>" />
<link rel="alternate" hreflang="x-default" href="https://www.momuto.com/blogs/<int-handle>" />
```
**Blocker:** blog *post* bodies (the JSON `content` field) can't reliably inject
`<head>` tags. Options, in order of preference:
1. Theme-level hreflang: have the CMS theme emit hreflang from a locale map
   (best; needs theme access — may require the owner or a theme edit).
2. If the CMS exposes a per-post canonical/alternate field, populate it.
3. Last resort: in-body `<link>` tags are ignored by Google in `<body>` — do NOT
   rely on them. Use an XML sitemap with hreflang annotations instead
   (`sitemap.xml` per domain, `<xhtml:link rel="alternate" hreflang="…">`).
Document which route was taken. Until hreflang exists, expect some
cannibalization — acceptable short-term, but close it.

## Orphan retrofit (after the 8 US pages are live)

Once the US store has its own blog posts (it may start empty), pull the US
inventory and retrofit any existing US posts with a "Read next" up-link block to
the US pillar + a US cluster — exactly like the EN retrofit. If the US store
starts with zero posts, skip this step; there are no orphans yet.

## Exact execution sequence (for the future agent)

1. Confirm prerequisites (store + `OEMSAAS_TOKEN_US` + currency). If missing,
   stop and tell the owner precisely what to provision.
2. Plumbing commit: add `us` to `deploy-blog-post.js`, `pull-cms.js`, and both
   workflows' `env:` + dispatch options. Push to `main`.
3. Pull US inventory to see what exists:
   put `inventory us` in `.github/pull-queue.txt`, commit, push, wait ~60s,
   `git pull --rebase`, read `cms/inventory/us.json`. Confirm the linked
   `/pages/...` handles exist; adjust the map above to real handles.
4. Draft all 8 `blogs/us/*.json` from the EN sources, rewritten into US lexicon,
   US sources, correct currency, US internal-link targets. Keep meta_title ≤60
   and meta_descript ≤160 (plain unicode in meta/title/summary; HTML-entity the
   body only if it contains accents — US English usually has none, so body can be
   plain ASCII + `$`/`—`). Validate every JSON parses.
5. Commit `blogs/us/` (8 files) → push `main` → wait ~40s → verify the
   **Deploy Blog Post** run shows `✨ created` for all 8 (via
   `mcp__github__actions_list` → job logs; large outputs save to a file, parse
   with python).
6. hreflang: implement the best available route (theme or sitemap). Add
   reciprocal tags for all 8 pairs. Document the method.
7. (If US store has posts) orphan retrofit via the pull queue.
8. Tell the owner what's live and how hreflang was wired.

## How the pipeline works (reference — already built)

- **Deploy:** push any `blogs/**/*.json` to `main` → `.github/workflows/
  deploy-blog-post.yml` runs `scripts/deploy-blog-post.js`, which UPSERTs
  (PUT to update, POST `/posts` to create). `status:0` = draft.
- **Pull:** the sandbox can't reach the CMS. Put lines in
  `.github/pull-queue.txt` (`<type> <locale> <handle>`, or `inventory <locale>`)
  and push → `pull-blog-post.yml` runs `scripts/pull-cms.js`, fetches, commits
  back `[skip ci]`. Then `git pull --rebase origin main` locally.
- **Verify:** after a deploy push, wait, then `mcp__github__actions_list`
  (list_workflow_runs → latest run id → list_workflow_jobs → job id →
  `mcp__github__get_job_logs return_content:true`). Large list results exceed the
  token cap and are saved to a file — parse with python by char-slicing.
- **Secrets:** `OEMSAAS_TOKEN_{EN,FR,ES,IT}` today; add `_US`.
- **Deploys go to `main`** (the workflows only trigger there). The designated
  feature branch does not trigger deploys.

## Reference: the 8 live EN pages this mirrors

Read these for exact structure/tone before drafting the US versions:
`blogs/custom-football-kits-for-your-team-complete-guide.json` (pillar) and its 7
clusters (`...amateur-grassroots-club`, `custom-futsal-5-a-side-jerseys`,
`custom-jerseys-7-a-side-sunday-league`, `custom-football-kits-corporate-events`,
`custom-jerseys-football-tournaments`, `when-to-order-team-kits-season-calendar`,
`fund-team-kits-sponsors-fundraising`). The ES hub
(`blogs/es/equipaciones-de-futbol-para-tu-equipo-guia-completa.json` + clusters)
is the cleanest template for capsule/table/FAQ-JSON-LD shape.

---

## Data verdict — 14 August 2026 (12 months of US-only GSC)

**The trajectory is unambiguous; the base is still small.** US monthly
clicks: ~7/mo a year ago → 8 (Jan) → 32 (May) → 59 (Jun) → **151 (Jul)** →
August tracking to roughly double July again. Impressions grew ~3.4x
year-over-year. July — the World Cup month on US soil — is the best month
ever recorded, and August is holding above it pro-rata: the post-WC soccer
tailwind is real, not a one-week spike.

**The bottleneck is vocabulary, not domain.** Non-brand US demand reaching
us: "soccer" queries at **position 43.5** (185 queries), "uniform" queries
at **position 58** (65 queries, one click in a year), while our niche
strengths ("3d", "free") sit at position 14–20 and convert. The homepage
absorbs 27.3k of 29.1k US impressions at position 33.7. The ONE page built
in US vocabulary (`design-your-own-soccer-jersey`) is the #2 US page at
position 18 — proof the lexicon works when a surface exists. The other US
pages (`custom-soccer-jerseys`, `custom-youth-club-soccer-uniforms`) are
near-invisible (~41 impressions) — likely orphaned; internal links first.

**Basketball: literally zero.** 0 US basketball queries, 0 impressions, in
12 months. There is no basketball demand arriving because no basketball
surface exists — it is a creation play, not a capture play, and therefore
must not be what a US launch bets on.

### Decision — OVERRULED by owner, 14 Aug 2026

The analysis above recommended a www-first vocabulary sprint with the store
on a trigger. **The owner overruled: build the dedicated US store now**,
because everything on the critical path has lead time and the demand curve
is doubling while we wait. The analysis stands as context (the vocabulary
findings still dictate *what the US pages say*); the sequencing conclusion
does not. The full clone specification follows.

---

# THE FULL CLONE — everything needed to stand up us.momuto.com

> **BUILD STATUS (31 Aug 2026, branch `claude/us-site-basketball-front-4g0f94`):**
> the §B repo estate is built and sitting ready. What landed:
> - **B.1** `static/us.momuto.com/robots.txt` + `llms.txt` (USD / soccer lexicon).
> - **B.2** `pages/us/{ready-to-play, request-custom-kit-design,
>   ai-concept-to-real-kit, custom-basketball-jerseys}` — US lexicon, USD,
>   wall carries a Basketball section (deep link `suitName=mamuto3basket3`,
>   no configId — verify it opens the basketball body). The gate ships with
>   `__STRIPE_LINK_US__`; its deployer refuses to ship until replaced.
> - **B.3** the 8-post mirror in `blogs/us/` per the map below.
> - **B.4** `us` locale in deploy-blog-post.js / pull-cms.js /
>   deploy-static-files.js / rebuild-sitemap.js + workflow env/dispatch;
>   pages deploy via NEW `scripts/deploy-us-pages.js` +
>   `deploy-us-pages.yml` (upsert, sanity checks incl. €-ban and Stripe
>   guard) instead of threading `us` through four per-page scripts.
>   Everything no-ops green while `OEMSAAS_TOKEN_US` is missing.
> - **B.5** hreflang via sitemap `xhtml:link`: `us` joined LOCALES
>   (`en-US`), page clusters for ready-to-play / request gate / AI page,
>   and the 8 EN↔US `BLOG_CLUSTERS`. Pairs emit only when both sides exist
>   live; x-default stays www.
> - **Products**: `scripts/create-us-rtp-products.js` +
>   `create-us-rtp-products.yml` (dispatch-only) clone the RTP product set
>   EN → US: handles parsed from the US wall (7 products), EUR→USD via an
>   explicit owner-ruled PRICE_MAP (unmapped price = loud failure, never a
>   silent conversion), create-then-rewire `inner_title.productId`,
>   idempotent (existing US handles skip). Collections are not cloned.
>   So A.5 "publish products" is now: add the token, dispatch the workflow
>   (dry-run first), attach the collection in admin if wanted.
> Still owner-gated (§A): store+DNS, `OEMSAAS_TOKEN_US`, USD price confirm
> (single $45.90 / fast lane +$69 / long-sleeve upcharge — NOT printed
> anywhere yet), US Stripe link, RTP products published in USD (wall tiles
> 404 until then), basketball designs, GSC property, legal pages, and the
> CMS stubs the content links to: `size-guide`,
> `custom-soccer-uniform-materials-printing`, `privacy-policy`,
> `customized-design-confirmed` (gate redirect), `contact`.

The mirror plan above covers the blog hub (8 posts). A cloned *site* is
much more. This section is the complete bill of materials, split by who can
do it. Agent work can start immediately in the repo; owner work gates going
live.

## A. Owner must provision (agent cannot; blocking for launch, not for build)

1. **US store in the CMS** (oemapps): new store bound to `us.momuto.com` —
   DNS CNAME + SSL, theme installed (same theme as www so fragments render
   identically), navigation/menus/footer configured in admin.
2. **`OEMSAAS_TOKEN_US`** added to GitHub repo secrets (and Vercel env if
   any API route needs it). Without this, nothing deploys.
3. **Currency & price list in USD** — DECIDED IN PART (owner, 14 Aug):
   pricing rounds *up* slightly from conversion ("we pump slightly").
   **From $25.90/jersey at 10+** (owner-set; €21.90 ≈ $25.33 → $25.90).
   Derived by the same rule, awaiting owner confirmation: single jersey
   **$45.90** (€38.90 ≈ $45.01), fast lane **+$69** (€59 ≈ $68.3),
   deposit **$15** (kept flat — psychological threshold, credited anyway).
   Set once, then it's the law everywhere. *Never € on the US store.*
4. **US delivery numbers CONFIRMED (owner, 14 Aug):** 25–30 days door to
   door and the fast lane's ~7 days both hold for US addresses.
5. **US Stripe payment link** for the deposit gate (like the IT one) in
   USD, for `/pages/request-custom-kit-design`. Owner is provisioning the
   store now and will return with token + links.
5. **Products published on the US store**: the Ready to Play product set
   (`the-fracture` … + full-kit variants) with USD prices. Either via CMS
   admin or the product-create API (`docs/cms-product-create-api.md`).
   Cards pointing at unpublished products 404 — the rtp-collection lesson.
6. **US shipping confirmation**: does 25–30 days door-to-door hold for US
   addresses, and does the fast lane's ~7 days hold? If US differs, say so
   now — one set of numbers per store, no drift.
7. **Basketball designs from the studio**: the tool has the body
   (`mamuto3basket3`) but the catalog has zero basketball designs, renders
   or finder images. Minimum for launch: 3–4 finished basketball designs
   (renders + SVG templates + catalog entries in design-momuto), or the
   basketball category launches as tool-only, which is weaker.
8. **Google Search Console property** for `us.momuto.com` (+ analytics),
   after DNS exists.
9. **Legal pages**: US-appropriate terms/privacy/returns (the DE plan's
   "legal pack" concept). Confirm returns language for US consumer law.

## B. Agent builds in the repo (can start NOW, deploys once A.1–A.2 exist)

1. **Static estate**: `static/us.momuto.com/robots.txt` (same AI-crawler
   allowances + blocks as www) and a US `llms.txt` variant — soccer/uniform
   lexicon, USD facts, US page links. The shared llms.txt is EUR/football;
   the US store needs its own.
2. **Pages estate in US lexicon** (fragments in `pages/`, deployed by a new
   `us` entry in the page deploy scripts):
   - **The wall** → handle `ready-to-play`, "Custom Soccer Jersey Designer"
     framing, uniform/soccer vocabulary, USD prices, same 16 tiles + a
     **basketball section** when designs land (own section on the wall AND
     its own hub page — sport is an axis).
   - **Request gate** → `request-custom-kit-design`, USD deposit, US Stripe
     link, same guard pattern as the IT gate deploy.
   - **AI page** → `ai-concept-to-real-kit` US variant ("AI soccer jersey
     generator" lexicon).
   - **Basketball hub** → `custom-basketball-jerseys` (+ uniforms variant):
     the creation-play surface; tool deep link with the basketball body,
     designs as they land.
   - Size guide, about, contact, teams/gallery — clone with lexicon pass.
   - **Comparison page** → US competitors (the EN
     `best-custom-soccer-jersey-makers-2026` page is the seed — it may
     MOVE to the US store as its natural home).
3. **Blog estate**: the 8-post mirror per the map above, PLUS the Wave 1
   pair in US lexicon (`when-to-order-team-uniforms-season-calendar`
   already in the map; the essay with US seasons — fall/spring rec, no
   "September" hard-coding).
4. **Deploy plumbing**: `us` locale in `deploy-blog-post.js`, `pull-cms.js`,
   both blog workflows, the page-deploy scripts that grow a `us` entry
   (`deploy-ready-to-play-page.js`, `deploy-request-design-page.js`,
   `deploy-concept-pages.js`), and `rebuild-sitemap.yml` (US store joins
   the daily sitemap build). All guarded so a missing `OEMSAAS_TOKEN_US`
   skips cleanly instead of failing the run.
5. **hreflang**: per the section above — sitemap-level `xhtml:link`
   annotations (en / en-us / x-default) for every mirrored pair, since
   post bodies can't inject `<head>`. Wired into the sitemap rebuild.
6. **Guardrails carry over**: naming grammar (Ready to Play, unnamed
   seasonal promo, lowercase studio), deposit copy never refund-forward,
   clubs in editorial only, one set of (USD) numbers.

## C. Build order

1. **Now (repo, unblocked):** B.1 static estate → B.2 wall + request gate +
   basketball hub drafts → B.3 blog mirror → B.4 plumbing (guarded) →
   B.5 hreflang prep. All of it sits ready on main, deploying nothing
   until the token exists.
2. **Owner in parallel:** A.1–A.4 (store, token, USD prices, Stripe) —
   these gate first deploy. A.7 basketball designs — gates the basketball
   section being more than a tool link.
3. **First deploy** the day A.2 lands: static + wall + gate + blog mirror.
4. **Launch-readiness check** (the old triggers, repurposed): pages
   indexed, hreflang live, products buyable in USD, checkout tested with a
   real card, GSC property collecting. Then the announcement piece — after
   the surface exists, per the standing rule.

## D. Open questions for the owner (answer before first deploy)

1. USD price list — confirm or correct the proposal in A.3.
2. Fast lane price in USD.
3. Does 25–30 days hold for US delivery?
4. Basketball at launch: how many designs can the studio commit, by when?
5. Does the EN US-comparison page (`best-custom-soccer-jersey-makers-2026`)
   move to the US store, stay on www, or exist on both with hreflang?
