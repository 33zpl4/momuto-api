Drop the 3 Apex design files here (separate SVGs are fine):

    front.svg    back.svg    sleeve.svg     (or front-design.png / back-design.png / sleeve-design.png)

Notes for whoever picks this up:
- back design = pattern ONLY (no PLAYER/number; that's a separate font overlay).
- SVGs may be authored in the signature colours (navy/gold). The build remaps the
  design fills to the 4-tone pink reference before rasterizing:
      becomes PRIMARY   -> #FF7DBD   (e.g. navy / body fill)
      mid               -> #FF98CA, #FCD0F3
      becomes SECONDARY -> #FEEAFC   (e.g. gold / panel fill)
  Record the fill->tone mapping used so it is reproducible.
- Shared files (blanks/slots/fonts/logo) are already copied from Fracture and are
  vertically aligned; do not touch them.
- Build:  python3 build-assets.py apex assets-apex/   (after SVGs are rasterized to PNG)
