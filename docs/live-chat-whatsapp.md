# Live chat = WhatsApp (15 Oct 2026)

Owner decision after reading Nikita Bier's "24 h live support removes a confounding variable": put human chat in the product. Channel chosen: **WhatsApp** (not HubSpot), answered by the owner from the WhatsApp Business app, away message set there for out-of-hours. Placement: the 3D designer and the cart page. Not on the five stores' pages (could come later).

## What exists
- Button: `3d-configurator/static/wa-chat.js` in **design-momuto** (black pill, green WhatsApp glyph, label per language: "Questions? Chat with us" / "¿Dudas? Chatea con nosotros" / "Une question ? Écrivez-nous" / "Hai domande? Scrivici" since 16 Oct, was "Any trouble?"; phones since 17 Oct: same labelled pill, bottom-left; in the tool it shares the bottom bar with ADD TO CART, which moves right, and the label ellipsizes before it can reach that button; was icon-only, floating). The prefill is "Hi MOMUTO, I have a question about…" (cart: "…about my order."); on the US store it ends with " (US)" so the bot quotes dollars (cart: host `us.`; tool: `fromUrlHost`, then referrer, both unverified). Loaded by `configurator.html` and the four `templates/*/cartItem.html` (`data-lang`). No third-party script, no cookie.
- It opens `https://wa.me/34614625408?text=<prefilled message>`; the message is in the page language and ends with `(ref. del diseño: <configId>)` / `(design ref: <configId>)` in the tool.
- The tool's own "Support" button was removed (`useSupport:false`).
- Count: the beacon `wa_chat_click` (`lib/event-beacon.js` EVENTS) shows as "WhatsApp chat clicked (help-seeking)" in the weekly scorecard (`docs/scorecard.md`). Outside the funnel on purpose.

## A message arrives with a design ref - how to look at that design
The `configId` is minted when the customer ENTERS the tool, not when they save. It leads to a design only if they saved or ordered; otherwise the tool shows the collection default.
1. **View a copy** (never changes the customer's config; for es use `es.momuto.com`, check `suitName`, e.g. `mamuto3suit1`):
   `https://design.momuto.com/goodsInfoSave?uuid=check1&sysType=oem&fromUrlHost=https%3A%2F%2Fes.momuto.com&collectionName=configId%3D<REF>%26suitName%3Dmamuto3suit1`
   A default design or an error means nothing was saved under that id (or the suit name is wrong). Not verified from the sandbox (cannot reach the stores).
2. **If they ordered:** order admin `GET /api/admin-orders?action=find&q=<order ref | platform order no | email>` (it does not search by configId); the order page shows the renders.
3. **Otherwise** ask the customer to press Save/Share and send the link.
Background: design-momuto `docs/product-page-linking.md` ("How configIds actually work").

## Not verified
Phone layout of the button on a real device (checked only in headless Chromium at 360/390 px, en/es/fr; French truncates to "Une question ? …" at 360 px), the cart page placement on phones (the cart preview has no theme CSS), the `wa_chat_click` count, and whether the ref clone link in step 1 opens the saved design.

## The assistant (bot) — built 16 Oct 2026, NOT live until the Meta setup below is done
Why: 3 "what does it cost" chats in <24 h, all people exploring the tool (a design ref does NOT mean "stuck"). Decision: **Meta Cloud API direct, rule-based, no LLM** — $0 platform fee, answers are the FAQ text, so there is one set of numbers. SendPulse/Wati/etc. would hold a second copy of prices; Twilio moves the number; unofficial QR tools risk a ban of the only customer line.

**Flow.** Customer message -> `lib/wa-bot.js` (pure) -> reply. First message gets 3 buttons (Prices / Delivery time / More topics) plus "type *person* any time"; "More topics" is a 10-row list (prices, delivery, extras, fabric, printing & logos, sizes, "I have a design in mind", returns, opening hours, talk to a person). Free text is matched on keywords in en/es/fr/it (`KEYWORDS` in `lib/wa-bot.js`; when a real message is missed, add its word there and a case in `test/wa-bot.test.js`). Every answer is followed by [More topics] [Talk to a person].
**Answers** come from `faq/faq.<locale>.json` via `node scripts/build-wa-bot-answers.js` -> `lib/wa-bot-answers.json` (never hand-edit; the PR check runs `--check`; the script asserts the FAQ item order so a reshuffled FAQ fails loudly).
**"I have a design in mind"** (owner, 16 Oct): people arrive with a clear jersey in mind. The answer says build it your way in the 3D designer first (you may end up liking it more), and if it cannot be done exactly there the 100% custom design service: deposit line from the FAQ (€15 / $15, credited in full on orders of 5+ jerseys), then a link to that store's custom design page (`request-custom-kit-design` en/us, `solicitud-de-diseno-personalizado`, `demande-de-design-professionnel-de-maillots`, `richiesta-design-personalizzato`). The framing sentences are in `CUSTOM_INTRO` in `scripts/build-wa-bot-answers.js` (a proposal; the owner is polishing the wording).
**Handoff** to a person on: the button/row, "person/human/persona/personne/qualcuno…" or a complaint word (problem, damaged, missing, tracking…), any image/voice/document, or two unanswered messages in a row. The bot then says "a person from the studio will reply here, generally within 1–2 hours" (team on) or "the studio opens tomorrow at 8:00 (Madrid time)" (off), and stays silent for 12 h counted from when the team is on. During closed hours after a handoff it still answers the basics. If the owner replies from the Business app (coexistence echo) the bot mutes for 12 h too.
**Hours** (owner, 16 Oct): Mon–Fri 08:00–20:00, Sat 08:00–12:00, Europe/Madrid, `lib/wa-hours.js`. US customers see their Eastern time in brackets, DST-correct ("Monday at 8:00 (Madrid time) [2:00 AM ET]"). The "1–2 hours" promise is the owner's wording; Saturday 11:30 still says it.
**Design ref** is kept in the customer's state only; it never triggers a handoff. **Privacy:** no message text stored; per customer {lang, miss count, mute window, ref} for 2 days under a keyed hash of the phone number; counters `wa_bot_greet|answer|handoff|miss|menu` as HyperLogLog + totals under `ev:<week>:*` / `evn:*` (same keys the scorecard reads; not yet added to `docs/scorecard.md`). The privacy policy needs a line (owner's call): chats pass through our Vercel function.
**Plumbing.** `/api/wa-webhook` is a vercel.json rewrite onto `api/stripe-webhook.js?type=wa-webhook` (api/ is at the 12-function cap; that function already reads the raw body for the HMAC check) -> `lib/wa-webhook-handler.js`. Verifies `X-Hub-Signature-256`, dedupes by message id (Meta retries), always answers 200 after a verified delivery. **Dry run is the default**: without `WA_LIVE=true` the handler logs what it would send and sends nothing.

### Go-live runbook (owner steps first)
1. **Gating check:** can +34 614 625 408 stay on the Business app AND get the Cloud API ("coexistence")? Availability for Spain/EU and its feature limits are NOT verified. If not available: register a NEW number for the bot, and make "Talk to a person" there open `wa.me/34614625408` instead of muting.
2. Meta developer app + WhatsApp product, onboard the number (Embedded Signup for coexistence). Create a permanent system-user token.
3. Vercel env (production): `WA_VERIFY_TOKEN` (any random string), `WA_APP_SECRET`, `WA_ACCESS_TOKEN`, `WA_PHONE_NUMBER_ID`, optional `WA_GRAPH_VERSION` (default v23.0 — check Meta's current one). Leave `WA_LIVE` unset.
4. Merge, then in the app's webhook config set callback `https://momuto-api.vercel.app/api/wa-webhook` + the verify token, subscribe to `messages` (and the echoes field if coexistence). Message the number from a test phone; the Vercel log must show `[wa] DRY RUN would send …` for each message.
5. Read that log, then set `WA_LIVE=true` and redeploy. Test: prefill (EN, ES, US), a price question, "person" in hours and out of hours, a photo, then reply from the phone and confirm the bot goes quiet.
6. Watch the first days' logs (`[wa] event=… lang=…`, no phone numbers) for `miss`/`handoff:miss` rates; those messages are the next keywords.

### Not verified (sandbox cannot reach Meta or the stores)
Coexistence availability and the echo field name/shape (`smb_message_echoes`), Graph version, list-message rendering on phones, the `fromUrlHost`/referrer US detection in the tool, that a Business-app reply really mutes the bot, translations of the new UI strings (es/fr/it) by a native reader.
