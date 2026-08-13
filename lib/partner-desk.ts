/* ============================================================
 * Partners — the relationship surface.
 *
 * One question: who do I need to follow up with. Everything on this surface
 * is read from systems that already exist —
 *
 *   organizations         the partner record and its lifecycle status
 *   organization_people   who the people are
 *   crm_activity          notes and history
 *   tasks kind='follow_up' the next thing somebody promised to do
 *   inquiries             the public partner form
 *   demo_requests         the "Request a demo" form on a partner page
 *
 * — and nothing here writes a second copy of any of it. This is not a CRM; a
 * CRM would need stages, probabilities and a pipeline, and BOW does not have
 * a pipeline, it has a handful of schools and a founder who needs to remember
 * to call them.
 *
 * Server-only. Browser-safe types and language live in
 * lib/partner-desk-shared.ts.
 * ============================================================ */

import { getDb } from "@/lib/db";
import { canonicalDateInZone, DEFAULT_TIME_ZONE } from "@/lib/timezone";
import {
  resolveStanding,
  sortInbox,
  standingSentence,
  type InboxItem,
  type PartnerActivityLine,
  type PartnerContact,
  type PartnerFollowUp,
  type PartnerProgramLine,
  type PartnerRecord,
  type PartnerRow,
} from "@/lib/partner-desk-shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Stages that mean a Program is finished rather than in flight. */
const FINISHED_STAGES = ["completed", "renewal_review", "renewed", "closed"];

function daysBetween(fromEpoch: number, now: number): number {
  return Math.floor((now - fromEpoch) / DAY_MS);
}

/** Days from today to a canonical date. Positive when the date has passed. */
function daysPastDue(dueOn: string, today: string): number {
  const due = Date.parse(`${dueOn}T12:00:00Z`);
  const now = Date.parse(`${today}T12:00:00Z`);
  if (Number.isNaN(due) || Number.isNaN(now)) return 0;
  return Math.round((now - due) / DAY_MS);
}

function toFollowUp(row: any, today: string): PartnerFollowUp {
  const dueOn = row.due_on ?? null;
  return {
    taskId: row.id,
    title: row.title,
    dueOn,
    overdue: Boolean(dueOn && dueOn < today),
    dueToday: dueOn === today,
  };
}

function trim(value: string | null | undefined, max = 120): string | null {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/* ===================================================================== */
/* The inbox                                                             */
/* ===================================================================== */

/**
 * Everything waiting on a person, in one list.
 *
 * Three sources, one shape. A school that filled in the public form, a demo
 * request from a partner landing page, and a follow-up somebody already
 * committed to are all the same job — reply to a human — so splitting them
 * across three surfaces only means one of the three gets forgotten.
 */
export async function getPartnerInbox(now = Date.now()): Promise<InboxItem[]> {
  const db = getDb();
  const today = canonicalDateInZone(now, DEFAULT_TIME_ZONE);

  const followUps = (await db
    .prepare(
      `SELECT t.id, t.title, t.due_on, t.context, t.entity_id, o.name AS org_name
         FROM tasks t
         LEFT JOIN organizations o ON o.id = t.entity_id
        WHERE t.status = 'open'
          AND t.kind = 'follow_up'
          AND t.entity_type = 'organization'
        ORDER BY t.due_on NULLS LAST, t.created_at`,
    )
    .all()) as any[];

  const inquiries = (await db
    .prepare(
      `SELECT i.id, i.name, i.email, i.org_name, i.summary, i.message, i.type,
              i.status, i.organization_id, i.submitted_at, i.created_at,
              o.name AS linked_org_name
         FROM inquiries i
         LEFT JOIN organizations o ON o.id = i.organization_id
        WHERE i.status IN ('new', 'reviewing')
        ORDER BY COALESCE(i.submitted_at, i.created_at)`,
    )
    .all()) as any[];

  const demoRequests = (await db
    .prepare(
      `SELECT d.id, d.org_slug, d.requester_name, d.requester_email, d.message, d.created_at,
              p.name AS partner_name
         FROM demo_requests d
         LEFT JOIN partner_orgs p ON p.slug = d.org_slug
        WHERE d.dispositioned = 0
        ORDER BY d.created_at`,
    )
    .all()
    .catch(() => [])) as any[];

  const items: InboxItem[] = [
    ...followUps
      // A follow-up dated in the future is a plan, not an inbox item. It shows
      // on the partner's row instead, so the inbox stays things that are late.
      .filter((row) => !row.due_on || row.due_on <= today)
      .map((row) => ({
        key: `follow-up:${row.id}`,
        kind: "follow_up" as const,
        who: row.org_name ?? "Unlinked follow-up",
        org: row.org_name ?? null,
        organizationId: row.entity_id ?? null,
        said: trim(row.title, 140),
        at: row.due_on ? Date.parse(`${row.due_on}T12:00:00Z`) : now,
        waitingDays: row.due_on ? daysPastDue(row.due_on, today) : 0,
        email: null,
        href: row.entity_id ? `/app/partners/${row.entity_id}` : null,
        inquiryId: null,
        demoRequestId: null,
        taskId: row.id,
        dueOn: row.due_on ?? null,
      })),
    ...inquiries.map((row) => {
      const at = Number(row.submitted_at ?? row.created_at ?? now);
      return {
        key: `inquiry:${row.id}`,
        kind: "inquiry" as const,
        who: row.name || row.email || "Someone",
        org: row.linked_org_name ?? row.org_name ?? null,
        organizationId: row.organization_id ?? null,
        said: trim(row.summary || row.message, 160),
        at,
        waitingDays: daysBetween(at, now),
        email: row.email ?? null,
        href: row.organization_id ? `/app/partners/${row.organization_id}` : null,
        inquiryId: row.id as string,
        demoRequestId: null,
        taskId: null,
        dueOn: null,
      };
    }),
    ...(demoRequests ?? []).map((row) => {
      const at = Number(row.created_at ?? now);
      return {
        key: `demo:${row.id}`,
        kind: "demo_request" as const,
        who: row.requester_name || row.requester_email || "Someone",
        org: row.partner_name ?? row.org_slug ?? null,
        // demo_requests reach partner_orgs (the marketing microsite), which is
        // joined to organizations only by name. That match is not good enough
        // to hang a link off, so this stays unlinked until somebody converts it.
        organizationId: null,
        said: trim(row.message, 160),
        at,
        waitingDays: daysBetween(at, now),
        email: row.requester_email ?? null,
        href: null,
        inquiryId: null,
        demoRequestId: row.id as string,
        taskId: null,
        dueOn: null,
      };
    }),
  ];

  return sortInbox(items);
}

/* ===================================================================== */
/* The partner list                                                      */
/* ===================================================================== */

/** Organizations that are BOW itself rather than a partner it works with. */
function isInternal(row: { id: string; type: string }): boolean {
  return row.type.trim().toLowerCase() === "bow";
}

export async function listPartners(now = Date.now()): Promise<PartnerRow[]> {
  const db = getDb();
  const today = canonicalDateInZone(now, DEFAULT_TIME_ZONE);

  const orgs = (await db
    .prepare(
      `SELECT o.id, o.name, o.type, o.location, o.status,
              (SELECT COUNT(*) FROM programs p
                WHERE p.partner_org_id = o.id AND p.stage NOT IN ('completed','renewal_review','renewed','closed')) AS running_programs,
              (SELECT COUNT(*) FROM programs p
                WHERE p.partner_org_id = o.id AND p.stage IN ('completed','renewal_review','renewed','closed')) AS finished_programs,
              (SELECT COUNT(*) FROM classes c
                LEFT JOIN programs cp ON cp.id = c.program_id
                WHERE c.status IN ('active','paused')
                  AND (c.partner_org_id = o.id OR cp.partner_org_id = o.id)) AS running_classes,
              (SELECT COUNT(*) FROM inquiries i
                WHERE i.organization_id = o.id AND i.status IN ('new','reviewing')) AS waiting,
              (SELECT a.created_at FROM crm_activity a
                WHERE a.entity_type = 'organization' AND a.entity_id = o.id
                ORDER BY a.created_at DESC LIMIT 1) AS last_touch_at,
              (SELECT a.body FROM crm_activity a
                WHERE a.entity_type = 'organization' AND a.entity_id = o.id
                ORDER BY a.created_at DESC LIMIT 1) AS last_touch
         FROM organizations o
        ORDER BY o.name`,
    )
    .all()) as any[];

  const followUps = (await db
    .prepare(
      `SELECT t.id, t.title, t.due_on, t.entity_id
         FROM tasks t
        WHERE t.status = 'open' AND t.kind = 'follow_up' AND t.entity_type = 'organization'
        ORDER BY t.due_on NULLS LAST, t.created_at`,
    )
    .all()) as any[];

  const nextByOrg = new Map<string, any>();
  for (const row of followUps) if (!nextByOrg.has(row.entity_id)) nextByOrg.set(row.entity_id, row);

  return orgs
    .filter((row) => !isInternal(row))
    .map((row) => {
      const { standing, label } = resolveStanding({
        status: row.status,
        runningPrograms: Number(row.running_programs ?? 0),
        runningClasses: Number(row.running_classes ?? 0),
        finishedPrograms: Number(row.finished_programs ?? 0),
      });
      const next = nextByOrg.get(row.id);
      return {
        id: row.id,
        name: row.name,
        type: row.type,
        location: (row.location ?? "").trim() || null,
        status: row.status,
        standing,
        standingLabel: label,
        nextFollowUp: next ? toFollowUp(next, today) : null,
        lastTouchAt: row.last_touch_at != null ? Number(row.last_touch_at) : null,
        lastTouch: trim(row.last_touch, 90),
        runningClasses: Number(row.running_classes ?? 0),
        waiting: Number(row.waiting ?? 0),
      };
    });
}

/* ===================================================================== */
/* One partner                                                           */
/* ===================================================================== */

export async function getPartnerRecord(organizationId: string, now = Date.now()): Promise<PartnerRecord | null> {
  const db = getDb();
  const today = canonicalDateInZone(now, DEFAULT_TIME_ZONE);

  const org = (await db
    .prepare("SELECT id, name, type, location, status FROM organizations WHERE id = ?")
    .get(organizationId)) as any;
  if (!org) return null;

  const [programRows, contactRows, activityRows, followUpRows, inquiryRows] = await Promise.all([
    db
      .prepare(
        `SELECT p.id, p.name, p.stage, p.start_date,
                (SELECT COUNT(*) FROM classes c WHERE c.program_id = p.id AND c.status NOT IN ('cancelled')) AS classes,
                (SELECT COUNT(*) FROM class_enrollments ce
                   JOIN classes c2 ON c2.id = ce.class_id
                  WHERE c2.program_id = p.id AND ce.status = 'enrolled') AS students
           FROM programs p
          WHERE p.partner_org_id = ?
          ORDER BY p.start_date DESC NULLS LAST, p.updated_at DESC`,
      )
      .all(organizationId) as Promise<any[]>,
    db
      .prepare(
        `SELECT p.id, p.name, p.email, p.phone,
                group_concat(DISTINCT op.relationship_type) AS roles,
                max(op.is_primary) AS is_primary
           FROM organization_people op
           JOIN people p ON p.id = op.person_id
          WHERE op.organization_id = ? AND op.active = 1
          GROUP BY p.id, p.name, p.email, p.phone
          ORDER BY max(op.is_primary) DESC, p.name`,
      )
      .all(organizationId) as Promise<any[]>,
    db
      .prepare(
        `SELECT a.id, a.kind, a.body, a.created_at, u.name AS actor
           FROM crm_activity a
           LEFT JOIN users u ON u.id = a.actor_user_id
          WHERE a.entity_type = 'organization' AND a.entity_id = ?
          ORDER BY a.created_at DESC
          LIMIT 40`,
      )
      .all(organizationId) as Promise<any[]>,
    db
      .prepare(
        `SELECT id, title, due_on
           FROM tasks
          WHERE status = 'open' AND kind = 'follow_up' AND entity_type = 'organization' AND entity_id = ?
          ORDER BY due_on NULLS LAST, created_at`,
      )
      .all(organizationId) as Promise<any[]>,
    db
      .prepare(
        `SELECT i.id, i.name, i.email, i.summary, i.message, i.status, i.submitted_at, i.created_at
           FROM inquiries i
          WHERE i.organization_id = ? AND i.status IN ('new','reviewing')
          ORDER BY COALESCE(i.submitted_at, i.created_at)`,
      )
      .all(organizationId) as Promise<any[]>,
  ]);

  const programs: PartnerProgramLine[] = programRows.map((row) => {
    const finished = FINISHED_STAGES.includes(row.stage);
    return {
      id: row.id,
      name: row.name,
      stage: row.stage,
      stageLabel: finished ? "Finished" : row.stage === "active" ? "Running" : "Getting ready",
      running: !finished,
      classes: Number(row.classes ?? 0),
      students: Number(row.students ?? 0),
      startDate: row.start_date ?? null,
    };
  });

  const contacts: PartnerContact[] = contactRows.map((row) => {
    // A deleted account leaves its relationship row behind. Saying so is
    // better than printing "Deleted Account" as if it were somebody to call.
    const gone =
      (row.name ?? "").trim().toLowerCase() === "deleted account"
      || (row.email ?? "").trim().toLowerCase().endsWith("@deleted.invalid");
    return {
      personId: row.id,
      name: gone ? "Contact no longer available" : row.name,
      email: gone ? null : (row.email ?? null),
      phone: gone ? null : ((row.phone ?? "").trim() || null),
      roles: String(row.roles ?? "")
        .split(",")
        .map((role) => role.trim().replace(/_/g, " "))
        .filter(Boolean),
      primary: Number(row.is_primary ?? 0) === 1,
    };
  });

  const runningClasses = (
    (await db
      .prepare(
        `SELECT COUNT(*) AS n
           FROM classes c
           LEFT JOIN programs p ON p.id = c.program_id
          WHERE c.status IN ('active','paused')
            AND (c.partner_org_id = ? OR p.partner_org_id = ?)`,
      )
      .get(organizationId, organizationId)) as any
  )?.n ?? 0;

  const { standing, label } = resolveStanding({
    status: org.status,
    runningPrograms: programs.filter((p) => p.running).length,
    runningClasses: Number(runningClasses),
    finishedPrograms: programs.filter((p) => !p.running).length,
  });

  const followUps = followUpRows.map((row) => toFollowUp(row, today));

  const inbox: InboxItem[] = inquiryRows.map((row) => {
    const at = Number(row.submitted_at ?? row.created_at ?? now);
    return {
      key: `inquiry:${row.id}`,
      kind: "inquiry" as const,
      who: row.name || row.email || "Someone",
      org: org.name,
      organizationId: org.id,
      said: trim(row.summary || row.message, 200),
      at,
      waitingDays: daysBetween(at, now),
      email: row.email ?? null,
      href: null,
      inquiryId: row.id as string,
      demoRequestId: null,
      taskId: null,
      dueOn: null,
    };
  });

  const activity: PartnerActivityLine[] = activityRows.map((row) => ({
    id: row.id,
    kind: row.kind,
    body: row.body ?? "",
    at: Number(row.created_at),
    actor: row.actor ?? null,
  }));

  return {
    now,
    id: org.id,
    name: org.name,
    type: org.type,
    location: (org.location ?? "").trim() || null,
    status: org.status,
    standing,
    standingLabel: label,
    standingLine: standingSentence({
      standing,
      runningClasses: Number(runningClasses),
      finishedPrograms: programs.filter((p) => !p.running).length,
      nextFollowUp: followUps[0] ?? null,
    }),
    nextFollowUp: followUps[0] ?? null,
    laterFollowUps: followUps.slice(1),
    contacts,
    programs,
    activity,
    inbox,
  };
}

/** Partners an operator can attach an inquiry to. Explicit choice, never a name match. */
export async function listPartnerChoices(): Promise<{ id: string; name: string; location: string | null }[]> {
  const rows = (await getDb()
    .prepare("SELECT id, name, type, location FROM organizations ORDER BY name")
    .all()) as any[];
  return rows
    .filter((row) => !isInternal(row))
    .map((row) => ({ id: row.id, name: row.name, location: (row.location ?? "").trim() || null }));
}
