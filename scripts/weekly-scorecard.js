'use strict';
/**
 * Weekly scorecard (Monday, via .github/workflows/weekly-scorecard.yml). One loop: collect → append to metrics/weekly.json
 * (history lives in git) → write metrics/WEEKLY.md (what moved, against the right baseline) → print it in the run summary.
 *
 * Sources (each optional; a missing one is reported, never fatal):
 *   - momuto-api /api/admin-orders?action=metrics  (MOMUTO_API_SECRET): paid orders, units, revenue, fast lane, languages,
 *       days paid→shipped/delivered, leads, checkout hand-offs, and the anonymous funnel counters from /api/event
 *       (tool_open → design_saved → cart_added → cart_viewed → checkout_clicked).
 *   - Google Search Console (GSC_SERVICE_ACCOUNT = service-account JSON, GSC_SITE default sc-domain:momuto.com): clicks,
 *       impressions, CTR, average position — total and per store host; backfills 16 months on first run so year-over-year
 *       comparisons exist from day one.
 *   - this repo: copy-rules baseline size, failed workflow runs of the last 7 days (GITHUB_TOKEN).
 *
 * Seasonality: a week is never judged on its own. Each metric is compared with (a) the previous week, (b) the 4-week average,
 * (c) the same ISO week last year when the history exists, and the season notes in metrics/season.json are printed. A metric is
 * only flagged when it sits >25% under its 4-week average for 3 weeks running AND is not explained by (c).
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { isoWeek } = require('../lib/iso-week');

const ROOT = path.join(__dirname, '..');
const MDIR = process.env.METRICS_DIR || path.join(ROOT, 'metrics');
const HIST = path.join(MDIR, 'weekly.json');
const REPORT = path.join(MDIR, 'WEEKLY.md');
const SEASON = path.join(ROOT, 'metrics', 'season.json');
const API = process.env.MOMUTO_API_BASE || 'https://momuto-api.vercel.app/api/admin-orders';
const HOSTS = { www: 'https://www.momuto.com/', es: 'https://es.momuto.com/', fr: 'https://fr.momuto.com/', it: 'https://it.momuto.com/', us: 'https://us.momuto.com/', design: 'https://design.momuto.com/' };

const hist = fs.existsSync(HIST) ? JSON.parse(fs.readFileSync(HIST, 'utf8')) : {};
const notes = [];

// ---------------------------------------------------------------- orders / funnel
async function collectApi() {
  const secret = process.env.MOMUTO_API_SECRET;
  if (!secret) { notes.push('orders/funnel: MOMUTO_API_SECRET not set — skipped'); return; }
  const r = await fetch(`${API}?action=metrics&weeks=30`, { headers: { 'x-webhook-secret': secret } });
  if (!r.ok) { notes.push(`orders/funnel: HTTP ${r.status} — skipped`); return; }
  const j = await r.json();
  const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  for (const [wk, w] of Object.entries(j.weeks || {})) {
    const h = hist[wk] = hist[wk] || {};
    h.orders = { count: w.orders, units: w.units, revenue: w.revenue, fastLane: w.fastLane, byLang: w.byLang, shipDaysMedian: med(w.shipDays), deliverDaysMedian: med(w.deliverDays) };
    h.leads = w.leads; h.checkoutHandoff = w.checkoutHandoff;
    // events are only trustworthy from the week they started to arrive: keep the first non-empty value, never overwrite with zeros
    const hasEv = Object.values(w.events || {}).some(e => e.users || e.hits);
    if (hasEv || !h.events) h.events = w.events;
  }
}

// ---------------------------------------------------------------- Search Console
function b64u(b) { return Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); }
async function gscToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64u(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: 'https://oauth2.googleapis.com/token', exp: now + 3300, iat: now }));
  const sig = crypto.createSign('RSA-SHA256').update(`${head}.${claim}`).sign(sa.private_key);
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${head}.${claim}.${b64u(sig)}` });
  const j = await r.json(); if (!j.access_token) throw new Error('token: ' + JSON.stringify(j).slice(0, 200));
  return j.access_token;
}
async function gscQuery(token, site, body) {
  const r = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json(); if (!r.ok) throw new Error(`GSC ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return j.rows || [];
}
const iso = d => d.toISOString().slice(0, 10);
function weekEnd(wk) { const [y, w] = wk.split('-W').map(Number); const jan4 = new Date(Date.UTC(y, 0, 4)); const mon = new Date(jan4.getTime() - ((jan4.getUTCDay() || 7) - 1) * 86400000 + (w - 1) * 7 * 86400000); return iso(new Date(mon.getTime() + 6 * 86400000)); }
async function collectGsc() {
  if (!process.env.GSC_SERVICE_ACCOUNT) { notes.push('Search Console: GSC_SERVICE_ACCOUNT not set — skipped (see docs/scorecard.md)'); return; }
  const sa = JSON.parse(process.env.GSC_SERVICE_ACCOUNT);
  const site = process.env.GSC_SITE || 'sc-domain:momuto.com';
  const token = await gscToken(sa);
  const end = new Date(Date.now() - 3 * 86400000), start = new Date(Date.now() - 480 * 86400000);
  for (const [key, prefix] of [['all', null], ...Object.entries(HOSTS)]) {
    const body = { startDate: iso(start), endDate: iso(end), dimensions: ['date'], rowLimit: 25000, type: 'web' };
    if (prefix) body.dimensionFilterGroups = [{ filters: [{ dimension: 'page', operator: 'contains', expression: prefix }] }];
    const rows = await gscQuery(token, site, body);
    const agg = {};
    rows.forEach(r => {
      const wk = isoWeek(new Date(r.keys[0] + 'T00:00:00Z'));
      const a = agg[wk] = agg[wk] || { clicks: 0, impressions: 0, posW: 0 };
      a.clicks += r.clicks; a.impressions += r.impressions; a.posW += r.position * r.impressions;
    });
    Object.entries(agg).forEach(([wk, a]) => {
      // Search Console data lags ~3 days: a week whose Sunday is after the last data day is PARTIAL and would read as a false drop.
      if (weekEnd(wk) > iso(end)) { if (hist[wk]) delete hist[wk].gsc; return; }
      const h = hist[wk] = hist[wk] || {}; h.gsc = h.gsc || {};
      h.gsc[key] = { clicks: a.clicks, impressions: a.impressions, ctr: a.impressions ? +(a.clicks / a.impressions).toFixed(4) : 0, position: a.impressions ? +(a.posW / a.impressions).toFixed(2) : null };
    });
  }
  // top queries of the last complete week (all sites)
  const wkEnd = new Date(Date.now() - 3 * 86400000), wkStart = new Date(wkEnd.getTime() - 6 * 86400000);
  const q = await gscQuery(token, site, { startDate: iso(wkStart), endDate: iso(wkEnd), dimensions: ['query'], rowLimit: 12, type: 'web' });
  hist._topQueries = { asOf: iso(wkEnd), rows: q.map(r => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: +r.position.toFixed(1) })) };
}

// ---------------------------------------------------------------- repo health
async function collectRepo() {
  const out = {};
  try { out.copyRuleBaseline = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'copy-rules.baseline.json'), 'utf8')).length; } catch (_) {}
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY) {
    try {
      const since = iso(new Date(Date.now() - 7 * 86400000));
      const r = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/runs?status=failure&created=%3E${since}&per_page=100`, { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } });
      const j = await r.json();
      const by = {}; (j.workflow_runs || []).forEach(x => { by[x.name] = (by[x.name] || 0) + 1; });
      out.failedRuns7d = by;
    } catch (_) {}
  }
  const wk = isoWeek(new Date(Date.now() - 7 * 86400000));
  (hist[wk] = hist[wk] || {}).repo = out;
}

// ---------------------------------------------------------------- report
const get = (wk, p) => p.split('.').reduce((o, k) => (o == null ? o : o[k]), hist[wk]);
function weekMinus(wk, n) { const [y, w] = wk.split('-W').map(Number); const jan4 = new Date(Date.UTC(y, 0, 4)); const mon = new Date(jan4.getTime() - ((jan4.getUTCDay() || 7) - 1) * 86400000 + (w - 1) * 7 * 86400000); return isoWeek(new Date(mon.getTime() - n * 7 * 86400000)); }
const yoyWeek = wk => { const [y, w] = wk.split('-W'); return `${+y - 1}-W${w}`; };
let fmtPct = false;
const fmt = v => v == null ? '—' : fmtPct ? (v * 100).toFixed(2) + '%' : (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en') : String(+v.toFixed(2)));
const pct = (a, b) => (a == null || b == null || b === 0) ? null : Math.round((a / b - 1) * 100);

function row(label, wk, p, { lowerIsBetter = false } = {}) {
  fmtPct = /ctr$/.test(p);
  const v = get(wk, p);
  if (v == null) return null;
  const prev = get(weekMinus(wk, 1), p);
  const avg4 = (() => { const xs = [1, 2, 3, 4].map(n => get(weekMinus(wk, n), p)).filter(x => typeof x === 'number'); return xs.length >= 2 ? xs.reduce((a, b) => a + b, 0) / xs.length : null; })();
  const yoy = get(yoyWeek(wk), p);
  const d = x => x == null ? '—' : (x > 0 ? '+' : '') + x + '%';
  // streak: 3 weeks running more than 25% under the 4-week average of the weeks before each
  let streak = 0;
  for (let i = 0; i < 3; i++) {
    const w = weekMinus(wk, i), x = get(w, p);
    const base = [1, 2, 3, 4].map(n => get(weekMinus(w, n), p)).filter(y => typeof y === 'number');
    if (typeof x === 'number' && base.length >= 2) { const m = base.reduce((a, b) => a + b, 0) / base.length; if (m > 0 && (lowerIsBetter ? x > m * 1.25 : x < m * 0.75)) streak++; }
  }
  let flag = '';
  if (streak === 3) flag = (yoy != null && pct(v, yoy) != null && (lowerIsBetter ? pct(v, yoy) <= 0 : pct(v, yoy) >= 0)) ? ' ≈ seasonal (year-over-year is fine)' : ' ⚠ 3 weeks under its recent level';
  return `| ${label} | ${fmt(v)} | ${d(pct(v, prev))} | ${d(pct(v, avg4))} | ${yoy == null ? '—' : fmt(yoy) + ' (' + d(pct(v, yoy)) + ')'} |${flag}`;
}

function seasonNote(wk) {
  const s = JSON.parse(fs.readFileSync(SEASON, 'utf8'));
  const [y, w] = wk.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4)); const mon = new Date(jan4.getTime() - ((jan4.getUTCDay() || 7) - 1) * 86400000 + (w - 1) * 7 * 86400000);
  const mmdd = iso(new Date(mon.getTime() + 3 * 86400000)).slice(5);
  const hit = s.seasons.find(x => x.from <= x.to ? (mmdd >= x.from && mmdd <= x.to) : (mmdd >= x.from || mmdd <= x.to));
  const ann = (s.annotations || []).filter(a => a.date >= iso(new Date(mon.getTime() - 7 * 86400000)) && a.date <= iso(new Date(mon.getTime() + 7 * 86400000))).map(a => `${a.date}: ${a.note}`);
  return { season: hit ? `${hit.expect.toUpperCase()} — ${hit.note}` : '—', ann };
}

function report() {
  const wk = isoWeek(new Date(Date.now() - 7 * 86400000));          // last complete week
  const sn = seasonNote(wk);
  const head = '| metric | this week | vs last week | vs 4-wk avg | same week last year |\n|---|---:|---:|---:|---:|';
  const sec = (title, rows) => { const r = rows.filter(Boolean); return r.length ? `\n### ${title}\n${head}\n${r.join('\n')}\n` : ''; };
  let md = `# Weekly scorecard — ${wk}\n\n_Generated ${new Date().toISOString().slice(0, 16)}Z. Season: **${sn.season}**_\n`;
  if (sn.ann.length) md += `\n_Changes around this week:_ ${sn.ann.join(' · ')}\n`;
  md += sec('Funnel (distinct sessions)', [
    row('3D designer opened', wk, 'events.tool_open.users'), row('design saved', wk, 'events.design_saved.users'),
    row('**added to cart**', wk, 'events.cart_added.users'), row('cart page viewed', wk, 'events.cart_viewed.users'),
    row('CHECKOUT clicked', wk, 'events.checkout_clicked.users'), row('checkout hand-off OK', wk, 'checkoutHandoff.ok'),
    row('**paid 3D orders**', wk, 'orders.count'),
    row('WhatsApp chat clicked (help-seeking)', wk, 'events.wa_chat_click.users'),
    row('assistant panel opened', wk, 'events.faq_open.users'), row('assistant answer read', wk, 'events.faq_topic.users'),
    row('assistant: price calculator used', wk, 'events.faq_calc.users')]);
  const f = hist[wk] && hist[wk].events;
  if (f && f.cart_added && f.cart_added.users && hist[wk].orders) md += `\nCart → paid: **${Math.round(100 * hist[wk].orders.count / f.cart_added.users)}%** of sessions that reached the cart (orders and sessions are not 1:1; read the trend, not the level).\n`;
  md += sec('Orders', [row('units (jerseys)', wk, 'orders.units'), row('revenue EUR', wk, 'orders.revenue.EUR'), row('revenue USD', wk, 'orders.revenue.USD'),
    row('fast-lane orders', wk, 'orders.fastLane'), row('days paid → shipped (median)', wk, 'orders.shipDaysMedian', { lowerIsBetter: true }),
    row('days paid → delivered (median)', wk, 'orders.deliverDaysMedian', { lowerIsBetter: true })]);
  md += sec('Leads (custom design gate)', Object.keys((hist[wk] && hist[wk].leads) || {}).map(k => row(k.replace(/_/g, ' '), wk, `leads.${k}`)));
  const gscRows = [];
  for (const k of ['all', ...Object.keys(HOSTS)]) {
    gscRows.push(row(`${k}: clicks`, wk, `gsc.${k}.clicks`), row(`${k}: impressions`, wk, `gsc.${k}.impressions`));
    if (k === 'all') gscRows.push(row('all: avg position', wk, 'gsc.all.position', { lowerIsBetter: true }), row('all: CTR', wk, 'gsc.all.ctr'));
  }
  md += sec('Search Console', gscRows);
  if (hist._topQueries) md += `\n**Top queries** (week to ${hist._topQueries.asOf}): ` + hist._topQueries.rows.slice(0, 10).map(r => `${r.query} (${r.clicks} clk, pos ${r.position})`).join(' · ') + '\n';
  const rp = hist[wk] && hist[wk].repo;
  if (rp) md += `\n### Health\n- copy-rules baseline: **${rp.copyRuleBaseline}** known violations (should only shrink)\n- failed workflow runs, last 7 days: ${rp.failedRuns7d && Object.keys(rp.failedRuns7d).length ? Object.entries(rp.failedRuns7d).map(([n, c]) => `${n} ×${c}`).join(', ') : 'none'}\n`;
  if (notes.length) md += `\n### Not collected\n${notes.map(n => '- ' + n).join('\n')}\n`;
  md += '\n_How to read this: docs/scorecard.md. A drop is only a problem when it persists for 3 weeks, is not explained by the season, and year-over-year does not say the same._\n';
  return md;
}

(async () => {
  for (const [name, fn] of [['api', collectApi], ['gsc', collectGsc]]) { try { await fn(); } catch (e) { notes.push(`${name}: ${e.message}`); } }
  await collectRepo();
  fs.mkdirSync(path.dirname(HIST), { recursive: true });
  fs.writeFileSync(HIST, JSON.stringify(Object.fromEntries(Object.entries(hist).sort(([a], [b]) => a.localeCompare(b))), null, 1) + '\n');
  const md = report();
  fs.writeFileSync(REPORT, md);
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
})();
