-- ============================================================
-- 008_people_weekly_operations.sql
-- Weekly execution, manager attention, recovery/escalation, and role
-- activation history. These extend the canonical People/Work primitives;
-- they do not create a second task or performance system.
-- ============================================================

CREATE TABLE people_weekly_cycles (
  id text PRIMARY KEY,
  person_id text NOT NULL REFERENCES people(id),
  role_assignment_id text REFERENCES role_assignments(id),
  manager_user_id text REFERENCES users(id),
  week_start text NOT NULL,
  commitment text NOT NULL,
  expected_result text NOT NULL,
  linked_outcome_id text REFERENCES outcomes(id),
  declared_status text NOT NULL DEFAULT 'on_track'
    CHECK (declared_status IN ('on_track','blocked','at_risk')),
  blocker text,
  help_needed text,
  manager_confirmed_at double precision,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  derived_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  closed_at double precision,
  created_at double precision NOT NULL,
  updated_at double precision NOT NULL,
  UNIQUE (person_id, week_start)
);
CREATE INDEX idx_people_weekly_cycles_manager
  ON people_weekly_cycles(manager_user_id, status, week_start);
CREATE INDEX idx_people_weekly_cycles_person
  ON people_weekly_cycles(person_id, week_start DESC);

-- A commitment must be grounded in the canonical Work queue. This junction
-- links existing tasks into a weekly cycle; it does not create weekly tasks.
CREATE TABLE people_weekly_cycle_tasks (
  weekly_cycle_id text NOT NULL REFERENCES people_weekly_cycles(id) ON DELETE CASCADE,
  task_id text NOT NULL REFERENCES tasks(id),
  created_at double precision NOT NULL,
  PRIMARY KEY (weekly_cycle_id, task_id)
);
CREATE INDEX idx_people_weekly_cycle_tasks_task
  ON people_weekly_cycle_tasks(task_id);

CREATE TABLE people_accountability_events (
  id text PRIMARY KEY,
  person_id text NOT NULL REFERENCES people(id),
  role_assignment_id text REFERENCES role_assignments(id),
  weekly_cycle_id text REFERENCES people_weekly_cycles(id),
  task_id text REFERENCES tasks(id),
  event_type text NOT NULL CHECK (event_type IN (
    'commitment_missed','recovery_requested','recovery_committed',
    'at_risk','role_review_opened','resolved'
  )),
  reason text NOT NULL,
  recovery_commitment text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  dedupe_key text UNIQUE,
  actor_user_id text REFERENCES users(id),
  created_at double precision NOT NULL,
  resolved_at double precision
);
CREATE INDEX idx_people_accountability_open
  ON people_accountability_events(person_id, status, created_at DESC);

CREATE TABLE role_activation_requirements (
  id text PRIMARY KEY,
  role_assignment_id text NOT NULL REFERENCES role_assignments(id),
  requirement_key text NOT NULL,
  label text NOT NULL,
  requirement_type text NOT NULL CHECK (requirement_type IN (
    'onboarding','eligibility','training','first_approved_work','manager_review','custom'
  )),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','satisfied','waived')),
  source_type text,
  source_id text,
  decision_note text,
  decided_by_user_id text REFERENCES users(id),
  decided_at double precision,
  created_at double precision NOT NULL,
  updated_at double precision NOT NULL,
  UNIQUE (role_assignment_id, requirement_key)
);
CREATE INDEX idx_role_activation_requirements_assignment
  ON role_activation_requirements(role_assignment_id, status);

CREATE TABLE role_assignment_decisions (
  id text PRIMARY KEY,
  role_assignment_id text NOT NULL REFERENCES role_assignments(id),
  decision_type text NOT NULL CHECK (decision_type IN (
    'activation','autonomy_change','manager_change','pause','resume','end','revoke','role_review'
  )),
  prior_status text,
  next_status text,
  prior_autonomy integer,
  next_autonomy integer,
  reason text NOT NULL,
  actor_user_id text NOT NULL REFERENCES users(id),
  created_at double precision NOT NULL
);
CREATE INDEX idx_role_assignment_decisions_assignment
  ON role_assignment_decisions(role_assignment_id, created_at DESC);

ALTER TABLE role_assignments
  ADD COLUMN IF NOT EXISTS weekly_capacity_hours double precision;
ALTER TABLE role_assignments
  ADD COLUMN IF NOT EXISTS availability_status text NOT NULL DEFAULT 'available';
ALTER TABLE role_assignments
  DROP CONSTRAINT IF EXISTS role_assignments_availability_status_check;
ALTER TABLE role_assignments
  ADD CONSTRAINT role_assignments_availability_status_check
  CHECK (availability_status IN ('available','limited','unavailable'));

-- Seed activation checks only for existing assignments. Future assignment
-- creation inserts the same configurable defaults through its server action.
INSERT INTO role_activation_requirements
  (id, role_assignment_id, requirement_key, label, requirement_type, status, created_at, updated_at)
SELECT 'rar-onboarding-' || replace(gen_random_uuid()::text, '-', ''), ra.id,
       'onboarding', 'Complete onboarding', 'onboarding',
       CASE WHEN ra.status = 'active' THEN 'satisfied' ELSE 'pending' END,
       floor(extract(epoch from now()) * 1000), floor(extract(epoch from now()) * 1000)
FROM role_assignments ra
ON CONFLICT (role_assignment_id, requirement_key) DO NOTHING;

INSERT INTO role_activation_requirements
  (id, role_assignment_id, requirement_key, label, requirement_type, status, created_at, updated_at)
SELECT 'rar-first-work-' || replace(gen_random_uuid()::text, '-', ''), ra.id,
       'first_approved_work', 'Complete first approved Work', 'first_approved_work',
       CASE WHEN EXISTS (
         SELECT 1 FROM tasks t WHERE t.role_assignment_id = ra.id AND t.workflow_state = 'approved'
       ) THEN 'satisfied' ELSE 'pending' END,
       floor(extract(epoch from now()) * 1000), floor(extract(epoch from now()) * 1000)
FROM role_assignments ra
ON CONFLICT (role_assignment_id, requirement_key) DO NOTHING;

INSERT INTO role_activation_requirements
  (id, role_assignment_id, requirement_key, label, requirement_type, status, created_at, updated_at)
SELECT 'rar-manager-' || replace(gen_random_uuid()::text, '-', ''), ra.id,
       'manager_review', 'Manager activation review', 'manager_review',
       CASE WHEN ra.status = 'active' THEN 'satisfied' ELSE 'pending' END,
       floor(extract(epoch from now()) * 1000), floor(extract(epoch from now()) * 1000)
FROM role_assignments ra
ON CONFLICT (role_assignment_id, requirement_key) DO NOTHING;

ALTER TABLE people_weekly_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE people_weekly_cycle_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE people_accountability_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_activation_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_assignment_decisions ENABLE ROW LEVEL SECURITY;
