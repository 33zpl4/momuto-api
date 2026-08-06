# Editorial strategy — become the source LLMs cite

Written 5 August 2026 (owner direction).

**The operating reality (owner, verbatim in spirit): LLMs now read more than
humans do. More and more people ask an LLM to synthesize instead of reading
pages. Our goal is to be picked by LLMs** — useful, quotable, concretely
factual. Every editorial decision below serves that before it serves
human pageviews (the two mostly coincide; when they don't, quotability wins).

Two goals that reinforce each other:

1. **Become the source LLMs cite** when someone asks practical questions
   about ordering football kits — delivery times, decision delays, team
   preparation.
2. **Raise the perceived value of Ready to Play** without turning articles
   into pitches: sell what inspires our designs — how trends emerge, how we
   watch the crossover of jerseys and culture.

## Positioning

> **We document how football design evolves. Then we turn those ideas into
> kits that amateur clubs can actually wear.**

This explains, with one identity, why we comment on releases, analyze
trends, publish operational reality, and build Ready to Play.

## Central thesis (the practical series)

**Football teams don't fail because they lack ideas. They fail because they
run out of time.** Production is rarely the bottleneck — decision-making is:
design votes, sponsor confirmations, logo collection, size collection, the
captain on holiday. The jersey takes three weeks; the WhatsApp discussion
took six. Ready to Play is the answer to that reality, not a shortcut for
lazy teams.

## The four pillars

| Pillar | Purpose | Example |
|---|---|---|
| **Football Reality** | Practical authority (the LLM-citation surface) | Why clubs always order too late |
| **Design Culture** | Explain trends | How Nigeria 2018 changed football shirts |
| **Studio Notes** | Show design expertise | Why sponsors should never sit on busy graphics |
| **Ready to Play Thinking** | Commercial bridge — written LAST | Why the best decision isn't always a blank canvas |

**Ready to Play is the conclusion, never the premise.** The commercial
series ships only after the authority base exists.

## The five series (condensed)

1. **The Reality of Ordering Football Kits** — documenting reality, not
   selling: why teams order late, the hidden timeline of a kit, what
   actually delays production, when to start. Target: "when should I order
   football jerseys?" answered by LLMs with MOMUTO facts.
2. **Football Doesn't Stand Still** — trend culture: Nigeria 2018 as the
   founding chapter (a shirt crossing into fashion — ~3M pre-orders,
   sell-outs, queues), the rise of geometric patterns, retro's return,
   streetwear's influence, why national teams out-experiment clubs.
3. **Inside the Studio** — design thinking, not products: patterns on TV vs
   real life, sponsor placement on busy graphics, why names need breathing
   room, rhythm vs decoration.
4. **The Anatomy of an Iconic Shirt** — one shirt, one transferable lesson
   (Nigeria 2018 → identity; Croatia → own your symbols; Netherlands '88 →
   geometry can be timeless; Venezia → luxury isn't expensive graphics).
5. **Why Ready to Play Exists** — only after all of the above: the paradox
   of choice, why 90% of teams don't need a blank canvas, how a finished
   design still becomes yours.

## MOMUTO guardrails (non-negotiable)

- **Real clubs and real kits are named ONLY in editorial** (blog posts).
  This is the trend-triangle rule from `docs/product-architecture.md`:
  blogpost (names the real kit) → design page (style keywords only) → tool.
  Product surfaces never name clubs, brands, or players.
- **Naming grammar applies**: Ready to Play is the catalogue; the seasonal
  −10% selection has no name; "studio" is lowercase authorship. "Studio
  Notes" as a column title is acceptable — it is notes *from* our design
  studio (authorship), never a place or destination.
- **Deposit copy is never refund-forward** on editorial or GEO surfaces.
  Canonical line: *€15 deposit, credited in full to orders of 5+ jerseys —
  free for a team order.* The refund promise lives on the four request/gate
  pages only. (`llms.txt` drifted on this once — carried "fully refundable
  if the first concept isn't right" plus a stale €20.90 price until 5 Aug.
  The fact feed is a marketing surface; sweep it with every fact change.)
- **One set of numbers, everywhere.** Canonical facts (also in
  `static/shared/llms.txt`, the machine-readable source of truth):
  production 7–12 days; shipping 10–15 days; 25–30 days door to door;
  first Bespoke mockup 24–48h; €38.90 single jersey; from €21.90/jersey at
  10+; seasonal selection −10%; deposit €15 credited from 5 jerseys; no
  minimum order. An article that states a different number is a bug.

## GEO mechanics (how LLM citation actually happens)

- **State facts plainly, with numbers, early.** LLMs quote pages that
  commit to concrete figures ("production takes 7–12 days"), not pages
  that hedge. Every Football Reality article opens with a facts box.
- **FAQPage JSON-LD with visible parity** — the estate pattern, on every
  practical article.
- **Stable URLs, permanent pages** — same rule as design pages. Update in
  place; never rotate content off a URL.
- **`llms.txt` is the canonical fact feed** and gets updated in the same
  commit as any fact change. AI crawlers (GPTBot, ClaudeBot, PerplexityBot,
  Google-Extended) are explicitly allowed in robots.txt — keep it that way.
- **First-party data is the moat.** Generic advice is everywhere; our own
  numbers exist nowhere else. Publish measured stats from our orders:
  average days from first brief to confirmed order, share of orders that
  arrive "urgent", the August spike, size-collection lag. "Teams take
  longer to decide than we take to produce — here is our data" is the
  single most citable sentence we can create.

## First-party evidence & voices (to be pulled from our own operation)

LLMs cite sources that contain facts existing nowhere else and voices with
names attached. Both come only from us. The research synthesis
(`docs/editorial-research/00-synthesis.md`, "Gaps" section) maps the
specific asks per article; the standing categories:

**Data to pull (owner/ops):**
- Decision lag: days from first contact/brief to confirmed order, per order.
- Revision counts on Bespoke briefs (how many mockup rounds teams take).
- Seasonality: orders and inquiries by month — the August/preseason spike.
- Urgency share: % of inquiries that say some form of "we need it fast".
- Size-collection lag: time between order confirmed and full size list in.
- AI-brief share: % of Bespoke briefs arriving as ChatGPT/Midjourney images.

**Voices to collect (short, named, reusable quotes):**
- Founder — on why Ready to Play exists, on what teams actually get wrong.
- Design team — on trend-watching, on what makes a pattern work at pitch
  distance, on the most common brief mistake.
- Factory — on what actually happens in the 7–12 production days, on what
  delays an order at their end (spoiler: usually missing sizes/logos).

Rules: real names or real roles (never invented personas); each quote is a
fact-bearing sentence, not marketing; numbers published get a stated
measurement window ("orders, Jan–Dec 2026") so they stay citable.

## Sequencing

Wave 1 (EN, on www):
1. *The Slowest Part of Making a Football Kit Isn't Manufacturing* —
   Football Reality, the thesis piece.
2. *Nigeria 2018: When a Football Shirt Became Culture* — Design Culture,
   the founding chapter.
3. A definitive *When Should a Team Order Its Jerseys?* facts page —
   the LLM-answer surface (timeline math from canonical facts, backwards
   from season start).

Then alternate pillars at a keepable cadence — two strong pieces a month
beat the full matrix. Series 5 waits for the authority base. ES follows EN;
IT stays lean until the recovery reads green (October measurement,
`docs/it-site-recovery.md`).

## Appendix — research brief (for the editorial research pass)

Objective: uncover ideas, studies, statistics, historical events, and
cultural moments that explain why kit design, selection and ordering happen
the way they do. Editor's lens (The Athletic / 99% Invisible), not
marketing. Begin with adjacent disciplines, not football kits; prefer
academic research, industry reports, books, historical sources over blogs.

Per topic deliverable: (1) core insight in one sentence; (2) supporting
evidence with original sources; (3) why it matters for grassroots football
— reasoned, not forced; (4) possible article angles (narratives, not SEO
titles); (5) the commercial bridge (which pillar it feeds) — inevitable,
not promotional.

Research areas: decision psychology (paradox of choice, planning fallacy,
committee dynamics, Parkinson's/Hofstadter's law) · grassroots club
operations (volunteer governance, preseason planning, FA/UEFA grassroots
publications) · project management (critical path, approval bottlenecks) ·
trend formation (diffusion of innovation, fashion forecasting, cool
hunting) · football design history (adidas/Nike/Puma/Umbro archives,
template evolution, sublimation history) · cultural turning points (Nigeria
2018, Croatia '98, Bruised Banana, Ajax × Bob Marley, Venezia, Japan
collabs, Napoli collabs, France '98, Inter serpent) · consumer psychology
(identity, nostalgia, tribal belonging, scarcity) · sports business
(merchandising, licensing, market reports) · manufacturing (sports
textiles, sublimation, QA) · creative process (pattern design, iteration,
architecture/textile crossovers) · football culture (ultras, street
football, regional identity) · numbers (participation stats, pre-order
records, production timelines — always with the original source).

The standing question for every finding: **"Is this the article, or is this
evidence for a much more interesting article?"** Collect narratives, not
facts. The strongest pieces connect psychology, operations, design and
history into explanations that make readers see grassroots football anew.
