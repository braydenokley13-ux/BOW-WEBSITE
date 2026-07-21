"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireCapability, requireStaff, requireUser } from "@/lib/dal";
import { getPublicOpening, type OpeningQuestion } from "@/lib/people-work";
import { createNotification } from "@/lib/notifications";
import { createInvitationInternal, listStaffUserIds, logActivity } from "@/lib/hiring";
import { queueInvitationDelivery } from "@/lib/invitation-delivery";
import { localDateTimeToEpoch } from "@/lib/timezone";
import { clientAddressBucket, consumeRateLimit } from "@/lib/rate-limit";
import { queueCandidateCommunication } from "@/lib/candidate-communication";

type ActionResult = { ok: boolean; error?: string; id?: string; invitationToken?: string };
const TERMINAL_APPLICATIONS = new Set(["accepted", "rejected", "withdrawn"]);

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validEmail(value: string): boolean {
  return /^\S+@\S+\.\S+$/.test(value) && value.length <= 200;
}

function validateAnswers(questions: OpeningQuestion[], input: Record<string, string>): string | null {
  for (const question of questions) {
    const value = clean(input[question.key], 2_000);
    if (question.required && !value) return `${question.label} is required.`;
    if (question.type === "select" && value && !question.options?.includes(value)) return `Choose a valid ${question.label}.`;
  }
  return null;
}

export async function createPublicApplication(input: {
  openingSlug: string;
  name: string;
  email: string;
  phone?: string;
  answers: Record<string, string>;
}): Promise<ActionResult> {
  const slug = clean(input.openingSlug, 120);
  const name = clean(input.name, 120);
  const email = clean(input.email, 200).toLowerCase();
  const phone = clean(input.phone, 40);
  if (!name) return { ok: false, error: "Your name is required." };
  if (!validEmail(email)) return { ok: false, error: "Enter a valid email address." };
  const address = await clientAddressBucket();
  if (address) {
    const networkLimit = await consumeRateLimit("people-work-application-network", address, {
      limit: 12,
      windowMs: 24 * 60 * 60 * 1000,
      blockMs: 24 * 60 * 60 * 1000,
    });
    if (!networkLimit.allowed) return { ok: false, error: "Too many applications were submitted from this network. Try again later." };
  }
  const identityLimit = await consumeRateLimit("people-work-application-email", email, {
    limit: 3,
    windowMs: 30 * 24 * 60 * 60 * 1000,
    blockMs: 30 * 24 * 60 * 60 * 1000,
  });
  if (!identityLimit.allowed) return { ok: false, error: "An application for this email was submitted recently." };
  const opening = await getPublicOpening(slug);
  if (!opening) return { ok: false, error: "This opening is not currently accepting applications." };
  const answerError = validateAnswers(opening.questions, input.answers ?? {});
  if (answerError) return { ok: false, error: answerError };
  const answers = Object.fromEntries(opening.questions.map((question) => [question.key, clean(input.answers[question.key], 2_000)]));
  const source = answers.source || "BOW website";
  const id = `app-${randomUUID().slice(0, 12)}`;
  const now = Date.now();
  const db = getDb();
  await db.exec("BEGIN IMMEDIATE");
  try {
    const matches = (await db.prepare("SELECT id FROM people WHERE lower(trim(email)) = ? ORDER BY created_at").all(email)) as { id: string }[];
    if (matches.length > 1) throw new Error("identity_ambiguous");
    let personId = matches[0]?.id;
    if (!personId) {
      personId = `person-${randomUUID().slice(0, 12)}`;
      await db.prepare(
        `INSERT INTO people (id, name, email, phone, user_id, identity_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, 'inactive', ?, ?)`,
      ).run(personId, name, email, phone, now, now);
    }
    const duplicate = await db.prepare(
      `SELECT 1 FROM applications WHERE person_id = ? AND opening_id = ?
       AND lifecycle_status NOT IN ('rejected','withdrawn')`,
    ).get(personId, opening.openingId);
    if (duplicate) throw new Error("duplicate_application");
    const firstStage = opening.stages[0];
    if (!firstStage) throw new Error("opening_invalid");
    const requisition = (await db.prepare(
      `SELECT r.hiring_owner_user_id FROM openings o JOIN hiring_requisitions r ON r.id = o.requisition_id WHERE o.id = ?`,
    ).get(opening.openingId)) as { hiring_owner_user_id: string | null } | undefined;
    const dueAt = now + 48 * 60 * 60 * 1000;
    await db.prepare(
      `INSERT INTO applications
       (id, person_id, opening_id, opening_version_id, process_version_id, current_stage_version_id,
        lifecycle_status, owner_user_id, next_action, next_action_owner_user_id, next_action_due_at,
        source, answers, revision, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'applied', ?, 'Review application', ?, ?, ?, ?, 1, ?, ?)`,
    ).run(
      id, personId, opening.openingId, opening.openingVersionId, opening.processVersionId, firstStage.id,
      requisition?.hiring_owner_user_id ?? null, requisition?.hiring_owner_user_id ?? null, dueAt,
      source, JSON.stringify(answers), now, now,
    );
    await db.prepare(
      `INSERT INTO application_stage_events
       (id, application_id, from_stage_version_id, to_stage_version_id, event_type, note, actor_user_id, created_at)
       VALUES (?, ?, NULL, ?, 'created', 'Public application submitted.', NULL, ?)`,
    ).run(`ase-${randomUUID().slice(0, 12)}`, id, firstStage.id, now);
    await logActivity("application", id, "created", `${name} applied for ${opening.title}.`, null);
    for (const staffId of await listStaffUserIds()) {
      await createNotification({
        id: `ntf-application-${id}-${staffId}`,
        userId: staffId,
        type: "instructor_pipeline",
        title: "New instructor application",
        body: `${name} applied for ${opening.title}.`,
        link: `/app/hiring/applications/${id}`,
      });
    }
    await db.exec("COMMIT");
  } catch (error) {
    if (db.isTransaction) await db.exec("ROLLBACK");
    const code = error instanceof Error ? error.message : "";
    if (code === "duplicate_application") return { ok: false, error: "An active application for this opening already exists for that email." };
    if (code === "identity_ambiguous") return { ok: false, error: "We found more than one matching record. BOW staff must resolve the identity before another application can be submitted." };
    return { ok: false, error: "The application could not be recorded. Please try again." };
  }
  revalidatePath("/app/hiring");
  return { ok: true, id };
}

async function lockedApplication(id: string) {
  return await getDb().prepare("SELECT * FROM applications WHERE id = ? FOR UPDATE").get(id) as Record<string, unknown> | undefined;
}

function lifecycleForStage(type: string): string {
  if (type === "application") return "applied";
  if (type === "screen") return "screening";
  if (["interview", "work_sample", "teaching_demo"].includes(type)) return "interviewing";
  if (type === "decision") return "decision";
  return "accepted";
}

function nextActionForStage(type: string): string {
  if (type === "screen") return "Complete candidate screen";
  if (type === "interview") return "Schedule interview";
  if (type === "teaching_demo") return "Schedule and evaluate mini-teach";
  if (type === "decision") return "Record hiring decision";
  return "Complete onboarding requirements";
}

export async function advanceApplication(input: {
  applicationId: string;
  toStageVersionId: string;
  expectedRevision: number;
  note?: string;
}): Promise<ActionResult> {
  const me = await requireCapability("hiring.application.advance");
  const id = clean(input.applicationId, 120);
  const toStageId = clean(input.toStageVersionId, 120);
  const note = clean(input.note, 1_000);
  const db = getDb();
  const now = Date.now();
  await db.exec("BEGIN IMMEDIATE");
  try {
    const application = await lockedApplication(id);
    if (!application) throw new Error("missing");
    if (TERMINAL_APPLICATIONS.has(String(application.lifecycle_status))) throw new Error("terminal");
    if (Number(application.revision) !== Number(input.expectedRevision)) throw new Error("changed");
    const stage = (await db.prepare(
      `SELECT target.*, current.ordinal AS current_ordinal
         FROM hiring_stage_versions target
         JOIN hiring_stage_versions current ON current.id = ?
        WHERE target.id = ? AND target.process_version_id = ?`,
    ).get(application.current_stage_version_id, toStageId, application.process_version_id)) as Record<string, unknown> | undefined;
    if (!stage) throw new Error("stage_invalid");
    if (Number(stage.ordinal) <= Number(stage.current_ordinal)) throw new Error("stage_order");
    if (String(stage.stage_type) === "onboarding") throw new Error("decision_required");
    const lifecycle = lifecycleForStage(String(stage.stage_type));
    const nextAction = nextActionForStage(String(stage.stage_type));
    const slaHours = Number(stage.sla_hours ?? 72);
    const changed = await db.prepare(
      `UPDATE applications SET current_stage_version_id = ?, lifecycle_status = ?, next_action = ?,
       next_action_owner_user_id = COALESCE(owner_user_id, ?), next_action_due_at = ?, waiting_on = NULL,
       waiting_expected_at = NULL, revision = revision + 1, updated_at = ?
       WHERE id = ? AND revision = ?`,
    ).run(toStageId, lifecycle, nextAction, me.id, now + slaHours * 60 * 60 * 1000, now, id, input.expectedRevision);
    if (changed.changes !== 1) throw new Error("changed");
    await db.prepare(
      `INSERT INTO application_stage_events
       (id, application_id, from_stage_version_id, to_stage_version_id, event_type, note, actor_user_id, created_at)
       VALUES (?, ?, ?, ?, 'advanced', ?, ?, ?)`,
    ).run(`ase-${randomUUID().slice(0, 12)}`, id, application.current_stage_version_id, toStageId, note || null, me.id, now);
    if (["interview", "teaching_demo"].includes(String(stage.stage_type))) {
      await db.prepare(
        `INSERT INTO interview_events
         (id, application_id, stage_version_id, interviewer_user_ids, status, revision, created_at, updated_at)
         VALUES (?, ?, ?, '[]', 'needs_scheduling', 1, ?, ?)`,
      ).run(`iev-${randomUUID().slice(0, 12)}`, id, toStageId, now, now);
    }
    const legacyStage = String(stage.stage_type) === "screen" ? "reviewing"
      : String(stage.stage_type) === "interview" ? "reviewing"
      : String(stage.stage_type) === "decision" ? "founder_review" : null;
    if (legacyStage) await db.prepare("UPDATE instructors SET stage = ?, updated_at = ? WHERE id = ?").run(legacyStage, now, id);
    await logActivity("application", id, "stage_change", `Advanced to ${String(stage.title)}.${note ? ` ${note}` : ""}`, me.id);
    await db.exec("COMMIT");
  } catch (error) {
    if (db.isTransaction) await db.exec("ROLLBACK");
    const code = error instanceof Error ? error.message : "";
    if (code === "changed") return { ok: false, error: "This candidate changed in another window. Refresh before deciding again." };
    if (code === "terminal") return { ok: false, error: "This application already has a final decision." };
    if (code === "stage_order") return { ok: false, error: "Candidates can only move forward. Use the audited decision flow for final states." };
    if (code === "decision_required") return { ok: false, error: "Onboarding begins only after an accepted hiring decision." };
    return { ok: false, error: "The candidate could not be advanced." };
  }
  revalidatePath("/app/hiring");
  revalidatePath(`/app/hiring/applications/${id}`);
  return { ok: true };
}

export async function scheduleInterviewEvent(input: {
  eventId: string;
  expectedRevision: number;
  localDateTime: string;
  timeZone: string;
  durationMinutes: number;
  locationType: "video" | "phone" | "in_person";
  location: string;
}): Promise<ActionResult> {
  const me = await requireCapability("hiring.application.advance");
  const resolved = localDateTimeToEpoch(input.localDateTime, input.timeZone);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const duration = Math.round(Number(input.durationMinutes));
  if (duration < 10 || duration > 240) return { ok: false, error: "Choose a duration between 10 and 240 minutes." };
  const location = clean(input.location, 500);
  if (!location) return { ok: false, error: "Add a meeting link, phone plan, or location." };
  const db = getDb();
  const now = Date.now();
  let communicationId: string | null = null;
  await db.exec("BEGIN IMMEDIATE");
  try {
    const event = (await db.prepare("SELECT * FROM interview_events WHERE id = ? FOR UPDATE").get(input.eventId)) as Record<string, unknown> | undefined;
    if (!event) throw new Error("missing");
    if (Number(event.revision) !== input.expectedRevision) throw new Error("changed");
    const prior = JSON.stringify({ scheduledAt: event.scheduled_at, timezone: event.timezone, status: event.status });
    const nextStatus = event.scheduled_at ? "rescheduled" : "scheduled";
    const changed = await db.prepare(
      `UPDATE interview_events SET scheduled_at = ?, timezone = ?, duration_minutes = ?, location_type = ?,
       meeting_link_or_location = ?, status = ?, interviewer_user_ids = ?, revision = revision + 1, updated_at = ?
       WHERE id = ? AND revision = ?`,
    ).run(resolved.epoch, resolved.timeZone, duration, input.locationType, location, nextStatus, JSON.stringify([me.id]), now, input.eventId, input.expectedRevision);
    if (changed.changes !== 1) throw new Error("changed");
    await db.prepare(
      `INSERT INTO interview_event_history
       (id, interview_event_id, event_type, prior_value, next_value, actor_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(`ieh-${randomUUID().slice(0, 12)}`, input.eventId, nextStatus, prior,
      JSON.stringify({ scheduledAt: resolved.epoch, timezone: resolved.timeZone, duration, locationType: input.locationType }), me.id, now);
    await db.prepare(
      `UPDATE applications SET next_action = 'Complete interview and scorecard', next_action_owner_user_id = ?,
       next_action_due_at = ?, revision = revision + 1, updated_at = ? WHERE id = ?`,
    ).run(me.id, resolved.epoch + 24 * 60 * 60 * 1000, now, event.application_id);
    await db.prepare(
      "UPDATE instructors SET stage = 'interview_scheduled', interview_at = ?, interview_timezone = ?, updated_at = ? WHERE id = ?",
    ).run(resolved.epoch, resolved.timeZone, now, event.application_id);
    const recipient = await db.prepare(
      "SELECT p.email FROM applications a JOIN people p ON p.id = a.person_id WHERE a.id = ?",
    ).get(event.application_id) as { email: string } | undefined;
    if (!recipient) throw new Error("missing");
    communicationId = `com-${randomUUID().slice(0, 12)}`;
    await db.prepare(
      `INSERT INTO candidate_communications
       (id, application_id, interview_event_id, channel, recipient, subject, body, status, idempotency_key, created_by_user_id, created_at)
       VALUES (?, ?, ?, 'email', ?, 'Your BOW interview is scheduled', ?, 'queued', ?, ?, ?)`,
    ).run(
      communicationId, event.application_id, input.eventId, recipient.email,
      `Your BOW interview is scheduled for ${new Date(resolved.epoch).toISOString()} (${resolved.timeZone}).\n\n${input.locationType.replace("_", " ")}: ${location}\nDuration: ${duration} minutes.`,
      `interview-schedule:${input.eventId}:${Number(event.revision) + 1}`, me.id, now,
    );
    await logActivity("application", String(event.application_id), nextStatus, `Interview event ${nextStatus}.`, me.id);
    await db.exec("COMMIT");
  } catch (error) {
    if (db.isTransaction) await db.exec("ROLLBACK");
    if (error instanceof Error && error.message === "changed") return { ok: false, error: "This interview changed in another window. Refresh and try again." };
    return { ok: false, error: "The interview could not be scheduled." };
  }
  if (communicationId) queueCandidateCommunication(communicationId, me.id);
  revalidatePath("/app/hiring");
  return { ok: true };
}

export async function submitCandidateEvaluation(input: {
  applicationId: string;
  stageVersionId: string;
  responses: Record<string, string>;
  evidenceNote: string;
  recommendation: "strong_hire" | "hire" | "continue" | "do_not_hire";
}): Promise<ActionResult> {
  const me = await requireCapability("hiring.application.advance");
  const note = clean(input.evidenceNote, 4_000);
  if (note.length < 10) return { ok: false, error: "Add enough evidence to explain the recommendation." };
  const db = getDb();
  const stage = (await db.prepare(
    "SELECT scorecard_version_id FROM hiring_stage_versions WHERE id = ?",
  ).get(input.stageVersionId)) as { scorecard_version_id: string | null } | undefined;
  if (!stage?.scorecard_version_id) return { ok: false, error: "This stage does not have a published scorecard." };
  const id = `eval-${randomUUID().slice(0, 12)}`;
  const now = Date.now();
  await db.exec("BEGIN IMMEDIATE");
  try {
    await db.prepare(
      `INSERT INTO evaluations
       (id, application_id, stage_version_id, scorecard_version_id, evaluator_user_id, responses, evidence_note, recommendation, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, input.applicationId, input.stageVersionId, stage.scorecard_version_id, me.id,
      JSON.stringify(input.responses ?? {}), note, input.recommendation, now);
    await db.prepare(
      `UPDATE interview_events SET status = 'completed', revision = revision + 1, updated_at = ?
       WHERE application_id = ? AND stage_version_id = ? AND status IN ('scheduled','rescheduled')`,
    ).run(now, input.applicationId, input.stageVersionId);
    await db.prepare(
      `UPDATE applications SET next_action = 'Review evaluation and choose next stage', next_action_owner_user_id = ?,
       next_action_due_at = ?, revision = revision + 1, updated_at = ? WHERE id = ?`,
    ).run(me.id, now + 24 * 60 * 60 * 1000, now, input.applicationId);
    await logActivity("application", input.applicationId, "evaluation", `Scorecard submitted with recommendation: ${input.recommendation.replace(/_/g, " ")}.`, me.id);
    await db.exec("COMMIT");
  } catch {
    if (db.isTransaction) await db.exec("ROLLBACK");
    return { ok: false, error: "The evaluation could not be recorded." };
  }
  revalidatePath(`/app/hiring/applications/${input.applicationId}`);
  revalidatePath("/app/hiring");
  return { ok: true, id };
}

export async function updateInterviewEventStatus(input: {
  eventId: string;
  expectedRevision: number;
  status: "canceled" | "no_show";
  note: string;
}): Promise<ActionResult> {
  const me = await requireCapability("hiring.application.advance");
  const note = clean(input.note, 1_000);
  if (note.length < 5) return { ok: false, error: "Record what happened and the follow-up needed." };
  const db = getDb();
  const now = Date.now();
  await db.exec("BEGIN IMMEDIATE");
  try {
    const event = await db.prepare("SELECT * FROM interview_events WHERE id = ? FOR UPDATE").get(input.eventId) as Record<string, unknown> | undefined;
    if (!event || !["scheduled", "rescheduled"].includes(String(event.status))) throw new Error("state");
    if (Number(event.revision) !== Number(input.expectedRevision)) throw new Error("changed");
    const changed = await db.prepare(
      "UPDATE interview_events SET status = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?",
    ).run(input.status, now, input.eventId, input.expectedRevision);
    if (changed.changes !== 1) throw new Error("changed");
    await db.prepare(
      `INSERT INTO interview_event_history
       (id, interview_event_id, event_type, prior_value, next_value, actor_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(`ieh-${randomUUID().slice(0, 12)}`, input.eventId, input.status, JSON.stringify({ status: event.status }), JSON.stringify({ status: input.status, note }), me.id, now);
    await db.prepare(
      `UPDATE applications SET next_action = ?, next_action_owner_user_id = ?, next_action_due_at = ?,
       revision = revision + 1, updated_at = ? WHERE id = ?`,
    ).run(input.status === "no_show" ? "Follow up after candidate no-show" : "Review canceled appointment and reschedule if appropriate", me.id, now + 24 * 60 * 60 * 1000, now, event.application_id);
    await logActivity("application", String(event.application_id), input.status, note, me.id);
    await db.exec("COMMIT");
  } catch (error) {
    if (db.isTransaction) await db.exec("ROLLBACK");
    return { ok: false, error: error instanceof Error && error.message === "changed" ? "This appointment changed in another window. Refresh first." : "This appointment cannot be updated from its current state." };
  }
  revalidatePath("/app/hiring");
  return { ok: true };
}

export async function decideApplication(input: {
  applicationId: string;
  expectedRevision: number;
  decision: "accepted" | "rejected";
  note: string;
  engagementType?: "volunteer" | "employee" | "contractor" | "other";
}): Promise<ActionResult> {
  const me = await requireCapability("hiring.application.decide");
  const note = clean(input.note, 2_000);
  if (note.length < 10) return { ok: false, error: "Record the evidence behind the decision." };
  const db = getDb();
  const now = Date.now();
  let issuedInvitation: Awaited<ReturnType<typeof createInvitationInternal>> | null = null;
  await db.exec("BEGIN IMMEDIATE");
  try {
    const application = await lockedApplication(input.applicationId);
    if (!application) throw new Error("missing");
    if (Number(application.revision) !== input.expectedRevision) throw new Error("changed");
    if (TERMINAL_APPLICATIONS.has(String(application.lifecycle_status))) throw new Error("terminal");
    const person = (await db.prepare("SELECT * FROM people WHERE id = ?").get(application.person_id)) as Record<string, unknown> | undefined;
    if (!person) throw new Error("missing");
    const stages = (await db.prepare(
      "SELECT id, stage_type FROM hiring_stage_versions WHERE process_version_id = ? AND stage_type IN ('decision','onboarding')",
    ).all(application.process_version_id)) as { id: string; stage_type: string }[];
    const decisionStage = stages.find((value) => value.stage_type === "decision");
    const onboardingStage = stages.find((value) => value.stage_type === "onboarding");
    if (!decisionStage || (input.decision === "accepted" && !onboardingStage)) throw new Error("missing");
    const destinationStageId = input.decision === "accepted" ? onboardingStage!.id : decisionStage.id;
    const changed = await db.prepare(
      `UPDATE applications SET lifecycle_status = ?, current_stage_version_id = ?, next_action = NULL,
       next_action_owner_user_id = NULL, next_action_due_at = NULL, waiting_on = NULL, waiting_expected_at = NULL,
       decided_by_user_id = ?, decided_at = ?, revision = revision + 1, updated_at = ?
       WHERE id = ? AND revision = ?`,
    ).run(input.decision, destinationStageId, me.id, now, now, input.applicationId, input.expectedRevision);
    if (changed.changes !== 1) throw new Error("changed");
    await db.prepare(
      `INSERT INTO application_stage_events
       (id, application_id, from_stage_version_id, to_stage_version_id, event_type, note, actor_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(`ase-${randomUUID().slice(0, 12)}`, input.applicationId, application.current_stage_version_id, destinationStageId, input.decision, note, me.id, now);
    if (input.decision === "accepted") {
      await db.prepare(
        `INSERT INTO instructors
         (id, person_id, stage, source, owner_user_id, answers, founder_decision, decided_by, decided_at,
          onboarding_status, training_status, eligibility_status, created_at, updated_at)
         VALUES (?, ?, 'accepted', 'people_work_application', ?, ?, 'accepted', ?, ?, 'not_started', 'not_started', 'not_eligible', ?, ?)
         ON CONFLICT (id) DO UPDATE SET stage = 'accepted', founder_decision = 'accepted', decided_by = excluded.decided_by,
           decided_at = excluded.decided_at, updated_at = excluded.updated_at`,
      ).run(input.applicationId, application.person_id, application.owner_user_id ?? me.id, application.answers, me.id, now, now, now);
      const opening = (await db.prepare(
        `SELECT r.role_id, r.organization_unit_id FROM applications a
         JOIN openings o ON o.id = a.opening_id JOIN hiring_requisitions r ON r.id = o.requisition_id WHERE a.id = ?`,
      ).get(input.applicationId)) as { role_id: string; organization_unit_id: string };
      const assignmentId = `ra-${randomUUID().slice(0, 12)}`;
      await db.prepare(
        `INSERT INTO role_assignments
         (id, person_id, role_id, organization_unit_id, position_id, manager_assignment_id, engagement_type,
          status, is_primary, autonomy_level, starts_on, ends_on, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, NULL, ?, 'activating', false, 2, ?, NULL, ?, ?)`,
      ).run(assignmentId, application.person_id, opening.role_id, opening.organization_unit_id, input.engagementType ?? "volunteer",
        new Date(now).toISOString().slice(0, 10), now, now);
      await db.prepare(
        `INSERT INTO person_requirement_evidence
         (id, person_id, requirement_id, status, created_at, updated_at)
         SELECT 'pre-' || replace(gen_random_uuid()::text, '-', ''), ?, rr.requirement_id, 'pending', ?, ?
           FROM requirement_rules rr WHERE rr.scope_type = 'role' AND rr.scope_id = ?`,
      ).run(application.person_id, now, now, opening.role_id);
      const taskId = `wrk-${randomUUID().slice(0, 12)}`;
      await db.prepare(
        `INSERT INTO tasks
         (id, title, owner_user_id, doer_user_id, assigner_user_id, reviewer_user_id, due_on, status, workflow_state,
          kind, priority, context, expected_result, definition_of_done, evidence_requirement, review_required,
          autonomy_level, role_assignment_id, entity_type, entity_id, handoff_to_founder, created_at, updated_at)
         VALUES (?, 'Complete instructor onboarding', ?, NULL, ?, ?, ?, 'open', 'assigned', 'task', 'high',
          'Acceptance generated this activation Work.', 'Complete configured instructor activation requirements.',
          'Training, account setup, and required eligibility evidence are recorded.',
          'Link or record each completed requirement.', true, 1, ?, 'instructor', ?, 0, ?, ?)`,
      ).run(taskId, application.owner_user_id ?? me.id, me.id, application.owner_user_id ?? me.id,
        new Date(now + 14 * 86400000).toISOString().slice(0, 10), assignmentId, input.applicationId, now, now);
      issuedInvitation = await createInvitationInternal({ role: "instructor", email: String(person.email), orgId: "org-bow", cohortId: null });
      await db.prepare(
        `INSERT INTO candidate_communications
         (id, application_id, channel, recipient, subject, body, status, idempotency_key, created_by_user_id, created_at)
         VALUES (?, ?, 'email', ?, 'Your BOW Sports Capital invitation', 'Secure instructor invitation queued after acceptance.',
         'queued', ?, ?, ?)`,
      ).run(`com-${randomUUID().slice(0, 12)}`, input.applicationId, person.email, `accepted-invitation:${issuedInvitation.id}`, me.id, now);
      await db.prepare("UPDATE people SET identity_status = 'active', updated_at = ? WHERE id = ?").run(now, application.person_id);
    } else {
      await db.prepare("UPDATE instructors SET stage = 'rejected', founder_decision = 'rejected', decided_by = ?, decided_at = ?, updated_at = ? WHERE id = ?")
        .run(me.id, now, now, input.applicationId);
    }
    await logActivity("application", input.applicationId, "decision", `${input.decision}: ${note}`, me.id);
    await db.exec("COMMIT");
  } catch (error) {
    if (db.isTransaction) await db.exec("ROLLBACK");
    const code = error instanceof Error ? error.message : "";
    if (code === "changed") return { ok: false, error: "This application changed in another window. Refresh before deciding." };
    if (code === "terminal") return { ok: false, error: "This application already has a final decision." };
    return { ok: false, error: "The hiring decision could not be completed. No decision was saved." };
  }
  if (issuedInvitation) {
    queueInvitationDelivery({
      invitationId: issuedInvitation.id,
      token: issuedInvitation.token,
      email: issuedInvitation.email,
      role: issuedInvitation.role,
      actorUserId: me.id,
    });
  }
  revalidatePath("/app/hiring");
  revalidatePath(`/app/hiring/applications/${input.applicationId}`);
  return { ok: true, invitationToken: issuedInvitation?.token };
}

export async function createHiringPackage(input: {
  roleTitle: string;
  openingTitle: string;
  slug: string;
  targetHeadcount: number;
  neededBy?: string;
  summary?: string;
  timeCommitment?: string;
  includeScreen?: boolean;
  includeMiniTeach?: boolean;
}): Promise<ActionResult> {
  const me = await requireCapability("hiring.configure");
  const roleTitle = clean(input.roleTitle, 160);
  const openingTitle = clean(input.openingTitle, 160);
  const slug = clean(input.slug, 120).toLowerCase();
  if (!roleTitle || !openingTitle || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { ok: false, error: "Add valid role, opening, and URL names." };
  const target = Math.round(Number(input.targetHeadcount));
  if (target < 1 || target > 100000) return { ok: false, error: "Choose a target between 1 and 100,000." };
  const db = getDb();
  const now = Date.now();
  const key = randomUUID().slice(0, 12);
  await db.exec("BEGIN IMMEDIATE");
  try {
    const roleId = `role-${key}`;
    const processId = `hp-${key}`;
    const processVersionId = `hpv-${key}-v1`;
    const requisitionId = `hrq-${key}`;
    const openingId = `opening-${key}`;
    const openingVersionId = `ov-${key}-v1`;
    const questionSetId = `qsv-${key}-v1`;
    await db.prepare(
      `INSERT INTO org_roles
       (id, organization_unit_id, title, purpose, responsibilities, success_metrics, default_autonomy, review_cadence, status, created_at, updated_at)
       VALUES (?, 'ou-bow', ?, '', '[]', '[]', 2, 'quarterly', 'active', ?, ?)`,
    ).run(roleId, roleTitle, now, now);
    await db.prepare("INSERT INTO hiring_processes (id, name, status, created_at, updated_at) VALUES (?, ?, 'active', ?, ?)")
      .run(processId, `${roleTitle} Hiring Process`, now, now);
    await db.prepare(
      `INSERT INTO hiring_process_versions (id, hiring_process_id, version, status, created_by_user_id, created_at)
       VALUES (?, ?, 1, 'draft', ?, ?)`,
    ).run(processVersionId, processId, me.id, now);
    await db.prepare(
      `INSERT INTO question_set_versions (id, name, version, questions, status, published_at, created_at)
       VALUES (?, ?, 1, ?, 'draft', NULL, ?)`,
    ).run(questionSetId, `${roleTitle} Application`, JSON.stringify([
      { key: "motivation", label: "Why do you want to contribute to BOW?", type: "textarea", required: true },
      { key: "experience", label: "What relevant experience would you bring?", type: "textarea", required: true },
      { key: "source", label: "How did you hear about BOW?", type: "text", required: false },
    ]), now);
    const stages = [
      ["application", "Application", "application"],
      ...(input.includeScreen ? [["screen", "Screen", "screen"]] : []),
      ["interview", "Interview", "interview"],
      ...(input.includeMiniTeach ? [["mini-teach", "Mini-Teach", "teaching_demo"]] : []),
      ["decision", "Decision", "decision"],
      ["onboarding", "Onboarding", "onboarding"],
    ];
    for (let index = 0; index < stages.length; index += 1) {
      await db.prepare(
        `INSERT INTO hiring_stage_versions
         (id, process_version_id, stage_key, title, stage_type, ordinal, instructions, sla_hours, question_set_version_id, scorecard_version_id)
         VALUES (?, ?, ?, ?, ?, ?, '', 72, ?, ?)`,
      ).run(
        `hsv-${key}-${stages[index][0]}`, processVersionId, stages[index][0], stages[index][1], stages[index][2], index + 1,
        stages[index][2] === "application" ? questionSetId : null,
        stages[index][2] === "interview" ? "sc-interview-v1" : stages[index][2] === "teaching_demo" ? "sc-mini-v1" : null,
      );
    }
    await db.prepare(
      `INSERT INTO hiring_requisitions
       (id, role_id, organization_unit_id, hiring_owner_user_id, title, target_headcount, needed_by, status, created_at, updated_at)
       VALUES (?, ?, 'ou-bow', ?, ?, ?, ?, 'draft', ?, ?)`,
    ).run(requisitionId, roleId, me.id, `Recruit ${roleTitle}`, target, clean(input.neededBy, 10) || null, now, now);
    await db.prepare(
      "INSERT INTO openings (id, requisition_id, slug, status, current_version_id, created_at, updated_at) VALUES (?, ?, ?, 'draft', NULL, ?, ?)",
    ).run(openingId, requisitionId, slug, now, now);
    await db.prepare(
      `INSERT INTO opening_versions
       (id, opening_id, version, process_version_id, title, summary, description, responsibilities,
        time_commitment, engagement_types, eligibility, application_question_set_version_id, status, created_at)
       VALUES (?, ?, 1, ?, ?, ?, ?, '[]', ?, '["volunteer","contractor","employee","other"]', '[]', ?, 'draft', ?)`,
    ).run(openingVersionId, openingId, processVersionId, openingTitle, clean(input.summary, 500) || `Join BOW as ${roleTitle}.`, clean(input.summary, 4_000) || `Help BOW deliver its educational mission as ${roleTitle}.`, clean(input.timeCommitment, 200) || "Commitment confirmed during the hiring process.", questionSetId, now);
    await db.prepare("UPDATE openings SET current_version_id = ? WHERE id = ?").run(openingVersionId, openingId);
    await logActivity("opening", openingId, "created", `Draft hiring package created for ${openingTitle}.`, me.id);
    await db.exec("COMMIT");
  } catch {
    if (db.isTransaction) await db.exec("ROLLBACK");
    return { ok: false, error: "The draft hiring package could not be created. The URL may already be in use." };
  }
  revalidatePath("/app/hiring");
  return { ok: true };
}

export async function publishHiringPackage(openingIdValue: string): Promise<ActionResult> {
  const me = await requireCapability("hiring.configure");
  const openingId = clean(openingIdValue, 120);
  const db = getDb();
  const now = Date.now();
  await db.exec("BEGIN IMMEDIATE");
  try {
    const row = await db.prepare(
      `SELECT o.status, o.current_version_id, o.requisition_id, ov.process_version_id,
              ov.application_question_set_version_id
         FROM openings o JOIN opening_versions ov ON ov.id = o.current_version_id
        WHERE o.id = ? FOR UPDATE`,
    ).get(openingId) as { status: string; current_version_id: string; requisition_id: string; process_version_id: string; application_question_set_version_id: string | null } | undefined;
    if (!row || row.status !== "draft") throw new Error("state");
    await db.prepare("UPDATE hiring_process_versions SET status = 'published', published_at = ? WHERE id = ? AND status = 'draft'").run(now, row.process_version_id);
    if (row.application_question_set_version_id) await db.prepare("UPDATE question_set_versions SET status = 'published', published_at = ? WHERE id = ? AND status = 'draft'").run(now, row.application_question_set_version_id);
    await db.prepare("UPDATE opening_versions SET status = 'published', published_at = ? WHERE id = ? AND status = 'draft'").run(now, row.current_version_id);
    await db.prepare("UPDATE openings SET status = 'published', updated_at = ? WHERE id = ?").run(now, openingId);
    await db.prepare("UPDATE hiring_requisitions SET status = 'open', updated_at = ? WHERE id = ?").run(now, row.requisition_id);
    await logActivity("opening", openingId, "published", "Immutable opening and hiring-process version published.", me.id);
    await db.exec("COMMIT");
  } catch {
    if (db.isTransaction) await db.exec("ROLLBACK");
    return { ok: false, error: "Only a complete draft package can be published." };
  }
  revalidatePath("/app/hiring");
  revalidatePath("/teach");
  return { ok: true };
}

export async function retryCandidateInvitation(applicationIdValue: string): Promise<ActionResult> {
  const me = await requireCapability("hiring.application.decide");
  const applicationId = clean(applicationIdValue, 120);
  const db = getDb();
  let invitation: Awaited<ReturnType<typeof createInvitationInternal>> | null = null;
  const now = Date.now();
  await db.exec("BEGIN IMMEDIATE");
  try {
    const application = (await db.prepare(
      `SELECT a.lifecycle_status, p.email FROM applications a JOIN people p ON p.id = a.person_id
        WHERE a.id = ? FOR UPDATE`,
    ).get(applicationId)) as { lifecycle_status: string; email: string } | undefined;
    if (!application || application.lifecycle_status !== "accepted") throw new Error("not_accepted");
    invitation = await createInvitationInternal({ role: "instructor", email: application.email, orgId: "org-bow", cohortId: null });
    await db.prepare(
      `INSERT INTO candidate_communications
       (id, application_id, channel, recipient, subject, body, status, idempotency_key, created_by_user_id, created_at)
       VALUES (?, ?, 'email', ?, 'Your BOW Sports Capital invitation', 'Replacement secure invitation queued.',
       'queued', ?, ?, ?)`,
    ).run(`com-${randomUUID().slice(0, 12)}`, applicationId, application.email, `accepted-invitation:${invitation.id}`, me.id, now);
    await logActivity("application", applicationId, "communication_queued", "Replacement instructor invitation queued after an authorized retry.", me.id);
    await db.exec("COMMIT");
  } catch {
    if (db.isTransaction) await db.exec("ROLLBACK");
    return { ok: false, error: "A replacement invitation can only be issued for an accepted candidate." };
  }
  queueInvitationDelivery({ invitationId: invitation.id, token: invitation.token, email: invitation.email, role: invitation.role, actorUserId: me.id });
  revalidatePath(`/app/hiring/applications/${applicationId}`);
  revalidatePath("/app/hiring");
  return { ok: true, invitationToken: invitation.token };
}

export async function retryCandidateCommunication(communicationIdValue: string): Promise<ActionResult> {
  const me = await requireCapability("hiring.application.advance");
  const communicationId = clean(communicationIdValue, 120);
  const changed = await getDb().prepare(
    "UPDATE candidate_communications SET status = 'queued', failure_detail = NULL WHERE id = ? AND status = 'failed'",
  ).run(communicationId);
  if (changed.changes !== 1) return { ok: false, error: "Only a failed candidate message can be retried." };
  queueCandidateCommunication(communicationId, me.id);
  revalidatePath("/app/hiring");
  return { ok: true };
}

export async function startWork(taskIdValue: string): Promise<ActionResult> {
  const me = await requireUser();
  const taskId = clean(taskIdValue, 120);
  const db = getDb();
  const now = Date.now();
  const task = (await db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId)) as Record<string, unknown> | undefined;
  if (!task || task.status !== "open") return { ok: false, error: "This Work is no longer open." };
  if (![task.doer_user_id, task.owner_user_id].includes(me.id) && me.role !== "admin") return { ok: false, error: "Only the owner or doer can start this Work." };
  const changed = await db.prepare("UPDATE tasks SET workflow_state = 'in_progress', updated_at = ? WHERE id = ? AND workflow_state = 'assigned'")
    .run(now, taskId);
  if (changed.changes !== 1) return { ok: false, error: "This Work changed. Refresh and try again." };
  await db.prepare(
    "INSERT INTO task_events (id, task_id, event_type, prior_value, next_value, actor_user_id, created_at) VALUES (?, ?, 'started', 'assigned', 'in_progress', ?, ?)",
  ).run(`te-${randomUUID().slice(0, 12)}`, taskId, me.id, now);
  revalidatePath("/app/tasks");
  revalidatePath("/app/teach");
  return { ok: true };
}

export async function submitWork(input: { taskId: string; resultSummary: string; evidenceLinks: string; blockers?: string }): Promise<ActionResult> {
  const me = await requireUser();
  const summary = clean(input.resultSummary, 4_000);
  if (summary.length < 10) return { ok: false, error: "Explain the result before submitting." };
  const links = clean(input.evidenceLinks, 4_000).split(/\n+/).map((value) => value.trim()).filter(Boolean);
  if (links.some((value) => !/^https?:\/\//i.test(value))) return { ok: false, error: "Evidence links must start with http:// or https://." };
  const db = getDb();
  const now = Date.now();
  await db.exec("BEGIN IMMEDIATE");
  try {
    const task = (await db.prepare("SELECT * FROM tasks WHERE id = ? FOR UPDATE").get(input.taskId)) as Record<string, unknown> | undefined;
    if (!task || task.status !== "open") throw new Error("closed");
    if (![task.doer_user_id, task.owner_user_id].includes(me.id) && me.role !== "admin") throw new Error("forbidden");
    if (!["assigned", "in_progress", "revision_requested"].includes(String(task.workflow_state))) throw new Error("state");
    const count = (await db.prepare("SELECT COUNT(*) AS n FROM work_submissions WHERE task_id = ?").get(input.taskId)) as { n: number };
    const revision = Number(count.n) + 1;
    const submissionId = `ws-${randomUUID().slice(0, 12)}`;
    await db.prepare(
      `INSERT INTO work_submissions
       (id, task_id, revision, result_summary, evidence_links, blockers, submitted_by_user_id, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(submissionId, input.taskId, revision, summary, JSON.stringify(links), clean(input.blockers, 2_000) || null, me.id, now);
    await db.prepare("UPDATE tasks SET workflow_state = 'submitted', updated_at = ? WHERE id = ?")
      .run(now, input.taskId);
    await db.prepare(
      `INSERT INTO task_events (id, task_id, event_type, prior_value, next_value, actor_user_id, created_at)
       VALUES (?, ?, 'submitted', ?, 'submitted', ?, ?)`,
    ).run(`te-${randomUUID().slice(0, 12)}`, input.taskId, task.workflow_state, me.id, now);
    if (task.reviewer_user_id) {
      await createNotification({
        id: `ntf-work-submitted-${submissionId}`,
        userId: String(task.reviewer_user_id),
        type: "quality",
        title: "Work submitted for review",
        body: String(task.title),
        link: "/app/tasks?view=review",
      });
    }
    await db.exec("COMMIT");
  } catch (error) {
    if (db.isTransaction) await db.exec("ROLLBACK");
    const code = error instanceof Error ? error.message : "";
    if (code === "forbidden") return { ok: false, error: "Only the owner or doer can submit this Work." };
    return { ok: false, error: "This Work could not be submitted in its current state." };
  }
  revalidatePath("/app/tasks");
  revalidatePath("/app/teach");
  return { ok: true };
}

export async function reviewWork(input: {
  submissionId: string;
  decision: "excellent" | "meets_standard" | "needs_revision" | "unacceptable";
  feedback: string;
  revisionInstructions?: string;
}): Promise<ActionResult> {
  const me = await requireCapability("work.review");
  const feedback = clean(input.feedback, 4_000);
  if (feedback.length < 5) return { ok: false, error: "Add concise evidence-based feedback." };
  const db = getDb();
  const now = Date.now();
  await db.exec("BEGIN IMMEDIATE");
  try {
    const submission = (await db.prepare(
      `SELECT ws.*, t.title, t.reviewer_user_id, t.workflow_state, t.role_assignment_id,
              COALESCE(p.id, ra.person_id) AS person_id,
              COALESCE(
                (SELECT te.next_value FROM task_events te WHERE te.task_id = t.id AND te.event_type = 'due_date_changed' AND te.created_at <= ws.submitted_at ORDER BY te.created_at DESC LIMIT 1),
                (SELECT te.prior_value FROM task_events te WHERE te.task_id = t.id AND te.event_type = 'due_date_changed' ORDER BY te.created_at ASC LIMIT 1),
                t.due_on
              ) AS promised_due_on
         FROM work_submissions ws JOIN tasks t ON t.id = ws.task_id
         JOIN users u ON u.id = ws.submitted_by_user_id
         LEFT JOIN people p ON p.user_id = u.id
         LEFT JOIN role_assignments ra ON ra.id = t.role_assignment_id
        WHERE ws.id = ? FOR UPDATE`,
    ).get(input.submissionId)) as Record<string, unknown> | undefined;
    if (!submission) throw new Error("missing");
    if (submission.reviewer_user_id && submission.reviewer_user_id !== me.id && me.role !== "admin") throw new Error("forbidden");
    if (submission.workflow_state !== "submitted") throw new Error("state");
    const approved = ["excellent", "meets_standard"].includes(input.decision);
    const revision = input.decision === "needs_revision";
    await db.prepare(
      `INSERT INTO work_reviews
       (id, submission_id, reviewer_user_id, decision, completeness, feedback, revision_instructions, reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(`wr-${randomUUID().slice(0, 12)}`, input.submissionId, me.id, input.decision,
      approved ? "complete" : "incomplete", feedback, clean(input.revisionInstructions, 2_000) || null, now);
    const nextState = approved ? "approved" : revision ? "revision_requested" : "rejected";
    await db.prepare(
      "UPDATE tasks SET workflow_state = ?, status = ?, completed_at = ?, completion_note = ?, updated_at = ? WHERE id = ?",
    ).run(nextState, approved ? "done" : "open", approved ? now : null, approved ? feedback : null, now, submission.task_id);
    await db.prepare(
      `INSERT INTO task_events (id, task_id, event_type, prior_value, next_value, reason, actor_user_id, created_at)
       VALUES (?, ?, 'reviewed', 'submitted', ?, ?, ?, ?)`,
    ).run(`te-${randomUUID().slice(0, 12)}`, submission.task_id, nextState, feedback, me.id, now);
    if (approved) {
      await db.prepare(
        `INSERT INTO performance_events
         (id, person_id, role_assignment_id, source_type, source_id, dimension, signal, detail, actor_user_id, created_at)
         VALUES (?, ?, ?, 'work_approval', ?, 'output', 'approved', ?, ?, ?)`,
      ).run(`pe-${randomUUID().slice(0, 12)}`, submission.person_id, submission.role_assignment_id ?? null,
        input.submissionId, `Approved Work: ${String(submission.title)}`, me.id, now);
      await db.prepare(
        `INSERT INTO performance_events
         (id, person_id, role_assignment_id, source_type, source_id, dimension, signal, detail, actor_user_id, created_at)
         VALUES (?, ?, ?, 'work_review', ?, 'quality', ?, ?, ?, ?)`,
      ).run(`pe-${randomUUID().slice(0, 12)}`, submission.person_id, submission.role_assignment_id ?? null,
        input.submissionId, input.decision, feedback, me.id, now);
      if (submission.promised_due_on) {
        const submittedOn = new Date(Number(submission.submitted_at)).toISOString().slice(0, 10);
        const onTime = submittedOn <= String(submission.promised_due_on);
        await db.prepare(
          `INSERT INTO performance_events
           (id, person_id, role_assignment_id, source_type, source_id, dimension, signal, detail, actor_user_id, created_at)
           VALUES (?, ?, ?, 'system_reliability', ?, 'reliability', ?, ?, NULL, ?)`,
        ).run(`pe-${randomUUID().slice(0, 12)}`, submission.person_id, submission.role_assignment_id ?? null,
          input.submissionId, onTime ? "on_time" : "late", `Submission compared with the promised date in force at submission: ${String(submission.promised_due_on)}.`, now);
      }
    }
    await createNotification({
      id: `ntf-work-reviewed-${input.submissionId}`,
      userId: String(submission.submitted_by_user_id),
      type: "quality",
      title: approved ? "Work approved" : revision ? "Work needs revision" : "Work was not accepted",
      body: String(submission.title),
      link: "/app/teach",
    });
    await db.exec("COMMIT");
  } catch (error) {
    if (db.isTransaction) await db.exec("ROLLBACK");
    if (error instanceof Error && error.message === "forbidden") return { ok: false, error: "Only the designated reviewer can review this submission." };
    return { ok: false, error: "The review could not be recorded." };
  }
  revalidatePath("/app/tasks");
  revalidatePath("/app/teach");
  return { ok: true };
}

export async function cancelWork(taskIdValue: string, reasonValue: string): Promise<ActionResult> {
  const me = await requireStaff();
  const taskId = clean(taskIdValue, 120);
  const reason = clean(reasonValue, 1_000);
  if (reason.length < 5) return { ok: false, error: "Explain why the Work is no longer needed." };
  const db = getDb();
  const now = Date.now();
  const changed = await db.prepare(
    `UPDATE tasks SET workflow_state = 'canceled', status = 'done', completed_at = ?, completion_note = ?, updated_at = ?
     WHERE id = ? AND status = 'open'`,
  ).run(now, reason, now, taskId);
  if (changed.changes !== 1) return { ok: false, error: "This Work is no longer open." };
  await db.prepare(
    `INSERT INTO task_events (id, task_id, event_type, next_value, reason, actor_user_id, created_at)
     VALUES (?, ?, 'canceled', 'canceled', ?, ?, ?)`,
  ).run(`te-${randomUUID().slice(0, 12)}`, taskId, reason, me.id, now);
  revalidatePath("/app/tasks");
  return { ok: true };
}

export async function changeWorkDueDate(taskIdValue: string, dueOnValue: string, reasonValue: string): Promise<ActionResult> {
  const me = await requireStaff();
  const taskId = clean(taskIdValue, 120);
  const dueOn = clean(dueOnValue, 10);
  const reason = clean(reasonValue, 1_000);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) return { ok: false, error: "Choose a calendar due date." };
  if (reason.length < 5) return { ok: false, error: "Explain why the commitment date changed." };
  const db = getDb();
  const now = Date.now();
  await db.exec("BEGIN IMMEDIATE");
  try {
    const task = (await db.prepare("SELECT due_on, status FROM tasks WHERE id = ? FOR UPDATE").get(taskId)) as { due_on: string | null; status: string } | undefined;
    if (!task || task.status !== "open") throw new Error("closed");
    if (task.due_on === dueOn) throw new Error("same");
    await db.prepare("UPDATE tasks SET due_on = ?, due_at = NULL, updated_at = ? WHERE id = ?").run(dueOn, now, taskId);
    await db.prepare(
      `INSERT INTO task_events (id, task_id, event_type, prior_value, next_value, reason, actor_user_id, created_at)
       VALUES (?, ?, 'due_date_changed', ?, ?, ?, ?, ?)`,
    ).run(`te-${randomUUID().slice(0, 12)}`, taskId, task.due_on, dueOn, reason, me.id, now);
    await db.exec("COMMIT");
  } catch (error) {
    if (db.isTransaction) await db.exec("ROLLBACK");
    return { ok: false, error: error instanceof Error && error.message === "same" ? "Choose a different due date." : "This Work is no longer open." };
  }
  revalidatePath("/app/tasks");
  return { ok: true };
}
