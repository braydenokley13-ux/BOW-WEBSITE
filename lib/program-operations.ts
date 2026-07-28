/* ============================================================
 * Program operations — the consequential admin actions that are not part of
 * one family's registration journey.
 *
 * Three groups:
 *
 *   1. Emergency controls. Brakes an operator pulls when something about a
 *      program is wrong: stop new registrations, stop new seats being taken,
 *      stop automatic waitlist offers. Each is a brake on *new* work and never
 *      rewrites an existing registration — a family that already holds a seat
 *      keeps it, because retroactively editing families is exactly the kind of
 *      manual repair this system exists to remove.
 *
 *   2. Registration restoration. Bringing a terminal registration back, but
 *      only when doing so is genuinely safe.
 *
 *   3. Duplicate-child review. Recording a human decision about two records
 *      that might be the same child.
 *
 * Every function here writes an audit event. Server-only, not "use server":
 * the callable actions live in app/actions and do the permission check.
 * ============================================================ */

import "server-only";

import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import {
  decideSeat,
  holdsSeat,
  isTerminal,
  loadRegistrationProgram,
  primaryClassFor,
  recordAudit,
  recordNotification,
  registrationLabel,
  releaseClassSeat,
  seatCounts,
  type RegistrationStatus,
} from "@/lib/enrollment";

export interface Actor {
  userId: string | null;
  label: string;
}

/* ===================================================================== */
/* Program audit                                                         */
/* ===================================================================== */

/**
 * Audit for an action whose target is the program itself.
 *
 * `registration_audit_events` is keyed to a registration and cannot express
 * "registration was closed" or "the program was cancelled". `affected_count`
 * is recorded at the time of the action because the affected rows move on —
 * six months later the audit row is the only thing that still knows how many
 * families a cancellation touched.
 */
export async function recordProgramAudit(event: {
  programId: string;
  actor: Actor;
  action: string;
  previousState?: string | null;
  newState?: string | null;
  reason?: string | null;
  affectedCount?: number | null;
}): Promise<void> {
  const db = getDb();
  await db
    .prepare(
      `INSERT INTO program_audit_events
         (id, program_id, actor_user_id, actor_label, action, previous_state, new_state,
          reason, affected_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      `pae-${randomUUID().slice(0, 12)}`,
      event.programId,
      event.actor.userId,
      event.actor.label,
      event.action,
      event.previousState ?? null,
      event.newState ?? null,
      event.reason ?? null,
      event.affectedCount ?? null,
      Date.now(),
    );
}

/* ===================================================================== */
/* Emergency controls                                                    */
/* ===================================================================== */

export interface OperationalHoldResult {
  ok: boolean;
  error?: string;
  /** Families holding a seat right now — the blast radius of the hold. */
  affected?: number;
}

/**
 * How many families a control change would touch. Shown in the confirmation
 * dialog *before* the action, because "pause this program" means something
 * very different at 0 registrations than at 40.
 */
export async function holdImpact(programId: string): Promise<{
  seatHolders: number;
  waitlisted: number;
  openOffers: number;
  reserved: number;
}> {
  const db = getDb();
  const row = (await db
    .prepare(
      `SELECT
         COUNT(*) FILTER (WHERE holds_seat = true) AS seat_holders,
         COUNT(*) FILTER (WHERE status = 'waitlisted') AS waitlisted,
         COUNT(*) FILTER (WHERE status = 'offer_sent') AS open_offers,
         COUNT(*) FILTER (WHERE status = 'seat_reserved') AS reserved
       FROM program_registrations WHERE program_id = ?`,
    )
    .get(programId)) as
    | { seat_holders: string; waitlisted: string; open_offers: string; reserved: string }
    | undefined;
  return {
    seatHolders: Number(row?.seat_holders ?? 0),
    waitlisted: Number(row?.waitlisted ?? 0),
    openOffers: Number(row?.open_offers ?? 0),
    reserved: Number(row?.reserved ?? 0),
  };
}

/**
 * Set or lift the operational brakes on a program.
 *
 * Deliberately does not touch a single registration. Closing registration
 * stops families arriving; pausing reservations stops seats being handed out;
 * pausing automatic offers stops the refill sweep. A caller that wants to also
 * cancel the program does that explicitly through `cancelProgram`, so
 * "pause while we work out what happened" can never accidentally become
 * "cancel everyone".
 */
export async function setProgramHold(
  programId: string,
  changes: {
    /**
     * Whether families may still reach the registration form. Expressed
     * through the existing `public_status` column rather than a new boolean —
     * `public_status` is already what every public surface reads to decide
     * whether a program is open, and a second flag saying the same thing is
     * how two sources of truth start disagreeing.
     */
    registrationOpen?: boolean;
    reservationsPaused?: boolean;
    autoOffersPaused?: boolean;
  },
  actor: Actor,
  reason: string,
): Promise<OperationalHoldResult> {
  const db = getDb();
  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    return { ok: false, error: "Record why this hold is being applied." };
  }

  const current = (await db
    .prepare(
      `SELECT public_status, reservations_paused, auto_offers_paused
         FROM programs WHERE id = ?`,
    )
    .get(programId)) as
    | { public_status: string | null; reservations_paused: boolean; auto_offers_paused: boolean }
    | undefined;
  if (!current) return { ok: false, error: "Program not found." };

  const currentlyOpen = current.public_status === "open";
  const nextOpen = changes.registrationOpen ?? currentlyOpen;
  const next = {
    registrationOpen: nextOpen,
    reservationsPaused: changes.reservationsPaused ?? current.reservations_paused,
    autoOffersPaused: changes.autoOffersPaused ?? current.auto_offers_paused,
  };

  // Reopening only ever restores 'open'. Closing writes 'closed' and leaves
  // 'coming_soon' alone, so an unlaunched program is not accidentally
  // advertised as closed when an operator pauses something else about it.
  let nextStatus = current.public_status;
  if (changes.registrationOpen === false && current.public_status === "open") nextStatus = "closed";
  if (changes.registrationOpen === true) nextStatus = "open";

  const anyHold = !next.registrationOpen || next.reservationsPaused || next.autoOffersPaused;
  const now = Date.now();
  const impact = await holdImpact(programId);

  await db
    .prepare(
      `UPDATE programs
          SET public_status = ?, reservations_paused = ?, auto_offers_paused = ?,
              operations_hold_reason = ?, operations_hold_set_at = ?, operations_hold_set_by = ?,
              updated_at = ?
        WHERE id = ?`,
    )
    .run(
      nextStatus,
      next.reservationsPaused,
      next.autoOffersPaused,
      anyHold ? trimmedReason : null,
      anyHold ? now : null,
      anyHold ? actor.userId : null,
      now,
      programId,
    );

  const describe = (s: { registrationOpen: boolean; reservationsPaused: boolean; autoOffersPaused: boolean }) =>
    [
      s.registrationOpen ? "registration open" : "registration closed",
      s.reservationsPaused ? "reservations paused" : "reservations active",
      s.autoOffersPaused ? "auto offers paused" : "auto offers active",
    ].join(", ");

  await recordProgramAudit({
    programId,
    actor,
    action: "operational_hold_changed",
    previousState: describe({
      registrationOpen: currentlyOpen,
      reservationsPaused: current.reservations_paused,
      autoOffersPaused: current.auto_offers_paused,
    }),
    newState: describe(next),
    reason: trimmedReason,
    affectedCount: impact.seatHolders,
  });

  return { ok: true, affected: impact.seatHolders };
}

/* ===================================================================== */
/* Registration restoration                                              */
/* ===================================================================== */

const RESTORABLE: ReadonlySet<string> = new Set(["withdrawn", "expired", "declined", "cancelled"]);

export interface RestoreCheck {
  eligible: boolean;
  /** Why not, in words an admin can act on. */
  reason?: string;
  seatAvailable: boolean;
  /** What the registration would become. */
  targetStatus: RegistrationStatus | null;
}

/**
 * Can this registration be restored, and to what?
 *
 * Split from the mutation so a dialog can show the honest consequence before
 * anyone commits — including the case where restoring is possible but only
 * onto the waitlist because the seat is gone.
 */
export async function checkRestorable(registrationId: string): Promise<RestoreCheck> {
  const db = getDb();
  const reg = (await db
    .prepare(
      `SELECT id, program_id, student_id, status FROM program_registrations WHERE id = ?`,
    )
    .get(registrationId)) as
    | { id: string; program_id: string; student_id: string; status: string }
    | undefined;

  const none = { eligible: false, seatAvailable: false, targetStatus: null as RegistrationStatus | null };
  if (!reg) return { ...none, reason: "Registration not found." };
  if (!RESTORABLE.has(reg.status)) {
    return { ...none, reason: `A ${reg.status.replace(/_/g, " ")} registration is already live.` };
  }

  // The one-live-registration constraint is the real gate: if the family
  // registered again after this record ended, restoring it would collide, and
  // the newer record is the one that reflects what the family actually wants.
  const live = (await db
    .prepare(
      `SELECT id FROM program_registrations
        WHERE program_id = ? AND student_id = ? AND id <> ?
          AND status NOT IN ('withdrawn', 'expired', 'declined', 'cancelled')
        LIMIT 1`,
    )
    .get(reg.program_id, reg.student_id, reg.id)) as { id: string } | undefined;
  if (live) {
    return { ...none, reason: "This child already has a live registration for the program." };
  }

  const program = await loadRegistrationProgram(reg.program_id);
  if (!program) return { ...none, reason: "Program not found." };
  const primary = await primaryClassFor(reg.program_id);
  if (!primary) return { ...none, reason: "The program has no class to restore into." };

  const counts = await seatCounts(primary.id, primary.capacity ?? program.capacity);
  const seatAvailable = counts.remaining == null || counts.remaining > 0;

  if (!seatAvailable && program.waitlist_mode === "disabled") {
    return {
      ...none,
      reason: "The program is full and has no waitlist, so there is nothing to restore into.",
    };
  }

  return {
    eligible: true,
    seatAvailable,
    // Restoring never skips the queue. No seat means the waitlist, the same as
    // any other family arriving at a full program.
    targetStatus: seatAvailable ? "under_review" : "waitlisted",
  };
}

/**
 * Restore a terminal registration.
 *
 * Runs under the class lock and re-checks capacity inside the transaction: the
 * `checkRestorable` result an admin saw may be seconds old, and a seat can be
 * taken in between. Restoring lands on `under_review` rather than straight to
 * confirmed so a human still sees the record before the family is told they
 * have a place.
 */
export async function restoreRegistration(
  registrationId: string,
  actor: Actor,
  reason: string,
): Promise<{ ok: boolean; error?: string; status?: RegistrationStatus }> {
  const db = getDb();
  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "Record why this registration is being restored." };

  const precheck = await checkRestorable(registrationId);
  if (!precheck.eligible) return { ok: false, error: precheck.reason ?? "This registration cannot be restored." };

  const reg = (await db
    .prepare(
      `SELECT id, program_id, student_id, guardian_person_id, status
         FROM program_registrations WHERE id = ?`,
    )
    .get(registrationId)) as
    | {
        id: string;
        program_id: string;
        student_id: string;
        guardian_person_id: string | null;
        status: string;
      }
    | undefined;
  if (!reg) return { ok: false, error: "Registration not found." };

  const program = await loadRegistrationProgram(reg.program_id);
  const primary = await primaryClassFor(reg.program_id);
  if (!program || !primary) return { ok: false, error: "Program is not set up to accept registrations." };

  const now = Date.now();
  await db.exec("BEGIN");
  try {
    const locked = (await db
      .prepare("SELECT id, capacity FROM classes WHERE id = ? FOR UPDATE")
      .get(primary.id)) as { id: string; capacity: number | null } | undefined;
    if (!locked) {
      await db.exec("ROLLBACK");
      return { ok: false, error: "The program's class is no longer available." };
    }

    const counts = await seatCounts(locked.id, locked.capacity ?? program.capacity);
    const seatAvailable = counts.remaining == null || counts.remaining > 0;
    if (!seatAvailable && program.waitlist_mode === "disabled") {
      await db.exec("ROLLBACK");
      return { ok: false, error: "The last seat was taken and the program has no waitlist." };
    }

    const status: RegistrationStatus = seatAvailable ? "under_review" : "waitlisted";
    const waitlistSeq =
      status === "waitlisted"
        ? Number(((await db.prepare("SELECT nextval('program_waitlist_seq') AS v").get()) as { v: string }).v)
        : null;

    await db
      .prepare(
        `UPDATE program_registrations
            SET status = ?, holds_seat = ?, class_id = ?, waitlist_seq = ?,
                waitlist_eligibility = 'eligible', waitlist_eligibility_reason = NULL,
                restored_at = ?, restored_from_status = ?,
                withdrawn_at = NULL, decision_reason = ?, decided_by_user_id = ?, decided_at = ?,
                updated_at = ?
          WHERE id = ?`,
      )
      .run(
        status,
        holdsSeat(status),
        status === "waitlisted" ? null : locked.id,
        waitlistSeq,
        now,
        reg.status,
        trimmed,
        actor.userId,
        now,
        now,
        registrationId,
      );

    await db.exec("COMMIT");

    await recordAudit({
      registrationId,
      studentId: reg.student_id,
      programId: reg.program_id,
      actorUserId: actor.userId,
      actorLabel: actor.label,
      action: "registration_restored",
      previousState: reg.status,
      newState: status,
      reason: trimmed,
    });

    await recordNotification({
      personId: reg.guardian_person_id,
      studentId: reg.student_id,
      programId: reg.program_id,
      registrationId,
      kind: status === "waitlisted" ? "registration_waitlisted" : "registration_received",
      title: status === "waitlisted" ? "Back on the waitlist" : "Registration reopened",
      body:
        status === "waitlisted"
          ? "We reopened this registration. The program is currently full, so it is on the waitlist."
          : "We reopened this registration. We will confirm the place shortly.",
      urgency: "important",
    });

    return { ok: true, status };
  } catch (error) {
    try {
      await db.exec("ROLLBACK");
    } catch {
      /* preserve the original error */
    }
    throw error;
  }
}

/* ===================================================================== */
/* Duplicate-child review                                                */
/* ===================================================================== */

/** Ordered pair, so the same two children cannot produce two review rows. */
function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/**
 * Raise a possible-duplicate pair for human review.
 *
 * Idempotent on the pair, and deliberately will not reopen a pair a human has
 * already resolved: a detector that re-raises "these are the same child" every
 * night after staff decided they are twins trains people to ignore the queue.
 */
export async function flagPossibleDuplicate(
  studentIdA: string,
  studentIdB: string,
  detectedReason: string,
): Promise<string | null> {
  if (studentIdA === studentIdB) return null;
  const db = getDb();
  const [low, high] = orderPair(studentIdA, studentIdB);
  const now = Date.now();

  const existing = (await db
    .prepare("SELECT id, status FROM student_duplicate_reviews WHERE student_id = ? AND other_student_id = ?")
    .get(low, high)) as { id: string; status: string } | undefined;
  if (existing) return existing.status === "open" || existing.status === "deferred" ? existing.id : null;

  const id = `sdr-${randomUUID().slice(0, 12)}`;
  await db
    .prepare(
      `INSERT INTO student_duplicate_reviews
         (id, student_id, other_student_id, status, detected_reason, created_at, updated_at)
       VALUES (?, ?, ?, 'open', ?, ?, ?)`,
    )
    .run(id, low, high, detectedReason, now, now);

  await db
    .prepare("UPDATE students SET duplicate_review_status = 'open', updated_at = ? WHERE id IN (?, ?)")
    .run(now, low, high);

  return id;
}

export interface MergeSafety {
  safe: boolean;
  /** Every conflict a human must resolve before a merge is allowed. */
  conflicts: string[];
}

/**
 * Is merging these two children safe to do automatically?
 *
 * For launch the bar is deliberately high and the answer is usually no. A
 * merge moves a child's whole history onto another record; getting it wrong
 * means a family's registrations, requirements, and attendance attach to the
 * wrong human. Anything ambiguous stops and asks for manual review rather than
 * guessing — the cost of a deferred merge is a duplicate row, and the cost of a
 * wrong merge is a corrupted child record.
 */
export async function checkMergeSafety(studentIdA: string, studentIdB: string): Promise<MergeSafety> {
  const db = getDb();
  const conflicts: string[] = [];

  const rows = (await db
    .prepare("SELECT id, name, grade, school FROM students WHERE id IN (?, ?)")
    .all(studentIdA, studentIdB)) as unknown as {
    id: string;
    name: string;
    grade: string | null;
    school: string | null;
  }[];
  if (rows.length !== 2) return { safe: false, conflicts: ["One of the records no longer exists."] };

  const [a, b] = rows;
  if (a.grade && b.grade && a.grade !== b.grade) {
    conflicts.push(`Grades differ (${a.grade} vs ${b.grade}).`);
  }
  if (a.school && b.school && a.school.trim().toLowerCase() !== b.school.trim().toLowerCase()) {
    conflicts.push(`Schools differ (${a.school} vs ${b.school}).`);
  }

  // Both registered for the same program is the decisive signal that these are
  // two different children: one child cannot hold two live registrations for
  // one program, so the pair existing at all means they are not the same child
  // — or that a merge would violate the one-live-registration constraint.
  const overlap = (await db
    .prepare(
      `SELECT p.name AS program_name
         FROM program_registrations r1
         JOIN program_registrations r2
           ON r2.program_id = r1.program_id AND r2.student_id = ?
         JOIN programs p ON p.id = r1.program_id
        WHERE r1.student_id = ?
          AND r1.status NOT IN ('withdrawn', 'expired', 'declined', 'cancelled')
          AND r2.status NOT IN ('withdrawn', 'expired', 'declined', 'cancelled')
        LIMIT 5`,
    )
    .all(studentIdB, studentIdA)) as unknown as { program_name: string }[];
  for (const row of overlap) {
    conflicts.push(`Both records hold a live registration for ${row.program_name}.`);
  }

  return { safe: conflicts.length === 0, conflicts };
}

/**
 * Record a human decision about a possible-duplicate pair.
 *
 * `distinct` is permanent and is what stops the detector re-raising the pair.
 * `merged` is refused outright unless `checkMergeSafety` is clean — the review
 * queue is allowed to say "a human must do this by hand", and for launch that
 * is the correct answer whenever anything conflicts.
 */
export async function resolveDuplicateReview(
  reviewId: string,
  decision: "distinct" | "merged" | "deferred",
  actor: Actor,
  options: { canonicalStudentId?: string | null; note?: string | null } = {},
): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  const now = Date.now();

  const review = (await db
    .prepare("SELECT id, student_id, other_student_id, status FROM student_duplicate_reviews WHERE id = ?")
    .get(reviewId)) as
    | { id: string; student_id: string; other_student_id: string; status: string }
    | undefined;
  if (!review) return { ok: false, error: "Review not found." };
  if (review.status === "merged" || review.status === "distinct") {
    return { ok: false, error: "This review has already been resolved." };
  }

  let canonical: string | null = null;
  if (decision === "merged") {
    canonical = options.canonicalStudentId ?? null;
    if (canonical !== review.student_id && canonical !== review.other_student_id) {
      return { ok: false, error: "Choose which record is the canonical child." };
    }
    const safety = await checkMergeSafety(review.student_id, review.other_student_id);
    if (!safety.safe) {
      return {
        ok: false,
        error: `These records cannot be merged automatically: ${safety.conflicts.join(" ")} Resolve them by hand.`,
      };
    }
  }

  const duplicate =
    canonical === null ? null : canonical === review.student_id ? review.other_student_id : review.student_id;

  await db.exec("BEGIN");
  try {
    await db
      .prepare(
        `UPDATE student_duplicate_reviews
            SET status = ?, canonical_student_id = ?, resolution_note = ?,
                resolved_by_user_id = ?, resolved_at = ?, updated_at = ?
          WHERE id = ?`,
      )
      .run(decision, canonical, options.note ?? null, actor.userId, now, now, reviewId);

    if (decision === "merged" && canonical && duplicate) {
      // Move the surviving history, then tombstone. `merged_into_student_id` is
      // what lets a later reader follow a stale id to the real child instead of
      // finding nothing.
      await db
        .prepare("UPDATE program_registrations SET student_id = ?, updated_at = ? WHERE student_id = ?")
        .run(canonical, now, duplicate);
      await db
        .prepare(
          `UPDATE student_guardians SET student_id = ?
            WHERE student_id = ?
              AND person_id NOT IN (SELECT person_id FROM student_guardians WHERE student_id = ?)`,
        )
        .run(canonical, duplicate, canonical);
      await db.prepare("DELETE FROM student_guardians WHERE student_id = ?").run(duplicate);
      await db
        .prepare(
          `UPDATE students
              SET merged_into_student_id = ?, duplicate_review_status = 'merged', updated_at = ?
            WHERE id = ?`,
        )
        .run(canonical, now, duplicate);
      // The surviving child is not 'merged' (it absorbed, it was not absorbed)
      // and not 'distinct' (that is a statement about a pair). It is simply no
      // longer under review, which is what NULL means here.
      await db
        .prepare("UPDATE students SET duplicate_review_status = NULL, updated_at = ? WHERE id = ?")
        .run(now, canonical);
    } else if (decision === "distinct") {
      await db
        .prepare(
          "UPDATE students SET duplicate_review_status = 'distinct', updated_at = ? WHERE id IN (?, ?)",
        )
        .run(now, review.student_id, review.other_student_id);
    }

    await db.exec("COMMIT");
  } catch (error) {
    try {
      await db.exec("ROLLBACK");
    } catch {
      /* preserve the original error */
    }
    throw error;
  }

  await recordAudit({
    studentId: canonical ?? review.student_id,
    actorUserId: actor.userId,
    actorLabel: actor.label,
    action: "duplicate_review_resolved",
    previousState: "open",
    newState: decision,
    reason: options.note ?? null,
  });

  return { ok: true };
}

/* ===================================================================== */
/* Cross-program transfer                                                */
/* ===================================================================== */

export interface TransferResult {
  ok: boolean;
  error?: string;
  /** The registration created in the destination program. */
  registrationId?: string;
  status?: RegistrationStatus;
}

/**
 * Move a child from one program to another as a single atomic step.
 *
 * The failure this exists to prevent is a child in *neither* program. Doing
 * the move by hand — withdraw here, register there — has a window between the
 * two writes where the seat has been given up and the new one has not been
 * secured, and if the second half fails (the destination filled up in the
 * meantime, the child turns out to be ineligible for it) the family is left
 * with nothing and an operator has to notice and repair it.
 *
 * So the order here is deliberately the opposite of the manual one: the new
 * placement is taken FIRST, inside the transaction, and the original is only
 * released once the replacement is known to exist. Any outcome that does not
 * produce a real placement in the destination — ineligible, full with no
 * waitlist, already registered there — rolls the whole thing back and leaves
 * the original placement exactly as it was.
 *
 * The destination seat is decided by `decideSeat`, the same function a family
 * registration goes through: same class lock, same eligibility check, same
 * capacity arithmetic, same duplicate check, same requirement instantiation.
 * A transfer is therefore not a way into a full program, and cannot become
 * one — there is no capacity code here to drift from the real thing.
 */
export async function transferProgram(
  registrationId: string,
  targetProgramId: string,
  actor: Actor,
  reason: string,
): Promise<TransferResult> {
  const db = getDb();
  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "Record why this child is being transferred." };

  const source = (await db
    .prepare(
      `SELECT r.id, r.program_id, r.class_id, r.student_id, r.guardian_person_id, r.status,
              r.holds_seat, s.name AS student_name, s.grade AS grade, p.name AS program_name
         FROM program_registrations r
         JOIN students s ON s.id = r.student_id
         LEFT JOIN programs p ON p.id = r.program_id
        WHERE r.id = ?`,
    )
    .get(registrationId)) as
    | {
        id: string;
        program_id: string;
        class_id: string | null;
        student_id: string;
        guardian_person_id: string | null;
        status: string;
        holds_seat: boolean;
        student_name: string;
        grade: string | null;
        program_name: string | null;
      }
    | undefined;
  if (!source) return { ok: false, error: "Registration not found." };

  if (source.program_id === targetProgramId) {
    // Moving between classes inside one program is a different operation with
    // different capacity behaviour; `placeInClass` owns it.
    return { ok: false, error: "That is the same program. To change class, use class placement instead." };
  }
  if (isTerminal(source.status)) {
    return {
      ok: false,
      error: `This registration is ${registrationLabel(source.status).toLowerCase()} and has no placement to transfer.`,
    };
  }
  if (!source.guardian_person_id) {
    return { ok: false, error: "This registration has no guardian on file. Fix the family link before transferring." };
  }

  const targetProgram = await loadRegistrationProgram(targetProgramId);
  const targetClass = await primaryClassFor(targetProgramId);
  if (!targetProgram || !targetClass) {
    return { ok: false, error: "The destination program is not set up to accept registrations." };
  }

  const now = Date.now();

  // Lock both classes, lowest id first. Two transfers running in opposite
  // directions between the same pair of programs would otherwise be able to
  // take the two locks in opposite orders and deadlock.
  const lockIds = [...new Set([source.class_id, targetClass.id].filter((id): id is string => Boolean(id)))].sort();

  await db.exec("BEGIN");
  try {
    for (const id of lockIds) {
      await db.prepare("SELECT id FROM classes WHERE id = ? FOR UPDATE").get(id);
    }

    const decision = await decideSeat({
      program: targetProgram,
      primaryClass: targetClass,
      studentId: source.student_id,
      studentName: source.student_name,
      grade: source.grade,
      guardianPersonId: source.guardian_person_id,
      // A transfer is one logical event per source registration, so the source
      // id is the natural idempotency key: replaying it cannot mint a second
      // destination registration.
      requestKey: `transfer:${source.id}`,
      payloadFingerprint: `transfer:${source.id}:${targetProgramId}`,
      createdVia: "admin",
      createdByUserId: actor.userId,
      // One message is sent below, naming both programs and the real outcome.
      announce: false,
      now,
    });

    // Anything that is not a real placement in the destination leaves the
    // child where they already are. This is the whole point of the ordering.
    if (
      decision.registrationId == null ||
      decision.status == null ||
      decision.outcome === "already_registered" ||
      decision.outcome === "ineligible" ||
      decision.outcome === "unavailable"
    ) {
      await db.exec("ROLLBACK");
      const detail =
        decision.outcome === "already_registered"
          ? `${source.student_name} already has a registration in ${targetProgram.name}.`
          : decision.message;
      return { ok: false, error: `${detail} Nothing was changed — the original place is untouched.` };
    }

    // The replacement exists. Only now is the original given up.
    await db
      .prepare(
        `UPDATE program_registrations
            SET status = 'withdrawn', holds_seat = false, reservation_expires_at = NULL,
                withdrawn_at = ?, decision_reason = ?, decided_by_user_id = ?, decided_at = ?,
                transferred_to_registration_id = ?, updated_at = ?
          WHERE id = ?`,
      )
      .run(now, trimmed, actor.userId, now, decision.registrationId, now, source.id);
    await releaseClassSeat(source.student_id, source.class_id, now);

    await db
      .prepare("UPDATE program_registrations SET transferred_from_registration_id = ?, updated_at = ? WHERE id = ?")
      .run(source.id, now, decision.registrationId);

    await db.exec("COMMIT");

    await recordAudit({
      registrationId: source.id,
      studentId: source.student_id,
      programId: source.program_id,
      actorUserId: actor.userId,
      actorLabel: actor.label,
      action: "program_transfer_out",
      previousState: source.status,
      newState: "withdrawn",
      reason: trimmed,
    });
    await recordAudit({
      registrationId: decision.registrationId,
      studentId: source.student_id,
      programId: targetProgramId,
      actorUserId: actor.userId,
      actorLabel: actor.label,
      action: "program_transfer_in",
      previousState: source.program_id,
      newState: decision.status,
      reason: trimmed,
    });

    // One message about one event. It has to state the resulting status
    // honestly: a transfer that lands on the destination's waitlist is not the
    // same news as one that lands on a confirmed seat, and saying "transferred"
    // without saying which would be the same mistake as calling a held seat a
    // confirmation.
    const landing: Record<string, { body: string; urgency: "normal" | "important" | "urgent" }> = {
      confirmed: {
        body: `${source.student_name} now has a confirmed place in ${targetProgram.name}. We will send the schedule and joining details before the first session.`,
        urgency: "important",
      },
      seat_reserved: {
        body:
          `We are holding a seat for ${source.student_name} in ${targetProgram.name}. This is not confirmed yet — ` +
          "complete the outstanding requirements before the deadline and the place is confirmed.",
        urgency: "urgent",
      },
      under_review: {
        body: `${targetProgram.name} reviews each registration before confirming a place. We will be in touch with the decision.`,
        urgency: "important",
      },
      waitlisted: {
        body:
          `${targetProgram.name} is currently full, so ${source.student_name} is on its waitlist. ` +
          "If a seat opens we will offer it to you and hold it while you respond.",
        urgency: "important",
      },
    };
    const message = landing[decision.status] ?? {
      body: `${source.student_name} has been moved to ${targetProgram.name}.`,
      urgency: "important" as const,
    };

    await recordNotification({
      personId: source.guardian_person_id,
      studentId: source.student_id,
      programId: targetProgramId,
      registrationId: decision.registrationId,
      kind: "transfer_approved",
      title: `${source.student_name} moved to ${targetProgram.name}`,
      body: `${source.student_name} has been transferred out of ${source.program_name ?? "the previous program"}. ${message.body}`,
      urgency: message.urgency,
      actionLabel: decision.status === "seat_reserved" ? "Complete requirements" : "View program",
      actionHref: "/family",
    });

    return { ok: true, registrationId: decision.registrationId, status: decision.status };
  } catch (error) {
    try {
      await db.exec("ROLLBACK");
    } catch {
      /* preserve the original error */
    }
    throw error;
  }
}
