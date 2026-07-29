/* ============================================================
 * Registration lifecycle engine — seats, reservations, waitlist offers.
 *
 * This module owns every decision that can be wrong under concurrency:
 * whether a seat exists, who holds it, when it is released, and who is
 * offered it next. Everything else in the family experience reads the
 * records this module writes.
 *
 * Not a "use server" module. These are plain helpers so they can be called
 * from server actions, route handlers, and the expiry sweep alike, and are
 * never directly reachable from a browser.
 *
 * The seat invariant
 * ------------------
 * A registration occupies one of a class's finite seats exactly when
 * `holds_seat = true`. That is true for a live reservation, a confirmed
 * seat, a registration under admin review, and an outstanding waitlist
 * offer. It is false for waitlisted, withdrawn, expired, declined,
 * cancelled, and completed registrations. Capacity is therefore one count
 * over one column, which is why a registration can never be double-counted
 * across status buckets.
 *
 * The locking model
 * -----------------
 * Seat decisions run inside a transaction that first takes a row lock on
 * `classes.seat_lock` (SELECT ... FOR UPDATE). Locking the class row rather
 * than the enrollment rows is what makes this correct: under READ COMMITTED
 * two concurrent transactions can both read "one seat left" from an
 * unlocked COUNT and both insert, because there is no existing row for
 * either to conflict on. Serializing on a row that is guaranteed to exist
 * removes that window, and it works across separate Vercel instances
 * because the lock lives in Postgres, not in the process.
 * ============================================================ */

import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";

/* ===================================================================== */
/* Shared rules                                                          */
/* ===================================================================== */

// The lifecycle vocabulary, eligibility, and availability rules are pure and
// live in lib/enrollment-shared.ts so client components and tests can use
// them without pulling in the database. Re-exported here so server callers
// have one import.
export * from "@/lib/enrollment-shared";

import {
  EnrollmentError,
  checkEligibility,
  holdsSeat,
  type ChildSelectionResult,
  type RegistrationProgram,
  type RegistrationStatus,
  type SubmissionOutcome,
} from "@/lib/enrollment-shared";

const PROGRAM_COLUMNS = `id, name, is_public, public_status, capacity, registration_mode,
    full_capacity_behavior, registration_deadline, registration_opens_at, reservation_enabled,
    reservation_hours, waitlist_mode, waitlist_offer_hours, grade_min, grade_max,
    start_date, schedule_timezone, reservations_paused, auto_offers_paused,
    operations_hold_reason`;

export async function loadRegistrationProgram(programId: string): Promise<RegistrationProgram | null> {
  const db = getDb();
  const row = (await db
    .prepare(`SELECT ${PROGRAM_COLUMNS} FROM programs WHERE id = ?`)
    .get(programId)) as RegistrationProgram | undefined;
  return row ?? null;
}

/* ===================================================================== */
/* Seat accounting                                                       */
/* ===================================================================== */

export interface SeatCounts {
  capacity: number | null;
  taken: number;
  remaining: number | null;
}

/**
 * Seats taken by a class, counting each child once.
 *
 * Both a `program_registrations` row holding a seat and a staff-created
 * `class_enrollments` row consume capacity, and a confirmed registration has
 * both. Counting distinct students across the union is what keeps one child
 * from being charged two seats.
 */
export async function seatCounts(classId: string, capacity: number | null): Promise<SeatCounts> {
  const db = getDb();
  const row = (await db
    .prepare(
      `SELECT COUNT(*) AS n FROM (
         SELECT ce.student_id
           FROM class_enrollments ce
           JOIN students s ON s.id = ce.student_id
          WHERE ce.class_id = ? AND ce.status = 'enrolled' AND s.enrollment_status = 'active'
          UNION
         SELECT r.student_id
           FROM program_registrations r
          WHERE r.class_id = ? AND r.holds_seat = true
       ) AS occupied`,
    )
    .get(classId, classId)) as { n: number | string };
  const taken = Number(row?.n ?? 0);
  return {
    capacity,
    taken,
    remaining: capacity == null ? null : Math.max(0, capacity - taken),
  };
}

export interface PrimaryClass {
  id: string;
  capacity: number | null;
}

/**
 * The class a public registration lands in. A program with several cohorts
 * still resolves to one default here; an admin moves the child afterwards
 * through class placement, which is the surface designed for that decision.
 */
export async function primaryClassFor(programId: string): Promise<PrimaryClass | null> {
  const db = getDb();
  const row = (await db
    .prepare(
      `SELECT id, capacity FROM classes
        WHERE program_id = ? AND status NOT IN ('completed', 'cancelled')
        ORDER BY created_at, id LIMIT 1`,
    )
    .get(programId)) as PrimaryClass | undefined;
  return row ?? null;
}

/**
 * Take the seat lock for a class. Must be called inside a transaction; every
 * seat decision for that class then serializes behind this row.
 */
async function lockClass(classId: string): Promise<{ id: string; capacity: number | null } | null> {
  const db = getDb();
  const row = (await db
    .prepare("SELECT id, capacity FROM classes WHERE id = ? FOR UPDATE")
    .get(classId)) as { id: string; capacity: number | null } | undefined;
  return row ?? null;
}

/* ===================================================================== */
/* Audit + notification                                                  */
/* ===================================================================== */

export interface AuditInput {
  registrationId?: string | null;
  studentId?: string | null;
  programId?: string | null;
  actorUserId?: string | null;
  actorLabel: string;
  action: string;
  previousState?: string | null;
  newState?: string | null;
  reason?: string | null;
}

export async function recordAudit(event: AuditInput): Promise<void> {
  const db = getDb();
  await db
    .prepare(
      `INSERT INTO registration_audit_events
         (id, registration_id, student_id, program_id, actor_user_id, actor_label,
          action, previous_state, new_state, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      `rae-${randomUUID().slice(0, 12)}`,
      event.registrationId ?? null,
      event.studentId ?? null,
      event.programId ?? null,
      event.actorUserId ?? null,
      event.actorLabel,
      event.action,
      event.previousState ?? null,
      event.newState ?? null,
      event.reason ?? null,
      Date.now(),
    );
}

/* ===================================================================== */
/* Waitlist eligibility                                                  */
/* ===================================================================== */

export type WaitlistEligibility = "eligible" | "ineligible" | "needs_review" | "staff_rejected";

/**
 * Set a waitlisted registration's eligibility and record why.
 *
 * Eligibility is orthogonal to status: this never moves a registration through
 * the lifecycle, and it never touches `holds_seat`. A waitlisted family holds
 * no seat regardless of eligibility, and an eligible/ineligible flip must not
 * be able to change that — which is exactly why it is a separate column rather
 * than more status values.
 *
 * "Locked" in the name means the caller may already hold the class lock; this
 * writes only to the registration and the event log, so it is safe inside one.
 */
export async function markWaitlistEligibilityLocked(options: {
  registrationId: string;
  programId: string;
  eligibility: WaitlistEligibility;
  reason: string | null;
  source: "system" | "staff";
  actorUserId: string | null;
  actorLabel: string;
  now?: number;
}): Promise<void> {
  const db = getDb();
  const now = options.now ?? Date.now();

  const current = (await db
    .prepare("SELECT waitlist_eligibility FROM program_registrations WHERE id = ?")
    .get(options.registrationId)) as { waitlist_eligibility: string | null } | undefined;
  const previous = current?.waitlist_eligibility ?? null;

  await db
    .prepare(
      `UPDATE program_registrations
          SET waitlist_eligibility = ?, waitlist_eligibility_reason = ?,
              waitlist_eligibility_checked_at = ?, updated_at = ?
        WHERE id = ?`,
    )
    .run(options.eligibility, options.reason, now, now, options.registrationId);

  // Only a real transition is worth an event row. Every refill pass re-checks
  // every skipped family, so logging unchanged results would bury the actual
  // changes under sweep noise within a day.
  if (previous === options.eligibility) return;

  await db
    .prepare(
      `INSERT INTO waitlist_eligibility_events
         (id, registration_id, program_id, previous_eligibility, new_eligibility,
          reason, source, actor_user_id, actor_label, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      `wle-${randomUUID().slice(0, 12)}`,
      options.registrationId,
      options.programId,
      previous,
      options.eligibility,
      options.reason,
      options.source,
      options.actorUserId,
      options.actorLabel,
      now,
    );
}

/**
 * Re-check every non-eligible waitlist entry for a program and restore the ones
 * that now qualify.
 *
 * Called when something that feeds eligibility changes (a grade correction, a
 * completed prerequisite, a widened grade band). `staff_rejected` is left
 * alone: it records a human decision, and a sweep must not silently overturn
 * one. `needs_review` is likewise left for a human.
 */
export async function reevaluateWaitlistEligibility(
  programId: string,
  actor: { userId?: string | null; label: string } = { label: "Automatic re-evaluation" },
  now = Date.now(),
): Promise<{ restored: number; stillIneligible: number }> {
  const db = getDb();
  const program = await loadRegistrationProgram(programId);
  if (!program) return { restored: 0, stillIneligible: 0 };

  const rows = (await db
    .prepare(
      `SELECT r.id, s.grade
         FROM program_registrations r
         JOIN students s ON s.id = r.student_id
        WHERE r.program_id = ? AND r.status = 'waitlisted'
          AND r.waitlist_eligibility = 'ineligible'`,
    )
    .all(programId)) as unknown as { id: string; grade: string | null }[];

  let restored = 0;
  let stillIneligible = 0;
  for (const row of rows) {
    const result = checkEligibility(program, row.grade);
    if (result.eligible) {
      await markWaitlistEligibilityLocked({
        registrationId: row.id,
        programId,
        eligibility: "eligible",
        reason: null,
        source: actor.userId ? "staff" : "system",
        actorUserId: actor.userId ?? null,
        actorLabel: actor.label,
        now,
      });
      restored += 1;
    } else {
      stillIneligible += 1;
    }
  }
  return { restored, stillIneligible };
}

export interface NotificationInput {
  personId?: string | null;
  studentId?: string | null;
  programId?: string | null;
  registrationId?: string | null;
  kind: string;
  title: string;
  body?: string | null;
  actionLabel?: string | null;
  actionHref?: string | null;
  urgency?: "normal" | "important" | "urgent";
  requiresAcknowledgment?: boolean;
}

/**
 * Records the dashboard notification. Email delivery is a separate concern
 * layered on top (app/actions/family-notifications.ts) so a mail failure can
 * never roll back or block the state change that caused it.
 */
export async function recordNotification(input: NotificationInput): Promise<string> {
  const db = getDb();
  const id = `fno-${randomUUID().slice(0, 12)}`;
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO family_notifications
         (id, person_id, student_id, program_id, registration_id, kind, title, body,
          action_label, action_href, urgency, requires_acknowledgment, email_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'not_sent', ?, ?)`,
    )
    .run(
      id,
      input.personId ?? null,
      input.studentId ?? null,
      input.programId ?? null,
      input.registrationId ?? null,
      input.kind,
      input.title,
      input.body ?? null,
      input.actionLabel ?? null,
      input.actionHref ?? null,
      input.urgency ?? "normal",
      input.requiresAcknowledgment ?? false,
      now,
      now,
    );
  return id;
}

/* ===================================================================== */
/* Requirements                                                          */
/* ===================================================================== */

export interface ProgramRequirementRow {
  id: string;
  program_id: string;
  kind: string;
  prompt: string;
  help_text: string | null;
  scope: "student" | "family";
  required: boolean;
  blocks_confirmation: boolean;
  staff_approval_required: boolean;
  visibility: string;
  choices: string | null;
  due_days_before_start: number | null;
  sort_order: number;
  active: boolean;
}

export async function activeRequirements(programId: string): Promise<ProgramRequirementRow[]> {
  const db = getDb();
  return (await db
    .prepare(
      `SELECT * FROM program_requirements
        WHERE program_id = ? AND active = true
        ORDER BY sort_order, created_at`,
    )
    .all(programId)) as unknown as ProgramRequirementRow[];
}

/**
 * Attach the program's active requirements to a registration. Idempotent so a
 * replayed submission or a re-run sweep never duplicates a family's to-do list.
 */
export async function instantiateRequirements(
  registrationId: string,
  requirements: ProgramRequirementRow[],
  programStartDate: string | null,
  now: number,
): Promise<void> {
  if (requirements.length === 0) return;
  const db = getDb();
  const startMs = programStartDate ? Date.parse(`${programStartDate}T00:00:00Z`) : NaN;
  for (const requirement of requirements) {
    const dueAt =
      requirement.due_days_before_start != null && Number.isFinite(startMs)
        ? startMs - requirement.due_days_before_start * 24 * 60 * 60 * 1000
        : null;
    await db
      .prepare(
        `INSERT INTO registration_requirements
           (id, registration_id, requirement_id, status, due_at, created_at, updated_at)
         VALUES (?, ?, ?, 'pending', ?, ?, ?)
         ON CONFLICT (registration_id, requirement_id) DO NOTHING`,
      )
      .run(`rrq-${randomUUID().slice(0, 12)}`, registrationId, requirement.id, dueAt, now, now);
  }
}

/** Requirements that must be satisfied before a reserved seat can confirm. */
export async function outstandingBlockingRequirements(registrationId: string): Promise<number> {
  const db = getDb();
  const row = (await db
    .prepare(
      `SELECT COUNT(*) AS n
         FROM registration_requirements rr
         JOIN program_requirements pr ON pr.id = rr.requirement_id
        WHERE rr.registration_id = ?
          AND pr.active = true
          AND pr.blocks_confirmation = true
          AND rr.status NOT IN ('approved', 'waived')`,
    )
    .get(registrationId)) as { n: number | string };
  return Number(row?.n ?? 0);
}

/* ===================================================================== */
/* Submission                                                            */
/* ===================================================================== */

/**
 * Decide and write one child's seat, with the class row already locked by the
 * caller. Returns the outcome for the family-facing result page.
 *
 * Ordering matters and is deliberate: an existing live registration wins over
 * everything (a refresh must never produce a second one), eligibility is
 * re-checked against the same data the seat decision uses, and only then is
 * capacity consumed.
 */
export async function decideSeat(options: {
  program: RegistrationProgram;
  primaryClass: PrimaryClass;
  studentId: string;
  studentName: string;
  grade: string | null;
  guardianPersonId: string;
  requestKey: string;
  payloadFingerprint: string;
  referralSource?: string | null;
  /**
   * Provenance only. An admin registering on a family's behalf runs this exact
   * function — same lock, same eligibility check, same capacity math, same
   * duplicate check, same requirement instantiation. Nothing below branches on
   * this to skip a check, and nothing may be added that does.
   */
  createdVia?: "family" | "admin" | "import";
  createdByUserId?: string | null;
  /**
   * Suppress the standard "here is what happened to your registration"
   * message. Only a caller that sends its own, more accurate message may set
   * this — today that is the program transfer, where the outcome the family
   * needs is "the move to the new program succeeded, and here is the resulting
   * status", not two separate messages about one event.
   *
   * This suppresses the announcement only. The registration, the audit event,
   * and the capacity write all still happen exactly as they otherwise would.
   */
  announce?: boolean;
  now: number;
}): Promise<ChildSelectionResult> {
  const db = getDb();
  const { program, primaryClass, studentId, studentName, grade, guardianPersonId, now } = options;

  const base = {
    studentId,
    studentName,
    programId: program.id,
    programName: program.name,
    reservationExpiresAt: null as number | null,
    blockingRequirements: 0,
  };

  const existing = (await db
    .prepare(
      `SELECT id, status, reservation_expires_at FROM program_registrations
        WHERE program_id = ? AND student_id = ?
          AND status NOT IN ('withdrawn', 'expired', 'declined', 'cancelled')
        LIMIT 1`,
    )
    .get(program.id, studentId)) as
    | { id: string; status: string; reservation_expires_at: number | null }
    | undefined;

  if (existing) {
    return {
      ...base,
      outcome: "already_registered",
      status: existing.status as RegistrationStatus,
      registrationId: existing.id,
      reservationExpiresAt: existing.reservation_expires_at,
      message: `${studentName} is already registered for ${program.name}. We kept the existing registration.`,
    };
  }

  const eligibility = checkEligibility(program, grade);
  if (!eligibility.eligible) {
    return {
      ...base,
      outcome: "ineligible",
      status: null,
      registrationId: null,
      message: eligibility.reason ?? `${studentName} is not eligible for ${program.name}.`,
    };
  }

  const counts = await seatCounts(primaryClass.id, primaryClass.capacity ?? program.capacity);
  const seatAvailable = counts.remaining == null || counts.remaining > 0;

  const requirements = await activeRequirements(program.id);
  const blocking = requirements.filter((r) => r.blocks_confirmation && r.active).length;

  let status: RegistrationStatus;
  let reservationExpiresAt: number | null = null;

  // The reservations brake. A paused program still records the registration —
  // turning a family away entirely would lose them — but it does not hand out a
  // seat while an operator is investigating a capacity problem. Review is the
  // honest holding state: it makes no promise the program may not be able to
  // keep, and an operator clears the queue explicitly once the hold is lifted.
  if (program.reservations_paused && seatAvailable) {
    status = "under_review";
  } else if (seatAvailable) {
    if (program.registration_mode === "approval") {
      status = "under_review";
    } else if (program.reservation_enabled && blocking > 0) {
      status = "seat_reserved";
      reservationExpiresAt = now + program.reservation_hours * 60 * 60 * 1000;
    } else {
      status = "confirmed";
    }
  } else if (program.waitlist_mode !== "disabled") {
    status = "waitlisted";
  } else if (program.full_capacity_behavior === "continue") {
    // An explicit overbooking policy: the program accepts past capacity.
    status = program.reservation_enabled && blocking > 0 ? "seat_reserved" : "confirmed";
    if (status === "seat_reserved") reservationExpiresAt = now + program.reservation_hours * 60 * 60 * 1000;
  } else {
    return {
      ...base,
      outcome: "unavailable",
      status: null,
      registrationId: null,
      message: `${program.name} is full and has no waitlist. ${studentName} was not registered.`,
    };
  }

  const registrationId = `preg-${randomUUID().slice(0, 16)}`;
  const seat = holdsSeat(status);
  const waitlistSeq =
    status === "waitlisted"
      ? Number(((await db.prepare("SELECT nextval('program_waitlist_seq') AS v").get()) as { v: string }).v)
      : null;

  await db
    .prepare(
      `INSERT INTO program_registrations
         (id, program_id, class_id, student_id, guardian_person_id, submitted_by_person_id, status,
          referral_source, request_key, payload_fingerprint, reservation_expires_at, waitlist_seq,
          holds_seat, confirmed_at, created_via, created_by_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      registrationId,
      program.id,
      status === "waitlisted" ? null : primaryClass.id,
      studentId,
      guardianPersonId,
      guardianPersonId,
      status,
      options.referralSource ?? null,
      options.requestKey,
      options.payloadFingerprint,
      reservationExpiresAt,
      waitlistSeq,
      seat,
      status === "confirmed" ? now : null,
      options.createdVia ?? "family",
      options.createdByUserId ?? null,
      now,
      now,
    );

  await instantiateRequirements(registrationId, requirements, program.start_date, now);

  if (status === "confirmed") {
    await enrollInClass(registrationId, primaryClass.id, studentId, now);
  }

  await recordAudit({
    registrationId,
    studentId,
    programId: program.id,
    actorUserId: options.createdByUserId ?? null,
    actorLabel:
      options.createdVia === "admin"
        ? "Admin registration on behalf of family"
        : options.createdVia === "import"
          ? "Imported registration"
          : "Family registration",
    action: "registration_submitted",
    newState: status,
    reason: program.reservations_paused ? "Reservations paused — held for review." : null,
  });

  // The acknowledgement. Every registration produces exactly one message
  // stating what actually happened, because the result page is not durable —
  // a parent who closes the tab has no other record that they registered.
  //
  // The four outcomes are worded separately on purpose. A reserved seat is the
  // one most easily got wrong: it is NOT a confirmation, it has a deadline, and
  // saying "you're in" to a family who then loses the seat is the exact failure
  // this wording exists to prevent.
  const announcement: Record<
    "confirmed" | "seat_reserved" | "under_review" | "waitlisted",
    { kind: string; title: string; body: string; urgency: "normal" | "important" | "urgent" }
  > = {
    confirmed: {
      kind: "registration_confirmed",
      title: `${studentName} has a place in ${program.name}`,
      body: "The registration is confirmed. We will send the schedule and joining details before the first session.",
      urgency: "normal",
    },
    seat_reserved: {
      kind: "seat_reserved",
      title: `A seat is being held for ${studentName}`,
      body:
        `This is not a confirmation yet. We are holding a seat in ${program.name} until the deadline below. ` +
        "Complete the outstanding requirements before then and the place is confirmed; if the deadline passes, the seat is released to the next family.",
      urgency: "urgent",
    },
    under_review: {
      kind: "registration_received",
      title: `We received the registration for ${studentName}`,
      body: `${program.name} reviews each registration before confirming a place. We will be in touch with the decision.`,
      urgency: "normal",
    },
    waitlisted: {
      kind: "registration_waitlisted",
      title: `${studentName} is on the waitlist for ${program.name}`,
      body:
        "The program is currently full, so we added this registration to the waitlist. " +
        "If a seat opens we will offer it to you and hold it while you respond.",
      urgency: "normal",
    },
  };

  const outcome: SubmissionOutcome =
    status === "confirmed"
      ? "confirmed"
      : status === "seat_reserved"
        ? "seat_reserved"
        : status === "under_review"
          ? "under_review"
          : "waitlisted";

  const message = announcement[outcome];
  if (options.announce !== false) {
    await recordNotification({
      personId: guardianPersonId,
      studentId,
      programId: program.id,
      registrationId,
      kind: message.kind,
      title: message.title,
      body: message.body,
      urgency: message.urgency,
      actionLabel: outcome === "seat_reserved" ? "Complete requirements" : "View registration",
      actionHref: "/family",
    });
  }

  return {
    ...base,
    outcome,
    status,
    registrationId,
    reservationExpiresAt,
    blockingRequirements: status === "seat_reserved" ? blocking : 0,
    message: outcomeMessage(outcome, studentName, program.name, reservationExpiresAt, blocking),
  };
}

function outcomeMessage(
  outcome: SubmissionOutcome,
  studentName: string,
  programName: string,
  reservationExpiresAt: number | null,
  blocking: number,
): string {
  switch (outcome) {
    case "confirmed":
      return `${studentName} is confirmed for ${programName}.`;
    case "seat_reserved": {
      const deadline = reservationExpiresAt
        ? new Date(reservationExpiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })
        : "the deadline";
      const forms = blocking === 1 ? "the required form" : `the ${blocking} required forms`;
      return `${studentName}'s seat is reserved through ${deadline}. Complete ${forms} to confirm it.`;
    }
    case "under_review":
      return `${studentName}'s registration for ${programName} is with our team for review. We'll email you the result.`;
    case "waitlisted":
      return `${programName} is full. ${studentName} is on the waitlist and we'll contact you if a seat opens.`;
    default:
      return `${studentName} — ${programName}.`;
  }
}

/** Create the class enrollment and roster rows a confirmed seat implies. */
export async function enrollInClass(
  registrationId: string,
  classId: string,
  studentId: string,
  now: number,
): Promise<void> {
  const db = getDb();
  const existing = (await db
    .prepare("SELECT id FROM class_enrollments WHERE class_id = ? AND student_id = ? AND status = 'enrolled'")
    .get(classId, studentId)) as { id: string } | undefined;
  const enrollmentId = existing?.id ?? `cen-${randomUUID().slice(0, 12)}`;
  if (!existing) {
    await db
      .prepare(
        `INSERT INTO class_enrollments
           (id, class_id, student_id, status, enrolled_at, confirmed_at, confirmation_source)
         VALUES (?, ?, ?, 'enrolled', ?, ?, 'registration')`,
      )
      .run(enrollmentId, classId, studentId, now, now);
  }
  await db
    .prepare(
      `INSERT INTO class_session_roster (id, session_id, student_id, enrollment_id, rostered_at)
       SELECT 'csr-' || replace(gen_random_uuid()::text, '-', ''), cs.id, ?, ?, ?
         FROM class_sessions cs
        WHERE cs.class_id = ? AND cs.session_date > ? AND cs.status <> 'cancelled'
          AND NOT EXISTS (
            SELECT 1 FROM class_session_roster csr
             WHERE csr.session_id = cs.id AND csr.student_id = ?
          )`,
    )
    .run(studentId, enrollmentId, now, classId, now, studentId);
  await db
    .prepare("UPDATE program_registrations SET class_id = ?, updated_at = ? WHERE id = ?")
    .run(classId, now, registrationId);
}

/** Release the class enrollment and future roster rows a seat implied. */
export async function releaseClassSeat(studentId: string, classId: string | null, now: number): Promise<void> {
  if (!classId) return;
  const db = getDb();
  await db
    .prepare(
      `UPDATE class_enrollments SET status = 'withdrawn', withdrawn_at = ?
        WHERE class_id = ? AND student_id = ? AND status = 'enrolled'`,
    )
    .run(now, classId, studentId);
  await db
    .prepare(
      `DELETE FROM class_session_roster
        WHERE student_id = ?
          AND session_id IN (SELECT id FROM class_sessions WHERE class_id = ? AND session_date > ?)`,
    )
    .run(studentId, classId, now);
}

/* ===================================================================== */
/* Transitions                                                           */
/* ===================================================================== */

export interface RegistrationRow {
  id: string;
  program_id: string;
  class_id: string | null;
  student_id: string;
  guardian_person_id: string | null;
  status: string;
  holds_seat: boolean;
  reservation_expires_at: number | null;
  waitlist_seq: number | null;
}

export async function loadRegistration(registrationId: string): Promise<RegistrationRow | null> {
  const db = getDb();
  const row = (await db
    .prepare(
      `SELECT id, program_id, class_id, student_id, guardian_person_id, status, holds_seat,
              reservation_expires_at, waitlist_seq
         FROM program_registrations WHERE id = ?`,
    )
    .get(registrationId)) as RegistrationRow | undefined;
  return row ?? null;
}

/**
 * Move a reserved seat to confirmed once nothing blocks it. Safe to call after
 * any requirement changes state; it does nothing when work remains, so callers
 * never need to duplicate the blocking check.
 */
export async function confirmIfReady(
  registrationId: string,
  actor: { userId?: string | null; label: string },
): Promise<{ confirmed: boolean; remaining: number }> {
  const db = getDb();
  const registration = await loadRegistration(registrationId);
  if (!registration) throw new EnrollmentError("Registration not found.", "not_found");
  if (registration.status === "confirmed") return { confirmed: true, remaining: 0 };
  if (!["seat_reserved", "requirements_pending", "offer_accepted"].includes(registration.status)) {
    return { confirmed: false, remaining: await outstandingBlockingRequirements(registrationId) };
  }

  const remaining = await outstandingBlockingRequirements(registrationId);
  if (remaining > 0) return { confirmed: false, remaining };

  const now = Date.now();
  await db
    .prepare(
      `UPDATE program_registrations
          SET status = 'confirmed', holds_seat = true, confirmed_at = ?,
              reservation_expires_at = NULL, updated_at = ?
        WHERE id = ?`,
    )
    .run(now, now, registrationId);

  if (registration.class_id) {
    await enrollInClass(registrationId, registration.class_id, registration.student_id, now);
  }

  await recordAudit({
    registrationId,
    studentId: registration.student_id,
    programId: registration.program_id,
    actorUserId: actor.userId ?? null,
    actorLabel: actor.label,
    action: "registration_confirmed",
    previousState: registration.status,
    newState: "confirmed",
  });

  await recordNotification({
    personId: registration.guardian_person_id,
    studentId: registration.student_id,
    programId: registration.program_id,
    registrationId,
    kind: "registration_confirmed",
    title: "Seat confirmed",
    body: "Everything required is complete and the seat is confirmed.",
    actionLabel: "View program",
    actionHref: "/family",
  });

  return { confirmed: true, remaining: 0 };
}

/**
 * Release a seat and set a terminal (or waitlisted) status. One place performs
 * every release so `holds_seat`, the class enrollment, and the roster can never
 * disagree about whether the seat is free.
 */
export async function releaseSeat(
  registrationId: string,
  nextStatus: "withdrawn" | "expired" | "declined" | "cancelled" | "waitlisted",
  actor: { userId?: string | null; label: string },
  reason?: string | null,
): Promise<void> {
  const db = getDb();
  const registration = await loadRegistration(registrationId);
  if (!registration) throw new EnrollmentError("Registration not found.", "not_found");
  const now = Date.now();

  const waitlistSeq =
    nextStatus === "waitlisted" && registration.waitlist_seq == null
      ? Number(((await db.prepare("SELECT nextval('program_waitlist_seq') AS v").get()) as { v: string }).v)
      : registration.waitlist_seq;

  await db
    .prepare(
      `UPDATE program_registrations
          SET status = ?, holds_seat = false, reservation_expires_at = NULL,
              waitlist_seq = ?, withdrawn_at = ?, decision_reason = COALESCE(?, decision_reason),
              decided_by_user_id = COALESCE(?, decided_by_user_id), decided_at = ?, updated_at = ?
        WHERE id = ?`,
    )
    .run(
      nextStatus,
      waitlistSeq,
      nextStatus === "withdrawn" ? now : null,
      reason ?? null,
      actor.userId ?? null,
      now,
      now,
      registrationId,
    );

  await releaseClassSeat(registration.student_id, registration.class_id, now);

  await recordAudit({
    registrationId,
    studentId: registration.student_id,
    programId: registration.program_id,
    actorUserId: actor.userId ?? null,
    actorLabel: actor.label,
    action: "seat_released",
    previousState: registration.status,
    newState: nextStatus,
    reason: reason ?? null,
  });
}

/* ===================================================================== */
/* Reservation expiry                                                    */
/* ===================================================================== */

export interface SweepResult {
  expired: number;
  offersExpired: number;
  offersCreated: number;
}

/**
 * Expire everything whose deadline has passed and refill the freed seats.
 *
 * Run from the reservation-expiry action and opportunistically when an admin
 * loads the enrollment surface, so a deployment without a scheduled job still
 * converges instead of leaving seats stranded behind dead reservations.
 */
export async function sweepExpirations(now = Date.now()): Promise<SweepResult> {
  const db = getDb();
  const result: SweepResult = { expired: 0, offersExpired: 0, offersCreated: 0 };

  const staleReservations = (await db
    .prepare(
      `SELECT id, program_id FROM program_registrations
        WHERE status IN ('seat_reserved', 'requirements_pending')
          AND reservation_expires_at IS NOT NULL
          AND reservation_expires_at < ?`,
    )
    .all(now)) as unknown as { id: string; program_id: string }[];

  for (const row of staleReservations) {
    const registration = await loadRegistration(row.id);
    if (!registration) continue;
    await releaseSeat(row.id, "expired", { label: "Reservation expiry" }, "Reservation deadline passed.");
    await recordNotification({
      personId: registration.guardian_person_id,
      studentId: registration.student_id,
      programId: registration.program_id,
      registrationId: row.id,
      kind: "reservation_expired",
      title: "Seat reservation expired",
      body: "The required steps weren't completed in time, so the seat was released. You can register again if seats remain.",
      urgency: "important",
      actionLabel: "See options",
      actionHref: "/family",
    });
    result.expired += 1;
  }

  const staleOffers = (await db
    .prepare("SELECT id, registration_id FROM waitlist_offers WHERE status = 'sent' AND expires_at < ?")
    .all(now)) as unknown as { id: string; registration_id: string }[];

  for (const offer of staleOffers) {
    await db
      .prepare("UPDATE waitlist_offers SET status = 'expired', responded_at = ?, updated_at = ? WHERE id = ?")
      .run(now, now, offer.id);
    const registration = await loadRegistration(offer.registration_id);
    if (registration && registration.status === "offer_sent") {
      // The family keeps its place in line rather than being dropped.
      await releaseSeat(offer.registration_id, "waitlisted", { label: "Offer expiry" }, "Waitlist offer expired.");
      await recordNotification({
        personId: registration.guardian_person_id,
        studentId: registration.student_id,
        programId: registration.program_id,
        registrationId: offer.registration_id,
        kind: "offer_expired",
        title: "Waitlist offer expired",
        body: "The offer window closed. You're still on the waitlist.",
        urgency: "important",
      });
    }
    result.offersExpired += 1;
  }

  const programsToRefill = new Set<string>([
    ...staleReservations.map((r) => r.program_id),
    ...(
      (await db
        .prepare(
          `SELECT DISTINCT program_id FROM program_registrations
            WHERE status = 'waitlisted' AND program_id IN (
              SELECT id FROM programs WHERE waitlist_mode = 'automatic'
            )`,
        )
        .all()) as unknown as { program_id: string }[]
    ).map((r) => r.program_id),
  ]);

  // Isolated per program: the sweep runs unattended across every program, so
  // one program's bad data must not stop the others from being refilled.
  for (const programId of programsToRefill) {
    try {
      result.offersCreated += await refillFromWaitlist(programId, now);
    } catch (error) {
      console.error(`[enrollment] waitlist refill failed for program ${programId}`, error);
    }
  }

  return result;
}

/**
 * Offer every free seat in an automatic-waitlist program to the next eligible
 * family. Each offer takes the seat before the next candidate is considered,
 * so two families can never be offered the same one.
 */
export async function refillFromWaitlist(programId: string, now = Date.now()): Promise<number> {
  const db = getDb();
  const program = await loadRegistrationProgram(programId);
  if (!program || program.waitlist_mode !== "automatic") return 0;
  // The emergency brake. Seats released while offers are paused simply stay
  // open until an operator lifts the hold — deliberately, because the reason to
  // pause is that something about the program is wrong, and handing a family a
  // seat in a program with a broken schedule is the outcome being prevented.
  if (program.auto_offers_paused) return 0;
  const primary = await primaryClassFor(programId);
  if (!primary) return 0;

  let created = 0;
  // Bounded so a data problem can never spin: a program cannot issue more
  // offers in one pass than it has waiting families.
  for (let guard = 0; guard < 500; guard += 1) {
    await db.exec("BEGIN");
    try {
      const locked = await lockClass(primary.id);
      if (!locked) {
        await db.exec("ROLLBACK");
        break;
      }
      const counts = await seatCounts(primary.id, locked.capacity ?? program.capacity);
      if (counts.remaining == null || counts.remaining <= 0) {
        await db.exec("ROLLBACK");
        break;
      }
      const next = (await db
        .prepare(
          `SELECT r.id, r.student_id, r.guardian_person_id, s.grade
             FROM program_registrations r
             JOIN students s ON s.id = r.student_id
            WHERE r.program_id = ? AND r.status = 'waitlisted'
              -- Only families the sweep may act on. 'ineligible',
              -- 'needs_review', and 'staff_rejected' entries keep their place
              -- in the queue and are simply not considered here.
              AND r.waitlist_eligibility = 'eligible'
              -- Defensive: the engine keeps status and offers consistent, but a
              -- row left inconsistent by a partial failure or a manual fix must
              -- be skipped rather than crash the sweep for every other program.
              AND NOT EXISTS (
                SELECT 1 FROM waitlist_offers o
                 WHERE o.registration_id = r.id AND o.status = 'sent'
              )
            ORDER BY r.waitlist_seq NULLS LAST, r.created_at
            LIMIT 1`,
        )
        .get(programId)) as
        | { id: string; student_id: string; guardian_person_id: string | null; grade: string | null }
        | undefined;
      if (!next) {
        await db.exec("ROLLBACK");
        break;
      }

      // A family that no longer satisfies the eligibility rules is skipped, not
      // terminated. Marking them 'declined' — as this did before — was wrong in
      // the way that matters most: 'declined' means *the family said no*, and it
      // is terminal, so a child who simply had the wrong grade on file was
      // permanently dropped from a queue they were entitled to stay in, with a
      // reason that blamed them for it.
      //
      // They keep status 'waitlisted' and their sequence, and become invisible
      // to this query via `waitlist_eligibility`. That is what stops the loop
      // spinning on them without ending their claim: fixing the underlying fact
      // and re-running eligibility puts them back in line where they were.
      const eligibility = checkEligibility(program, next.grade);
      if (!eligibility.eligible) {
        await markWaitlistEligibilityLocked({
          registrationId: next.id,
          programId,
          eligibility: "ineligible",
          reason: eligibility.reason ?? "No longer meets the program's eligibility rules.",
          source: "system",
          actorUserId: null,
          actorLabel: "Automatic waitlist sweep",
          now,
        });
        await db.exec("COMMIT");
        continue;
      }

      await createOfferLocked({
        registrationId: next.id,
        programId,
        classId: primary.id,
        studentId: next.student_id,
        guardianPersonId: next.guardian_person_id,
        offerHours: program.waitlist_offer_hours,
        mode: "automatic",
        createdByUserId: null,
        reason: null,
        now,
      });
      await db.exec("COMMIT");
      created += 1;
    } catch (error) {
      try {
        await db.exec("ROLLBACK");
      } catch {
        /* preserve the original error */
      }
      throw error;
    }
  }
  return created;
}

/**
 * Write the offer and take the seat. Caller must already hold the class lock;
 * taking the seat here is what makes double-offering impossible.
 */
async function createOfferLocked(options: {
  registrationId: string;
  programId: string;
  classId: string;
  studentId: string;
  guardianPersonId: string | null;
  offerHours: number;
  mode: "automatic" | "manual";
  createdByUserId: string | null;
  reason: string | null;
  now: number;
}): Promise<{ offerId: string; token: string; expiresAt: number }> {
  const db = getDb();
  const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const offerId = `wlo-${randomUUID().slice(0, 12)}`;
  const expiresAt = options.now + options.offerHours * 60 * 60 * 1000;

  await db
    .prepare(
      `INSERT INTO waitlist_offers
         (id, registration_id, program_id, class_id, status, mode, token_hash, expires_at,
          created_by_user_id, reason, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'sent', ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      offerId,
      options.registrationId,
      options.programId,
      options.classId,
      options.mode,
      tokenHash,
      expiresAt,
      options.createdByUserId,
      options.reason,
      options.now,
      options.now,
    );

  await db
    .prepare(
      `UPDATE program_registrations
          SET status = 'offer_sent', holds_seat = true, class_id = ?, updated_at = ?
        WHERE id = ?`,
    )
    .run(options.classId, options.now, options.registrationId);

  await recordAudit({
    registrationId: options.registrationId,
    studentId: options.studentId,
    programId: options.programId,
    actorUserId: options.createdByUserId,
    actorLabel: options.mode === "manual" ? "Admin waitlist offer" : "Automatic waitlist offer",
    action: "waitlist_offer_sent",
    previousState: "waitlisted",
    newState: "offer_sent",
    reason: options.reason,
  });

  await recordNotification({
    personId: options.guardianPersonId,
    studentId: options.studentId,
    programId: options.programId,
    registrationId: options.registrationId,
    kind: "waitlist_offer",
    title: "A seat is available",
    body: "A seat opened and is being held for you. Accept it before the offer expires.",
    urgency: "urgent",
    actionLabel: "Respond to offer",
    actionHref: `/family/offers/${offerId}`,
    requiresAcknowledgment: true,
  });

  return { offerId, token, expiresAt };
}

/** Admin-selected offer (manual waitlist mode). Takes the class lock itself. */
export async function sendManualOffer(
  registrationId: string,
  actor: { userId?: string | null; label: string },
  reason?: string | null,
): Promise<{ offerId: string; expiresAt: number }> {
  const db = getDb();
  const registration = await loadRegistration(registrationId);
  if (!registration) throw new EnrollmentError("Registration not found.", "not_found");
  if (registration.status !== "waitlisted") {
    throw new EnrollmentError("Only a waitlisted registration can be sent an offer.", "conflict");
  }
  const program = await loadRegistrationProgram(registration.program_id);
  if (!program) throw new EnrollmentError("Program not found.", "not_found");
  const primary = await primaryClassFor(registration.program_id);
  if (!primary) throw new EnrollmentError("This program has no class to place the student in.", "conflict");

  const now = Date.now();
  await db.exec("BEGIN");
  try {
    const locked = await lockClass(primary.id);
    if (!locked) throw new EnrollmentError("Class not found.", "not_found");
    const counts = await seatCounts(primary.id, locked.capacity ?? program.capacity);
    if (counts.remaining != null && counts.remaining <= 0) {
      throw new EnrollmentError("There is no free seat to offer right now.", "no_capacity");
    }
    const current = await loadRegistration(registrationId);
    if (!current || current.status !== "waitlisted") {
      throw new EnrollmentError("This registration changed while the page was open. Refresh before sending the offer.", "conflict");
    }
    const offer = await createOfferLocked({
      registrationId,
      programId: registration.program_id,
      classId: primary.id,
      studentId: registration.student_id,
      guardianPersonId: registration.guardian_person_id,
      offerHours: program.waitlist_offer_hours,
      mode: "manual",
      createdByUserId: actor.userId ?? null,
      reason: reason ?? null,
      now,
    });
    await db.exec("COMMIT");
    return { offerId: offer.offerId, expiresAt: offer.expiresAt };
  } catch (error) {
    try {
      await db.exec("ROLLBACK");
    } catch {
      /* preserve the original error */
    }
    throw error;
  }
}

export async function respondToOffer(
  offerId: string,
  response: "accept" | "decline",
  actor: { userId?: string | null; label: string },
): Promise<{ status: RegistrationStatus; blockingRequirements: number }> {
  const db = getDb();
  const now = Date.now();
  const offer = (await db
    .prepare("SELECT id, registration_id, program_id, class_id, status, expires_at FROM waitlist_offers WHERE id = ?")
    .get(offerId)) as
    | { id: string; registration_id: string; program_id: string; class_id: string | null; status: string; expires_at: number }
    | undefined;
  if (!offer) throw new EnrollmentError("That offer could not be found.", "not_found");
  if (offer.status !== "sent") {
    throw new EnrollmentError("This offer has already been answered.", "conflict");
  }
  if (offer.expires_at < now) {
    throw new EnrollmentError("This offer has expired.", "expired");
  }

  const registration = await loadRegistration(offer.registration_id);
  if (!registration) throw new EnrollmentError("Registration not found.", "not_found");

  if (response === "decline") {
    await db
      .prepare("UPDATE waitlist_offers SET status = 'declined', responded_at = ?, updated_at = ? WHERE id = ?")
      .run(now, now, offerId);
    await releaseSeat(offer.registration_id, "declined", actor, "Waitlist offer declined by family.");
    await refillFromWaitlist(offer.program_id, now);
    return { status: "declined", blockingRequirements: 0 };
  }

  const program = await loadRegistrationProgram(offer.program_id);
  const requirements = await activeRequirements(offer.program_id);
  await instantiateRequirements(offer.registration_id, requirements, program?.start_date ?? null, now);
  const blocking = await outstandingBlockingRequirements(offer.registration_id);

  await db
    .prepare("UPDATE waitlist_offers SET status = 'accepted', responded_at = ?, updated_at = ? WHERE id = ?")
    .run(now, now, offerId);

  // The seat is already held by the offer, so acceptance never re-checks
  // capacity — it only decides whether requirements still gate confirmation.
  if (blocking > 0 && program?.reservation_enabled) {
    const expiresAt = now + program.reservation_hours * 60 * 60 * 1000;
    await db
      .prepare(
        `UPDATE program_registrations
            SET status = 'seat_reserved', holds_seat = true, reservation_expires_at = ?, updated_at = ?
          WHERE id = ?`,
      )
      .run(expiresAt, now, offer.registration_id);
    await recordAudit({
      registrationId: offer.registration_id,
      studentId: registration.student_id,
      programId: offer.program_id,
      actorUserId: actor.userId ?? null,
      actorLabel: actor.label,
      action: "waitlist_offer_accepted",
      previousState: "offer_sent",
      newState: "seat_reserved",
    });
    return { status: "seat_reserved", blockingRequirements: blocking };
  }

  await db
    .prepare(
      `UPDATE program_registrations
          SET status = 'confirmed', holds_seat = true, confirmed_at = ?,
              reservation_expires_at = NULL, updated_at = ?
        WHERE id = ?`,
    )
    .run(now, now, offer.registration_id);
  if (offer.class_id) {
    await enrollInClass(offer.registration_id, offer.class_id, registration.student_id, now);
  }
  await recordAudit({
    registrationId: offer.registration_id,
    studentId: registration.student_id,
    programId: offer.program_id,
    actorUserId: actor.userId ?? null,
    actorLabel: actor.label,
    action: "waitlist_offer_accepted",
    previousState: "offer_sent",
    newState: "confirmed",
  });
  return { status: "confirmed", blockingRequirements: 0 };
}

/* ===================================================================== */
/* Admin seat operations                                                 */
/* ===================================================================== */

/** Extend a live reservation. Never revives an already-expired one. */
export async function extendReservation(
  registrationId: string,
  additionalHours: number,
  actor: { userId?: string | null; label: string },
  reason?: string | null,
): Promise<number> {
  const db = getDb();
  const registration = await loadRegistration(registrationId);
  if (!registration) throw new EnrollmentError("Registration not found.", "not_found");
  if (!["seat_reserved", "requirements_pending"].includes(registration.status)) {
    throw new EnrollmentError("Only a reserved seat has a deadline to extend.", "conflict");
  }
  if (!Number.isFinite(additionalHours) || additionalHours <= 0 || additionalHours > 24 * 60) {
    throw new EnrollmentError("Choose an extension between 1 and 1440 hours.", "invalid");
  }
  const now = Date.now();
  const base = Math.max(registration.reservation_expires_at ?? now, now);
  const expiresAt = base + additionalHours * 60 * 60 * 1000;
  await db
    .prepare(
      `UPDATE program_registrations
          SET reservation_expires_at = ?, reservation_extended_count = reservation_extended_count + 1, updated_at = ?
        WHERE id = ?`,
    )
    .run(expiresAt, now, registrationId);
  await recordAudit({
    registrationId,
    studentId: registration.student_id,
    programId: registration.program_id,
    actorUserId: actor.userId ?? null,
    actorLabel: actor.label,
    action: "reservation_extended",
    previousState: String(registration.reservation_expires_at ?? ""),
    newState: String(expiresAt),
    reason: reason ?? null,
  });
  await recordNotification({
    personId: registration.guardian_person_id,
    studentId: registration.student_id,
    programId: registration.program_id,
    registrationId,
    kind: "reservation_extended",
    title: "Reservation deadline extended",
    body: "We extended the deadline to complete the remaining steps.",
  });
  return expiresAt;
}

/**
 * Place or move a student between classes without ever leaving them enrolled
 * in neither. The new seat is taken under lock before the old one is released.
 */
export async function placeInClass(
  registrationId: string,
  targetClassId: string,
  actor: { userId?: string | null; label: string },
  reason?: string | null,
): Promise<void> {
  const db = getDb();
  const registration = await loadRegistration(registrationId);
  if (!registration) throw new EnrollmentError("Registration not found.", "not_found");
  if (registration.class_id === targetClassId) return;
  const now = Date.now();

  await db.exec("BEGIN");
  try {
    const locked = await lockClass(targetClassId);
    if (!locked) throw new EnrollmentError("That class no longer exists.", "not_found");
    const target = (await db.prepare("SELECT program_id FROM classes WHERE id = ?").get(targetClassId)) as
      | { program_id: string | null }
      | undefined;
    if (!target || target.program_id !== registration.program_id) {
      throw new EnrollmentError("That class belongs to a different program.", "invalid");
    }
    const counts = await seatCounts(targetClassId, locked.capacity);
    if (registration.holds_seat && counts.remaining != null && counts.remaining <= 0) {
      throw new EnrollmentError("That class is full. Free a seat or choose another class.", "no_capacity");
    }

    const previousClassId = registration.class_id;
    if (registration.holds_seat) {
      await enrollInClass(registrationId, targetClassId, registration.student_id, now);
      await releaseClassSeat(registration.student_id, previousClassId, now);
    }
    await db
      .prepare("UPDATE program_registrations SET class_id = ?, updated_at = ? WHERE id = ?")
      .run(targetClassId, now, registrationId);

    await recordAudit({
      registrationId,
      studentId: registration.student_id,
      programId: registration.program_id,
      actorUserId: actor.userId ?? null,
      actorLabel: actor.label,
      action: previousClassId ? "class_transfer" : "class_placement",
      previousState: previousClassId,
      newState: targetClassId,
      reason: reason ?? null,
    });
    await db.exec("COMMIT");
  } catch (error) {
    try {
      await db.exec("ROLLBACK");
    } catch {
      /* preserve the original error */
    }
    throw error;
  }

  await recordNotification({
    personId: registration.guardian_person_id,
    studentId: registration.student_id,
    programId: registration.program_id,
    registrationId,
    kind: "class_placement",
    title: "Class placement updated",
    body: "The class assignment for this program changed. Check the schedule for the new times.",
    urgency: "important",
    requiresAcknowledgment: true,
  });
}
