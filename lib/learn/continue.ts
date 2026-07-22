/* ============================================================
 * lib/learn/continue.ts — Stage 7: pure ContinueCard selection logic.
 *
 * Extracted from the StudentHome data loader so the "what should the
 * dominant hero card point at" decision is unit-testable without a DB.
 * Priority, in order:
 *   1. An in-progress attempt (resume where they left off).
 *   2. The first available (unlocked, not completed) map node in map order.
 *   3. Otherwise null (map fully complete, or no map yet) — caller falls
 *      back to a "you're all caught up" state.
 * ============================================================ */

export interface ContinueCandidateNode {
  nodeId: string;
  lessonId: string | null;
  title: string;
  moduleTitle: string | null;
  estMinutes: number | null;
  /** Map order — lower sorts first. Stable tiebreak on nodeId. */
  order: number;
  unlocked: boolean;
  /** Best-ever completion for this lesson, if any. */
  completed: boolean;
}

export interface InProgressAttempt {
  nodeId: string;
  lessonId: string;
  attemptId: string;
  /** Count of blocks already committed, for the remaining-time estimate. */
  blocksAnswered: number;
  totalBlocks: number;
}

export interface ContinueSelection {
  kind: "resume" | "next" | "none";
  nodeId: string | null;
  lessonId: string | null;
  attemptId: string | null;
  title: string | null;
  moduleTitle: string | null;
  /** Estimated minutes remaining (est_minutes minus in-progress fraction). */
  estMinutesRemaining: number | null;
}

/** Estimate remaining minutes given a lesson's est_minutes and in-progress fraction answered. */
export function estimateRemainingMinutes(estMinutes: number | null, blocksAnswered: number, totalBlocks: number): number | null {
  if (estMinutes == null) return null;
  if (totalBlocks <= 0) return estMinutes;
  const fractionDone = Math.min(1, Math.max(0, blocksAnswered / totalBlocks));
  const remaining = estMinutes * (1 - fractionDone);
  return Math.max(1, Math.round(remaining));
}

/** Pick the ContinueCard target: resume in-progress, else next unlocked/incomplete node in order. */
export function selectContinueTarget(
  nodes: ContinueCandidateNode[],
  inProgress: InProgressAttempt | null,
): ContinueSelection {
  if (inProgress) {
    const node = nodes.find((n) => n.nodeId === inProgress.nodeId);
    return {
      kind: "resume",
      nodeId: inProgress.nodeId,
      lessonId: inProgress.lessonId,
      attemptId: inProgress.attemptId,
      title: node?.title ?? null,
      moduleTitle: node?.moduleTitle ?? null,
      estMinutesRemaining: estimateRemainingMinutes(node?.estMinutes ?? null, inProgress.blocksAnswered, inProgress.totalBlocks),
    };
  }

  const sorted = [...nodes].sort((a, b) => a.order - b.order || a.nodeId.localeCompare(b.nodeId));
  const next = sorted.find((n) => n.unlocked && !n.completed && n.lessonId);
  if (!next) {
    return { kind: "none", nodeId: null, lessonId: null, attemptId: null, title: null, moduleTitle: null, estMinutesRemaining: null };
  }
  return {
    kind: "next",
    nodeId: next.nodeId,
    lessonId: next.lessonId,
    attemptId: null,
    title: next.title,
    moduleTitle: next.moduleTitle,
    estMinutesRemaining: next.estMinutes,
  };
}
