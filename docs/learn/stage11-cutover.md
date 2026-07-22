# Stage 11 — Controlled Cutover

Status: **switched, verified, not deleted.** Per plan §6, this stage ships the
route cutover + rollback flag + observation checklist. Dead-code removal is a
follow-up after Brayden's observation window in production, executed from
the inventory in §5 below — nothing is deleted in this pass.

## 1. What switched

The legacy cohort-portal entry points now redirect to the new learn
platform, gated by a single flag:

- `/app/student` → `redirect("/dashboard")`
- `/app/student/track` → `redirect("/dashboard")`
- `/app/student/lesson` → `redirect("/dashboard")`

Files: `app/app/student/page.tsx`, `app/app/student/track/page.tsx`,
`app/app/student/lesson/page.tsx` — each is now a tiny server component that
checks the flag and either redirects or renders the original legacy page
component, which was moved (not deleted) to a sibling `Legacy*` file in the
same directory (`LegacyStudentHome.tsx`, `LegacyStudentTrack.tsx`,
`LegacyStudentLesson.tsx`).

**Why `/app/student/lesson` can't map to a specific lesson on `/dashboard`:**
legacy lesson ids (`lib/lessons.ts`) don't correspond 1:1 with the new
`learn_lessons` rows — see the Stage 10 import note that a legacy lesson can
become zero, one, or more redesigned lessons depending on future
split/merge decisions. The legacy page also picks its lesson from
client-side `AppState` rather than a URL param, so there's no server-visible
id to translate at redirect time regardless. Every legacy lesson deep link
now lands on `/dashboard`, where StudentHome's Continue card and CareerMap
resolve the correct next/in-progress lesson on the new platform.

Nav (`lib/navigation/catalog.ts`): student Home now points at `/dashboard`
when the flag is on; the legacy "My Track" entry is dropped from the nav
(the route still exists and still redirects, it's just no longer advertised).
When the flag is off, nav reverts to the pre-Stage-11 links
(`/app/student`, `/app/student/track`).

## 2. Rollback flag

`lib/learn/cutover.ts`:

```ts
export const CUTOVER_ENABLED = process.env.BOW_LEARN_CUTOVER !== "off";
```

- Env var: `BOW_LEARN_CUTOVER`, default **on** (any value other than the
  literal `"off"` counts as on — so an unset var, `"on"`, `"1"`, etc. are all
  on). Documented in `.env.example`.
- **Rollback mechanics**: set `BOW_LEARN_CUTOVER=off` in the host's env store
  and let the next server restart/deploy pick it up — no code change, no
  redeploy of a new build required (the flag is a plain server-side
  `process.env` read, evaluated per request in the page server components and
  per-render in `app/app/layout.tsx`, not inlined at build time). Flip it
  back to remove the value (or `on`) to re-enable.
- The new platform (`/dashboard`, the lesson player) is **not** gated by this
  flag — it works regardless. The flag only controls (a) whether the three
  legacy routes redirect, and (b) what the student nav's Home entry points
  at. A student who already has `/dashboard` bookmarked keeps working
  through a rollback.
- Threading note: `lib/navigation/catalog.ts` is imported by a client
  component (`AuthHeader.tsx`), so the flag is **not** read from
  `process.env` inside that module (non-`NEXT_PUBLIC_` vars aren't reliably
  inlined into client bundles). Instead `CUTOVER_ENABLED` is read once,
  server-side, in `app/app/layout.tsx` and threaded down as a prop:
  `AppLayout → AppShell → AuthHeader → navForRole({ cutoverEnabled })` →
  `buildNavCatalog(cutoverEnabled)`.

## 3. Instructor / admin continuity

No route changes for staff. Verified reachable, live, in this pass:

- Instructor console `/app/instructor/learn` — linked from `/app/instructor`
  (pre-existing link) and now also a first-class nav entry
  ("Playbook Console") added to `lib/navigation/catalog.ts` for the
  instructor role.
- Release controls on the console render and are usable (verified via the
  Stage 8 flow reused here — see `docs/learn/stage8-cohort-parity.md`).
- Admin Playbook Studio hub `/app/admin/learn`, builder, `/app/admin/learn/map`
  (Career Map editor), `/app/admin/learn/achievements` (achievement rule
  editor) all render — nav entry `admin-learn` ("Playbook Studio") was
  already in the catalog from Stage 9/10, unchanged here.

Legacy instructor tools (`/app/instructor/cohort`, `/app/teach/*`) are
untouched by this stage.

## 4. Data continuity note

Legacy `lesson_progress` / self-paced progress rows are left in place,
read-only. **No migration of historical progress runs this stage.** The
legacy portal (when the flag is off, or for any direct DB read) still sees
its original data; the new platform's `learn_lesson_mastery` /
`learn_assignment_progress` tables start empty for students who haven't yet
played a redesigned+published lesson.

**Future backfill sketch** (not built, for planning only):

1. For each legacy lesson id in `lib/lessons.ts` that has been redesigned
   and published (`learn_lessons.published_version_id is not null`), resolve
   its slug via the Stage 10 import's id→slug mapping
   (`lib/learn/importLegacy.ts`).
2. For each `lesson_progress` row referencing that legacy lesson id, look up
   the corresponding `learn_lessons.id` by slug and upsert a synthetic
   `learn_lesson_mastery` row: `best_score`/`best_stars` derived from the
   legacy completion flag (legacy has no granular score, so this would be a
   coarse "completed → 100/3-stars" mapping, explicitly lossy), `attempts`
   from the legacy attempt count if tracked, `first_completed_at` from the
   legacy timestamp, and a synthetic `attempt_id`/`version_id` (or nullable
   columns, schema-permitting) since no real `learn_attempts` row exists for
   pre-cutover history.
3. Gate this per-lesson on publish state — an unpublished draft has no valid
   `learn_lesson_versions` row to attach a synthetic attempt to, so backfill
   only ever applies to lessons that have graduated out of draft.
4. Run once, idempotently (unique key on `(user_id, lesson_id)` already
   exists on `learn_lesson_mastery`), after all 24 lessons are redesigned —
   doing it lesson-by-lesson as each publishes would also work and avoids a
   big-bang cutover of history.

This is deliberately not built now: only 1 of 24 imported lessons is
published as of Stage 10 (`t101-m1-l1`), so a backfill today would touch a
sliver of the data and would need re-running per lesson anyway.

## 5. Dead-code inventory (not deleted — for the post-observation pass)

Everything below stays in the repo, present and read-only-referenced, until
Brayden confirms the observation window (§6) is clean. Do not remove any of
this in Stage 11.

| Item | Path(s) | Becomes removable when | Gotchas |
|---|---|---|---|
| Legacy student pages | `app/app/student/LegacyStudentHome.tsx`, `app/app/student/track/LegacyStudentTrack.tsx`, `app/app/student/lesson/LegacyStudentLesson.tsx`, plus their thin `page.tsx` wrappers | Flag has been on in prod through the full observation window with no rollback | Removing the wrappers also removes the rollback path — don't delete until the flag itself is retired, not just left on |
| Cutover flag + threading | `lib/learn/cutover.ts`, `CUTOVER_ENABLED` prop threading through `app/app/layout.tsx` → `AppShell` → `AuthHeader` → `navForRole`/`buildNavCatalog` in `lib/navigation/catalog.ts` | Same as above — once legacy pages are gone the flag has nothing left to gate | Removing `buildNavCatalog`'s cutoverEnabled branch also means deleting the legacy nav entries (`student-home` → `/app/student`, `student-track`) |
| `components/app/AppState.tsx` legacy student data paths | `activeEnrollmentFor`, `cohortCurrentLessonId`, `lessonProgressFor`, `setSelectedLessonId`, and the cohort/lesson-progress slices of `scopeAppDataForUser` in `lib/account.ts` | Once nothing under `app/app/student/Legacy*` reads them | `AppState` is also consumed by instructor/admin surfaces (cohorts, classes) that are untouched by this stage — audit call sites per-symbol, don't delete the whole file/context |
| `components/selfpaced/StudentDashboard.tsx` | same file | **Partially, never fully** — `DailyQuestionCard` and the streak tile inside it were reused directly by `components/learn/home/StudentHome.tsx` (Stage 7). Only the track/module progress list, weekly challenge, discussion scenarios, and Front Office Lab sections (the parts `LegacyStudentHome` still renders) become removable | Do not delete `DailyQuestionCard` or its streak-tile logic — grep every import before touching this file; a full-file delete will break `/dashboard` |
| `lib/lessons.ts` | whole file | Only after **all 24** legacy lessons are redesigned and published in Studio (`learn_lessons.published_version_id is not null` for all 24 slugs) — currently 1/24 (`t101-m1-l1`, per Stage 10) | Until then it's the only source for the 23 still-draft lessons' legacy content reference and is read by `LegacyStudentHome`/`LegacyStudentTrack`/`LegacyStudentLesson` |
| Legacy lesson runner components | any remaining `components/selfpaced/*` player/runner pieces exclusively reachable from the three `Legacy*` pages above | Same gate as the `Legacy*` pages | Re-check imports at removal time — Stage 6/7 already migrated some shared pieces (e.g. `PodcastPlayer`) into the new engine; don't delete anything still imported by `lib/learn/*` or `components/learn/*` |
| `lesson_progress` / self-paced progress tables | DB tables (no code path removed, this is a data lifecycle note not a code one) | Only after a deliberate backfill decision (§4) — this stage does not recommend a deletion date for the data itself, only for the code paths that read it |

## 6. Observation checklist (for Brayden, in production)

Watch for, roughly in priority order:

1. **Redirect errors.** Any 5xx or unexpected blank page hitting
   `/app/student`, `/app/student/track`, or `/app/student/lesson` — should
   always land cleanly on `/dashboard`. If you see errors here, flip
   `BOW_LEARN_CUTOVER=off` immediately (§2) and it's a config change, not a
   deploy.
2. **Students finding "Continue."** Watch whether returning students
   actually land on and use the Continue card / CareerMap on `/dashboard`
   rather than looking confused or bouncing — this is the core UX bet of the
   cutover. Session recordings or support messages mentioning "where's my
   lesson" are the signal to watch for.
3. **Instructors using release controls.** Confirm instructors on
   `/app/instructor/learn` are actually releasing lessons/modules to
   students (not just viewing) — the release-state UI shipped in Stage 8.
4. **Nav confusion.** The student nav no longer advertises "My Track" as a
   separate link — confirm nobody is trying to find a track view that used
   to exist as its own page (it's absorbed into the CareerMap on
   `/dashboard`).
5. **Legacy data reads.** No writes should be happening against
   `lesson_progress` from live traffic once the flag is on (all traffic goes
   through `/dashboard`) — if analytics show fresh writes to those tables,
   something is still routing through the legacy path unexpectedly.

If everything above is clean for the agreed observation period, the dead-code
inventory in §5 becomes the next stage's work — not part of this one.

## 7. Verification (this pass)

- `npm run test`: **143/143 passing**.
- `tsc --noEmit`: clean.
- `eslint` on touched files: clean.
- `npm run build`: succeeds through compile/typecheck; the only prerender
  failure is the pre-existing `/demo` page's `quiz_questions` relation error
  (unrelated to this stage — that table isn't part of migrations 001-007 and
  the failure reproduces on `main` before this stage's changes).
- Live Playwright pass against the local Postgres cluster
  (`scratchpad/pg`, port 55432), seeded accounts:
  - Student login → `/app/student`, `/app/student/track`, `/app/student/lesson`
    all redirect to `/dashboard` with the flag on (default). Screenshots:
    `scratchpad/proof11/01-student-app-student-redirected.png`,
    `02-dashboard-desktop.png`, `03-dashboard-mobile-390.png` (390px width).
  - Flag-off check: restarted dev with `BOW_LEARN_CUTOVER=off`; student
    login lands on `/app/student` directly and the legacy portal renders in
    full (cohort card, progress, recent activity) — confirmed via page
    text, not just a 200 status. Screenshot: `scratchpad/proof11/07-flagoff-legacy-portal.png`.
    Flipped back to default (on) afterward.
  - Instructor: `/app/instructor` shows two links to `/app/instructor/learn`
    (the pre-existing inline link plus the new nav entry); the console
    renders. Screenshot: `scratchpad/proof11/04-instructor-learn-console.png`.
  - Admin: `/app/admin/learn` (Studio hub), `/app/admin/learn/map` (map
    editor), `/app/admin/learn/achievements` (achievements editor) all
    render for the admin account. Screenshots:
    `scratchpad/proof11/05-admin-studio-hub.png`,
    `06-admin-achievements.png`.
  - Highway World untouched: `git diff --stat -- 'app/(marketing)/highway-world' lib/highway.ts` empty.

(Screenshots are throwaway proof artifacts in `scratchpad/proof11/`, not
committed, matching the Stage 4/6/9/10 convention.)

## 8. Final project status — Stages 0 through 11

| Stage | Scope | Memo |
|---|---|---|
| 0 | Audit: DB layer, gamification write paths, cohort/enrollment pacing, media handling, `lib/lessons.ts` constraints | `docs/learn/stage0-audit.md` |
| 1–3 | Data model, lesson document schema, block registry/runtime engine, migrations 001-004 (not separately memo'd — folded into later stage memos and the plan) | plan §1–3 |
| 4 | Real-lesson proof gate: rebuilt "The Price of a Seat" end-to-end, 27-step verification | `docs/learn/stage4-proof.md` |
| 5 | Architecture correction pass following Stage 4's friction list | `docs/learn/stage5-correction.md` |
| 6 | Interaction expansion: full block-type coverage | `docs/learn/stage6-expansion.md` |
| 7 | Student Home + progression: Continue card, CareerMap, identity, leaderboard tile — now the canonical `/dashboard` | `docs/learn/stage7-progression.md` |
| 8 | Cohort parity: release-state plumbing, enrollment-aware attempts, manual-review queue | `docs/learn/stage8-cohort-parity.md` |
| 9 | Achievements + competition: declarative badge rules, leaderboard | `docs/learn/stage9-achievements.md` |
| 10 | Curriculum migration: all 24 legacy lessons imported as drafts, 1 redesigned+published (`t101-m1-l1`) | `docs/learn/stage10-migration.md` |
| 11 | Controlled cutover: legacy student routes redirect to `/dashboard` behind `BOW_LEARN_CUTOVER`, instructor/admin continuity verified, dead-code inventoried (not deleted) | this memo |

**Where things stand:** the new learn platform is the canonical student
surface in production (flag on by default), with an instant, deploy-free
rollback available. Instructor and admin tooling (Playbook Studio, Career
Map editor, achievements editor, release controls) is fully live and
unaffected by the cutover. 23 of 24 legacy lessons remain to be redesigned
and published by Brayden in Studio — the legacy portal keeps serving that
content read-only in the interim via the rollback path, and `lib/lessons.ts`
stays in the repo until that work is done. No historical progress data has
been migrated; §4 sketches the backfill for whenever that's prioritized.
Dead-code removal (§5) is explicitly deferred to a follow-up stage after
Brayden's observation window closes clean.
