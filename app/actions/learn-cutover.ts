"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import { getDb } from "@/lib/db";

export type CutoverActionResult = { ok: true } | { ok: false; error: string };

export async function setLearnCutover(input: { enabled: boolean; reason: string }): Promise<CutoverActionResult> {
  const me = await requireAdmin();
  const reason = input.reason.trim().slice(0, 2_000);
  if (reason.length < 10) return { ok: false, error: "Record why the student cutover is changing." };
  const db = getDb();
  const now = Date.now();
  await db.exec("BEGIN IMMEDIATE");
  try {
    const current = (await db.prepare(
      "SELECT enabled FROM app_feature_flags WHERE key = 'learn_cutover' FOR UPDATE",
    ).get()) as { enabled: boolean } | undefined;
    if (!current) throw new Error("missing_flag");
    const prior = Boolean(current.enabled);
    if (prior !== input.enabled) {
      await db.prepare(
        "UPDATE app_feature_flags SET enabled = ?, updated_by_user_id = ?, updated_at = ? WHERE key = 'learn_cutover'",
      ).run(input.enabled, me.id, now);
      await db.prepare(
        `INSERT INTO app_feature_flag_events
         (id, flag_key, prior_enabled, next_enabled, reason, actor_user_id, created_at)
         VALUES (?, 'learn_cutover', ?, ?, ?, ?, ?)`,
      ).run(`ffe-${randomUUID().slice(0, 12)}`, prior, input.enabled, reason, me.id, now);
    }
    await db.exec("COMMIT");
    revalidatePath("/app/admin/learn");
    revalidatePath("/app/student");
    revalidatePath("/app/student/track");
    revalidatePath("/app/student/lesson");
    return { ok: true };
  } catch {
    if (db.isTransaction) await db.exec("ROLLBACK");
    return { ok: false, error: "The cutover switch could not be changed." };
  }
}
