/* ============================================================
 * BOW Score, ranks, and leaderboard (Features 3, 4 & 7).
 *
 * One formula, one rank ladder, read live from SQLite — shared by
 * the student profile, the global/cohort leaderboards, and the
 * instructor + admin analytics. Time-scoped variants power the
 * leaderboard's All Time / This Month / This Week filters.
 *
 * Server-only. Do not import from a client component.
 * ============================================================ */

import { getDb } from "@/lib/db";
import { SELF_PACED_COHORT_ID } from "@/lib/account";

/** BOW Score weights. Certificates and simulations are one-time bonuses. */
export const SCORE_WEIGHTS = {
  module: 100,
  mcCorrect: 10,
  scenario: 15,
  reflection: 20,
  certificate: 200,
  simulation: 150,
  /** The Track 201 "Front Office" sim is harder than the Track 101 one. */
  eastfield: 200,
  /** Discussion posts: +5 each, capped at +50 (10 posts = full bonus). */
  post: 5,
  postMax: 50,
  /** Weekly Challenge completion: +25 each. */
  weekly: 25,
  /** Daily Question: +3 correct, +1 for showing up, capped at +150 total. */
  dailyCorrect: 3,
  dailyIncorrect: 1,
  dailyMax: 150,
  /** Streak bonus: current_streak × 2, capped at +100. */
  streakPerDay: 2,
  streakMax: 100,
} as const;

export interface ScoreStats {
  modulesCompleted: number;
  mcCorrect: number;
  scenariosSubmitted: number;
  reflectionsSubmitted: number;
  /** True if ANY certificate exists (drives the rank ladder — implies Track 101). */
  certificateEarned: boolean;
  /** Number of certificates earned (Track 101 + Track 201) — each scores once. */
  certificatesEarned: number;
  /** The Track 101 Westbrook Wolves simulation. */
  simulationCompleted: boolean;
  /** The Track 201 Eastfield Eagles ("The Front Office") simulation. */
  eastfieldCompleted: boolean;
  /** Discussion posts authored (Feature 3). */
  discussionPosts: number;
  /** Weekly Challenge completions (Feature 4). */
  weeklyCompletions: number;
  /** Daily Questions answered correctly (Feature 1). */
  dailyCorrect: number;
  /** Daily Questions answered incorrectly (Feature 1) — partial credit for showing up. */
  dailyIncorrect: number;
  /** Current consecutive-day streak (Feature 2) — live, not time-windowed. */
  currentStreak: number;
}

export interface BowRank {
  key: "rookie" | "scout" | "analyst" | "front-office";
  name: string;
  description: string;
}

export interface StudentScore {
  studentId: string;
  name: string;
  first: string;
  /** Privacy-safe display name for public leaderboards: "Jordan A." */
  publicName: string;
  cohortId: string | null;
  cohortName: string;
  bowScore: number;
  rank: BowRank;
  /** All-time module completion + certificate (drives the rank ladder). */
  modulesCompleted: number;
  certificateEarned: boolean;
  simulationCompleted: boolean;
  lastActiveAt: number | null;
  /** Current consecutive-day streak (Feature 2) — leaderboard secondary stat. */
  currentStreak: number;
  longestStreak: number;
  /** 1-based position once placed in a sorted leaderboard. */
  position?: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Raw activity counts for a student, optionally scoped to events at/after `sinceTs`. */
export function computeStats(studentId: string, sinceTs = 0): ScoreStats {
  const db = getDb();
  const one = (sql: string): number => Number((db.prepare(sql).get(studentId, sinceTs) as any)?.n) || 0;
  const exists = (sql: string): boolean => !!(db.prepare(sql).get(studentId, sinceTs) as any);

  return {
    modulesCompleted: one(
      "SELECT COUNT(*) AS n FROM self_progress WHERE student_id = ? AND completed = 1 AND COALESCE(completed_at, 0) >= ?",
    ),
    mcCorrect: one(
      "SELECT COUNT(*) AS n FROM quiz_responses WHERE student_id = ? AND is_correct = 1 AND COALESCE(submitted_at, 0) >= ?",
    ),
    scenariosSubmitted: one(
      "SELECT COUNT(*) AS n FROM scenario_responses WHERE student_id = ? AND COALESCE(submitted_at, 0) >= ?",
    ),
    reflectionsSubmitted: one(
      "SELECT COUNT(*) AS n FROM self_progress WHERE student_id = ? AND TRIM(reflection) != '' AND COALESCE(updated_at, 0) >= ?",
    ),
    certificateEarned: exists(
      "SELECT 1 FROM certificates WHERE student_id = ? AND COALESCE(issued_at, 0) >= ? LIMIT 1",
    ),
    certificatesEarned: one(
      "SELECT COUNT(*) AS n FROM certificates WHERE student_id = ? AND COALESCE(issued_at, 0) >= ?",
    ),
    simulationCompleted: exists(
      "SELECT 1 FROM simulations WHERE student_id = ? AND completed = 1 AND COALESCE(sim_type, 'westbrook') = 'westbrook' AND COALESCE(created_at, 0) >= ? LIMIT 1",
    ),
    eastfieldCompleted: exists(
      "SELECT 1 FROM simulations WHERE student_id = ? AND completed = 1 AND sim_type = 'eastfield' AND COALESCE(created_at, 0) >= ? LIMIT 1",
    ),
    discussionPosts: one(
      "SELECT COUNT(*) AS n FROM discussion_posts WHERE user_id = ? AND COALESCE(created_at, 0) >= ?",
    ),
    weeklyCompletions: one(
      "SELECT COUNT(*) AS n FROM weekly_completions WHERE student_id = ? AND COALESCE(submitted_at, 0) >= ?",
    ),
    dailyCorrect: one(
      "SELECT COUNT(*) AS n FROM daily_responses WHERE student_id = ? AND is_correct = 1 AND COALESCE(responded_at, 0) >= ?",
    ),
    dailyIncorrect: one(
      "SELECT COUNT(*) AS n FROM daily_responses WHERE student_id = ? AND is_correct = 0 AND COALESCE(responded_at, 0) >= ?",
    ),
    // Streak is a live, current-state value (not windowed by sinceTs).
    currentStreak: Number(
      (db.prepare("SELECT current_streak FROM users WHERE id = ?").get(studentId) as any)?.current_streak,
    ) || 0,
  };
}

/** The BOW Score for a set of activity counts. */
export function bowScore(s: ScoreStats): number {
  return (
    s.modulesCompleted * SCORE_WEIGHTS.module +
    s.mcCorrect * SCORE_WEIGHTS.mcCorrect +
    s.scenariosSubmitted * SCORE_WEIGHTS.scenario +
    s.reflectionsSubmitted * SCORE_WEIGHTS.reflection +
    s.certificatesEarned * SCORE_WEIGHTS.certificate +
    (s.simulationCompleted ? SCORE_WEIGHTS.simulation : 0) +
    (s.eastfieldCompleted ? SCORE_WEIGHTS.eastfield : 0) +
    Math.min(s.discussionPosts * SCORE_WEIGHTS.post, SCORE_WEIGHTS.postMax) +
    s.weeklyCompletions * SCORE_WEIGHTS.weekly +
    Math.min(
      s.dailyCorrect * SCORE_WEIGHTS.dailyCorrect + s.dailyIncorrect * SCORE_WEIGHTS.dailyIncorrect,
      SCORE_WEIGHTS.dailyMax,
    ) +
    Math.min(s.currentStreak * SCORE_WEIGHTS.streakPerDay, SCORE_WEIGHTS.streakMax)
  );
}

/** The BOW Rank ladder (Feature 3). Front Office requires the certificate. */
export function rankFor(modulesCompleted: number, certificateEarned: boolean): BowRank {
  if (modulesCompleted >= 4 && certificateEarned) {
    return { key: "front-office", name: "Front Office", description: "You earned a seat at the table — Track 101, complete." };
  }
  if (modulesCompleted >= 3) {
    return { key: "analyst", name: "Analyst", description: "You break down the numbers behind every front-office call." };
  }
  if (modulesCompleted === 2) {
    return { key: "scout", name: "Scout", description: "You’re reading the game and spotting value others miss." };
  }
  return { key: "rookie", name: "Rookie", description: "Every front office starts here. Keep stacking good decisions." };
}

/** The ordered rank ladder, lowest to highest. */
export const RANK_LADDER: BowRank[] = [
  rankFor(0, false),
  rankFor(2, false),
  rankFor(3, false),
  rankFor(4, true),
];

/** The student's current rank, computed from all-time progress. */
export function rankForStudent(studentId: string): BowRank {
  const s = computeStats(studentId, 0);
  return rankFor(s.modulesCompleted, s.certificateEarned);
}

/** The name of the rank above `key`, or null if already at the top. */
export function nextRankName(key: BowRank["key"]): string | null {
  const idx = RANK_LADDER.findIndex((r) => r.key === key);
  return idx >= 0 && idx < RANK_LADDER.length - 1 ? RANK_LADDER[idx + 1].name : null;
}

/** A student's primary cohort (active enrollment, preferring the self-paced cohort). */
export function getStudentCohort(studentId: string): { id: string; name: string } | null {
  const row = getDb()
    .prepare(
      `SELECT e.cohort_id AS id, c.name AS name
       FROM enrollments e JOIN cohorts c ON c.id = e.cohort_id
       WHERE e.user_id = ? AND e.enroll = 'active'
       ORDER BY (e.cohort_id = ?) DESC
       LIMIT 1`,
    )
    .get(studentId, SELF_PACED_COHORT_ID) as any;
  return row ? { id: row.id, name: row.name } : null;
}

/** The last-initial display form of a name: "Jordan Avery" -> "Jordan A." */
export function publicNameFor(name: string, first: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  const initial = last ? `${last[0].toUpperCase()}.` : "";
  return [first || parts[0] || "Student", initial].filter(Boolean).join(" ");
}

/**
 * A student's full score row. `bowScore` reflects the selected window (sinceTs),
 * while the rank ladder always uses all-time module + certificate progress so a
 * rank is a durable achievement, not a weekly figure.
 */
export function getStudentScore(studentId: string, sinceTs = 0): StudentScore | null {
  const u = getDb()
    .prepare("SELECT id, name, first, last_active_at, current_streak, longest_streak FROM users WHERE id = ?")
    .get(studentId) as any;
  if (!u) return null;

  const windowStats = computeStats(studentId, sinceTs);
  const allTime = sinceTs === 0 ? windowStats : computeStats(studentId, 0);
  const cohort = getStudentCohort(studentId);

  return {
    studentId: u.id,
    name: u.name,
    first: u.first,
    publicName: publicNameFor(u.name, u.first),
    cohortId: cohort?.id ?? null,
    cohortName: cohort?.name ?? "—",
    bowScore: bowScore(windowStats),
    rank: rankFor(allTime.modulesCompleted, allTime.certificateEarned),
    modulesCompleted: allTime.modulesCompleted,
    certificateEarned: allTime.certificateEarned,
    simulationCompleted: allTime.simulationCompleted,
    lastActiveAt: u.last_active_at != null ? Number(u.last_active_at) : null,
    currentStreak: Number(u.current_streak) || 0,
    longestStreak: Number(u.longest_streak) || 0,
  };
}

/** Active student-role users eligible for the leaderboard. */
function eligibleStudentIds(): string[] {
  const rows = getDb()
    .prepare(
      "SELECT DISTINCT u.id FROM users u JOIN enrollments e ON e.user_id = u.id WHERE u.role = 'student' AND u.status != 'invited' AND e.enroll = 'active'",
    )
    .all() as any[];
  return rows.map((r) => r.id as string);
}

export interface LeaderboardOptions {
  /** Only count activity at/after this epoch-ms (0 = all time). */
  sinceTs?: number;
  /** Restrict to a single cohort. */
  cohortId?: string | null;
}

/** The ranked leaderboard. Sorted by BOW Score (desc), then name. Positions assigned. */
export function getLeaderboard({ sinceTs = 0, cohortId = null }: LeaderboardOptions = {}): StudentScore[] {
  let scores = eligibleStudentIds()
    .map((id) => getStudentScore(id, sinceTs))
    .filter((s): s is StudentScore => s !== null);
  if (cohortId) scores = scores.filter((s) => s.cohortId === cohortId);
  scores.sort((a, b) => b.bowScore - a.bowScore || a.name.localeCompare(b.name));
  scores.forEach((s, i) => (s.position = i + 1));
  return scores;
}

export type LeaderboardRange = "all" | "month" | "week";

/** The epoch-ms cutoff for a leaderboard time window (0 = all time). */
export function rangeSince(range: LeaderboardRange): number {
  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  if (range === "week") return now - 7 * DAY;
  if (range === "month") return now - 30 * DAY;
  return 0;
}

/** Cohorts that currently have at least one eligible student (for the filter). */
export function getLeaderboardCohorts(): { id: string; name: string }[] {
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT c.id AS id, c.name AS name
       FROM cohorts c JOIN enrollments e ON e.cohort_id = c.id JOIN users u ON u.id = e.user_id
       WHERE u.role = 'student' AND u.status != 'invited' AND e.enroll = 'active'
       ORDER BY c.name ASC`,
    )
    .all() as any[];
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

/* eslint-enable @typescript-eslint/no-explicit-any */
