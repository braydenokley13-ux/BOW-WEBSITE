-- Program / class / session delivery + instructor assignment lifecycle.
--
-- Additive only. Three gaps this closes, all of which previously forced the
-- product to guess:
--
--   1. A `class_sessions` row was a bare timestamp. It could not say what the
--      session teaches, what an instructor must prepare, whether it actually
--      happened, or whether it was cancelled. Delivery state lived only in
--      `class_session_reports`, which does not exist until after the fact.
--   2. `class_instructors` recorded a founder-side decision with no instructor
--      -side response, so "assigned" and "accepted" were indistinguishable and
--      staffing coverage could never be trusted.
--   3. Preparation had no record at all, so "is this session ready?" was
--      unanswerable before the session ran.
--
-- Existing rows keep working: sessions default to `scheduled` / `not_started`,
-- and every historical assignment is backfilled as `accepted` because it was
-- created by a direct founder assignment with no response step.

/* ---------------------------------------------------------------- */
/* 1. Sessions become real operating records.                        */
/* ---------------------------------------------------------------- */

ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS objective text;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS agenda text;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS materials text;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS meeting_link text;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS lesson_id text;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled';
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS cancelled_by text;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS cancelled_at bigint;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS updated_at bigint;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_sessions_status_check') THEN
    ALTER TABLE class_sessions ADD CONSTRAINT class_sessions_status_check
      CHECK (status IN ('scheduled', 'completed', 'cancelled'));
  END IF;
END $$;

UPDATE class_sessions SET updated_at = created_at WHERE updated_at IS NULL;

-- A finalized report is the authoritative statement that delivery happened;
-- backfill session status from it so history is consistent with the new field.
UPDATE class_sessions s
   SET status = 'completed'
  FROM class_session_reports r
 WHERE r.session_id = s.id AND r.completed = 1 AND s.status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_class_sessions_class_date ON class_sessions (class_id, session_date);

-- class_session_roster is read and written by app/actions/{classes,students,
-- lms,public-registration}.ts as the fixed roster snapshot for a session, but
-- no migration ever created it — a database built from scripts/ alone cannot
-- schedule a session or take attendance. Created here IF NOT EXISTS so an
-- environment that already has the table is untouched.
CREATE TABLE IF NOT EXISTS class_session_roster (
  id text PRIMARY KEY,
  session_id text NOT NULL,
  student_id text NOT NULL,
  enrollment_id text,
  rostered_at bigint NOT NULL,
  UNIQUE (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_class_session_roster_session ON class_session_roster (session_id);

/* ---------------------------------------------------------------- */
/* 2. Per-instructor session preparation.                            */
/* ---------------------------------------------------------------- */

-- Preparation is per instructor, not per session: a co-instructor being ready
-- says nothing about the lead. The session-level rollup is derived from these
-- rows rather than stored, so the two can never disagree.
CREATE TABLE IF NOT EXISTS class_session_prep (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  instructor_id text NOT NULL,
  status text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_preparation', 'ready')),
  -- JSON array of {key, label, done} — the checklist the instructor worked
  -- through. Stored as a snapshot so changing the template later does not
  -- rewrite what a past instructor actually confirmed.
  checklist text,
  blockers text,
  reviewed_materials integer NOT NULL DEFAULT 0,
  updated_at bigint NOT NULL,
  UNIQUE (session_id, instructor_id)
);

CREATE INDEX IF NOT EXISTS idx_class_session_prep_instructor ON class_session_prep (instructor_id);

/* ---------------------------------------------------------------- */
/* 3. Assignments carry an instructor response.                      */
/* ---------------------------------------------------------------- */

ALTER TABLE class_instructors ADD COLUMN IF NOT EXISTS assignment_status text NOT NULL DEFAULT 'accepted';
ALTER TABLE class_instructors ADD COLUMN IF NOT EXISTS responded_at bigint;
ALTER TABLE class_instructors ADD COLUMN IF NOT EXISTS response_note text;
ALTER TABLE class_instructors ADD COLUMN IF NOT EXISTS expected_commitment text;
ALTER TABLE class_instructors ADD COLUMN IF NOT EXISTS start_date text;
ALTER TABLE class_instructors ADD COLUMN IF NOT EXISTS proposed_at bigint;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_instructors_assignment_status_check') THEN
    ALTER TABLE class_instructors ADD CONSTRAINT class_instructors_assignment_status_check
      CHECK (assignment_status IN ('proposed', 'accepted', 'declined'));
  END IF;
END $$;

-- Historical rows were created by direct founder assignment with no response
-- step, and delivery already depended on them; they are accepted by definition.
UPDATE class_instructors
   SET responded_at = COALESCE(responded_at, added_at),
       proposed_at = COALESCE(proposed_at, added_at)
 WHERE assignment_status = 'accepted';

CREATE INDEX IF NOT EXISTS idx_class_instructors_instructor
  ON class_instructors (instructor_id) WHERE removed_at IS NULL;
