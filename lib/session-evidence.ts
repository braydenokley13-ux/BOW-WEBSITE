import type { Lesson } from "@/lib/lessons";

export const ATTENDANCE_STATUSES = ["present", "absent", "late", "excused"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export function resolveAttendanceStatus(status: unknown, present: unknown): AttendanceStatus | null {
  if (typeof status === "string" && (ATTENDANCE_STATUSES as readonly string[]).includes(status)) {
    return status as AttendanceStatus;
  }
  // Compatibility adapter for a pre-V6 row during controlled migration or a
  // read-only recovery inspection. V6 backfills every operational row.
  if (present === 1) return "present";
  if (present === 0) return "absent";
  return null;
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * Parse only action-generated immutable lesson evidence. Database JSON
 * validity is necessary but not enough for rendering: this shape check keeps
 * a manually damaged snapshot from crashing the delivery workspace.
 */
export function parseLessonSnapshot(value: string | null | undefined, expectedLessonId?: string | null): Lesson | null {
  if (!value) return null;
  try {
    const lesson: unknown = JSON.parse(value);
    if (!record(lesson)) return null;
    const requiredStrings = [
      "id",
      "title",
      "track",
      "trackLabel",
      "moduleTitle",
      "duration",
      "overview",
      "summary",
      "centralQuestion",
      "simulationStatus",
    ] as const;
    if (requiredStrings.some((key) => typeof lesson[key] !== "string")) return null;
    if (expectedLessonId && lesson.id !== expectedLessonId) return null;
    if (!Number.isInteger(lesson.moduleNumber)) return null;
    if (!stringArray(lesson.concepts) || !stringArray(lesson.situation) || !stringArray(lesson.discussionQuestions)) {
      return null;
    }
    if (
      !Array.isArray(lesson.learningOutcomes)
      || !lesson.learningOutcomes.every((item) => record(item) && typeof item.concept === "string" && typeof item.use === "string")
      || !Array.isArray(lesson.needToKnow)
      || !lesson.needToKnow.every((item) => record(item) && typeof item.term === "string" && typeof item.body === "string")
      || !Array.isArray(lesson.decisionOptions)
      || !lesson.decisionOptions.every((item) => record(item) && typeof item.label === "string")
      || !Array.isArray(lesson.stakeholders)
      || !lesson.stakeholders.every(
        (item) =>
          record(item)
          && typeof item.name === "string"
          && typeof item.interest === "string"
          && typeof item.concern === "string",
      )
    ) {
      return null;
    }
    if (lesson.simulationUrl != null && typeof lesson.simulationUrl !== "string") return null;
    if (lesson.decisionPrompt != null && typeof lesson.decisionPrompt !== "string") return null;
    return lesson as unknown as Lesson;
  } catch {
    return null;
  }
}
