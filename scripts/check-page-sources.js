'use strict';
/**
 * check-page-sources.js — PR check: a page has ONE source. Fails when a PR edits a cms/pages/<locale>/<handle>.json copy
 * that shadows a hand-written source (pages/<handle>, or pages/us/<handle> for the US store), and whenever any cms/pages
 * copy still holds <!-- inject:… --> template markers.
 *
 * Why: on 6 Nov 2026 the US request page was edited in its cms/pages copy; merging ran Deploy CMS Page, which shipped the raw
 * template without the step script — "Next step" was dead on us.momuto.com for 4 days and paid customers could not send their brief.
 * docs/incident-2026-11-10-us-request-form.md.
 *
 *   BASE_REF=origin/main node scripts/check-page-sources.js     (CI passes the PR base; without it only the marker check runs)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const problems = [];

const sourceFor = (locale, handle) => path.join(ROOT, 'pages', ...(locale === 'us' ? ['us'] : []), handle);

// 1. no cms/pages copy may carry template markers (those pages are assembled by their own deployer)
for (const loc of fs.readdirSync(path.join(ROOT, 'cms', 'pages'))) {
  const dir = path.join(ROOT, 'cms', 'pages', loc);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    let content = '';
    try { content = String(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).content || ''); } catch (e) { continue; }
    const m = content.match(/<!-- inject:[^>]+-->/g);
    if (m) problems.push(`cms/pages/${loc}/${f} holds ${m.join(' ')} — it is a template copy; Deploy CMS Page would ship it without the injected script. Remove the markers' copy from cms/pages or re-pull it from live.`);
  }
}

// 2. a PR must not edit a cms/pages copy that shadows a pages/ source
const base = process.env.BASE_REF;
if (base) {
  const changed = execSync(`git diff --name-only --diff-filter=d ${base}...HEAD`, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  for (const f of changed) {
    const m = f.match(/^cms\/pages\/([a-z]{2})\/([^/]+)\.json$/);
    if (!m) continue;
    const src = sourceFor(m[1], m[2]);
    // a DIRECTORY with the handle's name (pages/faq/ holds locale fragments for the generated FAQ) is not a page source
    if (fs.existsSync(src) && fs.statSync(src).isFile()) problems.push(`${f} is a copy — this page's source is ${path.relative(ROOT, src)} (deployed by its own workflow). Edit the source and revert ${f}.`);
  }
}

if (problems.length) { console.error('❌ page-source check:\n  ' + problems.join('\n  ')); process.exit(1); }
console.log(`✓ page-source check: no template copies in cms/pages${base ? ', no shadow copies edited in this PR' : ''}`);
