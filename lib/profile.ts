/* ============================================================
 * Student profile data (Feature 3) — private + public views.
 *
 * Assembles everything a student has done in BOW into one
 * serializable shape: rank, modules with completion dates,
 * reflection excerpts, quiz score, scenario count, certificate,
 * and simulation status. The public variant deliberately drops
 * reflections and other personal data.
 *
 * Server-only. Do not import from a client component.
 * ============================================================ */

import { getDb } from "@/lib/db";
import { getSelfModules, getSelfProgressMap, getQuizModuleSections } from "@/lib/self-paced";
import { computeStats, getStudentScore, rankFor, bowScore, type BowRank } from "@/lib/scoring";
import { getCertificate, CERT_TRACK_TITLE } from "@/lib/certificate";

export interface ProfileModule {
  ordinal: number;
  title: string;
  completed: boolean;
  completedAt: number | null;
}

export interface ProfileData {
  studentId: string;
  name: string;
  first: string;
  cohortName: string;
  createdAt: number | null;
  trackTitle: string;
  rank: BowRank;
  bowScore: number;
  modules: ProfileModule[];
  modulesCompleted: number;
  totalModules: number;
  reflectionExcerpts: { title: string; excerpt: string }[];
  quizMcCorrect: number;
  quizMcAnswered: number;
  quizScorePct: number | null;
  scenarioCount: number;
  reflectionCount: number;
  certificateEarned: boolean;
  certificateIssuedAt: number | null;
  simulationCompleted: boolean;
}

export interface PublicProfile {
  studentId: string;
  name: string;
  cohortName: string;
  rank: BowRank;
  bowScore: number;
  modulesCompleted: number;
  totalModules: number;
  certificateEarned: boolean;
  quizScorePct: number | null;
  simulationCompleted: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Quiz MC correct/answered across the student's completed modules. */
function quizScore(studentId: string): { correct: number; answered: number } {
  const sections = getQuizModuleSections(studentId);
  let correct = 0;
  let answered = 0;
  for (const s of sections) {
    if (!s.unlocked) continue;
    correct += s.mcCorrect;
    answered += s.mcAnswered;
  }
  return { correct, answered };
}

/** The full private profile for the signed-in student. */
export function getProfileData(studentId: string): ProfileData | null {
  const u = getDb().prepare("SELECT id, name, first, created_at FROM users WHERE id = ?").get(studentId) as any;
  if (!u) return null;

  const score = getStudentScore(studentId, 0);
  const mods = getSelfModules();
  const prog = getSelfProgressMap(studentId);
  const modules: ProfileModule[] = mods.map((m) => {
    const p = prog[m.id];
    return { ordinal: m.ordinal, title: m.title, completed: !!p?.completed, completedAt: p?.completedAt ?? null };
  });

  const reflectionExcerpts = mods
    .map((m) => ({ title: m.title, reflection: (prog[m.id]?.reflection ?? "").trim() }))
    .filter((r) => r.reflection.length > 0)
    .map((r) => ({ title: r.title, excerpt: r.reflection.length > 100 ? `${r.reflection.slice(0, 100)}…` : r.reflection }));

  const stats = computeStats(studentId, 0);
  const qs = quizScore(studentId);
  const cert = getCertificate(studentId);

  return {
    studentId: u.id,
    name: u.name,
    first: u.first,
    cohortName: score?.cohortName ?? "—",
    createdAt: u.created_at != null ? Number(u.created_at) : null,
    trackTitle: CERT_TRACK_TITLE,
    rank: score?.rank ?? rankFor(stats.modulesCompleted, stats.certificateEarned),
    bowScore: score?.bowScore ?? bowScore(stats),
    modules,
    modulesCompleted: stats.modulesCompleted,
    totalModules: mods.length,
    reflectionExcerpts,
    quizMcCorrect: qs.correct,
    quizMcAnswered: qs.answered,
    quizScorePct: qs.answered > 0 ? Math.round((qs.correct / qs.answered) * 100) : null,
    scenarioCount: stats.scenariosSubmitted,
    reflectionCount: stats.reflectionsSubmitted,
    certificateEarned: stats.certificateEarned,
    certificateIssuedAt: cert?.issuedAt ?? null,
    simulationCompleted: stats.simulationCompleted,
  };
}

/** The public, privacy-safe profile (no reflections or personal data). */
export function getPublicProfile(studentId: string): PublicProfile | null {
  const u = getDb().prepare("SELECT id, name, role FROM users WHERE id = ?").get(studentId) as any;
  if (!u || u.role !== "student") return null;

  const score = getStudentScore(studentId, 0);
  if (!score) return null;
  const qs = quizScore(studentId);
  const totalModules = getSelfModules().length;

  return {
    studentId: u.id,
    name: u.name,
    cohortName: score.cohortName,
    rank: score.rank,
    bowScore: score.bowScore,
    modulesCompleted: score.modulesCompleted,
    totalModules,
    certificateEarned: score.certificateEarned,
    quizScorePct: qs.answered > 0 ? Math.round((qs.correct / qs.answered) * 100) : null,
    simulationCompleted: score.simulationCompleted,
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */
