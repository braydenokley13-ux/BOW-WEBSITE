"use server";

/* ============================================================
 * Program setup, requirement builder, and registration launch.
 *
 * Configuration only — no seat, reservation, or waitlist state is ever
 * written here (that is lib/enrollment.ts's job). Saving is deliberately
 * partial-tolerant: a draft program must be able to save incomplete work,
 * so nothing here requires a field beyond basic type/range validation.
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/dal";
import { recordAudit } from "@/lib/enrollment";
import { registrationReadiness } from "@/lib/program-admin";
import { REQUIREMENT_KINDS } from "@/lib/enrollment-shared";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function clean(value: FormDataEntryValue | null, max = 4000): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, max) : null;
}

function cleanInt(value: FormDataEntryValue | null): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function cleanBool(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}

async function requireProgram(programId: string) {
  const row = (await getDb().prepare("SELECT id FROM programs WHERE id = ?").get(programId)) as { id: string } | undefined;
  return row;
}

function refresh(programId: string) {
  revalidatePath(`/app/programs/${programId}`);
  revalidatePath(`/app/programs/${programId}/setup`);
  revalidatePath(`/app/programs/${programId}/enrollment`);
  revalidatePath(`/app/programs/${programId}/requirements`);
}

/* ===================================================================== */
/* Setup sections                                                        */
/* ===================================================================== */

const GRADE_LEVELS: Record<string, number> = { K: 0, TK: -1 };

function parseGradeInput(value: FormDataEntryValue | null): number | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  const upper = text.toUpperCase();
  if (upper in GRADE_LEVELS) return GRADE_LEVELS[upper];
  const n = Number(text);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export async function saveProgramBasics(programId: string, formData: FormData): Promise<ActionResult> {
  await requireStaff();
  if (!(await requireProgram(programId))) return { ok: false, error: "Program not found." };
  const name = clean(formData.get("name"), 160);
  if (!name) return { ok: false, error: "Program name is required." };
  const gradeMin = parseGradeInput(formData.get("gradeMin"));
  const gradeMax = parseGradeInput(formData.get("gradeMax"));
  if (gradeMin != null && gradeMax != null && gradeMin > gradeMax) {
    return { ok: false, error: "Minimum grade cannot be higher than maximum grade." };
  }
  const db = getDb();
  await db
    .prepare(
      `UPDATE programs SET
         name = ?, short_description = ?, long_description = ?, internal_description = ?,
         audience = ?, delivery_format = COALESCE(?, delivery_format), grade_min = ?, grade_max = ?,
         experience_level = ?, location_id = ?, schedule_timezone = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      name,
      clean(formData.get("shortDescription"), 400),
      clean(formData.get("longDescription"), 8000),
      clean(formData.get("internalDescription"), 8000),
      clean(formData.get("track"), 120),
      clean(formData.get("deliveryFormat"), 40),
      gradeMin,
      gradeMax,
      clean(formData.get("experienceLevel"), 80),
      clean(formData.get("locationId"), 120),
      clean(formData.get("timezone"), 100),
      Date.now(),
      programId,
    );
  refresh(programId);
  return { ok: true };
}

export async function saveProgramSchedule(programId: string, formData: FormData): Promise<ActionResult> {
  await requireStaff();
  if (!(await requireProgram(programId))) return { ok: false, error: "Program not found." };
  const startDate = clean(formData.get("startDate"), 40);
  const endDate = clean(formData.get("endDate"), 40);
  if (startDate && endDate && Date.parse(endDate) < Date.parse(startDate)) {
    return { ok: false, error: "End date cannot be before the start date." };
  }
  await getDb()
    .prepare(
      `UPDATE programs SET
         start_date = ?, end_date = ?, schedule_label = ?,
         schedule_day = ?, schedule_start_time = ?, schedule_end_time = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      startDate,
      endDate,
      clean(formData.get("recurringPattern"), 200),
      cleanInt(formData.get("scheduleDay")),
      clean(formData.get("sessionStartTime"), 5),
      clean(formData.get("sessionEndTime"), 5),
      Date.now(),
      programId,
    );
  refresh(programId);
  return { ok: true };
}

export async function saveProgramCapacity(programId: string, formData: FormData): Promise<ActionResult> {
  await requireStaff();
  if (!(await requireProgram(programId))) return { ok: false, error: "Program not found." };
  const capacity = cleanInt(formData.get("capacity"));
  const minimum = cleanInt(formData.get("minimumEnrollment"));
  if (capacity != null && capacity < 0) return { ok: false, error: "Capacity cannot be negative." };
  if (minimum != null && capacity != null && minimum > capacity) {
    return { ok: false, error: "Minimum enrollment cannot exceed capacity." };
  }
  await getDb()
    .prepare(
      `UPDATE programs SET capacity = ?, minimum_enrollment = COALESCE(?, minimum_enrollment), registration_deadline = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(capacity, minimum ?? 1, clean(formData.get("registrationDeadline"), 40), Date.now(), programId);
  refresh(programId);
  return { ok: true };
}

const REGISTRATION_MODES = new Set(["immediate", "approval"]);
const PUBLIC_STATUSES = new Set(["coming_soon", "open", "closed"]);

export async function saveProgramRegistration(programId: string, formData: FormData): Promise<ActionResult> {
  await requireStaff();
  if (!(await requireProgram(programId))) return { ok: false, error: "Program not found." };
  const registrationMode = clean(formData.get("registrationMode"), 20) ?? "immediate";
  if (!REGISTRATION_MODES.has(registrationMode)) return { ok: false, error: "Choose a valid registration mode." };
  const publicStatus = clean(formData.get("publicStatus"), 20) ?? "coming_soon";
  if (!PUBLIC_STATUSES.has(publicStatus)) return { ok: false, error: "Choose a valid public availability state." };
  const reservationEnabled = cleanBool(formData.get("reservationEnabled"));
  const reservationHours = cleanInt(formData.get("reservationHours")) ?? 72;
  if (reservationEnabled && (reservationHours <= 0 || reservationHours > 24 * 60)) {
    return { ok: false, error: "Reservation window must be between 1 and 1440 hours." };
  }
  await getDb()
    .prepare(
      `UPDATE programs SET
         registration_mode = ?, is_public = ?, public_status = ?,
         registration_opens_at = ?, reservation_enabled = ?, reservation_hours = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      registrationMode,
      cleanBool(formData.get("isPublic")),
      publicStatus,
      clean(formData.get("registrationOpensAt"), 40),
      reservationEnabled,
      reservationHours,
      Date.now(),
      programId,
    );
  refresh(programId);
  return { ok: true };
}

const WAITLIST_MODES = new Set(["disabled", "automatic", "manual"]);

export async function saveProgramWaitlist(programId: string, formData: FormData): Promise<ActionResult> {
  await requireStaff();
  if (!(await requireProgram(programId))) return { ok: false, error: "Program not found." };
  const mode = clean(formData.get("waitlistMode"), 20) ?? "disabled";
  if (!WAITLIST_MODES.has(mode)) return { ok: false, error: "Choose a valid waitlist mode." };
  const offerHours = cleanInt(formData.get("waitlistOfferHours")) ?? 48;
  if (mode !== "disabled" && (offerHours <= 0 || offerHours > 24 * 60)) {
    return { ok: false, error: "Offer expiration must be between 1 and 1440 hours." };
  }
  await getDb()
    .prepare("UPDATE programs SET waitlist_mode = ?, waitlist_offer_hours = ?, updated_at = ? WHERE id = ?")
    .run(mode, offerHours, Date.now(), programId);
  refresh(programId);
  return { ok: true };
}

export async function saveProgramCommunication(programId: string, formData: FormData): Promise<ActionResult> {
  await requireStaff();
  if (!(await requireProgram(programId))) return { ok: false, error: "Program not found." };
  await getDb()
    .prepare(
      `UPDATE programs SET confirmation_message = ?, next_steps_message = ?, support_contact = ?, what_to_bring = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      clean(formData.get("confirmationMessage"), 2000),
      clean(formData.get("nextStepsMessage"), 2000),
      clean(formData.get("supportContact"), 300),
      clean(formData.get("whatToBring"), 2000),
      Date.now(),
      programId,
    );
  refresh(programId);
  return { ok: true };
}

export async function saveProgramCompletion(programId: string, formData: FormData): Promise<ActionResult> {
  await requireStaff();
  if (!(await requireProgram(programId))) return { ok: false, error: "Program not found." };
  const minAttendance = cleanInt(formData.get("completionMinAttendance"));
  if (minAttendance != null && (minAttendance < 0 || minAttendance > 100)) {
    return { ok: false, error: "Minimum attendance must be a percentage between 0 and 100." };
  }
  await getDb()
    .prepare(
      `UPDATE programs SET
         completion_min_attendance = ?, completion_requires_instructor = ?, completion_requires_admin = ?,
         certificate_enabled = ?, feedback_enabled = ?, recommended_next_program_id = ?, prerequisite_program_id = ?,
         updated_at = ?
       WHERE id = ?`,
    )
    .run(
      minAttendance,
      cleanBool(formData.get("completionRequiresInstructor")),
      cleanBool(formData.get("completionRequiresAdmin")),
      cleanBool(formData.get("certificateEnabled")),
      cleanBool(formData.get("feedbackEnabled")),
      clean(formData.get("recommendedNextProgramId"), 120),
      clean(formData.get("prerequisiteProgramId"), 120),
      Date.now(),
      programId,
    );
  refresh(programId);
  return { ok: true };
}

/* ===================================================================== */
/* Duplicate / template start                                            */
/* ===================================================================== */

/** Copy every setup field from an existing program into a fresh draft. */
export async function duplicateProgramSetup(sourceProgramId: string): Promise<{ ok: boolean; error?: string; newProgramId?: string }> {
  const me = await requireStaff();
  const db = getDb();
  const source = (await db.prepare("SELECT * FROM programs WHERE id = ?").get(sourceProgramId)) as
    | Record<string, unknown>
    | undefined;
  if (!source) return { ok: false, error: "Source program not found." };
  const id = `prog-${randomUUID().slice(0, 12)}`;
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO programs (
         id, name, partner_org_id, primary_contact_person_id, location_id, curriculum_id, audience,
         delivery_format, stage, schedule_label, schedule_day, schedule_start_time, schedule_end_time,
         schedule_timezone, minimum_enrollment, owner_user_id, materials_status, renewal_status, source_type,
         internal_description, experience_level, grade_min, grade_max, reservation_enabled, reservation_hours,
         waitlist_mode, waitlist_offer_hours, confirmation_message, next_steps_message, support_contact,
         completion_min_attendance, completion_requires_instructor, completion_requires_admin, certificate_enabled,
         feedback_enabled, short_description, long_description, grade_range, registration_mode, full_capacity_behavior,
         is_public, public_status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'opportunity', ?, ?, ?, ?, ?, ?, ?, 'not_ready', 'not_due', 'manual',
         ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false, 'coming_soon', ?, ?)`,
    )
    .run(
      id,
      `${source.name as string} (copy)`,
      source.partner_org_id ?? null,
      source.primary_contact_person_id ?? null,
      source.location_id ?? null,
      source.curriculum_id ?? null,
      source.audience ?? null,
      source.delivery_format ?? "in_person",
      source.schedule_label ?? null,
      source.schedule_day ?? null,
      source.schedule_start_time ?? null,
      source.schedule_end_time ?? null,
      source.schedule_timezone ?? null,
      source.minimum_enrollment ?? 1,
      me.id,
      source.internal_description ?? null,
      source.experience_level ?? null,
      source.grade_min ?? null,
      source.grade_max ?? null,
      source.reservation_enabled ?? false,
      source.reservation_hours ?? 72,
      source.waitlist_mode ?? "disabled",
      source.waitlist_offer_hours ?? 48,
      source.confirmation_message ?? null,
      source.next_steps_message ?? null,
      source.support_contact ?? null,
      source.completion_min_attendance ?? null,
      source.completion_requires_instructor ?? false,
      source.completion_requires_admin ?? true,
      source.certificate_enabled ?? false,
      source.feedback_enabled ?? true,
      source.short_description ?? null,
      source.long_description ?? null,
      source.grade_range ?? null,
      source.registration_mode ?? "immediate",
      source.full_capacity_behavior ?? "waitlist",
      now,
      now,
    );

  // Requirements copy over too — a duplicated program should not force the
  // admin to rebuild the family-facing to-do list from scratch.
  const requirements = (await db.prepare("SELECT * FROM program_requirements WHERE program_id = ?").all(sourceProgramId)) as unknown as Array<
    Record<string, unknown>
  >;
  for (const r of requirements) {
    await db
      .prepare(
        `INSERT INTO program_requirements
           (id, program_id, kind, prompt, help_text, scope, required, blocks_confirmation, staff_approval_required,
            visibility, choices, due_days_before_start, sort_order, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        `preq-${randomUUID().slice(0, 12)}`,
        id,
        r.kind,
        r.prompt,
        r.help_text ?? null,
        r.scope,
        r.required,
        r.blocks_confirmation,
        r.staff_approval_required,
        r.visibility,
        r.choices ?? null,
        r.due_days_before_start ?? null,
        r.sort_order,
        r.active,
        now,
        now,
      );
  }

  return { ok: true, newProgramId: id };
}

/* ===================================================================== */
/* Requirement builder                                                   */
/* ===================================================================== */

export async function createRequirement(programId: string, formData: FormData): Promise<ActionResult> {
  const me = await requireStaff();
  if (!(await requireProgram(programId))) return { ok: false, error: "Program not found." };
  const kind = clean(formData.get("kind"), 40);
  const prompt = clean(formData.get("prompt"), 500);
  if (!kind || !(REQUIREMENT_KINDS as readonly string[]).includes(kind)) return { ok: false, error: "Choose a requirement type." };
  if (!prompt) return { ok: false, error: "Write the question families will see." };
  const visibility = clean(formData.get("visibility"), 30) ?? "admin";
  if (!["admin", "admin_instructor", "instructor_summary"].includes(visibility)) {
    return { ok: false, error: "Choose a valid visibility." };
  }
  const db = getDb();
  const nextOrder = (await db.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM program_requirements WHERE program_id = ?").get(programId)) as {
    n: number;
  };
  const now = Date.now();
  const id = `preq-${randomUUID().slice(0, 12)}`;
  await db
    .prepare(
      `INSERT INTO program_requirements
         (id, program_id, kind, prompt, help_text, scope, required, blocks_confirmation, staff_approval_required,
          visibility, choices, due_days_before_start, sort_order, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true, ?, ?)`,
    )
    .run(
      id,
      programId,
      kind,
      prompt,
      clean(formData.get("helpText"), 1000),
      clean(formData.get("scope"), 10) ?? "student",
      cleanBool(formData.get("required")),
      cleanBool(formData.get("blocksConfirmation")),
      cleanBool(formData.get("staffApprovalRequired")),
      visibility,
      clean(formData.get("choices"), 1000),
      cleanInt(formData.get("dueDaysBeforeStart")),
      nextOrder.n,
      now,
      now,
    );
  await recordAudit({ programId, actorUserId: me.id, actorLabel: `${me.name} (staff)`, action: "requirement_created", newState: kind });
  refresh(programId);
  return { ok: true };
}

export async function updateRequirement(requirementId: string, formData: FormData): Promise<ActionResult> {
  await requireStaff();
  const db = getDb();
  const existing = (await db.prepare("SELECT program_id FROM program_requirements WHERE id = ?").get(requirementId)) as
    | { program_id: string }
    | undefined;
  if (!existing) return { ok: false, error: "Requirement not found." };
  const prompt = clean(formData.get("prompt"), 500);
  if (!prompt) return { ok: false, error: "Write the question families will see." };
  const visibility = clean(formData.get("visibility"), 30) ?? "admin";
  if (!["admin", "admin_instructor", "instructor_summary"].includes(visibility)) {
    return { ok: false, error: "Choose a valid visibility." };
  }
  await db
    .prepare(
      `UPDATE program_requirements SET
         prompt = ?, help_text = ?, required = ?, blocks_confirmation = ?, staff_approval_required = ?,
         visibility = ?, choices = ?, due_days_before_start = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      prompt,
      clean(formData.get("helpText"), 1000),
      cleanBool(formData.get("required")),
      cleanBool(formData.get("blocksConfirmation")),
      cleanBool(formData.get("staffApprovalRequired")),
      visibility,
      clean(formData.get("choices"), 1000),
      cleanInt(formData.get("dueDaysBeforeStart")),
      Date.now(),
      requirementId,
    );
  refresh(existing.program_id);
  return { ok: true };
}

/** Deactivate rather than delete — families with an existing answer keep it. */
export async function deactivateRequirement(requirementId: string): Promise<ActionResult> {
  await requireStaff();
  const db = getDb();
  const existing = (await db.prepare("SELECT program_id FROM program_requirements WHERE id = ?").get(requirementId)) as
    | { program_id: string }
    | undefined;
  if (!existing) return { ok: false, error: "Requirement not found." };
  await db.prepare("UPDATE program_requirements SET active = false, updated_at = ? WHERE id = ?").run(Date.now(), requirementId);
  refresh(existing.program_id);
  return { ok: true };
}

export async function reorderRequirement(requirementId: string, direction: "up" | "down"): Promise<ActionResult> {
  await requireStaff();
  const db = getDb();
  const current = (await db
    .prepare("SELECT id, program_id, sort_order FROM program_requirements WHERE id = ?")
    .get(requirementId)) as { id: string; program_id: string; sort_order: number } | undefined;
  if (!current) return { ok: false, error: "Requirement not found." };
  const neighbor = (await db
    .prepare(
      `SELECT id, sort_order FROM program_requirements
        WHERE program_id = ? AND sort_order ${direction === "up" ? "<" : ">"} ?
        ORDER BY sort_order ${direction === "up" ? "DESC" : "ASC"} LIMIT 1`,
    )
    .get(current.program_id, current.sort_order)) as { id: string; sort_order: number } | undefined;
  if (!neighbor) return { ok: true }; // Already at the edge — a no-op, not an error.
  const now = Date.now();
  await db.prepare("UPDATE program_requirements SET sort_order = ?, updated_at = ? WHERE id = ?").run(neighbor.sort_order, now, current.id);
  await db.prepare("UPDATE program_requirements SET sort_order = ?, updated_at = ? WHERE id = ?").run(current.sort_order, now, neighbor.id);
  refresh(current.program_id);
  return { ok: true };
}

/* ===================================================================== */
/* Open registration                                                     */
/* ===================================================================== */

/**
 * Validate readiness, then open registration. A true blocker always stops
 * the action; an authorized override records why the risk was accepted, the
 * same pattern as the delivery-side launch exception in app/actions/programs.ts.
 */
export async function openRegistration(
  programId: string,
  options: { overrideReason?: string | null } = {},
): Promise<ActionResult> {
  const me = await requireStaff();
  const readiness = await registrationReadiness(programId);
  if (!readiness) return { ok: false, error: "Program not found." };

  if (readiness.blockers.length > 0) {
    if (!options.overrideReason || !options.overrideReason.trim()) {
      return {
        ok: false,
        error: `Registration is blocked: ${readiness.blockers.map((b) => b.label).join("; ")}. Fix these or provide an override reason to open anyway.`,
      };
    }
  }

  const db = getDb();
  const now = Date.now();
  await db
    .prepare(
      `UPDATE programs SET
         public_status = 'open', is_public = true, registration_opened_at = ?, registration_opened_by = ?,
         launch_exception_reason = COALESCE(?, launch_exception_reason),
         launch_exception_approved_by = CASE WHEN ? IS NOT NULL THEN ? ELSE launch_exception_approved_by END,
         launch_exception_approved_at = CASE WHEN ? IS NOT NULL THEN ? ELSE launch_exception_approved_at END,
         updated_at = ?
       WHERE id = ?`,
    )
    .run(
      now,
      me.id,
      options.overrideReason?.trim() ?? null,
      options.overrideReason?.trim() ?? null,
      me.id,
      options.overrideReason?.trim() ?? null,
      now,
      now,
      programId,
    );
  await recordAudit({
    programId,
    actorUserId: me.id,
    actorLabel: `${me.name} (staff)`,
    action: readiness.blockers.length > 0 ? "registration_opened_with_override" : "registration_opened",
    reason: options.overrideReason?.trim() ?? null,
  });
  refresh(programId);
  return { ok: true };
}
