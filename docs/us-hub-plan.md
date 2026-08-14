# US English hub (`us.momuto.com`) — build plan & mirror strategy

**Status:** NOT STARTED. This is a forward plan. A future agent can execute it end to end.
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

### Decision

1. **Do not launch the dedicated store yet.** The store (currency, tokens,
   checkout, a fifth estate to sweep) does not fix position 43 — pages in
   the right lexicon do, and they can live on www today. The IT lesson:
   an under-tended store is negative equity.
2. **Run the US vocabulary sprint on www now** (this doc's page family):
   fix the orphaned soccer pages' internal linking, upgrade
   `design-your-own-soccer-jersey` (it's already climbing), build the
   uniform-lexicon page (65 queries, wide open), soccer-vocab wall entry
   points.
3. **Basketball ships as pages on www** (a hub + first studio designs when
   ready — the tool already has the body), so measurement can start. It
   earns its place in the US store by showing a pulse, not by decree.
4. **Store trigger (revisit then):** the soccer cluster reaching ~top 12
   AND US clicks sustaining several hundred/month, or demonstrable USD/
   checkout friction in US orders. At the current doubling rate that
   decision could arrive within a quarter — build the store then, with
   momentum, not before it.
