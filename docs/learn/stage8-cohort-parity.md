# Stage 8 — Cohort Parity

Status: **partial — backend/data-layer core done and live-verified; instructor-facing UI,
manual-review queue UI, and the full Playwright suite are explicitly deferred (NOT DONE)**.
Per the escalation rule, the full 6-deliverable stage was triaged: main approved shipping
deliverables 1–4 (release-state plumbing, enrollment-aware attempts, server-side gating,
this parity doc) in this pass, with the instructor console, manual-review queue, and
Playwright screenshots pushed to a follow-up pass. Nothing below is claimed done that
wasn't actually run against the live local Postgres cluster (port 55432).

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
| Manual-review queue (open reflection graded by a human) | `long_text` block, `reflection.mode: 'manual_review'`; outcomes recorded as pending | **NOT DONE — deferred.** `gradeBlock` currently treats `manual_review` identically to `completion_only` (non-empty text passes, no pending/approved/points state machine exists). No instructor queue page, no approve-with-points action, no attempt-score recompute-on-review, no student-facing reviewed-feedback surface. | Not run. This is the single largest honest gap versus the legacy system's manual-review workflow. |
| Instructor views on new attempt data (roster, per-student status/scores/last-activity) | Instructor console page reading `learn_attempts`/`learn_lesson_mastery`/`learn_assignment_progress` | **NOT DONE — deferred.** No `app/app/instructor/*` roster page was built this pass. | Data the page would read is now correct and populated (see enrollment-aware assignment progress row above) — the UI itself does not exist yet. |
| Release controls in an instructor UI (release next node/module to cohort, per-student override, set timed open) | Buttons/forms over `app/actions/learn-release.ts` | Backend DONE, **UI NOT DONE — deferred.** | `releaseToScope`/`revokeFromScope`/`listReleasesForCohort` exist, are ownership-gated, and are live-verified at the SQL/logic level (see rows above) — there is no page wiring them to a click. |
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

**Not run this pass** (would require the deferred instructor console UI or Playwright):
browser-driven "instructor releases a node → student sees it unlock in the CareerMap UI",
the manual-review round trip, and screenshots. The underlying data-layer paths those flows
would exercise are the same ones verified above at the SQL level.

## Honest gaps (deferred to a follow-up pass)

- **Manual-review queue is not built.** `long_text` blocks with `mode: 'manual_review'`
  behave identically to `completion_only` today (any non-empty text "passes"). No pending
  state, no instructor review page, no approve-with-points-and-feedback action, no
  transactional score recompute on review, no student-facing reviewed-feedback display. This
  is the biggest functional gap versus the legacy system and should be first in the
  follow-up pass.
- **Instructor console (roster + release controls) is not built.** No
  `app/app/instructor/*` page exists reading `learn_attempts`/`learn_lesson_mastery`/
  `learn_assignment_progress` per-student, and no UI wraps `learn-release.ts`'s actions.
  Instructors can only be released-to today via direct action calls or SQL — there is no
  click-path.
- **No Playwright verification** was run this pass — only direct-SQL/live-DB and `node:test`
  unit verification. The gate's explicit browser-driven scenarios (instructor releases a
  node and a real logged-in student sees it unlock in the UI; the manual-review round trip;
  media-gated phase refusing advancement in the actual player) are unverified end-to-end
  through the real app UI.
- **Notification-on-review** (student notified when their reflection is reviewed) is
  unbuilt — it depends on the manual-review queue existing first.
- **Attendance** is explicitly out of scope per the stage brief; not addressed and not
  planned for any stage of this rebuild.

## Files touched this pass

- `app/actions/learn-release.ts` (new) — release/revoke/list actions, ownership-gated.
- `app/actions/learn-play.ts` — `enrollment_context` stamping in `startAttempt`,
  `learn_assignment_progress` upsert (`in_progress` on start, `completed` on
  `completeAttempt`), server-side media/reflection completion gating in `completeAttempt`.
- `lib/learn/home.ts` — real cohort resolution (`loadActiveCohortIds`) replacing the
  `cohortId: null` stub and the circular attempt-based lookup; fixed the student-scope
  `scope_id` bug in `loadReleasedNodeIds`.
- `scripts/dev-bootstrap.sql` — seeded instructor/cohort/enrollment fixtures.
- `tests/learn/stage8-cohort-parity.test.ts` (new) — 7 tests: release-state evaluation
  (requiresInstructorRelease, opensAt, override-doesn't-bypass-prereqs) and media/reflection
  gating (percent threshold, finished mode, min_words, manual_review completion-only
  behavior — the last one documents today's gap, not a fix).
