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
import { requireStaff, requireInstructorSelf, requireRole } from "@/lib/dal";
import { logActivity, type ClassStatus } from "@/lib/hiring";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const STATUSES = new Set<ClassStatus>(["planning", "staffing", "ready_to_launch", "active", "completed", "cancelled"]);
const ROLES = new Set(["lead", "additional"]);

/* eslint-disable @typescript-eslint/no-explicit-any */
function getClassRow(id: string): any {
  return getDb().prepare("SELECT * FROM classes WHERE id = ?").get(id) as any;
}

/** True if `instructorId` is lead or additional on `classId`. */
function isClassMember(classId: string, instructorId: string): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM class_instructors WHERE class_id = ? AND instructor_id = ?")
    .get(classId, instructorId);
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
  ageRange?: string;
  capacity?: number;
  internalNotes?: string;
}

export async function createClass(input: CreateClassInput): Promise<ActionResult & { id?: string }> {
  const me = await requireStaff();
  const title = (input.title ?? "").trim();
  if (!title) return { ok: false, error: "Title is required." };
  if (title.length > 200) return { ok: false, error: "Title is too long." };
  const curriculumId = (input.curriculumId ?? "").trim();
  if (!curriculumId) return { ok: false, error: "Curriculum is required." };

  const db = getDb();
  const curriculum = db.prepare("SELECT 1 FROM curricula WHERE id = ?").get(curriculumId);
  if (!curriculum) return { ok: false, error: "Curriculum not found." };

  if (input.partnerOrgId) {
    const org = db.prepare("SELECT 1 FROM organizations WHERE id = ?").get(input.partnerOrgId);
    if (!org) return { ok: false, error: "Partner organization not found." };
  }

  const capacity =
    input.capacity !== undefined && input.capacity !== null && Number.isFinite(input.capacity)
      ? Math.max(0, Math.trunc(input.capacity))
      : null;

  const id = `pfx-${randomUUID().slice(0, 8)}`;
  const now = Date.now();
  db.prepare(
    `INSERT INTO classes
      (id, title, curriculum_id, partner_org_id, location, online_format, start_date, end_date, recurrence, age_range, capacity, lead_instructor_id, status, internal_notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'planning', ?, ?, ?)`,
  ).run(
    id,
    title.slice(0, 200),
    curriculumId,
    input.partnerOrgId || null,
    (input.location ?? "").trim().slice(0, 200) || null,
    (input.onlineFormat ?? "").trim().slice(0, 60) || null,
    (input.startDate ?? "").trim().slice(0, 20) || null,
    (input.endDate ?? "").trim().slice(0, 20) || null,
    (input.recurrence ?? "").trim().slice(0, 200) || null,
    (input.ageRange ?? "").trim().slice(0, 60) || null,
    capacity,
    (input.internalNotes ?? "").trim().slice(0, 2000) || null,
    now,
    now,
  );

  logActivity("class", id, "note", `Class "${title}" created.`, me.id);
  revalidatePath("/app/classes");
  revalidatePath("/app");
  return { ok: true, id };
}

export interface UpdateClassPatch {
  title?: string;
  partnerOrgId?: string | null;
  location?: string;
  onlineFormat?: string;
  startDate?: string;
  endDate?: string;
  recurrence?: string;
  ageRange?: string;
  capacity?: number | null;
  internalNotes?: string;
}

export async function updateClass(id: string, patch: UpdateClassPatch): Promise<ActionResult> {
  await requireStaff();
  const db = getDb();
  const row = getClassRow(id);
  if (!row) return { ok: false, error: "Not found." };

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
      const org = db.prepare("SELECT 1 FROM organizations WHERE id = ?").get(patch.partnerOrgId);
      if (!org) return { ok: false, error: "Partner organization not found." };
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
  if (patch.ageRange !== undefined) {
    sets.push("age_range = ?");
    vals.push(patch.ageRange.trim().slice(0, 60) || null);
  }
  if (patch.capacity !== undefined) {
    sets.push("capacity = ?");
    vals.push(patch.capacity === null || !Number.isFinite(patch.capacity) ? null : Math.max(0, Math.trunc(patch.capacity)));
  }
  if (patch.internalNotes !== undefined) {
    sets.push("internal_notes = ?");
    vals.push(patch.internalNotes.trim().slice(0, 2000) || null);
  }
  if (sets.length === 0) return { ok: true };

  sets.push("updated_at = ?");
  vals.push(Date.now());
  vals.push(id);
  db.prepare(`UPDATE classes SET ${sets.join(", ")} WHERE id = ?`).run(...(vals as []));

  revalidatePath(`/app/classes/${id}`);
  revalidatePath("/app/classes");
  return { ok: true };
}

export async function updateClassStatus(id: string, status: string): Promise<ActionResult> {
  const me = await requireStaff();
  if (!STATUSES.has(status as ClassStatus)) return { ok: false, error: "Invalid status." };
  const row = getClassRow(id);
  if (!row) return { ok: false, error: "Not found." };

  getDb().prepare("UPDATE classes SET status = ?, updated_at = ? WHERE id = ?").run(status, Date.now(), id);
  logActivity("class", id, "stage_change", `Status changed to ${status}.`, me.id);

  revalidatePath(`/app/classes/${id}`);
  revalidatePath("/app/classes");
  revalidatePath("/app");
  return { ok: true };
}

/* ---------------- instructor assignment ---------------- */

export async function assignInstructorToClass(classId: string, instructorId: string, role: string): Promise<ActionResult> {
  const me = await requireStaff();
  if (!ROLES.has(role)) return { ok: false, error: "Invalid role." };
  const db = getDb();
  const cls = getClassRow(classId);
  if (!cls) return { ok: false, error: "Class not found." };

  const instructor = db.prepare("SELECT * FROM instructors WHERE id = ?").get(instructorId) as { id: string; stage: string } | undefined;
  if (!instructor) return { ok: false, error: "Instructor not found." };
  if (!["eligible", "active"].includes(instructor.stage)) return { ok: false, error: "not_eligible" };

  const now = Date.now();
  const existing = db
    .prepare("SELECT * FROM class_instructors WHERE class_id = ? AND instructor_id = ?")
    .get(classId, instructorId) as { id: string } | undefined;

  if (role === "lead") {
    // Demote any prior lead on this class to additional.
    db.prepare("UPDATE class_instructors SET role = 'additional' WHERE class_id = ? AND role = 'lead'").run(classId);
    if (existing) {
      db.prepare("UPDATE class_instructors SET role = 'lead' WHERE id = ?").run(existing.id);
    } else {
      db.prepare(
        "INSERT INTO class_instructors (id, class_id, instructor_id, role, added_at) VALUES (?, ?, ?, 'lead', ?)",
      ).run(`pfx-${randomUUID().slice(0, 8)}`, classId, instructorId, now);
    }
    db.prepare("UPDATE classes SET lead_instructor_id = ?, updated_at = ? WHERE id = ?").run(instructorId, now, classId);
  } else if (!existing) {
    db.prepare(
      "INSERT INTO class_instructors (id, class_id, instructor_id, role, added_at) VALUES (?, ?, ?, 'additional', ?)",
    ).run(`pfx-${randomUUID().slice(0, 8)}`, classId, instructorId, now);
  }

  logActivity("class", classId, "note", `Instructor assigned (${role}).`, me.id);
  revalidatePath(`/app/classes/${classId}`);
  revalidatePath("/app/classes");
  revalidatePath("/app/teach");
  return { ok: true };
}

export async function removeInstructorFromClass(classId: string, instructorId: string): Promise<ActionResult> {
  const me = await requireStaff();
  const db = getDb();
  const cls = getClassRow(classId);
  if (!cls) return { ok: false, error: "Not found." };

  db.prepare("DELETE FROM class_instructors WHERE class_id = ? AND instructor_id = ?").run(classId, instructorId);
  if (cls.lead_instructor_id === instructorId) {
    db.prepare("UPDATE classes SET lead_instructor_id = NULL, updated_at = ? WHERE id = ?").run(Date.now(), classId);
  }
  logActivity("class", classId, "note", "Instructor removed.", me.id);

  revalidatePath(`/app/classes/${classId}`);
  revalidatePath("/app/classes");
  return { ok: true };
}

/* ---------------- sessions ---------------- */

export interface CreateSessionInput {
  sessionDate: number;
  location?: string;
}

export async function createClassSession(classId: string, input: CreateSessionInput): Promise<ActionResult & { id?: string }> {
  const me = await requireRole("admin", "growth", "instructor");
  const cls = getClassRow(classId);
  if (!cls) return { ok: false, error: "Class not found." };

  if (me.role === "instructor") {
    const { instructor } = await requireInstructorSelf();
    if (!isClassMember(classId, instructor.id)) return { ok: false, error: "forbidden" };
  }

  if (!Number.isFinite(input.sessionDate) || input.sessionDate <= 0) return { ok: false, error: "Invalid session date." };

  const id = `pfx-${randomUUID().slice(0, 8)}`;
  const now = Date.now();
  getDb()
    .prepare("INSERT INTO class_sessions (id, class_id, session_date, location, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, classId, input.sessionDate, (input.location ?? "").trim().slice(0, 200) || null, now);

  logActivity("class", classId, "note", "Session scheduled.", me.id);
  revalidatePath(`/app/classes/${classId}`);
  revalidatePath("/app/teach");
  return { ok: true, id };
}

/** Resolves a session's class id; used by membership checks below. */
function getSessionClassId(sessionId: string): string | null {
  const row = getDb().prepare("SELECT class_id FROM class_sessions WHERE id = ?").get(sessionId) as { class_id: string } | undefined;
  return row?.class_id ?? null;
}

export interface SessionReportInput {
  notes: string;
  flagged: boolean;
  flagReason?: string;
  completed: boolean;
}

/**
 * requireInstructorSelf, plus staff. The membership check against
 * class_instructors is the actual security boundary — a foreign
 * instructor id must be rejected even if some future UI bug lets the
 * call fire.
 */
export async function submitSessionReport(sessionId: string, input: SessionReportInput): Promise<ActionResult> {
  const me = await requireRole("admin", "growth", "instructor");
  const classId = getSessionClassId(sessionId);
  if (!classId) return { ok: false, error: "Session not found." };

  let actorId = me.id;
  if (me.role === "instructor") {
    const { instructor } = await requireInstructorSelf();
    if (!isClassMember(classId, instructor.id)) return { ok: false, error: "forbidden" };
    actorId = me.id;
  }

  const notes = (input.notes ?? "").trim().slice(0, 4000);
  const flagReason = (input.flagReason ?? "").trim().slice(0, 500);

  const db = getDb();
  const existing = db.prepare("SELECT id FROM class_session_reports WHERE session_id = ?").get(sessionId) as { id: string } | undefined;
  const now = Date.now();
  if (existing) {
    db.prepare(
      "UPDATE class_session_reports SET notes = ?, flagged = ?, flag_reason = ?, completed = ?, reported_by = ?, reported_at = ? WHERE id = ?",
    ).run(notes || null, input.flagged ? 1 : 0, flagReason || null, input.completed ? 1 : 0, actorId, now, existing.id);
  } else {
    db.prepare(
      "INSERT INTO class_session_reports (id, session_id, notes, flagged, flag_reason, completed, reported_by, reported_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(`pfx-${randomUUID().slice(0, 8)}`, sessionId, notes || null, input.flagged ? 1 : 0, flagReason || null, input.completed ? 1 : 0, actorId, now);
  }

  logActivity("class", classId, "note", `Session report submitted${input.flagged ? " (flagged)" : ""}.`, actorId);
  revalidatePath(`/app/classes/${classId}`);
  revalidatePath("/app/teach");
  revalidatePath("/app");
  return { ok: true };
}

export interface AttendanceInput {
  studentId: string;
  present: boolean;
  note?: string;
}

/** Same membership check as submitSessionReport. */
export async function recordAttendance(sessionId: string, records: AttendanceInput[]): Promise<ActionResult> {
  const me = await requireRole("admin", "growth", "instructor");
  const classId = getSessionClassId(sessionId);
  if (!classId) return { ok: false, error: "Session not found." };

  let actorId = me.id;
  if (me.role === "instructor") {
    const { instructor } = await requireInstructorSelf();
    if (!isClassMember(classId, instructor.id)) return { ok: false, error: "forbidden" };
    actorId = me.id;
  }

  if (!Array.isArray(records) || records.length === 0) return { ok: false, error: "No attendance records provided." };
  if (records.length > 500) return { ok: false, error: "Too many records." };

  const db = getDb();
  const now = Date.now();
  for (const rec of records) {
    if (!rec.studentId) continue;
    const existing = db
      .prepare("SELECT id FROM attendance_records WHERE session_id = ? AND student_id = ?")
      .get(sessionId, rec.studentId) as { id: string } | undefined;
    const note = (rec.note ?? "").trim().slice(0, 500) || null;
    if (existing) {
      db.prepare("UPDATE attendance_records SET present = ?, note = ?, recorded_by = ?, recorded_at = ? WHERE id = ?").run(
        rec.present ? 1 : 0,
        note,
        actorId,
        now,
        existing.id,
      );
    } else {
      db.prepare(
        "INSERT INTO attendance_records (id, session_id, student_id, present, note, recorded_by, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).run(`pfx-${randomUUID().slice(0, 8)}`, sessionId, rec.studentId, rec.present ? 1 : 0, note, actorId, now);
    }
  }

  logActivity("class", classId, "note", "Attendance recorded.", actorId);
  revalidatePath(`/app/classes/${classId}`);
  revalidatePath("/app/teach");
  revalidatePath("/app/students");
  return { ok: true };
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
  const { instructor } = await requireInstructorSelf();
  if (instructor.id !== instructorId) return { ok: false, error: "forbidden" };

  const title = (input.title ?? "").trim();
  if (!title) return { ok: false, error: "Title is required." };
  if (title.length > 200) return { ok: false, error: "Title is too long." };

  const id = `pfx-${randomUUID().slice(0, 8)}`;
  const now = Date.now();
  getDb()
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
    );

  revalidatePath("/app/teach");
  return { ok: true, id };
}

export async function submitClassProposal(id: string): Promise<ActionResult> {
  const { instructor } = await requireInstructorSelf();
  const db = getDb();
  const row = db.prepare("SELECT * FROM class_proposals WHERE id = ?").get(id) as { id: string; instructor_id: string; status: string } | undefined;
  if (!row) return { ok: false, error: "Not found." };
  if (row.instructor_id !== instructor.id) return { ok: false, error: "forbidden" };
  if (row.status !== "draft") return { ok: false, error: `Can't submit from status "${row.status}".` };

  db.prepare("UPDATE class_proposals SET status = 'submitted', updated_at = ? WHERE id = ?").run(Date.now(), id);
  logActivity("class_proposal", id, "stage_change", "Proposal submitted.", instructor.id);

  revalidatePath("/app/teach");
  revalidatePath("/app/tasks");
  return { ok: true };
}

export async function decideClassProposal(id: string, decision: "approved" | "declined", note?: string): Promise<ActionResult> {
  const me = await requireStaff();
  if (decision !== "approved" && decision !== "declined") return { ok: false, error: "Invalid decision." };
  const db = getDb();
  const row = db.prepare("SELECT * FROM class_proposals WHERE id = ?").get(id) as { id: string; status: string } | undefined;
  if (!row) return { ok: false, error: "Not found." };
  if (row.status !== "submitted") return { ok: false, error: `Can't decide from status "${row.status}".` };

  db.prepare("UPDATE class_proposals SET status = ?, updated_at = ? WHERE id = ?").run(decision, Date.now(), id);
  logActivity("class_proposal", id, "stage_change", `Proposal ${decision}.${note ? ` ${note.slice(0, 500)}` : ""}`, me.id);

  revalidatePath("/app/tasks");
  return { ok: true };
}

/** Staff. Converts an approved proposal into a real classes row. */
export async function convertProposalToClass(id: string, curriculumId?: string): Promise<ActionResult & { classId?: string }> {
  const me = await requireStaff();
  const db = getDb();
  const row = db.prepare("SELECT * FROM class_proposals WHERE id = ?").get(id) as
    | { id: string; title: string; age_group: string | null; status: string; converted_class_id: string | null }
    | undefined;
  if (!row) return { ok: false, error: "Not found." };
  if (row.converted_class_id) return { ok: false, error: "Already converted." };

  let curId = (curriculumId ?? "").trim();
  if (!curId) {
    // No curriculum supplied — create a placeholder curriculum from the
    // proposal's title so classes.curriculum_id (NOT NULL) is satisfied.
    curId = `pfx-${randomUUID().slice(0, 8)}`;
    const now = Date.now();
    db.prepare(
      "INSERT INTO curricula (id, title, description, age_range, published, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)",
    ).run(curId, `${row.title} (from proposal)`, "Placeholder curriculum created from an instructor proposal.", row.age_group, now, now);
  } else {
    const curriculum = db.prepare("SELECT 1 FROM curricula WHERE id = ?").get(curId);
    if (!curriculum) return { ok: false, error: "Curriculum not found." };
  }

  const classId = `pfx-${randomUUID().slice(0, 8)}`;
  const now = Date.now();
  db.prepare(
    `INSERT INTO classes
      (id, title, curriculum_id, partner_org_id, location, online_format, start_date, end_date, recurrence, age_range, capacity, lead_instructor_id, status, internal_notes, created_at, updated_at)
     VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, ?, NULL, NULL, 'planning', ?, ?, ?)`,
  ).run(classId, row.title, curId, null, row.age_group, `Converted from proposal ${id}.`, now, now);

  db.prepare("UPDATE class_proposals SET status = 'approved', converted_class_id = ?, updated_at = ? WHERE id = ?").run(classId, now, id);
  logActivity("class_proposal", id, "note", `Converted to class ${classId}.`, me.id);
  logActivity("class", classId, "note", `Created from proposal ${id}.`, me.id);

  revalidatePath("/app/classes");
  revalidatePath("/app/tasks");
  return { ok: true, classId };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
