# YPP → BOW Migration Audit & Plan

## Context

BOW Sports Capital wants one connected site: the existing public BOW website plus a protected internal application (founder + growth-lead operating system) inside `bow-website`, reusing the strongest infrastructure from the much larger YPP portal. This task is the **read-only audit + migration plan**; a follow-up task implements it. Both repos were audited (nothing modified; both working trees clean on branch `claude/ypp-bow-migration-audit-ms4rt1`).

## 1. Executive Recommendation

**Reuse YPP's patterns and data-model shapes, not its files.** The two stacks are incompatible at nearly every layer:

| Layer | YPP (`/home/user/YPP-Portal`) | BOW (`/home/user/BOW-WEBSITE`) |
|---|---|---|
| Framework | Next 16.2.4, React 18 | Next 16.2.9, React 19, `proxy.ts` middleware, async `params` |
| Styling | Tailwind v4 + `components/ui-v2/` | **No Tailwind** — CSS tokens (`styles/tokens/*.css`) + `components/ds/` |
| DB | Prisma + Postgres/Supabase, 16,347-line schema, 500+ models | `node:sqlite` in `lib/db.ts`, ~35 tables |
| Auth | Supabase Auth (`lib/auth-supabase.ts`) + legacy next-auth remnants | Hand-rolled scrypt + `bow_session` cookie (`lib/session.ts`, `lib/dal.ts`, `proxy.ts`) |
| Deploy | Vercel, 12 cron jobs, blob/kv | Vercel, 1 cron, zero required env vars |

Copying YPP files literally would import Tailwind, Prisma, and Supabase into a repo that has none of them — three new subsystems for zero product gain. Meanwhile BOW already has working versions of most foundation pieces: auth, sessions, an `/app` internal section with admin/people/organizations/inquiries, server actions, in-app notifications, and a disciplined design system. YPP is also visibly mid-migration (two mentorship systems, two workflow engines, legacy auth alongside Supabase, `DEMO_MODE` gating) — a risky source for wholesale lifts.

**Strategy: extend BOW's existing stack, transplanting YPP's proven *designs*:** the authorization-guard structure, the declarative nav catalog + validator, the zod-first server-action mutation pattern, the ActionItem/Activity/Notes data-model shapes, the pipeline/timeline UX, and a handful of genuinely portable files (nav validator script, week helpers, audit-log shape).

## 2. Repository Overview

**YPP** — single Next.js app (not monorepo), `app/(app)/` authenticated surfaces, npm, Vitest+Playwright. Highly active development; root planning docs (`FINAL_REVIEW_REDESIGN_PLAN.md` 203KB, `MENTORSHIP_REDESIGN_PLAN.md`, etc.) show in-flight redesigns. Version drift: `eslint-config-next` 14.2.5 vs next 16.2.4. Env-gated preview/demo modes (`DEMO_MODE`, `PORTAL_PUBLIC_GATE`, hardcoded pilot-email allowlists).

**BOW** — single Next 16 app, npm, one route group `(marketing)` for the public site; authenticated surfaces are top-level segments (`/app`, `/admin`, `/dashboard`, `/instructor`, …) guarded by `proxy.ts` matcher + per-section `layout.tsx` + `lib/dal.ts`. All mutations are server actions in `app/actions/*` writing to SQLite. Forms already persist: contact → `inquiries` (`app/actions/lms.ts`), sign-up → `users`, demo requests → `demo_requests`, invitations, news submissions, feed signups. Highway World is a pure marketing page (`app/(marketing)/highway-world/page.tsx`, content in `lib/highway.ts`) — no engine to integrate yet. No email sending anywhere; notifications are in-app (`lib/notifications.ts`).

## 3. Reusable YPP Inventory (classification)

| YPP path | What it does | Classification | Required changes | Risk | BOW destination |
|---|---|---|---|---|---|
| `lib/authorization.ts` + `lib/authorization-roles.ts` | Guard functions (`requireSessionUser`, `requireOfficer`…) with pure role helpers split from `next/headers` code | **Adapt (pattern)** | Rewrite against BOW's `lib/dal.ts`/`lib/session.ts`; replace 9-role YPP enum with BOW roles | Low | `lib/authz.ts` in BOW |
| `lib/navigation/catalog.ts` + `scripts/validate-nav.mjs` | Declarative nav registry; CI check that every href resolves to a real page, no dupes | **Adapt** (catalog) / **Copy nearly as-is** (validator script) | New BOW catalog with 8 internal items; script needs path tweaks only | Low | `lib/navigation/catalog.ts`, `scripts/validate-nav.mjs` |
| Server-action pattern (`lib/weekly-meetings/*-actions.ts` as exemplar): `"use server"` → guard → `zod.parse` → mutate → `revalidatePath` | Mutation discipline | **Adapt (pattern)** | BOW already does this in `app/actions/*`; adopt YPP's zod-schema-per-domain file convention (`schemas.ts`) | Low | `app/actions/growth.ts` etc. |
| Prisma schema — `ActionItem`/`ActionAssignment`/`ActionComment` group (~13565–14126) | Generic task/follow-up system with assignments, comments, saved views | **Adapt (model shape)** | Re-express as SQLite tables (`tasks`, `task_comments`); drop departments/pulse-snapshots/email-log | Low | `lib/db.ts` |
| Prisma schema — `Meeting`/`MeetingAttendee`/`MeetingDecision`/`MeetingFollowUp` (~14167–14413) | Generic meeting primitives | **Extract later** | Only when BOW needs scheduled-conversation records beyond a task with a date | Low | deferred |
| `lib/weekly-meetings/week.ts` | Monday-UTC reporting-week helpers | **Copy nearly as-is** | None (pure functions) | Low | `lib/week.ts` (if weekly views needed) |
| `AuditLog` model + `lib/audit-log-actions.ts` | Generic audit trail | **Adapt (shape)** | SQLite table `activity` — doubles as the BOW activity-history feed | Low | `lib/db.ts` + `app/actions/activity.ts` |
| `Notification`/`NotificationPreference` + `lib/notification-*.ts` | Notification plumbing | **Do not copy** | BOW already has `lib/notifications.ts` + bell UI — keep BOW's | — | — |
| `components/ui-v2/` (33 primitives: data-table-shell, filter-bar, status-badge, preview-panel, entity-chip, empty-state, decision-dock…) | Design-system primitives | **Adapt (API only)** | Tailwind/CVA won't run in BOW; rebuild the ~6 needed primitives (DataTable, StatusBadge, Modal, EmptyState, FilterBar, PreviewPanel) on BOW tokens, mirroring ui-v2's prop APIs | Medium | `components/ds/` |
| `InstructorApplication*` pipeline (35+ models, schema ~2076–2973) | Elaborate hiring committee/chair/interview machinery | **Adapt (concept only)** | BOW needs ~2 tables: `instructor_applications` + stage enum + activity; none of the committee machinery | Medium | `lib/db.ts` |
| `Partner`/`PartnerContact`/`PartnerNote`/`PartnerRequest` (schema ~7598+) | Org/partner records with contacts + notes | **Adapt (shape)** | Merge with BOW's existing `organizations`/`partner orgs` tables | Low | `lib/db.ts` |
| `SearchDocument`/`SavedQuery`/`RecentEntityView` (~15086+) | Search index + saved views | **Extract later** | SQLite FTS5 is a simpler local answer when search is needed | Low | deferred |
| `lib/prisma.ts`, `lib/auth-supabase.ts`, `lib/legacy-auth*.ts` | DB client / Supabase auth / transitional auth | **Do not copy** | BOW keeps `lib/db.ts` + `lib/session.ts` | — | — |
| Tests harness (`vitest.config.ts`, `tests/stubs`) | Test infra | **Adapt** | BOW has no test setup; borrow vitest config shape | Low | repo root |

## 4. Do NOT Copy (confirmed present in YPP, excluded)

Mentorship (`lib/mentorship/` **and** `lib/mentorship-2/` — dual implementations, unclear which is live), student advising (`lib/advising/`, advisor models), instructor-development hierarchy (`lib/instructor-growth-*`, `lib/instructor-pathway-*`, XP/badges), command centers (`lib/command-center/`, `lib/admin-mentorship-command-center.ts`), Final Review decision rooms (`lib/final-review-*`, `app/review/`, `app/decide/`), Chief-of-Staff AI (`lib/help-agent/`), weekly-impact meeting OS (`lib/weekly-meetings/` beyond `week.ts`), performance reviews (`QuarterlyReview`, GR document system ~20 models), committees, both workflow engines (`WorkflowTemplate…` vs `Journey…` — competing implementations), the ~150-model student gamification block, parent portal, family/consent subsystem, leadership preview gating (hardcoded email rosters), legacy auth, `DEMO_MODE`/public-gate env machinery.

## 5. BOW Target Architecture

Keep BOW's existing conventions rather than forcing `(marketing)/(auth)/(app)`:

- **BOW already owns a literal `/app` segment** (`app/app/{admin,instructor,student}/…`) — its LMS. The internal BOW ops application extends this section, not a new route group.
- Introduce only an `(auth)` group to consolidate `/sign-in`, `/sign-up`, `/accept-invitation` (currently scattered) — optional, low priority.

Proposed internal routes (all under the existing `app/app/` tree, guarded by `proxy.ts` matcher + `app/app/layout.tsx` + `lib/dal.ts`):

```
app/app/
├── page.tsx              # role-aware home: Founder dashboard vs Growth "today" view
├── growth/               # outreach queue, campaigns, follow-ups, handoffs
├── organizations/        # schools, camps, partners + opportunity pipeline (extends existing admin/organizations)
├── instructors/          # instructor pipeline + profiles
├── students/             # student records + registrations (extends existing admin/people)
├── workshops/            # workshops, sessions, enrollments
├── chapters/             # chapter-candidate pipeline → approved chapters
└── tasks/                # tasks & follow-ups (ActionItem-shaped)
```

Nav: 8 items (Home, Growth, Organizations, Instructors, Students, Workshops, Chapters, Tasks) in a new `lib/navigation/catalog.ts` + adapted `scripts/validate-nav.mjs`, rendered by a BOW-styled sidebar in `app/app/layout.tsx`. Services stay in `lib/` (`lib/growth.ts`, `lib/pipeline.ts`); mutations in `app/actions/` per existing convention.

## 6. Data-Model Mapping (YPP → BOW, in `lib/db.ts` SQLite)

| YPP entity | BOW entity | Notes |
|---|---|---|
| `User`+`UserProfile` | existing `users` + new `people` | `people` = CRM person record (leads/contacts, may have no login); FK to `users` when they get an account. Single source for name/email/phone — never duplicated into pipeline tables |
| `Chapter`/`Partner` | `organizations` (extend existing) + `organization_opportunities` | org + pipeline stage + lead source |
| `ActionItem`/`ActionAssignment`/`ActionComment` | `tasks` (+ optional `task_comments`) | assignee, due, status, `handoff_to_founder` flag |
| `AuditLog` + per-entity notes (YPP has no generic Note — a smell to fix) | `activity` (polymorphic: entity_type, entity_id, kind, body, actor) | one table serves activity history, notes, and outreach interactions (`kind='outreach'` with channel field) |
| `InstructorApplication` (35 models) | `instructor_applications` (person_id, stage, answers JSON) | stages: applied → screening → founder_review → training → active |
| `WorkshopSeries/Session/Enrollment` (YPP student-gamification block) | `workshops`, `workshop_sessions`, `workshop_enrollments` | enrollment links `people` (student) + guardian person + permission_status |
| `ChapterPresidentApplication` | `chapter_candidates` (person_id, stage) → `chapters` + `chapter_memberships` | approval creates `chapters` row (founder-only) |
| `Meeting…` | deferred; a task with `due_at` + `kind='meeting'` initially | |
| — (new) | `growth_campaigns`, `highway_world_sessions` (id, external_session_id, join_url, status, results JSON — later) | |
| `FileUpload`/attachments | deferred (Vercel Blob later) | |

## 7. Permission Mapping

BOW roles: `founder`, `growth` (VP Growth & Expansion), `instructor`, `chapter_leader` — added to the existing `users` role column. Guards modeled on `lib/authorization.ts`'s structure but implemented on `lib/dal.ts`:

- `requireUser()` — any authenticated internal user (≈ `requireSessionUser`)
- `requireStaff()` — founder | growth (≈ `requireOfficer`)
- `requireFounder()` — chapter approval, instructor acceptance, curriculum, Highway World config (≈ `requireLeadership`)
- `requireChapterScope(chapterId)` — chapter_leader row-level scoping
- Pure role helpers in a client-safe module (mirroring `lib/authorization-roles.ts` split)

Growth can create/edit prospects, outreach, applications, registrations, tasks, campaigns, and set handoff flags; only `requireFounder()` guards approve/accept/curriculum mutations.

## 8. Public-to-Private Data Flow

All four forms follow BOW's existing contact-form pattern (`components/site/ContactForm.tsx` → server action → SQLite → admin surface), with YPP's zod-validate-first discipline:

1. **Instructor application** (new public page or extend `/get-involved`): action upserts `people` (by email), inserts `instructor_applications` (stage=applied), `activity` row, and a `tasks` follow-up assigned to growth.
2. **Student registration**: upserts student `people` + guardian `people` (+ relationship), inserts `workshop_enrollments` with permission_status, `activity` row; increments derive from count queries, not stored counters.
3. **Partnership inquiry** (extend existing `DemoRequestForm`/contact flow): upserts `organizations` + contact `people`, inserts `organization_opportunities` (with lead source), `activity`, follow-up `tasks`.
4. **Chapter interest**: upserts `people`, inserts `chapter_candidates` (stage=interest). **Never** creates a `chapters` row — that only happens via a founder-guarded approval action.

## 9. File-by-File Migration Plan (what the implementation task touches)

**Copy/port from YPP (small set):**
- `YPP-Portal/scripts/validate-nav.mjs` → `BOW-WEBSITE/scripts/validate-nav.mjs` (adjust catalog import path; wire `nav:check` npm script)
- `YPP-Portal/lib/weekly-meetings/week.ts` → `BOW-WEBSITE/lib/week.ts` (only if/when weekly rollups are built)
- Structure of `YPP-Portal/lib/authorization.ts` / `authorization-roles.ts` → new `BOW-WEBSITE/lib/authz.ts` + `lib/authz-roles.ts` (rewritten on `lib/dal.ts`)
- Structure of `YPP-Portal/lib/navigation/{catalog,types,resolve-nav,is-active}.ts` → `BOW-WEBSITE/lib/navigation/` (new catalog, drop per-role allowlist files)
- Prop APIs of `components/ui-v2/{data-table-shell,status-badge,modal,empty-state,filter-bar,preview-panel}.tsx` → new BOW-token-styled primitives in `BOW-WEBSITE/components/ds/`

**Extend in BOW:**
- `lib/db.ts` — add tables: `people`, `organization_opportunities`, `tasks`, `task_comments`, `activity`, `instructor_applications`, `workshops`, `workshop_sessions`, `workshop_enrollments`, `chapter_candidates`, `chapters`, `chapter_memberships`, `growth_campaigns` (+ indexes, idempotent create per existing style)
- `lib/dal.ts`, `lib/session.ts` — role additions; `proxy.ts` — matcher already covers `/app`
- `app/actions/` — new `growth.ts`, `pipeline.ts`, `tasks.ts`, `activity.ts`, `applications.ts`
- `app/app/` — new route folders per §5; `app/app/layout.tsx` — sidebar from nav catalog
- Public forms: new instructor-application + student-registration + chapter-interest pages under `(marketing)`; extend partner flow

**Leave alone:** everything else in BOW — `(marketing)` pages, analytics subtree, simulations (`lib/sim-*`), `lib/highway.ts` marketing content, `styles/tokens/`, existing LMS (`app/app/{instructor,student}`), `vercel.json`, `next.config.ts`.

## 10. Phased Implementation

1. Roles + guards (`lib/authz*.ts`) + nav catalog + BOW-branded internal shell/sidebar in `app/app/layout.tsx`
2. Foundation tables: `people`, `organizations` extension, `tasks`, `activity` + Tasks page
3. One public form → private pipeline (partnership inquiry — extends existing demo/contact flow, lowest risk)
4. Growth workspace (`/app/growth`: queue, follow-ups, handoffs) 
5. Founder dashboard (`/app` home: approvals, handoffs, needs-attention)
6. Instructor + student pipelines (+ their public forms)
7. Workshops
8. Chapter pipeline + founder approval
9. Highway World integration stub (`highway_world_sessions` table + link-out; real API contract deferred — define a small shared-types package + REST/webhook contract when the game exists as an app)

## 11. Risks

- **Framework delta myth**: YPP is *also* on Next 16 now, but written in Next-14 idioms — any copied file must be checked for sync `params`, `middleware` assumptions (BOW uses `proxy.ts`).
- **React 18 vs 19**: ui-v2 components may use APIs/patterns that behave differently under React 19 — another reason to rebuild rather than copy.
- **Styling**: importing Tailwind would collide with BOW's global reset and token theming — avoided by staying on BOW DS.
- **Route collisions**: BOW already owns `/app`, `/admin`, `/dashboard`, `/instructor`, `/profile`, `/onboarding` — YPP route folders must never be copied verbatim.
- **Data leakage / live-YPP coupling**: never copy YPP `.env*`, `DATABASE_URL`/Supabase keys, `vercel.json` crons, or `lib/prisma.ts`; BOW must gain **zero** Supabase/Postgres env vars. YPP hardcoded email rosters (`lib/leadership-preview-roster.ts`, `PORTAL_*_EMAILS`) must not travel.
- **YPP instability as a source**: dual mentorship/workflow/auth implementations mean "the YPP way" is ambiguous in several areas — pattern extraction only from the systems named above.
- **SQLite ceiling**: single-file DB is fine for a small team; revisit Postgres if concurrent writers or multi-region become real. Node's `node:sqlite` requires the Node version Vercel deploys — already proven by BOW's current deploy.
- **`node_modules` not installed** in this checkout — dependency work in the implementation task starts with `npm install`.

## 12. First Implementation Slice (recommended)

Prove the architecture in one PR-sized slice: roles (`founder`, `growth`) + `lib/authz.ts` guards → BOW-branded protected shell with 8-item nav at `/app` → `people` + `organization_opportunities` + `instructor_applications` + `tasks` + `activity` tables → basic org and instructor pipeline list/detail pages → tasks page → **partnership inquiry form** wired end-to-end (public submit → org + person + opportunity + activity + follow-up task visible in the growth queue). No workshops, chapters, campaigns, or Highway World in slice 1.

## Verification (for the implementation task)

- `npm install && npm run build` in BOW; app boots with zero env vars (per BOW convention)
- `npm run nav:check` passes with the new catalog
- Manual flow: submit partnership form as visitor → sign in as growth → see org/opportunity/task; sign in as founder → see handoff; instructor/chapter_leader roles denied `/app/growth`
- Confirm no `@prisma`, `@supabase`, or `tailwindcss` entries added to `BOW-WEBSITE/package.json`

---

This document is the read-only audit deliverable; a follow-up implementation task should execute the phased plan above without repeating the repository audit.
