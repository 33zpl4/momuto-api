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

## Arming (two stages, like the paid poller)
- Scheduled runs are DRY RUNS until repo variable `SHIP_LIVE=1`. A dry run asks the endpoint to render each email (subject, whether My order link exists) and sends nothing.
- Needs the same secret as the paid poller (`MOMUTO_API_SECRET`). The endpoint change deploys to Vercel on merge to main; the workflow can only dry-run usefully after that.
- `SHIP_NOT_BEFORE` (default 2026-10-19T00:00Z): shipments made earlier are never emailed.
- **Only after the first live send is confirmed**, switch off the platform's `orders/fulfilled` email in each store's CMS notification settings (otherwise buyers get two).

## Not verified
Live send (needs merge + dry-run read + `SHIP_LIVE`), how the list row signals "shipped" (the pre-filter uses `delivery_at` / `fulfillment_status 320`; the dry run log shows
whether orders are being found), partial shipments (only the first fulfillment is emailed), email-client rendering (previews are Chromium only), courier ids other than USPS.
