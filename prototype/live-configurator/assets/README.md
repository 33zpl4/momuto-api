# Live configurator — proof-of-concept assets

Drop the real source files here so the live WebGL displace-and-shade demo
can be built around the **actual** mockup (not placeholders).

## What to upload (one garment is enough to start)

Use the `admiral` jersey from the screenshots. Filenames matter only for the
README; the build will reference whatever you drop here.

| Slot | File | Notes |
|---|---|---|
| Mockup source | `admiral-psd.tif` (or `.psd`) | The Photoshop mockup with the Smart Objects + masks. This is where the realism lives. |
| Front artwork | `pipiche-front.svg` | The Inkscape design. Keep `rect499` = base color element. |
| Sleeve artwork | `pipiche-sleeve.svg` | Sleeves + cuffs, same structure. |
| Reference render | `iran-heritage-front.png` | The exported PNG you currently ship — used as the visual target to match. |

### Even better (optional, speeds things up a lot)
If you can flatten these *out* of the Smart Object, drop them too — they're the
three maps the live preview actually needs:

- `displacement.png` — the fabric-fold displacement map (grayscale)
- `shading.png` — shadow (multiply) + highlight (screen) baked to grayscale
- `mask-body.png`, `mask-sleeve.png`, `mask-cuff.png` — the zone masks

If you can't easily export these, just upload the `.tif` and I'll extract them.
