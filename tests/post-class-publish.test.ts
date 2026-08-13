/* ============================================================
 * Post a Class — schedule generation and publish safety.
 *
 * The schedule cases are pure and always run. The publish cases need a real
 * Postgres (npm run db:setup) because the guarantee under test is a database
 * one: the partial unique index on programs.request_key is what makes a
 * retried publish impossible to double-post, and no in-memory fake can prove
 * that.
 *
 * Skips cleanly when POSTGRES_URL is not local.
 * ============================================================ */

import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

import {
  buildRun,
  gradeRangeLabel,
  gradeRangeValue,
  keptDates,
  nextWeekdayAfter,
  runSummary,
  weekdayOf,
} from "../lib/class-schedule";

/* ---------------------------------------------------------------- */
/* Schedule generation (pure)                                        */
/* ---------------------------------------------------------------- */

test("a run is the requested number of weekly sessions", () => {
  const run = buildRun({ firstDate: "2026-09-15", weeks: 6 });
  assert.equal(keptDates(run).length, 6);
  assert.deepEqual(keptDates(run), [
    "2026-09-15",
    "2026-09-22",
    "2026-09-29",
    "2026-10-06",
    "2026-10-13",
    "2026-10-20",
  ]);
});

test("skipping a date extends the run so the session count holds", () => {
  const run = buildRun({ firstDate: "2026-09-15", weeks: 6, skipped: ["2026-10-13"] });
  const kept = keptDates(run);

  assert.equal(kept.length, 6, "a skipped holiday must not shorten the course");
  assert.ok(!kept.includes("2026-10-13"), "the skipped date must not become a session");
  assert.equal(kept[kept.length - 1], "2026-10-27", "the run extends one week past where it would have ended");
  // The row is still listed, so the composer can show it struck through.
  assert.equal(run.find((row) => row.date === "2026-10-13")?.skipped, true);
});

test("several skipped dates each push the run one more week", () => {
  const run = buildRun({ firstDate: "2026-09-15", weeks: 4, skipped: ["2026-09-22", "2026-10-06"] });
  const kept = keptDates(run);
  assert.equal(kept.length, 4);
  assert.deepEqual(kept, ["2026-09-15", "2026-09-29", "2026-10-13", "2026-10-20"]);
});

test("lesson indexes count only the sessions that run", () => {
  const run = buildRun({ firstDate: "2026-09-15", weeks: 3, skipped: ["2026-09-22"] });
  assert.deepEqual(
    run.map((row) => row.lessonIndex),
    [0, -1, 1, 2],
    "a skipped date teaches nothing, so it holds no lesson",
  );
});

test("a skipped run never loops forever", () => {
  // Every candidate struck out: the ceiling has to stop it.
  const skipped = Array.from({ length: 40 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 15) + i * 7 * 86400000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  });
  const run = buildRun({ firstDate: "2026-09-15", weeks: 6, skipped });
  assert.equal(keptDates(run).length, 0);
  assert.ok(run.length <= 18);
});

test("the human-readable line is the one the design promises", () => {
  const run = buildRun({ firstDate: "2026-09-15", weeks: 6, skipped: ["2026-10-13"] });
  assert.equal(runSummary(run, "18:30", "19:15"), "6 sessions · Tue Sep 15 → Oct 27 · 6:30–7:15 PM");
});

test("weekday helpers are Monday-first and never land on the same day", () => {
  assert.equal(weekdayOf("2026-09-15"), 1, "2026-09-15 is a Tuesday");
  const next = nextWeekdayAfter("2026-09-15", 1);
  assert.equal(next, "2026-09-22", "next Tuesday after a Tuesday is a week later, not today");
});

test("invalid calendar dates produce no run rather than rolling over", () => {
  assert.deepEqual(buildRun({ firstDate: "2026-02-30", weeks: 4 }), []);
  assert.deepEqual(buildRun({ firstDate: "not-a-date", weeks: 4 }), []);
});

test("the stored grade range is bare, because every public surface adds the word", () => {
  // programs.grade_range is rendered as "Grades {gradeRange}". Storing the word
  // as well is what produced "Grades Grades 5–8" on the live card.
  assert.equal(gradeRangeValue([5, 6, 7, 8]), "5–8");
  assert.equal(gradeRangeValue([5, 7]), "5, 7");
  assert.equal(gradeRangeValue([6]), "6");
  assert.equal(gradeRangeValue([]), null);
});

test("grade labels collapse to a range only when contiguous", () => {
  assert.equal(gradeRangeLabel([5, 6, 7, 8]), "Grades 5–8");
  assert.equal(gradeRangeLabel([8, 5, 7, 6]), "Grades 5–8");
  assert.equal(gradeRangeLabel([5, 7]), "Grades 5, 7");
  assert.equal(gradeRangeLabel([6]), "Grade 6");
  assert.equal(gradeRangeLabel([]), null);
});

/* ---------------------------------------------------------------- */
/* Publish (real database)                                           */
/* ---------------------------------------------------------------- */

const CONNECTION = (
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL ??
  ""
).trim();

function isLocal(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

const enabled = Boolean(CONNECTION) && isLocal(CONNECTION);
const dbTest = enabled ? test : test.skip;

if (!enabled) {
  test("post-class publish tests skipped (no local POSTGRES_URL)", () => assert.ok(true));
}

const ACTOR = { id: "usr-post-class-test", name: "Test Founder" };

function futureDate(daysAhead: number): string {
  const d = new Date(Date.now() + daysAhead * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function draft(overrides: Record<string, unknown> = {}) {
  return {
    curriculumId: null,
    title: `Test Class ${randomUUID().slice(0, 8)}`,
    grades: [5, 6, 7, 8],
    scheduleDay: 1,
    startTime: "18:30",
    endTime: "19:15",
    timeZone: "America/New_York",
    firstDate: futureDate(30),
    weeks: 6,
    skipped: [] as string[],
    capacity: 12,
    instructorId: null,
    meetingLink: null,
    requestKey: `test-${randomUUID().replace(/-/g, "")}`,
    ...overrides,
  };
}

dbTest("publishing creates the program, the class, every session and the public listing", async () => {
  const { publishClass } = await import("@/lib/post-class");
  const { getDb } = await import("@/lib/db");
  const db = getDb();

  const input = draft({ weeks: 4 });
  const result = await publishClass(ACTOR, input);
  assert.equal(result.ok, true, result.error);
  assert.ok(result.classId);

  const cls = (await db.prepare("SELECT * FROM classes WHERE id = ?").get(result.classId!)) as Record<string, unknown>;
  assert.equal(cls.title, input.title);
  assert.equal(cls.status, "active", "attendance can only be recorded while a class is active");
  assert.equal(Number(cls.capacity), 12);

  const program = (await db.prepare("SELECT * FROM programs WHERE id = ?").get(cls.program_id)) as Record<string, unknown>;
  // Both publication models, or the class is either invisible or unjoinable.
  assert.equal(program.publication_status, "published", "the CMS pair renders the public card");
  assert.equal(program.registration_status, "registration_open");
  assert.equal(program.is_public, true, "the engine pair is what decideSeat reads");
  assert.equal(program.public_status, "open");
  assert.equal(program.waitlist_mode, "automatic", "a full class must hand over to the waitlist engine");
  assert.equal(program.full_capacity_behavior, "waitlist");
  assert.equal(program.registration_mode, "immediate");
  assert.ok(program.public_slug, "a listing with no slug has no address");
  assert.equal(Number(program.grade_min), 5);
  assert.equal(Number(program.grade_max), 8);

  const sessions = (await db
    .prepare("SELECT session_on FROM class_sessions WHERE class_id = ? ORDER BY session_date")
    .all(result.classId!)) as { session_on: string }[];
  assert.equal(sessions.length, 4);
  assert.equal(sessions[0].session_on, input.firstDate);
});

dbTest("a retried publish returns the same class instead of a second one", async () => {
  const { publishClass } = await import("@/lib/post-class");
  const { getDb } = await import("@/lib/db");

  const input = draft();
  const first = await publishClass(ACTOR, input);
  assert.equal(first.ok, true, first.error);

  // Same request key: the network dropped, the founder tapped Publish again.
  const second = await publishClass(ACTOR, input);
  assert.equal(second.ok, true, second.error);
  assert.equal(second.classId, first.classId, "a retry must resolve to the class already published");
  assert.equal(second.replayed, true);

  const count = (await getDb()
    .prepare("SELECT COUNT(*) AS n FROM programs WHERE request_key = ?")
    .get(`post-class:${input.requestKey}`)) as { n: string | number };
  assert.equal(Number(count.n), 1, "exactly one program may exist per request key");
});

dbTest("two concurrent publishes of the same request key still produce one class", async () => {
  const { publishClass } = await import("@/lib/post-class");
  const { getDb } = await import("@/lib/db");

  const input = draft();
  // Both start before either commits — the race the unique index exists for.
  const [a, b] = await Promise.all([publishClass(ACTOR, input), publishClass(ACTOR, input)]);

  assert.equal(a.ok, true, a.error);
  assert.equal(b.ok, true, b.error);
  assert.equal(a.classId, b.classId, "both callers must be told about the same class");

  const programs = (await getDb()
    .prepare("SELECT COUNT(*) AS n FROM programs WHERE request_key = ?")
    .get(`post-class:${input.requestKey}`)) as { n: string | number };
  assert.equal(Number(programs.n), 1);

  const classes = (await getDb()
    .prepare("SELECT COUNT(*) AS n FROM classes WHERE program_id = (SELECT id FROM programs WHERE request_key = ?)")
    .get(`post-class:${input.requestKey}`)) as { n: string | number };
  assert.equal(Number(classes.n), 1, "one program must not accumulate duplicate delivery classes");
});

dbTest("a first session in the past is refused in plain words", async () => {
  const { publishClass } = await import("@/lib/post-class");
  const result = await publishClass(ACTOR, draft({ firstDate: "2020-08-05" }));
  assert.equal(result.ok, false);
  assert.equal(result.field, "firstDate");
  assert.match(result.error ?? "", /already happened/);
});

dbTest("a class with no title is refused, and nothing is written", async () => {
  const { publishClass } = await import("@/lib/post-class");
  const { getDb } = await import("@/lib/db");
  const input = draft({ title: "   " });

  const result = await publishClass(ACTOR, input);
  assert.equal(result.ok, false);
  assert.equal(result.field, "title");

  const row = await getDb()
    .prepare("SELECT 1 FROM programs WHERE request_key = ?")
    .get(`post-class:${input.requestKey}`);
  assert.equal(row, undefined, "a rejected publish must leave no program behind");
});

dbTest("skipped dates reach the database as an extended run", async () => {
  const { publishClass } = await import("@/lib/post-class");
  const { getDb } = await import("@/lib/db");

  const first = futureDate(30);
  const skip = futureDate(44); // the third session
  const result = await publishClass(ACTOR, draft({ weeks: 4, firstDate: first, skipped: [skip] }));
  assert.equal(result.ok, true, result.error);

  const sessions = (await getDb()
    .prepare("SELECT session_on FROM class_sessions WHERE class_id = ? ORDER BY session_date")
    .all(result.classId!)) as { session_on: string }[];

  assert.equal(sessions.length, 4, "the run still delivers four sessions");
  assert.ok(!sessions.some((s) => s.session_on === skip), "the skipped date was not created");
  assert.equal(sessions[3].session_on, futureDate(58), "the run ends a week later than it otherwise would");
});

dbTest("a published class is registerable through the canonical family wizard", async () => {
  const { publishClass } = await import("@/lib/post-class");
  const { getPublicProgramBySlug } = await import("@/lib/cms/offerings");
  const { getDb } = await import("@/lib/db");

  const result = await publishClass(ACTOR, draft());
  assert.equal(result.ok, true, result.error);

  const program = (await getDb()
    .prepare("SELECT p.id, p.public_slug FROM programs p JOIN classes c ON c.program_id = p.id WHERE c.id = ?")
    .get(result.classId!)) as { id: string; public_slug: string };

  const published = await getPublicProgramBySlug(program.public_slug);
  assert.ok(published, "a posted class must be findable at its public address");
  assert.equal(published!.cta.behavior, "register");
  assert.equal(
    published!.cta.href,
    `/programs/register?program=${program.id}`,
    "the register CTA must reach the wizard that locks the class row and runs the waitlist",
  );
});

dbTest("the primary class for a published program is the one families are placed into", async () => {
  const { publishClass } = await import("@/lib/post-class");
  const { primaryClassFor } = await import("@/lib/enrollment");
  const { getDb } = await import("@/lib/db");

  const result = await publishClass(ACTOR, draft());
  assert.equal(result.ok, true, result.error);

  const program = (await getDb()
    .prepare("SELECT program_id FROM classes WHERE id = ?")
    .get(result.classId!)) as { program_id: string };

  const primary = await primaryClassFor(program.program_id);
  assert.ok(primary, "registration has nowhere to place a student without a primary class");
  assert.equal(primary!.id, result.classId, "registrations must land on the class the composer created");
  assert.equal(primary!.capacity, 12);
});

dbTest("publishing without an instructor record still works", async () => {
  const { publishClass } = await import("@/lib/post-class");
  const { getDb } = await import("@/lib/db");

  // ACTOR has no instructors row, which is the founder's own situation.
  const result = await publishClass(ACTOR, draft());
  assert.equal(result.ok, true, result.error);

  const cls = (await getDb().prepare("SELECT lead_instructor_id FROM classes WHERE id = ?").get(result.classId!)) as {
    lead_instructor_id: string | null;
  };
  assert.equal(cls.lead_instructor_id, null, "an unstaffed class is a normal state, not a failure");
});

/* ---------------------------------------------------------------- */
/* The class record's contextual primary action (pure)               */
/* ---------------------------------------------------------------- */

function primary(overrides: Record<string, unknown> = {}) {
  return {
    classId: "pfx-1",
    status: "active",
    isPublic: true,
    seatsRemaining: 3,
    todaySessionId: null,
    nextSessionId: "s2",
    exceptionCount: 0,
    publicSlug: "a-class",
    ended: false,
    ...overrides,
  };
}

test("a session today outranks everything else as the primary action", async () => {
  const { resolvePrimaryAction } = await import("../lib/class-record");
  // Even with an unresolved exception and seats to fill, the class is about to
  // happen — that is what the founder needs the button for.
  const action = resolvePrimaryAction(primary({ todaySessionId: "s9", exceptionCount: 4 }));
  assert.equal(action.kind, "open-session");
  assert.equal(action.href, "/app/session/s9");
});

test("a blocking exception outranks sharing the link", async () => {
  const { resolvePrimaryAction } = await import("../lib/class-record");
  assert.equal(resolvePrimaryAction(primary({ exceptionCount: 1 })).kind, "resolve");
});

test("sharing is primary only while there are seats to fill", async () => {
  const { resolvePrimaryAction } = await import("../lib/class-record");
  assert.equal(resolvePrimaryAction(primary()).kind, "share");
  // Full: pushing the link harder would be the wrong advice.
  assert.equal(resolvePrimaryAction(primary({ seatsRemaining: 0 })).kind, "view-waitlist");
  // Not yet public: there is nothing to share.
  assert.equal(resolvePrimaryAction(primary({ isPublic: false })).kind, "open-registration");
  assert.equal(resolvePrimaryAction(primary({ status: "planning" })).kind, "open-registration");
});

test("a finished term offers closing the class, not sharing it", async () => {
  const { resolvePrimaryAction } = await import("../lib/class-record");
  assert.equal(resolvePrimaryAction(primary({ ended: true })).kind, "close");
});

test("seat labels collapse the engine's states into words an operator uses", async () => {
  const { seatLabel } = await import("../lib/class-record-shared");
  const now = 1_000_000_000_000;
  assert.equal(seatLabel("confirmed", null, now).label, "Confirmed");
  assert.equal(seatLabel("waitlisted", null, now).label, "Waitlist");
  assert.equal(seatLabel("under_review", null, now).label, "Needs review");
  assert.equal(seatLabel("offer_sent", now + 41 * 3600 * 1000, now).label, "Offer · 41h");
  assert.equal(seatLabel("offer_sent", now + 41 * 3600 * 1000, now).tone, "warning");
});
