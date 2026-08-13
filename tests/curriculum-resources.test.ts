import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COURSE_MODE_LABEL,
  inferResourceKind,
  isResourceKind,
  resolveCourseMode,
  safeResourceUrl,
} from "../lib/curriculum-resources-shared";

/* ---------------- what a link points at ---------------- */

test("the common teaching hosts are recognised, because typing the type every time is the labour", () => {
  assert.equal(inferResourceKind("https://docs.google.com/presentation/d/abc/edit"), "slides");
  assert.equal(inferResourceKind("https://docs.google.com/document/d/abc/edit"), "document");
  assert.equal(inferResourceKind("https://docs.google.com/spreadsheets/d/abc/edit"), "worksheet");
  assert.equal(inferResourceKind("https://docs.google.com/forms/d/abc/viewform"), "worksheet");
  assert.equal(inferResourceKind("https://www.canva.com/design/abc/view"), "slides");
  assert.equal(inferResourceKind("https://www.youtube.com/watch?v=abc"), "video");
  assert.equal(inferResourceKind("https://youtu.be/abc"), "video");
  assert.equal(inferResourceKind("https://drive.google.com/file/d/abc/view"), "document");
  assert.equal(inferResourceKind("https://example.org/handout.pdf"), "pdf");
});

test("a BOW simulation is recognised as one, so a session points at it instead of copying it", () => {
  assert.equal(inferResourceKind("/simulation"), "simulation");
  assert.equal(inferResourceKind("/simulation-room"), "simulation");
  assert.equal(inferResourceKind("/simulation/salary-cap"), "simulation");
  assert.equal(inferResourceKind("https://bowsportscapital.com/simulation"), "simulation");
});

test("anything not certain comes back as a website rather than a confident wrong guess", () => {
  // Nobody re-checks a field that looks already filled in.
  assert.equal(inferResourceKind("https://example.org/some/page"), "website");
  assert.equal(inferResourceKind("https://notion.so/a-page"), "website");
  assert.equal(inferResourceKind(""), "other");
});

/* ---------------- only real links are rendered ---------------- */

test("a resource URL is http(s) or a BOW path, and nothing else", () => {
  assert.equal(safeResourceUrl("https://docs.google.com/x"), "https://docs.google.com/x");
  assert.equal(safeResourceUrl("http://example.org"), "http://example.org");
  assert.equal(safeResourceUrl("  /simulation  "), "/simulation");
  assert.equal(safeResourceUrl("javascript:alert(1)"), null);
  assert.equal(safeResourceUrl("data:text/html,<script>"), null);
  // Protocol-relative would leave the host to whatever the page was served on.
  assert.equal(safeResourceUrl("//evil.example/x"), null);
  assert.equal(safeResourceUrl("just some text"), null);
  assert.equal(safeResourceUrl(""), null);
  assert.equal(safeResourceUrl(null), null);
});

test("only the declared kinds are accepted from a client", () => {
  assert.equal(isResourceKind("slides"), true);
  assert.equal(isResourceKind("simulation"), true);
  assert.equal(isResourceKind("lesson"), false);
  assert.equal(isResourceKind(42), false);
  assert.equal(isResourceKind(undefined), false);
});

/* ---------------- how a course is taught ---------------- */

test("a course is described by what it has, and a live course is complete", () => {
  assert.equal(resolveCourseMode({ learnLessonCount: 0, ownLessonCount: 6 }), "instructor_led");
  assert.equal(resolveCourseMode({ learnLessonCount: 12, ownLessonCount: 0 }), "digital");
  assert.equal(resolveCourseMode({ learnLessonCount: 12, ownLessonCount: 3 }), "hybrid");
  assert.equal(resolveCourseMode({ learnLessonCount: 0, ownLessonCount: 0 }), "unplanned");

  // The label for a live course must not imply anything is missing.
  assert.equal(COURSE_MODE_LABEL.instructor_led, "Taught live");
  assert.doesNotMatch(COURSE_MODE_LABEL.instructor_led, /no|missing|incomplete|draft/i);
});

test("nothing here is a second authoring system", async () => {
  const { readFileSync } = await import("node:fs");
  const planner = readFileSync(
    new URL("../components/app/curriculum/LessonPlanner.tsx", import.meta.url),
    "utf8",
  );
  // A resource is a label plus a URL. If this file ever grows a document
  // model, BOW has two places a lesson can live and one of them will rot.
  assert.doesNotMatch(planner, /contentEditable|execCommand|BlockPalette|LessonDoc|draft_doc/);
});
