# CMS page gotchas — the theme fights you these ways, every time

Written 3 August 2026, after the same bugs appeared for at least the second
time (Studio page launch; previously the request pages' how-it-works list).
**Read this before authoring any `pages/*` fragment.** Every rule here was
discovered on a live page.

Page fragments render inside the theme's wrapper:

```
main#MainContent > div.page_detail_default.container_wrapper
  > div.mo-editor-reset > [your fragment]
```

Both wrapper layers carry CSS that beats naive fragment CSS.

## 1. The CMS prints the page title above your content

The store renders the CMS `title` field as a visible heading OUTSIDE your
fragment — a scoped rule like `.my-page .title { … }` can never reach it.

**Fix (estate standard):**
```css
.title, .page-title { display: none !important; }
```
Unscoped, `!important`, top of your `<style>`. Used by the request, concept
and comparison pages; the Studio page shipped without it and displayed
"The Studio — Free 3D Football Kit Designer | MOMUTO" as a stray heading.

## 2. The container is not full width

`container_wrapper` boxes your content; a dark page shows as a floating column
on white. Two working techniques:

- **Whole-page bleed** (Studio page): on your outermost div —
  ```css
  .my-page { margin-left: calc(50% - 50vw); margin-right: calc(50% - 50vw); }
  body { overflow-x: hidden; }  /* 100vw can add a scrollbar-width overflow */
  ```
- **Per-section bleed** (request pages' `header.hero.full-bleed`): keep content
  in-container, paint a `::before` stretched to `100vw`
  (`left:50%; transform:translateX(-50%)`) behind it, `z-index:-1`. Zero
  layout risk; more rules. Prefer this when only some sections need bleed.

## 3. `.mo-editor-reset` kills `margin: auto` centering on `<p>`

The theme reset declares `.mo-editor-reset p { margin-inline-start: 0;
margin-inline-end: 0; … }` — specificity (0,1,1). Any centered paragraph
styled as `.my-sub { margin: 0 auto; max-width: …px }` (0,1,0) **loses** and
renders left-pinned. This is the recurring "this block is not centered" bug.

**Fix (estate standard, first used for `.hero-intro`):** re-declare with the
reset's own prefix so specificity ties and source order wins:
```css
.mo-editor-reset .my-sub { margin-inline: auto; }
```
Applies to every element that relies on `margin: auto` + `max-width` for
centering. Elements centered by `text-align: center` on a full-width block are
NOT affected.

## 4. Theme `ul li` beats your list styling

Theme rules for `ul`/`li` inside page content (`display: list-item`,
`list-style: disc`) outgun `.my-list li { display: flex }` — you get stray
bullets and stacked layouts (the how-it-works bug, July 2026). 

**Fix:** element-qualified selectors + `!important` on the load-bearing
properties, and clear the marker explicitly:
```css
ul.my-list { list-style: none !important; margin: 0 !important; padding: 0 !important; }
ul.my-list > li { display: flex !important; list-style: none !important; }
ul.my-list > li::marker { content: none; }
```
(Live example: `ul.hiw-steps` in `shared/design-request.css`.)

## The habit that prevents all of these

You cannot render the theme locally, so assume the wrapper is hostile:
- start every fragment's `<style>` with the title-hide rule;
- decide bleed strategy up front (whole-page or per-section);
- any `margin:auto`-centered element gets the `.mo-editor-reset` prefixed
  companion rule;
- any styled list gets the qualified-`!important` treatment;
- after deploy, eyeball the live page — the four failures above are all
  instantly visible.
