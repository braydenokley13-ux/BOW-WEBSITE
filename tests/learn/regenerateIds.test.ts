import { test } from "node:test";
import assert from "node:assert/strict";
import { regenerateLessonDocIds } from "../../lib/learn/regenerateIds";
import type { LessonDoc } from "../../lib/learn/types";

function docWithBranching(): LessonDoc {
  return {
    schemaVersion: 1,
    meta: { title: "Original" },
    variables: [{ key: "v1", label: "V1", initial: 0, unit: "number", visible: true }],
    skills: [],
    phases: [
      {
        id: "phase-a",
        kind: "Decision",
        title: "Decision",
        blocks: [
          {
            id: "block-choice",
            type: "strategy_choice",
            prompt: "Pick one",
            grading: "weighted",
            effects: [],
            bands: [],
            points: 1,
            options: [
              { id: "opt-a", label: "A", effects: [], goTo: "block-b" },
              { id: "opt-b", label: "B", effects: [] },
            ],
            branch: { "opt-a": "block-b" },
          },
          { id: "block-b", type: "text", body: "landing" },
        ],
      },
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

test("regenerateLessonDocIds: every phase/block id changes", () => {
  const doc = docWithBranching();
  const next = regenerateLessonDocIds(doc);
  assert.notEqual(next.phases[0].id, doc.phases[0].id);
  assert.notEqual(next.phases[0].blocks[0].id, doc.phases[0].blocks[0].id);
  assert.notEqual(next.phases[0].blocks[1].id, doc.phases[0].blocks[1].id);
});

test("regenerateLessonDocIds: branch targets (goTo + branch map) are remapped consistently", () => {
  const doc = docWithBranching();
  const next = regenerateLessonDocIds(doc);
  const choiceBlock = next.phases[0].blocks[0] as Extract<LessonDoc["phases"][number]["blocks"][number], { type: "strategy_choice" }>;
  const landingBlock = next.phases[0].blocks[1];

  assert.equal(choiceBlock.options[0].goTo, landingBlock.id);
  assert.equal(choiceBlock.branch?.["opt-a"], landingBlock.id);
  // Option ids themselves are untouched — only block/phase ids regenerate.
  assert.equal(choiceBlock.options[0].id, "opt-a");
});

test("regenerateLessonDocIds: is idempotent-safe — running twice never collides ids", () => {
  const doc = docWithBranching();
  const once = regenerateLessonDocIds(doc);
  const twice = regenerateLessonDocIds(once);
  assert.notEqual(once.phases[0].id, twice.phases[0].id);
});
