# Task: make RTP (2D configurator) orders capture logos + colours like the 3D tool

**For a new Claude Code session that has BOTH repos in scope:**
`33zpl4/momuto-api` (the storefront/config code) **and** `33zpl4/design-momuto` (the "momuto 3d tool").

## The problem (confirmed)

When a customer buys through the **Ready-to-Play 2D configurator** (the embedded kit
builder on product pages), their chosen **colours** and **uploaded logo files (crest +
sponsor)** are **never sent to the order**. Production can't fulfil what it can't see.
Orders that came through the **3D tool** *do* carry this data (colours + logo files linked
to the order/OEM record, visible in manage.momuto.com), because the 3D tool has its own
upload→OSS→order pipeline. The 2D configurator bypasses that pipeline entirely.

**Goal:** RTP 2D orders must arrive complete — colours, name/number, and the uploaded
logo files — attached to the order the **same way** 3D-tool orders are, so they show up in
manage.momuto.com / the "product customization OEM" record.

## What the 2D configurator does today (evidence in `momuto-api/public/configurator/embed.js`)

- **Upload handler (~L552–557):** on file select it does
  `state[key] = knockoutBg(im)` where `im` is an `Image` from
  `URL.createObjectURL(file)` — i.e. the crest/sponsor are held **client-side as
  background-removed images** (canvas), and the raw `File` is `e.target.files[0]` at that
  point. So the logo bitmaps exist in the browser; they're just never uploaded.
- **`buildDesignPayload()` (~L610–616):** assembles the full design —
  `colours:{primary,secondary,trim}`, `nameNumber:{font,fill}`,
  `logos:{crest:!!state.crest, sponsor:!!state.sponsor}` (**booleans only — no files**),
  and `preview:{front,back}` via `captureView()` (`canvas.toDataURL("image/png")`).
- **`CART` (~L239):** `{ base:"https://design.momuto.com", productId, oemId, productIdKit,
  oemIdKit, lang }`.
- **`handoffToCart()` (~L617–636) — the bug:** it builds `design` then **discards it**:
  - **Embedded case (real):** finds the page's `#goto3d` / `window.jump3d`
    (or `#goto3d-kit` / `window.jump3d_kit` for full kit), clicks it, and `return`s.
    The 2D design (colours + logos) is thrown away; the customer lands in the 3D tool.
  - **Standalone case:** `POST design.momuto.com/v1/addToEcart` with a URL-encoded body of
    **only** `{productId, quantity, userId, oemId, lanType, timestamp, ranstr}`
    (`genUserId()` at ~L46), then `window.location.href = base + "/cart?uuid=" + userId + "&langguage=" + lang`.
    Still no colours, no logos.
- The widget also exposes `{ payload: buildDesignPayload, addToCart: handoffToCart,
  captureView }` on its return object (handy hooks).

Net: colours/logos are captured in the browser but **never transmitted**.

## What to find in `design-momuto` (the 3D tool) — the missing contract

Read the 3D tool to answer these, so we can mirror it from `embed.js`:

1. **Logo upload:** how does the 3D tool upload a customer logo to storage (OSS)?
   - The endpoint (likely under `design.momuto.com/...`), HTTP method, headers/auth,
     request format (multipart? base64? presigned OSS PUT?), and the **response** (the OSS
     URL/key it returns).
2. **Save/attach design to order:** what payload does the 3D tool send to bind a finished
   design to a cart/order so it appears in manage.momuto.com?
   - The endpoint (is it the same `/v1/addToEcart`, or a `saveDesign` / OEM-write call?),
     and the exact fields: colours, name/number/font, **logo OSS URLs**, preview image(s),
     `productId`, `oemId`, and the `userId`/`uuid` linkage.
3. **The uuid → cart → order chain:** how `design.momuto.com/cart?uuid=...` turns into an
   order that manage.momuto.com reads (the order detail references
   "产品id=…, OEM_ID=…, 前往产品定制OEM菜单" — i.e. an OEM customization record). Confirm
   where the design blob lives and its schema.
4. **Logo form:** does the pipeline expect the **raw** uploaded file or a **processed**
   PNG? (The 2D tool currently holds a background-knocked-out canvas; the original `File`
   is also available at upload time — decide which to send, or send both.)

## What to implement in `momuto-api/public/configurator/embed.js`

Rewire `handoffToCart()` so that, **before** handing off (in BOTH the embedded and
standalone paths):

1. **Upload** `state.crest` and `state.sponsor` (as blobs/dataURLs — from the knockout
   canvas, and/or the stashed original `File`) to the 3D tool's upload/OSS endpoint → get
   URLs. (May need to stash the raw `File` into `state` in the upload handler ~L554.)
2. **Build** a save-design payload in the 3D tool's exact format: colours, name/number/font,
   **logo OSS URLs**, preview PNG(s), `productId`/`oemId` (kit-aware: use
   `productIdKit`/`oemIdKit` when `state.kit === "kit"`), and the `userId`/`uuid`.
3. **POST** it to the same save/attach endpoint the 3D tool uses, keyed to the same
   `userId`/`uuid`, so the order carries the design.
4. **Then** proceed to cart:
   - Standalone: keep the `…/cart?uuid=…` redirect (now the uuid has a saved design).
   - **Embedded:** decide how `#goto3d`/`jump3d` consumes state. Either (a) save the design
     server-side keyed to a uuid **before** clicking goto3d and pass that uuid through, or
     (b) pre-fill the 3D tool from the 2D selections. Pick based on what the 3D-cart/uuid
     flow actually reads (from step 3 above). The current "just click and discard" must go.

Keep it kit-aware and locale-aware (`CART.lang`). Don't regress the 3D-tool flow.

## Acceptance criteria

- Place a **test RTP order** (jersey + custom colours + crest + sponsor + a name/number).
- In **manage.momuto.com**, that order's OEM/customization record shows the **chosen
  colours and the uploaded logo files**, identical to a 3D-tool order.
- Full-kit path works too (routes to the Kit SKU).
- Existing **3D-tool** orders are unaffected.

## How embed.js ships (deploy notes)

- `embed.js` (+ `assets-<slug>.js`) live in `momuto-api/public/configurator/` and are
  loaded on RTP product pages via `rtp-loader.js` (which cache-busts hourly). Templates:
  apex, fracture, khala, kinetic, legacy, mosaic, prism.
- Deploy is via **Deploy Static Files** (`scripts/deploy-static-files.js` maps `embed.js` →
  `public/configurator/embed.js`; it's a DiyFile self-hosted per store, referenced from
  `www.momuto.com`). It deploys "surgically" with the workflow's `file=embed.js` input
  (`workflow_dispatch`) — or add a push-trigger path for `public/configurator/embed.js`
  like the ones already added for `custom-content.js` / `rtp-loader.js`.
- **Sandbox can't reach** `design.momuto.com` or the CMS API (egress policy) — test in a
  real browser on the live site (or via the GitHub runner). Verify the DiyFile can be
  updated (it must already exist in the OEMSaaS admin; the API can't create, only update).

## Start here
1. In `design-momuto`, grep for the upload + addToEcart/save-design calls (search:
   `addToEcart`, `oss`, `upload`, `saveDesign`, `uuid`, `oemId`, `putObject`).
2. In `momuto-api`, open `public/configurator/embed.js` at `handoffToCart` (~L617) and
   `buildDesignPayload` (~L610).
3. Wire (2)→(1) as above; deploy `embed.js`; run the acceptance test.
