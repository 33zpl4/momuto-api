# Store account area — brand skin + tracking panel (19 Oct 2026)

The stores' account pages (`/account/login`, `/account/register`, `/account`, `/account/orders`, `/account/orders/<id>`) are rendered by the
store platform, not by us: white page, Jost, thin outlines, an orange-red button that is not our red. Our own "My order" page is dark / Bebas Neue /
`#c8352e`, so the two looked like different companies. This folder is the skin that makes the platform pages match, plus a tracking panel.

| file | what |
|---|---|
| `account-brand.css` | the dark skin. **Every selector starts with `html body:has(#customer_login, #customer_register, #account_default, #account_orders, #account_orderDetail)`**, so no other store page can change. Header, footer and the announcement bar are untouched. |
| `account-brand.js` | order detail only: moves the platform's "Tracking" block to the top as a panel (carrier, big number, **Track package** + **Copy number**). USPS / UPS / DHL / FedEx open the carrier's own tracking page with the number filled in; any other carrier gets the platform's link (the carrier's homepage) and the copy button. Reads text with `textContent` only. If it never runs, the CSS alone styles the original block dark and moves it to the top of the table. |
| `preview-snippet.js` | CSS + JS in one paste for the browser console: previews the skin in YOUR tab only (gone on reload). Regenerate after editing: see below. |

## NOT LIVE until pasted
These files are under `docs/` on purpose (nothing in `docs/` deploys; anything under `static/` auto-deploys to all stores). Merging this folder changes no store.
To go live, paste into the stores' custom code, the script that already holds the nav CSS (CMS name `PC端你也喜欢产品调准css`, all stores, `docs/store-theme-css.md`):
1. the **CSS** (the `@import` line must be the very first thing of a `<style>` block, or load the same URL with a `<link>`);
2. the **JS** inside a `<script>` tag.
Keep this folder as the source of truth and re-paste after any edit. Ask for a change by editing the file here, not the live script.

## Paste checklist (owner)
1. Open `docs/account-brand/preview-snippet.js` on GitHub, copy it, paste it into the browser console (F12) on a store account page (e.g. `us.momuto.com/account/orders/<order>`): you see the skin in your tab only. Reload = gone.
2. Happy with it? Platform admin → the stores' custom code → script `PC端你也喜欢产品调准css` (all stores):
   - add the contents of **`account-brand.css`** inside the `<style>` (with the `@import` line first);
   - add the contents of **`account-brand.js`** inside a `<script>` tag.
3. Open one account page per store (`/account/login`, `/account/orders/<id>`) logged out and logged in, on a phone too. To undo: delete the two blocks you added.
4. Re-run the probe (below) with no injection to confirm the live pages now look like the injected ones.

## Running the probe
Workflow *Probe store account area (read-only)*; until the file is on `main` it runs on every push to `claude/keen-darwin-52lbrf` that touches the script, the workflow or this folder (**remove the `push:` block in the workflow when merging**).
Inputs (after merge): `stores` (default `us`), `order_path` (default the test order), `css` / `js` (what to inject; empty file = none), `publish_shots` (default `false`).
Test customers come from repo secrets `STORE_<WWW|US|ES|FR|IT>_EMAIL` / `_PASSWORD` (only US is set). Screenshots are published to the throwaway branch `probe-account-shots` ONLY with `publish_shots=true`; every other run deletes that branch, because the screenshots show the test account's name, email, address and a real package number.

## How it was tested
`scripts/probe-store-account.js` (workflow *Probe store account area*, read-only, runs on a GitHub runner because the sandbox cannot reach the stores)
logs in as the US test customer, injects `PROBE_CSS` / `PROBE_JS` into every page and screenshots desktop + 390 px. Verified on the live US store: login,
register, My Account, My Orders, Order Detail with a shipped order and a USPS number (panel on top, original block hidden, phone stacks).
The probe also follows **Track package** to the carrier: USPS answered the runner with `403 Access Denied` (bot protection on data-centre addresses). That is not
proof the link is wrong or right; click it once on a phone.

## NOT tested
- Safari / iOS (the CSS uses `:has()`; browsers without it simply keep the platform look), Firefox.
- The ES / FR / IT / EN stores (same theme, same selectors expected; button texts are translated by host, not yet seen).
- A carrier other than USPS; the real USPS page with a real number.
- The "Registered successfully" popup after sign-up (markup not captured, so it is still the platform's).
- A just-created account on the empty-orders screen; the Address Book / My Profile / Change Password pages (not styled, not captured).

## Know before you paste
- This only changes how the **platform's** page shows what is saved in the **platform**. Our own emails and the "My order" page read tracking from our admin (separate system).
- "Buy Again" on a custom-kit order probably does not re-create the design. It is restyled, not hidden: your call.
- The product picture in Order Detail is an empty grey box on the platform's side (the order list shows it); not fixed here.
- The header account icon on every store links to `design.momuto.com/login`, not to the store's own `/account`; the footer "Order Status" goes to `design.momuto.com/userInfo/order`. Not changed here (decision pending).

## Editing
There is no build step for the JS. The CSS was generated from a small script; edit `account-brand.css` by hand and keep the scope prefix on every rule
(`grep -c '^html body:has' account-brand.css`; any selector line without it would leak to other pages).
Regenerate the preview snippet:
`node -e "const f=require('fs'),c=f.readFileSync('docs/account-brand/account-brand.css','utf8'),j=f.readFileSync('docs/account-brand/account-brand.js','utf8');f.writeFileSync('docs/account-brand/preview-snippet.js','(function () {\n  var st = document.createElement(\'style\'); st.id = \'mo-account-preview\';\n  st.textContent = '+JSON.stringify(c)+';\n  document.head.appendChild(st);\n'+j+'\n})();\n')"`
