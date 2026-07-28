"use server";

/* ============================================================
 * Family Support Centre — actions that are not one registration's lifecycle
 * transition (those already live in app/actions/registration-admin.ts and
 * lib/program-operations.ts; this file reuses them). What's here is
 * specific to supporting a family across their whole relationship with BOW:
 * support notes, guardian links, and verified contact info. Every write is
 * a defined transition with an audit trail, never a raw UPDATE the family
 * record page renders as a bare form.
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/dal";
import { recordAudit } from "@/lib/enrollment";
import { checkRestorable, restoreRegistration as restoreRegistrationOp, type RestoreCheck } from "@/lib/program-operations";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function actorLabel(name: string): string {
  return `${name} (staff)`;
}

function refresh(personId?: string | null, studentId?: string | null) {
  revalidatePath("/app/family-support");
  if (personId) revalidatePath(`/app/family-support?personId=${personId}`);
  if (studentId) revalidatePath(`/app/family-support?studentId=${studentId}`);
}

/* ===================================================================== */
/* Support notes (family_support_notes, migration 021)                   */
/* ===================================================================== */

export interface SupportNoteInput {
  personId?: string | null;
  studentId?: string | null;
  programId?: string | null;
  registrationId?: string | null;
  note: string;
  kind: "note" | "contact" | "action" | "issue";
}

export async function addSupportNote(input: SupportNoteInput): Promise<ActionResult> {
  const me = await requireStaff();
  if (!input.note.trim()) return { ok: false, error: "Write what happened before saving a support note." };
  if (!input.personId && !input.studentId) return { ok: false, error: "A support note needs a guardian or child to attach to." };
  const db = getDb();
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO family_support_notes
         (id, person_id, student_id, program_id, registration_id, note, kind, author_user_id, author_label, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      `fsn-${randomUUID().slice(0, 12)}`,
      input.personId ?? null,
      input.studentId ?? null,
      input.programId ?? null,
      input.registrationId ?? null,
      input.note.trim().slice(0, 4000),
      input.kind,
      me.id,
      actorLabel(me.name),
      now,
    );
  refresh(input.personId, input.studentId);
  return { ok: true };
}

export async function resolveSupportNote(noteId: string): Promise<ActionResult> {
  // Guard kept for the permission check; this action records no actor because
  // resolving a note is not a consequential state change.
  await requireStaff();
  const db = getDb();
  const row = (await db.prepare("SELECT person_id, student_id FROM family_support_notes WHERE id = ?").get(noteId)) as
    | { person_id: string | null; student_id: string | null }
    | undefined;
  if (!row) return { ok: false, error: "Support note not found." };
  await db.prepare("UPDATE family_support_notes SET resolved_at = ? WHERE id = ?").run(Date.now(), noteId);
  refresh(row.person_id, row.student_id);
  return { ok: true };
}

/* ===================================================================== */
/* Verified contact info                                                 */
/* ===================================================================== */

/**
 * Corrects a guardian's on-file email/phone. This is the only sanctioned way
 * to change contact info from the admin side — it never touches Supabase
 * identity, so it cannot silently break a guardian's ability to sign in;
 * that stays a separate, explicit re-activation if it's ever needed.
 */
export async function correctContactInfo(
  personId: string,
  updates: { email?: string | null; phone?: string | null },
): Promise<ActionResult> {
  const me = await requireStaff();
  const db = getDb();
  const person = (await db.prepare("SELECT id, name, email, phone FROM people WHERE id = ?").get(personId)) as
    | { id: string; name: string; email: string | null; phone: string | null }
    | undefined;
  if (!person) return { ok: false, error: "Guardian not found." };

  const nextEmail = updates.email !== undefined ? (updates.email?.trim() || null) : person.email;
  const nextPhone = updates.phone !== undefined ? (updates.phone?.trim() || null) : person.phone;
  if (nextEmail === person.email && nextPhone === person.phone) {
    return { ok: false, error: "Nothing changed." };
  }

  await db.prepare("UPDATE people SET email = ?, phone = ?, updated_at = ? WHERE id = ?").run(nextEmail, nextPhone, Date.now(), personId);
  await recordAudit({
    studentId: null,
    programId: null,
    actorUserId: me.id,
    actorLabel: actorLabel(me.name),
    action: "contact_info_corrected",
    previousState: `${person.email ?? "no email"} / ${person.phone ?? "no phone"}`,
    newState: `${nextEmail ?? "no email"} / ${nextPhone ?? "no phone"}`,
  });
  refresh(personId, null);
  return { ok: true };
}

/* ===================================================================== */
/* Guardian links (student_guardians)                                    */
/* ===================================================================== */

/**
 * Adds a guardian to a child by email. Reuses an existing `people` row for
 * that email if one exists, otherwise creates one — mirrors how a family's
 * own "add a guardian" flow would resolve identity, just triggered by staff.
 */
export async function addGuardianToStudent(
  studentId: string,
  guardian: { name: string; email: string; relationship?: string | null },
): Promise<ActionResult> {
  const me = await requireStaff();
  if (!guardian.name.trim() || !guardian.email.trim()) return { ok: false, error: "A guardian needs a name and email." };
  const db = getDb();
  const student = (await db.prepare("SELECT id, name FROM students WHERE id = ?").get(studentId)) as { id: string; name: string } | undefined;
  if (!student) return { ok: false, error: "Child not found." };

  const email = guardian.email.trim().toLowerCase();
  let person = (await db.prepare("SELECT id FROM people WHERE lower(email) = ? LIMIT 1").get(email)) as { id: string } | undefined;
  const now = Date.now();
  if (!person) {
    const id = `pe-${randomUUID().slice(0, 12)}`;
    await db.prepare("INSERT INTO people (id, name, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(id, guardian.name.trim(), email, now, now);
    person = { id };
  }

  const existingLink = (await db.prepare("SELECT id, status FROM student_guardians WHERE student_id = ? AND person_id = ?").get(studentId, person.id)) as
    | { id: string; status: string }
    | undefined;
  if (existingLink) {
    if (existingLink.status === "active") return { ok: false, error: "This guardian is already linked to this child." };
    await db.prepare("UPDATE student_guardians SET status = 'active', updated_at = ? WHERE id = ?").run(now, existingLink.id);
  } else {
    await db
      .prepare(
        `INSERT INTO student_guardians (id, student_id, person_id, relationship, is_primary, can_register, can_view_sensitive, status, invited_by_person_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, false, true, true, 'active', NULL, ?, ?)`,
      )
      .run(`sg-${randomUUID().slice(0, 12)}`, studentId, person.id, guardian.relationship?.trim() || "guardian", now, now);
  }

  await recordAudit({
    studentId,
    actorUserId: me.id,
    actorLabel: actorLabel(me.name),
    action: "guardian_added",
    newState: guardian.email.trim(),
  });
  refresh(null, studentId);
  return { ok: true };
}

/** Revokes (never deletes) a guardian's link so access stops immediately without losing history. */
export async function removeGuardianFromStudent(studentId: string, personId: string, reason: string): Promise<ActionResult> {
  const me = await requireStaff();
  if (!reason.trim()) return { ok: false, error: "Record why this guardian is being removed." };
  const db = getDb();
  const remaining = (await db
    .prepare("SELECT COUNT(*) AS c FROM student_guardians WHERE student_id = ? AND status = 'active' AND person_id != ?")
    .get(studentId, personId)) as { c: string };
  if (Number(remaining.c) < 1) {
    return { ok: false, error: "A child must keep at least one active guardian — add a replacement before removing this one." };
  }
  const link = (await db.prepare("SELECT id FROM student_guardians WHERE student_id = ? AND person_id = ? AND status = 'active'").get(studentId, personId)) as
    | { id: string }
    | undefined;
  if (!link) return { ok: false, error: "Guardian link not found or already inactive." };
  await db.prepare("UPDATE student_guardians SET status = 'revoked', updated_at = ? WHERE id = ?").run(Date.now(), link.id);
  await recordAudit({
    studentId,
    actorUserId: me.id,
    actorLabel: actorLabel(me.name),
    action: "guardian_removed",
    reason: reason.trim(),
  });
  refresh(personId, studentId);
  return { ok: true };
}

/* ===================================================================== */
/* Family requests (schedule-change / transfer / withdrawal / etc.)      */
/* ===================================================================== */

export async function resolveFamilyRequest(
  requestId: string,
  outcome: "approved" | "declined" | "completed" | "cancelled",
  note: string,
): Promise<ActionResult> {
  const me = await requireStaff();
  if (!note.trim()) return { ok: false, error: "Record a resolution note before closing this request." };
  const db = getDb();
  const request = (await db.prepare("SELECT id, student_id, status FROM family_requests WHERE id = ?").get(requestId)) as
    | { id: string; student_id: string; status: string }
    | undefined;
  if (!request) return { ok: false, error: "Request not found." };
  if (["completed", "cancelled", "declined"].includes(request.status)) {
    return { ok: false, error: "This request is already closed." };
  }
  const now = Date.now();
  await db
    .prepare(
      `UPDATE family_requests SET status = ?, resolution_note = ?, resolved_by_user_id = ?, resolved_at = ?, updated_at = ? WHERE id = ?`,
    )
    .run(outcome, note.trim(), me.id, now, now, requestId);
  await recordAudit({
    studentId: request.student_id,
    actorUserId: me.id,
    actorLabel: actorLabel(me.name),
    action: "family_request_resolved",
    previousState: request.status,
    newState: outcome,
    reason: note.trim(),
  });
  refresh(null, request.student_id);
  return { ok: true };
}

/* ===================================================================== */
/* Restore (delegates to lib/program-operations.ts, which re-checks       */
/* capacity and the one-live-registration rule that the simpler restore   */
/* on the registration detail panel does not).                            */
/* ===================================================================== */

export async function getRestoreCheck(registrationId: string): Promise<RestoreCheck> {
  await requireStaff();
  return checkRestorable(registrationId);
}

export async function restoreRegistrationChecked(registrationId: string, reason: string): Promise<ActionResult> {
  const me = await requireStaff();
  const result = await restoreRegistrationOp(registrationId, { userId: me.id, label: actorLabel(me.name) }, reason);
  if (!result.ok) return { ok: false, error: result.error ?? "Could not restore this registration." };
  refresh(null, null);
  revalidatePath("/app/family-support");
  return { ok: true };
}
