# Stage 6 — Interaction expansion

Resumed from an uncommitted, partially-verified working tree (the prior
session died mid-Playwright-verification against the monthly spend limit).
This memo covers the gap-check against the plan, the bugs found and fixed
during live verification, and the verification evidence.

## 1. Gap-check against the plan (§2, §6)

The uncommitted tree already implemented essentially the full Stage 6 scope.
Checked block-by-block against `lib/learn/registry.ts` (defaults +
capabilities), `lib/learn/engine.ts` (`gradeBlock` cases), `lib/learn/validate.ts`
(publish-time rules), `components/learn/player/blockRegistry.tsx` (Player
wiring + auto-advance classification), and `components/learn/builder/inspectors/InspectorRouter.tsx`
(author-facing inspector wiring):

| Block | Registry | gradeBlock | validate rule | Player | Inspector |
|---|---|---|---|---|---|
| multi_select | yes | yes | correctOptionIds refs checked | `QuestionBlock` | `QuestionInspector.MultiSelectInspector` |
| true_false | yes | yes | — | `QuestionBlock` | `TrueFalseInspector` |
| numeric | yes | yes | — | `QuestionBlock` | `NumericInspector` |
| short_response | yes | yes | — | `QuestionBlock` | `ShortResponseInspector` |
| long_text (reflection) | yes | yes (`completion_only\|min_words\|manual_review\|keyword_rule`) | — | `QuestionBlock` | `LongTextInspector` |
| strategy_choice | yes (pre-existing type, previously player/inspector-less) | yes | effects on options checked | `StrategyChoiceBlock` | `StrategyChoiceInspector` |
| rank | yes | yes | correctOrder length/refs/dupes | `RankBlock` (dnd-kit sortable) | `RankInspector` |
| drag_drop / categorize | yes (shared component, distinct schema literals per plan §6) | yes | correctCategoryId refs | `CategorizeBlock` | `CategorizeInspector` |
| match | yes | yes | duplicate pair ids | `MatchBlock` | `MatchInspector` |
| tradeoff_matrix | yes | yes | option branch targets, criterion-key refs | `TradeoffMatrixBlock` | `TradeoffMatrixInspector` |
| forecast | yes | yes | tolerance >= 0 | `ForecastBlock` | `ForecastInspector` |
| table / chart / timeline (content) | yes, `CONTENT_CAPS`, auto-advance | n/a (content) | n/a | `ContentBlock` | `TableInspector` / `ChartInspector` / `TimelineInspector` |

Publish-time validation (`validateLessonDoc`) was extended for every new
block type's branch targets, fallthrough reachability, points-possible, and
effect/variable-ref checks — verified via `tests/learn/stage6-blocks.test.ts`
plus the adversarial cases already in `tests/learn/validate.test.ts`.
`npm run test` = **81/81 green** (68 pre-Stage-6 + 13 new).

**No gaps required new implementation.** The one gap that did need work
surfaced only during live verification (§3) rather than static review.

## 2. Composing the plan's "data interactions" from primitives

The plan (§6) names four data-interaction patterns without prescribing new
block types. Per the "no lesson-specific code" principle carried over from
Stage 4, all four are composed from the existing content + question/decision
primitives — no bespoke interaction engine. The Stage 6 seed lesson
("Draft Night Analytics", `scripts/seed-learn-demo.ts`) demonstrates each:

- **Interpret graph** — a `chart` block (bar chart of quarterly ticket
  revenue) immediately followed by a `numeric`/`multi_select` question that
  requires reading values off the same chart (`s6-chart` → `s6-numeric`).
- **Identify trend** — the same `chart` block followed by a `true_false`
  question about trend direction (`s6-trend-tf`).
- **Adjust variables** — a `slider` block bound to the `cap_space` variable
  via a `from_response` effect, with the resulting value shown afterward in
  the persistent variable HUD and on the results screen.
- **Compare scenarios** — a `tradeoff_matrix` block (criteria × options
  reference table) immediately followed by/subsuming the choice itself, so
  "compare" and "decide" are the same interaction rather than a separate
  read-only comparison step.

This keeps the block registry the single extension point (plan §3) instead
of adding graph-specific or scenario-specific runtime code.

## 3. Live verification (local Postgres, port 55432)

The Stage 4 scratch cluster had no live `bow` database (cluster present on
disk but the database itself did not exist — data dir survived, contents
didn't). Rebuilt from scratch this session:
`initdb` cluster already existed → started under the unprivileged `pguser`
account (postgres refuses to run as root) via a writable Unix-socket
directory in scratch (`/tmp/.../scratchpad/pgsock`) since `/var/run/postgresql`
wasn't writable by `pguser` → `CREATE DATABASE bow` → `scripts/dev-bootstrap.sql`
(legacy stub schema) → `npm run migrate` (5/5 migrations applied cleanly,
idempotent — 2 expected "column already exists, skipping" notices from
`001_learn_core.sql`'s `badges` alter) → seeded `admin@bow.test` /
`student@bow.test` accounts → `npm run seed:learn-demo` (seeds **both**
lessons: the Stage 4 Track 201 lesson `lesson-rivalry-ticket-pricing` and
the new Stage 6 lesson `lesson-draft-night-analytics`) → `npm run dev`.
Also restarted the documented "idle in transaction" reaper
(`scratchpad/reaper.sh`) per the known pre-existing connection-pool-exhaustion
issue noted in `docs/learn/stage4-proof.md` — without it, a burst of
Playwright actions transiently exhausted the pool and one run round-tripped
through an accidental sign-out.

### 3a. Admin authoring — 3+ new block types through Studio UI

Opened the Stage 6 seed lesson in Playbook Studio as `admin@bow.test` and
selected blocks on the canvas to confirm each renders its dedicated,
registry-driven inspector (not the generic fallback):

- **Rank** — items list, drag-to-reorder canvas preview, correct-order
  editor with per-item Up/Down, points.
- **Categorize / Drag & Drop** — shared inspector, category + item editors,
  correct-bucket assignment.
- **Match** — pair editor.
- **Tradeoff Matrix** — criteria (columns) + options (rows) grid editor,
  matching the rendered comparison table.
- **Forecast** — target value/tolerance editor.
- Palette screenshot confirms all Stage 6 block types are listed under
  Content (Table, Chart, Timeline) and Decisions (Rank, Categorize, Drag &
  Drop, Match, Tradeoff Matrix, Forecast) plus Questions (Multi-Select,
  True/False, Numeric, Short Response) and Reflection — all registry-driven,
  no palette code changes needed per block.

Screenshots: `a02-builder-open.png`, `a04-rank-inspector.png`,
`a05-categorize-inspector.png`, `a06-match-inspector.png`,
`a07-tradeoff-inspector.png` (scratch dir `stage6/`).

### 3b. Student play — expanded seed lesson end-to-end, desktop + mobile

Played "Draft Night Analytics" (all 15 blocks: heading, chart, true_false,
table, timeline, multi_select, numeric, short_response, rank, categorize,
drag_drop, match, slider, forecast, tradeoff_matrix, strategy_choice,
long_text reflection) start to finish as `student@bow.test`:

- **Desktop** (1280×900): completed cleanly, reached the results screen
  (score 56/100, 1 star, variable outcome, Replay + Continue).
- **Mobile** (390×844): same lesson, same script, completed cleanly with no
  horizontal overflow on any block including the table/chart/tradeoff-matrix
  grid layouts.

Screenshots: `d00-start.png` … `d99-final.png` (desktop),
`m00-start.png` … `m99-final.png` (mobile), plus mid-lesson captures
(`m-step5.png` = numeric question at 390px).

### 3c. Stage 5 items — never previously browser-verified

- **Variable HUD visibility toggle** (`VariablesPanel.tsx`, the `visible`
  checkbox introduced in Stage 5): opened the Variables tab, toggled the
  checkbox off/on, confirmed the DOM checked-state flips
  (`b01-variables-tab.png`, `b02-hud-toggled.png`).
- **Save now button** (`BuilderShell.tsx`): clicked it, confirmed no error
  and the save-state indicator updates (`b03-save-now-clicked.png`).
- **Results next-lesson CTA** (`results.ctaNextLessonId`): the seed lessons
  don't set this field (no author decision yet about lesson ordering — see
  Deferred below), so exercised the code path directly by setting
  `ctaNextLessonId` on the Track 201 lesson's doc, loading the results page,
  confirming the button renders as `NEXT: DRAFT NIGHT ANALYTICS` (not the
  generic "Continue" fallback), and clicking it navigates to
  `/dashboard/lesson/lesson-draft-night-analytics`. Reverted the temporary
  doc edit afterward — not a lasting change. Screenshots:
  `c01-rivalry-results-forced.png`, `c02-next-lesson-nav.png`.

## 4. Bugs found and fixed

Both are real, generic (not lesson-specific) player bugs surfaced only by
actually clicking through the UI — exactly the class of bug static
review/type-checking can't catch.

1. **`CategorizeBlock` (shared by `categorize` and `drag_drop`) — placing a
   second item into a bucket that already holds one removed the first
   instead of adding the second.** The placed-item "chip" rendered as a
   block-level `<div>` with its own `onClick` + `stopPropagation` (to
   support tap-to-remove) filling nearly the entire bucket's clickable
   area, so a tap anywhere in a non-empty bucket landed on the chip and
   removed it rather than reaching the bucket's own `onClick`
   (`placeInCategory`). Fixed by giving each chip an explicit small "×"
   remove control and stopping the chip itself from swallowing clicks —
   the rest of the bucket (including the space beside/around an existing
   chip) now correctly bubbles to the bucket's placement handler. Verified
   with an isolated repro script before and after
   (`scratchpad/stage6/debug-cat3.mjs`): before, 2 items got stuck cycling
   between placed/unplaced forever; after, both place cleanly and Submit
   enables.
   File: `components/learn/player/blocks/CategorizeBlock.tsx`.

2. **`SliderBlock` (`slider`/`price_set`) and `BudgetAllocationBlock`
   (`budget_allocation`) — locking in a decision without ever touching the
   control committed `undefined` as the response, crashing `submitResponse`
   with a Postgres not-null-constraint violation (500) instead of grading
   the displayed default value.** Both blocks render a valid default
   (slider: `defaultValue ?? min`; budget: all-zero allocation) and their
   "Lock in" buttons are enabled from the start (the range/allocation always
   has *some* valid value, unlike e.g. MC where nothing-selected correctly
   disables Submit) — but the reducer-tracked response state stayed
   `undefined` until the first `onChange`, so a student who accepted the
   default without dragging anything broke the attempt with a real 500 in
   the browser console (`[pageerror] null value in column "response" ...
   violates not-null constraint`). This reproduced on **both** the new
   Stage 6 lesson (slider) and the existing Stage 4 Track 201 lesson
   (budget_allocation) — a pre-existing defect, not one introduced by Stage
   6, just first exercised by this round of end-to-end play. Fixed by
   seeding the reducer's response with the displayed default on mount via
   `useEffect` in both components, so "lock in the default" is always a
   valid, gradeable response.
   Files: `components/learn/player/blocks/SliderBlock.tsx`,
   `components/learn/player/blocks/BudgetAllocationBlock.tsx`.

Both fixes are generic component fixes, not new features or lesson-specific
workarounds. `npm run test` stayed 81/81 and `tsc --noEmit` clean throughout.

## 5. Deferred

- No `ctaNextLessonId` is set on either seed lesson by default — deliberately
  left for whoever builds Stage 7's map/sequencing UI to decide lesson
  order, rather than hardcoding an ad hoc "next" here. The code path is
  verified working (§3c).
- `training_session_registrations` relation-does-not-exist console errors
  appeared on `/app/admin` and `/app/student` during this session's local
  verification — confirmed pre-existing/unrelated to Learn (a legacy table
  `scripts/dev-bootstrap.sql` doesn't stub, same class of issue
  `docs/learn/stage4-proof.md` already flagged for other legacy tables). Not
  touched; out of Stage 6 scope.
- Stages 7–11 (student home/progression, cohort parity, achievements,
  curriculum migration, cutover) remain per the plan.

## 6. Verification summary

- `npm run test`: **81/81 green**.
- `tsc --noEmit`: clean.
- `eslint` on all touched/new files: 0 errors (1 pre-existing warning,
  unrelated to Stage 6, on an intentionally-unused `_path` parameter in
  `lib/learn/engine.ts`).
- `git diff --stat` confirms Highway World (`app/(marketing)/highway-world/page.tsx`,
  `lib/highway.ts`) untouched.
- Live Playwright verification: admin authoring (3+ new block types),
  student play-through desktop + mobile (full 15-block lesson, 0 uncaught
  errors after fixes), Stage 5 HUD toggle / Save now / next-lesson CTA all
  click-verified.
