# Binding a new store domain (CMS + DNS) — runbook

**Why this doc exists (31 Aug 2026):** when preparing `us.momuto.com` we went
looking for how `it.momuto.com` was bound and found NOTHING — the binding was
done by hand in the platform admin + Cloudflare before this repo's playbook
era, and never written down. Every plan doc since just says "store created,
domain bound" (`docs/us-hub-plan.md` §A.1, `docs/de-site-plan.md` checklist).
This doc closes that gap. **Verified 31 Aug 2026 against the owner's live
Cloudflare zone + the admin's domain wizard** (screenshots, during the
us.momuto.com binding); one wizard value still to record on completion is
marked `RECORD:`.

## Part 1 — CMS store + domain (owner, in the store admin + Cloudflare)

The store platform admin is the ABCSHOPPY Enterprise Edition panel
(`https://a96ru5pm.abcshoppy.com/admin/…` — the white-label behind
oemapps/OEMSaaS; `manage.momuto.com` resolves into the same estate).

1. Create the new store in the admin. Install the SAME theme as www so
   `pages/*` fragments render identically.
2. Bind the domain: **Online Store → Domains → Add** (`/admin/domains/create`).
   The wizard has 4 steps: **① Enter a domain → ② Select a CDN node →
   ③ Domain name resolution → ④ Successfully.**
   - Step ①: enter `us.momuto.com` and CHECK **"Bind only specified
     domain"** — unchecked, the platform also binds the apex + www
     (`momuto.com` / `www.momuto.com`), which belong to the EN store.
   - Step ②: pick the same CDN node the existing stores use.
   - Step ③ shows the DNS value to create — that's the input to step 3
     below. Note: if a domain is deleted from DCDN, re-add it after ~5 min
     (wizard's own warning).
   - `RECORD: the CDN node chosen and the exact IP step ③ showed for us —
     expected 104.18.20.248 (what es/fr/it resolve to).`
3. DNS (Cloudflare, `momuto.com` zone → DNS → Records): add an **A record**
   — NOT a CNAME — matching the existing store subdomains exactly:
   name `us`, IPv4 = the step-③ value (es/fr/it all use `104.18.20.248`),
   **Proxy status: Proxied (orange cloud)**, TTL Auto.
   Reference rows in the live zone (31 Aug 2026): `es`/`fr`/`it` → A
   `104.18.20.248` Proxied; `design`/`manage` → A `198.11.178.106` **DNS
   only** (tool + admin hosts are deliberately unproxied — don't "fix" them).
4. Wait for the binding to verify and `https://us.momuto.com` to serve the
   store over SSL. Keep the store unlaunched (noindex/unpublished) until
   the launch checklist passes — the IT lesson: a locale ships complete or
   not at all (`docs/de-site-plan.md`). If verification stalls with the
   proxy on, flip the record to DNS only until it verifies, then re-enable
   Proxied to match the other stores.
5. Generate the store's OpenAPI token and add it as `OEMSAAS_TOKEN_US` to
   GitHub → Settings → Secrets → Actions (+ Vercel env if an API route
   needs it).
   - `RECORD: admin path for token generation — record it here.`

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
