import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ds";
import WeeklyCommitmentEditor from "@/components/app/people/WeeklyCommitmentEditor";
import { AccountabilityControls, ActivationControls, CapacityControls, RoleAssignmentSetup, RoleDecisionControls } from "@/components/app/people/PersonOperatingControls";
import { requireStaff } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { getPeopleOperationsData } from "@/lib/people-operations";

export default async function PersonOperatingPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStaff();
  const { id } = await params;
  const data = await getPeopleOperationsData({ userId: me.id, role: me.role });
  const person = data.people.find((candidate) => candidate.personId === id);
  if (!person) notFound();
  const db = getDb();
  const requirements = person.roleAssignmentId ? (await db.prepare(
    "SELECT id, label, status, source_type, decision_note FROM role_activation_requirements WHERE role_assignment_id = ? ORDER BY created_at",
  ).all(person.roleAssignmentId)) as Array<{ id: string; label: string; status: string; source_type: string | null; decision_note: string | null }> : [];
  const accountability = (await db.prepare(
    "SELECT id, event_type, reason, recovery_commitment, created_at FROM people_accountability_events WHERE person_id = ? AND status = 'open' ORDER BY created_at DESC",
  ).all(person.personId)) as Array<{ id: string; event_type: string; reason: string; recovery_commitment: string | null; created_at: number }>;
  const performance = (await db.prepare(
    `SELECT pe.*, u.name AS actor_name FROM performance_events pe LEFT JOIN users u ON u.id = pe.actor_user_id
      WHERE pe.person_id = ? ORDER BY pe.created_at DESC LIMIT 50`,
  ).all(person.personId)) as Array<Record<string, unknown>>;
  const decisions = person.roleAssignmentId ? (await db.prepare(
    `SELECT rad.*, u.name AS actor_name FROM role_assignment_decisions rad JOIN users u ON u.id = rad.actor_user_id
      WHERE rad.role_assignment_id = ? ORDER BY rad.created_at DESC LIMIT 30`,
  ).all(person.roleAssignmentId)) as Array<Record<string, unknown>> : [];
  const history = (await db.prepare(
    "SELECT * FROM people_weekly_cycles WHERE person_id = ? ORDER BY week_start DESC LIMIT 12",
  ).all(person.personId)) as Array<Record<string, unknown>>;
  const playbookLessons = ((await db.prepare(
    `SELECT id, title FROM learn_lessons WHERE published_version_id IS NOT NULL AND status = 'published' ORDER BY title`,
  ).all()) as Array<{ id: string; title: string }>).map((lesson) => ({ id: lesson.id, title: lesson.title }));
  const roles = ((await db.prepare("SELECT id, title FROM org_roles WHERE status = 'active' ORDER BY title").all()) as Array<{ id: string; title: string }>).map((role) => ({ id: role.id, title: role.title }));
  const managerAssignments = ((await db.prepare(
    `SELECT ra.id, p.name || ' · ' || r.title AS label FROM role_assignments ra
      JOIN people p ON p.id = ra.person_id JOIN org_roles r ON r.id = ra.role_id
     WHERE ra.status IN ('activating','active') AND ra.person_id <> ? ORDER BY p.name`,
  ).all(person.personId)) as Array<{ id: string; label: string }>).map((manager) => ({ id: manager.id, label: manager.label }));
  const assignmentDetails = person.roleAssignmentId ? (await db.prepare(
    "SELECT manager_assignment_id FROM role_assignments WHERE id = ?",
  ).get(person.roleAssignmentId)) as { manager_assignment_id: string | null } | undefined : undefined;
  const personTasks = data.tasks.filter((task) => task.personId === person.personId);
  const autonomyLabels = ["", "Directed", "Guided", "Owner", "Lead"];
  const canManagePerson = me.role === "admin" || person.userId !== me.id;

  return <main className="ops-page">
    <header className="ops-hero"><div className="ops-hero__copy"><span className="ops-eyebrow">People · Operating profile</span><h1 className="ops-title">{person.name}</h1><p className="ops-summary">{person.roleTitle} · {person.email}. This page separates execution evidence, reliability, quality, impact, and role decisions so one opinion never becomes a magical human score.</p></div></header>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Badge status={person.standing === "at_risk" ? "negative" : person.standing === "needs_attention" ? "warning" : "positive"}>{person.standing.replace(/_/g, " ")}</Badge><Badge status="neutral">{person.assignmentStatus?.replace(/_/g, " ") ?? "no assignment"}</Badge>{person.autonomyLevel && <Badge status="info">Autonomy {person.autonomyLevel} · {autonomyLabels[person.autonomyLevel]}</Badge>}<Badge status="neutral">{person.availabilityStatus}</Badge></div>

    <section className="ops-panel" style={{ padding: 20 }} aria-labelledby="weekly-heading"><span className="ops-label">One primary result</span><h2 id="weekly-heading" className="ops-section-title">This week</h2><WeeklyCommitmentEditor personId={person.personId} personName={person.name} weekStart={data.currentWeekStart} cycle={person.currentWeek} tasks={personTasks} outcomes={data.outcomes} managerMode={person.userId !== me.id} /></section>

    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
      <div className="ops-panel" style={{ padding: 18 }}><span className="ops-label">Execution</span><h2 className="ops-section-title">Current Work</h2><p className="ops-body">{person.openWork} open · {person.overdueWork} overdue · {person.waitingReview} awaiting review · {person.blockedWork} revisions</p><Link href="/app/tasks" className="ops-label" style={{ color: "var(--bow-blue)", textDecoration: "none" }}>Open canonical Work queue →</Link></div>
      <div className="ops-panel" style={{ padding: 18 }}><span className="ops-label">Contextual evidence · 90 days</span><h2 className="ops-section-title">Performance Evidence</h2><div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>{Object.entries(person.evidence).map(([dimension, count]) => <div key={dimension}><span className="ops-label">{dimension}</span><strong style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 24 }}>{count}</strong></div>)}</div></div>
    </section>

    {me.role === "admin" && <section className="ops-panel" style={{ padding: 20 }}><span className="ops-label">One canonical reporting line</span><h2 className="ops-section-title">Assignment & Manager</h2><RoleAssignmentSetup personId={person.personId} roleAssignmentId={person.roleAssignmentId} roles={roles} managerAssignments={managerAssignments} currentManagerAssignmentId={assignmentDetails?.manager_assignment_id ?? null} /></section>}

    {person.roleAssignmentId && <>
      <section className="ops-panel" style={{ padding: 20 }}><span className="ops-label">Availability without fake precision</span><h2 className="ops-section-title">Capacity</h2><CapacityControls roleAssignmentId={person.roleAssignmentId} initialHours={person.weeklyCapacityHours} initialAvailability={person.availabilityStatus} /></section>
      <section className="ops-panel" style={{ padding: 20 }}><span className="ops-label">Earned authority</span><h2 className="ops-section-title">Role Activation</h2><ActivationControls roleAssignmentId={person.roleAssignmentId} requirements={requirements.map((item) => ({ id: item.id, label: item.label, status: item.status, sourceType: item.source_type, decisionNote: item.decision_note }))} lessons={playbookLessons} canManage={canManagePerson} /></section>
      {canManagePerson && <section className="ops-panel" style={{ padding: 20 }}><span className="ops-label">Human decision · evidence attached</span><h2 className="ops-section-title">Role & Autonomy</h2><RoleDecisionControls roleAssignmentId={person.roleAssignmentId} status={person.assignmentStatus ?? "activating"} autonomy={person.autonomyLevel ?? 2} /></section>}
    </>}

    <section className="ops-panel" style={{ padding: 20 }}><span className="ops-label">Recovery before punishment</span><h2 className="ops-section-title">Accountability</h2><AccountabilityControls events={accountability.map((event) => ({ id: event.id, eventType: event.event_type, reason: event.reason, recoveryCommitment: event.recovery_commitment, createdAt: Number(event.created_at) }))} canManage={canManagePerson} /></section>

    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
      <div className="ops-panel" style={{ padding: 18 }}><span className="ops-label">Append-only evidence</span><h2 className="ops-section-title">Evidence History</h2>{performance.length ? <ol className="ops-body" style={{ paddingLeft: 20 }}>{performance.map((event) => <li key={String(event.id)} style={{ marginBottom: 8 }}><strong>{String(event.dimension)}</strong> · {String(event.signal)}<br /><span className="ops-field__help">{String(event.detail ?? event.source_type)} · {new Date(Number(event.created_at)).toLocaleDateString()}</span></li>)}</ol> : <p className="ops-body">No evidence events yet.</p>}</div>
      <div className="ops-panel" style={{ padding: 18 }}><span className="ops-label">Preserved decisions</span><h2 className="ops-section-title">Role History</h2>{decisions.length ? <ol className="ops-body" style={{ paddingLeft: 20 }}>{decisions.map((decision) => <li key={String(decision.id)} style={{ marginBottom: 8 }}><strong>{String(decision.decision_type).replace(/_/g, " ")}</strong> · {String(decision.reason)}<br /><span className="ops-field__help">{String(decision.actor_name)} · {new Date(Number(decision.created_at)).toLocaleDateString()}</span></li>)}</ol> : <p className="ops-body">No role decisions yet.</p>}</div>
    </section>
    {history.length > 0 && <section className="ops-panel" style={{ padding: 18 }}><span className="ops-label">Prior commitments are never rewritten</span><h2 className="ops-section-title">Weekly History</h2><ol className="ops-body" style={{ paddingLeft: 20 }}>{history.map((week) => <li key={String(week.id)} style={{ marginBottom: 8 }}><strong>{String(week.week_start)}</strong> · {String(week.commitment)} <span className="ops-field__help">({String(week.status)} · {String(week.declared_status).replace(/_/g, " ")})</span></li>)}</ol></section>}
  </main>;
}
