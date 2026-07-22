import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateRule,
  evaluateBadgeRules,
  parseAchievementRule,
  type AchievementContext,
} from "../../lib/learn/achievements";

function baseCtx(overrides: Partial<AchievementContext> = {}): AchievementContext {
  return {
    lessonId: "lesson-1",
    score: 80,
    stars: 2,
    variables: { profit: 500 },
    completedLessonIds: new Set(["lesson-1"]),
    totalStarsEarned: 2,
    totalLessonsCompleted: 1,
    trackLessonIds: { "track-1": ["lesson-1", "lesson-2"] },
    moduleLessonIds: { "module-1": ["lesson-1"] },
    ...overrides,
  };
}

test("lesson_complete: satisfied when the just-completed lesson matches and no minStars set", () => {
  const rule = parseAchievementRule({ type: "lesson_complete", lessonId: "lesson-1" });
  assert.ok(rule);
  assert.equal(evaluateRule(rule!, baseCtx()), true);
});

test("lesson_complete: minStars gate", () => {
  const rule = parseAchievementRule({ type: "lesson_complete", lessonId: "lesson-1", minStars: 3 });
  assert.ok(rule);
  assert.equal(evaluateRule(rule!, baseCtx({ stars: 2 })), false);
  assert.equal(evaluateRule(rule!, baseCtx({ stars: 3 })), true);
});

test("lesson_complete: does not fire for a different lesson in this attempt", () => {
  const rule = parseAchievementRule({ type: "lesson_complete", lessonId: "lesson-2" });
  assert.ok(rule);
  assert.equal(evaluateRule(rule!, baseCtx()), false);
});

test("track_complete: requires every lesson in the track completed", () => {
  const rule = parseAchievementRule({ type: "track_complete", trackId: "track-1" });
  assert.ok(rule);
  assert.equal(evaluateRule(rule!, baseCtx()), false);
  assert.equal(evaluateRule(rule!, baseCtx({ completedLessonIds: new Set(["lesson-1", "lesson-2"]) })), true);
});

test("track_complete: unknown track never satisfied", () => {
  const rule = parseAchievementRule({ type: "track_complete", trackId: "nope" });
  assert.ok(rule);
  assert.equal(evaluateRule(rule!, baseCtx()), false);
});

test("module_complete: satisfied when its lessons are all done", () => {
  const rule = parseAchievementRule({ type: "module_complete", moduleId: "module-1" });
  assert.ok(rule);
  assert.equal(evaluateRule(rule!, baseCtx()), true);
});

test("variable_threshold: gte", () => {
  const rule = parseAchievementRule({ type: "variable_threshold", variableId: "profit", gte: 500 });
  assert.ok(rule);
  assert.equal(evaluateRule(rule!, baseCtx({ variables: { profit: 499 } })), false);
  assert.equal(evaluateRule(rule!, baseCtx({ variables: { profit: 500 } })), true);
});

test("variable_threshold: lte", () => {
  const rule = parseAchievementRule({ type: "variable_threshold", variableId: "cost", lte: 100 });
  assert.ok(rule);
  assert.equal(evaluateRule(rule!, baseCtx({ variables: { cost: 101 } })), false);
  assert.equal(evaluateRule(rule!, baseCtx({ variables: { cost: 100 } })), true);
});

test("variable_threshold: missing variable never satisfied", () => {
  const rule = parseAchievementRule({ type: "variable_threshold", variableId: "missing", gte: 0 });
  assert.ok(rule);
  assert.equal(evaluateRule(rule!, baseCtx()), false);
});

test("score_gte: unscoped applies to any lesson", () => {
  const rule = parseAchievementRule({ type: "score_gte", score: 90 });
  assert.ok(rule);
  assert.equal(evaluateRule(rule!, baseCtx({ score: 89 })), false);
  assert.equal(evaluateRule(rule!, baseCtx({ score: 90 })), true);
});

test("score_gte: scoped to a lessonId", () => {
  const rule = parseAchievementRule({ type: "score_gte", lessonId: "lesson-1", score: 90 });
  assert.ok(rule);
  assert.equal(evaluateRule(rule!, baseCtx({ lessonId: "lesson-2", score: 95 })), false);
  assert.equal(evaluateRule(rule!, baseCtx({ lessonId: "lesson-1", score: 95 })), true);
});

test("stars_total_gte", () => {
  const rule = parseAchievementRule({ type: "stars_total_gte", n: 10 });
  assert.ok(rule);
  assert.equal(evaluateRule(rule!, baseCtx({ totalStarsEarned: 9 })), false);
  assert.equal(evaluateRule(rule!, baseCtx({ totalStarsEarned: 10 })), true);
});

test("lessons_completed_gte", () => {
  const rule = parseAchievementRule({ type: "lessons_completed_gte", n: 5 });
  assert.ok(rule);
  assert.equal(evaluateRule(rule!, baseCtx({ totalLessonsCompleted: 4 })), false);
  assert.equal(evaluateRule(rule!, baseCtx({ totalLessonsCompleted: 5 })), true);
});

test("parseAchievementRule: rejects malformed rules", () => {
  assert.equal(parseAchievementRule(null), null);
  assert.equal(parseAchievementRule(undefined), null);
  assert.equal(parseAchievementRule({}), null);
  assert.equal(parseAchievementRule({ type: "not_a_real_type" }), null);
  assert.equal(parseAchievementRule({ type: "lesson_complete" }), null); // missing lessonId
  assert.equal(parseAchievementRule({ type: "lesson_complete", lessonId: "" }), null); // empty lessonId
  assert.equal(parseAchievementRule({ type: "variable_threshold", variableId: "x" }), null); // no gte/lte
  assert.equal(parseAchievementRule({ type: "score_gte", score: 150 }), null); // out of range
  assert.equal(parseAchievementRule({ type: "stars_total_gte", n: -1 }), null); // negative
  assert.equal(parseAchievementRule("just a string"), null);
});

test("evaluateBadgeRules: skips malformed rules and returns only satisfied ids", () => {
  const ctx = baseCtx();
  const candidates = [
    { id: "good-badge", rule: { type: "lesson_complete", lessonId: "lesson-1" } },
    { id: "malformed-badge", rule: { type: "lesson_complete" } },
    { id: "unsatisfied-badge", rule: { type: "lesson_complete", lessonId: "lesson-1", minStars: 3 } },
    { id: "null-rule-badge", rule: null },
  ];
  assert.deepEqual(evaluateBadgeRules(candidates, ctx), ["good-badge"]);
});
