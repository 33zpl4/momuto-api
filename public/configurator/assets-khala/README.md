# assets-khala

Drop the two on-body composite PNGs here (transparent bg, 1500x1500, garment + design
baked in, front and back in the same position/scale):

- the-khala-front.png
- the-khala-back.png

Shared assets (logo-momuto.png, fonts/, template-slots.json) are already copied from Apex.

After upload, the engineer will:
1. analyse the PNG colours and write palette.json  ({ "primary":"#..","secondary":"#..","trim":"#.." })
2. build:  python3 build-assets.py khala assets-khala --composite
3. wire index-khala.html + the product-page custom block
