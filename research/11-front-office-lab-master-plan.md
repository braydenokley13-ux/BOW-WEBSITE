# BOW Front Office Lab — Phased Master Plan

## Context

Brayden wants a serious sports analytics research & publishing platform — the **BOW Front Office Lab** — where he can publish research papers, analytical articles, player studies, decision memos, data stories, and models, building a credible front-office portfolio published through BOW Sports Capital. Every piece must use evidence to answer a real sports decision.

The deep repository audit (three parallel agent passes over framework, content architecture, and data/deployment) produced one decisive finding: **the Lab already substantially exists** under `/analytics` — a working research loop (lenses → Open Docket → evidence notebook → draft compiler), an original valuation model (AASV), a dependency-free markdown CMS with 9 live data-embed shortcodes, an Open Ledger accountability record, and a V1 editorial desk. The prior strategy corpus in `research/01–10` already scopes much of the editorial roadmap. This plan therefore **matures and extends what exists** rather than building a parallel system.

**User decisions (locked):**
1. **Rebrand `/analytics` in place** as the BOW Front Office Lab — no new `/research` route tree.
2. **Postgres migration first** — replace `node:sqlite` before building Lab features (the repo's own `research/07` flags SQLite-on-Vercel as a data-loss launch blocker).

---

## 1. Executive summary

- Fix the foundation: migrate persistence from `node:sqlite` (`lib/db.ts`, ~45 tables) to **Neon Postgres via `pg`** (no ORM — matches the repo's raw-SQL, minimal-dependency ethos).
- Close the five already-scoped gaps from `research/10`: desk detail routes, published-piece backlinks, desk persistence (replace the static `DESK_ASSIGNMENTS` array with a DB table), one-click signal→assignment, residue ledger.
- Extend the content model: 6 new `ArticleKind`s (research-paper, player-study, team-study, decision-memo, data-story, method-note), citations/footnotes/sources/suggested-citation, a `<DecisionLayer/>` front-office-implications embed, print CSS, scheduled publishing.
- Add 5 new routes only: `/analytics/desk/[id]`, `/analytics/projects(/[slug])`, `/analytics/series/[slug]`, `/analytics/models/[slug]`, `/analytics/about`.
- Build a reusable **figure system** in the existing hand-rolled-SVG house style (no chart library): regression scatter with confidence bands, histograms/percentiles, aging curves, small multiples, sortable research tables, annotations, static print/no-JS twins, and one scrollytelling primitive.
- Launch flagship: **"The Same Contract, Four Different Prices"** — contract surplus value in the apron era (already staged at `lib/desk.ts:289`), opening the "Apron as a Natural Experiment" research series.
- Add Vercel Analytics with research-specific events; add `vitest` with tests scoped to the parser, detectors, and AASV math.

## 2. Current repository audit (condensed — full detail verified by three agent passes)

**Framework & constraints**
- Next.js **16.2.9** (breaking changes vs training data — read `node_modules/next/dist/docs/` before coding; `npm install` needed, node_modules absent). React 19.2.4. Only 4 runtime deps: `next`, `react`, `react-dom`, `lenis`.
- Next 16 specifics that bind implementation: `params`/`searchParams` are **Promises** everywhere (await them — house rule in README); `proxy.ts` replaces middleware (nodejs-only; new gated routes must be added to both its `guarded` logic and `matcher`); **Cache Components / `use cache` NOT enabled** (`next.config.ts` is empty; repo uses `export const dynamic = "force-dynamic"` in 15 files); `revalidateTag` needs a 2nd profile arg (repo uses `revalidatePath` only); Turbopack is default; `next/image` used **nowhere** (`components/site/ImageSlot.tsx` plain-`<img>`/placeholder is the house pattern).
- Styling convention (load-bearing): **inline `style={{}}` objects referencing CSS custom properties** — no Tailwind/CSS modules/CSS-in-JS. Tokens in `styles/tokens/{fonts,colors,typography,spacing,shape}.css`. Four font voices: `--font-display` (Barlow Condensed), `--font-editorial` (Newsreader), `--font-interface` (Inter), `--font-data` (IBM Plex Mono, tabular-nums). Section-scoped dark mode via `.bow-front-office` class. Motion: Lenis + native CSS `animation-timeline: view()` utilities + full `prefers-reduced-motion` override.
- Server pages with `"use client"` pushed to leaf components is the established convention.

**What already exists (build on, don't duplicate)**
- **Routes** under `app/(marketing)/analytics/`: landing, `desk`, `notebook`, `questions(/[id])`, `ledger`, `methods`, `articles(/[slug])`, `players/[slug]` (investment memos), `teams(/[team])`, `trade` — with a nested layout mounting `<NotebookTray/>`. Admin CMS at `app/analytics/admin(/editor/[id])`, proxy-guarded.
- **Research loop (real, working engines)**: `lib/lenses.ts` (5 worldview presets writing into `useAssumptions`), `lib/tensions.ts` (7 pure deterministic question detectors; `buildDocket()` heat-ranked, deterministic IDs — a hard invariant per `research/08`), `lib/questions.ts` (server glue), `lib/notebook.ts` (localStorage, 60-clip cap, assumptions frozen at capture), `lib/notebook-draft.ts` (clips → markdown draft with embeds), `lib/ledger.ts`/`ledger-store.ts` (nightly snapshots, `diffSnapshots` → dated events).
- **CMS (real)**: `lib/markdown.ts` — custom dependency-free parser (~340 lines) with **9 live data-embed shortcodes** (`PlayerCard, AASVChart, AASVTable, TeamCapSheet, TrendChart, ContractVerdict, TeamFlex, ScenarioBand, TradeAnalysis`) that re-run the live AASV engine at render. `Article` (`lib/articles-shared.ts`): `status: draft|submitted|published`, `kind: article|paper`, revisions (cap 25, rollback), featured, `authorUserId` for reader papers (3-open-submission cap). Editor live-preview shares the exact parser — the **round-trip contract** to preserve. **`research/07 §5` explicitly decides against MDX** — extend the grammar, never swap engines.
- **The one honest prototype**: `lib/desk.ts` — `DESK_ASSIGNMENTS` hand-edited static array (statuses signal→assigned→researching→drafting→published/killed; 7 `ContentFormat`s; `residue` arrays), self-documented as awaiting DB persistence.
- **Charts**: all hand-rolled client SVG (`components/analytics/ValueScatter.tsx`, `TrendLine.tsx`, `CapStackBar.tsx`) — manual scale closures, keyboard-focusable dots (`role="link"`), CVD-validated palette (`APRON_COLORS` in `lib/aasv.ts`), text-backed legends, gap-breaks-the-line convention, `var(--font-data)` labels. Tables: `ValueTable.tsx` (client sort, search, filters, live re-rank on assumption changes).
- **Education bridge (shipped)**: glossary auto-linking in article bodies (`linkGlossaryTerms`), `components/selfpaced/FrontOfficeLab.tsx` dashboard exercise reusing live embeds (⚠️ name collision with this project — rename component), published reader papers surface on `/profile/[studentId]`, desk `teaching-note` format.
- **Data**: `data-seeds/contracts.csv` (178 players, all 30 teams, hand-curated cap/apron, system of record) + `stats-snapshot.csv` (mostly 2025-26 only; just 5 players have 3 seasons). Ingest: `npm run ingest` → `stats.nba.com` playerestimatedmetrics, league-wide per season (historical backfill is cheap via `--seasons`). Nightly Vercel cron. **Current data supports cross-sectional analysis fully; longitudinal analysis needs backfill.**
- **Persistence risk state**: still `node:sqlite` on `data/bow.db` (ephemeral on Vercel). Shipped mitigation: `lib/blob-mirror.ts` mirrors articles + ledger snapshots to Vercel Blob with cold-start rehydration. LMS tables unprotected. Postgres migration (user-selected) supersedes this.
- **Gaps that are genuinely empty**: no telemetry at all, no tests/test runner, no CI, no citations/footnotes, no author entity (free-text string), no model pages, no project/WIP pages, no series pages, no print styles, no JSON-LD, only one Suspense usage and zero `next/dynamic` in the repo.
- ⚠️ `/front-office` is **taken** — the auth-gated, noindex Track-201 "Eastfield Eagles" cap simulation. Untouched by this plan.
- Prior strategy corpus `research/01–10` includes a scripted **first-10-pieces** publication sequence, 5 research territories (T1 = "The Apron as a Natural Experiment", the named beachhead), the Residue Rule (every piece deposits ≥1 reusable detector/embed/column/lens/model-revision), and `research/10`'s 5-item build backlog. This plan adopts them.

## 3. Recommended product definition

The BOW Front Office Lab **is the `/analytics` section, rebranded in place**: a small public research department that publishes evidence-based answers to real front-office decisions, with a live, reader-adjustable model on the record. The Lab's differentiators (already partially shipped, to be completed): explicit assumptions (lenses/sliders), computable disagreement (docket), frozen evidence (notebook), public accountability (ledger), and live embeds whose numbers never go stale. Brayden's portfolio is the sum of published pieces + the models page + the author profile + the ledger's track record.

**Route disposition (rebrand map):**

| Route | Disposition |
|---|---|
| `/analytics` | Keep path; rebrand landing (see §8) — work first, tools second |
| `/analytics/articles(/[slug])` | Keep; extend Article model (§6) |
| `/analytics/desk` | Keep; add `/desk/[id]` detail route; board reads from DB |
| `/analytics/questions(/[id])`, `/notebook`, `/ledger`, `/trade`, `/teams` | Keep as-is |
| `/analytics/methods` | Keep; extend to host the research-quality panel + publication checklist (reader-facing) |
| `/analytics/players/[slug]` | Keep; extend with percentiles/comparables (§11) |
| `app/analytics/admin(/editor/[id])` | Keep; editor gains kind-aware forms, checklist sidebar, citation fields |
| **New:** `/analytics/projects(/[slug])`, `/analytics/series/[slug]`, `/analytics/models/[slug]`, `/analytics/about`, `/analytics/desk/[id]` | Only net-new public routes |
| `/front-office` (student sim) | Untouched. Rename only the unrelated component `components/selfpaced/FrontOfficeLab.tsx` → `AssumptionsExercise.tsx` to kill the code-search collision |

**Naming:** recommend changing the masthead NAV label `"Analytics"` → `"Research"` (`lib/site.ts:29`) and updating `FOOTER_COLS` "Explore" entries ("The Front Office Lab", etc.). One-line reversible change; confirm with Brayden at Phase 0 close.

## 4. Primary audiences and use cases

- **Professional** (team executives, front-office analysts, internship supervisors, professors): land on a piece → inspect methodology (`/methods`, methodology panels, model pages) → check the track record (`/ledger`) → evaluate the researcher (`/analytics/about`). The site must let this reader audit any claim in ≤2 clicks from the claim.
- **Public** (serious fans, journalists, students): understand the central finding and front-office implication from the TL;DR + `<DecisionLayer/>` without reading the appendix; play with the sliders/lenses.
- **BOW students**: reach the Lab from lessons via companion content; submit papers through the existing `submitPaper` flow; published work lands on their `/profile/[id]`.
The dual-register requirement (pro can audit, public can follow) is served structurally: TL;DR + decision layer up top, methodology/appendix collapsed below, embeds interactive by default with static fallbacks.

## 5. Recommended information architecture

Lab sub-navigation (rendered inside `app/(marketing)/analytics/layout.tsx`, not the site masthead): **Research · Players · Teams · Models · In Progress · About**, mapping to `/analytics/articles` (+`/questions` for open questions), `/players/[slug]`, `/teams`, `/models/[slug]`, `/projects`, `/about`. Secondary links (kept, not top-level concepts): Desk, Ledger, Notebook, Trade Machine, Methods.

Discovery = controlled filters, no search infra: extend `/analytics/articles` with querystring filters `?kind=`, `?series=`, `?player=`, `?team=` (pattern already exists: `?category=`/`?tag=` links from article pages). "Explore by front-office question" groupings = series/territory pages plus the docket's existing 7 question kinds (`/analytics/questions?kind=`). Internal linking: `getArticlesMentioningPlayer` already cross-links players↔articles; add series→articles and question→published-piece backlinks (`articles.question_id`).

## 6. Content taxonomy

Two orthogonal axes, both extended rather than invented:
- **`Article.kind`** (structural — how a piece renders): `article` | `paper` (existing, unchanged) + **new**: `research-paper`, `player-study`, `team-study`, `decision-memo`, `data-story`, `method-note`.
- **`DeskAssignment.format`** (editorial — how a piece is worked): the existing 7 `CONTENT_FORMATS` stay; add nullable `articles.format` column so published pieces carry their desk format.

**Structured fields vs markdown convention:** paper sections (exec summary, question, data, methodology, results, robustness, limitations, appendix) stay **`##` headings in `body`** (exactly how `notebook-draft.ts` already compiles drafts) with the canonical heading set per kind documented in a new `research/11-lab-authoring-conventions.md`. Typed DB columns only for independently rendered/indexed fields — new `articles` columns: `tldr` (one-sentence finding), `confidence` (high|medium|low), `series_id`, `question_id` (docket backlink), `sources` (JSON `{label,url}[]`), `format`, `author_id`, `scheduled_for`, `companion_of_article_id`, `league TEXT DEFAULT 'NBA'` (cheap multi-sport future-proofing; also on projects/series/models).

**New tables** (Postgres-native from day one): `research_projects` (slug, title, status enum: exploring|collecting-data|analyzing|modeling|writing|reviewing|published|paused, summary, territory/series id, question_id, article_slug, author_id, updated_note, timestamps), `research_series` (slug, title, thesis), `authors` (slug, display_name, role founder|contributor, bio, nullable user_id bridging LMS), `models` (slug, name, version, decision_supported, target, features JSON, baseline, validation, metrics JSON, assumptions_note, limitations, changelog JSON), `desk_assignments` (1:1 with the `DeskAssignment` interface; seeds from the current static array).

**What stays code, not data**: `CONTENT_FORMATS`, embed components, detectors, lenses, curriculum arrays. Matches the repo's existing split (product surface = code; editorial-cadence content = DB).

**New embed shortcodes** (extend `EmbedName`/`EMBED_RE` in `lib/markdown.ts`, same self-closing/attrs/own-line grammar): `<DecisionLayer recommendation="…" confidence="…" risk="…" bestFit="…" wouldChange="…"/>` (the front-office implications block — first static embed, still through the shared parser so it live-previews in the editor), `<ModelCard model="aasv-v1"/>`, `<PercentileChart player="…" metric="…"/>`, `<ScrollFigure id="…"/>`. **Footnotes**: minimal `[^1]` / `[^1]: text` grammar added to the parser (new Block + InlineNode variants; regex is unambiguous vs existing syntax), rendered as numbered foot-list with back-links.

## 7. Publishing workflow

Hybrid, external-first (unchanged philosophy): analysis in Colab/Python/sheets → draft in Docs → paste markdown into the existing live-preview editor (`ArticleEditor.tsx`) → embeds validate live against real data → checklist → publish.
- **States**: draft → (submitted, for reader papers) → published, **plus new `scheduled`** (`scheduled_for` column + new cron `app/api/cron/publish-scheduled/route.ts` added to `vercel.json` crons).
- **Publication checklist**: pure function `lib/publication-checklist.ts` → `checkArticle(kind, blocks)` inspecting parsed markdown (required headings per kind present? `<DecisionLayer/>` present for kinds requiring it? non-empty `sources` for research-paper/method-note? charts have `FigureSource`?). Rendered as an **advisory** sidebar checklist in the editor (publish never blocked — per brief, no approval workflow) and read-only on `/analytics/methods` as reader-facing transparency.
- **Suggested citation**: derived, no DB field — `lib/citation.ts` `formatCitation(article)` rendered by `SuggestedCitation.tsx` with copy button. Slugs are already frozen at first publish (stable URLs — nothing to build).
- **Print/PDF**: `styles/print.css` (`@media print`: hide masthead/footer/tray/interactive chrome; static figure twins render) + a `window.print()` button beside share buttons. No server-side PDF.

## 8. Research landing page plan (`/analytics/page.tsx` rework)

Replace the tutorial-style hero with work-first editorial layout (no large decorative hero):
1. **Lead investigation** — featured piece (existing `featured` flag): question, TL;DR finding (`tldr`), kind + league tags, main figure (static twin for instant render), front-office implication line.
2. **Latest work** — mixed-kind list (kind-labeled cards) from `getPublishedArticles`.
3. **Explore by front-office question** — links to series pages + docket kinds (Player Evaluation → players; Contracts/Trades → T1 series; Market Inefficiencies → mutual-gain questions; etc.).
4. **Research in progress** — top 2–3 `research_projects` with status chips.
5. **Models & tools** — `/models/aasv-v1`, Trade Machine, lens switcher (moved lower; kept — it's the brand's signature interaction).
6. **Researcher** — compact byline card → `/analytics/about`.
Keep the persistent `<NotebookTray/>` and the section-scoped `.bow-front-office` dark treatment.

## 9. Paper-page plan (`/analytics/articles/[slug]` for kind `research-paper`)

Header: title, subtitle (`dek`), author (→ `/analytics/about`), published + last-updated dates (revisions already tracked), league/series/kind tags, reading time (computed from body length), **main finding** (`tldr`), suggested citation, code/data availability links (from `sources`).
Body: canonical heading sequence (exec summary → front-office question → why it matters → existing thinking → data → methodology → results w/ figures → robustness → limitations → front-office implications via `<DecisionLayer/>` → conclusion → further research → sources → technical appendix). Methodology/appendix sections render inside a collapsible `MethodologyDrawer` (details/summary — no JS needed). Footnotes at foot with back-links. Print-clean.

## 10. Analytical-article plan (kinds `article`, `decision-memo`, `data-story`)

Not forced into paper structure. Requirements enforced only via the advisory checklist: clear claim, at least one chart with source label, sources when citing external data, `<DecisionLayer/>` for decision-memos, limitations where causal language appears. Data stories are ordinary articles whose bodies are figure-dominant, optionally using `<ScrollFigure/>` (§13). Decision memos follow the memo framing that `components/ds/FrontOfficeMemo.tsx` already provides — reuse it in the article renderer for that kind.

## 11. Player-study plan

- Player studies are **articles** (`kind: player-study`) that embed the existing player embeds + new `<PercentileChart/>`; they surface automatically on the player's page via the existing `getArticlesMentioningPlayer` coverage list. **No parallel player-study route.**
- `/analytics/players/[slug]` (the investment memo) gains: cross-sectional percentile profile (within the 178-player pool — fully supported by current data), comparables via new pure `lib/comparables.ts` (nearest-neighbor on cap-hit tier/apron status/production within `AnalyticsPlayer` shape).
- **Longitudinal features (aging curves, multi-season trends) are gated per-piece behind ingest backfill** (`npm run ingest -- --seasons …`), not built as standing page features — current data (5 players with 3 seasons) doesn't support them as defaults.
- No permanent expanded player database at launch; the hybrid stands: curated CSV (contracts) + nightly ingest (stats) + per-piece backfills.

## 12. Interactive visualization system

**Decision: no chart library — extend the hand-rolled SVG house style.** Rationale: the existing components already implement the hard parts (accessible focusable data points, CVD-safe palette, gap-integrity, assumptions-aware re-render); a library fights the inline-style convention, adds the repo's first heavy dependency, and nothing in the brief needs zoom/pan/brush.

New figure inventory in `components/analytics/figures/` (each interactive figure ships a `"use client"` version **and a `Static*` server-rendered twin** — the print/no-JS/OG-image/loading-fallback source, always a complete standalone read):
`RegressionScatter` (points + fitted line + confidence band; hatch/pattern fallback for the band, not opacity-only), `Histogram` (bins + percentile markers), `AgingCurve`, `SmallMultiples` (grid wrapper), `SortableResearchTable` (generalizes `ValueTable`'s sort pattern for non-player data), `Annotation` (text-backed callouts), `FigureCaption`/`FigureSource` (chart source labels — checklist-enforced), `StaticFigure`, `ScrollFigure`.
Interaction behaviors (hover detail, selection, filters, metric toggles, assumption sliders) reuse the shipped primitives: `useAssumptions`, `SliderPanel`, lens switcher, existing tooltip pattern. Figures accept pre-fetched data + `assumptions` props (server-safe, same contract as `embeds.tsx`).
Only 4 new markdown shortcodes (§6) — figures are mostly composed in pages/kind renderers, not ad-hoc embedded; add a shortcode only when prose needs a live re-runnable number.

## 13. Chart-led storytelling system

One primitive, used selectively: `ScrollFigure` — sticky figure beside stepped prose sections, implemented with **IntersectionObserver** (more testable/accessible than `animation-timeline` for state-swapping; consistent with the house `prefers-reduced-motion` invariant). Steps swap declarative figure state (highlighted players, annotations, before/after). Degradation: no-JS or reduced-motion renders all steps stacked with static twins — nothing hidden. Mobile: figure collapses to inline-per-step. Loaded via `next/dynamic` with the static twin as the loading fallback (no layout shift). First use: the flagship's 30-team repricing strip; not a general template for every piece.

## 14. Research projects & work-in-progress plan

`/analytics/projects` (index) + `/analytics/projects/[slug]`: working title, core question, why it matters, league, status chip (8-status enum), current hypothesis, data being considered, planned methodology, known difficulty, next step, last-updated date, related published work + docket question link. Only selected projects are public (a row exists only if deliberately created via admin). Visual state distinctions (status chip styles): in-progress / draft finding / published / updated / archived — reusing `Tag`/`Badge` from `components/ds`. Private notes stay in external tools — this is a shop-window, not a PM system. Projects tie into the desk: a `desk_assignments` row can spawn a public project page (one-click, admin action).

## 15. Author & future contributor architecture

`authors` table seeded with Brayden (`role: founder`). `/analytics/about` renders: bio, research interests, methodological interests, bibliography (computed: `author_id` match + legacy free-text fallback), series led, models, current projects, contact/collaboration pathway. New `components/analytics/AuthorProfile.tsx` (bibliography-first, modeled on `PublicProfileView.tsx` conventions). Bridge: nullable `authors.user_id` — future student contributors with LMS accounts get automatic cross-linking to `/profile/[studentId]` (which already surfaces published papers). Brayden's author page does **not** require a `users` row (open question §26.3). Multiple authors later = more rows + `?author=` filter; no rebuild.

## 16. Connection to BOW lessons and simulations

Use the two shipped seams, add one column:
1. Glossary auto-linking already runs on all article bodies (kind-agnostic — verify in tests, no code change).
2. **Companion content**: new nullable `articles.companion_of_article_id`; a teaching note (desk format `teaching-note`, kind `method-note`) renders a "Classroom companion" banner on both pieces. Lesson-side links curated manually in `lib/lessons.ts` (matches existing curriculum authoring model). Professional pages never inline childrens' content — companions are separate linked pieces, per brief.
3. Rename `components/selfpaced/FrontOfficeLab.tsx` → `AssumptionsExercise.tsx` (collision cleanup; component behavior unchanged).

## 17. Data, code, and citation standards

- **Sources**: `articles.sources` JSON rendered by `SourcesList.tsx`; chart-level `FigureSource` labels; dataset descriptions and cleaning/exclusion notes belong in the Data section heading (convention doc).
- **Provenance already exists**: `lib/nba.ts` `getDataProvenance()` + `/analytics/methods` disclose the curated-CSV + nightly-ingest reality; keep extending honestly (no false reproducibility claims; the 178-player scope is stated).
- **Code/notebooks**: link out via `sources` (Colab/GitHub URLs); no in-site notebook hosting.
- **Distinguish** public data / derived data / proprietary-unavailable / BOW analysis / interpretation — a convention enforced by the checklist ("data sources cited", "causal language justified"), documented in `research/11-lab-authoring-conventions.md`.
- **Citations**: footnote grammar + `SuggestedCitation` (§6, §7). BibTeX deferred (per brief, must not delay launch). Last-updated dates from the existing revision system; revision notes = revision history (already capped/rollback-able).
- **SEO/structured data**: extend `app/sitemap.ts` with new routes; add JSON-LD `ScholarlyArticle`/`Article` to article pages and `Person` to `/analytics/about` (first structured data in repo; simple `<script type="application/ld+json">` in server components); OG images via existing `next/og` pattern (`runtime = "nodejs"`).

## 18. Research-quality standards

The methodology prompt list (sample size, selection/survivorship bias, confounding, overfitting, leakage, time-based validation, baselines, uncertainty, calibration, correlation-vs-causation, generalizability) lives in `research/11-lab-authoring-conventions.md` as the authoring prompt, surfaced three ways: (1) the editor checklist (§7), (2) a per-piece "Methodology panel" — the collapsible drawer in paper rendering, (3) `/analytics/methods` public standards page. No formal approval workflow. Model claims route to model pages (versioned, with appropriate/inappropriate-uses fields) so articles cite models rather than re-arguing them.

## 19. Recommended first flagship project

**"The Same Contract, Four Different Prices" — Contract Surplus Value in the Apron Era** (Candidate D; already staged as `desk-same-contract-four-prices` at `lib/desk.ts:289`, status `researching`; opens territory T1 from `research/09`).
- **Research question**: Does the 2023 CBA's apron regime make identical player production worth systematically different amounts depending on team cap position — and do front offices behave as if they know it?
- **Front-office decision supported**: trade/re-sign/extend valuation under apron constraints — the live decision every front office currently faces.
- **Dataset**: existing `contracts.csv` (apron status per team) + `stats-snapshot.csv`. **Zero new data acquisition for the opener.**
- **Methodology**: reprice 3–4 case-study contracts across all 30 team contexts using the shipped `buildTradeAnalysis` (`lib/intelligence.ts`); AASV's apron multipliers are the natural-experiment instrument; sensitivity sweep across lenses.
- **Statistical difficulty**: low for the opener (shipped pure functions), rising through the series — right for a first piece that must ship well.
- **Charts**: 30-team repricing strip (`SmallMultiples` composition — the figure system's first real test), verdict-spread scatter (`RegressionScatter`), sortable repricing table.
- **Interactive**: pick-a-player/see-the-spread + assumption sliders (reuses `SliderPanel`/`useAssumptions`; zero new interaction primitives).
- **Structure**: Docket File / analytical article (not full paper) with `<DecisionLayer/>`; the territory's eventual synthesis ("Do the Lenses Know Something the Market Doesn't?" — `research/09` piece #9, graded against actual signings) becomes the full Research Paper at the offseason window.
- **Risks**: apron topic gets crowded in 12–24 months (ship fast; the moat is the live machine, not the topic); AASV's `dollarsPerWin` sensitivity (addressed by `research/09` piece #5, a Method Memo).
- **Why best first piece**: needs no new infrastructure or data, is already staged on the desk, demonstrates the entire Lab thesis (live, adjustable, on-the-record) in one shareable piece, and opens a multi-year series rather than a one-off.

## 20. Alternative launch projects considered

| | A. Player value framework | B. Draft outcomes | C. Player archetypes | **D. Apron contract value (chosen)** |
|---|---|---|---|---|
| FO importance | High but generic | High, narrow window | Medium (framing tool) | **Highest — every current transaction** |
| Originality | Low (AASV already does it) | Medium (crowded genre) | Medium | **High (under-covered territory)** |
| Data availability | Have it | **Needs whole new dataset** (draft, combine, outcomes) | Needs style/role features not in data | **Have it fully** |
| Difficulty | Low (not new research) | High (survivorship, small samples) | Medium (feature engineering) | Medium (framing is the work) |
| Time to first piece | n/a | Weeks of data build first | Medium-long | **~8 hrs (per research/09)** |
| Viz potential | Scatter (already homepage) | Outcome bands | Cluster multiples | **High: repricing strip, mutual-gain matrix** |
| Genericness risk | High | Medium | Medium | **Low** |
| Series expansion | Poor | Good but data-hungry | Good | **Excellent (T1→T2/T5, years scoped)** |

B and C remain strong second-year candidates once backfill/feature data exists; A is rejected as restating the shipped product.

## 21. Technical architecture

**Postgres migration (Phase 1, gates everything):**
- **Stack: Neon serverless Postgres + raw `pg`** (one new runtime dep). No ORM: all ~30 `lib/*` consumers already write raw SQL through the single `getDb()` choke point; Drizzle would mean rewriting every query into a DSL for no gain; `@vercel/postgres` adds lock-in over plain `pg` + `DATABASE_URL`. Neon gives free tier + branch-per-dev.
- **Adapter strategy**: replace `DatabaseSync` in `lib/db.ts` with a `pg.Pool` wrapped in a thin adapter **method-compatible with existing call sites** (`.prepare(sql).run/.get/.all`) — call sites unchanged; SQL strings need per-file dialect review (`?`→`$n`, autoincrement→`SERIAL`/`BIGSERIAL`, `datetime('now')`→`now()`, `ON CONFLICT` mostly compatible). Note: the sync→async boundary is the main leak risk — the adapter methods become async; consumers already run in async server contexts, but each call site needs an `await` added (mechanical, reviewable).
- **Order**: (a) `articles`/`article_revisions` (highest value, blob-mirrored today — proves pattern), (b) ledger snapshots (`ledger_snapshots(payload JSONB)`), (c) NBA tables (CSV self-healing stays for these), (d) new Lab tables Postgres-native, (e) LMS tables last in one pass.
- **Seeding**: explicit `npm run db:migrate` / `db:seed` scripts replace seed-on-boot, except CSV-derived NBA tables keep the boot-time is-empty self-heal check.
- **Local dev**: Neon branch per dev via `DATABASE_URL` (no Docker, no dual SQLite path kept alive). **Cutover safety**: temporary `DB_DRIVER` flag during steps (a)–(c) only + `scripts/parity-check.ts` (row counts + sample hashes) before the flag and SQLite adapter are deleted.
- **Blob-mirror fate**: stop per-write mirroring in `app/actions/articles.ts` a commit *after* Postgres confidence is established; optionally repurpose as a nightly JSON export backup cron.
- **Runtime**: everything DB-touching stays `runtime = "nodejs"` and `force-dynamic` (unchanged); enabling Cache Components/`use cache` is deliberately deferred to post-launch polish, not bundled with the migration.
- **Env**: `DATABASE_URL` (+ keep `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN` legacy). Update `.env.example`.

**Everything else** (content model §6, embeds, figures §12, routes §5) rides on existing conventions: server pages awaiting Promise `params`, inline styles + tokens, `"use client"` leaves, server actions for mutations (new `app/actions/desk.ts` mirrors `articles.ts` patterns), proxy.ts additions only if new admin surfaces appear (editor already covered by `/analytics/admin` guard).

**Telemetry**: `@vercel/analytics`, `<Analytics/>` in root layout. Events (client-side from existing hooks): `lens_switched`, `assumption_slider_moved` (debounced), `clip_captured`, `notebook_draft_compiled`, `figure_scroll_step`, `decision_layer_viewed` (IntersectionObserver — did readers reach the conclusion?), `methodology_opened`, `citation_copied`, `source_link_clicked`. Answers the brief's questions (which papers read, charts explored, conclusions reached, methods opened) without building anything custom.

## 22. Proposed file and folder structure (new/modified)

```
lib/
  db.ts                          # MODIFIED — pg.Pool adapter (async), replaces node:sqlite
  articles-shared.ts             # MODIFIED — ArticleKind union + new Article fields
  markdown.ts                    # MODIFIED — footnotes + 4 new embed names
  desk.ts                        # MODIFIED — static array removed; same helper signatures, DB-backed
  citation.ts                    # NEW — formatCitation()
  comparables.ts                 # NEW — nearest-neighbor comparables (pure)
  publication-checklist.ts       # NEW — checkArticle(kind, blocks) (pure)
  models.ts, research-projects.ts, research-series.ts, authors.ts   # NEW — server reads
components/analytics/
  SourcesList.tsx, SuggestedCitation.tsx, AuthorProfile.tsx          # NEW
  embeds/DecisionLayer.tsx, ModelCard.tsx, PercentileChart.tsx       # NEW
  figures/RegressionScatter.tsx, Histogram.tsx, AgingCurve.tsx,
          SmallMultiples.tsx, SortableResearchTable.tsx, Annotation.tsx,
          FigureCaption.tsx, StaticFigure.tsx, ScrollFigure.tsx      # NEW
components/selfpaced/AssumptionsExercise.tsx   # RENAMED from FrontOfficeLab.tsx
app/(marketing)/analytics/
  page.tsx                       # MODIFIED — work-first landing (§8)
  desk/[id]/page.tsx, projects/page.tsx, projects/[slug]/page.tsx,
  series/[slug]/page.tsx, models/[slug]/page.tsx, about/page.tsx     # NEW
app/analytics/admin/…            # MODIFIED — kind forms, checklist sidebar, schedule field
app/actions/desk.ts              # NEW — desk server actions
app/api/cron/publish-scheduled/route.ts   # NEW (+ vercel.json cron entry)
styles/print.css                 # NEW (imported from globals.css)
scripts/migrate-to-postgres.ts, scripts/parity-check.ts              # NEW (migration tooling)
research/11-lab-authoring-conventions.md   # NEW — heading sets per kind, checklist rules, quality prompts
lib/site.ts                      # MODIFIED — NAV label + FOOTER_COLS (pending Brayden's OK)
app/sitemap.ts                   # MODIFIED — new routes
tests/ (vitest)                  # NEW — see §24
```

## 23. Performance and accessibility plan

- **Bundle/lazy**: `next/dynamic` (first in repo) for `ScrollFigure` + heavy figures, loading fallback = static twin (no spinner, no layout shift). `Suspense` boundaries around figure-heavy sections only.
- **Data size**: 178-player pool needs no virtualization; document soft caps in figure file headers (≤500 points before windowing).
- **Static behavior**: no-JS/print renders complete static twins; nothing essential is JS-only. OG images continue via `next/og`.
- **Mobile**: figures use viewBox scaling (existing convention); `ScrollFigure` collapses to inline-per-step; tables scroll in their own container.
- **Accessibility**: keyboard-navigable data points (house pattern), aria-labels or visually-hidden table twins for claim-bearing figures, hatch patterns for confidence bands (CVD), `prefers-reduced-motion` respected (jump cuts), labels never color-only.
- **Rendering**: routes stay `force-dynamic` (per-request Postgres reads) at launch; selective `use cache`/static shells deferred to post-launch (deliberate, documented).

## 24. Testing strategy

Add **`vitest`** (dev dep; watch mode + TS/ESM out of the box). Scope minimally to pure logic:
- `lib/markdown.ts`: regression tests for all 9 existing embeds before touching the regex; footnote round-trips; new shortcode attr extraction; `linkGlossaryTerms` scope unchanged. (Protects the editor live-preview round-trip contract — research/08 invariant.)
- `lib/tensions.ts`: determinism (same input → same IDs/heat) — breaking deterministic IDs orphans notebooks.
- `lib/aasv.ts`: golden-value tests for `valuate()`/`normalizeAssumptions()`.
- `lib/citation.ts`, `lib/publication-checklist.ts`, `lib/comparables.ts`: unit tests.
- Migration: `scripts/parity-check.ts` (row counts + content hashes SQLite vs Postgres) run before each cutover group; archived after.
- Not tested: page components/rendering (manual QA + `npm run build` + smoke of publish/edit/restore flows). No CI exists; optionally add a single GitHub Action running `lint` + `vitest` + `build` (small, high value — first `.github/` in repo).

## 25. Phased implementation sequence

**Phase 0 — Conventions & naming (≈1 wk, docs only).** Objective: lock decisions. Deliver `research/11-lab-authoring-conventions.md`; decide NAV rename; rename `FrontOfficeLab.tsx` component. User-visible: nav label (if approved). Dependencies: none. Risks: none. DoD: conventions merged, collision gone. Ships independently: yes.

**Phase 1 — Postgres migration (≈2–3 wks; the gate).** Objective: durable persistence. User-visible: none directly (articles/ledger survive redeploys — precondition for "on the record"). Affected: `lib/db.ts` + per-file SQL review across `lib/*`/`app/actions/*`; scripts. Data: Neon project, `DATABASE_URL`. Testing: parity script per table group; publish/edit/restore smoke. Risks: dialect translation, sync→async adapter leaks. DoD: `node:sqlite` gone, article survives cold start, build green. Ships independently: yes — must precede all else.

**Phase 2 — Desk persistence + research/10 backlog (≈1–2 wks).** Objective: close the 5 scoped items. User-visible: `/analytics/desk/[id]`, published-piece "from the desk" strips, residue on ledger, signal→assignment action. Affected: `lib/desk.ts` (same helper signatures), `app/actions/desk.ts`, desk pages. Data: `desk_assignments` seeded from the array. Dependencies: Phase 1. DoD: board reads Postgres, all 5 items live. Ships independently: yes.

**Phase 3 — Content model extension (≈2 wks).** Objective: new kinds, citations, footnotes, checklist, scheduled publishing, print. User-visible: editor creates all 7 kinds; published pieces show sources/citation/footnotes; print works. Affected: `articles-shared.ts`, `markdown.ts`, `ArticleEditor.tsx`, `MarkdownView.tsx`, article page, new components, `authors`/`research_series` tables, publish-scheduled cron. Dependencies: Phase 1. Testing: parser suite green (round-trip contract). DoD: one real piece published as `research-paper` with footnotes + sources + DecisionLayer. Ships independently: yes.

**Phase 4 — Figure system (≈2–3 wks).** Objective: reusable figure inventory + scrollytelling primitive. User-visible: new figures usable; static/print fallbacks. Affected: `components/analytics/figures/*`, embed additions, first `next/dynamic`/`Suspense` usage. Data: none new. Dependencies: Phase 3 (embed grammar pattern). Risks: scrollytelling scope creep — ship `ScrollFigure` for exactly one piece initially. DoD: inventory complete, a11y pass done, no-JS renders verified. Ships independently: yes.

**Phase 5 — New routes: projects, series, models, about, landing rework (≈2 wks).** Objective: complete the public IA. User-visible: all 5 routes + work-first landing. Affected: new pages, `sitemap.ts`, sub-nav in analytics layout. Data: seed AASV model page, Brayden author row, T1 series row, ≥1 real project. Dependencies: Phases 1, 3. Risks: fake-data temptation — empty states must be honest (house invariant). DoD: routes live with real content. Ships independently: yes.

**Phase 6 — Flagship publication (≈1–2 wks, writing not engineering).** Objective: prove the system end-to-end. User-visible: "The Same Contract, Four Different Prices" live — 30-team repricing strip, DecisionLayer, sources, citation, tagged to T1 series, linked from desk assignment and landing lead slot. Content is Brayden's writing (house invariant: no AI-generated prose). Dependencies: all prior. DoD: published, checklist green, slider event firing. This is the finish line.

**Phase 7 — Telemetry & polish (3–5 days; parallelizable after Phase 0).** Objective: Vercel Analytics + events (§21), JSON-LD, print QA. DoD: named events visible in dashboard.

Later (post-plan, volume-gated): additional contributors (authors rows + submitted-queue already exist), more models, curriculum authoring UI (separate initiative), Cache Components adoption, BibTeX.

## 26. Risks and open questions

1. **SQL dialect translation** across ~45 tables of hand-written SQL — biggest mechanical risk; mitigated by adapter compatibility, per-group cutover, parity script.
2. **Sync→async adapter boundary**: `node:sqlite` is synchronous, `pg` is not — every call site gains an `await`; a few synchronous helpers (e.g. `getLedgerEventsSync`) need genuine rework, not just annotation. Flag during Phase 1 review, not late.
3. **Open: `authors.user_id` for Brayden** — does he want an LMS-linked account or a standalone author page? (Plan assumes standalone.)
4. **Open: NAV rename** "Analytics"→"Research" — confirm before Phase 0 closes.
5. **Parser changes are load-bearing** — footnote/embed grammar bugs break the editor live-preview; regression tests are mandatory before merge.
6. **Neon pooling under serverless fan-out** — use the pooled connection string; verify in Phase 1.
7. **Historical data backfill** is an ongoing editorial cost for longitudinal pieces (not needed for the flagship opener).
8. **Apron territory crowding** over 12–24 months — mitigated by shipping the opener fast.

## 27. Exact acceptance criteria

- [ ] `lib/db.ts` is Postgres-backed (`pg`), `node:sqlite` import removed; an article created in the editor survives a simulated cold start against the same `DATABASE_URL`; `scripts/parity-check.ts` passed per table group before SQLite deletion.
- [ ] `DESK_ASSIGNMENTS` static array removed; `getAssignments()`/`groupByStatus()`/`deskCounts()` keep identical signatures reading `desk_assignments`; `/analytics/desk/[id]` renders a real assignment; all 5 research/10 backlog items shipped.
- [ ] `ArticleKind` includes all 7 required kinds; each creatable in the editor and renders without error; scheduled publishing flips `scheduled → published` via cron.
- [ ] `lib/markdown.ts` parses footnotes + 4 new embeds; vitest regression suite proves the 9 existing embeds unchanged; editor live-preview renders every new construct.
- [ ] A published research-paper shows: TL;DR finding, suggested citation (copyable), sources list, footnotes with back-links, `<DecisionLayer/>`, collapsible methodology, and prints cleanly (chrome hidden, static figures).
- [ ] `/analytics/models/aasv-v1` documents name, decision supported, target, features, validation, baseline, metrics, assumptions, limitations, version.
- [ ] `/analytics/projects` lists ≥1 real project using the 8-status enum; `/analytics/series/[T1-slug]` exists; `/analytics/about` renders Brayden's profile with a computed bibliography.
- [ ] ≥1 new figure live in a published piece with keyboard-navigable points and a working static no-JS/print twin; `ScrollFigure` used in exactly one piece with reduced-motion/no-JS stacking verified.
- [ ] Flagship "The Same Contract, Four Different Prices" published, tagged to T1, linked from its desk assignment, occupying the landing lead slot.
- [ ] `@vercel/analytics` installed; `lens_switched`, `clip_captured`, `decision_layer_viewed`, `citation_copied` events confirmed in dashboard.
- [ ] `app/sitemap.ts` includes all new routes; article pages emit JSON-LD.
- [ ] `npm run build` green; vitest suite green (`markdown`, `tensions`, `aasv`, `citation`, `publication-checklist`, `comparables`).
- [ ] `grep -ri "front office lab"` in code returns only the new Lab (no collision with the student sim or the renamed dashboard exercise).

## Verification

End-to-end verification per phase: run `npm install && npm run build` (must be green); after Phase 1, publish→cold-start→read an article against Neon; after Phase 3, author a test piece of each kind in the live editor and check the checklist/preview; after Phase 4, disable JS and print-preview a figure-bearing piece; after Phase 6, walk the full reader path (landing → flagship → methodology drawer → model page → author page → citation copy) and confirm telemetry events in the Vercel dashboard. `npm run lint` and the vitest suite gate every phase.
