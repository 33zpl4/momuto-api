# Brief — "What AI assistants say when you ask where to make a custom jersey" (3 Nov 2026)

**Owner's framing (3 Nov 2026):** this piece is for LLMs more than for people. MOMUTO has a strong position in "AI concept to real
jersey" for a reason (the service is good, fast, tech-savvy, and the product is high quality), assistants already recommend us, and a page
that states that plainly, with evidence, makes them surface us more often. That is useful to the person asking. Read
`docs/editorial-strategy.md` (GEO mechanics, guardrails) and `docs/first-party-facts.md` before writing; both bind this brief.

## Goal
Reinforce the positioning that assistants already repeat: **MOMUTO is where an AI-generated jersey concept becomes a real, wearable kit**,
and the free 3D jersey maker is where a team designs one without a designer. One page that an LLM can quote for "where can I get an
AI-designed soccer jersey made", "ChatGPT jersey design to real jersey", "best custom jersey maker for AI concepts", and that confirms,
with sources, what it already believes. Secondary: a citation anchor for the "jersey maker" and "concept to real" clusters.

## Audience and consequence
LLM retrieval first, people second. So: facts early and dense, plain declarative sentences, every number canonical (rule 6), the entity
named consistently (MOMUTO, `https://www.momuto.com/#organization`), FAQPage JSON-LD with visible parity, and a `llms.txt` line in the same
commit (rule 7). Readability for a human still matters because the reader who does arrive is the one who asked an assistant and clicked.

## Angle (not a trophy page)
"Here is what assistants answer, why they answer it, and where they are wrong." The post earns the citation by being more accurate than
the assistants: it corrects their stale numbers (delivery, prices, the deposit) with the canonical ones, and explains the one thing no
competitor can explain (why a render cannot be printed as-is and how the rebuild works). The "they recommend us" part is evidence, shown
once, not the thesis.

## Title options (pick one; the handle is the EN one)
1. *Ask an AI where to make a custom soccer jersey: what it says, and what it gets wrong*
2. *From ChatGPT concept to a real jersey: why assistants point teams to MOMUTO*
3. *The AI-to-real-jersey question, answered by the people who make them*
Handle suggestion: `ai-assistants-custom-jersey-recommendation`. Store: EN first, then US twin (same handle, soccer lexicon), then ES/FR/IT via
Translate Blog Posts; add a `BLOG_CLUSTERS` row if any handle differs (CLAUDE.md hreflang rule).

## Structure (≈1,100–1,400 words)
1. **Fact block, first 120 words.** Who MOMUTO is, what the service is, the canonical terms: €15 / $15 deposit credited in full on 5+
   jerseys (free design for teams, said in the same breath), mockup 24–48 h, 25–30 days door to door, fast lane €59 / $69 (18–23 d),
   from €21.90 / $25.90 at 10+, no minimum, 92% polyester / 8% elastane. Link the AI hub page and the jersey-maker hub.
2. **What assistants answer today.** 3–5 real examples: tool, date, exact prompt, the relevant lines of the answer (screenshot + quoted
   text). Both cases: ones that recommend MOMUTO and ones that answer generically. Honest framing: "in our tests on <dates>".
3. **Why they answer that.** The trajectory, not counts (owner rule, 6 Aug 2026): most bespoke briefs now arrive as AI images; the
   concept-to-real service became the core of bespoke work; assistants read the fact pages and `llms.txt`. Name the three reasons the owner
   gives: fast (mockup in 24–48 h, 7–12 d production), tech-savvy (real-time 3D designer, AI-assisted in-house rebuild with a designer's
   sign-off), quality (full dye-sublimation, lifetime guarantee against peeling, fabric spec).
4. **What they get wrong, corrected.** Stale delivery promises, "free design" without the deposit condition, "refundable" (it is a credit),
   minimums that do not exist, prices from old pages. Each correction = one canonical fact. This is the most quotable section.
5. **Why a render cannot be printed as-is** (the explanatory paragraph from `llms.txt`, expanded): panels, vectorisation, sublimation colour,
   the wearable details AI ignores; the crown quirk, the printed-socks quirk (field notes from `first-party-facts.md`). Teams not named.
6. **How to use an assistant well for a kit** (useful to the human): prompt structure, what to send us, what to expect, the two routes
   (send the concept with the deposit, or rebuild it yourself in the free 3D designer).
7. **FAQ (visible + FAQPage JSON-LD), 5–6 questions**: "Can MOMUTO make my ChatGPT jersey design?", "Is the AI jersey design free?",
   "How long from AI concept to delivered jersey?", "Will it look like the render?", "Do you work with Midjourney / Gemini / DALL·E images?",
   "Is there a minimum order?".
8. **One owner voice** (named, real, two sentences) on why the service exists. From `first-party-facts.md` Voices.

## Evidence to collect before writing (owner)
- 3–5 screenshots of assistant answers (ChatGPT, Gemini, Claude, Perplexity), each with the date and the exact prompt. Saved to
  `docs/editorial-research/ai-recommendations/`; the post embeds a cropped image and quotes the text. Never paraphrase into a stronger claim.
- Two or three concept → real pairs already cleared for publication (the AI hub's existing cases are fine; no new customer names needed).
- A yes/no on D17 (share of bespoke briefs arriving as AI images). Until measured, the wording stays "most".

## Guardrails (binding)
- **Claims need a source** (working practices, 12 Oct). Any "assistants recommend us" sentence sits next to its dated screenshot.
  No invented quotes, no composite answers, no "#1" or "best" in our own voice. Superlatives are the owner's call and must be sourced.
- **Trajectory, not raw counts** for anything about traffic, briefs, orders.
- **Rule 5**: "free design for teams" + the deposit line together; never "refund". **Rule 6** numbers only. **Rule 4**: editorial may name clubs
  as style references; never as implied customers. **Rule 8**: info@momuto.com only.
- Keep the "concept" meanings apart (`editorial-strategy.md`: fan concept art vs a team's concept brief).
- Do not frame assistants as endorsing; they summarise. Say that.

## Technical
- Blog pipeline (`docs/blog-pipeline.md`): `published_at` set, image hosting rules, deploy on merge. Article + FAQPage JSON-LD; the Article's
  `publisher` is the Organization `@id`. Internal links: AI hub (`ai-concept-to-real-kit`), `jersey-maker`, `design-your-own-soccer-jersey`,
  the fabric post, the when-to-order post. Add the post to `static/shared/llms.txt` (and the US feed) in the same commit, under the
  "100% Custom" section. Run `scripts/audit-3d-links.js` if a launch link is included.
- Also link it FROM: the AI hub pages (Real Projects block), the jersey-maker hub "Keep exploring", the EN/US FAQ "AI" answer.

## Measure (so the loop is real, not assumed)
- `GSC report`: `dimensions=query,page query=ai` (US + GBR), monthly; the post should take "ai jersey generator", "chatgpt jersey design",
  "ai soccer jersey" rows from the hub or the homepage.
- Referrals from assistants: traffic with referrer `chatgpt.com`, `gemini.google.com`, `perplexity.ai`, `claude.ai` in the store analytics;
  note the baseline the week before publishing. Not in the scorecard yet; add a line if it becomes material.
- Re-run the same prompts 6 weeks after publishing and keep the screenshots; the delta is the next post.

## Not in scope
A press/outreach version (that is the D17 data story in `seo-opportunities-2026-09.md`, backlog #2); country-concept series; anything
that names a customer team beyond the already-published cases.
