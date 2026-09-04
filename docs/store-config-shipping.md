# Store config & shipping — live state and the tool that owns it

**Tool**: `scripts/sync-store-config.js` + `.github/workflows/sync-store-config.yml`
(dispatch-only; inputs `mode` = inspect | inspect-zones | apply-nav |
apply-seo | apply-shipping, `store`, `nav_name`, `dry_run`). It is the ONLY
sanctioned way to touch navs, homepage SEO plans, and shipping zones — the
sandbox can't reach the CMS (CLAUDE.md rule 2). Always `inspect-zones`
before an `apply-shipping` change; always dry-run first. API surface notes:
`docs/oemsaas-api-notes.md` (/navs, /seoplans, /shippingzones, /couriers).

## Shipping — live state (normalized 1 Sep 2026, all runs green)

Owner rulings: **€50 threshold everywhere in the EU stores, €3.90 under
it; US $59 / $4.90; everything 25–30 days**. One set of numbers (CLAUDE.md
rule 6) — a zone that disagrees is a bug.

| Store | Zone (id) | Areas | Plan |
|---|---|---|---|
| EN | Royal Mail (161797*) | GB | €3.90 < €50, free ≥ €50 — "Royal Mail \| 25-30 Days Delivery" |
| EN | worldwide | rest | same numbers — "Certified Courier \| 25-30 Days Delivery" |
| FR | Colis Privé | FR | €3.90 < €50, free ≥ €50 — "Colis Privé \| Livraison 25-30 jours", "Gratuit dès 50€." |
| ES | CTT Express (186334) | ES mainland (201) | "CTT Express (25-30 días)", "Gratis desde 50€." |
| ES | Correos (186335) | Islas Canarias (253) | "Correos (25-30 días)" |
| ES | worldwide (20559) | 251 areas (ES+IC removed) | €3.90 < €50, free ≥ €50 |
| IT | Royal Mail (161797) | GB | aligned to €3.90/€50 |
| IT | worldwide (161796) | 252 areas | was free-on-everything → now €3.90/€50 — "Corriere certificato \| Consegna in 25-30 giorni" |
| US | USPS (186277) | US only (229) | $4.90 < $59, free ≥ $59 |
| US | worldwide (186276) | excludes US | $4.90 < $59, free ≥ $59 |

\* EN and IT zone ids overlap in this table only by coincidence of the
clone; trust `inspect-zones` output over this table for ids.

Known leftover: ES has a legacy **type-2 custom zone "Regions de España"**
(4 products, 55 areas, free ≥ €49.9) deliberately untouched — owner to
review in the ES admin.

## Hard-won API behavior (verified live)

- **Type-1 (general) zones may not overlap areas**: POST /shippingzones
  into covered territory → 408 `数据已存在`. To carve a country out into
  its own carrier zone: **shrink the covering zone FIRST (PUT without the
  country), then POST the new zone**, with rollback re-adding the country
  if the POST fails (never leave an area with no method). ES routine in
  `sync-store-config.js` is the reference implementation.
- **PUT /shippingzones/{id} replaces the whole object** — send name, type,
  areas, full plan[] back. Plans are keyed on `total_price` with
  `rule_min`/`rule_max`/`fee_method:1`/`fee`; a free-shipping threshold is
  TWO plans (below/above).
- **503 `权限验证失败`** = the store's developer app lacks
  ShippingZone → Manage permission. Owner toggles it in that store's app
  settings (this blocked IT for a day; fixed 1 Sep).
- POST /navs **upserts by `nav_name`** — "duplicate menu names will be
  overwritten". `apply-nav` refuses to create a name that doesn't already
  exist, because the theme binds menus by name (US menu = "Header Menu").
- /seoplans `meta_keywords` MUST be an array (rule 1 applies here too).

## Sequencing rule for any zone surgery

Never leave a country uncovered between writes: create/verify the new
narrow zone's coverage before (or atomically with) removing that country
from the wide zone — except where overlap forbids creation first, in which
case shrink-then-create WITH rollback (see above). The script logs ✅/❌
per write; a green job with a ❌ line is still a failure — read the log.


## Menus as of 4 Sep 2026 (curated in `sync-store-config.js`, `MENUS`)

`apply-nav` now refuses any store+menu pair without a curated tree in
`MENUS` (it used to push the US header onto whatever store you named).
`inspect-nav` prints one store's menus compactly — the full `inspect` log
overflows the 3000-line tail the API hands back, and the sandbox cannot
download the log zip.

- **US "Header Menu"** (809770): Custom Jerseys → Ready to Play, **Jersey
  Maker — free 3D tool** (`/pages/custom-soccer-jersey-designer`, added
  4 Sep from the GSC maker-cluster finding), Custom design request ($15), AI
  concept; Basketball; Iconic Series (Drop 01/02); Support (FAQ, Printing &
  Materials, Size guide).
- **US "Footer Menu"** (807575): was a clone carrying EN page ids and
  handles that do not exist on US (`contact-us_ebf80444`,
  `terms-of-service_736dfc8a`, `privacy-policy_0d030312`); now custom URLs
  to US handles incl. `/pages/shipping-policy` and `/pages/return-policy`.
- **EN "Header Menu"** (63790): CUSTOM KITS → **Jersey Maker — free 3D
  tool**, Design Gallery, Ready-to-Play; ICONIC SERIES; THE BRAND; SUPPORT
  (FAQ, Printing & Materials `/pages/printing` id 234946, Size Guide, Contact).
- **EN "Footer Menu"** (63789): unchanged except Shipping policy →
  `/pages/shipping-policy` and Returns & Exchanges → `/pages/return-policy`.
- Both stores also carry an unbound draft menu named "HEADER" with empty
  URLs — ignore it; the theme binds "Header Menu" / "Footer Menu".
- ES/FR/IT menus are not curated — `apply-nav` will refuse them until a
  tree is transcribed from `inspect-nav`.
