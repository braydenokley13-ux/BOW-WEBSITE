import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button } from "@/components/ds";
import { getCurrentUser, requireStaff } from "@/lib/dal";
import { getDb, rowToCurriculum } from "@/lib/db";
import { getCourse, getCourseUsage, listAuthoredTracks, listCourseLessons, listCourseResources } from "@/lib/curriculum-courses";
import { COURSE_MODE_LABEL } from "@/lib/curriculum-resources-shared";
import CurriculumForm from "@/components/app/curriculum/CurriculumForm";
import TrackLinkControl from "@/components/app/curriculum/TrackLinkControl";
import LessonPlanner from "@/components/app/curriculum/LessonPlanner";

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await getCourse(id);
  return { title: course?.title ?? "Course" };
}

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
 * A course — what it teaches, and everywhere it is running.
 *
 * The lesson sequence is the authored one (`learn_modules.sort`, then
 * `learn_lessons.sort`) — the same order Studio shows and the same order the
 * composer maps onto sessions, so "lesson 3" means one thing to everybody.
 *
 * Versions stay underneath. A lesson is either published — meaning a class can
 * run it — or still a draft, and that is the only version fact an operator
 * needs. `learn_lesson_versions` and the immutability guarantees on top of it
 * are Studio's business and a student-history concern, not a scheduling one.
 *
 * Authoring is not rebuilt here. Every lesson links into Studio.
 */
export default async function CourseRecordPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const me = await getCurrentUser();
  const { id } = await params;

  const db = getDb();
  const row = (await db.prepare("SELECT * FROM curricula WHERE id = ?").get(id)) as any;
  if (!row) notFound();
  const curriculum = rowToCurriculum(row);

  const [course, lessons, usage, tracks, courseResources] = await Promise.all([
    getCourse(id),
    listCourseLessons(id),
    getCourseUsage(id),
    listAuthoredTracks(),
    listCourseResources(id),
  ]);

  const running = usage.filter((entry) => entry.status === "active" || entry.status === "paused");
  const past = usage.filter((entry) => !running.includes(entry));
  const drafts = lessons.filter((lesson) => !lesson.published).length;

  return (
    <div style={{ maxWidth: 900 }}>
      <Link
        href="/app/curriculum"
        style={{
          display: "inline-block",
          marginBottom: 14,
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--bow-slate)",
        }}
      >
        ← Curriculum
      </Link>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-editorial)",
              fontWeight: 600,
              fontSize: "clamp(24px, 3.4vw, 32px)",
              lineHeight: 1.15,
              color: "var(--bow-ink)",
            }}
          >
            {curriculum.title}
          </h1>
          {curriculum.description ? (
            <p style={{ margin: "10px 0 0", fontSize: 14.5, lineHeight: 1.6, color: "var(--bow-slate)" }}>
              {curriculum.description}
            </p>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", flex: "0 1 auto" }}>
          {course ? <Badge status="info">{COURSE_MODE_LABEL[course.mode]}</Badge> : null}
          <Badge status={curriculum.published ? "positive" : "neutral"}>
            {curriculum.published ? "Published" : "Draft"}
          </Badge>
          <Button href="/app/admin/learn" variant="secondary" size="sm">
            Open in Studio
          </Button>
        </div>
      </div>

      <p style={{ margin: "14px 0 0", fontSize: 15, lineHeight: 1.55, color: "var(--bow-ink)" }}>
        {lessons.length === 0
          ? "No lessons yet. Add them below with the Slides and worksheets an instructor opens, or point this course at an authored set of self-paced lessons."
          : `${lessons.length} lesson${lessons.length === 1 ? "" : "s"}${drafts > 0 ? `, ${drafts} still draft` : ""}. Running in ${running.length} class${running.length === 1 ? "" : "es"}.`}
      </p>
      {curriculum.ageRange ? (
        <p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--bow-slate)" }}>{curriculum.ageRange}</p>
      ) : null}

      {/* The sequence. One order, shared by Studio, the composer and delivery —
          and, for a live course, the materials an instructor opens from it. */}
      <section style={{ marginTop: 30 }}>
        <h2 style={sectionHeading}>Lessons and materials</h2>
        <p style={{ margin: "0 0 12px", fontSize: 12.5, lineHeight: 1.55, color: "var(--bow-slate)" }}>
          Materials are links to what already exists — Google Slides, Canva, a worksheet, a BOW simulation. Attach them
          once here and every class that runs the lesson reaches them from its Session Sheet.
        </p>
        <LessonPlanner curriculumId={curriculum.id} lessons={lessons} courseResources={courseResources} />
        {drafts > 0 ? (
          <p style={{ margin: "12px 0 0", fontSize: 12.5, lineHeight: 1.55, color: "var(--bow-slate)" }}>
            A self-paced lesson still marked draft can be scheduled — it just has not been released to students. That
            happens in Studio.
          </p>
        ) : null}
      </section>

      {/* Where it is running. The other half of "build once, run everywhere". */}
      <section style={{ marginTop: 30 }}>
        <h2 style={sectionHeading}>Where it runs</h2>
        {usage.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--bow-slate)" }}>
            No class has been built on this course yet.
          </p>
        ) : (
          <>
            {running.map((entry) => (
              <UsageLine key={entry.classId} entry={entry} />
            ))}
            {past.length > 0 ? (
              <details style={{ marginTop: running.length ? 12 : 0 }}>
                <summary
                  style={{
                    cursor: "pointer",
                    fontFamily: "var(--font-data)",
                    fontSize: 11,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--bow-slate)",
                  }}
                >
                  {past.length} finished or not started
                </summary>
                <div style={{ marginTop: 10 }}>
                  {past.map((entry) => (
                    <UsageLine key={entry.classId} entry={entry} />
                  ))}
                </div>
              </details>
            ) : null}
          </>
        )}
      </section>

      {me?.role === "admin" ? (
        <details style={{ marginTop: 34 }}>
          <summary
            style={{
              cursor: "pointer",
              fontFamily: "var(--font-data)",
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--bow-slate)",
            }}
          >
            Course settings
          </summary>
          <div style={{ marginTop: 16 }}>
            <TrackLinkControl curriculumId={curriculum.id} currentTrackId={course?.learnTrackId ?? null} tracks={tracks} />
          </div>
          <div style={{ marginTop: 24 }}>
            <CurriculumForm
              mode="edit"
              curriculumId={curriculum.id}
              initial={{
                title: curriculum.title,
                description: curriculum.description ?? "",
                ageRange: curriculum.ageRange ?? "",
                published: curriculum.published,
              }}
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}

function UsageLine({ entry }: { entry: Awaited<ReturnType<typeof getCourseUsage>>[number] }) {
  return (
    <div style={{ padding: "11px 0", borderTop: "1px solid var(--border-rule)" }}>
      <Link href={`/app/classes/${entry.classId}`} style={{ fontSize: 14.5, color: "var(--bow-ink)" }}>
        {entry.classTitle}
      </Link>
      <span
        style={{
          display: "block",
          marginTop: 3,
          fontFamily: "var(--font-data)",
          fontSize: 10.5,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--bow-slate)",
        }}
      >
        {[
          entry.partnerName,
          entry.startDate,
          entry.sessionCount ? `${entry.sessionsCompleted}/${entry.sessionCount} sessions run` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </div>
  );
}
