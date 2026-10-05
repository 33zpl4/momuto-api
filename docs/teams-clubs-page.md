# "Teams that trust MOMUTO" — real teams in our jerseys (all 5 stores)

Social-proof photo wall: one card per real team (photo, team, place · league), filter buttons by region,
ImageObject JSON-LD, a screen-reader summary. **Not** the custom-kit gallery (that is the team-kit
pipeline, `ADD_TEAM.md`).

| Store | Handle | Source in this repo |
|---|---|---|
| EN www | `teams-clubs-momuto` | `pages/teams-clubs-momuto` |
| US | `teams-clubs-momuto` | `cms/pages/us/teams-clubs-momuto.json` (`content` field) |
| ES | `equipos-momuto` | `pages/equipos-momuto` |
| FR | `equipes-clubs-momuto` | `pages/equipes-clubs-momuto` |
| IT | `squadre-club-momuto` | `pages/squadre-club-momuto` |

## Adding a team (the easy way)

Actions → **Add Team Photo to Gallery** → Run workflow:

- `team_name`, `image_url` (a public URL of the photo, e.g. the platform CDN `cdn.staticsoe.com/pics/…`),
  `location` (region filter key; `internacional` if none fits), `city`, `league`.
- Optional: `location_label_en/es/fr/it` (default: derived from `city`; the US page uses the EN label).
- **Tick `dry_run` first**: it prints what would be added and changes nothing.

A live run inserts the card at the top of all five pages, bumps `numberOfItems` and adds the JSON-LD item,
extends the screen-reader summary, deploys EN/ES/FR/IT directly and the US page through
`scripts/deploy-cms-page.js` (commits made with `GITHUB_TOKEN` do not trigger other workflows), then commits
the sources to `main`. Re-running with the same `image_url` is a no-op per page.

## Known loose ends (2 Oct 2026 audit)

- ES and FR carry 17 cards, EN/IT/US 18: one team is missing on ES/FR. Adding it by hand once fixes the drift.
- The summary line on every page says prices run "from 20.90 EUR": rule 6 says from €21.90 at 10+.
- Both deployers (this workflow's, and Deploy Gallery Pages) PUT only content/title/meta/handle, not the full
  page object (CLAUDE.md rule 1); the US page goes through the full-object deployer.
