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
| 名单 (号码/名字/尺码/袖长/数量/短裤尺码) | design server only. Read, in order: `--roster file.json`; the design server directly (`GET /Order/getGoods`, repo secret `DESIGN_ORDER_TOKEN` = the token constant in `OrderAction.php` on the server); momuto-api `admin-orders?action=detail` (the record the design-server webhook stored; `MOMUTO_API_SECRET`). None → red 名单未获取 row plus the platform jersey count. |

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
