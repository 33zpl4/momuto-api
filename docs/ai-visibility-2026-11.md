# AI visibility — what the radar recorded, 22 Jul → 3 Nov 2026

Source: `33zpl4/ai-radar`, `clients/momuto/results/` (raw answers, never edited), 31 stored runs from 22 Jul to 25 Sep 2026 plus the run
dispatched on 3 Nov (run 41626225013, appended below when finished). Battery: 54 buyer prompts in ES/FR/IT/EN/US, four engines with web
search (OpenAI gpt-4o, Claude, Gemini, Perplexity). Detection is substring ("momuto" in the answer); "cited" = a momuto.com URL in the engine's
citation list. Numbers below use the 1,928 answers to prompts still in the battery (retired prompts excluded).

## Read the caveats first
- **Engine coverage was uneven.** Gemini never answered in this window (model id 404). OpenAI answered only from 25 Sep (429 before).
  Perplexity was out from 18 to 25 Sep (401). July = Claude + Perplexity; the second half of September is mostly Claude. Compare periods
  with that in mind; the per-engine columns are the honest view.
- **Mention ≠ recommendation.** Many hits are a name in a list of eight. "Named first" (the brand opens the list) is counted separately.
- **Volatility is real**: the same prompt on the same engine flips between runs. Half-month blocks, not single runs.

## The trajectory (active prompts, all engines)

| Period | Answers | MOMUTO mentioned | Claude | Perplexity | OpenAI | momuto.com citations per 100 answers |
|---|---:|---:|---:|---:|---:|---:|
| Jul 16–31 | 310 | **6%** | 13% | 0% | — | 11 |
| Aug 1–15 | 378 | 8% | 12% | 5% | — | 16 |
| Aug 16–31 | 399 | 13% | 9% | 16% | — | 29 |
| Sep 1–15 | 380 | **19%** | 14% | 24% | — | 34 |
| Sep 16–30 | 461 | 16% | 16% | 20% | 10% | 28 |

Mention rate tripled in seven weeks; citations of our own pages tripled with it. The same window for the brands the battery tracks:

| Period | Owayo | Spized | Decathlon/Kipsta | Vistaprint | Fútbol Factory | **MOMUTO** | Zentral | Joma |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Jul 16–31 | 45% | 30% | 25% | 21% | 19% | 6% | 4% | 17% |
| Sep 1–15 | 43% | 33% | 30% | 26% | 18% | **19%** | 3% | 13% |
| Sep 16–30 | 30% | 28% | 27% | 25% | 17% | 16% | 4% | 17% |

MOMUTO went from the ninth brand to fifth or sixth, level with Fútbol Factory and Joma, while the leaders stayed flat or slipped.
Nothing in the battery changed in that window (the AI-concept prompts were added on 25 Sep, after the rise), so the rise is the engines,
not the questions.

## Where the engines already pick us (all time, active prompts)

| Prompt category | MOMUTO mentioned | named first | momuto.com cited |
|---|---:|---:|---:|
| "alternatives to Owayo / Spized / Zentral" | **32%** (71/219) | 38 | 190 |
| "which sites have a 3D configurator" | **29%** (62/217) | 28 | 88 |
| AI concept → real jersey (7 prompts, since 25 Sep) | 25% (7/28) | 4 | 9 |
| no minimum order | 15% | 21 | 75 |
| use case (friends, company tournament) | 8% | 13 | 22 |
| "best brand / best site" | 8% (38/504) | 10 | 58 |
| speed | 6% | 4 | 16 |
| quality / fabric | 5% | 1 | 5 |
| **price** | **1%** (3/276) | 1 | 6 |
| process (how a club buys) | 0% | 0 | 0 |

Best single prompts: "Alternatives to Owayo and Spized for custom football kits" 68% · "Which websites have a 3D configurator…" 58% ·
"Où commander des maillots de foot personnalisés sans minimum" 52% · "Quels sites proposent un configurateur 3D…" 43% · "Alternatives à
Owayo" 41%. By market: EN 28%, US 25%, FR 24%, **ES 5%, IT 0% (1 of 326 answers)**.

**What the engines cite** (all time): the www homepage 77 · `fr…/comparatif-fournisseur-maillot-foot-2026` 68 · the fr homepage 66 ·
`www…/blogs/best-custom-football-kit-suppliers-2025-review` 44 · `www…/pages/momuto-vs-jersix-owayo-spized-comparison` 30 · the es homepage 30 ·
`es…/mejores-webs-equipaciones-futbol-personalizadas-2026` 29 · the FR 3D-configurator post 14 · `es…/zentral-opiniones-alternativa` 14 ·
`www…/pages/custom-soccer-jerseys` 13. **The comparison pages are the citation engine**: three of the top five cited URLs are comparisons, and
the "alternatives" category is where we win most. The design page, the AI hub and the maker pages are not cited yet.

**How we are described** (Perplexity, September, verbatim): "spized and MOMUTO stand out as strong contenders because they offer dedicated
online kit designers and full custom football kit production in Europe" · "MOMUTO — has a free 3D kit maker and 3D designer for custom
football jerseys" · "MOMUTO: destaca por configurador 3D en tiempo real, concepto con IA, y pedido sin mínimo" · "MOMUTO est présenté comme
le fournisseur le plus complet pour les clubs français en 2026 dans le comparatif fourni". Claude on the US AI-concept prompts (25 Sep):
names MOMUTO **first** on both "I designed a soccer jersey with ChatGPT, who can make it" and "is there a company that recreates
AI-generated jersey concepts".

## The story, in one paragraph (for the post and for the owner)
Between late July and mid September 2026 the share of AI answers that name MOMUTO for custom-kit buying questions tripled, from one in
sixteen to one in five, and the engines started citing our own comparison pages as their sources. We moved from the bottom of the tracked
list to the middle, next to brands with ten times the catalogue, with no change in the questions asked. The engines pick us for three
things: a free real-time 3D designer, no minimum order, and, since the prompts exist, turning an AI-generated concept into a real kit, where
Claude names us first for US buyers. They do not pick us for price, for quality/fabric, for "how do I buy as a club", and not at all in Italy.

## What this says the next content should be (the blind spots are the brief)
1. **Price**: 276 answers, 3 mentions. The engines have no quotable MOMUTO price table. A "what a custom kit costs in 2026" page per market
   with the ladder in plain text (not only in the FAQ JSON-LD) is the single biggest hole. The jersey-maker hub now carries the ladder; a
   price-first page per language is the next step.
2. **Quality / fabric**: 63 answers, 3 mentions, 1 citation. The fabric facts (92/8, 145–160 GSM, four-way stretch, lifetime guarantee
   against peeling) exist on the fabric post; they need to be on a product-facing page the engines cite for "best fabric" questions.
3. **Process ("how does a club buy")**: 56 answers, 0 mentions. The timeline series exists in editorial; a "how to order custom kits for
   your club" page in ES/FR/EN with the steps and dates is missing.
4. **Italy**: 1 mention in 326 answers. Nothing to cite: the IT comparison page and IT hub pages are the fix (it-site-recovery steps first).
5. **The AI-concept post** (`docs/brief-ai-recommendations-post.md`): the evidence is already here, dated and attributable, so the post
   needs no screenshots from the owner: cite the radar (prompt, engine, run date, quote).
6. **Comparison refresh** (Jan 2027): the most-cited pages carry "2025"/"2026" in handles or titles; keep them current, they are the engine.

## 3 Nov 2026, first run after the October changes (run 41626225013, the OLD 34-prompt battery)

Dispatched by mistake on the stale `main` branch of ai-radar (the live battery and code are on the default branch
`claude/new-repo-setup-b5q4vx`), so this run has the 34 original EU prompts only: no US, no AI-concept, no basketball prompts, and
Gemini 404 again (old model id). It is still a valid point for the EU prompts, with three engines answering (102 answers):

| | MOMUTO | Claude | OpenAI | Perplexity |
|---|---:|---:|---:|---:|
| 3 Nov, 34 EU prompts | **16%** (16/102) | 32% (11/34) | 9% (3/34) | 6% (2/34) |

By market: **ES 24% (10/42)**, up from 5% all-time; EN 22%; FR 8% (down from 24%); IT 0%. Brands the same day: Owayo 26%, Vistaprint 24%,
Spized 23%, Decathlon 18%, **MOMUTO 16%**, Joma 15%, Fútbol Factory 11%, Zentral 8%. The ES jump has one source: the engines cited
`es…/mejores-webs-equipaciones-futbol-personalizadas-2026` **10 times in 102 answers**, more than every other momuto.com URL together;
the ES comparison page has become the ES citation engine the way the FR comparatif was in August. Also cited for the first time:
`www…/pages/design-your-own-soccer-jersey` (2) and `best-custom-soccer-jersey-makers-2026` (1). Perplexity's drop (20–24% in Sep → 6%)
is the number to watch on the next runs; Claude's rise (16% → 32%) is the other. One run, so neither is a trend yet.
The full-battery run on the correct branch follows below.

## 3 Nov 2026, full battery on the correct branch (run 41629625098, 48 prompts, 144 answers)

Claude, ChatGPT and Perplexity answered everything; Gemini (`gemini-3.8-flash` discovered) hit 429 three times and was skipped.

| | MOMUTO | Claude | ChatGPT | Perplexity |
|---|---:|---:|---:|---:|
| 3 Nov, 48 prompts | **17%** (24/144) | **35%** (17/48) | 10% (5/48) | 4% (2/48) |

Claude's rate has gone 13% (Jul) → 16% (late Sep) → **35%**. Perplexity's has gone the other way (20–24% in Sep → 4%), and it still quotes
"roughly 20–25 days" from an old page. ChatGPT at 10% is its first comparable point. Brands the same day: Owayo 30%, Spized 21%, Vistaprint 19%,
**MOMUTO 17%**, Joma 15%, Decathlon 12%, Fútbol Factory 10%, Zentral 3%.

By category: **quality 44% (4/9, first every time)** — new; alternatives 42%; speed 33%; process 33% (first ever mention); no-minimum 20%;
AI concept 19% (Claude first on US03 and EN07; ChatGPT on US04); best-of 3%; use-case, bespoke and basketball 0. By market: ES 25%, EN 21%,
US 21%, FR 7%, IT 0%. Cited: `es…/mejores-webs…` 10 (the ES engine), `www…/design-your-own-soccer-jersey` 4, `best-custom-soccer-jersey-makers-2026`
4 (+2 on us), the suppliers review 3, **`www…/pages/ai-concept-to-real-kit` 3 (first citations ever)**, the vs-comparison 2, FR comparatif 2.

What changed since September: the quality/fabric cluster flipped from a blind spot (5% all-time) to our best category in one run, right after the
fabric facts went on the pages and in llms.txt in October; the AI hub page is now cited; Perplexity dropped and ChatGPT appeared. The post
`ai-assistants-custom-jersey-recommendation` (EN + US, live 3 Nov) carries the dated examples from this run.

## How to re-run
`ai-radar`: Actions → *Radar IA run* → client `momuto`, **branch `claude/new-repo-setup-b5q4vx`** (the default; `main` is a stale copy
with 34 prompts and the old Gemini id — do not dispatch there). One run ≈ 20–25 min; the method is three runs on three days. Then
`python radar_pipeline.py score --csv`. The analysis above is a one-off script over `results/`; the next read should repeat the half-month
table and the category table and compare.

**Prompt-bias note (owner, 3 Nov 2026):** the quality prompts US05 and ES16 used MOMUTO's own fabric vocabulary ("premium polyester-elastane
as standard"), so the first-place answers on those two are partly self-inflicted. Both prompts were rewritten in a buyer's words in the
battery (ai-radar, same day); the ES17 result ("mejor calidad de tejido para un equipo amateur", neutral) stands. Treat the 44% quality figure
above as inflated until the next run.
