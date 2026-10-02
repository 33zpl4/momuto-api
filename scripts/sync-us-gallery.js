'use strict';

/**
 * Re-syncs the US gallery's team cards from the EN gallery (the source of truth).
 *
 * Why it exists: on 1 Oct 2026 Deploy CMS Page pushed a stale repo snapshot of
 * cms/pages/us/custom-kit-gallery.json (3 Sep) over the live US gallery and wiped
 * every card the team pipeline had injected since. The pipeline only ever ADDS a
 * card for the team it is deploying, so nothing re-adds the lost ones.
 *
 * What it does: reads the EN and US gallery pages, finds EN cards whose team page
 * handle is absent from the US gallery, checks the US team page exists, and inserts
 * a US card (absolute us.momuto.com URL) in EN order — each new card goes right
 * before the next-older card the US gallery already has. It never removes or edits
 * an existing card. Idempotent: a second run finds nothing missing.
 *
 * Runs on the GitHub runner (the sandbox cannot reach the CMS):
 *   .github/workflows/update-gallery.yml  → input sync_us_gallery = dry-run | live
 *
 * Env: DRY_RUN=true|false (default true), OEMSAAS_TOKEN_EN, OEMSAAS_TOKEN_US
 * Never run it at the same time as a team deploy (gallery updates are an
 * unguarded read-modify-write).
 */

const HOST = 'https://openapi.oemapps.com';
const GALLERY = 'custom-kit-gallery';
const US_BASE = 'https://us.momuto.com';
const SUFFIX = '-custom-kit-design';
const DRY_RUN = process.env.DRY_RUN !== 'false';
const TOKEN_EN = process.env.OEMSAAS_TOKEN_EN;
const TOKEN_US = process.env.OEMSAAS_TOKEN_US;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function withRetry(fn, label, tries = 4) {
  for (let i = 1; ; i++) {
    try { return await fn(); }
    catch (e) {
      if (i >= tries) throw e;
      const wait = 1500 * 2 ** (i - 1);
      console.warn(`  retry ${i}/${tries - 1} ${label}: ${String(e.message).slice(0, 120)} (wait ${wait}ms)`);
      await sleep(wait);
    }
  }
}

// A failed/throttled GET must THROW — never read as "page not found".
async function getPage(token, handle) {
  const res = await fetch(`${HOST}/pages?handle=${encodeURIComponent(handle)}`, { headers: { token } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.code !== 0) throw new Error(`GET /pages?handle=${handle} failed: ${JSON.stringify(json).slice(0, 200)}`);
  const list = json.data?.list || json.data || [];
  return Array.isArray(list) ? (list.find(p => p.handle === handle) || null) : null;
}

function arrayRegion(content) {
  const m = /const\s+designs\s*=\s*\[/.exec(content);
  if (!m) throw new Error('designs array not found');
  const start = m.index + m[0].length;
  const end = content.indexOf('];', start);
  if (end < 0) throw new Error('designs array end not found');
  return { start, end };
}

const field = (block, k) => {
  const m = new RegExp(`${k}:\\s*("(?:[^"\\\\]|\\\\.)*")`).exec(block);
  return m ? JSON.parse(m[1]) : null;
};
const handleOf = url => { const m = url && /\/pages\/([^/?#]+)$/.exec(url); return m ? m[1] : null; };

function parseEntries(content) {
  const { start, end } = arrayRegion(content);
  const body = content.slice(start, end);
  const out = [];
  const re = /\{[^{}]*\}/g;
  let m;
  while ((m = re.exec(body))) {
    const url = field(m[0], 'url');
    out.push({ team: field(m[0], 'team'), desc: field(m[0], 'desc'), image: field(m[0], 'image'), url, handle: handleOf(url), index: start + m.index });
  }
  return out;
}

async function main() {
  if (!TOKEN_EN || !TOKEN_US) { console.error('OEMSAAS_TOKEN_EN and OEMSAAS_TOKEN_US required'); process.exit(1); }
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}\n`);

  const en = await withRetry(() => getPage(TOKEN_EN, GALLERY), 'EN gallery');
  const us = await withRetry(() => getPage(TOKEN_US, GALLERY), 'US gallery');
  if (!en || !us) throw new Error('gallery page not found on EN or US');

  const enEntries = parseEntries(en.content || '').filter(e => e.team && e.image && e.handle);
  let content = us.content || '';
  const before = parseEntries(content);
  console.log(`EN gallery: ${enEntries.length} cards | US gallery: ${before.length} cards (page id ${us.id})`);

  const usHandles = new Set(before.map(e => e.handle).filter(Boolean));
  const missing = enEntries.filter(e => e.handle.endsWith(SUFFIX) && !usHandles.has(e.handle));
  console.log(`Missing on US: ${missing.length}\n`);

  const add = [];
  for (const e of missing) {
    const page = await withRetry(() => getPage(TOKEN_US, e.handle), e.handle);
    if (!page) { console.warn(`  ⚠️ skip ${e.team}: no US page "${e.handle}"`); continue; }
    add.push(e);
    await sleep(300);
  }
  console.log(`\nTo add (${add.length}), newest first:`);
  add.forEach(e => console.log(`  + ${e.team}  (${e.handle})`));
  if (!add.length) { console.log('\nNothing to do — US gallery already has every EN card with a US page.'); return; }

  // Insert oldest-first so each newer card can anchor on the older one just added.
  for (const e of [...add].reverse()) {
    const block = `{\n        team: ${JSON.stringify(e.team)},\n        desc: ${JSON.stringify(e.desc || '')},\n        image: ${JSON.stringify(e.image)},\n        url: ${JSON.stringify(`${US_BASE}/pages/${e.handle}`)}\n    },`;
    const have = new Map(parseEntries(content).filter(x => x.handle).map(x => [x.handle, x.index]));
    const enIdx = enEntries.findIndex(x => x.handle === e.handle);
    const anchor = enEntries.slice(enIdx + 1).find(x => have.has(x.handle));
    if (anchor) {
      const pos = have.get(anchor.handle);
      content = content.slice(0, pos) + block + '\n    ' + content.slice(pos);
    } else {
      const { start } = arrayRegion(content);
      content = content.slice(0, start) + '\n    ' + block + content.slice(start);
    }
  }

  // Sanity: nothing lost, everything added, array still closed.
  const after = parseEntries(content);
  if (after.length !== before.length + add.length) throw new Error(`card count ${after.length} ≠ ${before.length}+${add.length}`);
  const afterHandles = new Set(after.map(x => x.handle));
  for (const x of before) if (x.handle && !afterHandles.has(x.handle)) throw new Error(`lost ${x.handle}`);
  for (const e of add) if (!afterHandles.has(e.handle)) throw new Error(`not inserted ${e.handle}`);
  console.log(`\nSanity OK: ${before.length} → ${after.length} cards, array intact.`);
  console.log('New top 12 order:', after.slice(0, 12).map(x => x.team).join(' | '));

  if (DRY_RUN) { console.log('\nDRY RUN — nothing written.'); return; }

  const res = await withRetry(async () => {
    const r = await fetch(`${HOST}/pages/${us.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', token: TOKEN_US },
      body: JSON.stringify({
        content,
        title: us.title,
        meta_title: us.meta_title,
        meta_keywords: Array.isArray(us.meta_keywords) ? us.meta_keywords : [],
        meta_descript: us.meta_descript,
        handle: us.handle,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.code !== 0) throw new Error(`PUT /pages/${us.id} failed: ${JSON.stringify(j).slice(0, 300)}`);
    return j;
  }, 'PUT US gallery');
  console.log(`\n✅ US gallery written (${JSON.stringify(res).slice(0, 80)})`);

  // Read-after-write: prove the cards are really there.
  await sleep(1500);
  const check = parseEntries((await withRetry(() => getPage(TOKEN_US, GALLERY), 'verify')).content || '');
  const ch = new Set(check.map(x => x.handle));
  const gone = add.filter(e => !ch.has(e.handle));
  if (gone.length) { console.error(`❌ not found after write: ${gone.map(e => e.team).join(', ')}`); process.exit(1); }
  console.log(`✅ Verified: US gallery now lists ${check.length} cards, all ${add.length} restored cards present.`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
