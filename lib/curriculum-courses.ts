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
import {
  resolveCourseMode,
  safeResourceUrl,
  type CourseMode,
  type CourseResource,
  type ResourceKind,
} from "@/lib/curriculum-resources-shared";

/** Which system a lesson's content lives in. */
export type LessonSource = "learn" | "instructor_led";

export interface CourseLesson {
  id: string;
  title: string;
  /** Position across the whole course, 1-based, as an operator counts them. */
  position: number;
  estMinutes: number | null;
  /**
   * Only meaningful for a Learn lesson: false when it has never been published
   * from Studio. An instructor-led lesson has nothing to publish — it is a
   * title, a note and some links — so it is always true.
   */
  published: boolean;
  source: LessonSource;
  /** What the instructor needs to know to teach it. Instructor-led only. */
  teachingNote: string | null;
  /** The Slides, worksheet, simulation. Empty when nothing is attached. */
  resources: CourseResource[];
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
  /**
   * Taught live, self-paced, or both. Derived from what the course actually
   * has, never stored — a course does not declare a mode, it has lessons.
   */
  mode: CourseMode;
  /** Teaching materials attached anywhere on this course. */
  resourceCount: number;
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

/** Every resource on a course, grouped by the lesson it hangs off. */
async function resourcesByLesson(curriculumId: string): Promise<{
  byLesson: Map<string, CourseResource[]>;
  courseLevel: CourseResource[];
  total: number;
}> {
  const rows = (await sqlLearn`
    SELECT id, lesson_id, learn_lesson_id, label, url, kind, note, sort
      FROM curriculum_resources
     WHERE curriculum_id = ${curriculumId}
     ORDER BY sort ASC, created_at ASC
  `.catch(() => [])) as unknown as {
    id: string;
    lesson_id: string | null;
    learn_lesson_id: string | null;
    label: string;
    url: string;
    kind: string;
    note: string | null;
    sort: number;
  }[];

  const byLesson = new Map<string, CourseResource[]>();
  const courseLevel: CourseResource[] = [];
  for (const row of rows) {
    // A resource whose URL is not something we would render as a link is not
    // returned at all — the render path must never be the first place that is
    // noticed.
    const url = safeResourceUrl(row.url);
    if (!url) continue;
    const resource: CourseResource = {
      id: row.id,
      label: row.label,
      url,
      kind: row.kind as ResourceKind,
      note: row.note ?? null,
      sort: Number(row.sort ?? 0),
    };
    const anchor = row.lesson_id ?? row.learn_lesson_id;
    if (!anchor) {
      courseLevel.push(resource);
      continue;
    }
    const list = byLesson.get(anchor);
    if (list) list.push(resource);
    else byLesson.set(anchor, [resource]);
  }
  return { byLesson, courseLevel, total: rows.length };
}

/**
 * The ordered lesson sequence for a course, whichever way it is taught.
 *
 * A digital course's lessons come from Learn, in module order then lesson
 * order — the order Studio shows and the order the composer maps onto
 * sessions. An instructor-led course's lessons are its own numbered list.
 * A hybrid course has both, and the Learn lessons come first because that is
 * the sequence students move through.
 *
 * One list either way: nothing downstream — the composer, the class record,
 * the Session Sheet — should have to know which mode a course is in.
 */
export async function listCourseLessons(curriculumId: string): Promise<CourseLesson[]> {
  const [learnRows, ownRows, resources] = await Promise.all([
    sqlLearn`
      SELECT l.id, l.title, l.est_minutes, l.published_version_id
        FROM curricula c
        JOIN learn_modules m ON m.track_id = c.learn_track_id
        JOIN learn_lessons l ON l.module_id = m.id
       WHERE c.id = ${curriculumId}
         AND c.learn_track_id IS NOT NULL
         AND l.lifecycle = 'active'
         AND m.lifecycle = 'active'
       ORDER BY m.sort ASC, l.sort ASC, l.id ASC
    ` as unknown as Promise<{ id: string; title: string; est_minutes: number | null; published_version_id: string | null }[]>,
    sqlLearn`
      SELECT id, title, teaching_note, position
        FROM curriculum_lessons
       WHERE curriculum_id = ${curriculumId}
       ORDER BY position ASC
    `.catch(() => []) as unknown as Promise<{ id: string; title: string; teaching_note: string | null; position: number }[]>,
    resourcesByLesson(curriculumId),
  ]);

  const lessons: CourseLesson[] = [
    ...learnRows.map((row) => ({
      id: row.id,
      title: row.title,
      position: 0,
      estMinutes: row.est_minutes ?? null,
      published: Boolean(row.published_version_id),
      source: "learn" as const,
      teachingNote: null,
      resources: resources.byLesson.get(row.id) ?? [],
    })),
    ...ownRows.map((row) => ({
      id: row.id,
      title: row.title,
      position: 0,
      estMinutes: null,
      // An instructor-led lesson has nothing to publish. Marking it
      // "draft" would invent a workflow that does not exist.
      published: true,
      source: "instructor_led" as const,
      teachingNote: row.teaching_note ?? null,
      resources: resources.byLesson.get(row.id) ?? [],
    })),
  ];

  return lessons.map((lesson, index) => ({ ...lesson, position: index + 1 }));
}

/** Resources that belong to the course rather than to any one lesson. */
export async function listCourseResources(curriculumId: string): Promise<CourseResource[]> {
  return (await resourcesByLesson(curriculumId)).courseLevel;
}

/** The course library — what the composer picks from and Curriculum lists. */
export async function listCourses(): Promise<CourseSummary[]> {
  const rows = (await sqlLearn`
    SELECT c.id, c.title, c.description, c.grade_range, c.age_range, c.published, c.learn_track_id,
           COALESCE(counts.total, 0)     AS learn_lesson_count,
           COALESCE(counts.published, 0) AS published_lesson_count,
           COALESCE(own.total, 0)        AS own_lesson_count,
           COALESCE(res.total, 0)        AS resource_count
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
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS total FROM curriculum_lessons cl WHERE cl.curriculum_id = c.id
      ) own ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS total FROM curriculum_resources cr WHERE cr.curriculum_id = c.id
      ) res ON true
     ORDER BY c.published DESC, c.title ASC
  `) as unknown as {
    id: string;
    title: string;
    description: string | null;
    grade_range: string | null;
    age_range: string | null;
    published: number | boolean;
    learn_track_id: string | null;
    learn_lesson_count: string | number;
    published_lesson_count: string | number;
    own_lesson_count: string | number;
    resource_count: string | number;
  }[];

  return rows.map((row) => {
    const learnLessonCount = Number(row.learn_lesson_count ?? 0);
    const ownLessonCount = Number(row.own_lesson_count ?? 0);
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? null,
      gradeRange: row.grade_range ?? row.age_range ?? null,
      published: row.published === true || Number(row.published) === 1,
      learnTrackId: row.learn_track_id ?? null,
      lessonCount: learnLessonCount + ownLessonCount,
      publishedLessonCount: Number(row.published_lesson_count ?? 0) + ownLessonCount,
      mode: resolveCourseMode({ learnLessonCount, ownLessonCount }),
      resourceCount: Number(row.resource_count ?? 0),
    };
  });
}

export async function getCourse(curriculumId: string): Promise<CourseSummary | null> {
  const courses = await listCourses();
  return courses.find((course) => course.id === curriculumId) ?? null;
}

export interface AuthoredTrack {
  id: string;
  title: string;
  lessonCount: number;
  /** The course already pointing at this track, when one does. */
  claimedByCourseId: string | null;
  claimedByCourseTitle: string | null;
}

/**
 * The authored tracks a course could be linked to.
 *
 * Linking is always an explicit choice made by a person from this list. The
 * one automatic link in the system (migration 027) exists because
 * `curricula.public_slug = 'track-<n>'` and `learn_tracks.id =
 * 'track-legacy-<n>'` are the same number written twice by code in this repo —
 * not because two titles looked alike. Nothing here guesses.
 */
export async function listAuthoredTracks(): Promise<AuthoredTrack[]> {
  const rows = (await sqlLearn`
    SELECT t.id, t.title,
           COALESCE(counts.total, 0) AS lesson_count,
           claim.id AS claimed_by_course_id,
           claim.title AS claimed_by_course_title
      FROM learn_tracks t
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS total
          FROM learn_modules m
          JOIN learn_lessons l ON l.module_id = m.id
         WHERE m.track_id = t.id AND l.lifecycle = 'active' AND m.lifecycle = 'active'
      ) counts ON true
      LEFT JOIN LATERAL (
        SELECT c.id, c.title FROM curricula c WHERE c.learn_track_id = t.id ORDER BY c.title LIMIT 1
      ) claim ON true
     ORDER BY t.title
  `) as unknown as {
    id: string;
    title: string;
    lesson_count: string | number;
    claimed_by_course_id: string | null;
    claimed_by_course_title: string | null;
  }[];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    lessonCount: Number(row.lesson_count ?? 0),
    claimedByCourseId: row.claimed_by_course_id ?? null,
    claimedByCourseTitle: row.claimed_by_course_title ?? null,
  }));
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
