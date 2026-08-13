/* ============================================================
 * Browser-safe types and label helpers for HQ Home.
 *
 * Split from lib/hq-home.ts so client components can import the shapes
 * without pulling the database in, matching lib/delivery-shared.ts.
 * ============================================================ */

export type QueueKind =
  | "follow_up"
  | "waitlist_offer"
  | "duplicate"
  | "absence_streak"
  | "session_flag";

/**
 * Actions are serialisable descriptors rather than functions, so a server
 * component can hand them to a client island. Every queue item carries at
 * least one action that actually resolves it — there is no dismiss, because
 * hiding an exception does not make it untrue.
 */
export type QueueAction =
  | { kind: "link"; label: string; href: string }
  | { kind: "complete-task"; label: string; taskId: string }
  | { kind: "snooze-task"; label: string; taskId: string; days: number }
  | { kind: "extend-offer"; label: string; offerId: string; hours: number }
  | { kind: "review-duplicate"; label: string; reviewId: string };

export interface QueueItem {
  key: string;
  kind: QueueKind;
  tone: "attention" | "neutral";
  title: string;
  context: string;
  href: string | null;
  /** When the clock matters. Used for ordering, not for a countdown badge. */
  dueAt: number | null;
  actions: QueueAction[];
}

export interface TodaySession {
  id: string;
  classId: string;
  classTitle: string;
  sessionDate: number;
  timezone: string;
  location: string | null;
  meetingLink: string | null;
  title: string | null;
  lessonId: string | null;
  studentCount: number;
  prepReady: boolean;
  completed: boolean;
}

export interface TickerItem {
  key: string;
  kind: "registration" | "waitlisted" | "inquiry";
  title: string;
  context: string;
  at: number;
  href: string;
  /** Present on inquiries so the row can offer conversion in place. */
  inquiryId: string | null;
}

export interface WeekDigest {
  classesRunning: number;
  seatsTaken: number;
  seatsCapacity: number;
  sessionsThisWeek: number;
  inboxWaiting: number;
}

export interface HqHomeData {
  /** The instant the data was read, so the page can format relative times. */
  now: number;
  today: TodaySession[];
  nextSession: { sessionOn: string; classTitle: string } | null;
  queue: QueueItem[];
  ticker: TickerItem[];
  digest: WeekDigest;
}

/** "6:30 PM" — the time a session starts, in its own zone. */
export function sessionTimeLabel(epoch: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(epoch);
}

/** The short zone marker families and instructors actually say ("ET"). */
export function zoneAbbreviation(epoch: number, timeZone: string): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
    .formatToParts(epoch)
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? "";
}

/** "2h ago", "Yesterday", "Mon" — a ticker reads as recency, not timestamps. */
export function relativeLabel(at: number, now: number): string {
  const diff = Math.max(0, now - at);
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(at);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(at);
}

/**
 * The greeting is the only sentence on Home that changes with the clock. It
 * states the day's shape in one line so the founder can leave immediately if
 * nothing needs them.
 */
export function homeSummarySentence(sessionCount: number, queueCount: number): string {
  const sessions =
    sessionCount === 0
      ? "Nothing on the schedule today"
      : sessionCount === 1
        ? "One session today"
        : `${sessionCount} sessions today`;
  const needs =
    queueCount === 0
      ? "nothing needs you"
      : queueCount === 1
        ? "one thing needs you"
        : `${queueCount} things need you`;
  return `${sessions}, ${needs}.`;
}
