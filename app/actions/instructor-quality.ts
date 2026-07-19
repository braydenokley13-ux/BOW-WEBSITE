"use server";

/* ============================================================
 * Instructor workforce quality mutations.
 *
 * These actions turn qualification, feedback, development, and Work into one
 * operational loop. Every write is authorized again on the server and every
 * related record is resolved from the canonical database before it commits.
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { logActivity } from "@/lib/hiring";
import { addCanonicalYears, canonicalDateInZone, canonicalDateToUtcNoon } from "@/lib/timezone";

const QUALIFICATION_KINDS = ["curriculum", "age_group", "format", "role", "location", "region"] as const;
const DELIVERY_FORMATS = new Set(["in_person", "online", "hybrid", "all"]);
const TEACHING_ROLES = new Set(["lead", "assistant", "all"]);
const PROGRESSION_LEVELS = new Set([
  "instructor",
  "senior_instructor",
  "lead_instructor",
  "instructor_coach",
  "regional_leader",
]);
const FEEDBACK_SOURCES = new Set(["staff_observation", "partner", "parent_guardian", "student", "peer", "self"]);
const DEVELOPMENT_KINDS = new Set(["goal", "coaching", "training", "observation", "concern", "recognition"]);
const DEVELOPMENT_NEXT_STAGE: Record<string, string | null> = {
  identified: "planned",
  concern_identified: "planned",
  planned: "in_progress",
  plan_created: "in_progress",
  in_progress: "evidence_review",
  evidence_review: null,
  recognized: null,
};

type QualificationKind = (typeof QUALIFICATION_KINDS)[number];
type Database = ReturnType<typeof getDb>;

export interface QualityActionResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export interface QualificationInput {
  instructorId: string;
  kind: string;
  value: string;
  expiresOn?: string | null;
  notes?: string | null;
}

export interface WorkforceProfileInput {
  instructorId: string;
  progressionLevel: string;
  maxWeeklyClasses: number;
  developmentFocus?: string | null;
}

export interface FeedbackInput {
  instructorId: string;
  sourceType: string;
  authorName?: string | null;
  classId?: string | null;
  programId?: string | null;
  partnerOrgId?: string | null;
  sessionId?: string | null;
  curriculumDelivery?: number | null;
  studentFamilyRelationships?: number | null;
  organizationReliability?: number | null;
  leadershipContribution?: number | null;
  strengths?: string | null;
  concerns?: string | null;
  body?: string | null;
  followUpRequired?: boolean;
  followUpTitle?: string | null;
  followUpOwnerUserId?: string | null;
  followUpDueOn?: string | null;
}

export interface DevelopmentItemInput {
  instructorId: string;
  kind: string;
  title: string;
  ownerUserId: string;
  dueOn?: string | null;
  notes?: string | null;
}

class QualityActionError extends Error {}

function cleanText(value: unknown): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

function requiredId(value: unknown, label: string): string {
  const id = cleanText(value);
  if (!id || id.length > 100) throw new QualityActionError(`${label} is missing or invalid.`);
  return id;
}

function limitedText(value: unknown, label: string, maximum: number): string | null {
  const text = cleanText(value);
  if (text && text.length > maximum) throw new QualityActionError(`${label} is too long.`);
  return text;
}

function futureDateOnly(
  value: unknown,
  label: string,
  required: boolean,
): { canonicalDate: string; epoch: number } | null {
  if (value != null && typeof value !== "string") {
    throw new QualityActionError(`Choose a valid ${label}.`);
  }
  const date = cleanText(value);
  if (!date) {
    if (required) throw new QualityActionError(`${label} is required.`);
    return null;
  }
  const resolution = canonicalDateToUtcNoon(date);
  if (!resolution.ok) throw new QualityActionError(`Choose a valid ${label}.`);
  const now = Date.now();
  const today = canonicalDateInZone(now);
  const maximum = addCanonicalYears(today, 5);
  if (resolution.canonicalDate < today || resolution.canonicalDate > maximum) {
    throw new QualityActionError(`${label} must be today or a future date within five years.`);
  }
  return { canonicalDate: resolution.canonicalDate, epoch: resolution.epoch };
}

function optionalRating(value: unknown, label: string): number | null {
  if (value == null || value === "") return null;
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 5) {
    throw new QualityActionError(`${label} must be between 1 and 5.`);
  }
  return Number(value);
}

async function runImmediate<T>(operation: (db: Database) => T): Promise<T> {
  const db = getDb();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const result = operation(db);
    (await db.exec("COMMIT"));
    return result;
  } catch (error) {
    if (db.isTransaction) (await db.exec("ROLLBACK"));
    throw error;
  }
}

function actionError(error: unknown): QualityActionResult {
  if (error instanceof QualityActionError) return { ok: false, error: error.message };
  throw error;
}

async function assertActiveInstructor(db: Database, instructorId: string): Promise<{ id: string; name: string; updated_at: number }> {
  const row = (await db
      .prepare(
        `SELECT i.id, p.name, i.updated_at
         FROM instructors i
         JOIN people p ON p.id = i.person_id
        WHERE i.id = ? AND i.stage NOT IN ('rejected','inactive')`,
      )
      .get(instructorId)) as { id: string; name: string; updated_at: number } | undefined;
  if (!row) throw new QualityActionError("This instructor is inactive, rejected, or no longer exists.");
  return row;
}

async function assertInstructorExists(db: Database, instructorId: string): Promise<{ id: string; name: string }> {
  const row = (await db
      .prepare("SELECT i.id, p.name FROM instructors i JOIN people p ON p.id = i.person_id WHERE i.id = ?")
      .get(instructorId)) as { id: string; name: string } | undefined;
  if (!row) throw new QualityActionError("This instructor no longer exists.");
  return row;
}

async function activeStaffName(db: Database, userId: string): Promise<string> {
  const row = (await db
      .prepare("SELECT name FROM users WHERE id = ? AND role IN ('admin','growth') AND status = 'active'")
      .get(userId)) as { name: string } | undefined;
  if (!row) throw new QualityActionError("Choose an active BOW staff owner.");
  return row.name;
}

async function qualificationTarget(db: Database, kind: QualificationKind, rawValue: string): Promise<{ value: string; label: string }> {
  const value = rawValue.trim();
  if (!value || value.length > 160) throw new QualityActionError("Choose a valid qualification scope.");
  if (value === "all") {
    const allLabels: Record<QualificationKind, string> = {
      curriculum: "All curricula",
      age_group: "All age groups",
      format: "All delivery formats",
      role: "All teaching roles",
      location: "All locations",
      region: "All regions",
    };
    return { value, label: allLabels[kind] };
  }

  if (kind === "curriculum") {
    const row = (await db.prepare("SELECT title FROM curricula WHERE id = ? AND published = 1").get(value)) as { title: string } | undefined;
    if (!row) throw new QualityActionError("Choose a published Curriculum.");
    return { value, label: row.title };
  }
  if (kind === "location") {
    const row = (await db.prepare("SELECT name FROM locations WHERE id = ? AND stage <> 'closed'").get(value)) as { name: string } | undefined;
    if (!row) throw new QualityActionError("Choose an open Location.");
    return { value, label: row.name };
  }
  if (kind === "region") {
    const row = (await db.prepare("SELECT name FROM operating_regions WHERE id = ? AND stage <> 'closed'").get(value)) as { name: string } | undefined;
    if (!row) throw new QualityActionError("Choose an open Region.");
    return { value, label: row.name };
  }
  if (kind === "format") {
    if (!DELIVERY_FORMATS.has(value)) throw new QualityActionError("Choose a valid delivery format.");
    return { value, label: value.replace(/_/g, " ") };
  }
  if (kind === "role") {
    if (!TEACHING_ROLES.has(value)) throw new QualityActionError("Choose a valid teaching role.");
    return { value, label: value === "assistant" ? "Assistant instructor" : value.replace(/_/g, " ") };
  }

  if (value.length < 2) throw new QualityActionError("Choose a specific age group.");
  const knownAgeGroup = (await db
      .prepare(
        `SELECT 1 FROM (
         SELECT DISTINCT trim(age_range) AS value FROM classes WHERE trim(COALESCE(age_range, '')) <> ''
         UNION SELECT DISTINCT trim(audience) AS value FROM programs WHERE trim(COALESCE(audience, '')) <> ''
       ) WHERE lower(value) = lower(?) LIMIT 1`,
      )
      .get(value));
  if (!knownAgeGroup) throw new QualityActionError("Choose an age group already used by a Class or Program.");
  return { value, label: value };
}

async function historicalQualificationLabel(db: Database, kind: QualificationKind, value: string): Promise<string> {
  if (value === "all") return `All ${kind.replace(/_/g, " ")} scope`;
  if (kind === "curriculum") {
    return ((await db.prepare("SELECT title FROM curricula WHERE id = ?").get(value)) as { title: string } | undefined)?.title ?? "Retired Curriculum";
  }
  if (kind === "location") {
    return ((await db.prepare("SELECT name FROM locations WHERE id = ?").get(value)) as { name: string } | undefined)?.name ?? "Removed Location";
  }
  if (kind === "region") {
    return ((await db.prepare("SELECT name FROM operating_regions WHERE id = ?").get(value)) as { name: string } | undefined)?.name ?? "Removed Region";
  }
  return value.replace(/_/g, " ");
}

function appendEvidence(existing: string | null, line: string): string {
  const current = existing?.trim();
  if (!current) return line.slice(-8000);
  const newest = `\n\n${line}`;
  if (newest.length >= 8000) return newest.slice(-8000);
  return `${current.slice(-(8000 - newest.length))}${newest}`;
}

function revalidateInstructorQuality(instructorId: string): void {
  revalidatePath(`/app/instructors/${instructorId}`);
  revalidatePath("/app/instructors");
  revalidatePath("/app/programs", "layout");
  revalidatePath("/app/locations", "layout");
  revalidatePath("/app/tasks");
  revalidatePath("/app");
}

async function createConcernFollowUp(
  db: Database,
  input: {
    suffix: string;
    instructorId: string;
    instructorName: string;
    kind: "concern" | "coaching";
    title: string;
    ownerUserId: string;
    dueAt: number;
    dueOn: string;
    notes: string | null;
    relatedFeedbackId: string | null;
    priority: "high" | "urgent";
    actorUserId: string;
  },
): Promise<{ developmentId: string; taskId: string }> {
  const now = Date.now();
  const developmentId = `dev-${input.suffix}`;
  const taskId = `wrk-${input.suffix}`;
  (await db.prepare(
        `INSERT INTO instructor_development_items
      (id, instructor_id, kind, title, stage, owner_user_id, due_at, due_on, status, notes,
       related_feedback_id, created_at, updated_at, resolved_at)
     VALUES (?, ?, ?, ?, 'identified', ?, ?, ?, 'open', ?, ?, ?, ?, NULL)`,
      ).run(
        developmentId,
        input.instructorId,
        input.kind,
        input.title,
        input.ownerUserId,
        input.dueAt,
        input.dueOn,
        input.notes,
        input.relatedFeedbackId,
        now,
        now,
      ));
  (await db.prepare(
        `INSERT INTO tasks
      (id, title, owner_user_id, due_at, due_on, status, kind, priority, context, recommended_action,
       entity_type, entity_id, handoff_to_founder, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'open', 'follow_up', ?, ?, ?, 'instructor', ?, 0, ?, ?)`,
      ).run(
        taskId,
        input.title,
        input.ownerUserId,
        input.dueAt,
        input.dueOn,
        input.priority,
        input.notes,
        `Review the evidence with ${input.instructorName}, agree on the next coaching step, and document the outcome in the development record.`,
        input.instructorId,
        now,
        now,
      ));
  (await logActivity("task", taskId, "created", `Created from an instructor quality concern for ${input.instructorName}.`, input.actorUserId));
  return { developmentId, taskId };
}

export async function upsertInstructorQualification(input: QualificationInput): Promise<QualityActionResult> {
  const me = await requireStaff();
  let instructorId: string;
  try {
    instructorId = requiredId(input?.instructorId, "Instructor");
    if (!QUALIFICATION_KINDS.includes(input?.kind as QualificationKind)) {
      throw new QualityActionError("Choose a valid qualification type.");
    }
    const kind = input.kind as QualificationKind;
    if ((input as QualificationInput & { expiresAt?: unknown })?.expiresAt !== undefined) {
      throw new QualityActionError("Send the expiration as YYYY-MM-DD, without a browser-local timestamp.");
    }
    const expiration = futureDateOnly(input?.expiresOn, "Expiration date", false);
    const expiresAt = expiration?.epoch ?? null;
    const notes = limitedText(input?.notes, "Qualification notes", 1200);
    const now = Date.now();
    const id = `qlf-${randomUUID()}`;

    (await runImmediate(async (db) => {
            const instructor = (await assertActiveInstructor(db, instructorId));
            const target = (await qualificationTarget(db, kind, String(input?.value ?? "")));
            (await db.prepare(
                      `INSERT INTO instructor_qualifications
          (id, instructor_id, kind, value, status, approved_by, approved_at, expires_at, expires_on, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'approved', ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(instructor_id, kind, value) DO UPDATE SET
           status = 'approved', approved_by = excluded.approved_by, approved_at = excluded.approved_at,
           expires_at = excluded.expires_at, expires_on = excluded.expires_on,
           notes = excluded.notes, updated_at = excluded.updated_at`,
                    ).run(id, instructorId, kind, target.value, me.id, now, expiresAt, expiration?.canonicalDate ?? null, notes, now, now));
            (await logActivity(
                      "instructor",
                      instructorId,
                      "qualification_approved",
                      `${kind.replace(/_/g, " ")} approval granted for ${target.label}${expiration ? ` through ${expiration.canonicalDate}` : ""}.`,
                      me.id,
                    ));
            // Touch the dossier record so pipeline lists reflect the manager's most
            // recent workforce decision without changing hiring stage semantics.
            (await db.prepare("UPDATE instructors SET updated_at = ? WHERE id = ? AND updated_at = ?").run(now, instructorId, instructor.updated_at));
          }));
    revalidateInstructorQuality(instructorId);
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function revokeInstructorQualification(instructorValue: string, qualificationValue: string): Promise<QualityActionResult> {
  const me = await requireStaff();
  let instructorId: string;
  try {
    instructorId = requiredId(instructorValue, "Instructor");
    const qualificationId = requiredId(qualificationValue, "Qualification");
    const now = Date.now();
    (await runImmediate(async (db) => {
            (await assertInstructorExists(db, instructorId));
            const row = (await db
                    .prepare("SELECT kind, value, status, updated_at FROM instructor_qualifications WHERE id = ? AND instructor_id = ?")
                    .get(qualificationId, instructorId)) as { kind: QualificationKind; value: string; status: string; updated_at: number } | undefined;
            if (!row) throw new QualityActionError("This qualification no longer exists.");
            if (row.status !== "approved") throw new QualityActionError("This qualification is already inactive.");
            const targetLabel = (await historicalQualificationLabel(db, row.kind, row.value));
            const updated = (await db
                    .prepare("UPDATE instructor_qualifications SET status = 'revoked', updated_at = ? WHERE id = ? AND status = 'approved' AND updated_at = ?")
                    .run(now, qualificationId, row.updated_at));
            if (updated.changes !== 1) throw new QualityActionError("This qualification changed. Refresh and try again.");
            (await logActivity(
                      "instructor",
                      instructorId,
                      "qualification_revoked",
                      `${row.kind.replace(/_/g, " ")} approval revoked for ${targetLabel}.`,
                      me.id,
                    ));
          }));
    revalidateInstructorQuality(instructorId);
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateInstructorWorkforceProfile(input: WorkforceProfileInput): Promise<QualityActionResult> {
  const me = await requireStaff();
  let instructorId: string;
  try {
    instructorId = requiredId(input?.instructorId, "Instructor");
    if (!PROGRESSION_LEVELS.has(input?.progressionLevel)) throw new QualityActionError("Choose a valid progression level.");
    if (!Number.isInteger(input?.maxWeeklyClasses) || input.maxWeeklyClasses < 1 || input.maxWeeklyClasses > 20) {
      throw new QualityActionError("Weekly Class capacity must be between 1 and 20.");
    }
    const developmentFocus = limitedText(input?.developmentFocus, "Development focus", 1200);
    const now = Date.now();
    (await runImmediate(async (db) => {
            const instructor = (await assertActiveInstructor(db, instructorId));
            const before = (await db
                    .prepare("SELECT progression_level, max_weekly_classes, development_focus, updated_at FROM instructors WHERE id = ?")
                    .get(instructorId)) as {
                progression_level: string;
                max_weekly_classes: number;
                development_focus: string | null;
                updated_at: number;
              };
            const updated = (await db
                    .prepare(
                      `UPDATE instructors
              SET progression_level = ?, max_weekly_classes = ?, development_focus = ?, updated_at = ?
            WHERE id = ? AND updated_at = ?`,
                    )
                    .run(input.progressionLevel, input.maxWeeklyClasses, developmentFocus, now, instructorId, before.updated_at));
            if (updated.changes !== 1) throw new QualityActionError("This workforce profile changed. Refresh and try again.");
            const changes = [
              before.progression_level !== input.progressionLevel
                ? `progression ${before.progression_level.replace(/_/g, " ")} → ${input.progressionLevel.replace(/_/g, " ")}`
                : null,
              before.max_weekly_classes !== input.maxWeeklyClasses
                ? `weekly capacity ${before.max_weekly_classes} → ${input.maxWeeklyClasses}`
                : null,
              before.development_focus !== developmentFocus ? "development focus updated" : null,
            ].filter(Boolean);
            (await logActivity(
                      "instructor",
                      instructorId,
                      "workforce_profile_updated",
                      changes.length > 0 ? `Workforce profile updated: ${changes.join("; ")}.` : `Workforce profile reviewed for ${instructor.name}; no values changed.`,
                      me.id,
                    ));
          }));
    revalidateInstructorQuality(instructorId);
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

async function validateFeedbackContext(
  db: Database,
  input: FeedbackInput,
  instructorId: string,
): Promise<{ classId: string | null; programId: string | null; partnerOrgId: string | null; sessionId: string | null }> {
  let classId = cleanText(input.classId);
  let programId = cleanText(input.programId);
  let partnerOrgId = cleanText(input.partnerOrgId);
  const sessionId = cleanText(input.sessionId);
  let sessionDate: number | null = null;
  for (const [label, id] of [["Class", classId], ["Program", programId], ["partner", partnerOrgId], ["session", sessionId]] as const) {
    if (id && id.length > 100) throw new QualityActionError(`Choose a valid ${label}.`);
  }

  if (sessionId) {
    const session = (await db
          .prepare("SELECT cs.class_id, cs.session_date, c.program_id, c.partner_org_id FROM class_sessions cs JOIN classes c ON c.id = cs.class_id WHERE cs.id = ?")
          .get(sessionId)) as { class_id: string; session_date: number; program_id: string | null; partner_org_id: string | null } | undefined;
    if (!session) throw new QualityActionError("Choose an existing Class session.");
    if (session.session_date > Date.now()) throw new QualityActionError("Feedback cannot be attached to a future Class session.");
    sessionDate = session.session_date;
    if (classId && classId !== session.class_id) throw new QualityActionError("The selected session does not belong to the selected Class.");
    classId = session.class_id;
    if (programId && programId !== session.program_id) {
      throw new QualityActionError("The selected session does not belong to the selected Program.");
    }
    if (partnerOrgId && partnerOrgId !== session.partner_org_id) {
      throw new QualityActionError("The selected session does not belong to the selected partner.");
    }
    programId = programId ?? session.program_id;
    partnerOrgId = partnerOrgId ?? session.partner_org_id;
  }

  if (classId) {
    const cls = (await db.prepare("SELECT program_id, partner_org_id FROM classes WHERE id = ?").get(classId)) as
      | { program_id: string | null; partner_org_id: string | null }
      | undefined;
    if (!cls) throw new QualityActionError("Choose an existing Class.");
    const assignment = sessionDate == null
      ? (await db.prepare(
                  "SELECT 1 FROM class_instructors WHERE class_id = ? AND instructor_id = ? LIMIT 1",
                ).get(classId, instructorId))
      : (await db.prepare(
                  `SELECT 1
             FROM class_instructors
            WHERE class_id = ? AND instructor_id = ?
              AND added_at <= ?
              AND (removed_at IS NULL OR removed_at > ?)
            LIMIT 1`,
                ).get(classId, instructorId, sessionDate, sessionDate));
    if (!assignment) throw new QualityActionError("The selected Class is not part of this instructor's assignment history.");
    if (programId && programId !== cls.program_id) {
      throw new QualityActionError("The selected Class does not belong to the selected Program.");
    }
    if (partnerOrgId && partnerOrgId !== cls.partner_org_id) {
      throw new QualityActionError("The selected Class does not belong to the selected partner.");
    }
    programId = programId ?? cls.program_id;
    partnerOrgId = partnerOrgId ?? cls.partner_org_id;
  }

  if (programId) {
    const program = (await db.prepare("SELECT partner_org_id FROM programs WHERE id = ?").get(programId)) as { partner_org_id: string | null } | undefined;
    if (!program) throw new QualityActionError("Choose an existing Program.");
    const assignment = (await db
          .prepare(
            `SELECT 1 FROM class_instructors ci
          JOIN classes c ON c.id = ci.class_id
         WHERE ci.instructor_id = ? AND c.program_id = ? LIMIT 1`,
          )
          .get(instructorId, programId));
    if (!assignment) throw new QualityActionError("The selected Program is not part of this instructor's assignment history.");
    if (partnerOrgId && partnerOrgId !== program.partner_org_id) {
      throw new QualityActionError("The selected Program does not belong to the selected partner.");
    }
    partnerOrgId = partnerOrgId ?? program.partner_org_id;
  }

  if (partnerOrgId) {
    const partner = (await db.prepare("SELECT 1 FROM organizations WHERE id = ?").get(partnerOrgId));
    if (!partner) throw new QualityActionError("Choose an existing partner organization.");
    if (!classId && !programId) {
      const assignment = (await db
              .prepare(
                `SELECT 1 FROM class_instructors ci
            JOIN classes c ON c.id = ci.class_id
           WHERE ci.instructor_id = ? AND c.partner_org_id = ? LIMIT 1`,
              )
              .get(instructorId, partnerOrgId));
      if (!assignment) throw new QualityActionError("The selected partner is not part of this instructor's assignment history.");
    }
  }
  return { classId, programId, partnerOrgId, sessionId };
}

export async function recordInstructorFeedback(input: FeedbackInput): Promise<QualityActionResult> {
  const me = await requireStaff();
  let instructorId: string;
  try {
    instructorId = requiredId(input?.instructorId, "Instructor");
    if (!FEEDBACK_SOURCES.has(input?.sourceType)) throw new QualityActionError("Choose a valid feedback source.");
    let authorName = limitedText(input?.authorName, "Source name", 120);
    if (input.sourceType === "staff_observation" && !authorName) authorName = me.name;
    if (input.sourceType !== "staff_observation" && !authorName) {
      throw new QualityActionError("Name the person or group that provided this feedback.");
    }
    const curriculumDelivery = optionalRating(input?.curriculumDelivery, "Curriculum delivery");
    const studentFamilyRelationships = optionalRating(input?.studentFamilyRelationships, "Student and family relationships");
    const organizationReliability = optionalRating(input?.organizationReliability, "Organization and reliability");
    const leadershipContribution = optionalRating(input?.leadershipContribution, "Leadership contribution");
    const strengths = limitedText(input?.strengths, "Strengths", 2000);
    const concerns = limitedText(input?.concerns, "Concerns", 2000);
    const body = limitedText(input?.body, "Feedback summary", 4000);
    const ratings = [curriculumDelivery, studentFamilyRelationships, organizationReliability, leadershipContribution];
    if (!strengths && !concerns && !body && ratings.every((rating) => rating == null)) {
      throw new QualityActionError("Record at least one rating or a written feedback signal.");
    }
    const lowSignal = ratings.some((rating) => rating != null && rating <= 2);
    const needsFollowUp = Boolean(input?.followUpRequired || concerns || lowSignal);
    const followUpTitle = limitedText(input?.followUpTitle, "Follow-up title", 180);
    const followUpOwnerUserId = cleanText(input?.followUpOwnerUserId);
    if ((input as FeedbackInput & { followUpDueAt?: unknown })?.followUpDueAt !== undefined) {
      throw new QualityActionError("Send the follow-up due date as YYYY-MM-DD, without a browser-local timestamp.");
    }
    const followUpDue = futureDateOnly(
      input?.followUpDueOn,
      "Follow-up due date",
      needsFollowUp,
    );
    const followUpDueAt = followUpDue?.epoch ?? null;
    if (needsFollowUp && !followUpOwnerUserId) throw new QualityActionError("Assign an owner for the quality follow-up.");
    if (followUpOwnerUserId && followUpOwnerUserId.length > 100) throw new QualityActionError("Choose a valid follow-up owner.");

    const id = `fbk-${randomUUID()}`;
    const now = Date.now();
    (await runImmediate(async (db) => {
            const instructor = (await assertActiveInstructor(db, instructorId));
            const context = (await validateFeedbackContext(db, input, instructorId));
            let ownerName: string | null = null;
            if (needsFollowUp && followUpOwnerUserId) ownerName = (await activeStaffName(db, followUpOwnerUserId));
            (await db.prepare(
                      `INSERT INTO instructor_feedback
          (id, instructor_id, source_type, submitted_by_user_id, author_name, class_id, program_id,
           partner_org_id, session_id, visibility, curriculum_delivery, student_family_relationships,
           organization_reliability, leadership_contribution, strengths, concerns, body,
           follow_up_required, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'leadership', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    ).run(
                      id,
                      instructorId,
                      input.sourceType,
                      me.id,
                      authorName,
                      context.classId,
                      context.programId,
                      context.partnerOrgId,
                      context.sessionId,
                      curriculumDelivery,
                      studentFamilyRelationships,
                      organizationReliability,
                      leadershipContribution,
                      strengths,
                      concerns,
                      body,
                      needsFollowUp ? 1 : 0,
                      now,
                    ));
            if (needsFollowUp && followUpOwnerUserId && followUpDueAt) {
              const suffix = randomUUID();
              const sourceLabel = input.sourceType.replace(/_/g, " ");
              const title = followUpTitle ?? `Quality follow-up: ${instructor.name}`;
              const ratingEvidence = [
                curriculumDelivery != null ? `curriculum ${curriculumDelivery}/5` : null,
                studentFamilyRelationships != null ? `student/family ${studentFamilyRelationships}/5` : null,
                organizationReliability != null ? `reliability ${organizationReliability}/5` : null,
                leadershipContribution != null ? `leadership ${leadershipContribution}/5` : null,
              ].filter(Boolean).join(", ");
              const notes = [
                `Feedback source: ${sourceLabel}${authorName ? ` (${authorName})` : ""}.`,
                ratingEvidence ? `Ratings: ${ratingEvidence}.` : null,
                concerns ? `Concern: ${concerns}` : null,
                body ? `Context: ${body}` : null,
                `Owner: ${ownerName}.`,
              ].filter(Boolean).join("\n").slice(0, 4000);
              (await createConcernFollowUp(db, {
                          suffix,
                          instructorId,
                          instructorName: instructor.name,
                          kind: concerns || lowSignal ? "concern" : "coaching",
                          title,
                          ownerUserId: followUpOwnerUserId,
                          dueAt: followUpDueAt,
                          dueOn: followUpDue!.canonicalDate,
                          notes,
                          relatedFeedbackId: id,
                          priority: ratings.some((rating) => rating === 1) ? "urgent" : "high",
                          actorUserId: me.id,
                        }));
            }
            const ratedDimensions = ratings.filter((rating) => rating != null).length;
            (await logActivity(
                      "instructor",
                      instructorId,
                      "feedback_recorded",
                      `Leadership feedback recorded from ${input.sourceType.replace(/_/g, " ")} across ${ratedDimensions} rated dimension${ratedDimensions === 1 ? "" : "s"}${needsFollowUp ? "; development and Work follow-up opened" : ""}.`,
                      me.id,
                    ));
          }));
    revalidateInstructorQuality(instructorId);
    return { ok: true, id };
  } catch (error) {
    return actionError(error);
  }
}

export async function createInstructorDevelopmentItem(input: DevelopmentItemInput): Promise<QualityActionResult> {
  const me = await requireStaff();
  let instructorId: string;
  try {
    instructorId = requiredId(input?.instructorId, "Instructor");
    if (!DEVELOPMENT_KINDS.has(input?.kind)) throw new QualityActionError("Choose a valid development item type.");
    const title = limitedText(input?.title, "Title", 180);
    if (!title) throw new QualityActionError("Title is required.");
    const ownerUserId = requiredId(input?.ownerUserId, "Owner");
    if ((input as DevelopmentItemInput & { dueAt?: unknown })?.dueAt !== undefined) {
      throw new QualityActionError("Send the development due date as YYYY-MM-DD, without a browser-local timestamp.");
    }
    const dueDate = futureDateOnly(
      input?.dueOn,
      "Due date",
      input.kind !== "recognition",
    );
    const dueAt = dueDate?.epoch ?? null;
    const notes = limitedText(input?.notes, "Development notes", 4000);
    if (input.kind === "concern" && !notes) throw new QualityActionError("Document the evidence behind this concern.");
    const suffix = randomUUID();
    const id = `dev-${suffix}`;
    const now = Date.now();
    (await runImmediate(async (db) => {
            const instructor = (await assertActiveInstructor(db, instructorId));
            (await activeStaffName(db, ownerUserId));
            if (input.kind === "concern") {
              if (!dueAt) throw new QualityActionError("A concern needs a due date.");
              (await createConcernFollowUp(db, {
                          suffix,
                          instructorId,
                          instructorName: instructor.name,
                          kind: "concern",
                          title,
                          ownerUserId,
                          dueAt,
                          dueOn: dueDate!.canonicalDate,
                          notes,
                          relatedFeedbackId: null,
                          priority: "high",
                          actorUserId: me.id,
                        }));
            } else {
              (await db.prepare(
                          `INSERT INTO instructor_development_items
            (id, instructor_id, kind, title, stage, owner_user_id, due_at, due_on, status, notes,
             related_feedback_id, created_at, updated_at, resolved_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, NULL, ?, ?, NULL)`,
                        ).run(
                          id,
                          instructorId,
                          input.kind,
                          title,
                          input.kind === "recognition" ? "recognized" : "identified",
                          ownerUserId,
                          dueAt,
                          dueDate?.canonicalDate ?? null,
                          notes,
                          now,
                          now,
                        ));
            }
            (await logActivity(
                      "instructor",
                      instructorId,
                      input.kind === "recognition" ? "recognition_recorded" : "development_opened",
                      `${input.kind.replace(/_/g, " ")} recorded: ${title}${input.kind === "concern" ? "; atomic Work follow-up opened" : ""}.`,
                      me.id,
                    ));
          }));
    revalidateInstructorQuality(instructorId);
    return { ok: true, id };
  } catch (error) {
    return actionError(error);
  }
}

export async function advanceInstructorDevelopmentItem(
  instructorValue: string,
  developmentValue: string,
  progressNoteValue?: string,
): Promise<QualityActionResult> {
  const me = await requireStaff();
  let instructorId: string;
  try {
    instructorId = requiredId(instructorValue, "Instructor");
    const developmentId = requiredId(developmentValue, "Development item");
    const progressNote = limitedText(progressNoteValue, "Progress note", 2000);
    const now = Date.now();
    (await runImmediate(async (db) => {
            (await assertActiveInstructor(db, instructorId));
            const item = (await db
                    .prepare("SELECT title, stage, status, notes, updated_at FROM instructor_development_items WHERE id = ? AND instructor_id = ?")
                    .get(developmentId, instructorId)) as
              | { title: string; stage: string; status: string; notes: string | null; updated_at: number }
              | undefined;
            if (!item || item.status !== "open") throw new QualityActionError("This development item is resolved or no longer exists.");
            const nextStage = DEVELOPMENT_NEXT_STAGE[item.stage];
            if (!nextStage) throw new QualityActionError("This item is ready for resolution rather than another stage.");
            const evidenceLine = progressNote
              ? `${new Date(now).toLocaleDateString("en-US")} · ${me.name}: ${progressNote}`
              : `${new Date(now).toLocaleDateString("en-US")} · ${me.name}: Advanced from ${item.stage.replace(/_/g, " ")} to ${nextStage.replace(/_/g, " ")}.`;
            const updated = (await db
                    .prepare("UPDATE instructor_development_items SET stage = ?, notes = ?, updated_at = ? WHERE id = ? AND status = 'open' AND updated_at = ?")
                    .run(nextStage, appendEvidence(item.notes, evidenceLine), now, developmentId, item.updated_at));
            if (updated.changes !== 1) throw new QualityActionError("This development item changed. Refresh and try again.");
            (await logActivity(
                      "instructor",
                      instructorId,
                      "development_advanced",
                      `${item.title} advanced to ${nextStage.replace(/_/g, " ")}.`,
                      me.id,
                    ));
          }));
    revalidateInstructorQuality(instructorId);
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function resolveInstructorDevelopmentItem(
  instructorValue: string,
  developmentValue: string,
  outcomeValue: string,
): Promise<QualityActionResult> {
  const me = await requireStaff();
  let instructorId: string;
  try {
    instructorId = requiredId(instructorValue, "Instructor");
    const developmentId = requiredId(developmentValue, "Development item");
    const outcome = limitedText(outcomeValue, "Resolution outcome", 2000);
    if (!outcome || outcome.length < 3) throw new QualityActionError("Document the resolution outcome.");
    const now = Date.now();
    (await runImmediate(async (db) => {
            (await assertInstructorExists(db, instructorId));
            const item = (await db
                    .prepare("SELECT title, status, notes, updated_at FROM instructor_development_items WHERE id = ? AND instructor_id = ?")
                    .get(developmentId, instructorId)) as { title: string; status: string; notes: string | null; updated_at: number } | undefined;
            if (!item || item.status !== "open") throw new QualityActionError("This development item is already resolved or no longer exists.");
            const evidence = appendEvidence(item.notes, `${new Date(now).toLocaleDateString("en-US")} · Resolved by ${me.name}: ${outcome}`);
            const updated = (await db
                    .prepare(
                      `UPDATE instructor_development_items
              SET stage = 'resolved', status = 'resolved', notes = ?, resolved_at = ?, updated_at = ?
            WHERE id = ? AND status = 'open' AND updated_at = ?`,
                    )
                    .run(evidence, now, now, developmentId, item.updated_at));
            if (updated.changes !== 1) throw new QualityActionError("This development item changed. Refresh and try again.");

            const taskId = `wrk-${developmentId.slice(4)}`;
            const task = (await db.prepare("SELECT status, updated_at FROM tasks WHERE id = ?").get(taskId)) as { status: string; updated_at: number } | undefined;
            if (task?.status === "open") {
              const completed = (await db.prepare(
                        `UPDATE tasks
              SET status = 'done', completed_at = ?, completion_note = ?, updated_at = ?
            WHERE id = ? AND status = 'open' AND updated_at = ?`,
                      ).run(now, outcome, now, taskId, task.updated_at));
              if (completed.changes !== 1) throw new QualityActionError("The linked Work item changed. Refresh and try again.");
              (await logActivity("task", taskId, "completed", `Closed with the linked instructor development outcome.`, me.id));
            }
            (await logActivity("instructor", instructorId, "development_resolved", `${item.title} resolved with documented outcome.`, me.id));
          }));
    revalidateInstructorQuality(instructorId);
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}
