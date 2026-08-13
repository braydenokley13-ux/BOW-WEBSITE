import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * V1 sweep invariants that are cheap to assert and expensive to notice by hand.
 *
 * Each of these was a real defect found by crawling the product as one thing:
 * three session pages against the same two actions, a Programs index naming a
 * posted class a "Program", and two page-level crashes from Postgres returning
 * bigint columns as strings.
 */

function read(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("a session has exactly one page — the legacy addresses only redirect", () => {
  for (const path of [
    "app/app/classes/[id]/sessions/[sid]/page.tsx",
    "app/app/teach/classes/[id]/sessions/[sid]/page.tsx",
  ]) {
    const source = read(path);
    assert.match(source, /redirect\(`\/app\/session\/\$\{sid\}`\)/, `${path} must redirect to the sheet`);
    // The duplicated workflow was two more pages calling recordAttendance and
    // submitSessionReport. Neither may grow one back.
    assert.doesNotMatch(source, /recordAttendance|submitSessionReport|SessionAttendanceForm/, path);
  }
});

test("the Programs index renders a posted class as a class", () => {
  const source = read("app/app/programs/page.tsx");
  assert.match(source, /directClassIdsByProgram/);
  assert.match(source, /\/app\/classes\/\$\{direct\.classId\}/);
});

test("a direct Program's own URL redirects to its class record", () => {
  const source = read("app/app/programs/[id]/page.tsx");
  assert.match(source, /directClassForProgram/);
  assert.match(source, /redirect\(`\/app\/classes\/\$\{directClassId\}`\)/);
});

test("Work and Regions no longer build a Date from a raw bigint column", () => {
  // Postgres returns bigint as a string; `new Date("1786032000000")` is Invalid
  // Date, and .toISOString() on it throws — which took both pages down.
  const tasks = read("app/app/tasks/page.tsx");
  assert.match(tasks, /coerceEpochMs/);
  assert.doesNotMatch(tasks, /new Date\(item\.(dueAt|completedAt)!?\)\.toISOString\(\)/);

  // And `leader.name` needs to be in the GROUP BY for Postgres to accept it.
  for (const path of ["app/app/regions/page.tsx", "app/app/regions/[id]/page.tsx"]) {
    assert.match(read(path), /GROUP BY [a-z]\.id, leader\.name/, path);
  }
});

test("no primary action is rendered as a permanently disabled button", () => {
  // A disabled primary reading "Open registration" is a control that does not
  // exist — the same fake capability the link-only toggle was cut for.
  for (const path of ["app/app/classes/[id]/page.tsx", "app/app/programs/[id]/page.tsx"]) {
    assert.doesNotMatch(read(path), /<Button variant="primary" disabled>/, path);
  }
});

test("the operating vocabulary has no internal nouns left on the primary surfaces", () => {
  const surfaces = [
    "app/app/page.tsx",
    "app/app/partners/page.tsx",
    "app/app/partners/[id]/page.tsx",
    "app/app/people/page.tsx",
    "app/app/curriculum/page.tsx",
    "app/app/curriculum/[id]/page.tsx",
    "app/app/classes/[id]/page.tsx",
    "app/app/session/[sid]/page.tsx",
  ];
  // Strip comments: these words are fine when explaining the architecture, and
  // wrong when a person has to read them on screen.
  const banned = /\b(Demand Inbox|Cohort|Opportunity stage|disposition)\b/;
  for (const path of surfaces) {
    const withoutComments = read(path)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(withoutComments, banned, path);
  }
});
