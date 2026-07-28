/* ============================================================
 * Program completion — attendance rollup, completion rules, certificates,
 * and the next-program recommendation.
 *
 * The rule this module exists to enforce: a student is not complete because
 * the end date passed. Completion is a decision against configured rules
 * (minimum attendance, instructor confirmation, admin approval), and a
 * certificate is only ever issued against a completion that actually met
 * them. `program_completion_records` is keyed to the registration rather than
 * to `users.id` because a registered child may never log in — the legacy
 * `certificates` table cannot represent them at all.
 *
 * Server-only, not a "use server" module.
 * ============================================================ */

import "server-only";

import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { recordAudit, recordNotification } from "@/lib/enrollment";

/* ===================================================================== */
/* Attendance                                                            */
/* ===================================================================== */

export interface AttendanceSummary {
  attended: number;
  absent: number;
  excused: number;
  pending: number;
  cancelled: number;
  /** Sessions that have happened and could be attended. */
  countable: number;
  /** Every non-cancelled session in the class, including future ones. */
  scheduled: number;
  rate: number | null;
}

/**
 * Attendance for one registration.
 *
 * The rate deliberately divides by sessions that have already happened, not
 * by every session on the calendar — mid-program a student who has attended
 * everything so far is at 100%, not at 40% because the term is not over.
 * Cancelled sessions never count against anyone.
 */
export async function attendanceSummary(registrationId: string): Promise<AttendanceSummary> {
  const db = getDb();
  const registration = (await db
    .prepare("SELECT class_id, student_id FROM program_registrations WHERE id = ?")
    .get(registrationId)) as { class_id: string | null; student_id: string } | undefined;

  const empty: AttendanceSummary = {
    attended: 0,
    absent: 0,
    excused: 0,
    pending: 0,
    cancelled: 0,
    countable: 0,
    scheduled: 0,
    rate: null,
  };
  if (!registration?.class_id) return empty;

  const rows = (await db
    .prepare(
      `SELECT cs.id, cs.status, cs.session_date, ar.present, ar.status AS attendance_status
         FROM class_sessions cs
         LEFT JOIN attendance_records ar
           ON ar.session_id = cs.id AND ar.student_id = ?
        WHERE cs.class_id = ?
        ORDER BY cs.session_date`,
    )
    .all(registration.student_id, registration.class_id)) as unknown as {
    id: string;
    status: string;
    session_date: number;
    present: number | null;
    attendance_status: string | null;
  }[];

  const now = Date.now();
  const summary = { ...empty };
  for (const row of rows) {
    if (row.status === "cancelled") {
      summary.cancelled += 1;
      continue;
    }
    summary.scheduled += 1;
    const past = Number(row.session_date) <= now;
    const state = row.attendance_status ?? (row.present == null ? null : row.present ? "present" : "absent");
    if (state === "excused") {
      summary.excused += 1;
      if (past) summary.countable += 1;
      continue;
    }
    if (state === "present") {
      summary.attended += 1;
      if (past) summary.countable += 1;
      continue;
    }
    if (state === "absent") {
      summary.absent += 1;
      if (past) summary.countable += 1;
      continue;
    }
    if (past) summary.pending += 1;
  }

  // An excused absence neither helps nor penalises: it leaves the denominator.
  const denominator = summary.countable - summary.excused;
  summary.rate = denominator > 0 ? Math.round((summary.attended / denominator) * 100) : null;
  return summary;
}

/* ===================================================================== */
/* Completion rules                                                      */
/* ===================================================================== */

export interface CompletionRules {
  minAttendance: number | null;
  requiresInstructor: boolean;
  requiresAdmin: boolean;
  certificateEnabled: boolean;
  feedbackEnabled: boolean;
}

export interface CompletionEvaluation {
  eligible: boolean;
  /** Every rule that is not yet satisfied, in plain language. */
  blockers: string[];
  attendance: AttendanceSummary;
  rules: CompletionRules;
  /** True when the final session has happened. */
  sessionsFinished: boolean;
}

export async function completionRules(programId: string): Promise<CompletionRules> {
  const db = getDb();
  const row = (await db
    .prepare(
      `SELECT completion_min_attendance, completion_requires_instructor, completion_requires_admin,
              certificate_enabled, feedback_enabled
         FROM programs WHERE id = ?`,
    )
    .get(programId)) as
    | {
        completion_min_attendance: number | null;
        completion_requires_instructor: boolean;
        completion_requires_admin: boolean;
        certificate_enabled: boolean;
        feedback_enabled: boolean;
      }
    | undefined;
  return {
    minAttendance: row?.completion_min_attendance ?? null,
    requiresInstructor: Boolean(row?.completion_requires_instructor),
    requiresAdmin: row?.completion_requires_admin ?? true,
    certificateEnabled: Boolean(row?.certificate_enabled),
    feedbackEnabled: row?.feedback_enabled ?? true,
  };
}

/**
 * Evaluate one registration against its program's completion rules. Never
 * mutates — the admin completion queue renders this, and `completeRegistration`
 * re-checks it before writing, so a stale queue page cannot complete a student
 * who no longer qualifies.
 */
export async function evaluateCompletion(registrationId: string): Promise<CompletionEvaluation | null> {
  const db = getDb();
  const registration = (await db
    .prepare("SELECT id, program_id, class_id, status FROM program_registrations WHERE id = ?")
    .get(registrationId)) as
    | { id: string; program_id: string; class_id: string | null; status: string }
    | undefined;
  if (!registration) return null;

  const rules = await completionRules(registration.program_id);
  const attendance = await attendanceSummary(registrationId);
  const blockers: string[] = [];

  if (registration.status !== "confirmed" && registration.status !== "completed") {
    blockers.push("The registration is not confirmed.");
  }

  const remaining = (await db
    .prepare(
      `SELECT COUNT(*) AS n FROM class_sessions
        WHERE class_id = ? AND status = 'scheduled' AND session_date > ?`,
    )
    .get(registration.class_id, Date.now())) as { n: number | string };
  const sessionsFinished = Number(remaining?.n ?? 0) === 0;
  if (!sessionsFinished) blockers.push("The program still has sessions remaining.");

  if (attendance.pending > 0) {
    blockers.push(
      attendance.pending === 1
        ? "One session is still missing attendance."
        : `${attendance.pending} sessions are still missing attendance.`,
    );
  }

  if (rules.minAttendance != null) {
    if (attendance.rate == null) {
      blockers.push("There is no attendance recorded to check against the minimum.");
    } else if (attendance.rate < rules.minAttendance) {
      blockers.push(`Attendance is ${attendance.rate}%, below the ${rules.minAttendance}% minimum.`);
    }
  }

  if (rules.requiresInstructor) {
    const confirmed = (await db
      .prepare(
        `SELECT 1 AS ok FROM registration_audit_events
          WHERE registration_id = ? AND action = 'instructor_completion_confirmed' LIMIT 1`,
      )
      .get(registrationId)) as { ok: number } | undefined;
    if (!confirmed) blockers.push("The instructor has not confirmed completion.");
  }

  return { eligible: blockers.length === 0, blockers, attendance, rules, sessionsFinished };
}

/* ===================================================================== */
/* Completion + certificate                                              */
/* ===================================================================== */

/** Human-checkable, non-guessable serial for a certificate. */
function certificateSerial(): string {
  return `BOW-${new Date().getFullYear()}-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

export interface CompletionOutcomeInput {
  registrationId: string;
  outcome: "completed" | "participated" | "not_completed";
  summary?: string | null;
  actor: { userId?: string | null; label: string };
  /** Set when an authorized admin is recording a result the rules do not support. */
  overrideReason?: string | null;
}

export class CompletionError extends Error {}

/**
 * Record the completion result and, when earned, issue the certificate.
 *
 * A `completed` outcome re-checks the rules unless an authorized admin
 * supplies an explicit override reason, which is recorded in the audit trail.
 * `participated` is the honest result for a student who took part but did not
 * meet the bar, and never produces a certificate.
 */
export async function completeRegistration(input: CompletionOutcomeInput): Promise<{ serial: string | null }> {
  const db = getDb();
  const evaluation = await evaluateCompletion(input.registrationId);
  if (!evaluation) throw new CompletionError("Registration not found.");

  if (input.outcome === "completed" && !evaluation.eligible && !input.overrideReason) {
    throw new CompletionError(
      `This student does not meet the completion rules yet: ${evaluation.blockers[0]} Record participation instead, or complete with a recorded reason.`,
    );
  }

  const registration = (await db
    .prepare("SELECT program_id, student_id, guardian_person_id, status FROM program_registrations WHERE id = ?")
    .get(input.registrationId)) as
    | { program_id: string; student_id: string; guardian_person_id: string | null; status: string }
    | undefined;
  if (!registration) throw new CompletionError("Registration not found.");

  const now = Date.now();
  const { attendance, rules } = evaluation;
  // A certificate is only ever attached to a genuine completion.
  const serial = input.outcome === "completed" && rules.certificateEnabled ? certificateSerial() : null;

  await db
    .prepare(
      `INSERT INTO program_completion_records
         (id, registration_id, program_id, student_id, outcome, sessions_attended, sessions_total,
          attendance_rate, summary, certificate_serial, certificate_issued_at, issued_by_user_id,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (registration_id) DO UPDATE SET
         outcome = EXCLUDED.outcome,
         sessions_attended = EXCLUDED.sessions_attended,
         sessions_total = EXCLUDED.sessions_total,
         attendance_rate = EXCLUDED.attendance_rate,
         summary = EXCLUDED.summary,
         certificate_serial = COALESCE(program_completion_records.certificate_serial, EXCLUDED.certificate_serial),
         certificate_issued_at = COALESCE(program_completion_records.certificate_issued_at, EXCLUDED.certificate_issued_at),
         updated_at = EXCLUDED.updated_at`,
    )
    .run(
      `pcr-${randomUUID().slice(0, 12)}`,
      input.registrationId,
      registration.program_id,
      registration.student_id,
      input.outcome,
      attendance.attended,
      attendance.scheduled,
      attendance.rate,
      input.summary ?? null,
      serial,
      serial ? now : null,
      input.actor.userId ?? null,
      now,
      now,
    );

  // The seat is released on completion: the program is over, and holding it
  // would understate availability for the next term.
  await db
    .prepare(
      `UPDATE program_registrations
          SET status = 'completed', holds_seat = false, completed_at = ?,
              completion_status = ?, updated_at = ?
        WHERE id = ?`,
    )
    .run(now, input.outcome, now, input.registrationId);

  await recordAudit({
    registrationId: input.registrationId,
    studentId: registration.student_id,
    programId: registration.program_id,
    actorUserId: input.actor.userId ?? null,
    actorLabel: input.actor.label,
    action: input.overrideReason ? "completion_recorded_override" : "completion_recorded",
    previousState: registration.status,
    newState: input.outcome,
    reason: input.overrideReason ?? null,
  });

  await recordNotification({
    personId: registration.guardian_person_id,
    studentId: registration.student_id,
    programId: registration.program_id,
    registrationId: input.registrationId,
    kind: "program_completed",
    title: input.outcome === "completed" ? "Program complete" : "Program finished",
    body:
      input.outcome === "completed"
        ? "The program is complete. Your attendance summary and certificate are on your dashboard."
        : "The program has finished. Your attendance summary is on your dashboard.",
    actionLabel: "View results",
    actionHref: "/family",
  });

  return { serial };
}

/* ===================================================================== */
/* Recommendations                                                       */
/* ===================================================================== */

export interface Recommendation {
  programId: string;
  programName: string;
  /** Plain-language explanation. Never a score or a confidence value. */
  reason: string;
}

/**
 * The next program to suggest after one completes.
 *
 * Deliberately rule-based and explainable: the admin's configured
 * `recommended_next_program_id` wins, then a program whose prerequisite is the
 * one just completed, then an open program the child's grade fits. A student
 * with no available option returns null so the admin queue can surface them
 * for an interest list rather than showing the family a bad suggestion.
 */
export async function recommendNextProgram(
  completedProgramId: string,
  studentGrade: string | null,
): Promise<Recommendation | null> {
  const db = getDb();
  const { parseGrade } = await import("@/lib/enrollment-shared");
  const grade = parseGrade(studentGrade);

  const configured = (await db
    .prepare(
      `SELECT n.id, n.name FROM programs p
         JOIN programs n ON n.id = p.recommended_next_program_id
        WHERE p.id = ? AND n.is_public = true`,
    )
    .get(completedProgramId)) as { id: string; name: string } | undefined;
  if (configured) {
    return {
      programId: configured.id,
      programName: configured.name,
      reason: `Recommended next after this program.`,
    };
  }

  const followOn = (await db
    .prepare(
      `SELECT id, name, grade_min, grade_max FROM programs
        WHERE prerequisite_program_id = ? AND is_public = true AND public_status IN ('open', 'coming_soon')
        ORDER BY start_date NULLS LAST LIMIT 1`,
    )
    .get(completedProgramId)) as
    | { id: string; name: string; grade_min: number | null; grade_max: number | null }
    | undefined;
  if (followOn) {
    const fits =
      grade == null ||
      ((followOn.grade_min == null || grade >= followOn.grade_min) &&
        (followOn.grade_max == null || grade <= followOn.grade_max));
    if (fits) {
      return {
        programId: followOn.id,
        programName: followOn.name,
        reason: grade == null ? "Builds on the program just completed." : `Builds on the program just completed, and fits Grade ${grade}.`,
      };
    }
  }

  if (grade == null) return null;
  const byGrade = (await db
    .prepare(
      `SELECT id, name FROM programs
        WHERE is_public = true AND public_status = 'open' AND id <> ?
          AND (grade_min IS NULL OR grade_min <= ?)
          AND (grade_max IS NULL OR grade_max >= ?)
        ORDER BY start_date NULLS LAST LIMIT 1`,
    )
    .get(completedProgramId, grade, grade)) as { id: string; name: string } | undefined;
  if (!byGrade) return null;
  return {
    programId: byGrade.id,
    programName: byGrade.name,
    reason: `Open for registration and fits Grade ${grade}.`,
  };
}
