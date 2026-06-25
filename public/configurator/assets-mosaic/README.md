# assets-mosaic

Drop the two on-body composite PNGs here (transparent bg, 1500x1500, garment + design
baked in, front and back in the same position/scale):

- the-mosaic-front.png
- the-mosaic-back.png

Shared assets (logo-momuto.png, fonts/, template-slots.json) are already copied from Apex.

After upload, the engineer will:
1. analyse the PNG colours and write palette.json  ({ "primary":"#..","secondary":"#..","trim":"#.." })
2. build:  python3 build-assets.py mosaic assets-mosaic --composite
3. wire index-mosaic.html + the product-page custom block
