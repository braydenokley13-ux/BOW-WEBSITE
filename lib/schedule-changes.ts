/* ============================================================
 * Schedule changes and cancellations.
 *
 * Changing a schedule is a communication event, not just a write. This module
 * exists so the two cannot come apart: recording the change and notifying
 * every affected family happen in one call, and the resulting
 * `schedule_changes` row carries the before, the after, the reason, who did
 * it, how many families were affected, and how many were told.
 *
 * The old schedule is preserved because "what did it used to say?" is the
 * first question asked when a family arrives at the wrong time, and
 * `class_sessions` alone cannot answer it — it holds only the current value.
 *
 * Server-only, not a "use server" module.
 * ============================================================ */

import "server-only";

import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { recordAudit, recordNotification } from "@/lib/enrollment";

export type ScheduleChangeKind =
  | "session_cancelled"
  | "session_rescheduled"
  | "class_paused"
  | "program_cancelled"
  | "location_changed";

/** Changes a family must acknowledge, because missing one wastes a trip. */
const NEEDS_ACKNOWLEDGMENT: ReadonlySet<ScheduleChangeKind> = new Set([
  "session_rescheduled",
  "location_changed",
  "program_cancelled",
]);

export interface AffectedFamily {
  registrationId: string;
  studentId: string;
  studentName: string;
  guardianPersonId: string | null;
  guardianName: string | null;
  guardianEmail: string | null;
}

/**
 * Who a change reaches. Scoped to registrations that still hold a seat: a
 * withdrawn family should not be told that a program they left moved, and a
 * waitlisted family has no session to miss.
 */
export async function affectedFamilies(options: {
  programId?: string | null;
  classId?: string | null;
}): Promise<AffectedFamily[]> {
  const db = getDb();
  if (!options.programId && !options.classId) return [];
  // Built conditionally rather than with `? IS NULL OR ...` guards: Postgres
  // cannot infer a parameter's type from a bare NULL comparison, and adding
  // casts to work around that reads worse than only asking for the filters
  // the caller actually supplied.
  const filters: string[] = ["r.holds_seat = true"];
  const parameters: string[] = [];
  if (options.programId) {
    filters.push("r.program_id = ?");
    parameters.push(options.programId);
  }
  if (options.classId) {
    filters.push("r.class_id = ?");
    parameters.push(options.classId);
  }

  const rows = (await db
    .prepare(
      `SELECT r.id AS registration_id, r.student_id, s.name AS student_name,
              r.guardian_person_id, p.name AS guardian_name, p.email AS guardian_email
         FROM program_registrations r
         JOIN students s ON s.id = r.student_id
         LEFT JOIN people p ON p.id = r.guardian_person_id
        WHERE ${filters.join(" AND ")}
        ORDER BY s.name`,
    )
    .all(...parameters)) as unknown as {
    registration_id: string;
    student_id: string;
    student_name: string;
    guardian_person_id: string | null;
    guardian_name: string | null;
    guardian_email: string | null;
  }[];

  return rows.map((row) => ({
    registrationId: row.registration_id,
    studentId: row.student_id,
    studentName: row.student_name,
    guardianPersonId: row.guardian_person_id,
    guardianName: row.guardian_name,
    guardianEmail: row.guardian_email,
  }));
}

export interface ScheduleChangeInput {
  kind: ScheduleChangeKind;
  programId?: string | null;
  classId?: string | null;
  sessionId?: string | null;
  previousStartsAt?: number | null;
  previousLocation?: string | null;
  newStartsAt?: number | null;
  newLocation?: string | null;
  reason: string;
  /** Family-facing message. Previewed by the admin before sending. */
  message?: string | null;
  actor: { userId?: string | null; label: string };
}

export interface ScheduleChangeResult {
  changeId: string;
  affected: number;
  notified: number;
}

function defaultTitle(kind: ScheduleChangeKind): string {
  switch (kind) {
    case "session_cancelled":
      return "Session cancelled";
    case "session_rescheduled":
      return "Session rescheduled";
    case "class_paused":
      return "Class paused";
    case "program_cancelled":
      return "Program cancelled";
    case "location_changed":
      return "Location changed";
  }
}

/**
 * Record the change and notify every affected family in one operation.
 *
 * The notification kinds used here are on the always-email list in
 * lib/family-communications.ts, so a family cannot miss a cancellation because
 * they turned off routine reminders.
 */
export async function recordScheduleChange(input: ScheduleChangeInput): Promise<ScheduleChangeResult> {
  const db = getDb();
  const now = Date.now();
  const changeId = `sch-${randomUUID().slice(0, 12)}`;
  const families = await affectedFamilies({ programId: input.programId, classId: input.classId });
  const requiresAcknowledgment = NEEDS_ACKNOWLEDGMENT.has(input.kind);

  await db
    .prepare(
      `INSERT INTO schedule_changes
         (id, kind, program_id, class_id, session_id, previous_starts_at, previous_location,
          new_starts_at, new_location, reason, message, changed_by_user_id, changed_by_label,
          affected_students, notifications_created, requires_acknowledgment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      changeId,
      input.kind,
      input.programId ?? null,
      input.classId ?? null,
      input.sessionId ?? null,
      input.previousStartsAt ?? null,
      input.previousLocation ?? null,
      input.newStartsAt ?? null,
      input.newLocation ?? null,
      input.reason,
      input.message ?? null,
      input.actor.userId ?? null,
      input.actor.label,
      families.length,
      0,
      requiresAcknowledgment,
      now,
    );

  const title = defaultTitle(input.kind);
  const kindToNotification: Record<ScheduleChangeKind, string> = {
    session_cancelled: "session_cancelled",
    session_rescheduled: "schedule_change",
    class_paused: "schedule_change",
    program_cancelled: "program_cancelled",
    location_changed: "schedule_change",
  };

  let notified = 0;
  for (const family of families) {
    if (!family.guardianPersonId) continue;
    const notificationId = await recordNotification({
      personId: family.guardianPersonId,
      studentId: family.studentId,
      programId: input.programId ?? null,
      registrationId: family.registrationId,
      kind: kindToNotification[input.kind],
      title,
      body: input.message ?? input.reason,
      urgency: "urgent",
      requiresAcknowledgment,
      actionLabel: "View schedule",
      actionHref: "/family",
    });
    await db
      .prepare("UPDATE family_notifications SET schedule_change_id = ? WHERE id = ?")
      .run(changeId, notificationId);
    notified += 1;
  }

  await db.prepare("UPDATE schedule_changes SET notifications_created = ? WHERE id = ?").run(notified, changeId);

  await recordAudit({
    programId: input.programId ?? null,
    actorUserId: input.actor.userId ?? null,
    actorLabel: input.actor.label,
    action: input.kind,
    previousState: input.previousStartsAt ? new Date(input.previousStartsAt).toISOString() : input.previousLocation,
    newState: input.newStartsAt ? new Date(input.newStartsAt).toISOString() : input.newLocation,
    reason: input.reason,
  });

  return { changeId, affected: families.length, notified };
}

export interface ScheduleChangeSummary {
  id: string;
  kind: ScheduleChangeKind;
  reason: string;
  changedByLabel: string;
  createdAt: number;
  affectedStudents: number;
  notificationsCreated: number;
  requiresAcknowledgment: boolean;
  delivered: number;
  failed: number;
  acknowledged: number;
}

/**
 * History for a program, with the delivery and acknowledgment rollup an admin
 * needs to answer "did everyone actually find out?" — the question that makes
 * this record worth keeping.
 */
export async function scheduleChangeHistory(programId: string, limit = 25): Promise<ScheduleChangeSummary[]> {
  const db = getDb();
  const rows = (await db
    .prepare(
      `SELECT c.id, c.kind, c.reason, c.changed_by_label, c.created_at, c.affected_students,
              c.notifications_created, c.requires_acknowledgment,
              COUNT(*) FILTER (WHERE n.email_status = 'sent') AS delivered,
              COUNT(*) FILTER (WHERE n.email_status = 'failed') AS failed,
              COUNT(*) FILTER (WHERE n.acknowledged_at IS NOT NULL) AS acknowledged
         FROM schedule_changes c
         LEFT JOIN family_notifications n ON n.schedule_change_id = c.id
        WHERE c.program_id = ?
        GROUP BY c.id
        ORDER BY c.created_at DESC
        LIMIT ?`,
    )
    .all(programId, limit)) as unknown as {
    id: string;
    kind: ScheduleChangeKind;
    reason: string;
    changed_by_label: string;
    created_at: number;
    affected_students: number;
    notifications_created: number;
    requires_acknowledgment: boolean;
    delivered: number | string;
    failed: number | string;
    acknowledged: number | string;
  }[];

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    reason: row.reason,
    changedByLabel: row.changed_by_label,
    createdAt: Number(row.created_at),
    affectedStudents: Number(row.affected_students),
    notificationsCreated: Number(row.notifications_created),
    requiresAcknowledgment: Boolean(row.requires_acknowledgment),
    delivered: Number(row.delivered),
    failed: Number(row.failed),
    acknowledged: Number(row.acknowledged),
  }));
}

/** A family confirming they saw a change that required acknowledgment. */
export async function acknowledgeNotification(notificationId: string, personId: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .prepare(
      `UPDATE family_notifications
          SET acknowledged_at = ?, updated_at = ?
        WHERE id = ? AND person_id = ? AND acknowledged_at IS NULL`,
    )
    .run(Date.now(), Date.now(), notificationId, personId);
  return result.changes > 0;
}
