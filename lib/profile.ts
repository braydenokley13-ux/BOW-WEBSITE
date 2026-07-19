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
import { getCertificate, CERT_TRACK, CERT_TRACK_201, CERT_TRACK_TITLE } from "@/lib/certificate";
import { TRACK_101, TRACK_201 } from "@/lib/account";

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
  /* ---- Track 201 (Feature 1) ---- */
  modules201: ProfileModule[];
  modules201Completed: number;
  total201Modules: number;
  track201CertificateEarned: boolean;
  track201Unlocked: boolean;
  eastfieldCompleted: boolean;
  /* ---- Community + weekly (Features 3 & 4) ---- */
  discussionPosts: number;
  weeklyCompletions: number;
  /* ---- Daily Question + Streak (Features 1 & 2) ---- */
  dailyCorrect: number;
  dailyAnswered: number;
  currentStreak: number;
  longestStreak: number;
  /** Null until BOW records an active guardian-approved sharing consent. */
  publicProfilePath: string | null;
}

export interface PublicProfile {
  publicSlug: string;
  name: string;
  rank: BowRank;
  modulesCompleted: number;
  totalModules: number;
  certificateEarned: boolean;
  modules201Completed: number;
  total201Modules: number;
  track201CertificateEarned: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Quiz MC correct/answered across the student's completed modules (both tracks). */
function quizScore(studentId: string): { correct: number; answered: number } {
  let correct = 0;
  let answered = 0;
  for (const track of [TRACK_101, TRACK_201]) {
    for (const s of getQuizModuleSections(studentId, track)) {
      if (!s.unlocked) continue;
      correct += s.mcCorrect;
      answered += s.mcAnswered;
    }
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
  const cert = getCertificate(studentId, CERT_TRACK);

  // Track 201 modules + certificate (Feature 1).
  const mods201 = getSelfModules(TRACK_201);
  const modules201: ProfileModule[] = mods201.map((m) => {
    const p = prog[m.id];
    return { ordinal: m.ordinal, title: m.title, completed: !!p?.completed, completedAt: p?.completedAt ?? null };
  });
  const modules201Completed = modules201.filter((m) => m.completed).length;
  const cert201 = getCertificate(studentId, CERT_TRACK_201);
  const sharing = getDb()
    .prepare(
      `SELECT public_slug
       FROM profile_sharing_consents
       WHERE student_user_id = ? AND revoked_at IS NULL
         AND guardian_verified_at IS NOT NULL AND expires_at > ?
       ORDER BY granted_at DESC
       LIMIT 1`,
    )
    .get(studentId, Date.now()) as { public_slug: string } | undefined;

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
    modulesCompleted: modules.filter((m) => m.completed).length,
    totalModules: mods.length,
    reflectionExcerpts,
    quizMcCorrect: qs.correct,
    quizMcAnswered: qs.answered,
    quizScorePct: qs.answered > 0 ? Math.round((qs.correct / qs.answered) * 100) : null,
    scenarioCount: stats.scenariosSubmitted,
    reflectionCount: stats.reflectionsSubmitted,
    certificateEarned: !!cert,
    certificateIssuedAt: cert?.issuedAt ?? null,
    simulationCompleted: stats.simulationCompleted,
    modules201,
    modules201Completed,
    total201Modules: mods201.length,
    track201CertificateEarned: !!cert201,
    track201Unlocked: !!cert,
    eastfieldCompleted: stats.eastfieldCompleted,
    discussionPosts: stats.discussionPosts,
    weeklyCompletions: stats.weeklyCompletions,
    dailyCorrect: stats.dailyCorrect,
    dailyAnswered: stats.dailyCorrect + stats.dailyIncorrect,
    currentStreak: stats.currentStreak,
    longestStreak: score?.longestStreak ?? 0,
    publicProfilePath: sharing ? `/profile/${sharing.public_slug}` : null,
  };
}

export interface PublicProfileRecord {
  profile: PublicProfile;
  studentUserId: string;
}

function minimizedStudentName(first: string, fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  return `${first.trim() || parts[0] || "BOW Student"}${last ? ` ${last.charAt(0).toUpperCase()}.` : ""}`;
}

/**
 * Resolve a guardian-approved, revocable public credential by high-entropy
 * sharing slug. Internal user ids are never accepted as public URLs.
 */
export function getPublicProfileRecord(publicSlug: string): PublicProfileRecord | null {
  const u = getDb()
    .prepare(
      `SELECT u.id, u.name, u.first, c.public_slug
       FROM profile_sharing_consents c
       JOIN users u ON u.id = c.student_user_id
       JOIN organizations o ON o.id = u.org_id AND o.status = 'active'
       WHERE c.public_slug = ?
         AND c.revoked_at IS NULL
         AND c.guardian_verified_at IS NOT NULL
         AND c.expires_at > ?
         AND u.role = 'student'
         AND u.status = 'active'
         AND u.deletion_requested = 0
         AND EXISTS (
           SELECT 1 FROM enrollments e
           WHERE e.user_id = u.id AND e.enroll = 'active'
         )
       LIMIT 1`,
    )
    .get(publicSlug, Date.now()) as any;
  if (!u) return null;

  const studentId = String(u.id);

  const score = getStudentScore(studentId, 0);
  if (!score) return null;
  const prog = getSelfProgressMap(studentId);
  const mods101 = getSelfModules(TRACK_101);
  const mods201 = getSelfModules(TRACK_201);
  const completedIn = (ms: { id: string }[]) => ms.filter((m) => prog[m.id]?.completed).length;

  return {
    studentUserId: studentId,
    profile: {
      publicSlug: String(u.public_slug),
      name: minimizedStudentName(String(u.first ?? ""), String(u.name ?? "")),
      rank: score.rank,
      modulesCompleted: completedIn(mods101),
      totalModules: mods101.length,
      certificateEarned: !!getCertificate(studentId, CERT_TRACK),
      modules201Completed: completedIn(mods201),
      total201Modules: mods201.length,
      track201CertificateEarned: !!getCertificate(studentId, CERT_TRACK_201),
    },
  };
}

export function getPublicProfile(publicSlug: string): PublicProfile | null {
  return getPublicProfileRecord(publicSlug)?.profile ?? null;
}

/* eslint-enable @typescript-eslint/no-explicit-any */
