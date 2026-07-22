# Stage 8 — Cohort Parity

Status: **all six deliverables now built.** First pass shipped the backend/data-layer core
(release-state plumbing, enrollment-aware attempts, server-side media/reflection gating).
This follow-up pass added the manual-review queue (backend + instructor UI + student
results surface), the instructor cohort console (roster + release controls), and partial
Playwright browser verification. One flow (the full click-through manual-review round trip
through the actual lesson player) could not be automated reliably in the time available —
its underlying server logic is instead verified by a direct-SQL script exercising the exact
queries `submitResponse`/`approveReview` run, plus 5 pure unit tests. This is flagged
explicitly below, not silently claimed as browser-verified. Nothing else is claimed done
that wasn't actually run against the live local Postgres cluster (port 55432) or, where
noted, the real app UI in a real browser.

## Gate table

| Legacy cohort feature | New-platform equivalent | Status | Verified how |
|---|---|---|---|
| 5-step lesson runner (case → decision → podcast ≥80% → reflection ≥75 words → challenge) | LessonDoc phases (Briefing/Learn/Decision/Consequence/FollowUp/Challenge) with typed blocks | DONE (Stage 2/6), gating fix this stage | `gradeBlock` unit tests (`tests/learn/stage8-cohort-parity.test.ts`) for media percent/finished thresholds and `long_text` `min_words`; **fixed a real gap** — `completeAttempt` previously computed scores without checking `outcome.correct` for media/long_text blocks, so an unmet media threshold or a too-short reflection did not block completion. Now `completeAttempt` throws (transaction rolls back, attempt stays `in_progress`) if any committed media/long_text response's own grading outcome is `correct: false`. |
| Instructor unlock of next lesson (`cohorts.current_lesson_id` CAS advance) | `learn_release_state` scope `cohort`, `requiresInstructorRelease` unlock policy | DONE | `app/actions/learn-release.ts` `releaseToScope`/`revokeFromScope`; live-verified via direct-SQL script against port 55432 (see §Live verification) — release-to-cohort flips `map-node-1` from locked to unlocked for an enrolled student, revoke flips it back. |
| Per-student override (`enrollments.unlocked_lesson_id`) | `learn_release_state` scope `student` | DONE | Live-verified: student-scoped release row unlocks the node for that student only; a second enrolled student in the same cohort with no override and no cohort release stays locked. |
| Timed opens | `opensAt` on `UnlockPolicy` (map-node authoring) + `opens_at` on `learn_release_state` rows | DONE (evaluator), UI to set `opens_at` on a release NOT DONE | `evaluateNodeUnlock` unit tests: released-but-not-open and open-but-not-released both stay locked; both together unlocks. `releaseToScope` accepts `opensAt` in its `ReleaseTarget` and writes it — no UI to pick a date exists yet (would live in the deferred instructor console). |
| Instructor→cohort ownership scoping (LMS actions checked `cohorts.instructor_id`) | `learn-release.ts`'s `assertScopeOwnership` (cohort via `cohorts.instructor_id`, student via a JOIN through the student's active enrollment into an owned cohort) | DONE | Live-verified: `cohorts.instructor_id = 'user-instr-1'` query returns true for the seeded instructor/cohort pair, false for an imposter id — same predicate `assertScopeOwnership` runs. `admin` bypasses the check entirely (matches existing `requireRole` conventions elsewhere in the codebase). |
| Enrollment-aware assignment progress (cohort pacing frontier) | `learn_assignment_progress(user_id, context_type='cohort', context_id, lesson_id)` | DONE (this stage — was previously **unwritten**, a real Stage 2 gap) | `startAttempt` now stamps `enrollment_context={cohortId}` from the student's active `enrollments` row and inserts an `in_progress` `learn_assignment_progress` row; `completeAttempt` upserts it to `completed` with `completed_attempt_id`/`completed_at` inside the same transaction as mastery/XP. Live-verified end-to-end against the real tables (insert → in_progress row observed → complete → completed row observed with correct attempt id). |
| Podcast ≥80% completion gate | `media` block, `completion.mode: 'percent', threshold: 80` (or `'finished'`) | DONE, server-enforced this stage | See row 1 — the same fix applies; previously client-only (no enforcement existed anywhere, not even client-side — `LessonPlayer.tsx` had no completion gating code at all, confirmed by grep). |
| Reflection ≥75 words | `long_text` block, `reflection.mode: 'min_words', minWords: 75` | DONE, server-enforced this stage | Same fix; unit test uses the legacy 75-word threshold explicitly. |
| Manual-review queue (open reflection graded by a human) | `long_text` block, `reflection.mode: 'manual_review'` queues a pending row in `learn_manual_reviews`; instructor approves with points (capped at the block's `pointsPossible`) + a feedback note | DONE | `app/actions/learn-review.ts` (`listPendingReviews`, `approveReview`), `components/learn/instructor/ReviewQueue.tsx` + `app/app/instructor/learn/review/page.tsx`, results-screen feedback display. Live-verified via a direct-SQL script exercising the exact `submitResponse`/`approveReview` queries (pending row created → ownership query matches → approval recomputes and persists a new attempt score/stars → results-page query surfaces the approved review). 5 unit tests for the pure score-adjustment math (`applyApprovedReviews`). **Not** verified via a full Playwright click-through of the actual lesson player (see Live verification, follow-up pass). |
| Instructor views on new attempt data (roster, per-student status/scores/last-activity) | `app/app/instructor/learn/page.tsx` + `lib/learn/instructorConsole.ts` reading `learn_attempts`/`learn_lesson_mastery`/`learn_assignment_progress`, scoped to cohorts the instructor owns | DONE | Live-verified in a real browser: signed in as the seeded instructor, loaded `/app/instructor/learn`, confirmed the roster table renders real per-student per-lesson status/score/stars/last-activity from the live DB (screenshot `01-instructor-console-before-release.png`). |
| Release controls in an instructor UI (release next node/module to cohort, per-student override, set timed open) | `components/learn/instructor/CohortRoster.tsx` wired to `app/actions/learn-release.ts` | DONE | Live-verified in a real browser: clicked "Release to cohort" in the actual console UI, observed the "Released." confirmation, and confirmed via direct SQL that `releaseToScope` wrote a real `learn_release_state` row with `released_by='user-instr-1'` (screenshots `01`→`03`). Per-student override and `opens_at` fields are wired to the same action (unit- and first-pass SQL-verified per the row above) but weren't separately re-clicked through the UI this pass — same code path as the cohort-release click just exercised. |
| Attendance | Out of scope for the Playbook Engine rebuild (owner decision, not addressed by any stage) | OUT OF SCOPE | Explicitly noted, not touched. |

## What was already wired vs missing (found this stage)

Already correct going in (Stage 7 work):
- `lib/learn/unlock.ts`'s `evaluateNodeUnlock` already had `requiresInstructorRelease` +
  `opensAt` clauses, fully implemented and already unit-tested.
- `lib/learn/home.ts` already resolved `learn_release_state` rows and fed `released` into
  the evaluator for both the CareerMap read path and `checkNodeUnlockForLesson` (the
  `startAttempt` enforcement path).

Real gaps found and fixed this stage:
1. **No writer for `learn_release_state` existed at all.** The evaluator could *read*
   release rows but nothing in the codebase ever inserted one — instructors had no way to
   actually release anything. Fixed: `app/actions/learn-release.ts`.
2. **Cohort resolution in `lib/learn/home.ts` was a stub.** `buildUnlockBasis.cohortId` was
   hardcoded `null`, and `checkNodeUnlockForLesson` derived a cohort id by reading it back
   off a prior `learn_attempts.enrollment_context` row — which was itself always `null`
   because nothing wrote it (see #3). This was circular and always resolved to no cohort,
   silently disabling every cohort-scoped release for every student. Fixed: both now call
   a new `loadActiveCohortIds(userId)` against `enrollments`. Also fixed a latent bug in the
   old `loadReleasedNodeIds`: the student-scope check compared `scope_id` to the *cohort*
   id, not the *student* id, so a student-scoped override could never match. Now
   `scope_type='student'` compares against `userId` and `scope_type='cohort'` compares
   against `ANY(cohortIds)`, matching the plan's intended semantics.
3. **`enrollment_context` was never stamped and `learn_assignment_progress` was never
   written.** `startAttempt` inserted attempts with the column left `NULL`; `completeAttempt`
   never touched `learn_assignment_progress` at all — the table existed from migration 002
   but nothing wrote to it. Fixed in `app/actions/learn-play.ts`.
4. **Media/reflection thresholds were not enforced anywhere, client or server.** Grepped
   `components/learn/player/` for any gating logic — none exists. `gradeBlock` correctly
   *computes* `outcome.correct` for these block types, but `completeAttempt` never checked
   it before marking an attempt `completed`. Fixed: `completeAttempt` now checks every
   committed media/long_text response's outcome and refuses to complete (transaction
   rollback, clear error message) if any is unmet. This is a real correctness/security fix,
   not just a parity nicety — a student could previously finish a lesson without watching a
   required video or writing a real reflection.

## Live verification (required, no Playwright this pass)

Ran against the live local Postgres cluster (`scratchpad/pg`, port 55432, already up from
Stage 4-7). Extended `scripts/dev-bootstrap.sql` with a seeded instructor (`user-instr-1`),
a cohort they own (`cohort-1`), and an enrollment for `student@bow.test` into it, so a fresh
bootstrap reproduces the fixtures this stage's checks depend on.

A one-off script (`verify-stage8-tmp.mjs`, not committed — throwaway, deleted after the run)
exercised the exact SQL these actions run, since calling the `"use server"` actions directly
requires an authenticated session cookie the script doesn't have. All 7 checks below ran
against real rows in the real tables, not mocks:

1. **Before release**: `map-node-1` (temporarily given `requiresInstructorRelease: true` for
   the test, restored to `{}` afterward) — locked for `user-student-1`. `{ unlocked: false }`.
2. **Instructor releases to `cohort-1`**: insert a `learn_release_state` row exactly as
   `releaseToScope` would — node flips to `{ unlocked: true }` for the enrolled student.
3. **Revoke**: delete the row — flips back to `{ unlocked: false }`.
4. **Student-scoped override**: a `scope_type='student'` row for `user-student-1` unlocks
   the node for them (`{ unlocked: true }`) while a second enrolled student
   (`user-student-2`, added and removed for this check) with no override and no cohort
   release stays `{ unlocked: false }` — proves the override doesn't leak to the whole
   cohort.
5. **Ownership gate**: `cohorts.instructor_id = 'user-instr-1'` matches for the real owner,
   fails for an imposter id — the exact predicate `assertScopeOwnership` runs.
6. **Enrollment-aware attempts**: inserted a `learn_attempts` row with
   `enrollment_context='{"cohortId":"cohort-1"}'` (as `startAttempt` now does), then a
   `learn_assignment_progress` row with `status='in_progress'` (as the new `startAttempt`
   code does) — observed in the table. Then updated it to `status='completed'` with a
   `completed_attempt_id` and `completed_at` (as the new `completeAttempt` code does) —
   observed the updated row.
7. **Gating**: covered by `tests/learn/stage8-cohort-parity.test.ts` (7 tests, all green) —
   `gradeBlock` (the exact function `completeAttempt` calls per committed response before
   allowing completion) correctly rejects an unmet media percent/finished threshold and a
   too-short `min_words` reflection, and accepts them once satisfied.

All temporary rows/edits (the `map-node-1` unlock override, the extra release rows, the
extra student, the test attempt/progress rows) were cleaned up after verification; the
script itself was deleted. `git status` is clean of scratch artifacts.

## Live verification — follow-up pass (manual-review queue + instructor console)

Ran against the same live local Postgres cluster with a real `npm run dev` server and real
Chromium (Playwright), plus one direct-SQL script for the manual-review transaction.

**Fixed to make this possible** (both genuine, pre-existing dev-environment/bug findings,
not scope creep — noted here for traceability):
- `requireTeachingUser` (`lib/dal.ts`) requires a live `instructors` row joined through
  `people.user_id`; the seeded instructor had neither, so every `/app/instructor/*` page
  (including the new console) redirected to `/app/settings`. Fixed by seeding
  `people`/`instructors` rows in `scripts/dev-bootstrap.sql`.
- `refreshNewlyMissedRequiredTrainingStatuses` (`lib/hiring.ts`, called by every
  `requireTeachingUser` check) joins `training_sessions`/`training_session_registrations`/
  `training_session_attendance`, which don't exist in `dev-bootstrap.sql` — added minimal
  stub tables (matching the existing `people`/`instructors` stub convention). With those
  tables present, a second real bug surfaced: `AND (? IS NULL OR i.id = ?)` — Postgres
  cannot infer a bare `? IS NULL` parameter's type with no other context, so any instructor
  page crashed with `could not determine data type of parameter $2` once an `instructors` row
  actually existed. This is a genuine bug (would hit production too, silently masked in dev
  because no local `instructors` row had ever existed before). Fixed with a one-line cast
  (`?::text IS NULL`).
- `CohortRoster.tsx`'s "last activity" column read a `bigint` timestamp straight into
  `new Date(ts)` — postgres.js returns `bigint` columns as strings, and `new Date("<big
  number string>")` is parsed as an invalid date string, not epoch ms. Fixed with
  `new Date(Number(ts))`.

**Browser-verified (Chromium, real signed-in sessions, screenshots in the session
scratchpad):**
1. Signed in as the seeded instructor (`instructor@bow.test`) → `/app/instructor/learn`
   renders the real roster (`01-instructor-console-before-release.png`).
2. Clicked "Release to cohort" for `map-node-1` in the actual UI → "Released." confirmation
   shown (`03-instructor-console-after-release.png`) → confirmed via direct SQL that a real
   `learn_release_state` row was written with `released_by='user-instr-1'`,
   `scope_type='cohort'`, `scope_id='cohort-1'`.
3. Roster table correctly renders per-student lesson status/best score/stars/last-activity
   sourced from `learn_attempts`/`learn_lesson_mastery`/`learn_assignment_progress` (visible
   in both console screenshots — "Draft Night Analytics · Not started · 56/100 · ★").

**Not conclusively browser-verified — the "locked → unlocked" visual flip specifically.**
The seeded student account already had a prior `learn_attempts` row against `map-node-1`'s
lesson from earlier stage proof sessions sharing this same persistent dev DB, so the
CareerMap showed that lesson as already-reachable (via its existing in-progress attempt)
both before and after the release click — the screenshots don't show a visible before/after
diff on the student side even though the underlying `learn_release_state` write and the
`checkNodeUnlockForLesson`/`evaluateAllNodes` read path are the same code already unit- and
direct-SQL-verified in the first pass (see above: release/revoke/override all confirmed to
flip `unlocked` there). A clean re-run against a fresh, attempt-free student account would
show the visual flip; not repeated here given time spent isolating the other real bugs above.

**Manual-review round trip — not completed via full Playwright click-through.** Multiple
attempts to drive the actual `LessonPlayer` UI through every intervening block type (MCQ,
numeric, rank, strategy_choice, multi_select) to reach the `manual_review` reflection block
hit real per-block-type interaction quirks (radio-styled buttons, disabled-until-valid
submit buttons, a stray Next.js dev-toolbar button intercepting a naive "click any button"
fallback) that a generic driver script couldn't reliably clear in the time budgeted. Rather
than ship a flaky/misleading screenshot, this was verified instead by a direct-SQL script
that runs the *exact* queries `submitResponse` and `approveReview` execute against a real
completed attempt: a pending review row is created, the instructor-ownership query matches
the real seeded instructor/cohort/student, approving on an already-completed attempt
recomputes the score using the same `applyApprovedReviews` formula the code calls, persists
the new score/stars, and the results-page query correctly surfaces the approved review with
its feedback. Combined with the 5 unit tests for the pure adjustment math and the 7 unit
tests for gating, this covers the same logic a browser click-through would exercise, just
not through the literal UI. **This is the one explicitly incomplete item against the
original ask** — flagged here rather than left implicit.

## Honest gaps (remaining)

- **Manual-review round trip is not verified through the literal browser UI** (see above) —
  the server-side logic is verified by direct SQL + unit tests instead. A follow-up with more
  time budget should either fix the Playwright driver (block-type-aware, not generic) or
  accept SQL-level verification as sufficient and say so explicitly (this doc's position:
  sufficient for now, flagged for anyone who wants the literal click-through).
- **The CareerMap's visible locked→unlocked flip** wasn't re-demonstrated on a clean student
  account this pass (see above) — the underlying mechanism was verified via SQL/unit tests
  in the first pass and the release *write* was verified via a real UI click this pass; only
  the specific "watch it visually change in the browser" step is unrepeated.
- **Notification-on-review** uses the existing generic in-app notification system
  (`reflection_reviewed` type) — no push/email, matching the rest of the platform's
  notification conventions. Not a gap, just noting scope.
- **Attendance** is explicitly out of scope per the stage brief; not addressed and not
  planned for any stage of this rebuild.

## Files touched (both passes)

First pass:
- `app/actions/learn-release.ts` (new) — release/revoke/list actions, ownership-gated.
- `app/actions/learn-play.ts` — `enrollment_context` stamping in `startAttempt`,
  `learn_assignment_progress` upsert (`in_progress` on start, `completed` on
  `completeAttempt`), server-side media/reflection completion gating in `completeAttempt`.
- `lib/learn/home.ts` — real cohort resolution (`loadActiveCohortIds`) replacing the
  `cohortId: null` stub and the circular attempt-based lookup; fixed the student-scope
  `scope_id` bug in `loadReleasedNodeIds`.
- `scripts/dev-bootstrap.sql` — seeded instructor/cohort/enrollment fixtures.
- `tests/learn/stage8-cohort-parity.test.ts` — release-state evaluation + media/reflection
  gating tests.

Follow-up pass:
- `scripts/migrations/006_learn_manual_reviews.sql` (new) — `learn_manual_reviews` table.
- `lib/learn/schema.ts` — `manual_review` mode gains optional/additive `pointsPossible`.
- `lib/learn/review.ts` (new, pure) — `applyApprovedReviews` score-adjustment helper.
- `app/actions/learn-play.ts` — `submitResponse` queues a pending review row;
  `completeAttempt` folds already-approved reviews into its score.
- `app/actions/learn-review.ts` (new) — `listPendingReviews`, `approveReview`.
- `lib/notifications.ts` — new `reflection_reviewed` notification type.
- `components/learn/instructor/ReviewQueue.tsx` + `app/app/instructor/learn/review/page.tsx`
  — instructor review queue UI.
- `app/dashboard/lesson/[lessonId]/results/[attemptId]/page.tsx` — student-facing review
  status/points/feedback.
- `lib/learn/instructorConsole.ts` (new) — roster data loader.
- `components/learn/instructor/CohortRoster.tsx` + `app/app/instructor/learn/page.tsx` —
  instructor cohort console UI + release controls.
- `components/learn/builder/inspectors/QuestionInspector.tsx`,
  `scripts/seed-learn-demo.ts` — updated for the new `pointsPossible` field.
- `lib/hiring.ts` — one-line fix for a pre-existing parameter-type-inference crash in
  `refreshNewlyMissedRequiredTrainingStatuses`, found while live-verifying the instructor
  console (see above).
- `scripts/dev-bootstrap.sql` — added `people`/`instructors` fixture rows and
  `training_sessions`/`training_session_registrations`/`training_session_attendance` stub
  tables.
- `tests/learn/stage8-cohort-parity.test.ts` — +5 tests for `applyApprovedReviews`.
