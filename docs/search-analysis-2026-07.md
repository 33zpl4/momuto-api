# Search analysis — 28 July 2026

Source: two GSC exports for the `momuto.com` **domain property** (all
subdomains): a last-3-months snapshot and a last-28-days snapshot with
period-over-period columns. This document updates
`docs/search-strategy-2026h2.md` (written 15 July) with the first read on
whether the July work moved anything.

Read the earlier strategy doc first — this one only records what changed and
what the numbers now say to do differently.

---

## 1. Headline: growth is real, and the CTR drop is not a problem

Last 28 days vs. previous 28: **2,698 clicks (+22%)**, **77,508 impressions
(+13%)**. Since late April, clicks +63% and impressions +212%.

Average CTR roughly halved over the 3-month window. That is a **mix effect, not
a quality regression**:

| Segment (3 mo) | Clicks | Impressions | CTR |
|---|---|---|---|
| Brand (`momuto` + misspellings) | 2,415 | 3,630 | 66% |
| Non-brand | 2,804 | 121,327 | 2.3% |

Brand is 46% of clicks on 3% of impressions. Every impression added by the
non-brand build-out mathematically pulls the blended CTR down. Non-brand clicks
grew faster than brand did. Nothing here needs fixing.

Two other things dilute the blended averages and are worth knowing before
reading any site-wide number:

- **~600 clicks / 28 days (23% of total) come from IN, BD, ID, MY, PH, PK.**
  Real traffic, essentially zero commercial value for a €21.90/jersey EU
  producer. It inflates click counts and drags position/CTR averages.
  Judge performance on FR / ES / IT / US / DE / UK rows, not on totals.
- **Index bloat.** `/account/login` alone drew **1,069 impressions at position
  2.7** over 3 months (7 clicks). Add `fr`/`es` login pages, `/account/register`,
  `/comments/*` paginated review URLs, a Chinese test product
  (`/comments/测试商品`), and per-user configurator URLs
  (`design.momuto.com/3d-configurator/configurator.html?userId=…`, 49
  impressions at position 79). None of it should be in the index.

## 2. What the July work did — page-level evidence

| Page | Clicks 28d (prev) | Impressions 28d (prev) | Read |
|---|---|---|---|
| `www /pages/design-your-own-soccer-jersey` | **51 (16)** | 616 (150) | US soccer-lexicon hub — the single best mover on the site |
| `www /pages/custom-soccer-jerseys` | 8 (2) | 204 (70) | same cluster |
| `www /pages/request-custom-kit-design` | 11 (4) | 619 (213) | deposit gate is gaining surface |
| `es /pages/camisetas-futbol-personalizadas-madrid` | 20 (9) | 788 (415) | city template works; position still 30.9 |
| `es.momuto.com` (home) | 165 (141) | 1,705 (684) | ES impressions +149% |
| `fr /pages/comparatif-fournisseur-maillot-foot-2026` | 146 (130) | 1,949 (2,207) | fewer impressions, more clicks, position 7.1 → **6.0** |
| `fr /collections/concepts-de-maillots` | 24 (18) | 2,201 (1,625) | commercial concept intent is **up** |

Query clusters, same window (previous → last 28 days):

| Cluster | Clicks | Impressions |
|---|---|---|
| US lexicon (`soccer` / `uniform`) | 12 → **36** | 1,690 → 2,492 |
| 3D tool / configurator | 43 → **72** | 1,741 → 1,887 |
| ES-language | 11 → **39** | 650 → 1,398 |
| EN commercial (`jersey maker` etc., 357 queries) | 611 → **791** | 24,392 → 29,057 |
| Concept (all 55 variants) | 39 → **26** | 4,140 → **2,848** |
| FR-language | 155 → 151 | 6,736 → **5,094** |

The 3D-tool cluster tracking +67% in search corroborates the observed rise in
tool usage: the shift of free-design demand onto the self-serve 3D tool is
visible in GSC, not just in product analytics.

## 3. The FR "decline" is the concept cluster, and it is the *right* traffic to lose

FR lost ~1,640 impressions over the period. The concept cluster alone accounts
for ~1,290 of that. The loss is concentrated in exactly one page:

- `fr /blogs/l-art-des-concepts-de-maillots…`: 3,609 → **1,331** impressions
  (−63%), 41 → 16 clicks — while **position held at 7.2**.
- `fr /products/…-maillot-concept-france`: 510 → 349 impressions.
- `fr /blogs/creer-maillot-foot-ia-chatgpt-gemini`: 571 → 422 impressions.

Position steady with impressions collapsing = fewer queries surfacing the page,
not a demotion. And the queries in question are the *definitional* ones —
`maillot concept`, `c'est quoi un maillot concept`, `what is a concept kit`,
`are concept kits real`. That is meaning (a) of "concept": **fan-made designs**,
an audience that reads and leaves.

Meanwhile the FR **concepts collection** grew (1,625 → 2,201 impressions) and
the comparatif page converted better on fewer impressions. Commercial concept
intent is up; encyclopedia traffic is down. That is a healthy mix shift, not a
problem to reverse.

**Where the actual gap is.** Meaning (c) — *"I made a kit with AI, can someone
produce it?"* — has **71 impressions across 11 queries in 28 days**. Effectively
zero. The queries exist (`ai jersey maker`, `ai football kit generator`,
`football jersey maker ai`, `maillot gemini`, `ai football uniform generator`)
and we sit at position 8–9 on almost no volume. Nobody owns this term set yet,
and it is the one that converts.

The blocker was self-inflicted: the three localised
**"concept → real jersey" posts were written, translated, and left as drafts**
(`status: 0`) in FR, ES and IT since the concept-positioning push on 22 July.
They were held back because they still carried the pre-deposit
"design service is always free" claim, which the 17 July deposit-truth sweep
did not reach. Both issues are fixed in this branch — see §7.

## 4. Italy: the problem is not that the site is new

The IT subdomain has full content parity on paper — 20 Italian blog posts in
`blogs/it/`, an about page, RTP collection, gallery, FAQ, comparison page, and
115 team pages. Positions are *good* where it appears: `/pages/chi-siamo` at
1.6, `/` at 4.8, `/collections/concept-jerseys` at 2.7. It ranks fine. It just
never gets shown.

Over 3 months the whole subdomain drew **385 impressions and 12 clicks**, and:

> **Zero Italian-language queries appear anywhere in the top-1,000 query
> export** — a list that runs down to single-impression rows. Not a low number.
> Zero. For comparison, FR-language queries drew 14,190 impressions and
> ES-language 2,009 over the same window.

Meanwhile Italy the *country* delivered **83 clicks / 1,267 impressions at
position 8.3 with 6.6% CTR** in 28 days — better CTR than the site average.
Italian buyers find MOMUTO; they land on the English, Spanish or French sites.

The cause is visible in `cms/inventory/it.json`. The IT store holds **65 blog
posts**, of which:

- **24 are not in Italian** — 15 French (`comment-laver-son-maillot-de-foot…`,
  `pourquoi-creer-un-maillot-de-foot-pour-club…`,
  `maillots-sublimes-revolution…`, …) and 9 English
  (`high-quality-soccer-kits`, `wool-cotton-polyester…`,
  `zidane-vs-maradona-the-legacy…`, …). Every one is already published on its
  own locale.
- **15 pairs (30 posts) are near-duplicates of each other**, e.g.
  `cura-maglia-calcio-guida-definitiva` vs `cura-maglia-da-calcio-guida-completa`;
  `evoluzione-maglie-calcio-lana-cotone-poliestere` vs
  `evoluzione-maglie-da-calcio-dalla-lana-al-digitale`;
  `perche-personalizzare-il-kit-da-calcio-e-come-farlo` vs
  `personalizza-kit-calcio-momuto`; `movimento-collaborativo-…` ×2. Worst case:
  four 3D-configurator posts that are really two articles written twice — a
  four-way split on the most commercially relevant Italian topic.

So **39 of 65 posts are foreign-language or self-cannibalising**. A
site whose blog is one-third French does not read as an Italian site to a
language classifier, and duplicate pairs split whatever signal the real posts
earn. `scripts/audit-and-translate-italian-pages.js` exists and handles *pages*
— it was never pointed at *posts*.

**Fix order for IT** (cheap, mechanical, high leverage) — the full sequence,
with what is already done and what still needs an owner, is in
`docs/it-site-recovery.md`:

1. Unpublish or delete the 23 FR/EN posts from the IT store (`status: 0`, or
   delete — they exist correctly on `fr`/`www`).
2. Pick a winner in each of the 9 duplicate pairs; 301 the loser to it.
3. Publish `concept-kit-calcio-dal-bozzetto-alla-maglia-reale` (done in this
   branch).
4. **Then** judge whether IT content is Italian-market-specific. Right now the
   question can't be answered — the signal is buried. First read on
   `pages/comparison-it`: it names the same competitors as the FR/EN comparison
   (jersix / owayo / spized). Owayo and Spized are DE/EU-wide, so that is not
   wrong, but it misses the Italian field — no `Legea`, `Erreà`, `Zeus`, `Macron`,
   `Givova`, and no CSI / UISP / Terzo Categoria / calcio a 5 league vocabulary,
   which is the Italian equivalent of the FR comparatif's edge.
5. Italian city pages are the obvious next step once 1–3 land — the ES city
   template already proved out (Madrid 9 → 20 clicks in 28 days).

Note the standing checkout dependency from the H2 strategy doc (§P4): IT has no
`checkSumbit.html` DiyFile and `GoodInfoAction` doesn't route to the IT store.
That blocks the RTP → 3D → cart flow, but not any of steps 1–5 above.

## 5. US: content-first is working — the subdomain trigger is close but not met

- US: **128 clicks (from 50, +156%)**, 7,540 impressions (from 5,737).
- Average position **24.0** — and it *worsened* from 21.2, because we're
  surfacing on many more queries than we rank for.
- The US-lexicon query cluster tripled its clicks (12 → 36) and
  `/pages/design-your-own-soccer-jersey` went 16 → 51 clicks at position 8.3.

The H2 strategy set the subdomain trigger at **>300 US non-brand clicks/month
or the soccer cluster reaching page 1**. Neither is met yet — but the trend line
gets there in roughly 2–3 months at the current rate, and the hub page is
already on page 1.

**Recommendation: keep going content-first for one more cycle, and use the time
to clear the two blockers that will otherwise delay `us.momuto.com` by weeks**
(both are owner-side, neither is code):

1. Create the US store in the CMS and add `OEMSAAS_TOKEN_US` to GitHub secrets.
2. Decide the currency. The plan in `docs/us-hub-plan.md` is explicit that a US
   site must not silently price in euros.

`docs/us-hub-plan.md` is written end-to-end and executable the moment those
exist. The subdomain will not fix rank by itself — position 24 is a relevance
problem, and a fresh subdomain starts with less authority, not more. The right
sequence is: soccer-lexicon content on `www` until the cluster reaches page 1–2,
then split it out with hreflang.

## 6. Other things in the data worth acting on

**Desktop is regressing while mobile improves.** Mobile 1,307 → 1,645 clicks,
position 8.31 → **7.95**. Desktop 841 → 978 clicks but position 14.75 → **16.13**.
Desktop is where the 3D configurator experience lives; a rendering or
Core-Web-Vitals check on desktop templates is worth an hour.

**`maillot concept` is the biggest single unconverted pool in FR** — 1,175
impressions at position 7.7 with **0.4% CTR**. Ranking is not the constraint; the
snippet is. The right move is not to chase it as editorial traffic but to
retitle toward the transactional read ("Maillot concept : on le fabrique
vraiment") and route it at the collection, not the blog post.

**ES CTR fell from 20.6% to 9.7%** while impressions grew 149% and position
slipped 9.5 → 13.1. Same mix effect as site-wide: the city pages and hub are
pulling in broad new queries. Madrid at position 30.9 on 788 impressions is the
clearest single on-page opportunity in ES.

**Review snippets lost surface**: 762 → 390 impressions. Worth confirming the
review markup still validates after the July template changes.

**`www /pages/teams-clubs-momuto` went 8 → 0 clicks** (694 → 266 impressions).
FR's equivalent also dropped (280 → 171). Both are proof-heavy pages worth
keeping visible; check nothing broke in the July gallery/teams-page reshuffle.

## 7. Changes made in this branch

The first commit fixed what was blocking §3:

- `blogs/fr/maillots-foot-concept-du-croquis-au-vrai-maillot.json`
- `blogs/es/equipaciones-futbol-concepto-del-boceto-al-jersey-real.json`
- `blogs/it/concept-kit-calcio-dal-bozzetto-alla-maglia-reale.json`

Each had six stale "design service is always free" claims replaced with the
canonical deposit policy in its own language — *€15 deposit, credited in full
from 5 jerseys, so free for a team order, and refunded if you don't proceed* —
matching the wording already live on the request-design pages in each locale.
`status` flipped `0 → 1`.

These deploy on push to `main`; the feature branch does not trigger
`deploy-blog-post.yml`.

Everything else in this document is a recommendation, not a change.

### Follow-up commits

Everything below landed after the first pass, on the same branch.

**Deposit framing.** Marketing and SEO copy now tells only the positive half of
the deposit story — €15 to put a designer on the concept, credited in full from
5 jerseys, so a team order gets the design for nothing. The refund promise is a
point-of-payment reassurance and stays on the four request-design gate pages,
where the wording already existed. Removed the back-out framing from the AI hub
pages in all four locales, three concept posts, two ES guides and the ES
`llms.txt`; kept the satisfaction framing ("refundable if the first concept
isn't right") the blog guides use. Three factual fixes surfaced doing it:
`contact`/`contacto` called the deposit *refunded* on 5+ orders when it is
*credited*, `contacto` still promised free design from 10 shirts against the
canonical 5, and `design-your-own-soccer-jersey` — the best-moving page in the
estate — hedged with "a small refundable design deposit" instead of naming the
€15.

**Crawl hygiene.** All four store `robots.txt` files block `/account/`,
`/search`, and any URL carrying percent-encoded CJK (`%E4`–`%E9`, covering
U+4000–U+9FFF). Accented Latin encodes as `%C3`, so European slugs are
unaffected. `design.momuto.com/robots.txt` blocks `?userId=` and `?configId=`,
leaving the bare `configurator.html` from the sitemap as the single indexable
entry. Note that robots blocks crawling, not indexing — `/account/login` is
already indexed at position 2.7 and will need a `noindex` or a removal request
to actually clear. The Chinese test product is a live product on the EN store;
blocking its URL is a stopgap, deleting the product is the real fix.

**IT store.** `cms/unpublish.json` + `scripts/unpublish-posts.js` +
`unpublish-posts.yml` — see `docs/it-site-recovery.md`. `comparison-it`
rewritten for the Italian market. IT metadata pass. Deposit FAQ added to the IT
request page. The July deposit sweep turned out to have missed `comparison-it`
(nine stale free-design claims) and `comparison-es` (three); both are now
correct.

**Still needing an owner, in priority order:** a Stripe payment link for the IT
store (the Italian request page advertises the deposit but cannot charge it);
the US store + `OEMSAAS_TOKEN_US` + a currency decision, so `docs/us-hub-plan.md`
is executable when the trigger is met; deletion of the Chinese test product; and
a `noindex` route for `/account/*`.
