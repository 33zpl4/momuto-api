/**
 * IndexNow submission helper — pings Bing (and Yandex) the moment a page is
 * created or updated, so the new/changed URL is discovered without waiting for
 * the next crawl. Bing is the retrieval index behind ChatGPT/Copilot, so this
 * doubles as a GEO/LLM-visibility lever.
 *
 * Non-fatal by design: any failure logs a warning and never throws, so an
 * IndexNow problem can never break a page deploy.
 *
 * KEY HOSTING (one-time, manual): IndexNow verifies ownership by fetching
 *   https://<host>/<key>.txt   (file body must equal the key)
 * The OEMSaaS DiyFile API has no create endpoint, so the key file must be
 * created once in the OEMSaaS admin (Settings → DIY Files) with file name
 * "<key>.txt" and the key as its content. The repo copy lives at
 * static/momuto.com/<key>.txt and is kept in sync by deploy-static-files.js.
 *
 * Only hosts present in KEYS are submitted; URLs on other hosts are skipped
 * (e.g. es/fr/it until those domains have their own hosted key).
 */

const ENDPOINT = 'https://api.indexnow.org/indexnow';

const KEYS = {
  'www.momuto.com': '0137a8dc25c5cd9835ec4170134b07b4',
};

function hostOf(url) {
  try { return new URL(url).host; } catch { return null; }
}

/**
 * Submit one or more absolute URLs to IndexNow, grouped by host.
 * @param {string|string[]} urls
 */
async function submitUrls(urls) {
  const list = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);
  if (!list.length) return;

  const byHost = {};
  for (const u of list) {
    const h = hostOf(u);
    if (!h || !KEYS[h]) continue; // skip hosts without a hosted key
    (byHost[h] = byHost[h] || []).push(u);
  }

  for (const [host, urlList] of Object.entries(byHost)) {
    const key = KEYS[host];
    const body = {
      host,
      key,
      keyLocation: `https://${host}/${key}.txt`,
      urlList,
    };
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body),
      });
      // 200/202 = accepted; 4xx = key/URL problem (logged, not thrown).
      const ok = res.status === 200 || res.status === 202;
      console.log(`  IndexNow ${host}: HTTP ${res.status}${ok ? '' : ' (not accepted)'} — ${urlList.length} url(s)`);
    } catch (e) {
      console.warn(`  ⚠️  IndexNow submit failed for ${host}: ${e.message}`);
    }
  }
}

module.exports = { submitUrls };
