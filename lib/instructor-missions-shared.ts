/* ============================================================
 * Instructor Current Mission — client-safe contracts & pure logic.
 *
 * Constants, types, validators, and the deterministic activation-exception
 * derivation shared by the server loader (lib/instructor-missions.ts), the
 * server actions, and the client controls. No database or server-only imports
 * live here, so this module is unit-testable and safe in a Client Component.
 * ============================================================ */

export type MissionArea =
  | "teaching"
  | "student_growth"
  | "instructor_recruitment"
  | "partner_expansion"
  | "curriculum"
  | "content_media"
  | "program_operations";

export type MissionCadence = "once" | "weekly" | "biweekly" | "monthly";
export type MissionStatus = "active" | "completed" | "cancelled";
export type MissionCompletionOutcome = "delivered" | "partial" | "abandoned";
export type MissionUpdateKind = "progress" | "evidence" | "feedback" | "status_change";
export type MissionRelatedEntity = "class" | "program" | "organization";

export interface MissionAreaMeta {
  id: MissionArea;
  label: string;
  /** One line the instructor reads: what this kind of mission is about. */
  description: string;
  /** The growth loop this responsibility feeds, for the founder view. */
  contribution: string;
}

/**
 * The responsibility areas a Current Mission can belong to. Teaching is one
 * area, not the only one — an instructor who is not currently in front of
 * students can still carry a real, measurable mission that grows BOW.
 */
export const MISSION_AREAS: readonly MissionAreaMeta[] = [
  { id: "teaching", label: "Teaching", description: "Deliver a class or session series with strong student experience.", contribution: "Delivers value to students" },
  { id: "student_growth", label: "Student growth", description: "Bring new students or families into a program.", contribution: "Attracts the right people" },
  { id: "instructor_recruitment", label: "Instructor recruitment", description: "Refer and help evaluate new instructor candidates.", contribution: "Expands the instructor base" },
  { id: "partner_expansion", label: "School / partner expansion", description: "Open or advance a school, camp, or community opportunity.", contribution: "Creates partner opportunities" },
  { id: "curriculum", label: "Curriculum & testing", description: "Build, test, or improve curriculum and learning material.", contribution: "Improves what BOW delivers" },
  { id: "content_media", label: "Content & media", description: "Produce content or media that tells the BOW story.", contribution: "Fuels awareness and demand" },
  { id: "program_operations", label: "Program operations", description: "Run logistics, readiness, or coordination for a program.", contribution: "Makes programs ready to run" },
] as const;

export const MISSION_CADENCES: readonly { id: MissionCadence; label: string }[] = [
  { id: "once", label: "One-time" },
  { id: "weekly", label: "Weekly" },
  { id: "biweekly", label: "Every two weeks" },
  { id: "monthly", label: "Monthly" },
] as const;

export const MISSION_COMPLETION_OUTCOMES: readonly { id: MissionCompletionOutcome; label: string; tone: "positive" | "warning" | "neutral" }[] = [
  { id: "delivered", label: "Delivered", tone: "positive" },
  { id: "partial", label: "Partially delivered", tone: "warning" },
  { id: "abandoned", label: "Not delivered", tone: "neutral" },
] as const;

export const MISSION_UPDATE_KIND_LABEL: Record<MissionUpdateKind, string> = {
  progress: "Progress",
  evidence: "Evidence",
  feedback: "Feedback",
  status_change: "Status",
};

const AREA_IDS = new Set<string>(MISSION_AREAS.map((area) => area.id));
const CADENCE_IDS = new Set<string>(MISSION_CADENCES.map((cadence) => cadence.id));
const OUTCOME_IDS = new Set<string>(MISSION_COMPLETION_OUTCOMES.map((outcome) => outcome.id));
const RELATED_IDS = new Set<string>(["class", "program", "organization"]);

export function isMissionArea(value: unknown): value is MissionArea {
  return typeof value === "string" && AREA_IDS.has(value);
}
export function isMissionCadence(value: unknown): value is MissionCadence {
  return typeof value === "string" && CADENCE_IDS.has(value);
}
export function isMissionCompletionOutcome(value: unknown): value is MissionCompletionOutcome {
  return typeof value === "string" && OUTCOME_IDS.has(value);
}
export function isMissionRelatedEntity(value: unknown): value is MissionRelatedEntity {
  return typeof value === "string" && RELATED_IDS.has(value);
}

export function missionAreaMeta(area: string): MissionAreaMeta {
  return (
    MISSION_AREAS.find((entry) => entry.id === area) ?? {
      id: "teaching",
      label: area.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      description: "Responsibility area.",
      contribution: "Contributes to BOW growth",
    }
  );
}

/** A due date has passed when its calendar day is before today (zone-agnostic YYYY-MM-DD compare). */
export function missionIsOverdue(dueOn: string | null | undefined, today: string): boolean {
  return Boolean(dueOn) && dueOn! < today;
}

/* ---------------- domain shapes ---------------- */

export interface InstructorMission {
  id: string;
  instructorId: string;
  area: MissionArea;
  title: string;
  outcome: string;
  cadence: MissionCadence;
  status: MissionStatus;
  dueOn: string | null;
  relatedEntityType: MissionRelatedEntity | null;
  relatedEntityId: string | null;
  relatedEntityLabel: string | null;
  assignedByName: string | null;
  completionOutcome: MissionCompletionOutcome | null;
  completionNote: string | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export interface MissionUpdate {
  id: string;
  missionId: string;
  authorName: string | null;
  authorKind: "instructor" | "staff" | "system";
  kind: MissionUpdateKind;
  body: string;
  createdAt: number;
}

/* ---------------- activation derivation (pure) ---------------- */

/**
 * The lightweight per-instructor facts the activation engine needs. Kept tiny
 * and free of DB rows so the ranking logic is deterministic and testable.
 */
export interface InstructorActivationRow {
  instructorId: string;
  personId: string;
  name: string;
  stage: string;
  eligible: boolean;
  onboardingStatus: string;
  /** When the instructor entered the pipeline / was created. */
  createdAt: number;
  /** When a founder decision (acceptance) was recorded, if any. */
  decidedAt: number | null;
  hasActiveMission: boolean;
  currentAssignmentCount: number;
  upcomingSessionCount: number;
  /** Newest of: record update, last delivered session, last mission update. */
  lastActivityAt: number;
}

export type ActivationKind =
  | "accepted_not_activated"
  | "onboarding_stalled"
  | "ready_without_assignment"
  | "active_without_mission"
  | "dormant";

export type ActivationSeverity = "critical" | "high" | "watch";

export interface ActivationException {
  key: string;
  instructorId: string;
  personId: string;
  name: string;
  kind: ActivationKind;
  severity: ActivationSeverity;
  title: string;
  detail: string;
  ageDays: number;
  /** Higher sorts first. */
  score: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_CLASS_STAGES = new Set(["eligible", "active"]);

export interface ActivationThresholds {
  onboardingStallDays: number;
  dormantDays: number;
}

export const DEFAULT_ACTIVATION_THRESHOLDS: ActivationThresholds = {
  onboardingStallDays: 14,
  dormantDays: 30,
};

function ageInDays(now: number, since: number): number {
  return Math.max(0, Math.floor((now - since) / DAY_MS));
}

/**
 * The activation engine. Given the current instructor population, derive the
 * ranked "who is not moving forward" queue: accepted-but-not-activated,
 * onboarding-stalled, ready-but-unassigned, active-without-a-mission, and
 * dormant. One exception per instructor (their most consequential gap), so the
 * founder never sees the same person five times.
 *
 * Pure and deterministic — the server loader supplies the rows; this decides
 * what matters and in what order.
 */
export function deriveInstructorActivationExceptions(
  rows: InstructorActivationRow[],
  now: number,
  thresholds: ActivationThresholds = DEFAULT_ACTIVATION_THRESHOLDS,
): ActivationException[] {
  const exceptions: ActivationException[] = [];

  for (const row of rows) {
    const acceptedAt = row.decidedAt ?? row.createdAt;

    // 1. Accepted but never activated — the single most important activation
    //    gap. "Accepted" is the start of activation, not the end of recruiting.
    if (row.stage === "accepted") {
      const age = ageInDays(now, acceptedAt);
      exceptions.push({
        key: `activation:accepted:${row.instructorId}`,
        instructorId: row.instructorId,
        personId: row.personId,
        name: row.name,
        kind: "accepted_not_activated",
        severity: age >= 7 ? "critical" : "high",
        title: `${row.name} is accepted but not activated`,
        detail:
          age === 0
            ? "Accepted today. Start onboarding and give a first Current Mission before momentum fades."
            : `Accepted ${age} day${age === 1 ? "" : "s"} ago with onboarding not yet moving. Start onboarding and assign a first mission.`,
        ageDays: age,
        score: 400 + Math.min(age, 30),
      });
      continue;
    }

    // 2. Onboarding / training stalled past the threshold.
    if ((row.stage === "onboarding" || row.stage === "training")) {
      const age = ageInDays(now, row.lastActivityAt);
      if (age >= thresholds.onboardingStallDays) {
        exceptions.push({
          key: `activation:onboarding:${row.instructorId}`,
          instructorId: row.instructorId,
          personId: row.personId,
          name: row.name,
          kind: "onboarding_stalled",
          severity: "high",
          title: `${row.name} is stuck in onboarding`,
          detail: `No onboarding or training progress in ${age} days. Unblock the next step or reset expectations.`,
          ageDays: age,
          score: 300 + Math.min(age, 40),
        });
      }
      continue;
    }

    // Eligible / active instructors: deployment + mission + dormancy.
    if (ACTIVE_CLASS_STAGES.has(row.stage) && row.eligible) {
      const notDeployed = row.currentAssignmentCount === 0 && row.upcomingSessionCount === 0;

      // 3. Ready to teach but sitting on the bench — no assignment, no mission.
      if (notDeployed && !row.hasActiveMission) {
        const age = ageInDays(now, row.lastActivityAt);
        exceptions.push({
          key: `activation:ready:${row.instructorId}`,
          instructorId: row.instructorId,
          personId: row.personId,
          name: row.name,
          kind: "ready_without_assignment",
          severity: age >= 14 ? "critical" : "high",
          title: `${row.name} is ready but unused`,
          detail: "Eligible to teach with no current assignment and no Current Mission. Assign a class or a growth mission.",
          ageDays: age,
          score: 320 + Math.min(age, 40),
        });
        continue;
      }

      // 4. Dormant — active but no activity for a month.
      if (row.stage === "active") {
        const dormantAge = ageInDays(now, row.lastActivityAt);
        if (dormantAge >= thresholds.dormantDays) {
          exceptions.push({
            key: `activation:dormant:${row.instructorId}`,
            instructorId: row.instructorId,
            personId: row.personId,
            name: row.name,
            kind: "dormant",
            severity: dormantAge >= 60 ? "high" : "watch",
            title: `${row.name} is going dormant`,
            detail: `No teaching, mission, or record activity in ${dormantAge} days. Re-engage with a conversation or a new mission.`,
            ageDays: dormantAge,
            score: 180 + Math.min(dormantAge, 60),
          });
          continue;
        }
      }

      // 5. Contributing (deployed or has a mission) but no Current Mission set.
      if (!row.hasActiveMission) {
        exceptions.push({
          key: `activation:mission:${row.instructorId}`,
          instructorId: row.instructorId,
          personId: row.personId,
          name: row.name,
          kind: "active_without_mission",
          severity: "watch",
          title: `${row.name} has no Current Mission`,
          detail: "Active instructor with no headline responsibility recorded. Set a Current Mission so their contribution is explicit.",
          ageDays: ageInDays(now, row.lastActivityAt),
          score: 140,
        });
      }
    }
  }

  return exceptions.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
