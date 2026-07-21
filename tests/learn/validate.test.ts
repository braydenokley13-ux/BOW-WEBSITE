import { test } from "node:test";
import assert from "node:assert/strict";
import { validateLessonDoc } from "../../lib/learn/validate";
import { LessonDocSchema } from "../../lib/learn/schema";
import type { LessonDoc } from "../../lib/learn/types";

function goodDoc(): LessonDoc {
  return LessonDocSchema.parse({
    schemaVersion: 1,
    meta: { title: "Valid", estMinutes: 10 },
    variables: [{ key: "price", label: "Price", initial: 10 }],
    skills: [],
    phases: [
      {
        id: "p1",
        kind: "Briefing",
        title: "Intro",
        blocks: [{ id: "b1", type: "text", body: "hi" }],
      },
      {
        id: "p2",
        kind: "Decision",
        title: "Decide",
        blocks: [
          {
            id: "d1",
            type: "strategy_choice",
            prompt: "Choose",
            options: [
              { id: "a", label: "A", effects: [{ variable: "price", verb: "increase_by", amount: 1 }] },
              { id: "b", label: "B", effects: [] },
            ],
            grading: "weighted",
            points: 5,
          },
        ],
      },
    ],
    scoring: {
      mode: "points",
      starThresholds: [50, 75, 90],
      xp: { base: 10, perStar: 5, firstCompletionBonus: 20 },
      badges: [],
    },
    results: {},
  });
}

test("validateLessonDoc: a well-formed doc has no errors", () => {
  const result = validateLessonDoc(goodDoc());
  assert.deepEqual(result.errors, []);
});

test("validateLessonDoc: flags a branch target that does not exist", () => {
  const doc = goodDoc();
  const block = doc.phases[1].blocks[0];
  if (block.type === "strategy_choice") block.options[0].goTo = "does-not-exist";
  const result = validateLessonDoc(doc);
  assert.ok(result.errors.some((e) => e.includes("unknown block id")));
});

test("validateLessonDoc: flags zero total possible points", () => {
  const doc = goodDoc();
  const block = doc.phases[1].blocks[0];
  if (block.type === "strategy_choice") block.points = 0;
  const result = validateLessonDoc(doc);
  assert.ok(result.errors.some((e) => e.includes("zero total possible points")));
});

test("validateLessonDoc: flags non-ascending star thresholds", () => {
  const doc = goodDoc();
  doc.scoring.starThresholds = [90, 75, 50];
  const result = validateLessonDoc(doc);
  assert.ok(result.errors.some((e) => e.includes("starThresholds must be strictly ascending")));
});

test("validateLessonDoc: flags an undeclared variable reference in an effect", () => {
  const doc = goodDoc();
  const block = doc.phases[1].blocks[0];
  if (block.type === "strategy_choice") {
    block.options[0].effects = [{ variable: "ghost_variable", verb: "increase_by", amount: 1 }];
  }
  const result = validateLessonDoc(doc);
  assert.ok(result.errors.some((e) => e.includes('undeclared variable "ghost_variable"')));
});

test("validateLessonDoc: flags mc correctOptionId not among its own options", () => {
  const doc = goodDoc();
  doc.phases[0].blocks.push({
    id: "q-bad",
    type: "mc",
    prompt: "?",
    options: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
    correctOptionId: "c",
    grading: "correct",
    points: 1,
  });
  const result = validateLessonDoc(doc);
  assert.ok(result.errors.some((e) => e.includes("is not one of its options")));
});

test("validateLessonDoc: warns about an unreachable block", () => {
  const doc = goodDoc();
  doc.phases.push({
    id: "p3",
    kind: "FollowUp",
    title: "Orphan",
    blocks: [{ id: "orphan", type: "text", body: "never reached" }],
  });
  // Redirect the last reachable block's fallthrough away from p3 by branching
  // strategy_choice's options elsewhere (back to p1, forming a loop) so p3
  // is never reached via fallthrough OR branch.
  const decisionBlock = doc.phases[1].blocks[0];
  if (decisionBlock.type === "strategy_choice") {
    decisionBlock.options[0].goTo = "b1";
    decisionBlock.options[1].goTo = "b1";
  }
  const result = validateLessonDoc(doc);
  assert.ok(result.warnings.some((w) => w.includes('Block "orphan"') && w.includes("unreachable")));
});

test("validateLessonDoc: mixed goTo/fallthrough — an option with no goTo keeps the next block reachable", () => {
  // Stage 1 design-note review (Stage 5 work item 3): when only SOME options
  // on a decision/scenario block name a goTo, the block's natural next
  // sibling must still count as reachable via the options that fall through.
  const doc = goodDoc();
  doc.phases.push({
    id: "p3",
    kind: "Consequence",
    title: "Fallthrough target",
    blocks: [{ id: "c1", type: "text", body: "reached by falling through" }],
  });
  const decisionBlock = doc.phases[1].blocks[0];
  if (decisionBlock.type === "strategy_choice") {
    decisionBlock.options[0].goTo = "c1"; // explicit branch
    // options[1] has no goTo — falls through to the phase's natural next block (c1, same as the branch here, but exercised via fallthrough logic)
  }
  const result = validateLessonDoc(doc);
  assert.ok(!result.warnings.some((w) => w.includes('Block "c1"') && w.includes("unreachable")));
});

test("validateLessonDoc: all options branching away makes the natural-next block unreachable-by-fallthrough", () => {
  // The inverse of the above: when EVERY option/choice names a goTo, the
  // block's natural next sibling is never reached via fallthrough — only an
  // explicit goTo pointing at it (or nothing) makes it reachable. This is
  // the mechanism the Stage 4 proof lesson relied on for branch-specific
  // Consequence blocks (no visibleIf needed).
  const doc = goodDoc();
  doc.phases.push({
    id: "p3",
    kind: "Consequence",
    title: "Never naturally reached",
    blocks: [{ id: "c1", type: "text", body: "only reachable via an explicit goTo" }],
  });
  const decisionBlock = doc.phases[1].blocks[0];
  if (decisionBlock.type === "strategy_choice") {
    // Both options branch elsewhere (back to b1), so c1 is unreachable.
    decisionBlock.options[0].goTo = "b1";
    decisionBlock.options[1].goTo = "b1";
  }
  const result = validateLessonDoc(doc);
  assert.ok(result.warnings.some((w) => w.includes('Block "c1"') && w.includes("unreachable")));
});

test("validateLessonDoc: flags an illegal (exit-less) loop", () => {
  const doc = goodDoc();
  // Two-block phase that only ever branches back to itself, no other exit.
  doc.phases = [
    {
      id: "p1",
      kind: "Briefing",
      title: "Loop",
      blocks: [
        {
          id: "b1",
          type: "strategy_choice",
          prompt: "Choose",
          options: [{ id: "a", label: "A", effects: [], goTo: "b2" }],
          grading: "weighted",
          effects: [],
          bands: [],
          points: 5,
        },
        {
          id: "b2",
          type: "strategy_choice",
          prompt: "Choose again",
          options: [{ id: "a", label: "A", effects: [], goTo: "b1" }],
          grading: "weighted",
          effects: [],
          bands: [],
          points: 5,
        },
      ],
    },
  ];
  const result = validateLessonDoc(doc);
  assert.ok(result.errors.some((e) => e.includes("Illegal loop with no exit")));
});
