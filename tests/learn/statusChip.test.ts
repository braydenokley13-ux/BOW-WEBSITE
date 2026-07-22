import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveLessonStatusChip } from "../../components/learn/builder/statusChip";

test("statusChip: archived lifecycle always wins", () => {
  const chip = deriveLessonStatusChip({
    lifecycle: "archived",
    publishedVersionId: "v1",
    publishedVersion: 3,
    draftAheadOfPublished: true,
  });
  assert.equal(chip.label, "Archived");
  assert.equal(chip.tone, "neutral");
});

test("statusChip: never published -> Draft", () => {
  const chip = deriveLessonStatusChip({
    lifecycle: "active",
    publishedVersionId: null,
    publishedVersion: null,
    draftAheadOfPublished: false,
  });
  assert.equal(chip.label, "Draft");
  assert.equal(chip.tone, "warning");
});

test("statusChip: published, draft not ahead -> Published Vn", () => {
  const chip = deriveLessonStatusChip({
    lifecycle: "active",
    publishedVersionId: "v1",
    publishedVersion: 3,
    draftAheadOfPublished: false,
  });
  assert.equal(chip.label, "Published V3");
  assert.equal(chip.tone, "positive");
});

test("statusChip: published, draft ahead -> Published Vn · draft ahead", () => {
  const chip = deriveLessonStatusChip({
    lifecycle: "active",
    publishedVersionId: "v1",
    publishedVersion: 3,
    draftAheadOfPublished: true,
  });
  assert.equal(chip.label, "Published V3 · draft ahead");
  assert.equal(chip.tone, "info");
});
