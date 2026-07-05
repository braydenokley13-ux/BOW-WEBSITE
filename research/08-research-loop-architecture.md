# The Research Loop — Product Vision & Architecture

**Role:** this is the implementation-facing companion to the strategy documents
in this directory. Documents 01–07 asked "what could Bow's analytics become?";
this document records what was actually built in the research-platform phase,
why it's shaped that way, and exactly where a future model should extend it.
Read this before touching anything under `lib/lenses|tensions|questions|notebook*`
or `components/research/`.

---

## 1. The product thesis

Every sports site on the internet is an **answer-retrieval machine**: you
arrive with a question ("what did he average?") and leave with a number. Bow's
analytics foundation already broke from that in one crucial way — the AASV
model (`lib/aasv.ts`) makes **every assumption an explicit, reader-adjustable
input**. The research-loop phase builds the full product on top of that break:

> If assumptions are formalized, **disagreement is computable**. And computable
> disagreement is a discovery engine: the places where reasonable worldviews
> reach different verdicts are precisely the places worth researching and
> writing about.

The product is a **loop**, not a set of pages:

```
1. SEE THROUGH A LENS      adopt a named worldview; the whole site recomputes
2. GET PROVOKED            the Open Docket publishes questions the model
                           cannot settle on its own
3. CLIP EVIDENCE           any verdict/scenario/trade/team read can be frozen
                           into the notebook — numbers AND assumptions
4. BUILD THE ARGUMENT      arrange clips into supports / challenges / open
5. PUBLISH                 compile the notebook into a markdown draft with
                           live data embeds, ready for the publication editor
```

Nothing in the loop is a hand-written take. The docket is mined from the
model's own output; a "contested" badge is a computed fact; a draft's
assumptions-disclosure section is generated from what the reader actually
froze. Intellectual honesty is enforced by construction, which is the whole
brand ("the front office for the next generation").

## 2. The architecture, layer by layer

### 2.1 Contract (`lib/research-types.ts`)
Types only, plus label maps UI and engines must share. `Lens`, `LensSplit`,
`ResearchQuestion`/`QuestionKind`/`EvidenceRef`, `Clip`/`Stance`/
`NotebookState`. Everything is client-safe. **Change this file first and
everything else second** — it is the contract multiple subsystems were built
against.

### 2.2 Lenses (`lib/lenses.ts`, `components/research/useLens.ts`)
Five preset worldviews (The Consensus, The Accountant, The Ring Chaser, The
Rebuilder, The Skeptic), each a complete `Assumptions` object **inside
`ASSUMPTION_BOUNDS`** (so every preset is reachable by hand with the sliders)
plus a one-sentence philosophy in that desk's own voice.

The key design decision: **lens state is derived, never stored.** Selecting a
lens writes its assumptions into the existing `useAssumptions` sessionStorage
store; the active lens is recovered by `matchLens()` deep-equality against the
presets. Move any slider by hand and no preset matches → the UI shows "My
lens". One source of truth, zero sync bugs, and every pre-existing live
surface (dashboard, memos, embeds, trade machine) recomputes under a new
worldview with no wiring at all.

`buildLensSplit(player)` runs `classifyTier(valuate(player, lens.assumptions))`
per preset (`classifyTier` is exported from `lib/intelligence.ts` for exactly
this) and reports `contested` + `span` (tier distance between extremes).

### 2.3 The question engine (`lib/tensions.ts`, `lib/questions.ts`)
`lib/tensions.ts` is **pure and deterministic** — same `DocketInput` (players,
histories, assumptions), same questions, same ids. Seven detectors, one per
`QuestionKind`; each returns `ResearchQuestion[]` with:

- stable url-safe ids (`kind:slug`, `kind:slugA+slugB` sorted, `kind:TEAM`)
- a `question` that ends in "?" and carries a figure or a name
- `setup` (what the model sees, why it can't settle it), `method` (what would
  settle it), `heat` 0–100 (deterministic ranking), `evidence` refs

`buildDocket()` ranks by heat with a **diversity rule** (top-2 of every kind
that fired are guaranteed seats) and caps at 24 so the board reads curated.

`lib/questions.ts` is the only I/O: db reads → `buildDocket`. `getQuestionById`
falls back to re-running the single detector implied by the id's `kind:` prefix
so ids below the top-24 cap still resolve (a clipped question must never 404).

### 2.4 The notebook (`lib/notebook.ts`, `lib/notebook-draft.ts`, `components/research/useNotebook.ts`)
localStorage (`bow-notebook-v1`), same `useSyncExternalStore` idiom as
`useAssumptions` but persistent across sessions. A `Clip` freezes the numbers
**and** the full assumption set and lens name at capture time, so arguments
stay honest after sliders move or the nightly ingest updates stats. Capped at
60 clips, newest kept. `parseNotebook` is tolerant of garbage (localStorage is
user-editable).

`draftFromNotebook()` compiles hypothesis + clips into markdown the
publication's own parser (`lib/markdown.ts`) understands: `## The case` /
`## The counter-case` / `## What's still open` / `## Assumptions disclosure`,
with the right live embed shortcode per clip kind (`<ContractVerdict/>`,
`<ScenarioBand/>`, `<TradeAnalysis/>`, `<TeamFlex/>`, `<PlayerCard/>`). An
empty counter-case emits a prompt to go find one — the product teaches method.

### 2.5 UI surfaces
- `components/research/ClipButton.tsx` — the universal capture affordance;
  quiet by design (mono, 1px border). Stamps assumptions + lens + route.
- `components/research/NotebookTray.tsx` — fixed pill/slide-over, mounted once
  via `app/(marketing)/analytics/layout.tsx`; hidden until the first clip.
- `/analytics/notebook` — the workbench: hypothesis bar, three stance columns,
  draft compiler with copy/download.
- `/analytics/questions` + `/analytics/questions/[id]` — the docket board and
  per-question case files (server-rendered evidence under house assumptions,
  clippable per module).
- `components/research/LensSwitcher.tsx` — the worldview rail (full + compact),
  mounted on the landing page and inside `SliderPanel` so lenses appear
  everywhere sliders do.
- `components/research/ContestedBadge.tsx` — computed "CONTESTED" marker.
- `/analytics` landing — reframed as the research desk: Worldview → Docket →
  Run the numbers → Publish, then the publication.

## 3. Invariants a future model must not break

1. **Purity boundaries.** `lib/aasv`, `lib/lenses`, `lib/tensions`,
   `lib/notebook*` are pure/client-safe; db reads live only in `lib/nba.ts`,
   `lib/questions.ts`, and friends marked "Server-only". Never import a
   server-only lib from a `"use client"` file.
2. **Deterministic docket ids.** Detector ids are part of the public URL
   space and are stored inside clips (`questionId`). Changing an id scheme
   orphans readers' notebooks and bookmarks.
3. **Lens presets stay inside `ASSUMPTION_BOUNDS`** and lens state stays
   derived (`matchLens`), not stored.
4. **Clips freeze assumptions.** Any new clippable surface must stamp the
   full assumption set + lens name at capture; any new draft section must
   keep the assumptions-disclosure honest.
5. **Embed round-trip.** Draft output must parse through `lib/markdown.ts`'s
   `EMBED_RE` (self-closing, double-quoted attrs, own line). If you add an
   embed shortcode, extend `lib/markdown.ts`, `MarkdownView`, AND
   `lib/notebook-draft.ts` together.
6. **Verdict math has one home.** Tier cutoffs live in `classifyTier`
   (`lib/intelligence.ts`) — the lens layer imports it; never re-derive tiers.

## 4. Where to extend next (ordered by leverage)

1. **New detectors** — the cheapest way to make the product feel alive. A
   detector is one pure function returning `ResearchQuestion[]` with a new
   `QuestionKind` (add to the union + label map + `DETECTORS`). Ideas with the
   data already on hand: contract-year cliff (years-remaining = 1 + production
   spike), team surplus concentration (one player carries the whole rollup),
   replacement-level arbitrage (min-salary players outproducing mid-money).
2. **Question workspaces that remember** — persist per-question notebook
   filtering (clips already carry `questionId`; the workbench doesn't filter
   by it yet).
3. **Shareable lenses** — serialize a custom assumption set into a URL param
   so a reader can publish "run the league under MY worldview" links.
   `normalizeAssumptions` already clamps untrusted input.
4. **Docket history** — snapshot `getOpenDocket()` ids nightly (cron exists in
   `vercel.json`) to show "opened / settled / reopened" motion over time; the
   docket becomes a living record of what the model used to be unsure about.
5. **Draft → editor handoff** — the workbench downloads/copies markdown today;
   an admin-only "open as draft" action could POST into the existing article
   actions (`app/actions/articles.ts`).
6. **Lens-aware article embeds** — embeds render under house assumptions
   server-side; a client wrapper could re-render them under the reader's lens
   with a "you're seeing this through {lens}" caption (the pattern exists in
   `components/analytics/embeds/LiveAssumptions.tsx`).

## 5. What was deliberately NOT built

- **No auth-gated research features.** The loop is fully anonymous
  (localStorage) because the analytics surface is public and the SQLite-on-
  Vercel persistence risk (see 07) makes server-side per-user state a trap
  until the Postgres migration happens.
- **No comments/social layer on questions.** The discussion board exists
  elsewhere in the product; bolting it onto the docket before the loop proves
  itself would blur the "research desk" feel.
- **No AI-generated prose.** Every sentence on the docket is template-built
  from computed figures. That's a feature: the site never asserts something
  the model didn't compute.
