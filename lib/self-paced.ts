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
  TRACK_101,
  TRACK_201,
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

/** Self-paced modules for a track, ordered (DB first, falling back to the seed). */
export function getSelfModules(track: string = TRACK_101): SelfModule[] {
  const rows = getDb()
    .prepare("SELECT * FROM self_modules WHERE COALESCE(track, '101') = ? ORDER BY ordinal ASC")
    .all(track) as any[];
  if (rows.length === 0) {
    return [...selfModuleSeed].filter((m) => m.track === track).sort((a, b) => a.ordinal - b.ordinal);
  }
  return rows.map((r) => ({
    id: r.id,
    ordinal: Number(r.ordinal),
    title: r.title,
    summary: r.summary,
    concept: r.concept,
    centralQuestion: r.central_question,
    track: r.track ?? TRACK_101,
  }));
}

/** Look up a single module's track from its id (seed first, then DB). */
export function trackForModule(moduleId: string): string {
  const seed = selfModuleSeed.find((m) => m.id === moduleId);
  if (seed) return seed.track;
  const row = getDb().prepare("SELECT track FROM self_modules WHERE id = ?").get(moduleId) as any;
  return row?.track ?? TRACK_101;
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

/** True once the student has been issued a certificate for a track. */
export function hasCertificate(studentId: string, track: string = TRACK_101): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM certificates WHERE student_id = ? AND track = ? LIMIT 1")
    .get(studentId, track);
  return !!row;
}

/**
 * The student's modules for a track with the unlock rule applied.
 *
 * Track 101: Module 1 is always open. Every later module unlocks when the one
 * before it is marked complete AND its reflection clears
 * {@link SELF_MIN_REFLECTION_WORDS} — or when an instructor has manually
 * unlocked it (the `instructor_unlocked` override).
 *
 * Track 201: the whole track stays locked until the student has earned their
 * Track 101 certificate. Once earned, Module 201-1 opens and the same sequential
 * rule applies.
 */
export function getSelfModuleViews(studentId: string, track: string = TRACK_101): SelfModuleView[] {
  const mods = getSelfModules(track);
  const prog = getSelfProgressMap(studentId);
  const views: SelfModuleView[] = [];
  // Track 201's gate is the Track 101 certificate.
  const trackGateOpen = track === TRACK_201 ? hasCertificate(studentId, TRACK_101) : true;
  let prevGateMet = false; // first module ignores this (it's first)

  mods.forEach((m, i) => {
    const p = prog[m.id];
    const completed = !!p?.completed;
    const reflection = p?.reflection ?? "";
    const reflectionWords = p?.reflectionWords ?? reflectionWordCount(reflection);
    const reflectionMet = reflectionWords >= SELF_MIN_REFLECTION_WORDS;
    const instructorUnlocked = !!p?.instructorUnlocked;
    const isFirst = i === 0;
    const unlocked = trackGateOpen && (isFirst || instructorUnlocked || prevGateMet);

    let lockedReason: string | null = null;
    if (!unlocked) {
      if (!trackGateOpen) {
        lockedReason = "Earn your Track 101 certificate to unlock Track 201.";
      } else {
        const prev = mods[i - 1];
        lockedReason = `Complete “${prev.title}” and add a ${SELF_MIN_REFLECTION_WORDS}-word reflection to unlock this module.`;
      }
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
  const track = trackForModule(moduleId);
  return getSelfModuleViews(studentId, track).find((v) => v.module.id === moduleId)?.unlocked ?? false;
}

/** True once the student has completed every module in a track (certificate-eligible). */
export function hasCompletedAllModules(studentId: string, track: string = TRACK_101): boolean {
  const views = getSelfModuleViews(studentId, track);
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
    difficulty: Number(r.difficulty) || 1,
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
      difficulty: s.difficulty,
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
    difficulty: s.difficulty,
    answered: false,
    response: null,
    explanation: null,
    submittedAt: null,
  };
}

/**
 * "How others answered" — the total number of students who have submitted this
 * scenario, plus up to three anonymized 60-char excerpts from OTHER students.
 * Makes the platform feel alive even with a small early user base.
 */
function scenarioCommunity(scenarioId: string, excludeStudentId: string): { totalResponses: number; othersExcerpts: string[] } {
  const db = getDb();
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM scenario_responses WHERE scenario_id = ?").get(scenarioId) as any;
  const rows = db
    .prepare(
      "SELECT response_text FROM scenario_responses WHERE scenario_id = ? AND student_id != ? ORDER BY submitted_at DESC LIMIT 3",
    )
    .all(scenarioId, excludeStudentId) as any[];
  const othersExcerpts = rows
    .map((r) => {
      const t = String(r.response_text ?? "").trim().replace(/\s+/g, " ");
      return t.length > 60 ? `${t.slice(0, 60)}…` : t;
    })
    .filter((t) => t.length > 0);
  return { totalResponses: Number(n) || 0, othersExcerpts };
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
  const view = scenarioView(active, scenarioResponses(studentId)[active.id]);
  // Attach the "How others answered" community data once the student has submitted.
  if (view.answered) {
    const community = scenarioCommunity(active.id, studentId);
    view.totalResponses = community.totalResponses;
    view.othersExcerpts = community.othersExcerpts;
  }
  return view;
}

/**
 * Scenario Archive (Feature 5). Every scenario except this week's active one:
 * answered scenarios show the student's response + the explanation (newest
 * first); scenarios they haven't submitted yet appear locked with only the
 * concept and difficulty visible (the prompt is hidden so it isn't spoiled).
 */
export function getScenarioArchive(studentId: string): DailyScenarioView[] {
  const scenarios = getDailyScenarios();
  if (scenarios.length === 0) return [];
  const activeId = scenarios[activeScenarioIndex(scenarios.length)].id;
  const answers = scenarioResponses(studentId);
  return scenarios
    .filter((s) => s.id !== activeId)
    .map((s): DailyScenarioView => {
      const ans = answers[s.id];
      if (ans) return scenarioView(s, ans);
      return {
        id: s.id,
        ordinal: s.ordinal,
        concept: s.concept,
        scenario: "",
        difficulty: s.difficulty,
        answered: false,
        response: null,
        explanation: null,
        submittedAt: null,
        locked: true,
      };
    })
    .sort((a, b) => {
      // Answered (newest first) on top, then locked scenarios by order.
      if (!!a.locked !== !!b.locked) return a.locked ? 1 : -1;
      if (!a.locked) return (b.submittedAt ?? 0) - (a.submittedAt ?? 0);
      return a.ordinal - b.ordinal;
    });
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

/** Quiz questions for a track, ordered by module then id (DB first, seed fallback). */
export function getQuizQuestions(track: string = TRACK_101): QuizQuestion[] {
  const rows = getDb()
    .prepare("SELECT * FROM quiz_questions WHERE COALESCE(track, '101') = ? ORDER BY module_unlock ASC, id ASC")
    .all(track) as any[];
  if (rows.length === 0) return quizSeed.filter((q) => (q.track ?? TRACK_101) === track);
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
    difficulty: Number(r.difficulty) || 1,
    track: r.track ?? TRACK_101,
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
      difficulty: q.difficulty,
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
    difficulty: q.difficulty,
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
export function getQuizModuleSections(studentId: string, track: string = TRACK_101): QuizModuleSection[] {
  const modules = getSelfModuleViews(studentId, track);
  const questions = getQuizQuestions(track);
  const answers = quizResponses(studentId);

  return modules.map((mv) => {
    const ordinal = mv.module.ordinal;
    // Deliberate order within a module: multiple choice first, then written;
    // easier difficulty first; ids as a stable tiebreak.
    const inModule = questions
      .filter((q) => q.moduleUnlock === ordinal)
      .sort(
        (a, b) =>
          (a.type === b.type ? 0 : a.type === "mc" ? -1 : 1) ||
          a.difficulty - b.difficulty ||
          a.id.localeCompare(b.id),
      );
    const mc = inModule.filter((q) => q.type === "mc");
    const fr = inModule.filter((q) => q.type === "fr");
    const unlocked = mv.completed;

    const mcByDifficulty = [1, 2, 3].map((difficulty) => {
      const inTier = mc.filter((q) => q.difficulty === difficulty);
      return {
        difficulty,
        total: inTier.length,
        correct: inTier.filter((q) => answers[q.id]?.isCorrect === 1).length,
      };
    });

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
      mcByDifficulty,
      mcAllAnswered: mc.length > 0 && mc.every((q) => answers[q.id]),
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

/**
 * Is this user the instructor assigned to the self-paced cohort? The
 * self-paced roster/analytics/leaderboard reads have no cohort picker (there
 * is only ever one self-paced cohort), so this is the one check that keeps
 * them in sync with the ownership check already enforced on the matching
 * write actions (instructorUnlockModule, saveStudentNote, etc. in
 * app/actions/lms.ts) — without it, any instructor account could read every
 * self-paced student's roster, reflections, and notes regardless of
 * assignment, even though they can no longer write to it.
 */
export function isInstructorOfSelfPaced(userId: string): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM cohorts WHERE id = ? AND instructor_id = ?")
    .get(SELF_PACED_COHORT_ID, userId);
  return !!row;
}

/**
 * Is this user ALSO actively enrolled in a cohort-taught (non-self-paced)
 * class? BOW runs two products side by side — this lets a self-paced screen
 * surface a link back to the cohort LMS shell (/app/student) instead of
 * stranding a dual-enrolled student on one side.
 */
export function isEnrolledInCohortClass(userId: string): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM enrollments WHERE user_id = ? AND cohort_id != ? AND enroll = 'active'")
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
