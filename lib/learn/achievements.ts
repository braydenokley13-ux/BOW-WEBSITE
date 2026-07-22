/* ============================================================
 * lib/learn/achievements.ts — declarative badge-rule registry (Stage 9, plan §1).
 *
 * `badges.rule` (jsonb) holds one of the shapes below. Zod is schema
 * authority — a malformed rule fails validation and is simply skipped by
 * the evaluator (never thrown into the completeAttempt transaction).
 *
 * The evaluator is pure: it takes an AchievementContext built by the caller
 * from already-fetched attempt/mastery rows and returns which of a set of
 * candidate badges are newly satisfied. No DB access in this module —
 * isomorphic, unit-testable without a database.
 * ============================================================ */

import { z } from "zod";

/* ---------------- rule schema ---------------- */

const RuleUnionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("lesson_complete"),
    lessonId: z.string().min(1),
    minStars: z.number().int().min(0).max(3).optional(),
  }),
  z.object({
    type: z.literal("track_complete"),
    trackId: z.string().min(1),
  }),
  z.object({
    type: z.literal("module_complete"),
    moduleId: z.string().min(1),
  }),
  z.object({
    type: z.literal("variable_threshold"),
    variableId: z.string().min(1),
    gte: z.number().optional(),
    lte: z.number().optional(),
  }),
  z.object({
    type: z.literal("score_gte"),
    lessonId: z.string().min(1).optional(),
    score: z.number().min(0).max(100),
  }),
  z.object({
    type: z.literal("stars_total_gte"),
    n: z.number().int().min(0),
  }),
  z.object({
    type: z.literal("lessons_completed_gte"),
    n: z.number().int().min(0),
  }),
]);

/** Cross-field check (variable_threshold needs at least one bound) applied after the discriminated union so zod can still use `type` to pick the right branch first. */
export const AchievementRuleSchema = RuleUnionSchema.refine(
  (r) => r.type !== "variable_threshold" || r.gte !== undefined || r.lte !== undefined,
  { message: "variable_threshold requires at least one of gte/lte" },
);

export type AchievementRule = z.infer<typeof RuleUnionSchema>;

/** Parse + validate an unknown value (e.g. a `badges.rule` jsonb column) into a rule, or null if malformed. */
export function parseAchievementRule(value: unknown): AchievementRule | null {
  const parsed = AchievementRuleSchema.safeParse(value);
  return parsed.success ? (parsed.data as AchievementRule) : null;
}

/* ---------------- evaluation context ---------------- */

export interface AchievementContext {
  /** The lesson just completed in this attempt. */
  lessonId: string;
  /** This attempt's score (0-100). */
  score: number;
  /** This attempt's stars (0-3). */
  stars: number;
  /** Final variable values at the end of this attempt. */
  variables: Record<string, number>;
  /** Lesson ids the student has ever completed (lifetime mastery), including this attempt's lesson. */
  completedLessonIds: ReadonlySet<string>;
  /** Sum of best_stars across every lesson the student has completed (lifetime), including this attempt. */
  totalStarsEarned: number;
  /** Count of distinct lessons completed (lifetime), including this attempt. */
  totalLessonsCompleted: number;
  /** trackId -> the full set of lesson ids that must all be completed for that track. */
  trackLessonIds: Readonly<Record<string, readonly string[]>>;
  /** moduleId -> the full set of lesson ids that must all be completed for that module. */
  moduleLessonIds: Readonly<Record<string, readonly string[]>>;
}

/** True if every lesson in `lessonIds` is present in `completed`. Empty sets never count as "complete". */
function allCompleted(lessonIds: readonly string[] | undefined, completed: ReadonlySet<string>): boolean {
  if (!lessonIds || lessonIds.length === 0) return false;
  return lessonIds.every((id) => completed.has(id));
}

/** Evaluate a single rule against a context. Pure — no I/O. */
export function evaluateRule(rule: AchievementRule, ctx: AchievementContext): boolean {
  switch (rule.type) {
    case "lesson_complete": {
      if (ctx.lessonId !== rule.lessonId) return false;
      if (!ctx.completedLessonIds.has(rule.lessonId)) return false;
      if (rule.minStars !== undefined && ctx.stars < rule.minStars) return false;
      return true;
    }
    case "track_complete":
      return allCompleted(ctx.trackLessonIds[rule.trackId], ctx.completedLessonIds);
    case "module_complete":
      return allCompleted(ctx.moduleLessonIds[rule.moduleId], ctx.completedLessonIds);
    case "variable_threshold": {
      const value = ctx.variables[rule.variableId];
      if (value === undefined) return false;
      if (rule.gte !== undefined && value < rule.gte) return false;
      if (rule.lte !== undefined && value > rule.lte) return false;
      return true;
    }
    case "score_gte": {
      if (rule.lessonId !== undefined && ctx.lessonId !== rule.lessonId) return false;
      return ctx.score >= rule.score;
    }
    case "stars_total_gte":
      return ctx.totalStarsEarned >= rule.n;
    case "lessons_completed_gte":
      return ctx.totalLessonsCompleted >= rule.n;
    default: {
      // Exhaustiveness guard — a new rule type added to the union without a
      // case here fails at compile time (never at runtime for a known type).
      const _exhaustive: never = rule;
      return _exhaustive;
    }
  }
}

export interface RuleBadgeCandidate {
  id: string;
  rule: unknown;
}

/** From a set of candidate badges (id + raw jsonb rule), return the ids whose rule is well-formed and satisfied by `ctx`. Malformed rules are silently skipped, never thrown. */
export function evaluateBadgeRules(candidates: readonly RuleBadgeCandidate[], ctx: AchievementContext): string[] {
  const satisfied: string[] = [];
  for (const candidate of candidates) {
    const rule = parseAchievementRule(candidate.rule);
    if (!rule) continue;
    if (evaluateRule(rule, ctx)) satisfied.push(candidate.id);
  }
  return satisfied;
}
