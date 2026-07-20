"use server";

/* ============================================================
 * Flywheel mutations: class closeouts, growth introductions, and
 * bulk referral-invite prompts. Deterministic lifecycle bookkeeping —
 * no outbound messages are sent from here; these create the visible,
 * assignable work that causes the next growth event.
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/dal";
import { logActivity } from "@/lib/hiring";
import {
  applyTaskOutcome,
  convertIntroductionCore,
  ensureFlywheelSchema,
  materializeGrowthAction,
} from "@/lib/flywheel";
import type { TaskOutcome } from "@/lib/flywheel-shared";
import {
  CLOSEOUT_FIELDS,
  INTRODUCTION_STATUSES,
  INTRODUCTION_TARGET_KINDS,
  type CloseoutField,
} from "@/lib/flywheel-shared";

export interface FlywheelActionResult {
  ok: boolean;
  error?: string;
  count?: number;
}

const CLOSEOUT_KEYS = new Set<string>(CLOSEOUT_FIELDS.map((field) => field.key));

function fail(error: unknown, fallback: string): FlywheelActionResult {
  return { ok: false, error: error instanceof Error ? error.message : fallback };
}

/** Toggle one closeout checklist item; completes the closeout when all are done. */
export async function updateClassCloseout(
  classIdValue: string,
  fieldValue: string,
  checked: boolean,
): Promise<FlywheelActionResult> {
  try {
    const viewer = await requireStaff();
    await ensureFlywheelSchema();
    const classId = String(classIdValue ?? "").trim();
    const field = String(fieldValue ?? "").trim() as CloseoutField;
    if (!classId || !CLOSEOUT_KEYS.has(field)) return { ok: false, error: "Invalid closeout update." };
    const db = getDb();
    const cls = (await db.prepare("SELECT id FROM classes WHERE id = ?").get(classId));
    if (!cls) return { ok: false, error: "Class not found." };
    const now = Date.now();
    await db.prepare(
      `INSERT INTO class_closeouts (class_id, ${field}, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (class_id) DO UPDATE SET ${field} = ?, updated_at = ?`,
    ).run(classId, checked ? 1 : 0, now, checked ? 1 : 0, now);
    const allDone = CLOSEOUT_FIELDS.map((item) => `${item.key} = 1`).join(" AND ");
    await db.prepare(
      `UPDATE class_closeouts
          SET completed_at = CASE WHEN ${allDone} THEN COALESCE(completed_at, ?) ELSE NULL END
        WHERE class_id = ?`,
    ).run(now, classId);
    await logActivity("class", classId, "closeout", `${field.replace(/_/g, " ")} → ${checked ? "done" : "reopened"}`, viewer.id);
    revalidatePath(`/app/classes/${classId}`);
    revalidatePath("/app/growth");
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not update the closeout.");
  }
}

/** Record that someone offered/was asked for an introduction to a new community. */
export async function recordIntroduction(input: {
  introducerType: string;
  introducerId: string;
  targetKind: string;
  targetName: string;
  note?: string;
}): Promise<FlywheelActionResult> {
  try {
    const viewer = await requireStaff();
    await ensureFlywheelSchema();
    const introducerType = String(input?.introducerType ?? "").trim();
    const introducerId = String(input?.introducerId ?? "").trim();
    const targetKind = String(input?.targetKind ?? "").trim();
    const targetName = String(input?.targetName ?? "").trim();
    const note = String(input?.note ?? "").trim();
    if (!["instructor", "student", "partner", "contributor"].includes(introducerType) || !introducerId) {
      return { ok: false, error: "Invalid introducer." };
    }
    if (!(INTRODUCTION_TARGET_KINDS as readonly string[]).includes(targetKind)) {
      return { ok: false, error: "Invalid introduction target." };
    }
    if (targetName.length < 2) return { ok: false, error: "Name who is being introduced." };
    const db = getDb();
    const id = `int-${randomUUID().slice(0, 12)}`;
    await db.prepare(
      `INSERT INTO growth_introductions (id, introducer_type, introducer_id, target_kind, target_name, status, note, owner_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, 'suggested', ?, ?, ?)`,
    ).run(id, introducerType, introducerId, targetKind, targetName, note, viewer.id, Date.now());
    if (introducerType === "instructor" || introducerType === "student") {
      await logActivity(introducerType, introducerId, "introduction", `Introduction suggested: ${targetName} (${targetKind})`, viewer.id);
    }
    revalidatePath(introducerType === "instructor" ? `/app/instructors/${introducerId}` : "/app/growth");
    revalidatePath("/app/growth");
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not record the introduction.");
  }
}

/** Advance an introduction: contacted → converted/declined. */
export async function setIntroductionStatus(idValue: string, statusValue: string): Promise<FlywheelActionResult> {
  try {
    const viewer = await requireStaff();
    await ensureFlywheelSchema();
    const id = String(idValue ?? "").trim();
    const status = String(statusValue ?? "").trim();
    if (!(INTRODUCTION_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Invalid status." };
    const db = getDb();
    const row = (await db.prepare("SELECT id, introducer_type, introducer_id, target_name FROM growth_introductions WHERE id = ?").get(id)) as
      | { id: string; introducer_type: string; introducer_id: string; target_name: string }
      | undefined;
    if (!row) return { ok: false, error: "Introduction not found." };
    const resolved = status === "converted" || status === "declined" ? Date.now() : null;
    await db.prepare("UPDATE growth_introductions SET status = ?, resolved_at = ? WHERE id = ?").run(status, resolved, id);
    if (row.introducer_type === "instructor" || row.introducer_type === "student") {
      await logActivity(row.introducer_type, row.introducer_id, "introduction", `Introduction ${status}: ${row.target_name}`, viewer.id);
    }
    revalidatePath(row.introducer_type === "instructor" ? `/app/instructors/${row.introducer_id}` : "/app/growth");
    revalidatePath("/app/growth");
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not update the introduction.");
  }
}

/**
 * Create one "Referral invite" follow-up per completed student who has never
 * been prompted. Creates work, sends nothing — the invite itself stays human.
 */
export async function promptReferralInvites(): Promise<FlywheelActionResult> {
  try {
    const viewer = await requireStaff();
    await ensureFlywheelSchema();
    const db = getDb();
    const eligible = (await db.prepare(
      `SELECT DISTINCT o.student_id, s.name
         FROM student_program_outcomes o
         JOIN students s ON s.id = o.student_id
        WHERE o.outcome_type IN ('completed','graduated')
          AND NOT EXISTS (
            SELECT 1 FROM student_referrals r
             WHERE r.referrer_person_id = s.person_id AND r.voided_at IS NULL)
          AND NOT EXISTS (
            SELECT 1 FROM tasks t
             WHERE t.entity_type = 'student' AND t.entity_id = o.student_id AND t.title = 'Referral invite')
        LIMIT 50`,
    ).all()) as { student_id: string; name: string }[];
    const now = Date.now();
    for (const student of eligible) {
      await db.prepare(
        `INSERT INTO tasks (id, title, owner_user_id, status, kind, priority, context, recommended_action, entity_type, entity_id, handoff_to_founder, created_at, updated_at)
         VALUES (?, 'Referral invite', ?, 'open', 'follow_up', 'normal', ?, ?, 'student', ?, 0, ?, ?)`,
      ).run(
        `wrk-${randomUUID().slice(0, 12)}`,
        viewer.id,
        `${student.name} completed a program and has not been asked to refer.`,
        "Invite a friend or sibling while the experience is fresh; log any referral in Growth.",
        student.student_id,
        now,
        now,
      );
    }
    revalidatePath("/app/tasks");
    revalidatePath("/app/growth");
    return { ok: true, count: eligible.length };
  } catch (error) {
    return fail(error, "Could not create referral invites.");
  }
}

/** Assign a derived flywheel signal to an owner as a dated Work item (deduped). */
export async function assignGrowthAction(input: {
  key: string;
  ownerUserId?: string | null;
  dueOn?: string | null;
}): Promise<FlywheelActionResult> {
  try {
    const viewer = await requireStaff();
    const key = String(input?.key ?? "").trim();
    if (!key.includes(":")) return { ok: false, error: "Invalid action." };
    const owner = input?.ownerUserId ? String(input.ownerUserId).trim() : null;
    if (owner) {
      const exists = (await getDb().prepare("SELECT 1 FROM users WHERE id = ? AND status = 'active'").get(owner));
      if (!exists) return { ok: false, error: "Pick an active owner." };
    }
    const dueOn = input?.dueOn && /^\d{4}-\d{2}-\d{2}$/.test(String(input.dueOn)) ? String(input.dueOn) : null;
    const result = await materializeGrowthAction(viewer.id, key, owner, dueOn);
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath("/app/growth");
    revalidatePath("/app/tasks");
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not assign this action.");
  }
}

/** Record a structured outcome; the system schedules the deterministic next step. */
export async function recordTaskOutcome(input: {
  taskId: string;
  outcome: string;
  note?: string;
  followUpOn?: string | null;
}): Promise<FlywheelActionResult> {
  try {
    const viewer = await requireStaff();
    const followUpOn = input?.followUpOn && /^\d{4}-\d{2}-\d{2}$/.test(String(input.followUpOn)) ? String(input.followUpOn) : null;
    const result = await applyTaskOutcome(
      viewer.id,
      String(input?.taskId ?? "").trim(),
      String(input?.outcome ?? "").trim() as TaskOutcome,
      String(input?.note ?? "").trim(),
      followUpOn,
    );
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath("/app/tasks");
    revalidatePath("/app/growth");
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not record the outcome.");
  }
}

/** Convert a made introduction into a real partner organization + first-conversation task. */
export async function convertIntroductionToPartner(input: {
  introId: string;
  organizationName?: string;
  organizationType?: string;
}): Promise<FlywheelActionResult> {
  try {
    const viewer = await requireStaff();
    const result = await convertIntroductionCore(
      viewer.id,
      String(input?.introId ?? "").trim(),
      String(input?.organizationName ?? ""),
      String(input?.organizationType ?? ""),
    );
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath("/app/growth");
    revalidatePath("/app/tasks");
    revalidatePath("/app/partners");
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not convert the introduction.");
  }
}
