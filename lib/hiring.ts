/* ============================================================
 * BOW HQ data layer — instructor lifecycle, training, classes,
 * students, tasks. Parallel to lib/account.ts; the LMS module
 * (cohorts/enrollments/lesson_progress) is untouched.
 *
 * Server-only (imports lib/db).
 * ============================================================ */

import {
  getDb,
  rowToPerson,
  rowToInstructor,
  rowToCurriculum,
  rowToTrainingModule,
  rowToTrainingSession,
  rowToClass,
  rowToStudent,
  rowToTask,
} from "@/lib/db";

/* ---------------- types ---------------- */

export interface Person {
  id: string;
  name: string;
  email: string;
  phone: string;
  userId: string | null;
  createdAt: number;
  updatedAt: number;
}

export type InstructorStage =
  | "applied" | "reviewing" | "interview_scheduled" | "interviewed" | "founder_review"
  | "accepted" | "onboarding" | "training" | "practice_evaluation" | "eligible"
  | "active" | "rejected" | "inactive";

export type OnboardingStatus = "not_started" | "in_progress" | "complete";
export type TrainingStatus = "not_started" | "in_progress" | "complete" | "behind";
export type EligibilityStatus = "not_eligible" | "eligible";

export interface Instructor {
  id: string;
  personId: string;
  stage: InstructorStage;
  source: string | null;
  ownerUserId: string | null;
  /** JSON blob of application answers. */
  answers: string;
  interviewAt: number | null;
  interviewNotes: string | null;
  founderDecision: string | null;
  decidedBy: string | null;
  decidedAt: number | null;
  onboardingStatus: OnboardingStatus;
  trainingStatus: TrainingStatus;
  eligibilityStatus: EligibilityStatus;
  createdAt: number;
  updatedAt: number;
}

export interface InstructorAvailability {
  id: string;
  instructorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  notes: string | null;
  createdAt: number;
}

export interface TrainingModule {
  id: string;
  title: string;
  category: "onboarding" | "training";
  required: boolean;
  contentType: "text" | "link";
  content: string | null;
  ordinal: number;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface TrainingModuleCompletion {
  id: string;
  instructorId: string;
  moduleId: string;
  completedAt: number;
  notes: string | null;
}

export interface TrainingSession {
  id: string;
  title: string;
  scheduledAt: number;
  location: string | null;
  meetingLink: string | null;
  facilitatorUserId: string | null;
  required: boolean;
  facilitatorNotes: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface TrainingSessionRegistration {
  id: string;
  sessionId: string;
  instructorId: string;
  registeredAt: number;
}

export interface TrainingSessionAttendance {
  id: string;
  sessionId: string;
  instructorId: string;
  attended: boolean;
  recordedAt: number;
  recordedBy: string | null;
}

export type PracticeEvalDecision = "pass" | "revise_retry" | "fail";

export interface PracticeEvaluation {
  id: string;
  instructorId: string;
  evaluatorUserId: string | null;
  evaluatedAt: number;
  lessonUsed: string | null;
  ratingCurriculumDelivery: number;
  ratingCommunicationEngagement: number;
  ratingPreparednessReliability: number;
  strengths: string | null;
  concerns: string | null;
  decision: PracticeEvalDecision;
  createdAt: number;
}

export interface Curriculum {
  id: string;
  title: string;
  description: string | null;
  ageRange: string | null;
  published: boolean;
  createdAt: number;
  updatedAt: number;
}

export type ClassStatus = "planning" | "staffing" | "ready_to_launch" | "active" | "completed" | "cancelled";

export interface Class {
  id: string;
  title: string;
  curriculumId: string;
  partnerOrgId: string | null;
  location: string | null;
  onlineFormat: string | null;
  startDate: string | null;
  endDate: string | null;
  recurrence: string | null;
  ageRange: string | null;
  capacity: number | null;
  leadInstructorId: string | null;
  status: ClassStatus;
  internalNotes: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ClassInstructor {
  id: string;
  classId: string;
  instructorId: string;
  role: "lead" | "additional";
  addedAt: number;
}

export interface ClassSession {
  id: string;
  classId: string;
  sessionDate: number;
  location: string | null;
  createdAt: number;
}

export interface ClassSessionReport {
  id: string;
  sessionId: string;
  notes: string | null;
  flagged: boolean;
  flagReason: string | null;
  completed: boolean;
  reportedBy: string | null;
  reportedAt: number;
}

export interface Student {
  id: string;
  name: string;
  age: number | null;
  grade: string | null;
  email: string | null;
  guardianPersonId: string | null;
  emergencyNotes: string | null;
  enrollmentStatus: "active" | "inactive";
  formStatus: "missing" | "submitted" | "complete";
  communicationNotes: string | null;
  userId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ClassEnrollment {
  id: string;
  classId: string;
  studentId: string;
  status: "enrolled" | "waitlisted" | "withdrawn";
  enrolledAt: number;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  present: boolean;
  note: string | null;
  recordedBy: string | null;
  recordedAt: number;
}

export interface ClassProposal {
  id: string;
  instructorId: string;
  title: string;
  ageGroup: string | null;
  curriculumTopic: string | null;
  format: string | null;
  schedule: string | null;
  description: string | null;
  resources: string | null;
  status: "draft" | "submitted" | "approved" | "declined";
  convertedClassId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Task {
  id: string;
  title: string;
  ownerUserId: string | null;
  dueAt: number | null;
  status: "open" | "done";
  entityType: string | null;
  entityId: string | null;
  handoffToFounder: boolean;
  completedAt: number | null;
  completionNote: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CrmActivity {
  id: string;
  entityType: string;
  entityId: string;
  kind: string;
  body: string | null;
  actorUserId: string | null;
  createdAt: number;
}

/* ---------------- derive helpers ---------------- */

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_DAYS = 14;

/** onboarding = required onboarding modules completed vs total. */
export function deriveOnboardingStatus(
  requiredOnboardingModuleIds: string[],
  completedModuleIds: Set<string>,
): OnboardingStatus {
  if (requiredOnboardingModuleIds.length === 0) return "complete";
  const doneCount = requiredOnboardingModuleIds.filter((id) => completedModuleIds.has(id)).length;
  if (doneCount === 0) return "not_started";
  return doneCount === requiredOnboardingModuleIds.length ? "complete" : "in_progress";
}

/**
 * training = required training modules completed vs total, plus a
 * "behind" state when a required training_session the instructor was
 * registered for has passed without an attendance record marking them
 * attended.
 */
export function deriveTrainingStatus(
  requiredTrainingModuleIds: string[],
  completedModuleIds: Set<string>,
  missedRequiredSession: boolean,
): TrainingStatus {
  const total = requiredTrainingModuleIds.length;
  const doneCount = requiredTrainingModuleIds.filter((id) => completedModuleIds.has(id)).length;
  const modulesComplete = total === 0 || doneCount === total;
  if (missedRequiredSession && !modulesComplete) return "behind";
  if (missedRequiredSession) return "behind";
  if (doneCount === 0) return "not_started";
  return modulesComplete ? "complete" : "in_progress";
}

/** eligible = training complete AND latest practice evaluation decision === "pass". */
export function deriveEligibility(trainingStatus: TrainingStatus, latestEvalDecision: PracticeEvalDecision | null): EligibilityStatus {
  return trainingStatus === "complete" && latestEvalDecision === "pass" ? "eligible" : "not_eligible";
}

/** Flags a class needs staffing/launch attention. */
export function classStatusFlags(cls: Class, hasEligibleLead: boolean, enrollmentCount: number) {
  const launchingSoon =
    !!cls.startDate && (() => {
      const t = Date.parse(cls.startDate!);
      return !Number.isNaN(t) && t - Date.now() < 14 * DAY_MS && t - Date.now() > 0;
    })();
  const incompleteSetup = !cls.leadInstructorId || !cls.location || !cls.startDate || !cls.endDate || enrollmentCount === 0;
  return {
    needsInstructor: !hasEligibleLead,
    launchingSoonIncomplete: launchingSoon && incompleteSetup,
  };
}

/**
 * Recompute onboarding_status / training_status / eligibility_status for
 * one instructor and persist them. Call after any module completion,
 * session attendance, or practice evaluation write.
 */
export function recomputeInstructorStatuses(instructorId: string): void {
  const db = getDb();
  const modules = (db.prepare("SELECT * FROM training_modules WHERE active = 1").all() as any[]).map(rowToTrainingModule); // eslint-disable-line @typescript-eslint/no-explicit-any
  const requiredOnboarding = modules.filter((m) => m.category === "onboarding" && m.required).map((m) => m.id);
  const requiredTraining = modules.filter((m) => m.category === "training" && m.required).map((m) => m.id);
  const completed = new Set(
    (db.prepare("SELECT module_id FROM training_module_completions WHERE instructor_id = ?").all(instructorId) as { module_id: string }[]).map(
      (r) => r.module_id,
    ),
  );

  const now = Date.now();
  const missedRequiredSession = !!db
    .prepare(
      `SELECT 1 FROM training_session_registrations reg
       JOIN training_sessions s ON s.id = reg.session_id
       LEFT JOIN training_session_attendance a ON a.session_id = reg.session_id AND a.instructor_id = reg.instructor_id
       WHERE reg.instructor_id = ? AND s.required = 1 AND s.scheduled_at < ? AND (a.attended IS NULL OR a.attended = 0)
       LIMIT 1`,
    )
    .get(instructorId, now);

  const onboardingStatus = deriveOnboardingStatus(requiredOnboarding, completed);
  const trainingStatus = deriveTrainingStatus(requiredTraining, completed, missedRequiredSession);

  const latestEval = db
    .prepare("SELECT decision FROM practice_evaluations WHERE instructor_id = ? ORDER BY evaluated_at DESC LIMIT 1")
    .get(instructorId) as { decision: PracticeEvalDecision } | undefined;
  const eligibilityStatus = deriveEligibility(trainingStatus, latestEval?.decision ?? null);

  db.prepare(
    "UPDATE instructors SET onboarding_status = ?, training_status = ?, eligibility_status = ?, updated_at = ? WHERE id = ?",
  ).run(onboardingStatus, trainingStatus, eligibilityStatus, now, instructorId);
}

/* ---------------- read functions ---------------- */
/* eslint-disable @typescript-eslint/no-explicit-any */

export function listInstructors(): (Instructor & { person: Person | null })[] {
  const db = getDb();
  const instructors = (db.prepare("SELECT * FROM instructors ORDER BY updated_at DESC").all() as any[]).map(rowToInstructor);
  return instructors.map((i) => {
    const p = db.prepare("SELECT * FROM people WHERE id = ?").get(i.personId) as any;
    return { ...i, person: p ? rowToPerson(p) : null };
  });
}

export function getInstructorDetail(id: string) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM instructors WHERE id = ?").get(id) as any;
  if (!row) return null;
  const instructor = rowToInstructor(row);
  const personRow = db.prepare("SELECT * FROM people WHERE id = ?").get(instructor.personId) as any;
  const availability = (db.prepare("SELECT * FROM instructor_availability WHERE instructor_id = ?").all(id) as any[]).map(
    (r): InstructorAvailability => ({
      id: r.id, instructorId: r.instructor_id, dayOfWeek: r.day_of_week, startTime: r.start_time, endTime: r.end_time,
      notes: r.notes ?? null, createdAt: r.created_at,
    }),
  );
  const completions = (db.prepare("SELECT * FROM training_module_completions WHERE instructor_id = ?").all(id) as any[]).map(
    (r): TrainingModuleCompletion => ({ id: r.id, instructorId: r.instructor_id, moduleId: r.module_id, completedAt: r.completed_at, notes: r.notes ?? null }),
  );
  const evaluations = (db.prepare("SELECT * FROM practice_evaluations WHERE instructor_id = ? ORDER BY evaluated_at DESC").all(id) as any[]).map(
    (r): PracticeEvaluation => ({
      id: r.id, instructorId: r.instructor_id, evaluatorUserId: r.evaluator_user_id ?? null, evaluatedAt: r.evaluated_at,
      lessonUsed: r.lesson_used ?? null, ratingCurriculumDelivery: r.rating_curriculum_delivery,
      ratingCommunicationEngagement: r.rating_communication_engagement, ratingPreparednessReliability: r.rating_preparedness_reliability,
      strengths: r.strengths ?? null, concerns: r.concerns ?? null, decision: r.decision, createdAt: r.created_at,
    }),
  );
  return { instructor, person: personRow ? rowToPerson(personRow) : null, availability, completions, evaluations };
}

export function getInstructorByUserId(userId: string): Instructor | null {
  const db = getDb();
  const row = db
    .prepare("SELECT i.* FROM instructors i JOIN people p ON p.id = i.person_id WHERE p.user_id = ? LIMIT 1")
    .get(userId) as any;
  return row ? rowToInstructor(row) : null;
}

export function listTrainingModules(): TrainingModule[] {
  const db = getDb();
  return (db.prepare("SELECT * FROM training_modules WHERE active = 1 ORDER BY category, ordinal").all() as any[]).map(rowToTrainingModule);
}

export function listTrainingSessions(): TrainingSession[] {
  const db = getDb();
  return (db.prepare("SELECT * FROM training_sessions ORDER BY scheduled_at DESC").all() as any[]).map(rowToTrainingSession);
}

export function listClasses(): Class[] {
  const db = getDb();
  return (db.prepare("SELECT * FROM classes ORDER BY updated_at DESC").all() as any[]).map(rowToClass);
}

export function getClassDetail(id: string) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM classes WHERE id = ?").get(id) as any;
  if (!row) return null;
  const cls = rowToClass(row);
  const instructors = db
    .prepare("SELECT ci.*, i.stage FROM class_instructors ci JOIN instructors i ON i.id = ci.instructor_id WHERE ci.class_id = ?")
    .all(id) as any[];
  const sessions = (db.prepare("SELECT * FROM class_sessions WHERE class_id = ? ORDER BY session_date").all(id) as any[]).map(
    (r): ClassSession => ({ id: r.id, classId: r.class_id, sessionDate: r.session_date, location: r.location ?? null, createdAt: r.created_at }),
  );
  const enrollments = (db.prepare("SELECT * FROM class_enrollments WHERE class_id = ?").all(id) as any[]).map(
    (r): ClassEnrollment => ({ id: r.id, classId: r.class_id, studentId: r.student_id, status: r.status, enrolledAt: r.enrolled_at }),
  );
  return { class: cls, instructors, sessions, enrollments };
}

export function listStudents(): Student[] {
  const db = getDb();
  return (db.prepare("SELECT * FROM students ORDER BY updated_at DESC").all() as any[]).map(rowToStudent);
}

export function getStudentDetail(id: string) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM students WHERE id = ?").get(id) as any;
  if (!row) return null;
  const student = rowToStudent(row);
  const guardian = student.guardianPersonId
    ? (db.prepare("SELECT * FROM people WHERE id = ?").get(student.guardianPersonId) as any)
    : null;
  const enrollments = (db.prepare("SELECT * FROM class_enrollments WHERE student_id = ?").all(id) as any[]).map(
    (r): ClassEnrollment => ({ id: r.id, classId: r.class_id, studentId: r.student_id, status: r.status, enrolledAt: r.enrolled_at }),
  );
  return { student, guardian: guardian ? rowToPerson(guardian) : null, enrollments };
}

export function listCurricula(): Curriculum[] {
  const db = getDb();
  return (db.prepare("SELECT * FROM curricula ORDER BY title").all() as any[]).map(rowToCurriculum);
}

export function listTasks(): Task[] {
  const db = getDb();
  return (db.prepare("SELECT * FROM tasks ORDER BY status, due_at").all() as any[]).map(rowToTask);
}

/** Leadership Home buckets — real queries where the underlying tables are ready. */
export function getLeadershipHomeData() {
  const db = getDb();
  const now = Date.now();
  const staleCutoff = now - STALE_DAYS * DAY_MS;

  const newApplications = (db.prepare("SELECT * FROM instructors WHERE stage = 'applied' ORDER BY created_at DESC").all() as any[]).map(rowToInstructor);
  const interviewsToSchedule = (
    db.prepare("SELECT * FROM instructors WHERE stage IN ('applied','reviewing') AND interview_at IS NULL ORDER BY created_at").all() as any[]
  ).map(rowToInstructor);
  const awaitingFounderReview = (db.prepare("SELECT * FROM instructors WHERE stage = 'founder_review' ORDER BY updated_at").all() as any[]).map(
    rowToInstructor,
  );
  const behindOnOnboardingOrTraining = (
    db
      .prepare(
        "SELECT * FROM instructors WHERE stage IN ('onboarding','training') AND (updated_at < ? OR training_status = 'behind') ORDER BY updated_at",
      )
      .all(staleCutoff) as any[]
  ).map(rowToInstructor);
  const practiceEvalsNeeded = (
    db
      .prepare(
        "SELECT i.* FROM instructors i WHERE i.stage = 'practice_evaluation' AND NOT EXISTS (SELECT 1 FROM practice_evaluations e WHERE e.instructor_id = i.id AND e.decision = 'pass') ORDER BY i.updated_at",
      )
      .all() as any[]
  ).map(rowToInstructor);
  const classesWithoutEligibleInstructor = (
    db
      .prepare(
        `SELECT c.* FROM classes c
         WHERE c.status NOT IN ('completed','cancelled')
           AND (c.lead_instructor_id IS NULL
             OR NOT EXISTS (SELECT 1 FROM instructors i WHERE i.id = c.lead_instructor_id AND i.eligibility_status = 'eligible'))
         ORDER BY c.updated_at`,
      )
      .all() as any[]
  ).map(rowToClass);
  const missingStudentForms = (
    db.prepare("SELECT * FROM students WHERE enrollment_status = 'active' AND form_status != 'complete' ORDER BY updated_at").all() as any[]
  ).map(rowToStudent);
  const flaggedSessionReports = db
    .prepare("SELECT * FROM class_session_reports WHERE flagged = 1 AND reported_at > ? ORDER BY reported_at DESC")
    .all(now - STALE_DAYS * DAY_MS) as any[];
  const openFounderHandoffTasks = (
    db.prepare("SELECT * FROM tasks WHERE handoff_to_founder = 1 AND status = 'open' ORDER BY due_at").all() as any[]
  ).map(rowToTask);

  return {
    newApplications,
    interviewsToSchedule,
    awaitingFounderReview,
    behindOnOnboardingOrTraining,
    practiceEvalsNeeded,
    classesWithoutEligibleInstructor,
    // TODO(Phase B): "classes launching <14d with incomplete setup" needs classStatusFlags
    // wired against real enrollment counts + eligible-lead lookups per class.
    classesLaunchingSoonIncomplete: [] as Class[],
    missingStudentForms,
    flaggedSessionReports,
    openFounderHandoffTasks,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
