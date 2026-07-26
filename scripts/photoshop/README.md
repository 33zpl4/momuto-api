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
every layer, which ones are smart objects, and their pixel bounds.

**Already done for the three current templates** — the dumps are kept in
`templates/` as the reference `CONFIG` was written from. Re-run the inspector
whenever a template changes; the builder asserts the slot counts and will stop
rather than half-apply a design.

| template | canvas | smart-object slots |
|---|---|---|
| `admiral-psd.tif` (front) | 6200² | `JERSEY DESIGN` **×3**, `SLEEVE DESIGN` **×2**, `TAPE DESIGN`, `COLLAR TOP`, `COLLAR BOTTOM`, `INNER DESIGN` (hidden) |
| `52183 … Back View.tif` | 6000² | `JERSEY DESIGN`, `LEFT SLEEVE DESIGN`, `RIGHT SLEEVE DESIGN`, `COLLAR DESIGN` |
| `141087-mens-shorts.tif` | 5000² | `L LEG DESIGN`, `R LEG DESIGN`, `BELT DESIGN` |

**The repeated names are the important bit.** `admiral-psd` has three layers
called `JERSEY DESIGN` (body plus both shoulder panels) and two called
`SLEEVE DESIGN`. Matching by name and taking the first would replace one and
leave the rest — a half-applied design, reported as a success. So the builder
replaces **every** visible layer of a given name and asserts the count.

## 2. Configure the builder — once, not per design

Layer names, template filenames, sizes and slot counts are all filled in
already. **Three folder paths are the only thing to set, and they persist in the
file** — after this, the daily job is dropping files in `artworkDir` and running
the script.

```js
artworkDir:   'C:/Users/ayala/momuto/incoming',      // drop the .svg sets here
outDir:       'C:/Users/ayala/momuto/mockups-out',   // created if missing
templatesDir: 'C:/Users/ayala/momuto/templates',     // the three .tif files
```

Windows paths use **forward slashes**. A template's `psd` may be a bare
filename, resolved against `templatesDir` — so moving the templates later means
editing one line, not three. A full path there still works. Leave a `psd` empty
to skip that view.

Both `artworkDir` and `templatesDir` are checked before anything opens, so a
typo'd path says so immediately instead of failing three templates deep.

Mapping as configured — `count` is an assertion, not a hint:

| view | slot | ← file | copies |
|---|---|---|---|
| front | `JERSEY DESIGN` | `<slug>-front` | 3 |
| front | `SLEEVE DESIGN` | `<slug>-sleeves` | 2 |
| front | `COLLAR TOP` | `<slug>-collartop` | 1 |
| front | `COLLAR BOTTOM` | `<slug>-collarbottom` | 1 |
| back | `JERSEY DESIGN` | `<slug>-back` | 1 |
| back | `LEFT/RIGHT SLEEVE DESIGN` | `<slug>-sleeves` | 1 each |
| back | `COLLAR DESIGN` | `<slug>-collarback` | 1 |
| shorts | `L/R LEG DESIGN` | `<slug>-shorts` | 1 each |
| shorts | `BELT DESIGN` | `<slug>-belt` | 1 |

Two slots are **deliberately not configured**:

- **`TAPE DESIGN`** — always white, so leaving it alone keeps what the template
  already holds. Configuring it would mean generating an identical white file
  per design for no gain.
- **`INNER DESIGN`** — hidden in the template. Skipped automatically and
  reported, since replacing a hidden layer changes nothing in the export.

**Trim kind names carry no internal hyphen** — `collarback`, not `collar-back`.
`findSlugs()` matches on a trailing `-<view>`, so `x-collar-back.svg` would be
read as a design called `x-collar` the day the lead view changes. Unhyphenated
kinds cannot collide under any ordering.

Drop artwork in `artworkDir`:

```
kalikamis-front.svg          kalikamis-collartop.svg        →  kalikamis-front.png    1500×1500
kalikamis-back.svg           kalikamis-collarbottom.svg     →  kalikamis-back.png     1500×1500
kalikamis-sleeves.svg        kalikamis-collarback.svg       →  kalikamis-shorts.png   1000×1000
kalikamis-shorts.svg         kalikamis-belt.svg
```

Eight files per full design set. A view whose files are incomplete is skipped
and reported rather than exported half-dressed.

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
- **Every slot is resolved and counted before anything is written.** A wrong
  layer name, or a count that no longer matches the template, fails that view
  with a clear message instead of silently exporting a half-applied design.
- **All copies of a name are replaced**, not the first. The export log prints
  the number of slots swapped per design so it can be checked against the table
  above.
- **A non-smart-object layer is refused by name** — `replaceContents` on a
  raster layer does nothing at all, which is the worst possible failure.
- **Hidden slots are skipped and reported** rather than silently replaced.
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
