/* ============================================================
 * Data Access Layer — the single place auth checks live.
 *
 * `getCurrentUser` is memoized per render pass so a request only
 * hits the session table once. `requireUser` / `requireRole` are the
 * guards used by the app layout and server actions.
 *
 * Server-only.
 * ============================================================ */

import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getDb, readAppData } from "@/lib/db";
import type { AppData, Role, User } from "@/lib/account";
import { getInstructorByUserId, type Instructor } from "@/lib/hiring";

export const getCurrentUser = cache(async (): Promise<User | null> => {
  return getSessionUser();
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.passwordChangeRequired) redirect("/change-password");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<User> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/app");
  return user;
}

/** Staff = admin or growth — the two roles that run BOW HQ. */
export async function requireStaff(): Promise<User> {
  return requireRole("admin", "growth");
}

export async function requireAdmin(): Promise<User> {
  return requireRole("admin");
}

/**
 * Community access is intentionally stricter than course access. A student
 * must have entered through a staff-issued, accepted invitation and still
 * hold an active enrollment; open self-paced preview accounts cannot enter a
 * shared space with invited minors. Active instructors and staff retain
 * access through their authenticated organization membership.
 */
export async function requireDiscussionMember(): Promise<User> {
  const user = await requireUser();
  const db = getDb();
  const activeOrganization = db.prepare(
    "SELECT 1 FROM organizations WHERE id = ? AND status = 'active'",
  ).get(user.orgId);
  if (!activeOrganization) redirect("/app");
  if (user.role === "student") {
    const approved = db.prepare(
      `SELECT 1
         FROM invitations i
        WHERE i.status = 'accepted' AND i.role = 'student'
          AND i.org_id = ? AND lower(trim(i.email)) = lower(trim(?))
          AND EXISTS (
            SELECT 1 FROM enrollments e
             WHERE e.user_id = ? AND e.enroll = 'active'
          )
        LIMIT 1`,
    ).get(user.orgId, user.email, user.id);
    if (!approved) redirect("/app/student?community=invitation-required");
  }
  if (user.role === "instructor") {
    const instructor = getInstructorByUserId(user.id);
    if (!instructor || instructor.stage !== "active" || instructor.eligibilityStatus !== "eligible") {
      redirect("/app/teach");
    }
  }
  return user;
}

/**
 * Guards every teaching surface with the canonical instructor-quality record.
 * Legacy instructor accounts are migrated to that model at database upgrade;
 * a missing or ambiguous dossier therefore fails closed instead of becoming a
 * side door around hiring, training, eligibility, and deactivation controls.
 */
export async function requireTeachingUser(): Promise<User> {
  const user = await requireRole("instructor", "admin");
  if (user.role === "admin") return user;

  const instructor = getInstructorByUserId(user.id);
  if (!instructor) redirect("/app/settings");
  if (instructor.stage !== "active" || instructor.eligibilityStatus !== "eligible") {
    if (!["inactive", "rejected"].includes(instructor.stage)) redirect("/app/teach");
    redirect("/app/settings");
  }
  return user;
}

/**
 * Resolves the signed-in instructor's own `instructors` row via
 * `people.user_id = me.id`. Redirects to /app for anyone without one
 * (including existing LMS-only instructor seeds like u-coach, who have
 * no BOW HQ instructor record) — this is the security boundary for
 * /app/teach-style self-service pages, not just a UX nicety.
 */
export async function requireInstructorSelf(): Promise<{ user: User; instructor: Instructor }> {
  const user = await requireRole("instructor");
  const instructor = getInstructorByUserId(user.id);
  if (!instructor || instructor.stage === "inactive" || instructor.stage === "rejected") redirect("/app");
  return { user, instructor };
}

/** Delivery data is restricted to currently active, eligible instructors. */
export async function requireActiveInstructorSelf(): Promise<{ user: User; instructor: Instructor }> {
  const resolved = await requireInstructorSelf();
  if (resolved.instructor.stage !== "active" || resolved.instructor.eligibilityStatus !== "eligible") {
    redirect("/app");
  }
  return resolved;
}

/** Load the full LMS snapshot for the signed-in app shell. */
export async function loadAppData(): Promise<AppData> {
  return readAppData();
}
