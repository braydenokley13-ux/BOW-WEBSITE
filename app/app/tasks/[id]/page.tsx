import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ds";
import { requireStaff } from "@/lib/dal";
import { getDb } from "@/lib/db";

function label(value: unknown): string {
  return String(value ?? "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function when(value: unknown): string {
  const date = new Date(Number(value));
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default async function WorkHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const db = getDb();
  const task = await db.prepare(
    `SELECT t.*, owner.name AS owner_name, doer.name AS doer_name, reviewer.name AS reviewer_name
       FROM tasks t
       LEFT JOIN users owner ON owner.id = t.owner_user_id
       LEFT JOIN users doer ON doer.id = t.doer_user_id
       LEFT JOIN users reviewer ON reviewer.id = t.reviewer_user_id
      WHERE t.id = ?`,
  ).get(id) as Record<string, unknown> | undefined;
  if (!task) notFound();
  const submissions = await db.prepare(
    `SELECT ws.*, u.name AS submitter_name
       FROM work_submissions ws JOIN users u ON u.id = ws.submitted_by_user_id
      WHERE ws.task_id = ? ORDER BY ws.revision DESC`,
  ).all(id) as Record<string, unknown>[];
  const reviews = await db.prepare(
    `SELECT wr.*, ws.revision, u.name AS reviewer_name
       FROM work_reviews wr JOIN work_submissions ws ON ws.id = wr.submission_id
       JOIN users u ON u.id = wr.reviewer_user_id
      WHERE ws.task_id = ? ORDER BY wr.reviewed_at DESC`,
  ).all(id) as Record<string, unknown>[];
  const events = await db.prepare(
    `SELECT te.*, u.name AS actor_name FROM task_events te
       LEFT JOIN users u ON u.id = te.actor_user_id
      WHERE te.task_id = ? ORDER BY te.created_at DESC`,
  ).all(id) as Record<string, unknown>[];
  const reviewsByRevision = new Map(reviews.map((review) => [Number(review.revision), review]));

  return <main className="ops-page">
    <header className="ops-hero"><div className="ops-hero__copy"><span className="ops-eyebrow">Work · Full evidence history</span><h1 className="ops-title">{String(task.title)}</h1><p className="ops-summary">Every promise, submission, revision, review, and deadline change remains visible.</p></div><Badge status={task.workflow_state === "approved" ? "positive" : task.workflow_state === "rejected" || task.workflow_state === "canceled" ? "negative" : "info"}>{label(task.workflow_state)}</Badge></header>
    <div className="ops-two-col"><div className="ops-stack">
      <section className="ops-panel"><div className="ops-section-head"><div><span className="ops-label">Definition</span><h2 className="ops-section-title">What success means</h2></div></div><p className="ops-body"><strong>Expected result:</strong> {String(task.expected_result ?? "Not recorded")}</p><p className="ops-body"><strong>Done means:</strong> {String(task.definition_of_done ?? "Not recorded")}</p><p className="ops-body"><strong>Evidence:</strong> {String(task.evidence_requirement ?? "Not required")}</p></section>
      <section className="ops-panel"><div className="ops-section-head"><div><span className="ops-label">Append-only artifacts</span><h2 className="ops-section-title">Submissions &amp; reviews</h2></div></div>{submissions.length === 0 ? <p className="ops-body">No submission yet.</p> : <div className="ops-timeline">{submissions.map((submission) => { const review = reviewsByRevision.get(Number(submission.revision)); const links = JSON.parse(String(submission.evidence_links ?? "[]")) as string[]; return <article className="ops-timeline__item" key={String(submission.id)}><span className="ops-record-name">Submission #{Number(submission.revision)}</span><span className="ops-record-meta">{String(submission.submitter_name)} · {when(submission.submitted_at)}</span><p className="ops-body" style={{ marginTop: 8 }}>{String(submission.result_summary)}</p>{links.map((href) => <p key={href} style={{ margin: "5px 0 0" }}><a href={href} target="_blank" rel="noreferrer" className="ops-link">Evidence ↗</a></p>)}{review ? <div className="ops-alert" data-tone={review.decision === "excellent" || review.decision === "meets_standard" ? "positive" : "warning"} style={{ marginTop: 10 }}><p className="ops-alert__title">{label(review.decision)} · {String(review.reviewer_name)}</p><p className="ops-body" style={{ marginTop: 4 }}>{String(review.feedback)}</p>{Boolean(review.revision_instructions) && <p className="ops-body"><strong>Revision:</strong> {String(review.revision_instructions)}</p>}</div> : <Badge status="warning">Awaiting review</Badge>}</article>; })}</div>}</section>
    </div><aside className="ops-stack"><section className="ops-panel"><span className="ops-label">Accountability</span><div className="ops-meta-grid" style={{ marginTop: 12 }}><div className="ops-meta"><span className="ops-label">Owner</span><span className="ops-value">{String(task.owner_name ?? "Unassigned")}</span></div><div className="ops-meta"><span className="ops-label">Doer</span><span className="ops-value">{String(task.doer_name ?? task.owner_name ?? "Unassigned")}</span></div><div className="ops-meta"><span className="ops-label">Reviewer</span><span className="ops-value">{String(task.reviewer_name ?? "Unassigned")}</span></div></div></section><section className="ops-panel"><div className="ops-section-head"><div><span className="ops-label">Audit log</span><h2 className="ops-section-title">Task events</h2></div></div>{events.length === 0 ? <p className="ops-body">No rich lifecycle events yet.</p> : <div className="ops-timeline">{events.map((event) => <div className="ops-timeline__item" key={String(event.id)}><span className="ops-record-meta">{when(event.created_at)} · {label(event.event_type)} · {String(event.actor_name ?? "System")}</span><p className="ops-body" style={{ marginTop: 4 }}>{event.prior_value ? `${String(event.prior_value)} → ` : ""}{String(event.next_value ?? "")}{event.reason ? ` · ${String(event.reason)}` : ""}</p></div>)}</div>}<Link href="/app/tasks" className="ops-link">← Back to Work</Link></section></aside></div>
  </main>;
}
