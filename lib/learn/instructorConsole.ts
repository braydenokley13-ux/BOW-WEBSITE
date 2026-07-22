/* ============================================================
 * lib/learn/instructorConsole.ts — Stage 8 follow-up: roster data loader.
 *
 * Backs the instructor console (app/app/instructor/learn/page.tsx) — per-
 * student lesson status/scores/stars/last-activity for a cohort, read from
 * the NEW attempt tables (learn_attempts / learn_lesson_mastery /
 * learn_assignment_progress), not the legacy lesson_progress table. Native
 * postgres.js (sqlLearn) for the learn_* tables; lib/db.ts's pool for the
 * legacy cohorts/enrollments/users tables, matching the split already used
 * by app/actions/learn-release.ts.
 * ============================================================ */

import { getDb } from "@/lib/db";
import { sqlLearn } from "@/lib/db-sql";

export interface InstructorCohort {
  id: string;
  name: string;
}

export interface RosterLessonStatus {
  lessonId: string;
  lessonTitle: string;
  status: "not_started" | "in_progress" | "completed";
  bestScore: number | null;
  bestStars: number | null;
}

export interface RosterStudent {
  userId: string;
  name: string;
  email: string;
  lessons: RosterLessonStatus[];
  lastActivityAt: number | null;
}

/** Cohorts the given user instructs (empty for a student/admin-without-cohorts). */
export async function loadInstructorCohorts(instructorUserId: string): Promise<InstructorCohort[]> {
  const db = getDb();
  const rows = (await db.prepare("SELECT id, name FROM cohorts WHERE instructor_id = ? ORDER BY name ASC").all(
    instructorUserId,
  )) as { id: string; name: string }[];
  return rows;
}

export interface ReleasableMapNode {
  id: string;
  lessonTitle: string;
  requiresInstructorRelease: boolean;
}

/**
 * Map nodes that carry a `requiresInstructorRelease` unlock policy — the
 * only nodes release-controls can meaningfully act on (a node without the
 * policy is never gated by learn_release_state in the first place, see
 * lib/learn/unlock.ts). Nodes without a lesson (bonus/checkpoint/reward
 * stops) are included too since release-state can target any node.
 */
export async function loadReleasableMapNodes(): Promise<ReleasableMapNode[]> {
  const rows = await sqlLearn<{ id: string; unlock: { requiresInstructorRelease?: boolean }; lesson_title: string | null; kind: string }[]>`
    SELECT n.id, n.unlock, n.kind, l.title AS lesson_title
    FROM learn_map_nodes n LEFT JOIN learn_lessons l ON l.id = n.lesson_id
    ORDER BY n.sort ASC
  `;
  return rows
    .filter((r) => r.unlock?.requiresInstructorRelease)
    .map((r) => ({ id: r.id, lessonTitle: r.lesson_title ?? `(${r.kind})`, requiresInstructorRelease: true }));
}

/** Roster with per-lesson status for a cohort — every published lesson x every active student. */
export async function loadCohortRoster(cohortId: string): Promise<RosterStudent[]> {
  const db = getDb();
  const students = (await db.prepare(
    `SELECT u.id, u.name, u.email FROM enrollments e JOIN users u ON u.id = e.user_id
     WHERE e.cohort_id = ? AND e.enroll <> 'inactive' ORDER BY u.name ASC`,
  ).all(cohortId)) as { id: string; name: string; email: string }[];
  if (students.length === 0) return [];

  const userIds = students.map((s) => s.id);

  const [lessons, progressRows, masteryRows, lastActivityRows] = await Promise.all([
    sqlLearn<{ id: string; title: string }[]>`
      SELECT id, title FROM learn_lessons WHERE published_version_id IS NOT NULL ORDER BY title ASC
    `,
    sqlLearn<{ user_id: string; lesson_id: string; status: string }[]>`
      SELECT user_id, lesson_id, status FROM learn_assignment_progress
      WHERE context_type = 'cohort' AND context_id = ${cohortId} AND user_id = ANY(${userIds})
    `,
    sqlLearn<{ user_id: string; lesson_id: string; best_score: number | null; best_stars: number | null }[]>`
      SELECT user_id, lesson_id, best_score, best_stars FROM learn_lesson_mastery WHERE user_id = ANY(${userIds})
    `,
    sqlLearn<{ user_id: string; last: number | null }[]>`
      SELECT user_id, MAX(GREATEST(started_at, COALESCE(completed_at, 0))) AS last
      FROM learn_attempts WHERE user_id = ANY(${userIds}) GROUP BY user_id
    `,
  ]);

  const progressByKey = new Map(progressRows.map((r) => [`${r.user_id}:${r.lesson_id}`, r.status]));
  const masteryByKey = new Map(masteryRows.map((r) => [`${r.user_id}:${r.lesson_id}`, r]));
  const lastByUser = new Map(lastActivityRows.map((r) => [r.user_id, r.last]));

  return students.map((s) => ({
    userId: s.id,
    name: s.name,
    email: s.email,
    lastActivityAt: lastByUser.get(s.id) ?? null,
    lessons: lessons.map((l) => {
      const key = `${s.id}:${l.id}`;
      const mastery = masteryByKey.get(key);
      const status = (progressByKey.get(key) as RosterLessonStatus["status"] | undefined) ?? "not_started";
      return {
        lessonId: l.id,
        lessonTitle: l.title,
        status,
        bestScore: mastery?.best_score ?? null,
        bestStars: mastery?.best_stars ?? null,
      };
    }),
  }));
}
