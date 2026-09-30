# Store theme CSS & fonts (30 Sep 2026)

The stores' header/nav/footer styling is NOT in this repo or in `design-momuto`. It lives in the
store platform (manage.momuto.com). The only piece we can read from a repo is what a browser
sees, via `design-momuto/scripts/measure-sites.js` and `find-jost.js` (GitHub Actions workflow
"Measure sites (header/footer)": real Chromium against es/us/www/fr and the design site; read-only).

## The live custom-CSS script
- **Name in the CMS: `PC端你也喜欢产品调准css`** (custom code, all stores; owner, 30 Sep 2026).
- Holds: product-recommendation tweaks (`.productrec-*`), desktop nav/action-icon margins
  (>=1200px), nav font rules, hide `a.account_icon.login`, and the **mobile menu overlap fix**
  (`.mobile_nav .panel-menu-ul.only-warp-menu` + `[style*="left: -"]` translateX + `only-ul-left100`).
  Keep all of it; only the font rules change.
- Version to paste (30 Sep 2026, owner ruling: menu **14px / 0.5px**, Outfit). The `html body` prefix is what makes it
  beat the theme's own nav rule (which is later in the cascade and has the same strength, so the earlier plain
  `.page-header … .nav a` rule lost — the live check showed Jost 15px winning):

```css
html body .page-header .header_box_wrap .header_box .nav ul.tree-wrap li .nav-li-a a,
html body .page-header .header_box_wrap .header_box .nav a {
    font-size: 14px !important;
    font-family: 'Outfit', sans-serif !important;
    font-weight: 400 !important;
    line-height: 22px !important;
    letter-spacing: 0.5px !important;
}
.mobile_nav a, .mobile_nav .panel-menu-item {   /* two rules in the live script, identical values */
    font-size: 14px;
    font-family: 'Outfit', sans-serif !important;
    font-weight: 500 !important;
    line-height: 24px;
}
```
  (The full script, unchanged apart from these font rules, lives in the CMS — do not treat this file as a mirror.
  How to verify: `design-momuto` workflow "Measure sites" → `scripts/find-jost.js` prints the computed nav font and every
  rule that sets it; expect Outfit 14px 0.5px. DevTools tip: the font hover card on a Styles line shows the DECLARED
  value, not the winner — read Computed → Rendered Fonts.)

## Jost audit (measured live, 30 Sep 2026)
Stores (es/us/www/fr) still download and render Jost (`fonts.gstatic.com/s/jost/v6/...woff2`);
the design site uses Outfit only. Where Jost is declared, all in the platform theme:
1. Theme typography: `--title_font_family: Jost`, `--general_font_family: Jost`.
2. Two `@font-face 'Jost'` blocks (400).
3. The custom-CSS script above (3 rules).
4. A further nav rule in the theme's own output (seen in DevTools at `(index):6787`):
   `font-family:'Jost' !important; font-size:15px !important; font-weight:400; line-height:22px`,
   which currently WINS over the script and also supplies `letter-spacing:1px; text-transform:uppercase`.

Moving the stores to Outfit means changing all four. Check with the workflow afterwards (font
requests must no longer list jost).

## Measured store header/footer (1920px viewport)
Top bar 41px `#E2214B`, 14px text; header row 71px (total 112px); logo 92px; nav 15px / weight 400 /
uppercase / 1px letter-spacing; header icons 20px; footer links 14px; footer 406–420px; footer logo 120px.
Bar text: EN `FREE SHIPPING OVER +50€`, US `FREE SHIPPING OVER $59`, ES `ENVÍO GRATIS PEDIDOS +50€`,
FR `LIVRAISON GRATUITE À PARTIR DE 50 €`. The design site (`design-momuto/templates/*/layout`)
was matched to these numbers (PR branch `claude/blissful-cerf-d71g6b-header`); its font goes through
one variable `--mo-font`.
