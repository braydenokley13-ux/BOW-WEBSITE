"use server";

/* ============================================================
 * Students + guardians + enrollments. Staff-only (admin | growth).
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/dal";
import { PersonIdentityError, resolveGuardianPerson, resolveStudentIdentity } from "@/lib/people-identity";
import { logActivity } from "@/lib/hiring";

export interface ActionResult {
  ok: boolean;
  error?: string;
  updatedAt?: number;
}

const FORM_STATUSES = new Set(["missing", "submitted", "complete"]);
const TERMINAL_CLASS_STATUSES = new Set(["completed", "cancelled"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEACTIVATION_REASON = "Student record deactivated by BOW staff.";

class StudentActionError extends Error {}

function normalizeOptionalEmail(value: unknown, label: string): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new StudentActionError(`${label} is invalid.`);
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.length > 200 || !EMAIL_PATTERN.test(normalized)) {
    throw new StudentActionError(`${label} is invalid.`);
  }
  return normalized;
}

function friendlyFailure(error: unknown, fallback: string): ActionResult {
  if (error instanceof StudentActionError || error instanceof PersonIdentityError) return { ok: false, error: error.message };
  if (error instanceof Error && /(?:unique|constraint)/i.test(error.message)) {
    return { ok: false, error: "That identity changed while this record was being saved. Refresh and try again." };
  }
  console.error("[students] mutation failed", error);
  return { ok: false, error: fallback };
}

async function inImmediateTransaction<T>(operation: () => T): Promise<T> {
  const db = getDb();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const result = operation();
    (await db.exec("COMMIT"));
    return result;
  } catch (error) {
    try {
      (await db.exec("ROLLBACK"));
    } catch {
      // Preserve the original error.
    }
    throw error;
  }
}

async function attachFirstTouchAttribution(
  studentId: string,
  studentPersonId: string | null,
  guardianPersonId: string | null,
  actorUserId: string,
  now: number,
): Promise<void> {
  const db = getDb();
  let touchpoint = studentPersonId
    ? (await db.prepare(
            `SELECT t.id
         FROM student_acquisition_touchpoints t
        WHERE t.voided_at IS NULL AND t.person_id = ?
          AND (t.student_id IS NULL OR t.student_id = ?)
        ORDER BY t.occurred_at, t.created_at, t.id
        LIMIT 1`,
          ).get(studentPersonId, studentId)) as unknown as { id: string } | undefined
    : undefined;
  if (!touchpoint && guardianPersonId) {
    const guardianStudentCount = (await db.prepare(
          "SELECT COUNT(*) AS count FROM students WHERE guardian_person_id = ?",
        ).get(guardianPersonId)) as unknown as { count: number };
    if (Number(guardianStudentCount.count) === 1) {
      touchpoint = (await db.prepare(
              `SELECT t.id
           FROM student_acquisition_touchpoints t
          WHERE t.voided_at IS NULL AND t.person_id = ? AND t.student_id IS NULL
          ORDER BY t.occurred_at, t.created_at, t.id
          LIMIT 1`,
            ).get(guardianPersonId)) as unknown as { id: string } | undefined;
    }
  }
  if (!touchpoint) return;
  (await db.prepare(
        `INSERT INTO student_acquisition_attributions
      (id, student_id, touchpoint_id, method, evidence_note, effective_from, effective_to,
       decided_by_user_id, decision_source, decision_source_id, created_at)
     VALUES (?, ?, ?, 'direct', ?, ?, NULL, ?, 'operator', NULL, ?)`,
      ).run(
        `saa-${randomUUID()}`,
        studentId,
        touchpoint.id,
        "First-touch attribution linked automatically from the exact Student or guardian Person identity during Student creation.",
        now,
        actorUserId,
        now,
      ));
  (await logActivity("student", studentId, "acquisition", `First-touch acquisition attribution linked to ${touchpoint.id}.`, actorUserId));
}

export interface CreateStudentInput {
  name: string;
  age?: number;
  grade?: string;
  email?: string;
  guardianName?: string;
  guardianEmail?: string;
  guardianPhone?: string;
  emergencyNotes?: string;
  communicationNotes?: string;
}

export async function createStudent(input: CreateStudentInput): Promise<ActionResult & { id?: string }> {
  const me = await requireStaff();
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  if (!name) return { ok: false, error: "Name is required." };
  if (name.length > 120) return { ok: false, error: "Name is too long." };

  let studentEmail: string | null;
  let guardianEmail: string | null;
  try {
    studentEmail = normalizeOptionalEmail(input.email, "Student email");
    guardianEmail = normalizeOptionalEmail(input.guardianEmail, "Guardian email");
  } catch (error) {
    return friendlyFailure(error, "Review the email addresses and try again.");
  }
  if (studentEmail && guardianEmail === studentEmail) {
    return { ok: false, error: "Student and guardian email must identify different people." };
  }

  const guardianName = typeof input.guardianName === "string" ? input.guardianName.trim() : "";
  const guardianPhone = typeof input.guardianPhone === "string" ? input.guardianPhone.trim() : "";
  if ((guardianName || guardianPhone) && !guardianEmail) {
    return { ok: false, error: "Guardian email is required when guardian details are provided." };
  }
  if (guardianEmail && !guardianName) return { ok: false, error: "Guardian name is required with guardian email." };
  if (guardianName.length > 120) return { ok: false, error: "Guardian name is too long." };
  if (guardianPhone.length > 40) return { ok: false, error: "Guardian phone is too long." };

  let age: number | null = null;
  if (input.age !== undefined && input.age !== null) {
    if (!Number.isFinite(input.age) || !Number.isInteger(input.age) || input.age < 0 || input.age > 120) {
      return { ok: false, error: "Age must be a whole number between 0 and 120." };
    }
    age = input.age;
  }

  const id = `pfx-${randomUUID().slice(0, 8)}`;
  const now = Date.now();
  try {
    (await inImmediateTransaction(async () => {
            const { userId, personId } = (await resolveStudentIdentity(studentEmail, name, now));
            const guardianPersonId = guardianEmail
              ? (await resolveGuardianPerson(guardianName, guardianEmail, guardianPhone, now))
              : null;
            if (guardianPersonId && guardianPersonId === personId) {
              throw new StudentActionError("Student and guardian resolve to the same Person. Reconcile the identity before continuing.");
            }
            (await getDb()
                      .prepare(
                        `INSERT INTO students
            (id, name, age, grade, email, guardian_person_id, emergency_notes, enrollment_status, form_status,
             communication_notes, user_id, person_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 'missing', ?, ?, ?, ?, ?)`,
                      )
                      .run(
                        id,
                        name,
                        age,
                        (input.grade ?? "").trim().slice(0, 40) || null,
                        studentEmail,
                        guardianPersonId,
                        (input.emergencyNotes ?? "").trim().slice(0, 2000) || null,
                        (input.communicationNotes ?? "").trim().slice(0, 2000) || null,
                        userId,
                        personId,
                        now,
                        now,
                      ));
            (await attachFirstTouchAttribution(id, personId, guardianPersonId, me.id, now));
            (await logActivity(
                      "student",
                      id,
                      "created",
                      `Student "${name}" added${guardianPersonId ? " with a canonical guardian Person" : ""}.`,
                      me.id,
                    ));
          }));
  } catch (error) {
    return friendlyFailure(error, "The student could not be created. Refresh and try again.");
  }

  revalidatePath("/app/students");
  return { ok: true, id, updatedAt: now };
}

export interface UpdateStudentPatch {
  expectedUpdatedAt: number;
  name?: string;
  age?: number | null;
  grade?: string;
  email?: string;
  emergencyNotes?: string;
  communicationNotes?: string;
  enrollmentStatus?: "active" | "inactive";
}

export async function updateStudent(id: string, patch: UpdateStudentPatch): Promise<ActionResult> {
  const me = await requireStaff();
  if (typeof id !== "string" || !id.trim() || id.length > 100) return { ok: false, error: "Student not found." };
  if (!Number.isSafeInteger(patch?.expectedUpdatedAt) || patch.expectedUpdatedAt < 0) {
    return { ok: false, error: "This student record is out of date. Refresh and try again." };
  }
  const db = getDb();

  const sets: string[] = [];
  const vals: unknown[] = [];
  let normalizedEmailPatch: string | null | undefined;
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) return { ok: false, error: "Name can't be empty." };
    sets.push("name = ?");
    vals.push(name.slice(0, 120));
  }
  if (patch.age !== undefined) {
    if (
      patch.age !== null &&
      (!Number.isFinite(patch.age) || !Number.isInteger(patch.age) || patch.age < 0 || patch.age > 120)
    ) {
      return { ok: false, error: "Age must be a whole number between 0 and 120." };
    }
    sets.push("age = ?");
    vals.push(patch.age);
  }
  if (patch.grade !== undefined) {
    sets.push("grade = ?");
    vals.push(patch.grade.trim().slice(0, 40) || null);
  }
  if (patch.email !== undefined) {
    let email: string | null;
    try {
      email = normalizeOptionalEmail(patch.email, "Student email");
    } catch (error) {
      return friendlyFailure(error, "Review the student email and try again.");
    }
    normalizedEmailPatch = email;
    sets.push("email = ?");
    vals.push(email);
  }
  if (patch.emergencyNotes !== undefined) {
    sets.push("emergency_notes = ?");
    vals.push(patch.emergencyNotes.trim().slice(0, 2000) || null);
  }
  if (patch.communicationNotes !== undefined) {
    sets.push("communication_notes = ?");
    vals.push(patch.communicationNotes.trim().slice(0, 2000) || null);
  }
  if (patch.enrollmentStatus !== undefined) {
    if (!["active", "inactive"].includes(patch.enrollmentStatus)) return { ok: false, error: "Invalid enrollment status." };
    sets.push("enrollment_status = ?");
    vals.push(patch.enrollmentStatus);
  }
  if (sets.length === 0) return { ok: true };

  let nextUpdatedAt = 0;
  const affectedClassIds = new Set<string>();
  const affectedProgramIds = new Set<string>();
  try {
    (await inImmediateTransaction(async () => {
            const live = (await db.prepare(
                    "SELECT id, name, email, user_id, person_id, enrollment_status, updated_at FROM students WHERE id = ?",
                  ).get(id)) as
              | {
                  id: string;
                  name: string;
                  email: string | null;
                  user_id: string | null;
                  person_id: string | null;
                  enrollment_status: "active" | "inactive";
                  updated_at: number;
                }
              | undefined;
            if (!live) throw new StudentActionError("Student not found.");
            if (live.updated_at !== patch.expectedUpdatedAt) {
              throw new StudentActionError("This student changed while you were editing. Refresh and try again.");
            }

            const requestedEmail = patch.email !== undefined
              ? normalizedEmailPatch ?? null
              : live.email?.trim().toLowerCase() ?? null;
            if (patch.email !== undefined && requestedEmail !== (live.email?.trim().toLowerCase() ?? null)) {
              if (
                requestedEmail &&
                (await db.prepare("SELECT 1 FROM students WHERE id <> ? AND lower(trim(email)) = ?").get(id, requestedEmail))
              ) {
                throw new StudentActionError("Another student record already uses that email.");
              }
              if (live.user_id) {
                const linkedUser = (await db.prepare("SELECT email, role FROM users WHERE id = ?").get(live.user_id)) as
                  | { email: string; role: string }
                  | undefined;
                if (!requestedEmail || !linkedUser || linkedUser.role !== "student" || linkedUser.email.trim().toLowerCase() !== requestedEmail) {
                  throw new StudentActionError("Change the linked student account email before changing this student identity.");
                }
                const accountPeople = (await db
                            .prepare("SELECT id, email FROM people WHERE user_id = ? ORDER BY created_at, id")
                            .all(live.user_id)) as { id: string; email: string }[];
                if (
                  accountPeople.length > 1 ||
                  (accountPeople[0] &&
                    (accountPeople[0].email.trim().toLowerCase() !== requestedEmail ||
                      (live.person_id && accountPeople[0].id !== live.person_id)))
                ) {
                  throw new StudentActionError("The linked account and Person identity must be reconciled before changing this email.");
                }
              } else if (requestedEmail && (await db.prepare("SELECT 1 FROM users WHERE lower(trim(email)) = ?").get(requestedEmail))) {
                throw new StudentActionError("That email already belongs to an account. Link identities through the account workflow instead.");
              }
              if (live.person_id) {
                const linkedPerson = (await db.prepare("SELECT email FROM people WHERE id = ?").get(live.person_id)) as { email: string } | undefined;
                if (!requestedEmail || !linkedPerson || linkedPerson.email.trim().toLowerCase() !== requestedEmail) {
                  throw new StudentActionError("Change the linked Person email before changing this student identity.");
                }
              } else if (requestedEmail) {
                const people = (await db
                            .prepare("SELECT id FROM people WHERE lower(trim(email)) = ? ORDER BY id")
                            .all(requestedEmail)) as { id: string }[];
                if (people.length > 0) {
                  throw new StudentActionError("That email already belongs to a Person. Link identities before changing this student record.");
                }
              }
            }

            const deactivating = live.enrollment_status === "active" && patch.enrollmentStatus === "inactive";
            const reactivating = live.enrollment_status === "inactive" && patch.enrollmentStatus === "active";
            const now = Date.now();
            nextUpdatedAt = Math.max(now, live.updated_at + 1);

            if (deactivating) {
              const affected = (await db.prepare(
                        `SELECT ce.id AS enrollment_id, ce.class_id, ce.status AS enrollment_status,
                  c.title AS class_title, c.status AS class_status, c.program_id,
                  p.owner_user_id AS program_owner_user_id
             FROM class_enrollments ce
             JOIN classes c ON c.id = ce.class_id
             LEFT JOIN programs p ON p.id = c.program_id
            WHERE ce.student_id = ? AND ce.status IN ('enrolled', 'waitlisted')
            ORDER BY ce.class_id`,
                      ).all(id)) as {
                enrollment_id: string | null;
                class_id: string;
                enrollment_status: string;
                class_title: string;
                class_status: string;
                program_id: string | null;
                program_owner_user_id: string | null;
              }[];

              (await db.prepare(
                          `UPDATE class_enrollments
              SET status = 'withdrawn', withdrawn_at = ?, withdrawal_reason = ?
            WHERE student_id = ? AND status IN ('enrolled', 'waitlisted')`,
                        ).run(now, DEACTIVATION_REASON, id));
              if (live.user_id) {
                (await db.prepare(
                              `UPDATE enrollments SET enroll = 'inactive'
              WHERE user_id = ? AND enroll IN ('active', 'invited', 'suspended')`,
                            ).run(live.user_id));
              }

              const removableRosterRows = (await db.prepare(
                        `SELECT csr.id, cs.class_id
             FROM class_session_roster csr
             JOIN class_sessions cs ON cs.id = csr.session_id
            WHERE csr.student_id = ? AND cs.session_date > ?
              AND NOT EXISTS (
                SELECT 1 FROM attendance_records ar
                 WHERE ar.session_id = csr.session_id AND ar.student_id = csr.student_id
              )
              AND NOT EXISTS (
                SELECT 1 FROM class_session_reports report
                 WHERE report.session_id = csr.session_id AND report.completed = 1
              )
            ORDER BY csr.id`,
                      ).all(id, now)) as { id: string; class_id: string }[];
              const rosterImpactClassIds = new Set(removableRosterRows.map((row) => row.class_id));
              for (const classId of rosterImpactClassIds) affectedClassIds.add(classId);
              (await db.prepare(
                          `DELETE FROM class_session_roster
            WHERE student_id = ?
              AND session_id IN (SELECT id FROM class_sessions WHERE session_date > ?)
              AND NOT EXISTS (
                SELECT 1 FROM attendance_records ar
                 WHERE ar.session_id = class_session_roster.session_id
                   AND ar.student_id = class_session_roster.student_id
              )
              AND NOT EXISTS (
                SELECT 1 FROM class_session_reports report
                 WHERE report.session_id = class_session_roster.session_id AND report.completed = 1
              )`,
                        ).run(id, now));

              const classImpacts = [...affected];
              for (const classId of rosterImpactClassIds) {
                if (classImpacts.some((row) => row.class_id === classId)) continue;
                const rosterOnlyImpact = (await db.prepare(
                            `SELECT NULL AS enrollment_id, c.id AS class_id, 'roster_only' AS enrollment_status,
                    c.title AS class_title, c.status AS class_status, c.program_id,
                    p.owner_user_id AS program_owner_user_id
               FROM classes c
               LEFT JOIN programs p ON p.id = c.program_id
              WHERE c.id = ?`,
                          ).get(classId)) as (typeof affected)[number] | undefined;
                if (rosterOnlyImpact) classImpacts.push(rosterOnlyImpact);
              }

              for (const row of classImpacts) {
                affectedClassIds.add(row.class_id);
                if (row.program_id) affectedProgramIds.add(row.program_id);
                (await logActivity(
                              "class",
                              row.class_id,
                              "student_withdrawn",
                              row.enrollment_id
                                ? `${live.name} was withdrawn because the student record was deactivated. Historical attendance and finalized delivery evidence were preserved.`
                                : `${live.name} was removed from an unlocked future roster during deactivation. Historical attendance and finalized delivery evidence were preserved.`,
                              me.id,
                            ));
                if (
                  TERMINAL_CLASS_STATUSES.has(row.class_status) ||
                  (row.enrollment_status !== "enrolled" && !rosterImpactClassIds.has(row.class_id))
                ) continue;

                const context = `Student lifecycle exception for ${id}.`;
                const existingWork = (await db.prepare(
                            `SELECT id FROM tasks
              WHERE entity_type = 'class' AND entity_id = ? AND status = 'open'
                AND kind = 'issue' AND context = ?
              LIMIT 1`,
                          ).get(row.class_id, context));
                if (existingWork) continue;

                const owner = row.program_owner_user_id
                  ? (await db.prepare(
                                    "SELECT id FROM users WHERE id = ? AND role IN ('admin','growth') AND status = 'active'",
                                  ).get(row.program_owner_user_id)) as { id: string } | undefined
                  : undefined;
                const taskId = `wrk-${randomUUID().slice(0, 12)}`;
                (await db.prepare(
                              `INSERT INTO tasks
              (id, title, owner_user_id, due_at, status, kind, priority, context, recommended_action,
               entity_type, entity_id, handoff_to_founder, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'open', 'issue', 'high', ?, ?, 'class', ?, 0, ?, ?)`,
                            ).run(
                              taskId,
                              `Review enrollment after ${live.name}'s deactivation`.slice(0, 200),
                              owner?.id ?? me.id,
                              now + 2 * 24 * 60 * 60 * 1000,
                              context,
                              "Confirm the roster, minimum enrollment, family communication, and any replacement enrollment needed before the next session.",
                              row.class_id,
                              now,
                              now,
                            ));
                (await logActivity(
                              "task",
                              taskId,
                              "created",
                              `Enrollment exception opened for Class "${row.class_title}" after student deactivation.`,
                              me.id,
                            ));
              }

              (await logActivity(
                          "student",
                          id,
                          "deactivated",
                          `Student deactivated; ${affected.length} live Class enrollment${affected.length === 1 ? "" : "s"} withdrawn, ` +
                            `${removableRosterRows.length} safe future roster row${removableRosterRows.length === 1 ? "" : "s"} removed, and historical delivery evidence preserved.`,
                          me.id,
                        ));
            } else if (reactivating) {
              (await logActivity(
                          "student",
                          id,
                          "reactivated",
                          "Student reactivated. Prior Class and legacy enrollments remain withdrawn/inactive and require a deliberate new enrollment decision.",
                          me.id,
                        ));
            }

            sets.push("updated_at = ?");
            const updated = (await db.prepare(
                    `UPDATE students SET ${sets.join(", ")} WHERE id = ? AND updated_at = ?`,
                  ).run(...(vals as []), nextUpdatedAt, id, patch.expectedUpdatedAt));
            if (updated.changes !== 1) {
              throw new StudentActionError("This student changed while you were editing. Refresh and try again.");
            }
            if (!deactivating && !reactivating) {
              (await logActivity("student", id, "updated", "Student details updated.", me.id));
            }
          }));
  } catch (error) {
    return friendlyFailure(error, "The student could not be updated. Refresh and try again.");
  }

  revalidatePath(`/app/students/${id}`);
  revalidatePath("/app/students");
  revalidatePath("/app/classes");
  revalidatePath("/app/tasks");
  revalidatePath("/app");
  for (const classId of affectedClassIds) revalidatePath(`/app/classes/${classId}`);
  for (const programId of affectedProgramIds) revalidatePath(`/app/programs/${programId}`);
  return { ok: true, updatedAt: nextUpdatedAt };
}

export async function updateFormStatus(id: string, status: string): Promise<ActionResult> {
  const me = await requireStaff();
  if (!FORM_STATUSES.has(status)) return { ok: false, error: "Invalid form status." };
  const db = getDb();
  let updatedAt = 0;
  try {
    (await inImmediateTransaction(async () => {
            const row = (await db.prepare("SELECT updated_at FROM students WHERE id = ?").get(id)) as { updated_at: number } | undefined;
            if (!row) throw new StudentActionError("Student not found.");
            updatedAt = Math.max(Date.now(), row.updated_at + 1);
            const updated = (await db.prepare(
                    "UPDATE students SET form_status = ?, updated_at = ? WHERE id = ? AND updated_at = ?",
                  ).run(status, updatedAt, id, row.updated_at));
            if (updated.changes !== 1) throw new StudentActionError("This student changed. Refresh and try again.");
            (await logActivity("student", id, "note", `Form status set to ${status}.`, me.id));
          }));
  } catch (error) {
    return friendlyFailure(error, "The form status could not be updated. Refresh and try again.");
  }

  revalidatePath(`/app/students/${id}`);
  revalidatePath("/app/students");
  revalidatePath("/app");
  return { ok: true, updatedAt };
}

/* ---------------- enrollment ---------------- */

export async function enrollStudent(classId: string, studentId: string): Promise<ActionResult> {
  const me = await requireStaff();
  const db = getDb();
  let programId: string | null = null;
  try {
    (await inImmediateTransaction(async () => {
            const cls = (await db.prepare("SELECT id, capacity, status, program_id FROM classes WHERE id = ?").get(classId)) as
              | { id: string; capacity: number | null; status: string; program_id: string | null }
              | undefined;
            if (!cls) throw new Error("class_missing");
            programId = cls.program_id;
            if (TERMINAL_CLASS_STATUSES.has(cls.status)) throw new Error("class_history_frozen");
            const student = (await db.prepare("SELECT id FROM students WHERE id = ? AND enrollment_status = 'active'").get(studentId));
            if (!student) throw new Error("student_unavailable");

            const existingRows = (await db
                    .prepare("SELECT id, status FROM class_enrollments WHERE class_id = ? AND student_id = ?")
                    .all(classId, studentId)) as { id: string; status: string }[];
            if (existingRows.length > 1) throw new Error("enrollment_invariant");
            const existing = existingRows[0];
            if (existing?.status === "enrolled") return;

            if (cls.capacity && cls.capacity > 0) {
              const count = (
                (await db.prepare(
                              `SELECT COUNT(*) AS n
               FROM class_enrollments ce
               JOIN students s ON s.id = ce.student_id
              WHERE ce.class_id = ? AND ce.status = 'enrolled' AND s.enrollment_status = 'active'`,
                            ).get(classId)) as { n: number }
              ).n;
              if (count >= cls.capacity) throw new Error("class_full");
            }

            const now = Date.now();
            let enrollmentId: string;
            if (existing) {
              enrollmentId = existing.id;
              (await db.prepare(
                          "UPDATE class_enrollments SET status = 'enrolled', enrolled_at = ?, withdrawn_at = NULL, withdrawal_reason = NULL WHERE id = ?",
                        ).run(now, existing.id));
            } else {
              enrollmentId = `pfx-${randomUUID().slice(0, 8)}`;
              (await db.prepare(
                          "INSERT INTO class_enrollments (id, class_id, student_id, status, enrolled_at, withdrawn_at, withdrawal_reason) VALUES (?, ?, ?, 'enrolled', ?, NULL, NULL)",
                        ).run(enrollmentId, classId, studentId, now));
            }
            (await db.prepare(
                      `INSERT INTO class_session_roster (id, session_id, student_id, enrollment_id, rostered_at)
         SELECT 'csr-' || lower(hex(randomblob(16))), cs.id, ?, ?, ?
         FROM class_sessions cs
         WHERE cs.class_id = ? AND cs.session_date > ?
           AND NOT EXISTS (
             SELECT 1 FROM class_session_roster csr
             WHERE csr.session_id = cs.id AND csr.student_id = ?
           )`,
                    ).run(studentId, enrollmentId, now, classId, now, studentId));
            (await logActivity("class", classId, "note", "Student enrolled; future session rosters updated.", me.id));
          }));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "class_missing") return { ok: false, error: "Class not found." };
    if (code === "class_history_frozen") return { ok: false, error: "Historical Classes cannot change enrollment." };
    if (code === "student_unavailable") return { ok: false, error: "Only active students can be enrolled." };
    if (code === "enrollment_invariant") return { ok: false, error: "Duplicate enrollment rows must be reconciled first." };
    if (code === "class_full") return { ok: false, error: "full" };
    throw error;
  }

  revalidatePath(`/app/classes/${classId}`);
  if (programId) revalidatePath(`/app/programs/${programId}`);
  revalidatePath(`/app/students/${studentId}`);
  revalidatePath("/app/students");
  return { ok: true };
}

export async function withdrawEnrollment(classId: string, studentId: string, reason?: string): Promise<ActionResult> {
  const me = await requireStaff();
  const db = getDb();
  const cleanReason = (reason ?? "").trim().slice(0, 500);
  if (cleanReason.length < 3) return { ok: false, error: "Record why the student is being withdrawn." };
  let programId: string | null = null;
  try {
    (await inImmediateTransaction(async () => {
            const cls = (await db.prepare("SELECT status, program_id FROM classes WHERE id = ?").get(classId)) as
              | { status: string; program_id: string | null }
              | undefined;
            if (!cls) throw new Error("class_missing");
            programId = cls.program_id;
            if (TERMINAL_CLASS_STATUSES.has(cls.status)) throw new Error("class_history_frozen");
            const existingRows = (await db
                    .prepare("SELECT id, status FROM class_enrollments WHERE class_id = ? AND student_id = ?")
                    .all(classId, studentId)) as { id: string; status: string }[];
            if (existingRows.length > 1) throw new Error("enrollment_invariant");
            const existing = existingRows[0];
            if (!existing || existing.status !== "enrolled") throw new Error("not_enrolled");

            const now = Date.now();
            (await db.prepare(
                      "UPDATE class_enrollments SET status = 'withdrawn', withdrawn_at = ?, withdrawal_reason = ? WHERE id = ? AND status = 'enrolled'",
                    ).run(now, cleanReason, existing.id));
            (await db.prepare(
                      `DELETE FROM class_session_roster
         WHERE student_id = ?
           AND session_id IN (SELECT id FROM class_sessions WHERE class_id = ? AND session_date > ?)
           AND NOT EXISTS (
             SELECT 1 FROM attendance_records ar
             WHERE ar.session_id = class_session_roster.session_id AND ar.student_id = class_session_roster.student_id
           )
           AND NOT EXISTS (
             SELECT 1 FROM class_session_reports report
             WHERE report.session_id = class_session_roster.session_id AND report.completed = 1
           )`,
                    ).run(studentId, classId, now));
            (await logActivity("class", classId, "note", `Student withdrawn. ${cleanReason}`, me.id));
          }));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "class_missing") return { ok: false, error: "Class not found." };
    if (code === "class_history_frozen") return { ok: false, error: "Historical Classes cannot change enrollment." };
    if (code === "enrollment_invariant") return { ok: false, error: "Duplicate enrollment rows must be reconciled first." };
    if (code === "not_enrolled") return { ok: false, error: "Student is not actively enrolled." };
    throw error;
  }

  revalidatePath(`/app/classes/${classId}`);
  if (programId) revalidatePath(`/app/programs/${programId}`);
  revalidatePath(`/app/students/${studentId}`);
  revalidatePath("/app/students");
  return { ok: true };
}
