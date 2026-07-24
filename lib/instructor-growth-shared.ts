/* ============================================================
 * Instructor growth — client-safe contracts & pure logic.
 *
 * The derived impact record, the evidence-based "Next Opportunity"
 * recommendations, and the staffing-candidate ranking. No database or
 * server-only imports, so every rule here is deterministic and unit-testable.
 * The system SURFACES evidence and recommendations; humans still make the
 * promotion, acceptance, and assignment decisions.
 * ============================================================ */

/* ---------------- impact record ---------------- */

export interface InstructorImpact {
  /** Distinct programs the instructor has delivered a class within. */
  programsTaught: number;
  /** Distinct programs where they held the lead role. */
  programsLed: number;
  /** Distinct delivered sessions (session date on/before now, within their assignment window). */
  sessionsTaught: number;
  /** Distinct students enrolled in classes they taught. */
  studentsReached: number;
  /** Missions completed (delivered or partial). */
  missionsCompleted: number;
  /** Instructors they referred who reached the active stage. */
  instructorReferralsActivated: number;
  /** Total instructors they referred (any stage), for context. */
  instructorReferralsTotal: number;
  /** Attributable student referrals (non-voided). */
  studentReferrals: number;
  /** School / partner / community opportunities they originated that converted. */
  partnerOpportunities: number;
}

export interface ImpactStat {
  key: keyof InstructorImpact;
  label: string;
  value: number;
  /** Whether this stat is worth showing when zero (headline vs contextual). */
  headline: boolean;
}

/** Ordered, labelled impact stats for display — a truthful, derived record. */
export function impactStats(impact: InstructorImpact): ImpactStat[] {
  return [
    { key: "sessionsTaught", label: "Sessions taught", value: impact.sessionsTaught, headline: true },
    { key: "studentsReached", label: "Students reached", value: impact.studentsReached, headline: true },
    { key: "programsTaught", label: "Programs taught", value: impact.programsTaught, headline: true },
    { key: "programsLed", label: "Programs led", value: impact.programsLed, headline: false },
    { key: "missionsCompleted", label: "Missions completed", value: impact.missionsCompleted, headline: true },
    { key: "instructorReferralsActivated", label: "Instructors referred (now active)", value: impact.instructorReferralsActivated, headline: false },
    { key: "studentReferrals", label: "Student referrals", value: impact.studentReferrals, headline: false },
    { key: "partnerOpportunities", label: "Partner opportunities opened", value: impact.partnerOpportunities, headline: false },
  ];
}

/** A one-line, evidence-only impact summary — no vanity, no invented numbers. */
export function impactHeadline(impact: InstructorImpact): string {
  const parts: string[] = [];
  if (impact.sessionsTaught > 0) parts.push(`taught ${impact.sessionsTaught} session${impact.sessionsTaught === 1 ? "" : "s"}`);
  if (impact.studentsReached > 0) parts.push(`reached ${impact.studentsReached} student${impact.studentsReached === 1 ? "" : "s"}`);
  if (impact.programsLed > 0) parts.push(`led ${impact.programsLed} program${impact.programsLed === 1 ? "" : "s"}`);
  else if (impact.programsTaught > 0) parts.push(`across ${impact.programsTaught} program${impact.programsTaught === 1 ? "" : "s"}`);
  if (impact.missionsCompleted > 0) parts.push(`completed ${impact.missionsCompleted} mission${impact.missionsCompleted === 1 ? "" : "s"}`);
  if (impact.instructorReferralsActivated > 0) parts.push(`recruited ${impact.instructorReferralsActivated} active instructor${impact.instructorReferralsActivated === 1 ? "" : "s"}`);
  if (impact.partnerOpportunities > 0) parts.push(`opened ${impact.partnerOpportunities} partner opportunit${impact.partnerOpportunities === 1 ? "y" : "ies"}`);
  if (parts.length === 0) return "No delivered contribution recorded yet.";
  const sentence = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
  return `Has ${sentence}.`;
}

/* ---------------- next opportunity / development ---------------- */

export interface NextOpportunitySignal {
  stage: string;
  eligible: boolean;
  progressionLevel: string;
  currentAssignmentCount: number;
  upcomingSessionCount: number;
  sessionsTaught: number;
  programsLed: number;
  /** Recent composite quality average (1–5), or null when there is no evidence. */
  qualityAverage: number | null;
  lowReliabilitySignals: number;
  instructorReferralsActivated: number;
  partnerOpportunities: number;
  hasActiveMission: boolean;
  currentAssignmentLoad: number;
  maxWeeklyClasses: number;
  lastActivityDays: number;
}

export type OpportunityKind = "ready" | "develop" | "attention";

export interface NextOpportunity {
  key: string;
  label: string;
  rationale: string;
  kind: OpportunityKind;
  /** Higher sorts first within its kind grouping. */
  weight: number;
}

const KIND_ORDER: Record<OpportunityKind, number> = { attention: 0, ready: 1, develop: 2 };
const READY_QUALITY_FLOOR = 4;
const LEAD_SESSION_FLOOR = 8;
const EXPERIENCE_SESSION_FLOOR = 4;

/**
 * Evidence-based development signals. These are recommendations a founder acts
 * on, never automatic promotions: each carries the concrete reason it fired.
 * One instructor can legitimately show several (e.g. "ready to lead" AND
 * "strong recruiter") — specialization is allowed, not a single ladder.
 */
export function deriveNextOpportunities(signal: NextOpportunitySignal): NextOpportunity[] {
  const out: NextOpportunity[] = [];
  const qualityOk = signal.qualityAverage == null || signal.qualityAverage >= READY_QUALITY_FLOOR;
  const reliable = signal.lowReliabilitySignals === 0;
  const activeStage = signal.stage === "active" || signal.stage === "eligible";

  // Attention — someone is stalled or overloaded.
  if (activeStage && signal.stage === "active" && signal.lastActivityDays >= 30) {
    out.push({ key: "reengage", label: "Needs re-engagement", kind: "attention", weight: 90, rationale: `No teaching, mission, or record activity in ${signal.lastActivityDays} days.` });
  }
  if (signal.currentAssignmentLoad > signal.maxWeeklyClasses) {
    out.push({ key: "overloaded", label: "Overloaded — rebalance", kind: "attention", weight: 85, rationale: `Assigned ${signal.currentAssignmentLoad} classes against a stated limit of ${signal.maxWeeklyClasses}.` });
  }

  if (signal.eligible) {
    const notDeployed = signal.currentAssignmentCount === 0 && signal.upcomingSessionCount === 0;
    if (notDeployed && signal.sessionsTaught === 0) {
      out.push({ key: "first_assignment", label: "Needs first teaching assignment", kind: "attention", weight: 80, rationale: "Eligible to teach but has never been assigned a class." });
    } else if (notDeployed && signal.sessionsTaught > 0) {
      out.push({ key: "ready_next_class", label: "Ready for another class", kind: "ready", weight: 70, rationale: `Has taught ${signal.sessionsTaught} sessions and is currently unassigned.` });
    }

    // Leadership readiness — evidence only; the founder decides.
    if (signal.programsLed === 0 && signal.sessionsTaught >= LEAD_SESSION_FLOOR && qualityOk && reliable) {
      out.push({ key: "ready_to_lead", label: "Ready to lead a program", kind: "ready", weight: 65, rationale: `${signal.sessionsTaught} sessions taught with strong quality and reliability, not yet leading.` });
    } else if (signal.eligible && signal.programsLed === 0 && signal.sessionsTaught > 0 && signal.sessionsTaught < EXPERIENCE_SESSION_FLOOR) {
      out.push({ key: "needs_experience", label: "Build more teaching reps", kind: "develop", weight: 40, rationale: `Only ${signal.sessionsTaught} sessions so far — more experience before leading.` });
    }

    if (signal.programsLed >= 2 && qualityOk && signal.progressionLevel !== "mentor") {
      out.push({ key: "mentor_candidate", label: "Mentor candidate", kind: "ready", weight: 60, rationale: `Has led ${signal.programsLed} programs with strong quality — could mentor new instructors.` });
    }

    if (!signal.hasActiveMission && !notDeployed) {
      out.push({ key: "set_mission", label: "Set a Current Mission", kind: "develop", weight: 35, rationale: "Contributing without a headline responsibility recorded." });
    }
  }

  // Specialization signals apply regardless of teaching cadence.
  if (signal.instructorReferralsActivated >= 2) {
    out.push({ key: "strong_recruiter", label: "Strong recruiting contributor", kind: "ready", weight: 55, rationale: `Referred ${signal.instructorReferralsActivated} instructors who became active — consider a recruitment mission.` });
  }
  if (signal.partnerOpportunities >= 1) {
    out.push({ key: "growth_expansion", label: "Growth / expansion opportunity", kind: "ready", weight: 50, rationale: `Originated ${signal.partnerOpportunities} partner opportunit${signal.partnerOpportunities === 1 ? "y" : "ies"} — consider an expansion mission.` });
  }

  return out.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.weight - a.weight);
}

/* ---------------- staffing candidate ranking ---------------- */

export interface StaffingCandidate {
  instructorId: string;
  personId: string;
  name: string;
  currentLoad: number;
  maxWeeklyClasses: number;
  onlineCapable: boolean;
  inPersonCapable: boolean;
  lowReliabilitySignals: number;
  qualityAverage: number | null;
  sessionsTaught: number;
}

export interface StaffingNeed {
  online: boolean;
  inPerson: boolean;
}

export interface RankedCandidate extends StaffingCandidate {
  /** Remaining weekly capacity (never negative). */
  headroom: number;
  score: number;
  fitNotes: string[];
}

/**
 * Rank eligible instructors for an open staffing need — a strong filtered
 * recommendation, not "AI matching." Instructors already at or over capacity,
 * or who cannot serve the required format, are excluded. Remaining candidates
 * sort by open capacity, then reliability, then quality, then experience.
 */
export function rankStaffingCandidates(candidates: StaffingCandidate[], need: StaffingNeed): RankedCandidate[] {
  const ranked: RankedCandidate[] = [];
  for (const candidate of candidates) {
    const headroom = Math.max(0, candidate.maxWeeklyClasses - candidate.currentLoad);
    if (headroom === 0) continue;
    if (need.online && !need.inPerson && !candidate.onlineCapable) continue;
    if (need.inPerson && !need.online && !candidate.inPersonCapable) continue;

    const fitNotes: string[] = [];
    fitNotes.push(`${headroom} open slot${headroom === 1 ? "" : "s"}`);
    if (candidate.sessionsTaught > 0) fitNotes.push(`${candidate.sessionsTaught} sessions taught`);
    if (candidate.lowReliabilitySignals > 0) fitNotes.push(`${candidate.lowReliabilitySignals} reliability flag${candidate.lowReliabilitySignals === 1 ? "" : "s"}`);

    const score =
      headroom * 100 -
      candidate.lowReliabilitySignals * 40 +
      (candidate.qualityAverage ?? 3) * 8 +
      Math.min(candidate.sessionsTaught, 20);
    ranked.push({ ...candidate, headroom, score, fitNotes });
  }
  return ranked.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
