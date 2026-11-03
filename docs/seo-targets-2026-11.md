# SEO targets — United States, set 3 November 2026

Companion to `docs/seo-status-2026-11.md` (the handoff, store-level numbers from `metrics/weekly.json`). This doc adds what the
scorecard cannot show: **page- and query-level data for the US**, from two Search Console exports the owner pulled on 3 Nov 2026,
and turns the findings into **numbered targets with a baseline, a date and a re-read rule**. Read the handoff first.

## Sources (exact filters, so the next read compares like with like)

| Export | Property | Filters | Window | Rows |
|---|---|---|---|---|
| A | `momuto.com` domain property (all hosts) | Country = United States, Web | last 12 months (data starts 16 Jan 2026) | 1,000 queries · 166 pages · daily series |
| B | `us.momuto.com` URL property | none (all countries), Web | since the property's first data, 30 Aug 2026 | 139 queries · 114 pages · daily series |

Queries sheets are capped at 1,000 rows and omit anonymised queries, so query totals (A: 1,225 clicks) are below page totals
(A: 2,238 clicks). Clusters below are built from the query sheet; share-of-total statements use the page sheet. Neither export
crosses query with page, so "which page took which query" is inferred from positions (noted where it matters).
Raw sheets are not committed; re-pull with the same filters for the next read.

## Where the US stands (export A, 12 months, country = US)

| Window | Clicks | Impressions | CTR | Position |
|---|---:|---:|---:|---:|
| 12 months total | 2,238 | 75,619 | 3.0% | 18.7 |
| 19 Aug – 15 Sep (the Sept report window) | 462 | 11,673 | 4.0% | 13.6 |
| 8 Sep – 5 Oct | 672 | 12,936 | 5.2% | 11.4 |
| **6 Oct – 2 Nov (last 28 d)** | **809** | **14,044** | **5.8%** | **9.8** |

Weekly: 0–10 clicks/week until June, 50 in late July, 120 in early September, **268 in W43** (19–25 Oct, position 8.5).
US clicks grew +75% since the September read while the position moved 13.6 → 9.8. The curve is still up; the season calendar
says Nov 1 – Dec 15 is "low", so a flat December is not a failure.

**Who takes the clicks (export A, by host):**

| Host | Pages | Clicks | Impressions | CTR | Position |
|---|---:|---:|---:|---:|---:|
| www.momuto.com | 117 | 1,219 (of the 1,239 attributed to a page) | 58,402 | 2.1% | 20.7 |
| **us.momuto.com** | 18 | **0** | 773 | 0.0% | **52.1** |
| fr / es / it / design / start | 31 | 19 | 1,449 | — | — |

Two www pages are 97% of it: the homepage (631 clicks, 41,040 impr, pos 26.4, CTR 1.5%) and `design-your-own-soccer-jersey`
(553 clicks, 9,189 impr, **pos 6.2, CTR 6.0%**). Everything else on www is ≤ 7 clicks.

**Devices:** desktop 1,259 clicks at position 22.0; mobile 889 at 13.8; tablet 90 at 6.4. The desktop gap flagged in July is still there.
**Search appearance:** product snippets 810 clicks (36% of all US clicks, CTR 6.5%), review snippet 169 (CTR 6.5%). Both still render;
the JSON-LD prices/ratings must keep matching rule 6.

## Query clusters (export A, query sheet)

| Cluster | Queries | Clicks | Impressions | CTR | Position | Read |
|---|---:|---:|---:|---:|---:|---|
| brand ("momuto…") | 8 | 518 | 967 | 53.6% | 1.1 | 42% of attributed clicks |
| soccer maker / designer / creator | 140 | 561 | 11,717 | 4.8% | 17.0 | the engine; see T2 |
| "free" / "for fun" | 30 | 169 | 1,825 | 9.3% | 9.1 | best-converting non-brand cluster |
| generic "jersey maker / creator / designer" (no sport) | 35 | 51 | 7,323 | 0.7% | 27.4 | nothing targets it; see T3 |
| "football …" without "soccer" (American football in the US) | 359 | 52 | 21,223 | 0.2% | 18.8 | not our product; see Decision 1 |
| buyer intent (custom soccer jerseys / uniforms / kits / team, no maker word) | 169 | 11 | 3,106 | 0.4% | ~35 | **invisible**; see T4 |
| basketball | 15 | 0 | 125 | 0.0% | 67.2 | see T5 |

Top queries by clicks: momuto 484 · create your own soccer jersey online free 87 (pos 7.2, CTR 11.5%) · soccer jersey maker 79
(1,517 impr, pos 13.7, 5.2%) · soccer jersey designer 50 (pos 7.0) · 3d soccer jersey designer 41 (694 impr, pos 13.4) ·
soccer jersey creator 35 (pos 10.8) · make your own soccer jersey 32 (pos 10.1) · jersey maker soccer 25 (pos 6.4) ·
make your own soccer jersey for fun 23 (pos 3.5, 13.9%) · jersey maker 22 (1,096 impr, pos 21.1, 2.0%).

Page-two reserve (≥150 impr, position 8–20, excluding American football): soccer jersey maker 1,517 @13.7 · 3d soccer jersey
designer 694 @13.4 · jersey design maker 675 @12.5 (**0 clicks**) · jersey designer 672 @17.8 · soccer jersey creator 557 @10.8 ·
make your own soccer jersey 525 @10.1 · create your own soccer jersey 331 @14.2 · jersey configurator 273 @11.8 (0 clicks) ·
design your own soccer jersey 238 @12.4. About 5,500 impressions sitting at positions 10–18.

## The US store (export B, since 30 Aug; and export A rows for `us.momuto.com`)

- 37 clicks in nine weeks, 17 in the last 28 days (15 the 28 before). Impressions doubled (482 → 911) and position sits at 25–35.
- Clicks come from the homepage (13, pos 10.4, mostly brand), **custom-basketball-jerseys (13 clicks on 237 impr at position 53)**,
  `/coupons` (4), ready-to-play (2). The money twins get nothing: `custom-soccer-jersey-designer` 383 impr at **pos 51** (1 click),
  `design-your-own-soccer-jersey` 29 impr at 43, `custom-soccer-uniforms` 24 at 62, `custom-soccer-jerseys` 19 at 42.
- In the domain property (US country) the same us pages have 0 clicks on 773 impressions at position 52; the www twin of
  design-your-own has 9,189 impressions at 6.2. **Nine weeks after the sitemap hreflang went in (18 Sep), Google has not moved a
  single paired query from www to us.** This is not "wait longer": for a same-handle twin with the same title and near-identical body,
  Google picks one canonical of the pair and serves it everywhere; hreflang only swaps between URLs it has indexed as distinct.
  The us twin of design-your-own even carries the **same title** as the www twin ("Soccer Jersey Maker — Create Your Own Soccer
  Jersey Online Free").
- Basketball is the one place the us store wins on its own: 43 basketball queries (176 impr, pos 67) plus 13 clicks on the page
  from anonymised queries. The page has no www twin and nothing links to it except the US nav.
- Non-US countries on export B: Honduras 2 clicks, IT/FR/ES 1 each. Nothing to act on.

## Targets

Baselines are export A unless marked B. "Re-read" means the owner pulls exports A and B with the same filters; the first re-read is
**15 Dec 2026** (6 weeks, low season, mostly to confirm direction), the scoring read is **15 Jan 2027**. A 28-day window compares with
the "last 28 d" rows above.

### T1 — us.momuto.com becomes the US destination for the paired money pages

| Metric | Baseline (3 Nov) | 15 Jan 2027 target |
|---|---|---|
| us.momuto.com clicks, 28 d (B) | 17 | **≥ 120** |
| us share of US-country impressions on the 3 paired handles (design-your-own, custom-soccer-jersey-designer, custom-soccer-jerseys) (A) | ~3% (307 of ~10,090) | **≥ 30%** |
| position of `us…/pages/custom-soccer-jersey-designer` (B) | 51 | **≤ 15** |

Actions, in order:
1. **Owner, 10 minutes, decisive:** Search Console → URL inspection on the three us twins above. Note *User-declared canonical* vs
   *Google-selected canonical*. If Google selected the www URL (or the page is "Duplicate, Google chose different canonical than user"),
   the steering problem is duplication, not hreflang, and action 2 is the fix. Paste the three results into this doc.
2. **Differentiate the us twins so they are not duplicates:** distinct title and meta description from the www twin (soccer lexicon
   plus a US cue: USD ladder "$25.90 at 10+", "ships to all 50 states", US delivery window), a US-specific block in the body (USD price
   table, US shipping line, US team gallery cards), the same-handle rule kept so hreflang stays automatic. The maker page already differs
   from EN (`maker/maker.us.json`); `design-your-own-soccer-jersey` on us is the one still mirroring www. Source lives in
   `pages/design-your-own-soccer-jersey` + the us deploy; check `docs/cms-page-gotchas.md` first.
3. **The www→us banner the owner allowed** ("Shopping from the US?", link, never a redirect; `docs/us-launch-status.md`). It does not
   change rankings, but it moves the 600+ monthly www clicks that are US buyers onto the USD store and starts us.momuto.com's own
   engagement signals. A theme paste, owner-side.
4. No geo-redirect (owner ruling stands).

Not a target: making www lose the US clicks. The www design page is the best US page we have; T1 is about the pair, not about
hurting www.

### T2 — win the soccer maker head terms outright (www, until T1 moves them)

| Query | Baseline impr / pos / CTR | 15 Jan target |
|---|---|---|
| soccer jersey maker | 1,517 / 13.7 / 5.2% | pos ≤ 7, CTR ≥ 8% |
| 3d soccer jersey designer | 694 / 13.4 / 5.9% | pos ≤ 7 |
| custom soccer jersey maker | 674 / 27.1 / 2.8% | pos ≤ 12 |
| soccer jersey creator | 557 / 10.8 / 6.3% | pos ≤ 6 |
| jersey design maker | 675 / 12.5 / 0.0% | pos ≤ 8, CTR ≥ 2% |
| cluster "soccer maker / designer / creator" (140 queries) | 561 clicks / 11,717 impr / pos 17.0 | **≥ 900 clicks per 12 months run-rate, pos ≤ 12** |

Why these are reachable: the design page already holds position 6.2 on its own query set, while these head terms average 13–27,
meaning the **homepage (pos 26) is still taking part of the impressions** for them. Actions:
1. Point every internal link that says "soccer jersey maker", "3D soccer jersey designer", "create your own soccer jersey" at
   `design-your-own-soccer-jersey` on www (homepage hero, blog "See also", FAQ, the team pages). Today the EN nav item "Jersey Maker —
   free 3D tool" goes to `custom-soccer-jersey-designer`, whose EN title says **Football** Jersey Maker: for a US searcher that page is
   the wrong lexicon, so the soccer terms fall back to the homepage. Decide one soccer maker page for the EN store (recommendation:
   keep `design-your-own-soccer-jersey` as the soccer page, since it has the rankings, and let `custom-soccer-jersey-designer` own
   the UK football terms as planned on 4 Sep).
2. Add "jersey design maker" and "soccer jersey creator" to the design page's H2/FAQ copy and meta description (they have 1,200
   impressions at page 2 and almost no clicks).
3. Keep the Product/Review JSON-LD on that page exact (36% of US clicks arrive through product snippets).

### T3 — a sport-agnostic "Jersey Maker" page (www + us, same handle)

| Metric | Baseline | 15 Jan target |
|---|---|---|
| generic cluster (jersey maker / makers / creator / designer / customizer / configurator / editor / generator, with custom/3d/ai prefixes; 35 queries) | 51 clicks / 7,323 impr / pos 27.4 / CTR 0.7% | **pos ≤ 15, ≥ 150 clicks per 12 months run-rate** |
| "jersey maker" | 1,096 impr / pos 21.1 / 2.0% | pos ≤ 10 |
| "custom jersey maker" + "custom jersey creator" | 1,685 impr / pos 33–38 / 0.5% | pos ≤ 15 |

No page on either store is titled plainly "Jersey Maker". The September handoff asked for a head-term page; the data says it should be
**sport-agnostic**: 7,300 impressions carry no sport word, and we now have two sports (soccer 3D tool, basketball 3D tool with presets since
29 Oct). Build `pages/jersey-maker` → handle `jersey-maker` on www and us (same handle, hreflang automatic): H1 "Jersey Maker", two
sport blocks each launching its 3D designer, the free/no-minimum/no-account facts, USD on us and EUR on www, FAQPage + WebApplication
JSON-LD as in `scripts/build-maker-pages.js`. Add a `STATIC_CLUSTERS` row only if the handles differ per locale (they will not).
Run `scripts/audit-3d-links.js` and commit `docs/3d-tool-links.md` in the same commit. Link it from the nav item "Jersey Maker — free 3D
tool" (EN + US), from both sport pages, and from `llms.txt` (rule 7).

### T4 — be visible for US buyer intent (custom soccer jerseys / uniforms / kits)

| Metric | Baseline | 15 Jan target |
|---|---|---|
| buyer-intent cluster (169 queries, no maker word) | 11 clicks / 3,106 impr / pos ~35 | **pos ≤ 18, ≥ 60 clicks per quarter** |
| "custom soccer jerseys" (www, US) | 128 impr / pos 45.5 / 0 clicks | pos ≤ 12 |
| "custom kits" | 301 impr / pos 31.8 | pos ≤ 15 |
| us `custom-soccer-uniforms` + `custom-soccer-jerseys` (B) | 43 impr / pos 42–62 / 0 clicks | pos ≤ 15, ≥ 20 clicks per quarter |

This is the revenue cluster and it is the weakest number in the export: the buyer vocabulary ("custom soccer jerseys", "custom soccer
uniforms", "custom kits", "customize your own soccer jersey") sits on page 3–5 while the maker vocabulary sits on page 1–2. The us pages
built for it are at positions 42–70. Actions:
1. Make `us…/pages/custom-soccer-jerseys` and `custom-soccer-uniforms` real buyer pages, not 3D-tool mirrors: USD price table at every
   tier, team gallery cards (US teams first), the Trustpilot line with the review count, a sizing/ordering flow for a coach, the deposit
   line per rule 5, Product AggregateOffer JSON-LD in USD. Titles start with the buyer phrase ("Custom Soccer Jerseys for Teams — No
   Minimum, from $25.90 | MOMUTO"), not with "Design".
2. Internal links with buyer anchors from the us homepage, the basketball page, the team pages, the FAQ and the blog posts
   (`custom-soccer-uniforms-club-team`, `custom-soccer-jerseys-adult-rec-league`, both at positions 6–16 with no links worth the name).
3. The **supplier / wholesale page** from `seo-opportunities-2026-09.md` backlog #1 (US: "soccer uniform supplier", "wholesale soccer
   uniforms") is part of this cluster. Clone the FR structure for us and www.
4. "custom soccer jerseys no minimum" is already at position 5.6 on 39 impressions: "no minimum" belongs in the titles.

### T5 — basketball

| Metric | Baseline | 15 Jan target |
|---|---|---|
| basketball queries, US (A, 15 queries + B, 43 queries) | 0 clicks / 125 + 176 impr / pos 67 | **pos ≤ 25, ≥ 15 clicks per quarter** |
| `us…/pages/custom-basketball-jerseys` (B) | 13 clicks / 237 impr / pos 53.1 | pos ≤ 25, ≥ 30 clicks per quarter |

The page already gets 13 clicks at position 53, which says the intent is there and the page is thin on authority. Actions: a www twin of
`custom-basketball-jerseys` (same handle, pairs automatically; the handoff's backlog #5), "Basketball Jersey Maker" as an H2 and in the
meta title variant (the top queries are "basketball jersey maker" / "custom basketball jersey maker", not "custom basketball jerseys"),
links from the T3 page and the US nav, one editorial post per the `docs/editorial-strategy.md` rules (the existing
`show-team-spirit-with-momuto-custom-basket…` post is at position 5 on 15 impressions and should link to the page), and `llms.txt`.

### T6 — desktop position gap (carried over from July, now quantified)

Desktop position 22.0 vs mobile 13.8 on comparable volume (46k vs 29k impressions). Target: desktop within 5 positions of mobile by
15 Jan. Owner-side check first: PageSpeed Insights on the www homepage and the design page, desktop profile; report LCP/CLS here. If
the desktop templates are fine, the gap is SERP composition (desktop shows more competitors for the same query) and the target is
dropped. Do not spend engineering time before the check.

## Decisions for the owner

1. **"Custom football jersey" in the US (21,223 impressions, 52 clicks, position 18.8).** This is American football; we rank page 1–2 for
   it because the www homepage title says "Custom Football Jersey Maker". It drags the homepage CTR to 1.5% and is the single biggest
   line in the export. Options: (a) leave it, since the same title serves the UK ("football" = soccer there) and the clicks cost nothing;
   (b) add "Soccer" to the www homepage title so the US SERP reads soccer and the UK SERP still reads football; (c) let T1 finish and
   accept that the us homepage will never get these queries. Recommendation: **(b)**, one title change, measured on the 15 Dec read
   (homepage CTR in the US should rise, UK clicks should not fall; the UK needs its own export, country = United Kingdom).
2. **Nav target of "Jersey Maker — free 3D tool".** Keep pointing at the soccer maker page, or point at the new sport-agnostic T3 page
   once it exists. Recommendation: T3 page, both stores.
3. **The www→us banner.** Allowed in principle (`docs/us-launch-status.md`); never pasted. Yes or no for November.

## Not targets (deliberately)

- The Zidane/Maradona post (550 impressions, position 6.9, 1 click) and the fabric post (307 at 7.5): fan and student traffic, no buyer
  value; leave them.
- French queries from the US ("maillot de foot personnalisé", ~180 impressions at position 40): diaspora noise.
- Club-name queries ("custom man united jersey"): rule 4, never a target.

## Measurement lever (do this first, it costs one afternoon)

Every target above was read from a manual export because `metrics/weekly.json` has no page or country rows. Add two collectors to
`scripts/weekly-scorecard.js` before the next read: `dimensions: ['page']` filtered to the US country for the handles named in T1–T5,
and `dimensions: ['query']` for the ~20 head terms listed here, both stored per ISO week. The 15 Dec and 15 Jan reads then become a
diff of `weekly.json`, and the scorecard can flag a target that slips without anyone pulling a sheet.

---

## Addendum, 3 Nov 2026 (later the same day): what the live API reads changed

The `GSC report` workflow (merged in #358) and the `Probe page head` workflow (#359, #360) ran the same day. Eight Search Console reads
(runs 41614343769, 41614347964, 41614351760, 41614355955, 41614360335, 41614365127, 41614369208, 41614372984, 41614490573, 41614907906,
41614912697; all green, logs in the Actions tab) and one live `<head>` probe (run 41614901270) replace the inferences above. Window for
the reads: **4–31 Oct 2026, country = US**, unless stated.

### Caveat first: page-level rows undercount by ~40%

Daily series for 4–31 Oct: **841 clicks, 15,009 impressions**. The same window grouped by page: 510 clicks, 12,699 impressions. The
difference is Search Console's privacy filtering of long-tail URLs when a page dimension is present (the query dimension drops anonymised
queries the same way, and a query×page read filtered on one page returned only 12 rows for the homepage). **Compare page or query rows with
each other, never with the host totals**, and keep the scorecard's host totals as the number of record.

### T2 is mostly done already: the design page owns the soccer maker terms at position ~3

The 12-month averages in the table above (13.7 for "soccer jersey maker") mixed in the spring, when the page ranked on page 2. Last 28 days,
query × page, all on `www…/pages/design-your-own-soccer-jersey`:

| Query | Clicks | Impr | CTR | Position |
|---|---:|---:|---:|---:|
| soccer jersey maker | 40 | 444 | 9.0% | 2.7 |
| soccer jersey designer | 25 | 256 | 9.8% | 3.3 |
| make your own soccer jersey | 20 | 231 | 8.7% | 2.9 |
| soccer jersey creator | 23 | 181 | 12.7% | 2.9 |
| custom soccer jersey maker | 12 | 176 | 6.8% | 3.2 |
| create your own soccer jersey online free | 23 | 128 | 18.0% | 1.1 |
| 3d soccer jersey designer | 6 | 83 | 7.2% | 2.2 |

The homepage still shows for the same queries as a second listing at 28–42 with 0 clicks (e.g. "soccer jersey maker" 37 impr at 42.4);
that second listing is what dragged the 12-month query averages down, not a ranking problem. **Revised T2:** hold the design page at ≤ 3.5 on
the seven queries above and lift the top-3 rows with weak CTR: "design your own soccer jersey" (104 impr, pos 3.7, **1.9%**), "how to make your
own soccer jersey" (39, 4.4, 0%), "custom soccer jersey design" (37, 3.0, 0%), "create custom soccer jerseys" (35, 6.3, 0%), "custom soccer jersey
creator" (34, 5.6, 0%). These are snippet problems at a good position: the meta description leads with "Free 3D soccer jersey maker" and says
nothing about *design your own* or *custom* in the first 90 characters. One description rewrite, measured on 15 Dec. The internal-link work in
T2 action 1 still applies to the EN nav target (see Decision 2), but it is no longer the lever for the head terms.

### T3 confirmed: the generic "jersey maker" cluster lands on the homepage, page 2–4, 0 clicks

Query × page for queries containing "jersey maker", last 28 days: the homepage takes **custom football jersey maker** (159 impr, 9.2, 0 clicks),
**jersey maker** (148, 13.3, 1), **jersey makers** (123, 32.7, 0), **custom jersey maker** (95, 33.6, 0), **football jersey maker** (73, 20.1, 3),
jersey maker online (23, 17.3, 0). A separate read shows **jersey designer** on the homepage too (171 impr, 12.3, 2 clicks). The design page
gets "jersey maker" at 13.0 on only 10 impressions: Google does not see it as the answer to the sport-less query. The sport-agnostic page
in T3 is the right build; its first internal links should come from the homepage and from the design page.

### T1 revised: the us twins ARE indexed as separate pages, and differentiation alone has not moved them

The probe (run 41614901270) read the live `<head>` of the paired pages:

| Page | www title | us title | Canonical | Sitemap hreflang |
|---|---|---|---|---|
| design-your-own-soccer-jersey | Soccer Jersey Maker — Create Your Own Soccer Jersey Online Free | **identical** (title, description, H1) | each self | en ↔ en-US reciprocal, x-default → www |
| custom-soccer-jersey-designer | Football Jersey Maker: Free 3D Kit Designer… €21.90 | Soccer Jersey Maker: Free 3D Designer… $25.90 (**different since 4 Sep**) | each self | reciprocal (+ fr-FR) |
| custom-soccer-jerseys | Custom Soccer Jerseys & Uniforms — No Minimum | identical title + H1; description differs | each self | reciprocal (+ es-ES, fr-FR) |
| custom-soccer-uniforms (us only) | — | Custom Soccer Uniforms for Teams — Free 3D Designer | self | no alternates (no twin; expected) |
| custom-basketball-jerseys (us only) | — | Custom Basketball Jerseys — Design in 3D, No Minimum | self | no alternates (no twin; expected) |

(Both homepages answer the runner with the Cloudflare challenge even in Chromium, so their live titles were not read; the sitemaps were.)
No `noindex`, no cross-host canonical, hreflang reciprocal in both sitemaps (421 www URLs, 444 us URLs). Search Console, last 28 days,
US country: `us…/custom-soccer-jersey-designer` 235 impressions at **58.8** (0 clicks) while `www…/custom-soccer-jersey-designer` sits at **6.1**
(184 impr, 3 clicks); the us page is reached by "jersey creator" (51 impr, 69.7), "custom soccer jersey creator" (23, 67.3), "jersey maker" (19, 69.4),
"soccer uniform generator" (16, 41.7). Previous 28 days it had 52 impressions at 75.0, so it is rising, slowly. All us pages together: 0 clicks on
459 impressions at 51.5.

What this rules out: a duplicate-canonical fold (both URLs are indexed and shown), a robots/noindex mistake, and a missing hreflang row.
What it leaves: Google has not *applied* the en ↔ en-US swap yet. The maker twin has been visibly different for eight weeks and still ranks
on page 6 on its own, so **differentiating the design-your-own twin (T1 action 2) is necessary but will not by itself move anything in
weeks**. The owner check that settles the remaining question is still a 10-minute one, now narrower:
1. Search Console → us.momuto.com property → **Pages**: how many of the 444 sitemap URLs are indexed, and what the top "not indexed" reason is
   (expected: *Crawled – currently not indexed* or *Discovered – currently not indexed* for most pages).
2. Same property → **Sitemaps**: is `https://us.momuto.com/sitemap.xml` submitted and read without errors? If it was never submitted there,
   submit it; the domain property reading it is not the same as the us URL-prefix property reading it.
3. **URL inspection** on `https://us.momuto.com/pages/custom-soccer-jersey-designer`: crawl date and "Google-selected canonical".

Revised T1 metrics (unchanged dates): us.momuto.com clicks per 28 d from **0 (page rows) / 17 (property)** to ≥ 60 by 15 Jan (was 120: the
property is nine weeks old and the pages have no links); `us…/custom-soccer-jersey-designer` from 58.8 to ≤ 20. The banner (action 3) moves
from "nice to have" to **the only lever that puts US buyers on the USD store this quarter**, since search will not do it before January.

### T4: a rule-5 drift on the live us page, and a page that ranks at 16 with no clicks

- **Live us meta description for `custom-soccer-jerseys` says "Free pro design in 1–2 days"** (a bare free-design claim with no "for teams"
  and no deposit line; rule 5). The www twin says "Free design for teams." The us copy was cloned at launch and no repo script deploys that
  handle for us (`deploy-soccer-hub-page.js` is EN only), so the drift lives in the CMS only; `cms/pages/us/custom-soccer-jerseys.json` holds
  the same text. Fix: edit `meta_descript` in that file and deploy with Deploy CMS Page (dry run first); add the us page to the copy-rules
  check's live surfaces.
- `www…/pages/custom-soccer-jerseys` has 150 impressions at 15.9 and 0 clicks in 28 days (77 at 15.0 the month before). "custom soccer jerseys
  no minimum" lands on it at 3.6 with 0 clicks on 26 impressions. The buyer vocabulary in the US is small in volume this month ("custom soccer
  jerseys" 13 impr on this page at 23.2, plus 7 on the best-makers page at 3.0), so the T4 quarterly click target stays at 60 but the measure
  that matters first is this page's position: **15.9 → ≤ 8** by 15 Jan.

### T5 confirmed, smaller than the 12-month view suggested

Basketball, last 28 days, US: 53 impressions, 0 clicks, every row on `us…/custom-basketball-jerseys` at 56–82 (previous 28 days: 82 impr at 67).
The "13 clicks" in export B came from earlier weeks and anonymised queries. The page is indexed and is the only basketball URL we have; the
www twin + links + "basketball jersey maker" wording remain the plan; expectations for 15 Jan: ≤ 30, ≥ 10 clicks per quarter.

### T6 narrowed: the desktop gap is the homepage, not the templates

Device × page, last 28 days: design page desktop 3.6 / mobile 4.0 (no gap); **homepage desktop 19.2 / mobile 14.1** (2,441 vs 2,549 impr;
3.3% vs 5.8% CTR). The homepage's desktop SERP is the American-football one (see Decision 1); the maker page shows desktop 11.8 vs mobile 3.7 on
small numbers. Drop the Core Web Vitals check; T6 folds into Decision 1.

### Decision 1, with UK numbers

UK, last 28 days, all queries ≥ 15 impressions: **877 impressions, 11 clicks**, of which 5 are brand and 4 land on the design page or the AI
post. The www homepage takes "custom design football jersey" (79 impr, 24.0), "custom jersey maker" (71, 23.9), "custom football jersey design"
(63, 16.9), "jersey maker" (73, 7.1, 1 click) and sixteen more football-worded queries at 8–45, **0 clicks on all of them**. Adding "Soccer" to the
www homepage title puts at risk roughly nothing in the UK this month and addresses 21k US impressions a year on a 0.2% CTR. Recommendation
unchanged: (b), and measure both countries on 15 Dec with `GSC report` (`dimensions=query,page country=gbr` and `country=usa page=www.momuto.com/`).

### How to re-read (replaces the manual exports)

```
GSC report  dimensions=page        country=usa                                   → host split, us share (compare rows with rows)
GSC report  dimensions=query,page  country=usa  query=jersey maker               → T3 (homepage vs the new page)
GSC report  dimensions=query,page  country=usa  query=soccer jersey  min=20      → T2 (design page positions and CTR)
GSC report  dimensions=query,page  country=usa  page=us.momuto.com               → T1 (what the us store ranks for)
GSC report  dimensions=query,page  country=usa  query=basketball                 → T5
GSC report  dimensions=query,page  country=gbr  min=15                           → Decision 1, UK side
Probe page head  (the ten URLs above)                                            → titles/canonicals after any change
```

---

## Shipped 3 Nov 2026 (evening) — what moved from targets to live

Dry runs (all green, from the branch): Deploy CMS Page 41616549543 (4 files: 2 new `jersey-maker` pages, 2 us twins), Store Config apply-seo en
41616554786, apply-nav en 41616559585, apply-nav us 41616565089, Deploy Design-Your-Own 41616570503. Live runs and read-backs are listed
below this line as they happen.

- **T3**: `jersey-maker` hub on www + us (`maker/maker.jm-{en,us}.json` → `build-maker-pages.js` → `cms/pages/{en,us}/jersey-maker.json`).
  Same handle on both stores, so the nightly sitemap pairs them. Linked from both llms.txt files; nav item "Jersey Maker — free 3D tool" on
  EN and US now points at it (Decision 2).
- **Decision 1 (b)**: www homepage SEO plan → "Custom Football & Soccer Jersey Maker — Free 3D Designer | MOMUTO" + a numbers description;
  keywords keep the live ones and add the maker terms (`HOMEPAGE_SEO.en`, apply-seo).
- **T2**: www design page meta description leads with "Design your own soccer jersey … custom colors, crest, names and numbers".
- **T1 action 2**: us `design-your-own-soccer-jersey` title/description differ from www (USD, "MOMUTO USA", US delivery).
- **T4**: us `custom-soccer-jerseys` title "…for US Teams — No Minimum", description without the bare "Free pro design" claim;
  `check-copy-rules` now catches "free pro design".
- Not shipped: the www→us banner (owner paste, Decision 3); the us design-your-own **body** is still the www body (meta only).

**Live, 3 Nov 2026 (run ids = the proof):**
- Deploy CMS Page 41616830283 (push to main): `jersey-maker` created on www and us; us `design-your-own-soccer-jersey` and
  `custom-soccer-jerseys` updated. Deploy Design-Your-Own 41616830339: www design page updated, IndexNow 200. Deploy Static Files
  41616830299: llms.txt on all stores.
- Store Config apply-seo en 41616853958 (homepage plan written), read back by apply-seo dry run 41617018514 ("Current" = new values).
  apply-nav en 41616859259 / us 41616864263, read back by inspect-nav 41617009543 / 41617014160: both "Jersey Maker — free 3D tool"
  items point at `/pages/jersey-maker`; the POST upsert gave the menus new ids (en Header Menu 841796, us 841794; the theme binds by name).
- Rebuild Sitemap 41616961955: 1,335 URLs clustered; both hub URLs listed with en ↔ en-US alternates (probe 41617219868).
- Probe page head 41616957177 + 41617219868: live titles, descriptions and self-canonicals of the five changed pages match the repo.
- Pull CMS Content 41617023526 (en) and the us pull: `cms/pages/{en,us}/jersey-maker.json` now carry their ids.
- IndexNow 41617028876: the three www URLs accepted (the us host has no IndexNow key; Bing finds it through the sitemap).

**Found on the way (theme, not fixed):** the storefront renders the CMS `title` as an `<h1>` above every page fragment, so each
page carries two H1s in the DOM (the title-hide CSS only hides it visually). Every probed page shows it. Theme-owned; if it matters,
it is one rule in the theme, not per page.

**Re-read for these changes:** 15 Dec — homepage CTR in the US and UK (Decision 1), "jersey maker" cluster by page (T3: the hub should
appear), the five low-CTR design-page queries (T2), us twins' positions (T1).

**Decision 3 + the second H1 (3 Nov, evening):** built as one www script-manager entry, `docs/www-us-banner/www-us-banner-entry.html`
(README there): the US banner (link to us.momuto.com for en-US browsers in US time zones, dismiss 30 days) and the demotion of the
theme-printed `h1.title` to a `div` on every page and post. Owner pastes it once on www; not live from the repo. Theme fork not needed.
