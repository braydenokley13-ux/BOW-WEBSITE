/* ============================================================
 * lib/learn/engine.ts — pure, isomorphic scoring/branching engine.
 *
 * No imports from lib/db*.ts or React. Client (optimistic) and server
 * (authoritative) both call these exact functions so results are always
 * identical — this is the whole point of "deterministic rounding" in the
 * plan: a client preview and a server recompute must never disagree.
 * ============================================================ */

import type { Block, Condition, EffectRule, LessonDoc, Ref } from "./types";

/* ---------------- deterministic rounding ----------------
 * Math.round() in JS rounds halves away from zero for positive inputs
 * (true "half up"), unlike languages/DBs that default to banker's rounding
 * (round-half-to-even). We deliberately round on a *scaled integer* (value
 * * 10^n) rather than trusting float arithmetic at fractional precision, so
 * results are stable across client/server/JS-engine versions.
 * ---------------------------------------------------------- */

/** Round a currency amount to 2 decimal places (e.g. dollars/cents). */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Round a percent value (stored as 0–100) to 2 decimal places. */
export function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Round a points/score value to the nearest whole number. */
export function roundPoints(value: number): number {
  return Math.round(value);
}

/* ---------------- variables & effects ---------------- */

export type Variables = Record<string, number>;

/** Coerce an arbitrary committed response into a number for from_response effects. */
function responseAsNumber(response: unknown): number {
  if (typeof response === "number") return response;
  if (typeof response === "string") {
    const parsed = Number(response);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (response && typeof response === "object") {
    // Budget-allocation-shaped responses: sum numeric values.
    return Object.values(response as Record<string, unknown>).reduce<number>((sum, v) => {
      return sum + (typeof v === "number" ? v : 0);
    }, 0);
  }
  return 0;
}

/**
 * Apply a single EffectRule to `vars`, returning a NEW variables object
 * (never mutates the input) plus the signed delta actually applied to that
 * variable. `response` is required for the from_response verb.
 */
export function applyEffect(
  vars: Variables,
  rule: EffectRule,
  response?: unknown,
  ctx?: EvalContext,
): { vars: Variables; delta: number } {
  if (rule.when && ctx && !evalCondition(rule.when, ctx)) {
    return { vars, delta: 0 };
  }
  const current = vars[rule.variable] ?? 0;
  let next = current;
  switch (rule.verb) {
    case "increase_by":
      next = current + (rule.amount ?? 0);
      break;
    case "decrease_by":
      next = current - (rule.amount ?? 0);
      break;
    case "increase_pct":
      next = current * (1 + (rule.amount ?? 0) / 100);
      break;
    case "decrease_pct":
      next = current * (1 - (rule.amount ?? 0) / 100);
      break;
    case "set_to":
      next = rule.amount ?? current;
      break;
    case "from_response":
      next = current + responseAsNumber(response) * (rule.scale ?? 1);
      break;
    default:
      next = current;
  }
  next = roundPoints(next * 10000) / 10000; // stable float, generous precision
  return { vars: { ...vars, [rule.variable]: next }, delta: roundPoints((next - current) * 10000) / 10000 };
}

/** Apply a list of EffectRules in order, accumulating per-variable deltas. */
export function applyEffects(
  vars: Variables,
  rules: EffectRule[],
  response?: unknown,
  ctx?: EvalContext,
): { vars: Variables; deltas: Record<string, number> } {
  let currentVars = vars;
  const deltas: Record<string, number> = {};
  for (const rule of rules) {
    const result = applyEffect(currentVars, rule, response, ctx ? { ...ctx, variables: currentVars } : ctx);
    currentVars = result.vars;
    deltas[rule.variable] = (deltas[rule.variable] ?? 0) + result.delta;
  }
  return { vars: currentVars, deltas };
}

/* ---------------- conditions ---------------- */

export interface EvalContext {
  variables: Variables;
  /** Committed responses keyed by block id (most recent instance). */
  responses: Record<string, unknown>;
}

function resolveRef(ref: Ref, ctx: EvalContext): number | string | boolean | undefined {
  if (ref.kind === "variable") return ctx.variables[ref.key];
  const response = ctx.responses[ref.key];
  if (ref.path && response && typeof response === "object") {
    return (response as Record<string, unknown>)[ref.path] as number | string | boolean | undefined;
  }
  return response as number | string | boolean | undefined;
}

/** Evaluate a Condition tree against variables + committed responses. */
export function evalCondition(cond: Condition, ctx: EvalContext): boolean {
  switch (cond.op) {
    case "all":
      return cond.conditions.every((c) => evalCondition(c, ctx));
    case "any":
      return cond.conditions.some((c) => evalCondition(c, ctx));
    case "answered": {
      const response = ctx.responses[cond.blockId];
      if (response === undefined) return false;
      if (cond.optionId === undefined) return true;
      if (Array.isArray(response)) return response.includes(cond.optionId);
      return response === cond.optionId;
    }
    case "gte":
    case "lte":
    case "eq": {
      const actual = resolveRef(cond.ref, ctx);
      if (actual === undefined || cond.value === undefined) return false;
      if (cond.op === "gte") return Number(actual) >= Number(cond.value);
      if (cond.op === "lte") return Number(actual) <= Number(cond.value);
      return actual === cond.value;
    }
    case "between": {
      const actual = resolveRef(cond.ref, ctx);
      if (actual === undefined || cond.min === undefined || cond.max === undefined) return false;
      const num = Number(actual);
      return num >= cond.min && num <= cond.max;
    }
    default:
      return false;
  }
}

/* ---------------- branching ---------------- */

/**
 * Create a transition-limit guard used while walking a lesson's branch
 * graph at runtime — call `.step()` on every block transition; it throws
 * once `limit` transitions have occurred, protecting against malformed
 * docs with cycles that slipped past publish-time validation.
 */
export function makeTransitionGuard(limit = 500) {
  let count = 0;
  return {
    step(): void {
      count += 1;
      if (count > limit) {
        throw new Error(`[learn/engine] Transition limit (${limit}) exceeded — possible branch cycle`);
      }
    },
    get count() {
      return count;
    },
  };
}

/**
 * Resolve the next block id a response branches to, or undefined for
 * "fall through to the next block in phase order". Branch targets are
 * always block ids (a phase's entry point is its first block's id).
 */
export function resolveBranch(block: Block, response: unknown): string | undefined {
  switch (block.type) {
    case "strategy_choice": {
      const option = block.options.find((o) => o.id === response);
      return option?.goTo ?? block.branch?.[String(response)];
    }
    case "scenario": {
      const choice = block.choices.find((c) => c.id === response);
      return choice?.goTo;
    }
    case "slider":
    case "price_set":
    case "budget_allocation":
    case "rank":
    case "categorize":
    case "drag_drop":
    case "match":
    case "forecast":
      return block.branch?.[String(response)];
    case "tradeoff_matrix": {
      const option = block.options.find((o) => o.id === response);
      return option?.goTo ?? block.branch?.[String(response)];
    }
    default:
      return undefined;
  }
}

/* ---------------- grading ---------------- */

export interface GradeOutcome {
  correct?: boolean;
  pointsEarned: number;
  pointsPossible: number;
  variableDeltas: Record<string, number>;
  feedback?: string;
}

function normalizeAnswer(value: string, caseSensitive: boolean): string {
  const trimmed = value.trim();
  return caseSensitive ? trimmed : trimmed.toLowerCase();
}

/** Grade a single block's committed response. Pure — no side effects. */
export function gradeBlock(block: Block, response: unknown, ctx?: EvalContext): GradeOutcome {
  const noScore: GradeOutcome = { pointsEarned: 0, pointsPossible: 0, variableDeltas: {} };

  switch (block.type) {
    case "text":
    case "heading":
    case "callout":
    case "stat":
    case "comparison":
    case "image":
      return noScore;

    case "media": {
      const satisfied =
        block.completion.mode === "none"
          ? true
          : block.completion.mode === "started"
            ? Boolean(response)
            : block.completion.mode === "finished"
              ? response === "finished" || response === true
              : typeof response === "number" && response >= block.completion.threshold;
      return { ...noScore, correct: satisfied };
    }

    case "long_text": {
      if (block.reflection.mode === "min_words") {
        const words = typeof response === "string" ? response.trim().split(/\s+/).filter(Boolean).length : 0;
        return { ...noScore, correct: words >= block.reflection.minWords };
      }
      return { ...noScore, correct: typeof response === "string" && response.trim().length > 0 };
    }

    case "mc": {
      const correct = response === block.correctOptionId;
      return {
        correct,
        pointsEarned: correct ? block.points : 0,
        pointsPossible: block.points,
        variableDeltas: {},
        feedback: correct ? block.feedback?.correct : block.feedback?.incorrect,
      };
    }

    case "multi_select": {
      const chosen = Array.isArray(response) ? (response as string[]) : [];
      const correctSet = new Set(block.correctOptionIds);
      const chosenSet = new Set(chosen);
      const exact =
        correctSet.size === chosenSet.size && [...correctSet].every((id) => chosenSet.has(id));
      let pointsEarned = 0;
      if (block.grading === "correct") {
        pointsEarned = exact ? block.points : 0;
      } else {
        const correctChosen = chosen.filter((id) => correctSet.has(id)).length;
        const incorrectChosen = chosen.filter((id) => !correctSet.has(id)).length;
        const fraction = Math.max(0, (correctChosen - incorrectChosen) / correctSet.size);
        pointsEarned = roundPoints(block.points * fraction);
      }
      return { correct: exact, pointsEarned, pointsPossible: block.points, variableDeltas: {} };
    }

    case "true_false": {
      const correct = response === block.correctAnswer;
      return { correct, pointsEarned: correct ? block.points : 0, pointsPossible: block.points, variableDeltas: {} };
    }

    case "numeric": {
      const value = typeof response === "number" ? response : Number(response);
      const diff = Math.abs(value - block.correctValue);
      const correct = diff <= block.tolerance;
      let pointsEarned = 0;
      if (block.grading === "correct") {
        pointsEarned = correct ? block.points : 0;
      } else {
        const span = block.tolerance > 0 ? block.tolerance : Math.max(Math.abs(block.correctValue), 1);
        const fraction = Math.max(0, 1 - diff / (span * 4));
        pointsEarned = roundPoints(block.points * fraction);
      }
      return { correct, pointsEarned, pointsPossible: block.points, variableDeltas: {} };
    }

    case "short_response": {
      const answer = typeof response === "string" ? response : "";
      const correct = block.acceptedAnswers.some(
        (accepted) => normalizeAnswer(accepted, block.caseSensitive) === normalizeAnswer(answer, block.caseSensitive),
      );
      return { correct, pointsEarned: correct ? block.points : 0, pointsPossible: block.points, variableDeltas: {} };
    }

    case "strategy_choice": {
      const option = block.options.find((o) => o.id === response);
      const { deltas } = applyEffects(ctx?.variables ?? {}, [...block.effects, ...(option?.effects ?? [])], response, ctx);
      return gradeDecision(block, response, option?.points, deltas);
    }

    case "slider":
    case "price_set": {
      const { deltas } = applyEffects(ctx?.variables ?? {}, block.effects, response, ctx);
      return gradeDecision(block, response, undefined, deltas);
    }

    case "budget_allocation": {
      const allocation = (response ?? {}) as Record<string, number>;
      const sum = Object.values(allocation).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);
      const overBudget = sum > block.totalBudget;
      const { deltas } = applyEffects(ctx?.variables ?? {}, block.effects, response, ctx);
      if (overBudget) {
        return {
          pointsEarned: 0,
          pointsPossible: block.points,
          variableDeltas: deltas,
          feedback: "Allocation exceeds the total budget.",
        };
      }
      return gradeDecision(block, response, undefined, deltas);
    }

    case "scenario": {
      const choice = block.choices.find((c) => c.id === response);
      const { deltas } = applyEffects(ctx?.variables ?? {}, choice?.effects ?? [], response, ctx);
      return {
        pointsEarned: choice?.points ?? 0,
        pointsPossible: Math.max(...block.choices.map((c) => c.points ?? 0), 0),
        variableDeltas: deltas,
        feedback: choice?.feedback,
      };
    }

    case "rank": {
      const order = Array.isArray(response) ? (response as string[]) : [];
      const exact = order.length === block.correctOrder.length && order.every((id, i) => id === block.correctOrder[i]);
      // Partial credit: fraction of items in their correct position (Kendall-ish, cheap + explainable).
      const correctPositions = order.filter((id, i) => block.correctOrder[i] === id).length;
      const fraction = block.correctOrder.length > 0 ? correctPositions / block.correctOrder.length : 0;
      const { deltas } = applyEffects(ctx?.variables ?? {}, block.effects, response, ctx);
      const pointsEarned = block.grading === "weighted" ? roundPoints(block.points * (exact ? 1 : fraction)) : 0;
      return { ...gradeDecision(block, response, exact ? block.points : pointsEarned, deltas), correct: exact };
    }

    case "categorize":
    case "drag_drop": {
      const placements = (response ?? {}) as Record<string, string>;
      const total = block.items.length;
      const correctCount = block.items.filter((item) => placements[item.id] === item.correctCategoryId).length;
      const exact = total > 0 && correctCount === total;
      const fraction = total > 0 ? correctCount / total : 0;
      const { deltas } = applyEffects(ctx?.variables ?? {}, block.effects, response, ctx);
      const weightedPoints = roundPoints(block.points * fraction);
      return { ...gradeDecision(block, response, weightedPoints, deltas), correct: exact };
    }

    case "match": {
      const pairing = (response ?? {}) as Record<string, string>;
      const total = block.pairs.length;
      const correctCount = block.pairs.filter((p) => pairing[p.id] === p.right).length;
      const exact = total > 0 && correctCount === total;
      const fraction = total > 0 ? correctCount / total : 0;
      const { deltas } = applyEffects(ctx?.variables ?? {}, block.effects, response, ctx);
      const weightedPoints = roundPoints(block.points * fraction);
      return { ...gradeDecision(block, response, weightedPoints, deltas), correct: exact };
    }

    case "tradeoff_matrix": {
      const option = block.options.find((o) => o.id === response);
      const { deltas } = applyEffects(ctx?.variables ?? {}, [...block.effects, ...(option?.effects ?? [])], response, ctx);
      return gradeDecision(block, response, option?.points, deltas);
    }

    case "forecast": {
      const value = typeof response === "number" ? response : Number(response);
      const diff = Math.abs(value - block.correctValue);
      const withinTolerance = diff <= block.tolerance;
      const span = block.tolerance > 0 ? block.tolerance : Math.max(Math.abs(block.correctValue), 1);
      const fraction = Math.max(0, 1 - diff / (span * 2));
      const { deltas } = applyEffects(ctx?.variables ?? {}, block.effects, response, ctx);
      const weightedPoints = roundPoints(block.points * fraction);
      return { ...gradeDecision(block, response, weightedPoints, deltas), correct: withinTolerance };
    }

    case "table":
    case "chart":
    case "timeline":
      return noScore;

    default:
      return noScore;
  }
}

/** Shared decision-grading logic for strategy_choice / slider / price_set / budget_allocation. */
function gradeDecision(
  block: Extract<Block, { grading: "weighted" | "variable_effects" | "rubric_bands" }>,
  response: unknown,
  optionPoints: number | undefined,
  deltas: Record<string, number>,
): GradeOutcome {
  if (block.grading === "variable_effects") {
    return { pointsEarned: 0, pointsPossible: block.points, variableDeltas: deltas };
  }
  if (block.grading === "rubric_bands") {
    const ctx: EvalContext = { variables: deltas, responses: { [block.id]: response } };
    for (const band of block.bands) {
      if (evalCondition(band.when, ctx)) {
        return { pointsEarned: band.points, pointsPossible: block.points, variableDeltas: deltas, feedback: band.feedback };
      }
    }
    return { pointsEarned: 0, pointsPossible: block.points, variableDeltas: deltas };
  }
  // weighted
  const pointsEarned = optionPoints ?? block.points;
  return { pointsEarned, pointsPossible: block.points, variableDeltas: deltas };
}

/* ---------------- results ---------------- */

export interface CommittedResponse {
  blockId: string;
  response: unknown;
}

export interface LessonResults {
  score0to100: number;
  stars: number;
  variables: Variables;
  skillPoints: Record<string, number>;
  totalPoints: number;
  pointsPossible: number;
}

function findBlockById(doc: LessonDoc, blockId: string): Block | undefined {
  for (const phase of doc.phases) {
    const found = phase.blocks.find((b) => b.id === blockId);
    if (found) return found;
  }
  return undefined;
}

/**
 * Recompute score, stars, final variables, and skill points from a lesson
 * doc + the committed responses recorded along the path actually taken.
 * Server-authoritative: always called from persisted responses, never
 * trusts a client-submitted score.
 */
export function computeResults(
  doc: LessonDoc,
  committedResponses: CommittedResponse[],
  _path: string[] = [],
): LessonResults {
  const variables: Variables = {};
  for (const v of doc.variables) variables[v.key] = v.initial;

  const responseMap: Record<string, unknown> = {};
  for (const cr of committedResponses) responseMap[cr.blockId] = cr.response;

  let totalPoints = 0;
  let pointsPossible = 0;

  for (const cr of committedResponses) {
    const block = findBlockById(doc, cr.blockId);
    if (!block) continue;
    const ctx: EvalContext = { variables, responses: responseMap };
    const outcome = gradeBlock(block, cr.response, ctx);
    totalPoints += outcome.pointsEarned;
    pointsPossible += outcome.pointsPossible;
    for (const [key, delta] of Object.entries(outcome.variableDeltas)) {
      variables[key] = roundPoints((variables[key] ?? 0) * 10000 + delta * 10000) / 10000;
    }
  }

  totalPoints = roundPoints(totalPoints);
  pointsPossible = roundPoints(pointsPossible);
  const score0to100 = pointsPossible > 0 ? roundPoints((totalPoints / pointsPossible) * 100) : 0;

  const [t1, t2, t3] = doc.scoring.starThresholds;
  let stars = 0;
  if (score0to100 >= t1) stars = 1;
  if (score0to100 >= t2) stars = 2;
  if (score0to100 >= t3) stars = 3;

  const skillPoints: Record<string, number> = {};
  const scoreFraction = pointsPossible > 0 ? totalPoints / pointsPossible : 0;
  for (const skill of doc.skills) {
    skillPoints[skill.skillId] = roundPoints(skill.maxPoints * scoreFraction);
  }

  return { score0to100, stars, variables, skillPoints, totalPoints, pointsPossible };
}
