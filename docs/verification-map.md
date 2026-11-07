# Verification map — how to prove each surface works

One page per rule of thumb: **done = the surface-specific proof below, not "the push succeeded"**. Written 12 Oct 2026 from the
failures and fixes of the 1–12 Oct sessions. Extend it whenever a new surface gets a harness or a new way to fail.

| Surface | Prove it BEFORE live | Prove it LIVE | Known traps |
|---|---|---|---|
| CMS page fragment (`pages/*`, `cms/pages/*`) | node sanity checks in `scripts/deploy-*.js` (fonts, one h1, JSON-LD parses, keyword arrays, meta lengths); `node scripts/check-copy-rules.js` | green **Deploy CMS Page** run on the merge commit; owner screenshot for visuals (sandbox cannot reach the stores) | PUT replaces the whole object; never deploy a repo copy of a pipeline-owned page |
| Gallery pages (`custom-kit-gallery`, `galeria-*`…) | read the LIVE page, change one thing, write the same object back (`scripts/patch-gallery-review-count.js` is the template: dry run lists the 5 stores, then live) | the run log lists each store `✅ written`; designs untouched | a stale repo copy erased 29 US cards (1 Oct) |
| Blog post (`blogs/**`) | `node scripts/deploy-blog-post.js` with `DRY_RUN=true`; copy-rules linter; HTML balance check | green **Deploy Blog Post** run (auto on merge to main) | hreflang cluster row needed if handles differ across locales; image URLs must load (design.momuto.com static/team-photos); `published_at` read-back must print VERIFIED; translated posts: handles differ per run, pull then add the cluster row |
| Shipped email (`lib/emails.js` emailTracking, `poll-shipped-orders`) | `node scripts/test-shipped-email.js`; dry run of Poll shipped orders (log shows WOULD SEND + subject) | live run log `SENT`, the email received on a test order, then (only then) the platform shipped email switched off with `set-email-notification-status` (`VERIFIED` per store) | two shipped emails if the platform one is left on; see `docs/shipped-email.md` |
| Store cart page + pop-up skin (`docs/cart-brand/`) | `node scripts/build-cart-brand-entry.js --check`; `node scripts/test-cart-brand.js` (real markup fixtures) | probe-cart-ui with `css=docs/cart-brand/cart-brand.css` (before/after screenshots); after the owner pastes the entry, a `css=none` run shows `--mo-cart-skin: v1` | selectors are the theme's own; the pop-up exists only while open; the entry loads on every page |
| Abandoned-cart email (`cms/email-notifications/src`) | **dry run** of `push-recovery-email.yml` (prints OLD title/blocks per store) | live run prints `VERIFIED — new template live` per store; delay is NOT read back, check the next template dump | US store has its own notice id; the platform rejects delay 1800 (use 1799) |
| Transactional emails (`lib/emails.js`) | render each language in node and grep the output (see the deposit-nudge check in the 12 Oct commit) | next cron/webhook run; Resend dashboard | refund wording is gate-pages-only |
| Cart / checkout templates (design-momuto `templates/*/cartItem.html`) | `scripts/local-harness/build-cart-preview.js <lang>` + a Playwright driver (`drive-cart-*.js`); Alpine comes from `npm pack alpinejs@3.14.1` into `local-harness/node_modules` | green **Deploy to SFTP**; server cache ~1 h | the harness mocks `/v1/items`; a real PUT/redirect only exists live |
| 3D tool chunks (`3d-configurator/*.js`) | parse check of the outer script AND every `eval("…")` block (`node scripts/validate-chunk.js <chunk>` in design-momuto), then `scripts/local-harness/applocal.js "configId=local&suitName=…&skipWizard=1"` | green **Deploy to SFTP**; hard reload in a private window | edit the LIVE chunk (check which hash `configurator.html` → entry map points to); `skipWizard=1` or the welcome modal blocks every click |
| Share / result views | none yet — **gap**: needs a saved-design payload for `/v1/listSuit` to render `share.html` locally | owner opens a real share link in a private window | `selected_index_` is 0 there, never −1 (the 3 Oct laces fix missed it) |
| Store account pages (platform theme: login / register / orders / order detail) | `scripts/probe-store-account.js` with `PROBE_CSS` / `PROBE_JS` injected (workflow *Probe store account area*, runner, read-only); desktop + 390 px | the same probe with `css=none js=none` after the paste: the summary must say `account skin: v1` per store; `publish_shots=true` to read screenshots from the throwaway branch | the sandbox cannot reach the stores; USPS answers the runner 403; login is a script div (`#confirm`); a shipped order is needed to see the Tracking block; test-account screenshots must not linger (the workflow deletes the branch by default) |
| Creator codes / commission report (`scripts/creator-commission-report.js`) | mock-orders run in node (coupon in several field names, cancelled/refunded/undelivered) | three real test orders (8 / 10 / 9 jerseys) then workflow **Creator commission report** with `probe=true`; read the raw order | field names for coupon, shipping, delivery are candidates until that probe |
| Shipping zones / navs / SEO (`sync-store-config.js`) | `inspect-zones`, then `dry_run` | the run's `apply` log + a test checkout | type-1 zones cannot overlap |
| WhatsApp assistant (`lib/wa-*`, `/api/wa-webhook`) | `node --test test/wa-bot.test.js test/wa-webhook.test.js`; `node scripts/build-wa-bot-answers.js --check` | Vercel log shows `[wa] DRY RUN would send` for a test message BEFORE `WA_LIVE=true`; then a real round trip from a phone | answers only change via the FAQ JSON; `api/` is at the 12-function cap (webhook rides `stripe-webhook.js`); Meta needs a raw-body HMAC |
| Copy rules (CLAUDE.md "hard rules") | `node scripts/check-copy-rules.js` (also a PR check) | — | baseline in `scripts/copy-rules.baseline.json` only ever shrinks |
| Fixed-price "Promo" store product (title marker `Promo`, design-momuto server-patches README section 13) | title has NO discount-campaign word (personalizada/o, custom): `node scripts/check-promo-products.js` (runs daily as **Check Promo Products**, red = at risk) | product's collections list is empty about a minute after the title edit (collection rules re-evaluate late: `set-product-3d-pointer` logs a stale "after" right away; dispatch **Check Promo Products** a minute later and read the collections); a test order shows the Promo line without a `Promotion` row | 2 Nov 2026: ES "Fokabumbum — Camiseta Personalizada · Promo" was in the "Camiseta Personalizada" collection, so the 7-unit rebate tier (30.85%) stacked on the fixed 18.90: -40.81 EUR; the EN "Chicos Tóxicos — Custom Full Kit · Promo" order lost 7.57 the same way. The campaigns apply to collections matched on the title; keep the kit/jersey word, drop the campaign word |

## The write-script pattern (copy it for any new CMS/API writer)

1. **Dry run is the default** (`DRY_RUN !== 'false'`). It prints what would change per store, including the OLD value.
2. **Read, change one thing, write the whole object back** (all fields, `meta_keywords` as an array, `og_image` kept).
3. **Space writes and retry on code 1000**; a failed GET must throw, never read as "not found".
4. **Read back and compare** what you changed; print `VERIFIED` or fail the run.
5. A `workflow_dispatch` input for dry run, so a person or an agent can run the same thing from a branch before merging.

Templates in the repo: `scripts/push-recovery-email.js`, `scripts/patch-gallery-review-count.js`, `scripts/sync-store-config.js`.

## Live page `<head>` (title, canonical, robots, hreflang, sitemap listing) — added 3 Nov 2026
Proof: a green **Probe page head (read-only)** run (`scripts/probe-page-head.js`) with the URL in its input; the log prints status, final URL,
title, canonical(s), meta robots, hreflang tags, H1s and whether the host's `/sitemap.xml` lists the URL and with which alternates.
Use it before claiming anything about what Google sees on a page; a repo fragment is not that proof.

## Store nav menus and the homepage SEO plan — added 3 Nov 2026
Proof of a nav write: a green **Store Config** `apply-nav` run (DRY_RUN=false) followed by an `inspect-nav` run for the same store whose
JSON shows the item URLs you wrote (the POST upsert issues a new menu id; the theme binds by `nav_name`, so a new id is expected).
Proof of a homepage SEO write: a green `apply-seo` run followed by an `apply-seo` **dry run**, whose "Current homepage SEO" line equals the
"New" line. A page-level title/description change is proved by **Probe page head** on the URL (see above).

## www entry (US banner + H1 demotion) — added 3 Nov 2026
Source `docs/www-us-banner/`; proof that it is pasted = **Probe page head** on a www page showing a single `h1` and (from a US browser)
the `#mo-us-banner` bar. The `--check` in Check copy rules proves only that the generated file matches the sources.

## Price pages (5 locales) — added 3 Nov 2026
Source of numbers: `faq/faq.<locale>.json` pricing block; copy: `pricing/price-page.<locale>.json`; builder `scripts/build-price-pages.js`
(sanity: fonts, one H1, JSON-LD, meta lengths, lexicon, stale price, no refund wording, 15-player row). Proof of a change: green Deploy CMS Page
on the merge + Probe page head on the URL; the calculator is checked in Chromium by `scratchpad/test-price-calc.js` (session) — move it into
`scripts/` on the second change. A price change goes into the FAQ source first, then both builders run.

## 3D designer: one configId per visit — added 4 Nov 2026
The tool (design-momuto `configurator.html`, inline script) swaps the public template ids for a fresh one at entry.
Proof that it is live: a green **Probe 3D entry (read-only)** run (`scripts/probe-3d-entry.js`): each public link opens with a
different 8-char configId, the tool's state (`__momutoOw.configId`) equals it, a share-copy link keeps its id, and the about-page
link no longer carries the literal user id. NOT proved by the probe: a real save / add-to-cart (owner test on one store).


## Lifecycle emails (6 Nov 2026) — docs/lifecycle-emails.md

| surface | proof |
| --- | --- |
| Abandoned-checkout mail | `poll-abandoned-checkouts.yml` dry-run log lists the right unpaid orders (masked emails, renders found); first live run: `→ 200 {"ok":true,"sent":true}` per order and the mail in the Resend dashboard |
| Day-90 reorder offer | `poll-reorder-offers.yml` dry-run log; `probe-coupon-write.yml` live = `VERIFIED create + delete`; first live run: `coupon created · mail → 200 … sent` and the code visible in the store admin |
| Templates | `node --test test/lifecycle-emails.test.js` in the PR check |

## Size guide, gallery meta, blog checks, ES maker page (6 Nov 2026)

| surface | proof |
| --- | --- |
| Size guide (5 stores) + FAQ sizes | CMS deploy run green; tables read back from `cms/pages/*`; cart popup/selects: design-momuto harness `drive-cart-4xl.js` 4/4 per locale. Not verified: live pages, factory 4XL (`docs/size-guide.md`) |
| Gallery SEO meta | `patch-gallery-meta.yml` live run prints `VERIFIED` and the content length unchanged per store (run 42276767078) |
| Blog FAQ/links | `node scripts/check-blog-integrity.js` = 0 problems (PR check) |
| ES maker page | Deploy CMS Page "created id ?" then Pull (`pull-blog-post.yml`, cms_type page) to capture the id into `cms/pages/es/` |
| Competitor claims in copy | read with `probe-page-text.yml`, dated in the post; "not published" when a brand states no composition |

## Homepage hero buttons (7 Nov 2026)

| surface | proof |
| --- | --- |
| Hero CTAs (wrap, contrast, hover) | `probe-hero-buttons.yml` (runs on push of `pages/homepage/hero.*.html`): `REPO problems: 0` across 5 stores x 5 widths on the live theme CSS (run 42352737676); it also shows the LIVE state per store. Not a visual check: no screenshot of the final render; the owner confirms after pasting |
