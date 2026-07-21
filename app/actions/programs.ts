"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/dal";
import { logActivity, recomputeInstructorStatuses, type ClassStatus } from "@/lib/hiring";
import {
  PROGRAM_STAGES,
  allowedProgramTransitions,
  getClassStaffingRecommendation,
  getProgram,
  getProgramReadiness,
  type DeliveryFormat,
  type ProgramStage,
} from "@/lib/operations";
import { revalidateEntity } from "@/lib/routes";
import {
  classStaffingRecommendationFingerprint,
  recordClassStaffingDecision,
} from "@/lib/operational-decisions";
import { ensureInquiryTopology } from "@/lib/partner-intake";
import { isValidTimeZone } from "@/lib/timezone";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface ProgramInput {
  requestKey?: string | null;
  name: string;
  partnerOrgId?: string | null;
  primaryContactPersonId?: string | null;
  locationId?: string | null;
  curriculumId?: string | null;
  audience?: string | null;
  deliveryFormat: DeliveryFormat;
  stage?: ProgramStage;
  startDate?: string | null;
  endDate?: string | null;
  launchDate?: string | null;
  scheduleLabel?: string | null;
  scheduleDay?: number | null;
  scheduleStartTime?: string | null;
  scheduleEndTime?: string | null;
  scheduleTimezone?: string | null;
  capacity?: number | null;
  minimumEnrollment?: number | null;
  ownerUserId?: string | null;
  partnerConfirmed?: boolean;
  materialsStatus?: "not_ready" | "ordered" | "ready";
  sourceType?: string | null;
  sourceId?: string | null;
  parentProgramId?: string | null;
  notes?: string | null;
}

interface ProgramClassSourceRow {
  name: string;
  stage: ProgramStage;
  curriculum_id: string | null;
  partner_org_id: string | null;
  location_id: string | null;
  delivery_format: DeliveryFormat;
  start_date: string | null;
  end_date: string | null;
  schedule_label: string | null;
  schedule_day: number | null;
  schedule_start_time: string | null;
  schedule_end_time: string | null;
  schedule_timezone: string | null;
  audience: string | null;
  capacity: number | null;
  minimum_enrollment: number;
  updated_at: number;
}

const FORMATS = new Set<DeliveryFormat>(["in_person", "online", "hybrid"]);
const MATERIALS = new Set(["not_ready", "ordered", "ready"]);
const SOURCE_TYPES = new Set(["manual", "inquiry", "demo_request", "class", "class_proposal", "renewal", "expansion", "legacy_class"]);
const CREATE_SOURCE_TYPES = new Set(["manual", "inquiry", "demo_request", "class", "class_proposal"]);

function clean(value: string | null | undefined, max: number): string | null {
  const result = (value ?? "").trim().slice(0, max);
  return result || null;
}

function cleanId(value: string | null | undefined): string | null {
  const result = (value ?? "").trim();
  return result && result.length <= 120 ? result : null;
}

function validDate(value: string | null): boolean {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

function validTime(value: string | null): boolean {
  return !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

async function exists(table: "organizations" | "people" | "locations" | "curricula" | "users" | "programs", id: string | null): Promise<boolean> {
  if (!id) return true;
  return Boolean((await getDb().prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(id)));
}

async function operatingPartnerExists(id: string | null): Promise<boolean> {
  if (!id) return true;
  return Boolean(
    (await getDb().prepare("SELECT 1 FROM organizations WHERE id = ? AND status IN ('prospect','active')").get(id)),
  );
}

async function validateInput(input: ProgramInput) {
  const name = clean(input.name, 160);
  const partnerOrgId = cleanId(input.partnerOrgId);
  const primaryContactPersonId = cleanId(input.primaryContactPersonId);
  const locationId = input.deliveryFormat === "online" ? null : cleanId(input.locationId);
  const curriculumId = cleanId(input.curriculumId);
  const ownerUserId = cleanId(input.ownerUserId);
  const parentProgramId = cleanId(input.parentProgramId);
  const sourceType = clean(input.sourceType, 60) ?? "manual";
  const sourceId = cleanId(input.sourceId);
  const requestKey = cleanId(input.requestKey);
  const startDate = clean(input.startDate, 40);
  const endDate = clean(input.endDate, 40);
  const launchDate = clean(input.launchDate, 40);
  const scheduleStartTime = clean(input.scheduleStartTime, 5);
  const scheduleEndTime = clean(input.scheduleEndTime, 5);
  const scheduleTimezone = clean(input.scheduleTimezone, 100);
  const capacity = input.capacity == null ? null : Number(input.capacity);
  const minimumEnrollment = input.minimumEnrollment == null ? 1 : Number(input.minimumEnrollment);
  const scheduleDay = input.scheduleDay == null ? null : Number(input.scheduleDay);

  if (!name) return { ok: false as const, error: "Program name is required." };
  if (!FORMATS.has(input.deliveryFormat)) return { ok: false as const, error: "Choose a valid delivery format." };
  if (input.stage && !PROGRAM_STAGES.includes(input.stage)) return { ok: false as const, error: "Choose a valid Program stage." };
  if (!SOURCE_TYPES.has(sourceType)) return { ok: false as const, error: "Invalid Program source." };
  if (!validDate(startDate) || !validDate(endDate) || !validDate(launchDate)) return { ok: false as const, error: "Use valid Program dates." };
  if (!validTime(scheduleStartTime) || !validTime(scheduleEndTime)) return { ok: false as const, error: "Use times in HH:MM format." };
  if (startDate && endDate && Date.parse(endDate) < Date.parse(startDate)) {
    return { ok: false as const, error: "Program end date cannot be before its start date." };
  }
  if (launchDate && startDate && Date.parse(launchDate) < Date.parse(startDate)) {
    return { ok: false as const, error: "Launch date cannot be before the Program start date." };
  }
  if (launchDate && endDate && Date.parse(launchDate) > Date.parse(endDate)) {
    return { ok: false as const, error: "Launch date cannot be after the Program end date." };
  }
  const structuredScheduleParts = [scheduleDay != null, Boolean(scheduleStartTime), Boolean(scheduleEndTime)].filter(Boolean).length;
  if (structuredScheduleParts > 0 && structuredScheduleParts < 3) {
    return { ok: false as const, error: "Set the weekly day, start time, and end time together." };
  }
  if (structuredScheduleParts === 3 && !scheduleTimezone) {
    return { ok: false as const, error: "Choose the delivery timezone for this weekly schedule." };
  }
  if (scheduleTimezone && !isValidTimeZone(scheduleTimezone)) {
    return { ok: false as const, error: "Choose a valid IANA delivery timezone." };
  }
  if (scheduleStartTime && scheduleEndTime && scheduleEndTime <= scheduleStartTime) {
    return { ok: false as const, error: "Schedule end time must be after its start time." };
  }
  if (scheduleDay != null && (!Number.isInteger(scheduleDay) || scheduleDay < 0 || scheduleDay > 6)) {
    return { ok: false as const, error: "Choose a valid day of the week." };
  }
  if (capacity != null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000)) {
    return { ok: false as const, error: "Capacity must be between 1 and 10,000." };
  }
  if (!Number.isInteger(minimumEnrollment) || minimumEnrollment < 1 || minimumEnrollment > 10000) {
    return { ok: false as const, error: "Minimum enrollment must be between 1 and 10,000." };
  }
  if (capacity != null && minimumEnrollment > capacity) {
    return { ok: false as const, error: "Minimum enrollment cannot exceed capacity." };
  }
  if (!(await operatingPartnerExists(partnerOrgId))) {
    return { ok: false as const, error: "Only prospect or active partners can receive Program work." };
  }
  if (!(await exists("people", primaryContactPersonId))) return { ok: false as const, error: "Primary contact not found." };
  if (primaryContactPersonId && !partnerOrgId) {
    return { ok: false as const, error: "Choose the contact's partner organization first." };
  }
  if (primaryContactPersonId && partnerOrgId) {
    const relationship = (await getDb().prepare(
          `SELECT 1 FROM organization_people
        WHERE organization_id = ? AND person_id = ? AND active = 1
        LIMIT 1`,
        ).get(partnerOrgId, primaryContactPersonId));
    if (!relationship) {
      return { ok: false as const, error: "Choose a contact who is already connected to this partner organization." };
    }
  }
  if (!(await exists("locations", locationId))) return { ok: false as const, error: "Location not found." };
  if (locationId) {
    const location = (await getDb().prepare("SELECT stage FROM locations WHERE id = ?").get(locationId)) as { stage: string } | undefined;
    if (!location || location.stage === "closed") return { ok: false as const, error: "Closed Locations cannot receive new operating work." };
  }
  if (!(await exists("curricula", curriculumId))) return { ok: false as const, error: "Curriculum not found." };
  if (ownerUserId) {
    const owner = (await getDb().prepare("SELECT role, status FROM users WHERE id = ?").get(ownerUserId)) as
      | { role: string; status: string }
      | undefined;
    if (!owner) return { ok: false as const, error: "Owner not found." };
    if (!(["admin", "growth"].includes(owner.role) && owner.status === "active")) {
      return { ok: false as const, error: "Program owner must be an active BOW staff member." };
    }
  }
  if (!(await exists("programs", parentProgramId))) return { ok: false as const, error: "Parent Program not found." };

  return {
    ok: true as const,
    value: {
      name,
      requestKey,
      partnerOrgId,
      primaryContactPersonId,
      locationId,
      curriculumId,
      audience: clean(input.audience, 160),
      deliveryFormat: input.deliveryFormat,
      stage: input.stage ?? ("planning" as ProgramStage),
      startDate,
      endDate,
      launchDate,
      scheduleLabel: clean(input.scheduleLabel, 240),
      scheduleDay,
      scheduleStartTime,
      scheduleEndTime,
      scheduleTimezone,
      capacity,
      minimumEnrollment,
      ownerUserId,
      partnerConfirmed: Boolean(input.partnerConfirmed),
      materialsStatus: MATERIALS.has(input.materialsStatus ?? "") ? input.materialsStatus! : "not_ready",
      sourceType,
      sourceId,
      parentProgramId,
      notes: clean(input.notes, 5000),
    },
  };
}

function revalidateProgram(programId?: string) {
  revalidatePath("/app/programs");
  revalidatePath("/app/locations");
  revalidatePath("/app/partners");
  revalidatePath("/app/classes");
  revalidatePath("/app/tasks");
  revalidatePath("/app");
  if (programId) revalidateEntity("program", programId);
}

async function resolveLaunchPlanWorkIfReady(
  programId: string,
  actorUserId: string,
  now: number,
  force = false,
): Promise<void> {
  if (!force) {
    const readiness = (await getProgramReadiness(programId));
    const sourceFactKeys = new Set(["partner", "partner_confirmation", "contact", "owner", "location", "schedule", "curriculum", "materials"]);
    const sourceFactsReady = Boolean(
      readiness
      && readiness.items
        .filter((item) => sourceFactKeys.has(item.key))
        .every((item) => item.state === "complete" || item.state === "not_applicable"),
    );
    if (!sourceFactsReady) return;
  }

  const db = getDb();
  const tasks = (await db.prepare(
      `SELECT id FROM tasks
      WHERE entity_type = 'program' AND entity_id = ? AND status = 'open'
        AND title LIKE 'Complete launch plan:%'`,
    ).all(programId)) as { id: string }[];
  for (const task of tasks) {
    const completed = (await db.prepare(
          `UPDATE tasks
          SET status = 'done', completed_at = ?, completion_note = ?, updated_at = ?
        WHERE id = ? AND status = 'open'`,
        ).run(now, `Resolved from authoritative Program ${programId} launch facts.`, now, task.id));
    if (completed.changes !== 1) throw new Error("launch_plan_work_changed");
    (await logActivity("task", task.id, "completed", `Resolved from authoritative Program ${programId} launch facts.`, actorUserId));
  }
}

async function resolveContinuationHoldWork(programId: string, actorUserId: string, now: number, note: string): Promise<void> {
  const db = getDb();
  const tasks = (await db.prepare(
      `SELECT id FROM tasks
      WHERE entity_type = 'program' AND entity_id = ? AND status = 'open'
        AND kind = 'review' AND title LIKE 'Review continuation hold:%'`,
    ).all(programId)) as { id: string }[];
  for (const task of tasks) {
    const completed = (await db.prepare(
          `UPDATE tasks
          SET status = 'done', completed_at = ?, completion_note = ?, updated_at = ?
        WHERE id = ? AND status = 'open'`,
        ).run(now, note, now, task.id));
    if (completed.changes !== 1) throw new Error("continuation_hold_work_changed");
    (await logActivity("task", task.id, "completed", note, actorUserId));
  }
}

async function beginTransaction<T>(work: () => T): Promise<T> {
  const db = getDb();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const result = work();
    (await db.exec("COMMIT"));
    return result;
  } catch (error) {
    try {
      (await db.exec("ROLLBACK"));
    } catch {
      // The original error is the useful one.
    }
    throw error;
  }
}

/**
 * Keep the single-instructor legacy Cohort pointer aligned with the lead on
 * its one proven canonical Class projection. Canonical staffing remains the
 * authority; a missing active portal account therefore clears the legacy
 * pointer instead of granting delivery access through stale LMS data.
 */
async function synchronizeLegacyCohortLead(
  db: ReturnType<typeof getDb>,
  programId: string,
  classId: string,
  instructorId: string | null,
): Promise<void> {
  const source = (await db.prepare(
      "SELECT source_type, source_id FROM programs WHERE id = ?",
    ).get(programId)) as { source_type: string | null; source_id: string | null } | undefined;
  if (!source || source.source_type !== "legacy_class" || source.source_id !== classId) return;

  const legacyUser = instructorId
    ? (await db.prepare(
            `SELECT p.user_id
         FROM instructors i
         JOIN people p ON p.id = i.person_id
         JOIN users u ON u.id = p.user_id
        WHERE i.id = ? AND u.role = 'instructor' AND u.status = 'active'`,
          ).get(instructorId)) as { user_id: string } | undefined
    : undefined;
  const updated = (await db.prepare(
      "UPDATE cohorts SET instructor_id = ? WHERE id = ?",
    ).run(legacyUser?.user_id ?? null, source.source_id));
  if (updated.changes !== 1) throw new Error("legacy_projection_changed");
}

async function connectProgramTopology(
  db: ReturnType<typeof getDb>,
  organizationId: string | null,
  personId: string | null,
  locationId: string | null,
  now: number,
) {
  if (organizationId && personId) {
    (await db.prepare(
            `UPDATE organization_people
          SET active = 1, is_primary = 1, updated_at = ?
        WHERE organization_id = ? AND person_id = ? AND relationship_type = 'program_contact'`,
          ).run(now, organizationId, personId));
    (await db.prepare(
            `INSERT INTO organization_people
        (id, organization_id, person_id, relationship_type, is_primary, active, created_at, updated_at)
       SELECT ?, ?, ?, 'program_contact', 1, 1, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM organization_people
           WHERE organization_id = ? AND person_id = ? AND relationship_type = 'program_contact'
        )`,
          ).run(`orp-${randomUUID()}`, organizationId, personId, now, now, organizationId, personId));
  }
  if (organizationId && locationId) {
    (await db.prepare(
            `UPDATE organization_locations
          SET active = 1, updated_at = ?
        WHERE organization_id = ? AND location_id = ? AND relationship_type = 'program_site'`,
          ).run(now, organizationId, locationId));
    (await db.prepare(
            `INSERT INTO organization_locations
        (id, organization_id, location_id, relationship_type, active, created_at, updated_at)
       SELECT ?, ?, ?, 'program_site', 1, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM organization_locations
           WHERE organization_id = ? AND location_id = ? AND relationship_type = 'program_site'
        )`,
          ).run(`orl-${randomUUID()}`, organizationId, locationId, now, now, organizationId, locationId));
  }

  // Program-derived topology is a projection of every current Program. Keep
  // prior keys for history, but make active flags exact without deactivating a
  // relationship that another Program still uses.
  (await db.prepare(
        `UPDATE organization_people AS op
        SET active = CASE WHEN EXISTS (
          SELECT 1 FROM programs p
           WHERE p.partner_org_id = op.organization_id
             AND p.primary_contact_person_id = op.person_id
        ) THEN 1 ELSE 0 END,
            is_primary = CASE WHEN EXISTS (
          SELECT 1 FROM programs p
           WHERE p.partner_org_id = op.organization_id
             AND p.primary_contact_person_id = op.person_id
        ) THEN 1 ELSE 0 END,
            updated_at = ?
      WHERE op.relationship_type = 'program_contact'`,
      ).run(now));
  (await db.prepare(
        `UPDATE organization_locations AS ol
        SET active = CASE WHEN EXISTS (
          SELECT 1 FROM programs p
           WHERE p.partner_org_id = ol.organization_id
             AND p.location_id = ol.location_id
        ) THEN 1 ELSE 0 END,
            updated_at = ?
      WHERE ol.relationship_type = 'program_site'`,
      ).run(now));
}

function classStatusForProgramStage(stage: ProgramStage): ClassStatus | null {
  if (stage === "planning") return "planning";
  if (stage === "staffing") return "staffing";
  if (stage === "enrollment") return "staffing";
  if (stage === "ready_to_launch") return "ready_to_launch";
  if (stage === "active") return "active";
  if (stage === "paused") return "paused";
  if (stage === "completed") return "completed";
  if (stage === "closed") return "cancelled";
  return null;
}

function isHistoricalProgramStage(stage: ProgramStage): boolean {
  return stage === "completed" || stage === "renewal_review" || stage === "renewed" || stage === "closed";
}

async function synchronizeProgramClassStatuses(
  programId: string,
  stage: ProgramStage,
  now: number,
  actorUserId: string,
  transitionReason: string | null,
): Promise<void> {
  const db = getDb();
  const target = stage === "planning" ? "staffing" : classStatusForProgramStage(stage);
  if (!target || stage === "completed") return;
  const eligibleStatuses =
    stage === "planning"
      ? ["paused"]
      : stage === "staffing"
        ? ["planning", "ready_to_launch", "paused"]
        : stage === "enrollment"
          ? ["planning", "ready_to_launch", "paused"]
          : stage === "ready_to_launch"
      ? ["planning", "staffing"]
      : stage === "active"
        ? ["ready_to_launch", "paused"]
        : stage === "paused"
          ? ["planning", "staffing", "ready_to_launch", "active"]
          : stage === "closed"
            ? ["planning", "staffing", "ready_to_launch", "active", "paused", "cancelled"]
            : [];
  if (eligibleStatuses.length === 0) return;
  const placeholders = eligibleStatuses.map(() => "?").join(", ");
  const classes = (await db
      .prepare(`SELECT id, status FROM classes WHERE program_id = ? AND status IN (${placeholders})`)
      .all(programId, ...eligibleStatuses)) as { id: string; status: ClassStatus }[];
  const reason = `Program moved to ${stage.replace(/_/g, " ")}.${transitionReason ? ` ${transitionReason}` : ""}`;
  for (const cls of classes) {
    if (cls.status === target) continue;
    const updated = (await db.prepare("UPDATE classes SET status = ?, updated_at = ? WHERE id = ? AND status = ?").run(target, now, cls.id, cls.status));
    if (updated.changes !== 1) throw new Error(`Class ${cls.id} changed while the Program transition was being recorded.`);
    (await db.prepare(
            `INSERT INTO class_status_events
        (id, class_id, from_status, to_status, reason, actor_user_id, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'program_transition', ?)`,
          ).run(`cse-${randomUUID()}`, cls.id, cls.status, target, reason, actorUserId, now));
    (await logActivity("class", cls.id, "stage_change", `${reason} Class moved to ${target.replace(/_/g, " ")}.`, actorUserId));
  }
}

async function resolveSourcePartner(sourceType: string, sourceId: string | null, selectedPartnerId: string | null): Promise<string | null> {
  if (selectedPartnerId || !sourceId) return selectedPartnerId;
  const db = getDb();
  if (sourceType === "inquiry") {
    const inquiry = (await db.prepare(
          `SELECT i.organization_id
         FROM inquiries i
         JOIN organizations o ON o.id = i.organization_id AND o.status IN ('prospect','active')
        WHERE i.id = ?`,
        ).get(sourceId)) as { organization_id: string } | undefined;
    return inquiry?.organization_id ?? null;
  }
  if (sourceType === "demo_request") {
    const request = (await db
          .prepare("SELECT p.name FROM demo_requests d JOIN partner_orgs p ON p.slug = d.org_slug WHERE d.id = ?")
          .get(sourceId)) as { name: string } | undefined;
    if (request) {
      const org = (await db
              .prepare("SELECT id FROM organizations WHERE lower(trim(name)) = lower(trim(?)) AND status IN ('prospect','active') ORDER BY id LIMIT 1")
              .get(request.name)) as { id: string } | undefined;
      return org?.id ?? null;
    }
  }
  return null;
}

async function sourceExists(sourceType: string, sourceId: string | null): Promise<boolean> {
  if (sourceType === "manual") return sourceId == null;
  if (!sourceId) return false;
  const db = getDb();
  if (sourceType === "inquiry") {
    return Boolean((await db.prepare("SELECT 1 FROM inquiries WHERE id = ? AND status IN ('new','reviewing','contacted')").get(sourceId)));
  }
  if (sourceType === "demo_request") {
    return Boolean((await db.prepare("SELECT 1 FROM demo_requests WHERE id = ? AND dispositioned = 0").get(sourceId)));
  }
  if (sourceType === "class") {
    return Boolean((await db.prepare("SELECT 1 FROM classes WHERE id = ? AND program_id IS NULL AND status IN ('planning','staffing')").get(sourceId)));
  }
  if (sourceType === "class_proposal") {
    return Boolean((await db.prepare("SELECT 1 FROM class_proposals WHERE id = ? AND status = 'approved'").get(sourceId)));
  }
  if (sourceType === "renewal" || sourceType === "expansion") {
    const allowedStages = sourceType === "renewal"
      ? "('completed','renewal_review')"
      : "('active','completed','renewal_review')";
    return Boolean((await db.prepare(`SELECT 1 FROM programs WHERE id = ? AND stage IN ${allowedStages}`).get(sourceId)));
  }
  return false;
}

interface InquirySourceRow {
  id: string;
  organization_id: string | null;
  name: string;
  email: string;
  org_name: string;
  status: string;
}

async function getInquirySource(db: ReturnType<typeof getDb>, sourceId: string | null): Promise<InquirySourceRow | null> {
  if (!sourceId) return null;
  return ((await db.prepare("SELECT id, organization_id, name, email, org_name, status FROM inquiries WHERE id = ?").get(sourceId)) as InquirySourceRow | undefined) ?? null;
}

type StaffUser = Awaited<ReturnType<typeof requireStaff>>;

export async function createProgram(input: ProgramInput): Promise<ActionResult & { id?: string }> {
  const me = await requireStaff();
  return (await createProgramInternal(input, me, false));
}

async function createProgramInternal(
  input: ProgramInput,
  me: StaffUser,
  allowContinuation: boolean,
): Promise<ActionResult & { id?: string }> {
  const validated = (await validateInput(input));
  if (!validated.ok) return { ok: false, error: validated.error };
  const value = validated.value;
  if (value.stage !== "opportunity" && value.stage !== "planning") {
    return { ok: false, error: "A new Program must begin in Opportunity or Planning." };
  }
  const continuationSource = value.sourceType === "renewal" || value.sourceType === "expansion";
  if ((!allowContinuation && !CREATE_SOURCE_TYPES.has(value.sourceType)) || (allowContinuation && !continuationSource)) {
    return { ok: false, error: "That source type is reserved for migrated operating records." };
  }
  if (continuationSource && value.parentProgramId !== value.sourceId) {
    return { ok: false, error: "A continuation must identify the same Program as its source and parent." };
  }
  if (value.requestKey) {
    const existing = (await getDb().prepare(
          "SELECT id, source_type, source_id FROM programs WHERE request_key = ?",
        ).get(value.requestKey)) as { id: string; source_type: string | null; source_id: string | null } | undefined;
    if (existing) {
      if (existing.source_type === value.sourceType && existing.source_id === value.sourceId) {
        return { ok: true, id: existing.id };
      }
      return { ok: false, error: "That submission key already belongs to another Program. Refresh the form and try again." };
    }
  }
  if (!(await sourceExists(value.sourceType, value.sourceId))) {
    return { ok: false, error: "The selected Program source does not exist or is incomplete." };
  }
  if (
    value.sourceId &&
    ["inquiry", "demo_request", "class", "class_proposal"].includes(value.sourceType) &&
    (await getDb().prepare("SELECT 1 FROM programs WHERE source_type = ? AND source_id = ?").get(value.sourceType, value.sourceId))
  ) {
    return { ok: false, error: "That source has already been converted into a Program." };
  }
  let partnerOrgId = (await resolveSourcePartner(value.sourceType, value.sourceId, value.partnerOrgId));
  let primaryContactPersonId = value.primaryContactPersonId;
  const sourceCanResolvePartner = value.sourceType === "inquiry" && Boolean((await getInquirySource(getDb(), value.sourceId))?.organization_id);
  if (value.partnerConfirmed && !partnerOrgId && !sourceCanResolvePartner) {
    return { ok: false, error: "Choose a partner before recording partner confirmation." };
  }
  const id = `prg-${randomUUID().slice(0, 10)}`;
  const now = Date.now();
  const plannedLocation = value.locationId
    ? ((await getDb().prepare("SELECT name, city, state FROM locations WHERE id = ?").get(value.locationId)) as
        | { name: string; city: string | null; state: string | null }
        | undefined)
    : undefined;
  const plannedLocationLabel = plannedLocation
    ? [plannedLocation.name, plannedLocation.city, plannedLocation.state].filter(Boolean).join(" · ")
    : null;
  const plannedOnlineFormat = value.deliveryFormat === "online" ? "Online" : value.deliveryFormat === "hybrid" ? "Hybrid" : null;

  try {
    (await beginTransaction(async () => {
            const db = getDb();
            if (!(await sourceExists(value.sourceType, value.sourceId))) throw new Error("Program source is no longer eligible.");
            if (partnerOrgId && !(await db.prepare("SELECT 1 FROM organizations WHERE id = ? AND status IN ('prospect','active')").get(partnerOrgId))) {
              throw new Error("Program partner is no longer available.");
            }
            if (value.locationId && !(await db.prepare("SELECT 1 FROM locations WHERE id = ? AND stage != 'closed'").get(value.locationId))) {
              throw new Error("Program Location is no longer available.");
            }
            if (
              partnerOrgId
              && value.primaryContactPersonId
              && !(await db.prepare(
                          "SELECT 1 FROM organization_people WHERE organization_id = ? AND person_id = ? AND active = 1 LIMIT 1",
                        ).get(partnerOrgId, value.primaryContactPersonId))
            ) {
              throw new Error("Program contact is no longer connected to the partner.");
            }
            if (
              value.sourceId &&
              ["inquiry", "demo_request", "class", "class_proposal"].includes(value.sourceType) &&
              (await db.prepare("SELECT 1 FROM programs WHERE source_type = ? AND source_id = ?").get(value.sourceType, value.sourceId))
            ) {
              throw new Error("Program source has already been converted.");
            }

            if (value.sourceType === "inquiry") {
              const inquiry = (await getInquirySource(db, value.sourceId));
              if (!inquiry || !["new", "reviewing", "contacted"].includes(inquiry.status)) {
                throw new Error("Program source is no longer eligible.");
              }
              if (inquiry.organization_id && partnerOrgId && inquiry.organization_id !== partnerOrgId) {
                throw new Error("Inquiry partner does not match the reviewed demand record.");
              }
              partnerOrgId = partnerOrgId ?? inquiry.organization_id;
              const topology = (await ensureInquiryTopology(
                        db,
                        {
                          organizationName: inquiry.org_name,
                          contactName: inquiry.name,
                          contactEmail: inquiry.email,
                        },
                        {
                          selectedOrganizationId: partnerOrgId,
                          selectedPrimaryPersonId: primaryContactPersonId,
                          requireOperatingPartner: true,
                          now,
                        },
                      ));
              partnerOrgId = topology.organizationId;
              primaryContactPersonId = topology.primaryPersonId;
              if (!partnerOrgId) {
                throw new Error("Choose a partner organization before converting this inquiry.");
              }
            }
            if (partnerOrgId && !(await db.prepare("SELECT 1 FROM organizations WHERE id = ? AND status IN ('prospect','active')").get(partnerOrgId))) {
              throw new Error("Program partner is no longer available.");
            }
            if (
              value.sourceType === "renewal"
              && value.sourceId
              && (await db.prepare(
                          "SELECT 1 FROM programs WHERE source_type = 'renewal' AND source_id = ? AND stage != 'closed' LIMIT 1",
                        ).get(value.sourceId))
            ) {
              throw new Error("An open renewal already exists for this Program.");
            }
            if (value.partnerConfirmed && !partnerOrgId) throw new Error("Choose a partner before recording partner confirmation.");
            (await db.prepare(
                    `INSERT INTO programs
        (id, request_key, name, partner_org_id, primary_contact_person_id, location_id, curriculum_id, audience, delivery_format,
         stage, start_date, end_date, launch_date, schedule_label, schedule_day, schedule_start_time, schedule_end_time,
         schedule_timezone, capacity, minimum_enrollment, owner_user_id, partner_confirmed, materials_status, renewal_status,
         source_type, source_id, parent_program_id, outcome_summary, notes, launch_exception_reason,
         launch_exception_approved_by, launch_exception_approved_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'not_due', ?, ?, ?, NULL, ?, NULL, NULL, NULL, ?, ?)`,
                    ).run(
                    id,
                    value.requestKey,
                    value.name,
                    partnerOrgId,
                    primaryContactPersonId,
                    value.locationId,
                    value.curriculumId,
                    value.audience,
                    value.deliveryFormat,
                    value.stage,
                    value.startDate,
                    value.endDate,
                    value.launchDate,
                    value.scheduleLabel,
                    value.scheduleDay,
                    value.scheduleStartTime,
                    value.scheduleEndTime,
                    value.scheduleTimezone,
                    value.capacity,
                    value.minimumEnrollment,
                    value.ownerUserId ?? me.id,
                    value.partnerConfirmed ? 1 : 0,
                    value.materialsStatus,
                    value.sourceType,
                    value.sourceId,
                    value.parentProgramId,
                    value.notes,
                    now,
                    now,
                  ));
            (await connectProgramTopology(db, partnerOrgId, primaryContactPersonId, value.locationId, now));

            let classId: string | null = null;
            if (value.sourceType === "class" && value.sourceId) classId = value.sourceId;
            if (value.sourceType === "class_proposal" && value.sourceId) {
              const proposal = (await db.prepare("SELECT converted_class_id FROM class_proposals WHERE id = ?").get(value.sourceId)) as
                | { converted_class_id: string | null }
                | undefined;
              classId = proposal?.converted_class_id ?? null;
            }
            if (classId) {
              const cls = (await db.prepare("SELECT id, program_id FROM classes WHERE id = ?").get(classId)) as
                | { id: string; program_id: string | null }
                | undefined;
              if (!cls) throw new Error("Source Class not found.");
              if (cls.program_id && cls.program_id !== id) throw new Error("Source Class already belongs to another Program.");
              (await db.prepare(
                          `UPDATE classes SET
            program_id = ?, partner_org_id = COALESCE(?, partner_org_id), location_id = COALESCE(?, location_id), location = COALESCE(?, location),
            curriculum_id = COALESCE(?, curriculum_id), online_format = COALESCE(?, online_format), start_date = COALESCE(?, start_date),
            end_date = COALESCE(?, end_date), recurrence = COALESCE(?, recurrence),
            schedule_day = COALESCE(schedule_day, ?), schedule_start_time = COALESCE(schedule_start_time, ?),
            schedule_end_time = COALESCE(schedule_end_time, ?), schedule_timezone = COALESCE(schedule_timezone, ?),
            age_range = COALESCE(?, age_range),
            capacity = COALESCE(?, capacity), minimum_enrollment = ?, updated_at = ?
           WHERE id = ?`,
                        ).run(
                          id,
                          partnerOrgId,
                          value.locationId,
                          plannedLocationLabel,
                          value.curriculumId,
                          plannedOnlineFormat,
                          value.startDate,
                          value.endDate,
                          value.scheduleLabel,
                          value.scheduleDay,
                          value.scheduleStartTime,
                          value.scheduleEndTime,
                          value.scheduleTimezone,
                          value.audience,
                          value.capacity,
                          value.minimumEnrollment,
                          now,
                          classId,
                        ));
            }

            if (value.sourceType === "demo_request" && value.sourceId) {
              (await db.prepare("UPDATE demo_requests SET dispositioned = 1 WHERE id = ?").run(value.sourceId));
            }
            if (value.sourceType === "inquiry" && value.sourceId) {
              const converted = (await db.prepare(
                        `UPDATE inquiries
              SET status = 'converted_to_program', organization_id = ?
            WHERE id = ? AND status IN ('new','reviewing','contacted')
              AND (organization_id IS NULL OR organization_id = ?)`,
                      ).run(partnerOrgId, value.sourceId, partnerOrgId));
              if (converted.changes !== 1) throw new Error("Program source is no longer eligible.");
              (await logActivity("inquiry", value.sourceId, "converted", `Converted into Program ${value.name}.`, me.id));
              if (partnerOrgId) {
                (await logActivity("organization", partnerOrgId, "program_created", `Program ${value.name} created from a public inquiry.`, me.id));
              }
            }
            if ((value.sourceType === "renewal" || value.sourceType === "expansion") && value.sourceId) {
              (await db.prepare("UPDATE programs SET renewal_status = ?, updated_at = ? WHERE id = ?")
                          .run(value.sourceType === "renewal" ? "renewed" : "expanded", now, value.sourceId));
              (await logActivity(
                          "program",
                          value.sourceId,
                          value.sourceType,
                          `${value.sourceType === "renewal" ? "Renewal" : "Expansion"} Program ${id} created.`,
                          me.id,
                        ));
              (await resolveContinuationHoldWork(
                          value.sourceId,
                          me.id,
                          now,
                          `${value.sourceType === "renewal" ? "Renewal" : "Expansion"} Program created.`,
                        ));
            }

            (await logActivity("program", id, "created", `Program created${value.sourceType !== "manual" ? ` from ${value.sourceType.replace(/_/g, " ")}` : ""}.`, me.id));
            (await db.prepare(
                    `INSERT INTO tasks
        (id, title, owner_user_id, due_at, status, kind, priority, context, recommended_action,
         entity_type, entity_id, handoff_to_founder, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'open', 'task', 'normal', ?, ?, 'program', ?, 0, ?, ?)`,
                    ).run(
                    `wrk-${randomUUID().slice(0, 10)}`,
                    `Complete launch plan: ${value.name}`,
                    value.ownerUserId ?? me.id,
                    now + 7 * 24 * 60 * 60 * 1000,
                    "A complete Program plan allows staffing, enrollment, and launch readiness to be derived.",
                    "Confirm the partner, contact, Location, Curriculum, schedule, and launch date.",
                    id,
                    now,
                    now,
                    ));
            (await resolveLaunchPlanWorkIfReady(id, me.id, now));
          }));
  } catch (error) {
    if (value.requestKey) {
      const existing = (await getDb().prepare(
              "SELECT id, source_type, source_id FROM programs WHERE request_key = ?",
            ).get(value.requestKey)) as { id: string; source_type: string | null; source_id: string | null } | undefined;
      if (existing?.source_type === value.sourceType && existing.source_id === value.sourceId) {
        return { ok: true, id: existing.id };
      }
    }
    const message = error instanceof Error ? error.message : "";
    if (
      message === "Source Class not found." ||
      message === "Source Class already belongs to another Program." ||
      message === "Program source is no longer eligible." ||
      message === "Program source has already been converted." ||
      message === "Program Location is no longer available." ||
      message === "Program partner is no longer available." ||
      message === "Program contact is no longer connected to the partner." ||
      message === "Inquiry partner is no longer available." ||
      message === "Inquiry partner does not match the reviewed demand record." ||
      message === "Choose a partner organization before converting this inquiry." ||
      message === "Choose a partner before recording partner confirmation." ||
      message === "continuation_hold_work_changed" ||
      message === "An open renewal already exists for this Program."
    ) {
      return {
        ok: false,
        error: message === "continuation_hold_work_changed"
          ? "The continuation-review Work item changed while the new plan was being created. Refresh and try again."
          : message,
      };
    }
    return { ok: false, error: "The Program could not be created. No operating records were changed." };
  }

  revalidateProgram(id);
  return { ok: true, id };
}

export async function updateProgramPlan(id: string, input: ProgramInput): Promise<ActionResult> {
  const me = await requireStaff();
  const current = (await getProgram(id));
  if (!current) return { ok: false, error: "Program not found." };
  if (isHistoricalProgramStage(current.program.stage)) {
    return { ok: false, error: "Completed and closed Programs are historical records. Create a renewal or expansion instead." };
  }
  if (current.program.stage === "ready_to_launch" || current.program.stage === "active") {
    return {
      ok: false,
      error: "Authorized launch and active delivery plans are locked. Move the Program to Staffing or Recovery before amending source facts.",
    };
  }
  const validated = (await validateInput({ ...input, stage: current.program.stage, sourceType: current.program.sourceType ?? "manual" }));
  if (!validated.ok) return { ok: false, error: validated.error };
  const value = validated.value;
  const curriculumChanged = current.program.curriculumId !== value.curriculumId;
  const partnerFacingPlanChanged = [
    current.program.partnerOrgId !== value.partnerOrgId,
    current.program.primaryContactPersonId !== value.primaryContactPersonId,
    current.program.locationId !== value.locationId,
    current.program.curriculumId !== value.curriculumId,
    current.program.audience !== value.audience,
    current.program.deliveryFormat !== value.deliveryFormat,
    current.program.startDate !== value.startDate,
    current.program.endDate !== value.endDate,
    current.program.launchDate !== value.launchDate,
    current.program.scheduleLabel !== value.scheduleLabel,
    current.program.scheduleDay !== value.scheduleDay,
    current.program.scheduleStartTime !== value.scheduleStartTime,
    current.program.scheduleEndTime !== value.scheduleEndTime,
    current.program.scheduleTimezone !== value.scheduleTimezone,
    current.program.capacity !== value.capacity,
    current.program.minimumEnrollment !== value.minimumEnrollment,
  ].some(Boolean);
  if (partnerFacingPlanChanged) value.partnerConfirmed = false;
  if (curriculumChanged) value.materialsStatus = "not_ready";
  const changedFields = [
    ["name", current.program.name, value.name],
    ["partner", current.program.partnerOrgId, value.partnerOrgId],
    ["contact", current.program.primaryContactPersonId, value.primaryContactPersonId],
    ["Location", current.program.locationId, value.locationId],
    ["Curriculum", current.program.curriculumId, value.curriculumId],
    ["audience default", current.program.audience, value.audience],
    ["delivery format", current.program.deliveryFormat, value.deliveryFormat],
    ["start default", current.program.startDate, value.startDate],
    ["end default", current.program.endDate, value.endDate],
    ["launch date", current.program.launchDate, value.launchDate],
    ["schedule default", `${current.program.scheduleDay}|${current.program.scheduleStartTime}|${current.program.scheduleEndTime}|${current.program.scheduleTimezone}`, `${value.scheduleDay}|${value.scheduleStartTime}|${value.scheduleEndTime}|${value.scheduleTimezone}`],
    ["capacity default", current.program.capacity, value.capacity],
    ["minimum enrollment default", current.program.minimumEnrollment, value.minimumEnrollment],
    ["owner", current.program.ownerUserId, value.ownerUserId ?? me.id],
    ["partner confirmation", current.program.partnerConfirmed, value.partnerConfirmed],
    ["materials", current.program.materialsStatus, value.materialsStatus],
  ].filter(([, before, after]) => String(before ?? "") !== String(after ?? ""));
  if (value.partnerConfirmed && !value.partnerOrgId) {
    return { ok: false, error: "Choose a partner before recording partner confirmation." };
  }
  if (current.classes.length > 0 && !value.curriculumId) {
    return { ok: false, error: "A Program with delivery Classes must retain a Curriculum." };
  }
  const now = Date.now();
  const db = getDb();
  const location = value.locationId
    ? ((await db.prepare("SELECT name, city, state FROM locations WHERE id = ?").get(value.locationId)) as
        | { name: string; city: string | null; state: string | null }
        | undefined)
    : undefined;
  const locationLabel = location ? [location.name, location.city, location.state].filter(Boolean).join(" · ") : null;
  const onlineFormat = value.deliveryFormat === "online" ? "Online" : value.deliveryFormat === "hybrid" ? "Hybrid" : null;
  try {
    (await beginTransaction(async () => {
          if (value.partnerOrgId && !(await db.prepare("SELECT 1 FROM organizations WHERE id = ? AND status IN ('prospect','active')").get(value.partnerOrgId))) {
            throw new Error("partner_unavailable");
          }
          if (value.locationId && !(await db.prepare("SELECT 1 FROM locations WHERE id = ? AND stage != 'closed'").get(value.locationId))) {
            throw new Error("location_unavailable");
          }
          if (
            value.partnerOrgId
            && value.primaryContactPersonId
            && !(await db.prepare(
                      "SELECT 1 FROM organization_people WHERE organization_id = ? AND person_id = ? AND active = 1 LIMIT 1",
                    ).get(value.partnerOrgId, value.primaryContactPersonId))
          ) {
            throw new Error("contact_unavailable");
          }
          const liveClassCount = ((await db.prepare("SELECT COUNT(*) AS n FROM classes WHERE program_id = ?").get(id)) as { n: number }).n;
          if (liveClassCount > 0 && !value.curriculumId) throw new Error("program_changed");
          const updated = (await db.prepare(
                `UPDATE programs SET
        name = ?, partner_org_id = ?, primary_contact_person_id = ?, location_id = ?, curriculum_id = ?, audience = ?,
        delivery_format = ?, start_date = ?, end_date = ?, launch_date = ?, schedule_label = ?, schedule_day = ?,
        schedule_start_time = ?, schedule_end_time = ?, schedule_timezone = ?, capacity = ?, minimum_enrollment = ?, owner_user_id = ?,
        partner_confirmed = ?, materials_status = ?, notes = ?, updated_at = ?
       WHERE id = ? AND stage = ? AND updated_at = ?`,
              ).run(
                value.name,
                value.partnerOrgId,
                value.primaryContactPersonId,
                value.locationId,
                value.curriculumId,
                value.audience,
                value.deliveryFormat,
                value.startDate,
                value.endDate,
                value.launchDate,
                value.scheduleLabel,
                value.scheduleDay,
                value.scheduleStartTime,
                value.scheduleEndTime,
                value.scheduleTimezone,
                value.capacity,
                value.minimumEnrollment,
                value.ownerUserId ?? me.id,
                value.partnerConfirmed ? 1 : 0,
                value.materialsStatus,
                value.notes,
                now,
                id,
                current.program.stage,
                current.program.updatedAt,
              ));
          if (updated.changes !== 1) throw new Error("program_changed");
          (await connectProgramTopology(db, value.partnerOrgId, value.primaryContactPersonId, value.locationId, now));
          if (liveClassCount > 0) {
            (await db.prepare(
                      `UPDATE classes SET
          partner_org_id = ?, location_id = ?, location = ?, curriculum_id = ?, online_format = ?,
          schedule_timezone = COALESCE(schedule_timezone, ?), updated_at = ?
         WHERE program_id = ? AND status NOT IN ('completed','cancelled')`,
                    ).run(
                      value.partnerOrgId,
                      value.locationId,
                      locationLabel,
                      value.curriculumId,
                      onlineFormat,
                      value.scheduleTimezone,
                      now,
                      id,
                    ));
          }
          const changeSummary = changedFields.length > 0 ? changedFields.map(([label]) => label).join(", ") : "no material fields";
          (await logActivity("program", id, "plan_updated", `Program plan updated. Changed: ${changeSummary}. Shared partner, Location, Curriculum, and format were synchronized; Class schedules and delivery limits remained authoritative.`, me.id));
          (await resolveLaunchPlanWorkIfReady(id, me.id, now));
          }));
  } catch (error) {
    if (error instanceof Error && error.message === "program_changed") {
      return { ok: false, error: "The Program changed while this plan was being saved. Refresh and review the latest plan before trying again." };
    }
    if (error instanceof Error && error.message === "location_unavailable") {
      return { ok: false, error: "The selected Location closed or changed while this plan was being saved." };
    }
    if (error instanceof Error && error.message === "partner_unavailable") {
      return { ok: false, error: "The selected partner was paused, closed, or changed while this plan was being saved." };
    }
    if (error instanceof Error && error.message === "contact_unavailable") {
      return { ok: false, error: "The selected contact is no longer connected to this partner organization." };
    }
    if (error instanceof Error && error.message === "launch_plan_work_changed") {
      return { ok: false, error: "The launch-plan Work item changed while this Program was being saved. Refresh and try again." };
    }
    throw error;
  }
  revalidateProgram(id);
  return { ok: true };
}

export async function setProgramPartnerConfirmation(id: string, confirmed: boolean): Promise<ActionResult> {
  const me = await requireStaff();
  const db = getDb();
  const row = (await db.prepare("SELECT id, partner_org_id, stage FROM programs WHERE id = ?").get(id)) as
    | { id: string; partner_org_id: string | null; stage: ProgramStage }
    | undefined;
  if (!row) return { ok: false, error: "Program not found." };
  if (isHistoricalProgramStage(row.stage)) return { ok: false, error: "Historical Programs cannot be edited." };
  if (confirmed && !row.partner_org_id) return { ok: false, error: "Choose a partner before recording confirmation." };
  if (!confirmed && ["ready_to_launch", "active"].includes(row.stage)) {
    return { ok: false, error: "Move the Program back to Staffing or Recovery before withdrawing a launch fact." };
  }
  try {
    (await beginTransaction(async () => {
            const live = (await db.prepare("SELECT partner_org_id, stage FROM programs WHERE id = ?").get(id)) as
              | { partner_org_id: string | null; stage: ProgramStage }
              | undefined;
            if (!live || live.stage !== row.stage) throw new Error("program_changed");
            if (confirmed && !live.partner_org_id) throw new Error("partner_missing");
            if (
              confirmed
              && live.partner_org_id
              && !(await db.prepare("SELECT 1 FROM organizations WHERE id = ? AND status IN ('prospect','active')").get(live.partner_org_id))
            ) {
              throw new Error("partner_unavailable");
            }
            if (!confirmed && ["ready_to_launch", "active"].includes(live.stage)) throw new Error("launch_fact_locked");
            const updated = (await db.prepare("UPDATE programs SET partner_confirmed = ?, updated_at = ? WHERE id = ? AND stage = ?")
                    .run(confirmed ? 1 : 0, Date.now(), id, live.stage));
            if (updated.changes !== 1) throw new Error("program_changed");
            (await logActivity("program", id, "partner_confirmation", confirmed ? "Partner confirmation recorded." : "Partner confirmation removed.", me.id));
          }));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "partner_missing") return { ok: false, error: "Choose a partner before recording confirmation." };
    if (code === "partner_unavailable") return { ok: false, error: "Reactivate this partner before recording confirmation." };
    if (code === "launch_fact_locked") return { ok: false, error: "Move the Program back to Staffing or Recovery before withdrawing a launch fact." };
    if (code === "program_changed") return { ok: false, error: "The Program changed while confirmation was being recorded. Refresh and try again." };
    throw error;
  }
  revalidateProgram(id);
  return { ok: true };
}

export async function setProgramMaterialsStatus(
  id: string,
  status: "not_ready" | "ordered" | "ready",
): Promise<ActionResult> {
  const me = await requireStaff();
  if (!MATERIALS.has(status)) return { ok: false, error: "Invalid materials status." };
  const db = getDb();
  const row = (await db.prepare("SELECT id, stage FROM programs WHERE id = ?").get(id)) as { id: string; stage: ProgramStage } | undefined;
  if (!row) return { ok: false, error: "Program not found." };
  if (isHistoricalProgramStage(row.stage)) return { ok: false, error: "Historical Programs cannot be edited." };
  const currentStatus = (await db.prepare("SELECT materials_status FROM programs WHERE id = ?").get(id)) as
    | { materials_status: string }
    | undefined;
  if (["ready_to_launch", "active"].includes(row.stage) && currentStatus?.materials_status === "ready" && status !== "ready") {
    return { ok: false, error: "Move the Program back to Staffing or Recovery before removing material readiness." };
  }
  try {
    (await beginTransaction(async () => {
            const live = (await db.prepare("SELECT stage, materials_status FROM programs WHERE id = ?").get(id)) as
              | { stage: ProgramStage; materials_status: string }
              | undefined;
            if (!live || live.stage !== row.stage) throw new Error("program_changed");
            if (["ready_to_launch", "active"].includes(live.stage) && live.materials_status === "ready" && status !== "ready") {
              throw new Error("launch_fact_locked");
            }
            const updated = (await db.prepare("UPDATE programs SET materials_status = ?, updated_at = ? WHERE id = ? AND stage = ?")
                    .run(status, Date.now(), id, live.stage));
            if (updated.changes !== 1) throw new Error("program_changed");
            (await logActivity("program", id, "materials", `Materials marked ${status.replace(/_/g, " ")}.`, me.id));
          }));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "launch_fact_locked") return { ok: false, error: "Move the Program back to Staffing or Recovery before removing material readiness." };
    if (code === "program_changed") return { ok: false, error: "The Program changed while material readiness was being recorded. Refresh and try again." };
    throw error;
  }
  revalidateProgram(id);
  return { ok: true };
}

export async function attachClassToProgram(programId: string, classId: string): Promise<ActionResult> {
  const me = await requireStaff();
  const db = getDb();
  const program = (await db.prepare("SELECT * FROM programs WHERE id = ?").get(programId)) as
    | {
        id: string;
        partner_org_id: string | null;
        location_id: string | null;
        curriculum_id: string | null;
        minimum_enrollment: number;
        schedule_day: number | null;
        schedule_start_time: string | null;
        schedule_end_time: string | null;
        schedule_timezone: string | null;
        stage: ProgramStage;
      }
    | undefined;
  const cls = (await db.prepare("SELECT id, program_id, partner_org_id, location_id, curriculum_id, schedule_timezone, status FROM classes WHERE id = ?").get(classId)) as
    | { id: string; program_id: string | null; partner_org_id: string | null; location_id: string | null; curriculum_id: string | null; schedule_timezone: string | null; status: ClassStatus }
    | undefined;
  if (!program || !cls) return { ok: false, error: "Program or Class not found." };
  if (isHistoricalProgramStage(program.stage)) return { ok: false, error: "Historical Programs cannot receive new Classes." };
  if (program.stage === "ready_to_launch" || program.stage === "active") {
    return { ok: false, error: "Create an expansion Program instead of adding an unplanned Class after launch authorization." };
  }
  if (program.stage === "paused" || !["planning", "staffing"].includes(cls.status)) {
    return { ok: false, error: "Only a planning or staffing Class can be adopted into a pre-launch Program without rewriting live delivery history." };
  }
  if (cls.program_id && cls.program_id !== programId) return { ok: false, error: "This Class already belongs to another Program." };
  if (program.partner_org_id && cls.partner_org_id && program.partner_org_id !== cls.partner_org_id) {
    return { ok: false, error: "The Class and Program belong to different partners." };
  }
  if (program.location_id && cls.location_id && program.location_id !== cls.location_id) {
    return { ok: false, error: "The Class and Program use different Locations." };
  }
  if (program.curriculum_id && cls.curriculum_id && program.curriculum_id !== cls.curriculum_id) {
    return { ok: false, error: "The Class and Program use different Curricula." };
  }
  if (program.schedule_timezone && cls.schedule_timezone && program.schedule_timezone !== cls.schedule_timezone) {
    return { ok: false, error: "The Class and Program use different schedule timezones." };
  }
  const now = Date.now();
  try {
    (await beginTransaction(async () => {
            const liveProgram = (await db.prepare(
                    `SELECT id, partner_org_id, location_id, curriculum_id, minimum_enrollment,
                schedule_day, schedule_start_time, schedule_end_time, schedule_timezone, stage
           FROM programs WHERE id = ?`,
                  ).get(programId)) as typeof program | undefined;
            const liveClass = (await db.prepare(
                    "SELECT id, program_id, partner_org_id, location_id, curriculum_id, schedule_timezone, status FROM classes WHERE id = ?",
                  ).get(classId)) as typeof cls | undefined;
            if (!liveProgram || !liveClass) throw new Error("attachment_changed");
            if (isHistoricalProgramStage(liveProgram.stage) || ["ready_to_launch", "active", "paused"].includes(liveProgram.stage)) {
              throw new Error("attachment_changed");
            }
            if (!["planning", "staffing"].includes(liveClass.status)) throw new Error("attachment_changed");
            if (liveClass.program_id && liveClass.program_id !== programId) throw new Error("attachment_changed");
            if (liveProgram.partner_org_id && liveClass.partner_org_id && liveProgram.partner_org_id !== liveClass.partner_org_id) throw new Error("attachment_changed");
            if (liveProgram.location_id && liveClass.location_id && liveProgram.location_id !== liveClass.location_id) throw new Error("attachment_changed");
            if (liveProgram.curriculum_id && liveClass.curriculum_id && liveProgram.curriculum_id !== liveClass.curriculum_id) throw new Error("attachment_changed");
            if (liveProgram.schedule_timezone && liveClass.schedule_timezone && liveProgram.schedule_timezone !== liveClass.schedule_timezone) throw new Error("attachment_changed");
            const updated = (await db.prepare(
                    `UPDATE classes SET
          program_id = ?, partner_org_id = COALESCE(partner_org_id, ?), location_id = COALESCE(location_id, ?),
          curriculum_id = COALESCE(curriculum_id, ?),
          schedule_day = COALESCE(schedule_day, ?), schedule_start_time = COALESCE(schedule_start_time, ?),
          schedule_end_time = COALESCE(schedule_end_time, ?), schedule_timezone = COALESCE(schedule_timezone, ?),
          status = ?, updated_at = ?
         WHERE id = ? AND status = ? AND (program_id IS NULL OR program_id = ?)`,
                  ).run(
                    programId,
                    liveProgram.partner_org_id,
                    liveProgram.location_id,
                    liveProgram.curriculum_id,
                    liveProgram.schedule_day,
                    liveProgram.schedule_start_time,
                    liveProgram.schedule_end_time,
                    liveProgram.schedule_timezone,
                    liveProgram.stage === "staffing" || liveProgram.stage === "enrollment" ? "staffing" : "planning",
                    now,
                    classId,
                    liveClass.status,
                    programId,
                  ));
            if (updated.changes !== 1) throw new Error("attachment_changed");
            (await logActivity("program", programId, "class_attached", `Class ${classId} connected to the Program.`, me.id));
            (await logActivity("class", classId, "program_attached", `Connected to Program ${programId}.`, me.id));
          }));
  } catch (error) {
    if (error instanceof Error && error.message === "attachment_changed") {
      return { ok: false, error: "The Program or Class changed while they were being connected. Refresh and review the current plan before trying again." };
    }
    throw error;
  }
  revalidateProgram(programId);
  revalidatePath(`/app/classes/${classId}`);
  return { ok: true };
}

export async function createClassForProgram(programId: string, title?: string): Promise<ActionResult & { classId?: string }> {
  const me = await requireStaff();
  const db = getDb();
  const program = (await db.prepare("SELECT * FROM programs WHERE id = ?").get(programId)) as ProgramClassSourceRow | undefined;
  if (!program) return { ok: false, error: "Program not found." };
  if (isHistoricalProgramStage(program.stage)) return { ok: false, error: "Historical Programs cannot receive new Classes." };
  if (program.stage === "ready_to_launch" || program.stage === "active" || program.stage === "paused") {
    return { ok: false, error: "Create an expansion Program instead of adding an unplanned Class after launch authorization." };
  }
  if (!program.curriculum_id) return { ok: false, error: "Select a Curriculum before creating a Class." };
  const classId = `cls-${randomUUID().slice(0, 10)}`;
  const now = Date.now();
  const location = program.location_id
    ? ((await db.prepare("SELECT name, city, state FROM locations WHERE id = ?").get(program.location_id)) as
        | { name: string; city: string | null; state: string | null }
        | undefined)
    : undefined;
  const locationLabel = location ? [location.name, location.city, location.state].filter(Boolean).join(" · ") : null;
  const classTitle = clean(title, 160) ?? program.name;
  const classStatus = classStatusForProgramStage(program.stage) ?? "planning";

  try {
    (await beginTransaction(async () => {
            const liveProgram = (await db.prepare("SELECT stage, curriculum_id, updated_at FROM programs WHERE id = ?").get(programId)) as
              | { stage: ProgramStage; curriculum_id: string | null; updated_at: number }
              | undefined;
            if (
              !liveProgram
              || liveProgram.updated_at !== program.updated_at
              || liveProgram.curriculum_id !== program.curriculum_id
              || isHistoricalProgramStage(liveProgram.stage)
              || ["ready_to_launch", "active", "paused"].includes(liveProgram.stage)
            ) {
              throw new Error("program_changed");
            }
            (await db.prepare(
                    `INSERT INTO classes
        (id, title, curriculum_id, partner_org_id, location, online_format, start_date, end_date, recurrence,
         schedule_day, schedule_start_time, schedule_end_time, schedule_timezone, age_range, capacity, minimum_enrollment,
         lead_instructor_id, program_id, location_id, status, internal_notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
                    ).run(
                    classId,
                    classTitle,
                    program.curriculum_id,
                    program.partner_org_id,
                    locationLabel,
                    program.delivery_format === "online" ? "Online" : program.delivery_format === "hybrid" ? "Hybrid" : null,
                    program.start_date,
                    program.end_date,
                    program.schedule_label,
                    program.schedule_day,
                    program.schedule_start_time,
                    program.schedule_end_time,
                    program.schedule_timezone,
                    program.audience,
                    program.capacity,
                    program.minimum_enrollment,
                    programId,
                    program.location_id,
                    classStatus,
                    `Created from Program ${programId}.`,
                    now,
                    now,
                    ));
            (await logActivity("program", programId, "class_created", `Delivery Class created: ${classTitle}.`, me.id));
            (await logActivity("class", classId, "created", `Created from Program ${programId}.`, me.id));
          }));
  } catch (error) {
    if (error instanceof Error && error.message === "program_changed") {
      return { ok: false, error: "The Program plan changed while the Class was being created. Refresh and try again." };
    }
    throw error;
  }

  revalidateProgram(programId);
  revalidatePath(`/app/classes/${classId}`);
  return { ok: true, classId };
}

export async function assignInstructorToProgramClass(
  programId: string,
  classId: string,
  instructorId: string,
  role: "lead" | "additional" = "lead",
  decisionReason?: string,
): Promise<ActionResult> {
  const me = await requireStaff();
  const db = getDb();
  const cls = (await db.prepare("SELECT id, program_id, lead_instructor_id, status FROM classes WHERE id = ?").get(classId)) as
    | { id: string; program_id: string | null; lead_instructor_id: string | null; status: ClassStatus }
    | undefined;
  const instructor = (await db.prepare("SELECT id, stage, eligibility_status FROM instructors WHERE id = ?").get(instructorId)) as
    | { id: string; stage: string; eligibility_status: string }
    | undefined;
  if (!cls || cls.program_id !== programId) return { ok: false, error: "Class does not belong to this Program." };
  const programStage = (await getProgram(programId))?.program.stage;
  if (!programStage) return { ok: false, error: "Program not found." };
  if (isHistoricalProgramStage(programStage)) return { ok: false, error: "Historical Programs cannot be staffed." };
  if (["completed", "cancelled"].includes(cls.status)) return { ok: false, error: "Historical Classes cannot be staffed." };
  if (!instructor) return { ok: false, error: "Instructor not found." };
  if (instructor.eligibility_status !== "eligible" || !["eligible", "active"].includes(instructor.stage)) {
    return { ok: false, error: "Only an eligible instructor in the BOW network can be assigned." };
  }
  const missingRequirements = await db.prepare(
    `SELECT DISTINCT rd.title
       FROM instructors i
       JOIN role_assignments ra ON ra.person_id = i.person_id AND ra.status IN ('activating','active')
       JOIN requirement_rules rr ON rr.scope_type = 'role' AND rr.scope_id = ra.role_id AND rr.required = true
       JOIN requirement_definitions rd ON rd.id = rr.requirement_id AND rd.status = 'active'
       LEFT JOIN person_requirement_evidence pre ON pre.person_id = i.person_id
        AND pre.requirement_id = rr.requirement_id AND pre.status IN ('satisfied','waived')
      WHERE i.id = ? AND pre.id IS NULL ORDER BY rd.title`,
  ).all(instructorId) as { title: string }[];
  if (missingRequirements.length) {
    return { ok: false, error: `Protected teaching assignment blocked. Missing: ${missingRequirements.map((row) => row.title).join(", ")}.` };
  }
  if (role !== "lead" && role !== "additional") return { ok: false, error: "Invalid instructor role." };
  const recommendation = (await getClassStaffingRecommendation(programId, classId, instructorId, role));
  if (!recommendation || recommendation.tier === "blocked") {
    return { ok: false, error: "Resolve the instructor's required approvals before assigning them to this Program." };
  }
  const cleanDecisionReason = clean(decisionReason, 1000);
  if (recommendation.tier === "possible" && !cleanDecisionReason) {
    return { ok: false, error: "Document why leadership is accepting the remaining staffing conflicts." };
  }
  if (role === "additional" && cls.lead_instructor_id === instructorId) {
    return { ok: false, error: "Replace or remove the current lead instead of demoting them through an additional assignment." };
  }
  const now = Date.now();
  const recordedReason = cleanDecisionReason ?? `Assigned through a ${recommendation.tier} Program staffing recommendation.`;
  const initialRecommendationFingerprint = classStaffingRecommendationFingerprint({
    programId,
    classId,
    instructorId,
    role,
    classStatus: cls.status,
    recommendation,
  });

  try {
    (await beginTransaction(async () => {
          (await recomputeInstructorStatuses(instructorId));
          const liveClass = (await db.prepare("SELECT program_id, lead_instructor_id, status FROM classes WHERE id = ?").get(classId)) as
            | { program_id: string | null; lead_instructor_id: string | null; status: ClassStatus }
            | undefined;
          const liveProgram = (await db.prepare("SELECT stage FROM programs WHERE id = ?").get(programId)) as { stage: ProgramStage } | undefined;
          const liveInstructor = (await db.prepare("SELECT stage, eligibility_status FROM instructors WHERE id = ?").get(instructorId)) as
            | { stage: string; eligibility_status: string }
            | undefined;
          if (!liveClass || liveClass.program_id !== programId || !liveProgram || isHistoricalProgramStage(liveProgram.stage)) {
            throw new Error("staffing_changed");
          }
          if (["completed", "cancelled"].includes(liveClass.status)) throw new Error("staffing_changed");
          if (!liveInstructor || liveInstructor.eligibility_status !== "eligible" || !["eligible", "active"].includes(liveInstructor.stage)) {
            throw new Error("staffing_changed");
          }
          const requirementsMissing = await db.prepare(
            `SELECT 1 FROM instructors i
              JOIN role_assignments ra ON ra.person_id = i.person_id AND ra.status IN ('activating','active')
              JOIN requirement_rules rr ON rr.scope_type = 'role' AND rr.scope_id = ra.role_id AND rr.required = true
             WHERE i.id = ? AND NOT EXISTS (
               SELECT 1 FROM person_requirement_evidence pre
                WHERE pre.person_id = i.person_id AND pre.requirement_id = rr.requirement_id
                  AND pre.status IN ('satisfied','waived')
             ) LIMIT 1`,
          ).get(instructorId);
          if (requirementsMissing) throw new Error("staffing_changed");
          const liveRecommendation = await getClassStaffingRecommendation(programId, classId, instructorId, role);
          if (!liveRecommendation || liveRecommendation.tier === "blocked") throw new Error("staffing_changed");
          const liveRecommendationFingerprint = classStaffingRecommendationFingerprint({
            programId,
            classId,
            instructorId,
            role,
            classStatus: liveClass.status,
            recommendation: liveRecommendation,
          });
          if (liveRecommendationFingerprint !== initialRecommendationFingerprint) throw new Error("staffing_changed");
          if (role === "additional" && liveClass.lead_instructor_id === instructorId) throw new Error("staffing_changed");
          if (role === "lead") {
            const displacedLeads = (await db.prepare(
                    "SELECT id, instructor_id FROM class_instructors WHERE class_id = ? AND role = 'lead' AND removed_at IS NULL AND instructor_id <> ?",
                  ).all(classId, instructorId)) as { id: string; instructor_id: string }[];
            for (const displaced of displacedLeads) {
              const demotionReason = `Lead assignment replaced by instructor ${instructorId}. ${recordedReason}`;
              const decision = (await recordClassStaffingDecision(db, {
                        classId,
                        instructorId: displaced.instructor_id,
                        assignmentId: displaced.id,
                        action: "role_changed",
                        role: "additional",
                        reason: demotionReason,
                        actorUserId: me.id,
                        decidedAt: now,
                        programId,
                      }));
              (await db.prepare(
                          `UPDATE class_instructors
              SET role = 'additional', decision_reason = ?, assigned_by = ?, decision_id = ?,
                  decision_fingerprint = ?, decision_at = ?
            WHERE id = ? AND removed_at IS NULL`,
                        ).run(demotionReason, me.id, decision.decisionId, decision.fingerprint, now, displaced.id));
            }
            (await db.prepare("UPDATE classes SET lead_instructor_id = ?, updated_at = ? WHERE id = ?").run(instructorId, now, classId));
            (await synchronizeLegacyCohortLead(db, programId, classId, instructorId));
          }
          const existing = (await db
                .prepare("SELECT id, role FROM class_instructors WHERE class_id = ? AND instructor_id = ? AND removed_at IS NULL")
                .get(classId, instructorId)) as { id: string; role: string } | undefined;
          const assignmentId = existing?.id ?? `cin-${randomUUID().slice(0, 10)}`;
          const decision = (await recordClassStaffingDecision(db, {
                classId,
                instructorId,
                assignmentId,
                action: existing && existing.role !== role ? "role_changed" : "assigned",
                role,
                reason: recordedReason,
                actorUserId: me.id,
                decidedAt: now,
                programId,
                recommendationFingerprint: liveRecommendationFingerprint,
              }));
          if (existing) {
            (await db.prepare(
                      `UPDATE class_instructors
            SET role = ?, decision_reason = ?, assigned_by = ?, decision_id = ?,
                decision_fingerprint = ?, decision_at = ?
          WHERE id = ? AND removed_at IS NULL`,
                    ).run(role, recordedReason, me.id, decision.decisionId, decision.fingerprint, now, existing.id));
          } else {
            (await db.prepare(
                      `INSERT INTO class_instructors
          (id, class_id, instructor_id, role, decision_reason, assigned_by,
           decision_id, decision_fingerprint, decision_at, added_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    ).run(assignmentId, classId, instructorId, role, recordedReason, me.id, decision.decisionId, decision.fingerprint, now, now));
          }
          if (liveInstructor.stage === "eligible") {
            const activated = (await db.prepare(
                    "UPDATE instructors SET stage = 'active', updated_at = ? WHERE id = ? AND stage = 'eligible' AND eligibility_status = 'eligible'",
                  ).run(now, instructorId));
            if (activated.changes !== 1) throw new Error("staffing_changed");
            (await logActivity(
                      "instructor",
                      instructorId,
                      "stage_change",
                      "Activated automatically on first approved Class assignment.",
                      me.id,
                    ));
          }
          (await logActivity("program", programId, "staffing", `Instructor ${instructorId} assigned as ${role}. Decision record: ${recordedReason}`, me.id));
          (await logActivity("class", classId, "staffing", `Instructor ${instructorId} assigned as ${role}. Decision record: ${recordedReason}`, me.id));
          }));
  } catch (error) {
    if (error instanceof Error && error.message === "staffing_changed") {
      return { ok: false, error: "The Class, instructor eligibility, or staffing recommendation changed. Refresh and review the current recommendation before deciding." };
    }
    if (error instanceof Error && error.message === "legacy_projection_changed") {
      return { ok: false, error: "The linked LMS Cohort changed while staffing was saved. No staffing records were changed; refresh and reconcile the projection." };
    }
    throw error;
  }

  revalidateProgram(programId);
  revalidatePath(`/app/classes/${classId}`);
  revalidatePath(`/app/instructors/${instructorId}`);
  revalidatePath("/app/teach");
  return { ok: true };
}

export async function removeInstructorFromProgramClass(
  programId: string,
  classId: string,
  instructorId: string,
  removalReason?: string,
): Promise<ActionResult> {
  const me = await requireStaff();
  const db = getDb();
  const cls = (await db.prepare("SELECT program_id, lead_instructor_id, status FROM classes WHERE id = ?").get(classId)) as
    | { program_id: string | null; lead_instructor_id: string | null; status: ClassStatus }
    | undefined;
  const program = (await getProgram(programId))?.program;
  if (!cls || cls.program_id !== programId || !program) return { ok: false, error: "Program assignment not found." };
  if (isHistoricalProgramStage(program.stage)) return { ok: false, error: "Historical Programs cannot be restaffed." };
  if (["completed", "cancelled"].includes(cls.status)) return { ok: false, error: "Historical Classes cannot be restaffed." };
  const assignment = (await db.prepare("SELECT id, role FROM class_instructors WHERE class_id = ? AND instructor_id = ? AND removed_at IS NULL").get(classId, instructorId)) as
    | { id: string; role: string }
    | undefined;
  if (!assignment) return { ok: false, error: "Instructor is not assigned to this Class." };
  const recordedReason = clean(removalReason, 1000);
  if (!recordedReason || recordedReason.length < 3) {
    return { ok: false, error: "Record why this instructor is being removed so the next operator has context." };
  }
  const now = Date.now();
  try {
    (await beginTransaction(async () => {
            const liveClass = (await db.prepare("SELECT program_id, lead_instructor_id, status FROM classes WHERE id = ?").get(classId)) as
              | { program_id: string | null; lead_instructor_id: string | null; status: ClassStatus }
              | undefined;
            const liveProgram = (await db.prepare("SELECT stage FROM programs WHERE id = ?").get(programId)) as { stage: ProgramStage } | undefined;
            const liveAssignment = (await db.prepare("SELECT id, role FROM class_instructors WHERE class_id = ? AND instructor_id = ? AND removed_at IS NULL")
                    .get(classId, instructorId)) as { id: string; role: string } | undefined;
            if (
              !liveClass
              || liveClass.program_id !== programId
              || ["completed", "cancelled"].includes(liveClass.status)
              || !liveProgram
              || isHistoricalProgramStage(liveProgram.stage)
              || !liveAssignment
            ) {
              throw new Error("staffing_changed");
            }
            const removalDecision = (await recordClassStaffingDecision(db, {
                    classId,
                    instructorId,
                    assignmentId: liveAssignment.id,
                    action: "removed",
                    role: liveAssignment.role === "lead" ? "lead" : "additional",
                    reason: recordedReason,
                    actorUserId: me.id,
                    decidedAt: now,
                    programId,
                  }));
            const removed = (await db.prepare(
                    `UPDATE class_instructors
            SET removed_at = ?, removal_reason = ?, removed_by = ?,
                removal_decision_id = ?, removal_decision_fingerprint = ?
          WHERE id = ? AND removed_at IS NULL`,
                  ).run(
                    now,
                    recordedReason,
                    me.id,
                    removalDecision.decisionId,
                    removalDecision.fingerprint,
                    liveAssignment.id,
                  ));
            if (removed.changes !== 1) throw new Error("staffing_changed");
            if (liveClass.lead_instructor_id === instructorId) {
              (await db.prepare("UPDATE classes SET lead_instructor_id = NULL, updated_at = ? WHERE id = ? AND lead_instructor_id = ?")
                          .run(now, classId, instructorId));
              (await synchronizeLegacyCohortLead(db, programId, classId, null));
            }
            (await logActivity("program", programId, "staffing", `Instructor ${instructorId} removed from Class ${classId}. ${recordedReason}`, me.id));
            (await logActivity("class", classId, "staffing", `Instructor ${instructorId} removed through the Program launch room. ${recordedReason}`, me.id));
          }));
  } catch (error) {
    if (error instanceof Error && error.message === "staffing_changed") {
      return { ok: false, error: "The Program, Class, or staffing assignment changed. Refresh before recording this removal." };
    }
    if (error instanceof Error && error.message === "legacy_projection_changed") {
      return { ok: false, error: "The linked LMS Cohort changed while staffing was removed. No staffing records were changed; refresh and reconcile the projection." };
    }
    throw error;
  }
  revalidateProgram(programId);
  revalidatePath(`/app/classes/${classId}`);
  revalidatePath(`/app/instructors/${instructorId}`);
  revalidatePath("/app/teach");
  return { ok: true };
}

export async function transitionProgram(
  id: string,
  nextStage: ProgramStage,
  note?: string,
  launchExceptionReason?: string,
): Promise<ActionResult> {
  const me = await requireStaff();
  const detail = (await getProgram(id));
  if (!detail) return { ok: false, error: "Program not found." };
  if (!PROGRAM_STAGES.includes(nextStage)) return { ok: false, error: "Invalid Program stage." };
  if (!allowedProgramTransitions(detail.program.stage).includes(nextStage)) {
    return { ok: false, error: `A Program cannot move from ${detail.program.stage.replace(/_/g, " ")} to ${nextStage.replace(/_/g, " ")}.` };
  }
  if (nextStage === "completed") {
    return { ok: false, error: "Use Complete Program so the outcome record is captured before delivery closes." };
  }
  if (nextStage === "partner_confirmed" && (!detail.program.partnerOrgId || !detail.program.partnerConfirmed)) {
    return { ok: false, error: "Link the partner and record its confirmation before moving to Partner Confirmed." };
  }

  const launchGate = nextStage === "ready_to_launch" || nextStage === "active";
  const readiness = launchGate ? (await getProgramReadiness(id)) : null;
  if (launchGate && !readiness) return { ok: false, error: "Program readiness could not be evaluated. Refresh and try again." };
  const readinessSnapshot = readiness
    ? JSON.stringify(readiness.items.map((item) => [item.key, item.state, item.detail]))
    : null;
  const needsException = Boolean(launchGate && readiness && !readiness.canLaunch);
  const exception = needsException ? clean(launchExceptionReason, 1000) : null;
  if (needsException) {
    if (me.role !== "admin") return { ok: false, error: "Launch blockers must be resolved or approved by the founder." };
    if (!exception) return { ok: false, error: "Explain the launch exception before overriding blockers." };
  }

  const now = Date.now();
  const cleanNote = clean(note, 1000);
  if ((nextStage === "paused" || nextStage === "closed") && !cleanNote) {
    return { ok: false, error: "Record the reason and recovery or closure decision before changing this lifecycle state." };
  }
  try {
    (await beginTransaction(async () => {
            const live = await getProgram(id);
            if (!live || live.program.stage !== detail.program.stage) throw new Error("program_changed");
            if (!allowedProgramTransitions(live.program.stage).includes(nextStage)) throw new Error("program_changed");
            if (nextStage === "partner_confirmed" && (!live.program.partnerOrgId || !live.program.partnerConfirmed)) {
              throw new Error("partner_not_confirmed");
            }
            if (launchGate) {
              const liveReadiness = await getProgramReadiness(id);
              if (!liveReadiness) throw new Error("program_changed");
              const liveSnapshot = JSON.stringify(liveReadiness.items.map((item) => [item.key, item.state, item.detail]));
              if (liveSnapshot !== readinessSnapshot) throw new Error("readiness_changed");
            }
            const updated = (await getDb()
                    .prepare(
                      `UPDATE programs SET stage = ?, renewal_status = CASE
             WHEN ? = 'renewal_review' THEN 'in_review'
             WHEN ? = 'closed' AND stage IN ('completed','renewal_review','renewed') THEN 'not_pursued'
             ELSE renewal_status
           END,
           launch_exception_reason = ?, launch_exception_approved_by = ?, launch_exception_approved_at = ?, updated_at = ?
           WHERE id = ? AND stage = ?`,
                    )
                    .run(
                      nextStage,
                      nextStage,
                      nextStage,
                      needsException ? exception : null,
                      needsException ? me.id : null,
                      needsException ? now : null,
                      now,
                      id,
                      detail.program.stage,
                    ));
            if (updated.changes !== 1) throw new Error("program_changed");
            (await synchronizeProgramClassStatuses(id, nextStage, now, me.id, cleanNote));
            (await logActivity(
                      "program",
                      id,
                      "stage_change",
                      `Program moved from ${detail.program.stage.replace(/_/g, " ")} to ${nextStage.replace(/_/g, " ")}.${cleanNote ? ` ${cleanNote}` : ""}${needsException && exception ? ` Launch exception: ${exception}` : ""}`,
                      me.id,
                    ));
            if (nextStage === "ready_to_launch" || nextStage === "active") {
              (await resolveLaunchPlanWorkIfReady(id, me.id, now, true));
            }
            if (nextStage === "renewal_review" || nextStage === "closed") {
              (await resolveContinuationHoldWork(
                          id,
                          me.id,
                          now,
                          nextStage === "renewal_review" ? "Continuation review resumed." : "Program closed; continuation hold ended.",
                        ));
            }
          }));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "partner_not_confirmed") return { ok: false, error: "Link the partner and record its confirmation before moving to Partner Confirmed." };
    if (code === "readiness_changed") return { ok: false, error: "Launch readiness changed while this decision was being recorded. Review the current blockers and try again." };
    if (code === "program_changed") return { ok: false, error: "The Program lifecycle changed while this decision was being recorded. Refresh and try again." };
    if (code === "launch_plan_work_changed") return { ok: false, error: "The launch-plan Work item changed while this lifecycle decision was being recorded. Refresh and try again." };
    if (code === "continuation_hold_work_changed") return { ok: false, error: "The continuation-review Work item changed while this decision was being recorded. Refresh and try again." };
    throw error;
  }
  revalidateProgram(id);
  return { ok: true };
}

export async function completeProgram(id: string, outcomeSummary: string): Promise<ActionResult> {
  const me = await requireStaff();
  const summary = clean(outcomeSummary, 5000);
  if (!summary) return { ok: false, error: "Record the Program outcome before completing it." };
  const row = (await getDb().prepare("SELECT stage FROM programs WHERE id = ?").get(id)) as { stage: ProgramStage } | undefined;
  if (!row) return { ok: false, error: "Program not found." };
  if (row.stage !== "active") return { ok: false, error: "Only an active Program can be completed." };
  const openClasses = (await getDb()
      .prepare("SELECT title, status FROM classes WHERE program_id = ? AND status NOT IN ('completed','cancelled') ORDER BY title")
      .all(id)) as { title: string; status: string }[];
  if (openClasses.length > 0) {
    return {
      ok: false,
      error: `Complete or cancel every delivery Class first. Still open: ${openClasses.map((item) => `${item.title} (${item.status.replace(/_/g, " ")})`).join(", ")}.`,
    };
  }
  const now = Date.now();
  try {
    (await beginTransaction(async () => {
            const remaining = (await getDb()
                    .prepare("SELECT 1 FROM classes WHERE program_id = ? AND status NOT IN ('completed','cancelled') LIMIT 1")
                    .get(id));
            if (remaining) throw new Error("classes_still_open");
            const incompleteEvidence = (await getDb().prepare(
                    `SELECT c.id
           FROM classes c
          WHERE c.program_id = ? AND c.status = 'completed'
            AND (
              NOT EXISTS (SELECT 1 FROM class_sessions cs WHERE cs.class_id = c.id)
              OR EXISTS (SELECT 1 FROM class_sessions cs WHERE cs.class_id = c.id AND cs.session_date > ?)
              OR EXISTS (
                SELECT 1 FROM class_sessions cs
                 WHERE cs.class_id = c.id
                   AND NOT EXISTS (
                     SELECT 1 FROM class_session_reports csr
                      WHERE csr.session_id = cs.id AND csr.completed = 1
                   )
              )
            )
          LIMIT 1`,
                  ).get(id, now));
            if (incompleteEvidence) throw new Error("delivery_evidence_incomplete");
            const updated = (await getDb().prepare("UPDATE programs SET stage = 'completed', renewal_status = 'review_due', outcome_summary = ?, updated_at = ? WHERE id = ? AND stage = 'active'")
                    .run(summary, now, id));
            if (updated.changes !== 1) throw new Error("program_changed");
            (await logActivity("program", id, "completed", `Program completed. ${summary}`, me.id));
          }));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "classes_still_open") return { ok: false, error: "A delivery Class changed while completion was being recorded. Complete or cancel every Class and try again." };
    if (code === "delivery_evidence_incomplete") return { ok: false, error: "A completed Class is missing finalized delivery evidence. Reconcile its sessions before completing the Program." };
    if (code === "program_changed") return { ok: false, error: "The Program lifecycle changed while completion was being recorded. Refresh and try again." };
    throw error;
  }
  revalidateProgram(id);
  return { ok: true };
}

/**
 * A completed Program is immutable delivery history, so a continuation hold
 * is a disposition rather than a backwards stage transition. The dated Work
 * item prevents "on hold" from becoming an ownerless dead end.
 */
export async function holdProgramContinuation(
  id: string,
  reason: string,
  reviewDate: string,
): Promise<ActionResult> {
  const me = await requireStaff();
  const cleanReason = clean(reason, 1000);
  const cleanReviewDate = clean(reviewDate, 10);
  if (!cleanReason || cleanReason.length < 3) {
    return { ok: false, error: "Record why continuation is on hold and what must change before review." };
  }
  if (!cleanReviewDate || !/^\d{4}-\d{2}-\d{2}$/.test(cleanReviewDate)) {
    return { ok: false, error: "Choose a continuation review date." };
  }
  const reviewAt = Date.parse(`${cleanReviewDate}T12:00:00Z`);
  const now = Date.now();
  if (Number.isNaN(reviewAt) || new Date(reviewAt).toISOString().slice(0, 10) !== cleanReviewDate || reviewAt <= now) {
    return { ok: false, error: "The continuation review date must be in the future." };
  }
  if (reviewAt > now + 2 * 365 * 24 * 60 * 60 * 1000) {
    return { ok: false, error: "Review a continuation hold within two years." };
  }

  try {
    (await beginTransaction(async () => {
            const db = getDb();
            const program = (await db.prepare(
                    "SELECT name, stage, renewal_status, owner_user_id FROM programs WHERE id = ?",
                  ).get(id)) as { name: string; stage: ProgramStage; renewal_status: string; owner_user_id: string | null } | undefined;
            if (!program) throw new Error("program_missing");
            if (!["completed", "renewal_review"].includes(program.stage)) throw new Error("hold_stage_invalid");
            if (["renewed", "expanded"].includes(program.renewal_status)) throw new Error("continuation_exists");
            const updated = (await db.prepare(
                    `UPDATE programs
            SET renewal_status = 'on_hold', updated_at = ?
          WHERE id = ? AND stage = ? AND renewal_status NOT IN ('renewed','expanded')`,
                  ).run(now, id, program.stage));
            if (updated.changes !== 1) throw new Error("program_changed");

            const activeProgramOwner = program.owner_user_id
              ? (await db.prepare(
                          "SELECT id FROM users WHERE id = ? AND role IN ('admin','growth') AND status = 'active'",
                        ).get(program.owner_user_id)) as { id: string } | undefined
              : undefined;
            const workOwnerId = activeProgramOwner?.id ?? me.id;

            const title = `Review continuation hold: ${program.name}`;
            const existing = (await db.prepare(
                    `SELECT id FROM tasks
          WHERE entity_type = 'program' AND entity_id = ? AND status = 'open'
            AND kind = 'review' AND title LIKE 'Review continuation hold:%'
          ORDER BY created_at DESC LIMIT 1`,
                  ).get(id)) as { id: string } | undefined;
            if (existing) {
              (await db.prepare(
                          `UPDATE tasks
              SET title = ?, owner_user_id = ?, due_at = ?, priority = 'normal',
                  context = ?, recommended_action = ?, updated_at = ?
            WHERE id = ? AND status = 'open'`,
                        ).run(
                          title,
                          workOwnerId,
                          reviewAt,
                          cleanReason,
                          "Review the partner outcome, changed conditions, and whether to renew, expand, continue the hold, or close.",
                          now,
                          existing.id,
                        ));
            } else {
              (await db.prepare(
                          `INSERT INTO tasks
            (id, title, owner_user_id, due_at, status, kind, priority, context, recommended_action,
             entity_type, entity_id, handoff_to_founder, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'open', 'review', 'normal', ?, ?, 'program', ?, 0, ?, ?)`,
                        ).run(
                          `wrk-${randomUUID().slice(0, 10)}`,
                          title,
                          workOwnerId,
                          reviewAt,
                          cleanReason,
                          "Review the partner outcome, changed conditions, and whether to renew, expand, continue the hold, or close.",
                          id,
                          now,
                          now,
                        ));
            }
            (await logActivity(
                      "program",
                      id,
                      "continuation_hold",
                      `Continuation placed on hold until ${cleanReviewDate}. ${cleanReason}`,
                      me.id,
                    ));
          }));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "program_missing") return { ok: false, error: "Program not found." };
    if (code === "hold_stage_invalid") return { ok: false, error: "Complete delivery before placing continuation on hold." };
    if (code === "continuation_exists") return { ok: false, error: "A renewal or expansion already exists for this Program." };
    if (code === "program_changed") return { ok: false, error: "The Program changed while the hold was being recorded. Refresh and try again." };
    throw error;
  }
  revalidateProgram(id);
  return { ok: true };
}

export async function createProgramContinuation(
  id: string,
  mode: "renewal" | "expansion",
  name?: string,
  requestKey?: string,
): Promise<ActionResult & { id?: string }> {
  const me = await requireStaff();
  const source = (await getProgram(id));
  if (!source) return { ok: false, error: "Program not found." };
  const sourceAllowsContinuation =
    mode === "expansion"
      ? ["active", "completed", "renewal_review"].includes(source.program.stage)
      : ["completed", "renewal_review"].includes(source.program.stage);
  if (!sourceAllowsContinuation) {
    return {
      ok: false,
      error: mode === "expansion" ? "Expansion can begin from active or completed delivery." : "Complete the current Program before creating a renewal.",
    };
  }
  const cleanRequestKey = cleanId(requestKey);
  if (cleanRequestKey) {
    const replay = (await getDb()
          .prepare("SELECT id, source_type, source_id FROM programs WHERE request_key = ?")
          .get(cleanRequestKey)) as { id: string; source_type: string | null; source_id: string | null } | undefined;
    if (replay) {
      if (replay.source_type === mode && replay.source_id === id) return { ok: true, id: replay.id };
      return { ok: false, error: "That submission key already belongs to another Program. Refresh and try again." };
    }
  }
  const nextName = clean(name, 160) ?? `${source.program.name} — ${mode === "renewal" ? "Renewal" : "Expansion"}`;
  if (mode === "renewal") {
    const existingRenewal = (await getDb()
          .prepare("SELECT id FROM programs WHERE source_type = 'renewal' AND source_id = ? AND stage != 'closed' ORDER BY created_at DESC LIMIT 1")
          .get(id)) as { id: string } | undefined;
    if (existingRenewal) return { ok: false, error: "An open renewal already exists for this Program." };
  }
  const result = await createProgramInternal({
    requestKey: cleanRequestKey,
    name: nextName,
    partnerOrgId: source.program.partnerOrgId,
    primaryContactPersonId: source.program.primaryContactPersonId,
    locationId: mode === "renewal" ? source.program.locationId : null,
    curriculumId: source.program.curriculumId,
    audience: source.program.audience,
    deliveryFormat: source.program.deliveryFormat,
    stage: "planning",
    scheduleLabel: source.program.scheduleLabel,
    scheduleDay: source.program.scheduleDay,
    scheduleStartTime: source.program.scheduleStartTime,
    scheduleEndTime: source.program.scheduleEndTime,
    scheduleTimezone: source.program.scheduleTimezone,
    capacity: source.program.capacity,
    minimumEnrollment: source.program.minimumEnrollment,
    ownerUserId: source.program.ownerUserId ?? me.id,
    sourceType: mode,
    sourceId: id,
    parentProgramId: id,
    notes: `${mode === "renewal" ? "Renewal" : "Expansion"} created from ${source.program.name}.`,
  }, me, true);
  if (result.ok) revalidateProgram(id);
  return result;
}

export async function addProgramNote(id: string, body: string): Promise<ActionResult> {
  const me = await requireStaff();
  const note = clean(body, 4000);
  if (!note) return { ok: false, error: "Write a note before saving." };
  const row = (await getDb().prepare("SELECT id FROM programs WHERE id = ?").get(id));
  if (!row) return { ok: false, error: "Program not found." };
  (await logActivity("program", id, "note", note, me.id));
  revalidateProgram(id);
  return { ok: true };
}
