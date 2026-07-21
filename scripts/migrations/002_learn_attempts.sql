-- ============================================================
-- 002_learn_attempts.sql — Playbook Engine: attempts/responses + progress.
--
-- See 001_learn_core.sql header for id/timestamp/RLS conventions.
--
-- Progress is split into two scopes (see docs/learn/stage0-audit.md §3):
--   - learn_lesson_mastery: lifetime best-ever record per (user, lesson),
--     mirroring today's `lesson_progress` table shape. Replay never erases
--     history; only ratchets best_score/best_stars upward.
--   - learn_assignment_progress: contextual completion per
--     (user, context_type, context_id, lesson_id) — generalizes
--     `cohorts.current_lesson_id` / `enrollments.unlocked_lesson_id` so the
--     same lesson assigned in Program A and Cohort B tracks independently.
-- ============================================================

CREATE TABLE IF NOT EXISTS learn_attempts (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  lesson_id text NOT NULL REFERENCES learn_lessons(id) ON DELETE CASCADE,
  version_id text NOT NULL REFERENCES learn_lesson_versions(id) ON DELETE RESTRICT,
  -- {cohortId?: string, programId?: string} — nullable: not every attempt is
  -- tied to a cohort/program (e.g. self-paced exploration).
  enrollment_context jsonb,
  -- 'test' = author "Test as Student" runs: real grading/branching/variables,
  -- but zero XP/badge/streak/progress/leaderboard side effects.
  mode text NOT NULL DEFAULT 'play' CHECK (mode IN ('play', 'test')),
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  started_at bigint NOT NULL,
  completed_at bigint,
  score integer,
  stars integer,
  xp_awarded integer,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  path jsonb NOT NULL DEFAULT '[]'::jsonb,
  duration_ms bigint
);

CREATE INDEX IF NOT EXISTS learn_attempts_user_lesson_idx ON learn_attempts(user_id, lesson_id);
CREATE INDEX IF NOT EXISTS learn_attempts_lesson_version_idx ON learn_attempts(version_id);

-- Response semantics: a student may edit a response before it commits; once
-- the interaction's consequence/state advancement fires, it is immutable for
-- that attempt path (no consequence-peeking undo). Revisiting a block via a
-- branch loop creates a new instance_key rather than overwriting history.
CREATE TABLE IF NOT EXISTS learn_responses (
  id text PRIMARY KEY,
  attempt_id text NOT NULL REFERENCES learn_attempts(id) ON DELETE CASCADE,
  block_id text NOT NULL,
  instance_key integer NOT NULL DEFAULT 0,
  response jsonb NOT NULL,
  outcome jsonb,
  committed_at bigint,
  answered_at bigint NOT NULL,
  UNIQUE (attempt_id, block_id, instance_key)
);

CREATE INDEX IF NOT EXISTS learn_responses_attempt_id_idx ON learn_responses(attempt_id);

CREATE TABLE IF NOT EXISTS learn_lesson_mastery (
  user_id text NOT NULL,
  lesson_id text NOT NULL REFERENCES learn_lessons(id) ON DELETE CASCADE,
  best_score integer,
  best_stars integer,
  attempts integer NOT NULL DEFAULT 0,
  first_completed_at bigint,
  last_attempt_id text REFERENCES learn_attempts(id) ON DELETE SET NULL,
  last_version_id text REFERENCES learn_lesson_versions(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS learn_assignment_progress (
  user_id text NOT NULL,
  context_type text NOT NULL CHECK (context_type IN ('cohort', 'program')),
  context_id text NOT NULL,
  lesson_id text NOT NULL REFERENCES learn_lessons(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  completed_attempt_id text REFERENCES learn_attempts(id) ON DELETE SET NULL,
  completed_at bigint,
  PRIMARY KEY (user_id, context_type, context_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS learn_assignment_progress_context_idx
  ON learn_assignment_progress(context_type, context_id);

-- XP idempotency: completion awards a row keyed by a unique source_key
-- (e.g. `attempt:<id>:completion`), then `completeAttempt` rolls the amount
-- into `users.xp` inside the same transaction. A retried/crashed
-- completeAttempt cannot double-bank XP because the second insert attempt
-- on the same source_key is a no-op (see app/actions/learn-play.ts, Stage 2).
CREATE TABLE IF NOT EXISTS learn_xp_events (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  source_key text NOT NULL UNIQUE,
  amount integer NOT NULL,
  created_at bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS learn_xp_events_user_id_idx ON learn_xp_events(user_id);

ALTER TABLE learn_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_lesson_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_assignment_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_xp_events ENABLE ROW LEVEL SECURITY;
