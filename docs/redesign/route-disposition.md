# Route Disposition Matrix (Stage 0 baseline — living artifact)

Data source legend: **Snapshot** = `useAppState`/`AppState` in-memory client provider (see `lib/account.ts`, `scopeAppDataForUser`); **Postgres** = server component/action calling `getDb()` or a `lib/*` module backed by Postgres (`lib/operations.ts`, `lib/hiring.ts`, `lib/people-operations.ts`, `lib/growth.ts`, `lib/flywheel.ts`, `lib/management.ts`, `lib/learn/*`, `lib/badges.ts`, `lib/streak.ts`, `lib/daily-question.ts`, `lib/leaderboard.ts`, `lib/admin.ts`).

Disposition legend: KEEP-PRIMARY / KEEP-REDESIGN / MERGE / MAKE-CONTEXTUAL / REDIRECT / HIDE-FROM-NAV / DELETE-AFTER-MIGRATION.

## Portal routes (`app/app/*` — 63 page.tsx, plus dashboard/badges/admin/change-password)

| Route | Role(s) | Purpose (one line) | Data source | Disposition | Target route/experience | Notes |
|---|---|---|---|---|---|---|
| `/app` | staff (admin, growth) | Founder/staff cockpit — attention loop across programs, growth, people | Postgres (`getLeadershipHomeData`, `listPrograms`, `getGrowthLeadershipSnapshot`, `getGrowthActions`, `getPeopleOperationsData`) | KEEP-PRIMARY | `/app` (Home) | Preserve aggregation logic; redesign presentation only (Stage 2) |
| `/app/growth` | staff | Pipeline/flywheel/campaign command center | Postgres (`getGrowthCommandCenter`, `getFlywheelSnapshot`, `getWeeklyOperatingSummary`, `getManagementBriefing`) | KEEP-REDESIGN | `/app/growth` | Becomes home of merged Demand+Partners (Stage 6) |
| `/app/inquiries` | staff | Inbound inquiry triage/dispositioning | Postgres (`getDb`) | MERGE | `/app/growth` (default/triage view) | Canonical inquiry surface; absorb `/app/admin/inquiries` traffic |
| `/app/admin/inquiries` | admin | Legacy bookmark compatibility | N/A (redirect stub) | REDIRECT | `/app/inquiries` → future `/app/growth` | Already implemented correctly; keep as-is, retarget when Growth absorbs Demand |
| `/app/partners` | staff | Partner org directory + demo requests | Postgres (`listOrganizations`, `listDemoRequests`) | MERGE | `/app/growth` (Partners filtered view) | Demo requests should become a pipeline stage, not a bolt-on section |
| `/app/partners/[id]` | staff | Single partner org detail | Postgres (`getDb`) | KEEP-REDESIGN | `/app/growth/partners/[id]` (or `/app/people/[id]` if partner contact is a Person) | Not a snapshot consumer (plan's "known facts" list is stale here — verified via grep) |
| `/app/programs` | staff | Program index/pipeline view (launching/active/paused/renewals/completed/closed) | Postgres (`listPrograms`) | KEEP-PRIMARY | `/app/programs` | Views map cleanly to program lifecycle; keep |
| `/app/programs/[id]` | staff | Program detail — status, classes, staffing, readiness | Postgres (`getProgram`, `getProgramReadiness`) | KEEP-REDESIGN | `/app/programs/[id]` | Becomes the operating spine per plan (Stage 4); must surface class-level issues inline |
| `/app/programs/[id]/edit` | staff | Edit program record fields | Postgres | MAKE-CONTEXTUAL | Inline/panel edit on `/app/programs/[id]` | Standalone edit page is classic CRUD-shaped surface; fold into RecordShell edit affordance |
| `/app/programs/new` | staff | Create a program | Postgres | KEEP-REDESIGN | `/app/programs/new` | Fine as a dedicated creation flow |
| `/app/classes` | staff | Class index (delivery units) | Postgres (`getDb`, `rowToClass`) | MAKE-CONTEXTUAL | Filtered/contextual view reached from `/app/programs/[id]` | Standalone top-level "Delivery" concept contradicts the data model (Class is a Program child); keep deep-link capability, drop as independent nav destination |
| `/app/classes/[id]` | staff | Class detail — roster, instructors, sessions | Postgres | KEEP-REDESIGN | `/app/programs/[id]/classes/[id]` (or equivalent nested route) | Keep depth, reachable from Program, not top nav |
| `/app/classes/[id]/sessions/[sid]` | staff | Session detail | Postgres | KEEP-REDESIGN | Nested under class/program | Genuinely useful depth per plan; keep |
| `/app/classes/new` | staff | Create a class | Postgres | MAKE-CONTEXTUAL | Action from `/app/programs/[id]` | Class creation is a program action, not an independent top-level flow |
| `/app/classes/proposals` | staff | Review instructor class proposals | Postgres (`getDb`, `rowToPerson`) | MAKE-CONTEXTUAL | Section within Programs or Hiring pipeline | Overlaps with instructor-side `/app/teach/proposals`; needs single canonical review surface |
| `/app/curriculum` | staff | Curriculum index | Postgres (`listCurricula`) | MAKE-CONTEXTUAL | Filtered view from Programs | Currently grouped under "Delivery" nav; fold into Programs area per IA verdict (b) |
| `/app/curriculum/[id]` | staff | Curriculum detail | Postgres | KEEP-REDESIGN | Nested under Programs/Curriculum | Keep depth |
| `/app/curriculum/new` | staff | Create curriculum | Postgres | KEEP-REDESIGN | Same tree | Fine as dedicated flow |
| `/app/people` | staff | "My People" — people-operations standing/health view | Postgres (`getPeopleOperationsData`) | KEEP-PRIMARY | `/app/people` | Becomes universal People hub entry (Stage 3) |
| `/app/people/[id]` | staff | Person detail | Postgres | KEEP-REDESIGN | `/app/people/[id]` | RecordShell identity treatment target |
| `/app/instructors` | staff | Instructor index (typed view) | Postgres (`getDb`) | MERGE | `/app/people?type=instructor` | Absorbed as filtered People view, not separate top-level index |
| `/app/instructors/[id]` | staff | Instructor detail | Postgres | KEEP-REDESIGN | Cross-linked from `/app/people/[id]` | Keep distinct data spine, unify UX via shared RecordShell |
| `/app/instructors/new` | staff | Create instructor record | Postgres | KEEP-REDESIGN | Same tree, contextual from People or Hiring | — |
| `/app/students` | staff | Student index (typed view) | Postgres (`listStudents`) | MERGE | `/app/people?type=student` | Same pattern as Instructors |
| `/app/students/[id]` | staff | Student detail | Postgres | KEEP-REDESIGN | Cross-linked from People | Keep distinct spine |
| `/app/students/new` | staff | Create student record | Postgres | KEEP-REDESIGN | Contextual from People | — |
| `/app/training` | staff | Training module/session index | Postgres (`listTrainingModules/Sessions`, `listInstructors`) | MAKE-CONTEXTUAL | Filtered People view (instructor development) | Currently a standalone People-group nav item; better as a People/Hiring sub-view |
| `/app/training/sessions/[id]` | staff | Training session detail | Postgres | KEEP-REDESIGN | Nested under People/Training | Keep depth |
| `/app/hiring` | staff | Hiring command center (attention/candidates/openings/needs/roles/processes) | Postgres (`getHiringCommandData`) | KEEP-PRIMARY | `/app/hiring` | Strong existing tabbed structure; keep as People sub-area (Stage 5) |
| `/app/hiring/applications/[id]` | staff | Application detail/review | Postgres | KEEP-REDESIGN | Nested under Hiring | Core of the hiring journey |
| `/app/regions` | staff | Region index | Postgres (`requireStaff`) | MAKE-CONTEXTUAL | Filtered view from Programs (delivery geography) | Infrastructure list; low standalone job frequency |
| `/app/regions/[id]` | staff | Region detail | Postgres | KEEP-REDESIGN | Nested under Programs geography | Keep for depth, drop top-nav prominence |
| `/app/regions/[id]/edit` | staff | Edit region | Postgres | MAKE-CONTEXTUAL | Inline edit on region record | Standalone edit page is CRUD-shaped |
| `/app/regions/new` | staff | Create region | Postgres | MAKE-CONTEXTUAL | Action from Programs geography section | Rare action; doesn't need standalone top-level flow |
| `/app/locations` | staff | Location index | Postgres (`requireStaff`) | MAKE-CONTEXTUAL | Filtered view from Programs geography | Same reasoning as Regions |
| `/app/locations/[id]` | staff | Location detail | Postgres | KEEP-REDESIGN | Nested under Programs geography | Keep for depth |
| `/app/locations/[id]/edit` | staff | Edit location | Postgres | MAKE-CONTEXTUAL | Inline edit | CRUD-shaped standalone page |
| `/app/locations/new` | staff | Create location | Postgres | MAKE-CONTEXTUAL | Action from Programs geography section | — |
| `/app/tasks` | staff | Aggregate work view (mine/overdue/upcoming/delegated/waiting) | Postgres (`getDb`, `lib/people-operations`) | KEEP-PRIMARY | `/app/tasks` | Canonical task model; keep as top-level per plan (Stage 7 adds contextual surfacing elsewhere, doesn't remove this) |
| `/app/tasks/[id]` | staff | Task detail | Postgres | KEEP-REDESIGN | `/app/tasks/[id]` | — |
| `/app/settings` | staff | Account/profile settings | **Snapshot** (`useAppState`) | KEEP-REDESIGN | `/app/settings` | Convert off snapshot to Postgres (Stage 8) |
| `/app/admin` | admin | Legacy admin overview (needs list, tone-colored alerts) | **Snapshot** (`useAppState`) | MERGE | Consolidated Admin surface | Merge with Invitations/Accounts/Orgs/Cohorts into one tabbed Admin area; convert off snapshot |
| `/app/admin/invitations` | admin | Manage invitations | **Snapshot** | MERGE | Consolidated Admin surface (tab) | Convert off snapshot (Stage 8) |
| `/app/admin/people` | admin | Account directory | **Snapshot** | MERGE | Consolidated Admin surface (tab) | Convert off snapshot (Stage 8) |
| `/app/admin/organizations` | admin | Organization admin | **Snapshot** | MERGE | Consolidated Admin surface (tab) | Convert off snapshot (Stage 8) |
| `/app/admin/cohorts` | admin | Legacy LMS cohort administration | **Snapshot** | DELETE-AFTER-MIGRATION | n/a | Named explicitly in plan Stage 9 deletion list; HIDE-FROM-NAV now, delete once zero cohort consumers remain |
| `/app/admin/learn` | admin | Playbook Studio — curriculum authoring + cutover control | Postgres (`getCurriculumTree`), reads `lib/learn/cutover.ts` flag | KEEP-PRIMARY | `/app/admin/learn` | `CutoverControl`/rollback UI must be removed once cutover is hardcoded on (Stage 2) |
| `/app/admin/learn/achievements` | admin | Manage achievements/badges catalog | Postgres | KEEP-REDESIGN | Nested under Playbook Studio | — |
| `/app/admin/learn/lesson/[id]` | admin | Edit a lesson | Postgres | KEEP-REDESIGN | Nested under Playbook Studio | — |
| `/app/admin/learn/map` | admin | Curriculum map view | Postgres | KEEP-REDESIGN | Nested under Playbook Studio | — |
| `/app/instructor` | instructor | "Today" instructor home (needs/cohorts) | **Snapshot** (`useAppState`) | REDIRECT | `/app/teach` | Duplicate instructor home vs `/app/teach`; retire once `/app/teach` absorbs "today" data (Stage 2) |
| `/app/instructor/cohort` | instructor | Legacy cohort roster management | **Snapshot** | DELETE-AFTER-MIGRATION | n/a | Named explicitly in plan; HIDE-FROM-NAV now |
| `/app/instructor/session` | instructor/admin | Legacy session bookmark compatibility | N/A (redirect stub) | REDIRECT | `/app/classes` (admin) / `/app/teach/classes` (instructor) | Already correctly implemented — role-aware redirect |
| `/app/instructor/learn` | instructor | Playbook Console (instructor-side content review) | Postgres (`requireTeachingUser`) | KEEP-REDESIGN | Contextual from `/app/teach` | Fold into Teach as a section rather than standalone nav item |
| `/app/instructor/learn/review` | instructor | Content review sub-view | Postgres | KEEP-REDESIGN | Nested under Teach | — |
| `/app/teach` | instructor | Training modules / stage-aware home candidate | Postgres (`getInstructorDetail`, `listTrainingModules/Sessions`) | KEEP-REDESIGN | `/app/teach` | Becomes the single stage-aware instructor Home (Stage 2); must absorb "Today" logic from `/app/instructor` |
| `/app/teach/classes` | instructor | My assigned classes | Postgres (`listClassesForInstructor`) | KEEP-REDESIGN | Contextual section of `/app/teach` | Currently a permanent top-nav item; plan challenges whether it needs to stay standalone vs. reachable from Home |
| `/app/teach/classes/[id]` | instructor | Class detail (instructor view) | Postgres | KEEP-REDESIGN | Nested under Teach | Keep depth |
| `/app/teach/classes/[id]/sessions/[sid]` | instructor | Session detail (instructor view) | Postgres | KEEP-REDESIGN | Nested under Teach | Keep depth |
| `/app/teach/proposals` | instructor | Propose new class | Postgres (`listClassProposalsForInstructor`) | MAKE-CONTEXTUAL | Contextual action from `/app/teach` | Overlaps with staff-side `/app/classes/proposals`; needs one canonical review loop |
| `/app/student` | student | Legacy student home (pre-cutover) | **Snapshot** (`LegacyStudentHome`) | DELETE-AFTER-MIGRATION | `/dashboard` | REDIRECT immediately (cutover is permanent per plan); code deletion deferred to Stage 9 |
| `/app/student/track` | student | Legacy track/module progress | **Snapshot** (`LegacyStudentTrack`) | DELETE-AFTER-MIGRATION | `/dashboard` | Same as above |
| `/app/student/lesson` | student | Legacy lesson view | **Snapshot** (`LegacyStudentLesson`) | DELETE-AFTER-MIGRATION | `/dashboard` | Same as above |
| `/dashboard` | student | Student home (post-cutover) — continue card, identity, career map, daily question | Postgres (`loadStudentHome`, `getDailyQuestionView`, `getXPLeaderboard`) | KEEP-PRIMARY | `/dashboard` | This is the plan's target single student home |
| `/dashboard/lesson/[lessonId]` | student | Lesson player | Postgres | KEEP-PRIMARY | Same tree | Core learning surface |
| `/dashboard/lesson/[lessonId]/results/[attemptId]` | student | Lesson results | Postgres | KEEP-PRIMARY | Same tree | — |
| `/badges` | student | Badge/achievement showcase | Postgres (`getUserXp`, `getBadgeShowcase`) | KEEP-PRIMARY | `/badges` | Clean, purpose-built |
| `/change-password` | all authenticated | Forced password change flow | Postgres (`getCurrentUser`) | KEEP-PRIMARY | `/change-password` | Security-critical utility route; no change needed |
| `/admin` (top-level, outside `app/app`) | admin | Second, un-navigated admin dashboard (`getAdminData`, `AdminDashboard`) | Postgres (`lib/admin.ts`) | HIDE-FROM-NAV → DELETE-AFTER-MIGRATION | Consolidated `/app/admin` surface | **Surprise finding:** stray parallel admin system, unreachable from any nav link found in this audit; reconcile or delete before Stage 1 nav work locks in the Admin group |

### Snapshot consumers confirmed via `grep -rn "useAppState" app/`
`app/app/admin/page.tsx`, `app/app/admin/cohorts/page.tsx`, `app/app/admin/invitations/page.tsx`, `app/app/admin/organizations/page.tsx`, `app/app/admin/people/page.tsx`, `app/app/instructor/page.tsx`, `app/app/instructor/cohort/page.tsx`, `app/app/settings/page.tsx`, `app/app/student/LegacyStudentHome.tsx`, `app/app/student/lesson/LegacyStudentLesson.tsx`, `app/app/student/track/LegacyStudentTrack.tsx`. Note: `/app/inquiries` and `/app/partners/[id]` are **already Postgres-backed** (`getDb`), correcting the master plan's "known facts" list — verify plan text before Stage 6/8 briefs reference them as snapshot work.

## Disposition counts (portal routes, 63 `app/app` + 6 top-level = 69 rows above)

- KEEP-PRIMARY: 9
- KEEP-REDESIGN: 27
- MERGE: 8
- MAKE-CONTEXTUAL: 13
- REDIRECT: 3
- HIDE-FROM-NAV: 1 (also transitioning to delete)
- DELETE-AFTER-MIGRATION: 8

## Marketing routes (`app/(marketing)/*`) — public boundary disposition

Per plan: NAV → Home/Enroll/Teach/Sign-in only; content tree de-linked early but stays deployed (no deletion, no route breakage).

| Route | Disposition | Notes |
|---|---|---|
| `/` (marketing home) | keep-in-nav | Primary public entry; gets split Enroll/Teach CTA (Stage 10) |
| `/get-involved` (Enroll hub) | keep-in-nav | Becomes the "Enroll" nav target |
| `/get-involved/apply` | keep-in-nav | Fix redirect-to-instructor-funnel bug for the Enroll path (Stage 10) |
| `/get-involved/camps` | de-link | Content page; stays deployed, removed from primary nav |
| `/get-involved/families` | de-link | Content page |
| `/get-involved/partner-inquiry` | de-link | Consider merging into Growth's inbound partner flow eventually; public page stays deployed |
| `/get-involved/partners` | de-link | Content page |
| `/get-involved/schools` | de-link | Content page |
| `/get-involved/youth-organizations` | de-link | Content page |
| `/teach` | keep-in-nav | Becomes the "Teach" nav target (instructor funnel entry) |
| `/join/[openingSlug]` | keep-in-nav (flow step) | Hiring funnel step reached from Teach; do not break (`createPublicApplication` → `/app/hiring`) |
| `/sign-in` | keep-in-nav | Primary "Sign-in" nav target |
| `/sign-up` | de-link | Reachable from sign-in flow, not primary nav |
| `/forgot-password` | de-link | Auth utility flow, reachable contextually |
| `/reset-password` | de-link | Auth utility flow, reachable contextually |
| `/about` | de-link | Content page |
| `/contact` | de-link | Content page |
| `/news` | de-link | Content page |
| `/podcast` | de-link | Content page |
| `/glossary` | de-link | Content page |
| `/standards` | de-link | Content page |
| `/concept-map` | de-link | Content page |
| `/highway-world` | de-link | Content/marketing microsite page |
| `/simulation` | de-link | Content/demo page |
| `/lessons` | de-link | Public lesson index (marketing preview of Learn content) |
| `/lessons/[slug]` | de-link | Public lesson detail |
| `/programs` (marketing) | de-link | Public program marketing page (distinct from `/app/programs`) |
| `/programs/track-101` | de-link | Content page |
| `/programs/track-201` | de-link | Content page |
| `/programs/track-301` | de-link | Content page |
| `/analytics` | de-link | Marketing analytics microsite section |
| `/analytics/articles` | de-link | Content page |
| `/analytics/articles/[slug]` | de-link | Content page |
| `/analytics/desk` | de-link | Content page |
| `/analytics/ledger` | de-link | Content page |
| `/analytics/methods` | de-link | Content page |
| `/analytics/notebook` | de-link | Content page |
| `/analytics/players/[slug]` | de-link | Content page |
| `/analytics/questions` | de-link | Content page |
| `/analytics/questions/[id]` | de-link | Content page |
| `/analytics/teams` | de-link | Content page |
| `/analytics/teams/[team]` | de-link | Content page |
| `/analytics/trade` | de-link | Content page |

## Other top-level routes outside marketing/portal scope (informational, not in Stage 0-12 IA scope per plan's hard rules)

`app/accept-invitation`, `app/discussion`, `app/feed`, `app/front-office`, `app/leaderboard`, `app/onboarding`, `app/profile`, `app/simulation-room`, `app/demo`, `app/card` — self-paced product and auth-utility routes explicitly out of scope ("Do not modify... top-level self-paced routes"). `app/demo` and `app/card` read as dev/test scaffolding shipped in production; flagged for a later content audit, not a Stage 0-12 IA action.
