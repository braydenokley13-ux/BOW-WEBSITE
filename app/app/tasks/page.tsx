import Link from "next/link";
import { Badge } from "@/components/ds";
import { resolveUserNames } from "@/lib/hiring";
import { getDb } from "@/lib/db";
import { entityHref } from "@/lib/routes";
import WorkItemActions from "@/components/app/tasks/WorkItemActions";
import CreateWorkForm from "@/components/app/tasks/CreateWorkForm";
import ReviewSubmissionControls from "@/components/app/tasks/ReviewSubmissionControls";
import SubmitWorkControls from "@/components/app/tasks/SubmitWorkControls";
import WorkGovernanceControls from "@/components/app/tasks/WorkGovernanceControls";
import WeeklyCommitmentEditor from "@/components/app/people/WeeklyCommitmentEditor";
import { requireStaff } from "@/lib/dal";
import { currentWeekStart, getWeeklyCycleForPerson } from "@/lib/people-operations";
import { addCanonicalDays, canonicalDateInZone, coerceEpochMs, formatCanonicalDate } from "@/lib/timezone";

const DAY_MS = 24 * 60 * 60 * 1000;

interface TaskRow {
  id: string;
  title: string;
  owner_user_id: string | null;
  doer_user_id: string | null;
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
  workflow_state: string;
  expected_result: string | null;
  definition_of_done: string | null;
  evidence_requirement: string | null;
  review_required: boolean;
}

interface WorkItem {
  id: string;
  title: string;
  ownerUserId: string | null;
  doerUserId: string | null;
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
  workflowState: string;
  expectedResult: string | null;
  definitionOfDone: string | null;
  evidenceRequirement: string | null;
  reviewRequired: boolean;
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
    doerUserId: row.doer_user_id,
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
    workflowState: row.workflow_state || (row.status === "done" ? "approved" : "assigned"),
    expectedResult: row.expected_result,
    definitionOfDone: row.definition_of_done,
    evidenceRequirement: row.evidence_requirement,
    reviewRequired: Boolean(row.review_required),
  };
}

function toRelatedRecordOptions(rows: RelatedRecordOption[]): RelatedRecordOption[] {
  return rows.map((row) => ({ id: row.id, label: row.label }));
}

/**
 * Postgres returns bigint columns as strings, so a raw `tasks.due_at` reaches
 * here as "1786032000000". Intl formats that as Invalid Date and
 * `new Date(value).toISOString()` throws outright — which took the whole Work
 * page down. Everything time-shaped on this page goes through coerceEpochMs.
 */
function shortDate(timestamp: number | string): string {
  const epoch = coerceEpochMs(timestamp);
  if (epoch == null) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(epoch);
}

/** A machine-readable datetime, or nothing — never a throw. */
function isoAttr(value: number | string | null | undefined): string | undefined {
  const epoch = coerceEpochMs(value);
  return epoch == null ? undefined : new Date(epoch).toISOString();
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

const VIEWS = ["mine", "all", "review", "unowned", "overdue"] as const;
type WorkView = (typeof VIEWS)[number];

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view: viewParam } = await searchParams;
  const me = await requireStaff();
  const db = getDb();
  const now = Number(((await db.prepare("SELECT unixepoch('now') * 1000 AS now").get()) as { now: number }).now);
  const today = canonicalDateInZone(now);
  const dueSoonOn = addCanonicalDays(today, 7);
  const open = ((await db.prepare("SELECT * FROM tasks WHERE status = 'open'").all()) as unknown as TaskRow[]).map(toWorkItem);
  const done = (
    (await db.prepare("SELECT * FROM tasks WHERE status = 'done' ORDER BY completed_at DESC, updated_at DESC LIMIT 25").all()) as unknown as TaskRow[]
  ).map(toWorkItem);
  const latestSubmissions = new Map(
    ((await db.prepare(
      `SELECT DISTINCT ON (ws.task_id) ws.task_id, ws.id, ws.revision, ws.result_summary, ws.submitted_at, u.name AS submitter_name
         FROM work_submissions ws JOIN users u ON u.id = ws.submitted_by_user_id
        ORDER BY ws.task_id, ws.revision DESC`,
    ).all()) as { task_id: string; id: string; revision: number; result_summary: string; submitted_at: number; submitter_name: string }[])
      .map((row) => [row.task_id, row] as const),
  );
  const activeStaffIds = new Set(
    ((await db.prepare("SELECT id FROM users WHERE status = 'active'").all()) as { id: string }[]).map((row) => row.id),
  );
  // node:sqlite rows use a null prototype. Client Component props must cross the
  // React boundary as explicit plain view models rather than raw database rows.
  const staffUsers = ((await db.prepare(
    "SELECT id, name FROM users WHERE status = 'active' AND role IN ('admin','growth','instructor') ORDER BY name",
  ).all()) as { id: string; name: string }[])
    .filter((user) => activeStaffIds.has(user.id))
    .map((user) => ({ id: user.id, name: user.name }));
  const ownerNames = (await resolveUserNames([...open, ...done].map((item) => item.ownerUserId)));
  const relatedRecords: Record<string, RelatedRecordOption[]> = {
    program: toRelatedRecordOptions((await db.prepare("SELECT id, name AS label FROM programs ORDER BY CASE WHEN stage IN ('completed','renewed','closed') THEN 1 ELSE 0 END, updated_at DESC, name LIMIT 250").all()) as unknown as RelatedRecordOption[]),
    class: toRelatedRecordOptions((await db.prepare("SELECT id, title || ' · ' || replace(status, '_', ' ') AS label FROM classes ORDER BY CASE WHEN status IN ('completed','cancelled') THEN 1 ELSE 0 END, updated_at DESC, title LIMIT 250").all()) as unknown as RelatedRecordOption[]),
    instructor: toRelatedRecordOptions((await db.prepare("SELECT i.id, p.name || ' · ' || replace(i.stage, '_', ' ') AS label FROM instructors i JOIN people p ON p.id = i.person_id ORDER BY CASE WHEN i.stage IN ('rejected','inactive') THEN 1 ELSE 0 END, i.updated_at DESC, p.name LIMIT 250").all()) as unknown as RelatedRecordOption[]),
    student: toRelatedRecordOptions((await db.prepare("SELECT id, name AS label FROM students ORDER BY updated_at DESC, name LIMIT 250").all()) as unknown as RelatedRecordOption[]),
    organization: toRelatedRecordOptions((await db.prepare("SELECT id, name || ' · ' || type AS label FROM organizations ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, name LIMIT 250").all()) as unknown as RelatedRecordOption[]),
    location: toRelatedRecordOptions((await db.prepare("SELECT id, name || ' · ' || replace(stage, '_', ' ') AS label FROM locations ORDER BY CASE stage WHEN 'closed' THEN 1 ELSE 0 END, updated_at DESC, name LIMIT 250").all()) as unknown as RelatedRecordOption[]),
    region: toRelatedRecordOptions((await db.prepare("SELECT id, name || ' · ' || replace(stage, '_', ' ') AS label FROM operating_regions ORDER BY CASE stage WHEN 'closed' THEN 1 ELSE 0 END, updated_at DESC, name LIMIT 250").all()) as unknown as RelatedRecordOption[]),
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
  const mineCount = open.filter((item) => item.ownerUserId === me.id || item.doerUserId === me.id).length;
  const reviewCount = open.filter((item) => item.workflowState === "submitted").length;

  const view: WorkView = (VIEWS as readonly string[]).includes(viewParam ?? "")
    ? (viewParam as WorkView)
    : mineCount > 0
      ? "mine"
      : "all";
  const inView = (item: WorkItem): boolean => {
    if (view === "mine") return item.ownerUserId === me.id || item.doerUserId === me.id;
    if (view === "review") return item.workflowState === "submitted";
    if (view === "unowned") return !item.ownerUserId;
    if (view === "overdue") return isOverdue(item);
    return true;
  };
  const viewLabels: Record<WorkView, string> = {
    mine: `My work (${mineCount})`,
    all: `Everything (${open.length})`,
    review: `Review (${reviewCount})`,
    unowned: `Unowned (${unassignedCount})`,
    overdue: `Overdue (${overdueCount})`,
  };

  const ownerLabel = (item: WorkItem): string => {
    if (!item.ownerUserId) return "Unassigned";
    const resolved = ownerNames.get(item.ownerUserId);
    return resolved && resolved !== item.ownerUserId ? resolved : "Owner record unavailable";
  };

  const myPerson = (await db.prepare("SELECT id, name FROM people WHERE user_id = ? ORDER BY created_at LIMIT 1").get(me.id)) as { id: string; name: string } | undefined;
  const weekStart = currentWeekStart(now);
  const myWeek = myPerson ? await getWeeklyCycleForPerson(myPerson.id, weekStart) : null;
  const weeklyOutcomes = ((await db.prepare(
    "SELECT id, title FROM outcomes WHERE status = 'active' ORDER BY due_on NULLS LAST, created_at LIMIT 200",
  ).all()) as { id: string; title: string }[]).map((outcome) => ({ id: outcome.id, title: outcome.title }));
  const myWeeklyTasks = open.filter((item) => item.ownerUserId === me.id || item.doerUserId === me.id).map((item) => ({
    id: item.id, title: item.title, workflowState: item.workflowState, dueOn: item.dueOn,
  }));

  const renderItems = (items: WorkItem[], completed = false) => (
    <div className="ops-panel" style={{ padding: 0, overflow: "hidden" }}>
      {items.map((item, index) => {
        const href = entityHref(item.entityType, item.entityId);
        const overdue = !completed && isOverdue(item);
        const dueSoon = !completed && isDueSoon(item);
        const priorityStatus = item.priority === "urgent" ? "negative" : item.priority === "high" ? "warning" : "neutral";
        const submission = latestSubmissions.get(item.id);
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
                {!completed && <Badge status={item.workflowState === "submitted" ? "warning" : "info"}>{displayLabel(item.workflowState)}</Badge>}
                {completed && <Badge status="positive">Completed</Badge>}
              </div>

              <h3 style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.35, color: "var(--bow-ink)" }}>
                {href ? (
                  <Link href={href} style={{ color: "inherit", textDecoration: "none" }}>{item.title}</Link>
                ) : (
                  <Link href={`/app/tasks/${item.id}`} style={{ color: "inherit", textDecoration: "none" }}>{item.title}</Link>
                )}
              </h3>
              {item.context && <p className="ops-body" style={{ margin: "6px 0 0" }}>{item.context}</p>}
              {item.expectedResult && <p className="ops-body" style={{ margin: "7px 0 0" }}><strong>Expected result:</strong> {item.expectedResult}</p>}
              {item.definitionOfDone && <p className="ops-body" style={{ margin: "7px 0 0" }}><strong>Done means:</strong> {item.definitionOfDone}</p>}
              {submission && !completed && (
                <div className="ops-alert" data-tone="info" style={{ marginTop: 10 }}>
                  <p className="ops-alert__title">Submission #{submission.revision} · {submission.submitter_name}</p>
                  <p className="ops-body" style={{ marginTop: 4 }}>{submission.result_summary}</p>
                </div>
              )}
              {item.recommendedAction && !completed && (
                <p className="ops-body" style={{ margin: "7px 0 0", color: "var(--bow-ink)" }}>
                  <strong>Next:</strong> {item.recommendedAction}
                </p>
              )}
              {completed && item.completionNote && (
                <p className="ops-body" style={{ margin: "7px 0 0" }}><strong>Outcome:</strong> {item.completionNote}</p>
              )}

              <div style={{ display: "flex", gap: "7px 18px", flexWrap: "wrap", marginTop: 11 }}>
                <span className="ops-label">Owner · {ownerLabel(item)}</span>
                {(item.dueOn || item.dueAt) && !completed && (
                  <time dateTime={item.dueOn ?? isoAttr(item.dueAt)} className="ops-label">
                    Due · {item.dueOn ? formatCanonicalDate(item.dueOn) : shortDate(item.dueAt!)}
                  </time>
                )}
                {completed && item.completedAt && (
                  <time dateTime={isoAttr(item.completedAt)} className="ops-label">Closed · {shortDate(item.completedAt)}</time>
                )}
                {href && (
                  <Link href={href} className="ops-label" style={{ color: "var(--bow-blue)", textDecoration: "none" }}>
                    Related · {displayLabel(item.entityType ?? "record")} →
                  </Link>
                )}
                <Link href={`/app/tasks/${item.id}`} className="ops-label" style={{ color: "var(--bow-blue)", textDecoration: "none" }}>
                  Evidence history →
                </Link>
              </div>
            </div>

            {!completed && (
              <div style={{ flex: "0 0 auto", alignSelf: "center" }}>
                {item.workflowState === "submitted" && submission && <div style={{ marginBottom: 8 }}><ReviewSubmissionControls submissionId={submission.id} /></div>}
                {item.reviewRequired
                  && ["assigned", "in_progress", "revision_requested"].includes(item.workflowState)
                  && (me.role === "admin" || item.ownerUserId === me.id || item.doerUserId === me.id) && (
                    <div style={{ marginBottom: 8 }}>
                      <SubmitWorkControls taskId={item.id} workflowState={item.workflowState} />
                    </div>
                  )}
                <WorkItemActions
                  taskId={item.id}
                  currentOwnerId={item.ownerUserId}
                  staffUsers={staffUsers}
                  founderHandoff={item.handoffToFounder}
                  canManageFounderWork={me.role === "admin"}
                  reviewRequired={item.reviewRequired}
                />
                <WorkGovernanceControls taskId={item.id} currentDueOn={item.dueOn} />
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
    <main className="ops-page">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">BOW OS · Accountability</span>
          <h1 className="ops-title">Work</h1>
          <p className="ops-summary">
            Every cross-functional commitment exposes its owner, operating context, due date, and intended outcome—even when one is missing. Exceptions rise automatically; planned work stays visible without competing for founder attention.
          </p>
        </div>
      </header>

      <nav className="ops-filters" aria-label="Work views">
        {VIEWS.map((value) => (
          <Link
            key={value}
            className="ops-filter"
            aria-current={view === value ? "page" : undefined}
            href={value === "mine" ? "/app/tasks?view=mine" : `/app/tasks?view=${value}`}
          >
            {viewLabels[value]}
          </Link>
        ))}
      </nav>

      {myPerson && (
        <section className="ops-panel" style={{ padding: 20 }} aria-labelledby="my-week-heading">
          <span className="ops-label">One result before the queue</span>
          <h2 id="my-week-heading" className="ops-section-title">My Week</h2>
          <WeeklyCommitmentEditor
            personId={myPerson.id}
            personName={myPerson.name}
            weekStart={weekStart}
            cycle={myWeek}
            tasks={myWeeklyTasks}
            outcomes={weeklyOutcomes}
            managerMode={false}
          />
        </section>
      )}

      <CreateWorkForm
        staffUsers={staffUsers}
        defaultOwnerId={staffUsers.some((user) => user.id === me.id) ? me.id : ""}
        relatedRecords={relatedRecords}
      />

      <section aria-label="Work queue summary" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        {metrics.map((metric) => (
          <div key={metric.label} className="ops-panel" style={{ padding: 16, borderTop: `4px solid ${metric.tone}` }}>
            <span className="ops-label">{metric.label}</span>
            <strong style={{ display: "block", margin: "7px 0 3px", fontFamily: "var(--font-display)", fontSize: 30, lineHeight: 1, color: "var(--bow-ink)" }}>{metric.value}</strong>
            <span className="ops-body" style={{ fontSize: 12 }}>{metric.detail}</span>
          </div>
        ))}
      </section>

      {open.length === 0 ? (
        <section className="ops-empty">
          <Badge status="positive">Queue clear</Badge>
          <h2 className="ops-empty__title" style={{ marginTop: 12 }}>No open Work</h2>
          <p className="ops-empty__body">There are no commitments waiting for an owner or outcome.</p>
        </section>
      ) : (
        <>
          {attention.length > 0 && (
            <section aria-labelledby="attention-work-heading" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <span className="ops-label">Overdue · urgent · founder · unassigned</span>
                <h2 id="attention-work-heading" className="ops-section-title">Needs attention</h2>
              </div>
              {renderItems(attention.filter(inView))}
            </section>
          )}

          {planned.length > 0 && (
            <section aria-labelledby="planned-work-heading" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <span className="ops-label">Owned commitments</span>
                <h2 id="planned-work-heading" className="ops-section-title">Planned queue</h2>
              </div>
              {renderItems(planned.filter(inView))}
            </section>
          )}
        </>
      )}

      {done.length > 0 && (
        <section aria-labelledby="completed-work-heading" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <span className="ops-label">Latest 25 outcomes</span>
            <h2 id="completed-work-heading" className="ops-section-title">Recently completed</h2>
          </div>
          {renderItems(done, true)}
        </section>
      )}
    </main>
  );
}
