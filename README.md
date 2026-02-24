# MOMUTO Team Page Automation

Automatically creates team proposal pages in English, Spanish, and French across all three MOMUTO domains whenever a new team config is pushed to GitHub.

## How it works

1. Create a new folder under `teams/` with the team slug
2. Add a `config.json` with team details
3. Push to GitHub
4. The Action automatically generates and deploys pages to all three domains

## Setup

### 1. GitHub Secrets

Add these secrets in your GitHub repo → Settings → Secrets → Actions:

| Secret | Value |
|--------|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `OEMSAAS_TOKEN_EN` | OEMSaaS API token for momuto.com |
| `OEMSAAS_TOKEN_ES` | OEMSaaS API token for es.momuto.com |
| `OEMSAAS_TOKEN_FR` | OEMSaaS API token for fr.momuto.com |

### 2. Get OEMSaaS tokens

For each domain, go to:
`OEMSaaS Admin → Settings → System → Developer → Add a new App`

Create one token per domain (momuto.com, es.momuto.com, fr.momuto.com).

### 3. Verify the API host

Check that `https://openapi.oemapps.com` is the correct host for your account.
You can confirm this in OEMSaaS Admin → Settings → System → Developer
(it shows "Open Api interface address").

## Creating a new team page

### ⚠️ Pre-deployment checklist

**CRITICAL:** Before committing a team config, verify these match the actual jersey image:

1. **`primary_color`** — Must be the dominant base color of the jersey
2. **`secondary_color`** — Must match the secondary/accent color on the jersey
3. **`accent_color`** — Must match the button highlight color on the page. **This MUST be `secondary_color`** (used for FRONT/BACK toggle buttons, reaction buttons, etc.)
4. **`design_description`** — Must accurately describe the actual colors and design of the jersey image

**Why this matters:**
- The `accent_color` becomes the `.active` button color when users toggle between FRONT/BACK views
- If `accent_color` is yellow but the jersey is black and red, the UI looks broken
- The `design_description` is used in page copy and gallery text — color mismatch confuses customers

**How to validate:**
1. Open the jersey image file (`image_url` and `back_image_url`)
2. Extract the dominant colors using a color picker
3. Update all four config values to match
4. Do NOT reuse accent colors from previous team configs

---

Create a file at `teams/[team-slug]/config.json`:

```json
{
  "team_name": "TEAM NAME FC",
  "design_name": "Name of the design concept",
  "design_description": "1-2 sentences describing the visual design",
  "primary_color": "#hexcolor",
  "secondary_color": "#hexcolor",
  "accent_color": "#hexcolor",
  "image_url": "https://cdn.staticsoe.com/pics/...",
  "back_image_url": "https://cdn.staticsoe.com/pics/..."  ← optional, enables front/back toggle
}
```

### Front/Back toggle

When `back_image_url` is present in `config.json`, the generated page automatically includes a **FRONT / BACK** toggle above the jersey image. How it works:

- **Detection:** `const hasBack = !!config.back_image_url` — if truthy, the toggle UI is rendered
- **Structure:** Two `.jersey-view` divs (one per side) live inside a `.jersey-carousel`. Only the `.active` one is visible (`display: block`)
- **Switching:** `switchView(view, btn)` toggles the `active` class on the views and updates the lightbox image src to match
- **Lightbox:** `openLightbox()` reads the currently active view's image src, so zooming always shows the correct side
- **Click handler:** Each `<img class="jersey-img">` carries its own `onclick="openLightbox()"` — the onclick is on the image, not the container, to prevent event propagation conflicts with the toggle buttons on mobile

If `back_image_url` is omitted, a single static image is shown with no toggle.

Push to GitHub. The Action will:
- Generate EN, ES, FR content using Claude AI
- Deploy all three pages via OEMSaaS API
- Update sitemaps on all three domains automatically via DiyFile API
- Pages will be live at:
  - `momuto.com/pages/[team-slug]-custom-kit-design`
  - `es.momuto.com/pages/[team-slug]-diseno-equipacion`
  - `fr.momuto.com/pages/[team-slug]-design-maillot`

### Gallery update (opt-in)

To also add the team to the gallery pages on all three domains, include `add-to-gallery` in the commit message:

```
git commit -m "Add new-team config add-to-gallery"
```

## Repo structure

```
.github/
  workflows/
    create-team-page.yml    ← GitHub Action
scripts/
  generate-and-deploy.js    ← Main script
teams/
  gosling-fc/
    config.json             ← Example team
  [new-team]/
    config.json
static/                     ← Static files for all domains
  shared/
    llms.txt
  momuto.com/
    robots.txt
    sitemap.xml
  es.momuto.com/
    robots.txt
    sitemap.xml
    llms.txt
  fr.momuto.com/
    robots.txt
    sitemap.xml
    llms.txt
package.json
```

## After deployment

Remember to:
1. Validate schema at search.google.com/test/rich-results
