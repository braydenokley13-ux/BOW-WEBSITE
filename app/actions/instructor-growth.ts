"use server";

/* ============================================================
 * Instructor growth — referral actions.
 *
 * Reuses the canonical growth_introductions spine for instructor-submitted
 * referrals and the additive instructors.referred_by_person_id link for staff
 * attribution. No parallel referral system, and a referrer never sees a
 * referred applicant's private data — they only submit a name + context.
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireStaff, requireInstructorSelf } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { ensureFlywheelSchema } from "@/lib/flywheel";
import { logActivity } from "@/lib/hiring";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Instructor self-service: refer a future instructor from your own portal.
 * Lands in the introduction spine attributed to you; staff pick it up and,
 * once the person applies, link the confirmed referral on the new record.
 */
export async function submitInstructorReferral(targetName: string, note: string): Promise<ActionResult> {
  const { user, instructor } = await requireInstructorSelf();
  const name = (targetName ?? "").trim();
  const context = (note ?? "").trim();
  if (name.length < 2) return { ok: false, error: "Add the name of the person you're referring." };
  if (name.length > 160) return { ok: false, error: "That name is too long." };
  if (context.length > 2000) return { ok: false, error: "That note is too long." };

  try {
    await ensureFlywheelSchema();
    const db = getDb();
    const id = `int-${randomUUID().slice(0, 12)}`;
    await db.prepare(
      `INSERT INTO growth_introductions (id, introducer_type, introducer_id, target_kind, target_name, status, note, owner_user_id, created_at)
       VALUES (?, 'instructor', ?, 'instructor', ?, 'suggested', ?, ?, ?)`,
    ).run(id, instructor.id, name, context || null, user.id, Date.now());
    await logActivity("instructor", instructor.id, "referral", `Referred a future instructor: ${name}`, user.id);
    revalidatePath("/app/teach");
    revalidatePath("/app/people/instructors");
    return { ok: true };
  } catch {
    return { ok: false, error: "Your referral could not be saved right now." };
  }
}

/**
 * Staff attribution: record which Person referred an instructor, once the
 * referred prospect has become a record. This is the canonical link the
 * founder's referral leaderboard reads.
 */
export async function attributeInstructorReferrer(instructorId: string, referrerPersonId: string): Promise<ActionResult> {
  const me = await requireStaff();
  const id = (instructorId ?? "").trim();
  const referrer = (referrerPersonId ?? "").trim();
  if (!id) return { ok: false, error: "Missing instructor." };

  const db = getDb();
  const instructor = (await db.prepare("SELECT person_id FROM instructors WHERE id = ?").get(id)) as
    | { person_id: string }
    | undefined;
  if (!instructor) return { ok: false, error: "Instructor not found." };

  // Clearing attribution is allowed (empty referrer).
  if (!referrer) {
    try {
      await db.prepare("UPDATE instructors SET referred_by_person_id = NULL, updated_at = ? WHERE id = ?").run(Date.now(), id);
    } catch {
      return { ok: false, error: "Referral attribution is unavailable until the migration is applied." };
    }
    revalidatePath(`/app/people/${instructor.person_id}`);
    revalidatePath("/app/people/instructors");
    return { ok: true };
  }

  if (referrer === instructor.person_id) return { ok: false, error: "An instructor cannot refer themselves." };
  const referrerRow = (await db.prepare("SELECT id, name FROM people WHERE id = ?").get(referrer)) as
    | { id: string; name: string }
    | undefined;
  if (!referrerRow) return { ok: false, error: "Choose an existing person as the referrer." };

  try {
    await db.prepare("UPDATE instructors SET referred_by_person_id = ?, updated_at = ? WHERE id = ?").run(referrer, Date.now(), id);
  } catch {
    return { ok: false, error: "Referral attribution is unavailable until the migration is applied." };
  }
  await logActivity("instructor", id, "referral", `Referral attributed to ${referrerRow.name}.`, me.id);
  revalidatePath(`/app/people/${instructor.person_id}`);
  revalidatePath("/app/people/instructors");
  return { ok: true };
}
