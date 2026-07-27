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

Mapping as configured. `count` is an **assertion**, not a hint — if a template
is edited and a slot count shifts, the run stops rather than half-applying.

**Required** slots are marked ●. A view exports if its required artwork is
present; every other slot keeps the template's own placeholder when its file is
absent, and the run says so.

| view | slot | address | ← file (first that exists) | |
|---|---|---|---|---|
| front | `JERSEY DESIGN` | `@1725,959` | `-front` | ● |
| front | `JERSEY DESIGN` | `@1723,736` | `-shoulderleft` → `-shoulders` | |
| front | `JERSEY DESIGN` | `@3596,746` | `-shoulderright` → `-shoulders` | |
| front | `SLEEVE DESIGN` | `@1242,995` | `-sleeveleft` → `-sleeves` | |
| front | `SLEEVE DESIGN` | `@3845,1040` | `-sleeveright` → `-sleeves` | |
| front | `COLLAR TOP` | — | `-collartop` | |
| front | `COLLAR BOTTOM` | — | `-collarbottom` | |
| back | `JERSEY DESIGN` | — | `-back` | ● |
| back | `LEFT SLEEVE DESIGN` | — | `-sleeveleft` → `-sleeves` | |
| back | `RIGHT SLEEVE DESIGN` | — | `-sleeveright` → `-sleeves` | |
| back | `COLLAR DESIGN` | — | `-collarback` | |
| shorts | `L LEG DESIGN` | — | `-shorts` | ● |
| shorts | `R LEG DESIGN` | — | `-shorts` | ● |
| shorts | `BELT DESIGN` | — | `-belt` | |

### What the shading layers actually do

Confirmed from the template, not assumed:

```
highlights  {screen, opacity 25%}        ← NOT clipped
shadows     {linearburn, opacity 80%}    ← NOT clipped
Brillo/contraste 1   {CLIPPED to layer below}
Tono/saturación 1    {CLIPPED to layer below}
```

`shadows` and `highlights` sit above the `SMARTS` group and are **not clipped**,
so they composite over whatever artwork is dropped in. A PNG export of the
layered document therefore carries them — the script does not need to do
anything special, and a mockup that looks flat is not flat because the shading
was dropped.

The two adjustment layers **are** clipped, so they tint only the `SMARTS` group.
That is deliberate: they colour the artwork without touching the collar, cuffs
and stitching in `PARTS`.

Worth re-running the inspector after any template edit — a `shadows` layer that
someone clips, or knocks to Normal, would quietly stop doing its job and nothing
else in the pipeline would notice.

### Authoring sizes — front template

Measured from the template. **Build each SVG at exactly this size.**

| file | size |
|---|---|
| `<slug>-front` | **4469 × 5904** |
| `<slug>-shoulders` (both) | **1671 × 679** |
| `<slug>-sleeveleft` | **1348 × 2494** |
| `<slug>-sleeveright` | **1348 × 2520** |
| `<slug>-collartop` | **1500 × 252** |
| `<slug>-collarbottom` | **2171 × 355** |

Two things fall out of that table:

- **Both shoulders share one canvas**, so a single `-shoulders.svg` is exact for
  both — no need to make a left and a right.
- **The sleeves differ by 26 px in height** (2494 vs 2520). One shared
  `-sleeves.svg` therefore cannot be exact for both; it will be ~1% off on
  whichever it wasn't authored for. Supplying `-sleeveleft` and `-sleeveright`
  removes that.

The builder now carries these as `expect` and **warns** when a dropped file does
not match:

```
⚠ kalikamis-front.svg is 1000×1500, slot expects 4469×5904 — it will be scaled and re-centred
```

A warning, not a rejection: a mismatched file still produces a usable mockup, it
just shifts. You should know rather than wonder.

### PNG is a first-class input

Photoshop sometimes mis-renders an SVG — text converted to a path, or a font it
cannot resolve, and the type vanishes. The fix is to export that one file as PNG
and drop it in instead; `extensions` already prefers `svg` and falls back.

The scale compensation works on PNG too: dimensions come from the IHDR chunk
rather than a `viewBox`. **Export the PNG at the same canvas as the SVG it
replaces** and nothing else changes.

`tif` and `psd` are accepted but not measured, so those get no compensation —
author them at the slot's exact size.

### What is inside a slot

The inspector lists each `.psb`'s layers. `COLLAR BOTTOM` holds six:

```
contents: mid-collar (hidden) | half-collar (hidden) | <artwork> | top-thin-collar | top-THICK-collar (hidden) | Rectangle 1
```

Those are **collar style presets** from when designs were edited inside
Photoshop by hand — pick a thin or thick collar by toggling a layer. That
workflow is gone: the dropped SVG now contains the finished collar, full-canvas
and opaque, so anything beneath it is invisible.

`replaceContents` does substitute the whole document and discard them, but with
an opaque full-canvas artwork on top that changes nothing visible. **Listed for
information, not as a problem.**

It would matter for a slot whose artwork is partially transparent, or smaller
than the canvas — then the layers underneath would show through in the manual
workflow and be missing in the scripted one. Worth checking the contents list
before assuming a slot behaves like the others.

### Two ways artwork gets into a slot — `placeInside`

They are genuinely different operations, and the difference is visible:

| | `placeInside: false` | `placeInside: true` (default) |
|---|---|---|
| mechanism | `replaceContents` substitutes the smart object's content | opens the slot's `.psb`, places the artwork inside, saves, closes |
| slot ends up holding | **your SVG file** | an embedded `.psb`, like a hand-made mockup |
| double-clicking the slot | opens the SVG **in your browser** | opens in Photoshop |
| sizing | the outer `expect` / rescale compensation | fitted to the `.psb` canvas directly |
| speed | fast | a save per slot, and the template reopens per design |

`true` is what a manual drag-and-drop does, so it renders like one. That is the
whole reason it exists: `replaceContents` leaves the slot holding a vector file
rather than a Photoshop document, and how Photoshop rasterises that — especially
after a scripted `resize()` — is not something to assume.

In `placeInside` mode the `expect` table becomes advisory. The artwork is scaled
to the `.psb` canvas from the inside, where the numbers are exact, so a
mismatched canvas costs a resample and nothing else.

### What replaceContents actually does

**It does not fit artwork to the frame.** It keeps the slot's existing transform
and drops the new file in at its natural pixel size. Artwork at ⅔ of the
expected canvas therefore renders at ⅔ size, with the garment's solid-fill
layers visible around it — not a subtle misalignment, a visibly broken mockup.

The script compensates: it measures the SVG's `viewBox`, scales the slot by
`expect / actual` after replacing, and scales back after export so a batch never
compounds. **Any canvas size works**, as long as elements sit proportionally
within it.

Matching the sizes in the table above is still better — no resampling, no
rounding — but it is now an optimisation rather than a requirement.

If the **aspect ratio** differs the script says so and the artwork will distort,
because each axis is scaled independently. Distortion is visibly wrong, which is
preferable to silently cropping or letterboxing part of a design.

So build each SVG at the size the inspector reports as **`AUTHOR ARTWORK AT`**.

That number is the smart object's **source canvas**, which is *not* the layer's
bounds — the content usually extends past its mask. One observed slot had bounds
`2764×4201` and a source canvas of `3060×4431`. Authoring to the bounds would
still have been wrong, just less obviously.

If matching exactly is impractical, match the **source aspect ratio** — but note
that is *not* the ratio of the masked bounds, and on this template the two are
wildly different for every single slot:

| slot | bounds AR | source AR |
|---|---|---|
| body | 0.658 | 0.757 |
| sleeve | 0.695 | 0.535 |
| shoulder | 1.548 | 2.461 |
| collar bottom | 2.051 | 6.115 |

The content is warped into the garment shape, so the mask tells you nothing
about how the artwork should be proportioned. Only the source canvas does.

### Addressing repeated layer names

`admiral-psd` has **three** layers called `JERSEY DESIGN` — the body plus both
shoulder panels — and **two** called `SLEEVE DESIGN`. Names cannot separate
them, so those slots are addressed by **position**: `at: [x, y]` is the layer's
top-left corner, taken straight from the inspector dump and matched within 50 px.

The closest pair on that template is body `1725,959` against left shoulder
`1723,736` — 2 px apart in x, 223 in y. So x alone would be ambiguous and the
tolerance has to stay well under 223. Both axes are checked.

If the designer moves a panel, the address stops resolving and the run fails
loudly. Re-run the inspector and update the coordinates — that beats silently
dropping the body artwork onto a shoulder.

### Sleeve naming — by the wearer's arm

`<slug>-sleeveleft` is the sleeve on the **player's left arm**, wherever that
lands on screen. The script maps it per view:

| view | picture-left slot | picture-right slot |
|---|---|---|
| front (mirrors the wearer) | `-sleeveright` | `-sleeveleft` |
| back (does not mirror) | `-sleeveleft` | `-sleeveright` |

**Why not name them by picture position?** Because sponsors cannot be mirrored.
The moment a sleeve carries one, left and right become genuinely different
artwork, and each file has to land on the same *physical* arm in both views. A
view-relative name puts it on the correct arm in one view and the wrong arm in
the other — and it looks entirely plausible in each shot taken alone.

For mirrored or plain sleeves none of this matters: ship one
`<slug>-sleeves.svg` and every sleeve slot in every view takes it.

### Sleeve sponsors — overlay layers

A sponsor cannot be mirrored, so it cannot live in a shared sleeve file. It gets
its own layer stacked on top of the base, inside the same slot:

```
<slug>-sleeves.svg              the base pattern, shared by both arms
<slug>-sleevesponsorleft.svg    sponsor for the player's LEFT arm
<slug>-sleevesponsorright.svg   sponsor for the player's RIGHT arm
<slug>-sleevesponsor.svg        fallback used for either arm that has no specific file
```

**Author the overlay at the same canvas as the base, transparent everywhere
except the sponsor.** Every layer is fitted to the slot canvas, so the sponsor
lands exactly where it was drawn — and since the slot mapping already knows
which picture-side is which arm, one file per arm is correct in **both** views.

Every case falls out of which files exist, with nothing to configure per design:

| situation | files to supply |
|---|---|
| no sponsor | none |
| left arm only | `-sleevesponsorleft` |
| right arm only | `-sleevesponsorright` |
| both arms, same sponsor | `-sleevesponsor` |
| both arms, different | `-sleevesponsorleft` **and** `-sleevesponsorright` |

The run reports what it stacked: `· overlaid: kit-sleevesponsorleft.svg`.

`over` works on any slot, not just sleeves — same pattern would serve a chest
badge or a hem tag that has to stay unmirrored.

⚠ **Requires `placeInside: true`.** `replaceContents` can only put one file in a
slot, so overlays are skipped and reported in that mode.

### `file` accepts a fallback list

`file: ['shoulderleft', 'shoulders']` means: use `<slug>-shoulderleft.svg` if it
exists, otherwise `<slug>-shoulders.svg`. Since the left and right shoulders are
usually the same artwork mirrored, a design can ship two files or one shared file
and neither needs a config change. Sleeves work the same way.

### Slots deliberately not configured

- **`TAPE DESIGN`** — always white, so leaving it alone keeps what the template
  already holds. Configuring it would mean generating an identical white file per
  design for no gain.
- **`INNER DESIGN`** — hidden in the template. Skipped automatically and
  reported, since replacing a hidden layer changes nothing in the export.
- **Back shoulders** — the back template's `SHOULDERS` layer is a solid fill,
  not a smart object, so back shoulders take a flat colour. Nothing to drop in.

**Trim kind names carry no internal hyphen** — `collarback`, not `collar-back`.
`findSlugs()` matches on a trailing `-<view>`, so `x-collar-back.svg` would be
read as a design called `x-collar` the day the lead view changes. Unhyphenated
kinds cannot collide under any ordering.

### Files per design

```
<slug>-front.svg           <slug>-collartop.svg       <slug>-shoulderleft.svg
<slug>-back.svg            <slug>-collarbottom.svg    <slug>-shoulderright.svg
<slug>-shorts.svg          <slug>-collarback.svg      <slug>-sleeveleft.svg
<slug>-belt.svg                                       <slug>-sleeveright.svg
```

…or drop `<slug>-shoulders.svg` / `<slug>-sleeves.svg` in place of the left/right
pairs.

Any number of designs at once. Each template is opened **once** and every design
run through it, which is where the time saving comes from on a batch.

## Partial sets — jersey only, front only, shorts only

**Nothing has to be complete.** These all work:

| what's in `artworkDir` | what comes out |
|---|---|
| all 8–12 files | front, back, shorts |
| no `-shorts` file | front + back; shorts reported as skipped |
| only `-front` | front only, collar/shoulders left at the template default |
| only `-shorts` | shorts only |
| only `-collartop` | nothing — a non-required file alone is not a design |

Three rules make that safe:

1. **A design is discovered from any REQUIRED file**, not from `-front`
   specifically. Scanning only the front would make a back-only or shorts-only
   run report "no designs found".
2. **A missing required file skips that view and says so** — `– kalikamis: no
   back artwork, view skipped`. That is a normal outcome, not an error, and it
   does not stop the other views or the other designs.
3. **A missing optional file leaves the template's placeholder**, and the log
   records it: `· template default kept for: collartop, collarbottom`.

### The trap that made this worth doing properly

Because a template stays open across the whole batch, a slot that *this* design
doesn't fill still contains the **previous** design's artwork. A front-only set
run after a full one would have silently inherited the last team's collar — and
it would look completely plausible.

So the builder tracks which slots hold previous artwork and **reopens the
template** whenever the current design doesn't fill all of them, resetting every
slot to the template's own placeholder first. Reopening costs a few seconds and
only happens on partial sets; a full batch never triggers it.

## Debugging a placement — `placeOnly`

When a slot lands wrong and you need to see *why* rather than infer it from the
export:

```js
placeOnly: true
```

The run places the **first** design into every template and then stops. No
export, no undoing of the rescale or nudge, and the documents are **left open**
so the placement can be inspected layer by layer — and exported by hand if the
result is what you wanted.

⚠ **The templates are open and modified. Close them without saving.** The script
cannot protect you here; leaving them open is the entire point of the mode.

Set it back to `false` for normal runs.

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
