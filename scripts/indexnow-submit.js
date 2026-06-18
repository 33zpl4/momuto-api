/**
 * Manually submit URLs to IndexNow (Bing/Yandex).
 *
 * Usage:
 *   URLS="https://www.momuto.com/pages/a,https://www.momuto.com/pages/b" node scripts/indexnow-submit.js
 *   node scripts/indexnow-submit.js https://www.momuto.com/pages/a https://www.momuto.com/pages/b
 *
 * No tokens required — the IndexNow key is public (hosted on the domain).
 * URLs on hosts without a configured/hosted key are skipped silently.
 */

const { submitUrls } = require('../lib/indexnow');

const urls = (process.env.URLS || process.argv.slice(2).join(','))
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

if (!urls.length) {
  console.error('No URLs provided. Set URLS="u1,u2" or pass URLs as arguments.');
  process.exit(1);
}

console.log(`Submitting ${urls.length} URL(s) to IndexNow...`);
submitUrls(urls)
  .then(() => console.log('Done.'))
  .catch(e => { console.error(e.message); process.exit(1); });
