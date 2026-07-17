"use server";

/* ============================================================
 * Students + guardians + enrollments. Staff-only (admin | growth).
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/dal";
import { logActivity, upsertPersonByEmail } from "@/lib/hiring";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const FORM_STATUSES = new Set(["missing", "submitted", "complete"]);

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
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "Name is required." };
  if (name.length > 120) return { ok: false, error: "Name is too long." };

  const age =
    input.age !== undefined && input.age !== null && Number.isFinite(input.age) ? Math.max(0, Math.min(120, Math.trunc(input.age))) : null;

  let guardianPersonId: string | null = null;
  const guardianEmail = (input.guardianEmail ?? "").trim();
  if (guardianEmail || (input.guardianName ?? "").trim()) {
    if (guardianEmail && !/.+@.+\..+/.test(guardianEmail)) return { ok: false, error: "Guardian email is invalid." };
    guardianPersonId = upsertPersonByEmail(
      (input.guardianName ?? "").trim().slice(0, 120) || "Guardian",
      guardianEmail || `guardian-${randomUUID().slice(0, 8)}@unknown.local`,
      (input.guardianPhone ?? "").trim().slice(0, 40),
    );
  }

  const id = `pfx-${randomUUID().slice(0, 8)}`;
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO students
        (id, name, age, grade, email, guardian_person_id, emergency_notes, enrollment_status, form_status, communication_notes, user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 'missing', ?, NULL, ?, ?)`,
    )
    .run(
      id,
      name.slice(0, 120),
      age,
      (input.grade ?? "").trim().slice(0, 40) || null,
      (input.email ?? "").trim().slice(0, 200) || null,
      guardianPersonId,
      (input.emergencyNotes ?? "").trim().slice(0, 2000) || null,
      (input.communicationNotes ?? "").trim().slice(0, 2000) || null,
      now,
      now,
    );

  logActivity("student", id, "note", `Student "${name}" added.`, me.id);
  revalidatePath("/app/students");
  return { ok: true, id };
}

export interface UpdateStudentPatch {
  name?: string;
  age?: number | null;
  grade?: string;
  email?: string;
  emergencyNotes?: string;
  communicationNotes?: string;
  enrollmentStatus?: "active" | "inactive";
}

export async function updateStudent(id: string, patch: UpdateStudentPatch): Promise<ActionResult> {
  await requireStaff();
  const db = getDb();
  const row = db.prepare("SELECT id FROM students WHERE id = ?").get(id);
  if (!row) return { ok: false, error: "Not found." };

  const sets: string[] = [];
  const vals: unknown[] = [];
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) return { ok: false, error: "Name can't be empty." };
    sets.push("name = ?");
    vals.push(name.slice(0, 120));
  }
  if (patch.age !== undefined) {
    sets.push("age = ?");
    vals.push(patch.age === null || !Number.isFinite(patch.age) ? null : Math.max(0, Math.min(120, Math.trunc(patch.age))));
  }
  if (patch.grade !== undefined) {
    sets.push("grade = ?");
    vals.push(patch.grade.trim().slice(0, 40) || null);
  }
  if (patch.email !== undefined) {
    sets.push("email = ?");
    vals.push(patch.email.trim().slice(0, 200) || null);
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

  sets.push("updated_at = ?");
  vals.push(Date.now());
  vals.push(id);
  db.prepare(`UPDATE students SET ${sets.join(", ")} WHERE id = ?`).run(...(vals as []));

  revalidatePath(`/app/students/${id}`);
  revalidatePath("/app/students");
  return { ok: true };
}

export async function updateFormStatus(id: string, status: string): Promise<ActionResult> {
  const me = await requireStaff();
  if (!FORM_STATUSES.has(status)) return { ok: false, error: "Invalid form status." };
  const db = getDb();
  const row = db.prepare("SELECT id FROM students WHERE id = ?").get(id);
  if (!row) return { ok: false, error: "Not found." };

  db.prepare("UPDATE students SET form_status = ?, updated_at = ? WHERE id = ?").run(status, Date.now(), id);
  logActivity("student", id, "note", `Form status set to ${status}.`, me.id);

  revalidatePath(`/app/students/${id}`);
  revalidatePath("/app/students");
  revalidatePath("/app");
  return { ok: true };
}

/* ---------------- enrollment ---------------- */

export async function enrollStudent(classId: string, studentId: string): Promise<ActionResult> {
  const me = await requireStaff();
  const db = getDb();
  const cls = db.prepare("SELECT * FROM classes WHERE id = ?").get(classId) as { id: string; capacity: number | null } | undefined;
  if (!cls) return { ok: false, error: "Class not found." };
  const student = db.prepare("SELECT id FROM students WHERE id = ?").get(studentId);
  if (!student) return { ok: false, error: "Student not found." };

  const existing = db
    .prepare("SELECT * FROM class_enrollments WHERE class_id = ? AND student_id = ?")
    .get(classId, studentId) as { id: string; status: string } | undefined;
  if (existing && existing.status === "enrolled") return { ok: true };

  if (cls.capacity && cls.capacity > 0) {
    const count = (db.prepare("SELECT COUNT(*) AS n FROM class_enrollments WHERE class_id = ? AND status = 'enrolled'").get(classId) as { n: number }).n;
    if (count >= cls.capacity) return { ok: false, error: "full" };
  }

  const now = Date.now();
  if (existing) {
    db.prepare("UPDATE class_enrollments SET status = 'enrolled', enrolled_at = ? WHERE id = ?").run(now, existing.id);
  } else {
    db.prepare(
      "INSERT INTO class_enrollments (id, class_id, student_id, status, enrolled_at) VALUES (?, ?, ?, 'enrolled', ?)",
    ).run(`pfx-${randomUUID().slice(0, 8)}`, classId, studentId, now);
  }

  logActivity("class", classId, "note", "Student enrolled.", me.id);
  revalidatePath(`/app/classes/${classId}`);
  revalidatePath(`/app/students/${studentId}`);
  revalidatePath("/app/students");
  return { ok: true };
}

export async function withdrawEnrollment(classId: string, studentId: string): Promise<ActionResult> {
  const me = await requireStaff();
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM class_enrollments WHERE class_id = ? AND student_id = ?")
    .get(classId, studentId) as { id: string } | undefined;
  if (!existing) return { ok: false, error: "Not enrolled." };

  db.prepare("UPDATE class_enrollments SET status = 'withdrawn' WHERE id = ?").run(existing.id);
  logActivity("class", classId, "note", "Student withdrawn.", me.id);

  revalidatePath(`/app/classes/${classId}`);
  revalidatePath(`/app/students/${studentId}`);
  revalidatePath("/app/students");
  return { ok: true };
}
