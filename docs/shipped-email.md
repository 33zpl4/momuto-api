# "Order shipped" email (19 Oct 2026)

One branded shipped email per order, sent by us (Resend), replacing the platform's generic one.

## Why
The platform's `orders/fulfilled` email is generic, off-brand, English on ES/IT, and (like all its webhooks) not on our schedule. The order API shows
the shipment as soon as it is made in the CMS, so we read it and send our own.

## Where the data is (probe of order 231549-2026026, US, 19 Oct 2026; `scripts/probe-order-shipping.js`)
`GET /orders/{id}` → `fulfillment_status: 320` and `fulfillments[]`: `tracking_number`, `courier_id` (USPS = 4629), `courier_code` ("21051"), `note`
(carrier URL typed by the platform), `created_at` (ship time). Also `customer_email`, `order_number`, `currency_code`, `products[]` (the €0 `3d-preview` line
carries our local ref, same join as the paid poller).

## Flow
1. `.github/workflows/poll-shipped-orders.yml` (hourly :37) runs `scripts/poll-shipped-orders.js`: lists each store's orders, re-reads the ones that look shipped,
   builds carrier + deep link (`lib/carriers.js`), POSTs `admin-orders` `action: "ship"`.
2. `api/admin-orders.js` `ship`: dedupes (record already has the `tracking` mail, or KV `shipmail:<platform no>`), sends `emailTracking` (`lib/emails.js`),
   and for 3D orders marks the record `shipped` (lifecycle mails stop, My order page shows the tracking). Store orders without a 3D record get the email only.
3. The manual route (`api/order-tracking.js`, admin) still works and sends the same email; the poller then sees `tracking` already sent and skips.

## The email
Dark brand layout. Carrier, tracking number, estimated delivery (ship date + 10–15 d, rule 6), red button to the carrier's page (only when we have a trustworthy
https link), then **My order** (token page, no login) and a line pointing to the store account (`/account/orders/<no>`, "sign in or create an account with the
same email"; guest checkout does NOT create a login, the buyer registers with the order's email and the order appears). Previews: `docs/email-previews/*.html`
(regenerate: `node scripts/test-shipped-email.js --write-previews`).

## Status: LIVE on all 5 stores (19 Oct 2026)
- First live send verified by the owner (US test order, USPS): the email arrived with the carrier link, tracking number and delivery window.
- `poll-shipped-orders` runs hourly (:37) on all 5 stores and sends. **Kill switch:** repo variable `SHIP_LIVE=0` turns scheduled runs back into dry runs
  (manual `dry-run` / `live` dispatch always works). Shipments made before `SHIP_NOT_BEFORE` (go-live, 19 Oct 06:30 UTC) are never emailed.
- The platform's own "order shipped" email (`orders/fulfilled`) is switched OFF in all 5 stores with (**state: pending until the run below shows VERIFIED; update this line with the run id**) the **Set platform email notification** workflow
  (`scripts/set-email-notification-status.js`: dry run by default, read-modify-write, `VERIFIED` read-back; rollback = same run with status 1).
  Run it with event `orders/fulfilled`, status `0`, dry_run `false`; the log must show `VERIFIED` for en, es, fr, it, us.
  A buyer whose order ships between the poller going live and that switch-off can get both emails once.
- **Still ON in the platform (not replaced by us), deliberately:** `customers/sign_up` (welcome on registering), `customers/password_reset`, `orders/paid`
  (our confirmation exists only for 3D-designer orders; the platform paid email covers every order, so it can overlap for 3D orders — open decision),
  and on ES/FR `orders/cancelled`, `orders/refund`, `orders/confirm_receipt`. Current on/off per store: `cms/email-notifications/index.json` (refreshed by the dump workflow).

## How it was armed (history)
- (Before go-live) scheduled runs were dry runs until `SHIP_LIVE=1`; the default is now live (see Status). A dry run asks the endpoint to render each email (subject, whether My order link exists) and sends nothing.
- Needs the same secret as the paid poller (`MOMUTO_API_SECRET`). The endpoint change deploys to Vercel on merge to main; the workflow can only dry-run usefully after that.

## Not verified
Live send (needs merge + dry-run read + `SHIP_LIVE`), how the list row signals "shipped" (the pre-filter uses `delivery_at` / `fulfillment_status 320`; the dry run log shows
whether orders are being found), partial shipments (only the first fulfillment is emailed), email-client rendering (previews are Chromium only), courier ids other than USPS.

## One delivery estimate everywhere (22 Oct 2026)
A buyer asked "¿cuál es la buena?": the confirmation email and the My order page said 23–28 Oct (payment + 25–30 d), the shipped email said
31 Oct – 5 Nov (ship date + 10–15 d). The order had shipped late (paid 28 Sep, shipped 21 Oct), the page never switched after shipping, and
nothing told the buyer the new date replaced the old one. Fix: `lib/delivery.js` (`deliveryEstimate`) is the only derivation, used by every
email (`lib/emails.js` `orderWindow`, `emailTracking`) and by the page (`lib/order-view.js` `deliveryWindowISO`): payment + 25–30 d (fast lane
18–23) until the order has a ship date, ship date + 10–15 d after. The shipped email and the page also show the first quote ("This replaces the
estimate in your confirmation email (…)" / "Updated from the day it shipped. First estimate: …"). The page copy is generated (`scripts/build-order-view-pages.js`,
Deploy CMS Page on merge). Open: a fast-lane order keeps 10–15 d after shipping (no owner figure for priority shipping alone).
Rule: **never compute a delivery date inline; call `deliveryEstimate`.** Tests: `node scripts/test-order-view.js` (delivery + consistency cases).
