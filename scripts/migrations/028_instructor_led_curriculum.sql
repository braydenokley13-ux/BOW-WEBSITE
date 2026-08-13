-- 028_instructor_led_curriculum.sql
--
-- Instructor-led curriculum: a lesson sequence and the materials that go with
-- it, for courses that are taught live rather than played through.
--
-- WHY THIS IS NOT learn_lessons
--
-- `learn_tracks → learn_modules → learn_lessons → learn_lesson_versions` is the
-- authoring system for SELF-PACED digital experiences, and it stays canonical
-- for those. A live class needs something much lighter: a numbered lesson with
-- a title, an optional teaching note, and links to the Slides, the worksheet
-- and the simulation. Forcing that into the block/version model would mean
-- authoring a document nobody reads in order to store four URLs.
--
-- `curricula.learn_track_id` therefore stays OPTIONAL, and a course is one of:
--
--   instructor-led   curriculum_lessons + resources, no Learn track
--   digital          a Learn track, no curriculum_lessons
--   hybrid           both — Learn experiences plus instructor materials
--
-- WHY NOT A FREE-TEXT BLOB
--
-- `class_sessions.materials` already exists and is exactly that: prose. An
-- instructor five minutes before class needs a button, not a paragraph
-- containing a URL. It stays, unchanged, as the per-session note.
--
-- WHY LINKS AND NOT FILES
--
-- The material already lives in Google Slides, Canva, Drive or a BOW
-- simulation. Copying it into BOW would create a second copy to keep in sync
-- and a storage system to run. A resource points at the real thing.

CREATE TABLE IF NOT EXISTS curriculum_lessons (
  id             text PRIMARY KEY,
  curriculum_id  text NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
  -- 1-based, and the same number the composer maps onto session N.
  position       integer NOT NULL,
  title          text NOT NULL,
  -- What the instructor needs to know to teach it. Plain text on purpose:
  -- this is a note, not a document.
  teaching_note  text,
  created_at     bigint NOT NULL,
  updated_at     bigint NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_curriculum_lessons_position
  ON curriculum_lessons (curriculum_id, position);

CREATE TABLE IF NOT EXISTS curriculum_resources (
  id             text PRIMARY KEY,
  curriculum_id  text NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
  -- Exactly one anchor, or neither for a course-wide resource. A resource
  -- belongs to an instructor-led lesson OR to a Learn lesson (the hybrid
  -- case, where authored experiences still need an instructor guide beside
  -- them), never to both.
  lesson_id       text REFERENCES curriculum_lessons(id) ON DELETE CASCADE,
  learn_lesson_id text REFERENCES learn_lessons(id) ON DELETE CASCADE,
  label          text NOT NULL,
  url            text NOT NULL,
  kind           text NOT NULL,
  note           text,
  sort           integer NOT NULL DEFAULT 0,
  created_at     bigint NOT NULL,
  updated_at     bigint NOT NULL,
  CONSTRAINT curriculum_resources_one_anchor
    CHECK (lesson_id IS NULL OR learn_lesson_id IS NULL),
  CONSTRAINT curriculum_resources_kind
    CHECK (kind IN ('slides', 'document', 'pdf', 'worksheet', 'video', 'simulation', 'website', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_curriculum_resources_lesson
  ON curriculum_resources (lesson_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_resources_learn_lesson
  ON curriculum_resources (learn_lesson_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_resources_curriculum
  ON curriculum_resources (curriculum_id, sort);
