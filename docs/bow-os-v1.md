# BOW OS V1

The V1 staff experience is a narrowing of the surface over the existing operating engine, not a
rebuild. Five destinations — **Home · Programs · Partners · People · Curriculum** — and one
vocabulary: Class · Session · Section · Partner · Registration · Course · Lesson · Follow-up.
Internal nouns (opportunity, stage IDs, disposition, cohort, clearance, and the Program/Class
split for direct classes) never reach the operator.

This document records what V1 reused, what it changed, and why — so the next engineer does not
re-derive it.

---

## Design-vs-repository reconciliation

The V1 implementation handoff proposed seven new tables/columns. Six were rejected because the
canonical system already exists. Anything below is the system to reuse; do not add a parallel one.

| Handoff proposed | Reused instead | Where |
|---|---|---|
| `attendance` table | `attendance_records` — batch save (≤500 rows), roster-validated, optimistic concurrency on `expectedRecordedAt` | `app/actions/classes.ts:recordAttendance`; statuses in `lib/session-evidence.ts` |
| `session_notes` table | `class_session_reports` — notes, flag, completion; finalize is irreversible and requires complete attendance | `app/actions/classes.ts:submitSessionReport` |
| `follow_ups` table | `tasks` with `kind='follow_up'`, `entity_type='organization'`, `due_on`, `source_key` | precedent: `app/actions/partners.ts:createFollowUpFromDemoRequest` |
| `notes` table | `crm_activity` | `lib/hiring.ts:logActivity` / `listActivity` |
| `partner_status` enum | `organizations.status` (`prospect\|active\|paused\|closed`); the four UI states are **derived**, storage unchanged | `PARTNER_LIFECYCLE_TRANSITIONS`, `app/actions/partners.ts` |
| `applications` table | `applications` already exists, with a 7-state lifecycle and `person_id → people.id`; approving flips the **same** Person to an Instructor facet | `scripts/migrate-people-work-os.ts`, `app/actions/people-work.ts:decideApplication` |
| `classes.curriculum_version` | Nothing to point at — `curricula` has no version table. Student history is already guaranteed by `learn_lesson_versions` + `learn_attempts.version_id ON DELETE RESTRICT`; per-session delivery evidence by `class_session_reports.lesson_snapshot` | `scripts/migrations/001_learn_core.sql` |

`classes.section_label` and `roster_source` were also rejected: a section's plain-language name
is its `classes.title`, and "the school sends the roster" is `programs.is_public = false`.

---

## Migrations added (`scripts/migrations/026_bow_os_v1.sql`)

All additive and re-runnable. Each exists because a user-facing requirement could not be met
safely with the current model.

1. **`uq_programs_request_key`** — partial unique index on `programs.request_key`.
   A retried publish must never create a second class/program/listing. `createProgramInternal`
   already read `request_key` to detect a replay, but nothing enforced uniqueness, so two
   concurrent retries both passed the SELECT and both inserted. Mirrors
   `uq_program_registrations_request_key` (019). The migration first disambiguates any
   pre-existing duplicate non-null keys — already useless as idempotency keys — so a deploy
   cannot fail on legacy data. `NULL` keys stay exempt.

2. **`curricula.learn_track_id`** — nullable link from a staff course to its authored track.
   `curricula` (ops) and `learn_tracks → learn_modules → learn_lessons` (authoring) were
   disjoint graphs, while `class_sessions.lesson_id` already expected a `learn_lessons` id.
   Without the link the composer cannot pre-fill a lesson count or map sessions to lessons, and
   a course record cannot show its ordered lessons or where it is running. Courses with no
   authored track keep working unchanged.

3. **`class_drafts`** — one in-flight composer draft per operator (`owner_user_id` unique).
   No status column and no lifecycle: publishing or discarding deletes the row. `payload` is a
   JSON string in `text`, matching `class_session_prep.checklist` and
   `class_session_reports.lesson_snapshot`, so it is read through the standard `lib/db.ts`
   client rather than the native JSONB client.

---

## Navigation and canonical routes

Five staff destinations. `lib/navigation/catalog.ts` is the single source of truth, and
`tests/navigation/catalog.test.ts` pins every path to exactly one of them.

| Destination | Route | Also resolves |
|---|---|---|
| Home | `/app` | — |
| Programs | `/app/programs` | `/app/classes`, `/app/post-class`, `/app/session`, `/app/regions`, `/app/locations` |
| Partners | `/app/partners` | `/app/inquiries`, `/app/admin/inquiries` |
| People | `/app/people` | `/app/instructors`, `/app/students`, `/app/hiring`, `/app/training`, `/app/instructor-ops` |
| Curriculum | `/app/curriculum` | `/app/admin/learn` (Playbook Studio) |

Growth, Work, Website and the platform-admin pages moved into a secondary **More** group.
Their routes are unchanged and nothing is stranded — they simply stopped competing with the
five surfaces used daily.

## Publishing a direct class

`/app/post-class` → `publishClass()` in `lib/post-class.ts` → `/app/post-class/published/[classId]`.

One `BEGIN IMMEDIATE` creates the Program, the delivery Class (`status = 'active'`, so
attendance can be recorded), every session (with `lesson_id` mapped from the course when the
course has an authored track), and the public listing. Three decisions are real — course,
title, schedule — and the rest are stated defaults: 12 seats, automatic waitlist, free, the
operator teaches it, listed publicly.

Idempotency: the composer mints a request key on the first Publish press and reuses it for
every retry. `programs.request_key` is `post-class:<key>` and carries a unique index, so a
retry either finds the existing class or loses the INSERT race and then finds it.

**A posted class is always public.** The mockup offered a Link-only toggle, but both
`listPublicProgramsForSite` and `getPublicProgramBySlug` require `publication_status =
'published'`, so a link-only class would have had a link that did not resolve. Shipping the
control would have been fake capability; V2 can add a genuine unlisted state.

## Family registration path

Public program cards now send families to `/programs/register?program=<id>` — the canonical
wizard, which takes `SELECT … FOR UPDATE` on the class row before counting seats, enrols
siblings in one flow, and hands a full class to the waitlist engine. The previous target,
`/programs/register/<id>`, did none of those; it is now a redirect, so links already shared
with families keep working.

The CTA is decided by `deriveCta`, which only uses a register href for `registration_open` —
so Coming Soon, Full, Closed and interest-list behaviour are untouched.

## The Session Sheet

`/app/session/[sid]` is the one address for a session, for staff and for the instructor
teaching it. `lib/session-sheet.ts` assembles it from the canonical delivery systems only —
`class_sessions`, the locked `class_session_roster`, `attendance_records`,
`class_session_reports`, and the same lesson-snapshot model the report finalizes with. No new
table, no second attendance path: the sheet calls `recordAttendance` and `submitSessionReport`.

Written for a phone opened five minutes before class. **Mark everyone here** fills only the
rows nobody has touched, so the common case is one tap and the exceptions are corrections
rather than re-entry. One button shows at a time — save attendance, then complete the session —
because that is the order the server accepts them in, and `resolveSheetAction` is a pure
function tested against exactly the guards `recordAttendance` enforces. Every "you cannot do
this yet" message names the real reason.

What an instructor does *not* see is not hidden behind a role check, it is not on the page:
no CRM, no partner history, no guardian contacts, no admin controls. Authorization is
enforced server-side — staff read any session; an instructor only a class they have
**accepted** (`isAcceptedClassMember`); everyone else gets a 404 rather than a "forbidden"
that would confirm the session exists.

Two defects this turned up, both pre-existing and both fixed here rather than worked around:

- `submitSessionReport` crashed with a Postgres syntax error whenever a session was
  finalized — `verifiedLegacyLessonSnapshot` compares two columns with SQLite's null-safe
  `IS`, which `toPostgresSql` translated only in its `IS ?` parameter form. Completing a
  session had therefore never worked, and the instructor session page sharing that query
  500'd too. The shim now translates the column form as well.
- The composer wrote `class_sessions.meeting_link` without the scheme check
  `updateSessionPlan` enforces, and that value is rendered as an `href`. `safeMeetingLink`
  now guards both the write and the render.

`scripts/seed-dev.ts` also now writes the `class_session_roster` snapshot its enrollments
imply. Without it the seeded "instructor with a session today" could not take attendance at
all, because `recordAttendance` refuses an empty roster.

## Partners

One question — **who do I need to follow up with** — asked once, at the top of `/app/partners`.
`lib/partner-desk.ts` reads only systems that already exist: `organizations` and its lifecycle
status, `organization_people`, `crm_activity`, `tasks` with `kind='follow_up'`, `inquiries`, and
`demo_requests`. No partner-notes table, no second follow-up store, no pipeline. BOW does not
have a pipeline; it has a handful of schools and a founder who has to remember to call them.

The **inbox** is one list because the job is one job: reply to a human. A school that used the
public form, a demo request, and a follow-up somebody already promised all appear together,
ordered by who has been waiting longest — sorting by kind is how the oldest thing gets
forgotten. A follow-up dated in the future is a plan, not an inbox item, so it shows on the
partner's row instead.

**Still deciding** is the Ramaz case and the reason `resolveStanding` exists. A partnership can
be entirely real while the format, the number of sections, the dates and the staffing are all
open. That is a state with a name, not an incomplete record — nothing on the partner page
demands a field be filled to look finished, and there is no readiness meter counting unmade
decisions as failures. "Between programs" is kept distinct from "Still deciding" because the
follow-up each deserves is different.

**An inquiry becomes a partner without retyping.** `convertInquiryToPartner` writes the
organization, the `people` row, the `organization_people` relationship, the first note and a
dated follow-up in one transaction. The operator picks the target explicitly — this is a new
school, or it is one already on the list. Matching `organizations` by the name typed into a
public form is exactly the ambiguous-identity behaviour this codebase is containing, so it is
not offered.

Two fixes this turned up:

- `createFollowUpFromDemoRequest` created its task with no `kind`, no date and no `source_key`,
  so dispositioning a demo request quietly buried it — neither HQ Home's queue nor the Partners
  inbox could see it. It now writes the canonical follow-up shape.
- `scripts/seed-dev.ts` wrote **`partner_orgs`** ids into `programs.partner_org_id` and
  `classes.partner_org_id`. Those columns hold an **`organizations`** id — that is what
  `/app/programs/new` writes and what `lib/operations.ts` resolves the partner name from — so
  every seeded partner rendered with no programs and no classes. Fixed in the seed; the
  `organizations` ↔ `partner_orgs` seam itself is untouched and no new query crosses it.

## The partner Program record

A partner Program is the one place in V1 where extra structure is honest: a school runs several
sections, on a schedule somebody negotiated, with staffing that may not be settled. So
`/app/programs/[id]` shows sections, schedule and staffing — in partner language, not the stage
machine's. Twelve internal stages become five words (`programStatusLabel`), and the record leads
with one sentence saying where the Program actually is.

**Readiness is reused, not rebuilt.** `getProgramReadiness` already knows every fact that must be
true before a Program can run; what changed is the editorial judgment about it. There is no
percentage, no progress ring, and no wall of amber. Two rules do the work:

- `blockersApply` — nothing is a blocker while a Program is merely *being planned*. "No
  instructor yet" is the normal state of the world in week one, and amber that appears the day a
  record is created teaches its reader to ignore amber.
- `blockerAppliesAtStage` — once a Program is **running**, only the handful of readiness keys
  that still affect the room survive (`forms`, `capacity`, `eligible_instructor`,
  `assignment_response`, `first_session`). A Program with children in it does not need to be told
  a launch-date field is empty.

Everything else that is unsettled appears under **Still deciding** as a plain statement, never a
failure — the same treatment the Ramaz partner gets, for the same reason.

The machinery that genuinely has to exist — stage transitions, staffing offers, the public
listing, duplicate, first-session prep — is real capability and is kept, one disclosure down,
rather than deleted or spread across five tabs.

**A direct class never shows its Program.** A class posted from the composer gets a Program
because the schema needs one. `/app/programs/[id]` resolves `source_type = 'direct'` and
redirects to `/app/classes/[id]`, so the split V1 exists to hide cannot be reached by URL.

## People

One directory, **search first**, over one identity model. `people` is the spine; Student,
Parent, Instructor, Contact, Applicant and Staff are facets read from the tables that already own
each relationship — `students.person_id`, `student_guardians`, `instructors.person_id`,
`organization_people`, `applications.person_id`, `role_assignments`. A guardian who also runs a
partner's athletics department is one row with two chips, never two records, and the facet chips
filter that single list rather than opening six of them.

Search leads because that is how a person is actually found: by typing a name, not by first
deciding which kind of person they are. The facets narrow the result; they do not replace it.

**A possible duplicate is surfaced and never resolved.** The directory says "needs review, never
merged automatically" and the decision stays where it already lived — HQ Home's duplicate review.

`resolvePersonRoleIds` returns the Parent and Contact relationships too, so the person record and
the directory cannot disagree about who somebody is. Before that, a guardian with a partner
relationship read as "No active role" on their own record while carrying two chips in the list.

Applications and instructors remain parallel pipelines (a V2 consolidation). V1 surfaces both
as facets of the same Person and introduces no third pipeline.

Two defects fixed while here: the student facet printed raw epoch milliseconds in its attendance
history (`new Date()` on a Postgres bigint-as-string — the same class of bug as the Programs
waitlist deadline, now routed through `coerceEpochMs`), and its form-status buttons overflowed
390px.

## Curriculum

Build once, run everywhere. A course is a `curricula` row; its lessons live in the authored
graph (`learn_tracks → learn_modules → learn_lessons`) and are reached through
`curricula.learn_track_id`. The course record shows the lesson sequence in the one authored order
— module sort, then lesson sort — which is the same order Studio shows and the same order the
composer maps onto sessions, so "lesson 3" means one thing to everybody.

**Version complexity stays underneath.** A lesson is published (a class can run it) or a draft
(it can still be scheduled, it just has not been released). That is the only version fact an
operator needs; `learn_lesson_versions` remains Studio's business and a student-history
guarantee. **Studio is not rebuilt** — every lesson links into it.

### Migration 027 — the one automatic course → track link

Migration 026 added `curricula.learn_track_id` and left it null everywhere, which is why the
composer showed "No lessons yet" against courses that plainly had lessons. 027 fills it in for
the single pair where the correspondence is a fact rather than a guess:

| written by | value |
|---|---|
| `scripts/seed-site-content.ts` | `curricula.public_slug = 'track-<n>'` |
| `scripts/import-legacy-lessons.ts` | `learn_tracks.id = 'track-legacy-<n>'` |

Both sides are generated from the same track number by code in this repo, so joining them reads
one identifier two ways — it is not title matching. The migration only fills nulls (an operator's
explicit link is never overwritten) and only when the track actually exists, so it is safe on a
database where the legacy import never ran.

Track 101 and Track 201 now carry twelve lessons each. **Track 301 and Front Office 101 stay
unlinked, truthfully** — no legacy lessons were ever authored for them, and inventing a mapping
would be worse than the gap. Everything else is linked by a person, explicitly, from **Course
settings** on the course record (`linkCourseToTrack`), where a track already claimed by another
course is not offered: two courses claiming the same lessons would make "lesson 3" ambiguous the
moment either is scheduled.

## Known seams (deliberately left for V2)

- **`organizations` ↔ `partner_orgs` are joined by name string.** `organizations` is the
  operating partner record; `partner_orgs` backs the branded marketing microsite. V1 reads
  across this seam at most — no new mutation or identity logic depends on that ambiguous match.
  Do not widen it.
- **`applications` and `instructors` are parallel pipelines**, with the invariant
  `applications.id === instructors.id` established by backfill and unenforced by schema. V1's
  People surface reuses both as-is and introduces no third applicant pipeline.
- **Closed by migration 027.** Courses seeded before 026 had no `learn_track_id`, so the
  composer showed "No lessons yet" and generated plain "Session N" titles. Track 101 and Track
  201 are now linked automatically; anything else is linked explicitly from the course record.
