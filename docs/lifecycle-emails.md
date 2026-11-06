# Lifecycle emails we send ourselves: abandoned checkout + day-90 reorder offer

Written 6 Nov 2026. Owner rulings that day: (1) abandoned-cart mail goes through Resend, not the platform's automation,
"like the shipped email" — more control, our copy, our sender; (2) a day-90 email offering 10 % off a new kit with a code
valid 14 days — something we did not do. Read this BEFORE touching either flow, `lib/lifecycle-mail.js`, or the platform's
`carts/recovery_*` notifications.

## How it fits

| piece | where | runs |
| --- | --- | --- |
| Decide WHO gets what | `scripts/poll-abandoned-checkouts.js`, `scripts/poll-reorder-offers.js` (GitHub runner: store tokens) | `poll-abandoned-checkouts.yml` hourly, `poll-reorder-offers.yml` daily |
| Render + dedup + send | `lib/lifecycle-mail.js` via `POST /api/lifecycle` (Vercel: KV + Resend; rewrite through `/api/lead`, Hobby 12-function cap) | on each POST |
| Copy | `lib/emails.js` `emailAbandoned` / `emailReorder` (en/us/es/fr/it) + `test/lifecycle-emails.test.js` (PR check) | |
| Coupons | `scripts/platform-coupon.js` (`percentCoupon`, `createCoupon`, `findCoupon`, `deleteCoupon`); write shape verified by `probe-coupon-write.yml` | |

**Dedup lives in KV** (`lifecycle:<kind>:<store>:<orderId>`, NX before any send; a rejected send clears it), so the pollers can be
re-run freely. Reorder: additionally one per email per 180 days (`lifecycle:reorder:email:<email>`), and the coupon's existence
on the platform is the guard on the runner side. **Suppression:** add an email to the KV set `lifecycle:suppress` and neither
mail is ever sent to it. Both pollers are **dry runs by default** (decisions logged, emails masked); live = repo variable
`ABANDONED_LIVE` / `REORDER_LIVE` = `1` for the schedule, or the `live` tick on a dispatch.

## Abandoned checkout

- **Signal (the key finding):** the platform creates the ORDER when the customer reaches checkout, before paying — order
  2026110633635073 on 6 Nov was `financial_status 200`, `pay_at 0`, email present, the €0 preview lines with the design renders,
  `recart_mail_sended: 1` (the platform had sent ITS mail) and a `checkout_token`. No cart/checkout API exists (`/carts`,
  `/checkouts`, `/abandoned_checkouts` → 接口未定义). `GET /orders?financial_status=200` lists them (also filtered client-side).
- **Rules:** created 60 min – 72 h ago, has email, not test, not cancelled, and the email has not PAID any order since (newest
  100 orders of the store). One mail per platform order id, ever.
- **Email:** the owner-approved recovery-1 copy (designer reviews every order, Trustpilot 4.6, 38.90 / 21.90 from 10 — $45.90 /
  $25.90 on US — no minimum, 25–30 days) + the customer's own front renders (CDN src of the preview lines) + item count and
  total + "Back to my cart" → `https://<store>/cart` (the platform cart persists per browser) + "reply, a real person answers".
- **Not a resume link yet:** the platform's own mail resumes the checkout from `checkout_token`; the URL pattern is not in anything
  we hold (the store pages only test for `/checkouts/` in a URL). Owner: forward one platform recovery email and we switch the
  button to that link. Until then the cart link is the safe choice.
- **Switching the platform mail off** (once ours is live): `EVENT=carts/recovery_1 STATUS=0 DRY_RUN=false node
  scripts/set-email-notification-status.js` (phases 2 and 3 are already off in all 5 stores; dumps in `cms/email-notifications/`).

## Day-90 reorder offer

- **Source:** the platform's PAID orders (230) of every store, paid 90–104 days ago (so the daily run catches each order once in
  a two-week window and a missed day is not lost). Not the KV records: those miss direct store buys and start in Sep 2026.
- **Rules:** has email, not test, not cancelled, `refund_status` 100 (none), one per email per run, one per email per 180 days.
- **Coupon:** `KIT10-<3D ref | order id>`, 10 %, whole store, single use, `starts_at` now, `ends_at` +14 d, created on the order's
  store right before the email (dry run creates nothing). Created-but-unsent is possible if Resend fails: the next run sees the code
  and skips, so re-run `lib` dedup is intact; the orphan coupon simply expires in 14 days.
- **Email:** "<team> — 10% off your next kit": three months on, new players / away kit / training; code box with expiry; same fabric
  92/8 and designer check; "same design for a few new players? reply and we set it up"; CTA to the store's designer/kit page +
  link to the price page. **No prices in the body** (the ladder lives on the price page). Team name = the preview line's title prefix
  when the design was named; else no team.
- **Stacking with the seasonal −10 % selection / fast lane / creator codes:** whatever the platform does by default. Owner to decide
  if a store-side rule is needed (the creator-program doc has the same open point).

## Verification (docs/verification-map.md)

- Dry runs of both pollers read the live orders and print decisions (run ids below once run).
- `probe-coupon-write.yml` live on ES: POST → list → DELETE → gone = `VERIFIED create + delete`; the response shape is pasted below.
- First live sends: read `lifecycle:sent` via a KV read, and the Resend dashboard.

### Run log
- (fill in: dry-run ids, coupon probe result, first live run)

## Open
- The resume-checkout URL (above).
- A real "reorder the same design" path (one click from My order) instead of "reply to this email".
- Complementary products (training wear, hoodies) to put in the reorder mail and on the order page — product scoping pending.
