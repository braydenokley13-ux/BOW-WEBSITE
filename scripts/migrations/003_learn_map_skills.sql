-- ============================================================
-- 003_learn_map_skills.sql — Playbook Engine: skills + career map.
--
-- See 001_learn_core.sql header for id/timestamp/RLS conventions.
--
-- Skills are progression attributes, not psychometrics: they only rise,
-- capped per lesson via learn_skill_events' unique (attempt_id, skill_id) so
-- a student cannot farm the same attempt for repeated skill growth.
-- ============================================================

CREATE TABLE IF NOT EXISTS learn_skills (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  icon text,
  sort integer NOT NULL DEFAULT 0,
  description text
);

CREATE TABLE IF NOT EXISTS learn_student_skills (
  user_id text NOT NULL,
  skill_id text NOT NULL REFERENCES learn_skills(id) ON DELETE CASCADE,
  level integer NOT NULL DEFAULT 0,
  points integer NOT NULL DEFAULT 0,
  events integer NOT NULL DEFAULT 0,
  updated_at bigint NOT NULL,
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS learn_skill_events (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  skill_id text NOT NULL REFERENCES learn_skills(id) ON DELETE CASCADE,
  attempt_id text NOT NULL REFERENCES learn_attempts(id) ON DELETE CASCADE,
  points integer NOT NULL,
  created_at bigint NOT NULL,
  UNIQUE (attempt_id, skill_id)
);

CREATE INDEX IF NOT EXISTS learn_skill_events_user_id_idx ON learn_skill_events(user_id);

-- Map sections are franchise-department-themed groupings of nodes within a
-- track (`theme jsonb` stays concept-agnostic — no hardcoded department enum).
CREATE TABLE IF NOT EXISTS learn_map_sections (
  id text PRIMARY KEY,
  track_id text NOT NULL REFERENCES learn_tracks(id) ON DELETE CASCADE,
  title text NOT NULL,
  subtitle text,
  sort integer NOT NULL DEFAULT 0,
  theme jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS learn_map_sections_track_id_idx ON learn_map_sections(track_id);

CREATE TABLE IF NOT EXISTS learn_map_nodes (
  id text PRIMARY KEY,
  section_id text NOT NULL REFERENCES learn_map_sections(id) ON DELETE CASCADE,
  sort integer NOT NULL DEFAULT 0,
  kind text NOT NULL CHECK (kind IN ('lesson', 'bonus_challenge', 'checkpoint', 'reward')),
  lesson_id text REFERENCES learn_lessons(id) ON DELETE SET NULL,
  layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Static unlock policy: {requiresNodes, minStarsTotal, minLevel, badgeId,
  -- requiresInstructorRelease, opensAt}. Runtime overrides/timed releases
  -- live in learn_release_state (004_learn_release_state.sql), not here.
  unlock jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS learn_map_nodes_section_id_idx ON learn_map_nodes(section_id);
CREATE INDEX IF NOT EXISTS learn_map_nodes_lesson_id_idx ON learn_map_nodes(lesson_id);

ALTER TABLE learn_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_student_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_skill_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_map_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_map_nodes ENABLE ROW LEVEL SECURITY;
