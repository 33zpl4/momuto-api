#!/usr/bin/env python3
"""
Build an ABCSHOPPY product-import sheet that fills SEO fields on the 14
Ready-to-Play products, from a per-locale SEO JSON + a fresh products export.

Usage:
  python3 build-seo-sheet.py <products-export.xlsx> <rtp-seo.<locale>.json> <out.xlsx>

It starts from each product's existing export row and overwrites ONLY:
  Subtitle, SEO Title, SEO Description, SEO Keywords, Short Description
Everything else (Product ID, Inner title / type:3d pointer, Price, Media,
Handle, Variants Settings) is preserved so the import updates in place.
Match key: SEO URL Handle (jersey = <base>, kit = <base>-full-kit).
"""
import sys, json, openpyxl

def main(src_xlsx, seo_json, out_xlsx):
    seo = json.load(open(seo_json, encoding='utf-8'))
    wb = openpyxl.load_workbook(src_xlsx, data_only=True)
    ws = wb['sheet1']
    hdr = [c.value for c in ws[1]]; inst = [c.value for c in ws[2]]
    idx = {h: i for i, h in enumerate(hdr)}
    def gv(r, h): return r[idx[h]].value
    rows = [r for r in ws.iter_rows(min_row=3) if gv(r, 'Product ID') is not None]
    out = openpyxl.Workbook(); s = out.active; s.title = 'sheet1'
    s.append(hdr); s.append(inst); n = 0
    for r in rows:
        h = str(gv(r, 'SEO URL Handle') or '')
        if h not in seo:
            continue
        e = seo[h]; row = [c.value for c in r]
        row[idx['Subtitle']] = e['subtitle']
        row[idx['SEO Title']] = e['seo_title']
        row[idx['SEO Description']] = e['meta']
        row[idx['SEO Keywords']] = e['keywords']
        row[idx['Short Description']] = e['short']
        s.append(row); n += 1
    out.save(out_xlsx)
    print(f'wrote {out_xlsx} with {n} updated products')

if __name__ == '__main__':
    if len(sys.argv) != 4:
        print(__doc__); sys.exit(1)
    main(*sys.argv[1:])
