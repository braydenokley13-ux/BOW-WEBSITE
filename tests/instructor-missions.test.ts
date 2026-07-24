import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveInstructorActivationExceptions,
  isMissionArea,
  isMissionCadence,
  isMissionCompletionOutcome,
  isMissionRelatedEntity,
  missionAreaMeta,
  missionIsOverdue,
  type InstructorActivationRow,
} from "@/lib/instructor-missions-shared";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

function row(overrides: Partial<InstructorActivationRow>): InstructorActivationRow {
  return {
    instructorId: overrides.instructorId ?? "inst-1",
    personId: overrides.personId ?? "pfx-1",
    name: overrides.name ?? "Test Instructor",
    stage: overrides.stage ?? "active",
    eligible: overrides.eligible ?? true,
    onboardingStatus: overrides.onboardingStatus ?? "complete",
    createdAt: overrides.createdAt ?? NOW - 60 * DAY,
    decidedAt: overrides.decidedAt ?? null,
    hasActiveMission: overrides.hasActiveMission ?? false,
    currentAssignmentCount: overrides.currentAssignmentCount ?? 0,
    upcomingSessionCount: overrides.upcomingSessionCount ?? 0,
    lastActivityAt: overrides.lastActivityAt ?? NOW,
  };
}

test("accepted-but-not-activated is surfaced, severity escalates with age", () => {
  const fresh = deriveInstructorActivationExceptions([row({ stage: "accepted", decidedAt: NOW - 2 * DAY })], NOW);
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0].kind, "accepted_not_activated");
  assert.equal(fresh[0].severity, "high");

  const stale = deriveInstructorActivationExceptions([row({ stage: "accepted", decidedAt: NOW - 10 * DAY })], NOW);
  assert.equal(stale[0].severity, "critical");
});

test("onboarding surfaces only after the stall threshold", () => {
  const recent = deriveInstructorActivationExceptions([row({ stage: "onboarding", lastActivityAt: NOW - 5 * DAY })], NOW);
  assert.equal(recent.length, 0);

  const stalled = deriveInstructorActivationExceptions([row({ stage: "onboarding", lastActivityAt: NOW - 20 * DAY })], NOW);
  assert.equal(stalled.length, 1);
  assert.equal(stalled[0].kind, "onboarding_stalled");
});

test("eligible instructor with no assignment and no mission is 'ready but unused'", () => {
  const result = deriveInstructorActivationExceptions(
    [row({ stage: "eligible", currentAssignmentCount: 0, upcomingSessionCount: 0, hasActiveMission: false })],
    NOW,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].kind, "ready_without_assignment");
});

test("deployed active instructor without a mission is flagged (watch)", () => {
  const result = deriveInstructorActivationExceptions(
    [row({ stage: "active", currentAssignmentCount: 1, hasActiveMission: false, lastActivityAt: NOW - 3 * DAY })],
    NOW,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].kind, "active_without_mission");
  assert.equal(result[0].severity, "watch");
});

test("active instructor with a mission and an assignment raises nothing", () => {
  const result = deriveInstructorActivationExceptions(
    [row({ stage: "active", currentAssignmentCount: 1, hasActiveMission: true, lastActivityAt: NOW - 3 * DAY })],
    NOW,
  );
  assert.equal(result.length, 0);
});

test("dormant active instructor (deployed, has mission) is surfaced after 30 days", () => {
  const result = deriveInstructorActivationExceptions(
    [row({ stage: "active", currentAssignmentCount: 1, hasActiveMission: true, lastActivityAt: NOW - 45 * DAY })],
    NOW,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].kind, "dormant");
  assert.equal(result[0].severity, "watch");

  const longDormant = deriveInstructorActivationExceptions(
    [row({ stage: "active", currentAssignmentCount: 1, hasActiveMission: true, lastActivityAt: NOW - 70 * DAY })],
    NOW,
  );
  assert.equal(longDormant[0].severity, "high");
});

test("exactly one exception per instructor — acceptance outranks everything", () => {
  const result = deriveInstructorActivationExceptions(
    [row({ instructorId: "inst-x", stage: "accepted", hasActiveMission: false, currentAssignmentCount: 0 })],
    NOW,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].kind, "accepted_not_activated");
});

test("terminal-stage instructors raise nothing", () => {
  const result = deriveInstructorActivationExceptions(
    [row({ stage: "rejected" }), row({ stage: "inactive" }), row({ stage: "founder_review" })],
    NOW,
  );
  assert.equal(result.length, 0);
});

test("exceptions are ranked by score descending", () => {
  const result = deriveInstructorActivationExceptions(
    [
      row({ instructorId: "a", personId: "pa", name: "Watcher", stage: "active", currentAssignmentCount: 1, hasActiveMission: false, lastActivityAt: NOW - 2 * DAY }),
      row({ instructorId: "b", personId: "pb", name: "Accepted", stage: "accepted", decidedAt: NOW - 3 * DAY }),
    ],
    NOW,
  );
  assert.equal(result[0].kind, "accepted_not_activated");
  assert.equal(result[1].kind, "active_without_mission");
});

test("missionIsOverdue compares calendar days", () => {
  assert.equal(missionIsOverdue("2026-01-01", "2026-01-02"), true);
  assert.equal(missionIsOverdue("2026-01-02", "2026-01-02"), false);
  assert.equal(missionIsOverdue(null, "2026-01-02"), false);
});

test("missionAreaMeta returns real metadata and a safe fallback", () => {
  assert.equal(missionAreaMeta("instructor_recruitment").label, "Instructor recruitment");
  assert.equal(missionAreaMeta("mystery_area").label, "Mystery Area");
});

test("validators accept canonical values and reject junk", () => {
  assert.equal(isMissionArea("teaching"), true);
  assert.equal(isMissionArea("nope"), false);
  assert.equal(isMissionCadence("weekly"), true);
  assert.equal(isMissionCadence("hourly"), false);
  assert.equal(isMissionCompletionOutcome("delivered"), true);
  assert.equal(isMissionCompletionOutcome("great"), false);
  assert.equal(isMissionRelatedEntity("class"), true);
  assert.equal(isMissionRelatedEntity("student"), false);
});
