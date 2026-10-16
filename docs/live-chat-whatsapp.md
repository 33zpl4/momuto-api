# Live chat = WhatsApp (15 Oct 2026)

Owner decision after reading Nikita Bier's "24 h live support removes a confounding variable": put human chat in the product. Channel chosen: **WhatsApp** (not HubSpot), answered by the owner from the WhatsApp Business app, away message set there for out-of-hours. Placement: the 3D designer and the cart page. Not on the five stores' pages (could come later).

## What exists
- Button: `3d-configurator/static/wa-chat.js` in **design-momuto** (black pill, green WhatsApp glyph, label per language: "Any trouble? Chat with us" / "¿Algún problema? Chatea con nosotros" / "Un problème ? Écrivez-nous" / "Hai un problema? Scrivici"; icon only on phones). Loaded by `configurator.html` and the four `templates/*/cartItem.html` (`data-lang`). No third-party script, no cookie.
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
Phone layout of the button, the cart page placement, the `wa_chat_click` count, and whether the ref clone link in step 1 opens the saved design.
