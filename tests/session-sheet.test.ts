import { test } from "node:test";
import assert from "node:assert/strict";
import {
  attendanceSummary,
  resolveSheetAction,
  resolveSheetPhase,
  safeMeetingLink,
} from "../lib/session-sheet-shared";
import { resolveAttendanceLock } from "../lib/session-sheet";
import { activeNavId, navForRole } from "../lib/navigation/catalog";

const HOUR = 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

/* ---------------- when the sheet thinks it is ---------------- */

test("the sheet leads with the moment, not the calendar", () => {
  const base = { startsAt: NOW, endsAt: NOW + 90 * 60 * 1000, status: "scheduled", finalized: false };

  assert.equal(resolveSheetPhase({ ...base, now: NOW - 6 * HOUR }), "upcoming");
  assert.equal(resolveSheetPhase({ ...base, now: NOW - 30 * 60 * 1000 }), "soon");
  assert.equal(resolveSheetPhase({ ...base, now: NOW + 10 * 60 * 1000 }), "live");
  assert.equal(resolveSheetPhase({ ...base, now: NOW + 3 * HOUR }), "ended");
});

test("a finalized or cancelled session says so before anything else", () => {
  assert.equal(
    resolveSheetPhase({ startsAt: NOW, endsAt: null, status: "scheduled", finalized: true, now: NOW }),
    "done",
  );
  // Cancelled outranks finalized: it did not happen, so "complete" would lie.
  assert.equal(
    resolveSheetPhase({ startsAt: NOW, endsAt: null, status: "cancelled", finalized: true, now: NOW }),
    "cancelled",
  );
});

test("a session with no end time still ends", () => {
  const late = resolveSheetPhase({ startsAt: NOW, endsAt: null, status: "scheduled", finalized: false, now: NOW + 4 * HOUR });
  assert.equal(late, "ended");
});

/* ---------------- what the sheet will let you touch ---------------- */

test("attendance is locked for exactly the reasons the server enforces", () => {
  const open = {
    sessionStatus: "scheduled",
    classStatus: "active",
    startsAt: NOW - HOUR,
    finalized: false,
    rosterSize: 3,
    now: NOW,
  };
  assert.deepEqual(resolveAttendanceLock(open), { locked: false });

  /** The lock reason, or null when attendance is open. */
  const reason = (patch: Partial<typeof open>): string | null => {
    const lock = resolveAttendanceLock({ ...open, ...patch });
    return lock.locked ? lock.reason : null;
  };

  // Every one of these mirrors a guard in recordAttendance.
  assert.equal(reason({ startsAt: NOW + HOUR }), "not_started");
  assert.equal(reason({ finalized: true }), "finalized");
  assert.equal(reason({ classStatus: "completed" }), "delivery_closed");
  assert.equal(reason({ rosterSize: 0 }), "no_roster");
  assert.equal(reason({ sessionStatus: "cancelled" }), "cancelled");
});

test("a cancelled session is never described as merely not started", () => {
  const lock = resolveAttendanceLock({
    sessionStatus: "cancelled",
    classStatus: "active",
    startsAt: NOW + 5 * HOUR,
    finalized: false,
    rosterSize: 4,
    now: NOW,
  });
  assert.equal(lock.locked && lock.reason, "cancelled");
});

/* ---------------- the one button ---------------- */

test("the sheet shows one action at a time, in the order the server accepts them", () => {
  const open = { lock: { locked: false as const }, finalized: false };

  // Nothing marked: save is the next step, but it cannot fire yet.
  const fresh = resolveSheetAction({ ...open, marked: 0, total: 4, dirty: false });
  assert.equal(fresh.kind, "save-attendance");
  assert.equal(fresh.disabled, true);
  assert.equal(fresh.hint, "4 still to mark");

  // Everything marked but unsaved: save, enabled.
  const ready = resolveSheetAction({ ...open, marked: 4, total: 4, dirty: true });
  assert.equal(ready.kind, "save-attendance");
  assert.equal(ready.disabled, false);

  // Saved: completing is the only thing left.
  const complete = resolveSheetAction({ ...open, marked: 4, total: 4, dirty: false });
  assert.equal(complete.kind, "complete");
  assert.equal(complete.disabled, false);
});

test("a locked or finished sheet offers no action, and says why", () => {
  const locked = resolveSheetAction({
    lock: { locked: true, reason: "not_started", label: "Attendance opens when the session starts." },
    marked: 0,
    total: 3,
    dirty: false,
    finalized: false,
  });
  assert.equal(locked.kind, "none");
  assert.equal(locked.disabled, true);
  assert.equal(locked.hint, "Attendance opens when the session starts.");

  const done = resolveSheetAction({ lock: { locked: false }, marked: 3, total: 3, dirty: false, finalized: true });
  assert.equal(done.kind, "none");
  assert.equal(done.label, "Session complete");
});

/* ---------------- the roster line ---------------- */

test("the roster summary counts in the words an instructor would use", () => {
  assert.equal(attendanceSummary(["present", "present", "late", "absent"]), "2 here · 1 late · 1 out");
  assert.equal(attendanceSummary(["present", null, null]), "1 here · 2 not marked");
  assert.equal(attendanceSummary(["excused"]), "1 excused");
  assert.equal(attendanceSummary([]), "");
});

/* ---------------- the meeting link is a link, or it is text ---------------- */

test("only an http(s) meeting link is ever rendered as one", () => {
  assert.equal(safeMeetingLink("https://meet.example.com/bow"), "https://meet.example.com/bow");
  assert.equal(safeMeetingLink("http://meet.example.com/bow"), "http://meet.example.com/bow");
  assert.equal(safeMeetingLink("  https://meet.example.com/bow  "), "https://meet.example.com/bow");
  assert.equal(safeMeetingLink("javascript:alert(1)"), null);
  assert.equal(safeMeetingLink("data:text/html,<script>alert(1)</script>"), null);
  assert.equal(safeMeetingLink("Gym B, second floor"), null);
  assert.equal(safeMeetingLink(""), null);
  assert.equal(safeMeetingLink(null), null);
});

/* ---------------- one address, both audiences ---------------- */

test("the session sheet resolves to Programs for staff and Classes for an instructor", () => {
  assert.equal(activeNavId("/app/session/abc123", navForRole("admin")), "programs");
  assert.equal(
    activeNavId("/app/session/abc123", navForRole("instructor", { instructorCanDeliver: true })),
    "instructor-classes",
  );
});
