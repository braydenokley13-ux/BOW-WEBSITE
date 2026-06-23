"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireRole } from "@/lib/dal";

/**
 * Mark the signed-in student's first-time onboarding as complete and send
 * them on to their dashboard. Called by the final screen of the onboarding
 * flow. Setting the flag means the onboarding layout will redirect straight
 * to /dashboard on every future visit, so the flow never shows again.
 *
 * `redirect` throws to perform the navigation, so it is called at the top
 * level (outside any try/catch) per the Next.js server-action contract.
 */
export async function completeOnboarding(): Promise<void> {
  const me = await requireRole("student");
  getDb().prepare("UPDATE users SET onboarding_completed = 1 WHERE id = ?").run(me.id);
  redirect("/dashboard");
}
