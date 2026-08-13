"use server";

/* ============================================================
 * HQ Home queue resolutions.
 *
 * Every action here resolves an exception through the system that owns it —
 * the enrollment engine for offers, the Work queue for follow-ups,
 * lib/program-operations for duplicate reviews. Nothing writes those tables
 * directly, and nothing "dismisses" an item: an exception leaves the queue
 * because the underlying fact changed.
 * ============================================================ */

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/dal";
import { EnrollmentError, extendWaitlistOffer } from "@/lib/enrollment";
import { checkMergeSafety, resolveDuplicateReview } from "@/lib/program-operations";
import { getDb } from "@/lib/db";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function actorLabel(name: string): string {
  return `${name} (staff)`;
}

/** Home always refreshes; the class record shares these same records. */
function refreshHome(alsoClassId?: string | null) {
  revalidatePath("/app");
  if (alsoClassId) revalidatePath(`/app/classes/${alsoClassId}`);
}

/**
 * Give a family another window to answer a waitlist offer. The seat is
 * already held by the offer, so this changes a deadline and nothing else.
 */
export async function extendOffer(offerId: string, hours: number): Promise<ActionResult> {
  const me = await requireStaff();
  try {
    await extendWaitlistOffer(offerId, hours, { userId: me.id, label: actorLabel(me.name) }, "Extended from HQ Home.");
    refreshHome();
    return { ok: true };
  } catch (error) {
    if (error instanceof EnrollmentError) return { ok: false, error: error.message };
    return { ok: false, error: "Could not extend that offer." };
  }
}

export interface DuplicateReviewDetail {
  reviewId: string;
  detectedReason: string | null;
  safety: { safe: boolean; conflicts: string[] };
  students: {
    id: string;
    name: string;
    grade: string | null;
    school: string | null;
    guardianName: string | null;
    registrations: string[];
  }[];
}

/**
 * Everything a person needs to decide whether two records are one child.
 *
 * Read-only on purpose. Nothing about a duplicate is resolved by opening it,
 * and the merge-safety conflicts are shown before any choice is offered.
 */
export async function getDuplicateReview(reviewId: string): Promise<DuplicateReviewDetail | null> {
  await requireStaff();
  const db = getDb();
  const review = (await db
    .prepare("SELECT id, student_id, other_student_id, detected_reason, status FROM student_duplicate_reviews WHERE id = ?")
    .get(reviewId)) as
    | { id: string; student_id: string; other_student_id: string; detected_reason: string | null; status: string }
    | undefined;
  if (!review || review.status !== "open") return null;

  const ids = [review.student_id, review.other_student_id];
  const students = (await db
    .prepare(
      `SELECT s.id, s.name, s.grade, s.school, g.name AS guardian_name
         FROM students s
         LEFT JOIN people g ON g.id = s.guardian_person_id
        WHERE s.id IN (?, ?)`,
    )
    .all(...ids)) as { id: string; name: string; grade: string | null; school: string | null; guardian_name: string | null }[];

  const registrations = (await db
    .prepare(
      `SELECT r.student_id, p.name AS program_name
         FROM program_registrations r
         JOIN programs p ON p.id = r.program_id
        WHERE r.student_id IN (?, ?)
          AND r.status NOT IN ('withdrawn', 'expired', 'declined', 'cancelled')`,
    )
    .all(...ids)) as { student_id: string; program_name: string }[];

  const safety = await checkMergeSafety(review.student_id, review.other_student_id);

  return {
    reviewId: review.id,
    detectedReason: review.detected_reason,
    safety,
    // Ordered to match the pair, so the two columns never swap between loads.
    students: ids
      .map((id) => students.find((s) => s.id === id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((s) => ({
        id: s.id,
        name: s.name,
        grade: s.grade,
        school: s.school,
        guardianName: s.guardian_name,
        registrations: registrations.filter((r) => r.student_id === s.id).map((r) => r.program_name),
      })),
  };
}

/**
 * Record a human decision about a possible duplicate.
 *
 * "distinct" and "deferred" are always available. A merge additionally needs
 * the canonical record named, because the engine has to know which identity
 * survives — nothing is ever merged on a guess.
 */
export async function decideDuplicateReview(
  reviewId: string,
  decision: "distinct" | "merged" | "deferred",
  options: { canonicalStudentId?: string | null; note?: string | null } = {},
): Promise<ActionResult> {
  const me = await requireStaff();
  if (decision === "merged" && !options.canonicalStudentId) {
    return { ok: false, error: "Choose which record to keep before merging." };
  }
  const result = await resolveDuplicateReview(
    reviewId,
    decision,
    { userId: me.id, label: actorLabel(me.name) },
    { canonicalStudentId: options.canonicalStudentId ?? null, note: options.note ?? null },
  );
  if (!result.ok) return { ok: false, error: result.error ?? "Could not record that decision." };
  refreshHome();
  revalidatePath("/app/people");
  return { ok: true };
}
