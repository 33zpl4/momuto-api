# Verification map — how to prove each surface works

One page per rule of thumb: **done = the surface-specific proof below, not "the push succeeded"**. Written 12 Oct 2026 from the
failures and fixes of the 1–12 Oct sessions. Extend it whenever a new surface gets a harness or a new way to fail.

| Surface | Prove it BEFORE live | Prove it LIVE | Known traps |
|---|---|---|---|
| CMS page fragment (`pages/*`, `cms/pages/*`) | node sanity checks in `scripts/deploy-*.js` (fonts, one h1, JSON-LD parses, keyword arrays, meta lengths); `node scripts/check-copy-rules.js` | green **Deploy CMS Page** run on the merge commit; owner screenshot for visuals (sandbox cannot reach the stores) | PUT replaces the whole object; never deploy a repo copy of a pipeline-owned page |
| Gallery pages (`custom-kit-gallery`, `galeria-*`…) | read the LIVE page, change one thing, write the same object back (`scripts/patch-gallery-review-count.js` is the template: dry run lists the 5 stores, then live) | the run log lists each store `✅ written`; designs untouched | a stale repo copy erased 29 US cards (1 Oct) |
| Blog post (`blogs/**`) | `node scripts/deploy-blog-post.js` with `DRY_RUN=true`; copy-rules linter; HTML balance check | green **Deploy Blog Post** run (auto on merge to main) | hreflang cluster row needed if handles differ across locales; image URLs must load (design.momuto.com static/team-photos); `published_at` read-back must print VERIFIED; translated posts: handles differ per run, pull then add the cluster row |
| Shipped email (`lib/emails.js` emailTracking, `poll-shipped-orders`) | `node scripts/test-shipped-email.js`; dry run of Poll shipped orders (log shows WOULD SEND + subject) | live run log `SENT`, the email received on a test order, then (only then) the platform shipped email switched off with `set-email-notification-status` (`VERIFIED` per store) | two shipped emails if the platform one is left on; see `docs/shipped-email.md` |
| Abandoned-cart email (`cms/email-notifications/src`) | **dry run** of `push-recovery-email.yml` (prints OLD title/blocks per store) | live run prints `VERIFIED — new template live` per store; delay is NOT read back, check the next template dump | US store has its own notice id; the platform rejects delay 1800 (use 1799) |
| Transactional emails (`lib/emails.js`) | render each language in node and grep the output (see the deposit-nudge check in the 12 Oct commit) | next cron/webhook run; Resend dashboard | refund wording is gate-pages-only |
| Cart / checkout templates (design-momuto `templates/*/cartItem.html`) | `scripts/local-harness/build-cart-preview.js <lang>` + a Playwright driver (`drive-cart-*.js`); Alpine comes from `npm pack alpinejs@3.14.1` into `local-harness/node_modules` | green **Deploy to SFTP**; server cache ~1 h | the harness mocks `/v1/items`; a real PUT/redirect only exists live |
| 3D tool chunks (`3d-configurator/*.js`) | parse check of the outer script AND every `eval("…")` block (`node scripts/validate-chunk.js <chunk>` in design-momuto), then `scripts/local-harness/applocal.js "configId=local&suitName=…&skipWizard=1"` | green **Deploy to SFTP**; hard reload in a private window | edit the LIVE chunk (check which hash `configurator.html` → entry map points to); `skipWizard=1` or the welcome modal blocks every click |
| Share / result views | none yet — **gap**: needs a saved-design payload for `/v1/listSuit` to render `share.html` locally | owner opens a real share link in a private window | `selected_index_` is 0 there, never −1 (the 3 Oct laces fix missed it) |
| Store account pages (platform theme: login / register / orders / order detail) | `scripts/probe-store-account.js` with `PROBE_CSS` / `PROBE_JS` injected (workflow *Probe store account area*, runner, read-only); desktop + 390 px | the same probe with `css=none js=none` after the paste: the summary must say `account skin: v1` per store; `publish_shots=true` to read screenshots from the throwaway branch | the sandbox cannot reach the stores; USPS answers the runner 403; login is a script div (`#confirm`); a shipped order is needed to see the Tracking block; test-account screenshots must not linger (the workflow deletes the branch by default) |
| Shipping zones / navs / SEO (`sync-store-config.js`) | `inspect-zones`, then `dry_run` | the run's `apply` log + a test checkout | type-1 zones cannot overlap |
| WhatsApp assistant (`lib/wa-*`, `/api/wa-webhook`) | `node --test test/wa-bot.test.js test/wa-webhook.test.js`; `node scripts/build-wa-bot-answers.js --check` | Vercel log shows `[wa] DRY RUN would send` for a test message BEFORE `WA_LIVE=true`; then a real round trip from a phone | answers only change via the FAQ JSON; `api/` is at the 12-function cap (webhook rides `stripe-webhook.js`); Meta needs a raw-body HMAC |
| Copy rules (CLAUDE.md "hard rules") | `node scripts/check-copy-rules.js` (also a PR check) | — | baseline in `scripts/copy-rules.baseline.json` only ever shrinks |

## The write-script pattern (copy it for any new CMS/API writer)

1. **Dry run is the default** (`DRY_RUN !== 'false'`). It prints what would change per store, including the OLD value.
2. **Read, change one thing, write the whole object back** (all fields, `meta_keywords` as an array, `og_image` kept).
3. **Space writes and retry on code 1000**; a failed GET must throw, never read as "not found".
4. **Read back and compare** what you changed; print `VERIFIED` or fail the run.
5. A `workflow_dispatch` input for dry run, so a person or an agent can run the same thing from a branch before merging.

Templates in the repo: `scripts/push-recovery-email.js`, `scripts/patch-gallery-review-count.js`, `scripts/sync-store-config.js`.
