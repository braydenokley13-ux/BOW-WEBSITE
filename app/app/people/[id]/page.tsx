import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, RecordShell } from "@/components/ds";
import WeeklyCommitmentEditor from "@/components/app/people/WeeklyCommitmentEditor";
import { AccountabilityControls, ActivationControls, CapacityControls, RoleAssignmentSetup, RoleDecisionControls } from "@/components/app/people/PersonOperatingControls";
import InstructorDetailActions from "@/components/app/hiring/InstructorDetailActions";
import InstructorWorkforceActions from "@/components/app/hiring/InstructorWorkforceActions";
import IntroductionTracker from "@/components/app/hiring/IntroductionTracker";
import StudentDetailActions from "@/components/app/students/StudentDetailActions";
import { requireStaff } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { getPeopleOperationsData } from "@/lib/people-operations";
import { resolvePersonRoleIds, type PersonRoleKind } from "@/lib/people-directory";
import { getInstructorDetail, getStudentDetail, getStudentAttendanceHistory, listActivity, listOpenTasksForEntity, listStaffUsers, resolveUserNames } from "@/lib/hiring";
import { getInstructorWorkforceDossier } from "@/lib/instructor-workforce";
import { listIntroductions } from "@/lib/flywheel";

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
async function renderSafely(label: string, render: () => Promise<ReactNode>): Promise<ReactNode> {
  try {
    return await render();
  } catch (error) {
    console.error(`[people/[id]] ${label} section failed to render`, error);
    return (
      <section className="ops-alert" data-tone="warning">
        <span className="ops-label">{label}</span>
        <p className="ops-body" style={{ marginTop: 6 }}>This section couldn&rsquo;t load right now. The rest of this person&rsquo;s record is unaffected.</p>
      </section>
    );
  }
}

export default async function PersonRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStaff();
  const { id: personId } = await params;

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
      actions={
        <nav aria-label="Jump to section" style={{ display: "flex", gap: 12 }}>
          {opsPerson && <a className="ops-inline-link" href="#staff">Operations</a>}
          {roleIds.instructorId && <a className="ops-inline-link" href="#instructor">Instructor</a>}
          {roleIds.studentId && <a className="ops-inline-link" href="#student">Student</a>}
          {roleIds.applicationId && <a className="ops-inline-link" href="#applicant">Applicant</a>}
        </nav>
      }
    >
      {opsPerson && await renderSafely("Operations", () => OperationsSection({ personId, me, opsPerson, opsData }))}
      {roleIds.instructorId && await renderSafely("Instructor", () => InstructorSection({ instructorId: roleIds.instructorId!, me }))}
      {roleIds.studentId && await renderSafely("Student", () => StudentSection({ studentId: roleIds.studentId! }))}
      {roleIds.applicationId && await renderSafely("Applicant", () => ApplicantSection({ applicationId: roleIds.applicationId! }))}
      {!opsPerson && !roleIds.instructorId && !roleIds.studentId && !roleIds.applicationId && (
        <section className="ops-empty">
          <h2 className="ops-empty__title">No role records found for this person.</h2>
          <p className="ops-empty__body">This human exists in the people spine but has no instructor, student, applicant, or staff role attached yet.</p>
        </section>
      )}
    </RecordShell>
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

  return (
    <section id="staff" className="ops-anchor" style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Badge status={opsPerson.standing === "at_risk" ? "negative" : opsPerson.standing === "needs_attention" ? "warning" : "positive"}>{label(opsPerson.standing)}</Badge>
        <Badge status="neutral">{opsPerson.assignmentStatus ? label(opsPerson.assignmentStatus) : "No assignment"}</Badge>
        <Badge status="neutral">{label(opsPerson.availabilityStatus)}</Badge>
      </div>

      <div className="ops-panel" style={{ padding: 20 }}>
        <span className="ops-label">One primary result</span>
        <h2 className="ops-section-title">This week</h2>
        <WeeklyCommitmentEditor personId={personId} personName={opsPerson.name} weekStart={opsData.currentWeekStart} cycle={opsPerson.currentWeek} tasks={personTasks} outcomes={opsData.outcomes} managerMode={opsPerson.userId !== me.id} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        <div className="ops-panel" style={{ padding: 18 }}>
          <span className="ops-label">Execution</span>
          <h2 className="ops-section-title">Current work</h2>
          <p className="ops-body">{opsPerson.openWork} open · {opsPerson.overdueWork} overdue · {opsPerson.waitingReview} awaiting review · {opsPerson.blockedWork} revisions</p>
          <Link href="/app/tasks" className="ops-label" style={{ color: "var(--bow-blue)", textDecoration: "none" }}>Open canonical Work queue →</Link>
        </div>
        <div className="ops-panel" style={{ padding: 18 }}>
          <span className="ops-label">Contextual evidence · 90 days</span>
          <h2 className="ops-section-title">Performance evidence</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {Object.entries(opsPerson.evidence).map(([dimension, count]) => (
              <div key={dimension}><span className="ops-label">{dimension}</span><strong style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 24 }}>{count}</strong></div>
            ))}
          </div>
        </div>
      </div>

      {me.role === "admin" && (
        <div className="ops-panel" style={{ padding: 20 }}>
          <span className="ops-label">One canonical reporting line</span>
          <h2 className="ops-section-title">Assignment &amp; manager</h2>
          <RoleAssignmentSetup personId={personId} roleAssignmentId={opsPerson.roleAssignmentId} roles={roles} managerAssignments={managerAssignments} currentManagerAssignmentId={assignmentDetails?.manager_assignment_id ?? null} />
        </div>
      )}

      {opsPerson.roleAssignmentId && (
        <>
          <div className="ops-panel" style={{ padding: 20 }}>
            <span className="ops-label">Availability without fake precision</span>
            <h2 className="ops-section-title">Capacity</h2>
            <CapacityControls roleAssignmentId={opsPerson.roleAssignmentId} initialHours={opsPerson.weeklyCapacityHours} initialAvailability={opsPerson.availabilityStatus} />
          </div>
          <div className="ops-panel" style={{ padding: 20 }}>
            <span className="ops-label">Earned authority</span>
            <h2 className="ops-section-title">Role activation</h2>
            <ActivationControls roleAssignmentId={opsPerson.roleAssignmentId} requirements={requirements.map((item) => ({ id: item.id, label: item.label, status: item.status, sourceType: item.source_type, decisionNote: item.decision_note }))} lessons={playbookLessons} canManage={canManagePerson} />
          </div>
          {canManagePerson && (
            <div className="ops-panel" style={{ padding: 20 }}>
              <span className="ops-label">Human decision · evidence attached</span>
              <h2 className="ops-section-title">Role &amp; autonomy</h2>
              <RoleDecisionControls roleAssignmentId={opsPerson.roleAssignmentId} status={opsPerson.assignmentStatus ?? "activating"} autonomy={opsPerson.autonomyLevel ?? 2} />
            </div>
          )}
        </>
      )}

      <div className="ops-panel" style={{ padding: 20 }}>
        <span className="ops-label">Recovery before punishment</span>
        <h2 className="ops-section-title">Accountability</h2>
        <AccountabilityControls events={accountability.map((event) => ({ id: event.id, eventType: event.event_type, reason: event.reason, recoveryCommitment: event.recovery_commitment, createdAt: Number(event.created_at) }))} canManage={canManagePerson} />
      </div>
    </section>
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

  return (
    <section id="instructor" className="ops-anchor" style={{ display: "grid", gap: 12 }}>
      <div className="ops-section-head">
        <div>
          <span className="ops-label">Instructor workforce dossier</span>
          <h2 className="ops-section-title">Instructor</h2>
        </div>
        <div className="ops-status-line">
          <Badge status="info">{label(instructor.stage)}</Badge>
          <Badge status={instructor.trainingStatus === "complete" ? "positive" : "warning"}>Training · {label(instructor.trainingStatus)}</Badge>
          <Link href={`/app/instructors/${instructorId}`} className="ops-inline-link">Full dossier →</Link>
        </div>
      </div>

      <div className="ops-alert" data-tone={dossier.nextAction.tone}>
        <span className="ops-label">Manager next action</span>
        <h3 className="ops-alert__title" style={{ marginTop: 7 }}>{dossier.nextAction.title}</h3>
        <p className="ops-body" style={{ marginTop: 5 }}>{dossier.nextAction.detail}</p>
      </div>

      <div className="ops-panel" style={{ padding: 20 }}>
        <div className="ops-section-head"><div><span className="ops-label">Lifecycle</span><h3 className="ops-section-title">Pipeline &amp; access decisions</h3></div></div>
        <InstructorDetailActions
          instructorId={instructorId}
          stage={instructor.stage}
          trainingStatus={instructor.trainingStatus}
          isAdmin={me.role === "admin"}
          isStaff={me.role === "admin" || me.role === "growth"}
          staffUsers={staffUsers}
          availability={detail.availability.map((slot) => ({ dayOfWeek: slot.dayOfWeek, startTime: slot.startTime, endTime: slot.endTime, notes: slot.notes ?? "" }))}
        />
      </div>

      <div className="ops-panel" style={{ padding: 20 }}>
        <span className="ops-label">Current delivery</span>
        <h3 className="ops-section-title">Assignments · {dossier.workload.currentClasses}/{dossier.workload.maximumClasses} weekly slots</h3>
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
      </div>

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

      <div className="ops-panel" style={{ padding: 18 }}>
        <span className="ops-label">Universal Work</span>
        <h3 className="ops-section-title">Open Work · {openTasks.length}</h3>
        {openTasks.length === 0 ? <p className="ops-body">No open Work linked to this instructor.</p> : (
          <div className="ops-list">
            {openTasks.map((task) => (
              <div className="ops-meta" key={task.id}><span className="ops-value">{task.title}</span><span className="ops-record-meta">{label(task.kind)}</span></div>
            ))}
          </div>
        )}
      </div>

      <div className="ops-panel" style={{ padding: 18 }}>
        <span className="ops-label">Owner &amp; source</span>
        <p className="ops-body">Owner: {instructor.ownerUserId ? (resolvedOwnerName && resolvedOwnerName !== instructor.ownerUserId ? resolvedOwnerName : "Former staff member") : "Unassigned"} · Source: {instructor.source ? label(instructor.source) : "—"}</p>
      </div>

      {activity.length > 0 && (
        <div className="ops-panel" style={{ padding: 18 }}>
          <span className="ops-label">Audit trail</span>
          <h3 className="ops-section-title">Recent activity</h3>
          <div className="ops-timeline">
            {activity.map((item) => (
              <div className="ops-timeline__item" key={item.id}>
                <span className="ops-record-meta">{new Date(item.createdAt).toLocaleString()} · {label(item.kind)}</span>
                <p className="ops-body" style={{ marginTop: 3 }}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <IntroductionTracker introducerType="instructor" introducerId={instructorId} introductions={introductions} />
    </section>
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
    <section id="student" className="ops-anchor" style={{ display: "grid", gap: 12 }}>
      <div className="ops-section-head">
        <div><span className="ops-label">Student record</span><h2 className="ops-section-title">Student</h2></div>
        <div className="ops-status-line">
          <Badge status={student.formStatus === "complete" ? "positive" : student.formStatus === "submitted" ? "warning" : "negative"}>Forms: {label(student.formStatus)}</Badge>
          <Badge status={student.enrollmentStatus === "active" ? "positive" : "locked"}>{label(student.enrollmentStatus)}</Badge>
        </div>
      </div>

      <div className="ops-panel">
        <div className="ops-meta-grid">
          <div className="ops-meta"><span className="ops-label">Age / Grade</span><span className="ops-value">{student.age ?? "—"} / {student.grade ?? "—"}</span></div>
          <div className="ops-meta"><span className="ops-label">Student email</span><span className="ops-value">{student.email ?? "—"}</span></div>
          <div className="ops-meta"><span className="ops-label">Guardian</span><span className="ops-value">{guardian ? `${guardian.name} (${guardian.email})` : "—"}</span></div>
        </div>
      </div>

      <div className="ops-panel--flat">
        <div className="ops-section-head"><h3 className="ops-section-title">Classes</h3></div>
        {classRows.length === 0 && <p className="ops-body">Not enrolled in any classes.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {classRows.map((row) => (
            <div key={row.enrollment.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <Link href={`/app/classes/${row.enrollment.classId}`} className="ops-inline-link">{row.title}</Link>
              <Badge status={row.enrollment.status === "enrolled" ? "positive" : "neutral"}>{row.enrollment.status}</Badge>
            </div>
          ))}
        </div>
      </div>

      <div className="ops-panel--flat">
        <div className="ops-section-head"><h3 className="ops-section-title">Attendance history</h3></div>
        {attendance.length === 0 && <p className="ops-body">No attendance recorded yet.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {attendance.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span className="ops-value">{when(a.session_date)} — {a.class_title}</span>
              <Badge status={a.present ? "positive" : "negative"}>{a.present ? "Present" : "Absent"}</Badge>
            </div>
          ))}
        </div>
      </div>

      <StudentDetailActions
        key={student.updatedAt}
        studentId={studentId}
        formStatus={student.formStatus}
        communicationNotes={student.communicationNotes ?? ""}
        enrollmentStatus={student.enrollmentStatus}
        expectedUpdatedAt={student.updatedAt}
      />
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Applicant — summary + strong cross-link to the full hiring cockpit     */
/* (Stage 5 owns the full journey; ApplicationCockpitActions stays there  */
/* rather than being duplicated here).                                   */
/* ---------------------------------------------------------------------- */

async function ApplicantSection({ applicationId }: { applicationId: string }) {
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
    <section id="applicant" className="ops-anchor" style={{ display: "grid", gap: 12 }}>
      <div className="ops-section-head">
        <div><span className="ops-label">Hiring pipeline</span><h2 className="ops-section-title">Applicant · {app.opening_title}</h2></div>
        <Badge status={app.lifecycle_status === "accepted" ? "positive" : app.lifecycle_status === "rejected" ? "negative" : "info"}>{label(app.lifecycle_status)}</Badge>
      </div>
      <div className="ops-panel" style={{ padding: 18 }}>
        <div className="ops-meta-grid">
          <div className="ops-meta"><span className="ops-label">Next action</span><span className="ops-value">{app.next_action ?? app.waiting_on ?? "Final"}</span></div>
          <div className="ops-meta"><span className="ops-label">Owner</span><span className="ops-value">{app.owner_name ?? "Unassigned"}</span></div>
        </div>
        <Link href={`/app/hiring/applications/${applicationId}`} className="ops-inline-link" style={{ display: "inline-block", marginTop: 10 }}>
          Open full candidate cockpit →
        </Link>
      </div>
    </section>
  );
}
