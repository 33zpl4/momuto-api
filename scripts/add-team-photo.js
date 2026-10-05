'use strict';
/**
 * add-team-photo.js — adds one team photo to teams-page/photos.json (newest first).
 * The five "Teams that trust MOMUTO" pages are then rebuilt from that file by scripts/build-teams-pages.js.
 *
 * Env: TEAM_NAME, IMAGE_URL, COUNTRY (ISO-2, e.g. ES), LEAGUE, PLACE_EN (required)
 *      PLACE_ES / PLACE_FR / PLACE_IT (default: PLACE_EN), REGION (optional filter key, e.g. canarias)
 *      SKIP_IMAGE_CHECK=true (offline runs), DRY_RUN=true (report only, write nothing)
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'teams-page', 'photos.json');
const copy = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'teams-page', 'copy.json'), 'utf8'));
const env = k => String(process.env[k] || '').trim();
const fail = m => { console.error('❌ ' + m); process.exit(1); };

const team = env('TEAM_NAME'), image = env('IMAGE_URL'), country = env('COUNTRY').toUpperCase(), league = env('LEAGUE');
const region = env('REGION').toLowerCase().replace(/\s+/g, '-');
const place = { en: env('PLACE_EN') };
for (const l of ['es', 'fr', 'it']) place[l] = env('PLACE_' + l.toUpperCase()) || place.en;
const DRY = env('DRY_RUN').toLowerCase() === 'true';

if (!team || !image || !country || !league || !place.en) fail('Need TEAM_NAME, IMAGE_URL, COUNTRY, LEAGUE and PLACE_EN');
if (!/^https:\/\/\S+$/.test(image)) fail('IMAGE_URL must be an https URL');
if (!copy.countries[country]) fail(`Unknown country "${country}" — add it to teams-page/copy.json "countries" (known: ${Object.keys(copy.countries).join(', ')})`);

(async () => {
  const photos = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (photos.some(p => p.image === image)) { console.log(`⏭ ${image} is already on the page — nothing to do.`); return; }
  if (photos.some(p => p.team.toLowerCase() === team.toLowerCase())) console.log(`⚠ a photo of "${team}" is already listed — adding this one as well.`);

  if (env('SKIP_IMAGE_CHECK').toLowerCase() !== 'true') {
    const res = await fetch(image, { method: 'GET' }).catch(e => fail(`Could not fetch the image (${e.message}). Is the URL public?`));
    if (!res.ok) fail(`Image URL answered HTTP ${res.status}`);
    const type = res.headers.get('content-type') || '';
    if (!/^image\//i.test(type)) fail(`The URL is not an image (content-type "${type}")`);
    const kb = Math.round((await res.arrayBuffer()).byteLength / 1024);
    console.log(`✓ image reachable: ${type}, ${kb} KB${kb > 700 ? ' — large; a smaller / webp version loads faster' : ''}`);
  }

  const row = { team, image, country, region, place, league };
  console.log(`${DRY ? '[dry run] would add' : '✓ adding'}: ${JSON.stringify(row)}`);
  if (!DRY) fs.writeFileSync(FILE, JSON.stringify([row, ...photos], null, 1) + '\n', 'utf8');
})();
