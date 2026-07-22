"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireCapability, requireStaff } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { currentWeekStart, deriveWeeklySummary, resolvePersonIdForUser, type WeeklyStatus } from "@/lib/people-operations";

export type PeopleOpsActionResult = { ok: true; id?: string } | { ok: false; error: string };

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function managementScope(actor: { id: string; role: string }, personId: string): Promise<{
  allowed: boolean;
  self: boolean;
  actorPersonId: string | null;
}> {
  const actorPersonId = await resolvePersonIdForUser(actor.id);
  const target = (await getDb().prepare(
    `SELECT p.user_id,
            EXISTS (
              SELECT 1 FROM role_assignments target
               JOIN role_assignments manager ON manager.id = target.manager_assignment_id
              WHERE target.person_id = p.id AND manager.person_id = ?
                AND target.status IN ('activating','active','paused')
                AND manager.status IN ('activating','active','paused')
            ) AS direct_report
       FROM people p WHERE p.id = ?`,
  ).get(actorPersonId, personId)) as { user_id: string | null; direct_report: boolean } | undefined;
  const self = target?.user_id === actor.id;
  return { allowed: Boolean(target && (actor.role === "admin" || self || target.direct_report)), self, actorPersonId };
}

async function notifyManagerOrActor(input: {
  personId: string;
  fallbackUserId: string;
  id: string;
  title: string;
  body: string;
  link: string;
}) {
  const row = (await getDb().prepare(
    `SELECT manager_person.user_id
       FROM role_assignments target
       JOIN role_assignments manager_assignment ON manager_assignment.id = target.manager_assignment_id
       JOIN people manager_person ON manager_person.id = manager_assignment.person_id
      WHERE target.person_id = ? AND target.status IN ('activating','active','paused')
        AND manager_person.user_id IS NOT NULL
      ORDER BY target.is_primary DESC, target.created_at DESC LIMIT 1`,
  ).get(input.personId)) as { user_id: string } | undefined;
  await createNotification({
    id: input.id,
    userId: row?.user_id ?? input.fallbackUserId,
    type: "quality",
    title: input.title,
    body: input.body,
    link: input.link,
  });
}

function revalidatePeople(personId?: string) {
  revalidatePath("/app/tasks");
  revalidatePath("/app/people");
  revalidatePath("/app");
  if (personId) revalidatePath(`/app/people/${personId}`);
}

export async function saveWeeklyCommitment(input: {
  personId: string;
  weekStart?: string;
  commitment: string;
  expectedResult: string;
  linkedOutcomeId?: string | null;
  linkedTaskIds: string[];
  status: WeeklyStatus;
  blocker?: string;
  helpNeeded?: string;
  confirmAsManager?: boolean;
}): Promise<PeopleOpsActionResult> {
  const me = await requireStaff();
  const personId = clean(input.personId, 120);
  const scope = await managementScope(me, personId);
  if (!scope.allowed) return { ok: false, error: "You can only update your own week or a direct report's week." };
  const commitment = clean(input.commitment, 500);
  const expectedResult = clean(input.expectedResult, 1_000);
  const blocker = clean(input.blocker, 1_000);
  const helpNeeded = clean(input.helpNeeded, 1_000);
  if (commitment.length < 5) return { ok: false, error: "Describe the week's primary commitment." };
  if (expectedResult.length < 5) return { ok: false, error: "Describe what successful completion should produce." };
  if (!(["on_track", "blocked", "at_risk"] as string[]).includes(input.status)) return { ok: false, error: "Choose a valid weekly status." };
  if (input.status !== "on_track" && !blocker) return { ok: false, error: "Explain the blocker or risk." };
  const weekStart = clean(input.weekStart, 10) || currentWeekStart();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return { ok: false, error: "Choose a valid week." };
  const taskIds = [...new Set((input.linkedTaskIds ?? []).map((id) => clean(id, 120)).filter(Boolean))].slice(0, 50);
  const db = getDb();
  const now = Date.now();
  await db.exec("BEGIN IMMEDIATE");
  try {
    const target = (await db.prepare("SELECT user_id FROM people WHERE id = ? FOR UPDATE").get(personId)) as { user_id: string | null } | undefined;
    if (!target) throw new Error("missing");
    if (taskIds.length > 0) {
      if (!target.user_id) throw new Error("tasks_without_user");
      const valid = (await db.prepare(
        `SELECT COUNT(*) AS n FROM tasks
          WHERE id = ANY(?) AND status = 'open' AND (owner_user_id = ? OR doer_user_id = ?)`,
      ).get(taskIds, target.user_id, target.user_id)) as { n: number };
      if (Number(valid.n) !== taskIds.length) throw new Error("invalid_tasks");
    }
    if (input.linkedOutcomeId) {
      const outcome = await db.prepare("SELECT 1 FROM outcomes WHERE id = ? AND status = 'active'").get(input.linkedOutcomeId);
      if (!outcome) throw new Error("invalid_outcome");
    }
    const assignment = (await db.prepare(
      `SELECT id FROM role_assignments WHERE person_id = ? AND status IN ('activating','active','paused')
        ORDER BY is_primary DESC, created_at DESC LIMIT 1`,
    ).get(personId)) as { id: string } | undefined;
    const managerConfirmedAt = input.confirmAsManager && !scope.self ? now : null;
    const existing = (await db.prepare(
      "SELECT id, status FROM people_weekly_cycles WHERE person_id = ? AND week_start = ? FOR UPDATE",
    ).get(personId, weekStart)) as { id: string; status: string } | undefined;
    if (existing?.status === "closed") throw new Error("closed");
    const cycleId = existing?.id ?? `pwc-${randomUUID().slice(0, 12)}`;
    if (existing) {
      await db.prepare(
        `UPDATE people_weekly_cycles SET role_assignment_id = ?, manager_user_id = ?, commitment = ?, expected_result = ?,
         linked_outcome_id = ?, declared_status = ?, blocker = ?, help_needed = ?,
         manager_confirmed_at = COALESCE(?, manager_confirmed_at), updated_at = ? WHERE id = ?`,
      ).run(assignment?.id ?? null, scope.self ? null : me.id, commitment, expectedResult, input.linkedOutcomeId || null,
        input.status, blocker || null, helpNeeded || null, managerConfirmedAt, now, cycleId);
      await db.prepare("DELETE FROM people_weekly_cycle_tasks WHERE weekly_cycle_id = ?").run(cycleId);
    } else {
      await db.prepare(
        `INSERT INTO people_weekly_cycles
         (id, person_id, role_assignment_id, manager_user_id, week_start, commitment, expected_result,
          linked_outcome_id, declared_status, blocker, help_needed, manager_confirmed_at, status,
          derived_summary, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', '{}', ?, ?)`,
      ).run(cycleId, personId, assignment?.id ?? null, scope.self ? null : me.id, weekStart, commitment, expectedResult,
        input.linkedOutcomeId || null, input.status, blocker || null, helpNeeded || null, managerConfirmedAt, now, now);
    }
    for (const taskId of taskIds) {
      await db.prepare(
        "INSERT INTO people_weekly_cycle_tasks (weekly_cycle_id, task_id, created_at) VALUES (?, ?, ?)",
      ).run(cycleId, taskId, now);
    }
    if (input.status === "blocked" || input.status === "at_risk") {
      await db.prepare(
        `INSERT INTO people_accountability_events
         (id, person_id, role_assignment_id, weekly_cycle_id, event_type, reason, status, dedupe_key, actor_user_id, created_at)
         VALUES (?, ?, ?, ?, 'at_risk', ?, 'open', ?, ?, ?)
         ON CONFLICT (dedupe_key) DO UPDATE SET reason = excluded.reason`,
      ).run(`pae-${randomUUID().slice(0, 12)}`, personId, assignment?.id ?? null, cycleId,
        blocker, `weekly-risk:${cycleId}`, me.id, now);
    }
    await db.exec("COMMIT");
    if (input.status !== "on_track") {
      await notifyManagerOrActor({ personId, fallbackUserId: me.id, id: `ntf-week-risk-${cycleId}`,
        title: input.status === "blocked" ? "Weekly commitment is blocked" : "Weekly commitment is at risk",
        body: commitment, link: `/app/people/${personId}` });
    }
    revalidatePeople(personId);
    return { ok: true, id: cycleId };
  } catch (error) {
    if (db.isTransaction) await db.exec("ROLLBACK");
    const code = error instanceof Error ? error.message : "";
    if (code === "closed") return { ok: false, error: "This week is already closed and preserved as history." };
    if (code === "invalid_tasks") return { ok: false, error: "Link only open Work owned by this person." };
    if (code === "tasks_without_user") return { ok: false, error: "This person needs an account before Work can be linked." };
    if (code === "invalid_outcome") return { ok: false, error: "Choose an active outcome." };
    return { ok: false, error: "The weekly commitment could not be saved." };
  }
}

export async function closeWeeklyCycle(input: {
  cycleId: string;
  assessment: "met" | "partially_met" | "missed";
  reason?: string;
}): Promise<PeopleOpsActionResult> {
  const me = await requireStaff();
  const db = getDb();
  const cycleId = clean(input.cycleId, 120);
  const reason = clean(input.reason, 1_500);
  if (!( ["met", "partially_met", "missed"] as string[]).includes(input.assessment)) return { ok: false, error: "Choose a valid weekly result." };
  if (input.assessment !== "met" && reason.length < 5) return { ok: false, error: "Explain what happened and what comes next." };
  const cycle = (await db.prepare("SELECT person_id FROM people_weekly_cycles WHERE id = ?").get(cycleId)) as { person_id: string } | undefined;
  if (!cycle) return { ok: false, error: "Weekly cycle not found." };
  const scope = await managementScope(me, cycle.person_id);
  if (!scope.allowed) return { ok: false, error: "You cannot close this person's week." };
  const summary = await deriveWeeklySummary(cycleId);
  const storedSummary = { ...summary, assessment: input.assessment, reason: reason || null };
  const now = Date.now();
  await db.exec("BEGIN IMMEDIATE");
  try {
    const locked = (await db.prepare("SELECT * FROM people_weekly_cycles WHERE id = ? FOR UPDATE").get(cycleId)) as Record<string, unknown> | undefined;
    if (!locked || locked.status !== "open") throw new Error("closed");
    await db.prepare(
      "UPDATE people_weekly_cycles SET status = 'closed', derived_summary = ?, closed_at = ?, updated_at = ? WHERE id = ?",
    ).run(JSON.stringify(storedSummary), now, now, cycleId);
    if (input.assessment !== "met") {
      const eventType = input.assessment === "missed" ? "commitment_missed" : "recovery_requested";
      await db.prepare(
        `INSERT INTO people_accountability_events
         (id, person_id, role_assignment_id, weekly_cycle_id, event_type, reason, status, dedupe_key, actor_user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
         ON CONFLICT (dedupe_key) DO NOTHING`,
      ).run(`pae-${randomUUID().slice(0, 12)}`, locked.person_id, locked.role_assignment_id ?? null,
        cycleId, eventType, reason, `weekly-close:${cycleId}`, me.id, now);
    } else {
      await db.prepare(
        "UPDATE people_accountability_events SET status = 'resolved', resolved_at = ? WHERE weekly_cycle_id = ? AND status = 'open'",
      ).run(now, cycleId);
    }
    await db.exec("COMMIT");
    revalidatePeople(cycle.person_id);
    return { ok: true };
  } catch {
    if (db.isTransaction) await db.exec("ROLLBACK");
    return { ok: false, error: "This weekly cycle was already closed or changed." };
  }
}

export async function recordRecoveryCommitment(input: {
  eventId: string;
  commitment: string;
}): Promise<PeopleOpsActionResult> {
  const me = await requireStaff();
  const db = getDb();
  const eventId = clean(input.eventId, 120);
  const commitment = clean(input.commitment, 1_500);
  if (commitment.length < 10) return { ok: false, error: "State the recovery action and a clear new commitment." };
  const event = (await db.prepare("SELECT person_id, status FROM people_accountability_events WHERE id = ?").get(eventId)) as { person_id: string; status: string } | undefined;
  if (!event || event.status !== "open") return { ok: false, error: "This recovery item is no longer open." };
  const scope = await managementScope(me, event.person_id);
  if (!scope.allowed) return { ok: false, error: "You cannot update this recovery item." };
  const now = Date.now();
  await db.exec("BEGIN IMMEDIATE");
  try {
    await db.prepare("UPDATE people_accountability_events SET recovery_commitment = ? WHERE id = ? AND status = 'open'")
      .run(commitment, eventId);
    await db.prepare(
      `INSERT INTO people_accountability_events
       (id, person_id, event_type, reason, recovery_commitment, status, dedupe_key, actor_user_id, created_at)
       VALUES (?, ?, 'recovery_committed', 'Recovery commitment recorded.', ?, 'open', ?, ?, ?)
       ON CONFLICT (dedupe_key) DO UPDATE SET recovery_commitment = excluded.recovery_commitment`,
    ).run(`pae-${randomUUID().slice(0, 12)}`, event.person_id, commitment, `recovery:${eventId}`, me.id, now);
    await db.exec("COMMIT");
    revalidatePeople(event.person_id);
    return { ok: true };
  } catch {
    if (db.isTransaction) await db.exec("ROLLBACK");
    return { ok: false, error: "The recovery commitment could not be saved." };
  }
}

export async function resolveAccountabilityEvent(input: { eventId: string; reason: string }): Promise<PeopleOpsActionResult> {
  const me = await requireStaff();
  const reason = clean(input.reason, 1_500);
  if (reason.length < 5) return { ok: false, error: "Record why this item is resolved." };
  const db = getDb();
  const event = (await db.prepare("SELECT person_id FROM people_accountability_events WHERE id = ? AND status = 'open'").get(input.eventId)) as { person_id: string } | undefined;
  if (!event) return { ok: false, error: "This accountability item is no longer open." };
  const scope = await managementScope(me, event.person_id);
  if (!scope.allowed || (scope.self && me.role !== "admin")) return { ok: false, error: "A manager must resolve accountability history." };
  const now = Date.now();
  await db.exec("BEGIN IMMEDIATE");
  try {
    await db.prepare("UPDATE people_accountability_events SET status = 'resolved', resolved_at = ? WHERE id = ? AND status = 'open'")
      .run(now, input.eventId);
    await db.prepare(
      `INSERT INTO people_accountability_events
       (id, person_id, event_type, reason, status, dedupe_key, actor_user_id, created_at, resolved_at)
       VALUES (?, ?, 'resolved', ?, 'resolved', ?, ?, ?, ?)`,
    ).run(`pae-${randomUUID().slice(0, 12)}`, event.person_id, reason, `resolved:${input.eventId}`, me.id, now, now);
    await db.exec("COMMIT");
    revalidatePeople(event.person_id);
    return { ok: true };
  } catch {
    if (db.isTransaction) await db.exec("ROLLBACK");
    return { ok: false, error: "The accountability item could not be resolved." };
  }
}

export async function updateRoleCapacity(input: {
  roleAssignmentId: string;
  weeklyCapacityHours?: number | null;
  availabilityStatus: "available" | "limited" | "unavailable";
}): Promise<PeopleOpsActionResult> {
  const me = await requireStaff();
  const db = getDb();
  const assignment = (await db.prepare("SELECT person_id FROM role_assignments WHERE id = ?").get(input.roleAssignmentId)) as { person_id: string } | undefined;
  if (!assignment) return { ok: false, error: "Role assignment not found." };
  const scope = await managementScope(me, assignment.person_id);
  if (!scope.allowed) return { ok: false, error: "You cannot change this person's availability." };
  const hours = input.weeklyCapacityHours == null ? null : Number(input.weeklyCapacityHours);
  if (hours != null && (!Number.isFinite(hours) || hours < 0 || hours > 168)) return { ok: false, error: "Capacity must be between 0 and 168 hours." };
  if (!(["available", "limited", "unavailable"] as string[]).includes(input.availabilityStatus)) return { ok: false, error: "Choose a valid availability status." };
  await db.prepare("UPDATE role_assignments SET weekly_capacity_hours = ?, availability_status = ?, updated_at = ? WHERE id = ?")
    .run(hours, input.availabilityStatus, Date.now(), input.roleAssignmentId);
  revalidatePeople(assignment.person_id);
  return { ok: true };
}

export async function configureRoleAssignment(input: {
  personId: string;
  roleId: string;
  managerAssignmentId?: string | null;
  engagementType: "volunteer" | "employee" | "contractor" | "other";
}): Promise<PeopleOpsActionResult> {
  const me = await requireCapability("people.assignment.manage");
  const db = getDb();
  const personId = clean(input.personId, 120);
  const roleId = clean(input.roleId, 120);
  const person = await db.prepare("SELECT 1 FROM people WHERE id = ?").get(personId);
  const role = (await db.prepare("SELECT organization_unit_id, default_autonomy FROM org_roles WHERE id = ? AND status = 'active'").get(roleId)) as { organization_unit_id: string; default_autonomy: number } | undefined;
  if (!person || !role) return { ok: false, error: "Choose a valid person and active role." };
  const active = await db.prepare(
    "SELECT 1 FROM role_assignments WHERE person_id = ? AND is_primary = true AND status IN ('activating','active','paused')",
  ).get(personId);
  if (active) return { ok: false, error: "This person already has a current role assignment. End it safely before creating another primary assignment." };
  if (!(["volunteer", "employee", "contractor", "other"] as string[]).includes(input.engagementType)) return { ok: false, error: "Choose a valid engagement type." };
  if (input.managerAssignmentId) {
    const manager = await db.prepare("SELECT 1 FROM role_assignments WHERE id = ? AND status IN ('activating','active')").get(input.managerAssignmentId);
    if (!manager) return { ok: false, error: "Choose a current manager assignment." };
  }
  const assignmentId = `ra-${randomUUID().slice(0, 12)}`;
  const now = Date.now();
  await db.exec("BEGIN IMMEDIATE");
  try {
    await db.prepare(
      `INSERT INTO role_assignments
       (id, person_id, role_id, organization_unit_id, position_id, manager_assignment_id, engagement_type,
        status, is_primary, autonomy_level, starts_on, ends_on, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, ?, ?, 'activating', true, ?, ?, NULL, ?, ?)`,
    ).run(assignmentId, personId, roleId, role.organization_unit_id, input.managerAssignmentId || null,
      input.engagementType, role.default_autonomy, new Date(now).toISOString().slice(0, 10), now, now);
    const defaults = [
      ["onboarding", "Complete onboarding", "onboarding"],
      ["first_approved_work", "Complete first approved Work", "first_approved_work"],
      ["manager_review", "Manager activation review", "manager_review"],
    ];
    for (const [key, label, type] of defaults) {
      await db.prepare(
        `INSERT INTO role_activation_requirements
         (id, role_assignment_id, requirement_key, label, requirement_type, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
      ).run(`rar-${randomUUID().slice(0, 12)}`, assignmentId, key, label, type, now, now);
    }
    await db.prepare(
      `INSERT INTO role_assignment_decisions
       (id, role_assignment_id, decision_type, prior_status, next_status, prior_autonomy, next_autonomy, reason, actor_user_id, created_at)
       VALUES (?, ?, 'role_review', NULL, 'activating', NULL, ?, 'Initial role assignment created.', ?, ?)`,
    ).run(`rad-${randomUUID().slice(0, 12)}`, assignmentId, role.default_autonomy, me.id, now);
    await db.exec("COMMIT");
    revalidatePeople(personId);
    return { ok: true, id: assignmentId };
  } catch {
    if (db.isTransaction) await db.exec("ROLLBACK");
    return { ok: false, error: "The role assignment could not be created." };
  }
}

export async function changeRoleManager(input: {
  roleAssignmentId: string;
  managerAssignmentId?: string | null;
  reason: string;
}): Promise<PeopleOpsActionResult> {
  const me = await requireCapability("people.assignment.manage");
  const db = getDb();
  const reason = clean(input.reason, 1_500);
  if (reason.length < 5) return { ok: false, error: "Record why the reporting relationship changed." };
  const assignment = (await db.prepare("SELECT * FROM role_assignments WHERE id = ?").get(input.roleAssignmentId)) as Record<string, unknown> | undefined;
  if (!assignment) return { ok: false, error: "Role assignment not found." };
  const managerId = input.managerAssignmentId || null;
  if (managerId === input.roleAssignmentId) return { ok: false, error: "A role assignment cannot manage itself." };
  if (managerId) {
    const manager = await db.prepare("SELECT 1 FROM role_assignments WHERE id = ? AND status IN ('activating','active')").get(managerId);
    if (!manager) return { ok: false, error: "Choose a current manager assignment." };
    const cycle = await db.prepare(
      `WITH RECURSIVE manager_chain AS (
         SELECT id, manager_assignment_id FROM role_assignments WHERE id = ?
         UNION ALL
         SELECT parent.id, parent.manager_assignment_id FROM role_assignments parent
          JOIN manager_chain child ON parent.id = child.manager_assignment_id
       ) SELECT 1 FROM manager_chain WHERE id = ? LIMIT 1`,
    ).get(managerId, input.roleAssignmentId);
    if (cycle) return { ok: false, error: "That reporting change would create a management loop." };
  }
  const now = Date.now();
  await db.exec("BEGIN IMMEDIATE");
  try {
    await db.prepare("UPDATE role_assignments SET manager_assignment_id = ?, updated_at = ? WHERE id = ?")
      .run(managerId, now, input.roleAssignmentId);
    await db.prepare(
      `INSERT INTO role_assignment_decisions
       (id, role_assignment_id, decision_type, prior_status, next_status, prior_autonomy, next_autonomy, reason, actor_user_id, created_at)
       VALUES (?, ?, 'manager_change', ?, ?, ?, ?, ?, ?, ?)`,
    ).run(`rad-${randomUUID().slice(0, 12)}`, input.roleAssignmentId, assignment.status, assignment.status,
      assignment.autonomy_level, assignment.autonomy_level, reason, me.id, now);
    await db.exec("COMMIT");
    revalidatePeople(String(assignment.person_id));
    return { ok: true };
  } catch {
    if (db.isTransaction) await db.exec("ROLLBACK");
    return { ok: false, error: "The reporting relationship could not be updated." };
  }
}

export async function decideRoleAssignment(input: {
  roleAssignmentId: string;
  decision: "activation" | "autonomy_change" | "pause" | "resume" | "end" | "revoke" | "role_review";
  reason: string;
  nextAutonomy?: number;
}): Promise<PeopleOpsActionResult> {
  const me = await requireStaff();
  const reason = clean(input.reason, 2_000);
  if (reason.length < 10) return { ok: false, error: "Record the evidence and reason behind this decision." };
  const db = getDb();
  const assignment = (await db.prepare("SELECT * FROM role_assignments WHERE id = ?").get(input.roleAssignmentId)) as Record<string, unknown> | undefined;
  if (!assignment) return { ok: false, error: "Role assignment not found." };
  const scope = await managementScope(me, String(assignment.person_id));
  if (!scope.allowed || (scope.self && me.role !== "admin")) return { ok: false, error: "A manager must make role and autonomy decisions." };
  const currentStatus = String(assignment.status);
  const nextStatus: Record<string, string> = {
    activation: "active", pause: "paused", resume: "active", end: "ended", revoke: "revoked", role_review: currentStatus,
  };
  const status = nextStatus[input.decision] ?? currentStatus;
  const autonomy = input.decision === "autonomy_change" ? Number(input.nextAutonomy) : Number(assignment.autonomy_level);
  if (!Number.isInteger(autonomy) || autonomy < 1 || autonomy > 4) return { ok: false, error: "Autonomy must be a level from 1 to 4." };
  if (input.decision === "activation") {
    const pending = (await db.prepare(
      "SELECT COUNT(*) AS n FROM role_activation_requirements WHERE role_assignment_id = ? AND status = 'pending'",
    ).get(input.roleAssignmentId)) as { n: number };
    if (Number(pending.n) > 0) return { ok: false, error: `${pending.n} activation requirement(s) are still pending.` };
  }
  if (["end", "revoke"].includes(input.decision)) {
    const blockers = (await db.prepare(
      `SELECT
         (SELECT COUNT(*) FROM tasks WHERE role_assignment_id = ? AND status = 'open') AS work,
         (SELECT COUNT(*) FROM responsibilities WHERE accountable_assignment_id = ? AND status = 'active') AS responsibilities,
         (SELECT COUNT(*) FROM outcomes WHERE accountable_assignment_id = ? AND status = 'active') AS outcomes,
         (SELECT COUNT(*) FROM role_assignments WHERE manager_assignment_id = ? AND status IN ('activating','active','paused')) AS reports`,
    ).get(input.roleAssignmentId, input.roleAssignmentId, input.roleAssignmentId, input.roleAssignmentId)) as Record<string, unknown>;
    const details = Object.entries(blockers).filter(([, value]) => Number(value) > 0).map(([key, value]) => `${value} ${key}`);
    if (details.length) return { ok: false, error: `Reassign these before ending the role: ${details.join(", ")}.` };
  }
  const now = Date.now();
  await db.exec("BEGIN IMMEDIATE");
  try {
    await db.prepare(
      "UPDATE role_assignments SET status = ?, autonomy_level = ?, ends_on = CASE WHEN ? IN ('ended','revoked') THEN ? ELSE ends_on END, updated_at = ? WHERE id = ?",
    ).run(status, autonomy, status, new Date(now).toISOString().slice(0, 10), now, input.roleAssignmentId);
    await db.prepare(
      `INSERT INTO role_assignment_decisions
       (id, role_assignment_id, decision_type, prior_status, next_status, prior_autonomy, next_autonomy, reason, actor_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(`rad-${randomUUID().slice(0, 12)}`, input.roleAssignmentId, input.decision, currentStatus, status,
      assignment.autonomy_level, autonomy, reason, me.id, now);
    if (input.decision === "role_review") {
      await db.prepare(
        `INSERT INTO people_accountability_events
         (id, person_id, role_assignment_id, event_type, reason, status, dedupe_key, actor_user_id, created_at)
         VALUES (?, ?, ?, 'role_review_opened', ?, 'open', ?, ?, ?)
         ON CONFLICT (dedupe_key) DO NOTHING`,
      ).run(`pae-${randomUUID().slice(0, 12)}`, assignment.person_id, input.roleAssignmentId, reason,
        `role-review:${input.roleAssignmentId}:${now}`, me.id, now);
    }
    await db.exec("COMMIT");
    revalidatePeople(String(assignment.person_id));
    return { ok: true };
  } catch {
    if (db.isTransaction) await db.exec("ROLLBACK");
    return { ok: false, error: "The role decision could not be recorded." };
  }
}

export async function updateActivationRequirement(input: {
  requirementId: string;
  status: "satisfied" | "waived";
  reason: string;
}): Promise<PeopleOpsActionResult> {
  const me = await requireStaff();
  const db = getDb();
  const requirement = (await db.prepare(
    `SELECT rar.*, ra.person_id FROM role_activation_requirements rar
      JOIN role_assignments ra ON ra.id = rar.role_assignment_id WHERE rar.id = ?`,
  ).get(input.requirementId)) as Record<string, unknown> | undefined;
  if (!requirement) return { ok: false, error: "Activation requirement not found." };
  const scope = await managementScope(me, String(requirement.person_id));
  if (!scope.allowed || (scope.self && me.role !== "admin")) return { ok: false, error: "A manager must confirm or waive activation requirements." };
  const reason = clean(input.reason, 1_500);
  if (reason.length < 5) return { ok: false, error: "Record why this activation requirement is being confirmed or waived." };
  await db.prepare(
    "UPDATE role_activation_requirements SET status = ?, decision_note = ?, decided_by_user_id = ?, decided_at = ?, updated_at = ? WHERE id = ?",
  ).run(input.status, reason, me.id, Date.now(), Date.now(), input.requirementId);
  revalidatePeople(String(requirement.person_id));
  return { ok: true };
}

export async function addPlaybookTrainingRequirement(input: {
  roleAssignmentId: string;
  lessonId: string;
  label: string;
}): Promise<PeopleOpsActionResult> {
  const me = await requireStaff();
  const db = getDb();
  const assignment = (await db.prepare("SELECT person_id FROM role_assignments WHERE id = ?").get(input.roleAssignmentId)) as { person_id: string } | undefined;
  if (!assignment) return { ok: false, error: "Role assignment not found." };
  const scope = await managementScope(me, assignment.person_id);
  if (!scope.allowed || (scope.self && me.role !== "admin")) return { ok: false, error: "A manager must configure role training." };
  const lesson = await db.prepare("SELECT id FROM learn_lessons WHERE id = ? AND published_version_id IS NOT NULL").get(input.lessonId);
  if (!lesson) return { ok: false, error: "Choose a published Playbook lesson." };
  const label = clean(input.label, 200);
  if (label.length < 3) return { ok: false, error: "Name the training requirement." };
  const key = `playbook:${clean(input.lessonId, 120)}`;
  const now = Date.now();
  await db.prepare(
    `INSERT INTO role_activation_requirements
     (id, role_assignment_id, requirement_key, label, requirement_type, status, source_type, source_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'training', 'pending', 'learn_lesson', ?, ?, ?)
     ON CONFLICT (role_assignment_id, requirement_key) DO UPDATE SET label = excluded.label, updated_at = excluded.updated_at`,
  ).run(`rar-${randomUUID().slice(0, 12)}`, input.roleAssignmentId, key, label, input.lessonId, now, now);
  revalidatePeople(assignment.person_id);
  return { ok: true };
}

/** A Playbook lesson remains the source of truth; this only mirrors whether a linked activation requirement is satisfied. */
export async function syncPlaybookTraining(roleAssignmentId: string): Promise<PeopleOpsActionResult> {
  const me = await requireStaff();
  const db = getDb();
  const assignment = (await db.prepare(
    `SELECT ra.person_id, p.user_id FROM role_assignments ra JOIN people p ON p.id = ra.person_id WHERE ra.id = ?`,
  ).get(roleAssignmentId)) as { person_id: string; user_id: string | null } | undefined;
  if (!assignment) return { ok: false, error: "Role assignment not found." };
  const scope = await managementScope(me, assignment.person_id);
  if (!scope.allowed) return { ok: false, error: "You cannot sync this role's training." };
  if (!assignment.user_id) return { ok: false, error: "This person needs a user account before Playbook training can be verified." };
  const requirements = (await db.prepare(
    `SELECT id, source_id FROM role_activation_requirements
      WHERE role_assignment_id = ? AND requirement_type = 'training' AND source_type = 'learn_lesson'`,
  ).all(roleAssignmentId)) as Array<{ id: string; source_id: string }>;
  let changed = 0;
  for (const requirement of requirements) {
    const mastery = await db.prepare(
      "SELECT 1 FROM learn_lesson_mastery WHERE user_id = ? AND lesson_id = ? AND first_completed_at IS NOT NULL",
    ).get(assignment.user_id, requirement.source_id);
    if (mastery) {
      const result = await db.prepare(
        `UPDATE role_activation_requirements SET status = 'satisfied', decision_note = 'Verified from Playbook mastery.', decided_by_user_id = NULL,
         decided_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'`,
      ).run(Date.now(), Date.now(), requirement.id);
      changed += result.changes;
    }
  }
  revalidatePeople(assignment.person_id);
  return changed > 0 || requirements.length === 0 ? { ok: true } : { ok: false, error: "Linked Playbook training is not complete yet." };
}
