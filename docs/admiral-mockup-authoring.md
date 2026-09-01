# Authoring artwork for the admiral mockup (learned on the EA Park request)

What we learned building a "fake raglan" design set for the Photoshop
mockup pipeline (`scripts/photoshop/build-jersey-mockups.jsx`) directly as
SVG, without ChatGPT PNG → vectorizer. Read this before authoring anything
for `admiral-psd.tif`. Numbers are in the cdm2 reference canvases unless
noted. Scripts: `scripts/photoshop/authoring/`.

## Canvases (author at exactly these, or the jsx scales and re-centres)

| kind | SVG canvas | slot's authoring size | notes |
|---|---|---|---|
| front | 2980 × 3936 | 4469 × 5904 | same aspect, scaled 0.667 |
| shoulders | 534.72 × 217.28 | 1671 × 679 | one file for both panels |
| sleeves | 1348 × 2494, viewBox 356.658 × 659.871 (mm) | 1348 × 2494 | one file, mirrored for the other arm (`mirrorX: 'shared'`) |
| collartop | 2000 × 336 | 1500 × 252 | |
| collarbottom | 2894.667 × 473.333 | 2171 × 355 | |

Files are matched by name: `<slug>-<kind>.svg`. Several slugs in
`artworkDir` build in one jsx run — use that to compare variants
(`build_eapark.py` has a `VARIANTS` table; make each variant test ONE thing,
or a clean 2×2).

## What the calibration grid showed (front view)

Built with `build_calib.py` (slug `calib`): a labelled 10 % grid per canvas,
A0 top-left. One export tells you which cells are visible and where seams
cut. **Do this first for any new template or view.**

Front (10 cols A–J of 298 px, 12 rows of 328 px):
- Row 0 (y < 330) is never visible — under shoulder panels and collar.
- Cols A and J hidden. Visible body ≈ x 440–2540 at the chest, narrowing
  to ≈ 520–2384 at the waist. The mask trims ~330 px per side at the chest
  and ~450 at the waist: anything nearer the edge does not exist.
- Collar meets the front at x ≈ 880 / 2100. Armpit at y ≈ 1450–1500 on
  the visible edge. Hem cuts row 11 at y ≈ 3770.
- **Centre: the visible shirt is NOT centred on the canvas.** Designs
  mirrored about x = 1490 come out shifted right (left side stripe visible,
  right one lost). cdm2's own logos were centred on x ≈ 1401. Working
  assumption for next time: mirror axis ≈ 2800, then verify on the calib
  export. This was never fixed on EA Park.

Sleeves (6 cols of 59.4 mm, 12 rows of 55 mm):
- Rows 0–1 (y < 110 mm) sit under the shoulder panel. Col A hidden (back
  of the arm). Col F = body side, cols A/B = outer edge of the arm.
- Cuff band row: y 588–613 mm (cdm2's gold band was 600–613).

Shoulders (10 cols of 53.5, 4 rows of 54.3):
- Rows 2–3 (y 108–217) read clearly; row 1 IS visible too, foreshortened
  over the top of the shoulder — bands placed at y < 108 still show. Only
  row 0 is safe to assume hidden.
- Col A = sleeve end, col J = neck. Bottom edge y = 217 is the seam with
  the front. In the export the panel's bottom edge and the sleeve top meet
  at the shoulder point; getting a line to run continuously across that
  junction is still unsolved (see below).

Collar: collartop y 66–122 is the visible rim; collarbottom y 194–273 is
the visible front band. Tri-colour bands there rendered right first time.

## The raglan look on a set-in mockup — what finally worked

Concept: blue body, white raglan sleeves, red piping, blue line over the
shoulder continuing down the outside of the arm.

- **Shoulder panel = entirely body colour**, red pipe (9 units) along its
  bottom edge (y ≈ 206). No white on the shoulder — this was the recurring
  mistake for five rounds; the white raglan is the sleeve and the wedge on
  the front only.
- **Sleeve** = white, thin blue line along the outer edge (x < ~88 mm,
  tapering to ~76 at the cuff) with the red pipe on its inner edge; cuff
  bands red / white / blue at 588–613 mm.
- **Front seam** = one path per side, drawn as: vertical along the armhole
  (x ≈ 465–500) from the armpit up to logo height (y ≈ 620), then curving
  in to the collar (x ≈ 900, y ≈ 250). The white wedge is only the shoulder
  corner above logo height; the blue keeps full width below. The same path
  continues below the armpit as the side stripe (red 44, white 40 outside
  at −95, white 16 inside at +85), bowing in at the waist, out at the hem.
- Logos moved inboard of the seam: momuto centre x 1060, crest 1920
  (recentre once the true axis is confirmed).
- Wordmark: Kaushan Script (OFL) as outlines, 1400 wide, baseline 1640.

Best export so far: the "eapark" / "alt" pair from
`build_eapark.py` (final state committed here).

## Still open

1. Centring (above).
2. Shoulder-to-sleeve junction: the panel's red pipe and the sleeve's blue
   line do not meet cleanly at the shoulder point. Needs the real panel
   outlines, not more guessing.
3. Real crest and possibly a more calligraphic wordmark font.
4. Back, shorts, sleeve sponsor: not started.

## Process rules (the expensive lessons)

- **Ask for the PARTS mask layers as PNGs** (FRONT, both SLEEVE,
  SHOULDERS, COLLAR solid fills, each exported alone at template size)
  before authoring anything with seams. Every eyeballed geometry guess cost
  a full round.
- **Screenshots pasted into chat never reach the sandbox disk.** Ask for
  the export as an uploaded file, then measure pixels; do not read cells
  by eye from a compressed preview.
- Author vectors directly for geometric kits; keep the vectorizer for
  organic patterns. Convert text to outlines (fontTools) so Photoshop
  needs no fonts. Google Fonts are fetchable from
  `raw.githubusercontent.com/google/fonts` in the sandbox.
- cairosvg (the local preview renderer) has no `hsl()` — use hex. Its
  white-on-grey previews are easy to misread; check pixels, not eyes.
- `mockups/artwork/**` triggers the Generate Mockups workflow on ANY branch
  push — keep request artwork out of it.
