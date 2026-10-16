# Blog pipeline — files, deploy, translation, dates, images

Written 16 Oct 2026 from the fabric post (`what-are-football-jerseys-made-of-fabric-types`) end to end. Read this BEFORE touching `blogs/**`.

## Files and schema
- `blogs/<handle>.json` = EN; `blogs/<locale>/<handle>.json` for `us|es|fr|it`. One post per file.
- Fields: `handle` (must equal the file name), `title`, `meta_title` (<= 65), `meta_descript` (<= 160), `summary`, `author` (`MOMUTO`), `status` (1 live, 0 draft),
  `src` (cover image URL), `content` (HTML), optional `published_at` (`YYYY-MM-DD`).
- ~35 older posts exceed the meta limits (pre-existing backlog, not fixed): `python3` one-liner in the 15 Oct session listed them; only the fabric-related five were trimmed.
- Content conventions (copy from `blogs/high-quality-soccer-kits.json`): `post-meta` category tag, an `ai-capsule` "Key Answer" box first, a `data-table` where a comparison helps,
  a `cta-card` with the deposit line ("free design for teams (€15 deposit, credited in full on orders of 5+ jerseys)", $15 on US), a visible FAQ + matching FAQPage JSON-LD, a "Read next" line.
- US posts use the US lexicon (soccer, color, fiber), $ prices ($25.90 at 10+, $45.90 single) and US handles for internal links (`custom-soccer-uniforms-for-your-team-complete-guide`).
- Editorial (blog) is the only surface that may name clubs and brands (Real Madrid rule applies elsewhere). Fabric facts: **92% polyester / 8% elastane, 145-160 GSM micro-interlock, four-way stretch** (owner, 15 Oct 2026; FAQ, materials pages, llms.txt carry it). Do not invent other percentages.

## Deploy
- **Deploy Blog Post** runs automatically on merge to main for changed `blogs/**/*.json` (it does NOT run on branch pushes: safe to push branches). Dispatch (`post_handle` + `locale`, `dry_run`) works from a branch.
- Always `DRY_RUN=true node scripts/deploy-blog-post.js` first (`CHANGED_FILES="blogs/x.json ..."`), run `node scripts/check-copy-rules.js`, check tag balance and that the JSON-LD parses.
- New posts are created (POST), existing ones are updated (PUT replaces the whole post).

## Post dates (gotcha, 15 Oct 2026)
- A post created through the API has `published_at: 1969-12-31` and the store shows that date. The field IS writable: send `published_at` (`YYYY-MM-DD`) in the file; the deploy script reads it back and fails with `MISMATCH` if the store ignored it.
- `deploy-blog-post.js` now keeps a real live date when a file declares none (PUT would otherwise reset it).
- Older API-created posts: workflow **Set post dates** (`scripts/set-post-dates.js`, dry run by default, `LOCALES`, read-back `VERIFIED/MISMATCH`). Owner ruling 15 Oct 2026: nominal dates 14-35 days back, stable per handle. It re-reads each post with a single GET and refuses to write if the body is empty. Run the dry run, read the list, then `dry_run=false`.

## Translations (ES / FR / IT)
1. The EN post must be live, then dispatch **Translate Blog Posts** (`post_handle`, `locales`, `dry_run`). Dry run prints the translated handle and title; **the handle is regenerated on every run**, so the dry-run handle is not the live one. Read the live run's `✓ Created -> https://<store>/blogs/<handle>`.
2. Pull the live translation into the repo (workflow **Pull CMS Content**, `cms_type=post`, `locale`, `handle`). Dispatch the three pulls ONE AT A TIME: three at once raced on the commit-back and the FR pull failed (re-dispatch fixes it). Pulled files have an empty `author` and no `src`: set `author: MOMUTO`, `src`, `published_at`.
3. Add the hreflang row to `BLOG_CLUSTERS` in `scripts/rebuild-sitemap.js` in the same PR (handles differ per locale; en/us same-handle pairs are automatic).
- **Failure mode (15 Oct 2026):** `scripts/translate-blog-posts.js` crashed with `Cannot read properties of undefined (reading 'trim')` because the model reply can start with a non-text block. Fixed: it joins the text blocks, `max_tokens` 4096 / 16000, and throws on `stop_reason=max_tokens`.
- FR/IT titles come out in Title Case English style; harmless, tidy if you edit them.

## Images
- The CMS CDN only takes admin-panel uploads. Photos are committed in **design-momuto** `3d-configurator/static/team-photos/` and served from `https://design.momuto.com/3d-configurator/static/team-photos/<file>.webp` (see that repo's handbook, "Blog / marketing photos hosted here"). WebP, 1000 px wide (cover 1200x630), EXIF stripped, descriptive file names.
- In the post: `<figure>` with `width`/`height`, `loading="lazy"`, real alt text in the post language, a caption, and a credit line that links the public Instagram post. Never claim "used with permission" unless it is true. Crop third-party graphics to the garment.
- The fabric post uses AS Xenon (France) x2 and Far3 FC (Italy) x1; the cover is a crop of the AS Xenon group photo.

## Verification
Green **Deploy Blog Post** run on the merge commit (read the log: `✨ created` / `✅ <url>` / `VERIFIED published_at`), then open the live URL once per locale (the sandbox cannot). Live URLs of the fabric post:
`www.momuto.com/blogs/what-are-football-jerseys-made-of-fabric-types` (EN), same handle on `us.`, `es.momuto.com/blogs/de-que-estan-hechas-las-camisetas-de-futbol`,
`fr.momuto.com/blogs/matieres-maillots-football-comparatif-tissus`, `it.momuto.com/blogs/di-cosa-sono-fatte-le-maglie-da-calcio`.
