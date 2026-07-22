/* ============================================================
 * lib/learn/levels.ts — Stage 7: shared skill-level threshold scale.
 *
 * Skill levels are progression attributes, not psychometrics (plan §5):
 * "Strategy · Level 7" with a points bar. `learn_student_skills.points` is
 * cumulative and only rises; `skillLevelFor` maps cumulative points onto a
 * level via a fixed threshold table so the level shown on the student home
 * (IdentityPanel) and any future skills page compute identically.
 * ============================================================ */

/** Cumulative points required to REACH each level; index = level. Level 0
 * is "unranked" (no points yet). Level 1 starts a real skill bar. */
export const SKILL_LEVEL_THRESHOLDS = [0, 25, 60, 110, 175, 260, 370, 510, 690, 920, 1200];

export interface SkillLevelInfo {
  level: number;
  /** Points earned since the current level's threshold. */
  pointsIntoLevel: number;
  /** Points needed to reach the next level, or null if at max level. */
  pointsToNext: number | null;
  /** 0–1 progress fraction toward the next level (1 if maxed). */
  progress: number;
}

/** Map cumulative skill points onto a level (thresholded scale). */
export function skillLevelFor(points: number): SkillLevelInfo {
  const p = Math.max(0, points);
  let level = 0;
  for (let i = SKILL_LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (p >= SKILL_LEVEL_THRESHOLDS[i]) {
      level = i;
      break;
    }
  }
  const floor = SKILL_LEVEL_THRESHOLDS[level];
  const nextThreshold = SKILL_LEVEL_THRESHOLDS[level + 1];
  if (nextThreshold === undefined) {
    return { level, pointsIntoLevel: p - floor, pointsToNext: null, progress: 1 };
  }
  const span = nextThreshold - floor;
  const into = p - floor;
  return { level, pointsIntoLevel: into, pointsToNext: nextThreshold - p, progress: span > 0 ? into / span : 1 };
}

/* ---------------- career titles (XP-based, distinct from skill levels) ---------------- */

/**
 * Career title ladder — the plan's "Career + Franchise hybrid": identity is
 * Rookie Analyst -> GM, driven by `users.xp` (not the legacy 4-rank
 * module-based ladder in lib/scoring.ts, which stays untouched for the old
 * dashboard/leaderboard). Escalated to main re: ladder shape (see Stage 7
 * memo) — this is the resolved, extended ladder.
 */
export interface CareerTitle {
  title: string;
  minXp: number;
}

export const CAREER_LADDER: CareerTitle[] = [
  { title: "Rookie Analyst", minXp: 0 },
  { title: "Scouting Analyst", minXp: 150 },
  { title: "Data Analyst", minXp: 400 },
  { title: "Senior Analyst", minXp: 800 },
  { title: "Assistant Director", minXp: 1400 },
  { title: "Director of Operations", minXp: 2200 },
  { title: "VP of Football Ops", minXp: 3200 },
  { title: "Assistant GM", minXp: 4500 },
  { title: "General Manager", minXp: 6000 },
];

export interface CareerTitleInfo {
  title: string;
  index: number;
  xpIntoTitle: number;
  xpToNext: number | null;
  nextTitle: string | null;
  progress: number;
}

/** Map lifetime XP onto a career title + progress toward the next title. */
export function careerTitleFor(xp: number): CareerTitleInfo {
  const x = Math.max(0, xp);
  let idx = 0;
  for (let i = CAREER_LADDER.length - 1; i >= 0; i--) {
    if (x >= CAREER_LADDER[i].minXp) {
      idx = i;
      break;
    }
  }
  const floor = CAREER_LADDER[idx].minXp;
  const next = CAREER_LADDER[idx + 1];
  if (!next) {
    return { title: CAREER_LADDER[idx].title, index: idx, xpIntoTitle: x - floor, xpToNext: null, nextTitle: null, progress: 1 };
  }
  const span = next.minXp - floor;
  const into = x - floor;
  return {
    title: CAREER_LADDER[idx].title,
    index: idx,
    xpIntoTitle: into,
    xpToNext: next.minXp - x,
    nextTitle: next.title,
    progress: span > 0 ? into / span : 1,
  };
}
