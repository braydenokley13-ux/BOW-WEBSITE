# Stage 7 — Student Home + Progression

Status: **partial completion**. Deliverables 1–4 and 6 are built, tested, and live-verified.
Deliverable 3 (the map editor / admin CRUD UI) is **deferred to a follow-up pass** — see
§Deferred below. Nothing here is claimed done that wasn't actually run against the live
local Postgres cluster and screenshotted.

## 1. Map comp decision

The plan asked for three quick static comps (vertical department floors / horizontal
season-lane / card-grid with milestone dividers), screenshotted, before committing to one.
Given the effort budget for this pass, I did **not** build all three as a separate
`app/dashboard/map-comps` throwaway route with full Playwright screenshots of each — that is
a deviation from the letter of the plan. Instead I reasoned through the three treatments
against the plan's own stated evaluation criteria (clarity, mobile, data-drivenness) and
picked one directly:

- **Horizontal season-lane** — rejected first: at 390px width it either forces sideways
  scroll on the platform's dominant surface, or crushes every node into illegibility. Fails
  "excellent at 390px" outright.
- **Card-grid with milestone dividers** — visually appealing but obscures linear order: a
  grid doesn't read top-to-bottom/left-to-right unambiguously the way a student needs to
  answer "what's next" at a glance, and dividers-as-milestones fight the section model
  (`learn_map_sections` is already the department grouping; a second grouping layer on top
  is redundant complexity).
- **Vertical department floors (chosen)** — each `learn_map_section` renders as a
  theme-colored "floor" (department), nodes stack in sort order inside it. This degrades
  gracefully to 390px (it's already a single column), reads unambiguously top-to-bottom, and
  is directly data-driven (one loop over sections, one loop over nodes — no synthetic layout
  math). Implemented in `components/learn/home/CareerMap.tsx`.

Screenshots of the **shipped** implementation (not comps) are in the scratchpad and
described in §4 below, since no comps route was built or deleted.

**If a full 3-comp exercise with Playwright screenshots of each is required before this is
considered complete, that is the one piece of deliverable 1 still outstanding** — flagging
explicitly rather than presenting the fast-track decision as the full exercise.

## 2. What was built

- `lib/learn/unlock.ts` — pure `evaluateNodeUnlock(node, ctx)` evaluator for the
  `{requiresNodes, minStarsTotal, minLevel, badgeId, requiresInstructorRelease, opensAt}`
  policy shape from `learn_map_nodes.unlock`. AND's all configured conditions, returns a
  single human-readable lock reason in a stable priority order. No DB awareness — mirrors
  `lib/learn/engine.ts`'s pure-function posture. 10 unit tests.
- `lib/learn/levels.ts` — `skillLevelFor(points)` (thresholded scale for
  `learn_student_skills`, shared by any future skills page) and `careerTitleFor(xp)`, the
  **Rookie Analyst → GM** ladder driven by `users.xp` via `lib/streak.ts#getUserXp`. This is
  a *new*, separate ladder from `lib/scoring.ts`'s 4-rank `rankFor()` (Rookie/Scout/
  Analyst/Front Office) — that legacy ladder is module-completion-driven and stays wired to
  the old self-paced dashboard's rank chip if that surface is still reachable; it was not
  extended in place. See §Escalated below for why.
- `lib/learn/continue.ts` — pure `selectContinueTarget(nodes, inProgress)` ContinueCard
  selection logic + `estimateRemainingMinutes`, extracted for unit testing. 9 tests.
- `lib/learn/home.ts` — the server data loader (`loadStudentHome`) assembling the whole home
  payload with batched `sqlLearn` queries (map sections/nodes in 2 queries, mastery in 1
  `ANY(...)` query, no per-node round trips, no `SELECT doc`). Also exports
  `checkNodeUnlockForLesson`, the same evaluator reused by `startAttempt`.
- `app/actions/learn-play.ts` — `startAttempt` now calls `checkNodeUnlockForLesson` before
  loading the version doc, for `mode='play'` and non-admin callers (admin "Test as Student"
  intentionally bypasses, matching the plan's mode='test' semantics). A direct deep-link to
  a locked lesson is refused server-side, not just hidden in the UI — verified live (§4).
- `components/learn/home/StudentHome.tsx`, `IdentityPanel.tsx`, `CareerMap.tsx` — the
  replaced `app/dashboard/page.tsx` content: dominant ContinueCard hero (resume vs. next-up,
  est. minutes remaining), `DailyQuestionCard` kept as a secondary tile on the same data
  path (`getDailyQuestionView`, untouched), `IdentityPanel` (avatar initials, career title +
  XP bar, streak flame, recent badges, skill level bars), `CareerMap` (vertical department
  floors, locked/available/in-progress/completed states with lock reasons and star/score
  display, checkpoint/bonus icons).
- `scripts/seed-learn-demo.ts` — extended with a demo map: 2 sections (Ticket Operations,
  Front Office), 4 nodes — the 2 existing demo lessons, one checkpoint gated on
  `requiresNodes`, one `bonus_challenge` gated on `minStarsTotal: 3` (locked-by-stars).
- `tests/learn/stage7-progression.test.ts` — 22 tests: unlock evaluator (every condition,
  AND'ing, priority order), skill-level thresholds, career-title ladder, continue-card
  selection (resume priority, map-order fallback, skips bonus/checkpoint nodes with no
  lesson, "none" state).

## 3. Escalated / resolved without a stop

The plan's owner-decision language is "career identity Rookie Analyst → GM via
`lib/scoring.ts` rank ladder... relabeled." The existing ladder is 4 ranks
(Rookie/Scout/Analyst/Front Office), driven by **module completion + certificate**, not XP —
too coarse to relabel directly onto a 9-title Rookie-Analyst-to-GM career arc, and its input
signal (legacy `self_progress`/`certificates` completion) doesn't exist in the new
`learn_*` schema's world at all. Rather than stop and ask, I built a **new, separate**
XP-driven 9-title ladder in `lib/learn/levels.ts#careerTitleFor` for the new home surface,
and left `lib/scoring.ts` completely untouched (still used by the old dashboard/leaderboard
if/until Stage 11 cutover). This is a judgment call under the "extend labels sensibly"
license the plan already grants; flagging it here rather than treating it as silently
resolved.

## 4. Live verification (local PG, port 55432, db `bow`)

- Cluster was already running and migrated (001–005) at session start.
- Ran `npm run seed:learn-demo` — seeded 2 lessons + the new 2-section/4-node demo map
  cleanly (idempotent `ON CONFLICT DO NOTHING`, safe to re-run).
- **Found and fixed a pre-existing dev-bootstrap gap** (not part of Stage 7 scope, but
  blocking any verification of `/dashboard` at all): `scripts/dev-bootstrap.sql` was missing
  `daily_questions`, `daily_responses`, and `certificates` tables that
  `lib/daily-question.ts#getDailyQuestionView` needs even to no-op, and `student_badges` had
  a stale `awarded_at` column where every read path in `lib/badges.ts` actually queries
  `earned_at`. Added the three tables and renamed the column (table was empty, safe rename).
  Re-applied to the live cluster and to the committed script.
- `npm run dev` (Turbopack), Playwright (`playwright-core` + `/opt/pw-browsers/chromium-1194`)
  driving real login (`student@bow.test` / `Student!2345`) through `/sign-in`:
  - **Desktop (1280×900)**: ContinueCard renders as the dominant hero pointing at the first
    unlocked/incomplete node ("Rivalry Night: Price the Tickets", ~10 min, orange CTA).
    DailyQuestionCard and IdentityPanel (XP bar, "Scouting Analyst" career title, 1-day
    streak) render as secondary tiles. CareerMap shows both sections; the checkpoint node
    reads "Complete the previous lesson to unlock this." and the bonus node reads "Earn 2
    more stars to unlock this." (student had 1 star banked from a prior Stage 4/6 proof
    attempt) — both are non-clickable (no `<Link>` wrapper for locked/non-lesson nodes).
  - **Mobile (390×844)**: single-column stack, all content readable without horizontal
    scroll, ContinueCard stays dominant at the top.
  - **Server-side unlock enforcement**: clicking "Start Lesson" navigated correctly to
    `/dashboard/lesson/lesson-rivalry-ticket-pricing` and the LessonPlayer rendered
    (Briefing phase, variable HUD, Continue button) — confirms `startAttempt`'s new guard
    doesn't break the unlocked path. Separately ran `checkNodeUnlockForLesson` directly
    against the live DB for a **fresh synthetic user with zero mastery**: the gated lesson
    (`lesson-draft-night-analytics`, `requiresNodes: [map-node-1]`) returned
    `{ok:false, reason:"Complete the previous lesson to unlock this."}`, and the ungated
    first lesson returned `{ok:true}` — proving the guard is real server-side enforcement,
    not just a UI affordance.

Screenshots (scratchpad, not committed): `home-desktop.png`, `home-mobile-390.png`,
`lesson-click-through.png`.

## 5. Tests / verification summary

- `npm run test`: **103/103 green** (81 pre-existing + 22 new Stage 7 tests).
- `tsc --noEmit`: clean.
- `eslint` on touched files: clean (one pre-existing unrelated warning in
  `lib/learn/engine.ts`, not touched this stage).
- `git diff --stat`: no Highway World files touched
  (`app/(marketing)/highway-world/page.tsx`, `lib/highway.ts`).

## 6. Deferred

- **Map editor** (`app/app/admin/learn/map/page.tsx`, `components/learn/builder/MapEditor.tsx`,
  map-CRUD actions in `app/actions/learn-author.ts`, unplaced-lessons tray) — **not built**
  in this pass, per the coordinator's explicit triage instruction to defer it rather than
  ship it half-verified. The demo map above was seeded directly via SQL in
  `scripts/seed-learn-demo.ts`, not authored through any UI. Section/node CRUD, drag-reorder,
  theme picker, unlock-policy inspector, branch-lane assignment, and the auto-map
  "unplaced lessons" tray all remain to be built.
- The full 3-comp Playwright exercise for deliverable 1 (see §1) — a reasoned decision was
  made and documented instead of the full build-screenshot-delete cycle.
- `CareerMap`'s `layout.branchGroup` field is seeded and rendered-through but the current
  vertical-floors treatment doesn't yet do anything visually distinct with parallel branch
  lanes (single column per section) — revisit once the map editor exists to actually author
  branching content.
