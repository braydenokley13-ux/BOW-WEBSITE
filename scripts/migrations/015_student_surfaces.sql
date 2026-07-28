-- ============================================================
-- 015_student_surfaces.sql — canonical DDL for the student-facing
-- surfaces (self-paced curriculum, daily question, discussion board,
-- simulations, the Daily Feed, badges/player-card, and the analytics
-- publication) that had no committed schema.
--
-- WHY: these tables were never captured in a migration, so a fresh
-- database 500s on /card and /profile with `relation "quiz_responses"
-- does not exist` and similar. This file closes that gap.
--
-- Every statement is CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT
-- EXISTS, so applying this to a database that already has some or all
-- of these tables (e.g. production) is a no-op.
--
-- Conventions match scripts/migrations/000_operations_core.sql: ids
-- are app-generated `text` primary keys, timestamps are `bigint`
-- epoch-milliseconds, booleans are `integer` 0/1, enum-ish columns are
-- `text`. No foreign keys between these tables — seed/backfill order
-- stays unconstrained, matching the SQLite-era app code.
-- ============================================================


-- self_modules: used by lib/self-paced.ts:getSelfModules
CREATE TABLE IF NOT EXISTS self_modules (
  id text PRIMARY KEY,
  ordinal integer NOT NULL,
  title text,
  summary text,
  concept text,
  central_question text,
  track text
);

-- self_progress: used by lib/self-paced.ts, lib/scoring.ts, app/actions/lms.ts
-- ON CONFLICT(student_id, module_id) in app/actions/lms.ts requires the unique pair.
CREATE TABLE IF NOT EXISTS self_progress (
  student_id text NOT NULL,
  module_id text NOT NULL,
  completed integer NOT NULL DEFAULT 0,
  reflection text,
  reflection_words integer,
  instructor_unlocked integer NOT NULL DEFAULT 0,
  completed_at bigint,
  updated_at bigint,
  track text,
  PRIMARY KEY (student_id, module_id)
);

-- self_attendance: used by lib/self-paced.ts, app/actions/lms.ts
-- ON CONFLICT(cohort_id, student_id, session_no).
CREATE TABLE IF NOT EXISTS self_attendance (
  cohort_id text NOT NULL,
  student_id text NOT NULL,
  session_no integer NOT NULL,
  present integer NOT NULL DEFAULT 0,
  PRIMARY KEY (cohort_id, student_id, session_no)
);

-- self_feed_responses: used by lib/self-paced.ts:getStudentFeedResponses, app/actions/lms.ts
CREATE TABLE IF NOT EXISTS self_feed_responses (
  id text PRIMARY KEY,
  student_id text,
  story_id text,
  response text,
  created_at bigint
);

-- daily_scenarios: used by lib/self-paced.ts:getDailyScenarios
CREATE TABLE IF NOT EXISTS daily_scenarios (
  id text PRIMARY KEY,
  ordinal integer NOT NULL,
  concept text,
  scenario text,
  explanation text,
  difficulty integer
);

-- scenario_responses: used by lib/self-paced.ts, lib/scoring.ts, app/actions/lms.ts
CREATE TABLE IF NOT EXISTS scenario_responses (
  id text PRIMARY KEY,
  student_id text,
  scenario_id text,
  response_text text,
  submitted_at bigint
);

-- quiz_questions: used by lib/self-paced.ts:getQuizQuestions, app/actions/content.ts
CREATE TABLE IF NOT EXISTS quiz_questions (
  id text PRIMARY KEY,
  module_unlock integer,
  question_type text,
  question_text text,
  choice_a text,
  choice_b text,
  choice_c text,
  choice_d text,
  correct_answer text,
  explanation text,
  difficulty integer,
  track text
);

-- quiz_responses: used by lib/self-paced.ts, lib/scoring.ts, app/actions/lms.ts
CREATE TABLE IF NOT EXISTS quiz_responses (
  id text PRIMARY KEY,
  student_id text,
  question_id text,
  response_text text,
  selected_choice text,
  is_correct integer,
  submitted_at bigint
);

-- daily_questions: used by lib/daily-question.ts, lib/content.ts, app/actions/content.ts
CREATE TABLE IF NOT EXISTS daily_questions (
  id text PRIMARY KEY,
  ordinal integer NOT NULL,
  question_text text,
  type text,
  choice_a text,
  choice_b text,
  choice_c text,
  choice_d text,
  correct_answer text,
  explanation text,
  concept_tag text,
  difficulty integer,
  track text,
  points integer,
  active integer NOT NULL DEFAULT 1,
  active_date text
);

-- daily_responses: used by lib/daily-question.ts, lib/scoring.ts, lib/badges.ts, app/actions/lms.ts
CREATE TABLE IF NOT EXISTS daily_responses (
  id text PRIMARY KEY,
  student_id text,
  question_id text,
  selected_choice text,
  is_correct integer,
  responded_at bigint
);

-- weekly_challenges: used by lib/weekly.ts
CREATE TABLE IF NOT EXISTS weekly_challenges (
  id text PRIMARY KEY,
  title text,
  prompt text,
  week_start text,
  week_end text,
  ordinal integer
);

-- weekly_completions: used by lib/weekly.ts, lib/scoring.ts, app/actions/weekly.ts
CREATE TABLE IF NOT EXISTS weekly_completions (
  id text PRIMARY KEY,
  student_id text,
  challenge_id text,
  response_text text,
  submitted_at bigint
);

-- discussion_posts: used by lib/discussion.ts, lib/scoring.ts, app/actions/discussion.ts
CREATE TABLE IF NOT EXISTS discussion_posts (
  id text PRIMARY KEY,
  user_id text,
  org_id text,
  channel text,
  title text,
  body text,
  pinned integer NOT NULL DEFAULT 0,
  created_at bigint,
  updated_at bigint
);

-- discussion_replies: used by lib/discussion.ts, app/actions/discussion.ts
CREATE TABLE IF NOT EXISTS discussion_replies (
  id text PRIMARY KEY,
  post_id text,
  user_id text,
  body text,
  created_at bigint
);

-- discussion_reactions: used by lib/discussion.ts, app/actions/discussion.ts
CREATE TABLE IF NOT EXISTS discussion_reactions (
  id text PRIMARY KEY,
  post_id text,
  user_id text,
  reaction_type text,
  created_at bigint
);

-- simulations: used by lib/sim-store.ts, lib/scoring.ts, app/actions/simulation.ts, app/actions/eastfield.ts
CREATE TABLE IF NOT EXISTS simulations (
  id text PRIMARY KEY,
  student_id text,
  turn integer,
  cap_space bigint,
  team_record text,
  decisions text,
  completed integer NOT NULL DEFAULT 0,
  final_score integer,
  created_at bigint,
  sim_type text
);

-- player_cards: used by lib/player-card.ts (Feature 4). ON CONFLICT(student_id).
CREATE TABLE IF NOT EXISTS player_cards (
  id text PRIMARY KEY,
  student_id text NOT NULL UNIQUE,
  generated_at bigint,
  position_label text
);

-- feed_users: used by lib/feed.ts (BOW Daily Feed, no-login preview experience)
CREATE TABLE IF NOT EXISTS feed_users (
  id text PRIMARY KEY,
  email text,
  display_name text,
  created_at bigint,
  decisions_completed integer NOT NULL DEFAULT 0,
  sim_completed integer NOT NULL DEFAULT 0,
  certificate_id text,
  sim_completed_at bigint,
  certificate_evidence_version integer
);

-- feed_stories: used by lib/feed.ts:getFeedStories
CREATE TABLE IF NOT EXISTS feed_stories (
  id text PRIMARY KEY,
  ordinal integer NOT NULL,
  headline text,
  framing text,
  prompt text,
  concept text,
  outcome text,
  explanation text
);

-- feed_responses: used by lib/feed.ts:recordFeedResponse (idempotent per story)
CREATE TABLE IF NOT EXISTS feed_responses (
  id text PRIMARY KEY,
  feed_user_id text NOT NULL,
  story_id text NOT NULL,
  response text,
  created_at bigint,
  UNIQUE (feed_user_id, story_id)
);

-- feed_sessions: used by lib/feed.ts (device-local session, HttpOnly cookie)
CREATE TABLE IF NOT EXISTS feed_sessions (
  token text PRIMARY KEY,
  feed_user_id text,
  expires_at bigint
);

-- feed_simulation_responses: used by lib/feed.ts (feed's simulation evidence log).
-- ON CONFLICT(feed_user_id, simulation_key, evidence_version, step_index).
CREATE TABLE IF NOT EXISTS feed_simulation_responses (
  feed_user_id text NOT NULL,
  simulation_key text NOT NULL,
  evidence_version integer NOT NULL,
  step_index integer NOT NULL,
  choice_id text,
  recorded_at bigint,
  PRIMARY KEY (feed_user_id, simulation_key, evidence_version, step_index)
);

-- profile_sharing_consents: used by lib/profile.ts, app/actions/profile-sharing.ts,
-- app/actions/lms.ts, app/actions/partners.ts (guardian-approved public credential links)
CREATE TABLE IF NOT EXISTS profile_sharing_consents (
  id text PRIMARY KEY,
  student_user_id text,
  public_slug text,
  guardian_name text,
  guardian_email text,
  consent_method text,
  guardian_verified_at bigint,
  granted_by_user_id text,
  granted_at bigint,
  expires_at bigint,
  discoverable integer NOT NULL DEFAULT 0,
  notes text,
  revoked_by_user_id text,
  revoked_at bigint
);

-- password_reset_tokens: used by app/actions/auth.ts, app/actions/lms.ts, app/actions/partners.ts
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id text PRIMARY KEY,
  user_id text,
  token_hash text,
  expires_at bigint,
  consumed_at bigint,
  created_at bigint
);

-- articles: used by lib/articles.ts, app/actions/articles.ts (the /analytics publication)
CREATE TABLE IF NOT EXISTS articles (
  id text PRIMARY KEY,
  slug text,
  title text,
  dek text,
  body text,
  status text NOT NULL DEFAULT 'draft',
  kind text NOT NULL DEFAULT 'article',
  author text,
  author_user_id text,
  category text,
  tags text,
  cover_image text,
  featured integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  meta_title text,
  meta_description text,
  published_at bigint,
  created_at bigint,
  updated_at bigint
);

-- article_revisions: used by lib/articles.ts:getArticleRevisions, app/actions/articles.ts
-- `id` is app/actions-inserted without a value, so it must auto-generate.
CREATE TABLE IF NOT EXISTS article_revisions (
  id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  article_id text,
  title text,
  dek text,
  body text,
  category text,
  tags text,
  saved_at bigint
);

-- glossary_terms: used by lib/glossary.ts, app/actions/content.ts
CREATE TABLE IF NOT EXISTS glossary_terms (
  id text PRIMARY KEY,
  ordinal integer,
  term text,
  definition text,
  module_name text,
  track text,
  real_world_example text,
  category text
);

-- news_submissions: used by lib/content.ts, app/actions/content.ts (student-submitted news)
CREATE TABLE IF NOT EXISTS news_submissions (
  id text PRIMARY KEY,
  student_id text,
  headline text,
  summary text,
  source_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at bigint
);

-- standards_alignment: used by lib/standards.ts (AP Economics curriculum mapping)
CREATE TABLE IF NOT EXISTS standards_alignment (
  id text PRIMARY KEY,
  ordinal integer,
  module_name text,
  track text,
  key_concepts text,
  ap_micro_standards text,
  ap_macro_standards text
);


-- ============================================================
-- Missing columns on tables that already exist.
--
-- inquiries: the operations columns this table is missing are owned by
-- 016_inquiries_operations_columns.sql, which also adds `submitted_at` and
-- backfills it. Nothing to do here.
