"use server";

import { revalidatePath } from "next/cache";
import { randomBytes, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { isSelfModuleUnlocked, getSelfModuleViews, hasCompletedAllModules, trackForModule } from "@/lib/self-paced";
import {
  issueCertificate,
  buildCertificateHtml,
  certificateFilename,
  certTrackTitle,
  CERT_TRACK,
  CERT_TRACK_201,
} from "@/lib/certificate";
import { createNotification } from "@/lib/notifications";
import { createInvitationInternal, logActivity, recomputeInstructorStatuses } from "@/lib/hiring";
import { recordDailyVisit as applyDailyVisitStreak, type RecordVisitResult } from "@/lib/streak";
import { conceptLabel, getDailyQuestionById, gradeAnswer, tierLabel } from "@/lib/daily-question";
import { checkAndAwardBadges } from "@/lib/badges";
import { getPlayerCardData, buildPlayerCardHtml, playerCardFilename, recordPlayerCard } from "@/lib/player-card";
import { rankForStudent, nextRankName } from "@/lib/scoring";
import { hashOpaqueToken } from "@/lib/security-tokens";
import { recordClassStaffingDecision } from "@/lib/operational-decisions";
import { canonicalDateInZone, formatCanonicalDate } from "@/lib/timezone";
import {
  queueInvitationDelivery,
  type InvitationDeliveryState,
} from "@/lib/invitation-delivery";
import { updateInquiryStatus } from "@/app/actions/inquiries";
import { submitPublicInquiry, type PublicInquirySource } from "@/app/actions/public-forms";
import {
  orderedTrackLessons,
  unlockChecklist,
  reflectionWordCount,
  SELF_PACED_COHORT_ID,
  SELF_PACED_SESSIONS,
  TRACK_101,
  TRACK_201,
  type LessonProgressDetail,
} from "@/lib/account";
import type {
  AttendanceState,
  InquiryStatus,
  Invitation,
  InvitationStatus,
} from "@/lib/account";

function refreshApp() {
  revalidatePath("/app", "layout");
}

type LegacyDb = ReturnType<typeof getDb>;

interface LegacyCohortRow {
  id: string;
  org_id: string;
  track: string;
  instructor_id: string | null;
  current_lesson_id: string | null;
  status: string;
  org_status: string | null;
}

interface LegacyUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  org_id: string;
  org_status: string | null;
}

interface LegacyEnrollmentRow {
  enroll: string;
}

interface CanonicalCohortProjectionRow {
  class_id: string;
  class_status: string;
  class_partner_org_id: string | null;
  capacity: number | null;
  lead_instructor_id: string | null;
  program_id: string;
  program_stage: string;
  program_partner_org_id: string | null;
  source_type: string | null;
  source_id: string | null;
}

interface CanonicalStudentRow {
  id: string;
  enrollment_status: string;
}

interface CanonicalEnrollmentRow {
  id: string;
  status: string;
}

interface SelfModuleRow {
  id: string;
  track: string;
  ordinal: number;
}

const LEGACY_USER_ROLES = new Set(["student", "instructor", "admin", "growth"]);
const BOW_ORG_ID = "org-bow";
const TERMINAL_CANONICAL_CLASS_STATUSES = new Set(["completed", "cancelled"]);
const HISTORICAL_CANONICAL_PROGRAM_STAGES = new Set(["completed", "renewal_review", "renewed", "closed"]);

async function withLegacyTransaction<T>(db: LegacyDb, work: () => T): Promise<T> {
  // Serialize standalone writers. A nested caller already owns the writer
  // lock, so use a savepoint only in that case.
  const nested = db.isTransaction;
  (await db.exec(nested ? "SAVEPOINT legacy_lms_action" : "BEGIN IMMEDIATE"));
  try {
    const result = work();
    (await db.exec(nested ? "RELEASE SAVEPOINT legacy_lms_action" : "COMMIT"));
    return result;
  } catch (error) {
    if (nested) {
      (await db.exec("ROLLBACK TO SAVEPOINT legacy_lms_action"));
      (await db.exec("RELEASE SAVEPOINT legacy_lms_action"));
    } else if (db.isTransaction) {
      (await db.exec("ROLLBACK"));
    }
    throw error;
  }
}

async function requireLegacyCohort(db: LegacyDb, cohortId: string, requireActiveOrganization = true): Promise<LegacyCohortRow> {
  const cohort = (await db
      .prepare(
        `SELECT c.id, c.org_id, c.track, c.instructor_id, c.current_lesson_id, c.status,
              o.status AS org_status
         FROM cohorts c
         LEFT JOIN organizations o ON o.id = c.org_id
        WHERE c.id = ?`,
      )
      .get(cohortId)) as LegacyCohortRow | undefined;
  if (!cohort) throw new Error("Cohort not found.");
  if (!cohort.org_status) throw new Error("The cohort organization no longer exists.");
  if (requireActiveOrganization && cohort.org_status !== "active") {
    throw new Error("The cohort organization is not active.");
  }
  return cohort;
}

function requireCohortCurriculum(cohort: LegacyCohortRow): ReturnType<typeof orderedTrackLessons> {
  const curriculum = orderedTrackLessons(cohort.track);
  if (curriculum.length === 0) throw new Error("This cohort does not have a valid curriculum track.");
  return curriculum;
}

async function requireLegacyUser(
  db: LegacyDb,
  userId: string,
  options: {
    role?: "student" | "instructor";
    statuses: readonly string[];
    requireActiveOrganization?: boolean;
  },
): Promise<LegacyUserRow> {
  const user = (await db
      .prepare(
        `SELECT u.id, u.name, u.email, u.role, u.status, u.org_id,
              o.status AS org_status
         FROM users u
         LEFT JOIN organizations o ON o.id = u.org_id
        WHERE u.id = ?`,
      )
      .get(userId)) as LegacyUserRow | undefined;
  if (!user) throw new Error("User not found.");
  if (!LEGACY_USER_ROLES.has(user.role)) throw new Error("The user has an invalid role.");
  if (options.role && user.role !== options.role) {
    throw new Error(`The selected user is not a${options.role === "instructor" ? "n" : ""} ${options.role}.`);
  }
  if (!options.statuses.includes(user.status)) throw new Error("The user is not in an eligible account state.");
  if (options.requireActiveOrganization ?? true) {
    if (!user.org_status) throw new Error("The user's organization no longer exists.");
    if (user.org_status !== "active") throw new Error("The user's organization is not active.");
  }
  return user;
}

async function requireCanonicalTeachingIdentity(db: LegacyDb, userId: string, recompute: boolean): Promise<string> {
  (await requireLegacyUser(db, userId, { role: "instructor", statuses: ["active"] }));
  const profiles = (await db.prepare(
      `SELECT i.id, i.stage, i.eligibility_status
       FROM people p
       JOIN instructors i ON i.person_id = p.id
      WHERE p.user_id = ? AND i.stage NOT IN ('rejected','inactive')
      ORDER BY i.created_at DESC, i.id DESC`,
    ).all(userId)) as { id: string; stage: string; eligibility_status: string }[];
  if (profiles.length !== 1) {
    throw new Error("This account must have exactly one current instructor dossier before it can teach.");
  }
  if (recompute) (await recomputeInstructorStatuses(profiles[0].id));
  const current = (await db.prepare("SELECT stage, eligibility_status FROM instructors WHERE id = ?").get(profiles[0].id)) as
    | { stage: string; eligibility_status: string }
    | undefined;
  if (!current || current.stage !== "active" || current.eligibility_status !== "eligible") {
    throw new Error("This instructor has not completed the current BOW quality and eligibility gates.");
  }
  return profiles[0].id;
}

async function requireCanonicalCohortProjection(
  db: LegacyDb,
  cohort: LegacyCohortRow,
): Promise<CanonicalCohortProjectionRow> {
  const projection = (await db.prepare(
      `SELECT c.id AS class_id, c.status AS class_status,
            c.partner_org_id AS class_partner_org_id, c.capacity,
            c.lead_instructor_id, p.id AS program_id, p.stage AS program_stage,
            p.partner_org_id AS program_partner_org_id, p.source_type, p.source_id
       FROM classes c
       JOIN programs p ON p.id = c.program_id
      WHERE c.id = ?`,
    ).get(cohort.id)) as CanonicalCohortProjectionRow | undefined;
  if (!projection) {
    throw new Error(
      "This Cohort is missing its canonical Program and Class projection. Ask operations to repair it before making this change.",
    );
  }
  if (
    projection.class_partner_org_id !== cohort.org_id
    || projection.program_partner_org_id !== cohort.org_id
    || projection.source_type !== "legacy_class"
    || projection.source_id !== cohort.id
  ) {
    throw new Error(
      "This Cohort's canonical Program or Class link is inconsistent. Ask operations to reconcile it before making this change.",
    );
  }
  return projection;
}

function assertCanonicalCohortCanChange(
  projection: CanonicalCohortProjectionRow,
  change: "staffing" | "enrollment",
): void {
  if (
    TERMINAL_CANONICAL_CLASS_STATUSES.has(projection.class_status)
    || HISTORICAL_CANONICAL_PROGRAM_STAGES.has(projection.program_stage)
  ) {
    throw new Error(
      change === "staffing"
        ? "Historical Cohorts cannot change instructor staffing."
        : "Historical Cohorts cannot change student enrollment.",
    );
  }
}

async function requireCanonicalStudentIdentity(db: LegacyDb, userId: string): Promise<CanonicalStudentRow> {
  const students = (await db.prepare(
      "SELECT id, enrollment_status FROM students WHERE user_id = ? ORDER BY created_at DESC, id DESC",
    ).all(userId)) as unknown as CanonicalStudentRow[];
  if (students.length !== 1 || students[0].enrollment_status !== "active") {
    throw new Error(
      "This account must be linked to exactly one active canonical Student record before Cohort enrollment can change.",
    );
  }
  return students[0];
}

async function createCanonicalCohortProjection(
  db: LegacyDb,
  cohort: LegacyCohortRow,
  name: string,
  ownerUserId: string,
  now: number,
): Promise<CanonicalCohortProjectionRow> {
  const curricula = (await db.prepare(
      "SELECT id FROM curricula WHERE title = 'Legacy LMS Program' ORDER BY created_at, id",
    ).all()) as { id: string }[];
  if (curricula.length !== 1) {
    throw new Error(
      "The legacy curriculum bridge is not configured uniquely. Ask operations to repair it before creating a Cohort.",
    );
  }
  if ((await db.prepare("SELECT 1 FROM classes WHERE id = ?").get(cohort.id))) {
    throw new Error("A canonical Class already uses this Cohort identifier.");
  }
  if ((await db.prepare("SELECT 1 FROM programs WHERE source_type = 'legacy_class' AND source_id = ?").get(cohort.id))) {
    throw new Error("A canonical Program already projects this Cohort.");
  }

  const programId = `prg-${cohort.id}`;
  if ((await db.prepare("SELECT 1 FROM programs WHERE id = ?").get(programId))) {
    throw new Error("A canonical Program identifier collision prevented this Cohort from being created safely.");
  }
  const curriculumId = curricula[0].id;
  (await db.prepare(
        `INSERT INTO programs
      (id, name, partner_org_id, curriculum_id, audience, delivery_format, stage,
       capacity, minimum_enrollment, owner_user_id, partner_confirmed, materials_status,
       renewal_status, source_type, source_id, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'in_person', 'planning', 20, 1, ?, 0, 'not_ready',
             'not_due', 'legacy_class', ?, ?, ?, ?)`,
      ).run(
        programId,
        name,
        cohort.org_id,
        curriculumId,
        `BOW Track ${cohort.track}`,
        ownerUserId,
        cohort.id,
        `Created atomically from legacy Cohort ${cohort.id}; the Class remains the delivery record.`,
        now,
        now,
      ));
  (await db.prepare(
        `INSERT INTO classes
      (id, title, curriculum_id, partner_org_id, location, online_format,
       start_date, end_date, recurrence, age_range, capacity, minimum_enrollment,
       lead_instructor_id, program_id, status, internal_notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, 20, 1,
             NULL, ?, 'planning', ?, ?, ?)`,
      ).run(
        cohort.id,
        name,
        curriculumId,
        cohort.org_id,
        programId,
        `Created atomically from LMS Cohort ${cohort.id}.`,
        now,
        now,
      ));
  (await logActivity("program", programId, "created", `Created with legacy Cohort ${cohort.id}.`, ownerUserId));
  (await logActivity("class", cohort.id, "created", `Created with legacy Cohort ${cohort.id}.`, ownerUserId));
  return (await requireCanonicalCohortProjection(db, cohort));
}

async function mirrorLegacyInstructorAssignment(
  db: LegacyDb,
  cohort: LegacyCohortRow,
  projection: CanonicalCohortProjectionRow,
  canonicalInstructorId: string | null,
  actorUserId: string,
  now: number,
): Promise<void> {
  assertCanonicalCohortCanChange(projection, "staffing");
  const currentLeads = (await db.prepare(
      `SELECT id, instructor_id, role
       FROM class_instructors
      WHERE class_id = ? AND role = 'lead' AND removed_at IS NULL
      ORDER BY added_at, id`,
    ).all(projection.class_id)) as { id: string; instructor_id: string; role: string }[];

  for (const currentLead of currentLeads) {
    if (currentLead.instructor_id === canonicalInstructorId) continue;
    const removalReason = canonicalInstructorId
      ? `Replaced through legacy Cohort ${cohort.id} staffing.`
      : `Cleared through legacy Cohort ${cohort.id} staffing.`;
    const removalDecision = (await recordClassStaffingDecision(db, {
          classId: projection.class_id,
          instructorId: currentLead.instructor_id,
          assignmentId: currentLead.id,
          action: "removed",
          role: "lead",
          reason: removalReason,
          actorUserId,
          decidedAt: now,
          programId: projection.program_id,
        }));
    const removed = (await db.prepare(
          `UPDATE class_instructors
          SET removed_at = ?, removal_reason = ?, removed_by = ?,
              removal_decision_id = ?, removal_decision_fingerprint = ?
        WHERE id = ? AND removed_at IS NULL`,
        ).run(
          now,
          removalReason,
          actorUserId,
          removalDecision.decisionId,
          removalDecision.fingerprint,
          currentLead.id,
        ));
    if (removed.changes !== 1) {
      throw new Error("The canonical instructor assignment changed before the Cohort staffing update completed.");
    }
    (await logActivity("class", projection.class_id, "staffing", removalReason, actorUserId));
  }

  if (!canonicalInstructorId) {
    (await db.prepare("UPDATE classes SET lead_instructor_id = NULL, updated_at = ? WHERE id = ?")
            .run(now, projection.class_id));
    return;
  }

  const existing = (await db.prepare(
      `SELECT id, role
       FROM class_instructors
      WHERE class_id = ? AND instructor_id = ? AND removed_at IS NULL`,
    ).get(projection.class_id, canonicalInstructorId)) as { id: string; role: string } | undefined;
  const alreadyMirrored = existing?.role === "lead" && projection.lead_instructor_id === canonicalInstructorId;
  if (!alreadyMirrored) {
    const assignmentId = existing?.id ?? `cin-${randomUUID().slice(0, 10)}`;
    const assignmentReason = `Assigned through legacy Cohort ${cohort.id} staffing.`;
    const assignmentDecision = (await recordClassStaffingDecision(db, {
          classId: projection.class_id,
          instructorId: canonicalInstructorId,
          assignmentId,
          action: existing && existing.role !== "lead" ? "role_changed" : "assigned",
          role: "lead",
          reason: assignmentReason,
          actorUserId,
          decidedAt: now,
          programId: projection.program_id,
        }));
    if (existing) {
      const updated = (await db.prepare(
              `UPDATE class_instructors
            SET role = 'lead', decision_reason = ?, assigned_by = ?, decision_id = ?,
                decision_fingerprint = ?, decision_at = ?
          WHERE id = ? AND removed_at IS NULL`,
            ).run(
              assignmentReason,
              actorUserId,
              assignmentDecision.decisionId,
              assignmentDecision.fingerprint,
              now,
              existing.id,
            ));
      if (updated.changes !== 1) {
        throw new Error("The canonical instructor assignment changed before the Cohort staffing update completed.");
      }
    } else {
      (await db.prepare(
                `INSERT INTO class_instructors
          (id, class_id, instructor_id, role, decision_reason, assigned_by,
           decision_id, decision_fingerprint, decision_at, added_at)
         VALUES (?, ?, ?, 'lead', ?, ?, ?, ?, ?, ?)`,
              ).run(
                assignmentId,
                projection.class_id,
                canonicalInstructorId,
                assignmentReason,
                actorUserId,
                assignmentDecision.decisionId,
                assignmentDecision.fingerprint,
                now,
                now,
              ));
    }
    (await logActivity("class", projection.class_id, "staffing", assignmentReason, actorUserId));
  }
  (await db.prepare("UPDATE classes SET lead_instructor_id = ?, updated_at = ? WHERE id = ?")
        .run(canonicalInstructorId, now, projection.class_id));
}

async function enrollCanonicalStudent(
  db: LegacyDb,
  projection: CanonicalCohortProjectionRow,
  studentId: string,
  actorUserId: string,
  now: number,
): Promise<void> {
  assertCanonicalCohortCanChange(projection, "enrollment");
  const rows = (await db.prepare(
      "SELECT id, status FROM class_enrollments WHERE class_id = ? AND student_id = ?",
    ).all(projection.class_id, studentId)) as unknown as CanonicalEnrollmentRow[];
  if (rows.length > 1) {
    throw new Error("Duplicate canonical enrollment rows must be reconciled before this Cohort can change.");
  }
  const existing = rows[0];
  if (existing?.status !== "enrolled" && projection.capacity && projection.capacity > 0) {
    const count = (await db.prepare(
          `SELECT COUNT(*) AS n
         FROM class_enrollments ce
         JOIN students s ON s.id = ce.student_id
        WHERE ce.class_id = ? AND ce.status = 'enrolled' AND s.enrollment_status = 'active'`,
        ).get(projection.class_id)) as { n: number };
    if (count.n >= projection.capacity) throw new Error("This Cohort is full.");
  }

  let enrollmentId = existing?.id;
  if (!existing) {
    enrollmentId = `cen-${randomUUID().slice(0, 10)}`;
    (await db.prepare(
            `INSERT INTO class_enrollments
        (id, class_id, student_id, status, enrolled_at, withdrawn_at, withdrawal_reason)
       VALUES (?, ?, ?, 'enrolled', ?, NULL, NULL)`,
          ).run(enrollmentId, projection.class_id, studentId, now));
  } else if (existing.status !== "enrolled") {
    const updated = (await db.prepare(
          `UPDATE class_enrollments
          SET status = 'enrolled', enrolled_at = ?, withdrawn_at = NULL, withdrawal_reason = NULL
        WHERE id = ? AND status <> 'enrolled'`,
        ).run(now, existing.id));
    if (updated.changes !== 1) {
      throw new Error("The canonical enrollment changed before the Cohort update completed.");
    }
  }
  if (!enrollmentId) throw new Error("The canonical enrollment could not be created.");
  const rostered = (await db.prepare(
      `INSERT INTO class_session_roster (id, session_id, student_id, enrollment_id, rostered_at)
     SELECT 'csr-' || lower(hex(randomblob(16))), cs.id, ?, ?, ?
       FROM class_sessions cs
      WHERE cs.class_id = ? AND cs.session_date > ?
        AND NOT EXISTS (
          SELECT 1 FROM class_session_roster csr
           WHERE csr.session_id = cs.id AND csr.student_id = ?
        )`,
    ).run(studentId, enrollmentId, now, projection.class_id, now, studentId));
  if (!existing || existing.status !== "enrolled" || rostered.changes > 0) {
    (await logActivity("class", projection.class_id, "note", "Student enrolled through the legacy Cohort bridge; future rosters updated.", actorUserId));
  }
}

async function withdrawCanonicalStudent(
  db: LegacyDb,
  projection: CanonicalCohortProjectionRow,
  studentId: string,
  actorUserId: string,
  reason: string,
  now: number,
): Promise<void> {
  assertCanonicalCohortCanChange(projection, "enrollment");
  const rows = (await db.prepare(
      "SELECT id, status FROM class_enrollments WHERE class_id = ? AND student_id = ?",
    ).all(projection.class_id, studentId)) as unknown as CanonicalEnrollmentRow[];
  if (rows.length > 1) {
    throw new Error("Duplicate canonical enrollment rows must be reconciled before this Cohort can change.");
  }
  const existing = rows[0];
  if (!existing || existing.status !== "enrolled") {
    throw new Error(
      "This legacy enrollment is not linked to a current canonical Class enrollment. Ask operations to reconcile it before continuing.",
    );
  }
  const withdrawn = (await db.prepare(
      `UPDATE class_enrollments
        SET status = 'withdrawn', withdrawn_at = ?, withdrawal_reason = ?
      WHERE id = ? AND status = 'enrolled'`,
    ).run(now, reason, existing.id));
  if (withdrawn.changes !== 1) {
    throw new Error("The canonical enrollment changed before the Cohort update completed.");
  }
  (await db.prepare(
        `DELETE FROM class_session_roster
      WHERE student_id = ?
        AND session_id IN (
          SELECT id FROM class_sessions WHERE class_id = ? AND session_date > ?
        )
        AND NOT EXISTS (
          SELECT 1 FROM attendance_records ar
           WHERE ar.session_id = class_session_roster.session_id
             AND ar.student_id = class_session_roster.student_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM class_session_reports report
           WHERE report.session_id = class_session_roster.session_id AND report.completed = 1
        )`,
      ).run(studentId, projection.class_id, now));
  (await logActivity("class", projection.class_id, "note", `Student withdrawn through the legacy Cohort bridge. ${reason}`, actorUserId));
}

async function requireStudentMembership(
  db: LegacyDb,
  cohort: LegacyCohortRow,
  studentId: string,
  options: { userStatuses: readonly string[]; enrollmentStates: readonly string[] },
): Promise<{ user: LegacyUserRow; enrollment: LegacyEnrollmentRow }> {
  const user = (await requireLegacyUser(db, studentId, { role: "student", statuses: options.userStatuses }));
  if (user.org_id !== cohort.org_id) {
    throw new Error("The student does not belong to this cohort's organization.");
  }
  const enrollment = (await db
      .prepare("SELECT enroll FROM enrollments WHERE user_id = ? AND cohort_id = ?")
      .get(studentId, cohort.id)) as LegacyEnrollmentRow | undefined;
  if (!enrollment || !options.enrollmentStates.includes(enrollment.enroll)) {
    throw new Error("The student is not an eligible member of this cohort.");
  }
  return { user, enrollment };
}

async function requireSelfModule(db: LegacyDb, moduleId: string): Promise<SelfModuleRow> {
  const moduleRow = (await db
      .prepare("SELECT id, COALESCE(track, '101') AS track, ordinal FROM self_modules WHERE id = ?")
      .get(moduleId)) as SelfModuleRow | undefined;
  if (!moduleRow || !moduleRow.track || !Number.isInteger(Number(moduleRow.ordinal))) {
    throw new Error("Module not found in the self-paced curriculum.");
  }
  return { ...moduleRow, ordinal: Number(moduleRow.ordinal) };
}

/**
 * Instructors may only manage cohorts they're assigned to; admins can manage
 * any cohort. Throws so the mutation aborts instead of silently no-op'ing —
 * this should never trigger from the UI, only from a forged request.
 */
async function assertCohortOwnership(
  me: { id: string; role: string },
  cohortId: string,
  db: LegacyDb = getDb(),
): Promise<LegacyCohortRow> {
  const cohort = (await requireLegacyCohort(db, cohortId));
  if (me.role === "admin") return cohort;
  const actor = (await requireLegacyUser(db, me.id, { role: "instructor", statuses: ["active"] }));
  const canonicalInstructorId = (await requireCanonicalTeachingIdentity(db, actor.id, false));
  if (cohort.instructor_id !== actor.id) {
    throw new Error("You are not assigned to this cohort.");
  }
  const projection = (await requireCanonicalCohortProjection(db, cohort));
  const currentLead = (await db.prepare(
      `SELECT ci.id
       FROM class_instructors ci
      WHERE ci.class_id = ? AND ci.instructor_id = ?
        AND ci.role = 'lead' AND ci.removed_at IS NULL`,
    ).get(projection.class_id, canonicalInstructorId)) as { id: string } | undefined;
  if (!currentLead || projection.lead_instructor_id !== canonicalInstructorId) {
    throw new Error(
      "Your legacy Cohort assignment is no longer current in the canonical Class. Open the Class workspace or ask operations to reconcile staffing.",
    );
  }
  return cohort;
}

/* ---------------- People (admin) ---------------- */

export async function suspendUser(userId: string): Promise<void> {
  const me = await requireRole("admin");
  if (userId === me.id) throw new Error("You cannot suspend your own account.");
  const db = getDb();
  (await withLegacyTransaction(db, async () => {
        (await requireLegacyUser(db, userId, { statuses: ["active"], requireActiveOrganization: false }));
        const result = (await db.prepare("UPDATE users SET status = 'suspended' WHERE id = ? AND status = 'active'").run(userId));
        if (result.changes !== 1) throw new Error("The account could not be suspended.");
        // Kill every live session in the same transaction so access cannot outlive
        // a successfully committed suspension.
        (await db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId));
        // A reset credential issued before suspension must never become usable
        // again merely because an administrator later restores the account.
        (await db.prepare(
                "UPDATE password_reset_tokens SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL",
              ).run(Date.now(), userId));
        (await db.prepare(
                `UPDATE profile_sharing_consents
          SET revoked_by_user_id = ?, revoked_at = ?, discoverable = 0
        WHERE student_user_id = ? AND revoked_at IS NULL`,
              ).run(me.id, Date.now(), userId));

        const linkedInstructor = (await db.prepare(
              `SELECT i.id, i.stage
         FROM people p JOIN instructors i ON i.person_id = p.id
        WHERE p.user_id = ? AND i.stage IN ('eligible','active')
        ORDER BY i.updated_at DESC LIMIT 1`,
            ).get(userId)) as { id: string; stage: string } | undefined;
        if (linkedInstructor) {
          const now = Date.now();
          const deactivated = (await db.prepare(
                  "UPDATE instructors SET stage = 'inactive', updated_at = ? WHERE id = ? AND stage = ?",
                ).run(now, linkedInstructor.id, linkedInstructor.stage));
          if (deactivated.changes !== 1) throw new Error("The linked instructor changed during suspension.");
          const affected = (await db.prepare(
                  `SELECT COUNT(*) AS n
           FROM class_instructors ci JOIN classes c ON c.id = ci.class_id
          WHERE ci.instructor_id = ? AND ci.removed_at IS NULL
            AND c.status NOT IN ('completed','cancelled')`,
                ).get(linkedInstructor.id)) as { n: number };
          if (affected.n > 0) {
            (await db.prepare(
                        `INSERT INTO tasks
            (id, title, owner_user_id, due_at, status, kind, priority, context, recommended_action,
             entity_type, entity_id, handoff_to_founder, created_at, updated_at)
           SELECT ?, ?, ?, ?, 'open', 'issue', 'urgent', ?, ?, 'instructor', ?, 0, ?, ?
            WHERE NOT EXISTS (
              SELECT 1 FROM tasks
               WHERE entity_type = 'instructor' AND entity_id = ? AND status = 'open'
                 AND kind = 'issue' AND recommended_action = 'Assign replacement coverage and confirm every affected Program remains ready.'
            )`,
                      ).run(
                        `wrk-${randomUUID().slice(0, 10)}`,
                        `Replace suspended instructor across ${affected.n} Class${affected.n === 1 ? "" : "es"}`,
                        me.id,
                        now,
                        "The linked account was suspended and teaching access was revoked.",
                        "Assign replacement coverage and confirm every affected Program remains ready.",
                        linkedInstructor.id,
                        now,
                        now,
                        linkedInstructor.id,
                      ));
          }
          (await logActivity("instructor", linkedInstructor.id, "stage_change", "Teaching access revoked because the linked account was suspended.", me.id));
        }
      }));
  refreshApp();
  revalidatePath("/profile", "layout");
}

export async function restoreUser(userId: string): Promise<void> {
  await requireRole("admin");
  const db = getDb();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const user = (await requireLegacyUser(db, userId, { statuses: ["suspended"] }));
    if (user.email.endsWith("@deleted.invalid")) {
      throw new Error("An anonymized account cannot be restored.");
    }
    const result = (await db.prepare(
          "UPDATE users SET status = 'active' WHERE id = ? AND status = 'suspended' AND email NOT LIKE '%@deleted.invalid'",
        ).run(userId));
    if (result.changes !== 1) throw new Error("The account could not be restored.");
    (await db.exec("COMMIT"));
  } catch (error) {
    if (db.isTransaction) (await db.exec("ROLLBACK"));
    throw error;
  }
  refreshApp();
}

/* ---------------- Invitations (admin) ---------------- */

export async function setInvitationStatus(
  id: string,
  status: InvitationStatus,
): Promise<{ token?: string; invitationDelivery?: InvitationDeliveryState }> {
  const me = await requireRole("admin");
  const db = getDb();
  let revealedToken: string | undefined;
  let deliveryInput: {
    invitationId: string;
    token: string;
    email: string;
    role: "student" | "instructor";
  } | undefined;
  if (status === "pending") {
    const now = Date.now();
    const expiresAt = now + 14 * 24 * 60 * 60 * 1000;
    const expires = new Date(expiresAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const token = randomBytes(32).toString("base64url");
    (await db.exec("BEGIN IMMEDIATE"));
    try {
      const invitation = (await db
              .prepare("SELECT email, role, org_id, cohort_id, status FROM invitations WHERE id = ?")
              .get(id)) as
        | { email: string; role: string; org_id: string; cohort_id: string | null; status: string }
        | undefined;
      if (!invitation || invitation.status === "accepted") throw new Error("Accepted invitations cannot be resent.");
      if (invitation.role !== "student" && invitation.role !== "instructor") throw new Error("This invitation has an invalid role.");
      if (!(await db.prepare("SELECT 1 FROM organizations WHERE id = ? AND status = 'active'").get(invitation.org_id))) {
        throw new Error("The invitation organization is no longer active.");
      }
      if (invitation.role === "student") {
        const cohort = invitation.cohort_id
          ? ((await db.prepare("SELECT org_id, status FROM cohorts WHERE id = ?").get(invitation.cohort_id)) as
              | { org_id: string; status: string }
              | undefined)
          : undefined;
        if (!cohort || cohort.org_id !== invitation.org_id || !["active", "enrolling"].includes(cohort.status)) {
          throw new Error("The invitation cohort is no longer available.");
        }
      } else {
        const pipeline = (await db.prepare(
                  `SELECT i.stage
             FROM people p
             JOIN instructors i ON i.person_id = p.id
            WHERE lower(p.email) = lower(?)
            ORDER BY i.updated_at DESC
            LIMIT 1`,
                ).get(invitation.email)) as { stage: string } | undefined;
        if (
          invitation.org_id !== BOW_ORG_ID
          || !pipeline
          || !["accepted", "onboarding", "training", "practice_evaluation", "eligible", "active"].includes(pipeline.stage)
        ) {
          throw new Error("Instructor invitations must come from an approved BOW hiring record.");
        }
      }
      const existing = (await db
              .prepare("SELECT role, org_id, status, password_hash FROM users WHERE lower(email) = lower(?)")
              .get(invitation.email)) as
        | { role: string; org_id: string; status: string; password_hash: string | null }
        | undefined;
      if (
        existing &&
        !(
          existing.status === "invited" &&
          existing.password_hash == null &&
          existing.role === invitation.role &&
          existing.org_id === invitation.org_id
        )
      ) {
        throw new Error("That email already has an active or incompatible account.");
      }

      (await db.prepare(
                "UPDATE invitations SET status = 'revoked' WHERE id != ? AND lower(email) = lower(?) AND status = 'pending'",
              ).run(id, invitation.email));
      const result = (await db
              .prepare("UPDATE invitations SET status = 'pending', token = ?, token_hash = ?, expires = ?, expires_at = ? WHERE id = ? AND status != 'accepted'")
              .run(`retired:${randomUUID()}`, hashOpaqueToken(token), expires, expiresAt, id));
      if (result.changes !== 1) throw new Error("Accepted invitations cannot be resent.");
      (await db.exec("COMMIT"));
      revealedToken = token;
      deliveryInput = {
        invitationId: id,
        token,
        email: invitation.email,
        role: invitation.role,
      };
    } catch (error) {
      if (db.isTransaction) (await db.exec("ROLLBACK"));
      throw error;
    }
  } else if (status === "revoked") {
    const result = (await db.prepare("UPDATE invitations SET status = 'revoked' WHERE id = ? AND status != 'accepted'").run(id));
    if (result.changes !== 1) throw new Error("The invitation could not be revoked.");
  } else {
    throw new Error("Invitation status can only be changed by resending or revoking it.");
  }
  const invitationDelivery = deliveryInput
    ? queueInvitationDelivery({ ...deliveryInput, actorUserId: me.id })
    : undefined;
  refreshApp();
  return { token: revealedToken, invitationDelivery };
}

export interface NewInvitationInput {
  role: "student" | "instructor";
  email: string;
  orgId: string;
  cohortId: string | null;
}

export async function createInvitation(
  input: NewInvitationInput,
): Promise<Invitation & { invitationDelivery: InvitationDeliveryState }> {
  const me = await requireRole("admin");
  if (input.role === "instructor") {
    throw new Error("Invite instructors from their approved hiring record so onboarding and eligibility stay connected.");
  }
  const db = getDb();
  let created: Awaited<ReturnType<typeof createInvitationInternal>>;
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    // createInvitationInternal uses a nested SAVEPOINT. Taking the writer lock
    // first makes its active Organization/Cohort checks and credential insert
    // one serializable decision, so a concurrent partner pause cannot revoke
    // access and then be followed by a newly inserted invitation.
    created = (await createInvitationInternal(input));
    (await db.exec("COMMIT"));
  } catch (error) {
    if (db.isTransaction) (await db.exec("ROLLBACK"));
    throw error;
  }
  const invitationDelivery = queueInvitationDelivery({
    invitationId: created.id,
    token: created.token,
    email: created.email,
    role: created.role,
    actorUserId: me.id,
  });
  refreshApp();
  return { ...created, invitationDelivery };
}

/* ---------------- Inquiries ---------------- */

export async function setInquiryStatus(id: string, status: InquiryStatus): Promise<void> {
  await requireRole("admin");
  if (!["new", "reviewing", "contacted", "converted_to_program", "closed", "spam"].includes(status)) {
    throw new Error("Invalid inquiry status.");
  }
  const row = (await getDb().prepare("SELECT status FROM inquiries WHERE id = ?").get(id)) as
    | { status: InquiryStatus }
    | undefined;
  if (!row) throw new Error("Inquiry not found.");
  if (row.status === status) return;
  const result = await updateInquiryStatus(id, row.status, status);
  if (!result.ok) throw new Error(result.error ?? "The inquiry status could not be changed.");
  refreshApp();
}

export interface NewInquiryInput {
  requestKey?: string;
  source?: PublicInquirySource;
  name: string;
  email: string;
  type: string;
  orgName?: string;
  summary: string;
}

/**
 * @deprecated General public forms call submitPublicInquiry directly. This
 * compatibility delegate intentionally requires a browser request key before
 * it can write, so an old caller can never recreate the former duplicate-prone
 * insert path.
 */
export async function createInquiry(input: NewInquiryInput): Promise<{ ok: boolean; error?: string }> {
  return (await submitPublicInquiry({
      requestKey: input.requestKey ?? "",
      source: input.source ?? "get_involved",
      name: input.name,
      email: input.email,
      type: input.type,
      orgName: input.orgName,
      summary: input.summary,
    }));
}

/* ---------------- Sessions / cohorts (instructor + admin) ---------------- */

export async function setAttendance(
  cohortId: string,
  userId: string,
  state: AttendanceState,
): Promise<void> {
  const me = await requireRole("instructor", "admin");
  if (!["present", "absent", "late", "excused", "none"].includes(state)) {
    throw new Error("Invalid attendance state.");
  }
  const db = getDb();
  (await withLegacyTransaction(db, async () => {
        const cohort = (await assertCohortOwnership(me, cohortId, db));
        (await requireStudentMembership(db, cohort, userId, { userStatuses: ["active"], enrollmentStates: ["active"] }));
        const written = (await db
              .prepare(
                "INSERT INTO attendance (cohort_id, user_id, state) VALUES (?, ?, ?) ON CONFLICT(cohort_id, user_id) DO UPDATE SET state = excluded.state",
              )
              .run(cohortId, userId, state));
        if (written.changes !== 1) throw new Error("Attendance changed before it could be saved.");
      }));
  refreshApp();
}

export async function advanceCohortLesson(cohortId: string, nextLessonId: string | null): Promise<void> {
  const me = await requireRole("instructor", "admin");
  if (typeof cohortId !== "string" || !cohortId.trim() || cohortId.length > 100) throw new Error("Choose a valid cohort.");
  if (typeof nextLessonId !== "string" || !nextLessonId.trim() || nextLessonId.length > 200) {
    throw new Error("Choose the next lesson.");
  }
  const db = getDb();
  (await withLegacyTransaction(db, async () => {
        const cohort = (await assertCohortOwnership(me, cohortId, db));
        if (cohort.status === "completed") throw new Error("Completed cohorts cannot advance lessons.");

        const curriculum = requireCohortCurriculum(cohort);
        const currentIndex = cohort.current_lesson_id
          ? curriculum.findIndex((lesson) => lesson.id === cohort.current_lesson_id)
          : -1;
        if (cohort.current_lesson_id && currentIndex === -1) {
          throw new Error("The cohort's current lesson does not belong to its curriculum track.");
        }
        const expected = curriculum[currentIndex + 1] ?? null;
        if (!expected || expected.id !== nextLessonId) {
          throw new Error("Cohorts can only advance to the next lesson in their curriculum track.");
        }

        const updated = (await db
              .prepare("UPDATE cohorts SET current_lesson_id = ? WHERE id = ? AND current_lesson_id IS ?")
              .run(nextLessonId, cohortId, cohort.current_lesson_id));
        if (updated.changes !== 1) throw new Error("The cohort changed before the next lesson could be opened.");
      }));
  refreshApp();
}

/* ---------------- Cohort & enrollment management (admin) ---------------- */

export interface NewCohortInput {
  name: string;
  orgId: string;
  track: string;
  /** Optional instructor assigned at creation (used by the /admin form). */
  instructorId?: string | null;
}

export async function createCohort(input: NewCohortInput): Promise<void> {
  const me = await requireRole("admin");
  const name = input.name.trim();
  if (!name) throw new Error("Enter a cohort name.");
  if (orderedTrackLessons(input.track).length === 0) throw new Error("Choose a valid curriculum track.");

  const id = `coh-${randomUUID().slice(0, 8)}`;
  const db = getDb();
  (await withLegacyTransaction(db, async () => {
        const now = Date.now();
        const organization = (await db.prepare("SELECT status FROM organizations WHERE id = ?").get(input.orgId)) as
          | { status: string }
          | undefined;
        if (!organization || organization.status !== "active") throw new Error("Choose an active organization.");
        const canonicalInstructorId = input.instructorId
          ? (await requireCanonicalTeachingIdentity(db, input.instructorId, true))
          : null;
        (await db.prepare(
                "INSERT INTO cohorts (id, name, org_id, track, instructor_id, current_lesson_id, status, format, schedule, start, end_date, cap, next_session) VALUES (?, ?, ?, ?, ?, NULL, 'draft', '—', '—', '—', '—', 20, '—')",
              ).run(id, name, input.orgId, input.track, input.instructorId ?? null));
        const cohort = (await requireLegacyCohort(db, id));
        const projection = (await createCanonicalCohortProjection(db, cohort, name, me.id, now));
        if (canonicalInstructorId) {
          (await mirrorLegacyInstructorAssignment(db, cohort, projection, canonicalInstructorId, me.id, now));
        }
      }));
  refreshApp();
  revalidatePath("/admin");
}

export type RoleToggle = "student" | "instructor";

export interface UpdateRoleResult {
  ok: boolean;
  error?: "self" | "admin" | "invalid" | "not-found";
}

/**
 * Historical compatibility boundary. Teaching identity is now owned by the
 * canonical hiring, training, eligibility, and deactivation lifecycle; a role
 * toggle may no longer create or erase it independently.
 */
export async function updateUserRole(userId: string, role: RoleToggle): Promise<UpdateRoleResult> {
  const me = await requireRole("admin");
  if (userId === me.id) return { ok: false, error: "self" };
  if (role !== "student" && role !== "instructor") return { ok: false, error: "invalid" };

  const db = getDb();
  const result = (await withLegacyTransaction(db, async (): Promise<UpdateRoleResult> => {
      const u = (await db
            .prepare(
              `SELECT u.role, u.status, o.status AS org_status
           FROM users u
           LEFT JOIN organizations o ON o.id = u.org_id
          WHERE u.id = ?`,
            )
            .get(userId)) as { role: string; status: string; org_status: string | null } | undefined;
      if (!u) return { ok: false, error: "not-found" };
      if (u.role === "admin") return { ok: false, error: "admin" };
      if (!LEGACY_USER_ROLES.has(u.role) || !["student", "instructor"].includes(u.role)) {
        return { ok: false, error: "invalid" };
      }
      if (u.status !== "active" || u.org_status !== "active") return { ok: false, error: "invalid" };
      if (u.role === role) return { ok: true };
      return { ok: false, error: "invalid" };
    }));
  if (!result.ok) return result;
  refreshApp();
  revalidatePath("/admin");
  return result;
}

export async function assignInstructor(cohortId: string, instructorId: string | null): Promise<void> {
  const me = await requireRole("admin");
  const db = getDb();
  (await withLegacyTransaction(db, async () => {
        const cohort = (await requireLegacyCohort(db, cohortId));
        const projection = (await requireCanonicalCohortProjection(db, cohort));
        let canonicalInstructorId: string | null = null;
        if (instructorId) {
          requireCohortCurriculum(cohort);
          canonicalInstructorId = (await requireCanonicalTeachingIdentity(db, instructorId, true));
        }
        (await mirrorLegacyInstructorAssignment(
                db,
                cohort,
                projection,
                canonicalInstructorId,
                me.id,
                Date.now(),
              ));
        const result = (await db.prepare("UPDATE cohorts SET instructor_id = ? WHERE id = ?").run(instructorId, cohortId));
        if (result.changes !== 1) throw new Error("The instructor assignment could not be saved.");
      }));
  refreshApp();
}

export async function assignStudent(cohortId: string, userId: string): Promise<void> {
  const me = await requireRole("admin");
  const db = getDb();
  (await withLegacyTransaction(db, async () => {
        const cohort = (await requireLegacyCohort(db, cohortId));
        if (cohort.status === "completed") throw new Error("Students cannot be assigned to a completed cohort.");
        requireCohortCurriculum(cohort);
        const student = (await requireLegacyUser(db, userId, { role: "student", statuses: ["active"] }));
        if (student.org_id !== cohort.org_id) {
          throw new Error("The student and cohort must belong to the same organization.");
        }
        const projection = (await requireCanonicalCohortProjection(db, cohort));
        const canonicalStudent = (await requireCanonicalStudentIdentity(db, userId));
        (await enrollCanonicalStudent(db, projection, canonicalStudent.id, me.id, Date.now()));
        (await db.prepare(
                `INSERT INTO enrollments (user_id, cohort_id, enroll, lesson_status, last, att_last)
       VALUES (?, ?, 'active', 'not-started', 'Just now', 'none')
       ON CONFLICT(user_id, cohort_id) DO UPDATE SET enroll = 'active'`,
              ).run(userId, cohortId));
      }));
  refreshApp();
}

export async function removeStudent(cohortId: string, userId: string): Promise<void> {
  const me = await requireRole("admin");
  const db = getDb();
  (await withLegacyTransaction(db, async () => {
        const cohort = (await requireLegacyCohort(db, cohortId));
        (await requireStudentMembership(db, cohort, userId, {
                userStatuses: ["active", "suspended"],
                enrollmentStates: ["active", "suspended"],
              }));
        const projection = (await requireCanonicalCohortProjection(db, cohort));
        const canonicalStudent = (await requireCanonicalStudentIdentity(db, userId));
        (await withdrawCanonicalStudent(
                db,
                projection,
                canonicalStudent.id,
                me.id,
                "Removed from the legacy Cohort by an administrator.",
                Date.now(),
              ));
        const result = (await db
              .prepare("UPDATE enrollments SET enroll = 'inactive' WHERE user_id = ? AND cohort_id = ? AND enroll IN ('active', 'suspended')")
              .run(userId, cohortId));
        if (result.changes !== 1) throw new Error("The student could not be removed from this cohort.");
      }));
  refreshApp();
}

export async function transferStudent(userId: string, fromCohortId: string, toCohortId: string): Promise<void> {
  const me = await requireRole("admin");
  if (fromCohortId === toCohortId) return;
  const db = getDb();
  (await withLegacyTransaction(db, async () => {
        const fromCohort = (await requireLegacyCohort(db, fromCohortId));
        const toCohort = (await requireLegacyCohort(db, toCohortId));
        if (toCohort.status === "completed") throw new Error("Students cannot be transferred to a completed cohort.");
        requireCohortCurriculum(toCohort);
        const { user } = (await requireStudentMembership(db, fromCohort, userId, {
              userStatuses: ["active"],
              enrollmentStates: ["active"],
            }));
        if (user.org_id !== toCohort.org_id) {
          throw new Error("A transfer target must belong to the student's organization.");
        }

        const fromProjection = (await requireCanonicalCohortProjection(db, fromCohort));
        const toProjection = (await requireCanonicalCohortProjection(db, toCohort));
        const canonicalStudent = (await requireCanonicalStudentIdentity(db, userId));
        const now = Date.now();
        (await withdrawCanonicalStudent(
                db,
                fromProjection,
                canonicalStudent.id,
                me.id,
                `Transferred to legacy Cohort ${toCohortId}.`,
                now,
              ));
        (await enrollCanonicalStudent(db, toProjection, canonicalStudent.id, me.id, now));

        const removed = (await db
              .prepare("UPDATE enrollments SET enroll = 'inactive' WHERE user_id = ? AND cohort_id = ? AND enroll = 'active'")
              .run(userId, fromCohortId));
        if (removed.changes !== 1) throw new Error("The source enrollment changed before the transfer completed.");
        (await db.prepare(
                `INSERT INTO enrollments (user_id, cohort_id, enroll, lesson_status, last, att_last)
       VALUES (?, ?, 'active', 'not-started', 'Just now', 'none')
       ON CONFLICT(user_id, cohort_id) DO UPDATE SET enroll = 'active'`,
              ).run(userId, toCohortId));
      }));
  refreshApp();
}

/* ---------------- Organizations (admin) ---------------- */

export interface NewOrganizationInput {
  name: string;
  type: "School" | "Camp" | "Youth Organization";
  location: string;
}

export async function createOrganization(input: NewOrganizationInput): Promise<void> {
  const me = await requireRole("admin");
  const name = String(input.name ?? "").trim();
  const location = String(input.location ?? "").trim();
  const allowedTypes = new Set<NewOrganizationInput["type"]>(["School", "Camp", "Youth Organization"]);
  if (name.length < 2 || name.length > 160) throw new Error("Organization name must be between 2 and 160 characters.");
  if (!allowedTypes.has(input.type)) throw new Error("Choose a valid organization type.");
  if (location.length > 200) throw new Error("Organization location must be 200 characters or fewer.");
  const id = `org-${randomUUID().slice(0, 8)}`;
  const db = getDb();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    if ((await db.prepare("SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim(?))").get(name))) {
      throw new Error("An organization with that name already exists. Open its Partner record instead of creating a duplicate.");
    }
    // A newly entered partner is a prospect until staff explicitly accepts
    // the relationship. This keeps account, invitation, and delivery access
    // behind the same lifecycle decision used by public demand intake.
    (await db.prepare("INSERT INTO organizations (id, name, type, location, status) VALUES (?, ?, ?, ?, 'prospect')")
            .run(id, name, input.type, location || "—"));
    (await logActivity(
            "organization",
            id,
            "created",
            "Partner organization created as a prospect; activation is required before access or delivery begins.",
            me.id,
          ));
    (await db.exec("COMMIT"));
  } catch (error) {
    if (db.isTransaction) (await db.exec("ROLLBACK"));
    throw error;
  }
  refreshApp();
}

/* ---------------- Session notes (instructor + admin) ---------------- */

export async function addSessionNote(cohortId: string, scope: string, text: string): Promise<void> {
  const me = await requireRole("instructor", "admin");
  if (typeof cohortId !== "string" || !cohortId.trim() || cohortId.length > 100) throw new Error("Choose a valid cohort.");
  const cleanScope = typeof scope === "string" ? scope.trim().slice(0, 200) : "";
  const body = typeof text === "string" ? text.trim() : "";
  if (!body) return;
  if (!cleanScope) throw new Error("Choose a note scope.");
  if (body.length > 4000) throw new Error("Session notes must be 4,000 characters or fewer.");
  const id = `note-${randomUUID().slice(0, 8)}`;
  const db = getDb();
  const now = Date.now();
  (await withLegacyTransaction(db, async () => {
        (await assertCohortOwnership(me, cohortId, db));
        (await db.prepare(
                "INSERT INTO session_notes (id, cohort_id, author_id, scope, text, created_at, created_ts) VALUES (?, ?, ?, ?, ?, ?, ?)",
              ).run(id, cohortId, me.id, cleanScope, body, fmtDate(new Date(now)), now));
      }));
  refreshApp();
}

/* ---------------- Lesson progress (student) ---------------- */

/* eslint-disable @typescript-eslint/no-explicit-any */

interface StudentFrontier {
  enr: any;
  cohort: any;
  ordered: ReturnType<typeof orderedTrackLessons>;
  /** Furthest accessible lesson index: max of the cohort's lesson and the student's own unlock. */
  frontierIdx: number;
}

/**
 * The student's effective lesson frontier. A lesson is accessible when its
 * index is at or below the GREATER of two frontiers: the cohort's current
 * lesson (instructor manual unlock) and the student's own self-paced unlock.
 * Auto-unlock is the default path; instructor advancement still works as a floor.
 */
async function studentFrontier(uid: string, lessonId?: string): Promise<StudentFrontier | null> {
  const db = getDb();
  const rows = (await db
      .prepare(
        `SELECT e.user_id, e.cohort_id, e.unlocked_lesson_id,
              c.track, c.current_lesson_id, c.org_id AS cohort_org_id, c.status AS cohort_status,
              u.role AS user_role, u.status AS user_status, u.org_id AS user_org_id,
              o.status AS org_status
         FROM enrollments e
         JOIN cohorts c ON c.id = e.cohort_id
         JOIN users u ON u.id = e.user_id
         LEFT JOIN organizations o ON o.id = c.org_id
        WHERE e.user_id = ? AND e.enroll = 'active'
        ORDER BY e.cohort_id ASC`,
      )
      .all(uid)) as any[];

  const candidates: StudentFrontier[] = [];
  for (const row of rows) {
    if (
      row.user_role !== "student" ||
      row.user_status !== "active" ||
      row.user_org_id !== row.cohort_org_id ||
      row.org_status !== "active" ||
      !["active", "enrolling", "completed"].includes(row.cohort_status)
    ) {
      continue;
    }
    const ordered = orderedTrackLessons(row.track);
    if (ordered.length === 0 || (lessonId && !ordered.some((lesson) => lesson.id === lessonId))) continue;
    const cohortIdx = ordered.findIndex((lesson) => lesson.id === row.current_lesson_id);
    const selfIdx = ordered.findIndex((lesson) => lesson.id === row.unlocked_lesson_id);
    candidates.push({
      enr: {
        user_id: row.user_id,
        cohort_id: row.cohort_id,
        unlocked_lesson_id: row.unlocked_lesson_id,
      },
      cohort: {
        id: row.cohort_id,
        track: row.track,
        current_lesson_id: row.current_lesson_id,
        status: row.cohort_status,
      },
      ordered,
      frontierIdx: Math.max(cohortIdx, selfIdx),
    });
  }

  // If a student legitimately participates in more than one cohort using the
  // same track, use the cohort that grants the furthest valid frontier. The
  // cohort-id tie break keeps the selected enrollment deterministic.
  candidates.sort((a, b) => b.frontierIdx - a.frontierIdx || String(a.cohort.id).localeCompare(String(b.cohort.id)));
  return candidates[0] ?? null;
}

async function assertAccessible(uid: string, lessonId: string): Promise<void> {
  if (typeof lessonId !== "string" || !lessonId.trim() || lessonId.length > 200) {
    throw new Error("Choose a valid lesson.");
  }
  const f = (await studentFrontier(uid, lessonId));
  if (!f) throw new Error("This lesson is not available to your active enrollment.");
  const lessonIdx = f.ordered.findIndex((l) => l.id === lessonId);
  if (lessonIdx === -1 || f.frontierIdx === -1 || lessonIdx > f.frontierIdx) {
    throw new Error("Finish the earlier lessons before opening this one.");
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function touchProgress(uid: string, lessonId: string) {
  // Ensure a row exists and is at least in-progress.
  const db = getDb();
  const written = (await db.prepare(
      "INSERT INTO lesson_progress (user_id, lesson_id, status, started_at) VALUES (?, ?, 'in-progress', ?) ON CONFLICT(user_id, lesson_id) DO UPDATE SET status = CASE WHEN lesson_progress.status = 'not-started' THEN 'in-progress' ELSE lesson_progress.status END, started_at = COALESCE(lesson_progress.started_at, excluded.started_at)",
    ).run(uid, lessonId, fmtDateTime(new Date())));
  if (written.changes !== 1) throw new Error("Lesson progress changed before it could be saved.");
  (await touchActive(uid));
}

/** Record a real "last active" timestamp for the instructor monitoring view. */
async function touchActive(uid: string) {
  (await getDb().prepare("UPDATE users SET last_active_at = ? WHERE id = ?").run(Date.now(), uid));
}

async function progressDetail(uid: string, lessonId: string): Promise<LessonProgressDetail | null> {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const p = (await getDb().prepare("SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?").get(uid, lessonId)) as any;
  if (!p) return null;
  return {
    status: p.status,
    simulationDone: !!p.simulation_done,
    reflection: p.reflection ?? "",
    challengeDone: !!p.challenge_done,
    podcastProgress: typeof p.podcast_progress === "number" ? p.podcast_progress : 0,
    startedAt: p.started_at ?? null,
    completedAt: p.completed_at ?? null,
  };
}

export async function startLesson(lessonId: string): Promise<void> {
  const me = await requireRole("student");
  const db = getDb();
  (await withLegacyTransaction(db, async () => {
        assertAccessible(me.id, lessonId);
        if ((await progressDetail(me.id, lessonId))?.status === "completed") {
          throw new Error("This lesson is already complete.");
        }
        (await touchProgress(me.id, lessonId));
      }));
  refreshApp();
}

export async function setSimulationDone(lessonId: string, done: boolean): Promise<void> {
  const me = await requireRole("student");
  if (typeof done !== "boolean") throw new Error("Choose a valid simulation status.");
  const db = getDb();
  (await withLegacyTransaction(db, async () => {
        assertAccessible(me.id, lessonId);
        if (!done && (await progressDetail(me.id, lessonId))?.status === "completed") {
          throw new Error("A completed lesson cannot have its simulation reopened.");
        }
        (await touchProgress(me.id, lessonId));
        const updated = (await db
              .prepare("UPDATE lesson_progress SET simulation_done = ? WHERE user_id = ? AND lesson_id = ?")
              .run(done ? 1 : 0, me.id, lessonId));
        if (updated.changes !== 1) throw new Error("Simulation progress changed before it could be saved.");
      }));
  refreshApp();
}

export async function saveReflection(lessonId: string, text: string): Promise<void> {
  const me = await requireRole("student");
  if (typeof text !== "string" || text.length > 20_000) throw new Error("Keep the reflection under 20,000 characters.");
  const reflection = text.trim();
  const db = getDb();
  (await withLegacyTransaction(db, async () => {
        assertAccessible(me.id, lessonId);
        if (!reflection && (await progressDetail(me.id, lessonId))?.status === "completed") {
          throw new Error("A completed lesson must keep its reflection evidence.");
        }
        (await touchProgress(me.id, lessonId));
        const updated = (await db
              .prepare("UPDATE lesson_progress SET reflection = ? WHERE user_id = ? AND lesson_id = ?")
              .run(reflection, me.id, lessonId));
        if (updated.changes !== 1) throw new Error("The reflection changed before it could be saved.");
      }));
  refreshApp();
}

export async function setChallengeDone(lessonId: string, done: boolean): Promise<void> {
  const me = await requireRole("student");
  if (typeof done !== "boolean") throw new Error("Choose a valid challenge status.");
  const db = getDb();
  (await withLegacyTransaction(db, async () => {
        assertAccessible(me.id, lessonId);
        if (!done && (await progressDetail(me.id, lessonId))?.status === "completed") {
          throw new Error("A completed lesson cannot have its challenge reopened.");
        }
        (await touchProgress(me.id, lessonId));
        const updated = (await db
              .prepare("UPDATE lesson_progress SET challenge_done = ? WHERE user_id = ? AND lesson_id = ?")
              .run(done ? 1 : 0, me.id, lessonId));
        if (updated.changes !== 1) throw new Error("Challenge progress changed before it could be saved.");
      }));
  refreshApp();
}

export async function completeLesson(lessonId: string): Promise<void> {
  const me = await requireRole("student");
  const db = getDb();
  (await withLegacyTransaction(db, async () => {
        assertAccessible(me.id, lessonId);
        const detail = (await progressDetail(me.id, lessonId));
        if (!detail?.simulationDone || !detail.reflection.trim() || !detail.challengeDone) {
          throw new Error("Finish the case, reflection, and real-world challenge before completing this lesson.");
        }
        (await touchActive(me.id));
        const now = fmtDateTime(new Date());
        const updated = (await db
              .prepare(
                "UPDATE lesson_progress SET status = 'completed', started_at = COALESCE(started_at, ?), completed_at = COALESCE(completed_at, ?) WHERE user_id = ? AND lesson_id = ?",
              )
              .run(now, now, me.id, lessonId));
        if (updated.changes !== 1) throw new Error("Lesson progress changed before completion could be recorded.");
      }));
  refreshApp();
}

/* ---------------- Self-paced unlock (Proposal 1) ---------------- */

/**
 * Record how far the student has played the lesson's podcast episode, as a
 * fraction between 0 and 1. Called client-side as the player progresses.
 */
export async function setPodcastProgress(lessonId: string, progress: number): Promise<void> {
  const me = await requireRole("student");
  if (typeof progress !== "number" || !Number.isFinite(progress)) throw new Error("Choose valid podcast progress.");
  const clamped = Math.max(0, Math.min(1, progress));
  const db = getDb();
  (await withLegacyTransaction(db, async () => {
        assertAccessible(me.id, lessonId);
        (await touchProgress(me.id, lessonId));
        // Never let a stored value go backwards (e.g. a scrub to the start).
        const updated = (await db
              .prepare("UPDATE lesson_progress SET podcast_progress = MAX(podcast_progress, ?) WHERE user_id = ? AND lesson_id = ?")
              .run(clamped, me.id, lessonId));
        if (updated.changes !== 1) throw new Error("Podcast progress changed before it could be saved.");
      }));
  refreshApp();
}

export interface UnlockResult {
  /** True only when this call advanced the student's frontier to a new lesson. */
  unlocked: boolean;
  /** The next lesson id, if any. */
  nextLessonId: string | null;
  /** Whether all three self-paced conditions are currently met for this lesson. */
  conditionsMet: boolean;
}

/**
 * The default self-paced path: when a student has marked the simulation
 * complete, written a reflection of at least 75 words, AND played the podcast
 * past {@link PODCAST_UNLOCK_THRESHOLD}, the current lesson is marked complete
 * and the next lesson unlocks for them automatically — no instructor needed.
 *
 * Called client-side after the podcast crosses 0.8 and after reflection submit.
 */
export async function checkAndUnlockNextLesson(lessonId: string): Promise<UnlockResult> {
  const me = await requireRole("student");
  (await touchActive(me.id));
  const f = (await studentFrontier(me.id, lessonId));
  if (!f) return { unlocked: false, nextLessonId: null, conditionsMet: false };

  const lessonIdx = f.ordered.findIndex((l) => l.id === lessonId);
  if (lessonIdx === -1 || f.frontierIdx === -1 || lessonIdx > f.frontierIdx) {
    return { unlocked: false, nextLessonId: null, conditionsMet: false };
  }

  const detail = (await progressDetail(me.id, lessonId));
  const check = unlockChecklist(detail);
  if (!check.allMet) return { unlocked: false, nextLessonId: null, conditionsMet: false };

  const db = getDb();
  const next = f.ordered[lessonIdx + 1] ?? null;
  const nextIdx = lessonIdx + 1;
  const newlyUnlocked = !!next && nextIdx > f.frontierIdx;

  (await withLegacyTransaction(db, async () => {
        // The three core conditions are satisfied — lock in completion.
        const now = fmtDateTime(new Date());
        (await db.prepare(
                "INSERT INTO lesson_progress (user_id, lesson_id, status, started_at, completed_at) VALUES (?, ?, 'completed', ?, ?) ON CONFLICT(user_id, lesson_id) DO UPDATE SET status = 'completed', started_at = COALESCE(lesson_progress.started_at, excluded.started_at), completed_at = COALESCE(lesson_progress.completed_at, excluded.completed_at)",
              ).run(me.id, lessonId, now, now));

        if (next) {
          const selfIdx = f.ordered.findIndex((l) => l.id === f.enr.unlocked_lesson_id);
          if (nextIdx > selfIdx) {
            const updated = (await db
                      .prepare(
                        "UPDATE enrollments SET unlocked_lesson_id = ? WHERE user_id = ? AND cohort_id = ? AND enroll = 'active'",
                      )
                      .run(next.id, me.id, f.cohort.id));
            if (updated.changes !== 1) throw new Error("The active enrollment changed before the lesson unlocked.");
          }
        }
      }));

  refreshApp();
  return { unlocked: newlyUnlocked, nextLessonId: next ? next.id : null, conditionsMet: true };
}

/* ---------------- Account deletion requests ---------------- */

export async function requestAccountDeletion(): Promise<void> {
  const me = await requireRole("student", "instructor", "admin", "growth");
  (await getDb().prepare("UPDATE users SET deletion_requested = 1 WHERE id = ?").run(me.id));
  refreshApp();
}

export async function dismissDeletionRequest(userId: string): Promise<void> {
  await requireRole("admin");
  (await getDb().prepare("UPDATE users SET deletion_requested = 0 WHERE id = ?").run(userId));
  refreshApp();
}

/**
 * Irreversibly fulfill an account-deletion request without deleting the
 * relational rows that hold delivery, attendance, learning, or audit history.
 * The stable IDs remain so those records do not become orphans; direct account
 * identity, credentials, contact details, and current access are removed.
 */
export async function fulfillDeletionRequest(userId: string): Promise<void> {
  const me = await requireRole("admin");
  const targetId = String(userId ?? "").trim();
  if (!targetId || targetId.length > 200) throw new Error("Choose a valid account-deletion request.");
  if (targetId === me.id) throw new Error("You cannot fulfill deletion for your own account.");

  const db = getDb();
  const now = Date.now();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    // Re-check the actor after taking the write lock. The page-level role gate
    // and requireRole() are not sufficient authorization for a Server Action.
    const actor = (await db
          .prepare("SELECT 1 FROM users WHERE id = ? AND role = 'admin' AND status = 'active'")
          .get(me.id));
    if (!actor) throw new Error("Administrator access changed before the request could be fulfilled.");

    const target = (await db
          .prepare("SELECT id, email, deletion_requested FROM users WHERE id = ?")
          .get(targetId)) as { id: string; email: string; deletion_requested: number } | undefined;
    if (!target || target.deletion_requested !== 1) {
      throw new Error("This account does not have an active deletion request.");
    }
    if (target.id === me.id) throw new Error("You cannot fulfill deletion for your own account.");

    // A v2 database should already make these links agree. Fail closed instead
    // of anonymizing a Person that belongs to a different user if legacy data
    // somehow violates that identity boundary.
    const conflictingStudentPerson = (await db.prepare(
          `SELECT s.id
         FROM students s
         JOIN people p ON p.id = s.person_id
        WHERE s.user_id = ? AND p.user_id IS NOT NULL AND p.user_id <> ?
        LIMIT 1`,
        ).get(targetId, targetId));
    if (conflictingStudentPerson) {
      throw new Error("The account's canonical identity links need administrator review before deletion can be fulfilled.");
    }

    const invitationRows = (await db
          .prepare("SELECT id, email, status FROM invitations WHERE lower(trim(email)) = lower(trim(?)) ORDER BY id")
          .all(target.email)) as { id: string; email: string; status: string }[];
    let revokedPendingInvitations = 0;
    for (const invitation of invitationRows) {
      const nextStatus = invitation.status === "pending" ? "revoked" : invitation.status;
      const rotatedCredential = randomBytes(32).toString("base64url");
      const updated = (await db.prepare(
              `UPDATE invitations
            SET email = ?, status = ?, token = ?, token_hash = ?
          WHERE id = ? AND email = ? AND status = ?`,
            ).run(
              `deleted+${randomUUID()}@deleted.invalid`,
              nextStatus,
              `retired:${randomUUID()}`,
              hashOpaqueToken(rotatedCredential),
              invitation.id,
              invitation.email,
              invitation.status,
            ));
      if (updated.changes !== 1) throw new Error("An invitation changed before deletion could be fulfilled.");
      if (invitation.status === "pending") revokedPendingInvitations += 1;
    }

    const consentRows = (await db
          .prepare("SELECT id, revoked_at FROM profile_sharing_consents WHERE student_user_id = ? ORDER BY id")
          .all(targetId)) as { id: string; revoked_at: number | null }[];
    let revokedActiveConsents = 0;
    for (const consent of consentRows) {
      const updated = (await db.prepare(
              `UPDATE profile_sharing_consents
            SET public_slug = ?, guardian_name = 'Removed', guardian_email = ?,
                revoked_by_user_id = CASE WHEN revoked_at IS NULL THEN ? ELSE revoked_by_user_id END,
                revoked_at = COALESCE(revoked_at, ?), discoverable = 0, notes = NULL
          WHERE id = ? AND student_user_id = ?`,
            ).run(
              randomBytes(32).toString("base64url"),
              `deleted+${randomUUID()}@deleted.invalid`,
              me.id,
              now,
              consent.id,
              targetId,
            ));
      if (updated.changes !== 1) throw new Error("A profile-sharing consent changed before deletion could be fulfilled.");
      if (consent.revoked_at == null) revokedActiveConsents += 1;
    }

    const personRows = (await db.prepare(
          `SELECT DISTINCT p.id
         FROM people p
        WHERE p.user_id = ?
           OR p.id IN (
             SELECT s.person_id FROM students s
              WHERE s.user_id = ? AND s.person_id IS NOT NULL
           )
        ORDER BY p.id`,
        ).all(targetId, targetId)) as { id: string }[];
    for (const person of personRows) {
      const updated = (await db.prepare(
              `UPDATE people
            SET name = 'Deleted account', email = ?, phone = '', updated_at = ?
          WHERE id = ? AND (user_id IS NULL OR user_id = ?)`,
            ).run(`deleted+${randomUUID()}@deleted.invalid`, now, person.id, targetId));
      if (updated.changes !== 1) throw new Error("A canonical Person changed before deletion could be fulfilled.");
    }

    const studentRows = (await db
          .prepare("SELECT id FROM students WHERE user_id = ? ORDER BY id")
          .all(targetId)) as { id: string }[];
    for (const student of studentRows) {
      const updated = (await db.prepare(
              `UPDATE students
            SET name = 'Deleted account', age = NULL, grade = NULL, email = NULL,
                guardian_person_id = NULL, emergency_notes = NULL,
                enrollment_status = 'inactive', form_status = 'missing',
                communication_notes = NULL, updated_at = ?
          WHERE id = ? AND user_id = ?`,
            ).run(now, student.id, targetId));
      if (updated.changes !== 1) throw new Error("A canonical Student changed before deletion could be fulfilled.");
    }

    const deactivatedLegacyEnrollments = (await db.prepare(
          `UPDATE enrollments
          SET enroll = 'inactive'
        WHERE user_id = ? AND enroll IN ('active', 'invited', 'suspended')`,
        ).run(targetId)).changes;
    const withdrawnClassEnrollments = (await db.prepare(
          `UPDATE class_enrollments
          SET status = 'withdrawn', withdrawn_at = ?,
              withdrawal_reason = 'Account deletion request fulfilled.'
        WHERE student_id IN (SELECT id FROM students WHERE user_id = ?)
          AND status IN ('enrolled', 'waitlisted')`,
        ).run(now, targetId)).changes;

    let deactivatedInstructors = 0;
    let removedAvailabilityRows = 0;
    let removedFutureTrainingRegistrations = 0;
    let coverageTasksOpened = 0;
    for (const person of personRows) {
      const instructorRows = (await db
              .prepare("SELECT id FROM instructors WHERE person_id = ? ORDER BY id")
              .all(person.id)) as { id: string }[];
      for (const instructor of instructorRows) {
        deactivatedInstructors += Number((await db.prepare(
                      `UPDATE instructors
              SET stage = CASE WHEN stage = 'rejected' THEN stage ELSE 'inactive' END,
                  answers = '{}', interview_notes = NULL, development_focus = NULL,
                  updated_at = ?
            WHERE id = ? AND person_id = ?`,
                    ).run(now, instructor.id, person.id)).changes);
        removedAvailabilityRows += Number((await db
                      .prepare("DELETE FROM instructor_availability WHERE instructor_id = ?")
                      .run(instructor.id)).changes);
        removedFutureTrainingRegistrations += Number((await db.prepare(
                      `DELETE FROM training_session_registrations
            WHERE instructor_id = ?
              AND EXISTS (
                SELECT 1 FROM training_sessions ts
                 WHERE ts.id = training_session_registrations.session_id
                   AND ts.scheduled_at >= ?
              )`,
                    ).run(instructor.id, now)).changes);

        const affectedClasses = (await db.prepare(
                  `SELECT COUNT(*) AS n
             FROM class_instructors ci
             JOIN classes c ON c.id = ci.class_id
            WHERE ci.instructor_id = ? AND ci.removed_at IS NULL
              AND c.status NOT IN ('completed', 'cancelled')`,
                ).get(instructor.id)) as { n: number };
        if (affectedClasses.n > 0) {
          coverageTasksOpened += Number((await db.prepare(
                          `INSERT INTO tasks
              (id, title, owner_user_id, due_at, status, kind, priority, context,
               recommended_action, entity_type, entity_id, handoff_to_founder,
               created_at, updated_at)
             SELECT ?, ?, ?, ?, 'open', 'issue', 'urgent', ?, ?, 'instructor', ?, 0, ?, ?
              WHERE NOT EXISTS (
                SELECT 1 FROM tasks
                 WHERE entity_type = 'instructor' AND entity_id = ? AND status = 'open'
                   AND kind = 'issue'
                   AND recommended_action = 'Assign replacement coverage and confirm every affected Program remains ready.'
              )`,
                        ).run(
                          `wrk-${randomUUID().slice(0, 10)}`,
                          `Replace inactive instructor across ${affectedClasses.n} Class${affectedClasses.n === 1 ? "" : "es"}`,
                          me.id,
                          now,
                          "The linked account deletion was fulfilled and teaching access was revoked.",
                          "Assign replacement coverage and confirm every affected Program remains ready.",
                          instructor.id,
                          now,
                          now,
                          instructor.id,
                        )).changes);
        }
      }
    }

    // Keep the stable ownership/contact references for audit continuity, but
    // make the required human reassignment explicit instead of leaving a
    // Program silently owned by an anonymized account or contact.
    const affectedPrograms = (await db.prepare(
          `SELECT id, name,
              CASE WHEN owner_user_id = ? THEN 1 ELSE 0 END AS needs_owner,
              CASE WHEN primary_contact_person_id IN (
                SELECT p.id
                  FROM people p
                 WHERE p.user_id = ?
                    OR p.id IN (
                      SELECT s.person_id FROM students s
                       WHERE s.user_id = ? AND s.person_id IS NOT NULL
                    )
              ) THEN 1 ELSE 0 END AS needs_contact
         FROM programs
        WHERE stage NOT IN ('completed', 'renewal_review', 'renewed', 'closed')
          AND (
            owner_user_id = ?
            OR primary_contact_person_id IN (
              SELECT p.id
                FROM people p
               WHERE p.user_id = ?
                  OR p.id IN (
                    SELECT s.person_id FROM students s
                     WHERE s.user_id = ? AND s.person_id IS NOT NULL
                  )
            )
          )
        ORDER BY id`,
        ).all(targetId, targetId, targetId, targetId, targetId, targetId)) as {
      id: string;
      name: string;
      needs_owner: number;
      needs_contact: number;
    }[];
    let reassignmentTasksOpened = 0;
    for (const program of affectedPrograms) {
      const missingRoles = [
        program.needs_owner ? "BOW owner" : null,
        program.needs_contact ? "partner contact" : null,
      ].filter((value): value is string => value != null);
      const recommendedAction = "Assign active accountable people and reconfirm Program readiness after the account deletion.";
      reassignmentTasksOpened += Number((await db.prepare(
                  `INSERT INTO tasks
          (id, title, owner_user_id, due_at, status, kind, priority, context,
           recommended_action, entity_type, entity_id, handoff_to_founder,
           created_at, updated_at)
         SELECT ?, ?, ?, ?, 'open', 'issue', 'urgent', ?, ?, 'program', ?, 0, ?, ?
          WHERE NOT EXISTS (
            SELECT 1 FROM tasks
             WHERE entity_type = 'program' AND entity_id = ? AND status = 'open'
               AND kind = 'issue' AND recommended_action = ?
          )`,
                ).run(
                  `wrk-${randomUUID().slice(0, 10)}`,
                  `Reassign ${missingRoles.join(" and ")} for ${program.name}`,
                  me.id,
                  now,
                  `Account deletion removed an accountable ${missingRoles.join(" and ")} from this Program.`,
                  recommendedAction,
                  program.id,
                  now,
                  now,
                  program.id,
                  recommendedAction,
                )).changes);
    }

    // Remove ephemeral, private account state while keeping attendance,
    // completed learning, delivery reports, certificates, and authored records.
    const revokedSessions = (await db.prepare("DELETE FROM sessions WHERE user_id = ?").run(targetId)).changes;
    const removedResetCredentials = (await db
          .prepare("DELETE FROM password_reset_tokens WHERE user_id = ?")
          .run(targetId)).changes;
    const removedNotifications = (await db.prepare("DELETE FROM notifications WHERE user_id = ?").run(targetId)).changes;
    const anonymizedArticleBylines = (await db.prepare(
          "UPDATE articles SET author = 'Deleted account', updated_at = ? WHERE author_user_id = ? AND author <> 'Deleted account'",
        ).run(now, targetId)).changes;
    const anonymizedNoteScopes = (await db.prepare(
          "UPDATE session_notes SET scope = 'Student · Deleted account' WHERE student_id = ? AND scope <> 'Student · Deleted account'",
        ).run(targetId)).changes;
    const anonymizedFeedbackBylines = (await db.prepare(
          "UPDATE instructor_feedback SET author_name = 'Deleted account' WHERE submitted_by_user_id = ? AND author_name IS NOT NULL",
        ).run(targetId)).changes;

    // Universal Work must never remain assigned to an account whose access is
    // being removed. Preserve completed ownership history, but hand every open
    // item to the fulfilling administrator with an explicit audit event.
    const ownedOpenWork = (await db.prepare(
          "SELECT id, updated_at FROM tasks WHERE owner_user_id = ? AND status = 'open' ORDER BY id",
        ).all(targetId)) as { id: string; updated_at: number }[];
    for (const task of ownedOpenWork) {
      const reassigned = (await db.prepare(
              `UPDATE tasks SET owner_user_id = ?, updated_at = ?
          WHERE id = ? AND owner_user_id = ? AND status = 'open' AND updated_at = ?`,
            ).run(me.id, now, task.id, targetId, task.updated_at));
      if (reassigned.changes !== 1) throw new Error("Owned Work changed before deletion could be fulfilled.");
      (await logActivity(
                "task",
                task.id,
                "owner_changed",
                "Open Work reassigned to the fulfilling administrator because its prior owner's account was deleted.",
                me.id,
              ));
    }

    const anonymousEmail = `deleted+${randomUUID()}@deleted.invalid`;
    const accountUpdate = (await db.prepare(
          `UPDATE users
          SET name = 'Deleted account', first = 'Deleted', email = ?, grade = NULL,
              status = 'suspended', last = '—', signin = 'Unavailable',
              password_hash = NULL, deletion_requested = 0, last_active_at = NULL,
              onboarding_completed = 0, password_change_required = 0,
              last_active_date = NULL
        WHERE id = ? AND email = ? AND deletion_requested = 1`,
        ).run(anonymousEmail, targetId, target.email));
    if (accountUpdate.changes !== 1) {
      throw new Error("The deletion request changed before it could be fulfilled.");
    }

    // operational_decisions is append-only under the v2 trigger. Its payload
    // deliberately contains only stable IDs, generic outcomes, and counts—no
    // copy of the removed name, email address, phone number, or notes.
    const auditId = `opd-${randomUUID()}`;
    const auditDecision = JSON.stringify({
      action: "fulfilled",
      identity: "anonymized",
      accountStatus: "suspended",
      credentials: "revoked",
    });
    const auditReason = "Fulfilled a verified account deletion request while preserving anonymized delivery and audit history.";
    const auditMetadata = JSON.stringify({
      targetUserId: targetId,
      anonymizedPeople: personRows.length,
      anonymizedStudents: studentRows.length,
      anonymizedInvitations: invitationRows.length,
      revokedPendingInvitations,
      anonymizedConsents: consentRows.length,
      revokedActiveConsents,
      deactivatedLegacyEnrollments,
      withdrawnClassEnrollments,
      deactivatedInstructors,
      removedAvailabilityRows,
      removedFutureTrainingRegistrations,
      coverageTasksOpened,
      affectedPrograms: affectedPrograms.length,
      reassignmentTasksOpened,
      revokedSessions,
      removedResetCredentials,
      removedNotifications,
      anonymizedArticleBylines,
      anonymizedNoteScopes,
      anonymizedFeedbackBylines,
      reassignedOpenWork: ownedOpenWork.length,
      preserved: [
        "stable relational IDs",
        "attendance and roster evidence",
        "completed learning and certificates",
        "session reports and operational decisions",
      ],
    });
    const auditFingerprint = hashOpaqueToken(JSON.stringify({
      auditId,
      entityType: "user",
      entityId: targetId,
      decisionType: "account_deletion_fulfillment",
      decision: auditDecision,
      reason: auditReason,
      decidedByUserId: me.id,
      decidedAt: now,
      metadata: auditMetadata,
    }));
    (await db.prepare(
            `INSERT INTO operational_decisions
        (id, entity_type, entity_id, decision_type, decision, reason, fingerprint,
         decided_by_user_id, decided_at, metadata)
       VALUES (?, 'user', ?, 'account_deletion_fulfillment', ?, ?, ?, ?, ?, ?)`,
          ).run(auditId, targetId, auditDecision, auditReason, auditFingerprint, me.id, now, auditMetadata));
    (await db.prepare(
            `INSERT INTO crm_activity
        (id, entity_type, entity_id, kind, body, actor_user_id, created_at)
       VALUES (?, 'user', ?, 'account_deletion_fulfilled', ?, ?, ?)`,
          ).run(
            `pfx-${randomUUID().slice(0, 8)}`,
            targetId,
            "Account deletion request fulfilled. Personal identity and live access were removed; anonymized delivery history was preserved.",
            me.id,
            now,
          ));

    (await db.exec("COMMIT"));
  } catch (error) {
    if (db.isTransaction) (await db.exec("ROLLBACK"));
    throw error;
  }

  refreshApp();
  revalidatePath("/profile", "layout");
  revalidatePath("/discussion", "layout");
  revalidatePath("/analytics", "layout");
}

/* ============================================================
 * Self-Paced Track 101 (Features 1 & 2).
 * ============================================================ */

function refreshDashboard() {
  revalidatePath("/dashboard");
}

function refreshInstructor() {
  revalidatePath("/instructor");
}

/* ---------------- Notification triggers (Feature 6) ---------------- */

/**
 * Fire `quiz_available` (for each completed module) and `module_unlocked` (for
 * each newly accessible module) notifications across both tracks. Every insert
 * uses a deterministic id, so this is safe to call after any progress change —
 * a given notification is created exactly once.
 */
async function notifyModuleProgress(userId: string) {
  for (const track of [TRACK_101, TRACK_201]) {
    const views = (await getSelfModuleViews(userId, track));
    for (const v of views) {
      const label = track === TRACK_201 ? `201-${v.module.ordinal}` : String(v.module.ordinal);
      if (v.completed) {
        (await createNotification({
                    id: `ntf-quiz-${userId}-${v.module.id}`,
                    userId,
                    type: "quiz_available",
                    title: "New quiz questions available.",
                    body: `Quiz questions for ${v.module.title} are ready.`,
                    link: "/dashboard",
                  }));
      }
      // The always-open first module of Track 101 isn't an "unlock" event.
      const alwaysOpen = track === TRACK_101 && v.module.ordinal === 1;
      if (v.unlocked && !alwaysOpen) {
        (await createNotification({
                    id: `ntf-unlock-${userId}-${v.module.id}`,
                    userId,
                    type: "module_unlocked",
                    title: `Module ${label} unlocked.`,
                    body: `You can now start ${v.module.title}.`,
                    link: "/dashboard",
                  }));
      }
    }
  }
}

/** Fire a `rank_up` notification if the student's rank tier increased. Idempotent. */
async function notifyRankChange(userId: string, beforeKey: string) {
  const after = (await rankForStudent(userId));
  if (after.key === beforeKey) return;
  const next = nextRankName(after.key);
  (await createNotification({
        id: `ntf-rank-${userId}-${after.key}`,
        userId,
        type: "rank_up",
        title: `You ranked up to ${after.name}!`,
        body: next ? `Keep going — ${next} is next.` : "You've reached the top rank. Incredible work.",
        link: "/profile",
      }));
}

/* ---------------- Module progression (student) ---------------- */

/**
 * Mark a self-paced module complete. Gated: a student can only complete a
 * module that is currently unlocked for them, so they can't skip ahead by
 * calling the action directly.
 */
export async function markSelfModuleComplete(moduleId: string): Promise<void> {
  const me = await requireRole("student");
  if (!(await isSelfModuleUnlocked(me.id, moduleId))) return;
  const track = (await trackForModule(moduleId));
  const rankBefore = (await rankForStudent(me.id)).key;
  const now = Date.now();
  (await getDb()
        .prepare(
          "INSERT INTO self_progress (student_id, module_id, completed, completed_at, updated_at, track) VALUES (?, ?, 1, ?, ?, ?) ON CONFLICT(student_id, module_id) DO UPDATE SET completed = 1, completed_at = COALESCE(self_progress.completed_at, excluded.completed_at), updated_at = excluded.updated_at, track = excluded.track",
        )
        .run(me.id, moduleId, now, now, track));
  (await touchActive(me.id));
  // Completing a module unlocks its quiz and (if the reflection is in) the next module.
  (await notifyModuleProgress(me.id));
  (await notifyRankChange(me.id, rankBefore));
  refreshDashboard();
}

/**
 * Save (or update) the student's written reflection for a module. The next
 * module unlocks automatically once this clears the 50-word minimum AND the
 * module is marked complete — the rule is computed in lib/self-paced.ts, so we
 * just persist the text and its word count here.
 */
export async function saveSelfReflection(moduleId: string, text: string): Promise<void> {
  const me = await requireRole("student");
  if (!(await isSelfModuleUnlocked(me.id, moduleId))) return;
  const clean = text.trim();
  const words = reflectionWordCount(clean);
  const track = (await trackForModule(moduleId));
  (await getDb()
        .prepare(
          "INSERT INTO self_progress (student_id, module_id, reflection, reflection_words, updated_at, track) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(student_id, module_id) DO UPDATE SET reflection = excluded.reflection, reflection_words = excluded.reflection_words, updated_at = excluded.updated_at, track = excluded.track",
        )
        .run(me.id, moduleId, clean, words, Date.now(), track));
  (await touchActive(me.id));
  // A passing reflection on a completed module unlocks the next one.
  (await notifyModuleProgress(me.id));
  refreshDashboard();
}

/* ---------------- Certificate (Feature 2) ---------------- */

export interface CertificateResult {
  ok: boolean;
  /** A self-contained HTML certificate, present only when issued. */
  html?: string;
  /** Suggested download filename, e.g. BOW-Certificate-Jordan-Avery.html. */
  filename?: string;
  /** Stable credential id (idempotent — same on every call once issued). */
  certId?: string;
}

/**
 * Generate (or re-fetch) the student's certificate for a track (defaults to
 * Track 101). Verifies all of that track's modules are complete on the server
 * before issuing, records an idempotent certificate row, and returns a
 * downloadable self-contained HTML file. The completion date is locked to when
 * the certificate was first issued. Earning the Track 101 certificate is also
 * what unlocks Track 201.
 */
export async function generateCertificate(track: string = CERT_TRACK): Promise<CertificateResult> {
  const me = await requireRole("student");
  const certTrack = track === CERT_TRACK_201 ? CERT_TRACK_201 : CERT_TRACK;
  if (!(await hasCompletedAllModules(me.id, certTrack))) return { ok: false };

  const rankBefore = (await rankForStudent(me.id)).key;
  const cert = (await issueCertificate(me.id, certTrack));
  const dateLabel = new Date(cert.issuedAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const html = buildCertificateHtml({ name: me.name, dateLabel, certId: cert.id, trackTitle: certTrackTitle(certTrack) });
  (await touchActive(me.id));
  (await createNotification({
        id: `ntf-cert-${me.id}-${certTrack}`,
        userId: me.id,
        type: "certificate_earned",
        title: "Certificate earned!",
        body: `You completed Track ${certTrack}. Download your certificate.`,
        link: "/dashboard",
      }));
  // Earning the Track 101 certificate unlocks Track 201 — surface the unlock + any rank-up.
  (await notifyModuleProgress(me.id));
  (await notifyRankChange(me.id, rankBefore));
  return { ok: true, html, filename: certificateFilename(me.name, certTrack), certId: cert.id };
}

/* ---------------- BOW Daily decision (student) ---------------- */

export interface DailyDecisionResult {
  ok: boolean;
  /** What actually happened, revealed after the student commits a decision. */
  outcome?: string;
  /** Why that was the economically sound call. */
  explanation?: string;
  /** The BOW concept the scenario illustrates. */
  concept?: string;
}

/**
 * Save a student's BOW Daily decision (one per scenario) and reveal what
 * actually happened plus the economics behind it. Low-friction by design — a
 * daily briefing, not graded homework.
 */
export async function submitDailyDecision(storyId: string, response: string): Promise<DailyDecisionResult> {
  const me = await requireRole("student");
  const text = response.trim();
  if (!text) return { ok: false };

  const db = getDb();
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const story = (await db.prepare("SELECT * FROM feed_stories WHERE id = ?").get(storyId)) as any;
  if (!story) return { ok: false };

  (await db.prepare(
        "INSERT OR IGNORE INTO self_feed_responses (id, student_id, story_id, response, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run(`sfr-${randomUUID().slice(0, 12)}`, me.id, storyId, text, Date.now()));
  (await touchActive(me.id));
  refreshDashboard();
  return { ok: true, outcome: story.outcome, explanation: story.explanation, concept: story.concept };
}

/* ---------------- BOW Daily scenario (Feature 2) ---------------- */

export interface ScenarioResult {
  ok: boolean;
  /** Revealed only after a response is submitted. */
  explanation?: string;
  concept?: string;
}

/**
 * Save a student's response to a BOW Daily scenario (one per scenario) and
 * reveal the plain-English explanation. Low-friction by design — the response
 * is open-ended and is never graded.
 */
export async function submitDailyScenario(scenarioId: string, response: string): Promise<ScenarioResult> {
  const me = await requireRole("student");
  const text = response.trim();
  if (!text) return { ok: false };

  const db = getDb();
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const scenario = (await db.prepare("SELECT * FROM daily_scenarios WHERE id = ?").get(scenarioId)) as any;
  if (!scenario) return { ok: false };

  (await db.prepare(
        "INSERT OR IGNORE INTO scenario_responses (id, student_id, scenario_id, response_text, submitted_at) VALUES (?, ?, ?, ?, ?)",
      ).run(`scnr-${randomUUID().slice(0, 12)}`, me.id, scenarioId, text, Date.now()));
  (await touchActive(me.id));
  refreshDashboard();
  return { ok: true, explanation: scenario.explanation, concept: scenario.concept };
}

/* ---------------- Econ Quiz (Feature 3) ---------------- */

export interface QuizSubmitResult {
  ok: boolean;
  /** MC only — true/false; null for free response (self-checked). */
  isCorrect?: boolean | null;
  /** MC only — the correct choice letter. */
  correctAnswer?: string | null;
  /** MC explanation, or the FR model answer to self-check against. */
  explanation?: string;
}

/**
 * Submit an answer to one quiz question. Gated: the question's module must be
 * marked complete by this student, so questions can't be answered before they
 * unlock (even via a direct request). MC answers are auto-checked against the
 * stored key; FR answers are saved and the model answer is returned for the
 * student to self-check — never auto-graded.
 */
export async function submitQuizResponse(
  questionId: string,
  selectedChoice: string | null,
  responseText: string | null,
): Promise<QuizSubmitResult> {
  const me = await requireRole("student");
  const db = getDb();
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const q = (await db.prepare("SELECT * FROM quiz_questions WHERE id = ?").get(questionId)) as any;
  if (!q) return { ok: false };

  // Gate: the question's module (in its track) must be completed by this student.
  const qTrack = q.track ?? TRACK_101;
  const moduleOrdinal = Number(q.module_unlock);
  const view = (await getSelfModuleViews(me.id, qTrack)).find((v) => v.module.ordinal === moduleOrdinal);
  if (!view?.completed) return { ok: false };

  const now = Date.now();
  if (q.question_type === "mc") {
    const choice = String(selectedChoice ?? "").toUpperCase();
    if (!["A", "B", "C", "D"].includes(choice)) return { ok: false };
    const correct = String(q.correct_answer ?? "").toUpperCase();
    const isCorrect = choice === correct;
    (await db.prepare(
            "INSERT OR IGNORE INTO quiz_responses (id, student_id, question_id, response_text, selected_choice, is_correct, submitted_at) VALUES (?, ?, ?, NULL, ?, ?, ?)",
          ).run(`qr-${randomUUID().slice(0, 12)}`, me.id, questionId, choice, isCorrect ? 1 : 0, now));
    (await touchActive(me.id));
    refreshDashboard();
    return { ok: true, isCorrect, correctAnswer: q.correct_answer ?? null, explanation: q.explanation };
  }

  const text = String(responseText ?? "").trim();
  if (!text) return { ok: false };
  (await db.prepare(
        "INSERT OR IGNORE INTO quiz_responses (id, student_id, question_id, response_text, selected_choice, is_correct, submitted_at) VALUES (?, ?, ?, ?, NULL, NULL, ?)",
      ).run(`qr-${randomUUID().slice(0, 12)}`, me.id, questionId, text, now));
  (await touchActive(me.id));
  refreshDashboard();
  return { ok: true, isCorrect: null, correctAnswer: null, explanation: q.explanation };
}

/* ---------------- Daily Streak (Feature 2) ---------------- */

/** Body copy for each streak-milestone notification. */
function streakMilestoneBody(milestone: number): string {
  if (milestone >= 60) return "Sixty days straight. That's front-office discipline. Legendary.";
  if (milestone >= 30) return "A full month without missing a day. You're LEGENDARY.";
  if (milestone >= 14) return "Two weeks straight — you're building a real habit.";
  if (milestone >= 7) return "Seven days in a row. You're on fire. Keep it going.";
  return "Three days in a row — the streak is officially lit. Don't break it.";
}

/**
 * Update the student's streak for today's visit and fire a milestone
 * notification (3/7/14/30/60) when one is hit. Shared by the standalone
 * server action and the Daily Question submission. Idempotent within a day.
 */
async function runDailyVisit(userId: string): Promise<RecordVisitResult> {
  const r = await applyDailyVisitStreak(userId);
  if (r.advanced && r.milestone) {
    (await createNotification({
            id: `ntf-streak-${userId}-${r.milestone}`,
            userId,
            type: "streak_milestone",
            title: `${r.milestone}-day streak! 🔥`,
            body: streakMilestoneBody(r.milestone),
            link: "/dashboard",
          }));
  }
  return r;
}

export interface DailyVisitResult {
  current: number;
  longest: number;
  milestone: number | null;
}

/**
 * Record today's visit and advance the streak. Called inside
 * {@link submitDailyResponse} (answering the Daily Question counts as the
 * daily visit) and also exposed directly. Student-only.
 */
export async function recordDailyVisit(): Promise<DailyVisitResult> {
  const me = await requireRole("student");
  const r = (await runDailyVisit(me.id));
  refreshDashboard();
  return { current: r.current, longest: r.longest, milestone: r.milestone };
}

/* ---------------- Daily Question (Feature 1) ---------------- */

/** A newly earned badge, trimmed for the client toast. */
export interface EarnedBadgeResult {
  id: string;
  name: string;
  icon: string;
  description: string;
  xpReward: number;
}

export interface DailyQuestionResult {
  ok: boolean;
  /** The student's submitted answer (authoritative — reflects the stored answer). */
  selectedChoice?: string;
  isCorrect?: boolean;
  /** The correct answer (choice letter for MC, expected text for math/fr), revealed after answering. */
  correctAnswer?: string;
  explanation?: string;
  /** The BOW concept the question connects to (snake_case tag). */
  concept?: string;
  /** Display label for the concept (e.g. "Opportunity Cost"). */
  conceptLabel?: string;
  /** True when the student had already answered today's question. */
  alreadyAnswered?: boolean;
  /** Streak after recording today's visit. */
  currentStreak?: number;
  longestStreak?: number;
  streakMilestone?: number | null;
  /** Whether today's visit extended (or started) the streak. */
  streakAdvanced?: boolean;
  /** XP banked by THIS submission (question points + streak bonus + badge XP). */
  xpEarned?: number;
  /** The student's XP total after this submission. */
  totalXp?: number;
  /** Badges newly unlocked by this submission (for the toast queue). */
  newBadges?: EarnedBadgeResult[];
  /** Difficulty tier label for the answered question ("Rookie"/"Pro"/"Executive"). */
  tierLabel?: string;
}

/** XP bonus when a streak crosses a 7-day multiple. */
const STREAK_BONUS_XP = 15;

/**
 * Submit an answer to today's Daily Question. One response per student per
 * question (idempotent via UNIQUE). MC is auto-checked against the stored key;
 * math/fr answers are graded by {@link gradeAnswer}. Answering counts as the
 * daily visit (streak), banks XP, and awards any newly earned badges.
 */
export async function submitDailyResponse(
  questionId: string,
  selectedChoice: string,
): Promise<DailyQuestionResult> {
  const me = await requireRole("student");
  const q = (await getDailyQuestionById(questionId));
  if (!q) return { ok: false };

  // MC stores an uppercase letter; math/fr store the trimmed typed answer.
  const submitted = q.type === "mc" ? String(selectedChoice ?? "").trim().toUpperCase() : String(selectedChoice ?? "").trim();
  if (submitted === "") return { ok: false };
  if (q.type === "mc" && !["A", "B", "C", "D"].includes(submitted)) return { ok: false };

  const db = getDb();
  const isCorrect = gradeAnswer(q, submitted);
  const result = (await db
      .prepare(
        "INSERT OR IGNORE INTO daily_responses (id, student_id, question_id, selected_choice, is_correct, responded_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(`dr-${randomUUID().slice(0, 12)}`, me.id, questionId, submitted, isCorrect ? 1 : 0, Date.now()));
  const alreadyAnswered = Number(result.changes) === 0;

  // Authoritative stored answer (in case they had already answered today).
  const stored = (await db
      .prepare("SELECT selected_choice, is_correct FROM daily_responses WHERE student_id = ? AND question_id = ?")
      .get(me.id, questionId)) as { selected_choice?: string; is_correct?: number } | undefined;
  const storedChoice = String(stored?.selected_choice ?? submitted);
  const storedCorrect = Number(stored?.is_correct) === 1;

  (await touchActive(me.id));
  // Answering the Daily Question is the daily visit — update the streak.
  const visit = (await runDailyVisit(me.id));

  // ---- XP + badges (only the first answer of the day banks streak/points XP) ----
  let xpEarned = 0;
  if (!alreadyAnswered && isCorrect) xpEarned += q.points;
  if (visit.advanced && visit.current > 0 && visit.current % 7 === 0) xpEarned += STREAK_BONUS_XP;

  // Award badges AFTER the response + streak are recorded so stats are current.
  const newBadges = (await checkAndAwardBadges(me.id));
  xpEarned += newBadges.reduce((sum, b) => sum + b.xpReward, 0);

  if (xpEarned > 0) (await db.prepare("UPDATE users SET xp = COALESCE(xp, 0) + ? WHERE id = ?").run(xpEarned, me.id));
  const totalXp = ((await db.prepare("SELECT xp FROM users WHERE id = ?").get(me.id)) as { xp?: number } | undefined)?.xp ?? 0;

  refreshDashboard();

  return {
    ok: true,
    selectedChoice: storedChoice,
    isCorrect: storedCorrect,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    concept: q.conceptTag,
    conceptLabel: conceptLabel(q.conceptTag),
    alreadyAnswered,
    currentStreak: visit.current,
    longestStreak: visit.longest,
    streakMilestone: visit.advanced ? visit.milestone : null,
    streakAdvanced: visit.advanced,
    xpEarned,
    totalXp: Number(totalXp) || 0,
    newBadges: newBadges.map((b) => ({ id: b.id, name: b.name, icon: b.icon, description: b.description, xpReward: b.xpReward })),
    tierLabel: tierLabel(q.difficulty),
  };
}

/* ---------------- Player Card (Feature 4) ---------------- */

export interface PlayerCardResult {
  ok: boolean;
  html?: string;
  filename?: string;
  positionLabel?: string;
}

/**
 * Generate (and record) the student's Player Card. Idempotent at the storage
 * layer — one row per student, updated with the latest position label — and
 * returns a self-contained HTML file to download.
 */
export async function generatePlayerCard(): Promise<PlayerCardResult> {
  const me = await requireRole("student");
  const data = (await getPlayerCardData(me.id));
  if (!data) return { ok: false };
  (await recordPlayerCard(me.id, data.positionLabel));
  (await touchActive(me.id));
  return { ok: true, html: buildPlayerCardHtml(data), filename: playerCardFilename(data.name), positionLabel: data.positionLabel };
}

/* ---------------- Instructor controls (instructor + admin) ---------------- */

/**
 * Manual module override: unlock any module for any student regardless of the
 * auto-unlock conditions. Stored as the `instructor_unlocked` flag on the
 * student's progress row.
 */
export async function instructorUnlockModule(studentId: string, moduleId: string): Promise<void> {
  const me = await requireRole("instructor", "admin");
  const db = getDb();
  const cohort = (await assertCohortOwnership(me, SELF_PACED_COHORT_ID, db));
  (await requireStudentMembership(db, cohort, studentId, { userStatuses: ["active"], enrollmentStates: ["active"] }));
  const selfModule = (await requireSelfModule(db, moduleId));
  const now = Date.now();
  (await db.prepare(
        "INSERT INTO self_progress (student_id, module_id, instructor_unlocked, updated_at, track) VALUES (?, ?, 1, ?, ?) ON CONFLICT(student_id, module_id) DO UPDATE SET instructor_unlocked = 1, updated_at = excluded.updated_at, track = excluded.track",
      ).run(studentId, moduleId, now, selfModule.track));
  refreshInstructor();
}

/** Reverse a manual override (does not touch the student's own progress). */
export async function instructorRelockModule(studentId: string, moduleId: string): Promise<void> {
  const me = await requireRole("instructor", "admin");
  const db = getDb();
  const cohort = (await assertCohortOwnership(me, SELF_PACED_COHORT_ID, db));
  (await requireStudentMembership(db, cohort, studentId, { userStatuses: ["active"], enrollmentStates: ["active"] }));
  const selfModule = (await requireSelfModule(db, moduleId));
  (await db.prepare(
        "UPDATE self_progress SET instructor_unlocked = 0, updated_at = ?, track = ? WHERE student_id = ? AND module_id = ?",
      ).run(Date.now(), selfModule.track, studentId, moduleId));
  refreshInstructor();
}

/** Save a per-student session note (stored student-scoped in session_notes). */
export async function saveStudentNote(studentId: string, note: string): Promise<void> {
  const me = await requireRole("instructor", "admin");
  if (typeof studentId !== "string" || !studentId.trim() || studentId.length > 100) throw new Error("Choose a valid student.");
  if (typeof note !== "string") throw new Error("Enter a valid student note.");
  const body = note.trim();
  if (!body) return;
  if (body.length > 4000) throw new Error("Student notes must be 4,000 characters or fewer.");
  const db = getDb();
  const id = `note-${randomUUID().slice(0, 8)}`;
  const now = Date.now();
  (await withLegacyTransaction(db, async () => {
        const cohort = (await assertCohortOwnership(me, SELF_PACED_COHORT_ID, db));
        const { user: student } = (await requireStudentMembership(db, cohort, studentId, {
              userStatuses: ["active"],
              enrollmentStates: ["active"],
            }));
        (await db.prepare(
                "INSERT INTO session_notes (id, cohort_id, author_id, student_id, scope, text, created_at, created_ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
              ).run(
                id,
                SELF_PACED_COHORT_ID,
                me.id,
                studentId,
                `Student · ${student.name}`.slice(0, 200),
                body,
                fmtDate(new Date(now)),
                now,
              ));
      }));
  refreshInstructor();
}

/** Toggle a student's attendance for one session of the self-paced cohort. */
export async function setSessionAttendance(studentId: string, sessionNo: number, present: boolean): Promise<void> {
  const me = await requireRole("instructor", "admin");
  if (typeof studentId !== "string" || !studentId.trim() || studentId.length > 100) throw new Error("Choose a valid student.");
  if (!Number.isInteger(sessionNo) || sessionNo < 1 || sessionNo > SELF_PACED_SESSIONS) {
    throw new Error("Choose a valid session.");
  }
  if (typeof present !== "boolean") throw new Error("Invalid attendance value.");
  const db = getDb();
  (await withLegacyTransaction(db, async () => {
        const cohort = (await assertCohortOwnership(me, SELF_PACED_COHORT_ID, db));
        (await requireStudentMembership(db, cohort, studentId, { userStatuses: ["active"], enrollmentStates: ["active"] }));
        const written = (await db
              .prepare(
                "INSERT INTO self_attendance (cohort_id, student_id, session_no, present) VALUES (?, ?, ?, ?) ON CONFLICT(cohort_id, student_id, session_no) DO UPDATE SET present = excluded.present",
              )
              .run(SELF_PACED_COHORT_ID, studentId, sessionNo, present ? 1 : 0));
        if (written.changes !== 1) throw new Error("Session attendance changed before it could be saved.");
      }));
  refreshInstructor();
}

function fmtDate(d: Date): string {
  return formatCanonicalDate(canonicalDateInZone(d.getTime()));
}

function fmtDateTime(d: Date): string {
  return formatCanonicalDate(canonicalDateInZone(d.getTime()));
}
