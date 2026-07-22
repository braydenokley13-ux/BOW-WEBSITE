import { test } from "node:test";
import assert from "node:assert/strict";
import {
  roundMoney,
  roundPercent,
  roundPoints,
  applyEffect,
  applyEffects,
  evalCondition,
  resolveBranch,
  gradeBlock,
  computeResults,
  makeTransitionGuard,
  type Variables,
} from "../../lib/learn/engine";
import type { Block, LessonDoc } from "../../lib/learn/types";

test("rounding: half-up, deterministic across representative floats", () => {
  // 1.005 * 100 === 100.49999999999999 in IEEE754 float, so this rounds down to
  // 1 — a known, deterministic (not banker's-rounding) float quirk we accept
  // rather than paper over, since client and server hit the identical value.
  assert.equal(roundMoney(1.005), 1);
  assert.equal(roundMoney(2.675), 2.68);
  assert.equal(roundPercent(33.335), 33.34);
  assert.equal(roundPoints(2.5), 3);
  assert.equal(roundPoints(-2.5), -2); // Math.round rounds -2.5 -> -2 (toward +Infinity), documented behavior
});

test("applyEffect: every verb", () => {
  const vars: Variables = { price: 10, attendance: 100 };
  assert.equal(applyEffect(vars, { variable: "price", verb: "increase_by", amount: 5 }).vars.price, 15);
  assert.equal(applyEffect(vars, { variable: "price", verb: "decrease_by", amount: 5 }).vars.price, 5);
  assert.equal(applyEffect(vars, { variable: "price", verb: "increase_pct", amount: 10 }).vars.price, 11);
  assert.equal(applyEffect(vars, { variable: "price", verb: "decrease_pct", amount: 10 }).vars.price, 9);
  assert.equal(applyEffect(vars, { variable: "price", verb: "set_to", amount: 42 }).vars.price, 42);
  assert.equal(applyEffect(vars, { variable: "price", verb: "from_response", scale: 2 }, 5).vars.price, 20);
});

test("applyEffect: from_response coerces string/object responses", () => {
  const vars: Variables = { total: 0 };
  assert.equal(applyEffect(vars, { variable: "total", verb: "from_response", scale: 1 }, "7").vars.total, 7);
  assert.equal(
    applyEffect(vars, { variable: "total", verb: "from_response", scale: 1 }, { a: 3, b: 4 }).vars.total,
    7,
  );
});

test("applyEffect: `when` condition gates the effect", () => {
  const vars: Variables = { price: 10 };
  const ctx = { variables: vars, responses: {} };
  const gated = applyEffect(
    vars,
    { variable: "price", verb: "increase_by", amount: 5, when: { op: "gte", ref: { kind: "variable", key: "price" }, value: 100 } },
    undefined,
    ctx,
  );
  assert.equal(gated.vars.price, 10); // condition false, no change
});

test("applyEffects: accumulates deltas across multiple rules", () => {
  const { vars, deltas } = applyEffects(
    { price: 10 },
    [
      { variable: "price", verb: "increase_by", amount: 5 },
      { variable: "price", verb: "decrease_by", amount: 2 },
    ],
  );
  assert.equal(vars.price, 13);
  assert.equal(deltas.price, 3);
});

test("evalCondition: gte/lte/eq/between/answered/all/any", () => {
  const ctx = { variables: { x: 10 }, responses: { q1: "a", q2: ["a", "b"] } };
  assert.equal(evalCondition({ op: "gte", ref: { kind: "variable", key: "x" }, value: 10 }, ctx), true);
  assert.equal(evalCondition({ op: "lte", ref: { kind: "variable", key: "x" }, value: 5 }, ctx), false);
  assert.equal(evalCondition({ op: "eq", ref: { kind: "variable", key: "x" }, value: 10 }, ctx), true);
  assert.equal(evalCondition({ op: "between", ref: { kind: "variable", key: "x" }, min: 5, max: 15 }, ctx), true);
  assert.equal(evalCondition({ op: "answered", blockId: "q1" }, ctx), true);
  assert.equal(evalCondition({ op: "answered", blockId: "q2", optionId: "b" }, ctx), true);
  assert.equal(evalCondition({ op: "answered", blockId: "missing" }, ctx), false);
  assert.equal(
    evalCondition(
      { op: "all", conditions: [{ op: "answered", blockId: "q1" }, { op: "gte", ref: { kind: "variable", key: "x" }, value: 1 }] },
      ctx,
    ),
    true,
  );
  assert.equal(
    evalCondition({ op: "any", conditions: [{ op: "answered", blockId: "missing" }, { op: "answered", blockId: "q1" }] }, ctx),
    true,
  );
});

test("resolveBranch: strategy_choice, scenario, slider branch maps", () => {
  const strategy: Block = {
    id: "b1",
    type: "strategy_choice",
    prompt: "Pick",
    options: [
      { id: "raise", label: "Raise", effects: [], goTo: "consequence-raise" },
      { id: "hold", label: "Hold", effects: [] },
    ],
    grading: "weighted",
    effects: [],
    bands: [],
    points: 1,
  } as Block;
  assert.equal(resolveBranch(strategy, "raise"), "consequence-raise");
  assert.equal(resolveBranch(strategy, "hold"), undefined);

  const scenario: Block = {
    id: "b2",
    type: "scenario",
    narrative: "...",
    choices: [
      { id: "a", label: "A", effects: [], goTo: "path-a" },
      { id: "b", label: "B", effects: [] },
    ],
  } as Block;
  assert.equal(resolveBranch(scenario, "a"), "path-a");

  const slider: Block = {
    id: "b3",
    type: "slider",
    prompt: "Set",
    min: 0,
    max: 100,
    step: 1,
    unit: "number",
    grading: "variable_effects",
    effects: [],
    bands: [],
    points: 0,
    branch: { "50": "midpoint" },
  } as Block;
  assert.equal(resolveBranch(slider, 50), "midpoint");
  assert.equal(resolveBranch(slider, 10), undefined);
});

test("makeTransitionGuard: throws past limit", () => {
  const guard = makeTransitionGuard(3);
  guard.step();
  guard.step();
  guard.step();
  assert.throws(() => guard.step());
});

test("gradeBlock: mc correct/incorrect", () => {
  const block: Block = {
    id: "q1",
    type: "mc",
    prompt: "2+2?",
    options: [{ id: "a", label: "3" }, { id: "b", label: "4" }],
    correctOptionId: "b",
    grading: "correct",
    points: 2,
  } as Block;
  assert.deepEqual(gradeBlock(block, "b"), { correct: true, pointsEarned: 2, pointsPossible: 2, variableDeltas: {}, feedback: undefined });
  assert.equal(gradeBlock(block, "a").correct, false);
  assert.equal(gradeBlock(block, "a").pointsEarned, 0);
});

test("gradeBlock: multi_select correct (exact) vs weighted (partial credit)", () => {
  const exact: Block = {
    id: "m1",
    type: "multi_select",
    prompt: "Pick evens",
    options: [{ id: "1", label: "1" }, { id: "2", label: "2" }, { id: "3", label: "3" }, { id: "4", label: "4" }],
    correctOptionIds: ["2", "4"],
    grading: "correct",
    points: 4,
  } as Block;
  assert.equal(gradeBlock(exact, ["2", "4"]).pointsEarned, 4);
  assert.equal(gradeBlock(exact, ["2"]).pointsEarned, 0);

  const weighted: Block = { ...exact, grading: "weighted" } as Block;
  // 1 correct, 0 incorrect out of 2 correct -> 4 * 0.5 = 2
  assert.equal(gradeBlock(weighted, ["2"]).pointsEarned, 2);
  // 1 correct + 1 incorrect -> (1-1)/2 = 0
  assert.equal(gradeBlock(weighted, ["2", "3"]).pointsEarned, 0);
});

test("gradeBlock: true_false, numeric (correct + weighted)", () => {
  const tf: Block = { id: "t1", type: "true_false", prompt: "Sky is blue", correctAnswer: true, grading: "correct", points: 1 } as Block;
  assert.equal(gradeBlock(tf, true).correct, true);
  assert.equal(gradeBlock(tf, false).pointsEarned, 0);

  const numExact: Block = { id: "n1", type: "numeric", prompt: "Price", correctValue: 10, tolerance: 1, grading: "correct", points: 5 } as Block;
  assert.equal(gradeBlock(numExact, 10.5).correct, true);
  assert.equal(gradeBlock(numExact, 20).correct, false);

  const numWeighted: Block = { ...numExact, grading: "weighted" } as Block;
  const near = gradeBlock(numWeighted, 10);
  const far = gradeBlock(numWeighted, 100);
  assert.ok(near.pointsEarned >= far.pointsEarned);
});

test("gradeBlock: short_response case sensitivity", () => {
  const block: Block = {
    id: "s1",
    type: "short_response",
    prompt: "Capital of France?",
    acceptedAnswers: ["Paris"],
    caseSensitive: false,
    grading: "correct",
    points: 1,
  } as Block;
  assert.equal(gradeBlock(block, "paris").correct, true);
  assert.equal(gradeBlock({ ...block, caseSensitive: true } as Block, "paris").correct, false);
});

test("gradeBlock: strategy_choice weighted uses chosen option's points + effects", () => {
  const block: Block = {
    id: "d1",
    type: "strategy_choice",
    prompt: "Choose",
    options: [
      { id: "aggressive", label: "Aggressive", effects: [{ variable: "risk", verb: "increase_by", amount: 20 }], points: 3 },
      { id: "safe", label: "Safe", effects: [{ variable: "risk", verb: "decrease_by", amount: 10 }], points: 5 },
    ],
    grading: "weighted",
    effects: [],
    bands: [],
    points: 5,
  } as Block;
  const out = gradeBlock(block, "safe");
  assert.equal(out.pointsEarned, 5);
  assert.equal(out.variableDeltas.risk, -10);
});

test("gradeBlock: rubric_bands picks first matching band", () => {
  const block: Block = {
    id: "d2",
    type: "slider",
    prompt: "Set price",
    min: 0,
    max: 100,
    step: 1,
    unit: "currency",
    grading: "rubric_bands",
    effects: [{ variable: "revenue", verb: "from_response", scale: 10 }],
    bands: [
      { when: { op: "gte", ref: { kind: "variable", key: "revenue" }, value: 500 }, points: 10, feedback: "great" },
      { when: { op: "gte", ref: { kind: "variable", key: "revenue" }, value: 0 }, points: 2, feedback: "ok" },
    ],
    points: 10,
  } as Block;
  const high = gradeBlock(block, 60);
  assert.equal(high.pointsEarned, 10);
  assert.equal(high.feedback, "great");
  const low = gradeBlock(block, 10);
  assert.equal(low.pointsEarned, 2);
});

test("gradeBlock: budget_allocation over-budget zeroes points", () => {
  const block: Block = {
    id: "d3",
    type: "budget_allocation",
    prompt: "Allocate",
    totalBudget: 100,
    categories: [{ id: "marketing", label: "Marketing" }, { id: "ops", label: "Ops" }],
    grading: "weighted",
    effects: [],
    bands: [],
    points: 10,
  } as Block;
  assert.equal(gradeBlock(block, { marketing: 60, ops: 60 }).pointsEarned, 0);
  assert.equal(gradeBlock(block, { marketing: 40, ops: 60 }).pointsEarned, 10);
});

test("gradeBlock: scenario choice effects + points + feedback", () => {
  const block: Block = {
    id: "sc1",
    type: "scenario",
    narrative: "A storm hits",
    choices: [
      { id: "evacuate", label: "Evacuate", effects: [{ variable: "safety", verb: "increase_by", amount: 10 }], points: 5, feedback: "Safe choice" },
      { id: "stay", label: "Stay", effects: [], points: 0 },
    ],
  } as Block;
  const out = gradeBlock(block, "evacuate");
  assert.equal(out.pointsEarned, 5);
  assert.equal(out.variableDeltas.safety, 10);
  assert.equal(out.feedback, "Safe choice");
});

test("gradeBlock: media completion modes", () => {
  const started: Block = { id: "med1", type: "media", kind: "video", src: "x.mp4", completion: { mode: "started" } } as Block;
  assert.equal(gradeBlock(started, true).correct, true);
  const percent: Block = { id: "med2", type: "media", kind: "audio", src: "x.mp3", completion: { mode: "percent", threshold: 0.8 } } as Block;
  assert.equal(gradeBlock(percent, 0.9).correct, true);
  assert.equal(gradeBlock(percent, 0.5).correct, false);
});

function sampleDoc(): LessonDoc {
  return {
    schemaVersion: 1,
    meta: { title: "Sample", estMinutes: 10 },
    variables: [{ key: "price", label: "Price", initial: 10, unit: "currency", visible: true }],
    skills: [{ skillId: "pricing", maxPoints: 10 }],
    phases: [
      {
        id: "p1",
        kind: "Learn",
        title: "Learn",
        blocks: [
          { id: "q1", type: "mc", prompt: "?", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }], correctOptionId: "b", grading: "correct", points: 4 } as Block,
        ],
      },
      {
        id: "p2",
        kind: "Decision",
        title: "Decision",
        blocks: [
          {
            id: "d1",
            type: "slider",
            prompt: "Set price",
            min: 0,
            max: 100,
            step: 1,
            unit: "currency",
            grading: "weighted",
            effects: [{ variable: "price", verb: "set_to", amount: 20 }],
            bands: [],
            points: 6,
          } as Block,
        ],
      },
    ],
    scoring: {
      mode: "points",
      starThresholds: [50, 75, 90],
      xp: { base: 10, perStar: 5, firstCompletionBonus: 20 },
      replayPolicy: { improvedXpPct: 0.25, noImprovementXpFloor: 0 },
      badges: [],
    },
    results: { showVariables: true, showSkillDeltas: true },
  };
}

test("computeResults: full score gives 3 stars and applies variable effects", () => {
  const doc = sampleDoc();
  const results = computeResults(doc, [
    { blockId: "q1", response: "b" },
    { blockId: "d1", response: 20 },
  ]);
  assert.equal(results.totalPoints, 10);
  assert.equal(results.pointsPossible, 10);
  assert.equal(results.score0to100, 100);
  assert.equal(results.stars, 3);
  assert.equal(results.variables.price, 20);
  assert.equal(results.skillPoints.pricing, 10);
});

test("computeResults: partial score gives fewer stars", () => {
  const doc = sampleDoc();
  const results = computeResults(doc, [{ blockId: "q1", response: "a" }, { blockId: "d1", response: 20 }]);
  assert.equal(results.totalPoints, 6);
  assert.equal(results.score0to100, 60);
  assert.equal(results.stars, 1);
});
