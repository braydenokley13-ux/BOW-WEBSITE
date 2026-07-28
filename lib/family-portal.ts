/* ============================================================
 * Parent-facing read model.
 *
 * Every function here takes a resolved `personId` (never a raw session or a
 * URL param) and returns only rows that guardian may see. Scope is enforced
 * by joining through `student_guardians` / `studentIdsForGuardian` — never by
 * trusting an id the caller passed in. This is what keeps changing an id in
 * a `/family/...` URL from ever reaching another family.
 *
 * Server-only, read-only. Writes live in app/actions/family-portal.ts and
 * call back into lib/enrollment.ts for anything that touches a seat.
 * ============================================================ */

import "server-only";

// Timestamp columns are bigint, which the Postgres driver returns as a
// string. Every one is coerced with Number() where it is read: a string
// reaching new Date() produces an Invalid Date, which formats as garbage
// on the dashboard and throws outright from toISOString().

import { getDb } from "@/lib/db";
import { registrationLabel, type RegistrationStatus } from "@/lib/enrollment-shared";
import { guardianCanAccessStudent, studentIdsForGuardian } from "@/lib/parent-activation";

/* ===================================================================== */
/* Shared row shapes                                                    */
/* ===================================================================== */

export interface ChildRegistration {
  registrationId: string;
  studentId: string;
  studentName: string;
  programId: string;
  programName: string;
  shortDescription: string | null;
  status: RegistrationStatus;
  statusLabel: string;
  holdsSeat: boolean;
  reservationExpiresAt: number | null;
  classId: string | null;
  scheduleLabel: string | null;
  timezone: string | null;
  missingRequirements: number;
  nextSession: SessionRow | null;
}

export interface SessionRow {
  id: string;
  classId: string;
  studentId: string;
  studentName: string;
  programId: string;
  programName: string;
  sessionDate: number;
  sessionOn: string | null;
  title: string | null;
  timezone: string | null;
  location: string | null;
  meetingLink: string | null;
  status: "scheduled" | "completed" | "cancelled";
}

export interface RequirementRow {
  id: string;
  registrationId: string;
  requirementId: string;
  studentId: string;
  studentName: string;
  programId: string;
  programName: string;
  kind: string;
  prompt: string;
  helpText: string | null;
  choices: string | null;
  status: "pending" | "submitted" | "approved" | "needs_correction" | "waived";
  response: string | null;
  dueAt: number | null;
  blocksConfirmation: boolean;
  staffApprovalRequired: boolean;
  visibility: string;
  reviewNote: string | null;
}

export interface FamilyNotificationRow {
  id: string;
  studentId: string | null;
  studentName: string | null;
  programId: string | null;
  programName: string | null;
  kind: string;
  title: string;
  body: string | null;
  actionLabel: string | null;
  actionHref: string | null;
  urgency: "normal" | "important" | "urgent";
  requiresAcknowledgment: boolean;
  acknowledgedAt: number | null;
  createdAt: number;
}

export interface CompletedProgramRow {
  registrationId: string;
  studentId: string;
  studentName: string;
  programId: string;
  programName: string;
  outcome: "completed" | "participated" | "not_completed";
  sessionsAttended: number;
  sessionsTotal: number;
  completedAt: number | null;
  certificateSerial: string | null;
  certificateIssuedAt: number | null;
  feedbackSubmitted: boolean;
  recommendedNextProgramId: string | null;
  recommendedNextProgramName: string | null;
}

export interface OfferRow {
  id: string;
  registrationId: string;
  studentId: string;
  studentName: string;
  programId: string;
  programName: string;
  status: "sent" | "accepted" | "declined" | "expired" | "revoked";
  expiresAt: number;
  supportContact: string | null;
}

/* ===================================================================== */
/* Dashboard                                                             */
/* ===================================================================== */

export interface FamilyDashboard {
  children: ChildRegistration[];
  schedule: SessionRow[];
  requirementsRequiredNow: RequirementRow[];
  requirementsDueLater: RequirementRow[];
  requirementsCompleted: RequirementRow[];
  notifications: FamilyNotificationRow[];
  completedPrograms: CompletedProgramRow[];
  openOffers: OfferRow[];
}

/**
 * One read that assembles the whole dashboard. Deliberately a single
 * function (rather than one hook per section) so every section is derived
 * from the same `studentIds` scope computed once.
 */
export async function loadFamilyDashboard(personId: string): Promise<FamilyDashboard> {
  const db = getDb();
  const studentIds = await studentIdsForGuardian(personId);
  if (studentIds.length === 0) {
    return {
      children: [],
      schedule: [],
      requirementsRequiredNow: [],
      requirementsDueLater: [],
      requirementsCompleted: [],
      notifications: [],
      completedPrograms: [],
      openOffers: [],
    };
  }
  const placeholders = studentIds.map(() => "?").join(",");

  const registrations = (await db
    .prepare(
      `SELECT r.id AS registration_id, r.student_id, s.name AS student_name, r.program_id,
              p.name AS program_name, p.short_description, r.status, r.holds_seat,
              r.reservation_expires_at, r.class_id, p.schedule_label, p.schedule_timezone
         FROM program_registrations r
         JOIN students s ON s.id = r.student_id
         JOIN programs p ON p.id = r.program_id
        WHERE r.student_id IN (${placeholders})
        ORDER BY r.created_at DESC`,
    )
    .all(...studentIds)) as unknown as {
    registration_id: string;
    student_id: string;
    student_name: string;
    program_id: string;
    program_name: string;
    short_description: string | null;
    status: string;
    holds_seat: boolean;
    reservation_expires_at: number | null;
    class_id: string | null;
    schedule_label: string | null;
    schedule_timezone: string | null;
  }[];

  const registrationIds = registrations.map((r) => r.registration_id);
  const missingByRegistration = await outstandingCountsByRegistration(registrationIds);
  const nextSessionByClass = await nextSessionsByClass(
    registrations.map((r) => r.class_id).filter((id): id is string => Boolean(id)),
  );

  const children: ChildRegistration[] = registrations
    .filter((r) => r.status !== "completed")
    .map((r) => ({
      registrationId: r.registration_id,
      studentId: r.student_id,
      studentName: r.student_name,
      programId: r.program_id,
      programName: r.program_name,
      shortDescription: r.short_description,
      status: r.status as RegistrationStatus,
      statusLabel: registrationLabel(r.status),
      holdsSeat: r.holds_seat,
      reservationExpiresAt: r.reservation_expires_at == null ? null : Number(r.reservation_expires_at),
      classId: r.class_id,
      scheduleLabel: r.schedule_label,
      timezone: r.schedule_timezone,
      missingRequirements: missingByRegistration.get(r.registration_id) ?? 0,
      nextSession: r.class_id ? (nextSessionByClass.get(r.class_id) ?? null) : null,
    }));

  const schedule = await familySchedule(studentIds);
  const requirements = await familyRequirements(registrationIds);
  const notifications = await familyNotifications(personId);
  const completedPrograms = await completedProgramsFor(studentIds);
  const openOffers = await openOffersFor(registrationIds);

  return {
    children,
    schedule,
    requirementsRequiredNow: requirements.filter((r) => r.status !== "approved" && r.status !== "waived" && r.blocksConfirmation),
    requirementsDueLater: requirements.filter(
      (r) => r.status !== "approved" && r.status !== "waived" && !r.blocksConfirmation,
    ),
    requirementsCompleted: requirements.filter((r) => r.status === "approved" || r.status === "waived"),
    notifications,
    completedPrograms,
    openOffers,
  };
}

async function outstandingCountsByRegistration(registrationIds: string[]): Promise<Map<string, number>> {
  if (registrationIds.length === 0) return new Map();
  const db = getDb();
  const placeholders = registrationIds.map(() => "?").join(",");
  const rows = (await db
    .prepare(
      `SELECT rr.registration_id, COUNT(*) AS n
         FROM registration_requirements rr
         JOIN program_requirements pr ON pr.id = rr.requirement_id
        WHERE rr.registration_id IN (${placeholders})
          AND pr.active = true
          AND rr.status NOT IN ('approved', 'waived')
        GROUP BY rr.registration_id`,
    )
    .all(...registrationIds)) as unknown as { registration_id: string; n: number | string }[];
  return new Map(rows.map((r) => [r.registration_id, Number(r.n)]));
}

async function nextSessionsByClass(classIds: string[]): Promise<Map<string, SessionRow>> {
  if (classIds.length === 0) return new Map();
  const db = getDb();
  const placeholders = classIds.map(() => "?").join(",");
  const rows = (await db
    .prepare(
      `SELECT cs.id, cs.class_id, cs.session_date, cs.session_on, cs.title, cs.timezone, cs.location,
              cs.meeting_link, cs.status
         FROM class_sessions cs
        WHERE cs.class_id IN (${placeholders}) AND cs.status = 'scheduled' AND cs.session_date >= ?
        ORDER BY cs.session_date ASC`,
    )
    .all(...classIds, Date.now())) as unknown as {
    id: string;
    class_id: string;
    session_date: number;
    session_on: string | null;
    title: string | null;
    timezone: string | null;
    location: string | null;
    meeting_link: string | null;
    status: "scheduled" | "completed" | "cancelled";
  }[];
  const map = new Map<string, SessionRow>();
  for (const row of rows) {
    if (map.has(row.class_id)) continue; // first (earliest) row wins
    map.set(row.class_id, {
      id: row.id,
      classId: row.class_id,
      studentId: "",
      studentName: "",
      programId: "",
      programName: "",
      sessionDate: Number(row.session_date),
      sessionOn: row.session_on,
      title: row.title,
      timezone: row.timezone,
      location: row.location,
      meetingLink: row.meeting_link,
      status: row.status,
    });
  }
  return map;
}

/** Upcoming sessions across every child, combined into one simple list. */
export async function familySchedule(studentIds: string[]): Promise<SessionRow[]> {
  if (studentIds.length === 0) return [];
  const db = getDb();
  const placeholders = studentIds.map(() => "?").join(",");
  const rows = (await db
    .prepare(
      `SELECT cs.id, cs.class_id, r.student_id, s.name AS student_name, r.program_id, p.name AS program_name,
              cs.session_date, cs.session_on, cs.title, cs.timezone, cs.location, cs.meeting_link, cs.status
         FROM class_sessions cs
         JOIN classes c ON c.id = cs.class_id
         JOIN program_registrations r ON r.class_id = cs.class_id
         JOIN students s ON s.id = r.student_id
         JOIN programs p ON p.id = r.program_id
        WHERE r.student_id IN (${placeholders})
          AND r.holds_seat = true
          AND cs.status = 'scheduled'
          AND cs.session_date >= ?
        ORDER BY cs.session_date ASC
        LIMIT 50`,
    )
    .all(...studentIds, Date.now())) as unknown as Array<{
    id: string;
    class_id: string;
    student_id: string;
    student_name: string;
    program_id: string;
    program_name: string;
    session_date: number;
    session_on: string | null;
    title: string | null;
    timezone: string | null;
    location: string | null;
    meeting_link: string | null;
    status: "scheduled" | "completed" | "cancelled";
  }>;
  return rows.map((row) => ({
    id: row.id,
    classId: row.class_id,
    studentId: row.student_id,
    studentName: row.student_name,
    programId: row.program_id,
    programName: row.program_name,
    sessionDate: Number(row.session_date),
    sessionOn: row.session_on,
    title: row.title,
    timezone: row.timezone,
    location: row.location,
    meetingLink: row.meeting_link,
    status: row.status,
  }));
}

async function familyRequirements(registrationIds: string[]): Promise<RequirementRow[]> {
  if (registrationIds.length === 0) return [];
  const db = getDb();
  const placeholders = registrationIds.map(() => "?").join(",");
  const rows = (await db
    .prepare(
      `SELECT rr.id, rr.registration_id, rr.requirement_id, r.student_id, s.name AS student_name,
              r.program_id, p.name AS program_name, pr.kind, pr.prompt, pr.help_text, pr.choices,
              rr.status, rr.response, rr.due_at, pr.blocks_confirmation, pr.staff_approval_required,
              pr.visibility, rr.review_note
         FROM registration_requirements rr
         JOIN program_requirements pr ON pr.id = rr.requirement_id
         JOIN program_registrations r ON r.id = rr.registration_id
         JOIN students s ON s.id = r.student_id
         JOIN programs p ON p.id = r.program_id
        WHERE rr.registration_id IN (${placeholders}) AND pr.active = true
        ORDER BY pr.sort_order, rr.created_at`,
    )
    .all(...registrationIds)) as unknown as Array<{
    id: string;
    registration_id: string;
    requirement_id: string;
    student_id: string;
    student_name: string;
    program_id: string;
    program_name: string;
    kind: string;
    prompt: string;
    help_text: string | null;
    choices: string | null;
    status: RequirementRow["status"];
    response: string | null;
    due_at: number | null;
    blocks_confirmation: boolean;
    staff_approval_required: boolean;
    visibility: string;
    review_note: string | null;
  }>;
  return rows.map((row) => ({
    id: row.id,
    registrationId: row.registration_id,
    requirementId: row.requirement_id,
    studentId: row.student_id,
    studentName: row.student_name,
    programId: row.program_id,
    programName: row.program_name,
    kind: row.kind,
    prompt: row.prompt,
    helpText: row.help_text,
    choices: row.choices,
    status: row.status,
    response: row.response,
    dueAt: row.due_at == null ? null : Number(row.due_at),
    blocksConfirmation: row.blocks_confirmation,
    staffApprovalRequired: row.staff_approval_required,
    visibility: row.visibility,
    reviewNote: row.review_note,
  }));
}

async function familyNotifications(personId: string): Promise<FamilyNotificationRow[]> {
  const db = getDb();
  const rows = (await db
    .prepare(
      `SELECT n.id, n.student_id, s.name AS student_name, n.program_id, p.name AS program_name,
              n.kind, n.title, n.body, n.action_label, n.action_href, n.urgency,
              n.requires_acknowledgment, n.acknowledged_at, n.created_at
         FROM family_notifications n
         LEFT JOIN students s ON s.id = n.student_id
         LEFT JOIN programs p ON p.id = n.program_id
        WHERE n.person_id = ?
        ORDER BY n.created_at DESC
        LIMIT 50`,
    )
    .all(personId)) as unknown as Array<{
    id: string;
    student_id: string | null;
    student_name: string | null;
    program_id: string | null;
    program_name: string | null;
    kind: string;
    title: string;
    body: string | null;
    action_label: string | null;
    action_href: string | null;
    urgency: "normal" | "important" | "urgent";
    requires_acknowledgment: boolean;
    acknowledged_at: number | null;
    created_at: number;
  }>;
  return rows.map((row) => ({
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    programId: row.program_id,
    programName: row.program_name,
    kind: row.kind,
    title: row.title,
    body: row.body,
    actionLabel: row.action_label,
    actionHref: row.action_href,
    urgency: row.urgency,
    requiresAcknowledgment: row.requires_acknowledgment,
    acknowledgedAt: row.acknowledged_at == null ? null : Number(row.acknowledged_at),
    createdAt: Number(row.created_at),
  }));
}

async function completedProgramsFor(studentIds: string[]): Promise<CompletedProgramRow[]> {
  if (studentIds.length === 0) return [];
  const db = getDb();
  const placeholders = studentIds.map(() => "?").join(",");
  const rows = (await db
    .prepare(
      `SELECT c.registration_id, c.student_id, s.name AS student_name, c.program_id, p.name AS program_name,
              c.outcome, c.sessions_attended, c.sessions_total, r.completed_at,
              c.certificate_serial, c.certificate_issued_at,
              np.id AS next_program_id, np.name AS next_program_name,
              EXISTS(SELECT 1 FROM program_feedback f WHERE f.registration_id = c.registration_id AND f.author = 'parent') AS feedback_submitted
         FROM program_completion_records c
         JOIN students s ON s.id = c.student_id
         JOIN programs p ON p.id = c.program_id
         JOIN program_registrations r ON r.id = c.registration_id
         LEFT JOIN programs np ON np.id = p.recommended_next_program_id
        WHERE c.student_id IN (${placeholders})
        ORDER BY r.completed_at DESC NULLS LAST`,
    )
    .all(...studentIds)) as unknown as Array<{
    registration_id: string;
    student_id: string;
    student_name: string;
    program_id: string;
    program_name: string;
    outcome: CompletedProgramRow["outcome"];
    sessions_attended: number;
    sessions_total: number;
    completed_at: number | null;
    certificate_serial: string | null;
    certificate_issued_at: number | null;
    next_program_id: string | null;
    next_program_name: string | null;
    feedback_submitted: boolean;
  }>;
  return rows.map((row) => ({
    registrationId: row.registration_id,
    studentId: row.student_id,
    studentName: row.student_name,
    programId: row.program_id,
    programName: row.program_name,
    outcome: row.outcome,
    sessionsAttended: row.sessions_attended,
    sessionsTotal: row.sessions_total,
    completedAt: row.completed_at == null ? null : Number(row.completed_at),
    certificateSerial: row.certificate_serial,
    certificateIssuedAt: row.certificate_issued_at == null ? null : Number(row.certificate_issued_at),
    feedbackSubmitted: row.feedback_submitted,
    recommendedNextProgramId: row.next_program_id,
    recommendedNextProgramName: row.next_program_name,
  }));
}

async function openOffersFor(registrationIds: string[]): Promise<OfferRow[]> {
  if (registrationIds.length === 0) return [];
  const db = getDb();
  const placeholders = registrationIds.map(() => "?").join(",");
  const rows = (await db
    .prepare(
      `SELECT o.id, o.registration_id, r.student_id, s.name AS student_name, o.program_id, p.name AS program_name,
              o.status, o.expires_at, p.support_contact
         FROM waitlist_offers o
         JOIN program_registrations r ON r.id = o.registration_id
         JOIN students s ON s.id = r.student_id
         JOIN programs p ON p.id = o.program_id
        WHERE o.registration_id IN (${placeholders}) AND o.status = 'sent'
        ORDER BY o.expires_at ASC`,
    )
    .all(...registrationIds)) as unknown as Array<{
    id: string;
    registration_id: string;
    student_id: string;
    student_name: string;
    program_id: string;
    program_name: string;
    status: OfferRow["status"];
    expires_at: number;
    support_contact: string | null;
  }>;
  return rows.map((row) => ({
    id: row.id,
    registrationId: row.registration_id,
    studentId: row.student_id,
    studentName: row.student_name,
    programId: row.program_id,
    programName: row.program_name,
    status: row.status,
    expiresAt: Number(row.expires_at),
    supportContact: row.support_contact,
  }));
}

/* ===================================================================== */
/* Single-offer / single-registration reads (scope-checked)             */
/* ===================================================================== */

export interface OfferDetail extends OfferRow {
  requirementsPreview: { prompt: string; kind: string }[];
  expired: boolean;
}

/** Returns null both when the offer does not exist and when this guardian may
 * not see it — the caller must not be able to distinguish the two. */
export async function loadOfferForGuardian(offerId: string, personId: string): Promise<OfferDetail | null> {
  const db = getDb();
  const row = (await db
    .prepare(
      `SELECT o.id, o.registration_id, r.student_id, s.name AS student_name, o.program_id, p.name AS program_name,
              o.status, o.expires_at, p.support_contact
         FROM waitlist_offers o
         JOIN program_registrations r ON r.id = o.registration_id
         JOIN students s ON s.id = r.student_id
         JOIN programs p ON p.id = o.program_id
        WHERE o.id = ?`,
    )
    .get(offerId)) as
    | {
        id: string;
        registration_id: string;
        student_id: string;
        student_name: string;
        program_id: string;
        program_name: string;
        status: OfferRow["status"];
        expires_at: number;
        support_contact: string | null;
      }
    | undefined;
  if (!row) return null;
  if (!(await guardianCanAccessStudent(personId, row.student_id))) return null;

  const requirements = (await db
    .prepare(
      `SELECT pr.prompt, pr.kind FROM program_requirements pr
        WHERE pr.program_id = ? AND pr.active = true ORDER BY pr.sort_order`,
    )
    .all(row.program_id)) as unknown as { prompt: string; kind: string }[];

  return {
    id: row.id,
    registrationId: row.registration_id,
    studentId: row.student_id,
    studentName: row.student_name,
    programId: row.program_id,
    programName: row.program_name,
    status: row.status,
    expiresAt: Number(row.expires_at),
    supportContact: row.support_contact,
    requirementsPreview: requirements,
    expired: row.status === "expired" || (row.status === "sent" && row.expires_at < Date.now()),
  };
}

/** A single child's registration, scope-checked, for the requirements page. */
export async function loadRegistrationForGuardian(
  registrationId: string,
  personId: string,
): Promise<{ id: string; studentId: string; studentName: string; programId: string; programName: string; status: string } | null> {
  const db = getDb();
  const row = (await db
    .prepare(
      `SELECT r.id, r.student_id, s.name AS student_name, r.program_id, p.name AS program_name, r.status
         FROM program_registrations r
         JOIN students s ON s.id = r.student_id
         JOIN programs p ON p.id = r.program_id
        WHERE r.id = ?`,
    )
    .get(registrationId)) as
    | { id: string; student_id: string; student_name: string; program_id: string; program_name: string; status: string }
    | undefined;
  if (!row) return null;
  if (!(await guardianCanAccessStudent(personId, row.student_id))) return null;
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    programId: row.program_id,
    programName: row.program_name,
    status: row.status,
  };
}

export async function loadRequirementForGuardian(
  registrationRequirementId: string,
  personId: string,
): Promise<RequirementRow | null> {
  const db = getDb();
  const row = (await db
    .prepare(
      `SELECT rr.id, rr.registration_id, rr.requirement_id, r.student_id, s.name AS student_name,
              r.program_id, p.name AS program_name, pr.kind, pr.prompt, pr.help_text, pr.choices,
              rr.status, rr.response, rr.due_at, pr.blocks_confirmation, pr.staff_approval_required,
              pr.visibility, rr.review_note
         FROM registration_requirements rr
         JOIN program_requirements pr ON pr.id = rr.requirement_id
         JOIN program_registrations r ON r.id = rr.registration_id
         JOIN students s ON s.id = r.student_id
         JOIN programs p ON p.id = r.program_id
        WHERE rr.id = ?`,
    )
    .get(registrationRequirementId)) as
    | {
        id: string;
        registration_id: string;
        requirement_id: string;
        student_id: string;
        student_name: string;
        program_id: string;
        program_name: string;
        kind: string;
        prompt: string;
        help_text: string | null;
        choices: string | null;
        status: RequirementRow["status"];
        response: string | null;
        due_at: number | null;
        blocks_confirmation: boolean;
        staff_approval_required: boolean;
        visibility: string;
        review_note: string | null;
      }
    | undefined;
  if (!row) return null;
  if (!(await guardianCanAccessStudent(personId, row.student_id))) return null;
  return {
    id: row.id,
    registrationId: row.registration_id,
    requirementId: row.requirement_id,
    studentId: row.student_id,
    studentName: row.student_name,
    programId: row.program_id,
    programName: row.program_name,
    kind: row.kind,
    prompt: row.prompt,
    helpText: row.help_text,
    choices: row.choices,
    status: row.status,
    response: row.response,
    dueAt: row.due_at == null ? null : Number(row.due_at),
    blocksConfirmation: row.blocks_confirmation,
    staffApprovalRequired: row.staff_approval_required,
    visibility: row.visibility,
    reviewNote: row.review_note,
  };
}

/* ===================================================================== */
/* Guardians (for the "student access" self-service panel)              */
/* ===================================================================== */

export interface GuardianRow {
  id: string;
  studentId: string;
  personId: string;
  name: string | null;
  email: string | null;
  relationship: string | null;
  isPrimary: boolean;
  status: "active" | "invited" | "revoked";
  canRegister: boolean;
  canViewSensitive: boolean;
}

export async function guardiansForStudent(studentId: string, personId: string): Promise<GuardianRow[]> {
  if (!(await guardianCanAccessStudent(personId, studentId))) return [];
  const db = getDb();
  const rows = (await db
    .prepare(
      `SELECT g.id, g.student_id, g.person_id, p.name, p.email, g.relationship, g.is_primary,
              g.status, g.can_register, g.can_view_sensitive
         FROM student_guardians g
         JOIN people p ON p.id = g.person_id
        WHERE g.student_id = ?
        ORDER BY g.is_primary DESC, g.created_at`,
    )
    .all(studentId)) as unknown as Array<{
    id: string;
    student_id: string;
    person_id: string;
    name: string | null;
    email: string | null;
    relationship: string | null;
    is_primary: boolean;
    status: GuardianRow["status"];
    can_register: boolean;
    can_view_sensitive: boolean;
  }>;
  return rows.map((row) => ({
    id: row.id,
    studentId: row.student_id,
    personId: row.person_id,
    name: row.name,
    email: row.email,
    relationship: row.relationship,
    isPrimary: row.is_primary,
    canRegister: row.can_register,
    canViewSensitive: row.can_view_sensitive,
    status: row.status,
  }));
}

/* ===================================================================== */
/* Student program home (app/app/student)                               */
/* ===================================================================== */

export interface StudentProgramSummary {
  registrationId: string;
  programId: string;
  programName: string;
  shortDescription: string | null;
  longDescription: string | null;
  status: RegistrationStatus;
  classId: string | null;
  scheduleLabel: string | null;
  timezone: string | null;
  location: string | null;
  instructorName: string | null;
}

/** Every program a student (by their own `students.user_id`) is enrolled in. */
export async function studentProgramsForUser(userId: string): Promise<StudentProgramSummary[]> {
  const db = getDb();
  const rows = (await db
    .prepare(
      `SELECT r.id AS registration_id, r.program_id, p.name AS program_name, p.short_description,
              p.long_description, r.status, r.class_id, p.schedule_label, p.schedule_timezone,
              c.location,
              (SELECT ppl.name FROM class_instructors ci
                 JOIN instructors i ON i.id = ci.instructor_id
                 JOIN people ppl ON ppl.id = i.person_id
                WHERE ci.class_id = r.class_id AND ci.role = 'lead' AND ci.removed_at IS NULL
                LIMIT 1) AS instructor_name
         FROM program_registrations r
         JOIN students s ON s.id = r.student_id
         JOIN programs p ON p.id = r.program_id
         LEFT JOIN classes c ON c.id = r.class_id
        WHERE s.user_id = ?
        ORDER BY r.created_at DESC`,
    )
    .all(userId)) as unknown as Array<{
    registration_id: string;
    program_id: string;
    program_name: string;
    short_description: string | null;
    long_description: string | null;
    status: string;
    class_id: string | null;
    schedule_label: string | null;
    schedule_timezone: string | null;
    location: string | null;
    instructor_name: string | null;
  }>;
  return rows.map((row) => ({
    registrationId: row.registration_id,
    programId: row.program_id,
    programName: row.program_name,
    shortDescription: row.short_description,
    longDescription: row.long_description,
    status: row.status as RegistrationStatus,
    classId: row.class_id,
    scheduleLabel: row.schedule_label,
    timezone: row.schedule_timezone,
    location: row.location,
    instructorName: row.instructor_name,
  }));
}

export interface StudentSessionRow extends SessionRow {
  attendanceStatus: string | null;
}

export interface StudentProgramHome {
  registrationId: string;
  studentId: string;
  programId: string;
  programName: string;
  shortDescription: string | null;
  longDescription: string | null;
  whatToBring: string | null;
  status: RegistrationStatus;
  instructorName: string | null;
  location: string | null;
  timezone: string | null;
  nextSession: StudentSessionRow | null;
  sessions: StudentSessionRow[];
  sessionsAttended: number;
  sessionsCompleted: number;
  sessionsRemaining: number;
  sessionsTotal: number;
  completion: { outcome: string; certificateSerial: string | null } | null;
}

/**
 * The one-screen program home for a signed-in student. `userId` must be the
 * session's own id — a student can never pass another student's registration
 * id and reach this data, because the query is scoped by `s.user_id = ?`
 * rather than by the registration id alone.
 */
export async function loadStudentProgramHome(
  userId: string,
  registrationId: string,
): Promise<StudentProgramHome | null> {
  const db = getDb();
  const reg = (await db
    .prepare(
      `SELECT r.id, r.student_id, r.program_id, p.name AS program_name, p.short_description,
              p.long_description, p.what_to_bring, r.status, r.class_id, p.schedule_timezone, c.location,
              (SELECT ppl.name FROM class_instructors ci
                 JOIN instructors i ON i.id = ci.instructor_id
                 JOIN people ppl ON ppl.id = i.person_id
                WHERE ci.class_id = r.class_id AND ci.role = 'lead' AND ci.removed_at IS NULL
                LIMIT 1) AS instructor_name
         FROM program_registrations r
         JOIN students s ON s.id = r.student_id
         JOIN programs p ON p.id = r.program_id
         LEFT JOIN classes c ON c.id = r.class_id
        WHERE r.id = ? AND s.user_id = ?`,
    )
    .get(registrationId, userId)) as
    | {
        id: string;
        student_id: string;
        program_id: string;
        program_name: string;
        short_description: string | null;
        long_description: string | null;
        what_to_bring: string | null;
        status: string;
        class_id: string | null;
        schedule_timezone: string | null;
        location: string | null;
        instructor_name: string | null;
      }
    | undefined;
  if (!reg) return null;

  const sessions = reg.class_id
    ? ((await db
        .prepare(
          `SELECT cs.id, cs.class_id, cs.session_date, cs.session_on, cs.title, cs.timezone, cs.location,
                  cs.meeting_link, cs.status,
                  (SELECT ar.status FROM attendance_records ar WHERE ar.session_id = cs.id AND ar.student_id = ? LIMIT 1) AS attendance_status
             FROM class_sessions cs
            WHERE cs.class_id = ?
            ORDER BY cs.session_date ASC`,
        )
        .all(reg.student_id, reg.class_id)) as unknown as Array<{
        id: string;
        class_id: string;
        session_date: number;
        session_on: string | null;
        title: string | null;
        timezone: string | null;
        location: string | null;
        meeting_link: string | null;
        status: "scheduled" | "completed" | "cancelled";
        attendance_status: string | null;
      }>)
    : [];

  const mapped: StudentSessionRow[] = sessions.map((row) => ({
    id: row.id,
    classId: row.class_id,
    studentId: reg.student_id,
    studentName: "",
    programId: reg.program_id,
    programName: reg.program_name,
    sessionDate: Number(row.session_date),
    sessionOn: row.session_on,
    title: row.title,
    timezone: row.timezone,
    location: row.location,
    meetingLink: row.meeting_link,
    status: row.status,
    attendanceStatus: row.attendance_status,
  }));

  const now = Date.now();
  const nextSession = mapped.find((s) => s.status === "scheduled" && s.sessionDate >= now) ?? null;
  const sessionsAttended = mapped.filter((s) => s.attendanceStatus === "present" || s.attendanceStatus === "late").length;
  const sessionsCompleted = mapped.filter((s) => s.status === "completed").length;
  const sessionsTotal = mapped.filter((s) => s.status !== "cancelled").length;

  const completion = (await db
    .prepare("SELECT outcome, certificate_serial FROM program_completion_records WHERE registration_id = ?")
    .get(registrationId)) as { outcome: string; certificate_serial: string | null } | undefined;

  return {
    registrationId: reg.id,
    studentId: reg.student_id,
    programId: reg.program_id,
    programName: reg.program_name,
    shortDescription: reg.short_description,
    longDescription: reg.long_description,
    whatToBring: reg.what_to_bring,
    status: reg.status as RegistrationStatus,
    instructorName: reg.instructor_name,
    location: reg.location,
    timezone: reg.schedule_timezone,
    nextSession,
    sessions: mapped,
    sessionsAttended,
    sessionsCompleted,
    sessionsRemaining: Math.max(sessionsTotal - sessionsCompleted, 0),
    sessionsTotal,
    completion: completion ? { outcome: completion.outcome, certificateSerial: completion.certificate_serial } : null,
  };
}
