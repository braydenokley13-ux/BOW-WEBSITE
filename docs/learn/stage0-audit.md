# Stage 0 Audit — Playbook Engine Foundations

Scope: verify DB-layer behavior, existing gamification write paths, cohort/enrollment
pacing semantics, media handling, and `lib/lessons.ts` shape constraints before
freezing migration DDL. No live Supabase access in this container
(`POSTGRES_URL` unset) — findings below are from static code reading only;
migrations must be applied and smoke-tested by the owner.

## 1. DB layer

`lib/db.ts` (`getDb()`) is a SQLite-compat shim over `postgres` (postgres.js):
`PostgresStatement.all/get/run` funnel every query through `toPostgresSql()`
(lib/db.ts:66-92), which rewrites `?` placeholders to `$1..$n` and patches a
handful of SQLite-isms (`json_extract`, `INSERT OR IGNORE`, `datetime('now')`,
etc.) via regex. Two reasons new JSONB code must bypass it:

- **Correctness**: the `json_extract` regex only handles a single dotted path
  literal (`json_extract(col, '$.a.b')` → `(col::jsonb ->> 'a.b')`), and the `?`
  placeholder rewriter is quote-aware but not JSONB-operator-aware — a native
  `?`/`?|`/`?&` jsonb operator or a `->`/`->>` chain with parameters would be
  silently corrupted by the same regex that converts bind markers. Nothing in
  the current codebase uses those operators, so the bug is latent, not yet hit.
- **Transactions**: `PostgresDatabase.exec()` implements BEGIN/COMMIT/ROLLBACK
  by reserving one connection out of the pool and stashing it in an
  `AsyncLocalStorage` (lib/db.ts:122-156). It works for the existing
  imperative `db.exec("BEGIN")` call sites but is not how postgres.js is
  designed to be used — `sql.begin(fn)` is the native, deadlock-safer
  transaction primitive (auto-rollback on throw, no manual context threading).
  Stage 1's `completeAttempt` needs `SELECT … FOR UPDATE` + multi-table writes
  inside one atomic block, best expressed with `sql.begin()`.

`getDb()`'s raw `Sql` client is private (module-scoped `client` field on
`PostgresDatabase`), so there is no way to get a native tagged-template
handle from the existing module. `lib/db-sql.ts` (this stage) opens a second
`postgres()` client with the same connection/env logic and a `globalThis`
singleton (`__bowPostgresSql`), so we don't fight `db.ts` for its pool.

## 2. XP / streak / badge / notification write paths

- **XP**: banked with `UPDATE users SET xp = COALESCE(xp,0) + ? WHERE id = ?`
  (app/actions/lms.ts:2375 area, e.g. the Daily Question flow at
  app/actions/lms.ts:2375). No idempotency key exists today — callers compute
  `xpEarned` once per request and rely on request-level guards (e.g.
  `alreadyAnswered`) to avoid double-award. Stage 1's `learn_xp_events` table
  fixes this generally via a unique `source_key` (`attempt:<id>:completion`)
  so a retried `completeAttempt` cannot double-bank XP.
- **Badges**: `checkAndAwardBadges` (lib/badges.ts) evaluates the
  category+threshold catalog (`BADGE_CATALOG`) against live student stats and
  does a sticky `INSERT OR IGNORE INTO student_badges` — awarding is
  idempotent and never revoked. `badges` currently has no `source`/`rule`
  columns; migration 001 adds `source text default 'system'` and `rule jsonb`
  so a future declarative achievement registry (`lib/learn/achievements.ts`,
  Stage 9) can coexist with the hardcoded catalog without a schema change.
- **Notifications**: `createNotification` (lib/notifications.ts) does
  `INSERT OR IGNORE INTO notifications (id, …)` — idempotent when callers pass
  a deterministic `id` (e.g. `rank-up:<userId>`). `completeAttempt` should key
  notifications the same way (e.g. `attempt:<id>:complete`).
- **Streak**: `recordDailyVisit` (lib/streak.ts) updates
  `users.current_streak/longest_streak/last_active_date` using UTC day
  boundaries (`utcIso`), idempotent within a calendar day. Stage 1 does not
  touch streak logic; a completed lesson attempt is expected to count as a
  "daily visit" the same way answering the Daily Question does (call
  `recordDailyVisit` from `completeAttempt` in Stage 2/3, not Stage 1 — no
  player yet).

## 3. Cohort pacing & enrollment semantics

Two independent pacing knobs exist on the legacy curriculum
(`app/actions/lms.ts`, `app/actions/classes.ts`):

- `cohorts.current_lesson_id` — the instructor-paced "cohort clock": the
  lesson the whole cohort is currently on. Advanced by staff action
  (`UPDATE cohorts SET current_lesson_id = ? WHERE id = ? AND current_lesson_id IS ?`,
  app/actions/lms.ts:961) — the `IS ?` guard makes advance-to-next
  compare-and-swap safe against concurrent advances.
- `enrollments.unlocked_lesson_id` — a **per-student override** on top of the
  cohort clock: a student can be individually unlocked ahead of (or
  independent from) the cohort's current lesson
  (`UPDATE enrollments SET unlocked_lesson_id = ? WHERE user_id = ? AND cohort_id = ? AND enroll = 'active'`,
  app/actions/lms.ts:1512). Effective unlock for a student is the
  max-progress of `cohort.current_lesson_id` and
  `enrollment.unlocked_lesson_id` (see the `cohortIdx`/`selfIdx` resolution at
  app/actions/lms.ts:1282-1293).
- Lesson *status* (`lesson_progress` table, joined via `readAppData()` in
  lib/db.ts:325-331) is keyed by `(user_id, lesson_id)` and is
  **mastery-shaped**, not per-cohort: a student's progress record does not
  distinguish "this lesson done for Cohort A" vs "for Program B."

This directly informs the plan's two-scope split: `learn_lesson_mastery`
(lifetime best score/stars, PK `(user_id, lesson_id)` — mirrors today's
`lesson_progress` shape) vs `learn_assignment_progress`
(`(user_id, context_type, context_id, lesson_id)` — generalizes
`current_lesson_id`/`unlocked_lesson_id` gating to `cohort|program` scopes
without cramming context into the mastery row). `learn_release_state`
(migration 004) is the new primitive that generalizes the CAS-guarded
`current_lesson_id` advance and the per-student `unlocked_lesson_id` override
into one `(node_id|module_id, scope_type, scope_id)` table, adding scheduled
opens (`opens_at`) which today's schema has no equivalent for.

## 4. Media / podcast handling today

`components/site/PodcastPlayer.tsx` is a **simulated player**: there is no
real audio file wired up yet — it runs an interval-based fake progress timer
(`TICK_MS`/`STEP_SEC`) and reports a played fraction via `onProgress(fraction)`
(components/site/PodcastPlayer.tsx:33-36 comment: "Full episode audio isn't
produced yet"). Lessons reference podcast metadata only
(`podcastEpisode`, `podcastTitle`, `podcastUrl` string fields on `Lesson` in
lib/lessons.ts) — `podcastUrl` is presently unused/decorative in the pilot
lessons inspected. The new `media` block's `kind: 'podcast'` should keep
reusing `PodcastPlayer` for its UI/engagement-tracking pattern (Stage 2), but
`completion: percent(n)` must be driven by real `onProgress` once real audio
exists — the schema should not assume audio duration is trustworthy today.

## 5. `lib/lessons.ts` shape → LessonDoc migration constraints

`lib/lessons.ts` (1202 lines) exports a flat `Lesson` interface consumed by
the explorer/detail pages — it is **not phase/block structured** at all; it's
closer to a rich case-study record: `situation: string[]`, `needToKnow`,
`decisionOptions`, `stakeholders`, `evidence`, `learningOutcomes`,
`discussionQuestions` are prose/array fields with no branching, scoring, or
variable model. Migrating a `Lesson` to a `LessonDoc` (Stage 10, via an import
helper) is a **content transform, not a mechanical field mapping**:
- `situation[]` / `needToKnow[]` → Briefing-phase `text`/`callout`/`stat` blocks.
- `decisionOptions[]` → a Decision-phase block (`strategy_choice` or
  `scenario`), but today's data has no effects/points/branch — those must be
  authored, not inferred.
- `stakeholders[]` / `evidence[]` → best rendered as `comparison`/`stat`
  content blocks in Learn/Decision phases; no schema field maps 1:1.
- `discussionQuestions[]` → `long_text` reflection blocks
  (`manual_review` or `completion_only` mode — there's no rubric today).
- No variables, skills, or scoring exist in the legacy shape at all — every
  migrated lesson starts as a shell with empty `variables`/`scoring` until an
  author fills them in via Studio. This matches the plan's explicit Stage 10
  framing ("automated import is not finished migration").

## 6. RLS status

`scripts/migrate-sqlite-to-supabase.ts:162` runs
`ALTER TABLE <table> ENABLE ROW LEVEL SECURITY` for every migrated table with
**no policies attached** — access today is entirely through the service-role
connection string (`POSTGRES_URL`), bypassing RLS at the connection level.
New `learn_*` tables follow the same pattern: enable RLS in the migration
(documented in each file's header), add no policies yet, and continue to gate
access exclusively through server actions + `requireRole` checks. This is a
known repo-wide posture, not a new risk introduced by Stage 1.

## 7. Open risks / follow-ups for later stages

- `toPostgresSql`'s json_extract regex is a landmine for anyone who later
  "helpfully" ports old code to touch `learn_*` JSONB columns through
  `getDb()` — worth a comment pointer, not a Stage 1 fix.
- No live DB in this container: migrations 001-004 and `run-migrations.ts`
  are unexercised against real Postgres. The runner is written to be
  idempotent (guarded by `schema_migrations`, `IF NOT EXISTS` everywhere) but
  the owner must run `npm run migrate` and report back before Stage 2 seeds
  data.
- `learn_assignment_progress` context resolution (which `context_id` wins
  when a student is in both a cohort and a program for the same lesson) is
  deferred to Stage 2/8 — Stage 1 only creates the table shape per the plan.
- Podcast/media completion tracking is currently "honest simulation" per
  `PodcastPlayer`'s own comment — real audio infra is out of scope here and
  should be flagged again at Stage 6/8 before `completion: percent(n)` is
  treated as trustworthy analytics rather than an engagement proxy.
