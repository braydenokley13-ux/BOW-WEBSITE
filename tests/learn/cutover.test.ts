import { test } from "node:test";
import assert from "node:assert/strict";
import { isLearnCutoverEnabled } from "../../lib/learn/cutover";
import { navForRole } from "../../lib/navigation/catalog";
import { readFileSync } from "node:fs";

const cutoverSource = readFileSync(new URL("../../lib/learn/cutover.ts", import.meta.url), "utf8");
const cutoverMigration = readFileSync(new URL("../../scripts/migrations/009_runtime_feature_flags.sql", import.meta.url), "utf8");

test("learn cutover is explicit opt-in and fails safely", () => {
  assert.equal(isLearnCutoverEnabled(undefined), false);
  assert.equal(isLearnCutoverEnabled(""), false);
  assert.equal(isLearnCutoverEnabled("off"), false);
  assert.equal(isLearnCutoverEnabled("1"), false);
  assert.equal(isLearnCutoverEnabled("invalid"), false);
  assert.equal(isLearnCutoverEnabled("on"), true);
  assert.equal(isLearnCutoverEnabled(" ON "), true);
});

test("learn cutover is request-time and database-backed rather than a build-time constant", () => {
  assert.doesNotMatch(cutoverSource, /export const CUTOVER_ENABLED/);
  assert.match(cutoverSource, /app_feature_flags/);
  assert.match(cutoverMigration, /INSERT INTO app_feature_flags/);
  assert.match(cutoverMigration, /app_feature_flag_events/);
});

test("student navigation always points at /dashboard — cutover is permanent, no branching", () => {
  // Stage 1: the learn cutover is a permanent product decision, not a runtime
  // toggle. navForRole still accepts cutoverEnabled for call-site
  // compatibility but must ignore it entirely.
  const withFlagOff = navForRole("student", { cutoverEnabled: false });
  const withFlagOn = navForRole("student", { cutoverEnabled: true });
  const withNoFlag = navForRole("student");
  for (const nav of [withFlagOff, withFlagOn, withNoFlag]) {
    assert.equal(nav[0]?.kind, "link");
    assert.equal(nav[0]?.kind === "link" ? nav[0].href : "", "/dashboard");
  }
});
