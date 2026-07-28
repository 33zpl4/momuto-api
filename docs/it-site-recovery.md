# it.momuto.com recovery runbook

Companion to `docs/search-analysis-2026-07.md` §4. That document establishes
*why* the Italian site is invisible; this one is the ordered sequence to fix it,
what is already done, and what still needs an owner.

## The diagnosis in one paragraph

The IT site is not new-and-catching-up. It ranks well wherever it appears
(`/pages/chi-siamo` at position 1.6, homepage at 4.8) and has full content
parity on paper — 20 Italian blog posts, about / RTP / gallery / FAQ /
comparison, 115 team pages. What it does not have is any Italian query
footprint: **zero Italian-language queries appear anywhere in the top-1,000 GSC
export**, a list that runs down to single-impression rows. Over three months the
whole subdomain drew 385 impressions. Meanwhile Italy the *country* delivered 83
clicks at position 8.3 with 6.6% CTR — better than the site average — all of it
landing on the English, Spanish and French sites.

The cause is that the IT store does not read as an Italian site. Of its 65 blog
posts, 24 are French or English and 15 more are near-duplicates of another
Italian post. Roughly half the store is either the wrong language or competing
with itself.

## Sequence

Steps are ordered so that each one makes the next measurable. Do not reorder —
in particular, do not judge whether the Italian content is any good (step 6)
until steps 1–3 have cleared the noise, because right now the signal is buried.

### 1. Clean the language — DONE in repo, needs a run

`cms/unpublish.json` declares 39 posts: 15 French, 9 English, 15 duplicate
losers. Every foreign handle was verified present on its home locale first, so
nothing is lost from the estate. Duplicate winners were picked on measured GSC
signal first (impressions, position, clicks) and Italian head-term quality
second, so no URL with traffic is dropped.

Run **Unpublish Posts** (`.github/workflows/unpublish-posts.yml`) with
`dry_run=true`, read the log, then re-run with `dry_run=false`. Each post is
archived to `cms/unpublished/it/<handle>.json` and committed back before it is
flipped; restoring one means moving the archive into `blogs/it/` with
`status: 1` and pushing.

Expected end state: 65 published posts → 26.

### 2. Publish the concept-to-real post — DONE in repo

`blogs/it/concept-kit-calcio-dal-bozzetto-alla-maglia-reale.json` sat at
`status: 0` since the concept-positioning push because it still promised an
always-free design service. Fixed and taken out of draft. Deploys on push to
`main`.

### 3. Make the comparison page Italian — DONE in repo

`pages/comparison-it` named Jersix / Owayo / Spized, the same three as the
English and French pages. It now names the Italian field (Legea, Erreà, Zeus,
Macron, Givova as catalogue brands; Kipsta/Decathlon as distribution) and speaks
CSI, UISP, Terza Categoria and calcio a 5. Two sections were added from what
works on the FR comparatif — the AI-concept criterion and the 5-euro-jersey
question — plus one on multi-team clubs, where the number that matters is the
minimum per model, not the unit price.

Deploy with the **Deploy Comparison Pages** workflow.

### 4. Audit the CMS pages — needs a run

`scripts/audit-and-translate-italian-pages.js` covers the 114 CMS pages and has
never been run against the current inventory. The seven IT-facing page files
tracked in this repo are all clean Italian, so whatever is left is CMS-only.

Run **Audit & Translate Italian Pages** with `dry_run=true` first.

> **Read the dry-run report before running live.** Translating rewrites the page
> handle, which changes the live URL. Check GSC for impressions on the old
> handle first — `/pages/galleria-maglie-personalizzate` (85 impressions,
> position 4.0) and `/pages/chi-siamo` (53 impressions, position 1.6) are the
> two worth protecting.

### 5. Take the deposit — gate BUILT, needs the Stripe link

`pages/richiesta-design-personalizzato` advertised the €15 deposit in eleven
places and had no way to charge it. The gate is now built and matches EN/FR/ES
exactly — same CSS, same section order, same script: paid-banner, `payment-gate`
section, and the brief form wrapped in `#brief-form-section` so it only appears
after payment.

The one missing piece is owner-side: **an Italian Stripe payment link.** The
page ships with `__STRIPE_LINK_IT__` in two places (the button `href` and the
script constant), and `scripts/deploy-request-design-page.js` refuses to deploy
while the placeholder is there — a pay button that goes nowhere is worse than no
page at all. The same check also verifies that any page carrying a gate has all
of `paidBanner`, `brief-form-section`, `cta-form` and `gatePayBtn`, and exactly
one distinct Stripe URL, so the button and the script can never drift apart.

**To create the link** (Stripe Dashboard → Payment links → New):

| Field | Value |
|---|---|
| Product name | `MOMUTO Design Kit Personalizzato` |
| Description | `Un designer trasforma il tuo concept in un kit pronto per la produzione · accreditato sugli ordini da 5 maglie in su.` |
| Price | €15,00, one-off |
| Currency | EUR |
| After payment | Redirect → `https://it.momuto.com/pages/richiesta-design-personalizzato?paid=true` |
| Collect email | On (the page appends `?prefilled_email=`) |

Then replace both `__STRIPE_LINK_IT__` occurrences and run **Deploy Request
Design Page** with `LOCALES=it`.

**Confirmation page.** The form's `_next` lands on
`/pages/design-personalizzato-confermato`, which exists on the store but had
never been pulled, so we do not have its CMS id. The Italian content is written
in `cms/pages/it/design-personalizzato-confermato.json`; the pull is queued in
`.github/pull-queue.txt`. Pull it, copy the id into that file, then deploy it
with `deploy-cms-page.js`.

While writing it, two stale tiles surfaced on the EN and FR confirmation pages:
"Free — 3D Mockup" and "No commitment — the design is yours either way". Both
are read *after* the customer has paid the deposit, so both are now wrong and a
bit insulting. Replaced with the deposit status and the revisions promise on all
three locales.

### 6. Then judge the content

Only after 1–4 is it worth asking whether the surviving Italian content is
actually written for the Italian market. The metadata pass in July corrected
what could be corrected without query data — head terms, two false "campioni
gratuiti" claims, a roundup still titled 2025 quoting 20-day delivery — but
there is no Italian query data to optimise against yet. That is the point of
steps 1–4: generate some.

### 7. Italian city pages

The ES city template is proven (Madrid went 9 → 20 clicks in 28 days from a
barely-optimised page). `scripts/deploy-city-pages.js` and `cms/city-pages/es`
are the pattern to copy. Milano, Roma, Napoli, Torino, Bologna, Firenze,
Palermo, Genova. Do this last — city pages on a store that reads as
one-third French will not rank either.

## Standing blocker, unrelated to search

IT has no `checkSumbit.html` DiyFile and `GoodInfoAction` does not route to the
IT store (see `design-momuto/server-patches/README`). Until both ship, the
RTP → 3D → cart flow does not work on Italian. None of steps 1–7 depend on it,
but traffic arriving before it is fixed cannot convert through that path.

## What to measure, and when

Search changes on a store this quiet take 4–8 weeks to read. Check at the start
of October, not before, and check these in order:

1. **Any Italian-language query in the GSC export at all.** Today: zero. This is
   the only step-1 success metric that matters; impressions and clicks are
   downstream of it.
2. IT subdomain impressions against the 385/quarter baseline.
3. Italy-the-country clicks still landing on `www` / `es` / `fr` rather than
   `it` — 83 clicks in the 28 days to 28 July. That number moving onto `it` is
   the real win.
4. `/pages/confronto-fornitori-maglie-calcio-2026` position. The FR comparatif
   sits at 6.0 and is the best non-brand page in the estate; that is the target
   shape, not a number to hit quickly.
