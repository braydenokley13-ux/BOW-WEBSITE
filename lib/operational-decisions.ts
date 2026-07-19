import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { StaffingRecommendation } from "@/lib/operations-shared";
import { hashOpaqueToken } from "@/lib/security-tokens";

type RecommendationEvidence = Pick<
  StaffingRecommendation,
  | "tier"
  | "score"
  | "missing"
  | "conflicts"
  | "workload"
  | "maxWorkload"
  | "priorRelevantClasses"
  | "reliabilityNote"
  | "isAlreadyAssigned"
>;

export interface ClassStaffingRecommendationFingerprintInput {
  programId: string;
  classId: string;
  instructorId: string;
  role: "lead" | "additional";
  classStatus: string;
  recommendation: RecommendationEvidence;
}

/**
 * Hash the decision-relevant recommendation facts, not presentation order.
 * The target assignment's own workload effect is normalized so the evidence
 * recorded immediately before assignment still matches immediately afterward.
 */
export function classStaffingRecommendationFingerprint(
  input: ClassStaffingRecommendationFingerprintInput,
): string {
  const targetCountsTowardWorkload = ["staffing", "ready_to_launch", "active"].includes(input.classStatus);
  const effectiveWorkload = input.recommendation.workload
    + (targetCountsTowardWorkload && !input.recommendation.isAlreadyAssigned ? 1 : 0);
  const workloadConflictPrefix = "At workload limit (";
  const hadRawWorkloadConflict = input.recommendation.conflicts.some((conflict) =>
    conflict.startsWith(workloadConflictPrefix)
  );
  const conflicts = input.recommendation.conflicts
    .filter((conflict) => !conflict.startsWith(workloadConflictPrefix));
  if (effectiveWorkload > input.recommendation.maxWorkload) {
    conflicts.push(`At workload limit (${effectiveWorkload}/${input.recommendation.maxWorkload})`);
  }
  const targetCountsAsPriorExperience = ["active", "completed"].includes(input.classStatus)
    && input.recommendation.isAlreadyAssigned;
  const effectivePriorRelevantClasses = Math.max(
    0,
    input.recommendation.priorRelevantClasses - (targetCountsAsPriorExperience ? 1 : 0),
  );
  const rawPriorExperienceBonus = Math.min(5, input.recommendation.priorRelevantClasses * 2);
  const effectivePriorExperienceBonus = Math.min(5, effectivePriorRelevantClasses * 2);
  const normalizedScore = input.recommendation.score
    - (hadRawWorkloadConflict ? 0 : 3)
    + (effectiveWorkload <= input.recommendation.maxWorkload ? 3 : 0)
    - rawPriorExperienceBonus
    + effectivePriorExperienceBonus;
  const tier = input.recommendation.tier === "blocked"
    ? "blocked"
    : input.recommendation.missing.length > 0 || conflicts.length > 0
      ? "possible"
      : "strong";
  return hashOpaqueToken(
    JSON.stringify({
      version: "bow.class-staffing-recommendation.v1",
      programId: input.programId,
      classId: input.classId,
      instructorId: input.instructorId,
      role: input.role,
      tier,
      score: normalizedScore,
      missing: [...input.recommendation.missing].sort(),
      conflicts: conflicts.sort(),
      effectiveWorkload,
      maxWorkload: input.recommendation.maxWorkload,
      priorRelevantClasses: effectivePriorRelevantClasses,
      reliabilityNote: input.recommendation.reliabilityNote,
    }),
  );
}

export interface ClassStaffingDecisionInput {
  classId: string;
  instructorId: string;
  assignmentId: string;
  action: "assigned" | "role_changed" | "removed";
  role: "lead" | "additional";
  reason: string;
  actorUserId: string;
  decidedAt: number;
  programId?: string | null;
  recommendationFingerprint?: string | null;
}

export function classStaffingDecisionFingerprint(
  input: ClassStaffingDecisionInput & { decisionId: string },
): string {
  return hashOpaqueToken(
    JSON.stringify({
      decisionId: input.decisionId,
      classId: input.classId,
      assignmentId: input.assignmentId,
      action: input.action,
      instructorId: input.instructorId,
      role: input.role,
      reason: input.reason,
      actorUserId: input.actorUserId,
      decidedAt: input.decidedAt,
      programId: input.programId ?? null,
      ...(input.recommendationFingerprint
        ? { recommendationFingerprint: input.recommendationFingerprint }
        : {}),
    }),
  );
}

/**
 * Appends the durable decision record behind a Class staffing mutation.
 * Call this inside the same transaction that changes class_instructors.
 */
export function recordClassStaffingDecision(
  db: DatabaseSync,
  input: ClassStaffingDecisionInput,
): { decisionId: string; fingerprint: string } {
  if (
    input.recommendationFingerprint != null
    && !/^[0-9a-f]{64}$/.test(input.recommendationFingerprint)
  ) {
    throw new Error("Staffing recommendation fingerprint is malformed.");
  }
  const decisionId = `opd-${randomUUID()}`;
  const decision = {
    action: input.action,
    instructorId: input.instructorId,
    role: input.role,
  };
  const fingerprint = classStaffingDecisionFingerprint({ ...input, decisionId });
  db.prepare(
    `INSERT INTO operational_decisions
      (id, entity_type, entity_id, decision_type, decision, reason, fingerprint,
       decided_by_user_id, decided_at, metadata)
     VALUES (?, 'class', ?, 'instructor_assignment', ?, ?, ?, ?, ?, ?)`,
  ).run(
    decisionId,
    input.classId,
    JSON.stringify(decision),
    input.reason,
    fingerprint,
    input.actorUserId,
    input.decidedAt,
    JSON.stringify({
      assignmentId: input.assignmentId,
      programId: input.programId ?? null,
      ...(input.recommendationFingerprint
        ? { recommendationFingerprint: input.recommendationFingerprint }
        : {}),
    }),
  );
  return { decisionId, fingerprint };
}
