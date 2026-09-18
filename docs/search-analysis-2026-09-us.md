# Search analysis — US, 18 September 2026

Source: GSC export for the `momuto.com` domain property, filter Country =
United States, Web, last 28 days (19 Aug – 15 Sep 2026). Updates the US
section of `docs/search-analysis-2026-07.md`.

## Headline

| | 28 Jul report | 18 Sep report |
|---|---|---|
| US clicks / 28 d | 128 | **462** |
| US impressions / 28 d | 7,540 | 11,673 |
| CTR / position | — | 4.0% / 13.6 |

Second fortnight vs first inside the window: clicks +60%, impressions +33%.

## What the numbers say

- **Two www pages carry everything**: homepage (120 clicks, 6,283 impr, pos
  18.3, CTR 1.9%) and `design-your-own-soccer-jersey` (111 clicks, 2,004
  impr, pos 7.8). All 11 `us.momuto.com` pages: 0 clicks on 163 impressions,
  positions 60–76 on the money pages. Expected for a store that is weeks old
  — Google still treats it as the duplicate. hreflang is the steering
  mechanism (owner ruling: no redirect) and it IS in place: the sitemap
  same-handle rule pairs every en↔us twin (18 Sep rebuild: 257/278 www URLs
  and 253/288 us URLs carry hreflang). Nothing to add; wait 4–8 weeks.
- **Maker intent, not buyer intent**: 345/739 queries contain 3D / designer /
  maker; "free" + "for fun" queries = 57 clicks. Top non-brand winner:
  "create your own soccer jersey online free" (33 clicks, pos 3.6, 17% CTR).
  Do not judge US conversion on this traffic.
- **Page-two reserve**: "soccer jersey maker" 458 impr @ 12.9, "custom
  football jersey maker" 225 @ 9.6, "jersey design maker" 178, "jersey
  designer" 167, "jersey creator" 161 — 0–1 clicks each, mostly landing on the
  homepage. Action taken 18 Sep: design page (www + us twin) retitled
  "Soccer Jersey Maker — Create Your Own Soccer Jersey Online Free"; H1 kept.
- **"custom football jersey" = American football** (724 impr, 1 click). The
  www homepage title "Custom Football Jersey Maker" is what draws it; left as
  is on purpose — www is the international/UK default, us.momuto.com carries
  the soccer lexicon, hreflang sorts the searcher.
- **Product snippets**: 207/462 clicks at 6.4% CTR — JSON-LD prices/ratings
  must stay exact (updated 14 Sep: 4.5/5 on 44 reviews, new ladder).
- **Brand** = 38% of attributed clicks ("momuto" 91). Basketball: 26 queries,
  70 impr, 0 clicks, pos 66 — revisit when the 3D basketball model ships.
- Desktop 258 clicks vs mobile 188; mobile CTR lower.

## Found on the way

A dead Vercel preview script (`…vercel.app/configurator/embed.js`, 404) was
loaded on every www page via a store script-manager entry (the www copy of
the US entry 4418914 found 13 Sep). Deleted by the owner 18 Sep; the RTP
loader fetches embed.js itself, so nothing replaces it.

## Re-read ~16 October

Look for: impressions moving from www to us.momuto.com on paired pages; the
design page taking the "soccer jersey maker" cluster from the homepage;
homepage CTR at pos ~18.
