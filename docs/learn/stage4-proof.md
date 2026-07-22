# Stage 4 — Real-Lesson Proof Gate: "The Price of a Seat"

Rebuilt Track 101 Module 4's most pricing-centric lesson (`t101-m4-l2`, "The
Price of a Seat" — dynamic ticket pricing under elasticity/price-discrimination
tradeoffs; the closest Track-201-adjacent pricing lesson, `t201-m2-l1` "The
League as a Business," is a revenue-sharing vote with no pricing mechanic, so
per the spec's "or similar, pick the most pricing-centric one" this lesson was
used as source material) entirely through Playbook Studio as `admin@bow.test`,
then played/replayed as `student@bow.test`, then edited and republished as V2.
Zero lesson-specific code was written anywhere in the repo — all content lives
in `learn_lesson_versions.doc` JSONB, authored via the existing builder UI.

**Gate result: PASS.** All 27 steps completed through the real UI against a
real local Postgres 16 instance. Two real, generic architecture/authoring gaps
were found and fixed (Skills tab, badge catalog seed); one real backend crash
bug was found and fixed (`submitResponse` with an untouched budget block).
Everything else — schema, engine, block registry, branching, publish/version
immutability, replay economics — worked exactly as designed on the first real
database it has ever touched.

## Environment

- Local Postgres 16, cluster owned by a dedicated `pguser` (initdb refuses
  root), socket + TCP on `127.0.0.1:55432`, db `bow`.
- `scripts/dev-bootstrap.sql` (new, committed): the minimal legacy schema
  (`users`, `sessions`, `organizations`, `cohorts`, `enrollments`,
  `invitations`, `badges`, `student_badges`, `notifications`,
  `lesson_progress`, `attendance`, `session_notes`, `inquiries`, `activity`,
  `testimonials`, `news_items`, `security_rate_limits`, `people`,
  `instructors`, `concept_map`) that the app touches on login/dashboard/build
  paths. The production schema has never had DDL in this repo (Stage 0 audit)
  — this is a dev-only reconstruction, clearly marked as such in the file
  header.
- `npm run migrate` (`scripts/run-migrations.ts`) — **first live run ever**
  against a real database. Migrations 001–004 (Stage 1) applied cleanly, zero
  SQL errors. Added migration `005_seed_badge_catalog.sql` (see Fixes).
- Two accounts seeded (scratch script, not committed — trivial to
  reproduce): `admin@bow.test` / `Admin!2345` (role `admin`), `student@bow.test`
  / `Student!2345` (role `student`), both in org `org-bow`.
- Playwright + Chromium (`/opt/pw-browsers/chromium-1194`), scripts written to
  the session scratchpad (not committed — throwaway proof-drivers).

## Step-by-step results

| # | Step | Result | Notes |
|---|------|--------|-------|
| 1 | Create lesson | PASS | Track "Front Office 201" → Module "Money in Motion" → Lesson "The Price of a Seat", all via the curriculum manager UI (`app/app/admin/learn`). |
| 2 | Briefing | PASS | Heading (auto) + Text + Callout blocks, authored via click-to-add palette + inspector text fields. |
| 3 | Knowledge MCQ | PASS | Learn phase: Text + Callout + a 4-option MC with correct-answer radio, grading `correct`. |
| 4 | Pricing slider | PASS | Decision phase `price_set` block ($0–$100 range), prompt "Set the average single-game ticket price." |
| 5 | Variables | PASS | `Ticket Revenue` (currency), `Attendance` (number, initial 8000), `Fan Satisfaction` (percent, initial 70). |
| 6 | Effects | PASS | Price → Revenue via `from_response` (scale 180); Budget → Fan Satisfaction via `increase_by 5`; both Scenario choices → Fan Satisfaction (`decrease_by 5` / `increase_by 5`). |
| 7 | Budget allocation | PASS | 3 categories (Social/Digital, Season Ticket Email, Local Media Buy), $10,000 total, `weighted` grading. |
| 8 | Two branches | PASS | `scenario` block, 2 choices, each with its own `goTo` wired via the BranchEditor `<select>` to a distinct Consequence-phase block. |
| 9 | Consequence feedback | PASS | Two Consequence-phase blocks (a `text` and a `callout`), each reachable only via its own scenario branch — no `visibleIf` needed; branching-by-block-target is sufficient (see Friction #1). |
| 10 | Scoring | PASS | Star thresholds 40/70/90 (ascending, validator-clean). |
| 11 | XP | PASS | Base 20, per-star 10, first-completion bonus 15. |
| 12 | Skill effect | PASS (after fix) | No Skills tab existed in the builder — added one (see Fixes #1). Created skill "Pricing Strategy" inline, attached with `maxPoints: 15`. |
| 13 | Badge | PASS (after fix) | `badges` table was empty in any fresh environment — Studio's badge picker had nothing to select (see Fixes #2). Seeded the catalog via migration, then attached "Sharp Eye". |
| 14 | Preview | PASS | In-memory `PreviewModal` opened without error. |
| 15 | Validate | PASS | `validateLessonDoc` returned zero errors, zero warnings on the first try. |
| 16 | Publish V1 | PASS | `learn_lesson_versions` row inserted, `learn_lessons.published_version_id` set, toolbar shows "Published V1". |
| 17 | Play (student) | PASS | `student@bow.test` → `/dashboard/lesson/{id}` → real `LessonPlayer`, live variable HUD (Revenue $0, Attendance 8000, Fan Satisfaction 70%). |
| 18 | Authoritative consequences | PASS | Server-graded MCQ; price_set effect computed server-side (`$70 × 180 = $12,600` revenue); budget effect (+5% sentiment → 75%); scenario branch effect. All variable math matched the authored effects exactly. |
| 19 | Finish | PASS | "See results" → `completeAttempt` → redirect to `/dashboard/lesson/{id}/results/{attemptId}`. |
| 20 | Score/stars/XP | PASS | 100/100, 3 stars, +65 XP shown and persisted (`learn_attempts.score/stars/xp_awarded`). |
| 21 | Progression update | PASS | `learn_lesson_mastery` row created (best_score 100, best_stars 3, attempts 1); `learn_xp_events` row (`attempt:…:completion`, +65); `users.xp` = 65; `learn_skill_events` row (+15 Pricing Strategy). |
| 22 | Replay, different path | PASS | Wrong MCQ answer, low price ($20), zero budget allocation, other scenario branch → different variables ($3,600 revenue, 75% sentiment) and score 0/100. |
| 23 | No reward farming | PASS | Replay scored 0/100 (worse than best): `xp_awarded = 0`, `learn_xp_events` recorded a 0-amount row (idempotency, not double-banking), `users.xp` stayed 65 (unchanged), `learn_lesson_mastery.best_score/best_stars` stayed 100/3 (ratcheted, never lowered), no new `learn_skill_events` row (no skill growth on a non-improving replay). See DB evidence below. |
| 24 | Edit (admin) | PASS | Changed the Briefing heading to "The Price of a Seat (V2 — Revised)". |
| 25 | Publish V2 | PASS | New `learn_lesson_versions` row (version 2), `published_version_id` repointed. |
| 26 | V1 attempts still reference V1 | PASS | Both prior `learn_attempts` rows still show `version_id = lver-17e1e546-f27` (V1) after V2 published — immutability confirmed. |
| 27 | New attempt uses V2 | PASS | Fresh `/dashboard/lesson/{id}` visit shows the V2 heading text and creates an attempt with `version_id = lver-3776ece5-7ff` (V2). |

## Fixes made (all committed, all generic — zero lesson-specific code)

1. **Added a Skills tab to Playbook Studio** (`components/learn/builder/SkillsPanel.tsx`,
   wired into `components/learn/builder/InspectorPanel.tsx`; new server actions
   `listSkills`/`createSkill` in `app/actions/learn-author.ts`). The schema and
   reducer already supported `LessonDoc.skills` (`SET_SKILLS` action existed),
   but no UI surface ever rendered it — step 12 ("skill effect") was
   **impossible** through the UI before this fix. Since Stage 7's dedicated
   skills-management page doesn't exist yet, the panel can also create a new
   skill inline.
2. **Seeded `BADGE_CATALOG` into the `badges` table**
   (`scripts/migrations/005_seed_badge_catalog.sql`). `lib/badges.ts`'s
   `getAllBadges()` has a fallback to the hardcoded catalog when the table is
   empty, which masked this everywhere else in the app — but
   `app/actions/learn-author.ts`'s `listBadges()` (Playbook Studio's Scoring
   tab) does a plain `SELECT id, name FROM badges` with no such fallback. On
   any environment where this table was never hand-seeded (a fresh Supabase
   project, or this local DB), the badge picker is permanently empty with no
   error explaining why — step 13 ("badge") was **impossible** through the UI
   before this fix. This is a real gap in every environment, not just local
   dev, so it's a migration, not a dev-only script.
3. **Fixed a repo-wide JSONB double-encoding bug**: every write to a
   `learn_*` jsonb column via `sqlLearn` used the pattern
   `${JSON.stringify(x)}::jsonb`. Against a real postgres.js connection this
   double-encodes — the column ends up holding a JSON *string* containing the
   serialized doc, not the parsed object (`jsonb_typeof` = `'string'`, not
   `'object'`). Every lesson ever created showed
   `[learn/compat] LessonDoc is missing a numeric schemaVersion` the instant
   an author opened it — the builder was **unusable end-to-end** the moment a
   real database was involved. Fixed by switching every call site to
   postgres.js's native `sql.json(value)` helper (`app/actions/learn-author.ts`,
   `app/actions/learn-play.ts`, `scripts/seed-learn-demo.ts`). This had never
   been caught because Stage 0–3 had no live database to test against
   (documented explicitly in `docs/learn/stage0-audit.md`) — exactly the class
   of bug Stage 4 exists to catch.
4. **Fixed a crash on committing an untouched `budget_allocation` block**
   (`app/actions/learn-play.ts`, `submitResponse`): a student who clicks
   "Lock in budget" without ever changing a category input commits with
   `response === undefined` (the component's local state is never initialized
   by an `onChange`). The native postgres.js client throws
   `UNDEFINED_VALUE: Undefined values are not allowed` on a bare `undefined`
   parameter, which crashed `submitResponse` with a 500. Fixed by coalescing
   `undefined → null` once, generically, at the write boundary — no block
   type has to special-case "student left it at the default" itself.
5. **`scripts/dev-bootstrap.sql`** (new): the minimal legacy schema needed to
   run this app locally at all (see Environment). Documented as dev-only in
   its header; production schema is unaffected.

None of these fixes reference "The Price of a Seat," ticket pricing, or any
lesson-specific concept — all are schema/action/builder-UI level.

## Friction points (input for Stage 5, a non-technical author's perspective)

1. **Branching model is implicit, not visual.** Consequence-phase feedback
   works by making each scenario choice's `goTo` point at a different block,
   and simply never routing the *other* branch's block into that path. There
   is no visual branch map (`BranchMapView.tsx` is listed in the plan for a
   later stage but doesn't exist yet) — an author has to hold the whole graph
   in their head, and a stray block reachable from neither branch is easy to
   leave behind by accident (I did, twice, in this proof — see below).
2. **No "type change" or delete-with-undo affordance for a phase's
   auto-seeded block.** `ADD_PHASE` always seeds the new phase with one empty
   `text` block. That's a reasonable default, but there's no visual cue that
   this happened — a non-technical author double-adding a phase (or
   misclicking) ends up with silent duplicate phases/blocks that look
   identical in the tab bar (both literally labeled "Consequence") until you
   click into each one. This happened during scripting and required three
   follow-up cleanup passes to fully resolve — a real author would likely
   never notice the duplicate empty phase existed at all, since nothing in
   the UI flags "this phase has no incoming branch and is unreachable."
3. **Autosave has no visible "flush" affordance.** The debounced ~3s autosave
   is invisible until "Saved" appears in the toolbar; navigating away (or, in
   a scripted context, closing the browser) before that fires silently loses
   the edit with no warning. A manual "Save now" button (the underlying
   `saveNow()` already exists in `useBuilderStore` and is used by Publish)
   would remove an entire class of "I swear I typed that" support tickets.
4. **Effect rows default to values that look plausible but are wrong.**
   Adding an effect defaults to `verb: increase_by, amount: 0`, targeting
   whichever variable is first alphabetically/insertion-order — for a
   `from_response` scale effect (the natural choice for "revenue follows
   price"), the author must remember to change the verb *and* notice the
   amount field silently relabels to "Scale." Nothing in the UI explains what
   "Scale" means without already knowing the engine's effect model.
5. **Budget-allocation categories start as bare empty-string inputs with no
   placeholder** — "+ Add category" produces an unlabeled text box; nothing
   hints "type a channel name here" until you've seen the block render once.
6. **The connection-pool exhaustion issue** (see below) is invisible to an
   author — a stalled 30-60s "Saving…" occasionally happens for reasons
   entirely unrelated to their lesson, caused by an unrelated dashboard widget
   query erroring in the background. Not fixable from the Studio UI at all.

## Operational finding (not a Learn bug, but blocked the proof and is worth flagging)

The shared `/app` admin layout queries several hiring/growth-pipeline tables
(`instructors`, `people`, `training_session_registrations`, …) on every page
load. In this fresh local database several of those tables didn't exist yet;
each failure aborted mid-transaction and — because `lib/db.ts`'s
`BEGIN`/`COMMIT` pairing only releases its reserved pooled connection on a
successful `COMMIT`/`ROLLBACK` path, not on an unhandled query error — leaked
a permanently "idle in transaction" connection. Over the course of this
session that repeatedly exhausted the (default, small) postgres.js connection
pool, manifesting as 30–60s hangs on unrelated requests (sign-in, page loads).
Stubbed the missing tables (`instructors`, `people`, `concept_map`, etc. — see
`scripts/dev-bootstrap.sql`) to stop new leaks, and ran a periodic
`pg_terminate_backend` reaper against existing "idle in transaction" backends
older than 10s to keep the session alive. This is a **pre-existing legacy
`lib/db.ts` bug** ("Legacy code untouched" per the rebuild plan, so left
as-is) — flagging it here since it could bite Stage 8+ (cohort/instructor
surfaces) or any future load-bearing use of that admin layout in production.

## DB evidence

**Step 23 — no reward farming** (`user-student-1`, lesson `lesson-ac547afd-ea7`):

```
 id                  | status    | score | stars | xp_awarded
 atmpt-50abd293-c8c   | completed |   100 |     3 |         65   (attempt 1, best path)
 atmpt-2935308c-767   | completed |     0 |     0 |          0   (replay, worse — 0 XP)

learn_lesson_mastery: best_score=100, best_stars=3, attempts=2   (ratcheted, never lowered)
learn_xp_events:      +65 (attempt 1), +0 (attempt 2 replay — idempotent, not double-banked)
users.xp:             65  (unchanged after the non-improving replay)
learn_skill_events:   1 row total (attempt 1 only — no skill growth on the non-improving replay)
```

**Step 26 — V1 attempts still reference V1 after V2 is published:**

```
 id                  | version_id          | status
 atmpt-50abd293-c8c   | lver-17e1e546-f27   | completed   (V1)
 atmpt-2935308c-767   | lver-17e1e546-f27   | completed   (V1)
 atmpt-357832fd-f1f   | lver-3776ece5-7ff   | in_progress (V2, new attempt — step 27)

learn_lesson_versions: version 1 doc.phases[0].blocks[0].text = "The Price of a Seat"
                        version 2 doc.phases[0].blocks[0].text = "The Price of a Seat (V2 — Revised)"
learn_lessons.published_version_id = lver-3776ece5-7ff (V2 is now the live version)
```

## Verification

- `npm run test`: 63/63 green (unchanged suite, all still passing after fixes).
- `npx tsc --noEmit`: clean.
- `npm run migrate`: 001–005 apply cleanly on a fresh database (0 SQL errors).
- `npm run build`: compiles and typechecks cleanly; static prerender of two
  unrelated legacy marketing pages (`/concept-map`, `/demo` → `self_modules`
  and other self-paced tables) fails locally because the dev-bootstrap schema
  is intentionally minimal, not a full production schema clone (per Stage 0:
  no live DB has ever existed for this repo to test against). This is not a
  regression from this stage's changes — confirmed via `git diff --stat`
  that no file outside `lib/learn/*`, `app/actions/learn-*.ts`,
  `components/learn/builder/*`, and the new migrations/dev-bootstrap script
  was touched.
- `git diff --stat` confirms Highway World (`app/(marketing)/highway-world/`,
  `lib/highway.ts`) untouched.

## Escalations

None. All blockers found during this stage were fixable with generic,
committed fixes (see above) — no plan conflicts or ambiguous design decisions
required a stop to consult `main`.
