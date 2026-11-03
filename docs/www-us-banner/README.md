# www.momuto.com entry — US banner + one H1 per page (3 Nov 2026)

One script-manager entry, **www store only**, two jobs. Decided with the owner on 3 Nov 2026 instead of forking the platform theme
("Copy and Independent" / "Copy and Decorate" both create a theme copy; neither was needed).

| | |
|---|---|
| **File to paste** | [`www-us-banner-entry.html`](www-us-banner-entry.html) — the whole file (a `<style>` and a `<script>`). Generated; do not edit it. |
| **Entry name** | `MOMUTO www entry v1` (bump on every re-paste) |
| **Where** | the **www** store's script manager (Online Store → custom code), as a NEW entry. Not on us/es/fr/it, not inside the nav script. |
| **Undo** | disable or delete the entry. Nothing else was touched. |

## What it does
1. **H1 demotion, every page and post.** The theme prints the CMS title as `<h1 class="title">` above our fragment
   (`.page_detail_default > h1.title`; posts: `.blog_detail_default .plugin-container-header h1.title`), so every page had two H1s
   (probe runs 41618821013, 41617219868). The script swaps that element for a `<div class="title">` with the same text: the title-hide CSS
   keeps applying, nothing visible changes, the rendered DOM has one H1 (ours). Raw HTML still has the h1; Google indexes the rendered DOM.
2. **US banner, www only, never a redirect** (owner ruling, `docs/us-launch-status.md`). For a browser with language `en-US` and an
   `America/*` time zone (Canadian and Latin American zones excluded) a bar is inserted above the header: *Shopping from the US? Prices in
   USD and US delivery on our US store.* → **Go to us.momuto.com**, same path for `/`, `/pages/<handle>` and `/blogs/<handle>` (the handles
   are shared), the us homepage otherwise; `?from=www-banner` on the link. **×** hides it for 30 days (`localStorage`, no cookie, no beacon,
   no personal data). `?nobanner` hides it for a test, `?usbanner` forces it.

## Sources, build, check
`www-us-banner.css` + `www-us-banner.js` → `node scripts/build-www-us-banner-entry.js` → `www-us-banner-entry.html` (minified).
`--check` runs in the **Check copy rules** workflow and fails when the generated file is stale or a guard trips (version, host gate, parse).

## Tested (Chromium, stubs of the live theme markup from the probe; `scratchpad/test-www-entry.js` in the session)
en-US + New York page → one H1, banner shown, link `us.momuto.com/pages/faq?from=www-banner`, dismissed and still hidden after reload ·
en-US + Los Angeles post → one H1, banner · en-GB London → no banner · en-US Toronto → no banner · the same page served as
us.momuto.com → no banner (host gate) · `/products/<x>` → banner links to the us homepage. All six pass.

## NOT tested
The live store (paste, then open www.momuto.com from a US browser or add `?usbanner`); how the banner sits with the theme's own announcement
bar (it is a normal block above the header, not fixed); Safari/iOS; whether the script manager accepts a `<style>` + `<script>` box
(the account skin README has the same caveat). After pasting, run **Probe page head** on a page: `h1` should list one entry.

## Next change
Edit the sources, bump `--mo-www-entry` in the CSS and `VERSION` in the JS, rebuild, re-paste, rename the entry `vN`.
