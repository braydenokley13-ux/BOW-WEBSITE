"use server";

/* ============================================================
 * PUBLIC — short, multi-child family registration.
 *
 * One parent submits one form covering any number of children and any number
 * of programs, and receives one definitive result per child-program pair.
 * Account activation happens afterwards (app/actions/parent-activation.ts):
 * a family must get a real registration result before being asked for a
 * password.
 *
 * Idempotency is durable, not client-side. Every identifier this action
 * writes — the student row for a new child, the registration row for each
 * selection — is derived from the submission's `requestKey`, so a refresh, a
 * double-click, or a retried request after a dropped connection replays the
 * original result instead of creating a second child or a second seat.
 * ============================================================ */

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/dal";
import { logActivity } from "@/lib/hiring";
import { PersonIdentityError, resolveGuardianPerson } from "@/lib/people-identity";
import { clientAddressBucket, consumeRateLimit } from "@/lib/rate-limit";
import {
  EnrollmentError,
  decideSeat,
  loadRegistrationProgram,
  primaryClassFor,
  registrationWindowClosed,
  registrationWindowNotYetOpen,
  type ChildSelectionResult,
} from "@/lib/enrollment";
import { queueActivation } from "@/lib/parent-activation";

export interface RegistrationChildInput {
  /** Present when a signed-in parent picked an existing child. */
  studentId?: string;
  firstName?: string;
  lastName?: string;
  grade?: string;
  school?: string;
  /** Program ids this child is being registered for. */
  programIds: string[];
}

export interface FamilyRegistrationInput {
  requestKey: string;
  children: RegistrationChildInput[];
  parentName: string;
  parentEmail: string;
  parentPhone?: string;
  relationship?: string;
  city?: string;
  state?: string;
  referralSource?: string;
}

export interface FamilyRegistrationResult {
  ok: boolean;
  error?: string;
  /** Set when the same requestKey was replayed with a different payload. */
  conflict?: boolean;
  results?: ChildSelectionResult[];
  activationEmail?: string;
  replay?: boolean;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CHILDREN = 8;
const MAX_SELECTIONS = 16;

function clean(value: string | undefined, max: number): string | null {
  const result = (value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
  return result || null;
}

function validRequestKey(value: string): boolean {
  return value.length >= 12 && value.length <= 120 && /^[A-Za-z0-9._:-]+$/.test(value);
}

function digest(...parts: string[]): string {
  // Joined on a unit separator, written as an escape so this file stays
  // text: the delimiter must be a character that cannot occur in a name,
  // grade, or program id, or two different payloads could fingerprint the
  // same and a changed submission would replay instead of failing safely.
  return createHash("sha256").update(parts.join("\u001f")).digest("hex");
}

/**
 * Staff acting on a family's behalf. Never part of `FamilyRegistrationInput`,
 * because every parameter of a server action is client-controlled — a caller
 * that could put this in the payload could register as an administrator. It is
 * only ever constructed inside `submitAdminRegistration`, after `requireStaff()`
 * has returned.
 */
interface AdminActor {
  userId: string;
  label: string;
}

/**
 * PUBLIC. Rate-limited by network and by guardian email. Idempotent on
 * `requestKey`; a replay carrying a materially different payload fails safely
 * rather than silently returning a result that does not match what was sent.
 */
export async function submitFamilyRegistration(
  input: FamilyRegistrationInput,
): Promise<FamilyRegistrationResult> {
  return runRegistration(input, null);
}

/**
 * STAFF ONLY. Registers a child on behalf of a family — the phone-call case.
 *
 * This is not a bypass and there is deliberately no bypass to build: it runs
 * the same `runRegistration` body, which means the same capacity lock, the same
 * eligibility check, the same duplicate detection, the same canonical family
 * identity, the same requirement instantiation, and the same audit trail. The
 * only differences are that the per-family rate limits do not apply (a staff
 * member legitimately registers many unrelated families) and the registration
 * records `created_via = 'admin'` so its provenance is never ambiguous.
 */
export async function submitAdminRegistration(
  input: FamilyRegistrationInput,
): Promise<FamilyRegistrationResult> {
  const staff = await requireStaff();
  return runRegistration(input, { userId: staff.id, label: `${staff.name} (staff)` });
}

async function runRegistration(
  input: FamilyRegistrationInput,
  admin: AdminActor | null,
): Promise<FamilyRegistrationResult> {
  const requestKey = typeof input?.requestKey === "string" ? input.requestKey.trim() : "";
  if (!validRequestKey(requestKey)) {
    return { ok: false, error: "Refresh the page and try registering again." };
  }

  const parentName = clean(input?.parentName, 120);
  const parentEmail = (input?.parentEmail ?? "").trim().toLowerCase();
  const parentPhone = clean(input?.parentPhone, 40);
  const relationship = clean(input?.relationship, 60) ?? "guardian";
  const city = clean(input?.city, 80);
  const state = clean(input?.state, 40);
  const referralSource = clean(input?.referralSource, 160);

  if (!parentName) return { ok: false, error: "Add a parent or guardian name." };
  if (!EMAIL_PATTERN.test(parentEmail) || parentEmail.length > 200) {
    return { ok: false, error: "Add a valid parent or guardian email." };
  }

  const children = Array.isArray(input?.children) ? input.children : [];
  if (children.length === 0) return { ok: false, error: "Add at least one child." };
  if (children.length > MAX_CHILDREN) {
    return { ok: false, error: `You can register up to ${MAX_CHILDREN} children at a time.` };
  }

  interface NormalizedChild {
    index: number;
    existingStudentId: string | null;
    firstName: string | null;
    lastName: string | null;
    name: string;
    grade: string | null;
    school: string | null;
    programIds: string[];
  }

  const normalized: NormalizedChild[] = [];
  let selectionCount = 0;
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index] ?? ({} as RegistrationChildInput);
    const existingStudentId = clean(child.studentId, 80);
    const firstName = clean(child.firstName, 80);
    const lastName = clean(child.lastName, 80);
    if (!existingStudentId && (!firstName || !lastName)) {
      return { ok: false, error: "Add a first and last name for every child." };
    }
    const programIds = Array.from(
      new Set((Array.isArray(child.programIds) ? child.programIds : []).map((id) => String(id ?? "").trim()).filter(Boolean)),
    );
    if (programIds.length === 0) {
      return { ok: false, error: `Choose at least one program for ${firstName ?? "each child"}.` };
    }
    selectionCount += programIds.length;
    normalized.push({
      index,
      existingStudentId,
      firstName,
      lastName,
      name: `${firstName ?? ""} ${lastName ?? ""}`.trim(),
      grade: clean(child.grade, 40),
      school: clean(child.school, 160),
      programIds,
    });
  }
  if (selectionCount > MAX_SELECTIONS) {
    return { ok: false, error: `You can submit up to ${MAX_SELECTIONS} program selections at a time.` };
  }

  const payloadFingerprint = digest(
    parentEmail,
    ...normalized.map((child) =>
      [child.existingStudentId ?? "", child.name.toLowerCase(), child.grade ?? "", child.programIds.slice().sort().join(",")].join("|"),
    ),
  );

  const db = getDb();

  /* ---- Replay: same requestKey already produced a result. -------------- */
  const priorRows = (await db
    .prepare(
      `SELECT r.id, r.status, r.student_id, r.program_id, r.payload_fingerprint,
              r.reservation_expires_at, s.name AS student_name, p.name AS program_name
         FROM program_registrations r
         JOIN students s ON s.id = r.student_id
         JOIN programs p ON p.id = r.program_id
        WHERE r.request_key LIKE ?
        ORDER BY r.created_at, r.id`,
    )
    .all(`${requestKey}#%`)) as unknown as {
    id: string;
    status: string;
    student_id: string;
    program_id: string;
    payload_fingerprint: string | null;
    reservation_expires_at: number | null;
    student_name: string;
    program_name: string;
  }[];

  if (priorRows.length > 0) {
    if (priorRows.some((row) => row.payload_fingerprint && row.payload_fingerprint !== payloadFingerprint)) {
      return {
        ok: false,
        conflict: true,
        error:
          "This registration was already submitted with different details. Refresh the page and start a new registration so nothing is overwritten.",
      };
    }
    return {
      ok: true,
      replay: true,
      activationEmail: parentEmail,
      results: priorRows.map((row) => ({
        studentId: row.student_id,
        studentName: row.student_name,
        programId: row.program_id,
        programName: row.program_name,
        outcome: "already_registered",
        status: row.status as ChildSelectionResult["status"],
        registrationId: row.id,
        reservationExpiresAt: row.reservation_expires_at,
        blockingRequirements: 0,
        message: `${row.student_name} — ${row.program_name}. This registration was already received.`,
      })),
    };
  }

  /* ---- Rate limits. ---------------------------------------------------- */
  // Skipped for staff only. The limits exist to stop an anonymous visitor
  // enumerating or flooding registrations; a signed-in staff member registering
  // twenty unrelated families in an afternoon is the intended use, and would
  // otherwise be blocked by the per-email bucket after ten.
  const address = admin ? null : await clientAddressBucket();
  if (address) {
    const networkLimit = await consumeRateLimit("family-registration-network", address, {
      limit: 20,
      windowMs: 24 * 60 * 60 * 1000,
      blockMs: 24 * 60 * 60 * 1000,
    });
    if (!networkLimit.allowed) {
      return { ok: false, error: "Too many registrations were submitted from this network. Try again tomorrow." };
    }
  }
  if (!admin) {
    const identityLimit = await consumeRateLimit("family-registration-email", parentEmail, {
      limit: 10,
      windowMs: 7 * 24 * 60 * 60 * 1000,
      blockMs: 7 * 24 * 60 * 60 * 1000,
    });
    if (!identityLimit.allowed) {
      return {
        ok: false,
        error: "This email has submitted several recent registrations. Contact BOW directly if this is urgent.",
      };
    }
  }

  const now = Date.now();
  const results: ChildSelectionResult[] = [];
  let guardianPersonId = "";

  try {
    /* ---- Family identity, in one transaction. -------------------------- */
    await db.exec("BEGIN");
    try {
      guardianPersonId = await resolveGuardianPerson(parentName, parentEmail, parentPhone ?? "", now, { city, state });

      for (const child of normalized) {
        if (child.existingStudentId) {
          // A signed-in parent reused a child. Verify the relationship rather
          // than trusting the submitted id — otherwise any id could attach a
          // stranger's child to this guardian.
          const link = (await db
            .prepare(
              `SELECT 1 FROM student_guardians
                WHERE student_id = ? AND person_id = ? AND status = 'active' AND can_register = true`,
            )
            .get(child.existingStudentId, guardianPersonId)) as unknown;
          if (!link) {
            throw new EnrollmentError("One of the selected children isn't linked to this guardian.", "invalid");
          }
          if (child.grade) {
            await db
              .prepare("UPDATE students SET grade = ?, updated_at = ? WHERE id = ?")
              .run(child.grade, now, child.existingStudentId);
          }
          continue;
        }

        const identityKey = `${child.name.toLowerCase()}|${(child.grade ?? "").toLowerCase()}`;

        // A returning family, not signed in, re-entering a child we already
        // know. Reuse that child rather than creating a second record — which
        // would otherwise take a second seat in the same program, because the
        // one-live-registration constraint keys on student_id.
        //
        // This is NOT a name-only merge: the match is name AND grade AND an
        // existing active guardian link to *this* guardian, whose email was
        // resolved to one canonical Person. A guardian with two same-name,
        // same-grade children is not a real case; a stranger sharing a child's
        // name is, and cannot reach this branch.
        const known = (await db
          .prepare(
            `SELECT s.id FROM students s
               JOIN student_guardians g ON g.student_id = s.id
              WHERE g.person_id = ? AND g.status = 'active'
                AND s.identity_key = ? AND s.merged_into_student_id IS NULL
              ORDER BY s.created_at
              LIMIT 1`,
          )
          .get(guardianPersonId, identityKey)) as { id: string } | undefined;
        if (known) {
          child.existingStudentId = known.id;
          if (child.school) {
            await db
              .prepare("UPDATE students SET school = COALESCE(school, ?), updated_at = ? WHERE id = ?")
              .run(child.school, now, known.id);
          }
          continue;
        }

        // Deterministic id: a replayed submission resolves to the same child.
        const studentId = `stu-${digest(requestKey, String(child.index)).slice(0, 20)}`;
        await db
          .prepare(
            `INSERT INTO students
               (id, name, age, grade, email, guardian_person_id, school, emergency_notes,
                enrollment_status, form_status, communication_notes, user_id, person_id,
                identity_key, created_at, updated_at)
             VALUES (?, ?, NULL, ?, NULL, ?, ?, NULL, 'active', 'missing', NULL, NULL, NULL, ?, ?, ?)
             ON CONFLICT (id) DO NOTHING`,
          )
          .run(studentId, child.name, child.grade, guardianPersonId, child.school, identityKey, now, now);
        child.existingStudentId = studentId;

        await db
          .prepare(
            `INSERT INTO student_guardians
               (id, student_id, person_id, relationship, is_primary, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, true, 'active', ?, ?)
             ON CONFLICT (student_id, person_id) DO NOTHING`,
          )
          .run(`sg-${randomUUID().slice(0, 12)}`, studentId, guardianPersonId, relationship, now, now);

        // A child whose name and grade match an existing record from a
        // different guardian is queued for human review. It is never merged
        // automatically — siblings and cousins legitimately collide.
        const possibleDuplicate = (await db
          .prepare(
            `SELECT 1 FROM students
              WHERE identity_key = ? AND id <> ? AND merged_into_student_id IS NULL LIMIT 1`,
          )
          .get(identityKey, studentId)) as unknown;
        if (possibleDuplicate) {
          await db
            .prepare("UPDATE students SET duplicate_review_status = 'open', updated_at = ? WHERE id = ?")
            .run(now, studentId);
        }
      }
      await db.exec("COMMIT");
    } catch (error) {
      try {
        await db.exec("ROLLBACK");
      } catch {
        /* preserve the original error */
      }
      throw error;
    }

    /* ---- One seat transaction per selection. --------------------------- */
    // Deliberately separate transactions, one per child-program pair, each
    // locking only the class it needs. A single transaction spanning every
    // selection would hold locks on several classes at once and let two
    // families registering overlapping sibling sets deadlock each other.
    let selectionIndex = 0;
    for (const child of normalized) {
      for (const programId of child.programIds) {
        const childKey = `${requestKey}#${selectionIndex}`;
        selectionIndex += 1;

        const program = await loadRegistrationProgram(programId);
        const studentName = child.name || "This child";
        if (!program || !program.is_public) {
          results.push(unavailable(child.existingStudentId, studentName, programId, "This program", "That program isn't open for registration."));
          continue;
        }
        if (registrationWindowNotYetOpen(program)) {
          results.push(unavailable(child.existingStudentId, studentName, programId, program.name, `Registration for ${program.name} hasn't opened yet.`));
          continue;
        }
        if ((program.public_status ?? "coming_soon") === "coming_soon") {
          results.push(interest(child.existingStudentId, studentName, programId, program.name));
          continue;
        }
        if ((program.public_status ?? "") === "closed" || registrationWindowClosed(program)) {
          results.push(unavailable(child.existingStudentId, studentName, programId, program.name, `Registration for ${program.name} is closed.`));
          continue;
        }

        const primary = await primaryClassFor(programId);
        if (!primary) {
          results.push(unavailable(child.existingStudentId, studentName, programId, program.name, `${program.name} isn't ready to accept registrations yet.`));
          continue;
        }

        await db.exec("BEGIN");
        try {
          const locked = (await db
            .prepare("SELECT id FROM classes WHERE id = ? FOR UPDATE")
            .get(primary.id)) as { id: string } | undefined;
          if (!locked) throw new EnrollmentError("That class no longer exists.", "not_found");

          const decision = await decideSeat({
            program,
            primaryClass: primary,
            studentId: child.existingStudentId as string,
            studentName,
            grade: child.grade,
            guardianPersonId,
            requestKey: childKey,
            payloadFingerprint,
            referralSource,
            createdVia: admin ? "admin" : "family",
            createdByUserId: admin?.userId ?? null,
            now,
          });
          await db.exec("COMMIT");
          results.push(decision);
        } catch (error) {
          try {
            await db.exec("ROLLBACK");
          } catch {
            /* preserve the original error */
          }
          if (error instanceof EnrollmentError) {
            results.push(unavailable(child.existingStudentId, studentName, programId, program.name, error.message));
            continue;
          }
          throw error;
        }
      }
    }
  } catch (error) {
    if (error instanceof PersonIdentityError) return { ok: false, error: error.message };
    if (error instanceof EnrollmentError) return { ok: false, error: error.message };
    console.error("[family-registration] submission failed", error);
    return { ok: false, error: "Your registration could not be saved. Nothing was charged or changed — refresh and try again." };
  }

  const anyRegistered = results.some((r) => r.registrationId);
  if (anyRegistered) {
    await queueActivation(guardianPersonId, parentEmail).catch((error) => {
      // Activation is a follow-up step, never a reason to fail a registration
      // that already succeeded. The admin support centre can resend it.
      console.error("[family-registration] activation queue failed", error);
    });
    await logActivity(
      "person",
      guardianPersonId,
      "note",
      `Family registration: ${results.filter((r) => r.registrationId).length} selection(s) submitted by ${parentName} <${parentEmail}>.`,
      null,
    ).catch(() => undefined);
  }

  for (const programId of new Set(results.map((r) => r.programId))) {
    revalidatePath(`/programs/${programId}`);
    revalidatePath(`/app/programs/${programId}`);
  }
  revalidatePath("/programs");

  return { ok: true, results, activationEmail: anyRegistered ? parentEmail : undefined };
}

function unavailable(
  studentId: string | null,
  studentName: string,
  programId: string,
  programName: string,
  message: string,
): ChildSelectionResult {
  return {
    studentId,
    studentName,
    programId,
    programName,
    outcome: "unavailable",
    status: null,
    registrationId: null,
    reservationExpiresAt: null,
    blockingRequirements: 0,
    message,
  };
}

function interest(
  studentId: string | null,
  studentName: string,
  programId: string,
  programName: string,
): ChildSelectionResult {
  return {
    studentId,
    studentName,
    programId,
    programName,
    outcome: "interest_recorded",
    status: null,
    registrationId: null,
    reservationExpiresAt: null,
    blockingRequirements: 0,
    message: `${programName} isn't open yet. We recorded your interest — this is not a registration, and we'll email you when it opens.`,
  };
}
