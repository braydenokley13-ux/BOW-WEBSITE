"use server";

/* ============================================================
 * crm_activity mutations. logActivity() itself (the internal,
 * non-"use server" write helper other actions call) lives in
 * lib/hiring.ts so server actions can call it without going
 * through the server-action boundary.
 * ============================================================ */

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/dal";
import { logActivity } from "@/lib/hiring";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function addActivityNote(
  entityType: string,
  entityId: string,
  body: string,
  kind: string = "note",
): Promise<ActionResult> {
  const me = await requireStaff();
  const text = (body ?? "").trim();
  if (!text) return { ok: false, error: "Note can't be empty." };
  if (text.length > 4000) return { ok: false, error: "Note is too long." };
  if (!entityType || !entityId) return { ok: false, error: "Missing entity." };

  logActivity(entityType, entityId, kind.slice(0, 40) || "note", text.slice(0, 4000), me.id);

  revalidatePath(`/app/${entityType}s/${entityId}`);
  return { ok: true };
}
