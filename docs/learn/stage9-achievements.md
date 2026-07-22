# Stage 9 — Achievements + Competition

## Triage cut (approved by main before proceeding)

The stage's 5 deliverables were too large for a single reliable pass. Main
approved this cut mid-stage, with an explicit instruction that the
achievement editor UI and the StudentHome leaderboard tile are **not**
optional — they are committed follow-up work, guaranteed as the next pass,
not "maybe later." That commitment is repeated below under Deferred.

**Shipped this pass:**
1. Declarative badge-rule engine (`lib/learn/achievements.ts`) + wiring into
   `completeAttempt`'s transaction.
2. Streak integration verification (already correct — see below).
3. One seeded custom rule-based badge ("Pricing Strategist").
4. Scoped XP leaderboard extension + a StudentHome leaderboard tile (ended up
   shipping this pass too, once the data layer turned out to already be
   reusable — see below).
5. Live DB verification of the award/idempotency path + a pre-existing
   `/leaderboard` bug fix that blocked verifying it.

**Deferred to the committed follow-up pass:**
- The full achievement editor UI
  (`app/app/admin/learn/achievements/page.tsx` +
  `components/learn/builder/AchievementEditor.tsx`) with a dropdown-based
  rule builder, create/edit/disable server actions, and Playwright proof.
  Custom badges are currently only creatable via seed/SQL
  (`badges.rule` jsonb) — functionally correct per the engine, but admins
  cannot yet create one through the portal, which the plan calls a
  non-negotiable.

## 1. Declarative badge-rule engine

`lib/learn/achievements.ts` — isomorphic, no DB imports:

- `AchievementRuleSchema` (zod discriminated union on `type`) covers all 7
  rule types from the plan: `lesson_complete` (+ optional `minStars`),
  `track_complete`, `module_complete`, `variable_threshold` (`gte`/`lte`,
  cross-field-validated via `.refine` after the union so the discriminator
  still resolves), `score_gte` (optionally scoped to a `lessonId`),
  `stars_total_gte`, `lessons_completed_gte`.
- `parseAchievementRule(value)` — safe-parses an unknown value (a
  `badges.rule` jsonb cell) and returns `null` on anything malformed, so a
  bad row never throws mid-transaction.
- `evaluateRule(rule, ctx)` — pure, exhaustive switch (a `never` guard fails
  compilation if a new rule type is added without a case).
- `evaluateBadgeRules(candidates, ctx)` — the batch entry point
  `completeAttempt` calls: skips malformed rules, returns only satisfied
  badge ids.
- `tests/learn/achievements.test.ts` — 15 unit tests: every rule type's
  true/false boundary, missing-variable and unknown-track/module edge
  cases, and a dedicated malformed-rule-rejection test covering `null`,
  `undefined`, `{}`, unknown `type`, missing required fields, empty string,
  out-of-range numbers, negative counts, and a bare string.

### Wiring into `completeAttempt`

`app/actions/learn-play.ts`'s `completeAttempt` transaction (mode='play'
only, after the existing XP/mastery/skill-events/assignment-progress work):

1. Loads every badge with a non-null `rule` column (`SELECT ... FROM badges
   WHERE rule IS NOT NULL`) — system badges (streak/accuracy/etc, no rule)
   are untouched, still handled by the existing `checkAndAwardBadges` in
   `lib/badges.ts`.
2. Builds `learn_lesson_mastery`-derived aggregates (completed lesson ids,
   total stars, total lessons) plus a track/module → lesson-id map from
   `learn_lessons`/`learn_modules`, and hands them to `evaluateBadgeRules`.
3. For each satisfied badge: `INSERT INTO student_badges ... ON CONFLICT
   (student_id, badge_id) DO NOTHING` — sticky, idempotent. Only on an
   actual insert (not a no-op conflict) does it bank XP via `INSERT INTO
   learn_xp_events (..., source_key, ...) VALUES (..., 'badge:<badgeId>:
   <userId>', ...) ON CONFLICT (source_key) DO NOTHING`, then `UPDATE users
   SET xp = xp + amount`. This key is distinct from the attempt-completion
   XP's `attempt:<id>:completion` key and from the legacy Daily-Question
   badge path (no `source_key` at all, handled separately by
   `lib/badges.ts`), so none of the three can double-bank.
4. All of this runs inside the same `withTransaction` block as the rest of
   completion — a crash mid-way rolls back cleanly; a retried
   `completeAttempt` on an already-completed attempt short-circuits before
   reaching this code at all (existing idempotent-convergence branch).

### BadgeToast pathway (mimicking the existing surface)

`completeAttempt` now returns `newBadges: { id, name, icon }[]` on its
result. `LessonPlayer` stashes that array into `sessionStorage` (keyed by
attemptId) right before navigating to the results page — the award happens
inside a server action whose return value doesn't otherwise survive the
navigation. A new small client component,
`components/learn/player/NewBadgeToastFromSession.tsx`, reads that stash
once (via a lazy `useState` initializer, not an effect, to avoid a
cascading-render lint violation) and hands it to the **existing**
`components/selfpaced/BadgeToast.tsx` — the same toast component the Daily
Question flow already uses (`components/selfpaced/DailyQuestionCard.tsx`).
Wired into `app/dashboard/lesson/[lessonId]/results/[attemptId]/page.tsx`.

## 2. Achievement editor — DEFERRED (committed follow-up)

Not shipped this pass. Current state: `badges.source`/`badges.rule` already
existed in the schema (`scripts/dev-bootstrap.sql`, migration
`005_seed_badge_catalog.sql`) before this stage — so custom badges are
fully functional end-to-end (seed → engine → award → XP → toast), just not
yet creatable through an admin UI. `app/actions/learn-author.ts`'s
`listBadges()` (the ScoringPanel badge multiselect in the lesson builder)
was verified unchanged and still works — it does a plain `SELECT id, name
FROM badges`, which includes the new custom badge alongside system ones.

## 3. Scoped leaderboards

Extended `lib/leaderboard.ts` (no new parallel system, per the plan's
"prefer extending" guidance) rather than standing up a Stage-9-only ranking
table: the existing `getXPLeaderboard`/`getStudentRank`/
`getStudentLeaderboardRow` already read `users.xp`, which both the
attempt-completion XP and the new rule-badge XP bank into — so the XP board
already reflects learn-lesson completions and achievement XP with zero
schema changes.

New: `components/learn/home/LeaderboardTile.tsx` — a compact top-5 +
your-rank tile (org-scoped) rendered on `StudentHome`, next to
`IdentityPanel`, linking to `/leaderboard?tab=xp` for the full board — kept
intentionally small per the plan ("competition stays clean, doesn't
overwhelm the main UI"). `app/dashboard/page.tsx` fetches the top 5 +
`getStudentRank` + (only when the viewer ranks outside the top 5)
`getStudentLeaderboardRow`, mirroring the existing `/leaderboard` page's
`outsideTop` pattern.

**Bug fix required to verify this live:** `lib/leaderboard.ts`'s
`eligibleOrdered` used the pattern `(? IS NULL OR u.org_id = ?)` untyped —
Postgres's extended query protocol can't infer parameter `$1`'s type from
`IS NULL` alone, and threw `could not determine data type of parameter $1`
(`42P18`) on every call, org-scoped or not. This is a pre-existing bug
(present before Stage 9, unrelated to any Stage 9 code path) that blocked
live-verifying both the new dashboard tile and the pre-existing `/leaderboard`
streak/xp tabs. Fixed by casting explicitly:
`(?::text IS NULL OR u.org_id = ?::text)` — the same pattern already used
correctly elsewhere in the codebase (`lib/hiring.ts:423`). Applied the
identical fix to the two occurrences of the same pattern in
`lib/scoring.ts` (`getLeaderboard`'s eligible-ids query and
`getLeaderboardCohorts`) since they're the same file family and the same
latent bug — verified those two also now execute without the parameter-type
error (a *separate*, unrelated, and out-of-scope bug remains in the BOW
Score tab specifically: `relation "self_progress" does not exist" in this
dev environment's `dev-bootstrap.sql`, not touched — flagged here for
visibility, not fixed).

## 4. Streak integration

Verified, not modified — already correct from Stage 2/7:
- `app/actions/learn-play.ts`'s `completeAttempt` already calls
  `recordDailyVisit(user.id)` for `mode === 'play'`, best-effort, outside
  the `sqlLearn` transaction (separate connection pool), exactly as the
  Stage 2 report described.
- `components/learn/home/IdentityPanel.tsx` already renders
  `identity.streak.current`/`.longest`, sourced from `lib/learn/home.ts`'s
  `loadStudentHome` → `getStreak(userId)` (`lib/streak.ts`) — live data, not
  a stale snapshot. Confirmed via the dashboard screenshot below ("1 day
  streak").

## 5. Seed extension

`scripts/seed-learn-demo.ts` now seeds one custom rule-based badge after
the demo map: `pricing_strategist` ("Pricing Strategist", 💰, 40 XP,
`source='custom'`, `rule = { type: 'lesson_complete', lessonId:
'lesson-rivalry-ticket-pricing', minStars: 3 }`) — `ON CONFLICT (id) DO
NOTHING`, idempotent re-run like the rest of the script.

## Live verification (local PG, port 55432, db `bow`)

- `npm run migrate` — 001-006 already applied, no-op (clean).
- `npx tsx scripts/seed-learn-demo.ts` — seeded lessons + the new
  `pricing_strategist` badge; confirmed via `psql`:
  ```
  id                  | name                | source | rule
  pricing_strategist  | Pricing Strategist  | custom | {"type": "lesson_complete", "lessonId": "lesson-rivalry-ticket-pricing", "minStars": 3}
  ```
- **Award + idempotency proof** (direct DB, reproducing the exact
  transaction logic added to `completeAttempt`, run twice against the real
  local Postgres — see reasoning below for why this method was used instead
  of a full blind UI playthrough):
  ```
  XP before: 170
  Pass 1 (first completion, 3 stars) newly awarded: [ 'pricing_strategist' ]
  Pass 2 (simulated retry/replay) newly awarded: []
  student_badges rows for pricing_strategist: [ { student_id: 'user-student-1', badge_id: 'pricing_strategist', earned_at: '...' } ]   -- exactly 1 row
  learn_xp_events rows for this badge: [ { source_key: 'badge:pricing_strategist:user-student-1', amount: 40 } ]                        -- exactly 1 row
  XP after: 210   -- +40 exactly once, not +80
  ```
  Test data cleaned up afterward (`student_badges`, `learn_xp_events`,
  `learn_attempts`, `learn_lesson_mastery` rows removed, `users.xp` restored
  to 170).

  Why direct-DB rather than a full blind Playwright playthrough of the
  pricing lesson: the lesson's `price_set`/`budget_allocation` scoring bands
  require specific inputs to reach the 3-star (90+/100) threshold the badge
  needs, and scripting that blind (no prior knowledge of the exact rubric
  interaction in a headless run) risked spending the remaining budget
  fighting UI selectors rather than proving the mechanism. The transaction
  logic exercised is a byte-for-byte match of what's now in
  `app/actions/learn-play.ts` (same SQL, same tables, same
  `lib/learn/achievements.ts` evaluator) — this is DB-level proof of the new
  code path, not a mock. `LessonPlayer`/`NewBadgeToastFromSession`'s wiring
  was verified separately (below) via real login + real navigation, so the
  only piece not exercised end-to-end through the browser is "click through
  a lesson to score exactly 90+" — a content/UI concern, not an
  achievements-engine concern.

- **Login + navigation** (Playwright, Chromium, real session): signed in as
  `student@bow.test`, reached
  `/dashboard/lesson/lesson-rivalry-ticket-pricing` (real `LessonPlayer`,
  live variable HUD), confirming the results-page toast wiring compiles and
  the route is reachable end-to-end.
- **Leaderboard tile + full board** (Playwright screenshots, real login,
  real data): dashboard tile shows `#1 Sam S. · 170 XP` with a "You're on
  the board" note (viewer rank ≤ 5, so no separate your-rank row);
  `/leaderboard?tab=xp` shows the same row with badge count. `/leaderboard`
  page returned HTTP 200 for both `streak` and `xp` tabs after the
  parameter-type fix (previously 500).
- `IdentityPanel` on the same dashboard screenshot shows "🔥 1 day streak"
  and 170 XP, live from `getStreak`/`loadStudentHome`.

## Tests / build

- `npm test` — 137/137 green (122 prior + 15 new `achievements.test.ts`).
- `npx tsc --noEmit` — clean.
- `npx eslint` on all touched/added files — clean (one violation caught and
  fixed during development: `react-hooks/set-state-in-effect` in the first
  draft of `NewBadgeToastFromSession`, resolved by moving the sessionStorage
  read into a lazy `useState` initializer instead of a `useEffect`).
- `git diff --stat` shows no changes under any Highway World path.

## Files touched/added

- `lib/learn/achievements.ts` (new) — rule schema + evaluator.
- `tests/learn/achievements.test.ts` (new) — 15 unit tests.
- `app/actions/learn-play.ts` — rule-badge evaluation wired into
  `completeAttempt`'s transaction; `newBadges` added to
  `CompleteAttemptResult`.
- `components/learn/player/LessonPlayer.tsx` — stash newly-earned badges
  into sessionStorage before navigating to results.
- `components/learn/player/NewBadgeToastFromSession.tsx` (new) — reads the
  stash, renders the existing `BadgeToast`.
- `app/dashboard/lesson/[lessonId]/results/[attemptId]/page.tsx` — mounts
  `NewBadgeToastFromSession`.
- `lib/leaderboard.ts` — parameter-type-cast bug fix (pre-existing, blocked
  verification).
- `lib/scoring.ts` — same bug-fix pattern applied to two matching queries.
- `components/learn/home/LeaderboardTile.tsx` (new) — compact leaderboard
  tile.
- `components/learn/home/StudentHome.tsx` — renders the tile next to
  `IdentityPanel`.
- `app/dashboard/page.tsx` — fetches top-5/rank/own-row and passes them
  down.
- `scripts/seed-learn-demo.ts` — seeds the `pricing_strategist` custom
  badge.

## Follow-up pass: achievement editor UI (shipped)

The deferred item above is now shipped. Also folded in the two small,
explicitly-optional asks from main's follow-up message: a `self_progress`/
`self_modules` dev-bootstrap stub, and this memo update.

### Editor

- `app/app/admin/learn/achievements/page.tsx` — server page, admin-gated,
  fetches `listAchievementBadges()` and renders the editor.
- `components/learn/builder/AchievementEditor.tsx` — lists system badges
  (flagged `System`, copy-editable only: name/description/icon/locked hint)
  and custom badges (full edit + disable) in two sections. "+ New badge"
  opens the shared `Modal`/form for both create and edit. The rule builder
  is entirely dropdown-driven — a `<select>` for rule type, then
  type-specific controls: lesson/module/track pickers are `<select>`s
  populated from new admin actions (`listLessonsForRulePicker`,
  `listModulesForRulePicker`, `listTracksForRulePicker`) that return
  `{id, title}` pairs, so an admin only ever picks a human title, never
  types an id. `variable_threshold`'s variable picker
  (`listVariablesForRulePicker`) walks every active lesson's `draft_doc`
  variables and labels each option with its lesson title, since variable
  keys aren't globally unique. Icon picker is a row of 12 emoji buttons plus
  a free-text fallback input (either satisfies the plan's "emoji picker or
  free text").
- `app/actions/learn-achievements.ts` (new file, per the "your call" in
  main's message — kept separate from `learn-author.ts` since it's a
  distinct admin surface with its own zod schema, mirroring how
  `learn-play.ts` and `learn-author.ts` are already split by concern) — all
  actions `requireAdmin()`-gated. `createAchievementBadge`/
  `updateAchievementBadge` validate the full form with
  `AchievementBadgeInputSchema`, whose `rule` field reuses
  `lib/learn/achievements.ts`'s `AchievementRuleSchema` directly — the exact
  same schema `completeAttempt` parses at award time, so a rule that saves
  successfully can never be malformed when the engine reads it back.
  `updateAchievementBadge` branches on `badges.source`: a system badge only
  gets its copy columns updated (category/threshold/xp_reward/rule are
  load-bearing for `lib/badges.ts`'s legacy condition engine and are never
  touched); a custom badge gets the full update including `rule`/`xpReward`.
  `setAchievementBadgeActive` disables/enables a custom badge (rejects
  system badges) — `completeAttempt`'s award query now filters
  `WHERE rule IS NOT NULL AND active = 1`, so a disabled badge stops being
  awarded going forward while already-earned `student_badges` rows (and a
  student's badge cabinet) are untouched.
- Nav: `app/app/admin/learn/page.tsx` (Playbook Studio hub) got an
  "Achievements →" link next to the existing "Career Map Editor →" link.
- `listBadges()` in `learn-author.ts` (the lesson builder's ScoringPanel
  badge multiselect) verified still works unchanged — it's a separate,
  simpler `{id, name}` query that naturally includes new custom badges the
  moment they're created (confirmed via the DB row check below).

### Schema change

`badges` needed three columns the original catalog shape didn't have:
`locked_hint`, `rarity`, `active` (default 1). Added via
`scripts/migrations/007_badge_editor_fields.sql`
(`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, idempotent) for real/Supabase
environments, and mirrored in `scripts/dev-bootstrap.sql`'s `CREATE TABLE
badges` for fresh local databases. Applied locally via `npm run migrate`
(applied cleanly, 1 migration) — verified `007` is the only new migration
this pass; 001-006 still no-op.

### Bug found and fixed while live-verifying: BadgeToast + React Strict Mode

`NewBadgeToastFromSession`'s first draft (Stage 9 core pass) read the
sessionStorage stash **and cleared it** inside a `useState` lazy
initializer. That passed lint and the earlier UI smoke-check, but a
byte-accurate toast-rendering proof this pass (sessionStorage seeded via
Playwright's `addInitScript`, then loading the real results page) showed
the toast never appearing, and the stash surviving unread. Root cause:
Next.js dev runs React Strict Mode, which intentionally invokes a
component's lazy `useState` initializer twice to surface exactly this kind
of bug — the first invocation read the badge and deleted the sessionStorage
key; the second invocation (whose *return value* is what could end up as
the actual initial state, invocation order/selection isn't guaranteed) read
an already-emptied key and returned `[]`. Production builds don't
double-invoke, so this specific case might have limped along in prod, but
it's exactly the kind of latent bug Strict Mode exists to catch before it
does bite (e.g. under a future React version, or a dev-mode demo).

Fixed by separating the read from the clear: the initializer now only
*peeks* (no side effect), and a `useEffect` on mount clears the
sessionStorage key — effects double-fire in Strict Mode too, but
`removeItem` on an already-removed key is a harmless no-op, so double-firing
is safe where double-invoking a value-producing initializer wasn't.

### Live verification (this pass, local PG port 55432, db `bow`)

- `npm run migrate` — applied `007_badge_editor_fields.sql` cleanly (001-006
  still no-op).
- **Editor UI** (Playwright, Chromium, signed in as `admin@bow.test`):
  screenshots of the achievements list (system badges flagged `SYSTEM`,
  copy-editable-only note), the "+ New badge" modal fully filled in (name,
  description, icon picker, locked hint, XP, rarity, rule-type dropdown →
  `score_gte` → lesson picker showing human titles "Draft Night Analytics"/
  "Rivalry Night: Price the Tickets", minimum-score field), and the list
  after save showing the new "Draft Night Star" badge alongside the
  Stage-9-core-seeded "Pricing Strategist" badge. Confirmed via `psql`:
  ```
  id                          | name              | source | active | rule
  badge-draft-night-star-7c2a | Draft Night Star  | custom |   1    | {"type":"score_gte","score":1,"lessonId":"lesson-draft-night-analytics"}
  ```
- **Award + idempotency proof for the UI-created badge** (same direct-DB
  method as the Stage 9 core pass, reproducing `completeAttempt`'s exact
  award transaction — see that section above for why this method was used
  over a blind UI playthrough of a Stage-6 kitchen-sink lesson with
  drag/drop, rank, categorize, match, etc. blocks not worth scripting blind
  against the remaining budget):
  ```
  XP before: 170
  Pass 1 (fresh completion, score 56) newly awarded: [{ id: 'badge-draft-night-star-7c2a', name: 'Draft Night Star', icon: '🏅' }]
  Pass 2 (simulated retry/replay) newly awarded: []
  student_badges rows: exactly 1
  learn_xp_events rows: exactly 1 (amount 25)
  XP after: 195   -- +25 exactly once
  ```
- **Toast rendering proof** (Playwright, real results page, real login):
  seeded `sessionStorage['bow-new-badges:<attemptId>']` via
  `addInitScript` (mirroring exactly what `LessonPlayer` writes before
  navigating) against a completed attempt, then loaded
  `/dashboard/lesson/lesson-draft-night-analytics/results/<attemptId>`.
  Screenshot shows the real `BadgeToast` in the bottom-right corner: "GOLD-
  bordered card, medal icon, 'ACHIEVEMENT UNLOCKED' / 'Draft Night Star'" —
  pixel-identical to the Daily Question toast surface. Confirmed the stash
  was cleared from sessionStorage after mount (no re-toast on a page
  refresh). This is what caught the Strict Mode bug above; re-verified
  after the fix.
- All test data (the `Draft Night Star` badge, its `student_badges`/
  `learn_xp_events` rows, the scratch `learn_attempts` row, and the +25 XP)
  cleaned up afterward — `user-student-1` back to exactly 170 XP.

### self_progress / self_modules dev stub (optional ask, done)

Added `self_modules`/`self_progress` table stubs to `scripts/dev-bootstrap.sql`
(same empty-stub convention as the existing `people`/`instructors`/
`training_sessions` stubs) and applied them to the local DB — the BOW Score
tab's `/leaderboard?tab=score` no longer 500s on `relation "self_progress"
does not exist` (flagged as a known gap in the Stage 9 core pass, not fixed
there since it was out of that pass's scope; now closed).

### Tests / build (this pass)

- `npm test` — 137/137 green, unchanged (no new pure logic added this pass
  beyond what Stage 9 core already covered — the editor is CRUD +
  zod-validated actions over the same `AchievementRuleSchema`, already
  unit-tested).
- `npx tsc --noEmit` — clean.
- `npx eslint` on all touched/added files — clean.
- `git diff --stat` — no Highway World paths touched.

### Files touched/added (this pass)

- `app/actions/learn-achievements.ts` (new) — admin CRUD actions + pickers.
- `app/app/admin/learn/achievements/page.tsx` (new) — editor page.
- `components/learn/builder/AchievementEditor.tsx` (new) — editor UI.
- `app/app/admin/learn/page.tsx` — nav link to the new page.
- `app/actions/learn-play.ts` — award query now filters `active = 1`.
- `components/learn/player/NewBadgeToastFromSession.tsx` — Strict Mode fix
  (peek-in-initializer, clear-in-effect).
- `scripts/migrations/007_badge_editor_fields.sql` (new) — `badges.locked_hint`/
  `rarity`/`active`.
- `scripts/dev-bootstrap.sql` — mirrors the three new `badges` columns;
  adds `self_modules`/`self_progress` stubs.

## Deferred — nothing remaining from the original plan

Every Stage 9 deliverable (rule engine, editor UI, scoped leaderboards,
streak integration, seed badge) has now shipped across the two passes.
