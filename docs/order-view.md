# Customer order page ("Mi pedido") — 30 Sep 2026

Read-only page where a customer of a 3D-tool order sees status, delivery window,
tracking, design renders and roster. Owner ruling: option A, one page per store.

| Store | URL |
|---|---|
| www (EN) | `/pages/my-order` |
| us | `/pages/my-order` (EN copy, USD stores) |
| es | `/pages/mi-pedido` |
| fr | `/pages/mon-commande` |
| it | `/pages/il-mio-ordine` |

## Pieces
- `lib/order-view-handler.js` (served at `/api/order-view` via a vercel.json rewrite onto `api/lead.js`, like checkout-beacon: Hobby allows 12 functions and `api/` already holds 12 — a 13th file fails the deploy) — `POST {ref, k?, email?}` → whitelist JSON. CORS only for `*.momuto.com`,
  `no-store`, `X-Robots-Tag: noindex`.
- `lib/order-view.js` — link token, `viewUrl(order)`, roster normaliser, timeline, whitelist.
- `lib/emails.js` — "See your order" button in confirmation3D, day4, day10, tracking, delivered;
  **3D orders only** (`id` starts `3d_`).
- `scripts/build-order-view-pages.js` — writes the five `cms/pages/<locale>/<handle>.json` stubs
  (never hand-edit; strings live in the script). Deploy CMS Page creates them on merge.
- `scripts/rebuild-sitemap.js` — the handles are excluded (noindex utility page; no hreflang cluster).
- Tests: `node scripts/test-order-view.js`.

## Access
1. **Email link** carries `k` = HMAC-SHA256(ref) keyed by `ORDER_VIEW_SECRET` (falls back to
   `D3_ORDER_SECRET`, then `ADMIN_TOKEN`). Rotating the secret invalidates old links; the
   page then falls back to 2.
2. **Ref + email** form. Case-insensitive email match.
Every refusal is the same 404 (no probing). Limits: 30 requests/h per IP, 8 email attempts/h per ref.
Only `active | shipped | delivered | backfill` orders are visible (never test/excluded). `backfill` = a real
paid order ingested >14 days after payment (no lifecycle emails were sent; added 30 Sep 2026 after buyer 3f4wddo3vw
could not open a 10 Sep order).

## What is shown / never shown
Shown: our `ref` (primary), store order no. (secondary), first name, timeline, window
(25–30 d, fast lane 18–23 d, from `paidAt`; rule 6), tracking, front/back renders (https only),
roster (columns appear only when data exists), "¿Algo no está bien?" mailto to info@momuto.com.
Never: email, address, phone, prices, totals. No edits in v1.

Roster source: `order.designs[].players`, else the design server `getGoods` (6 s timeout),
else "roster is being loaded". Size suffixes (`· SHORTS L`, `· JERSEY ONLY`, `· LONG`, `· POLO`)
are parsed. A plain size does not say whether shorts exist; it is resolved from the order's billed
shorts total (`extras.shorts`) only when that answer is unique, otherwise no shorts claim is made.

## Deploy order
1. Merge → Vercel deploys the API. Optionally set `ORDER_VIEW_SECRET` in Vercel (no secret set
   anywhere = no `k` in links; customers use the form).
2. The same merge triggers Deploy CMS Page: creates the five pages (check the run is green).
3. Emails start carrying the link immediately (they only send at lifecycle events).

## Not verified from the sandbox
Live rendering inside each store theme (sandbox cannot reach the stores). Tested here with a mock
API in Chromium at 390 px wide. After deploy, open one real link per store and check: title hidden,
full-bleed background, `<script>` allowed by the CMS, images load.

## "Not found" for an order that exists on the platform
The page reads OUR order record (Vercel KV), not the platform's. An order the design-server webhook / poller
never delivered (e.g. paid before the poller existed) has no record, so the page answers "not found" for the
right ref + email. Check with workflow "Order email (manual ingest / resend)" → action `find`. To add it
WITHOUT emailing the buyer: same workflow, action `ingest-and-send` with **silent = true** (email required,
name optional, `paid_at` = real payment date, `plant_order_no` = store order no). Do not use the non-silent
ingest on an old order: it sends the confirmation and enrols the lifecycle, so day-4/day-10 mails would go out at once.
Add `tracking_number` / `tracking_url` / `shipped_at` for an order that already shipped (status becomes `shipped`, still no email)
and `extras` as JSON, e.g. `{"shorts":0,"longSleeves":1}` (qty = jerseys only).

## "Share your new kit" button (18 Oct 2026)
Orders paid after the webhook patch carry each design's `configId` + `suit` and the buyer's `uuid` (design-momuto `server-patches/README.md` §18; stored on
the order as `designs[].configId` and `uuid`). `lib/order-view.js` `cardUrl(order, design)` turns them into the 3D designer link that opens the design with the
picture card ready (`?card=1`, design-momuto `static/share-card.js`): `configId` + `useGetShare=true` + `u` is the copy-on-open primitive of the share page's
"Edit this kit in 3D", so the original is never overwritten. Ids must match `[A-Za-z0-9_-]{1,64}`; no suit or uuid means no link (never a guess).
- **Where:** a block in the confirmation and day-4 emails (`cardBlock` in `lib/emails.js`, EN/ES/FR/IT, outline button under the renders) and a "Share your new kit" card
  on the order page between the design renders and the roster (`cardUrl` is in the `/api/order-view` JSON per design). Older orders and non-3D orders show neither.
- **Privacy:** the link carries the buyer's design-server uuid (the tool's anonymous session id, the same `u` a share link has). It reaches the buyer by email and the
  token-/email-gated page JSON only; `publicOrder` still exposes no email, address or amounts.
- **3D-links inventory:** the real links are built at runtime by `cardUrl()` (ids come from each order), so `scripts/audit-3d-links.js` cannot see them; the one row it records for them
  (`configId=c4f9a2b7 … share=u8k2p9x1`, `scripts/test-order-view.js`) is the test fixture of that shape. If the launch parameters ever change, change `cardUrl()` as well as the inventory.
- **Counters:** the tool beacons `card_open` / `card_made` / `card_share` / `card_download` (scorecard rows "share image: …"); opened-from-email vs from-the-page is not separated.
- Tests: `node scripts/test-order-view.js` (17). **Not verified:** a live email/page link opening a real design (needs the webhook deployed and one paid order), phones' share sheet.

See also `docs/store-account-area.md`: this page is one of THREE order surfaces (the platform's store account and the design server's `/userInfo` are the others); tracking is entered in the platform and in our admin separately.
