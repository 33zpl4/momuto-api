# Warehouse production sheet (生产单)

The factory used to hand-build one Excel per order: customer/shipping block,
the front/back renders of the design, and the per-jersey spec (sleeve, size,
number, name). Slow and error-prone (the 11 Sep 2026 sample had a stray
character in the zip field and a name that did not match the render).
`scripts/build-warehouse-sheet.js` generates it, in Chinese, from the same
sources the factory copied from.

## Sources (read-only)

| block | source |
| --- | --- |
| 订单ID, 姓名, 地址, 国家, 电话, 邮编, 邮箱, 留言, 支付方式, 货运方式/运费, 总金额, 下单/付款时间 | store platform `GET /orders/ordernumber/<no>` (5 tokens) |
| 正面/背面 renders | the €0 "Your custom design — order <ref>" line → `GET /products/<id>` images |
| 名单 (号码/名字/尺码/袖长/数量/短裤尺码) | design server only. Read, in order: `--roster file.json`; the design server directly (`GET /Order/getGoods?order_no=<ref>` — **unauthenticated** on the server, its Token constant is unused; `oem_no` is never sent because the endpoint writes `plant_order_no` when it is); momuto-api `admin-orders?action=detail` (the record the design-server webhook stored; `MOMUTO_API_SECRET`). None → red 名单未获取 row plus the platform jersey count. |

Cross-checks printed in red on the sheet and in the email subject (⚠ 需核对):
roster qty ≠ platform qty; roster long sleeves ≠ platform "Long sleeves"
add-on qty; platform `is_test`.

## Running

- Daily at 05:00 China (with the order digest, `check-platform-orders.yml`):
  every order paid in the last 25 h → one xlsx each, emailed to
  `WAREHOUSE_EMAILS` (repo variable; default info@momuto.com +
  ilovebillxie@hotmail.com) and kept 90 days as the run artifact
  `warehouse-sheets`.
- On demand: Actions → "Check platform orders" → mode `sheet` + order number,
  or `sheet-recent` + hours.
- Requires `RESEND_API_KEY` to email; without it the xlsx is still in the
  artifact.

## Finding, 11 Sep 2026

momuto-api's stored records stop at 28 Aug 09:16 (5t6lf7enmq): the
design-server → momuto-api webhook path delivered NOTHING for two weeks while
the platform recorded ~35 paid orders. Roster via that path is therefore
unreliable by construction (webhook sweeps) and was also silently down. The
direct design-server read is the primary source now; the momuto-api record is
the fallback. `api/order-3d-paid.js` backfills the roster into a record the
poller created without one.

## Confirmation-email poller (owner ruling 11 Sep 2026)

`poll-paid-orders.js` skips anything paid before 2026-09-11 15:30 UTC
(`POLL_NOT_BEFORE`): customers from the silent-webhook fortnight are not
emailed retroactively. Going live = repo variable `POLL_LIVE=1`.

## Security note (owner, 11 Sep 2026)

`OrderAction::getGoods` on design.momuto.com has no auth check and answers
any `order_no` with the customer's roster (names, numbers) and renders; with
`oem_no` it also overwrites `plant_order_no`. Refs are 10 random chars, so it
is not enumerable, but a shared-secret check is NOT possible without breaking the store: the
customer's browser calls it from the checkout scripts
(`store-script-*-checkout-*.html`), so any token would be public. The
workable hardening is scoping by the caller's own `uuid` (store pages send
it) plus a server-side secret for the runner — but `uuid` resets on re-login
(see order-pipeline.md), so that needs a test order before deploy. Left as
a follow-up; this tool only reads.

## Known gaps

- Orders the hourly poller ingested before the design-server webhook arrived
  have `players: []` in the momuto-api record (the later webhook dedups and
  never backfills the roster). Until the poller is armed and the record is
  merged, those sheets show 名单未获取. The permanent fix is a small
  authenticated read on the design server (`/Order/getGoods` already exists,
  token not in this repo) — owner-side.
- The warehouse's own carrier line (e.g. 美国专线小包一衣0.3KG) is theirs to
  fill: yellow 仓库备注 cell.
- LibreOffice is unavailable in the sandbox, so the layout was verified by
  cell dump only; the first live run is the visual check.

## Jersey-only kit players (14 Sep 2026)

A kit player can be ordered without shorts (design-momuto component billing,
README §8). The roster row carries `noShorts: true` and the size ends in
`· JERSEY ONLY`; the sheet prints **无短裤** in the 短裤尺码 column so the factory
does not cut shorts for that player. Shorts count on the platform order =
kit players minus jersey-only players.

## Polo-collar designs (15 Sep 2026)

A polo collar is a property of the design (not a per-player choice): the store
product title carries a marker (`Polo Collar` / `Cuello Polo` / `Col Polo` /
`Colletto Polo`, README §10 in design-momuto) and checkout bills one unit of
the per-store "Polo collar" add-on product per jersey. The roster row carries
`collar: true` and the size ends in `· POLO`; the sheet prints **POLO领** in
the 领型 column, adds `（POLO领 N 件）` to 总数量, and warns when the roster
count differs from the platform's "Polo collar" line.

## Fast-lane orders (23 Sep 2026)

The per-order "Fast lane" product (titles: Fast lane / Vía rápida / Voie
rapide / Corsia veloce; €59 / $69) is detected by title in `parseLines`
(`fastLane: true`, not counted as a jersey). The sheet's first header row and
the email subject carry `⚡ 加急 FAST LANE — 优先生产 + 优先发货` so the
factory prioritises the batch. The same flag reaches the customer emails as an
18–23 day window (design-server webhook `fast_lane` / poller title match).


## Rows with no size (order 2yc9cfywz1, 5 Nov 2026)

A shorts row reached the factory with **no size and no number**, qty 1: in the 3D flow jersey and shorts are separate cart lines, "Add
player" creates a row whose size select sits on the disabled "-", and nothing checked size (the pre-checkout gap modal skipped
non-jersey lines). Fixed at the source in the cart (design-momuto `server-patches/README.md` §19: checkout refused while any row has no
size). Belt here: `build-warehouse-sheet.js` prints a red **缺尺码** in the size cell and adds a ⚠ line per sizeless row (the email subject
gets 需核对). Not exercised on a real sizeless order yet.

## Orders paid outside the platform (Stripe payment link) — procedure, 6 Nov 2026

Order 2026110633635073 (ES, design 78nmn3osnc, €349.70) was paid by a Stripe payment link. The platform had created the order at
checkout (financial_status 200, pay_at 0) and **marking it paid in the store admin did not change what the API exposes** (still 200,
`pay_at` 0 on two reads). Everything automated keys on 230, so: no confirmation email (poller), no factory sheet (daily run), and the
design server's pay status stays unpaid. What was done by hand, in this order:
1. `find-order.yml` (needle = platform order number) → store, lines, totals, the preview lines' render URLs (`probe-product-images.yml`
   prints each stored image with HEAD/GET status).
2. `admin-order-email.yml` action `find` (needle = the 3D ref) → "No stored order matches" = never reached the pipeline.
3. `admin-order-email.yml` action `ingest-and-send` with `order_no` (3D ref), `plant_order_no`, `email`, `name`, `lang`, `qty` (jerseys),
   `total`, `paid_at` (ISO day), `image` / `image_back` (render URLs), `extras` (e.g. `{"shorts":13}`) → record `3d_<ref>` + the
   confirmation email + the day-4 / day-10 / tracking lifecycle. Result read: `ingested: true, sent: true`.
4. **Factory sheet: manual** (`check-platform-orders.yml`, mode `sheet`, order number), or tell production directly. For this order the owner
   informed the production team by hand (7 Nov 2026) and no sheet was run.
**The platform side cannot be set from here** (the order API is read-only, `docs/oemsaas-api-notes.md`); the design-server side can: the paid poller's
`POST design.momuto.com/pay/callback {order_no, payStatus:'success', type:'oem', plant_order_no}` flips the order to 已支付 in manage.momuto.com (idempotent,
design-momuto `server-patches/README.md` §12). Tool: **`mark-design-paid.yml`** (dispatch-only, `scripts/mark-design-paid.js`): guards = the order exists on the
design server and momuto-api holds it with the confirmation SENT (so a late platform webhook dedups); live needs the box ticked and the order_no typed again; it
sends no email. Run for this order on 7 Nov 2026 (run 42359724176, answer `success`); the 已支付 flag itself is read by eye in manage.momuto.com.
The abandoned-checkout mail skips such customers (`lib/lifecycle-mail.js` `paidSince` looks for a paid order from the same email in KV).
