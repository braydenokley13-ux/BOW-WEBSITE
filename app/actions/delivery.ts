"use server";

/* ============================================================
 * Delivery mutations — instructor assignments (propose/respond),
 * session planning, recurring scheduling, per-instructor session
 * preparation, and session cancellation.
 *
 * Permission model, stated once because every function below depends on it:
 *
 *   - Founders/admins and growth staff propose and revoke assignments, plan
 *     sessions, and schedule recurrences.
 *   - Instructors may only respond to assignments addressed to *them*, and
 *     may only touch preparation for a class they have an accepted,
 *     un-removed assignment on. Every instructor-facing function re-derives
 *     the instructor from the session, never from an argument — an id passed
 *     in from a client is a request, not a fact.
 *   - An instructor can never assign themselves: proposeAssignment is
 *     staff-only, with no instructor branch.
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireStaff, requireActiveInstructorSelf, requireInstructorSelf } from "@/lib/dal";
import { logActivity } from "@/lib/hiring";
import { createNotification } from "@/lib/notifications";
import { isValidTimeZone, localDateTimeToEpoch } from "@/lib/timezone";
import { findScheduleConflicts, isAcceptedClassMember, parseChecklist } from "@/lib/delivery";
import { ASSIGNMENT_ROLES, PREP_CHECKLIST, PREP_STATUSES, type PrepStatus } from "@/lib/delivery-shared";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

async function inImmediateTransaction<T>(operation: () => T | Promise<T>): Promise<T> {
  const db = getDb();
  await db.exec("BEGIN IMMEDIATE");
  try {
    const result = await operation();
    await db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      await db.exec("ROLLBACK");
    } catch {
      /* Preserve the original error. */
    }
    throw error;
  }
}

const ROLE_SET = new Set<string>(ASSIGNMENT_ROLES);
const OPEN_CLASS_STATUSES = new Set(["planning", "staffing", "ready_to_launch", "active", "paused"]);

/* ===================================================================== */
/* Assignments                                                           */
/* ===================================================================== */

export interface ProposeAssignmentInput {
  classId: string;
  instructorId: string;
  role: string;
  expectedCommitment?: string;
  startDate?: string;
  /** Set when the founder has seen the conflicts and wants to proceed anyway. */
  acknowledgeConflicts?: boolean;
}

/**
 * Offers a class to an instructor. This creates a *proposal*, not coverage:
 * nothing downstream — readiness, session prep, roster access — treats the
 * instructor as staffed until they accept. Conflicts are surfaced rather
 * than silently allowed, which is the whole reason the response step exists.
 */
export async function proposeAssignment(input: ProposeAssignmentInput): Promise<ActionResult & { conflicts?: string[] }> {
  const me = await requireStaff();
  const { classId, instructorId, role } = input ?? ({} as ProposeAssignmentInput);
  if (typeof classId !== "string" || typeof instructorId !== "string" || !ROLE_SET.has(role)) {
    return { ok: false, error: "That assignment is missing a class, an instructor, or a valid role." };
  }

  const db = getDb();
  const cls = (await db.prepare("SELECT id, title, status, program_id FROM classes WHERE id = ?").get(classId)) as any;
  if (!cls) return { ok: false, error: "Class not found." };
  if (!OPEN_CLASS_STATUSES.has(cls.status)) return { ok: false, error: "Completed and cancelled Classes cannot be staffed." };

  const instructor = (await db
    .prepare(
      `SELECT i.id, i.stage, i.eligibility_status, pe.name, pe.user_id
         FROM instructors i LEFT JOIN people pe ON pe.id = i.person_id
        WHERE i.id = ?`,
    )
    .get(instructorId)) as any;
  if (!instructor) return { ok: false, error: "Instructor not found." };
  if (!["eligible", "active"].includes(instructor.stage) || instructor.eligibility_status !== "eligible") {
    return { ok: false, error: "Only instructors who have completed readiness can be assigned. Finish their onboarding first." };
  }

  const existing = (await db
    .prepare("SELECT id, assignment_status FROM class_instructors WHERE class_id = ? AND instructor_id = ? AND removed_at IS NULL")
    .get(classId, instructorId)) as any;
  if (existing) {
    return {
      ok: false,
      error: existing.assignment_status === "proposed"
        ? "This instructor already has an unanswered assignment for this Class."
        : "This instructor is already on this Class.",
    };
  }

  const conflicts = await findScheduleConflicts(instructorId, classId);
  if (conflicts.length > 0 && !input.acknowledgeConflicts) {
    return {
      ok: false,
      error: `${instructor.name ?? "This instructor"} is already teaching at that time.`,
      conflicts: conflicts.map((c) => `${c.className} — ${new Date(c.sessionDate).toLocaleString()}`),
    };
  }

  const now = Date.now();
  const id = `ci-${randomUUID().slice(0, 12)}`;
  try {
    await inImmediateTransaction(async () => {
      const stillOpen = (await db.prepare("SELECT status FROM classes WHERE id = ?").get(classId)) as any;
      if (!stillOpen || !OPEN_CLASS_STATUSES.has(stillOpen.status)) throw new Error("class_closed");
      if (
        await db
          .prepare("SELECT 1 FROM class_instructors WHERE class_id = ? AND instructor_id = ? AND removed_at IS NULL")
          .get(classId, instructorId)
      ) {
        throw new Error("duplicate");
      }
      await db
        .prepare(
          `INSERT INTO class_instructors
             (id, class_id, instructor_id, role, assigned_by, added_at, assignment_status, proposed_at, expected_commitment, start_date)
           VALUES (?, ?, ?, ?, ?, ?, 'proposed', ?, ?, ?)`,
        )
        .run(
          id,
          classId,
          instructorId,
          role,
          me.id,
          now,
          now,
          (input.expectedCommitment ?? "").trim().slice(0, 200) || null,
          (input.startDate ?? "").trim().slice(0, 10) || null,
        );
      await logActivity("class", classId, "note", `Assignment proposed to ${instructor.name ?? instructorId} as ${role}.`, me.id);
    });
  } catch (error) {
    if (error instanceof Error && error.message === "duplicate") return { ok: false, error: "That instructor is already on this Class." };
    if (error instanceof Error && error.message === "class_closed") return { ok: false, error: "This Class is no longer open for staffing." };
    throw error;
  }

  if (instructor.user_id) {
    await createNotification({
      userId: instructor.user_id,
      type: "class_ops",
      title: `New teaching assignment: ${cls.title}`,
      body: "BOW has offered you a class. Accept or decline so the program can be confirmed.",
      link: "/app/teach/assignments",
    }).catch(() => undefined);
  }

  revalidatePath("/app/programs");
  revalidatePath("/app/instructor-ops");
  revalidatePath(`/app/classes/${classId}`);
  revalidatePath("/app/teach");
  return { ok: true };
}

/**
 * The instructor's own response. The assignment is looked up *by* the
 * calling instructor's id — a foreign assignment id resolves to nothing,
 * so one instructor can never accept or decline another's work.
 */
export async function respondToAssignment(
  assignmentId: string,
  decision: "accept" | "decline",
  note?: string,
): Promise<ActionResult> {
  const { instructor } = await requireInstructorSelf();
  if (decision !== "accept" && decision !== "decline") return { ok: false, error: "Invalid response." };

  const db = getDb();
  const row = (await db
    .prepare(
      `SELECT ci.id, ci.class_id, ci.assignment_status, c.title
         FROM class_instructors ci JOIN classes c ON c.id = ci.class_id
        WHERE ci.id = ? AND ci.instructor_id = ? AND ci.removed_at IS NULL`,
    )
    .get(assignmentId, instructor.id)) as any;
  if (!row) return { ok: false, error: "Assignment not found." };
  if (row.assignment_status !== "proposed") return { ok: false, error: "You have already responded to this assignment." };

  const now = Date.now();
  const trimmedNote = (note ?? "").trim().slice(0, 500) || null;

  if (decision === "accept") {
    await db
      .prepare(
        `UPDATE class_instructors
            SET assignment_status = 'accepted', responded_at = ?, response_note = ?
          WHERE id = ? AND instructor_id = ? AND assignment_status = 'proposed'`,
      )
      .run(now, trimmedNote, assignmentId, instructor.id);
  } else {
    // A decline both records the answer and vacates the slot in one write,
    // so every existing coverage query (which filters on removed_at) stops
    // counting this instructor immediately, while the founder still sees
    // *why* the slot opened up.
    await db
      .prepare(
        `UPDATE class_instructors
            SET assignment_status = 'declined', responded_at = ?, response_note = ?,
                removed_at = ?, removal_reason = 'Declined by instructor'
          WHERE id = ? AND instructor_id = ? AND assignment_status = 'proposed'`,
      )
      .run(now, trimmedNote, now, assignmentId, instructor.id);
  }

  await logActivity("class", row.class_id, "note", `Assignment ${decision === "accept" ? "accepted" : "declined"} by instructor.`, null).catch(
    () => undefined,
  );

  revalidatePath("/app/teach");
  revalidatePath("/app/teach/assignments");
  revalidatePath("/app/instructor-ops");
  revalidatePath(`/app/classes/${row.class_id}`);
  return { ok: true };
}

/* ===================================================================== */
/* Session planning                                                      */
/* ===================================================================== */

export interface SessionPlanInput {
  title?: string;
  objective?: string;
  agenda?: string;
  materials?: string;
  meetingLink?: string;
  location?: string;
}

/**
 * The plan an instructor prepares from. Editable by staff, and by the
 * class's own accepted instructors — they are the ones who know what the
 * session actually needs to cover.
 */
export async function updateSessionPlan(sessionId: string, input: SessionPlanInput): Promise<ActionResult> {
  const db = getDb();
  const session = (await db.prepare("SELECT id, class_id, status FROM class_sessions WHERE id = ?").get(sessionId)) as any;
  if (!session) return { ok: false, error: "Session not found." };
  if (session.status !== "scheduled") return { ok: false, error: "Completed and cancelled sessions are a historical record and cannot be re-planned." };

  const actor = await resolveDeliveryActor(session.class_id);
  if (!actor.ok) return { ok: false, error: actor.error };

  const clean = (value: unknown, max: number): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, max) : null;
  };
  const link = clean(input.meetingLink, 500);
  if (link && !/^https?:\/\//i.test(link)) return { ok: false, error: "The meeting link must start with http:// or https://." };

  await db
    .prepare(
      `UPDATE class_sessions
          SET title = ?, objective = ?, agenda = ?, materials = ?, meeting_link = ?,
              location = COALESCE(?, location), updated_at = ?
        WHERE id = ?`,
    )
    .run(
      clean(input.title, 160),
      clean(input.objective, 500),
      clean(input.agenda, 4000),
      clean(input.materials, 2000),
      link,
      clean(input.location, 200),
      Date.now(),
      sessionId,
    );

  revalidatePath(`/app/classes/${session.class_id}/sessions/${sessionId}`);
  revalidatePath(`/app/teach/classes/${session.class_id}/sessions/${sessionId}`);
  return { ok: true };
}

export interface RecurringSessionsInput {
  /** First session, local to the class timezone: "YYYY-MM-DDTHH:mm". */
  firstLocalDateTime: string;
  timeZone: string;
  /** How many sessions to create, including the first. */
  count: number;
  /** Days between sessions. 7 for weekly, 14 for fortnightly. */
  intervalDays?: number;
  location?: string;
  meetingLink?: string;
  titlePrefix?: string;
}

/**
 * Creates a run of sessions in one transaction so a partial schedule can
 * never be left behind. Every generated session inherits the class's
 * location/link and is numbered, which is the actual reason founders avoid
 * scheduling by hand — not the date arithmetic, the repetition of every
 * other field.
 */
export async function scheduleRecurringSessions(
  classId: string,
  input: RecurringSessionsInput,
): Promise<ActionResult & { created?: number; skipped?: number }> {
  const me = await requireStaff();
  const db = getDb();
  const cls = (await db.prepare("SELECT * FROM classes WHERE id = ?").get(classId)) as any;
  if (!cls) return { ok: false, error: "Class not found." };
  if (["completed", "cancelled"].includes(cls.status)) return { ok: false, error: "Historical Classes cannot receive new sessions." };

  const count = Math.floor(Number(input?.count ?? 0));
  const intervalDays = Math.floor(Number(input?.intervalDays ?? 7));
  if (!Number.isFinite(count) || count < 1 || count > 52) return { ok: false, error: "Schedule between 1 and 52 sessions at a time." };
  if (!Number.isFinite(intervalDays) || intervalDays < 1 || intervalDays > 90) return { ok: false, error: "Use an interval between 1 and 90 days." };

  const timeZone = (input.timeZone ?? "").trim();
  if (!isValidTimeZone(timeZone)) return { ok: false, error: "Select a valid timezone." };
  if (cls.schedule_timezone && cls.schedule_timezone !== timeZone) {
    return { ok: false, error: `This Class is scheduled in ${cls.schedule_timezone}.` };
  }

  const first = localDateTimeToEpoch(input.firstLocalDateTime ?? "", timeZone);
  if (!first.ok) return { ok: false, error: first.error };
  const now = Date.now();
  if (first.epoch <= now) return { ok: false, error: "Schedule sessions before they start." };

  const DAY_MS = 24 * 60 * 60 * 1000;
  let created = 0;
  let skipped = 0;

  try {
    await inImmediateTransaction(async () => {
      const current = (await db.prepare("SELECT status, schedule_timezone, start_date, end_date FROM classes WHERE id = ?").get(classId)) as any;
      if (!current || ["completed", "cancelled"].includes(current.status)) throw new Error("class_history_frozen");
      if (!current.schedule_timezone) {
        await db.prepare("UPDATE classes SET schedule_timezone = ?, updated_at = ? WHERE id = ?").run(timeZone, now, classId);
      }

      for (let index = 0; index < count; index += 1) {
        const epoch = first.epoch + index * intervalDays * DAY_MS;
        const localDate = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(epoch);
        if (current.start_date && localDate < current.start_date) { skipped += 1; continue; }
        if (current.end_date && localDate > current.end_date) { skipped += 1; continue; }
        if (await db.prepare("SELECT 1 FROM class_sessions WHERE class_id = ? AND session_date = ?").get(classId, epoch)) {
          skipped += 1;
          continue;
        }
        const id = `pfx-${randomUUID().slice(0, 8)}`;
        const title = (input.titlePrefix ?? "").trim()
          ? `${(input.titlePrefix ?? "").trim().slice(0, 120)} ${index + 1}`
          : `Session ${index + 1}`;
        await db
          .prepare(
            `INSERT INTO class_sessions
               (id, class_id, session_date, session_on, timezone, location, meeting_link, title, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?)`,
          )
          .run(
            id,
            classId,
            epoch,
            localDate,
            timeZone,
            (input.location ?? cls.location ?? "").trim().slice(0, 200) || null,
            (input.meetingLink ?? "").trim().slice(0, 500) || null,
            title,
            now,
            now,
          );
        // Roster snapshot, identical to the single-session path: the set of
        // students is delivery evidence and must be fixed at creation.
        await db
          .prepare(
            `INSERT INTO class_session_roster (id, session_id, student_id, enrollment_id, rostered_at)
             SELECT 'csr-' || replace(gen_random_uuid()::text, '-', ''), ?, ce.student_id, ce.id, ?
               FROM class_enrollments ce
               JOIN students s ON s.id = ce.student_id
              WHERE ce.class_id = ? AND ce.status = 'enrolled' AND s.enrollment_status = 'active'`,
          )
          .run(id, now, classId);
        created += 1;
      }
      await logActivity("class", classId, "note", `${created} recurring session(s) scheduled.`, me.id);
    });
  } catch (error) {
    if (error instanceof Error && error.message === "class_history_frozen") return { ok: false, error: "Historical Classes cannot receive new sessions." };
    throw error;
  }

  revalidatePath(`/app/classes/${classId}`);
  revalidatePath("/app/teach");
  revalidatePath("/app/programs");
  return { ok: true, created, skipped };
}

export async function cancelSession(sessionId: string, reason: string): Promise<ActionResult> {
  const db = getDb();
  const session = (await db.prepare("SELECT id, class_id, status FROM class_sessions WHERE id = ?").get(sessionId)) as any;
  if (!session) return { ok: false, error: "Session not found." };
  if (session.status === "completed") return { ok: false, error: "A completed session cannot be cancelled — it already happened." };
  if (session.status === "cancelled") return { ok: true };

  const actor = await resolveDeliveryActor(session.class_id);
  if (!actor.ok) return { ok: false, error: actor.error };
  const trimmed = (reason ?? "").trim();
  if (trimmed.length < 3) return { ok: false, error: "Say why the session was cancelled — it is the record families and staff will read." };

  await db
    .prepare(
      `UPDATE class_sessions
          SET status = 'cancelled', cancellation_reason = ?, cancelled_by = ?, cancelled_at = ?, updated_at = ?
        WHERE id = ? AND status = 'scheduled'`,
    )
    .run(trimmed.slice(0, 500), actor.userId, Date.now(), Date.now(), sessionId);
  await logActivity("class", session.class_id, "note", `Session cancelled: ${trimmed.slice(0, 200)}`, actor.userId).catch(() => undefined);

  revalidatePath(`/app/classes/${session.class_id}`);
  revalidatePath(`/app/teach/classes/${session.class_id}`);
  revalidatePath("/app/programs");
  return { ok: true };
}

/* ===================================================================== */
/* Preparation                                                           */
/* ===================================================================== */

export interface SessionPrepInput {
  checklist: Record<string, boolean>;
  blockers?: string;
  /** Omit to derive from the checklist; pass explicitly to park work mid-way. */
  status?: PrepStatus;
}

/**
 * Records *this* instructor's preparation for a session. The instructor is
 * taken from the session, never from an argument, and membership must be an
 * accepted assignment — an unanswered proposal grants no access to the
 * class's roster or plan.
 */
export async function saveSessionPrep(sessionId: string, input: SessionPrepInput): Promise<ActionResult & { status?: PrepStatus }> {
  const { instructor } = await requireActiveInstructorSelf();
  const db = getDb();
  const session = (await db.prepare("SELECT id, class_id, status FROM class_sessions WHERE id = ?").get(sessionId)) as any;
  if (!session) return { ok: false, error: "Session not found." };
  if (session.status !== "scheduled") return { ok: false, error: "This session is closed." };
  if (!(await isAcceptedClassMember(session.class_id, instructor.id))) return { ok: false, error: "forbidden" };

  const submitted = input?.checklist && typeof input.checklist === "object" ? input.checklist : {};
  const checklist = PREP_CHECKLIST.map((item) => ({ key: item.key, label: item.label, done: Boolean(submitted[item.key]) }));
  const doneCount = checklist.filter((item) => item.done).length;

  let status: PrepStatus;
  if (input.status && PREP_STATUSES.includes(input.status)) {
    // An instructor cannot declare readiness they have not actually recorded.
    status = input.status === "ready" && doneCount < checklist.length ? "in_preparation" : input.status;
  } else {
    status = doneCount === 0 ? "not_started" : doneCount === checklist.length ? "ready" : "in_preparation";
  }

  const now = Date.now();
  const blockers = (input.blockers ?? "").trim().slice(0, 1000) || null;
  await db
    .prepare(
      `INSERT INTO class_session_prep (id, session_id, instructor_id, status, checklist, blockers, reviewed_materials, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (session_id, instructor_id) DO UPDATE
         SET status = EXCLUDED.status, checklist = EXCLUDED.checklist,
             blockers = EXCLUDED.blockers, reviewed_materials = EXCLUDED.reviewed_materials,
             updated_at = EXCLUDED.updated_at`,
    )
    .run(
      `prep-${randomUUID().slice(0, 12)}`,
      sessionId,
      instructor.id,
      status,
      JSON.stringify(checklist),
      blockers,
      checklist.find((item) => item.key === "materials")?.done ? 1 : 0,
      now,
    );

  revalidatePath("/app/teach");
  revalidatePath(`/app/teach/classes/${session.class_id}/sessions/${sessionId}`);
  revalidatePath(`/app/classes/${session.class_id}/sessions/${sessionId}`);
  revalidatePath("/app/programs");
  return { ok: true, status };
}

/** Read-side helper used by the prep form to render the stored snapshot. */
export async function getMySessionPrep(sessionId: string): Promise<{ status: PrepStatus; checklist: { key: string; label: string; done: boolean }[]; blockers: string } | null> {
  const { instructor } = await requireInstructorSelf();
  const row = (await getDb()
    .prepare("SELECT status, checklist, blockers FROM class_session_prep WHERE session_id = ? AND instructor_id = ?")
    .get(sessionId, instructor.id)) as any;
  if (!row) return { status: "not_started", checklist: parseChecklist(null), blockers: "" };
  return { status: row.status, checklist: parseChecklist(row.checklist), blockers: row.blockers ?? "" };
}

/* ===================================================================== */
/* Shared actor resolution                                               */
/* ===================================================================== */

/**
 * Staff, or an instructor with an accepted assignment on this class.
 * Returns the acting user id for audit trails.
 */
async function resolveDeliveryActor(
  classId: string,
): Promise<{ ok: true; userId: string; isStaff: boolean } | { ok: false; error: string }> {
  try {
    const me = await requireStaff();
    return { ok: true, userId: me.id, isStaff: true };
  } catch {
    /* Not staff — fall through to the instructor path. */
  }
  try {
    const { user, instructor } = await requireActiveInstructorSelf();
    if (!(await isAcceptedClassMember(classId, instructor.id))) return { ok: false, error: "forbidden" };
    return { ok: true, userId: user.id, isStaff: false };
  } catch {
    return { ok: false, error: "forbidden" };
  }
}
