import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { getSqlLearn } from "../lib/db-sql";
import { listAuthoredTracks, listCourseLessons, listCourseResources, listCourses } from "../lib/curriculum-courses";

/* ============================================================
 * Build once, run everywhere — and the link that makes it possible.
 *
 * These run against a real Postgres: the claim is about the join between the
 * ops course (`curricula`) and the authored track (`learn_tracks`), which is
 * exactly the thing migration 027 fills in.
 * ============================================================ */

const suffix = randomUUID().slice(0, 8);
const COURSE_LINKED = `cc-linked-${suffix}`;
const COURSE_BARE = `cc-bare-${suffix}`;
const TRACK = `track-legacy-${suffix}`;
const MODULE_A = `cc-mod-a-${suffix}`;
const MODULE_B = `cc-mod-b-${suffix}`;

async function seed(): Promise<void> {
  const sql = getSqlLearn();
  const now = Date.now();
  await sql`INSERT INTO learn_tracks (id, slug, title, created_at, updated_at) VALUES (${TRACK}, ${`slug-${suffix}`}, ${`Probe Track ${suffix}`}, ${now}, ${now})`;
  // Module sort is deliberately out of insertion order: the sequence must come
  // from sort, not from whatever the rows happen to come back as.
  await sql`INSERT INTO learn_modules (id, track_id, slug, title, sort, created_at, updated_at) VALUES (${MODULE_B}, ${TRACK}, ${`m-b-${suffix}`}, 'Second', 2, ${now}, ${now})`;
  await sql`INSERT INTO learn_modules (id, track_id, slug, title, sort, created_at, updated_at) VALUES (${MODULE_A}, ${TRACK}, ${`m-a-${suffix}`}, 'First', 1, ${now}, ${now})`;
  await sql`INSERT INTO learn_lessons (id, module_id, slug, title, sort, est_minutes, created_at, updated_at) VALUES (${`l-b1-${suffix}`}, ${MODULE_B}, 'b1', 'Module two, lesson one', 1, 15, ${now}, ${now})`;
  await sql`INSERT INTO learn_lessons (id, module_id, slug, title, sort, est_minutes, published_version_id, created_at, updated_at) VALUES (${`l-a2-${suffix}`}, ${MODULE_A}, 'a2', 'Module one, lesson two', 2, 12, NULL, ${now}, ${now})`;
  await sql`INSERT INTO learn_lessons (id, module_id, slug, title, sort, est_minutes, created_at, updated_at) VALUES (${`l-a1-${suffix}`}, ${MODULE_A}, 'a1', 'Module one, lesson one', 1, 10, ${now}, ${now})`;
  await sql`INSERT INTO curricula (id, title, published, learn_track_id, created_at, updated_at) VALUES (${COURSE_LINKED}, ${`Probe Course ${suffix}`}, 1, ${TRACK}, ${now}, ${now})`;
  await sql`INSERT INTO curricula (id, title, published, created_at, updated_at) VALUES (${COURSE_BARE}, ${`Bare Course ${suffix}`}, 1, ${now}, ${now})`;
}

async function cleanup(): Promise<void> {
  const sql = getSqlLearn();
  await sql`DELETE FROM curricula WHERE id IN (${COURSE_LINKED}, ${COURSE_BARE})`;
  await sql`DELETE FROM learn_lessons WHERE module_id IN (${MODULE_A}, ${MODULE_B})`;
  await sql`DELETE FROM learn_modules WHERE track_id = ${TRACK}`;
  await sql`DELETE FROM learn_tracks WHERE id = ${TRACK}`;
}

test("a course's lessons come back in the one authored order", async (t) => {
  await seed();
  t.after(cleanup);

  const lessons = await listCourseLessons(COURSE_LINKED);
  assert.deepEqual(
    lessons.map((lesson) => lesson.title),
    ["Module one, lesson one", "Module one, lesson two", "Module two, lesson one"],
    "module sort, then lesson sort — the order Studio, the composer and delivery all use",
  );
  assert.deepEqual(lessons.map((lesson) => lesson.position), [1, 2, 3], "position counts across the whole course");
});

test("a course with no authored track has no lessons, and says so by having none", async (t) => {
  await seed();
  t.after(cleanup);

  assert.deepEqual(await listCourseLessons(COURSE_BARE), []);
  const bare = (await listCourses()).find((course) => course.id === COURSE_BARE);
  assert.equal(bare?.learnTrackId, null);
  assert.equal(bare?.lessonCount, 0);
});

test("draft and published lessons are counted apart, because only one can be run", async (t) => {
  await seed();
  t.after(cleanup);

  const course = (await listCourses()).find((c) => c.id === COURSE_LINKED);
  assert.equal(course?.lessonCount, 3);
  assert.equal(course?.publishedLessonCount, 0, "the probe lessons are all drafts");
  assert.equal((await listCourseLessons(COURSE_LINKED)).every((lesson) => !lesson.published), true);
});

test("a track already claimed by a course is not offered to another one", async (t) => {
  await seed();
  t.after(cleanup);

  const tracks = await listAuthoredTracks();
  const probe = tracks.find((track) => track.id === TRACK);
  assert.equal(probe?.claimedByCourseId, COURSE_LINKED);
  assert.equal(probe?.lessonCount, 3);
});

/* ---------------- the one automatic link ---------------- */

test("migration 027 links only the identifier pair this repo generates on both sides", () => {
  const sql = readFileSync(new URL("../scripts/migrations/027_curriculum_track_links.sql", import.meta.url), "utf8");

  // The link must be keyed on public_slug -> track-legacy-<n>, which is the
  // same track number written by seed-site-content and import-legacy-lessons.
  assert.match(sql, /public_slug\s*~\s*'\^track-\[0-9\]\+\$'/);
  assert.match(sql, /'track-legacy-'\s*\|\|\s*substring\(c\.public_slug from 7\)/);

  // It must never overwrite a link a person made, and never guess on a title.
  assert.match(sql, /learn_track_id IS NULL/);
  assert.doesNotMatch(sql, /lower\(\s*c\.title\s*\)|c\.title\s*=/i);
});

test("the legacy importer makes the same link, so ordering cannot lose it", () => {
  const source = readFileSync(new URL("../scripts/import-legacy-lessons.ts", import.meta.url), "utf8");

  // On a fresh database, migration 027 runs before this importer has created a
  // track to join to. Without the importer doing it too, the link would only
  // ever exist where the import happened to run first.
  assert.match(source, /UPDATE curricula/);
  assert.match(source, /learn_track_id = \$\{tid\}/);
  assert.match(source, /public_slug = \$\{`track-\$\{track\}`\}/);
  // And it must fill nulls only — an operator's explicit link outranks it.
  assert.match(source, /AND learn_track_id IS NULL/);
});

/* ============================================================
 * Instructor-led curriculum: a lesson list and links to material that already
 * exists. The claim is that a live course is a COMPLETE course — not a
 * digital one missing its Learn track.
 * ============================================================ */

const LIVE_COURSE = `cc-live-${suffix}`;

async function seedLive(): Promise<void> {
  const sql = getSqlLearn();
  const now = Date.now();
  await sql`INSERT INTO curricula (id, title, published, created_at, updated_at) VALUES (${LIVE_COURSE}, ${`Live Course ${suffix}`}, 1, ${now}, ${now})`;
  await sql`
    INSERT INTO curriculum_lessons (id, curriculum_id, position, title, teaching_note, created_at, updated_at)
    VALUES (${`cl-2-${suffix}`}, ${LIVE_COURSE}, 2, 'Second lesson', NULL, ${now}, ${now}),
           (${`cl-1-${suffix}`}, ${LIVE_COURSE}, 1, 'First lesson', 'Open on the roster.', ${now}, ${now})
  `;
  await sql`
    INSERT INTO curriculum_resources (id, curriculum_id, lesson_id, label, url, kind, sort, created_at, updated_at)
    VALUES (${`cr-a-${suffix}`}, ${LIVE_COURSE}, ${`cl-1-${suffix}`}, 'Deck', 'https://docs.google.com/presentation/d/x/edit', 'slides', 1, ${now}, ${now}),
           (${`cr-sim-${suffix}`}, ${LIVE_COURSE}, ${`cl-1-${suffix}`}, 'Cap simulation', '/simulation', 'simulation', 2, ${now}, ${now}),
           (${`cr-course-${suffix}`}, ${LIVE_COURSE}, NULL, 'Instructor guide', 'https://drive.google.com/drive/folders/x', 'document', 3, ${now}, ${now}),
           (${`cr-bad-${suffix}`}, ${LIVE_COURSE}, ${`cl-1-${suffix}`}, 'Not a link', 'javascript:alert(1)', 'website', 4, ${now}, ${now})
  `;
}

async function cleanupLive(): Promise<void> {
  const sql = getSqlLearn();
  await sql`DELETE FROM curricula WHERE id = ${LIVE_COURSE}`;
}

test("a course with no Learn track still has lessons, in its own order", async (t) => {
  await seedLive();
  t.after(cleanupLive);

  const lessons = await listCourseLessons(LIVE_COURSE);
  assert.deepEqual(lessons.map((lesson) => lesson.title), ["First lesson", "Second lesson"]);
  assert.deepEqual(lessons.map((lesson) => lesson.position), [1, 2]);
  assert.equal(lessons.every((lesson) => lesson.source === "instructor_led"), true);
  // Nothing to publish, so nothing may be reported as an unpublished draft.
  assert.equal(lessons.every((lesson) => lesson.published), true);
  assert.equal(lessons[0].teachingNote, "Open on the roster.");
});

test("a live course is Taught live, not an incomplete digital one", async (t) => {
  await seedLive();
  t.after(cleanupLive);

  const course = (await listCourses()).find((c) => c.id === LIVE_COURSE);
  assert.equal(course?.mode, "instructor_led");
  assert.equal(course?.learnTrackId, null, "and it needs no Learn track to be complete");
  assert.equal(course?.lessonCount, 2);
});

test("materials reach the lesson an instructor opens, and a simulation is pointed at", async (t) => {
  await seedLive();
  t.after(cleanupLive);

  const [first] = await listCourseLessons(LIVE_COURSE);
  assert.deepEqual(first.resources.map((r) => r.label), ["Deck", "Cap simulation"]);
  const simulation = first.resources.find((r) => r.kind === "simulation");
  assert.equal(simulation?.url, "/simulation", "the same experience Track 101 runs, not a copy of it");

  // Course-level material is separate from any one lesson.
  const courseLevel = await listCourseResources(LIVE_COURSE);
  assert.deepEqual(courseLevel.map((r) => r.label), ["Instructor guide"]);
});

test("a resource whose URL could not be rendered as a link is never returned", async (t) => {
  await seedLive();
  t.after(cleanupLive);

  const [first] = await listCourseLessons(LIVE_COURSE);
  assert.equal(first.resources.some((r) => r.label === "Not a link"), false);
});
