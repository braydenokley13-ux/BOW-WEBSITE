"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { orderedTrackLessons } from "@/lib/account";
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
function assertAccessible(uid: string, lessonId: string): boolean {
  const db = getDb();
  const enr = db.prepare("SELECT * FROM enrollments WHERE user_id = ? AND enroll = 'active'").get(uid) as any;
  if (!enr) return false;
  const cohort = db.prepare("SELECT * FROM cohorts WHERE id = ?").get(enr.cohort_id) as any;
  if (!cohort) return false;
  const ordered = orderedTrackLessons(cohort.track);
  const curIdx = ordered.findIndex((l) => l.id === cohort.current_lesson_id);
  const lessonIdx = ordered.findIndex((l) => l.id === lessonId);
  return lessonIdx !== -1 && curIdx !== -1 && lessonIdx <= curIdx;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function touchProgress(uid: string, lessonId: string) {
  // Ensure a row exists and is at least in-progress.
  const db = getDb();
  db.prepare(
    "INSERT INTO lesson_progress (user_id, lesson_id, status, started_at) VALUES (?, ?, 'in-progress', ?) ON CONFLICT(user_id, lesson_id) DO UPDATE SET status = CASE WHEN lesson_progress.status = 'not-started' THEN 'in-progress' ELSE lesson_progress.status END, started_at = COALESCE(lesson_progress.started_at, excluded.started_at)",
  ).run(uid, lessonId, fmtDateTime(new Date()));
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
  const now = fmtDateTime(new Date());
  getDb()
    .prepare(
      "INSERT INTO lesson_progress (user_id, lesson_id, status, started_at, completed_at) VALUES (?, ?, 'completed', ?, ?) ON CONFLICT(user_id, lesson_id) DO UPDATE SET status = 'completed', started_at = COALESCE(lesson_progress.started_at, excluded.started_at), completed_at = excluded.completed_at",
    )
    .run(me.id, lessonId, now, now);
  refreshApp();
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
