/* ============================================================
 * Daily Streak (Feature 2).
 *
 * A streak is the number of consecutive days a student has shown up.
 * Answering the Daily Question counts as the daily visit, so
 * `recordDailyVisit` is called from the submitDailyResponse server
 * action. Streak state lives on the `users` table
 * (current_streak / longest_streak / last_active_date).
 *
 * Server-only for the DB functions. Label helpers are client-safe.
 * ============================================================ */

import { getDb } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Day boundaries are computed in UTC, matching the rest of the app. */
function utcIso(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Milestones that fire a `streak_milestone` notification. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60] as const;

export interface StreakState {
  current: number;
  longest: number;
  lastActiveDate: string | null;
}

export interface RecordVisitResult extends StreakState {
  /** True when this call advanced (or started) the streak today. */
  advanced: boolean;
  /** The milestone hit by this visit (3/7/14/30/60), or null. */
  milestone: number | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Read a student's current XP total. */
export async function getUserXp(studentId: string): Promise<number> {
  const r = (await getDb().prepare("SELECT xp FROM users WHERE id = ?").get(studentId)) as any;
  return Number(r?.xp) || 0;
}

/** Read a student's streak state. */
export async function getStreak(studentId: string): Promise<StreakState> {
  const r = (await getDb()
      .prepare("SELECT current_streak, longest_streak, last_active_date FROM users WHERE id = ?")
      .get(studentId)) as any;
  return {
    current: Number(r?.current_streak) || 0,
    longest: Number(r?.longest_streak) || 0,
    lastActiveDate: r?.last_active_date ?? null,
  };
}

/**
 * Record a daily visit and update the streak. Idempotent within a day:
 *  - last visit was today  → no change.
 *  - last visit was yesterday → increment.
 *  - older or never → reset to 1.
 * `longest_streak` is always kept at the max seen.
 */
export async function recordDailyVisit(studentId: string, now: number = Date.now()): Promise<RecordVisitResult> {
  const db = getDb();
  const before = (await getStreak(studentId));
  const today = utcIso(now);
  const yesterday = utcIso(now - DAY_MS);

  if (before.lastActiveDate === today) {
    // Already counted today — no streak change.
    return { ...before, advanced: false, milestone: null };
  }

  const current = before.lastActiveDate === yesterday ? before.current + 1 : 1;
  const longest = Math.max(before.longest, current);
  (await db.prepare(
        "UPDATE users SET current_streak = ?, longest_streak = ?, last_active_date = ? WHERE id = ?",
      ).run(current, longest, today, studentId));

  const milestone = (STREAK_MILESTONES as readonly number[]).includes(current) ? current : null;
  return { current, longest, lastActiveDate: today, advanced: true, milestone };
}

/** The top students by current streak (admin overview). */
export async function getStreakLeaders(limit = 3): Promise<{ id: string; name: string; current: number }[]> {
  const rows = (await getDb()
      .prepare(
        "SELECT id, name, current_streak FROM users WHERE role = 'student' AND COALESCE(current_streak, 0) > 0 ORDER BY current_streak DESC, name ASC LIMIT ?",
      )
      .all(limit)) as any[];
  return rows.map((r) => ({ id: r.id, name: r.name, current: Number(r.current_streak) || 0 }));
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * The streak badge shown next to a student's name.
 *  0 → null (show nothing). 1–6 → "🔥 N". 7–29 → "🔥 N — on fire".
 *  30+ → "🔥 N — LEGENDARY".
 */
export function streakLabel(current: number): string | null {
  if (current <= 0) return null;
  if (current >= 30) return `🔥 ${current} — LEGENDARY`;
  if (current >= 7) return `🔥 ${current} — on fire`;
  return `🔥 ${current}`;
}
