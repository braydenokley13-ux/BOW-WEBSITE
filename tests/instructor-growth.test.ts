import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveNextOpportunities,
  impactHeadline,
  impactStats,
  rankStaffingCandidates,
  type InstructorImpact,
  type NextOpportunitySignal,
  type StaffingCandidate,
} from "@/lib/instructor-growth-shared";

function signal(overrides: Partial<NextOpportunitySignal>): NextOpportunitySignal {
  return {
    stage: "active",
    eligible: true,
    progressionLevel: "instructor",
    currentAssignmentCount: 1,
    upcomingSessionCount: 1,
    sessionsTaught: 5,
    programsLed: 0,
    qualityAverage: 4.2,
    lowReliabilitySignals: 0,
    instructorReferralsActivated: 0,
    partnerOpportunities: 0,
    hasActiveMission: true,
    currentAssignmentLoad: 1,
    maxWeeklyClasses: 3,
    lastActivityDays: 2,
    ...overrides,
  };
}

function keys(signalInput: NextOpportunitySignal): string[] {
  return deriveNextOpportunities(signalInput).map((opportunity) => opportunity.key);
}

test("eligible instructor who never taught needs a first assignment", () => {
  const result = keys(signal({ sessionsTaught: 0, currentAssignmentCount: 0, upcomingSessionCount: 0, hasActiveMission: false }));
  assert.ok(result.includes("first_assignment"));
});

test("sustained teaching with no lead role surfaces lead readiness", () => {
  const result = deriveNextOpportunities(signal({ sessionsTaught: 12, programsLed: 0, qualityAverage: 4.5 }));
  assert.ok(result.some((o) => o.key === "ready_to_lead" && o.kind === "ready"));
});

test("low experience is a develop signal, not a lead signal", () => {
  const result = keys(signal({ sessionsTaught: 2, programsLed: 0 }));
  assert.ok(result.includes("needs_experience"));
  assert.ok(!result.includes("ready_to_lead"));
});

test("specialization signals fire regardless of teaching cadence", () => {
  const recruiter = keys(signal({ eligible: false, instructorReferralsActivated: 3 }));
  assert.ok(recruiter.includes("strong_recruiter"));
  const expansion = keys(signal({ partnerOpportunities: 2 }));
  assert.ok(expansion.includes("growth_expansion"));
});

test("dormancy and overload are attention signals and sort first", () => {
  const dormant = deriveNextOpportunities(signal({ lastActivityDays: 45 }));
  assert.equal(dormant[0].kind, "attention");
  assert.ok(dormant.some((o) => o.key === "reengage"));

  const overloaded = deriveNextOpportunities(signal({ currentAssignmentLoad: 5, maxWeeklyClasses: 3 }));
  assert.ok(overloaded.some((o) => o.key === "overloaded" && o.kind === "attention"));
});

test("weak quality blocks a lead recommendation", () => {
  const result = keys(signal({ sessionsTaught: 12, programsLed: 0, qualityAverage: 3.0 }));
  assert.ok(!result.includes("ready_to_lead"));
});

test("rankStaffingCandidates excludes full and format-incapable instructors", () => {
  const pool: StaffingCandidate[] = [
    { instructorId: "a", personId: "pa", name: "Open Online", currentLoad: 1, maxWeeklyClasses: 3, onlineCapable: true, inPersonCapable: false, lowReliabilitySignals: 0, qualityAverage: 4, sessionsTaught: 10 },
    { instructorId: "b", personId: "pb", name: "Full", currentLoad: 3, maxWeeklyClasses: 3, onlineCapable: true, inPersonCapable: true, lowReliabilitySignals: 0, qualityAverage: 5, sessionsTaught: 20 },
    { instructorId: "c", personId: "pc", name: "In Person Only", currentLoad: 0, maxWeeklyClasses: 2, onlineCapable: false, inPersonCapable: true, lowReliabilitySignals: 0, qualityAverage: 4, sessionsTaught: 5 },
  ];
  const online = rankStaffingCandidates(pool, { online: true, inPerson: false });
  const names = online.map((candidate) => candidate.name);
  assert.ok(names.includes("Open Online"));
  assert.ok(!names.includes("Full")); // no headroom
  assert.ok(!names.includes("In Person Only")); // cannot serve online
});

test("rankStaffingCandidates ranks more headroom and reliability higher", () => {
  const pool: StaffingCandidate[] = [
    { instructorId: "a", personId: "pa", name: "Lots Of Room", currentLoad: 0, maxWeeklyClasses: 3, onlineCapable: true, inPersonCapable: true, lowReliabilitySignals: 0, qualityAverage: 4, sessionsTaught: 5 },
    { instructorId: "b", personId: "pb", name: "Little Room", currentLoad: 2, maxWeeklyClasses: 3, onlineCapable: true, inPersonCapable: true, lowReliabilitySignals: 0, qualityAverage: 5, sessionsTaught: 30 },
  ];
  const ranked = rankStaffingCandidates(pool, { online: false, inPerson: true });
  assert.equal(ranked[0].name, "Lots Of Room");
  assert.ok(ranked[0].fitNotes.length > 0);
});

test("impactHeadline is evidence-only and honest when empty", () => {
  const empty: InstructorImpact = { programsTaught: 0, programsLed: 0, sessionsTaught: 0, studentsReached: 0, missionsCompleted: 0, instructorReferralsActivated: 0, instructorReferralsTotal: 0, studentReferrals: 0, partnerOpportunities: 0 };
  assert.match(impactHeadline(empty), /No delivered contribution/);

  const real: InstructorImpact = { programsTaught: 3, programsLed: 1, sessionsTaught: 40, studentsReached: 25, missionsCompleted: 2, instructorReferralsActivated: 5, instructorReferralsTotal: 7, studentReferrals: 0, partnerOpportunities: 1 };
  const headline = impactHeadline(real);
  assert.match(headline, /40 sessions/);
  assert.match(headline, /25 students/);
  assert.match(headline, /5 active instructors/);
});

test("impactStats exposes all dimensions with headline flags", () => {
  const impact: InstructorImpact = { programsTaught: 1, programsLed: 0, sessionsTaught: 4, studentsReached: 8, missionsCompleted: 1, instructorReferralsActivated: 0, instructorReferralsTotal: 0, studentReferrals: 0, partnerOpportunities: 0 };
  const stats = impactStats(impact);
  assert.equal(stats.length, 8);
  assert.ok(stats.find((stat) => stat.key === "sessionsTaught")?.headline);
});
