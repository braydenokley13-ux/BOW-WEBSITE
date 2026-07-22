-- Flywheel schema belongs in deployment migrations, never request-time reads.

CREATE TABLE IF NOT EXISTS class_closeouts (
  class_id text PRIMARY KEY,
  attendance_finalized double precision NOT NULL DEFAULT 0,
  feedback_collected double precision NOT NULL DEFAULT 0,
  testimonial_captured double precision NOT NULL DEFAULT 0,
  referrals_prompted double precision NOT NULL DEFAULT 0,
  partner_followed_up double precision NOT NULL DEFAULT 0,
  repeat_planned double precision NOT NULL DEFAULT 0,
  instructor_followed_up double precision NOT NULL DEFAULT 0,
  asset_captured double precision NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  completed_at double precision,
  updated_at double precision NOT NULL
);

CREATE TABLE IF NOT EXISTS growth_introductions (
  id text PRIMARY KEY,
  introducer_type text NOT NULL CHECK (introducer_type IN ('instructor','student','partner','contributor')),
  introducer_id text NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('student','instructor','partner','community')),
  target_name text NOT NULL,
  status text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','contacted','converted','declined')),
  note text NOT NULL DEFAULT '',
  owner_user_id text,
  created_at double precision NOT NULL,
  resolved_at double precision
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS outcome text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_key text;
ALTER TABLE growth_introductions ADD COLUMN IF NOT EXISTS converted_organization_id text;

CREATE INDEX IF NOT EXISTS idx_growth_intros_introducer
  ON growth_introductions (introducer_type, introducer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_open_source_key
  ON tasks (source_key) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_tasks_status_entity
  ON tasks (status, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status_due
  ON tasks (status, due_on);
CREATE INDEX IF NOT EXISTS idx_spo_student_outcome
  ON student_program_outcomes (student_id, outcome_type);
CREATE INDEX IF NOT EXISTS idx_intros_status_created
  ON growth_introductions (status, created_at);

ALTER TABLE class_closeouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_introductions ENABLE ROW LEVEL SECURITY;
