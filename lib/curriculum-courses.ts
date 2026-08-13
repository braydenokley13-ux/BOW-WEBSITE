/* ============================================================
 * Courses — the operating view of curriculum.
 *
 * A "course" to staff is a `curricula` row. Its lessons live in the authored
 * graph (learn_tracks -> learn_modules -> learn_lessons), reached through
 * `curricula.learn_track_id` (migration 026). Before that column a course had
 * no lessons to show, which is why the composer could not pre-fill anything.
 *
 * Reads go through the native client (lib/db-sql.ts) because the learn_*
 * tables are JSONB-heavy and the lib/db.ts compatibility shim is not safe
 * against them. Only plain columns are selected here — a lesson's `doc` is
 * never loaded into a list.
 *
 * Server-only.
 * ============================================================ */

import { sqlLearn } from "@/lib/db-sql";

export interface CourseLesson {
  id: string;
  title: string;
  /** Position across the whole course, 1-based, as an operator counts them. */
  position: number;
  estMinutes: number | null;
  /** False when the lesson has never been published from Studio. */
  published: boolean;
}

export interface CourseSummary {
  id: string;
  title: string;
  description: string | null;
  gradeRange: string | null;
  published: boolean;
  learnTrackId: string | null;
  lessonCount: number;
  /** Lessons that have a published version — what a class would actually run. */
  publishedLessonCount: number;
}

export interface CourseUsage {
  classId: string;
  classTitle: string;
  programId: string | null;
  /** A partner section names its partner; a direct class does not have one. */
  partnerName: string | null;
  status: string;
  startDate: string | null;
  /** How far through the run the class currently is, when it has started. */
  sessionsCompleted: number;
  sessionCount: number;
}

/**
 * The ordered lesson sequence for a course.
 *
 * Order is module order then lesson order — the same order Studio shows and
 * the same order the composer maps onto sessions, so lesson N is the Nth
 * session for everyone.
 */
export async function listCourseLessons(curriculumId: string): Promise<CourseLesson[]> {
  const rows = (await sqlLearn`
    SELECT l.id, l.title, l.est_minutes, l.published_version_id
      FROM curricula c
      JOIN learn_modules m ON m.track_id = c.learn_track_id
      JOIN learn_lessons l ON l.module_id = m.id
     WHERE c.id = ${curriculumId}
       AND c.learn_track_id IS NOT NULL
       AND l.lifecycle = 'active'
       AND m.lifecycle = 'active'
     ORDER BY m.sort ASC, l.sort ASC, l.id ASC
  `) as unknown as { id: string; title: string; est_minutes: number | null; published_version_id: string | null }[];

  return rows.map((row, index) => ({
    id: row.id,
    title: row.title,
    position: index + 1,
    estMinutes: row.est_minutes ?? null,
    published: Boolean(row.published_version_id),
  }));
}

/** The course library — what the composer picks from and Curriculum lists. */
export async function listCourses(): Promise<CourseSummary[]> {
  const rows = (await sqlLearn`
    SELECT c.id, c.title, c.description, c.grade_range, c.age_range, c.published, c.learn_track_id,
           COALESCE(counts.total, 0)     AS lesson_count,
           COALESCE(counts.published, 0) AS published_lesson_count
      FROM curricula c
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE l.published_version_id IS NOT NULL) AS published
          FROM learn_modules m
          JOIN learn_lessons l ON l.module_id = m.id
         WHERE m.track_id = c.learn_track_id
           AND l.lifecycle = 'active'
           AND m.lifecycle = 'active'
      ) counts ON true
     ORDER BY c.published DESC, c.title ASC
  `) as unknown as {
    id: string;
    title: string;
    description: string | null;
    grade_range: string | null;
    age_range: string | null;
    published: number | boolean;
    learn_track_id: string | null;
    lesson_count: string | number;
    published_lesson_count: string | number;
  }[];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    gradeRange: row.grade_range ?? row.age_range ?? null,
    published: row.published === true || Number(row.published) === 1,
    learnTrackId: row.learn_track_id ?? null,
    lessonCount: Number(row.lesson_count ?? 0),
    publishedLessonCount: Number(row.published_lesson_count ?? 0),
  }));
}

export async function getCourse(curriculumId: string): Promise<CourseSummary | null> {
  const courses = await listCourses();
  return courses.find((course) => course.id === curriculumId) ?? null;
}

/**
 * Where a course is running — the visible half of "build once, use everywhere".
 *
 * Covers both attachment points: a class carrying the curriculum directly, and
 * a class inheriting it from its program (which is how partner sections get
 * one).
 */
export async function getCourseUsage(curriculumId: string): Promise<CourseUsage[]> {
  const rows = (await sqlLearn`
    SELECT c.id            AS class_id,
           c.title         AS class_title,
           c.status,
           c.start_date,
           p.id            AS program_id,
           o.name          AS partner_name,
           (SELECT COUNT(*) FROM class_sessions s WHERE s.class_id = c.id)                        AS session_count,
           (SELECT COUNT(*) FROM class_sessions s
              JOIN class_session_reports r ON r.session_id = s.id AND r.completed = 1
             WHERE s.class_id = c.id)                                                             AS sessions_completed
      FROM classes c
      LEFT JOIN programs p ON p.id = c.program_id
      LEFT JOIN organizations o ON o.id = COALESCE(c.partner_org_id, p.partner_org_id)
     WHERE (c.curriculum_id = ${curriculumId} OR p.curriculum_id = ${curriculumId})
       AND c.status NOT IN ('cancelled')
     ORDER BY c.start_date DESC NULLS LAST, c.created_at DESC
  `) as unknown as {
    class_id: string;
    class_title: string;
    status: string;
    start_date: string | null;
    program_id: string | null;
    partner_name: string | null;
    session_count: string | number;
    sessions_completed: string | number;
  }[];

  return rows.map((row) => ({
    classId: row.class_id,
    classTitle: row.class_title,
    programId: row.program_id ?? null,
    partnerName: row.partner_name ?? null,
    status: row.status,
    startDate: row.start_date ?? null,
    sessionsCompleted: Number(row.sessions_completed ?? 0),
    sessionCount: Number(row.session_count ?? 0),
  }));
}
