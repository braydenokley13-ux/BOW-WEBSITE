/* ============================================================
 * Browser-safe types and plain language for Partners.
 *
 * Partners answers one question — who do I need to follow up with — so
 * everything here is shaped by that. There is no pipeline, no stage, no
 * probability. A relationship is either running, being scoped, on hold, or
 * finished, and the words are the ones a founder would say out loud.
 * ============================================================ */

export type PartnerStanding = "running" | "scoping" | "paused" | "past";

export interface PartnerFollowUp {
  taskId: string;
  title: string;
  /** Canonical YYYY-MM-DD. Follow-ups are dated in days, never timestamps. */
  dueOn: string | null;
  overdue: boolean;
  dueToday: boolean;
}

export interface PartnerRow {
  id: string;
  name: string;
  type: string;
  location: string | null;
  status: string;
  standing: PartnerStanding;
  /** "Running now" · "Still deciding" · "Between programs" · "On hold" · "Past partner" */
  standingLabel: string;
  nextFollowUp: PartnerFollowUp | null;
  lastTouchAt: number | null;
  lastTouch: string | null;
  runningClasses: number;
  /** Unanswered inquiries and demo requests belonging to this partner. */
  waiting: number;
}

export type InboxKind = "follow_up" | "inquiry" | "demo_request";

export interface InboxItem {
  key: string;
  kind: InboxKind;
  /** The human, not the record. */
  who: string;
  /** The organization they belong to, when one is known. */
  org: string | null;
  organizationId: string | null;
  /** What they actually said, trimmed to something readable in a row. */
  said: string | null;
  /** When they got in touch, or when the follow-up came due. */
  at: number;
  /** Days this has been waiting for a person. Negative means not due yet. */
  waitingDays: number;
  email: string | null;
  href: string | null;
  inquiryId: string | null;
  demoRequestId: string | null;
  taskId: string | null;
  dueOn: string | null;
}

export interface PartnerContact {
  personId: string;
  name: string;
  email: string | null;
  phone: string | null;
  /** "main contact", "athletic director" — whatever the relationship says. */
  roles: string[];
  primary: boolean;
}

export interface PartnerProgramLine {
  id: string;
  name: string;
  stage: string;
  /** Plain-language stage: "Running", "Getting ready", "Finished". */
  stageLabel: string;
  running: boolean;
  classes: number;
  students: number;
  startDate: string | null;
}

export interface PartnerActivityLine {
  id: string;
  kind: string;
  body: string;
  at: number;
  actor: string | null;
}

export interface PartnerRecord {
  now: number;
  id: string;
  name: string;
  type: string;
  location: string | null;
  status: string;
  standing: PartnerStanding;
  standingLabel: string;
  /** One sentence saying where the relationship actually is. */
  standingLine: string;
  nextFollowUp: PartnerFollowUp | null;
  laterFollowUps: PartnerFollowUp[];
  contacts: PartnerContact[];
  programs: PartnerProgramLine[];
  activity: PartnerActivityLine[];
  inbox: InboxItem[];
}

const STANDING_LABEL: Record<PartnerStanding, string> = {
  running: "Running now",
  scoping: "Still deciding",
  paused: "On hold",
  past: "Past partner",
};

/**
 * Where a relationship actually is.
 *
 * The Ramaz case is the reason this exists: a partnership can be entirely
 * real while the format, the sections, the dates and the staffing are all
 * still open. That is "Still deciding" — a normal state with a name — not an
 * incomplete record with eight empty fields shouting at somebody.
 */
export function resolveStanding(input: {
  status: string;
  runningPrograms: number;
  runningClasses: number;
  finishedPrograms: number;
}): { standing: PartnerStanding; label: string } {
  if (input.status === "closed") return { standing: "past", label: STANDING_LABEL.past };
  if (input.status === "paused") return { standing: "paused", label: STANDING_LABEL.paused };
  if (input.runningPrograms > 0 || input.runningClasses > 0) {
    return { standing: "running", label: STANDING_LABEL.running };
  }
  // Ran something before and nothing now is a different situation from never
  // having run anything, and the follow-up it deserves is different too.
  if (input.finishedPrograms > 0) return { standing: "scoping", label: "Between programs" };
  return { standing: "scoping", label: STANDING_LABEL.scoping };
}

/** The sentence under the partner's name. Says what is settled, not what is missing. */
export function standingSentence(input: {
  standing: PartnerStanding;
  runningClasses: number;
  finishedPrograms: number;
  nextFollowUp: PartnerFollowUp | null;
}): string {
  if (input.standing === "past") return "This partnership is closed.";
  if (input.standing === "paused") return "On hold. Nothing is scheduled while it stays that way.";
  if (input.standing === "running") {
    return `${input.runningClasses} class${input.runningClasses === 1 ? "" : "es"} running.`;
  }
  if (input.finishedPrograms > 0) {
    return "Between programs — nothing scheduled, and the last one finished.";
  }
  return "Still deciding. Format, sections, dates and staffing are open — that is normal at this stage.";
}

/** "3 days ago" / "today" / "in 2 days". Days, because follow-ups live in days. */
export function waitingLabel(days: number): string {
  if (days > 1) return `${days} days ago`;
  if (days === 1) return "yesterday";
  if (days === 0) return "today";
  if (days === -1) return "tomorrow";
  return `in ${Math.abs(days)} days`;
}

export const INBOX_KIND_LABEL: Record<InboxKind, string> = {
  follow_up: "Follow-up",
  inquiry: "Inquiry",
  demo_request: "Demo request",
};

/**
 * One list, ordered by who has been waiting longest.
 *
 * Overdue follow-ups outrank everything because somebody already promised
 * them; after that it is simply first in, first answered. Sorting by kind
 * would let a fortnight-old inquiry sit under a fresh one forever.
 */
export function sortInbox(items: InboxItem[]): InboxItem[] {
  return [...items].sort((a, b) => {
    if (a.waitingDays !== b.waitingDays) return b.waitingDays - a.waitingDays;
    return a.at - b.at;
  });
}
