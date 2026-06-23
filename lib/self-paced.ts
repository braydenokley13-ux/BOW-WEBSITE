/* ============================================================
 * Self-Paced Track 101 — read layer (Features 1 & 2).
 *
 * Mirrors lib/feed.ts: server-only helpers that read the system of
 * record (the `self_*` tables) and hand fully-serializable shapes to
 * server components, which pass them to the client dashboards. The
 * unlock rule lives in one place — `getSelfModuleViews` — so the
 * student dashboard, the instructor roster, and the gating server
 * actions all agree on what's open.
 *
 * Server-only. Do not import from a client component.
 * ============================================================ */

import { getDb } from "@/lib/db";
import {
  selfModules as selfModuleSeed,
  dailyScenarios as scenarioSeed,
  quizQuestions as quizSeed,
  reflectionWordCount,
  activeScenarioIndex,
  SELF_MIN_REFLECTION_WORDS,
  SELF_PACED_COHORT_ID,
  SELF_PACED_SESSIONS,
  type SelfModule,
  type SelfModuleProgress,
  type SelfModuleView,
  type SelfRosterEntry,
  type StudentNote,
  type DailyScenario,
  type DailyScenarioView,
  type QuizQuestion,
  type QuizQuestionView,
  type QuizModuleSection,
} from "@/lib/account";

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ---------------- modules ---------------- */

/** The four self-paced modules, ordered (DB first, falling back to the seed). */
export function getSelfModules(): SelfModule[] {
  const rows = getDb().prepare("SELECT * FROM self_modules ORDER BY ordinal ASC").all() as any[];
  if (rows.length === 0) return [...selfModuleSeed].sort((a, b) => a.ordinal - b.ordinal);
  return rows.map((r) => ({
    id: r.id,
    ordinal: Number(r.ordinal),
    title: r.title,
    summary: r.summary,
    concept: r.concept,
    centralQuestion: r.central_question,
  }));
}

/* ---------------- progress ---------------- */

/** A student's per-module progress, keyed by module id. */
export function getSelfProgressMap(studentId: string): Record<string, SelfModuleProgress> {
  const rows = getDb().prepare("SELECT * FROM self_progress WHERE student_id = ?").all(studentId) as any[];
  const map: Record<string, SelfModuleProgress> = {};
  for (const r of rows) {
    const reflection = r.reflection ?? "";
    map[r.module_id] = {
      completed: !!r.completed,
      reflection,
      reflectionWords: Number(r.reflection_words) || reflectionWordCount(reflection),
      instructorUnlocked: !!r.instructor_unlocked,
      completedAt: r.completed_at != null ? Number(r.completed_at) : null,
    };
  }
  return map;
}

/**
 * The student's modules with the unlock rule applied. Module 1 is always open.
 * Every later module unlocks when the one before it is marked complete AND its
 * reflection clears {@link SELF_MIN_REFLECTION_WORDS} — or when an instructor
 * has manually unlocked it (the `instructor_unlocked` override).
 */
export function getSelfModuleViews(studentId: string): SelfModuleView[] {
  const mods = getSelfModules();
  const prog = getSelfProgressMap(studentId);
  const views: SelfModuleView[] = [];
  let prevGateMet = false; // module 1 ignores this (it's first)

  mods.forEach((m, i) => {
    const p = prog[m.id];
    const completed = !!p?.completed;
    const reflection = p?.reflection ?? "";
    const reflectionWords = p?.reflectionWords ?? reflectionWordCount(reflection);
    const reflectionMet = reflectionWords >= SELF_MIN_REFLECTION_WORDS;
    const instructorUnlocked = !!p?.instructorUnlocked;
    const isFirst = i === 0;
    const unlocked = isFirst || instructorUnlocked || prevGateMet;

    let lockedReason: string | null = null;
    if (!unlocked) {
      const prev = mods[i - 1];
      lockedReason = `Complete “${prev.title}” and add a ${SELF_MIN_REFLECTION_WORDS}-word reflection to unlock this module.`;
    }

    views.push({
      module: m,
      unlocked,
      completed,
      reflection,
      reflectionWords,
      reflectionMet,
      instructorUnlocked,
      lockedReason,
    });

    // The gate that opens the NEXT module is this module's completion + reflection.
    prevGateMet = completed && reflectionMet;
  });

  return views;
}

/** True when a specific module is currently accessible to the student. */
export function isSelfModuleUnlocked(studentId: string, moduleId: string): boolean {
  return getSelfModuleViews(studentId).find((v) => v.module.id === moduleId)?.unlocked ?? false;
}

/** True once the student has completed all four modules (certificate-eligible). */
export function hasCompletedAllModules(studentId: string): boolean {
  const views = getSelfModuleViews(studentId);
  return views.length > 0 && views.every((v) => v.completed);
}

/* ---------------- daily feed (real users) ---------------- */

/** Map of story id -> the student's saved decision response. */
export function getStudentFeedResponses(studentId: string): Record<string, string> {
  const rows = getDb().prepare("SELECT story_id, response FROM self_feed_responses WHERE student_id = ?").all(studentId) as any[];
  const map: Record<string, string> = {};
  for (const r of rows) map[r.story_id] = r.response;
  return map;
}

/* ---------------- BOW Daily scenarios (Feature 2) ---------------- */

/** The daily scenarios, ordered (DB first, falling back to the seed). */
export function getDailyScenarios(): DailyScenario[] {
  const rows = getDb().prepare("SELECT * FROM daily_scenarios ORDER BY ordinal ASC").all() as any[];
  if (rows.length === 0) return [...scenarioSeed].sort((a, b) => a.ordinal - b.ordinal);
  return rows.map((r) => ({
    id: r.id,
    ordinal: Number(r.ordinal),
    concept: r.concept,
    scenario: r.scenario,
    explanation: r.explanation,
  }));
}

interface ScenarioAnswer {
  response: string;
  submittedAt: number;
}

/** Map of scenario id -> the student's saved response + timestamp. */
function scenarioResponses(studentId: string): Record<string, ScenarioAnswer> {
  const rows = getDb()
    .prepare("SELECT scenario_id, response_text, submitted_at FROM scenario_responses WHERE student_id = ?")
    .all(studentId) as any[];
  const map: Record<string, ScenarioAnswer> = {};
  for (const r of rows) map[r.scenario_id] = { response: r.response_text, submittedAt: Number(r.submitted_at) || 0 };
  return map;
}

/** Build a scenario view — explanation/response present only once answered. */
function scenarioView(s: DailyScenario, answer: ScenarioAnswer | undefined): DailyScenarioView {
  if (answer) {
    return {
      id: s.id,
      ordinal: s.ordinal,
      concept: s.concept,
      scenario: s.scenario,
      answered: true,
      response: answer.response,
      explanation: s.explanation,
      submittedAt: answer.submittedAt,
    };
  }
  return {
    id: s.id,
    ordinal: s.ordinal,
    concept: s.concept,
    scenario: s.scenario,
    answered: false,
    response: null,
    explanation: null,
    submittedAt: null,
  };
}

/** The id of this week's active scenario (rotates by week number). */
export function activeScenarioId(): string {
  const scenarios = getDailyScenarios();
  if (scenarios.length === 0) return "";
  return scenarios[activeScenarioIndex(scenarios.length)].id;
}

/** The active (this week's) scenario for a student, with their answer if any. */
export function getActiveScenario(studentId: string): DailyScenarioView | null {
  const scenarios = getDailyScenarios();
  if (scenarios.length === 0) return null;
  const active = scenarios[activeScenarioIndex(scenarios.length)];
  return scenarioView(active, scenarioResponses(studentId)[active.id]);
}

/** Previously answered scenarios (excluding this week's), newest first. */
export function getScenarioHistory(studentId: string): DailyScenarioView[] {
  const scenarios = getDailyScenarios();
  if (scenarios.length === 0) return [];
  const activeId = scenarios[activeScenarioIndex(scenarios.length)].id;
  const answers = scenarioResponses(studentId);
  return scenarios
    .filter((s) => s.id !== activeId && answers[s.id])
    .map((s) => scenarioView(s, answers[s.id]))
    .sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0));
}

/* ---------------- Econ Quiz bank (Feature 3) ---------------- */

/** All quiz questions, ordered by module then id (DB first, seed fallback). */
export function getQuizQuestions(): QuizQuestion[] {
  const rows = getDb().prepare("SELECT * FROM quiz_questions ORDER BY module_unlock ASC, id ASC").all() as any[];
  if (rows.length === 0) return [...quizSeed];
  return rows.map((r) => ({
    id: r.id,
    moduleUnlock: Number(r.module_unlock),
    type: r.question_type,
    question: r.question_text,
    choiceA: r.choice_a ?? null,
    choiceB: r.choice_b ?? null,
    choiceC: r.choice_c ?? null,
    choiceD: r.choice_d ?? null,
    correctAnswer: r.correct_answer ?? null,
    explanation: r.explanation,
  }));
}

interface QuizAnswer {
  selectedChoice: string | null;
  responseText: string | null;
  isCorrect: number | null;
}

/** Map of question id -> the student's saved quiz response. */
function quizResponses(studentId: string): Record<string, QuizAnswer> {
  const rows = getDb()
    .prepare("SELECT question_id, selected_choice, response_text, is_correct FROM quiz_responses WHERE student_id = ?")
    .all(studentId) as any[];
  const map: Record<string, QuizAnswer> = {};
  for (const r of rows) {
    map[r.question_id] = {
      selectedChoice: r.selected_choice ?? null,
      responseText: r.response_text ?? null,
      isCorrect: r.is_correct == null ? null : Number(r.is_correct),
    };
  }
  return map;
}

/** Build a question view — the answer key is revealed only once answered. */
function quizQuestionView(q: QuizQuestion, ans: QuizAnswer | undefined): QuizQuestionView {
  const choices =
    q.type === "mc"
      ? [
          { key: "A", text: q.choiceA },
          { key: "B", text: q.choiceB },
          { key: "C", text: q.choiceC },
          { key: "D", text: q.choiceD },
        ]
          .filter((c): c is { key: string; text: string } => c.text != null)
      : [];
  if (ans) {
    return {
      id: q.id,
      type: q.type,
      question: q.question,
      choices,
      answered: true,
      selectedChoice: ans.selectedChoice,
      isCorrect: ans.isCorrect == null ? null : ans.isCorrect === 1,
      responseText: ans.responseText,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
    };
  }
  return {
    id: q.id,
    type: q.type,
    question: q.question,
    choices,
    answered: false,
    selectedChoice: null,
    isCorrect: null,
    responseText: null,
    correctAnswer: null,
    explanation: null,
  };
}

/**
 * The quiz grouped into one section per module (1..N). A section unlocks once
 * the matching module is marked complete; locked sections never ship their
 * questions to the client, so the answer keys can't be peeked. Per-section
 * trackers cover the MC score and FR completion.
 */
export function getQuizModuleSections(studentId: string): QuizModuleSection[] {
  const modules = getSelfModuleViews(studentId);
  const questions = getQuizQuestions();
  const answers = quizResponses(studentId);

  return modules.map((mv) => {
    const ordinal = mv.module.ordinal;
    const inModule = questions.filter((q) => q.moduleUnlock === ordinal);
    const mc = inModule.filter((q) => q.type === "mc");
    const fr = inModule.filter((q) => q.type === "fr");
    const unlocked = mv.completed;

    return {
      moduleOrdinal: ordinal,
      moduleTitle: mv.module.title,
      unlocked,
      lockedReason: unlocked ? null : `Complete “${mv.module.title}” to unlock these questions.`,
      questions: unlocked ? inModule.map((q) => quizQuestionView(q, answers[q.id])) : [],
      mcTotal: mc.length,
      mcAnswered: mc.filter((q) => answers[q.id]).length,
      mcCorrect: mc.filter((q) => answers[q.id]?.isCorrect === 1).length,
      frTotal: fr.length,
      frSubmitted: fr.filter((q) => answers[q.id]).length,
    };
  });
}

/* ---------------- notes ---------------- */

/** The most recent instructor notes for a student (default last 3). */
export function getStudentNotes(studentId: string, limit = 3): StudentNote[] {
  const rows = getDb()
    .prepare(
      "SELECT n.*, u.name AS author_name FROM session_notes n LEFT JOIN users u ON u.id = n.author_id WHERE n.student_id = ? ORDER BY n.created_ts DESC LIMIT ?",
    )
    .all(studentId, limit) as any[];
  return rows.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    authorId: r.author_id,
    authorName: r.author_name ?? "BOW",
    note: r.text,
    createdAt: Number(r.created_ts) || 0,
    createdLabel: r.created_at,
  }));
}

/* ---------------- attendance ---------------- */

/** Present/absent per session for a student, length {@link SELF_PACED_SESSIONS}. */
export function getSelfAttendance(cohortId: string, studentId: string): boolean[] {
  const rows = getDb()
    .prepare("SELECT session_no, present FROM self_attendance WHERE cohort_id = ? AND student_id = ?")
    .all(cohortId, studentId) as any[];
  const arr = Array.from({ length: SELF_PACED_SESSIONS }, () => false);
  for (const r of rows) {
    const i = Number(r.session_no);
    if (i >= 1 && i <= SELF_PACED_SESSIONS) arr[i - 1] = !!r.present;
  }
  return arr;
}

/* ---------------- roster (instructor) ---------------- */

/** Is this user an active student in the self-paced cohort? */
export function isEnrolledSelfPaced(userId: string): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM enrollments WHERE user_id = ? AND cohort_id = ? AND enroll = 'active'")
    .get(userId, SELF_PACED_COHORT_ID);
  return !!row;
}

/** Relative "last active" label from an epoch-ms timestamp. */
function lastActiveLabel(ts: number | null): string {
  if (ts == null) return "Never";
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  return `${Math.floor(days / 30)} mo ago`;
}

/** The full instructor roster for a self-paced cohort. */
export function getSelfRoster(cohortId: string): SelfRosterEntry[] {
  const students = getDb()
    .prepare(
      "SELECT u.* FROM enrollments e JOIN users u ON u.id = e.user_id WHERE e.cohort_id = ? AND e.enroll = 'active' AND u.role = 'student' ORDER BY u.name ASC",
    )
    .all(cohortId) as any[];

  return students.map((u) => {
    const modules = getSelfModuleViews(u.id);
    const completedCount = modules.filter((m) => m.completed).length;
    const reflectionCount = modules.filter((m) => m.reflection.trim() !== "").length;
    const unlockedOrdinals = modules.filter((m) => m.unlocked).map((m) => m.module.ordinal);
    const currentOrdinal = unlockedOrdinals.length ? Math.max(...unlockedOrdinals) : 1;
    const current = modules.find((m) => m.module.ordinal === currentOrdinal)?.module ?? null;
    const attendance = getSelfAttendance(cohortId, u.id);
    const lastActiveAt = u.last_active_at != null ? Number(u.last_active_at) : null;

    return {
      studentId: u.id,
      name: u.name,
      first: u.first,
      email: u.email,
      currentModuleOrdinal: currentOrdinal,
      currentModuleTitle: current?.title ?? "—",
      completedCount,
      totalModules: modules.length,
      reflectionCount,
      lastActiveLabel: lastActiveLabel(lastActiveAt),
      lastActiveAt,
      attendancePresent: attendance.filter(Boolean).length,
      attendanceTotal: SELF_PACED_SESSIONS,
      notes: getStudentNotes(u.id, 3),
      modules,
      attendance,
    };
  });
}

/* eslint-enable @typescript-eslint/no-explicit-any */
