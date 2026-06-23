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
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import {
  seedAppData,
  orderedTrackLessons,
  parseLastSeen,
  feedStories,
  selfModules,
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
  last_active_at INTEGER
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
  central_question TEXT NOT NULL
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

/** Idempotently load the six self-paced modules + the default async cohort. */
function seedSelfModulesAndCohort(db: DatabaseSync) {
  const insertMod = db.prepare(
    "INSERT OR IGNORE INTO self_modules (id, ordinal, title, summary, concept, central_question) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const m of selfModules) insertMod.run(m.id, m.ordinal, m.title, m.summary, m.concept, m.centralQuestion);

  // The default async cohort. Instructor u-coach (Marcus Reyes) manages it so
  // the instructor dashboard (Feature 2) always has a roster to work with.
  db.prepare(
    "INSERT OR IGNORE INTO cohorts (id, name, org_id, track, instructor_id, current_lesson_id, status, format, schedule, start, end_date, cap, next_session) VALUES (?, ?, ?, '101', 'u-coach', 't101-m1-l1', 'active', 'Self-paced · Async', 'Anytime · On your schedule', 'Rolling', '—', 9999, 'Whenever you’re ready')",
  ).run(SELF_PACED_COHORT_ID, SELF_PACED_COHORT_NAME, SELF_PACED_ORG_ID);
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
  ];
  const insertUser = db.prepare(
    "INSERT OR IGNORE INTO users (id, name, first, email, role, org_id, grade, status, last, signin, password_hash, last_active_at) VALUES (?, ?, ?, ?, 'student', ?, NULL, 'active', ?, 'Email + password', ?, ?)",
  );
  const insertEnr = db.prepare(
    "INSERT OR IGNORE INTO enrollments (user_id, cohort_id, enroll, lesson_status, last, att_last) VALUES (?, ?, 'active', 'not-started', ?, 'none')",
  );
  for (const s of students) {
    insertUser.run(s.id, s.name, s.first, s.email, SELF_PACED_ORG_ID, s.last, seedHash, s.lastActive);
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

  const insertAtt = db.prepare(
    "INSERT OR IGNORE INTO self_attendance (cohort_id, student_id, session_no, present) VALUES (?, ?, ?, ?)",
  );
  for (const n of [1, 2, 3, 4]) insertAtt.run(SELF_PACED_COHORT_ID, "u-self1", n, 1);
  for (const n of [1, 2]) insertAtt.run(SELF_PACED_COHORT_ID, "u-self2", n, 1);

  db.prepare(
    "INSERT OR IGNORE INTO session_notes (id, cohort_id, author_id, student_id, scope, text, created_at, created_ts) VALUES (?, ?, 'u-coach', ?, ?, ?, ?, ?)",
  ).run("note-self-1", SELF_PACED_COHORT_ID, "u-self1", "Student · Jordan Avery", "Flying through the early modules — nudge toward the Module 3 marginal-value sim.", "Jun 20, 2026", now - DAY);
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
}

function init(): DatabaseSync {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  migrate(db);

  const fresh = (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n === 0;
  if (fresh) seed(db);
  // Feed stories are reference data — ensure they exist even on an older DB
  // that was seeded before the Daily Feed shipped.
  seedFeedStories(db);
  // Self-paced Track 101 (Feature 1): the six modules and the default async
  // cohort are reference data; the demo students only seed a fresh database.
  seedSelfModulesAndCohort(db);
  if (fresh) seedSelfPacedDemo(db);

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
