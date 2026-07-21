import { test } from "node:test";
import assert from "node:assert/strict";
import { LessonDocSchema, BlockSchema } from "../../lib/learn/schema";

function baseDoc() {
  return {
    schemaVersion: 1,
    meta: { title: "Test Lesson" },
    variables: [{ key: "price", label: "Price", initial: 10, unit: "currency" }],
    skills: [],
    phases: [
      {
        id: "p1",
        kind: "Briefing",
        title: "Intro",
        blocks: [{ id: "b1", type: "text", body: "Welcome" }],
      },
    ],
    scoring: {
      mode: "points",
      starThresholds: [50, 75, 90],
      xp: { base: 10, perStar: 5, firstCompletionBonus: 20 },
      badges: [],
    },
    results: {},
  };
}

test("LessonDocSchema: parses a minimal valid doc and applies defaults", () => {
  const parsed = LessonDocSchema.parse(baseDoc());
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.results.showVariables, true);
  assert.equal(parsed.scoring.replayPolicy.improvedXpPct, 0.25);
});

test("LessonDocSchema: rejects wrong schemaVersion literal", () => {
  const doc = { ...baseDoc(), schemaVersion: 2 };
  assert.throws(() => LessonDocSchema.parse(doc));
});

test("LessonDocSchema: rejects empty phases array", () => {
  const doc = { ...baseDoc(), phases: [] };
  assert.throws(() => LessonDocSchema.parse(doc));
});

test("LessonDocSchema: rejects starThresholds with wrong arity", () => {
  const doc = baseDoc();
  doc.scoring.starThresholds = [50, 75] as unknown as [number, number, number];
  assert.throws(() => LessonDocSchema.parse(doc));
});

test("BlockSchema: discriminates on `type` for every V1 block", () => {
  const samples: unknown[] = [
    { id: "1", type: "text", body: "x" },
    { id: "2", type: "heading", text: "H" },
    { id: "3", type: "callout", body: "x" },
    { id: "4", type: "stat", label: "L", value: 1 },
    { id: "5", type: "comparison", items: [{ label: "a", value: 1 }, { label: "b", value: 2 }] },
    { id: "6", type: "image", src: "x.png", alt: "alt" },
    { id: "7", type: "media", kind: "video", src: "v.mp4", completion: { mode: "none" } },
    { id: "8", type: "mc", prompt: "?", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }], correctOptionId: "a" },
    { id: "9", type: "multi_select", prompt: "?", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }], correctOptionIds: ["a"] },
    { id: "10", type: "true_false", prompt: "?", correctAnswer: true },
    { id: "11", type: "numeric", prompt: "?", correctValue: 5 },
    { id: "12", type: "short_response", prompt: "?", acceptedAnswers: ["x"] },
    { id: "13", type: "long_text", prompt: "?", reflection: { mode: "completion_only" } },
    {
      id: "14",
      type: "strategy_choice",
      prompt: "?",
      options: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
      grading: "weighted",
    },
    { id: "15", type: "slider", prompt: "?", min: 0, max: 10, grading: "variable_effects" },
    { id: "16", type: "price_set", prompt: "?", min: 0, max: 10, grading: "weighted" },
    {
      id: "17",
      type: "budget_allocation",
      prompt: "?",
      totalBudget: 100,
      categories: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
      grading: "weighted",
    },
    {
      id: "18",
      type: "scenario",
      narrative: "...",
      choices: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
    },
  ];
  for (const sample of samples) {
    const result = BlockSchema.safeParse(sample);
    assert.ok(result.success, `expected ${JSON.stringify(sample)} to parse: ${!result.success && JSON.stringify(result.error.issues)}`);
  }
});

test("BlockSchema: rejects unknown block type", () => {
  const result = BlockSchema.safeParse({ id: "x", type: "not_a_real_block" });
  assert.equal(result.success, false);
});

test("EffectRule via strategy_choice: verb enum is enforced", () => {
  const result = BlockSchema.safeParse({
    id: "14",
    type: "strategy_choice",
    prompt: "?",
    options: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
    grading: "weighted",
    effects: [{ variable: "price", verb: "not_a_real_verb", amount: 1 }],
  });
  assert.equal(result.success, false);
});
