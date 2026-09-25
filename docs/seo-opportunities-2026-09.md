# SEO opportunities — audit of 25 September 2026

An audit of every search and strategy doc in this repo
(`search-strategy-2026h2`, `search-analysis-2026-07`, `search-position-2026-08`,
`search-analysis-2026-09-us`, `10x-plan`, `roadmap`, `editorial-strategy`,
`us-launch-status`, `it-site-recovery`, `first-party-facts`), checked against
what actually shipped in the repo. The docs record the plans; this one records
**which planned items were never finished, what was fixed on 25 Sep, and what
comes next, ranked by impact ÷ effort**.

No live data was read: the sandbox cannot reach the stores or GSC (CLAUDE.md
rule 2). Every number below is taken from the doc it cites.

## What is already done (verified in repo, not re-litigated)

- ES city pages: all 10 live (`cms/city-pages/es/cities.json`), hub links all 10.
- Maker pages: EN / US / FR (`maker/`), "Jersey Maker" in EN/US nav.
- FAQ / shipping / returns generated for all 5 stores, with FAQPage JSON-LD.
- Wave 1 editorial: *The slowest part…* and *When to order…* live in EN/ES/FR/IT/US.
- AI hub in 4 locales + US, using the *generator* wording from the query data.
- US store: live and lexicon-swept. GSC property exists (owner, 25 Sep), team
  pages are on the US store, and the basketball 3D tool is linked from the US
  site.
- Crawl hygiene: robots blocks `/account/`, `/search`, CJK URLs; the
  configurator has a canonical.

## Fixed on 25 September 2026 (this branch)

### 1. hreflang covered only 6 of the translated page groups — now 16 + 17 blog groups

**The gap.** `scripts/rebuild-sitemap.js` is the only hreflang mechanism
(page `<head>` is theme-owned). `STATIC_CLUSTERS` held 6 page groups; the
blog clusters were en↔us only. Everything else translated had **no
cross-locale annotation**: FAQ, shipping, returns, contact, the AI hub, the
maker pages, the custom-kit hubs, the bachelor pages, and every translated
post including both Wave 1 pieces. Google had to guess which locale to serve.
The July analysis measured the cost for Italy: Italian searchers landing on the
EN/ES/FR sites (83 clicks / 28 d) while it.momuto.com drew almost nothing.
hreflang is the direct fix for that.

**Also a live bug.** `request-custom-kit-design` and `ai-concept-to-real-kit`
sat in two clusters (the 4-locale row and a later en↔us row). The second
`register()` overwrote the first for the EN URL. EN then listed only en+us
while es/fr/it still pointed at EN with no US entry, so the return tags were
inconsistent. The `us` handle now sits in the main row, and `register()`
refuses (and logs) any URL that is already clustered, so this cannot recur.

**Added page clusters:** faq · shipping-policy · return-policy · contact ·
custom-soccer-jersey-designer↔creer-son-maillot-de-foot · ai-concept-to-real-kit
(4 locales + us) · bachelor pages · custom-soccer-jerseys↔equipaciones-futbol-personalizadas↔maillot-foot-personnalise
· custom-youth-club-soccer-uniforms↔equipaciones-para-clubes-academias.

**Added/extended blog clusters (en/us/es/fr/it):** team complete guide,
amateur club, futsal, 7-a-side, corporate, tournaments, when-to-order,
sponsors, *the slowest part*, colour guide, concept-kit art, AI-to-reality,
3D-configurator (club), 3D-configurator (guide), why personalise, flexibility,
quality. The market-specific comparison posts are **deliberately not
clustered**: they review different competitor sets, so they are not
translations of each other.

A locale is only emitted when the handle exists live on that store (the
script already checks the fetched handle sets), so an unpublished IT
duplicate simply drops out. Local simulation with repo handles: 164 URLs
clustered, 0 non-reciprocal alternates.

**Deploys:** the `rebuild-sitemap.yml` nightly cron (04:00 UTC) picks it up
after merge, or dispatch it once. Check the run log for
`Built hreflang clusters covering N URL(s)` (N should jump) and for any
`⚠️ hreflang: … already clustered` line.

### 2. ES/FR/IT `llms.txt` had drifted from the facts (rule 7)

The shared and US feeds were current; the three locale feeds were not:
- **€20.90** from 10+ (canonical €21.90).
- **"El diseño siempre es gratuito" / "Le design est toujours gratuit" / "Il
  design è sempre gratuito"** and "servicio de diseño profesional gratuito":
  these contradict the €15 deposit.
- FR/IT: **"remboursable si le premier concept ne vous convient pas"**. That is
  refund-forward on a GEO surface (rule 5), the same drift that hit the
  shared file in August.
- No fast lane, delivery breakdown, planning facts or artwork-cleaning line.
  ES also lacked long sleeves and the polo collar.
- Wrong link handles: ES/FR request → `/pages/request-custom-kit-design`
  (the real ones are `solicitud-de-diseno-personalizado` /
  `demande-de-design-professionnel-de-maillots`); ES/FR/IT contact → `/pages/contact`
  (the real ones are `contacto` / `contactez-nous` / `contattaci`).

All three now mirror the shared feed's fact block in their own language and
link the AI hub, the when-to-order post, and (ES) the hub + fast-lane post.

**Deploys on branch push**: `static/**` is watched by Deploy Static Files
with no branch filter (rule 3), so these went live when the branch was
pushed. That is intended: the old copy was wrong.

### 3. Comparison posts: stale numbers + "2025" in titles (rule 6)

Five comparison posts (EN, US, ES, FR, IT) stated **"20-25 days
guaranteed"**, **free shipping from €49**, and **free professional design**,
in visible copy AND in FAQPage/Product JSON-LD (which is what LLMs and rich
results read). The titles still said 2025 (EN/US/ES/FR). All five were
corrected to canonical facts: 25–30 days with >95% on time, the fast lane
+€59/$69 for tight dates, the real free-shipping threshold, and the €15
deposit credited from 5 jerseys. Titles now say 2026, and each post links
to its store's canonical comparison **page**, since the post competes with
that page for the same queries. Deploys on merge (`deploy-blog-post.yml`).
Also: the IT post's FAQPage/Product JSON-LD was in English and is now Italian.
The fast lane is named the same way everywhere: *vía rápida* / *voie rapide* /
*corsia veloce* (llms.txt and posts). Use these terms for any new copy.

### 4. Madrid city page: the "marcaje" vocabulary (Aug addendum, never shipped)

The 14 Aug ES addendum found Madrid is the #2 ES page by impressions but sits
at **position 45**, with queries in vocabulary we never used: *marcaje de
equipaciones*, *tienda camisetas fútbol madrid*. Added to the Madrid entry:
- a "Marcaje incluido" scene card (names/numbers/crest sublimated, no
  per-player cost);
- two FAQs, with FAQPage JSON-LD emitted by the builder: "¿Hacéis el marcaje…?" and
  "¿Tenéis tienda física en Madrid?" (honest: online only, delivered
  anywhere in the Comunidad, fast lane for dates);
- the title "…Madrid con Marcaje | MOMUTO", a meta description and 3 keywords.

Deploys on merge (`deploy-city-pages.yml`). The ES season runs Aug–Oct, so
merge soon.

### 5. Organization schema: one entity, with founder and contact

The about pages (EN/ES/FR/IT) now give the Organization a stable
`@id` (`https://www.momuto.com/#organization`), `founder` (Person "Alberto",
per `first-party-facts.md` voices), `email` info@momuto.com, `contactPoint`,
and `sameAs` (Instagram, Trustpilot, the locale stores). Plan item E
(`search-strategy-2026h2`) asks for consistent naming so LLM citations
resolve to one entity. **Owner:** if you want the founder's surname or a
LinkedIn URL on it, add them to `founder`. They make the Person resolvable.
Deploys on merge (`deploy-about-pages.yml`).

### 6. The "100% custom / make my concept real" specialty, stated for LLMs

Owner direction (25 Sep): the concept-to-real service is a success.
Customers are happy, it is becoming what MOMUTO is known for, and LLMs must
know it. Until now every `llms.txt` covered it in one line ("AI concept
manufacturing — the only kit maker that…"). All five feeds (shared/www, us,
es, fr, it) now carry a dedicated section, **"100% Custom: Your Concept, Made
Real (MOMUTO's specialty)"**, placed before Products:
- **what you can send**: any AI tool's render, a sketch, a screenshot, a photo
  of an old jersey, a concept board, a text brief;
- **why a render can't be printed as-is**: seams/panels, vectorization,
  colour for sublimation, and the wearable details AI ignores. This is the
  explanatory paragraph that answers "can an AI kit design be made real?";
- **how**: design + taste + technology in-house. AI-assisted flows handle
  parts of the recreation, and a professional designer makes the design calls
  and signs off every file;
- **terms**: €15/$15 deposit credited from 5, mockup 24–48 h, revisions,
  no minimum, 25–30 days, fast lane, and the customer owns the design;
- **who**: teams first, then concept designers and students, collectors,
  fantasy-league players, gaming friend groups, gifts;
- the founder quote already live on the AI hub page.

Scale is told as direction only ("most bespoke briefs now arrive as AI
images"), per the publishing rule. The process fact is recorded in
`docs/first-party-facts.md`. Deploys with the other llms.txt edits (static,
push-triggered).

**Next for this cluster, in order:**
1. **Measure D17** (share of bespoke briefs that arrive as AI images, with a
   window). With it, *"How most of our design briefs became AI images"* is
   the single strongest authority and link piece available. Nobody else
   can write it.
2. ~~Put the same "design + taste + tech" paragraph on the AI hub pages~~ **DONE 25 Sep** (definition paragraph, EN/US/ES/FR/IT; deploys on merge via deploy-concept-pages / deploy-us-pages).
   The hub used to say only "a designer … vectorizes it". It now names the
   AI-assisted in-house flows + designer sign-off, the differentiator in
   the owner's own words.
3. **Tag AI-origin designs in the gallery / team pages** ("born from an AI
   concept") and link them from the hub. The before/after pairs are the
   proof LLMs and searchers reward.
4. **Generator vocabulary**: re-check the query data before naming anything.
   The August export said *jersey generator / football kit generator /
   ai jersey maker*; the hub already targets these.

## Next, ranked by impact ÷ effort (not done)

1. **Supplier / wholesale page outside FR.** FR's *fournisseur/grossiste*
   cluster is the best-converting cluster in the account (6.78% CTR, pos 6.9,
   Aug doc Finding 6). There is no EN / ES / IT / US equivalent (*proveedor de
   equipaciones de fútbol*, *fornitore maglie calcio*, *soccer jersey
   supplier / wholesale soccer uniforms*). Clone the FR page's structure per
   locale. **Highest-value new page available.**
2. **Links from other sites: the constraint nothing in the repo addresses.**
   `10x-plan.md` lever 1: the EN maker cluster (~40k impr, pos ~11) moves to
   the top 3 on authority, not on-page work. Nothing in the repo does link
   building. The press-worthy assets are still unwritten:
   - "~90% of our briefs arrive as AI images". Needs D17 measured with a
     window. This is the flagship data story.
   - The Nigeria 2018 fact-check (EN + FR; the concept audience is French).
   - "The Decade Colour Became Free" (sublimation abolished per-colour
     pricing).
   Then pitch them to football, design and AI media, and list the free 3D
   tool in design-tool roundups and kit-design communities.
3. **Catalogue 7 → 25 designs with search-shaped names** (striped, gradient,
   retro, camo, hooped, sash…). `docs/design-page-template.md` is ready; only
   7 templates exist in `ready-to-play/templates/`. Each design = a page per
   locale.
4. **design.momuto.com has one indexable URL.** `share.html` canonicalises to
   itself, so every shared design collapses into one URL. Lever 5 needs the
   architecture decision first: public rich design pages, noindex anything
   thin, a sitemap per section.
5. **Basketball on www.** Linked on us.momuto.com (owner, 25 Sep); www
   carries nothing. A homepage block + a `/pages/custom-basketball-jerseys`
   twin on www would pair with the US page via the same-handle hreflang rule.
6. **IT city pages** reusing the ES template, after the October IT read
   (`it-site-recovery.md`) shows the language clean-up took.
7. **Comparison refresh cadence**: re-date all comparison pages/posts to
   2027 in the first week of January (the FR page handle already carries
   the year; keep the handle and change title/body only).
8. **Country-concept series** (10x-plan lever 5) conflicts with the 11 Sep
   owner ruling to skip the *maillot concept* fan/replica cluster. Needs a
   yes or no; until then it is not on this list.

## Owner-side checks carried over (status unknown from the repo)

- The Chinese test product on the EN store: delete it (robots only hides it).
- `/account/login` was indexed at pos 2.7. robots now blocks crawling, which
  also stops Google seeing a noindex, so use a GSC Removals request.
- Review snippets fell 762 → 390 impressions (July): validate product
  review markup in the Rich Results test.
- Desktop position slipping while mobile improves (July): run a Core Web
  Vitals check on the desktop templates.
- Admin redirects `return-policy_b801b8e1` → `return-policy` (EN/US) and IT
  `politica-di-reso` → `politica-resi`.

## Measure (next GSC export, due ~1 Oct / US ~16 Oct)

- IT: impressions on it.momuto.com vs Italy-country clicks on other hosts
  (hreflang should move them).
- ES: Madrid position (45 → ?), and *marcaje* queries appearing.
- Comparison posts vs pages: the page should take the query and the post
  should drop out of the same SERP.
- GSC → Indexing → *Alternate page with proper canonical* / hreflang
  errors: should fall, not rise, after the nightly sitemap run.
