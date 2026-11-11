# US indexing — what Google actually says (11 Nov 2026)

Question from `docs/seo-status-2026-11.md` §3: "us.momuto.com is not being picked up by Google; seven weeks after hreflang it sits around position 30."
Answered with Google's own data: GSC `searchAnalytics` (28 days to 8 Nov) and the **URL Inspection API**, plus the live HTML read with a browser.
Tools (read only, any branch): **GSC report** (`gsc-report.yml`) and **Probe US indexing** (`scripts/probe-us-index.js`, `probe-us-index.yml`).

## Verdict: it is a ranking problem, not an indexing problem

| Check | Result |
|---|---|
| Are the us pages indexed? | **Yes.** 9 of 9 pairs inspected: "Submitted and indexed", indexing allowed, fetch successful, self-canonical (Google's canonical = ours), last crawled 23 Oct – 11 Nov. |
| Does the HTML or robots block them? | No. Same robots.txt as www, no robots meta, canonical declared = own URL. |
| Is hreflang present and consistent? | **Yes, in both sitemaps** (`www` 1,704 alternates, `us` 1,669): `en` → www, `en-US` → us, `x-default` → www, identical on both sides, home and `/pages/*` pairs. There are no hreflang tags in the HTML (not needed; sitemap is valid). |
| Are the pairs near-duplicates? | **Yes: 76–95 % identical text** (5-word shingles): home 86 %, design-your-own 85 %, jersey-maker 84 %, ready-to-play 83 %, gallery 90 %, request 76 %, best-makers 95 %. |
| Who gets the US searchers? | **www.** 462 clicks / 11,920 impressions from the US in 28 days: 237 www home + 206 `www/pages/design-your-own-soccer-jersey` (position 3.5). `us.momuto.com` pages: **18 clicks** in total, 1,735 impressions, position 22 (the pages that matter sit at 45–65). |
| Do US buyers still buy? | Yes: USD revenue per week W43 $2.2k, W44 $1.9k, W45 $1.7k (`metrics/weekly.json`). They reach `us` by the banner/direct/other routes, not by search. |

**Why hreflang does not swap them:** it is a hint, applied only when both URLs are equally eligible. Two English pages that are 85 % the same and
differ only by `en` vs `en-US` get clustered; Google then shows the stronger one (www, years of links) and the weaker (`us`, a young subdomain)
stays at ~50. More waiting will not change that, so the Sept plan's "wait 4–8 weeks" is closed: **it did not work and will not.**

Brand query is clean: for `momuto`, US searchers click 53 % at position 1.0. The US demand is soccer-lexicon head terms
("soccer jersey maker" 407 impressions, "soccer jersey designer", "create your own soccer jersey online free"): www already ranks 3–7 on them.

## A real defect found on the way

`www/pages/design-your-own-soccer-jersey` (the page with 206 US clicks) is reported by Google as **"Duplicate, Google chose different canonical than user"**:
Google's canonical for it is `https://www.momuto.com/pages/ready-to-play-thank-you`, a conversion page ("Request received") that is itself
indexed and was listed in the sitemap. Cause is not visible from outside (the two have different titles/H1s); the page still ranks and gets clicks, but this is
how a top page gets dropped. Done: **conversion-only pages are no longer written to the sitemap** (`CONVERSION_ONLY` in `scripts/rebuild-sitemap.js`;
dry run 43060640285 skipped `ready-to-play-thank-you` (www, us), `customized-design-confirmed` (www, us), `custom-kit-design-studio-paid-true` (www, us),
`design-personnalise-confirme` (fr), `design-personalizzato-confermato` (it)). **Not done (needs the CMS):** `ready-to-play-thank-you` is a live-only page
(not in `cms/pages`); it should carry `<meta name="robots" content="noindex">`. Re-inspect `design-your-own-soccer-jersey` with the probe after the next nightly rebuild:
the verdict should return to "Submitted and indexed" with its own canonical. If it does not, the page content, not the thank-you page, is the next suspect.

## The canonical defect became a traffic collapse (found 11 Nov, same day)

Daily GSC for `www/pages/design-your-own-soccer-jersey`: **~35–55 clicks and ~600 impressions a day until 1 Nov, then 214 impressions on 2 Nov, 33 on 3 Nov, ~10 a day since: 0 clicks from 6 Nov.**
That is the site's best non-brand page (876 clicks 10 Oct – 8 Nov). From 2 Nov `www/pages/ready-to-play-thank-you` started receiving impressions for the same
queries ("create soccer jersey", "custom soccer jersey creator", "soccer jersey maker") at positions 20–70, and gets no clicks. Google folded the real page into the thank-you page.
Site-wide Search Console is −13 % clicks week on week (www −16 %), which is this page plus its US share.

The **Canonical watch** (new, daily, `scripts/canonical-watch.js`) inspected 24 key URLs on 11 Nov. Findings:

| URL | Google says |
|---|---|
| `www/pages/design-your-own-soccer-jersey` | duplicate; Google chose `ready-to-play-thank-you` (crawled 6 Nov) |
| `www/pages/ai-concept-to-real-kit` — **the concept-to-real hub** | same: duplicate, Google chose `ready-to-play-thank-you` (crawled 6 Nov) |
| `es/pages/equipaciones-futbol-personalizadas` — the ES category hub | "Crawled - currently not indexed", last crawl 23 Aug |
| `it/pages/prezzi-maglie-calcio-personalizzate` — the IT price page | "Discovered - currently not indexed", never crawled |
| the other 20 | indexed, own canonical |

**Ruled out** (probes `probe-main-content`, `probe-html-weight`): the three pages' main text is 0 % similar; the raw HTML is ~650 KB against Googlebot's 2 MB limit;
no redirect or canonical script in the head (the inline `targetUrl` blocks are legacy brief-form scripts). The page is served 200 with its own canonical.
**Not known:** what made Google treat them as duplicates (it judges rendered content we cannot see; my guess is a crawl on 1–6 Nov that rendered without the page body). So the fix removes the wrong candidate and asks Google to re-decide.

### Fix applied
1. Conversion-only pages are out of the sitemap (nightly rebuild also run live on 11 Nov).
2. **`noindex` on the live thank-you / paid-gate pages that had none** (`scripts/noindex-pages.js`, workflow *Noindex conversion-only pages*, dry run first, read-back):
   `ready-to-play-thank-you` (www, us), `custom-kit-design-studio-paid-true` (www, us), `design-personalizzato-confermato` (it). The other confirmation pages already answered noindex.
3. Daily **Canonical watch** so this cannot go unseen again: a red run names the URL and the canonical Google picked.

### Owner action (cannot be done through the API)
In Search Console → URL Inspection, for **each** of `https://www.momuto.com/pages/design-your-own-soccer-jersey` and `https://www.momuto.com/pages/ai-concept-to-real-kit`:
**Request indexing** (after the noindex is live). Expect days, not hours. Also request indexing for the ES hub and the IT price page (never indexed).
The Canonical watch goes green when Google has re-decided; the daily clicks of the page (GSC report, `dimensions=date`) should climb back towards 35–55.

## Options for the `us` store (owner decision — nothing here is changed yet)

1. **Keep `us` as the checkout destination, stop expecting it to rank.** www already wins the US searches; the lever is moving www visitors to USD prices
   (the hero/banner line "Ordering from the US? See US prices in USD"). Cheapest; what the data supports today. Cost: `us` pages stay out of search.
2. **Make the top three us twins genuinely different** (USD ladder, US shipping window, US teams and leagues, US spelling) so they are not 85 % duplicates:
   `design-your-own-soccer-jersey`, `custom-soccer-jersey-designer`, `jersey-maker`. Then re-read with `dimensions=page country=usa` after 4 weeks.
   Real effort per page; needs facts we have (`docs/us-launch-status.md` ladder), not invented US claims.
3. **Drop the en-US hreflang pairs** so www is the only English result for US users. Risky and reversible only slowly; not recommended while option 1 works.

Recommendation: **1 now, 2 as a one-page experiment** (the designer page), measured with the same GSC export.
Owner ruling stands: **no geo-redirect www → us.**

## How to re-run
```
gh workflow run "GSC report" -f dimensions=page -f country=usa -f row_limit=120 -f min_impressions=5
gh workflow run "Probe US indexing (www vs us)"      # after the file is on main; on a branch it runs on push
```
