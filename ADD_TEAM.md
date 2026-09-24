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
  - Generates EN / ES / FR / IT / US page copy with Claude,
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

Live URLs after a successful run (**five** stores):
- `momuto.com/pages/<slug>-custom-kit-design`
- `es.momuto.com/pages/<slug>-diseno-equipacion`
- `fr.momuto.com/pages/<slug>-design-maillot`
- `it.momuto.com/pages/<slug>-design-maglia`
- `us.momuto.com/pages/<slug>-custom-kit-design`

A successful run ends with `✅ All 5 stores updated successfully.` If the log
says a different number, a store is missing from `DOMAINS` — investigate before
reporting the deploy as done.

### The US store

`us.momuto.com` is the fifth locale, added after the original four. When
touching the deploy script, remember it needs **three** things, not one:

1. A `us` entry in the `DOMAINS` map in `scripts/generate-and-deploy.js`
   (`lang: 'en-US'`, `handleSuffix: 'custom-kit-design'`, gallery handle
   `custom-kit-gallery`, and `token: process.env.OEMSAAS_TOKEN_US`).
2. `OEMSAAS_TOKEN_US: ${{ secrets.OEMSAAS_TOKEN_US }}` in the deploy step's
   `env:` block in `.github/workflows/create-team-page.yml`.
3. A `us` key in **both** `langInstructions` maps in the script. The one in
   `generatePageContent` has **no fallback** — a missing key puts the literal
   string `undefined` into the prompt instead of failing loudly.

Teams catalogued before the US store was wired up exist on four stores only.
Backfilling one is a redeploy: touch its config (or re-commit it unchanged) and
push, one team per commit.

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
| `sport` | ⬜ optional | The sport this kit is for, lowercase (`padel`, `netball`, …). **Omit it for football** — the script defaults to football via `sportOf(config)`. It feeds the page copy, the `meta_keywords`, and the AI gallery caption, so a padel kit stops being advertised as a football kit. Set it whenever the user says the sport, or when the description plainly states one. |
| `away_image_url` / `away_back_image_url` | ⬜ optional | A second kit on the same page. Add both when the team has home **and** away artwork; the page gains a HOME/AWAY switch alongside the FRONT/BACK toggle. |
| `updated_at` | ⬜ optional | `YYYY-MM-DD`. Set it when re-shooting an existing team's images so the change is visible in the repo history. |

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

### The accent must survive being used as UI chrome

`accent_color` is not only a jersey fact — the page paints the FRONT/BACK
toggle, the `.active` reaction button and other chrome with it, on a
near-black `--bg-dark: #050505` background.

A near-black accent (a matte-black kit, a charcoal trim) therefore used to
produce **black text on a black button** — a real bug seen live, at a contrast
ratio of about 1.05:1, i.e. invisible.

The script now defends against this itself: `accentForUi()` derives
`--accent-ui` by lifting the accent's lightness — hue preserved — only until it
clears **4.5:1** against the background, and `inkOn()` picks `--accent-ink` for
text drawn on top. An accent that already passes is returned byte-identical, so
this changes nothing for most teams. The jersey swatches keep the raw
`--accent`; only the chrome uses the derived value.

Two consequences when writing a config:

- **Don't "fix" a dark accent by hand** — record the jersey's real colour and
  let the derivation handle the UI.
- **Prefer a genuinely contrasting colour when the description offers a
  choice.** For a red kit whose only trim is black, white detailing (numbers,
  checkerboard) is the better `secondary`/`accent` than black, which would be
  lifted to a washed grey. Say which you chose and why, and offer the swap.

Teams catalogued before this fix still carry low-contrast accents. They only
pick up the derived chrome on their next deploy, so a redeploy is what fixes an
old team — same one-config-per-commit loop.

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

Verification notes learned the hard way:

- **The sandbox cannot reach `momuto.com`, `us.momuto.com` or the image CDNs**
  (`cdn.staticsoe.com`, `cdn.statics-cdn-abc.com`) — egress policy blocks them.
  So colours are always read from the user's *description*, never sampled from
  the artwork, and a deploy is never reported as working without a green run.
  Say so plainly rather than implying the live page was checked.
- **Read the job log, not just the green tick.** The log distinguishes
  `✓ Created` (new page) from `✓ Updated` (existing handle reused) — the proof
  that an image update didn't duplicate a page. For gallery work it
  distinguishes `✓ Found designs array, injecting entry` (new card) from
  `Team already in … gallery — updating desc` → `✓ Updated desc + image`.
- **A "no gallery" request is verified by absence**: no
  `Generating … gallery description` and no `✓ Gallery updated` lines anywhere
  in the log. Such runs are also noticeably shorter.
- **`actions_list` takes `perPage`, camelCase.** `per_page` is silently
  ignored and returns 100 runs — huge responses for no reason.
- **The runs listing can return stale data.** A `list_workflow_runs` filtered
  by branch once reported a month-old run as newest, with a wrong total; an
  immediate re-query returned the truth. If a run number looks impossibly old,
  query again before concluding anything.
- **Re-running a failed job via the API returns 403** — the token lacks that
  permission. Recover by pushing a redeploy commit instead. Both the page
  upsert and the gallery injection are idempotent, so re-deploying a team that
  partially succeeded does not duplicate anything.

### Failure modes seen in practice

| Symptom in the log | Cause | Recovery |
|---|---|---|
| `400 invalid_request_error: "Your credit balance is too low"` on every store, run dies in ~15s | Anthropic API credits exhausted | Nothing was written (the failure precedes every CMS call). **Do not retry** — tell the user to top up, then redeploy. |
| One store's gallery step gets HTML instead of JSON | Transient API-management page from the CMS | Pages are live; only that store's card is missing. Push a redeploy commit with `add-to-gallery`. |

---

## 11. Known backlog (as of 2026-09-24)

Two one-off migrations are outstanding. Neither is urgent, both are the same
mechanical loop — **one config per commit, push, wait for green** — and neither
has been authorised yet, so ask before starting a batch.

1. **US backfill.** ~128 of 153 team configs were last deployed before
   `us.momuto.com` was wired in (`3a8eb50`, 2026-09-05), so those teams have
   pages on four stores only. A redeploy of each creates its US page.
2. **Accent contrast refresh.** ~49 configs carry a raw accent under 4.5:1 on
   the page background and were last deployed before the fix (`fe573ee`,
   2026-09-10), so their live chrome is still the old low-contrast version.
   A redeploy is the fix; the config needs no edit.

The two overlap heavily — one redeploy pass resolves both for any given team.

Recompute the current figures rather than trusting these numbers:

```sh
# teams last touched before a given commit = teams not yet redeployed since it
for f in teams/*/config.json; do
  echo "$(git log -1 --format=%ci -- "$f") $f"
done | sort | awk -v cut="$(git log -1 --format=%ci 3a8eb50)" '$0 < cut' | wc -l
```

**Serialise redeploys — never run two in parallel.** `updateGallery` is an
unguarded read-modify-write against a single gallery page per store;
overlapping runs can silently drop each other's cards.

---

## 12. Quick checklist

- [ ] Slug is lowercase, hyphenated, ASCII-only.
- [ ] `team_name` keeps the user's original casing/accents.
- [ ] `primary_color` = dominant base color of the image.
- [ ] `secondary_color` = main contrast color, and `accent_color` **equals** it.
- [ ] Colors are real values from the jersey, not copied from another team.
- [ ] `back_image_url` present only if a real back image exists (else omit key).
- [ ] `sport` set if the kit is **not** football; omitted if it is.
- [ ] Accent is a colour that still reads as UI chrome (§4), and the choice was
      explained to the user.
- [ ] One team per commit.
- [ ] `add-to-gallery` in the message **iff** the user wants it in the gallery.
- [ ] Pushed to the working branch.
- [ ] Run log checked: green, `✅ All 5 stores updated successfully.`, and the
      `Created` / `Updated` / gallery lines match what was intended.
```
