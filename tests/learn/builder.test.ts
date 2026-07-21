import { test } from "node:test";
import assert from "node:assert/strict";
import { builderReducer, initBuilderState } from "../../components/learn/builder/builderReducer";
import type { LessonDoc } from "../../lib/learn/types";

function minimalDoc(): LessonDoc {
  return {
    schemaVersion: 1,
    meta: { title: "Test Lesson" },
    variables: [],
    skills: [],
    phases: [
      { id: "phase-1", kind: "Briefing", title: "Briefing", blocks: [{ id: "block-1", type: "text", body: "hi" }] },
    ],
    scoring: {
      mode: "points",
      starThresholds: [50, 75, 90],
      xp: { base: 10, perStar: 5, firstCompletionBonus: 10 },
      replayPolicy: { improvedXpPct: 0.25, noImprovementXpFloor: 0 },
      badges: [],
    },
    results: { showVariables: true, showSkillDeltas: true },
  };
}

test("builderReducer: ADD_PHASE appends a phase and selects it", () => {
  const state = initBuilderState(minimalDoc(), 1);
  const next = builderReducer(state, { type: "ADD_PHASE", kind: "Decision" });
  assert.equal(next.doc.phases.length, 2);
  assert.equal(next.selection.phaseId, next.doc.phases[1].id);
  assert.equal(next.dirty, true);
});

test("builderReducer: REMOVE_PHASE refuses to remove the last phase", () => {
  const state = initBuilderState(minimalDoc(), 1);
  const next = builderReducer(state, { type: "REMOVE_PHASE", phaseId: "phase-1" });
  assert.equal(next.doc.phases.length, 1);
});

test("builderReducer: ADD_BLOCK uses registry defaults and selects the new block", () => {
  const state = initBuilderState(minimalDoc(), 1);
  const next = builderReducer(state, { type: "ADD_BLOCK", phaseId: "phase-1", blockType: "mc" });
  const blocks = next.doc.phases[0].blocks;
  assert.equal(blocks.length, 2);
  assert.equal(blocks[1].type, "mc");
  assert.equal(next.selection.blockId, blocks[1].id);
});

test("builderReducer: REORDER_BLOCKS applies the new order", () => {
  let state = initBuilderState(minimalDoc(), 1);
  state = builderReducer(state, { type: "ADD_BLOCK", phaseId: "phase-1", blockType: "heading" });
  const ids = state.doc.phases[0].blocks.map((b) => b.id);
  const reversed = [...ids].reverse();
  const next = builderReducer(state, { type: "REORDER_BLOCKS", phaseId: "phase-1", orderedIds: reversed });
  assert.deepEqual(
    next.doc.phases[0].blocks.map((b) => b.id),
    reversed,
  );
});

test("builderReducer: DUPLICATE_BLOCK inserts a copy with a new id right after the original", () => {
  const state = initBuilderState(minimalDoc(), 1);
  const next = builderReducer(state, { type: "DUPLICATE_BLOCK", phaseId: "phase-1", blockId: "block-1" });
  const blocks = next.doc.phases[0].blocks;
  assert.equal(blocks.length, 2);
  assert.notEqual(blocks[1].id, "block-1");
  assert.equal(blocks[1].type, "text");
});

test("builderReducer: UPDATE_BLOCK patches only the targeted block", () => {
  const state = initBuilderState(minimalDoc(), 1);
  const next = builderReducer(state, { type: "UPDATE_BLOCK", phaseId: "phase-1", blockId: "block-1", patch: { body: "updated" } });
  assert.equal((next.doc.phases[0].blocks[0] as { body: string }).body, "updated");
});

test("builderReducer: UNDO/REDO round-trip restores prior and next doc states", () => {
  const state = initBuilderState(minimalDoc(), 1);
  const afterAdd = builderReducer(state, { type: "ADD_PHASE", kind: "Decision" });
  assert.equal(afterAdd.doc.phases.length, 2);

  const afterUndo = builderReducer(afterAdd, { type: "UNDO" });
  assert.equal(afterUndo.doc.phases.length, 1);
  assert.equal(afterUndo.past.length, 0);

  const afterRedo = builderReducer(afterUndo, { type: "REDO" });
  assert.equal(afterRedo.doc.phases.length, 2);
});

test("builderReducer: UNDO past the beginning is a no-op", () => {
  const state = initBuilderState(minimalDoc(), 1);
  const next = builderReducer(state, { type: "UNDO" });
  assert.equal(next, state);
});

test("builderReducer: MARK_SAVED clears dirty and updates baseRevision", () => {
  const state = initBuilderState(minimalDoc(), 1);
  const dirty = builderReducer(state, { type: "SET_META", patch: { title: "Renamed" } });
  assert.equal(dirty.dirty, true);
  const saved = builderReducer(dirty, { type: "MARK_SAVED", baseRevision: 2 });
  assert.equal(saved.dirty, false);
  assert.equal(saved.baseRevision, 2);
});

test("builderReducer: REPLACE_DOC resets history and selection (conflict 'load newest')", () => {
  let state = initBuilderState(minimalDoc(), 1);
  state = builderReducer(state, { type: "ADD_PHASE", kind: "Decision" });
  const serverDoc = minimalDoc();
  const replaced = builderReducer(state, { type: "REPLACE_DOC", doc: serverDoc, baseRevision: 5 });
  assert.equal(replaced.doc, serverDoc);
  assert.equal(replaced.baseRevision, 5);
  assert.equal(replaced.past.length, 0);
  assert.equal(replaced.dirty, false);
});
