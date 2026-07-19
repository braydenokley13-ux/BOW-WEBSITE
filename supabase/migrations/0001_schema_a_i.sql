-- =============================================================================
-- 0001_schema_a_i.sql
--
-- Phase 1 of the SQLite -> Supabase Postgres migration for BOW-WEBSITE.
--
-- Scope: every CREATE TABLE from lib/db.ts (the app's SQLite schema, plus its
-- idempotent `migrate()` ALTER TABLE column additions and later index/trigger
-- "protection" blocks) whose table name starts with a letter A-I inclusive.
-- Tables starting J-Z (users, organizations, students, people, programs,
-- locations, tasks, training_*, operating_*, organization_*, etc.) are handled
-- by a companion migration (e.g. 0002_schema_j_z.sql) and are NOT defined
-- here. Foreign keys that point at those out-of-scope tables are called out
-- below and are NOT created as enforced constraints in this file (see
-- "Cross-file FK policy").
--
-- Tables covered (45, alphabetical):
--   activity, article_revisions, articles, attendance, attendance_records,
--   badges, certificates, class_enrollments, class_instructors,
--   class_proposals, class_session_reports, class_session_roster,
--   class_sessions, class_status_events, classes, cohorts, concept_map,
--   crm_activity, curricula, daily_questions, daily_responses,
--   daily_scenarios, demo_requests, discussion_posts, discussion_reactions,
--   discussion_replies, enrollments, feed_responses, feed_sessions,
--   feed_simulation_responses, feed_stories, feed_users, glossary_terms,
--   growth_assignments, growth_campaigns, growth_channels,
--   growth_contributors, growth_playbooks, inquiries,
--   instructor_availability, instructor_development_items,
--   instructor_feedback, instructor_qualifications, instructors, invitations
--
-- Shared conversion conventions (applied throughout this file):
--   1. TEXT primary keys stay TEXT.
--      INTEGER PRIMARY KEY AUTOINCREMENT -> BIGINT GENERATED ALWAYS AS
--      IDENTITY PRIMARY KEY.
--   2. Epoch-millisecond INTEGER timestamp columns (created_at, updated_at,
--      *_at, session_date, recorded_at, earned_at-style columns, etc.) ->
--      TIMESTAMPTZ. The SQLite source populates these with
--      `Date.now()` (JS epoch ms) in application code (not the SQLite
--      `unixepoch()*1000` idiom, since there is no server-side DEFAULT for
--      these columns in the source schema) -- flagged inline as "epoch ms"
--      wherever it applies. The data-migration phase must convert the
--      stored integer via `to_timestamp(value / 1000.0)`.
--   3. Date-only TEXT columns matching YYYY-MM-DD (verified by a SQLite
--      CHECK/trigger requiring `length() = 10 AND date(x) = x`, e.g.
--      class_sessions.session_on) -> DATE. Free-form date-ish TEXT columns
--      that are NOT validated as canonical dates in code (e.g. classes.
--      start_date/end_date, growth_campaigns.starts_on/ends_on, cohorts.
--      start/end_date/next_session) are left as TEXT with a NOTE, since nothing
--      in the source enforces the format and some are used as opaque labels.
--   4. TEXT columns read via JSON.parse / json_extract/json_valid in
--      application code -> JSONB, flagged inline.
--   5. INTEGER 0/1 flag columns -> BOOLEAN, flagged inline. Data migration
--      maps 0 -> false, 1 -> true.
--   6. NOT NULL / DEFAULT / UNIQUE / CHECK constraints are preserved;
--      `unixepoch()*1000` defaults (none found for A-I tables) would become
--      `now()`; plain literal defaults are kept as-is; `datetime('now')`
--      (student_badges.earned_at) -> `now()`.
--   7. All CREATE TABLE / CREATE INDEX statements use IF NOT EXISTS so this
--      migration is idempotent and safe to re-run.
--   8. Tables are ordered so FK dependencies within this file precede their
--      dependents.
--
-- Cross-file FK policy:
--   Several A-I tables have FKs to J-Z tables (users, organizations, people,
--   students, programs, locations, partner_orgs, training_sessions, tasks,
--   etc.). Those referenced tables do not exist yet when this file alone is
--   applied, so enforcing the FK here would break a from-scratch apply. Each
--   such column is documented with a `-- NOTE: cross-file FK ->
--   <table>(<col>), see 0002_schema_j_z.sql` comment but the constraint
--   itself is deferred to a follow-up "0003_cross_file_constraints.sql"
--   migration (not part of this file) that runs after both halves of the
--   schema exist.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- articles / article_revisions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  dek TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  kind TEXT NOT NULL DEFAULT 'article',
  author TEXT NOT NULL DEFAULT '',
  author_user_id TEXT, -- NOTE: cross-file FK -> users(id)
  category TEXT NOT NULL DEFAULT 'Trade Analysis',
  tags TEXT NOT NULL DEFAULT '', -- NOTE: comma/free-text tag list in source, not JSON-parsed anywhere found; left as TEXT
  cover_image TEXT NOT NULL DEFAULT '',
  featured BOOLEAN NOT NULL DEFAULT false, -- was INTEGER 0/1
  view_count INTEGER NOT NULL DEFAULT 0,
  meta_title TEXT NOT NULL DEFAULT '',
  meta_description TEXT NOT NULL DEFAULT '',
  published_at TIMESTAMPTZ, -- epoch ms
  created_at TIMESTAMPTZ NOT NULL, -- epoch ms
  updated_at TIMESTAMPTZ NOT NULL -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles (status, featured, published_at);

CREATE TABLE IF NOT EXISTS article_revisions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- was INTEGER PRIMARY KEY AUTOINCREMENT
  article_id TEXT NOT NULL REFERENCES articles(id),
  title TEXT NOT NULL,
  dek TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  saved_at TIMESTAMPTZ NOT NULL -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_article_revisions ON article_revisions (article_id, saved_at);

-- ---------------------------------------------------------------------------
-- badges (reference/catalog data; student_badges award table is out of
-- scope: starts with 's')
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS badges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL,
  threshold INTEGER NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 0,
  ordinal INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- cohorts / attendance / enrollments (legacy student-portal core)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cohorts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  org_id TEXT NOT NULL, -- NOTE: cross-file FK -> organizations(id)
  track TEXT NOT NULL,
  instructor_id TEXT, -- NOTE: cross-file FK -> users(id) (legacy instructor-as-user model, distinct from BOW HQ instructors table)
  current_lesson_id TEXT,
  status TEXT NOT NULL,
  format TEXT NOT NULL,
  schedule TEXT NOT NULL,
  "start" TEXT NOT NULL, -- NOTE: free-form date/label text in source, not validated as YYYY-MM-DD; left as TEXT
  end_date TEXT NOT NULL, -- NOTE: same as above
  cap INTEGER NOT NULL,
  next_session TEXT NOT NULL -- NOTE: free-form date/label text; left as TEXT
);

CREATE TABLE IF NOT EXISTS attendance (
  cohort_id TEXT NOT NULL REFERENCES cohorts(id),
  user_id TEXT NOT NULL, -- NOTE: cross-file FK -> users(id)
  state TEXT NOT NULL,
  PRIMARY KEY (cohort_id, user_id)
);

CREATE TABLE IF NOT EXISTS enrollments (
  user_id TEXT NOT NULL, -- NOTE: cross-file FK -> users(id)
  cohort_id TEXT NOT NULL REFERENCES cohorts(id),
  enroll TEXT NOT NULL,
  lesson_status TEXT NOT NULL,
  "last" TEXT NOT NULL,
  att_last TEXT NOT NULL,
  unlocked_lesson_id TEXT,
  PRIMARY KEY (user_id, cohort_id)
);

-- ---------------------------------------------------------------------------
-- certificates (legacy student-portal track certificates; distinct from the
-- Feed's feed_users.certificate_id evidence flow below)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL, -- NOTE: cross-file FK -> users(id) in this legacy table (student_id here is the legacy user id, not students.id)
  issued_at TIMESTAMPTZ NOT NULL, -- epoch ms
  track TEXT NOT NULL,
  UNIQUE (student_id, track)
);

-- ---------------------------------------------------------------------------
-- concept_map (public reference data)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS concept_map (
  id TEXT PRIMARY KEY,
  ordinal INTEGER NOT NULL DEFAULT 0,
  concept_name TEXT NOT NULL,
  track TEXT NOT NULL,
  module_name TEXT NOT NULL,
  frontoffice_application TEXT NOT NULL,
  real_example TEXT NOT NULL,
  category TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- crm_activity (polymorphic entity_type/entity_id log; no FK -- the
-- referenced entity can live in either this file or the J-Z file)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_activity (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL, -- NOTE: polymorphic reference, no FK by design (matches source)
  kind TEXT NOT NULL DEFAULT 'note',
  body TEXT,
  actor_user_id TEXT, -- NOTE: cross-file FK -> users(id)
  created_at TIMESTAMPTZ NOT NULL -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_crm_activity_entity ON crm_activity (entity_type, entity_id, created_at);

-- ---------------------------------------------------------------------------
-- curricula
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS curricula (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  age_range TEXT,
  published BOOLEAN NOT NULL DEFAULT true, -- was INTEGER 0/1
  created_at TIMESTAMPTZ NOT NULL, -- epoch ms
  updated_at TIMESTAMPTZ NOT NULL -- epoch ms
);

-- ---------------------------------------------------------------------------
-- daily_questions / daily_responses / daily_scenarios
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_questions (
  id TEXT PRIMARY KEY,
  ordinal INTEGER NOT NULL DEFAULT 0,
  question_text TEXT NOT NULL,
  choice_a TEXT NOT NULL,
  choice_b TEXT NOT NULL,
  choice_c TEXT NOT NULL,
  choice_d TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT NOT NULL,
  concept_tag TEXT NOT NULL,
  difficulty INTEGER NOT NULL DEFAULT 1,
  type TEXT NOT NULL DEFAULT 'mc',
  track TEXT NOT NULL DEFAULT '101',
  points INTEGER NOT NULL DEFAULT 10,
  active BOOLEAN NOT NULL DEFAULT true, -- was INTEGER 0/1
  active_date DATE UNIQUE -- was TEXT; used as a canonical YYYY-MM-DD "question of the day" key
);
CREATE INDEX IF NOT EXISTS idx_daily_questions_active ON daily_questions (active_date);
CREATE INDEX IF NOT EXISTS idx_daily_questions_track_diff ON daily_questions (active, track, difficulty);

CREATE TABLE IF NOT EXISTS daily_responses (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL, -- NOTE: cross-file FK -> users(id)
  question_id TEXT NOT NULL REFERENCES daily_questions(id),
  selected_choice TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL, -- was INTEGER 0/1
  responded_at TIMESTAMPTZ NOT NULL, -- epoch ms
  UNIQUE (student_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_daily_responses_student ON daily_responses (student_id);
CREATE INDEX IF NOT EXISTS idx_daily_responses_question ON daily_responses (question_id);

CREATE TABLE IF NOT EXISTS daily_scenarios (
  id TEXT PRIMARY KEY,
  ordinal INTEGER NOT NULL,
  concept TEXT NOT NULL,
  scenario TEXT NOT NULL,
  explanation TEXT NOT NULL,
  difficulty INTEGER NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- demo_requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS demo_requests (
  id TEXT PRIMARY KEY,
  org_slug TEXT NOT NULL,
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  dispositioned BOOLEAN NOT NULL DEFAULT false, -- was INTEGER 0/1
  created_at TIMESTAMPTZ NOT NULL -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_demo_requests_slug ON demo_requests (org_slug, created_at);

-- ---------------------------------------------------------------------------
-- discussion_posts / discussion_replies / discussion_reactions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS discussion_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL, -- NOTE: cross-file FK -> users(id)
  org_id TEXT NOT NULL, -- NOTE: cross-file FK -> organizations(id); nullable-by-migration in source (added via ALTER TABLE ADD COLUMN, so historically NULL was possible) but declared NOT NULL in the canonical CREATE TABLE -- kept NOT NULL here per current schema
  channel TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT false, -- was INTEGER 0/1
  created_at TIMESTAMPTZ NOT NULL, -- epoch ms
  updated_at TIMESTAMPTZ NOT NULL -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_disc_posts_channel ON discussion_posts (org_id, channel, pinned, created_at);
CREATE INDEX IF NOT EXISTS idx_disc_posts_user ON discussion_posts (user_id);

CREATE TABLE IF NOT EXISTS discussion_replies (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES discussion_posts(id),
  user_id TEXT NOT NULL, -- NOTE: cross-file FK -> users(id)
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_disc_replies_post ON discussion_replies (post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_disc_replies_user ON discussion_replies (user_id);

CREATE TABLE IF NOT EXISTS discussion_reactions (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES discussion_posts(id),
  user_id TEXT NOT NULL, -- NOTE: cross-file FK -> users(id)
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL, -- epoch ms
  UNIQUE (post_id, user_id, reaction_type)
);
CREATE INDEX IF NOT EXISTS idx_disc_reactions_post ON discussion_reactions (post_id);
CREATE INDEX IF NOT EXISTS idx_disc_reactions_user ON discussion_reactions (user_id);

-- ---------------------------------------------------------------------------
-- feed_stories / feed_users / feed_responses / feed_simulation_responses /
-- feed_sessions (public "Feed" preview funnel)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feed_stories (
  id TEXT PRIMARY KEY,
  ordinal INTEGER NOT NULL,
  headline TEXT NOT NULL,
  framing TEXT NOT NULL,
  prompt TEXT NOT NULL,
  concept TEXT NOT NULL,
  outcome TEXT NOT NULL,
  explanation TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feed_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL, -- epoch ms
  decisions_completed INTEGER NOT NULL DEFAULT 0, -- count, not a boolean flag
  sim_completed BOOLEAN NOT NULL DEFAULT false, -- was INTEGER 0/1
  certificate_id TEXT,
  sim_completed_at TIMESTAMPTZ, -- epoch ms
  certificate_evidence_version INTEGER -- multi-valued version marker (-1/0/1/2...), not boolean
);
-- Partial unique index: certificate_id is unique only when present (see
-- lib/db.ts ux_feed_users_certificate_id, WHERE certificate_id IS NOT NULL).
CREATE UNIQUE INDEX IF NOT EXISTS ux_feed_users_certificate_id
  ON feed_users (certificate_id) WHERE certificate_id IS NOT NULL;
-- NOTE: source also has `trg_feed_certificate_immutable`, a trigger that
-- blocks changing certificate_id/certificate_evidence_version once set.
-- Recreate as a Postgres trigger function in a follow-up migration if that
-- invariant still needs DB-level enforcement (judgment call: left out of
-- this DDL-only pass).

CREATE TABLE IF NOT EXISTS feed_responses (
  id TEXT PRIMARY KEY,
  feed_user_id TEXT NOT NULL REFERENCES feed_users(id),
  story_id TEXT NOT NULL REFERENCES feed_stories(id),
  response TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL, -- epoch ms
  UNIQUE (feed_user_id, story_id)
);

CREATE TABLE IF NOT EXISTS feed_simulation_responses (
  feed_user_id TEXT NOT NULL REFERENCES feed_users(id) ON DELETE CASCADE,
  simulation_key TEXT NOT NULL,
  evidence_version INTEGER NOT NULL,
  step_index INTEGER NOT NULL,
  choice_id TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL, -- epoch ms
  PRIMARY KEY (feed_user_id, simulation_key, evidence_version, step_index)
);
CREATE INDEX IF NOT EXISTS idx_feed_simulation_responses_user
  ON feed_simulation_responses (feed_user_id, simulation_key, evidence_version, step_index);

CREATE TABLE IF NOT EXISTS feed_sessions (
  token TEXT PRIMARY KEY,
  feed_user_id TEXT NOT NULL REFERENCES feed_users(id),
  expires_at TIMESTAMPTZ NOT NULL -- epoch ms
);

-- ---------------------------------------------------------------------------
-- glossary_terms (public reference data)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS glossary_terms (
  id TEXT PRIMARY KEY,
  ordinal INTEGER NOT NULL DEFAULT 0,
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  module_name TEXT NOT NULL,
  track TEXT NOT NULL,
  real_world_example TEXT NOT NULL,
  category TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_glossary_terms_term ON glossary_terms (term);

-- ---------------------------------------------------------------------------
-- growth_channels / growth_campaigns / growth_contributors /
-- growth_assignments / growth_playbooks (BOW Operating System V7 growth
-- network; growth_contributors.person_id and various *_user_id/region_id/
-- location_id columns point at J-Z tables)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS growth_channels (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL, -- epoch ms
  updated_at TIMESTAMPTZ NOT NULL -- epoch ms
);

CREATE TABLE IF NOT EXISTS growth_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  channel_id TEXT NOT NULL REFERENCES growth_channels(id),
  owner_user_id TEXT, -- NOTE: cross-file FK -> users(id)
  region_id TEXT, -- NOTE: cross-file FK -> operating_regions(id)
  location_id TEXT, -- NOTE: cross-file FK -> locations(id)
  hypothesis TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  starts_on TEXT NOT NULL, -- NOTE: not validated as canonical date by a CHECK/trigger in source; left as TEXT rather than DATE
  ends_on TEXT NOT NULL, -- NOTE: same as above
  target_metric TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  budget_cents INTEGER NOT NULL DEFAULT 0,
  spend_cents INTEGER NOT NULL DEFAULT 0,
  result_value INTEGER,
  decision TEXT,
  learning TEXT,
  created_by_user_id TEXT NOT NULL, -- NOTE: cross-file FK -> users(id)
  created_at TIMESTAMPTZ NOT NULL, -- epoch ms
  updated_at TIMESTAMPTZ NOT NULL -- epoch ms
);

CREATE TABLE IF NOT EXISTS growth_contributors (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL, -- NOTE: cross-file FK -> people(id)
  status TEXT NOT NULL DEFAULT 'candidate',
  source_channel_id TEXT REFERENCES growth_channels(id),
  joined_on TEXT, -- NOTE: not validated as canonical date in source; left as TEXT
  exited_on TEXT, -- NOTE: same as above
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL, -- epoch ms
  updated_at TIMESTAMPTZ NOT NULL -- epoch ms
);

CREATE TABLE IF NOT EXISTS growth_assignments (
  id TEXT PRIMARY KEY,
  contributor_id TEXT NOT NULL REFERENCES growth_contributors(id),
  role TEXT NOT NULL,
  manager_assignment_id TEXT REFERENCES growth_assignments(id),
  region_id TEXT, -- NOTE: cross-file FK -> operating_regions(id)
  location_id TEXT, -- NOTE: cross-file FK -> locations(id)
  starts_on TEXT NOT NULL, -- NOTE: not validated as canonical date; left as TEXT
  ends_on TEXT, -- NOTE: same as above
  status TEXT NOT NULL DEFAULT 'active',
  closed_by_user_id TEXT, -- NOTE: cross-file FK -> users(id)
  closure_reason TEXT,
  decision_reason TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL, -- NOTE: cross-file FK -> users(id)
  created_at TIMESTAMPTZ NOT NULL, -- epoch ms
  updated_at TIMESTAMPTZ NOT NULL -- epoch ms
);

CREATE TABLE IF NOT EXISTS growth_playbooks (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  source_campaign_id TEXT NOT NULL REFERENCES growth_campaigns(id),
  owner_user_id TEXT NOT NULL, -- NOTE: cross-file FK -> users(id)
  problem TEXT NOT NULL,
  play TEXT NOT NULL,
  evidence TEXT NOT NULL,
  adoption_notes TEXT,
  published_at TIMESTAMPTZ, -- epoch ms
  created_at TIMESTAMPTZ NOT NULL, -- epoch ms
  updated_at TIMESTAMPTZ NOT NULL -- epoch ms
);

-- ---------------------------------------------------------------------------
-- inquiries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
  organization_id TEXT, -- NOTE: cross-file FK -> organizations(id)
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  type TEXT NOT NULL,
  org_name TEXT NOT NULL,
  "date" TEXT NOT NULL, -- NOTE: not validated as canonical date in source; left as TEXT
  status TEXT NOT NULL,
  summary TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inquiries_organization ON inquiries (organization_id);

-- ---------------------------------------------------------------------------
-- instructors / instructor_availability / instructor_qualifications /
-- instructor_feedback / instructor_development_items (BOW HQ people/hiring
-- data layer)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS instructors (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL, -- NOTE: cross-file FK -> people(id)
  stage TEXT NOT NULL DEFAULT 'applied',
  source TEXT,
  owner_user_id TEXT, -- NOTE: cross-file FK -> users(id)
  answers JSONB NOT NULL DEFAULT '{}', -- was TEXT; read via JSON.parse(instructor.answers) in app/app/instructors/[id]/page.tsx
  interview_at TIMESTAMPTZ, -- epoch ms
  interview_timezone TEXT,
  interview_notes TEXT,
  founder_decision TEXT,
  decided_by TEXT, -- NOTE: cross-file FK -> users(id)
  decided_at TIMESTAMPTZ, -- epoch ms
  onboarding_status TEXT NOT NULL DEFAULT 'not_started',
  training_status TEXT NOT NULL DEFAULT 'not_started',
  eligibility_status TEXT NOT NULL DEFAULT 'not_eligible',
  progression_level TEXT NOT NULL DEFAULT 'instructor',
  development_focus TEXT,
  max_weekly_classes INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL, -- epoch ms
  updated_at TIMESTAMPTZ NOT NULL -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_instructors_person ON instructors (person_id);
CREATE INDEX IF NOT EXISTS idx_instructors_stage ON instructors (stage);
-- Partial unique index: at most one "current" (non-rejected/inactive)
-- instructor row per person (lib/db.ts ux_v5_instructors_current_person).
CREATE UNIQUE INDEX IF NOT EXISTS ux_v5_instructors_current_person
  ON instructors (person_id)
  WHERE person_id IS NOT NULL AND stage NOT IN ('rejected', 'inactive');

CREATE TABLE IF NOT EXISTS instructor_availability (
  id TEXT PRIMARY KEY,
  instructor_id TEXT NOT NULL REFERENCES instructors(id),
  day_of_week INTEGER NOT NULL,
  start_time TIME NOT NULL, -- was TEXT; HH:MM time-of-day
  end_time TIME NOT NULL, -- was TEXT; HH:MM time-of-day
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_instructor_availability_instructor ON instructor_availability (instructor_id);

CREATE TABLE IF NOT EXISTS instructor_qualifications (
  id TEXT PRIMARY KEY,
  instructor_id TEXT NOT NULL REFERENCES instructors(id),
  kind TEXT NOT NULL,
  value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved',
  approved_by TEXT, -- NOTE: cross-file FK -> users(id)
  approved_at TIMESTAMPTZ, -- epoch ms
  expires_at TIMESTAMPTZ, -- epoch ms (legacy column, superseded by expires_on)
  expires_on DATE, -- was TEXT; canonical replacement for expires_at, used with date comparisons
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL, -- epoch ms
  updated_at TIMESTAMPTZ NOT NULL, -- epoch ms
  UNIQUE (instructor_id, kind, value)
);
CREATE INDEX IF NOT EXISTS idx_instructor_qualifications_lookup ON instructor_qualifications (instructor_id, kind, value, status);
CREATE INDEX IF NOT EXISTS idx_instructor_qualifications_expires_on ON instructor_qualifications (instructor_id, status, expires_on);

CREATE TABLE IF NOT EXISTS instructor_feedback (
  id TEXT PRIMARY KEY,
  instructor_id TEXT NOT NULL REFERENCES instructors(id),
  source_type TEXT NOT NULL,
  submitted_by_user_id TEXT, -- NOTE: cross-file FK -> users(id)
  author_name TEXT,
  class_id TEXT, -- NOTE: FK -> classes(id), defined later in this same file; left unenforced here since instructor_feedback is created before classes (see "Cross-file FK policy"; add via ALTER TABLE if desired)
  program_id TEXT, -- NOTE: cross-file FK -> programs(id)
  partner_org_id TEXT, -- NOTE: cross-file FK -> partner_orgs(id)
  session_id TEXT, -- NOTE: FK -> class_sessions(id), defined later in this file
  visibility TEXT NOT NULL DEFAULT 'leadership',
  curriculum_delivery INTEGER, -- NOTE: rating scale value (e.g. 1-5), not boolean
  student_family_relationships INTEGER, -- NOTE: rating scale value, not boolean
  organization_reliability INTEGER, -- NOTE: rating scale value, not boolean
  leadership_contribution INTEGER, -- NOTE: rating scale value, not boolean
  strengths TEXT,
  concerns TEXT,
  body TEXT,
  follow_up_required BOOLEAN NOT NULL DEFAULT false, -- was INTEGER 0/1
  created_at TIMESTAMPTZ NOT NULL -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_instructor_feedback_instructor ON instructor_feedback (instructor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_instructor_feedback_program ON instructor_feedback (program_id, created_at);

CREATE TABLE IF NOT EXISTS instructor_development_items (
  id TEXT PRIMARY KEY,
  instructor_id TEXT NOT NULL REFERENCES instructors(id),
  kind TEXT NOT NULL DEFAULT 'goal',
  title TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'concern_identified',
  owner_user_id TEXT, -- NOTE: cross-file FK -> users(id)
  due_at TIMESTAMPTZ, -- epoch ms (legacy column, superseded by due_on)
  due_on DATE, -- was TEXT; canonical replacement for due_at
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  related_feedback_id TEXT REFERENCES instructor_feedback(id),
  created_at TIMESTAMPTZ NOT NULL, -- epoch ms
  updated_at TIMESTAMPTZ NOT NULL, -- epoch ms
  resolved_at TIMESTAMPTZ -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_instructor_development_open ON instructor_development_items (instructor_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_instructor_development_due_on ON instructor_development_items (instructor_id, status, due_on);

-- ---------------------------------------------------------------------------
-- invitations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  org_id TEXT NOT NULL, -- NOTE: cross-file FK -> organizations(id)
  cohort_id TEXT REFERENCES cohorts(id),
  created TEXT NOT NULL, -- NOTE: legacy free-form text creation marker, distinct from expires_at; not validated as a date in source, left as TEXT
  expires TEXT NOT NULL, -- NOTE: legacy free-form text expiry, superseded by expires_at; left as TEXT
  status TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  token_hash TEXT UNIQUE,
  expires_at TIMESTAMPTZ -- epoch ms; canonical replacement for the legacy `expires` text column
);
-- Partial unique indexes from lib/db.ts (ux_v2_invitations_token_hash /
-- ux_v2_invitations_pending_email): token_hash unique only when present, and
-- at most one pending invite per normalized email.
CREATE UNIQUE INDEX IF NOT EXISTS ux_v2_invitations_token_hash
  ON invitations (token_hash) WHERE token_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_v2_invitations_pending_email
  ON invitations (lower(trim(email))) WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- classes / class_instructors / class_sessions / class_session_roster /
-- class_session_reports / class_enrollments / class_status_events /
-- class_proposals (BOW HQ class delivery layer)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  curriculum_id TEXT NOT NULL REFERENCES curricula(id),
  partner_org_id TEXT, -- NOTE: cross-file FK -> partner_orgs(id)
  location TEXT,
  online_format TEXT,
  start_date TEXT, -- NOTE: not validated as canonical date in source; left as TEXT
  end_date TEXT, -- NOTE: same as above
  recurrence TEXT,
  schedule_day INTEGER,
  schedule_start_time TIME, -- was TEXT; HH:MM
  schedule_end_time TIME, -- was TEXT; HH:MM
  schedule_timezone TEXT,
  age_range TEXT,
  capacity INTEGER,
  minimum_enrollment INTEGER NOT NULL DEFAULT 1,
  lead_instructor_id TEXT REFERENCES instructors(id),
  program_id TEXT, -- NOTE: cross-file FK -> programs(id)
  location_id TEXT, -- NOTE: cross-file FK -> locations(id)
  status TEXT NOT NULL DEFAULT 'planning',
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL, -- epoch ms
  updated_at TIMESTAMPTZ NOT NULL -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_classes_status ON classes (status);
CREATE INDEX IF NOT EXISTS idx_classes_curriculum ON classes (curriculum_id);
CREATE INDEX IF NOT EXISTS idx_classes_lead_instructor ON classes (lead_instructor_id);
CREATE INDEX IF NOT EXISTS idx_classes_program ON classes (program_id);
CREATE INDEX IF NOT EXISTS idx_classes_location ON classes (location_id);

CREATE TABLE IF NOT EXISTS class_instructors (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id),
  instructor_id TEXT NOT NULL REFERENCES instructors(id),
  role TEXT NOT NULL DEFAULT 'additional',
  decision_reason TEXT,
  assigned_by TEXT, -- NOTE: cross-file FK -> users(id)
  decision_id TEXT, -- NOTE: cross-file FK -> operational_decisions(id)
  decision_fingerprint TEXT,
  decision_at TIMESTAMPTZ, -- epoch ms
  added_at TIMESTAMPTZ NOT NULL, -- epoch ms
  removed_at TIMESTAMPTZ, -- epoch ms
  removal_reason TEXT,
  removed_by TEXT, -- NOTE: cross-file FK -> users(id)
  removal_decision_id TEXT, -- NOTE: cross-file FK -> operational_decisions(id)
  removal_decision_fingerprint TEXT
);
CREATE INDEX IF NOT EXISTS idx_class_instructors_class ON class_instructors (class_id);
CREATE INDEX IF NOT EXISTS idx_class_instructors_instructor ON class_instructors (instructor_id);
-- Staffing-lifecycle protections from lib/db.ts
-- installStaffingLifecycleDatabaseProtections(): only one "current" (not yet
-- removed) row per (class, instructor), and only one current lead per class.
CREATE UNIQUE INDEX IF NOT EXISTS ux_v4_class_instructors_current_pair
  ON class_instructors (class_id, instructor_id) WHERE removed_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_v4_class_instructors_current_lead
  ON class_instructors (class_id) WHERE role = 'lead' AND removed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_v4_class_instructors_history
  ON class_instructors (class_id, instructor_id, added_at, removed_at);
-- NOTE: source also installs triggers (trg_v4_class_instructors_valid_insert
-- / _valid_update / _identity_immutable) enforcing staffing invariants at
-- the DB layer. Left as a follow-up if DB-level trigger enforcement is still
-- wanted in Postgres (judgment call: out of scope for this DDL-only pass).

CREATE TABLE IF NOT EXISTS class_sessions (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id),
  session_date TIMESTAMPTZ NOT NULL, -- was INTEGER epoch ms; the precise scheduled instant
  session_on DATE, -- was TEXT; canonical local calendar date (YYYY-MM-DD), enforced by a source CHECK trigger (length=10, date(x)=x)
  timezone TEXT,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_class_sessions_class_date ON class_sessions (class_id, session_date);
CREATE UNIQUE INDEX IF NOT EXISTS ux_v2_class_sessions_occurrence
  ON class_sessions (class_id, session_date);
CREATE INDEX IF NOT EXISTS idx_v9_class_sessions_calendar
  ON class_sessions (session_on, class_id);
-- NOTE: source enforces `session_on` canonical-date shape and immutability
-- via triggers (trg_v9_class_session_calendar_insert / _update). Recreate as
-- a CHECK constraint / Postgres trigger in a follow-up if still needed --
-- DATE typing here already prevents malformed values, so the shape check is
-- largely redundant post-migration; the immutability rule is not.

CREATE TABLE IF NOT EXISTS class_session_roster (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES class_sessions(id),
  student_id TEXT NOT NULL, -- NOTE: cross-file FK -> students(id)
  enrollment_id TEXT, -- NOTE: FK -> class_enrollments(id), defined later in this file
  rostered_at TIMESTAMPTZ NOT NULL -- epoch ms
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_v2_class_session_roster_pair
  ON class_session_roster (session_id, student_id);

CREATE TABLE IF NOT EXISTS class_session_reports (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES class_sessions(id),
  notes TEXT,
  flagged BOOLEAN NOT NULL DEFAULT false, -- was INTEGER 0/1
  flag_reason TEXT,
  completed BOOLEAN NOT NULL DEFAULT false, -- was INTEGER 0/1
  reported_by TEXT, -- NOTE: cross-file FK -> users(id)
  reported_at TIMESTAMPTZ NOT NULL, -- epoch ms
  lesson_id TEXT,
  lesson_snapshot JSONB -- was TEXT; validated with json_valid() and paired with lesson_id in source triggers (both-null or both-set + valid JSON)
);
CREATE INDEX IF NOT EXISTS idx_class_session_reports_session ON class_session_reports (session_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_v2_class_session_reports_session
  ON class_session_reports (session_id);
-- NOTE: source triggers enforce "lesson_id and lesson_snapshot are both
-- null or both set, and lesson_snapshot is valid JSON" on insert/update.
-- With lesson_snapshot as JSONB, Postgres already guarantees JSON validity;
-- the both-null-or-both-set pairing would need a CHECK constraint or
-- trigger to fully match source behavior -- flagged as a follow-up.

CREATE TABLE IF NOT EXISTS class_enrollments (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id),
  student_id TEXT NOT NULL, -- NOTE: cross-file FK -> students(id)
  status TEXT NOT NULL DEFAULT 'enrolled',
  enrolled_at TIMESTAMPTZ NOT NULL, -- epoch ms
  confirmed_at TIMESTAMPTZ, -- epoch ms
  confirmation_source TEXT,
  withdrawn_at TIMESTAMPTZ, -- epoch ms
  withdrawal_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_class ON class_enrollments (class_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_student ON class_enrollments (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_v2_class_enrollments_pair
  ON class_enrollments (class_id, student_id);

CREATE TABLE IF NOT EXISTS class_status_events (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id),
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  reason TEXT,
  actor_user_id TEXT NOT NULL, -- NOTE: cross-file FK -> users(id)
  source TEXT NOT NULL DEFAULT 'class_action',
  created_at TIMESTAMPTZ NOT NULL -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_v2_class_status_events_timeline
  ON class_status_events (class_id, created_at, id);

CREATE TABLE IF NOT EXISTS class_proposals (
  id TEXT PRIMARY KEY,
  instructor_id TEXT NOT NULL REFERENCES instructors(id),
  title TEXT NOT NULL,
  age_group TEXT,
  curriculum_topic TEXT,
  format TEXT,
  schedule TEXT,
  description TEXT,
  resources TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  converted_class_id TEXT REFERENCES classes(id),
  created_at TIMESTAMPTZ NOT NULL, -- epoch ms
  updated_at TIMESTAMPTZ NOT NULL -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_class_proposals_instructor_status ON class_proposals (instructor_id, status);

-- ---------------------------------------------------------------------------
-- attendance_records (BOW HQ per-session attendance; distinct from the
-- legacy `attendance` table above)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES class_sessions(id),
  student_id TEXT NOT NULL, -- NOTE: cross-file FK -> students(id)
  present BOOLEAN NOT NULL DEFAULT false, -- was INTEGER 0/1
  status TEXT,
  note TEXT,
  recorded_by TEXT, -- NOTE: cross-file FK -> users(id)
  recorded_at TIMESTAMPTZ NOT NULL -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_attendance_records_session ON attendance_records (session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student ON attendance_records (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_v2_attendance_records_pair
  ON attendance_records (session_id, student_id);

-- ---------------------------------------------------------------------------
-- activity (small public activity-feed reference table)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  icon TEXT NOT NULL,
  text TEXT NOT NULL,
  when_label TEXT NOT NULL,
  role TEXT NOT NULL
);
