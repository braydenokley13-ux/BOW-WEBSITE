"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import { getDb } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface GrantProfileSharingInput {
  studentUserId: string;
  guardianName: string;
  guardianEmail: string;
  consentMethod: "signed_form" | "verified_email" | "in_person";
  notes?: string;
  expiresAt?: number;
}

export interface ProfileSharingResult {
  ok: boolean;
  error?: string;
  consentId?: string;
  publicPath?: string;
}

/**
 * Creates a high-entropy, expiring share link after an administrator has
 * verified guardian consent. Existing links are revoked atomically so a
 * student can never have two live credentials through this workflow.
 */
export async function grantPublicProfileConsent(input: GrantProfileSharingInput): Promise<ProfileSharingResult> {
  const me = await requireAdmin();
  const studentUserId = input.studentUserId.trim();
  const guardianName = input.guardianName.trim().slice(0, 160);
  const guardianEmail = input.guardianEmail.trim().toLowerCase();
  const notes = input.notes?.trim().slice(0, 2_000) || null;
  const now = Date.now();
  const expiresAt = input.expiresAt ?? now + 365 * DAY_MS;

  if (!studentUserId) return { ok: false, error: "Choose a student." };
  if (guardianName.length < 2) return { ok: false, error: "Record the guardian's full name." };
  if (!/^\S+@\S+\.\S+$/.test(guardianEmail)) return { ok: false, error: "Record a valid guardian email." };
  if (!["signed_form", "verified_email", "in_person"].includes(input.consentMethod)) {
    return { ok: false, error: "Choose how guardian consent was verified." };
  }
  if (!Number.isFinite(expiresAt) || expiresAt < now + DAY_MS || expiresAt > now + 366 * DAY_MS) {
    return { ok: false, error: "Consent must expire between 1 and 366 days from now." };
  }

  const db = getDb();
  const consentId = `psc-${randomUUID()}`;
  const publicSlug = randomBytes(32).toString("base64url");

  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const student = (await db
          .prepare(
            `SELECT id FROM users
         WHERE id = ? AND role = 'student' AND status = 'active' AND deletion_requested = 0
           AND EXISTS (
             SELECT 1 FROM organizations o
              WHERE o.id = users.org_id AND o.status = 'active'
           )
           AND EXISTS (
             SELECT 1 FROM enrollments e
             WHERE e.user_id = users.id AND e.enroll = 'active'
           )`,
          )
          .get(studentUserId));
    if (!student) throw new Error("student_unavailable");

    (await db.prepare(
            `UPDATE profile_sharing_consents
       SET revoked_by_user_id = ?, revoked_at = ?
       WHERE student_user_id = ? AND revoked_at IS NULL`,
          ).run(me.id, now, studentUserId));

    (await db.prepare(
            `INSERT INTO profile_sharing_consents
        (id, student_user_id, public_slug, guardian_name, guardian_email,
         consent_method, guardian_verified_at, granted_by_user_id, granted_at,
         expires_at, discoverable, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
          ).run(
            consentId,
            studentUserId,
            publicSlug,
            guardianName,
            guardianEmail,
            input.consentMethod,
            now,
            me.id,
            now,
            expiresAt,
            notes,
          ));
    (await db.prepare(
            `INSERT INTO crm_activity
        (id, entity_type, entity_id, kind, body, actor_user_id, created_at)
       VALUES (?, 'student_profile', ?, 'sharing_consent_granted', ?, ?, ?)`,
          ).run(
            `pfx-${randomUUID()}`,
            studentUserId,
            `Guardian consent verified by ${input.consentMethod}; link expires ${new Date(expiresAt).toISOString()}.`,
            me.id,
            now,
          ));
    (await db.exec("COMMIT"));
  } catch (error) {
    try {
      (await db.exec("ROLLBACK"));
    } catch {
      // Preserve the original error.
    }
    if (error instanceof Error && error.message === "student_unavailable") {
      return { ok: false, error: "That student is inactive, unenrolled, or unavailable for public sharing." };
    }
    return { ok: false, error: "BOW could not create the sharing consent. Try again." };
  }

  revalidatePath("/profile");
  revalidatePath(`/profile/${publicSlug}`);
  revalidatePath("/app/admin/people");
  return { ok: true, consentId, publicPath: `/profile/${publicSlug}` };
}

export async function revokePublicProfileConsent(consentId: string, reason?: string): Promise<ProfileSharingResult> {
  const me = await requireAdmin();
  const id = consentId.trim();
  if (!id) return { ok: false, error: "Choose a sharing consent." };

  const db = getDb();
  const now = Date.now();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const consent = (await db
          .prepare("SELECT student_user_id, public_slug FROM profile_sharing_consents WHERE id = ? AND revoked_at IS NULL")
          .get(id)) as { student_user_id: string; public_slug: string } | undefined;
    if (!consent) throw new Error("consent_unavailable");
    const revoked = (await db
          .prepare(
            `UPDATE profile_sharing_consents
         SET revoked_by_user_id = ?, revoked_at = ?
         WHERE id = ? AND revoked_at IS NULL`,
          )
          .run(me.id, now, id));
    if (revoked.changes !== 1) throw new Error("consent_unavailable");
    (await db.prepare(
            `INSERT INTO crm_activity
        (id, entity_type, entity_id, kind, body, actor_user_id, created_at)
       VALUES (?, 'student_profile', ?, 'sharing_consent_revoked', ?, ?, ?)`,
          ).run(
            `pfx-${randomUUID()}`,
            consent.student_user_id,
            reason?.trim().slice(0, 500) || "Public credential sharing revoked.",
            me.id,
            now,
          ));
    (await db.exec("COMMIT"));
    revalidatePath("/profile");
    revalidatePath(`/profile/${consent.public_slug}`);
    revalidatePath("/app/admin/people");
    return { ok: true };
  } catch (error) {
    try {
      (await db.exec("ROLLBACK"));
    } catch {
      // Preserve the original error.
    }
    if (error instanceof Error && error.message === "consent_unavailable") {
      return { ok: false, error: "That sharing link is already inactive." };
    }
    return { ok: false, error: "BOW could not revoke the sharing consent. Try again." };
  }
}
