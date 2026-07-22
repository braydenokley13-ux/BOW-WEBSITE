/* ============================================================
 * lib/learn/unlock.ts — Stage 7: shared unlock policy evaluator.
 *
 * Pure, isomorphic (no DB imports) so both the student CareerMap (read
 * path) and startAttempt (enforcement path) evaluate node access with the
 * identical rule, per docs plan §6 Stage 7 / §1 unlock jsonb shape:
 *   { requiresNodes?: string[], minStarsTotal?: number, minLevel?: number,
 *     badgeId?: string, requiresInstructorRelease?: boolean, opensAt?: number }
 *
 * Runtime overrides (learn_release_state) are resolved by the caller into
 * `ctx.releases` before calling this evaluator — this module has no DB
 * awareness, matching lib/learn/engine.ts's pure-function posture.
 * ============================================================ */

export interface UnlockPolicy {
  requiresNodes?: string[];
  minStarsTotal?: number;
  minLevel?: number;
  badgeId?: string;
  requiresInstructorRelease?: boolean;
  opensAt?: number;
}

export interface UnlockNode {
  id: string;
  unlock: UnlockPolicy;
}

export interface UnlockContext {
  /** Node ids the student has completed (any stars > 0 / mastery recorded). */
  completedNodes: Set<string>;
  /** Lifetime total stars across all lessons (drives minStarsTotal). */
  starsTotal: number;
  /** Student's current level (career/XP level — drives minLevel). */
  level: number;
  /** Badge ids the student has earned (drives badgeId). */
  badges: Set<string>;
  /** Current time (epoch ms) — drives opensAt. Pass Date.now() at call time. */
  now: number;
  /**
   * Resolved release state for this node, from learn_release_state rows
   * matching the student's cohort/program/self scope. `undefined` means no
   * release row was found for a policy that requires one.
   */
  released?: boolean;
}

export type UnlockResult =
  | { unlocked: true }
  | { unlocked: false; reason: string };

/**
 * Evaluate whether a single node is unlocked for a student. All configured
 * conditions in `unlock` are AND'ed together — a node with no unlock policy
 * (empty object) is always unlocked. Returns a human-readable lock reason
 * (no jargon) for the first condition that fails, in a stable priority
 * order so the UI shows one clear reason rather than a stack of them.
 */
export function evaluateNodeUnlock(node: UnlockNode, ctx: UnlockContext): UnlockResult {
  const u = node.unlock || {};

  if (u.requiresNodes && u.requiresNodes.length > 0) {
    const missing = u.requiresNodes.filter((id) => !ctx.completedNodes.has(id));
    if (missing.length > 0) {
      return {
        unlocked: false,
        reason: missing.length === 1 ? "Complete the previous lesson to unlock this." : "Complete the previous lessons to unlock this.",
      };
    }
  }

  if (typeof u.minStarsTotal === "number" && ctx.starsTotal < u.minStarsTotal) {
    return { unlocked: false, reason: `Earn ${u.minStarsTotal - ctx.starsTotal} more star${u.minStarsTotal - ctx.starsTotal === 1 ? "" : "s"} to unlock this.` };
  }

  if (typeof u.minLevel === "number" && ctx.level < u.minLevel) {
    return { unlocked: false, reason: `Reach level ${u.minLevel} to unlock this.` };
  }

  if (u.badgeId && !ctx.badges.has(u.badgeId)) {
    return { unlocked: false, reason: "Earn the required badge to unlock this." };
  }

  if (typeof u.opensAt === "number" && ctx.now < u.opensAt) {
    return { unlocked: false, reason: `Opens ${new Date(u.opensAt).toLocaleDateString()}.` };
  }

  if (u.requiresInstructorRelease) {
    if (ctx.released !== true) {
      return { unlocked: false, reason: "Your instructor hasn't released this yet." };
    }
  }

  return { unlocked: true };
}

/** Convenience: true/false without the reason, for callers that just gate. */
export function isNodeUnlocked(node: UnlockNode, ctx: UnlockContext): boolean {
  return evaluateNodeUnlock(node, ctx).unlocked;
}
