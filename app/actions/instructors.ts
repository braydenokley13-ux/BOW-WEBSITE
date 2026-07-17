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

  const personId = upsertPersonByEmail(v.name, v.email, v.phone);
  const existing = getActiveInstructorForPerson(personId);
  if (existing) return { ok: false, error: "exists" };

  const id = `pfx-${randomUUID().slice(0, 8)}`;
  const now = Date.now();
  getDb()
    .prepare(
      "INSERT INTO instructors (id, person_id, stage, source, owner_user_id, answers, created_at, updated_at) VALUES (?, ?, 'applied', 'public_application', NULL, ?, ?, ?)",
    )
    .run(id, personId, JSON.stringify(v.answers), now, now);

  logActivity("instructor", id, "note", `Application submitted by ${v.name} (${v.email}).`, null);

  const dueAt = now + 3 * 24 * 60 * 60 * 1000;
  getDb()
    .prepare(
      "INSERT INTO tasks (id, title, owner_user_id, due_at, status, entity_type, entity_id, handoff_to_founder, created_at, updated_at) VALUES (?, ?, NULL, ?, 'open', 'instructor', ?, 0, ?, ?)",
    )
    .run(`pfx-${randomUUID().slice(0, 8)}`, `Review application: ${v.name}`, dueAt, id, now, now);

  for (const staffId of listStaffUserIds()) {
    createNotification({
      id: `ntf-instr-applied-${id}-${staffId}`,
      userId: staffId,
      type: "instructor_pipeline",
      title: "New instructor application",
      body: `${v.name} applied to teach with BOW.`,
      link: `/app/instructors/${id}`,
    });
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

  const personId = upsertPersonByEmail(v.name, v.email, v.phone);
  const existing = getActiveInstructorForPerson(personId);
  if (existing) return { ok: false, error: "exists" };

  const id = `pfx-${randomUUID().slice(0, 8)}`;
  const now = Date.now();
  getDb()
    .prepare(
      "INSERT INTO instructors (id, person_id, stage, source, owner_user_id, answers, created_at, updated_at) VALUES (?, ?, 'applied', ?, ?, ?, ?, ?)",
    )
    .run(id, personId, source, me.id, JSON.stringify(v.answers), now, now);

  logActivity("instructor", id, "note", `Added manually by staff (source: ${source}).`, me.id);

  revalidatePath("/app/instructors");
  revalidatePath("/app");
  return { ok: true };
}

/* ---------------- stage transitions ---------------- */

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function getInstructorRow(id: string): any {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  return getDb().prepare("SELECT * FROM instructors WHERE id = ?").get(id) as any;
}

function setStage(id: string, stage: InstructorStage) {
  getDb().prepare("UPDATE instructors SET stage = ?, updated_at = ? WHERE id = ?").run(stage, Date.now(), id);
}

export async function scheduleInterview(id: string, atEpochMs: number, notes?: string): Promise<ActionResult> {
  const me = await requireStaff();
  const row = getInstructorRow(id);
  if (!row) return { ok: false, error: "Not found." };
  if (!["applied", "reviewing"].includes(row.stage)) return { ok: false, error: `Can't schedule from stage "${row.stage}".` };
  if (!Number.isFinite(atEpochMs) || atEpochMs <= 0) return { ok: false, error: "Invalid interview time." };

  const now = Date.now();
  getDb()
    .prepare("UPDATE instructors SET stage = 'interview_scheduled', interview_at = ?, updated_at = ? WHERE id = ?")
    .run(atEpochMs, now, id);
  logActivity("instructor", id, "stage_change", `Interview scheduled for ${new Date(atEpochMs).toISOString()}.${notes ? ` ${notes.slice(0, 500)}` : ""}`, me.id);

  revalidatePath(`/app/instructors/${id}`);
  revalidatePath("/app/instructors");
  return { ok: true };
}

export async function recordInterviewNotes(id: string, notes: string): Promise<ActionResult> {
  const me = await requireStaff();
  const row = getInstructorRow(id);
  if (!row) return { ok: false, error: "Not found." };
  if (row.stage !== "interview_scheduled") return { ok: false, error: `Can't record notes from stage "${row.stage}".` };
  const text = (notes ?? "").trim().slice(0, 4000);
  if (!text) return { ok: false, error: "Notes can't be empty." };

  const now = Date.now();
  const combined = row.interview_notes ? `${row.interview_notes}\n\n${text}` : text;
  getDb()
    .prepare("UPDATE instructors SET stage = 'interviewed', interview_notes = ?, updated_at = ? WHERE id = ?")
    .run(combined, now, id);
  logActivity("instructor", id, "stage_change", "Interview notes recorded.", me.id);

  revalidatePath(`/app/instructors/${id}`);
  revalidatePath("/app/instructors");
  return { ok: true };
}

export async function submitForFounderReview(id: string): Promise<ActionResult> {
  const me = await requireStaff();
  const row = getInstructorRow(id);
  if (!row) return { ok: false, error: "Not found." };
  if (row.stage !== "interviewed") return { ok: false, error: `Can't submit from stage "${row.stage}".` };

  setStage(id, "founder_review");
  logActivity("instructor", id, "stage_change", "Submitted for founder review.", me.id);

  const now = Date.now();
  getDb()
    .prepare(
      "INSERT INTO tasks (id, title, owner_user_id, due_at, status, entity_type, entity_id, handoff_to_founder, created_at, updated_at) VALUES (?, ?, NULL, NULL, 'open', 'instructor', ?, 1, ?, ?)",
    )
    .run(`pfx-${randomUUID().slice(0, 8)}`, "Founder decision needed on applicant", id, now, now);

  revalidatePath(`/app/instructors/${id}`);
  revalidatePath("/app/instructors");
  revalidatePath("/app/tasks");
  return { ok: true };
}

export async function recordFounderDecision(
  id: string,
  decision: "accepted" | "rejected",
  note?: string,
): Promise<ActionResult> {
  const me = await requireAdmin();
  const row = getInstructorRow(id);
  if (!row) return { ok: false, error: "Not found." };
  if (row.stage !== "founder_review") return { ok: false, error: `Can't decide from stage "${row.stage}".` };
  if (decision !== "accepted" && decision !== "rejected") return { ok: false, error: "Invalid decision." };

  const now = Date.now();
  const db = getDb();
  const nextStage: InstructorStage = decision === "accepted" ? "onboarding" : "rejected";
  db.prepare(
    "UPDATE instructors SET stage = ?, founder_decision = ?, decided_by = ?, decided_at = ?, updated_at = ? WHERE id = ?",
  ).run(nextStage, decision, me.id, now, now, id);
  logActivity("instructor", id, "stage_change", `Founder decision: ${decision}.${note ? ` ${note.slice(0, 500)}` : ""}`, me.id);

  if (decision === "accepted") {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const person = db.prepare("SELECT * FROM people WHERE id = ?").get(row.person_id) as any;
    if (person?.email) {
      const invitation = createInvitationInternal({ role: "instructor", email: person.email, orgId: BOW_ORG_ID, cohortId: null });
      logActivity("instructor", id, "note", `Invitation created (${invitation.email}).`, me.id);
      createNotification({
        id: `ntf-instr-accepted-${id}`,
        userId: me.id,
        type: "instructor_pipeline",
        title: "Applicant accepted",
        body: `${person.name} was accepted and invited to onboard.`,
        link: `/app/instructors/${id}`,
      });
    }
  }

  revalidatePath(`/app/instructors/${id}`);
  revalidatePath("/app/instructors");
  revalidatePath("/app/admin/invitations");
  return { ok: true };
}

export async function updateApplicantOwner(id: string, ownerUserId: string): Promise<ActionResult> {
  await requireStaff();
  const row = getInstructorRow(id);
  if (!row) return { ok: false, error: "Not found." };
  getDb().prepare("UPDATE instructors SET owner_user_id = ?, updated_at = ? WHERE id = ?").run(ownerUserId || null, Date.now(), id);

  revalidatePath(`/app/instructors/${id}`);
  revalidatePath("/app/instructors");
  return { ok: true };
}

/* ---------------- training / practice eval / lifecycle (Phase C) ---------------- */

const REQUIRED_ONBOARDING_STAGE_FROM: InstructorStage[] = ["onboarding"];
const REQUIRED_TRAINING_STAGE_FROM: InstructorStage[] = ["training"];

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
  const row = getInstructorRow(instructorId);
  if (!row) return { ok: false, error: "Instructor not found." };
  const trainingModule = db.prepare("SELECT * FROM training_modules WHERE id = ? AND active = 1").get(moduleId) as { id: string } | undefined;
  if (!trainingModule) return { ok: false, error: "Module not found." };

  const now = Date.now();
  const existing = db
    .prepare("SELECT id FROM training_module_completions WHERE instructor_id = ? AND module_id = ?")
    .get(instructorId, moduleId);
  if (!existing) {
    db.prepare(
      "INSERT INTO training_module_completions (id, instructor_id, module_id, completed_at, notes) VALUES (?, ?, ?, ?, ?)",
    ).run(`pfx-${randomUUID().slice(0, 8)}`, instructorId, moduleId, now, (notes ?? "").trim().slice(0, 2000) || null);
    logActivity("instructor", instructorId, "note", "Training module completed.", me.id);
  }

  recomputeInstructorStatuses(instructorId);

  // Auto-advance forward only, never backward.
  const refreshed = getInstructorRow(instructorId);
  if (REQUIRED_ONBOARDING_STAGE_FROM.includes(refreshed.stage) && refreshed.onboarding_status === "complete") {
    setStage(instructorId, "training");
    logActivity("instructor", instructorId, "stage_change", "Onboarding complete — advanced to training.", me.id);
  } else if (REQUIRED_TRAINING_STAGE_FROM.includes(refreshed.stage) && refreshed.training_status === "complete") {
    setStage(instructorId, "practice_evaluation");
    logActivity("instructor", instructorId, "stage_change", "Training complete — advanced to practice evaluation.", me.id);
  }

  revalidatePath(`/app/instructors/${instructorId}`);
  revalidatePath("/app/instructors");
  revalidatePath("/app/teach");
  return { ok: true };
}

export async function moveToPracticeEvaluation(id: string): Promise<ActionResult> {
  const me = await requireStaff();
  const row = getInstructorRow(id);
  if (!row) return { ok: false, error: "Not found." };
  if (row.training_status !== "complete") return { ok: false, error: "Training isn't complete yet." };

  setStage(id, "practice_evaluation");
  logActivity("instructor", id, "stage_change", "Moved to practice evaluation.", me.id);

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
  const row = getInstructorRow(id);
  if (!row) return { ok: false, error: "Not found." };
  if (!DECISIONS.has(input.decision)) return { ok: false, error: "Invalid decision." };
  if (!validRating(input.ratingCurriculumDelivery) || !validRating(input.ratingCommunicationEngagement) || !validRating(input.ratingPreparednessReliability)) {
    return { ok: false, error: "Ratings must be integers 1–5." };
  }
  if (!Number.isFinite(input.evaluatedAt) || input.evaluatedAt <= 0) return { ok: false, error: "Invalid evaluation date." };

  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO practice_evaluations
        (id, instructor_id, evaluator_user_id, evaluated_at, lesson_used, rating_curriculum_delivery, rating_communication_engagement, rating_preparedness_reliability, strengths, concerns, decision, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      `pfx-${randomUUID().slice(0, 8)}`,
      id,
      (input.evaluatorUserId || me.id).slice(0, 60),
      input.evaluatedAt,
      (input.lessonUsed ?? "").trim().slice(0, 200) || null,
      input.ratingCurriculumDelivery,
      input.ratingCommunicationEngagement,
      input.ratingPreparednessReliability,
      (input.strengths ?? "").trim().slice(0, 2000) || null,
      (input.concerns ?? "").trim().slice(0, 2000) || null,
      input.decision,
      now,
    );

  recomputeInstructorStatuses(id);
  logActivity("instructor", id, "note", `Practice evaluation recorded: ${input.decision}.`, me.id);

  if (input.decision === "revise_retry") {
    const person = getDb().prepare("SELECT name FROM people WHERE id = ?").get(row.person_id) as { name: string } | undefined;
    getDb()
      .prepare(
        "INSERT INTO tasks (id, title, owner_user_id, due_at, status, entity_type, entity_id, handoff_to_founder, created_at, updated_at) VALUES (?, ?, NULL, NULL, 'open', 'instructor', ?, 0, ?, ?)",
      )
      .run(`pfx-${randomUUID().slice(0, 8)}`, `Re-evaluate ${person?.name ?? "instructor"}`, id, now, now);
  }

  revalidatePath(`/app/instructors/${id}`);
  revalidatePath("/app/instructors");
  return { ok: true };
}

export async function markEligible(id: string): Promise<ActionResult> {
  const me = await requireAdmin();
  const row = getInstructorRow(id);
  if (!row) return { ok: false, error: "Not found." };

  const latestEval = getDb()
    .prepare("SELECT decision FROM practice_evaluations WHERE instructor_id = ? ORDER BY evaluated_at DESC LIMIT 1")
    .get(id) as { decision: PracticeEvalDecision } | undefined;
  if (latestEval?.decision !== "pass" || row.training_status !== "complete") {
    return { ok: false, error: "not_ready" };
  }

  const now = Date.now();
  getDb()
    .prepare("UPDATE instructors SET stage = 'eligible', eligibility_status = 'eligible', updated_at = ? WHERE id = ?")
    .run(now, id);
  logActivity("instructor", id, "stage_change", "Marked eligible.", me.id);

  const person = getDb().prepare("SELECT name FROM people WHERE id = ?").get(row.person_id) as { name: string } | undefined;
  for (const staffId of listStaffUserIds()) {
    createNotification({
      id: `ntf-instr-eligible-${id}-${staffId}`,
      userId: staffId,
      type: "instructor_pipeline",
      title: "Instructor eligible",
      body: `${person?.name ?? "An instructor"} is now eligible to teach.`,
      link: `/app/instructors/${id}`,
    });
  }

  revalidatePath(`/app/instructors/${id}`);
  revalidatePath("/app/instructors");
  return { ok: true };
}

export async function markActive(id: string): Promise<ActionResult> {
  const me = await requireAdmin();
  const row = getInstructorRow(id);
  if (!row) return { ok: false, error: "Not found." };
  setStage(id, "active");
  logActivity("instructor", id, "stage_change", "Marked active.", me.id);

  revalidatePath(`/app/instructors/${id}`);
  revalidatePath("/app/instructors");
  return { ok: true };
}

export async function markInactive(id: string, reason?: string): Promise<ActionResult> {
  const me = await requireAdmin();
  const row = getInstructorRow(id);
  if (!row) return { ok: false, error: "Not found." };
  setStage(id, "inactive");
  logActivity("instructor", id, "stage_change", `Marked inactive.${reason ? ` ${reason.trim().slice(0, 500)}` : ""}`, me.id);

  revalidatePath(`/app/instructors/${id}`);
  revalidatePath("/app/instructors");
  return { ok: true };
}
