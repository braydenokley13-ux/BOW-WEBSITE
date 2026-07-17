/* ============================================================
 * BOW HQ data layer — instructor lifecycle, training, classes,
 * students, tasks. Parallel to lib/account.ts; the LMS module
 * (cohorts/enrollments/lesson_progress) is untouched.
 *
 * Server-only (imports lib/db).
 * ============================================================ */

import { randomUUID } from "node:crypto";
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

export function getStudentAttendanceHistory(studentId: string) {
  const db = getDb();
  return db
    .prepare(
      `SELECT ar.*, cs.session_date, cs.class_id, c.title AS class_title
       FROM attendance_records ar
       JOIN class_sessions cs ON cs.id = ar.session_id
       JOIN classes c ON c.id = cs.class_id
       WHERE ar.student_id = ?
       ORDER BY cs.session_date DESC`,
    )
    .all(studentId) as any[];
}

export function listCurricula(): Curriculum[] {
  const db = getDb();
  return (db.prepare("SELECT * FROM curricula ORDER BY title").all() as any[]).map(rowToCurriculum);
}

export function listTasks(): Task[] {
  const db = getDb();
  return (db.prepare("SELECT * FROM tasks ORDER BY status, due_at").all() as any[]).map(rowToTask);
}

/** Instructors eligible to lead/assist a class (stage eligible or active). */
export function listEligibleInstructors(): (Instructor & { person: Person | null })[] {
  const db = getDb();
  const rows = (db.prepare("SELECT * FROM instructors WHERE stage IN ('eligible','active') ORDER BY updated_at DESC").all() as any[]).map(
    rowToInstructor,
  );
  return rows.map((i) => {
    const p = db.prepare("SELECT * FROM people WHERE id = ?").get(i.personId) as any;
    return { ...i, person: p ? rowToPerson(p) : null };
  });
}

export interface Organization {
  id: string;
  name: string;
  type: string;
  location: string;
  status: string;
}

export function listOrganizations(): Organization[] {
  const db = getDb();
  return db.prepare("SELECT * FROM organizations ORDER BY name").all() as unknown as Organization[];
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
export function listDemoRequests(): DemoRequest[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT d.*, p.name AS org_name FROM demo_requests d
       LEFT JOIN partner_orgs p ON p.slug = d.org_slug
       ORDER BY d.created_at DESC`,
    )
    .all() as any[];
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

export function getOrganizationDetail(id: string) {
  const db = getDb();
  const org = db.prepare("SELECT * FROM organizations WHERE id = ?").get(id) as unknown as Organization | undefined;
  if (!org) return null;
  const relatedClasses = (db.prepare("SELECT * FROM classes WHERE partner_org_id = ? ORDER BY updated_at DESC").all(id) as any[]).map(rowToClass);
  return { org, relatedClasses };
}

export function listClassProposals(): ClassProposal[] {
  const db = getDb();
  return (db.prepare("SELECT * FROM class_proposals ORDER BY updated_at DESC").all() as any[]).map(
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

export function listClassProposalsForInstructor(instructorId: string): ClassProposal[] {
  return listClassProposals().filter((p) => p.instructorId === instructorId);
}

/** Classes where the given instructor is lead or additional. */
export function listClassesForInstructor(instructorId: string): Class[] {
  const db = getDb();
  return (
    db
      .prepare(
        "SELECT c.* FROM classes c JOIN class_instructors ci ON ci.class_id = c.id WHERE ci.instructor_id = ? ORDER BY c.updated_at DESC",
      )
      .all(instructorId) as any[]
  ).map(rowToClass);
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

  const activeClasses = (db.prepare("SELECT * FROM classes WHERE status NOT IN ('completed','cancelled')").all() as any[]).map(rowToClass);
  const classesLaunchingSoonIncomplete: Class[] = activeClasses.filter((cls) => {
    const enrollmentCount = (
      db.prepare("SELECT COUNT(*) AS n FROM class_enrollments WHERE class_id = ? AND status = 'enrolled'").get(cls.id) as { n: number }
    ).n;
    const hasEligibleLead = !!(
      cls.leadInstructorId &&
      (db
        .prepare("SELECT 1 FROM instructors WHERE id = ? AND eligibility_status = 'eligible'")
        .get(cls.leadInstructorId) as { 1: number } | undefined)
    );
    return classStatusFlags(cls, hasEligibleLead, enrollmentCount).launchingSoonIncomplete;
  });

  const missingStudentForms = (
    db.prepare("SELECT * FROM students WHERE enrollment_status = 'active' AND form_status != 'complete' ORDER BY updated_at").all() as any[]
  ).map(rowToStudent);
  const flaggedSessionReports = db
    .prepare(
      `SELECT r.*, s.class_id AS class_id FROM class_session_reports r
       JOIN class_sessions s ON s.id = r.session_id
       WHERE r.flagged = 1 AND r.reported_at > ? ORDER BY r.reported_at DESC`,
    )
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
export function logActivity(entityType: string, entityId: string, kind: string, body: string | null, actorUserId: string | null): void {
  const db = getDb();
  const id = `pfx-${randomUUID().slice(0, 8)}`;
  db.prepare(
    "INSERT INTO crm_activity (id, entity_type, entity_id, kind, body, actor_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(id, entityType, entityId, kind, body ?? null, actorUserId, Date.now());
}

export function listActivity(entityType: string, entityId: string): CrmActivity[] {
  const db = getDb();
  return (
    db
      .prepare("SELECT * FROM crm_activity WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC")
      .all(entityType, entityId) as any[]
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

export function listOpenTasksForEntity(entityType: string, entityId: string): Task[] {
  const db = getDb();
  return (
    db
      .prepare("SELECT * FROM tasks WHERE entity_type = ? AND entity_id = ? AND status = 'open' ORDER BY due_at")
      .all(entityType, entityId) as any[]
  ).map(rowToTask);
}

/**
 * Upsert a `people` row by lower-cased email. Returns the person id.
 * Name/phone are only written on insert or when the existing value is
 * blank — an applicant filling the public form twice shouldn't clobber
 * a name staff has since corrected.
 */
export function upsertPersonByEmail(name: string, email: string, phone: string): string {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  const existing = db.prepare("SELECT * FROM people WHERE lower(email) = ?").get(normalized) as any;
  const now = Date.now();
  if (existing) {
    db.prepare(
      "UPDATE people SET name = CASE WHEN name IS NULL OR name = '' THEN ? ELSE name END, phone = CASE WHEN phone IS NULL OR phone = '' THEN ? ELSE phone END, updated_at = ? WHERE id = ?",
    ).run(name, phone, now, existing.id);
    return existing.id;
  }
  const id = `pfx-${randomUUID().slice(0, 8)}`;
  db.prepare(
    "INSERT INTO people (id, name, email, phone, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, ?)",
  ).run(id, name, normalized, phone ?? "", now, now);
  return id;
}

export function getPersonByEmail(email: string): Person | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM people WHERE lower(email) = ?").get(email.trim().toLowerCase()) as any;
  return row ? rowToPerson(row) : null;
}

/** The active (non-terminal) instructors row for a person, if any. */
export function getActiveInstructorForPerson(personId: string): Instructor | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM instructors WHERE person_id = ? AND stage NOT IN ('rejected','inactive') ORDER BY created_at DESC LIMIT 1")
    .get(personId) as any;
  return row ? rowToInstructor(row) : null;
}

/** Staff (admin | growth) user ids — used to fan out pipeline notifications. */
export function listStaffUserIds(): string[] {
  const db = getDb();
  return (db.prepare("SELECT id FROM users WHERE role IN ('admin','growth')").all() as { id: string }[]).map((r) => r.id);
}

/** Staff (admin | growth) users by name — feeds UserSelect pickers. */
export function listStaffUsers(): { id: string; name: string }[] {
  const db = getDb();
  return db.prepare("SELECT id, name FROM users WHERE role IN ('admin','growth') ORDER BY name").all() as { id: string; name: string }[];
}

/** Resolves a set of user ids to display names (any role, not just staff). Unknown ids pass through unchanged. */
export function resolveUserNames(ids: (string | null | undefined)[]): Map<string, string> {
  const db = getDb();
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  const map = new Map<string, string>();
  for (const id of unique) {
    const row = db.prepare("SELECT name FROM users WHERE id = ?").get(id) as { name: string } | undefined;
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
  status: "pending";
}

/**
 * Internal (non "use server") invitation writer. app/actions/lms.ts's
 * `createInvitation` action calls this after its own `requireRole("admin")`
 * check; app/actions/instructors.ts's founder-decision handoff calls it
 * after `requireAdmin()`. Lives here (not in the "use server" lms.ts file)
 * because every export of a "use server" module must itself be an async
 * action — a plain sync helper can't live there.
 */
export function createInvitationInternal(input: NewInvitationInput): InvitationRecord {
  const db = getDb();
  const id = `inv-${randomUUID().slice(0, 8)}`;
  const today = new Date();
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const created = fmt(today);
  const expires = fmt(new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000));
  const email = input.email.trim().toLowerCase();

  db.prepare(
    "INSERT INTO invitations (id, email, role, org_id, cohort_id, created, expires, status, token) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)",
  ).run(id, email, input.role, input.orgId, input.cohortId, created, expires, id);

  return { id, email, role: input.role, orgId: input.orgId, cohortId: input.cohortId, created, expires, status: "pending" };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
