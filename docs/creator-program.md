# Creator program (pilot) — 25 Oct 2026

Owner decision 25 Oct 2026, after a US customer's TikTok of his team's kits took off and he asked for an affiliate link. Pilot, not a program yet: **a personal code per creator, $15 off orders of 10+ jerseys, 5 % commission to the creator.** The owner controls how many creators get a code and for how long; review after the first window.

## The offer (public wording vs what is set in the store)
| | Customer reads | Set in the store admin |
|---|---|---|
| Discount | "$15 off orders of 10+ jerseys" | $15 off, **minimum order $259** (10 jerseys at $25.90). A value minimum also admits 9 jerseys ($278.10 at $30.90 each): accepted on purpose, honour it, never argue. If the coupon system offers a minimum QUANTITY, prefer that. |
| Use | one use per customer | one use per customer, valid 60 days |
| Stacking | (not mentioned publicly) | **stacking ON** (owner, 25 Oct 2026): the platform's quantity-price promotion (the 5–9 / 10–19 / 20+ ladder) only applies when the coupon may stack with it. The ONLY exclusion is other codes: one code per order. |
| Deposit | unchanged: the design deposit is credited in full on orders of 5+ jerseys — do not word the coupon so it reads as the same $15 | |
Euro stores (if ever): same shape, amount to be ruled by the owner; this pilot is the US store (code created on us.momuto.com).

With stacking on, the coupon can also combine with any other automatic promotion on the cart: the quantity ladder is intended, but the seasonal 10 % selection is a second automatic discount that the code may now sit on top of, and Editions are not excluded by the coupon itself. Watch the first orders (the report flags the total, not the stack) and, if it happens, decide whether to accept it or to exclude those products in the coupon's product scope. The fast lane is a separate paid line, not a discount, so it is unaffected.

What the offer costs (US ladder from `docs/us-launch-status.md`; commission = 5 % of the order after the discount, shipping excluded): 10 jerseys $259 → $15 + $12.20 = $27.20 (**10.5 %**); 14 jerseys $362.60 → $32.38 (8.9 %); 20 jerseys $438 → $36.15 (8.3 %). Compare with the margin at the 10+ tier before widening; levers: commission 4 %, discount $10 on the 10–19 tier, shorter window, fewer creators.

## Creator terms (one page — paste into a CMS page or send as text)
> **MOMUTO creator code — terms**
> 1. You get a personal code. Anyone who enters it at checkout on us.momuto.com gets $15 off an order of 10 or more jerseys. One use per customer, valid until the end date we agree.
> 2. You earn 5 % of the order total after the discount, excluding shipping, on orders that are paid, delivered and not refunded or cancelled. Orders that do not qualify for the discount earn nothing. Only one code can be used per order.
> 3. We pay once a month for orders delivered in the previous month, by the method we agree. We send you the list of orders behind the number.
> 4. **Disclose the link.** In every video or post that promotes the code say it is an affiliate/partner code (#ad or #partner, and say it out loud in videos). This is required in the US.
> 5. Say only what is true about the kits: no invented statistics, no comparison claims we have not agreed, no use of club or brand names or logos on our behalf.
> 6. We can change the offer or end the code with 14 days' notice, and stop it at once for misuse. Orders already placed keep their terms.
> 7. Share your code anywhere you like: videos, comments, your bio, forums. Do not submit it to coupon or deal-aggregator sites, and do not run paid ads on our brand name.

Reply to send him (WhatsApp, first message): thank him, say yes, give the offer in one line, ask where he wants to be paid (just the method, no bank details in chat), and say the code will arrive once the store has it. Do not promise reporting beyond "I send you the list each month".

## Setup checklist (owner, store admin of us.momuto.com)
1. Create the coupon: code (e.g. his name + 15), $15 off, minimum order $259, one use per customer, 60 days, **stacking on** (needed for the quantity promo; only other codes are incompatible).
2. **Test orders before announcing** (use the real checkout, then cancel/refund): 8 jerseys → code refused; 10 jerseys → accepted; 9 jerseys → accepted (the known leak). On the 10-jersey test check that the quantity price ($25.90 each) AND the $15 are both applied.
3. Add him to `creators/creators.json` (`active:true`, dates). Until then `--code <CODE>` works without the file.
4. Run **Creator commission report** (workflow, `probe=true`, `code=<CODE>`) once after the first test order and read the log: it prints the raw order object that carries the code. Pin the field names for coupon, shipping and delivery state into `scripts/creator-commission-report.js` (candidate names today), and record them in `docs/oemsaas-api-notes.md` ("Orders (read)").

## The report
`node scripts/creator-commission-report.js [--days 60] [--code CODE] [--probe]` — workflow **Creator commission report**, read-only, result in the run's Summary tab.
- Finds the code by searching the whole order object, so it works whatever the field is called.
- Payable = paid AND not cancelled AND not refunded AND delivered. If the delivery state cannot be read it says "paid — confirm delivery" and does NOT count it as payable.
- Base = order total minus shipping; if no shipping field is found it says so and uses the total (overstates the commission, so check before paying).
- Orders outside the creator's start/end window are listed, not counted. An order whose total + discount is under the minimum is flagged.
- Tested only against a mocked orders list (coupon in five different field names, cancelled, refunded, not delivered, other code). NOT run against the live API.

## Not verified
- Whether the coupon system supports a minimum quantity, a one-use limit, an expiry and no-stacking (owner to confirm in the admin).
- Where the coupon code, shipping and delivery state live in the platform's order object (first `probe` run answers it).
- Whether the order list returns old enough orders for a monthly run (`--days` 60; the paging stops when `page` is ignored).

## Decisions log
- 25 Oct 2026 (later): the "code is yours alone / no public coupon" clause was wrong for a creator whose job is to spread the code; replaced by: free to share to his audience, but no coupon/deal-aggregator listings and no paid ads on the brand name. Payout by bank transfer (owner told the creator); bank details are collected by email at the first payout, never in chat.
- 25 Oct 2026 (later): stacking enabled so the quantity promo applies; only other codes are incompatible. Terms page unchanged (it never promised exclusions).
- 25 Oct 2026: pilot with one US creator; public wording "10+ jerseys", store minimum $259; 5 % commission after discount; start with two or three creators at most.
