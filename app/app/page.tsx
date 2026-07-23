import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { roleHomePath } from "@/lib/account";
import { Badge, DataStrip, PageHeader, PageSection } from "@/components/ds";
import type { DataItem } from "@/components/ds";
import { getLeadershipHomeData } from "@/lib/hiring";
import { getDb } from "@/lib/db";
import { listPrograms } from "@/lib/operations";
import { programStageLabel } from "@/lib/operations-shared";
import { entityHref, sessionHref } from "@/lib/routes";
import { getGrowthLeadershipSnapshot } from "@/lib/growth";
import { getGrowthActions } from "@/lib/flywheel";
import { getPeopleOperationsData } from "@/lib/people-operations";

const DAY_MS = 24 * 60 * 60 * 1000;

type Severity = "critical" | "high" | "watch";
type ExceptionDomain = "Programs" | "Delivery" | "Quality" | "People" | "Students" | "Growth" | "Work";

interface OperatingException {
  key: string;
  title: string;
  domain: ExceptionDomain;
  domainHref: string;
  severity: Severity;
  score: number;
  context: string;
  owner: string;
  unassigned: boolean;
  href: string;
  actionLabel: string;
  dueAt?: number | null;
}

interface ClassContextRow {
  class_title: string;
  program_name: string | null;
  owner_name: string | null;
}

const severityStatus: Record<Severity, "negative" | "warning" | "neutral"> = {
  critical: "negative",
  high: "warning",
  watch: "neutral",
};

const severityLabel: Record<Severity, string> = {
  critical: "Act now",
  high: "Next up",
  watch: "Watch",
};

function dateValue(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(`${value}T12:00:00Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function waitingLabel(timestamp: number, now: number): string {
  const days = Math.max(0, Math.floor((now - timestamp) / DAY_MS));
  if (days === 0) return "Entered the queue today.";
  return `Waiting ${days} day${days === 1 ? "" : "s"}.`;
}

function shortDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(timestamp);
}

/**
 * Leadership lands on one ranked management-by-exception queue. Normal work
 * remains in its domain workspace; this surface answers what needs attention,
 * why it matters, who owns it, and where the next decision happens.
 */
export default async function AppHome() {
  const me = await requireUser();
  if (me.role !== "admin" && me.role !== "growth") {
    redirect(roleHomePath(me.role));
  }

  const db = getDb();
  const now = Number(((await db.prepare("SELECT unixepoch('now') * 1000 AS now").get()) as { now: number }).now);
  const [data, programs, growth, growthActions, peopleOperations] = await Promise.all([
    getLeadershipHomeData(),
    listPrograms(),
    getGrowthLeadershipSnapshot(now),
    getGrowthActions(now, 3),
    getPeopleOperationsData({ userId: me.id, role: me.role, now }),
  ]);
  const personNameStatement = db.prepare("SELECT name FROM people WHERE id = ?");
  const userNameStatement = db.prepare("SELECT name FROM users WHERE id = ?");
  const classContextStatement = db.prepare(
    `SELECT c.title AS class_title, p.name AS program_name, u.name AS owner_name
       FROM classes c
       LEFT JOIN programs p ON p.id = c.program_id
       LEFT JOIN users u ON u.id = p.owner_user_id
      WHERE c.id = ?`,
  );
  const personNames = new Map<string, string>();
  const userNames = new Map<string, string>();
  const classContexts = new Map<string, ClassContextRow | null>();
  const personName = async (personId: string): Promise<string> => {
    const cached = personNames.get(personId);
    if (cached) return cached;
    const row = (await personNameStatement.get(personId)) as { name: string } | undefined;
    const name = row?.name?.trim() || "Instructor applicant";
    personNames.set(personId, name);
    return name;
  };
  const userName = async (userId: string | null): Promise<string | null> => {
    if (!userId) return null;
    const cached = userNames.get(userId);
    if (cached) return cached;
    const row = (await userNameStatement.get(userId)) as { name: string } | undefined;
    if (!row?.name?.trim()) return null;
    userNames.set(userId, row.name);
    return row.name;
  };
  const classContext = async (classId: string): Promise<ClassContextRow | null> => {
    if (classContexts.has(classId)) return classContexts.get(classId) ?? null;
    const row = (await classContextStatement.get(classId)) as ClassContextRow | undefined;
    classContexts.set(classId, row ?? null);
    return row ?? null;
  };

  const exceptions: OperatingException[] = [];
  const seen = new Set<string>();
  const add = (item: OperatingException) => {
    if (seen.has(item.key)) return;
    seen.add(item.key);
    exceptions.push(item);
  };

  const terminalProgramStages = new Set(["completed", "renewed", "closed"]);
  const programRisks = programs.filter(
    (summary) => !terminalProgramStages.has(summary.program.stage) && summary.readiness.blockers.length > 0,
  );
  const programRiskIds = new Set(programRisks.map((summary) => summary.program.id));

  for (const summary of programRisks) {
    const launchAt = dateValue(summary.program.launchDate);
    const daysToLaunch = launchAt === null ? null : Math.ceil((launchAt - now) / DAY_MS);
    const imminent = daysToLaunch !== null && daysToLaunch <= 14;
    const deliveryInProgress = ["ready_to_launch", "active"].includes(summary.program.stage);
    const severity: Severity = imminent || deliveryInProgress ? "critical" : "high";
    const nextAction = summary.readiness.nextAction;
    const owner = summary.ownerName ?? nextAction?.owner ?? "Unassigned";
    const launchContext = launchAt
      ? `Launch ${shortDate(launchAt)}${daysToLaunch !== null && daysToLaunch < 0 ? " is overdue" : ""}. `
      : "Launch date is not set. ";
    add({
      key: `program:${summary.program.id}`,
      title: summary.program.name,
      domain: "Programs",
      domainHref: "/app/programs",
      severity,
      score: (severity === "critical" ? 340 : 240) + Math.max(0, 20 - (daysToLaunch ?? 20)),
      context: `${programStageLabel(summary.program.stage)} · ${launchContext}${summary.readiness.primaryBlocker}`,
      owner,
      unassigned: !summary.ownerName,
      href: nextAction?.href ?? `/app/programs/${summary.program.id}`,
      actionLabel: nextAction?.label ?? "Open Program",
      dueAt: launchAt,
    });
  }

  const classRisks = new Map<
    string,
    { item: (typeof data.classesWithoutEligibleInstructor)[number]; noLead: boolean; launchIncomplete: boolean }
  >();
  for (const item of data.classesWithoutEligibleInstructor) {
    classRisks.set(item.id, { item, noLead: true, launchIncomplete: false });
  }
  for (const item of data.classesLaunchingSoonIncomplete) {
    const current = classRisks.get(item.id);
    classRisks.set(item.id, { item, noLead: current?.noLead ?? false, launchIncomplete: true });
  }

  for (const risk of classRisks.values()) {
    if (risk.item.programId && programRiskIds.has(risk.item.programId)) continue;
    const context = (await classContext(risk.item.id));
    const startAt = dateValue(risk.item.startDate);
    const daysToStart = startAt === null ? null : Math.ceil((startAt - now) / DAY_MS);
    const severity: Severity = risk.launchIncomplete || (daysToStart !== null && daysToStart <= 14) ? "critical" : "high";
    const problems = [
      risk.launchIncomplete ? "launch setup is incomplete" : null,
      risk.noLead ? "no eligible lead instructor is assigned" : null,
    ].filter((value): value is string => Boolean(value));
    add({
      key: `class:${risk.item.id}`,
      title: risk.item.title,
      domain: "Delivery",
      domainHref: "/app/classes",
      severity,
      score: severity === "critical" ? 330 : 225,
      context: `${context?.program_name ? `${context.program_name} · ` : "Standalone Class · "}${problems.join(" and ")}.${
        startAt ? ` Starts ${shortDate(startAt)}.` : " Start date is not set."
      }`,
      owner: context?.owner_name ?? "Operations",
      unassigned: !context?.owner_name,
      href: entityHref("class", risk.item.id)!,
      actionLabel: "Resolve delivery risk",
      dueAt: startAt,
    });
  }

  for (const report of data.flaggedSessionReports) {
    const context = (await classContext(report.class_id));
    add({
      key: `session-report:${report.id}`,
      title: `${context?.class_title ?? "Class session"}: quality flag`,
      domain: "Quality",
      domainHref: "/app/classes",
      severity: "critical",
      score: 325,
      context: `${report.flag_reason?.trim() || "The instructor flagged this session for leadership review."} Reported ${shortDate(report.reported_at)}.`,
      owner: context?.owner_name ?? "Program lead",
      unassigned: !context?.owner_name,
      href: sessionHref(report.class_id, report.session_id),
      actionLabel: "Review session",
      dueAt: report.reported_at,
    });
  }

  for (const task of data.openFounderHandoffTasks) {
    const overdue = task.dueAt !== null && task.dueAt < now;
    add({
      key: `task:${task.id}`,
      title: task.title,
      domain: "Work",
      domainHref: "/app/tasks",
      severity: overdue ? "critical" : "high",
      score: overdue ? 320 : 250,
      context: task.dueAt
        ? `${overdue ? "Overdue" : "Due"} ${shortDate(task.dueAt)}. A founder decision or handoff is waiting.`
        : "A founder decision or handoff is waiting without a due date.",
      owner: (await userName(task.ownerUserId)) ?? "Founder",
      unassigned: false,
      href: "/app/tasks",
      actionLabel: "Resolve handoff",
      dueAt: task.dueAt,
    });
  }

  for (const student of data.missingStudentForms) {
    add({
      key: `student:${student.id}`,
      title: `${student.name}: forms incomplete`,
      domain: "Students",
      domainHref: "/app/students",
      severity: "high",
      score: 235,
      context: "Required forms are incomplete for an active student record. Confirm the family follow-up before delivery.",
      owner: "Student operations",
      unassigned: false,
      href: entityHref("student", student.id)!,
      actionLabel: "Complete forms",
    });
  }

  for (const instructor of data.awaitingFounderReview) {
    add({
      key: `instructor:${instructor.id}`,
      title: (await personName(instructor.personId)),
      domain: "People",
      domainHref: "/app/instructors",
      severity: "high",
      score: 255,
      context: `Founder decision is ready. ${waitingLabel(instructor.updatedAt, now)}`,
      owner: "Founder",
      unassigned: false,
      href: entityHref("instructor", instructor.id)!,
      actionLabel: "Make decision",
      dueAt: instructor.updatedAt,
    });
  }

  for (const instructor of data.behindOnOnboardingOrTraining) {
    const owner = (await userName(instructor.ownerUserId));
    add({
      key: `instructor:${instructor.id}`,
      title: (await personName(instructor.personId)),
      domain: "People",
      domainHref: "/app/instructors",
      severity: "high",
      score: 230,
      context: `Onboarding or training has stalled. ${waitingLabel(instructor.updatedAt, now)}`,
      owner: owner ?? "Instructor manager",
      unassigned: !owner,
      href: entityHref("instructor", instructor.id)!,
      actionLabel: "Unblock development",
      dueAt: instructor.updatedAt,
    });
  }

  for (const instructor of data.practiceEvalsNeeded) {
    const owner = (await userName(instructor.ownerUserId));
    add({
      key: `instructor:${instructor.id}`,
      title: (await personName(instructor.personId)),
      domain: "People",
      domainHref: "/app/instructors",
      severity: "high",
      score: 220,
      context: `Practice evaluation evidence is still needed before teaching eligibility. ${waitingLabel(instructor.updatedAt, now)}`,
      owner: owner ?? "Instructor manager",
      unassigned: !owner,
      href: entityHref("instructor", instructor.id)!,
      actionLabel: "Record evaluation",
      dueAt: instructor.updatedAt,
    });
  }

  for (const instructor of data.interviewsToSchedule) {
    const owner = (await userName(instructor.ownerUserId));
    const age = Math.floor((now - instructor.createdAt) / DAY_MS);
    add({
      key: `instructor:${instructor.id}`,
      title: (await personName(instructor.personId)),
      domain: "People",
      domainHref: "/app/instructors",
      severity: age >= 7 ? "high" : "watch",
      score: age >= 7 ? 210 + Math.min(age, 20) : 120 + age,
      context: `Interview has not been scheduled. ${waitingLabel(instructor.createdAt, now)}`,
      owner: owner ?? "Hiring team",
      unassigned: !owner,
      href: entityHref("instructor", instructor.id)!,
      actionLabel: "Schedule interview",
      dueAt: instructor.createdAt,
    });
  }

  for (const instructor of data.newApplications) {
    const owner = (await userName(instructor.ownerUserId));
    add({
      key: `instructor:${instructor.id}`,
      title: (await personName(instructor.personId)),
      domain: "People",
      domainHref: "/app/instructors",
      severity: "watch",
      score: 110,
      context: `New instructor application needs initial review. ${waitingLabel(instructor.createdAt, now)}`,
      owner: owner ?? "Hiring team",
      unassigned: !owner,
      href: entityHref("instructor", instructor.id)!,
      actionLabel: "Review application",
      dueAt: instructor.createdAt,
    });
  }

  // Growth stays in its own operating workspace unless canonical evidence
  // identifies a real decision, ownership gap, or market imbalance.
  for (const item of growth.exceptions) {
    const severity: Severity = item.severity === "urgent" ? "critical" : item.severity === "warning" ? "high" : "watch";
    const owner = item.owner ?? "Unassigned";
    add({
      key: `growth:${item.id}`,
      title: item.title,
      domain: "Growth",
      domainHref: "/app/growth",
      severity,
      score: severity === "critical" ? 325 : severity === "high" ? 225 : 115,
      context: item.detail,
      owner,
      unassigned: !item.owner,
      href: item.href,
      actionLabel: "Resolve in Growth",
    });
  }

  // The People layer raises only real execution/recovery exceptions. Normal
  // weekly work remains with the person and their manager in My People.
  for (const person of peopleOperations.people.filter((candidate) => candidate.standing === "at_risk")) {
    const severe = person.openAccountability > 0 || person.overdueWork > 1;
    add({
      key: `people-ops:${person.personId}`,
      title: `${person.name}: leadership attention`,
      domain: "People",
      domainHref: "/app/people",
      severity: severe ? "critical" : "high",
      score: severe ? 315 : 245,
      context: person.attentionReasons.slice(0, 3).join(" · ") || "A manager-owned recovery decision is waiting.",
      owner: person.managerName ?? "Founder",
      unassigned: !person.managerName,
      href: `/app/people/${person.personId}`,
      actionLabel: "Review person",
    });
  }

  exceptions.sort((a, b) => b.score - a.score || (a.dueAt ?? Number.MAX_SAFE_INTEGER) - (b.dueAt ?? Number.MAX_SAFE_INTEGER) || a.title.localeCompare(b.title));

  const criticalCount = exceptions.filter((item) => item.severity === "critical").length;
  const unassignedCount = exceptions.filter((item) => item.unassigned).length;
  const founderDecisionCount = data.awaitingFounderReview.length + data.openFounderHandoffTasks.length;
  const peopleAttentionCount = peopleOperations.people.filter((person) => person.standing === "at_risk" || person.openAccountability > 0).length;
  const visible = exceptions.slice(0, 15);
  const remaining = Math.max(0, exceptions.length - visible.length);

  const stripItems: DataItem[] = [];
  if (criticalCount > 0) stripItems.push({ label: "Act now", value: String(criticalCount), tone: "negative" });
  if (founderDecisionCount > 0) stripItems.push({ label: "Founder decisions", value: String(founderDecisionCount), tone: "info" });
  if (programRisks.length > 0) stripItems.push({ label: "Programs at risk", value: String(programRisks.length), tone: "warning" });
  if (growth.exceptions.length > 0) stripItems.push({ label: "Growth exceptions", value: String(growth.exceptions.length), tone: "warning" });
  if (peopleAttentionCount > 0) stripItems.push({ label: "People needing attention", value: String(peopleAttentionCount), tone: "warning" });
  if (unassignedCount > 0) stripItems.push({ label: "Without an owner", value: String(unassignedCount), tone: "negative" });

  // Upcoming commitments: sessions and interviews landing in the next 7 days.
  const soonCutoff = now + 7 * DAY_MS;
  const upcomingSessions = (await db
      .prepare(
        `SELECT s.id AS session_id, s.class_id, s.session_date AS scheduled_at, c.title AS class_title
           FROM class_sessions s JOIN classes c ON c.id = s.class_id
          WHERE s.session_date BETWEEN ? AND ?
          ORDER BY s.session_date LIMIT 6`,
      )
      .all(now, soonCutoff)) as { session_id: string; class_id: string; scheduled_at: number; class_title: string }[];
  const upcomingInterviews = (
    (await db
            .prepare(
              `SELECT i.id, i.person_id, i.interview_at FROM instructors i
                WHERE i.interview_at BETWEEN ? AND ? ORDER BY i.interview_at LIMIT 6`,
            )
            .all(now, soonCutoff)) as { id: string; person_id: string; interview_at: number }[]
  );
  const commitments = [
    ...upcomingSessions.map((s) => ({
      key: `session:${s.session_id}`,
      when: s.scheduled_at,
      label: `Session · ${s.class_title}`,
      href: sessionHref(s.class_id, s.session_id),
    })),
    ...(await Promise.all(
      upcomingInterviews.map(async (i) => ({
        key: `interview:${i.id}`,
        when: i.interview_at,
        label: `Interview · ${await personName(i.person_id)}`,
        href: entityHref("instructor", i.id)!,
      })),
    )),
  ].sort((a, b) => a.when - b.when).slice(0, 8);

  // Recent changes: instructors decided and tasks completed in the last 3 days.
  const recentCutoff = now - 3 * DAY_MS;
  const recentDecisions = (
    (await db
            .prepare(
              `SELECT id, person_id, decided_at, founder_decision FROM instructors
                WHERE decided_at IS NOT NULL AND decided_at > ? ORDER BY decided_at DESC LIMIT 5`,
            )
            .all(recentCutoff)) as { id: string; person_id: string; decided_at: number; founder_decision: string | null }[]
  );
  const recentChanges = await Promise.all(
    recentDecisions.map(async (d) => ({
      key: `decision:${d.id}`,
      when: d.decided_at,
      label: `${await personName(d.person_id)} — ${d.founder_decision ?? "decision recorded"}`,
      href: entityHref("instructor", d.id)!,
    })),
  );

  return (
    <main className="ops-page" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHeader eyebrow="BOW HQ" title="Home" context="What needs you, ranked by consequence and time." />

      <section id="attention-queue" aria-labelledby="attention-heading">
        <div className="ops-section-head">
          <h2 id="attention-heading" className="ops-section-title">Attention queue</h2>
          <span className="ops-section-note">{exceptions.length} open exception{exceptions.length === 1 ? "" : "s"}</span>
        </div>

        {visible.length === 0 ? (
          <div className="ops-empty">
            <Badge status="positive">Portfolio clear</Badge>
            <h3 className="ops-empty__title" style={{ marginTop: 12 }}>No exception work is waiting</h3>
            <p className="ops-empty__body">The team can stay focused on planned delivery and growth.</p>
          </div>
        ) : (
          <ol style={{ listStyle: "none", padding: 0, margin: 0, borderTop: "1px solid var(--border-rule)" }}>
            {visible.map((item) => (
              <li key={item.key} style={{ borderBottom: "1px solid var(--border-rule)", padding: "14px 0" }}>
                <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                  <Badge status={severityStatus[item.severity]}>{severityLabel[item.severity]}</Badge>
                  <Link href={item.domainHref} className="ops-label" style={{ textDecoration: "none", color: "var(--bow-blue)" }}>{item.domain}</Link>
                  {item.unassigned && <Badge status="negative">Owner needed</Badge>}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 420px", minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.35, color: "var(--bow-ink)" }}>{item.title}</h3>
                    <p className="ops-body" style={{ margin: "5px 0 0" }}>{item.context}</p>
                    <span className="ops-label" style={{ display: "block", marginTop: 9 }}>Accountable · {item.owner}</span>
                  </div>
                  <Link href={item.href} className="ops-inline-link" style={{ alignSelf: "center", textDecoration: "none", whiteSpace: "nowrap" }}>
                    {item.actionLabel} →
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        )}
        {remaining > 0 && (
          <p className="ops-body" style={{ margin: "10px 0 0", fontSize: 12.5 }}>
            {remaining} lower-ranked exception{remaining === 1 ? " remains" : "s remain"} in the linked operating workspaces.
          </p>
        )}
      </section>

      {stripItems.length > 0 && <DataStrip items={stripItems} dense />}

      {commitments.length > 0 && (
        <PageSection title="Upcoming commitments">
          <div style={{ display: "flex", flexDirection: "column" }}>
            {commitments.map((c) => (
              <Link
                key={c.key}
                href={c.href}
                style={{
                  display: "flex", justifyContent: "space-between", gap: 12, textDecoration: "none",
                  padding: "10px 0", borderBottom: "1px solid var(--border-rule)", color: "var(--bow-ink)",
                }}
              >
                <span style={{ fontFamily: "var(--font-interface)", fontSize: 14 }}>{c.label}</span>
                <span className="ops-label">{shortDate(c.when)}</span>
              </Link>
            ))}
          </div>
        </PageSection>
      )}

      {recentChanges.length > 0 && (
        <PageSection title="Recent changes">
          <div style={{ display: "flex", flexDirection: "column" }}>
            {recentChanges.map((c) => (
              <Link
                key={c.key}
                href={c.href}
                style={{
                  display: "flex", justifyContent: "space-between", gap: 12, textDecoration: "none",
                  padding: "10px 0", borderBottom: "1px solid var(--border-rule)", color: "var(--bow-ink)",
                }}
              >
                <span style={{ fontFamily: "var(--font-interface)", fontSize: 14 }}>{c.label}</span>
                <span className="ops-label">{shortDate(c.when)}</span>
              </Link>
            ))}
          </div>
        </PageSection>
      )}

      {growthActions.length > 0 && (
        <PageSection
          title="Growth actions"
          action={<Link className="ops-inline-link" href="/app/growth">All growth actions →</Link>}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            {growthActions.map((action) => (
              <div key={action.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border-rule)" }}>
                <div>
                  <Link className="ops-record-name" href={action.entityHref}>{action.entityLabel}</Link>
                  <span className="ops-record-meta" style={{ display: "block" }}>{action.reason} {action.action}</span>
                </div>
                <Link className="ops-inline-link" href={action.entityHref}>{action.ctaLabel}</Link>
              </div>
            ))}
          </div>
        </PageSection>
      )}

      <nav aria-label="Workspaces" style={{ display: "flex", alignItems: "center", gap: "10px 22px", flexWrap: "wrap", paddingTop: 8, borderTop: "1px solid var(--border-rule)" }}>
        {[
          ["Programs", "/app/programs"],
          ["Growth", "/app/growth"],
          ["Work", "/app/tasks"],
          ["People", "/app/people"],
          ["Locations", "/app/locations"],
        ].map(([label, href]) => (
          <Link key={href} href={href} className="ops-inline-link" style={{ textDecoration: "none" }}>
            {label} →
          </Link>
        ))}
      </nav>
    </main>
  );
}
