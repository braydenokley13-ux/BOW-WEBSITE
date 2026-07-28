/* ============================================================
 * Family permission boundaries — negative tests against a real Postgres.
 *
 * Every assertion here is about something that must NOT be possible. A
 * positive test that a parent can see their own child passes just as well
 * against a system with no authorization at all, so the boundaries are what
 * is actually worth testing.
 *
 * Requires a local database (npm run db:setup). Skips cleanly when
 * POSTGRES_URL is not local.
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
  test("family permission tests skipped (no local POSTGRES_URL)", () => assert.ok(true));
}

/* ---------------------------------------------------------------- */
/* Fixtures                                                          */
/* ---------------------------------------------------------------- */

async function makeGuardian(label: string): Promise<{ personId: string; email: string }> {
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const now = Date.now();
  const personId = `per-perm-${randomUUID().slice(0, 8)}`;
  const email = `${label}-${randomUUID().slice(0, 8)}@example.test`;
  await db
    .prepare("INSERT INTO people (id, name, email, phone, created_at, updated_at) VALUES (?, ?, ?, '', ?, ?)")
    .run(personId, `${label} Guardian`, email, now, now);
  return { personId, email };
}

async function makeChildOf(personId: string, name: string, status: "active" | "revoked" = "active"): Promise<string> {
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const now = Date.now();
  const studentId = `stu-perm-${randomUUID().slice(0, 8)}`;
  await db
    .prepare(
      `INSERT INTO students (id, name, grade, enrollment_status, form_status, guardian_person_id, created_at, updated_at)
       VALUES (?, ?, '7', 'active', 'missing', ?, ?, ?)`,
    )
    .run(studentId, name, personId, now, now);
  await db
    .prepare(
      `INSERT INTO student_guardians (id, student_id, person_id, relationship, is_primary, status, created_at, updated_at)
       VALUES (?, ?, ?, 'parent', true, ?, ?, ?)`,
    )
    .run(`sg-perm-${randomUUID().slice(0, 8)}`, studentId, personId, status, now, now);
  return studentId;
}

/* ---------------------------------------------------------------- */
/* Family scope                                                      */
/* ---------------------------------------------------------------- */

dbTest("a parent cannot reach a child belonging to another family", async () => {
  const { guardianCanAccessStudent } = await import("@/lib/parent-activation");
  const ours = await makeGuardian("ours");
  const theirs = await makeGuardian("theirs");
  const ourChild = await makeChildOf(ours.personId, "Our Child");
  const theirChild = await makeChildOf(theirs.personId, "Their Child");

  assert.equal(await guardianCanAccessStudent(ours.personId, ourChild), true);
  assert.equal(
    await guardianCanAccessStudent(ours.personId, theirChild),
    false,
    "changing a student id in a URL must not reveal another family's child",
  );
  assert.equal(await guardianCanAccessStudent(theirs.personId, ourChild), false);
});

dbTest("a revoked guardian loses access immediately", async () => {
  const { guardianCanAccessStudent, studentIdsForGuardian } = await import("@/lib/parent-activation");
  const guardian = await makeGuardian("revoked");
  const child = await makeChildOf(guardian.personId, "Formerly Visible");
  assert.equal(await guardianCanAccessStudent(guardian.personId, child), true);

  const { getDb } = await import("@/lib/db");
  await getDb()
    .prepare("UPDATE student_guardians SET status = 'revoked', updated_at = ? WHERE person_id = ? AND student_id = ?")
    .run(Date.now(), guardian.personId, child);

  assert.equal(
    await guardianCanAccessStudent(guardian.personId, child),
    false,
    "revoking guardian access must take effect without waiting for a session to expire",
  );
  assert.equal(
    (await studentIdsForGuardian(guardian.personId)).includes(child),
    false,
    "a revoked child must disappear from the guardian's family scope",
  );
});

dbTest("an invited-but-unaccepted guardian has no access yet", async () => {
  const { guardianCanAccessStudent } = await import("@/lib/parent-activation");
  const guardian = await makeGuardian("invited");
  const child = await makeChildOf(guardian.personId, "Pending Access");

  const { getDb } = await import("@/lib/db");
  await getDb()
    .prepare("UPDATE student_guardians SET status = 'invited', updated_at = ? WHERE person_id = ? AND student_id = ?")
    .run(Date.now(), guardian.personId, child);

  assert.equal(
    await guardianCanAccessStudent(guardian.personId, child),
    false,
    "an outstanding guardian invitation is not yet a grant of access",
  );
});

dbTest("family scope contains only this guardian's own children", async () => {
  const { studentIdsForGuardian } = await import("@/lib/parent-activation");
  const guardian = await makeGuardian("siblings");
  const other = await makeGuardian("stranger");
  const first = await makeChildOf(guardian.personId, "Sibling One");
  const second = await makeChildOf(guardian.personId, "Sibling Two");
  const foreign = await makeChildOf(other.personId, "Not Related");

  const scope = await studentIdsForGuardian(guardian.personId);
  assert.ok(scope.includes(first) && scope.includes(second), "both siblings belong to one family");
  assert.equal(scope.includes(foreign), false, "another family's child must never enter the scope");
});

dbTest("a child with two guardians is visible to both, independently", async () => {
  const { guardianCanAccessStudent } = await import("@/lib/parent-activation");
  const first = await makeGuardian("parent-one");
  const second = await makeGuardian("parent-two");
  const child = await makeChildOf(first.personId, "Two Parents");

  const { getDb } = await import("@/lib/db");
  const now = Date.now();
  await getDb()
    .prepare(
      `INSERT INTO student_guardians (id, student_id, person_id, relationship, is_primary, status, created_at, updated_at)
       VALUES (?, ?, ?, 'parent', false, 'active', ?, ?)`,
    )
    .run(`sg-perm-${randomUUID().slice(0, 8)}`, child, second.personId, now, now);

  assert.equal(await guardianCanAccessStudent(first.personId, child), true);
  assert.equal(await guardianCanAccessStudent(second.personId, child), true);

  // Revoking one guardian must not affect the other.
  await getDb()
    .prepare("UPDATE student_guardians SET status = 'revoked' WHERE person_id = ? AND student_id = ?")
    .run(second.personId, child);
  assert.equal(await guardianCanAccessStudent(first.personId, child), true, "revoking one guardian must not remove the other");
  assert.equal(await guardianCanAccessStudent(second.personId, child), false);
});

/* ---------------------------------------------------------------- */
/* Activation                                                        */
/* ---------------------------------------------------------------- */

dbTest("a family activation link can never claim a staff account", async () => {
  const { queueActivation } = await import("@/lib/parent-activation");
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const now = Date.now();

  const guardian = await makeGuardian("staff-collision");
  const orgRow = (await db.prepare("SELECT id FROM organizations LIMIT 1").get()) as { id: string } | undefined;
  const orgId = orgRow?.id ?? "org-bow";
  if (!orgRow) {
    await db
      .prepare("INSERT INTO organizations (id, name, type, location, status) VALUES (?, 'Test Org', 'school', 'Local', 'active') ON CONFLICT (id) DO NOTHING")
      .run(orgId);
  }
  await db
    .prepare(
      `INSERT INTO users (id, name, first, email, role, org_id, status, last, signin, created_at)
       VALUES (?, 'Staff Person', 'Staff', ?, 'admin', ?, 'active', 'Just now', 'Email + password', ?)`,
    )
    .run(`usr-perm-${randomUUID().slice(0, 8)}`, guardian.email, orgId, now);

  const ticket = await queueActivation(guardian.personId, guardian.email);
  assert.equal(ticket, null, "no activation token may be issued for an email that belongs to a staff account");

  const activation = (await db
    .prepare("SELECT state FROM parent_activations WHERE person_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(guardian.personId)) as { state: string } | undefined;
  assert.equal(
    activation?.state,
    "support_required",
    "the collision must surface as a support case rather than silently doing nothing",
  );
});

dbTest("an expired activation link cannot be used", async () => {
  const { queueActivation, inspectActivation } = await import("@/lib/parent-activation");
  const guardian = await makeGuardian("expiring");
  const ticket = await queueActivation(guardian.personId, guardian.email);
  assert.ok(ticket, "a fresh guardian must receive an activation ticket");

  const valid = await inspectActivation(ticket.token);
  assert.equal(valid?.state, "invitation_pending");

  const { getDb } = await import("@/lib/db");
  await getDb()
    .prepare("UPDATE parent_activations SET expires_at = ? WHERE id = ?")
    .run(Date.now() - 1000, ticket.id);

  const expired = await inspectActivation(ticket.token);
  assert.equal(expired?.state, "expired", "a link past its deadline must read as expired, not as usable");
});

dbTest("a completed activation cannot be replayed to re-open a family", async () => {
  const { queueActivation, inspectActivation, linkFamilyToAccount } = await import("@/lib/parent-activation");
  const guardian = await makeGuardian("replayed");
  await makeChildOf(guardian.personId, "Linked Child");
  const ticket = await queueActivation(guardian.personId, guardian.email);
  assert.ok(ticket);

  const userId = `usr-perm-${randomUUID().slice(0, 8)}`;
  const linked = await linkFamilyToAccount(ticket.id, guardian.personId, userId);
  assert.equal(linked, 1, "activation must link the guardian's children");

  const afterUse = await inspectActivation(ticket.token);
  assert.equal(afterUse?.state, "complete", "a consumed link must report as already used rather than valid");

  // A second invitation is not issued for an already-activated guardian.
  const second = await queueActivation(guardian.personId, guardian.email);
  assert.equal(second, null, "an activated guardian must not be handed another activation token");
});

dbTest("an unknown or malformed activation token resolves to nothing", async () => {
  const { inspectActivation } = await import("@/lib/parent-activation");
  assert.equal(await inspectActivation(""), null);
  assert.equal(await inspectActivation("short"), null);
  assert.equal(await inspectActivation(randomUUID().repeat(2).replace(/-/g, "")), null);
});

/* ---------------------------------------------------------------- */
/* Sensitive requirement visibility                                  */
/* ---------------------------------------------------------------- */

dbTest("instructor-visible requirements exclude the sensitive ones by default", async () => {
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const now = Date.now();
  const programId = `prg-perm-${randomUUID().slice(0, 8)}`;
  await db
    .prepare(
      `INSERT INTO programs (id, name, stage, minimum_enrollment, partner_confirmed, materials_status,
         renewal_status, created_at, updated_at)
       VALUES (?, 'Visibility Program', 'delivery', 1, 0, 'ready', 'not_due', ?, ?)`,
    )
    .run(programId, now, now);

  const make = (kind: string, visibility: string) =>
    db
      .prepare(
        `INSERT INTO program_requirements (id, program_id, kind, prompt, visibility, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(`prq-perm-${randomUUID().slice(0, 8)}`, programId, kind, `Prompt for ${kind}`, visibility, now, now);

  await make("medical", "admin");
  await make("emergency_contact", "admin");
  await make("logistics_ack", "admin_instructor");

  const instructorVisible = (await db
    .prepare("SELECT kind FROM program_requirements WHERE program_id = ? AND visibility <> 'admin'")
    .all(programId)) as unknown as { kind: string }[];
  const kinds = instructorVisible.map((row) => row.kind);

  assert.deepEqual(kinds, ["logistics_ack"]);
  assert.equal(kinds.includes("medical"), false, "medical information must not default to instructor-visible");
  assert.equal(kinds.includes("emergency_contact"), false, "guardian contact details must not default to instructor-visible");
});

dbTest("a requirement defaults to admin-only visibility when nobody chooses", async () => {
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const now = Date.now();
  const programId = `prg-perm-${randomUUID().slice(0, 8)}`;
  await db
    .prepare(
      `INSERT INTO programs (id, name, stage, minimum_enrollment, partner_confirmed, materials_status,
         renewal_status, created_at, updated_at)
       VALUES (?, 'Default Visibility', 'delivery', 1, 0, 'ready', 'not_due', ?, ?)`,
    )
    .run(programId, now, now);
  const requirementId = `prq-perm-${randomUUID().slice(0, 8)}`;
  await db
    .prepare(
      "INSERT INTO program_requirements (id, program_id, kind, prompt, created_at, updated_at) VALUES (?, ?, 'medical', 'Any medical needs?', ?, ?)",
    )
    .run(requirementId, programId, now, now);

  const row = (await db.prepare("SELECT visibility FROM program_requirements WHERE id = ?").get(requirementId)) as {
    visibility: string;
  };
  assert.equal(row.visibility, "admin", "the safe default must be admin-only, not shared");
});
