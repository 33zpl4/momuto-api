# How to Add a Team (Agent Procedure)

This is the exact, self-contained procedure for adding a new team to MOMUTO and
(optionally) featuring it in the gallery. Follow it literally. It is written so
an agent with only repo access + git can complete the task without guessing.

> TL;DR: create `teams/<slug>/config.json`, commit, push to the working branch.
> The push triggers a GitHub Action that generates and deploys the team's kit
> pages on all domains. Add the literal token **`add-to-gallery`** to the commit
> message to also list the team in the gallery.

---

## 1. What the automation does (and doesn't)

- **Trigger:** `.github/workflows/create-team-page.yml` runs on every **push**
  that touches `teams/*/config.json` (any branch, no branch filter).
- It runs `scripts/generate-and-deploy.js`, which:
  - Generates EN / ES / FR / IT page copy with Claude,
  - Deploys one kit-proposal page per domain via the OEMSaaS API,
  - Updates each domain's sitemap,
  - **If** the commit message contains `add-to-gallery`, injects/updates the
    team's card in each domain's gallery page.
- The Action processes **one** changed config per push
  (`git diff --name-only HEAD~1 HEAD | grep 'teams/.*/config.json' | head -1`).
  → **Add or update one team per commit.** Don't batch multiple teams into a
  single commit.
- **A deletion does not deploy anything** — removing a `config.json` is a
  no-op for the CMS (see §7).
- **There is no automated gallery *removal*.** The gallery `designs` array is
  only ever added to / updated in place. Removing a card is a **manual** CMS
  edit (see §8).

Live URLs after a successful run:
- `momuto.com/pages/<slug>-custom-kit-design`
- `es.momuto.com/pages/<slug>-diseno-equipacion`
- `fr.momuto.com/pages/<slug>-design-maillot`
- `it.momuto.com/pages/<slug>-design-maglia`

---

## 2. The slug

The folder name under `teams/` is the slug and appears in every URL.

Rules:
- **lowercase**, words separated by single **hyphens**.
- **ASCII only** — strip accents/diacritics (`Martín` → `martin`), drop
  punctuation (`.`, `’`, `!`), collapse spaces to hyphens.
- Keep it short and recognizable from the team name.
- The slug is **permanent** once deployed (it's the public URL). To "rename" a
  team you create a new slug — the old page/card does not move automatically.

Examples:

| Team name (display)        | Slug (folder)               |
|----------------------------|-----------------------------|
| `ADSL`                     | `adsl`                      |
| `Pornic FC`                | `pornic-fc`                 |
| `Autoservicio Martín Ruiz` | `autoservicio-martin-ruiz`  |
| `LOS VENGADORES`           | `los-vengadores`            |

---

## 3. The config file

Create `teams/<slug>/config.json`:

```json
{
  "team_name": "TEAM NAME",
  "design_name": "Short design concept name",
  "design_description": "Full paragraph describing the jersey (see §5).",
  "primary_color": "#RRGGBB",
  "secondary_color": "#RRGGBB",
  "accent_color": "#RRGGBB",
  "image_url": "https://cdn.staticsoe.com/pics/<front>.png",
  "back_image_url": "https://cdn.staticsoe.com/pics/<back>.png"
}
```

Field reference:

| Field | Required | Notes |
|-------|----------|-------|
| `team_name` | ✅ | Display name, **exactly as the user gave it** — keep original casing and accents (e.g. `Autoservicio Martín Ruiz`). |
| `design_name` | ✅ | Short 2–3 word concept label (e.g. `Pink Fracture`, `Monochrome Gold`). Invent one from the description if the user didn't give one. |
| `design_description` | ✅ | The design write-up. Use the user's text; only fix smart quotes / obvious typos. |
| `primary_color` | ✅ | Hex. Dominant base color (see §4). |
| `secondary_color` | ✅ | Hex. The jersey's secondary/accent color (see §4). |
| `accent_color` | ✅ | Hex. **MUST equal `secondary_color`.** Drives the FRONT/BACK toggle + reaction button `.active` color. |
| `image_url` | ✅ | Front jersey image (the CDN URL the user provides). |
| `back_image_url` | ⬜ optional | Back jersey image. If present, the page renders a FRONT/BACK toggle. **Omit the key entirely** when there's no back image yet — do not put an empty string or null. |
| `away_image_url` | ⬜ optional | Front image of the **second kit**. Presence of this key is what turns on the kit selector (see §3.1). |
| `away_back_image_url` | ⬜ optional | Back image of the second kit. Only meaningful alongside `away_image_url`. |
| `kit_label_home` | ⬜ optional | Overrides the label of the **first** kit button. String, or a map keyed by language (see §3.1). |
| `kit_label_away` | ⬜ optional | Overrides the label of the **second** kit button. Same format as `kit_label_home`. |

> ⚠️ **This table is the complete schema.** `scripts/generate-and-deploy.js` reads
> these keys and no others. Any additional key you invent is **silently ignored** —
> there is no validation and the deploy still reports success, so the page goes
> live with missing images instead of failing loudly. In particular there is **no
> nested/array form** for multiple kits: use the flat `away_*` fields in §3.1.

### 3.1 Teams with two kits (home/away, player/goalkeeper, …)

A team can ship **two kits on one page**. Adding `away_image_url` renders a kit
selector next to the FRONT/BACK toggle in a single toolbar; the lightbox follows
whichever kit is selected. There are only ever **two** slots — "home" is the
first, "away" is the second, whatever you label them.

```json
{
  "image_url": "…front of kit 1.png",
  "back_image_url": "…back of kit 1.png",
  "away_image_url": "…front of kit 2.png",
  "away_back_image_url": "…back of kit 2.png",
  "kit_label_home": { "en": "PLAYER", "es": "JUGADOR", "fr": "JOUEUR", "it": "GIOCATORE" },
  "kit_label_away": { "en": "GOALKEEPER", "es": "PORTERO", "fr": "GARDIEN", "it": "PORTIERE" }
}
```

**Labels.** Omit `kit_label_*` for an ordinary home/away kit — each domain then
uses its own translated default:

| Domain | First kit | Second kit |
|--------|-----------|------------|
| momuto.com | `HOME` | `AWAY` |
| es.momuto.com | `PRIMERA` | `SEGUNDA` |
| fr.momuto.com | `DOMICILE` | `EXTÉRIEUR` |
| it.momuto.com | `CASA` | `TRASFERTA` |

Set `kit_label_*` only when the two kits aren't home/away (player/goalkeeper,
adult/kids, …). Each accepts either form:

- **A map keyed by language** — `{ "en": "PLAYER", "es": "JUGADOR" }`. Preferred:
  a plain string would leave the Spanish, French and Italian pages in English.
  Language keys are `en` / `es` / `fr` / `it`; any language you leave out falls
  back to the domain default in the table above.
- **A plain string** — same label on all four domains.

Other notes:
- `back_image_url` is still optional here; if kit 2 has no back image, the kit
  falls back to its front image for the BACK view.
- The gallery card always uses `image_url` (kit 1 front) as its thumbnail.
- Colors stay single-valued for the whole page — pick them from the **first**
  kit, and mention the second kit's colors in `design_description`.

Formatting:
- Straight ASCII quotes in JSON. If the description contains curly quotes `“ ” ‘ ’`
  the deploy script normalizes them, but prefer straight quotes anyway.
- The `“Fracture”`-style curly quotes users paste inside the description text are
  fine to keep — they're only cosmetic inside the string.

---

## 4. Choosing colors (the important rules)

The three color fields must reflect the **actual jersey image**, not a guess.

1. **`primary_color` = the dominant base color** of the shirt — the color that
   covers the most area.
2. **`secondary_color` = the main secondary/accent color** on the jersey — the
   streaks, trim, stripe, or contrast color that defines the look.
3. **`accent_color` MUST be identical to `secondary_color`.** It becomes the
   `.active` color of the FRONT/BACK toggle and reaction buttons. If it doesn't
   match the jersey, the UI looks broken.
4. **Do not reuse an accent color from another team** just because it's handy —
   pick from the actual image.
5. Format: 6-digit hex, uppercase, with `#` (e.g. `#C9A84C`).

**How to pick when the description lists several colors:** the base/dominant tone
is `primary`; the single strongest contrast tone is `secondary`/`accent`. If the
jersey has both a bold streak color *and* a structural trim color (e.g. purple
streaks + black collar), use the **more prominent / more brand-defining** one as
`secondary`, and mention the other in the description. When unsure between two
candidates, tell the user which you picked and offer to swap.

Reference palette (values already used in this repo — reuse only if they truly
match the image):

| Meaning | Hex |
|---------|-----|
| Matte black base | `#0D0D0D` |
| Luxury gold accent | `#C9A84C` |
| Sport red | `#C8102E` |
| Royal blue | `#1E50A2` |
| Pure white | `#FFFFFF` |

---

## 5. Writing `design_description`

- Use the description the user provides, verbatim where possible.
- It must **accurately describe the real colors and design** — it feeds page
  copy and the AI-generated gallery caption. A color mismatch here confuses
  customers.
- One flowing paragraph is fine (collapse the user's line breaks into a single
  string). No markdown inside the JSON string.

---

## 6. Adding a team — step by step

1. Confirm the **slug** (§2) and whether the user wants it in the **gallery**.
2. Create `teams/<slug>/config.json` (§3) with correct colors (§4).
3. Commit **one team per commit**. Choose the message based on gallery intent:

   **With gallery** (user said "push to gallery"):
   ```
   git add teams/<slug>/config.json
   git commit -m "Add <TEAM> team config and add-to-gallery

   <one-line design summary>. Deploys proposal pages and updates the
   gallery on all domains."
   git push -u origin <working-branch>
   ```

   **Without gallery** (user said "do not push to gallery"):
   ```
   git commit -m "Add <TEAM> team config

   <one-line design summary>. Deploys proposal pages only; gallery
   intentionally not updated."
   ```
   → Just **omit** the `add-to-gallery` token. Nothing else changes.

4. Push to the **working branch** (this project develops on a feature branch;
   the Action still fires because the workflow has no branch filter).
5. Optionally verify the run (§9).

> **The gallery switch is literally the substring `add-to-gallery` in the commit
> message.** Present → gallery updated. Absent → gallery untouched. That's the
> only control.

---

## 7. Updating an existing team's images

1. Edit `image_url` and/or `back_image_url` in `teams/<slug>/config.json`.
2. Commit + push.
3. **Gallery thumbnail:** the gallery card uses **`image_url` (front) only**.
   - If you changed the front image and the team is in the gallery, include
     `add-to-gallery` so the thumbnail refreshes.
   - If you changed only the back image, the gallery thumbnail is unaffected;
     including `add-to-gallery` still just redeploys pages (harmless).

Example (front-only change, keep gallery in sync):
```
git commit -m "Update <TEAM> front image and add-to-gallery

Refreshes the front jersey image (back unchanged); redeploys pages and
updates the gallery image on all domains."
```

To add a back image to a team that previously had none: add the
`back_image_url` key and commit — the FRONT/BACK toggle appears automatically.

---

## 8. Removing a team from the gallery

**Not automated.** The live gallery `designs` array is stored in the CMS and the
code only adds/updates it — `deploy-kit-gallery-pages.js` deliberately never
touches that array, and `generate-and-deploy.js` has no delete path.

To remove a card: **delete it manually** in the CMS gallery page editor for each
domain. Then optionally clean the repo (§9). Do not attempt to script a
production CMS delete as part of a normal add/update task.

---

## 9. Deleting a team from the repo

Removing the config keeps the repo tidy but **does not** unpublish the live CMS
page or gallery card (those are manual CMS actions):

```
git rm teams/<slug>/config.json
git commit -m "Remove <TEAM> team config"
git push -u origin <working-branch>
```

A deletion-only commit triggers no deploy.

---

## 10. Verifying the deploy (optional)

The workflow is **Create Team Proposal Pages** (`create-team-page.yml`). After a
push:
- Find the latest run on the working branch (GitHub Actions, or the GitHub MCP
  `actions_list` → `list_workflow_runs` for `create-team-page.yml`).
- The run `display_title` matches your commit subject.
- `status: completed` + `conclusion: success` means pages (and, if requested,
  gallery) are live. Runs typically finish in ~1 minute.

> ⚠️ **`conclusion: success` does not mean the page is correct.** The deploy does
> not validate the config, so a typo'd or unsupported key produces a live page
> with `src="undefined"` images — and still reports success. If you changed
> anything about the config's *shape* (not just values), check the rendered page
> too, or render it locally:
>
> ```
> # exercise the real builder without deploying
> head -n -4 scripts/generate-and-deploy.js > /tmp/render.js
> echo 'module.exports = { buildPageHTML, DOMAINS };' >> /tmp/render.js
> # then require('/tmp/render.js') and assert the HTML has no src="undefined"
> ```
>
> (`/tmp/render.js` needs `scripts/`-relative paths to resolve — put it in a
> throwaway dir with a `lib/indexnow.js` stub, or just eyeball the live page.)

---

## 11. Quick checklist

- [ ] Slug is lowercase, hyphenated, ASCII-only.
- [ ] `team_name` keeps the user's original casing/accents.
- [ ] `primary_color` = dominant base color of the image.
- [ ] `secondary_color` = main contrast color, and `accent_color` **equals** it.
- [ ] Colors are real values from the jersey, not copied from another team.
- [ ] `back_image_url` present only if a real back image exists (else omit key).
- [ ] Only keys from the §3 table are used — no invented/nested ones.
- [ ] Two kits? Second kit is in `away_image_url` / `away_back_image_url`, and
      `kit_label_*` is a per-language map if the kits aren't home/away (§3.1).
- [ ] One team per commit.
- [ ] `add-to-gallery` in the message **iff** the user wants it in the gallery.
- [ ] Pushed to the working branch.
