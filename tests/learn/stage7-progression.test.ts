import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateNodeUnlock, isNodeUnlocked, type UnlockContext } from "../../lib/learn/unlock";
import { skillLevelFor, careerTitleFor } from "../../lib/learn/levels";
import { selectContinueTarget, estimateRemainingMinutes } from "../../lib/learn/continue";

function ctx(overrides: Partial<UnlockContext> = {}): UnlockContext {
  return {
    completedNodes: new Set(),
    starsTotal: 0,
    level: 0,
    badges: new Set(),
    now: Date.now(),
    released: undefined,
    ...overrides,
  };
}

test("unlock: no policy is always unlocked", () => {
  assert.deepEqual(evaluateNodeUnlock({ id: "n1", unlock: {} }, ctx()), { unlocked: true });
});

test("unlock: requiresNodes reports human reason when missing", () => {
  const r = evaluateNodeUnlock({ id: "n2", unlock: { requiresNodes: ["n1"] } }, ctx());
  assert.equal(r.unlocked, false);
  if (!r.unlocked) assert.match(r.reason, /complete the previous lesson/i);
});

test("unlock: requiresNodes satisfied once completed", () => {
  const r = evaluateNodeUnlock({ id: "n2", unlock: { requiresNodes: ["n1"] } }, ctx({ completedNodes: new Set(["n1"]) }));
  assert.equal(r.unlocked, true);
});

test("unlock: minStarsTotal gates with a star count in the reason", () => {
  const r = evaluateNodeUnlock({ id: "n3", unlock: { minStarsTotal: 5 } }, ctx({ starsTotal: 2 }));
  assert.equal(r.unlocked, false);
  if (!r.unlocked) assert.match(r.reason, /3 more star/);
  assert.equal(isNodeUnlocked({ id: "n3", unlock: { minStarsTotal: 5 } }, ctx({ starsTotal: 5 })), true);
});

test("unlock: minLevel gates", () => {
  assert.equal(isNodeUnlocked({ id: "n4", unlock: { minLevel: 3 } }, ctx({ level: 2 })), false);
  assert.equal(isNodeUnlocked({ id: "n4", unlock: { minLevel: 3 } }, ctx({ level: 3 })), true);
});

test("unlock: badgeId gates", () => {
  assert.equal(isNodeUnlocked({ id: "n5", unlock: { badgeId: "streak-7" } }, ctx()), false);
  assert.equal(isNodeUnlocked({ id: "n5", unlock: { badgeId: "streak-7" } }, ctx({ badges: new Set(["streak-7"]) })), true);
});

test("unlock: opensAt gates on time", () => {
  const future = Date.now() + 1000 * 60 * 60;
  assert.equal(isNodeUnlocked({ id: "n6", unlock: { opensAt: future } }, ctx()), false);
});

test("unlock: requiresInstructorRelease honors resolved release state", () => {
  assert.equal(isNodeUnlocked({ id: "n7", unlock: { requiresInstructorRelease: true } }, ctx({ released: false })), false);
  assert.equal(isNodeUnlocked({ id: "n7", unlock: { requiresInstructorRelease: true } }, ctx({ released: true })), true);
  // undefined (no resolved release row) must not be treated as unlocked.
  assert.equal(isNodeUnlocked({ id: "n7", unlock: { requiresInstructorRelease: true } }, ctx()), false);
});

test("unlock: multiple conditions AND together, first failure wins in priority order", () => {
  const r = evaluateNodeUnlock({ id: "n8", unlock: { requiresNodes: ["n1"], minStarsTotal: 10 } }, ctx({ starsTotal: 0 }));
  assert.equal(r.unlocked, false);
  if (!r.unlocked) assert.match(r.reason, /complete the previous lesson/i);
});

test("skillLevelFor: level 0 below first threshold", () => {
  const info = skillLevelFor(10);
  assert.equal(info.level, 0);
  assert.equal(info.pointsToNext, 15);
});

test("skillLevelFor: exact threshold lands on that level", () => {
  const info = skillLevelFor(60);
  assert.equal(info.level, 2);
});

test("skillLevelFor: maxed out has null pointsToNext and progress 1", () => {
  const info = skillLevelFor(999999);
  assert.equal(info.pointsToNext, null);
  assert.equal(info.progress, 1);
});

test("careerTitleFor: 0 xp is Rookie Analyst", () => {
  assert.equal(careerTitleFor(0).title, "Rookie Analyst");
});

test("careerTitleFor: high xp reaches General Manager", () => {
  const info = careerTitleFor(10000);
  assert.equal(info.title, "General Manager");
  assert.equal(info.nextTitle, null);
});

test("careerTitleFor: mid-ladder progress fraction", () => {
  const info = careerTitleFor(275); // between 150 (Scouting) and 400 (Data Analyst)
  assert.equal(info.title, "Scouting Analyst");
  assert.ok(info.progress > 0 && info.progress < 1);
});

test("estimateRemainingMinutes: no attempt yet returns full estimate", () => {
  assert.equal(estimateRemainingMinutes(10, 0, 5), 10);
});

test("estimateRemainingMinutes: partial progress reduces estimate, floors at 1", () => {
  assert.equal(estimateRemainingMinutes(10, 4, 5), 2);
  assert.equal(estimateRemainingMinutes(10, 5, 5), 1);
});

test("estimateRemainingMinutes: null est_minutes stays null", () => {
  assert.equal(estimateRemainingMinutes(null, 1, 5), null);
});

test("selectContinueTarget: resumes an in-progress attempt over picking a new node", () => {
  const nodes = [
    { nodeId: "n1", lessonId: "l1", title: "Intro", moduleTitle: "M1", estMinutes: 10, order: 0, unlocked: true, completed: false },
    { nodeId: "n2", lessonId: "l2", title: "Next", moduleTitle: "M1", estMinutes: 8, order: 1, unlocked: true, completed: false },
  ];
  const sel = selectContinueTarget(nodes, { nodeId: "n1", lessonId: "l1", attemptId: "a1", blocksAnswered: 2, totalBlocks: 4 });
  assert.equal(sel.kind, "resume");
  assert.equal(sel.nodeId, "n1");
  assert.equal(sel.estMinutesRemaining, 5);
});

test("selectContinueTarget: picks first unlocked incomplete node in map order when nothing in progress", () => {
  const nodes = [
    { nodeId: "n1", lessonId: "l1", title: "Intro", moduleTitle: "M1", estMinutes: 10, order: 0, unlocked: true, completed: true },
    { nodeId: "n2", lessonId: "l2", title: "Next", moduleTitle: "M1", estMinutes: 8, order: 1, unlocked: true, completed: false },
    { nodeId: "n3", lessonId: "l3", title: "Locked", moduleTitle: "M1", estMinutes: 8, order: 2, unlocked: false, completed: false },
  ];
  const sel = selectContinueTarget(nodes, null);
  assert.equal(sel.kind, "next");
  assert.equal(sel.nodeId, "n2");
});

test("selectContinueTarget: none when everything is done or locked", () => {
  const nodes = [
    { nodeId: "n1", lessonId: "l1", title: "Intro", moduleTitle: "M1", estMinutes: 10, order: 0, unlocked: true, completed: true },
    { nodeId: "n2", lessonId: "l2", title: "Locked", moduleTitle: "M1", estMinutes: 8, order: 1, unlocked: false, completed: false },
  ];
  const sel = selectContinueTarget(nodes, null);
  assert.equal(sel.kind, "none");
});

test("selectContinueTarget: skips bonus/checkpoint nodes with no lessonId", () => {
  const nodes = [
    { nodeId: "n1", lessonId: null, title: "Checkpoint", moduleTitle: "M1", estMinutes: null, order: 0, unlocked: true, completed: false },
    { nodeId: "n2", lessonId: "l2", title: "Real lesson", moduleTitle: "M1", estMinutes: 8, order: 1, unlocked: true, completed: false },
  ];
  const sel = selectContinueTarget(nodes, null);
  assert.equal(sel.nodeId, "n2");
});
