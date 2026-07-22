/* ============================================================
 * Retention leaderboards (Daily-Question deep expansion).
 *
 * Two boards built on direct SQLite queries, no caching:
 *   • Streak — current streak desc, ties broken by longest streak.
 *   • XP     — all-time XP desc, with badge count + most-recent badge.
 *
 * Eligibility matches the BOW Score board: active student accounts with
 * an active enrollment. Names are privacy-safe (first + last initial).
 *
 * Server-only.
 * ============================================================ */

import { getDb } from "@/lib/db";
import { publicNameFor } from "@/lib/scoring";
import { countStudentBadges, getMostRecentBadge } from "@/lib/badges";

export type LeaderboardType = "streak" | "xp";

export interface LeaderboardRow {
  studentId: string;
  /** 1-based position on this board. */
  position: number;
  /** Privacy-safe display name (first + last initial). */
  displayName: string;
  /** Curriculum track: "101" or "201". */
  track: string;
  currentStreak: number;
  longestStreak: number;
  xp: number;
  /** XP board only (0 on the streak board). */
  badgeCount: number;
  /** XP board only — the most recently earned badge's icon, if any. */
  topBadgeIcon: string | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

interface BaseRow {
  id: string;
  name: string;
  first: string;
  currentStreak: number;
  longestStreak: number;
  xp: number;
  track: string;
}

/** Eligible students, ordered for the requested board. */
async function eligibleOrdered(type: LeaderboardType, orgId: string | null = null): Promise<BaseRow[]> {
  const rows = (await getDb()
      .prepare(
        `SELECT u.id, u.name, u.first,
              COALESCE(u.current_streak, 0) AS current_streak,
              COALESCE(u.longest_streak, 0) AS longest_streak,
              COALESCE(u.xp, 0) AS xp,
              CASE WHEN EXISTS (SELECT 1 FROM certificates c WHERE c.student_id = u.id AND c.track = '101')
                   THEN '201' ELSE '101' END AS track
       FROM users u
       JOIN organizations o ON o.id = u.org_id AND o.status = 'active'
       WHERE u.role = 'student' AND u.status = 'active'
         AND (?::text IS NULL OR u.org_id = ?::text)
         AND EXISTS (SELECT 1 FROM enrollments e WHERE e.user_id = u.id AND e.enroll = 'active')`,
      )
      .all(orgId, orgId)) as any[];

  const mapped: BaseRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    first: r.first,
    currentStreak: Number(r.current_streak) || 0,
    longestStreak: Number(r.longest_streak) || 0,
    xp: Number(r.xp) || 0,
    track: r.track === "201" ? "201" : "101",
  }));

  if (type === "streak") {
    mapped.sort(
      (a, b) => b.currentStreak - a.currentStreak || b.longestStreak - a.longestStreak || a.name.localeCompare(b.name),
    );
  } else {
    mapped.sort((a, b) => b.xp - a.xp || b.longestStreak - a.longestStreak || a.name.localeCompare(b.name));
  }
  return mapped;
}

async function toRow(r: BaseRow, position: number, withBadges: boolean): Promise<LeaderboardRow> {
  return {
    studentId: r.id,
    position,
    displayName: publicNameFor(r.name, r.first),
    track: r.track,
    currentStreak: r.currentStreak,
    longestStreak: r.longestStreak,
    xp: r.xp,
    badgeCount: withBadges ? (await countStudentBadges(r.id)) : 0,
    topBadgeIcon: withBadges ? ((await getMostRecentBadge(r.id))?.icon ?? null) : null,
  };
}

/** Top 25 students by current streak (ties broken by longest streak). */
export async function getStreakLeaderboard(orgId: string | null = null): Promise<LeaderboardRow[]> {
  return (await Promise.all((await eligibleOrdered("streak", orgId))
      .slice(0, 25)
      .map(async (r, i) => (await toRow(r, i + 1, false)))));
}

/** Top 25 students by all-time XP, with badge count + most recent badge. */
export async function getXPLeaderboard(orgId: string | null = null): Promise<LeaderboardRow[]> {
  return (await Promise.all((await eligibleOrdered("xp", orgId))
      .slice(0, 25)
      .map(async (r, i) => (await toRow(r, i + 1, true)))));
}

/** A student's 1-based rank on the given board (0 if not eligible). */
export async function getStudentRank(studentId: string, type: LeaderboardType, orgId: string | null = null): Promise<number> {
  const idx = (await eligibleOrdered(type, orgId)).findIndex((r) => r.id === studentId);
  return idx >= 0 ? idx + 1 : 0;
}

/** A student's full row on the given board (for the "Your Rank" card), or null. */
export async function getStudentLeaderboardRow(studentId: string, type: LeaderboardType, orgId: string | null = null): Promise<LeaderboardRow | null> {
  const ordered = (await eligibleOrdered(type, orgId));
  const idx = ordered.findIndex((r) => r.id === studentId);
  if (idx < 0) return null;
  return (await toRow(ordered[idx], idx + 1, type === "xp"));
}

/* eslint-enable @typescript-eslint/no-explicit-any */
