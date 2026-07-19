"use server";

/* ============================================================
 * Class scheduling, staffing, rosters, sessions, attendance, and
 * proposals. Most mutations are staff-only (admin | growth); the
 * instructor-facing ones (createClassSession, submitSessionReport,
 * recordAttendance) re-check class membership via class_instructors —
 * that check is the actual security boundary, not the page guard.
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireStaff, requireActiveInstructorSelf, requireRole } from "@/lib/dal";
import { logActivity, recomputeInstructorStatuses, type ClassStatus } from "@/lib/hiring";
import { createNotification } from "@/lib/notifications";
import { recordClassStaffingDecision } from "@/lib/operational-decisions";
import { isValidTimeZone, localDateTimeToEpoch } from "@/lib/timezone";
import { getLessonById } from "@/lib/lessons";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@/lib/session-evidence";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const STATUSES = new Set<ClassStatus>(["planning", "staffing", "ready_to_launch", "active", "paused", "completed", "cancelled"]);
const ROLES = new Set(["lead", "additional"]);
const TERMINAL_CLASS_STATUSES = new Set<ClassStatus>(["completed", "cancelled"]);
const CLASS_TRANSITIONS: Record<ClassStatus, ClassStatus[]> = {
  planning: ["staffing", "paused", "cancelled"],
  staffing: ["ready_to_launch", "paused", "cancelled"],
  ready_to_launch: ["active", "staffing", "paused", "cancelled"],
  active: ["paused", "completed"],
  paused: ["staffing", "active", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};
const HISTORICAL_PROGRAM_STAGES = new Set(["completed", "renewal_review", "renewed", "closed"]);

async function inImmediateTransaction<T>(operation: () => T): Promise<T> {
  const db = getDb();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const result = operation();
    (await db.exec("COMMIT"));
    return result;
  } catch (error) {
    try {
      (await db.exec("ROLLBACK"));
    } catch {
      // Preserve the original error.
    }
    throw error;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function getClassRow(id: string): Promise<any> {
  return (await getDb().prepare("SELECT * FROM classes WHERE id = ?").get(id)) as any;
}

/** True if `instructorId` is lead or additional on `classId`. */
async function isClassMember(classId: string, instructorId: string): Promise<boolean> {
  const row = (await getDb()
      .prepare("SELECT 1 FROM class_instructors WHERE class_id = ? AND instructor_id = ? AND removed_at IS NULL")
      .get(classId, instructorId));
  return !!row;
}

/* ---------------- classes ---------------- */

export interface CreateClassInput {
  title: string;
  curriculumId: string;
  partnerOrgId?: string;
  location?: string;
  onlineFormat?: string;
  startDate?: string;
  endDate?: string;
  recurrence?: string;
  scheduleDay?: number;
  scheduleStartTime?: string;
  scheduleEndTime?: string;
  scheduleTimezone?: string;
  ageRange?: string;
  capacity?: number;
  minimumEnrollment?: number;
  internalNotes?: string;
}

export async function createClass(input: CreateClassInput): Promise<ActionResult & { id?: string; programId?: string }> {
  const me = await requireStaff();
  const title = (input.title ?? "").trim();
  if (!title) return { ok: false, error: "Title is required." };
  if (title.length > 200) return { ok: false, error: "Title is too long." };
  const curriculumId = (input.curriculumId ?? "").trim();
  if (!curriculumId) return { ok: false, error: "Curriculum is required." };
  const partnerOrgId = (input.partnerOrgId ?? "").trim() || null;
  if (partnerOrgId && partnerOrgId.length > 120) return { ok: false, error: "Choose a valid partner organization." };

  const db = getDb();
  const curriculum = (await db.prepare("SELECT 1 FROM curricula WHERE id = ?").get(curriculumId));
  if (!curriculum) return { ok: false, error: "Curriculum not found." };

  if (partnerOrgId) {
    const org = (await db.prepare("SELECT 1 FROM organizations WHERE id = ? AND status IN ('prospect','active')").get(partnerOrgId));
    if (!org) return { ok: false, error: "Only prospect or active partners can receive a new Class plan." };
  }

  const capacity =
    input.capacity !== undefined && input.capacity !== null && Number.isFinite(input.capacity)
      ? Math.trunc(input.capacity)
      : null;
  if (capacity !== null && capacity < 1) return { ok: false, error: "Capacity must be at least 1." };
  const minimumEnrollment = input.minimumEnrollment == null ? 1 : Math.trunc(input.minimumEnrollment);
  if (!Number.isFinite(minimumEnrollment) || minimumEnrollment < 1) {
    return { ok: false, error: "Minimum enrollment must be at least 1." };
  }
  if (capacity !== null && minimumEnrollment > capacity) {
    return { ok: false, error: "Minimum enrollment cannot exceed capacity." };
  }
  const startDate = (input.startDate ?? "").trim().slice(0, 20) || null;
  const endDate = (input.endDate ?? "").trim().slice(0, 20) || null;
  if (startDate && Number.isNaN(Date.parse(startDate))) return { ok: false, error: "Use a valid start date." };
  if (endDate && Number.isNaN(Date.parse(endDate))) return { ok: false, error: "Use a valid end date." };
  if (startDate && endDate && Date.parse(endDate) < Date.parse(startDate)) {
    return { ok: false, error: "End date cannot be before start date." };
  }
  const scheduleDay = input.scheduleDay == null ? null : Math.trunc(input.scheduleDay);
  if (scheduleDay !== null && (scheduleDay < 0 || scheduleDay > 6)) return { ok: false, error: "Choose a valid schedule day." };
  const scheduleStartTime = (input.scheduleStartTime ?? "").trim() || null;
  const scheduleEndTime = (input.scheduleEndTime ?? "").trim() || null;
  const scheduleTimezone = (input.scheduleTimezone ?? "").trim().slice(0, 100) || null;
  if (scheduleStartTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduleStartTime)) return { ok: false, error: "Choose a valid start time." };
  if (scheduleEndTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduleEndTime)) return { ok: false, error: "Choose a valid end time." };
  if (scheduleStartTime && scheduleEndTime && scheduleEndTime <= scheduleStartTime) {
    return { ok: false, error: "Schedule end time must be after its start time." };
  }
  const structuredScheduleParts = [scheduleDay !== null, Boolean(scheduleStartTime), Boolean(scheduleEndTime)].filter(Boolean).length;
  if (structuredScheduleParts > 0 && structuredScheduleParts < 3) {
    return { ok: false, error: "Set the weekly day, start time, and end time together." };
  }
  if (structuredScheduleParts === 3 && !scheduleTimezone) {
    return { ok: false, error: "Choose the delivery timezone for this weekly schedule." };
  }
  if (scheduleTimezone && !isValidTimeZone(scheduleTimezone)) {
    return { ok: false, error: "Choose a valid IANA delivery timezone." };
  }

  const id = `pfx-${randomUUID().slice(0, 8)}`;
  const programId = `prg-${randomUUID()}`;
  const now = Date.now();
  const recurrence = (input.recurrence ?? "").trim().slice(0, 200) || null;
  const audience = (input.ageRange ?? "").trim().slice(0, 60) || null;
  const notes = (input.internalNotes ?? "").trim().slice(0, 2000) || null;
  const onlineFormat = (input.onlineFormat ?? "").trim().slice(0, 60) || null;
  const deliveryFormat = onlineFormat?.toLowerCase().includes("hybrid") ? "hybrid" : onlineFormat ? "online" : "in_person";
  try {
    (await inImmediateTransaction(async () => {
          if (
            partnerOrgId
            && !(await db.prepare("SELECT 1 FROM organizations WHERE id = ? AND status IN ('prospect','active')").get(partnerOrgId))
          ) {
            throw new Error("partner_unavailable");
          }
          (await db.prepare(
                    `INSERT INTO programs
        (id, request_key, name, partner_org_id, curriculum_id, audience, delivery_format, stage,
         start_date, end_date, schedule_label, schedule_day, schedule_start_time, schedule_end_time,
         schedule_timezone, capacity, minimum_enrollment, owner_user_id, source_type, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'planning', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?)`,
                  ).run(
                    programId,
                    `manual-class:${id}`,
                    title.slice(0, 200),
                    partnerOrgId,
                    curriculumId,
                    audience,
                    deliveryFormat,
                    startDate,
                    endDate,
                    recurrence,
                    scheduleDay,
                    scheduleStartTime,
                    scheduleEndTime,
                    scheduleTimezone,
                    capacity,
                    minimumEnrollment,
                    me.id,
                    notes,
                    now,
                    now,
                  ));
          (await db.prepare(
                    `INSERT INTO classes
        (id, title, curriculum_id, partner_org_id, location, online_format, start_date, end_date,
         recurrence, schedule_day, schedule_start_time, schedule_end_time, age_range, capacity,
         schedule_timezone, minimum_enrollment, lead_instructor_id, program_id, status, internal_notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'planning', ?, ?, ?)`,
                  ).run(
                    id,
                    title.slice(0, 200),
                    curriculumId,
                    partnerOrgId,
                    (input.location ?? "").trim().slice(0, 200) || null,
                    onlineFormat,
                    startDate,
                    endDate,
                    recurrence,
                    scheduleDay,
                    scheduleStartTime,
                    scheduleEndTime,
                    audience,
                    capacity,
                    scheduleTimezone,
                    minimumEnrollment,
                    programId,
                    notes,
                    now,
                    now,
                  ));
          (await logActivity("program", programId, "created", `Program created with delivery Class "${title}".`, me.id));
          (await logActivity("class", id, "note", `Class "${title}" created inside Program ${programId}.`, me.id));
          }));
  } catch (error) {
    if (error instanceof Error && error.message === "partner_unavailable") {
      return { ok: false, error: "The partner was paused, closed, or changed while this Class was being created." };
    }
    throw error;
  }

  revalidatePath("/app/programs");
  revalidatePath("/app/classes");
  revalidatePath("/app");
  return { ok: true, id, programId };
}

export interface UpdateClassPatch {
  title?: string;
  partnerOrgId?: string | null;
  location?: string;
  onlineFormat?: string;
  startDate?: string;
  endDate?: string;
  recurrence?: string;
  scheduleDay?: number | null;
  scheduleStartTime?: string;
  scheduleEndTime?: string;
  scheduleTimezone?: string;
  ageRange?: string;
  capacity?: number | null;
  minimumEnrollment?: number;
  internalNotes?: string;
}

export async function updateClass(id: string, patch: UpdateClassPatch): Promise<ActionResult> {
  await requireStaff();
  const db = getDb();
  const row = (await getClassRow(id));
  if (!row) return { ok: false, error: "Not found." };
  if (!["planning", "staffing"].includes(row.status)) {
    return { ok: false, error: "Ready, active, paused, and historical Classes require an audited correction workflow." };
  }
  if (
    row.program_id &&
    (patch.partnerOrgId !== undefined || patch.location !== undefined || patch.onlineFormat !== undefined)
  ) {
    return { ok: false, error: "Partner, Location, and delivery format are owned by the Program plan." };
  }

  const sets: string[] = [];
  const vals: unknown[] = [];
  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (!title) return { ok: false, error: "Title can't be empty." };
    sets.push("title = ?");
    vals.push(title.slice(0, 200));
  }
  if (patch.partnerOrgId !== undefined) {
    if (patch.partnerOrgId) {
      const org = (await db.prepare("SELECT 1 FROM organizations WHERE id = ? AND status IN ('prospect','active')").get(patch.partnerOrgId));
      if (!org) return { ok: false, error: "Only prospect or active partners can receive Class work." };
    }
    sets.push("partner_org_id = ?");
    vals.push(patch.partnerOrgId || null);
  }
  if (patch.location !== undefined) {
    sets.push("location = ?");
    vals.push(patch.location.trim().slice(0, 200) || null);
  }
  if (patch.onlineFormat !== undefined) {
    sets.push("online_format = ?");
    vals.push(patch.onlineFormat.trim().slice(0, 60) || null);
  }
  if (patch.startDate !== undefined) {
    sets.push("start_date = ?");
    vals.push(patch.startDate.trim().slice(0, 20) || null);
  }
  if (patch.endDate !== undefined) {
    sets.push("end_date = ?");
    vals.push(patch.endDate.trim().slice(0, 20) || null);
  }
  if (patch.recurrence !== undefined) {
    sets.push("recurrence = ?");
    vals.push(patch.recurrence.trim().slice(0, 200) || null);
  }
  if (patch.scheduleDay !== undefined) {
    if (patch.scheduleDay !== null && (!Number.isInteger(patch.scheduleDay) || patch.scheduleDay < 0 || patch.scheduleDay > 6)) {
      return { ok: false, error: "Schedule day must be between Sunday and Saturday." };
    }
    sets.push("schedule_day = ?");
    vals.push(patch.scheduleDay);
  }
  if (patch.scheduleStartTime !== undefined) {
    const value = patch.scheduleStartTime.trim();
    if (value && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return { ok: false, error: "Use a valid Class start time." };
    sets.push("schedule_start_time = ?");
    vals.push(value || null);
  }
  if (patch.scheduleEndTime !== undefined) {
    const value = patch.scheduleEndTime.trim();
    if (value && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return { ok: false, error: "Use a valid Class end time." };
    sets.push("schedule_end_time = ?");
    vals.push(value || null);
  }
  if (patch.scheduleTimezone !== undefined) {
    const value = patch.scheduleTimezone.trim().slice(0, 100);
    if (value && !isValidTimeZone(value)) return { ok: false, error: "Choose a valid IANA delivery timezone." };
    sets.push("schedule_timezone = ?");
    vals.push(value || null);
  }
  if (patch.ageRange !== undefined) {
    sets.push("age_range = ?");
    vals.push(patch.ageRange.trim().slice(0, 60) || null);
  }
  if (patch.capacity !== undefined) {
    if (patch.capacity !== null && (!Number.isFinite(patch.capacity) || patch.capacity < 1)) {
      return { ok: false, error: "Class capacity must be at least 1." };
    }
    const enrolledCount = (
      (await db.prepare(
                `SELECT COUNT(*) AS n
           FROM class_enrollments ce
           JOIN students s ON s.id = ce.student_id
          WHERE ce.class_id = ? AND ce.status = 'enrolled' AND s.enrollment_status = 'active'`,
              ).get(id)) as { n: number }
    ).n;
    if (patch.capacity !== null && patch.capacity < enrolledCount) {
      return { ok: false, error: `Capacity cannot be lower than the ${enrolledCount} currently enrolled students.` };
    }
    sets.push("capacity = ?");
    vals.push(patch.capacity === null ? null : Math.trunc(patch.capacity));
  }
  if (patch.minimumEnrollment !== undefined) {
    if (!Number.isInteger(patch.minimumEnrollment) || patch.minimumEnrollment < 1) {
      return { ok: false, error: "Minimum enrollment must be at least 1." };
    }
    const effectiveCapacity = patch.capacity !== undefined ? patch.capacity : row.capacity;
    if (effectiveCapacity != null && patch.minimumEnrollment > effectiveCapacity) {
      return { ok: false, error: "Minimum enrollment cannot exceed capacity." };
    }
    sets.push("minimum_enrollment = ?");
    vals.push(patch.minimumEnrollment);
  }
  if (patch.internalNotes !== undefined) {
    sets.push("internal_notes = ?");
    vals.push(patch.internalNotes.trim().slice(0, 2000) || null);
  }
  const effectiveScheduleDay = patch.scheduleDay !== undefined ? patch.scheduleDay : row.schedule_day;
  const effectiveStartTime = patch.scheduleStartTime !== undefined ? patch.scheduleStartTime.trim() || null : row.schedule_start_time;
  const effectiveEndTime = patch.scheduleEndTime !== undefined ? patch.scheduleEndTime.trim() || null : row.schedule_end_time;
  const effectiveTimezone = patch.scheduleTimezone !== undefined ? patch.scheduleTimezone.trim() || null : row.schedule_timezone;
  const effectiveScheduleParts = [effectiveScheduleDay != null, Boolean(effectiveStartTime), Boolean(effectiveEndTime)].filter(Boolean).length;
  if (effectiveScheduleParts > 0 && effectiveScheduleParts < 3) {
    return { ok: false, error: "Set the weekly day, start time, and end time together." };
  }
  if (effectiveScheduleParts === 3 && !isValidTimeZone(effectiveTimezone)) {
    return { ok: false, error: "Choose the delivery timezone for this weekly schedule." };
  }
  if (sets.length === 0) return { ok: true };

  const effectiveStart = patch.startDate !== undefined ? patch.startDate.trim() || null : row.start_date;
  const effectiveEnd = patch.endDate !== undefined ? patch.endDate.trim() || null : row.end_date;
  const effectiveCapacity = patch.capacity !== undefined ? patch.capacity : row.capacity;
  const effectiveMinimum = patch.minimumEnrollment !== undefined ? patch.minimumEnrollment : row.minimum_enrollment;
  const effectiveScheduleStart = patch.scheduleStartTime !== undefined ? patch.scheduleStartTime.trim() || null : row.schedule_start_time;
  const effectiveScheduleEnd = patch.scheduleEndTime !== undefined ? patch.scheduleEndTime.trim() || null : row.schedule_end_time;
  if (effectiveStart && Number.isNaN(Date.parse(effectiveStart))) return { ok: false, error: "Use a valid Class start date." };
  if (effectiveEnd && Number.isNaN(Date.parse(effectiveEnd))) return { ok: false, error: "Use a valid Class end date." };
  if (effectiveStart && effectiveEnd && Date.parse(effectiveEnd) < Date.parse(effectiveStart)) {
    return { ok: false, error: "Class end date cannot be before its start date." };
  }
  if (effectiveCapacity != null && effectiveMinimum > effectiveCapacity) {
    return { ok: false, error: "Minimum enrollment cannot exceed capacity." };
  }
  if (effectiveScheduleStart && effectiveScheduleEnd && effectiveScheduleEnd <= effectiveScheduleStart) {
    return { ok: false, error: "Class end time must be after its start time." };
  }

  sets.push("updated_at = ?");
  vals.push(Date.now());
  try {
    (await inImmediateTransaction(async () => {
            const live = (await getClassRow(id));
            if (!live || live.status !== row.status || live.updated_at !== row.updated_at) throw new Error("class_changed");
            if (live.program_id && (patch.partnerOrgId !== undefined || patch.location !== undefined || patch.onlineFormat !== undefined)) {
              throw new Error("program_owned");
            }
            if (
              patch.partnerOrgId
              && !(await db.prepare("SELECT 1 FROM organizations WHERE id = ? AND status IN ('prospect','active')").get(patch.partnerOrgId))
            ) {
              throw new Error("partner_unavailable");
            }
            const liveEnrollmentCount = (
              (await db.prepare(
                          `SELECT COUNT(*) AS n
             FROM class_enrollments ce
             JOIN students s ON s.id = ce.student_id
            WHERE ce.class_id = ? AND ce.status = 'enrolled' AND s.enrollment_status = 'active'`,
                        ).get(id)) as { n: number }
            ).n;
            const requestedCapacity = patch.capacity !== undefined ? patch.capacity : live.capacity;
            const requestedMinimum = patch.minimumEnrollment !== undefined ? patch.minimumEnrollment : live.minimum_enrollment;
            if (requestedCapacity !== null && requestedCapacity < liveEnrollmentCount) throw new Error("capacity_changed");
            if (requestedCapacity !== null && requestedMinimum > requestedCapacity) throw new Error("capacity_changed");
            const updated = (await db.prepare(
                    `UPDATE classes SET ${sets.join(", ")} WHERE id = ? AND status = ? AND updated_at = ?`,
                  ).run(...(vals as []), id, row.status, row.updated_at));
            if (updated.changes !== 1) throw new Error("class_changed");
          }));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "program_owned") return { ok: false, error: "This Class was connected to a Program. Edit shared source facts from the Program plan." };
    if (code === "partner_unavailable") return { ok: false, error: "The selected partner was paused, closed, or changed while this Class was being saved." };
    if (code === "capacity_changed") return { ok: false, error: "Enrollment or delivery limits changed while this Class was being saved. Refresh and review capacity." };
    if (code === "class_changed") return { ok: false, error: "The Class changed while this plan was being saved. Refresh and try again." };
    throw error;
  }

  revalidatePath(`/app/classes/${id}`);
  if (row.program_id) revalidatePath(`/app/programs/${row.program_id}`);
  revalidatePath("/app/classes");
  return { ok: true };
}

export async function updateClassStatus(id: string, status: string, reason?: string): Promise<ActionResult> {
  const me = await requireStaff();
  if (!STATUSES.has(status as ClassStatus)) return { ok: false, error: "Invalid status." };
  const row = (await getClassRow(id));
  if (!row) return { ok: false, error: "Not found." };
  const currentStatus = row.status as ClassStatus;
  const nextStatus = status as ClassStatus;
  if (currentStatus === nextStatus) return { ok: true };
  if (!STATUSES.has(currentStatus) || !CLASS_TRANSITIONS[currentStatus]) {
    return { ok: false, error: "This Class has an invalid lifecycle state and must be reconciled before it can move." };
  }
  if (!CLASS_TRANSITIONS[currentStatus].includes(nextStatus)) {
    return { ok: false, error: `A Class cannot move from ${currentStatus.replace(/_/g, " ")} to ${nextStatus.replace(/_/g, " ")}.` };
  }
  const cleanReason = (reason ?? "").trim().slice(0, 1000);
  if (["paused", "completed", "cancelled"].includes(nextStatus) && cleanReason.length < 3) {
    return { ok: false, error: "Record the operational reason for this delivery decision." };
  }

  if (row.program_id) {
    const program = (await getDb().prepare("SELECT stage FROM programs WHERE id = ?").get(row.program_id)) as { stage: string } | undefined;
    if (!program) return { ok: false, error: "The linked Program no longer exists." };
    if (HISTORICAL_PROGRAM_STAGES.has(program.stage)) return { ok: false, error: "Historical Program delivery is frozen." };
    if (nextStatus === "ready_to_launch" && program.stage !== "ready_to_launch") {
      return { ok: false, error: "The Program must pass its launch gate before this Class can be marked ready." };
    }
    if (nextStatus === "active" && program.stage !== "active") {
      return { ok: false, error: "The Program must be active before this Class can begin delivery." };
    }
    if (nextStatus === "completed" && !["active", "paused"].includes(program.stage)) {
      return { ok: false, error: "Only delivery inside an active or paused Program can be completed." };
    }
    if (nextStatus === "staffing" && program.stage === "active") {
      return { ok: false, error: "An active Program cannot move a delivery Class back to staffing." };
    }
  }

  try {
    (await inImmediateTransaction(async () => {
            const now = Date.now();
            const liveClass = (await getClassRow(id));
            if (!liveClass || liveClass.status !== currentStatus || liveClass.program_id !== row.program_id) {
              throw new Error("stale_class_status");
            }
            if (liveClass.program_id) {
              const liveProgram = (await getDb().prepare("SELECT stage FROM programs WHERE id = ?").get(liveClass.program_id)) as
                | { stage: string }
                | undefined;
              if (!liveProgram || HISTORICAL_PROGRAM_STAGES.has(liveProgram.stage)) throw new Error("program_changed");
              if (nextStatus === "ready_to_launch" && liveProgram.stage !== "ready_to_launch") throw new Error("program_changed");
              if (nextStatus === "active" && liveProgram.stage !== "active") throw new Error("program_changed");
              if (nextStatus === "completed" && !["active", "paused"].includes(liveProgram.stage)) throw new Error("program_changed");
              if (nextStatus === "staffing" && liveProgram.stage === "active") throw new Error("program_changed");
            }
            if (nextStatus === "completed") {
              const sessionSummary = (await getDb().prepare(
                        `SELECT
             COUNT(*) AS total,
             SUM(CASE WHEN cs.session_date > ? THEN 1 ELSE 0 END) AS future_count,
             SUM(CASE WHEN NOT EXISTS (
               SELECT 1 FROM class_session_reports csr
                WHERE csr.session_id = cs.id AND csr.completed = 1
             ) THEN 1 ELSE 0 END) AS unfinished_count
           FROM class_sessions cs
          WHERE cs.class_id = ?`,
                      ).get(now, id)) as { total: number; future_count: number | null; unfinished_count: number | null };
              if (
                sessionSummary.total < 1
                || Number(sessionSummary.future_count) > 0
                || Number(sessionSummary.unfinished_count) > 0
              ) {
                throw new Error("delivery_evidence_incomplete");
              }
            }
            const updated = (await getDb()
                    .prepare("UPDATE classes SET status = ?, updated_at = ? WHERE id = ? AND status = ?")
                    .run(nextStatus, now, id, currentStatus));
            if (updated.changes !== 1) throw new Error("stale_class_status");
            (await getDb().prepare(
                      `INSERT INTO class_status_events
          (id, class_id, from_status, to_status, reason, actor_user_id, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'class_action', ?)`,
                    ).run(`cse-${randomUUID()}`, id, currentStatus, nextStatus, cleanReason || null, me.id, now));
            (await logActivity(
                      "class",
                      id,
                      "stage_change",
                      `Class moved from ${currentStatus.replace(/_/g, " ")} to ${nextStatus.replace(/_/g, " ")}.${cleanReason ? ` ${cleanReason}` : ""}`,
                      me.id,
                    ));
          }));
  } catch (error) {
    if (error instanceof Error && error.message === "stale_class_status") {
      return { ok: false, error: "This Class changed while the decision was being recorded. Refresh and try again." };
    }
    if (error instanceof Error && error.message === "program_changed") {
      return { ok: false, error: "The linked Program changed while this delivery decision was being recorded. Refresh and try again." };
    }
    if (error instanceof Error && error.message === "delivery_evidence_incomplete") {
      return { ok: false, error: "Complete delivery evidence first: schedule at least one session, wait until every session has occurred, and finalize every session report." };
    }
    throw error;
  }

  revalidatePath(`/app/classes/${id}`);
  if (row.program_id) revalidatePath(`/app/programs/${row.program_id}`);
  revalidatePath("/app/classes");
  revalidatePath("/app");
  return { ok: true };
}

/* ---------------- instructor assignment ---------------- */

export async function assignInstructorToClass(classId: string, instructorId: string, role: string): Promise<ActionResult> {
  const me = await requireStaff();
  if (!ROLES.has(role)) return { ok: false, error: "Invalid role." };
  const db = getDb();
  const cls = (await getClassRow(classId));
  if (!cls) return { ok: false, error: "Class not found." };
  if (cls.program_id) return { ok: false, error: "Assign instructors from the Program so qualifications and workload are checked." };
  if (!["planning", "staffing"].includes(cls.status)) return { ok: false, error: "Staffing is frozen after launch readiness." };

  const instructor = (await db.prepare("SELECT id, stage, eligibility_status FROM instructors WHERE id = ?").get(instructorId)) as
    | { id: string; stage: string; eligibility_status: string }
    | undefined;
  if (!instructor) return { ok: false, error: "Instructor not found." };
  if (!["eligible", "active"].includes(instructor.stage) || instructor.eligibility_status !== "eligible") {
    return { ok: false, error: "Only an active, eligible instructor can be assigned." };
  }

  try {
    (await inImmediateTransaction(async () => {
            const now = Date.now();
            (await recomputeInstructorStatuses(instructorId));
            const currentClass = (await getClassRow(classId));
            const currentInstructor = (await db.prepare("SELECT stage, eligibility_status FROM instructors WHERE id = ?").get(instructorId)) as
              | { stage: string; eligibility_status: string }
              | undefined;
            if (!currentClass || currentClass.program_id || !["planning", "staffing"].includes(currentClass.status)) {
              throw new Error("staffing_frozen");
            }
            if (!currentInstructor || !["eligible", "active"].includes(currentInstructor.stage) || currentInstructor.eligibility_status !== "eligible") {
              throw new Error("staffing_frozen");
            }
            const existing = (await db
                    .prepare("SELECT id, role FROM class_instructors WHERE class_id = ? AND instructor_id = ? AND removed_at IS NULL")
                    .get(classId, instructorId)) as { id: string; role: string } | undefined;
            const recordedReason = "Assigned through standalone Class staffing.";

            if (role === "lead") {
              const displacedLeads = (await db.prepare(
                        "SELECT id, instructor_id FROM class_instructors WHERE class_id = ? AND role = 'lead' AND removed_at IS NULL AND instructor_id <> ?",
                      ).all(classId, instructorId)) as { id: string; instructor_id: string }[];
              for (const displaced of displacedLeads) {
                const demotionReason = `Lead assignment replaced by instructor ${instructorId}.`;
                const decision = (await recordClassStaffingDecision(db, {
                            classId,
                            instructorId: displaced.instructor_id,
                            assignmentId: displaced.id,
                            action: "role_changed",
                            role: "additional",
                            reason: demotionReason,
                            actorUserId: me.id,
                            decidedAt: now,
                          }));
                (await db.prepare(
                              `UPDATE class_instructors
                SET role = 'additional', decision_reason = ?, assigned_by = ?, decision_id = ?,
                    decision_fingerprint = ?, decision_at = ?
              WHERE id = ? AND removed_at IS NULL`,
                            ).run(demotionReason, me.id, decision.decisionId, decision.fingerprint, now, displaced.id));
              }
            }

            const assignmentId = existing?.id ?? `pfx-${randomUUID().slice(0, 8)}`;
            const decision = (await recordClassStaffingDecision(db, {
                    classId,
                    instructorId,
                    assignmentId,
                    action: existing && existing.role !== role ? "role_changed" : "assigned",
                    role: role as "lead" | "additional",
                    reason: recordedReason,
                    actorUserId: me.id,
                    decidedAt: now,
                  }));
            if (existing) {
              (await db.prepare(
                          `UPDATE class_instructors
              SET role = ?, decision_reason = ?, assigned_by = ?, decision_id = ?,
                  decision_fingerprint = ?, decision_at = ?
            WHERE id = ? AND removed_at IS NULL`,
                        ).run(role, recordedReason, me.id, decision.decisionId, decision.fingerprint, now, existing.id));
            } else {
              (await db.prepare(
                          `INSERT INTO class_instructors
            (id, class_id, instructor_id, role, decision_reason, assigned_by,
             decision_id, decision_fingerprint, decision_at, added_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        ).run(assignmentId, classId, instructorId, role, recordedReason, me.id, decision.decisionId, decision.fingerprint, now, now));
            }
            if (role === "lead") {
              (await db.prepare("UPDATE classes SET lead_instructor_id = ?, updated_at = ? WHERE id = ?").run(instructorId, now, classId));
            } else if (currentClass.lead_instructor_id === instructorId) {
              (await db.prepare("UPDATE classes SET lead_instructor_id = NULL, updated_at = ? WHERE id = ? AND lead_instructor_id = ?")
                          .run(now, classId, instructorId));
            }
            (await logActivity("class", classId, "note", `Instructor assigned (${role}). ${recordedReason}`, me.id));
          }));
  } catch (error) {
    if (error instanceof Error && error.message === "staffing_frozen") {
      return { ok: false, error: "Staffing changed while this assignment was being recorded. Refresh and try again." };
    }
    throw error;
  }
  revalidatePath(`/app/classes/${classId}`);
  revalidatePath(`/app/instructors/${instructorId}`);
  revalidatePath("/app/classes");
  revalidatePath("/app/teach");
  return { ok: true };
}

export async function removeInstructorFromClass(classId: string, instructorId: string, reason?: string): Promise<ActionResult> {
  const me = await requireStaff();
  const db = getDb();
  const cls = (await getClassRow(classId));
  if (!cls) return { ok: false, error: "Not found." };
  if (cls.program_id) return { ok: false, error: "Remove Program instructors from the Program launch room." };
  if (!["planning", "staffing"].includes(cls.status)) return { ok: false, error: "Staffing is frozen after launch readiness." };
  const recordedReason = (reason ?? "").trim().slice(0, 1000);
  if (recordedReason.length < 3) return { ok: false, error: "Record why this instructor is being removed." };

  const assignment = (await db.prepare(
      "SELECT id, role FROM class_instructors WHERE class_id = ? AND instructor_id = ? AND removed_at IS NULL",
    ).get(classId, instructorId)) as { id: string; role: string } | undefined;
  if (!assignment) return { ok: false, error: "Instructor is not assigned to this Class." };
  try {
    (await inImmediateTransaction(async () => {
            const now = Date.now();
            const liveClass = (await getClassRow(classId));
            const liveAssignment = (await db.prepare(
                    "SELECT id, role FROM class_instructors WHERE class_id = ? AND instructor_id = ? AND removed_at IS NULL",
                  ).get(classId, instructorId)) as { id: string; role: string } | undefined;
            if (!liveClass || liveClass.program_id || !["planning", "staffing"].includes(liveClass.status) || !liveAssignment) {
              throw new Error("staffing_changed");
            }
            const removalDecision = (await recordClassStaffingDecision(db, {
                    classId,
                    instructorId,
                    assignmentId: liveAssignment.id,
                    action: "removed",
                    role: liveAssignment.role === "lead" ? "lead" : "additional",
                    reason: recordedReason,
                    actorUserId: me.id,
                    decidedAt: now,
                  }));
            const removed = (await db.prepare(
                    `UPDATE class_instructors
            SET removed_at = ?, removal_reason = ?, removed_by = ?,
                removal_decision_id = ?, removal_decision_fingerprint = ?
          WHERE id = ? AND removed_at IS NULL`,
                  ).run(
                    now,
                    recordedReason,
                    me.id,
                    removalDecision.decisionId,
                    removalDecision.fingerprint,
                    liveAssignment.id,
                  ));
            if (removed.changes !== 1) throw new Error("staffing_changed");
            if (liveClass.lead_instructor_id === instructorId) {
              (await db.prepare("UPDATE classes SET lead_instructor_id = NULL, updated_at = ? WHERE id = ? AND lead_instructor_id = ?")
                          .run(now, classId, instructorId));
            }
            (await logActivity("class", classId, "note", `Instructor removed. ${recordedReason}`, me.id));
          }));
  } catch (error) {
    if (error instanceof Error && error.message === "staffing_changed") {
      return { ok: false, error: "Staffing changed while this removal was being recorded. Refresh and try again." };
    }
    throw error;
  }

  revalidatePath(`/app/classes/${classId}`);
  revalidatePath(`/app/instructors/${instructorId}`);
  revalidatePath("/app/classes");
  revalidatePath("/app/teach");
  return { ok: true };
}

/* ---------------- sessions ---------------- */

export interface CreateSessionInput {
  localDateTime: string;
  timeZone: string;
  location?: string;
}

export async function createClassSession(classId: string, input: CreateSessionInput): Promise<ActionResult & { id?: string }> {
  const me = await requireRole("admin", "growth", "instructor");
  if (
    !input
    || typeof input.localDateTime !== "string"
    || typeof input.timeZone !== "string"
    || (input.location != null && typeof input.location !== "string")
  ) {
    return { ok: false, error: "The session schedule contains invalid fields." };
  }
  const cls = (await getClassRow(classId));
  if (!cls) return { ok: false, error: "Class not found." };

  let actorInstructorId: string | null = null;
  if (me.role === "instructor") {
    const { instructor } = await requireActiveInstructorSelf();
    if (!(await isClassMember(classId, instructor.id))) return { ok: false, error: "forbidden" };
    actorInstructorId = instructor.id;
  }

  if (TERMINAL_CLASS_STATUSES.has(cls.status as ClassStatus)) return { ok: false, error: "Historical Classes cannot receive new sessions." };
  const requestedTimeZone = (input.timeZone ?? "").trim().slice(0, 100);
  if (cls.schedule_timezone && !isValidTimeZone(cls.schedule_timezone)) {
    return { ok: false, error: "This Class has an invalid delivery timezone. Ask operations to correct the Class plan." };
  }
  if (cls.schedule_timezone && cls.schedule_timezone !== requestedTimeZone) {
    return { ok: false, error: `This Class is scheduled in ${cls.schedule_timezone}. Refresh before adding the session.` };
  }
  const resolved = localDateTimeToEpoch(input.localDateTime ?? "", cls.schedule_timezone ?? requestedTimeZone);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  if (resolved.epoch <= 0 || Math.abs(resolved.epoch) > 8.64e15) return { ok: false, error: "Invalid session date." };
  const now = Date.now();
  if (resolved.epoch <= now) {
    return { ok: false, error: "Schedule delivery sessions before they start. Historical evidence requires an audited backfill workflow." };
  }
  const sessionDay = resolved.localDate;
  if (cls.start_date && sessionDay < cls.start_date) return { ok: false, error: "Session is before the Class start date." };
  if (cls.end_date && sessionDay > cls.end_date) return { ok: false, error: "Session is after the Class end date." };

  const id = `pfx-${randomUUID().slice(0, 8)}`;
  const db = getDb();
  try {
    (await inImmediateTransaction(async () => {
            const currentClass = (await getClassRow(classId));
            if (!currentClass || TERMINAL_CLASS_STATUSES.has(currentClass.status as ClassStatus)) throw new Error("class_history_frozen");
            if (actorInstructorId) {
              const activeMembership = (await db.prepare(
                        `SELECT 1
             FROM class_instructors ci
             JOIN instructors i ON i.id = ci.instructor_id
            WHERE ci.class_id = ? AND ci.instructor_id = ?
              AND ci.removed_at IS NULL
              AND i.stage IN ('eligible', 'active') AND i.eligibility_status = 'eligible'
            LIMIT 1`,
                      ).get(classId, actorInstructorId));
              if (!activeMembership) throw new Error("membership_revoked");
            }
            if (currentClass.schedule_timezone && currentClass.schedule_timezone !== resolved.timeZone) throw new Error("timezone_changed");
            if (currentClass.start_date && sessionDay < currentClass.start_date) throw new Error("schedule_changed");
            if (currentClass.end_date && sessionDay > currentClass.end_date) throw new Error("schedule_changed");
            if (currentClass.program_id) {
              const program = (await db.prepare("SELECT stage, schedule_timezone FROM programs WHERE id = ?").get(currentClass.program_id)) as
                | { stage: string; schedule_timezone: string | null }
                | undefined;
              if (!program || HISTORICAL_PROGRAM_STAGES.has(program.stage)) throw new Error("class_history_frozen");
              if (program.schedule_timezone && program.schedule_timezone !== resolved.timeZone) throw new Error("timezone_changed");
            }
            if (!currentClass.schedule_timezone) {
              (await db.prepare("UPDATE classes SET schedule_timezone = ?, updated_at = ? WHERE id = ? AND schedule_timezone IS NULL")
                          .run(resolved.timeZone, now, classId));
              if (currentClass.program_id) {
                (await db.prepare("UPDATE programs SET schedule_timezone = COALESCE(schedule_timezone, ?), updated_at = ? WHERE id = ?")
                              .run(resolved.timeZone, now, currentClass.program_id));
              }
            }
            if ((await db.prepare("SELECT 1 FROM class_sessions WHERE class_id = ? AND session_date = ?").get(classId, resolved.epoch))) {
              throw new Error("duplicate_session");
            }
            const location = (input.location ?? "").trim();
            if (location.length > 200) throw new Error("location_too_long");
            (await db.prepare(
                      "INSERT INTO class_sessions (id, class_id, session_date, session_on, timezone, location, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    ).run(id, classId, resolved.epoch, resolved.localDate, resolved.timeZone, location || null, now));
            (await db.prepare(
                      `INSERT INTO class_session_roster (id, session_id, student_id, enrollment_id, rostered_at)
         SELECT 'csr-' || lower(hex(randomblob(16))), ?, ce.student_id, ce.id, ?
         FROM class_enrollments ce
         JOIN students s ON s.id = ce.student_id
         WHERE ce.class_id = ? AND ce.status = 'enrolled' AND s.enrollment_status = 'active'`,
                    ).run(id, now, classId));
            (await logActivity("class", classId, "note", "Session scheduled and roster snapshot created.", me.id));
          }));
  } catch (error) {
    if (error instanceof Error && error.message === "duplicate_session") return { ok: false, error: "A session already exists at that time." };
    if (error instanceof Error && error.message === "class_history_frozen") return { ok: false, error: "Historical Classes cannot receive new sessions." };
    if (error instanceof Error && error.message === "membership_revoked") return { ok: false, error: "Your teaching assignment or eligibility changed. Refresh before continuing." };
    if (error instanceof Error && error.message === "schedule_changed") return { ok: false, error: "The Class schedule changed while this session was being added. Refresh and try again." };
    if (error instanceof Error && error.message === "timezone_changed") return { ok: false, error: "The Class timezone changed while this session was being scheduled. Refresh and try again." };
    if (error instanceof Error && error.message === "location_too_long") return { ok: false, error: "Keep the session location under 200 characters." };
    throw error;
  }
  revalidatePath(`/app/classes/${classId}`);
  revalidatePath("/app/teach");
  return { ok: true, id };
}

/** Resolves a session's class id; used by membership checks below. */
async function getSessionClassId(sessionId: string): Promise<string | null> {
  const row = (await getDb().prepare("SELECT class_id FROM class_sessions WHERE id = ?").get(sessionId)) as { class_id: string } | undefined;
  return row?.class_id ?? null;
}

export interface SessionReportInput {
  notes: string;
  flagged: boolean;
  flagReason?: string;
  completed: boolean;
  expectedReportedAt: number | null;
}

async function verifiedLegacyLessonSnapshot(
  db: ReturnType<typeof getDb>,
  classId: string,
): Promise<{ lessonId: string; snapshot: string } | null> {
  const projection = (await db.prepare(
      `SELECT cohort.track, cohort.current_lesson_id
       FROM classes c
       JOIN programs p ON p.id = c.program_id
       JOIN cohorts cohort ON cohort.id = p.source_id
      WHERE c.id = ?
        AND p.source_type = 'legacy_class'
        AND p.source_id = c.id
        AND cohort.id = c.id
        AND cohort.org_id IS c.partner_org_id
        AND p.partner_org_id IS c.partner_org_id`,
    ).get(classId)) as { track: string; current_lesson_id: string | null } | undefined;
  if (!projection?.current_lesson_id) return null;
  const lesson = getLessonById(projection.current_lesson_id);
  if (!lesson || lesson.track !== projection.track) return null;
  return { lessonId: lesson.id, snapshot: JSON.stringify(lesson) };
}

/**
 * requireActiveInstructorSelf, plus staff. The membership check against
 * class_instructors is the actual security boundary — a foreign
 * instructor id must be rejected even if some future UI bug lets the
 * call fire.
 */
export async function submitSessionReport(
  sessionId: string,
  input: SessionReportInput,
): Promise<ActionResult & { reportedAt?: number }> {
  const me = await requireRole("admin", "growth", "instructor");
  const classId = (await getSessionClassId(sessionId));
  if (!classId) return { ok: false, error: "Session not found." };

  let actorId = me.id;
  let actorInstructorId: string | null = null;
  if (me.role === "instructor") {
    const { instructor } = await requireActiveInstructorSelf();
    if (!(await isClassMember(classId, instructor.id))) return { ok: false, error: "forbidden" };
    actorId = me.id;
    actorInstructorId = instructor.id;
  }

  if (
    !input
    || typeof input.flagged !== "boolean"
    || typeof input.completed !== "boolean"
    || typeof input.notes !== "string"
    || (input.flagReason != null && typeof input.flagReason !== "string")
    || !(
      input.expectedReportedAt === null
      || (Number.isInteger(input.expectedReportedAt) && Number(input.expectedReportedAt) >= 0)
    )
  ) {
    return { ok: false, error: "The session report contains invalid fields." };
  }

  const notes = input.notes.trim();
  const flagReason = input.flagged ? (input.flagReason ?? "").trim() : "";
  if (notes.length > 4000) return { ok: false, error: "Keep delivery notes under 4,000 characters." };
  if (flagReason.length > 500) return { ok: false, error: "Keep the staff-attention reason under 500 characters." };
  if (input.flagged && flagReason.length < 3) return { ok: false, error: "Explain why this session needs staff attention." };

  const db = getDb();
  const now = Date.now();
  let savedReportedAt: number | undefined;
  try {
    (await inImmediateTransaction(async () => {
            const delivery = (await db.prepare(
                    `SELECT cs.class_id, cs.session_date, c.status
           FROM class_sessions cs
           JOIN classes c ON c.id = cs.class_id
          WHERE cs.id = ?`,
                  ).get(sessionId)) as { class_id: string; session_date: number; status: ClassStatus } | undefined;
            if (!delivery || delivery.class_id !== classId) throw new Error("session_changed");
            if (!["active", "paused"].includes(delivery.status)) throw new Error("delivery_not_active");
            if (delivery.session_date > now) throw new Error("session_not_started");
            if (actorInstructorId) {
              const activeMembership = (await db.prepare(
                        `SELECT 1
             FROM class_instructors ci
             JOIN instructors i ON i.id = ci.instructor_id
            WHERE ci.class_id = ? AND ci.instructor_id = ?
              AND ci.removed_at IS NULL
              AND i.stage IN ('eligible', 'active')
              AND i.eligibility_status = 'eligible'
            LIMIT 1`,
                      ).get(classId, actorInstructorId));
              if (!activeMembership) throw new Error("membership_revoked");
            }
            const reports = (await db.prepare(
                    "SELECT id, completed, reported_at, lesson_id, lesson_snapshot FROM class_session_reports WHERE session_id = ?",
                  ).all(sessionId)) as {
              id: string;
              completed: number;
              reported_at: number;
              lesson_id: string | null;
              lesson_snapshot: string | null;
            }[];
            if (reports.length > 1) throw new Error("report_invariant");
            const existing = reports[0];
            if (existing?.completed === 1) throw new Error("report_finalized");
            if (
              (existing && input.expectedReportedAt !== existing.reported_at)
              || (!existing && input.expectedReportedAt !== null)
            ) {
              throw new Error("report_stale");
            }
            if (input.completed) {
              const rosterCount = (await db.prepare(
                        "SELECT COUNT(*) AS n FROM class_session_roster WHERE session_id = ?",
                      ).get(sessionId)) as { n: number };
              if (rosterCount.n === 0) throw new Error("roster_missing");
              const missingAttendance = (await db.prepare(
                        `SELECT COUNT(*) AS n
           FROM class_session_roster csr
           LEFT JOIN attendance_records ar
             ON ar.session_id = csr.session_id AND ar.student_id = csr.student_id
           WHERE csr.session_id = ? AND ar.id IS NULL`,
                      ).get(sessionId)) as { n: number };
              if (missingAttendance.n > 0) throw new Error("attendance_incomplete");
            }
            const lessonEvidence = input.completed ? (await verifiedLegacyLessonSnapshot(db, classId)) : null;
            const lessonId = input.completed ? lessonEvidence?.lessonId ?? null : existing?.lesson_id ?? null;
            const lessonSnapshot = input.completed ? lessonEvidence?.snapshot ?? null : existing?.lesson_snapshot ?? null;
            if (existing) {
              const recordedAt = Math.max(now, existing.reported_at + 1);
              const updated = (await db.prepare(
                        `UPDATE class_session_reports
              SET notes = ?, flagged = ?, flag_reason = ?, completed = ?, reported_by = ?, reported_at = ?,
                  lesson_id = ?, lesson_snapshot = ?
            WHERE id = ? AND completed = 0 AND reported_at = ?`,
                      ).run(
                        notes || null,
                        input.flagged ? 1 : 0,
                        flagReason || null,
                        input.completed ? 1 : 0,
                        actorId,
                        recordedAt,
                        lessonId,
                        lessonSnapshot,
                        existing.id,
                        existing.reported_at,
                      ));
              if (updated.changes !== 1) throw new Error("report_stale");
              savedReportedAt = recordedAt;
            } else {
              (await db.prepare(
                          `INSERT INTO class_session_reports
            (id, session_id, notes, flagged, flag_reason, completed, reported_by, reported_at, lesson_id, lesson_snapshot)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        ).run(
                          `pfx-${randomUUID().slice(0, 8)}`,
                          sessionId,
                          notes || null,
                          input.flagged ? 1 : 0,
                          flagReason || null,
                          input.completed ? 1 : 0,
                          actorId,
                          now,
                          lessonId,
                          lessonSnapshot,
                        ));
              savedReportedAt = now;
            }
            (await logActivity(
                      "class",
                      classId,
                      "note",
                      `Session report submitted${input.flagged ? " (flagged)" : ""}${input.completed ? " and finalized" : ""}${lessonId ? ` with lesson snapshot ${lessonId}` : ""}.`,
                      actorId,
                    ));
          }));
  } catch (error) {
    if (error instanceof Error && error.message === "session_changed") return { ok: false, error: "This session changed while the report was being saved. Refresh and try again." };
    if (error instanceof Error && error.message === "delivery_not_active") return { ok: false, error: "Reports can be submitted only while Class delivery is active or paused." };
    if (error instanceof Error && error.message === "membership_revoked") return { ok: false, error: "Your teaching assignment or eligibility changed. Refresh before continuing." };
    if (error instanceof Error && error.message === "report_finalized") return { ok: false, error: "This session report is finalized. Use an audited correction workflow." };
    if (error instanceof Error && error.message === "report_stale") return { ok: false, error: "This session report changed in another workspace. Refresh before saving so nobody's notes are overwritten." };
    if (error instanceof Error && error.message === "report_invariant") return { ok: false, error: "Duplicate session reports must be reconciled before editing." };
    if (error instanceof Error && error.message === "roster_missing") return { ok: false, error: "This session has no locked roster. Reconcile it before finalizing the report." };
    if (error instanceof Error && error.message === "session_not_started") return { ok: false, error: "A future session cannot be finalized." };
    if (error instanceof Error && error.message === "attendance_incomplete") return { ok: false, error: "Record attendance for every rostered student before finalizing this session." };
    throw error;
  }
  revalidatePath(`/app/classes/${classId}`);
  revalidatePath("/app/teach");
  revalidatePath("/app");
  return { ok: true, reportedAt: savedReportedAt };
}

export interface AttendanceInput {
  studentId: string;
  status: AttendanceStatus;
  note?: string;
  expectedRecordedAt: number | null;
}

/** Same membership check as submitSessionReport. */
export async function recordAttendance(
  sessionId: string,
  records: AttendanceInput[],
): Promise<ActionResult & { recordedAtByStudent?: Record<string, number> }> {
  const me = await requireRole("admin", "growth", "instructor");
  const classId = (await getSessionClassId(sessionId));
  if (!classId) return { ok: false, error: "Session not found." };

  let actorId = me.id;
  let actorInstructorId: string | null = null;
  if (me.role === "instructor") {
    const { instructor } = await requireActiveInstructorSelf();
    if (!(await isClassMember(classId, instructor.id))) return { ok: false, error: "forbidden" };
    actorId = me.id;
    actorInstructorId = instructor.id;
  }

  if (!Array.isArray(records) || records.length === 0) return { ok: false, error: "No attendance records provided." };
  if (records.length > 500) return { ok: false, error: "Too many records." };
  const allowedAttendanceStatuses = new Set<AttendanceStatus>(ATTENDANCE_STATUSES);
  if (
    records.some((record) =>
      !record
      || typeof record.status !== "string"
      || !allowedAttendanceStatuses.has(record.status as AttendanceStatus)
      || (record.note != null && typeof record.note !== "string")
      || !(
        record.expectedRecordedAt === null
        || (Number.isInteger(record.expectedRecordedAt) && Number(record.expectedRecordedAt) >= 0)
      ),
    )
  ) {
    return { ok: false, error: "Every attendance row must contain one valid attendance status and evidence version." };
  }
  const studentIds = records.map((record) => typeof record.studentId === "string" ? record.studentId.trim() : "");
  if (studentIds.some((studentId) => !studentId)) return { ok: false, error: "Every attendance row must identify a student." };
  if (new Set(studentIds).size !== studentIds.length) return { ok: false, error: "Attendance contains a duplicate student." };
  if (records.some((record) => (record.note ?? "").trim().length > 500)) {
    return { ok: false, error: "Keep each attendance note under 500 characters." };
  }

  const db = getDb();
  const now = Date.now();
  const recordedAtByStudent: Record<string, number> = {};
  try {
    (await inImmediateTransaction(async () => {
            const delivery = (await db.prepare(
                    `SELECT cs.class_id, cs.session_date, c.status
           FROM class_sessions cs
           JOIN classes c ON c.id = cs.class_id
          WHERE cs.id = ?`,
                  ).get(sessionId)) as { class_id: string; session_date: number; status: ClassStatus } | undefined;
            if (!delivery || delivery.class_id !== classId) throw new Error("session_changed");
            if (!["active", "paused"].includes(delivery.status)) throw new Error("attendance_window_closed");
            if (Number(delivery.session_date) > now) throw new Error("session_not_started");
            if (actorInstructorId) {
              const activeMembership = (await db.prepare(
                        `SELECT 1
             FROM class_instructors ci
             JOIN instructors i ON i.id = ci.instructor_id
            WHERE ci.class_id = ? AND ci.instructor_id = ?
              AND ci.removed_at IS NULL
              AND i.stage IN ('eligible', 'active')
              AND i.eligibility_status = 'eligible'
            LIMIT 1`,
                      ).get(classId, actorInstructorId));
              if (!activeMembership) throw new Error("membership_revoked");
            }
            const report = (await db.prepare("SELECT completed FROM class_session_reports WHERE session_id = ?").get(sessionId)) as
              | { completed: number }
              | undefined;
            if (report?.completed === 1) throw new Error("session_finalized");
            const roster = new Set(
              (
                (await db.prepare("SELECT student_id FROM class_session_roster WHERE session_id = ?").all(sessionId)) as { student_id: string }[]
              ).map((row) => row.student_id),
            );
            if (roster.size === 0) throw new Error("roster_missing");
            if (studentIds.some((studentId) => !roster.has(studentId))) throw new Error("student_not_rostered");

            for (let index = 0; index < records.length; index += 1) {
              const rec = records[index];
              const studentId = studentIds[index];
              const existingRows = (await db
                        .prepare("SELECT id, recorded_at FROM attendance_records WHERE session_id = ? AND student_id = ?")
                        .all(sessionId, studentId)) as { id: string; recorded_at: number }[];
              if (existingRows.length > 1) throw new Error("attendance_invariant");
              const existing = existingRows[0];
              if (
                (existing && rec.expectedRecordedAt !== existing.recorded_at)
                || (!existing && rec.expectedRecordedAt !== null)
              ) {
                throw new Error("attendance_stale");
              }
              const note = (rec.note ?? "").trim() || null;
              const present = rec.status === "present" || rec.status === "late" ? 1 : 0;
              if (existing) {
                const recordedAt = Math.max(now, existing.recorded_at + 1);
                const updated = (await db.prepare(
                            `UPDATE attendance_records
                SET present = ?, status = ?, note = ?, recorded_by = ?, recorded_at = ?
              WHERE id = ? AND recorded_at = ?`,
                          ).run(
                            present,
                            rec.status,
                            note,
                            actorId,
                            recordedAt,
                            existing.id,
                            existing.recorded_at,
                          ));
                if (updated.changes !== 1) throw new Error("attendance_stale");
                recordedAtByStudent[studentId] = recordedAt;
              } else {
                (await db.prepare(
                              `INSERT INTO attendance_records
              (id, session_id, student_id, present, status, note, recorded_by, recorded_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                            ).run(`pfx-${randomUUID().slice(0, 8)}`, sessionId, studentId, present, rec.status, note, actorId, now));
                recordedAtByStudent[studentId] = now;
              }
            }
            const statusCounts: Record<AttendanceStatus, number> = { present: 0, absent: 0, late: 0, excused: 0 };
            for (const record of records) statusCounts[record.status] += 1;
            (await logActivity(
                      "class",
                      classId,
                      "note",
                      `Attendance recorded for ${records.length} student${records.length === 1 ? "" : "s"}: ${statusCounts.present} present, ${statusCounts.late} late, ${statusCounts.absent} absent, ${statusCounts.excused} excused.`,
                      actorId,
                    ));
          }));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "session_changed") return { ok: false, error: "This session changed while attendance was being saved. Refresh and try again." };
    if (code === "membership_revoked") return { ok: false, error: "Your teaching assignment or eligibility changed. Refresh before continuing." };
    if (code === "attendance_window_closed") return { ok: false, error: "Attendance can be recorded only while delivery is active or paused." };
    if (code === "session_not_started") return { ok: false, error: "Attendance cannot be recorded before the session starts." };
    if (code === "session_finalized") return { ok: false, error: "This session is finalized. Use an audited correction workflow." };
    if (code === "roster_missing") return { ok: false, error: "This session has no locked roster. Reconcile the session before attendance." };
    if (code === "student_not_rostered") return { ok: false, error: "Attendance includes a student who was not rostered for this session." };
    if (code === "attendance_invariant") return { ok: false, error: "Duplicate attendance rows must be reconciled before editing." };
    if (code === "attendance_stale") return { ok: false, error: "Attendance changed in another workspace. Refresh before saving so current delivery evidence is not overwritten." };
    throw error;
  }
  revalidatePath(`/app/classes/${classId}`);
  revalidatePath("/app/teach");
  revalidatePath("/app/students");
  return { ok: true, recordedAtByStudent };
}

/* ---------------- proposals ---------------- */

export interface ProposalInput {
  title: string;
  ageGroup?: string;
  curriculumTopic?: string;
  format?: string;
  schedule?: string;
  description?: string;
  resources?: string;
}

export async function createClassProposal(instructorId: string, input: ProposalInput): Promise<ActionResult & { id?: string }> {
  const { instructor } = await requireActiveInstructorSelf();
  if (instructor.id !== instructorId) return { ok: false, error: "forbidden" };

  const title = (input.title ?? "").trim();
  if (!title) return { ok: false, error: "Title is required." };
  if (title.length > 200) return { ok: false, error: "Title is too long." };

  const id = `pfx-${randomUUID().slice(0, 8)}`;
  const now = Date.now();
  (await getDb()
        .prepare(
          `INSERT INTO class_proposals
        (id, instructor_id, title, age_group, curriculum_topic, format, schedule, description, resources, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
        )
        .run(
          id,
          instructorId,
          title.slice(0, 200),
          (input.ageGroup ?? "").trim().slice(0, 60) || null,
          (input.curriculumTopic ?? "").trim().slice(0, 200) || null,
          (input.format ?? "").trim().slice(0, 60) || null,
          (input.schedule ?? "").trim().slice(0, 200) || null,
          (input.description ?? "").trim().slice(0, 4000) || null,
          (input.resources ?? "").trim().slice(0, 2000) || null,
          now,
          now,
        ));

  revalidatePath("/app/teach");
  return { ok: true, id };
}

export async function submitClassProposal(id: string): Promise<ActionResult> {
  const { instructor } = await requireActiveInstructorSelf();
  const db = getDb();
  const row = (await db.prepare("SELECT * FROM class_proposals WHERE id = ?").get(id)) as { id: string; instructor_id: string; status: string } | undefined;
  if (!row) return { ok: false, error: "Not found." };
  if (row.instructor_id !== instructor.id) return { ok: false, error: "forbidden" };
  if (row.status !== "draft") return { ok: false, error: `Can't submit from status "${row.status}".` };

  (await db.prepare("UPDATE class_proposals SET status = 'submitted', updated_at = ? WHERE id = ?").run(Date.now(), id));
  (await logActivity("class_proposal", id, "stage_change", "Proposal submitted.", instructor.id));

  revalidatePath("/app/teach");
  revalidatePath("/app/tasks");
  return { ok: true };
}

export async function decideClassProposal(id: string, decision: "approved" | "declined", note?: string): Promise<ActionResult> {
  const me = await requireStaff();
  if (decision !== "approved" && decision !== "declined") return { ok: false, error: "Invalid decision." };
  const db = getDb();
  const row = (await db.prepare("SELECT * FROM class_proposals WHERE id = ?").get(id)) as { id: string; status: string } | undefined;
  if (!row) return { ok: false, error: "Not found." };
  if (row.status !== "submitted") return { ok: false, error: `Can't decide from status "${row.status}".` };

  (await db.prepare("UPDATE class_proposals SET status = ?, updated_at = ? WHERE id = ?").run(decision, Date.now(), id));
  (await logActivity("class_proposal", id, "stage_change", `Proposal ${decision}.${note ? ` ${note.slice(0, 500)}` : ""}`, me.id));

  const proposal = (await db.prepare("SELECT instructor_id, title FROM class_proposals WHERE id = ?").get(id)) as
    | { instructor_id: string; title: string }
    | undefined;
  if (proposal) {
    const instructorRow = (await db.prepare("SELECT person_id FROM instructors WHERE id = ?").get(proposal.instructor_id)) as
      | { person_id: string }
      | undefined;
    const person = instructorRow
      ? ((await db.prepare("SELECT user_id FROM people WHERE id = ?").get(instructorRow.person_id)) as { user_id: string | null } | undefined)
      : undefined;
    if (person?.user_id) {
      (await createNotification({
                userId: person.user_id,
                type: "class_ops",
                title: `Proposal ${decision}`,
                body: `Your class proposal "${proposal.title}" was ${decision}.${note ? ` ${note.slice(0, 200)}` : ""}`,
                link: "/app/teach/proposals",
              }));
    }
  }

  revalidatePath("/app/tasks");
  revalidatePath("/app/classes/proposals");
  return { ok: true };
}

/** Staff. Converts an approved proposal into one canonical Program + delivery Class. */
export async function convertProposalToClass(
  id: string,
  curriculumId?: string,
): Promise<ActionResult & { classId?: string; programId?: string }> {
  const me = await requireStaff();
  const db = getDb();
  const row = (await db.prepare("SELECT * FROM class_proposals WHERE id = ?").get(id)) as
    | {
        id: string;
        instructor_id: string;
        title: string;
        age_group: string | null;
        curriculum_topic: string | null;
        format: string | null;
        schedule: string | null;
        description: string | null;
        resources: string | null;
        status: string;
        converted_class_id: string | null;
      }
    | undefined;
  if (!row) return { ok: false, error: "Not found." };
  if (row.status !== "approved") return { ok: false, error: "Only an approved proposal can become a Program." };
  if (row.converted_class_id) {
    const existing = (await db.prepare("SELECT program_id FROM classes WHERE id = ?").get(row.converted_class_id)) as
      | { program_id: string | null }
      | undefined;
    return { ok: true, classId: row.converted_class_id, programId: existing?.program_id ?? undefined };
  }

  let classId = `pfx-${randomUUID().slice(0, 8)}`;
  let programId = `prg-${randomUUID()}`;
  try {
    (await inImmediateTransaction(async () => {
            const current = (await db.prepare("SELECT * FROM class_proposals WHERE id = ?").get(id)) as typeof row;
            if (!current) throw new Error("proposal_missing");
            if (current.converted_class_id) {
              classId = current.converted_class_id;
              const existing = (await db.prepare("SELECT program_id FROM classes WHERE id = ?").get(classId)) as { program_id: string | null } | undefined;
              if (!existing?.program_id) throw new Error("converted_program_missing");
              programId = existing.program_id;
              return;
            }
            if (current.status !== "approved") throw new Error("proposal_not_approved");

            let curId = (curriculumId ?? "").trim();
            const now = Date.now();
            if (!curId) {
              curId = `crc-${randomUUID()}`;
              (await db.prepare(
                          "INSERT INTO curricula (id, title, description, age_range, published, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)",
                        ).run(
                          curId,
                          `${current.title} (proposal draft)`,
                          current.curriculum_topic || "Draft curriculum created from an approved instructor proposal.",
                          current.age_group,
                          now,
                          now,
                        ));
            } else if (!(await db.prepare("SELECT 1 FROM curricula WHERE id = ?").get(curId))) {
              throw new Error("curriculum_missing");
            }

            const formatLabel = (current.format ?? "").trim().slice(0, 60) || null;
            const formatLower = formatLabel?.toLowerCase() ?? "";
            const deliveryFormat = formatLower.includes("hybrid") ? "hybrid" : formatLower.includes("online") ? "online" : "in_person";
            const notes = [current.description, current.resources ? `Resources: ${current.resources}` : null].filter(Boolean).join("\n\n").slice(0, 5000) || null;

            (await db.prepare(
                      `INSERT INTO programs
          (id, request_key, name, curriculum_id, audience, delivery_format, stage, schedule_label,
           owner_user_id, source_type, source_id, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'planning', ?, ?, 'class_proposal', ?, ?, ?, ?)`,
                    ).run(programId, `class-proposal:${id}`, current.title, curId, current.age_group, deliveryFormat, current.schedule, me.id, id, notes, now, now));
            (await db.prepare(
                      `INSERT INTO classes
          (id, title, curriculum_id, partner_org_id, location, online_format, start_date, end_date,
           recurrence, age_range, capacity, minimum_enrollment, lead_instructor_id, program_id,
           status, internal_notes, created_at, updated_at)
         VALUES (?, ?, ?, NULL, NULL, ?, NULL, NULL, ?, ?, NULL, 1, NULL, ?, 'planning', ?, ?, ?)`,
                    ).run(classId, current.title, curId, formatLabel, current.schedule, current.age_group, programId, `Created from approved proposal ${id}.`, now, now));
            const claimed = (await db.prepare(
                    "UPDATE class_proposals SET converted_class_id = ?, updated_at = ? WHERE id = ? AND status = 'approved' AND converted_class_id IS NULL",
                  ).run(classId, now, id));
            if (claimed.changes !== 1) throw new Error("proposal_claimed");
            (await logActivity("class_proposal", id, "converted", `Converted to Program ${programId} and Class ${classId}.`, me.id));
            (await logActivity("program", programId, "created", `Created from approved Class proposal ${id}.`, me.id));
            (await logActivity("class", classId, "note", `Created inside Program ${programId} from proposal ${id}.`, me.id));
          }));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "proposal_missing") return { ok: false, error: "Proposal not found." };
    if (code === "proposal_not_approved") return { ok: false, error: "Only an approved proposal can become a Program." };
    if (code === "curriculum_missing") return { ok: false, error: "Curriculum not found." };
    if (code === "converted_program_missing") return { ok: false, error: "The earlier conversion must be reconciled before retrying." };
    if (code === "proposal_claimed") return { ok: false, error: "This proposal was converted by another operator. Refresh to open it." };
    throw error;
  }

  revalidatePath("/app/programs");
  revalidatePath(`/app/programs/${programId}`);
  revalidatePath("/app/classes");
  revalidatePath("/app/classes/proposals");
  revalidatePath("/app/tasks");
  return { ok: true, classId, programId };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
