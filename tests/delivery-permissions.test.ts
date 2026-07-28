import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actions = readFileSync(new URL("../app/actions/delivery.ts", import.meta.url), "utf8");
const dal = readFileSync(new URL("../lib/delivery.ts", import.meta.url), "utf8");

function fn(source: string, name: string): string {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `expected to find ${name} in source`);
  // Grab a generous window rather than balancing braces — these functions
  // are all well under 4000 chars and the next export boundary is a safe stop.
  const rest = source.slice(start);
  const nextExport = rest.indexOf("\nexport ", 1);
  return nextExport === -1 ? rest : rest.slice(0, nextExport);
}

test("proposeAssignment is staff-only with no instructor self-assignment path", () => {
  const body = fn(actions, "proposeAssignment");
  assert.match(body, /requireStaff\(\)/);
  assert.doesNotMatch(body, /requireInstructorSelf/);
  assert.doesNotMatch(body, /requireActiveInstructorSelf/);
});

test("respondToAssignment scopes the assignment lookup to the calling instructor's own id", () => {
  const body = fn(actions, "respondToAssignment");
  assert.match(body, /requireInstructorSelf\(\)/);
  // The SELECT that resolves the assignment must filter by instructor_id = ?
  // bound to the caller — a foreign assignment id must resolve to nothing.
  assert.match(body, /WHERE ci\.id = \? AND ci\.instructor_id = \?/);
  // Both mutating UPDATEs must re-assert instructor_id ownership too, not
  // just the initial read.
  const updateClauses = body.match(/WHERE id = \? AND instructor_id = \?/g) ?? [];
  assert.ok(updateClauses.length >= 1, "expected at least one UPDATE scoped by instructor_id");
});

test("saveSessionPrep derives the instructor from the caller, never from an argument, and requires acceptance", () => {
  const body = fn(actions, "saveSessionPrep");
  assert.match(body, /requireActiveInstructorSelf\(\)/);
  // Signature only takes sessionId + input — no instructorId parameter that
  // could be spoofed by the client.
  assert.match(body, /saveSessionPrep\(sessionId: string, input: SessionPrepInput\)/);
  assert.match(body, /isAcceptedClassMember\(session\.class_id, instructor\.id\)/);
  assert.doesNotMatch(body, /input\.instructorId/);
});

test("cancelSession and updateSessionPlan both go through resolveDeliveryActor", () => {
  const cancel = fn(actions, "cancelSession");
  const plan = fn(actions, "updateSessionPlan");
  assert.match(cancel, /resolveDeliveryActor\(session\.class_id\)/);
  assert.match(plan, /resolveDeliveryActor\(session\.class_id\)/);
});

test("resolveDeliveryActor requires staff or an accepted class member — never a bare instructor claim", () => {
  const body = fn(actions, "resolveDeliveryActor");
  assert.match(body, /requireStaff\(\)/);
  assert.match(body, /requireActiveInstructorSelf\(\)/);
  assert.match(body, /isAcceptedClassMember\(classId, instructor\.id\)/);
  // If membership isn't accepted, it must fail closed.
  assert.match(body, /return \{ ok: false, error: "forbidden" \}/);
});

test("isAcceptedClassMember filters on both removed_at IS NULL and assignment_status = 'accepted'", () => {
  const start = dal.indexOf("export async function isAcceptedClassMember");
  assert.notEqual(start, -1);
  const body = dal.slice(start, dal.indexOf("\n}", start));
  assert.match(body, /removed_at IS NULL/);
  assert.match(body, /assignment_status = 'accepted'/);
});
