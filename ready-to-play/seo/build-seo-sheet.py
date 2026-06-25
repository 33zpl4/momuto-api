#!/usr/bin/env python3
"""
Build an ABCSHOPPY product-IMPORT sheet that fills SEO on the 14 Ready-to-Play
products, in the store's exact import-template layout.

Usage:
  python3 build-seo-sheet.py <import_template.xlsx> <products_export.xlsx> \
                             <rtp-seo.<locale>.json> <out.xlsx>

Why a template AND an export:
  - The IMPORT template defines the required column set + order (34 cols). The
    product EXPORT has a different layout (extra cols, different tail order) — if
    you import an export-shaped file, every row fails. So we emit in template order.
  - The EXPORT supplies each product's existing values (Product ID, Inner title /
    type:3d pointer, Price, Media, SPU, SKU…) so the update keeps them intact.
  - The SEO JSON supplies Subtitle / SEO Title / SEO Description / SEO Keywords /
    Short Description (the only fields we change). Match key = SEO URL Handle.

Update vs create: Product ID is filled -> updates in place. Leave it blank to create.
"""
import sys, json, openpyxl

FILL = ['Subtitle', 'SEO Title', 'SEO Description', 'SEO Keywords', 'Short Description']

def num(v, integer=False):
    if v is None or v == '': return None
    try:
        f = float(v); return int(f) if integer else f
    except Exception: return v

def main(tpl, exp, seo_json, out_path):
    seo = json.load(open(seo_json, encoding='utf-8'))
    ts = openpyxl.load_workbook(tpl)['sheet1']
    NC = 34
    headers = [ts.cell(1, c).value for c in range(1, NC + 1)]
    instr = [ts.cell(2, c).value for c in range(1, NC + 1)]

    es = openpyxl.load_workbook(exp, data_only=True)['sheet1']
    eh = [c.value for c in es[1]]; ei = {h: i for i, h in enumerate(eh)}
    ev = lambda r, h: r[ei[h]].value if h in ei else None
    src = {}
    for r in es.iter_rows(min_row=3):
        if ev(r, 'Product ID') is None: continue
        h = str(ev(r, 'SEO URL Handle') or '')
        if h in seo: src[h] = {hh: ev(r, hh) for hh in eh}

    out = openpyxl.Workbook(); o = out.active; o.title = 'sheet1'
    o.append(headers); o.append(instr); n = 0
    INT_COLS = {'Product ID', 'Virtual sales', '*Inventory Rules', 'Inventory'}
    FLOAT_COLS = {'*Price', 'Compare at price', 'Weight(kg)'}
    for h, s in src.items():
        e = seo[h]; row = []
        for col in headers:
            if col in FILL:
                key = {'SEO Title': 'seo_title', 'SEO Description': 'meta',
                       'SEO Keywords': 'keywords', 'Short Description': 'short',
                       'Subtitle': 'subtitle'}[col]
                row.append(e[key])
            elif col == 'Created at':
                row.append(None)
            elif col == 'Description':
                row.append('')
            elif col in INT_COLS:
                row.append(num(s.get(col), True))
            elif col in FLOAT_COLS:
                row.append(num(s.get(col)))
            else:
                row.append(s.get(col) if s.get(col) not in (None,) else '')
        o.append(row); n += 1
    out.save(out_path)
    print(f'wrote {out_path}: {n} products in {NC}-col template layout')

if __name__ == '__main__':
    if len(sys.argv) != 5:
        print(__doc__); sys.exit(1)
    main(*sys.argv[1:])
