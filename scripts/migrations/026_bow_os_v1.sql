-- ============================================================
-- 026_bow_os_v1.sql
--
-- BOW OS V1. Three additive changes, each unblocking a user-facing
-- requirement that the current model cannot meet safely. Nothing is dropped,
-- renamed, or rewritten; every statement is re-runnable.
--
-- Deliberately NOT here, because the canonical system already exists:
--   attendance      -> attendance_records      (app/actions/classes.ts:recordAttendance)
--   session_notes   -> class_session_reports   (app/actions/classes.ts:submitSessionReport)
--   follow_ups      -> tasks kind='follow_up'  (app/actions/partners.ts precedent)
--   notes           -> crm_activity            (lib/hiring.ts:logActivity/listActivity)
--   partner_status  -> organizations.status    (PARTNER_LIFECYCLE_TRANSITIONS)
--   applications    -> applications            (scripts/migrate-people-work-os.ts)
--   class.section_label / roster_source / curriculum_version — all derivable.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Publish idempotency: one Program per publish request key.
--
-- "Post a Class" must be safe to retry after a dropped connection: the
-- founder taps Publish again and must never end up with two classes, two
-- programs, or two public listings.
--
-- createProgramInternal already reads programs.request_key to detect a
-- replay, but nothing enforces uniqueness, so two concurrent retries both
-- pass that SELECT and both INSERT. The unique index closes the race in the
-- database, exactly as uq_program_registrations_request_key (migration 019)
-- already does for family registration.
--
-- Legacy rows may in principle carry a duplicated non-null key. Such rows are
-- already useless as idempotency keys, so they are disambiguated in place
-- rather than allowing this migration to fail. Rows with a NULL request_key
-- are untouched and stay exempt from the index.
-- ------------------------------------------------------------

UPDATE programs p
   SET request_key = p.request_key || ':' || p.id
 WHERE p.request_key IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM programs other
      WHERE other.request_key = p.request_key
        AND other.id <> p.id
   );

CREATE UNIQUE INDEX IF NOT EXISTS uq_programs_request_key
  ON programs (request_key)
  WHERE request_key IS NOT NULL;


-- ------------------------------------------------------------
-- 2. Course -> authored lessons.
--
-- A staff "course" is a curricula row; the authored lessons live in the
-- disjoint learn_tracks -> learn_modules -> learn_lessons graph. There is no
-- join between them today, yet class_sessions.lesson_id (migration 018)
-- already expects a learn_lessons id.
--
-- Without this link the composer cannot pre-fill a lesson count, cannot map
-- generated sessions to lessons, and the course record cannot show its
-- ordered lesson list or where it is running — the whole "build once, use
-- everywhere" promise.
--
-- Nullable on purpose: a curriculum with no authored track keeps working
-- exactly as it does now, and a class can still be planned with no course.
-- ------------------------------------------------------------

ALTER TABLE curricula
  ADD COLUMN IF NOT EXISTS learn_track_id text;

CREATE INDEX IF NOT EXISTS idx_curricula_learn_track
  ON curricula (learn_track_id)
  WHERE learn_track_id IS NOT NULL;


-- ------------------------------------------------------------
-- 3. Class drafts.
--
-- The composer autosaves, and Home offers a single quiet "Resume draft" row.
-- No general-purpose draft store exists, and drafting into `classes` would
-- put abandoned drafts into the canonical Program/Class spine.
--
-- The smallest shape that works: one in-flight draft per operator, holding
-- the composer payload verbatim. No status column and no lifecycle —
-- publishing or discarding deletes the row. `payload` is a JSON string in
-- text, matching class_session_prep.checklist and
-- class_session_reports.lesson_snapshot, so this table is readable through
-- the standard lib/db.ts client rather than needing the native JSONB client.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS class_drafts (
  id text PRIMARY KEY,
  owner_user_id text NOT NULL,
  payload text NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_class_drafts_owner
  ON class_drafts (owner_user_id);
