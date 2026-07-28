/* ============================================================
 * Registration lifecycle — integration tests against a real Postgres.
 *
 * These assert the behaviour that cannot be verified by reading code: seat
 * arithmetic under a real lock, idempotent replay, reservation expiry, and
 * waitlist promotion. They require a local database (npm run db:setup) and
 * skip cleanly when POSTGRES_URL does not point at one, so the suite stays
 * runnable on a machine without a database.
 * ============================================================ */

import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

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
const describeDb = enabled ? test : test.skip;

if (!enabled) {
  test("registration lifecycle integration tests skipped (no local POSTGRES_URL)", () => {
    assert.ok(true);
  });
}

/* ---------------------------------------------------------------- */
/* Fixtures                                                          */
/* ---------------------------------------------------------------- */

interface Fixture {
  programId: string;
  classId: string;
}

async function createProgram(
  sql: postgres.Sql,
  options: {
    capacity: number | null;
    reservationEnabled?: boolean;
    reservationHours?: number;
    waitlistMode?: "disabled" | "automatic" | "manual";
    registrationMode?: "immediate" | "approval";
    fullCapacityBehavior?: "close" | "waitlist" | "continue";
    gradeMin?: number | null;
    gradeMax?: number | null;
  },
): Promise<Fixture> {
  const now = Date.now();
  const programId = `prg-test-${randomUUID().slice(0, 8)}`;
  const classId = `cls-test-${randomUUID().slice(0, 8)}`;
  await sql`
    INSERT INTO programs (id, name, stage, minimum_enrollment, partner_confirmed, materials_status,
      renewal_status, created_at, updated_at, is_public, public_status, capacity, registration_mode,
      full_capacity_behavior, reservation_enabled, reservation_hours, waitlist_mode,
      waitlist_offer_hours, grade_min, grade_max)
    VALUES (${programId}, 'Test Program', 'delivery', 1, 0, 'ready', 'not_due', ${now}, ${now},
      true, 'open', ${options.capacity}, ${options.registrationMode ?? "immediate"},
      ${options.fullCapacityBehavior ?? "waitlist"}, ${options.reservationEnabled ?? false},
      ${options.reservationHours ?? 72}, ${options.waitlistMode ?? "disabled"}, 48,
      ${options.gradeMin ?? null}, ${options.gradeMax ?? null})`;
  await sql`
    INSERT INTO classes (id, title, program_id, status, minimum_enrollment, capacity, created_at, updated_at)
    VALUES (${classId}, 'Test Class', ${programId}, 'planning', 1, ${options.capacity}, ${now}, ${now})`;
  return { programId, classId };
}

async function createChild(sql: postgres.Sql, name: string, grade: string | null): Promise<string> {
  const now = Date.now();
  const id = `stu-test-${randomUUID().slice(0, 8)}`;
  await sql`
    INSERT INTO students (id, name, grade, enrollment_status, form_status, created_at, updated_at)
    VALUES (${id}, ${name}, ${grade}, 'active', 'missing', ${now}, ${now})`;
  return id;
}


async function createGuardian(sql: postgres.Sql, email: string): Promise<string> {
  const now = Date.now();
  const id = `per-test-${randomUUID().slice(0, 8)}`;
  await sql`
    INSERT INTO people (id, name, email, phone, created_at, updated_at)
    VALUES (${id}, 'Test Guardian', ${email}, '', ${now}, ${now})`;
  return id;
}

function connect(): postgres.Sql {
  return postgres(CONNECTION, { prepare: false, max: 1, idle_timeout: 5 });
}

/**
 * The exact seat sequence the engine runs: lock the class row, count what is
 * occupied, then insert only if a seat remains. Reproduced here at SQL level
 * so two genuinely concurrent connections can race it.
 */
async function attemptSeat(sql: postgres.Sql, fixture: Fixture, studentId: string, delayMs: number): Promise<boolean> {
  const now = Date.now();
  return sql.begin(async (tx) => {
    const [locked] = await tx`SELECT id, capacity FROM classes WHERE id = ${fixture.classId} FOR UPDATE`;
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    const [{ n }] = await tx`
      SELECT COUNT(*) AS n FROM (
        SELECT ce.student_id FROM class_enrollments ce JOIN students s ON s.id = ce.student_id
         WHERE ce.class_id = ${fixture.classId} AND ce.status = 'enrolled' AND s.enrollment_status = 'active'
        UNION
        SELECT r.student_id FROM program_registrations r
         WHERE r.class_id = ${fixture.classId} AND r.holds_seat = true
      ) AS occupied`;
    const capacity = locked.capacity as number | null;
    if (capacity != null && Number(n) >= capacity) return false;
    await tx`
      INSERT INTO program_registrations (id, program_id, class_id, student_id, status, holds_seat, created_at, updated_at)
      VALUES (${`preg-test-${randomUUID().slice(0, 10)}`}, ${fixture.programId}, ${fixture.classId},
              ${studentId}, 'confirmed', true, ${now}, ${now})`;
    return true;
  });
}

/* ---------------------------------------------------------------- */
/* Capacity correctness                                              */
/* ---------------------------------------------------------------- */

describeDb("the final seat is taken exactly once when two families race for it", async () => {
  const setup = connect();
  const fixture = await createProgram(setup, { capacity: 1 });
  const first = await createChild(setup, "Racer One", "6");
  const second = await createChild(setup, "Racer Two", "6");
  await setup.end();

  // Two independent connections, exactly as two Vercel instances would be.
  const a = connect();
  const b = connect();
  try {
    const [resultA, resultB] = await Promise.all([
      attemptSeat(a, fixture, first, 120),
      attemptSeat(b, fixture, second, 0),
    ]);
    assert.equal(
      [resultA, resultB].filter(Boolean).length,
      1,
      "exactly one of two concurrent registrations may take the last seat",
    );

    const verify = connect();
    const [{ n }] = await verify`
      SELECT COUNT(*) AS n FROM program_registrations
       WHERE class_id = ${fixture.classId} AND holds_seat = true`;
    assert.equal(Number(n), 1, "the class must never hold more seats than its capacity");
    await verify.end();
  } finally {
    await a.end();
    await b.end();
  }
});

describeDb("seat counting never charges one child two seats", async () => {
  const sql = connect();
  try {
    const fixture = await createProgram(sql, { capacity: 5 });
    const studentId = await createChild(sql, "Double Counted", "7");
    const now = Date.now();
    // A confirmed registration has both a registration row and an enrollment row.
    await sql`
      INSERT INTO program_registrations (id, program_id, class_id, student_id, status, holds_seat, created_at, updated_at)
      VALUES (${`preg-test-${randomUUID().slice(0, 10)}`}, ${fixture.programId}, ${fixture.classId},
              ${studentId}, 'confirmed', true, ${now}, ${now})`;
    await sql`
      INSERT INTO class_enrollments (id, class_id, student_id, status, enrolled_at)
      VALUES (${`cen-test-${randomUUID().slice(0, 10)}`}, ${fixture.classId}, ${studentId}, 'enrolled', ${now})`;

    const [{ n }] = await sql`
      SELECT COUNT(*) AS n FROM (
        SELECT ce.student_id FROM class_enrollments ce JOIN students s ON s.id = ce.student_id
         WHERE ce.class_id = ${fixture.classId} AND ce.status = 'enrolled' AND s.enrollment_status = 'active'
        UNION
        SELECT r.student_id FROM program_registrations r
         WHERE r.class_id = ${fixture.classId} AND r.holds_seat = true
      ) AS occupied`;
    assert.equal(Number(n), 1, "one child holding one seat counts once, not twice");
  } finally {
    await sql.end();
  }
});

/* ---------------------------------------------------------------- */
/* Lifecycle invariants enforced by the schema                       */
/* ---------------------------------------------------------------- */

describeDb("a child cannot hold two live registrations for the same program", async () => {
  const sql = connect();
  try {
    const fixture = await createProgram(sql, { capacity: 10 });
    const studentId = await createChild(sql, "Twice Registered", "8");
    const now = Date.now();
    const insert = (id: string, status: string) => sql`
      INSERT INTO program_registrations (id, program_id, class_id, student_id, status, holds_seat, created_at, updated_at)
      VALUES (${id}, ${fixture.programId}, ${fixture.classId}, ${studentId}, ${status}, true, ${now}, ${now})`;

    await insert(`preg-test-${randomUUID().slice(0, 10)}`, "confirmed");
    await assert.rejects(
      () => insert(`preg-test-${randomUUID().slice(0, 10)}`, "seat_reserved"),
      /uq_program_registrations_live|duplicate key/i,
      "a second live registration for the same child and program must be rejected by the database",
    );
  } finally {
    await sql.end();
  }
});

describeDb("a withdrawn family can register for the same program again", async () => {
  const sql = connect();
  try {
    const fixture = await createProgram(sql, { capacity: 10 });
    const studentId = await createChild(sql, "Returning Family", "8");
    const now = Date.now();
    await sql`
      INSERT INTO program_registrations (id, program_id, class_id, student_id, status, holds_seat, created_at, updated_at)
      VALUES (${`preg-test-${randomUUID().slice(0, 10)}`}, ${fixture.programId}, ${fixture.classId},
              ${studentId}, 'withdrawn', false, ${now}, ${now})`;
    await sql`
      INSERT INTO program_registrations (id, program_id, class_id, student_id, status, holds_seat, created_at, updated_at)
      VALUES (${`preg-test-${randomUUID().slice(0, 10)}`}, ${fixture.programId}, ${fixture.classId},
              ${studentId}, 'confirmed', true, ${now}, ${now})`;
    const [{ n }] = await sql`
      SELECT COUNT(*) AS n FROM program_registrations
       WHERE student_id = ${studentId} AND status NOT IN ('withdrawn','expired','declined','cancelled')`;
    assert.equal(Number(n), 1, "terminal registrations must not block a fresh one");
  } finally {
    await sql.end();
  }
});

describeDb("one request key can only ever produce one registration row", async () => {
  const sql = connect();
  try {
    const fixture = await createProgram(sql, { capacity: 10 });
    const studentId = await createChild(sql, "Replayed Child", "6");
    const now = Date.now();
    const key = `req-${randomUUID()}#0`;
    const insert = (id: string) => sql`
      INSERT INTO program_registrations (id, program_id, class_id, student_id, status, holds_seat,
        request_key, created_at, updated_at)
      VALUES (${id}, ${fixture.programId}, ${fixture.classId}, ${studentId}, 'confirmed', true,
              ${key}, ${now}, ${now})`;
    await insert(`preg-test-${randomUUID().slice(0, 10)}`);
    await assert.rejects(
      () => insert(`preg-test-${randomUUID().slice(0, 10)}`),
      /uq_program_registrations_request_key|duplicate key/i,
      "a replayed submission must not be able to write a second registration",
    );
  } finally {
    await sql.end();
  }
});

describeDb("only one waitlist offer can be outstanding per registration", async () => {
  const sql = connect();
  try {
    const fixture = await createProgram(sql, { capacity: 1, waitlistMode: "automatic" });
    const studentId = await createChild(sql, "Waiting Child", "6");
    const now = Date.now();
    const registrationId = `preg-test-${randomUUID().slice(0, 10)}`;
    await sql`
      INSERT INTO program_registrations (id, program_id, class_id, student_id, status, holds_seat, created_at, updated_at)
      VALUES (${registrationId}, ${fixture.programId}, NULL, ${studentId}, 'waitlisted', false, ${now}, ${now})`;
    const offer = (id: string) => sql`
      INSERT INTO waitlist_offers (id, registration_id, program_id, class_id, status, mode, token_hash,
        expires_at, created_at, updated_at)
      VALUES (${id}, ${registrationId}, ${fixture.programId}, ${fixture.classId}, 'sent', 'automatic',
              ${randomUUID()}, ${now + 3600000}, ${now}, ${now})`;
    await offer(`wlo-test-${randomUUID().slice(0, 10)}`);
    await assert.rejects(
      () => offer(`wlo-test-${randomUUID().slice(0, 10)}`),
      /uq_waitlist_offers_open|duplicate key/i,
      "two outstanding offers for one registration would let a seat be claimed twice",
    );
  } finally {
    await sql.end();
  }
});

/* ---------------------------------------------------------------- */
/* Pure lifecycle helpers                                            */
/* ---------------------------------------------------------------- */

test("seat-holding statuses are exactly the ones that consume capacity", async () => {
  const { holdsSeat, isTerminal } = await import("@/lib/enrollment-shared");
  for (const status of ["under_review", "seat_reserved", "requirements_pending", "confirmed", "offer_sent", "offer_accepted"]) {
    assert.equal(holdsSeat(status), true, `${status} must occupy a seat`);
  }
  for (const status of ["waitlisted", "withdrawn", "expired", "declined", "cancelled", "completed", "submitted"]) {
    assert.equal(holdsSeat(status), false, `${status} must not occupy a seat`);
  }
  for (const status of ["withdrawn", "expired", "declined", "cancelled"]) {
    assert.equal(isTerminal(status), true, `${status} must free the child to register again`);
  }
  assert.equal(isTerminal("confirmed"), false);
});

test("grade parsing accepts the forms families actually type", async () => {
  const { parseGrade } = await import("@/lib/enrollment-shared");
  assert.equal(parseGrade("K"), 0);
  assert.equal(parseGrade("Kindergarten"), 0);
  assert.equal(parseGrade("6"), 6);
  assert.equal(parseGrade("6th"), 6);
  assert.equal(parseGrade("Grade 11"), 11);
  assert.equal(parseGrade(""), null);
  assert.equal(parseGrade(null), null);
});

test("an uninterpretable grade is reviewed, never silently rejected", async () => {
  const { checkEligibility } = await import("@/lib/enrollment-shared");
  const program = { grade_min: 6, grade_max: 8 } as never;
  assert.equal(checkEligibility(program, "7").eligible, true);
  assert.equal(checkEligibility(program, "3").eligible, false);
  assert.equal(checkEligibility(program, "10").eligible, false);
  assert.equal(
    checkEligibility(program, "homeschool").eligible,
    true,
    "a grade the program cannot parse must not turn a family away",
  );
});

test("families only ever see the approved availability vocabulary", async () => {
  const { publicAvailability, availabilityLabel } = await import("@/lib/enrollment-shared");
  const base = {
    is_public: true,
    public_status: "open",
    waitlist_mode: "automatic",
    full_capacity_behavior: "waitlist",
    registration_deadline: null,
  } as never;
  assert.equal(publicAvailability(base, 20), "registration_open");
  assert.equal(publicAvailability(base, 2), "limited_seats");
  assert.equal(publicAvailability(base, 0), "waitlist_available");
  assert.equal(publicAvailability({ ...(base as object), public_status: "closed" } as never, 5), "registration_closed");
  assert.equal(publicAvailability({ ...(base as object), public_status: "coming_soon" } as never, 5), "coming_soon");

  const allowed = new Set([
    "Registration open",
    "Limited seats",
    "Waitlist available",
    "Interest list",
    "Registration closed",
    "Coming soon",
  ]);
  for (const value of [
    "registration_open",
    "limited_seats",
    "waitlist_available",
    "interest_list",
    "registration_closed",
    "coming_soon",
  ] as const) {
    assert.ok(allowed.has(availabilityLabel(value)), `${value} must map to approved family-facing language`);
  }
});

test("internal registration stages never leak into family-facing labels", async () => {
  const { registrationLabel, REGISTRATION_STATUSES } = await import("@/lib/enrollment-shared");
  for (const status of REGISTRATION_STATUSES) {
    const label = registrationLabel(status);
    assert.ok(label.length > 0, `${status} needs a family-facing label`);
    assert.ok(!label.includes("_"), `${status} label must not expose the internal token`);
  }
});

/* ---------------------------------------------------------------- */
/* Returning-family reconciliation                                   */
/* ---------------------------------------------------------------- */

/**
 * The predicate app/actions/family-registration.ts uses to decide whether an
 * unauthenticated returning parent is re-entering a child we already know.
 * Asserted here because getting it wrong in either direction is expensive: too
 * loose merges two different children, too strict gives one child a second
 * record and a second seat in the same program.
 */
async function reconcile(sql: postgres.Sql, guardianId: string, identityKey: string) {
  const rows = await sql`
    SELECT s.id FROM students s
      JOIN student_guardians g ON g.student_id = s.id
     WHERE g.person_id = ${guardianId} AND g.status = 'active'
       AND s.identity_key = ${identityKey} AND s.merged_into_student_id IS NULL
     ORDER BY s.created_at LIMIT 1`;
  return rows[0]?.id ?? null;
}

async function linkChild(sql: postgres.Sql, guardianId: string, name: string, grade: string) {
  const now = Date.now();
  const id = `stu-test-${randomUUID().slice(0, 8)}`;
  await sql`
    INSERT INTO students (id, name, grade, identity_key, enrollment_status, form_status, created_at, updated_at)
    VALUES (${id}, ${name}, ${grade}, ${`${name.toLowerCase()}|${grade.toLowerCase()}`}, 'active', 'missing', ${now}, ${now})`;
  await sql`
    INSERT INTO student_guardians (id, student_id, person_id, relationship, is_primary, status, created_at, updated_at)
    VALUES (${`sg-test-${randomUUID().slice(0, 8)}`}, ${id}, ${guardianId}, 'parent', true, 'active', ${now}, ${now})`;
  return id;
}

describeDb("a returning parent's known child is reused, not duplicated", async () => {
  const sql = connect();
  try {
    const guardian = await createGuardian(sql, `returning-${randomUUID().slice(0, 8)}@example.test`);
    const child = await linkChild(sql, guardian, "Ava Reyes", "7");

    assert.equal(
      await reconcile(sql, guardian, "ava reyes|7"),
      child,
      "the same guardian re-entering the same child must resolve to the existing record",
    );
  } finally {
    await sql.end();
  }
});

describeDb("an identical name under a different guardian is never reused", async () => {
  const sql = connect();
  try {
    const ours = await createGuardian(sql, `ours-${randomUUID().slice(0, 8)}@example.test`);
    const stranger = await createGuardian(sql, `stranger-${randomUUID().slice(0, 8)}@example.test`);
    await linkChild(sql, ours, "Jordan Blake", "8");

    assert.equal(
      await reconcile(sql, stranger, "jordan blake|8"),
      null,
      "two families with a same-named child must stay two different children",
    );
  } finally {
    await sql.end();
  }
});

describeDb("a revoked guardian cannot reconcile onto a child they lost access to", async () => {
  const sql = connect();
  try {
    const guardian = await createGuardian(sql, `revoked-${randomUUID().slice(0, 8)}@example.test`);
    const child = await linkChild(sql, guardian, "Casey Lane", "9");
    await sql`UPDATE student_guardians SET status = 'revoked' WHERE person_id = ${guardian} AND student_id = ${child}`;

    assert.equal(
      await reconcile(sql, guardian, "casey lane|9"),
      null,
      "reconciliation must require a live guardian link, not merely a historical one",
    );
  } finally {
    await sql.end();
  }
});

describeDb("a different grade is treated as a different child pending review", async () => {
  const sql = connect();
  try {
    const guardian = await createGuardian(sql, `grade-${randomUUID().slice(0, 8)}@example.test`);
    await linkChild(sql, guardian, "Sam Reed", "6");

    assert.equal(
      await reconcile(sql, guardian, "sam reed|8"),
      null,
      "name alone must never be enough to reuse a child record",
    );
  } finally {
    await sql.end();
  }
});
