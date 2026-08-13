import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/dal";
import { getInstructorByUserId } from "@/lib/hiring";
import { listCourses, listCourseLessons } from "@/lib/curriculum-courses";
import { loadClassDraft, DEFAULT_DRAFT } from "@/lib/class-draft";
import Composer from "@/components/app/post-class/Composer";

export const metadata = { title: "Post a Class" };

/**
 * Post a Class — the highest-traffic workflow in BOW HQ.
 *
 * The page loads the courses, the operator's in-flight draft and whether the
 * operator can be set as the instructor, then hands all of it to the composer
 * at once so the form is never in a half-populated state a person can type
 * into.
 */
export default async function PostClassPage() {
  const me = await requireStaff();
  if (me.role !== "admin" && me.role !== "growth") redirect("/app");

  const [courses, draft, instructor] = await Promise.all([
    listCourses(),
    loadClassDraft(me.id),
    getInstructorByUserId(me.id),
  ]);

  const initial = draft ?? DEFAULT_DRAFT;
  const initialLessons = initial.curriculumId
    ? (await listCourseLessons(initial.curriculumId)).map((lesson) => lesson.title)
    : [];

  const operatorTeaches = Boolean(instructor && instructor.stage !== "rejected" && instructor.stage !== "inactive");

  return (
    <div style={{ maxWidth: 1120 }}>
      <Link
        href="/app"
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 10.5,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--bow-slate)",
          textDecoration: "none",
        }}
      >
        ← Back
      </Link>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", margin: "12px 0 30px" }}>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: "clamp(26px, 4vw, 34px)",
            letterSpacing: "0.01em",
            textTransform: "uppercase",
            color: "var(--bow-ink)",
          }}
        >
          Post a Class
        </h1>
        <span style={{ fontSize: 13.5, color: "var(--bow-slate)" }}>Most classes go live in under three minutes</span>
      </div>

      <Composer
        courses={courses}
        initial={initial}
        initialLessons={initialLessons}
        hadDraft={Boolean(draft)}
        operatorName={me.name}
        operatorTeaches={operatorTeaches}
      />
    </div>
  );
}
