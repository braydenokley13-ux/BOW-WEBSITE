"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { currentWeeklyChallengeId } from "@/lib/weekly";

export interface WeeklyChallengeResult {
  ok: boolean;
  error?: "empty" | "closed";
}

/**
 * Submit the student's response to the current Weekly Challenge and earn the
 * Weekly Finisher badge (the weekly_completions row). Gated: only the currently
 * open challenge accepts submissions, so past challenges stay view-only and a
 * student can't backfill old weeks by calling the action directly. One
 * submission per student per challenge (UNIQUE constraint).
 */
export async function submitWeeklyChallenge(
  challengeId: string,
  responseText: string,
): Promise<WeeklyChallengeResult> {
  const me = await requireRole("student");
  const text = responseText.trim();
  if (!text) return { ok: false, error: "empty" };

  // Only the open challenge is submittable.
  if (challengeId !== currentWeeklyChallengeId()) return { ok: false, error: "closed" };

  getDb()
    .prepare(
      "INSERT OR IGNORE INTO weekly_completions (id, student_id, challenge_id, response_text, submitted_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(`wcmp-${randomUUID().slice(0, 12)}`, me.id, challengeId, text, Date.now());

  getDb().prepare("UPDATE users SET last_active_at = ? WHERE id = ?").run(Date.now(), me.id);
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  return { ok: true };
}
