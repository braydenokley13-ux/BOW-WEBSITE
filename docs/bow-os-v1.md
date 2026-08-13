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

## Known seams (deliberately left for V2)

- **`organizations` ↔ `partner_orgs` are joined by name string.** `organizations` is the
  operating partner record; `partner_orgs` backs the branded marketing microsite. V1 reads
  across this seam at most — no new mutation or identity logic depends on that ambiguous match.
  Do not widen it.
- **`applications` and `instructors` are parallel pipelines**, with the invariant
  `applications.id === instructors.id` established by backfill and unenforced by schema. V1's
  People surface reuses both as-is and introduces no third applicant pipeline.
- `lib/growth-search.ts` uses SQLite `instr()` against Postgres and will throw at runtime.
