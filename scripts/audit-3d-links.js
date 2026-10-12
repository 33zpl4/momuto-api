'use strict';
/**
 * Inventory of every link that launches the 3D designer (design.momuto.com/3d-configurator/configurator.html?...), so a change to
 * how the tool is launched can be made surgically instead of by grep. (12 Oct 2026)
 *
 *   node scripts/audit-3d-links.js                    rewrite docs/3d-tool-links.json + .md from what is in the repo
 *   node scripts/audit-3d-links.js --check            exit 1 if the repo and the committed inventory differ (PR check): a new page with a
 *                                                     launch link, a removed one, or a new link variant must be recorded in the same PR
 *   node scripts/audit-3d-links.js --set configId=NEW [--set u=SHARE --set useGetShare=true] [--variant "<key>"] [--write]
 *                                                     preview (default) / apply a parameter change to every launch link (optionally only one variant)
 *
 * What a launch link is: configId is NOT a pinned design. The tool opens whatever the visitor's session has for that configId and,
 * for a never-seen one, the collection default (defines-ext.js mamuto3 designQDefault since 12 Oct 2026 = THE CASCADE). To pin a
 * specific design instead, add `&u=<shareId>&useGetShare=true` (copy-on-open). Homepage blocks (pages/homepage/*) are theme sections
 * the owner pastes by hand: a change here does not reach the store until they are pasted again.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT_JSON = path.join(ROOT, 'docs', '3d-tool-links.json');
const OUT_MD = path.join(ROOT, 'docs', '3d-tool-links.md');
const SKIP_DIRS = new Set(['node_modules', '.git', 'metrics']);
const URL_RE = /(?:https:\/\/design\.momuto\.com)?\/3d-configurator\/configurator\.html\?[^"'\s<>)\\`]*/g;

function* walk(dir) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(rel); else yield rel;
  }
}
function groupOf(f) {
  if (f.startsWith('pages/homepage/')) return { group: 'homepage block', deploy: 'MANUAL — the owner pastes theme sections; the repo copy is the source' };
  if (f.startsWith('blogs/')) return { group: 'blog post', deploy: 'auto on merge (Deploy Blog Post)' };
  if (f.startsWith('cms/pages/') || f.startsWith('cms/posts/')) return { group: 'built/pulled CMS copy', deploy: 'edit the SOURCE (pages/*, faq/, policies/, maker/, blogs/) and rebuild; or edit live (scripts/patch-live-copy.js)' };
  if (f.startsWith('cms/unpublished/')) return { group: 'unpublished copy', deploy: 'not live' };
  if (f.startsWith('pages/')) return { group: 'page fragment', deploy: 'auto on merge (its deploy workflow)' };
  if (['faq/', 'policies/', 'maker/', 'size-guide/', 'teams-page/'].some(p => f.startsWith(p))) return { group: 'generated-page source', deploy: 'auto after build + merge (Deploy CMS Page)' };
  if (f.startsWith('static/') || f.startsWith('lib/') || f.startsWith('api/')) return { group: 'static feed / email', deploy: 'auto on merge' };
  if (f.startsWith('scripts/')) return { group: 'generator script', deploy: 'it emits the links above' };
  if (f.startsWith('docs/')) return { group: 'doc', deploy: '-' };
  return { group: 'other', deploy: '?' };
}
function variantOf(url) {
  const q = url.split('?')[1] || '';
  const p = {}; q.split(/&amp;|&/).forEach(kv => { const [k, v] = kv.split('='); if (k) p[k] = v; });
  const uid = p.userId === 'userIdUrl' ? 'userIdUrl' : (p.userId ? '<literal user id>' : '-');
  return `configId=${p.configId || '-'} suit=${p.suitName || p.collectionName || '-'} userId=${uid}${p.u ? ' share=' + p.u : ''}`;
}
function langOf(url) { const m = /[?&](?:amp;)?lang=([a-z]{2})/.exec(url); return m ? m[1] : '-'; }

function scan() {
  const rows = [];
  for (const dir of ['pages', 'blogs', 'cms', 'faq', 'policies', 'maker', 'size-guide', 'teams-page', 'static', 'lib', 'api', 'scripts', 'docs']) {
    if (!fs.existsSync(path.join(ROOT, dir))) continue;
    for (const f of walk(dir)) {
      if (/\.(png|jpg|jpeg|webp|svg|xlsx|gz)$/.test(f) || f.startsWith('docs/3d-tool-links') || f === 'scripts/audit-3d-links.js') continue;
      let text; try { text = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (_) { continue; }
      const hits = text.match(URL_RE); if (!hits) continue;
      const by = {};
      hits.forEach(u => { if (/inspect\.html/.test(u)) return; const k = variantOf(u); by[k] = (by[k] || 0) + 1; });
      Object.entries(by).forEach(([variant, count]) => rows.push({ file: f, ...groupOf(f), variant, count }));
    }
  }
  return rows.sort((a, b) => (a.group + a.file + a.variant).localeCompare(b.group + b.file + b.variant));
}

function markdown(rows) {
  const variants = {}; rows.forEach(r => { variants[r.variant] = (variants[r.variant] || 0) + r.count; });
  const groups = {}; rows.forEach(r => { (groups[r.group] = groups[r.group] || { deploy: r.deploy, files: new Set(), links: 0 }); groups[r.group].files.add(r.file); groups[r.group].links += r.count; });
  let md = `# 3D designer launch links — inventory\n\n_Generated by \`node scripts/audit-3d-links.js\` (12 Oct 2026). Do not edit by hand: change the links, run the script, commit both. CI fails a PR whose links and this inventory disagree, so a new page with a launch link is always recorded here._\n\n`;
  md += `## What a launch link does\n- \`configId\` is **not** a pinned design. The tool opens what the visitor's session holds for that id and, for a never-seen id, the collection default: \`mamuto3\` \`designQDefault\` in \`3d-configurator/asset/defines-ext.js\` (THE CASCADE since 12 Oct 2026).\n- So changing the opening design is a **one-line change in defines-ext.js** (bump \`?v=\` in chunks 908/161) — no page needs editing.\n- To open a SPECIFIC design from a link instead: \`--set u=<shareId> --set useGetShare=true\` (copy-on-open). Save the design in the tool, press Share, take \`u\` from the link.\n- \`userId=userIdUrl\` is a placeholder the tool replaces with a real session id.\n\n## Variants in use\n| variant | links |\n|---|---:|\n${Object.entries(variants).sort((a, b) => b[1] - a[1]).map(([k, n]) => `| \`${k}\` | ${n} |`).join('\n')}\n\n## Where they live\n| group | files | links | how a change reaches the store |\n|---|---:|---:|---|\n${Object.entries(groups).map(([g, v]) => `| ${g} | ${v.files.size} | ${v.links} | ${v.deploy} |`).join('\n')}\n\n`;
  md += `## Surgical update\n\`\`\`\nnode scripts/audit-3d-links.js --set configId=NEWID                       # preview every link that would change\nnode scripts/audit-3d-links.js --set configId=NEWID --variant "configId=ypi9qc1z suit=mamuto3suit1 userId=userIdUrl" --write\nnode scripts/audit-3d-links.js                                            # refresh this inventory, commit with the change\n\`\`\`\nThen: blogs and pages deploy on merge; **homepage blocks (\`pages/homepage/*\`) must be pasted into the theme by hand**; the built copies under \`cms/pages\` follow when their source is rebuilt (never hand-edit generated pages).\n\n## Files\n`;
  const byGroup = {}; rows.forEach(r => { (byGroup[r.group] = byGroup[r.group] || []).push(r); });
  for (const [g, rs] of Object.entries(byGroup)) { md += `\n### ${g}\n${rs.map(r => `- \`${r.file}\` — ${r.count} × \`${r.variant}\``).join('\n')}\n`; }
  return md;
}

const args = process.argv.slice(2);
const rows = scan();
if (args.includes('--set')) {
  const sets = {}; args.forEach((a, i) => { if (a === '--set') { const [k, v] = args[i + 1].split('='); sets[k] = v; } });
  const only = args.includes('--variant') ? args[args.indexOf('--variant') + 1] : null;
  const write = args.includes('--write');
  let changedFiles = 0, changedLinks = 0;
  for (const f of [...new Set(rows.map(r => r.file))]) {
    let text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const next = text.replace(URL_RE, url => {
      if (/inspect\.html/.test(url)) return url;
      if (only && variantOf(url) !== only) return url;
      const sep = url.includes('&amp;') ? '&amp;' : '&';
      const [base, q] = url.split('?');
      const parts = q.split(/&amp;|&/).filter(Boolean).map(kv => kv.split('='));
      const have = new Set(parts.map(p => p[0]));
      parts.forEach(p => { if (p[0] in sets) p[1] = sets[p[0]]; });
      Object.entries(sets).forEach(([k, v]) => { if (!have.has(k)) parts.push([k, v]); });
      const out = base + '?' + parts.map(p => p.join('=')).join(sep);
      if (out !== url) changedLinks++;
      return out;
    });
    if (next !== text) { changedFiles++; console.log(`${write ? 'wrote ' : 'would change '} ${f}`); if (write) fs.writeFileSync(path.join(ROOT, f), next); }
  }
  console.log(`${changedLinks} link(s) in ${changedFiles} file(s) ${write ? 'changed' : 'would change (add --write)'}.`);
  const homepage = rows.filter(r => r.group === 'homepage block');
  if (changedFiles && homepage.length) console.log('NOTE: homepage blocks changed here must be pasted into the theme by hand.');
  process.exit(0);
}
const json = JSON.stringify(rows, null, 1) + '\n';
if (args.includes('--check')) {
  const have = fs.existsSync(OUT_JSON) ? fs.readFileSync(OUT_JSON, 'utf8') : '';
  if (have === json) { console.log(`3D launch links: inventory is current (${rows.reduce((n, r) => n + r.count, 0)} links in ${new Set(rows.map(r => r.file)).size} files).`); process.exit(0); }
  const key = r => `${r.file}|${r.variant}|${r.count}`;
  const A = new Set((have ? JSON.parse(have) : []).map(key)), B = new Set(rows.map(key));
  console.log('3D launch links changed but docs/3d-tool-links.* were not refreshed. Run: node scripts/audit-3d-links.js  (and commit)');
  [...B].filter(x => !A.has(x)).slice(0, 20).forEach(x => console.log('  + ' + x));
  [...A].filter(x => !B.has(x)).slice(0, 20).forEach(x => console.log('  - ' + x));
  process.exit(1);
}
fs.writeFileSync(OUT_JSON, json); fs.writeFileSync(OUT_MD, markdown(rows));
console.log(`inventory written: ${rows.reduce((n, r) => n + r.count, 0)} links in ${new Set(rows.map(r => r.file)).size} files`);
