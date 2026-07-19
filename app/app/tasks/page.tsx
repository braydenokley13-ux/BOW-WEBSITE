import Link from "next/link";
import { Badge, SectionHeader } from "@/components/ds";
import { listStaffUsers, resolveUserNames } from "@/lib/hiring";
import { getDb } from "@/lib/db";
import { entityHref } from "@/lib/routes";
import WorkItemActions from "@/components/app/tasks/WorkItemActions";
import CreateWorkForm from "@/components/app/tasks/CreateWorkForm";
import { requireStaff } from "@/lib/dal";
import { addCanonicalDays, canonicalDateInZone, formatCanonicalDate } from "@/lib/timezone";

const DAY_MS = 24 * 60 * 60 * 1000;
const cardStyle = {
  background: "var(--bow-white)",
  border: "1px solid var(--border-rule)",
  borderRadius: 6,
} as const;
const labelStyle = {
  fontFamily: "var(--font-data)",
  fontSize: 10,
  letterSpacing: "0.09em",
  textTransform: "uppercase" as const,
  color: "var(--bow-slate)",
};
const bodyStyle = {
  fontFamily: "var(--font-interface)",
  fontSize: 13.5,
  lineHeight: 1.5,
  color: "var(--bow-slate)",
} as const;

interface TaskRow {
  id: string;
  title: string;
  owner_user_id: string | null;
  due_at: number | null;
  due_on: string | null;
  status: "open" | "done";
  kind: string;
  priority: string;
  context: string | null;
  recommended_action: string | null;
  entity_type: string | null;
  entity_id: string | null;
  handoff_to_founder: number;
  completed_at: number | null;
  completion_note: string | null;
  created_at: number;
  updated_at: number;
}

interface WorkItem {
  id: string;
  title: string;
  ownerUserId: string | null;
  dueAt: number | null;
  dueOn: string | null;
  status: "open" | "done";
  kind: string;
  priority: string;
  context: string | null;
  recommendedAction: string | null;
  entityType: string | null;
  entityId: string | null;
  handoffToFounder: boolean;
  completedAt: number | null;
  completionNote: string | null;
  createdAt: number;
}

interface RelatedRecordOption {
  id: string;
  label: string;
}

function toWorkItem(row: TaskRow): WorkItem {
  return {
    id: row.id,
    title: row.title,
    ownerUserId: row.owner_user_id,
    dueAt: row.due_at,
    dueOn: row.due_on,
    status: row.status,
    kind: row.kind || "task",
    priority: row.priority || "normal",
    context: row.context,
    recommendedAction: row.recommended_action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    handoffToFounder: row.handoff_to_founder === 1,
    completedAt: row.completed_at,
    completionNote: row.completion_note,
    createdAt: row.created_at,
  };
}

function toRelatedRecordOptions(rows: RelatedRecordOption[]): RelatedRecordOption[] {
  return rows.map((row) => ({ id: row.id, label: row.label }));
}

function shortDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(timestamp);
}

function displayLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function urgencyScore(item: WorkItem, now: number, today: string, dueSoonOn: string): number {
  const overdue = item.dueOn ? item.dueOn < today : item.dueAt !== null && item.dueAt < now;
  const dueSoon = item.dueOn
    ? item.dueOn >= today && item.dueOn <= dueSoonOn
    : item.dueAt !== null && item.dueAt >= now && item.dueAt <= now + 7 * DAY_MS;
  const priority = item.priority === "urgent" ? 500 : item.priority === "high" ? 300 : 0;
  return (overdue ? 1_000 : 0) + priority + (item.handoffToFounder ? 250 : 0) + (!item.ownerUserId ? 180 : 0) + (dueSoon ? 100 : 0);
}

export default async function TasksPage() {
  const me = await requireStaff();
  const db = getDb();
  const now = Number((db.prepare("SELECT unixepoch('now') * 1000 AS now").get() as { now: number }).now);
  const today = canonicalDateInZone(now);
  const dueSoonOn = addCanonicalDays(today, 7);
  const open = (db.prepare("SELECT * FROM tasks WHERE status = 'open'").all() as unknown as TaskRow[]).map(toWorkItem);
  const done = (
    db.prepare("SELECT * FROM tasks WHERE status = 'done' ORDER BY completed_at DESC, updated_at DESC LIMIT 25").all() as unknown as TaskRow[]
  ).map(toWorkItem);
  const activeStaffIds = new Set(
    (db.prepare("SELECT id FROM users WHERE status = 'active'").all() as { id: string }[]).map((row) => row.id),
  );
  // node:sqlite rows use a null prototype. Client Component props must cross the
  // React boundary as explicit plain view models rather than raw database rows.
  const staffUsers = listStaffUsers()
    .filter((user) => activeStaffIds.has(user.id))
    .map((user) => ({ id: user.id, name: user.name }));
  const ownerNames = resolveUserNames([...open, ...done].map((item) => item.ownerUserId));
  const relatedRecords: Record<string, RelatedRecordOption[]> = {
    program: toRelatedRecordOptions(db.prepare("SELECT id, name AS label FROM programs ORDER BY CASE WHEN stage IN ('completed','renewed','closed') THEN 1 ELSE 0 END, updated_at DESC, name LIMIT 250").all() as unknown as RelatedRecordOption[]),
    class: toRelatedRecordOptions(db.prepare("SELECT id, title || ' · ' || replace(status, '_', ' ') AS label FROM classes ORDER BY CASE WHEN status IN ('completed','cancelled') THEN 1 ELSE 0 END, updated_at DESC, title LIMIT 250").all() as unknown as RelatedRecordOption[]),
    instructor: toRelatedRecordOptions(db.prepare("SELECT i.id, p.name || ' · ' || replace(i.stage, '_', ' ') AS label FROM instructors i JOIN people p ON p.id = i.person_id ORDER BY CASE WHEN i.stage IN ('rejected','inactive') THEN 1 ELSE 0 END, i.updated_at DESC, p.name LIMIT 250").all() as unknown as RelatedRecordOption[]),
    student: toRelatedRecordOptions(db.prepare("SELECT id, name AS label FROM students ORDER BY updated_at DESC, name LIMIT 250").all() as unknown as RelatedRecordOption[]),
    organization: toRelatedRecordOptions(db.prepare("SELECT id, name || ' · ' || type AS label FROM organizations ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, name LIMIT 250").all() as unknown as RelatedRecordOption[]),
    location: toRelatedRecordOptions(db.prepare("SELECT id, name || ' · ' || replace(stage, '_', ' ') AS label FROM locations ORDER BY CASE stage WHEN 'closed' THEN 1 ELSE 0 END, updated_at DESC, name LIMIT 250").all() as unknown as RelatedRecordOption[]),
    region: toRelatedRecordOptions(db.prepare("SELECT id, name || ' · ' || replace(stage, '_', ' ') AS label FROM operating_regions ORDER BY CASE stage WHEN 'closed' THEN 1 ELSE 0 END, updated_at DESC, name LIMIT 250").all() as unknown as RelatedRecordOption[]),
  };

  open.sort(
    (a, b) =>
      urgencyScore(b, now, today, dueSoonOn) - urgencyScore(a, now, today, dueSoonOn) ||
      (a.dueAt ?? Number.MAX_SAFE_INTEGER) - (b.dueAt ?? Number.MAX_SAFE_INTEGER) ||
      a.createdAt - b.createdAt,
  );

  const isOverdue = (item: WorkItem) => item.dueOn ? item.dueOn < today : item.dueAt !== null && item.dueAt < now;
  const isDueSoon = (item: WorkItem) => item.dueOn
    ? item.dueOn >= today && item.dueOn <= dueSoonOn
    : item.dueAt !== null && item.dueAt >= now && item.dueAt <= now + 7 * DAY_MS;
  const needsAttention = (item: WorkItem) =>
    isOverdue(item) || item.priority === "urgent" || item.handoffToFounder || !item.ownerUserId;
  const attention = open.filter(needsAttention);
  const planned = open.filter((item) => !needsAttention(item));
  const overdueCount = open.filter(isOverdue).length;
  const dueSoonCount = open.filter(isDueSoon).length;
  const unassignedCount = open.filter((item) => !item.ownerUserId).length;

  const ownerLabel = (item: WorkItem): string => {
    if (!item.ownerUserId) return "Unassigned";
    const resolved = ownerNames.get(item.ownerUserId);
    return resolved && resolved !== item.ownerUserId ? resolved : "Owner record unavailable";
  };

  const renderItems = (items: WorkItem[], completed = false) => (
    <div style={{ ...cardStyle, overflow: "hidden" }}>
      {items.map((item, index) => {
        const href = entityHref(item.entityType, item.entityId);
        const overdue = !completed && isOverdue(item);
        const dueSoon = !completed && isDueSoon(item);
        const priorityStatus = item.priority === "urgent" ? "negative" : item.priority === "high" ? "warning" : "neutral";
        return (
          <article
            key={item.id}
            style={{
              padding: "18px clamp(14px,3vw,22px)",
              borderBottom: index === items.length - 1 ? 0 : "1px solid var(--border-rule)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 520px", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 8 }}>
                {item.priority !== "normal" && <Badge status={priorityStatus}>{displayLabel(item.priority)}</Badge>}
                <Badge status="neutral">{displayLabel(item.kind)}</Badge>
                {item.handoffToFounder && <Badge status="info">Founder decision</Badge>}
                {overdue && <Badge status="negative">Overdue</Badge>}
                {!overdue && dueSoon && <Badge status="warning">Due soon</Badge>}
                {!completed && !item.ownerUserId && <Badge status="negative">Owner needed</Badge>}
                {completed && <Badge status="positive">Completed</Badge>}
              </div>

              <h3 style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.35, color: "var(--bow-ink)" }}>{item.title}</h3>
              {item.context && <p style={{ ...bodyStyle, margin: "6px 0 0" }}>{item.context}</p>}
              {item.recommendedAction && !completed && (
                <p style={{ ...bodyStyle, margin: "7px 0 0", color: "var(--bow-ink)" }}>
                  <strong>Next:</strong> {item.recommendedAction}
                </p>
              )}
              {completed && item.completionNote && (
                <p style={{ ...bodyStyle, margin: "7px 0 0" }}><strong>Outcome:</strong> {item.completionNote}</p>
              )}

              <div style={{ display: "flex", gap: "7px 18px", flexWrap: "wrap", marginTop: 11 }}>
                <span style={labelStyle}>Owner · {ownerLabel(item)}</span>
                {(item.dueOn || item.dueAt) && !completed && (
                  <time dateTime={item.dueOn ?? new Date(item.dueAt!).toISOString()} style={labelStyle}>
                    Due · {item.dueOn ? formatCanonicalDate(item.dueOn) : shortDate(item.dueAt!)}
                  </time>
                )}
                {completed && item.completedAt && (
                  <time dateTime={new Date(item.completedAt).toISOString()} style={labelStyle}>Closed · {shortDate(item.completedAt)}</time>
                )}
                {href && (
                  <Link href={href} style={{ ...labelStyle, color: "var(--bow-blue)", textDecoration: "none" }}>
                    Related · {displayLabel(item.entityType ?? "record")} →
                  </Link>
                )}
              </div>
            </div>

            {!completed && (
              <div style={{ flex: "0 0 auto", alignSelf: "center" }}>
                <WorkItemActions
                  taskId={item.id}
                  currentOwnerId={item.ownerUserId}
                  staffUsers={staffUsers}
                  founderHandoff={item.handoffToFounder}
                  canManageFounderWork={me.role === "admin"}
                />
              </div>
            )}
          </article>
        );
      })}
    </div>
  );

  const metrics = [
    { label: "Open Work", value: open.length, detail: "All active commitments", tone: "var(--bow-blue)" },
    { label: "Needs attention", value: attention.length, detail: "Exception-ranked first", tone: attention.length ? "var(--bow-warning)" : "var(--bow-positive)" },
    { label: "Overdue", value: overdueCount, detail: "Past the promised date", tone: overdueCount ? "var(--bow-negative)" : "var(--bow-positive)" },
    { label: "Without owner", value: unassignedCount, detail: "Accountability not assigned", tone: unassignedCount ? "var(--bow-warning)" : "var(--bow-positive)" },
    { label: "Due in 7 days", value: dueSoonCount, detail: "Upcoming commitments", tone: dueSoonCount ? "var(--bow-blue)" : "var(--bow-positive)" },
  ];

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 28 }}>
      <SectionHeader kicker="BOW OS · Accountability" title="Work" level={1} />
      <p style={{ ...bodyStyle, margin: 0, maxWidth: 720, fontSize: 15 }}>
        Every cross-functional commitment exposes its owner, operating context, due date, and intended outcome—even when one is missing. Exceptions rise automatically; planned work stays visible without competing for founder attention.
      </p>
      <CreateWorkForm
        staffUsers={staffUsers}
        defaultOwnerId={staffUsers.some((user) => user.id === me.id) ? me.id : ""}
        relatedRecords={relatedRecords}
      />

      <section aria-label="Work queue summary" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        {metrics.map((metric) => (
          <div key={metric.label} style={{ ...cardStyle, padding: 16, borderTop: `4px solid ${metric.tone}` }}>
            <span style={labelStyle}>{metric.label}</span>
            <strong style={{ display: "block", margin: "7px 0 3px", fontFamily: "var(--font-display)", fontSize: 30, lineHeight: 1, color: "var(--bow-ink)" }}>{metric.value}</strong>
            <span style={{ ...bodyStyle, fontSize: 12 }}>{metric.detail}</span>
          </div>
        ))}
      </section>

      {open.length === 0 ? (
        <section style={{ ...cardStyle, padding: 34, textAlign: "center" }}>
          <Badge status="positive">Queue clear</Badge>
          <h2 style={{ margin: "14px 0 6px", fontFamily: "var(--font-display)", fontSize: 22, textTransform: "uppercase" }}>No open Work</h2>
          <p style={{ ...bodyStyle, margin: 0 }}>There are no commitments waiting for an owner or outcome.</p>
        </section>
      ) : (
        <>
          {attention.length > 0 && (
            <section aria-labelledby="attention-work-heading" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <span style={labelStyle}>Overdue · urgent · founder · unassigned</span>
                <h2 id="attention-work-heading" style={{ margin: "5px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 22, textTransform: "uppercase" }}>Needs attention</h2>
              </div>
              {renderItems(attention)}
            </section>
          )}

          {planned.length > 0 && (
            <section aria-labelledby="planned-work-heading" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <span style={labelStyle}>Owned commitments</span>
                <h2 id="planned-work-heading" style={{ margin: "5px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 22, textTransform: "uppercase" }}>Planned queue</h2>
              </div>
              {renderItems(planned)}
            </section>
          )}
        </>
      )}

      {done.length > 0 && (
        <section aria-labelledby="completed-work-heading" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <span style={labelStyle}>Latest 25 outcomes</span>
            <h2 id="completed-work-heading" style={{ margin: "5px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 22, textTransform: "uppercase" }}>Recently completed</h2>
          </div>
          {renderItems(done, true)}
        </section>
      )}
    </div>
  );
}
