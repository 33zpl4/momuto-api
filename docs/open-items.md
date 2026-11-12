# Open items — owner-side and pending (updated 7 Nov 2026)

One place to read at session start. "Not re-confirmed" = told in an earlier session, status not checked since.

## Waiting on the owner
| item | state | detail |
|---|---|---|
| **URGENT — Request indexing for 2 pages that Google folded into the thank-you page** | **pending** | GSC → URL Inspection → *Request indexing*: `www/pages/design-your-own-soccer-jersey` (was ~40 clicks/day, ~0 since 6 Nov) and `www/pages/ai-concept-to-real-kit`; after the noindex run (`docs/us-indexing-2026-11.md`). Also request the ES hub `equipaciones-futbol-personalizadas` and the IT price page `prezzi-maglie-calcio-personalizzate` (never indexed). Canonical watch (daily) shows when it is fixed |
| GA4 connection (optional) | pending | set repo variable `GA4_PROPERTY_ID` and add the GSC service account as Viewer on the GA4 property; the scorecard picks it up on Thursday |
| PageSpeed field data (optional) | pending | a free Google Cloud API key (PageSpeed Insights + CrUX) as secret `PSI_KEY` gives real-user Core Web Vitals; the lab run (mobile 40–50) is in the speed notes |
| Send the wave-1 outreach (3 emails) and paste the GSC → Links "Top linking sites" export | **pending** | messages ready in `docs/outreach-roundups-2026-11.md`; tracker + wave 2 candidates in `docs/outreach-log.md`. No tool counts referring domains: the GSC UI export is the first number |
| Follow up US deposits paid 6–10 Nov with no brief | **pending** | US brief form was dead 6 Nov 19:01 → 10 Nov 07:47 UTC (`docs/incident-2026-11-10-us-request-form.md`); check Stripe (US $15 link) for deposits in that window without a brief and send each the "form fixed — or just reply with the details" note. Fix verified: probe run 42777830732, 10/10 |
| Paste the five hero blocks (design request leads) | **pending paste** | `pages/homepage/hero.<locale>.html`, merged 6 Nov; the rule for swapping back: `docs/homepage-hero-lever.md` |
| Submit the new/updated URLs in Search Console | pending | tiered list: `docs/content-round-2026-11.md` (~10 per day) |
| Coupon creation via the platform API | **waiting on the platform's answer** | if yes: per-order `KIT10-…` codes with a real 14-day expiry; if not: one shared code per store (`REORDER_CODES`). Lifecycle flows stay in dry run until then: `docs/lifecycle-emails.md` ("ON HOLD") |
| Forward one platform abandoned-cart email | on hold with the above | holds the resume-checkout link; until then the button goes to `/cart` |
| Factory: confirm 4XL; send flat chest widths per size | open | `docs/size-guide.md` — tell them before the first 4XL order |
| Review price lock: define the end rule | open | written as "rest of the season"; owner may mean 12 months from delivery |
| Hoodies / training wear | strategy only | ask the factory for a hoodie and a training tee: unit cost at 10 and 20, minimum, lead time; then pre-sell to past teams with one line in the reorder/delivered mails before building anything |
| Fast lane more visible | offered, undecided | named in the abandoned mail; cart and price pages are the next places |

## Closed
- **Order 2026110633635073 (ES, Stripe link, €349.70):** confirmation email sent 6 Nov (ingested as `3d_78nmn3osnc`); the owner informed the production team by hand on 7 Nov, so no factory sheet was run. The platform still shows the order unpaid — expect it to stay out of the daily sheet and the poller (`docs/warehouse-sheet.md`).

- **Order 2026110633635073, design side:** marked paid on the design server on 7 Nov 2026 with `mark-design-paid.yml` (run 42359724176, callback answered `{"code":200,"data":"success"}`, no email sent: the record still shows only `confirmation`). The owner is to confirm 已支付 in manage.momuto.com. **The platform side stays unpaid** (read-only API): ask the platform why the admin's manual mark does not set `financial_status`.

## From earlier sessions — not re-confirmed
- Roll the live FR Stripe secret key (printed once into a public Actions log on 4 Nov, run deleted within minutes) and paste the new one in the FR admin.
- One real save + add-to-cart after the per-visit configId change (live probe 41888393716 showed all five checks pass; the owner's real test was requested).
- Bank transfer via Stripe Bank Transfers: webhook change in `api/stripe-webhook.js` (handle `async_payment_succeeded` / `_failed`) only on the owner's go, before enabling it.
- Iconic tees cross-sell: waiting for the logistics info and a yes on the team-order line. Outreach emails to roundup sites: the owner sends them.

## Not verified live (deployed, never opened)
Cart: blank-size refusal and 4XL options; MOMUTO mark shade and the shorts mark; the size-guide and FAQ pages; the gallery titles in the SERP;
the ES maker page. The sandbox cannot reach the stores; a screenshot or a manual look closes each.

## Dated reads
- ~**20 Nov 2026:** AI radar re-run (the content of 6 Nov will have been crawled; the 3 Nov analysis is the baseline).
- **Week of 9 Nov** onward: the scorecard's `design saved` row is trustworthy (beacon fixed 6 Nov, `docs/scorecard.md`).
- Two weeks per hero setting before judging (`deposit paid`, `paid 3D orders`, `3D designer opened`).
