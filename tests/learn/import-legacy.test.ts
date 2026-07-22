import { test } from "node:test";
import assert from "node:assert/strict";

import { lessons } from "../../lib/lessons";
import { LessonDocSchema } from "../../lib/learn/schema";
import { migrateLessonDoc } from "../../lib/learn/compat";
import { validateLessonDoc } from "../../lib/learn/validate";
import {
  importLegacyLesson,
  isImportedDraft,
  IMPORTED_DRAFT_TAG,
  metaTags,
} from "../../lib/learn/importLegacy";

test("importLegacyLesson: transforms all 24 real lessons to schema-valid drafts", () => {
  assert.equal(lessons.length, 24, "expected exactly 24 legacy lessons (Track 101 & 201, 4 modules x 3)");

  for (const lesson of lessons) {
    const doc = importLegacyLesson(lesson);

    // Must pass raw schema parse.
    const parsed = LessonDocSchema.parse(doc);
    assert.equal(parsed.schemaVersion, 1);

    // Must pass the migration pipeline (schema-parse authority for reads).
    const migrated = migrateLessonDoc(doc);
    assert.ok(migrated);

    // validateLessonDoc warnings are OK for drafts; hard errors are not.
    const result = validateLessonDoc(parsed);
    assert.deepEqual(result.errors, [], `${lesson.slug} produced hard validation errors: ${result.errors.join("; ")}`);

    // Every imported doc must carry the marker tag + at least 5 phases.
    assert.ok(isImportedDraft(parsed), `${lesson.slug} missing imported-draft tag`);
    assert.equal(parsed.phases.length, 5);
    assert.deepEqual(
      parsed.phases.map((p) => p.kind),
      ["Briefing", "Learn", "Decision", "FollowUp", "Challenge"],
    );

    // Briefing's first block is always the redesign-needed marker callout.
    const briefing = parsed.phases[0];
    const marker = briefing.blocks[0];
    assert.equal(marker.type, "callout");
    if (marker.type === "callout") {
      assert.equal(marker.title, "IMPORTED — NEEDS INTERACTIVE REDESIGN");
    }
  }
});

test("importLegacyLesson: block ids are unique within a single doc", () => {
  for (const lesson of lessons) {
    const doc = importLegacyLesson(lesson);
    const ids = doc.phases.flatMap((p) => p.blocks.map((b) => b.id));
    assert.equal(new Set(ids).size, ids.length, `${lesson.slug} has duplicate block ids`);
  }
});

test("importLegacyLesson spot check: t101-m2-l1 (You're the GM) maps briefing/learn/decision content", () => {
  const lesson = lessons.find((l) => l.id === "t101-m2-l1");
  assert.ok(lesson);
  const doc = importLegacyLesson(lesson!);

  assert.equal(doc.meta.title, "You’re the GM");
  assert.equal(doc.meta.estMinutes, 16);
  assert.ok(metaTags(doc).includes("Scarcity"));
  assert.ok(metaTags(doc).includes(IMPORTED_DRAFT_TAG));

  const briefing = doc.phases[0];
  // marker + heading + case number (text) + role callout + central question heading + N situation paragraphs (text) + overview (text)
  const textBlocks = briefing.blocks.filter((b) => b.type === "text");
  // case-number + situation paragraphs + overview
  assert.equal(textBlocks.length, 1 + lesson!.situation.length + (lesson!.overview ? 1 : 0));

  const learn = doc.phases[1];
  // Learn phase callouts = needToKnow terms + one "Learning Outcomes" summary callout.
  const learnCallouts = learn.blocks.filter((b) => b.type === "callout");
  assert.equal(learnCallouts.length, lesson!.needToKnow.length + (lesson!.learningOutcomes.length > 0 ? 1 : 0));
  const evidenceStats = learn.blocks.filter((b) => b.type === "stat");
  assert.equal(evidenceStats.length, lesson!.evidence.length);

  const decision = doc.phases[2];
  const strategyBlock = decision.blocks.find((b) => b.type === "strategy_choice");
  assert.ok(strategyBlock);
  if (strategyBlock?.type === "strategy_choice") {
    assert.equal(strategyBlock.options.length, lesson!.decisionOptions.length);
    // Flagged for author review: all options equal points by default.
    const points = strategyBlock.options.map((o) => o.points);
    assert.ok(points.every((p) => p === points[0]));
  }
  const stakeholderTexts = decision.blocks.filter((b) => b.type === "text");
  assert.equal(stakeholderTexts.length, lesson!.stakeholders.length);

  const followup = doc.phases[3];
  const reflections = followup.blocks.filter((b) => b.type === "long_text");
  assert.equal(reflections.length, lesson!.discussionQuestions.length);
});

test("importLegacyLesson spot check: t201-m2-l1 (The League as a Business) has no podcast media -> no media block, has decision options", () => {
  const lesson = lessons.find((l) => l.id === "t201-m2-l1");
  assert.ok(lesson);
  const doc = importLegacyLesson(lesson!);

  const followup = doc.phases[3];
  const mediaBlocks = followup.blocks.filter((b) => b.type === "media");
  // t201-m2-l1 has a podcastUrl of null in legacy data (no explicit url field set) -> no media block.
  assert.equal(mediaBlocks.length, lesson!.podcastUrl ? 1 : 0);

  const decision = doc.phases[2];
  const strategyBlock = decision.blocks.find((b) => b.type === "strategy_choice");
  assert.ok(strategyBlock, "expected a strategy_choice block from decisionOptions");
});

test("importLegacyLesson: fully decisionOptions-less lesson falls back to a long_text placeholder in Decision", () => {
  const synthetic = {
    ...lessons[0],
    decisionOptions: [],
  };
  const doc = importLegacyLesson(synthetic);
  const decision = doc.phases[2];
  assert.equal(decision.blocks.length, synthetic.stakeholders.length + 1);
  const last = decision.blocks[decision.blocks.length - 1];
  assert.equal(last.type, "long_text");
});

test("idempotency/force logic (pure): re-import matching an already-imported draft is a no-op unless forced", () => {
  // Mirrors the CLI's decision function in isolation, without touching a DB.
  function shouldImport(existingDoc: unknown, force: boolean): boolean {
    if (!existingDoc) return true; // never imported before
    const parsed = LessonDocSchema.safeParse(existingDoc);
    if (!parsed.success) return true; // treat unparseable/empty draft as absent
    const stillImported = isImportedDraft(parsed.data);
    if (!stillImported) return false; // author has edited — never overwrite
    return force; // still a pristine imported draft — only overwrite with --force
  }

  const lesson = lessons[0];
  const doc = importLegacyLesson(lesson);
  const editedDoc = { ...doc, meta: { ...doc.meta, tags: (doc.meta.tags ?? []).filter((t) => t !== IMPORTED_DRAFT_TAG) } };

  assert.equal(shouldImport(undefined, false), true);
  assert.equal(shouldImport({}, false), true);
  assert.equal(shouldImport(doc, false), false, "already-imported draft, no --force -> skip");
  assert.equal(shouldImport(doc, true), true, "already-imported draft, --force -> overwrite");
  assert.equal(shouldImport(editedDoc, false), false, "author-edited draft, no --force -> never overwrite");
  assert.equal(shouldImport(editedDoc, true), false, "author-edited draft, --force -> still never overwrite");
});
