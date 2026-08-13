/* ============================================================
 * Composer drafts.
 *
 * One in-flight draft per operator, holding the composer payload verbatim.
 * Deliberately NOT modelled as a planning-stage Class: an abandoned draft has
 * no business sitting in the canonical Program/Class spine, where it would
 * show up in rosters, readiness and every "how many classes" count.
 *
 * There is no status column. A draft exists or it does not — publishing or
 * discarding deletes the row.
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { DEFAULT_TIME_ZONE } from "@/lib/timezone";

/** The composer's state, stored as JSON text. Every field is optional-safe. */
export interface ClassDraftPayload {
  curriculumId: string | null;
  title: string;
  grades: number[];
  /** 0 = Monday … 6 = Sunday, matching the composer's day chips. */
  scheduleDay: number;
  startTime: string;
  endTime: string;
  timeZone: string;
  /** First session, as a local calendar date (YYYY-MM-DD). */
  firstDate: string | null;
  weeks: number;
  /** Dates struck out of the run. The run extends so the session count holds. */
  skipped: string[];
  capacity: number;
  instructorId: string | null;
  meetingLink: string | null;
}

export interface ClassDraftSummary {
  title: string;
  courseTitle: string | null;
  hasSchedule: boolean;
  updatedAt: number;
}

export const DEFAULT_DRAFT: ClassDraftPayload = {
  curriculumId: null,
  title: "",
  grades: [5, 6, 7, 8],
  scheduleDay: 1,
  startTime: "18:30",
  endTime: "19:15",
  timeZone: DEFAULT_TIME_ZONE,
  firstDate: null,
  weeks: 6,
  skipped: [],
  capacity: 12,
  instructorId: null,
  meetingLink: null,
};

/**
 * Parse stored JSON back into a payload, field by field.
 *
 * A draft is written by an older version of the composer as often as not, so
 * every field falls back to its default rather than trusting the blob. A
 * corrupt draft degrades to "the defaults" instead of breaking Home.
 */
export function parseDraftPayload(raw: string | null | undefined): ClassDraftPayload | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const str = (key: string, fallback: string | null): string | null => {
    const candidate = source[key];
    return typeof candidate === "string" && candidate.trim() ? candidate.trim() : fallback;
  };
  const num = (key: string, fallback: number): number => {
    const candidate = Number(source[key]);
    return Number.isFinite(candidate) ? candidate : fallback;
  };
  const list = (key: string): string[] =>
    Array.isArray(source[key]) ? (source[key] as unknown[]).filter((v): v is string => typeof v === "string") : [];

  return {
    curriculumId: str("curriculumId", null),
    title: str("title", "") ?? "",
    grades: Array.isArray(source.grades)
      ? (source.grades as unknown[]).map(Number).filter((n) => Number.isFinite(n) && n >= 1 && n <= 12)
      : DEFAULT_DRAFT.grades,
    scheduleDay: Math.min(6, Math.max(0, Math.trunc(num("scheduleDay", DEFAULT_DRAFT.scheduleDay)))),
    startTime: str("startTime", DEFAULT_DRAFT.startTime) ?? DEFAULT_DRAFT.startTime,
    endTime: str("endTime", DEFAULT_DRAFT.endTime) ?? DEFAULT_DRAFT.endTime,
    timeZone: str("timeZone", DEFAULT_DRAFT.timeZone) ?? DEFAULT_DRAFT.timeZone,
    firstDate: str("firstDate", null),
    weeks: Math.min(16, Math.max(1, Math.trunc(num("weeks", DEFAULT_DRAFT.weeks)))),
    skipped: list("skipped"),
    capacity: Math.min(40, Math.max(1, Math.trunc(num("capacity", DEFAULT_DRAFT.capacity)))),
    instructorId: str("instructorId", null),
    meetingLink: str("meetingLink", null),
  };
}

/** The full draft, for reopening the composer exactly where it was left. */
export async function loadClassDraft(userId: string): Promise<ClassDraftPayload | null> {
  const row = (await getDb()
    .prepare("SELECT payload FROM class_drafts WHERE owner_user_id = ?")
    .get(userId)) as { payload: string } | undefined;
  return parseDraftPayload(row?.payload);
}

/** Just enough for Home's one quiet resume row — no need to ship the payload. */
export async function getClassDraftSummary(userId: string): Promise<ClassDraftSummary | null> {
  const row = (await getDb()
    .prepare(
      `SELECT d.payload, d.updated_at
         FROM class_drafts d
        WHERE d.owner_user_id = ?`,
    )
    .get(userId)) as { payload: string; updated_at: number } | undefined;
  const payload = parseDraftPayload(row?.payload);
  if (!payload || !row) return null;

  let courseTitle: string | null = null;
  if (payload.curriculumId) {
    const course = (await getDb()
      .prepare("SELECT title FROM curricula WHERE id = ?")
      .get(payload.curriculumId)) as { title: string } | undefined;
    courseTitle = course?.title ?? null;
  }

  return {
    title: payload.title || courseTitle || "Untitled class",
    courseTitle,
    hasSchedule: Boolean(payload.firstDate),
    updatedAt: Number(row.updated_at),
  };
}

/** Upsert the operator's single draft. */
export async function saveClassDraft(userId: string, payload: ClassDraftPayload): Promise<void> {
  const db = getDb();
  const now = Date.now();
  const serialised = JSON.stringify(payload);
  const updated = await db
    .prepare("UPDATE class_drafts SET payload = ?, updated_at = ? WHERE owner_user_id = ?")
    .run(serialised, now, userId);
  if (updated.changes === 0) {
    await db
      .prepare(
        `INSERT INTO class_drafts (id, owner_user_id, payload, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (owner_user_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at`,
      )
      .run(`cdr-${randomUUID().slice(0, 12)}`, userId, serialised, now, now);
  }
}

export async function discardClassDraft(userId: string): Promise<void> {
  await getDb().prepare("DELETE FROM class_drafts WHERE owner_user_id = ?").run(userId);
}
