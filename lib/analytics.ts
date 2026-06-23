/* ============================================================
 * Cohort analytics (Feature 8) — instructor + admin.
 *
 * Aggregates a cohort's students into the figures the instructor
 * dashboard visualizes as progress bars and the weekly digest reads
 * from. Server-only; built on lib/scoring + lib/self-paced reads.
 *
 * Server-only. Do not import from a client component.
 * ============================================================ */

import { getDb } from "@/lib/db";
import { getSelfModules, getSelfModuleViews, getQuizModuleSections } from "@/lib/self-paced";
import { getStudentScore, computeStats } from "@/lib/scoring";

export interface ModuleBucket {
  ordinal: number;
  title: string;
  /** Students whose furthest unlocked module is this one. */
  count: number;
}

export interface QuizModuleAvg {
  ordinal: number;
  title: string;
  /** Average MC % across students who have answered any MC here (null if none). */
  avgPct: number | null;
  answeredStudents: number;
}

export interface CohortAnalytics {
  cohortId: string;
  cohortName: string;
  studentCount: number;
  avgBowScore: number;
  topBowScore: number;
  moduleDistribution: ModuleBucket[];
  quizAvgByModule: QuizModuleAvg[];
  scenarioRatePct: number;
  simulationRatePct: number;
  certificateRatePct: number;
  reflectionRatePct: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Active student-role user ids in a cohort. */
function cohortStudentIds(cohortId: string): string[] {
  const rows = getDb()
    .prepare(
      "SELECT u.id FROM enrollments e JOIN users u ON u.id = e.user_id WHERE e.cohort_id = ? AND e.enroll = 'active' AND u.role = 'student'",
    )
    .all(cohortId) as any[];
  return rows.map((r) => r.id as string);
}

const pct = (num: number, den: number): number => (den > 0 ? Math.round((num / den) * 100) : 0);

/** Full analytics for one cohort. */
export function getCohortAnalytics(cohortId: string): CohortAnalytics {
  const cohort = getDb().prepare("SELECT name FROM cohorts WHERE id = ?").get(cohortId) as any;
  const modules = getSelfModules();
  const ids = cohortStudentIds(cohortId);
  const n = ids.length;

  const moduleDistribution: ModuleBucket[] = modules.map((m) => ({ ordinal: m.ordinal, title: m.title, count: 0 }));
  const quizAcc: { ordinal: number; title: string; sumPct: number; answered: number }[] = modules.map((m) => ({
    ordinal: m.ordinal,
    title: m.title,
    sumPct: 0,
    answered: 0,
  }));

  let scoreSum = 0;
  let topScore = 0;
  let scenarioStudents = 0;
  let simStudents = 0;
  let certStudents = 0;
  let reflectionStudents = 0;

  for (const id of ids) {
    const score = getStudentScore(id, 0);
    if (score) {
      scoreSum += score.bowScore;
      topScore = Math.max(topScore, score.bowScore);
    }
    const stats = computeStats(id, 0);
    if (stats.scenariosSubmitted > 0) scenarioStudents++;
    if (stats.simulationCompleted) simStudents++;
    if (stats.certificateEarned) certStudents++;
    if (stats.reflectionsSubmitted > 0) reflectionStudents++;

    // Furthest unlocked module → distribution bucket.
    const views = getSelfModuleViews(id);
    const unlocked = views.filter((v) => v.unlocked).map((v) => v.module.ordinal);
    const current = unlocked.length ? Math.max(...unlocked) : 1;
    const bucket = moduleDistribution.find((b) => b.ordinal === current);
    if (bucket) bucket.count++;

    // Quiz % per module for students who answered MC there.
    const sections = getQuizModuleSections(id);
    for (const s of sections) {
      if (s.mcAnswered > 0) {
        const acc = quizAcc.find((q) => q.ordinal === s.moduleOrdinal);
        if (acc) {
          acc.sumPct += (s.mcCorrect / s.mcAnswered) * 100;
          acc.answered++;
        }
      }
    }
  }

  return {
    cohortId,
    cohortName: cohort?.name ?? "Cohort",
    studentCount: n,
    avgBowScore: n > 0 ? Math.round(scoreSum / n) : 0,
    topBowScore: topScore,
    moduleDistribution,
    quizAvgByModule: quizAcc.map((q) => ({
      ordinal: q.ordinal,
      title: q.title,
      avgPct: q.answered > 0 ? Math.round(q.sumPct / q.answered) : null,
      answeredStudents: q.answered,
    })),
    scenarioRatePct: pct(scenarioStudents, n),
    simulationRatePct: pct(simStudents, n),
    certificateRatePct: pct(certStudents, n),
    reflectionRatePct: pct(reflectionStudents, n),
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */
