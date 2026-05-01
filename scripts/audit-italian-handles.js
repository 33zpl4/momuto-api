/**
 * Audit all page handles on it.momuto.com and flag English-looking ones.
 *
 * Usage:
 *   OEMSAAS_TOKEN_IT=xxx node scripts/audit-italian-handles.js
 */

const HOST = 'https://openapi.oemapps.com';
const TOKEN = process.env.OEMSAAS_TOKEN_IT;

if (!TOKEN) {
  console.error('OEMSAAS_TOKEN_IT is required');
  process.exit(1);
}

// Words that indicate a handle is (at least partially) English.
// Brand/product names like "the-kinetic" are also flagged because the
// "ready-to-play-" prefix is English and FR already uses "maillot-".
const ENGLISH_SIGNALS = [
  'about', 'contact', 'faq', 'support', 'policy', 'privacy',
  'terms', 'shipping', 'return', 'refund', 'checkout', 'cart',
  'account', 'login', 'register', 'password', 'search', 'blog',
  'news', 'team', 'club', 'kit', 'custom', 'design', 'request',
  'gallery', 'collection', 'size', 'guide', 'print', 'material',
  'why', 'brand', 'home', 'page', 'product', 'order', 'delivery',
  'ready-to-play',
];

function looksEnglish(handle) {
  const h = handle.toLowerCase();
  return ENGLISH_SIGNALS.some(w => h.includes(w));
}

async function fetchAllPages() {
  const pages = [];
  let currentPage = 1;
  const perPage = 50;

  while (true) {
    const url = `${HOST}/pages?page=${currentPage}&per_page=${perPage}`;
    const res = await fetch(url, { headers: { token: TOKEN } });
    const json = await res.json();

    if (!res.ok || json.code !== 0) {
      throw new Error(`GET /pages failed (page ${currentPage}): ${JSON.stringify(json)}`);
    }

    const list = json.data?.list || json.data || [];
    if (!Array.isArray(list) || list.length === 0) break;

    pages.push(...list);

    const total = json.data?.total || json.data?.count || list.length;
    if (pages.length >= total || list.length < perPage) break;
    currentPage++;
  }

  return pages;
}

async function main() {
  console.log('Fetching all pages from it.momuto.com...\n');

  const pages = await fetchAllPages();
  console.log(`Total pages found: ${pages.length}\n`);

  const english = [];
  const italian = [];

  for (const page of pages) {
    const handle = page.handle || '';
    if (looksEnglish(handle)) {
      english.push({ handle, title: page.title || '', id: page.id });
    } else {
      italian.push({ handle, title: page.title || '' });
    }
  }

  console.log('=== LIKELY ENGLISH / MIXED HANDLES ===');
  if (english.length === 0) {
    console.log('  (none found)');
  } else {
    english.forEach(p => console.log(`  [id:${p.id}] ${p.handle}\n            "${p.title}"`));
  }

  console.log('\n=== ITALIAN / NEUTRAL HANDLES ===');
  italian.forEach(p => console.log(`  ${p.handle}\n            "${p.title}"`));

  console.log('\n=== RAW JSON (for rename script) ===');
  console.log(JSON.stringify(pages.map(p => ({ id: p.id, handle: p.handle, title: p.title })), null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
