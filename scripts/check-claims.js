'use strict';
/**
 * check-claims.js — the public claims live in lib/claims.json (teams, Trustpilot reviews). Fails when a customer-facing source still carries an older
 * number: "250+" (and its spelled-out forms) as a team/club count, or a Trustpilot reviewCount / "4.6/5 · N" that is not the current one.
 * Owner figures changed three times in five weeks (100+ → 250+ → 300+; reviews 51 → 53 → 57); each time the sweep missed files.
 *   node scripts/check-claims.js
 */
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), C = require('../lib/claims.json');
const files = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
  .filter(f => !/^(docs|scripts|metrics|prototype|node_modules|test|\.github|mockups)\//.test(f) && !/\.(png|jpe?g|svg|xlsx|csv|glb|zip|woff2?|ttf|otf|gif|webp|ico|pdf)$/i.test(f))
  // the kit-gallery pages are pipeline-owned and carry their own review figure (scripts/patch-gallery-review-count.js), not the Trustpilot count
  .filter(f => !/(^|\/)(custom-kit-gallery|galeria-equipaciones-personalizadas|galerie-maillots-foot-sur-mesure|galleria-maglie-personalizzate)(\.json|\.html)?$/.test(f));
const stale = [
  { re: /\b(?:1\d\d|2[0-9]\d)\+(?=\s*(?:clubs?|teams?|equipos|clubes|équipes|squadre|club\b))/gi, what: 'old team/club count', ok: m => parseInt(m, 10) >= C.teamsMin },
  { re: /\b(?:más de|mas de|plus de|più di|oltre|over|mehr als)\s+(\d{2,3})\s+(?:clubs?|teams?|equipos|clubes|équipes|squadre)/gi, what: 'old spelled team count', ok: (m, g) => parseInt(g, 10) >= C.teamsMin },
  { re: /reviewCount\\?"?\s*[:=]\s*\\?"?(\d+)/g, what: 'Trustpilot reviewCount', ok: (m, g) => +g === C.trustpilot.reviews },
  { re: /4[.,]6\/5 · (\d+)/g, what: 'Trustpilot "4.6/5 · N"', ok: (m, g) => +g === C.trustpilot.reviews },
  { re: /"reviews":\s*(\d+)/g, what: 'copy.json reviews', ok: (m, g) => +g === C.trustpilot.reviews },
];
const bad = [];
for (const f of files) {
  let s; try { s = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (_) { continue; }
  if (s.length > 3e6) continue;
  for (const r of stale) { r.re.lastIndex = 0; let m; while ((m = r.re.exec(s))) { if (!r.ok(m[0], m[1])) bad.push(`${f}: ${r.what} "${m[0].slice(0, 50)}" (current: ${r.what.includes('count') && !r.what.includes('reviewCount') ? C.teams : C.trustpilot.reviews})`); } }
}
// reviews on the wire: each store's JSON-LD must agree on one value
if (bad.length) { console.error(`❌ claims out of date (lib/claims.json: ${C.teams} teams, ${C.trustpilot.rating}/5 from ${C.trustpilot.reviews} reviews, ${C.trustpilot.asOf}):\n  ${bad.slice(0, 60).join('\n  ')}${bad.length > 60 ? `\n  … ${bad.length - 60} more` : ''}`); process.exit(1); }
console.log(`✓ claims: ${files.length} files carry only ${C.teams} teams and ${C.trustpilot.reviews} Trustpilot reviews`);
