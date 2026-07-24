import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, PageSection, RecordShell } from "@/components/ds";
import WeeklyCommitmentEditor from "@/components/app/people/WeeklyCommitmentEditor";
import { AccountabilityControls, ActivationControls, CapacityControls, RoleAssignmentSetup, RoleDecisionControls } from "@/components/app/people/PersonOperatingControls";
import InstructorDetailActions from "@/components/app/hiring/InstructorDetailActions";
import InstructorWorkforceActions from "@/components/app/hiring/InstructorWorkforceActions";
import InstructorMissionControls from "@/components/app/hiring/InstructorMissionControls";
import IntroductionTracker from "@/components/app/hiring/IntroductionTracker";
import StudentDetailActions from "@/components/app/students/StudentDetailActions";
import { requireStaff } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { getPeopleOperationsData, type PersonAttentionView } from "@/lib/people-operations";
import { resolvePersonRoleIds, type PersonRoleKind } from "@/lib/people-directory";
import { getInstructorDetail, getStudentDetail, getStudentAttendanceHistory, listActivity, listOpenTasksForEntity, listStaffUsers, resolveUserNames } from "@/lib/hiring";
import { getInstructorWorkforceDossier } from "@/lib/instructor-workforce";
import { getMissionWithUpdates, getMissionHistory } from "@/lib/instructor-missions";
import { missionAreaMeta, missionIsOverdue, MISSION_UPDATE_KIND_LABEL } from "@/lib/instructor-missions-shared";
import { canonicalDateInZone } from "@/lib/timezone";
import { listIntroductions } from "@/lib/flywheel";

type TabKey = "overview" | "operations" | "instructor" | "student" | "applicant";

function label(value: unknown): string {
  return String(value ?? "—").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function when(value: number | string | null | undefined): string {
  if (value == null) return "—";
  const date = new Date(typeof value === "string" ? value : Number(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

/**
 * Renders one role section in isolation — a data error in the Instructor
 * dossier (say) must not take down the whole canonical person record, which
 * also carries Operations/Student/Applicant sections that are independently
 * useful. Fails safe with an inline notice instead of the route's error
 * boundary.
 */
async function renderSafely(sectionLabel: string, render: () => Promise<ReactNode>): Promise<ReactNode> {
  try {
    return await render();
  } catch (error) {
    console.error(`[people/[id]] ${sectionLabel} section failed to render`, error);
    return (
      <section className="ops-alert" data-tone="warning">
        <span className="ops-label">{sectionLabel}</span>
        <p className="ops-body" style={{ marginTop: 6 }}>This section couldn&rsquo;t load right now. The rest of this person&rsquo;s record is unaffected.</p>
      </section>
    );
  }
}

export default async function PersonRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const me = await requireStaff();
  const { id: personId } = await params;
  const { tab } = await searchParams;

  const db = getDb();
  const personRow = (await db.prepare(
    "SELECT id, name, email, phone, identity_status FROM people WHERE id = ?",
  ).get(personId)) as { id: string; name: string; email: string | null; phone: string | null; identity_status: string } | undefined;
  if (!personRow) notFound();

  const roleIds = await resolvePersonRoleIds(personId);
  const opsData = await getPeopleOperationsData({ userId: me.id, role: me.role });
  const opsPerson = opsData.people.find((p) => p.personId === personId);

  const roleBadges: { kind: PersonRoleKind; label: string }[] = [];
  if (roleIds.instructorId) roleBadges.push({ kind: "instructor", label: "Instructor" });
  if (roleIds.studentId) roleBadges.push({ kind: "student", label: "Student" });
  if (roleIds.applicationId) roleBadges.push({ kind: "applicant", label: "Applicant" });
  if (opsPerson?.roleAssignmentId) roleBadges.push({ kind: "staff", label: opsPerson.roleTitle });

  const availableTabs: { key: TabKey; label: string }[] = [{ key: "overview", label: "Overview" }];
  if (opsPerson) availableTabs.push({ key: "operations", label: "Operations" });
  if (roleIds.instructorId) availableTabs.push({ key: "instructor", label: "Instructor" });
  if (roleIds.studentId) availableTabs.push({ key: "student", label: "Student" });
  if (roleIds.applicationId) availableTabs.push({ key: "applicant", label: "Applicant" });

  const activeTab: TabKey = availableTabs.some((t) => t.key === tab) ? (tab as TabKey) : "overview";

  return (
    <RecordShell
      eyebrow="People · Canonical person record"
      title={personRow.name}
      subtitle={[personRow.email, personRow.phone].filter(Boolean).join(" · ") || "No contact info on file"}
      status={
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {roleBadges.map((role) => (
            <Badge status="info" key={role.kind}>{role.label}</Badge>
          ))}
          {roleBadges.length === 0 && <Badge status="neutral">No active role</Badge>}
        </div>
      }
    >
      <nav aria-label="Person record sections" style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border-rule)", marginBottom: 4, flexWrap: "wrap" }}>
        {availableTabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "overview" ? `/app/people/${personId}` : `/app/people/${personId}?tab=${t.key}`}
            aria-current={activeTab === t.key ? "page" : undefined}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "10px 14px",
              fontFamily: "var(--font-interface)",
              fontSize: 13,
              fontWeight: 600,
              color: activeTab === t.key ? "var(--bow-ink)" : "var(--bow-slate)",
              borderBottom: activeTab === t.key ? "2px solid var(--bow-blue)" : "2px solid transparent",
              marginBottom: -1,
              textDecoration: "none",
            }}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {activeTab === "overview" && (
        <OverviewTab personId={personId} personRow={personRow} roleBadges={roleBadges} opsPerson={opsPerson} roleIds={roleIds} />
      )}
      {activeTab === "operations" && opsPerson && await renderSafely("Operations", () => OperationsSection({ personId, me, opsPerson, opsData }))}
      {activeTab === "instructor" && roleIds.instructorId && await renderSafely("Instructor", () => InstructorSection({ instructorId: roleIds.instructorId!, me }))}
      {activeTab === "student" && roleIds.studentId && await renderSafely("Student", () => StudentSection({ studentId: roleIds.studentId! }))}
      {activeTab === "applicant" && roleIds.applicationId && await renderSafely("Applicant", () => ApplicantSection({ applicationId: roleIds.applicationId!, roleIds }))}
    </RecordShell>
  );
}

/* ---------------------------------------------------------------------- */
/* Overview — calm, read-only summary + top actions. No forms.            */
/* ---------------------------------------------------------------------- */

function OverviewTab({
  personId,
  opsPerson,
  roleIds,
}: {
  personId: string;
  personRow: { name: string; email: string | null; phone: string | null; identity_status: string };
  roleBadges: { kind: PersonRoleKind; label: string }[];
  opsPerson: PersonAttentionView | undefined;
  roleIds: { instructorId: string | null; studentId: string | null; applicationId: string | null };
}) {
  const attentionItems: string[] = [];
  if (opsPerson) {
    if (opsPerson.standing === "at_risk" || opsPerson.standing === "needs_attention") {
      attentionItems.push(...opsPerson.attentionReasons.slice(0, 3));
    }
  }

  const actions: { label: string; href: string }[] = [];
  if (opsPerson) actions.push({ label: "Set this week's commitment", href: `/app/people/${personId}?tab=operations` });
  if (roleIds.instructorId) actions.push({ label: "View instructor dossier", href: `/app/people/${personId}?tab=instructor` });
  if (roleIds.studentId) actions.push({ label: "View student record", href: `/app/people/${personId}?tab=student` });
  if (roleIds.applicationId) actions.push({ label: "View application", href: `/app/people/${personId}?tab=applicant` });

  return (
    <div style={{ display: "grid", gap: 4 }}>
      <PageSection title="Status" noRule>
        {opsPerson ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: attentionItems.length ? 10 : 0 }}>
            <Badge status={opsPerson.standing === "at_risk" ? "negative" : opsPerson.standing === "needs_attention" ? "warning" : "positive"}>{label(opsPerson.standing)}</Badge>
            <Badge status="neutral">{opsPerson.assignmentStatus ? label(opsPerson.assignmentStatus) : "No assignment"}</Badge>
          </div>
        ) : (
          <p className="ops-body">No operating status tracked for this person.</p>
        )}
        {attentionItems.length > 0 ? (
          <ul className="ops-body" style={{ margin: 0, paddingLeft: 18 }}>
            {attentionItems.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        ) : opsPerson ? (
          <p className="ops-body" style={{ margin: 0 }}>Nothing needs attention right now.</p>
        ) : null}
      </PageSection>

      {actions.length > 0 && (
        <PageSection title="What to do next">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {actions.map((action) => (
              <Link key={action.href} href={action.href} className="ops-inline-link">{action.label} →</Link>
            ))}
          </div>
        </PageSection>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Operations / staff — re-houses PersonOperatingControls unchanged        */
/* ---------------------------------------------------------------------- */

async function OperationsSection({
  personId,
  me,
  opsPerson,
  opsData,
}: {
  personId: string;
  me: { id: string; role: string };
  opsPerson: NonNullable<Awaited<ReturnType<typeof getPeopleOperationsData>>["people"][number]>;
  opsData: Awaited<ReturnType<typeof getPeopleOperationsData>>;
}) {
  const db = getDb();
  const requirements = opsPerson.roleAssignmentId ? (await db.prepare(
    "SELECT id, label, status, source_type, decision_note FROM role_activation_requirements WHERE role_assignment_id = ? ORDER BY created_at",
  ).all(opsPerson.roleAssignmentId)) as Array<{ id: string; label: string; status: string; source_type: string | null; decision_note: string | null }> : [];
  const accountability = (await db.prepare(
    "SELECT id, event_type, reason, recovery_commitment, created_at FROM people_accountability_events WHERE person_id = ? AND status = 'open' ORDER BY created_at DESC",
  ).all(personId)) as Array<{ id: string; event_type: string; reason: string; recovery_commitment: string | null; created_at: number }>;
  const playbookLessons = ((await db.prepare(
    `SELECT id, title FROM learn_lessons WHERE published_version_id IS NOT NULL AND lifecycle = 'active' ORDER BY title`,
  ).all()) as Array<{ id: string; title: string }>).map((lesson) => ({ id: lesson.id, title: lesson.title }));
  const roles = ((await db.prepare("SELECT id, title FROM org_roles WHERE status = 'active' ORDER BY title").all()) as Array<{ id: string; title: string }>).map((role) => ({ id: role.id, title: role.title }));
  const managerAssignments = ((await db.prepare(
    `SELECT ra.id, p.name || ' · ' || r.title AS label FROM role_assignments ra
      JOIN people p ON p.id = ra.person_id JOIN org_roles r ON r.id = ra.role_id
     WHERE ra.status IN ('activating','active') AND ra.person_id <> ? ORDER BY p.name`,
  ).all(personId)) as Array<{ id: string; label: string }>).map((manager) => ({ id: manager.id, label: manager.label }));
  const assignmentDetails = opsPerson.roleAssignmentId ? (await db.prepare(
    "SELECT manager_assignment_id FROM role_assignments WHERE id = ?",
  ).get(opsPerson.roleAssignmentId)) as { manager_assignment_id: string | null } | undefined : undefined;
  const personTasks = opsData.tasks.filter((task) => task.personId === personId);
  const canManagePerson = me.role === "admin" || opsPerson.userId !== me.id;
  const hasEvidence = Object.values(opsPerson.evidence).some((count) => count > 0);

  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Badge status={opsPerson.standing === "at_risk" ? "negative" : opsPerson.standing === "needs_attention" ? "warning" : "positive"}>{label(opsPerson.standing)}</Badge>
        <Badge status="neutral">{opsPerson.assignmentStatus ? label(opsPerson.assignmentStatus) : "No assignment"}</Badge>
        <Badge status="neutral">{label(opsPerson.availabilityStatus)}</Badge>
      </div>

      <PageSection title="This week">
        <WeeklyCommitmentEditor personId={personId} personName={opsPerson.name} weekStart={opsData.currentWeekStart} cycle={opsPerson.currentWeek} tasks={personTasks} outcomes={opsData.outcomes} managerMode={opsPerson.userId !== me.id} />
      </PageSection>

      <PageSection title="Current work">
        <p className="ops-body">{opsPerson.openWork} open · {opsPerson.overdueWork} overdue · {opsPerson.waitingReview} awaiting review · {opsPerson.blockedWork} revisions</p>
        <Link href="/app/tasks" className="ops-inline-link">Open canonical Work queue →</Link>
      </PageSection>

      <PageSection title="Performance evidence">
        {hasEvidence ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {Object.entries(opsPerson.evidence).map(([dimension, count]) => (
              <div key={dimension}><span className="ops-label">{dimension}</span><strong style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 24 }}>{count}</strong></div>
            ))}
          </div>
        ) : (
          <p className="ops-body">No performance evidence in the last 90 days.</p>
        )}
      </PageSection>

      {me.role === "admin" && (
        <PageSection title="Assignment & manager">
          <RoleAssignmentSetup personId={personId} roleAssignmentId={opsPerson.roleAssignmentId} roles={roles} managerAssignments={managerAssignments} currentManagerAssignmentId={assignmentDetails?.manager_assignment_id ?? null} />
        </PageSection>
      )}

      {opsPerson.roleAssignmentId && (
        <>
          <PageSection title="Capacity">
            <CapacityControls roleAssignmentId={opsPerson.roleAssignmentId} initialHours={opsPerson.weeklyCapacityHours} initialAvailability={opsPerson.availabilityStatus} />
          </PageSection>
          <PageSection title="Role activation">
            <ActivationControls roleAssignmentId={opsPerson.roleAssignmentId} requirements={requirements.map((item) => ({ id: item.id, label: item.label, status: item.status, sourceType: item.source_type, decisionNote: item.decision_note }))} lessons={playbookLessons} canManage={canManagePerson} />
          </PageSection>
          {canManagePerson && (
            <PageSection title="Role & autonomy">
              <RoleDecisionControls roleAssignmentId={opsPerson.roleAssignmentId} status={opsPerson.assignmentStatus ?? "activating"} autonomy={opsPerson.autonomyLevel ?? 2} />
            </PageSection>
          )}
        </>
      )}

      <PageSection title="Accountability">
        <AccountabilityControls events={accountability.map((event) => ({ id: event.id, eventType: event.event_type, reason: event.reason, recoveryCommitment: event.recovery_commitment, createdAt: Number(event.created_at) }))} canManage={canManagePerson} />
      </PageSection>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Instructor — re-houses InstructorDetailActions / WorkforceActions /    */
/* IntroductionTracker unchanged, keyed on instructors.id resolved above.  */
/* ---------------------------------------------------------------------- */

async function InstructorSection({ instructorId, me }: { instructorId: string; me: { id: string; role: string } }) {
  const detail = await getInstructorDetail(instructorId);
  const dossier = await getInstructorWorkforceDossier(instructorId);
  if (!detail || !dossier) return null;
  const { instructor } = detail;
  const introductions = await listIntroductions("instructor", instructorId);
  const openTasks = await listOpenTasksForEntity("instructor", instructorId);
  const activity = (await listActivity("instructor", instructorId)).slice(0, 15);
  const staffUsers = await listStaffUsers();
  const resolvedOwnerName = instructor.ownerUserId ? (await resolveUserNames([instructor.ownerUserId])).get(instructor.ownerUserId) : null;

  const missionData = await getMissionWithUpdates(instructorId);
  const missionHistory = await getMissionHistory(instructorId, 8);
  // Let staff link a new mission to a Class or Program this instructor already
  // touches, so a Current Mission carries real operating context.
  const relatedOptions: { value: string; label: string }[] = [];
  const seenRelated = new Set<string>();
  for (const assignment of dossier.currentAssignments) {
    const classKey = `class:${assignment.classId}`;
    if (!seenRelated.has(classKey)) { seenRelated.add(classKey); relatedOptions.push({ value: classKey, label: `Class · ${assignment.classTitle}` }); }
    if (assignment.programId) {
      const programKey = `program:${assignment.programId}`;
      if (!seenRelated.has(programKey)) { seenRelated.add(programKey); relatedOptions.push({ value: programKey, label: `Program · ${assignment.programName}` }); }
    }
  }
  const nowMs = Number(((await getDb().prepare("SELECT unixepoch('now') * 1000 AS now").get()) as { now: number }).now);
  const missionToday = canonicalDateInZone(nowMs);

  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div className="ops-status-line" style={{ marginTop: 0 }}>
        <Badge status="info">{label(instructor.stage)}</Badge>
        <Badge status={instructor.trainingStatus === "complete" ? "positive" : "warning"}>Training · {label(instructor.trainingStatus)}</Badge>
        <Link href={`/app/instructors/${instructorId}`} className="ops-inline-link">Full dossier →</Link>
      </div>

      <div className="ops-alert" data-tone={dossier.nextAction.tone}>
        <span className="ops-label">Next action</span>
        <h3 className="ops-alert__title" style={{ marginTop: 7 }}>{dossier.nextAction.title}</h3>
        <p className="ops-body" style={{ marginTop: 5 }}>{dossier.nextAction.detail}</p>
      </div>

      <PageSection title="Current mission">
        {missionData ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="ops-alert" data-tone={missionIsOverdue(missionData.mission.dueOn, missionToday) ? "warning" : "positive"} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Badge status="info">{missionAreaMeta(missionData.mission.area).label}</Badge>
                {missionData.mission.dueOn && (
                  <Badge status={missionIsOverdue(missionData.mission.dueOn, missionToday) ? "negative" : "neutral"}>
                    {missionIsOverdue(missionData.mission.dueOn, missionToday) ? "Overdue " : "Due "}{missionData.mission.dueOn}
                  </Badge>
                )}
                {missionData.mission.cadence !== "once" && <span className="ops-label">{missionData.mission.cadence} cadence</span>}
              </div>
              <h3 className="ops-alert__title" style={{ margin: "2px 0 0" }}>{missionData.mission.title}</h3>
              <p className="ops-body" style={{ margin: 0 }}>{missionData.mission.outcome}</p>
              <span className="ops-record-meta">
                {missionData.mission.relatedEntityLabel ? `Linked to ${missionData.mission.relatedEntityLabel} · ` : ""}
                Assigned {when(missionData.mission.createdAt)}{missionData.mission.assignedByName ? ` by ${missionData.mission.assignedByName}` : ""}
              </span>
            </div>

            {missionData.updates.length > 0 && (
              <div className="ops-timeline">
                {missionData.updates.slice(0, 6).map((update) => (
                  <div className="ops-timeline__item" key={update.id}>
                    <span className="ops-record-meta">
                      {new Date(update.createdAt).toLocaleDateString()} · {MISSION_UPDATE_KIND_LABEL[update.kind]}{update.authorName ? ` · ${update.authorName}` : ""}
                    </span>
                    <p className="ops-body" style={{ marginTop: 3 }}>{update.body}</p>
                  </div>
                ))}
              </div>
            )}

            <InstructorMissionControls instructorId={instructorId} instructorName={dossier.profile.name} missionId={missionData.mission.id} relatedOptions={relatedOptions} />
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <p className="ops-body" style={{ margin: 0 }}>
              No Current Mission. Give this instructor one clear responsibility right now — teaching or a growth mission — so they are moving forward, not sitting idle.
            </p>
            <InstructorMissionControls instructorId={instructorId} instructorName={dossier.profile.name} missionId={null} relatedOptions={relatedOptions} />
          </div>
        )}

        {missionHistory.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <span className="ops-label">Mission history</span>
            <div className="ops-list" style={{ marginTop: 6 }}>
              {missionHistory.map((mission) => (
                <div className="ops-list-row" key={mission.id}>
                  <div>
                    <span className="ops-record-name">{mission.title}</span>
                    <span className="ops-record-meta">{missionAreaMeta(mission.area).label} · {when(mission.completedAt)}</span>
                  </div>
                  <Badge status={mission.status === "completed" && mission.completionOutcome === "delivered" ? "positive" : mission.status === "cancelled" ? "locked" : "neutral"}>
                    {mission.status === "completed" ? label(mission.completionOutcome ?? "completed") : "Cancelled"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </PageSection>

      {instructor.source === "people_work_application" && (
        <div className="ops-alert" data-tone="info">
          <span className="ops-label">Onboarding origin</span>
          <p className="ops-body" style={{ marginTop: 6 }}>This instructor record began as an accepted hiring application.</p>
          <p style={{ marginTop: 8 }}>
            <Link href={`/app/hiring/applications/${instructorId}`} className="ops-inline-link">View the originating application cockpit →</Link>
          </p>
        </div>
      )}

      <PageSection title="Pipeline & access decisions">
        <InstructorDetailActions
          instructorId={instructorId}
          stage={instructor.stage}
          trainingStatus={instructor.trainingStatus}
          isAdmin={me.role === "admin"}
          isStaff={me.role === "admin" || me.role === "growth"}
          staffUsers={staffUsers}
          availability={detail.availability.map((slot) => ({ dayOfWeek: slot.dayOfWeek, startTime: slot.startTime, endTime: slot.endTime, notes: slot.notes ?? "" }))}
        />
      </PageSection>

      <PageSection title={`Assignments · ${dossier.workload.currentClasses}/${dossier.workload.maximumClasses} weekly slots`}>
        {dossier.currentAssignments.length === 0 ? <p className="ops-body">No current Class assignments.</p> : (
          <div className="ops-list">
            {dossier.currentAssignments.map((a) => (
              <div className="ops-list-row" key={a.id}>
                <div><Link className="ops-record-name" href={`/app/classes/${a.classId}`}>{a.classTitle}</Link><span className="ops-record-meta">{a.programName}</span></div>
                <span className="ops-value">{label(a.role)}</span>
                <Badge status="positive">{label(a.status)}</Badge>
              </div>
            ))}
          </div>
        )}
      </PageSection>

      <InstructorWorkforceActions
        instructorId={instructorId}
        instructorName={dossier.profile.name}
        stage={instructor.stage}
        progressionLevel={dossier.profile.progressionLevel}
        maxWeeklyClasses={dossier.profile.maxWeeklyClasses}
        developmentFocus={dossier.profile.developmentFocus}
        staffUsers={staffUsers}
        qualificationOptions={dossier.qualificationOptions}
        feedbackContextOptions={dossier.feedbackContextOptions}
        qualifications={dossier.qualifications.map((q) => ({ id: q.id, kind: q.kind, label: q.label, status: q.status }))}
        developmentItems={dossier.development.map((item) => ({ id: item.id, title: item.title, kind: item.kind, stage: item.stage, status: item.status }))}
      />

      <PageSection title={`Open Work · ${openTasks.length}`}>
        {openTasks.length === 0 ? <p className="ops-body">No open Work linked to this instructor.</p> : (
          <div className="ops-list">
            {openTasks.map((task) => (
              <div className="ops-meta" key={task.id}><span className="ops-value">{task.title}</span><span className="ops-record-meta">{label(task.kind)}</span></div>
            ))}
          </div>
        )}
      </PageSection>

      <PageSection title="Owner & source">
        <p className="ops-body">Owner: {instructor.ownerUserId ? (resolvedOwnerName && resolvedOwnerName !== instructor.ownerUserId ? resolvedOwnerName : "Former staff member") : "Unassigned"} · Source: {instructor.source ? label(instructor.source) : "—"}</p>
      </PageSection>

      {activity.length > 0 && (
        <PageSection title="Recent activity">
          <div className="ops-timeline">
            {activity.map((item) => (
              <div className="ops-timeline__item" key={item.id}>
                <span className="ops-record-meta">{new Date(item.createdAt).toLocaleString()} · {label(item.kind)}</span>
                <p className="ops-body" style={{ marginTop: 3 }}>{item.body}</p>
              </div>
            ))}
          </div>
        </PageSection>
      )}

      <IntroductionTracker introducerType="instructor" introducerId={instructorId} introductions={introductions} />
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Student — re-houses StudentDetailActions unchanged.                    */
/* ---------------------------------------------------------------------- */

async function StudentSection({ studentId }: { studentId: string }) {
  const detail = await getStudentDetail(studentId);
  if (!detail) return null;
  const { student, guardian, enrollments } = detail;
  const db = getDb();
  const classRows = await Promise.all(enrollments.map(async (e) => {
    const cls = (await db.prepare("SELECT * FROM classes WHERE id = ?").get(e.classId)) as { title?: string; status?: string } | undefined;
    return { enrollment: e, title: cls?.title ?? e.classId, status: cls?.status ?? "—" };
  }));
  const attendance = (await getStudentAttendanceHistory(studentId)) as Array<{ id: string; session_date: string; class_title: string; present: boolean }>;

  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div className="ops-status-line" style={{ marginTop: 0 }}>
        <Badge status={student.formStatus === "complete" ? "positive" : student.formStatus === "submitted" ? "warning" : "negative"}>Forms: {label(student.formStatus)}</Badge>
        <Badge status={student.enrollmentStatus === "active" ? "positive" : "locked"}>{label(student.enrollmentStatus)}</Badge>
      </div>

      <PageSection title="Details">
        <div className="ops-meta-grid">
          <div className="ops-meta"><span className="ops-label">Age / Grade</span><span className="ops-value">{student.age ?? "—"} / {student.grade ?? "—"}</span></div>
          <div className="ops-meta"><span className="ops-label">Student email</span><span className="ops-value">{student.email ?? "—"}</span></div>
          <div className="ops-meta"><span className="ops-label">Guardian</span><span className="ops-value">{guardian ? `${guardian.name} (${guardian.email})` : "—"}</span></div>
        </div>
      </PageSection>

      <PageSection title="Classes">
        {classRows.length === 0 ? <p className="ops-body">Not enrolled in any classes.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {classRows.map((row) => (
              <div key={row.enrollment.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <Link href={`/app/classes/${row.enrollment.classId}`} className="ops-inline-link">{row.title}</Link>
                <Badge status={row.enrollment.status === "enrolled" ? "positive" : "neutral"}>{row.enrollment.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </PageSection>

      <PageSection title="Attendance history">
        {attendance.length === 0 ? <p className="ops-body">No attendance recorded yet.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {attendance.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span className="ops-value">{when(a.session_date)} — {a.class_title}</span>
                <Badge status={a.present ? "positive" : "negative"}>{a.present ? "Present" : "Absent"}</Badge>
              </div>
            ))}
          </div>
        )}
      </PageSection>

      <StudentDetailActions
        key={student.updatedAt}
        studentId={studentId}
        formStatus={student.formStatus}
        communicationNotes={student.communicationNotes ?? ""}
        enrollmentStatus={student.enrollmentStatus}
        expectedUpdatedAt={student.updatedAt}
      />
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Applicant — summary + strong cross-link to the full hiring cockpit     */
/* (Stage 5 owns the full journey; ApplicationCockpitActions stays there  */
/* rather than being duplicated here).                                   */
/* ---------------------------------------------------------------------- */

async function ApplicantSection({ applicationId, roleIds }: { applicationId: string; roleIds: { instructorId: string | null } }) {
  const db = getDb();
  const app = (await db.prepare(
    `SELECT a.lifecycle_status, a.next_action, a.waiting_on, ov.title AS opening_title, u.name AS owner_name
       FROM applications a
       JOIN opening_versions ov ON ov.id = a.opening_version_id
       LEFT JOIN users u ON u.id = a.owner_user_id
      WHERE a.id = ?`,
  ).get(applicationId)) as { lifecycle_status: string; next_action: string | null; waiting_on: string | null; opening_title: string; owner_name: string | null } | undefined;
  if (!app) return null;

  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div className="ops-status-line" style={{ marginTop: 0 }}>
        <span className="ops-record-meta">{app.opening_title}</span>
        <Badge status={app.lifecycle_status === "accepted" ? "positive" : app.lifecycle_status === "rejected" ? "negative" : "info"}>{label(app.lifecycle_status)}</Badge>
      </div>
      {app.lifecycle_status === "accepted" && roleIds.instructorId && (
        <div className="ops-alert" data-tone="positive">
          <span className="ops-label">Accepted — onboarding begins</span>
          <p className="ops-body" style={{ marginTop: 6 }}>
            This application was accepted and became the instructor onboarding record.
          </p>
          <p style={{ marginTop: 8 }}>
            <Link href={`?tab=instructor`} className="ops-inline-link">Go to Instructor tab →</Link>
          </p>
        </div>
      )}
      <PageSection title="Application">
        <div className="ops-meta-grid">
          <div className="ops-meta"><span className="ops-label">Next action</span><span className="ops-value">{app.next_action ?? app.waiting_on ?? "Final"}</span></div>
          <div className="ops-meta"><span className="ops-label">Owner</span><span className="ops-value">{app.owner_name ?? "Unassigned"}</span></div>
        </div>
        <Link href={`/app/hiring/applications/${applicationId}`} className="ops-inline-link" style={{ display: "inline-block", marginTop: 10 }}>
          Open full candidate cockpit →
        </Link>
      </PageSection>
    </div>
  );
}
