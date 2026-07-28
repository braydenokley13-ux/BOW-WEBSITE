import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, PageSection, RecordShell } from "@/components/ds";
import { getDb, rowToPerson } from "@/lib/db";
import { getClassDetail, listEligibleInstructors, listStudents, listActivity, classStatusFlags } from "@/lib/hiring";
import { sessionHref } from "@/lib/routes";
import ClassDetailActions, { RemoveInstructorButton, WithdrawStudentButton } from "@/components/app/classes/ClassDetailActions";
import RecurringSessionsForm from "@/components/app/classes/RecurringSessionsForm";
import { coerceEpochMs, formatDateTimeInZone } from "@/lib/timezone";
import ConfirmEnrollmentButton from "@/components/app/classes/ConfirmEnrollmentButton";
import CloseoutPanel from "@/components/app/classes/CloseoutPanel";
import { getClassCloseout } from "@/lib/flywheel";
import { resolveInstructorPersonId, resolveStudentPersonId } from "@/lib/people-directory";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = (await getClassDetail(id));
  if (!detail) notFound();
  const { class: cls, instructors, sessions, enrollments } = detail;
  const closeout = cls.status === "completed" ? (await getClassCloseout(cls.id)) : null;

  const db = getDb();
  const curriculum = (await db.prepare("SELECT title FROM curricula WHERE id = ?").get(cls.curriculumId)) as { title: string } | undefined;
  const org = cls.partnerOrgId ? ((await db.prepare("SELECT name FROM organizations WHERE id = ?").get(cls.partnerOrgId)) as { name: string } | undefined) : null;

  const instructorRows = (await Promise.all(instructors.map(async (ci: any) => {
      const instructorRow = (await db.prepare("SELECT * FROM instructors WHERE id = ?").get(ci.instructor_id)) as any;
      const personRow = instructorRow ? ((await db.prepare("SELECT * FROM people WHERE id = ?").get(instructorRow.person_id)) as any) : null;
      const personId = await resolveInstructorPersonId(ci.instructor_id);
      return { ...ci, name: personRow ? rowToPerson(personRow).name : ci.instructor_id, personId };
    })));

  const enrolled = enrollments.filter(
    async (e) =>
      e.status === "enrolled" &&
      Boolean((await db.prepare("SELECT 1 FROM students WHERE id = ? AND enrollment_status = 'active'").get(e.studentId))),
  );
  const enrolledStudentRows = (await Promise.all(enrolled.map(async (e) => {
      const s = (await db.prepare("SELECT * FROM students WHERE id = ?").get(e.studentId)) as any;
      const personId = await resolveStudentPersonId(e.studentId);
      return { enrollment: e, name: s?.name ?? e.studentId, personId };
    })));

  const eligibleInstructors = (await listEligibleInstructors());
  const allStudents = (await listStudents());
  const enrolledIds = new Set(enrolled.map((e) => e.studentId));
  const studentOptions = allStudents
    .filter((student) => student.enrollmentStatus === "active")
    .map((s) => ({ id: s.id, name: s.name, enrolled: enrolledIds.has(s.id) }));
  const historical = cls.status === "completed" || cls.status === "cancelled";

  const hasEligibleLead = !!(
    cls.leadInstructorId && (await db.prepare("SELECT 1 FROM instructors WHERE id = ? AND eligibility_status = 'eligible' AND stage IN ('eligible','active')").get(cls.leadInstructorId))
  );
  const flags = classStatusFlags(cls, hasEligibleLead, enrolled.length);

  const activity = (await listActivity("class", id));

  return (
    <RecordShell
      eyebrow={
        <>
          Classes
          {cls.programId && (
            <>
              {" · "}
              <Link href={`/app/programs/${cls.programId}`} style={{ color: "var(--bow-blue)" }}>Back to Program</Link>
            </>
          )}
        </>
      }
      title={cls.title}
      status={
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Badge status="info">{cls.status.replace(/_/g, " ")}</Badge>
          {flags.needsInstructor && <Badge status="warning">No eligible lead</Badge>}
          {flags.launchingSoonIncomplete && <Badge status="negative">Launching soon, incomplete</Badge>}
        </div>
      }
    >
      <PageSection title="Details" noRule>
        <div className="ops-meta-grid">
          <div className="ops-meta">
            <span className="ops-label">Curriculum</span>
            <span className="ops-value">
              {curriculum ? <Link href={`/app/curriculum/${cls.curriculumId}`} className="ops-inline-link">{curriculum.title}</Link> : "—"}
            </span>
          </div>
          <div className="ops-meta">
            <span className="ops-label">Partner org</span>
            <span className="ops-value">{org ? <Link href={`/app/partners/${cls.partnerOrgId}`} className="ops-inline-link">{org.name}</Link> : "—"}</span>
          </div>
          <div className="ops-meta">
            <span className="ops-label">Location</span>
            <span className="ops-value">{cls.location || cls.onlineFormat || "—"}</span>
          </div>
          <div className="ops-meta">
            <span className="ops-label">Dates</span>
            <span className="ops-value">{cls.startDate || "—"} – {cls.endDate || "—"}</span>
          </div>
          <div className="ops-meta">
            <span className="ops-label">Delivery timezone</span>
            <span className="ops-value">{cls.scheduleTimezone || "Set when the first session is scheduled"}</span>
          </div>
          <div className="ops-meta">
            <span className="ops-label">Age range</span>
            <span className="ops-value">{cls.ageRange || "—"}</span>
          </div>
          <div className="ops-meta">
            <span className="ops-label">Capacity</span>
            <span className="ops-value">{enrolled.length}{cls.capacity ? ` / ${cls.capacity}` : ""}</span>
          </div>
        </div>
        {cls.internalNotes && (
          <div className="ops-meta" style={{ borderBottom: 0 }}>
            <span className="ops-label">Internal notes</span>
            <span className="ops-value" style={{ whiteSpace: "pre-wrap" }}>{cls.internalNotes}</span>
          </div>
        )}
      </PageSection>

      <PageSection title="Instructors">
        {instructorRows.length === 0 && <p className="ops-body">No instructors assigned.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {instructorRows.map((ir: any) => (
            <div key={ir.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <Link href={ir.personId ? `/app/people/${ir.personId}?tab=instructor` : `/app/instructors/${ir.instructor_id}`} className="ops-inline-link">{ir.name}</Link>{" "}
                <Badge status={ir.role === "lead" ? "positive" : "neutral"}>{ir.role}</Badge>
              </div>
              {!cls.programId && <RemoveInstructorButton classId={id} instructorId={ir.instructor_id} />}
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection title="Sessions">
        {sessions.length === 0 && <p className="ops-body">No sessions scheduled.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sessions.map((s) => (
            <Link key={s.id} href={sessionHref(id, s.id)} className="ops-inline-link" style={{ display: "block", textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>
              {formatDateTimeInZone(s.sessionDate, s.timeZone ?? cls.scheduleTimezone)} {s.location ? `— ${s.location}` : ""}
            </Link>
          ))}
        </div>
        {!historical && (
          <div style={{ marginTop: 18 }}>
            <span className="ops-label">Schedule recurring sessions</span>
            <div style={{ marginTop: 8 }}>
              <RecurringSessionsForm classId={id} defaultTimeZone={cls.scheduleTimezone} defaultLocation={cls.location} />
            </div>
          </div>
        )}
      </PageSection>

      <PageSection title="Enrolled students">
        {enrolledStudentRows.length === 0 && <p className="ops-body">No students enrolled.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {enrolledStudentRows.map((row) => (
            <div key={row.enrollment.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <Link href={row.personId ? `/app/people/${row.personId}?tab=student` : `/app/students/${row.enrollment.studentId}`} className="ops-inline-link">{row.name}</Link>
                <span className="ops-record-meta" style={{ display: "block", marginTop: 3 }}>
                  {(() => {
                    const confirmedMs = coerceEpochMs(row.enrollment.confirmedAt);
                    const source = row.enrollment.confirmationSource?.replace(/_/g, " ") ?? "recorded source";
                    if (confirmedMs == null) return "Confirmation not yet recorded";
                    return `Confirmed by ${source} · ${new Date(confirmedMs).toLocaleDateString()}`;
                  })()}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {row.enrollment.confirmedAt ? (
                  <Badge status="positive">Confirmed</Badge>
                ) : historical ? (
                  <Badge status="neutral">Legacy · unconfirmed</Badge>
                ) : (
                  <ConfirmEnrollmentButton enrollmentId={row.enrollment.id} studentName={row.name} />
                )}
                {!historical && <WithdrawStudentButton classId={id} studentId={row.enrollment.studentId} />}
              </div>
            </div>
          ))}
        </div>
      </PageSection>

      <ClassDetailActions
        classId={id}
        programId={cls.programId}
        status={cls.status}
        eligibleInstructors={eligibleInstructors.map((i) => ({ id: i.id, name: i.person?.name ?? i.id }))}
        assignedInstructorIds={instructorRows.map((ir: any) => ir.instructor_id)}
        students={studentOptions}
        capacity={cls.capacity}
        enrolledCount={enrolled.length}
        scheduleTimezone={cls.scheduleTimezone}
      />

      {closeout && <CloseoutPanel closeout={closeout} />}

      <PageSection title="Activity">
        <div className="ops-timeline">
          {activity.length === 0 && <span className="ops-body">No activity yet.</span>}
          {activity.map((a) => (
            <div key={a.id} className="ops-timeline__item">
              <span className="ops-record-meta">
                {(() => { const ms = coerceEpochMs(a.createdAt); return ms == null ? "Date not recorded" : new Date(ms).toLocaleString(); })()} · {a.kind}
              </span>
              <p className="ops-body" style={{ margin: "2px 0 0" }}>{a.body}</p>
            </div>
          ))}
        </div>
      </PageSection>
    </RecordShell>
  );
}
