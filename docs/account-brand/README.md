# Store account area — brand skin + tracking panel (19 Oct 2026)

The stores' account pages (`/account/login`, `/account/register`, `/account`, `/account/orders`, `/account/orders/<id>`) are rendered by the
store platform, not by us: white page, Jost, thin outlines, an orange-red button that is not our red. Our own "My order" page is dark / Bebas Neue /
`#c8352e`, so the two looked like different companies. This folder is the skin that makes the platform pages match, plus a tracking panel on the order page.

## What to paste (owner ruling, 19 Oct 2026)
**One file, one new entry, identical in all five stores.**

| | |
|---|---|
| **File to paste** | [`docs/account-brand/account-brand-entry.html`](account-brand-entry.html) — the whole file (a `<style>` block and a `<script>` block). Generated; do not edit it. |
| **Entry name** | `MOMUTO account skin v1` (bump the number on every re-paste) |
| **Where** | each store's platform script manager (Online Store → custom code), as a **NEW entry**: www, us, es, fr, it (5 pastes of the same content). **Not** inside the nav script `PC端你也喜欢产品调准css`: that one runs on every page, is not mirrored in this repo, and a mistake in a pasted block could break the nav. |
| **Cost on pages that are not account pages** | measured in Chromium (`scripts/test-account-brand.js`): nothing runs, no font request, no observer, no restyle. It still adds the entry's **29 KB, 4.8 KB gzipped** (minified) to every page, if the platform inlines the entry into each page (not verified). If the manager can limit an entry to certain pages, limit it to `/account/*`. For zero cost elsewhere see "Option B" below. |
| **Undo** | disable or delete that entry. Nothing else was touched. |

## Option B — zero cost on every other page (NOT built; decided 19 Oct 2026 to ship the single entry first)
Why not now: it saves about 4.8 KB gzipped per page, but it is a live write to the 5 stores, the account pages would flash white before the stylesheet arrives (they are the pages we are restyling), and it adds a deploy dependency. Revisit if the entry ever grows or page speed data says it matters.
Paste a ~0.6 KB loader instead of the 29 KB entry: on `/account/*` it adds the stylesheet and script `<link>`/`<script src>`; on every other page it does nothing and downloads nothing.
The two files would be hosted on each store's own domain by the existing static deploy (`scripts/deploy-static-files.js`, like `blog.css` / `pricing.js`), cached by the browser, versioned with `?v=`.
Pros: fastest everywhere; later CSS/JS changes ship from the repo with no re-paste (only a loader change needs the 5 pastes). Cons: it is a **live write to the 5 stores** (a push touching `static/**` auto-deploys to all stores on ANY branch; harmless while nothing references the files, but not a docs-only change), and the account pages may flash unstyled until the stylesheet arrives.

## Sources and the generated file
| file | what |
|---|---|
| `account-brand.css` | SOURCE. The dark skin. **Every selector starts with `html body:has(#customer_login, #customer_register, #account_default, #account_orders, #account_orderDetail)`**, so no other store page can change; header, footer and the announcement bar are untouched. Declares `--mo-account-skin: v1` on `:root` (the probe reads it to tell which stores have the entry). |
| `account-brand.js` | SOURCE. Order detail only: moves the platform's "Tracking" block to the top as a panel (carrier, big number, **Track package** + **Copy number**). USPS / UPS / DHL / FedEx open the carrier's own tracking page with the number filled in; any other carrier gets the platform's link (the carrier's homepage) and the copy button. Text via `textContent` only. If it never runs, the CSS alone styles the original block dark and moves it to the top of the table. |
| `account-brand-entry.html` | GENERATED paste-in file = CSS + JS in one box, **minified** (the sources stay readable here), with a header comment. |
| `preview-snippet.js` | GENERATED. The same CSS + JS for the browser console: previews the skin in YOUR tab only (gone on reload). |

Edit the two sources, then `node scripts/build-account-brand-entry.js`. It **fails** on a selector without the account scope, a `</style` / `</script` inside the content,
unbalanced braces, a missing `@import` first rule, a JS syntax error, or a missing version. `--check` (a PR check, `Check copy rules` workflow) fails when the generated files are stale.

## Paste checklist (owner)
1. **Preview:** open `preview-snippet.js` on GitHub, copy it, paste it into the browser console (F12) on a store account page (e.g. `us.momuto.com/account/orders/<order>`), also in a phone-size window. Reload = gone.
2. **Paste:** in each of the 5 stores create the new entry `MOMUTO account skin v1` with the whole content of `account-brand-entry.html`; enable it.
3. **Look:** one account page per store, logged out and logged in, on a phone too (login, register, My Account, My Orders, an order with tracking).
4. **Verify what is live:** run the probe with `css=none`, `js=none` (below): its summary says `account skin: v1` for a store that has the entry and `NOT PASTED` for one that does not.
5. **Next change:** edit the sources, bump the version in the CSS (`--mo-account-skin`), rebuild, re-paste into all 5 entries, rename them `vN`.

## Running the probe
Workflow *Probe store account area (read-only)*; until the file is on `main` it runs on every push to `claude/keen-darwin-52lbrf` that touches the script, the workflow or the CSS/JS (**remove the `push:` block in the workflow when merging**).
Inputs (after merge): `stores` (default `us`; `all` for all five), `order_path` (default the test order), `css` / `js` (what to inject; **`none` = inject nothing = check what is live**), `publish_shots` (default `false`).
Test customers come from repo secrets `STORE_<WWW|US|ES|FR|IT>_EMAIL` / `_PASSWORD` (only US is set). Screenshots are published to the throwaway branch `probe-account-shots` ONLY with `publish_shots=true`; every other run deletes that branch,
because the screenshots show the test account's name, email, address and a real package number.

## How it was tested
`scripts/probe-store-account.js` (read-only, on a GitHub runner because the sandbox cannot reach the stores) logs in as the US test customer, injects the CSS/JS into every page and screenshots desktop + 390 px.
Verified on the live US store: login, register, My Account, My Orders, Order Detail with a shipped order and a USPS number (panel on top, original block hidden, phone stacks).
The probe also follows **Track package** to the carrier: USPS answered the runner with `403 Access Denied` (bot protection on data-centre addresses). That proves nothing about the link; click it once on a phone.

## NOT tested
- Safari / iOS (the CSS uses `:has()`; a browser without it simply keeps the platform look), Firefox.
- The ES / FR / IT / EN stores (same theme, same selectors expected; the panel's button texts are translated by host, not yet seen).
- A carrier other than USPS; the real USPS page with a real number.
- The "Registered successfully" popup after sign-up (markup not captured, so it is still the platform's).
- Address Book / My Profile / Change Password and the empty-orders screen (not styled, not captured).
- That the script manager accepts a 29 KB entry with a `<style>` and a `<script>` in one box (it is already minified; if it refuses, tell us and we split it or go to Option B).

## Know before you paste
- This only changes how the **platform's** page shows what is saved in the **platform**. Our own emails and the "My order" page read tracking from our admin (separate system).
- "Buy Again" on a custom-kit order probably does not re-create the design. It is restyled, not hidden: owner's call.
- The product picture in Order Detail is an empty grey box on the platform's side (the order list shows it); not fixed here.
- The header account icon on every store links to `design.momuto.com/login`, not to the store's own `/account`; the footer "Order Status" goes to `design.momuto.com/userInfo/order`. Not changed here (decision pending, `docs/store-account-area.md`).
