-- Instructor "Current Mission" spine — activation & responsibility layer.
--
-- Additive only. Turns "accepted" into "activated": every non-terminal
-- instructor can carry exactly one CURRENT MISSION answering "what am I
-- responsible for right now?" — across responsibility areas beyond teaching
-- (student growth, instructor recruitment, partner expansion, curriculum,
-- content/media, program operations). This is NOT a second task manager: a
-- mission is the instructor's headline responsibility; concrete deliverables
-- still live in the canonical `tasks` / Work system, and a mission can point
-- at the Class / Program / Organization it serves via related_entity_*.
--
-- Missions layer on top of the canonical `instructors` identity record; the
-- one-active-mission-per-instructor invariant is enforced by a partial unique
-- index so no accepted instructor silently accumulates competing focuses.

CREATE TABLE IF NOT EXISTS instructor_missions (
  id text PRIMARY KEY,
  instructor_id text NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  area text NOT NULL CHECK (area IN (
    'teaching', 'student_growth', 'instructor_recruitment', 'partner_expansion',
    'curriculum', 'content_media', 'program_operations'
  )),
  title text NOT NULL,
  outcome text NOT NULL,
  cadence text NOT NULL DEFAULT 'once' CHECK (cadence IN ('once', 'weekly', 'biweekly', 'monthly')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  due_on text,
  related_entity_type text CHECK (related_entity_type IS NULL OR related_entity_type IN ('class', 'program', 'organization')),
  related_entity_id text,
  assigned_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  completion_outcome text CHECK (completion_outcome IS NULL OR completion_outcome IN ('delivered', 'partial', 'abandoned')),
  completion_note text,
  created_at double precision NOT NULL,
  updated_at double precision NOT NULL,
  completed_at double precision,
  -- Evidence integrity: a terminal mission carries an outcome+timestamp; an
  -- active mission never does. Keeps the completion story honest per row.
  CONSTRAINT instructor_missions_terminal_evidence CHECK (
    (status = 'active' AND completed_at IS NULL AND completion_outcome IS NULL)
    OR (status IN ('completed', 'cancelled') AND completed_at IS NOT NULL)
  ),
  CONSTRAINT instructor_missions_related_pairing CHECK (
    (related_entity_type IS NULL) = (related_entity_id IS NULL)
  )
);

-- The core invariant: at most one active Current Mission per instructor.
CREATE UNIQUE INDEX IF NOT EXISTS ux_instructor_missions_one_active
  ON instructor_missions (instructor_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_instructor_missions_instructor
  ON instructor_missions (instructor_id, status);
CREATE INDEX IF NOT EXISTS idx_instructor_missions_active_due
  ON instructor_missions (due_on)
  WHERE status = 'active';

-- Progress notes, submitted evidence, and staff feedback on a mission. The
-- instructor-facing "what did I do about it" and the manager-facing "here's my
-- read" both land here, giving a mission its own auditable history without
-- inventing a second activity log.
CREATE TABLE IF NOT EXISTS instructor_mission_updates (
  id text PRIMARY KEY,
  mission_id text NOT NULL REFERENCES instructor_missions(id) ON DELETE CASCADE,
  author_user_id text REFERENCES users(id) ON DELETE SET NULL,
  author_kind text NOT NULL CHECK (author_kind IN ('instructor', 'staff', 'system')),
  kind text NOT NULL CHECK (kind IN ('progress', 'evidence', 'feedback', 'status_change')),
  body text NOT NULL,
  created_at double precision NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_instructor_mission_updates_mission
  ON instructor_mission_updates (mission_id, created_at);

ALTER TABLE instructor_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_mission_updates ENABLE ROW LEVEL SECURITY;
