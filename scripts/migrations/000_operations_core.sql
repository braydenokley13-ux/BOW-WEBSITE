-- ============================================================
-- 000_operations_core.sql — canonical DDL for the operations, classes,
-- instructor-workforce, training and growth tables.
--
-- WHY 000: these tables predate scripts/migrations/. They were originally
-- created by the one-off SQLite->Supabase migration script or by hand in
-- Supabase Studio, so the repo had no committed DDL for them at all and a
-- fresh database could not be built (`scripts/migrate-people-work-os.ts`
-- died on `relation "tasks" does not exist`, which in turn broke
-- 008_people_weekly_operations.sql on `role_assignments`). This file
-- closes that gap so `npm run db:setup` works against an empty database.
--
-- Every statement is CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS,
-- so applying this to an existing database (including production, where
-- these tables already exist) is a no-op.
--
-- Conventions match scripts/dev-bootstrap.sql: ids are app-generated `text`
-- primary keys, timestamps are `bigint` epoch-milliseconds, booleans are
-- `integer` 0/1, enum-ish columns are `text`. Cross-references between
-- these tables are deliberately plain columns rather than foreign keys so
-- seed and backfill order stays unconstrained.
-- ============================================================


-- tasks: used by lib/hiring.ts:listTasks / app/actions/tasks.ts createWork / rowToTask
CREATE TABLE IF NOT EXISTS tasks (
  id text PRIMARY KEY,
  title text NOT NULL,
  owner_user_id text,
  doer_user_id text,
  assigner_user_id text,
  reviewer_user_id text,
  due_at bigint,
  due_on text,
  status text NOT NULL DEFAULT 'open',
  workflow_state text,
  kind text,
  priority text,
  context text,
  recommended_action text,
  expected_result text,
  definition_of_done text,
  evidence_requirement text,
  review_required integer NOT NULL DEFAULT 0,
  autonomy_level text,
  entity_type text,
  entity_id text,
  handoff_to_founder integer NOT NULL DEFAULT 0,
  source_key text,
  outcome text,
  completed_at bigint,
  completion_note text,
  role_assignment_id text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- programs: used by lib/operations.ts:loadSnapshot/mapProgram, app/actions/programs.ts
CREATE TABLE IF NOT EXISTS programs (
  -- public-catalog columns (is_public, public_status, short_description,
  -- long_description, grade_range, image_url, registration_mode,
  -- full_capacity_behavior, registration_deadline) are deliberately absent:
  -- 012_public_programs.sql owns them, with its own types and CHECKs.
  id text PRIMARY KEY,
  request_key text,
  name text NOT NULL,
  partner_org_id text,
  primary_contact_person_id text,
  location_id text,
  curriculum_id text,
  audience text,
  delivery_format text,
  stage text NOT NULL DEFAULT 'opportunity',
  start_date text,
  end_date text,
  launch_date text,
  schedule_label text,
  schedule_day integer,
  schedule_start_time text,
  schedule_end_time text,
  schedule_timezone text,
  capacity integer,
  minimum_enrollment integer NOT NULL DEFAULT 1,
  owner_user_id text,
  partner_confirmed integer NOT NULL DEFAULT 0,
  materials_status text NOT NULL DEFAULT 'not_ready',
  renewal_status text NOT NULL DEFAULT 'not_due',
  source_type text,
  source_id text,
  parent_program_id text,
  outcome_summary text,
  notes text,
  launch_exception_reason text,
  launch_exception_approved_by text,
  launch_exception_approved_at bigint,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- curricula: used by lib/hiring.ts:listCurricula/rowToCurriculum, app/actions/curriculum.ts
CREATE TABLE IF NOT EXISTS curricula (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text,
  age_range text,
  published integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- locations: used by lib/operations.ts:loadSnapshot/mapLocation, app/actions/locations.ts
CREATE TABLE IF NOT EXISTS locations (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text,
  region text,
  city text,
  state text,
  address text,
  timezone text,
  parent_location_id text,
  region_id text,
  primary_leader_user_id text,
  stage text NOT NULL DEFAULT 'prospect',
  capacity integer,
  expected_demand integer,
  rationale text,
  earliest_launch_date text,
  notes text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- operating_regions: used by lib/operations.ts:loadSnapshot, app/actions/regions.ts
CREATE TABLE IF NOT EXISTS operating_regions (
  id text PRIMARY KEY,
  name text NOT NULL,
  code text,
  leader_user_id text,
  timezone text,
  stage text NOT NULL DEFAULT 'active',
  notes text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- partner_orgs: used by lib/hiring.ts:listDemoRequests, app/actions/partners.ts
CREATE TABLE IF NOT EXISTS partner_orgs (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL,
  org_type text,
  contact_name text,
  contact_email text,
  custom_headline text,
  custom_body text,
  created_at bigint NOT NULL
);

-- organization_locations: used by lib/operations.ts:loadSnapshot, app/actions/programs.ts
CREATE TABLE IF NOT EXISTS organization_locations (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  location_id text NOT NULL,
  relationship_type text NOT NULL,
  active integer NOT NULL DEFAULT 1,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- organization_people: used by lib/operations.ts:loadSnapshot, app/actions/programs.ts, lib/partner-intake.ts
CREATE TABLE IF NOT EXISTS organization_people (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  person_id text NOT NULL,
  relationship_type text NOT NULL,
  is_primary integer NOT NULL DEFAULT 0,
  active integer NOT NULL DEFAULT 1,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- classes: used by lib/hiring.ts:rowToClass, lib/operations.ts, app/actions/classes.ts
CREATE TABLE IF NOT EXISTS classes (
  id text PRIMARY KEY,
  title text NOT NULL,
  curriculum_id text,
  partner_org_id text,
  location text,
  online_format text,
  start_date text,
  end_date text,
  recurrence text,
  schedule_day integer,
  schedule_start_time text,
  schedule_end_time text,
  schedule_timezone text,
  age_range text,
  capacity integer,
  minimum_enrollment integer NOT NULL DEFAULT 1,
  lead_instructor_id text,
  program_id text,
  location_id text,
  status text NOT NULL DEFAULT 'planning',
  internal_notes text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- class_sessions: used by lib/hiring.ts, lib/operations.ts, app/actions/classes.ts
CREATE TABLE IF NOT EXISTS class_sessions (
  id text PRIMARY KEY,
  class_id text NOT NULL,
  session_date bigint NOT NULL,
  session_on text,
  timezone text,
  location text,
  created_at bigint NOT NULL
);

-- class_enrollments: used by lib/hiring.ts, lib/operations.ts, app/actions/classes.ts, students.ts, lms.ts
CREATE TABLE IF NOT EXISTS class_enrollments (
  id text PRIMARY KEY,
  class_id text NOT NULL,
  student_id text NOT NULL,
  status text NOT NULL DEFAULT 'enrolled',
  enrolled_at bigint,
  withdrawn_at bigint,
  withdrawal_reason text,
  confirmed_at bigint,
  confirmation_source text
);

-- class_instructors: used by lib/operations.ts:loadSnapshot, app/actions/classes.ts, lms.ts, programs.ts
CREATE TABLE IF NOT EXISTS class_instructors (
  id text PRIMARY KEY,
  class_id text NOT NULL,
  instructor_id text NOT NULL,
  role text NOT NULL,
  decision_reason text,
  assigned_by text,
  decision_id text,
  decision_fingerprint text,
  decision_at bigint,
  added_at bigint NOT NULL,
  removed_at bigint,
  removal_reason text,
  removed_by text,
  removal_decision_id text,
  removal_decision_fingerprint text
);

-- class_session_reports: used by lib/operations.ts:loadSnapshot, app/actions/classes.ts
CREATE TABLE IF NOT EXISTS class_session_reports (
  id text PRIMARY KEY,
  session_id text NOT NULL,
  notes text,
  flagged integer NOT NULL DEFAULT 0,
  flag_reason text,
  completed integer NOT NULL DEFAULT 0,
  reported_by text,
  reported_at bigint NOT NULL,
  lesson_id text,
  lesson_snapshot text
);

-- class_proposals: used by lib/hiring.ts:listClassProposals, app/actions/classes.ts
CREATE TABLE IF NOT EXISTS class_proposals (
  id text PRIMARY KEY,
  instructor_id text NOT NULL,
  title text NOT NULL,
  age_group text,
  curriculum_topic text,
  format text,
  schedule text,
  description text,
  resources text,
  status text NOT NULL DEFAULT 'draft',
  converted_class_id text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- students: used by lib/hiring.ts:rowToStudent, app/actions/students.ts, auth.ts, public-registration.ts
CREATE TABLE IF NOT EXISTS students (
  id text PRIMARY KEY,
  name text NOT NULL,
  age integer,
  grade text,
  email text,
  guardian_person_id text,
  school text,
  emergency_notes text,
  enrollment_status text NOT NULL DEFAULT 'active',
  form_status text NOT NULL DEFAULT 'missing',
  communication_notes text,
  user_id text,
  person_id text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- instructors: used by lib/hiring.ts:rowToInstructor, lib/operations.ts, app/actions/instructors.ts, people-work.ts
CREATE TABLE IF NOT EXISTS instructors (
  id text PRIMARY KEY,
  person_id text NOT NULL,
  stage text NOT NULL DEFAULT 'applied',
  source text,
  owner_user_id text,
  answers text,
  interview_at bigint,
  interview_timezone text,
  interview_notes text,
  founder_decision text,
  decided_by text,
  decided_at bigint,
  onboarding_status text NOT NULL DEFAULT 'not_started',
  training_status text NOT NULL DEFAULT 'not_started',
  eligibility_status text NOT NULL DEFAULT 'not_eligible',
  progression_level text NOT NULL DEFAULT 'instructor',
  max_weekly_classes integer NOT NULL DEFAULT 3,
  development_focus text,
  referred_by_person_id text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- instructor_availability: used by lib/instructor-workforce.ts, lib/hiring.ts, app/actions/instructors.ts
CREATE TABLE IF NOT EXISTS instructor_availability (
  id text PRIMARY KEY,
  instructor_id text NOT NULL,
  day_of_week integer NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  notes text,
  created_at bigint NOT NULL
);

-- instructor_development_items: used by lib/instructor-workforce.ts, app/actions/instructor-quality.ts
CREATE TABLE IF NOT EXISTS instructor_development_items (
  id text PRIMARY KEY,
  instructor_id text NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  stage text NOT NULL DEFAULT 'identified',
  owner_user_id text,
  due_at bigint,
  due_on text,
  status text NOT NULL DEFAULT 'open',
  notes text,
  related_feedback_id text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  resolved_at bigint
);

-- instructor_feedback: used by lib/instructor-workforce.ts, app/actions/instructor-quality.ts, lms.ts
CREATE TABLE IF NOT EXISTS instructor_feedback (
  id text PRIMARY KEY,
  instructor_id text NOT NULL,
  source_type text NOT NULL,
  submitted_by_user_id text,
  author_name text,
  class_id text,
  program_id text,
  partner_org_id text,
  session_id text,
  visibility text NOT NULL DEFAULT 'leadership',
  curriculum_delivery double precision,
  student_family_relationships double precision,
  organization_reliability double precision,
  leadership_contribution double precision,
  strengths text,
  concerns text,
  body text,
  follow_up_required integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL
);

-- instructor_qualifications: used by lib/operations.ts:loadSnapshot, lib/instructor-workforce.ts, app/actions/instructor-quality.ts
CREATE TABLE IF NOT EXISTS instructor_qualifications (
  id text PRIMARY KEY,
  instructor_id text NOT NULL,
  kind text NOT NULL,
  value text NOT NULL,
  status text NOT NULL DEFAULT 'approved',
  approved_by text,
  approved_at bigint,
  expires_at bigint,
  expires_on text,
  notes text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  UNIQUE (instructor_id, kind, value)
);

-- practice_evaluations: used by lib/hiring.ts:recomputeInstructorStatuses/getInstructorDetail, app/actions/instructors.ts
CREATE TABLE IF NOT EXISTS practice_evaluations (
  id text PRIMARY KEY,
  instructor_id text NOT NULL,
  evaluator_user_id text,
  evaluated_at bigint NOT NULL,
  lesson_used text,
  rating_curriculum_delivery double precision,
  rating_communication_engagement double precision,
  rating_preparedness_reliability double precision,
  strengths text,
  concerns text,
  decision text NOT NULL,
  created_at bigint NOT NULL
);

-- training_modules: used by lib/hiring.ts:rowToTrainingModule, app/actions/training.ts
CREATE TABLE IF NOT EXISTS training_modules (
  id text PRIMARY KEY,
  title text NOT NULL,
  category text NOT NULL,
  required integer NOT NULL DEFAULT 0,
  content_type text NOT NULL DEFAULT 'text',
  content text,
  ordinal integer NOT NULL DEFAULT 0,
  active integer NOT NULL DEFAULT 1,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- training_module_completions: used by lib/hiring.ts:recomputeInstructorStatuses/getInstructorDetail, app/actions/instructors.ts
CREATE TABLE IF NOT EXISTS training_module_completions (
  id text PRIMARY KEY,
  instructor_id text NOT NULL,
  module_id text NOT NULL,
  completed_at bigint NOT NULL,
  notes text
);

-- training_module_views: used by app/actions/instructors.ts (ON CONFLICT(instructor_id, module_id))
CREATE TABLE IF NOT EXISTS training_module_views (
  instructor_id text NOT NULL,
  module_id text NOT NULL,
  first_viewed_at bigint NOT NULL,
  last_viewed_at bigint NOT NULL,
  PRIMARY KEY (instructor_id, module_id)
);

-- attendance_records: used by lib/hiring.ts:getStudentAttendanceHistory, app/actions/classes.ts
CREATE TABLE IF NOT EXISTS attendance_records (
  id text PRIMARY KEY,
  session_id text NOT NULL,
  student_id text NOT NULL,
  present integer NOT NULL DEFAULT 0,
  status text,
  note text,
  recorded_by text,
  recorded_at bigint NOT NULL
);

-- crm_activity: used by lib/hiring.ts:logActivity/listActivity, lib/operations.ts:loadSnapshot
CREATE TABLE IF NOT EXISTS crm_activity (
  id text PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  kind text NOT NULL,
  body text,
  actor_user_id text,
  created_at bigint NOT NULL
);

-- demo_requests: used by lib/hiring.ts:listDemoRequests, app/actions/partners.ts
CREATE TABLE IF NOT EXISTS demo_requests (
  id text PRIMARY KEY,
  org_slug text NOT NULL,
  requester_name text NOT NULL,
  requester_email text NOT NULL,
  message text,
  dispositioned integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL
);

-- operational_decisions: used by lib/operations.ts:loadSnapshot (staffingDecisions), lib/operational-decisions.ts
CREATE TABLE IF NOT EXISTS operational_decisions (
  id text PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  decision_type text NOT NULL,
  decision text,
  reason text,
  fingerprint text,
  decided_by_user_id text,
  decided_at bigint NOT NULL,
  metadata text
);

-- ==================== growth / acquisition ====================

-- growth_channels: used by lib/growth-schema.ts (GROWTH_CHANNELS seed), app/actions/growth.ts (createGrowthCampaign, recordStudentAcquisition, recordStudentReferral)
CREATE TABLE IF NOT EXISTS growth_channels (
  id text PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  created_at bigint,
  updated_at bigint NOT NULL
);

-- growth_campaigns: used by lib/growth.ts:readCampaigns / app/actions/growth.ts:createGrowthCampaign, updateGrowthCampaignState
CREATE TABLE IF NOT EXISTS growth_campaigns (
  id text PRIMARY KEY,
  name text NOT NULL,
  channel_id text NOT NULL,
  owner_user_id text,
  region_id text,
  location_id text,
  hypothesis text,
  status text NOT NULL,
  starts_on text NOT NULL,
  ends_on text NOT NULL,
  target_metric text NOT NULL,
  target_value double precision NOT NULL,
  budget_cents integer NOT NULL DEFAULT 0,
  spend_cents integer NOT NULL DEFAULT 0,
  result_value double precision,
  decision text,
  learning text,
  created_by_user_id text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- growth_contributors: used by lib/growth.ts:readContributors / app/actions/growth.ts:createGrowthContributor, updateGrowthContributorStatus
CREATE TABLE IF NOT EXISTS growth_contributors (
  id text PRIMARY KEY,
  person_id text NOT NULL,
  status text NOT NULL,
  source_channel_id text,
  joined_on text,
  exited_on text,
  notes text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- growth_assignments: used by lib/growth.ts:readContributors/touchpointScope / app/actions/growth.ts:createGrowthAssignment, closeGrowthAssignment
CREATE TABLE IF NOT EXISTS growth_assignments (
  id text PRIMARY KEY,
  contributor_id text NOT NULL,
  role text NOT NULL,
  manager_assignment_id text,
  region_id text,
  location_id text,
  starts_on text NOT NULL,
  ends_on text,
  status text NOT NULL,
  decision_reason text,
  closed_by_user_id text,
  closure_reason text,
  created_by_user_id text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- growth_playbooks: used by lib/growth.ts:readPlaybooks / app/actions/growth.ts:createGrowthPlaybook
CREATE TABLE IF NOT EXISTS growth_playbooks (
  id text PRIMARY KEY,
  slug text NOT NULL,
  title text NOT NULL,
  status text NOT NULL,
  source_campaign_id text NOT NULL,
  owner_user_id text NOT NULL,
  problem text NOT NULL,
  play text NOT NULL,
  evidence text NOT NULL,
  adoption_notes text,
  published_at bigint,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- operating_goals: used by lib/growth.ts:readGoals / app/actions/growth.ts:createOperatingGoal, closeOperatingGoal
CREATE TABLE IF NOT EXISTS operating_goals (
  id text PRIMARY KEY,
  scope_type text NOT NULL,
  scope_id text NOT NULL,
  metric text NOT NULL,
  target_value double precision NOT NULL,
  starts_on text NOT NULL,
  ends_on text NOT NULL,
  owner_user_id text NOT NULL,
  status text NOT NULL,
  result_value double precision,
  closed_at bigint,
  decision_note text,
  notes text,
  created_by_user_id text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- student_acquisition_touchpoints: used by lib/growth.ts (funnel/campaigns/markets), app/actions/growth.ts (recordStudentAcquisition, recordStudentReferral), app/actions/public-forms.ts (recordPublicInquiryTouchpoint), app/actions/students.ts (attachFirstTouchAttribution)
CREATE TABLE IF NOT EXISTS student_acquisition_touchpoints (
  id text PRIMARY KEY,
  person_id text,
  student_id text,
  channel_id text NOT NULL,
  campaign_id text,
  contributor_id text,
  touchpoint_type text NOT NULL,
  occurred_at bigint NOT NULL,
  occurred_on text NOT NULL,
  timezone text,
  external_key text,
  detail text,
  recorded_by_user_id text,
  source_type text,
  source_id text,
  voided_at bigint,
  voided_by_user_id text,
  void_reason text,
  created_at bigint NOT NULL
);

-- student_acquisition_attributions: used by lib/growth.ts (funnel/metricActual), app/actions/growth.ts:replaceCurrentAttribution, app/actions/students.ts:attachFirstTouchAttribution
CREATE TABLE IF NOT EXISTS student_acquisition_attributions (
  id text PRIMARY KEY,
  student_id text NOT NULL,
  touchpoint_id text NOT NULL,
  method text NOT NULL,
  evidence_note text,
  effective_from bigint NOT NULL,
  effective_to bigint,
  decided_by_user_id text,
  decision_source text,
  decision_source_id text,
  created_at bigint NOT NULL
);

-- student_referrals: used by lib/growth.ts (funnel/metricActual successful_referrals), app/actions/growth.ts:recordStudentReferral
CREATE TABLE IF NOT EXISTS student_referrals (
  id text PRIMARY KEY,
  referrer_person_id text NOT NULL,
  referred_person_id text NOT NULL,
  referred_student_id text,
  touchpoint_id text NOT NULL,
  campaign_id text,
  contributor_id text,
  referral_code text NOT NULL,
  submitted_at bigint NOT NULL,
  notes text,
  created_by_user_id text,
  voided_at bigint,
  voided_by_user_id text,
  void_reason text,
  created_at bigint NOT NULL
);

-- student_program_outcomes: used by lib/growth.ts:readFunnel (completions), app/actions/growth.ts:recordStudentProgramOutcome
CREATE TABLE IF NOT EXISTS student_program_outcomes (
  id text PRIMARY KEY,
  student_id text NOT NULL,
  program_id text NOT NULL,
  outcome_type text NOT NULL,
  occurred_on text NOT NULL,
  evidence_note text,
  recorded_by_user_id text,
  created_at bigint NOT NULL
);

-- ==================== reconciliation ====================
-- `people` and `instructors` are also created (in an older, narrower shape)
-- by scripts/dev-bootstrap.sql, and exist in production from before this
-- repo had migrations. The CREATE TABLE IF NOT EXISTS statements above are
-- therefore a no-op for them, so every column the current code reads has to
-- be added explicitly. Note `interview_timezone`: dev-bootstrap spells it
-- `interview_time_zone`, which no code path ever reads.

ALTER TABLE instructors ADD COLUMN IF NOT EXISTS interview_timezone text;
ALTER TABLE instructors ADD COLUMN IF NOT EXISTS progression_level text NOT NULL DEFAULT 'instructor';
ALTER TABLE instructors ADD COLUMN IF NOT EXISTS max_weekly_classes integer NOT NULL DEFAULT 3;
ALTER TABLE instructors ADD COLUMN IF NOT EXISTS development_focus text;
ALTER TABLE instructors ADD COLUMN IF NOT EXISTS referred_by_person_id text;
ALTER TABLE instructors ALTER COLUMN onboarding_status SET DEFAULT 'not_started';
ALTER TABLE instructors ALTER COLUMN training_status SET DEFAULT 'not_started';
ALTER TABLE instructors ALTER COLUMN eligibility_status SET DEFAULT 'not_eligible';
UPDATE instructors SET onboarding_status = 'not_started' WHERE onboarding_status IS NULL;
UPDATE instructors SET training_status = 'not_started' WHERE training_status IS NULL;
UPDATE instructors SET eligibility_status = 'not_eligible' WHERE eligibility_status IS NULL;

ALTER TABLE people ADD COLUMN IF NOT EXISTS org_id text;
ALTER TABLE people ADD COLUMN IF NOT EXISTS partner_org_id text;
ALTER TABLE people ADD COLUMN IF NOT EXISTS owner_user_id text;
ALTER TABLE people ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE people ADD COLUMN IF NOT EXISTS stage text;
ALTER TABLE people ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE people ADD COLUMN IF NOT EXISTS notes text;

-- practice_evaluations exists in production without its rating columns
-- (see docs/redesign/local-qa.md); getInstructorDetail() reads them all.
ALTER TABLE practice_evaluations ADD COLUMN IF NOT EXISTS evaluated_at bigint;
ALTER TABLE practice_evaluations ADD COLUMN IF NOT EXISTS rating_curriculum_delivery double precision;
ALTER TABLE practice_evaluations ADD COLUMN IF NOT EXISTS rating_communication_engagement double precision;
ALTER TABLE practice_evaluations ADD COLUMN IF NOT EXISTS rating_preparedness_reliability double precision;
ALTER TABLE practice_evaluations ADD COLUMN IF NOT EXISTS strengths text;
ALTER TABLE practice_evaluations ADD COLUMN IF NOT EXISTS concerns text;
