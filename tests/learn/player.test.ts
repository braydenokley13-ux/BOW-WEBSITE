import { test } from "node:test";
import assert from "node:assert/strict";
import {
  flattenBlocks,
  initPlayerState,
  isBlockVisible,
  playerReducer,
  progressFraction,
} from "../../components/learn/player/playerState";
import type { LessonDoc } from "../../lib/learn/types";

/*
 * Player state tests skip the DB and React entirely — only the pure
 * reducer/helpers extracted to components/learn/player/playerState.ts,
 * per the plan's "extract for testability" instruction (Stage 2 deliverable 7).
 * The doc below mirrors the shape (not content) of scripts/seed-learn-demo.ts:
 * a content block, an MC question, a branching scenario, and a
 * visibleIf-gated consequence pair.
 */
function makeDoc(): LessonDoc {
  return {
    schemaVersion: 1,
    meta: { title: "Test Lesson" },
    variables: [{ key: "sentiment", label: "Sentiment", initial: 50, unit: "number" }],
    skills: [],
    phases: [
      {
        id: "p1",
        kind: "Briefing",
        title: "Intro",
        blocks: [{ id: "b1", type: "text", body: "Hello" }],
      },
      {
        id: "p2",
        kind: "Learn",
        title: "Quiz",
        blocks: [
          {
            id: "b2",
            type: "mc",
            prompt: "2+2?",
            options: [
              { id: "a", label: "3" },
              { id: "b", label: "4" },
            ],
            correctOptionId: "b",
            grading: "correct",
            points: 10,
          },
        ],
      },
      {
        id: "p3",
        kind: "Decision",
        title: "Choose",
        blocks: [
          {
            id: "b3",
            type: "scenario",
            narrative: "Pick one",
            choices: [
              {
                id: "x",
                label: "X",
                points: 5,
                effects: [{ variable: "sentiment", verb: "increase_by", amount: 10 }],
                goTo: "conseq-x",
              },
              {
                id: "y",
                label: "Y",
                points: 5,
                effects: [{ variable: "sentiment", verb: "decrease_by", amount: 10 }],
                goTo: "conseq-y",
              },
            ],
          },
        ],
      },
      {
        id: "p4",
        kind: "Consequence",
        title: "Result",
        blocks: [
          { id: "conseq-x", type: "callout", tone: "positive", body: "X happened", visibleIf: { op: "answered", blockId: "b3", optionId: "x" } },
          { id: "conseq-y", type: "callout", tone: "warning", body: "Y happened", visibleIf: { op: "answered", blockId: "b3", optionId: "y" } },
        ],
      },
    ],
    scoring: {
      mode: "points",
      starThresholds: [50, 70, 90],
      xp: { base: 100, perStar: 10, firstCompletionBonus: 20 },
      replayPolicy: { improvedXpPct: 0.25, noImprovementXpFloor: 0 },
      badges: [],
    },
    results: { showVariables: true, showSkillDeltas: true },
  };
}

test("initPlayerState: cursor starts at the first block, variables from initial values", () => {
  const doc = makeDoc();
  const state = initPlayerState(doc);
  assert.equal(state.cursorBlockId, "b1");
  assert.equal(state.variables.sentiment, 50);
  assert.equal(state.finished, false);
  assert.equal(state.error, null);
});

test("ADVANCE moves the cursor forward through content blocks by fallthrough", () => {
  const doc = makeDoc();
  let state = initPlayerState(doc);
  state = playerReducer(state, { type: "ADVANCE", doc, blockId: "b1" });
  assert.equal(state.cursorBlockId, "b2");
  assert.deepEqual(state.path, ["b1"]);
});

test("SET_RESPONSE then COMMIT locks the response and applies effects", () => {
  const doc = makeDoc();
  let state = initPlayerState(doc);
  state = playerReducer(state, { type: "ADVANCE", doc, blockId: "b1" }); // -> b2
  state = playerReducer(state, { type: "SET_RESPONSE", doc, blockId: "b2", value: "b" });
  state = playerReducer(state, { type: "COMMIT", doc, blockId: "b2" });
  assert.equal(state.responses.b2.committed, true);
  assert.equal(state.responses.b2.outcome?.correct, true);
  assert.equal(state.cursorBlockId, "b3");
});

test("COMMIT is a no-op once a response is already committed (no consequence-peeking undo)", () => {
  const doc = makeDoc();
  let state = initPlayerState(doc);
  state = playerReducer(state, { type: "ADVANCE", doc, blockId: "b1" });
  state = playerReducer(state, { type: "SET_RESPONSE", doc, blockId: "b2", value: "b" });
  state = playerReducer(state, { type: "COMMIT", doc, blockId: "b2" });
  const afterFirstCommit = state;
  // Attempting to change the value post-commit is rejected by SET_RESPONSE...
  state = playerReducer(state, { type: "SET_RESPONSE", doc, blockId: "b2", value: "a" });
  assert.equal(state.responses.b2.value, "b");
  // ...and re-COMMIT is a pure no-op.
  state = playerReducer(state, { type: "COMMIT", doc, blockId: "b2" });
  assert.deepEqual(state, afterFirstCommit);
});

test("scenario branch: choosing X jumps straight to conseq-x, skipping conseq-y", () => {
  const doc = makeDoc();
  let state = initPlayerState(doc);
  state = playerReducer(state, { type: "ADVANCE", doc, blockId: "b1" });
  state = playerReducer(state, { type: "SET_RESPONSE", doc, blockId: "b2", value: "b" });
  state = playerReducer(state, { type: "COMMIT", doc, blockId: "b2" }); // -> b3
  state = playerReducer(state, { type: "SET_RESPONSE", doc, blockId: "b3", value: "x" });
  state = playerReducer(state, { type: "COMMIT", doc, blockId: "b3" });
  assert.equal(state.cursorBlockId, "conseq-x");
  assert.equal(state.variables.sentiment, 60);
});

test("visibleIf: the unchosen consequence block is not visible", () => {
  const doc = makeDoc();
  let state = initPlayerState(doc);
  state = playerReducer(state, { type: "ADVANCE", doc, blockId: "b1" });
  state = playerReducer(state, { type: "SET_RESPONSE", doc, blockId: "b2", value: "b" });
  state = playerReducer(state, { type: "COMMIT", doc, blockId: "b2" });
  state = playerReducer(state, { type: "SET_RESPONSE", doc, blockId: "b3", value: "y" });
  state = playerReducer(state, { type: "COMMIT", doc, blockId: "b3" });
  assert.equal(state.cursorBlockId, "conseq-y");
  const conseqX = doc.phases[3].blocks[0];
  const conseqY = doc.phases[3].blocks[1];
  assert.equal(isBlockVisible(conseqX, state.variables, state.responses), false);
  assert.equal(isBlockVisible(conseqY, state.variables, state.responses), true);
});

test("finishing the lesson: ADVANCE past the last block sets finished=true", () => {
  const doc = makeDoc();
  let state = initPlayerState(doc);
  state = playerReducer(state, { type: "ADVANCE", doc, blockId: "b1" });
  state = playerReducer(state, { type: "SET_RESPONSE", doc, blockId: "b2", value: "b" });
  state = playerReducer(state, { type: "COMMIT", doc, blockId: "b2" });
  state = playerReducer(state, { type: "SET_RESPONSE", doc, blockId: "b3", value: "x" });
  state = playerReducer(state, { type: "COMMIT", doc, blockId: "b3" }); // -> conseq-x
  state = playerReducer(state, { type: "ADVANCE", doc, blockId: "conseq-x" }); // conseq-y hidden, skip -> finished
  assert.equal(state.finished, true);
  assert.equal(progressFraction(doc, state), 1);
});

test("flattenBlocks preserves phase/block order", () => {
  const doc = makeDoc();
  const flat = flattenBlocks(doc);
  assert.deepEqual(flat.map((f) => f.block.id), ["b1", "b2", "b3", "conseq-x", "conseq-y"]);
});
