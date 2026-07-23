/* ============================================================
 * BOW Operating System — browser-safe contracts and labels.
 *
 * Keep this module free of database and server-only imports. Client
 * Components can use these DTOs without pulling the operations DAL into the
 * browser bundle.
 * ============================================================ */

export const PROGRAM_STAGES = [
  "opportunity",
  "planning",
  "partner_confirmed",
  "recruiting",
  "staffing",
  "enrollment",
  "ready_to_launch",
  "active",
  "completed",
  "renewal_review",
  "renewed",
  "paused",
  "closed",
] as const;

export type ProgramStage = (typeof PROGRAM_STAGES)[number];
export type DeliveryFormat = "in_person" | "online" | "hybrid";
export type ReadinessState = "complete" | "blocked" | "warning" | "not_applicable";

const PROGRAM_TRANSITIONS: Record<ProgramStage, ProgramStage[]> = {
  opportunity: ["planning", "paused", "closed"],
  planning: ["partner_confirmed", "recruiting", "staffing", "paused", "closed"],
  partner_confirmed: ["recruiting", "staffing", "enrollment", "paused", "closed"],
  recruiting: ["staffing", "enrollment", "paused", "closed"],
  staffing: ["enrollment", "ready_to_launch", "paused", "closed"],
  enrollment: ["staffing", "ready_to_launch", "paused", "closed"],
  ready_to_launch: ["active", "staffing", "enrollment", "paused", "closed"],
  active: ["completed", "paused"],
  completed: ["renewal_review", "closed"],
  renewal_review: ["closed"],
  // Retained only for migrated records. Renewal is now a disposition plus a
  // child Program, not a reusable lifecycle stage.
  renewed: ["closed"],
  paused: ["planning", "staffing", "enrollment", "active", "closed"],
  closed: [],
};

export function allowedProgramTransitions(stage: ProgramStage): ProgramStage[] {
  return [...PROGRAM_TRANSITIONS[stage]];
}

export const LOCATION_STAGES = ["prospect", "evaluating", "launching", "active", "paused", "closed"] as const;
export type LocationStage = (typeof LOCATION_STAGES)[number];

export const PUBLIC_PROGRAM_STATUSES = ["coming_soon", "open", "full", "closed"] as const;
export type PublicProgramStatus = (typeof PUBLIC_PROGRAM_STATUSES)[number];

export const REGISTRATION_MODES = ["immediate", "approval"] as const;
export type RegistrationMode = (typeof REGISTRATION_MODES)[number];

export const FULL_CAPACITY_BEHAVIORS = ["close", "waitlist", "continue"] as const;
export type FullCapacityBehavior = (typeof FULL_CAPACITY_BEHAVIORS)[number];

export interface Program {
  id: string;
  requestKey: string | null;
  name: string;
  partnerOrgId: string | null;
  primaryContactPersonId: string | null;
  locationId: string | null;
  curriculumId: string | null;
  audience: string | null;
  deliveryFormat: DeliveryFormat;
  stage: ProgramStage;
  startDate: string | null;
  endDate: string | null;
  launchDate: string | null;
  scheduleLabel: string | null;
  scheduleDay: number | null;
  scheduleStartTime: string | null;
  scheduleEndTime: string | null;
  scheduleTimezone: string | null;
  capacity: number | null;
  minimumEnrollment: number;
  ownerUserId: string | null;
  partnerConfirmed: boolean;
  materialsStatus: "not_ready" | "ordered" | "ready";
  renewalStatus: string;
  sourceType: string | null;
  sourceId: string | null;
  parentProgramId: string | null;
  outcomeSummary: string | null;
  notes: string | null;
  launchExceptionReason: string | null;
  launchExceptionApprovedBy: string | null;
  launchExceptionApprovedAt: number | null;
  isPublic: boolean;
  publicStatus: PublicProgramStatus | null;
  shortDescription: string | null;
  longDescription: string | null;
  gradeRange: string | null;
  imageUrl: string | null;
  registrationMode: RegistrationMode;
  fullCapacityBehavior: FullCapacityBehavior;
  registrationDeadline: string | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * A parent never sees internal B2B stage names ("staffing", "renewal_review").
 * Public status is an explicit Founder-set field, defaulting to Coming Soon
 * the moment a Program is published, and automatically flips to Full once
 * confirmed registrations reach capacity.
 */
export function derivePublicStatus(
  program: Pick<Program, "isPublic" | "publicStatus" | "capacity">,
  confirmedCount: number,
): PublicProgramStatus | null {
  if (!program.isPublic) return null;
  const base = program.publicStatus ?? "coming_soon";
  if (base === "open" && program.capacity != null && confirmedCount >= program.capacity) return "full";
  return base;
}

export function publicStatusLabel(status: PublicProgramStatus): string {
  if (status === "coming_soon") return "Coming Soon";
  if (status === "open") return "Open";
  if (status === "full") return "Full";
  return "Closed";
}

export interface Location {
  id: string;
  name: string;
  type: string;
  region: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  timezone: string | null;
  parentLocationId: string | null;
  regionId: string | null;
  primaryLeaderUserId: string | null;
  stage: LocationStage;
  capacity: number | null;
  expectedDemand: number | null;
  rationale: string | null;
  earliestLaunchDate: string | null;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ReadinessItem {
  key: string;
  label: string;
  state: ReadinessState;
  detail: string;
  owner: string;
  actionLabel: string | null;
  actionHref: string | null;
}

export interface ProgramReadiness {
  percent: number;
  status: "ready" | "at_risk" | "in_progress";
  completedCount: number;
  totalCount: number;
  blockers: ReadinessItem[];
  warnings: ReadinessItem[];
  items: ReadinessItem[];
  primaryBlocker: string | null;
  nextAction: { label: string; href: string; owner: string } | null;
  canLaunch: boolean;
}

export interface ProgramSummary {
  program: Program;
  partnerName: string | null;
  locationName: string | null;
  curriculumTitle: string | null;
  ownerName: string | null;
  classCount: number;
  instructorCount: number;
  enrollmentCount: number;
  readiness: ProgramReadiness;
}

export interface StaffingRecommendation {
  instructorId: string;
  name: string;
  progressionLevel: string;
  tier: "strong" | "possible" | "blocked";
  rank: number;
  score: number;
  matches: string[];
  missing: string[];
  conflicts: string[];
  workload: number;
  maxWorkload: number;
  priorRelevantClasses: number;
  reliabilityNote: string;
  isAlreadyAssigned: boolean;
}

export function programStageLabel(stage: string): string {
  return stage
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatLabel(format: string): string {
  if (format === "in_person") return "In-person";
  if (format === "online") return "Online";
  if (format === "hybrid") return "Hybrid";
  return programStageLabel(format);
}

export function dayLabel(day: number | null): string {
  return day == null ? "Not set" : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day] ?? "Not set";
}
