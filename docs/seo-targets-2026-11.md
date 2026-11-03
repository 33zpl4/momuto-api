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
