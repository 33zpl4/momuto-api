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
Every refusal is the same 404 (no probing). Limits: 30 requests/h per IP, and 8 WRONG email guesses/h per ref (successes never count; a valid link token is never limited by it).
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
