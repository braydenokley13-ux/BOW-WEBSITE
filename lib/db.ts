/* ============================================================
 * Database — SQLite via Node's built-in `node:sqlite` driver.
 *
 * No native dependencies and no external service: the database is a
 * single file under `data/` (gitignored). On first boot the schema
 * is created and seeded from the content arrays in lib/account, so
 * the app comes up with the same data the prototype shipped with —
 * except now it really persists and is the system of record.
 *
 * Server-only. Do not import from a client component.
 * ============================================================ */

import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { slugify } from "@/lib/slug";
import { SEED_ARTICLES } from "@/lib/analytics-content";
import {
  seedAppData,
  orderedTrackLessons,
  parseLastSeen,
  feedStories,
  selfModules,
  dailyScenarios,
  quizQuestions,
  discussionSeedPosts,
  weeklyChallengeSeed,
  partnerOrgSeed,
  reflectionWordCount,
  FEED_DECISIONS_TO_UNLOCK,
  SEED_PASSWORD,
  SELF_PACED_ORG_ID,
  SELF_PACED_COHORT_ID,
  SELF_PACED_COHORT_NAME,
  type User,
  type Organization,
  type Cohort,
  type Enrollment,
  type Invitation,
  type Inquiry,
  type Activity,
  type LessonProgressDetail,
  type SessionNote,
  type AppData,
} from "@/lib/account";
import { hashPassword, isPublicDemoPassword, verifyPassword } from "@/lib/password";
import { DAILY_QUESTIONS, seedToQuestion } from "@/lib/daily-question";
import { BADGE_CATALOG } from "@/lib/badges";
import { CONCEPT_MAP } from "@/lib/concept-map";
import { GLOSSARY_TERMS } from "@/lib/glossary";
import { STANDARDS_ALIGNMENT } from "@/lib/standards";
import { hashOpaqueToken } from "@/lib/security-tokens";
import {
  classStaffingDecisionFingerprint,
  recordClassStaffingDecision,
} from "@/lib/operational-decisions";
import {
  runOperatingSystemV7GrowthMigration,
  runOperatingSystemV8GrowthHardeningMigration,
  runOperatingSystemV10GrowthLifecycleMigration,
} from "@/lib/growth-schema";
import { canonicalDateInZone, isValidTimeZone } from "@/lib/timezone";

const CONFIGURED_DB_PATH = (process.env.BOW_DATABASE_PATH ?? "").trim();
if (CONFIGURED_DB_PATH && !path.isAbsolute(CONFIGURED_DB_PATH)) {
  throw new Error("[bow] BOW_DATABASE_PATH must be an absolute path to one durable SQLite file.");
}
const DB_PATH = CONFIGURED_DB_PATH
  || path.join(/* turbopackIgnore: true */ process.cwd(), "data", "bow.db");
const DATA_DIR = path.dirname(DB_PATH);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS migration_conflicts (
  id TEXT PRIMARY KEY,
  migration_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  detail TEXT NOT NULL,
  resolved_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS migration_row_archive (
  id TEXT PRIMARY KEY,
  migration_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  reason TEXT NOT NULL,
  archived_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  location TEXT NOT NULL,
  status TEXT NOT NULL
);
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
  deletion_requested INTEGER NOT NULL DEFAULT 0,
  last_active_at INTEGER,
  created_at INTEGER,
  onboarding_completed INTEGER NOT NULL DEFAULT 0,
  password_change_required INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS cohorts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  org_id TEXT NOT NULL,
  track TEXT NOT NULL,
  instructor_id TEXT,
  current_lesson_id TEXT,
  status TEXT NOT NULL,
  format TEXT NOT NULL,
  schedule TEXT NOT NULL,
  start TEXT NOT NULL,
  end_date TEXT NOT NULL,
  cap INTEGER NOT NULL,
  next_session TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS enrollments (
  user_id TEXT NOT NULL,
  cohort_id TEXT NOT NULL,
  enroll TEXT NOT NULL,
  lesson_status TEXT NOT NULL,
  last TEXT NOT NULL,
  att_last TEXT NOT NULL,
  unlocked_lesson_id TEXT,
  PRIMARY KEY (user_id, cohort_id)
);
CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  org_id TEXT NOT NULL,
  cohort_id TEXT,
  created TEXT NOT NULL,
  expires TEXT NOT NULL,
  status TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  token_hash TEXT UNIQUE,
  expires_at INTEGER
);
CREATE TABLE IF NOT EXISTS profile_sharing_consents (
  id TEXT PRIMARY KEY,
  student_user_id TEXT NOT NULL,
  public_slug TEXT NOT NULL UNIQUE,
  guardian_name TEXT NOT NULL,
  guardian_email TEXT NOT NULL,
  consent_method TEXT NOT NULL,
  guardian_verified_at INTEGER NOT NULL,
  granted_by_user_id TEXT NOT NULL,
  granted_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_by_user_id TEXT,
  revoked_at INTEGER,
  discoverable INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  FOREIGN KEY (student_user_id) REFERENCES users(id),
  FOREIGN KEY (granted_by_user_id) REFERENCES users(id),
  FOREIGN KEY (revoked_by_user_id) REFERENCES users(id),
  CHECK (discoverable IN (0, 1))
);
CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  type TEXT NOT NULL,
  org_name TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  summary TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  icon TEXT NOT NULL,
  text TEXT NOT NULL,
  when_label TEXT NOT NULL,
  role TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS attendance (
  cohort_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  state TEXT NOT NULL,
  PRIMARY KEY (cohort_id, user_id)
);
CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  status TEXT NOT NULL,
  simulation_done INTEGER NOT NULL DEFAULT 0,
  reflection TEXT NOT NULL DEFAULT '',
  challenge_done INTEGER NOT NULL DEFAULT 0,
  podcast_progress REAL NOT NULL DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  PRIMARY KEY (user_id, lesson_id)
);
CREATE TABLE IF NOT EXISTS session_notes (
  id TEXT PRIMARY KEY,
  cohort_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  student_id TEXT,
  scope TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_ts INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
  ON password_reset_tokens (user_id, consumed_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expiry
  ON password_reset_tokens (expires_at);
CREATE TABLE IF NOT EXISTS security_rate_limits (
  key TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  blocked_until INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_security_rate_limits_updated ON security_rate_limits (updated_at);
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
  created_at INTEGER NOT NULL,
  decisions_completed INTEGER NOT NULL DEFAULT 0,
  sim_completed INTEGER NOT NULL DEFAULT 0,
  certificate_id TEXT,
  sim_completed_at INTEGER,
  certificate_evidence_version INTEGER
);
CREATE TABLE IF NOT EXISTS feed_responses (
  id TEXT PRIMARY KEY,
  feed_user_id TEXT NOT NULL,
  story_id TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (feed_user_id, story_id)
);
CREATE TABLE IF NOT EXISTS feed_simulation_responses (
  feed_user_id TEXT NOT NULL,
  simulation_key TEXT NOT NULL,
  evidence_version INTEGER NOT NULL,
  step_index INTEGER NOT NULL,
  choice_id TEXT NOT NULL,
  recorded_at INTEGER NOT NULL,
  PRIMARY KEY (feed_user_id, simulation_key, evidence_version, step_index),
  FOREIGN KEY (feed_user_id) REFERENCES feed_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_feed_simulation_responses_user
  ON feed_simulation_responses (feed_user_id, simulation_key, evidence_version, step_index);
CREATE TABLE IF NOT EXISTS feed_sessions (
  token TEXT PRIMARY KEY,
  feed_user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS self_modules (
  id TEXT PRIMARY KEY,
  ordinal INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  concept TEXT NOT NULL,
  central_question TEXT NOT NULL,
  track TEXT NOT NULL DEFAULT '101'
);
CREATE TABLE IF NOT EXISTS self_progress (
  student_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  reflection TEXT NOT NULL DEFAULT '',
  reflection_words INTEGER NOT NULL DEFAULT 0,
  instructor_unlocked INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER,
  updated_at INTEGER,
  track TEXT NOT NULL DEFAULT '101',
  PRIMARY KEY (student_id, module_id)
);
CREATE TABLE IF NOT EXISTS self_feed_responses (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  story_id TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (student_id, story_id)
);
CREATE TABLE IF NOT EXISTS self_attendance (
  cohort_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  session_no INTEGER NOT NULL,
  present INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (cohort_id, student_id, session_no)
);
CREATE TABLE IF NOT EXISTS daily_scenarios (
  id TEXT PRIMARY KEY,
  ordinal INTEGER NOT NULL,
  concept TEXT NOT NULL,
  scenario TEXT NOT NULL,
  explanation TEXT NOT NULL,
  difficulty INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS scenario_responses (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  response_text TEXT NOT NULL,
  submitted_at INTEGER NOT NULL,
  UNIQUE (student_id, scenario_id)
);
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
CREATE TABLE IF NOT EXISTS quiz_responses (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  response_text TEXT,
  selected_choice TEXT,
  is_correct INTEGER,
  submitted_at INTEGER NOT NULL,
  UNIQUE (student_id, question_id)
);
CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  issued_at INTEGER NOT NULL,
  track TEXT NOT NULL,
  UNIQUE (student_id, track)
);
CREATE TABLE IF NOT EXISTS simulations (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  turn INTEGER NOT NULL DEFAULT 1,
  cap_space INTEGER NOT NULL,
  team_record TEXT NOT NULL,
  decisions TEXT NOT NULL DEFAULT '[]',
  completed INTEGER NOT NULL DEFAULT 0,
  final_score INTEGER,
  created_at INTEGER NOT NULL,
  sim_type TEXT NOT NULL DEFAULT 'westbrook'
);

/* ---- Discussion board (Feature 3) ---- */
CREATE TABLE IF NOT EXISTS discussion_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS discussion_replies (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS discussion_reactions (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reaction_type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (post_id, user_id, reaction_type)
);

/* ---- Weekly Challenge (Feature 4) ---- */
CREATE TABLE IF NOT EXISTS weekly_challenges (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  week_start TEXT NOT NULL,
  week_end TEXT NOT NULL,
  ordinal INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS weekly_completions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  response_text TEXT NOT NULL,
  submitted_at INTEGER NOT NULL,
  UNIQUE (student_id, challenge_id)
);

/* ---- Partner / school landing pages (Feature 5) ---- */
CREATE TABLE IF NOT EXISTS partner_orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  org_type TEXT NOT NULL,
  contact_name TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  custom_headline TEXT NOT NULL,
  custom_body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS demo_requests (
  id TEXT PRIMARY KEY,
  org_slug TEXT NOT NULL,
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  dispositioned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

/* ---- In-app notifications (Feature 6) ---- */
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  link TEXT,
  created_at INTEGER NOT NULL
);

/* ---- Daily Question + Streak (Features 1 & 2) ---- */
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
  active INTEGER NOT NULL DEFAULT 1,
  active_date TEXT UNIQUE
);
CREATE TABLE IF NOT EXISTS daily_responses (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  selected_choice TEXT NOT NULL,
  is_correct INTEGER NOT NULL,
  responded_at INTEGER NOT NULL,
  UNIQUE (student_id, question_id)
);

/* ---- Badges & Achievements (Daily-Question deep expansion) ----
 * The badge catalog (reference data) and per-student awards. student_id /
 * badge_id are TEXT to match users.id (TEXT) and the catalog's string ids. */
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
CREATE TABLE IF NOT EXISTS student_badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  earned_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, badge_id)
);

/* ---- Player Card (Feature 4) — one collectible card per student ---- */
CREATE TABLE IF NOT EXISTS player_cards (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL UNIQUE,
  generated_at INTEGER NOT NULL,
  position_label TEXT NOT NULL
);

/* ---- Admin content management (Feature 8) ---- */
CREATE TABLE IF NOT EXISTS news_items (
  id TEXT PRIMARY KEY,
  headline TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_name TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  concept_tag TEXT NOT NULL DEFAULT '',
  published_date TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS news_submissions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  headline TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS testimonials (
  id TEXT PRIMARY KEY,
  quote TEXT NOT NULL,
  student_name TEXT NOT NULL,
  school_name TEXT NOT NULL DEFAULT '',
  track_completed TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  ordinal INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

/* ---- Front Office Concept Map (Feature 3) — public reference data ---- */
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

/* ---- Front Office Glossary (Feature 5) — public reference data ---- */
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

/* ---- Curriculum Standards Alignment (Feature 7) — public reference data ---- */
CREATE TABLE IF NOT EXISTS standards_alignment (
  id TEXT PRIMARY KEY,
  ordinal INTEGER NOT NULL DEFAULT 0,
  module_name TEXT NOT NULL,
  track TEXT NOT NULL,
  key_concepts TEXT NOT NULL,
  ap_micro_standards TEXT NOT NULL,
  ap_macro_standards TEXT NOT NULL
);

/* ---- NBA Value vs. Contract analytics (/analytics) ----
 * Curated player list, hand-maintained contracts (seeded from
 * data-seeds/contracts.csv, dollars stored raw), and cached advanced
 * stats (seeded from data-seeds/stats-snapshot.csv, refreshed live by
 * scripts/nba_ingest.py via nba_api). */
CREATE TABLE IF NOT EXISTS nba_players (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  team TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  as_of TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS nba_contracts (
  player_slug TEXT PRIMARY KEY,
  team TEXT NOT NULL,
  cap_hit REAL NOT NULL,
  years_remaining INTEGER NOT NULL DEFAULT 1,
  total_remaining REAL NOT NULL DEFAULT 0,
  apron_status TEXT NOT NULL DEFAULT 'below'
);
CREATE TABLE IF NOT EXISTS nba_player_stats (
  player_slug TEXT NOT NULL,
  season TEXT NOT NULL,
  games INTEGER NOT NULL DEFAULT 0,
  minutes REAL NOT NULL DEFAULT 0,
  epm REAL,
  bpm REAL,
  source TEXT NOT NULL DEFAULT 'snapshot',
  updated_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_slug, season)
);

/* ---- Analytics publication: articles + revision history ---- */
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  dek TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  kind TEXT NOT NULL DEFAULT 'article',
  author TEXT NOT NULL DEFAULT '',
  author_user_id TEXT,
  category TEXT NOT NULL DEFAULT 'Trade Analysis',
  tags TEXT NOT NULL DEFAULT '',
  cover_image TEXT NOT NULL DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  meta_title TEXT NOT NULL DEFAULT '',
  meta_description TEXT NOT NULL DEFAULT '',
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS article_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id TEXT NOT NULL,
  title TEXT NOT NULL,
  dek TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  saved_at INTEGER NOT NULL
);

/* ---- BOW HQ (Phase A) — merged people/instructor/class data layer ---- */
CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  user_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS instructors (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'applied',
  source TEXT,
  owner_user_id TEXT,
  answers TEXT NOT NULL DEFAULT '{}',
  interview_at INTEGER,
  interview_timezone TEXT,
  interview_notes TEXT,
  founder_decision TEXT,
  decided_by TEXT,
  decided_at INTEGER,
  onboarding_status TEXT NOT NULL DEFAULT 'not_started',
  training_status TEXT NOT NULL DEFAULT 'not_started',
  eligibility_status TEXT NOT NULL DEFAULT 'not_eligible',
  progression_level TEXT NOT NULL DEFAULT 'instructor',
  development_focus TEXT,
  max_weekly_classes INTEGER NOT NULL DEFAULT 3,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS instructor_availability (
  id TEXT PRIMARY KEY,
  instructor_id TEXT NOT NULL,
  day_of_week INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  notes TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS training_modules (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'training',
  required INTEGER NOT NULL DEFAULT 1,
  content_type TEXT NOT NULL DEFAULT 'link',
  content TEXT,
  ordinal INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS training_module_completions (
  id TEXT PRIMARY KEY,
  instructor_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  completed_at INTEGER NOT NULL,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS training_module_views (
  instructor_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  first_viewed_at INTEGER NOT NULL,
  last_viewed_at INTEGER NOT NULL,
  PRIMARY KEY (instructor_id, module_id)
);
CREATE TABLE IF NOT EXISTS training_sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  scheduled_at INTEGER NOT NULL,
  timezone TEXT,
  location TEXT,
  meeting_link TEXT,
  facilitator_user_id TEXT,
  required INTEGER NOT NULL DEFAULT 1,
  facilitator_notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS training_session_registrations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  instructor_id TEXT NOT NULL,
  registered_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS training_session_attendance (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  instructor_id TEXT NOT NULL,
  attended INTEGER NOT NULL DEFAULT 0,
  recorded_at INTEGER NOT NULL,
  recorded_by TEXT
);
CREATE TABLE IF NOT EXISTS practice_evaluations (
  id TEXT PRIMARY KEY,
  instructor_id TEXT NOT NULL,
  evaluator_user_id TEXT,
  evaluated_at INTEGER NOT NULL,
  lesson_used TEXT,
  rating_curriculum_delivery INTEGER NOT NULL,
  rating_communication_engagement INTEGER NOT NULL,
  rating_preparedness_reliability INTEGER NOT NULL,
  strengths TEXT,
  concerns TEXT,
  decision TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS curricula (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  age_range TEXT,
  published INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  curriculum_id TEXT NOT NULL,
  partner_org_id TEXT,
  location TEXT,
  online_format TEXT,
  start_date TEXT,
  end_date TEXT,
  recurrence TEXT,
  schedule_day INTEGER,
  schedule_start_time TEXT,
  schedule_end_time TEXT,
  schedule_timezone TEXT,
  age_range TEXT,
  capacity INTEGER,
  minimum_enrollment INTEGER NOT NULL DEFAULT 1,
  lead_instructor_id TEXT,
  program_id TEXT,
  location_id TEXT,
  status TEXT NOT NULL DEFAULT 'planning',
  internal_notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS class_instructors (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  instructor_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'additional',
  decision_reason TEXT,
  assigned_by TEXT,
  decision_id TEXT,
  decision_fingerprint TEXT,
  decision_at INTEGER,
  added_at INTEGER NOT NULL,
  removed_at INTEGER,
  removal_reason TEXT,
  removed_by TEXT,
  removal_decision_id TEXT,
  removal_decision_fingerprint TEXT
);
CREATE TABLE IF NOT EXISTS class_sessions (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  session_date INTEGER NOT NULL,
  session_on TEXT,
  timezone TEXT,
  location TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS class_session_roster (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  enrollment_id TEXT,
  rostered_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS class_session_reports (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  notes TEXT,
  flagged INTEGER NOT NULL DEFAULT 0,
  flag_reason TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  reported_by TEXT,
  reported_at INTEGER NOT NULL,
  lesson_id TEXT,
  lesson_snapshot TEXT
);
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
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS class_enrollments (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enrolled',
  enrolled_at INTEGER NOT NULL,
  confirmed_at INTEGER,
  confirmation_source TEXT,
  withdrawn_at INTEGER,
  withdrawal_reason TEXT
);
CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  present INTEGER NOT NULL DEFAULT 0,
  status TEXT,
  note TEXT,
  recorded_by TEXT,
  recorded_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS class_status_events (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  reason TEXT,
  actor_user_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'class_action',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS class_proposals (
  id TEXT PRIMARY KEY,
  instructor_id TEXT NOT NULL,
  title TEXT NOT NULL,
  age_group TEXT,
  curriculum_topic TEXT,
  format TEXT,
  schedule TEXT,
  description TEXT,
  resources TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  converted_class_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  owner_user_id TEXT,
  due_at INTEGER,
  due_on TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  kind TEXT NOT NULL DEFAULT 'task',
  priority TEXT NOT NULL DEFAULT 'normal',
  context TEXT,
  recommended_action TEXT,
  entity_type TEXT,
  entity_id TEXT,
  handoff_to_founder INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER,
  completion_note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS crm_activity (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'note',
  body TEXT,
  actor_user_id TEXT,
  created_at INTEGER NOT NULL
);

/* ---- BOW Operating System (Phase E) ----
 * Programs are the planning/lifecycle parent. Classes remain the concrete
 * delivery unit, which preserves the working roster/session/report system. */
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
  earliest_launch_date TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
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
  start_date TEXT,
  end_date TEXT,
  launch_date TEXT,
  schedule_label TEXT,
  schedule_day INTEGER,
  schedule_start_time TEXT,
  schedule_end_time TEXT,
  schedule_timezone TEXT,
  capacity INTEGER,
  minimum_enrollment INTEGER NOT NULL DEFAULT 1,
  owner_user_id TEXT,
  partner_confirmed INTEGER NOT NULL DEFAULT 0,
  materials_status TEXT NOT NULL DEFAULT 'not_ready',
  renewal_status TEXT NOT NULL DEFAULT 'not_due',
  source_type TEXT,
  source_id TEXT,
  parent_program_id TEXT,
  outcome_summary TEXT,
  notes TEXT,
  launch_exception_reason TEXT,
  launch_exception_approved_by TEXT,
  launch_exception_approved_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS instructor_qualifications (
  id TEXT PRIMARY KEY,
  instructor_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved',
  approved_by TEXT,
  approved_at INTEGER,
  expires_at INTEGER,
  expires_on TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (instructor_id, kind, value)
);
CREATE TABLE IF NOT EXISTS instructor_feedback (
  id TEXT PRIMARY KEY,
  instructor_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  submitted_by_user_id TEXT,
  author_name TEXT,
  class_id TEXT,
  program_id TEXT,
  partner_org_id TEXT,
  session_id TEXT,
  visibility TEXT NOT NULL DEFAULT 'leadership',
  curriculum_delivery INTEGER,
  student_family_relationships INTEGER,
  organization_reliability INTEGER,
  leadership_contribution INTEGER,
  strengths TEXT,
  concerns TEXT,
  body TEXT,
  follow_up_required INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS instructor_development_items (
  id TEXT PRIMARY KEY,
  instructor_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'goal',
  title TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'concern_identified',
  owner_user_id TEXT,
  due_at INTEGER,
  due_on TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  related_feedback_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  resolved_at INTEGER
);
CREATE TABLE IF NOT EXISTS operating_regions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  leader_user_id TEXT,
  timezone TEXT,
  stage TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
/* ---- Growth network and evidence (BOW Operating System V7) ---- */
CREATE TABLE IF NOT EXISTS growth_channels (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS growth_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  owner_user_id TEXT,
  region_id TEXT,
  location_id TEXT,
  hypothesis TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  target_metric TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  budget_cents INTEGER NOT NULL DEFAULT 0,
  spend_cents INTEGER NOT NULL DEFAULT 0,
  result_value INTEGER,
  decision TEXT,
  learning TEXT,
  created_by_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS growth_contributors (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'candidate',
  source_channel_id TEXT,
  joined_on TEXT,
  exited_on TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS growth_assignments (
  id TEXT PRIMARY KEY,
  contributor_id TEXT NOT NULL,
  role TEXT NOT NULL,
  manager_assignment_id TEXT,
  region_id TEXT,
  location_id TEXT,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  closed_by_user_id TEXT,
  closure_reason TEXT,
  decision_reason TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS operating_goals (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  result_value INTEGER,
  closed_at INTEGER,
  decision_note TEXT,
  notes TEXT,
  created_by_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS student_acquisition_touchpoints (
  id TEXT PRIMARY KEY,
  person_id TEXT,
  student_id TEXT,
  channel_id TEXT NOT NULL,
  campaign_id TEXT,
  contributor_id TEXT,
  touchpoint_type TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  occurred_on TEXT NOT NULL,
  timezone TEXT NOT NULL,
  external_key TEXT,
  detail TEXT,
  recorded_by_user_id TEXT,
  source_type TEXT NOT NULL DEFAULT 'operator',
  source_id TEXT,
  voided_at INTEGER,
  voided_by_user_id TEXT,
  void_reason TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS student_acquisition_attributions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  touchpoint_id TEXT NOT NULL,
  method TEXT NOT NULL,
  evidence_note TEXT NOT NULL,
  effective_from INTEGER NOT NULL,
  effective_to INTEGER,
  decided_by_user_id TEXT,
  decision_source TEXT NOT NULL DEFAULT 'operator',
  decision_source_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS student_referrals (
  id TEXT PRIMARY KEY,
  referrer_person_id TEXT NOT NULL,
  referred_person_id TEXT NOT NULL,
  referred_student_id TEXT,
  touchpoint_id TEXT,
  campaign_id TEXT,
  contributor_id TEXT,
  referral_code TEXT NOT NULL,
  submitted_at INTEGER NOT NULL,
  notes TEXT,
  created_by_user_id TEXT NOT NULL,
  voided_at INTEGER,
  voided_by_user_id TEXT,
  void_reason TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS student_program_outcomes (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  outcome_type TEXT NOT NULL,
  occurred_on TEXT NOT NULL,
  evidence_note TEXT NOT NULL,
  recorded_by_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS growth_playbooks (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  source_campaign_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  problem TEXT NOT NULL,
  play TEXT NOT NULL,
  evidence TEXT NOT NULL,
  adoption_notes TEXT,
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS organization_people (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL DEFAULT 'contact',
  is_primary INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS organization_locations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL DEFAULT 'operates_at',
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS operational_decisions (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  decided_by_user_id TEXT NOT NULL,
  decided_at INTEGER NOT NULL,
  metadata TEXT
);

/* ---- Indexes for high-traffic WHERE-clause columns (Feature 8) ---- */
CREATE INDEX IF NOT EXISTS idx_self_progress_student ON self_progress (student_id);
CREATE INDEX IF NOT EXISTS idx_scenario_responses_student ON scenario_responses (student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_student ON quiz_responses (student_id);
CREATE INDEX IF NOT EXISTS idx_simulations_student ON simulations (student_id);
CREATE INDEX IF NOT EXISTS idx_disc_posts_channel ON discussion_posts (org_id, channel, pinned, created_at);
CREATE INDEX IF NOT EXISTS idx_disc_posts_user ON discussion_posts (user_id);
CREATE INDEX IF NOT EXISTS idx_disc_replies_post ON discussion_replies (post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_disc_replies_user ON discussion_replies (user_id);
CREATE INDEX IF NOT EXISTS idx_disc_reactions_post ON discussion_reactions (post_id);
CREATE INDEX IF NOT EXISTS idx_disc_reactions_user ON discussion_reactions (user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_completions_student ON weekly_completions (student_id);
CREATE INDEX IF NOT EXISTS idx_weekly_challenges_window ON weekly_challenges (week_start, week_end);
CREATE INDEX IF NOT EXISTS idx_partner_orgs_slug ON partner_orgs (slug);
CREATE INDEX IF NOT EXISTS idx_demo_requests_slug ON demo_requests (org_slug, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, read, created_at);
CREATE INDEX IF NOT EXISTS idx_daily_questions_active ON daily_questions (active_date);
CREATE INDEX IF NOT EXISTS idx_daily_responses_student ON daily_responses (student_id);
CREATE INDEX IF NOT EXISTS idx_daily_responses_question ON daily_responses (question_id);
CREATE INDEX IF NOT EXISTS idx_student_badges_student ON student_badges (student_id);
CREATE INDEX IF NOT EXISTS idx_glossary_terms_term ON glossary_terms (term);
CREATE INDEX IF NOT EXISTS idx_player_cards_student ON player_cards (student_id);
CREATE INDEX IF NOT EXISTS idx_news_items_active ON news_items (active, created_at);
CREATE INDEX IF NOT EXISTS idx_news_submissions_status ON news_submissions (status, created_at);
CREATE INDEX IF NOT EXISTS idx_testimonials_active ON testimonials (active, ordinal);
CREATE INDEX IF NOT EXISTS idx_nba_stats_player ON nba_player_stats (player_slug, season);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles (status, featured, published_at);
CREATE INDEX IF NOT EXISTS idx_article_revisions ON article_revisions (article_id, saved_at);

/* ---- BOW HQ (Phase A) indexes ---- */
CREATE INDEX IF NOT EXISTS idx_people_email ON people (email);
CREATE INDEX IF NOT EXISTS idx_people_user ON people (user_id);
CREATE INDEX IF NOT EXISTS idx_instructors_person ON instructors (person_id);
CREATE INDEX IF NOT EXISTS idx_instructors_stage ON instructors (stage);
CREATE INDEX IF NOT EXISTS idx_instructor_availability_instructor ON instructor_availability (instructor_id);
CREATE INDEX IF NOT EXISTS idx_training_completions_instructor ON training_module_completions (instructor_id);
CREATE INDEX IF NOT EXISTS idx_training_completions_module ON training_module_completions (module_id);
CREATE INDEX IF NOT EXISTS idx_session_regs_session ON training_session_registrations (session_id);
CREATE INDEX IF NOT EXISTS idx_session_regs_instructor ON training_session_registrations (instructor_id);
CREATE INDEX IF NOT EXISTS idx_session_att_session ON training_session_attendance (session_id);
CREATE INDEX IF NOT EXISTS idx_session_att_instructor ON training_session_attendance (instructor_id);
CREATE INDEX IF NOT EXISTS idx_practice_evals_instructor ON practice_evaluations (instructor_id);
CREATE INDEX IF NOT EXISTS idx_classes_status ON classes (status);
CREATE INDEX IF NOT EXISTS idx_classes_curriculum ON classes (curriculum_id);
CREATE INDEX IF NOT EXISTS idx_classes_lead_instructor ON classes (lead_instructor_id);
CREATE INDEX IF NOT EXISTS idx_class_instructors_class ON class_instructors (class_id);
CREATE INDEX IF NOT EXISTS idx_class_instructors_instructor ON class_instructors (instructor_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_class_date ON class_sessions (class_id, session_date);
CREATE INDEX IF NOT EXISTS idx_class_session_reports_session ON class_session_reports (session_id);
CREATE INDEX IF NOT EXISTS idx_students_guardian ON students (guardian_person_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_class ON class_enrollments (class_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_student ON class_enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_session ON attendance_records (session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student ON attendance_records (student_id);
CREATE INDEX IF NOT EXISTS idx_class_proposals_instructor_status ON class_proposals (instructor_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_status_due ON tasks (owner_user_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_entity ON tasks (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_activity_entity ON crm_activity (entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_programs_stage_launch ON programs (stage, launch_date);
CREATE INDEX IF NOT EXISTS idx_programs_owner ON programs (owner_user_id, stage);
CREATE INDEX IF NOT EXISTS idx_programs_partner ON programs (partner_org_id);
CREATE INDEX IF NOT EXISTS idx_programs_location ON programs (location_id);
CREATE INDEX IF NOT EXISTS idx_locations_stage_region ON locations (stage, region);
CREATE INDEX IF NOT EXISTS idx_instructor_qualifications_lookup ON instructor_qualifications (instructor_id, kind, value, status);
CREATE INDEX IF NOT EXISTS idx_instructor_feedback_instructor ON instructor_feedback (instructor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_instructor_feedback_program ON instructor_feedback (program_id, created_at);
CREATE INDEX IF NOT EXISTS idx_instructor_development_open ON instructor_development_items (instructor_id, status, due_at);
`;

function seed(db: DatabaseSync) {
  const data = seedAppData();
  const seedHash = hashPassword(SEED_PASSWORD);

  const insertOrg = db.prepare(
    "INSERT INTO organizations (id, name, type, location, status) VALUES (?, ?, ?, ?, ?)",
  );
  for (const o of data.organizations) insertOrg.run(o.id, o.name, o.type, o.location, o.status);

  const insertUser = db.prepare(
    "INSERT INTO users (id, name, first, email, role, org_id, grade, status, last, signin, password_hash, last_active_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const u of data.users) {
    insertUser.run(
      u.id,
      u.name,
      u.first,
      u.email.toLowerCase(),
      u.role,
      u.orgId,
      u.grade ?? null,
      u.status,
      u.last,
      u.signin,
      u.status === "invited" ? null : seedHash,
      // Real timestamp derived from the prototype "last seen" string, so the
      // instructor monitoring view can flag students inactive for 7+ days.
      u.status === "invited" ? null : parseLastSeen(u.last),
    );
  }

  const insertCohort = db.prepare(
    "INSERT INTO cohorts (id, name, org_id, track, instructor_id, current_lesson_id, status, format, schedule, start, end_date, cap, next_session) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const c of data.cohorts) {
    insertCohort.run(
      c.id, c.name, c.orgId, c.track, c.instructorId, c.currentLessonId,
      c.status, c.format, c.schedule, c.start, c.end, c.cap, c.nextSession,
    );
  }

  const insertEnr = db.prepare(
    "INSERT INTO enrollments (user_id, cohort_id, enroll, lesson_status, last, att_last) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const e of data.enrollments) {
    insertEnr.run(e.userId, e.cohortId, e.enroll, e.lessonStatus, e.last, e.attLast);
    // Seed attendance from each enrollment's last recorded state.
    if (e.attLast && e.attLast !== "none") {
      db.prepare("INSERT OR IGNORE INTO attendance (cohort_id, user_id, state) VALUES (?, ?, ?)").run(
        e.cohortId, e.userId, e.attLast,
      );
    }
  }

  const insertInv = db.prepare(
    "INSERT INTO invitations (id, email, role, org_id, cohort_id, created, expires, expires_at, status, token, token_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const iv of data.invitations) {
    const inviteNow = Date.now();
    const expiresAt = iv.status === "pending" ? inviteNow + 14 * 24 * 60 * 60 * 1000 : inviteNow - 24 * 60 * 60 * 1000;
    const displayDate = (value: number) =>
      new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const seedToken = randomBytes(32).toString("base64url");
    insertInv.run(
      iv.id,
      iv.email.toLowerCase(),
      iv.role,
      iv.orgId,
      iv.cohortId,
      iv.status === "pending" ? displayDate(inviteNow) : iv.created,
      iv.status === "pending" ? displayDate(expiresAt) : iv.expires,
      expiresAt,
      iv.status,
      `retired:${randomUUID()}`,
      hashOpaqueToken(seedToken),
    );
  }

  const insertInq = db.prepare(
    "INSERT INTO inquiries (id, name, email, type, org_name, date, status, summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const iq of data.inquiries) {
    insertInq.run(iq.id, iq.name, iq.email, iq.type, iq.orgName, iq.date, iq.status, iq.summary);
  }

  const insertAct = db.prepare(
    "INSERT INTO activity (id, icon, text, when_label, role) VALUES (?, ?, ?, ?, ?)",
  );
  for (const a of data.activity) insertAct.run(a.id, a.icon, a.text, a.when, a.role);

  // Seed per-lesson progress so dashboards and rosters show real history.
  const insertProg = db.prepare(
    "INSERT INTO lesson_progress (user_id, lesson_id, status, simulation_done, reflection, challenge_done, podcast_progress, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  // A full-length seed reflection (>= 75 words) so completed lessons satisfy the
  // self-paced unlock checklist (sim + 75-word reflection + 80% podcast).
  const seedReflection =
    "The cost here was never the salary on the cap sheet — it was the win we quietly passed up somewhere else on the roster. Every yes is a no in disguise: signing the veteran meant not developing the rookie, and spending the exception meant losing flexibility at the deadline. The trade-off only becomes visible when you name the option you didn't take, and weigh it honestly against the one you did.";
  for (const e of data.enrollments) {
    if (e.enroll === "invited" || e.enroll === "inactive") continue;
    const cohort = data.cohorts.find((c) => c.id === e.cohortId);
    if (!cohort) continue;
    const ordered = orderedTrackLessons(cohort.track);
    const curIdx = ordered.findIndex((l) => l.id === cohort.currentLessonId);
    if (curIdx === -1) continue;
    ordered.forEach((l, i) => {
      if (i < curIdx) {
        insertProg.run(e.userId, l.id, "completed", 1, seedReflection, 1, 1, "Earlier in the term", "Earlier in the term");
      } else if (i === curIdx && e.lessonStatus !== "not-started" && e.lessonStatus !== "none") {
        const done = e.lessonStatus === "completed";
        insertProg.run(
          e.userId, l.id, done ? "completed" : "in-progress",
          done ? 1 : 0, done ? seedReflection : "",
          done ? 1 : 0, done ? 1 : 0, "This week", done ? "This week" : null,
        );
      }
    });
  }

  // Seed a couple of instructor notes on the flagship cohort.
  const insertNote = db.prepare(
    "INSERT INTO session_notes (id, cohort_id, author_id, scope, text, created_at, created_ts) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  insertNote.run("note-seed-1", "coh-1", "u-coach", "Cohort · Lincoln Fall — Track 101", "Group is strong on opportunity cost — push them harder on the trade-down logic next session.", "Jun 12, 2026", Date.now() - 6 * 86400000);
  insertNote.run("note-seed-2", "coh-1", "u-coach", "Student · Tyler Nguyen", "Missed last session. Send the recap and confirm he can access the current lesson.", "Jun 10, 2026", Date.now() - 8 * 86400000);

  // The four BOW Daily Feed stories (defined in lib/account.ts) seed on first boot.
  seedFeedStories(db);
}

/** Idempotently load the four Daily Feed stories. Safe to call on every boot. */
function seedFeedStories(db: DatabaseSync) {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO feed_stories (id, ordinal, headline, framing, prompt, concept, outcome, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const s of feedStories) {
    insert.run(s.id, s.ordinal, s.headline, s.framing, s.prompt, s.concept, s.outcome, s.explanation);
  }
}

/** Idempotently load the twenty BOW Daily scenarios (Feature 2). Reference data. */
function seedDailyScenarios(db: DatabaseSync) {
  const insert = db.prepare(
    `INSERT INTO daily_scenarios (id, ordinal, concept, scenario, explanation, difficulty) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET ordinal = excluded.ordinal, concept = excluded.concept, scenario = excluded.scenario, explanation = excluded.explanation, difficulty = excluded.difficulty`,
  );
  for (const s of dailyScenarios) insert.run(s.id, s.ordinal, s.concept, s.scenario, s.explanation, s.difficulty);
}

/** Idempotently load the Econ Quiz bank (Feature 3). Reference data. */
function seedQuizQuestions(db: DatabaseSync) {
  const insert = db.prepare(
    `INSERT INTO quiz_questions (id, module_unlock, question_type, question_text, choice_a, choice_b, choice_c, choice_d, correct_answer, explanation, difficulty, track)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET module_unlock = excluded.module_unlock, question_type = excluded.question_type, question_text = excluded.question_text, choice_a = excluded.choice_a, choice_b = excluded.choice_b, choice_c = excluded.choice_c, choice_d = excluded.choice_d, correct_answer = excluded.correct_answer, explanation = excluded.explanation, difficulty = excluded.difficulty, track = excluded.track`,
  );
  for (const q of quizQuestions) {
    insert.run(
      q.id, q.moduleUnlock, q.type, q.question,
      q.choiceA, q.choiceB, q.choiceC, q.choiceD, q.correctAnswer, q.explanation, q.difficulty, q.track ?? "101",
    );
  }
}

/**
 * Idempotently load the eight Weekly Challenges (Feature 4). Title/prompt/ordinal
 * stay authoritative across boots; the week window + created_at are stamped on
 * first insert (so the calendar windows don't drift on every reboot). The first
 * challenge is anchored to the current week, each subsequent one a week later.
 */
function seedWeeklyChallenges(db: DatabaseSync) {
  const insert = db.prepare(
    `INSERT INTO weekly_challenges (id, title, prompt, week_start, week_end, ordinal, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, prompt = excluded.prompt, ordinal = excluded.ordinal`,
  );
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const d = new Date(now);
  // Sunday (UTC) of the current week — challenges run Sunday → Saturday.
  const sunday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - d.getUTCDay());
  const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  weeklyChallengeSeed.forEach((c, i) => {
    const start = sunday + i * 7 * DAY;
    const end = start + 6 * DAY;
    insert.run(c.id, c.title, c.prompt, isoDate(start), isoDate(end), c.ordinal, now + i);
  });
}

/** Idempotently load the three seed Partner orgs (Feature 5). Reference data. */
function seedPartnerOrgs(db: DatabaseSync) {
  const insert = db.prepare(
    `INSERT INTO partner_orgs (id, name, slug, org_type, contact_name, contact_email, custom_headline, custom_body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET name = excluded.name, org_type = excluded.org_type, custom_headline = excluded.custom_headline, custom_body = excluded.custom_body`,
  );
  const now = Date.now();
  for (const p of partnerOrgSeed) {
    insert.run(p.id, p.name, p.slug, p.orgType, p.contactName, p.contactEmail, p.customHeadline, p.customBody, now);
  }
}

/** Idempotently load the Daily Question bank (Feature 1). Reference data.
 * `active` is set only on first insert so admin show/hide toggles survive reboots. */
function seedDailyQuestions(db: DatabaseSync) {
  const insert = db.prepare(
    `INSERT INTO daily_questions (id, ordinal, question_text, choice_a, choice_b, choice_c, choice_d, correct_answer, explanation, concept_tag, difficulty, type, track, points, active, active_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
     ON CONFLICT(id) DO UPDATE SET ordinal = excluded.ordinal, question_text = excluded.question_text, choice_a = excluded.choice_a, choice_b = excluded.choice_b, choice_c = excluded.choice_c, choice_d = excluded.choice_d, correct_answer = excluded.correct_answer, explanation = excluded.explanation, concept_tag = excluded.concept_tag, difficulty = excluded.difficulty, type = excluded.type, track = excluded.track, points = excluded.points, active_date = excluded.active_date`,
  );
  for (const seed of DAILY_QUESTIONS) {
    const q = seedToQuestion(seed);
    insert.run(q.id, q.ordinal, q.questionText, q.choiceA, q.choiceB, q.choiceC, q.choiceD, q.correctAnswer, q.explanation, q.conceptTag, q.difficulty, q.type, q.track, q.points, q.activeDate);
  }
}

/** Idempotently load the badge catalog (reference data). Never overwrites earned awards. */
function seedBadges(db: DatabaseSync) {
  const insert = db.prepare(
    `INSERT INTO badges (id, name, description, icon, category, threshold, xp_reward, ordinal)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description, icon = excluded.icon, category = excluded.category, threshold = excluded.threshold, xp_reward = excluded.xp_reward, ordinal = excluded.ordinal`,
  );
  BADGE_CATALOG.forEach((b, i) => {
    insert.run(b.id, b.name, b.description, b.icon, b.category, b.threshold, b.xpReward, i);
  });
}

/** Idempotently load the Concept Map (Feature 3). Public reference data. */
function seedConceptMap(db: DatabaseSync) {
  const insert = db.prepare(
    `INSERT INTO concept_map (id, ordinal, concept_name, track, module_name, frontoffice_application, real_example, category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET ordinal = excluded.ordinal, concept_name = excluded.concept_name, track = excluded.track, module_name = excluded.module_name, frontoffice_application = excluded.frontoffice_application, real_example = excluded.real_example, category = excluded.category`,
  );
  for (const c of CONCEPT_MAP) {
    insert.run(c.id, c.ordinal, c.conceptName, c.track, c.moduleName, c.frontofficeApplication, c.realExample, c.category);
  }
}

/** Idempotently load the Glossary (Feature 5). Public reference data. */
function seedGlossaryTerms(db: DatabaseSync) {
  const insert = db.prepare(
    `INSERT INTO glossary_terms (id, ordinal, term, definition, module_name, track, real_world_example, category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET ordinal = excluded.ordinal, term = excluded.term, definition = excluded.definition, module_name = excluded.module_name, track = excluded.track, real_world_example = excluded.real_world_example, category = excluded.category`,
  );
  for (const g of GLOSSARY_TERMS) {
    insert.run(g.id, g.ordinal, g.term, g.definition, g.moduleName, g.track, g.realWorldExample, g.category);
  }
}

/** Idempotently load the Standards Alignment (Feature 7). Public reference data. */
function seedStandardsAlignment(db: DatabaseSync) {
  const insert = db.prepare(
    `INSERT INTO standards_alignment (id, ordinal, module_name, track, key_concepts, ap_micro_standards, ap_macro_standards)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET ordinal = excluded.ordinal, module_name = excluded.module_name, track = excluded.track, key_concepts = excluded.key_concepts, ap_micro_standards = excluded.ap_micro_standards, ap_macro_standards = excluded.ap_macro_standards`,
  );
  for (const s of STANDARDS_ALIGNMENT) {
    insert.run(s.id, s.ordinal, s.moduleName, s.track, JSON.stringify(s.keyConcepts), JSON.stringify(s.apMicroStandards), JSON.stringify(s.apMacroStandards));
  }
}

/**
 * First-boot discussion board seed (Feature 3) — six starter posts so the board
 * isn't empty at launch. Authored by the demo self-paced students, so it only
 * runs on a fresh database (after the demo students are created).
 */
function seedDiscussion(db: DatabaseSync) {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO discussion_posts (id, user_id, org_id, channel, title, body, pinned, created_at, updated_at) SELECT ?, ?, org_id, ?, ?, ?, ?, ?, ? FROM users WHERE id = ?",
  );
  const now = Date.now();
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  for (const p of discussionSeedPosts) {
    const ts = now - p.agoHours * HOUR;
    insert.run(p.id, p.userId, p.channel, p.title, p.body, p.pinned ? 1 : 0, ts, ts, p.userId);
  }
  // A couple of seed replies + reactions so threads feel alive.
  const insertReply = db.prepare(
    "INSERT OR IGNORE INTO discussion_replies (id, post_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  insertReply.run("dr-seed-1", "dp-seed-1", "u-self2", "Bird Rights are the whole reason — they could pay him more than anyone else and going over the tax was the price of keeping a top-5 player. Walking away gets you nothing.", now - 20 * HOUR);
  insertReply.run("dr-seed-2", "dp-seed-1", "u-self3", "Counterpoint: at some point the tax bill outruns the marginal wins. There's a number where you let him walk and reset.", now - 16 * HOUR);
  insertReply.run("dr-seed-3", "dp-seed-3", "u-self1", "The draft is surplus value in its purest form — pre-set slot salaries vs open-market value. Rookie deals are how small markets compete.", now - 2 * DAY);
  const insertReaction = db.prepare(
    "INSERT OR IGNORE INTO discussion_reactions (id, post_id, user_id, reaction_type, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  insertReaction.run("dx-seed-1", "dp-seed-1", "u-self2", "fire", now - 19 * HOUR);
  insertReaction.run("dx-seed-2", "dp-seed-1", "u-self3", "big_brain", now - 15 * HOUR);
  insertReaction.run("dx-seed-3", "dp-seed-3", "u-self2", "agree", now - 2 * DAY);
  insertReaction.run("dx-seed-4", "dp-seed-3", "u-self3", "fire", now - 1 * DAY);
}

/** Idempotently load the four self-paced modules + the default async cohort. */
function seedSelfModulesAndCohort(db: DatabaseSync, defaultInstructorUserId: string | null) {
  // Upsert so the module copy stays authoritative across boots (titles match
  // the Econ Quiz module names so completing a module unlocks its questions).
  const insertMod = db.prepare(
    `INSERT INTO self_modules (id, ordinal, title, summary, concept, central_question, track) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET ordinal = excluded.ordinal, title = excluded.title, summary = excluded.summary, concept = excluded.concept, central_question = excluded.central_question, track = excluded.track`,
  );
  for (const m of selfModules) insertMod.run(m.id, m.ordinal, m.title, m.summary, m.concept, m.centralQuestion, m.track ?? "101");
  // Modules are keyed by id across both tracks — drop any module no longer in the seed.
  const keepIds = selfModules.map((m) => m.id);
  const placeholders = keepIds.map(() => "?").join(", ");
  db.prepare(`DELETE FROM self_modules WHERE id NOT IN (${placeholders})`).run(...keepIds);

  // Development assigns the demo coach. Production starts unassigned; a real
  // operator must choose an instructor after bootstrap.
  db.prepare(
    "INSERT OR IGNORE INTO cohorts (id, name, org_id, track, instructor_id, current_lesson_id, status, format, schedule, start, end_date, cap, next_session) VALUES (?, ?, ?, '101', ?, 't101-m1-l1', 'active', 'Self-paced · Async', 'Anytime · On your schedule', 'Rolling', '—', 9999, 'Whenever you’re ready')",
  ).run(SELF_PACED_COHORT_ID, SELF_PACED_COHORT_NAME, SELF_PACED_ORG_ID, defaultInstructorUserId);
  db.prepare(
    `UPDATE cohorts
     SET instructor_id = NULL
     WHERE id = ? AND instructor_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = cohorts.instructor_id)`,
  ).run(SELF_PACED_COHORT_ID);
}

/**
 * First-boot demo content for the admin content managers (Feature 8):
 * testimonials (shown on the homepage), news items, and a couple of pending
 * student news submissions. Editable in the admin Content tab, so this only
 * seeds a FRESH database — admin edits are never overwritten on reboot.
 */
function seedContentDemo(db: DatabaseSync) {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  const testimonial = db.prepare(
    "INSERT OR IGNORE INTO testimonials (id, quote, student_name, school_name, track_completed, active, ordinal, created_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
  );
  ([
    ["tm-1", "I stopped memorizing and started arguing about decisions. That changed how I see every trade.", "Jalen B.", "Lincoln High School", "101", 1],
    ["tm-2", "It's the first thing my son has called homework and a game in the same sentence.", "Parent", "Brooklyn, NY", "", 2],
    ["tm-3", "The economics finally had stakes my students cared about — the cap sheet did what the textbook couldn't.", "M. Reyes", "Lincoln High School", "201", 3],
    ["tm-4", "I put my BOW certificate and profile on my college application. It showed I could actually run the numbers.", "Maya C.", "Lincoln High School", "101", 4],
  ] as [string, string, string, string, string, number][]).forEach((t) => testimonial.run(t[0], t[1], t[2], t[3], t[4], t[5], now));

  const news = db.prepare(
    "INSERT OR IGNORE INTO news_items (id, headline, summary, source_name, source_url, concept_tag, published_date, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)",
  );
  ([
    ["nw-1", "NBA finalizes ~$76B media-rights deal", "The league's new 11-year national TV agreements will lift the salary cap for every team for a decade — league 'GDP' flowing straight to budgets.", "Sports Business Journal", "https://www.sportsbusinessjournal.com/", "media_rights", "2024-07-24", now - 2 * DAY],
    ["nw-2", "Warriors set record luxury-tax bill", "Golden State paid over $170M in luxury tax in a single season to keep its championship core — the highest bill in NBA history.", "ESPN", "https://www.espn.com/nba/", "luxury_tax", "2023-08-01", now - 5 * DAY],
    ["nw-3", "Athletics open season in a Triple-A park", "After 50+ years in Oakland, the A's are playing in a minor-league stadium while chasing Las Vegas — a textbook opportunity-cost bet.", "The Athletic", "https://www.nytimes.com/athletic/", "opportunity_cost", "2025-03-27", now - 9 * DAY],
  ] as [string, string, string, string, string, string, string, number][]).forEach((n) => news.run(n[0], n[1], n[2], n[3], n[4], n[5], n[6], n[7]));

  const sub = db.prepare(
    "INSERT OR IGNORE INTO news_submissions (id, student_id, headline, summary, source_url, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)",
  );
  sub.run("ns-1", "u-self1", "Small-market team wins title on a bargain roster", "They found surplus value in undervalued players and beat far richer teams — Moneyball, but for the cap.", "https://www.espn.com/", now - DAY);
  sub.run("ns-2", "u-self2", "City debates $500M stadium subsidy", "Supporters cite jobs and the multiplier effect; critics say the money should fund schools. Classic fiscal-policy fight.", "https://www.sportsbusinessjournal.com/", now - 12 * 60 * 60 * 1000);
}

/**
 * First-boot demo data for the self-paced experience: a few async students
 * with varied progress, reflections, Daily decisions, attendance, and a note —
 * so both dashboards (Features 1 & 2) are populated out of the box.
 */
function seedSelfPacedDemo(db: DatabaseSync) {
  const seedHash = hashPassword(SEED_PASSWORD);
  const now = Date.now();
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  const reflection =
    "Funding the wing meant leaving the bench thin, and I felt that trade-off the whole way through. The real cost of the signing was not the salary on the sheet but the depth I quietly gave up, the rookie I stopped developing, and the flexibility I lost at the deadline. Naming the option I passed on made the decision honest instead of comfortable.";
  const fullWords = reflectionWordCount(reflection);
  const shortReflection = "Tough call but I funded the star.";

  const students = [
    { id: "u-self1", name: "Jordan Avery", first: "Jordan", email: "jordan.avery@example.com", last: "2 h ago", lastActive: now - 2 * HOUR },
    { id: "u-self2", name: "Sam Rivera", first: "Sam", email: "sam.rivera@example.com", last: "Yesterday", lastActive: now - DAY },
    { id: "u-self3", name: "Casey Kim", first: "Casey", email: "casey.kim@example.com", last: "Just now", lastActive: now - 20 * 60 * 1000 },
    { id: "u-self4", name: "Riley Chen", first: "Riley", email: "riley.chen@example.com", last: "3 h ago", lastActive: now - 3 * HOUR },
    { id: "u-self5", name: "Morgan Diaz", first: "Morgan", email: "morgan.diaz@example.com", last: "Yesterday", lastActive: now - DAY },
  ];
  const insertUser = db.prepare(
    "INSERT OR IGNORE INTO users (id, name, first, email, role, org_id, grade, status, last, signin, password_hash, last_active_at, created_at) VALUES (?, ?, ?, ?, 'student', ?, NULL, 'active', ?, 'Email + password', ?, ?, ?)",
  );
  const insertEnr = db.prepare(
    "INSERT OR IGNORE INTO enrollments (user_id, cohort_id, enroll, lesson_status, last, att_last) VALUES (?, ?, 'active', 'not-started', ?, 'none')",
  );
  for (const s of students) {
    // Joined roughly two weeks before their last activity (demo data).
    insertUser.run(s.id, s.name, s.first, s.email, SELF_PACED_ORG_ID, s.last, seedHash, s.lastActive, s.lastActive - 14 * DAY);
    insertEnr.run(s.id, SELF_PACED_COHORT_ID, s.last);
  }

  const insertProg = db.prepare(
    "INSERT OR IGNORE INTO self_progress (student_id, module_id, completed, reflection, reflection_words, instructor_unlocked, completed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  // Jordan: modules 1 & 2 complete with full reflections — module 3 is unlocked.
  insertProg.run("u-self1", "sm-1", 1, reflection, fullWords, 0, now - 5 * DAY, now - 5 * DAY);
  insertProg.run("u-self1", "sm-2", 1, reflection, fullWords, 0, now - 2 * DAY, now - 2 * DAY);
  // Sam: module 1 marked complete but the reflection is too short — module 2 stays locked.
  insertProg.run("u-self2", "sm-1", 1, shortReflection, reflectionWordCount(shortReflection), 0, now - DAY, now - DAY);
  // Casey: brand new — no rows yet, so only module 1 is open.

  const insertResp = db.prepare(
    "INSERT OR IGNORE INTO self_feed_responses (id, student_id, story_id, response, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  insertResp.run("sfr-seed-1", "u-self1", "feed-brown-surplus", "I pay him — a healthy All-Star core is worth the supermax.", now - 4 * DAY);
  insertResp.run("sfr-seed-2", "u-self1", "feed-athletics-oppcost", "I stay and fight for a new building before abandoning the market.", now - 3 * DAY);

  // BOW Daily scenario responses (Feature 2) so the dashboard shows history.
  const insertScn = db.prepare(
    "INSERT OR IGNORE INTO scenario_responses (id, student_id, scenario_id, response_text, submitted_at) VALUES (?, ?, ?, ?, ?)",
  );
  insertScn.run("scnr-seed-1", "u-self1", "scn-1", "I take the center — you can't coach size, and a bigger need hurts more if you leave it open.", now - 4 * DAY);
  insertScn.run("scnr-seed-2", "u-self1", "scn-2", "We priced past what fans would pay. I'd walk the ticket back toward $120 and find the seat that fills the building.", now - 3 * DAY);

  // Econ Quiz responses (Feature 3) — Jordan has modules 1 & 2 done, so those
  // questions are unlocked; seed a couple so the score tracker isn't empty.
  const insertQuiz = db.prepare(
    "INSERT OR IGNORE INTO quiz_responses (id, student_id, question_id, response_text, selected_choice, is_correct, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  insertQuiz.run("qr-seed-1", "u-self1", "q-m1-mc1", null, "B", 1, now - 4 * DAY);
  insertQuiz.run("qr-seed-2", "u-self1", "q-m1-mc2", null, "B", 1, now - 4 * DAY);
  insertQuiz.run("qr-seed-3", "u-self1", "q-m1-fr1", "I chose practice over a movie — the opportunity cost was the movie I skipped.", null, null, now - 4 * DAY);

  const insertAtt = db.prepare(
    "INSERT OR IGNORE INTO self_attendance (cohort_id, student_id, session_no, present) VALUES (?, ?, ?, ?)",
  );
  for (const n of [1, 2, 3, 4]) insertAtt.run(SELF_PACED_COHORT_ID, "u-self1", n, 1);
  for (const n of [1, 2]) insertAtt.run(SELF_PACED_COHORT_ID, "u-self2", n, 1);

  db.prepare(
    "INSERT OR IGNORE INTO session_notes (id, cohort_id, author_id, student_id, scope, text, created_at, created_ts) VALUES (?, ?, 'u-coach', ?, ?, ?, ?, ?)",
  ).run("note-self-1", SELF_PACED_COHORT_ID, "u-self1", "Student · Jordan Avery", "Flying through the early modules — strong on opportunity cost. Nudge toward the Module 3 quiz once it unlocks.", "Jun 20, 2026", now - DAY);

  /* ---- Daily-Question deep expansion: XP wallets, streaks, badges, history ----
   * Static demo values so the leaderboard tabs and /badges showcase render with
   * real, differentiated rows on a fresh database. */
  const setXp = db.prepare("UPDATE users SET xp = ?, current_streak = ?, longest_streak = ?, last_active_date = ? WHERE id = ?");
  const today = new Date(now).toISOString().slice(0, 10);
  const yesterday = new Date(now - DAY).toISOString().slice(0, 10);
  const xpRows: [string, number, number, number, string][] = [
    ["u-self1", 540, 12, 18, today],
    ["u-self2", 180, 4, 9, yesterday],
    ["u-self3", 35, 1, 1, today],
    ["u-self4", 320, 7, 7, today],
    ["u-self5", 95, 2, 5, yesterday],
  ];
  for (const [id, xp, cur, lon, lad] of xpRows) setXp.run(xp, cur, lon, lad, id);

  const awardBadge = db.prepare("INSERT OR IGNORE INTO student_badges (student_id, badge_id, earned_at) VALUES (?, ?, ?)");
  const badgeAwards: Record<string, string[]> = {
    "u-self1": ["first_flame", "week_warrior", "sharp_eye", "front_office_ready", "daily_habit", "dedicated", "pro_debut"],
    "u-self2": ["first_flame", "sharp_eye", "daily_habit"],
    "u-self3": ["first_flame"],
    "u-self4": ["first_flame", "week_warrior", "sharp_eye", "daily_habit"],
    "u-self5": ["first_flame", "sharp_eye"],
  };
  const earnedAt = `${new Date(now - 2 * DAY).toISOString().slice(0, 10)} 12:00:00`;
  for (const [sid, ids] of Object.entries(badgeAwards)) for (const bid of ids) awardBadge.run(sid, bid, earnedAt);

  // A little answered-question history so accuracy/difficulty logic has real data.
  const insertDaily = db.prepare("INSERT OR IGNORE INTO daily_responses (id, student_id, question_id, selected_choice, is_correct, responded_at) VALUES (?, ?, ?, ?, ?, ?)");
  const seedHistory: [string, string[]][] = [
    ["u-self1", ["dq-001", "dq-002", "dq-003", "dq-004", "dq-005", "dq-007", "dq-009", "dq-011"]],
    ["u-self4", ["dq-001", "dq-002", "dq-003", "dq-005", "dq-009"]],
    ["u-self2", ["dq-001", "dq-002", "dq-003"]],
  ];
  for (const [sid, qids] of seedHistory) {
    qids.forEach((qid, i) => insertDaily.run(`dr-seed-${sid}-${i}`, sid, qid, "B", 1, now - (i + 1) * DAY));
  }
}

/* ---------------- NBA analytics + publication seeds ---------------- */

/**
 * Minimal CSV reader for the hand-maintained seed files. Our CSVs are
 * plain (no quoted commas): header row + comma-separated values.
 * Blank lines are skipped; missing trailing fields come back "".
 */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (cells[i] ?? "").trim()));
    return row;
  });
}

const APRON_STATUSES = ["below", "first", "second"];

/**
 * Idempotently load the curated NBA player list from data-seeds/.
 *
 * contracts.csv is the system of record for who is tracked and what
 * they cost (cap_hit / total_remaining are $ MILLIONS in the CSV,
 * stored as raw dollars). Runs every boot so hand edits to the CSV
 * flow into the database; players removed from the CSV are pruned.
 * Its `source` / `as_of` columns (a short provenance string and an
 * ISO curation date) carry straight onto nba_players so the site can
 * disclose where the contract data came from — see getDataProvenance()
 * in lib/nba.ts.
 *
 * stats-snapshot.csv provides advanced-stat fallback values so the
 * dashboard works out of the box. A snapshot row never overwrites a
 * row already refreshed by scripts/nba_ingest.py (source='nba_api').
 */
function seedNbaFromCsv(db: DatabaseSync) {
  const dir = path.join(process.cwd(), "data-seeds");
  const contractsPath = path.join(dir, "contracts.csv");
  if (!existsSync(contractsPath)) return;

  const contracts = parseCsv(readFileSync(contractsPath, "utf8"));
  if (contracts.length === 0) return;

  const upsertPlayer = db.prepare(
    `INSERT INTO nba_players (slug, name, team, source, as_of) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET name = excluded.name, team = excluded.team, source = excluded.source, as_of = excluded.as_of`,
  );
  const upsertContract = db.prepare(
    `INSERT INTO nba_contracts (player_slug, team, cap_hit, years_remaining, total_remaining, apron_status) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(player_slug) DO UPDATE SET team = excluded.team, cap_hit = excluded.cap_hit, years_remaining = excluded.years_remaining, total_remaining = excluded.total_remaining, apron_status = excluded.apron_status`,
  );

  const slugs: string[] = [];
  for (const c of contracts) {
    if (!c.player) continue;
    const slug = slugify(c.player);
    const status = APRON_STATUSES.includes(c.apron_status) ? c.apron_status : "below";
    slugs.push(slug);
    upsertPlayer.run(slug, c.player, c.team || "", c.source || "", c.as_of || "");
    upsertContract.run(
      slug,
      c.team || "",
      Math.round((Number(c.cap_hit) || 0) * 1e6),
      Number(c.years_remaining) || 1,
      Math.round((Number(c.total_remaining) || 0) * 1e6),
      status,
    );
  }

  // The CSV is the curated list — drop anyone no longer on it.
  const ph = slugs.map(() => "?").join(", ");
  db.prepare(`DELETE FROM nba_players WHERE slug NOT IN (${ph})`).run(...slugs);
  db.prepare(`DELETE FROM nba_contracts WHERE player_slug NOT IN (${ph})`).run(...slugs);
  db.prepare(`DELETE FROM nba_player_stats WHERE player_slug NOT IN (${ph})`).run(...slugs);

  const statsPath = path.join(dir, "stats-snapshot.csv");
  if (!existsSync(statsPath)) return;
  const upsertStat = db.prepare(
    `INSERT INTO nba_player_stats (player_slug, season, games, minutes, epm, bpm, source, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'snapshot', ?)
     ON CONFLICT(player_slug, season) DO UPDATE SET games = excluded.games, minutes = excluded.minutes, epm = excluded.epm, bpm = excluded.bpm, updated_at = excluded.updated_at
     WHERE nba_player_stats.source = 'snapshot'`,
  );
  const now = Date.now();
  for (const s of parseCsv(readFileSync(statsPath, "utf8"))) {
    if (!s.player || !s.season) continue;
    const slug = slugify(s.player);
    if (!slugs.includes(slug)) continue; // stats only for curated players
    upsertStat.run(
      slug,
      s.season,
      Number(s.games) || 0,
      Number(s.minutes) || 0,
      s.epm === "" ? null : Number(s.epm),
      s.bpm === "" ? null : Number(s.bpm),
      now,
    );
  }
}

/**
 * First-boot publication seed: three pieces demonstrating live data
 * embeds. Articles are owner-editable content, so this only runs when
 * the articles table is EMPTY — admin edits are never overwritten.
 */
function seedArticlesDemo(db: DatabaseSync) {
  const count = (db.prepare("SELECT COUNT(*) AS n FROM articles").get() as { n: number }).n;
  if (count > 0) return;
  const insert = db.prepare(
    `INSERT INTO articles (id, slug, title, dek, body, status, author, category, tags, cover_image, featured, view_count, meta_title, meta_description, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, 0, '', '', ?, ?, ?)`,
  );
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  for (const a of SEED_ARTICLES) {
    const publishedAt = a.publishedDaysAgo == null ? null : now - a.publishedDaysAgo * DAY;
    const createdAt = publishedAt ?? now;
    insert.run(a.id, a.slug, a.title, a.dek, a.body, a.status, a.author, a.category, a.tags, a.featured, publishedAt, createdAt, createdAt);
  }
}

/**
 * Idempotent column migrations for databases created before a feature landed.
 * `data/` is gitignored and usually re-created fresh, but this keeps an existing
 * file from going stale. SQLite has no "ADD COLUMN IF NOT EXISTS", so we probe.
 */
function migrate(db: DatabaseSync) {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const hasColumn = (table: string, column: string): boolean =>
    (db.prepare(`PRAGMA table_info(${table})`).all() as any[]).some((c) => c.name === column);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const add = (table: string, column: string, def: string) => {
    if (!hasColumn(table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  };
  add("users", "last_active_at", "INTEGER");
  add("users", "password_change_required", "INTEGER NOT NULL DEFAULT 0");
  add("feed_users", "sim_completed_at", "INTEGER");
  add("feed_users", "certificate_evidence_version", "INTEGER");
  db.exec(`
    CREATE TABLE IF NOT EXISTS feed_simulation_responses (
      feed_user_id TEXT NOT NULL,
      simulation_key TEXT NOT NULL,
      evidence_version INTEGER NOT NULL,
      step_index INTEGER NOT NULL,
      choice_id TEXT NOT NULL,
      recorded_at INTEGER NOT NULL,
      PRIMARY KEY (feed_user_id, simulation_key, evidence_version, step_index),
      FOREIGN KEY (feed_user_id) REFERENCES feed_users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_feed_simulation_responses_user
      ON feed_simulation_responses (feed_user_id, simulation_key, evidence_version, step_index);
  `);

  // Before simulation-step evidence existed, the public preview issued a
  // certificate after four server-recorded Feed decisions and a client-only
  // simulation callback. Grandfather only records that still have the old
  // server-verifiable prerequisite. Evidence version 0 permanently identifies
  // that compatibility path; new certificates use the current version.
  const legacyFeedStoryIds = feedStories.map((story) => story.id);
  const legacyFeedStoryPlaceholders = legacyFeedStoryIds.map(() => "?").join(", ");
  const legacyFeedCompletions = db.prepare(
    `SELECT fu.id, fu.created_at, fu.certificate_id,
            COUNT(DISTINCT CASE WHEN fr.story_id IN (${legacyFeedStoryPlaceholders}) THEN fr.story_id END) AS decision_count,
            MAX(CASE WHEN fr.story_id IN (${legacyFeedStoryPlaceholders}) THEN fr.created_at END) AS latest_decision_at
       FROM feed_users fu
       LEFT JOIN feed_responses fr ON fr.feed_user_id = fu.id
      WHERE fu.sim_completed = 1
        AND fu.certificate_evidence_version IS NULL
      GROUP BY fu.id`,
  ).all(...legacyFeedStoryIds, ...legacyFeedStoryIds) as {
    id: string;
    created_at: number;
    certificate_id: string | null;
    decision_count: number;
    latest_decision_at: number | null;
  }[];
  const backfillLegacyFeedCompletion = db.prepare(
    `UPDATE feed_users
        SET certificate_id = COALESCE(certificate_id, ?),
            sim_completed_at = COALESCE(sim_completed_at, ?),
            certificate_evidence_version = 0
      WHERE id = ? AND sim_completed = 1
        AND certificate_evidence_version IS NULL`,
  );
  const markUnverifiedLegacyFeedCompletion = db.prepare(
    `UPDATE feed_users
        SET certificate_evidence_version = -1
      WHERE id = ? AND sim_completed = 1
        AND certificate_evidence_version IS NULL`,
  );
  for (const completion of legacyFeedCompletions) {
    if (Number(completion.decision_count) >= FEED_DECISIONS_TO_UNLOCK) {
      backfillLegacyFeedCompletion.run(
        completion.certificate_id ?? randomUUID(),
        Number(completion.latest_decision_at) || Number(completion.created_at) || Date.now(),
        completion.id,
      );
    } else {
      // Keep the legacy row for audit/recovery, but do not expose an unearned
      // credential. A new, fully evidenced run can replace this sentinel.
      markUnverifiedLegacyFeedCompletion.run(completion.id);
    }
  }
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_feed_users_certificate_id
      ON feed_users(certificate_id) WHERE certificate_id IS NOT NULL;
    CREATE TRIGGER IF NOT EXISTS trg_feed_certificate_immutable
    BEFORE UPDATE OF certificate_id, sim_completed_at, certificate_evidence_version, sim_completed ON feed_users
    WHEN (OLD.certificate_id IS NOT NULL AND NEW.certificate_id IS NOT OLD.certificate_id)
      OR (OLD.sim_completed_at IS NOT NULL AND NEW.sim_completed_at IS NOT OLD.sim_completed_at)
      OR (
        OLD.certificate_evidence_version >= 0
        AND NEW.certificate_evidence_version IS NOT OLD.certificate_evidence_version
      )
      OR (
        OLD.sim_completed = 1
        AND OLD.certificate_id IS NOT NULL
        AND OLD.sim_completed_at IS NOT NULL
        AND NEW.sim_completed IS NOT 1
      )
    BEGIN
      SELECT RAISE(ABORT, 'Feed certificate completion is immutable');
    END;
  `);
  add("invitations", "expires_at", "INTEGER");
  add("invitations", "token_hash", "TEXT");
  const unhashedInvitations = db
    .prepare("SELECT id, token FROM invitations WHERE token_hash IS NULL AND token IS NOT NULL")
    .all() as { id: string; token: string }[];
  for (const invitation of unhashedInvitations) {
    db.prepare("UPDATE invitations SET token_hash = ?, token = ? WHERE id = ? AND token_hash IS NULL").run(
      hashOpaqueToken(invitation.token),
      `retired:${randomUUID()}`,
      invitation.id,
    );
  }
  // Pre-expiry-schema links cannot be proven safe. Keep them fail-closed and
  // make the admin explicitly resend, which rotates a fresh token and expiry.
  db.prepare("UPDATE invitations SET status = 'revoked' WHERE status = 'pending' AND expires_at IS NULL").run();
  add("profile_sharing_consents", "guardian_verified_at", "INTEGER");
  add("profile_sharing_consents", "expires_at", "INTEGER");
  add("discussion_posts", "org_id", "TEXT");
  db.prepare(
    `UPDATE discussion_posts
        SET org_id = (SELECT u.org_id FROM users u WHERE u.id = discussion_posts.user_id)
      WHERE org_id IS NULL OR trim(org_id) = ''`,
  ).run();
  db.exec("DROP INDEX IF EXISTS idx_disc_posts_channel");
  db.exec("CREATE INDEX IF NOT EXISTS idx_disc_posts_channel ON discussion_posts(org_id, channel, pinned, created_at)");
  add("class_enrollments", "withdrawn_at", "INTEGER");
  add("class_enrollments", "withdrawal_reason", "TEXT");
  add("class_enrollments", "confirmed_at", "INTEGER");
  add("class_enrollments", "confirmation_source", "TEXT");
  add("class_sessions", "timezone", "TEXT");
  add("class_sessions", "session_on", "TEXT");
  add("attendance_records", "status", "TEXT");
  add("class_session_reports", "lesson_id", "TEXT");
  add("class_session_reports", "lesson_snapshot", "TEXT");
  add("student_acquisition_touchpoints", "source_type", "TEXT NOT NULL DEFAULT 'operator'");
  add("student_acquisition_touchpoints", "source_id", "TEXT");
  add("student_acquisition_touchpoints", "occurred_on", "TEXT");
  add("student_acquisition_touchpoints", "timezone", "TEXT");
  add("student_acquisition_attributions", "decision_source", "TEXT NOT NULL DEFAULT 'operator'");
  add("student_acquisition_attributions", "decision_source_id", "TEXT");
  add("operating_goals", "result_value", "INTEGER");
  add("operating_goals", "closed_at", "INTEGER");
  add("operating_goals", "decision_note", "TEXT");
  add("growth_assignments", "closed_by_user_id", "TEXT");
  add("growth_assignments", "closure_reason", "TEXT");
  add("students", "person_id", "TEXT");
  add("enrollments", "unlocked_lesson_id", "TEXT");
  add("lesson_progress", "podcast_progress", "REAL NOT NULL DEFAULT 0");
  // Per-student instructor notes reuse the session_notes table with a
  // structured student link (Feature 2). Older DBs get the column added.
  add("session_notes", "student_id", "TEXT");
  // Difficulty tags on scenarios and quiz questions (Features 5 & 6).
  add("daily_scenarios", "difficulty", "INTEGER NOT NULL DEFAULT 1");
  add("quiz_questions", "difficulty", "INTEGER NOT NULL DEFAULT 1");
  // Signup timestamp for the student profile (Feature 3).
  add("users", "created_at", "INTEGER");
  // First-time onboarding flag (Feature 7).
  add("users", "onboarding_completed", "INTEGER NOT NULL DEFAULT 0");
  // Track tagging for Track 201 (Feature 1).
  add("self_modules", "track", "TEXT NOT NULL DEFAULT '101'");
  add("self_progress", "track", "TEXT NOT NULL DEFAULT '101'");
  add("quiz_questions", "track", "TEXT NOT NULL DEFAULT '101'");
  // Second simulation: Eastfield Eagles (Feature 2).
  add("simulations", "sim_type", "TEXT NOT NULL DEFAULT 'westbrook'");
  // Weekly Challenge ordering (Feature 4).
  add("weekly_challenges", "ordinal", "INTEGER NOT NULL DEFAULT 0");
  // Data provenance on the curated NBA player list (Workstream 1): where a
  // row's contract data came from and when it was last curated.
  add("nba_players", "source", "TEXT NOT NULL DEFAULT ''");
  add("nba_players", "as_of", "TEXT NOT NULL DEFAULT ''");
  // Reader-submitted research papers (Workstream 4): house article vs.
  // reader paper, and the submitting account for the profile byline.
  add("articles", "kind", "TEXT NOT NULL DEFAULT 'article'");
  add("articles", "author_user_id", "TEXT");
  // Daily Streak (Feature 2): per-user consecutive-day tracking.
  add("users", "current_streak", "INTEGER NOT NULL DEFAULT 0");
  add("users", "longest_streak", "INTEGER NOT NULL DEFAULT 0");
  add("users", "last_active_date", "TEXT");
  // Daily-Question deep expansion: XP wallet, question track/type/points/active.
  add("users", "xp", "INTEGER NOT NULL DEFAULT 0");
  add("daily_questions", "type", "TEXT NOT NULL DEFAULT 'mc'");
  add("daily_questions", "track", "TEXT NOT NULL DEFAULT '101'");
  add("daily_questions", "points", "INTEGER NOT NULL DEFAULT 10");
  add("daily_questions", "active", "INTEGER NOT NULL DEFAULT 1");
  // Disposition flag for the demo-request inbox (Phase E / Wave E2):
  // marks a request as handled once staff create a follow-up task from it.
  add("demo_requests", "dispositioned", "INTEGER NOT NULL DEFAULT 0");
  // Public demand must point to a reviewed canonical Organization. Name-only
  // matching is ambiguous once BOW operates multiple branches with the same
  // name, so only backfill rows whose identity has exactly one proof.
  add("inquiries", "organization_id", "TEXT");
  db.exec(`
    UPDATE inquiries
       SET organization_id = (
         SELECT p.partner_org_id
           FROM programs p
          WHERE p.source_type = 'inquiry'
            AND p.source_id = inquiries.id
            AND p.partner_org_id IS NOT NULL
          ORDER BY p.created_at DESC, p.id
          LIMIT 1
       )
     WHERE organization_id IS NULL
       AND EXISTS (
         SELECT 1 FROM programs p
          WHERE p.source_type = 'inquiry'
            AND p.source_id = inquiries.id
            AND p.partner_org_id IS NOT NULL
       );
    UPDATE inquiries
       SET organization_id = (
         SELECT MIN(o.id)
           FROM organizations o
          WHERE lower(trim(o.name)) = lower(trim(inquiries.org_name))
       )
     WHERE organization_id IS NULL
       AND 1 = (
         SELECT COUNT(*) FROM organizations o
          WHERE lower(trim(o.name)) = lower(trim(inquiries.org_name))
       );
    CREATE INDEX IF NOT EXISTS idx_inquiries_organization
      ON inquiries(organization_id, status);
  `);
  // Phase E operating-system columns. These are additive so existing BOW HQ
  // databases retain every class, instructor, task, and LMS record.
  add("instructors", "progression_level", "TEXT NOT NULL DEFAULT 'instructor'");
  add("instructors", "development_focus", "TEXT");
  add("instructors", "max_weekly_classes", "INTEGER NOT NULL DEFAULT 3");
  // Wall-clock operating events retain both their instant and the IANA zone
  // used to resolve that instant. Pre-upgrade rows remain NULL because their
  // original timezone cannot be reconstructed safely.
  add("instructors", "interview_timezone", "TEXT");
  add("training_sessions", "timezone", "TEXT");
  add("classes", "program_id", "TEXT");
  add("classes", "location_id", "TEXT");
  add("classes", "minimum_enrollment", "INTEGER NOT NULL DEFAULT 1");
  add("classes", "schedule_day", "INTEGER");
  add("classes", "schedule_start_time", "TEXT");
  add("classes", "schedule_end_time", "TEXT");
  add("classes", "schedule_timezone", "TEXT");
  add("class_instructors", "decision_reason", "TEXT");
  add("class_instructors", "assigned_by", "TEXT");
  add("class_instructors", "decision_id", "TEXT");
  add("class_instructors", "decision_fingerprint", "TEXT");
  add("class_instructors", "decision_at", "INTEGER");
  // Staffing assignments are durable time intervals. Removal closes an
  // interval instead of deleting the evidence used by delivery and quality.
  add("class_instructors", "removed_at", "INTEGER");
  add("class_instructors", "removal_reason", "TEXT");
  add("class_instructors", "removed_by", "TEXT");
  add("class_instructors", "removal_decision_id", "TEXT");
  add("class_instructors", "removal_decision_fingerprint", "TEXT");
  add("programs", "request_key", "TEXT");
  add("programs", "schedule_timezone", "TEXT");
  add("locations", "parent_location_id", "TEXT");
  add("locations", "region_id", "TEXT");
  add("tasks", "kind", "TEXT NOT NULL DEFAULT 'task'");
  add("tasks", "priority", "TEXT NOT NULL DEFAULT 'normal'");
  add("tasks", "context", "TEXT");
  add("tasks", "recommended_action", "TEXT");
  // User-entered calendar dates are canonical TEXT values. The companion
  // INTEGER columns remain as compatibility adapters for existing ordering
  // and deadline code; old rows stay NULL here rather than receiving an
  // invented date derived in an unknown timezone.
  add("tasks", "due_on", "TEXT");
  add("instructor_qualifications", "expires_on", "TEXT");
  add("instructor_development_items", "due_on", "TEXT");
  // These indexes depend on columns that may have just been added above. Keep
  // them out of the base schema so an existing database can migrate cleanly.
  db.exec("CREATE INDEX IF NOT EXISTS idx_classes_program ON classes (program_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_classes_location ON classes (location_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_owner_status_due_on ON tasks (owner_user_id, status, due_on)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_instructor_qualifications_expires_on ON instructor_qualifications (instructor_id, status, expires_on)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_instructor_development_due_on ON instructor_development_items (instructor_id, status, due_on)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_self_progress_track ON self_progress (student_id, track)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_quiz_questions_track ON quiz_questions (track, module_unlock)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_daily_questions_track_diff ON daily_questions (active, track, difficulty)");
  // The active-simulation guard moved from one-per-student to one-per-type so a
  // student can hold an active Westbrook AND Eastfield run. Recreate the index
  // for any database that still has the older single-column form.
  db.exec("DROP INDEX IF EXISTS idx_one_active_sim");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_sim ON simulations (student_id, sim_type) WHERE completed = 0");
}

/* ---- BOW HQ (Phase A) — idempotent init backfills ---- */

/** Ensure every `users` row has a linked `people` row (people.user_id). */
function backfillPeople(db: DatabaseSync) {
  const now = Date.now();
  const linked = new Set(
    (db.prepare("SELECT user_id FROM people WHERE user_id IS NOT NULL").all() as { user_id: string }[]).map((r) => r.user_id),
  );
  const users = db.prepare("SELECT id, name, email FROM users").all() as { id: string; name: string; email: string }[];
  const insert = db.prepare(
    "INSERT INTO people (id, name, email, phone, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  for (const u of users) {
    if (linked.has(u.id)) continue;
    insert.run(`ppl-${randomUUID().slice(0, 8)}`, u.name, u.email, "", u.id, now, now);
  }
}

/**
 * Copy every `cohorts` row into `classes` (same id, so cohort_id FKs keep
 * working) without touching or dropping the `cohorts` table. LMS reads stay
 * pointed at `cohorts` for now — this only makes the merged `classes` table
 * a complete superset going forward.
 */
function migrateCohortsToClasses(db: DatabaseSync) {
  const now = Date.now();
  let legacyCurriculumId = (
    db.prepare("SELECT id FROM curricula WHERE title = ?").get("Legacy LMS Program") as { id: string } | undefined
  )?.id;
  if (!legacyCurriculumId) {
    legacyCurriculumId = `crc-${randomUUID().slice(0, 8)}`;
    db.prepare(
      "INSERT INTO curricula (id, title, description, age_range, published, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
    ).run(legacyCurriculumId, "Legacy LMS Program", "Placeholder curriculum for cohorts migrated from the LMS.", null, now, now);
  }
  const existing = new Set((db.prepare("SELECT id FROM classes").all() as { id: string }[]).map((r) => r.id));
  const cohorts = db.prepare("SELECT * FROM cohorts").all() as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  const insert = db.prepare(
    `INSERT INTO classes
      (id, title, curriculum_id, partner_org_id, location, online_format, start_date, end_date, recurrence, age_range, capacity, lead_instructor_id, status, internal_notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const c of cohorts) {
    if (existing.has(c.id)) continue;
    const status = c.status === "active" ? "active" : c.status === "completed" ? "completed" : c.status === "enrolling" ? "staffing" : "planning";
    insert.run(
      c.id, c.name, legacyCurriculumId, null, null, c.format, c.start, c.end_date, c.schedule,
      null, c.cap, c.instructor_id, status, `Migrated from LMS cohort ${c.id}.`, now, now,
    );
  }
}

/** Backfill a `students` row (with user_id link) for every existing student-role user. */
function backfillStudentsFromUsers(db: DatabaseSync) {
  const now = Date.now();
  const linked = new Set(
    (db.prepare("SELECT user_id FROM students WHERE user_id IS NOT NULL").all() as { user_id: string }[]).map((r) => r.user_id),
  );
  const users = db.prepare("SELECT id, name, email FROM users WHERE role = 'student' AND status = 'active'").all() as { id: string; name: string; email: string }[];
  const insert = db.prepare(
    `INSERT INTO students
      (id, name, age, grade, email, guardian_person_id, emergency_notes, enrollment_status, form_status, communication_notes, user_id, created_at, updated_at)
     VALUES (?, ?, NULL, NULL, ?, NULL, NULL, 'active', 'missing', NULL, ?, ?, ?)`,
  );
  for (const u of users) {
    if (linked.has(u.id)) continue;
    insert.run(`stu-${randomUUID().slice(0, 8)}`, u.name, u.email, u.id, now, now);
  }
}

/** Reference data for the hiring/training pipeline — idempotent, safe every boot. */
function seedHiringReferenceData(db: DatabaseSync, defaultFacilitatorUserId: string | null) {
  const now = Date.now();
  const insCurr = db.prepare(
    "INSERT OR IGNORE INTO curricula (id, title, description, age_range, published, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
  );
  insCurr.run("crc-trading101", "Trading Fundamentals 101", "Core Track 101 curriculum — scarcity, markets, and trade-offs through sport.", "Grades 6–9", now, now);
  insCurr.run("crc-marketlit", "Market Literacy Camp", "Camp-format intensive covering market mechanics and financial literacy basics.", "Grades 8–10", now, now);

  const insMod = db.prepare(
    "INSERT OR IGNORE INTO training_modules (id, title, category, required, content_type, content, ordinal, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
  );
  insMod.run("tm-onboard-req", "BOW Onboarding Handbook", "onboarding", 1, "text", "Welcome to BOW Sports Capital — read through our mission, expectations, and code of conduct before your first session.", 1, now, now);
  insMod.run("tm-onboard-opt", "Founder Welcome Video", "onboarding", 0, "link", "https://example.com/bow-welcome", 2, now, now);
  insMod.run("tm-training-req", "Track 101 Facilitation Guide", "training", 1, "link", "https://example.com/bow-facilitation-guide", 1, now, now);

  db.prepare(
    "INSERT OR IGNORE INTO training_sessions (id, title, scheduled_at, timezone, location, meeting_link, facilitator_user_id, required, facilitator_notes, created_at, updated_at) VALUES (?, ?, ?, 'America/New_York', ?, ?, ?, 1, ?, ?, ?)",
  ).run(
    "ts-kickoff",
    "Instructor Kickoff Training",
    now + 7 * 86400000,
    null,
    "https://example.com/bow-kickoff",
    defaultFacilitatorUserId,
    null,
    now,
    now,
  );
  db.prepare(
    `UPDATE training_sessions
     SET facilitator_user_id = CASE
           WHEN facilitator_user_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = training_sessions.facilitator_user_id)
           THEN NULL ELSE facilitator_user_id END,
         timezone = COALESCE(timezone, 'America/New_York'),
         updated_at = ?
     WHERE id = 'ts-kickoff'
       AND (timezone IS NULL OR (
         facilitator_user_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = training_sessions.facilitator_user_id)
       ))`,
  ).run(now);
}

/**
 * Idempotently converge legacy classes into the Phase E operating model.
 *
 * A migrated LMS cohort is still a Class. We restore its organization link,
 * create one normalized Location per existing organization, and place each
 * existing Class inside a Program. No legacy row is deleted or renamed.
 */
function backfillOperatingSystem(db: DatabaseSync, legacyCohortsOnly = false) {
  const now = Date.now();
  const legacyClassCondition = legacyCohortsOnly
    ? " AND EXISTS (SELECT 1 FROM cohorts legacy_cohort WHERE legacy_cohort.id = c.id)"
    : "";
  const legacyUnaliasedClassCondition = legacyCohortsOnly
    ? " AND EXISTS (SELECT 1 FROM cohorts legacy_cohort WHERE legacy_cohort.id = classes.id)"
    : "";
  const migrationActor = db.prepare(
    "SELECT id FROM users WHERE role = 'admin' ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, COALESCE(created_at, 0), id LIMIT 1",
  ).get() as { id: string } | undefined;

  // Legacy LMS instructors were stored as users and copied into
  // classes.lead_instructor_id as user ids. Give every instructor-role user a
  // canonical HQ instructor profile, then point migrated classes at that id.
  const legacyInstructorUsers = db
    .prepare(
      `SELECT u.id AS user_id, p.id AS person_id
         FROM users u
         JOIN people p ON p.user_id = u.id
        WHERE u.role = 'instructor' AND u.status = 'active'
          AND NOT EXISTS (SELECT 1 FROM instructors i WHERE i.person_id = p.id)`,
    )
    .all() as { user_id: string; person_id: string }[];
  const insertLegacyInstructor = db.prepare(
    `INSERT INTO instructors
      (id, person_id, stage, source, owner_user_id, answers, interview_at, interview_notes, founder_decision,
       decided_by, decided_at, onboarding_status, training_status, eligibility_status, progression_level,
       development_focus, max_weekly_classes, created_at, updated_at)
     VALUES (?, ?, 'active', 'legacy_lms', NULL, '{}', NULL, NULL, 'accepted', NULL, ?,
             'complete', 'complete', 'eligible', 'instructor', NULL, 3, ?, ?)`,
  );
  for (const legacy of legacyInstructorUsers) {
    insertLegacyInstructor.run(`ins-${legacy.user_id}`, legacy.person_id, now, now, now);
  }

  db.exec(`
    UPDATE classes
       SET partner_org_id = (SELECT cohorts.org_id FROM cohorts WHERE cohorts.id = classes.id)
     WHERE partner_org_id IS NULL
       AND EXISTS (SELECT 1 FROM cohorts WHERE cohorts.id = classes.id)
  `);

  db.exec(`
    UPDATE classes
       SET lead_instructor_id = (
         SELECT i.id
           FROM people p
           JOIN instructors i ON i.person_id = p.id
          WHERE p.user_id = classes.lead_instructor_id
          LIMIT 1
       )
     WHERE lead_instructor_id IS NOT NULL
       AND EXISTS (
         SELECT 1
           FROM people p
           JOIN instructors i ON i.person_id = p.id
          WHERE p.user_id = classes.lead_instructor_id
       )
       ${legacyUnaliasedClassCondition}
  `);

  const migratedLeads = db
    .prepare(`SELECT c.id, c.lead_instructor_id FROM classes c WHERE c.lead_instructor_id IS NOT NULL${legacyClassCondition}`)
    .all() as { id: string; lead_instructor_id: string }[];
  const insertClassInstructor = db.prepare(
    `INSERT INTO class_instructors (id, class_id, instructor_id, role, added_at)
     SELECT ?, ?, ?, 'lead', ?
      WHERE NOT EXISTS (
        SELECT 1 FROM class_instructors
         WHERE class_id = ? AND instructor_id = ? AND removed_at IS NULL
      )`,
  );
  for (const lead of migratedLeads) {
    insertClassInstructor.run(
      `cin-${lead.id}-${lead.lead_instructor_id}`,
      lead.id,
      lead.lead_instructor_id,
      now,
      lead.id,
      lead.lead_instructor_id,
    );
    const assignment = db.prepare(
      `SELECT id, role, decision_id, decision_fingerprint, decision_at, added_at
         FROM class_instructors
        WHERE class_id = ? AND instructor_id = ? AND removed_at IS NULL`,
    ).get(lead.id, lead.lead_instructor_id) as
      | {
          id: string;
          role: string;
          decision_id: string | null;
          decision_fingerprint: string | null;
          decision_at: number | null;
          added_at: number;
        }
      | undefined;
    if (assignment && (!assignment.decision_id || !assignment.decision_fingerprint || !assignment.decision_at)) {
      if (!migrationActor) throw new Error(`[bow] Class ${lead.id} needs a staffing decision owner, but no administrator exists.`);
      const reason = "Migrated from a proven legacy teaching assignment.";
      const decidedAt = assignment.decision_at ?? assignment.added_at ?? now;
      const decision = recordClassStaffingDecision(db, {
        classId: lead.id,
        instructorId: lead.lead_instructor_id,
        assignmentId: assignment.id,
        action: "assigned",
        role: assignment.role === "lead" ? "lead" : "additional",
        reason,
        actorUserId: migrationActor.id,
        decidedAt,
      });
      db.prepare(
        `UPDATE class_instructors
            SET decision_reason = ?, assigned_by = COALESCE(assigned_by, ?), decision_id = ?,
                decision_fingerprint = ?, decision_at = ?
          WHERE id = ? AND removed_at IS NULL`,
      ).run(reason, migrationActor.id, decision.decisionId, decision.fingerprint, decidedAt, assignment.id);
    }
  }

  // An active/completed legacy teaching assignment is reliable evidence of
  // prior approval. Convert that evidence into scoped qualifications so the
  // new staffing engine does not treat proven instructors as unknown.
  const provenAssignments = db
    .prepare(
      `SELECT DISTINCT ci.instructor_id, ci.role, c.curriculum_id, c.age_range,
              c.online_format, c.location_id
         FROM class_instructors ci
         JOIN classes c ON c.id = ci.class_id
        WHERE c.status IN ('active', 'completed')${legacyClassCondition}`,
    )
    .all() as {
      instructor_id: string;
      role: string;
      curriculum_id: string;
      age_range: string | null;
      online_format: string | null;
      location_id: string | null;
    }[];
  const insertQualification = db.prepare(
    `INSERT OR IGNORE INTO instructor_qualifications
      (id, instructor_id, kind, value, status, approved_by, approved_at, expires_at, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'approved', NULL, ?, NULL, ?, ?, ?)`,
  );
  for (const assignment of provenAssignments) {
    const scopes: { kind: string; value: string }[] = [
      { kind: "curriculum", value: assignment.curriculum_id },
      { kind: "role", value: assignment.role === "lead" ? "lead" : "assistant" },
      {
        kind: "format",
        value: (assignment.online_format ?? "").toLowerCase().includes("hybrid")
          ? "hybrid"
          : (assignment.online_format ?? "").toLowerCase().includes("online")
            ? "online"
            : "in_person",
      },
    ];
    if (assignment.age_range) scopes.push({ kind: "age_group", value: assignment.age_range });
    if (assignment.location_id) scopes.push({ kind: "location", value: assignment.location_id });
    for (const scope of scopes) {
      insertQualification.run(
        `qlf-${assignment.instructor_id}-${scope.kind}-${scope.value}`,
        assignment.instructor_id,
        scope.kind,
        scope.value,
        now,
        "Inferred from an active or completed legacy teaching assignment.",
        now,
        now,
      );
    }
  }

  // Preserve the LMS roster in the canonical class roster. The source remains
  // available in enrollments; this projection lets Program readiness and the
  // instructor workspace operate on the same students immediately.
  db.exec(`
    INSERT INTO class_enrollments (id, class_id, student_id, status, enrolled_at)
    SELECT 'cen-' || e.cohort_id || '-' || s.id,
           e.cohort_id,
           s.id,
           CASE
             WHEN e.enroll = 'active' THEN 'enrolled'
             WHEN e.enroll = 'invited' THEN 'waitlisted'
             ELSE 'withdrawn'
           END,
           ${now}
      FROM enrollments e
      JOIN students s ON s.user_id = e.user_id
      JOIN classes c ON c.id = e.cohort_id
     WHERE NOT EXISTS (
       SELECT 1 FROM class_enrollments ce
        WHERE ce.class_id = e.cohort_id AND ce.student_id = s.id
     )
  `);
  // This is deliberately insert-only. Once projected, the canonical Class
  // roster may be edited by operations; replaying legacy LMS status on every
  // process boot would silently undo those decisions.

  const organizations = db.prepare("SELECT id, name, type, location, status FROM organizations ORDER BY id").all() as {
    id: string;
    name: string;
    type: string;
    location: string;
    status: string;
  }[];
  let unassignedRegion = db.prepare(
    "SELECT id FROM operating_regions WHERE lower(trim(name)) = 'unassigned' ORDER BY created_at, id LIMIT 1",
  ).get() as { id: string } | undefined;
  if (!unassignedRegion) {
    const regionId = `reg-${randomUUID()}`;
    db.prepare(
      `INSERT INTO operating_regions
        (id, name, code, leader_user_id, timezone, stage, notes, created_at, updated_at)
       VALUES (?, 'Unassigned', ?, NULL, NULL, 'active', ?, ?, ?)`,
    ).run(
      regionId,
      uniqueRegionCode(db, "Unassigned"),
      "Default region for Locations awaiting geographic assignment.",
      now,
      now,
    );
    unassignedRegion = { id: regionId };
  }
  const insertLocation = db.prepare(
    `INSERT INTO locations
      (id, name, type, region, city, state, address, timezone, region_id, primary_leader_user_id, stage, capacity, expected_demand, rationale, earliest_launch_date, notes, created_at, updated_at)
     VALUES (?, ?, ?, 'Unassigned', ?, NULL, NULL, NULL, ?, NULL, ?, NULL, NULL, ?, NULL, ?, ?, ?)`,
  );
  const organizationLocationIds = new Map<string, string>();
  for (const org of organizations) {
    const rawType = org.type.toLowerCase();
    const type = rawType.includes("camp")
      ? "camp"
      : rawType.includes("school")
        ? "school"
        : rawType.includes("youth") || rawType.includes("community")
          ? "community_center"
          : rawType.includes("bow")
            ? "regional_chapter"
            : "partner_site";
    const provenance = `Created from the existing ${org.name} organization record.`;
    const deterministicId = `loc-${org.id}`;
    const deterministic = db.prepare("SELECT id, name, type, rationale FROM locations WHERE id = ?").get(deterministicId) as
      | { id: string; name: string; type: string; rationale: string | null }
      | undefined;
    let locationId = deterministicId;
    if (deterministic && !(deterministic.name === org.name && deterministic.type === type)) {
      const provenExisting = db.prepare(
        "SELECT id FROM locations WHERE name = ? AND rationale = ? ORDER BY created_at, id LIMIT 1",
      ).get(org.name, provenance) as { id: string } | undefined;
      locationId = provenExisting?.id ?? `loc-${randomUUID()}`;
    }
    if (!db.prepare("SELECT 1 FROM locations WHERE id = ?").get(locationId)) {
      insertLocation.run(
        locationId,
        org.name,
        type,
        org.location || null,
        unassignedRegion.id,
        org.status === "active" ? "active" : "evaluating",
        provenance,
        org.location ? `Legacy location label: ${org.location}` : null,
        now,
        now,
      );
    }
    organizationLocationIds.set(org.id, locationId);
  }

  const connectLegacyLocation = db.prepare(
    `UPDATE classes
        SET location_id = ?,
            location = COALESCE(NULLIF(location, ''), (SELECT location FROM organizations WHERE organizations.id = ?))
      WHERE partner_org_id = ? AND location_id IS NULL${legacyUnaliasedClassCondition}`,
  );
  for (const [organizationId, locationId] of organizationLocationIds) {
    connectLegacyLocation.run(locationId, organizationId, organizationId);
  }

  // Location ids are established above, after the general evidence pass. Run
  // this focused pass now so the first migration grants proven instructors
  // their Location scope without requiring a second process restart.
  const provenLocations = db
    .prepare(
      `SELECT DISTINCT ci.instructor_id, c.location_id
         FROM class_instructors ci
         JOIN classes c ON c.id = ci.class_id
        WHERE c.status IN ('active', 'completed')
          AND c.location_id IS NOT NULL${legacyClassCondition}`,
    )
    .all() as { instructor_id: string; location_id: string }[];
  for (const assignment of provenLocations) {
    insertQualification.run(
      `qlf-${assignment.instructor_id}-location-${assignment.location_id}`,
      assignment.instructor_id,
      "location",
      assignment.location_id,
      now,
      "Inferred from an active or completed legacy teaching assignment.",
      now,
      now,
    );
  }

  const founder = db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get() as { id: string } | undefined;
  const classes = db
    .prepare(`SELECT c.* FROM classes c WHERE c.program_id IS NULL${legacyClassCondition} ORDER BY c.id`)
    .all() as Record<string, unknown>[];
  const insertProgram = db.prepare(
    `INSERT INTO programs
      (id, name, partner_org_id, primary_contact_person_id, location_id, curriculum_id, audience, delivery_format, stage,
       start_date, end_date, launch_date, schedule_label, schedule_day, schedule_start_time, schedule_end_time,
       capacity, minimum_enrollment, owner_user_id, partner_confirmed, materials_status, renewal_status,
       source_type, source_id, parent_program_id, outcome_summary, notes, launch_exception_reason,
       launch_exception_approved_by, launch_exception_approved_at, created_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, 1, ?, ?, ?, ?, 'legacy_class', ?, NULL, NULL, ?, NULL, NULL, NULL, ?, ?)`,
  );
  for (const raw of classes) {
    const cls = raw as {
      id: string;
      title: string;
      curriculum_id: string;
      partner_org_id: string | null;
      location_id: string | null;
      online_format: string | null;
      status: string;
      start_date: string | null;
      end_date: string | null;
      recurrence: string | null;
      age_range: string | null;
      capacity: number | null;
    };
    const deterministicProgramId = `prg-${cls.id}`;
    const deterministicProgram = db.prepare(
      "SELECT id, source_type, source_id FROM programs WHERE id = ?",
    ).get(deterministicProgramId) as { id: string; source_type: string | null; source_id: string | null } | undefined;
    const programId = deterministicProgram && !(
      ["class", "legacy_class"].includes(deterministicProgram.source_type ?? "") && deterministicProgram.source_id === cls.id
    )
      ? `prg-${randomUUID()}`
      : deterministicProgramId;
    const programStage =
      cls.status === "active"
        ? "active"
        : cls.status === "completed"
          ? "completed"
          : cls.status === "ready_to_launch"
            ? "ready_to_launch"
            : cls.status === "staffing"
              ? "staffing"
              : cls.status === "cancelled"
                ? "closed"
                : "planning";
    const normalizedFormat = (cls.online_format ?? "").toLowerCase();
    const deliveryFormat = normalizedFormat.includes("hybrid") ? "hybrid" : normalizedFormat.includes("online") ? "online" : "in_person";
    const launched = programStage === "active" || programStage === "completed";
    if (!db.prepare("SELECT 1 FROM programs WHERE id = ?").get(programId)) {
      insertProgram.run(
        programId,
        cls.title,
        cls.partner_org_id,
        cls.location_id,
        cls.curriculum_id,
        cls.age_range,
        deliveryFormat,
        programStage,
        cls.start_date,
        cls.end_date,
        cls.start_date,
        cls.recurrence,
        cls.capacity,
        founder?.id ?? null,
        launched ? 1 : 0,
        launched ? "ready" : "not_ready",
        programStage === "completed" ? "review_due" : "not_due",
        cls.id,
        `Created from existing class ${cls.id}; the class remains the delivery record.`,
        now,
        now,
      );
    }
    db.prepare("UPDATE classes SET program_id = ?, updated_at = CASE WHEN updated_at IS NULL THEN ? ELSE updated_at END WHERE id = ?")
      .run(programId, now, cls.id);
  }

  db.prepare(
    `INSERT INTO organization_people
      (id, organization_id, person_id, relationship_type, is_primary, active, created_at, updated_at)
     SELECT 'orp-' || lower(hex(randomblob(16))), u.org_id, p.id, 'member',
            CASE WHEN u.role IN ('admin', 'growth') THEN 1 ELSE 0 END, 1, ?, ?
       FROM users u
       JOIN organizations o ON o.id = u.org_id
       JOIN people p ON p.user_id = u.id
      WHERE u.status = 'active'
        AND NOT EXISTS (
        SELECT 1 FROM organization_people op
         WHERE op.organization_id = u.org_id AND op.person_id = p.id AND op.relationship_type = 'member'
      )`,
  ).run(now, now);
  db.prepare(
    `INSERT INTO organization_people
      (id, organization_id, person_id, relationship_type, is_primary, active, created_at, updated_at)
     SELECT 'orp-' || lower(hex(randomblob(16))), p.partner_org_id, p.primary_contact_person_id,
            'program_contact', 1, 1, ?, ?
       FROM (
         SELECT DISTINCT partner_org_id, primary_contact_person_id
           FROM programs
       ) p
      WHERE p.partner_org_id IS NOT NULL AND p.primary_contact_person_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM organizations o WHERE o.id = p.partner_org_id)
        AND EXISTS (SELECT 1 FROM people pe WHERE pe.id = p.primary_contact_person_id)
        AND NOT EXISTS (
          SELECT 1 FROM organization_people op
           WHERE op.organization_id = p.partner_org_id
             AND op.person_id = p.primary_contact_person_id
             AND op.relationship_type = 'program_contact'
        )`,
  ).run(now, now);
  db.prepare(
    `INSERT INTO organization_locations
      (id, organization_id, location_id, relationship_type, active, created_at, updated_at)
     SELECT 'orl-' || lower(hex(randomblob(16))), p.partner_org_id, p.location_id,
            'program_site', 1, ?, ?
       FROM (
         SELECT DISTINCT partner_org_id, location_id
           FROM programs
       ) p
      WHERE p.partner_org_id IS NOT NULL AND p.location_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM organizations o WHERE o.id = p.partner_org_id)
        AND EXISTS (SELECT 1 FROM locations l WHERE l.id = p.location_id)
        AND NOT EXISTS (
          SELECT 1 FROM organization_locations ol
           WHERE ol.organization_id = p.partner_org_id
             AND ol.location_id = p.location_id
             AND ol.relationship_type = 'program_site'
        )`,
  ).run(now, now);

  // These relationship tables are derived operating topology. Keep existing
  // rows for history, but make their active/primary flags follow the current
  // source records instead of leaving stale membership after a user or Program
  // changes organization, contact, or site.
  db.prepare(
    `UPDATE organization_people AS op
        SET active = 0, is_primary = 0, updated_at = ?
      WHERE op.relationship_type = 'member'
        AND (op.active <> 0 OR op.is_primary <> 0)
        AND NOT EXISTS (
          SELECT 1 FROM people p JOIN users u ON u.id = p.user_id
           WHERE p.id = op.person_id AND u.org_id = op.organization_id AND u.status = 'active'
        )`,
  ).run(now);
  db.prepare(
    `UPDATE organization_people AS op
        SET active = 1,
            is_primary = CASE WHEN EXISTS (
              SELECT 1 FROM people p JOIN users u ON u.id = p.user_id
               WHERE p.id = op.person_id AND u.org_id = op.organization_id
                 AND u.status = 'active' AND u.role IN ('admin', 'growth')
            ) THEN 1 ELSE 0 END,
            updated_at = ?
      WHERE op.relationship_type = 'member'
        AND EXISTS (
          SELECT 1 FROM people p JOIN users u ON u.id = p.user_id
           WHERE p.id = op.person_id AND u.org_id = op.organization_id AND u.status = 'active'
        )
        AND (op.active <> 1 OR op.is_primary <> CASE WHEN EXISTS (
          SELECT 1 FROM people p JOIN users u ON u.id = p.user_id
           WHERE p.id = op.person_id AND u.org_id = op.organization_id
             AND u.status = 'active' AND u.role IN ('admin', 'growth')
        ) THEN 1 ELSE 0 END)`,
  ).run(now);
  db.prepare(
    `UPDATE organization_people AS op
        SET active = CASE WHEN EXISTS (
          SELECT 1 FROM programs p
           WHERE p.partner_org_id = op.organization_id AND p.primary_contact_person_id = op.person_id
        ) THEN 1 ELSE 0 END,
            updated_at = ?
      WHERE op.relationship_type = 'program_contact'
        AND op.active <> CASE WHEN EXISTS (
          SELECT 1 FROM programs p
           WHERE p.partner_org_id = op.organization_id AND p.primary_contact_person_id = op.person_id
        ) THEN 1 ELSE 0 END`,
  ).run(now);
  db.prepare(
    `UPDATE organization_locations AS ol
        SET active = CASE WHEN EXISTS (
          SELECT 1 FROM programs p
           WHERE p.partner_org_id = ol.organization_id AND p.location_id = ol.location_id
        ) THEN 1 ELSE 0 END,
            updated_at = ?
      WHERE ol.relationship_type = 'program_site'
        AND ol.active <> CASE WHEN EXISTS (
          SELECT 1 FROM programs p
           WHERE p.partner_org_id = ol.organization_id AND p.location_id = ol.location_id
        ) THEN 1 ELSE 0 END`,
  ).run(now);
}

const OPERATING_SYSTEM_V2_MIGRATION_ID = "2026-07-18-bow-operating-system-v2";
// Migration reconciliation intentionally inspects whole legacy rows whose
// shape differs by schema version. Keep that dynamic boundary local here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MigrationRow = Record<string, any>;

function archiveMigrationRow(
  db: DatabaseSync,
  tableName: string,
  rowId: string,
  row: MigrationRow,
  reason: string,
  now: number,
  migrationId = OPERATING_SYSTEM_V2_MIGRATION_ID,
) {
  const safePayload = { ...row };
  for (const secretColumn of ["password_hash", "token", "token_hash"] as const) {
    if (secretColumn in safePayload) safePayload[secretColumn] = "[REDACTED]";
  }
  db.prepare(
    `INSERT INTO migration_row_archive
      (id, migration_id, table_name, row_id, payload, reason, archived_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    `mra-${randomUUID()}`,
    migrationId,
    tableName,
    rowId,
    JSON.stringify(safePayload),
    reason,
    now,
  );
}

function recordMigrationConflict(
  db: DatabaseSync,
  entityType: string,
  entityKey: string,
  detail: MigrationRow,
  now: number,
  migrationId = OPERATING_SYSTEM_V2_MIGRATION_ID,
) {
  db.prepare(
    `INSERT INTO migration_conflicts
      (id, migration_id, entity_type, entity_key, detail, resolved_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    `mcf-${randomUUID()}`,
    migrationId,
    entityType,
    entityKey,
    JSON.stringify(detail),
    now,
    now,
  );
}

function assertNoMigrationRows(db: DatabaseSync, label: string, sql: string) {
  const row = db.prepare(sql).get() as MigrationRow | undefined;
  if (row) {
    throw new Error(`[bow:v2] ${label}: ${JSON.stringify(row)}`);
  }
}

function findMigrationValueReferences(
  db: DatabaseSync,
  value: string,
  excludedTables: Set<string>,
): string[] {
  const references: string[] = [];
  const tables = db.prepare(
    `SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name`,
  ).all() as { name: string }[];
  for (const { name } of tables) {
    if (excludedTables.has(name) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue;
    const columns = db.prepare(`PRAGMA table_info("${name}")`).all() as { name: string }[];
    for (const column of columns) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(column.name)) continue;
      if (db.prepare(`SELECT 1 FROM "${name}" WHERE "${column.name}" = ? LIMIT 1`).get(value)) {
        references.push(`${name}.${column.name}`);
      }
    }
  }
  return references;
}

function reconcileV2Identity(db: DatabaseSync, now: number) {
  const users = db.prepare("SELECT * FROM users ORDER BY id").all() as MigrationRow[];
  for (const user of users) {
    const email = String(user.email ?? "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      throw new Error(`[bow:v2] User ${String(user.id)} has a blank or invalid email.`);
    }
  }

  const duplicateEmails = db.prepare(
    `SELECT lower(trim(email)) AS normalized_email
       FROM users
      GROUP BY lower(trim(email))
     HAVING COUNT(*) > 1
      ORDER BY normalized_email`,
  ).all() as { normalized_email: string }[];
  for (const group of duplicateEmails) {
    const rows = db.prepare(
      "SELECT * FROM users WHERE lower(trim(email)) = ? ORDER BY COALESCE(created_at, 0), id",
    ).all(group.normalized_email) as MigrationRow[];
    const claimed = rows.filter((row) => row.status !== "invited" || row.password_hash !== null);
    if (claimed.length > 1) {
      throw new Error(
        `[bow:v2] Multiple claimed accounts share ${group.normalized_email}: ${claimed.map((row) => String(row.id)).join(", ")}. Manual identity review is required.`,
      );
    }
    const canonical = claimed[0] ?? rows[0];
    if (!claimed[0] && rows.some((row) => row.role !== canonical.role || row.org_id !== canonical.org_id)) {
      throw new Error(
        `[bow:v2] Invited accounts with different authorization share ${group.normalized_email}. Manual identity review is required.`,
      );
    }
    for (const loser of rows.filter((row) => row.id !== canonical.id)) {
      if (loser.status !== "invited" || loser.password_hash !== null) {
        throw new Error(`[bow:v2] Duplicate email loser ${String(loser.id)} is not an unclaimed placeholder.`);
      }
      const userReferences = findMigrationValueReferences(
        db,
        String(loser.id),
        new Set(["users", "people", "migration_conflicts", "migration_row_archive", "schema_migrations"]),
      );
      const linkedPeople = db.prepare("SELECT * FROM people WHERE user_id = ? ORDER BY id").all(loser.id) as MigrationRow[];
      const personReferences = linkedPeople.flatMap((person) =>
        findMigrationValueReferences(
          db,
          String(person.id),
          new Set(["people", "migration_conflicts", "migration_row_archive", "schema_migrations"]),
        ).map((reference) => `${String(person.id)}:${reference}`),
      );
      if (userReferences.length > 0 || personReferences.length > 0) {
        throw new Error(
          `[bow:v2] Duplicate placeholder ${String(loser.id)} has operational history and cannot be merged automatically. References: ${[...userReferences, ...personReferences].join(", ")}.`,
        );
      }
      for (const person of linkedPeople) {
        archiveMigrationRow(db, "people", String(person.id), person, "Removed an unused Person created for a duplicate invitation placeholder.", now);
        db.prepare("DELETE FROM people WHERE id = ?").run(person.id);
      }
      archiveMigrationRow(db, "users", String(loser.id), loser, "Removed duplicate unclaimed invitation placeholder.", now);
      db.prepare("DELETE FROM users WHERE id = ?").run(loser.id);
      recordMigrationConflict(
        db,
        "user_email",
        group.normalized_email,
        { keptUserId: canonical.id, removedPlaceholderUserId: loser.id, action: "removed_unclaimed_placeholder" },
        now,
      );
    }
    if (claimed[0]) {
      const pendingInvitations = db.prepare(
        "SELECT * FROM invitations WHERE status = 'pending' AND lower(trim(email)) = ?",
      ).all(group.normalized_email) as MigrationRow[];
      for (const invitation of pendingInvitations) {
        archiveMigrationRow(db, "invitations", String(invitation.id), invitation, "Revoked invitation for an already claimed identity.", now);
        db.prepare("UPDATE invitations SET status = 'revoked' WHERE id = ?").run(invitation.id);
      }
    }
  }
  db.prepare("UPDATE users SET email = lower(trim(email))").run();

  const invitations = db.prepare("SELECT * FROM invitations ORDER BY id").all() as MigrationRow[];
  for (const invitation of invitations) {
    const normalizedEmail = String(invitation.email ?? "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      throw new Error(`[bow:v2] Invitation ${String(invitation.id)} has a blank or invalid email.`);
    }
    if (normalizedEmail !== invitation.email) {
      archiveMigrationRow(db, "invitations", String(invitation.id), invitation, "Normalized invitation email.", now);
      db.prepare("UPDATE invitations SET email = ? WHERE id = ?").run(normalizedEmail, invitation.id);
    }
  }

  const unsafePending = db.prepare(
    `SELECT i.*
       FROM invitations i
      WHERE i.status = 'pending'
        AND (
          i.expires_at IS NULL OR i.expires_at <= ? OR i.token_hash IS NULL OR length(i.token_hash) <> 64
          OR i.token_hash GLOB '*[^0-9a-f]*'
          OR NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = i.org_id AND o.status = 'active')
          OR (i.cohort_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM cohorts c WHERE c.id = i.cohort_id AND c.status IN ('active', 'enrolling')))
          OR EXISTS (
            SELECT 1 FROM users u
             WHERE lower(trim(u.email)) = lower(trim(i.email))
               AND (u.status <> 'invited' OR u.password_hash IS NOT NULL)
          )
        )`,
  ).all(now) as MigrationRow[];
  for (const invitation of unsafePending) {
    archiveMigrationRow(db, "invitations", String(invitation.id), invitation, "Revoked unsafe or obsolete pending invitation.", now);
    db.prepare("UPDATE invitations SET status = 'revoked' WHERE id = ?").run(invitation.id);
  }

  const malformedInvitationCredentials = db.prepare(
    `SELECT * FROM invitations
      WHERE token_hash IS NULL OR length(token_hash) <> 64
         OR token_hash GLOB '*[^0-9a-f]*'`,
  ).all() as MigrationRow[];
  for (const invitation of malformedInvitationCredentials) {
    archiveMigrationRow(db, "invitations", String(invitation.id), invitation, "Rotated malformed invitation credential hash.", now);
    db.prepare(
      `UPDATE invitations
          SET token_hash = ?, token = ?, status = CASE WHEN status = 'pending' THEN 'revoked' ELSE status END
        WHERE id = ?`,
    ).run(
      hashOpaqueToken(`retired-invalid:${String(invitation.id)}:${randomUUID()}`),
      `retired:${randomUUID()}`,
      invitation.id,
    );
  }

  const duplicateTokenHashes = db.prepare(
    `SELECT token_hash
       FROM invitations
      WHERE token_hash IS NOT NULL
      GROUP BY token_hash
     HAVING COUNT(*) > 1`,
  ).all() as { token_hash: string }[];
  for (const group of duplicateTokenHashes) {
    const rows = db.prepare(
      "SELECT * FROM invitations WHERE token_hash = ? ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, COALESCE(expires_at, 0) DESC, id",
    ).all(group.token_hash) as MigrationRow[];
    for (const [index, row] of rows.entries()) {
      archiveMigrationRow(db, "invitations", String(row.id), row, "Reconciled duplicate invitation credential hash.", now);
      if (row.status === "pending") db.prepare("UPDATE invitations SET status = 'revoked' WHERE id = ?").run(row.id);
      if (index > 0) {
        db.prepare("UPDATE invitations SET token_hash = ?, token = ? WHERE id = ?").run(
          hashOpaqueToken(`retired-duplicate:${String(row.id)}:${randomUUID()}`),
          `retired:${randomUUID()}`,
          row.id,
        );
      }
    }
    recordMigrationConflict(db, "invitation_token", rows.map((row) => String(row.id)).join(":"), { invitationIds: rows.map((row) => row.id), action: "revoked_and_rotated" }, now);
  }

  const duplicatePendingEmails = db.prepare(
    `SELECT lower(trim(email)) AS normalized_email
       FROM invitations
      WHERE status = 'pending'
      GROUP BY lower(trim(email))
     HAVING COUNT(*) > 1`,
  ).all() as { normalized_email: string }[];
  for (const group of duplicatePendingEmails) {
    const rows = db.prepare(
      `SELECT * FROM invitations
        WHERE status = 'pending' AND lower(trim(email)) = ?
        ORDER BY COALESCE(expires_at, 0) DESC, id DESC`,
    ).all(group.normalized_email) as MigrationRow[];
    const authorization = new Set(rows.map((row) => `${String(row.role)}|${String(row.org_id)}|${String(row.cohort_id ?? "")}`));
    const keepId = authorization.size === 1 ? rows[0].id : null;
    for (const row of rows) {
      if (row.id === keepId) continue;
      archiveMigrationRow(db, "invitations", String(row.id), row, "Revoked duplicate pending invitation.", now);
      db.prepare("UPDATE invitations SET status = 'revoked' WHERE id = ?").run(row.id);
    }
    recordMigrationConflict(
      db,
      "invitation_email",
      group.normalized_email,
      { invitationIds: rows.map((row) => row.id), keptInvitationId: keepId, action: keepId ? "kept_latest_authorized" : "revoked_all_authorization_conflict" },
      now,
    );
  }

  const activeConsents = db.prepare(
    `SELECT c.*
       FROM profile_sharing_consents c
      WHERE c.revoked_at IS NULL
        AND (
          c.guardian_verified_at IS NULL OR c.expires_at IS NULL OR c.expires_at <= ?
          OR NOT EXISTS (
            SELECT 1 FROM users u
             WHERE u.id = c.student_user_id
               AND u.role = 'student' AND u.status = 'active' AND u.deletion_requested = 0
               AND EXISTS (SELECT 1 FROM enrollments e WHERE e.user_id = u.id AND e.enroll = 'active')
          )
        )`,
  ).all(now) as MigrationRow[];
  for (const consent of activeConsents) {
    archiveMigrationRow(db, "profile_sharing_consents", String(consent.id), consent, "Revoked invalid or expired public-profile consent.", now);
    db.prepare("UPDATE profile_sharing_consents SET revoked_at = ?, discoverable = 0 WHERE id = ?").run(now, consent.id);
  }

  const duplicateConsentSlugs = db.prepare(
    `SELECT public_slug
       FROM profile_sharing_consents
      GROUP BY public_slug
     HAVING COUNT(*) > 1`,
  ).all() as { public_slug: string }[];
  for (const group of duplicateConsentSlugs) {
    const rows = db.prepare(
      `SELECT * FROM profile_sharing_consents
        WHERE public_slug = ?
        ORDER BY CASE WHEN revoked_at IS NULL THEN 0 ELSE 1 END, COALESCE(guardian_verified_at, 0) DESC, granted_at DESC, id`,
    ).all(group.public_slug) as MigrationRow[];
    for (const row of rows.slice(1)) {
      archiveMigrationRow(db, "profile_sharing_consents", String(row.id), row, "Retired duplicate public-profile slug.", now);
      db.prepare(
        "UPDATE profile_sharing_consents SET public_slug = ?, revoked_at = COALESCE(revoked_at, ?), discoverable = 0 WHERE id = ?",
      ).run(`retired-${String(row.id)}-${randomUUID()}`, now, row.id);
    }
    recordMigrationConflict(db, "profile_slug", group.public_slug, { keptConsentId: rows[0].id, retiredConsentIds: rows.slice(1).map((row) => row.id) }, now);
  }

  const duplicateActiveConsents = db.prepare(
    `SELECT student_user_id
       FROM profile_sharing_consents
      WHERE revoked_at IS NULL
      GROUP BY student_user_id
     HAVING COUNT(*) > 1`,
  ).all() as { student_user_id: string }[];
  for (const group of duplicateActiveConsents) {
    const rows = db.prepare(
      `SELECT * FROM profile_sharing_consents
        WHERE student_user_id = ? AND revoked_at IS NULL
        ORDER BY guardian_verified_at DESC, granted_at DESC, id DESC`,
    ).all(group.student_user_id) as MigrationRow[];
    for (const row of rows.slice(1)) {
      archiveMigrationRow(db, "profile_sharing_consents", String(row.id), row, "Revoked duplicate active public-profile consent.", now);
      db.prepare("UPDATE profile_sharing_consents SET revoked_at = ?, discoverable = 0 WHERE id = ?").run(now, row.id);
    }
    recordMigrationConflict(db, "profile_consent", group.student_user_id, { keptConsentId: rows[0].id, revokedConsentIds: rows.slice(1).map((row) => row.id) }, now);
  }

  const duplicatePeopleLinks = db.prepare(
    `SELECT user_id FROM people WHERE user_id IS NOT NULL GROUP BY user_id HAVING COUNT(*) > 1`,
  ).all() as { user_id: string }[];
  for (const group of duplicatePeopleLinks) {
    const rows = db.prepare(
      `SELECT p.*, CASE WHEN EXISTS (SELECT 1 FROM instructors i WHERE i.person_id = p.id) THEN 1 ELSE 0 END AS has_instructor
         FROM people p WHERE p.user_id = ?
        ORDER BY has_instructor DESC, p.created_at, p.id`,
    ).all(group.user_id) as MigrationRow[];
    throw new Error(
      `[bow:v2] User ${group.user_id} is linked to multiple People (${rows.map((row) => String(row.id)).join(", ")}). Manual identity merge is required to preserve history.`,
    );
  }

  const invalidStudentPeople = db.prepare(
    `SELECT * FROM students
      WHERE person_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM people p WHERE p.id = students.person_id)`,
  ).all() as MigrationRow[];
  for (const student of invalidStudentPeople) {
    archiveMigrationRow(db, "students", String(student.id), student, "Cleared missing Person reference.", now);
    db.prepare("UPDATE students SET person_id = NULL, updated_at = ? WHERE id = ?").run(now, student.id);
  }
  db.prepare(
    `UPDATE students
        SET person_id = (
          SELECT p.id FROM people p WHERE p.user_id = students.user_id ORDER BY p.created_at, p.id LIMIT 1
        ), updated_at = ?
      WHERE user_id IS NOT NULL AND person_id IS NULL
        AND EXISTS (SELECT 1 FROM people p WHERE p.user_id = students.user_id)`,
  ).run(now);

  for (const column of ["user_id", "person_id"] as const) {
    const duplicateLinks = db.prepare(
      `SELECT ${column} AS link_id FROM students WHERE ${column} IS NOT NULL GROUP BY ${column} HAVING COUNT(*) > 1`,
    ).all() as { link_id: string }[];
    for (const group of duplicateLinks) {
      const rows = db.prepare(
        `SELECT * FROM students WHERE ${column} = ?
          ORDER BY CASE WHEN enrollment_status = 'active' THEN 0 ELSE 1 END, created_at, id`,
      ).all(group.link_id) as MigrationRow[];
      throw new Error(
        `[bow:v2] ${column} ${group.link_id} is linked to multiple Students (${rows.map((row) => String(row.id)).join(", ")}). Manual identity merge is required to preserve learning and roster history.`,
      );
    }
  }
}

function uniqueRegionCode(db: DatabaseSync, name: string): string {
  const base = (slugify(name).replace(/-/g, "_").toUpperCase() || "REGION").slice(0, 28);
  let code = base;
  let suffix = 2;
  while (db.prepare("SELECT 1 FROM operating_regions WHERE code = ?").get(code)) {
    code = `${base.slice(0, 24)}_${suffix}`;
    suffix += 1;
  }
  return code;
}

function reconcileV2NetworkAndPrograms(db: DatabaseSync, now: number) {
  const duplicateRegionNames = db.prepare(
    `SELECT lower(trim(name)) AS normalized_name
       FROM operating_regions
      GROUP BY lower(trim(name))
     HAVING COUNT(*) > 1`,
  ).all() as { normalized_name: string }[];
  for (const group of duplicateRegionNames) {
    const rows = db.prepare(
      "SELECT * FROM operating_regions WHERE lower(trim(name)) = ? ORDER BY created_at, id",
    ).all(group.normalized_name) as MigrationRow[];
    const canonical = rows[0];
    for (const row of rows.slice(1)) {
      archiveMigrationRow(db, "operating_regions", String(row.id), row, "Merged duplicate normalized operating region.", now);
      db.prepare("UPDATE locations SET region_id = ? WHERE region_id = ?").run(canonical.id, row.id);
      db.prepare("DELETE FROM operating_regions WHERE id = ?").run(row.id);
    }
    recordMigrationConflict(db, "operating_region", group.normalized_name, { keptRegionId: canonical.id, mergedRegionIds: rows.slice(1).map((row) => row.id) }, now);
  }

  const invalidLocationRegions = db.prepare(
    `SELECT * FROM locations
      WHERE region_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM operating_regions r WHERE r.id = locations.region_id)`,
  ).all() as MigrationRow[];
  for (const location of invalidLocationRegions) {
    archiveMigrationRow(db, "locations", String(location.id), location, "Cleared missing operating-region reference.", now);
    db.prepare("UPDATE locations SET region_id = NULL, updated_at = ? WHERE id = ?").run(now, location.id);
  }

  const locations = db.prepare("SELECT * FROM locations ORDER BY id").all() as MigrationRow[];
  for (const location of locations) {
    const regionName = String(location.region ?? "").trim() || "Unassigned";
    let region = db.prepare(
      "SELECT id FROM operating_regions WHERE lower(trim(name)) = lower(trim(?)) ORDER BY created_at, id LIMIT 1",
    ).get(regionName) as { id: string } | undefined;
    if (!region) {
      const regionId = `reg-${randomUUID()}`;
      db.prepare(
        `INSERT INTO operating_regions
          (id, name, code, leader_user_id, timezone, stage, notes, created_at, updated_at)
         VALUES (?, ?, ?, NULL, ?, 'active', ?, ?, ?)`,
      ).run(
        regionId,
        regionName,
        uniqueRegionCode(db, regionName),
        location.timezone ?? null,
        regionName === "Unassigned" ? "Migration placeholder for Locations awaiting regional ownership." : "Created from existing Location region data.",
        now,
        now,
      );
      region = { id: regionId };
    }
    if (location.region_id !== region.id || location.region !== regionName) {
      db.prepare("UPDATE locations SET region = ?, region_id = ?, updated_at = ? WHERE id = ?").run(regionName, region.id, now, location.id);
    }
  }

  const invalidParents = db.prepare(
    `SELECT * FROM locations
      WHERE parent_location_id IS NOT NULL
        AND (parent_location_id = id OR NOT EXISTS (SELECT 1 FROM locations p WHERE p.id = locations.parent_location_id))`,
  ).all() as MigrationRow[];
  for (const location of invalidParents) {
    archiveMigrationRow(db, "locations", String(location.id), location, "Cleared invalid Location parent reference.", now);
    db.prepare("UPDATE locations SET parent_location_id = NULL, updated_at = ? WHERE id = ?").run(now, location.id);
  }

  const dedupeRelationshipTable = (
    table: "organization_people" | "organization_locations",
    leftColumn: "person_id" | "location_id",
  ) => {
    const groups = db.prepare(
      `SELECT organization_id, ${leftColumn} AS related_id, relationship_type
         FROM ${table}
        GROUP BY organization_id, ${leftColumn}, relationship_type
       HAVING COUNT(*) > 1`,
    ).all() as { organization_id: string; related_id: string; relationship_type: string }[];
    for (const group of groups) {
      const rows = db.prepare(
        `SELECT * FROM ${table}
          WHERE organization_id = ? AND ${leftColumn} = ? AND relationship_type = ?
          ORDER BY active DESC, created_at, id`,
      ).all(group.organization_id, group.related_id, group.relationship_type) as MigrationRow[];
      for (const row of rows.slice(1)) {
        archiveMigrationRow(db, table, String(row.id), row, "Removed duplicate organization relationship.", now);
        db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(row.id);
      }
      recordMigrationConflict(db, table, `${group.organization_id}:${group.related_id}:${group.relationship_type}`, { keptId: rows[0].id, removedIds: rows.slice(1).map((row) => row.id) }, now);
    }
  };
  dedupeRelationshipTable("organization_people", "person_id");
  dedupeRelationshipTable("organization_locations", "location_id");

  const organizationMembers = db.prepare(
    `SELECT DISTINCT u.org_id AS organization_id, p.id AS person_id,
            CASE WHEN u.role IN ('admin', 'growth') THEN 1 ELSE 0 END AS is_primary
       FROM users u
       JOIN organizations o ON o.id = u.org_id
       JOIN people p ON p.user_id = u.id
      WHERE u.status = 'active'`,
  ).all() as { organization_id: string; person_id: string; is_primary: number }[];
  const insertOrganizationPerson = db.prepare(
    `INSERT INTO organization_people
      (id, organization_id, person_id, relationship_type, is_primary, active, created_at, updated_at)
     SELECT ?, ?, ?, ?, ?, 1, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM organization_people
         WHERE organization_id = ? AND person_id = ? AND relationship_type = ?
      )`,
  );
  for (const member of organizationMembers) {
    insertOrganizationPerson.run(
      `orp-${randomUUID()}`,
      member.organization_id,
      member.person_id,
      "member",
      member.is_primary,
      now,
      now,
      member.organization_id,
      member.person_id,
      "member",
    );
  }
  const programContacts = db.prepare(
    `SELECT DISTINCT partner_org_id AS organization_id, primary_contact_person_id AS person_id
       FROM programs
      WHERE partner_org_id IS NOT NULL AND primary_contact_person_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM organizations o WHERE o.id = programs.partner_org_id)
        AND EXISTS (SELECT 1 FROM people p WHERE p.id = programs.primary_contact_person_id)`,
  ).all() as { organization_id: string; person_id: string }[];
  for (const contact of programContacts) {
    insertOrganizationPerson.run(
      `orp-${randomUUID()}`,
      contact.organization_id,
      contact.person_id,
      "program_contact",
      1,
      now,
      now,
      contact.organization_id,
      contact.person_id,
      "program_contact",
    );
  }

  const programSites = db.prepare(
    `SELECT DISTINCT partner_org_id AS organization_id, location_id
       FROM programs
      WHERE partner_org_id IS NOT NULL AND location_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM organizations o WHERE o.id = programs.partner_org_id)
        AND EXISTS (SELECT 1 FROM locations l WHERE l.id = programs.location_id)`,
  ).all() as { organization_id: string; location_id: string }[];
  const insertOrganizationLocation = db.prepare(
    `INSERT INTO organization_locations
      (id, organization_id, location_id, relationship_type, active, created_at, updated_at)
     SELECT ?, ?, ?, 'program_site', 1, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM organization_locations
         WHERE organization_id = ? AND location_id = ? AND relationship_type = 'program_site'
      )`,
  );
  for (const site of programSites) {
    insertOrganizationLocation.run(
      `orl-${randomUUID()}`,
      site.organization_id,
      site.location_id,
      now,
      now,
      site.organization_id,
      site.location_id,
    );
  }

  db.prepare(
    `UPDATE programs
        SET request_key = NULLIF(trim(request_key), ''),
            source_type = lower(NULLIF(trim(source_type), '')),
            source_id = NULLIF(trim(source_id), '')`,
  ).run();
  const duplicateRequestKeys = db.prepare(
    `SELECT request_key FROM programs WHERE request_key IS NOT NULL GROUP BY request_key HAVING COUNT(*) > 1`,
  ).all() as { request_key: string }[];
  for (const group of duplicateRequestKeys) {
    const rows = db.prepare("SELECT * FROM programs WHERE request_key = ? ORDER BY created_at, id").all(group.request_key) as MigrationRow[];
    for (const row of rows.slice(1)) {
      archiveMigrationRow(db, "programs", String(row.id), row, "Cleared duplicate Program idempotency key.", now);
      db.prepare("UPDATE programs SET request_key = NULL, updated_at = ? WHERE id = ?").run(now, row.id);
    }
    recordMigrationConflict(db, "program_request_key", group.request_key, { keptProgramId: rows[0].id, clearedProgramIds: rows.slice(1).map((row) => row.id) }, now);
  }

  const duplicateSources = db.prepare(
    `SELECT source_type, source_id
       FROM programs
      WHERE source_id IS NOT NULL
        AND source_type IN ('inquiry', 'demo_request', 'class', 'class_proposal', 'legacy_class')
      GROUP BY source_type, source_id
     HAVING COUNT(*) > 1`,
  ).all() as { source_type: string; source_id: string }[];
  for (const group of duplicateSources) {
    const rows = db.prepare(
      `SELECT p.*,
              CASE
                WHEN EXISTS (SELECT 1 FROM classes c WHERE c.program_id = p.id AND c.id = p.source_id) THEN 2
                WHEN EXISTS (SELECT 1 FROM classes c WHERE c.program_id = p.id) THEN 1
                ELSE 0
              END AS evidence_rank
         FROM programs p
        WHERE p.source_type = ? AND p.source_id = ?
        ORDER BY evidence_rank DESC, p.created_at, p.id`,
    ).all(group.source_type, group.source_id) as MigrationRow[];
    for (const row of rows.slice(1)) {
      archiveMigrationRow(db, "programs", String(row.id), row, "Retired duplicate one-time source provenance.", now);
      const reconciliationNote = `Migration ${OPERATING_SYSTEM_V2_MIGRATION_ID}: duplicate ${group.source_type} source ${group.source_id} retained on Program ${String(rows[0].id)}.`;
      db.prepare(
        `UPDATE programs
            SET source_type = 'manual', source_id = NULL,
                notes = CASE WHEN notes IS NULL OR trim(notes) = '' THEN ? ELSE notes || char(10) || ? END,
                updated_at = ?
          WHERE id = ?`,
      ).run(reconciliationNote, reconciliationNote, now, row.id);
    }
    recordMigrationConflict(db, "program_source", `${group.source_type}:${group.source_id}`, { keptProgramId: rows[0].id, retiredProgramIds: rows.slice(1).map((row) => row.id) }, now);
  }
}

function reconcileV2Delivery(db: DatabaseSync, now: number) {
  const orphanAssignment = db.prepare(
    `SELECT ci.id, ci.class_id, ci.instructor_id
       FROM class_instructors ci
      WHERE NOT EXISTS (SELECT 1 FROM classes c WHERE c.id = ci.class_id)
         OR NOT EXISTS (SELECT 1 FROM instructors i WHERE i.id = ci.instructor_id)
      LIMIT 1`,
  ).get() as MigrationRow | undefined;
  if (orphanAssignment) {
    throw new Error(`[bow:v2] Class assignment requires manual relationship repair: ${JSON.stringify(orphanAssignment)}`);
  }

  const duplicateAssignments = db.prepare(
    `SELECT class_id, instructor_id
       FROM class_instructors
      WHERE removed_at IS NULL
      GROUP BY class_id, instructor_id
     HAVING COUNT(*) > 1`,
  ).all() as { class_id: string; instructor_id: string }[];
  for (const group of duplicateAssignments) {
    const rows = db.prepare(
      `SELECT ci.*,
              CASE WHEN c.lead_instructor_id = ci.instructor_id THEN 1 ELSE 0 END AS mirrors_lead,
              CASE WHEN ci.decision_id IS NOT NULL AND ci.decision_fingerprint IS NOT NULL THEN 1 ELSE 0 END AS has_decision
        FROM class_instructors ci
         JOIN classes c ON c.id = ci.class_id
        WHERE ci.class_id = ? AND ci.instructor_id = ?
          AND ci.removed_at IS NULL
        ORDER BY mirrors_lead DESC,
                 CASE WHEN ci.role = 'lead' THEN 1 ELSE 0 END DESC,
                 has_decision DESC,
                 COALESCE(ci.decision_at, 0) DESC,
                 ci.added_at DESC,
                 ci.id`,
    ).all(group.class_id, group.instructor_id) as MigrationRow[];
    for (const row of rows.slice(1)) {
      archiveMigrationRow(db, "class_instructors", String(row.id), row, "Removed duplicate Class instructor assignment.", now);
      db.prepare("DELETE FROM class_instructors WHERE id = ?").run(row.id);
    }
    recordMigrationConflict(db, "class_instructor", `${group.class_id}:${group.instructor_id}`, { keptAssignmentId: rows[0].id, removedAssignmentIds: rows.slice(1).map((row) => row.id) }, now);
  }

  const defaultDecisionMaker = db.prepare(
    "SELECT id FROM users WHERE role = 'admin' ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, COALESCE(created_at, 0), id LIMIT 1",
  ).get() as { id: string } | undefined;
  if (!defaultDecisionMaker && db.prepare("SELECT 1 FROM class_instructors LIMIT 1").get()) {
    throw new Error("[bow:v2] Class assignments exist without an administrator available to own migrated decisions.");
  }

  const classRows = db.prepare("SELECT * FROM classes ORDER BY id").all() as MigrationRow[];
  for (const cls of classRows) {
    const assignments = db.prepare(
      "SELECT * FROM class_instructors WHERE class_id = ? AND removed_at IS NULL ORDER BY COALESCE(decision_at, added_at) DESC, added_at DESC, id",
    ).all(cls.id) as MigrationRow[];
    const mirrored = assignments.find((assignment) => assignment.instructor_id === cls.lead_instructor_id);
    const chosenLead = mirrored ?? assignments.find((assignment) => assignment.role === "lead") ?? null;
    for (const assignment of assignments) {
      const desiredRole = chosenLead && assignment.id === chosenLead.id ? "lead" : "additional";
      if (assignment.role !== desiredRole) {
        archiveMigrationRow(db, "class_instructors", String(assignment.id), assignment, "Reconciled the single Class lead invariant.", now);
        const assignedActorExists = assignment.assigned_by
          ? db.prepare("SELECT 1 FROM users WHERE id = ?").get(assignment.assigned_by)
          : null;
        const actorId = assignedActorExists ? String(assignment.assigned_by) : defaultDecisionMaker!.id;
        const reason = "Migration reconciled the single Class lead invariant.";
        const decision = recordClassStaffingDecision(db, {
          classId: String(cls.id),
          instructorId: String(assignment.instructor_id),
          assignmentId: String(assignment.id),
          action: "role_changed",
          role: desiredRole,
          reason,
          actorUserId: actorId,
          decidedAt: now,
          programId: cls.program_id ? String(cls.program_id) : null,
        });
        db.prepare(
          `UPDATE class_instructors
              SET role = ?, decision_reason = ?, assigned_by = ?, decision_id = ?,
                  decision_fingerprint = ?, decision_at = ?
            WHERE id = ?`,
        ).run(desiredRole, reason, actorId, decision.decisionId, decision.fingerprint, now, assignment.id);
      }
    }
    const desiredLeadId = chosenLead?.instructor_id ?? null;
    if (cls.lead_instructor_id !== desiredLeadId) {
      archiveMigrationRow(db, "classes", String(cls.id), cls, "Synchronized the Class lead mirror with assignment history.", now);
      db.prepare("UPDATE classes SET lead_instructor_id = ?, updated_at = ? WHERE id = ?").run(desiredLeadId, now, cls.id);
    }
  }

  const assignmentsWithoutDecisions = db.prepare(
    `SELECT ci.*, c.program_id
       FROM class_instructors ci
       JOIN classes c ON c.id = ci.class_id
      WHERE ci.decision_id IS NULL OR ci.decision_fingerprint IS NULL OR ci.decision_at IS NULL
         OR NOT EXISTS (SELECT 1 FROM operational_decisions od WHERE od.id = ci.decision_id)
      ORDER BY ci.class_id, ci.id`,
  ).all() as MigrationRow[];
  for (const assignment of assignmentsWithoutDecisions) {
    const actorExists = assignment.assigned_by
      ? db.prepare("SELECT 1 FROM users WHERE id = ?").get(assignment.assigned_by)
      : null;
    const actorId = actorExists ? String(assignment.assigned_by) : defaultDecisionMaker!.id;
    const decidedAt = Number(assignment.decision_at ?? assignment.added_at ?? now);
    const reason = String(assignment.decision_reason ?? "").trim() || "Migrated from an existing Class staffing assignment.";
    archiveMigrationRow(db, "class_instructors", String(assignment.id), assignment, "Backfilled immutable staffing decision provenance.", now);
    const decision = recordClassStaffingDecision(db, {
      classId: String(assignment.class_id),
      instructorId: String(assignment.instructor_id),
      assignmentId: String(assignment.id),
      action: "assigned",
      role: assignment.role === "lead" ? "lead" : "additional",
      reason,
      actorUserId: actorId,
      decidedAt,
      programId: assignment.program_id ? String(assignment.program_id) : null,
    });
    db.prepare(
      `UPDATE class_instructors
          SET decision_reason = ?, assigned_by = COALESCE(assigned_by, ?), decision_id = ?,
              decision_fingerprint = ?, decision_at = ?
        WHERE id = ?`,
    ).run(reason, actorId, decision.decisionId, decision.fingerprint, decidedAt, assignment.id);
  }

  const orphanEnrollment = db.prepare(
    `SELECT ce.id, ce.class_id, ce.student_id
       FROM class_enrollments ce
      WHERE NOT EXISTS (SELECT 1 FROM classes c WHERE c.id = ce.class_id)
         OR NOT EXISTS (SELECT 1 FROM students s WHERE s.id = ce.student_id)
      LIMIT 1`,
  ).get() as MigrationRow | undefined;
  if (orphanEnrollment) {
    throw new Error(`[bow:v2] Class enrollment requires manual relationship repair: ${JSON.stringify(orphanEnrollment)}`);
  }
  const duplicateEnrollments = db.prepare(
    `SELECT class_id, student_id
       FROM class_enrollments
      GROUP BY class_id, student_id
     HAVING COUNT(*) > 1`,
  ).all() as { class_id: string; student_id: string }[];
  for (const group of duplicateEnrollments) {
    const rows = db.prepare(
      `SELECT *,
              CASE status WHEN 'enrolled' THEN 3 WHEN 'waitlisted' THEN 2 WHEN 'withdrawn' THEN 1 ELSE 0 END AS status_rank,
              CASE WHEN status = 'withdrawn' THEN COALESCE(withdrawn_at, enrolled_at) ELSE enrolled_at END AS effective_at
         FROM class_enrollments
        WHERE class_id = ? AND student_id = ?
        ORDER BY effective_at DESC, status_rank DESC, id`,
    ).all(group.class_id, group.student_id) as MigrationRow[];
    const canonical = rows[0];
    for (const row of rows.slice(1)) {
      archiveMigrationRow(db, "class_enrollments", String(row.id), row, "Removed duplicate Class enrollment after preserving the latest effective event.", now);
      db.prepare("UPDATE class_session_roster SET enrollment_id = ? WHERE enrollment_id = ?").run(canonical.id, row.id);
      db.prepare("DELETE FROM class_enrollments WHERE id = ?").run(row.id);
    }
    recordMigrationConflict(db, "class_enrollment", `${group.class_id}:${group.student_id}`, { keptEnrollmentId: canonical.id, removedEnrollmentIds: rows.slice(1).map((row) => row.id) }, now);
  }

  const orphanSession = db.prepare(
    `SELECT cs.id, cs.class_id FROM class_sessions cs
      WHERE NOT EXISTS (SELECT 1 FROM classes c WHERE c.id = cs.class_id)
      LIMIT 1`,
  ).get() as MigrationRow | undefined;
  if (orphanSession) {
    throw new Error(`[bow:v2] Class session requires manual relationship repair: ${JSON.stringify(orphanSession)}`);
  }
  const duplicateSessions = db.prepare(
    `SELECT class_id, session_date
       FROM class_sessions
      GROUP BY class_id, session_date
     HAVING COUNT(*) > 1`,
  ).all() as { class_id: string; session_date: number }[];
  for (const group of duplicateSessions) {
    const rows = db.prepare(
      "SELECT * FROM class_sessions WHERE class_id = ? AND session_date = ? ORDER BY created_at, id",
    ).all(group.class_id, group.session_date) as MigrationRow[];
    const canonical = rows[0];
    for (const row of rows.slice(1)) {
      archiveMigrationRow(db, "class_sessions", String(row.id), row, "Merged duplicate Class session occurrence.", now);
      db.prepare("UPDATE class_session_roster SET session_id = ? WHERE session_id = ?").run(canonical.id, row.id);
      db.prepare("UPDATE class_session_reports SET session_id = ? WHERE session_id = ?").run(canonical.id, row.id);
      db.prepare("UPDATE attendance_records SET session_id = ? WHERE session_id = ?").run(canonical.id, row.id);
      db.prepare("UPDATE instructor_feedback SET session_id = ? WHERE session_id = ?").run(canonical.id, row.id);
      db.prepare("UPDATE tasks SET entity_id = ? WHERE entity_id = ? AND entity_type IN ('session', 'class_session')").run(canonical.id, row.id);
      db.prepare("UPDATE crm_activity SET entity_id = ? WHERE entity_id = ? AND entity_type IN ('session', 'class_session')").run(canonical.id, row.id);
      db.prepare("DELETE FROM class_sessions WHERE id = ?").run(row.id);
    }
    recordMigrationConflict(db, "class_session", `${group.class_id}:${group.session_date}`, { keptSessionId: canonical.id, mergedSessionIds: rows.slice(1).map((row) => row.id) }, now);
  }

  const orphanRoster = db.prepare(
    `SELECT csr.id, csr.session_id, csr.student_id
       FROM class_session_roster csr
      WHERE NOT EXISTS (SELECT 1 FROM class_sessions cs WHERE cs.id = csr.session_id)
         OR NOT EXISTS (SELECT 1 FROM students s WHERE s.id = csr.student_id)
      LIMIT 1`,
  ).get() as MigrationRow | undefined;
  if (orphanRoster) {
    throw new Error(`[bow:v2] Session roster requires manual relationship repair: ${JSON.stringify(orphanRoster)}`);
  }
  const mismatchedRoster = db.prepare(
    `SELECT csr.*, cs.class_id
       FROM class_session_roster csr
       JOIN class_sessions cs ON cs.id = csr.session_id
      WHERE csr.enrollment_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM class_enrollments ce
           WHERE ce.id = csr.enrollment_id AND ce.class_id = cs.class_id AND ce.student_id = csr.student_id
        )`,
  ).all() as MigrationRow[];
  for (const rosterRow of mismatchedRoster) {
    const matchingEnrollment = db.prepare(
      `SELECT id FROM class_enrollments
        WHERE class_id = ? AND student_id = ?
        ORDER BY CASE WHEN status = 'enrolled' THEN 0 WHEN status = 'waitlisted' THEN 1 ELSE 2 END,
                 CASE WHEN status = 'withdrawn' THEN COALESCE(withdrawn_at, enrolled_at) ELSE enrolled_at END DESC,
                 id
        LIMIT 1`,
    ).get(rosterRow.class_id, rosterRow.student_id) as { id: string } | undefined;
    archiveMigrationRow(db, "class_session_roster", String(rosterRow.id), rosterRow, "Corrected mismatched session-roster enrollment reference.", now);
    db.prepare("UPDATE class_session_roster SET enrollment_id = ? WHERE id = ?").run(matchingEnrollment?.id ?? null, rosterRow.id);
  }

  const duplicateRosterRows = db.prepare(
    `SELECT session_id, student_id
       FROM class_session_roster
      GROUP BY session_id, student_id
     HAVING COUNT(*) > 1`,
  ).all() as { session_id: string; student_id: string }[];
  for (const group of duplicateRosterRows) {
    const rows = db.prepare(
      `SELECT csr.*,
              CASE WHEN EXISTS (
                SELECT 1 FROM class_sessions cs JOIN class_enrollments ce
                  ON ce.class_id = cs.class_id AND ce.student_id = csr.student_id
                 WHERE cs.id = csr.session_id AND ce.id = csr.enrollment_id
              ) THEN 1 ELSE 0 END AS valid_enrollment
         FROM class_session_roster csr
        WHERE csr.session_id = ? AND csr.student_id = ?
        ORDER BY valid_enrollment DESC, csr.rostered_at, csr.id`,
    ).all(group.session_id, group.student_id) as MigrationRow[];
    for (const row of rows.slice(1)) {
      archiveMigrationRow(db, "class_session_roster", String(row.id), row, "Removed duplicate locked-roster row.", now);
      db.prepare("DELETE FROM class_session_roster WHERE id = ?").run(row.id);
    }
    recordMigrationConflict(db, "session_roster", `${group.session_id}:${group.student_id}`, { keptRosterId: rows[0].id, removedRosterIds: rows.slice(1).map((row) => row.id) }, now);
  }

  const orphanReport = db.prepare(
    `SELECT r.id, r.session_id FROM class_session_reports r
      WHERE NOT EXISTS (SELECT 1 FROM class_sessions s WHERE s.id = r.session_id)
      LIMIT 1`,
  ).get() as MigrationRow | undefined;
  if (orphanReport) {
    throw new Error(`[bow:v2] Session report requires manual relationship repair: ${JSON.stringify(orphanReport)}`);
  }
  const duplicateReports = db.prepare(
    `SELECT session_id FROM class_session_reports GROUP BY session_id HAVING COUNT(*) > 1`,
  ).all() as { session_id: string }[];
  for (const group of duplicateReports) {
    const rows = db.prepare(
      `SELECT * FROM class_session_reports WHERE session_id = ?
        ORDER BY completed DESC, reported_at DESC, id`,
    ).all(group.session_id) as MigrationRow[];
    const finalized = rows.filter((row) => row.completed === 1);
    const finalizedPayloads = new Set(
      finalized.map((row) => JSON.stringify([row.notes, row.flagged, row.flag_reason, row.reported_by])),
    );
    if (finalized.length > 1 && finalizedPayloads.size > 1) {
      throw new Error(
        `[bow:v2] Session ${group.session_id} has conflicting finalized reports (${finalized.map((row) => String(row.id)).join(", ")}). Human quality/safeguarding review is required before migration.`,
      );
    }
    for (const row of rows.slice(1)) {
      archiveMigrationRow(db, "class_session_reports", String(row.id), row, "Removed duplicate session report.", now);
      db.prepare("DELETE FROM class_session_reports WHERE id = ?").run(row.id);
    }
    recordMigrationConflict(
      db,
      "session_report",
      group.session_id,
      {
        keptReportId: rows[0].id,
        removedReportIds: rows.slice(1).map((row) => row.id),
        conflictingFinalReports: false,
      },
      now,
    );
  }

  const orphanAttendance = db.prepare(
    `SELECT ar.id, ar.session_id, ar.student_id
       FROM attendance_records ar
      WHERE NOT EXISTS (SELECT 1 FROM class_sessions cs WHERE cs.id = ar.session_id)
         OR NOT EXISTS (SELECT 1 FROM students s WHERE s.id = ar.student_id)
      LIMIT 1`,
  ).get() as MigrationRow | undefined;
  if (orphanAttendance) {
    throw new Error(`[bow:v2] Attendance requires manual relationship repair: ${JSON.stringify(orphanAttendance)}`);
  }
  const duplicateAttendance = db.prepare(
    `SELECT session_id, student_id
       FROM attendance_records
      GROUP BY session_id, student_id
     HAVING COUNT(*) > 1`,
  ).all() as { session_id: string; student_id: string }[];
  for (const group of duplicateAttendance) {
    const rows = db.prepare(
      `SELECT * FROM attendance_records WHERE session_id = ? AND student_id = ?
        ORDER BY recorded_at DESC, id`,
    ).all(group.session_id, group.student_id) as MigrationRow[];
    for (const row of rows.slice(1)) {
      archiveMigrationRow(db, "attendance_records", String(row.id), row, "Removed duplicate attendance event after retaining the latest record.", now);
      db.prepare("DELETE FROM attendance_records WHERE id = ?").run(row.id);
    }
    recordMigrationConflict(
      db,
      "attendance",
      `${group.session_id}:${group.student_id}`,
      {
        keptAttendanceId: rows[0].id,
        removedAttendanceIds: rows.slice(1).map((row) => row.id),
        valuesDiffered: new Set(rows.map((row) => JSON.stringify([row.present, row.note]))).size > 1,
      },
      now,
    );
  }

  db.prepare(
    `INSERT INTO class_session_roster (id, session_id, student_id, enrollment_id, rostered_at)
     SELECT 'csr-' || lower(hex(randomblob(16))), ar.session_id, ar.student_id,
            (
              SELECT ce.id
                FROM class_sessions cs2
                JOIN class_enrollments ce ON ce.class_id = cs2.class_id AND ce.student_id = ar.student_id
               WHERE cs2.id = ar.session_id
               ORDER BY CASE WHEN ce.status = 'enrolled' THEN 0 WHEN ce.status = 'waitlisted' THEN 1 ELSE 2 END,
                        CASE WHEN ce.status = 'withdrawn' THEN COALESCE(ce.withdrawn_at, ce.enrolled_at) ELSE ce.enrolled_at END DESC,
                        ce.id
               LIMIT 1
            ),
            COALESCE(ar.recorded_at, ?)
       FROM attendance_records ar
      WHERE NOT EXISTS (
        SELECT 1 FROM class_session_roster csr
         WHERE csr.session_id = ar.session_id AND csr.student_id = ar.student_id
      )`,
  ).run(now);

  const sessionCount = (db.prepare("SELECT COUNT(*) AS n FROM sessions").get() as { n: number }).n;
  const feedSessionCount = (db.prepare("SELECT COUNT(*) AS n FROM feed_sessions").get() as { n: number }).n;
  if (sessionCount > 0 || feedSessionCount > 0) {
    recordMigrationConflict(
      db,
      "session_credentials",
      "legacy-session-purge",
      { appSessionCount: sessionCount, feedSessionCount, action: "purged_without_archiving_secrets" },
      now,
    );
    db.prepare("DELETE FROM sessions").run();
    db.prepare("DELETE FROM feed_sessions").run();
  }
}

function verifyStaffingDecisionEvidence(db: DatabaseSync) {
  const staffingDecisions = db.prepare(
    `SELECT id, entity_type, entity_id, decision_type, decision, reason, fingerprint,
            decided_by_user_id, decided_at, metadata
       FROM operational_decisions
      WHERE decision_type = 'instructor_assignment'`,
  ).all() as MigrationRow[];
  const parsedById = new Map<string, { row: MigrationRow; decision: MigrationRow; metadata: MigrationRow }>();

  for (const row of staffingDecisions) {
    let decision: MigrationRow;
    let metadata: MigrationRow;
    try {
      decision = JSON.parse(String(row.decision)) as MigrationRow;
      metadata = JSON.parse(String(row.metadata ?? "{}")) as MigrationRow;
    } catch {
      throw new Error(`[bow:v2] Staffing decision ${String(row.id)} has invalid structured evidence.`);
    }
    if (
      row.entity_type !== "class"
      || !["assigned", "role_changed", "removed"].includes(String(decision.action))
      || !["lead", "additional"].includes(String(decision.role))
      || !decision.instructorId
      || !metadata.assignmentId
    ) {
      throw new Error(`[bow:v2] Staffing decision ${String(row.id)} is incomplete.`);
    }
    if (
      metadata.recommendationFingerprint != null
      && !/^[0-9a-f]{64}$/.test(String(metadata.recommendationFingerprint))
    ) {
      throw new Error(`[bow:v2] Staffing decision ${String(row.id)} has an invalid recommendation fingerprint.`);
    }
    const expectedFingerprint = classStaffingDecisionFingerprint({
      decisionId: String(row.id),
      classId: String(row.entity_id),
      instructorId: String(decision.instructorId),
      assignmentId: String(metadata.assignmentId),
      action: String(decision.action) as "assigned" | "role_changed" | "removed",
      role: String(decision.role) as "lead" | "additional",
      reason: String(row.reason),
      actorUserId: String(row.decided_by_user_id),
      decidedAt: Number(row.decided_at),
      programId: metadata.programId ? String(metadata.programId) : null,
      recommendationFingerprint: metadata.recommendationFingerprint
        ? String(metadata.recommendationFingerprint)
        : null,
    });
    if (expectedFingerprint !== row.fingerprint) {
      throw new Error(`[bow:v2] Staffing decision ${String(row.id)} fingerprint does not match its evidence.`);
    }
    parsedById.set(String(row.id), { row, decision, metadata });
  }

  const assignments = db.prepare(
    `SELECT ci.id, ci.class_id, ci.instructor_id, ci.role, ci.decision_reason,
            ci.assigned_by, ci.decision_id, ci.decision_fingerprint, ci.decision_at,
            ci.added_at, ci.removed_at, ci.removal_reason, ci.removed_by,
            ci.removal_decision_id, ci.removal_decision_fingerprint,
            c.program_id
       FROM class_instructors ci
       JOIN classes c ON c.id = ci.class_id
      ORDER BY ci.class_id, ci.id`,
  ).all() as MigrationRow[];
  for (const assignment of assignments) {
    const evidence = parsedById.get(String(assignment.decision_id ?? ""));
    if (!evidence) {
      throw new Error(`[bow:v2] Class assignment ${String(assignment.id)} has no readable current staffing decision.`);
    }
    const { row, decision, metadata } = evidence;
    const programBindingIsWrong = metadata.programId
      && String(metadata.programId) !== String(assignment.program_id ?? "");
    if (
      String(row.entity_id) !== String(assignment.class_id)
      || String(metadata.assignmentId) !== String(assignment.id)
      || String(decision.instructorId) !== String(assignment.instructor_id)
      || String(decision.role) !== String(assignment.role)
      || decision.action === "removed"
      || String(row.fingerprint) !== String(assignment.decision_fingerprint)
      || Number(row.decided_at) !== Number(assignment.decision_at)
      || String(row.decided_by_user_id) !== String(assignment.assigned_by)
      || String(row.reason) !== String(assignment.decision_reason)
      || programBindingIsWrong
    ) {
      throw new Error(`[bow:v2] Class assignment ${String(assignment.id)} is not bound to its current immutable staffing evidence.`);
    }

    const removalFields = [
      assignment.removal_reason,
      assignment.removed_by,
      assignment.removal_decision_id,
      assignment.removal_decision_fingerprint,
    ];
    if (assignment.removed_at == null) {
      if (removalFields.some((value) => value != null)) {
        throw new Error(`[bow:v4] Current Class assignment ${String(assignment.id)} contains removal metadata.`);
      }
      continue;
    }
    if (
      Number(assignment.removed_at) < Number(assignment.added_at)
      || removalFields.some((value) => value == null || String(value).trim() === "")
    ) {
      throw new Error(`[bow:v4] Closed Class assignment ${String(assignment.id)} has incomplete removal evidence.`);
    }
    const removalEvidence = parsedById.get(String(assignment.removal_decision_id));
    if (!removalEvidence) {
      throw new Error(`[bow:v4] Closed Class assignment ${String(assignment.id)} has no readable removal decision.`);
    }
    const removalProgramBindingIsWrong = removalEvidence.metadata.programId
      && String(removalEvidence.metadata.programId) !== String(assignment.program_id ?? "");
    if (
      String(removalEvidence.row.entity_id) !== String(assignment.class_id)
      || String(removalEvidence.metadata.assignmentId) !== String(assignment.id)
      || String(removalEvidence.decision.instructorId) !== String(assignment.instructor_id)
      || String(removalEvidence.decision.role) !== String(assignment.role)
      || removalEvidence.decision.action !== "removed"
      || String(removalEvidence.row.fingerprint) !== String(assignment.removal_decision_fingerprint)
      || Number(removalEvidence.row.decided_at) !== Number(assignment.removed_at)
      || String(removalEvidence.row.decided_by_user_id) !== String(assignment.removed_by)
      || String(removalEvidence.row.reason) !== String(assignment.removal_reason)
      || removalProgramBindingIsWrong
    ) {
      throw new Error(`[bow:v4] Class assignment ${String(assignment.id)} is not bound to its immutable removal evidence.`);
    }
  }
}

function normalizeSchemaSql(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/["`\[\]]/g, "").replace(/\s+/g, "");
}

function verifyV2DatabaseProtections(db: DatabaseSync) {
  const expectedIndexes: [string, string, 0 | 1, string][] = [
    ["ux_v2_users_normalized_email", "users", 1, "ON users(lower(trim(email)))"],
    ["ux_v2_invitations_token_hash", "invitations", 1, "ON invitations(token_hash) WHERE token_hash IS NOT NULL"],
    ["ux_v2_invitations_pending_email", "invitations", 1, "ON invitations(lower(trim(email))) WHERE status = 'pending'"],
    ["ux_v2_profile_consent_slug", "profile_sharing_consents", 1, "ON profile_sharing_consents(public_slug)"],
    ["ux_v2_profile_consent_active_student", "profile_sharing_consents", 1, "ON profile_sharing_consents(student_user_id) WHERE revoked_at IS NULL"],
    ["ux_v2_people_user", "people", 1, "ON people(user_id) WHERE user_id IS NOT NULL"],
    ["ux_v2_students_user", "students", 1, "ON students(user_id) WHERE user_id IS NOT NULL"],
    ["ux_v2_students_person", "students", 1, "ON students(person_id) WHERE person_id IS NOT NULL"],
    ["ux_v2_regions_normalized_name", "operating_regions", 1, "ON operating_regions(lower(trim(name)))"],
    ["ux_v2_organization_people_relationship", "organization_people", 1, "ON organization_people(organization_id, person_id, relationship_type)"],
    ["ux_v2_organization_locations_relationship", "organization_locations", 1, "ON organization_locations(organization_id, location_id, relationship_type)"],
    ["ux_v2_programs_request_key", "programs", 1, "ON programs(request_key) WHERE request_key IS NOT NULL"],
    ["ux_v2_programs_one_time_source", "programs", 1, "ON programs(source_type, source_id) WHERE source_id IS NOT NULL AND source_type IN ('inquiry', 'demo_request', 'class', 'class_proposal', 'legacy_class')"],
    ["ux_v4_class_instructors_current_pair", "class_instructors", 1, "ON class_instructors(class_id, instructor_id) WHERE removed_at IS NULL"],
    ["ux_v4_class_instructors_current_lead", "class_instructors", 1, "ON class_instructors(class_id) WHERE role = 'lead' AND removed_at IS NULL"],
    ["idx_v4_class_instructors_history", "class_instructors", 0, "ON class_instructors(class_id, instructor_id, added_at, removed_at)"],
    ["ux_v2_class_enrollments_pair", "class_enrollments", 1, "ON class_enrollments(class_id, student_id)"],
    ["ux_v2_class_sessions_occurrence", "class_sessions", 1, "ON class_sessions(class_id, session_date)"],
    ["ux_v2_class_session_roster_pair", "class_session_roster", 1, "ON class_session_roster(session_id, student_id)"],
    ["ux_v2_class_session_reports_session", "class_session_reports", 1, "ON class_session_reports(session_id)"],
    ["ux_v2_attendance_records_pair", "attendance_records", 1, "ON attendance_records(session_id, student_id)"],
    ["idx_v2_locations_region", "locations", 0, "ON locations(region_id, stage)"],
    ["idx_v2_locations_parent", "locations", 0, "ON locations(parent_location_id)"],
    ["idx_v2_operational_decisions_entity", "operational_decisions", 0, "ON operational_decisions(entity_type, entity_id, decided_at, id)"],
    ["idx_v2_operational_decisions_fingerprint", "operational_decisions", 0, "ON operational_decisions(fingerprint)"],
    ["idx_v2_class_status_events_timeline", "class_status_events", 0, "ON class_status_events(class_id, created_at, id)"],
  ];
  for (const [indexName, tableName, unique, definition] of expectedIndexes) {
    const row = db.prepare(
      "SELECT tbl_name, sql FROM sqlite_master WHERE type = 'index' AND name = ?",
    ).get(indexName) as { tbl_name: string; sql: string | null } | undefined;
    const listed = (db.prepare(`PRAGMA index_list(${tableName})`).all() as { name: string; unique: number }[])
      .find((candidate) => candidate.name === indexName);
    if (
      !row
      || row.tbl_name !== tableName
      || !listed
      || listed.unique !== unique
      || !normalizeSchemaSql(row.sql).includes(normalizeSchemaSql(definition))
    ) {
      throw new Error(`[bow:v2] Required index ${indexName} has a missing or incorrect definition.`);
    }
  }

  const expectedTriggers: [string, string, string[]][] = [
    ["trg_v2_operational_decisions_no_update", "operational_decisions", ["BEFORE UPDATE ON operational_decisions", "RAISE(ABORT, 'Operational decisions are immutable')"]],
    ["trg_v2_operational_decisions_no_delete", "operational_decisions", ["BEFORE DELETE ON operational_decisions", "RAISE(ABORT, 'Operational decisions are immutable')"]],
    ["trg_v2_class_status_events_no_update", "class_status_events", ["BEFORE UPDATE ON class_status_events", "RAISE(ABORT, 'Class status events are immutable')"]],
    ["trg_v2_class_status_events_no_delete", "class_status_events", ["BEFORE DELETE ON class_status_events", "RAISE(ABORT, 'Class status events are immutable')"]],
    ["trg_v2_final_report_no_update", "class_session_reports", ["BEFORE UPDATE ON class_session_reports", "WHEN OLD.completed = 1", "RAISE(ABORT, 'Finalized session reports are immutable')"]],
    ["trg_v2_final_report_no_delete", "class_session_reports", ["BEFORE DELETE ON class_session_reports", "WHEN OLD.completed = 1", "RAISE(ABORT, 'Finalized session reports are immutable')"]],
  ];
  for (const [triggerName, tableName, fragments] of expectedTriggers) {
    const row = db.prepare(
      "SELECT tbl_name, sql FROM sqlite_master WHERE type = 'trigger' AND name = ?",
    ).get(triggerName) as { tbl_name: string; sql: string | null } | undefined;
    const normalizedSql = normalizeSchemaSql(row?.sql);
    if (
      !row
      || row.tbl_name !== tableName
      || fragments.some((fragment) => !normalizedSql.includes(normalizeSchemaSql(fragment)))
    ) {
      throw new Error(`[bow:v2] Required trigger ${triggerName} has a missing or incorrect definition.`);
    }
  }
}

function enforceAndVerifyV2Invariants(db: DatabaseSync, now: number) {
  db.exec(`
    DROP INDEX IF EXISTS ux_v2_users_normalized_email;
    DROP INDEX IF EXISTS ux_v2_invitations_token_hash;
    DROP INDEX IF EXISTS ux_v2_invitations_pending_email;
    DROP INDEX IF EXISTS ux_v2_profile_consent_slug;
    DROP INDEX IF EXISTS ux_v2_profile_consent_active_student;
    DROP INDEX IF EXISTS ux_v2_people_user;
    DROP INDEX IF EXISTS ux_v2_students_user;
    DROP INDEX IF EXISTS ux_v2_students_person;
    DROP INDEX IF EXISTS ux_v2_regions_normalized_name;
    DROP INDEX IF EXISTS ux_v2_organization_people_relationship;
    DROP INDEX IF EXISTS ux_v2_organization_locations_relationship;
    DROP INDEX IF EXISTS ux_v2_programs_request_key;
    DROP INDEX IF EXISTS ux_v2_programs_one_time_source;
    DROP INDEX IF EXISTS ux_v2_class_instructors_pair;
    DROP INDEX IF EXISTS ux_v2_class_instructors_one_lead;
    DROP INDEX IF EXISTS ux_v4_class_instructors_current_pair;
    DROP INDEX IF EXISTS ux_v4_class_instructors_current_lead;
    DROP INDEX IF EXISTS idx_v4_class_instructors_history;
    DROP INDEX IF EXISTS ux_v2_class_enrollments_pair;
    DROP INDEX IF EXISTS ux_v2_class_sessions_occurrence;
    DROP INDEX IF EXISTS ux_v2_class_session_roster_pair;
    DROP INDEX IF EXISTS ux_v2_class_session_reports_session;
    DROP INDEX IF EXISTS ux_v2_attendance_records_pair;
    DROP INDEX IF EXISTS idx_v2_locations_region;
    DROP INDEX IF EXISTS idx_v2_locations_parent;
    DROP INDEX IF EXISTS idx_v2_operational_decisions_entity;
    DROP INDEX IF EXISTS idx_v2_operational_decisions_fingerprint;
    DROP INDEX IF EXISTS idx_v2_class_status_events_timeline;

    CREATE UNIQUE INDEX IF NOT EXISTS ux_v2_users_normalized_email
      ON users(lower(trim(email)));
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v2_invitations_token_hash
      ON invitations(token_hash) WHERE token_hash IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v2_invitations_pending_email
      ON invitations(lower(trim(email))) WHERE status = 'pending';
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v2_profile_consent_slug
      ON profile_sharing_consents(public_slug);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v2_profile_consent_active_student
      ON profile_sharing_consents(student_user_id) WHERE revoked_at IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v2_people_user
      ON people(user_id) WHERE user_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v2_students_user
      ON students(user_id) WHERE user_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v2_students_person
      ON students(person_id) WHERE person_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v2_regions_normalized_name
      ON operating_regions(lower(trim(name)));
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v2_organization_people_relationship
      ON organization_people(organization_id, person_id, relationship_type);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v2_organization_locations_relationship
      ON organization_locations(organization_id, location_id, relationship_type);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v2_programs_request_key
      ON programs(request_key) WHERE request_key IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v2_programs_one_time_source
      ON programs(source_type, source_id)
      WHERE source_id IS NOT NULL
        AND source_type IN ('inquiry', 'demo_request', 'class', 'class_proposal', 'legacy_class');
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v4_class_instructors_current_pair
      ON class_instructors(class_id, instructor_id) WHERE removed_at IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v4_class_instructors_current_lead
      ON class_instructors(class_id) WHERE role = 'lead' AND removed_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_v4_class_instructors_history
      ON class_instructors(class_id, instructor_id, added_at, removed_at);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v2_class_enrollments_pair
      ON class_enrollments(class_id, student_id);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v2_class_sessions_occurrence
      ON class_sessions(class_id, session_date);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v2_class_session_roster_pair
      ON class_session_roster(session_id, student_id);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v2_class_session_reports_session
      ON class_session_reports(session_id);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_v2_attendance_records_pair
      ON attendance_records(session_id, student_id);

    CREATE INDEX IF NOT EXISTS idx_v2_locations_region ON locations(region_id, stage);
    CREATE INDEX IF NOT EXISTS idx_v2_locations_parent ON locations(parent_location_id);
    CREATE INDEX IF NOT EXISTS idx_v2_operational_decisions_entity
      ON operational_decisions(entity_type, entity_id, decided_at, id);
    CREATE INDEX IF NOT EXISTS idx_v2_operational_decisions_fingerprint
      ON operational_decisions(fingerprint);
    CREATE INDEX IF NOT EXISTS idx_v2_class_status_events_timeline
      ON class_status_events(class_id, created_at, id);

    DROP TRIGGER IF EXISTS trg_v2_operational_decisions_no_update;
    CREATE TRIGGER trg_v2_operational_decisions_no_update
    BEFORE UPDATE ON operational_decisions
    BEGIN
      SELECT RAISE(ABORT, 'Operational decisions are immutable');
    END;
    DROP TRIGGER IF EXISTS trg_v2_operational_decisions_no_delete;
    CREATE TRIGGER trg_v2_operational_decisions_no_delete
    BEFORE DELETE ON operational_decisions
    BEGIN
      SELECT RAISE(ABORT, 'Operational decisions are immutable');
    END;

    DROP TRIGGER IF EXISTS trg_v2_class_status_events_no_update;
    CREATE TRIGGER trg_v2_class_status_events_no_update
    BEFORE UPDATE ON class_status_events
    BEGIN
      SELECT RAISE(ABORT, 'Class status events are immutable');
    END;
    DROP TRIGGER IF EXISTS trg_v2_class_status_events_no_delete;
    CREATE TRIGGER trg_v2_class_status_events_no_delete
    BEFORE DELETE ON class_status_events
    BEGIN
      SELECT RAISE(ABORT, 'Class status events are immutable');
    END;
    DROP TRIGGER IF EXISTS trg_v2_class_status_events_valid_insert;
    CREATE TRIGGER trg_v2_class_status_events_valid_insert
    BEFORE INSERT ON class_status_events
    WHEN NEW.from_status = NEW.to_status
      OR trim(COALESCE(NEW.source, '')) = ''
      OR NOT (
        (NEW.from_status = 'planning' AND NEW.to_status IN ('staffing','paused','cancelled'))
        OR (NEW.from_status = 'staffing' AND NEW.to_status IN ('ready_to_launch','paused','cancelled'))
        OR (NEW.from_status = 'ready_to_launch' AND NEW.to_status IN ('active','staffing','paused','cancelled'))
        OR (NEW.from_status = 'active' AND NEW.to_status IN ('paused','completed'))
        OR (NEW.from_status = 'paused' AND NEW.to_status IN ('staffing','active','completed','cancelled'))
      )
    BEGIN
      SELECT RAISE(ABORT, 'Invalid Class status event');
    END;

    DROP TRIGGER IF EXISTS trg_v2_final_report_no_update;
    CREATE TRIGGER trg_v2_final_report_no_update
    BEFORE UPDATE ON class_session_reports
    WHEN OLD.completed = 1
    BEGIN
      SELECT RAISE(ABORT, 'Finalized session reports are immutable');
    END;
    DROP TRIGGER IF EXISTS trg_v2_final_report_no_delete;
    CREATE TRIGGER trg_v2_final_report_no_delete
    BEFORE DELETE ON class_session_reports
    WHEN OLD.completed = 1
    BEGIN
      SELECT RAISE(ABORT, 'Finalized session reports are immutable');
    END;
  `);

  const assertions: [string, string][] = [
    ["duplicate normalized user emails remain", `SELECT lower(trim(email)) AS email, COUNT(*) AS n FROM users GROUP BY lower(trim(email)) HAVING n > 1 LIMIT 1`],
    ["invalid user emails remain", `SELECT id, email FROM users WHERE trim(email) = '' OR instr(email, '@') <= 1 LIMIT 1`],
    ["invitation without a valid credential hash remains", `SELECT id FROM invitations WHERE token_hash IS NULL OR length(token_hash) <> 64 OR token_hash GLOB '*[^0-9a-f]*' LIMIT 1`],
    ["duplicate invitation hashes remain", `SELECT token_hash, COUNT(*) AS n FROM invitations WHERE token_hash IS NOT NULL GROUP BY token_hash HAVING n > 1 LIMIT 1`],
    ["duplicate pending invitation emails remain", `SELECT lower(trim(email)) AS email, COUNT(*) AS n FROM invitations WHERE status = 'pending' GROUP BY lower(trim(email)) HAVING n > 1 LIMIT 1`],
    ["unsafe pending invitation remains", `SELECT i.id FROM invitations i WHERE i.status = 'pending' AND (i.expires_at IS NULL OR i.expires_at <= ${now} OR i.token_hash IS NULL OR length(i.token_hash) <> 64 OR i.token_hash GLOB '*[^0-9a-f]*' OR NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = i.org_id AND o.status = 'active') OR (i.cohort_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM cohorts c WHERE c.id = i.cohort_id AND c.status IN ('active', 'enrolling')))) LIMIT 1`],
    ["invalid active public-profile consent remains", `SELECT c.id FROM profile_sharing_consents c WHERE c.revoked_at IS NULL AND (c.guardian_verified_at IS NULL OR c.expires_at IS NULL OR c.expires_at <= ${now} OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.student_user_id AND u.role = 'student' AND u.status = 'active' AND u.deletion_requested = 0 AND EXISTS (SELECT 1 FROM organizations o WHERE o.id = u.org_id AND o.status = 'active') AND EXISTS (SELECT 1 FROM enrollments e WHERE e.user_id = u.id AND e.enroll = 'active'))) LIMIT 1`],
    ["duplicate active consent remains", `SELECT student_user_id, COUNT(*) AS n FROM profile_sharing_consents WHERE revoked_at IS NULL GROUP BY student_user_id HAVING n > 1 LIMIT 1`],
    ["duplicate Person user link remains", `SELECT user_id, COUNT(*) AS n FROM people WHERE user_id IS NOT NULL GROUP BY user_id HAVING n > 1 LIMIT 1`],
    ["orphan Person user link remains", `SELECT p.id, p.user_id FROM people p WHERE p.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = p.user_id) LIMIT 1`],
    ["duplicate Student user link remains", `SELECT user_id, COUNT(*) AS n FROM students WHERE user_id IS NOT NULL GROUP BY user_id HAVING n > 1 LIMIT 1`],
    ["duplicate Student Person link remains", `SELECT person_id, COUNT(*) AS n FROM students WHERE person_id IS NOT NULL GROUP BY person_id HAVING n > 1 LIMIT 1`],
    ["orphan Student identity link remains", `SELECT s.id FROM students s WHERE (s.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = s.user_id)) OR (s.person_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM people p WHERE p.id = s.person_id)) LIMIT 1`],
    ["Location without valid region remains", `SELECT l.id, l.region_id FROM locations l WHERE l.region_id IS NULL OR NOT EXISTS (SELECT 1 FROM operating_regions r WHERE r.id = l.region_id) LIMIT 1`],
    ["invalid Location parent remains", `SELECT l.id, l.parent_location_id FROM locations l WHERE l.parent_location_id IS NOT NULL AND (l.parent_location_id = l.id OR NOT EXISTS (SELECT 1 FROM locations p WHERE p.id = l.parent_location_id)) LIMIT 1`],
    ["orphan organization-Person relationship remains", `SELECT op.id FROM organization_people op WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = op.organization_id) OR NOT EXISTS (SELECT 1 FROM people p WHERE p.id = op.person_id) LIMIT 1`],
    ["orphan organization-Location relationship remains", `SELECT ol.id FROM organization_locations ol WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = ol.organization_id) OR NOT EXISTS (SELECT 1 FROM locations l WHERE l.id = ol.location_id) LIMIT 1`],
    ["orphan Class Program remains", `SELECT c.id, c.program_id FROM classes c WHERE c.program_id IS NULL OR NOT EXISTS (SELECT 1 FROM programs p WHERE p.id = c.program_id) LIMIT 1`],
    ["dangling Program relationship remains", `SELECT p.id FROM programs p WHERE (p.partner_org_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = p.partner_org_id)) OR (p.primary_contact_person_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM people pe WHERE pe.id = p.primary_contact_person_id)) OR (p.location_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM locations l WHERE l.id = p.location_id)) OR (p.curriculum_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM curricula cr WHERE cr.id = p.curriculum_id)) OR (p.owner_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = p.owner_user_id)) OR (p.parent_program_id IS NOT NULL AND (p.parent_program_id = p.id OR NOT EXISTS (SELECT 1 FROM programs parent WHERE parent.id = p.parent_program_id))) LIMIT 1`],
    ["duplicate Program request key remains", `SELECT request_key, COUNT(*) AS n FROM programs WHERE request_key IS NOT NULL GROUP BY request_key HAVING n > 1 LIMIT 1`],
    ["duplicate Program one-time source remains", `SELECT source_type, source_id, COUNT(*) AS n FROM programs WHERE source_id IS NOT NULL AND source_type IN ('inquiry', 'demo_request', 'class', 'class_proposal', 'legacy_class') GROUP BY source_type, source_id HAVING n > 1 LIMIT 1`],
    ["orphan Class assignment remains", `SELECT ci.id FROM class_instructors ci WHERE NOT EXISTS (SELECT 1 FROM classes c WHERE c.id = ci.class_id) OR NOT EXISTS (SELECT 1 FROM instructors i WHERE i.id = ci.instructor_id) LIMIT 1`],
    ["dangling Class relationship remains", `SELECT c.id FROM classes c WHERE NOT EXISTS (SELECT 1 FROM curricula cr WHERE cr.id = c.curriculum_id) OR (c.partner_org_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = c.partner_org_id)) OR (c.location_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM locations l WHERE l.id = c.location_id)) OR (c.lead_instructor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM instructors i WHERE i.id = c.lead_instructor_id)) LIMIT 1`],
    ["duplicate current Class assignment remains", `SELECT class_id, instructor_id, COUNT(*) AS n FROM class_instructors WHERE removed_at IS NULL GROUP BY class_id, instructor_id HAVING n > 1 LIMIT 1`],
    ["multiple current Class leads remain", `SELECT class_id, COUNT(*) AS n FROM class_instructors WHERE role = 'lead' AND removed_at IS NULL GROUP BY class_id HAVING n > 1 LIMIT 1`],
    ["Class lead mirror disagreement remains", `SELECT c.id, c.lead_instructor_id FROM classes c WHERE (c.lead_instructor_id IS NULL AND EXISTS (SELECT 1 FROM class_instructors ci WHERE ci.class_id = c.id AND ci.role = 'lead' AND ci.removed_at IS NULL)) OR (c.lead_instructor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM class_instructors ci WHERE ci.class_id = c.id AND ci.instructor_id = c.lead_instructor_id AND ci.role = 'lead' AND ci.removed_at IS NULL)) LIMIT 1`],
    ["Class assignment decision provenance is incomplete", `SELECT ci.id FROM class_instructors ci WHERE ci.decision_id IS NULL OR ci.decision_fingerprint IS NULL OR ci.decision_at IS NULL OR NOT EXISTS (SELECT 1 FROM operational_decisions od WHERE od.id = ci.decision_id AND od.fingerprint = ci.decision_fingerprint) LIMIT 1`],
    ["operational decision actor is missing", `SELECT od.id FROM operational_decisions od WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = od.decided_by_user_id) LIMIT 1`],
    ["duplicate Class enrollment remains", `SELECT class_id, student_id, COUNT(*) AS n FROM class_enrollments GROUP BY class_id, student_id HAVING n > 1 LIMIT 1`],
    ["orphan Class enrollment remains", `SELECT ce.id FROM class_enrollments ce WHERE NOT EXISTS (SELECT 1 FROM classes c WHERE c.id = ce.class_id) OR NOT EXISTS (SELECT 1 FROM students s WHERE s.id = ce.student_id) LIMIT 1`],
    ["duplicate Class session remains", `SELECT class_id, session_date, COUNT(*) AS n FROM class_sessions GROUP BY class_id, session_date HAVING n > 1 LIMIT 1`],
    ["orphan Class session remains", `SELECT cs.id FROM class_sessions cs WHERE NOT EXISTS (SELECT 1 FROM classes c WHERE c.id = cs.class_id) LIMIT 1`],
    ["duplicate session-roster row remains", `SELECT session_id, student_id, COUNT(*) AS n FROM class_session_roster GROUP BY session_id, student_id HAVING n > 1 LIMIT 1`],
    ["orphan session-roster row remains", `SELECT csr.id FROM class_session_roster csr WHERE NOT EXISTS (SELECT 1 FROM class_sessions cs WHERE cs.id = csr.session_id) OR NOT EXISTS (SELECT 1 FROM students s WHERE s.id = csr.student_id) LIMIT 1`],
    ["mismatched roster enrollment remains", `SELECT csr.id FROM class_session_roster csr JOIN class_sessions cs ON cs.id = csr.session_id WHERE csr.enrollment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM class_enrollments ce WHERE ce.id = csr.enrollment_id AND ce.class_id = cs.class_id AND ce.student_id = csr.student_id) LIMIT 1`],
    ["duplicate session report remains", `SELECT session_id, COUNT(*) AS n FROM class_session_reports GROUP BY session_id HAVING n > 1 LIMIT 1`],
    ["orphan session report remains", `SELECT r.id FROM class_session_reports r WHERE NOT EXISTS (SELECT 1 FROM class_sessions s WHERE s.id = r.session_id) LIMIT 1`],
    ["session report author is missing", `SELECT r.id FROM class_session_reports r WHERE r.reported_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r.reported_by) LIMIT 1`],
    ["duplicate attendance record remains", `SELECT session_id, student_id, COUNT(*) AS n FROM attendance_records GROUP BY session_id, student_id HAVING n > 1 LIMIT 1`],
    ["orphan attendance remains", `SELECT ar.id FROM attendance_records ar WHERE NOT EXISTS (SELECT 1 FROM class_sessions cs WHERE cs.id = ar.session_id) OR NOT EXISTS (SELECT 1 FROM students s WHERE s.id = ar.student_id) LIMIT 1`],
    ["attendance without locked roster remains", `SELECT ar.id FROM attendance_records ar WHERE NOT EXISTS (SELECT 1 FROM class_session_roster csr WHERE csr.session_id = ar.session_id AND csr.student_id = ar.student_id) LIMIT 1`],
    ["attendance recorder is missing", `SELECT ar.id FROM attendance_records ar WHERE ar.recorded_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ar.recorded_by) LIMIT 1`],
    ["instructor feedback session is missing", `SELECT f.id FROM instructor_feedback f WHERE f.session_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM class_sessions s WHERE s.id = f.session_id) LIMIT 1`],
    ["Class status event relationship is missing", `SELECT e.id FROM class_status_events e WHERE NOT EXISTS (SELECT 1 FROM classes c WHERE c.id = e.class_id) OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = e.actor_user_id) LIMIT 1`],
    ["Class status event contains an invalid transition", `SELECT e.id FROM class_status_events e WHERE e.from_status = e.to_status OR trim(e.source) = '' OR NOT ((e.from_status = 'planning' AND e.to_status IN ('staffing','paused','cancelled')) OR (e.from_status = 'staffing' AND e.to_status IN ('ready_to_launch','paused','cancelled')) OR (e.from_status = 'ready_to_launch' AND e.to_status IN ('active','staffing','paused','cancelled')) OR (e.from_status = 'active' AND e.to_status IN ('paused','completed')) OR (e.from_status = 'paused' AND e.to_status IN ('staffing','active','completed','cancelled'))) LIMIT 1`],
  ];
  for (const [label, sql] of assertions) assertNoMigrationRows(db, label, sql);

  assertNoMigrationRows(
    db,
    "Location hierarchy cycle remains",
    `WITH RECURSIVE lineage(origin_id, current_id, depth) AS (
       SELECT id, parent_location_id, 1
         FROM locations
        WHERE parent_location_id IS NOT NULL
       UNION ALL
       SELECT lineage.origin_id, parent.parent_location_id, lineage.depth + 1
         FROM lineage
         JOIN locations parent ON parent.id = lineage.current_id
        WHERE lineage.current_id IS NOT NULL
          AND lineage.depth <= (SELECT COUNT(*) + 1 FROM locations)
     )
     SELECT origin_id, current_id
       FROM lineage
      WHERE current_id = origin_id
      LIMIT 1`,
  );
  assertNoMigrationRows(
    db,
    "Program parent cycle remains",
    `WITH RECURSIVE lineage(origin_id, current_id, depth) AS (
       SELECT id, parent_program_id, 1
         FROM programs
        WHERE parent_program_id IS NOT NULL
       UNION ALL
       SELECT lineage.origin_id, parent.parent_program_id, lineage.depth + 1
         FROM lineage
         JOIN programs parent ON parent.id = lineage.current_id
        WHERE lineage.current_id IS NOT NULL
          AND lineage.depth <= (SELECT COUNT(*) + 1 FROM programs)
     )
     SELECT origin_id, current_id
       FROM lineage
      WHERE current_id = origin_id
      LIMIT 1`,
  );

  verifyStaffingDecisionEvidence(db);

  const integrity = db.prepare("PRAGMA integrity_check").all() as { integrity_check: string }[];
  if (integrity.length !== 1 || integrity[0].integrity_check !== "ok") {
    throw new Error(`[bow:v2] SQLite integrity check failed: ${JSON.stringify(integrity)}`);
  }
  const foreignKeyErrors = db.prepare("PRAGMA foreign_key_check").all() as MigrationRow[];
  if (foreignKeyErrors.length > 0) {
    throw new Error(`[bow:v2] SQLite foreign-key check failed: ${JSON.stringify(foreignKeyErrors.slice(0, 10))}`);
  }

  verifyV2DatabaseProtections(db);
}

function verifyOperatingSystemV2RuntimeHealth(db: DatabaseSync) {
  const now = Date.now();
  const checks: [string, string][] = [
    ["A normalized user identity is duplicated", `SELECT lower(trim(email)) AS email FROM users GROUP BY lower(trim(email)) HAVING COUNT(*) > 1 LIMIT 1`],
    ["A discussion post lacks immutable organization scope", `SELECT p.id FROM discussion_posts p WHERE p.org_id IS NULL OR trim(p.org_id) = '' OR NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = p.org_id) LIMIT 1`],
    ["An invitation credential is malformed", `SELECT id FROM invitations WHERE token_hash IS NULL OR length(token_hash) <> 64 OR token_hash GLOB '*[^0-9a-f]*' LIMIT 1`],
    ["A pending invitation points outside an active organization or cohort", `SELECT i.id FROM invitations i WHERE i.status = 'pending' AND (i.expires_at IS NULL OR i.expires_at <= ${now} OR NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = i.org_id AND o.status = 'active') OR (i.cohort_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM cohorts c WHERE c.id = i.cohort_id AND c.status IN ('active','enrolling')))) LIMIT 1`],
    ["An active public profile belongs to an unavailable student or organization", `SELECT c.id FROM profile_sharing_consents c WHERE c.revoked_at IS NULL AND (c.guardian_verified_at IS NULL OR c.expires_at IS NULL OR c.expires_at <= ${now} OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.student_user_id AND u.role = 'student' AND u.status = 'active' AND u.deletion_requested = 0 AND EXISTS (SELECT 1 FROM organizations o WHERE o.id = u.org_id AND o.status = 'active') AND EXISTS (SELECT 1 FROM enrollments e WHERE e.user_id = u.id AND e.enroll = 'active'))) LIMIT 1`],
    ["A Class exists outside a Program", `SELECT c.id FROM classes c WHERE c.program_id IS NULL OR NOT EXISTS (SELECT 1 FROM programs p WHERE p.id = c.program_id) LIMIT 1`],
    ["A Class assignment references a missing record", `SELECT ci.id FROM class_instructors ci WHERE NOT EXISTS (SELECT 1 FROM classes c WHERE c.id = ci.class_id) OR NOT EXISTS (SELECT 1 FROM instructors i WHERE i.id = ci.instructor_id) LIMIT 1`],
    ["A Class lead mirror is inconsistent", `SELECT c.id FROM classes c WHERE (c.lead_instructor_id IS NULL AND EXISTS (SELECT 1 FROM class_instructors ci WHERE ci.class_id = c.id AND ci.role = 'lead' AND ci.removed_at IS NULL)) OR (c.lead_instructor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM class_instructors ci WHERE ci.class_id = c.id AND ci.instructor_id = c.lead_instructor_id AND ci.role = 'lead' AND ci.removed_at IS NULL)) LIMIT 1`],
    ["A staffing assignment lacks immutable provenance", `SELECT ci.id FROM class_instructors ci WHERE ci.decision_id IS NULL OR ci.decision_fingerprint IS NULL OR ci.decision_at IS NULL OR NOT EXISTS (SELECT 1 FROM operational_decisions od WHERE od.id = ci.decision_id AND od.fingerprint = ci.decision_fingerprint) LIMIT 1`],
    ["An operational decision actor is missing", `SELECT od.id FROM operational_decisions od WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = od.decided_by_user_id) LIMIT 1`],
    ["A Location lacks an operating region", `SELECT l.id FROM locations l WHERE l.region_id IS NULL OR NOT EXISTS (SELECT 1 FROM operating_regions r WHERE r.id = l.region_id) LIMIT 1`],
    ["A Location region label disagrees with its canonical region", `SELECT l.id FROM locations l JOIN operating_regions r ON r.id = l.region_id WHERE l.region IS NOT NULL AND trim(l.region) <> '' AND lower(trim(l.region)) <> lower(trim(r.name)) LIMIT 1`],
    ["Attendance exists outside its locked roster", `SELECT ar.id FROM attendance_records ar WHERE NOT EXISTS (SELECT 1 FROM class_session_roster csr WHERE csr.session_id = ar.session_id AND csr.student_id = ar.student_id) LIMIT 1`],
    ["A Program contact is missing from active organization topology", `SELECT p.id FROM programs p WHERE p.partner_org_id IS NOT NULL AND p.primary_contact_person_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM organization_people op WHERE op.organization_id = p.partner_org_id AND op.person_id = p.primary_contact_person_id AND op.relationship_type = 'program_contact' AND op.active = 1) LIMIT 1`],
    ["A Program site is missing from active organization topology", `SELECT p.id FROM programs p WHERE p.partner_org_id IS NOT NULL AND p.location_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM organization_locations ol WHERE ol.organization_id = p.partner_org_id AND ol.location_id = p.location_id AND ol.relationship_type = 'program_site' AND ol.active = 1) LIMIT 1`],
    ["A Class status event references a missing record", `SELECT e.id FROM class_status_events e WHERE NOT EXISTS (SELECT 1 FROM classes c WHERE c.id = e.class_id) OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = e.actor_user_id) LIMIT 1`],
    ["A Class status event has an invalid transition", `SELECT e.id FROM class_status_events e WHERE e.from_status = e.to_status OR trim(e.source) = '' OR NOT ((e.from_status = 'planning' AND e.to_status IN ('staffing','paused','cancelled')) OR (e.from_status = 'staffing' AND e.to_status IN ('ready_to_launch','paused','cancelled')) OR (e.from_status = 'ready_to_launch' AND e.to_status IN ('active','staffing','paused','cancelled')) OR (e.from_status = 'active' AND e.to_status IN ('paused','completed')) OR (e.from_status = 'paused' AND e.to_status IN ('staffing','active','completed','cancelled'))) LIMIT 1`],
  ];
  for (const [label, sql] of checks) {
    const row = db.prepare(sql).get() as MigrationRow | undefined;
    if (row) throw new Error(`[bow] Operating-system invariant failed after startup: ${label}. ${JSON.stringify(row)}`);
  }
  assertNoMigrationRows(
    db,
    "Location hierarchy cycle exists after startup",
    `WITH RECURSIVE lineage(origin_id, current_id, depth) AS (
       SELECT id, parent_location_id, 1 FROM locations WHERE parent_location_id IS NOT NULL
       UNION ALL
       SELECT lineage.origin_id, parent.parent_location_id, lineage.depth + 1
         FROM lineage JOIN locations parent ON parent.id = lineage.current_id
        WHERE lineage.current_id IS NOT NULL AND lineage.depth <= (SELECT COUNT(*) + 1 FROM locations)
     ) SELECT origin_id FROM lineage WHERE current_id = origin_id LIMIT 1`,
  );
  assertNoMigrationRows(
    db,
    "Program hierarchy cycle exists after startup",
    `WITH RECURSIVE lineage(origin_id, current_id, depth) AS (
       SELECT id, parent_program_id, 1 FROM programs WHERE parent_program_id IS NOT NULL
       UNION ALL
       SELECT lineage.origin_id, parent.parent_program_id, lineage.depth + 1
         FROM lineage JOIN programs parent ON parent.id = lineage.current_id
        WHERE lineage.current_id IS NOT NULL AND lineage.depth <= (SELECT COUNT(*) + 1 FROM programs)
     ) SELECT origin_id FROM lineage WHERE current_id = origin_id LIMIT 1`,
  );
  verifyStaffingDecisionEvidence(db);
  verifyV2DatabaseProtections(db);
}

function runOperatingSystemV2Migration(db: DatabaseSync) {
  if (db.prepare("SELECT 1 FROM schema_migrations WHERE id = ?").get(OPERATING_SYSTEM_V2_MIGRATION_ID)) {
    // Expiration is ordinary lifecycle progression, not database corruption.
    // Normalize time-based state before the strict health audit so a process
    // can never be bricked merely because an invitation or consent reached
    // its deadline while the application was idle.
    const now = Date.now();
    db.exec("SAVEPOINT bow_os_v2_runtime_lifecycle");
    try {
      db.prepare(
        "UPDATE invitations SET status = 'expired' WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at <= ?",
      ).run(now);
      db.prepare(
        `UPDATE profile_sharing_consents
            SET revoked_at = expires_at, discoverable = 0
          WHERE revoked_at IS NULL AND expires_at IS NOT NULL AND expires_at <= ?`,
      ).run(now);
      db.exec("RELEASE SAVEPOINT bow_os_v2_runtime_lifecycle");
    } catch (error) {
      db.exec("ROLLBACK TO SAVEPOINT bow_os_v2_runtime_lifecycle");
      db.exec("RELEASE SAVEPOINT bow_os_v2_runtime_lifecycle");
      throw error;
    }
    verifyOperatingSystemV2RuntimeHealth(db);
    return;
  }

  db.exec("SAVEPOINT bow_os_v2");
  try {
    const now = Date.now();
    // This legacy index was created before v2 could reconcile request-key
    // collisions. Recreate it under the v2 name only after reconciliation.
    db.exec("DROP INDEX IF EXISTS idx_programs_request_key");
    reconcileV2Identity(db, now);
    // V1 may already be marked on a database that later received an orphan
    // Class. Re-running the idempotent evidence backfill closes that gap.
    backfillOperatingSystem(db);
    reconcileV2NetworkAndPrograms(db, now);
    reconcileV2Delivery(db, now);
    enforceAndVerifyV2Invariants(db, now);
    db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(OPERATING_SYSTEM_V2_MIGRATION_ID, now);
    db.exec("RELEASE SAVEPOINT bow_os_v2");
  } catch (error) {
    try {
      db.exec("ROLLBACK TO SAVEPOINT bow_os_v2");
      db.exec("RELEASE SAVEPOINT bow_os_v2");
    } catch {
      // Preserve the reconciliation error that explains the unsafe row.
    }
    throw error;
  }
}

const CLASS_EVENT_TRANSITION_PREDICATE = `
  (NEW.from_status = 'planning' AND NEW.to_status IN ('staffing','paused','cancelled'))
  OR (NEW.from_status = 'staffing' AND NEW.to_status IN ('ready_to_launch','paused','cancelled'))
  OR (NEW.from_status = 'ready_to_launch' AND NEW.to_status IN ('active','staffing','paused','cancelled'))
  OR (NEW.from_status = 'active' AND NEW.to_status IN ('paused','completed'))
  OR (NEW.from_status = 'paused' AND NEW.to_status IN ('staffing','active','completed','cancelled'))
`;

function verifyClassEventInsertProtection(db: DatabaseSync) {
  const row = db.prepare(
    "SELECT tbl_name, sql FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_v2_class_status_events_valid_insert'",
  ).get() as { tbl_name: string; sql: string | null } | undefined;
  const normalized = normalizeSchemaSql(row?.sql);
  if (
    !row
    || row.tbl_name !== "class_status_events"
    || !normalized.includes(normalizeSchemaSql("BEFORE INSERT ON class_status_events"))
    || !normalized.includes(normalizeSchemaSql("RAISE(ABORT, 'Invalid Class status event')"))
    || !normalized.includes(normalizeSchemaSql(CLASS_EVENT_TRANSITION_PREDICATE))
  ) {
    throw new Error("[bow:v3] Required Class status-event insert protection is missing or incorrect.");
  }
}

function runOperatingSystemV3Migration(db: DatabaseSync) {
  const migrationId = "2026-07-18-bow-operating-system-v3";
  if (db.prepare("SELECT 1 FROM schema_migrations WHERE id = ?").get(migrationId)) {
    verifyClassEventInsertProtection(db);
    return;
  }

  db.exec("SAVEPOINT bow_os_v3");
  try {
    assertNoMigrationRows(
      db,
      "Class status event has an invalid transition before v3 protection",
      `SELECT e.id FROM class_status_events e WHERE e.from_status = e.to_status OR trim(e.source) = '' OR NOT ((e.from_status = 'planning' AND e.to_status IN ('staffing','paused','cancelled')) OR (e.from_status = 'staffing' AND e.to_status IN ('ready_to_launch','paused','cancelled')) OR (e.from_status = 'ready_to_launch' AND e.to_status IN ('active','staffing','paused','cancelled')) OR (e.from_status = 'active' AND e.to_status IN ('paused','completed')) OR (e.from_status = 'paused' AND e.to_status IN ('staffing','active','completed','cancelled'))) LIMIT 1`,
    );
    db.exec(`
      DROP TRIGGER IF EXISTS trg_v2_class_status_events_valid_insert;
      CREATE TRIGGER trg_v2_class_status_events_valid_insert
      BEFORE INSERT ON class_status_events
      WHEN NEW.from_status = NEW.to_status
        OR trim(COALESCE(NEW.source, '')) = ''
        OR NOT (${CLASS_EVENT_TRANSITION_PREDICATE})
      BEGIN
        SELECT RAISE(ABORT, 'Invalid Class status event');
      END;
    `);
    verifyClassEventInsertProtection(db);
    db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(migrationId, Date.now());
    db.exec("RELEASE SAVEPOINT bow_os_v3");
  } catch (error) {
    db.exec("ROLLBACK TO SAVEPOINT bow_os_v3");
    db.exec("RELEASE SAVEPOINT bow_os_v3");
    throw error;
  }
}

const OPERATING_SYSTEM_V4_STAFFING_MIGRATION_ID = "2026-07-19-bow-operating-system-v4-staffing-history";

const INVALID_STAFFING_REMOVAL_METADATA_PREDICATE = `
  (NEW.removed_at IS NULL AND (
    NEW.removal_reason IS NOT NULL
    OR NEW.removed_by IS NOT NULL
    OR NEW.removal_decision_id IS NOT NULL
    OR NEW.removal_decision_fingerprint IS NOT NULL
  ))
  OR (NEW.removed_at IS NOT NULL AND (
    NEW.removed_at < NEW.added_at
    OR trim(COALESCE(NEW.removal_reason, '')) = ''
    OR trim(COALESCE(NEW.removed_by, '')) = ''
    OR trim(COALESCE(NEW.removal_decision_id, '')) = ''
    OR trim(COALESCE(NEW.removal_decision_fingerprint, '')) = ''
    OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.removed_by)
    OR NOT EXISTS (
      SELECT 1 FROM operational_decisions od
       WHERE od.id = NEW.removal_decision_id
         AND od.fingerprint = NEW.removal_decision_fingerprint
         AND od.entity_type = 'class'
         AND od.entity_id = NEW.class_id
         AND od.decision_type = 'instructor_assignment'
         AND json_extract(od.decision, '$.action') = 'removed'
         AND json_extract(od.decision, '$.instructorId') = NEW.instructor_id
         AND json_extract(od.decision, '$.role') = NEW.role
         AND json_extract(od.metadata, '$.assignmentId') = NEW.id
         AND od.reason = NEW.removal_reason
         AND od.decided_by_user_id = NEW.removed_by
         AND od.decided_at = NEW.removed_at
    )
  ))
`;

function verifyStaffingLifecycleDatabaseProtections(db: DatabaseSync) {
  const requiredColumns = new Set(
    (db.prepare("PRAGMA table_info(class_instructors)").all() as { name: string }[]).map((column) => column.name),
  );
  for (const column of [
    "removed_at",
    "removal_reason",
    "removed_by",
    "removal_decision_id",
    "removal_decision_fingerprint",
  ]) {
    if (!requiredColumns.has(column)) throw new Error(`[bow:v4] Required Class assignment column ${column} is missing.`);
  }

  const expectedIndexes: [string, 0 | 1, string][] = [
    ["ux_v4_class_instructors_current_pair", 1, "ON class_instructors(class_id, instructor_id) WHERE removed_at IS NULL"],
    ["ux_v4_class_instructors_current_lead", 1, "ON class_instructors(class_id) WHERE role = 'lead' AND removed_at IS NULL"],
    ["idx_v4_class_instructors_history", 0, "ON class_instructors(class_id, instructor_id, added_at, removed_at)"],
  ];
  const listedIndexes = db.prepare("PRAGMA index_list(class_instructors)").all() as { name: string; unique: number }[];
  for (const [name, unique, definition] of expectedIndexes) {
    const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?").get(name) as
      | { sql: string | null }
      | undefined;
    const listed = listedIndexes.find((candidate) => candidate.name === name);
    if (!row || !listed || listed.unique !== unique || !normalizeSchemaSql(row.sql).includes(normalizeSchemaSql(definition))) {
      throw new Error(`[bow:v4] Required staffing-history index ${name} is missing or incorrect.`);
    }
  }

  const expectedTriggers: [string, string[]][] = [
    ["trg_v4_class_instructors_valid_insert", [
      "BEFORE INSERT ON class_instructors",
      "NEW.added_at < COALESCE(existing.removed_at, 9223372036854775807)",
      "existing.added_at < COALESCE(NEW.removed_at, 9223372036854775807)",
      "Assignment interval overlaps existing history",
      INVALID_STAFFING_REMOVAL_METADATA_PREDICATE,
    ]],
    ["trg_v4_class_instructors_valid_update", ["BEFORE UPDATE ON class_instructors", "Invalid assignment removal evidence", INVALID_STAFFING_REMOVAL_METADATA_PREDICATE]],
    ["trg_v4_class_instructors_identity_immutable", [
      "BEFORE UPDATE ON class_instructors",
      "NEW.id IS NOT OLD.id",
      "NEW.class_id IS NOT OLD.class_id",
      "NEW.instructor_id IS NOT OLD.instructor_id",
      "NEW.added_at IS NOT OLD.added_at",
      "Assignment identity and start are immutable",
    ]],
    ["trg_v4_class_instructors_removed_immutable", ["BEFORE UPDATE ON class_instructors", "WHEN OLD.removed_at IS NOT NULL", "Closed assignments are immutable"]],
    ["trg_v4_class_instructors_no_delete", ["BEFORE DELETE ON class_instructors", "Assignment history cannot be deleted"]],
  ];
  for (const [name, fragments] of expectedTriggers) {
    const row = db.prepare("SELECT tbl_name, sql FROM sqlite_master WHERE type = 'trigger' AND name = ?").get(name) as
      | { tbl_name: string; sql: string | null }
      | undefined;
    const sql = normalizeSchemaSql(row?.sql);
    if (!row || row.tbl_name !== "class_instructors" || fragments.some((fragment) => !sql.includes(normalizeSchemaSql(fragment)))) {
      throw new Error(`[bow:v4] Required staffing-history trigger ${name} is missing or incorrect.`);
    }
  }
}

function verifyStaffingLifecycleRows(db: DatabaseSync) {
  const malformed = db.prepare(
    `SELECT ci.id
       FROM class_instructors ci
      WHERE (ci.removed_at IS NULL AND (
               ci.removal_reason IS NOT NULL OR ci.removed_by IS NOT NULL
               OR ci.removal_decision_id IS NOT NULL OR ci.removal_decision_fingerprint IS NOT NULL
            ))
         OR (ci.removed_at IS NOT NULL AND (
               ci.removed_at < ci.added_at
               OR trim(COALESCE(ci.removal_reason, '')) = ''
               OR trim(COALESCE(ci.removed_by, '')) = ''
               OR trim(COALESCE(ci.removal_decision_id, '')) = ''
               OR trim(COALESCE(ci.removal_decision_fingerprint, '')) = ''
               OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ci.removed_by)
               OR NOT EXISTS (
                 SELECT 1 FROM operational_decisions od
                  WHERE od.id = ci.removal_decision_id
                    AND od.fingerprint = ci.removal_decision_fingerprint
                    AND od.entity_type = 'class'
                    AND od.entity_id = ci.class_id
                    AND od.decision_type = 'instructor_assignment'
                    AND json_extract(od.decision, '$.action') = 'removed'
                    AND json_extract(od.decision, '$.instructorId') = ci.instructor_id
                    AND json_extract(od.decision, '$.role') = ci.role
                    AND json_extract(od.metadata, '$.assignmentId') = ci.id
                    AND od.reason = ci.removal_reason
                    AND od.decided_by_user_id = ci.removed_by
                    AND od.decided_at = ci.removed_at
               )
            ))
      LIMIT 1`,
  ).get() as { id: string } | undefined;
  if (malformed) throw new Error(`[bow:v4] Class assignment ${malformed.id} has malformed lifecycle evidence.`);

  const overlap = db.prepare(
    `SELECT earlier.id AS earlier_id, later.id AS later_id
       FROM class_instructors earlier
       JOIN class_instructors later
         ON later.class_id = earlier.class_id
        AND later.instructor_id = earlier.instructor_id
        AND later.id > earlier.id
        AND earlier.added_at < COALESCE(later.removed_at, 9223372036854775807)
        AND later.added_at < COALESCE(earlier.removed_at, 9223372036854775807)
      LIMIT 1`,
  ).get() as { earlier_id: string; later_id: string } | undefined;
  if (overlap) {
    throw new Error(`[bow:v4] Class assignment intervals overlap: ${overlap.earlier_id} and ${overlap.later_id}.`);
  }
}

function installStaffingLifecycleDatabaseProtections(db: DatabaseSync) {
  db.exec(`
    DROP INDEX IF EXISTS ux_v2_class_instructors_pair;
    DROP INDEX IF EXISTS ux_v2_class_instructors_one_lead;
    DROP INDEX IF EXISTS ux_v4_class_instructors_current_pair;
    DROP INDEX IF EXISTS ux_v4_class_instructors_current_lead;
    DROP INDEX IF EXISTS idx_v4_class_instructors_history;

    CREATE UNIQUE INDEX ux_v4_class_instructors_current_pair
      ON class_instructors(class_id, instructor_id) WHERE removed_at IS NULL;
    CREATE UNIQUE INDEX ux_v4_class_instructors_current_lead
      ON class_instructors(class_id) WHERE role = 'lead' AND removed_at IS NULL;
    CREATE INDEX idx_v4_class_instructors_history
      ON class_instructors(class_id, instructor_id, added_at, removed_at);

    DROP TRIGGER IF EXISTS trg_v4_class_instructors_valid_insert;
    DROP TRIGGER IF EXISTS trg_v4_class_instructors_valid_update;
    DROP TRIGGER IF EXISTS trg_v4_class_instructors_identity_immutable;
    DROP TRIGGER IF EXISTS trg_v4_class_instructors_removed_immutable;
    DROP TRIGGER IF EXISTS trg_v4_class_instructors_no_delete;

    CREATE TRIGGER trg_v4_class_instructors_valid_insert
    BEFORE INSERT ON class_instructors
    WHEN (${INVALID_STAFFING_REMOVAL_METADATA_PREDICATE})
      OR EXISTS (
        SELECT 1 FROM class_instructors existing
         WHERE existing.class_id = NEW.class_id
           AND existing.instructor_id = NEW.instructor_id
           AND NEW.added_at < COALESCE(existing.removed_at, 9223372036854775807)
           AND existing.added_at < COALESCE(NEW.removed_at, 9223372036854775807)
      )
    BEGIN
      SELECT CASE
        WHEN (${INVALID_STAFFING_REMOVAL_METADATA_PREDICATE})
        THEN RAISE(ABORT, 'Invalid assignment removal evidence')
        ELSE RAISE(ABORT, 'Assignment interval overlaps existing history')
      END;
    END;

    CREATE TRIGGER trg_v4_class_instructors_valid_update
    BEFORE UPDATE ON class_instructors
    WHEN (${INVALID_STAFFING_REMOVAL_METADATA_PREDICATE})
    BEGIN
      SELECT RAISE(ABORT, 'Invalid assignment removal evidence');
    END;

    CREATE TRIGGER trg_v4_class_instructors_identity_immutable
    BEFORE UPDATE ON class_instructors
    WHEN NEW.id IS NOT OLD.id
      OR NEW.class_id IS NOT OLD.class_id
      OR NEW.instructor_id IS NOT OLD.instructor_id
      OR NEW.added_at IS NOT OLD.added_at
    BEGIN
      SELECT RAISE(ABORT, 'Assignment identity and start are immutable');
    END;

    CREATE TRIGGER trg_v4_class_instructors_removed_immutable
    BEFORE UPDATE ON class_instructors
    WHEN OLD.removed_at IS NOT NULL
    BEGIN
      SELECT RAISE(ABORT, 'Closed assignments are immutable');
    END;

    CREATE TRIGGER trg_v4_class_instructors_no_delete
    BEFORE DELETE ON class_instructors
    BEGIN
      SELECT RAISE(ABORT, 'Assignment history cannot be deleted');
    END;
  `);
}

function runOperatingSystemV4StaffingMigration(db: DatabaseSync) {
  if (db.prepare("SELECT 1 FROM schema_migrations WHERE id = ?").get(OPERATING_SYSTEM_V4_STAFFING_MIGRATION_ID)) {
    verifyStaffingLifecycleRows(db);
    verifyStaffingDecisionEvidence(db);
    verifyStaffingLifecycleDatabaseProtections(db);
    return;
  }

  db.exec("SAVEPOINT bow_os_v4_staffing_history");
  try {
    verifyStaffingLifecycleRows(db);
    installStaffingLifecycleDatabaseProtections(db);
    verifyStaffingLifecycleRows(db);
    verifyStaffingDecisionEvidence(db);
    verifyStaffingLifecycleDatabaseProtections(db);
    db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)")
      .run(OPERATING_SYSTEM_V4_STAFFING_MIGRATION_ID, Date.now());
    db.exec("RELEASE SAVEPOINT bow_os_v4_staffing_history");
  } catch (error) {
    db.exec("ROLLBACK TO SAVEPOINT bow_os_v4_staffing_history");
    db.exec("RELEASE SAVEPOINT bow_os_v4_staffing_history");
    throw error;
  }
}

const OPERATING_SYSTEM_V5_DATA_INTEGRITY_MIGRATION_ID =
  "2026-07-18-bow-operating-system-v5-identity-training-integrity";

function assertNoAmbiguousCurrentInstructorDossiers(db: DatabaseSync) {
  const duplicate = db.prepare(
    `SELECT person_id, COUNT(*) AS dossier_count
       FROM instructors
      WHERE person_id IS NOT NULL
        AND stage NOT IN ('rejected', 'inactive')
      GROUP BY person_id
     HAVING COUNT(*) > 1
      ORDER BY person_id
      LIMIT 1`,
  ).get() as { person_id: string; dossier_count: number } | undefined;
  if (!duplicate) return;

  const dossiers = db.prepare(
    `SELECT id, stage, created_at, updated_at
       FROM instructors
      WHERE person_id = ?
        AND stage NOT IN ('rejected', 'inactive')
      ORDER BY created_at, id`,
  ).all(duplicate.person_id) as MigrationRow[];
  throw new Error(
    `[bow:v5] Person ${duplicate.person_id} has multiple current instructor dossiers. `
      + `Reconcile them explicitly before restarting by setting all but one dossier to stage 'rejected' or 'inactive'. `
      + `V5 will not guess which dossier owns hiring, training, staffing, or quality history. `
      + `Conflicting dossiers: ${JSON.stringify(dossiers)}.`,
  );
}

function reconcileV5TrainingSessionEvidence(db: DatabaseSync, now: number) {
  const duplicateRegistrations = db.prepare(
    `SELECT session_id, instructor_id
       FROM training_session_registrations
      GROUP BY session_id, instructor_id
     HAVING COUNT(*) > 1
      ORDER BY session_id, instructor_id`,
  ).all() as { session_id: string; instructor_id: string }[];
  for (const group of duplicateRegistrations) {
    const rows = db.prepare(
      `SELECT *
         FROM training_session_registrations
        WHERE session_id = ? AND instructor_id = ?
        ORDER BY registered_at, id`,
    ).all(group.session_id, group.instructor_id) as MigrationRow[];
    const kept = rows[0];
    const removed = rows.slice(1);
    for (const row of removed) {
      archiveMigrationRow(
        db,
        "training_session_registrations",
        String(row.id),
        row,
        "Removed duplicate training-session registration after retaining the earliest registration.",
        now,
        OPERATING_SYSTEM_V5_DATA_INTEGRITY_MIGRATION_ID,
      );
      const result = db.prepare("DELETE FROM training_session_registrations WHERE id = ?").run(row.id);
      if (result.changes !== 1) {
        throw new Error(`[bow:v5] Could not remove duplicate training registration ${String(row.id)}.`);
      }
    }
    recordMigrationConflict(
      db,
      "training_session_registration",
      `${group.session_id}:${group.instructor_id}`,
      {
        keptRegistrationId: kept.id,
        removedRegistrationIds: removed.map((row) => row.id),
        resolution: "kept_earliest_registered_at_then_lowest_id",
      },
      now,
      OPERATING_SYSTEM_V5_DATA_INTEGRITY_MIGRATION_ID,
    );
  }

  const duplicateAttendance = db.prepare(
    `SELECT session_id, instructor_id
       FROM training_session_attendance
      GROUP BY session_id, instructor_id
     HAVING COUNT(*) > 1
      ORDER BY session_id, instructor_id`,
  ).all() as { session_id: string; instructor_id: string }[];
  for (const group of duplicateAttendance) {
    const rows = db.prepare(
      `SELECT *
         FROM training_session_attendance
        WHERE session_id = ? AND instructor_id = ?
        ORDER BY recorded_at DESC, id`,
    ).all(group.session_id, group.instructor_id) as MigrationRow[];
    const kept = rows[0];
    const removed = rows.slice(1);
    for (const row of removed) {
      archiveMigrationRow(
        db,
        "training_session_attendance",
        String(row.id),
        row,
        "Removed duplicate training-session attendance after retaining the most recently recorded evidence.",
        now,
        OPERATING_SYSTEM_V5_DATA_INTEGRITY_MIGRATION_ID,
      );
      const result = db.prepare("DELETE FROM training_session_attendance WHERE id = ?").run(row.id);
      if (result.changes !== 1) {
        throw new Error(`[bow:v5] Could not remove duplicate training attendance ${String(row.id)}.`);
      }
    }
    recordMigrationConflict(
      db,
      "training_session_attendance",
      `${group.session_id}:${group.instructor_id}`,
      {
        keptAttendanceId: kept.id,
        removedAttendanceIds: removed.map((row) => row.id),
        resolution: "kept_latest_recorded_at_then_lowest_id",
        valuesDiffered: new Set(rows.map((row) => JSON.stringify([row.attended, row.recorded_by]))).size > 1,
      },
      now,
      OPERATING_SYSTEM_V5_DATA_INTEGRITY_MIGRATION_ID,
    );
  }
}

function installV5DataIntegrityProtections(db: DatabaseSync) {
  db.exec(`
    DROP INDEX IF EXISTS ux_v5_instructors_current_person;
    DROP INDEX IF EXISTS ux_v5_training_session_registrations_pair;
    DROP INDEX IF EXISTS ux_v5_training_session_attendance_pair;

    CREATE UNIQUE INDEX ux_v5_instructors_current_person
      ON instructors(person_id)
      WHERE person_id IS NOT NULL AND stage NOT IN ('rejected', 'inactive');
    CREATE UNIQUE INDEX ux_v5_training_session_registrations_pair
      ON training_session_registrations(session_id, instructor_id);
    CREATE UNIQUE INDEX ux_v5_training_session_attendance_pair
      ON training_session_attendance(session_id, instructor_id);
  `);
}

function verifyV5DataIntegrityProtections(db: DatabaseSync) {
  const expectedIndexes: [string, string, string][] = [
    [
      "ux_v5_instructors_current_person",
      "instructors",
      "ON instructors(person_id) WHERE person_id IS NOT NULL AND stage NOT IN ('rejected', 'inactive')",
    ],
    [
      "ux_v5_training_session_registrations_pair",
      "training_session_registrations",
      "ON training_session_registrations(session_id, instructor_id)",
    ],
    [
      "ux_v5_training_session_attendance_pair",
      "training_session_attendance",
      "ON training_session_attendance(session_id, instructor_id)",
    ],
  ];
  for (const [indexName, tableName, definition] of expectedIndexes) {
    const row = db.prepare(
      "SELECT tbl_name, sql FROM sqlite_master WHERE type = 'index' AND name = ?",
    ).get(indexName) as { tbl_name: string; sql: string | null } | undefined;
    const listed = (db.prepare(`PRAGMA index_list(${tableName})`).all() as { name: string; unique: number }[])
      .find((candidate) => candidate.name === indexName);
    if (
      !row
      || row.tbl_name !== tableName
      || !listed
      || listed.unique !== 1
      || !normalizeSchemaSql(row.sql).includes(normalizeSchemaSql(definition))
    ) {
      throw new Error(`[bow:v5] Required unique index ${indexName} is missing or incorrect.`);
    }
  }
}

function verifyOperatingSystemV5RuntimeHealth(db: DatabaseSync) {
  assertNoAmbiguousCurrentInstructorDossiers(db);
  const duplicateRegistration = db.prepare(
    `SELECT session_id, instructor_id
       FROM training_session_registrations
      GROUP BY session_id, instructor_id
     HAVING COUNT(*) > 1
      LIMIT 1`,
  ).get() as MigrationRow | undefined;
  if (duplicateRegistration) {
    throw new Error(
      `[bow:v5] Duplicate training-session registration exists after migration: ${JSON.stringify(duplicateRegistration)}.`,
    );
  }
  const duplicateAttendance = db.prepare(
    `SELECT session_id, instructor_id
       FROM training_session_attendance
      GROUP BY session_id, instructor_id
     HAVING COUNT(*) > 1
      LIMIT 1`,
  ).get() as MigrationRow | undefined;
  if (duplicateAttendance) {
    throw new Error(
      `[bow:v5] Duplicate training-session attendance exists after migration: ${JSON.stringify(duplicateAttendance)}.`,
    );
  }
  verifyV5DataIntegrityProtections(db);
}

function runOperatingSystemV5DataIntegrityMigration(db: DatabaseSync) {
  if (db.prepare("SELECT 1 FROM schema_migrations WHERE id = ?").get(OPERATING_SYSTEM_V5_DATA_INTEGRITY_MIGRATION_ID)) {
    verifyOperatingSystemV5RuntimeHealth(db);
    return;
  }

  // Instructor dossiers can own distinct hiring and quality histories. Unlike
  // duplicate registration evidence, choosing a canonical dossier is not a
  // safe mechanical reconciliation, so stop before V5 writes anything.
  assertNoAmbiguousCurrentInstructorDossiers(db);

  db.exec("SAVEPOINT bow_os_v5_identity_training_integrity");
  try {
    const now = Date.now();
    reconcileV5TrainingSessionEvidence(db, now);
    installV5DataIntegrityProtections(db);
    verifyOperatingSystemV5RuntimeHealth(db);
    db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)")
      .run(OPERATING_SYSTEM_V5_DATA_INTEGRITY_MIGRATION_ID, now);
    db.exec("RELEASE SAVEPOINT bow_os_v5_identity_training_integrity");
  } catch (error) {
    try {
      db.exec("ROLLBACK TO SAVEPOINT bow_os_v5_identity_training_integrity");
      db.exec("RELEASE SAVEPOINT bow_os_v5_identity_training_integrity");
    } catch {
      // Preserve the reconciliation or protection error that identifies the
      // unsafe source row or malformed database evidence.
    }
    throw error;
  }
}

const OPERATING_SYSTEM_V6_SESSION_EVIDENCE_MIGRATION_ID =
  "2026-07-19-bow-operating-system-v6-session-evidence";

const V6_ALLOWED_ATTENDANCE_STATUSES = "'present','absent','late','excused'";

function assertV6SessionEvidenceRows(db: DatabaseSync) {
  const requiredColumns: [string, string[]][] = [
    ["class_sessions", ["timezone"]],
    ["attendance_records", ["status"]],
    ["class_session_reports", ["lesson_id", "lesson_snapshot"]],
  ];
  for (const [tableName, columnNames] of requiredColumns) {
    const columns = new Set(
      (db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[]).map((column) => column.name),
    );
    for (const columnName of columnNames) {
      if (!columns.has(columnName)) {
        throw new Error(`[bow:v6] Required session-evidence column ${tableName}.${columnName} is missing.`);
      }
    }
  }

  const assertions: [string, string][] = [
    [
      "attendance status is invalid or disagrees with its compatibility boolean",
      `SELECT id, status, present
         FROM attendance_records
        WHERE status IS NULL
           OR status NOT IN (${V6_ALLOWED_ATTENDANCE_STATUSES})
           OR present NOT IN (0, 1)
           OR NOT (
             (present = 1 AND status IN ('present','late'))
             OR (present = 0 AND status IN ('absent','excused'))
           )
        LIMIT 1`,
    ],
    [
      "attendance exists outside the locked session roster",
      `SELECT ar.id
         FROM attendance_records ar
        WHERE NOT EXISTS (
          SELECT 1 FROM class_session_roster csr
           WHERE csr.session_id = ar.session_id AND csr.student_id = ar.student_id
        )
        LIMIT 1`,
    ],
    [
      "a session report has an invalid completion or lesson snapshot shape",
      `SELECT id, completed, lesson_id, lesson_snapshot
         FROM class_session_reports
        WHERE completed NOT IN (0, 1)
           OR (lesson_id IS NULL AND lesson_snapshot IS NOT NULL)
           OR (lesson_id IS NOT NULL AND lesson_snapshot IS NULL)
           OR (
             lesson_id IS NOT NULL
             AND (trim(lesson_id) = '' OR trim(lesson_snapshot) = '' OR json_valid(lesson_snapshot) <> 1)
           )
        LIMIT 1`,
    ],
    [
      "a finalized session report lacks a complete nonempty attendance record",
      `SELECT r.id, r.session_id
         FROM class_session_reports r
        WHERE r.completed = 1
          AND (
            NOT EXISTS (SELECT 1 FROM class_session_roster csr WHERE csr.session_id = r.session_id)
            OR EXISTS (
              SELECT 1
                FROM class_session_roster csr
               WHERE csr.session_id = r.session_id
                 AND NOT EXISTS (
                   SELECT 1 FROM attendance_records ar
                    WHERE ar.session_id = csr.session_id AND ar.student_id = csr.student_id
                 )
            )
          )
        LIMIT 1`,
    ],
    [
      "a stored session timezone is blank or too long",
      `SELECT id, timezone
         FROM class_sessions
        WHERE timezone IS NOT NULL AND (trim(timezone) = '' OR length(timezone) > 100)
        LIMIT 1`,
    ],
  ];
  for (const [label, sql] of assertions) {
    const row = db.prepare(sql).get() as MigrationRow | undefined;
    if (row) throw new Error(`[bow:v6] ${label}: ${JSON.stringify(row)}.`);
  }
}

function installV6SessionEvidenceProtections(db: DatabaseSync) {
  db.exec(`
    DROP TRIGGER IF EXISTS trg_v6_class_sessions_timezone_insert;
    CREATE TRIGGER trg_v6_class_sessions_timezone_insert
    BEFORE INSERT ON class_sessions
    WHEN NEW.timezone IS NULL OR trim(NEW.timezone) = '' OR length(NEW.timezone) > 100
    BEGIN
      SELECT RAISE(ABORT, 'New Class sessions require a valid timezone snapshot');
    END;

    DROP TRIGGER IF EXISTS trg_v6_class_sessions_identity_immutable;
    CREATE TRIGGER trg_v6_class_sessions_identity_immutable
    BEFORE UPDATE OF class_id, session_date, timezone ON class_sessions
    WHEN NEW.class_id IS NOT OLD.class_id
      OR NEW.session_date IS NOT OLD.session_date
      OR NEW.timezone IS NOT OLD.timezone
    BEGIN
      SELECT RAISE(ABORT, 'Class session identity is immutable');
    END;

    DROP TRIGGER IF EXISTS trg_v6_class_sessions_guard_delete;
    CREATE TRIGGER trg_v6_class_sessions_guard_delete
    BEFORE DELETE ON class_sessions
    WHEN OLD.session_date <= CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
      OR EXISTS (SELECT 1 FROM class_session_roster csr WHERE csr.session_id = OLD.id)
      OR EXISTS (SELECT 1 FROM attendance_records ar WHERE ar.session_id = OLD.id)
      OR EXISTS (SELECT 1 FROM class_session_reports r WHERE r.session_id = OLD.id)
    BEGIN
      SELECT RAISE(ABORT, 'Started or evidenced Class sessions cannot be deleted');
    END;

    DROP TRIGGER IF EXISTS trg_v6_roster_validate_insert;
    CREATE TRIGGER trg_v6_roster_validate_insert
    BEFORE INSERT ON class_session_roster
    WHEN NOT EXISTS (SELECT 1 FROM class_sessions cs WHERE cs.id = NEW.session_id)
      OR NOT EXISTS (SELECT 1 FROM students s WHERE s.id = NEW.student_id)
      OR (
        NEW.enrollment_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
            FROM class_enrollments ce
            JOIN class_sessions cs ON cs.class_id = ce.class_id
           WHERE cs.id = NEW.session_id AND ce.id = NEW.enrollment_id AND ce.student_id = NEW.student_id
        )
      )
    BEGIN
      SELECT RAISE(ABORT, 'Session roster identity is invalid');
    END;

    DROP TRIGGER IF EXISTS trg_v6_roster_validate_update;
    CREATE TRIGGER trg_v6_roster_validate_update
    BEFORE UPDATE OF session_id, student_id, enrollment_id ON class_session_roster
    WHEN NOT EXISTS (SELECT 1 FROM class_sessions cs WHERE cs.id = NEW.session_id)
      OR NOT EXISTS (SELECT 1 FROM students s WHERE s.id = NEW.student_id)
      OR (
        NEW.enrollment_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
            FROM class_enrollments ce
            JOIN class_sessions cs ON cs.class_id = ce.class_id
           WHERE cs.id = NEW.session_id AND ce.id = NEW.enrollment_id AND ce.student_id = NEW.student_id
        )
      )
    BEGIN
      SELECT RAISE(ABORT, 'Session roster identity is invalid');
    END;

    DROP TRIGGER IF EXISTS trg_v6_roster_lock_insert;
    CREATE TRIGGER trg_v6_roster_lock_insert
    BEFORE INSERT ON class_session_roster
    WHEN EXISTS (
      SELECT 1 FROM class_sessions cs
       WHERE cs.id = NEW.session_id
         AND cs.session_date <= CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
    ) OR EXISTS (
      SELECT 1 FROM class_session_reports r WHERE r.session_id = NEW.session_id AND r.completed = 1
    )
    BEGIN
      SELECT RAISE(ABORT, 'Started or finalized session rosters are immutable');
    END;

    DROP TRIGGER IF EXISTS trg_v6_roster_lock_update;
    CREATE TRIGGER trg_v6_roster_lock_update
    BEFORE UPDATE ON class_session_roster
    WHEN EXISTS (
      SELECT 1 FROM class_sessions cs
       WHERE cs.id IN (OLD.session_id, NEW.session_id)
         AND cs.session_date <= CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
    ) OR EXISTS (
      SELECT 1 FROM class_session_reports r
       WHERE r.session_id IN (OLD.session_id, NEW.session_id) AND r.completed = 1
    )
    BEGIN
      SELECT RAISE(ABORT, 'Started or finalized session rosters are immutable');
    END;

    DROP TRIGGER IF EXISTS trg_v6_roster_lock_delete;
    CREATE TRIGGER trg_v6_roster_lock_delete
    BEFORE DELETE ON class_session_roster
    WHEN EXISTS (
      SELECT 1 FROM class_sessions cs
       WHERE cs.id = OLD.session_id
         AND cs.session_date <= CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
    ) OR EXISTS (
      SELECT 1 FROM class_session_reports r WHERE r.session_id = OLD.session_id AND r.completed = 1
    )
    BEGIN
      SELECT RAISE(ABORT, 'Started or finalized session rosters are immutable');
    END;

    DROP TRIGGER IF EXISTS trg_v6_attendance_validate_insert;
    CREATE TRIGGER trg_v6_attendance_validate_insert
    BEFORE INSERT ON attendance_records
    WHEN NEW.status IS NULL
      OR NEW.status NOT IN (${V6_ALLOWED_ATTENDANCE_STATUSES})
      OR NEW.present NOT IN (0, 1)
      OR NOT (
        (NEW.present = 1 AND NEW.status IN ('present','late'))
        OR (NEW.present = 0 AND NEW.status IN ('absent','excused'))
      )
      OR NOT EXISTS (
        SELECT 1 FROM class_session_roster csr
         WHERE csr.session_id = NEW.session_id AND csr.student_id = NEW.student_id
      )
    BEGIN
      SELECT RAISE(ABORT, 'Attendance must be valid and belong to the locked roster');
    END;

    DROP TRIGGER IF EXISTS trg_v6_attendance_validate_update;
    CREATE TRIGGER trg_v6_attendance_validate_update
    BEFORE UPDATE ON attendance_records
    WHEN NEW.status IS NULL
      OR NEW.status NOT IN (${V6_ALLOWED_ATTENDANCE_STATUSES})
      OR NEW.present NOT IN (0, 1)
      OR NOT (
        (NEW.present = 1 AND NEW.status IN ('present','late'))
        OR (NEW.present = 0 AND NEW.status IN ('absent','excused'))
      )
      OR NOT EXISTS (
        SELECT 1 FROM class_session_roster csr
         WHERE csr.session_id = NEW.session_id AND csr.student_id = NEW.student_id
      )
    BEGIN
      SELECT RAISE(ABORT, 'Attendance must be valid and belong to the locked roster');
    END;

    DROP TRIGGER IF EXISTS trg_v6_attendance_identity_immutable;
    CREATE TRIGGER trg_v6_attendance_identity_immutable
    BEFORE UPDATE OF session_id, student_id ON attendance_records
    WHEN NEW.session_id IS NOT OLD.session_id OR NEW.student_id IS NOT OLD.student_id
    BEGIN
      SELECT RAISE(ABORT, 'Attendance identity is immutable');
    END;

    DROP TRIGGER IF EXISTS trg_v6_final_attendance_no_insert;
    CREATE TRIGGER trg_v6_final_attendance_no_insert
    BEFORE INSERT ON attendance_records
    WHEN EXISTS (
      SELECT 1 FROM class_session_reports r WHERE r.session_id = NEW.session_id AND r.completed = 1
    )
    BEGIN
      SELECT RAISE(ABORT, 'Finalized session attendance is immutable');
    END;

    DROP TRIGGER IF EXISTS trg_v6_final_attendance_no_update;
    CREATE TRIGGER trg_v6_final_attendance_no_update
    BEFORE UPDATE ON attendance_records
    WHEN EXISTS (
      SELECT 1 FROM class_session_reports r
       WHERE r.session_id IN (OLD.session_id, NEW.session_id) AND r.completed = 1
    )
    BEGIN
      SELECT RAISE(ABORT, 'Finalized session attendance is immutable');
    END;

    DROP TRIGGER IF EXISTS trg_v6_final_attendance_no_delete;
    CREATE TRIGGER trg_v6_final_attendance_no_delete
    BEFORE DELETE ON attendance_records
    WHEN EXISTS (
      SELECT 1 FROM class_session_reports r WHERE r.session_id = OLD.session_id AND r.completed = 1
    )
    BEGIN
      SELECT RAISE(ABORT, 'Finalized session attendance is immutable');
    END;

    DROP TRIGGER IF EXISTS trg_v6_report_validate_insert;
    CREATE TRIGGER trg_v6_report_validate_insert
    BEFORE INSERT ON class_session_reports
    WHEN NEW.completed NOT IN (0, 1)
      OR NOT EXISTS (SELECT 1 FROM class_sessions cs WHERE cs.id = NEW.session_id)
      OR (NEW.lesson_id IS NULL AND NEW.lesson_snapshot IS NOT NULL)
      OR (NEW.lesson_id IS NOT NULL AND NEW.lesson_snapshot IS NULL)
      OR (
        NEW.lesson_id IS NOT NULL
        AND (trim(NEW.lesson_id) = '' OR trim(NEW.lesson_snapshot) = '' OR json_valid(NEW.lesson_snapshot) <> 1)
      )
    BEGIN
      SELECT RAISE(ABORT, 'Session report evidence is invalid');
    END;

    DROP TRIGGER IF EXISTS trg_v6_report_validate_update;
    CREATE TRIGGER trg_v6_report_validate_update
    BEFORE UPDATE ON class_session_reports
    WHEN NEW.completed NOT IN (0, 1)
      OR NOT EXISTS (SELECT 1 FROM class_sessions cs WHERE cs.id = NEW.session_id)
      OR (NEW.lesson_id IS NULL AND NEW.lesson_snapshot IS NOT NULL)
      OR (NEW.lesson_id IS NOT NULL AND NEW.lesson_snapshot IS NULL)
      OR (
        NEW.lesson_id IS NOT NULL
        AND (trim(NEW.lesson_id) = '' OR trim(NEW.lesson_snapshot) = '' OR json_valid(NEW.lesson_snapshot) <> 1)
      )
    BEGIN
      SELECT RAISE(ABORT, 'Session report evidence is invalid');
    END;

    DROP TRIGGER IF EXISTS trg_v6_report_identity_immutable;
    CREATE TRIGGER trg_v6_report_identity_immutable
    BEFORE UPDATE OF session_id ON class_session_reports
    WHEN NEW.session_id IS NOT OLD.session_id
    BEGIN
      SELECT RAISE(ABORT, 'Session report identity is immutable');
    END;

    DROP TRIGGER IF EXISTS trg_v6_report_completion_evidence_insert;
    CREATE TRIGGER trg_v6_report_completion_evidence_insert
    BEFORE INSERT ON class_session_reports
    WHEN NEW.completed = 1 AND (
      NOT EXISTS (
        SELECT 1 FROM class_sessions cs
         WHERE cs.id = NEW.session_id
           AND cs.session_date <= CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
      )
      OR NOT EXISTS (SELECT 1 FROM class_session_roster csr WHERE csr.session_id = NEW.session_id)
      OR EXISTS (
        SELECT 1
          FROM class_session_roster csr
         WHERE csr.session_id = NEW.session_id
           AND NOT EXISTS (
             SELECT 1 FROM attendance_records ar
              WHERE ar.session_id = csr.session_id AND ar.student_id = csr.student_id
           )
      )
    )
    BEGIN
      SELECT RAISE(ABORT, 'Finalized reports require a started session and complete attendance');
    END;

    DROP TRIGGER IF EXISTS trg_v6_report_completion_evidence_update;
    CREATE TRIGGER trg_v6_report_completion_evidence_update
    BEFORE UPDATE ON class_session_reports
    WHEN NEW.completed = 1 AND (
      NOT EXISTS (
        SELECT 1 FROM class_sessions cs
         WHERE cs.id = NEW.session_id
           AND cs.session_date <= CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
      )
      OR NOT EXISTS (SELECT 1 FROM class_session_roster csr WHERE csr.session_id = NEW.session_id)
      OR EXISTS (
        SELECT 1
          FROM class_session_roster csr
         WHERE csr.session_id = NEW.session_id
           AND NOT EXISTS (
             SELECT 1 FROM attendance_records ar
              WHERE ar.session_id = csr.session_id AND ar.student_id = csr.student_id
           )
      )
    )
    BEGIN
      SELECT RAISE(ABORT, 'Finalized reports require a started session and complete attendance');
    END;
  `);
}

function verifyV6SessionEvidenceProtections(db: DatabaseSync) {
  const expectedTriggers: [string, string, string][] = [
    ["trg_v6_class_sessions_timezone_insert", "class_sessions", "New Class sessions require a valid timezone snapshot"],
    ["trg_v6_class_sessions_identity_immutable", "class_sessions", "Class session identity is immutable"],
    ["trg_v6_class_sessions_guard_delete", "class_sessions", "Started or evidenced Class sessions cannot be deleted"],
    ["trg_v6_roster_validate_insert", "class_session_roster", "Session roster identity is invalid"],
    ["trg_v6_roster_validate_update", "class_session_roster", "Session roster identity is invalid"],
    ["trg_v6_roster_lock_insert", "class_session_roster", "Started or finalized session rosters are immutable"],
    ["trg_v6_roster_lock_update", "class_session_roster", "Started or finalized session rosters are immutable"],
    ["trg_v6_roster_lock_delete", "class_session_roster", "Started or finalized session rosters are immutable"],
    ["trg_v6_attendance_validate_insert", "attendance_records", "Attendance must be valid and belong to the locked roster"],
    ["trg_v6_attendance_validate_update", "attendance_records", "Attendance must be valid and belong to the locked roster"],
    ["trg_v6_attendance_identity_immutable", "attendance_records", "Attendance identity is immutable"],
    ["trg_v6_final_attendance_no_insert", "attendance_records", "Finalized session attendance is immutable"],
    ["trg_v6_final_attendance_no_update", "attendance_records", "Finalized session attendance is immutable"],
    ["trg_v6_final_attendance_no_delete", "attendance_records", "Finalized session attendance is immutable"],
    ["trg_v6_report_validate_insert", "class_session_reports", "Session report evidence is invalid"],
    ["trg_v6_report_validate_update", "class_session_reports", "Session report evidence is invalid"],
    ["trg_v6_report_identity_immutable", "class_session_reports", "Session report identity is immutable"],
    ["trg_v6_report_completion_evidence_insert", "class_session_reports", "Finalized reports require a started session and complete attendance"],
    ["trg_v6_report_completion_evidence_update", "class_session_reports", "Finalized reports require a started session and complete attendance"],
  ];
  for (const [triggerName, tableName, message] of expectedTriggers) {
    const row = db.prepare(
      "SELECT tbl_name, sql FROM sqlite_master WHERE type = 'trigger' AND name = ?",
    ).get(triggerName) as { tbl_name: string; sql: string | null } | undefined;
    if (
      !row
      || row.tbl_name !== tableName
      || !normalizeSchemaSql(row.sql).includes(normalizeSchemaSql(`RAISE(ABORT, '${message}')`))
    ) {
      throw new Error(`[bow:v6] Required session-evidence trigger ${triggerName} is missing or incorrect.`);
    }
  }
}

function verifyOperatingSystemV6RuntimeHealth(db: DatabaseSync) {
  assertV6SessionEvidenceRows(db);
  verifyV6SessionEvidenceProtections(db);
}

function runOperatingSystemV6SessionEvidenceMigration(db: DatabaseSync) {
  if (db.prepare("SELECT 1 FROM schema_migrations WHERE id = ?").get(OPERATING_SYSTEM_V6_SESSION_EVIDENCE_MIGRATION_ID)) {
    verifyOperatingSystemV6RuntimeHealth(db);
    return;
  }

  db.exec("SAVEPOINT bow_os_v6_session_evidence");
  try {
    const invalidCompatibilityRow = db.prepare(
      "SELECT id, present FROM attendance_records WHERE present NOT IN (0, 1) LIMIT 1",
    ).get() as MigrationRow | undefined;
    if (invalidCompatibilityRow) {
      throw new Error(
        `[bow:v6] Attendance compatibility value must be reconciled before status backfill: ${JSON.stringify(invalidCompatibilityRow)}.`,
      );
    }
    db.prepare(
      `UPDATE attendance_records
          SET status = CASE present WHEN 1 THEN 'present' WHEN 0 THEN 'absent' END
        WHERE status IS NULL`,
    ).run();
    assertV6SessionEvidenceRows(db);
    installV6SessionEvidenceProtections(db);
    verifyOperatingSystemV6RuntimeHealth(db);
    db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)")
      .run(OPERATING_SYSTEM_V6_SESSION_EVIDENCE_MIGRATION_ID, Date.now());
    db.exec("RELEASE SAVEPOINT bow_os_v6_session_evidence");
  } catch (error) {
    try {
      db.exec("ROLLBACK TO SAVEPOINT bow_os_v6_session_evidence");
      db.exec("RELEASE SAVEPOINT bow_os_v6_session_evidence");
    } catch {
      // Preserve the evidence error that explains the unsafe source row or
      // malformed database protection.
    }
    throw error;
  }
}

const OPERATING_SYSTEM_V9_SESSION_CALENDAR_MIGRATION_ID =
  "2026-07-19-bow-operating-system-v9-session-local-calendar";

function assertV9SessionCalendarRows(db: DatabaseSync) {
  const columns = new Set(
    (db.prepare("PRAGMA table_info(class_sessions)").all() as { name: string }[])
      .map((column) => column.name),
  );
  if (!columns.has("session_on")) {
    throw new Error("[bow:v9] Required class_sessions.session_on column is missing.");
  }

  const invalid = db.prepare(
    `SELECT id, session_on, timezone
       FROM class_sessions
      WHERE (session_on IS NOT NULL AND (
        length(session_on) <> 10 OR date(session_on) IS NULL OR date(session_on) <> session_on
      )) OR (timezone IS NOT NULL AND session_on IS NULL)
      LIMIT 1`,
  ).get() as MigrationRow | undefined;
  if (invalid) {
    throw new Error(`[bow:v9] Class session calendar evidence is incomplete or invalid: ${JSON.stringify(invalid)}.`);
  }

  const evidencedRows = db.prepare(
    "SELECT id, session_date, session_on, timezone FROM class_sessions WHERE timezone IS NOT NULL",
  ).all() as Array<{ id: string; session_date: number; session_on: string; timezone: string }>;
  for (const row of evidencedRows) {
    if (!isValidTimeZone(row.timezone)) {
      throw new Error(`[bow:v9] Class session ${row.id} carries an invalid IANA timezone.`);
    }
    const expectedDate = canonicalDateInZone(Number(row.session_date), row.timezone);
    if (row.session_on !== expectedDate) {
      throw new Error(`[bow:v9] Class session ${row.id} calendar date does not match its instant and timezone.`);
    }
  }
}

function installV9SessionCalendarProtections(db: DatabaseSync) {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_v9_class_sessions_calendar
      ON class_sessions (session_on, class_id);

    DROP TRIGGER IF EXISTS trg_v9_class_session_calendar_insert;
    CREATE TRIGGER trg_v9_class_session_calendar_insert
    BEFORE INSERT ON class_sessions
    WHEN NEW.session_on IS NULL OR length(NEW.session_on) <> 10
      OR date(NEW.session_on) IS NULL OR date(NEW.session_on) <> NEW.session_on
    BEGIN
      SELECT RAISE(ABORT, 'New Class sessions require a canonical local calendar date');
    END;

    DROP TRIGGER IF EXISTS trg_v9_class_session_calendar_immutable;
    CREATE TRIGGER trg_v9_class_session_calendar_immutable
    BEFORE UPDATE OF session_on ON class_sessions
    WHEN NEW.session_on IS NOT OLD.session_on
    BEGIN
      SELECT RAISE(ABORT, 'Class session calendar evidence is immutable');
    END;
  `);
}

function verifyV9SessionCalendarProtections(db: DatabaseSync) {
  const expected: [string, string][] = [
    ["trg_v9_class_session_calendar_insert", "New Class sessions require a canonical local calendar date"],
    ["trg_v9_class_session_calendar_immutable", "Class session calendar evidence is immutable"],
  ];
  for (const [name, message] of expected) {
    const trigger = db.prepare(
      "SELECT tbl_name, sql FROM sqlite_master WHERE type = 'trigger' AND name = ?",
    ).get(name) as { tbl_name: string; sql: string | null } | undefined;
    if (
      !trigger
      || trigger.tbl_name !== "class_sessions"
      || !normalizeSchemaSql(trigger.sql).includes(normalizeSchemaSql(`RAISE(ABORT, '${message}')`))
    ) {
      throw new Error(`[bow:v9] Required local-calendar trigger ${name} is missing or incorrect.`);
    }
  }
  const index = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_v9_class_sessions_calendar'",
  ).get() as { sql: string | null } | undefined;
  if (
    !index
    || !normalizeSchemaSql(index.sql).includes(normalizeSchemaSql("ON class_sessions (session_on, class_id)"))
  ) {
    throw new Error("[bow:v9] Required Class session calendar index is missing or incorrect.");
  }
}

function verifyOperatingSystemV9SessionCalendarHealth(db: DatabaseSync) {
  assertV9SessionCalendarRows(db);
  verifyV9SessionCalendarProtections(db);
}

function runOperatingSystemV9SessionCalendarMigration(db: DatabaseSync) {
  if (db.prepare("SELECT 1 FROM schema_migrations WHERE id = ?")
    .get(OPERATING_SYSTEM_V9_SESSION_CALENDAR_MIGRATION_ID)) {
    verifyOperatingSystemV9SessionCalendarHealth(db);
    return;
  }

  db.exec("SAVEPOINT bow_os_v9_session_local_calendar");
  try {
    const sessions = db.prepare(
      "SELECT id, session_date, timezone FROM class_sessions WHERE timezone IS NOT NULL AND session_on IS NULL",
    ).all() as Array<{ id: string; session_date: number; timezone: string }>;
    const update = db.prepare("UPDATE class_sessions SET session_on = ? WHERE id = ? AND session_on IS NULL");
    for (const session of sessions) {
      if (!isValidTimeZone(session.timezone)) {
        throw new Error(`[bow:v9] Class session ${session.id} needs a valid IANA timezone before its local date can be proven.`);
      }
      update.run(canonicalDateInZone(Number(session.session_date), session.timezone), session.id);
    }
    assertV9SessionCalendarRows(db);
    installV9SessionCalendarProtections(db);
    verifyOperatingSystemV9SessionCalendarHealth(db);
    db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)")
      .run(OPERATING_SYSTEM_V9_SESSION_CALENDAR_MIGRATION_ID, Date.now());
    db.exec("RELEASE SAVEPOINT bow_os_v9_session_local_calendar");
  } catch (error) {
    try {
      db.exec("ROLLBACK TO SAVEPOINT bow_os_v9_session_local_calendar");
      db.exec("RELEASE SAVEPOINT bow_os_v9_session_local_calendar");
    } catch {
      // Preserve the source row or protection error that makes migration unsafe.
    }
    throw error;
  }
}

/**
 * Browser session credentials used to be stored verbatim. The application now
 * stores only a SHA-256 digest, so every pre-upgrade session must be revoked
 * once. Keeping this as its own marker makes the security boundary explicit
 * and prevents a restart from repeatedly signing out newly created sessions.
 */
function runSessionDigestMigration(db: DatabaseSync) {
  const migrationId = "2026-07-18-session-token-digests-v1";
  if (db.prepare("SELECT 1 FROM schema_migrations WHERE id = ?").get(migrationId)) return;

  db.exec("SAVEPOINT bow_session_token_digests");
  try {
    db.prepare("DELETE FROM sessions").run();
    db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(migrationId, Date.now());
    db.exec("RELEASE SAVEPOINT bow_session_token_digests");
  } catch (error) {
    db.exec("ROLLBACK TO SAVEPOINT bow_session_token_digests");
    db.exec("RELEASE SAVEPOINT bow_session_token_digests");
    throw error;
  }
}

function runOperatingSystemMigration(db: DatabaseSync) {
  const migrationId = "2026-07-17-bow-operating-system-v1";
  const applied = db.prepare("SELECT 1 FROM schema_migrations WHERE id = ?").get(migrationId);
  // This projection remains an always-on compatibility bridge while legacy
  // Cohorts can still enter the system. Once v1 has run, only Classes proven
  // to come from that legacy Cohort table may be auto-repaired. Any other
  // post-v1 orphan Class or staffing drift must fail the v2 health check so a
  // human can repair its real evidence instead of receiving invented history.
  backfillOperatingSystem(db, Boolean(applied));
  if (applied) return;
  db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(migrationId, Date.now());
}

function seedProductionBootstrap(db: DatabaseSync): void {
  const email = (process.env.BOW_BOOTSTRAP_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.BOW_BOOTSTRAP_ADMIN_PASSWORD ?? "";
  const name = (process.env.BOW_BOOTSTRAP_ADMIN_NAME ?? "BOW Founder").trim().slice(0, 160) || "BOW Founder";
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("[bow] Fresh production bootstrap requires BOW_BOOTSTRAP_ADMIN_EMAIL.");
  }
  if (password.length < 16 || isPublicDemoPassword(password) || password.toLowerCase().includes("replace-with")) {
    throw new Error("[bow] Fresh production bootstrap requires a unique BOW_BOOTSTRAP_ADMIN_PASSWORD of at least 16 characters.");
  }
  const now = Date.now();
  db.prepare(
    "INSERT OR IGNORE INTO organizations (id, name, type, location, status) VALUES ('org-bow', 'BOW Sports Capital', 'BOW', 'Remote', 'active')",
  ).run();
  db.prepare(
    `INSERT INTO users
      (id, name, first, email, role, org_id, grade, status, last, signin, password_hash, last_active_at, created_at,
       onboarding_completed, password_change_required)
     VALUES (?, ?, ?, ?, 'admin', 'org-bow', NULL, 'active', 'Never', 'Email + password', ?, NULL, ?, 1, 1)`,
  ).run(`u-bootstrap-${randomUUID()}`, name, name.split(/\s+/)[0] || "Founder", email, hashPassword(password), now);
}

const PRODUCTION_DEMO_PASSWORD_AUDIT_ID = "2026-07-18-production-public-demo-password-audit";

/**
 * Scan every active credential once when an existing database first enters
 * production. New password-setting flows reject this public password, so a
 * migration marker avoids repeating thousands of expensive scrypt checks on
 * every process start as BOW grows.
 */
function auditProductionCredentials(db: DatabaseSync): void {
  if (db.prepare("SELECT 1 FROM schema_migrations WHERE id = ?").get(PRODUCTION_DEMO_PASSWORD_AUDIT_ID)) return;
  const credentials = db
    .prepare("SELECT id, password_hash FROM users WHERE status = 'active' AND password_hash IS NOT NULL")
    .all() as { id: string; password_hash: string }[];
  const compromised = credentials.find((row) => verifyPassword("bowdemo123", row.password_hash));
  if (compromised) {
    throw new Error(
      `[bow] Production startup refused: active account ${compromised.id} still uses the public demo password. Rotate it before deployment.`,
    );
  }
  db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)")
    .run(PRODUCTION_DEMO_PASSWORD_AUDIT_ID, Date.now());
}

function init(): DatabaseSync {
  const production = process.env.NODE_ENV === "production";
  if (production && process.env.VERCEL) {
    throw new Error(
      "[bow] Production startup refused: this SQLite runtime requires one durable filesystem and is not safe on Vercel's ephemeral, horizontally scaled functions. Migrate to managed Postgres or deploy on a single durable host.",
    );
  }
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  // During a production build, multiple static-generation worker processes can
  // open and seed the database at once. WAL allows concurrent reads, and this
  // makes a blocked writer wait for the lock instead of failing immediately —
  // the seeds are idempotent, so serialized double-seeding is safe.
  db.exec("PRAGMA busy_timeout = 8000;");

  // Serialize the entire schema + migrate + seed sequence behind a single write
  // lock. During a production build several static-generation worker processes
  // open the database at once; without this they race on DDL (probe-then-ALTER
  // in migrate) and on the non-idempotent first-boot seed(). BEGIN IMMEDIATE +
  // busy_timeout makes the others wait, then they no-op: the schema is
  // CREATE-IF-NOT-EXISTS, migrate re-probes, reference data upserts, and the
  // fresh-only seeds re-check freshness inside the lock.
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(SCHEMA);
    migrate(db);

    const fresh = (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n === 0;
    if (fresh) {
      if (production) seedProductionBootstrap(db);
      else seed(db);
    }
    if (production) auditProductionCredentials(db);
    // Feed stories are reference data — ensure they exist even on an older DB
    // that was seeded before the Daily Feed shipped.
    seedFeedStories(db);
    // Self-paced Track 101 (Feature 1): the four modules and the default async
    // cohort are reference data; the demo students only seed a fresh database.
    seedSelfModulesAndCohort(db, production ? null : "u-coach");
    // BOW Daily scenarios (Feature 2) and the Econ Quiz bank (Feature 3) are
    // reference data — ensure they exist on every boot, fresh or not.
    seedDailyScenarios(db);
    seedQuizQuestions(db);
    // Weekly Challenges (Feature 4) and Partner pages (Feature 5) are reference data.
    seedWeeklyChallenges(db);
    seedPartnerOrgs(db);
    // Daily Questions (Feature 1) + public credibility content (Features 3, 5, 7)
    // are reference data — ensure they exist on every boot, fresh or not.
    seedDailyQuestions(db);
    seedBadges(db);
    seedConceptMap(db);
    seedGlossaryTerms(db);
    seedStandardsAlignment(db);
    // NBA analytics reference data (curated contracts + cached stats) is
    // re-read from data-seeds/ every boot; the demo articles only seed an
    // empty publication so owner edits survive reboots.
    seedNbaFromCsv(db);
    if (!production) seedArticlesDemo(db);
    // Create every demo user and enrollment before canonical People, Student,
    // Class-roster, and Program migrations run. This keeps a fresh database on
    // the same convergence path as an upgraded database.
    if (fresh && !production) seedSelfPacedDemo(db);
    // BOW HQ (Phase A) — idempotent backfills + reference data.
    backfillPeople(db);
    migrateCohortsToClasses(db);
    backfillStudentsFromUsers(db);
    seedHiringReferenceData(db, production ? null : "u-growth");
    // Phase E legacy conversion is a versioned one-time migration. New Classes
    // created after this point remain intentionally unassigned until an
    // operator connects them to a Program.
    runOperatingSystemMigration(db);
    const operatingSystemV2WasApplied = Boolean(
      db.prepare("SELECT 1 FROM schema_migrations WHERE id = ?").get(OPERATING_SYSTEM_V2_MIGRATION_ID),
    );
    // Existing v2 databases still carry the original all-history uniqueness
    // indexes. Upgrade those before v2 performs its startup protection audit.
    if (operatingSystemV2WasApplied) runOperatingSystemV4StaffingMigration(db);
    // V2 reconciles legacy ambiguity before enforcing the identity,
    // provenance, roster, and decision invariants required for scale.
    runOperatingSystemV2Migration(db);
    // V3 adds an insert-time guard for the append-only Class lifecycle ledger.
    runOperatingSystemV3Migration(db);
    // Fresh databases reach v4 only after v2 has reconciled legacy duplicate
    // assignments; later boots already ran v4 above before the v2 health audit.
    if (!operatingSystemV2WasApplied) runOperatingSystemV4StaffingMigration(db);
    // V5 refuses to guess between competing current instructor dossiers, then
    // deterministically reconciles duplicate training registration/attendance
    // evidence before enforcing one canonical row for each business identity.
    runOperatingSystemV5DataIntegrityMigration(db);
    // V6 turns Class delivery into durable evidence: session timezone and
    // lesson snapshots, four-state attendance, locked rosters, and immutable
    // finalized reports all agree at both the action and database boundaries.
    runOperatingSystemV6SessionEvidenceMigration(db);
    // V7 connects acquisition effort to attributable, verified participation;
    // adds the contributor leadership hierarchy; and preserves campaign,
    // referral, outcome, goal, and playbook evidence as durable history.
    runOperatingSystemV7GrowthMigration(db);
    // V8 refreshes the final pre-release V7 constraints once for databases
    // that may already carry an earlier V7 marker, then freezes campaign
    // terminal evidence into an explicit lifecycle snapshot.
    runOperatingSystemV8GrowthHardeningMigration(db);
    // V9 gives every timezone-proven delivery session a canonical local date.
    // Legacy rows without a provable zone remain on an explicit UTC fallback.
    runOperatingSystemV9SessionCalendarMigration(db);
    // V10 completes contributor role and membership lifecycle evidence. It
    // also upgrades historical hierarchy checks so a closed manager remains
    // valid history after every direct report has been closed first.
    runOperatingSystemV10GrowthLifecycleMigration(db);
    // Session cookies issued before digest-at-rest support cannot be converted
    // without retaining replayable secrets, so revoke them exactly once.
    runSessionDigestMigration(db);
    if (fresh && !production) {
      // Discussion seed posts are authored by the demo students, so they only
      // seed a fresh database (after the demo students exist).
      seedDiscussion(db);
      // Editable admin content (testimonials, news, pending submissions).
      seedContentDemo(db);
    }
    db.exec("COMMIT");
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* already rolled back */
    }
    throw e;
  }

  return db;
}

// Reuse a single connection across hot reloads in development.
const globalForDb = globalThis as unknown as { __bowDb?: { path: string; connection: DatabaseSync } };

export function getDb(): DatabaseSync {
  if (!globalForDb.__bowDb || globalForDb.__bowDb.path !== DB_PATH) {
    globalForDb.__bowDb = { path: DB_PATH, connection: init() };
  }
  return globalForDb.__bowDb.connection;
}

/* ---------------- row -> domain mappers ---------------- */

/* eslint-disable @typescript-eslint/no-explicit-any */
export function rowToUser(r: any): User {
  return {
    id: r.id, name: r.name, first: r.first, email: r.email, role: r.role,
    orgId: r.org_id, grade: r.grade ?? undefined, status: r.status, last: r.last, signin: r.signin,
    lastActiveAt: r.last_active_at ?? null,
    createdAt: r.created_at ?? null,
    onboardingCompleted: !!r.onboarding_completed,
    passwordChangeRequired: !!r.password_change_required,
  };
}

export function rowToOrg(r: any): Organization {
  return { id: r.id, name: r.name, type: r.type, location: r.location, status: r.status };
}

export function rowToCohort(r: any): Cohort {
  return {
    id: r.id, name: r.name, orgId: r.org_id, track: r.track, instructorId: r.instructor_id,
    currentLessonId: r.current_lesson_id, status: r.status, format: r.format, schedule: r.schedule,
    start: r.start, end: r.end_date, cap: r.cap, nextSession: r.next_session,
  };
}

export function rowToEnrollment(r: any): Enrollment {
  return {
    userId: r.user_id, cohortId: r.cohort_id, enroll: r.enroll,
    lessonStatus: r.lesson_status, last: r.last, attLast: r.att_last,
    unlockedLessonId: r.unlocked_lesson_id ?? null,
  };
}

export function rowToInvitation(r: any): Invitation {
  return {
    id: r.id, email: r.email, role: r.role, orgId: r.org_id, cohortId: r.cohort_id,
    created: r.created, expires: r.expires, status: r.status,
    expiresAt: typeof r.expires_at === "number" ? r.expires_at : undefined,
  };
}

export function rowToInquiry(r: any): Inquiry {
  return {
    id: r.id, organizationId: r.organization_id ?? null, name: r.name, email: r.email, type: r.type, orgName: r.org_name,
    date: r.date, status: r.status, summary: r.summary,
  };
}

export function rowToActivity(r: any): Activity {
  return { id: r.id, icon: r.icon, text: r.text, when: r.when_label, role: r.role };
}

export function rowToNote(r: any): SessionNote {
  return {
    id: r.id, cohortId: r.cohort_id, authorId: r.author_id,
    authorName: r.author_name ?? "BOW", scope: r.scope, text: r.text, when: r.created_at,
  };
}
/* ---- BOW HQ (Phase A) row -> domain mappers ---- */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function rowToPerson(r: any): import("@/lib/hiring").Person {
  return { id: r.id, name: r.name, email: r.email, phone: r.phone ?? "", userId: r.user_id ?? null, createdAt: r.created_at, updatedAt: r.updated_at };
}

export function rowToInstructor(r: any): import("@/lib/hiring").Instructor {
  return {
    id: r.id, personId: r.person_id, stage: r.stage, source: r.source ?? null, ownerUserId: r.owner_user_id ?? null,
    answers: r.answers ?? "{}", interviewAt: r.interview_at ?? null, interviewTimeZone: r.interview_timezone ?? null,
    interviewNotes: r.interview_notes ?? null,
    founderDecision: r.founder_decision ?? null, decidedBy: r.decided_by ?? null, decidedAt: r.decided_at ?? null,
    onboardingStatus: r.onboarding_status, trainingStatus: r.training_status, eligibilityStatus: r.eligibility_status,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export function rowToCurriculum(r: any): import("@/lib/hiring").Curriculum {
  return { id: r.id, title: r.title, description: r.description ?? null, ageRange: r.age_range ?? null, published: !!r.published, createdAt: r.created_at, updatedAt: r.updated_at };
}

export function rowToTrainingModule(r: any): import("@/lib/hiring").TrainingModule {
  return {
    id: r.id, title: r.title, category: r.category, required: !!r.required, contentType: r.content_type,
    content: r.content ?? null, ordinal: r.ordinal, active: !!r.active, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export function rowToTrainingSession(r: any): import("@/lib/hiring").TrainingSession {
  return {
    id: r.id, title: r.title, scheduledAt: r.scheduled_at, timeZone: r.timezone ?? null,
    location: r.location ?? null, meetingLink: r.meeting_link ?? null,
    facilitatorUserId: r.facilitator_user_id ?? null, required: !!r.required, facilitatorNotes: r.facilitator_notes ?? null,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export function rowToClass(r: any): import("@/lib/hiring").Class {
  return {
    id: r.id, title: r.title, curriculumId: r.curriculum_id, partnerOrgId: r.partner_org_id ?? null, location: r.location ?? null,
    onlineFormat: r.online_format ?? null, startDate: r.start_date ?? null, endDate: r.end_date ?? null, recurrence: r.recurrence ?? null,
    scheduleDay: typeof r.schedule_day === "number" ? r.schedule_day : null,
    scheduleStartTime: r.schedule_start_time ?? null, scheduleEndTime: r.schedule_end_time ?? null,
    scheduleTimezone: r.schedule_timezone ?? null,
    ageRange: r.age_range ?? null, capacity: r.capacity ?? null, minimumEnrollment: Number(r.minimum_enrollment) || 1,
    leadInstructorId: r.lead_instructor_id ?? null,
    programId: r.program_id ?? null, locationId: r.location_id ?? null,
    status: r.status, internalNotes: r.internal_notes ?? null, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export function rowToStudent(r: any): import("@/lib/hiring").Student {
  return {
    id: r.id, name: r.name, age: r.age ?? null, grade: r.grade ?? null, email: r.email ?? null,
    guardianPersonId: r.guardian_person_id ?? null, emergencyNotes: r.emergency_notes ?? null,
    enrollmentStatus: r.enrollment_status, formStatus: r.form_status, communicationNotes: r.communication_notes ?? null,
    userId: r.user_id ?? null, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export function rowToTask(r: any): import("@/lib/hiring").Task {
  return {
    id: r.id, title: r.title, kind: r.kind ?? "task", ownerUserId: r.owner_user_id ?? null, dueAt: r.due_at ?? null,
    dueOn: r.due_on ?? null, status: r.status,
    entityType: r.entity_type ?? null, entityId: r.entity_id ?? null, handoffToFounder: !!r.handoff_to_founder,
    completedAt: r.completed_at ?? null, completionNote: r.completion_note ?? null, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Read the full LMS dataset from the database as a typed snapshot. */
export function readAppData(): AppData {
  const db = getDb();
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const attendance: Record<string, Record<string, string>> = {};
  for (const a of db.prepare("SELECT * FROM attendance").all() as any[]) {
    (attendance[a.cohort_id] ??= {})[a.user_id] = a.state;
  }

  const progress: Record<string, Record<string, LessonProgressDetail>> = {};
  for (const p of db.prepare("SELECT * FROM lesson_progress").all() as any[]) {
    (progress[p.user_id] ??= {})[p.lesson_id] = {
      status: p.status,
      simulationDone: !!p.simulation_done,
      reflection: p.reflection ?? "",
      challengeDone: !!p.challenge_done,
      podcastProgress: typeof p.podcast_progress === "number" ? p.podcast_progress : 0,
      startedAt: p.started_at ?? null,
      completedAt: p.completed_at ?? null,
    };
  }

  const cohorts = (db.prepare("SELECT * FROM cohorts").all() as any[]).map(rowToCohort);
  const cohortCurrent: Record<string, string | null> = {};
  for (const c of cohorts) cohortCurrent[c.id] = c.currentLessonId;

  // Enrollment lesson status is derived live from each student's progress on
  // the cohort's current lesson, so rosters reflect real work.
  const enrollments = (db.prepare("SELECT * FROM enrollments").all() as any[]).map((r) => {
    const e = rowToEnrollment(r);
    if (e.enroll === "invited" || e.enroll === "inactive") {
      e.lessonStatus = "none";
      return e;
    }
    const curId = cohortCurrent[e.cohortId] ?? null;
    const det = curId ? progress[e.userId]?.[curId] : undefined;
    e.lessonStatus = det ? det.status : "not-started";
    return e;
  });

  const notes = (db.prepare(
    "SELECT n.*, u.name AS author_name FROM session_notes n LEFT JOIN users u ON u.id = n.author_id ORDER BY n.created_ts DESC",
  ).all() as any[]).map(rowToNote);

  const deletionRequests = (db.prepare("SELECT id FROM users WHERE deletion_requested = 1").all() as any[]).map((r) => r.id as string);

  return {
    users: (db.prepare("SELECT * FROM users").all() as any[]).map(rowToUser),
    organizations: (db.prepare("SELECT * FROM organizations").all() as any[]).map(rowToOrg),
    cohorts,
    enrollments,
    invitations: (db.prepare("SELECT * FROM invitations ORDER BY created DESC").all() as any[]).map(rowToInvitation),
    inquiries: (db.prepare("SELECT * FROM inquiries").all() as any[]).map(rowToInquiry),
    activity: (db.prepare("SELECT * FROM activity").all() as any[]).map(rowToActivity),
    attendance: attendance as AppData["attendance"],
    progress,
    notes,
    deletionRequests,
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
