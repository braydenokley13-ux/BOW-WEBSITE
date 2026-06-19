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
  SEED_PASSWORD,
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
  deletion_requested INTEGER NOT NULL DEFAULT 0
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
  started_at TEXT,
  completed_at TEXT,
  PRIMARY KEY (user_id, lesson_id)
);
CREATE TABLE IF NOT EXISTS session_notes (
  id TEXT PRIMARY KEY,
  cohort_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
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
`;

function seed(db: DatabaseSync) {
  const data = seedAppData();
  const seedHash = hashPassword(SEED_PASSWORD);

  const insertOrg = db.prepare(
    "INSERT INTO organizations (id, name, type, location, status) VALUES (?, ?, ?, ?, ?)",
  );
  for (const o of data.organizations) insertOrg.run(o.id, o.name, o.type, o.location, o.status);

  const insertUser = db.prepare(
    "INSERT INTO users (id, name, first, email, role, org_id, grade, status, last, signin, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
    "INSERT INTO lesson_progress (user_id, lesson_id, status, simulation_done, reflection, challenge_done, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const e of data.enrollments) {
    if (e.enroll === "invited" || e.enroll === "inactive") continue;
    const cohort = data.cohorts.find((c) => c.id === e.cohortId);
    if (!cohort) continue;
    const ordered = orderedTrackLessons(cohort.track);
    const curIdx = ordered.findIndex((l) => l.id === cohort.currentLessonId);
    if (curIdx === -1) continue;
    ordered.forEach((l, i) => {
      if (i < curIdx) {
        insertProg.run(e.userId, l.id, "completed", 1, "Reflected on the trade-off with the cohort.", 1, "Earlier in the term", "Earlier in the term");
      } else if (i === curIdx && e.lessonStatus !== "not-started" && e.lessonStatus !== "none") {
        const done = e.lessonStatus === "completed";
        insertProg.run(
          e.userId, l.id, done ? "completed" : "in-progress",
          done ? 1 : 0, done ? "The cost wasn't the salary — it was the win we passed up." : "",
          done ? 1 : 0, "This week", done ? "This week" : null,
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
}

function init(): DatabaseSync {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);

  const row = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (row.n === 0) seed(db);

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
