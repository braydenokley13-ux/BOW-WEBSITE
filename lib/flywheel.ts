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

/** Idempotent — safe on every boot; the only DDL the flywheel needs. */
export function ensureFlywheelSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getDb();
      await db.exec(`CREATE TABLE IF NOT EXISTS class_closeouts (
        class_id text PRIMARY KEY,
        attendance_finalized double precision NOT NULL DEFAULT 0,
        feedback_collected double precision NOT NULL DEFAULT 0,
        testimonial_captured double precision NOT NULL DEFAULT 0,
        referrals_prompted double precision NOT NULL DEFAULT 0,
        partner_followed_up double precision NOT NULL DEFAULT 0,
        repeat_planned double precision NOT NULL DEFAULT 0,
        instructor_followed_up double precision NOT NULL DEFAULT 0,
        asset_captured double precision NOT NULL DEFAULT 0,
        note text NOT NULL DEFAULT '',
        completed_at double precision,
        updated_at double precision NOT NULL
      )`);
      await db.exec(`CREATE TABLE IF NOT EXISTS growth_introductions (
        id text PRIMARY KEY,
        introducer_type text NOT NULL CHECK (introducer_type IN ('instructor','student','partner','contributor')),
        introducer_id text NOT NULL,
        target_kind text NOT NULL CHECK (target_kind IN ('student','instructor','partner','community')),
        target_name text NOT NULL,
        status text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','contacted','converted','declined')),
        note text NOT NULL DEFAULT '',
        owner_user_id text,
        created_at double precision NOT NULL,
        resolved_at double precision
      )`);
      await db.exec(
        "CREATE INDEX IF NOT EXISTS idx_growth_intros_introducer ON growth_introductions (introducer_type, introducer_id)",
      );
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
            t.handoff_to_founder, t.created_at
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
      reason: task.due_on ? `Due ${task.due_on}.` : "Handed to the founder.",
      action: task.recommended_action || "Complete this task.",
      ageDays: days(now, num(task.created_at)),
      ctaLabel: "Open Work",
      taskId: String(task.id),
    });
  }

  // 2. Completed programs with no renewal decision and no child (repeat) program.
  const staleCompletedPrograms = (await db.prepare(
    `SELECT p.id, p.name, p.updated_at, o.name AS partner_name
       FROM programs p
       LEFT JOIN organizations o ON o.id = p.partner_org_id
      WHERE p.stage = 'completed'
        AND NOT EXISTS (SELECT 1 FROM programs child WHERE child.parent_program_id = p.id)
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
    });
  }

  // 3. Completed classes whose closeout has not been finished.
  const openCloseouts = (await db.prepare(
    `SELECT c.id, c.title, c.updated_at
       FROM classes c
       LEFT JOIN class_closeouts cc ON cc.class_id = c.id
      WHERE c.status = 'completed' AND (cc.class_id IS NULL OR cc.completed_at IS NULL)
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
    });
  }

  // 7. Introductions stuck in "suggested" — someone said they'd connect us.
  const staleIntros = (await db.prepare(
    `SELECT gi.id, gi.target_name, gi.target_kind, gi.introducer_type, gi.introducer_id, gi.created_at
       FROM growth_introductions gi
      WHERE gi.status = 'suggested' AND gi.created_at <= ?
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
