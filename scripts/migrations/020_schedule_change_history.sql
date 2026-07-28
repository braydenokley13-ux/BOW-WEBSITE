-- Schedule change history.
--
-- `class_sessions` records the CURRENT schedule and, since 018, who cancelled a
-- session and why. What it cannot answer is what the schedule used to be, who
-- was affected, whether they were told, and whether they acknowledged it — so a
-- rescheduled session overwrote its own history and the only evidence a family
-- had been notified was that someone remembered sending an email.
--
-- This table is that record. It is deliberately separate from
-- `family_notifications` (which is one message to one family) because one
-- schedule change fans out to many families and must stay a single reviewable
-- event with its own delivery and acknowledgment rollup.

CREATE TABLE IF NOT EXISTS schedule_changes (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('session_cancelled', 'session_rescheduled', 'class_paused', 'program_cancelled', 'location_changed')),
  program_id text REFERENCES programs(id) ON DELETE CASCADE,
  class_id text REFERENCES classes(id) ON DELETE CASCADE,
  session_id text REFERENCES class_sessions(id) ON DELETE CASCADE,
  previous_starts_at bigint,
  previous_location text,
  new_starts_at bigint,
  new_location text,
  reason text NOT NULL,
  message text,
  changed_by_user_id text,
  changed_by_label text NOT NULL,
  affected_students integer NOT NULL DEFAULT 0,
  notifications_created integer NOT NULL DEFAULT 0,
  requires_acknowledgment boolean NOT NULL DEFAULT false,
  created_at bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_schedule_changes_program ON schedule_changes (program_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_schedule_changes_session ON schedule_changes (session_id);

-- Links one fan-out message back to the change that caused it, so the admin
-- view can show delivery and acknowledgment per family without guessing which
-- notification belonged to which change.
ALTER TABLE family_notifications ADD COLUMN IF NOT EXISTS schedule_change_id text
  REFERENCES schedule_changes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_family_notifications_schedule_change
  ON family_notifications (schedule_change_id) WHERE schedule_change_id IS NOT NULL;

ALTER TABLE schedule_changes ENABLE ROW LEVEL SECURITY;
