# Size guide — the rule, the numbers, and the six places they live (6 Nov 2026)

Owner rulings, 5–6 Nov 2026: the jerseys are **slightly slim fit at every size** (not a player-version cut); the guide tells people
how to choose, it does not explain what a player version is; **4XL added** and selectable in the cart.

## The rule (applied to every adult size)

For any chest measurement the guide recommends **the same size adidas would, or one larger, never smaller** (adidas men's chart:
XS 83–86, S 87–92, M 93–100, L 101–108, XL 109–118, 2XL 119–130 cm; third-party chart, Sport-Conrad, read 5 Nov). The old bands
put S/M customers one size *smaller* than adidas (a 95 cm chest was S with us, M at adidas); that was the miss. Steps are a flat
6 cm of chest per size, weight keeps the old chart's chest↔weight pairing.

| size | XS | S | M | L | XL | 2XL | 3XL | **4XL** |
|---|---|---|---|---|---|---|---|---|
| chest cm | 82–86 | 86–91 | 91–97 | 97–103 | 103–109 | 109–115 | 115–121 | 121–127 |
| weight kg | 50–57 | 57–65 | 65–75 | 75–85 | 85–95 | 95–105 | 105–115 | 115–125 |
| height cm (guide only) | 160–165 | 165–170 | 170–175 | 175–180 | 180–185 | 185–190 | 190–195 | 195–200 |

- **Shorts are chosen by hips** (first column, shown on phones; the height column was dropped: 20 cm per size, 2XL = 3XL). Hips cm:
  XS 85–90, S 91–96, M 97–102, L 103–108, XL 109–114, 2XL 115–120, 3XL 121–126, **4XL 127–132**; waist 73–90 … 115–132.
- **Kids' heights have no gaps:** 128 = 118–128, 140 = 129–140, 152 = 141–152, 164 = 153–164 (98/104 and 110/116 unchanged).
- **Above 4XL:** one line, "over 127 cm chest or 132 cm hips? write to us before ordering"; no 5XL invented.
- **Notice wording (all locales):** "athletic, slightly slim fit (slim fit). Pick by chest and weight; if they point to different sizes,
  or you are between two, take the larger one." FR/IT no longer say "ajustée" / "aderente" (read as tight). Owner: keep it short.

## Where the numbers must stay in sync

1. `size-guide/{en,es,fr,it}` fragments → `node scripts/build-size-guide-pages.js` → `cms/pages/<locale>/<handle>.json`; **US is edited
   directly** in `cms/pages/us/size-guide.json` (same tables, `&ndash;` entities).
2. `faq/faq.<locale>.json` (sizes + "How do the kits fit?" + re-order entries) → `build-faq-pages.js` → `build-wa-bot-answers.js`
   (WhatsApp bot + on-page assistant answers). "XS–4XL" appears in the FAQ source.
3. design-momuto `templates/{en,es,fr,it}/cartItem.html`: the jersey **and** short size `<select>`s (4XL option) and the "Find your
   size" popup table (same adult table, same notice). `server-patches/README.md` §19.
4. `static/*/llms.txt` if a size fact changes (the range is not in llms.txt today).
5. Factory: sizes travel as plain text in `goods_info`; **no code whitelists sizes** (checked 6 Nov), so 4XL needs no server change.
6. This file.

## Not verified / open

- **The factory has not confirmed it makes 4XL** (owner to confirm; tell them before the first 4XL order).
- **The bands come from comparing body charts, not from our garment.** Real flat chest widths per size from the factory would let us
  re-check every band against the garment itself. Until then S/M/L are set by the never-smaller-than-adidas rule.
- Live pages were not opened after deploy (runs: CMS deploy 42009809332, cart deploy 42009589017).
