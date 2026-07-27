# Sleeve sponsor reference

**The uploads originally asked for here are no longer needed.** The question they
were meant to settle has been answered by changing the script instead. Kept as a
drop folder in case a specific sponsor case ever needs checking.

## What the question was

The front and back templates give the same physical sleeve **different
canvases** — front measures 1348×2494 and 1348×2520, back its own. Overlays used
to be fitted to the whole slot canvas, so a sponsor's position had to be baked
into the artwork. That only works if the sponsor sits at the same *relative*
position in every canvas, which there is no reason to expect. The fallback was
going to be splitting the overlay kinds per view —
`sleevesponsorleftfront` / `sleevesponsorleftback` — i.e. four files instead of
two, hand-positioned each time.

## What it does now

The position moved off the artwork and onto the **slot**:

```js
over: [{ file: ['sleevesponsorleft', 'sleevesponsor'], box: SPONSOR.frontLeftArm }]
```

`box` is `[x, y, w, h]` in that slot's own canvas. Each of the four sleeve slots
declares where a sponsor goes in its own coordinates, so differing canvases stop
mattering — one file per arm is correct in both views, and the file itself is
just the logo on transparency at whatever size it happens to be. It is fitted
into the box preserving aspect and centred, so a wide wordmark and a square badge
come out the same height rather than both stretched to the same rectangle.

Sponsor artwork is therefore named by the **wearer's arm**, same as the sleeves:

```
<slug>-sleevesponsorleft.svg    the player's LEFT arm, both views
<slug>-sleevesponsorright.svg   the player's RIGHT arm, both views
<slug>-sleevesponsor.svg        same mark on both arms
```

Any of them may be absent. Left only, right only, both the same, both different —
all fall out of which files exist.

## The four boxes still need measuring once

`SPONSOR` in `build-jersey-mockups.jsx` holds four `null`s. Until they are filled
in, a sponsor file is dropped in at full canvas — the old behaviour, correct only
if the file was authored that way.

Getting the numbers takes one pass, and does not need measuring by hand:

1. Open a jersey mockup you assembled **by hand**, with the sponsors where you
   want them, in both the front and the back template.
2. Run `inspect-template.jsx` on each.
3. Under every sleeve slot the dump now lists its inner layers with
   `box: [x, y, w, h]` — in that slot's coordinates, which is the same space the
   builder places into. The sponsor layer's line is the value to paste.
4. Paste the four into `SPONSOR` at the top of the builder.

They are a property of the templates, not of any design, so this is once and
never again.
