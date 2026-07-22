import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../scripts/migrate-people-work-os.ts", import.meta.url), "utf8");
const actions = readFileSync(new URL("../app/actions/people-work.ts", import.meta.url), "utf8");
const tasksPage = readFileSync(new URL("../app/app/tasks/page.tsx", import.meta.url), "utf8");
const learnMigrations = readFileSync(new URL("../scripts/run-migrations.ts", import.meta.url), "utf8");

test("independent lifecycles and optional positions are frozen into the migration", () => {
  assert.match(migration, /identity_status IN \('active','inactive','alumni','removed'\)/);
  assert.match(migration, /lifecycle_status IN\s*\('applied','screening','interviewing','decision','accepted','rejected','withdrawn'\)/);
  assert.match(migration, /status IN \('activating','active','paused','ended','revoked'\)/);
  assert.match(migration, /position_id text REFERENCES org_positions\(id\)/);
});

test("engagements, eligibility evidence, and capability denial have database primitives", () => {
  assert.match(migration, /engagement_type IN \('volunteer','employee','contractor','other'\)/);
  assert.match(migration, /person_requirement_evidence/);
  assert.match(migration, /status IN \('pending','satisfied','expired','waived','rejected'\)/);
  assert.match(migration, /app_role_capabilities/);
});

test("requisitions and immutable opening/process versions retain historical truth", () => {
  assert.match(migration, /target_headcount integer NOT NULL CHECK \(target_headcount > 0\)/);
  assert.match(migration, /opening_version_id text NOT NULL REFERENCES opening_versions/);
  assert.match(migration, /process_version_id text NOT NULL REFERENCES hiring_process_versions/);
  assert.match(migration, /Published versions are immutable/);
});

test("application transitions use locks, revisions, append-only events, and no-limbo constraints", () => {
  assert.match(actions, /FOR UPDATE/);
  assert.match(actions, /revision = revision \+ 1/);
  assert.match(actions, /application_stage_events/);
  assert.match(migration, /next_action IS NOT NULL OR waiting_on IS NOT NULL OR lifecycle_status IN/);
});

test("scheduling and communication cover reschedule, cancellation, no-show, failure, and retry", () => {
  for (const state of ["needs_scheduling", "scheduled", "rescheduled", "completed", "canceled", "no_show"]) {
    assert.match(migration, new RegExp(`'${state}'`));
  }
  assert.match(actions, /retryCandidateCommunication/);
  assert.match(actions, /queueCandidateCommunication/);
});

test("Work separates owner and doer and keeps submissions, reviews, deadlines, cancellation, and evidence", () => {
  assert.match(migration, /doer_user_id/);
  assert.match(migration, /CREATE TABLE work_submissions/);
  assert.match(migration, /CREATE TABLE work_reviews/);
  assert.match(actions, /due_date_changed/);
  assert.match(migration, /'canceled'/);
  for (const dimension of ["output", "reliability", "quality", "impact"]) {
    assert.match(migration, new RegExp(`'${dimension}'`));
  }
});

test("migration records ambiguous identities and duplicate active application conflicts before stopping", () => {
  assert.match(migration, /people_work_migration_conflicts/);
  assert.match(migration, /ambiguous_identity/);
  assert.match(migration, /duplicate_active_application/);
});

test("legacy instructor applications cannot violate the non-null answers contract", () => {
  assert.match(migration, /COALESCE\(i\.answers, '\{\}'\)/);
});

test("new hiring packages reference the seeded scorecard version ids", () => {
  assert.match(actions, /scv-instructor-interview-v1/);
  assert.match(actions, /scv-mini-teach-v1/);
  assert.doesNotMatch(actions, /["']sc-interview-v1["']/);
  assert.doesNotMatch(actions, /["']sc-mini-v1["']/);
});

test("review-required Work has the canonical staff submission controls", () => {
  assert.match(tasksPage, /SubmitWorkControls/);
  assert.match(tasksPage, /item\.reviewRequired/);
  assert.match(tasksPage, /item\.doerUserId === me\.id/);
  assert.match(tasksPage, /revision_requested/);
});

test("approval resolves a canonical Person before inserting performance evidence", () => {
  assert.match(actions, /SELECT id, name, email FROM users WHERE id = \? FOR UPDATE/);
  assert.match(actions, /identity_ambiguous/);
  assert.match(actions, /identity_missing/);
  assert.match(actions, /INSERT INTO people \(id, name, email, phone, user_id, identity_status/);
  assert.doesNotMatch(actions, /\.run\(`pe-[^\n]+`, submission\.person_id/);
});

test("Playbook and People runners share a backward-compatible migration ledger", () => {
  for (const source of [migration, learnMigrations]) {
    assert.match(source, /ADD COLUMN IF NOT EXISTS id text/);
    assert.match(source, /ADD COLUMN IF NOT EXISTS key text/);
    assert.match(source, /SET id = key WHERE id IS NULL/);
    assert.match(source, /SET key = id WHERE key IS NULL/);
    assert.match(source, /INSERT INTO schema_migrations \(id, key, applied_at\)/);
  }
});
