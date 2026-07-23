/* ============================================================
 * Canonical guardian/student Person identity resolution.
 *
 * Shared by staff-only student creation (app/actions/students.ts) and public
 * program registration (app/actions/public-registration.ts) so both paths
 * resolve to the same canonical `people` records instead of duplicating
 * identities. Not a "use server" module — these are plain helpers, not
 * server actions, and must never be callable directly from the client.
 * ============================================================ */

import "server-only";

import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";

export class PersonIdentityError extends Error {}

/**
 * Resolve one canonical guardian Person while the caller holds a write lock.
 * People predating the operating-system migration are not guaranteed to have
 * unique normalized emails, so ambiguity must stop the write instead of
 * silently attaching a child to an arbitrary Person.
 */
export async function resolveGuardianPerson(
  name: string,
  email: string,
  phone: string,
  now: number,
  extra?: { city?: string | null; state?: string | null },
): Promise<string> {
  const db = getDb();
  const matches = (await db
      .prepare("SELECT id FROM people WHERE lower(trim(email)) = ? ORDER BY created_at, id")
      .all(email)) as unknown as { id: string }[];
  if (matches.length > 1) {
    throw new PersonIdentityError("More than one Person uses that guardian email. Reconcile the duplicate identity before continuing.");
  }
  if (matches[0]) {
    (await db.prepare(
          `UPDATE people
          SET email = ?,
              name = CASE WHEN trim(name) = '' THEN ? ELSE name END,
              phone = CASE WHEN trim(phone) = '' THEN ? ELSE phone END,
              city = COALESCE(city, ?),
              state = COALESCE(state, ?),
              updated_at = ?
        WHERE id = ?`,
        ).run(email, name, phone, extra?.city ?? null, extra?.state ?? null, now, matches[0].id));
    return matches[0].id;
  }

  const id = `pfx-${randomUUID().slice(0, 8)}`;
  (await db.prepare(
        "INSERT INTO people (id, name, email, phone, city, state, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)",
      ).run(id, name, email, phone, extra?.city ?? null, extra?.state ?? null, now, now));
  return id;
}

/**
 * Resolve optional account/Person links for a student email without ever
 * guessing between duplicate identities. The caller must hold a write lock,
 * making the check-and-insert sequence safe against another writer. Public
 * registration never collects a student email, so this almost always takes
 * the immediate `{ userId: null, personId: null }` path.
 */
export async function resolveStudentIdentity(
  email: string | null,
  name: string,
  now: number,
): Promise<{ userId: string | null; personId: string | null }> {
  if (!email) return { userId: null, personId: null };
  const db = getDb();
  const matchingStudents = (await db
      .prepare("SELECT id FROM students WHERE lower(trim(email)) = ? ORDER BY created_at, id")
      .all(email)) as unknown as { id: string }[];
  if (matchingStudents.length > 0) {
    throw new PersonIdentityError("A student record already uses that email.");
  }

  const users = (await db
      .prepare("SELECT id, role FROM users WHERE lower(trim(email)) = ? ORDER BY id")
      .all(email)) as unknown as { id: string; role: string }[];
  if (users.length > 1) {
    throw new PersonIdentityError("More than one account uses that email.");
  }
  if (users[0] && users[0].role !== "student") {
    throw new PersonIdentityError("That email belongs to a non-student account.");
  }

  const people = (await db
      .prepare("SELECT id, user_id FROM people WHERE lower(trim(email)) = ? ORDER BY created_at, id")
      .all(email)) as unknown as { id: string; user_id: string | null }[];
  if (people.length > 1) {
    throw new PersonIdentityError("More than one Person uses that student email.");
  }

  let userId = users[0]?.id ?? null;
  let personId = people[0]?.id ?? null;
  if (people[0]?.user_id) {
    const linkedUser = (await db.prepare("SELECT id, role, email FROM users WHERE id = ?").get(people[0].user_id)) as
      | { id: string; role: string; email: string }
      | undefined;
    if (
      !linkedUser ||
      linkedUser.role !== "student" ||
      linkedUser.email.trim().toLowerCase() !== email ||
      (userId && userId !== linkedUser.id)
    ) {
      throw new PersonIdentityError("The Person and account attached to that student email disagree.");
    }
    userId = linkedUser.id;
  }

  if (userId) {
    const peopleLinkedToAccount = (await db
          .prepare("SELECT id, email FROM people WHERE user_id = ? ORDER BY created_at, id")
          .all(userId)) as unknown as { id: string; email: string }[];
    if (peopleLinkedToAccount.length > 1) {
      throw new PersonIdentityError("That account is linked to multiple People.");
    }
    if (peopleLinkedToAccount[0]) {
      if (
        peopleLinkedToAccount[0].email.trim().toLowerCase() !== email ||
        (personId && personId !== peopleLinkedToAccount[0].id)
      ) {
        throw new PersonIdentityError("The account and Person attached to that student email disagree.");
      }
      personId = peopleLinkedToAccount[0].id;
    }
  }

  if (userId && (await db.prepare("SELECT 1 FROM students WHERE user_id = ?").get(userId))) {
    throw new PersonIdentityError("That student account is already linked to another student record.");
  }
  if (personId && (await db.prepare("SELECT 1 FROM students WHERE person_id = ?").get(personId))) {
    throw new PersonIdentityError("That Person is already linked to another student record.");
  }
  if (!personId) {
    personId = `pfx-${randomUUID().slice(0, 8)}`;
    (await db.prepare(
          "INSERT INTO people (id, name, email, phone, user_id, created_at, updated_at) VALUES (?, ?, ?, '', ?, ?, ?)",
        ).run(personId, name, email, userId, now, now));
  } else {
    (await db.prepare(
          `UPDATE people
          SET name = CASE WHEN trim(name) = '' THEN ? ELSE name END,
              email = ?, user_id = COALESCE(user_id, ?), updated_at = ?
        WHERE id = ?`,
        ).run(name, email, userId, now, personId));
  }
  return { userId, personId };
}
