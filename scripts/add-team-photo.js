/**
 * add-team-photo.js
 *
 * Adds a new team action photo to all three language gallery pages
 * (teams-clubs-momuto, equipos-momuto, equipes-clubs-momuto).
 *
 * Required env vars:
 *   TEAM_NAME      - Team name (e.g. "Atletico Guanche")
 *   IMAGE_URL      - Full CDN URL to the photo
 *   LOCATION       - Region filter key (canarias|madrid|españa|aragon|internacional)
 *   CITY           - City filter key (las-palmas|tenerife|madrid|zaragoza|francia|etc.)
 *   LEAGUE         - League name (e.g. "Superliga LPGC")
 *
 * Optional env vars:
 *   LOCATION_LABEL_EN - Display label for location in English (default: derived from CITY)
 *   LOCATION_LABEL_ES - Display label for location in Spanish
 *   LOCATION_LABEL_FR - Display label for location in French
 */

const fs = require('fs');
const path = require('path');

const TEAM_NAME = process.env.TEAM_NAME;
const IMAGE_URL = process.env.IMAGE_URL;
const LOCATION = process.env.LOCATION;
const CITY = process.env.CITY;
const LEAGUE = process.env.LEAGUE;

if (!TEAM_NAME || !IMAGE_URL || !LOCATION || !CITY || !LEAGUE) {
  console.error('Missing required env vars: TEAM_NAME, IMAGE_URL, LOCATION, CITY, LEAGUE');
  process.exit(1);
}

// HTML-encode special characters for safe embedding
function htmlEncode(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PAGES = {
  en: {
    file: 'pages/teams-clubs-momuto',
    altTemplate: (team, loc, league) =>
      `${team} team wearing their custom MOMUTO football jerseys in ${loc}, ${league}`,
    metaTemplate: (team, loc, league) =>
      `${team} - Custom MOMUTO jerseys - ${loc}, ${league}`,
  },
  es: {
    file: 'pages/equipos-momuto',
    altTemplate: (team, loc, league) =>
      `Equipo ${team} luciendo camisetas personalizadas MOMUTO en ${loc}, ${league}`,
    metaTemplate: (team, loc, league) =>
      `${team} - Camisetas MOMUTO - ${loc}, ${league}`,
  },
  fr: {
    file: 'pages/equipes-clubs-momuto',
    altTemplate: (team, loc, league) =>
      `&Eacute;quipe ${team} portant leurs maillots personnalis&eacute;s MOMUTO &agrave; ${loc}, ${league}`,
    metaTemplate: (team, loc, league) =>
      `${team} - Maillots MOMUTO - ${loc}, ${league}`,
  },
};

// Derive location display labels from city if not provided
const locationLabels = {
  en: process.env.LOCATION_LABEL_EN || CITY.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
  es: process.env.LOCATION_LABEL_ES || CITY.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
  fr: process.env.LOCATION_LABEL_FR || CITY.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
};

function buildPhotoEntry(lang) {
  const page = PAGES[lang];
  const loc = htmlEncode(locationLabels[lang]);
  const team = htmlEncode(TEAM_NAME);
  const league = htmlEncode(LEAGUE);
  const imgUrl = htmlEncode(IMAGE_URL);

  const alt = page.altTemplate(team, loc, league);
  const meta = page.metaTemplate(team, loc, league);

  // Build the team-details line with bullet separator
  const details = `${loc} &bull; ${league}`;

  return `<div class="action-photo" data-location="${htmlEncode(LOCATION)}" data-city="${htmlEncode(CITY)}" role="listitem"><figure><img src="${imgUrl}" alt="${alt}" loading="lazy" />
<figcaption><span class="photo-meta">${meta}</span></figcaption></figure>
<div class="action-overlay">
<div class="team-name">${team}</div>
<div class="team-details">${details}</div>
</div>
</div>`;
}

function addPhotoToPage(lang) {
  const page = PAGES[lang];
  const filePath = path.join(process.cwd(), page.file);

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const entry = buildPhotoEntry(lang);

  // Insert right after the opening masonry-gallery div (before first action-photo)
  const marker = /(<div class="masonry-gallery"[^>]*>)\n/;
  if (!marker.test(content)) {
    console.error(`Could not find masonry-gallery marker in ${page.file}`);
    process.exit(1);
  }

  content = content.replace(marker, `$1\n${entry}\n`);

  // Also update the JSON-LD itemListElement count and add entry
  const countMatch = content.match(/"numberOfItems":\s*(\d+)/);
  if (countMatch) {
    const oldCount = parseInt(countMatch[1], 10);
    const newCount = oldCount + 1;
    content = content.replace(/"numberOfItems":\s*\d+/, `"numberOfItems": ${newCount}`);

    // Build JSON-LD entry - plain text for JSON (no HTML entities)
    const plainTeam = TEAM_NAME;
    const plainLoc = locationLabels[lang];
    const plainLeague = LEAGUE;
    const jsonEntry = `{"@type": "ListItem", "position": ${newCount}, "item": {"@type": "ImageObject", "name": "${plainTeam} wearing custom MOMUTO jerseys", "description": "${plainTeam} football team from ${plainLoc} wearing their custom-designed MOMUTO jerseys during a ${plainLeague} match", "contentUrl": "${IMAGE_URL}"}}`;

    // Insert before the closing ] of itemListElement
    const listEnd = content.lastIndexOf(']\n');
    if (listEnd !== -1) {
      // Find the last entry before ]
      const beforeClose = content.substring(0, listEnd).trimEnd();
      content = beforeClose + ',\n      ' + jsonEntry + '\n    ]\n' + content.substring(listEnd + 2);
    }
  }

  // Update the sr-only summary to mention the new team
  const summaryMatch = content.match(/(<div class="sr-only" aria-hidden="false">[\s\S]*?<\/p>)/);
  if (summaryMatch) {
    const summary = summaryMatch[1];
    if (!summary.includes(TEAM_NAME)) {
      // Add team name before the closing period of the team list
      const teamListPattern = /(\. (?:All jerseys|Todas las camisetas|Tous les maillots))/;
      if (teamListPattern.test(summary)) {
        const updatedSummary = summary.replace(
          teamListPattern,
          `, ${TEAM_NAME} (${locationLabels[lang]}, ${LEAGUE})$1`
        );
        content = content.replace(summary, updatedSummary);
      }
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✓ Added ${TEAM_NAME} photo to ${page.file}`);
}

// Process all three languages
for (const lang of ['en', 'es', 'fr']) {
  addPhotoToPage(lang);
}

console.log('\n✅ Team photo added to all gallery pages.');
