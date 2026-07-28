"use server";

/* ============================================================
 * Parent self-service actions.
 *
 * Every action here re-derives the guardian's scope from the signed-in
 * session (never trusts a studentId/registrationId typed into a hidden
 * field beyond what guardianCanAccessStudent() confirms) — the same rule
 * lib/family-portal.ts's readers follow. Anything that touches a seat calls
 * back into lib/enrollment.ts instead of writing status transitions here.
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { guardianCanAccessStudent, guardianPersonForUser } from "@/lib/parent-activation";
import { confirmIfReady, releaseSeat, respondToOffer, recordAudit, recordNotification, EnrollmentError } from "@/lib/enrollment";
import { loadRequirementForGuardian } from "@/lib/family-portal";

export interface ActionState {
  status?: "idle" | "success" | "error";
  message?: string;
}

async function currentGuardian(): Promise<string> {
  const user = await requireRole("parent");
  const personId = await guardianPersonForUser(user.id);
  if (!personId) throw new Error("no_guardian_record");
  return personId;
}

/* ===================================================================== */
/* Requirements                                                          */
/* ===================================================================== */

/**
 * Submit one requirement's answer. Sets `submitted` (or `approved`
 * immediately when the requirement does not need staff review), then always
 * calls confirmIfReady() — the only place a reserved seat turns confirmed.
 */
export async function submitRequirement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const requirementRowId = String(formData.get("requirementRowId") ?? "");
  const response = String(formData.get("response") ?? "").trim();
  if (!requirementRowId) return { status: "error", message: "Missing requirement." };
  if (response.length === 0) return { status: "error", message: "Enter a response before submitting." };
  if (response.length > 8000) return { status: "error", message: "That response is too long." };

  let personId: string;
  try {
    personId = await currentGuardian();
  } catch {
    return { status: "error", message: "Your session isn't linked to a family. Contact support." };
  }

  const requirement = await loadRequirementForGuardian(requirementRowId, personId);
  if (!requirement) return { status: "error", message: "That requirement could not be found." };
  if (requirement.status === "approved" || requirement.status === "waived") {
    return { status: "success", message: "This was already completed." };
  }

  const db = getDb();
  const now = Date.now();
  const nextStatus = requirement.staffApprovalRequired ? "submitted" : "approved";
  await db
    .prepare(
      `UPDATE registration_requirements
          SET response = ?, status = ?, submitted_at = ?, updated_at = ?,
              reviewed_at = CASE WHEN ? = 'approved' THEN ? ELSE reviewed_at END
        WHERE id = ?`,
    )
    .run(response, nextStatus, now, now, nextStatus, now, requirementRowId);

  await recordAudit({
    registrationId: requirement.registrationId,
    studentId: requirement.studentId,
    programId: requirement.programId,
    actorUserId: null,
    actorLabel: "Guardian",
    action: "requirement_submitted",
    previousState: requirement.status,
    newState: nextStatus,
  });

  try {
    await confirmIfReady(requirement.registrationId, { label: "Guardian requirement submission" });
  } catch (error) {
    // A confirmation failure here must not hide that the requirement itself
    // saved successfully — the family sees a success message either way.
    if (!(error instanceof EnrollmentError)) throw error;
  }

  revalidatePath("/family");
  return { status: "success", message: "Saved." };
}

/* ===================================================================== */
/* Waitlist offers                                                       */
/* ===================================================================== */

export interface OfferActionState {
  status?: "idle" | "success" | "error";
  message?: string;
}

export async function respondToWaitlistOffer(_prev: OfferActionState, formData: FormData): Promise<OfferActionState> {
  const offerId = String(formData.get("offerId") ?? "");
  const response = String(formData.get("response") ?? "");
  if (!offerId || (response !== "accept" && response !== "decline")) {
    return { status: "error", message: "Invalid request." };
  }

  let personId: string;
  const user = await requireRole("parent");
  try {
    personId = await currentGuardian();
  } catch {
    return { status: "error", message: "Your session isn't linked to a family. Contact support." };
  }

  const db = getDb();
  const offer = (await db
    .prepare(
      `SELECT o.id, r.student_id FROM waitlist_offers o
         JOIN program_registrations r ON r.id = o.registration_id
        WHERE o.id = ?`,
    )
    .get(offerId)) as { id: string; student_id: string } | undefined;
  if (!offer || !(await guardianCanAccessStudent(personId, offer.student_id))) {
    return { status: "error", message: "That offer could not be found." };
  }

  try {
    await respondToOffer(offerId, response, { userId: user.id, label: "Guardian" });
  } catch (error) {
    if (error instanceof EnrollmentError) {
      if (error.code === "expired") return { status: "error", message: "This offer has expired." };
      if (error.code === "conflict") return { status: "error", message: "This offer was already answered." };
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "Something went wrong. Try again." };
  }

  revalidatePath("/family");
  revalidatePath(`/family/offers/${offerId}`);
  return {
    status: "success",
    message: response === "accept" ? "Seat accepted." : "Offer declined.",
  };
}

/* ===================================================================== */
/* Withdrawal, schedule change, transfer, absence — family_requests       */
/* ===================================================================== */

export async function withdrawRegistration(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const registrationId = String(formData.get("registrationId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 2000) || null;
  const user = await requireRole("parent");
  let personId: string;
  try {
    personId = await currentGuardian();
  } catch {
    return { status: "error", message: "Your session isn't linked to a family. Contact support." };
  }

  const db = getDb();
  const reg = (await db.prepare("SELECT student_id FROM program_registrations WHERE id = ?").get(registrationId)) as
    | { student_id: string }
    | undefined;
  if (!reg || !(await guardianCanAccessStudent(personId, reg.student_id))) {
    return { status: "error", message: "That registration could not be found." };
  }

  try {
    // Withdrawal releases capacity immediately — the engine owns that
    // transition, so this action never touches `status` directly.
    await releaseSeat(registrationId, "withdrawn", { userId: user.id, label: "Guardian" }, reason);
  } catch (error) {
    if (error instanceof EnrollmentError) return { status: "error", message: error.message };
    return { status: "error", message: "Something went wrong. Try again." };
  }

  revalidatePath("/family");
  return { status: "success", message: "Withdrawn." };
}

/**
 * Anything that requires staff judgement (schedule change, transfer,
 * absence notice) is recorded as a request rather than applied immediately —
 * the interface distinction the spec requires between "completed" and
 * "request submitted".
 */
export async function submitFamilyRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const kind = String(formData.get("kind") ?? "");
  const allowedKinds = ["schedule_change", "transfer", "withdrawal", "absence_notice", "info_update"];
  if (!allowedKinds.includes(kind)) return { status: "error", message: "Invalid request type." };
  const studentId = String(formData.get("studentId") ?? "");
  const registrationId = String(formData.get("registrationId") ?? "") || null;
  const detail = String(formData.get("detail") ?? "").trim().slice(0, 4000);
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 2000) || null;
  if (!detail) return { status: "error", message: "Add a note describing your request." };

  let personId: string;
  try {
    personId = await currentGuardian();
  } catch {
    return { status: "error", message: "Your session isn't linked to a family. Contact support." };
  }
  if (!studentId || !(await guardianCanAccessStudent(personId, studentId))) {
    return { status: "error", message: "That student could not be found." };
  }

  const db = getDb();
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO family_requests
         (id, kind, registration_id, student_id, requested_by_person_id, detail, reason, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)`,
    )
    .run(`fam-${randomUUID().slice(0, 12)}`, kind, registrationId, studentId, personId, detail, reason, now, now);

  // A receipt for the kinds where the family is otherwise left wondering
  // whether anything happened. The success banner on this page is not durable
  // — a parent who closes the tab has no other record that they asked. It is
  // deliberately only an acknowledgement: it promises a follow-up, never an
  // outcome, because staff have not decided anything yet.
  const receipt: Record<string, { kind: string; title: string; body: string }> = {
    transfer: {
      kind: "transfer_requested",
      title: "We received your transfer request",
      body:
        "Your request to move to another program has been passed to BOW staff. Nothing has changed yet — the current " +
        "place is still held while we review it, and we will be in touch with the decision.",
    },
    absence_notice: {
      kind: "absence_acknowledged",
      title: "Thanks for letting us know",
      body: "We have recorded the absence you reported and passed it to the instructor. No further action is needed.",
    },
  };
  const message = receipt[kind];
  if (message) {
    const programId = registrationId
      ? (
          (await db.prepare("SELECT program_id FROM program_registrations WHERE id = ?").get(registrationId)) as
            | { program_id: string }
            | undefined
        )?.program_id ?? null
      : null;
    await recordNotification({
      personId,
      studentId,
      programId,
      registrationId,
      kind: message.kind,
      title: message.title,
      body: message.body,
      urgency: "normal",
      actionLabel: "View requests",
      actionHref: "/family",
    });
  }

  revalidatePath("/family");
  return { status: "success", message: "Request submitted. BOW staff will follow up." };
}

/* ===================================================================== */
/* Notification acknowledgment                                           */
/* ===================================================================== */

export async function acknowledgeNotification(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const notificationId = String(formData.get("notificationId") ?? "");
  let personId: string;
  try {
    personId = await currentGuardian();
  } catch {
    return { status: "error", message: "Your session isn't linked to a family. Contact support." };
  }

  const db = getDb();
  const result = await db
    .prepare("UPDATE family_notifications SET acknowledged_at = ? WHERE id = ? AND person_id = ?")
    .run(Date.now(), notificationId, personId);
  if (result.changes !== 1) return { status: "error", message: "That notification could not be found." };

  revalidatePath("/family");
  return { status: "success", message: "Acknowledged." };
}

/* ===================================================================== */
/* Guardian invites (add another guardian / manage student access)       */
/* ===================================================================== */

export async function inviteGuardian(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const studentId = String(formData.get("studentId") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const relationship = String(formData.get("relationship") ?? "").trim().slice(0, 80) || null;
  if (!email || !email.includes("@")) return { status: "error", message: "Enter a valid email address." };

  let personId: string;
  try {
    personId = await currentGuardian();
  } catch {
    return { status: "error", message: "Your session isn't linked to a family. Contact support." };
  }
  if (!studentId || !(await guardianCanAccessStudent(personId, studentId))) {
    return { status: "error", message: "That student could not be found." };
  }

  const db = getDb();
  const now = Date.now();
  let person = (await db.prepare("SELECT id FROM people WHERE lower(email) = ?").get(email)) as { id: string } | undefined;
  if (!person) {
    const newId = `per-${randomUUID().slice(0, 12)}`;
    await db
      .prepare("INSERT INTO people (id, name, email, identity_status, created_at, updated_at) VALUES (?, ?, ?, 'inactive', ?, ?)")
      .run(newId, email.split("@")[0], email, now, now);
    person = { id: newId };
  }

  const existingLink = (await db
    .prepare("SELECT id, status FROM student_guardians WHERE student_id = ? AND person_id = ?")
    .get(studentId, person.id)) as { id: string; status: string } | undefined;
  if (existingLink?.status === "active") {
    return { status: "error", message: "This person already has access to this student." };
  }

  if (existingLink) {
    await db
      .prepare("UPDATE student_guardians SET status = 'invited', relationship = COALESCE(?, relationship), invited_by_person_id = ?, updated_at = ? WHERE id = ?")
      .run(relationship, personId, now, existingLink.id);
  } else {
    await db
      .prepare(
        `INSERT INTO student_guardians
           (id, student_id, person_id, relationship, is_primary, can_register, can_view_sensitive, status, invited_by_person_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, false, true, true, 'invited', ?, ?, ?)`,
      )
      .run(`sg-${randomUUID().slice(0, 12)}`, studentId, person.id, relationship, personId, now, now);
  }

  revalidatePath("/family");
  return { status: "success", message: "Invitation queued — they'll receive an email to join." };
}

/** Revokes access immediately — guardianCanAccessStudent() stops honoring it on the next check. */
export async function revokeGuardian(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const linkId = String(formData.get("linkId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  let personId: string;
  try {
    personId = await currentGuardian();
  } catch {
    return { status: "error", message: "Your session isn't linked to a family. Contact support." };
  }
  if (!studentId || !(await guardianCanAccessStudent(personId, studentId))) {
    return { status: "error", message: "That student could not be found." };
  }

  const db = getDb();
  const link = (await db.prepare("SELECT person_id, is_primary FROM student_guardians WHERE id = ? AND student_id = ?").get(linkId, studentId)) as
    | { person_id: string; is_primary: boolean }
    | undefined;
  if (!link) return { status: "error", message: "That guardian link could not be found." };
  if (link.person_id === personId) return { status: "error", message: "You can't remove your own access." };

  await db.prepare("UPDATE student_guardians SET status = 'revoked', updated_at = ? WHERE id = ?").run(Date.now(), linkId);

  await recordNotification({
    personId,
    studentId,
    kind: "guardian_revoked",
    title: "Guardian access removed",
    body: "A guardian's access to this student was revoked from the family dashboard.",
    urgency: "important",
  });

  revalidatePath("/family");
  return { status: "success", message: "Access revoked." };
}
