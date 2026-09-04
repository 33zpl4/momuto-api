# us.momuto.com — launch ledger (1 Sep 2026)

The build record for the US store, written the week it went live. Read this
before touching any US surface; `docs/us-hub-plan.md` is the original plan,
THIS is what actually shipped and what's still open. Estate-wide shipping
config lives in `docs/store-config-shipping.md`.

## Live and verified (green Actions runs, per-write log evidence)

- **Domain**: bound per `docs/domain-binding-runbook.md` (A record `us` →
  104.18.20.248, bound grey-cloud, verified). Token `OEMSAAS_TOKEN_US` in
  GitHub Actions secrets.
- **Pages** (`pages/us/*`, deployed via `deploy-us-pages.yml`):
  ready-to-play, request-custom-kit-design (live Stripe link
  `buy.stripe.com/8x2fZhe204q8ge32KV3wQ0M`, $15 deposit),
  ai-concept-to-real-kit, custom-basketball-jerseys (tool-only launch,
  `suitName=mamuto3basket3`).
- **Blog**: 8 posts in `blogs/us/*.json`, US lexicon (soccer, USD), live.
  Store URLs are `/blogs/<handle>` — NO `/us/` segment (store-per-domain).
- **Products**: 7 RTP products cloned from EN at **$40.90** (owner-ruled
  from €35.00), ids 16910217–16910223, inner_title 3D pointers rewired —
  `scripts/create-us-rtp-products.js`.
- **Nav**: curated "Header Menu" via `sync-store-config.js apply-nav` —
  Custom Jerseys ▾ (Ready to Play / Custom design request ($15) / AI
  concept), Basketball, Iconic Series ▾ (Drop 01/02), Support ▾
  (FAQ / Printing / Size guide). Guides removed (owner ruling). The
  gallery is NOT in the menu yet (cloned later — see below).
- **Homepage SEO**: via `apply-seo` — title/descript/keywords in
  `sync-store-config.js` (`HOMEPAGE_SEO.us`).
- **Shipping**: USPS zone (US only) $4.90 under $59 / free at $59+;
  worldwide zone excludes the US. See the shipping doc.
- **Static**: `static/us.momuto.com/` robots.txt + llms.txt (USD/soccer
  lexicon), blog.css, sitemap with hreflang en ↔ en-US clusters
  (x-default = en) via `rebuild-sitemap.js`.
- **Gallery** (`/pages/custom-kit-gallery`): owner cloned it + ~130 team
  design pages from EN in the admin (1 Sep). SEO then fixed via
  `cms/pages/us/custom-kit-gallery.json` + `deploy-cms-page.yml`
  (us locale added): soccer lexicon, USD JSON-LD ($25.90/$45.90, $15
  deposit, free over $59), 500+ claim, meta_keywords array, and all
  131 design-card links made RELATIVE (they pointed at www cross-store;
  probe-pull of `dmc-football-club-custom-kit-design` with the US token
  proved the team pages exist on the US store).

## Standing US conversions (owner-ruled — "pump slightly, .90 endings")

€21.90→$25.90 · €38.90→$45.90 · €35→$40.90 · €59→$69 · €19.70→$23.30 ·
€15→$15 · threshold €50↔$59 · fee €3.90↔$4.90 · €24.90→$28.90 ·
€26.90→$30.90 · €24.20→$27.80. Homepage-block extras: €39→$46, €40→$47,
€54.90→$64.90, €49.90→$58.90, €64.90→$76.90 (derived; owner may adjust).
Never invent a pair — unmapped prices fail loudly by design.

## Rulings to respect (owner, 1 Sep 2026)

- **No geo-redirect from www to us.momuto.com.** Google crawls from US
  IPs; a forced redirect hides www (which holds the rankings and the
  growing US traffic) from Googlebot. hreflang is the steering mechanism.
  If anything, a dismissible "Shopping from the US?" banner on www —
  link, never redirect. Revisit only when us. is fully checkout-wired,
  indexed, and outranking www for US queries.
- Claims estate-wide: **250+ teams, 15+ countries, 500+ designs**.
  momuto.com frames Europe-wide (not France/Spain — those have stores);
  the US site highlights the US.
- US free-shipping threshold in copy: **$59** everywhere.

## Still open

1. **Checkout wiring** (`docs/domain-binding-runbook.md` Part 4): US base
   jersey/shorts/socks product ids in a `checkSumbit.html` DiyFile,
   `GoodInfoAction` PHP routing on the design server, `us` in
   `embed.js` STORE3D/CONFIG3D. Until done, the 3D→cart→checkout flow is
   NOT first-class — this also gates any push of US visitors to the store.
2. Owner manual: paste `pages/homepage/*.us.html` blocks (7 files, USD);
   US announcement banner text "$59" (www banner "€50"); GSC property for
   us.momuto.com + sitemap submit; test the $15 Stripe flow end-to-end;
   `customized-design-confirmed` stub page (gate redirect target).
3. Gallery in the US nav: not linked yet (owner's call; `apply-nav` in
   `sync-store-config.js` already carries the menu — add a child and
   dispatch).
4. The ~130 cloned team design pages keep EN football-lexicon meta
   ("… Custom Kit Design Preview"). Acceptable as portfolio pages;
   a meta sweep is optional future work.

## US-lexicon pass over the cloned estate (3 Sep 2026)

**Why**: GSC (Jun–Sep 2026, momuto.com property): United States = 26k
impressions, 537 clicks, position 19.4, CTR 2% — the weakest big market,
because www ranks on the football/shirt query family while Americans
search the "soccer" one (*soccer jersey maker* 637 imp @23, *custom soccer
jersey maker* 561 @28, *3d soccer jersey designer* 549 @12, *create your
own soccer jersey online free* 511 @6.5, *custom soccer jersey creator*
429 @34, *custom soccer jerseys* 222 @25). The owner's wholesale clone of
www onto us.momuto.com (758 objects: 202 pages, 43 posts, 513 products)
carried the UK lexicon, EUR prices, stale claims and absolute www links.

**Tooling (all in repo, re-runnable)**:
- `Pull CMS Content` workflow, `cms_type=dump locale=us` → raw objects
  under `cms/{pages,posts,products}/us/` (commit-back is branch-safe now).
- `scripts/audit-us-lexicon.py` — per-object hit table + target-keyword
  coverage; `--json` for machine output.
- `scripts/us-lexicon-fix.py [--write]` — text nodes only (never URLs,
  tags, `<style>`, JS); football→soccer with proper nouns protected
  (`DMC FOOTBALL CLUB` stays), shirt→jersey (not t-shirt/polo), pitch→
  field, boots→cleats, British→US spelling, EUR→USD **only via the
  owner map** (unmapped € reported, untouched), JSON-LD currency, stale
  claims, www links → relative. Cloned EN posts are emitted as
  `blogs/us/<handle>.json`; the 8 EN twins of US-native posts are skipped
  (unpublished via `cms/unpublish.json` "us").
- Bulk deploys: `Deploy CMS Page` / `Deploy Blog Post` now take
  `changed_since=<git ref>` (deploys every file changed since that ref).
- Sitemap: any page/post handle live on BOTH en and us auto-pairs as an
  hreflang cluster (curated clusters still win).

**Result (3 Sep)**: 194 pages + 26 posts rewritten and deployed; money
pages got keyword arrays, ≤160-char metas, "Explore 500+ Custom Soccer
Jersey Designs" and a "Create Your Own Soccer Jersey Online — Free" CTA
(largest un-anchored US query). Team pages (163) done mechanically.

**Owner rulings received 3 Sep (all applied)**:
1. **US price ladder (USD, .90 endings — replaces the FX-converted clone
   prices).** Jersey: $45.90 (1) · $41.90 (2–4) · $30.90 (5–9) · **$25.90
   (10–19)** · $21.90 (20–49) · $20.90 (50–99) · $19.90 (100+). Shorts:
   $20.90 (1) · $18.90 (2–4) · $13.90 (5–9) · $5.00 (10+). Full kit = jersey
   + shorts: $66.80 · $60.80 · $44.80 · **$30.90** · $26.90 · $25.90 · $24.90.
   Products: `scripts/reprice-us-products.js` (+ `reprice-us-products.yml`,
   dispatch-only, dry-run first) recovers the EUR behind each FX price
   (÷1.1605) and maps it through `USD_OF_EUR`; unmapped EUR is reported,
   never invented. Also fixes football/EUR in product copy via batchsave.
   Other pairs used: Iconic tee €39→$45.90, €40→$46.90, tributes €49.90→
   $58.90, editions €55.90→$65.90, €42.90→$50.90 (cmp €80→$94.90), concept
   €34.90→$41.90, legacy team jerseys €20.90→$24.90, shorts €17.90→$20.90,
   socks €6→$6.90, long sleeves +$3.00, RTP full kit →$59.90. Per-order
   $0 mockup products and test junk are skipped.
2. Comparison page ladder rewritten to the table above (JSON-LD + table);
   `contact`: "$15 deposit applies to 100% custom requests, credited in
   full to orders of 5+ jerseys" (the €30/"may apply" copy is gone);
   bachelor page "€22 a head" → "$25.90 a head" (it was €21.90).
3. The lexicon fixer's € regex once ate trailing punctuation ("$45.90,"
   → "$45.90"); fixed, and the pass is regenerated from the dump by
   `us-lexicon-fix.py --write` + `us-money-pages-tweaks.py` (idempotent —
   rerun both after any fresh dump).
4. `teams-clubs-momuto` + EN twin still say "100+ clubs" in body copy on
   www (EN is out of this pass's scope) — same stale claim exists there.

**Halloween tournaments page (3 Sep)** — `pages/us/halloween-soccer-jerseys`
(`deploy-us-pages.js`): two real US case studies (Frankenstein full kit for
a U9 boys team → product `folsom-lake-surf-soccer-club-custom-full-kit`;
Mo Money Mummy jersey → product `mo-money-mummy-custom-jersey` + its team
page), tournament-legality checklist, count-back timeline, USD pricing,
FAQ. Images are the products' CDN renders (the customers' reference boards
are not hosted anywhere the API can reach — the owner can upload them to
the admin media library and we swap the "What the team sent" cards to
image+text). Target queries: halloween soccer jerseys / halloween soccer
tournament jerseys / custom halloween jerseys / spooky soccer jerseys. Not
in the nav yet (owner's call); `llms.txt` carries the page.

## Tooling gotchas hit this week (beyond CLAUDE.md's list)

- **Pull CMS Content on a non-main branch**: its commit step runs
  `git pull --rebase origin main` + plain `git push` — on a branch whose
  history diverges from main the push fails non-fast-forward AND the
  wanted file is lost with the run. The PULL itself still logs
  (`✅ Pulled page …`), so a probe ("does handle X exist on store Y?")
  is answerable from the run log even when the run ends red.
- `workflow_dispatch` validates inputs against the workflow file at the
  DISPATCHED ref — new inputs/options work from a branch as soon as the
  branch has them (the workflow just has to exist on main to be listed).
- Deploy CMS Page's push trigger fires on MAIN pushes of
  `cms/pages/**/*.json` — merging a branch that edited those files
  re-deploys them automatically (idempotent, but know it happens).

## FAQ rebuild — all five stores (4 Sep 2026)

The old FAQ pages rendered their answers from the platform's `faqtool`
widget (admin-only, not in the API; IT even pointed at the EN widget ids)
in a 2023 white/Jost layout with stale numbers and no prices. Replaced by
a generated page per store: `faq/faq.<locale>.json` (34 questions, 7
sections, per-store numbers and carriers) → `scripts/build-faq-pages.js`
→ the pulled `cms/pages/<locale>/<handle>.json` → Deploy CMS Page. Handles:
en `faq`, es `preguntas-frecuentes`, fr `questions-frequentes`, it `faq`,
us `faq`. The page carries a real `#pricing` ladder table (EUR from
`pricing.js`; USD ladder on US), sticky section nav, accordion answers,
and FAQPage + WebPage JSON-LD for every question (GEO/LLM feed).
Suggested nav: a "Pricing" item → `/pages/<faq handle>#pricing` (the
"couldn't find prices" email). Also fixed: `/pages/printing` never
existed — US nav + llms.txt now point at the per-store printing handles.
The shipping-policy pages got the same treatment on 4 Sep:
`policies/shipping.<locale>.json` → `scripts/build-shipping-pages.js`
(handles: en/us `shipping-policy` — renamed from `shipping-policy_2cf047d2`
by PUT on 4 Sep, owner adds the admin redirect; es `envios-metodos-y-plazos`,
fr `politique-de-livraison`, it `politica-di-spedizione`) — timeline,
per-store carriers/costs table, prepaid duties, six questions with
FAQPage schema. Shared CSS for all three generators: `scripts/lib/estate-css.js`.

Returns & exchanges, same day: `policies/returns.<locale>.json` →
`scripts/build-returns-pages.js`. EN and US each had TWO returns pages: the
theme's generic `return-policy` ("14 days, unused, original packaging" —
contradicted the custom-goods policy) and the real `return-policy_b801b8e1`
("Returns & Exchanges", 2023 white/Jost). The generated page now lives on
the clean handle `return-policy` (ids en 234880, us 6492170); ES
`cambios-devoluciones` (299808), FR `retours-echanges` (261677), IT
`politica-resi` (5086324). Facts: returns only for manufacturing defects,
transit damage, or a kit that differs from the approved mockup; report to
customer@momuto.com within 7 days with photos; RMA before anything ships
back; refund incl. return shipping within 14 days of approval; no size
exchanges; full refund on cancellation before production starts; lifetime
print guarantee. Carries WebPage + MerchantReturnPolicy + FAQPage JSON-LD.
**Owner to do**: admin redirects `/pages/return-policy_b801b8e1` →
`/pages/return-policy` on EN and US (the API has no delete/unpublish for
pages; the old object stays live until redirected), and IT still has a
second generic `politica-di-reso` page worth redirecting to `politica-resi`.
All links in `faq/`, `policies/` and `llms.txt` already point at the clean
handles; every llms.txt now lists FAQ, shipping and returns under Support.

