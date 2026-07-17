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
import { readAppData } from "@/lib/db";
import type { AppData, Role, User } from "@/lib/account";
import { getInstructorByUserId, type Instructor } from "@/lib/hiring";

export const getCurrentUser = cache(async (): Promise<User | null> => {
  return getSessionUser();
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
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
 * Resolves the signed-in instructor's own `instructors` row via
 * `people.user_id = me.id`. Redirects to /app for anyone without one
 * (including existing LMS-only instructor seeds like u-coach, who have
 * no BOW HQ instructor record) — this is the security boundary for
 * /app/teach-style self-service pages, not just a UX nicety.
 */
export async function requireInstructorSelf(): Promise<{ user: User; instructor: Instructor }> {
  const user = await requireRole("instructor");
  const instructor = getInstructorByUserId(user.id);
  if (!instructor) redirect("/app");
  return { user, instructor };
}

/** Load the full LMS snapshot for the signed-in app shell. */
export async function loadAppData(): Promise<AppData> {
  return readAppData();
}
