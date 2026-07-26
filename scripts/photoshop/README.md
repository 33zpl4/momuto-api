# Jersey mockups — batching the drag-and-drop

The daily job is: open a mockup PSD, drag the artwork onto its smart object,
export at size, then shrink the PNG on tinypng.com until it's ~300 KB. These
scripts do all of it for a whole folder of designs at once.

Two steps, both entirely local:

```
1.  build-jersey-mockups.jsx      in Photoshop   → full-size PNGs
2.  node scripts/compress-mockups.js <outDir>    → the ~300 KB versions
```

Neither touches the network. Step 1 is ExtendScript running inside your own
Photoshop; step 2 is `sharp` on your machine. Wifi state is irrelevant to both.

**Why not the pipeline in `mockups/`?** That mounts a flat print onto a garment
photo with one rectangle. A jersey's front, back and sleeve panels each need
their own warp and shading — which your PSDs already carry.

**Why not the 2D configurator (`public/configurator/embed.js`)?** It infers
structure from colour: `buildComposite` segments pixels by hue. That works on
the RTP models only because their assets were authored with artificially
separated colours. A real design request with two near-identical navies, a
sponsor wordmark and a multi-colour crest gives the segmenter nothing to work
with — not fixable by tuning, the information was never in the file.

---

## 1. Inspect each template

```
Photoshop ▸ File ▸ Scripts ▸ Browse… ▸ inspect-template.jsx
```

Read-only, saves nothing. Writes `<template>-layers.txt` next to the PSD listing
every layer, which ones are smart objects, and their pixel bounds. Run it once
per template (front, back, shorts) to get the real slot names.

## 2. Configure the builder

One entry per view, each with its own PSD, slot and export size:

```js
artworkDir: 'C:/Users/you/momuto/incoming',
outDir:     'C:/Users/you/momuto/mockups-out',
templates: [
  { psd: 'C:/…/jersey-front.psd',  slot: 'FRONT_ART',  suffix: 'front',  size: 1500 },
  { psd: 'C:/…/jersey-back.psd',   slot: 'BACK_ART',   suffix: 'back',   size: 1500 },
  { psd: 'C:/…/shorts.psd',        slot: 'SHORTS_ART', suffix: 'shorts', size: 1000, optional: true }
],
```

Windows paths use **forward slashes**. Leave a `psd` empty to skip that view.

Drop artwork in `artworkDir` using the naming you already use:

```
kalikamis-front.svg    →  kalikamis-front.png    1500×1500
kalikamis-back.svg     →  kalikamis-back.png     1500×1500
kalikamis-shorts.svg   →  kalikamis-shorts.png   1000×1000
```

Any number of designs at once. Each PSD is opened **once** and every design run
through it, which is where the time saving actually comes from on a batch.

`optional: true` on shorts means a design without a shorts file is skipped
quietly, and slugs are only discovered from a non-optional view — so a stray
shorts file can never invent a design that doesn't exist.

## 3. Compress

```
node scripts/compress-mockups.js "C:/Users/you/momuto/mockups-out"
node scripts/compress-mockups.js <dir> --max 300        # tighter cap
```

Writes `<name>.min.png` alongside each input.

This replaces tinypng.com. TinyPNG's trick is **palette quantisation** — reduce
to N colours and a PNG shrinks hard, which is exactly why it works so well on
flat vector kit artwork. `sharp` does the same locally, so the upload-check-
reupload loop becomes a binary search for the highest colour count still under
the cap. Quality is maximised subject to the cap rather than driven down to a
target, so a design that compresses well keeps all 256 colours.

Measured on a 1500×1500 export:

| input | result |
|---|---|
| flat vector kit design (93 KB) | **22 KB**, 256 colours — no loss |
| photographic garment mockup (1000 KB) | **202 KB**, 128 colours |

The second is the worst case and it still lands well under 325 KB. If something
reports **OVER CAP at 2 colours**, that isn't a compression problem — it means a
photographic layer, noise or a gradient snuck into the export and defeated
quantisation.

## Safety

- **Templates are never saved.** Every export runs on a duplicate; the original
  closes with `DONOTSAVECHANGES`, so its smart objects are left as they were.
- **The slot is resolved before anything is written.** A wrong layer name fails
  that view with a clear message instead of silently exporting the template
  unchanged, over and over.
- **A non-smart-object layer is refused by name** — `replaceContents` on a
  raster layer does nothing at all, which is the worst possible failure.
- **`resizeImage` forces both dimensions**, because a template canvas may be a
  pixel off square (the existing t-shirt templates are 3992×**3993**) and a
  width-only resize then yields 1500×1501.

## Known rough edges

- **SVG into a smart object.** Photoshop places SVG when the slot was authored
  from vector. If a replace throws on `.svg`, export PNG at ~2× the slot's
  bounds (step 1 prints them); `extensions` already falls back past svg.
- **One PSD, one output per design.** If a template ever needs two exports from
  one document (say a colourway toggle), that needs group switching per export —
  small addition, needs the group names from step 1.
