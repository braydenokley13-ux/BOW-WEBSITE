/* ============================================================
 * Badges & Achievements (Daily-Question deep expansion).
 *
 * A badge catalog (reference data, seeded from BADGE_CATALOG in db.ts)
 * plus the per-student award engine. Earning a badge is sticky — once
 * awarded it is never revoked — and each badge carries an XP reward that
 * the submit action banks into the student's wallet.
 *
 * Condition model (data-driven by category + threshold):
 *   streak     → longest_streak >= threshold
 *   accuracy   → lifetime correct answers >= threshold
 *   volume     → lifetime answered questions >= threshold
 *   difficulty → first correct answer at difficulty >= threshold (2=Pro, 3=Exec)
 *   special    → bespoke (pioneer = account created before launch)
 *
 * Server-only for the DB functions; the catalog + labels are client-safe.
 * ============================================================ */

import { getDb } from "@/lib/db";

export type BadgeCategory = "streak" | "accuracy" | "difficulty" | "volume" | "special";

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  threshold: number;
  xpReward: number;
}

/** Catalog entry: a Badge plus the copy shown while it is still locked. */
export interface BadgeSeed extends Badge {
  /** Teaser shown in place of the name on a locked card (discovery incentive). */
  lockedHint: string;
}

/** Accounts created before this date earn the BOW Pioneer badge. */
export const PIONEER_BEFORE = Date.parse("2025-09-01T00:00:00Z");

/** Display order + label for each category section on the showcase page. */
export const BADGE_CATEGORY_ORDER: BadgeCategory[] = ["streak", "accuracy", "difficulty", "volume", "special"];
export const BADGE_CATEGORY_LABEL: Record<BadgeCategory, string> = {
  streak: "Streak",
  accuracy: "Accuracy",
  difficulty: "Difficulty",
  volume: "Volume",
  special: "Special",
};

/** The full badge catalog — the single source of truth seeded into `badges`. */
export const BADGE_CATALOG: BadgeSeed[] = [
  // Streak
  { id: "first_flame", name: "First Flame", description: "Started a streak — answered the Daily Question one day.", icon: "🔥", category: "streak", threshold: 1, xpReward: 5, lockedHint: "Answer the Daily Question to light this up…" },
  { id: "week_warrior", name: "Week Warrior", description: "Kept a 7-day streak alive.", icon: "⚡", category: "streak", threshold: 7, xpReward: 25, lockedHint: "Hold a streak for a full week…" },
  { id: "monthly_grind", name: "Monthly Grind", description: "Reached a 30-day streak.", icon: "💎", category: "streak", threshold: 30, xpReward: 100, lockedHint: "Show up every day for a month…" },
  { id: "century_club", name: "Century Club", description: "Reached a 100-day streak.", icon: "🏆", category: "streak", threshold: 100, xpReward: 500, lockedHint: "An elite, long-haul streak awaits…" },
  // Accuracy
  { id: "sharp_eye", name: "Sharp Eye", description: "Answered 5 questions correctly.", icon: "🎯", category: "accuracy", threshold: 5, xpReward: 15, lockedHint: "Stack up a handful of correct answers…" },
  { id: "front_office_ready", name: "Front Office Ready", description: "Answered 25 questions correctly.", icon: "📋", category: "accuracy", threshold: 25, xpReward: 50, lockedHint: "Prove you can read the room — keep getting them right…" },
  { id: "gm_material", name: "GM Material", description: "Answered 75 questions correctly.", icon: "🧠", category: "accuracy", threshold: 75, xpReward: 150, lockedHint: "Front-office-level accuracy is in reach…" },
  // Difficulty
  { id: "pro_debut", name: "Pro Debut", description: "Got your first Pro-level question correct.", icon: "📈", category: "difficulty", threshold: 2, xpReward: 20, lockedHint: "Level up to Pro questions and nail one…" },
  { id: "executive_suite", name: "Executive Suite", description: "Got your first Executive-level question correct.", icon: "👔", category: "difficulty", threshold: 3, xpReward: 50, lockedHint: "Reach the Executive tier and conquer it…" },
  // Volume
  { id: "daily_habit", name: "Daily Habit", description: "Answered 10 questions total.", icon: "📅", category: "volume", threshold: 10, xpReward: 20, lockedHint: "Build the habit — keep answering…" },
  { id: "dedicated", name: "Dedicated", description: "Answered 50 questions total.", icon: "🌟", category: "volume", threshold: 50, xpReward: 75, lockedHint: "Real dedication shows in the reps…" },
  // Special
  { id: "pioneer", name: "BOW Pioneer", description: "Joined BOW before the platform launched.", icon: "🚀", category: "special", threshold: 0, xpReward: 30, lockedHint: "A founding-member honor…" },
];

/* eslint-disable @typescript-eslint/no-explicit-any */

/** All badges from the catalog table, in display order. */
export async function getAllBadges(): Promise<Badge[]> {
  const rows = (await getDb().prepare("SELECT * FROM badges ORDER BY ordinal ASC").all()) as any[];
  if (rows.length === 0) return BADGE_CATALOG.map(stripSeed);
  return rows.map(rowToBadge);
}

function rowToBadge(r: any): Badge {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    icon: r.icon,
    category: r.category as BadgeCategory,
    threshold: Number(r.threshold) || 0,
    xpReward: Number(r.xp_reward) || 0,
  };
}

function stripSeed(s: BadgeSeed): Badge {
  const { lockedHint: _hint, ...badge } = s;
  void _hint;
  return badge;
}

export interface EarnedBadge extends Badge {
  earnedAt: string;
}

/** A student's earned badges, most recent first. */
export async function getStudentBadges(studentId: string): Promise<EarnedBadge[]> {
  const rows = (await getDb()
      .prepare(
        `SELECT b.*, sb.earned_at AS earned_at
       FROM student_badges sb JOIN badges b ON b.id = sb.badge_id
       WHERE sb.student_id = ?
       ORDER BY sb.earned_at DESC, b.ordinal ASC`,
      )
      .all(studentId)) as any[];
  return rows.map((r) => ({ ...rowToBadge(r), earnedAt: String(r.earned_at ?? "") }));
}

/** Set of badge ids this student has already earned. */
export async function getEarnedBadgeIds(studentId: string): Promise<Set<string>> {
  const rows = (await getDb().prepare("SELECT badge_id FROM student_badges WHERE student_id = ?").all(studentId)) as any[];
  return new Set(rows.map((r) => String(r.badge_id)));
}

/** How many badges a student has earned. */
export async function countStudentBadges(studentId: string): Promise<number> {
  const r = (await getDb().prepare("SELECT COUNT(*) AS n FROM student_badges WHERE student_id = ?").get(studentId)) as any;
  return Number(r?.n) || 0;
}

/** The student's most recently earned badge (the "top badge" on the XP board). */
export async function getMostRecentBadge(studentId: string): Promise<Badge | null> {
  const r = (await getDb()
      .prepare(
        `SELECT b.* FROM student_badges sb JOIN badges b ON b.id = sb.badge_id
       WHERE sb.student_id = ? ORDER BY sb.earned_at DESC, b.ordinal DESC LIMIT 1`,
      )
      .get(studentId)) as any;
  return r ? rowToBadge(r) : null;
}

interface BadgeStats {
  longestStreak: number;
  correctCount: number;
  answeredCount: number;
  proCorrect: boolean;
  execCorrect: boolean;
  createdAt: number | null;
}

/** Gather everything the badge conditions need in one pass. */
async function getBadgeStats(studentId: string): Promise<BadgeStats> {
  const db = getDb();
  const u = (await db.prepare("SELECT longest_streak, current_streak, created_at FROM users WHERE id = ?").get(studentId)) as any;
  const counts = (await db
      .prepare(
        "SELECT COUNT(*) AS answered, SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct FROM daily_responses WHERE student_id = ?",
      )
      .get(studentId)) as any;
  const diff = (await db
      .prepare(
        `SELECT MAX(CASE WHEN r.is_correct = 1 THEN q.difficulty ELSE 0 END) AS max_correct_diff
       FROM daily_responses r JOIN daily_questions q ON q.id = r.question_id
       WHERE r.student_id = ?`,
      )
      .get(studentId)) as any;
  const maxCorrectDiff = Number(diff?.max_correct_diff) || 0;
  return {
    longestStreak: Math.max(Number(u?.longest_streak) || 0, Number(u?.current_streak) || 0),
    correctCount: Number(counts?.correct) || 0,
    answeredCount: Number(counts?.answered) || 0,
    proCorrect: maxCorrectDiff >= 2,
    execCorrect: maxCorrectDiff >= 3,
    createdAt: u?.created_at != null ? Number(u.created_at) : null,
  };
}

/** True if `stats` satisfy a badge's condition. */
function badgeEarned(badge: Badge, stats: BadgeStats): boolean {
  switch (badge.category) {
    case "streak":
      return stats.longestStreak >= badge.threshold;
    case "accuracy":
      return stats.correctCount >= badge.threshold;
    case "volume":
      return stats.answeredCount >= badge.threshold;
    case "difficulty":
      return badge.threshold >= 3 ? stats.execCorrect : stats.proCorrect;
    case "special":
      // pioneer: created before launch (unknown created_at never qualifies).
      return badge.id === "pioneer" && stats.createdAt != null && stats.createdAt < PIONEER_BEFORE;
    default:
      return false;
  }
}

/**
 * Check every badge condition for a student, award any newly earned badges
 * (INSERT OR IGNORE so it's idempotent), and return ONLY the new ones so the
 * UI can toast them. Called after scoring inside the submit action.
 */
export async function checkAndAwardBadges(studentId: string): Promise<Badge[]> {
  const db = getDb();
  const stats = (await getBadgeStats(studentId));
  const earned = (await getEarnedBadgeIds(studentId));
  const insert = db.prepare("INSERT OR IGNORE INTO student_badges (student_id, badge_id) VALUES (?, ?)");

  const newly: Badge[] = [];
  for (const badge of (await getAllBadges())) {
    if (earned.has(badge.id)) continue;
    if (!badgeEarned(badge, stats)) continue;
    const res = (await insert.run(studentId, badge.id));
    if (Number(res.changes) > 0) newly.push(badge);
  }
  return newly;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

export interface BadgeView extends BadgeSeed {
  earned: boolean;
  earnedAt: string | null;
}

export interface BadgeShowcase {
  totalEarned: number;
  totalPossible: number;
  /** Sum of xpReward across earned badges. */
  totalXp: number;
  groups: { category: BadgeCategory; label: string; badges: BadgeView[] }[];
}

/** Build the grouped earned/locked showcase for the /badges page. */
export async function getBadgeShowcase(studentId: string): Promise<BadgeShowcase> {
  const earnedRows = (await getStudentBadges(studentId));
  const earnedMap = new Map(earnedRows.map((b) => [b.id, b.earnedAt]));

  const views: BadgeView[] = BADGE_CATALOG.map((seed) => ({
    ...seed,
    earned: earnedMap.has(seed.id),
    earnedAt: earnedMap.get(seed.id) ?? null,
  }));

  const groups = BADGE_CATEGORY_ORDER.map((category) => ({
    category,
    label: BADGE_CATEGORY_LABEL[category],
    badges: views.filter((b) => b.category === category),
  })).filter((g) => g.badges.length > 0);

  const totalXp = views.filter((b) => b.earned).reduce((sum, b) => sum + b.xpReward, 0);

  return {
    totalEarned: views.filter((b) => b.earned).length,
    totalPossible: views.length,
    totalXp,
    groups,
  };
}
