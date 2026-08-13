import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blockerAppliesAtStage,
  blockersApply,
  programStatusLabel,
  programStatusLine,
  scheduleLine,
  ROSTER_SOURCE_LABEL,
} from "../lib/partner-program-shared";

/* ---------------- the stage machine, in partner words ---------------- */

test("twelve internal stages collapse to the words a partner would use", () => {
  assert.equal(programStatusLabel("active"), "Running");
  assert.equal(programStatusLabel("ready_to_launch"), "Ready to start");
  assert.equal(programStatusLabel("completed"), "Finished");
  assert.equal(programStatusLabel("renewed"), "Finished");
  assert.equal(programStatusLabel("closed"), "Finished");
  assert.equal(programStatusLabel("renewal_review"), "Up for renewal");
  assert.equal(programStatusLabel("paused"), "On hold");
  // Everything before staffing is one thing to a partner: it is being planned.
  assert.equal(programStatusLabel("opportunity"), "Being planned");
  assert.equal(programStatusLabel("planning"), "Being planned");
  assert.equal(programStatusLabel("staffing"), "Being planned");
});

/* ---------------- when an unmade decision becomes a problem ---------------- */

test("nothing is a blocker while a Program is only being planned", () => {
  // Amber that appears the day a record is created is amber nobody reads.
  assert.equal(blockersApply("opportunity"), false);
  assert.equal(blockersApply("planning"), false);
});

test("the same unmade decision does block once somebody is trying to start", () => {
  for (const stage of ["staffing", "enrollment", "recruiting", "ready_to_launch", "active"]) {
    assert.equal(blockersApply(stage), true, stage);
  }
});

test("a finished or paused Program has nothing left to block", () => {
  for (const stage of ["completed", "renewal_review", "renewed", "closed", "paused"]) {
    assert.equal(blockersApply(stage), false, stage);
  }
});

/* ---------------- the one sentence at the top ---------------- */

test("a running Program counts sections and people, not percentages", () => {
  assert.equal(
    programStatusLine({ stage: "active", sections: 3, seatsTaken: 41, blockers: 0, startDate: "2026-09-01" }),
    "3 sections running · 41 enrolled",
  );
  assert.equal(
    programStatusLine({ stage: "active", sections: 1, seatsTaken: 12, blockers: 0, startDate: null }),
    "1 section running · 12 enrolled",
  );
});

test("a Program with nothing decided says so without calling it a failure", () => {
  const line = programStatusLine({ stage: "planning", sections: 0, seatsTaken: 0, blockers: 0, startDate: null });
  assert.match(line, /still being decided/i);
  assert.doesNotMatch(line, /missing|incomplete|blocked/i);
});

test("blockers, when they apply, are what the sentence leads with", () => {
  assert.equal(
    programStatusLine({ stage: "ready_to_launch", sections: 2, seatsTaken: 8, blockers: 1, startDate: "2026-09-01" }),
    "1 thing would stop this starting.",
  );
  assert.equal(
    programStatusLine({ stage: "ready_to_launch", sections: 2, seatsTaken: 8, blockers: 3, startDate: "2026-09-01" }),
    "3 things would stop this starting.",
  );
});

test("a clean Program that has not started yet leads with its date", () => {
  assert.equal(
    programStatusLine({ stage: "ready_to_launch", sections: 2, seatsTaken: 8, blockers: 0, startDate: "2026-09-01" }),
    "Ready to start 2026-09-01.",
  );
});

test("only the stage that means it may claim a Program is ready to start", () => {
  // A date on a Program still being planned is one somebody pencilled in.
  assert.equal(
    programStatusLine({ stage: "launching", sections: 1, seatsTaken: 0, blockers: 0, startDate: "2026-09-03" }),
    "Planned to start 2026-09-03.",
  );
  assert.equal(
    programStatusLine({ stage: "planning", sections: 2, seatsTaken: 0, blockers: 0, startDate: "2026-09-03" }),
    "Planned to start 2026-09-03.",
  );
});

/* ---------------- roster source is a real fact, not a field ---------------- */

test("who supplies the roster is stated in words, both ways round", () => {
  assert.equal(ROSTER_SOURCE_LABEL.families, "Families register themselves");
  assert.equal(ROSTER_SOURCE_LABEL.partner, "The school sends the roster");
});

/* ---------------- the schedule line ---------------- */

test("a schedule reads as one line, and degrades to whatever is known", () => {
  assert.equal(
    scheduleLine({ label: "Tuesdays", startTime: "16:00", endTime: "17:30" }),
    "Tuesdays · 4:00 PM–5:30 PM",
  );
  assert.equal(scheduleLine({ label: "Tuesdays", startTime: null, endTime: null }), "Tuesdays");
  assert.equal(scheduleLine({ label: null, startTime: "09:00", endTime: "10:00" }), "9:00 AM–10:00 AM");
  assert.equal(scheduleLine({ label: null, startTime: null, endTime: null }), null);
});

test("midnight and noon are not rendered as 0 o'clock", () => {
  assert.equal(scheduleLine({ label: null, startTime: "00:30", endTime: "12:15" }), "12:30 AM–12:15 PM");
});

/* ---------------- amber has to survive launch to keep meaning something ---------------- */

test("a running Program is only told about things that affect the room", () => {
  // Children are in the room. A launch-checklist field being empty is not news.
  for (const key of ["partner_confirmation", "contact", "schedule", "owner", "location", "enrollment"]) {
    assert.equal(blockerAppliesAtStage(key, "active"), false, key);
  }
  // These still bite: a child who cannot legally be there, an over-full class,
  // no eligible instructor, an unanswered offer, no session on the calendar.
  for (const key of ["forms", "capacity", "eligible_instructor", "assignment_response", "first_session"]) {
    assert.equal(blockerAppliesAtStage(key, "active"), true, key);
  }
});

test("before launch, the whole checklist applies", () => {
  for (const key of ["partner_confirmation", "contact", "schedule", "forms"]) {
    assert.equal(blockerAppliesAtStage(key, "ready_to_launch"), true, key);
  }
});

test("nothing blocks a Program nobody is trying to start, or one already finished", () => {
  for (const stage of ["planning", "opportunity", "completed", "closed", "paused"]) {
    assert.equal(blockerAppliesAtStage("forms", stage), false, stage);
  }
});
