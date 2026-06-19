"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { requireRole } from "@/lib/dal";
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

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
