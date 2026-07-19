"use server";

/* ============================================================
 * crm_activity mutations. logActivity() itself (the internal,
 * non-"use server" write helper other actions call) lives in
 * lib/hiring.ts so server actions can call it without going
 * through the server-action boundary.
 * ============================================================ */

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/dal";
import { getDb } from "@/lib/db";
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
  const normalizedType = (entityType ?? "").trim();
  const normalizedId = (entityId ?? "").trim();
  if (!normalizedId || normalizedId.length > 120) return { ok: false, error: "Missing entity." };
  if (kind !== "note") return { ok: false, error: "Public activity entries must be notes." };
  const entityTables: Record<string, string> = {
    instructor: "instructors",
    class: "classes",
    student: "students",
    organization: "organizations",
    program: "programs",
    location: "locations",
    operating_region: "operating_regions",
    task: "tasks",
    training_session: "training_sessions",
    class_proposal: "class_proposals",
    inquiry: "inquiries",
  };
  const table = entityTables[normalizedType];
  if (!table) return { ok: false, error: "Choose a supported operating record." };

  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    if (!db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(normalizedId)) throw new Error("entity_missing");
    logActivity(normalizedType, normalizedId, "note", text.slice(0, 4000), me.id);
    db.exec("COMMIT");
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    if (error instanceof Error && error.message === "entity_missing") {
      return { ok: false, error: "That operating record no longer exists." };
    }
    throw error;
  }

  const entityPaths: Record<string, string> = {
    instructor: `/app/instructors/${normalizedId}`,
    class: `/app/classes/${normalizedId}`,
    student: `/app/students/${normalizedId}`,
    organization: `/app/partners/${normalizedId}`,
    program: `/app/programs/${normalizedId}`,
    location: `/app/locations/${normalizedId}`,
    operating_region: `/app/regions/${normalizedId}`,
    task: "/app/tasks",
    training_session: `/app/training/sessions/${normalizedId}`,
    class_proposal: "/app/classes/proposals",
    inquiry: "/app/inquiries",
  };
  revalidatePath(entityPaths[normalizedType]);
  return { ok: true };
}
