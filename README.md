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

Create a file at `teams/[team-slug]/config.json`:

```json
{
  "team_name": "TEAM NAME FC",
  "design_name": "Name of the design concept",
  "design_description": "1-2 sentences describing the visual design",
  "primary_color": "#hexcolor",
  "secondary_color": "#hexcolor",
  "accent_color": "#hexcolor",
  "image_url": "https://cdn.staticsoe.com/pics/..."
}
```

Push to GitHub. The Action will:
- Generate EN, ES, FR content using Claude AI
- Deploy all three pages via OEMSaaS API
- Pages will be live at:
  - `momuto.com/pages/[team-slug]-custom-kit-design`
  - `es.momuto.com/pages/[team-slug]-custom-kit-design`
  - `fr.momuto.com/pages/[team-slug]-custom-kit-design`

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
package.json
```

## After deployment

Remember to:
1. Add the new pages to all three sitemaps (batch update monthly)
2. Link the new page from the gallery on each domain
3. Validate schema at search.google.com/test/rich-results
