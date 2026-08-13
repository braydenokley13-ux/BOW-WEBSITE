import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "../lib/db";
import { listPeopleDirectory, searchPeopleDirectory } from "../lib/people-directory";

/* ============================================================
 * One human, several hats.
 *
 * These run against a real Postgres because the claim being tested is a claim
 * about joins: that six facets read off six existing relationship tables and
 * still land on ONE `people` row. A mocked version of that would prove nothing.
 * ============================================================ */

const suffix = randomUUID().slice(0, 8);
const PERSON = `pd-person-${suffix}`;
const STUDENT = `pd-student-${suffix}`;
const CHILD = `pd-child-${suffix}`;
const ORG = `pd-org-${suffix}`;
const NAME = `Directory Probe ${suffix}`;

async function seed(): Promise<void> {
  const db = getDb();
  const now = Date.now();
  await db
    .prepare("INSERT INTO people (id, name, email, phone, created_at, updated_at) VALUES (?, ?, ?, '', ?, ?)")
    .run(PERSON, NAME, `${suffix}@probe.test`, now, now);
  await db.prepare("INSERT INTO organizations (id, name, type, location, status) VALUES (?, ?, 'school', '', 'active')").run(ORG, `Probe School ${suffix}`);
  await db
    .prepare(
      `INSERT INTO organization_people (id, organization_id, person_id, relationship_type, is_primary, active, created_at, updated_at)
       VALUES (?, ?, ?, 'contact', 1, 1, ?, ?)`,
    )
    .run(`pd-orp-${suffix}`, ORG, PERSON, now, now);
  await db
    .prepare(
      `INSERT INTO students (id, name, grade, enrollment_status, form_status, created_at, updated_at)
       VALUES (?, ?, '7', 'active', 'complete', ?, ?)`,
    )
    .run(CHILD, `Probe Child ${suffix}`, now, now);
  await db
    .prepare(
      `INSERT INTO student_guardians (id, student_id, person_id, relationship, is_primary, can_register, can_view_sensitive, status, created_at, updated_at)
       VALUES (?, ?, ?, 'parent', true, true, true, 'active', ?, ?)`,
    )
    .run(`pd-sg-${suffix}`, CHILD, PERSON, now, now);
  // The same human is also a student on file, with an open duplicate review.
  await db
    .prepare(
      `INSERT INTO students (id, name, person_id, grade, enrollment_status, form_status, duplicate_review_status, created_at, updated_at)
       VALUES (?, ?, ?, '9', 'active', 'complete', 'open', ?, ?)`,
    )
    .run(STUDENT, NAME, PERSON, now, now);
}

async function cleanup(): Promise<void> {
  const db = getDb();
  await db.prepare("DELETE FROM student_guardians WHERE person_id = ?").run(PERSON);
  await db.prepare("DELETE FROM organization_people WHERE person_id = ?").run(PERSON);
  await db.prepare("DELETE FROM students WHERE id IN (?, ?)").run(STUDENT, CHILD);
  await db.prepare("DELETE FROM organizations WHERE id = ?").run(ORG);
  await db.prepare("DELETE FROM people WHERE id = ?").run(PERSON);
}

test("one person wearing three hats is one row with three facets", async (t) => {
  await seed();
  t.after(cleanup);

  const rows = await listPeopleDirectory({ query: NAME.toLowerCase() });
  const mine = rows.filter((row) => row.name === NAME);
  assert.equal(mine.length, 1, "the same human must never appear twice");

  const kinds = new Set(mine[0].roles.map((role) => role.kind));
  assert.ok(kinds.has("student"), "students.person_id gives the Student facet");
  assert.ok(kinds.has("parent"), "student_guardians gives the Parent facet");
  assert.ok(kinds.has("contact"), "organization_people gives the Contact facet");
  assert.equal(mine[0].personId, PERSON, "every facet resolves to the one canonical identity");
});

test("the Parent facet counts children, from the guardian relationship", async (t) => {
  await seed();
  t.after(cleanup);

  const [row] = (await listPeopleDirectory({ query: NAME.toLowerCase() })).filter((r) => r.name === NAME);
  const parent = row.roles.find((role) => role.kind === "parent");
  assert.equal(parent?.status, "1 child");
});

test("the Contact facet names the partner, so the chip is worth reading", async (t) => {
  await seed();
  t.after(cleanup);

  const [row] = (await listPeopleDirectory({ query: NAME.toLowerCase() })).filter((r) => r.name === NAME);
  const contact = row.roles.find((role) => role.kind === "contact");
  assert.match(contact?.status ?? "", /Probe School/);
});

test("a possible duplicate is surfaced for review and never resolved here", async (t) => {
  await seed();
  t.after(cleanup);

  const [row] = (await listPeopleDirectory({ query: NAME.toLowerCase() })).filter((r) => r.name === NAME);
  assert.ok(
    row.attentionReasons.some((reason) => /duplicate/i.test(reason) && /never merged automatically/i.test(reason)),
    "the row must say a person decides, not the system",
  );
});

test("every facet filter still resolves to the same single identity", async (t) => {
  await seed();
  t.after(cleanup);

  for (const type of ["student", "parent", "contact"] as const) {
    const rows = (await listPeopleDirectory({ type, query: NAME.toLowerCase() })).filter((r) => r.name === NAME);
    assert.equal(rows.length, 1, `${type} filter`);
    assert.equal(rows[0].personId, PERSON, `${type} filter resolves to the canonical person`);
  }
  // A facet this person does not wear excludes them rather than inventing one.
  const instructors = (await listPeopleDirectory({ type: "instructor", query: NAME.toLowerCase() })).filter(
    (r) => r.name === NAME,
  );
  assert.equal(instructors.length, 0);
});

test("search finds the person by name and by email, and returns them once", async (t) => {
  await seed();
  t.after(cleanup);

  const byName = (await searchPeopleDirectory(NAME)).filter((row) => row.personId === PERSON);
  assert.equal(byName.length, 1);

  const byEmail = (await searchPeopleDirectory(`${suffix}@probe.test`)).filter((row) => row.personId === PERSON);
  assert.equal(byEmail.length, 1);
});
