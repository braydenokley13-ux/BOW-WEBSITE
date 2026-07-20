/* ============================================================
 * Flywheel — client-safe contracts. Constants and types shared by
 * server loaders (lib/flywheel.ts), server actions, and client
 * components. No database imports here.
 * ============================================================ */

export type ActionSeverity = "act_now" | "next_up" | "watch";

export interface GrowthAction {
  key: string;
  severity: ActionSeverity;
  /** Who/what this is about, e.g. "Eastfield Community School". */
  entityLabel: string;
  entityHref: string;
  /** Why this surfaced, in operational terms. */
  reason: string;
  /** The concrete recommended next step. */
  action: string;
  /** Age of the triggering condition, in whole days. */
  ageDays: number;
  ctaLabel: string;
  /** Present when the action is an open row in `tasks` (completable). */
  taskId?: string;
}

export interface FlywheelLeak {
  key: string;
  label: string;
  count: number;
  href: string;
  detail: string;
}

export interface FlywheelSnapshot {
  actions: GrowthAction[];
  leaks: FlywheelLeak[];
}

export const CLOSEOUT_FIELDS = [
  { key: "attendance_finalized", label: "Attendance finalized", help: "Every session report completed." },
  { key: "feedback_collected", label: "Student & parent feedback collected", help: "At least an informal read on how it went." },
  { key: "testimonial_captured", label: "Testimonial identified or captured", help: "A quote or story usable in recruitment." },
  { key: "referrals_prompted", label: "Referral invitations prompted", help: "Completed students/families asked to invite a friend or sibling." },
  { key: "partner_followed_up", label: "Partner follow-up completed", help: "Outcome shared with the partner; repeat discussed." },
  { key: "repeat_planned", label: "Repeat / next program decided", help: "Renewal review done or consciously declined." },
  { key: "instructor_followed_up", label: "Instructor follow-up done", help: "Debrief + next opportunity for the instructor." },
  { key: "asset_captured", label: "Proof asset captured", help: "Results, photos, or case-study notes filed." },
] as const;

export type CloseoutField = (typeof CLOSEOUT_FIELDS)[number]["key"];

export interface ClassCloseout {
  classId: string;
  fields: Record<CloseoutField, boolean>;
  note: string;
  completedAt: number | null;
  updatedAt: number | null;
}

export const INTRODUCTION_TARGET_KINDS = ["student", "instructor", "partner", "community"] as const;
export const INTRODUCTION_STATUSES = ["suggested", "contacted", "converted", "declined"] as const;

export interface GrowthIntroduction {
  id: string;
  introducerType: "instructor" | "student" | "partner" | "contributor";
  introducerId: string;
  targetKind: (typeof INTRODUCTION_TARGET_KINDS)[number];
  targetName: string;
  status: (typeof INTRODUCTION_STATUSES)[number];
  note: string;
  createdAt: number;
  resolvedAt: number | null;
}
