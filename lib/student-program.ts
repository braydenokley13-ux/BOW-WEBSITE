/* ============================================================
 * lib/student-program.ts — the student's real-world program enrolment.
 *
 * The student home is otherwise entirely the self-paced Playbook. A student
 * who is enrolled in an actual BOW class had no way to see it: which program
 * they are in, when they next meet, or where. This resolves exactly that,
 * and nothing else — no administrative metadata, no operations vocabulary.
 *
 * Returns null when the signed-in user has no student record or no active
 * enrolment, which is the normal case for self-paced-only learners; callers
 * render nothing rather than an empty shell.
 *
 * Server-only.
 * ============================================================ */

import { getDb } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface StudentSession {
  id: string;
  /** Epoch ms. */
  startsAt: number;
  location: string | null;
  /** True when the session falls on today's calendar date. */
  isToday: boolean;
}

export interface StudentProgram {
  classId: string;
  classTitle: string;
  programName: string | null;
  locationName: string | null;
  /** The next session that has not finished, if any. */
  next: StudentSession | null;
  /** Sessions after `next`, soonest first. */
  upcoming: StudentSession[];
  sessionsAttended: number;
  sessionsSoFar: number;
}

function sameCalendarDay(a: number, b: number): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
  );
}

/**
 * Resolve the signed-in student's current class, next session and attendance
 * so far. `now` is injectable so callers and tests can pin the clock.
 */
export async function getStudentProgram(userId: string, now = Date.now()): Promise<StudentProgram | null> {
  const db = getDb();

  const student = (await db
      .prepare("SELECT id FROM students WHERE user_id = ? LIMIT 1")
      .get(userId)) as { id: string } | undefined;
  if (!student) return null;

  const row = (await db
      .prepare(
        `SELECT c.id AS class_id, c.title AS class_title, p.name AS program_name, l.name AS location_name
           FROM class_enrollments ce
           JOIN classes c ON c.id = ce.class_id
      LEFT JOIN programs p ON p.id = c.program_id
      LEFT JOIN locations l ON l.id = c.location_id
          WHERE ce.student_id = ? AND ce.status = 'enrolled'
            AND c.status NOT IN ('completed', 'cancelled')
       ORDER BY c.start_date DESC
          LIMIT 1`,
      )
      .get(student.id)) as
    | { class_id: string; class_title: string; program_name: string | null; location_name: string | null }
    | undefined;
  if (!row) return null;

  const sessions = (await db
      .prepare(
        "SELECT id, session_date, location FROM class_sessions WHERE class_id = ? ORDER BY session_date",
      )
      .all(row.class_id)) as { id: string; session_date: number; location: string | null }[];

  // A session stays "next" for the rest of its calendar day rather than
  // disappearing the moment its start time passes — a student looking at
  // this in the afternoon should still see where they are going.
  const toSession = (s: (typeof sessions)[number]): StudentSession => ({
    id: s.id,
    startsAt: Number(s.session_date),
    location: s.location,
    isToday: sameCalendarDay(Number(s.session_date), now),
  });
  const remaining = sessions
    .filter((s) => Number(s.session_date) >= now - DAY_MS || sameCalendarDay(Number(s.session_date), now))
    .map(toSession);

  const past = sessions.filter((s) => Number(s.session_date) < now && !sameCalendarDay(Number(s.session_date), now));
  const attended = past.length
    ? Number(
        (
          (await db
              .prepare(
                `SELECT COUNT(*) AS n FROM attendance_records
                  WHERE student_id = ? AND present = 1
                    AND session_id IN (${past.map(() => "?").join(",")})`,
              )
              .get(student.id, ...past.map((s) => s.id))) as { n: number }
        ).n,
      )
    : 0;

  return {
    classId: row.class_id,
    classTitle: row.class_title,
    programName: row.program_name,
    locationName: row.location_name,
    next: remaining[0] ?? null,
    upcoming: remaining.slice(1, 4),
    sessionsAttended: attended,
    sessionsSoFar: past.length,
  };
}
