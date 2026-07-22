-- ============================================================
-- 004_learn_release_state.sql — Playbook Engine: runtime release overrides.
--
-- See 001_learn_core.sql header for id/timestamp/RLS conventions.
--
-- Generalizes the existing CAS-guarded `cohorts.current_lesson_id` advance
-- and the per-student `enrollments.unlocked_lesson_id` override (see
-- docs/learn/stage0-audit.md §3) into one table that also supports scheduled
-- opens: "Cohort A unlocked, Cohort B locked, Student X override, opens
-- Monday 4 PM." Exactly one of node_id/module_id is set per row.
-- ============================================================

CREATE TABLE IF NOT EXISTS learn_release_state (
  id text PRIMARY KEY,
  node_id text REFERENCES learn_map_nodes(id) ON DELETE CASCADE,
  module_id text REFERENCES learn_modules(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('cohort', 'program', 'student')),
  scope_id text NOT NULL,
  released_by text,
  released_at bigint,
  opens_at bigint,
  CHECK (
    (node_id IS NOT NULL AND module_id IS NULL) OR
    (node_id IS NULL AND module_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS learn_release_state_node_idx ON learn_release_state(node_id);
CREATE INDEX IF NOT EXISTS learn_release_state_module_idx ON learn_release_state(module_id);
CREATE INDEX IF NOT EXISTS learn_release_state_scope_idx ON learn_release_state(scope_type, scope_id);

ALTER TABLE learn_release_state ENABLE ROW LEVEL SECURITY;
