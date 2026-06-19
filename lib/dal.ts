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

/** Load the full LMS snapshot for the signed-in app shell. */
export async function loadAppData(): Promise<AppData> {
  return readAppData();
}
