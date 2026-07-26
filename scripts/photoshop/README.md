# Jersey mockups — batching the drag-and-drop

The daily job is: open the mockup PSD, drag three artwork files onto three smart
objects, export 1500×1500. These two scripts do that for a folder of designs at
once, in your own Photoshop. No API, no subscription, no upload.

**Why not the pipeline in `mockups/`?** That one mounts a flat print onto a
garment photo with one rectangle. A jersey has front, back and sleeve panels
that each need their own warp and shading — which your PSD already carries. So
the PSD is the right tool; the only waste is doing the swap by hand.

**Why not the 2D configurator (`public/configurator/embed.js`)?** It infers
structure from colour — `buildComposite` segments pixels by hue. That works on
the RTP models only because their assets were authored with artificially
separated colours. A real design request with two near-identical navies, a
sponsor wordmark and a multi-colour crest gives the segmenter nothing to work
with. Not fixable by tuning; the information was never in the file.

## 1. Inspect first

```
Photoshop ▸ File ▸ Scripts ▸ Browse… ▸ inspect-template.jsx
```

Read-only. Writes `<template>-layers.txt` next to the PSD listing every layer,
which ones are smart objects, and their bounds. This is how the slot names get
confirmed instead of guessed.

## 2. Configure and run

Edit the `CONFIG` block at the top of `build-jersey-mockups.jsx`:

```js
template:   'C:/Users/you/momuto/jersey-mockup.psd',
artworkDir: 'C:/Users/you/momuto/incoming',
outDir:     'C:/Users/you/momuto/mockups-out',
slots: [
  { layer: 'FRONT_ART',  suffix: 'front'   },   // ← names from step 1
  { layer: 'BACK_ART',   suffix: 'back'    },
  { layer: 'SLEEVE_ART', suffix: 'sleeves' }
],
```

Windows paths use **forward slashes**.

Then drop your files in `artworkDir` using the naming you already use:

```
kalikamis-front.svg
kalikamis-back.svg
kalikamis-sleeves.svg
```

Run the script. Out comes `kalikamis.jpg` at 1500×1500. Any number of designs
in the folder are processed in one pass — slugs are inferred from the `-front`
files.

## Safety

- The template is **never saved.** Every export runs on a duplicate and the
  original closes with `DONOTSAVECHANGES`, so its smart objects are left as they
  were on disk.
- **All slots are resolved before anything is written.** A typo in a layer name
  stops the run with a clear message rather than half-building a batch.
- A layer that isn't a smart object is refused by name — replacement would
  silently do nothing otherwise.
- A design missing one of its three files is **skipped and reported**, not
  exported half-dressed.

## Known rough edges

- **SVG into a smart object.** Photoshop places SVG happily when the slot was
  authored from vector. If a replace fails on `.svg`, export the artwork to PNG
  at roughly 2× the slot's bounds (step 1 prints them) and drop that instead —
  `CONFIG.extensions` already prefers `svg` then falls back.
- **One PSD, one output.** If your template holds front and back views in one
  document and you need them as separate images, that needs group toggling per
  export. Trivial to add — it needs the group names from step 1.
- **`resizeImage` forces both dimensions**, because the existing t-shirt
  templates are 3992×**3993** and a width-only resize yields 1500×1501. If your
  jersey PSD is exactly square this is a no-op.

## If this ever needs to run unattended

Same `.jsx`, driven by Adobe's Photoshop API (`/pie/psdService/smartObject`)
instead of the desktop app — the smart-object contract is identical, so the
template and slot names carry over unchanged. Only worth the entitlement and the
presigned-URL plumbing if mockups need generating without a machine present.
Running it locally costs nothing and answers whether the template design is
right first.
