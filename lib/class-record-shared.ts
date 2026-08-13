/* ============================================================
 * Browser-safe types and labels for the direct class record.
 * ============================================================ */

export interface PrimaryAction {
  kind: "open-session" | "resolve" | "share" | "open-registration" | "view-waitlist" | "close";
  label: string;
  href: string | null;
}

export interface ClassRun {
  id: string;
  index: number;
  sessionOn: string;
  sessionDate: number;
  timezone: string;
  title: string | null;
  status: string;
  completed: boolean;
  flagged: boolean;
}

export interface RosterEntry {
  studentId: string;
  name: string;
  grade: string | null;
  guardianName: string | null;
  registrationId: string | null;
  registrationStatus: string;
  offerExpiresAt: number | null;
  needsIdentityReview: boolean;
}

export interface FamilyMessage {
  id: string;
  title: string;
  sentAt: number;
  recipients: number;
  delivered: number;
}

export interface ClassRecord {
  /** The instant the record was read, so the page can label relative times. */
  now: number;
  id: string;
  title: string;
  status: string;
  isPublic: boolean;
  publicSlug: string | null;
  partnerName: string | null;
  courseId: string | null;
  courseTitle: string | null;
  gradeRange: string | null;
  startTime: string | null;
  endTime: string | null;
  timezone: string;
  scheduleLabel: string | null;
  capacity: number | null;
  seatsTaken: number;
  seatsRemaining: number | null;
  waitlisted: number;
  confirmed: number;
  instructorNames: string[];
  run: ClassRun[];
  nextSessionId: string | null;
  todaySessionId: string | null;
  roster: RosterEntry[];
  messages: FamilyMessage[];
  exceptions: { key: string; title: string; detail: string }[];
  primary: PrimaryAction;
}

/**
 * What a family's seat is called, in words an operator would use out loud.
 * The engine's twelve registration states collapse to the four that change
 * what someone would actually do about them.
 */
export function seatLabel(status: string, offerExpiresAt: number | null, now = Date.now()): { label: string; tone: "positive" | "warning" | "neutral" | "info" } {
  if (status === "offer_sent") {
    const hours = offerExpiresAt ? Math.max(0, Math.round((offerExpiresAt - now) / (60 * 60 * 1000))) : null;
    return { label: hours !== null ? `Offer · ${hours}h` : "Offer sent", tone: "warning" };
  }
  if (status === "waitlisted") return { label: "Waitlist", tone: "info" };
  if (status === "confirmed" || status === "enrolled" || status === "offer_accepted") {
    return { label: "Confirmed", tone: "positive" };
  }
  if (status === "under_review") return { label: "Needs review", tone: "warning" };
  if (status === "seat_reserved" || status === "requirements_pending") return { label: "Holding a seat", tone: "info" };
  return { label: status.replace(/_/g, " "), tone: "neutral" };
}

/** "Tue 6:30–7:15 PM ET · Free · Grades 5–8" */
export function classFactLine(record: {
  scheduleLabel: string | null;
  gradeRange: string | null;
}): string {
  return [record.scheduleLabel, "Free", record.gradeRange].filter(Boolean).join(" · ");
}
