# Weekly scorecard

Built 12 Oct 2026. One loop, every Thursday (Search Console data lags ~3 days; Thursday is the first day the whole previous week is in): **measure → read the right baseline → change one thing → measure again.**
Output: `metrics/WEEKLY.md` (latest), `metrics/weekly.json` (history, in git), and the run summary of **Weekly scorecard**.

## What it records
| Block | Source | Notes |
|---|---|---|
| Funnel: 3D designer opened → design saved → **added to cart** → cart page viewed → CHECKOUT clicked → hand-off OK → paid | anonymous counters from `/api/event` + `checkout_beacons` + orders | distinct **sessions** (HyperLogLog), no cookie, no email, no account |
| Orders | KV orders (`admin-orders?action=metrics`) | orders, units, revenue by currency, fast-lane count, median days paid→shipped / paid→delivered |
| Leads | KV leads | deposit intents, deposits paid, requests |
| Search | Google Search Console API | clicks, impressions, CTR, average position — total and per store host; top queries; **backfills 16 months on the first run**, so year-over-year exists from day one |
| Health | repo | copy-rules baseline (should shrink), failed workflow runs in the last 7 days |

Partial Search Console weeks are never stored (they would read as a false drop). The funnel counters start counting the week the beacons ship; earlier weeks show "—".

## Reading it without fooling yourself (seasonality)
- A week is never judged alone. Each metric shows **vs last week**, **vs the 4-week average**, and **the same ISO week last year**.
- `metrics/season.json` holds the owner's seasonal calendar (e.g. July–September high because tournaments start in September and teams order ahead;
  October normal/lower) and a list of our own changes. Edit it whenever something moves the numbers on purpose.
- A metric is flagged only if it is **>25% under its recent level for 3 weeks running**. If year-over-year is flat or up, the flag says "seasonal" instead.
- Two data points are noise. Cart reach and orders are small numbers: read 4-week trends.

## One-time setup for Search Console
1. Google Cloud → create a service account, download its JSON key.
2. Search Console → Settings → Users and permissions → add the service account's email as a **Restricted** user on the domain property.
3. GitHub → repo secret `GSC_SERVICE_ACCOUNT` = the whole JSON. Optional repo variable `GSC_SITE` (default `sc-domain:momuto.com`; use `https://www.momuto.com/` style for URL-prefix properties).
4. Run **Weekly scorecard** once by hand; the first run fills 16 months of history.

## Beacons (what is sent, from where)
`tool_open`, `design_saved`, `cart_added` (3D designer), `cart_viewed`, `checkout_clicked` (cart page), `wa_chat_click` (the WhatsApp button on tool + cart; help-seeking signal, outside the funnel): `{event, sid, store}` via `navigator.sendBeacon` to
`/api/event`. `sid` is a random id kept in `sessionStorage` for the visit. It is stored only as a HyperLogLog and a raw counter per ISO week, so it can be
counted but never read back. Decide with your privacy adviser whether this needs a notice in the cookie/privacy text (it sets no cookie and holds no personal data).

## Extending it
Add the metric to `admin-orders?action=metrics` (or a new collector in `scripts/weekly-scorecard.js`), add a `row(...)` to the report, add a line here.
