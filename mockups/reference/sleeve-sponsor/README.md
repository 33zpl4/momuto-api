# Sleeve sponsor reference

Drop example files here so the sponsor's size and position can be verified
against the four sleeve slots before the convention is fixed.

## What to upload

Four **finished sleeves as you would hand-make them**, sponsor included:

```
example-front-armleft.svg     the player's LEFT arm, as it appears in the FRONT view
example-front-armright.svg    the player's RIGHT arm, front view
example-back-armleft.svg      the player's LEFT arm, BACK view
example-back-armright.svg     the player's RIGHT arm, back view
```

Plus, if you have them, the **sponsor overlays alone** — transparent except for
the sponsor, at the slot canvas size:

```
example-sponsoronly-armleft.svg
example-sponsoronly-armright.svg
```

Naming here is deliberately explicit (`armleft`, not `left`) because the whole
question is whether picture-side and arm agree, and short names hide that.

## The question these answer

The front and back templates have **different sleeve slots with different
canvases**. Front measures 1348×2494 and 1348×2520; the back's are unknown (its
dump predates the size read — re-run `inspect-template.jsx` on it).

`over:` fits every overlay to its slot canvas, so **one sponsor file per arm
serves both views only if the sponsor sits at the same RELATIVE position in
each canvas** — same fraction across, same fraction down.

If it does: one file per arm, as designed.
If it does not: the overlay kinds need to split per view, e.g.
`sleevesponsorleftfront` / `sleevesponsorleftback`. Cheap to change, but only
worth doing if the measurements say so.

That is what these examples settle.
