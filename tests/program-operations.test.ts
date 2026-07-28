/* ============================================================
 * Program operations — the launch-completion behaviours, against a real
 * Postgres.
 *
 * These cover the things that decide whether BOW can run a real program
 * without someone editing rows by hand: a waitlisted family who stops being
 * eligible must not be reported as having declined, an emergency brake must
 * actually stop seats going out, a restored registration must re-check
 * capacity rather than trusting what an admin saw a minute ago, and a merge
 * must refuse to guess.
 *
 * Requires a local database (npm run db:setup) and the react-server condition
 * (see the `test` script). Skips cleanly when POSTGRES_URL is not local.
 * ============================================================ */

import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

const CONNECTION = (
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL ??
  ""
).trim();

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
  test("program operations tests skipped (no local POSTGRES_URL)", () => assert.ok(true));
}

/* ---------------------------------------------------------------- */
/* Fixtures                                                          */
/* ---------------------------------------------------------------- */

interface Fixture {
  programId: string;
  classId: string;
}

async function makeProgram(options: {
  capacity: number | null;
  waitlistMode?: "disabled" | "automatic" | "manual";
  gradeMin?: number | null;
  gradeMax?: number | null;
}): Promise<Fixture> {
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const now = Date.now();
  const programId = `prg-ops-${randomUUID().slice(0, 8)}`;
  const classId = `cls-ops-${randomUUID().slice(0, 8)}`;
  await db
    .prepare(
      `INSERT INTO programs (id, name, stage, minimum_enrollment, partner_confirmed, materials_status,
         renewal_status, created_at, updated_at, is_public, public_status, capacity, registration_mode,
         full_capacity_behavior, reservation_enabled, reservation_hours, waitlist_mode,
         waitlist_offer_hours, grade_min, grade_max, completion_requires_admin)
       VALUES (?, 'Ops Program', 'delivery', 1, 0, 'ready', 'not_due', ?, ?, true, 'open', ?, 'immediate',
               'waitlist', false, 72, ?, 48, ?, ?, true)`,
    )
    .run(
      programId,
      now,
      now,
      options.capacity,
      options.waitlistMode ?? "automatic",
      options.gradeMin ?? null,
      options.gradeMax ?? null,
    );
  await db
    .prepare(
      `INSERT INTO classes (id, title, program_id, status, minimum_enrollment, capacity, created_at, updated_at)
       VALUES (?, 'Ops Class', ?, 'planning', 1, ?, ?, ?)`,
    )
    .run(classId, programId, options.capacity, now, now);
  return { programId, classId };
}

async function makeChild(name: string, grade: string | null, school?: string | null): Promise<string> {
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const now = Date.now();
  const id = `stu-ops-${randomUUID().slice(0, 8)}`;
  await db
    .prepare(
      `INSERT INTO students (id, name, grade, school, enrollment_status, form_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', 'missing', ?, ?)`,
    )
    .run(id, name, grade, school ?? null, now, now);
  return id;
}

async function makeGuardian(): Promise<string> {
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const now = Date.now();
  const id = `per-ops-${randomUUID().slice(0, 8)}`;
  await db
    .prepare(
      "INSERT INTO people (id, name, email, phone, created_at, updated_at) VALUES (?, 'Ops Guardian', ?, '', ?, ?)",
    )
    .run(id, `ops-${randomUUID().slice(0, 8)}@example.test`, now, now);
  return id;
}

async function register(fixture: Fixture, studentId: string, name: string, grade: string | null, guardianId: string) {
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
      studentName: name,
      grade,
      guardianPersonId: guardianId,
      requestKey: `ops-${randomUUID()}`,
      payloadFingerprint: randomUUID(),
      now: Date.now(),
    });
    await db.exec("COMMIT");
    return decision;
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}

const ACTOR = { userId: null, label: "Ops test" };

/* ---------------------------------------------------------------- */
/* Waitlist eligibility                                              */
/* ---------------------------------------------------------------- */

dbTest("a waitlisted family who stops being eligible is skipped, not marked declined", async () => {
  const { getDb } = await import("@/lib/db");
  const { refillFromWaitlist } = await import("@/lib/enrollment");
  const db = getDb();

  // Capacity 1, grades 5-8. The first child takes the seat; the second waits.
  const fx = await makeProgram({ capacity: 1, gradeMin: 5, gradeMax: 8 });
  const guardian = await makeGuardian();
  const first = await makeChild("First Child", "6");
  const second = await makeChild("Second Child", "6");

  await register(fx, first, "First Child", "6", guardian);
  const waitlisted = await register(fx, second, "Second Child", "6", guardian);
  assert.equal(waitlisted.status, "waitlisted");

  // The child's grade is corrected to one outside the program's band, so they
  // are no longer eligible — the everyday case this must get right.
  await db.prepare("UPDATE students SET grade = '2' WHERE id = ?").run(second);

  // Free the seat so the sweep has something to offer and must consider them.
  await db
    .prepare("UPDATE program_registrations SET status = 'withdrawn', holds_seat = false WHERE student_id = ?")
    .run(first);
  await db.prepare("DELETE FROM class_enrollments WHERE student_id = ?").run(first);

  await refillFromWaitlist(fx.programId);

  const row = (await db
    .prepare(
      "SELECT status, waitlist_eligibility, waitlist_eligibility_reason, holds_seat FROM program_registrations WHERE student_id = ?",
    )
    .get(second)) as {
    status: string;
    waitlist_eligibility: string;
    waitlist_eligibility_reason: string | null;
    holds_seat: boolean;
  };

  // The regression this test exists for: this used to become 'declined',
  // which says the family said no and is terminal.
  assert.notEqual(row.status, "declined");
  assert.equal(row.status, "waitlisted");
  assert.equal(row.waitlist_eligibility, "ineligible");
  assert.ok(row.waitlist_eligibility_reason, "an ineligible entry must explain why");
  assert.equal(row.holds_seat, false);

  const events = (await db
    .prepare("SELECT new_eligibility, source FROM waitlist_eligibility_events WHERE registration_id = (SELECT id FROM program_registrations WHERE student_id = ?)")
    .all(second)) as unknown as { new_eligibility: string; source: string }[];
  assert.equal(events.length, 1);
  assert.equal(events[0].new_eligibility, "ineligible");
  assert.equal(events[0].source, "system");
});

dbTest("an ineligible waitlist entry does not spin the refill sweep", async () => {
  const { getDb } = await import("@/lib/db");
  const { refillFromWaitlist } = await import("@/lib/enrollment");
  const db = getDb();

  const fx = await makeProgram({ capacity: 1, gradeMin: 5, gradeMax: 8 });
  const guardian = await makeGuardian();
  const holder = await makeChild("Holder", "6");
  const waiter = await makeChild("Waiter", "6");
  await register(fx, holder, "Holder", "6", guardian);
  await register(fx, waiter, "Waiter", "6", guardian);

  await db.prepare("UPDATE students SET grade = '1' WHERE id = ?").run(waiter);
  await db
    .prepare("UPDATE program_registrations SET status = 'withdrawn', holds_seat = false WHERE student_id = ?")
    .run(holder);
  await db.prepare("DELETE FROM class_enrollments WHERE student_id = ?").run(holder);

  // Two passes: the second must not re-log or re-process the same entry, which
  // is what would happen if the query could still see it.
  await refillFromWaitlist(fx.programId);
  const created = await refillFromWaitlist(fx.programId);
  assert.equal(created, 0);

  const events = (await db
    .prepare(
      "SELECT id FROM waitlist_eligibility_events WHERE registration_id = (SELECT id FROM program_registrations WHERE student_id = ?)",
    )
    .all(waiter)) as unknown as { id: string }[];
  assert.equal(events.length, 1, "an unchanged eligibility result must not log a second event");
});

dbTest("re-evaluation restores a family whose blocking fact was corrected", async () => {
  const { getDb } = await import("@/lib/db");
  const { markWaitlistEligibilityLocked, reevaluateWaitlistEligibility } = await import("@/lib/enrollment");
  const db = getDb();

  const fx = await makeProgram({ capacity: 1, gradeMin: 5, gradeMax: 8 });
  const guardian = await makeGuardian();
  const holder = await makeChild("Holder", "6");
  const waiter = await makeChild("Waiter", "2");
  await register(fx, holder, "Holder", "6", guardian);
  await register(fx, waiter, "Waiter", "6", guardian);

  const reg = (await db
    .prepare("SELECT id FROM program_registrations WHERE student_id = ?")
    .get(waiter)) as { id: string };

  await markWaitlistEligibilityLocked({
    registrationId: reg.id,
    programId: fx.programId,
    eligibility: "ineligible",
    reason: "Grade outside the band.",
    source: "system",
    actorUserId: null,
    actorLabel: "Automatic waitlist sweep",
  });

  // The grade was simply wrong on file; correcting it must put them back in
  // line rather than requiring a new registration.
  await db.prepare("UPDATE students SET grade = '6' WHERE id = ?").run(waiter);
  const result = await reevaluateWaitlistEligibility(fx.programId);
  assert.equal(result.restored, 1);

  const row = (await db
    .prepare("SELECT waitlist_eligibility, waitlist_seq FROM program_registrations WHERE id = ?")
    .get(reg.id)) as { waitlist_eligibility: string; waitlist_seq: string | null };
  assert.equal(row.waitlist_eligibility, "eligible");
  assert.ok(row.waitlist_seq, "restoring eligibility must not cost the family its place in the queue");
});

dbTest("re-evaluation never overturns a staff rejection", async () => {
  const { getDb } = await import("@/lib/db");
  const { markWaitlistEligibilityLocked, reevaluateWaitlistEligibility } = await import("@/lib/enrollment");
  const db = getDb();

  const fx = await makeProgram({ capacity: 1, gradeMin: 5, gradeMax: 8 });
  const guardian = await makeGuardian();
  const holder = await makeChild("Holder", "6");
  const waiter = await makeChild("Waiter", "6");
  await register(fx, holder, "Holder", "6", guardian);
  await register(fx, waiter, "Waiter", "6", guardian);
  const reg = (await db
    .prepare("SELECT id FROM program_registrations WHERE student_id = ?")
    .get(waiter)) as { id: string };

  await markWaitlistEligibilityLocked({
    registrationId: reg.id,
    programId: fx.programId,
    eligibility: "staff_rejected",
    reason: "Removed after a safeguarding conversation.",
    source: "staff",
    actorUserId: null,
    actorLabel: "Ops test",
  });

  await reevaluateWaitlistEligibility(fx.programId);

  const row = (await db
    .prepare("SELECT waitlist_eligibility FROM program_registrations WHERE id = ?")
    .get(reg.id)) as { waitlist_eligibility: string };
  assert.equal(row.waitlist_eligibility, "staff_rejected", "a sweep must not silently undo a human decision");
});

/* ---------------------------------------------------------------- */
/* Emergency controls                                                */
/* ---------------------------------------------------------------- */

dbTest("pausing automatic offers stops the refill sweep without ending anyone's claim", async () => {
  const { getDb } = await import("@/lib/db");
  const { refillFromWaitlist } = await import("@/lib/enrollment");
  const { setProgramHold } = await import("@/lib/program-operations");
  const db = getDb();

  const fx = await makeProgram({ capacity: 1 });
  const guardian = await makeGuardian();
  const holder = await makeChild("Holder", "6");
  const waiter = await makeChild("Waiter", "6");
  await register(fx, holder, "Holder", "6", guardian);
  await register(fx, waiter, "Waiter", "6", guardian);

  const held = await setProgramHold(fx.programId, { autoOffersPaused: true }, ACTOR, "Schedule under review.");
  assert.equal(held.ok, true);

  await db
    .prepare("UPDATE program_registrations SET status = 'withdrawn', holds_seat = false WHERE student_id = ?")
    .run(holder);
  await db.prepare("DELETE FROM class_enrollments WHERE student_id = ?").run(holder);

  assert.equal(await refillFromWaitlist(fx.programId), 0, "a paused program must not hand out a seat");

  const row = (await db
    .prepare("SELECT status, waitlist_eligibility FROM program_registrations WHERE student_id = ?")
    .get(waiter)) as { status: string; waitlist_eligibility: string };
  assert.equal(row.status, "waitlisted");
  assert.equal(row.waitlist_eligibility, "eligible", "a pause is not a judgement about the family");

  // Lifting the brake resumes normal behaviour.
  await setProgramHold(fx.programId, { autoOffersPaused: false }, ACTOR, "Schedule confirmed.");
  assert.equal(await refillFromWaitlist(fx.programId), 1);
});

dbTest("a hold requires a reason and writes a program audit event", async () => {
  const { getDb } = await import("@/lib/db");
  const { setProgramHold } = await import("@/lib/program-operations");
  const db = getDb();
  const fx = await makeProgram({ capacity: 2 });

  const refused = await setProgramHold(fx.programId, { registrationOpen: false }, ACTOR, "   ");
  assert.equal(refused.ok, false);

  const ok = await setProgramHold(fx.programId, { registrationOpen: false }, ACTOR, "Venue lost.");
  assert.equal(ok.ok, true);

  const events = (await db
    .prepare("SELECT action, reason, new_state FROM program_audit_events WHERE program_id = ?")
    .all(fx.programId)) as unknown as { action: string; reason: string; new_state: string }[];
  assert.equal(events.length, 1);
  assert.equal(events[0].reason, "Venue lost.");
  assert.match(events[0].new_state, /registration closed/);
});

dbTest("pausing reservations holds new registrations for review instead of taking a seat", async () => {
  const { getDb } = await import("@/lib/db");
  const { setProgramHold } = await import("@/lib/program-operations");
  const db = getDb();

  const fx = await makeProgram({ capacity: 5 });
  await setProgramHold(fx.programId, { reservationsPaused: true }, ACTOR, "Capacity under investigation.");

  const guardian = await makeGuardian();
  const child = await makeChild("Paused Child", "6");
  const decision = await register(fx, child, "Paused Child", "6", guardian);

  assert.equal(decision.status, "under_review");

  // The family is recorded, not turned away, and an existing confirmed family
  // elsewhere is untouched.
  const row = (await db
    .prepare("SELECT status FROM program_registrations WHERE student_id = ?")
    .get(child)) as { status: string };
  assert.equal(row.status, "under_review");
});

/* ---------------------------------------------------------------- */
/* Restoration                                                       */
/* ---------------------------------------------------------------- */

dbTest("a withdrawn registration restores to review when a seat is free", async () => {
  const { getDb } = await import("@/lib/db");
  const { restoreRegistration, checkRestorable } = await import("@/lib/program-operations");
  const db = getDb();

  const fx = await makeProgram({ capacity: 3 });
  const guardian = await makeGuardian();
  const child = await makeChild("Returning Child", "6");
  await register(fx, child, "Returning Child", "6", guardian);
  const reg = (await db
    .prepare("SELECT id FROM program_registrations WHERE student_id = ?")
    .get(child)) as { id: string };

  await db
    .prepare("UPDATE program_registrations SET status = 'withdrawn', holds_seat = false WHERE id = ?")
    .run(reg.id);
  await db.prepare("DELETE FROM class_enrollments WHERE student_id = ?").run(child);

  const check = await checkRestorable(reg.id);
  assert.equal(check.eligible, true);
  assert.equal(check.seatAvailable, true);

  const result = await restoreRegistration(reg.id, ACTOR, "Family called back.");
  assert.equal(result.ok, true);
  assert.equal(result.status, "under_review");

  const row = (await db
    .prepare("SELECT status, holds_seat, restored_from_status FROM program_registrations WHERE id = ?")
    .get(reg.id)) as { status: string; holds_seat: boolean; restored_from_status: string };
  assert.equal(row.status, "under_review");
  assert.equal(row.holds_seat, true);
  assert.equal(row.restored_from_status, "withdrawn", "a restored row must not look like it was never withdrawn");
});

dbTest("restoring into a full program lands on the waitlist rather than overbooking", async () => {
  const { getDb } = await import("@/lib/db");
  const { restoreRegistration } = await import("@/lib/program-operations");
  const db = getDb();

  const fx = await makeProgram({ capacity: 1, waitlistMode: "automatic" });
  const guardian = await makeGuardian();
  const leaving = await makeChild("Leaving Child", "6");
  await register(fx, leaving, "Leaving Child", "6", guardian);
  const reg = (await db
    .prepare("SELECT id FROM program_registrations WHERE student_id = ?")
    .get(leaving)) as { id: string };

  await db
    .prepare("UPDATE program_registrations SET status = 'withdrawn', holds_seat = false WHERE id = ?")
    .run(reg.id);
  await db.prepare("DELETE FROM class_enrollments WHERE student_id = ?").run(leaving);

  // Someone else takes the only seat in the meantime.
  const replacement = await makeChild("Replacement Child", "6");
  await register(fx, replacement, "Replacement Child", "6", guardian);

  const result = await restoreRegistration(reg.id, ACTOR, "Family changed their mind.");
  assert.equal(result.ok, true);
  assert.equal(result.status, "waitlisted", "restoring must never take a seat that is gone");

  const counts = (await db
    .prepare("SELECT COUNT(*) AS n FROM program_registrations WHERE program_id = ? AND holds_seat = true")
    .get(fx.programId)) as { n: string };
  assert.equal(Number(counts.n), 1, "capacity must still be respected after a restore");
});

dbTest("a registration cannot be restored when the child registered again", async () => {
  const { getDb } = await import("@/lib/db");
  const { checkRestorable, restoreRegistration } = await import("@/lib/program-operations");
  const db = getDb();

  const fx = await makeProgram({ capacity: 5 });
  const guardian = await makeGuardian();
  const child = await makeChild("Twice Child", "6");
  await register(fx, child, "Twice Child", "6", guardian);
  const first = (await db
    .prepare("SELECT id FROM program_registrations WHERE student_id = ?")
    .get(child)) as { id: string };

  await db
    .prepare("UPDATE program_registrations SET status = 'withdrawn', holds_seat = false WHERE id = ?")
    .run(first.id);
  await db.prepare("DELETE FROM class_enrollments WHERE student_id = ?").run(child);
  await register(fx, child, "Twice Child", "6", guardian);

  const check = await checkRestorable(first.id);
  assert.equal(check.eligible, false);
  const result = await restoreRegistration(first.id, ACTOR, "Trying anyway.");
  assert.equal(result.ok, false);
});

/* ---------------------------------------------------------------- */
/* Duplicate review                                                  */
/* ---------------------------------------------------------------- */

dbTest("a merge is refused when the two records conflict", async () => {
  const { flagPossibleDuplicate, checkMergeSafety, resolveDuplicateReview } = await import(
    "@/lib/program-operations"
  );

  const a = await makeChild("Jordan Rivera", "6", "Eastfield Middle");
  const b = await makeChild("Jordan Rivera", "8", "Westgate Middle");

  const reviewId = await flagPossibleDuplicate(a, b, "Same normalized name.");
  assert.ok(reviewId);

  const safety = await checkMergeSafety(a, b);
  assert.equal(safety.safe, false);
  assert.ok(safety.conflicts.length >= 2, "differing grade and school are both conflicts");

  const merged = await resolveDuplicateReview(reviewId, "merged", ACTOR, { canonicalStudentId: a });
  assert.equal(merged.ok, false, "a conflicting pair must require manual review, never an automatic merge");
});

dbTest("confirming two children are distinct is permanent and stops re-flagging", async () => {
  const { getDb } = await import("@/lib/db");
  const { flagPossibleDuplicate, resolveDuplicateReview } = await import("@/lib/program-operations");
  const db = getDb();

  const a = await makeChild("Sam Okafor", "6", "Eastfield Middle");
  const b = await makeChild("Sam Okafor", "6", "Eastfield Middle");
  const reviewId = await flagPossibleDuplicate(a, b, "Same name and grade.");
  assert.ok(reviewId);

  const resolved = await resolveDuplicateReview(reviewId, "distinct", ACTOR, { note: "Twins." });
  assert.equal(resolved.ok, true);

  // The detector running again must not reopen a decided pair.
  const again = await flagPossibleDuplicate(a, b, "Same name and grade.");
  assert.equal(again, null);

  const row = (await db
    .prepare("SELECT status FROM student_duplicate_reviews WHERE id = ?")
    .get(reviewId)) as { status: string };
  assert.equal(row.status, "distinct");
});

dbTest("a clean merge moves history onto the canonical child and tombstones the other", async () => {
  const { getDb } = await import("@/lib/db");
  const { flagPossibleDuplicate, resolveDuplicateReview } = await import("@/lib/program-operations");
  const db = getDb();

  const fx = await makeProgram({ capacity: 5 });
  const guardian = await makeGuardian();
  const canonical = await makeChild("Alex Chen", "6", "Eastfield Middle");
  const duplicate = await makeChild("Alex Chen", "6", "Eastfield Middle");

  // Only the duplicate carries a registration, so there is no program overlap
  // and the merge is genuinely unambiguous.
  await register(fx, duplicate, "Alex Chen", "6", guardian);

  const reviewId = await flagPossibleDuplicate(canonical, duplicate, "Same name and grade.");
  assert.ok(reviewId);

  const merged = await resolveDuplicateReview(reviewId, "merged", ACTOR, {
    canonicalStudentId: canonical,
    note: "Confirmed with the family.",
  });
  assert.equal(merged.ok, true);

  const moved = (await db
    .prepare("SELECT student_id FROM program_registrations WHERE program_id = ?")
    .all(fx.programId)) as unknown as { student_id: string }[];
  assert.equal(moved.length, 1);
  assert.equal(moved[0].student_id, canonical, "the registration must follow the surviving child");

  const tombstone = (await db
    .prepare("SELECT merged_into_student_id FROM students WHERE id = ?")
    .get(duplicate)) as { merged_into_student_id: string | null };
  assert.equal(
    tombstone.merged_into_student_id,
    canonical,
    "a stale id must still lead a reader to the real child",
  );
});
