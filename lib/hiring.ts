/* ============================================================
 * BOW HQ data layer — instructor lifecycle, training, classes,
 * students, tasks. Parallel to lib/account.ts; the LMS module
 * (cohorts/enrollments/lesson_progress) is untouched.
 *
 * Server-only (imports lib/db).
 * ============================================================ */

import { randomBytes, randomUUID } from "node:crypto";
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
import { hashOpaqueToken } from "@/lib/security-tokens";

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
  /** IANA zone used to resolve interviewAt; null only for legacy rows. */
  interviewTimeZone: string | null;
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
  /** IANA zone used to resolve scheduledAt; null only for legacy rows. */
  timeZone: string | null;
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

export type ClassStatus = "planning" | "staffing" | "ready_to_launch" | "active" | "paused" | "completed" | "cancelled";

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
  scheduleDay: number | null;
  scheduleStartTime: string | null;
  scheduleEndTime: string | null;
  scheduleTimezone: string | null;
  ageRange: string | null;
  capacity: number | null;
  minimumEnrollment: number;
  leadInstructorId: string | null;
  programId: string | null;
  locationId: string | null;
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
  timeZone: string | null;
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
  confirmedAt: number | null;
  confirmationSource: string | null;
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
  kind: string;
  ownerUserId: string | null;
  dueAt: number | null;
  /** Canonical YYYY-MM-DD calendar deadline when entered as a date. */
  dueOn: string | null;
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
  pendingRequiredSession: boolean = false,
): TrainingStatus {
  const total = requiredTrainingModuleIds.length;
  const doneCount = requiredTrainingModuleIds.filter((id) => completedModuleIds.has(id)).length;
  const modulesComplete = total === 0 || doneCount === total;
  if (missedRequiredSession) return "behind";
  if (pendingRequiredSession) return "in_progress";
  if (total === 0) return "complete";
  if (doneCount === 0) return "not_started";
  return modulesComplete ? "complete" : "in_progress";
}

/** eligible = onboarding + training complete AND latest practice evaluation passes. */
export function deriveEligibility(
  onboardingStatus: OnboardingStatus,
  trainingStatus: TrainingStatus,
  latestEvalDecision: PracticeEvalDecision | null,
): EligibilityStatus {
  return onboardingStatus === "complete" && trainingStatus === "complete" && latestEvalDecision === "pass"
    ? "eligible"
    : "not_eligible";
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
export async function recomputeInstructorStatuses(instructorId: string): Promise<void> {
  const db = getDb();
  const modules = ((await db.prepare("SELECT * FROM training_modules WHERE active = 1").all()) as any[]).map(rowToTrainingModule); // eslint-disable-line @typescript-eslint/no-explicit-any
  const requiredOnboarding = modules.filter((m) => m.category === "onboarding" && m.required).map((m) => m.id);
  const requiredTraining = modules.filter((m) => m.category === "training" && m.required).map((m) => m.id);
  const completed = new Set(
    ((await db.prepare("SELECT module_id FROM training_module_completions WHERE instructor_id = ?").all(instructorId)) as { module_id: string }[]).map(
      (r) => r.module_id,
    ),
  );

  const now = Date.now();
  const requiredSessionState = (await db
      .prepare(
        `SELECT
         COALESCE(MAX(CASE WHEN s.scheduled_at <= ? AND (a.attended IS NULL OR a.attended = 0) THEN 1 ELSE 0 END), 0) AS missed,
         COALESCE(MAX(CASE WHEN s.scheduled_at > ? AND (a.attended IS NULL OR a.attended = 0) THEN 1 ELSE 0 END), 0) AS pending
       FROM training_session_registrations reg
       JOIN training_sessions s ON s.id = reg.session_id
       LEFT JOIN training_session_attendance a ON a.session_id = reg.session_id AND a.instructor_id = reg.instructor_id
       WHERE reg.instructor_id = ? AND s.required = 1`,
      )
      .get(now, now, instructorId)) as { missed: number; pending: number };

  const onboardingStatus = deriveOnboardingStatus(requiredOnboarding, completed);
  const trainingStatus = deriveTrainingStatus(
    requiredTraining,
    completed,
    requiredSessionState.missed === 1,
    requiredSessionState.pending === 1,
  );

  const latestEval = (await db
      .prepare("SELECT decision FROM practice_evaluations WHERE instructor_id = ? ORDER BY evaluated_at DESC LIMIT 1")
      .get(instructorId)) as { decision: PracticeEvalDecision } | undefined;
  const eligibilityStatus = deriveEligibility(onboardingStatus, trainingStatus, latestEval?.decision ?? null);

  (await db.prepare(
        "UPDATE instructors SET onboarding_status = ?, training_status = ?, eligibility_status = ?, updated_at = ? WHERE id = ?",
      ).run(onboardingStatus, trainingStatus, eligibilityStatus, now, instructorId));
}

/**
 * Time passing is itself a training lifecycle event: an unmet required live
 * session changes from pending to missed when it starts. Refresh only dossiers
 * whose persisted state can have crossed that boundary, so authorization and
 * leadership reads never trust eligibility that is stale merely because no one
 * has performed another write yet.
 */
async function refreshNewlyMissedRequiredTrainingStatuses(instructorId?: string, now: number = Date.now()): Promise<number> {
  const db = getDb();
  const rows = (await db
      .prepare(
        `SELECT DISTINCT i.id
         FROM instructors i
         JOIN training_session_registrations reg ON reg.instructor_id = i.id
         JOIN training_sessions s ON s.id = reg.session_id
         LEFT JOIN training_session_attendance a
           ON a.session_id = reg.session_id AND a.instructor_id = reg.instructor_id
        WHERE i.stage NOT IN ('rejected','inactive')
          AND i.training_status <> 'behind'
          AND s.required = 1
          AND s.scheduled_at <= ?
          AND (a.attended IS NULL OR a.attended = 0)
          AND (?::text IS NULL OR i.id = ?)
        ORDER BY i.id`,
      )
      .all(now, instructorId ?? null, instructorId ?? null)) as { id: string }[];
  for (const instructor of rows) (await recomputeInstructorStatuses(instructor.id));
  return rows.length;
}

/**
 * Re-derive every instructor after the definition of required training changes.
 * Callers hold the writer transaction so no eligibility decision can observe a
 * half-updated population.
 */
export async function recomputeAllInstructorStatuses(): Promise<number> {
  const instructorIds = (await getDb()
      .prepare("SELECT id FROM instructors WHERE stage NOT IN ('rejected','inactive') ORDER BY id")
      .all()) as { id: string }[];
  for (const instructor of instructorIds) (await recomputeInstructorStatuses(instructor.id));
  return instructorIds.length;
}

/* ---------------- read functions ---------------- */
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function listInstructors(): Promise<(Instructor & { person: Person | null })[]> {
  const db = getDb();
  (await refreshNewlyMissedRequiredTrainingStatuses());
  const instructors = ((await db.prepare("SELECT * FROM instructors ORDER BY updated_at DESC").all()) as any[]).map(rowToInstructor);
  return (await Promise.all(instructors.map(async (i) => {
      const p = (await db.prepare("SELECT * FROM people WHERE id = ?").get(i.personId)) as any;
      return { ...i, person: p ? rowToPerson(p) : null };
    })));
}

export async function getInstructorDetail(id: string) {
  const db = getDb();
  (await refreshNewlyMissedRequiredTrainingStatuses(id));
  const row = (await db.prepare("SELECT * FROM instructors WHERE id = ?").get(id)) as any;
  if (!row) return null;
  const instructor = rowToInstructor(row);
  const personRow = (await db.prepare("SELECT * FROM people WHERE id = ?").get(instructor.personId)) as any;
  const availability = ((await db.prepare("SELECT * FROM instructor_availability WHERE instructor_id = ?").all(id)) as any[]).map(
    (r): InstructorAvailability => ({
      id: r.id, instructorId: r.instructor_id, dayOfWeek: r.day_of_week, startTime: r.start_time, endTime: r.end_time,
      notes: r.notes ?? null, createdAt: r.created_at,
    }),
  );
  const completions = ((await db.prepare("SELECT * FROM training_module_completions WHERE instructor_id = ?").all(id)) as any[]).map(
    (r): TrainingModuleCompletion => ({ id: r.id, instructorId: r.instructor_id, moduleId: r.module_id, completedAt: r.completed_at, notes: r.notes ?? null }),
  );
  const evaluations = ((await db.prepare("SELECT * FROM practice_evaluations WHERE instructor_id = ? ORDER BY evaluated_at DESC").all(id)) as any[]).map(
    (r): PracticeEvaluation => ({
      id: r.id, instructorId: r.instructor_id, evaluatorUserId: r.evaluator_user_id ?? null, evaluatedAt: r.evaluated_at,
      lessonUsed: r.lesson_used ?? null, ratingCurriculumDelivery: r.rating_curriculum_delivery,
      ratingCommunicationEngagement: r.rating_communication_engagement, ratingPreparednessReliability: r.rating_preparedness_reliability,
      strengths: r.strengths ?? null, concerns: r.concerns ?? null, decision: r.decision, createdAt: r.created_at,
    }),
  );
  return { instructor, person: personRow ? rowToPerson(personRow) : null, availability, completions, evaluations };
}

export async function getInstructorByUserId(userId: string): Promise<Instructor | null> {
  const db = getDb();
  const statement = db.prepare(
      `SELECT i.*
         FROM instructors i
         JOIN people p ON p.id = i.person_id
        WHERE p.user_id = ?
        ORDER BY
          CASE WHEN i.stage NOT IN ('rejected','inactive') THEN 0 ELSE 1 END,
          CASE WHEN i.stage = 'active' THEN 1 ELSE 0 END,
          i.created_at DESC,
          i.id DESC
        LIMIT 1`,
    );
  let row = (await statement.get(userId)) as any;
  if (row && (await refreshNewlyMissedRequiredTrainingStatuses(String(row.id))) > 0) {
    row = (await statement.get(userId)) as any;
  }
  return row ? rowToInstructor(row) : null;
}

export async function listTrainingModules(): Promise<TrainingModule[]> {
  const db = getDb();
  return ((await db.prepare("SELECT * FROM training_modules WHERE active = 1 ORDER BY category, ordinal").all()) as any[]).map(rowToTrainingModule);
}

export async function listTrainingSessions(): Promise<TrainingSession[]> {
  const db = getDb();
  return ((await db.prepare("SELECT * FROM training_sessions ORDER BY scheduled_at DESC").all()) as any[]).map(rowToTrainingSession);
}

export async function listClasses(): Promise<Class[]> {
  const db = getDb();
  return ((await db.prepare("SELECT * FROM classes ORDER BY updated_at DESC").all()) as any[]).map(rowToClass);
}

export async function getClassDetail(id: string) {
  const db = getDb();
  const row = (await db.prepare("SELECT * FROM classes WHERE id = ?").get(id)) as any;
  if (!row) return null;
  const cls = rowToClass(row);
  const instructors = (await db
      .prepare("SELECT ci.*, i.stage FROM class_instructors ci JOIN instructors i ON i.id = ci.instructor_id WHERE ci.class_id = ? AND ci.removed_at IS NULL")
      .all(id)) as any[];
  const sessions = ((await db.prepare("SELECT * FROM class_sessions WHERE class_id = ? ORDER BY session_date").all(id)) as any[]).map(
    (r): ClassSession => ({
      id: r.id,
      classId: r.class_id,
      sessionDate: r.session_date,
      timeZone: r.timezone ?? null,
      location: r.location ?? null,
      createdAt: r.created_at,
    }),
  );
  const enrollments = ((await db.prepare("SELECT * FROM class_enrollments WHERE class_id = ?").all(id)) as any[]).map(
    (r): ClassEnrollment => ({
      id: r.id,
      classId: r.class_id,
      studentId: r.student_id,
      status: r.status,
      enrolledAt: r.enrolled_at,
      confirmedAt: r.confirmed_at ?? null,
      confirmationSource: r.confirmation_source ?? null,
    }),
  );
  return { class: cls, instructors, sessions, enrollments };
}

export async function listStudents(): Promise<Student[]> {
  const db = getDb();
  return ((await db.prepare("SELECT * FROM students ORDER BY updated_at DESC").all()) as any[]).map(rowToStudent);
}

export async function getStudentDetail(id: string) {
  const db = getDb();
  const row = (await db.prepare("SELECT * FROM students WHERE id = ?").get(id)) as any;
  if (!row) return null;
  const student = rowToStudent(row);
  const guardian = student.guardianPersonId
    ? ((await db.prepare("SELECT * FROM people WHERE id = ?").get(student.guardianPersonId)) as any)
    : null;
  const enrollments = ((await db.prepare("SELECT * FROM class_enrollments WHERE student_id = ?").all(id)) as any[]).map(
    (r): ClassEnrollment => ({
      id: r.id,
      classId: r.class_id,
      studentId: r.student_id,
      status: r.status,
      enrolledAt: r.enrolled_at,
      confirmedAt: r.confirmed_at ?? null,
      confirmationSource: r.confirmation_source ?? null,
    }),
  );
  return { student, guardian: guardian ? rowToPerson(guardian) : null, enrollments };
}

export async function getStudentAttendanceHistory(studentId: string) {
  const db = getDb();
  return (await db
      .prepare(
        `SELECT ar.*, cs.session_date, cs.class_id, c.title AS class_title
       FROM attendance_records ar
       JOIN class_sessions cs ON cs.id = ar.session_id
       JOIN classes c ON c.id = cs.class_id
       WHERE ar.student_id = ?
       ORDER BY cs.session_date DESC`,
      )
      .all(studentId)) as any[];
}

export async function listCurricula(): Promise<Curriculum[]> {
  const db = getDb();
  return ((await db.prepare("SELECT * FROM curricula ORDER BY title").all()) as any[]).map(rowToCurriculum);
}

export async function listTasks(): Promise<Task[]> {
  const db = getDb();
  return ((await db.prepare("SELECT * FROM tasks ORDER BY status, due_at").all()) as any[]).map(rowToTask);
}

/** Instructors eligible to lead/assist a class (stage eligible or active). */
export async function listEligibleInstructors(): Promise<(Instructor & { person: Person | null })[]> {
  const db = getDb();
  (await refreshNewlyMissedRequiredTrainingStatuses());
  const rows = (
    (await db
            .prepare(
              `SELECT * FROM instructors
          WHERE stage IN ('eligible','active')
            AND eligibility_status = 'eligible'
            AND onboarding_status = 'complete'
            AND training_status = 'complete'
          ORDER BY updated_at DESC`,
            )
            .all()) as any[]
  ).map(rowToInstructor);
  return (await Promise.all(rows.map(async (i) => {
      const p = (await db.prepare("SELECT * FROM people WHERE id = ?").get(i.personId)) as any;
      return { ...i, person: p ? rowToPerson(p) : null };
    })));
}

export interface Organization {
  id: string;
  name: string;
  type: string;
  location: string;
  status: string;
}

export async function listOrganizations(): Promise<Organization[]> {
  const db = getDb();
  return (await db.prepare("SELECT * FROM organizations ORDER BY name").all()) as unknown as Organization[];
}

export interface DemoRequest {
  id: string;
  orgSlug: string;
  orgName: string | null;
  requesterName: string;
  requesterEmail: string;
  message: string;
  dispositioned: boolean;
  createdAt: number;
}

/** Website "Request a Demo" submissions, joined to partner_orgs for a display name. Newest first. */
export async function listDemoRequests(): Promise<DemoRequest[]> {
  const db = getDb();
  const rows = (await db
      .prepare(
        `SELECT d.*, p.name AS org_name FROM demo_requests d
       LEFT JOIN partner_orgs p ON p.slug = d.org_slug
       ORDER BY d.created_at DESC`,
      )
      .all()) as any[];
  return rows.map((r) => ({
    id: r.id,
    orgSlug: r.org_slug,
    orgName: r.org_name ?? null,
    requesterName: r.requester_name,
    requesterEmail: r.requester_email,
    message: r.message,
    dispositioned: r.dispositioned === 1,
    createdAt: r.created_at,
  }));
}

export async function getOrganizationDetail(id: string) {
  const db = getDb();
  const org = (await db.prepare("SELECT * FROM organizations WHERE id = ?").get(id)) as unknown as Organization | undefined;
  if (!org) return null;
  const relatedClasses = ((await db.prepare("SELECT * FROM classes WHERE partner_org_id = ? ORDER BY updated_at DESC").all(id)) as any[]).map(rowToClass);
  return { org, relatedClasses };
}

export async function listClassProposals(): Promise<ClassProposal[]> {
  const db = getDb();
  return ((await db.prepare("SELECT * FROM class_proposals ORDER BY updated_at DESC").all()) as any[]).map(
    (r): ClassProposal => ({
      id: r.id,
      instructorId: r.instructor_id,
      title: r.title,
      ageGroup: r.age_group ?? null,
      curriculumTopic: r.curriculum_topic ?? null,
      format: r.format ?? null,
      schedule: r.schedule ?? null,
      description: r.description ?? null,
      resources: r.resources ?? null,
      status: r.status,
      convertedClassId: r.converted_class_id ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }),
  );
}

export async function listClassProposalsForInstructor(instructorId: string): Promise<ClassProposal[]> {
  return (await listClassProposals()).filter((p) => p.instructorId === instructorId);
}

/** Classes where the given instructor is lead or additional. */
export async function listClassesForInstructor(instructorId: string): Promise<Class[]> {
  const db = getDb();
  return (
    (await db
            .prepare(
              "SELECT c.* FROM classes c JOIN class_instructors ci ON ci.class_id = c.id WHERE ci.instructor_id = ? AND ci.removed_at IS NULL ORDER BY c.updated_at DESC",
            )
            .all(instructorId)) as any[]
  ).map(rowToClass);
}

/** Leadership Home buckets — real queries where the underlying tables are ready. */
export async function getLeadershipHomeData() {
  const db = getDb();
  const now = Date.now();
  (await refreshNewlyMissedRequiredTrainingStatuses(undefined, now));
  const staleCutoff = now - STALE_DAYS * DAY_MS;

  const newApplications = ((await db.prepare("SELECT * FROM instructors WHERE stage = 'applied' ORDER BY created_at DESC").all()) as any[]).map(rowToInstructor);
  const interviewsToSchedule = (
    (await db.prepare("SELECT * FROM instructors WHERE stage IN ('applied','reviewing') AND interview_at IS NULL ORDER BY created_at").all()) as any[]
  ).map(rowToInstructor);
  const awaitingFounderReview = ((await db.prepare("SELECT * FROM instructors WHERE stage = 'founder_review' ORDER BY updated_at").all()) as any[]).map(
    rowToInstructor,
  );
  const behindOnOnboardingOrTraining = (
    (await db
            .prepare(
              "SELECT * FROM instructors WHERE stage IN ('onboarding','training') AND (updated_at < ? OR training_status = 'behind') ORDER BY updated_at",
            )
            .all(staleCutoff)) as any[]
  ).map(rowToInstructor);
  const practiceEvalsNeeded = (
    (await db
            .prepare(
              "SELECT i.* FROM instructors i WHERE i.stage = 'practice_evaluation' AND NOT EXISTS (SELECT 1 FROM practice_evaluations e WHERE e.instructor_id = i.id AND e.decision = 'pass') ORDER BY i.updated_at",
            )
            .all()) as any[]
  ).map(rowToInstructor);
  const classesWithoutEligibleInstructor = (
    (await db
            .prepare(
              `SELECT c.* FROM classes c
         WHERE c.status NOT IN ('completed','cancelled')
           AND (c.lead_instructor_id IS NULL
             OR NOT EXISTS (SELECT 1 FROM instructors i WHERE i.id = c.lead_instructor_id AND i.eligibility_status = 'eligible' AND i.stage IN ('eligible','active')))
         ORDER BY c.updated_at`,
            )
            .all()) as any[]
  ).map(rowToClass);

  const [activeClassRows, enrollmentCountRows, eligibleLeadRows] = await Promise.all([
    db.prepare("SELECT * FROM classes WHERE status NOT IN ('completed','cancelled')").all(),
    db.prepare(
      `SELECT ce.class_id, COUNT(*) AS n
         FROM class_enrollments ce
         JOIN students s ON s.id = ce.student_id
        WHERE ce.status = 'enrolled' AND s.enrollment_status = 'active'
        GROUP BY ce.class_id`,
    ).all(),
    db.prepare(
      "SELECT id FROM instructors WHERE eligibility_status = 'eligible' AND stage IN ('eligible','active')",
    ).all(),
  ]);
  const activeClasses = (activeClassRows as any[]).map(rowToClass);
  const enrollmentCounts = new Map(
    (enrollmentCountRows as { class_id: string; n: number }[]).map((row) => [row.class_id, Number(row.n)]),
  );
  const eligibleLeadIds = new Set((eligibleLeadRows as { id: string }[]).map((row) => row.id));
  const classesLaunchingSoonIncomplete: Class[] = activeClasses.filter((cls) =>
    classStatusFlags(
      cls,
      Boolean(cls.leadInstructorId && eligibleLeadIds.has(cls.leadInstructorId)),
      enrollmentCounts.get(cls.id) ?? 0,
    ).launchingSoonIncomplete,
  );

  const missingStudentForms = (
    (await db.prepare("SELECT * FROM students WHERE enrollment_status = 'active' AND form_status != 'complete' ORDER BY updated_at").all()) as any[]
  ).map(rowToStudent);
  const flaggedSessionReports = (await db
      .prepare(
        `SELECT r.*, s.class_id AS class_id FROM class_session_reports r
       JOIN class_sessions s ON s.id = r.session_id
       WHERE r.flagged = 1 AND r.reported_at > ? ORDER BY r.reported_at DESC`,
      )
      .all(now - STALE_DAYS * DAY_MS)) as any[];
  const openFounderHandoffTasks = (
    (await db.prepare("SELECT * FROM tasks WHERE handoff_to_founder = 1 AND status = 'open' ORDER BY due_at").all()) as any[]
  ).map(rowToTask);

  return {
    newApplications,
    interviewsToSchedule,
    awaitingFounderReview,
    behindOnOnboardingOrTraining,
    practiceEvalsNeeded,
    classesWithoutEligibleInstructor,
    classesLaunchingSoonIncomplete,
    missingStudentForms,
    flaggedSessionReports,
    openFounderHandoffTasks,
  };
}

/* ---------------- shared write helpers (Phase B) ---------------- */

/**
 * Internal (non "use server") activity-log writer. Server actions in
 * app/actions/*.ts import this directly rather than going through
 * app/actions/activity.ts, so a mutation and its audit trail land in
 * the same transaction-less call without crossing the action boundary
 * twice.
 */
export async function logActivity(entityType: string, entityId: string, kind: string, body: string | null, actorUserId: string | null): Promise<void> {
  const db = getDb();
  const id = `pfx-${randomUUID().slice(0, 8)}`;
  (await db.prepare(
        "INSERT INTO crm_activity (id, entity_type, entity_id, kind, body, actor_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).run(id, entityType, entityId, kind, body ?? null, actorUserId, Date.now()));
}

export async function listActivity(entityType: string, entityId: string): Promise<CrmActivity[]> {
  const db = getDb();
  return (
    (await db
            .prepare("SELECT * FROM crm_activity WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC")
            .all(entityType, entityId)) as any[]
  ).map(
    (r): CrmActivity => ({
      id: r.id,
      entityType: r.entity_type,
      entityId: r.entity_id,
      kind: r.kind,
      body: r.body ?? null,
      actorUserId: r.actor_user_id ?? null,
      createdAt: r.created_at,
    }),
  );
}

export async function listOpenTasksForEntity(entityType: string, entityId: string): Promise<Task[]> {
  const db = getDb();
  return (
    (await db
            .prepare("SELECT * FROM tasks WHERE entity_type = ? AND entity_id = ? AND status = 'open' ORDER BY due_at")
            .all(entityType, entityId)) as any[]
  ).map(rowToTask);
}

/**
 * Upsert a `people` row by lower-cased email. Returns the person id.
 * Name/phone are only written on insert or when the existing value is
 * blank — an applicant filling the public form twice shouldn't clobber
 * a name staff has since corrected.
 */
export async function upsertPersonByEmail(name: string, email: string, phone: string): Promise<string> {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  const existing = (await db.prepare("SELECT * FROM people WHERE lower(email) = ?").get(normalized)) as any;
  const now = Date.now();
  if (existing) {
    (await db.prepare(
            "UPDATE people SET name = CASE WHEN name IS NULL OR name = '' THEN ? ELSE name END, phone = CASE WHEN phone IS NULL OR phone = '' THEN ? ELSE phone END, updated_at = ? WHERE id = ?",
          ).run(name, phone, now, existing.id));
    return existing.id;
  }
  const id = `pfx-${randomUUID().slice(0, 8)}`;
  (await db.prepare(
        "INSERT INTO people (id, name, email, phone, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, ?)",
      ).run(id, name, normalized, phone ?? "", now, now));
  return id;
}

export async function getPersonByEmail(email: string): Promise<Person | null> {
  const db = getDb();
  const row = (await db.prepare("SELECT * FROM people WHERE lower(email) = ?").get(email.trim().toLowerCase())) as any;
  return row ? rowToPerson(row) : null;
}

/** The active (non-terminal) instructors row for a person, if any. */
export async function getActiveInstructorForPerson(personId: string): Promise<Instructor | null> {
  const db = getDb();
  const row = (await db
      .prepare(
        `SELECT * FROM instructors
        WHERE person_id = ? AND stage NOT IN ('rejected','inactive')
        ORDER BY CASE WHEN stage = 'active' THEN 1 ELSE 0 END, created_at DESC, id DESC
        LIMIT 1`,
      )
      .get(personId)) as any;
  return row ? rowToInstructor(row) : null;
}

/** Staff (admin | growth) user ids — used to fan out pipeline notifications. */
export async function listStaffUserIds(): Promise<string[]> {
  const db = getDb();
  return ((await db.prepare("SELECT id FROM users WHERE role IN ('admin','growth') AND status = 'active'").all()) as { id: string }[]).map((r) => r.id);
}

/** Staff (admin | growth) users by name — feeds UserSelect pickers. */
export async function listStaffUsers(): Promise<{ id: string; name: string }[]> {
  const db = getDb();
  return (await db.prepare("SELECT id, name FROM users WHERE role IN ('admin','growth') AND status = 'active' ORDER BY name").all()) as { id: string; name: string }[];
}

/** Resolves a set of user ids to display names (any role, not just staff). Unknown ids pass through unchanged. */
export async function resolveUserNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const db = getDb();
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  const map = new Map<string, string>();
  for (const id of unique) {
    const row = (await db.prepare("SELECT name FROM users WHERE id = ?").get(id)) as { name: string } | undefined;
    map.set(id, row?.name ?? id);
  }
  return map;
}

/* ---------------- invitation writer (shared with app/actions/lms.ts) ---------------- */

export interface NewInvitationInput {
  role: "student" | "instructor";
  email: string;
  orgId: string;
  cohortId: string | null;
}

export interface InvitationRecord {
  id: string;
  email: string;
  role: "student" | "instructor";
  orgId: string;
  cohortId: string | null;
  created: string;
  expires: string;
  expiresAt: number;
  status: "pending";
  token: string;
}

/**
 * Internal (non "use server") invitation writer. app/actions/lms.ts's
 * `createInvitation` action calls this after its own `requireRole("admin")`
 * check; app/actions/instructors.ts's founder-decision handoff calls it
 * after `requireAdmin()`. Lives here (not in the "use server" lms.ts file)
 * because every export of a "use server" module must itself be an async
 * action — a plain sync helper can't live there.
 */
export async function createInvitationInternal(input: NewInvitationInput): Promise<InvitationRecord> {
  const db = getDb();
  const id = `inv-${randomUUID()}`;
  const today = new Date();
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const created = fmt(today);
  const expiresAt = today.getTime() + 14 * 24 * 60 * 60 * 1000;
  const expires = fmt(new Date(expiresAt));
  const email = input.email.trim().toLowerCase();
  const token = randomBytes(32).toString("base64url");

  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email address.");
  if (input.role !== "student" && input.role !== "instructor") throw new Error("Choose a valid invitation role.");
  const nestedTransaction = db.isTransaction;
  (await db.exec(nestedTransaction ? "SAVEPOINT create_invitation" : "BEGIN IMMEDIATE"));
  try {
    // These authorization reads intentionally happen after the writer lock.
    // Otherwise a partner pause could revoke access between the read and the
    // invitation insert, leaving a brand-new credential for an inactive org.
    const existingUser = (await db
          .prepare("SELECT role, org_id, status, password_hash FROM users WHERE lower(email) = lower(?)")
          .get(email)) as { role: string; org_id: string; status: string; password_hash: string | null } | undefined;
    const claimablePlaceholder =
      existingUser?.status === "invited" &&
      existingUser.password_hash == null &&
      existingUser.role === input.role &&
      existingUser.org_id === input.orgId;
    if (existingUser && !claimablePlaceholder) {
      throw new Error("That email already has an account. Use sign in or account recovery instead of an invitation.");
    }
    if (!(await db.prepare("SELECT 1 FROM organizations WHERE id = ? AND status = 'active'").get(input.orgId))) {
      throw new Error("The invitation organization is no longer active.");
    }
    if (input.role === "student") {
      if (!input.cohortId) throw new Error("Student invitations require a cohort.");
      const cohort = (await db.prepare("SELECT org_id, status FROM cohorts WHERE id = ?").get(input.cohortId)) as
        | { org_id: string; status: string }
        | undefined;
      if (!cohort || cohort.org_id !== input.orgId || !["active", "enrolling"].includes(cohort.status)) {
        throw new Error("The invited cohort is no longer available for enrollment.");
      }
    } else {
      const approvedProfiles = (await db.prepare(
              `SELECT i.id
           FROM people p
           JOIN instructors i ON i.person_id = p.id
          WHERE lower(trim(p.email)) = ?
            AND i.stage IN ('accepted','onboarding','training','practice_evaluation','eligible','active')
          ORDER BY i.created_at DESC, i.id DESC`,
            ).all(email)) as { id: string }[];
      if (input.orgId !== "org-bow" || approvedProfiles.length !== 1) {
        throw new Error("Instructor invitations must come from one approved BOW hiring record.");
      }
    }

    (await db.prepare("UPDATE invitations SET status = 'revoked' WHERE lower(email) = lower(?) AND status = 'pending'").run(email));
    (await db.prepare(
            "INSERT INTO invitations (id, email, role, org_id, cohort_id, created, expires, expires_at, status, token, token_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)",
          ).run(
            id,
            email,
            input.role,
            input.orgId,
            input.cohortId,
            created,
            expires,
            expiresAt,
            `retired:${randomUUID()}`,
            hashOpaqueToken(token),
          ));
    (await db.exec(nestedTransaction ? "RELEASE SAVEPOINT create_invitation" : "COMMIT"));
  } catch (error) {
    if (nestedTransaction) {
      (await db.exec("ROLLBACK TO SAVEPOINT create_invitation"));
      (await db.exec("RELEASE SAVEPOINT create_invitation"));
    } else if (db.isTransaction) {
      (await db.exec("ROLLBACK"));
    }
    throw error;
  }

  return {
    id,
    email,
    role: input.role,
    orgId: input.orgId,
    cohortId: input.cohortId,
    created,
    expires,
    expiresAt,
    status: "pending",
    token,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
