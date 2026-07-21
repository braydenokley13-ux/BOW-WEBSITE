-- ============================================================
-- dev-bootstrap.sql — minimal legacy schema for LOCAL dev only.
--
-- The production schema lives hand-created in Supabase; this repo has no
-- DDL for it (see docs/learn/stage0-audit.md). This script recreates just
-- enough of it (users/sessions/organizations/cohorts/enrollments/badges/
-- student_badges/notifications/lesson_progress/attendance/session_notes/
-- inquiries/activity/testimonials/news_items/security_rate_limits) so
-- `npm run migrate` and the app's auth/dashboard/admin-learn paths work
-- against a fresh local Postgres. NOT used in production. Ids are
-- app-generated text; timestamps are bigint epoch-ms; booleans are stored
-- as integer 0/1 and compared with literal 0/1 throughout app/actions/*.ts
-- (never real `boolean`) — matching lib/db.ts conventions.
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'BOW',
  location text,
  status text NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  name text NOT NULL,
  first text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'student',
  org_id text NOT NULL REFERENCES organizations(id),
  grade text,
  status text NOT NULL DEFAULT 'active',
  last text NOT NULL DEFAULT 'Just now',
  signin text NOT NULL DEFAULT 'Email + password',
  password_hash text,
  last_active_at bigint,
  created_at bigint,
  onboarding_completed integer NOT NULL DEFAULT 0,
  password_change_required integer NOT NULL DEFAULT 0,
  deletion_requested integer NOT NULL DEFAULT 0,
  xp integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_active_date text
);

CREATE TABLE IF NOT EXISTS sessions (
  token text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS cohorts (
  id text PRIMARY KEY,
  name text NOT NULL,
  org_id text NOT NULL REFERENCES organizations(id),
  track text,
  instructor_id text REFERENCES users(id),
  current_lesson_id text,
  status text NOT NULL DEFAULT 'draft',
  format text,
  schedule text,
  start text,
  end_date text,
  cap integer NOT NULL DEFAULT 20,
  next_session text
);

CREATE TABLE IF NOT EXISTS enrollments (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cohort_id text NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  enroll text NOT NULL DEFAULT 'active',
  lesson_status text NOT NULL DEFAULT 'not-started',
  last text,
  att_last text,
  unlocked_lesson_id text,
  PRIMARY KEY (user_id, cohort_id)
);

CREATE TABLE IF NOT EXISTS invitations (
  id text PRIMARY KEY,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'student',
  org_id text REFERENCES organizations(id),
  cohort_id text REFERENCES cohorts(id),
  status text NOT NULL DEFAULT 'pending',
  created text,
  created_at bigint
);

CREATE TABLE IF NOT EXISTS badges (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  icon text,
  category text,
  threshold integer NOT NULL DEFAULT 0,
  xp_reward integer NOT NULL DEFAULT 0,
  ordinal integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'system',
  rule jsonb
);

CREATE TABLE IF NOT EXISTS student_badges (
  student_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id text NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at bigint,
  PRIMARY KEY (student_id, badge_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text,
  title text,
  body text,
  read integer NOT NULL DEFAULT 0,
  link text,
  created_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id text NOT NULL,
  status text NOT NULL DEFAULT 'not-started',
  simulation_done integer NOT NULL DEFAULT 0,
  reflection text,
  challenge_done integer NOT NULL DEFAULT 0,
  podcast_progress double precision NOT NULL DEFAULT 0,
  started_at text,
  completed_at text,
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS attendance (
  cohort_id text NOT NULL,
  user_id text NOT NULL,
  state text NOT NULL DEFAULT 'unknown',
  PRIMARY KEY (cohort_id, user_id)
);

CREATE TABLE IF NOT EXISTS session_notes (
  id text PRIMARY KEY,
  cohort_id text,
  author_id text REFERENCES users(id),
  scope text,
  text text,
  created_ts bigint
);

CREATE TABLE IF NOT EXISTS inquiries (
  id text PRIMARY KEY,
  name text,
  email text,
  message text,
  status text NOT NULL DEFAULT 'new',
  created_at bigint
);

CREATE TABLE IF NOT EXISTS activity (
  id text PRIMARY KEY,
  user_id text,
  type text,
  detail text,
  created_at bigint
);

CREATE TABLE IF NOT EXISTS testimonials (
  id text PRIMARY KEY,
  name text, role text, quote text, active integer NOT NULL DEFAULT 1,
  ordinal integer NOT NULL DEFAULT 0, created_at bigint
);

CREATE TABLE IF NOT EXISTS news_items (
  id text PRIMARY KEY, title text, body text, active integer NOT NULL DEFAULT 1,
  ordinal integer NOT NULL DEFAULT 0, created_at bigint
);

CREATE TABLE IF NOT EXISTS security_rate_limits (
  key text PRIMARY KEY,
  window_started_at bigint NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  blocked_until bigint NOT NULL DEFAULT 0,
  updated_at bigint NOT NULL
);

-- Stubs for the hiring/growth dashboard widgets that the shared /app admin
-- layout queries on every page load (lib/hiring.ts). Empty is fine — we only
-- need the query to succeed instead of leaking an aborted transaction (see
-- docs/learn/stage4-proof.md "connection pool exhaustion" finding).
CREATE TABLE IF NOT EXISTS people (
  id text PRIMARY KEY, name text, email text, phone text, user_id text,
  created_at bigint, updated_at bigint
);

CREATE TABLE IF NOT EXISTS instructors (
  id text PRIMARY KEY, person_id text REFERENCES people(id), stage text NOT NULL DEFAULT 'applied',
  source text, owner_user_id text, answers text, interview_at bigint, interview_time_zone text,
  interview_notes text, founder_decision text, decided_by text, decided_at bigint,
  onboarding_status text, training_status text, eligibility_status text,
  created_at bigint, updated_at bigint
);

-- Stub for lib/concept-map.ts (falls back to its in-code seed bank when this
-- table is empty; `npm run build` prerenders /concept-map and /demo, which
-- need the table to at least exist locally).
CREATE TABLE IF NOT EXISTS concept_map (
  id text PRIMARY KEY, ordinal integer NOT NULL DEFAULT 0, concept_name text, track text,
  module_name text, frontoffice_application text, real_example text, category text
);

-- Seed orgs -----------------------------------------------------------------
INSERT INTO organizations (id, name, type, location, status)
VALUES ('org-bow', 'BOW Self-Paced', 'BOW', 'Online', 'active')
ON CONFLICT (id) DO NOTHING;
