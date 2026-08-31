# Binding a new store domain (CMS + DNS) — runbook

**Why this doc exists (31 Aug 2026):** when preparing `us.momuto.com` we went
looking for how `it.momuto.com` was bound and found NOTHING — the binding was
done by hand in the oemapps admin + the DNS dashboard before this repo's
playbook era, and never written down. Every plan doc since just says "store
created, domain bound" (`docs/us-hub-plan.md` §A.1, `docs/de-site-plan.md`
checklist). This doc closes that gap. The repo-side steps below are verified
against the codebase; the CMS/DNS steps are **reconstructed** — whoever runs
the next binding must fill in the `VERIFY:` blanks from what the admin
actually shows, in this file, in the same session. Then the next locale
(DE) inherits a real runbook.

## Part 1 — CMS store + domain (owner, in oemapps admin)

1. Create the new store in the oemapps/OEMSaaS admin (manage.momuto.com).
   Install the SAME theme as www so `pages/*` fragments render identically.
2. Bind the custom domain (`us.momuto.com`) in the store's domain settings.
   The admin displays the DNS target to point at.
   - `VERIFY: exact admin path (Settings → Domains?) — record it here.`
   - `VERIFY: the CNAME target host the admin shows — record it here.`
3. DNS (Cloudflare, momuto.com zone): add a **CNAME** record, name `us`,
   target = the host from step 2.
   - `VERIFY: proxy status. SaaS platforms that issue their own SSL usually
     require DNS-only (grey cloud) at least until the cert is issued. Record
     what the existing subdomain records (fr/es/it) use — match them.`
4. Wait for the platform to issue SSL and for `https://us.momuto.com` to
   serve the store. Keep the store unlaunched (noindex/unpublished) until
   the launch checklist passes — the IT lesson: a locale ships complete or
   not at all (`docs/de-site-plan.md`).
5. Generate the store's OpenAPI token and add it as `OEMSAAS_TOKEN_US` to
   GitHub → Settings → Secrets → Actions (+ Vercel env if an API route
   needs it).
   - `VERIFY: admin path for token generation — record it here.`

## Part 2 — DIY files (owner, once per store; the API cannot create them)

The DiyFile API is PUT-only (`scripts/deploy-static-files.js`): each file
must be **created manually once** in the admin (Online Store → DIY files)
with an empty body; every deploy after that is automated. Create:

- `robots.txt`, `llms.txt`, `sitemap.xml`, `blog.css`
- `checkSumbit.html` — see Part 4; without it checkout breaks silently.

## Part 3 — repo plumbing (agent; for `us` this is DONE on the branch)

One commit, pattern per `docs/us-hub-plan.md` §B.4 / `docs/de-site-plan.md`
"Plumbing": locale in `deploy-blog-post.js` + `pull-cms.js` + workflows'
env/dispatch; `deploy-static-files.js` DOMAINS entry;
`rebuild-sitemap.js` DOMAINS + LOCALES + HREFLANG + clusters;
`static/<domain>/` robots.txt + llms.txt; page deploy script
(`deploy-us-pages.js` for us). All guarded: missing token = clean skip.

## Part 4 — checkout wiring (the standing IT mistake; front-load it)

From `design-momuto/server-patches/README.md` — per-store, and the reason
IT was never a first-class checkout:

1. **`checkSumbit.html` DiyFile** on the new store, from the per-store
   template (`server-patches/checkSumbit-<domain>.html` pattern). Its
   `goodsInfo` product map is STORE-SPECIFIC: the jersey/shorts/socks (and
   basketball, on stores that sell it) product ids must be the NEW store's
   ids — created only after the products exist (for us:
   `scripts/create-us-rtp-products.js`).
2. **`GoodInfoAction` on the design server** must route checkout redirects
   to the new storefront — a small PHP routing change in the 3D tool's
   backend. Today it routes EN/FR/ES only; IT was never added.
3. **`STORE3D` / `CONFIG3D` maps in `public/configurator/embed.js`**
   (momuto-api): add the locale (`us: "https://us.momuto.com"`). Today the
   map holds en/fr/es — the open IT gap `docs/de-site-plan.md` warns not
   to repeat.
4. Test the full RTP → 3D → cart → checkout flow end-to-end on the new
   store BEFORE content launch.

## Part 5 — after binding

GSC property + analytics for the new subdomain; Stripe payment link in the
store's currency (redirect → `/pages/<request-handle>?paid=true`, email
collection on); legal pages; then the locale's launch checklist
(`docs/us-hub-plan.md` §C.4 for us, `docs/de-site-plan.md` for de).
