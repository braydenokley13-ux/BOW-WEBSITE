/* ============================================================
 * Instructor Current Mission — server data layer & write core.
 *
 * Reads the mission spine and derives the founder-facing activation queues
 * (who is accepted-but-not-activated, ready-but-unused, active-without-a-
 * mission, or going dormant) plus the recruiting-source funnel. The auth-free
 * write primitives (assign / update / complete / cancel) live here so
 * lifecycle tests can drive the exact production logic; app/actions wraps them
 * with RBAC. Server-only — never import from a Client Component.
 * ============================================================ */

import "server-only";
import { randomUUID } from "node:crypto";

import { getDb } from "@/lib/db";
import {
  DEFAULT_ACTIVATION_THRESHOLDS,
  deriveInstructorActivationExceptions,
  isMissionArea,
  isMissionCadence,
  isMissionCompletionOutcome,
  isMissionRelatedEntity,
  type ActivationException,
  type InstructorActivationRow,
  type InstructorMission,
  type MissionArea,
  type MissionCadence,
  type MissionRelatedEntity,
  type MissionUpdate,
} from "@/lib/instructor-missions-shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

const ACTIVE_CLASS_STATUSES = "'planning','staffing','ready_to_launch','active','paused'";

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function newMissionId(): string {
  return `msn-${randomUUID().slice(0, 12)}`;
}

/* ---------------- schema guard ---------------- */

let schemaReady: Promise<void> | null = null;

/** Verify the migration once per process rather than paying for it per read. */
export function ensureMissionSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const state = (await getDb().prepare(
        "SELECT to_regclass('public.instructor_missions') IS NOT NULL AS ready",
      ).get()) as { ready: boolean } | undefined;
      if (!state?.ready) {
        throw new Error("Instructor mission schema is missing. Apply scripts/migrations/013_instructor_missions.sql.");
      }
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

/* ---------------- mission reads ---------------- */

function relatedEntityLabel(row: any): string | null {
  if (!row.related_entity_type) return null;
  return row.related_entity_label ?? `${row.related_entity_type} (removed)`;
}

function rowToMission(row: any): InstructorMission {
  return {
    id: String(row.id),
    instructorId: String(row.instructor_id),
    area: row.area as MissionArea,
    title: String(row.title),
    outcome: String(row.outcome),
    cadence: row.cadence as MissionCadence,
    status: row.status,
    dueOn: row.due_on ?? null,
    relatedEntityType: (row.related_entity_type ?? null) as MissionRelatedEntity | null,
    relatedEntityId: row.related_entity_id ?? null,
    relatedEntityLabel: relatedEntityLabel(row),
    assignedByName: row.assigned_by_name ?? null,
    completionOutcome: row.completion_outcome ?? null,
    completionNote: row.completion_note ?? null,
    createdAt: num(row.created_at),
    updatedAt: num(row.updated_at),
    completedAt: row.completed_at == null ? null : num(row.completed_at),
  };
}

const MISSION_SELECT = `
  SELECT m.*, u.name AS assigned_by_name,
         CASE m.related_entity_type
           WHEN 'class' THEN (SELECT c.title FROM classes c WHERE c.id = m.related_entity_id)
           WHEN 'program' THEN (SELECT p.name FROM programs p WHERE p.id = m.related_entity_id)
           WHEN 'organization' THEN (SELECT o.name FROM organizations o WHERE o.id = m.related_entity_id)
         END AS related_entity_label
    FROM instructor_missions m
    LEFT JOIN users u ON u.id = m.assigned_by_user_id`;

/** The one active Current Mission for an instructor, or null. */
export async function getCurrentMission(instructorId: string): Promise<InstructorMission | null> {
  await ensureMissionSchema();
  const row = (await getDb()
    .prepare(`${MISSION_SELECT} WHERE m.instructor_id = ? AND m.status = 'active' LIMIT 1`)
    .get(instructorId)) as any;
  return row ? rowToMission(row) : null;
}

/** Completed / cancelled missions, newest first — the instructor's growth record. */
export async function getMissionHistory(instructorId: string, limit = 25): Promise<InstructorMission[]> {
  await ensureMissionSchema();
  const rows = (await getDb()
    .prepare(`${MISSION_SELECT} WHERE m.instructor_id = ? AND m.status <> 'active' ORDER BY m.completed_at DESC NULLS LAST LIMIT ?`)
    .all(instructorId, limit)) as any[];
  return rows.map(rowToMission);
}

export async function getMissionUpdates(missionId: string, limit = 40): Promise<MissionUpdate[]> {
  await ensureMissionSchema();
  const rows = (await getDb()
    .prepare(
      `SELECT mu.*, u.name AS author_name
         FROM instructor_mission_updates mu
         LEFT JOIN users u ON u.id = mu.author_user_id
        WHERE mu.mission_id = ?
        ORDER BY mu.created_at DESC
        LIMIT ?`,
    )
    .all(missionId, limit)) as any[];
  return rows.map((row) => ({
    id: String(row.id),
    missionId: String(row.mission_id),
    authorName: row.author_name ?? null,
    authorKind: row.author_kind,
    kind: row.kind,
    body: String(row.body),
    createdAt: num(row.created_at),
  }));
}

/** Current mission + its update history, for the dossier and self-service home. */
export async function getMissionWithUpdates(
  instructorId: string,
): Promise<{ mission: InstructorMission; updates: MissionUpdate[] } | null> {
  const mission = await getCurrentMission(instructorId);
  if (!mission) return null;
  return { mission, updates: await getMissionUpdates(mission.id) };
}

/* ---------------- activation queues ---------------- */

/**
 * Build the lightweight per-instructor rows the activation engine ranks. One
 * query joins the mission, assignment, upcoming-session, and last-activity
 * facts so the founder command center pays for a single round trip.
 */
export async function listInstructorActivationRows(now: number): Promise<InstructorActivationRow[]> {
  await ensureMissionSchema();
  const rows = (await getDb()
    .prepare(
      `SELECT i.id AS instructor_id, i.person_id, p.name, i.stage, i.eligibility_status,
              i.onboarding_status, i.created_at, i.decided_at, i.updated_at,
              (SELECT COUNT(*) FROM instructor_missions m
                WHERE m.instructor_id = i.id AND m.status = 'active') AS active_missions,
              (SELECT COUNT(*) FROM class_instructors ci
                JOIN classes c ON c.id = ci.class_id
               WHERE ci.instructor_id = i.id AND ci.removed_at IS NULL
                 AND c.status IN (${ACTIVE_CLASS_STATUSES})) AS current_assignments,
              (SELECT COUNT(*) FROM class_instructors ci
                JOIN class_sessions cs ON cs.class_id = ci.class_id
               WHERE ci.instructor_id = i.id AND ci.removed_at IS NULL
                 AND cs.session_date > ?) AS upcoming_sessions,
              GREATEST(
                i.updated_at,
                COALESCE((SELECT MAX(cs.session_date) FROM class_instructors ci
                           JOIN class_sessions cs ON cs.class_id = ci.class_id
                          WHERE ci.instructor_id = i.id AND cs.session_date <= ?), 0),
                COALESCE((SELECT MAX(mu.created_at) FROM instructor_mission_updates mu
                           JOIN instructor_missions m ON m.id = mu.mission_id
                          WHERE m.instructor_id = i.id), 0)
              ) AS last_activity_at
         FROM instructors i
         JOIN people p ON p.id = i.person_id
        WHERE i.stage NOT IN ('rejected','inactive')`,
    )
    .all(now, now)) as any[];
  return rows.map((row) => ({
    instructorId: String(row.instructor_id),
    personId: String(row.person_id),
    name: String(row.name),
    stage: String(row.stage),
    eligible: row.eligibility_status === "eligible",
    onboardingStatus: String(row.onboarding_status ?? "not_started"),
    createdAt: num(row.created_at),
    decidedAt: row.decided_at == null ? null : num(row.decided_at),
    hasActiveMission: num(row.active_missions) > 0,
    currentAssignmentCount: num(row.current_assignments),
    upcomingSessionCount: num(row.upcoming_sessions),
    lastActivityAt: num(row.last_activity_at),
  }));
}

/** The ranked instructor activation queue for the founder command center. */
export async function getInstructorActivationExceptions(now = Date.now()): Promise<ActivationException[]> {
  const rows = await listInstructorActivationRows(now);
  return deriveInstructorActivationExceptions(rows, now, DEFAULT_ACTIVATION_THRESHOLDS);
}

/* ---------------- recruiting source funnel ---------------- */

export interface SourceFunnelRow {
  source: string;
  label: string;
  applicants: number;
  accepted: number;
  ready: number;
  active: number;
  rejected: number;
  /** Share of applicants from this source who became active instructors. */
  activationRate: number;
}

const SOURCE_LABELS: Record<string, string> = {
  referral: "Instructor / personal referral",
  recruited: "Direct outreach",
  people_work_application: "Public application",
  other: "Other",
  unspecified: "Source not recorded",
};

/**
 * "Which recruiting channels actually create active instructors, not just
 * applications?" — grouped by the canonical `instructors.source`, so the
 * founder can read conversion by source without a spreadsheet.
 */
export async function getRecruitingSourceFunnel(): Promise<SourceFunnelRow[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT COALESCE(NULLIF(TRIM(source), ''), 'unspecified') AS source,
              COUNT(*) AS applicants,
              COUNT(*) FILTER (WHERE stage IN ('accepted','onboarding','training','practice_evaluation','eligible','active')) AS accepted,
              COUNT(*) FILTER (WHERE stage IN ('eligible','active') AND eligibility_status = 'eligible') AS ready,
              COUNT(*) FILTER (WHERE stage = 'active') AS active,
              COUNT(*) FILTER (WHERE stage = 'rejected') AS rejected
         FROM instructors
        GROUP BY 1
        ORDER BY applicants DESC, source`,
    )
    .all()) as any[];
  return rows.map((row) => {
    const applicants = num(row.applicants);
    const active = num(row.active);
    return {
      source: String(row.source),
      label: SOURCE_LABELS[String(row.source)] ?? String(row.source).replace(/_/g, " "),
      applicants,
      accepted: num(row.accepted),
      ready: num(row.ready),
      active,
      rejected: num(row.rejected),
      activationRate: applicants > 0 ? active / applicants : 0,
    };
  });
}

export interface MissionAreaCount {
  area: string;
  count: number;
}

/** How the active instructor base's Current Missions are distributed. */
export async function getActiveMissionAreaMix(): Promise<MissionAreaCount[]> {
  await ensureMissionSchema();
  const rows = (await getDb()
    .prepare("SELECT area, COUNT(*) AS n FROM instructor_missions WHERE status = 'active' GROUP BY area ORDER BY n DESC")
    .all()) as any[];
  return rows.map((row) => ({ area: String(row.area), count: num(row.n) }));
}

/** Everything the Instructor Command Center renders, in one call. */
export async function getInstructorCommandCenter(now = Date.now()): Promise<{
  exceptions: ActivationException[];
  sourceFunnel: SourceFunnelRow[];
  missionMix: MissionAreaCount[];
  activeInstructors: number;
  readyInstructors: number;
  activeMissions: number;
}> {
  await ensureMissionSchema();
  const [rows, sourceFunnel, missionMix] = await Promise.all([
    listInstructorActivationRows(now),
    getRecruitingSourceFunnel(),
    getActiveMissionAreaMix(),
  ]);
  const exceptions = deriveInstructorActivationExceptions(rows, now);
  const activeInstructors = rows.filter((row) => row.stage === "active").length;
  const readyInstructors = rows.filter((row) => (row.stage === "eligible" || row.stage === "active") && row.eligible).length;
  const activeMissions = missionMix.reduce((sum, entry) => sum + entry.count, 0);
  return { exceptions, sourceFunnel, missionMix, activeInstructors, readyInstructors, activeMissions };
}

/* ============================================================
 * Write core — auth-free primitives (app/actions wraps with RBAC).
 * ============================================================ */

export interface MissionWriteResult {
  ok: boolean;
  error?: string;
  missionId?: string;
}

async function logCrm(entityId: string, kind: string, body: string, actorUserId: string | null): Promise<void> {
  await getDb().prepare(
    "INSERT INTO crm_activity (id, entity_type, entity_id, kind, body, actor_user_id, created_at) VALUES (?, 'instructor', ?, ?, ?, ?, ?)",
  ).run(`pfx-${randomUUID().slice(0, 8)}`, entityId, kind, body, actorUserId, Date.now());
}

async function addUpdateRow(
  missionId: string,
  authorUserId: string | null,
  authorKind: "instructor" | "staff" | "system",
  kind: "progress" | "evidence" | "feedback" | "status_change",
  body: string,
  now: number,
): Promise<void> {
  await getDb().prepare(
    "INSERT INTO instructor_mission_updates (id, mission_id, author_user_id, author_kind, kind, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(`mup-${randomUUID().slice(0, 10)}`, missionId, authorUserId, authorKind, kind, body, now);
}

export interface AssignMissionInput {
  instructorId: string;
  area: string;
  title: string;
  outcome: string;
  cadence?: string;
  dueOn?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}

/**
 * Assign a Current Mission. Enforces the one-active-mission invariant with a
 * friendly pre-check (the partial unique index is the hard guarantee against
 * races) and validates the responsibility area, cadence, and any related
 * entity link before writing.
 */
export async function assignMissionCore(viewerId: string, input: AssignMissionInput): Promise<MissionWriteResult> {
  await ensureMissionSchema();
  const db = getDb();

  const title = (input.title ?? "").trim();
  const outcome = (input.outcome ?? "").trim();
  const cadence = (input.cadence ?? "once").trim();
  if (!isMissionArea(input.area)) return { ok: false, error: "Choose a valid mission area." };
  if (title.length < 4) return { ok: false, error: "Give the mission a clear title." };
  if (title.length > 160) return { ok: false, error: "Mission title is too long." };
  if (outcome.length < 10) return { ok: false, error: "Describe the outcome this mission should produce." };
  if (outcome.length > 2000) return { ok: false, error: "Mission outcome is too long." };
  if (!isMissionCadence(cadence)) return { ok: false, error: "Choose a valid cadence." };

  const dueOn = (input.dueOn ?? "").trim() || null;
  if (dueOn && !/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) return { ok: false, error: "Use a valid due date." };

  let relatedType: MissionRelatedEntity | null = null;
  let relatedId: string | null = null;
  const rawType = (input.relatedEntityType ?? "").trim();
  const rawId = (input.relatedEntityId ?? "").trim();
  if (rawType || rawId) {
    if (!isMissionRelatedEntity(rawType) || !rawId) return { ok: false, error: "The related item link is incomplete." };
    relatedType = rawType;
    relatedId = rawId;
  }

  const instructor = (await db.prepare("SELECT stage FROM instructors WHERE id = ?").get(input.instructorId)) as
    | { stage: string }
    | undefined;
  if (!instructor) return { ok: false, error: "Instructor not found." };
  if (instructor.stage === "rejected" || instructor.stage === "inactive") {
    return { ok: false, error: "This instructor is no longer active." };
  }

  const existing = (await db
    .prepare("SELECT id FROM instructor_missions WHERE instructor_id = ? AND status = 'active' LIMIT 1")
    .get(input.instructorId)) as { id: string } | undefined;
  if (existing) {
    return { ok: false, error: "This instructor already has a Current Mission. Complete or cancel it before assigning a new one." };
  }

  if (relatedType && relatedId) {
    const table = relatedType === "class" ? "classes" : relatedType === "program" ? "programs" : "organizations";
    const linked = await db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(relatedId);
    if (!linked) return { ok: false, error: "The related item no longer exists." };
  }

  const now = Date.now();
  const id = newMissionId();
  try {
    await db.prepare(
      `INSERT INTO instructor_missions
         (id, instructor_id, area, title, outcome, cadence, status, due_on,
          related_entity_type, related_entity_id, assigned_by_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`,
    ).run(id, input.instructorId, input.area, title, outcome, cadence, dueOn, relatedType, relatedId, viewerId, now, now);
  } catch {
    // The partial unique index tripped on a race — surface the same friendly message.
    return { ok: false, error: "This instructor already has a Current Mission." };
  }
  await addUpdateRow(id, viewerId, "staff", "status_change", `Mission assigned: ${title}`, now);
  await logCrm(input.instructorId, "mission", `Current Mission assigned: ${title}`, viewerId);
  return { ok: true, missionId: id };
}

/** Post a progress note or submitted evidence (instructor) / feedback (staff) on an active mission. */
export async function addMissionUpdateCore(
  viewerId: string | null,
  missionId: string,
  authorKind: "instructor" | "staff",
  kind: "progress" | "evidence" | "feedback",
  body: string,
): Promise<MissionWriteResult> {
  await ensureMissionSchema();
  const db = getDb();
  const text = (body ?? "").trim();
  if (text.length < 3) return { ok: false, error: "Add a short note." };
  if (text.length > 4000) return { ok: false, error: "That note is too long." };

  const mission = (await db.prepare("SELECT id, instructor_id, status FROM instructor_missions WHERE id = ?").get(missionId)) as
    | { id: string; instructor_id: string; status: string }
    | undefined;
  if (!mission) return { ok: false, error: "Mission not found." };
  if (mission.status !== "active") return { ok: false, error: "This mission is already closed." };

  const now = Date.now();
  await addUpdateRow(missionId, viewerId, authorKind, kind, text, now);
  await db.prepare("UPDATE instructor_missions SET updated_at = ? WHERE id = ?").run(now, missionId);
  const label = kind === "evidence" ? "Evidence submitted" : kind === "feedback" ? "Feedback added" : "Progress recorded";
  await logCrm(String(mission.instructor_id), "mission", `${label} on Current Mission.`, viewerId);
  return { ok: true, missionId };
}

/** Close a mission as delivered / partial / abandoned — the completion + outcome. */
export async function completeMissionCore(
  viewerId: string,
  missionId: string,
  completionOutcome: string,
  note: string,
): Promise<MissionWriteResult> {
  await ensureMissionSchema();
  const db = getDb();
  if (!isMissionCompletionOutcome(completionOutcome)) return { ok: false, error: "Choose how the mission ended." };
  const cleanNote = (note ?? "").trim();
  if (cleanNote.length > 2000) return { ok: false, error: "That note is too long." };

  const mission = (await db.prepare("SELECT instructor_id, title, status FROM instructor_missions WHERE id = ?").get(missionId)) as
    | { instructor_id: string; title: string; status: string }
    | undefined;
  if (!mission) return { ok: false, error: "Mission not found." };
  if (mission.status !== "active") return { ok: false, error: "This mission is already closed." };

  const now = Date.now();
  await db.prepare(
    "UPDATE instructor_missions SET status = 'completed', completion_outcome = ?, completion_note = ?, completed_at = ?, updated_at = ? WHERE id = ? AND status = 'active'",
  ).run(completionOutcome, cleanNote || null, now, now, missionId);
  await addUpdateRow(missionId, viewerId, "staff", "status_change", `Mission completed (${completionOutcome})${cleanNote ? ` — ${cleanNote}` : ""}`, now);
  await logCrm(String(mission.instructor_id), "mission", `Current Mission completed (${completionOutcome}): ${mission.title}`, viewerId);
  return { ok: true, missionId };
}

/** Cancel a mission that no longer applies, keeping the record for history. */
export async function cancelMissionCore(viewerId: string, missionId: string, note: string): Promise<MissionWriteResult> {
  await ensureMissionSchema();
  const db = getDb();
  const cleanNote = (note ?? "").trim();
  if (cleanNote.length < 4) return { ok: false, error: "Say why this mission is being cancelled." };
  if (cleanNote.length > 2000) return { ok: false, error: "That note is too long." };

  const mission = (await db.prepare("SELECT instructor_id, title, status FROM instructor_missions WHERE id = ?").get(missionId)) as
    | { instructor_id: string; title: string; status: string }
    | undefined;
  if (!mission) return { ok: false, error: "Mission not found." };
  if (mission.status !== "active") return { ok: false, error: "This mission is already closed." };

  const now = Date.now();
  await db.prepare(
    "UPDATE instructor_missions SET status = 'cancelled', completion_note = ?, completed_at = ?, updated_at = ? WHERE id = ? AND status = 'active'",
  ).run(cleanNote, now, now, missionId);
  await addUpdateRow(missionId, viewerId, "staff", "status_change", `Mission cancelled — ${cleanNote}`, now);
  await logCrm(String(mission.instructor_id), "mission", `Current Mission cancelled: ${mission.title}`, viewerId);
  return { ok: true, missionId };
}
