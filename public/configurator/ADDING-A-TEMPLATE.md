# Adding a new Ready-to-Play (RTP) template to the 2D live configurator

This runbook describes everything required to bring a new RTP design (e.g. The Apex,
The Kinetic, The Legacy, The Mosaic, The Prism) live in the embeddable 2D kit
configurator. It is written so any engineer or agent can execute it end-to-end.

> **TL;DR per model:** export 5 image assets (2 zone templates + 3 design patterns)
> following the colour conventions below, run `build-assets.py <slug>`, create the
> RTP product to get `productId`/`oemId`, then publish the page custom block with 3
> copy swaps. `embed.js` is shared and never changes per model.

---

## 1. Architecture (how the engine consumes assets)

The configurator is a single self-contained widget, `public/configurator/embed.js`,
mounted into a Shadow DOM on any `#momuto-rtp` element. It is **code-only**; all
imagery is injected per template via `window.__RTP_ASSETS`, produced by
`build-assets.py` into `assets-<slug>.js`.

```
<div id="momuto-rtp" data-template="the-fracture"
     data-product="16534" data-oem="10294534" data-lang="en"></div>
<script src="https://www.momuto.com/assets-<slug>.js" defer></script>   <!-- per model -->
<script src="https://www.momuto.com/embed.js?v=N"   defer></script>     <!-- shared -->
```

The engine renders by:
1. Reading a **zone template** PNG (`blank-shirt-front.png` / `blank-shirt-back.png`)
   that classifies every pixel into a *zone* (body, shoulders, collar, sleeves, cuffs,
   neck, name area) and carries the garment **shading** (fabric folds via luminance).
2. Mapping a **design pattern** PNG (`front-design.png`, `back-design.png`,
   `sleeve-design.png`) into the body/sleeve zones. The pattern is authored in a
   fixed **4-tone pink reference** that the engine remaps to the user's
   primary→secondary colours.
3. Painting collar/cuffs with the **trim** colour, overlaying the MOMUTO logo,
   crest/sponsor uploads, and (back view) the vectorised PLAYER/number font.

`W = H = 1500`. All raster assets are 1500×1500 (except the design patterns, which
are mapped to fit and may be any aspect ratio).

---

## 2. Per-model deliverables checklist

| # | Deliverable | Reusable across models? | Notes |
|---|-------------|--------------------------|-------|
| 1 | `blank-shirt-front.png` (front zone template) | **Yes, if same garment cut** | 1500×1500, zone colours per §3.1 |
| 2 | `blank-shirt-back.png` (back zone template)   | **Yes, if same garment cut** | 1500×1500, **vertically aligned to front** (§3.4) |
| 3 | `front-design.png` (front body pattern)       | No — per design | 4-tone pink reference (§3.2) |
| 4 | `back-design.png` (back body pattern)         | No — per design | 4-tone pink reference (§3.2) |
| 5 | `sleeve-design.png` (sleeve pattern)          | No — per design | 4-tone pink reference (§3.2) |
| 6 | `logo-momuto.png`                             | **Yes** | Brand logo, identical every model |
| 7 | `template-slots.json`                         | **Yes, if same garment** | Slot geometry (§3.3) |
| 8 | `fonts/font-1.svg`, `font-2.svg`, `font-3.svg`| **Yes** | Vectorised PLAYER/10, 3 font options |
| 9 | RTP product → `productId` + `oemId`           | No — per model | Create in manage.momuto.com (§6) |
| 10| Page copy: title + description                | No — per model | Already in `ready-to-play/templates/<slug>/config.json` |

**Optimisation:** the garment ("mamuto3" suit) is constant across the RTP
collection, so items 1, 2, 6, 7, 8 can be **shared** — only items 3, 4, 5
(the printed pattern) genuinely change per design. Reuse the shared set unless the
new design changes the **collar/sleeve/cuff cut** (then a new zone template is
required). When reusing the shared aligned blanks, the front/back alignment problem
(§3.4) is already solved and needs no re-work.

---

## 3. Asset specifications

### 3.1 Zone templates (`blank-shirt-front.png`, `blank-shirt-back.png`)

1500×1500 PNG, transparent background, garment centred. Each garment region is
painted a **specific marker colour** so the engine can classify it. The marker
colours also carry luminance (light/dark folds) which becomes the fabric shading —
so export them with the garment's real shading baked in, tinted to the marker hue.

**Front — classified by nearest normalised-RGB (`BASES` in `embed.js`):**

| Zone | Meaning | Marker RGB | Hex | Rendered as |
|------|---------|-----------|-----|-------------|
| 0 | Body | 96,168,144 | `#60A890` | front-design (4-tone) |
| 1 | Shoulders / upper | 72,168,240 | `#48A8F0` | sleeve-design + secondary |
| 2 | Collar | 192,96,168 | `#C060A8` | **trim** |
| 3 | Left sleeve | 96,144,48 | `#609030` | sleeve-design |
| 4 | Right sleeve | 216,168,72 | `#D8A848` | sleeve-design (mirrored) |
| 5 | Neck inner (auto-detected white) | low-sat light | — | white |
| 6 | Cuffs (auto-detected saturated) | sat red/cyan | — | **trim** |

**Back — classified by hue (`HUEB` in `embed.js`):**

| Zone | Meaning | Marker hue° | Example hex | Rendered as |
|------|---------|-------------|-------------|-------------|
| 0 | Body | 168 (teal) | `#1FBF9F` | back-design (4-tone) |
| 1 | Shoulders | 220 (blue) | `#2C6FE0` | sleeve-design + secondary |
| 2 | Collar | 30 (orange) | `#E08020` | **trim** |
| 6 | Cuffs | 314 (magenta) | `#E020A0` | **trim** |
| 7 | Name/number area | 260 (violet) | `#6A2CE0` | body colour; positions PLAYER/number |

> Keep these marker hues distinct and saturated so classification is unambiguous.
> The exact RGB need not match to the byte — the engine snaps to the nearest marker —
> but stay close to the hues above and away from the neighbours.

### 3.2 Design patterns (`front-design.png`, `back-design.png`, `sleeve-design.png`)

The printed artwork, authored in a **4-tone pink reference** so it recolours to the
user's two team colours. The engine (`SRC4` / `TONE_T` in `embed.js`) maps:

| Reference tone | RGB | Hex | Becomes |
|----------------|-----|-----|---------|
| Tone 0 (deepest) | 255,125,189 | `#FF7DBD` | **primary** (100%) |
| Tone 1 | 255,152,202 | `#FF98CA` | 34% primary→secondary |
| Tone 2 | 252,208,243 | `#FCD0F3` | 66% primary→secondary |
| Tone 3 (palest) | 254,234,252 | `#FEEAFC` | **secondary** (100%) |

Rules:
- Paint every recolourable area using **only these 4 pink tones** (hard fills, not
  gradients) to get clean 3-tone depth.
- Any pixel **far** from all 4 tones (squared RGB distance > `OFFTOL` = 8500) is kept
  **literal** — use this for fixed accents that must not recolour.
- Transparent elsewhere. The pattern is scaled to fit the body/sleeve zone bbox.
- `back-design.png` is the **pattern only** — the PLAYER/number is a separate font
  overlay (§3.5), do not bake it in.

### 3.3 `template-slots.json`

Slot geometry in the design tool's native coordinate space (front root is
4200×5904). Defines `crest`, `sponsor`, `logo-momuto` placement (and `logos`,
`sleeves` roots). Reusable across models with the same garment. See the committed
fracture copy for the canonical structure.

### 3.4 Front/back vertical alignment (critical)

There is **no runtime vertical centering** (`centerDY` is a no-op, `ALIGN_V3`).
Alignment is the source of truth in the assets: **the garment must occupy the
identical vertical position in `blank-shirt-front.png` and `blank-shirt-back.png`.**
Overlay the two and line up the **shoulder seam / sleeve tops / armpits** (collar and
hem differ by design — ignore them). Verify after building:

```bash
python3 - <<'PY'
import re,base64,io; from PIL import Image
src=open('assets-<slug>.js').read()
for k in ['blank-shirt-front.png','blank-shirt-back.png']:
    m=re.search(re.escape(k)+r'":"data:image/[^;]+;base64,([^"]+)"',src)
    im=Image.open(io.BytesIO(base64.b64decode(m.group(1)))).convert('RGBA');W,H=im.size;px=im.load()
    rows=[sum(1 for x in range(W) if px[x,y][3]>8) for y in range(H)]
    mw=max(rows); sh=next(y for y in range(H) if rows[y]>=0.8*mw)
    print(k,'shoulder-row',sh)
PY
```

The two shoulder-row numbers should be within ~5px. (Fracture: 310 vs 313.)

### 3.5 Fonts (`fonts/font-1.svg`, `font-2.svg`, `font-3.svg`)

Three back name/number font options, each a vectorised "PLAYER 10" SVG. Shared
across all models. Labels in UI: Vanguard / Contour / Industry (`FONTS` in
`embed.js`).

---

## 4. Build the asset bundle

```bash
cd public/configurator
python3 build-assets.py <slug> [asset-dir]   # e.g. python3 build-assets.py apex assets-apex/
# -> writes assets-<slug>.js  (window.__RTP_ASSETS = {...}, ~1.8 MB)
```

The script converts zone templates to **lossless** WebP (to preserve classification)
and design patterns to lossy WebP (q82–84), base64-inlines everything, and bundles
`template-slots.json`. Default asset dir is `assets/`; pass a per-model dir to keep
sets separate.

---

## 5. Host the files (abcshoppy "Custom file")

CSP on momuto.com blocks third-party scripts, so files are **self-hosted same-origin**:
- Upload `assets-<slug>.js` → `https://www.momuto.com/assets-<slug>.js`
- `embed.js` is shared — upload once to `https://www.momuto.com/embed.js`; only
  re-upload when the shared code changes.
- **Cache busting:** bump `?v=N` on the `embed.js` script tag whenever it changes.
  Verify a deploy landed by opening the raw URL and searching for a known token
  (e.g. `ALIGN_V3`).

---

## 6. Create the RTP product → `productId` + `oemId`

In manage.momuto.com, create the RTP model (it deploys a product served on
momuto.com whose "Add to cart" lands on `design.momuto.com/cart`). From that product
capture:
- `data-product` = `productId`
- `data-oem` = `oemId`

The widget's "Add to cart" reuses the page's `#goto3d` / `jump3d` handoff if present,
otherwise POSTs `productId/oemId/userId/qty` to `design.momuto.com/v1/addToEcart` and
redirects to `design.momuto.com/cart?uuid=<userId>`. `userId` is client-generated.

---

## 7. Publish the page (custom block)

Use the canonical editorial block (banner + collection label + title + description +
3-up value strip), then the widget mount + scripts. **Three swaps per model:**
1. `<h2>` title
2. `<p>` description (from `ready-to-play/templates/<slug>/config.json` → `description.en`)
3. widget `data-template` / `data-product` / `data-oem`, and `assets-<slug>.js` src.

See `ready-to-play/templates/the-fracture/` for reference copy and the chat-delivered
block for the exact markup.

---

## 8. Go-live verification checklist

- [ ] Front renders; recolour primary/secondary/trim looks clean (no hue specks on
      sleeves/cuffs — see Troubleshooting).
- [ ] Back renders; PLAYER/number placed in zone 7; 3 fonts switch correctly.
- [ ] Front↔Back toggle: garment holds position (shoulder rows aligned, §3.4).
- [ ] Price block shows €19.70 / €24.20 at qty 10; struck original + −10% badge.
- [ ] Kit cards: "Jersey only" / "Full kit · jersey + shorts" with per-option prices.
- [ ] Perks (flag + armband) show on Full kit.
- [ ] Add to cart → `design.momuto.com/cart?uuid=...` with the right product.

---

## 9. Troubleshooting

- **Hue specks / coloured streaks on sleeves or cuffs:** zone misclassification. Make
  the marker hues (§3.1) more distinct; shading is applied as neutral luminance, so
  stray hue means a pixel landed in the wrong zone.
- **Front/back jump on toggle:** assets not aligned (§3.4) **or** a stale bundle. The
  runtime does not shift — fix the asset or the cache.
- **"Loading…" forever:** assets file not loaded before `embed.js`, or
  `window.__RTP_ASSETS` missing the template's keys.
- **Changes not visible live:** `?v=` not bumped / CDN cache. Open the raw `embed.js`
  URL and grep for a known token to confirm the deployed version.
- **Add-to-cart blocked / CSP:** files must be same-origin on momuto.com, not a
  third-party host.
