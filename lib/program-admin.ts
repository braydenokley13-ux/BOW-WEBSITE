/* ============================================================
 * Program admin read helpers — enrollment counts, needs-attention queue,
 * registration list/detail, and registration launch readiness.
 *
 * Server-only reads that sit on top of the lifecycle engine in
 * lib/enrollment.ts. Nothing here writes a registration row; every write
 * belongs to the engine or to app/actions/registration-admin.ts, which calls
 * the engine. Keeping reads and writes in separate modules is what lets this
 * file be imported freely from pages without dragging in the seat-lock
 * transaction machinery.
 * ============================================================ */

import "server-only";

import { getDb } from "@/lib/db";
import { holdsSeat, registrationLabel } from "@/lib/enrollment-shared";

/* ===================================================================== */
/* Program summary                                                      */
/* ===================================================================== */

export interface ProgramAdminSummary {
  id: string;
  name: string;
  capacity: number | null;
  classId: string | null;
  classCapacity: number | null;
}

export async function loadProgramSummary(programId: string): Promise<ProgramAdminSummary | null> {
  const db = getDb();
  const program = (await db
    .prepare("SELECT id, name, capacity FROM programs WHERE id = ?")
    .get(programId)) as { id: string; name: string; capacity: number | null } | undefined;
  if (!program) return null;
  const primaryClass = (await db
    .prepare(
      `SELECT id, capacity FROM classes
        WHERE program_id = ? AND status NOT IN ('completed', 'cancelled')
        ORDER BY created_at, id LIMIT 1`,
    )
    .get(programId)) as { id: string; capacity: number | null } | undefined;
  return {
    id: program.id,
    name: program.name,
    capacity: program.capacity,
    classId: primaryClass?.id ?? null,
    classCapacity: primaryClass?.capacity ?? null,
  };
}

/* ===================================================================== */
/* Mutually exclusive enrollment counts                                 */
/* ===================================================================== */

// One bucket per registration, chosen by status alone — never by overlapping
// `holds_seat`/status filters, which is how a registration could silently
// land in two buckets or none. "Requirements pending" and "under review" are
// carved out of the seat-holding statuses so a family with an outstanding
// form isn't also counted as plain "confirmed".
export interface EnrollmentCounts {
  capacity: number | null;
  confirmed: number;
  reserved: number;
  requirementsPending: number;
  underReview: number;
  waitlisted: number;
  offersOutstanding: number;
  withdrawn: number;
  cancelled: number;
  declined: number;
  expired: number;
  completed: number;
  remaining: number | null;
  totalLive: number;
}

const BUCKET_OF: Record<string, keyof EnrollmentCounts | null> = {
  confirmed: "confirmed",
  seat_reserved: "reserved",
  requirements_pending: "requirementsPending",
  under_review: "underReview",
  pending: "underReview",
  submitted: "underReview",
  waitlisted: "waitlisted",
  offer_sent: "offersOutstanding",
  offer_accepted: "offersOutstanding",
  withdrawn: "withdrawn",
  cancelled: "cancelled",
  declined: "declined",
  expired: "expired",
  completed: "completed",
};

export async function enrollmentCounts(programId: string): Promise<EnrollmentCounts> {
  const db = getDb();
  const summary = await loadProgramSummary(programId);
  const rows = (await db
    .prepare("SELECT status, COUNT(*) AS n FROM program_registrations WHERE program_id = ? GROUP BY status")
    .all(programId)) as { status: string; n: number | string }[];

  const counts: EnrollmentCounts = {
    capacity: summary?.classCapacity ?? summary?.capacity ?? null,
    confirmed: 0,
    reserved: 0,
    requirementsPending: 0,
    underReview: 0,
    waitlisted: 0,
    offersOutstanding: 0,
    withdrawn: 0,
    cancelled: 0,
    declined: 0,
    expired: 0,
    completed: 0,
    remaining: null,
    totalLive: 0,
  };

  let taken = 0;
  for (const row of rows) {
    const bucket = BUCKET_OF[row.status];
    const n = Number(row.n ?? 0);
    if (bucket) counts[bucket] = (counts[bucket] as number) + n;
    if (holdsSeat(row.status)) taken += n;
  }
  counts.totalLive = taken + counts.waitlisted;
  counts.remaining = counts.capacity == null ? null : Math.max(0, counts.capacity - taken);
  return counts;
}

/* ===================================================================== */
/* Registration list                                                    */
/* ===================================================================== */

export interface RegistrationListItem {
  id: string;
  studentId: string;
  studentName: string;
  grade: string | null;
  guardianName: string | null;
  guardianEmail: string | null;
  status: string;
  statusLabel: string;
  classId: string | null;
  className: string | null;
  reservationExpiresAt: number | null;
  waitlistSeq: number | null;
  requirementsOutstanding: number;
  createdAt: number;
}

export interface RegistrationListFilters {
  status?: string | null;
  q?: string | null;
  classId?: string | null;
}

export async function listRegistrations(
  programId: string,
  filters: RegistrationListFilters = {},
): Promise<RegistrationListItem[]> {
  const db = getDb();
  const clauses = ["r.program_id = ?"];
  const params: unknown[] = [programId];
  if (filters.status) {
    clauses.push("r.status = ?");
    params.push(filters.status);
  }
  if (filters.classId) {
    clauses.push("r.class_id = ?");
    params.push(filters.classId);
  }
  if (filters.q) {
    clauses.push("(s.name ILIKE ? OR g.name ILIKE ? OR g.email ILIKE ?)");
    const like = `%${filters.q}%`;
    params.push(like, like, like);
  }

  const rows = (await db
    .prepare(
      `SELECT r.id, r.student_id, s.name AS student_name, s.grade, g.name AS guardian_name, g.email AS guardian_email,
              r.status, r.class_id, c.title AS class_title, r.reservation_expires_at, r.waitlist_seq, r.created_at,
              (SELECT COUNT(*) FROM registration_requirements rr
                 JOIN program_requirements pr ON pr.id = rr.requirement_id
                WHERE rr.registration_id = r.id AND pr.active = true
                  AND rr.status NOT IN ('approved', 'waived')) AS requirements_outstanding
         FROM program_registrations r
         JOIN students s ON s.id = r.student_id
         LEFT JOIN people g ON g.id = r.guardian_person_id
         LEFT JOIN classes c ON c.id = r.class_id
        WHERE ${clauses.join(" AND ")}
        ORDER BY r.created_at DESC`,
    )
    .all(...params)) as unknown as Array<{
    id: string;
    student_id: string;
    student_name: string;
    grade: string | null;
    guardian_name: string | null;
    guardian_email: string | null;
    status: string;
    class_id: string | null;
    class_title: string | null;
    reservation_expires_at: number | null;
    waitlist_seq: number | null;
    created_at: number;
    requirements_outstanding: number | string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    grade: row.grade,
    guardianName: row.guardian_name,
    guardianEmail: row.guardian_email,
    status: row.status,
    statusLabel: registrationLabel(row.status),
    classId: row.class_id,
    className: row.class_title,
    reservationExpiresAt: row.reservation_expires_at == null ? null : Number(row.reservation_expires_at),
    waitlistSeq: row.waitlist_seq,
    requirementsOutstanding: Number(row.requirements_outstanding ?? 0),
    createdAt: Number(row.created_at),
  }));
}

/* ===================================================================== */
/* Registration detail                                                  */
/* ===================================================================== */

export interface RegistrationRequirementDetail {
  id: string;
  requirementId: string;
  kind: string;
  prompt: string;
  required: boolean;
  blocksConfirmation: boolean;
  visibility: string;
  status: string;
  dueAt: number | null;
  response: string | null;
  reviewNote: string | null;
}

export interface RegistrationDetail {
  id: string;
  status: string;
  statusLabel: string;
  programId: string;
  programName: string;
  classId: string | null;
  className: string | null;
  studentId: string;
  studentName: string;
  grade: string | null;
  duplicateReviewStatus: string | null;
  guardians: { personId: string; name: string; email: string | null; phone: string | null; isPrimary: boolean; status: string }[];
  holdsSeat: boolean;
  reservationExpiresAt: number | null;
  waitlistSeq: number | null;
  createdAt: number;
  confirmedAt: number | null;
  decisionReason: string | null;
  adminNotes: string | null;
  requirements: RegistrationRequirementDetail[];
  activationState: string | null;
  notifications: { id: string; kind: string; title: string; body: string | null; urgency: string; createdAt: number; emailStatus: string }[];
  auditEvents: { id: string; action: string; actorLabel: string; previousState: string | null; newState: string | null; reason: string | null; createdAt: number }[];
}

export async function loadRegistrationDetail(
  registrationId: string,
  visibleKinds: "all" | string[] = "all",
): Promise<RegistrationDetail | null> {
  const db = getDb();
  const row = (await db
    .prepare(
      `SELECT r.*, s.name AS student_name, s.grade, s.duplicate_review_status,
              p.name AS program_name, c.title AS class_title
         FROM program_registrations r
         JOIN students s ON s.id = r.student_id
         JOIN programs p ON p.id = r.program_id
         LEFT JOIN classes c ON c.id = r.class_id
        WHERE r.id = ?`,
    )
    .get(registrationId)) as
    | {
        id: string;
        status: string;
        program_id: string;
        program_name: string;
        class_id: string | null;
        class_title: string | null;
        student_id: string;
        student_name: string;
        grade: string | null;
        duplicate_review_status: string | null;
        holds_seat: boolean;
        reservation_expires_at: number | null;
        waitlist_seq: number | null;
        created_at: number;
        confirmed_at: number | null;
        decision_reason: string | null;
        admin_notes: string | null;
        guardian_person_id: string | null;
      }
    | undefined;
  if (!row) return null;

  const guardians = (await db
    .prepare(
      `SELECT pe.id AS person_id, pe.name, pe.email, pe.phone, sg.is_primary, sg.status
         FROM student_guardians sg
         JOIN people pe ON pe.id = sg.person_id
        WHERE sg.student_id = ?
        ORDER BY sg.is_primary DESC, pe.name`,
    )
    .all(row.student_id)) as unknown as Array<{
    person_id: string;
    name: string;
    email: string | null;
    phone: string | null;
    is_primary: boolean;
    status: string;
  }>;

  const requirementRows = (await db
    .prepare(
      `SELECT rr.id, rr.requirement_id, pr.kind, pr.prompt, pr.required, pr.blocks_confirmation, pr.visibility,
              rr.status, rr.due_at, rr.response, rr.review_note
         FROM registration_requirements rr
         JOIN program_requirements pr ON pr.id = rr.requirement_id
        WHERE rr.registration_id = ?
        ORDER BY pr.sort_order`,
    )
    .all(registrationId)) as unknown as Array<{
    id: string;
    requirement_id: string;
    kind: string;
    prompt: string;
    required: boolean;
    blocks_confirmation: boolean;
    visibility: string;
    status: string;
    due_at: number | null;
    response: string | null;
    review_note: string | null;
  }>;

  const requirements = requirementRows
    .filter((r) => visibleKinds === "all" || visibleKinds.includes(r.visibility))
    .map((r) => ({
      id: r.id,
      requirementId: r.requirement_id,
      kind: r.kind,
      prompt: r.prompt,
      required: r.required,
      blocksConfirmation: r.blocks_confirmation,
      visibility: r.visibility,
      status: r.status,
      dueAt: r.due_at == null ? null : Number(r.due_at),
      response: r.response,
      reviewNote: r.review_note,
    }));

  const activation = row.guardian_person_id
    ? ((await db
        .prepare("SELECT state FROM parent_activations WHERE person_id = ? ORDER BY created_at DESC LIMIT 1")
        .get(row.guardian_person_id)) as { state: string } | undefined)
    : undefined;

  const notifications = (await db
    .prepare(
      `SELECT id, kind, title, body, urgency, created_at, email_status
         FROM family_notifications WHERE registration_id = ? ORDER BY created_at DESC LIMIT 25`,
    )
    .all(registrationId)) as unknown as Array<{
    id: string;
    kind: string;
    title: string;
    body: string | null;
    urgency: string;
    created_at: number;
    email_status: string;
  }>;

  const auditEvents = (await db
    .prepare(
      `SELECT id, action, actor_label, previous_state, new_state, reason, created_at
         FROM registration_audit_events WHERE registration_id = ? ORDER BY created_at DESC LIMIT 50`,
    )
    .all(registrationId)) as unknown as Array<{
    id: string;
    action: string;
    actor_label: string;
    previous_state: string | null;
    new_state: string | null;
    reason: string | null;
    created_at: number;
  }>;

  return {
    id: row.id,
    status: row.status,
    statusLabel: registrationLabel(row.status),
    programId: row.program_id,
    programName: row.program_name,
    classId: row.class_id,
    className: row.class_title,
    studentId: row.student_id,
    studentName: row.student_name,
    grade: row.grade,
    duplicateReviewStatus: row.duplicate_review_status,
    guardians: guardians.map((g) => ({
      personId: g.person_id,
      name: g.name,
      email: g.email,
      phone: g.phone,
      isPrimary: g.is_primary,
      status: g.status,
    })),
    holdsSeat: row.holds_seat,
    reservationExpiresAt: row.reservation_expires_at == null ? null : Number(row.reservation_expires_at),
    waitlistSeq: row.waitlist_seq,
    createdAt: Number(row.created_at),
    confirmedAt: row.confirmed_at == null ? null : Number(row.confirmed_at),
    decisionReason: row.decision_reason,
    adminNotes: row.admin_notes,
    requirements,
    activationState: activation?.state ?? null,
    notifications: notifications.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      urgency: n.urgency,
      createdAt: Number(n.created_at),
      emailStatus: n.email_status,
    })),
    auditEvents: auditEvents.map((a) => ({
      id: a.id,
      action: a.action,
      actorLabel: a.actor_label,
      previousState: a.previous_state,
      newState: a.new_state,
      reason: a.reason,
      createdAt: Number(a.created_at),
    })),
  };
}

/* ===================================================================== */
/* Needs-attention queue                                                */
/* ===================================================================== */

export type AttentionKind =
  | "reservation_expiring"
  | "reservation_expired"
  | "requirement_missing"
  | "under_review"
  | "duplicate_child"
  | "activation_failed"
  | "offer_expiring"
  | "family_request"
  | "missing_class_placement";

export interface AttentionItem {
  kind: AttentionKind;
  registrationId: string | null;
  studentId: string | null;
  studentName: string;
  guardianName: string | null;
  programId: string;
  problem: string;
  deadline: number | null;
  actionHref: string;
  actionLabel: string;
}

const SOON_MS = 48 * 60 * 60 * 1000;

export async function needsAttention(programId: string): Promise<AttentionItem[]> {
  const db = getDb();
  const now = Date.now();
  const items: AttentionItem[] = [];
  const base = `/app/programs/${programId}/enrollment`;

  // Reservations expiring soon or already past due (the sweep may not have
  // run yet — this queue must never rely on a background job to be correct).
  const reservations = (await db
    .prepare(
      `SELECT r.id, r.student_id, s.name AS student_name, g.name AS guardian_name, r.reservation_expires_at
         FROM program_registrations r
         JOIN students s ON s.id = r.student_id
         LEFT JOIN people g ON g.id = r.guardian_person_id
        WHERE r.program_id = ? AND r.status IN ('seat_reserved', 'requirements_pending')
          AND r.reservation_expires_at IS NOT NULL AND r.reservation_expires_at < ?`,
    )
    .all(programId, now + SOON_MS)) as unknown as Array<{
    id: string;
    student_id: string;
    student_name: string;
    guardian_name: string | null;
    reservation_expires_at: number;
  }>;
  for (const r of reservations) {
    items.push({
      kind: r.reservation_expires_at < now ? "reservation_expired" : "reservation_expiring",
      registrationId: r.id,
      studentId: r.student_id,
      studentName: r.student_name,
      guardianName: r.guardian_name,
      programId,
      problem:
        r.reservation_expires_at < now
          ? "Reservation deadline has passed and is awaiting the next sweep."
          : "Seat reservation expires within 48 hours.",
      deadline: r.reservation_expires_at == null ? null : Number(r.reservation_expires_at),
      actionHref: `${base}?open=${r.id}`,
      actionLabel: "Extend or review",
    });
  }

  // Missing a required, confirmation-blocking form.
  const missingRequirements = (await db
    .prepare(
      `SELECT DISTINCT r.id, r.student_id, s.name AS student_name, g.name AS guardian_name,
              rr.due_at, r.reservation_expires_at
         FROM program_registrations r
         JOIN students s ON s.id = r.student_id
         LEFT JOIN people g ON g.id = r.guardian_person_id
         JOIN registration_requirements rr ON rr.registration_id = r.id
         JOIN program_requirements pr ON pr.id = rr.requirement_id
        WHERE r.program_id = ? AND r.holds_seat = true AND pr.active = true
          AND pr.blocks_confirmation = true AND rr.status NOT IN ('approved', 'waived')`,
    )
    .all(programId)) as unknown as Array<{
    id: string;
    student_id: string;
    student_name: string;
    guardian_name: string | null;
    due_at: number | null;
    reservation_expires_at: number | null;
  }>;
  for (const r of missingRequirements) {
    // The real deadline is whichever comes first: the requirement's own due
    // date, or the moment the reserved seat is released. Showing only the
    // former would let an admin triage a seat that expires tonight as if it
    // had a week left. A requirement with no due date still has the seat's.
    const dueAt = r.due_at == null ? null : Number(r.due_at);
    const seatExpiry = r.reservation_expires_at == null ? null : Number(r.reservation_expires_at);
    const deadline =
      dueAt != null && seatExpiry != null ? Math.min(dueAt, seatExpiry) : (dueAt ?? seatExpiry);
    items.push({
      kind: "requirement_missing",
      registrationId: r.id,
      studentId: r.student_id,
      studentName: r.student_name,
      guardianName: r.guardian_name,
      programId,
      problem: "A confirmation-blocking requirement is still outstanding.",
      deadline,
      actionHref: `${base}?open=${r.id}`,
      actionLabel: "Review requirement",
    });
  }

  // Under review.
  const underReview = (await db
    .prepare(
      `SELECT r.id, r.student_id, s.name AS student_name, g.name AS guardian_name, r.created_at
         FROM program_registrations r
         JOIN students s ON s.id = r.student_id
         LEFT JOIN people g ON g.id = r.guardian_person_id
        WHERE r.program_id = ? AND r.status IN ('under_review', 'pending', 'submitted')`,
    )
    .all(programId)) as unknown as Array<{ id: string; student_id: string; student_name: string; guardian_name: string | null; created_at: number }>;
  for (const r of underReview) {
    items.push({
      kind: "under_review",
      registrationId: r.id,
      studentId: r.student_id,
      studentName: r.student_name,
      guardianName: r.guardian_name,
      programId,
      problem: "Registration is waiting on admin eligibility review.",
      deadline: null,
      actionHref: `${base}?open=${r.id}`,
      actionLabel: "Decide eligibility",
    });
  }

  // Possible duplicate child.
  const duplicates = (await db
    .prepare(
      `SELECT DISTINCT r.id, r.student_id, s.name AS student_name, g.name AS guardian_name
         FROM program_registrations r
         JOIN students s ON s.id = r.student_id
         LEFT JOIN people g ON g.id = r.guardian_person_id
        WHERE r.program_id = ? AND s.duplicate_review_status = 'open'
          AND r.status NOT IN ('withdrawn', 'expired', 'declined', 'cancelled')`,
    )
    .all(programId)) as unknown as Array<{ id: string; student_id: string; student_name: string; guardian_name: string | null }>;
  for (const r of duplicates) {
    items.push({
      kind: "duplicate_child",
      registrationId: r.id,
      studentId: r.student_id,
      studentName: r.student_name,
      guardianName: r.guardian_name,
      programId,
      problem: "This child record may be a duplicate of an existing student.",
      deadline: null,
      actionHref: `/app/family-support?studentId=${r.student_id}`,
      actionLabel: "Resolve identity",
    });
  }

  // Failed account activation.
  const failedActivations = (await db
    .prepare(
      `SELECT DISTINCT r.id, r.student_id, s.name AS student_name, g.name AS guardian_name
         FROM program_registrations r
         JOIN students s ON s.id = r.student_id
         JOIN people g ON g.id = r.guardian_person_id
         JOIN parent_activations pa ON pa.person_id = g.id
        WHERE r.program_id = ? AND pa.state IN ('failed', 'support_required')
          AND r.status NOT IN ('withdrawn', 'expired', 'declined', 'cancelled')`,
    )
    .all(programId)) as unknown as Array<{ id: string; student_id: string; student_name: string; guardian_name: string | null }>;
  for (const r of failedActivations) {
    items.push({
      kind: "activation_failed",
      registrationId: r.id,
      studentId: r.student_id,
      studentName: r.student_name,
      guardianName: r.guardian_name,
      programId,
      problem: "The guardian's account activation failed and needs support.",
      deadline: null,
      actionHref: `/app/family-support?studentId=${r.student_id}`,
      actionLabel: "Fix activation",
    });
  }

  // Waitlist offers expiring soon.
  const offers = (await db
    .prepare(
      `SELECT wo.id AS offer_id, r.id, r.student_id, s.name AS student_name, g.name AS guardian_name, wo.expires_at
         FROM waitlist_offers wo
         JOIN program_registrations r ON r.id = wo.registration_id
         JOIN students s ON s.id = r.student_id
         LEFT JOIN people g ON g.id = r.guardian_person_id
        WHERE wo.program_id = ? AND wo.status = 'sent' AND wo.expires_at < ?`,
    )
    .all(programId, now + SOON_MS)) as unknown as Array<{
    offer_id: string;
    id: string;
    student_id: string;
    student_name: string;
    guardian_name: string | null;
    expires_at: number;
  }>;
  for (const r of offers) {
    items.push({
      kind: "offer_expiring",
      registrationId: r.id,
      studentId: r.student_id,
      studentName: r.student_name,
      guardianName: r.guardian_name,
      programId,
      problem: "Waitlist offer expires within 48 hours.",
      deadline: Number(r.expires_at),
      actionHref: `/app/programs/${programId}/waitlist`,
      actionLabel: "View offer",
    });
  }

  // Family-initiated transfer/withdrawal/schedule-change requests.
  const requests = (await db
    .prepare(
      `SELECT fr.id, r.id AS reg_id, fr.student_id, s.name AS student_name, g.name AS guardian_name, fr.kind AS request_kind
         FROM family_requests fr
         JOIN students s ON s.id = fr.student_id
         LEFT JOIN people g ON g.id = fr.requested_by_person_id
         LEFT JOIN program_registrations r ON r.id = fr.registration_id
        WHERE fr.status IN ('submitted', 'under_review')
          AND (fr.registration_id IN (SELECT id FROM program_registrations WHERE program_id = ?))`,
    )
    .all(programId)) as unknown as Array<{
    id: string;
    reg_id: string | null;
    student_id: string;
    student_name: string;
    guardian_name: string | null;
    request_kind: string;
  }>;
  for (const r of requests) {
    items.push({
      kind: "family_request",
      registrationId: r.reg_id,
      studentId: r.student_id,
      studentName: r.student_name,
      guardianName: r.guardian_name,
      programId,
      problem: `Family submitted a ${r.request_kind.replace("_", " ")} request.`,
      deadline: null,
      actionHref: `/app/family-support?studentId=${r.student_id}`,
      actionLabel: "Resolve request",
    });
  }

  // Confirmed but never placed in a class.
  const unplaced = (await db
    .prepare(
      `SELECT r.id, r.student_id, s.name AS student_name, g.name AS guardian_name
         FROM program_registrations r
         JOIN students s ON s.id = r.student_id
         LEFT JOIN people g ON g.id = r.guardian_person_id
        WHERE r.program_id = ? AND r.status = 'confirmed' AND r.class_id IS NULL`,
    )
    .all(programId)) as unknown as Array<{ id: string; student_id: string; student_name: string; guardian_name: string | null }>;
  for (const r of unplaced) {
    items.push({
      kind: "missing_class_placement",
      registrationId: r.id,
      studentId: r.student_id,
      studentName: r.student_name,
      guardianName: r.guardian_name,
      programId,
      problem: "Confirmed seat has no class placement.",
      deadline: null,
      actionHref: `${base}?open=${r.id}`,
      actionLabel: "Place in class",
    });
  }

  items.sort((a, b) => (a.deadline ?? Infinity) - (b.deadline ?? Infinity));
  return items;
}

/* ===================================================================== */
/* Registration launch readiness                                        */
/* ===================================================================== */

export interface ReadinessBlocker {
  key: string;
  label: string;
  why: string;
  fixHref: string;
  owner: string;
  severity: "blocker" | "warning";
}

export interface RegistrationReadiness {
  state: "ready" | "almost_ready" | "blocked" | "open" | "running" | "completed";
  blockers: ReadinessBlocker[];
  warnings: ReadinessBlocker[];
}

interface ProgramRow {
  id: string;
  name: string;
  short_description: string | null;
  grade_min: number | null;
  grade_max: number | null;
  start_date: string | null;
  schedule_timezone: string | null;
  capacity: number | null;
  confirmation_message: string | null;
  waitlist_mode: string;
  waitlist_offer_hours: number;
  reservation_enabled: boolean;
  reservation_hours: number;
  registration_opened_at: number | null;
  public_status: string | null;
  stage: string;
}

export async function registrationReadiness(programId: string): Promise<RegistrationReadiness | null> {
  const db = getDb();
  const program = (await db
    .prepare(
      `SELECT id, name, short_description, grade_min, grade_max, start_date, schedule_timezone, capacity,
              confirmation_message, waitlist_mode, waitlist_offer_hours, reservation_enabled, reservation_hours,
              registration_opened_at, public_status, stage
         FROM programs WHERE id = ?`,
    )
    .get(programId)) as ProgramRow | undefined;
  if (!program) return null;

  const editHref = `/app/programs/${programId}/setup`;
  const blockers: ReadinessBlocker[] = [];
  const warnings: ReadinessBlocker[] = [];

  if (!program.short_description) {
    blockers.push({
      key: "no_public_description",
      label: "No public description",
      why: "Families see a blank listing without a short description of the program.",
      fixHref: `${editHref}?section=basics`,
      owner: "Program owner",
      severity: "blocker",
    });
  }
  if (program.grade_min == null && program.grade_max == null) {
    blockers.push({
      key: "no_grade_range",
      label: "No grade range",
      why: "Eligibility cannot be checked at registration without a grade range.",
      fixHref: `${editHref}?section=basics`,
      owner: "Program owner",
      severity: "blocker",
    });
  }
  if (!program.start_date) {
    blockers.push({
      key: "no_schedule",
      label: "No schedule",
      why: "Requirement due dates and family communication depend on a start date.",
      fixHref: `${editHref}?section=schedule`,
      owner: "Program owner",
      severity: "blocker",
    });
  }
  if (!program.schedule_timezone) {
    blockers.push({
      key: "no_timezone",
      label: "No timezone",
      why: "Reservation and offer deadlines cannot be communicated correctly without a timezone.",
      fixHref: `${editHref}?section=basics`,
      owner: "Program owner",
      severity: "blocker",
    });
  }
  if (!program.capacity) {
    blockers.push({
      key: "no_capacity",
      label: "No program capacity",
      why: "Seat accounting has nothing to count against.",
      fixHref: `${editHref}?section=capacity`,
      owner: "Program owner",
      severity: "blocker",
    });
  }

  const classes = (await db
    .prepare("SELECT id, capacity FROM classes WHERE program_id = ? AND status NOT IN ('completed', 'cancelled')")
    .all(programId)) as unknown as Array<{ id: string; capacity: number | null }>;
  if (classes.length === 0) {
    blockers.push({
      key: "no_class",
      label: "No class",
      why: "Registration needs a class to place a confirmed seat into.",
      fixHref: `/app/programs/${programId}?tab=classes`,
      owner: "Program owner",
      severity: "blocker",
    });
  }

  const sessions = (await db
    .prepare(
      `SELECT COUNT(*) AS n FROM class_sessions cs JOIN classes c ON c.id = cs.class_id
        WHERE c.program_id = ? AND cs.status <> 'cancelled'`,
    )
    .get(programId)) as { n: number | string };
  if (Number(sessions?.n ?? 0) === 0) {
    blockers.push({
      key: "no_sessions",
      label: "No required sessions scheduled",
      why: "Families cannot see what they're registering for without any sessions.",
      fixHref: `/app/programs/${programId}?tab=schedule`,
      owner: "Program owner",
      severity: "blocker",
    });
  }

  // Accepted lead instructor — an unanswered (proposed) assignment does not count.
  let hasAcceptedLead = false;
  for (const cls of classes) {
    const accepted = (await db
      .prepare(
        "SELECT 1 FROM class_instructors WHERE class_id = ? AND role = 'lead' AND assignment_status = 'accepted' AND removed_at IS NULL",
      )
      .get(cls.id)) as { "?column?": number } | undefined;
    if (accepted) {
      hasAcceptedLead = true;
      break;
    }
  }
  if (classes.length > 0 && !hasAcceptedLead) {
    blockers.push({
      key: "no_accepted_lead",
      label: "No accepted lead instructor",
      why: "A proposed assignment that hasn't been accepted does not staff the class.",
      fixHref: `/app/programs/${programId}?tab=people`,
      owner: "Program owner",
      severity: "blocker",
    });
  }

  if (!program.confirmation_message) {
    blockers.push({
      key: "no_confirmation_message",
      label: "No family confirmation message",
      why: "A family gets no explanation of what happens next after registering.",
      fixHref: `${editHref}?section=communication`,
      owner: "Program owner",
      severity: "blocker",
    });
  }

  // Requirement setup validity: any requirement in an inconsistent state.
  const badRequirements = (await db
    .prepare(
      `SELECT COUNT(*) AS n FROM program_requirements
        WHERE program_id = ? AND active = true AND (trim(coalesce(prompt, '')) = '')`,
    )
    .get(programId)) as { n: number | string };
  if (Number(badRequirements?.n ?? 0) > 0) {
    blockers.push({
      key: "invalid_requirement",
      label: "A requirement is missing its family-facing prompt",
      why: "Families can't answer a requirement that has no question.",
      fixHref: `/app/programs/${programId}/requirements`,
      owner: "Program owner",
      severity: "blocker",
    });
  }

  if (program.waitlist_mode !== "disabled" && (!program.waitlist_offer_hours || program.waitlist_offer_hours <= 0)) {
    blockers.push({
      key: "waitlist_no_offer_policy",
      label: "Waitlist enabled without an offer expiration policy",
      why: "An offer with no expiration can hold a seat indefinitely.",
      fixHref: `${editHref}?section=waitlist`,
      owner: "Program owner",
      severity: "blocker",
    });
  }
  if (program.reservation_enabled && (!program.reservation_hours || program.reservation_hours <= 0)) {
    blockers.push({
      key: "reservation_no_expiration",
      label: "Reservations enabled without expiration rules",
      why: "A reserved seat with no deadline can never release back to the waitlist.",
      fixHref: `${editHref}?section=registration`,
      owner: "Program owner",
      severity: "blocker",
    });
  }

  if (!program.name || program.name.length < 3) {
    warnings.push({
      key: "short_name",
      label: "Program name looks incomplete",
      why: "A short or placeholder name is confusing in family communication.",
      fixHref: `${editHref}?section=basics`,
      owner: "Program owner",
      severity: "warning",
    });
  }

  let state: RegistrationReadiness["state"];
  if (program.stage === "completed") state = "completed";
  else if (program.public_status !== "coming_soon" && program.public_status !== "closed" && program.registration_opened_at) {
    state = program.stage === "active" ? "running" : "open";
  } else if (blockers.length === 0 && warnings.length === 0) state = "ready";
  else if (blockers.length === 0) state = "almost_ready";
  else state = "blocked";

  return { state, blockers, warnings };
}
