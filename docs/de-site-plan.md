# German site (`de.momuto.com`) — decision, triggers, and launch checklist

**Status: DECIDED, NOT TRIGGERED.** Agreed July 2026: Germany is the next
locale after Italy proves out and the US question resolves — not before. This
document records the reasoning, the exact triggers that greenlight it, and the
launch-complete checklist so it can be executed quickly the day it fires.

Companion docs: `docs/it-site-recovery.md` (the playbook being proven),
`docs/us-hub-plan.md` (the other queued market), `docs/search-strategy-2026h2.md`.

## The market signal (GSC, 28 days to 28 July 2026)

| Metric | Value |
|---|---|
| Germany clicks | 41 → **100** (+144%) |
| Germany impressions | 1,870 → 2,085 |
| Germany CTR | 2.2% → **4.8%** |
| Germany avg position | 9.2 → **7.9** |
| German-language queries in the top-1,000 export | **0** |

Germany out-clicks Italy (100 vs 83 in the same window) and is the
fastest-improving EU market — **entirely on English queries, with zero German
content anywhere on the estate**. That is untapped pull, not saturation: every
one of those clicks found us despite the language barrier.

## Why not now

1. **The playbook is unproven until the October IT read.** The IT recovery is
   the controlled experiment for "does full localization move a market that
   already sends us traffic through the wrong locale". Launching DE before
   that read commits the same effort on an untested thesis. If Italian queries
   appear in GSC by October, DE launches on evidence; if they don't, a fifth
   locale would inherit whatever is actually wrong.
2. **Germany punishes incompleteness hardest.** Italy sat invisible for 15
   months because it launched half-done. In Germany a half-done store is not
   just an SEO underperformer — it is a legal liability (see below).
3. **It is the hardest SERP we would ever enter.** Owayo (Regensburg) and
   Spized (Cologne) are *at home* there, plus the Jako / Erima / Saller /
   Hummel teamwear ecosystem with physical dealer networks. FR and ES were won
   partly by naming a fragmented field; in DE the field is consolidated and
   native. Winnable — the AI-concept angle is unanswered there too — but the
   slowest ramp of any market entered so far.
4. **Each locale multiplies maintenance surface.** The July deposit-truth
   sweeps missed pages in four locales three separate times. A fifth locale
   adds a column to every future sweep, every robots/llms update, every
   pricing change, and needs German-speaking support.

## Triggers — greenlight when BOTH hold

1. **The IT read is positive** (October 2026 checkpoint,
   `docs/it-site-recovery.md` §measure): Italian-language queries exist in
   GSC and IT subdomain impressions are clearly off the 385/quarter floor.
2. **Germany crosses ~200–250 clicks / 28 days on the EN site** (from 100
   today). Same logic as the US gate: demand proven before infrastructure is
   built. Track the country row in each GSC export; no extra tooling needed.

Secondary tie-breaker if both fire together with the US trigger: whichever
market's checkout can convert sooner wins the build slot. Do not run two
locale launches at once.

## German-market specifics (read before building)

**Legal — this is the long pole, start it early.** German consumer law is
enforced privately via *Abmahnungen* (competitor cease-and-desist letters with
attached fees). A German-language shop targeting Germany must have, from day
one:

- **Impressum** (Telemediengesetz §5): full legal identity, address, contact,
  VAT ID, reachable from every page.
- **Widerrufsbelehrung**: the statutory 14-day withdrawal notice **with the
  model withdrawal form** — note custom-made goods (personalised jerseys) fall
  under the §312g exemption, but the exemption must be *stated correctly*, not
  just assumed.
- **Preisangabenverordnung**: prices incl. VAT, shipping-cost disclosure at
  the price, no drip pricing.
- AGB (terms) and Datenschutzerklärung in German, adapted — not
  machine-translated from the EN terms.

Have this reviewed by someone qualified before launch, not after. It can be
prepared now at near-zero cost while the triggers mature — it is the one
pre-trigger action agreed as worth doing immediately.

**Competitive positioning.** The comparison page is the FR comparatif pattern
on hard mode: name Owayo, Spized, Jako, Erima, Saller honestly, concede
Made-in-Germany to them explicitly (their strongest card, our weakest), and
win on the criteria they structurally can't match — no minimum order, the
€15-deposit design studio, real-time 3D, and above all **AI-concept intake**:
a catalogue/configurator business cannot take a ChatGPT render as input.
Vocabulary: *Trikot / Trikotsatz / Trikots selbst gestalten / Vereinstrikots /
Kreisliga / Betriebssport / Freizeitliga*. The 5-euro question exists in
German too (*"Trikots für 5 Euro"*) — answer it straight like the IT page.

**Deposit framing carries over unchanged**: 15 € to put a designer on the
concept, credited in full from 5 jerseys — free for a team order. The refund
promise stays on the gate page only. German buyers respond well to the
seriousness filter; say it plainly.

## Launch-complete checklist

The IT lesson, distilled: **a locale ships complete or not at all.** Nothing
below is optional; the store stays unlaunched (noindex or unpublished) until
every box is checked. Ordered roughly by lead time.

**Owner / accounts**
- [ ] Legal pack reviewed (Impressum, Widerruf, AGB, Datenschutz, PAngV) — start now
- [ ] DE store created in the CMS (oemapps), `de.momuto.com` bound
- [ ] `OEMSAAS_TOKEN_DE` in GitHub secrets (+ Vercel if any API route needs it)
- [ ] Stripe payment link (product `MOMUTO Trikot-Design nach Maß`, 15,00 €,
      redirect → `https://de.momuto.com/pages/<request-handle>?paid=true`,
      email collection on)
- [ ] German-speaking support channel (WhatsApp + email) committed

**Plumbing (one commit, pattern = the `us` plan in `docs/us-hub-plan.md`)**
- [ ] `de` in `scripts/deploy-blog-post.js` DOMAIN_MAP + path regex
- [ ] `de` in `scripts/pull-cms.js` TOKENS
- [ ] `OEMSAAS_TOKEN_DE` in the env blocks of deploy/pull/unpublish workflows;
      `de` in every workflow locale dropdown
- [ ] `de` blocks in `deploy-request-design-page.js`, `deploy-comparison-pages.js`,
      `deploy-concept-pages.js`, `deploy-about-pages.js`, `deploy-cms-page.js`,
      `deploy-static-files.js`, `rebuild-sitemap.js`
- [ ] `static/de.momuto.com/` robots.txt (with the CJK/account/search blocks),
      llms.txt (German, deposit truth), sitemap.xml
- [ ] `de` in the 3D-tool store map (`CONFIG3D`/`STORE3D` in embed.js) —
      the IT gap that is still open; do not repeat it

**Checkout — the standing IT mistake, front-loaded here**
- [ ] `checkSumbit.html` DiyFile for the DE store
- [ ] `GoodInfoAction` routes to the DE store
- [ ] RTP → 3D → cart flow tested end-to-end in German *before* content launch

**Content (all German-native in register, not translated word-by-word)**
- [ ] Homepage blocks (pattern: `homepage blocks ES + IT` commit)
- [ ] Request page with deposit gate + transform examples (port of the current
      four-locale template; guard in `deploy-request-design-page.js` extends
      automatically once the page carries a gate)
- [ ] Confirmation page (`Design bestätigt`) — deposit-true tiles from day one
- [ ] Comparison page per the positioning above
- [ ] AI-concept hub (`trikot-ki-konzept-real` or similar) + concept-to-real post
- [ ] ~15–20 blog posts: the pillar+cluster set (team guide, futsal,
      7-a-side/Kreisliga, tournaments, corporate/Betriebssport, when-to-order,
      sponsors/funding) — mirror the EN/ES hub structure
- [ ] About / FAQ / size guide / materials — FAQ answers double as the
      LLM-quotable layer
- [ ] hreflang: add `de` to the existing alternates across all locales
- [ ] Meta pass: every published item ≤65/≤160, head terms Trikot/Trikotsatz

**Pre-launch verification (the IT audit, run *before* going live for once)**
- [ ] Language audit dry-run over the DE store: zero non-German posts/pages
- [ ] Deploy-guard pass on the request page (Stripe link, gate parts, one URL)
- [ ] No "free design" claims anywhere; deposit framing positive-only
- [ ] Test order + test deposit payment end-to-end

## What NOT to do

- No German posts on `www` as a stopgap — mixed-language stores are exactly
  the IT disease. German = full store or nothing.
- No launch with the checkout dependency open "to fix later" (see IT).
- No machine-translated legal pages. Everything else can be AI-drafted and
  reviewed; the legal pack gets qualified human review.

## Measurement after launch

Same discipline as IT: first read at 4–8 weeks, not before. In order:
1. German-language queries appearing in GSC at all (from today's zero).
2. DE-subdomain impressions vs the EN site's German-country row — the goal is
   *migration* of that traffic, then growth on top.
3. The comparison page's position on `trikot hersteller vergleich`-class
   queries — the FR comparatif (position 6.0) is the target shape.
