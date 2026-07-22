/* ============================================================
 * lib/learn/home.ts — Stage 7: student home + map data loader.
 *
 * Batched queries via sqlLearn (native postgres.js) — no per-node round
 * trips, no `SELECT doc` in list paths. Builds:
 *   - the UnlockContext shared with app/actions/learn-play.ts's startAttempt
 *     guard (same evaluator, same input shape — see lib/learn/unlock.ts).
 *   - the full CareerMap section/node tree with resolved node states.
 *   - the ContinueCard selection (via lib/learn/continue.ts).
 *   - the IdentityPanel data (career title, skill levels, badges, streak).
 * ============================================================ */

import { sqlLearn } from "@/lib/db-sql";
import { getUserXp, getStreak } from "@/lib/streak";
import { getEarnedBadgeIds, getStudentBadges } from "@/lib/badges";
import { careerTitleFor, skillLevelFor } from "@/lib/learn/levels";
import { evaluateNodeUnlock, type UnlockContext, type UnlockPolicy } from "@/lib/learn/unlock";
import { selectContinueTarget, type ContinueSelection } from "@/lib/learn/continue";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface MapNodeRow {
  id: string;
  section_id: string;
  sort: number;
  kind: "lesson" | "bonus_challenge" | "checkpoint" | "reward";
  lesson_id: string | null;
  layout: Record<string, any>;
  unlock: UnlockPolicy;
}

export interface MapSectionRow {
  id: string;
  track_id: string;
  title: string;
  subtitle: string | null;
  sort: number;
  theme: Record<string, any>;
}

/**
 * Everything the unlock evaluator needs for one student, computed once and
 * reused across every node (not re-queried per node). `released` is
 * resolved per-node by the caller (requiresInstructorRelease is rare, so we
 * only look it up for nodes whose policy actually requires it).
 */
export interface StudentUnlockBasis {
  completedNodes: Set<string>;
  starsTotal: number;
  level: number;
  badges: Set<string>;
  cohortId: string | null;
}

/**
 * A student's active cohort(s) from `enrollments` (legacy dev-bootstrap
 * schema — see docs/learn/stage0-audit.md §3). A student can in principle be
 * enrolled in more than one cohort; release-state resolution treats them as
 * an OR (released in ANY of the student's active cohorts unlocks the node).
 * Returns the first active cohort id for the single-scope call sites
 * (buildUnlockBasis.cohortId) and the full list for release resolution.
 */
export async function loadActiveCohortIds(userId: string): Promise<string[]> {
  const rows = await sqlLearn<{ cohort_id: string }[]>`
    SELECT cohort_id FROM enrollments WHERE user_id = ${userId} AND enroll <> 'inactive'
  `;
  return rows.map((r) => r.cohort_id);
}

/** Node ids the student has completed, keyed by lesson_id -> node_id via the map. */
async function loadCompletedNodeIds(userId: string, nodes: MapNodeRow[]): Promise<Set<string>> {
  const lessonIds = nodes.filter((n) => n.lesson_id).map((n) => n.lesson_id as string);
  if (lessonIds.length === 0) return new Set();
  const rows = await sqlLearn<{ lesson_id: string }[]>`
    SELECT lesson_id FROM learn_lesson_mastery
    WHERE user_id = ${userId} AND lesson_id = ANY(${lessonIds}) AND best_score IS NOT NULL
  `;
  const completedLessons = new Set(rows.map((r) => r.lesson_id));
  return new Set(nodes.filter((n) => n.lesson_id && completedLessons.has(n.lesson_id)).map((n) => n.id));
}

async function loadStarsTotal(userId: string): Promise<number> {
  const rows = await sqlLearn<{ total: number | null }[]>`
    SELECT SUM(best_stars) AS total FROM learn_lesson_mastery WHERE user_id = ${userId}
  `;
  return Number(rows[0]?.total) || 0;
}

async function loadBadgeIds(userId: string): Promise<Set<string>> {
  return getEarnedBadgeIds(userId);
}

/** Build the (mostly) node-independent unlock basis for one student. */
export async function buildUnlockBasis(userId: string, nodes: MapNodeRow[]): Promise<StudentUnlockBasis> {
  const xp = await getUserXp(userId);
  const [completedNodes, starsTotal, badges, cohortIds] = await Promise.all([
    loadCompletedNodeIds(userId, nodes),
    loadStarsTotal(userId),
    loadBadgeIds(userId),
    loadActiveCohortIds(userId),
  ]);
  return { completedNodes, starsTotal, level: careerTitleFor(xp).index, badges, cohortId: cohortIds[0] ?? null };
}

/**
 * Resolve requiresInstructorRelease for the nodes that actually need it
 * (batched). `userId` drives the student-scoped override
 * (`scope_type='student', scope_id=userId`); `cohortIds` drives cohort-wide
 * releases (`scope_type='cohort', scope_id IN cohortIds`) — a node is
 * released if EITHER matches (student override always wins over a locked
 * cohort; a cohort release is not narrowed by the absence of a student row).
 */
async function loadReleasedNodeIds(nodeIds: string[], userId: string, cohortIds: string[]): Promise<Set<string>> {
  if (nodeIds.length === 0) return new Set();
  const now = Date.now();
  const rows = await sqlLearn<{ node_id: string }[]>`
    SELECT DISTINCT node_id FROM learn_release_state
    WHERE node_id = ANY(${nodeIds})
      AND (opens_at IS NULL OR opens_at <= ${now})
      AND (
        (scope_type = 'student' AND scope_id = ${userId})
        OR (scope_type = 'cohort' AND scope_id = ANY(${cohortIds.length ? cohortIds : ["__none__"]}))
      )
  `;
  return new Set(rows.map((r) => r.node_id));
}

/** Evaluate unlock for every node given a precomputed basis + resolved release set. */
export function evaluateAllNodes(
  nodes: MapNodeRow[],
  basis: StudentUnlockBasis,
  releasedNodeIds: Set<string>,
): Map<string, ReturnType<typeof evaluateNodeUnlock>> {
  const result = new Map<string, ReturnType<typeof evaluateNodeUnlock>>();
  for (const node of nodes) {
    const ctx: UnlockContext = {
      completedNodes: basis.completedNodes,
      starsTotal: basis.starsTotal,
      level: basis.level,
      badges: basis.badges,
      now: Date.now(),
      released: node.unlock?.requiresInstructorRelease ? releasedNodeIds.has(node.id) : undefined,
    };
    result.set(node.id, evaluateNodeUnlock({ id: node.id, unlock: node.unlock || {} }, ctx));
  }
  return result;
}

/** Full unlock check for ONE node (used by startAttempt — avoids loading the whole map). */
export async function checkNodeUnlockForLesson(
  userId: string,
  lessonId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const nodeRows = await sqlLearn<MapNodeRow[]>`
    SELECT id, section_id, sort, kind, lesson_id, layout, unlock
    FROM learn_map_nodes WHERE lesson_id = ${lessonId}
  `;
  // Lessons with no map placement (not yet added to a section) are
  // unrestricted by map policy — the map editor's "unplaced" tray handles
  // authoring visibility; play access is not blocked by placement itself.
  if (nodeRows.length === 0) return { ok: true };

  // A lesson can in principle sit on more than one node; require at least
  // one reachable placement to unlock play.
  const cohortIds = await loadActiveCohortIds(userId);

  const basis = await buildUnlockBasis(userId, nodeRows);
  const needsRelease = nodeRows.filter((n) => n.unlock?.requiresInstructorRelease).map((n) => n.id);
  const releasedNodeIds = await loadReleasedNodeIds(needsRelease, userId, cohortIds);

  let lastReason = "This lesson isn't unlocked yet.";
  for (const node of nodeRows) {
    const r = evaluateNodeUnlock(
      { id: node.id, unlock: node.unlock || {} },
      {
        completedNodes: basis.completedNodes,
        starsTotal: basis.starsTotal,
        level: basis.level,
        badges: basis.badges,
        now: Date.now(),
        released: node.unlock?.requiresInstructorRelease ? releasedNodeIds.has(node.id) : undefined,
      },
    );
    if (r.unlocked) return { ok: true };
    lastReason = r.reason;
  }
  return { ok: false, reason: lastReason };
}

/* ---------------- full home payload ---------------- */

export interface CareerMapNodeView {
  id: string;
  kind: MapNodeRow["kind"];
  lessonId: string | null;
  title: string;
  estMinutes: number | null;
  layout: Record<string, any>;
  state: "locked" | "available" | "in_progress" | "completed";
  lockReason: string | null;
  bestStars: number | null;
  bestScore: number | null;
}

export interface CareerMapSectionView {
  id: string;
  title: string;
  subtitle: string | null;
  theme: Record<string, any>;
  nodes: CareerMapNodeView[];
}

export interface IdentityView {
  firstName: string;
  xp: number;
  careerTitle: string;
  nextCareerTitle: string | null;
  careerProgress: number;
  streak: { current: number; longest: number };
  skills: { slug: string; label: string; icon: string | null; level: number; points: number; pointsToNext: number | null; progress: number }[];
  recentBadges: { id: string; name: string; icon: string }[];
}

export interface StudentHomeData {
  identity: IdentityView;
  sections: CareerMapSectionView[];
  continueTarget: ContinueSelection;
}

export async function loadStudentHome(userId: string, firstName: string): Promise<StudentHomeData> {
  const [sectionRows, nodeRows] = await Promise.all([
    sqlLearn<MapSectionRow[]>`SELECT id, track_id, title, subtitle, sort, theme FROM learn_map_sections ORDER BY sort ASC`,
    sqlLearn<(MapNodeRow & { lesson_title: string | null; est_minutes: number | null })[]>`
      SELECT n.id, n.section_id, n.sort, n.kind, n.lesson_id, n.layout, n.unlock,
             l.title AS lesson_title, l.est_minutes
      FROM learn_map_nodes n
      LEFT JOIN learn_lessons l ON l.id = n.lesson_id
      ORDER BY n.sort ASC
    `,
  ]);

  const basis = await buildUnlockBasis(userId, nodeRows);
  const needsRelease = nodeRows.filter((n) => n.unlock?.requiresInstructorRelease).map((n) => n.id);
  const cohortIds = await loadActiveCohortIds(userId);
  const releasedNodeIds = await loadReleasedNodeIds(needsRelease, userId, cohortIds);
  const unlockResults = evaluateAllNodes(nodeRows, basis, releasedNodeIds);

  const lessonIds = nodeRows.filter((n) => n.lesson_id).map((n) => n.lesson_id as string);
  const masteryRows = lessonIds.length
    ? await sqlLearn<{ lesson_id: string; best_score: number | null; best_stars: number | null }[]>`
        SELECT lesson_id, best_score, best_stars FROM learn_lesson_mastery
        WHERE user_id = ${userId} AND lesson_id = ANY(${lessonIds})
      `
    : [];
  const masteryByLesson = new Map(masteryRows.map((r) => [r.lesson_id, r]));

  const inProgressRows = await sqlLearn<{ id: string; lesson_id: string }[]>`
    SELECT id, lesson_id FROM learn_attempts
    WHERE user_id = ${userId} AND mode = 'play' AND status = 'in_progress'
    ORDER BY started_at DESC LIMIT 1
  `;
  const inProgress = inProgressRows[0] ?? null;
  let inProgressBlocks: { answered: number; total: number } | null = null;
  if (inProgress) {
    const rows = await sqlLearn<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM learn_responses WHERE attempt_id = ${inProgress.id} AND committed_at IS NOT NULL
    `;
    inProgressBlocks = { answered: Number(rows[0]?.n) || 0, total: Math.max(1, Number(rows[0]?.n) || 0) + 3 };
  }

  const sections: CareerMapSectionView[] = sectionRows.map((s) => ({
    id: s.id,
    title: s.title,
    subtitle: s.subtitle,
    theme: s.theme,
    nodes: nodeRows
      .filter((n) => n.section_id === s.id)
      .map((n) => {
        const mastery = n.lesson_id ? masteryByLesson.get(n.lesson_id) : undefined;
        const unlockR = unlockResults.get(n.id)!;
        const isInProgress = inProgress?.lesson_id === n.lesson_id;
        let state: CareerMapNodeView["state"] = "locked";
        if (mastery?.best_score != null) state = "completed";
        else if (isInProgress) state = "in_progress";
        else if (unlockR.unlocked) state = "available";
        return {
          id: n.id,
          kind: n.kind,
          lessonId: n.lesson_id,
          title: n.lesson_id ? (n as any).lesson_title ?? "Untitled lesson" : n.kind === "bonus_challenge" ? "Bonus Challenge" : n.kind === "checkpoint" ? "Checkpoint" : "Reward",
          estMinutes: (n as any).est_minutes ?? null,
          layout: n.layout || {},
          state,
          lockReason: unlockR.unlocked ? null : unlockR.reason,
          bestStars: mastery?.best_stars ?? null,
          bestScore: mastery?.best_score ?? null,
        };
      }),
  }));

  const continueTarget = selectContinueTarget(
    nodeRows.map((n) => {
      const mastery = n.lesson_id ? masteryByLesson.get(n.lesson_id) : undefined;
      const section = sectionRows.find((s) => s.id === n.section_id);
      return {
        nodeId: n.id,
        lessonId: n.lesson_id,
        title: n.lesson_id ? (n as any).lesson_title ?? "Untitled lesson" : "",
        moduleTitle: section?.title ?? null,
        estMinutes: (n as any).est_minutes ?? null,
        order: n.sort + (section?.sort ?? 0) * 100000,
        unlocked: unlockResults.get(n.id)?.unlocked ?? false,
        completed: mastery?.best_score != null,
      };
    }),
    inProgress
      ? { nodeId: nodeRows.find((n) => n.lesson_id === inProgress.lesson_id)?.id ?? "", lessonId: inProgress.lesson_id, attemptId: inProgress.id, blocksAnswered: inProgressBlocks!.answered, totalBlocks: inProgressBlocks!.total }
      : null,
  );

  const xp = await getUserXp(userId);
  const streak = await getStreak(userId);
  const career = careerTitleFor(xp);

  const skillRows = await sqlLearn<{ slug: string; label: string; icon: string | null; level: number; points: number }[]>`
    SELECT s.slug, s.label, s.icon, ss.level, ss.points
    FROM learn_student_skills ss JOIN learn_skills s ON s.id = ss.skill_id
    WHERE ss.user_id = ${userId}
    ORDER BY s.sort ASC
  `;
  const skills = skillRows.map((r) => {
    const info = skillLevelFor(r.points);
    return { slug: r.slug, label: r.label, icon: r.icon, level: info.level, points: r.points, pointsToNext: info.pointsToNext, progress: info.progress };
  });

  const badgeRows = (await getStudentBadges(userId)).slice(0, 4);

  return {
    identity: {
      firstName,
      xp,
      careerTitle: career.title,
      nextCareerTitle: career.nextTitle,
      careerProgress: career.progress,
      streak: { current: streak.current, longest: streak.longest },
      skills,
      recentBadges: badgeRows.map((r) => ({ id: r.id, name: r.name, icon: r.icon })),
    },
    sections,
    continueTarget,
  };
}
