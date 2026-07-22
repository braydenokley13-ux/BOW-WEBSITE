/* ============================================================
 * lib/learn/review.ts — Stage 8 follow-up: pure manual-review score math.
 *
 * `gradeBlock` (lib/learn/engine.ts) deliberately never scores a
 * `manual_review` long_text block — a human has to grade a reflection, not a
 * formula — so it always contributes 0/0 to computeResults' totals. This
 * module is the DB-aware layer's shared, pure recompute step: take the
 * engine's base totals (which already exclude manual_review points) and add
 * in whatever has been approved so far. Used identically by
 * completeAttempt (first-time completion) and approveReview (adjusting an
 * attempt that already completed) — same formula, same rounding, so a
 * review approved before vs after completion converges to the identical
 * final score either way.
 * ============================================================ */

import { roundPoints } from "./engine";

export interface ApprovedReview {
  pointsAwarded: number;
  pointsPossible: number;
}

export interface ReviewAdjustedResult {
  totalPoints: number;
  pointsPossible: number;
  score0to100: number;
  stars: number;
}

/**
 * Fold approved manual-review points into a base engine result, then
 * recompute score/stars from the combined totals using the lesson's own
 * star thresholds. Pending reviews are NOT passed in here — by construction
 * they were never in `basePointsPossible` (the engine excludes them), so
 * "pending excluded from auto-score" falls out for free rather than needing
 * special-casing.
 */
export function applyApprovedReviews(
  basePoints: { totalPoints: number; pointsPossible: number },
  approvedReviews: ApprovedReview[],
  starThresholds: [number, number, number],
): ReviewAdjustedResult {
  const reviewPoints = approvedReviews.reduce((s, r) => s + r.pointsAwarded, 0);
  const reviewPossible = approvedReviews.reduce((s, r) => s + r.pointsPossible, 0);

  const totalPoints = roundPoints(basePoints.totalPoints + reviewPoints);
  const pointsPossible = roundPoints(basePoints.pointsPossible + reviewPossible);
  const score0to100 = pointsPossible > 0 ? roundPoints((totalPoints / pointsPossible) * 100) : 0;

  const [t1, t2, t3] = starThresholds;
  let stars = 0;
  if (score0to100 >= t1) stars = 1;
  if (score0to100 >= t2) stars = 2;
  if (score0to100 >= t3) stars = 3;

  return { totalPoints, pointsPossible, score0to100, stars };
}
