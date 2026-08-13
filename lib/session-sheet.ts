/* ============================================================
 * The Session Sheet — what an instructor opens five minutes before class.
 *
 * Every fact here comes from the canonical delivery systems: the session and
 * its locked roster from `class_sessions` / `class_session_roster`, marks from
 * `attendance_records`, notes and completion from `class_session_reports`,
 * lesson evidence from the same snapshot model the report finalizes with.
 * Nothing on this surface has its own table.
 *
 * What is deliberately absent is as important as what is here: no CRM, no
 * partner notes, no guardian contact details, no admin controls. An instructor
 * needs to know who is in the room and what they are teaching.
 *
 * Server-only. Browser-safe types and the pure action resolver live in
 * lib/session-sheet-shared.ts.
 * ============================================================ */

import { getDb } from "@/lib/db";
import { sqlLearn } from "@/lib/db-sql";
import { listCourseLessons } from "@/lib/curriculum-courses";
import type { CourseResource } from "@/lib/curriculum-resources-shared";
import { getLessonById } from "@/lib/lessons";
import { parseLessonSnapshot, resolveAttendanceStatus } from "@/lib/session-evidence";
import { DEFAULT_TIME_ZONE } from "@/lib/timezone";
import {
  safeMeetingLink,
  type AttendanceLock,
  type SessionSheet,
  type SheetLesson,
  type SheetStudent,
} from "@/lib/session-sheet-shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type SheetViewer =
  | { kind: "staff" }
  /** An instructor may only ever see a class they have actually accepted. */
  | { kind: "instructor"; instructorId: string };

const DEFAULT_SESSION_MINUTES = 90;

function minutesBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const parse = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  const span = parse(end) - parse(start);
  return Number.isFinite(span) && span > 0 ? span : null;
}

/**
 * Why attendance cannot be edited right now.
 *
 * Each branch mirrors a guard `recordAttendance` enforces server-side, so the
 * sheet never offers a control the action would refuse. The order matters: a
 * cancelled session is not "not started yet", it is not happening.
 */
export function resolveAttendanceLock(input: {
  sessionStatus: string;
  classStatus: string;
  startsAt: number;
  finalized: boolean;
  rosterSize: number;
  now: number;
}): AttendanceLock {
  if (input.sessionStatus === "cancelled") {
    return { locked: true, reason: "cancelled", label: "This session was cancelled." };
  }
  if (input.finalized) {
    return { locked: true, reason: "finalized", label: "Attendance is locked — this session is complete." };
  }
  if (!["active", "paused"].includes(input.classStatus)) {
    return { locked: true, reason: "delivery_closed", label: "This class is not running, so attendance is closed." };
  }
  if (input.startsAt > input.now) {
    return { locked: true, reason: "not_started", label: "Attendance opens when the session starts." };
  }
  if (input.rosterSize === 0) {
    return { locked: true, reason: "no_roster", label: "Nobody is on this session's roster yet." };
  }
  return { locked: false };
}

/**
 * The lesson this session teaches.
 *
 * Three sources, in order of authority: a finalized report's immutable
 * snapshot, the lesson the session was scheduled against, and — when neither
 * exists — nothing, which the sheet says plainly rather than dressing up the
 * session title as curriculum.
 */
async function resolveLesson(
  lessonId: string | null,
  snapshot: string | null,
  finalized: boolean,
  courseId: string | null,
): Promise<SheetLesson | null> {
  if (finalized) {
    const stored = parseLessonSnapshot(snapshot, lessonId);
    if (stored) {
      return {
        id: stored.id,
        title: stored.title,
        position: null,
        total: null,
        estMinutes: null,
        href: null,
        published: true,
        historical: true,
        // A finalized session is evidence of what was delivered. Today's
        // materials are not part of that record.
        resources: [],
        teachingNote: null,
      };
    }
  }
  if (!lessonId) return null;

  // Legacy-imported lessons keep their original ids, so the static catalogue
  // still answers for them and carries the central question worth showing.
  const legacy = getLessonById(lessonId);

  const rows = (await sqlLearn`
    SELECT l.id, l.title, l.est_minutes, l.published_version_id, m.track_id
      FROM learn_lessons l
      JOIN learn_modules m ON m.id = l.module_id
     WHERE l.id = ${lessonId}
     LIMIT 1
  `.catch(() => [])) as unknown as {
    id: string;
    title: string;
    est_minutes: number | null;
    published_version_id: string | null;
    track_id: string;
  }[];
  const authored = rows[0];

  /* ---- The course's own sequence ----
     One call, whichever way the course is taught: it returns Learn lessons
     for a digital course and the instructor-led list for a live one, each
     carrying the materials attached to it. This is also what lets an
     instructor-led lesson resolve at all — it has no learn_lessons row. */
  const courseLessons = courseId ? await listCourseLessons(courseId).catch(() => []) : [];
  const fromCourse = courseLessons.find((lesson) => lesson.id === lessonId) ?? null;

  if (!authored && !legacy && !fromCourse) return null;

  let position: number | null = fromCourse ? fromCourse.position : null;
  let total: number | null = fromCourse ? courseLessons.length : null;
  if (authored && position === null) {
    const sequence = (await sqlLearn`
      SELECT l.id
        FROM learn_modules m
        JOIN learn_lessons l ON l.module_id = m.id
       WHERE m.track_id = ${authored.track_id}
         AND l.lifecycle = 'active'
         AND m.lifecycle = 'active'
       ORDER BY m.sort ASC, l.sort ASC, l.id ASC
    `.catch(() => [])) as unknown as { id: string }[];
    const index = sequence.findIndex((row) => row.id === lessonId);
    if (index >= 0) {
      position = index + 1;
      total = sequence.length;
    }
  }

  return {
    id: lessonId,
    title: fromCourse?.title ?? authored?.title ?? legacy?.title ?? "Lesson",
    position,
    total,
    estMinutes: fromCourse?.estMinutes ?? authored?.est_minutes ?? null,
    // The course record is where a lesson's sequence and material live. There
    // is no per-lesson teaching view to link at yet, and inventing one would
    // be a link that does not resolve.
    href: courseId ? `/app/curriculum/${courseId}` : null,
    // An instructor-led lesson has nothing to publish; only a Learn lesson can
    // be a draft.
    published: fromCourse?.source === "instructor_led" ? true : Boolean(authored?.published_version_id),
    historical: false,
    resources: (fromCourse?.resources ?? []) as CourseResource[],
    teachingNote: fromCourse?.teachingNote ?? null,
  };
}

export async function getSessionSheet(
  sessionId: string,
  viewer: SheetViewer,
  now = Date.now(),
): Promise<SessionSheet | null> {
  const db = getDb();

  const row = (await db
    .prepare(
      `SELECT s.id, s.class_id, s.session_date, s.session_on, s.timezone, s.location, s.meeting_link,
              s.title, s.objective, s.agenda, s.materials, s.lesson_id, s.status,
              c.title AS class_title, c.status AS class_status, c.schedule_timezone,
              c.schedule_start_time, c.schedule_end_time, c.location AS class_location,
              COALESCE(c.curriculum_id, p.curriculum_id) AS course_id,
              o.name AS partner_name
         FROM class_sessions s
         JOIN classes c ON c.id = s.class_id
         LEFT JOIN programs p ON p.id = c.program_id
         LEFT JOIN organizations o ON o.id = COALESCE(c.partner_org_id, p.partner_org_id)
        WHERE s.id = ?`,
    )
    .get(sessionId)) as any;
  if (!row) return null;

  const timezone = row.timezone ?? row.schedule_timezone ?? DEFAULT_TIME_ZONE;
  const startsAt = Number(row.session_date);
  const spanMinutes = minutesBetween(row.schedule_start_time, row.schedule_end_time);
  const endsAt = startsAt + (spanMinutes ?? DEFAULT_SESSION_MINUTES) * 60 * 1000;

  /* ---- Position in the run ---- */
  const runRows = (await db
    .prepare("SELECT id FROM class_sessions WHERE class_id = ? ORDER BY session_date, id")
    .all(row.class_id)) as { id: string }[];
  const index = Math.max(1, runRows.findIndex((s) => s.id === sessionId) + 1);

  /* ---- The locked roster, and what has been marked against it ---- */
  const rosterRows = (await db
    .prepare(
      `SELECT r.student_id, st.name, st.grade
         FROM class_session_roster r
         LEFT JOIN students st ON st.id = r.student_id
        WHERE r.session_id = ?
        ORDER BY st.name, r.student_id`,
    )
    .all(sessionId)) as { student_id: string; name: string | null; grade: string | null }[];

  const marks = (await db
    .prepare("SELECT student_id, present, status, note, recorded_at FROM attendance_records WHERE session_id = ?")
    .all(sessionId)) as {
    student_id: string;
    present: number;
    status: string | null;
    note: string | null;
    recorded_at: number;
  }[];
  const markByStudent = new Map(marks.map((mark) => [mark.student_id, mark]));

  const roster: SheetStudent[] = rosterRows.map((student) => {
    const mark = markByStudent.get(student.student_id);
    return {
      studentId: student.student_id,
      name: student.name ?? student.student_id,
      grade: student.grade ?? null,
      status: mark ? resolveAttendanceStatus(mark.status, mark.present) : null,
      note: mark?.note ?? "",
      recordedAt: mark ? Number(mark.recorded_at) : null,
    };
  });

  /* ---- The report ---- */
  const report = (await db
    .prepare(
      `SELECT notes, flagged, flag_reason, completed, reported_at, lesson_id, lesson_snapshot
         FROM class_session_reports WHERE session_id = ?`,
    )
    .get(sessionId)) as any;
  const finalized = report?.completed === 1;

  /* ---- Who else is teaching. Names only. ---- */
  const coInstructorRows = (await db
    .prepare(
      `SELECT pe.name, ci.instructor_id
         FROM class_instructors ci
         JOIN instructors i ON i.id = ci.instructor_id
         LEFT JOIN people pe ON pe.id = i.person_id
        WHERE ci.class_id = ? AND ci.removed_at IS NULL AND ci.assignment_status = 'accepted'
        ORDER BY CASE ci.role WHEN 'lead' THEN 0 ELSE 1 END, pe.name`,
    )
    .all(row.class_id)) as { name: string | null; instructor_id: string }[];

  const lesson = await resolveLesson(
    row.lesson_id ?? report?.lesson_id ?? null,
    report?.lesson_snapshot ?? null,
    finalized,
    row.course_id ?? null,
  );

  return {
    now,
    sessionId: row.id,
    classId: row.class_id,
    classTitle: row.class_title,
    partnerName: row.partner_name ?? null,
    index,
    total: runRows.length,
    startsAt,
    endsAt,
    sessionOn: row.session_on ?? "",
    timezone,
    status: row.status ?? "scheduled",
    title: row.title ?? null,
    location: row.location ?? row.class_location ?? null,
    meetingLink: safeMeetingLink(row.meeting_link),
    coInstructors: coInstructorRows
      .filter((i) => viewer.kind === "staff" || i.instructor_id !== viewer.instructorId)
      .map((i) => i.name ?? "Unnamed"),
    lesson,
    objective: row.objective ?? null,
    agenda: row.agenda ?? null,
    materials: row.materials ?? null,
    roster,
    notes: report?.notes ?? "",
    flagged: report?.flagged === 1,
    flagReason: report?.flag_reason ?? "",
    finalized,
    reportedAt: report?.reported_at != null ? Number(report.reported_at) : null,
    attendance: resolveAttendanceLock({
      sessionStatus: row.status ?? "scheduled",
      classStatus: row.class_status,
      startsAt,
      finalized,
      rosterSize: roster.length,
      now,
    }),
    backHref: viewer.kind === "instructor" ? `/app/teach/classes/${row.class_id}` : `/app/classes/${row.class_id}`,
    viewer: viewer.kind,
  };
}
