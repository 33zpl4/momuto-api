// ============================================================================
// build-jersey-mockups.jsx — batch the drag-and-drop step.
//
// One template PSD per view, each with several drop-in smart objects and its own
// export size. Point it at a folder of raw artwork and it produces whatever
// views that artwork supports — all three, or just the front, or just shorts.
//
// Photoshop ▸ File ▸ Scripts ▸ Browse… ▸ pick this file.
//
// Entirely local: opens files, exports files, nothing else. No network at any
// point, so it behaves identically with wifi off.
//
// Afterwards, instead of tinypng.com:
//   node compress-mockups.js <outDir>
// ============================================================================

#target photoshop

var VERSION = '2026-09-01b · sleeve raise in the units it was asked in (~13px on export)';

// ── Where a sponsor sits on each sleeve, as FRACTIONS of that slot's own canvas:
//    [x, y, w, h], 0..1, origin top-left.
//
//    Fractions rather than pixels because the same physical sleeve gets a
//    different canvas in each template — the front's two sleeve slots are
//    1348×2494 and 1348×2520, and the back's are different again. A fraction is
//    the same place in all of them; a pixel count is not.
//
//    Values off the 0..1 range are correct, not typos. The panel wraps around the
//    arm, so a sponsor near the outer edge genuinely runs past the canvas and the
//    overflow is the part that disappears around the back of the sleeve.
//
//    Measured from mockups/reference/sleeve-sponsor/sleeves-{front,back}-{left,right}.svg,
//    which are hand-built sleeves with the sponsor where it belongs. Those files
//    are named by PICTURE SIDE; these keys are by the WEARER'S ARM, which is why
//    front-left maps to frontRightArm. The reference files prove the pairing:
//    front-left and back-right carry an identical `pattern` transform, so they
//    are the same physical arm.
//
//    HEIGHT IS WHAT SIZES A SPONSOR. The two front marks are both exactly 180
//    tall with aspect ratios of 1.3078 and 1.1313, so the height is the standard
//    and the width is whatever the logo happens to be. The box width is used
//    only to centre. (That is `fit: 'height'`, the default for an overlay.)
//
//    ⚠ The back heights do not agree: 165 on the right arm, 195 on the left —
//    an 18% spread, where the front has none. Their MEAN is exactly 180, and the
//    back template renders its two sleeves at within 1% of the same scale, so
//    this looks like hand-jitter around a 180 standard rather than an intended
//    difference. Left as measured, because these files are what was shipped by
//    hand and reproducing them exactly is the safe default. To unify instead,
//    set both back heights to 0.272781 — the same 180 the front uses.
//
//    To re-measure after a template change: run inspect-template.jsx on a
//    hand-made mockup. Each slot now lists its inner layers with a box in that
//    slot's coordinates; divide by the slot canvas printed on the line above.
//
//    SPONSOR_RAISE lifts every sponsor off the measured position. The reference
//    sleeves are the hand-made baseline; this is the correction on top of them,
//    kept separate so the measurement stays visible and the adjustment stays one
//    number. 15 px is in the sleeve's own 1348×2494 canvas — the space the SVGs
//    are drawn in — which is about 8% of the mark's own height.
var SPONSOR_RAISE = 15 / 2494;

// ── How far to lift the sleeve ARTWORK inside its own canvas, so the cuff band
//    at the bottom of the panel clears the template's mask.
//
//    Applies to all four sleeve slots equally, and that is the point. This
//    correction previously existed on the front picture-left slot alone, which
//    is why the two sides did not match: one sleeve's cuff had been brought into
//    view and the other three had not.
//
//    It also used to be a `nudgePct`, which moves the whole smart object — mask
//    unlinked — and therefore dragged the sleeve's SPONSOR up with it. That gave
//    one sleeve's sponsor SPONSOR_RAISE twice over while the other three got it
//    once. As a base offset it moves the panel only, so every sponsor now sits at
//    exactly SPONSOR_RAISE.
//
//    80 px of the sleeve's own 1348×2494 canvas ≈ 12–13 px in the exported 1500
//    image. The units matter and got this wrong once: "raise it 15 px" was read
//    as 15 px of the SVG canvas, which is only 2.4 px in the export — about a
//    sixth of what was asked for, and why one raise later it was still short.
//
//    The conversion is f × H × export/template, where H is the slot's full
//    transform height. H is not directly readable (bounds report the MASKED
//    extent), so 15 export px is somewhere between 66 and 104 canvas px
//    depending on how much of the sleeve the mask hides. 80 is the middle of
//    that band.
//
//    To tune from a render: this is roughly 6.3 canvas px per export px, so
//    "needs 4 px more" is +25 here. Overshooting shows as cream appearing below
//    the band — easy to read, so err high rather than creep up.
var SLEEVE_RAISE = 80 / 2494;

var SPONSOR = {
  frontRightArm: [-0.146135, 0.568293 - SPONSOR_RAISE, 0.660022, 0.272781],   // front template, picture-LEFT slot
  frontLeftArm:  [ 0.458909, 0.585520 - SPONSOR_RAISE, 0.570956, 0.272781],   // front template, picture-RIGHT slot
  backLeftArm:   [-0.064312, 0.561373 - SPONSOR_RAISE, 0.618536, 0.295512],   // back template, LEFT SLEEVE DESIGN
  backRightArm:  [ 0.476647, 0.568293 - SPONSOR_RAISE, 0.605020, 0.250049]    // back template, RIGHT SLEEVE DESIGN
};

// ── SET THESE THREE ONCE. They persist in this file; you never touch them again.
//    Only the contents of artworkDir changes from design to design.
//    Windows paths use FORWARD slashes.
var CONFIG = {
  artworkDir:   'C:/Users/ayala/momuto/incoming',      // drop the .svg sets here
  outDir:       'C:/Users/ayala/momuto/mockups-out',   // created if missing
  templatesDir: 'C:/Users/ayala/momuto/templates',     // the template files

  // ── Slot addressing ──────────────────────────────────────────────────────
  // `layer` alone  → every visible layer of that name gets the same file.
  // `layer` + `at` → only the copy whose top-left corner is at [x, y].
  //
  // `at` exists because admiral-psd has THREE layers called 'JERSEY DESIGN'
  // (body plus both shoulder panels) and TWO called 'SLEEVE DESIGN'. Names
  // cannot separate them; positions can. Coordinates come straight from
  // inspect-template.jsx and are matched within AT_TOLERANCE px.
  //
  // `file` may be a list — the first artwork that exists wins. So a design can
  // supply <slug>-shoulderleft.svg and -shoulderright.svg separately, or a
  // single shared <slug>-shoulders.svg, with no config change either way.
  //
  // SLEEVE NAMING IS BY THE WEARER'S ARM, not by position in the picture.
  // <slug>-sleeveleft is the sleeve on the player's LEFT arm, wherever that
  // ends up on screen. The front view mirrors the wearer, so that file goes
  // into the RIGHT-hand slot on the front and the LEFT-hand slot on the back.
  //
  // Naming by picture position would be simpler right up until a sleeve carries
  // a sponsor: sponsors cannot be mirrored, so left and right sleeves become
  // genuinely different artwork, and one file per arm has to land on the same
  // physical arm in both views. Anything view-relative puts it on the wrong arm
  // in one of them.
  //
  // For mirrored or plain sleeves this is all moot — ship one <slug>-sleeves.svg
  // and both slots in both views take it.
  //
  // `over: [...]` stacks EXTRA artwork on top of the base, inside the same
  // slot. Each entry is optional — absent means that layer is not added — and
  // comes in two forms:
  //
  //   'sleevesponsorleft'                        full canvas, as-is
  //   { file: [...], boxPct: [x, y, w, h] }      sized and centred on that box, 0..1
  //   { file: [...], box:    [x, y, w, h] }      same, in slot pixels
  //
  // `fit` decides how the box sizes the mark: 'height' (default) scales by the
  // box height and lets the width follow the logo's aspect; 'contain' keeps it
  // inside on both axes. Sponsors want 'height' — see SPONSOR at the top.
  //
  // This is how sleeve sponsors work. A sponsor cannot be mirrored, so it must
  // be its own layer rather than baked into a mirrored base. Because the slot
  // mapping already knows which picture-side is which arm, one file per arm is
  // correct in BOTH views.
  //
  // Use `boxPct`, and see SPONSOR at the top for why fractions. The sponsor
  // artwork is then just the logo on transparency, at any size, carrying no
  // position of its own — the slot supplies the position.
  //
  // CROP THE SPONSOR FILE TIGHT to the mark: no transparent margin. The fit
  // measures the placed layer's bounds, so padding inside the file becomes
  // padding inside the box and the mark comes out small and off-centre.
  //
  // The box preserves aspect and centres, so a wide wordmark and a square badge
  // both come out at the same height rather than both stretched to fit.
  //
  // The bare-kind form still works and means "authored at the full sleeve canvas
  // with the sponsor already in position" — fine if that is how the file was
  // built, but it needs a separate file per view.
  //
  // Every combination falls out of which files exist: left only, right only,
  // both the same, both different. Nothing to configure per design.
  //
  // ⚠ Requires placeInside — replaceContents can only put ONE file in a slot.
  //
  // `mirrorX` flips ONLY the base artwork horizontally inside that slot.
  // Overlays (especially sleeve sponsors) are NOT flipped, so text and logos stay
  // readable. This lets one shared <slug>-sleeves.svg feed both sleeves while
  // compensating for the opposite UV direction of the picture-right sleeve.
  //
  //   'shared'  flip only when the file came from the SHARED fallback
  //   true      flip always
  //
  // Use 'shared'. With `file: ['sleeveleft', 'sleeves']`, a design that supplies
  // -sleeveleft.svg drew it for that arm already, and flipping it would reverse
  // artwork that was correct — any text or badge baked into the panel would come
  // out backwards. Only the shared file, reused on the opposite arm, needs it.
  // The run reports which way each slot went.
  //
  // `baseOffsetPct: [dx, dy]` shifts the BASE artwork inside its own canvas, as a
  // fraction of that canvas. Positive dy is DOWN.
  //
  // This is what brings a sleeve's cuff band up past the template's mask. It is
  // deliberately NOT `nudgePct`: that moves the whole smart object, so it drags
  // the slot's sponsor along with the panel. A base offset moves the panel alone
  // and leaves every overlay where its box put it.
  //
  // Units: a fraction of the ARTWORK canvas, not of the export. On the sleeves
  // one export pixel is about 6.3 canvas pixels, so a correction read off a
  // render has to be multiplied up — getting that backwards made the first cuff
  // raise a sixth of what was asked for. See SLEEVE_RAISE.
  //
  // The shift vacates a strip at the trailing edge, which is NOT covered by
  // default: the reason to shift is that the canvas edge is outside the mask,
  // which is the same reason the strip cannot show. `baseBleed: true` covers it
  // anyway if that turns out to be wrong — at the cost of enlarging the artwork
  // by twice the shift, which on a patterned kit mismatches the body's scale.
  //
  // `required: true` means the view cannot be exported without that artwork.
  // Everything else is OPTIONAL: if the file is absent the slot keeps the
  // template's own placeholder and the run reports it. That is what makes a
  // front-only approval set work without generating collar and shoulder files.
  //
  // `nudge: [dx, dy]` shifts the slot in TEMPLATE px before export and shifts it
  // BACK afterwards, so a batch never accumulates offsets. Positive dy is DOWN,
  // so "left sleeve up 25px" is nudge: [0, -25].
  //
  // `nudgePct: [dx, dy]` does the same in fractions of the slot's own rendered
  // size. Prefer it: the artwork canvas is mapped onto that extent, so a
  // fraction of the canvas is the same fraction here, and "15 px in the sleeve
  // SVG" is written as -15/2494 whatever the template scales it to. Template px
  // would have to be recomputed per template — 15 sleeve px is 10 px on the
  // front template and a different number on the back.
  //
  // `tint: ['LAYER', …]` recolours the template's own solid-fill layers to this
  // slot's artwork. The stitching on the shorts is white in the template, which
  // reads as piping rather than thread on any kit that is not white — so it takes
  // the leg's own colour.
  //
  // The colour is the artwork's DOMINANT one, read from the channel histograms of
  // the rasterised .psb. Not a sampled pixel: there is no coordinate that is base
  // fabric in every design, so a fixed sample point would land on a stripe in one
  // kit and a crest in the next. The run logs the hex it used.
  //
  // `tintColour: 'RRGGBB'` on the slot forces a colour instead of sampling — for
  // a design split so evenly between two colours that "dominant" is a coin toss.
  //
  // ⚠ Sampling needs placeInside. With replaceContents the artwork is never
  // rasterised anywhere this script can read, so only tintColour works.
  //
  // Only the FIRST tinting slot of a view applies, so two legs cannot fight over
  // the same layer.
  //
  // `expect: [w, h]` is the slot's own SOURCE canvas, measured by
  // inspect-template.jsx. It is only used when placeInside is FALSE — see the
  // note on placeInside at the bottom of this block. In the default mode the
  // artwork is fitted to the .psb canvas from the inside, which needs no
  // outside estimate, so `expect` is advisory: matching it saves a resample and
  // nothing more.
  //
  // `count` asserts how many layers the address resolves to. If a template is
  // edited and the number shifts, the run STOPS — a silently unreplaced
  // shoulder panel is the exact failure this prevents.

  templates: [
    {
      psd: 'admiral-psd.tif',                        // 6200×6200
      suffix: 'front',
      size: 1500,
      slots: [
        { layer: 'JERSEY DESIGN', at: [1725, 959],  file: 'front',                        count: 1, required: true, expect: [4469, 5904] },
        { layer: 'JERSEY DESIGN', at: [1723, 736],  file: ['shoulderleft',  'shoulders'], count: 1, expect: [1671, 679] },
        { layer: 'JERSEY DESIGN', at: [3596, 746],  file: ['shoulderright', 'shoulders'], count: 1, expect: [1671, 679] },
        // Front view mirrors the wearer: picture-left is the player's RIGHT arm.
        // Both sleeves take the SAME raise, which is the fix for left and right
        // not matching — only this first one used to have it.
        { layer: 'SLEEVE DESIGN', at: [1242, 995],  file: ['sleeveright',   'sleeves'],   count: 1, expect: [1348, 2494],
          baseOffsetPct: [0, -SLEEVE_RAISE],
          over: [{ file: ['sleevesponsorright', 'sleevesponsor'], boxPct: SPONSOR.frontRightArm }] },
        { layer: 'SLEEVE DESIGN', at: [3845, 1040], file: ['sleeveleft',    'sleeves'],   count: 1, expect: [1348, 2520],
          baseOffsetPct: [0, -SLEEVE_RAISE], mirrorX: 'shared',
          over: [{ file: ['sleevesponsorleft',  'sleevesponsor'], boxPct: SPONSOR.frontLeftArm }] },
        { layer: 'COLLAR TOP',    file: 'collartop',    count: 1, expect: [1500, 252] },
        { layer: 'COLLAR BOTTOM', file: 'collarbottom', count: 1, expect: [2171, 355] }
        // TAPE DESIGN is deliberately absent — it stays white, so leaving the
        // slot untouched keeps whatever the template already holds.
        // INNER DESIGN is hidden in the template and is skipped automatically.
      ]
    },
    {
      psd: '52183 - Men\u2019s Crew Neck Soccer Jersey Mockup - Back View.tif',   // 6000×6000
      suffix: 'back',
      size: 1500,
      slots: [
        { layer: 'JERSEY DESIGN',       file: 'back',                     count: 1, required: true },
        // Back view does not mirror: the template's LEFT/RIGHT are picture-side,
        // and picture-left is the player's LEFT arm from behind.
        { layer: 'LEFT SLEEVE DESIGN',  file: ['sleeveleft',  'sleeves'], count: 1,
          baseOffsetPct: [0, -SLEEVE_RAISE],
          over: [{ file: ['sleevesponsorleft',  'sleevesponsor'], boxPct: SPONSOR.backLeftArm }] },
        { layer: 'RIGHT SLEEVE DESIGN', file: ['sleeveright', 'sleeves'], count: 1,
          baseOffsetPct: [0, -SLEEVE_RAISE], mirrorX: 'shared',
          over: [{ file: ['sleevesponsorright', 'sleevesponsor'], boxPct: SPONSOR.backRightArm }] },
        { layer: 'COLLAR DESIGN',       file: 'collarback',               count: 1 }
        // No shoulder slots on the back template — its SHOULDERS layer is a
        // solid fill, not a smart object, so back shoulders take a flat colour.
      ]
    },
    {
      psd: '141087-mens-shorts.tif',                 // 5000×5000
      suffix: 'shorts',
      size: 1000,
      slots: [
        // The legs are NOT interchangeable — they carry different logos — so they
        // take separate files, named by the WEARER'S leg like the sleeves.
        //
        // Addressed by position, not by the template's L/R names: this is a front
        // view (the laces show), so it mirrors the wearer and the template's
        // picture-left 'L LEG' is the player's RIGHT leg. Trusting the names here
        // would put every leg logo on the wrong leg.
        //
        // '-shorts' remains as the fallback, so a design whose legs really are
        // the same still ships one file.
        //
        // `tint` recolours the template's own STITCHING fill to this artwork's
        // dominant colour, so the seams read as thread on the fabric instead of
        // white piping. Taken from the left leg; put `tintColour: 'RRGGBB'` on
        // the slot to force a specific colour instead of sampling.
        { layer: 'L LEG DESIGN',  at: [954, 965],  file: ['shortsright', 'shorts'], count: 1, required: true,
          tint: ['STITCHING'] },
        { layer: 'R LEG DESIGN',  at: [2072, 861], file: ['shortsleft',  'shorts'], count: 1, required: true },
        { layer: 'BELT DESIGN',   file: 'belt',    count: 1 }   // the waistband
      ]
    }
  ],

  // ── Kit sheet ────────────────────────────────────────────────────────────
  // Front, back and shorts composited onto one transparent canvas, built after
  // the three views and only when a design produced all three IN THIS RUN — an
  // old back left in outDir must not be pasted next to a new front.
  //
  // NOTHING IS RESCALED. The pieces go down at their native pixel size and only
  // the finished sheet is resized.
  //
  // The templates already render every garment at a consistent real-world scale —
  // that is why the shorts come out smaller than the jerseys without anyone
  // asking. Sizing the pieces here would throw that away and then approximate it
  // back by eye, which is how the shorts end up subtly too big or too small.
  // The frames differ (1500 for the jerseys, 1000 for the shorts) but the
  // garments inside them are to scale, and trimming to the garment is what
  // exposes that.
  //
  // So the only layout decisions left are the spacing:
  //
  //   gap     [between the jerseys, between the row and the shorts], as
  //           fractions of the front garment's own width and height
  //   margin  breathing room around the group, as a fraction of the square
  //
  // The sheet is trimmed to the garments, padded to a square, then resized to
  // `size` in one step — so the output is square with no distortion, whatever
  // shape the group turns out to be.
  kit: {
    enabled: true,
    suffix: 'kit',
    size: 1500,
    gap: [0.25, 0.08],
    margin: 0.05
  },

  // Tried in order. Photoshop places SVG into a smart object when the slot was
  // authored from vector; if a replace throws on .svg, export PNG at ~2× the
  // slot's bounds (the inspector prints them) and drop that in instead.
  extensions: ['svg', 'png', 'tif', 'psd'],

  format: 'png',  // 'png' (what the proposal pages use) or 'jpg'

  // DEBUG. Place the FIRST design into every template, then stop: no export, no
  // undo of the rescale/nudge, and the documents are LEFT OPEN so the placement
  // can be inspected and exported by hand. Set back to false for normal runs.
  //
  // ⚠ The templates are open and MODIFIED. Close them WITHOUT saving.
  placeOnly: false,

  // HOW artwork gets into a slot. Two genuinely different operations:
  //
  //  false — replaceContents. Substitutes the smart object's content with the
  //          file itself, so the slot ends up holding an SVG. Double-clicking
  //          it opens the SVG in your browser, not in Photoshop. Fast.
  //
  //  true  — open the slot's .psb, PLACE the artwork inside it as a layer
  //          scaled to that canvas, save, close. This is exactly the manual
  //          drag-and-drop, so it renders exactly like a hand-made mockup.
  //          Slower (a save per slot) and the template reopens per design.
  //
  // Use true when the output must match a hand-made mockup. `expect` and the
  // rescale compensation are ignored in that mode — the artwork is fitted to
  // the .psb canvas directly, which is the same thing done properly.
  placeInside: true
};

// Two slots on the same template are never within this many px of each other —
// the closest pair (body 1725,959 vs left shoulder 1723,736) differs by 223 in y.
var AT_TOLERANCE = 50;

// ---------------------------------------------------------------------------

// EVERY layer of that name, not the first.
function findLayers(container, name, found) {
  for (var i = 0; i < container.layers.length; i++) {
    var l = container.layers[i];
    if (l.typename === 'LayerSet') { findLayers(l, name, found); continue; }
    if (l.name === name) found.push(l);
  }
  return found;
}

function topLeft(layer) {
  var b = layer.bounds;
  return [Math.round(b[0].as('px')), Math.round(b[1].as('px'))];
}

function atPosition(layers, at) {
  var hits = [];
  for (var i = 0; i < layers.length; i++) {
    var tl = topLeft(layers[i]);
    if (Math.abs(tl[0] - at[0]) <= AT_TOLERANCE && Math.abs(tl[1] - at[1]) <= AT_TOLERANCE) hits.push(layers[i]);
  }
  return hits;
}

/**
 * A smart object's layer mask is normally LINKED to the layer, so translating
 * moves mask and content together and nothing appears to shift. Unlink first,
 * move, relink. Wrapped because if the action ever changes name the nudge should
 * degrade to a no-op, not kill the run.
 */
function setMaskLinked(linked) {
  try {
    var d = new ActionDescriptor();
    var r = new ActionReference();
    r.putEnumerated(charIDToTypeID('Lyr '), charIDToTypeID('Ordn'), charIDToTypeID('Trgt'));
    d.putReference(charIDToTypeID('null'), r);
    var props = new ActionDescriptor();
    props.putBoolean(stringIDToTypeID('userMaskLinked'), linked);
    d.putObject(charIDToTypeID('T   '), charIDToTypeID('Lyr '), props);
    executeAction(charIDToTypeID('setd'), d, DialogModes.NO);
    return true;
  } catch (e) { return false; }
}

/**
 * Undo the size difference between the artwork and the slot's own canvas.
 *
 * Handles a non-matching aspect ratio too, by scaling each axis independently —
 * which distorts, but distorting is visibly wrong and therefore better than
 * silently cropping or letterboxing the design.
 */
function rescaleLayer(doc, layer, fromWH, toWH) {
  var sx = toWH[0] / fromWH[0] * 100;
  var sy = toWH[1] / fromWH[1] * 100;
  if (Math.abs(sx - 100) < 0.01 && Math.abs(sy - 100) < 0.01) return false;
  doc.activeLayer = layer;
  var hadMask = setMaskLinked(false);
  layer.resize(sx, sy, AnchorPosition.MIDDLECENTER);
  if (hadMask) setMaskLinked(true);
  return true;
}

/**
 * A slot's shift in template px, whichever way it was specified.
 *
 * nudgePct is a fraction of the layer's own rendered size. The artwork canvas is
 * mapped onto that extent, so a fraction of the canvas and a fraction of the
 * rendered size are the same fraction — which is what lets a correction be
 * written in the units of the SVG being drawn.
 *
 * Approximate to the extent that bounds report the MASKED extent rather than the
 * full transform, so a slot whose artwork runs well past its mask shifts slightly
 * less than asked. Under a percent here, and it errs small.
 */
function resolveNudge(slot, layer) {
  if (slot.nudge) return [slot.nudge[0], slot.nudge[1]];
  if (!slot.nudgePct) return null;
  var b = layerBox(layer);
  return [slot.nudgePct[0] * b.w, slot.nudgePct[1] * b.h];
}

function nudgeLayer(doc, layer, dx, dy) {
  if (!dx && !dy) return;
  doc.activeLayer = layer;
  var hadMask = setMaskLinked(false);
  layer.translate(UnitValue(dx, 'px'), UnitValue(dy, 'px'));
  if (hadMask) setMaskLinked(true);
}

/**
 * The manual workflow, scripted: open the slot's .psb, place the artwork inside
 * as a layer, scale it to that canvas, save, close.
 *
 * Saving an embedded .psb writes straight back into the parent document, so the
 * slot updates the moment it closes. The parent template is still closed
 * without saving at the end of the run, so nothing on disk changes.
 */
function layerBox(pl) {
  var b = pl.bounds;
  return {
    x: b[0].as('px'), y: b[1].as('px'),
    w: b[2].as('px') - b[0].as('px'),
    h: b[3].as('px') - b[1].as('px')
  };
}

/**
 * Fill the slot's canvas edge to edge. Right for a base design: it was authored
 * as the whole panel, so its canvas IS the panel.
 *
 * `offset` shifts the panel inside that canvas afterwards, as a fraction of the
 * canvas — the knob for bringing a cuff band up past the template's mask.
 *
 * NO BLEED BY DEFAULT, and that is deliberate. A shift does vacate a strip at
 * the trailing edge, but the reason to shift at all is that the canvas edge lies
 * OUTSIDE the mask — which is the same reason the vacated strip cannot show.
 * Covering it costs a real upscale of the artwork: the scaling is centred, so
 * covering a shift of d needs 2d of extra height, and at the sleeve raise that
 * is a ~6% enlargement. On a patterned kit that is a visible scale mismatch with
 * the body at the shoulder seam — a certain artefact traded for a hypothetical
 * one.
 *
 * `bleed: true` turns it on for the case where the premise is wrong and a
 * transparent sliver really does appear.
 */
function fitLayerToCanvas(pl, cw, ch, offset, bleed) {
  var m = layerBox(pl);
  if (m.w <= 0 || m.h <= 0) return;

  var dx = offset ? offset[0] * cw : 0;
  var dy = offset ? offset[1] * ch : 0;
  // TWICE the shift, not once: scaling is centred, so the extra is split evenly
  // between the two edges and only half of it travels in the direction of the
  // shift. At 1× the trailing edge is left short by half the offset.
  var grow = bleed ? 2 * Math.max(Math.abs(dx) / cw, Math.abs(dy) / ch) : 0;

  pl.resize(cw * (1 + grow) / m.w * 100, ch * (1 + grow) / m.h * 100, AnchorPosition.MIDDLECENTER);

  var n = layerBox(pl);
  pl.translate(UnitValue((cw - n.w) / 2 - n.x + dx, 'px'),
               UnitValue((ch - n.h) / 2 - n.y + dy, 'px'));
}

// Mirror one placed artwork layer around its own centre. Used for base sleeve
// artwork only; sponsor overlays are intentionally left untouched.
function mirrorLayerX(pl) {
  pl.resize(-100, 100, AnchorPosition.MIDDLECENTER);
}

/**
 * Place a mark at [x, y, w, h] of the slot's canvas, centred on that box.
 *
 * mode 'height' (the default, and what sponsors use) scales by the box HEIGHT
 * alone and lets the width fall out of the logo's own aspect. The box width is
 * then only used to find the centre.
 *
 * That is not an arbitrary choice — it is what the reference sleeves do. Both
 * front sponsors are exactly 180 tall despite aspect ratios of 1.3078 and
 * 1.1313, so height is the standardised dimension and width is whatever the
 * logo happens to be. A 'contain' fit would look identical on those two files
 * and then silently undersize the first sponsor whose aspect is wider than the
 * box, because width, not height, would become the binding constraint.
 *
 * mode 'contain' keeps the mark inside the box on both axes. Right for a badge
 * that must not exceed a printable area; wrong for a sponsor strip.
 */
function fitLayerInBox(pl, box, mode) {
  var m = layerBox(pl);
  if (m.w <= 0 || m.h <= 0) return;
  var scale = (mode === 'contain') ? Math.min(box[2] / m.w, box[3] / m.h) : (box[3] / m.h);
  pl.resize(scale * 100, scale * 100, AnchorPosition.MIDDLECENTER);
  var n = layerBox(pl);
  pl.translate(UnitValue(box[0] + (box[2] - n.w) / 2 - n.x, 'px'),
               UnitValue(box[1] + (box[3] - n.h) / 2 - n.y, 'px'));
}

/**
 * The dominant colour of a document, per channel.
 *
 * Histogram mode rather than sampling a pixel, because there is no position that
 * is base fabric in every design — a fixed sample point lands on a stripe in one
 * kit and a crest in the next. The most frequent value cannot do that: on flat
 * vector artwork the base colour is most of the canvas by a wide margin.
 *
 * Channels are moded independently, so in principle the result is a colour that
 * appears nowhere. In practice a design with one dominant colour gives that
 * colour on all three channels. A design genuinely split near 50/50 between two
 * colours is the case to watch, which is why the result is logged.
 */
function modalRGB(doc) {
  if (!doc.channels || doc.channels.length < 3) return null;   // greyscale, indexed…
  var out = [];
  for (var c = 0; c < 3; c++) {
    var h = doc.channels[c].histogram;
    if (!h || h.length !== 256) return null;
    var best = 0, bestCount = -1;
    for (var i = 0; i < h.length; i++) {
      if (h[i] > bestCount) { bestCount = h[i]; best = i; }
    }
    out.push(best);
  }
  return { r: out[0], g: out[1], b: out[2] };
}

/**
 * Fallback: the most common colour across a 3×3 grid of colour samplers.
 *
 * Reads actual colours rather than per-channel modes, so it cannot invent one
 * that appears nowhere — but nine points is a coarse census, and it inherits the
 * position problem the histogram avoids, just diluted across nine positions
 * instead of one. Good enough when the histogram is unavailable; not better.
 */
function gridRGB(doc) {
  var w = doc.width.as('px'), h = doc.height.as('px');
  var at = [0.2, 0.5, 0.8], counts = {}, best = null, bestN = 0;
  for (var i = 0; i < at.length; i++) {
    for (var j = 0; j < at.length; j++) {
      var s = null;
      try {
        s = doc.colorSamplers.add([UnitValue(w * at[i], 'px'), UnitValue(h * at[j], 'px')]);
        var col = { r: s.color.rgb.red, g: s.color.rgb.green, b: s.color.rgb.blue };
        var key = toHex(col);
        counts[key] = (counts[key] || 0) + 1;
        if (counts[key] > bestN) { bestN = counts[key]; best = col; }
      } catch (eAdd) {}
      if (s) { try { s.remove(); } catch (eRm) {} }
    }
  }
  return best;
}

// Never throws. A colour that cannot be read means the tint is skipped and said
// so — it must not be able to take an export down with it.
function dominantRGB(doc) {
  try { var m = modalRGB(doc); if (m) return m; } catch (eHist) {}
  try { return gridRGB(doc); } catch (eGrid) {}
  return null;
}

function toHex(c) {
  var parts = [c.r, c.g, c.b], s = '';
  for (var i = 0; i < 3; i++) {
    var v = Math.round(parts[i]).toString(16).toUpperCase();
    s += (v.length < 2 ? '0' + v : v);
  }
  return s;
}

function parseHex(str) {
  var m = String(str).replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return null;
  return {
    r: parseInt(m.substr(0, 2), 16),
    g: parseInt(m.substr(2, 2), 16),
    b: parseInt(m.substr(4, 2), 16)
  };
}

/**
 * Recolour a solid colour fill layer. No DOM setter exists; the action is the
 * only route.
 *
 * The target must be referenced as a contentLayer, NOT as a plain layer. A 'Lyr '
 * reference here fails with "General Photoshop error occurred… Could not complete
 * the command because of a program error", which reads like a version problem and
 * is not one.
 *
 * Returns false rather than throwing: a stitching colour is a nicety and must
 * never be able to lose an export.
 */
function setSolidFill(doc, layer, c) {
  var attempt = function (refType) {
    doc.activeLayer = layer;
    var d = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putEnumerated(refType, charIDToTypeID('Ordn'), charIDToTypeID('Trgt'));
    d.putReference(charIDToTypeID('null'), ref);
    var fill = new ActionDescriptor();
    var rgb = new ActionDescriptor();
    rgb.putDouble(charIDToTypeID('Rd  '), c.r);
    rgb.putDouble(charIDToTypeID('Grn '), c.g);
    rgb.putDouble(charIDToTypeID('Bl  '), c.b);
    fill.putObject(charIDToTypeID('Clr '), charIDToTypeID('RGBC'), rgb);
    d.putObject(charIDToTypeID('T   '), stringIDToTypeID('solidColorLayer'), fill);
    executeAction(charIDToTypeID('setd'), d, DialogModes.NO);
  };
  try { attempt(stringIDToTypeID('contentLayer')); return true; } catch (e1) {}
  try { attempt(charIDToTypeID('Lyr ')); return true; } catch (e2) {}
  return false;
}

function placeInsideSlot(doc, layer, stack, sample) {
  doc.activeLayer = layer;
  executeAction(stringIDToTypeID('placedLayerEditContents'), undefined, DialogModes.NO);
  var inner = app.activeDocument;
  try {
    // Everything already in the .psb is a leftover: either the template's
    // placeholder or the previous design. The artwork replaces the lot.
    for (var i = inner.artLayers.length - 1; i >= 0; i--) {
      try { inner.artLayers[i].remove(); } catch (eDel) {}
    }

    // Bottom to top: base first, then each overlay. A base fills the canvas; an
    // overlay with a `box` is fitted into that box instead.
    var cw = inner.width.as('px'), ch = inner.height.as('px');
    for (var f = 0; f < stack.length; f++) {
      var d = new ActionDescriptor();
      d.putPath(charIDToTypeID('null'), stack[f].file);
      d.putEnumerated(charIDToTypeID('FTcs'), charIDToTypeID('QCSt'), charIDToTypeID('Qcsa'));
      executeAction(charIDToTypeID('Plc '), d, DialogModes.NO);

      var pl = inner.activeLayer;
      var box = stack[f].box;
      if (!box && stack[f].boxPct) {
        var p = stack[f].boxPct;
        box = [p[0] * cw, p[1] * ch, p[2] * cw, p[3] * ch];
      }
      if (box) fitLayerInBox(pl, box, stack[f].fit);
      else fitLayerToCanvas(pl, cw, ch, stack[f].offset, stack[f].bleed);
      if (stack[f].mirrorX) mirrorLayerX(pl);
    }
    // Read the colour here, while the artwork is rasterised and alone in the
    // document — nothing else in the run sees the artwork as pixels.
    //
    // dominantRGB swallows its own failures, which matters more than it looks:
    // this sits inside the try that closes WITHOUT saving on error, so anything
    // throwing here would discard the placement itself and lose the artwork, not
    // just the colour.
    var sampled = sample ? dominantRGB(inner) : null;

    inner.close(SaveOptions.SAVECHANGES);   // writes back into the parent slot
    app.activeDocument = doc;
    return sampled;
  } catch (e) {
    try { inner.close(SaveOptions.DONOTSAVECHANGES); } catch (e2) {}
    app.activeDocument = doc;
    throw e;
  }
}

// No DOM method for this — the action is the documented idiom.
function replaceSmartObject(doc, layer, file) {
  doc.activeLayer = layer;
  var d = new ActionDescriptor();
  d.putPath(charIDToTypeID('null'), file);
  d.putInteger(charIDToTypeID('PgNm'), 1);
  executeAction(stringIDToTypeID('placedLayerReplaceContents'), d, DialogModes.NO);
}

/**
 * An `over` entry is either a kind (or fallback list), meaning "authored at the
 * slot's full canvas, drop it in as-is", or {file, box} meaning "this is a small
 * mark, put it HERE at THIS size".
 *
 * The box belongs to the slot, not to the file, and that is the whole point: the
 * front and back templates give the same physical sleeve different canvases, so
 * a position baked into the artwork can only ever be right in one of them. Held
 * on the slot, one sponsor file per arm is correct in both views.
 */
function overSpec(entry) {
  if (entry && !(entry instanceof Array) && entry.file) {
    return { kinds: entry.file, box: entry.box || null, boxPct: entry.boxPct || null, fit: entry.fit || 'height' };
  }
  return { kinds: entry, box: null, boxPct: null, fit: 'height' };
}

// Kind names deliberately carry no internal hyphen ('collarback', not
// 'collar-back'): slug discovery matches on a trailing '-<kind>', so a file
// called <slug>-collar-back.svg would be read as a design named 'x-collar'.
/**
 * Which artwork a slot gets, and WHICH KIND it came from.
 *
 * The kind matters for mirroring. `file: ['sleeveleft', 'sleeves']` means "the
 * side-specific file if it exists, otherwise the shared one" — and only the
 * shared one needs flipping. A side-specific file was drawn for that arm
 * already, so mirroring it would reverse artwork that was correct, and any text
 * or badge baked into the panel would come out backwards.
 *
 * `shared` is true when the match came from anything but the first kind, i.e.
 * when a fallback was used.
 */
function artworkMatch(slug, kinds) {
  var list = (kinds instanceof Array) ? kinds : [kinds];
  for (var k = 0; k < list.length; k++) {
    for (var i = 0; i < CONFIG.extensions.length; i++) {
      var f = new File(CONFIG.artworkDir + '/' + slug + '-' + list[k] + '.' + CONFIG.extensions[i]);
      if (f.exists) return { file: f, kind: list[k], shared: k > 0 };
    }
  }
  return null;
}

function artworkFor(slug, kinds) {
  var m = artworkMatch(slug, kinds);
  return m ? m.file : null;
}

// true  → always flip.  'shared' → flip only a shared fallback file.
function wantsMirror(slot, match) {
  if (slot.mirrorX === true) return true;
  return slot.mirrorX === 'shared' && !!match.shared;
}

/**
 * An SVG's canvas, without rasterising it. Inkscape writes both width/height
 * and a viewBox; the viewBox is the reliable one because width/height may carry
 * units (mm, pt) while the viewBox is always user units.
 */
/**
 * A PNG's dimensions from its IHDR chunk — bytes 16..23, big-endian.
 * Needed because a PNG is the escape hatch when Photoshop mis-renders an SVG
 * (text on a path, a font it cannot resolve), and an unmeasured file gets no
 * scale compensation.
 */
function pngCanvas(file) {
  try {
    file.encoding = 'BINARY';
    file.open('r');
    var head = file.read(24);
    file.close();
    if (head.length < 24 || head.substr(1, 3) !== 'PNG') return null;
    var be32 = function (off) {
      return ((head.charCodeAt(off) << 24) | (head.charCodeAt(off + 1) << 16) |
              (head.charCodeAt(off + 2) << 8) | head.charCodeAt(off + 3)) >>> 0;
    };
    var w = be32(16), h = be32(20);
    return (w && h) ? { w: w, h: h } : null;
  } catch (e) { try { file.close(); } catch (e2) {} return null; }
}

function artworkCanvas(file) {
  if (/\.png$/i.test(file.name)) return pngCanvas(file);
  return svgCanvas(file);
}

function svgCanvas(file) {
  try {
    if (!/\.svg$/i.test(file.name)) return null;    // only SVG is cheap to read
    file.open('r');
    var head = file.read(4000);                      // the <svg> tag is at the top
    file.close();
    var vb = head.match(/viewBox\s*=\s*["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)/i);
    if (vb) return { w: Math.round(parseFloat(vb[1])), h: Math.round(parseFloat(vb[2])) };
    var w = head.match(/\swidth\s*=\s*["']([\d.]+)/i);
    var h = head.match(/\sheight\s*=\s*["']([\d.]+)/i);
    if (w && h) return { w: Math.round(parseFloat(w[1])), h: Math.round(parseFloat(h[1])) };
    return null;
  } catch (e) { try { file.close(); } catch (e2) {} return null; }
}

function kindLabel(kinds) {
  return (kinds instanceof Array) ? kinds.join(' or ') : kinds;
}

/**
 * A design exists if ANY view's required artwork is present — so a front-only
 * set, a shorts-only revision, or the full kit all get discovered. Scanning only
 * the front would make a back-only or shorts-only run report "no designs found".
 *
 * Only REQUIRED kinds create a slug. A stray <slug>-collartop.svg on its own
 * therefore never invents a design.
 */
function findSlugs(active) {
  var kinds = [], seenKind = {};
  for (var a = 0; a < active.length; a++) {
    for (var s = 0; s < active[a].slots.length; s++) {
      var slot = active[a].slots[s];
      if (!slot.required) continue;
      var list = (slot.file instanceof Array) ? slot.file : [slot.file];
      for (var k = 0; k < list.length; k++) {
        if (!seenKind[list[k]]) { seenKind[list[k]] = true; kinds.push(list[k]); }
      }
    }
  }
  if (!kinds.length) return [];

  var rx = new RegExp('^(.+)-(' + kinds.join('|') + ')\\.(' + CONFIG.extensions.join('|') + ')$', 'i');
  var files = new Folder(CONFIG.artworkDir).getFiles();
  var slugs = [], seen = {};
  for (var i = 0; i < files.length; i++) {
    if (!(files[i] instanceof File)) continue;
    var m = decodeURI(files[i].name).match(rx);
    if (m && !seen[m[1]]) { seen[m[1]] = true; slugs.push(m[1]); }
  }
  return slugs;
}

/**
 * Every artwork kind any slot can consume. Anything in artworkDir that looks
 * like <slug>-<kind> but whose kind is not in here is almost certainly a typo —
 * 'collarbotom' for 'collarbottom' — and would otherwise pass as a deliberately
 * absent optional file. Reported loudly instead.
 */
function claimedKinds(active) {
  var kinds = {};
  var add = function (spec) {
    var list = (spec instanceof Array) ? spec : [spec];
    for (var k = 0; k < list.length; k++) kinds[list[k].toLowerCase()] = true;
  };
  for (var a = 0; a < active.length; a++) {
    for (var s = 0; s < active[a].slots.length; s++) {
      var slot = active[a].slots[s];
      add(slot.file);
      // Overlay kinds count as claimed too. Without this every sponsor file
      // would be reported as an unrecognised typo — the warning that exists to
      // catch 'collarbotom' would fire on the one thing that is spelled right.
      if (slot.over) for (var o = 0; o < slot.over.length; o++) add(overSpec(slot.over[o]).kinds);
    }
  }
  return kinds;
}

// Cheap edit distance, so an unclaimed file can name what it probably meant.
function editDistance(a, b) {
  var prev = [], cur = [], i, j;
  for (j = 0; j <= b.length; j++) prev[j] = j;
  for (i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1,
                        prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
    }
    for (j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

function nearestKind(kind, kinds) {
  var best = null, bestD = 99;
  for (var k in kinds) {
    if (!kinds.hasOwnProperty(k)) continue;
    var d = editDistance(kind, k);
    if (d < bestD) { bestD = d; best = k; }
  }
  return bestD <= 3 ? best : null;
}

function unclaimedFiles(active, slugs) {
  var kinds = claimedKinds(active);
  var files = new Folder(CONFIG.artworkDir).getFiles();
  var out = [];
  var extRx = new RegExp('\\.(' + CONFIG.extensions.join('|') + ')$', 'i');
  for (var i = 0; i < files.length; i++) {
    if (!(files[i] instanceof File)) continue;
    var name = decodeURI(files[i].name);
    if (!extRx.test(name)) continue;
    var stem = name.replace(extRx, '');
    for (var s = 0; s < slugs.length; s++) {
      if (stem.length > slugs[s].length + 1 && stem.substring(0, slugs[s].length + 1) === slugs[s] + '-') {
        var kind = stem.substring(slugs[s].length + 1).toLowerCase();
        if (!kinds[kind]) {
          var did = nearestKind(kind, kinds);
          out.push(name + '  → no slot wants "' + kind + '"' +
                   (did ? '  ·  DID YOU MEAN "' + did + '"?' : ''));
        }
        break;
      }
    }
  }
  return out;
}

// A template's `psd` may be a bare filename (resolved against templatesDir) or
// a full path, so moving the templates means editing one line, not three.
function templatePath(psd) {
  return (/[\/\\]/.test(psd) ? psd : CONFIG.templatesDir + '/' + psd);
}

function exportFlat(doc, size, outFile) {
  var dup = doc.duplicate();
  try {
    // Do NOT flatten() for PNG. Document.flatten() fills transparent areas with
    // WHITE, and these templates have their BACKGROUND layer hidden — the shirt
    // is meant to come out on transparency. Saving a layered document as PNG
    // writes the composite anyway, so adjustment layers, blend modes, shadows
    // and highlights all bake in exactly as they render on screen.
    // JPEG has no alpha, so flattening is the right thing there.
    if (CONFIG.format === 'jpg') dup.flatten();

    // Force BOTH dimensions. These canvases are square (6200, 6000, 5000) but
    // the t-shirt templates are 3992×3993, where a width-only resize yields
    // 1500×1501.
    dup.resizeImage(UnitValue(size, 'px'), UnitValue(size, 'px'), 72, ResampleMethod.BICUBICSHARPER);

    if (CONFIG.format === 'jpg') {
      var jpg = new JPEGSaveOptions();
      jpg.quality = 11;
      jpg.embedColorProfile = true;
      dup.saveAs(outFile, jpg, true, Extension.LOWERCASE);
    } else {
      var png = new PNGSaveOptions();
      png.interlaced = false;
      dup.saveAs(outFile, png, true, Extension.LOWERCASE);
    }
  } finally {
    dup.close(SaveOptions.DONOTSAVECHANGES);
  }
}

/**
 * Composite the three views onto one transparent canvas.
 *
 * Runs after every template, from the files just exported, so it needs no access
 * to the templates and is unaffected by how any of them were built.
 *
 * `produced` gates it: a piece has to have been exported in THIS run. Reading
 * outDir alone would happily pair a new front with last week's back and give no
 * sign it had done so.
 */
function moveLayerTo(layer, x, y) {
  var b = layerBox(layer);
  layer.translate(UnitValue(x - b.x, 'px'), UnitValue(y - b.y, 'px'));
}

function buildKit(slug, produced, log) {
  var spec = CONFIG.kit;
  var order = ['front', 'back', 'shorts'];

  var files = {};
  for (var i = 0; i < order.length; i++) {
    var file = new File(CONFIG.outDir + '/' + slug + '-' + order[i] + '.' + CONFIG.format);
    if (!produced[slug + '|' + order[i]] || !file.exists) {
      // Not a failure. Most days are jersey-only or front-only, and a kit sheet
      // with a hole in it is worse than no kit sheet.
      log.push('    – ' + slug + '-' + spec.suffix + ': no ' + order[i] + ' this run, kit sheet skipped');
      return false;
    }
    files[order[i]] = file;
  }

  // Roomy enough that nothing lands outside it — trim only sees pixels within the
  // canvas, so a layer pushed off the edge would be cropped rather than moved.
  var WORK = 4000;
  var comp = app.documents.add(UnitValue(WORK, 'px'), UnitValue(WORK, 'px'), 72,
                               slug + '-' + spec.suffix, NewDocumentMode.RGB, DocumentFill.TRANSPARENT);
  try {
    var piece = {};
    for (var p = 0; p < order.length; p++) {
      var src = app.open(files[order[p]]);
      try {
        // A fully opaque PNG opens as a Background layer, which cannot be trimmed
        // against transparency or duplicated out. These exports have alpha so it
        // should not arise — but it costs one line to not depend on that.
        if (src.artLayers[0].isBackgroundLayer) src.artLayers[0].isBackgroundLayer = false;
        // Trim to the garment. This is what makes the pieces comparable: the
        // frames differ, the garments inside them are already to scale.
        try { src.trim(TrimType.TRANSPARENT); } catch (eTrim) {}
        src.artLayers[0].duplicate(comp, ElementPlacement.PLACEATBEGINNING);
      } finally {
        src.close(SaveOptions.DONOTSAVECHANGES);
      }
      app.activeDocument = comp;
      var lay = comp.artLayers[0];
      piece[order[p]] = { layer: lay, box: layerBox(lay) };
    }

    var f = piece.front.box, b = piece.back.box, s = piece.shorts.box;
    var gx = Math.round(spec.gap[0] * f.w);
    var gy = Math.round(spec.gap[1] * f.h);

    var rowW = f.w + gx + b.w;
    var rowH = Math.max(f.h, b.h);
    var totalW = Math.max(rowW, s.w);
    var totalH = rowH + gy + s.h;

    var left = (WORK - totalW) / 2, top = (WORK - totalH) / 2;
    var rowLeft = left + (totalW - rowW) / 2;

    // Jerseys top-aligned so the shoulders line up, shorts centred beneath.
    moveLayerTo(piece.front.layer, rowLeft, top);
    moveLayerTo(piece.back.layer, rowLeft + f.w + gx, top);
    moveLayerTo(piece.shorts.layer, left + (totalW - s.w) / 2, top + rowH + gy);

    // Trim to what is actually there, then pad out to a square. Squaring by
    // canvas rather than by resize is what keeps the garments undistorted
    // whatever shape the group came out.
    comp.trim(TrimType.TRANSPARENT);
    var side = Math.round(Math.max(comp.width.as('px'), comp.height.as('px')) * (1 + 2 * (spec.margin || 0)));
    comp.resizeCanvas(UnitValue(side, 'px'), UnitValue(side, 'px'), AnchorPosition.MIDDLECENTER);

    exportFlat(comp, spec.size, new File(CONFIG.outDir + '/' + slug + '-' + spec.suffix + '.' + CONFIG.format));
  } finally {
    comp.close(SaveOptions.DONOTSAVECHANGES);
  }
  return true;
}

// Resolve and validate every slot in a template. Called on each open, because
// layer references do not survive closing the document.
function resolveSlots(doc, view, log, quiet) {
  for (var s = 0; s < view.slots.length; s++) {
    var slot = view.slots[s];
    var named = findLayers(doc, slot.layer, []);
    if (!named.length) throw new Error('no layer named "' + slot.layer + '"');

    var usable = [], hidden = 0;
    for (var i = 0; i < named.length; i++) {
      if (named[i].kind !== LayerKind.SMARTOBJECT) {
        throw new Error('"' + slot.layer + '" is not a smart object — replacing its contents would do nothing');
      }
      if (named[i].visible) usable.push(named[i]); else hidden++;
    }

    var addr = slot.layer;
    if (slot.at) {
      usable = atPosition(usable, slot.at);
      addr += ' @ ' + slot.at[0] + ',' + slot.at[1];
    } else if (hidden && !quiet) {
      log.push('    · ' + slot.layer + ': ' + hidden + ' hidden copy skipped');
    }

    if (slot.count && usable.length !== slot.count) {
      throw new Error('expected ' + slot.count + ' visible "' + addr + '", found ' + usable.length +
        '. The template changed — re-run inspect-template.jsx and update CONFIG.');
    }
    slot.refs = usable;
    slot.addr = addr;
  }
}

function main() {
  if (!CONFIG.artworkDir || !CONFIG.outDir) {
    alert('Set artworkDir and outDir at the top of this script first.');
    return;
  }
  if (!new Folder(CONFIG.artworkDir).exists) {
    alert('artworkDir does not exist:\n' + CONFIG.artworkDir + '\n\nCreate it, or correct the path at the top of this script.');
    return;
  }
  if (!new Folder(CONFIG.templatesDir).exists) {
    alert('templatesDir does not exist:\n' + CONFIG.templatesDir + '\n\nPut the template files there, or correct the path.');
    return;
  }

  var active = [];
  for (var t = 0; t < CONFIG.templates.length; t++) {
    var tpl = CONFIG.templates[t];
    if (!tpl.psd) continue;                                   // unconfigured view
    tpl.path = templatePath(tpl.psd);
    if (!new File(tpl.path).exists) { alert('Template not found:\n' + tpl.path); return; }
    active.push(tpl);
  }
  if (!active.length) { alert('No template PSD paths set in CONFIG.templates.'); return; }
  if (!new Folder(CONFIG.outDir).exists) new Folder(CONFIG.outDir).create();

  var slugs = findSlugs(active);
  if (!slugs.length) {
    alert('No designs found in:\n' + CONFIG.artworkDir +
          '\n\nA design needs at least one of: <slug>-front, <slug>-back, <slug>-shorts');
    return;
  }

  var log = [], made = 0;
  var produced = {};   // "<slug>|<view>" → exported in this run

  var orphans = unclaimedFiles(active, slugs);
  if (orphans.length) {
    log.push('⚠ files no slot claims — check for a typo:');
    for (var o = 0; o < orphans.length; o++) log.push('    ' + orphans[o]);
    log.push('');
  }

  if (CONFIG.placeOnly) {
    slugs = slugs.slice(0, 1);
    log.push('PLACE-ONLY: "' + slugs[0] + '" only. Nothing is exported, nothing is undone,');
    log.push('and the templates are left OPEN and MODIFIED — close them WITHOUT saving.');
    log.push('');
  }

  var prevDialogs = app.displayDialogs;
  app.displayDialogs = DialogModes.NO;

  try {
    // Each template opens ONCE and every design runs through it — that is where
    // the time goes on a batch, not in any single swap.
    for (var a = 0; a < active.length; a++) {
      var view = active[a];
      var doc = app.open(new File(view.path));
      var dirty = {};      // slot index → holds a previous design's artwork
      var tinted = false;  // a template fill layer carries a design's colour

      try {
        log.push('── ' + view.suffix + ' (' + view.size + '×' + view.size + ')');
        resolveSlots(doc, view, log, false);

        for (var i = 0; i < slugs.length; i++) {
         // One design failing must not cost the rest of the batch. Without this
         // the first bad design reached the per-view catch and every design after
         // it was silently never attempted.
         //
         // Recovering is safe because the next design reopens the template from
         // disk, so it cannot inherit a half-finished state from this one.
         try {
          // Work out what this design can fill before touching anything.
          var jobs = [], fills = {}, blank = [], lacks = null, overlaid = [], overWarn = false, nudged = [], tintWarn = false, mirrored = [];
          for (var s = 0; s < view.slots.length; s++) {
            var slot = view.slots[s];
            var match = artworkMatch(slugs[i], slot.file);
            var art = match ? match.file : null;
            if (art) {
              var stack = [{
                file: art,
                box: null,
                mirrorX: wantsMirror(slot, match),
                offset: slot.baseOffsetPct || null,
                bleed: !!slot.baseBleed
              }];
              if (slot.mirrorX && !stack[0].mirrorX) {
                mirrored.push(slot.addr + ' NOT flipped (' + match.kind + ' is side-specific)');
              } else if (stack[0].mirrorX) {
                mirrored.push(slot.addr + ' flipped (' + match.kind + ')');
              }
              if (slot.over && CONFIG.placeInside) {
                for (var ov = 0; ov < slot.over.length; ov++) {
                  var spec = overSpec(slot.over[ov]);
                  var extra = artworkFor(slugs[i], spec.kinds);
                  if (extra) {
                    stack.push({ file: extra, box: spec.box, boxPct: spec.boxPct, fit: spec.fit });
                    overlaid.push(decodeURI(extra.name) + ((spec.box || spec.boxPct) ? '' : ' (full canvas)'));
                  }
                }
              } else if (slot.over && slot.over.length) {
                overWarn = true;
              }
              jobs.push({ index: s, slot: slot, file: art, stack: stack });
              fills[s] = true;
            }
            else if (slot.required) { lacks = kindLabel(slot.file); break; }
            else blank.push(kindLabel(slot.file));
          }

          if (lacks) {
            // Not an error — a front-only or jersey-only set is a normal thing
            // to ask for. Say what was skipped and why, then carry on.
            log.push('    – ' + slugs[i] + ': no ' + lacks + ' artwork, view skipped');
            continue;
          }

          // A slot this design does not fill still holds the LAST design's
          // artwork, because the template stays open across the batch. Reopening
          // resets every slot to the template's own placeholder. Without this a
          // front-only set silently inherits the previous team's collar.
          // placeInside SAVES each .psb, so the template carries the previous
          // design in every slot it touched — reopen unconditionally.
          var stale = (CONFIG.placeInside && i > 0) || tinted;
          for (var d in dirty) { if (dirty.hasOwnProperty(d) && !fills[d]) { stale = true; break; } }
          if (stale) {
            doc.close(SaveOptions.DONOTSAVECHANGES);
            doc = app.open(new File(view.path));
            resolveSlots(doc, view, log, true);
            dirty = {};
            tinted = false;
            for (var j2 = 0; j2 < jobs.length; j2++) jobs[j2].slot = view.slots[jobs[j2].index];
          }

          // Measure every artwork BEFORE replacing, so the compensation factor
          // is known and can be reversed cleanly afterwards.
          for (var w0 = 0; w0 < jobs.length; w0++) {
            var exp = jobs[w0].slot.expect;
            jobs[w0].fix = null;
            if (!exp) continue;
            var got = artworkCanvas(jobs[w0].file);
            if (!got) continue;                       // not an SVG, or unreadable
            if (got.w === exp[0] && got.h === exp[1]) continue;
            if (CONFIG.placeInside) continue;   // fitted inside the .psb instead
            jobs[w0].fix = { from: [got.w, got.h], to: exp };
            var ar = Math.abs((got.w / got.h) - (exp[0] / exp[1])) / (exp[0] / exp[1]);
            log.push('    · ' + jobs[w0].file.name + ' is ' + got.w + '×' + got.h +
                     ' vs ' + exp[0] + '×' + exp[1] + ' — rescaled' +
                     (ar > 0.01 ? '  ⚠ ASPECT RATIO DIFFERS, it will distort' : ''));
          }

          var swaps = 0, tints = [];
          for (var j = 0; j < jobs.length; j++) {
            var slotJ = jobs[j].slot;
            var wantColour = slotJ.tint && slotJ.tint.length && !slotJ.tintColour;
            for (var r = 0; r < slotJ.refs.length; r++) {
              if (CONFIG.placeInside) {
                // Not named `got` — that belongs to the canvas-measuring loop
                // above, and `var` is function-scoped, so reusing it would put two
                // unrelated meanings on one variable.
                var sampled = placeInsideSlot(doc, slotJ.refs[r], jobs[j].stack, wantColour);
                if (slotJ.tint && slotJ.tint.length && !tints.length) {
                  var c = slotJ.tintColour ? parseHex(slotJ.tintColour) : sampled;
                  if (c) tints.push({ layers: slotJ.tint, colour: c, from: decodeURI(jobs[j].file.name) });
                  else if (slotJ.tintColour) log.push('    ⚠ tintColour "' + slotJ.tintColour + '" is not a 6-digit hex — ignored');
                  else log.push('    ⚠ could not read a colour from ' + decodeURI(jobs[j].file.name) +
                                ' — exported untinted (set tintColour to force one)');
                }
              } else {
                replaceSmartObject(doc, slotJ.refs[r], jobs[j].file);
                if (slotJ.tint && slotJ.tint.length) {
                  var forced = slotJ.tintColour ? parseHex(slotJ.tintColour) : null;
                  if (forced && !tints.length) tints.push({ layers: slotJ.tint, colour: forced, from: 'tintColour' });
                  else if (!forced) tintWarn = true;   // sampling needs the .psb
                }
              }
              swaps++;
            }
            dirty[jobs[j].index] = true;
          }

          // Recolour the template's own fill layers. Reopening resets them, and
          // `tinted` guarantees the reopen — otherwise the next design in the
          // batch would inherit this one's thread colour.
          //
          // Wrapped end to end: the tint is cosmetic, the export is the job. An
          // earlier version let a failure here reach the per-view catch, which
          // abandoned the whole view and produced no image at all.
          var tintLog = [];
          try {
            for (var ti = 0; ti < tints.length; ti++) {
              for (var tl = 0; tl < tints[ti].layers.length; tl++) {
                var found = findLayers(doc, tints[ti].layers[tl], []);
                if (!found.length) { log.push('    ⚠ no layer named "' + tints[ti].layers[tl] + '" to tint'); continue; }
                var applied = 0;
                for (var fi = 0; fi < found.length; fi++) {
                  if (found[fi].kind !== LayerKind.SOLIDFILL) {
                    log.push('    ⚠ "' + tints[ti].layers[tl] + '" is not a solid fill layer — not tinted');
                    continue;
                  }
                  if (setSolidFill(doc, found[fi], tints[ti].colour)) { tinted = true; applied++; }
                  else log.push('    ⚠ could not recolour "' + tints[ti].layers[tl] + '" — exported untinted');
                }
                // Only report what actually changed. A tint line for a layer that
                // silently failed would read as confirmation.
                if (applied) tintLog.push(tints[ti].layers[tl] + ' #' + toHex(tints[ti].colour));
              }
            }
          } catch (eTint) {
            log.push('    ⚠ tinting failed (' + eTint.message + ') — exported untinted');
          }

          // Rescale and nudge, export, then undo both. Reversing is what stops
          // a 10-design batch from compounding every correction.
          for (var f0 = 0; f0 < jobs.length; f0++) {
            if (!jobs[f0].fix) continue;
            for (var q0 = 0; q0 < jobs[f0].slot.refs.length; q0++) {
              rescaleLayer(doc, jobs[f0].slot.refs[q0], jobs[f0].fix.from, jobs[f0].fix.to);
            }
          }
          // Resolved per layer and REMEMBERED, so the undo after export reverses
          // exactly what was applied rather than recomputing it from bounds that
          // the nudge itself has moved.
          for (var n = 0; n < jobs.length; n++) {
            jobs[n].moved = [];
            for (var q = 0; q < jobs[n].slot.refs.length; q++) {
              var mv = resolveNudge(jobs[n].slot, jobs[n].slot.refs[q]);
              if (!mv) continue;
              nudgeLayer(doc, jobs[n].slot.refs[q], mv[0], mv[1]);
              jobs[n].moved.push({ ref: jobs[n].slot.refs[q], by: mv });
              nudged.push(jobs[n].slot.addr + ' by ' + Math.round(mv[0]) + ',' + Math.round(mv[1]) + 'px');
            }
          }

          if (CONFIG.placeOnly) {
            log.push('    ⏸ ' + slugs[i] + '-' + view.suffix + ': ' + swaps + ' slots placed, left open for inspection');
            made++;
            continue;   // no export, and the undo below is skipped with it
          }

          exportFlat(doc, view.size, new File(CONFIG.outDir + '/' + slugs[i] + '-' + view.suffix + '.' + CONFIG.format));

          for (var n2 = 0; n2 < jobs.length; n2++) {
            var mvs = jobs[n2].moved;
            if (!mvs) continue;
            for (var q2 = 0; q2 < mvs.length; q2++) nudgeLayer(doc, mvs[q2].ref, -mvs[q2].by[0], -mvs[q2].by[1]);
          }
          for (var f2 = 0; f2 < jobs.length; f2++) {
            if (!jobs[f2].fix) continue;
            for (var q3 = 0; q3 < jobs[f2].slot.refs.length; q3++) {
              rescaleLayer(doc, jobs[f2].slot.refs[q3], jobs[f2].fix.to, jobs[f2].fix.from);
            }
          }
          log.push('    ✓ ' + slugs[i] + '-' + view.suffix + '.' + CONFIG.format + '  (' + swaps + ' slots)' +
            (overlaid.length ? '  · overlaid: ' + overlaid.join(', ') : '') +
            (mirrored.length ? '  · ' + mirrored.join(', ') : '') +
            (nudged.length ? '  · nudged: ' + nudged.join(', ') : '') +
            (tintLog.length ? '  · tinted: ' + tintLog.join(', ') : '') +
            (blank.length ? '  · template default kept for: ' + blank.join(', ') : ''));
          if (overWarn) log.push('      ⚠ overlays need placeInside: true — skipped');
          if (tintWarn) log.push('      ⚠ sampling a colour needs placeInside: true — set tintColour to tint anyway');
          produced[slugs[i] + '|' + view.suffix] = true;
          made++;
         } catch (perDesign) {
           log.push('    ✗ ' + slugs[i] + '-' + view.suffix + ': ' + perDesign.message);
           // Force a clean template for whatever comes next.
           try {
             doc.close(SaveOptions.DONOTSAVECHANGES);
             doc = app.open(new File(view.path));
             resolveSlots(doc, view, log, true);
             dirty = {};
             tinted = false;
           } catch (eReopen) { throw eReopen; }   // cannot recover the view at all
         }
        }
      } catch (inner) {
        log.push('    ✗ ' + inner.message);
      } finally {
        // Leaves the template exactly as it was on disk — unless placeOnly, where
        // the whole point is to leave it open with the artwork in place.
        if (!CONFIG.placeOnly) doc.close(SaveOptions.DONOTSAVECHANGES);
      }
    }

    // Every template is done, so the pieces exist. placeOnly never exports, so
    // there is nothing to composite there.
    if (CONFIG.kit && CONFIG.kit.enabled && !CONFIG.placeOnly) {
      log.push('── ' + CONFIG.kit.suffix + ' (' + CONFIG.kit.size + '×' + CONFIG.kit.size + ')');
      for (var k = 0; k < slugs.length; k++) {
        // Isolated like the per-design work: a kit sheet is a bonus on top of
        // three images that are already on disk and already usable.
        try {
          if (buildKit(slugs[k], produced, log)) {
            log.push('    ✓ ' + slugs[k] + '-' + CONFIG.kit.suffix + '.' + CONFIG.format);
            made++;
          }
        } catch (eKit) {
          log.push('    ✗ ' + slugs[k] + '-' + CONFIG.kit.suffix + ': ' + eKit.message);
        }
      }
    }
  } finally {
    app.displayDialogs = prevDialogs;
  }

  alert('build-jersey-mockups  [' + VERSION + ']\n\n' +
    made + ' image(s) exported from ' + slugs.length + ' design(s)\n\n' + log.join('\n') +
        '\n\nNext: node compress-mockups.js "' + CONFIG.outDir + '"');
}

main();
