'use strict';
/**
 * canonical-watch.js — Google's own verdict on our key URLs, every day. Fails (exit 1) when Google reports a page as anything other than
 * indexed, or has chosen a DIFFERENT canonical than the one we declare. Born from 2 Nov 2026: design-your-own-soccer-jersey (~40 clicks/day)
 * was folded into a thank-you page and nobody noticed for 9 days (docs/us-indexing-2026-11.md). Read only (Search Console URL Inspection API).
 * Env: GSC_SERVICE_ACCOUNT (secret), GSC_SITE (default sc-domain:momuto.com), EXTRA="https://..,https://.." (more URLs)
 */
const crypto = require('crypto');
const b64u = b => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const URLS = [
  'https://www.momuto.com/', 'https://www.momuto.com/pages/design-your-own-soccer-jersey', 'https://www.momuto.com/pages/custom-soccer-jerseys', 'https://www.momuto.com/pages/custom-soccer-jersey-designer',
  'https://www.momuto.com/pages/jersey-maker', 'https://www.momuto.com/pages/ready-to-play', 'https://www.momuto.com/pages/custom-kit-gallery', 'https://www.momuto.com/pages/request-custom-kit-design',
  'https://www.momuto.com/pages/best-custom-soccer-jersey-makers-2026', 'https://www.momuto.com/pages/faq', 'https://www.momuto.com/pages/ai-concept-to-real-kit',
  'https://es.momuto.com/', 'https://es.momuto.com/pages/crea-tu-camiseta-de-futbol', 'https://es.momuto.com/pages/equipaciones-futbol-personalizadas',
  'https://fr.momuto.com/', 'https://fr.momuto.com/pages/maillot-foot-personnalise', 'https://fr.momuto.com/pages/creer-son-maillot-de-foot',
  'https://it.momuto.com/', 'https://it.momuto.com/pages/prezzi-maglie-calcio-personalizzate',
  'https://us.momuto.com/', 'https://us.momuto.com/pages/custom-soccer-jersey-designer', 'https://us.momuto.com/pages/jersey-maker', 'https://us.momuto.com/pages/design-your-own-soccer-jersey', 'https://us.momuto.com/pages/custom-kit-gallery',
].concat((process.env.EXTRA || '').split(',').map(s => s.trim()).filter(Boolean));
async function token(sa) {
  const now = Math.floor(Date.now() / 1000), h = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const c = b64u(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: 'https://oauth2.googleapis.com/token', exp: now + 3300, iat: now }));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${h}.${c}.${b64u(crypto.sign('RSA-SHA256', Buffer.from(`${h}.${c}`), sa.private_key))}` });
  const j = await r.json(); if (!j.access_token) throw new Error('token ' + JSON.stringify(j).slice(0, 160)); return j.access_token;
}
(async () => {
  if (!process.env.GSC_SERVICE_ACCOUNT) throw new Error('GSC_SERVICE_ACCOUNT not set');
  const site = process.env.GSC_SITE || 'sc-domain:momuto.com', tk = await token(JSON.parse(process.env.GSC_SERVICE_ACCOUNT));
  const bad = [];
  console.log(`Canonical watch ${new Date().toISOString().slice(0, 16)}Z — ${URLS.length} URLs\n`);
  for (const url of URLS) {
    const r = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', { method: 'POST', headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ inspectionUrl: url, siteUrl: site, languageCode: 'en-US' }) });
    const j = await r.json();
    if (!r.ok) { console.log(`?? ${url}  inspection error ${r.status} ${(j.error && j.error.message || '').slice(0, 80)}`); bad.push(`${url}: inspection error ${r.status}`); continue; }
    const i = (j.inspectionResult || {}).indexStatusResult || {};
    const norm = u => String(u || '').replace(/\/$/, '');
    const wrongCanon = i.googleCanonical && norm(i.googleCanonical) !== norm(i.userCanonical || url);
    const notIndexed = i.verdict !== 'PASS';
    const flag = wrongCanon ? '⚠ CANONICAL' : notIndexed ? '⚠ NOT INDEXED' : 'ok';
    console.log(`${flag.padEnd(14)} ${url}\n               ${i.verdict} / ${i.coverageState} / lastCrawl ${(i.lastCrawlTime || '').slice(0, 10)}${wrongCanon ? `\n               Google chose ${i.googleCanonical}  (we declare ${i.userCanonical})` : ''}`);
    if (wrongCanon || notIndexed) bad.push(`${url}: ${wrongCanon ? 'Google chose ' + i.googleCanonical : i.coverageState}`);
    await new Promise(r => setTimeout(r, 300));
  }
  if (bad.length) { console.error(`\n❌ ${bad.length} URL(s) need attention:\n  ${bad.join('\n  ')}`); process.exit(1); }
  console.log('\n✓ every watched URL is indexed with the canonical we declare');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
