/* ============================================================
 * Growth flywheel — deterministic lifecycle triggers.
 *
 * Reads the operating data (programs, classes, students, instructors,
 * partners, tasks, referrals, demo requests) and derives the ranked
 * "what should cause the next growth event" queue plus the leak report.
 * No AI, no scoring models: every action is a plain SQL condition with
 * a reason a human can verify.
 *
 * Two small tables of its own:
 *   - class_closeouts: the post-program checklist that turns a finished
 *     class into proof (testimonial, feedback, referral prompts, assets).
 *   - growth_introductions: instructor/partner/student introductions to
 *     new communities, tracked to conversion.
 *
 * Server-only. Do not import from a client component.
 * ============================================================ */

import { getDb } from "@/lib/db";
import { formatCanonicalDate } from "@/lib/timezone";

const DAY_MS = 24 * 60 * 60 * 1000;

export {
  CLOSEOUT_FIELDS,
  INTRODUCTION_STATUSES,
  INTRODUCTION_TARGET_KINDS,
} from "@/lib/flywheel-shared";
export type {
  ActionSeverity,
  ClassCloseout,
  CloseoutField,
  FlywheelLeak,
  FlywheelSnapshot,
  GrowthAction,
  GrowthIntroduction,
} from "@/lib/flywheel-shared";
import { CLOSEOUT_FIELDS } from "@/lib/flywheel-shared";
import type {
  ActionSeverity,
  ClassCloseout,
  CloseoutField,
  FlywheelLeak,
  FlywheelSnapshot,
  GrowthAction,
  GrowthIntroduction,
} from "@/lib/flywheel-shared";

/* ---------------- schema ---------------- */

let schemaReady: Promise<void> | null = null;

/**
 * Verify the migration once per server process. Runtime reads must never run
 * DDL: doing so held database connections and made the first founder request
 * pay for a dozen CREATE/ALTER/INDEX round trips.
 */
export function ensureFlywheelSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getDb();
      const state = (await db.prepare(
        `SELECT
           to_regclass('public.class_closeouts') IS NOT NULL
           AND to_regclass('public.growth_introductions') IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'source_key'
           ) AS ready`,
      ).get()) as { ready: boolean } | undefined;
      if (!state?.ready) {
        throw new Error("Flywheel schema is missing. Apply scripts/migrations/010_flywheel_schema.sql.");
      }
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

/* ---------------- helpers ---------------- */

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function days(now: number, since: number): number {
  return Math.max(0, Math.floor((now - since) / DAY_MS));
}

/* ---------------- closeout ---------------- */

/* eslint-disable @typescript-eslint/no-explicit-any */

function rowToCloseout(classId: string, row: any): ClassCloseout {
  const fields = Object.fromEntries(
    CLOSEOUT_FIELDS.map((field) => [field.key, row ? num(row[field.key]) === 1 : false]),
  ) as Record<CloseoutField, boolean>;
  return {
    classId,
    fields,
    note: row?.note ?? "",
    completedAt: row?.completed_at == null ? null : num(row.completed_at),
    updatedAt: row?.updated_at == null ? null : num(row.updated_at),
  };
}

export async function getClassCloseout(classId: string): Promise<ClassCloseout> {
  await ensureFlywheelSchema();
  const row = (await getDb().prepare("SELECT * FROM class_closeouts WHERE class_id = ?").get(classId)) as any;
  return rowToCloseout(classId, row);
}

export async function listIntroductions(
  introducerType: GrowthIntroduction["introducerType"],
  introducerId: string,
): Promise<GrowthIntroduction[]> {
  await ensureFlywheelSchema();
  const rows = (await getDb()
    .prepare("SELECT * FROM growth_introductions WHERE introducer_type = ? AND introducer_id = ? ORDER BY created_at DESC")
    .all(introducerType, introducerId)) as any[];
  return rows.map((row) => ({
    id: String(row.id),
    introducerType: row.introducer_type,
    introducerId: String(row.introducer_id),
    targetKind: row.target_kind,
    targetName: String(row.target_name),
    status: row.status,
    note: row.note ?? "",
    createdAt: num(row.created_at),
    resolvedAt: row.resolved_at == null ? null : num(row.resolved_at),
  }));
}

/* ---------------- the action queue ---------------- */

const SEVERITY_ORDER: Record<ActionSeverity, number> = { act_now: 0, next_up: 1, watch: 2 };

/**
 * The ranked "Growth actions today" queue. Deterministic: each entry is a
 * lifecycle condition that is true right now, with the age that makes it
 * urgent. Ordering: severity, then oldest first.
 */
export async function getGrowthActions(now = Date.now(), limit = 8): Promise<GrowthAction[]> {
  await ensureFlywheelSchema();
  const db = getDb();
  const actions: GrowthAction[] = [];

  // 1. Open growth-relevant tasks that are overdue or handed to the founder.
  const openTasks = (await db.prepare(
    `SELECT t.id, t.title, t.recommended_action, t.entity_type, t.entity_id, t.due_on, t.priority,
            t.handoff_to_founder, t.owner_user_id, t.created_at
       FROM tasks t
      WHERE t.status = 'open'
        AND (t.handoff_to_founder = 1 OR (t.due_on IS NOT NULL AND t.due_on <= ?))
      ORDER BY t.due_on NULLS LAST, t.created_at
      LIMIT 12`,
  ).all(new Date(now).toISOString().slice(0, 10))) as any[];
  for (const task of openTasks) {
    actions.push({
      key: `task:${task.id}`,
      severity: num(task.handoff_to_founder) === 1 || task.priority === "urgent" ? "act_now" : "next_up",
      entityLabel: String(task.title),
      entityHref: "/app/tasks",
      reason: task.due_on ? `Due ${formatCanonicalDate(task.due_on)}.` : "Handed to the founder.",
      action: task.recommended_action || "Complete this task.",
      ageDays: days(now, num(task.created_at)),
      ctaLabel: "Open Work",
      taskId: String(task.id),
      ownerUserId: task.owner_user_id == null ? null : String(task.owner_user_id),
    });
  }

  // 2. Completed programs with no renewal decision and no child (repeat) program.
  const staleCompletedPrograms = (await db.prepare(
    `SELECT p.id, p.name, p.updated_at, o.name AS partner_name
       FROM programs p
       LEFT JOIN organizations o ON o.id = p.partner_org_id
      WHERE p.stage = 'completed'
        AND NOT EXISTS (SELECT 1 FROM programs child WHERE child.parent_program_id = p.id)
        AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.status = 'open' AND t.source_key = 'program-renewal:' || p.id)
      ORDER BY p.updated_at
      LIMIT 6`,
  ).all()) as any[];
  for (const program of staleCompletedPrograms) {
    const age = days(now, num(program.updated_at));
    actions.push({
      key: `program-renewal:${program.id}`,
      severity: age >= 7 ? "act_now" : "next_up",
      entityLabel: program.partner_name ? `${program.name} · ${program.partner_name}` : String(program.name),
      entityHref: `/app/programs/${program.id}`,
      reason: `Program completed ${age} day${age === 1 ? "" : "s"} ago with no repeat discussion recorded.`,
      action: "Run renewal review: propose the next program or consciously close.",
      ageDays: age,
      ctaLabel: "Open program",
      assignable: true,
    });
  }

  // 3. Completed classes whose closeout has not been finished.
  const openCloseouts = (await db.prepare(
    `SELECT c.id, c.title, c.updated_at
       FROM classes c
       LEFT JOIN class_closeouts cc ON cc.class_id = c.id
      WHERE c.status = 'completed' AND (cc.class_id IS NULL OR cc.completed_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.status = 'open' AND t.source_key = 'closeout:' || c.id)
      ORDER BY c.updated_at
      LIMIT 6`,
  ).all()) as any[];
  for (const cls of openCloseouts) {
    const age = days(now, num(cls.updated_at));
    actions.push({
      key: `closeout:${cls.id}`,
      severity: age >= 10 ? "act_now" : "next_up",
      entityLabel: String(cls.title),
      entityHref: `/app/classes/${cls.id}`,
      reason: `Class completed ${age} day${age === 1 ? "" : "s"} ago; closeout checklist not finished.`,
      action: "Finish the closeout: feedback, testimonial, referral prompts, partner follow-up.",
      ageDays: age,
      ctaLabel: "Run closeout",
      assignable: true,
    });
  }

  // 4. Students who completed a program but were never prompted to refer.
  const referralPool = (await db.prepare(
    `SELECT COUNT(DISTINCT o.student_id) AS n, MIN(o.created_at) AS oldest
       FROM student_program_outcomes o
      WHERE o.outcome_type IN ('completed','graduated')
        AND NOT EXISTS (
          SELECT 1 FROM student_referrals r JOIN students st ON st.id = o.student_id
           WHERE r.referrer_person_id = st.person_id AND r.voided_at IS NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM tasks t
           WHERE t.entity_type = 'student' AND t.entity_id = o.student_id AND t.title = 'Referral invite'
        )`,
  ).get()) as any;
  if (num(referralPool?.n) > 0) {
    const age = days(now, num(referralPool.oldest) || now);
    actions.push({
      key: "referral-pool",
      severity: num(referralPool.n) >= 5 ? "act_now" : "next_up",
      entityLabel: `${num(referralPool.n)} completed student${num(referralPool.n) === 1 ? "" : "s"}`,
      entityHref: "/app/students",
      reason: "Completed a program; no referral or invite prompt recorded since.",
      action: "Send referral invites (friend or sibling) while the experience is fresh.",
      ageDays: age,
      ctaLabel: "Open students",
    });
  }

  // 5. Demo requests sitting undispositioned.
  const staleDemos = (await db.prepare(
    `SELECT d.id, d.requester_name, d.org_slug, d.created_at
       FROM demo_requests d
      WHERE d.dispositioned = 0 AND d.created_at <= ?
        AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.status = 'open' AND t.source_key = 'demo:' || d.id)
      ORDER BY d.created_at
      LIMIT 4`,
  ).all(now - 3 * DAY_MS)) as any[];
  for (const demo of staleDemos) {
    const age = days(now, num(demo.created_at));
    actions.push({
      key: `demo:${demo.id}`,
      severity: age >= 7 ? "act_now" : "next_up",
      entityLabel: `${demo.requester_name} (${demo.org_slug})`,
      entityHref: "/app/partners",
      reason: `Demo request waiting ${age} day${age === 1 ? "" : "s"} with no disposition.`,
      action: "Reply and disposition: convert to a partner conversation or close.",
      ageDays: age,
      ctaLabel: "Open partners",
      assignable: true,
    });
  }

  // 6. Active instructors with a completed class and no introduction activity.
  const dormantInstructors = (await db.prepare(
    `SELECT i.id, p.name, i.updated_at
       FROM instructors i
       JOIN people p ON p.id = i.person_id
      WHERE i.stage = 'active'
        AND EXISTS (
          SELECT 1 FROM class_instructors ci JOIN classes c ON c.id = ci.class_id
           WHERE ci.instructor_id = i.id AND c.status = 'completed'
        )
        AND NOT EXISTS (
          SELECT 1 FROM growth_introductions gi
           WHERE gi.introducer_type = 'instructor' AND gi.introducer_id = i.id
        )
        AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.status = 'open' AND t.source_key = 'instructor-activation:' || i.id)
      ORDER BY i.updated_at
      LIMIT 3`,
  ).all()) as any[];
  for (const instructor of dormantInstructors) {
    actions.push({
      key: `instructor-activation:${instructor.id}`,
      severity: "watch",
      entityLabel: String(instructor.name),
      entityHref: `/app/instructors/${instructor.id}`,
      reason: "Delivered a completed class; no school/community introduction explored yet.",
      action: "Ask about one introduction: their school, a club, or a future instructor.",
      ageDays: days(now, num(instructor.updated_at)),
      ctaLabel: "Open instructor",
      assignable: true,
    });
  }

  // 7. Introductions stuck in "suggested" — someone said they'd connect us.
  const staleIntros = (await db.prepare(
    `SELECT gi.id, gi.target_name, gi.target_kind, gi.introducer_type, gi.introducer_id, gi.created_at
       FROM growth_introductions gi
      WHERE gi.status = 'suggested' AND gi.created_at <= ?
        AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.status = 'open' AND t.source_key = 'introduction:' || gi.id)
      ORDER BY gi.created_at
      LIMIT 4`,
  ).all(now - 5 * DAY_MS)) as any[];
  for (const intro of staleIntros) {
    const age = days(now, num(intro.created_at));
    actions.push({
      key: `introduction:${intro.id}`,
      severity: "next_up",
      entityLabel: String(intro.target_name),
      entityHref: intro.introducer_type === "instructor" ? `/app/instructors/${intro.introducer_id}` : "/app/growth",
      reason: `Introduction suggested ${age} day${age === 1 ? "" : "s"} ago; no contact recorded.`,
      action: "Follow up on the introduction before it goes cold.",
      ageDays: age,
      ctaLabel: "Open record",
      assignable: true,
    });
  }

  actions.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.ageDays - a.ageDays);
  return actions.slice(0, limit);
}

/* ---------------- leaks ---------------- */

/** Where growth is being lost: each count is a click away from the records. */
export async function getFlywheelLeaks(now = Date.now()): Promise<FlywheelLeak[]> {
  await ensureFlywheelSchema();
  const db = getDb();
  const row = (await db.prepare(
    `SELECT
      (SELECT COUNT(DISTINCT o.student_id) FROM student_program_outcomes o
        WHERE o.outcome_type IN ('completed','graduated')
          AND NOT EXISTS (
            SELECT 1 FROM student_referrals r JOIN students st ON st.id = o.student_id
             WHERE r.referrer_person_id = st.person_id AND r.voided_at IS NULL)
          AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.entity_type = 'student' AND t.entity_id = o.student_id AND t.title = 'Referral invite')
      ) AS students_unprompted,
      (SELECT COUNT(*) FROM classes c LEFT JOIN class_closeouts cc ON cc.class_id = c.id
        WHERE c.status = 'completed' AND COALESCE(cc.testimonial_captured, 0) = 0) AS classes_without_testimonial,
      (SELECT COUNT(*) FROM programs p
        WHERE p.stage = 'completed'
          AND NOT EXISTS (SELECT 1 FROM programs child WHERE child.parent_program_id = p.id)) AS programs_without_renewal,
      (SELECT COUNT(*) FROM instructors i
        WHERE i.stage = 'active'
          AND NOT EXISTS (SELECT 1 FROM growth_introductions gi WHERE gi.introducer_type = 'instructor' AND gi.introducer_id = i.id)
          AND NOT EXISTS (SELECT 1 FROM student_referrals r JOIN growth_contributors gc ON gc.id = r.contributor_id WHERE gc.person_id = i.person_id AND r.voided_at IS NULL)
      ) AS instructors_unactivated,
      (SELECT COUNT(*) FROM demo_requests d WHERE d.dispositioned = 0 AND d.created_at <= ?) AS demos_stale,
      (SELECT COUNT(*) FROM tasks t WHERE t.status = 'open' AND t.created_at <= ?) AS tasks_stale`,
  ).get(now - 3 * DAY_MS, now - 14 * DAY_MS)) as any;

  const leaks: FlywheelLeak[] = [
    { key: "students_unprompted", label: "Completed students never asked to refer", count: num(row?.students_unprompted), href: "/app/students", detail: "Each finished program is a warm referral moment." },
    { key: "classes_without_testimonial", label: "Completed classes with no testimonial", count: num(row?.classes_without_testimonial), href: "/app/classes", detail: "Proof that makes the next sale easier." },
    { key: "programs_without_renewal", label: "Completed programs with no repeat decision", count: num(row?.programs_without_renewal), href: "/app/programs", detail: "A successful partner program should book the next one." },
    { key: "instructors_unactivated", label: "Active instructors with no growth activity", count: num(row?.instructors_unactivated), href: "/app/instructors", detail: "Every strong instructor can open one community." },
    { key: "demos_stale", label: "Partner demo requests going cold", count: num(row?.demos_stale), href: "/app/partners", detail: "Warm inbound older than 3 days." },
    { key: "tasks_stale", label: "Open work items older than 14 days", count: num(row?.tasks_stale), href: "/app/tasks", detail: "Committed actions that quietly stalled." },
  ];
  return leaks.filter((leak) => leak.count > 0);
}

export async function getFlywheelSnapshot(now = Date.now()): Promise<FlywheelSnapshot> {
  const [actions, leaks] = await Promise.all([getGrowthActions(now), getFlywheelLeaks(now)]);
  return { actions, leaks };
}

/* ============================================================
 * Execution core — signal → owned action → outcome → next action.
 * These are the auth-free primitives; app/actions/flywheel.ts wraps
 * them with requireStaff. Kept here so lifecycle tests can drive the
 * exact production logic.
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { TASK_OUTCOMES, type TaskOutcome } from "@/lib/flywheel-shared";

export interface ExecResult {
  ok: boolean;
  error?: string;
  taskId?: string;
  organizationId?: string;
  nextTaskId?: string;
}

function newTaskId(): string {
  return `wrk-${randomUUID().slice(0, 12)}`;
}

async function logCrm(entityType: string, entityId: string, kind: string, body: string, actorUserId: string | null): Promise<void> {
  await getDb().prepare(
    "INSERT INTO crm_activity (id, entity_type, entity_id, kind, body, actor_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(`pfx-${randomUUID().slice(0, 8)}`, entityType, entityId, kind, body, actorUserId, Date.now());
}

interface MaterializeSpec {
  entityType: string;
  entityId: string;
  title: string;
  context: string;
  recommendedAction: string;
}

/** Resolve a derived flywheel action key into a concrete, verified task spec. */
async function resolveActionKey(key: string): Promise<MaterializeSpec | null> {
  const db = getDb();
  const [kind, id] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
  if (!id) return null;
  if (kind === "program-renewal") {
    const row = (await db.prepare(
      "SELECT p.name, o.name AS partner FROM programs p LEFT JOIN organizations o ON o.id = p.partner_org_id WHERE p.id = ?",
    ).get(id)) as any;
    if (!row) return null;
    return {
      entityType: "program", entityId: id,
      title: `Renewal review: ${row.name}`,
      context: `${row.partner ? `${row.partner} — ` : ""}program completed with no repeat discussion recorded.`,
      recommendedAction: "Contact the partner, share the outcome, and propose the next program — or consciously close.",
    };
  }
  if (kind === "closeout") {
    const row = (await db.prepare("SELECT title FROM classes WHERE id = ?").get(id)) as any;
    if (!row) return null;
    return {
      entityType: "class", entityId: id,
      title: `Closeout: ${row.title}`,
      context: "Completed class; the proof checklist (feedback, testimonial, referral prompts) is unfinished.",
      recommendedAction: "Work the closeout checklist on the class page until every item is done.",
    };
  }
  if (kind === "demo") {
    const row = (await db.prepare("SELECT requester_name, org_slug FROM demo_requests WHERE id = ? AND dispositioned = 0").get(id)) as any;
    if (!row) return null;
    return {
      entityType: "organization", entityId: id,
      title: `Reply to demo request: ${row.requester_name}`,
      context: `Inbound demo request via ${row.org_slug}; still undispositioned.`,
      recommendedAction: "Reply, then disposition it on the Partners page: convert to a conversation or close.",
    };
  }
  if (kind === "instructor-activation") {
    const row = (await db.prepare("SELECT p.name FROM instructors i JOIN people p ON p.id = i.person_id WHERE i.id = ?").get(id)) as any;
    if (!row) return null;
    return {
      entityType: "instructor", entityId: id,
      title: `Growth conversation with ${row.name}`,
      context: "Delivered a completed class; no school/community introduction explored yet.",
      recommendedAction: "Ask about one introduction — their school, a club, or a future instructor — and record it on their page.",
    };
  }
  if (kind === "introduction") {
    const row = (await db.prepare("SELECT target_name, introducer_type, introducer_id FROM growth_introductions WHERE id = ?").get(id)) as any;
    if (!row) return null;
    return {
      entityType: row.introducer_type === "instructor" ? "instructor" : "organization",
      entityId: row.introducer_type === "instructor" ? String(row.introducer_id) : id,
      title: `Follow up on introduction: ${row.target_name}`,
      context: "An introduction was suggested but no contact has been recorded.",
      recommendedAction: "Reach out (or nudge the introducer), then mark the introduction contacted on their page.",
    };
  }
  return null;
}

/**
 * Turn a derived flywheel signal into an owned, dated Work item.
 * Dedupe: one open task per source key, ever — assigning twice is a no-op.
 */
export async function materializeGrowthAction(
  viewerId: string,
  key: string,
  ownerUserId: string | null,
  dueOn: string | null,
): Promise<ExecResult> {
  await ensureFlywheelSchema();
  const db = getDb();
  const existing = (await db.prepare("SELECT id FROM tasks WHERE status = 'open' AND source_key = ?").get(key)) as any;
  if (existing) return { ok: true, taskId: String(existing.id) };
  const spec = await resolveActionKey(key);
  if (!spec) return { ok: false, error: "This action can no longer be assigned — the underlying record moved on." };
  const now = Date.now();
  const id = newTaskId();
  await db.prepare(
    `INSERT INTO tasks (id, title, owner_user_id, due_on, status, kind, priority, context, recommended_action, entity_type, entity_id, handoff_to_founder, source_key, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'open', 'follow_up', 'normal', ?, ?, ?, ?, 0, ?, ?, ?)`,
  ).run(id, spec.title, ownerUserId, dueOn, spec.context, spec.recommendedAction, spec.entityType, spec.entityId, key, now, now);
  if (spec.entityType !== "organization" || !key.startsWith("demo:")) {
    await logCrm(spec.entityType, spec.entityId, "assigned", `Growth action assigned: ${spec.title}`, viewerId);
  }
  return { ok: true, taskId: id };
}

const OUTCOME_KEYS = new Set<string>(TASK_OUTCOMES.map((outcome) => outcome.key));
const FOLLOW_UP_DAYS: Partial<Record<TaskOutcome, number>> = {
  contacted: 4,
  no_response: 4,
  interested: 2,
};

function addDays(dateIso: string, daysToAdd: number): string {
  const date = new Date(`${dateIso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}

/**
 * Record a structured outcome on a Work item, then deterministically create
 * the next step: waiting outcomes schedule a dated follow-up on the same
 * entity (carrying the source key so the flywheel doesn't double-surface);
 * closing outcomes end the loop. History lands on the entity's activity feed.
 */
export async function applyTaskOutcome(
  viewerId: string,
  taskId: string,
  outcome: TaskOutcome,
  note: string,
  followUpOn: string | null,
  now = Date.now(),
): Promise<ExecResult> {
  await ensureFlywheelSchema();
  if (!OUTCOME_KEYS.has(outcome)) return { ok: false, error: "Unknown outcome." };
  const db = getDb();
  const task = (await db.prepare("SELECT * FROM tasks WHERE id = ? AND status = 'open'").get(taskId)) as any;
  if (!task) return { ok: false, error: "This Work item is no longer open." };
  const today = new Date(now).toISOString().slice(0, 10);
  const needsDate = outcome === "follow_up_later" || outcome === "meeting_booked";
  if (needsDate && (!followUpOn || followUpOn <= today)) {
    return { ok: false, error: "Pick a future follow-up date for this outcome." };
  }

  const outcomeLabel = TASK_OUTCOMES.find((entry) => entry.key === outcome)!.label;
  await db.prepare(
    "UPDATE tasks SET status = 'done', outcome = ?, completed_at = ?, completion_note = ?, updated_at = ? WHERE id = ?",
  ).run(outcome, now, note || outcomeLabel, now, taskId);
  if (task.entity_type && task.entity_id) {
    await logCrm(String(task.entity_type), String(task.entity_id), "outcome", `${task.title} → ${outcomeLabel}${note ? ` — ${note}` : ""}`, viewerId);
  }

  // Deterministic next step.
  let nextTaskId: string | undefined;
  const waitDays = FOLLOW_UP_DAYS[outcome];
  const nextDue = needsDate ? followUpOn! : waitDays ? addDays(today, waitDays) : null;
  if (nextDue) {
    const nextTitle = outcome === "meeting_booked" ? `Meeting follow-up: ${task.title}` : `Follow up: ${String(task.title).replace(/^(Follow up: |Meeting follow-up: )+/, "")}`;
    const duplicate = (await db.prepare(
      "SELECT id FROM tasks WHERE status = 'open' AND title = ? AND entity_type IS NOT DISTINCT FROM ? AND entity_id IS NOT DISTINCT FROM ?",
    ).get(nextTitle, task.entity_type, task.entity_id)) as any;
    if (!duplicate) {
      nextTaskId = newTaskId();
      await db.prepare(
        `INSERT INTO tasks (id, title, owner_user_id, due_on, status, kind, priority, context, recommended_action, entity_type, entity_id, handoff_to_founder, source_key, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'open', 'follow_up', ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      ).run(
        nextTaskId,
        nextTitle,
        task.owner_user_id,
        nextDue,
        outcome === "meeting_booked" ? "high" : "normal",
        `Previous outcome: ${outcomeLabel}${note ? ` — ${note}` : ""}.`,
        outcome === "meeting_booked"
          ? "Hold the meeting, then record what happened so the relationship keeps moving."
          : "Check for a reply and take the next step; record the outcome either way.",
        task.entity_type,
        task.entity_id,
        task.source_key,
        now,
        now,
      );
    } else {
      nextTaskId = String(duplicate.id);
    }
  }
  return { ok: true, taskId, nextTaskId };
}

/**
 * Zero-loss handoff: a converted introduction becomes a real partner
 * organization plus an owned first-conversation task — no retyping, and the
 * source stays attributed to the introducer.
 */
export async function convertIntroductionCore(
  viewerId: string,
  introId: string,
  organizationName: string,
  organizationType: string,
  now = Date.now(),
): Promise<ExecResult> {
  await ensureFlywheelSchema();
  const db = getDb();
  const intro = (await db.prepare("SELECT * FROM growth_introductions WHERE id = ?").get(introId)) as any;
  if (!intro) return { ok: false, error: "Introduction not found." };
  if (intro.converted_organization_id) return { ok: true, organizationId: String(intro.converted_organization_id) };
  const name = organizationName.trim() || String(intro.target_name);
  if (name.length < 2) return { ok: false, error: "Name the organization." };
  const existingOrg = (await db.prepare("SELECT id FROM organizations WHERE lower(name) = lower(?)").get(name)) as any;
  const organizationId = existingOrg ? String(existingOrg.id) : `org-${randomUUID().slice(0, 12)}`;
  if (!existingOrg) {
    await db.prepare("INSERT INTO organizations (id, name, type, location, status) VALUES (?, ?, ?, '', 'active')").run(
      organizationId, name, organizationType.trim() || "School",
    );
  }
  await db.prepare(
    "UPDATE growth_introductions SET status = 'converted', resolved_at = ?, converted_organization_id = ? WHERE id = ?",
  ).run(now, organizationId, introId);

  const introducerLabel = `${String(intro.introducer_type)} ${String(intro.introducer_id)}`;
  await logCrm("organization", organizationId, "introduction", `Created from an introduction by ${introducerLabel}: ${intro.target_name}`, viewerId);
  if (intro.introducer_type === "instructor" || intro.introducer_type === "student") {
    await logCrm(String(intro.introducer_type), String(intro.introducer_id), "introduction", `Introduction converted: ${name} is now a partner lead.`, viewerId);
  }

  const sourceKey = `intro-convert:${introId}`;
  const open = (await db.prepare("SELECT id FROM tasks WHERE status = 'open' AND source_key = ?").get(sourceKey)) as any;
  let taskId = open ? String(open.id) : undefined;
  if (!taskId) {
    taskId = newTaskId();
    await db.prepare(
      `INSERT INTO tasks (id, title, owner_user_id, due_on, status, kind, priority, context, recommended_action, entity_type, entity_id, handoff_to_founder, source_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'open', 'follow_up', 'high', ?, ?, 'organization', ?, 0, ?, ?, ?)`,
    ).run(
      taskId,
      `Open partnership conversation: ${name}`,
      intro.owner_user_id ?? viewerId,
      addDays(new Date(now).toISOString().slice(0, 10), 3),
      `Warm lead from an introduction (${intro.target_name}). Source attribution is preserved on the organization's history.`,
      "Reach out through the introducer, book the first conversation, and record the outcome.",
      organizationId,
      sourceKey,
      now,
      now,
    );
  }
  return { ok: true, organizationId, taskId };
}

/* ---------------- weekly operating summary ---------------- */

export interface WeeklySummary {
  windowLabel: string;
  created: { newStudents: number; referrals: number; introductionsMade: number; introductionsConverted: number; repeatPrograms: number; demoRequests: number };
  execution: { completed: number; outcomes: Array<{ outcome: string; count: number }>; overdue: number; unowned: number; dueNextWeek: number };
  nextMoves: GrowthAction[];
  leaks: FlywheelLeak[];
}

/** One deterministic founder view: what happened in the last 7 days, what's next. */
export async function getWeeklyOperatingSummary(now = Date.now()): Promise<WeeklySummary> {
  await ensureFlywheelSchema();
  const db = getDb();
  const since = now - 7 * DAY_MS;
  const today = new Date(now).toISOString().slice(0, 10);
  const weekOut = addDays(today, 7);
  const row = (await db.prepare(
    `SELECT
      (SELECT COUNT(*) FROM students WHERE created_at >= ?) AS new_students,
      (SELECT COUNT(*) FROM student_referrals WHERE created_at >= ? AND voided_at IS NULL) AS referrals,
      (SELECT COUNT(*) FROM growth_introductions WHERE created_at >= ?) AS intros_made,
      (SELECT COUNT(*) FROM growth_introductions WHERE resolved_at >= ? AND status = 'converted') AS intros_converted,
      (SELECT COUNT(*) FROM programs WHERE created_at >= ? AND parent_program_id IS NOT NULL) AS repeat_programs,
      (SELECT COUNT(*) FROM demo_requests WHERE created_at >= ?) AS demo_requests,
      (SELECT COUNT(*) FROM tasks WHERE status = 'done' AND completed_at >= ?) AS completed,
      (SELECT COUNT(*) FROM tasks WHERE status = 'open' AND due_on IS NOT NULL AND due_on < ?) AS overdue,
      (SELECT COUNT(*) FROM tasks WHERE status = 'open' AND owner_user_id IS NULL) AS unowned,
      (SELECT COUNT(*) FROM tasks WHERE status = 'open' AND due_on IS NOT NULL AND due_on >= ? AND due_on <= ?) AS due_next_week`,
  ).get(since, since, since, since, since, since, since, today, today, weekOut)) as any;
  const outcomes = (await db.prepare(
    `SELECT outcome, COUNT(*) AS n FROM tasks
      WHERE status = 'done' AND completed_at >= ? AND outcome IS NOT NULL
      GROUP BY outcome ORDER BY n DESC LIMIT 6`,
  ).all(since)) as any[];
  const [nextMoves, leaks] = await Promise.all([getGrowthActions(now, 5), getFlywheelLeaks(now)]);
  return {
    windowLabel: "Last 7 days",
    created: {
      newStudents: num(row?.new_students),
      referrals: num(row?.referrals),
      introductionsMade: num(row?.intros_made),
      introductionsConverted: num(row?.intros_converted),
      repeatPrograms: num(row?.repeat_programs),
      demoRequests: num(row?.demo_requests),
    },
    execution: {
      completed: num(row?.completed),
      outcomes: outcomes.map((entry) => ({ outcome: String(entry.outcome), count: num(entry.n) })),
      overdue: num(row?.overdue),
      unowned: num(row?.unowned),
      dueNextWeek: num(row?.due_next_week),
    },
    nextMoves,
    leaks: leaks.slice(0, 4),
  };
}
