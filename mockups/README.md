# Mockup generation (Iconic Series t-shirts)

Standardized product-mockup creation: drop a raw SVG illustration in, get the
finished t-shirt mockup out — identical placement, scale and export settings
every time. Built for Iconic Series drop 02 (World Cup 2026); jerseys come
later.

## Folder layout

```
mockups/
├── templates/     ← base garment photos (TIFF/PNG/JPG) + placement configs
├── artwork/       ← raw SVG illustrations, organized by collection/drop
│   └── iconic-series/drop-02/
└── output/        ← generated mockups (committed by the Action)
```

## 1. Upload the shirt template

Put the flat t-shirt photo in `mockups/templates/` — the raw TIFF is fine
(sharp reads TIFF natively; output is flattened to JPEG/PNG). Next to it,
create a `.json` config with the same base name you'll refer to it by:

`mockups/templates/tshirt-black-flat.json`
```json
{
  "image": "tshirt-black-flat.tif",
  "print": { "x": 700, "y": 480, "width": 620, "height": 880, "gravity": "north" },
  "blend": "over",
  "output": { "format": "jpg", "quality": 90, "maxWidth": 2000, "background": "#ffffff" }
}
```

- **`print`** — the printable box in *template pixels*. Artwork is scaled to
  fit inside it (aspect ratio kept) and anchored by `gravity`: `north`
  (hangs from the top edge — what you want for back prints), `center`, or
  `south`.
- **`blend`** — `over` for solid prints; `multiply` can help artwork sit into
  light fabric.
- **`output.size`** — exact square output in px (1500 matches the drop 01 CMS
  assets; the garment PSDs are 3992x3993, so `maxWidth` alone yields 1501 tall).
  **`output.maxWidth`** — width-only downscale, keeps aspect;
  `background` fills any transparency in the template.

To calibrate the print box, run debug mode and eyeball the red rectangle:

```
node scripts/generate-mockups.js --debug --template tshirt-black-flat
# writes mockups/output/_debug--tshirt-black-flat-placement.jpg
```

Adjust `x/y/width/height`, re-run, repeat until it matches where prints go.
This is a one-time job per template.

## Drop 02+: composed prints (frame + title + plate + number)

Drop 02 designs are **composed** before mounting: raw illustration + three
strings → the framed print with title bar, bottom plate rail and accession
number. The frame is the drop 02 vector (`frames/iconic-frame.svg`, white
group taken verbatim from `reference/frame-concept.svg` — thin-margin
borders, short plate rules, and the stepped number tab bottom-right; the
black backdrop group is dropped so the print stays transparent). Text is
set live in Trajan Pro (`fonts/`), so no per-design vectorized titles are
needed.

Drop a raw SVG plus a sidecar `.json` with the same basename:

```json
{
  "title": "EL HIMNO",
  "plate": "ARG 2–1 ENG · 15.07.26",
  "number": "IM-07",
  "panel": "#EFE7D8",
  "recolor": { "#e67929": "panel" }
}
```

`recolor` rewrites artwork fills before rendering (`"panel"` = the panel
color) — that's how the vectorization-helper orange becomes the series cream.
`node scripts/compose-print.js` (no args = everything with a sidecar) writes
screen-resolution print masters to `prints/…`, which the mockup generator
then mounts. Artwork **with** a sidecar is never mounted raw. Production
print files still come from the illustrator's working file — `prints/` is
for mockups and CMS imagery only.

## 2. Drop in artwork

Save raw SVGs under `mockups/artwork/<collection>/<drop>/`, e.g.
`mockups/artwork/iconic-series/drop-02/the-volley.svg`.

Rules for the SVGs:
- **Outline all text** (Object → Expand in Illustrator). The renderer has no
  fonts installed, so live text will silently render wrong.
- The SVG needs a `viewBox` (any export from Illustrator/Figma has one).
- The full SVG canvas is what gets placed — trim the artboard to the artwork.

## 3. Generate

Push to GitHub and the **Generate Mockups** Action runs automatically
(any change under `mockups/artwork/` or `mockups/templates/`), commits the
results to `mockups/output/`, and you pull/download them from there. You can
also trigger it manually from the Actions tab, or run locally:

```
npm install sharp        # one-time
node scripts/generate-mockups.js                                  # everything
node scripts/generate-mockups.js --template tshirt-black-flat     # one template
node scripts/generate-mockups.js --artwork mockups/artwork/iconic-series/drop-02/the-volley.svg
```

Output naming: `output/<collection>/<drop>/<design>--<template>.jpg`, so one
design mocked on several shirts never collides.

### Demo fixtures

Files starting with `_` (templates or artwork) are demo/test fixtures —
batch runs skip them; they only render when named explicitly. To see the
whole pipeline work without a real template:

```
node scripts/generate-mockups.js --template _test-shirt --artwork mockups/artwork/_samples
# → mockups/output/_samples/the-test--_test-shirt.jpg
```

Uploading the finished mockups to the CMS stays a manual step for now.

## Jerseys (later)

Same pipeline, more knobs: jerseys need per-panel placement, warp/shading to
follow the fabric, and colorway variants. The template-config approach extends
to that (multiple print boxes + an optional shading overlay per template), but
it's deliberately out of scope for v1.
