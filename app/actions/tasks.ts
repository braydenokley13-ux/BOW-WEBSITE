"use server";

/* ============================================================
 * Task mutations — follow-ups and founder handoffs across the
 * hiring pipeline. Staff-only (admin | growth).
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/dal";

export interface CreateTaskInput {
  title: string;
  ownerUserId?: string | null;
  dueAt?: number | null;
  entityType?: string | null;
  entityId?: string | null;
  handoffToFounder?: boolean;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function createTask(input: CreateTaskInput): Promise<ActionResult> {
  await requireStaff();
  const title = (input.title ?? "").trim();
  if (!title) return { ok: false, error: "Title is required." };
  if (title.length > 200) return { ok: false, error: "Title is too long." };
  if (input.entityType && input.entityType.length > 60) return { ok: false, error: "Invalid entity type." };
  if (input.entityId && input.entityId.length > 60) return { ok: false, error: "Invalid entity id." };

  const id = `pfx-${randomUUID().slice(0, 8)}`;
  const now = Date.now();
  getDb()
    .prepare(
      "INSERT INTO tasks (id, title, owner_user_id, due_at, status, entity_type, entity_id, handoff_to_founder, created_at, updated_at) VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)",
    )
    .run(
      id,
      title.slice(0, 200),
      input.ownerUserId ?? null,
      input.dueAt ?? null,
      input.entityType ?? null,
      input.entityId ?? null,
      input.handoffToFounder ? 1 : 0,
      now,
      now,
    );

  revalidatePath("/app/tasks");
  revalidatePath("/app");
  return { ok: true };
}

export async function completeTask(id: string, note?: string): Promise<ActionResult> {
  await requireStaff();
  if (!id) return { ok: false, error: "Missing task id." };
  const now = Date.now();
  getDb()
    .prepare(
      "UPDATE tasks SET status = 'done', completed_at = ?, completion_note = ?, updated_at = ? WHERE id = ?",
    )
    .run(now, (note ?? "").slice(0, 2000) || null, now, id);

  revalidatePath("/app/tasks");
  revalidatePath("/app");
  return { ok: true };
}

export async function reassignTask(id: string, ownerUserId: string): Promise<ActionResult> {
  await requireStaff();
  if (!id) return { ok: false, error: "Missing task id." };
  const now = Date.now();
  getDb().prepare("UPDATE tasks SET owner_user_id = ?, updated_at = ? WHERE id = ?").run(ownerUserId || null, now, id);

  revalidatePath("/app/tasks");
  return { ok: true };
}
