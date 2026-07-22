import { test } from "node:test";
import assert from "node:assert/strict";
import { clampIndex, reorderWithinList, moveBetweenLists } from "../../lib/learn/mapOrder";

test("clampIndex: clamps into [0, length]", () => {
  assert.equal(clampIndex(-3, 5), 0);
  assert.equal(clampIndex(2, 5), 2);
  assert.equal(clampIndex(99, 5), 5);
});

test("reorderWithinList: moves an existing item to a new position", () => {
  const result = reorderWithinList(["a", "b", "c", "d"], "a", 2);
  assert.deepEqual(result, ["b", "c", "a", "d"]);
});

test("reorderWithinList: moving to index 0 puts it first", () => {
  const result = reorderWithinList(["a", "b", "c"], "c", 0);
  assert.deepEqual(result, ["c", "a", "b"]);
});

test("reorderWithinList: out-of-range index clamps to the end", () => {
  const result = reorderWithinList(["a", "b", "c"], "a", 999);
  assert.deepEqual(result, ["b", "c", "a"]);
});

test("reorderWithinList: item not already present is inserted (defensive)", () => {
  const result = reorderWithinList(["a", "b"], "z", 1);
  assert.deepEqual(result, ["a", "z", "b"]);
});

test("moveBetweenLists: removes from origin, inserts into destination at index", () => {
  const { fromIds, toIds } = moveBetweenLists(["a", "b", "c"], ["x", "y"], "b", 1);
  assert.deepEqual(fromIds, ["a", "c"]);
  assert.deepEqual(toIds, ["x", "b", "y"]);
});

test("moveBetweenLists: dropping into an empty destination section", () => {
  const { fromIds, toIds } = moveBetweenLists(["a", "b"], [], "a", 0);
  assert.deepEqual(fromIds, ["b"]);
  assert.deepEqual(toIds, ["a"]);
});

test("moveBetweenLists: out-of-range destination index clamps to append", () => {
  const { toIds } = moveBetweenLists(["a"], ["x", "y"], "a", 50);
  assert.deepEqual(toIds, ["x", "y", "a"]);
});
