import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../scripts/migrate-people-work-os.ts", import.meta.url), "utf8");
const actions = readFileSync(new URL("../app/actions/people-work.ts", import.meta.url), "utf8");

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
