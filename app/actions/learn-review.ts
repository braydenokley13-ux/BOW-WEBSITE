"use server";

/* ============================================================
 * app/actions/learn-review.ts — Stage 8 follow-up: manual-review queue.
 *
 * Legacy parity target: the old cohort runner's reflection step had no
 * grading at all — an instructor could only eyeball it in the roster. This
 * is the first real manual-review workflow: a `long_text` block with
 * `reflection.mode: 'manual_review'` queues a pending row (submitResponse,
 * app/actions/learn-play.ts) that an instructor approves here with points
 * (capped at the block's authored pointsPossible) + a feedback note.
 *
 * BEFORE vs AFTER completion semantics (documented per the coordinator's
 * request): a review can be approved whether or not the attempt has
 * completed yet.
 *   - If the attempt is still in_progress, approveReview only writes the
 *     review row — completeAttempt (learn-play.ts) folds any already-
 *     approved reviews into its score/stars via the same
 *     lib/learn/review.ts helper, so the eventual completion score is
 *     correct with no separate code path.
 *   - If the attempt is already completed, approveReview recomputes and
 *     writes the attempt's score/stars in the SAME transaction as the
 *     review approval, using the identical `applyApprovedReviews` formula.
 *   Both paths converge to the same final score for the same set of
 *   approved reviews — order of operations (review before/after completion)
 *   never changes the result.
 *   KNOWN SIMPLIFICATION (documented, not silently skipped): XP, skill
 *   points, and badges are NOT recomputed when a review lands after
 *   completion — only score/stars. Reworking the XP/skill idempotency keys
 *   to support a second award event is real scope; deferred (see
 *   docs/learn/stage8-cohort-parity.md).
 * ============================================================ */

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { sqlLearn, withTransaction } from "@/lib/db-sql";
import { migrateLessonDoc } from "@/lib/learn/compat";
import { computeResults, type CommittedResponse } from "@/lib/learn/engine";
import { applyApprovedReviews } from "@/lib/learn/review";
import { createNotification } from "@/lib/notifications";
import { instructorOwnsStudentViaCohort } from "./learn-release";
import type { LessonDoc } from "@/lib/learn/types";

export type ActionResult<T> = T | { ok: false; error: string };

export interface PendingReviewRow {
  id: string;
  attemptId: string;
  blockId: string;
  userId: string;
  studentName: string;
  lessonId: string;
  lessonTitle: string;
  prompt: string | null;
  responseText: string | null;
  pointsPossible: number;
  createdAt: number;
}

/**
 * All pending reviews for students the instructor owns (via any cohort they
 * instruct). Admins see every pending review. No cohort filter is exposed
 * here — the queue is instructor-scoped by ownership, not by a single
 * cohort selector, so a reflection isn't lost if a student changes cohorts.
 */
export async function listPendingReviews(): Promise<ActionResult<PendingReviewRow[]>> {
  const user = await requireRole("instructor", "admin");

  const rows = await sqlLearn<{
    id: string; attempt_id: string; block_id: string; user_id: string; lesson_id: string;
    prompt: string | null; response_text: string | null; points_possible: number; created_at: number;
  }[]>`
    SELECT id, attempt_id, block_id, user_id, lesson_id, prompt, response_text, points_possible, created_at
    FROM learn_manual_reviews WHERE status = 'pending' ORDER BY created_at ASC
  `;
  if (rows.length === 0) return [];

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const lessonIds = [...new Set(rows.map((r) => r.lesson_id))];
  const [userRows, lessonRows] = await Promise.all([
    sqlLearn<{ id: string; name: string }[]>`SELECT id, name FROM users WHERE id = ANY(${userIds})`,
    sqlLearn<{ id: string; title: string }[]>`SELECT id, title FROM learn_lessons WHERE id = ANY(${lessonIds})`,
  ]);
  const nameById = new Map(userRows.map((u) => [u.id, u.name]));
  const titleById = new Map(lessonRows.map((l) => [l.id, l.title]));

  const visible: PendingReviewRow[] = [];
  for (const r of rows) {
    if (user.role !== "admin" && !(await instructorOwnsStudentViaCohort(user.id, r.user_id))) continue;
    visible.push({
      id: r.id, attemptId: r.attempt_id, blockId: r.block_id, userId: r.user_id,
      studentName: nameById.get(r.user_id) ?? r.user_id, lessonId: r.lesson_id,
      lessonTitle: titleById.get(r.lesson_id) ?? "Untitled lesson", prompt: r.prompt,
      responseText: r.response_text, pointsPossible: r.points_possible, createdAt: r.created_at,
    });
  }
  return visible;
}

export interface ApproveReviewResult {
  ok: true;
  attemptRecomputed: boolean;
}

export async function approveReview(
  reviewId: string,
  pointsAwarded: number,
  feedback: string,
): Promise<ActionResult<ApproveReviewResult>> {
  const user = await requireRole("instructor", "admin");

  const result = await withTransaction(async (tx) => {
    const rows = await tx<{
      id: string; attempt_id: string; block_id: string; user_id: string; lesson_id: string;
      status: string; points_possible: number;
    }[]>`SELECT id, attempt_id, block_id, user_id, lesson_id, status, points_possible FROM learn_manual_reviews WHERE id = ${reviewId} FOR UPDATE`;
    const review = rows[0];
    if (!review) throw new Error("Review not found");
    if (review.status === "approved") throw new Error("This response has already been reviewed");

    if (user.role !== "admin" && !(await instructorOwnsStudentViaCohort(user.id, review.user_id))) {
      throw new Error("You can only review students enrolled in a cohort you instruct.");
    }
    if (pointsAwarded < 0 || pointsAwarded > review.points_possible) {
      throw new Error(`Points must be between 0 and ${review.points_possible}`);
    }

    const now = Date.now();
    await tx`
      UPDATE learn_manual_reviews
      SET status = 'approved', points_awarded = ${Math.round(pointsAwarded)}, feedback = ${feedback || null},
          reviewed_by = ${user.id}, reviewed_at = ${now}
      WHERE id = ${reviewId}
    `;

    // If the attempt already completed, recompute its score/stars NOW in
    // this same transaction (see module header for the before/after
    // semantics this preserves).
    const attemptRows = await tx<{
      id: string; version_id: string; status: string; started_at: number;
    }[]>`SELECT id, version_id, status, started_at FROM learn_attempts WHERE id = ${review.attempt_id} FOR UPDATE`;
    const attempt = attemptRows[0];
    let attemptRecomputed = false;
    if (attempt && attempt.status === "completed") {
      const versionRows = await tx<{ doc: unknown }[]>`SELECT doc FROM learn_lesson_versions WHERE id = ${attempt.version_id}`;
      const doc: LessonDoc = migrateLessonDoc(versionRows[0].doc);
      const committedRows = await tx<{ block_id: string; response: unknown }[]>`
        SELECT block_id, response FROM learn_responses WHERE attempt_id = ${review.attempt_id} AND committed_at IS NOT NULL
      `;
      const committed: CommittedResponse[] = committedRows.map((r) => ({ blockId: r.block_id, response: r.response }));
      const base = computeResults(doc, committed);
      const approvedRows = await tx<{ points_awarded: number | null; points_possible: number }[]>`
        SELECT points_awarded, points_possible FROM learn_manual_reviews WHERE attempt_id = ${review.attempt_id} AND status = 'approved'
      `;
      const adjusted = applyApprovedReviews(
        base,
        approvedRows.map((r) => ({ pointsAwarded: r.points_awarded ?? 0, pointsPossible: r.points_possible })),
        doc.scoring.starThresholds,
      );
      await tx`UPDATE learn_attempts SET score = ${adjusted.score0to100}, stars = ${adjusted.stars} WHERE id = ${review.attempt_id}`;
      attemptRecomputed = true;
    }

    return { ok: true as const, attemptRecomputed, studentId: review.user_id, lessonId: review.lesson_id };
  }).catch((err) => ({ ok: false as const, error: err instanceof Error ? err.message : "Failed to approve review" }));

  if (!result.ok) return result;

  try {
    await createNotification({
      userId: result.studentId,
      type: "reflection_reviewed",
      title: "Your reflection was reviewed",
      body: pointsAwarded > 0 ? `You earned ${Math.round(pointsAwarded)} points. ${feedback || ""}`.trim() : (feedback || "Your instructor left feedback on your reflection."),
      link: `/dashboard`,
      id: `ntf-review-${reviewId}`,
    });
  } catch {
    // Non-fatal — the review is already durably approved.
  }

  revalidatePath("/app/instructor");
  revalidatePath("/dashboard");
  return { ok: true, attemptRecomputed: result.attemptRecomputed };
}
