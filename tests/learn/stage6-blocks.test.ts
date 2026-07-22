import { test } from "node:test";
import assert from "node:assert/strict";
import { gradeBlock, resolveBranch } from "../../lib/learn/engine";
import { validateLessonDoc } from "../../lib/learn/validate";
import { LessonDocSchema } from "../../lib/learn/schema";
import type { Block, LessonDoc } from "../../lib/learn/types";

/* ---------------- rank ---------------- */

test("gradeBlock: rank exact order gets full points", () => {
  const block: Block = {
    id: "r1",
    type: "rank",
    prompt: "Order these",
    items: [{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }],
    correctOrder: ["a", "b", "c"],
    grading: "weighted",
    effects: [],
    bands: [],
    points: 3,
  };
  const outcome = gradeBlock(block, ["a", "b", "c"]);
  assert.equal(outcome.pointsEarned, 3);
  assert.equal(outcome.correct, true);
});

test("gradeBlock: rank partial order gets partial credit", () => {
  const block: Block = {
    id: "r1",
    type: "rank",
    prompt: "Order these",
    items: [{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }],
    correctOrder: ["a", "b", "c"],
    grading: "weighted",
    effects: [],
    bands: [],
    points: 3,
  };
  const outcome = gradeBlock(block, ["a", "c", "b"]);
  assert.equal(outcome.correct, false);
  assert.equal(outcome.pointsEarned, 1); // only "a" in the right slot -> 1/3 of 3
});

/* ---------------- categorize / drag_drop ---------------- */

test("gradeBlock: categorize scores by correct placements", () => {
  const block: Block = {
    id: "c1",
    type: "categorize",
    prompt: "Sort",
    categories: [{ id: "fruit", label: "Fruit" }, { id: "veg", label: "Veg" }],
    items: [
      { id: "apple", label: "Apple", correctCategoryId: "fruit" },
      { id: "carrot", label: "Carrot", correctCategoryId: "veg" },
    ],
    grading: "weighted",
    effects: [],
    bands: [],
    points: 2,
  };
  const full = gradeBlock(block, { apple: "fruit", carrot: "veg" });
  assert.equal(full.pointsEarned, 2);
  assert.equal(full.correct, true);
  const half = gradeBlock(block, { apple: "fruit", carrot: "fruit" });
  assert.equal(half.pointsEarned, 1);
  assert.equal(half.correct, false);
});

test("drag_drop grades identically to categorize (shared logic, distinct type)", () => {
  const block: Block = {
    id: "d1",
    type: "drag_drop",
    prompt: "Sort",
    categories: [{ id: "fruit", label: "Fruit" }, { id: "veg", label: "Veg" }],
    items: [{ id: "apple", label: "Apple", correctCategoryId: "fruit" }, { id: "carrot", label: "Carrot", correctCategoryId: "veg" }],
    grading: "weighted",
    effects: [],
    bands: [],
    points: 2,
  };
  const outcome = gradeBlock(block, { apple: "fruit", carrot: "veg" });
  assert.equal(outcome.pointsEarned, 2);
});

/* ---------------- match ---------------- */

test("gradeBlock: match scores correct pairings", () => {
  const block: Block = {
    id: "m1",
    type: "match",
    prompt: "Match",
    pairs: [
      { id: "p1", left: "Supply", right: "Curve slopes up" },
      { id: "p2", left: "Demand", right: "Curve slopes down" },
    ],
    grading: "weighted",
    effects: [],
    bands: [],
    points: 2,
  };
  const outcome = gradeBlock(block, { p1: "Curve slopes up", p2: "Curve slopes down" });
  assert.equal(outcome.pointsEarned, 2);
  assert.equal(outcome.correct, true);
  const wrong = gradeBlock(block, { p1: "Curve slopes down", p2: "Curve slopes up" });
  assert.equal(wrong.pointsEarned, 0);
});

/* ---------------- tradeoff_matrix ---------------- */

test("gradeBlock: tradeoff_matrix grades via chosen option like strategy_choice", () => {
  const block: Block = {
    id: "t1",
    type: "tradeoff_matrix",
    prompt: "Pick a strategy",
    criteria: [{ id: "cost", label: "Cost" }, { id: "speed", label: "Speed" }],
    options: [
      { id: "opt-a", label: "A", values: { cost: 10, speed: 5 }, effects: [], points: 2 },
      { id: "opt-b", label: "B", values: { cost: 5, speed: 10 }, effects: [], points: 1 },
    ],
    grading: "weighted",
    effects: [],
    bands: [],
    points: 2,
  };
  const outcome = gradeBlock(block, "opt-a");
  assert.equal(outcome.pointsEarned, 2);
  assert.equal(resolveBranch(block, "opt-a"), undefined);
});

/* ---------------- forecast ---------------- */

test("gradeBlock: forecast within tolerance is correct, partial credit scales with distance", () => {
  const block: Block = {
    id: "f1",
    type: "forecast",
    prompt: "Predict attendance",
    unit: "number",
    correctValue: 1000,
    tolerance: 100,
    grading: "weighted",
    effects: [],
    bands: [],
    points: 4,
  };
  const exact = gradeBlock(block, 1000);
  assert.equal(exact.correct, true);
  assert.equal(exact.pointsEarned, 4);
  const within = gradeBlock(block, 1080);
  assert.equal(within.correct, true);
  const far = gradeBlock(block, 5000);
  assert.equal(far.correct, false);
  assert.ok(far.pointsEarned < exact.pointsEarned);
});

/* ---------------- table/chart/timeline: no-score content ---------------- */

test("gradeBlock: table/chart/timeline never score", () => {
  const table: Block = { id: "tb1", type: "table", columns: [{ key: "a", label: "A" }], rows: [{ a: "1" }] };
  const chart: Block = { id: "ch1", type: "chart", chartKind: "bar", unit: "number", series: [{ label: "Q1", value: 10 }] };
  const timeline: Block = { id: "tl1", type: "timeline", events: [{ label: "Launch", when: "Day 1" }] };
  for (const b of [table, chart, timeline]) {
    const outcome = gradeBlock(b, undefined);
    assert.equal(outcome.pointsEarned, 0);
    assert.equal(outcome.pointsPossible, 0);
  }
});

/* ---------------- validation ---------------- */

function minimalDoc(blocks: Block[]): LessonDoc {
  return {
    schemaVersion: 1,
    meta: { title: "Stage 6 test lesson", estMinutes: 10 },
    variables: [],
    skills: [],
    phases: [{ id: "phase-1", kind: "Decision", title: "Decision", blocks }],
    scoring: { mode: "points", starThresholds: [50, 75, 90], xp: { base: 10, perStar: 5, firstCompletionBonus: 20 }, replayPolicy: { improvedXpPct: 0.25, noImprovementXpFloor: 0 }, badges: [] },
    results: { showVariables: true, showSkillDeltas: true },
  };
}

test("validateLessonDoc: rank correctOrder must reference only declared items", () => {
  const doc = minimalDoc([
    {
      id: "r1",
      type: "rank",
      prompt: "Order",
      items: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
      correctOrder: ["a", "ghost"],
      grading: "weighted",
      effects: [],
      bands: [],
      points: 2,
    },
  ]);
  const result = validateLessonDoc(doc);
  assert.ok(result.errors.some((e) => e.includes("unknown item")));
});

test("validateLessonDoc: categorize item correctCategoryId must be a declared category", () => {
  const doc = minimalDoc([
    {
      id: "c1",
      type: "categorize",
      prompt: "Sort",
      categories: [{ id: "fruit", label: "Fruit" }, { id: "veg", label: "Veg" }],
      items: [{ id: "apple", label: "Apple", correctCategoryId: "mineral" }],
      grading: "weighted",
      effects: [],
      bands: [],
      points: 1,
    },
  ]);
  const result = validateLessonDoc(doc);
  assert.ok(result.errors.some((e) => e.includes("is not one of its categories")));
});

test("validateLessonDoc: match block requires unique pair ids", () => {
  const doc = minimalDoc([
    {
      id: "m1",
      type: "match",
      prompt: "Match",
      pairs: [
        { id: "dup", left: "A", right: "1" },
        { id: "dup", left: "B", right: "2" },
      ],
      grading: "weighted",
      effects: [],
      bands: [],
      points: 1,
    },
  ]);
  const result = validateLessonDoc(doc);
  assert.ok(result.errors.some((e) => e.includes("duplicate pair ids")));
});

test("validateLessonDoc: forecast tolerance must be non-negative", () => {
  const doc = minimalDoc([
    { id: "f1", type: "forecast", prompt: "Predict", unit: "number", correctValue: 10, tolerance: -1, grading: "weighted", effects: [], bands: [], points: 1 },
  ]);
  const result = validateLessonDoc(doc);
  assert.ok(result.errors.some((e) => e.includes("tolerance must be non-negative")));
});

/* ---------------- schema round-trips ---------------- */

test("schema: new Stage 6 block types parse via LessonDocSchema", () => {
  const doc = minimalDoc([
    { id: "r1", type: "rank", prompt: "Order", items: [{ id: "a", label: "A" }, { id: "b", label: "B" }], correctOrder: ["a", "b"], grading: "weighted", effects: [], bands: [], points: 1 },
  ]);
  const parsed = LessonDocSchema.parse(doc);
  assert.equal(parsed.phases[0].blocks[0].type, "rank");
});
