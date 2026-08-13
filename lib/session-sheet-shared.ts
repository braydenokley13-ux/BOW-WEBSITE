/* ============================================================
 * Browser-safe types and pure logic for the Session Sheet.
 *
 * The sheet is opened on a phone a few minutes before a class starts, so
 * everything here answers one of four questions: where am I, what am I
 * teaching, who is in the room, and what do I press when it is over.
 * ============================================================ */

import type { AttendanceStatus } from "@/lib/session-evidence";

export interface SheetStudent {
  studentId: string;
  name: string;
  grade: string | null;
  /** null until someone marks it — nothing is ever assumed. */
  status: AttendanceStatus | null;
  note: string;
  /** Optimistic-concurrency token for this row (attendance_records.recorded_at). */
  recordedAt: number | null;
}

export interface SheetLesson {
  /** learn_lessons.id, or a legacy static lesson id. Null for a plain session. */
  id: string | null;
  title: string;
  /** "Lesson 3 of 12" when the course sequence is known. */
  position: number | null;
  total: number | null;
  estMinutes: number | null;
  /**
   * Where the full teaching material lives. Null when the lesson has never
   * been published from Studio — an unpublished draft is not a plan anyone
   * should be handed five minutes before class.
   */
  href: string | null;
  published: boolean;
  /** True when this came from a finalized report's immutable snapshot. */
  historical: boolean;
}

/** Why attendance is not editable right now, in the words the sheet shows. */
export type AttendanceLock =
  | { locked: false }
  | { locked: true; reason: "not_started" | "finalized" | "no_roster" | "delivery_closed" | "cancelled"; label: string };

export interface SessionSheet {
  now: number;
  sessionId: string;
  classId: string;
  classTitle: string;
  /** The partner whose section this is; null for a direct class. */
  partnerName: string | null;
  /** Position of this session in the class run, 1-based. */
  index: number;
  total: number;
  startsAt: number;
  endsAt: number | null;
  sessionOn: string;
  timezone: string;
  status: string;
  /** The session's own title, as staff wrote it. Not shown; the lesson leads. */
  title: string | null;
  location: string | null;
  meetingLink: string | null;
  /** Names only. Enough to know who else is in the room; nothing personal. */
  coInstructors: string[];
  lesson: SheetLesson | null;
  /** The session's own plan, when staff wrote one. */
  objective: string | null;
  agenda: string | null;
  materials: string | null;
  roster: SheetStudent[];
  notes: string;
  flagged: boolean;
  flagReason: string;
  finalized: boolean;
  /** class_session_reports.reported_at — the report's concurrency token. */
  reportedAt: number | null;
  attendance: AttendanceLock;
  /** Staff see the class through /app/classes; an instructor through /app/teach. */
  backHref: string;
  viewer: "staff" | "instructor";
}

export const SHEET_STATUS_ORDER: AttendanceStatus[] = ["present", "late", "absent", "excused"];

export const SHEET_STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "Here",
  late: "Late",
  absent: "Out",
  excused: "Excused",
};

/** The long form, for screen readers and the summary line. */
export const SHEET_STATUS_FULL: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  excused: "Excused",
};

/**
 * How the sheet reads its own moment. Used for the one line under the title
 * and for deciding whether "Join" or the roster is the thing to lead with.
 */
export type SheetPhase = "upcoming" | "soon" | "live" | "ended" | "done" | "cancelled";

export function resolveSheetPhase(input: {
  startsAt: number;
  endsAt: number | null;
  status: string;
  finalized: boolean;
  now: number;
}): SheetPhase {
  if (input.status === "cancelled") return "cancelled";
  if (input.finalized) return "done";
  const end = input.endsAt ?? input.startsAt + 90 * 60 * 1000;
  if (input.now >= end) return "ended";
  if (input.now >= input.startsAt) return "live";
  if (input.startsAt - input.now <= 2 * 60 * 60 * 1000) return "soon";
  return "upcoming";
}

/**
 * The single button at the bottom of the sheet.
 *
 * Attendance first, because a report cannot be finalized without it, and the
 * server enforces exactly that order. Nothing here invents permission: every
 * `disabled` mirrors a check `recordAttendance` / `submitSessionReport` will
 * make again on the server.
 */
export type SheetAction =
  | { kind: "save-attendance"; label: string; disabled: boolean; hint: string | null }
  | { kind: "complete"; label: string; disabled: boolean; hint: string | null }
  | { kind: "none"; label: string; disabled: true; hint: string | null };

export function resolveSheetAction(input: {
  lock: AttendanceLock;
  marked: number;
  total: number;
  dirty: boolean;
  finalized: boolean;
}): SheetAction {
  if (input.finalized) {
    return { kind: "none", label: "Session complete", disabled: true, hint: null };
  }
  if (input.lock.locked) {
    return { kind: "none", label: "Complete session", disabled: true, hint: input.lock.label };
  }
  if (input.dirty || input.marked < input.total) {
    return {
      kind: "save-attendance",
      label: `Save attendance · ${input.marked}/${input.total}`,
      disabled: input.marked < input.total,
      hint: input.marked < input.total ? `${input.total - input.marked} still to mark` : null,
    };
  }
  return { kind: "complete", label: "Complete session", disabled: false, hint: null };
}

/**
 * A meeting link is only ever rendered as a link when it is one.
 *
 * `updateSessionPlan` enforces http/https on the way in, but a session can
 * also be created by the composer and by imports, so the render path refuses
 * anything else rather than trusting every writer forever. A `javascript:`
 * href in an operator's browser is a real hole, not a formatting nit.
 */
export function safeMeetingLink(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

/** "3 here · 1 late · 1 out" — the line above the roster once anything is marked. */
export function attendanceSummary(statuses: (AttendanceStatus | null)[]): string {
  const counts = { present: 0, late: 0, absent: 0, excused: 0 };
  let unmarked = 0;
  for (const status of statuses) {
    if (status) counts[status] += 1;
    else unmarked += 1;
  }
  const parts: string[] = [];
  if (counts.present) parts.push(`${counts.present} here`);
  if (counts.late) parts.push(`${counts.late} late`);
  if (counts.absent) parts.push(`${counts.absent} out`);
  if (counts.excused) parts.push(`${counts.excused} excused`);
  if (unmarked) parts.push(`${unmarked} not marked`);
  return parts.join(" · ");
}
