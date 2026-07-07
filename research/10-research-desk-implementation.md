# The Research Desk — V1 Implementation Notes

**Status: BUILT.** This documents what shipped, how it works, and the exact
seams where the next model should continue. Strategy lives in `research/09`;
this is the implementation record.

## What was built

The first working slice of Bow's editorial command center — the layer that
turns model signals into editorial assignments and assignments into published
research with residue.

| Piece | File | What it is |
|---|---|---|
| Desk data layer | `lib/desk.ts` | Client-safe, pure. Content-format framework (7 formats), the `DeskAssignment` type, the V1 assignment board (typed static array), and the join helpers. |
| Desk home | `app/(marketing)/analytics/desk/page.tsx` | `/analytics/desk` — server component, `force-dynamic`. Masthead stats, live signals, the assignment board, the format portfolio, the article-to-product map, published research, pathways. |
| Entry point | `app/(marketing)/analytics/page.tsx` | One added hero link: "The research desk →". |

## How the desk works

The desk renders one loop, and every section of the page is a stage of it:

```
detector fires (lib/tensions.ts) → signal on the docket/ledger
  → editor triages it into a DeskAssignment (lib/desk.ts)
    → assignment names format + lens angle + data needs + NEXT ACTION
      → worked in the notebook, published through the existing CMS
        → residue (detector/embed/column/lens) is deposited
          → detectors see more next time
```

**Real vs. seeded, precisely:**

- **Real (live, per-request):** the Signals section — hottest docket questions
  via `getOpenDocket()`, ledger events via `getLedgerEventsSync()` +
  `summarizeLastWeek()`; the Published Research section via
  `getPublishedArticles()`; the live-question join on each assignment card
  (`resolveSignalQuestion`) which links a card to the *current* docket, exact
  question-id first, hottest question of the signal's detector kind as
  fallback.
- **Editorial state (typed static data, by design):** `DESK_ASSIGNMENTS` in
  `lib/desk.ts`. Assignments change on human triage, not per request, so a
  hand-edited typed array is the correct V1 store given the SQLite-on-Vercel
  persistence risk (research/07). Every consumer goes through
  `getAssignments()` / `groupByStatus()` / `deskCounts()`, so replacing the
  array with a database table is a one-file change.
- **Nothing else is mocked.** No fake articles, no fake ledger events; empty
  states render honest copy when an instance has no history.

## How future models add or advance an assignment

All in `lib/desk.ts`; the header comment repeats these rules.

1. **Find the signal.** A docket question id (stable `kind:key`, visible in
   `/analytics/questions/[id]` URLs), a ledger event, or an editorial call.
2. **Append a `DeskAssignment`.** Stable `desk-` id; never recycle ids.
   `signal.questionId` when you have one; otherwise `signal.kind` alone —
   the board will keep joining it to the live docket by detector kind.
3. **Pick a format** from `CONTENT_FORMATS`. If the format has
   `residueRequired: true`, the assignment's `residue` array must be
   non-empty or it shouldn't be assigned.
4. **Always fill `nextAction`** with a single physical action. If it can't be
   named, the file isn't scoped — leave status `signal`.
5. **Advance `status`** (`signal → assigned → researching → drafting →
   published`); set `articleSlug` on publish; flip residue `delivered: true`
   when the artifact actually ships. Killed files get `status: "killed"` +
   `killedBecause` and STAY in the array — refusals are part of the record.

## How to convert a signal into a piece (the working procedure)

1. Weekly triage: open `/analytics/desk`, scan Signals, pick kill / watch /
   investigate (WIP limit: 2 active + 1 flagship).
2. For "investigate": add the assignment (above) with the kill condition in
   mind, then work it through the existing loop — clip evidence in the
   notebook under ≥3 lenses, sweep `ASSUMPTION_BOUNDS`, compile with
   `draftFromNotebook()`, paste into the article editor, publish.
3. Post-publish: set `articleSlug`, deliver the residue, mark it delivered.

## Invariants this build respects (do not break)

- `lib/desk.ts` is **pure and client-safe** — it imports types only. All
  server reads (docket, ledger, articles) happen in the page and are passed
  in / joined via `resolveSignalQuestion`. Same purity contract as
  `lib/lenses.ts` (research/08 §3.1).
- Docket ids remain the join key; the desk stores them but never mints them.
- No AI-generated prose on the site: assignment copy is editorial state
  written by the editor, and the Signals section is machine-computed text
  from the existing engines.
- Existing analytics surfaces untouched except one added hero link.

## What to implement next (ordered)

1. **Assignment detail routes** — `/analytics/desk/[id]`: full file view with
   the resolved live question, its evidence embeds, and the notebook filtered
   by `questionId` (clips already carry it).
2. **Published-piece backlink** — when an article's slug matches an
   assignment's `articleSlug`, render a "from the desk" strip on the article
   page linking back to the file and its residue.
3. **Triage persistence** — after the Postgres migration (research/07),
   replace `DESK_ASSIGNMENTS` with a table + admin actions mirroring
   `app/actions/articles.ts`; keep the helper signatures identical.
4. **Signal → assignment one-click** — an admin-only "open a file" action on
   question pages that appends a scaffolded assignment.
5. **Residue ledger** — count delivered residue on the ledger page; it's the
   flywheel's primary success metric (research/09 §14).

TODO markers for smaller models are deliberately NOT scattered in code; this
list is the queue.
