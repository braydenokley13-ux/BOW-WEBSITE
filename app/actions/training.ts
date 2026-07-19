"use server";

/* ============================================================
 * Training modules + live training sessions — CRUD, registration,
 * and attendance. Staff-only (admin | growth) except registration,
 * which an instructor may also do for themselves.
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireStaff, requireRole } from "@/lib/dal";
import {
  logActivity,
  getInstructorByUserId,
  recomputeAllInstructorStatuses,
  recomputeInstructorStatuses,
} from "@/lib/hiring";
import { formatDateTimeInZone, localDateTimeToEpoch } from "@/lib/timezone";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const CATEGORIES = new Set(["onboarding", "training"]);
const CONTENT_TYPES = new Set(["text", "link"]);
const MODULE_CREATE_FIELDS = new Set(["title", "category", "required", "contentType", "content", "ordinal"]);
const MODULE_UPDATE_FIELDS = new Set(["title", "category", "required", "contentType", "content", "ordinal", "expectedUpdatedAt"]);
const SESSION_CREATE_FIELDS = new Set([
  "title",
  "scheduledLocalDateTime",
  "timeZone",
  "location",
  "meetingLink",
  "facilitatorUserId",
  "required",
]);
const SESSION_UPDATE_FIELDS = new Set([...SESSION_CREATE_FIELDS, "expectedUpdatedAt"]);

function isRecordWithOnlyFields(value: unknown, allowed: ReadonlySet<string>): value is Record<string, unknown> {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && Object.keys(value).every((key) => allowed.has(key));
}

function cleanId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return id && id.length <= 100 ? id : null;
}

function isSafeHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function moduleContentError(contentType: string, content: string): string | null {
  if (!content) return "Add module content before assigning this training.";
  if (contentType === "link" && !isSafeHttpsUrl(content)) return "Module links must use a valid https:// address.";
  return null;
}

function nextUpdatedAt(previous: number): number {
  return Math.max(Date.now(), previous + 1);
}

function revalidateAllInstructorReadiness(): void {
  revalidatePath("/app");
  revalidatePath("/app/training");
  revalidatePath("/app/teach");
  revalidatePath("/app/instructors");
  revalidatePath("/app/instructors/[id]", "page");
  revalidatePath("/app/classes");
  revalidatePath("/app/classes/[id]", "page");
  revalidatePath("/app/programs");
  revalidatePath("/app/programs/[id]", "page");
}

function revalidateInstructorReadiness(instructorId: string): void {
  revalidatePath("/app");
  revalidatePath("/app/training");
  revalidatePath("/app/teach");
  revalidatePath("/app/instructors");
  revalidatePath(`/app/instructors/${instructorId}`);
  revalidatePath("/app/classes");
  revalidatePath("/app/classes/[id]", "page");
  revalidatePath("/app/programs");
  revalidatePath("/app/programs/[id]", "page");
}

/* ---------------- modules ---------------- */

export interface CreateModuleInput {
  title: string;
  category: "onboarding" | "training";
  required: boolean;
  contentType: "text" | "link";
  content?: string;
  ordinal?: number;
}

export async function createTrainingModule(input: CreateModuleInput): Promise<ActionResult> {
  const me = await requireStaff();
  if (!isRecordWithOnlyFields(input, MODULE_CREATE_FIELDS)) return { ok: false, error: "Choose valid module details." };
  if (typeof input.title !== "string") return { ok: false, error: "Title is required." };
  if (typeof input.category !== "string" || !CATEGORIES.has(input.category)) return { ok: false, error: "Invalid category." };
  if (typeof input.required !== "boolean") return { ok: false, error: "Choose whether this module is required." };
  if (typeof input.contentType !== "string" || !CONTENT_TYPES.has(input.contentType)) {
    return { ok: false, error: "Invalid content type." };
  }
  if (input.content !== undefined && typeof input.content !== "string") return { ok: false, error: "Enter valid module content." };
  if (
    input.ordinal !== undefined
    && (typeof input.ordinal !== "number" || !Number.isSafeInteger(input.ordinal) || input.ordinal < 0 || input.ordinal > 1_000_000)
  ) {
    return { ok: false, error: "Module order must be a whole number between 0 and 1,000,000." };
  }
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Title is required." };
  if (title.length > 200) return { ok: false, error: "Title is too long." };
  const content = (input.content ?? "").trim();
  if (content.length > 4000) return { ok: false, error: "Module content must be 4,000 characters or fewer." };
  const contentError = moduleContentError(input.contentType, content);
  if (contentError) return { ok: false, error: contentError };
  const ordinal = input.ordinal ?? 0;

  const id = `pfx-${randomUUID().slice(0, 8)}`;
  const now = Date.now();
  const db = getDb();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    (await db.prepare(
            "INSERT INTO training_modules (id, title, category, required, content_type, content, ordinal, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
          )
          .run(id, title.slice(0, 200), input.category, input.required ? 1 : 0, input.contentType, content || null, ordinal, now, now));
    const affected = input.required ? (await recomputeAllInstructorStatuses()) : 0;
    (await logActivity(
            "training_module",
            id,
            "note",
            `Module "${title}" created.${input.required ? ` Recomputed readiness for ${affected} instructor${affected === 1 ? "" : "s"}.` : ""}`,
            me.id,
          ));
    (await db.exec("COMMIT"));
  } catch (error) {
    if (db.isTransaction) (await db.exec("ROLLBACK"));
    throw error;
  }
  revalidatePath("/app/training");
  revalidatePath("/app/teach");
  if (input.required) {
    revalidateAllInstructorReadiness();
  }
  return { ok: true };
}

export interface UpdateModulePatch {
  title?: string;
  category?: "onboarding" | "training";
  required?: boolean;
  contentType?: "text" | "link";
  content?: string;
  ordinal?: number;
  expectedUpdatedAt: number;
}

export async function updateTrainingModule(
  id: string,
  patch: UpdateModulePatch,
): Promise<ActionResult & { updatedAt?: number }> {
  const me = await requireStaff();
  const moduleId = cleanId(id);
  if (!moduleId) return { ok: false, error: "Choose a valid module." };
  if (!isRecordWithOnlyFields(patch, MODULE_UPDATE_FIELDS)) return { ok: false, error: "Choose valid module changes." };
  if (!Number.isSafeInteger(patch.expectedUpdatedAt) || patch.expectedUpdatedAt < 0) {
    return { ok: false, error: "Refresh this module before editing it." };
  }
  if (patch.title !== undefined && typeof patch.title !== "string") return { ok: false, error: "Enter a valid title." };
  if (patch.category !== undefined && (typeof patch.category !== "string" || !CATEGORIES.has(patch.category))) {
    return { ok: false, error: "Invalid category." };
  }
  if (patch.required !== undefined && typeof patch.required !== "boolean") {
    return { ok: false, error: "Choose whether this module is required." };
  }
  if (patch.contentType !== undefined && (typeof patch.contentType !== "string" || !CONTENT_TYPES.has(patch.contentType))) {
    return { ok: false, error: "Invalid content type." };
  }
  if (patch.content !== undefined && typeof patch.content !== "string") return { ok: false, error: "Enter valid module content." };
  if (
    patch.ordinal !== undefined
    && (typeof patch.ordinal !== "number" || !Number.isSafeInteger(patch.ordinal) || patch.ordinal < 0 || patch.ordinal > 1_000_000)
  ) {
    return { ok: false, error: "Module order must be a whole number between 0 and 1,000,000." };
  }
  const db = getDb();
  const next = {
    title: patch.title !== undefined ? patch.title.trim() : undefined,
    category: patch.category,
    required: patch.required !== undefined ? (patch.required ? 1 : 0) : undefined,
    content_type: patch.contentType,
    content: patch.content !== undefined ? patch.content.trim() : undefined,
    ordinal: patch.ordinal,
  };
  if (next.title !== undefined && !next.title) return { ok: false, error: "Title can't be empty." };
  if (next.title !== undefined && next.title.length > 200) return { ok: false, error: "Title is too long." };
  if (next.content !== undefined && next.content.length > 4000) {
    return { ok: false, error: "Module content must be 4,000 characters or fewer." };
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(next)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    values.push(v);
  }
  if (sets.length === 0) return { ok: true };
  let requirementsChanged = false;
  let savedUpdatedAt: number | undefined;
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const row = (await db.prepare(
          `SELECT title, category, required, content_type, content, ordinal, active, updated_at,
              EXISTS (SELECT 1 FROM training_module_views v WHERE v.module_id = training_modules.id) AS has_views,
              EXISTS (SELECT 1 FROM training_module_completions c WHERE c.module_id = training_modules.id) AS has_completions
         FROM training_modules
        WHERE id = ?`,
        ).get(moduleId)) as {
      title: string;
      category: string;
      required: number;
      content_type: string;
      content: string | null;
      ordinal: number;
      active: number;
      updated_at: number;
      has_views: number;
      has_completions: number;
    } | undefined;
    if (!row) throw new Error("module_missing");
    if (row.active !== 1) throw new Error("module_archived");
    if (row.updated_at !== patch.expectedUpdatedAt) throw new Error("module_changed");
    if (next.content !== undefined || next.content_type !== undefined) {
      const contentError = moduleContentError(next.content_type ?? row.content_type, next.content ?? row.content ?? "");
      if (contentError) throw new Error(`module_content:${contentError}`);
    }
    const definitionChanged = (
      (next.title !== undefined && next.title !== row.title)
      || (next.category !== undefined && next.category !== row.category)
      || (next.content_type !== undefined && next.content_type !== row.content_type)
      || (next.content !== undefined && next.content !== (row.content ?? ""))
    );
    if (definitionChanged && (row.has_views === 1 || row.has_completions === 1)) {
      throw new Error("module_evidence_locked");
    }
    const nextCategory = next.category ?? row.category;
    const nextRequired = next.required ?? row.required;
    requirementsChanged = row.active === 1 && (nextCategory !== row.category || nextRequired !== row.required);
    const now = nextUpdatedAt(row.updated_at);
    savedUpdatedAt = now;
    sets.push("updated_at = ?");
    values.push(now, moduleId, row.updated_at);
    const updated = (await db.prepare(
          `UPDATE training_modules SET ${sets.join(", ")} WHERE id = ? AND updated_at = ?`,
        ).run(...(values as (string | number | null)[])));
    if (updated.changes !== 1) throw new Error("module_changed");
    const affected = requirementsChanged ? (await recomputeAllInstructorStatuses()) : 0;
    (await logActivity(
            "training_module",
            moduleId,
            "note",
            `Module updated.${next.required !== undefined && next.required !== row.required ? ` Requirement changed from ${row.required === 1 ? "required" : "optional"} to ${next.required === 1 ? "required" : "optional"}.` : ""}${requirementsChanged ? ` Recomputed readiness for ${affected} instructor${affected === 1 ? "" : "s"}.` : ""}`,
            me.id,
          ));
    (await db.exec("COMMIT"));
  } catch (error) {
    if (db.isTransaction) (await db.exec("ROLLBACK"));
    const code = error instanceof Error ? error.message : "";
    if (code === "module_missing") return { ok: false, error: "Not found." };
    if (code === "module_archived") return { ok: false, error: "Archived modules are immutable. Create a successor module instead." };
    if (code === "module_evidence_locked") {
      return { ok: false, error: "This module has learner evidence, so its definition is locked. Archive it and create a successor version instead." };
    }
    if (code.startsWith("module_content:")) return { ok: false, error: code.slice("module_content:".length) };
    if (code === "module_changed") return { ok: false, error: "This module changed. Refresh and try again." };
    throw error;
  }
  revalidatePath("/app/training");
  revalidatePath("/app/teach");
  if (requirementsChanged) {
    revalidateAllInstructorReadiness();
  }
  return { ok: true, updatedAt: savedUpdatedAt };
}

export async function archiveTrainingModule(id: string, expectedUpdatedAt: number): Promise<ActionResult> {
  const me = await requireStaff();
  const moduleId = String(id ?? "").trim();
  if (!moduleId || moduleId.length > 100) return { ok: false, error: "Choose a valid module." };
  if (!Number.isSafeInteger(expectedUpdatedAt) || expectedUpdatedAt < 0) {
    return { ok: false, error: "Refresh this module before archiving it." };
  }
  const db = getDb();
  let requirementsChanged = false;
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const row = (await db.prepare("SELECT required, active, updated_at FROM training_modules WHERE id = ?").get(moduleId)) as
      | { required: number; active: number; updated_at: number }
      | undefined;
    if (!row) throw new Error("module_missing");
    if (row.active !== 1) throw new Error("module_archived");
    if (row.updated_at !== expectedUpdatedAt) throw new Error("module_changed");
    const now = nextUpdatedAt(row.updated_at);
    const archived = (await db.prepare(
          "UPDATE training_modules SET active = 0, updated_at = ? WHERE id = ? AND active = 1 AND updated_at = ?",
        ).run(now, moduleId, row.updated_at));
    if (archived.changes !== 1) throw new Error("module_changed");
    requirementsChanged = row.required === 1;
    const affected = requirementsChanged ? (await recomputeAllInstructorStatuses()) : 0;
    (await logActivity(
            "training_module",
            moduleId,
            "note",
            `Module archived.${requirementsChanged ? ` Recomputed readiness for ${affected} instructor${affected === 1 ? "" : "s"}.` : ""}`,
            me.id,
          ));
    (await db.exec("COMMIT"));
  } catch (error) {
    if (db.isTransaction) (await db.exec("ROLLBACK"));
    const code = error instanceof Error ? error.message : "";
    if (code === "module_missing") return { ok: false, error: "Not found." };
    if (code === "module_archived") return { ok: false, error: "This module is already archived." };
    if (code === "module_changed") return { ok: false, error: "This module changed. Refresh and try again." };
    throw error;
  }
  revalidatePath("/app/training");
  if (requirementsChanged) revalidateAllInstructorReadiness();
  return { ok: true };
}

/* ---------------- sessions ---------------- */

export interface CreateSessionInput {
  title: string;
  scheduledLocalDateTime: string;
  timeZone: string;
  location?: string;
  meetingLink?: string;
  facilitatorUserId?: string;
  required: boolean;
}

export async function createTrainingSession(input: CreateSessionInput): Promise<ActionResult> {
  const me = await requireStaff();
  if (!isRecordWithOnlyFields(input, SESSION_CREATE_FIELDS)) return { ok: false, error: "Choose valid session details." };
  if (
    typeof input.title !== "string"
    || typeof input.scheduledLocalDateTime !== "string"
    || typeof input.timeZone !== "string"
    || typeof input.required !== "boolean"
    || (input.location !== undefined && typeof input.location !== "string")
    || (input.meetingLink !== undefined && typeof input.meetingLink !== "string")
    || (input.facilitatorUserId !== undefined && typeof input.facilitatorUserId !== "string")
  ) {
    return { ok: false, error: "The training session contains invalid fields." };
  }
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Title is required." };
  if (title.length > 200) return { ok: false, error: "Title is too long." };
  const location = (input.location ?? "").trim();
  const meetingLink = (input.meetingLink ?? "").trim();
  const facilitatorUserId = (input.facilitatorUserId ?? "").trim() || null;
  if (location.length > 200) return { ok: false, error: "Keep the location under 200 characters." };
  if (meetingLink.length > 400) return { ok: false, error: "Keep the meeting link under 400 characters." };
  if (meetingLink && !isSafeHttpsUrl(meetingLink)) return { ok: false, error: "Meeting links must use a valid https:// address." };
  if (facilitatorUserId && facilitatorUserId.length > 100) return { ok: false, error: "Choose a valid facilitator." };
  const schedule = localDateTimeToEpoch(input?.scheduledLocalDateTime, input?.timeZone);
  if (!schedule.ok) return { ok: false, error: schedule.error };
  const now = Date.now();
  if (schedule.epoch <= now || schedule.epoch > now + 5 * 366 * 24 * 60 * 60 * 1000) {
    return { ok: false, error: "Choose a future training time within five years." };
  }
  const id = `pfx-${randomUUID().slice(0, 8)}`;
  const db = getDb();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    if (
      facilitatorUserId
      && !(await db.prepare("SELECT 1 FROM users WHERE id = ? AND status = 'active' AND role IN ('admin','growth')").get(facilitatorUserId))
    ) {
      throw new Error("facilitator_unavailable");
    }
    (await db.prepare(
            "INSERT INTO training_sessions (id, title, scheduled_at, timezone, location, meeting_link, facilitator_user_id, required, facilitator_notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)",
          )
          .run(
            id,
            title,
            schedule.epoch,
            schedule.timeZone,
            location || null,
            meetingLink || null,
            facilitatorUserId,
            input.required ? 1 : 0,
            now,
            now,
          ));
    (await logActivity(
            "training_session",
            id,
            "note",
            `Session "${title}" scheduled for ${formatDateTimeInZone(schedule.epoch, schedule.timeZone)} in ${schedule.timeZone}.`,
            me.id,
          ));
    (await db.exec("COMMIT"));
  } catch (error) {
    if (db.isTransaction) (await db.exec("ROLLBACK"));
    if (error instanceof Error && error.message === "facilitator_unavailable") {
      return { ok: false, error: "Choose an active staff facilitator." };
    }
    throw error;
  }
  revalidatePath("/app/training");
  revalidatePath("/app/teach");
  return { ok: true };
}

export interface UpdateSessionPatch {
  title?: string;
  scheduledLocalDateTime?: string;
  timeZone?: string;
  location?: string;
  meetingLink?: string;
  facilitatorUserId?: string;
  required?: boolean;
  expectedUpdatedAt: number;
}

export async function updateTrainingSession(id: string, patch: UpdateSessionPatch): Promise<ActionResult> {
  const me = await requireStaff();
  const sessionId = String(id ?? "").trim();
  if (!sessionId || sessionId.length > 100) return { ok: false, error: "Choose a valid training session." };
  if (!isRecordWithOnlyFields(patch, SESSION_UPDATE_FIELDS)) return { ok: false, error: "Choose valid session changes." };
  if (!Number.isSafeInteger(patch.expectedUpdatedAt) || patch.expectedUpdatedAt < 0) {
    return { ok: false, error: "Refresh this training session before editing it." };
  }
  if (
    (patch.title !== undefined && typeof patch.title !== "string")
    || (patch.location !== undefined && typeof patch.location !== "string")
    || (patch.meetingLink !== undefined && typeof patch.meetingLink !== "string")
    || (patch.facilitatorUserId !== undefined && typeof patch.facilitatorUserId !== "string")
    || (patch.required !== undefined && typeof patch.required !== "boolean")
  ) {
    return { ok: false, error: "The training-session changes contain invalid fields." };
  }
  const legacyTimestamp = (patch as UpdateSessionPatch & { scheduledAt?: unknown }).scheduledAt;
  if (legacyTimestamp !== undefined) {
    return { ok: false, error: "Choose a local training date/time together with its timezone." };
  }
  const schedulingChanged = patch.scheduledLocalDateTime !== undefined || patch.timeZone !== undefined;
  if (schedulingChanged && (typeof patch.scheduledLocalDateTime !== "string" || typeof patch.timeZone !== "string")) {
    return { ok: false, error: "Choose a local training date/time together with its timezone." };
  }
  const schedule = schedulingChanged
    ? localDateTimeToEpoch(patch.scheduledLocalDateTime, patch.timeZone)
    : null;
  if (schedule && !schedule.ok) {
    return { ok: false, error: schedule.error };
  }
  const requestTime = Date.now();
  if (schedule?.ok && (schedule.epoch <= requestTime || schedule.epoch > requestTime + 5 * 366 * 24 * 60 * 60 * 1000)) {
    return { ok: false, error: "Choose a future training time within five years." };
  }
  const db = getDb();

  const title = patch.title !== undefined ? patch.title.trim() : undefined;
  const location = patch.location !== undefined ? patch.location.trim() : undefined;
  const meetingLink = patch.meetingLink !== undefined ? patch.meetingLink.trim() : undefined;
  const facilitatorUserId = patch.facilitatorUserId !== undefined ? patch.facilitatorUserId.trim() : undefined;
  if (title !== undefined && (!title || title.length > 200)) {
    return { ok: false, error: title ? "Title is too long." : "Title can't be empty." };
  }
  if (location !== undefined && location.length > 200) return { ok: false, error: "Keep the location under 200 characters." };
  if (meetingLink !== undefined && meetingLink.length > 400) return { ok: false, error: "Keep the meeting link under 400 characters." };
  if (meetingLink && !isSafeHttpsUrl(meetingLink)) return { ok: false, error: "Meeting links must use a valid https:// address." };
  if (facilitatorUserId !== undefined && facilitatorUserId.length > 100) return { ok: false, error: "Choose a valid facilitator." };

  const next = {
    title,
    scheduled_at: schedule?.ok ? schedule.epoch : undefined,
    timezone: schedule?.ok ? schedule.timeZone : undefined,
    location: location !== undefined ? location || null : undefined,
    meeting_link: meetingLink !== undefined ? meetingLink || null : undefined,
    facilitator_user_id: facilitatorUserId !== undefined ? facilitatorUserId || null : undefined,
    required: patch.required !== undefined ? (patch.required ? 1 : 0) : undefined,
  };

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(next)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    values.push(v);
  }
  if (sets.length === 0) return { ok: true };
  let readinessChanged = false;
  let definitionChanged = false;
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const row = (await db.prepare(
          `SELECT title, scheduled_at, timezone, location, meeting_link, facilitator_user_id,
              required, updated_at
         FROM training_sessions WHERE id = ?`,
        ).get(sessionId)) as {
      title: string;
      scheduled_at: number;
      timezone: string | null;
      location: string | null;
      meeting_link: string | null;
      facilitator_user_id: string | null;
      required: number;
      updated_at: number;
    } | undefined;
    if (!row) throw new Error("session_missing");
    if (row.updated_at !== patch.expectedUpdatedAt) throw new Error("session_changed");
    if (
      next.facilitator_user_id
      && !(await db.prepare("SELECT 1 FROM users WHERE id = ? AND status = 'active' AND role IN ('admin','growth')").get(next.facilitator_user_id))
    ) {
      throw new Error("facilitator_unavailable");
    }
    const nextScheduledAt = next.scheduled_at ?? row.scheduled_at;
    const nextTimeZone = next.timezone ?? row.timezone;
    const nextRequired = next.required ?? row.required;
    readinessChanged = nextScheduledAt !== row.scheduled_at || nextTimeZone !== row.timezone || nextRequired !== row.required;
    definitionChanged = readinessChanged
      || (next.title !== undefined && next.title !== row.title)
      || (next.location !== undefined && next.location !== row.location)
      || (next.meeting_link !== undefined && next.meeting_link !== row.meeting_link)
      || (next.facilitator_user_id !== undefined && next.facilitator_user_id !== row.facilitator_user_id);
    const now = Date.now();
    const hasAttendance = Boolean(
      (await db.prepare("SELECT 1 FROM training_session_attendance WHERE session_id = ? LIMIT 1").get(sessionId)),
    );
    if (definitionChanged && (row.scheduled_at <= now || hasAttendance)) {
      throw new Error("session_evidence_locked");
    }
    if (nextScheduledAt <= now) throw new Error("session_time_passed");
    const updatedAt = nextUpdatedAt(row.updated_at);
    sets.push("updated_at = ?");
    values.push(updatedAt, sessionId, row.updated_at);
    const updated = (await db.prepare(
          `UPDATE training_sessions SET ${sets.join(", ")} WHERE id = ? AND updated_at = ?`,
        ).run(...(values as (string | number | null)[])));
    if (updated.changes !== 1) throw new Error("session_changed");

    // A required-session timing edit changes evidence for registered people.
    // Keep the definition and every cached readiness result in one commit.
    if (readinessChanged) {
      const affected = (await db.prepare(
              "SELECT DISTINCT instructor_id FROM training_session_registrations WHERE session_id = ?",
            ).all(sessionId)) as { instructor_id: string }[];
      for (const registration of affected) (await recomputeInstructorStatuses(registration.instructor_id));
    }
    (await logActivity(
            "training_session",
            sessionId,
            "note",
            schedule?.ok
              ? `Session updated; scheduled for ${formatDateTimeInZone(schedule.epoch, schedule.timeZone)} in ${schedule.timeZone}.`
              : "Session updated.",
            me.id,
          ));
    (await db.exec("COMMIT"));
  } catch (error) {
    if (db.isTransaction) (await db.exec("ROLLBACK"));
    const code = error instanceof Error ? error.message : "";
    if (code === "session_missing") return { ok: false, error: "Not found." };
    if (code === "session_changed") return { ok: false, error: "This session changed. Refresh and try again." };
    if (code === "facilitator_unavailable") return { ok: false, error: "Choose an active staff facilitator." };
    if (code === "session_evidence_locked") {
      return { ok: false, error: "The session definition is locked once delivery starts or attendance evidence exists. Add facilitator notes or create a successor session instead." };
    }
    if (code === "session_time_passed") return { ok: false, error: "Choose a future training time." };
    throw error;
  }

  revalidatePath("/app/training");
  revalidatePath(`/app/training/sessions/${sessionId}`);
  revalidatePath("/app/teach");
  if (readinessChanged) {
    revalidatePath("/app/instructors");
    revalidatePath("/app");
  }
  return { ok: true };
}

export async function addFacilitatorNotes(
  sessionId: string,
  notes: string,
  expectedUpdatedAt: number,
): Promise<ActionResult & { updatedAt?: number }> {
  const me = await requireStaff();
  const sessionKey = String(sessionId ?? "").trim();
  if (!sessionKey || sessionKey.length > 100) return { ok: false, error: "Choose a valid training session." };
  if (typeof notes !== "string") return { ok: false, error: "Enter valid facilitator notes." };
  if (!Number.isSafeInteger(expectedUpdatedAt) || expectedUpdatedAt < 0) {
    return { ok: false, error: "Refresh this training session before saving notes." };
  }
  const text = notes.trim();
  if (text.length > 4000) return { ok: false, error: "Facilitator notes must be 4,000 characters or fewer." };
  const db = getDb();
  let savedUpdatedAt: number | undefined;
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const row = (await db.prepare("SELECT updated_at FROM training_sessions WHERE id = ?").get(sessionKey)) as
      | { updated_at: number }
      | undefined;
    if (!row) throw new Error("session_missing");
    if (row.updated_at !== expectedUpdatedAt) throw new Error("session_changed");
    savedUpdatedAt = nextUpdatedAt(row.updated_at);
    const updated = (await db.prepare(
          "UPDATE training_sessions SET facilitator_notes = ?, updated_at = ? WHERE id = ? AND updated_at = ?",
        ).run(text || null, savedUpdatedAt, sessionKey, row.updated_at));
    if (updated.changes !== 1) throw new Error("session_changed");
    (await logActivity("training_session", sessionKey, "note", "Facilitator notes updated.", me.id));
    (await db.exec("COMMIT"));
  } catch (error) {
    if (db.isTransaction) (await db.exec("ROLLBACK"));
    const code = error instanceof Error ? error.message : "";
    if (code === "session_missing") return { ok: false, error: "Not found." };
    if (code === "session_changed") return { ok: false, error: "This session changed. Refresh before saving notes." };
    throw error;
  }
  revalidatePath(`/app/training/sessions/${sessionKey}`);
  return { ok: true, updatedAt: savedUpdatedAt };
}

/* ---------------- registration + attendance ---------------- */

export async function registerForTrainingSession(sessionId: string, instructorId: string): Promise<ActionResult> {
  const me = await requireRole("admin", "growth", "instructor");
  const sessionKey = String(sessionId ?? "").trim();
  const instructorKey = String(instructorId ?? "").trim();
  if (!sessionKey || sessionKey.length > 100 || !instructorKey || instructorKey.length > 100) {
    return { ok: false, error: "Choose a valid training session and instructor." };
  }
  const db = getDb();
  if (me.role === "instructor") {
    const self = (await getInstructorByUserId(me.id));
    if (!self || self.id !== instructorKey) return { ok: false, error: "You may only register yourself." };
  }

  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const session = (await db.prepare("SELECT scheduled_at, required FROM training_sessions WHERE id = ?").get(sessionKey)) as
      | { scheduled_at: number; required: number }
      | undefined;
    if (!session) throw new Error("session_missing");
    const instructor = (await db.prepare(
          `SELECT i.id, p.user_id
         FROM instructors i
         JOIN people p ON p.id = i.person_id
        WHERE i.id = ? AND i.stage NOT IN ('rejected','inactive')`,
        ).get(instructorKey)) as { id: string; user_id: string | null } | undefined;
    if (!instructor) throw new Error("instructor_missing");
    if (me.role === "instructor" && instructor.user_id !== me.id) throw new Error("forbidden");
    const now = Date.now();
    if (me.role === "instructor" && session.scheduled_at <= now) throw new Error("registration_closed");

    const existing = (await db.prepare(
          "SELECT id FROM training_session_registrations WHERE session_id = ? AND instructor_id = ? LIMIT 1",
        ).get(sessionKey, instructorKey));
    if (!existing) {
      (await db.prepare(
                "INSERT INTO training_session_registrations (id, session_id, instructor_id, registered_at) VALUES (?, ?, ?, ?)",
              ).run(`pfx-${randomUUID().slice(0, 8)}`, sessionKey, instructorKey, now));
      (await logActivity(
                "instructor",
                instructorKey,
                "note",
                session.scheduled_at <= now
                  ? "Added to a training-session roster after the scheduled start by staff."
                  : "Registered for a training session.",
                me.id,
              ));
    }
    if (session.required === 1) (await recomputeInstructorStatuses(instructorKey));
    (await db.exec("COMMIT"));
  } catch (error) {
    if (db.isTransaction) (await db.exec("ROLLBACK"));
    const code = error instanceof Error ? error.message : "";
    if (code === "session_missing") return { ok: false, error: "Not found." };
    if (code === "instructor_missing") return { ok: false, error: "Choose a current instructor." };
    if (code === "forbidden") return { ok: false, error: "You may only register yourself." };
    if (code === "registration_closed") return { ok: false, error: "Self-registration closes when the session starts. Ask BOW staff to correct the roster." };
    throw error;
  }

  revalidatePath(`/app/training/sessions/${sessionKey}`);
  revalidateInstructorReadiness(instructorKey);
  return { ok: true };
}

export async function recordSessionAttendance(
  sessionId: string,
  instructorId: string,
  attended: boolean,
  expectedRecordedAt: number | null,
): Promise<ActionResult & { recordedAt?: number }> {
  const me = await requireStaff();
  const sessionKey = String(sessionId ?? "").trim();
  const instructorKey = String(instructorId ?? "").trim();
  if (!sessionKey || sessionKey.length > 100 || !instructorKey || instructorKey.length > 100) {
    return { ok: false, error: "Choose a valid training session and instructor." };
  }
  if (typeof attended !== "boolean") return { ok: false, error: "Choose attended or absent." };
  if (!(expectedRecordedAt === null || (Number.isSafeInteger(expectedRecordedAt) && expectedRecordedAt >= 0))) {
    return { ok: false, error: "Refresh this attendance record before changing it." };
  }
  const db = getDb();
  let savedRecordedAt: number | undefined;
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const session = (await db.prepare("SELECT scheduled_at FROM training_sessions WHERE id = ?").get(sessionKey)) as
      | { scheduled_at: number }
      | undefined;
    if (!session) throw new Error("session_missing");
    if (session.scheduled_at > Date.now()) throw new Error("session_not_started");
    if (!(await db.prepare("SELECT 1 FROM instructors WHERE id = ? AND stage NOT IN ('rejected','inactive')").get(instructorKey))) {
      throw new Error("instructor_missing");
    }
    if (
      !(await db.prepare("SELECT 1 FROM training_session_registrations WHERE session_id = ? AND instructor_id = ?").get(
                sessionKey,
                instructorKey,
              ))
    ) {
      throw new Error("not_registered");
    }
    const now = Date.now();
    const existing = (await db.prepare(
          "SELECT id, recorded_at FROM training_session_attendance WHERE session_id = ? AND instructor_id = ?",
        ).get(sessionKey, instructorKey)) as { id: string; recorded_at: number } | undefined;
    if (
      (existing && expectedRecordedAt !== existing.recorded_at)
      || (!existing && expectedRecordedAt !== null)
    ) {
      throw new Error("attendance_changed");
    }
    if (existing) {
      savedRecordedAt = nextUpdatedAt(existing.recorded_at);
      const written = (await db.prepare(
              `UPDATE training_session_attendance
            SET attended = ?, recorded_at = ?, recorded_by = ?
          WHERE id = ? AND recorded_at = ?`,
            ).run(attended ? 1 : 0, savedRecordedAt, me.id, existing.id, existing.recorded_at));
      if (written.changes !== 1) throw new Error("attendance_changed");
    } else {
      savedRecordedAt = now;
      (await db.prepare(
                `INSERT INTO training_session_attendance
          (id, session_id, instructor_id, attended, recorded_at, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
              ).run(`pfx-${randomUUID().slice(0, 8)}`, sessionKey, instructorKey, attended ? 1 : 0, savedRecordedAt, me.id));
    }
    (await recomputeInstructorStatuses(instructorKey));
    (await logActivity("instructor", instructorKey, "note", `Attendance recorded for a training session: ${attended ? "attended" : "absent"}.`, me.id));
    (await db.exec("COMMIT"));
  } catch (error) {
    if (db.isTransaction) (await db.exec("ROLLBACK"));
    const code = error instanceof Error ? error.message : "";
    if (code === "session_missing") return { ok: false, error: "Not found." };
    if (code === "session_not_started") return { ok: false, error: "Attendance opens when the training session starts." };
    if (code === "instructor_missing") return { ok: false, error: "Choose a current instructor." };
    if (code === "not_registered") return { ok: false, error: "Add this instructor to the session roster before recording attendance." };
    if (code === "attendance_changed") return { ok: false, error: "Attendance changed. Refresh and try again." };
    throw error;
  }

  revalidatePath(`/app/training/sessions/${sessionKey}`);
  revalidateInstructorReadiness(instructorKey);
  return { ok: true, recordedAt: savedRecordedAt };
}
