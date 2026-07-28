/* ============================================================
 * BOW Operating System — Programs, launch readiness, staffing,
 * Locations, quality, and leadership read models.
 *
 * This is a server-only DAL. Pages receive purpose-built DTOs; raw database
 * rows never cross into Client Components.
 * ============================================================ */

import "server-only";

import { getDb } from "@/lib/db";
import { classStaffingRecommendationFingerprint } from "@/lib/operational-decisions";
import { canonicalDateInZone, isValidTimeZone } from "@/lib/timezone";
import {
  derivePublicStatus,
  formatLabel,
  type DeliveryFormat,
  type Location,
  type LocationStage,
  type Program,
  type ProgramReadiness,
  type ProgramStage,
  type ProgramSummary,
  type PublicProgramStatus,
  type ReadinessItem,
  type StaffingRecommendation,
} from "@/lib/operations-shared";

export * from "@/lib/operations-shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface OperationsSnapshot {
  programs: any[];
  locations: any[];
  regions: any[];
  organizations: any[];
  organizationPeople: any[];
  organizationLocations: any[];
  people: any[];
  curricula: any[];
  users: any[];
  classes: any[];
  classInstructors: any[];
  staffingDecisions: any[];
  instructors: any[];
  qualifications: any[];
  availability: any[];
  enrollments: any[];
  students: any[];
  sessions: any[];
  sessionReports: any[];
  tasks: any[];
  feedback: any[];
  development: any[];
  activity: any[];
  inquiries: any[];
}

async function loadSnapshot(): Promise<OperationsSnapshot> {
  const db = getDb();
  return {
    programs: (await db.prepare("SELECT * FROM programs ORDER BY updated_at DESC").all()) as any[],
    locations: (await db.prepare("SELECT * FROM locations ORDER BY name").all()) as any[],
    regions: (await db.prepare("SELECT * FROM operating_regions ORDER BY name").all()) as any[],
    organizations: (await db.prepare("SELECT * FROM organizations ORDER BY name").all()) as any[],
    organizationPeople: (await db.prepare("SELECT * FROM organization_people WHERE active = 1").all()) as any[],
    organizationLocations: (await db.prepare("SELECT * FROM organization_locations WHERE active = 1").all()) as any[],
    people: (await db.prepare("SELECT * FROM people ORDER BY name").all()) as any[],
    curricula: (await db.prepare("SELECT * FROM curricula ORDER BY title").all()) as any[],
    users: (await db.prepare("SELECT id, name, role, status, deletion_requested FROM users ORDER BY name").all()) as any[],
    classes: (await db.prepare("SELECT * FROM classes ORDER BY updated_at DESC").all()) as any[],
    // Operations/readiness is a present-tense view. Historical assignment
    // intervals are queried directly by workforce and quality read models.
    classInstructors: (await db.prepare("SELECT * FROM class_instructors WHERE removed_at IS NULL").all()) as any[],
    staffingDecisions: (await db.prepare(
          `SELECT od.id, od.entity_id, od.decision, od.fingerprint, od.metadata
         FROM operational_decisions od
         JOIN class_instructors ci ON ci.decision_id = od.id
        WHERE ci.removed_at IS NULL
          AND od.entity_type = 'class'
          AND od.decision_type = 'instructor_assignment'`,
        ).all()) as any[],
    instructors: (await db.prepare("SELECT * FROM instructors ORDER BY updated_at DESC").all()) as any[],
    qualifications: (await db.prepare("SELECT * FROM instructor_qualifications").all()) as any[],
    availability: (await db.prepare("SELECT * FROM instructor_availability").all()) as any[],
    enrollments: (await db.prepare("SELECT * FROM class_enrollments").all()) as any[],
    students: (await db.prepare("SELECT * FROM students").all()) as any[],
    sessions: (await db.prepare("SELECT * FROM class_sessions ORDER BY session_date").all()) as any[],
    sessionReports: (await db.prepare("SELECT * FROM class_session_reports ORDER BY reported_at DESC").all()) as any[],
    tasks: (await db.prepare("SELECT * FROM tasks ORDER BY status, due_at").all()) as any[],
    feedback: (await db.prepare("SELECT * FROM instructor_feedback ORDER BY created_at DESC").all()) as any[],
    development: (await db.prepare("SELECT * FROM instructor_development_items ORDER BY created_at DESC").all()) as any[],
    activity: (await db.prepare("SELECT * FROM crm_activity ORDER BY created_at DESC").all()) as any[],
    // `date` is free text written in two different formats by the two public
    // form paths, so it does not sort. Order by the epoch-ms `submitted_at`
    // (016_inquiries_operations_columns.sql), keeping `date` as a tiebreaker
    // for any legacy row whose text could not be backfilled.
    inquiries: (await db
        .prepare("SELECT * FROM inquiries ORDER BY submitted_at DESC NULLS LAST, date DESC")
        .all()) as any[],
  };
}

function mapProgram(row: any): Program {
  return {
    id: row.id,
    requestKey: row.request_key ?? null,
    name: row.name,
    partnerOrgId: row.partner_org_id ?? null,
    primaryContactPersonId: row.primary_contact_person_id ?? null,
    locationId: row.location_id ?? null,
    curriculumId: row.curriculum_id ?? null,
    audience: row.audience ?? null,
    deliveryFormat: row.delivery_format as DeliveryFormat,
    stage: row.stage as ProgramStage,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    launchDate: row.launch_date ?? null,
    scheduleLabel: row.schedule_label ?? null,
    scheduleDay: typeof row.schedule_day === "number" ? row.schedule_day : null,
    scheduleStartTime: row.schedule_start_time ?? null,
    scheduleEndTime: row.schedule_end_time ?? null,
    scheduleTimezone: row.schedule_timezone ?? null,
    capacity: typeof row.capacity === "number" ? row.capacity : null,
    minimumEnrollment: Number(row.minimum_enrollment) || 1,
    ownerUserId: row.owner_user_id ?? null,
    partnerConfirmed: row.partner_confirmed === 1,
    materialsStatus: row.materials_status,
    renewalStatus: row.renewal_status,
    sourceType: row.source_type ?? null,
    sourceId: row.source_id ?? null,
    parentProgramId: row.parent_program_id ?? null,
    outcomeSummary: row.outcome_summary ?? null,
    notes: row.notes ?? null,
    launchExceptionReason: row.launch_exception_reason ?? null,
    launchExceptionApprovedBy: row.launch_exception_approved_by ?? null,
    launchExceptionApprovedAt: row.launch_exception_approved_at ?? null,
    isPublic: row.is_public === true || row.is_public === 1,
    publicStatus: (row.public_status as PublicProgramStatus | null) ?? null,
    shortDescription: row.short_description ?? null,
    longDescription: row.long_description ?? null,
    gradeRange: row.grade_range ?? null,
    imageUrl: row.image_url ?? null,
    registrationMode: (row.registration_mode as Program["registrationMode"]) ?? "immediate",
    fullCapacityBehavior: (row.full_capacity_behavior as Program["fullCapacityBehavior"]) ?? "waitlist",
    registrationDeadline: row.registration_deadline ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLocation(row: any): Location {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    region: row.region ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    address: row.address ?? null,
    timezone: row.timezone ?? null,
    parentLocationId: row.parent_location_id ?? null,
    regionId: row.region_id ?? null,
    primaryLeaderUserId: row.primary_leader_user_id ?? null,
    stage: row.stage as LocationStage,
    capacity: typeof row.capacity === "number" ? row.capacity : null,
    expectedDemand: typeof row.expected_demand === "number" ? row.expected_demand : null,
    rationale: row.rationale ?? null,
    earliestLaunchDate: row.earliest_launch_date ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function byId(rows: any[]): Map<string, any> {
  return new Map(rows.map((row) => [String(row.id), row]));
}

function storedRecommendationFingerprint(
  decisionRow: any,
  assignment: any,
  programId: string,
): string | null {
  if (
    !decisionRow
    || String(decisionRow.entity_id) !== String(assignment.class_id)
    || String(decisionRow.fingerprint) !== String(assignment.decision_fingerprint)
  ) return null;
  try {
    const decision = JSON.parse(String(decisionRow.decision)) as Record<string, unknown>;
    const metadata = JSON.parse(String(decisionRow.metadata ?? "{}")) as Record<string, unknown>;
    const fingerprint = metadata.recommendationFingerprint;
    if (
      !["assigned", "role_changed"].includes(String(decision.action))
      || String(decision.instructorId) !== String(assignment.instructor_id)
      || String(decision.role) !== String(assignment.role)
      || String(metadata.assignmentId) !== String(assignment.id)
      || String(metadata.programId ?? "") !== programId
      || typeof fingerprint !== "string"
      || !/^[0-9a-f]{64}$/.test(fingerprint)
    ) return null;
    return fingerprint;
  } catch {
    return null;
  }
}

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ");
}

function activeQualification(row: any, today: string, now: number): boolean {
  if (row.status !== "approved") return false;
  if (row.expires_on) return String(row.expires_on) >= today;
  return !row.expires_at || Number(row.expires_at) > now;
}

function qualificationMatches(rows: any[], kind: string, required: string | null): boolean {
  if (!required) return true;
  const target = normalized(required);
  const now = Date.now();
  const today = canonicalDateInZone(now);
  return rows.some((row) => {
    if (!activeQualification(row, today, now) || row.kind !== kind) return false;
    const value = normalized(row.value);
    if (["curriculum", "location", "region", "format", "role"].includes(kind)) {
      return value === target || value === "all";
    }
    // Age/audience approvals are exact named scopes. Substring matching makes
    // materially different groups collide (for example, "Grades 1" and
    // "Grades 10–12"). Broader authority must be explicit through `all` or
    // the legacy `all_ages` value until canonical audience IDs are introduced.
    return value === target || value === "all" || value === "all_ages";
  });
}

function locationCoverageMatches(snapshot: OperationsSnapshot, qualifications: any[], requiredLocation: string | null): boolean {
  if (!requiredLocation) return true;
  if (qualificationMatches(qualifications, "location", requiredLocation)) return true;
  const location = snapshot.locations.find((row) => row.id === requiredLocation);
  const regionId = location?.region_id ?? null;
  return Boolean(regionId && qualificationMatches(qualifications, "region", regionId));
}

function timeToMinutes(value: string | null): number | null {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function availabilityCoversSchedule(
  scheduleDay: number | null,
  scheduleStartTime: string | null,
  scheduleEndTime: string | null,
  rows: any[],
): boolean | null {
  if (scheduleDay == null || !scheduleStartTime || !scheduleEndTime) return null;
  const start = timeToMinutes(scheduleStartTime);
  const end = timeToMinutes(scheduleEndTime);
  if (start == null || end == null) return null;
  return rows.some((row) => {
    if (row.day_of_week !== scheduleDay) return false;
    const slotStart = timeToMinutes(row.start_time);
    const slotEnd = timeToMinutes(row.end_time);
    return slotStart != null && slotEnd != null && slotStart <= start && slotEnd >= end;
  });
}

function programRows(snapshot: OperationsSnapshot, program: Program) {
  const classes = snapshot.classes.filter((row) => row.program_id === program.id);
  const classIds = new Set(classes.map((row) => row.id));
  const classInstructors = snapshot.classInstructors.filter((row) => classIds.has(row.class_id));
  const instructorIds = new Set(classInstructors.map((row) => row.instructor_id));
  const instructors = snapshot.instructors.filter((row) => instructorIds.has(row.id));
  const activeStudentIds = new Set(
    snapshot.students.filter((row) => row.enrollment_status === "active").map((row) => row.id),
  );
  const enrollments = snapshot.enrollments.filter(
    (row) => classIds.has(row.class_id) && row.status === "enrolled" && activeStudentIds.has(row.student_id),
  );
  const studentIds = new Set(enrollments.map((row) => row.student_id));
  const students = snapshot.students.filter((row) => row.enrollment_status === "active" && studentIds.has(row.id));
  const sessions = snapshot.sessions.filter((row) => classIds.has(row.class_id));
  return { classes, classIds, classInstructors, instructorIds, instructors, enrollments, studentIds, students, sessions };
}

function readinessFor(snapshot: OperationsSnapshot, program: Program): ProgramReadiness {
  const organizationMap = byId(snapshot.organizations);
  const peopleMap = byId(snapshot.people);
  const locationMap = byId(snapshot.locations);
  const curriculumMap = byId(snapshot.curricula);
  const userMap = byId(snapshot.users);
  const staffingDecisionMap = byId(snapshot.staffingDecisions);
  const rows = programRows(snapshot, program);
  const assignedById = byId(rows.instructors);
  const owner = program.ownerUserId ? userMap.get(program.ownerUserId) : null;
  const ownerIsActiveStaff = Boolean(owner && owner.status === "active" && (owner.role === "admin" || owner.role === "growth"));
  const ownerName = ownerIsActiveStaff ? owner.name : "Operations";
  const programHref = `/app/programs/${program.id}`;
  const editHref = `${programHref}/edit`;
  const sourceFactsLocked = ["ready_to_launch", "active", "completed", "renewal_review", "renewed", "closed"].includes(program.stage);
  const sourceFactHref = sourceFactsLocked ? `${programHref}#actions` : editHref;
  const sourceFactAction = sourceFactsLocked ? "Move to Staffing to Edit" : null;
  const needsPhysicalLocation = program.deliveryFormat !== "online";
  const partner = program.partnerOrgId ? organizationMap.get(program.partnerOrgId) : null;
  const location = program.locationId ? locationMap.get(program.locationId) : null;
  const curriculum = program.curriculumId ? curriculumMap.get(program.curriculumId) : null;
  const contact = program.primaryContactPersonId ? peopleMap.get(program.primaryContactPersonId) : null;
  const contactIdentityAvailable = Boolean(
    contact
      && normalized(contact.name) !== "deleted account"
      && !String(contact.email ?? "").trim().toLowerCase().endsWith("@deleted.invalid"),
  );
  const contactRelationshipActive = Boolean(
    program.partnerOrgId
      && program.primaryContactPersonId
      && snapshot.organizationPeople.some(
        (relationship) => relationship.organization_id === program.partnerOrgId
          && relationship.person_id === program.primaryContactPersonId
          && relationship.active === 1,
      ),
  );
  const schedulePresent = Boolean(
    program.scheduleDay != null
      && program.scheduleStartTime
      && program.scheduleEndTime
      && isValidTimeZone(program.scheduleTimezone),
  );

  // A proposed assignment is an offer, not coverage. Readiness counts only
  // assignments the instructor has actually accepted — otherwise a Program
  // reads as staffed the instant a founder sends an invitation nobody
  // answered. Pending offers surface as their own readiness item below.
  const pendingAssignments = rows.classInstructors.filter((assignment) => assignment.assignment_status === "proposed");
  const leadAssignments = rows.classInstructors.filter(
    (assignment) => assignment.role === "lead" && (assignment.assignment_status ?? "accepted") === "accepted",
  );
  const staffingClearances = leadAssignments.map((assignment) => {
    const instructor = assignedById.get(assignment.instructor_id);
    const classRow = rows.classes.find((candidate) => candidate.id === assignment.class_id);
    const recommendation = instructor
      ? recommendationScore(snapshot, program, instructor, rows.classIds, assignment.class_id as string, "lead")
      : null;
    const currentFingerprint = recommendation && classRow
      ? classStaffingRecommendationFingerprint({
          programId: program.id,
          classId: assignment.class_id as string,
          instructorId: assignment.instructor_id as string,
          role: "lead",
          classStatus: String(classRow.status),
          recommendation,
        })
      : null;
    const approvedFingerprint = storedRecommendationFingerprint(
      staffingDecisionMap.get(String(assignment.decision_id)),
      assignment,
      program.id,
    );
    return {
      classId: assignment.class_id as string,
      recommendation,
      cleared:
        recommendation?.tier === "strong" ||
        (recommendation?.tier === "possible"
          && currentFingerprint != null
          && currentFingerprint === approvedFingerprint),
    };
  });

  const expectedFormat = program.deliveryFormat;
  const allowedClassStatuses =
    program.stage === "active"
      ? new Set(["active"])
      : program.stage === "completed"
        ? new Set(["completed"])
        : program.stage === "paused"
          ? new Set(["paused"])
          : program.stage === "closed"
            ? new Set(["cancelled"])
            : program.stage === "ready_to_launch"
              ? new Set(["ready_to_launch"])
              : program.stage === "staffing"
                ? new Set(["staffing"])
                : new Set(["planning", "staffing"]);
  const misalignedClasses = rows.classes.filter((row) => {
    const storedFormat = normalized(row.online_format).includes("hybrid")
      ? "hybrid"
      : normalized(row.online_format).includes("online")
        ? "online"
        : "in_person";
    return (
      row.partner_org_id !== program.partnerOrgId ||
      row.curriculum_id !== program.curriculumId ||
      (needsPhysicalLocation && row.location_id !== program.locationId) ||
      storedFormat !== expectedFormat ||
      row.start_date !== program.startDate ||
      row.end_date !== program.endDate ||
      (row.recurrence ?? null) !== program.scheduleLabel ||
      (row.schedule_timezone ?? null) !== program.scheduleTimezone ||
      (row.age_range ?? null) !== program.audience ||
      (row.capacity ?? null) !== program.capacity ||
      (Number(row.minimum_enrollment) || 1) !== program.minimumEnrollment ||
      !allowedClassStatuses.has(row.status)
    );
  });

  const incompleteForms = rows.students.filter((student) => student.form_status !== "complete");
  const readinessNow = Date.now();
  const readinessTimeZone = isValidTimeZone(program.scheduleTimezone) ? program.scheduleTimezone : undefined;
  const today = canonicalDateInZone(readinessNow, readinessTimeZone);
  const firstSessionDateFloor = program.launchDate && program.launchDate > today ? program.launchDate : today;
  const eligibleLeadClassIds = new Set(
    leadAssignments
      .filter((assignment) => {
        const instructor = assignedById.get(assignment.instructor_id);
        return instructor?.eligibility_status === "eligible" && instructor.stage === "active";
      })
      .map((assignment) => assignment.class_id as string),
  );
  const portalReadyLeadClassIds = new Set(
    leadAssignments
      .filter((assignment) => {
        const instructor = assignedById.get(assignment.instructor_id);
        const person = instructor ? peopleMap.get(instructor.person_id) : null;
        const user = person?.user_id ? userMap.get(person.user_id) : null;
        return user?.role === "instructor" && user.status === "active" && user.deletion_requested !== 1;
      })
      .map((assignment) => assignment.class_id as string),
  );
  const clearedClassIds = new Set(staffingClearances.filter((clearance) => clearance.cleared).map((clearance) => clearance.classId));
  const firstSessionClassIds = new Set(
    rows.sessions
      .filter((session) =>
        Number(session.session_date) >= readinessNow
        && canonicalDateInZone(Number(session.session_date), session.timezone ?? readinessTimeZone) >= firstSessionDateFloor,
      )
      .map((session) => session.class_id as string),
  );
  const enrollmentCountByClass = new Map<string, number>();
  for (const enrollment of rows.enrollments) {
    enrollmentCountByClass.set(enrollment.class_id, (enrollmentCountByClass.get(enrollment.class_id) ?? 0) + 1);
  }
  const classesMissingEligibleLead = rows.classes.filter((row) => !eligibleLeadClassIds.has(row.id));
  const classesMissingPortalAccess = rows.classes.filter((row) => !portalReadyLeadClassIds.has(row.id));
  const classesMissingClearance = rows.classes.filter((row) => !clearedClassIds.has(row.id));
  const classesMissingFirstSession = rows.classes.filter((row) => !firstSessionClassIds.has(row.id));
  const underEnrolledClasses = rows.classes.filter(
    (row) => (enrollmentCountByClass.get(row.id) ?? 0) < (Number(row.minimum_enrollment) || program.minimumEnrollment),
  );
  const overCapacityClasses = rows.classes.filter(
    (row) => row.capacity && (enrollmentCountByClass.get(row.id) ?? 0) > Number(row.capacity),
  );

  const items: ReadinessItem[] = [
    {
      key: "partner",
      label: "Partner organization",
      state: partner?.status === "active" ? "complete" : "blocked",
      detail: partner?.status === "active" ? partner.name : partner ? `${partner.name} is not operationally active.` : "No operating partner is linked.",
      owner: ownerName,
      actionLabel: sourceFactAction ?? "Select Partner",
      actionHref: sourceFactHref,
    },
    {
      key: "partner_confirmation",
      label: "Partner confirmation",
      state: program.partnerConfirmed ? "complete" : "blocked",
      detail: program.partnerConfirmed ? "The partner has confirmed the launch plan." : "Leadership has not recorded partner confirmation.",
      owner: ownerName,
      actionLabel: "Record Confirmation",
      actionHref: `${programHref}#actions`,
    },
    {
      key: "contact",
      label: "Primary contact",
      state: program.primaryContactPersonId && contactIdentityAvailable && contactRelationshipActive ? "complete" : "blocked",
      detail: !program.primaryContactPersonId
        ? "No accountable partner contact is linked."
        : !contact
          ? "The linked contact record is missing."
          : !contactIdentityAvailable
            ? "The linked contact is no longer available. Assign a current partner contact."
          : contactRelationshipActive
            ? `${contact.name ?? "Contact"} is connected to the partner.`
            : "The linked Person is no longer an active contact for this partner.",
      owner: ownerName,
      actionLabel: sourceFactAction ?? "Select Contact",
      actionHref: sourceFactHref,
    },
    {
      key: "owner",
      label: "Accountable BOW owner",
      state: ownerIsActiveStaff ? "complete" : "blocked",
      detail: ownerIsActiveStaff ? `${owner.name} owns the operating plan.` : "No active BOW staff owner is accountable for the Program.",
      owner: "Operations",
      actionLabel: sourceFactAction ?? "Assign Owner",
      actionHref: sourceFactHref,
    },
    {
      key: "location",
      label: "Delivery location",
      state: !needsPhysicalLocation ? "not_applicable" : location?.stage === "active" ? "complete" : "blocked",
      detail: !needsPhysicalLocation
        ? "Online delivery does not require a physical site."
        : location?.stage === "active"
          ? `${location.name} is active.`
          : location
            ? `${location.name} is ${location.stage.replace(/_/g, " ")}, not active.`
            : "In-person delivery has no Location.",
      owner: ownerName,
      actionLabel: needsPhysicalLocation ? sourceFactAction ?? "Select Location" : null,
      actionHref: needsPhysicalLocation ? sourceFactHref : null,
    },
    {
      key: "schedule",
      label: "Schedule and launch date",
      state: schedulePresent && program.launchDate ? "complete" : "blocked",
      detail:
        schedulePresent && program.launchDate
          ? `${program.scheduleLabel ?? "Structured weekly schedule"} · ${program.scheduleTimezone} · launches ${program.launchDate}`
          : "A launch date plus structured weekday, start time, end time, and delivery timezone are required.",
      owner: ownerName,
      actionLabel: sourceFactAction ?? "Complete Schedule",
      actionHref: sourceFactHref,
    },
    {
      key: "curriculum",
      label: "Curriculum",
      state: curriculum?.published === 1 ? "complete" : "blocked",
      detail: curriculum?.published === 1 ? curriculum.title : curriculum ? `${curriculum.title} is not published.` : "No Curriculum is selected.",
      owner: "Program lead",
      actionLabel: sourceFactAction ?? "Select Curriculum",
      actionHref: sourceFactHref,
    },
    {
      key: "class",
      label: "Delivery class",
      state: rows.classes.length > 0 ? "complete" : "blocked",
      detail: rows.classes.length > 0 ? `${rows.classes.length} delivery class${rows.classes.length === 1 ? "" : "es"} linked.` : "No Class exists for roster, sessions, and delivery.",
      owner: "Operations",
      actionLabel: "Create Class",
      actionHref: `${programHref}#actions`,
    },
    {
      key: "class_alignment",
      label: "Class plan alignment",
      state: rows.classes.length > 0 && misalignedClasses.length === 0 ? "complete" : "blocked",
      detail:
        rows.classes.length === 0
          ? "Create a delivery Class before alignment can be checked."
          : misalignedClasses.length === 0
            ? "Every Class matches the Program plan and lifecycle."
            : `${misalignedClasses.length} Class${misalignedClasses.length === 1 ? " is" : "es are"} out of alignment with the Program plan.`,
      owner: "Operations",
      actionLabel: "Review Classes",
      actionHref: `${programHref}#classes`,
    },
    {
      key: "eligible_instructor",
      label: "Eligible lead instructor",
      state: rows.classes.length > 0 && classesMissingEligibleLead.length === 0 ? "complete" : "blocked",
      detail:
        rows.classes.length > 0 && classesMissingEligibleLead.length === 0
          ? `Every delivery Class has an eligible lead instructor.`
          : `${classesMissingEligibleLead.length || rows.classes.length} Class${(classesMissingEligibleLead.length || rows.classes.length) === 1 ? " is" : "es are"} missing an eligible lead.`,
      owner: "Instructor manager",
      actionLabel: "Review Staffing",
      actionHref: `${programHref}#staffing`,
    },
    {
      key: "assignment_response",
      label: "Assignments accepted",
      state: pendingAssignments.length === 0 ? "complete" : "warning",
      detail:
        pendingAssignments.length === 0
          ? "Every instructor on this Program has accepted their assignment."
          : `${pendingAssignments.length} assignment${pendingAssignments.length === 1 ? " is" : "s are"} still awaiting an instructor response.`,
      owner: "Instructor manager",
      actionLabel: "Review Staffing",
      actionHref: `${programHref}#staffing`,
    },
    {
      key: "instructor_access",
      label: "Instructor delivery access",
      state: rows.classes.length > 0 && classesMissingPortalAccess.length === 0 ? "complete" : "blocked",
      detail:
        rows.classes.length > 0 && classesMissingPortalAccess.length === 0
          ? "Every Class lead has an active instructor portal account."
          : `${classesMissingPortalAccess.length || rows.classes.length} Class${(classesMissingPortalAccess.length || rows.classes.length) === 1 ? " has" : "es have"} no active lead-instructor account for delivery.`,
      owner: "Instructor manager",
      actionLabel: "Resolve Instructor Access",
      actionHref: "/app/instructors",
    },
    {
      key: "staffing_clearance",
      label: "Staffing clearance",
      state: rows.classes.length > 0 && classesMissingClearance.length === 0 ? "complete" : "blocked",
      detail:
        rows.classes.length > 0 && classesMissingClearance.length === 0
          ? "Every Class lead is fully matched or covered by a documented staffing decision."
          : `${classesMissingClearance.length || rows.classes.length} Class${(classesMissingClearance.length || rows.classes.length) === 1 ? " needs" : "es need"} a qualified lead or documented decision.`,
      owner: "Instructor manager",
      actionLabel: "Resolve Staffing",
      actionHref: `${programHref}#staffing`,
    },
    {
      key: "enrollment",
      label: "Minimum enrollment by Class",
      state: rows.classes.length > 0 && underEnrolledClasses.length === 0 ? "complete" : "blocked",
      detail:
        rows.classes.length > 0 && underEnrolledClasses.length === 0
          ? `Every Class meets its minimum enrollment; ${rows.studentIds.size} unique students are enrolled.`
          : `${underEnrolledClasses.length || rows.classes.length} Class${(underEnrolledClasses.length || rows.classes.length) === 1 ? " is" : "es are"} below minimum enrollment.`,
      owner: "Program lead",
      actionLabel: "Review Enrollment",
      actionHref: `${programHref}#students`,
    },
    {
      key: "forms",
      label: "Required student forms",
      state: rows.studentIds.size === 0 ? "warning" : incompleteForms.length === 0 ? "complete" : "blocked",
      detail:
        rows.studentIds.size === 0
          ? "Forms can be evaluated after enrollment begins."
          : incompleteForms.length === 0
            ? "Every enrolled student has complete forms."
            : `${incompleteForms.length} enrolled student${incompleteForms.length === 1 ? " has" : "s have"} incomplete forms.`,
      owner: "Program lead",
      actionLabel: "Resolve Forms",
      actionHref: `${programHref}#students`,
    },
    {
      key: "materials",
      label: "Materials readiness",
      state: program.materialsStatus === "ready" ? "complete" : "blocked",
      detail:
        program.materialsStatus === "ready"
          ? "Materials are ready for the first session."
          : program.materialsStatus === "ordered"
            ? "Materials are in progress but cannot yet clear launch readiness."
            : "Materials readiness has not been confirmed.",
      owner: "Program lead",
      actionLabel: "Update Materials",
      actionHref: `${programHref}#actions`,
    },
    {
      key: "first_session",
      label: "First-session plan",
      state: rows.classes.length > 0 && classesMissingFirstSession.length === 0 ? "complete" : "blocked",
      detail:
        rows.classes.length > 0 && classesMissingFirstSession.length === 0
          ? "Every Class has an upcoming first session scheduled on or after launch."
          : `${classesMissingFirstSession.length || rows.classes.length} Class${(classesMissingFirstSession.length || rows.classes.length) === 1 ? " is" : "es are"} missing an upcoming first session.`,
      owner: "Program lead",
      actionLabel: "Schedule Session",
      actionHref: rows.classes[0] ? `/app/classes/${rows.classes[0].id}` : `${programHref}#classes`,
    },
  ];

  if (overCapacityClasses.length > 0) {
    items.push({
      key: "capacity",
      label: "Capacity",
      state: "blocked",
      detail: `${overCapacityClasses.length} Class${overCapacityClasses.length === 1 ? " is" : "es are"} above capacity.`,
      owner: ownerName,
      actionLabel: "Review Capacity",
      actionHref: `${programHref}#students`,
    });
  }

  const applicable = items.filter((item) => item.state !== "not_applicable");
  const completedCount = applicable.filter((item) => item.state === "complete").length;
  const blockers = items.filter((item) => item.state === "blocked");
  const warnings = items.filter((item) => item.state === "warning");
  const percent = applicable.length === 0 ? 100 : Math.round((completedCount / applicable.length) * 100);
  const next = blockers[0] ?? warnings[0] ?? null;
  return {
    percent,
    status: blockers.length > 0 ? "at_risk" : warnings.length > 0 ? "in_progress" : "ready",
    completedCount,
    totalCount: applicable.length,
    blockers,
    warnings,
    items,
    primaryBlocker: blockers[0]?.detail ?? null,
    nextAction: next?.actionLabel && next.actionHref ? { label: next.actionLabel, href: next.actionHref, owner: next.owner } : null,
    canLaunch: blockers.length === 0,
  };
}

function summaryFor(snapshot: OperationsSnapshot, program: Program): ProgramSummary {
  const rows = programRows(snapshot, program);
  return {
    program,
    partnerName: program.partnerOrgId ? byId(snapshot.organizations).get(program.partnerOrgId)?.name ?? null : null,
    locationName: program.locationId ? byId(snapshot.locations).get(program.locationId)?.name ?? null : null,
    curriculumTitle: program.curriculumId ? byId(snapshot.curricula).get(program.curriculumId)?.title ?? null : null,
    ownerName: program.ownerUserId ? byId(snapshot.users).get(program.ownerUserId)?.name ?? null : null,
    classCount: rows.classes.length,
    instructorCount: rows.instructorIds.size,
    enrollmentCount: rows.studentIds.size,
    readiness: readinessFor(snapshot, program),
  };
}

export async function listPrograms(): Promise<ProgramSummary[]> {
  const snapshot = (await loadSnapshot());
  return snapshot.programs
    .map(mapProgram)
    .map((program) => summaryFor(snapshot, program))
    .sort((a, b) => {
      const risk = Number(b.readiness.blockers.length > 0) - Number(a.readiness.blockers.length > 0);
      if (risk !== 0) return risk;
      const aDate = a.program.launchDate ? Date.parse(a.program.launchDate) : Number.MAX_SAFE_INTEGER;
      const bDate = b.program.launchDate ? Date.parse(b.program.launchDate) : Number.MAX_SAFE_INTEGER;
      return aDate - bDate;
    });
}

/* ===================================================================== */
/* Public programs — the website's "what can I join?" surface.           */
/* No partner/staffing/readiness data crosses into these DTOs.           */
/* ===================================================================== */

export interface PublicProgramCard {
  id: string;
  name: string;
  shortDescription: string | null;
  gradeRange: string | null;
  deliveryFormat: DeliveryFormat;
  imageUrl: string | null;
  status: PublicProgramStatus;
  nextSessionDate: string | null;
  startDate: string | null;
  endDate: string | null;
  capacity: number | null;
  registeredCount: number;
  registrationDeadline: string | null;
  registrationMode: Program["registrationMode"];
  fullCapacityBehavior: Program["fullCapacityBehavior"];
  primaryClassId: string | null;
  curriculumTitle: string | null;
}

export interface PublicProgramDetail extends PublicProgramCard {
  longDescription: string | null;
}

async function publicProgramRows(): Promise<any[]> {
  const db = getDb();
  return (await db.prepare(
        `SELECT
        p.*,
        (SELECT c.id FROM classes c
          WHERE c.program_id = p.id AND c.status NOT IN ('completed', 'cancelled')
          ORDER BY c.created_at LIMIT 1) AS primary_class_id,
        (SELECT MIN(cs.session_date) FROM class_sessions cs
          JOIN classes c ON c.id = cs.class_id
          WHERE c.program_id = p.id AND cs.session_date >= ?) AS next_session_date,
        (SELECT COUNT(*) FROM class_enrollments ce
          JOIN students s ON s.id = ce.student_id
          WHERE ce.class_id = (SELECT c.id FROM classes c
                                 WHERE c.program_id = p.id AND c.status NOT IN ('completed', 'cancelled')
                                 ORDER BY c.created_at LIMIT 1)
            AND ce.status = 'enrolled' AND s.enrollment_status = 'active') AS registered_count,
        (SELECT cur.title FROM curricula cur WHERE cur.id = p.curriculum_id) AS curriculum_title
      FROM programs p
      WHERE p.is_public = true
      ORDER BY next_session_date ASC NULLS LAST, p.updated_at DESC`,
      ).all(Date.now())) as any[];
}

function toPublicCard(row: any): PublicProgramCard {
  const program = mapProgram(row);
  const registeredCount = Number(row.registered_count) || 0;
  const status = derivePublicStatus(program, registeredCount);
  return {
    id: program.id,
    name: program.name,
    shortDescription: program.shortDescription,
    gradeRange: program.gradeRange,
    deliveryFormat: program.deliveryFormat,
    imageUrl: program.imageUrl,
    status: status ?? "closed",
    nextSessionDate: row.next_session_date
      ? new Date(Number(row.next_session_date)).toISOString().slice(0, 10)
      : null,
    startDate: program.startDate,
    endDate: program.endDate,
    capacity: program.capacity,
    registeredCount,
    registrationDeadline: program.registrationDeadline,
    registrationMode: program.registrationMode,
    fullCapacityBehavior: program.fullCapacityBehavior,
    primaryClassId: row.primary_class_id ?? null,
    curriculumTitle: row.curriculum_title ?? null,
  };
}

/**
 * Upcoming/open/coming-soon public Programs, for the public /programs page
 * and homepage. Completed Programs are excluded from the primary list —
 * archive treatment is a later concern.
 */
export async function listPublicPrograms(): Promise<PublicProgramCard[]> {
  const rows = (await publicProgramRows());
  return rows.map(toPublicCard).filter((card) => card.status !== "closed");
}

export interface ProgramRegistrationRow {
  id: string;
  studentId: string;
  studentName: string;
  classId: string | null;
  guardianName: string | null;
  guardianEmail: string | null;
  status: "confirmed" | "pending" | "waitlisted" | "declined";
  referralSource: string | null;
  createdAt: number;
}

/**
 * Registrations not yet reflected in the canonical Roster (pending approval,
 * or waitlisted while a Program is full). Confirmed registrations already
 * show up automatically via the Program's Students/Roster read model.
 */
export async function listPendingProgramRegistrations(programId: string): Promise<ProgramRegistrationRow[]> {
  const db = getDb();
  const rows = (await db.prepare(
        `SELECT pr.id, pr.student_id, pr.class_id, pr.status, pr.referral_source, pr.created_at,
              s.name AS student_name, p.name AS guardian_name, p.email AS guardian_email
       FROM program_registrations pr
       JOIN students s ON s.id = pr.student_id
       LEFT JOIN people p ON p.id = pr.guardian_person_id
      WHERE pr.program_id = ? AND pr.status IN ('pending', 'waitlisted')
      ORDER BY pr.created_at DESC`,
      ).all(programId)) as any[];
  return rows.map((row) => ({
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    classId: row.class_id,
    guardianName: row.guardian_name ?? null,
    guardianEmail: row.guardian_email ?? null,
    status: row.status,
    referralSource: row.referral_source ?? null,
    createdAt: Number(row.created_at),
  }));
}

export async function getPublicProgram(id: string): Promise<PublicProgramDetail | null> {
  const db = getDb();
  const row = (await db.prepare(
        `SELECT
        p.*,
        (SELECT c.id FROM classes c
          WHERE c.program_id = p.id AND c.status NOT IN ('completed', 'cancelled')
          ORDER BY c.created_at LIMIT 1) AS primary_class_id,
        (SELECT MIN(cs.session_date) FROM class_sessions cs
          JOIN classes c ON c.id = cs.class_id
          WHERE c.program_id = p.id AND cs.session_date >= ?) AS next_session_date,
        (SELECT COUNT(*) FROM class_enrollments ce
          JOIN students s ON s.id = ce.student_id
          WHERE ce.class_id = (SELECT c.id FROM classes c
                                 WHERE c.program_id = p.id AND c.status NOT IN ('completed', 'cancelled')
                                 ORDER BY c.created_at LIMIT 1)
            AND ce.status = 'enrolled' AND s.enrollment_status = 'active') AS registered_count,
        (SELECT cur.title FROM curricula cur WHERE cur.id = p.curriculum_id) AS curriculum_title
      FROM programs p
      WHERE p.id = ? AND p.is_public = true`,
      ).get(Date.now(), id)) as any | undefined;
  if (!row) return null;
  const card = toPublicCard(row);
  return { ...card, longDescription: row.long_description ?? null };
}

function recommendationScore(
  snapshot: OperationsSnapshot,
  program: Program,
  instructor: any,
  programClassIds: Set<string>,
  targetClassId: string | null = null,
  role: "lead" | "additional" = "lead",
): Omit<StaffingRecommendation, "rank"> & { score: number } {
  const people = byId(snapshot.people);
  const person = people.get(instructor.person_id);
  const targetClass = targetClassId ? snapshot.classes.find((row) => row.id === targetClassId) : null;
  const requiredCurriculum = targetClass?.curriculum_id ?? program.curriculumId;
  const requiredAudience = targetClass?.age_range ?? program.audience;
  const requiredFormat: DeliveryFormat = targetClass
    ? normalized(targetClass.online_format).includes("hybrid")
      ? "hybrid"
      : normalized(targetClass.online_format).includes("online")
        ? "online"
        : "in_person"
    : program.deliveryFormat;
  const requiredLocation = targetClass?.location_id ?? program.locationId;
  const scheduleDay = typeof targetClass?.schedule_day === "number" ? targetClass.schedule_day : program.scheduleDay;
  const scheduleStartTime = targetClass?.schedule_start_time ?? program.scheduleStartTime;
  const scheduleEndTime = targetClass?.schedule_end_time ?? program.scheduleEndTime;
  const qualifications = snapshot.qualifications.filter((row) => row.instructor_id === instructor.id);
  const availability = snapshot.availability.filter((row) => row.instructor_id === instructor.id);
  const assignments = snapshot.classInstructors.filter((row) => row.instructor_id === instructor.id);
  const assignedClassIds = new Set(assignments.map((row) => row.class_id));
  const alreadyAssigned = targetClassId
    ? assignments.some((row) => row.class_id === targetClassId)
    : assignments.some((row) => programClassIds.has(row.class_id));
  const activeClasses = snapshot.classes.filter(
    (row) => assignedClassIds.has(row.id) && ["staffing", "ready_to_launch", "active"].includes(row.status),
  );
  const relevantClasses = snapshot.classes.filter(
    (row) => assignedClassIds.has(row.id) && row.curriculum_id === requiredCurriculum && ["active", "completed"].includes(row.status),
  );
  const recentCutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
  const reliabilityFeedback = snapshot.feedback.filter(
    (row) => row.instructor_id === instructor.id && row.created_at >= recentCutoff && row.organization_reliability != null,
  );
  const lowReliability = reliabilityFeedback.filter((row) => Number(row.organization_reliability) <= 2).length;
  const openDevelopment = snapshot.development.filter(
    (row) => row.instructor_id === instructor.id && row.status === "open" && row.kind !== "recognition",
  );

  const matches: string[] = [];
  const missing: string[] = [];
  const conflicts: string[] = [];
  let score = 0;

  if (instructor.eligibility_status === "eligible" && ["eligible", "active"].includes(instructor.stage)) {
    matches.push("Eligible to teach");
    score += 40;
  } else {
    missing.push("Instructor eligibility");
  }

  if (qualificationMatches(qualifications, "curriculum", requiredCurriculum)) {
    matches.push("Curriculum approved");
    score += 18;
  } else {
    missing.push("Required Curriculum approval");
  }

  if (qualificationMatches(qualifications, "age_group", requiredAudience)) {
    matches.push("Audience fit");
    score += 9;
  } else {
    missing.push("Audience or age-group approval");
  }

  if (qualificationMatches(qualifications, "format", requiredFormat)) {
    matches.push("Delivery format approved");
    score += 9;
  } else {
    missing.push(`${formatLabel(requiredFormat)} approval`);
  }

  const requiredRole = role === "lead" ? "lead" : "assistant";
  if (qualificationMatches(qualifications, "role", requiredRole)) {
    matches.push(role === "lead" ? "Lead-instructor approved" : "Assistant-instructor approved");
    score += 7;
  } else {
    missing.push(role === "lead" ? "Lead-instructor approval" : "Assistant-instructor approval");
  }

  const scheduleFit = availabilityCoversSchedule(scheduleDay, scheduleStartTime, scheduleEndTime, availability);
  if (scheduleFit === true) {
    matches.push("Weekly availability matches");
    score += 8;
  } else if (scheduleFit === false) {
    conflicts.push("Weekly availability conflicts with the Program schedule");
  } else {
    conflicts.push("Program schedule or instructor availability is not specific enough to verify");
    score += 2;
  }

  if (requiredFormat === "online") {
    matches.push("No geographic constraint for online delivery");
    score += 4;
  } else if (locationCoverageMatches(snapshot, qualifications, requiredLocation)) {
    matches.push("Location or Region approved");
    score += 4;
  } else {
    conflicts.push("Location coverage is not confirmed");
  }

  const maxWorkload = Number(instructor.max_weekly_classes) || 3;
  const workloadFits = alreadyAssigned ? activeClasses.length <= maxWorkload : activeClasses.length < maxWorkload;
  if (workloadFits) {
    const remaining = Math.max(0, maxWorkload - activeClasses.length);
    matches.push(
      remaining === 0
        ? "At workload capacity including this Program"
        : `${remaining} workload slot${remaining === 1 ? "" : "s"} available`,
    );
    score += 3;
  } else {
    conflicts.push(`At workload limit (${activeClasses.length}/${maxWorkload})`);
  }

  if (relevantClasses.length > 0) {
    matches.push(`${relevantClasses.length} relevant prior class${relevantClasses.length === 1 ? "" : "es"}`);
    score += Math.min(5, relevantClasses.length * 2);
  }

  if (lowReliability > 0 || openDevelopment.length > 0) {
    conflicts.push(
      `${lowReliability + openDevelopment.length} recent reliability or development signal${lowReliability + openDevelopment.length === 1 ? "" : "s"}`,
    );
  } else {
    matches.push("No open reliability concern");
    score += 2;
  }

  if (alreadyAssigned) matches.push(targetClassId ? "Already assigned to this Class" : "Already assigned to this Program");

  const coreMissing = missing.some((item) =>
    ["Instructor eligibility", "Required Curriculum approval", "Lead-instructor approval", "Assistant-instructor approval"].includes(item),
  );
  const tier: StaffingRecommendation["tier"] = coreMissing ? "blocked" : missing.length > 0 || conflicts.length > 0 ? "possible" : "strong";

  return {
    instructorId: instructor.id,
    name: person?.name ?? "Instructor",
    progressionLevel: instructor.progression_level ?? "instructor",
    tier,
    matches,
    missing,
    conflicts,
    workload: activeClasses.length,
    maxWorkload,
    priorRelevantClasses: relevantClasses.length,
    reliabilityNote:
      lowReliability > 0 || openDevelopment.length > 0
        ? "Recent evidence requires leadership review before assignment."
        : reliabilityFeedback.length > 0
          ? "Recent reliability evidence is clear."
          : "No recent feedback volume; verify with the instructor manager.",
    isAlreadyAssigned: alreadyAssigned,
    score,
  };
}

function staffingFor(
  snapshot: OperationsSnapshot,
  program: Program,
  targetClassId: string | null = null,
  role: "lead" | "additional" = "lead",
): StaffingRecommendation[] {
  const classIds = new Set(snapshot.classes.filter((row) => row.program_id === program.id).map((row) => row.id));
  return snapshot.instructors
    .filter((row) => !["rejected", "inactive"].includes(row.stage))
    .map((row) => recommendationScore(snapshot, program, row, classIds, targetClassId, role))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((recommendation, index) => ({ ...recommendation, rank: index + 1 }));
}

export interface ProgramDetail extends ProgramSummary {
  partner: { id: string; name: string; type: string; location: string } | null;
  primaryContact: { id: string; name: string; email: string; phone: string } | null;
  location: Location | null;
  curriculum: { id: string; title: string; ageRange: string | null } | null;
  classes: { id: string; title: string; status: string; startDate: string | null; location: string | null; scheduleTimezone: string | null }[];
  instructors: { id: string; name: string; role: string; eligibility: string; classId: string }[];
  students: { id: string; name: string; formStatus: string; classId: string }[];
  sessions: { id: string; classId: string; classTitle: string; sessionDate: number; location: string | null; scheduleTimezone: string | null }[];
  tasks: {
    id: string;
    title: string;
    kind: string;
    priority: string;
    ownerName: string | null;
    dueAt: number | null;
    dueOn: string | null;
    context: string | null;
    recommendedAction: string | null;
  }[];
  activity: { id: string; kind: string; body: string | null; actorName: string | null; createdAt: number }[];
  originatingInquiry: {
    id: string;
    name: string;
    email: string;
    type: string;
    organizationName: string;
    submittedLabel: string;
    status: string;
    summary: string;
  } | null;
  connectedHistory: {
    id: string;
    kind: string;
    body: string;
    actorName: string | null;
    createdAt: number;
    scopeLabel: string;
    href: string | null;
  }[];
  recommendations: StaffingRecommendation[];
  staffingByClass: {
    classId: string;
    leadRecommendations: StaffingRecommendation[];
    additionalRecommendations: StaffingRecommendation[];
  }[];
  relatedPrograms: { id: string; name: string; stage: ProgramStage; relationship: "parent" | "renewal_or_expansion" }[];
}

export async function getProgram(id: string): Promise<ProgramDetail | null> {
  const snapshot = (await loadSnapshot());
  const row = snapshot.programs.find((candidate) => candidate.id === id);
  if (!row) return null;
  const program = mapProgram(row);
  const summary = summaryFor(snapshot, program);
  const related = programRows(snapshot, program);
  const organizations = byId(snapshot.organizations);
  const people = byId(snapshot.people);
  const locations = byId(snapshot.locations);
  const curricula = byId(snapshot.curricula);
  const users = byId(snapshot.users);
  const classes = byId(snapshot.classes);
  const instructors = byId(snapshot.instructors);
  const students = byId(snapshot.students);
  const personNameForInstructor = (instructorId: string) => {
    const instructor = instructors.get(instructorId);
    return instructor ? people.get(instructor.person_id)?.name ?? "Instructor" : "Instructor";
  };

  const partnerRow = program.partnerOrgId ? organizations.get(program.partnerOrgId) : null;
  const contactRow = program.primaryContactPersonId ? people.get(program.primaryContactPersonId) : null;
  const locationRow = program.locationId ? locations.get(program.locationId) : null;
  const curriculumRow = program.curriculumId ? curricula.get(program.curriculumId) : null;
  const classTitle = (classId: string) => classes.get(classId)?.title ?? "Class";

  const tasks = snapshot.tasks
    .filter((task) => task.entity_type === "program" && task.entity_id === id && task.status === "open")
    .map((task) => ({
      id: task.id,
      title: task.title,
      kind: task.kind ?? "task",
      priority: task.priority ?? "normal",
      ownerName: task.owner_user_id ? users.get(task.owner_user_id)?.name ?? null : null,
      dueAt: task.due_at ?? null,
      dueOn: task.due_on ?? null,
      context: task.context ?? null,
      recommendedAction: task.recommended_action ?? null,
    }));
  const activity = snapshot.activity
    .filter((item) => item.entity_type === "program" && item.entity_id === id)
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      body: item.body ?? null,
      actorName: item.actor_user_id ? users.get(item.actor_user_id)?.name ?? null : null,
      createdAt: item.created_at,
    }));
  const relatedPrograms = snapshot.programs
    .map(mapProgram)
    .filter((candidate) => candidate.id === program.parentProgramId || candidate.parentProgramId === program.id)
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      stage: candidate.stage,
      relationship: candidate.id === program.parentProgramId ? ("parent" as const) : ("renewal_or_expansion" as const),
    }));
  const sourceInquiryRow = program.sourceType === "inquiry" && program.sourceId
    ? snapshot.inquiries.find((candidate) => candidate.id === program.sourceId) ?? null
    : null;
  const originatingInquiry = sourceInquiryRow
    ? {
        id: sourceInquiryRow.id as string,
        name: sourceInquiryRow.name as string,
        email: sourceInquiryRow.email as string,
        type: sourceInquiryRow.type as string,
        organizationName: sourceInquiryRow.org_name as string,
        submittedLabel: sourceInquiryRow.date as string,
        status: sourceInquiryRow.status as string,
        summary: sourceInquiryRow.summary as string,
      }
    : null;

  const historyScopes = new Map<string, { scopeLabel: string; href: string | null }>();
  historyScopes.set(`program:${id}`, { scopeLabel: "Program", href: `/app/programs/${id}` });
  if (originatingInquiry) {
    historyScopes.set(`inquiry:${originatingInquiry.id}`, {
      scopeLabel: "Originating inquiry",
      href: program.partnerOrgId ? `/app/partners/${program.partnerOrgId}#inquiry-${originatingInquiry.id}` : null,
    });
  }
  for (const classRow of related.classes) {
    historyScopes.set(`class:${classRow.id}`, {
      scopeLabel: `Class · ${classRow.title}`,
      href: `/app/classes/${classRow.id}`,
    });
  }
  for (const relatedProgram of relatedPrograms) {
    historyScopes.set(`program:${relatedProgram.id}`, {
      scopeLabel: relatedProgram.relationship === "parent" ? "Prior Program" : "Continuation Program",
      href: `/app/programs/${relatedProgram.id}`,
    });
  }

  const connectedHistory = snapshot.activity
    .flatMap((item) => {
      const scope = historyScopes.get(`${item.entity_type}:${item.entity_id}`);
      return scope
        ? [{
            id: item.id as string,
            kind: item.kind as string,
            body: (item.body as string | null) ?? "Activity recorded.",
            actorName: item.actor_user_id ? (users.get(item.actor_user_id)?.name as string | undefined) ?? null : null,
            createdAt: Number(item.created_at),
            scopeLabel: scope.scopeLabel,
            href: scope.href,
          }]
        : [];
    });
  if (program.outcomeSummary && !connectedHistory.some((item) => item.body === program.outcomeSummary)) {
    connectedHistory.push({
      id: `outcome-${program.id}`,
      kind: "outcome",
      body: program.outcomeSummary,
      actorName: null,
      createdAt: program.updatedAt,
      scopeLabel: "Program outcome",
      href: `/app/programs/${program.id}`,
    });
  }
  if (originatingInquiry) {
    const parsedSubmittedAt = Date.parse(originatingInquiry.submittedLabel);
    connectedHistory.push({
      id: `source-${originatingInquiry.id}`,
      kind: "intake",
      body: `${originatingInquiry.type} inquiry received from ${originatingInquiry.name} at ${originatingInquiry.organizationName}. ${originatingInquiry.summary}`,
      actorName: null,
      createdAt: Number.isNaN(parsedSubmittedAt) ? program.createdAt : parsedSubmittedAt,
      scopeLabel: "Originating inquiry",
      href: program.partnerOrgId ? `/app/partners/${program.partnerOrgId}#inquiry-${originatingInquiry.id}` : null,
    });
  }
  const relatedSessionIds = new Set(related.sessions.map((session) => session.id as string));
  const sessionById = byId(related.sessions);
  for (const report of snapshot.sessionReports) {
    if (report.completed !== 1 || !relatedSessionIds.has(report.session_id as string)) continue;
    const session = sessionById.get(report.session_id);
    const classRow = session ? classes.get(session.class_id) : null;
    connectedHistory.push({
      id: `delivery-${report.id}`,
      kind: report.flagged === 1 ? "delivery_flag" : "delivery_evidence",
      body: report.flagged === 1
        ? `Session evidence was finalized with a flag.${report.flag_reason ? ` ${report.flag_reason}` : ""}`
        : "Session evidence was finalized.",
      actorName: report.reported_by ? (users.get(report.reported_by)?.name as string | undefined) ?? null : null,
      createdAt: Number(report.reported_at),
      scopeLabel: `Delivery · ${classRow?.title ?? "Class session"}`,
      href: session ? `/app/classes/${session.class_id}/sessions/${session.id}` : null,
    });
  }
  connectedHistory.sort((left, right) => right.createdAt - left.createdAt || left.id.localeCompare(right.id));

  return {
    ...summary,
    partner: partnerRow
      ? { id: partnerRow.id, name: partnerRow.name, type: partnerRow.type, location: partnerRow.location }
      : null,
    primaryContact: contactRow
      ? { id: contactRow.id, name: contactRow.name, email: contactRow.email, phone: contactRow.phone ?? "" }
      : null,
    location: locationRow ? mapLocation(locationRow) : null,
    curriculum: curriculumRow
      ? { id: curriculumRow.id, title: curriculumRow.title, ageRange: curriculumRow.age_range ?? null }
      : null,
    classes: related.classes.map((classRow) => ({
      id: classRow.id,
      title: classRow.title,
      status: classRow.status,
      startDate: classRow.start_date ?? null,
      location: classRow.location ?? null,
      scheduleTimezone: classRow.schedule_timezone ?? null,
    })),
    instructors: related.classInstructors.map((assignment) => ({
      id: assignment.instructor_id,
      name: personNameForInstructor(assignment.instructor_id),
      role: assignment.role,
      eligibility: instructors.get(assignment.instructor_id)?.eligibility_status ?? "not_eligible",
      classId: assignment.class_id,
    })),
    students: related.enrollments.map((enrollment) => ({
      id: enrollment.student_id,
      name: students.get(enrollment.student_id)?.name ?? "Student",
      formStatus: students.get(enrollment.student_id)?.form_status ?? "missing",
      classId: enrollment.class_id,
    })),
    sessions: related.sessions.map((session) => ({
      id: session.id,
      classId: session.class_id,
      classTitle: classTitle(session.class_id),
      sessionDate: session.session_date,
      location: session.location ?? null,
      scheduleTimezone: session.timezone ?? classes.get(session.class_id)?.schedule_timezone ?? program.scheduleTimezone,
    })),
    tasks,
    activity,
    originatingInquiry,
    connectedHistory: connectedHistory.slice(0, 80),
    recommendations: related.classes[0]
      ? staffingFor(snapshot, program, related.classes[0].id as string, "lead")
      : staffingFor(snapshot, program),
    staffingByClass: related.classes.map((classRow) => ({
      classId: classRow.id as string,
      leadRecommendations: staffingFor(snapshot, program, classRow.id as string, "lead"),
      additionalRecommendations: staffingFor(snapshot, program, classRow.id as string, "additional"),
    })),
    relatedPrograms,
  };
}

export async function getClassStaffingRecommendation(
  programId: string,
  classId: string,
  instructorId: string,
  role: "lead" | "additional" = "lead",
): Promise<StaffingRecommendation | null> {
  const snapshot = (await loadSnapshot());
  const programRow = snapshot.programs.find((candidate) => candidate.id === programId);
  const classRow = snapshot.classes.find((candidate) => candidate.id === classId && candidate.program_id === programId);
  const instructor = snapshot.instructors.find((candidate) => candidate.id === instructorId);
  if (!programRow || !classRow || !instructor) return null;
  const program = mapProgram(programRow);
  return staffingFor(snapshot, program, classId, role).find((candidate) => candidate.instructorId === instructorId) ?? null;
}

export async function getProgramReadiness(id: string): Promise<ProgramReadiness | null> {
  const snapshot = (await loadSnapshot());
  const row = snapshot.programs.find((candidate) => candidate.id === id);
  return row ? readinessFor(snapshot, mapProgram(row)) : null;
}

export async function getProgramFormOptions() {
  const snapshot = (await loadSnapshot());
  const regions = byId(snapshot.regions);
  const organizationsByPerson = new Map<string, Set<string>>();
  for (const relationship of snapshot.organizationPeople) {
    const personId = relationship.person_id as string;
    const organizationId = relationship.organization_id as string;
    const organizationIds = organizationsByPerson.get(personId) ?? new Set<string>();
    organizationIds.add(organizationId);
    organizationsByPerson.set(personId, organizationIds);
  }
  return {
    organizations: snapshot.organizations
      .filter((row) => row.status === "prospect" || row.status === "active")
      .map((row) => ({ id: row.id as string, name: row.name as string })),
    people: snapshot.people.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      email: row.email as string,
      organizationIds: [...(organizationsByPerson.get(row.id as string) ?? [])],
    })),
    locations: snapshot.locations.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      stage: row.stage as string,
      timezone: (row.timezone ?? (row.region_id ? regions.get(row.region_id)?.timezone : null) ?? null) as string | null,
    })),
    curricula: snapshot.curricula.map((row) => ({ id: row.id as string, title: row.title as string, ageRange: row.age_range ?? null })),
    staff: snapshot.users
      .filter((row) => (row.role === "admin" || row.role === "growth") && row.status === "active")
      .map((row) => ({ id: row.id as string, name: row.name as string })),
    unassignedClasses: snapshot.classes
      .filter((row) => !row.program_id)
      .map((row) => ({ id: row.id as string, title: row.title as string, status: row.status as string })),
  };
}

export async function getProgramSourcePrefill(
  sourceType: string | null,
  sourceId: string | null,
): Promise<{ name: string; partnerOrgId: string | null; primaryContactPersonId?: string | null } | null> {
  if (!sourceType || !sourceId) return null;
  const db = getDb();
  if (sourceType === "class") {
    const row = (await db.prepare("SELECT title, partner_org_id FROM classes WHERE id = ?").get(sourceId)) as
      | { title: string; partner_org_id: string | null }
      | undefined;
    return row ? { name: row.title, partnerOrgId: row.partner_org_id } : null;
  }
  if (sourceType === "class_proposal") {
    const row = (await db.prepare("SELECT title FROM class_proposals WHERE id = ?").get(sourceId)) as { title: string } | undefined;
    return row ? { name: row.title, partnerOrgId: null } : null;
  }
  if (sourceType === "inquiry") {
    const row = (await db.prepare("SELECT organization_id, org_name, email FROM inquiries WHERE id = ?").get(sourceId)) as
      | { organization_id: string | null; org_name: string; email: string }
      | undefined;
    if (!row) return null;
    const organization = row.organization_id
      ? (await db.prepare("SELECT id FROM organizations WHERE id = ? AND status IN ('prospect','active')").get(row.organization_id)) as
        | { id: string }
        | undefined
      : undefined;
    const contact = organization
      ? (await db.prepare(
                `SELECT pe.id
           FROM people pe
           JOIN organization_people op ON op.person_id = pe.id
          WHERE op.organization_id = ? AND op.active = 1
            AND lower(trim(pe.email)) = lower(trim(?))
          ORDER BY op.is_primary DESC, op.updated_at DESC
          LIMIT 1`,
              ).get(organization.id, row.email)) as { id: string } | undefined
      : undefined;
    return {
      name: `${row.org_name} Program`,
      partnerOrgId: organization?.id ?? null,
      primaryContactPersonId: contact?.id ?? null,
    };
  }
  if (sourceType === "demo_request") {
    const row = (await db
          .prepare("SELECT p.name FROM demo_requests d JOIN partner_orgs p ON p.slug = d.org_slug WHERE d.id = ?")
          .get(sourceId)) as { name: string } | undefined;
    if (!row) return null;
    const organization = (await db.prepare("SELECT id FROM organizations WHERE lower(name) = lower(?)").get(row.name)) as
      | { id: string }
      | undefined;
    return { name: `${row.name} Program`, partnerOrgId: organization?.id ?? null };
  }
  return null;
}

export interface LocationSummary {
  location: Location;
  regionName: string | null;
  parentLocationName: string | null;
  leaderName: string | null;
  partnerCount: number;
  programCount: number;
  activeProgramCount: number;
  instructorSupply: number;
  openTaskCount: number;
  expectedDemand: number;
  earliestLaunchDate: string | null;
  primaryBlocker: string | null;
  nextAction: string;
  nextActionHref: string;
}

function locationSummaryFor(snapshot: OperationsSnapshot, location: Location): LocationSummary {
  const qualificationNow = Date.now();
  const qualificationToday = canonicalDateInZone(qualificationNow);
  const programs = snapshot.programs.map(mapProgram).filter((program) => program.locationId === location.id);
  const partnerIds = new Set<string>(
    programs.map((program) => program.partnerOrgId).filter((value): value is string => Boolean(value)),
  );
  for (const relationship of snapshot.organizationLocations) {
    if (relationship.location_id === location.id && relationship.active === 1) partnerIds.add(relationship.organization_id as string);
  }
  const qualifiedInstructorIds = new Set(
    snapshot.qualifications
      .filter((row) =>
        activeQualification(row, qualificationToday, qualificationNow) &&
        ((row.kind === "location" && (row.value === location.id || row.value === "all")) ||
          (row.kind === "region" && location.regionId && row.value === location.regionId)),
      )
      .map((row) => row.instructor_id),
  );
  const eligibleSupply = snapshot.instructors.filter(
    (row) => qualifiedInstructorIds.has(row.id) && row.eligibility_status === "eligible" && row.stage === "active",
  ).length;
  const activePrograms = programs.filter((program) => program.stage === "active");
  const upcomingDates = programs
    .map((program) => program.launchDate)
    .filter((value): value is string => Boolean(value))
    .sort();
  const readiness = programs.map((program) => readinessFor(snapshot, program));
  const firstBlocked = readiness.find((item) => item.blockers.length > 0)?.blockers[0] ?? null;
  const expectedDemand = location.expectedDemand ?? programs.reduce((sum, program) => sum + (program.minimumEnrollment || 0), 0);
  const leader = location.primaryLeaderUserId ? byId(snapshot.users).get(location.primaryLeaderUserId) : null;
  const leaderIsActiveStaff = Boolean(
    leader && leader.status === "active" && (leader.role === "admin" || leader.role === "growth"),
  );
  const region = location.regionId ? byId(snapshot.regions).get(location.regionId) : null;
  const parent = location.parentLocationId ? byId(snapshot.locations).get(location.parentLocationId) : null;
  const openTaskCount = snapshot.tasks.filter(
    (task) => task.entity_type === "location" && task.entity_id === location.id && task.status === "open",
  ).length;
  const programStartHref = `/app/programs/new?location=${encodeURIComponent(location.id)}&name=${encodeURIComponent(`${location.name} Program`)}`;
  return {
    location,
    regionName: region?.name ?? location.region,
    parentLocationName: parent?.name ?? null,
    leaderName: leader?.name ?? null,
    partnerCount: partnerIds.size,
    programCount: programs.length,
    activeProgramCount: activePrograms.length,
    instructorSupply: eligibleSupply,
    openTaskCount,
    expectedDemand,
    earliestLaunchDate: location.earliestLaunchDate ?? upcomingDates[0] ?? null,
    primaryBlocker:
      (!leaderIsActiveStaff && location.stage !== "closed"
        ? "No active BOW staff leader is accountable for this Location."
        : null) ??
      firstBlocked?.detail ??
      (programs.length === 0
        ? "No Program is planned for this Location."
        : eligibleSupply === 0 && location.stage !== "active"
          ? "No eligible instructor has confirmed Location coverage."
          : null),
    nextAction:
      !leaderIsActiveStaff && location.stage !== "closed"
        ? "Assign an accountable leader"
        : programs.length === 0
        ? "Create the first Program"
        : firstBlocked?.actionLabel ?? (eligibleSupply === 0 ? "Build instructor supply" : "Review expansion plan"),
    nextActionHref:
      !leaderIsActiveStaff && location.stage !== "closed"
        ? `/app/locations/${location.id}/edit`
        : programs.length === 0
        ? programStartHref
        : firstBlocked?.actionHref ?? (eligibleSupply === 0 ? "/app/instructors" : `/app/locations/${location.id}#market-plan`),
  };
}

export async function listLocations(): Promise<LocationSummary[]> {
  const snapshot = (await loadSnapshot());
  return snapshot.locations
    .map(mapLocation)
    .map((location) => locationSummaryFor(snapshot, location))
    .sort((a, b) => {
      const attention = Number(Boolean(b.primaryBlocker)) - Number(Boolean(a.primaryBlocker));
      if (attention !== 0) return attention;
      const aDate = a.earliestLaunchDate ? Date.parse(a.earliestLaunchDate) : Number.MAX_SAFE_INTEGER;
      const bDate = b.earliestLaunchDate ? Date.parse(b.earliestLaunchDate) : Number.MAX_SAFE_INTEGER;
      if (aDate !== bDate) return aDate - bDate;
      return a.location.name.localeCompare(b.location.name);
    });
}

export interface LocationDetail extends LocationSummary {
  region: { id: string; name: string; code: string; timezone: string | null; stage: string } | null;
  parentLocation: { id: string; name: string } | null;
  childLocations: { id: string; name: string; stage: LocationStage; city: string | null; state: string | null }[];
  leader: { id: string; name: string } | null;
  programs: ProgramSummary[];
  partners: { id: string; name: string; status: string; relationshipType: string }[];
  instructors: { id: string; name: string; eligibility: string; progressionLevel: string }[];
  tasks: {
    id: string;
    title: string;
    kind: string;
    priority: string;
    ownerName: string | null;
    dueAt: number | null;
    dueOn: string | null;
    context: string | null;
    recommendedAction: string | null;
  }[];
  activity: { id: string; kind: string; body: string | null; actorName: string | null; createdAt: number }[];
}

export async function getLocation(id: string): Promise<LocationDetail | null> {
  const snapshot = (await loadSnapshot());
  const qualificationNow = Date.now();
  const qualificationToday = canonicalDateInZone(qualificationNow);
  const row = snapshot.locations.find((candidate) => candidate.id === id);
  if (!row) return null;
  const location = mapLocation(row);
  const summary = locationSummaryFor(snapshot, location);
  const programs = snapshot.programs
    .map(mapProgram)
    .filter((program) => program.locationId === id)
    .map((program) => summaryFor(snapshot, program));
  const organizations = byId(snapshot.organizations);
  const locationRelationships = snapshot.organizationLocations.filter(
    (relationship) => relationship.location_id === id && relationship.active === 1,
  );
  const partnerIds = new Set<string>(
    programs.map((program) => program.program.partnerOrgId).filter((value): value is string => Boolean(value)),
  );
  for (const relationship of locationRelationships) partnerIds.add(relationship.organization_id as string);
  const partners = [...partnerIds]
    .map((partnerId) => organizations.get(partnerId))
    .filter(Boolean)
    .map((partner) => ({
      id: partner.id as string,
      name: partner.name as string,
      status: partner.status as string,
      relationshipType:
        (locationRelationships.find((relationship) => relationship.organization_id === partner.id)?.relationship_type as string | undefined) ??
        "program_partner",
    }));
  const qualifiedInstructorIds = new Set(
    snapshot.qualifications
      .filter((qualification) =>
        activeQualification(qualification, qualificationToday, qualificationNow) &&
        ((qualification.kind === "location" && (qualification.value === id || qualification.value === "all")) ||
          (qualification.kind === "region" && location.regionId && qualification.value === location.regionId)),
      )
      .map((qualification) => qualification.instructor_id),
  );
  const people = byId(snapshot.people);
  const users = byId(snapshot.users);
  const instructors = snapshot.instructors
    .filter((instructor) => qualifiedInstructorIds.has(instructor.id))
    .map((instructor) => ({
      id: instructor.id as string,
      name: (people.get(instructor.person_id)?.name as string | undefined) ?? "Instructor",
      eligibility: instructor.eligibility_status as string,
      progressionLevel: (instructor.progression_level as string | undefined) ?? "instructor",
    }));
  const tasks = snapshot.tasks
    .filter((task) => task.entity_type === "location" && task.entity_id === id && task.status === "open")
    .map((task) => ({
      id: task.id as string,
      title: task.title as string,
      kind: (task.kind as string | undefined) ?? "task",
      priority: (task.priority as string | undefined) ?? "normal",
      ownerName: task.owner_user_id ? (users.get(task.owner_user_id)?.name as string | undefined) ?? null : null,
      dueAt: (task.due_at as number | null) ?? null,
      dueOn: (task.due_on as string | null) ?? null,
      context: (task.context as string | null) ?? null,
      recommendedAction: (task.recommended_action as string | null) ?? null,
    }));
  const regionRow = location.regionId ? byId(snapshot.regions).get(location.regionId) : null;
  const parentRow = location.parentLocationId ? byId(snapshot.locations).get(location.parentLocationId) : null;
  const leaderRow = location.primaryLeaderUserId ? users.get(location.primaryLeaderUserId) : null;
  const childLocations = snapshot.locations
    .filter((candidate) => candidate.parent_location_id === id)
    .map((candidate) => ({
      id: candidate.id as string,
      name: candidate.name as string,
      stage: candidate.stage as LocationStage,
      city: (candidate.city as string | null) ?? null,
      state: (candidate.state as string | null) ?? null,
    }));
  const activity = snapshot.activity
    .filter((item) => item.entity_type === "location" && item.entity_id === id)
    .map((item) => ({
      id: item.id as string,
      kind: item.kind as string,
      body: (item.body as string | null) ?? null,
      actorName: item.actor_user_id ? (users.get(item.actor_user_id)?.name as string | undefined) ?? null : null,
      createdAt: item.created_at as number,
    }));

  return {
    ...summary,
    region: regionRow
      ? {
          id: regionRow.id as string,
          name: regionRow.name as string,
          code: regionRow.code as string,
          timezone: (regionRow.timezone as string | null) ?? null,
          stage: regionRow.stage as string,
        }
      : null,
    parentLocation: parentRow ? { id: parentRow.id as string, name: parentRow.name as string } : null,
    childLocations,
    leader: leaderRow ? { id: leaderRow.id as string, name: leaderRow.name as string } : null,
    programs,
    partners,
    instructors,
    tasks,
    activity,
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */
