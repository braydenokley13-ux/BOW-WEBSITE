/* ============================================================
 * Family communications delivery — retry idempotency, notification kind
 * completeness, expired-link suppression, sweep failure isolation, and
 * environment validation.
 *
 * Requires a local database (npm run db:setup). Skips cleanly when
 * POSTGRES_URL is not local, matching tests/registration-engine.test.ts and
 * tests/family-permissions.test.ts.
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
  test("family communications tests skipped (no local POSTGRES_URL)", () => assert.ok(true));
}

/* ---------------------------------------------------------------- */
/* Fixtures                                                          */
/* ---------------------------------------------------------------- */

async function makeProgram(): Promise<{ programId: string; classId: string }> {
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const now = Date.now();
  const programId = `prg-comm-${randomUUID().slice(0, 8)}`;
  const classId = `cls-comm-${randomUUID().slice(0, 8)}`;
  await db
    .prepare(
      `INSERT INTO programs (id, name, stage, minimum_enrollment, partner_confirmed, materials_status,
         renewal_status, created_at, updated_at, is_public, public_status, capacity, registration_mode,
         full_capacity_behavior, reservation_enabled, reservation_hours, waitlist_mode,
         waitlist_offer_hours)
       VALUES (?, 'Comms Program', 'delivery', 1, 0, 'ready', 'not_due', ?, ?, true, 'open', 5, 'immediate',
               'waitlist', true, 48, 'automatic', 48)`,
    )
    .run(programId, now, now);
  await db
    .prepare(
      `INSERT INTO classes (id, title, program_id, status, minimum_enrollment, capacity, created_at, updated_at)
       VALUES (?, 'Comms Class', ?, 'planning', 1, 5, ?, ?)`,
    )
    .run(classId, programId, now, now);
  return { programId, classId };
}

async function makeGuardian(withEmail = true): Promise<string> {
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const now = Date.now();
  const id = `per-comm-${randomUUID().slice(0, 8)}`;
  const email = withEmail ? `comm-${randomUUID().slice(0, 8)}@example.test` : null;
  await db
    .prepare("INSERT INTO people (id, name, email, phone, created_at, updated_at) VALUES (?, 'Comms Guardian', ?, '', ?, ?)")
    .run(id, email, now, now);
  return id;
}

async function makeChild(): Promise<string> {
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const now = Date.now();
  const id = `stu-comm-${randomUUID().slice(0, 8)}`;
  await db
    .prepare(
      `INSERT INTO students (id, name, grade, enrollment_status, form_status, created_at, updated_at)
       VALUES (?, 'Comms Child', '7', 'active', 'missing', ?, ?)`,
    )
    .run(id, now, now);
  return id;
}

async function makeRegistration(
  programId: string,
  classId: string,
  studentId: string,
  guardianId: string,
  status: string,
  reservationExpiresAt: number | null = null,
): Promise<string> {
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const now = Date.now();
  const id = `reg-comm-${randomUUID().slice(0, 8)}`;
  await db
    .prepare(
      `INSERT INTO program_registrations
         (id, student_id, program_id, class_id, guardian_person_id, status, holds_seat,
          reservation_expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, true, ?, ?, ?)`,
    )
    .run(id, studentId, programId, classId, guardianId, status, reservationExpiresAt, now, now);
  return id;
}

async function makeNotification(input: {
  kind: string;
  personId: string;
  studentId: string;
  programId: string;
  registrationId: string;
  actionHref?: string | null;
}): Promise<string> {
  const { recordNotification } = await import("@/lib/enrollment");
  return recordNotification({
    personId: input.personId,
    studentId: input.studentId,
    programId: input.programId,
    registrationId: input.registrationId,
    kind: input.kind,
    title: "Test notification",
    body: "Test body.",
    actionLabel: input.actionHref ? "Take action" : undefined,
    actionHref: input.actionHref ?? undefined,
  });
}

async function notificationRow(id: string) {
  const { getDb } = await import("@/lib/db");
  const row = await getDb()
    .prepare(
      "SELECT email_status, delivery_attempts, last_attempt_at, last_retry_by_user_id FROM family_notifications WHERE id = ?",
    )
    .get(id);
  return row as unknown as
    | { email_status: string; delivery_attempts: number; last_attempt_at: number | null; last_retry_by_user_id: string | null }
    | undefined;
}

/* ---------------------------------------------------------------- */
/* Notification kind completeness                                    */
/* ---------------------------------------------------------------- */

dbTest("NOTIFICATION_KINDS covers the full required family-facing message set", async () => {
  const { NOTIFICATION_KINDS } = await import("@/lib/family-communications");
  const required = [
    "registration_received",
    "registration_confirmed",
    "seat_reserved",
    "registration_waitlisted",
    "interest_recorded",
    "activation_invitation",
    "student_invitation",
    "reservation_reminder",
    "reservation_expired",
    "requirement_missing",
    "requirement_approved",
    "requirement_correction",
    "waitlist_offer",
    "offer_reminder",
    "offer_expired",
    "schedule_change",
    "location_change",
    "session_cancelled",
    "program_cancelled",
    "first_session_reminder",
    "withdrawal_processed",
    "transfer_requested",
    "transfer_approved",
    "transfer_declined",
    "absence_acknowledged",
    "program_completed",
    "certificate_issued",
    "next_recommendation",
  ];
  for (const kind of required) {
    assert.ok(kind in NOTIFICATION_KINDS, `missing notification kind: ${kind}`);
  }
});

dbTest("a reserved seat never carries confirmation language in its kind label", async () => {
  const { NOTIFICATION_KINDS } = await import("@/lib/family-communications");
  const label = NOTIFICATION_KINDS.seat_reserved?.label ?? "";
  assert.ok(!/\bconfirm/i.test(label), `seat_reserved label must not read as a confirmation, got: "${label}"`);
});

dbTest("ALWAYS_EMAIL covers cancellation, emergency location change, expiring offers, and urgent missing requirements", async () => {
  const { mustEmail } = await import("@/lib/family-communications");
  assert.equal(mustEmail("program_cancelled"), true);
  assert.equal(mustEmail("session_cancelled"), true);
  assert.equal(mustEmail("location_change"), true);
  assert.equal(mustEmail("offer_reminder"), true);
  assert.equal(mustEmail("offer_expired"), true);
  assert.equal(mustEmail("requirement_missing"), true);
});

/* ---------------------------------------------------------------- */
/* Retry idempotency                                                  */
/* ---------------------------------------------------------------- */

dbTest("retrying delivery does not re-run the business mutation or double-charge a seat", async () => {
  const fixture = await makeProgram();
  const guardian = await makeGuardian();
  const child = await makeChild();
  const registrationId = await makeRegistration(fixture.programId, fixture.classId, child, guardian, "confirmed");
  const notificationId = await makeNotification({
    kind: "registration_confirmed",
    personId: guardian,
    studentId: child,
    programId: fixture.programId,
    registrationId,
  });

  const { retryNotification } = await import("@/lib/family-communications");
  const { getDb } = await import("@/lib/db");
  const db = getDb();

  const before = (await db.prepare("SELECT status, holds_seat FROM program_registrations WHERE id = ?").get(registrationId)) as {
    status: string;
    holds_seat: boolean;
  };

  await retryNotification(notificationId, "staff-1");
  await retryNotification(notificationId, "staff-2");

  const after = (await db.prepare("SELECT status, holds_seat FROM program_registrations WHERE id = ?").get(registrationId)) as {
    status: string;
    holds_seat: boolean;
  };
  assert.deepEqual(after, before, "retrying a notification must never change the registration it describes");

  const row = await notificationRow(notificationId);
  assert.ok(row);
  assert.equal(row!.delivery_attempts >= 2, true, "each retry must count as its own delivery attempt");
  assert.equal(row!.last_retry_by_user_id, "staff-2", "the most recent retry actor must be recorded");
});

dbTest("delivery attempts and last_attempt_at advance on every send, including skips", async () => {
  const fixture = await makeProgram();
  const guardian = await makeGuardian(false); // no email on file -> always skipped
  const child = await makeChild();
  const registrationId = await makeRegistration(fixture.programId, fixture.classId, child, guardian, "confirmed");
  const notificationId = await makeNotification({
    kind: "registration_confirmed",
    personId: guardian,
    studentId: child,
    programId: fixture.programId,
    registrationId,
  });

  const before = await notificationRow(notificationId);
  assert.equal(before?.delivery_attempts, 0);

  const { deliverNotification } = await import("@/lib/family-communications");
  const status = await deliverNotification(notificationId);
  assert.equal(status, "skipped");

  const after = await notificationRow(notificationId);
  assert.equal(after?.delivery_attempts, 1);
  assert.ok(after?.last_attempt_at, "last_attempt_at must be stamped even on a skipped attempt");
});

/* ---------------------------------------------------------------- */
/* Expired-link suppression                                          */
/* ---------------------------------------------------------------- */

dbTest("a retry never sends a reservation link whose deadline has already passed", async () => {
  const fixture = await makeProgram();
  const guardian = await makeGuardian();
  const child = await makeChild();
  // Reservation deadline already in the past.
  const registrationId = await makeRegistration(
    fixture.programId,
    fixture.classId,
    child,
    guardian,
    "seat_reserved",
    Date.now() - 1000,
  );
  const notificationId = await makeNotification({
    kind: "reservation_reminder",
    personId: guardian,
    studentId: child,
    programId: fixture.programId,
    registrationId,
    actionHref: "/family",
  });

  const { deliverNotification } = await import("@/lib/family-communications");
  const status = await deliverNotification(notificationId);
  assert.equal(status, "skipped", "an expired reservation reminder must be suppressed, not sent as if the deadline still stood");

  const row = await notificationRow(notificationId);
  assert.equal(row?.email_status, "skipped");
});

dbTest("a waitlist offer message is suppressed once the offer it points to is no longer open", async () => {
  const fixture = await makeProgram();
  const guardian = await makeGuardian();
  const child = await makeChild();
  const registrationId = await makeRegistration(fixture.programId, fixture.classId, child, guardian, "waitlisted");

  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const now = Date.now();
  const offerId = `wof-comm-${randomUUID().slice(0, 8)}`;
  await db
    .prepare(
      `INSERT INTO waitlist_offers (id, registration_id, program_id, class_id, status, mode, token_hash,
         expires_at, responded_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'expired', 'automatic', 'hash', ?, ?, ?, ?)`,
    )
    .run(offerId, registrationId, fixture.programId, fixture.classId, now - 1000, now, now, now);

  const notificationId = await makeNotification({
    kind: "waitlist_offer",
    personId: guardian,
    studentId: child,
    programId: fixture.programId,
    registrationId,
    actionHref: `/family/offers/${offerId}`,
  });

  const { deliverNotification } = await import("@/lib/family-communications");
  const status = await deliverNotification(notificationId);
  assert.equal(status, "skipped", "a message about an offer that already expired must not be sent as an active offer");
});

/* ---------------------------------------------------------------- */
/* Sweep failure isolation                                           */
/* ---------------------------------------------------------------- */

dbTest("reservation sweep processes every program's expired reservations even when one program's refill has nothing to do", async () => {
  // refillFromWaitlist runs inside a per-program try/catch in sweepExpirations
  // (lib/enrollment.ts) specifically so one program throwing there cannot stop
  // another program's expirations from being processed in the same pass. This
  // exercises the multi-program path end-to-end: both programs' stale
  // reservations must expire regardless of what their independent refill
  // passes find.
  const good = await makeProgram();
  const guardianGood = await makeGuardian();
  const childGood = await makeChild();
  await makeRegistration(good.programId, good.classId, childGood, guardianGood, "seat_reserved", Date.now() - 1000);

  const other = await makeProgram();
  const guardianOther = await makeGuardian();
  const childOther = await makeChild();
  await makeRegistration(other.programId, other.classId, childOther, guardianOther, "seat_reserved", Date.now() - 1000);

  // Remove the second program's class entirely, so its refill pass finds no
  // primary class (a real "broken program" condition) while the first
  // program's class stays intact.
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  await db.prepare("DELETE FROM classes WHERE program_id = ? AND id = ?").run(other.programId, other.classId);

  const { sweepExpirations } = await import("@/lib/enrollment");
  const result = await sweepExpirations();
  assert.equal(result.expired >= 2, true, "both stale reservations must be expired regardless of the other program's refill state");

  const goodRow = (await db.prepare("SELECT status FROM program_registrations WHERE student_id = ?").get(childGood)) as {
    status: string;
  };
  const otherRow = (await db.prepare("SELECT status FROM program_registrations WHERE student_id = ?").get(childOther)) as {
    status: string;
  };
  assert.equal(goodRow.status, "expired");
  assert.equal(otherRow.status, "expired", "a program with no primary class must still have its own expired reservation released");
});

/* ---------------------------------------------------------------- */
/* Environment validation                                            */
/* ---------------------------------------------------------------- */

test("environment validation reports missing config as structured results, never throws", async () => {
  // NODE_ENV is deliberately not touched: it is non-configurable under the test
  // runner, and restoring it is not worth the coupling. The cron check is
  // asserted on its non-production branch instead, which is the branch this
  // suite actually runs in.
  const saved = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    BOW_EMAIL_FROM: process.env.BOW_EMAIL_FROM,
    BOW_RESET_EMAIL_FROM: process.env.BOW_RESET_EMAIL_FROM,
    BOW_APP_URL: process.env.BOW_APP_URL,
    CRON_SECRET: process.env.CRON_SECRET,
  };
  const restore = () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };

  try {
    delete process.env.RESEND_API_KEY;
    delete process.env.BOW_EMAIL_FROM;
    delete process.env.BOW_RESET_EMAIL_FROM;
    delete process.env.BOW_APP_URL;
    delete process.env.CRON_SECRET;

    // Awaited, not returned from a try/finally — a returned promise would let
    // the restore below run before validation had read the environment.
    const { validateEnvironment } = await import("@/lib/env-validation");
    const result = validateEnvironment();

    assert.equal(result.ok, false);
    const sender = result.checks.find((c) => c.area === "email_sender");
    assert.ok(sender);
    assert.equal(sender!.status, "missing");
    assert.ok(sender!.impact && sender!.impact.length > 0, "a missing check must explain what breaks");

    // Never silently fine: an unset cron secret is at minimum degraded, and it
    // must say so rather than reporting ok.
    const cron = result.checks.find((c) => c.area === "cron_auth");
    assert.ok(cron);
    assert.notEqual(cron!.status, "ok");
    assert.ok(cron!.impact, "a degraded check must still explain the risk");
  } finally {
    restore();
  }
});

test("environment validation passes when required variables are present", async () => {
  const originalEnv = { ...process.env };
  try {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.BOW_EMAIL_FROM = "BOW Sports Capital <hello@bowsportscapital.com>";
    process.env.BOW_APP_URL = "https://bowsportscapital.com";
    process.env.CRON_SECRET = "a-long-secret-value";
    process.env.POSTGRES_URL = "postgres://user:pass@localhost:5432/db";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project-ref.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    delete process.env.BOW_TRUSTED_CLIENT_IP_HEADER;

    const { validateEnvironment } = await import("@/lib/env-validation");
    const result = validateEnvironment();
    assert.equal(result.ok, true);
    assert.ok(result.checks.every((c) => c.status === "ok"));
  } finally {
    process.env = originalEnv;
  }
});
