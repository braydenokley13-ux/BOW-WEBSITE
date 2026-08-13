import Link from "next/link";
import { Badge, Button } from "@/components/ds";
import { requireStaff } from "@/lib/dal";
import { listCourses } from "@/lib/curriculum-courses";
import { getDb } from "@/lib/db";

export const metadata = { title: "Curriculum" };

const sectionHeading: React.CSSProperties = {
  margin: "0 0 10px",
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--bow-ink)",
};

/**
 * Curriculum — build once, run everywhere.
 *
 * A course is a `curricula` row; its lessons live in the authored graph
 * (`learn_tracks → learn_modules → learn_lessons`) and are reached through
 * `curricula.learn_track_id`. The list says, per course, how many lessons it
 * has, how many of those are actually published, and how many classes are
 * running it — which is the whole "build once, run everywhere" claim, stated
 * as numbers rather than asserted in a heading.
 *
 * Authoring is not here. Studio owns that, and this links to it.
 */
export default async function CurriculumPage() {
  await requireStaff();

  const courses = await listCourses();
  const usage = (await getDb()
    .prepare(
      `SELECT COALESCE(c.curriculum_id, p.curriculum_id) AS course_id, COUNT(*) AS running
         FROM classes c
         LEFT JOIN programs p ON p.id = c.program_id
        WHERE c.status IN ('active','paused')
          AND COALESCE(c.curriculum_id, p.curriculum_id) IS NOT NULL
        GROUP BY COALESCE(c.curriculum_id, p.curriculum_id)`,
    )
    .all()) as { course_id: string; running: string | number }[];
  const runningByCourse = new Map(usage.map((row) => [row.course_id, Number(row.running)]));

  const withLessons = courses.filter((course) => course.lessonCount > 0);
  const withoutLessons = courses.filter((course) => course.lessonCount === 0);

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-data)",
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--bow-slate)",
            }}
          >
            Curriculum
          </p>
          <h1
            style={{
              margin: "9px 0 0",
              fontFamily: "var(--font-interface)",
              fontWeight: 600,
              fontSize: "clamp(19px, 2.6vw, 24px)",
              lineHeight: 1.3,
              color: "var(--bow-ink)",
            }}
          >
            {courses.length} course{courses.length === 1 ? "" : "s"}. Build once, run everywhere.
          </h1>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button href="/app/admin/learn" variant="secondary">
            Open Studio
          </Button>
          <Button href="/app/curriculum/new" variant="primary">
            New course
          </Button>
        </div>
      </div>

      <section style={{ marginTop: 28 }}>
        {courses.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--bow-slate)" }}>
            No courses yet. A course is what a class is built on — create one, then write its lessons in Studio.
          </p>
        ) : (
          <div style={{ border: "1px solid var(--border-rule)", borderRadius: "var(--radius-card)", background: "var(--bow-white)" }}>
            {[...withLessons, ...withoutLessons].map((course, index) => {
              const running = runningByCourse.get(course.id) ?? 0;
              return (
                <div
                  key={course.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 14,
                    padding: "14px 16px",
                    borderTop: index === 0 ? "none" : "1px solid var(--border-rule)",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                    <Link href={`/app/curriculum/${course.id}`} style={{ fontSize: 15, fontWeight: 600, color: "var(--bow-ink)" }}>
                      {course.title}
                    </Link>
                    <span style={{ display: "block", marginTop: 3, fontSize: 13, color: "var(--bow-slate)" }}>
                      {[
                        course.gradeRange,
                        course.lessonCount > 0
                          ? `${course.lessonCount} lesson${course.lessonCount === 1 ? "" : "s"}`
                          : "No lessons written yet",
                        course.lessonCount > 0 && course.publishedLessonCount < course.lessonCount
                          ? `${course.lessonCount - course.publishedLessonCount} still draft`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", flex: "none" }}>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>
                      {running > 0 ? `RUNNING IN ${running}` : "NOT RUNNING"}
                    </span>
                    <Badge status={course.published ? "positive" : "neutral"}>
                      {course.published ? "Published" : "Draft"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {withoutLessons.length > 0 ? (
        <section style={{ marginTop: 26 }}>
          <h2 style={sectionHeading}>Courses with no lessons yet</h2>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--bow-slate)" }}>
            {withoutLessons.map((course) => course.title).join(", ")} {withoutLessons.length === 1 ? "has" : "have"} no
            authored lessons behind {withoutLessons.length === 1 ? "it" : "them"}. A class built on{" "}
            {withoutLessons.length === 1 ? "it" : "one"} still runs — its sessions are just numbered rather than named.
            Point a course at its lessons from the course record, or write them in Studio.
          </p>
        </section>
      ) : null}
    </div>
  );
}
