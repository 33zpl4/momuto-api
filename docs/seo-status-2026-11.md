# SEO status — handoff, 3 Nov 2026

Written for a new agent picking this up cold. Read the **Caveats** first. **Targets with baselines: `docs/seo-targets-2026-11.md` (3 Nov, from the US page/query exports).** Companion docs: `docs/seo-opportunities-2026-09.md` (ranked backlog),
`docs/search-position-2026-08.md` + `docs/search-analysis-2026-07.md` + `docs/search-analysis-2026-09-us.md` (query-level analyses),
`docs/scorecard.md` (the weekly loop), `docs/it-site-recovery.md` (Italy runbook), `docs/editorial-strategy.md`.

## Verdict in one paragraph

Real progress since spring, led by **www** and **ES**. Over the last month growth thinned: clicks +6% over the previous four weeks (impressions +14%),
CTR is falling while average position keeps improving, **FR is drifting down**, **us.momuto.com is not being picked up by Google**, and **Italy has not
moved at all**. Search is no longer the fastest-growing part of the business: orders grew faster than clicks (the cart, checkout, abandoned-cart email
and price calculator are doing the work). SEO is the lever that has been coasting.

## Data source and how it was read

`metrics/weekly.json` (history in git; written every Thursday by **Weekly scorecard**, `scripts/weekly-scorecard.js`). 54 complete weeks per host,
2025-W25 .. 2026-W43 (W44 is partial and deliberately not stored). Keys per week: `gsc.<host>` = clicks, impressions, ctr, position for
`all | www | es | fr | it | us | design`, plus `orders`, `leads`, `events`, `checkoutHandoff`. `_topQueries` holds only the **top 12 queries of the
latest week**. Analysis below uses 4-week blocks (single weeks mislead). Latest week = ISO week ending 26 Oct 2026.

## Headline numbers (4-week blocks)

| Block | Clicks | Impressions | CTR | Avg position |
|---|---:|---:|---:|---:|
| W16–19 (Apr/May) | 1,573 | 24,877 | 6.3% | 15.6 |
| W28–31 | 2,629 | 75,328 | 3.5% | 11.9 |
| W32–35 (Aug peak) | 3,434 | 63,707 | 5.4% | 11.2 |
| W36–39 (Sep) | 3,740 | 68,304 | 5.5% | 10.0 |
| **W40–43 (last four)** | **3,949** | **77,823** | **5.1%** | **9.1** |

Clicks are 2.5x April/May and +15% on the August peak (season calendar calls Sep21–Oct31 "normal, lower than August"). Brand ("momuto") is 32% of
latest-week clicks (341 of 1,050), down from ~40% in August: non-brand is growing.

## Per store (last four weeks vs previous four)

| Store | Clicks | vs prev 4 | vs Aug peak | Impressions | Position | Read |
|---|---:|---:|---:|---:|---:|---|
| www | 2,792 | +8% | +12% | 67,768 | 7.9 | The engine: ~3/4 of clicks, best position, still growing |
| es | 723 | −1% | +28% | 15,875 | 8.0 | Success of the year (clicks x3 since July; 19 ES orders vs 7). Clicks flat this month, CTR 5.2% → 4.6% |
| fr | 466 | −6% | +4% | 8,969 | 10.2 | **Only mature store going backwards** (−19% vs Apr/May; impressions −13%) |
| us | 16 | −6% | new | 1,045 | 29.8 | Impressions nearly doubled but position worsened 22 → 30; clicks flat. US clicks land on www |
| it | 5 | — | — | 283 | 7.6 | ~79 impressions/week, 0 clicks most weeks; the store has never had an order |

Top non-brand queries (latest week): soccer jersey maker (20 clk, 163 impr, pos 8.5, CTR 12%) · design jersey online free (15, pos 4.7) ·
jersey design maker (13, 300 impr, 4.3%) · **jersey maker (8 clk on 428 impr, pos 9, 1.9%)** · soccer jersey designer (8, pos 3.6) ·
custom football jersey (7, 182 impr, 3.8%) · football jersey maker (7, 181 impr, 3.9%). Queries with a real answer page convert well:
"make your own soccer jersey for fun" 30%, "make a soccer jersey" 21%, "crear camiseta de futbol" 15%.

## Search vs business (same blocks)

| Block | Orders | Revenue EUR | Revenue USD |
|---|---:|---:|---:|
| W32–35 | 40 | 5,943 | 3,148 |
| W36–39 | 47 | 6,948 | 3,813 |
| W40–43 | 62 | 11,340 | 4,456 |

Orders +32% then +55% while clicks grew +6% then +15%. 3D designer sessions: ~3,900 opened in W40–43 (funnel counters only exist from W42).

## Findings, ranked by value

1. **CTR bleed on head terms is still open.** "jersey maker", "jersey design maker", "custom football jersey" rank 6–9 and convert 2–4%. The August plan
   (`search-position-2026-08.md` Finding 1) said a dedicated page that *is* a jersey maker must outrank the homepage for these terms; the data says the
   homepage still takes them.
2. **FR decline.** The July analysis argued losing the FR "concept" cluster was fine (fan-art audience, not buyers). That argument has run its course.
   Unknown from this data: whether the FR comparison page (`comparatif-fournisseur-maillot-foot-2026`, best non-home page in July, pos ~6–7) is holding.
3. **US store not indexed as the US destination.** The Sept plan said wait 4–8 weeks for hreflang to steer Google and "re-read ~16 Oct". That re-read never
   happened; seven weeks in, us.momuto.com pages sit around position 30. hreflang is built nightly (`scripts/rebuild-sitemap.js`, runs green daily).
   Owner ruling: **no geo-redirect www→us** (hreflang steers, a banner at most).
4. **ES internal-link items from the 14 Aug addendum were never done:** more links to the Zentral/roundup page, ES nav link to the Ready to Play wall
   (`coleccion-ready-to-play`), Madrid city page "marcaje de equipaciones" section (`cms/city-pages/es/cities.json`).
5. **Italy.** `docs/it-site-recovery.md` steps 1 (unpublish 39 foreign/duplicate posts, workflow Unpublish Posts, dry run first) and 4 (Audit & Translate
   Italian Pages, dry run first, watch handles with impressions) are still "needs a run". Separately, the Italian **Ready to Play wall is broken**: 6 of 7
   cards link to the old `/pages/ready-to-play-the-<slug>` request-form pages and THE FRACTURE links to a product that does not exist on the IT store
   (read-only check 30 Oct: none of the 14 RTP products exist on IT; EN has all 14). Fix needs products created on IT, ids added to
   `GoodInfoAction::RTP_OEM_PRODUCTS` (design-momuto server patch), cards repointed last. Waiting on the owner: which IT checkout wiring steps
   (README "IT store wiring" 2–8) are done. Do not point cards at `/products/` before the products exist.
6. **Basketball** was at absolute zero in July. A basketball picker/preset fix shipped 29 Oct; no search work has been done.

## Caveats (read before trusting any number)

- The sandbox cannot reach momuto.com, GSC or the platform. All live reads run on GitHub Actions runners. Never claim a deploy worked without a green run.
- `weekly.json` has **no page-level or country-level rows**. Questions like "did impressions move from www to us on paired pages?" or "did the design page take
  the 'soccer jersey maker' cluster from the homepage?" cannot be answered without a manual GSC export. **Recommended build:** add `page` and `country`
  dimensions to `collectGsc` in `scripts/weekly-scorecard.js` (the biggest lever for the next analysis).
- No year-over-year yet: the 2025 history has a gap W38 2025 .. W02 2026, so the "same week last year" column stays empty until mid-January.
- Publishing rule (owner, 6 Aug): in editorial, tell the **trajectory**, not raw traffic counts. Operational facts (7–12 d production, 25–30 d door to door, prices)
  must stay exact. Facts live in `CLAUDE.md` rule 6 and `static/shared/llms.txt` (update both together).
- Seasonality calendar is in `metrics/season.json` (Nov 1–Dec 15 expected "low"). Do not flag a drop that the season explains; the scorecard flags only a
  >25% drop sustained for 3 weeks.

## Suggested next actions (in order)

1. Add page + country dimensions to the scorecard collector (so the next read can answer the US/homepage questions).
2. Head-term page for "jersey maker" / "jersey design maker" on www (title/H1/internal links), then re-read after 4 weeks.
3. FR: pull a GSC export for fr.momuto.com pages, check the comparison page and the supplier cluster ("fournisseur/grossiste maillot de foot", 6.8% CTR in July).
4. ES: the three unfinished internal-link items above.
5. Italy: run the two runbook steps; fix the RTP wall once the products exist.
6. US: re-read with country=US export; if www still takes US clicks at page 18–30, consider a banner and more `us` twins of the top www pages.

## Shipped since the last SEO doc (for context, all merged)

hreflang for 16 page groups + 17 blog groups (25 Sep); free-design wording sweep and FAQ/returns/shipping rewrites in 5 stores (29 Oct: cancellation line,
delivery clock); Trustpilot and fabric (92% polyester / 8% elastane) facts across pages and `llms.txt`; fabric, colour-guide and AI-hub posts; team photo wall
now 21 teams; the 3D designer's mark picker and basketball presets. None has measurable search impact yet.
