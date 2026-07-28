/* ============================================================
 * Delivery DAL — sessions, preparation, assignments, instructor
 * readiness, and the two attention feeds the founder runs BOW from.
 *
 * Server-only. Browser-safe types and label helpers live in
 * lib/delivery-shared.ts.
 *
 * Design note: nothing here stores a status that is already derivable.
 * Session preparation rolls up from class_session_prep, instructor
 * readiness rolls up from the requirement records themselves, and the
 * attention feeds are computed on read. That is slower than a cached
 * column and it is the right trade: a stale "ready" badge is worse than
 * no badge, because a founder acts on it.
 * ============================================================ */

import { getDb } from "@/lib/db";
import {
  PREP_CHECKLIST,
  rollUpPrepStatus,
  sortAttention,
  pipelineGroupFor,
  DEPLOYABLE_STAGES,
  CANDIDATE_STAGES,
  PREPARING_STAGES,
  type AttentionItem,
  type ClassSession,
  type InstructorAssignment,
  type InstructorReadiness,
  type InstructorRequirement,
  type PipelineGroup,
  type PrepStatus,
  type SessionPrep,
  type SessionStatus,
} from "@/lib/delivery-shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

const DAY_MS = 24 * 60 * 60 * 1000;

/* ===================================================================== */
/* Sessions                                                              */
/* ===================================================================== */

function mapSessionRow(row: any, prepStatus: PrepStatus, attendanceRecorded: boolean, reportCompleted: boolean): ClassSession {
  return {
    id: row.id,
    classId: row.class_id,
    sessionDate: Number(row.session_date),
    sessionOn: row.session_on ?? null,
    timezone: row.timezone ?? null,
    location: row.location ?? null,
    meetingLink: row.meeting_link ?? null,
    title: row.title ?? null,
    objective: row.objective ?? null,
    agenda: row.agenda ?? null,
    materials: row.materials ?? null,
    lessonId: row.lesson_id ?? null,
    status: (row.status ?? "scheduled") as SessionStatus,
    cancellationReason: row.cancellation_reason ?? null,
    prepStatus,
    attendanceRecorded,
    reportCompleted,
    createdAt: Number(row.created_at),
  };
}

/** Assigned-and-accepted instructor count per class, used for prep roll-up. */
async function acceptedInstructorCounts(classIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (classIds.length === 0) return counts;
  const rows = (await getDb()
    .prepare(
      `SELECT class_id, COUNT(*) AS n FROM class_instructors
        WHERE class_id IN (${classIds.map(() => "?").join(",")})
          AND removed_at IS NULL AND assignment_status = 'accepted'
        GROUP BY class_id`,
    )
    .all(...classIds)) as { class_id: string; n: number }[];
  for (const row of rows) counts.set(row.class_id, Number(row.n));
  return counts;
}

export async function listSessionsForClass(classId: string): Promise<ClassSession[]> {
  const db = getDb();
  const rows = (await db
    .prepare("SELECT * FROM class_sessions WHERE class_id = ? ORDER BY session_date")
    .all(classId)) as any[];
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");
  const prepRows = (await db
    .prepare(`SELECT session_id, status FROM class_session_prep WHERE session_id IN (${placeholders})`)
    .all(...ids)) as { session_id: string; status: PrepStatus }[];
  const attendance = (await db
    .prepare(`SELECT DISTINCT session_id FROM attendance_records WHERE session_id IN (${placeholders})`)
    .all(...ids)) as { session_id: string }[];
  const reports = (await db
    .prepare(`SELECT session_id, completed FROM class_session_reports WHERE session_id IN (${placeholders})`)
    .all(...ids)) as { session_id: string; completed: number }[];

  const assigned = (await acceptedInstructorCounts([classId])).get(classId) ?? 0;
  const prepBySession = new Map<string, { status: PrepStatus }[]>();
  for (const row of prepRows) {
    const list = prepBySession.get(row.session_id) ?? [];
    list.push({ status: row.status });
    prepBySession.set(row.session_id, list);
  }
  const attendanceSet = new Set(attendance.map((a) => a.session_id));
  const completedReports = new Set(reports.filter((r) => r.completed === 1).map((r) => r.session_id));

  return rows.map((row) =>
    mapSessionRow(
      row,
      rollUpPrepStatus(prepBySession.get(row.id) ?? [], assigned),
      attendanceSet.has(row.id),
      completedReports.has(row.id),
    ),
  );
}

export interface SessionDetail {
  session: ClassSession;
  className: string;
  programId: string | null;
  programName: string | null;
  curriculumTitle: string | null;
  instructors: { instructorId: string; name: string | null; role: string; status: string }[];
  preps: SessionPrep[];
  roster: { studentId: string; name: string; grade: string | null; note: string | null }[];
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  const db = getDb();
  const row = (await db.prepare("SELECT * FROM class_sessions WHERE id = ?").get(sessionId)) as any;
  if (!row) return null;
  const context = (await db
    .prepare(
      `SELECT c.title, c.program_id, p.name AS program_name, cur.title AS curriculum_title
         FROM classes c
         LEFT JOIN programs p ON p.id = c.program_id
         LEFT JOIN curricula cur ON cur.id = c.curriculum_id
        WHERE c.id = ?`,
    )
    .get(row.class_id)) as any;

  const instructors = ((await db
    .prepare(
      `SELECT ci.instructor_id, ci.role, ci.assignment_status, pe.name
         FROM class_instructors ci
         LEFT JOIN instructors i ON i.id = ci.instructor_id
         LEFT JOIN people pe ON pe.id = i.person_id
        WHERE ci.class_id = ? AND ci.removed_at IS NULL
        ORDER BY CASE ci.role WHEN 'lead' THEN 0 ELSE 1 END, pe.name`,
    )
    .all(row.class_id)) as any[]).map((r) => ({
    instructorId: r.instructor_id,
    name: r.name ?? null,
    role: r.role,
    status: r.assignment_status ?? "accepted",
  }));

  const prepRows = ((await db
    .prepare(
      `SELECT sp.*, pe.name
         FROM class_session_prep sp
         LEFT JOIN instructors i ON i.id = sp.instructor_id
         LEFT JOIN people pe ON pe.id = i.person_id
        WHERE sp.session_id = ?`,
    )
    .all(sessionId)) as any[]).map((r): SessionPrep => ({
    sessionId: r.session_id,
    instructorId: r.instructor_id,
    instructorName: r.name ?? null,
    status: r.status,
    checklist: parseChecklist(r.checklist),
    blockers: r.blockers ?? null,
    updatedAt: r.updated_at != null ? Number(r.updated_at) : null,
  }));

  const roster = ((await db
    .prepare(
      `SELECT csr.student_id, s.name, s.grade, s.emergency_notes
         FROM class_session_roster csr
         LEFT JOIN students s ON s.id = csr.student_id
        WHERE csr.session_id = ?
        ORDER BY s.name, csr.student_id`,
    )
    .all(sessionId)) as any[]).map((r) => ({
    studentId: r.student_id,
    name: r.name ?? r.student_id,
    grade: r.grade ?? null,
    note: r.emergency_notes ?? null,
  }));

  const attendance = (await db.prepare("SELECT 1 FROM attendance_records WHERE session_id = ? LIMIT 1").get(sessionId));
  const report = (await db.prepare("SELECT completed FROM class_session_reports WHERE session_id = ?").get(sessionId)) as
    | { completed: number }
    | undefined;

  const acceptedCount = instructors.filter((i) => i.status === "accepted").length;
  return {
    session: mapSessionRow(row, rollUpPrepStatus(prepRows, acceptedCount), Boolean(attendance), report?.completed === 1),
    className: context?.title ?? "Class",
    programId: context?.program_id ?? null,
    programName: context?.program_name ?? null,
    curriculumTitle: context?.curriculum_title ?? null,
    instructors,
    preps: prepRows,
  roster,
  };
}

/** Fills the stored snapshot out to the current template so the UI never renders a partial list. */
export function parseChecklist(raw: unknown): { key: string; label: string; done: boolean }[] {
  let stored: Record<string, boolean> = {};
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item.key === "string") stored[item.key] = Boolean(item.done);
        }
      } else if (parsed && typeof parsed === "object") {
        stored = parsed as Record<string, boolean>;
      }
    } catch {
      /* A malformed snapshot means "nothing confirmed", not a crash. */
    }
  }
  return PREP_CHECKLIST.map((item) => ({ key: item.key, label: item.label, done: Boolean(stored[item.key]) }));
}

/* ===================================================================== */
/* Assignments                                                           */
/* ===================================================================== */

function mapAssignmentRow(row: any): InstructorAssignment {
  return {
    id: row.id,
    classId: row.class_id,
    className: row.class_title ?? "Class",
    programId: row.program_id ?? null,
    programName: row.program_name ?? null,
    instructorId: row.instructor_id,
    instructorName: row.instructor_name ?? null,
    role: row.role,
    status: row.assignment_status ?? "accepted",
    expectedCommitment: row.expected_commitment ?? null,
    startDate: row.start_date ?? null,
    proposedAt: row.proposed_at != null ? Number(row.proposed_at) : null,
    respondedAt: row.responded_at != null ? Number(row.responded_at) : null,
    responseNote: row.response_note ?? null,
  };
}

const ASSIGNMENT_SELECT = `
  SELECT ci.*, c.title AS class_title, c.program_id, p.name AS program_name, pe.name AS instructor_name
    FROM class_instructors ci
    JOIN classes c ON c.id = ci.class_id
    LEFT JOIN programs p ON p.id = c.program_id
    LEFT JOIN instructors i ON i.id = ci.instructor_id
    LEFT JOIN people pe ON pe.id = i.person_id
`;

export async function listAssignmentsForInstructor(instructorId: string): Promise<InstructorAssignment[]> {
  const rows = (await getDb()
    .prepare(`${ASSIGNMENT_SELECT} WHERE ci.instructor_id = ? AND ci.removed_at IS NULL ORDER BY ci.added_at DESC`)
    .all(instructorId)) as any[];
  return rows.map(mapAssignmentRow);
}

export async function listAssignmentsForClass(classId: string): Promise<InstructorAssignment[]> {
  const rows = (await getDb()
    .prepare(
      `${ASSIGNMENT_SELECT} WHERE ci.class_id = ? AND ci.removed_at IS NULL
        ORDER BY CASE ci.role WHEN 'lead' THEN 0 ELSE 1 END, ci.added_at`,
    )
    .all(classId)) as any[];
  return rows.map(mapAssignmentRow);
}

/**
 * Authoritative membership check for delivery surfaces. An instructor may
 * only touch a class they have an *accepted*, un-removed assignment on —
 * a proposal they have not answered grants nothing.
 */
export async function isAcceptedClassMember(classId: string, instructorId: string): Promise<boolean> {
  const row = (await getDb()
    .prepare(
      `SELECT 1 FROM class_instructors
        WHERE class_id = ? AND instructor_id = ? AND removed_at IS NULL AND assignment_status = 'accepted' LIMIT 1`,
    )
    .get(classId, instructorId));
  return Boolean(row);
}

/**
 * Sessions the instructor would be double-booked against if they took on
 * `classId`. Overlap is evaluated on the scheduled instant, so a session in
 * another timezone still collides correctly.
 */
export async function findScheduleConflicts(
  instructorId: string,
  classId: string,
): Promise<{ sessionId: string; className: string; sessionDate: number }[]> {
  const db = getDb();
  const candidate = (await db
    .prepare("SELECT session_date FROM class_sessions WHERE class_id = ? AND status = 'scheduled'")
    .all(classId)) as { session_date: number }[];
  if (candidate.length === 0) return [];
  const existing = (await db
    .prepare(
      `SELECT s.id, s.session_date, c.title
         FROM class_sessions s
         JOIN classes c ON c.id = s.class_id
         JOIN class_instructors ci ON ci.class_id = s.class_id
        WHERE ci.instructor_id = ? AND ci.removed_at IS NULL AND ci.assignment_status = 'accepted'
          AND s.class_id <> ? AND s.status = 'scheduled'`,
    )
    .all(instructorId, classId)) as { id: string; session_date: number; title: string }[];

  // Two hours is BOW's practical session envelope; anything starting inside
  // that window of an existing session is a real conflict, not a near-miss.
  const WINDOW = 2 * 60 * 60 * 1000;
  const conflicts: { sessionId: string; className: string; sessionDate: number }[] = [];
  for (const row of existing) {
    if (candidate.some((c) => Math.abs(Number(c.session_date) - Number(row.session_date)) < WINDOW)) {
      conflicts.push({ sessionId: row.id, className: row.title, sessionDate: Number(row.session_date) });
    }
  }
  return conflicts;
}

/** Accepted assignments an instructor currently carries, for workload checks. */
export async function instructorWorkload(instructorId: string): Promise<number> {
  const row = (await getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM class_instructors ci
         JOIN classes c ON c.id = ci.class_id
        WHERE ci.instructor_id = ? AND ci.removed_at IS NULL AND ci.assignment_status = 'accepted'
          AND c.status IN ('planning', 'staffing', 'ready_to_launch', 'active')`,
    )
    .get(instructorId)) as { n: number } | undefined;
  return Number(row?.n ?? 0);
}

/* ===================================================================== */
/* Instructor readiness                                                  */
/* ===================================================================== */

/**
 * The requirements BOW actually enforces before someone teaches. Each one
 * maps to a record that exists in the database — nothing here is aspirational,
 * because a checklist item nobody can satisfy is just a permanent blocker.
 */
export async function getInstructorReadiness(instructorId: string): Promise<InstructorReadiness | null> {
  const db = getDb();
  const row = (await db
    .prepare(
      `SELECT i.*, pe.name, pe.email, pe.phone
         FROM instructors i LEFT JOIN people pe ON pe.id = i.person_id
        WHERE i.id = ?`,
    )
    .get(instructorId)) as any;
  if (!row) return null;

  const availability = (await db
    .prepare("SELECT COUNT(*) AS n FROM instructor_availability WHERE instructor_id = ?")
    .get(instructorId)) as { n: number };
  const onboardingModules = (await db
    .prepare("SELECT id FROM training_modules WHERE category = 'onboarding'")
    .all()) as { id: string }[];
  const completions = (await db
    .prepare("SELECT module_id FROM training_module_completions WHERE instructor_id = ?")
    .all(instructorId)) as { module_id: string }[];
  const completedIds = new Set(completions.map((c) => c.module_id));
  const outstandingModules = onboardingModules.filter((m) => !completedIds.has(m.id));

  const requirements: InstructorRequirement[] = [
    {
      key: "profile",
      label: "Profile complete",
      done: Boolean(String(row.name ?? "").trim() && String(row.email ?? "").trim()),
      detail: "Name and a reachable email so a program lead can contact you.",
      href: "/app/settings",
    },
    {
      key: "decision",
      label: "Accepted by BOW",
      done: row.founder_decision === "accept" || DEPLOYABLE_STAGES.has(row.stage) || PREPARING_STAGES.has(row.stage),
      detail: "A founder has reviewed your application and accepted you.",
      href: null,
    },
    {
      key: "availability",
      label: "Availability submitted",
      done: Number(availability?.n ?? 0) > 0,
      detail: "At least one weekly window, so you are only matched to classes you can actually teach.",
      href: "/app/teach#availability",
    },
    {
      key: "onboarding",
      label: "Onboarding complete",
      done: outstandingModules.length === 0 && onboardingModules.length > 0
        ? true
        : row.onboarding_status === "complete",
      detail: outstandingModules.length > 0
        ? `${outstandingModules.length} onboarding step${outstandingModules.length === 1 ? "" : "s"} left.`
        : "Every onboarding step is done.",
      href: "/app/teach#onboarding",
    },
    {
      key: "training",
      label: "Training complete",
      done: row.training_status === "complete" || row.training_status === "on_track",
      detail: "Required training modules and sessions are current.",
      href: "/app/teach#training",
    },
    {
      key: "clearance",
      label: "Cleared to teach",
      done: row.eligibility_status === "eligible",
      detail: "Final founder readiness check. Unlocks class assignments.",
      href: null,
    },
  ];

  const outstanding = requirements.filter((r) => !r.done);
  return {
    ready: outstanding.length === 0,
    requirements,
    outstanding,
    nextRequirement: outstanding[0] ?? null,
  };
}

/* ===================================================================== */
/* Instructor: what do I do next?                                        */
/* ===================================================================== */

export interface InstructorNextAction {
  title: string;
  detail: string;
  href: string;
  actionLabel: string;
  tone: "blocker" | "warning" | "info" | "calm";
}

export interface InstructorHomeData {
  primaryAction: InstructorNextAction | null;
  readiness: InstructorReadiness | null;
  pendingAssignments: InstructorAssignment[];
  acceptedAssignments: InstructorAssignment[];
  nextSession: (ClassSession & { className: string; programName: string | null; myPrep: PrepStatus }) | null;
  upcomingSessions: (ClassSession & { className: string })[];
  followUps: (ClassSession & { className: string; reason: "attendance" | "report" })[];
}

/**
 * Resolves the instructor's home in priority order. The ordering is the
 * product decision: obligations that block BOW (an unanswered assignment,
 * a missing session report) outrank anything the instructor might want to
 * do, and readiness outranks both because an unready instructor should not
 * be preparing to teach at all.
 */
export async function getInstructorHome(instructorId: string, now = Date.now()): Promise<InstructorHomeData> {
  const db = getDb();
  const readiness = await getInstructorReadiness(instructorId);
  const assignments = await listAssignmentsForInstructor(instructorId);
  const pendingAssignments = assignments.filter((a) => a.status === "proposed");
  const acceptedAssignments = assignments.filter((a) => a.status === "accepted");

  const classIds = acceptedAssignments.map((a) => a.classId);
  const classNameById = new Map(acceptedAssignments.map((a) => [a.classId, a.className]));
  const programNameById = new Map(acceptedAssignments.map((a) => [a.classId, a.programName]));

  let sessions: ClassSession[] = [];
  const myPrepBySession = new Map<string, PrepStatus>();
  if (classIds.length > 0) {
    const placeholders = classIds.map(() => "?").join(",");
    const rows = (await db
      .prepare(
        `SELECT * FROM class_sessions WHERE class_id IN (${placeholders}) AND status <> 'cancelled' ORDER BY session_date`,
      )
      .all(...classIds)) as any[];
    const sessionIds = rows.map((r) => r.id);
    if (sessionIds.length > 0) {
      const sPlaceholders = sessionIds.map(() => "?").join(",");
      const prepRows = (await db
        .prepare(
          `SELECT session_id, status FROM class_session_prep WHERE instructor_id = ? AND session_id IN (${sPlaceholders})`,
        )
        .all(instructorId, ...sessionIds)) as { session_id: string; status: PrepStatus }[];
      for (const p of prepRows) myPrepBySession.set(p.session_id, p.status);
      const attendance = new Set(
        ((await db
          .prepare(`SELECT DISTINCT session_id FROM attendance_records WHERE session_id IN (${sPlaceholders})`)
          .all(...sessionIds)) as { session_id: string }[]).map((a) => a.session_id),
      );
      const reports = new Set(
        ((await db
          .prepare(`SELECT session_id FROM class_session_reports WHERE completed = 1 AND session_id IN (${sPlaceholders})`)
          .all(...sessionIds)) as { session_id: string }[]).map((r) => r.session_id),
      );
      const counts = await acceptedInstructorCounts(classIds);
      sessions = rows.map((row) =>
        mapSessionRow(
          row,
          rollUpPrepStatus(
            myPrepBySession.has(row.id) ? [{ status: myPrepBySession.get(row.id)! }] : [],
            counts.get(row.class_id) ?? 1,
          ),
          attendance.has(row.id),
          reports.has(row.id),
        ),
      );
    }
  }

  const upcoming = sessions.filter((s) => s.sessionDate >= now - 12 * 60 * 60 * 1000 && s.status === "scheduled");
  const nextRaw = upcoming[0] ?? null;
  const nextSession = nextRaw
    ? {
        ...nextRaw,
        className: classNameById.get(nextRaw.classId) ?? "Class",
        programName: programNameById.get(nextRaw.classId) ?? null,
        myPrep: myPrepBySession.get(nextRaw.id) ?? ("not_started" as PrepStatus),
      }
    : null;

  const followUps = sessions
    .filter((s) => s.sessionDate < now - 12 * 60 * 60 * 1000 && s.status === "scheduled")
    .filter((s) => !s.reportCompleted || !s.attendanceRecorded)
    .map((s) => ({
      ...s,
      className: classNameById.get(s.classId) ?? "Class",
      reason: (!s.attendanceRecorded ? "attendance" : "report") as "attendance" | "report",
    }));

  return {
    primaryAction: resolvePrimaryAction({ readiness, pendingAssignments, followUps, nextSession, now }),
    readiness,
    pendingAssignments,
    acceptedAssignments,
    nextSession,
    upcomingSessions: upcoming.slice(0, 6).map((s) => ({ ...s, className: classNameById.get(s.classId) ?? "Class" })),
    followUps,
  };
}

function resolvePrimaryAction(input: {
  readiness: InstructorReadiness | null;
  pendingAssignments: InstructorAssignment[];
  followUps: { id: string; classId: string; className: string; reason: string }[];
  nextSession: (ClassSession & { className: string; myPrep: PrepStatus }) | null;
  now: number;
}): InstructorNextAction | null {
  const { readiness, pendingAssignments, followUps, nextSession, now } = input;

  // An overdue closeout is BOW's data, not the instructor's convenience —
  // it outranks everything else they could be doing.
  if (followUps.length > 0) {
    const first = followUps[0];
    return {
      title: first.reason === "attendance" ? "Submit attendance" : "Complete your session report",
      detail: `${first.className} — the last session is still open. Close it out so the program record is accurate.`,
      href: `/app/teach/classes/${first.classId}/sessions/${first.id}`,
      actionLabel: "Close out session",
      tone: "blocker",
    };
  }

  if (readiness && !readiness.ready && readiness.nextRequirement) {
    const requirement = readiness.nextRequirement;
    return {
      title: "Finish onboarding",
      detail: `${requirement.label} — ${requirement.detail}`,
      href: requirement.href ?? "/app/teach",
      actionLabel: requirement.href ? "Continue" : "Waiting on BOW",
      tone: requirement.href ? "warning" : "info",
    };
  }

  if (pendingAssignments.length > 0) {
    const first = pendingAssignments[0];
    return {
      title: "Respond to your assignment",
      detail: `${first.programName ? `${first.programName} — ` : ""}${first.className}. BOW is holding this class for you.`,
      href: `/app/teach/assignments`,
      actionLabel: "Accept or decline",
      tone: "warning",
    };
  }

  if (nextSession) {
    const soon = nextSession.sessionDate - now < 3 * DAY_MS;
    if (nextSession.myPrep !== "ready") {
      return {
        title: "Prepare your next session",
        detail: `${nextSession.className}. Review the objective, lesson, and roster before you teach.`,
        href: `/app/teach/classes/${nextSession.classId}/sessions/${nextSession.id}`,
        actionLabel: "Open preparation",
        tone: soon ? "warning" : "info",
      };
    }
    return {
      title: "You're ready for your next session",
      detail: `${nextSession.className}. Nothing outstanding — review the plan any time before class.`,
      href: `/app/teach/classes/${nextSession.classId}/sessions/${nextSession.id}`,
      actionLabel: "Review session",
      tone: "calm",
    };
  }

  return null;
}

/* ===================================================================== */
/* Founder: program attention feed                                       */
/* ===================================================================== */

export interface FounderProgramsData {
  attention: AttentionItem[];
  upcomingSessions: {
    sessionId: string;
    classId: string;
    className: string;
    programName: string | null;
    sessionDate: number;
    timezone: string | null;
    prepStatus: PrepStatus;
    instructorNames: string[];
  }[];
  pipeline: Record<PipelineGroup, { id: string; name: string; stage: string; detail: string; nextAction: string | null }[]>;
}

interface ProgramAttentionRow {
  id: string;
  name: string;
  stage: string;
  is_public: boolean;
  public_status: string | null;
  start_date: string | null;
  launch_date: string | null;
  capacity: number | null;
  updated_at: number;
  class_count: number;
  lead_count: number;
  pending_assignment_count: number;
  session_count: number;
  enrollment_count: number;
  curriculum_id: string | null;
}

/**
 * The founder's programs home. Everything on it is a question someone has
 * to answer — no counts for their own sake.
 */
export async function getFounderProgramsData(now = Date.now()): Promise<FounderProgramsData> {
  const db = getDb();

  const programs = (await db
    .prepare(
      `SELECT p.id, p.name, p.stage, p.is_public, p.public_status, p.start_date, p.launch_date,
              p.capacity, p.updated_at, p.curriculum_id,
              (SELECT COUNT(*) FROM classes c WHERE c.program_id = p.id) AS class_count,
              (SELECT COUNT(*) FROM classes c JOIN class_instructors ci ON ci.class_id = c.id
                 WHERE c.program_id = p.id AND ci.role = 'lead' AND ci.removed_at IS NULL
                   AND ci.assignment_status = 'accepted') AS lead_count,
              (SELECT COUNT(*) FROM classes c JOIN class_instructors ci ON ci.class_id = c.id
                 WHERE c.program_id = p.id AND ci.removed_at IS NULL
                   AND ci.assignment_status = 'proposed') AS pending_assignment_count,
              (SELECT COUNT(*) FROM classes c JOIN class_sessions s ON s.class_id = c.id
                 WHERE c.program_id = p.id AND s.status = 'scheduled' AND s.session_date >= ?) AS session_count,
              (SELECT COUNT(*) FROM classes c JOIN class_enrollments e ON e.class_id = c.id
                 WHERE c.program_id = p.id AND e.status = 'enrolled') AS enrollment_count
         FROM programs p
        WHERE p.stage NOT IN ('closed')
        ORDER BY p.updated_at DESC`,
    )
    .all(now)) as unknown as ProgramAttentionRow[];

  const attention: AttentionItem[] = [];
  const pipeline = emptyPipeline();

  for (const program of programs) {
    const href = `/app/programs/${program.id}`;
    const startsSoon = Boolean(
      program.launch_date && Date.parse(`${program.launch_date}T00:00:00Z`) - now < 21 * DAY_MS && Date.parse(`${program.launch_date}T00:00:00Z`) >= now,
    );
    const preLaunch = !["active", "completed", "paused", "closed"].includes(program.stage);

    if (preLaunch && Number(program.class_count) > 0 && Number(program.lead_count) === 0) {
      attention.push({
        key: `no-lead-${program.id}`,
        severity: "blocker",
        title: "No lead instructor",
        detail: `${program.name} has classes but nobody has accepted the lead role.`,
        href: `${href}#staffing`,
        actionLabel: "Staff this program",
        rank: startsSoon ? 0 : 10,
        subjectId: program.id,
        subjectName: program.name,
      });
    }

    if (Number(program.pending_assignment_count) > 0) {
      attention.push({
        key: `pending-assignment-${program.id}`,
        severity: "warning",
        title: "Assignment awaiting response",
        detail: `${program.pending_assignment_count} instructor${Number(program.pending_assignment_count) === 1 ? "" : "s"} on ${program.name} ${Number(program.pending_assignment_count) === 1 ? "has" : "have"} not responded yet.`,
        href: `${href}#staffing`,
        actionLabel: "Review staffing",
        rank: 20,
        subjectId: program.id,
        subjectName: program.name,
      });
    }

    if (startsSoon && Number(program.session_count) === 0) {
      attention.push({
        key: `no-sessions-${program.id}`,
        severity: "blocker",
        title: "Starts soon, no sessions scheduled",
        detail: `${program.name} launches ${program.launch_date} with no scheduled sessions.`,
        href: `${href}#classes`,
        actionLabel: "Schedule sessions",
        rank: 1,
        subjectId: program.id,
        subjectName: program.name,
      });
    }

    if (program.is_public && program.public_status === "open" && Number(program.enrollment_count) === 0) {
      attention.push({
        key: `no-enrollment-${program.id}`,
        severity: "warning",
        title: "Registration open, nobody enrolled",
        detail: `${program.name} is taking registrations but has no students yet.`,
        href: `${href}#students`,
        actionLabel: "Open program",
        rank: 30,
        subjectId: program.id,
        subjectName: program.name,
      });
    }

    if (preLaunch && !program.curriculum_id) {
      attention.push({
        key: `no-curriculum-${program.id}`,
        severity: "warning",
        title: "No curriculum selected",
        detail: `${program.name} has no curriculum, so instructors have nothing to prepare from.`,
        href: `${href}/edit`,
        actionLabel: "Select curriculum",
        rank: 25,
        subjectId: program.id,
        subjectName: program.name,
      });
    }

    if (startsSoon && preLaunch && ["opportunity", "planning"].includes(program.stage)) {
      attention.push({
        key: `stage-lag-${program.id}`,
        severity: "warning",
        title: "Scheduled but still in planning",
        detail: `${program.name} launches ${program.launch_date} but is still marked ${program.stage.replace(/_/g, " ")}.`,
        href: `${href}#actions`,
        actionLabel: "Advance stage",
        rank: 15,
        subjectId: program.id,
        subjectName: program.name,
      });
    }

    const group = pipelineGroupFor({
      stage: program.stage,
      isPublic: Boolean(program.is_public),
      publicStatus: program.public_status,
      hasConfirmedLead: Number(program.lead_count) > 0,
      canLaunch: program.stage === "ready_to_launch",
      completedAt: program.stage === "completed" ? Number(program.updated_at) : null,
      now,
    });
    if (group) {
      pipeline[group].push({
        id: program.id,
        name: program.name,
        stage: program.stage,
        detail: `${program.class_count} class${Number(program.class_count) === 1 ? "" : "es"} · ${program.enrollment_count} enrolled · ${program.session_count} upcoming session${Number(program.session_count) === 1 ? "" : "s"}`,
        nextAction:
          Number(program.lead_count) === 0 && Number(program.class_count) > 0
            ? "Assign a lead instructor"
            : Number(program.session_count) === 0 && preLaunch
              ? "Schedule the first sessions"
              : null,
      });
    }
  }

  /* --- session-level attention: unprepared, unreported, uncovered --- */

  const upcomingRows = (await db
    .prepare(
      `SELECT s.id, s.class_id, s.session_date, s.timezone, c.title AS class_title, p.name AS program_name, p.id AS program_id
         FROM class_sessions s
         JOIN classes c ON c.id = s.class_id
         LEFT JOIN programs p ON p.id = c.program_id
        WHERE s.status = 'scheduled' AND s.session_date >= ? AND s.session_date <= ?
        ORDER BY s.session_date
        LIMIT 40`,
    )
    .all(now, now + 21 * DAY_MS)) as any[];

  const upcomingSessions: FounderProgramsData["upcomingSessions"] = [];
  for (const row of upcomingRows) {
    const staff = (await db
      .prepare(
        `SELECT ci.instructor_id, pe.name
           FROM class_instructors ci
           LEFT JOIN instructors i ON i.id = ci.instructor_id
           LEFT JOIN people pe ON pe.id = i.person_id
          WHERE ci.class_id = ? AND ci.removed_at IS NULL AND ci.assignment_status = 'accepted'`,
      )
      .all(row.class_id)) as { instructor_id: string; name: string | null }[];
    const preps = (await db
      .prepare("SELECT status FROM class_session_prep WHERE session_id = ?")
      .all(row.id)) as { status: PrepStatus }[];
    const prepStatus = rollUpPrepStatus(preps, staff.length);

    upcomingSessions.push({
      sessionId: row.id,
      classId: row.class_id,
      className: row.class_title,
      programName: row.program_name ?? null,
      sessionDate: Number(row.session_date),
      timezone: row.timezone ?? null,
      prepStatus,
      instructorNames: staff.map((s) => s.name ?? "Unnamed"),
    });

    const daysOut = (Number(row.session_date) - now) / DAY_MS;
    if (staff.length === 0) {
      attention.push({
        key: `session-uncovered-${row.id}`,
        severity: "blocker",
        title: "Upcoming session has no instructor",
        detail: `${row.class_title} on ${new Date(Number(row.session_date)).toDateString()} has no confirmed coverage.`,
        href: `/app/classes/${row.class_id}/sessions/${row.id}`,
        actionLabel: "Assign coverage",
        rank: 2,
        subjectId: row.program_id ?? row.class_id,
        subjectName: row.program_name ?? row.class_title,
      });
    } else if (daysOut <= 3 && prepStatus !== "ready") {
      attention.push({
        key: `session-unprepared-${row.id}`,
        severity: "warning",
        title: "Session not prepared",
        detail: `${row.class_title} runs in under 3 days and preparation is ${prepStatus.replace(/_/g, " ")}.`,
        href: `/app/classes/${row.class_id}/sessions/${row.id}`,
        actionLabel: "Check preparation",
        rank: 12,
        subjectId: row.program_id ?? row.class_id,
        subjectName: row.program_name ?? row.class_title,
      });
    }
  }

  const overdueRows = (await db
    .prepare(
      `SELECT s.id, s.class_id, s.session_date, c.title AS class_title, p.name AS program_name, p.id AS program_id,
              (SELECT COUNT(*) FROM attendance_records a WHERE a.session_id = s.id) AS attendance_count,
              (SELECT COUNT(*) FROM class_session_reports r WHERE r.session_id = s.id AND r.completed = 1) AS report_count
         FROM class_sessions s
         JOIN classes c ON c.id = s.class_id
         LEFT JOIN programs p ON p.id = c.program_id
        WHERE s.status = 'scheduled' AND s.session_date < ? AND s.session_date >= ?
        ORDER BY s.session_date DESC
        LIMIT 40`,
    )
    .all(now - 12 * 60 * 60 * 1000, now - 60 * DAY_MS)) as any[];

  for (const row of overdueRows) {
    const missingAttendance = Number(row.attendance_count) === 0;
    attention.push({
      key: `session-closeout-${row.id}`,
      severity: "warning",
      title: missingAttendance ? "Attendance not submitted" : "Session report missing",
      detail: `${row.class_title} on ${new Date(Number(row.session_date)).toDateString()} has not been closed out.`,
      href: `/app/classes/${row.class_id}/sessions/${row.id}`,
      actionLabel: "Chase closeout",
      rank: missingAttendance ? 18 : 22,
      subjectId: row.program_id ?? row.class_id,
      subjectName: row.program_name ?? row.class_title,
    });
  }

  return { attention: sortAttention(attention), upcomingSessions, pipeline };
}

function emptyPipeline(): FounderProgramsData["pipeline"] {
  return {
    planning: [],
    needs_staffing: [],
    ready_to_launch: [],
    registration_open: [],
    running: [],
    recently_completed: [],
  };
}

/* ===================================================================== */
/* Founder: instructor operations                                        */
/* ===================================================================== */

export interface FounderInstructorsData {
  /** The instant every age/wait figure below was measured against. */
  generatedAt: number;
  attention: AttentionItem[];
  pipeline: { stage: string; label: string; count: number; instructors: { id: string; name: string; detail: string }[] }[];
  staffing: {
    unstaffedClasses: { classId: string; className: string; programName: string | null; programId: string | null }[];
    pendingAssignments: InstructorAssignment[];
    readyWithoutWork: { id: string; name: string; workload: number }[];
    overloaded: { id: string; name: string; workload: number; max: number }[];
  };
  delivery: {
    instructorId: string;
    name: string;
    assignedClasses: number;
    sessionsDelivered: number;
    reportsMissing: number;
    attendanceMissing: number;
  }[];
}

export async function getFounderInstructorsData(now = Date.now()): Promise<FounderInstructorsData> {
  const db = getDb();

  const instructors = (await db
    .prepare(
      `SELECT i.id, i.stage, i.eligibility_status, i.onboarding_status, i.training_status,
              i.max_weekly_classes, i.updated_at, i.created_at, pe.name
         FROM instructors i LEFT JOIN people pe ON pe.id = i.person_id
        ORDER BY i.updated_at DESC`,
    )
    .all()) as any[];

  const attention: AttentionItem[] = [];
  const byStage = new Map<string, { id: string; name: string; detail: string }[]>();

  for (const row of instructors) {
    const name = row.name ?? "Unnamed instructor";
    const href = `/app/people?type=instructor`;
    const list = byStage.get(row.stage) ?? [];
    list.push({ id: row.id, name, detail: `${String(row.onboarding_status).replace(/_/g, " ")} onboarding` });
    byStage.set(row.stage, list);

    if (row.stage === "applied") {
      const waitingDays = Math.floor((now - Number(row.created_at)) / DAY_MS);
      attention.push({
        key: `applicant-${row.id}`,
        severity: waitingDays > 7 ? "blocker" : "warning",
        title: waitingDays > 7 ? "Applicant waiting over a week" : "New applicant to review",
        detail: `${name} applied ${waitingDays} day${waitingDays === 1 ? "" : "s"} ago and has had no decision.`,
        href: `/app/hiring`,
        actionLabel: "Review applicant",
        rank: waitingDays > 7 ? 3 : 21,
        subjectId: row.id,
        subjectName: name,
      });
    }

    if (row.stage === "accepted" && row.onboarding_status === "not_started") {
      attention.push({
        key: `not-onboarded-${row.id}`,
        severity: "warning",
        title: "Accepted but not onboarding",
        detail: `${name} was accepted and has not started onboarding.`,
        href,
        actionLabel: "Nudge instructor",
        rank: 24,
        subjectId: row.id,
        subjectName: name,
      });
    }

    if (row.stage === "onboarding" && now - Number(row.updated_at) > 14 * DAY_MS) {
      attention.push({
        key: `stalled-${row.id}`,
        severity: "warning",
        title: "Onboarding stalled",
        detail: `${name} has not made onboarding progress in over two weeks.`,
        href,
        actionLabel: "Follow up",
        rank: 26,
        subjectId: row.id,
        subjectName: name,
      });
    }
  }

  /* Ready instructors with nothing to do, and overloaded ones. */
  const workloads = (await db
    .prepare(
      `SELECT i.id, pe.name, i.max_weekly_classes,
              (SELECT COUNT(*) FROM class_instructors ci JOIN classes c ON c.id = ci.class_id
                WHERE ci.instructor_id = i.id AND ci.removed_at IS NULL AND ci.assignment_status = 'accepted'
                  AND c.status IN ('planning','staffing','ready_to_launch','active')) AS workload
         FROM instructors i LEFT JOIN people pe ON pe.id = i.person_id
        WHERE i.stage IN ('eligible','active') AND i.eligibility_status = 'eligible'`,
    )
    .all()) as any[];

  const readyWithoutWork = workloads
    .filter((r) => Number(r.workload) === 0)
    .map((r) => ({ id: r.id, name: r.name ?? "Unnamed", workload: 0 }));
  const overloaded = workloads
    .filter((r) => Number(r.workload) > Number(r.max_weekly_classes ?? 3))
    .map((r) => ({ id: r.id, name: r.name ?? "Unnamed", workload: Number(r.workload), max: Number(r.max_weekly_classes ?? 3) }));

  for (const person of readyWithoutWork) {
    attention.push({
      key: `idle-${person.id}`,
      severity: "info",
      title: "Ready instructor with no assignment",
      detail: `${person.name} is cleared to teach and is not assigned to anything.`,
      href: `/app/instructor-ops#staffing`,
      actionLabel: "Assign work",
      rank: 40,
      subjectId: person.id,
      subjectName: person.name,
    });
  }
  for (const person of overloaded) {
    attention.push({
      key: `overloaded-${person.id}`,
      severity: "warning",
      title: "Instructor over their limit",
      detail: `${person.name} is on ${person.workload} classes with a stated limit of ${person.max}.`,
      href: `/app/instructor-ops#staffing`,
      actionLabel: "Rebalance",
      rank: 28,
      subjectId: person.id,
      subjectName: person.name,
    });
  }

  const unstaffedClasses = ((await db
    .prepare(
      `SELECT c.id, c.title, c.program_id, p.name AS program_name
         FROM classes c
         LEFT JOIN programs p ON p.id = c.program_id
        WHERE c.status IN ('planning','staffing','ready_to_launch','active')
          AND NOT EXISTS (
            SELECT 1 FROM class_instructors ci
             WHERE ci.class_id = c.id AND ci.removed_at IS NULL
               AND ci.assignment_status = 'accepted' AND ci.role = 'lead')
        ORDER BY c.start_date NULLS LAST
        LIMIT 50`,
    )
    .all()) as any[]).map((r) => ({
    classId: r.id,
    className: r.title,
    programName: r.program_name ?? null,
    programId: r.program_id ?? null,
  }));

  const pendingAssignments = ((await db
    .prepare(`${ASSIGNMENT_SELECT} WHERE ci.assignment_status = 'proposed' AND ci.removed_at IS NULL ORDER BY ci.proposed_at`)
    .all()) as any[]).map(mapAssignmentRow);

  for (const assignment of pendingAssignments) {
    const waiting = assignment.proposedAt ? Math.floor((now - assignment.proposedAt) / DAY_MS) : 0;
    if (waiting >= 3) {
      attention.push({
        key: `assignment-stale-${assignment.id}`,
        severity: "warning",
        title: "Assignment unanswered",
        detail: `${assignment.instructorName ?? "An instructor"} has not responded to ${assignment.className} for ${waiting} days.`,
        href: `/app/instructor-ops#staffing`,
        actionLabel: "Find coverage",
        rank: 16,
        subjectId: assignment.instructorId,
        subjectName: assignment.instructorName ?? assignment.className,
      });
    }
  }

  const delivery = ((await db
    .prepare(
      `SELECT i.id, pe.name,
              (SELECT COUNT(DISTINCT ci.class_id) FROM class_instructors ci
                WHERE ci.instructor_id = i.id AND ci.removed_at IS NULL AND ci.assignment_status = 'accepted') AS assigned_classes,
              (SELECT COUNT(*) FROM class_sessions s
                 JOIN class_instructors ci ON ci.class_id = s.class_id
                WHERE ci.instructor_id = i.id AND ci.removed_at IS NULL AND ci.assignment_status = 'accepted'
                  AND s.status = 'completed') AS sessions_delivered,
              (SELECT COUNT(*) FROM class_sessions s
                 JOIN class_instructors ci ON ci.class_id = s.class_id
                WHERE ci.instructor_id = i.id AND ci.removed_at IS NULL AND ci.assignment_status = 'accepted'
                  AND s.status = 'scheduled' AND s.session_date < ?
                  AND NOT EXISTS (SELECT 1 FROM class_session_reports r WHERE r.session_id = s.id AND r.completed = 1)) AS reports_missing,
              (SELECT COUNT(*) FROM class_sessions s
                 JOIN class_instructors ci ON ci.class_id = s.class_id
                WHERE ci.instructor_id = i.id AND ci.removed_at IS NULL AND ci.assignment_status = 'accepted'
                  AND s.status = 'scheduled' AND s.session_date < ?
                  AND NOT EXISTS (SELECT 1 FROM attendance_records a WHERE a.session_id = s.id)) AS attendance_missing
         FROM instructors i LEFT JOIN people pe ON pe.id = i.person_id
        WHERE i.stage IN ('eligible','active')`,
    )
    .all(now - 12 * 60 * 60 * 1000, now - 12 * 60 * 60 * 1000)) as any[]).map((r) => ({
    instructorId: r.id,
    name: r.name ?? "Unnamed",
    assignedClasses: Number(r.assigned_classes),
    sessionsDelivered: Number(r.sessions_delivered),
    reportsMissing: Number(r.reports_missing),
    attendanceMissing: Number(r.attendance_missing),
  }));

  for (const row of delivery) {
    if (row.reportsMissing >= 2 || row.attendanceMissing >= 2) {
      attention.push({
        key: `delivery-risk-${row.instructorId}`,
        severity: "warning",
        title: "Instructor needs support",
        detail: `${row.name} has ${row.reportsMissing} missing report${row.reportsMissing === 1 ? "" : "s"} and ${row.attendanceMissing} missing attendance submission${row.attendanceMissing === 1 ? "" : "s"}.`,
        href: `/app/instructor-ops#delivery`,
        actionLabel: "Check in",
        rank: 19,
        subjectId: row.instructorId,
        subjectName: row.name,
      });
    }
  }

  const stageOrder = [
    ["applied", "Applicants"],
    ["reviewing", "In review"],
    ["interview_scheduled", "Interview scheduled"],
    ["interviewed", "Interviewed"],
    ["founder_review", "Founder review"],
    ["accepted", "Accepted"],
    ["onboarding", "Onboarding"],
    ["eligible", "Ready"],
    ["active", "Active"],
    ["paused", "Paused"],
    ["inactive", "Inactive"],
  ] as const;

  return {
    generatedAt: now,
    attention: sortAttention(attention),
    pipeline: stageOrder.map(([stage, label]) => ({
      stage,
      label,
      count: byStage.get(stage)?.length ?? 0,
      instructors: byStage.get(stage) ?? [],
    })),
    staffing: { unstaffedClasses, pendingAssignments, readyWithoutWork, overloaded },
    delivery,
  };
}

export { CANDIDATE_STAGES, DEPLOYABLE_STAGES, PREPARING_STAGES };
