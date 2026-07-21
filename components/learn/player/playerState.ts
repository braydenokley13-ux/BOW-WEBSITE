/* ============================================================
 * components/learn/player/playerState.ts — pure LessonPlayer state machine.
 *
 * Extracted from LessonPlayer.tsx so the cursor/variables/responses/path
 * transitions are unit-testable without React (tests/learn/player.test.ts).
 * No "use client", no React import — safe to import from node:test.
 *
 * Commit semantics (plan §2/§3): a response is editable via SET_RESPONSE
 * until COMMIT fires (the interaction's consequence/state advancement). Once
 * committed, that block id is locked in `state.responses` for this attempt
 * path — a later branch revisit re-enters via a fresh block id, never by
 * mutating a committed entry.
 * ============================================================ */

import type { Block, LessonDoc } from "@/lib/learn/types";
import {
  evalCondition,
  gradeBlock,
  resolveBranch,
  type EvalContext,
  type GradeOutcome,
  type Variables,
} from "@/lib/learn/engine";

export interface FlatBlock {
  block: Block;
  phaseId: string;
  phaseIndex: number;
  blockIndex: number;
}

/** Flatten a LessonDoc's phases/blocks into visit order (mirrors lib/learn/validate.ts). */
export function flattenBlocks(doc: LessonDoc): FlatBlock[] {
  const flat: FlatBlock[] = [];
  doc.phases.forEach((phase, phaseIndex) => {
    phase.blocks.forEach((block, blockIndex) => {
      flat.push({ block, phaseId: phase.id, phaseIndex, blockIndex });
    });
  });
  return flat;
}

export interface ResponseEntry {
  value: unknown;
  committed: boolean;
  outcome?: GradeOutcome;
}

export interface PlayerState {
  cursorBlockId: string;
  variables: Variables;
  responses: Record<string, ResponseEntry>;
  path: string[];
  finished: boolean;
  transitionCount: number;
  error: string | null;
}

const MAX_TRANSITIONS = 500;

/** Build the initial state for a fresh (or resumed) attempt. */
export function initPlayerState(
  doc: LessonDoc,
  resume?: { responses?: Record<string, ResponseEntry>; variables?: Variables; path?: string[] },
): PlayerState {
  const flat = flattenBlocks(doc);
  const variables: Variables = { ...resume?.variables };
  if (!resume?.variables) {
    for (const v of doc.variables) variables[v.key] = v.initial;
  }
  const path = resume?.path ?? [];
  const cursorBlockId =
    (path.length > 0 ? nextAfter(flat, path[path.length - 1]) : undefined) ?? flat[0]?.block.id ?? "";
  return {
    cursorBlockId,
    variables,
    responses: resume?.responses ?? {},
    path,
    finished: flat.length === 0,
    transitionCount: 0,
    error: flat.length === 0 ? "Lesson has no blocks" : null,
  };
}

function findFlat(flat: FlatBlock[], blockId: string): FlatBlock | undefined {
  return flat.find((f) => f.block.id === blockId);
}

/** The block that would follow `blockId` by fallthrough phase order, if any. */
function nextAfter(flat: FlatBlock[], blockId: string): string | undefined {
  const idx = flat.findIndex((f) => f.block.id === blockId);
  if (idx === -1 || idx === flat.length - 1) return undefined;
  return flat[idx + 1].block.id;
}

function responseMap(responses: Record<string, ResponseEntry>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [blockId, entry] of Object.entries(responses)) {
    if (entry.committed) out[blockId] = entry.value;
  }
  return out;
}

/** Whether a block should render given visibleIf + current variables/responses. */
export function isBlockVisible(block: Block, variables: Variables, responses: Record<string, ResponseEntry>): boolean {
  if (!block.visibleIf) return true;
  const ctx: EvalContext = { variables, responses: responseMap(responses) };
  return evalCondition(block.visibleIf, ctx);
}

export type PlayerAction =
  | { type: "SET_RESPONSE"; doc: LessonDoc; blockId: string; value: unknown }
  | { type: "COMMIT"; doc: LessonDoc; blockId: string }
  | { type: "ADVANCE"; doc: LessonDoc; blockId: string };

/**
 * Advance the cursor from `fromBlockId` given an optional branch target,
 * skipping any blocks whose visibleIf is currently false, and respecting the
 * transition-limit loop guard. Returns the new cursor (or undefined if the
 * lesson is finished) and the updated transition count.
 */
function advanceCursor(
  doc: LessonDoc,
  flat: FlatBlock[],
  fromBlockId: string,
  branchTarget: string | undefined,
  variables: Variables,
  responses: Record<string, ResponseEntry>,
  transitionCount: number,
): { cursorBlockId: string | undefined; transitionCount: number; error: string | null } {
  let count = transitionCount;
  let candidate = branchTarget ?? nextAfter(flat, fromBlockId);
  while (candidate) {
    count += 1;
    if (count > MAX_TRANSITIONS) {
      return { cursorBlockId: undefined, transitionCount: count, error: "Transition limit exceeded — possible branch cycle" };
    }
    const flatEntry = findFlat(flat, candidate);
    if (!flatEntry) {
      return { cursorBlockId: undefined, transitionCount: count, error: `Branch target "${candidate}" not found` };
    }
    if (isBlockVisible(flatEntry.block, variables, responses)) {
      return { cursorBlockId: candidate, transitionCount: count, error: null };
    }
    candidate = nextAfter(flat, candidate);
  }
  return { cursorBlockId: undefined, transitionCount: count, error: null };
}

/**
 * Pure reducer for the LessonPlayer's cursor/variables/responses/path.
 * COMMIT grades the block client-side (optimistic — the server re-grades
 * authoritatively in submitResponse), applies variable effects, resolves any
 * branch, and advances. ADVANCE is COMMIT's counterpart for content blocks
 * that never collect a response (text/heading/callout/comparison/image/stat).
 */
export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  if (state.error) return state;
  const flat = flattenBlocks(action.doc);

  switch (action.type) {
    case "SET_RESPONSE": {
      const existing = state.responses[action.blockId];
      if (existing?.committed) return state; // locked — no consequence-peeking undo
      return {
        ...state,
        responses: {
          ...state.responses,
          [action.blockId]: { value: action.value, committed: false },
        },
      };
    }

    case "COMMIT": {
      const flatEntry = findFlat(flat, action.blockId);
      if (!flatEntry) return { ...state, error: `Unknown block id "${action.blockId}"` };
      const existing = state.responses[action.blockId];
      if (existing?.committed) return state; // already locked
      const response = existing?.value;
      const ctx: EvalContext = { variables: state.variables, responses: responseMap(state.responses) };
      const outcome = gradeBlock(flatEntry.block, response, ctx);
      const merged: Variables = { ...state.variables };
      for (const [key, delta] of Object.entries(outcome.variableDeltas)) {
        merged[key] = (merged[key] ?? 0) + delta;
      }
      const branchTarget = resolveBranch(flatEntry.block, response);
      const { cursorBlockId, transitionCount, error } = advanceCursor(
        action.doc,
        flat,
        action.blockId,
        branchTarget,
        merged,
        { ...state.responses, [action.blockId]: { value: response, committed: true, outcome } },
        state.transitionCount,
      );
      return {
        ...state,
        variables: merged,
        responses: { ...state.responses, [action.blockId]: { value: response, committed: true, outcome } },
        path: [...state.path, action.blockId],
        cursorBlockId: cursorBlockId ?? state.cursorBlockId,
        finished: cursorBlockId === undefined,
        transitionCount,
        error,
      };
    }

    case "ADVANCE": {
      const flatEntry = findFlat(flat, action.blockId);
      if (!flatEntry) return { ...state, error: `Unknown block id "${action.blockId}"` };
      const { cursorBlockId, transitionCount, error } = advanceCursor(
        action.doc,
        flat,
        action.blockId,
        undefined,
        state.variables,
        state.responses,
        state.transitionCount,
      );
      return {
        ...state,
        path: [...state.path, action.blockId],
        cursorBlockId: cursorBlockId ?? state.cursorBlockId,
        finished: cursorBlockId === undefined,
        transitionCount,
        error,
      };
    }

    default:
      return state;
  }
}

/** Progress fraction (0-1) through the flattened block list, for the progress bar. */
export function progressFraction(doc: LessonDoc, state: PlayerState): number {
  const flat = flattenBlocks(doc);
  if (flat.length === 0) return 1;
  const idx = flat.findIndex((f) => f.block.id === state.cursorBlockId);
  const effectiveIdx = state.finished ? flat.length : idx === -1 ? state.path.length : idx;
  return Math.min(1, Math.max(0, effectiveIdx / flat.length));
}
