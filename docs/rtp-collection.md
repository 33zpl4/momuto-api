# Ready-to-Play collection — how it works & how to not get fooled

The RTP collection page (`/pages/<collection_handle>`) shows the 7 template cards.
Each card links to a **buyable product page** (`/products/the-<slug>`). This doc
exists because the collection has bitten us twice: a **stale-checkout misread**
and a **silent live revert**. Read the two checklists before touching it or
diagnosing "this got reverted."

## Source of truth & deploy

- **Repo is the source of truth.** Card HTML lives in
  `ready-to-play/collection/{en,es,fr,it}.html` (one file per store).
- **Deploy is automatic on push.** `.github/workflows/deploy-ready-to-play-collection.yml`
  triggers on **any branch** push touching `ready-to-play/collection/**` or
  `ready-to-play/config.json`, and runs `scripts/deploy-ready-to-play-collection.js`
  → writes the pages into each store's CMS (openapi.oemapps.com DiyFiles).
  - ⚠️ **No branch filter.** Pushing collection changes on a *feature branch*
    deploys straight to the **live stores**. There is no staging. If you don't
    want it live yet, don't push collection files.
- **The template-adder can regenerate these files.** `scripts/add-ready-to-play-template.js`
  (`add-ready-to-play-template.yml`) rebuilds cards via `buildCardHTML()`. That
  function is the **canonical card shape** — hand edits to the collection HTML
  must match what it emits, or the next template-add run produces a diff (looks
  like a "revert"). Fixed in #174 to emit purchase cards (`/products/…`,
  "Customize & buy"). If you change card copy, change it in **both** places.

## Card = product link (buy-now), NOT the design-request page

Two different pages exist per template — don't confuse them:

| Page | URL | Purpose |
|------|-----|---------|
| **Product page** (buy-now) | `/products/the-<slug>` | The card target. Buyable, has the 3D customizer. |
| Design-request landing | `/pages/ready-to-play-the-<slug>` | Legacy form/deposit flow. **Not** the card target anymore. |

If collection cards point at `/pages/ready-to-play-the-*`, that's the **old**
flow and is wrong. History: EN switched to buy-now in `4f431de`, FR in
`f4768c7`, ES in #172, labels aligned in #176.

## Per-locale status (keep current)

| Store | Cards → `/products/` | Notes |
|-------|----------------------|-------|
| EN | ✅ | reference implementation |
| FR | ✅ | mirrors EN |
| ES | ✅ | #172 links, #176 labels; products exist (slugs below) |
| IT | ❌ still `/pages/` | not migrated; also has stray `undefined` tags |

**Product slugs** (same across stores — the jersey product per template):
`the-fracture`, `the-kinetic`, `the-legacy`, `the-apex`, `the-mosaic`,
`the-prism`, `the-khala`. Full-kit variants exist as `the-<slug>-full-kit`.
Before pointing a store's cards at `/products/the-<slug>`, confirm those products
are **published** on that store (a card pointing at a non-existent product 404s —
worse than the form page).

## Before you say "this was reverted" — DO THIS FIRST

The #1 cause of a wrong diagnosis here is a **stale local `main`.** This repo
moves fast; someone else's PR may have already fixed (or changed) the thing.

1. `git fetch origin main && git log --oneline origin/main -15` — read recent
   commits. Search for the file: `git log --oneline --all -- ready-to-play/collection/<lang>.html`.
2. Check the **actual current repo state**, not memory:
   `git show origin/main:ready-to-play/collection/es.html | grep -c 'products/the-'`
   (should be 10: 7 card onclicks + 3 JSON-LD urls) and
   `... | grep -c 'pages/ready-to-play-the-'` (should be 0).
3. **Repo correct but live wrong ⇒ it's a DEPLOY/cache problem, not code.**
   The page was likely deployed before the fix, or CDN-cached. Re-trigger
   `deploy-ready-to-play-collection.yml` (or push a collection change) and
   hard-refresh (Ctrl+Shift+R). It is NOT a repo revert.
4. Check recent deploy runs before assuming: Actions →
   *Deploy Ready-to-Play Collection* → look at the last run's time vs. the fix
   commit's time.

> Lesson from this incident: the repo already had the correct ES product links
> (#172/#174); the live page was stale/cached. An initial read off an **outdated
> local main** concluded "ES was never updated" — wrong. Always `git fetch` and
> inspect `origin/main` before judging a revert.

## Verifying a locale is correct (repo-side)

```
L=es   # en|es|fr|it
grep -c 'products/the-'            ready-to-play/collection/$L.html   # want 10
grep -c 'pages/ready-to-play-the-' ready-to-play/collection/$L.html   # want 0
grep -c 'fa-clock\|Preview 24h'    ready-to-play/collection/$L.html   # want 0 (stale labels)
```
