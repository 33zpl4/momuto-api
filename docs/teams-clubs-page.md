# "Teams that trust MOMUTO" — real teams in our jerseys (all 5 stores)

Social-proof photo wall: one tile per real team (photo, team, place · league), filter buttons, a lightbox,
ImageObject JSON-LD, a bridge to the kit gallery, a send-us-a-photo block and the closing CTA.
**Not** the custom-kit gallery (that is the team-kit pipeline, `ADD_TEAM.md`).

## One source, five pages (rebuilt 5 Oct 2026)

| File | What it is |
|---|---|
| `teams/photos.json` | one row per photo, **newest first** — the only thing that changes when a photo comes in |
| `teams/copy.json` | wording, meta (title ≤65, description ≤160), keywords and the numbers, per locale |
| `scripts/build-teams-pages.js` | renders the five pages; `--check` runs the sanity checks and writes nothing |
| `cms/pages/<locale>/<handle>.json` | the pulled CMS objects; the builder replaces `content` + title/meta and keeps every other field |

| Store | Handle |
|---|---|
| EN www | `teams-clubs-momuto` |
| US | `teams-clubs-momuto` |
| ES | `equipos-momuto` |
| FR | `equipes-clubs-momuto` |
| IT | `squadre-club-momuto` |

Never hand-edit the built `content` (it is regenerated); edit `photos.json` / `copy.json` / the builder.
Numbers on the page: 250+ teams, 15+ countries, 4.6/5 from 49 Trustpilot reviews (owner, 30 Sep 2026), no minimum
order, delivery 25–30 days (CLAUDE.md rule 6).

## Adding a team

1. Upload the photo in the store's media library (CMS) and copy its https URL (a webp/jpg under ~700 KB loads fastest).
2. Actions → **Add Team Photo to Gallery** → Run workflow **from main**: team name, URL, country, league, place
   (English; ES/FR/IT optional), region (optional). **Leave `dry_run` ticked first**: it checks the URL is a
   reachable image, shows the row and runs every page check without changing anything.
3. Run again with `dry_run` unticked: the row is added, all five pages are rebuilt, deployed through
   `scripts/deploy-cms-page.js` (full-object PUT) and committed to `main`.

Run from any other branch the workflow is always a dry run. Re-running with the same URL is a no-op.
Filters are generated: "All", one per country present, and one per region once it has 3 photos
(`REGION_MIN` in the builder). A new country must exist in `teams/copy.json` → `countries`.

## What changed in the rebuild (and why)

- The old pages were four hand-edited fragments + the US object that had drifted apart (different structure per
  locale, a duplicate card, hidden keyword-stuffed summary text, a team missing from some locales).
- Removed the "Our Designs" carousel (old white-background mockups, huge cards): replaced by one line + button to
  the kit gallery of each store.
- Stale claims fixed: "3-week delivery" → 25–30 days; "98% satisfaction" (no source) → Trustpilot 4.6/5;
  "15 countries" → 15+; meta said "100+ clubs" on EN/FR/IT and "250+" only on US; keywords were empty on EN/ES/FR/IT.
- Estate type scale (Bebas Neue headings / Outfit body, same sizes as the FAQ/shipping/uniforms pages), the four
  theme gotchas from `docs/cms-page-gotchas.md`, tile captions always visible (the old overlay needed hover, so
  phones never saw team names), keyboard-reachable tiles and a lightbox with arrow keys.

## Retired

`pages/teams-clubs-momuto`, `pages/equipos-momuto`, `pages/equipes-clubs-momuto`, `pages/squadre-club-momuto` and the
Deploy Gallery Pages workflow (partial-field PUT). Deploys now go through Deploy CMS Page on push to `main` like every
other pulled page.
