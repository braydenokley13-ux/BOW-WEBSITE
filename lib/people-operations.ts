import "server-only";

import { getDb } from "@/lib/db";
import { canonicalDateInZone } from "@/lib/timezone";

const DAY_MS = 86_400_000;

export type WeeklyStatus = "on_track" | "blocked" | "at_risk";

export interface WeeklyCycleView {
  id: string;
  personId: string;
  roleAssignmentId: string | null;
  weekStart: string;
  commitment: string;
  expectedResult: string;
  linkedOutcomeId: string | null;
  declaredStatus: WeeklyStatus;
  blocker: string | null;
  helpNeeded: string | null;
  managerConfirmed: boolean;
  status: "open" | "closed";
  linkedTaskIds: string[];
  linkedTasks: Array<{ id: string; title: string; workflowState: string; dueOn: string | null }>;
  derivedSummary: WeeklyDerivedSummary;
}

export interface WeeklyDerivedSummary {
  linked: number;
  approved: number;
  submitted: number;
  revisionRequested: number;
  overdue: number;
  blocked: number;
  canceled: number;
  open: number;
}

export interface PersonAttentionView {
  personId: string;
  userId: string | null;
  name: string;
  email: string;
  roleAssignmentId: string | null;
  roleTitle: string;
  assignmentStatus: string | null;
  autonomyLevel: number | null;
  availabilityStatus: string;
  weeklyCapacityHours: number | null;
  managerName: string | null;
  currentWeek: WeeklyCycleView | null;
  openWork: number;
  overdueWork: number;
  blockedWork: number;
  waitingReview: number;
  openAccountability: number;
  pendingActivation: number;
  evidence: Record<"output" | "reliability" | "quality" | "impact" | "coachability", number>;
  attentionReasons: string[];
  standing: "strong" | "on_track" | "needs_attention" | "at_risk";
}

export interface PeopleOperationsData {
  currentWeekStart: string;
  people: PersonAttentionView[];
  outcomes: Array<{ id: string; title: string }>;
  tasks: Array<{ id: string; title: string; personId: string | null; workflowState: string; dueOn: string | null }>;
}

export function currentWeekStart(now = Date.now()): string {
  const canonical = canonicalDateInZone(now);
  const date = new Date(`${canonical}T12:00:00Z`);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  return new Date(date.getTime() - daysSinceMonday * DAY_MS).toISOString().slice(0, 10);
}

function numberValue(value: unknown): number {
  return value == null ? 0 : Number(value);
}

function parseSummary(value: unknown): WeeklyDerivedSummary {
  const empty: WeeklyDerivedSummary = {
    linked: 0, approved: 0, submitted: 0, revisionRequested: 0,
    overdue: 0, blocked: 0, canceled: 0, open: 0,
  };
  if (value && typeof value === "object") return { ...empty, ...(value as Partial<WeeklyDerivedSummary>) };
  if (typeof value !== "string") return empty;
  try {
    return { ...empty, ...(JSON.parse(value) as Partial<WeeklyDerivedSummary>) };
  } catch {
    return empty;
  }
}

export async function resolvePersonIdForUser(userId: string): Promise<string | null> {
  const row = (await getDb().prepare(
    "SELECT id FROM people WHERE user_id = ? ORDER BY created_at LIMIT 1",
  ).get(userId)) as { id: string } | undefined;
  return row?.id ?? null;
}

export async function getWeeklyCycleForPerson(personId: string, weekStart: string): Promise<WeeklyCycleView | null> {
  const db = getDb();
  const row = (await db.prepare(
    `SELECT * FROM people_weekly_cycles WHERE person_id = ? AND week_start = ?`,
  ).get(personId, weekStart)) as Record<string, unknown> | undefined;
  if (!row) return null;
  const taskRows = (await db.prepare(
    `SELECT t.id, t.title, t.workflow_state, t.due_on
       FROM people_weekly_cycle_tasks wct JOIN tasks t ON t.id = wct.task_id
      WHERE wct.weekly_cycle_id = ? ORDER BY t.created_at`,
  ).all(row.id)) as Array<Record<string, unknown>>;
  return {
    id: String(row.id),
    personId: String(row.person_id),
    roleAssignmentId: row.role_assignment_id ? String(row.role_assignment_id) : null,
    weekStart: String(row.week_start),
    commitment: String(row.commitment),
    expectedResult: String(row.expected_result),
    linkedOutcomeId: row.linked_outcome_id ? String(row.linked_outcome_id) : null,
    declaredStatus: row.declared_status as WeeklyStatus,
    blocker: row.blocker ? String(row.blocker) : null,
    helpNeeded: row.help_needed ? String(row.help_needed) : null,
    managerConfirmed: row.manager_confirmed_at != null,
    status: row.status as "open" | "closed",
    linkedTaskIds: taskRows.map((task) => String(task.id)),
    linkedTasks: taskRows.map((task) => ({
      id: String(task.id), title: String(task.title), workflowState: String(task.workflow_state),
      dueOn: task.due_on ? String(task.due_on) : null,
    })),
    derivedSummary: parseSummary(row.derived_summary),
  };
}

/**
 * Manager visibility stays narrow: admins can operate across BOW; other HQ
 * staff see themselves plus people whose current assignment reports to one
 * of their own current assignments.
 */
export async function getPeopleOperationsData(input: {
  userId: string;
  role: string;
  now?: number;
}): Promise<PeopleOperationsData> {
  const db = getDb();
  const now = input.now ?? Date.now();
  const weekStart = currentWeekStart(now);
  const today = canonicalDateInZone(now);
  const schemaState = (await db.prepare(
    `SELECT
       to_regclass('public.people_weekly_cycles') IS NOT NULL
       AND to_regclass('public.people_weekly_cycle_tasks') IS NOT NULL
       AND to_regclass('public.people_accountability_events') IS NOT NULL
       AND to_regclass('public.role_activation_requirements') IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'role_assignments'
            AND column_name = 'availability_status'
       ) AS ready`,
  ).get()) as { ready: boolean } | undefined;

  // A deployment can briefly precede migration 008. Keep the founder home and
  // shared app shell usable while that additive migration is pending; the
  // People workspace will populate automatically once the schema is present.
  if (!schemaState?.ready) {
    return { currentWeekStart: weekStart, people: [], outcomes: [], tasks: [] };
  }

  const peopleRows = (await db.prepare(
    `SELECT p.id AS person_id, p.user_id, p.name, p.email,
            ra.id AS role_assignment_id, ra.status AS assignment_status,
            ra.autonomy_level, ra.availability_status, ra.weekly_capacity_hours,
            r.title AS role_title, manager_person.name AS manager_name
       FROM people p
       LEFT JOIN users account ON account.id = p.user_id
       LEFT JOIN LATERAL (
         SELECT candidate.* FROM role_assignments candidate
          WHERE candidate.person_id = p.id AND candidate.status IN ('activating','active','paused')
          ORDER BY candidate.is_primary DESC, candidate.created_at DESC LIMIT 1
       ) ra ON true
       LEFT JOIN org_roles r ON r.id = ra.role_id
       LEFT JOIN role_assignments manager_assignment ON manager_assignment.id = ra.manager_assignment_id
       LEFT JOIN people manager_person ON manager_person.id = manager_assignment.person_id
      WHERE p.identity_status = 'active'
        AND (ra.id IS NOT NULL OR account.role IN ('admin','growth','instructor'))
        AND (
          ? = 'admin'
          OR p.user_id = ?
          OR ra.manager_assignment_id IN (
            SELECT mine.id FROM role_assignments mine
             JOIN people me ON me.id = mine.person_id
            WHERE me.user_id = ? AND mine.status IN ('activating','active','paused')
          )
        )
      ORDER BY p.name`,
  ).all(input.role, input.userId, input.userId)) as Array<Record<string, unknown>>;

  const personIds = peopleRows.map((row) => String(row.person_id));
  const cycleRows = personIds.length ? (await db.prepare(
    "SELECT * FROM people_weekly_cycles WHERE person_id = ANY(?) AND week_start = ?",
  ).all(personIds, weekStart)) as Array<Record<string, unknown>> : [];
  const cycleIds = cycleRows.map((row) => String(row.id));
  const cycleTaskRows = cycleIds.length ? (await db.prepare(
    `SELECT wct.weekly_cycle_id, t.id, t.title, t.workflow_state, t.due_on
       FROM people_weekly_cycle_tasks wct JOIN tasks t ON t.id = wct.task_id
      WHERE wct.weekly_cycle_id = ANY(?) ORDER BY t.created_at`,
  ).all(cycleIds)) as Array<Record<string, unknown>> : [];
  const tasksByCycle = new Map<string, Array<Record<string, unknown>>>();
  for (const task of cycleTaskRows) {
    const key = String(task.weekly_cycle_id);
    tasksByCycle.set(key, [...(tasksByCycle.get(key) ?? []), task]);
  }
  const cyclesByPerson = new Map<string, WeeklyCycleView>();
  for (const row of cycleRows) {
    const linked = tasksByCycle.get(String(row.id)) ?? [];
    cyclesByPerson.set(String(row.person_id), {
      id: String(row.id), personId: String(row.person_id),
      roleAssignmentId: row.role_assignment_id ? String(row.role_assignment_id) : null,
      weekStart: String(row.week_start), commitment: String(row.commitment), expectedResult: String(row.expected_result),
      linkedOutcomeId: row.linked_outcome_id ? String(row.linked_outcome_id) : null,
      declaredStatus: row.declared_status as WeeklyStatus, blocker: row.blocker ? String(row.blocker) : null,
      helpNeeded: row.help_needed ? String(row.help_needed) : null, managerConfirmed: row.manager_confirmed_at != null,
      status: row.status as "open" | "closed", linkedTaskIds: linked.map((task) => String(task.id)),
      linkedTasks: linked.map((task) => ({ id: String(task.id), title: String(task.title), workflowState: String(task.workflow_state), dueOn: task.due_on ? String(task.due_on) : null })),
      derivedSummary: parseSummary(row.derived_summary),
    });
  }

  const workRows = personIds.length ? (await db.prepare(
    `SELECT p.id AS person_id,
            COUNT(t.id) FILTER (WHERE t.status = 'open') AS open_work,
            COUNT(t.id) FILTER (WHERE t.status = 'open' AND t.due_on IS NOT NULL AND t.due_on < ?) AS overdue_work,
            COUNT(t.id) FILTER (WHERE t.status = 'open' AND t.workflow_state = 'submitted') AS waiting_review,
            COUNT(t.id) FILTER (WHERE t.status = 'open' AND t.workflow_state = 'revision_requested') AS blocked_work
       FROM people p LEFT JOIN tasks t ON t.owner_user_id = p.user_id OR t.doer_user_id = p.user_id
      WHERE p.id = ANY(?) GROUP BY p.id`,
  ).all(today, personIds)) as Array<Record<string, unknown>> : [];
  const workByPerson = new Map(workRows.map((row) => [String(row.person_id), row]));

  const accountabilityRows = personIds.length ? (await db.prepare(
    `SELECT person_id, COUNT(*) AS n FROM people_accountability_events
      WHERE person_id = ANY(?) AND status = 'open' GROUP BY person_id`,
  ).all(personIds)) as Array<Record<string, unknown>> : [];
  const accountabilityByPerson = new Map(accountabilityRows.map((row) => [String(row.person_id), numberValue(row.n)]));

  const activationRows = personIds.length ? (await db.prepare(
    `SELECT ra.person_id, COUNT(rar.id) AS n FROM role_assignments ra
       JOIN role_activation_requirements rar ON rar.role_assignment_id = ra.id AND rar.status = 'pending'
      WHERE ra.person_id = ANY(?) AND ra.status IN ('activating','active','paused') GROUP BY ra.person_id`,
  ).all(personIds)) as Array<Record<string, unknown>> : [];
  const activationByPerson = new Map(activationRows.map((row) => [String(row.person_id), numberValue(row.n)]));

  const evidenceRows = personIds.length ? (await db.prepare(
    `SELECT person_id, dimension, COUNT(*) AS n FROM performance_events
      WHERE person_id = ANY(?) AND created_at >= ? GROUP BY person_id, dimension`,
  ).all(personIds, now - 90 * DAY_MS)) as Array<Record<string, unknown>> : [];
  const evidenceByPerson = new Map<string, Record<"output" | "reliability" | "quality" | "impact" | "coachability", number>>();
  for (const event of evidenceRows) {
    const personId = String(event.person_id);
    const evidence = evidenceByPerson.get(personId) ?? { output: 0, reliability: 0, quality: 0, impact: 0, coachability: 0 };
    if (String(event.dimension) in evidence) evidence[String(event.dimension) as keyof typeof evidence] = numberValue(event.n);
    evidenceByPerson.set(personId, evidence);
  }

  const people: PersonAttentionView[] = [];
  for (const row of peopleRows) {
    const personId = String(row.person_id);
    const userId = row.user_id ? String(row.user_id) : null;
    const currentWeek = cyclesByPerson.get(personId) ?? null;
    const work = workByPerson.get(personId) ?? {};
    const evidence = evidenceByPerson.get(personId) ?? { output: 0, reliability: 0, quality: 0, impact: 0, coachability: 0 };
    const overdueWork = numberValue(work.overdue_work);
    const blockedWork = numberValue(work.blocked_work);
    const waitingReview = numberValue(work.waiting_review);
    const openAccountability = accountabilityByPerson.get(personId) ?? 0;
    const pendingActivation = activationByPerson.get(personId) ?? 0;
    const reasons: string[] = [];
    if (currentWeek?.declaredStatus === "blocked") reasons.push("Weekly commitment is blocked");
    if (currentWeek?.declaredStatus === "at_risk") reasons.push("Weekly commitment is at risk");
    if (!currentWeek && row.assignment_status !== "paused") reasons.push("No commitment for this week");
    if (overdueWork) reasons.push(`${overdueWork} overdue Work item${overdueWork === 1 ? "" : "s"}`);
    if (blockedWork) reasons.push(`${blockedWork} revision${blockedWork === 1 ? "" : "s"} requested`);
    if (waitingReview) reasons.push(`${waitingReview} submission${waitingReview === 1 ? "" : "s"} waiting for review`);
    if (openAccountability) reasons.push(`${openAccountability} open recovery/accountability item${openAccountability === 1 ? "" : "s"}`);
    if (pendingActivation && row.assignment_status === "activating") reasons.push(`${pendingActivation} activation requirement${pendingActivation === 1 ? "" : "s"} pending`);
    const standing: PersonAttentionView["standing"] = openAccountability > 0 || currentWeek?.declaredStatus === "at_risk"
      ? "at_risk"
      : reasons.length > 0
        ? "needs_attention"
        : "on_track";
    people.push({
      personId, userId, name: String(row.name), email: String(row.email),
      roleAssignmentId: row.role_assignment_id ? String(row.role_assignment_id) : null,
      roleTitle: row.role_title ? String(row.role_title) : "Contributor",
      assignmentStatus: row.assignment_status ? String(row.assignment_status) : null,
      autonomyLevel: row.autonomy_level == null ? null : Number(row.autonomy_level),
      availabilityStatus: row.availability_status ? String(row.availability_status) : "available",
      weeklyCapacityHours: row.weekly_capacity_hours == null ? null : Number(row.weekly_capacity_hours),
      managerName: row.manager_name ? String(row.manager_name) : null,
      currentWeek, openWork: numberValue(work.open_work), overdueWork, blockedWork, waitingReview,
      openAccountability, pendingActivation, evidence, attentionReasons: reasons, standing,
    });
  }

  const outcomes = ((await db.prepare(
    "SELECT id, title FROM outcomes WHERE status = 'active' ORDER BY due_on NULLS LAST, created_at LIMIT 200",
  ).all()) as Array<{ id: string; title: string }>).map((row) => ({ id: row.id, title: row.title }));
  const tasks = ((await db.prepare(
    `SELECT t.id, t.title, t.workflow_state, t.due_on, p.id AS person_id
       FROM tasks t LEFT JOIN people p ON p.user_id = COALESCE(t.doer_user_id, t.owner_user_id)
      WHERE t.status = 'open' ORDER BY t.due_on NULLS LAST, t.created_at LIMIT 500`,
  ).all()) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id), title: String(row.title), personId: row.person_id ? String(row.person_id) : null,
    workflowState: String(row.workflow_state), dueOn: row.due_on ? String(row.due_on) : null,
  }));
  return { currentWeekStart: weekStart, people, outcomes, tasks };
}

export async function deriveWeeklySummary(cycleId: string, today = canonicalDateInZone(Date.now())): Promise<WeeklyDerivedSummary> {
  const row = (await getDb().prepare(
    `SELECT COUNT(*) AS linked,
            COUNT(*) FILTER (WHERE t.workflow_state = 'approved') AS approved,
            COUNT(*) FILTER (WHERE t.workflow_state = 'submitted') AS submitted,
            COUNT(*) FILTER (WHERE t.workflow_state = 'revision_requested') AS revision_requested,
            COUNT(*) FILTER (WHERE t.status = 'open' AND t.due_on IS NOT NULL AND t.due_on < ?) AS overdue,
            COUNT(*) FILTER (WHERE t.status = 'open' AND t.workflow_state = 'revision_requested') AS blocked,
            COUNT(*) FILTER (WHERE t.workflow_state = 'canceled') AS canceled,
            COUNT(*) FILTER (WHERE t.status = 'open') AS open
       FROM people_weekly_cycle_tasks wct JOIN tasks t ON t.id = wct.task_id
      WHERE wct.weekly_cycle_id = ?`,
  ).get(today, cycleId)) as Record<string, unknown>;
  return {
    linked: numberValue(row.linked), approved: numberValue(row.approved), submitted: numberValue(row.submitted),
    revisionRequested: numberValue(row.revision_requested), overdue: numberValue(row.overdue),
    blocked: numberValue(row.blocked), canceled: numberValue(row.canceled), open: numberValue(row.open),
  };
}
