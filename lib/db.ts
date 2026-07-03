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
import { hashPassword } from "@/lib/password";
import { DAILY_QUESTIONS, seedToQuestion } from "@/lib/daily-question";
import { BADGE_CATALOG } from "@/lib/badges";
import { CONCEPT_MAP } from "@/lib/concept-map";
import { GLOSSARY_TERMS } from "@/lib/glossary";
import { STANDARDS_ALIGNMENT } from "@/lib/standards";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "bow.db");

const SCHEMA = `
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
  onboarding_completed INTEGER NOT NULL DEFAULT 0
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
  token TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
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
  certificate_id TEXT
);
CREATE TABLE IF NOT EXISTS feed_responses (
  id TEXT PRIMARY KEY,
  feed_user_id TEXT NOT NULL,
  story_id TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (feed_user_id, story_id)
);
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
  team TEXT NOT NULL
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
  author TEXT NOT NULL DEFAULT '',
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

/* ---- Indexes for high-traffic WHERE-clause columns (Feature 8) ---- */
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_sim
  ON simulations (student_id, sim_type) WHERE completed = 0;
CREATE INDEX IF NOT EXISTS idx_self_progress_student ON self_progress (student_id);
CREATE INDEX IF NOT EXISTS idx_self_progress_track ON self_progress (student_id, track);
CREATE INDEX IF NOT EXISTS idx_scenario_responses_student ON scenario_responses (student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_student ON quiz_responses (student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_track ON quiz_questions (track, module_unlock);
CREATE INDEX IF NOT EXISTS idx_simulations_student ON simulations (student_id);
CREATE INDEX IF NOT EXISTS idx_disc_posts_channel ON discussion_posts (channel, pinned, created_at);
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
CREATE INDEX IF NOT EXISTS idx_daily_questions_track_diff ON daily_questions (active, track, difficulty);
CREATE INDEX IF NOT EXISTS idx_student_badges_student ON student_badges (student_id);
CREATE INDEX IF NOT EXISTS idx_glossary_terms_term ON glossary_terms (term);
CREATE INDEX IF NOT EXISTS idx_player_cards_student ON player_cards (student_id);
CREATE INDEX IF NOT EXISTS idx_news_items_active ON news_items (active, created_at);
CREATE INDEX IF NOT EXISTS idx_news_submissions_status ON news_submissions (status, created_at);
CREATE INDEX IF NOT EXISTS idx_testimonials_active ON testimonials (active, ordinal);
CREATE INDEX IF NOT EXISTS idx_nba_stats_player ON nba_player_stats (player_slug, season);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles (status, featured, published_at);
CREATE INDEX IF NOT EXISTS idx_article_revisions ON article_revisions (article_id, saved_at);
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
    "INSERT INTO invitations (id, email, role, org_id, cohort_id, created, expires, status, token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const iv of data.invitations) {
    // Token doubles as the accept-invitation link parameter; the seed
    // ids are stable and unique, so reuse them.
    insertInv.run(iv.id, iv.email.toLowerCase(), iv.role, iv.orgId, iv.cohortId, iv.created, iv.expires, iv.status, iv.id);
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
    "INSERT OR IGNORE INTO discussion_posts (id, user_id, channel, title, body, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const now = Date.now();
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  for (const p of discussionSeedPosts) {
    const ts = now - p.agoHours * HOUR;
    insert.run(p.id, p.userId, p.channel, p.title, p.body, p.pinned ? 1 : 0, ts, ts);
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
function seedSelfModulesAndCohort(db: DatabaseSync) {
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

  // The default async cohort. Instructor u-coach (Marcus Reyes) manages it so
  // the instructor dashboard (Feature 2) always has a roster to work with.
  db.prepare(
    "INSERT OR IGNORE INTO cohorts (id, name, org_id, track, instructor_id, current_lesson_id, status, format, schedule, start, end_date, cap, next_session) VALUES (?, ?, ?, '101', 'u-coach', 't101-m1-l1', 'active', 'Self-paced · Async', 'Anytime · On your schedule', 'Rolling', '—', 9999, 'Whenever you’re ready')",
  ).run(SELF_PACED_COHORT_ID, SELF_PACED_COHORT_NAME, SELF_PACED_ORG_ID);
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
    `INSERT INTO nba_players (slug, name, team) VALUES (?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET name = excluded.name, team = excluded.team`,
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
    upsertPlayer.run(slug, c.player, c.team || "");
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
  // The active-simulation guard moved from one-per-student to one-per-type so a
  // student can hold an active Westbrook AND Eastfield run. Recreate the index
  // for any database that still has the older single-column form.
  db.exec("DROP INDEX IF EXISTS idx_one_active_sim");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_sim ON simulations (student_id, sim_type) WHERE completed = 0");
}

function init(): DatabaseSync {
  if (process.env.NODE_ENV === "production" && !process.env.SEED_PASSWORD) {
    // Every seeded account (including the admin account) signs in with this
    // password. Shipping the "bowdemo123" fallback to a real production
    // deployment means the admin account has a publicly-known password.
    console.warn(
      "[bow] WARNING: SEED_PASSWORD is not set in production. All seeded accounts, " +
        "including the admin account, are using the publicly-known default password. " +
        "Set SEED_PASSWORD (and rotate seeded accounts) before real users sign in.",
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
    if (fresh) seed(db);
    // Feed stories are reference data — ensure they exist even on an older DB
    // that was seeded before the Daily Feed shipped.
    seedFeedStories(db);
    // Self-paced Track 101 (Feature 1): the four modules and the default async
    // cohort are reference data; the demo students only seed a fresh database.
    seedSelfModulesAndCohort(db);
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
    seedArticlesDemo(db);
    if (fresh) {
      seedSelfPacedDemo(db);
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
const globalForDb = globalThis as unknown as { __bowDb?: DatabaseSync };

export function getDb(): DatabaseSync {
  if (!globalForDb.__bowDb) globalForDb.__bowDb = init();
  return globalForDb.__bowDb;
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
  };
}

export function rowToInquiry(r: any): Inquiry {
  return {
    id: r.id, name: r.name, email: r.email, type: r.type, orgName: r.org_name,
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
