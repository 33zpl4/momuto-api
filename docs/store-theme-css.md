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
- Version to paste (nav font rules: Jost -> Outfit; desktop 15px/400/22px = what renders today):

```css
.page-header .header_box_wrap .header_box .nav a {
    font-size: 15px;
    font-family: 'Outfit', sans-serif !important;
    font-weight: 400 !important;
    line-height: 22px;
}
.mobile_nav a, .mobile_nav .panel-menu-item {   /* two rules in the live script, identical values */
    font-size: 14px;
    font-family: 'Outfit', sans-serif !important;
    font-weight: 500 !important;
    line-height: 24px;
}
```
  (The full script, unchanged apart from these three font rules, was pasted in the 30 Sep 2026 session;
  the CMS copy is the source of truth — do not treat this file as a mirror.)

## Jost audit (measured live, 30 Sep 2026, after the `PC端你也喜欢产品调准css` font rules went to Outfit)
Stores (es/us/www/fr) still download and render Jost (`fonts.gstatic.com/s/jost/v6/...woff2`; nav
computes to `Jost 15px w400`); the design site uses Outfit only. Remaining declarations, all in the
platform theme / custom code (the script above is clean now):
1. **Nav rule (the one that wins)** in another custom-CSS block, commented `/* Navigation - consistent sizing */`:
   `.page-header .header_box_wrap .header_box .nav ul.tree-wrap li .nav-li-a a, .page-header .header_box_wrap .header_box .nav a { font-family:'Jost' !important; font-weight:400 !important; line-height:22px !important; font-size:15px !important; ... }`
2. **Section titles rule** in the same block, commented `/* Section titles - reduced size */`:
   `.block_collection_product_tab_title a, .block_title.notCenter > h2, .block_title > div > a, div.block_title.notCenter > h2 { font-family:'Jost' !important; font-weight:400 !important; line-height:34px !important; font-size:28px !important }`
3. Theme typography: `--title_font_family: Jost`, `--general_font_family: Jost`.
4. Two `@font-face 'Jost'` blocks (400).
Moving the stores to Outfit = change 1–4, then re-run the workflow: nav must read Outfit and font
requests must no longer list `jost`. (`configurator-styles.css` on the design site only mentions Jost
in comments about overriding it — harmless.)

## Measured store header/footer (1920px viewport)
Top bar 41px `#E2214B`, 14px text; header row 71px (total 112px); logo 92px; nav 15px / weight 400 /
uppercase / 1px letter-spacing; header icons 20px; footer links 14px; footer 406–420px; footer logo 120px.
Bar text: EN `FREE SHIPPING OVER +50€`, US `FREE SHIPPING OVER $59`, ES `ENVÍO GRATIS PEDIDOS +50€`,
FR `LIVRAISON GRATUITE À PARTIR DE 50 €`. The design site (`design-momuto/templates/*/layout`)
was matched to these numbers (PR branch `claude/blissful-cerf-d71g6b-header`); its font goes through
one variable `--mo-font`.
