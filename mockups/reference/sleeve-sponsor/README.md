# Sleeve sponsor reference

Four hand-built sleeves with the sponsor where it belongs, one per sleeve slot:

```
sleeves-front-left.svg    sleeves-front-right.svg
sleeves-back-left.svg     sleeves-back-right.svg
```

Named by **picture side**. All four are 1348×2494 with three layers: `base`,
`pattern`, `sponsor`.

These are the source of the `SPONSOR` table in
`scripts/photoshop/build-jersey-mockups.jsx`. Keep them: if a template is ever
replaced, they are what the new boxes get measured against.

## What they establish

**The arm pairing, from the files rather than from reasoning.** `front-left` and
`back-right` carry an identical `pattern` transform and a near-identical file
size; so do `front-right` and `back-left`. Picture-left in the front view is
therefore the same physical arm as picture-right in the back view — which is what
the slot mapping already assumed, now confirmed.

Note the mismatch in vocabulary: these reference files are named by picture side,
but production artwork is named by the **wearer's arm** (`-sleeveleft` is the
player's left arm, whichever side of the picture it lands on). That is why
`front-left` here supplies `SPONSOR.frontRightArm`.

**Height is what sizes a sponsor.** Both front marks are exactly 180 tall while
their aspect ratios differ (1.3078 and 1.1313), so the height is the standard and
the width is whatever the logo happens to be. The builder therefore scales by the
box height and uses the box width only to centre — fitting the mark into the
rectangle on both axes would look identical on these two files and then quietly
undersize the first sponsor wider than its box.

**One size cannot serve both views.** Within an arm it is plainly the same logo —
the aspect matches to four decimals — but not the same size:

| arm | front | back |
|---|---|---|
| player's right (`front-left`, `back-right`) | 235.40 × **180** | 215.79 × **165** |
| player's left (`front-right`, `back-left`) | 203.64 × **180** | 220.61 × **195** |

So a size baked into the artwork would be wrong in one view of each pair. This is
why position and size live on the **slot**, as fractions of that slot's canvas,
and the sponsor file is just the mark.

⚠ **The back pair does not agree with itself.** 165 and 195 is an 18% spread
where the front has none, and their mean is exactly 180. The back template renders
its two sleeves at within 1% of the same scale, so there is no reason for the same
standard to come out different sizes — this looks like hand-jitter around 180
rather than intent. Left as measured, because these files are what was shipped by
hand and reproducing them exactly is the safe default. To unify, set both back
heights in `SPONSOR` to `0.272781` (the same 180).

**The boxes**, as fractions of the canvas — `[x, y, w, h]`, origin top-left:

| file | → | fraction |
|---|---|---|
| `sleeves-front-left`  | `SPONSOR.frontRightArm` | `[-0.146135, 0.568293, 0.660022, 0.272781]` |
| `sleeves-front-right` | `SPONSOR.frontLeftArm`  | `[ 0.458909, 0.585520, 0.570956, 0.272781]` |
| `sleeves-back-left`   | `SPONSOR.backLeftArm`   | `[-0.064312, 0.561373, 0.618536, 0.295512]` |
| `sleeves-back-right`  | `SPONSOR.backRightArm`  | `[ 0.476647, 0.568293, 0.605020, 0.250049]` |

Negative x and widths running past the edge are correct. The panel wraps around
the arm, so a mark near the outer edge genuinely extends past the canvas and the
overflow is the part that disappears around the back of the sleeve.

## Supplying sponsors in production

Named by the wearer's arm, same as the sleeves themselves:

```
<slug>-sleevesponsorleft.svg    the player's LEFT arm, both views
<slug>-sleevesponsorright.svg   the player's RIGHT arm, both views
<slug>-sleevesponsor.svg        same mark on both arms
```

Any may be absent — left only, right only, both the same, both different all fall
out of which files exist.

⚠ **Crop tight to the mark**, no transparent margin. The fit measures the placed
layer's bounds, so padding inside the file becomes padding inside the box and the
mark lands small and off-centre. In Inkscape: select the mark, then
File ▸ Document Properties ▸ Resize page to drawing.
