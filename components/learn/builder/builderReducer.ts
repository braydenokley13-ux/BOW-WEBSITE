/* ============================================================
 * components/learn/builder/builderReducer.ts — pure reducer over LessonDoc.
 *
 * Extracted from useBuilderStore.ts (no React, no "use client") so undo/redo
 * and every edit action are unit-testable from tests/learn/builder.test.ts,
 * mirroring components/learn/player/playerState.ts's split.
 * ============================================================ */

import type { Block, BlockType, LessonDoc, Phase, PhaseKind } from "@/lib/learn/types";
import { getBlockRegistryEntry } from "@/lib/learn/registry";

export interface Selection {
  phaseId: string;
  blockId: string | null;
}

export interface BuilderState {
  doc: LessonDoc;
  selection: Selection;
  past: LessonDoc[];
  future: LessonDoc[];
  dirty: boolean;
  /** The draft_revision this doc was loaded/saved at — the base for the next saveDraft call. */
  baseRevision: number;
}

const MAX_HISTORY = 50;

export function initBuilderState(doc: LessonDoc, baseRevision: number): BuilderState {
  return {
    doc,
    selection: { phaseId: doc.phases[0]?.id ?? "", blockId: null },
    past: [],
    future: [],
    dirty: false,
    baseRevision,
  };
}

/**
 * Browser + Node-safe id generator — this file is imported from client
 * builder components, so node:crypto's randomUUID is not available; the Web
 * Crypto API (globalThis.crypto.randomUUID) works in both browsers and
 * modern Node (18.17+/Next's edge+node runtimes), with a fallback for
 * environments (e.g. jsdom-less node:test) lacking it.
 */
export function newId(prefix: string): string {
  const uuid =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${uuid.replace(/-/g, "").slice(0, 8)}`;
}

export type BuilderAction =
  | { type: "ADD_PHASE"; kind: PhaseKind; title?: string }
  | { type: "REMOVE_PHASE"; phaseId: string }
  | { type: "RENAME_PHASE"; phaseId: string; title: string }
  | { type: "REORDER_PHASES"; orderedIds: string[] }
  | { type: "ADD_BLOCK"; phaseId: string; blockType: BlockType; atIndex?: number }
  | { type: "REMOVE_BLOCK"; phaseId: string; blockId: string }
  | { type: "DUPLICATE_BLOCK"; phaseId: string; blockId: string }
  | { type: "REORDER_BLOCKS"; phaseId: string; orderedIds: string[] }
  | { type: "MOVE_BLOCK_TO_PHASE"; fromPhaseId: string; toPhaseId: string; blockId: string; atIndex?: number }
  | { type: "UPDATE_BLOCK"; phaseId: string; blockId: string; patch: Record<string, unknown> }
  | { type: "SELECT"; phaseId: string; blockId: string | null }
  | { type: "SET_META"; patch: Partial<LessonDoc["meta"]> }
  | { type: "SET_VARIABLES"; variables: LessonDoc["variables"] }
  | { type: "SET_SKILLS"; skills: LessonDoc["skills"] }
  | { type: "SET_SCORING"; scoring: LessonDoc["scoring"] }
  | { type: "SET_RESULTS"; results: LessonDoc["results"] }
  | { type: "REPLACE_DOC"; doc: LessonDoc; baseRevision: number }
  | { type: "MARK_SAVED"; baseRevision: number }
  | { type: "UNDO" }
  | { type: "REDO" };

function withHistory(state: BuilderState, nextDoc: LessonDoc): BuilderState {
  const past = [...state.past, state.doc].slice(-MAX_HISTORY);
  return { ...state, doc: nextDoc, past, future: [], dirty: true };
}

function findPhase(doc: LessonDoc, phaseId: string): Phase | undefined {
  return doc.phases.find((p) => p.id === phaseId);
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case "ADD_PHASE": {
      const phase: Phase = {
        id: newId("phase"),
        kind: action.kind,
        title: action.title ?? action.kind,
        blocks: [{ id: newId("block"), type: "text", body: "" }],
      };
      const doc = { ...state.doc, phases: [...state.doc.phases, phase] };
      return { ...withHistory(state, doc), selection: { phaseId: phase.id, blockId: null } };
    }

    case "REMOVE_PHASE": {
      if (state.doc.phases.length <= 1) return state;
      const doc = { ...state.doc, phases: state.doc.phases.filter((p) => p.id !== action.phaseId) };
      const nextSelection =
        state.selection.phaseId === action.phaseId
          ? { phaseId: doc.phases[0]?.id ?? "", blockId: null }
          : state.selection;
      return { ...withHistory(state, doc), selection: nextSelection };
    }

    case "RENAME_PHASE": {
      const doc = {
        ...state.doc,
        phases: state.doc.phases.map((p) => (p.id === action.phaseId ? { ...p, title: action.title } : p)),
      };
      return withHistory(state, doc);
    }

    case "REORDER_PHASES": {
      const byId = new Map(state.doc.phases.map((p) => [p.id, p]));
      const phases = action.orderedIds.map((id) => byId.get(id)).filter((p): p is Phase => Boolean(p));
      if (phases.length !== state.doc.phases.length) return state;
      return withHistory(state, { ...state.doc, phases });
    }

    case "ADD_BLOCK": {
      const entry = getBlockRegistryEntry(action.blockType);
      const block = { ...entry.defaults, id: newId("block") } as unknown as Block;
      const doc = {
        ...state.doc,
        phases: state.doc.phases.map((p) => {
          if (p.id !== action.phaseId) return p;
          const blocks = p.blocks.slice();
          const index = action.atIndex ?? blocks.length;
          blocks.splice(index, 0, block);
          return { ...p, blocks };
        }),
      };
      return { ...withHistory(state, doc), selection: { phaseId: action.phaseId, blockId: block.id } };
    }

    case "REMOVE_BLOCK": {
      const doc = {
        ...state.doc,
        phases: state.doc.phases.map((p) =>
          p.id === action.phaseId ? { ...p, blocks: p.blocks.filter((b) => b.id !== action.blockId) } : p,
        ),
      };
      const nextSelection =
        state.selection.blockId === action.blockId ? { phaseId: action.phaseId, blockId: null } : state.selection;
      return { ...withHistory(state, doc), selection: nextSelection };
    }

    case "DUPLICATE_BLOCK": {
      const phase = findPhase(state.doc, action.phaseId);
      const original = phase?.blocks.find((b) => b.id === action.blockId);
      if (!phase || !original) return state;
      const copy = { ...original, id: newId("block") };
      const doc = {
        ...state.doc,
        phases: state.doc.phases.map((p) => {
          if (p.id !== action.phaseId) return p;
          const idx = p.blocks.findIndex((b) => b.id === action.blockId);
          const blocks = p.blocks.slice();
          blocks.splice(idx + 1, 0, copy);
          return { ...p, blocks };
        }),
      };
      return { ...withHistory(state, doc), selection: { phaseId: action.phaseId, blockId: copy.id } };
    }

    case "REORDER_BLOCKS": {
      const phase = findPhase(state.doc, action.phaseId);
      if (!phase) return state;
      const byId = new Map(phase.blocks.map((b) => [b.id, b]));
      const blocks = action.orderedIds.map((id) => byId.get(id)).filter((b): b is Block => Boolean(b));
      if (blocks.length !== phase.blocks.length) return state;
      const doc = { ...state.doc, phases: state.doc.phases.map((p) => (p.id === action.phaseId ? { ...p, blocks } : p)) };
      return withHistory(state, doc);
    }

    case "MOVE_BLOCK_TO_PHASE": {
      const fromPhase = findPhase(state.doc, action.fromPhaseId);
      const block = fromPhase?.blocks.find((b) => b.id === action.blockId);
      if (!fromPhase || !block) return state;
      const doc = {
        ...state.doc,
        phases: state.doc.phases.map((p) => {
          if (p.id === action.fromPhaseId) return { ...p, blocks: p.blocks.filter((b) => b.id !== action.blockId) };
          if (p.id === action.toPhaseId) {
            const blocks = p.blocks.slice();
            blocks.splice(action.atIndex ?? blocks.length, 0, block);
            return { ...p, blocks };
          }
          return p;
        }),
      };
      return { ...withHistory(state, doc), selection: { phaseId: action.toPhaseId, blockId: block.id } };
    }

    case "UPDATE_BLOCK": {
      const doc = {
        ...state.doc,
        phases: state.doc.phases.map((p) => {
          if (p.id !== action.phaseId) return p;
          return {
            ...p,
            blocks: p.blocks.map((b) => (b.id === action.blockId ? ({ ...b, ...action.patch } as Block) : b)),
          };
        }),
      };
      return withHistory(state, doc);
    }

    case "SELECT":
      return { ...state, selection: { phaseId: action.phaseId, blockId: action.blockId } };

    case "SET_META":
      return withHistory(state, { ...state.doc, meta: { ...state.doc.meta, ...action.patch } });

    case "SET_VARIABLES":
      return withHistory(state, { ...state.doc, variables: action.variables });

    case "SET_SKILLS":
      return withHistory(state, { ...state.doc, skills: action.skills });

    case "SET_SCORING":
      return withHistory(state, { ...state.doc, scoring: action.scoring });

    case "SET_RESULTS":
      return withHistory(state, { ...state.doc, results: action.results });

    case "REPLACE_DOC":
      return {
        doc: action.doc,
        selection: { phaseId: action.doc.phases[0]?.id ?? "", blockId: null },
        past: [],
        future: [],
        dirty: false,
        baseRevision: action.baseRevision,
      };

    case "MARK_SAVED":
      return { ...state, dirty: false, baseRevision: action.baseRevision };

    case "UNDO": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        doc: previous,
        past: state.past.slice(0, -1),
        future: [state.doc, ...state.future].slice(0, MAX_HISTORY),
        dirty: true,
      };
    }

    case "REDO": {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return { ...state, doc: next, past: [...state.past, state.doc].slice(-MAX_HISTORY), future: rest, dirty: true };
    }

    default:
      return state;
  }
}
