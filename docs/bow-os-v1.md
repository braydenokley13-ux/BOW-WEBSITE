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

## Known seams (deliberately left for V2)

- **`organizations` ↔ `partner_orgs` are joined by name string.** `organizations` is the
  operating partner record; `partner_orgs` backs the branded marketing microsite. V1 reads
  across this seam at most — no new mutation or identity logic depends on that ambiguous match.
  Do not widen it.
- **`applications` and `instructors` are parallel pipelines**, with the invariant
  `applications.id === instructors.id` established by backfill and unenforced by schema. V1's
  People surface reuses both as-is and introduces no third applicant pipeline.
- Courses seeded before migration 026 have no `learn_track_id`, so the composer shows
  "No lessons yet" for them and generates plain "Session N" titles. Linking a course to its
  authored track is a Curriculum-surface job (Checkpoint 8); nothing breaks until then.
