"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/dal";

/** Mark one of the signed-in user's notifications read. Scoped to the owner. */
export async function markNotificationRead(notificationId: string): Promise<{ ok: boolean }> {
  const me = await requireUser();
  getDb()
    .prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?")
    .run(notificationId, me.id);
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Mark all of the signed-in user's notifications read. */
export async function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  const me = await requireUser();
  getDb().prepare("UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0").run(me.id);
  revalidatePath("/dashboard");
  return { ok: true };
}
