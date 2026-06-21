"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import {
  orderedTrackLessons,
  unlockChecklist,
  type LessonProgressDetail,
} from "@/lib/account";
import type {
  AttendanceState,
  InquiryStatus,
  Invitation,
  InvitationStatus,
} from "@/lib/account";

function refreshApp() {
  revalidatePath("/app", "layout");
}

/* ---------------- People (admin) ---------------- */

export async function suspendUser(userId: string): Promise<void> {
  await requireRole("admin");
  getDb().prepare("UPDATE users SET status = 'suspended' WHERE id = ?").run(userId);
  // Kill any live sessions so the suspension takes effect immediately.
  getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  refreshApp();
}

export async function restoreUser(userId: string): Promise<void> {
  await requireRole("admin");
  getDb().prepare("UPDATE users SET status = 'active' WHERE id = ?").run(userId);
  refreshApp();
}

/* ---------------- Invitations (admin) ---------------- */

export async function setInvitationStatus(id: string, status: InvitationStatus): Promise<void> {
  await requireRole("admin");
  getDb().prepare("UPDATE invitations SET status = ? WHERE id = ?").run(status, id);
  refreshApp();
}

export interface NewInvitationInput {
  role: "student" | "instructor";
  email: string;
  orgId: string;
  cohortId: string | null;
}

export async function createInvitation(input: NewInvitationInput): Promise<Invitation> {
  await requireRole("admin");
  const id = `inv-${randomUUID().slice(0, 8)}`;
  const today = new Date();
  const created = fmtDate(today);
  const expires = fmtDate(new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000));
  const email = input.email.trim().toLowerCase();

  getDb()
    .prepare(
      "INSERT INTO invitations (id, email, role, org_id, cohort_id, created, expires, status, token) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)",
    )
    .run(id, email, input.role, input.orgId, input.cohortId, created, expires, id);

  refreshApp();
  return { id, email, role: input.role, orgId: input.orgId, cohortId: input.cohortId, created, expires, status: "pending" };
}

/* ---------------- Inquiries ---------------- */

export async function setInquiryStatus(id: string, status: InquiryStatus): Promise<void> {
  await requireRole("admin");
  getDb().prepare("UPDATE inquiries SET status = ? WHERE id = ?").run(status, id);
  refreshApp();
}

export interface NewInquiryInput {
  name: string;
  email: string;
  type: string;
  orgName?: string;
  summary: string;
}

/** Public — submitted from the marketing sign-up / Get Involved forms. */
export async function createInquiry(input: NewInquiryInput): Promise<{ ok: boolean }> {
  const name = input.name.trim();
  const email = input.email.trim();
  if (!name || !/.+@.+\..+/.test(email)) return { ok: false };

  const id = `iq-${randomUUID().slice(0, 8)}`;
  getDb()
    .prepare(
      "INSERT INTO inquiries (id, name, email, type, org_name, date, status, summary) VALUES (?, ?, ?, ?, ?, ?, 'new', ?)",
    )
    .run(id, name, email, input.type || "Other", input.orgName?.trim() || "—", fmtDate(new Date()), input.summary.trim());

  revalidatePath("/app/admin/inquiries");
  return { ok: true };
}

/* ---------------- Sessions / cohorts (instructor + admin) ---------------- */

export async function setAttendance(
  cohortId: string,
  userId: string,
  state: AttendanceState,
): Promise<void> {
  await requireRole("instructor", "admin");
  getDb()
    .prepare(
      "INSERT INTO attendance (cohort_id, user_id, state) VALUES (?, ?, ?) ON CONFLICT(cohort_id, user_id) DO UPDATE SET state = excluded.state",
    )
    .run(cohortId, userId, state);
  refreshApp();
}

export async function advanceCohortLesson(cohortId: string, nextLessonId: string | null): Promise<void> {
  await requireRole("instructor", "admin");
  if (!nextLessonId) return;
  getDb().prepare("UPDATE cohorts SET current_lesson_id = ? WHERE id = ?").run(nextLessonId, cohortId);
  refreshApp();
}

/* ---------------- Cohort & enrollment management (admin) ---------------- */

export interface NewCohortInput {
  name: string;
  orgId: string;
  track: string;
}

export async function createCohort(input: NewCohortInput): Promise<void> {
  await requireRole("admin");
  const id = `coh-${randomUUID().slice(0, 8)}`;
  getDb()
    .prepare(
      "INSERT INTO cohorts (id, name, org_id, track, instructor_id, current_lesson_id, status, format, schedule, start, end_date, cap, next_session) VALUES (?, ?, ?, ?, NULL, NULL, 'draft', '—', '—', '—', '—', 20, '—')",
    )
    .run(id, input.name.trim(), input.orgId, input.track);
  refreshApp();
}

export async function assignInstructor(cohortId: string, instructorId: string | null): Promise<void> {
  await requireRole("admin");
  getDb().prepare("UPDATE cohorts SET instructor_id = ? WHERE id = ?").run(instructorId, cohortId);
  refreshApp();
}

export async function assignStudent(cohortId: string, userId: string): Promise<void> {
  await requireRole("admin");
  const db = getDb();
  const existing = db
    .prepare("SELECT 1 FROM enrollments WHERE user_id = ? AND cohort_id = ?")
    .get(userId, cohortId);
  if (existing) {
    db.prepare("UPDATE enrollments SET enroll = 'active' WHERE user_id = ? AND cohort_id = ?").run(userId, cohortId);
  } else {
    db.prepare(
      "INSERT INTO enrollments (user_id, cohort_id, enroll, lesson_status, last, att_last) VALUES (?, ?, 'active', 'not-started', 'Just now', 'none')",
    ).run(userId, cohortId);
  }
  refreshApp();
}

export async function removeStudent(cohortId: string, userId: string): Promise<void> {
  await requireRole("admin");
  getDb()
    .prepare("UPDATE enrollments SET enroll = 'inactive' WHERE user_id = ? AND cohort_id = ?")
    .run(userId, cohortId);
  refreshApp();
}

export async function transferStudent(userId: string, fromCohortId: string, toCohortId: string): Promise<void> {
  await requireRole("admin");
  if (fromCohortId === toCohortId) return;
  const db = getDb();
  db.prepare("UPDATE enrollments SET enroll = 'inactive' WHERE user_id = ? AND cohort_id = ?").run(userId, fromCohortId);
  const existing = db.prepare("SELECT 1 FROM enrollments WHERE user_id = ? AND cohort_id = ?").get(userId, toCohortId);
  if (existing) {
    db.prepare("UPDATE enrollments SET enroll = 'active' WHERE user_id = ? AND cohort_id = ?").run(userId, toCohortId);
  } else {
    db.prepare(
      "INSERT INTO enrollments (user_id, cohort_id, enroll, lesson_status, last, att_last) VALUES (?, ?, 'active', 'not-started', 'Just now', 'none')",
    ).run(userId, toCohortId);
  }
  refreshApp();
}

/* ---------------- Organizations (admin) ---------------- */

export interface NewOrganizationInput {
  name: string;
  type: "School" | "Camp" | "Youth Organization";
  location: string;
}

export async function createOrganization(input: NewOrganizationInput): Promise<void> {
  await requireRole("admin");
  const id = `org-${randomUUID().slice(0, 8)}`;
  getDb()
    .prepare("INSERT INTO organizations (id, name, type, location, status) VALUES (?, ?, ?, ?, 'active')")
    .run(id, input.name.trim(), input.type, input.location.trim() || "—");
  refreshApp();
}

/* ---------------- Session notes (instructor + admin) ---------------- */

export async function addSessionNote(cohortId: string, scope: string, text: string): Promise<void> {
  const me = await requireRole("instructor", "admin");
  const body = text.trim();
  if (!body) return;
  const id = `note-${randomUUID().slice(0, 8)}`;
  getDb()
    .prepare(
      "INSERT INTO session_notes (id, cohort_id, author_id, scope, text, created_at, created_ts) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(id, cohortId, me.id, scope, body, fmtDate(new Date()), Date.now());
  refreshApp();
}

/* ---------------- Lesson progress (student) ---------------- */

/* eslint-disable @typescript-eslint/no-explicit-any */

interface StudentFrontier {
  enr: any;
  cohort: any;
  ordered: ReturnType<typeof orderedTrackLessons>;
  /** Furthest accessible lesson index: max of the cohort's lesson and the student's own unlock. */
  frontierIdx: number;
}

/**
 * The student's effective lesson frontier. A lesson is accessible when its
 * index is at or below the GREATER of two frontiers: the cohort's current
 * lesson (instructor manual unlock) and the student's own self-paced unlock.
 * Auto-unlock is the default path; instructor advancement still works as a floor.
 */
function studentFrontier(uid: string): StudentFrontier | null {
  const db = getDb();
  const enr = db.prepare("SELECT * FROM enrollments WHERE user_id = ? AND enroll = 'active'").get(uid) as any;
  if (!enr) return null;
  const cohort = db.prepare("SELECT * FROM cohorts WHERE id = ?").get(enr.cohort_id) as any;
  if (!cohort) return null;
  const ordered = orderedTrackLessons(cohort.track);
  const cohortIdx = ordered.findIndex((l) => l.id === cohort.current_lesson_id);
  const selfIdx = ordered.findIndex((l) => l.id === enr.unlocked_lesson_id);
  const frontierIdx = Math.max(cohortIdx, selfIdx);
  return { enr, cohort, ordered, frontierIdx };
}

function assertAccessible(uid: string, lessonId: string): boolean {
  const f = studentFrontier(uid);
  if (!f) return false;
  const lessonIdx = f.ordered.findIndex((l) => l.id === lessonId);
  return lessonIdx !== -1 && f.frontierIdx !== -1 && lessonIdx <= f.frontierIdx;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function touchProgress(uid: string, lessonId: string) {
  // Ensure a row exists and is at least in-progress.
  const db = getDb();
  db.prepare(
    "INSERT INTO lesson_progress (user_id, lesson_id, status, started_at) VALUES (?, ?, 'in-progress', ?) ON CONFLICT(user_id, lesson_id) DO UPDATE SET status = CASE WHEN lesson_progress.status = 'not-started' THEN 'in-progress' ELSE lesson_progress.status END, started_at = COALESCE(lesson_progress.started_at, excluded.started_at)",
  ).run(uid, lessonId, fmtDateTime(new Date()));
  touchActive(uid);
}

/** Record a real "last active" timestamp for the instructor monitoring view. */
function touchActive(uid: string) {
  getDb().prepare("UPDATE users SET last_active_at = ? WHERE id = ?").run(Date.now(), uid);
}

function progressDetail(uid: string, lessonId: string): LessonProgressDetail | null {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const p = getDb().prepare("SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?").get(uid, lessonId) as any;
  if (!p) return null;
  return {
    status: p.status,
    simulationDone: !!p.simulation_done,
    reflection: p.reflection ?? "",
    challengeDone: !!p.challenge_done,
    podcastProgress: typeof p.podcast_progress === "number" ? p.podcast_progress : 0,
    startedAt: p.started_at ?? null,
    completedAt: p.completed_at ?? null,
  };
}

export async function startLesson(lessonId: string): Promise<void> {
  const me = await requireRole("student");
  if (!assertAccessible(me.id, lessonId)) return;
  touchProgress(me.id, lessonId);
  refreshApp();
}

export async function setSimulationDone(lessonId: string, done: boolean): Promise<void> {
  const me = await requireRole("student");
  if (!assertAccessible(me.id, lessonId)) return;
  touchProgress(me.id, lessonId);
  getDb().prepare("UPDATE lesson_progress SET simulation_done = ? WHERE user_id = ? AND lesson_id = ?").run(done ? 1 : 0, me.id, lessonId);
  refreshApp();
}

export async function saveReflection(lessonId: string, text: string): Promise<void> {
  const me = await requireRole("student");
  if (!assertAccessible(me.id, lessonId)) return;
  touchProgress(me.id, lessonId);
  getDb().prepare("UPDATE lesson_progress SET reflection = ? WHERE user_id = ? AND lesson_id = ?").run(text.trim(), me.id, lessonId);
  refreshApp();
}

export async function setChallengeDone(lessonId: string, done: boolean): Promise<void> {
  const me = await requireRole("student");
  if (!assertAccessible(me.id, lessonId)) return;
  touchProgress(me.id, lessonId);
  getDb().prepare("UPDATE lesson_progress SET challenge_done = ? WHERE user_id = ? AND lesson_id = ?").run(done ? 1 : 0, me.id, lessonId);
  refreshApp();
}

export async function completeLesson(lessonId: string): Promise<void> {
  const me = await requireRole("student");
  if (!assertAccessible(me.id, lessonId)) return;
  touchActive(me.id);
  const now = fmtDateTime(new Date());
  getDb()
    .prepare(
      "INSERT INTO lesson_progress (user_id, lesson_id, status, started_at, completed_at) VALUES (?, ?, 'completed', ?, ?) ON CONFLICT(user_id, lesson_id) DO UPDATE SET status = 'completed', started_at = COALESCE(lesson_progress.started_at, excluded.started_at), completed_at = excluded.completed_at",
    )
    .run(me.id, lessonId, now, now);
  refreshApp();
}

/* ---------------- Self-paced unlock (Proposal 1) ---------------- */

/**
 * Record how far the student has played the lesson's podcast episode, as a
 * fraction between 0 and 1. Called client-side as the player progresses.
 */
export async function setPodcastProgress(lessonId: string, progress: number): Promise<void> {
  const me = await requireRole("student");
  if (!assertAccessible(me.id, lessonId)) return;
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  touchProgress(me.id, lessonId);
  // Never let a stored value go backwards (e.g. a scrub to the start).
  getDb()
    .prepare("UPDATE lesson_progress SET podcast_progress = MAX(podcast_progress, ?) WHERE user_id = ? AND lesson_id = ?")
    .run(clamped, me.id, lessonId);
  refreshApp();
}

export interface UnlockResult {
  /** True only when this call advanced the student's frontier to a new lesson. */
  unlocked: boolean;
  /** The next lesson id, if any. */
  nextLessonId: string | null;
  /** Whether all three self-paced conditions are currently met for this lesson. */
  conditionsMet: boolean;
}

/**
 * The default self-paced path: when a student has marked the simulation
 * complete, written a reflection of at least 75 words, AND played the podcast
 * past {@link PODCAST_UNLOCK_THRESHOLD}, the current lesson is marked complete
 * and the next lesson unlocks for them automatically — no instructor needed.
 *
 * Called client-side after the podcast crosses 0.8 and after reflection submit.
 */
export async function checkAndUnlockNextLesson(lessonId: string): Promise<UnlockResult> {
  const me = await requireRole("student");
  touchActive(me.id);
  const f = studentFrontier(me.id);
  if (!f) return { unlocked: false, nextLessonId: null, conditionsMet: false };

  const detail = progressDetail(me.id, lessonId);
  const check = unlockChecklist(detail);
  if (!check.allMet) return { unlocked: false, nextLessonId: null, conditionsMet: false };

  const lessonIdx = f.ordered.findIndex((l) => l.id === lessonId);
  if (lessonIdx === -1) return { unlocked: false, nextLessonId: null, conditionsMet: true };

  const db = getDb();
  // The three core conditions are satisfied — lock in completion.
  const now = fmtDateTime(new Date());
  db.prepare(
    "INSERT INTO lesson_progress (user_id, lesson_id, status, started_at, completed_at) VALUES (?, ?, 'completed', ?, ?) ON CONFLICT(user_id, lesson_id) DO UPDATE SET status = 'completed', started_at = COALESCE(lesson_progress.started_at, excluded.started_at), completed_at = COALESCE(lesson_progress.completed_at, excluded.completed_at)",
  ).run(me.id, lessonId, now, now);

  const next = f.ordered[lessonIdx + 1] ?? null;
  const nextIdx = lessonIdx + 1;
  const newlyUnlocked = !!next && nextIdx > f.frontierIdx;

  if (next) {
    const selfIdx = f.ordered.findIndex((l) => l.id === f.enr.unlocked_lesson_id);
    if (nextIdx > selfIdx) {
      db.prepare("UPDATE enrollments SET unlocked_lesson_id = ? WHERE user_id = ? AND cohort_id = ?")
        .run(next.id, me.id, f.cohort.id);
    }
  }

  refreshApp();
  return { unlocked: newlyUnlocked, nextLessonId: next ? next.id : null, conditionsMet: true };
}

/* ---------------- Account deletion requests ---------------- */

export async function requestAccountDeletion(): Promise<void> {
  const me = await requireRole("student", "instructor", "admin");
  getDb().prepare("UPDATE users SET deletion_requested = 1 WHERE id = ?").run(me.id);
  refreshApp();
}

export async function dismissDeletionRequest(userId: string): Promise<void> {
  await requireRole("admin");
  getDb().prepare("UPDATE users SET deletion_requested = 0 WHERE id = ?").run(userId);
  refreshApp();
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateTime(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
