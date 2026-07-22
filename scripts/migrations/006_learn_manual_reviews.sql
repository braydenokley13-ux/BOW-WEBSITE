-- ============================================================
-- 006_learn_manual_reviews.sql — Playbook Engine: manual-review queue.
--
-- See 001_learn_core.sql header for id/timestamp/RLS conventions.
--
-- `long_text` blocks with `reflection.mode: 'manual_review'` never score
-- through the pure engine (lib/learn/engine.ts's gradeBlock always returns
-- pointsEarned/pointsPossible = 0 for this mode, by design — grading a human
-- reflection requires a human, not a formula). This table is where that
-- human grading actually lives: one row per (attempt, block), created
-- `pending` when the student commits the response (app/actions/learn-play.ts
-- submitResponse), updated to `approved` by an instructor
-- (app/actions/learn-review.ts approveReview) with points (<= points_possible
-- from the block's authored config) + a feedback note. Approved points are
-- added on top of the engine's base score by a shared recompute helper
-- (lib/learn/review.ts), called both at initial completeAttempt time and
-- again if a review lands after the attempt already completed.
-- ============================================================

CREATE TABLE IF NOT EXISTS learn_manual_reviews (
  id text PRIMARY KEY,
  attempt_id text NOT NULL REFERENCES learn_attempts(id) ON DELETE CASCADE,
  block_id text NOT NULL,
  user_id text NOT NULL,
  lesson_id text NOT NULL REFERENCES learn_lessons(id) ON DELETE CASCADE,
  prompt text,
  response_text text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  points_possible integer NOT NULL DEFAULT 0,
  points_awarded integer,
  feedback text,
  reviewed_by text,
  reviewed_at bigint,
  created_at bigint NOT NULL,
  UNIQUE (attempt_id, block_id)
);

CREATE INDEX IF NOT EXISTS learn_manual_reviews_status_idx ON learn_manual_reviews(status);
CREATE INDEX IF NOT EXISTS learn_manual_reviews_user_idx ON learn_manual_reviews(user_id);

ALTER TABLE learn_manual_reviews ENABLE ROW LEVEL SECURITY;
