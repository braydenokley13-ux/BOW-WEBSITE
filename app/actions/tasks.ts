"use server";

/* ============================================================
 * Universal Work mutations. Work can be captured by BOW staff,
 * while founder handoffs remain an admin-only decision boundary.
 * Every mutation and its audit record commit atomically.
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireAdmin, requireStaff } from "@/lib/dal";
import { logActivity } from "@/lib/hiring";
import { canonicalDateToUtcNoon } from "@/lib/timezone";

const WORK_KINDS = ["task", "issue", "decision", "follow_up", "meeting", "review"] as const;
const WORK_PRIORITIES = ["normal", "high", "urgent"] as const;
const ENTITY_TABLES = {
  instructor: "instructors",
  class: "classes",
  student: "students",
  organization: "organizations",
  program: "programs",
  location: "locations",
  region: "operating_regions",
} as const;

type WorkKind = (typeof WORK_KINDS)[number];
type WorkPriority = (typeof WORK_PRIORITIES)[number];
type WorkEntityType = keyof typeof ENTITY_TABLES;

export interface CreateTaskInput {
  title: string;
  kind?: string;
  priority?: string;
  context?: string | null;
  recommendedAction?: string | null;
  ownerUserId?: string | null;
  dueDate?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  handoffToFounder?: boolean;
}

export interface ActionResult {
  ok: boolean;
  id?: string;
  error?: string;
}

class WorkActionError extends Error {}

function cleanOptionalText(value: unknown): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

function isWorkKind(value: string): value is WorkKind {
  return WORK_KINDS.includes(value as WorkKind);
}

function isWorkPriority(value: string): value is WorkPriority {
  return WORK_PRIORITIES.includes(value as WorkPriority);
}

function isWorkEntityType(value: string): value is WorkEntityType {
  return Object.hasOwn(ENTITY_TABLES, value);
}

async function assertActiveStaffOwner(db: ReturnType<typeof getDb>, userId: string | null): Promise<void> {
  if (!userId) return;
  const owner = (await db
      .prepare("SELECT 1 FROM users WHERE id = ? AND role IN ('admin','growth') AND status = 'active'")
      .get(userId));
  if (!owner) throw new WorkActionError("Choose an active BOW staff owner.");
}

async function assertRelatedEntity(db: ReturnType<typeof getDb>, entityType: WorkEntityType | null, entityId: string | null): Promise<void> {
  if (!entityType && !entityId) return;
  if (!entityType || !entityId) throw new WorkActionError("Choose both a related record type and record ID.");
  const table = ENTITY_TABLES[entityType];
  if (!(await db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(entityId))) {
    throw new WorkActionError("The related record no longer exists.");
  }
}

async function runImmediate<T>(operation: (db: ReturnType<typeof getDb>) => T): Promise<T> {
  const db = getDb();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const result = operation(db);
    (await db.exec("COMMIT"));
    return result;
  } catch (error) {
    if (db.isTransaction) (await db.exec("ROLLBACK"));
    throw error;
  }
}

function actionError(error: unknown): ActionResult {
  if (error instanceof WorkActionError) return { ok: false, error: error.message };
  throw error;
}

function revalidateWork(): void {
  revalidatePath("/app/tasks");
  revalidatePath("/app");
}

export async function createTask(input: CreateTaskInput): Promise<ActionResult> {
  const me = await requireStaff();
  const title = cleanOptionalText(input?.title);
  const context = cleanOptionalText(input?.context);
  const recommendedAction = cleanOptionalText(input?.recommendedAction);
  const ownerUserId = cleanOptionalText(input?.ownerUserId);
  const entityTypeValue = cleanOptionalText(input?.entityType);
  const entityId = cleanOptionalText(input?.entityId);
  const kindValue = cleanOptionalText(input?.kind) ?? "task";
  const priorityValue = cleanOptionalText(input?.priority) ?? "normal";
  const legacyDueAt = (input as CreateTaskInput & { dueAt?: unknown })?.dueAt;
  if (legacyDueAt !== undefined) {
    return { ok: false, error: "Send the Work due date as YYYY-MM-DD, without a browser-local timestamp." };
  }
  if (input?.dueDate != null && typeof input.dueDate !== "string") {
    return { ok: false, error: "Choose a valid due date." };
  }
  const dueDate = cleanOptionalText(input?.dueDate);
  const dueDateResolution = dueDate ? canonicalDateToUtcNoon(dueDate) : null;
  if (dueDateResolution && !dueDateResolution.ok) return { ok: false, error: dueDateResolution.error };
  if (dueDateResolution?.ok && (dueDateResolution.canonicalDate < "2000-01-01" || dueDateResolution.canonicalDate > "2100-12-31")) {
    return { ok: false, error: "Choose a due date between 2000 and 2100." };
  }
  const dueAt = dueDateResolution?.ok ? dueDateResolution.epoch : null;

  if (!title) return { ok: false, error: "Title is required." };
  if (title.length > 200) return { ok: false, error: "Title is too long." };
  if (!isWorkKind(kindValue)) return { ok: false, error: "Choose a valid Work type." };
  if (!isWorkPriority(priorityValue)) return { ok: false, error: "Choose a valid priority." };
  if (entityTypeValue && !isWorkEntityType(entityTypeValue)) {
    return { ok: false, error: "Choose a valid related record type." };
  }
  if (context && context.length > 2000) return { ok: false, error: "Context is too long." };
  if (recommendedAction && recommendedAction.length > 1000) {
    return { ok: false, error: "Recommended action is too long." };
  }
  if (input?.handoffToFounder != null && typeof input.handoffToFounder !== "boolean") {
    return { ok: false, error: "Choose a valid founder handoff setting." };
  }
  if (ownerUserId && ownerUserId.length > 100) return { ok: false, error: "Choose a valid owner." };
  if (entityId && entityId.length > 100) return { ok: false, error: "Related record ID is too long." };
  const entityType = entityTypeValue as WorkEntityType | null;
  const id = `wrk-${randomUUID().slice(0, 12)}`;
  const now = Date.now();

  try {
    (await runImmediate(async (db) => {
            (await assertActiveStaffOwner(db, ownerUserId));
            (await assertRelatedEntity(db, entityType, entityId));
            (await db.prepare(
                      `INSERT INTO tasks
          (id, title, owner_user_id, due_at, due_on, status, kind, priority, context, recommended_action,
           entity_type, entity_id, handoff_to_founder, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    ).run(
                      id,
                      title,
                      ownerUserId,
                      dueAt ?? null,
                      dueDateResolution?.ok ? dueDateResolution.canonicalDate : null,
                      kindValue,
                      priorityValue,
                      context,
                      recommendedAction,
                      entityType,
                      entityId,
                      input?.handoffToFounder ? 1 : 0,
                      now,
                      now,
                    ));
            (await logActivity(
                      "task",
                      id,
                      "created",
                      `Captured manually in Work as ${kindValue.replace(/_/g, " ")} (${priorityValue} priority)${
                        entityType && entityId ? ` for ${entityType} ${entityId}` : ""
                      }.`,
                      me.id,
                    ));
          }));
  } catch (error) {
    return actionError(error);
  }

  revalidateWork();
  return { ok: true, id };
}

async function mutationActor(id: string): Promise<Awaited<ReturnType<typeof requireStaff>>> {
  let me = await requireStaff();
  const snapshot = (await getDb().prepare("SELECT handoff_to_founder FROM tasks WHERE id = ?").get(id)) as
    | { handoff_to_founder: number }
    | undefined;
  if (snapshot?.handoff_to_founder === 1 && me.role !== "admin") me = await requireAdmin();
  return me;
}

export async function completeTask(idValue: string, noteValue?: string): Promise<ActionResult> {
  const id = cleanOptionalText(idValue);
  if (!id || id.length > 100) return { ok: false, error: "Missing task id." };
  const note = cleanOptionalText(noteValue);
  if (note && note.length > 2000) return { ok: false, error: "Completion note is too long." };
  const me = await mutationActor(id);
  const now = Date.now();

  try {
    (await runImmediate(async (db) => {
            const task = (await db.prepare(
                    "SELECT status, owner_user_id, handoff_to_founder, updated_at FROM tasks WHERE id = ?",
                  ).get(id)) as
              | { status: string; owner_user_id: string | null; handoff_to_founder: number; updated_at: number }
              | undefined;
            if (!task || task.status !== "open") {
              throw new WorkActionError("This Work item was already completed or no longer exists.");
            }
            if (task.handoff_to_founder === 1 && me.role !== "admin") {
              throw new WorkActionError("Only an admin can resolve founder-decision Work.");
            }
            const completed = (await db.prepare(
                    `UPDATE tasks
            SET status = 'done', completed_at = ?, completion_note = ?, updated_at = ?
          WHERE id = ? AND status = 'open' AND updated_at = ? AND handoff_to_founder = ?`,
                  ).run(now, note, now, id, task.updated_at, task.handoff_to_founder));
            if (completed.changes !== 1) throw new WorkActionError("This Work item changed. Refresh and try again.");
            (await logActivity(
                      "task",
                      id,
                      "completed",
                      `Completed from Work${note ? ` with outcome: ${note}` : " without a completion note"}. Prior owner: ${
                        task.owner_user_id ?? "unassigned"
                      }.`,
                      me.id,
                    ));
          }));
  } catch (error) {
    return actionError(error);
  }

  revalidateWork();
  return { ok: true };
}

export async function reassignTask(idValue: string, ownerValue: string): Promise<ActionResult> {
  const id = cleanOptionalText(idValue);
  if (!id || id.length > 100) return { ok: false, error: "Missing task id." };
  const ownerUserId = cleanOptionalText(ownerValue);
  if (ownerUserId && ownerUserId.length > 100) return { ok: false, error: "Choose a valid owner." };
  const me = await mutationActor(id);
  const now = Date.now();

  try {
    (await runImmediate(async (db) => {
            const task = (await db.prepare(
                    "SELECT status, owner_user_id, handoff_to_founder, updated_at FROM tasks WHERE id = ?",
                  ).get(id)) as
              | { status: string; owner_user_id: string | null; handoff_to_founder: number; updated_at: number }
              | undefined;
            if (!task || task.status !== "open") throw new WorkActionError("This Work item is completed or no longer exists.");
            if (task.handoff_to_founder === 1 && me.role !== "admin") {
              throw new WorkActionError("Only an admin can reassign founder-decision Work.");
            }
            if (task.owner_user_id === ownerUserId) throw new WorkActionError("Choose a different owner.");
            (await assertActiveStaffOwner(db, ownerUserId));
            const updated = (await db.prepare(
                    `UPDATE tasks SET owner_user_id = ?, updated_at = ?
          WHERE id = ? AND status = 'open' AND updated_at = ? AND handoff_to_founder = ?`,
                  ).run(ownerUserId, now, id, task.updated_at, task.handoff_to_founder));
            if (updated.changes !== 1) throw new WorkActionError("This Work item changed. Refresh and try again.");
            (await logActivity(
                      "task",
                      id,
                      "owner_changed",
                      `Owner changed from ${task.owner_user_id ?? "unassigned"} to ${ownerUserId ?? "unassigned"} in Work.`,
                      me.id,
                    ));
          }));
  } catch (error) {
    return actionError(error);
  }

  revalidateWork();
  return { ok: true };
}
