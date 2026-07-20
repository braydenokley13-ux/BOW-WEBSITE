/* ============================================================
 * Growth Management System — deterministic leadership layer.
 *
 * Turns execution data (Work items, outcomes, introductions, programs,
 * referrals, activity) into ranked management interventions, contributor
 * production views, capacity/load, and channel effectiveness.
 *
 * Rules, not scores: every item carries a "Shown because…" explanation
 * traceable to real records, and a stable key so it appears once, can be
 * acted on, and disappears when the underlying condition resolves.
 *
 * Server-only. Do not import from a client component.
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { ensureFlywheelSchema } from "@/lib/flywheel";

const DAY_MS = 24 * 60 * 60 * 1000;

export type IssueLevel = "act_now" | "fix_week" | "watch";

export interface ManagementIssue {
  /** Stable dedupe key — same condition always produces the same key. */
  key: string;
  level: IssueLevel;
  /** What is happening, concretely. */
  title: string;
  /** Why it matters + the deterministic trigger ("Shown because…"). */
  why: string;
  /** Compact evidence, e.g. "9 tasks · oldest 12d". */
  evidence: string;
  href: string;
  /** The recommended intervention, in imperative form. */
  intervention: string;
  /** Machine-executable intervention this issue supports, if any. */
  action?:
    | { kind: "bulk_assign_unowned" }
    | { kind: "rebalance"; fromUserId: string; fromName: string }
    | { kind: "escalate"; entityType: string; entityId: string }
    | { kind: "next_step"; entityType: string; entityId: string };
}

export interface ContributorRow {
  userId: string;
  name: string;
  role: string;
  open: number;
  overdue: number;
  dueThisWeek: number;
  stale: number;
  completed30: number;
  onTimeRate: number | null; // null = no dated completions to judge
  progressions30: number;    // interested / meeting_booked / converted
  conversions30: number;     // outcome = converted
  noResponse30: number;
  introsConverted30: number;
  capacity: "available" | "loaded" | "overloaded";
}

export interface ChannelRow {
  channelId: string;
  name: string;
  category: string;
  leads90: number;
  registrations90: number;
  verified90: number;
  conversionPct: number | null;
  medianDaysToRegistration: number | null;
}

export interface ManagementBriefing {
  issues: ManagementIssue[];
  contributors: ContributorRow[];
  channels: ChannelRow[];
  unattributedStudents90: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function today(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

const LEVEL_ORDER: Record<IssueLevel, number> = { act_now: 0, fix_week: 1, watch: 2 };

/* ---------------- management issues ---------------- */

/**
 * The management queue. Each rule is a plain SQL condition over execution
 * data; thresholds are written into the "why" so nothing is a black box.
 */
export async function getManagementIssues(now = Date.now()): Promise<ManagementIssue[]> {
  await ensureFlywheelSchema();
  const db = getDb();
  const issues: ManagementIssue[] = [];
  const todayIso = today(now);

  // --- Ownership: unowned open growth work.
  const unowned = (await db.prepare(
    "SELECT COUNT(*) AS n, MIN(created_at) AS oldest FROM tasks WHERE status = 'open' AND owner_user_id IS NULL",
  ).get()) as any;
  if (num(unowned?.n) >= 3) {
    const oldestDays = Math.floor((now - num(unowned.oldest)) / DAY_MS);
    issues.push({
      key: "unowned-work",
      level: num(unowned.n) >= 10 || oldestDays >= 7 ? "act_now" : "fix_week",
      title: `${num(unowned.n)} growth actions are unowned`,
      why: `Shown because ${num(unowned.n)} open Work items have no owner (threshold 3); the oldest has waited ${oldestDays} day${oldestDays === 1 ? "" : "s"}. Unowned work is the single most common way growth dies.`,
      evidence: `${num(unowned.n)} tasks · oldest ${oldestDays}d`,
      href: "/app/tasks?view=unowned",
      intervention: "Assign them in bulk to a contributor with capacity.",
      action: { kind: "bulk_assign_unowned" },
    });
  }

  // --- Ownership: founder handoffs waiting past SLA (3 days).
  const handoffs = (await db.prepare(
    "SELECT COUNT(*) AS n, MIN(created_at) AS oldest FROM tasks WHERE status = 'open' AND handoff_to_founder = 1 AND created_at <= ?",
  ).get(now - 3 * DAY_MS)) as any;
  if (num(handoffs?.n) > 0) {
    const oldestDays = Math.floor((now - num(handoffs.oldest)) / DAY_MS);
    issues.push({
      key: "founder-handoff-sla",
      level: "act_now",
      title: `${num(handoffs.n)} founder handoff${num(handoffs.n) === 1 ? "" : "s"} waiting over 3 days`,
      why: `Shown because founder-decision items have been open past the 3-day SLA (oldest ${oldestDays}d). These block contributors who already did their part.`,
      evidence: `${num(handoffs.n)} decisions · oldest ${oldestDays}d`,
      href: "/app/tasks",
      intervention: "Decide them now — each one is a one-click outcome on the Work page.",
    });
  }

  // --- Capacity: overloaded contributors (overdue >= 5 and >= median + 3).
  const loads = (await db.prepare(
    `SELECT t.owner_user_id, u.name, COUNT(*) FILTER (WHERE t.due_on IS NOT NULL AND t.due_on < ?) AS overdue, COUNT(*) AS open
       FROM tasks t JOIN users u ON u.id = t.owner_user_id
      WHERE t.status = 'open' AND t.owner_user_id IS NOT NULL
      GROUP BY t.owner_user_id, u.name`,
  ).all(todayIso)) as any[];
  const overdues = loads.map((row) => num(row.overdue)).sort((a, b) => a - b);
  const median = overdues.length ? overdues[Math.floor(overdues.length / 2)] : 0;
  for (const row of loads) {
    if (num(row.overdue) >= 5 && num(row.overdue) >= median + 3) {
      issues.push({
        key: `overload:${row.owner_user_id}`,
        level: num(row.overdue) >= 10 ? "act_now" : "fix_week",
        title: `${row.name} has ${num(row.overdue)} overdue growth actions`,
        why: `Shown because ${row.name} carries ${num(row.overdue)} overdue items — ${num(row.overdue) - median} more than the team median of ${median}. Overload turns into silent drops.`,
        evidence: `${num(row.overdue)} overdue of ${num(row.open)} open`,
        href: "/app/tasks?view=overdue",
        intervention: "Rebalance the oldest overdue items to someone with capacity, or clear scope with them.",
        action: { kind: "rebalance", fromUserId: String(row.owner_user_id), fromName: String(row.name) },
      });
    }
  }

  // --- Capacity: founder bottleneck.
  const founderShare = (await db.prepare(
    `SELECT
       COUNT(*) FILTER (WHERE u.role = 'admin') AS founder_open,
       COUNT(*) AS total_open,
       (SELECT COUNT(*) FROM users staff
         WHERE staff.status = 'active' AND staff.role = 'growth'
           AND (SELECT COUNT(*) FROM tasks t2 WHERE t2.status = 'open' AND t2.owner_user_id = staff.id) < 3) AS contributors_with_capacity
       FROM tasks t JOIN users u ON u.id = t.owner_user_id
      WHERE t.status = 'open'`,
  ).get()) as any;
  if (num(founderShare?.total_open) >= 8) {
    const pct = Math.round((num(founderShare.founder_open) / num(founderShare.total_open)) * 100);
    if (pct >= 60 && num(founderShare.contributors_with_capacity) >= 1) {
      issues.push({
        key: "founder-bottleneck",
        level: "fix_week",
        title: `Founder owns ${pct}% of open growth work`,
        why: `Shown because the founder owns ${num(founderShare.founder_open)} of ${num(founderShare.total_open)} open items (threshold 60%) while ${num(founderShare.contributors_with_capacity)} contributor${num(founderShare.contributors_with_capacity) === 1 ? " has" : "s have"} fewer than 3 open items. The org only scales past the founder by moving this work.`,
        evidence: `${num(founderShare.founder_open)}/${num(founderShare.total_open)} open items`,
        href: "/app/tasks",
        intervention: "Delegate: reassign founder-owned items that do not require a founder decision.",
        action: { kind: "bulk_assign_unowned" },
      });
    }
  }

  // --- Execution: repeated no-response on the same entity (>= 3) with the loop still open.
  const noResponseLoops = (await db.prepare(
    `SELECT t.entity_type, t.entity_id, COUNT(*) AS n, MAX(t.completed_at) AS last_at
       FROM tasks t
      WHERE t.status = 'done' AND t.outcome = 'no_response' AND t.entity_type IS NOT NULL
      GROUP BY t.entity_type, t.entity_id
     HAVING COUNT(*) >= 3
      ORDER BY n DESC
      LIMIT 5`,
  ).all()) as any[];
  for (const row of noResponseLoops) {
    const open = (await db.prepare(
      "SELECT 1 FROM tasks WHERE status = 'open' AND entity_type = ? AND entity_id = ?",
    ).get(row.entity_type, row.entity_id)) as any;
    const escalated = (await db.prepare(
      "SELECT 1 FROM tasks WHERE source_key = ? AND handoff_to_founder = 1",
    ).get(`escalate:${row.entity_type}:${row.entity_id}`)) as any;
    if (open && !escalated) {
      const label = await entityLabel(String(row.entity_type), String(row.entity_id));
      issues.push({
        key: `no-response:${row.entity_type}:${row.entity_id}`,
        level: "fix_week",
        title: `${label}: ${num(row.n)} no-response attempts, still looping`,
        why: `Shown because this record has ${num(row.n)} "no response" outcomes (threshold 3) and another follow-up is still scheduled. Repeating the same attempt is dead motion — escalate the approach or close it.`,
        evidence: `${num(row.n)} attempts · last ${Math.floor((now - num(row.last_at)) / DAY_MS)}d ago`,
        href: entityHrefFor(String(row.entity_type), String(row.entity_id)),
        intervention: "Escalate to the founder for a different approach, or record a closing outcome.",
        action: { kind: "escalate", entityType: String(row.entity_type), entityId: String(row.entity_id) },
      });
    }
  }

  // --- Conversion: interested but stalled (last outcome 'interested' > 7 days, no open next step).
  const stalledInterested = (await db.prepare(
    `SELECT t.entity_type, t.entity_id, MAX(t.completed_at) AS last_at
       FROM tasks t
      WHERE t.status = 'done' AND t.outcome = 'interested' AND t.entity_type IS NOT NULL
        AND t.completed_at <= ?
        AND NOT EXISTS (SELECT 1 FROM tasks o WHERE o.status = 'open' AND o.entity_type = t.entity_type AND o.entity_id = t.entity_id)
        AND NOT EXISTS (SELECT 1 FROM tasks c WHERE c.status = 'done' AND c.outcome IN ('converted','declined','not_applicable')
                          AND c.entity_type = t.entity_type AND c.entity_id = t.entity_id AND c.completed_at > t.completed_at)
      GROUP BY t.entity_type, t.entity_id
      ORDER BY last_at
      LIMIT 5`,
  ).all(now - 7 * DAY_MS)) as any[];
  for (const row of stalledInterested) {
    const daysStalled = Math.floor((now - num(row.last_at)) / DAY_MS);
    const label = await entityLabel(String(row.entity_type), String(row.entity_id));
    issues.push({
      key: `interested-stalled:${row.entity_type}:${row.entity_id}`,
      level: "act_now",
      title: `${label} said "interested" ${daysStalled} days ago — nothing scheduled`,
      why: `Shown because the last outcome on this record was "interested" ${daysStalled} days ago (threshold 7) and no open follow-up exists. Warm interest is the most expensive thing to lose.`,
      evidence: `interested ${daysStalled}d ago · no next step`,
      href: entityHrefFor(String(row.entity_type), String(row.entity_id)),
      intervention: "Create the next step now and put an owner on it.",
      action: { kind: "next_step", entityType: String(row.entity_type), entityId: String(row.entity_id) },
    });
  }

  // --- Execution: meeting happened but no outcome recorded (meeting follow-up overdue >= 2 days).
  const missedMeetings = (await db.prepare(
    `SELECT t.id, t.title, t.entity_type, t.entity_id, t.due_on
       FROM tasks t
      WHERE t.status = 'open' AND t.title LIKE 'Meeting follow-up:%' AND t.due_on IS NOT NULL AND t.due_on < ?
      ORDER BY t.due_on
      LIMIT 4`,
  ).all(today(now - 2 * DAY_MS))) as any[];
  for (const row of missedMeetings) {
    issues.push({
      key: `meeting-outcome:${row.id}`,
      level: "act_now",
      title: `Meeting outcome never recorded: ${String(row.title).replace("Meeting follow-up: ", "")}`,
      why: `Shown because a meeting follow-up was due ${row.due_on} and is still open 2+ days later. If the meeting happened, its result is currently living in someone's head.`,
      evidence: `due ${row.due_on}`,
      href: "/app/tasks?view=overdue",
      intervention: "Record the meeting outcome so the loop can continue or close.",
    });
  }

  // --- Dead motion: contributor with heavy completed outreach and zero progression (30d).
  const deadMotion = (await db.prepare(
    `SELECT t.owner_user_id, u.name,
            COUNT(*) AS done30,
            COUNT(*) FILTER (WHERE t.outcome IN ('interested','meeting_booked','converted')) AS progressed
       FROM tasks t JOIN users u ON u.id = t.owner_user_id
      WHERE t.status = 'done' AND t.completed_at >= ? AND t.owner_user_id IS NOT NULL
      GROUP BY t.owner_user_id, u.name
     HAVING COUNT(*) >= 8 AND COUNT(*) FILTER (WHERE t.outcome IN ('interested','meeting_booked','converted')) = 0`,
  ).all(now - 30 * DAY_MS)) as any[];
  for (const row of deadMotion) {
    issues.push({
      key: `dead-motion:${row.owner_user_id}`,
      level: "fix_week",
      title: `${row.name}: ${num(row.done30)} actions completed, zero progression`,
      why: `Shown because ${row.name} completed ${num(row.done30)} Work items in 30 days (threshold 8) with no interested/meeting/converted outcome among them. Lots of motion, no progress — the approach or the targets need to change, not the effort.`,
      evidence: `${num(row.done30)} done · 0 progressions in 30d`,
      href: "/app/tasks",
      intervention: "Review their last ten outcomes together and change the play, the list, or the ask.",
    });
  }

  // --- Dead motion: entity accumulating activity with no progression (30d).
  const churningEntities = (await db.prepare(
    `SELECT a.entity_type, a.entity_id, COUNT(*) AS acts
       FROM crm_activity a
      WHERE a.created_at >= ? AND a.entity_type IN ('organization','program','instructor','student')
      GROUP BY a.entity_type, a.entity_id
     HAVING COUNT(*) >= 8
        AND COUNT(*) FILTER (WHERE a.kind = 'outcome' AND (a.body LIKE '%→ Interested%' OR a.body LIKE '%→ Meeting booked%' OR a.body LIKE '%→ Converted%')) = 0
      ORDER BY acts DESC
      LIMIT 3`,
  ).all(now - 30 * DAY_MS)) as any[];
  for (const row of churningEntities) {
    const label = await entityLabel(String(row.entity_type), String(row.entity_id));
    issues.push({
      key: `churn:${row.entity_type}:${row.entity_id}`,
      level: "watch",
      title: `${label}: ${num(row.acts)} activities, no stage movement`,
      why: `Shown because this record accumulated ${num(row.acts)} activities in 30 days (threshold 8) without a single progression outcome. Decide: escalate, change approach, or close.`,
      evidence: `${num(row.acts)} activities · 0 progressions`,
      href: entityHrefFor(String(row.entity_type), String(row.entity_id)),
      intervention: "Make an explicit decision on this record instead of letting activity accumulate.",
      action: { kind: "escalate", entityType: String(row.entity_type), entityId: String(row.entity_id) },
    });
  }

  // --- Conversion: referral leak in aggregate (existing flywheel condition, management framing).
  const referralLeak = (await db.prepare(
    `SELECT COUNT(DISTINCT o.student_id) AS n
       FROM student_program_outcomes o JOIN students st ON st.id = o.student_id
      WHERE o.outcome_type IN ('completed','graduated')
        AND NOT EXISTS (SELECT 1 FROM student_referrals r WHERE r.referrer_person_id = st.person_id AND r.voided_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.entity_type = 'student' AND t.entity_id = o.student_id AND t.title = 'Referral invite')`,
  ).get()) as any;
  if (num(referralLeak?.n) >= 10) {
    issues.push({
      key: "referral-leak",
      level: "act_now",
      title: `${num(referralLeak.n)} completed students never asked for a referral`,
      why: `Shown because ${num(referralLeak.n)} students finished a program with no referral ask and no invite task (threshold 10). This is the cheapest growth BOW is not collecting.`,
      evidence: `${num(referralLeak.n)} students`,
      href: "/app/growth",
      intervention: "Create the referral invites from Growth Actions Today, then assign them.",
    });
  }

  // --- Conversion: introductions made (contacted) but never converted (> 7 days).
  const staleContactedIntros = (await db.prepare(
    `SELECT gi.id, gi.target_name, gi.introducer_type, gi.introducer_id, gi.created_at
       FROM growth_introductions gi
      WHERE gi.status = 'contacted' AND gi.created_at <= ?
        AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.status = 'open' AND t.source_key = 'introduction:' || gi.id)
      ORDER BY gi.created_at
      LIMIT 4`,
  ).all(now - 7 * DAY_MS)) as any[];
  for (const row of staleContactedIntros) {
    const age = Math.floor((now - num(row.created_at)) / DAY_MS);
    issues.push({
      key: `intro-unconverted:${row.id}`,
      level: "fix_week",
      title: `Introduction to ${row.target_name} contacted but never converted`,
      why: `Shown because this introduction has sat in "contacted" for ${age} days (threshold 7) without becoming a partner lead or being declined. Warm doors close quietly.`,
      evidence: `contacted · ${age}d old`,
      href: row.introducer_type === "instructor" ? `/app/instructors/${row.introducer_id}` : "/app/growth",
      intervention: "Convert it to a partner lead on the introducer's page, or decline it explicitly.",
    });
  }

  issues.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  return issues.slice(0, 10);
}

async function entityLabel(entityType: string, entityId: string): Promise<string> {
  const db = getDb();
  try {
    if (entityType === "organization") {
      const row = (await db.prepare("SELECT name FROM organizations WHERE id = ?").get(entityId)) as any;
      return row?.name ?? entityId;
    }
    if (entityType === "program") {
      const row = (await db.prepare("SELECT name FROM programs WHERE id = ?").get(entityId)) as any;
      return row?.name ?? entityId;
    }
    if (entityType === "student") {
      const row = (await db.prepare("SELECT name FROM students WHERE id = ?").get(entityId)) as any;
      return row?.name ?? entityId;
    }
    if (entityType === "instructor") {
      const row = (await db.prepare("SELECT p.name FROM instructors i JOIN people p ON p.id = i.person_id WHERE i.id = ?").get(entityId)) as any;
      return row?.name ?? entityId;
    }
    if (entityType === "class") {
      const row = (await db.prepare("SELECT title FROM classes WHERE id = ?").get(entityId)) as any;
      return row?.title ?? entityId;
    }
  } catch {
    /* fall through */
  }
  return entityId;
}

function entityHrefFor(entityType: string, entityId: string): string {
  if (entityType === "organization") return `/app/partners/${entityId}`;
  if (entityType === "program") return `/app/programs/${entityId}`;
  if (entityType === "student") return `/app/students/${entityId}`;
  if (entityType === "instructor") return `/app/instructors/${entityId}`;
  if (entityType === "class") return `/app/classes/${entityId}`;
  return "/app/tasks";
}

/* ---------------- contributor performance + capacity ---------------- */

/**
 * Per-contributor production view. Activity, progression, downstream
 * outcomes, and reliability are shown side by side — deliberately NOT
 * combined into one number, because 30 completions with zero conversions
 * and 6 completions with 2 partners are not comparable on one axis.
 */
export async function getContributorPerformance(now = Date.now()): Promise<ContributorRow[]> {
  await ensureFlywheelSchema();
  const db = getDb();
  const todayIso = today(now);
  const weekOut = new Date(now + 7 * DAY_MS).toISOString().slice(0, 10);
  const rows = (await db.prepare(
    `SELECT u.id, u.name, u.role,
            COUNT(t.id) FILTER (WHERE t.status = 'open') AS open,
            COUNT(t.id) FILTER (WHERE t.status = 'open' AND t.due_on IS NOT NULL AND t.due_on < ?) AS overdue,
            COUNT(t.id) FILTER (WHERE t.status = 'open' AND t.due_on >= ? AND t.due_on <= ?) AS due_week,
            COUNT(t.id) FILTER (WHERE t.status = 'open' AND t.created_at <= ? AND t.due_on IS NULL) AS stale,
            COUNT(t.id) FILTER (WHERE t.status = 'done' AND t.completed_at >= ?) AS completed30,
            COUNT(t.id) FILTER (WHERE t.status = 'done' AND t.completed_at >= ? AND t.due_on IS NOT NULL) AS dated_done30,
            COUNT(t.id) FILTER (WHERE t.status = 'done' AND t.completed_at >= ? AND t.due_on IS NOT NULL
                                  AND t.completed_at <= (EXTRACT(EPOCH FROM (t.due_on::date + 1)) * 1000)) AS on_time30,
            COUNT(t.id) FILTER (WHERE t.status = 'done' AND t.completed_at >= ? AND t.outcome IN ('interested','meeting_booked','converted')) AS progressions30,
            COUNT(t.id) FILTER (WHERE t.status = 'done' AND t.completed_at >= ? AND t.outcome = 'converted') AS conversions30,
            COUNT(t.id) FILTER (WHERE t.status = 'done' AND t.completed_at >= ? AND t.outcome = 'no_response') AS no_response30,
            (SELECT COUNT(*) FROM growth_introductions gi
              WHERE gi.owner_user_id = u.id AND gi.status = 'converted' AND gi.resolved_at >= ?) AS intros_converted30
       FROM users u
       LEFT JOIN tasks t ON t.owner_user_id = u.id
      WHERE u.status = 'active' AND u.role IN ('admin','growth')
      GROUP BY u.id, u.name, u.role
      ORDER BY u.role, u.name`,
  ).all(
    todayIso, todayIso, weekOut, now - 14 * DAY_MS,
    now - 30 * DAY_MS, now - 30 * DAY_MS, now - 30 * DAY_MS,
    now - 30 * DAY_MS, now - 30 * DAY_MS, now - 30 * DAY_MS, now - 30 * DAY_MS,
  )) as any[];
  return rows.map((row) => {
    const open = num(row.open);
    const overdue = num(row.overdue);
    const datedDone = num(row.dated_done30);
    return {
      userId: String(row.id),
      name: String(row.name),
      role: String(row.role),
      open,
      overdue,
      dueThisWeek: num(row.due_week),
      stale: num(row.stale),
      completed30: num(row.completed30),
      onTimeRate: datedDone > 0 ? Math.round((num(row.on_time30) / datedDone) * 100) : null,
      progressions30: num(row.progressions30),
      conversions30: num(row.conversions30),
      noResponse30: num(row.no_response30),
      introsConverted30: num(row.intros_converted30),
      // Deterministic, visible thresholds: overloaded = 5+ overdue or 15+ open; available = < 3 open.
      capacity: overdue >= 5 || open >= 15 ? "overloaded" : open < 3 ? "available" : "loaded",
    };
  });
}

/* ---------------- channel effectiveness ---------------- */

/** 90-day channel view: volume in → progression → conversion, honestly attributed. */
export async function getChannelEffectiveness(now = Date.now()): Promise<{ channels: ChannelRow[]; unattributed90: number }> {
  const db = getDb();
  const startIso = new Date(now - 90 * DAY_MS).toISOString().slice(0, 10);
  const rows = (await db.prepare(
    `SELECT ch.id, ch.name, ch.category,
            COUNT(DISTINCT t.id) AS leads,
            COUNT(DISTINCT ce.student_id) AS registrations,
            COUNT(DISTINCT vr.student_id) AS verified,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY (ce.enrolled_at - t.occurred_at) / 86400000.0)
              FILTER (WHERE ce.enrolled_at IS NOT NULL AND ce.enrolled_at >= t.occurred_at) AS median_days
       FROM growth_channels ch
       LEFT JOIN student_acquisition_touchpoints t ON t.channel_id = ch.id AND t.voided_at IS NULL AND t.occurred_on >= ?
       LEFT JOIN student_acquisition_attributions a ON a.touchpoint_id = t.id AND a.effective_to IS NULL
       LEFT JOIN class_enrollments ce ON ce.student_id = a.student_id
       LEFT JOIN (
         SELECT DISTINCT ar.student_id
           FROM attendance_records ar
           JOIN class_session_reports sr ON sr.session_id = ar.session_id AND sr.completed = 1
          WHERE ar.status IN ('present','late')
       ) vr ON vr.student_id = a.student_id
      GROUP BY ch.id, ch.name, ch.category
      ORDER BY leads DESC, ch.name`,
  ).all(startIso)) as any[];
  const unattributed = (await db.prepare(
    `SELECT COUNT(*) AS n FROM students s
      WHERE s.created_at >= ?
        AND NOT EXISTS (SELECT 1 FROM student_acquisition_attributions a WHERE a.student_id = s.id AND a.effective_to IS NULL)`,
  ).get(now - 90 * DAY_MS)) as any;
  return {
    channels: rows
      .map((row) => ({
        channelId: String(row.id),
        name: String(row.name),
        category: String(row.category),
        leads90: num(row.leads),
        registrations90: num(row.registrations),
        verified90: num(row.verified),
        conversionPct: num(row.leads) > 0 ? Math.round((num(row.registrations) / num(row.leads)) * 100) : null,
        medianDaysToRegistration: row.median_days == null ? null : Math.round(Number(row.median_days)),
      }))
      .filter((row) => row.leads90 > 0),
    unattributed90: num(unattributed?.n),
  };
}

/* ---------------- interventions (auth-free cores) ---------------- */

export interface InterventionResult {
  ok: boolean;
  error?: string;
  count?: number;
  taskId?: string;
}

/** Bulk-assign unowned open work to one contributor. Capped; returns exact count. */
export async function bulkAssignUnownedCore(
  viewerId: string,
  ownerUserId: string,
  limit = 25,
  now = Date.now(),
): Promise<InterventionResult> {
  await ensureFlywheelSchema();
  const db = getDb();
  const owner = (await db.prepare("SELECT id FROM users WHERE id = ? AND status = 'active'").get(ownerUserId)) as any;
  if (!owner) return { ok: false, error: "Pick an active owner." };
  const capped = Math.max(1, Math.min(50, limit));
  const result = await db.prepare(
    `UPDATE tasks SET owner_user_id = ?, updated_at = ?
      WHERE id IN (SELECT id FROM tasks WHERE status = 'open' AND owner_user_id IS NULL ORDER BY created_at LIMIT ${capped})`,
  ).run(ownerUserId, now);
  return { ok: true, count: result.changes };
}

/** Move the oldest overdue items from one contributor to another. */
export async function rebalanceWorkCore(
  viewerId: string,
  fromUserId: string,
  toUserId: string,
  limit = 10,
  now = Date.now(),
): Promise<InterventionResult> {
  await ensureFlywheelSchema();
  const db = getDb();
  if (fromUserId === toUserId) return { ok: false, error: "Pick two different people." };
  const target = (await db.prepare("SELECT id FROM users WHERE id = ? AND status = 'active'").get(toUserId)) as any;
  if (!target) return { ok: false, error: "Pick an active owner." };
  const capped = Math.max(1, Math.min(25, limit));
  const todayIso = today(now);
  const result = await db.prepare(
    `UPDATE tasks SET owner_user_id = ?, updated_at = ?
      WHERE id IN (
        SELECT id FROM tasks
         WHERE status = 'open' AND owner_user_id = ? AND handoff_to_founder = 0
           AND due_on IS NOT NULL AND due_on < ?
         ORDER BY due_on LIMIT ${capped})`,
  ).run(toUserId, now, fromUserId, todayIso);
  return { ok: true, count: result.changes };
}

/** Escalate a stuck record to the founder queue (deduped by stable key). */
export async function escalateToFounderCore(
  viewerId: string,
  entityType: string,
  entityId: string,
  reason: string,
  now = Date.now(),
): Promise<InterventionResult> {
  await ensureFlywheelSchema();
  const db = getDb();
  const sourceKey = `escalate:${entityType}:${entityId}`;
  const existing = (await db.prepare("SELECT id FROM tasks WHERE status = 'open' AND source_key = ?").get(sourceKey)) as any;
  if (existing) return { ok: true, taskId: String(existing.id) };
  const label = await entityLabel(entityType, entityId);
  const id = `wrk-${randomUUID().slice(0, 12)}`;
  await db.prepare(
    `INSERT INTO tasks (id, title, owner_user_id, due_on, status, kind, priority, context, recommended_action, entity_type, entity_id, handoff_to_founder, source_key, created_at, updated_at)
     VALUES (?, ?, NULL, NULL, 'open', 'decision', 'high', ?, 'Decide: change the approach, reassign, or close this record explicitly.', ?, ?, 1, ?, ?, ?)`,
  ).run(id, `Escalation: ${label}`, reason || "Escalated from the management queue.", entityType, entityId, sourceKey, now, now);
  await getDb().prepare(
    "INSERT INTO crm_activity (id, entity_type, entity_id, kind, body, actor_user_id, created_at) VALUES (?, ?, ?, 'escalation', ?, ?, ?)",
  ).run(`pfx-${randomUUID().slice(0, 8)}`, entityType, entityId, `Escalated to founder: ${reason || "management queue"}`, viewerId, now);
  return { ok: true, taskId: id };
}

/** Create the missing next step on a stalled warm record (deduped). */
export async function createNextStepCore(
  viewerId: string,
  entityType: string,
  entityId: string,
  ownerUserId: string | null,
  now = Date.now(),
): Promise<InterventionResult> {
  await ensureFlywheelSchema();
  const db = getDb();
  const sourceKey = `nextstep:${entityType}:${entityId}`;
  const existing = (await db.prepare(
    "SELECT id FROM tasks WHERE status = 'open' AND entity_type = ? AND entity_id = ?",
  ).get(entityType, entityId)) as any;
  if (existing) return { ok: true, taskId: String(existing.id) };
  const label = await entityLabel(entityType, entityId);
  const id = `wrk-${randomUUID().slice(0, 12)}`;
  await db.prepare(
    `INSERT INTO tasks (id, title, owner_user_id, due_on, status, kind, priority, context, recommended_action, entity_type, entity_id, handoff_to_founder, source_key, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'open', 'follow_up', 'high', 'This record showed warm interest and had no scheduled next step; created from the management queue.', 'Re-engage while the interest is warm, then record the outcome.', ?, ?, 0, ?, ?, ?)`,
  ).run(id, `Re-engage: ${label}`, ownerUserId, today(now + 2 * DAY_MS), entityType, entityId, sourceKey, now, now);
  return { ok: true, taskId: id };
}

/* ---------------- briefing bundle ---------------- */

export async function getManagementBriefing(now = Date.now()): Promise<ManagementBriefing> {
  const [issues, contributors, channelData] = await Promise.all([
    getManagementIssues(now),
    getContributorPerformance(now),
    getChannelEffectiveness(now),
  ]);
  return { issues, contributors, channels: channelData.channels, unattributedStudents90: channelData.unattributed90 };
}
