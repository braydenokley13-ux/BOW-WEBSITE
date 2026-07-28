/* ============================================================
 * Registration engine — end-to-end workflow tests against a real Postgres.
 *
 * These drive lib/enrollment.ts and lib/program-completion.ts directly, so
 * they assert the behaviour families and admins actually depend on: a
 * reservation that confirms only once its blocking requirement is satisfied,
 * an expiry that releases the seat and promotes the next family, an offer
 * that cannot be double-claimed, and a completion that refuses to issue a
 * certificate nobody earned.
 *
 * Requires a local database (npm run db:setup) and the react-server condition
 * (see the `test` script) so server-only modules resolve. Skips cleanly when
 * POSTGRES_URL is not local, so the suite stays runnable without a database.
 * ============================================================ */

import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

const CONNECTION = (process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "").trim();

function isLocal(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

const enabled = Boolean(CONNECTION) && isLocal(CONNECTION);
const dbTest = enabled ? test : test.skip;

if (!enabled) {
  test("registration engine tests skipped (no local POSTGRES_URL)", () => assert.ok(true));
}

/* ---------------------------------------------------------------- */
/* Fixtures                                                          */
/* ---------------------------------------------------------------- */

interface Fixture {
  programId: string;
  classId: string;
}

interface ProgramOptions {
  capacity: number | null;
  reservationEnabled?: boolean;
  reservationHours?: number;
  waitlistMode?: "disabled" | "automatic" | "manual";
  registrationMode?: "immediate" | "approval";
  minAttendance?: number | null;
  certificateEnabled?: boolean;
}

async function makeProgram(options: ProgramOptions): Promise<Fixture> {
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const now = Date.now();
  const programId = `prg-eng-${randomUUID().slice(0, 8)}`;
  const classId = `cls-eng-${randomUUID().slice(0, 8)}`;
  await db
    .prepare(
      `INSERT INTO programs (id, name, stage, minimum_enrollment, partner_confirmed, materials_status,
         renewal_status, created_at, updated_at, is_public, public_status, capacity, registration_mode,
         full_capacity_behavior, reservation_enabled, reservation_hours, waitlist_mode,
         waitlist_offer_hours, completion_min_attendance, certificate_enabled, completion_requires_admin)
       VALUES (?, 'Engine Program', 'delivery', 1, 0, 'ready', 'not_due', ?, ?, true, 'open', ?, ?,
               'waitlist', ?, ?, ?, 48, ?, ?, true)`,
    )
    .run(
      programId,
      now,
      now,
      options.capacity,
      options.registrationMode ?? "immediate",
      options.reservationEnabled ?? false,
      options.reservationHours ?? 72,
      options.waitlistMode ?? "disabled",
      options.minAttendance ?? null,
      options.certificateEnabled ?? false,
    );
  await db
    .prepare(
      `INSERT INTO classes (id, title, program_id, status, minimum_enrollment, capacity, created_at, updated_at)
       VALUES (?, 'Engine Class', ?, 'planning', 1, ?, ?, ?)`,
    )
    .run(classId, programId, options.capacity, now, now);
  return { programId, classId };
}

async function makeChild(name: string, grade: string | null): Promise<string> {
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const now = Date.now();
  const id = `stu-eng-${randomUUID().slice(0, 8)}`;
  await db
    .prepare(
      `INSERT INTO students (id, name, grade, enrollment_status, form_status, created_at, updated_at)
       VALUES (?, ?, ?, 'active', 'missing', ?, ?)`,
    )
    .run(id, name, grade, now, now);
  return id;
}

async function makeGuardian(): Promise<string> {
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const now = Date.now();
  const id = `per-eng-${randomUUID().slice(0, 8)}`;
  await db
    .prepare("INSERT INTO people (id, name, email, phone, created_at, updated_at) VALUES (?, 'Engine Guardian', ?, '', ?, ?)")
    .run(id, `engine-${randomUUID().slice(0, 8)}@example.test`, now, now);
  return id;
}

async function makeBlockingRequirement(programId: string): Promise<string> {
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const now = Date.now();
  const id = `prq-eng-${randomUUID().slice(0, 8)}`;
  await db
    .prepare(
      `INSERT INTO program_requirements
         (id, program_id, kind, prompt, required, blocks_confirmation, created_at, updated_at)
       VALUES (?, ?, 'waiver', 'Sign the participation waiver', true, true, ?, ?)`,
    )
    .run(id, programId, now, now);
  return id;
}

/** Register one child through the engine, taking the class lock as callers do. */
async function register(fixture: Fixture, studentId: string, studentName: string, grade: string | null, guardianId: string) {
  const { getDb } = await import("@/lib/db");
  const { decideSeat, loadRegistrationProgram, primaryClassFor } = await import("@/lib/enrollment");
  const db = getDb();
  const program = await loadRegistrationProgram(fixture.programId);
  const primary = await primaryClassFor(fixture.programId);
  assert.ok(program && primary);
  await db.exec("BEGIN");
  try {
    await db.prepare("SELECT id FROM classes WHERE id = ? FOR UPDATE").get(primary.id);
    const decision = await decideSeat({
      program,
      primaryClass: primary,
      studentId,
      studentName,
      grade,
      guardianPersonId: guardianId,
      requestKey: `eng-${randomUUID()}#0`,
      payloadFingerprint: "fingerprint",
      now: Date.now(),
    });
    await db.exec("COMMIT");
    return decision;
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}

/* ---------------------------------------------------------------- */
/* Reservations and requirements                                     */
/* ---------------------------------------------------------------- */

dbTest("a program with no blocking requirement confirms immediately", async () => {
  const fixture = await makeProgram({ capacity: 5 });
  const guardian = await makeGuardian();
  const child = await makeChild("Immediate Confirm", "7");

  const result = await register(fixture, child, "Immediate Confirm", "7", guardian);
  assert.equal(result.outcome, "confirmed");
  assert.equal(result.status, "confirmed");

  const { getDb } = await import("@/lib/db");
  const enrollment = await getDb()
    .prepare("SELECT status FROM class_enrollments WHERE class_id = ? AND student_id = ?")
    .get(fixture.classId, child);
  assert.equal((enrollment as { status: string } | undefined)?.status, "enrolled", "a confirmed seat must appear on the class roster");
});

dbTest("a blocking requirement reserves the seat and only confirms once satisfied", async () => {
  const fixture = await makeProgram({ capacity: 5, reservationEnabled: true, reservationHours: 48 });
  const requirementId = await makeBlockingRequirement(fixture.programId);
  const guardian = await makeGuardian();
  const child = await makeChild("Reserved Child", "7");

  const result = await register(fixture, child, "Reserved Child", "7", guardian);
  assert.equal(result.outcome, "seat_reserved");
  assert.ok(result.reservationExpiresAt && result.reservationExpiresAt > Date.now());
  assert.equal(result.blockingRequirements, 1);

  const { confirmIfReady, outstandingBlockingRequirements } = await import("@/lib/enrollment");
  const registrationId = result.registrationId as string;

  assert.equal(await outstandingBlockingRequirements(registrationId), 1);
  const early = await confirmIfReady(registrationId, { label: "test" });
  assert.equal(early.confirmed, false, "a reserved seat must not confirm while a blocking requirement is open");

  const { getDb } = await import("@/lib/db");
  await getDb()
    .prepare("UPDATE registration_requirements SET status = 'approved', updated_at = ? WHERE registration_id = ? AND requirement_id = ?")
    .run(Date.now(), registrationId, requirementId);

  const confirmed = await confirmIfReady(registrationId, { label: "test" });
  assert.equal(confirmed.confirmed, true, "satisfying the last blocking requirement must confirm the seat");

  const row = await getDb().prepare("SELECT status, holds_seat, reservation_expires_at FROM program_registrations WHERE id = ?").get(registrationId);
  const record = row as { status: string; holds_seat: boolean; reservation_expires_at: number | null };
  assert.equal(record.status, "confirmed");
  assert.equal(record.holds_seat, true);
  assert.equal(record.reservation_expires_at, null, "confirming must clear the reservation deadline");
});

dbTest("an approval-mode program holds the seat under review rather than confirming", async () => {
  const fixture = await makeProgram({ capacity: 5, registrationMode: "approval" });
  const guardian = await makeGuardian();
  const child = await makeChild("Review Child", "7");

  const result = await register(fixture, child, "Review Child", "7", guardian);
  assert.equal(result.outcome, "under_review");

  const { seatCounts } = await import("@/lib/enrollment");
  const counts = await seatCounts(fixture.classId, 5);
  assert.equal(counts.taken, 1, "a registration under review still consumes a seat");
});

/* ---------------------------------------------------------------- */
/* Expiry and waitlist promotion                                     */
/* ---------------------------------------------------------------- */

dbTest("an expired reservation releases the seat and offers it to the next family", async () => {
  const fixture = await makeProgram({
    capacity: 1,
    reservationEnabled: true,
    reservationHours: 1,
    waitlistMode: "automatic",
  });
  await makeBlockingRequirement(fixture.programId);
  const guardian = await makeGuardian();

  const firstChild = await makeChild("Holds The Seat", "7");
  const first = await register(fixture, firstChild, "Holds The Seat", "7", guardian);
  assert.equal(first.outcome, "seat_reserved");

  const secondChild = await makeChild("Next In Line", "7");
  const second = await register(fixture, secondChild, "Next In Line", "7", guardian);
  assert.equal(second.outcome, "waitlisted", "the only seat is held, so the next family waits");

  const { getDb } = await import("@/lib/db");
  const db = getDb();
  // Move the deadline into the past rather than waiting an hour.
  await db
    .prepare("UPDATE program_registrations SET reservation_expires_at = ? WHERE id = ?")
    .run(Date.now() - 1000, first.registrationId);

  const { sweepExpirations } = await import("@/lib/enrollment");
  const sweep = await sweepExpirations();
  assert.ok(sweep.expired >= 1, "the passed deadline must expire the reservation");

  const expired = (await db.prepare("SELECT status, holds_seat FROM program_registrations WHERE id = ?").get(first.registrationId)) as {
    status: string;
    holds_seat: boolean;
  };
  assert.equal(expired.status, "expired");
  assert.equal(expired.holds_seat, false, "an expired reservation must free its seat");

  const promoted = (await db.prepare("SELECT status, holds_seat FROM program_registrations WHERE id = ?").get(second.registrationId)) as {
    status: string;
    holds_seat: boolean;
  };
  assert.equal(promoted.status, "offer_sent", "the freed seat must be offered to the next waitlisted family");
  assert.equal(promoted.holds_seat, true, "an outstanding offer must hold the seat so it cannot be double-claimed");

  const offers = (await db.prepare("SELECT COUNT(*) AS n FROM waitlist_offers WHERE program_id = ? AND status = 'sent'").get(fixture.programId)) as {
    n: number | string;
  };
  assert.equal(Number(offers.n), 1, "one freed seat must produce exactly one offer");
});

dbTest("declining an offer releases the seat and promotes the family after", async () => {
  const fixture = await makeProgram({ capacity: 1, waitlistMode: "automatic" });
  const guardian = await makeGuardian();

  const holder = await makeChild("Seat Holder", "7");
  await register(fixture, holder, "Seat Holder", "7", guardian);

  const declines = await makeChild("Will Decline", "7");
  const declining = await register(fixture, declines, "Will Decline", "7", guardian);
  const waits = await makeChild("Waits Behind", "7");
  const waiting = await register(fixture, waits, "Waits Behind", "7", guardian);
  assert.equal(declining.outcome, "waitlisted");
  assert.equal(waiting.outcome, "waitlisted");

  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const { releaseSeat, respondToOffer, refillFromWaitlist } = await import("@/lib/enrollment");

  // Free the seat so the first waitlisted family is offered it.
  const holderRegistration = (await db
    .prepare("SELECT id FROM program_registrations WHERE student_id = ? AND program_id = ?")
    .get(holder, fixture.programId)) as { id: string };
  await releaseSeat(holderRegistration.id, "withdrawn", { label: "test" });
  await refillFromWaitlist(fixture.programId);

  const offer = (await db
    .prepare("SELECT id FROM waitlist_offers WHERE registration_id = ? AND status = 'sent'")
    .get(declining.registrationId)) as { id: string } | undefined;
  assert.ok(offer, "the first waitlisted family must receive the freed seat");

  const response = await respondToOffer(offer.id, "decline", { label: "test" });
  assert.equal(response.status, "declined");

  const next = (await db.prepare("SELECT status FROM program_registrations WHERE id = ?").get(waiting.registrationId)) as {
    status: string;
  };
  assert.equal(next.status, "offer_sent", "declining must pass the seat to the next family, not strand it");
});

dbTest("accepting an offer confirms the seat without re-checking a full class", async () => {
  const fixture = await makeProgram({ capacity: 1, waitlistMode: "automatic" });
  const guardian = await makeGuardian();

  const holder = await makeChild("Original Holder", "7");
  const waiter = await makeChild("Accepts Offer", "7");
  await register(fixture, holder, "Original Holder", "7", guardian);
  const waiting = await register(fixture, waiter, "Accepts Offer", "7", guardian);

  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const { releaseSeat, respondToOffer, refillFromWaitlist } = await import("@/lib/enrollment");
  const holderRegistration = (await db
    .prepare("SELECT id FROM program_registrations WHERE student_id = ? AND program_id = ?")
    .get(holder, fixture.programId)) as { id: string };
  await releaseSeat(holderRegistration.id, "withdrawn", { label: "test" });
  await refillFromWaitlist(fixture.programId);

  const offer = (await db
    .prepare("SELECT id FROM waitlist_offers WHERE registration_id = ? AND status = 'sent'")
    .get(waiting.registrationId)) as { id: string };
  const response = await respondToOffer(offer.id, "accept", { label: "test" });
  assert.equal(response.status, "confirmed");

  const enrollment = await db
    .prepare("SELECT status FROM class_enrollments WHERE class_id = ? AND student_id = ? AND status = 'enrolled'")
    .get(fixture.classId, waiter);
  assert.ok(enrollment, "accepting an offer must place the child on the roster");
});

dbTest("an answered offer cannot be answered a second time", async () => {
  const fixture = await makeProgram({ capacity: 1, waitlistMode: "automatic" });
  const guardian = await makeGuardian();
  const holder = await makeChild("Holder Two", "7");
  const waiter = await makeChild("Double Answer", "7");
  await register(fixture, holder, "Holder Two", "7", guardian);
  const waiting = await register(fixture, waiter, "Double Answer", "7", guardian);

  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const { releaseSeat, respondToOffer, refillFromWaitlist, EnrollmentError } = await import("@/lib/enrollment");
  const holderRegistration = (await db
    .prepare("SELECT id FROM program_registrations WHERE student_id = ? AND program_id = ?")
    .get(holder, fixture.programId)) as { id: string };
  await releaseSeat(holderRegistration.id, "withdrawn", { label: "test" });
  await refillFromWaitlist(fixture.programId);

  const offer = (await db
    .prepare("SELECT id FROM waitlist_offers WHERE registration_id = ? AND status = 'sent'")
    .get(waiting.registrationId)) as { id: string };
  await respondToOffer(offer.id, "accept", { label: "test" });
  await assert.rejects(
    () => respondToOffer(offer.id, "accept", { label: "test" }),
    (error: unknown) => error instanceof EnrollmentError && error.code === "conflict",
    "a replayed acceptance must be refused, not silently re-applied",
  );
});

/* ---------------------------------------------------------------- */
/* Admin operations                                                  */
/* ---------------------------------------------------------------- */

dbTest("a reservation can be extended but an expired one cannot be revived", async () => {
  const fixture = await makeProgram({ capacity: 3, reservationEnabled: true, reservationHours: 24 });
  await makeBlockingRequirement(fixture.programId);
  const guardian = await makeGuardian();
  const child = await makeChild("Extended Child", "7");
  const result = await register(fixture, child, "Extended Child", "7", guardian);
  const registrationId = result.registrationId as string;

  const { extendReservation, releaseSeat, EnrollmentError } = await import("@/lib/enrollment");
  const original = result.reservationExpiresAt as number;
  const extended = await extendReservation(registrationId, 24, { label: "admin" }, "Family asked for more time.");
  assert.ok(extended > original, "extending must move the deadline later");

  await releaseSeat(registrationId, "expired", { label: "test" });
  await assert.rejects(
    () => extendReservation(registrationId, 24, { label: "admin" }),
    (error: unknown) => error instanceof EnrollmentError && error.code === "conflict",
    "an already-expired reservation has no deadline to extend",
  );
});

dbTest("a class transfer never leaves the student enrolled in neither class", async () => {
  const fixture = await makeProgram({ capacity: 5 });
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const now = Date.now();
  const secondClassId = `cls-eng-${randomUUID().slice(0, 8)}`;
  await db
    .prepare(
      `INSERT INTO classes (id, title, program_id, status, minimum_enrollment, capacity, created_at, updated_at)
       VALUES (?, 'Second Cohort', ?, 'planning', 1, 5, ?, ?)`,
    )
    .run(secondClassId, fixture.programId, now, now);

  const guardian = await makeGuardian();
  const child = await makeChild("Transferred Child", "7");
  const result = await register(fixture, child, "Transferred Child", "7", guardian);

  const { placeInClass } = await import("@/lib/enrollment");
  await placeInClass(result.registrationId as string, secondClassId, { label: "admin" }, "Schedule conflict.");

  const enrolled = (await db
    .prepare("SELECT class_id FROM class_enrollments WHERE student_id = ? AND status = 'enrolled'")
    .all(child)) as unknown as { class_id: string }[];
  assert.equal(enrolled.length, 1, "a transfer must leave exactly one live enrollment");
  assert.equal(enrolled[0].class_id, secondClassId);

  const registration = (await db.prepare("SELECT class_id FROM program_registrations WHERE id = ?").get(result.registrationId)) as {
    class_id: string;
  };
  assert.equal(registration.class_id, secondClassId, "the registration must follow the student to the new class");
});

dbTest("a transfer into a full class is refused rather than silently overfilling it", async () => {
  const fixture = await makeProgram({ capacity: 5 });
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const now = Date.now();
  const fullClassId = `cls-eng-${randomUUID().slice(0, 8)}`;
  await db
    .prepare(
      `INSERT INTO classes (id, title, program_id, status, minimum_enrollment, capacity, created_at, updated_at)
       VALUES (?, 'Full Cohort', ?, 'planning', 1, 1, ?, ?)`,
    )
    .run(fullClassId, fixture.programId, now, now);

  const guardian = await makeGuardian();
  const occupant = await makeChild("Occupant", "7");
  await db
    .prepare(
      `INSERT INTO program_registrations (id, program_id, class_id, student_id, status, holds_seat, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'confirmed', true, ?, ?)`,
    )
    .run(`preg-eng-${randomUUID().slice(0, 10)}`, fixture.programId, fullClassId, occupant, now, now);

  const mover = await makeChild("Wants To Move", "7");
  const result = await register(fixture, mover, "Wants To Move", "7", guardian);

  const { placeInClass, EnrollmentError } = await import("@/lib/enrollment");
  await assert.rejects(
    () => placeInClass(result.registrationId as string, fullClassId, { label: "admin" }),
    (error: unknown) => error instanceof EnrollmentError && error.code === "no_capacity",
    "class capacity must be enforced on the destination of a transfer",
  );
});

dbTest("every consequential change leaves an audit event", async () => {
  const fixture = await makeProgram({ capacity: 3 });
  const guardian = await makeGuardian();
  const child = await makeChild("Audited Child", "7");
  const result = await register(fixture, child, "Audited Child", "7", guardian);

  const { releaseSeat } = await import("@/lib/enrollment");
  await releaseSeat(result.registrationId as string, "withdrawn", { label: "admin" }, "Family withdrew.");

  const { getDb } = await import("@/lib/db");
  const events = (await getDb()
    .prepare("SELECT action FROM registration_audit_events WHERE registration_id = ? ORDER BY created_at")
    .all(result.registrationId)) as unknown as { action: string }[];
  const actions = events.map((event) => event.action);
  assert.ok(actions.includes("registration_submitted"), "submission must be audited");
  assert.ok(actions.includes("seat_released"), "a withdrawal must be audited");
});

/* ---------------------------------------------------------------- */
/* Completion                                                        */
/* ---------------------------------------------------------------- */

dbTest("completion is refused while sessions remain and attendance is short", async () => {
  const fixture = await makeProgram({ capacity: 5, minAttendance: 80, certificateEnabled: true });
  const guardian = await makeGuardian();
  const child = await makeChild("Not Yet Done", "7");
  const result = await register(fixture, child, "Not Yet Done", "7", guardian);

  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const now = Date.now();
  const future = `cse-${randomUUID().slice(0, 10)}`;
  await db
    .prepare("INSERT INTO class_sessions (id, class_id, session_date, status, created_at) VALUES (?, ?, ?, 'scheduled', ?)")
    .run(future, fixture.classId, now + 7 * 24 * 60 * 60 * 1000, now);

  const { evaluateCompletion, completeRegistration, CompletionError } = await import("@/lib/program-completion");
  const evaluation = await evaluateCompletion(result.registrationId as string);
  assert.ok(evaluation);
  assert.equal(evaluation.eligible, false);
  assert.ok(
    evaluation.blockers.some((blocker) => blocker.includes("sessions remaining")),
    "an unfinished program must block completion",
  );

  await assert.rejects(
    () => completeRegistration({ registrationId: result.registrationId as string, outcome: "completed", actor: { label: "admin" } }),
    (error: unknown) => error instanceof CompletionError,
    "a student who does not meet the rules must not be marked complete",
  );
});

dbTest("a qualifying student completes and receives a certificate serial", async () => {
  const fixture = await makeProgram({ capacity: 5, minAttendance: 50, certificateEnabled: true });
  const guardian = await makeGuardian();
  const child = await makeChild("Earned It", "7");
  const result = await register(fixture, child, "Earned It", "7", guardian);

  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const now = Date.now();
  const past = `cse-${randomUUID().slice(0, 10)}`;
  await db
    .prepare("INSERT INTO class_sessions (id, class_id, session_date, status, created_at) VALUES (?, ?, ?, 'completed', ?)")
    .run(past, fixture.classId, now - 7 * 24 * 60 * 60 * 1000, now);
  await db
    .prepare("INSERT INTO attendance_records (id, session_id, student_id, present, status, recorded_at) VALUES (?, ?, ?, 1, 'present', ?)")
    .run(`atr-${randomUUID().slice(0, 10)}`, past, child, now);

  const { evaluateCompletion, completeRegistration } = await import("@/lib/program-completion");
  const evaluation = await evaluateCompletion(result.registrationId as string);
  assert.ok(evaluation?.eligible, `expected eligible, blockers: ${evaluation?.blockers.join(" ")}`);

  const completion = await completeRegistration({
    registrationId: result.registrationId as string,
    outcome: "completed",
    actor: { label: "admin" },
  });
  assert.ok(completion.serial?.startsWith("BOW-"), "a completed student must receive a verifiable certificate serial");

  const registration = (await db.prepare("SELECT status, holds_seat FROM program_registrations WHERE id = ?").get(result.registrationId)) as {
    status: string;
    holds_seat: boolean;
  };
  assert.equal(registration.status, "completed");
  assert.equal(registration.holds_seat, false, "a completed program must release its seat");
});

dbTest("a participation record never carries a certificate", async () => {
  const fixture = await makeProgram({ capacity: 5, certificateEnabled: true });
  const guardian = await makeGuardian();
  const child = await makeChild("Took Part", "7");
  const result = await register(fixture, child, "Took Part", "7", guardian);

  const { completeRegistration } = await import("@/lib/program-completion");
  const completion = await completeRegistration({
    registrationId: result.registrationId as string,
    outcome: "participated",
    actor: { label: "admin" },
  });
  assert.equal(completion.serial, null, "participation is not completion and must not produce a certificate");
});
