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
import { logActivity, getInstructorByUserId, recomputeInstructorStatuses } from "@/lib/hiring";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const CATEGORIES = new Set(["onboarding", "training"]);
const CONTENT_TYPES = new Set(["text", "link"]);

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
  const title = (input.title ?? "").trim();
  if (!title) return { ok: false, error: "Title is required." };
  if (title.length > 200) return { ok: false, error: "Title is too long." };
  if (!CATEGORIES.has(input.category)) return { ok: false, error: "Invalid category." };
  if (!CONTENT_TYPES.has(input.contentType)) return { ok: false, error: "Invalid content type." };
  const content = (input.content ?? "").trim().slice(0, 4000);
  const ordinal = Number.isFinite(input.ordinal) ? Math.max(0, Math.trunc(input.ordinal as number)) : 0;

  const id = `pfx-${randomUUID().slice(0, 8)}`;
  const now = Date.now();
  getDb()
    .prepare(
      "INSERT INTO training_modules (id, title, category, required, content_type, content, ordinal, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
    )
    .run(id, title.slice(0, 200), input.category, input.required ? 1 : 0, input.contentType, content || null, ordinal, now, now);

  logActivity("training_module", id, "note", `Module "${title}" created.`, me.id);
  revalidatePath("/app/training");
  return { ok: true };
}

export interface UpdateModulePatch {
  title?: string;
  category?: "onboarding" | "training";
  required?: boolean;
  contentType?: "text" | "link";
  content?: string;
  ordinal?: number;
}

export async function updateTrainingModule(id: string, patch: UpdateModulePatch): Promise<ActionResult> {
  const me = await requireStaff();
  const db = getDb();
  const row = db.prepare("SELECT * FROM training_modules WHERE id = ?").get(id) as { id: string } | undefined;
  if (!row) return { ok: false, error: "Not found." };

  const next = {
    title: patch.title !== undefined ? patch.title.trim().slice(0, 200) : undefined,
    category: patch.category !== undefined && CATEGORIES.has(patch.category) ? patch.category : undefined,
    required: patch.required !== undefined ? (patch.required ? 1 : 0) : undefined,
    content_type: patch.contentType !== undefined && CONTENT_TYPES.has(patch.contentType) ? patch.contentType : undefined,
    content: patch.content !== undefined ? patch.content.trim().slice(0, 4000) : undefined,
    ordinal: patch.ordinal !== undefined && Number.isFinite(patch.ordinal) ? Math.max(0, Math.trunc(patch.ordinal)) : undefined,
  };
  if (next.title !== undefined && !next.title) return { ok: false, error: "Title can't be empty." };

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(next)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    values.push(v);
  }
  if (sets.length === 0) return { ok: true };
  sets.push("updated_at = ?");
  values.push(Date.now(), id);
  db.prepare(`UPDATE training_modules SET ${sets.join(", ")} WHERE id = ?`).run(...(values as (string | number | null)[]));

  logActivity("training_module", id, "note", "Module updated.", me.id);
  revalidatePath("/app/training");
  return { ok: true };
}

export async function archiveTrainingModule(id: string): Promise<ActionResult> {
  const me = await requireStaff();
  const db = getDb();
  const row = db.prepare("SELECT * FROM training_modules WHERE id = ?").get(id) as { id: string } | undefined;
  if (!row) return { ok: false, error: "Not found." };
  db.prepare("UPDATE training_modules SET active = 0, updated_at = ? WHERE id = ?").run(Date.now(), id);
  logActivity("training_module", id, "note", "Module archived.", me.id);
  revalidatePath("/app/training");
  return { ok: true };
}

/* ---------------- sessions ---------------- */

export interface CreateSessionInput {
  title: string;
  scheduledAt: number;
  location?: string;
  meetingLink?: string;
  facilitatorUserId?: string;
  required: boolean;
}

export async function createTrainingSession(input: CreateSessionInput): Promise<ActionResult> {
  const me = await requireStaff();
  const title = (input.title ?? "").trim();
  if (!title) return { ok: false, error: "Title is required." };
  if (title.length > 200) return { ok: false, error: "Title is too long." };
  if (!Number.isFinite(input.scheduledAt) || input.scheduledAt <= 0) return { ok: false, error: "Invalid date/time." };

  const id = `pfx-${randomUUID().slice(0, 8)}`;
  const now = Date.now();
  getDb()
    .prepare(
      "INSERT INTO training_sessions (id, title, scheduled_at, location, meeting_link, facilitator_user_id, required, facilitator_notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)",
    )
    .run(
      id,
      title.slice(0, 200),
      input.scheduledAt,
      (input.location ?? "").trim().slice(0, 200) || null,
      (input.meetingLink ?? "").trim().slice(0, 400) || null,
      (input.facilitatorUserId ?? "").trim().slice(0, 60) || null,
      input.required ? 1 : 0,
      now,
      now,
    );

  logActivity("training_session", id, "note", `Session "${title}" scheduled.`, me.id);
  revalidatePath("/app/training");
  return { ok: true };
}

export interface UpdateSessionPatch {
  title?: string;
  scheduledAt?: number;
  location?: string;
  meetingLink?: string;
  facilitatorUserId?: string;
  required?: boolean;
}

export async function updateTrainingSession(id: string, patch: UpdateSessionPatch): Promise<ActionResult> {
  const me = await requireStaff();
  const db = getDb();
  const row = db.prepare("SELECT * FROM training_sessions WHERE id = ?").get(id) as { id: string } | undefined;
  if (!row) return { ok: false, error: "Not found." };

  const next = {
    title: patch.title !== undefined ? patch.title.trim().slice(0, 200) : undefined,
    scheduled_at: patch.scheduledAt !== undefined && Number.isFinite(patch.scheduledAt) ? patch.scheduledAt : undefined,
    location: patch.location !== undefined ? patch.location.trim().slice(0, 200) || null : undefined,
    meeting_link: patch.meetingLink !== undefined ? patch.meetingLink.trim().slice(0, 400) || null : undefined,
    facilitator_user_id: patch.facilitatorUserId !== undefined ? patch.facilitatorUserId.trim().slice(0, 60) || null : undefined,
    required: patch.required !== undefined ? (patch.required ? 1 : 0) : undefined,
  };
  if (next.title !== undefined && !next.title) return { ok: false, error: "Title can't be empty." };

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(next)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    values.push(v);
  }
  if (sets.length === 0) return { ok: true };
  sets.push("updated_at = ?");
  values.push(Date.now(), id);
  db.prepare(`UPDATE training_sessions SET ${sets.join(", ")} WHERE id = ?`).run(...(values as (string | number | null)[]));

  // Attendance/registration windows may now include/exclude instructors —
  // recompute anyone registered so a required-session edit can't silently
  // desync their cached training_status.
  const affected = db.prepare("SELECT DISTINCT instructor_id FROM training_session_registrations WHERE session_id = ?").all(id) as {
    instructor_id: string;
  }[];
  for (const r of affected) recomputeInstructorStatuses(r.instructor_id);

  logActivity("training_session", id, "note", "Session updated.", me.id);
  revalidatePath("/app/training");
  revalidatePath(`/app/training/sessions/${id}`);
  return { ok: true };
}

export async function addFacilitatorNotes(sessionId: string, notes: string): Promise<ActionResult> {
  const me = await requireStaff();
  const db = getDb();
  const row = db.prepare("SELECT * FROM training_sessions WHERE id = ?").get(sessionId) as { id: string } | undefined;
  if (!row) return { ok: false, error: "Not found." };
  const text = (notes ?? "").trim().slice(0, 4000);

  db.prepare("UPDATE training_sessions SET facilitator_notes = ?, updated_at = ? WHERE id = ?").run(text || null, Date.now(), sessionId);
  logActivity("training_session", sessionId, "note", "Facilitator notes updated.", me.id);
  revalidatePath(`/app/training/sessions/${sessionId}`);
  return { ok: true };
}

/* ---------------- registration + attendance ---------------- */

export async function registerForTrainingSession(sessionId: string, instructorId: string): Promise<ActionResult> {
  const me = await requireRole("admin", "growth", "instructor");
  const db = getDb();
  const session = db.prepare("SELECT * FROM training_sessions WHERE id = ?").get(sessionId) as { id: string } | undefined;
  if (!session) return { ok: false, error: "Not found." };

  if (me.role === "instructor") {
    const self = getInstructorByUserId(me.id);
    if (!self || self.id !== instructorId) return { ok: false, error: "You may only register yourself." };
  }

  const existing = db
    .prepare("SELECT id FROM training_session_registrations WHERE session_id = ? AND instructor_id = ?")
    .get(sessionId, instructorId);
  if (!existing) {
    db.prepare(
      "INSERT INTO training_session_registrations (id, session_id, instructor_id, registered_at) VALUES (?, ?, ?, ?)",
    ).run(`pfx-${randomUUID().slice(0, 8)}`, sessionId, instructorId, Date.now());
    logActivity("instructor", instructorId, "note", "Registered for a training session.", me.id);
  }

  revalidatePath(`/app/training/sessions/${sessionId}`);
  revalidatePath("/app/teach");
  return { ok: true };
}

export async function recordSessionAttendance(sessionId: string, instructorId: string, attended: boolean): Promise<ActionResult> {
  const me = await requireStaff();
  const db = getDb();
  const session = db.prepare("SELECT * FROM training_sessions WHERE id = ?").get(sessionId) as { id: string } | undefined;
  if (!session) return { ok: false, error: "Not found." };
  const instructor = db.prepare("SELECT id FROM instructors WHERE id = ?").get(instructorId) as { id: string } | undefined;
  if (!instructor) return { ok: false, error: "Instructor not found." };

  const now = Date.now();
  const existing = db
    .prepare("SELECT id FROM training_session_attendance WHERE session_id = ? AND instructor_id = ?")
    .get(sessionId, instructorId) as { id: string } | undefined;
  if (existing) {
    db.prepare("UPDATE training_session_attendance SET attended = ?, recorded_at = ?, recorded_by = ? WHERE id = ?").run(
      attended ? 1 : 0,
      now,
      me.id,
      existing.id,
    );
  } else {
    db.prepare(
      "INSERT INTO training_session_attendance (id, session_id, instructor_id, attended, recorded_at, recorded_by) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(`pfx-${randomUUID().slice(0, 8)}`, sessionId, instructorId, attended ? 1 : 0, now, me.id);
  }

  recomputeInstructorStatuses(instructorId);
  logActivity("instructor", instructorId, "note", `Attendance recorded for a training session: ${attended ? "attended" : "absent"}.`, me.id);

  revalidatePath(`/app/training/sessions/${sessionId}`);
  revalidatePath(`/app/instructors/${instructorId}`);
  revalidatePath("/app/training");
  return { ok: true };
}
