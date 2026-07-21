/* ============================================================
 * lib/learn/validate.ts — publish-time LessonDoc validation (plan §2).
 *
 * Structural correctness only — zod (schema.ts) already guarantees shape.
 * This module checks cross-references within an already-parsed LessonDoc:
 * duplicate ids, dangling branch targets, illegal (exit-less) loops,
 * unreachable content, undeclared variable/response refs, scoring sanity,
 * and answer-key completeness. Isomorphic — safe to run in the builder
 * (client) for live validation and on the server before publish.
 * ============================================================ */

import type { Block, LessonDoc } from "./types";

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

/** All possible explicit branch targets a block can name, plus fallthrough info. */
function branchTargets(block: Block): string[] {
  switch (block.type) {
    case "strategy_choice":
      return [
        ...block.options.map((o) => o.goTo).filter((x): x is string => Boolean(x)),
        ...Object.values(block.branch ?? {}),
      ];
    case "scenario":
      return block.choices.map((c) => c.goTo).filter((x): x is string => Boolean(x));
    case "slider":
    case "price_set":
    case "budget_allocation":
      return Object.values(block.branch ?? {});
    default:
      return [];
  }
}

interface FlatBlock {
  block: Block;
  phaseId: string;
  phaseIndex: number;
  blockIndex: number;
}

function flattenBlocks(doc: LessonDoc): FlatBlock[] {
  const flat: FlatBlock[] = [];
  doc.phases.forEach((phase, phaseIndex) => {
    phase.blocks.forEach((block, blockIndex) => {
      flat.push({ block, phaseId: phase.id, phaseIndex, blockIndex });
    });
  });
  return flat;
}

/** Build the fallthrough+branch adjacency graph used for reachability/cycle checks. */
function buildGraph(doc: LessonDoc, flat: FlatBlock[]): Map<string, Set<string>> {
  const byId = new Map(flat.map((f) => [f.block.id, f]));
  const graph = new Map<string, Set<string>>();
  const addEdge = (from: string, to: string) => {
    if (!graph.has(from)) graph.set(from, new Set());
    graph.get(from)!.add(to);
  };

  for (let i = 0; i < flat.length; i += 1) {
    const { block } = flat[i];
    const next = flat[i + 1];
    if (next && hasFallthroughPath(block)) addEdge(block.id, next.block.id);
    for (const target of branchTargets(block)) {
      if (byId.has(target)) addEdge(block.id, target);
    }
  }
  return graph;
}

/**
 * Whether at least one possible response to `block` falls through to the
 * next block in phase order rather than always taking an explicit branch.
 * If every option/choice on a decision/scenario block names a `goTo`, the
 * natural-next block is never reached via that block and should not be
 * treated as automatically reachable.
 */
function hasFallthroughPath(block: Block): boolean {
  switch (block.type) {
    case "strategy_choice":
      return block.options.some((o) => !o.goTo);
    case "scenario":
      return block.choices.some((c) => !c.goTo);
    default:
      return true;
  }
}

/** Tarjan-lite: find cycles via DFS, flag ones with no edge leaving the cycle. */
function findIllegalLoops(graph: Map<string, Set<string>>): string[][] {
  const illegal: string[][] = [];
  const visited = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();

  function dfs(node: string) {
    visited.add(node);
    stack.push(node);
    onStack.add(node);
    for (const next of graph.get(node) ?? []) {
      if (!visited.has(next)) {
        dfs(next);
      } else if (onStack.has(next)) {
        const cycleStart = stack.indexOf(next);
        const cycle = stack.slice(cycleStart);
        const hasExit = cycle.some((id) => [...(graph.get(id) ?? [])].some((t) => !cycle.includes(t)));
        if (!hasExit) illegal.push(cycle);
      }
    }
    stack.pop();
    onStack.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) dfs(node);
  }
  return illegal;
}

function pointsPossibleFor(block: Block): number {
  switch (block.type) {
    case "mc":
    case "multi_select":
    case "true_false":
    case "numeric":
    case "short_response":
      return block.points;
    case "strategy_choice":
    case "slider":
    case "price_set":
    case "budget_allocation":
      return block.points;
    case "scenario":
      return Math.max(...block.choices.map((c) => c.points ?? 0), 0);
    default:
      return 0;
  }
}

export function validateLessonDoc(doc: LessonDoc): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const flat = flattenBlocks(doc);

  // ---- duplicate ids ----
  const phaseIds = new Set<string>();
  for (const phase of doc.phases) {
    if (phaseIds.has(phase.id)) errors.push(`Duplicate phase id: ${phase.id}`);
    phaseIds.add(phase.id);
  }
  const blockIds = new Set<string>();
  for (const { block } of flat) {
    if (blockIds.has(block.id)) errors.push(`Duplicate block id: ${block.id}`);
    blockIds.add(block.id);
  }

  // ---- branch targets exist ----
  for (const { block } of flat) {
    for (const target of branchTargets(block)) {
      if (!blockIds.has(target)) {
        errors.push(`Block "${block.id}" branches to unknown block id "${target}"`);
      }
    }
  }

  // ---- answer keys present / consistent ----
  for (const { block } of flat) {
    if (block.type === "mc") {
      const ids = new Set(block.options.map((o) => o.id));
      if (!ids.has(block.correctOptionId)) {
        errors.push(`mc block "${block.id}" correctOptionId "${block.correctOptionId}" is not one of its options`);
      }
    }
    if (block.type === "multi_select") {
      const ids = new Set(block.options.map((o) => o.id));
      for (const id of block.correctOptionIds) {
        if (!ids.has(id)) errors.push(`multi_select block "${block.id}" correctOptionIds includes unknown option "${id}"`);
      }
    }
  }

  // ---- variable / response refs declared ----
  const variableKeys = new Set(doc.variables.map((v) => v.key));
  function checkEffects(effects: { variable: string }[], where: string) {
    for (const e of effects) {
      if (!variableKeys.has(e.variable)) errors.push(`${where} references undeclared variable "${e.variable}"`);
    }
  }
  for (const { block } of flat) {
    if (block.type === "strategy_choice") {
      checkEffects(block.effects, `strategy_choice "${block.id}"`);
      for (const opt of block.options) checkEffects(opt.effects, `strategy_choice "${block.id}" option "${opt.id}"`);
    }
    if (block.type === "slider" || block.type === "price_set" || block.type === "budget_allocation") {
      checkEffects(block.effects, `${block.type} "${block.id}"`);
    }
    if (block.type === "scenario") {
      for (const choice of block.choices) checkEffects(choice.effects, `scenario "${block.id}" choice "${choice.id}"`);
    }
    if ((block.type === "stat" || block.type === "comparison") && "value" in block) {
      // stat/comparison items may bind a variable ref; spot-checked structurally by zod already.
    }
  }

  // ---- total points > 0 ----
  const totalPoints = flat.reduce((sum, { block }) => sum + pointsPossibleFor(block), 0);
  if (totalPoints <= 0) errors.push("Lesson has zero total possible points across all blocks");

  // ---- ascending star thresholds ----
  const [t1, t2, t3] = doc.scoring.starThresholds;
  if (!(t1 < t2 && t2 < t3)) {
    errors.push(`starThresholds must be strictly ascending, got [${t1}, ${t2}, ${t3}]`);
  }

  // ---- reachability + cycles ----
  if (flat.length > 0) {
    const graph = buildGraph(doc, flat);
    const first = flat[0].block.id;
    const reachable = new Set<string>();
    const queue = [first];
    while (queue.length) {
      const node = queue.shift()!;
      if (reachable.has(node)) continue;
      reachable.add(node);
      for (const next of graph.get(node) ?? []) queue.push(next);
    }
    for (const { block, phaseId } of flat) {
      if (!reachable.has(block.id)) {
        warnings.push(`Block "${block.id}" (phase "${phaseId}") is unreachable from the lesson start`);
      }
    }

    const illegalLoops = findIllegalLoops(graph);
    for (const cycle of illegalLoops) {
      errors.push(`Illegal loop with no exit: ${cycle.join(" -> ")}`);
    }

    // dead ends: a non-final block with no outgoing edges at all.
    const lastBlockId = flat[flat.length - 1].block.id;
    for (const { block } of flat) {
      if (block.id === lastBlockId) continue;
      if (!graph.has(block.id) || graph.get(block.id)!.size === 0) {
        warnings.push(`Block "${block.id}" is a dead end (no fallthrough or branch target)`);
      }
    }
  }

  // ---- media completion sanity ----
  for (const { block } of flat) {
    if (block.type === "media" && block.completion.mode === "percent") {
      if (block.completion.threshold <= 0 || block.completion.threshold > 1) {
        errors.push(`media block "${block.id}" percent threshold must be in (0, 1]`);
      }
    }
  }

  // ---- estMinutes sanity ----
  if (doc.meta.estMinutes === undefined) {
    warnings.push("meta.estMinutes is not set");
  } else if (doc.meta.estMinutes < 3 || doc.meta.estMinutes > 30) {
    warnings.push(`meta.estMinutes (${doc.meta.estMinutes}) is outside the typical 3-30 minute range`);
  }

  return { errors, warnings };
}
