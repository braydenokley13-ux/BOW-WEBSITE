import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../scripts/migrations/008_people_weekly_operations.sql", import.meta.url), "utf8");
const actions = readFileSync(new URL("../app/actions/people-operations.ts", import.meta.url), "utf8");
const loader = readFileSync(new URL("../lib/people-operations.ts", import.meta.url), "utf8");
const tasksPage = readFileSync(new URL("../app/app/tasks/page.tsx", import.meta.url), "utf8");
const managerPage = readFileSync(new URL("../app/app/people/page.tsx", import.meta.url), "utf8");
const personPage = readFileSync(new URL("../app/app/people/[id]/page.tsx", import.meta.url), "utf8");
const founderPage = readFileSync(new URL("../app/app/page.tsx", import.meta.url), "utf8");

test("weekly execution links to canonical Work instead of creating weekly tasks", () => {
  assert.match(migration, /CREATE TABLE people_weekly_cycle_tasks/);
  assert.match(migration, /task_id text NOT NULL REFERENCES tasks\(id\)/);
  assert.doesNotMatch(migration, /CREATE TABLE weekly_tasks/);
  assert.match(tasksPage, /WeeklyCommitmentEditor/);
  assert.match(tasksPage, /item\.ownerUserId === me\.id \|\| item\.doerUserId === me\.id/);
});

test("weekly close derives evidence and preserves recovery history", () => {
  assert.match(actions, /deriveWeeklySummary/);
  assert.match(actions, /assessment: "met" \| "partially_met" \| "missed"/);
  assert.match(actions, /commitment_missed/);
  assert.match(actions, /recovery_requested/);
  assert.match(migration, /dedupe_key text UNIQUE/);
  assert.match(migration, /status text NOT NULL DEFAULT 'open' CHECK \(status IN \('open','closed'\)\)/);
});

test("manager attention is deterministic and keeps dimensions separate", () => {
  for (const signal of ["overdueWork", "blockedWork", "waitingReview", "openAccountability", "pendingActivation"]) {
    assert.match(loader, new RegExp(signal));
  }
  for (const dimension of ["output", "reliability", "quality", "impact", "coachability"]) {
    assert.match(loader, new RegExp(dimension));
  }
  assert.doesNotMatch(loader, /personScore|performanceScore|overallScore/);
  assert.match(managerPage, /Who needs me\?/);
  assert.match(personPage, /magical human score/);
});

test("role authority is historical, human-controlled, and safely handed off", () => {
  assert.match(migration, /CREATE TABLE role_assignment_decisions/);
  assert.match(migration, /'manager_change'/);
  assert.match(actions, /Reassign these before ending the role/);
  assert.match(actions, /SELECT COUNT\(\*\) FROM responsibilities/);
  assert.match(actions, /SELECT COUNT\(\*\) FROM outcomes/);
  assert.match(actions, /SELECT COUNT\(\*\) FROM role_assignments WHERE manager_assignment_id/);
  assert.match(actions, /WITH RECURSIVE manager_chain/);
  assert.match(actions, /manager must make role and autonomy decisions/i);
  assert.match(actions, /is_primary = true/);
});

test("Playbook training is a qualification seam, not duplicate learning progress", () => {
  assert.match(actions, /source_type = 'learn_lesson'/);
  assert.match(actions, /learn_lesson_mastery/);
  assert.doesNotMatch(migration, /CREATE TABLE people_lesson_progress/);
  assert.match(personPage, /playbookLessons/);
});

test("manager scope excludes students and activation decisions retain their reason", () => {
  assert.match(loader, /p\.identity_status = 'active'/);
  assert.match(loader, /account\.role IN \('admin','growth','instructor'\)/);
  assert.match(migration, /decision_note text/);
  assert.match(actions, /decision_note = \?/);
});

test("founder view receives only people exceptions while normal work stays below", () => {
  assert.match(founderPage, /candidate\.standing === "at_risk"/);
  assert.match(founderPage, /peopleOperations\.people\.filter/);
  assert.match(founderPage, /People requiring attention/);
});
