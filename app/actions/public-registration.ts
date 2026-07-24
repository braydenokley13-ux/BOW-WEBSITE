"use server";

/* ============================================================
 * PUBLIC — parent-led registration for a specific published Program.
 *
 * Distinct from general interest capture (app/actions/public-forms.ts,
 * `inquiries`): a submission here always resolves to a real Student +
 * guardian Person and, once confirmed, a real class_enrollments row — so it
 * shows up in the Program's existing staff Roster automatically. No account
 * or student email is required.
 * ============================================================ */

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { logActivity } from "@/lib/hiring";
import { PersonIdentityError, resolveGuardianPerson, resolveStudentIdentity } from "@/lib/people-identity";
import { clientAddressBucket, consumeRateLimit } from "@/lib/rate-limit";
import { publicAppOrigin, sendTransactionalEmail, transactionalEmailReady } from "@/lib/transactional-email";
import { renderTransactionalEmail } from "@/lib/email-template";

export interface ProgramRegistrationInput {
  requestKey: string;
  programId: string;
  studentFirstName: string;
  studentLastName: string;
  grade?: string;
  parentName: string;
  parentEmail: string;
  parentPhone?: string;
  school?: string;
  city?: string;
  state?: string;
  referralSource?: string;
}

export interface ProgramRegistrationResult {
  ok: boolean;
  error?: string;
  registrationId?: string;
  status?: "confirmed" | "pending" | "waitlisted";
  programName?: string;
}

class RegistrationError extends Error {}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: string | undefined, max: number): string | null {
  const result = (value ?? "").trim().slice(0, max);
  return result || null;
}

function validRequestKey(value: string): boolean {
  return value.length >= 12 && value.length <= 120 && /^[A-Za-z0-9._:-]+$/.test(value);
}

interface ProgramRow {
  id: string;
  name: string;
  is_public: boolean;
  public_status: string | null;
  capacity: number | null;
  registration_mode: "immediate" | "approval";
  full_capacity_behavior: "close" | "waitlist" | "continue";
  registration_deadline: string | null;
}

/**
 * PUBLIC. Idempotent on requestKey (a retried submission after a dropped
 * connection replays the same registration instead of double-enrolling).
 * Rate-limited by network and by parent email.
 */
export async function registerForProgram(input: ProgramRegistrationInput): Promise<ProgramRegistrationResult> {
  const requestKey = typeof input?.requestKey === "string" ? input.requestKey.trim() : "";
  const programId = typeof input?.programId === "string" ? input.programId.trim() : "";
  const studentFirstName = clean(input?.studentFirstName, 80);
  const studentLastName = clean(input?.studentLastName, 80);
  const grade = clean(input?.grade, 40);
  const parentName = clean(input?.parentName, 120);
  const parentEmail = (input?.parentEmail ?? "").trim().toLowerCase();
  const parentPhone = clean(input?.parentPhone, 40);
  const school = clean(input?.school, 160);
  const city = clean(input?.city, 80);
  const state = clean(input?.state, 40);
  const referralSource = clean(input?.referralSource, 160);

  if (!validRequestKey(requestKey)) return { ok: false, error: "Refresh the page and try registering again." };
  if (!programId) return { ok: false, error: "Program not found." };
  if (!studentFirstName || !studentLastName) return { ok: false, error: "Add the student's first and last name." };
  if (!parentName) return { ok: false, error: "Add a parent or guardian name." };
  if (!EMAIL_PATTERN.test(parentEmail) || parentEmail.length > 200) {
    return { ok: false, error: "Add a valid parent or guardian email." };
  }

  const db = getDb();
  const program = (await db.prepare(
        `SELECT id, name, is_public, public_status, capacity, registration_mode, full_capacity_behavior, registration_deadline
       FROM programs WHERE id = ?`,
      ).get(programId)) as ProgramRow | undefined;
  if (!program || !(program.is_public === true || (program.is_public as unknown) === 1)) {
    return { ok: false, error: "This program is not open for registration." };
  }
  const publicStatus = program.public_status ?? "coming_soon";
  if (publicStatus === "coming_soon") {
    return { ok: false, error: "This program is coming soon and isn't open for registration yet. Join the interest list instead." };
  }
  if (publicStatus === "closed") {
    return { ok: false, error: "Registration for this program is closed." };
  }
  if (program.registration_deadline && program.registration_deadline < new Date().toISOString().slice(0, 10)) {
    return { ok: false, error: "The registration deadline for this program has passed." };
  }

  const registrationId = `preg-${createHash("sha256").update(requestKey).digest("hex").slice(0, 20)}`;

  const address = await clientAddressBucket();
  if (address) {
    const networkLimit = (await consumeRateLimit("program-registration-network", address, {
          limit: 15,
          windowMs: 24 * 60 * 60 * 1000,
          blockMs: 24 * 60 * 60 * 1000,
        }));
    if (!networkLimit.allowed) return { ok: false, error: "Too many registrations were submitted from this network. Try again tomorrow." };
  }
  const identityLimit = (await consumeRateLimit("program-registration-email", parentEmail, {
        limit: 8,
        windowMs: 7 * 24 * 60 * 60 * 1000,
        blockMs: 7 * 24 * 60 * 60 * 1000,
      }));
  if (!identityLimit.allowed) return { ok: false, error: "This email has submitted several recent registrations. Contact BOW directly if this is urgent." };

  const now = Date.now();
  let status: "confirmed" | "pending" | "waitlisted" = "confirmed";
  let studentId = "";
  let wasReplay = false;

  try {
    (await db.exec("BEGIN IMMEDIATE"));
    try {
      const replay = (await db.prepare(
            "SELECT id, status, student_id FROM program_registrations WHERE id = ?",
          ).get(registrationId)) as { id: string; status: string; student_id: string } | undefined;
      if (replay) {
        wasReplay = true;
        status = replay.status as typeof status;
        studentId = replay.student_id;
      } else {
        const primaryClass = (await db.prepare(
              `SELECT id, capacity FROM classes
             WHERE program_id = ? AND status NOT IN ('completed', 'cancelled')
             ORDER BY created_at LIMIT 1`,
            ).get(programId)) as { id: string; capacity: number | null } | undefined;
        if (!primaryClass) throw new RegistrationError("This program isn't ready to accept registrations yet. Please check back soon.");

        const effectiveCapacity = primaryClass.capacity ?? program.capacity;
        let atCapacity = false;
        if (effectiveCapacity != null && effectiveCapacity > 0) {
          const countRow = (await db.prepare(
                `SELECT COUNT(*) AS n FROM class_enrollments ce
               JOIN students s ON s.id = ce.student_id
              WHERE ce.class_id = ? AND ce.status = 'enrolled' AND s.enrollment_status = 'active'`,
              ).get(primaryClass.id)) as { n: number };
          atCapacity = Number(countRow.n) >= effectiveCapacity;
        }

        if (atCapacity) {
          if (program.full_capacity_behavior === "close") {
            throw new RegistrationError("This program just reached capacity. Join the interest list to hear about the next session.");
          }
          status = program.full_capacity_behavior === "waitlist" ? "waitlisted" : "confirmed";
        } else {
          status = program.registration_mode === "approval" ? "pending" : "confirmed";
        }

        const guardianPersonId = (await resolveGuardianPerson(parentName, parentEmail, parentPhone ?? "", now, { city, state }));
        const { personId: studentPersonId } = (await resolveStudentIdentity(null, `${studentFirstName} ${studentLastName}`, now));

        studentId = `pfx-${randomUUID().slice(0, 8)}`;
        (await db.prepare(
              `INSERT INTO students
            (id, name, age, grade, email, guardian_person_id, school, emergency_notes, enrollment_status, form_status,
             communication_notes, user_id, person_id, created_at, updated_at)
           VALUES (?, ?, NULL, ?, NULL, ?, ?, NULL, 'active', 'missing', NULL, NULL, ?, ?, ?)`,
            ).run(
              studentId,
              `${studentFirstName} ${studentLastName}`.trim(),
              grade,
              guardianPersonId,
              school,
              studentPersonId,
              now,
              now,
            ));

        (await db.prepare(
              `INSERT INTO program_registrations
            (id, program_id, class_id, student_id, guardian_person_id, status, referral_source, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ).run(registrationId, programId, primaryClass.id, studentId, guardianPersonId, status, referralSource, now, now));

        if (status === "confirmed") {
          const enrollmentId = `pfx-${randomUUID().slice(0, 8)}`;
          (await db.prepare(
                "INSERT INTO class_enrollments (id, class_id, student_id, status, enrolled_at, withdrawn_at, withdrawal_reason) VALUES (?, ?, ?, 'enrolled', ?, NULL, NULL)",
              ).run(enrollmentId, primaryClass.id, studentId, now));
          (await db.prepare(
                `INSERT INTO class_session_roster (id, session_id, student_id, enrollment_id, rostered_at)
             SELECT 'csr-' || lower(hex(randomblob(16))), cs.id, ?, ?, ?
             FROM class_sessions cs
             WHERE cs.class_id = ? AND cs.session_date > ?
               AND NOT EXISTS (
                 SELECT 1 FROM class_session_roster csr
                 WHERE csr.session_id = cs.id AND csr.student_id = ?
               )`,
              ).run(studentId, enrollmentId, now, primaryClass.id, now, studentId));
        }

        (await logActivity(
              "program",
              programId,
              "note",
              `Public registration: ${studentFirstName} ${studentLastName} (${status}) via parent ${parentName} <${parentEmail}>.`,
              null,
            ));
        (await logActivity("student", studentId, "created", `Registered for Program "${program.name}" through the public website (${status}).`, null));
      }
      (await db.exec("COMMIT"));
    } catch (error) {
      try {
        (await db.exec("ROLLBACK"));
      } catch {
        // Preserve the original error.
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof RegistrationError) return { ok: false, error: error.message };
    if (error instanceof PersonIdentityError) return { ok: false, error: error.message };
    console.error("[public-registration] mutation failed", error);
    return { ok: false, error: "Registration could not be saved. Refresh and try again." };
  }

  if (!wasReplay && transactionalEmailReady()) {
    const origin = publicAppOrigin();
    const statusLine =
      status === "confirmed"
        ? "You're registered."
        : status === "pending"
          ? "Your registration is submitted and pending confirmation from BOW."
          : "The program is full — you're on the waitlist and we'll reach out if a spot opens.";
    (await sendTransactionalEmail({
          to: parentEmail,
          subject: `BOW Sports Capital — ${program.name} registration received`,
          ...renderTransactionalEmail({
            preheader: `${statusLine} — ${program.name}`,
            heading: "Registration received",
            paragraphs: [`Hi ${parentName},`, statusLine],
            details: [
              { label: "Program", value: program.name },
              { label: "Student", value: `${studentFirstName} ${studentLastName}` },
            ],
            // The branded footer already links to /contact, so the plain-text
            // pointer is only needed when no public origin is configured.
            note: origin
              ? "We'll follow up with any next steps by email."
              : "We'll follow up with any next steps by email. Reach us through the contact page on our site.",
          }),
        }).catch(() => false));
  }

  revalidatePath("/programs");
  revalidatePath(`/app/programs/${programId}`);
  return { ok: true, registrationId, status, programName: program.name };
}
