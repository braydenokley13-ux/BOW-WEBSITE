import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateNodeUnlock, type UnlockContext } from "../../lib/learn/unlock";
import { gradeBlock } from "../../lib/learn/engine";
import type { Block } from "../../lib/learn/types";

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

/* ---------------- release-state evaluation (requiresInstructorRelease + opensAt) ---------------- */

test("release: requiresInstructorRelease blocks a node until released is true", () => {
  const node = { id: "n1", unlock: { requiresInstructorRelease: true } };
  assert.equal(evaluateNodeUnlock(node, ctx({ released: false })).unlocked, false);
  assert.equal(evaluateNodeUnlock(node, ctx({ released: undefined })).unlocked, false);
  assert.equal(evaluateNodeUnlock(node, ctx({ released: true })).unlocked, true);
});

test("release: opensAt gates until the timed open passes, independent of release", () => {
  const node = { id: "n2", unlock: { requiresInstructorRelease: true, opensAt: 2000 } };
  // Released but not yet open.
  const early = evaluateNodeUnlock(node, ctx({ released: true, now: 1000 }));
  assert.equal(early.unlocked, false);
  // Open but not released.
  const unreleased = evaluateNodeUnlock(node, ctx({ released: false, now: 3000 }));
  assert.equal(unreleased.unlocked, false);
  // Both satisfied.
  assert.equal(evaluateNodeUnlock(node, ctx({ released: true, now: 3000 })).unlocked, true);
});

test("release: a student override (released=true) unlocks even without other progress", () => {
  const node = { id: "n3", unlock: { requiresNodes: ["prereq"], requiresInstructorRelease: true } };
  // requiresNodes still applies independently — release doesn't bypass prerequisite chains.
  const r = evaluateNodeUnlock(node, ctx({ released: true }));
  assert.equal(r.unlocked, false);
  if (!r.unlocked) assert.match(r.reason, /complete the previous lesson/i);
  const r2 = evaluateNodeUnlock(node, ctx({ released: true, completedNodes: new Set(["prereq"]) }));
  assert.equal(r2.unlocked, true);
});

/* ---------------- server-side media/reflection gating (mirrors completeAttempt's check) ---------------- */

test("gating: media block with percent threshold unmet is not satisfied", () => {
  const block = { id: "m1", type: "media", kind: "video", src: "x", completion: { mode: "percent", threshold: 80 } } as unknown as Block;
  assert.equal(gradeBlock(block, 50).correct, false);
  assert.equal(gradeBlock(block, 80).correct, true);
  assert.equal(gradeBlock(block, 95).correct, true);
});

test("gating: media block with finished mode requires an explicit finished/true response", () => {
  const block = { id: "m2", type: "media", kind: "podcast", src: "x", completion: { mode: "finished" } } as unknown as Block;
  assert.equal(gradeBlock(block, "started").correct, false);
  assert.equal(gradeBlock(block, "finished").correct, true);
  assert.equal(gradeBlock(block, true).correct, true);
});

test("gating: long_text min_words rejects short reflections (legacy >=75-word parity)", () => {
  const block = { id: "r1", type: "long_text", prompt: "Reflect", reflection: { mode: "min_words", minWords: 75 } } as unknown as Block;
  const short = "Only a few words here, not enough to pass the threshold at all really.";
  assert.equal(gradeBlock(block, short).correct, false);
  const long = Array.from({ length: 80 }, () => "word").join(" ");
  assert.equal(gradeBlock(block, long).correct, true);
});

test("gating: long_text manual_review mode is completion-gated only by non-empty text", () => {
  const block = { id: "r2", type: "long_text", prompt: "Reflect", reflection: { mode: "manual_review" } } as unknown as Block;
  assert.equal(gradeBlock(block, "").correct, false);
  assert.equal(gradeBlock(block, "a real reflection").correct, true);
});
