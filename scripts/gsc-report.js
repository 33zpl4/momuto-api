#!/usr/bin/env node
/**
 * gsc-report.js — on-demand Search Console query, run on a GitHub Actions runner (the sandbox cannot reach Google).
 * Prints a fixed-width table to stdout (readable from the run log), writes JSON + CSV to gsc-report/ (uploaded as an artifact),
 * and appends the table to the job summary. Read only.
 *
 * Env (all optional except the secret):
 *   GSC_SERVICE_ACCOUNT  service-account JSON (repo secret)            GSC_SITE  default sc-domain:momuto.com (covers every subdomain)
 *   START / END          YYYY-MM-DD; default = last 28 complete days (END = today-3, GSC lags ~3 days)
 *   DIMENSIONS           comma list of query,page,country,device,date,searchAppearance; default "query"
 *   COUNTRY              3-letter ISO (usa, gbr, esp, fra, ita, deu...) — equals filter on country
 *   PAGE                 substring filter on page (e.g. "us.momuto.com" or "/pages/design-your-own")
 *   PAGE_NOT             substring the page must NOT contain
 *   QUERY                substring filter on query (e.g. "jersey maker")
 *   QUERY_NOT            substring the query must NOT contain
 *   ROW_LIMIT            default 200, max 25000
 *   SORT                 clicks | impressions | position | ctr (default clicks desc; position asc)
 *   MIN_IMPRESSIONS      drop rows below this
 */
'use strict';
const fs = require('fs');
const crypto = require('crypto');

function b64u(b) { return Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); }
async function gscToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64u(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: 'https://oauth2.googleapis.com/token', exp: now + 3300, iat: now }));
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${head}.${claim}`), sa.private_key);
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${head}.${claim}.${b64u(sig)}` });
  const j = await r.json(); if (!j.access_token) throw new Error('token: ' + JSON.stringify(j).slice(0, 200));
  return j.access_token;
}
async function gscQuery(token, site, body) {
  const r = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json(); if (!r.ok) throw new Error(`GSC ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j.rows || [];
}
const iso = (d) => d.toISOString().slice(0, 10);

async function main() {
  if (!process.env.GSC_SERVICE_ACCOUNT) throw new Error('GSC_SERVICE_ACCOUNT not set');
  const sa = JSON.parse(process.env.GSC_SERVICE_ACCOUNT);
  const site = process.env.GSC_SITE || 'sc-domain:momuto.com';
  const end = process.env.END || iso(new Date(Date.now() - 3 * 86400000));
  const start = process.env.START || iso(new Date(new Date(end).getTime() - 27 * 86400000));
  const dims = (process.env.DIMENSIONS || 'query').split(',').map((s) => s.trim()).filter(Boolean);
  const rowLimit = Math.min(25000, +(process.env.ROW_LIMIT || 200));
  const filters = [];
  if (process.env.COUNTRY) filters.push({ dimension: 'country', operator: 'equals', expression: process.env.COUNTRY.toUpperCase() });
  if (process.env.PAGE) filters.push({ dimension: 'page', operator: 'contains', expression: process.env.PAGE });
  if (process.env.PAGE_NOT) filters.push({ dimension: 'page', operator: 'notContains', expression: process.env.PAGE_NOT });
  if (process.env.QUERY) filters.push({ dimension: 'query', operator: 'contains', expression: process.env.QUERY });
  if (process.env.QUERY_NOT) filters.push({ dimension: 'query', operator: 'notContains', expression: process.env.QUERY_NOT });
  const body = { startDate: start, endDate: end, dimensions: dims, rowLimit, type: 'web' };
  if (filters.length) body.dimensionFilterGroups = [{ filters }];
  console.log(`GSC report  site=${site}  ${start}..${end}  dimensions=${dims.join(',')}  filters=${JSON.stringify(filters)}  rowLimit=${rowLimit}`);

  const token = await gscToken(sa);
  let rows = await gscQuery(token, site, body);
  const minImpr = +(process.env.MIN_IMPRESSIONS || 0);
  if (minImpr) rows = rows.filter((r) => r.impressions >= minImpr);
  const sort = process.env.SORT || 'clicks';
  rows.sort((a, b) => (sort === 'position' ? a.position - b.position : b[sort] - a[sort]));

  const tot = rows.reduce((a, r) => ({ c: a.c + r.clicks, i: a.i + r.impressions, p: a.p + r.position * r.impressions }), { c: 0, i: 0, p: 0 });
  const head = `${dims.map((d) => d.padEnd(d === 'page' ? 70 : d === 'query' ? 55 : 14)).join(' ')}  clicks  impr   ctr    pos`;
  const line = (r) => `${r.keys.map((k, n) => { const d = dims[n]; const w = d === 'page' ? 70 : d === 'query' ? 55 : 14; return String(k).replace(/^https?:\/\//, '').slice(0, w).padEnd(w); }).join(' ')}  ${String(r.clicks).padStart(6)} ${String(r.impressions).padStart(6)} ${(r.ctr * 100).toFixed(1).padStart(5)}% ${r.position.toFixed(1).padStart(6)}`;
  console.log(`rows=${rows.length}  clicks=${tot.c}  impressions=${tot.i}  ctr=${tot.i ? (tot.c / tot.i * 100).toFixed(2) : 0}%  position=${tot.i ? (tot.p / tot.i).toFixed(1) : '-'}`);
  console.log(head); for (const r of rows) console.log(line(r));

  fs.mkdirSync('gsc-report', { recursive: true });
  fs.writeFileSync('gsc-report/report.json', JSON.stringify({ site, start, end, dimensions: dims, filters, totals: tot, rows }, null, 1));
  fs.writeFileSync('gsc-report/report.csv', [[...dims, 'clicks', 'impressions', 'ctr', 'position'].join(','),
    ...rows.map((r) => [...r.keys.map((k) => `"${String(k).replace(/"/g, '""')}"`), r.clicks, r.impressions, r.ctr, r.position].join(','))].join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) {
    const md = [`## GSC report ${start}..${end}`, `site \`${site}\` · dims \`${dims.join(',')}\` · filters \`${JSON.stringify(filters)}\` · rows ${rows.length} · clicks ${tot.c} · impressions ${tot.i}`, '',
      `| ${dims.join(' | ')} | clicks | impr | CTR | pos |`, `|${'---|'.repeat(dims.length + 4)}`,
      ...rows.slice(0, 300).map((r) => `| ${r.keys.map((k) => String(k).replace(/\|/g, '\\|')).join(' | ')} | ${r.clicks} | ${r.impressions} | ${(r.ctr * 100).toFixed(1)}% | ${r.position.toFixed(1)} |`)].join('\n');
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
  }
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
