/* ============================================================
 * components/learn/builder/statusChip.ts — pure lesson status-chip derivation.
 *
 * Derives the curriculum manager's status chip ("Draft" / "Published V3" /
 * "Published V3 · draft ahead" / "Archived") from lifecycle +
 * published_version_id + draft_revision, per plan §4 and the Stage 3 gate.
 * No React, no DB — unit-tested directly (tests/learn/statusChip.test.ts).
 * ============================================================ */

export interface LessonStatusInput {
  lifecycle: "active" | "archived" | string;
  publishedVersionId: string | null;
  publishedVersion: number | null;
  /** True once the draft has changed since the currently-published version was published. */
  draftAheadOfPublished: boolean;
}

export type LessonStatusTone = "neutral" | "positive" | "warning" | "info";

export interface LessonStatusChip {
  label: string;
  tone: LessonStatusTone;
}

export function deriveLessonStatusChip(input: LessonStatusInput): LessonStatusChip {
  if (input.lifecycle === "archived") {
    return { label: "Archived", tone: "neutral" };
  }
  if (!input.publishedVersionId || input.publishedVersion === null) {
    return { label: "Draft", tone: "warning" };
  }
  if (input.draftAheadOfPublished) {
    return { label: `Published V${input.publishedVersion} · draft ahead`, tone: "info" };
  }
  return { label: `Published V${input.publishedVersion}`, tone: "positive" };
}
