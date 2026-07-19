-- ============================================================================
-- 0002_schema_j_z.sql
--
-- Phase 1 of the SQLite -> Supabase Postgres migration.
--
-- Scope: every CREATE TABLE from the SQLite schema (lib/db.ts, and
-- lib/ledger-store.ts) whose table name starts with a letter from J-Z
-- (inclusive). Tables starting A-I are owned by 0001_schema_a_i.sql
-- (a separate file/agent) and are NOT redefined here, even when referenced.
--
-- Tables covered (26 letter-range match, alphabetical, 54 total):
--   lesson_progress, ledger_snapshots, locations, migration_conflicts,
--   migration_row_archive, nba_contracts, nba_player_stats, nba_players,
--   news_items, news_submissions, notifications, operating_goals,
--   operating_regions, operational_decisions, organization_locations,
--   organization_people, organizations, partner_orgs,
--   password_reset_tokens, people, player_cards, practice_evaluations,
--   profile_sharing_consents, programs, quiz_questions, quiz_responses,
--   scenario_responses, schema_migrations, security_rate_limits,
--   self_attendance, self_feed_responses, self_modules, self_progress,
--   session_notes, sessions, simulations, standards_alignment,
--   student_acquisition_attributions, student_acquisition_touchpoints,
--   student_badges, student_program_outcomes, student_referrals, students,
--   tasks, testimonials, training_module_completions,
--   training_module_views, training_modules, training_session_attendance,
--   training_session_registrations, training_sessions, users,
--   weekly_challenges, weekly_completions
--
-- (See the end-of-file summary comment for the exact final count/list as
-- written; the block above is alphabetized by table name, not by the order
-- tables appear below, which is FK-dependency order.)
--
-- Shared conversion conventions (matches 0001_schema_a_i.sql):
--   * TEXT primary keys stay TEXT.
--   * INTEGER PRIMARY KEY AUTOINCREMENT -> BIGINT GENERATED ALWAYS AS IDENTITY
--     PRIMARY KEY.
--   * Epoch-millisecond INTEGER timestamp columns (created_at, updated_at,
--     *_at, etc. -- populated in app code via Date.now() / unixepoch()*1000)
--     -> TIMESTAMPTZ, same column name. Each such column is annotated with a
--     comment noting the old representation (epoch ms) for the data-migration
--     phase, since the Postgres column will hold real timestamptz values and
--     the ETL step must convert epoch-ms integers -> to_timestamp(ms / 1000.0).
--   * Date-only TEXT columns (YYYY-MM-DD) -> DATE. Time-of-day TEXT columns
--     that are clearly HH:MM -> TIME. Ambiguous/free-text date-ish columns
--     are left as TEXT with a NOTE explaining why.
--   * Columns storing JSON as TEXT (confirmed via grep: JSON.parse /
--     JSON.stringify call sites) -> JSONB, with a comment.
--   * Boolean-ish INTEGER 0/1 columns -> BOOLEAN, with a comment that the
--     data migration must map 0/1 -> false/true.
--   * NOT NULL / DEFAULT / UNIQUE / CHECK constraints are preserved.
--     unixepoch()*1000-style defaults -> now(); plain literal defaults are
--     kept as-is (translated to Postgres literal syntax where needed).
--   * FOREIGN KEY constraints and all CREATE INDEX statements for tables in
--     this file are recreated here. Where a FK's target table lives in the
--     A-I file (0001), the constraint is still declared -- 0001 is assumed
--     to run before this file.
--   * All CREATE TABLE / CREATE INDEX statements use IF NOT EXISTS so the
--     migration is idempotent.
--   * Tables are ordered so FK dependencies come before dependents.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- schema_migrations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);

-- ---------------------------------------------------------------------------
-- migration_conflicts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS migration_conflicts (
  id TEXT PRIMARY KEY,
  migration_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  detail TEXT NOT NULL,
  resolved_at TIMESTAMPTZ, -- was INTEGER epoch ms, nullable
  created_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);

-- ---------------------------------------------------------------------------
-- migration_row_archive
-- payload confirmed JSON.stringify'd in lib/db.ts (archiveMigratedRow) -> JSONB
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS migration_row_archive (
  id TEXT PRIMARY KEY,
  migration_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  payload JSONB NOT NULL, -- was TEXT, JSON.stringify(row) in app code
  reason TEXT NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  location TEXT NOT NULL,
  status TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- users
-- NOTE: org_id has no FK in the SQLite source (no FOREIGN KEY clause was
-- ever declared), so none is added here to preserve existing behavior.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  first TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  org_id TEXT NOT NULL,
  grade TEXT,
  status TEXT NOT NULL,
  last TEXT NOT NULL,
  signin TEXT NOT NULL,
  password_hash TEXT,
  deletion_requested BOOLEAN NOT NULL DEFAULT false, -- was INTEGER 0/1
  last_active_at TIMESTAMPTZ, -- was INTEGER epoch ms
  created_at TIMESTAMPTZ, -- was INTEGER epoch ms
  onboarding_completed BOOLEAN NOT NULL DEFAULT false, -- was INTEGER 0/1
  password_change_required BOOLEAN NOT NULL DEFAULT false -- was INTEGER 0/1
);

-- ---------------------------------------------------------------------------
-- profile_sharing_consents
-- discoverable is CHECK (discoverable IN (0,1)) in SQLite; modeled as
-- BOOLEAN in Postgres, which makes the CHECK redundant (dropped).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profile_sharing_consents (
  id TEXT PRIMARY KEY,
  student_user_id TEXT NOT NULL,
  public_slug TEXT NOT NULL UNIQUE,
  guardian_name TEXT NOT NULL,
  guardian_email TEXT NOT NULL,
  consent_method TEXT NOT NULL,
  guardian_verified_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  granted_by_user_id TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  expires_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  revoked_by_user_id TEXT,
  revoked_at TIMESTAMPTZ, -- was INTEGER epoch ms
  discoverable BOOLEAN NOT NULL DEFAULT false, -- was INTEGER 0/1, CHECK (IN (0,1)) dropped as redundant
  notes TEXT,
  FOREIGN KEY (student_user_id) REFERENCES users(id),
  FOREIGN KEY (granted_by_user_id) REFERENCES users(id),
  FOREIGN KEY (revoked_by_user_id) REFERENCES users(id)
);

-- ---------------------------------------------------------------------------
-- lesson_progress
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  status TEXT NOT NULL,
  simulation_done BOOLEAN NOT NULL DEFAULT false, -- was INTEGER 0/1
  reflection TEXT NOT NULL DEFAULT '',
  challenge_done BOOLEAN NOT NULL DEFAULT false, -- was INTEGER 0/1
  podcast_progress REAL NOT NULL DEFAULT 0,
  started_at TEXT, -- NOTE: SQLite TEXT, not clearly epoch ms nor strict YYYY-MM-DD in schema; left as TEXT pending grep-confirmed usage
  completed_at TEXT, -- NOTE: see started_at
  PRIMARY KEY (user_id, lesson_id)
);

-- ---------------------------------------------------------------------------
-- session_notes
-- created_at (TEXT, human-readable label) and created_ts (INTEGER, epoch ms,
-- used for ORDER BY) are two distinct columns in the source -- kept distinct.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_notes (
  id TEXT PRIMARY KEY,
  cohort_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  student_id TEXT,
  scope TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL, -- NOTE: free-text/display timestamp, distinct from created_ts; left as TEXT
  created_ts TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms; used for ORDER BY created_ts DESC
);

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);

-- ---------------------------------------------------------------------------
-- password_reset_tokens
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  consumed_at TIMESTAMPTZ, -- was INTEGER epoch ms
  created_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
  ON password_reset_tokens (user_id, consumed_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expiry
  ON password_reset_tokens (expires_at);

-- ---------------------------------------------------------------------------
-- security_rate_limits
-- blocked_until DEFAULT 0 is an epoch-ms sentinel ("not blocked"); kept as
-- TIMESTAMPTZ with an epoch(0) default so 0 semantics are preserved.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS security_rate_limits (
  key TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  attempts INTEGER NOT NULL,
  blocked_until TIMESTAMPTZ NOT NULL DEFAULT to_timestamp(0), -- was INTEGER epoch ms DEFAULT 0
  updated_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);
CREATE INDEX IF NOT EXISTS idx_security_rate_limits_updated ON security_rate_limits (updated_at);

-- ---------------------------------------------------------------------------
-- self_modules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS self_modules (
  id TEXT PRIMARY KEY,
  ordinal INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  concept TEXT NOT NULL,
  central_question TEXT NOT NULL,
  track TEXT NOT NULL DEFAULT '101'
);

-- ---------------------------------------------------------------------------
-- self_progress
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS self_progress (
  student_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false, -- was INTEGER 0/1
  reflection TEXT NOT NULL DEFAULT '',
  reflection_words INTEGER NOT NULL DEFAULT 0,
  instructor_unlocked BOOLEAN NOT NULL DEFAULT false, -- was INTEGER 0/1
  completed_at TIMESTAMPTZ, -- was INTEGER epoch ms
  updated_at TIMESTAMPTZ, -- was INTEGER epoch ms
  track TEXT NOT NULL DEFAULT '101',
  PRIMARY KEY (student_id, module_id)
);
CREATE INDEX IF NOT EXISTS idx_self_progress_student ON self_progress (student_id);

-- ---------------------------------------------------------------------------
-- self_feed_responses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS self_feed_responses (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  story_id TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  UNIQUE (student_id, story_id)
);

-- ---------------------------------------------------------------------------
-- self_attendance
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS self_attendance (
  cohort_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  session_no INTEGER NOT NULL,
  present BOOLEAN NOT NULL DEFAULT false, -- was INTEGER 0/1
  PRIMARY KEY (cohort_id, student_id, session_no)
);

-- ---------------------------------------------------------------------------
-- scenario_responses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scenario_responses (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  response_text TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  UNIQUE (student_id, scenario_id)
);
CREATE INDEX IF NOT EXISTS idx_scenario_responses_student ON scenario_responses (student_id);

-- ---------------------------------------------------------------------------
-- quiz_questions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quiz_questions (
  id TEXT PRIMARY KEY,
  module_unlock INTEGER NOT NULL,
  question_type TEXT NOT NULL,
  question_text TEXT NOT NULL,
  choice_a TEXT,
  choice_b TEXT,
  choice_c TEXT,
  choice_d TEXT,
  correct_answer TEXT,
  explanation TEXT NOT NULL,
  difficulty INTEGER NOT NULL DEFAULT 1,
  track TEXT NOT NULL DEFAULT '101'
);

-- ---------------------------------------------------------------------------
-- quiz_responses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quiz_responses (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  response_text TEXT,
  selected_choice TEXT,
  is_correct BOOLEAN, -- was INTEGER 0/1, nullable
  submitted_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  UNIQUE (student_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_student ON quiz_responses (student_id);

-- ---------------------------------------------------------------------------
-- simulations
-- decisions confirmed JSON.parse'd (lib/sim-store.ts, app/actions/*.ts) -> JSONB
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS simulations (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  turn INTEGER NOT NULL DEFAULT 1,
  cap_space INTEGER NOT NULL,
  team_record TEXT NOT NULL,
  decisions JSONB NOT NULL DEFAULT '[]', -- was TEXT, JSON.parse'd
  completed BOOLEAN NOT NULL DEFAULT false, -- was INTEGER 0/1
  final_score INTEGER,
  created_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  sim_type TEXT NOT NULL DEFAULT 'westbrook'
);
CREATE INDEX IF NOT EXISTS idx_simulations_student ON simulations (student_id);
-- NOTE: SQLite has a partial unique index "idx_one_active_sim ON simulations
-- (student_id, sim_type) WHERE completed = 0" (added later in lib/db.ts).
-- Recreated here with the BOOLEAN column:
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_sim ON simulations (student_id, sim_type) WHERE completed = false;

-- ---------------------------------------------------------------------------
-- weekly_challenges
-- week_start / week_end are TEXT date bounds (YYYY-MM-DD) used in a
-- date-range comparison -> DATE.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS weekly_challenges (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  week_start DATE NOT NULL, -- was TEXT YYYY-MM-DD
  week_end DATE NOT NULL, -- was TEXT YYYY-MM-DD
  ordinal INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);
CREATE INDEX IF NOT EXISTS idx_weekly_challenges_window ON weekly_challenges (week_start, week_end);

-- ---------------------------------------------------------------------------
-- weekly_completions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS weekly_completions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  response_text TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  UNIQUE (student_id, challenge_id)
);
CREATE INDEX IF NOT EXISTS idx_weekly_completions_student ON weekly_completions (student_id);

-- ---------------------------------------------------------------------------
-- partner_orgs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  org_type TEXT NOT NULL,
  contact_name TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  custom_headline TEXT NOT NULL,
  custom_body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);
CREATE INDEX IF NOT EXISTS idx_partner_orgs_slug ON partner_orgs (slug);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false, -- was INTEGER 0/1
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, read, created_at);

-- ---------------------------------------------------------------------------
-- student_badges
-- earned_at is `TEXT NOT NULL DEFAULT (datetime('now'))` -- an ISO-8601 text
-- timestamp (SQLite datetime('now')), NOT the epoch-ms convention used
-- elsewhere in this schema. Converted to TIMESTAMPTZ DEFAULT now() since it
-- is genuinely a point-in-time value (ORDER BY earned_at DESC); flagged
-- because its storage representation differs from sibling *_at columns.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_badges (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- NOTE: was TEXT DEFAULT (datetime('now')), not epoch ms
  UNIQUE (student_id, badge_id)
);
CREATE INDEX IF NOT EXISTS idx_student_badges_student ON student_badges (student_id);

-- ---------------------------------------------------------------------------
-- player_cards
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS player_cards (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL UNIQUE,
  generated_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  position_label TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_player_cards_student ON player_cards (student_id);

-- ---------------------------------------------------------------------------
-- news_items
-- NOTE: published_date is TEXT NOT NULL DEFAULT '' and is passed straight
-- through in lib/content.ts as a display string (no date-parsing call site
-- found); left as TEXT rather than DATE since '' is not a valid DATE value
-- and the column's format is not guaranteed to be YYYY-MM-DD.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS news_items (
  id TEXT PRIMARY KEY,
  headline TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_name TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  concept_tag TEXT NOT NULL DEFAULT '',
  published_date TEXT NOT NULL DEFAULT '', -- NOTE: free-text, not guaranteed YYYY-MM-DD; see above
  active BOOLEAN NOT NULL DEFAULT true, -- was INTEGER 0/1
  created_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);
CREATE INDEX IF NOT EXISTS idx_news_items_active ON news_items (active, created_at);

-- ---------------------------------------------------------------------------
-- news_submissions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS news_submissions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  headline TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);
CREATE INDEX IF NOT EXISTS idx_news_submissions_status ON news_submissions (status, created_at);

-- ---------------------------------------------------------------------------
-- testimonials
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS testimonials (
  id TEXT PRIMARY KEY,
  quote TEXT NOT NULL,
  student_name TEXT NOT NULL,
  school_name TEXT NOT NULL DEFAULT '',
  track_completed TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true, -- was INTEGER 0/1
  ordinal INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);
CREATE INDEX IF NOT EXISTS idx_testimonials_active ON testimonials (active, ordinal);

-- ---------------------------------------------------------------------------
-- standards_alignment
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS standards_alignment (
  id TEXT PRIMARY KEY,
  ordinal INTEGER NOT NULL DEFAULT 0,
  module_name TEXT NOT NULL,
  track TEXT NOT NULL,
  key_concepts TEXT NOT NULL,
  ap_micro_standards TEXT NOT NULL,
  ap_macro_standards TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- nba_players
-- NOTE: as_of is TEXT NOT NULL DEFAULT '' holding a curation date string
-- (lib/nba.ts comment: "ISO string"), but the '' default is not a valid
-- DATE; left as TEXT.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nba_players (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  team TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  as_of TEXT NOT NULL DEFAULT '' -- NOTE: ISO-ish date string but '' default precludes DATE; see above
);

-- ---------------------------------------------------------------------------
-- nba_contracts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nba_contracts (
  player_slug TEXT PRIMARY KEY,
  team TEXT NOT NULL,
  cap_hit REAL NOT NULL,
  years_remaining INTEGER NOT NULL DEFAULT 1,
  total_remaining REAL NOT NULL DEFAULT 0,
  apron_status TEXT NOT NULL DEFAULT 'below'
);

-- ---------------------------------------------------------------------------
-- nba_player_stats
-- updated_at DEFAULT 0 is an epoch-ms sentinel; preserved as epoch(0).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nba_player_stats (
  player_slug TEXT NOT NULL,
  season TEXT NOT NULL,
  games INTEGER NOT NULL DEFAULT 0,
  minutes REAL NOT NULL DEFAULT 0,
  epm REAL,
  bpm REAL,
  source TEXT NOT NULL DEFAULT 'snapshot',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT to_timestamp(0), -- was INTEGER epoch ms DEFAULT 0
  PRIMARY KEY (player_slug, season)
);
CREATE INDEX IF NOT EXISTS idx_nba_stats_player ON nba_player_stats (player_slug, season);

-- ---------------------------------------------------------------------------
-- people
-- NOTE: user_id references users(id) but no FK is declared in the SQLite
-- source; none added here.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  updated_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);
CREATE INDEX IF NOT EXISTS idx_people_email ON people (email);
CREATE INDEX IF NOT EXISTS idx_people_user ON people (user_id);

-- ---------------------------------------------------------------------------
-- training_modules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_modules (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'training',
  required BOOLEAN NOT NULL DEFAULT true, -- was INTEGER 0/1
  content_type TEXT NOT NULL DEFAULT 'link',
  content TEXT,
  ordinal INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true, -- was INTEGER 0/1
  created_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  updated_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);

-- ---------------------------------------------------------------------------
-- training_module_completions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_module_completions (
  id TEXT PRIMARY KEY,
  instructor_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_training_completions_instructor ON training_module_completions (instructor_id);
CREATE INDEX IF NOT EXISTS idx_training_completions_module ON training_module_completions (module_id);

-- ---------------------------------------------------------------------------
-- training_module_views
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_module_views (
  instructor_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  first_viewed_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  last_viewed_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  PRIMARY KEY (instructor_id, module_id)
);

-- ---------------------------------------------------------------------------
-- training_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  timezone TEXT,
  location TEXT,
  meeting_link TEXT,
  facilitator_user_id TEXT,
  required BOOLEAN NOT NULL DEFAULT true, -- was INTEGER 0/1
  facilitator_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  updated_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);

-- ---------------------------------------------------------------------------
-- training_session_registrations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_session_registrations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  instructor_id TEXT NOT NULL,
  registered_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);
CREATE INDEX IF NOT EXISTS idx_session_regs_session ON training_session_registrations (session_id);
CREATE INDEX IF NOT EXISTS idx_session_regs_instructor ON training_session_registrations (instructor_id);

-- ---------------------------------------------------------------------------
-- training_session_attendance
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_session_attendance (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  instructor_id TEXT NOT NULL,
  attended BOOLEAN NOT NULL DEFAULT false, -- was INTEGER 0/1
  recorded_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  recorded_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_session_att_session ON training_session_attendance (session_id);
CREATE INDEX IF NOT EXISTS idx_session_att_instructor ON training_session_attendance (instructor_id);

-- ---------------------------------------------------------------------------
-- practice_evaluations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS practice_evaluations (
  id TEXT PRIMARY KEY,
  instructor_id TEXT NOT NULL,
  evaluator_user_id TEXT,
  evaluated_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  lesson_used TEXT,
  rating_curriculum_delivery INTEGER NOT NULL,
  rating_communication_engagement INTEGER NOT NULL,
  rating_preparedness_reliability INTEGER NOT NULL,
  strengths TEXT,
  concerns TEXT,
  decision TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);
CREATE INDEX IF NOT EXISTS idx_practice_evals_instructor ON practice_evaluations (instructor_id);

-- ---------------------------------------------------------------------------
-- students
-- NOTE: guardian_person_id references people(id), user_id/person_id
-- reference users(id)/people(id), but none are declared as FKs in the
-- SQLite source; none added here.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER,
  grade TEXT,
  email TEXT,
  guardian_person_id TEXT,
  emergency_notes TEXT,
  enrollment_status TEXT NOT NULL DEFAULT 'active',
  form_status TEXT NOT NULL DEFAULT 'missing',
  communication_notes TEXT,
  user_id TEXT,
  person_id TEXT,
  created_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  updated_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);
CREATE INDEX IF NOT EXISTS idx_students_guardian ON students (guardian_person_id);

-- ---------------------------------------------------------------------------
-- tasks
-- context / recommended_action are free-form TEXT fields (no JSON parsing
-- call sites found) -- left as TEXT.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  owner_user_id TEXT,
  due_at TIMESTAMPTZ, -- was INTEGER epoch ms
  due_on DATE, -- was TEXT YYYY-MM-DD
  status TEXT NOT NULL DEFAULT 'open',
  kind TEXT NOT NULL DEFAULT 'task',
  priority TEXT NOT NULL DEFAULT 'normal',
  context TEXT,
  recommended_action TEXT,
  entity_type TEXT,
  entity_id TEXT,
  handoff_to_founder BOOLEAN NOT NULL DEFAULT false, -- was INTEGER 0/1
  completed_at TIMESTAMPTZ, -- was INTEGER epoch ms
  completion_note TEXT,
  created_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  updated_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_status_due ON tasks (owner_user_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_entity ON tasks (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_status_due_on ON tasks (owner_user_id, status, due_on);

-- ---------------------------------------------------------------------------
-- locations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'school',
  region TEXT,
  city TEXT,
  state TEXT,
  address TEXT,
  timezone TEXT,
  parent_location_id TEXT,
  region_id TEXT,
  primary_leader_user_id TEXT,
  stage TEXT NOT NULL DEFAULT 'prospect',
  capacity INTEGER,
  expected_demand INTEGER,
  rationale TEXT,
  earliest_launch_date DATE, -- was TEXT YYYY-MM-DD
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  updated_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);
CREATE INDEX IF NOT EXISTS idx_locations_stage_region ON locations (stage, region);
CREATE INDEX IF NOT EXISTS idx_v2_locations_region ON locations (region_id, stage);
CREATE INDEX IF NOT EXISTS idx_v2_locations_parent ON locations (parent_location_id);

-- ---------------------------------------------------------------------------
-- programs
-- start_date / end_date / launch_date are TEXT YYYY-MM-DD -> DATE.
-- schedule_start_time / schedule_end_time are TEXT HH:MM (same pattern as
-- classes.schedule_start_time in the A-I file, per lib/operations.ts) -> TIME.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS programs (
  id TEXT PRIMARY KEY,
  request_key TEXT,
  name TEXT NOT NULL,
  partner_org_id TEXT,
  primary_contact_person_id TEXT,
  location_id TEXT,
  curriculum_id TEXT,
  audience TEXT,
  delivery_format TEXT NOT NULL DEFAULT 'in_person',
  stage TEXT NOT NULL DEFAULT 'opportunity',
  start_date DATE, -- was TEXT YYYY-MM-DD
  end_date DATE, -- was TEXT YYYY-MM-DD
  launch_date DATE, -- was TEXT YYYY-MM-DD
  schedule_label TEXT,
  schedule_day INTEGER,
  schedule_start_time TIME, -- was TEXT HH:MM
  schedule_end_time TIME, -- was TEXT HH:MM
  schedule_timezone TEXT,
  capacity INTEGER,
  minimum_enrollment INTEGER NOT NULL DEFAULT 1,
  owner_user_id TEXT,
  partner_confirmed BOOLEAN NOT NULL DEFAULT false, -- was INTEGER 0/1
  materials_status TEXT NOT NULL DEFAULT 'not_ready',
  renewal_status TEXT NOT NULL DEFAULT 'not_due',
  source_type TEXT,
  source_id TEXT,
  parent_program_id TEXT,
  outcome_summary TEXT,
  notes TEXT,
  launch_exception_reason TEXT,
  launch_exception_approved_by TEXT,
  launch_exception_approved_at TIMESTAMPTZ, -- was INTEGER epoch ms
  created_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  updated_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);
CREATE INDEX IF NOT EXISTS idx_programs_stage_launch ON programs (stage, launch_date);
CREATE INDEX IF NOT EXISTS idx_programs_owner ON programs (owner_user_id, stage);
CREATE INDEX IF NOT EXISTS idx_programs_partner ON programs (partner_org_id);
CREATE INDEX IF NOT EXISTS idx_programs_location ON programs (location_id);

-- ---------------------------------------------------------------------------
-- operating_regions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS operating_regions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  leader_user_id TEXT,
  timezone TEXT,
  stage TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  updated_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);

-- ---------------------------------------------------------------------------
-- operating_goals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS operating_goals (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  starts_on DATE NOT NULL, -- was TEXT YYYY-MM-DD
  ends_on DATE NOT NULL, -- was TEXT YYYY-MM-DD
  owner_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  result_value INTEGER,
  closed_at TIMESTAMPTZ, -- was INTEGER epoch ms
  decision_note TEXT,
  notes TEXT,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  updated_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);

-- ---------------------------------------------------------------------------
-- student_acquisition_touchpoints
-- occurred_at is the epoch-ms instant; occurred_on is the paired canonical
-- local calendar date (compare to class_sessions.session_on convention in
-- the A-I file) -> DATE.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_acquisition_touchpoints (
  id TEXT PRIMARY KEY,
  person_id TEXT,
  student_id TEXT,
  channel_id TEXT NOT NULL,
  campaign_id TEXT,
  contributor_id TEXT,
  touchpoint_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  occurred_on DATE NOT NULL, -- was TEXT YYYY-MM-DD
  timezone TEXT NOT NULL,
  external_key TEXT,
  detail TEXT,
  recorded_by_user_id TEXT,
  source_type TEXT NOT NULL DEFAULT 'operator',
  source_id TEXT,
  voided_at TIMESTAMPTZ, -- was INTEGER epoch ms
  voided_by_user_id TEXT,
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);

-- ---------------------------------------------------------------------------
-- student_acquisition_attributions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_acquisition_attributions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  touchpoint_id TEXT NOT NULL,
  method TEXT NOT NULL,
  evidence_note TEXT NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  effective_to TIMESTAMPTZ, -- was INTEGER epoch ms
  decided_by_user_id TEXT,
  decision_source TEXT NOT NULL DEFAULT 'operator',
  decision_source_id TEXT,
  created_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);

-- ---------------------------------------------------------------------------
-- student_referrals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_referrals (
  id TEXT PRIMARY KEY,
  referrer_person_id TEXT NOT NULL,
  referred_person_id TEXT NOT NULL,
  referred_student_id TEXT,
  touchpoint_id TEXT,
  campaign_id TEXT,
  contributor_id TEXT,
  referral_code TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  notes TEXT,
  created_by_user_id TEXT NOT NULL,
  voided_at TIMESTAMPTZ, -- was INTEGER epoch ms
  voided_by_user_id TEXT,
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);

-- ---------------------------------------------------------------------------
-- student_program_outcomes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_program_outcomes (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  outcome_type TEXT NOT NULL,
  occurred_on DATE NOT NULL, -- was TEXT YYYY-MM-DD
  evidence_note TEXT NOT NULL,
  recorded_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);

-- ---------------------------------------------------------------------------
-- organization_people
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organization_people (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL DEFAULT 'contact',
  is_primary BOOLEAN NOT NULL DEFAULT false, -- was INTEGER 0/1
  active BOOLEAN NOT NULL DEFAULT true, -- was INTEGER 0/1
  created_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  updated_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);

-- ---------------------------------------------------------------------------
-- organization_locations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organization_locations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL DEFAULT 'operates_at',
  active BOOLEAN NOT NULL DEFAULT true, -- was INTEGER 0/1
  created_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  updated_at TIMESTAMPTZ NOT NULL -- was INTEGER epoch ms
);

-- ---------------------------------------------------------------------------
-- operational_decisions
-- metadata confirmed JSON.parse'd (lib/db.ts, V4 migration evidence
-- reconciliation) -> JSONB.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS operational_decisions (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  decided_by_user_id TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  metadata JSONB -- was TEXT, JSON.parse'd; nullable
);
CREATE INDEX IF NOT EXISTS idx_v2_operational_decisions_entity ON operational_decisions (entity_type, entity_id, decision_type);
CREATE INDEX IF NOT EXISTS idx_v2_operational_decisions_fingerprint ON operational_decisions (fingerprint);

-- ---------------------------------------------------------------------------
-- ledger_snapshots (lib/ledger-store.ts)
-- Table is created lazily by application code (ensureTable()), not in the
-- main lib/db.ts schema block, but it is still part of the SQLite schema in
-- scope for this migration. day is the UTC-day snapshot key formatted as
-- YYYY-MM-DD (new Date(ms).toISOString().slice(0, 10)) -> DATE. payload is
-- confirmed JSON.parse'd -> JSONB.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ledger_snapshots (
  day DATE PRIMARY KEY, -- was TEXT YYYY-MM-DD
  taken_at TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms
  season TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL -- was TEXT, JSON.parse'd
);

-- ============================================================================
-- End of file. Table count in this file: 54
--   ledger_snapshots, lesson_progress, locations, migration_conflicts,
--   migration_row_archive, nba_contracts, nba_player_stats, nba_players,
--   news_items, news_submissions, notifications, operating_goals,
--   operating_regions, operational_decisions, organization_locations,
--   organization_people, organizations, partner_orgs,
--   password_reset_tokens, people, player_cards, practice_evaluations,
--   profile_sharing_consents, programs, quiz_questions, quiz_responses,
--   scenario_responses, schema_migrations, security_rate_limits,
--   self_attendance, self_feed_responses, self_modules, self_progress,
--   session_notes, sessions, simulations, standards_alignment,
--   student_acquisition_attributions, student_acquisition_touchpoints,
--   student_badges, student_program_outcomes, student_referrals, students,
--   tasks, testimonials, training_module_completions,
--   training_module_views, training_modules, training_session_attendance,
--   training_session_registrations, training_sessions, users,
--   weekly_challenges, weekly_completions
-- ============================================================================
