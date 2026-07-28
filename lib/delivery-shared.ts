/* ============================================================
 * Delivery contracts — Program › Class › Session, instructor
 * assignments, and session preparation.
 *
 * Browser-safe: no database or server-only imports, so Client Components
 * can render these DTOs without pulling the DAL into the bundle. Mirrors
 * the convention already set by lib/operations-shared.ts.
 *
 * The three nouns are deliberately not interchangeable:
 *   Program — the opportunity students join.
 *   Class   — one group of students and instructors inside that Program.
 *   Session — one scheduled meeting of that Class.
 * ============================================================ */

export const SESSION_STATUSES = ["scheduled", "completed", "cancelled"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const PREP_STATUSES = ["not_started", "in_preparation", "ready"] as const;
export type PrepStatus = (typeof PREP_STATUSES)[number];

export const ASSIGNMENT_STATUSES = ["proposed", "accepted", "declined"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

/**
 * Roles exist only where the responsibilities actually differ. "Lead" owns
 * the class and its reporting; "co" shares delivery; "assistant" supports
 * without owning; "substitute" covers a single session. Anything beyond
 * these was an inflated title with no distinct duty attached.
 */
// `additional` is retained rather than renamed to `co`: it is the value
// already stored on every historical row and the one lib/operations.ts
// readiness reads. The label is the product-facing name.
export const ASSIGNMENT_ROLES = ["lead", "additional", "assistant", "substitute"] as const;
export type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number];

export function assignmentRoleLabel(role: string): string {
  if (role === "lead") return "Lead Instructor";
  if (role === "additional") return "Co-Instructor";
  if (role === "assistant") return "Assistant Instructor";
  if (role === "substitute") return "Substitute";
  return humanizeToken(role);
}

export function assignmentStatusLabel(status: string): string {
  if (status === "proposed") return "Awaiting response";
  if (status === "accepted") return "Accepted";
  if (status === "declined") return "Declined";
  return humanizeToken(status);
}

export function prepStatusLabel(status: string): string {
  if (status === "not_started") return "Not started";
  if (status === "in_preparation") return "In preparation";
  if (status === "ready") return "Ready";
  return humanizeToken(status);
}

export function sessionStatusLabel(status: string): string {
  return humanizeToken(status);
}

function humanizeToken(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * The preparation checklist an instructor works through before a session.
 * Kept short on purpose — every item is something a founder would actually
 * chase, and each is answerable in a second.
 */
export const PREP_CHECKLIST: { key: string; label: string; why: string }[] = [
  { key: "objective", label: "I know what this session must accomplish", why: "The objective is what the class is graded against, not the agenda." },
  { key: "materials", label: "I have reviewed the lesson and materials", why: "Materials missing at session time is the single most common delivery failure." },
  { key: "roster", label: "I have looked at who is in the room", why: "Student context changes how the session should be run." },
  { key: "logistics", label: "I can get into the room or meeting link", why: "Access problems cost the first ten minutes of class." },
];

export interface SessionPrep {
  sessionId: string;
  instructorId: string;
  instructorName: string | null;
  status: PrepStatus;
  checklist: { key: string; label: string; done: boolean }[];
  blockers: string | null;
  updatedAt: number | null;
}

export interface ClassSession {
  id: string;
  classId: string;
  sessionDate: number;
  sessionOn: string | null;
  timezone: string | null;
  location: string | null;
  meetingLink: string | null;
  title: string | null;
  objective: string | null;
  agenda: string | null;
  materials: string | null;
  lessonId: string | null;
  status: SessionStatus;
  cancellationReason: string | null;
  /** Derived from class_session_prep rows — never stored, never stale. */
  prepStatus: PrepStatus;
  attendanceRecorded: boolean;
  reportCompleted: boolean;
  createdAt: number;
}

export interface InstructorAssignment {
  id: string;
  classId: string;
  className: string;
  programId: string | null;
  programName: string | null;
  instructorId: string;
  instructorName: string | null;
  role: AssignmentRole | string;
  status: AssignmentStatus;
  expectedCommitment: string | null;
  startDate: string | null;
  proposedAt: number | null;
  respondedAt: number | null;
  responseNote: string | null;
}

/**
 * Rolls per-instructor preparation up to the session. A session is only
 * "ready" when every assigned instructor is ready — one prepared
 * co-instructor must not make an unprepared lead look covered.
 */
export function rollUpPrepStatus(preps: { status: PrepStatus }[], assignedCount: number): PrepStatus {
  if (assignedCount === 0 || preps.length === 0) return "not_started";
  const ready = preps.filter((p) => p.status === "ready").length;
  if (ready >= assignedCount) return "ready";
  if (preps.some((p) => p.status !== "not_started")) return "in_preparation";
  return "not_started";
}

/* ===================================================================== */
/* Instructor lifecycle                                                  */
/* ===================================================================== */

/**
 * The lifecycle BOW actually operates. `instructors.stage` is the single
 * source of truth for where someone is; `eligibility_status` and
 * `onboarding_status` are inputs to readiness, not parallel lifecycles.
 */
export const INSTRUCTOR_LIFECYCLE = [
  "applied",
  "reviewing",
  "interview_scheduled",
  "interviewed",
  "founder_review",
  "accepted",
  "onboarding",
  "eligible",
  "active",
  "paused",
  "inactive",
] as const;
export type InstructorLifecycleStage = (typeof INSTRUCTOR_LIFECYCLE)[number];

/** Stages where the person is still a candidate, not yet BOW's to deploy. */
export const CANDIDATE_STAGES = new Set<string>([
  "applied",
  "reviewing",
  "interview_scheduled",
  "interviewed",
  "founder_review",
]);

/** Stages where the person is accepted but not yet cleared to teach. */
export const PREPARING_STAGES = new Set<string>(["accepted", "onboarding"]);

/** Stages where the person may be given a class. */
export const DEPLOYABLE_STAGES = new Set<string>(["eligible", "active"]);

export function instructorStageLabel(stage: string): string {
  if (stage === "eligible") return "Ready";
  if (stage === "founder_review") return "Founder Review";
  return humanizeToken(stage);
}

export interface InstructorRequirement {
  key: string;
  label: string;
  done: boolean;
  detail: string;
  /** Where the instructor (not the founder) goes to satisfy it. */
  href: string | null;
}

export interface InstructorReadiness {
  /** True only when every requirement below is satisfied. */
  ready: boolean;
  requirements: InstructorRequirement[];
  outstanding: InstructorRequirement[];
  /** The single thing this instructor should do next, if anything. */
  nextRequirement: InstructorRequirement | null;
}

/* ===================================================================== */
/* Attention feed                                                        */
/* ===================================================================== */

export type AttentionSeverity = "blocker" | "warning" | "info";

/**
 * One thing a founder has to decide or chase. Every item names the record it
 * is about and where to go — an attention feed that cannot be acted on is
 * just another dashboard.
 */
export interface AttentionItem {
  key: string;
  severity: AttentionSeverity;
  title: string;
  detail: string;
  href: string;
  actionLabel: string;
  /** Sorts within a severity band; lower is more urgent. */
  rank: number;
  subjectId: string;
  subjectName: string;
}

export function sortAttention(items: AttentionItem[]): AttentionItem[] {
  const weight: Record<AttentionSeverity, number> = { blocker: 0, warning: 1, info: 2 };
  return [...items].sort((a, b) => weight[a.severity] - weight[b.severity] || a.rank - b.rank || a.title.localeCompare(b.title));
}

/* ===================================================================== */
/* Program pipeline grouping                                             */
/* ===================================================================== */

export type PipelineGroup =
  | "planning"
  | "needs_staffing"
  | "ready_to_launch"
  | "registration_open"
  | "running"
  | "recently_completed";

export const PIPELINE_GROUPS: { key: PipelineGroup; label: string; blurb: string }[] = [
  { key: "planning", label: "Planning", blurb: "Still being shaped — dates, format, and curriculum are being decided." },
  { key: "needs_staffing", label: "Needs staffing", blurb: "The plan is real but nobody is confirmed to teach it." },
  { key: "ready_to_launch", label: "Ready to launch", blurb: "Every launch requirement is met. Waiting on your go." },
  { key: "registration_open", label: "Registration open", blurb: "Published to families and taking enrollments." },
  { key: "running", label: "Running", blurb: "Delivering sessions now." },
  { key: "recently_completed", label: "Recently completed", blurb: "Finished in the last 60 days." },
];

/**
 * Maps the operating stage (plus staffing reality) onto the six groups a
 * founder actually thinks in. Deliberately not a 1:1 rename of
 * PROGRAM_STAGES: "needs staffing" is a fact about coverage, not a stage a
 * founder has to remember to set.
 */
export function pipelineGroupFor(input: {
  stage: string;
  isPublic: boolean;
  publicStatus: string | null;
  hasConfirmedLead: boolean;
  canLaunch: boolean;
  completedAt: number | null;
  now: number;
}): PipelineGroup | null {
  const { stage } = input;
  if (stage === "completed") {
    const sixtyDays = 60 * 24 * 60 * 60 * 1000;
    if (input.completedAt == null || input.now - input.completedAt <= sixtyDays) return "recently_completed";
    return null;
  }
  if (stage === "active") return "running";
  if (stage === "closed" || stage === "paused" || stage === "renewal_review" || stage === "renewed") return null;
  if (input.isPublic && input.publicStatus === "open") return "registration_open";
  if (stage === "ready_to_launch" || input.canLaunch) return "ready_to_launch";
  if (!input.hasConfirmedLead && stage !== "opportunity") return "needs_staffing";
  return "planning";
}
