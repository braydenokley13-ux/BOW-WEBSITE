"use server";

/* ============================================================
 * Admin enrollment decisions — every consequential state change routes
 * through lib/enrollment.ts. This module only checks permission, validates
 * the shape of the request, and translates engine errors into messages an
 * admin can act on. It never writes program_registrations directly.
 * ============================================================ */

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/dal";
import {
  EnrollmentError,
  confirmIfReady,
  extendReservation,
  loadRegistration,
  placeInClass,
  recordAudit,
  recordNotification,
  releaseSeat,
  sendManualOffer,
} from "@/lib/enrollment";
import { queueActivation } from "@/lib/parent-activation";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function actorLabel(name: string): string {
  return `${name} (staff)`;
}

function friendlyError(error: unknown, fallback: string): string {
  if (error instanceof EnrollmentError) {
    if (error.code === "conflict") {
      return "The registration changed while this page was open. Refresh it before trying again.";
    }
    return error.message;
  }
  return fallback;
}

function refresh(programId: string) {
  revalidatePath(`/app/programs/${programId}/enrollment`);
  revalidatePath(`/app/programs/${programId}/waitlist`);
  revalidatePath("/app/family-support");
}

/* ===================================================================== */
/* Eligibility review                                                    */
/* ===================================================================== */

/** Approve a registration under_review into a confirmed/reserved seat. */
export async function confirmEligibility(registrationId: string): Promise<ActionResult> {
  const me = await requireStaff();
  const registration = await loadRegistration(registrationId);
  if (!registration) return { ok: false, error: "Registration not found." };
  if (!["under_review", "pending", "submitted"].includes(registration.status)) {
    return { ok: false, error: "Only a registration awaiting review can be approved this way." };
  }
  const db = getDb();
  const now = Date.now();
  await db
    .prepare("UPDATE program_registrations SET status = 'confirmed', confirmed_at = ?, updated_at = ? WHERE id = ?")
    .run(now, now, registrationId);
  await recordAudit({
    registrationId,
    studentId: registration.student_id,
    programId: registration.program_id,
    actorUserId: me.id,
    actorLabel: actorLabel(me.name),
    action: "eligibility_confirmed",
    previousState: registration.status,
    newState: "confirmed",
  });
  if (registration.class_id) {
    const { enrollInClass } = await import("@/lib/enrollment");
    await enrollInClass(registrationId, registration.class_id, registration.student_id, now);
  }
  await recordNotification({
    personId: registration.guardian_person_id,
    studentId: registration.student_id,
    programId: registration.program_id,
    registrationId,
    kind: "registration_confirmed",
    title: "Registration confirmed",
    body: "Our team reviewed and confirmed this registration.",
  });
  refresh(registration.program_id);
  return { ok: true };
}

export async function rejectIneligible(registrationId: string, reason: string): Promise<ActionResult> {
  const me = await requireStaff();
  if (!reason.trim()) return { ok: false, error: "Explain why this registration is ineligible before rejecting it." };
  try {
    const registration = await loadRegistration(registrationId);
    if (!registration) return { ok: false, error: "Registration not found." };
    await releaseSeat(registrationId, "declined", { userId: me.id, label: actorLabel(me.name) }, reason.trim());
    await recordNotification({
      personId: registration.guardian_person_id,
      studentId: registration.student_id,
      programId: registration.program_id,
      registrationId,
      kind: "registration_declined",
      title: "Registration not approved",
      body: reason.trim(),
      urgency: "important",
    });
    refresh(registration.program_id);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error, "Could not reject this registration.") };
  }
}

/* ===================================================================== */
/* Reservation                                                           */
/* ===================================================================== */

export async function adminExtendReservation(registrationId: string, hours: number, reason: string): Promise<ActionResult> {
  const me = await requireStaff();
  try {
    const registration = await loadRegistration(registrationId);
    await extendReservation(registrationId, hours, { userId: me.id, label: actorLabel(me.name) }, reason.trim() || null);
    if (registration) refresh(registration.program_id);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error, "Could not extend the reservation.") };
  }
}

/* ===================================================================== */
/* Requirements                                                          */
/* ===================================================================== */

export async function waiveRequirement(registrationRequirementId: string, reason: string): Promise<ActionResult> {
  const me = await requireStaff();
  if (!reason.trim()) return { ok: false, error: "Record why a required item is being waived." };
  const db = getDb();
  const row = (await db
    .prepare(
      `SELECT rr.registration_id, pr.kind, pr.required
         FROM registration_requirements rr JOIN program_requirements pr ON pr.id = rr.requirement_id
        WHERE rr.id = ?`,
    )
    .get(registrationRequirementId)) as { registration_id: string; kind: string; required: boolean } | undefined;
  if (!row) return { ok: false, error: "Requirement not found." };
  // Safety-relevant requirements are never waivable from this surface.
  if (["medical", "waiver", "emergency_contact"].includes(row.kind)) {
    return { ok: false, error: "Medical, waiver, and emergency-contact requirements cannot be waived here — collect the information instead." };
  }
  const now = Date.now();
  await db
    .prepare(
      `UPDATE registration_requirements
          SET status = 'waived', waived_by_user_id = ?, waiver_reason = ?, updated_at = ?
        WHERE id = ?`,
    )
    .run(me.id, reason.trim(), now, registrationRequirementId);
  const registration = await loadRegistration(row.registration_id);
  if (!registration) return { ok: false, error: "Registration not found." };
  await recordAudit({
    registrationId: row.registration_id,
    studentId: registration.student_id,
    programId: registration.program_id,
    actorUserId: me.id,
    actorLabel: actorLabel(me.name),
    action: "requirement_waived",
    reason: reason.trim(),
  });
  await confirmIfReady(row.registration_id, { userId: me.id, label: actorLabel(me.name) });
  refresh(registration.program_id);
  return { ok: true };
}

export async function approveRequirement(registrationRequirementId: string, note: string | null): Promise<ActionResult> {
  const me = await requireStaff();
  const db = getDb();
  const row = (await db
    .prepare("SELECT registration_id FROM registration_requirements WHERE id = ?")
    .get(registrationRequirementId)) as { registration_id: string } | undefined;
  if (!row) return { ok: false, error: "Requirement not found." };
  const now = Date.now();
  await db
    .prepare(
      `UPDATE registration_requirements
          SET status = 'approved', reviewed_by_user_id = ?, review_note = ?, reviewed_at = ?, updated_at = ?
        WHERE id = ?`,
    )
    .run(me.id, note?.trim() || null, now, now, registrationRequirementId);
  const registration = await loadRegistration(row.registration_id);
  if (!registration) return { ok: false, error: "Registration not found." };
  await recordAudit({
    registrationId: row.registration_id,
    studentId: registration.student_id,
    programId: registration.program_id,
    actorUserId: me.id,
    actorLabel: actorLabel(me.name),
    action: "requirement_approved",
    reason: note?.trim() || null,
  });
  await confirmIfReady(row.registration_id, { userId: me.id, label: actorLabel(me.name) });
  refresh(registration.program_id);
  return { ok: true };
}

export async function returnRequirementForCorrection(registrationRequirementId: string, note: string): Promise<ActionResult> {
  const me = await requireStaff();
  if (!note.trim()) return { ok: false, error: "Explain what needs to be corrected." };
  const db = getDb();
  const row = (await db
    .prepare("SELECT registration_id FROM registration_requirements WHERE id = ?")
    .get(registrationRequirementId)) as { registration_id: string } | undefined;
  if (!row) return { ok: false, error: "Requirement not found." };
  const now = Date.now();
  await db
    .prepare(
      `UPDATE registration_requirements
          SET status = 'needs_correction', reviewed_by_user_id = ?, review_note = ?, reviewed_at = ?, updated_at = ?
        WHERE id = ?`,
    )
    .run(me.id, note.trim(), now, now, registrationRequirementId);
  const registration = await loadRegistration(row.registration_id);
  if (!registration) return { ok: false, error: "Registration not found." };
  await recordAudit({
    registrationId: row.registration_id,
    studentId: registration.student_id,
    programId: registration.program_id,
    actorUserId: me.id,
    actorLabel: actorLabel(me.name),
    action: "requirement_returned",
    reason: note.trim(),
  });
  await recordNotification({
    personId: registration.guardian_person_id,
    studentId: registration.student_id,
    programId: registration.program_id,
    registrationId: row.registration_id,
    kind: "requirement_correction",
    title: "A form needs a correction",
    body: note.trim(),
    urgency: "important",
    requiresAcknowledgment: true,
  });
  refresh(registration.program_id);
  return { ok: true };
}

/* ===================================================================== */
/* Seat, waitlist, class placement                                       */
/* ===================================================================== */

export async function moveToWaitlist(registrationId: string, reason: string): Promise<ActionResult> {
  const me = await requireStaff();
  try {
    const registration = await loadRegistration(registrationId);
    if (!registration) return { ok: false, error: "Registration not found." };
    await releaseSeat(registrationId, "waitlisted", { userId: me.id, label: actorLabel(me.name) }, reason.trim() || null);
    refresh(registration.program_id);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error, "Could not move this registration to the waitlist.") };
  }
}

export async function confirmSeat(registrationId: string): Promise<ActionResult> {
  const me = await requireStaff();
  try {
    const registration = await loadRegistration(registrationId);
    if (!registration) return { ok: false, error: "Registration not found." };
    const result = await confirmIfReady(registrationId, { userId: me.id, label: actorLabel(me.name) });
    if (!result.confirmed) {
      return { ok: false, error: `${result.remaining} required item(s) must be completed or waived before this seat can be confirmed.` };
    }
    refresh(registration.program_id);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error, "Could not confirm this seat.") };
  }
}

export async function releaseRegistrationSeat(
  registrationId: string,
  nextStatus: "withdrawn" | "cancelled",
  reason: string,
): Promise<ActionResult> {
  const me = await requireStaff();
  if (!reason.trim()) return { ok: false, error: "Record a reason before releasing this seat." };
  try {
    const registration = await loadRegistration(registrationId);
    if (!registration) return { ok: false, error: "Registration not found." };
    await releaseSeat(registrationId, nextStatus, { userId: me.id, label: actorLabel(me.name) }, reason.trim());
    await recordNotification({
      personId: registration.guardian_person_id,
      studentId: registration.student_id,
      programId: registration.program_id,
      registrationId,
      kind: nextStatus === "withdrawn" ? "registration_withdrawn" : "registration_cancelled",
      title: nextStatus === "withdrawn" ? "Registration withdrawn" : "Registration cancelled",
      body: reason.trim(),
    });
    refresh(registration.program_id);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error, "Could not release this seat.") };
  }
}

/** Restore a withdrawn/cancelled registration back to the waitlist for reconsideration. */
export async function restoreRegistration(registrationId: string, reason: string): Promise<ActionResult> {
  const me = await requireStaff();
  const db = getDb();
  const registration = await loadRegistration(registrationId);
  if (!registration) return { ok: false, error: "Registration not found." };
  if (!["withdrawn", "cancelled", "declined", "expired"].includes(registration.status)) {
    return { ok: false, error: "Only a withdrawn, cancelled, declined, or expired registration can be restored." };
  }
  const now = Date.now();
  const waitlistSeq = Number(
    ((await db.prepare("SELECT nextval('program_waitlist_seq') AS v").get()) as { v: string }).v,
  );
  await db
    .prepare(
      `UPDATE program_registrations
          SET status = 'waitlisted', holds_seat = false, waitlist_seq = ?, updated_at = ?
        WHERE id = ?`,
    )
    .run(waitlistSeq, now, registrationId);
  await recordAudit({
    registrationId,
    studentId: registration.student_id,
    programId: registration.program_id,
    actorUserId: me.id,
    actorLabel: actorLabel(me.name),
    action: "registration_restored",
    previousState: registration.status,
    newState: "waitlisted",
    reason: reason.trim() || null,
  });
  refresh(registration.program_id);
  return { ok: true };
}

export async function adminPlaceInClass(registrationId: string, targetClassId: string, reason: string): Promise<ActionResult> {
  const me = await requireStaff();
  try {
    const registration = await loadRegistration(registrationId);
    if (!registration) return { ok: false, error: "Registration not found." };
    await placeInClass(registrationId, targetClassId, { userId: me.id, label: actorLabel(me.name) }, reason.trim() || null);
    refresh(registration.program_id);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error, "Could not place this student in that class.") };
  }
}

/* ===================================================================== */
/* Waitlist offers                                                       */
/* ===================================================================== */

export async function adminSendManualOffer(registrationId: string, reason: string): Promise<ActionResult> {
  const me = await requireStaff();
  if (!reason.trim()) return { ok: false, error: "Record an internal reason before offering this seat." };
  try {
    const registration = await loadRegistration(registrationId);
    if (!registration) return { ok: false, error: "Registration not found." };
    await sendManualOffer(registrationId, { userId: me.id, label: actorLabel(me.name) }, reason.trim());
    refresh(registration.program_id);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error, "Could not send this offer.") };
  }
}

/* ===================================================================== */
/* Family support centre                                                 */
/* ===================================================================== */

/** Resend or re-queue a guardian's activation invitation. Never claims success on a Supabase failure. */
export async function resendActivation(personId: string): Promise<ActionResult> {
  const me = await requireStaff();
  const db = getDb();
  const person = (await db.prepare("SELECT id, name, email FROM people WHERE id = ?").get(personId)) as
    | { id: string; name: string; email: string | null }
    | undefined;
  if (!person) return { ok: false, error: "Guardian not found." };
  if (!person.email) return { ok: false, error: "This guardian has no email on file — add one before resending an invitation." };
  const ticket = await queueActivation(person.id, person.email);
  await recordAudit({
    actorUserId: me.id,
    actorLabel: actorLabel(me.name),
    action: "activation_resent",
  });
  revalidatePath("/app/family-support");
  if (!ticket) return { ok: false, error: "This guardian is already fully activated, or the invitation could not be queued. Check their activation state." };
  return { ok: true };
}

/* ===================================================================== */
/* Admin notes                                                           */
/* ===================================================================== */

export async function updateAdminNotes(registrationId: string, notes: string): Promise<ActionResult> {
  const me = await requireStaff();
  const registration = await loadRegistration(registrationId);
  if (!registration) return { ok: false, error: "Registration not found." };
  const db = getDb();
  await db
    .prepare("UPDATE program_registrations SET admin_notes = ?, updated_at = ? WHERE id = ?")
    .run(notes.trim().slice(0, 4000) || null, Date.now(), registrationId);
  await recordAudit({
    registrationId,
    studentId: registration.student_id,
    programId: registration.program_id,
    actorUserId: me.id,
    actorLabel: actorLabel(me.name),
    action: "admin_notes_updated",
  });
  refresh(registration.program_id);
  return { ok: true };
}
