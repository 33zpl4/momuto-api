#!/usr/bin/env python3
"""Calibration set for the admiral mockup: a labelled 10% grid on every canvas.

Run the jsx on slug "calib" and the export shows where each canvas cell lands
on the garment, where the masks cut, and how the seams line up. Cells are
labelled "<col><row>" (A0 = top-left), rows tinted so unlabelled slivers can
still be placed.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
import colorsys


def hsl(h, sat, light):
    r, g, b = colorsys.hls_to_rgb(h / 360, light / 100, sat / 100)
    return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))


HERE = Path(__file__).parent
OUT = HERE / "calib"
OUT.mkdir(exist_ok=True)
SLUG = "calib"
FONT = TTFont("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
GS, CMAP, UPEM = FONT.getGlyphSet(), FONT.getBestCmap(), FONT["head"].unitsPerEm

PANEL_HUES = {"front": 210, "sleeves": 20, "shoulders": 120, "collartop": 280, "collarbottom": 50}


def label(text, size, x, y, fill="#000", extra=""):
    s = size / UPEM
    parts, cx = [], 0.0
    for ch in text:
        g = GS[CMAP[ord(ch)]]
        pen = SVGPathPen(GS); g.draw(pen)
        parts.append(f'<path transform="translate({cx*s:.2f},0) scale({s:.5f},{-s:.5f})" d="{pen.getCommands()}"/>')
        cx += g.width
    return f'<g fill="{fill}" {extra} transform="translate({x - cx*s/2:.2f},{y:.2f})">{"".join(parts)}</g>'


def grid(name, w, h, cols=10, rows=10, viewbox=None, tag=None):
    hue = PANEL_HUES[name]
    tag = tag or name[:2].upper()
    cw, rh = w / cols, h / rows
    b = [f'<rect x="0" y="0" width="{w}" height="{h}" fill="{hsl(hue,60,92)}"/>']
    for r in range(rows):
        light = 78 if r % 2 else 88
        b.append(f'<rect x="0" y="{r*rh:.2f}" width="{w}" height="{rh:.2f}" fill="{hsl(hue,55,light)}"/>')
    fs = min(cw, rh) * 0.32
    for r in range(rows):
        for c in range(cols):
            x, y = c * cw, r * rh
            b.append(f'<rect x="{x:.2f}" y="{y:.2f}" width="{cw:.2f}" height="{rh:.2f}" fill="none" stroke="#000" stroke-width="{min(cw,rh)*0.02:.2f}"/>')
            b.append(label(f"{chr(65+c)}{r}", fs, x + cw / 2, y + rh / 2 + fs * 0.35))
    # heavy border + panel tag, and a marker at the canvas TOP edge
    b.append(f'<rect x="0" y="0" width="{w}" height="{h}" fill="none" stroke="#f00" stroke-width="{min(cw,rh)*0.08:.2f}"/>')
    b.append(f'<rect x="0" y="0" width="{w}" height="{rh*0.12:.2f}" fill="#f00"/>')
    b.append(label(tag, min(cw, rh) * 0.9, w / 2, h / 2 + min(cw, rh) * 0.3, fill="#000", extra='fill-opacity="0.35"'))
    vb = viewbox or f"0 0 {w} {h}"
    return (f'<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n'
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{vb}">\n'
            + "\n".join(b) + "\n</svg>\n")


(OUT / f"{SLUG}-front.svg").write_text(grid("front", 2980, 3936, cols=10, rows=12, tag="F"))
(OUT / f"{SLUG}-sleeves.svg").write_text(
    grid("sleeves", 356.65833, 659.87083, cols=6, rows=12, tag="S").replace(
        'width="356.65833" height="659.87083"', 'width="1348" height="2494"'))
(OUT / f"{SLUG}-shoulders.svg").write_text(grid("shoulders", 534.71997, 217.28, cols=10, rows=4, tag="SH"))
(OUT / f"{SLUG}-collartop.svg").write_text(grid("collartop", 2000, 336, cols=10, rows=6, tag="CT"))
(OUT / f"{SLUG}-collarbottom.svg").write_text(grid("collarbottom", 2894.6667, 473.33334, cols=10, rows=6, tag="CB"))
for p in sorted(OUT.glob("*.svg")):
    print(p.name, p.stat().st_size)
