/* ============================================================
 * Browser-safe types and plain language for the partner Program record.
 *
 * A partner Program is the one place in V1 where extra structure is honest:
 * a school runs several sections, on a schedule somebody negotiated, with
 * staffing that may not be settled. The structure is real, so it is shown —
 * in the words the partner conversation actually uses, not in the stage
 * machine's vocabulary.
 * ============================================================ */

export interface ProgramSection {
  id: string;
  title: string;
  /** "Tuesdays 4:00–5:30 PM CT" — one line, already assembled. */
  scheduleLine: string | null;
  instructorNames: string[];
  seatsTaken: number;
  capacity: number | null;
  sessionsTotal: number;
  sessionsDone: number;
  nextSessionId: string | null;
  nextSessionOn: string | null;
  status: string;
  statusLabel: string;
}

/**
 * Something that will actually stop this Program running as planned.
 *
 * Not "a field is empty". A blocker earns amber; nothing else does.
 */
export interface ProgramBlocker {
  key: string;
  title: string;
  detail: string;
  actionLabel: string | null;
  actionHref: string | null;
}

/**
 * A decision nobody has made yet.
 *
 * Shown as a plain statement, never as a failure — a partner Program can be
 * entirely healthy while half of these are open, which is what the early
 * weeks of a school conversation look like.
 */
export interface ProgramOpenQuestion {
  key: string;
  label: string;
  /** null means undecided, which is a legitimate answer at this stage. */
  value: string | null;
}

export type RosterSource = "families" | "partner";

export interface PartnerProgramRecord {
  now: number;
  id: string;
  name: string;
  partnerId: string | null;
  partnerName: string | null;
  locationName: string | null;
  deliveryFormat: string;
  stage: string;
  statusLabel: string;
  /** One sentence saying where this Program actually is. */
  statusLine: string;
  courseId: string | null;
  courseTitle: string | null;
  rosterSource: RosterSource;
  scheduleLine: string | null;
  startDate: string | null;
  endDate: string | null;
  sections: ProgramSection[];
  seatsTaken: number;
  capacity: number | null;
  blockers: ProgramBlocker[];
  openQuestions: ProgramOpenQuestion[];
  next: { label: string; href: string | null } | null;
  isHistorical: boolean;
}

/** The stage machine's twelve values, in the four words a partner would use. */
export function programStatusLabel(stage: string): string {
  if (stage === "active") return "Running";
  if (stage === "ready_to_launch") return "Ready to start";
  if (["completed", "renewed", "closed"].includes(stage)) return "Finished";
  if (stage === "renewal_review") return "Up for renewal";
  if (stage === "paused") return "On hold";
  return "Being planned";
}

/**
 * Undecided facts only start blocking once somebody is trying to start.
 *
 * While a Program is being planned, "no instructor yet" is the normal state of
 * the world, not a failure — turning it amber the day the record is created
 * teaches the founder to ignore amber. Past that point the same fact is a real
 * problem, and it turns amber then.
 */
export function blockersApply(stage: string): boolean {
  return ["staffing", "enrollment", "recruiting", "ready_to_launch", "active"].includes(stage);
}

/**
 * Readiness keys that still mean something once a Program is running.
 *
 * The rest of the launch checklist is answered by the fact that classes are
 * meeting. A Program with children in the room does not need to be told a
 * launch date field is empty; it needs to be told a child cannot legally be
 * there or a section is about to fold. Amber that survives launch and means
 * nothing is how a record trains its reader to stop looking.
 */
const LIVE_DELIVERY_KEYS = new Set(["forms", "capacity", "eligible_instructor", "assignment_response", "first_session"]);

export function blockerAppliesAtStage(key: string, stage: string): boolean {
  if (!blockersApply(stage)) return false;
  if (stage === "active") return LIVE_DELIVERY_KEYS.has(key);
  return true;
}

export function programStatusLine(input: {
  stage: string;
  sections: number;
  seatsTaken: number;
  blockers: number;
  startDate: string | null;
}): string {
  if (["completed", "renewed", "closed"].includes(input.stage)) return "This Program has finished.";
  if (input.stage === "paused") return "On hold. Nothing runs while it stays that way.";
  if (input.stage === "active") {
    return `${input.sections} section${input.sections === 1 ? "" : "s"} running · ${input.seatsTaken} enrolled`;
  }
  if (input.blockers > 0) {
    return `${input.blockers} thing${input.blockers === 1 ? "" : "s"} would stop this starting.`;
  }
  if (input.sections === 0) return "No sections yet — the shape of this is still being decided.";
  // "Ready to start" is a claim, and only the stage that means it may make it.
  // A Program still being planned has a date somebody pencilled in, not a
  // commitment, and saying otherwise is how a record stops being trusted.
  if (input.startDate) {
    return input.stage === "ready_to_launch"
      ? `Ready to start ${input.startDate}.`
      : `Planned to start ${input.startDate}.`;
  }
  return "Being planned. Nothing is blocking it.";
}

export const ROSTER_SOURCE_LABEL: Record<RosterSource, string> = {
  families: "Families register themselves",
  partner: "The school sends the roster",
};

/** "Tue · 4:00–5:30 PM" from the pieces a class actually stores. */
export function scheduleLine(input: {
  label: string | null;
  startTime: string | null;
  endTime: string | null;
}): string | null {
  const time = input.startTime && input.endTime ? `${clock(input.startTime)}–${clock(input.endTime)}` : null;
  return [input.label, time].filter(Boolean).join(" · ") || null;
}

function clock(value: string): string {
  const hour = Number(value.slice(0, 2));
  const minute = value.slice(3, 5);
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${minute} ${suffix}`;
}
