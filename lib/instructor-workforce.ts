/* ============================================================
 * Instructor workforce dossier read model.
 *
 * This is intentionally query-shaped for one instructor. It avoids loading the
 * organization-wide Operations snapshot into a profile request and keeps raw
 * database rows and internal identifiers out of Client Components.
 * ============================================================ */

import "server-only";

import { getDb } from "@/lib/db";
import { canonicalDateInZone, formatDateTimeInZone } from "@/lib/timezone";

interface BaseRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  user_id: string | null;
  stage: string;
  progression_level: string;
  development_focus: string | null;
  max_weekly_classes: number;
}

interface AssignmentRow {
  id: string;
  class_id: string;
  class_title: string;
  role: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  program_id: string | null;
  program_name: string | null;
  curriculum_title: string | null;
  location_name: string | null;
  decision_reason: string | null;
  added_at: number;
  removed_at: number | null;
}

interface RemovedAssignmentRow extends Omit<AssignmentRow, "id" | "added_at" | "removed_at"> {
  decision_id: string;
  removed_at: number;
}

interface QualificationRow {
  id: string;
  kind: string;
  value: string;
  status: string;
  approved_at: number | null;
  expires_at: number | null;
  expires_on: string | null;
  notes: string | null;
  updated_at: number;
  approver_name: string | null;
  curriculum_name: string | null;
  location_name: string | null;
  region_name: string | null;
}

interface FeedbackRow {
  id: string;
  source_type: string;
  author_name: string | null;
  class_name: string | null;
  program_name: string | null;
  partner_name: string | null;
  session_date: number | null;
  session_timezone: string | null;
  submitter_name: string | null;
  curriculum_delivery: number | null;
  student_family_relationships: number | null;
  organization_reliability: number | null;
  leadership_contribution: number | null;
  strengths: string | null;
  concerns: string | null;
  body: string | null;
  follow_up_required: number;
  created_at: number;
}

interface DevelopmentRow {
  id: string;
  kind: string;
  title: string;
  stage: string;
  status: string;
  owner_name: string | null;
  due_at: number | null;
  due_on: string | null;
  notes: string | null;
  related_feedback_id: string | null;
  created_at: number;
  updated_at: number;
  resolved_at: number | null;
}

interface QualityAggregateRow {
  curriculum_all: number | null;
  curriculum_recent: number | null;
  curriculum_prior: number | null;
  curriculum_count: number;
  relationships_all: number | null;
  relationships_recent: number | null;
  relationships_prior: number | null;
  relationships_count: number;
  reliability_all: number | null;
  reliability_recent: number | null;
  reliability_prior: number | null;
  reliability_count: number;
  leadership_all: number | null;
  leadership_recent: number | null;
  leadership_prior: number | null;
  leadership_count: number;
}

export interface WorkforceAssignment {
  id: string;
  classId: string;
  classTitle: string;
  role: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  programId: string | null;
  programName: string;
  curriculumTitle: string;
  locationName: string;
  addedAt: number;
  decisionReason: string | null;
  current: boolean;
}

export interface WorkforceQualification {
  id: string;
  kind: string;
  value: string;
  label: string;
  status: "approved" | "expired" | "revoked";
  approvedAt: number | null;
  expiresAt: number | null;
  expiresOn: string | null;
  notes: string | null;
  approverName: string | null;
}

export interface WorkforceFeedback {
  id: string;
  sourceType: string;
  authorName: string | null;
  contextLabel: string;
  submittedByName: string | null;
  ratings: {
    curriculumDelivery: number | null;
    studentFamilyRelationships: number | null;
    organizationReliability: number | null;
    leadershipContribution: number | null;
  };
  strengths: string | null;
  concerns: string | null;
  body: string | null;
  followUpRequired: boolean;
  createdAt: number;
}

export interface WorkforceDevelopmentItem {
  id: string;
  kind: string;
  title: string;
  stage: string;
  status: string;
  ownerName: string | null;
  dueAt: number | null;
  dueOn: string | null;
  notes: string | null;
  relatedToFeedback: boolean;
  createdAt: number;
  updatedAt: number;
  resolvedAt: number | null;
}

export interface NamedOption {
  id: string;
  label: string;
}

export interface QualificationOptionGroups {
  curriculum: NamedOption[];
  age_group: NamedOption[];
  format: NamedOption[];
  role: NamedOption[];
  location: NamedOption[];
  region: NamedOption[];
}

export interface FeedbackContextOptions {
  classes: NamedOption[];
  programs: NamedOption[];
  partners: NamedOption[];
  sessions: NamedOption[];
}

export interface QualityDimension {
  key: "curriculumDelivery" | "studentFamilyRelationships" | "organizationReliability" | "leadershipContribution";
  label: string;
  average: number | null;
  recentAverage: number | null;
  evidenceCount: number;
}

export interface InstructorWorkforceDossier {
  profile: {
    id: string;
    name: string;
    email: string;
    phone: string;
    stage: string;
    progressionLevel: string;
    developmentFocus: string | null;
    maxWeeklyClasses: number;
  };
  currentAssignments: WorkforceAssignment[];
  priorAssignments: WorkforceAssignment[];
  qualifications: WorkforceQualification[];
  feedback: WorkforceFeedback[];
  development: WorkforceDevelopmentItem[];
  availability: { id: string; dayOfWeek: number; startTime: string; endTime: string; notes: string | null }[];
  qualityDimensions: QualityDimension[];
  qualityTrend: { label: string; detail: string; tone: "positive" | "warning" | "neutral" };
  reliability: {
    deliveredSessions180d: number;
    missingReports180d: number;
    reportsSubmittedByInstructor180d: number;
    lowReliabilitySignals180d: number;
    next30DaySessions: number;
  };
  workload: { currentClasses: number; pausedClasses: number; maximumClasses: number };
  nextAction: { title: string; detail: string; href: string; tone: "positive" | "warning" | "negative" | "info" };
  qualificationOptions: QualificationOptionGroups;
  feedbackContextOptions: FeedbackContextOptions;
}

const CURRENT_CLASS_STATUSES = new Set(["planning", "staffing", "ready_to_launch", "active", "paused"]);

function formatValue(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function qualificationLabel(row: QualificationRow): string {
  if (row.value === "all") {
    return {
      curriculum: "All curricula",
      age_group: "All age groups",
      format: "All delivery formats",
      role: "All teaching roles",
      location: "All locations",
      region: "All regions",
    }[row.kind] ?? "All approved scope";
  }
  if (row.kind === "curriculum") return row.curriculum_name ?? "Retired Curriculum";
  if (row.kind === "location") return row.location_name ?? "Closed or removed Location";
  if (row.kind === "region") return row.region_name ?? "Closed or removed Region";
  if (row.kind === "role" && row.value === "assistant") return "Assistant instructor";
  return formatValue(row.value);
}

function feedbackContext(row: FeedbackRow): string {
  const pieces: string[] = [];
  if (row.session_date) pieces.push(`Session ${formatDateTimeInZone(row.session_date, row.session_timezone)}`);
  if (row.class_name) pieces.push(row.class_name);
  if (row.program_name && row.program_name !== row.class_name) pieces.push(row.program_name);
  if (row.partner_name) pieces.push(row.partner_name);
  return pieces.length > 0 ? pieces.join(" · ") : "General workforce feedback";
}

function mean(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value != null);
  if (present.length === 0) return null;
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}

function qualitySummary(aggregate: QualityAggregateRow): {
  dimensions: QualityDimension[];
  trend: InstructorWorkforceDossier["qualityTrend"];
} {
  const dimensions = [
    ["curriculumDelivery", "Curriculum delivery", aggregate.curriculum_all, aggregate.curriculum_recent, aggregate.curriculum_prior, aggregate.curriculum_count],
    ["studentFamilyRelationships", "Student & family relationships", aggregate.relationships_all, aggregate.relationships_recent, aggregate.relationships_prior, aggregate.relationships_count],
    ["organizationReliability", "Organization & reliability", aggregate.reliability_all, aggregate.reliability_recent, aggregate.reliability_prior, aggregate.reliability_count],
    ["leadershipContribution", "Leadership contribution", aggregate.leadership_all, aggregate.leadership_recent, aggregate.leadership_prior, aggregate.leadership_count],
  ] as const;
  const mapped: QualityDimension[] = dimensions.map(([key, label, average, recentAverage, , evidenceCount]) => ({
    key,
    label,
    average,
    recentAverage,
    evidenceCount,
  }));
  const recentComposite = mean(dimensions.map((dimension) => dimension[3]));
  const priorComposite = mean(dimensions.map((dimension) => dimension[4]));
  if (recentComposite == null) {
    return {
      dimensions: mapped,
      trend: { label: "Evidence needed", detail: "No scored quality evidence has been captured in the last 90 days.", tone: "neutral" },
    };
  }
  if (priorComposite == null) {
    return {
      dimensions: mapped,
      trend: {
        label: "Baseline forming",
        detail: `Recent multidimensional average is ${recentComposite.toFixed(1)}/5; another review cycle will establish direction.`,
        tone: recentComposite < 3 ? "warning" : "neutral",
      },
    };
  }
  const delta = recentComposite - priorComposite;
  if (delta >= 0.25) {
    return {
      dimensions: mapped,
      trend: { label: "Improving", detail: `Recent evidence improved ${delta.toFixed(1)} points over the prior 90-day window.`, tone: "positive" },
    };
  }
  if (delta <= -0.25) {
    return {
      dimensions: mapped,
      trend: { label: "Needs review", detail: `Recent evidence declined ${Math.abs(delta).toFixed(1)} points from the prior 90-day window.`, tone: "warning" },
    };
  }
  return {
    dimensions: mapped,
    trend: { label: "Stable", detail: "Recent evidence is within 0.2 points of the prior 90-day window.", tone: "neutral" },
  };
}

function nextActionFor(input: {
  profile: BaseRow;
  qualifications: WorkforceQualification[];
  feedback: WorkforceFeedback[];
  development: WorkforceDevelopmentItem[];
  workload: InstructorWorkforceDossier["workload"];
  reliability: InstructorWorkforceDossier["reliability"];
  work: { title: string; priority: string; dueAt: number | null; dueOn: string | null }[];
}): InstructorWorkforceDossier["nextAction"] {
  const now = Date.now();
  const today = canonicalDateInZone(now);
  const overdue = input.development.find((item) =>
    item.status === "open"
    && (item.dueOn ? item.dueOn < today : item.dueAt != null && item.dueAt < now),
  );
  if (overdue) {
    return {
      title: `Resolve overdue ${formatValue(overdue.kind)}`,
      detail: `${overdue.title} passed its due date. Record the outcome or advance the plan today.`,
      href: "#development",
      tone: "negative",
    };
  }
  const overdueWork = input.work.find((item) =>
    item.dueOn ? item.dueOn < today : item.dueAt != null && item.dueAt < now,
  );
  if (overdueWork) {
    return {
      title: "Resolve overdue Work",
      detail: `${overdueWork.title} passed its due date and is still open.`,
      href: "#work",
      tone: "negative",
    };
  }
  const urgentWork = input.work.find((item) => item.priority === "urgent");
  if (urgentWork) {
    return {
      title: "Resolve urgent Work",
      detail: `${urgentWork.title} is the highest-priority open item on this dossier.`,
      href: "#work",
      tone: "negative",
    };
  }
  if (input.workload.currentClasses > input.workload.maximumClasses) {
    return {
      title: "Rebalance teaching load",
      detail: `${input.profile.name} is assigned to ${input.workload.currentClasses} current Classes against a stated limit of ${input.workload.maximumClasses}.`,
      href: "#assignments",
      tone: "negative",
    };
  }
  if (input.reliability.missingReports180d > 0) {
    return {
      title: "Close delivery evidence gaps",
      detail: `${input.reliability.missingReports180d} assigned session report${input.reliability.missingReports180d === 1 ? " is" : "s are"} still incomplete from the last 180 days.`,
      href: "#reliability",
      tone: "warning",
    };
  }
  const upcoming = input.development.find((item) => item.status === "open");
  if (upcoming) {
    return {
      title: `Advance ${formatValue(upcoming.kind)}`,
      detail: `${upcoming.title} is currently ${formatValue(upcoming.stage).toLowerCase()}. Record the next coaching step.`,
      href: "#development",
      tone: "info",
    };
  }
  const activeQualifications = input.qualifications.filter((item) => item.status === "approved");
  if (activeQualifications.length === 0 && !["applied", "reviewing", "interview_scheduled", "interviewed", "founder_review"].includes(input.profile.stage)) {
    return {
      title: "Define teaching scope",
      detail: "No active Curriculum, audience, format, role, Location, or Region approvals are recorded, so staffing recommendations remain blocked.",
      href: "#workforce-controls",
      tone: "warning",
    };
  }
  const recentFeedback = input.feedback.some((item) => item.createdAt >= now - 90 * 24 * 60 * 60 * 1000);
  if (!recentFeedback && ["eligible", "active"].includes(input.profile.stage)) {
    return {
      title: "Capture current quality evidence",
      detail: "No feedback has been recorded in the last 90 days. Add a staff, partner, or family signal before the next assignment decision.",
      href: "#workforce-controls",
      tone: "info",
    };
  }
  return {
    title: "Maintain the evidence cadence",
    detail: "No overdue development, workload, or delivery-report exception is currently visible.",
    href: "#quality",
    tone: "positive",
  };
}

function namedOptions(rows: { id: string; label: string }[], allLabel?: string): NamedOption[] {
  const options = rows.map((row) => ({ id: row.id, label: row.label }));
  return allLabel ? [{ id: "all", label: allLabel }, ...options] : options;
}

export function getInstructorWorkforceDossier(instructorId: string): InstructorWorkforceDossier | null {
  const db = getDb();
  const now = Date.now();
  const profile = db
    .prepare(
      `SELECT i.id, p.name, p.email, p.phone, p.user_id, i.stage, i.progression_level,
              i.development_focus, i.max_weekly_classes
         FROM instructors i
         JOIN people p ON p.id = i.person_id
        WHERE i.id = ?`,
    )
    .get(instructorId) as BaseRow | undefined;
  if (!profile) return null;

  const assignmentRows = db
    .prepare(
      `SELECT ci.id, ci.class_id, c.title AS class_title, ci.role, c.status, c.start_date, c.end_date,
              c.program_id, p.name AS program_name, cr.title AS curriculum_title,
              COALESCE(l.name, c.location) AS location_name,
              CASE WHEN ci.removed_at IS NULL THEN ci.decision_reason ELSE ci.removal_reason END AS decision_reason,
              ci.added_at, ci.removed_at
         FROM class_instructors ci
         JOIN classes c ON c.id = ci.class_id
         LEFT JOIN programs p ON p.id = c.program_id
         LEFT JOIN curricula cr ON cr.id = c.curriculum_id
         LEFT JOIN locations l ON l.id = c.location_id
        WHERE ci.instructor_id = ?
        ORDER BY CASE WHEN c.status IN ('active','ready_to_launch','staffing','planning','paused') THEN 0 ELSE 1 END,
                 COALESCE(c.start_date, '9999-12-31') DESC, ci.added_at DESC`,
    )
    .all(instructorId) as unknown as AssignmentRow[];
  const removedAssignmentRows = db
    .prepare(
      `SELECT od.id AS decision_id, od.entity_id AS class_id, c.title AS class_title,
              json_extract(od.decision, '$.role') AS role, 'removed' AS status,
              c.start_date, c.end_date, c.program_id, p.name AS program_name,
              cr.title AS curriculum_title, COALESCE(l.name, c.location) AS location_name,
              od.reason AS decision_reason,
              od.decided_at AS removed_at
         FROM operational_decisions od
         JOIN classes c ON c.id = od.entity_id
         LEFT JOIN programs p ON p.id = c.program_id
         LEFT JOIN curricula cr ON cr.id = c.curriculum_id
         LEFT JOIN locations l ON l.id = c.location_id
        WHERE od.entity_type = 'class' AND od.decision_type = 'instructor_assignment'
          AND json_extract(od.decision, '$.action') = 'removed'
          AND json_extract(od.decision, '$.instructorId') = ?
          AND NOT EXISTS (
            SELECT 1 FROM class_instructors ci
             WHERE ci.id = json_extract(od.metadata, '$.assignmentId')
          )
        ORDER BY od.decided_at DESC
        LIMIT 250`,
    )
    .all(instructorId) as unknown as RemovedAssignmentRow[];
  const assignments: WorkforceAssignment[] = [
    ...assignmentRows.map((row) => ({
      id: row.id,
      classId: row.class_id,
      classTitle: row.class_title,
      role: row.role,
      status: row.removed_at == null ? row.status : "removed",
      startDate: row.start_date,
      endDate: row.end_date,
      programId: row.program_id,
      programName: row.program_name ?? "Program unavailable",
      curriculumTitle: row.curriculum_title ?? "Curriculum unavailable",
      locationName: row.location_name ?? "Location not recorded",
      addedAt: row.added_at,
      decisionReason: row.decision_reason,
      current: row.removed_at == null && CURRENT_CLASS_STATUSES.has(row.status),
    })),
    ...removedAssignmentRows.map((row) => ({
      id: row.decision_id,
      classId: row.class_id,
      classTitle: row.class_title,
      role: row.role,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      programId: row.program_id,
      programName: row.program_name ?? "Program unavailable",
      curriculumTitle: row.curriculum_title ?? "Curriculum unavailable",
      locationName: row.location_name ?? "Location not recorded",
      addedAt: row.removed_at,
      decisionReason: row.decision_reason,
      current: false,
    })),
  ];

  const qualificationRows = db
    .prepare(
      `SELECT q.*, u.name AS approver_name, cr.title AS curriculum_name,
              l.name AS location_name, r.name AS region_name
         FROM instructor_qualifications q
         LEFT JOIN users u ON u.id = q.approved_by
         LEFT JOIN curricula cr ON q.kind = 'curriculum' AND cr.id = q.value
         LEFT JOIN locations l ON q.kind = 'location' AND l.id = q.value
         LEFT JOIN operating_regions r ON q.kind = 'region' AND r.id = q.value
        WHERE q.instructor_id = ?
        ORDER BY CASE q.status WHEN 'approved' THEN 0 ELSE 1 END, q.kind, q.updated_at DESC`,
    )
    .all(instructorId) as unknown as QualificationRow[];
  const today = canonicalDateInZone(now);
  const qualifications: WorkforceQualification[] = qualificationRows.map((row) => {
    const expired = row.expires_on
      ? row.expires_on < today
      : Boolean(row.expires_at && row.expires_at <= now);
    return {
      id: row.id,
      kind: row.kind,
      value: row.value,
      label: qualificationLabel(row),
      status: row.status === "approved" && expired ? "expired" : row.status === "approved" ? "approved" : "revoked",
      approvedAt: row.approved_at,
      expiresAt: row.expires_at,
      expiresOn: row.expires_on,
      notes: row.notes,
      approverName: row.approver_name,
    };
  });

  const feedbackRows = db
    .prepare(
      `SELECT f.*, c.title AS class_name, p.name AS program_name, o.name AS partner_name,
              cs.session_date, COALESCE(cs.timezone, c.schedule_timezone) AS session_timezone,
              u.name AS submitter_name
         FROM instructor_feedback f
         LEFT JOIN classes c ON c.id = f.class_id
         LEFT JOIN programs p ON p.id = f.program_id
         LEFT JOIN organizations o ON o.id = f.partner_org_id
         LEFT JOIN class_sessions cs ON cs.id = f.session_id
         LEFT JOIN users u ON u.id = f.submitted_by_user_id
        WHERE f.instructor_id = ?
        ORDER BY f.created_at DESC
        LIMIT 60`,
    )
    .all(instructorId) as unknown as FeedbackRow[];
  const feedback: WorkforceFeedback[] = feedbackRows.map((row) => ({
    id: row.id,
    sourceType: row.source_type,
    authorName: row.author_name,
    contextLabel: feedbackContext(row),
    submittedByName: row.submitter_name,
    ratings: {
      curriculumDelivery: row.curriculum_delivery,
      studentFamilyRelationships: row.student_family_relationships,
      organizationReliability: row.organization_reliability,
      leadershipContribution: row.leadership_contribution,
    },
    strengths: row.strengths,
    concerns: row.concerns,
    body: row.body,
    followUpRequired: row.follow_up_required === 1,
    createdAt: row.created_at,
  }));
  const recentCutoff = now - 90 * 24 * 60 * 60 * 1000;
  const priorCutoff = now - 180 * 24 * 60 * 60 * 1000;
  const qualityAggregate = db
    .prepare(
      `WITH bounds AS (SELECT ? AS recent_cutoff, ? AS prior_cutoff)
       SELECT
         AVG(f.curriculum_delivery) AS curriculum_all,
         AVG(CASE WHEN f.created_at >= b.recent_cutoff THEN f.curriculum_delivery END) AS curriculum_recent,
         AVG(CASE WHEN f.created_at >= b.prior_cutoff AND f.created_at < b.recent_cutoff THEN f.curriculum_delivery END) AS curriculum_prior,
         COUNT(f.curriculum_delivery) AS curriculum_count,
         AVG(f.student_family_relationships) AS relationships_all,
         AVG(CASE WHEN f.created_at >= b.recent_cutoff THEN f.student_family_relationships END) AS relationships_recent,
         AVG(CASE WHEN f.created_at >= b.prior_cutoff AND f.created_at < b.recent_cutoff THEN f.student_family_relationships END) AS relationships_prior,
         COUNT(f.student_family_relationships) AS relationships_count,
         AVG(f.organization_reliability) AS reliability_all,
         AVG(CASE WHEN f.created_at >= b.recent_cutoff THEN f.organization_reliability END) AS reliability_recent,
         AVG(CASE WHEN f.created_at >= b.prior_cutoff AND f.created_at < b.recent_cutoff THEN f.organization_reliability END) AS reliability_prior,
         COUNT(f.organization_reliability) AS reliability_count,
         AVG(f.leadership_contribution) AS leadership_all,
         AVG(CASE WHEN f.created_at >= b.recent_cutoff THEN f.leadership_contribution END) AS leadership_recent,
         AVG(CASE WHEN f.created_at >= b.prior_cutoff AND f.created_at < b.recent_cutoff THEN f.leadership_contribution END) AS leadership_prior,
         COUNT(f.leadership_contribution) AS leadership_count
       FROM instructor_feedback f
       CROSS JOIN bounds b
       WHERE f.instructor_id = ?`,
    )
    .get(recentCutoff, priorCutoff, instructorId) as unknown as QualityAggregateRow;

  const developmentRows = db
    .prepare(
      `SELECT d.*, u.name AS owner_name
         FROM instructor_development_items d
         LEFT JOIN users u ON u.id = d.owner_user_id
        WHERE d.instructor_id = ?
        ORDER BY CASE d.status WHEN 'open' THEN 0 ELSE 1 END,
                 CASE WHEN d.due_at IS NULL THEN 1 ELSE 0 END, d.due_at, d.updated_at DESC
        LIMIT 80`,
    )
    .all(instructorId) as unknown as DevelopmentRow[];
  const development: WorkforceDevelopmentItem[] = developmentRows.map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    stage: row.stage,
    status: row.status,
    ownerName: row.owner_name,
    dueAt: row.due_at,
    dueOn: row.due_on,
    notes: row.notes,
    relatedToFeedback: Boolean(row.related_feedback_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  }));

  const availability = db
    .prepare(
      `SELECT id, day_of_week AS dayOfWeek, start_time AS startTime, end_time AS endTime, notes
         FROM instructor_availability
        WHERE instructor_id = ?
        ORDER BY day_of_week, start_time`,
    )
    .all(instructorId) as InstructorWorkforceDossier["availability"];

  const currentClasses = assignments.filter((assignment) => assignment.current && assignment.status !== "paused").length;
  const pausedClasses = assignments.filter((assignment) => assignment.status === "paused").length;
  const workload = { currentClasses, pausedClasses, maximumClasses: Number(profile.max_weekly_classes) || 3 };
  const cutoff180 = priorCutoff;
  const next30 = now + 30 * 24 * 60 * 60 * 1000;
  const delivered = db
    .prepare(
      `SELECT COUNT(DISTINCT cs.id) AS total
         FROM class_sessions cs
        JOIN class_instructors ci ON ci.class_id = cs.class_id
        WHERE ci.instructor_id = ? AND cs.session_date >= ci.added_at
          AND (ci.removed_at IS NULL OR cs.session_date < ci.removed_at)
          AND cs.session_date BETWEEN ? AND ?`,
    )
    .get(instructorId, cutoff180, now) as { total: number };
  const missingReports = db
    .prepare(
      `SELECT COUNT(DISTINCT cs.id) AS total
         FROM class_sessions cs
        JOIN class_instructors ci ON ci.class_id = cs.class_id
        WHERE ci.instructor_id = ? AND cs.session_date >= ci.added_at
          AND (ci.removed_at IS NULL OR cs.session_date < ci.removed_at)
          AND cs.session_date BETWEEN ? AND ?
          AND NOT EXISTS (
            SELECT 1 FROM class_session_reports r WHERE r.session_id = cs.id AND r.completed = 1
          )`,
    )
    .get(instructorId, cutoff180, now) as { total: number };
  const reportsByInstructor = profile.user_id
    ? (db
        .prepare(
          `SELECT COUNT(DISTINCT r.session_id) AS total
             FROM class_session_reports r
             JOIN class_sessions cs ON cs.id = r.session_id
             JOIN class_instructors ci ON ci.class_id = cs.class_id
            WHERE ci.instructor_id = ? AND r.reported_by = ? AND r.completed = 1
              AND cs.session_date >= ci.added_at
              AND (ci.removed_at IS NULL OR cs.session_date < ci.removed_at)
              AND cs.session_date BETWEEN ? AND ?`,
        )
        .get(instructorId, profile.user_id, cutoff180, now) as { total: number })
    : { total: 0 };
  const lowReliability = db
    .prepare(
      `SELECT COUNT(*) AS total
         FROM instructor_feedback
        WHERE instructor_id = ? AND created_at >= ?
          AND organization_reliability IS NOT NULL AND organization_reliability <= 2`,
    )
    .get(instructorId, cutoff180) as { total: number };
  const upcoming = db
    .prepare(
      `SELECT COUNT(DISTINCT cs.id) AS total
         FROM class_sessions cs
        JOIN class_instructors ci ON ci.class_id = cs.class_id
        WHERE ci.instructor_id = ? AND cs.session_date >= ci.added_at
          AND (ci.removed_at IS NULL OR cs.session_date < ci.removed_at)
          AND cs.session_date > ? AND cs.session_date <= ?`,
    )
    .get(instructorId, now, next30) as { total: number };
  const reliability = {
    deliveredSessions180d: Number(delivered.total) || 0,
    missingReports180d: Number(missingReports.total) || 0,
    reportsSubmittedByInstructor180d: Number(reportsByInstructor.total) || 0,
    lowReliabilitySignals180d: Number(lowReliability.total) || 0,
    next30DaySessions: Number(upcoming.total) || 0,
  };

  const curriculumOptions = db
    .prepare("SELECT id, title AS label FROM curricula WHERE published = 1 ORDER BY title LIMIT 250")
    .all() as unknown as NamedOption[];
  const ageGroupOptions = db
    .prepare(
      `SELECT value AS id, value AS label FROM (
         SELECT DISTINCT trim(age_range) AS value FROM classes WHERE trim(COALESCE(age_range, '')) <> ''
         UNION SELECT DISTINCT trim(audience) AS value FROM programs WHERE trim(COALESCE(audience, '')) <> ''
       ) ORDER BY value LIMIT 250`,
    )
    .all() as unknown as NamedOption[];
  const locationOptions = db
    .prepare(
      `SELECT l.id, l.name || CASE WHEN trim(COALESCE(l.city, '')) <> '' THEN ' · ' || l.city ELSE '' END AS label
         FROM locations l WHERE l.stage <> 'closed' ORDER BY l.name LIMIT 250`,
    )
    .all() as unknown as NamedOption[];
  const regionOptions = db
    .prepare("SELECT id, name || ' · ' || code AS label FROM operating_regions WHERE stage <> 'closed' ORDER BY name LIMIT 250")
    .all() as unknown as NamedOption[];
  const qualificationOptions: QualificationOptionGroups = {
    curriculum: namedOptions(curriculumOptions, "All curricula"),
    age_group: namedOptions(ageGroupOptions, "All age groups"),
    format: [
      { id: "all", label: "All delivery formats" },
      { id: "in_person", label: "In person" },
      { id: "online", label: "Online" },
      { id: "hybrid", label: "Hybrid" },
    ],
    role: [
      { id: "all", label: "All teaching roles" },
      { id: "lead", label: "Lead instructor" },
      { id: "assistant", label: "Assistant instructor" },
    ],
    location: namedOptions(locationOptions, "All locations"),
    region: namedOptions(regionOptions, "All regions"),
  };

  const classOptions = db
    .prepare(
      `SELECT DISTINCT c.id, c.title || ' · ' || COALESCE(p.name, 'No Program') || ' · ' || replace(c.status, '_', ' ') AS label
         FROM class_instructors ci
         JOIN classes c ON c.id = ci.class_id
         LEFT JOIN programs p ON p.id = c.program_id
        WHERE ci.instructor_id = ?
        ORDER BY c.updated_at DESC LIMIT 250`,
    )
    .all(instructorId) as unknown as NamedOption[];
  const programOptions = db
    .prepare(
      `SELECT DISTINCT p.id, p.name || ' · ' || replace(p.stage, '_', ' ') AS label
         FROM class_instructors ci
         JOIN classes c ON c.id = ci.class_id
         JOIN programs p ON p.id = c.program_id
        WHERE ci.instructor_id = ?
        ORDER BY p.name LIMIT 250`,
    )
    .all(instructorId) as unknown as NamedOption[];
  const partnerOptions = db
    .prepare(
      `SELECT DISTINCT o.id, o.name AS label
         FROM class_instructors ci
         JOIN classes c ON c.id = ci.class_id
         JOIN organizations o ON o.id = c.partner_org_id
        WHERE ci.instructor_id = ?
        ORDER BY o.name LIMIT 250`,
    )
    .all(instructorId) as unknown as NamedOption[];
  const sessionRows = db
    .prepare(
      `SELECT cs.id, c.title, cs.session_date, COALESCE(cs.timezone, c.schedule_timezone) AS schedule_timezone
         FROM class_instructors ci
        JOIN classes c ON c.id = ci.class_id
        JOIN class_sessions cs ON cs.class_id = c.id
        WHERE ci.instructor_id = ? AND cs.session_date <= ?
          AND cs.session_date >= ci.added_at
          AND (ci.removed_at IS NULL OR cs.session_date < ci.removed_at)
        ORDER BY cs.session_date DESC LIMIT 250`,
    )
    .all(instructorId, now) as { id: string; title: string; session_date: number; schedule_timezone: string | null }[];
  const feedbackContextOptions: FeedbackContextOptions = {
    classes: classOptions,
    programs: programOptions,
    partners: partnerOptions,
    sessions: sessionRows.map((row) => ({
      id: row.id,
      label: `${row.title} · ${formatDateTimeInZone(row.session_date, row.schedule_timezone)}`,
    })),
  };

  const managerWork = db
    .prepare(
      `SELECT title, priority, due_at AS dueAt, due_on AS dueOn
         FROM tasks
        WHERE entity_type = 'instructor' AND entity_id = ? AND status = 'open'
        ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
                 CASE WHEN due_at IS NULL THEN 1 ELSE 0 END, due_at
        LIMIT 100`,
    )
    .all(instructorId) as { title: string; priority: string; dueAt: number | null; dueOn: string | null }[];

  const quality = qualitySummary(qualityAggregate);
  const nextAction = nextActionFor({ profile, qualifications, feedback, development, workload, reliability, work: managerWork });

  return {
    profile: {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      stage: profile.stage,
      progressionLevel: profile.progression_level,
      developmentFocus: profile.development_focus,
      maxWeeklyClasses: profile.max_weekly_classes,
    },
    currentAssignments: assignments.filter((assignment) => assignment.current),
    priorAssignments: assignments.filter((assignment) => !assignment.current),
    qualifications,
    feedback,
    development,
    availability,
    qualityDimensions: quality.dimensions,
    qualityTrend: quality.trend,
    reliability,
    workload,
    nextAction,
    qualificationOptions,
    feedbackContextOptions,
  };
}
