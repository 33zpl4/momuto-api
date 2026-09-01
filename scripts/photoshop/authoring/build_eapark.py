#!/usr/bin/env python3
"""Author the EA PARK front set for the admiral mockup, on the cdm2 canvases.

Outputs <slug>-{front,shoulders,sleeves,collartop,collarbottom}.svg in OUT.
Everything is authored as plain paths; text is converted to outlines so
Photoshop never needs the fonts.
"""
import re
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.varLib import instancer
from svgelements import SVG, Path as SPath

HERE = Path(__file__).parent
FONTS = HERE / "fonts"
CDM2 = HERE / "cdm2"
OUT = HERE / "eapark"
OUT.mkdir(exist_ok=True)
# Variants: one folder, several slugs, one jsx run. Each key becomes "<slug>-<kind>.svg".
#   seam_x0      x where the raglan seam starts at the collar (canvas px). Smaller = less white on top.
#   sleeve_edge  x of the blue line's inner edge at the top of the sleeve canvas (mm). Smaller = thinner line.
#   shoulder_blue y where the shoulder panel's blue band ends (canvas px, visible rows start at 108).
BASE = dict(seam_x0=900, sleeve_edge=88, shoulder_red=206, hug_x=465)
VARIANTS = {
    "eapark": BASE,                      # seam hugs the armhole at x=465
    "alt": dict(BASE, hug_x=500),        # same shape, wedge a little wider at the bottom
}

BLUE, RED, WHITE = "#0D47A1", "#E53935", "#FFFFFF"

# ------------------------------------------------------------------ text → paths

_font_cache = {}


def load_font(name, wght=None):
    key = (name, wght)
    if key in _font_cache:
        return _font_cache[key]
    f = TTFont(FONTS / name)
    if wght is not None and "fvar" in f:
        f = instancer.instantiateVariableFont(f, {"wght": wght})
    _font_cache[key] = f
    return f


def text_path(text, font_name, size, wght=None, tracking=0.0):
    """Return (d, width, ascent, descent) of `text` as one SVG path in a
    coordinate system where the baseline is y=0 and y grows DOWN."""
    f = load_font(font_name, wght)
    gs = f.getGlyphSet()
    cmap = f.getBestCmap()
    upem = f["head"].unitsPerEm
    s = size / upem
    x = 0.0
    parts = []
    for ch in text:
        gname = cmap.get(ord(ch))
        if gname is None:
            x += 0.3 * upem
            continue
        g = gs[gname]
        pen = SVGPathPen(gs)
        g.draw(pen)
        d = pen.getCommands()
        if d:
            parts.append(f'<path transform="translate({x*s:.2f},0) scale({s:.6f},{-s:.6f})" d="{d}"/>')
        x += g.width + tracking * upem
    width = x * s
    asc = f["hhea"].ascent * s
    desc = -f["hhea"].descent * s
    return "".join(parts), width, asc, desc


def text_group(text, font_name, size, cx, baseline_y, fill, wght=None, tracking=0.0, extra=""):
    parts, w, _, _ = text_path(text, font_name, size, wght, tracking)
    return (f'<g fill="{fill}" transform="translate({cx - w/2:.2f},{baseline_y:.2f})" {extra}>'
            f"{parts}</g>")


def text_width(text, font_name, size, wght=None, tracking=0.0):
    return text_path(text, font_name, size, wght, tracking)[1]


# ------------------------------------------------------------------ momuto mark from cdm2

def momuto_paths_from_cdm2():
    """Reified outline paths of the momuto mark in cdm2-front, recoloured."""
    svg = SVG.parse(str(CDM2 / "cdm2-front.svg"), reify=True)
    target = None
    for el in svg.elements():
        lab = el.values.get("inkscape:label")
        if lab == "momuto-logo" or el.id == "g606-5":
            target = el
            break
    if target is None:
        raise SystemExit("momuto-logo group not found in cdm2-front.svg")
    out = []
    for el in target.select():
        if isinstance(el, SPath) and len(el):
            out.append(f'<path d="{el.d()}"/>')
    bb = target.bbox()
    return "".join(out), bb


def svg_doc(w, h, body, viewbox=None):
    vb = viewbox or f"0 0 {w} {h}"
    return (f'<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n'
            f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'width="{w}" height="{h}" viewBox="{vb}">\n{body}\n</svg>\n')


# ------------------------------------------------------------------ FRONT 2980×3936

def build_front(SLUG, v):
    W, H = 2980, 3936
    b = []
    # base + tonal pinstripes (8 columns, white at 6%)
    b.append(f'<rect id="base" x="-120" y="-120" width="{W+240}" height="{H+240}" fill="{BLUE}"/>')
    period = W / 8
    stripe = period * 0.46
    for i in range(8):
        x = i * period + (period - stripe) / 2
        b.append(f'<rect x="{x:.1f}" y="-120" width="{stripe:.1f}" height="{H+240}" fill="{WHITE}" fill-opacity="0.06"/>')

    # One continuous seam line per side: leaves the collar diagonally, turns vertical at
    # the armpit (~y 1250) and continues as the side stripe, bowing inward at the waist and
    # flaring back out at the hem. Visible body edge (calib): x~440 at the armpit, ~500 at
    # the waist; nothing above y 330 is visible.
    x0 = v["seam_x0"]
    hx = v["hug_x"]
    # vertical along the armhole up to logo height (~y 620), then curves in to the collar
    P_TOP = f"M {x0},250 C {x0-140},330 {hx+10},400 {hx+10},620 C {hx},900 {hx},1200 {hx},1450"
    P_SIDE = f"C {hx},1800 560,2300 640,2700 C 700,2950 600,3400 520,3900"
    P = P_TOP + " " + P_SIDE
    # white raglan panel: everything outboard of the seam, down to the armpit
    sweep = P_TOP + f" L -120,1500 L -120,-120 L {x0},-120 Z"
    def offset(path_d, dx):
        return f'<g transform="translate({dx},0)">{path_d}</g>'
    stroke = lambda d, col, w: f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{w}" stroke-linecap="round"/>'
    side = (f'<g id="seam-left">'
            f'<path d="{sweep}" fill="{WHITE}"/>'
            + offset(stroke(P, WHITE, 40), -95)        # outer white band (invisible on the panel)
            + stroke(P, RED, 44)                        # red piping along the seam
            + offset(stroke(P, WHITE, 16), 85)         # thin white vivo on the body side
            + '</g>')
    b.append(side)
    b.append(f'<g transform="matrix(-1,0,0,1,{W},0)">{side.replace("seam-left","seam-right")}</g>')

    # momuto mark (from cdm2, same slot, white)
    mp, bb = momuto_paths_from_cdm2()
    b.append(f'<g id="momuto-logo" fill="{WHITE}" transform="translate(260,0)">{mp}</g>')

    # crest placeholder in the team-logo slot: box (1878,688)-(2127,1076), centre (2002,882)
    cx, cy, r = 1920, 882, 165
    crest = [f'<g id="team-logo">',
             f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{WHITE}" stroke-width="9"/>',
             f'<circle cx="{cx}" cy="{cy}" r="{r-22}" fill="none" stroke="{WHITE}" stroke-width="3"/>',
             text_group("EA", "PlayfairDisplay[wght].ttf", 165, cx, cy + 48, WHITE, wght=700, tracking=-0.06),
             text_group("EA PARK", "Oswald[wght].ttf", 40, cx, cy - 72, WHITE, wght=600, tracking=0.14),
             text_group("FOOTBALL CLUB · 2025", "Oswald[wght].ttf", 24, cx, cy + 112, WHITE, wght=500, tracking=0.10),
             '</g>']
    b.extend(crest)

    # wordmark "EA PARK" — script, white, 1400 wide, centred on the sponsor slot
    target_w = 1400
    size = 100
    w = text_width("EA PARK", "KaushanScript-Regular.ttf", size, tracking=0.02)
    size = size * target_w / w
    b.append(text_group("EA PARK", "KaushanScript-Regular.ttf", size, W / 2, 1640, WHITE, tracking=0.02,
                        extra='id="front-sponsor"'))
    # flourish under the wordmark: long swash with one loop, tapering ends
    b.append(f'<path id="flourish" d="M 700,1960 C 1000,1800 1250,2000 1440,1900 '
             f'C 1560,1836 1520,1760 1460,1800 C 1400,1840 1460,1940 1600,1930 '
             f'C 1800,1915 2000,1860 2280,1930" '
             f'fill="none" stroke="{WHITE}" stroke-width="28" stroke-linecap="round"/>')
    (OUT / f"{SLUG}-front.svg").write_text(svg_doc(W, H, "\n".join(b)))


# ------------------------------------------------------------------ SLEEVES 1348×2494 (mm viewBox)

def build_sleeves(SLUG, v):
    VW, VH = 356.65833, 659.87083
    e = v["sleeve_edge"]
    edge = f"M {e},-2 C {e+2},200 {e-6},420 {e-12},600"
    band = f"M -2,-2 L {e},-2 C {e+2},200 {e-6},420 {e-12},600 L {e-12},662 L -2,662 Z"
    b = [f'<rect x="-2" y="-2" width="{VW+4}" height="{VH+4}" fill="{WHITE}"/>',
         f'<path d="{band}" fill="{BLUE}"/>',
         f'<path d="{edge}" fill="none" stroke="{RED}" stroke-width="7"/>',
         # cuff: red / white / blue at the hem (cdm2 band sits at 600–613)
         f'<rect x="-2" y="588" width="{VW+4}" height="11" fill="{RED}"/>',
         f'<rect x="-2" y="599" width="{VW+4}" height="7" fill="{WHITE}"/>',
         f'<rect x="-2" y="606" width="{VW+4}" height="{VH-606+4}" fill="{BLUE}"/>']
    (OUT / f"{SLUG}-sleeves.svg").write_text(svg_doc(1348, 2494, "\n".join(b), viewbox=f"0 0 {VW} {VH}"))


def build_shoulders(SLUG, v):
    # Whole panel blue (the body runs over the top of the shoulder); red pipe along its
    # lower edge, where it meets the white wedge on the front and the sleeve top.
    W, H = 534.71997, 217.28
    rp = v["shoulder_red"]
    b = [f'<rect x="-170" y="-63" width="890" height="427" fill="{BLUE}"/>',
         f'<rect x="-170" y="{rp}" width="890" height="9" fill="{RED}"/>']
    (OUT / f"{SLUG}-shoulders.svg").write_text(svg_doc(W, H, "\n".join(b)))


def build_collartop(SLUG, v):
    W, H = 2000, 336
    b = [f'<rect x="0" y="0" width="{W}" height="{H}" fill="{BLUE}"/>',
         f'<rect x="0" y="40" width="{W}" height="26" fill="{WHITE}"/>',
         f'<rect x="0" y="66" width="{W}" height="56" fill="{RED}"/>',
         f'<rect x="0" y="122" width="{W}" height="28" fill="{WHITE}"/>']
    (OUT / f"{SLUG}-collartop.svg").write_text(svg_doc(W, H, "\n".join(b)))


def build_collarbottom(SLUG, v):
    W, H = 2894.6667, 473.33334
    b = [f'<rect x="0" y="0" width="{W}" height="{H}" fill="{BLUE}"/>',
         f'<rect x="0" y="160" width="{W}" height="34" fill="{WHITE}"/>',
         f'<rect x="0" y="194" width="{W}" height="79" fill="{RED}"/>',
         f'<rect x="0" y="273" width="{W}" height="30" fill="{WHITE}"/>']
    (OUT / f"{SLUG}-collarbottom.svg").write_text(svg_doc(W, H, "\n".join(b)))


if __name__ == "__main__":
    import sys
    wanted = sys.argv[1:] or list(VARIANTS)
    for slug in wanted:
        v = VARIANTS[slug]
        build_front(slug, v)
        build_sleeves(slug, v)
        build_shoulders(slug, v)
        build_collartop(slug, v)
        build_collarbottom(slug, v)
    for p in sorted(OUT.glob("*.svg")):
        print(p.name, p.stat().st_size)
