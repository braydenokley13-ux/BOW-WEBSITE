"use server";

/* ============================================================
 * Instructor hiring pipeline — application intake through stage
 * transitions. Public application is the only unguarded action
 * here; everything else is staff (admin | growth) or, for the
 * founder-only calls, admin.
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireStaff, requireAdmin, requireInstructorSelf, requireRole } from "@/lib/dal";
import {
  logActivity,
  upsertPersonByEmail,
  getActiveInstructorForPerson,
  listStaffUserIds,
  createInvitationInternal,
  recomputeInstructorStatuses,
  type InstructorStage,
  type PracticeEvalDecision,
} from "@/lib/hiring";
import { createNotification } from "@/lib/notifications";
import { clientAddressBucket, consumeRateLimit } from "@/lib/rate-limit";
import {
  queueInvitationDelivery,
  type InvitationDeliveryState,
} from "@/lib/invitation-delivery";
import { formatDateTimeInZone, localDateTimeToEpoch } from "@/lib/timezone";

const SOURCES = new Set(["referral", "recruited", "other"]);
const BOW_ORG_ID = "org-bow";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/* ---------------- validation ---------------- */

interface ApplicationInput {
  name: string;
  email: string;
  phone?: string;
  answers?: Record<string, string>;
}

function validateApplication(input: ApplicationInput): { ok: true; name: string; email: string; phone: string; answers: Record<string, string> } | { ok: false; error: string } {
  const name = (input.name ?? "").trim();
  const email = (input.email ?? "").trim().toLowerCase();
  const phone = (input.phone ?? "").trim();

  if (!name) return { ok: false, error: "Name is required." };
  if (name.length > 120) return { ok: false, error: "Name is too long." };
  if (!/.+@.+\..+/.test(email)) return { ok: false, error: "A valid email is required." };
  if (email.length > 200) return { ok: false, error: "Email is too long." };
  if (phone.length > 40) return { ok: false, error: "Phone number is too long." };

  const rawAnswers = input.answers ?? {};
  const keys = Object.keys(rawAnswers);
  if (keys.length > 10) return { ok: false, error: "Too many application fields." };
  const answers: Record<string, string> = {};
  for (const k of keys) {
    const v = String(rawAnswers[k] ?? "");
    if (v.length > 2000) return { ok: false, error: "One of the answers is too long." };
    answers[k.slice(0, 60)] = v.slice(0, 2000);
  }

  return { ok: true, name: name.slice(0, 120), email: email.slice(0, 200), phone: phone.slice(0, 40), answers };
}

/* ---------------- create ---------------- */

/** PUBLIC — submitted from /get-involved/apply. No auth guard. */
export async function createInstructorApplication(input: ApplicationInput): Promise<ActionResult> {
  const v = validateApplication(input);
  if (!v.ok) return { ok: false, error: v.error };

  const address = await clientAddressBucket();
  if (address) {
    const networkLimit = (await consumeRateLimit("instructor-application-network", address, {
          limit: 12,
          windowMs: 24 * 60 * 60 * 1000,
          blockMs: 24 * 60 * 60 * 1000,
        }));
    if (!networkLimit.allowed) return { ok: false, error: "Too many applications were submitted from this network. Try again later." };
  }
  const identityLimit = (await consumeRateLimit("instructor-application-email", v.email, {
      limit: 3,
      windowMs: 30 * 24 * 60 * 60 * 1000,
      blockMs: 30 * 24 * 60 * 60 * 1000,
    }));
  if (!identityLimit.allowed) return { ok: false, error: "An application for this email was already submitted recently." };

  const id = `pfx-${randomUUID().slice(0, 8)}`;
  const now = Date.now();
  const db = getDb();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const personId = (await upsertPersonByEmail(v.name, v.email, v.phone));
    const existing = (await getActiveInstructorForPerson(personId));
    if (existing) throw new Error("application_exists");
    (await db.prepare(
            "INSERT INTO instructors (id, person_id, stage, source, owner_user_id, answers, created_at, updated_at) VALUES (?, ?, 'applied', 'public_application', NULL, ?, ?, ?)",
          ).run(id, personId, JSON.stringify(v.answers), now, now));

    (await logActivity("instructor", id, "note", `Application submitted by ${v.name} (${v.email}).`, null));
    const dueAt = now + 3 * 24 * 60 * 60 * 1000;
    (await db.prepare(
            "INSERT INTO tasks (id, title, owner_user_id, due_at, status, entity_type, entity_id, handoff_to_founder, created_at, updated_at) VALUES (?, ?, NULL, ?, 'open', 'instructor', ?, 0, ?, ?)",
          ).run(`pfx-${randomUUID().slice(0, 8)}`, `Review application: ${v.name}`, dueAt, id, now, now));

    for (const staffId of (await listStaffUserIds())) {
      (await createNotification({
                id: `ntf-instr-applied-${id}-${staffId}`,
                userId: staffId,
                type: "instructor_pipeline",
                title: "New instructor application",
                body: `${v.name} applied to teach with BOW.`,
                link: `/app/instructors/${id}`,
              }));
    }
    (await db.exec("COMMIT"));
  } catch (error) {
    try {
      (await db.exec("ROLLBACK"));
    } catch {
      // Preserve the intake failure.
    }
    if (error instanceof Error && error.message === "application_exists") return { ok: false, error: "exists" };
    return { ok: false, error: "The application could not be recorded. No intake records were changed." };
  }

  revalidatePath("/app/instructors");
  revalidatePath("/app");
  return { ok: true };
}

export interface ManualApplicationInput extends ApplicationInput {
  source: "referral" | "recruited" | "other";
}

/** Staff-entered lead — same shape as the public form, plus a required source. */
export async function createInstructorManually(input: ManualApplicationInput): Promise<ActionResult> {
  const me = await requireStaff();
  const v = validateApplication(input);
  if (!v.ok) return { ok: false, error: v.error };
  const source = SOURCES.has(input.source) ? input.source : "other";
  const id = `pfx-${randomUUID().slice(0, 8)}`;
  const now = Date.now();
  const db = getDb();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const personId = (await upsertPersonByEmail(v.name, v.email, v.phone));
    const existing = (await getActiveInstructorForPerson(personId));
    if (existing) throw new Error("application_exists");
    (await db.prepare(
            "INSERT INTO instructors (id, person_id, stage, source, owner_user_id, answers, created_at, updated_at) VALUES (?, ?, 'applied', ?, ?, ?, ?, ?)",
          )
          .run(id, personId, source, me.id, JSON.stringify(v.answers), now, now));
    (await logActivity("instructor", id, "note", `Added manually by staff (source: ${source}).`, me.id));
    (await db.exec("COMMIT"));
  } catch (error) {
    try {
      (await db.exec("ROLLBACK"));
    } catch {
      // Preserve the intake failure.
    }
    if (error instanceof Error && error.message === "application_exists") return { ok: false, error: "exists" };
    return { ok: false, error: "The instructor lead could not be recorded. No intake records were changed." };
  }

  revalidatePath("/app/instructors");
  revalidatePath("/app");
  return { ok: true };
}

/* ---------------- stage transitions ---------------- */

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
async function getInstructorRow(id: string): Promise<any> {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  return (await getDb().prepare("SELECT * FROM instructors WHERE id = ?").get(id)) as any;
}

export interface ScheduleInterviewInput {
  localDateTime: string;
  timeZone: string;
}

export async function scheduleInterview(id: string, schedule: ScheduleInterviewInput, notes?: string): Promise<ActionResult> {
  const me = await requireStaff();
  const instructorId = String(id ?? "").trim();
  if (!instructorId || instructorId.length > 100) return { ok: false, error: "Choose a valid instructor." };
  const resolved = localDateTimeToEpoch(schedule?.localDateTime, schedule?.timeZone);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const now = Date.now();
  if (resolved.epoch <= now || resolved.epoch > now + 5 * 366 * 24 * 60 * 60 * 1000) {
    return { ok: false, error: "Choose a future interview time within five years." };
  }
  const cleanNotes = (notes ?? "").trim().slice(0, 500);

  const db = getDb();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const row = (await db.prepare("SELECT stage FROM instructors WHERE id = ?").get(instructorId)) as
      | { stage: InstructorStage }
      | undefined;
    if (!row) throw new Error("instructor_missing");
    if (!["applied", "reviewing"].includes(row.stage)) throw new Error("wrong_stage");
    const changed = (await db.prepare(
          "UPDATE instructors SET stage = 'interview_scheduled', interview_at = ?, interview_timezone = ?, updated_at = ? WHERE id = ? AND stage = ?",
        ).run(resolved.epoch, resolved.timeZone, now, instructorId, row.stage));
    if (changed.changes !== 1) throw new Error("instructor_changed");
    (await db.prepare(
            `UPDATE tasks
          SET status = 'done', completed_at = ?, completion_note = ?, updated_at = ?
        WHERE entity_type = 'instructor' AND entity_id = ? AND status = 'open'
          AND title LIKE 'Review application:%'`,
          ).run(now, "Application reviewed and interview scheduled.", now, instructorId));
    (await logActivity(
            "instructor",
            instructorId,
            "stage_change",
            `Interview scheduled for ${formatDateTimeInZone(resolved.epoch, resolved.timeZone)} in ${resolved.timeZone}.${cleanNotes ? ` ${cleanNotes}` : ""}`,
            me.id,
          ));
    (await db.exec("COMMIT"));
  } catch (error) {
    if (db.isTransaction) (await db.exec("ROLLBACK"));
    const code = error instanceof Error ? error.message : "";
    if (code === "instructor_missing") return { ok: false, error: "Not found." };
    if (code === "wrong_stage") return { ok: false, error: "Only a new or reviewing application can be scheduled." };
    if (code === "instructor_changed") return { ok: false, error: "The application changed while the interview was being scheduled. Refresh and try again." };
    throw error;
  }

  revalidatePath(`/app/instructors/${instructorId}`);
  revalidatePath("/app/instructors");
  revalidatePath("/app/tasks");
  return { ok: true };
}

export async function recordInterviewNotes(id: string, notes: string): Promise<ActionResult> {
  const me = await requireStaff();
  const instructorId = String(id ?? "").trim();
  if (!instructorId || instructorId.length > 100) return { ok: false, error: "Choose a valid instructor." };
  const text = (notes ?? "").trim().slice(0, 4000);
  if (!text) return { ok: false, error: "Notes can't be empty." };

  const now = Date.now();
  const db = getDb();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const row = (await db.prepare("SELECT stage, interview_notes FROM instructors WHERE id = ?").get(instructorId)) as
      | { stage: InstructorStage; interview_notes: string | null }
      | undefined;
    if (!row) throw new Error("instructor_missing");
    if (row.stage !== "interview_scheduled") throw new Error("wrong_stage");
    const combined = row.interview_notes ? `${row.interview_notes}\n\n${text}` : text;
    const changed = (await db.prepare(
          "UPDATE instructors SET stage = 'interviewed', interview_notes = ?, updated_at = ? WHERE id = ? AND stage = 'interview_scheduled'",
        ).run(combined, now, instructorId));
    if (changed.changes !== 1) throw new Error("instructor_changed");
    (await logActivity("instructor", instructorId, "stage_change", "Interview notes recorded.", me.id));
    (await db.exec("COMMIT"));
  } catch (error) {
    if (db.isTransaction) (await db.exec("ROLLBACK"));
    const code = error instanceof Error ? error.message : "";
    if (code === "instructor_missing") return { ok: false, error: "Not found." };
    if (code === "wrong_stage") return { ok: false, error: "Only a scheduled interview can receive final notes." };
    if (code === "instructor_changed") return { ok: false, error: "The application changed while notes were being recorded. Refresh and try again." };
    throw error;
  }

  revalidatePath(`/app/instructors/${instructorId}`);
  revalidatePath("/app/instructors");
  return { ok: true };
}

export async function submitForFounderReview(id: string): Promise<ActionResult> {
  const me = await requireStaff();
  const instructorId = String(id ?? "").trim();
  if (!instructorId || instructorId.length > 100) return { ok: false, error: "Choose a valid instructor." };
  const now = Date.now();
  const db = getDb();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const row = (await db.prepare("SELECT stage FROM instructors WHERE id = ?").get(instructorId)) as
      | { stage: InstructorStage }
      | undefined;
    if (!row) throw new Error("instructor_missing");
    if (row.stage !== "interviewed") throw new Error("wrong_stage");
    const changed = (await db.prepare(
          "UPDATE instructors SET stage = 'founder_review', updated_at = ? WHERE id = ? AND stage = 'interviewed'",
        ).run(now, instructorId));
    if (changed.changes !== 1) throw new Error("instructor_changed");
    (await logActivity("instructor", instructorId, "stage_change", "Submitted for founder review.", me.id));
    (await db.prepare(
            `INSERT INTO tasks
        (id, title, owner_user_id, due_at, status, entity_type, entity_id, handoff_to_founder, created_at, updated_at)
       SELECT ?, 'Founder decision needed on applicant', NULL, NULL, 'open', 'instructor', ?, 1, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM tasks
           WHERE entity_type = 'instructor' AND entity_id = ? AND handoff_to_founder = 1 AND status = 'open'
        )`,
          ).run(`pfx-${randomUUID().slice(0, 8)}`, instructorId, now, now, instructorId));
    (await db.exec("COMMIT"));
  } catch (error) {
    if (db.isTransaction) (await db.exec("ROLLBACK"));
    const code = error instanceof Error ? error.message : "";
    if (code === "instructor_missing") return { ok: false, error: "Not found." };
    if (code === "wrong_stage") return { ok: false, error: "Only a completed interview can be sent for founder review." };
    if (code === "instructor_changed") return { ok: false, error: "The application changed while founder review was being requested. Refresh and try again." };
    throw error;
  }

  revalidatePath(`/app/instructors/${instructorId}`);
  revalidatePath("/app/instructors");
  revalidatePath("/app/tasks");
  return { ok: true };
}

export async function recordFounderDecision(
  id: string,
  decision: "accepted" | "rejected",
  note?: string,
): Promise<ActionResult & { invitationToken?: string; invitationDelivery?: InvitationDeliveryState }> {
  const me = await requireAdmin();
  if (decision !== "accepted" && decision !== "rejected") return { ok: false, error: "Invalid decision." };

  const now = Date.now();
  const db = getDb();
  const nextStage: InstructorStage = decision === "accepted" ? "onboarding" : "rejected";
  let invitationToken: string | undefined;
  let issuedInvitation: Awaited<ReturnType<typeof createInvitationInternal>> | undefined;
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const row = (await db.prepare(
          `SELECT i.stage, i.person_id, p.name, p.email
         FROM instructors i JOIN people p ON p.id = i.person_id
        WHERE i.id = ?`,
        ).get(id)) as { stage: InstructorStage; person_id: string; name: string; email: string } | undefined;
    if (!row) throw new Error("not_found");
    if (row.stage !== "founder_review") throw new Error("stage_changed");

    const updated = (await db.prepare(
          `UPDATE instructors
          SET stage = ?, founder_decision = ?, decided_by = ?, decided_at = ?, updated_at = ?
        WHERE id = ? AND stage = 'founder_review'`,
        ).run(nextStage, decision, me.id, now, now, id));
    if (updated.changes !== 1) throw new Error("stage_changed");
    (await logActivity("instructor", id, "stage_change", `Founder decision: ${decision}.${note ? ` ${note.slice(0, 500)}` : ""}`, me.id));

    if (decision === "accepted") {
      const invitation = (await createInvitationInternal({ role: "instructor", email: row.email, orgId: BOW_ORG_ID, cohortId: null }));
      issuedInvitation = invitation;
      invitationToken = invitation.token;
      (await logActivity("instructor", id, "note", `Invitation created (${invitation.email}).`, me.id));
      (await createNotification({
                id: `ntf-instr-accepted-${id}`,
                userId: me.id,
                type: "instructor_pipeline",
                title: "Applicant accepted",
                body: `${row.name} was accepted and invited to onboard.`,
                link: `/app/instructors/${id}`,
              }));
    }

    const founderTasks = (await db.prepare(
          `SELECT id FROM tasks
        WHERE entity_type = 'instructor' AND entity_id = ?
          AND handoff_to_founder = 1 AND status = 'open'`,
        ).all(id)) as { id: string }[];
    for (const task of founderTasks) {
      const completed = (await db.prepare(
              `UPDATE tasks
            SET status = 'done', completed_at = ?, completion_note = ?, updated_at = ?
          WHERE id = ? AND status = 'open' AND handoff_to_founder = 1`,
            ).run(now, `Resolved by founder ${decision} decision.`, now, task.id));
      if (completed.changes !== 1) throw new Error("task_changed");
      (await logActivity("task", task.id, "completed", `Resolved by founder ${decision} decision for Instructor ${id}.`, me.id));
    }
    (await db.exec("COMMIT"));
  } catch (error) {
    try {
      (await db.exec("ROLLBACK"));
    } catch {
      // Preserve the decision error.
    }
    const code = error instanceof Error ? error.message : "";
    if (code === "not_found") return { ok: false, error: "Not found." };
    if (code === "stage_changed") return { ok: false, error: "This applicant changed while the founder decision was being recorded. Refresh and try again." };
    if (code === "task_changed") return { ok: false, error: "Founder Work changed during the decision. No decision or invitation was saved." };
    return { ok: false, error: "The founder decision and onboarding invitation could not be completed together. No records were changed." };
  }

  const invitationDelivery = issuedInvitation
    ? queueInvitationDelivery({
        invitationId: issuedInvitation.id,
        token: issuedInvitation.token,
        email: issuedInvitation.email,
        role: issuedInvitation.role,
        actorUserId: me.id,
      })
    : undefined;

  revalidatePath(`/app/instructors/${id}`);
  revalidatePath("/app/instructors");
  revalidatePath("/app/admin/invitations");
  return { ok: true, invitationToken, invitationDelivery };
}

export async function updateApplicantOwner(id: string, ownerUserId: string): Promise<ActionResult> {
  const me = await requireStaff();
  const row = (await getInstructorRow(id));
  if (!row) return { ok: false, error: "Not found." };
  const nextOwnerId = typeof ownerUserId === "string" ? ownerUserId.trim() || null : null;
  const nextOwner = nextOwnerId
    ? ((await getDb().prepare("SELECT name FROM users WHERE id = ? AND role IN ('admin','growth') AND status = 'active'").get(nextOwnerId)) as { name: string } | undefined)
    : undefined;
  if (nextOwnerId && !nextOwner) {
    return { ok: false, error: "Choose an active BOW staff owner." };
  }
  if ((row.owner_user_id ?? null) === nextOwnerId) return { ok: true };
  const changed = (await getDb().prepare("UPDATE instructors SET owner_user_id = ?, updated_at = ? WHERE id = ? AND owner_user_id IS ?")
      .run(nextOwnerId, Date.now(), id, row.owner_user_id ?? null));
  if (changed.changes !== 1) return { ok: false, error: "The instructor owner changed. Refresh and try again." };
  const previousOwner = row.owner_user_id
    ? ((await getDb().prepare("SELECT name FROM users WHERE id = ?").get(row.owner_user_id)) as { name: string } | undefined)?.name ?? "an unavailable account"
    : "unassigned";
  (await logActivity("instructor", id, "owner_changed", `Accountable owner changed from ${previousOwner} to ${nextOwner?.name ?? "unassigned"}.`, me.id));

  revalidatePath(`/app/instructors/${id}`);
  revalidatePath("/app/instructors");
  return { ok: true };
}

/* ---------------- training / practice eval / lifecycle (Phase C) ---------------- */

const REQUIRED_ONBOARDING_STAGE_FROM: InstructorStage[] = ["onboarding"];
const REQUIRED_TRAINING_STAGE_FROM: InstructorStage[] = ["training"];

/** Records that the signed-in instructor intentionally opened module content. */
export async function recordTrainingModuleView(instructorId: string, moduleId: string): Promise<ActionResult & { firstViewedAt?: number }> {
  const { instructor } = await requireInstructorSelf();
  if (instructor.id !== instructorId) return { ok: false, error: "You may only open your own training modules." };
  const db = getDb();
  const trainingModuleRecord = (await db.prepare("SELECT id FROM training_modules WHERE id = ? AND active = 1").get(moduleId));
  if (!trainingModuleRecord) return { ok: false, error: "Module not found." };
  const now = Date.now();
  (await db.prepare(
        `INSERT INTO training_module_views (instructor_id, module_id, first_viewed_at, last_viewed_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(instructor_id, module_id) DO UPDATE SET last_viewed_at = excluded.last_viewed_at`,
      ).run(instructorId, moduleId, now, now));
  const view = (await db.prepare(
      "SELECT first_viewed_at FROM training_module_views WHERE instructor_id = ? AND module_id = ?",
    ).get(instructorId, moduleId)) as { first_viewed_at: number };
  return { ok: true, firstViewedAt: view.first_viewed_at };
}

/**
 * Instructor-self or staff. Idempotent — completing an already-completed
 * module is a no-op. Auto-advances stage forward only:
 * onboarding -> training once all required onboarding modules are done,
 * training -> practice_evaluation once all required training modules are done.
 */
export async function completeTrainingModule(instructorId: string, moduleId: string, notes?: string): Promise<ActionResult> {
  const me = await requireRole("admin", "growth", "instructor");
  if (me.role === "instructor") {
    const { instructor } = await requireInstructorSelf();
    if (instructor.id !== instructorId) return { ok: false, error: "You may only complete your own modules." };
  }

  const db = getDb();
  const now = Date.now();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const row = (await getInstructorRow(instructorId));
    if (!row) throw new Error("instructor_missing");
    const trainingModule = (await db.prepare("SELECT id FROM training_modules WHERE id = ? AND active = 1").get(moduleId));
    if (!trainingModule) throw new Error("module_missing");

    const existing = (await db
          .prepare("SELECT id FROM training_module_completions WHERE instructor_id = ? AND module_id = ? ORDER BY completed_at LIMIT 1")
          .get(instructorId, moduleId));
    if (!existing) {
      const view = (await db.prepare(
              "SELECT first_viewed_at FROM training_module_views WHERE instructor_id = ? AND module_id = ?",
            ).get(instructorId, moduleId)) as { first_viewed_at: number } | undefined;
      if (!view) throw new Error("module_not_opened");
      if (now - Number(view.first_viewed_at) < 5_000) throw new Error("module_review_too_short");
      (await db.prepare(
                "INSERT INTO training_module_completions (id, instructor_id, module_id, completed_at, notes) VALUES (?, ?, ?, ?, ?)",
              ).run(`pfx-${randomUUID().slice(0, 8)}`, instructorId, moduleId, now, (notes ?? "").trim().slice(0, 2000) || null));
      (await logActivity("instructor", instructorId, "note", "Training module completed.", me.id));
    }

    (await recomputeInstructorStatuses(instructorId));

    // Auto-advance forward only, never backward, inside the same durable write.
    const refreshed = (await getInstructorRow(instructorId));
    if (!refreshed) throw new Error("instructor_missing");
    if (REQUIRED_ONBOARDING_STAGE_FROM.includes(refreshed.stage) && refreshed.onboarding_status === "complete") {
      const advanced = (await db.prepare("UPDATE instructors SET stage = 'training', updated_at = ? WHERE id = ? AND stage = ?")
              .run(Date.now(), instructorId, refreshed.stage));
      if (advanced.changes !== 1) throw new Error("instructor_changed");
      (await logActivity("instructor", instructorId, "stage_change", "Onboarding complete — advanced to training.", me.id));
    } else if (REQUIRED_TRAINING_STAGE_FROM.includes(refreshed.stage) && refreshed.training_status === "complete") {
      const advanced = (await db.prepare("UPDATE instructors SET stage = 'practice_evaluation', updated_at = ? WHERE id = ? AND stage = ?")
              .run(Date.now(), instructorId, refreshed.stage));
      if (advanced.changes !== 1) throw new Error("instructor_changed");
      (await logActivity("instructor", instructorId, "stage_change", "Training complete — advanced to practice evaluation.", me.id));
    }
    (await db.exec("COMMIT"));
  } catch (error) {
    try {
      (await db.exec("ROLLBACK"));
    } catch {
      // Preserve the completion failure.
    }
    const code = error instanceof Error ? error.message : "";
    if (code === "instructor_missing") return { ok: false, error: "Instructor not found." };
    if (code === "module_missing") return { ok: false, error: "Module not found." };
    if (code === "module_not_opened") return { ok: false, error: "Open and review the module content before completing it." };
    if (code === "module_review_too_short") return { ok: false, error: "Take a moment to review the module content before confirming completion." };
    if (code === "instructor_changed") return { ok: false, error: "The instructor changed while completion was being recorded. Refresh and try again." };
    return { ok: false, error: "The module completion could not be recorded. No training records were changed." };
  }

  revalidatePath(`/app/instructors/${instructorId}`);
  revalidatePath("/app/instructors");
  revalidatePath("/app/teach");
  return { ok: true };
}

export async function moveToPracticeEvaluation(id: string): Promise<ActionResult> {
  const me = await requireStaff();
  const db = getDb();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    // Cached readiness is a projection, never the authorization source. Rebuild
    // it from the current required modules, attendance, and evaluation while
    // holding the same writer lock as this lifecycle decision.
    (await recomputeInstructorStatuses(id));
    const row = (await getInstructorRow(id));
    if (!row) throw new Error("instructor_missing");
    if (row.stage !== "training") throw new Error("wrong_stage");
    if (row.training_status !== "complete") throw new Error("training_incomplete");
    const changed = (await db.prepare("UPDATE instructors SET stage = 'practice_evaluation', updated_at = ? WHERE id = ? AND stage = 'training' AND training_status = 'complete'")
          .run(Date.now(), id));
    if (changed.changes !== 1) throw new Error("instructor_changed");
    (await logActivity("instructor", id, "stage_change", "Moved to practice evaluation.", me.id));
    (await db.exec("COMMIT"));
  } catch (error) {
    try {
      (await db.exec("ROLLBACK"));
    } catch {
      // Preserve the transition failure.
    }
    const code = error instanceof Error ? error.message : "";
    if (code === "instructor_missing") return { ok: false, error: "Not found." };
    if (code === "wrong_stage") return { ok: false, error: "Only an instructor currently in Training can move to practice evaluation." };
    if (code === "training_incomplete") return { ok: false, error: "Training isn't complete yet." };
    return { ok: false, error: "The instructor changed while this transition was being recorded. Refresh and try again." };
  }

  revalidatePath(`/app/instructors/${id}`);
  revalidatePath("/app/instructors");
  return { ok: true };
}

export interface PracticeEvalInput {
  evaluatorUserId: string;
  evaluatedAt: number;
  lessonUsed?: string;
  ratingCurriculumDelivery: number;
  ratingCommunicationEngagement: number;
  ratingPreparednessReliability: number;
  strengths?: string;
  concerns?: string;
  decision: PracticeEvalDecision;
}

const DECISIONS = new Set(["pass", "revise_retry", "fail"]);

function validRating(n: unknown): n is number {
  return Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 5;
}

/** Staff. Does not auto-advance stage — markEligible/staff decide next steps. */
export async function recordPracticeEvaluation(id: string, input: PracticeEvalInput): Promise<ActionResult> {
  const me = await requireStaff();
  if (!input || typeof input !== "object") return { ok: false, error: "Evaluation details are required." };
  if (!DECISIONS.has(input.decision)) return { ok: false, error: "Invalid decision." };
  if (!validRating(input.ratingCurriculumDelivery) || !validRating(input.ratingCommunicationEngagement) || !validRating(input.ratingPreparednessReliability)) {
    return { ok: false, error: "Ratings must be integers 1–5." };
  }
  if (!Number.isSafeInteger(input.evaluatedAt) || input.evaluatedAt <= 0 || input.evaluatedAt > Date.now() + 5 * 60 * 1000) {
    return { ok: false, error: "Choose a valid evaluation date that is not in the future." };
  }
  const lessonUsed = typeof input.lessonUsed === "string" ? input.lessonUsed.trim() : "";
  const strengths = typeof input.strengths === "string" ? input.strengths.trim() : "";
  const concerns = typeof input.concerns === "string" ? input.concerns.trim() : "";
  if (lessonUsed.length > 200 || strengths.length > 2000 || concerns.length > 2000) {
    return { ok: false, error: "The evaluation narrative exceeds the allowed length." };
  }

  const now = Date.now();
  const db = getDb();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const row = (await getInstructorRow(id));
    if (!row) throw new Error("instructor_missing");
    if (row.stage !== "practice_evaluation" || row.training_status !== "complete") {
      throw new Error("evaluation_stage_changed");
    }
    (await db.prepare(
            `INSERT INTO practice_evaluations
        (id, instructor_id, evaluator_user_id, evaluated_at, lesson_used, rating_curriculum_delivery, rating_communication_engagement, rating_preparedness_reliability, strengths, concerns, decision, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            `pfx-${randomUUID().slice(0, 8)}`,
            id,
            me.id,
            input.evaluatedAt,
            lessonUsed || null,
            input.ratingCurriculumDelivery,
            input.ratingCommunicationEngagement,
            input.ratingPreparednessReliability,
            strengths || null,
            concerns || null,
            input.decision,
            now,
          ));

    (await recomputeInstructorStatuses(id));
    (await logActivity("instructor", id, "note", `Practice evaluation recorded: ${input.decision}.`, me.id));

    if (input.decision === "revise_retry") {
      const person = (await db.prepare("SELECT name FROM people WHERE id = ?").get(row.person_id)) as { name: string } | undefined;
      (await db.prepare(
                `INSERT INTO tasks
          (id, title, owner_user_id, due_at, status, kind, priority, context, recommended_action,
           entity_type, entity_id, handoff_to_founder, created_at, updated_at)
         SELECT ?, ?, ?, ?, 'open', 'review', 'high', ?, ?, 'instructor', ?, 0, ?, ?
          WHERE NOT EXISTS (
            SELECT 1 FROM tasks
             WHERE entity_type = 'instructor' AND entity_id = ? AND status = 'open'
               AND kind = 'review' AND recommended_action = 'Schedule and record the next practice evaluation.'
          )`,
              ).run(
                `wrk-${randomUUID().slice(0, 10)}`,
                `Re-evaluate ${person?.name ?? "instructor"}`,
                me.id,
                now + 7 * 24 * 60 * 60 * 1000,
                "The latest practice evaluation requires revision and another observed attempt.",
                "Schedule and record the next practice evaluation.",
                id,
                now,
                now,
                id,
              ));
    }
    (await db.exec("COMMIT"));
  } catch (error) {
    try {
      (await db.exec("ROLLBACK"));
    } catch {
      // Preserve the evaluation failure.
    }
    const code = error instanceof Error ? error.message : "";
    if (code === "instructor_missing") return { ok: false, error: "Instructor not found." };
    if (code === "evaluation_stage_changed") {
      return { ok: false, error: "The instructor is no longer ready for a practice evaluation. Refresh and review the current stage." };
    }
    return { ok: false, error: "The evaluation could not be recorded. No evaluation or follow-up Work was changed." };
  }

  revalidatePath(`/app/instructors/${id}`);
  revalidatePath("/app/instructors");
  return { ok: true };
}

export async function markEligible(id: string): Promise<ActionResult> {
  const me = await requireAdmin();
  const now = Date.now();
  const db = getDb();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    (await recomputeInstructorStatuses(id));
    const row = (await getInstructorRow(id));
    if (!row) throw new Error("instructor_missing");
    if (row.stage !== "practice_evaluation") throw new Error("eligibility_stage_changed");
    const latestEval = (await db
          .prepare("SELECT decision FROM practice_evaluations WHERE instructor_id = ? AND evaluated_at <= ? ORDER BY evaluated_at DESC, created_at DESC LIMIT 1")
          .get(id, now)) as { decision: PracticeEvalDecision } | undefined;
    if (latestEval?.decision !== "pass" || row.training_status !== "complete" || row.onboarding_status !== "complete") {
      throw new Error("not_ready");
    }
    const changed = (await db
          .prepare("UPDATE instructors SET stage = 'eligible', eligibility_status = 'eligible', updated_at = ? WHERE id = ? AND stage = 'practice_evaluation' AND training_status = 'complete' AND onboarding_status = 'complete'")
          .run(now, id));
    if (changed.changes !== 1) throw new Error("eligibility_stage_changed");
    (await logActivity("instructor", id, "stage_change", "Founder marked instructor eligible after rechecking training and evaluation evidence.", me.id));

    const person = (await db.prepare("SELECT name FROM people WHERE id = ?").get(row.person_id)) as { name: string } | undefined;
    for (const staffId of (await listStaffUserIds())) {
      (await createNotification({
                id: `ntf-instr-eligible-${id}-${staffId}`,
                userId: staffId,
                type: "instructor_pipeline",
                title: "Instructor eligible",
                body: `${person?.name ?? "An instructor"} is now eligible to teach.`,
                link: `/app/instructors/${id}`,
              }));
    }
    (await db.exec("COMMIT"));
  } catch (error) {
    try {
      (await db.exec("ROLLBACK"));
    } catch {
      // Preserve the eligibility failure.
    }
    const code = error instanceof Error ? error.message : "";
    if (code === "instructor_missing") return { ok: false, error: "Not found." };
    if (code === "not_ready") return { ok: false, error: "Complete onboarding and training, then record a passing practice evaluation before founder eligibility approval." };
    if (code === "eligibility_stage_changed") return { ok: false, error: "The instructor lifecycle changed before eligibility could be recorded. Refresh and try again." };
    return { ok: false, error: "Eligibility could not be recorded. No instructor or notification records were changed." };
  }

  revalidatePath(`/app/instructors/${id}`);
  revalidatePath("/app/instructors");
  return { ok: true };
}

export async function markActive(id: string): Promise<ActionResult> {
  const me = await requireAdmin();
  const db = getDb();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    (await recomputeInstructorStatuses(id));
    const row = (await getInstructorRow(id));
    if (!row) throw new Error("instructor_missing");
    if (row.stage === "active") {
      if (row.eligibility_status !== "eligible" || row.onboarding_status !== "complete" || row.training_status !== "complete") {
        throw new Error("not_ready");
      }
      (await db.exec("COMMIT"));
      return { ok: true };
    }
    if (!["eligible", "inactive"].includes(row.stage)) throw new Error("wrong_stage");
    if (row.eligibility_status !== "eligible" || row.onboarding_status !== "complete" || row.training_status !== "complete") {
      throw new Error("not_ready");
    }
    const otherCurrentDossier = (await db.prepare(
          `SELECT id FROM instructors
        WHERE person_id = ? AND id <> ? AND stage NOT IN ('rejected','inactive')
        LIMIT 1`,
        ).get(row.person_id, id));
    if (otherCurrentDossier) throw new Error("duplicate_identity");
    const updated = (await db.prepare(
          `UPDATE instructors SET stage = 'active', updated_at = ?
        WHERE id = ? AND stage = ? AND eligibility_status = 'eligible'
          AND onboarding_status = 'complete' AND training_status = 'complete'`,
        ).run(Date.now(), id, row.stage));
    if (updated.changes !== 1) throw new Error("stale_instructor");
    (await logActivity("instructor", id, "stage_change", "Marked active after eligibility prerequisites were re-derived from current evidence.", me.id));
    (await db.exec("COMMIT"));
  } catch (error) {
    if (db.isTransaction) (await db.exec("ROLLBACK"));
    const code = error instanceof Error ? error.message : "";
    if (code === "instructor_missing") return { ok: false, error: "Not found." };
    if (code === "wrong_stage") return { ok: false, error: "Only an eligible or previously inactive instructor can be activated." };
    if (code === "not_ready") return { ok: false, error: "Complete current onboarding, training, and eligibility requirements before activation." };
    if (code === "duplicate_identity") return { ok: false, error: "This Person already has another current instructor dossier. Reconcile the duplicate before reactivation." };
    if (code === "stale_instructor") return { ok: false, error: "The instructor changed while activation was being recorded. Refresh and try again." };
    throw error;
  }

  revalidatePath(`/app/instructors/${id}`);
  revalidatePath("/app/instructors");
  revalidatePath("/app/programs");
  revalidatePath("/app/classes");
  return { ok: true };
}

export async function markInactive(id: string, reason?: string): Promise<ActionResult> {
  const me = await requireAdmin();
  const row = (await getInstructorRow(id));
  if (!row) return { ok: false, error: "Not found." };
  if (row.stage === "inactive") return { ok: true };
  if (!["eligible", "active"].includes(row.stage)) {
    return { ok: false, error: "Use the hiring workflow to close an applicant who has not reached eligibility." };
  }
  const recordedReason = (reason ?? "").trim().slice(0, 1000);
  if (recordedReason.length < 3) return { ok: false, error: "Record why teaching access is being deactivated." };

  const db = getDb();
  const now = Date.now();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const updated = (await db.prepare("UPDATE instructors SET stage = 'inactive', updated_at = ? WHERE id = ? AND stage = ?")
          .run(now, id, row.stage));
    if (updated.changes !== 1) throw new Error("stale_instructor");

    const linkedUser = (await db.prepare("SELECT user_id FROM people WHERE id = ?").get(row.person_id)) as
      | { user_id: string | null }
      | undefined;
    if (linkedUser?.user_id) (await db.prepare("DELETE FROM sessions WHERE user_id = ?").run(linkedUser.user_id));

    const affectedClasses = (await db.prepare(
          `SELECT c.id, c.title
         FROM class_instructors ci
         JOIN classes c ON c.id = ci.class_id
        WHERE ci.instructor_id = ? AND ci.removed_at IS NULL
          AND c.status NOT IN ('completed','cancelled')
        ORDER BY c.title, c.id`,
        ).all(id)) as { id: string; title: string }[];
    if (affectedClasses.length > 0) {
      const classSummary = affectedClasses.map((item) => item.title).join(", ").slice(0, 1200);
      (await db.prepare(
                `INSERT INTO tasks
          (id, title, owner_user_id, due_at, status, kind, priority, context, recommended_action,
           entity_type, entity_id, handoff_to_founder, created_at, updated_at)
         SELECT ?, ?, ?, ?, 'open', 'issue', 'urgent', ?, ?, 'instructor', ?, 0, ?, ?
          WHERE NOT EXISTS (
            SELECT 1 FROM tasks
             WHERE entity_type = 'instructor' AND entity_id = ? AND status = 'open'
               AND kind = 'issue' AND recommended_action = 'Assign replacement coverage and confirm every affected Program remains ready.'
          )`,
              ).run(
                `wrk-${randomUUID().slice(0, 10)}`,
                `Replace inactive instructor across ${affectedClasses.length} Class${affectedClasses.length === 1 ? "" : "es"}`,
                me.id,
                now,
                `Teaching access was revoked. Affected Classes: ${classSummary}. Reason: ${recordedReason}`,
                "Assign replacement coverage and confirm every affected Program remains ready.",
                id,
                now,
                now,
                id,
              ));
    }
    (await logActivity("instructor", id, "stage_change", `Teaching access revoked. ${recordedReason}`, me.id));
    (await db.exec("COMMIT"));
  } catch (error) {
    try {
      (await db.exec("ROLLBACK"));
    } catch {
      // Preserve the original failure.
    }
    if (error instanceof Error && error.message === "stale_instructor") {
      return { ok: false, error: "The instructor changed while deactivation was being recorded. Refresh and try again." };
    }
    throw error;
  }

  revalidatePath(`/app/instructors/${id}`);
  revalidatePath("/app/instructors");
  revalidatePath("/app/programs");
  revalidatePath("/app/classes");
  revalidatePath("/app/tasks");
  revalidatePath("/app/teach");
  return { ok: true };
}

/* ---------------- availability ---------------- */

export interface AvailabilitySlotInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  notes?: string;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Replace-all semantics: the instructor's (or, for staff, the target
 * instructor's) full availability set is deleted and re-inserted.
 * Self-service (instructor editing their own row) OR staff.
 */
export async function updateInstructorAvailability(instructorId: string, slots: AvailabilitySlotInput[]): Promise<ActionResult> {
  const me = await requireRole("admin", "growth", "instructor");
  const row = (await getInstructorRow(instructorId));
  if (!row) return { ok: false, error: "Not found." };

  if (me.role === "instructor") {
    const { instructor } = await requireInstructorSelf();
    if (instructor.id !== instructorId) return { ok: false, error: "forbidden" };
  }

  if (!Array.isArray(slots)) return { ok: false, error: "Invalid slots." };
  if (slots.length > 50) return { ok: false, error: "Too many slots." };

  const clean: { dayOfWeek: number; startTime: string; endTime: string; notes: string | null }[] = [];
  for (const s of slots) {
    const dayOfWeek = Number(s.dayOfWeek);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return { ok: false, error: "Day of week must be 0–6." };
    const startTime = (s.startTime ?? "").trim();
    const endTime = (s.endTime ?? "").trim();
    if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) return { ok: false, error: "Times must be HH:MM." };
    if (startTime >= endTime) return { ok: false, error: "Start time must be before end time." };
    clean.push({ dayOfWeek, startTime, endTime, notes: (s.notes ?? "").trim().slice(0, 300) || null });
  }
  clean.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));
  for (let index = 1; index < clean.length; index += 1) {
    const previous = clean[index - 1];
    const current = clean[index];
    if (previous.dayOfWeek === current.dayOfWeek && current.startTime < previous.endTime) {
      return { ok: false, error: "Availability slots on the same day cannot overlap." };
    }
  }

  const db = getDb();
  const now = Date.now();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const currentInstructor = (await db.prepare("SELECT stage FROM instructors WHERE id = ?").get(instructorId)) as
      | { stage: InstructorStage }
      | undefined;
    if (!currentInstructor) throw new Error("instructor_missing");
    if (["rejected", "inactive"].includes(currentInstructor.stage)) throw new Error("instructor_inactive");
    (await db.prepare("DELETE FROM instructor_availability WHERE instructor_id = ?").run(instructorId));
    const insert = db.prepare(
      "INSERT INTO instructor_availability (id, instructor_id, day_of_week, start_time, end_time, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    for (const slot of clean) {
      (await insert.run(`pfx-${randomUUID().slice(0, 8)}`, instructorId, slot.dayOfWeek, slot.startTime, slot.endTime, slot.notes, now));
    }
    (await logActivity("instructor", instructorId, "note", `Availability updated (${clean.length} slot(s)).`, me.id));
    (await db.exec("COMMIT"));
  } catch (error) {
    if (db.isTransaction) (await db.exec("ROLLBACK"));
    const code = error instanceof Error ? error.message : "";
    if (code === "instructor_missing") return { ok: false, error: "Not found." };
    if (code === "instructor_inactive") return { ok: false, error: "Inactive or rejected instructor records cannot publish availability." };
    throw error;
  }
  revalidatePath(`/app/instructors/${instructorId}`);
  revalidatePath("/app/teach");
  return { ok: true };
}
