import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveStanding,
  sortInbox,
  standingSentence,
  waitingLabel,
  type InboxItem,
} from "../lib/partner-desk-shared";

function item(patch: Partial<InboxItem>): InboxItem {
  return {
    key: patch.key ?? "k",
    kind: patch.kind ?? "inquiry",
    who: patch.who ?? "Someone",
    org: patch.org ?? null,
    organizationId: patch.organizationId ?? null,
    said: patch.said ?? null,
    at: patch.at ?? 0,
    waitingDays: patch.waitingDays ?? 0,
    email: patch.email ?? null,
    href: patch.href ?? null,
    inquiryId: patch.inquiryId ?? null,
    demoRequestId: patch.demoRequestId ?? null,
    taskId: patch.taskId ?? null,
    dueOn: patch.dueOn ?? null,
  };
}

/* ---------------- where a relationship actually is ---------------- */

test("a partner running classes is running, whatever else is true", () => {
  const { standing, label } = resolveStanding({
    status: "active",
    runningPrograms: 0,
    runningClasses: 2,
    finishedPrograms: 3,
  });
  assert.equal(standing, "running");
  assert.equal(label, "Running now");
});

test("Ramaz: a real partnership with nothing decided yet is Still deciding, not incomplete", () => {
  const { standing, label } = resolveStanding({
    status: "prospect",
    runningPrograms: 0,
    runningClasses: 0,
    finishedPrograms: 0,
  });
  assert.equal(standing, "scoping");
  assert.equal(label, "Still deciding");

  const sentence = standingSentence({
    standing,
    runningClasses: 0,
    finishedPrograms: 0,
    nextFollowUp: null,
  });
  // The sentence has to name the open questions as normal, not as gaps.
  assert.match(sentence, /Still deciding/);
  assert.match(sentence, /that is normal/i);
  assert.doesNotMatch(sentence, /missing|incomplete|required/i);
});

test("having run something before is a different situation from never having run anything", () => {
  const between = resolveStanding({ status: "active", runningPrograms: 0, runningClasses: 0, finishedPrograms: 2 });
  assert.equal(between.standing, "scoping");
  assert.equal(between.label, "Between programs");

  assert.match(
    standingSentence({ standing: "scoping", runningClasses: 0, finishedPrograms: 2, nextFollowUp: null }),
    /Between programs/,
  );
});

test("paused and closed outrank anything still running underneath them", () => {
  assert.equal(
    resolveStanding({ status: "paused", runningPrograms: 4, runningClasses: 4, finishedPrograms: 0 }).standing,
    "paused",
  );
  assert.equal(
    resolveStanding({ status: "closed", runningPrograms: 4, runningClasses: 4, finishedPrograms: 0 }).standing,
    "past",
  );
});

test("a running partner's sentence counts the classes, in words", () => {
  assert.equal(
    standingSentence({ standing: "running", runningClasses: 1, finishedPrograms: 0, nextFollowUp: null }),
    "1 class running.",
  );
  assert.equal(
    standingSentence({ standing: "running", runningClasses: 3, finishedPrograms: 0, nextFollowUp: null }),
    "3 classes running.",
  );
});

/* ---------------- the inbox order ---------------- */

test("the inbox is ordered by who has been waiting longest, regardless of kind", () => {
  const ordered = sortInbox([
    item({ key: "fresh-inquiry", kind: "inquiry", waitingDays: 0, at: 300 }),
    item({ key: "old-demo", kind: "demo_request", waitingDays: 9, at: 100 }),
    item({ key: "due-followup", kind: "follow_up", waitingDays: 2, at: 200 }),
  ]).map((row) => row.key);

  assert.deepEqual(ordered, ["old-demo", "due-followup", "fresh-inquiry"]);
});

test("ties break oldest first, so nothing can sit behind a same-day arrival forever", () => {
  const ordered = sortInbox([
    item({ key: "later", waitingDays: 1, at: 500 }),
    item({ key: "earlier", waitingDays: 1, at: 100 }),
  ]).map((row) => row.key);
  assert.deepEqual(ordered, ["earlier", "later"]);
});

test("sorting does not mutate the list it was given", () => {
  const input = [item({ key: "a", waitingDays: 0 }), item({ key: "b", waitingDays: 5 })];
  sortInbox(input);
  assert.deepEqual(input.map((row) => row.key), ["a", "b"]);
});

/* ---------------- how long ago ---------------- */

test("waiting is described in days, the unit follow-ups actually live in", () => {
  assert.equal(waitingLabel(4), "4 days ago");
  assert.equal(waitingLabel(1), "yesterday");
  assert.equal(waitingLabel(0), "today");
  assert.equal(waitingLabel(-1), "tomorrow");
  assert.equal(waitingLabel(-5), "in 5 days");
});
