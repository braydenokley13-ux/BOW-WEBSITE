import { test } from "node:test";
import assert from "node:assert/strict";
import { migrateLessonDoc, CURRENT_SCHEMA_VERSION } from "../../lib/learn/compat";

function validV1Doc() {
  return {
    schemaVersion: 1,
    meta: { title: "Compat Test" },
    variables: [],
    skills: [],
    phases: [{ id: "p1", kind: "Briefing", title: "Intro", blocks: [{ id: "b1", type: "text", body: "hi" }] }],
    scoring: {
      mode: "points",
      starThresholds: [50, 75, 90],
      xp: { base: 10, perStar: 5, firstCompletionBonus: 20 },
      badges: [],
    },
    results: {},
  };
}

test("migrateLessonDoc: passes through a current-version doc after validation", () => {
  const doc = migrateLessonDoc(validV1Doc());
  assert.equal(doc.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(doc.meta.title, "Compat Test");
});

test("migrateLessonDoc: rejects a doc with no schemaVersion", () => {
  const raw = validV1Doc() as Record<string, unknown>;
  delete raw.schemaVersion;
  assert.throws(() => migrateLessonDoc(raw));
});

test("migrateLessonDoc: rejects an unknown/future schemaVersion with no migrator", () => {
  const raw = { ...validV1Doc(), schemaVersion: 99 };
  assert.throws(() => migrateLessonDoc(raw), /newer than this build supports/);
});

test("migrateLessonDoc: still zod-validates after migration (garbage in, throws)", () => {
  assert.throws(() => migrateLessonDoc({ schemaVersion: 1, garbage: true }));
});
