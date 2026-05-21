'use strict';

/**
 * Rewrites the high-quality-soccer-kits blog post on momuto.com.
 * Uses shared blog.css classes — no inline <style>, no <h1>.
 *
 * Env:
 *   OEMSAAS_TOKEN_EN  - required
 *   DRY_RUN=true|false - default true
 */

const HOST = 'https://openapi.oemapps.com';
const TOKEN = process.env.OEMSAAS_TOKEN_EN;
const DRY_RUN = process.env.DRY_RUN !== 'false';
const TARGET_HANDLE = 'high-quality-soccer-kits';

// ─── New post data ────────────────────────────────────────────────────────────

const NEW_TITLE = 'High-Quality Soccer Kits: What Separates Premium from Generic';

const NEW_META_TITLE = 'High-Quality Soccer Kits: What Separates Premium from Generic | MOMUTO';

const NEW_META_DESC = 'Most "high-quality" kit claims are just marketing. Here\'s what actually matters — fabric blend, printing method, and design — and how to tell the difference before you order.';

const NEW_SUMMARY = 'Not all soccer kits are equal. This guide explains the three things that genuinely separate a premium kit from a generic one — fabric, printing, and design — so you know exactly what to check before you order.';

const NEW_CONTENT = `<div class="post-meta"><span class="category-tag">Kit Buying Guide</span></div>

<div class="ai-capsule">
  <span class="ai-capsule-label">Key Answer</span>
  <p>A high-quality soccer kit uses a <strong>polyester/elastane blend</strong> (not 100% polyester) and <strong>full dye-sublimation printing</strong>, where ink fuses into the fabric rather than sitting on top. These two factors determine how a kit fits, performs, and holds its design over time. Everything else — branding, price, delivery — is secondary.</p>
</div>

<p>Every supplier calls their kits "high quality." Few explain what that actually means. This guide breaks down the three things that genuinely separate a premium soccer kit from a generic one — so you know exactly what to check before you order.</p>

<h2>1. Fabric: The Difference Is in the Blend</h2>

<p>Most budget kits use 100% polyester. It's cheap, functional, and gets the job done — but it has a problem: it has no give. A pure polyester jersey feels stiff, sits away from the body, and loses its shape after a season of hard use.</p>

<p>A premium kit uses a <strong>polyester/elastane blend</strong>. Elastane (also sold as spandex or Lycra) is what gives performance sportswear its stretch-to-recover feel. It moves with the body, returns to shape after every sprint, and sits flat against the skin rather than bunching. The difference is immediately noticeable when you pull it on.</p>

<p>Here's the catch: most suppliers reserve the polyester/elastane blend for their "pro" or "premium" tier — and charge significantly more for it. At MOMUTO, it's the standard fabric on every kit at every price point.</p>

<table class="data-table">
  <thead>
    <tr>
      <th>Fabric</th>
      <th>Stretch</th>
      <th>Shape Retention</th>
      <th>Where You'll Find It</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>100% Polyester</td>
      <td>None</td>
      <td>Average</td>
      <td>Budget kits, entry-level suppliers</td>
    </tr>
    <tr>
      <td>Polyester / Elastane blend</td>
      <td>4-way stretch</td>
      <td>Excellent</td>
      <td>Pro tiers elsewhere — standard at MOMUTO</td>
    </tr>
  </tbody>
</table>

<h2>2. Printing: Why Sublimation Is the Only Method That Lasts</h2>

<p>Design longevity comes down entirely to how the ink is applied. There are three methods in common use across the industry:</p>

<p><strong>Screen printing</strong> applies ink on top of the fabric surface. It fades with washing and cracks under repeated physical stress. Acceptable for casual t-shirts, not suitable for sportswear that sees regular use and washing.</p>

<p><strong>Heat transfer / vinyl</strong> bonds a printed film to the fabric using heat. It looks sharp initially but peels at the edges within 12–18 months of regular use — especially on stretchy fabrics, where the film and textile expand at different rates.</p>

<p><strong>Full dye-sublimation</strong> works differently: the ink is converted to gas under heat and pressure, and fuses directly into the polyester fibres at a molecular level. There is no layer sitting on top of the fabric — the design becomes part of the fabric itself. It cannot peel, crack, or fade, because there is nothing to peel.</p>

<p>All MOMUTO kits use full dye-sublimation. The design is guaranteed for the life of the kit — backed by a lifetime anti-peel guarantee.</p>

<h2>3. Design: Template vs. Truly Custom</h2>

<p>There's a real difference between a kit built from a template with your badge dropped in, and one designed around your team's actual identity.</p>

<p>Template-based suppliers — the majority of the market — give you a library of base designs with colour changes. The result is a kit that looks like a kit: functional, but not distinctive.</p>

<p>A genuinely custom kit starts from your brief: your colours, your history, your crest, your aesthetic. At MOMUTO there are three routes to get there:</p>

<ul>
  <li><strong>Free professional design service</strong> — submit your brief and receive a custom mockup from our design team in 1–2 days. Unlimited revisions, no charge.</li>
  <li><strong>Real-time 3D configurator</strong> — 30+ professional templates, full colour and badge control, order directly without waiting.</li>
  <li><strong>AI concept to real kit</strong> — designed a kit using ChatGPT or Midjourney? Our designers adapt it into a production-ready wearable kit. No other supplier does this.</li>
</ul>

<section class="cta-card">
  <h2>Get a Free Custom Design in 1–2 Days</h2>
  <p>Send your brief, your club colours, or your AI concept. Our designers turn it into a production-ready kit — free, with unlimited revisions.</p>
  <a href="/pages/request-custom-kit-design">REQUEST FREE DESIGN</a>
</section>

<h2>What to Check Before You Order</h2>

<p>Using the three criteria above, here's a practical checklist for evaluating any soccer kit supplier:</p>

<ul>
  <li>Is the fabric a polyester/elastane blend, or 100% polyester — and at which tier?</li>
  <li>Is printing full dye-sublimation, or screen print/heat transfer?</li>
  <li>Is there a minimum order? (Many suppliers require 10–20 units minimum.)</li>
  <li>Is design included, or billed separately?</li>
  <li>What is the realistic delivery time — not the best case?</li>
</ul>

<p>On all five: MOMUTO uses polyester/elastane as standard, full dye-sublimation on every kit, no minimum order (1 kit or 100+), design always free, and delivery in 25–30 days worldwide.</p>

<h2>What Does a High-Quality Soccer Kit Actually Cost?</h2>

<p>Premium fabric and sublimation printing do not have to mean premium prices. The economics of custom kit manufacturing have shifted significantly — suppliers still charging €60–80 per jersey for a "pro" kit are largely charging for a brand name, not a meaningfully better product.</p>

<p>At MOMUTO, kits start from <strong>€20.90 per jersey</strong> for orders of 10 or more, and from <strong>€38.90 for a single jersey</strong>. The polyester/elastane fabric and sublimation printing are standard at both price points. Design is always free.</p>

<section class="cta-card dark">
  <h2>Ready to Order?</h2>
  <p>From a single jersey to a full club kit — no minimum order, design always free. Start with the 3D configurator or send us your brief and get a custom mockup in 1–2 days.</p>
  <a href="/pages/request-custom-kit-design">Get a Free Design</a>
</section>`;

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchPosts() {
  let page = 1;
  const pagesize = 50;
  const items = [];
  while (true) {
    const url = `${HOST}/posts?page=${page}&pagesize=${pagesize}`;
    const res = await fetch(url, { headers: { token: TOKEN } });
    const json = await res.json();
    if (!res.ok || json.code !== 0) break;
    const list = json.data?.list ?? (Array.isArray(json.data) ? json.data : []);
    if (!list.length) break;
    items.push(...list);
    if (list.length < pagesize) break;
    page++;
  }
  return items;
}

function getHandle(post) {
  return post.handle || post.alias || post.slug || post.url_key || null;
}

async function updatePost(id, data) {
  const res = await fetch(`${HOST}/posts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', token: TOKEN },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) throw new Error(`PUT /posts/${id} failed: ${JSON.stringify(json)}`);
  return json;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!TOKEN) { console.error('OEMSAAS_TOKEN_EN is required'); process.exit(1); }

  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log(`Target handle: ${TARGET_HANDLE}\n`);

  const posts = await fetchPosts();
  console.log(`Fetched ${posts.length} posts`);

  const post = posts.find(p => getHandle(p) === TARGET_HANDLE);
  if (!post) { console.error(`Post not found: ${TARGET_HANDLE}`); process.exit(1); }

  console.log(`Found: "${post.title}" (id: ${post.id})`);
  console.log(`Current title: ${post.title}`);
  console.log(`Current meta_title: ${post.meta_title}`);
  console.log(`Current meta_descript: ${post.meta_descript}`);
  console.log(`Current content length: ${(post.content || '').length} chars`);

  const payload = {
    title: NEW_TITLE,
    content: NEW_CONTENT,
    meta_title: NEW_META_TITLE,
    meta_descript: NEW_META_DESC,
    summary: NEW_SUMMARY,
    handle: TARGET_HANDLE,
  };

  console.log('\nNew content length:', NEW_CONTENT.length, 'chars');
  console.log('New meta_title length:', NEW_META_TITLE.length, '(max 65)');
  console.log('New meta_desc length:', NEW_META_DESC.length, '(max 160)');

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Would PUT:');
    console.log(JSON.stringify(payload, null, 2).slice(0, 600) + '...');
    console.log('\nSet DRY_RUN=false to deploy.');
    return;
  }

  console.log('\nDeploying...');
  await updatePost(post.id, payload);
  console.log(`✅ Updated: https://www.momuto.com/blogs/${TARGET_HANDLE}`);
}

main().catch(err => { console.error(err); process.exit(1); });
