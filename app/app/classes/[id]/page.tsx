import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, SectionHeader } from "@/components/ds";
import { getDb, rowToPerson } from "@/lib/db";
import { getClassDetail, listEligibleInstructors, listStudents, listActivity, classStatusFlags } from "@/lib/hiring";
import { sessionHref } from "@/lib/routes";
import ClassDetailActions, { RemoveInstructorButton, WithdrawStudentButton } from "@/components/app/classes/ClassDetailActions";
import { formatDateTimeInZone } from "@/lib/timezone";
import ConfirmEnrollmentButton from "@/components/app/classes/ConfirmEnrollmentButton";

const cardStyle = { background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 } as const;
const labelStyle = { fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--bow-slate)" };
const valueStyle = { fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-ink)" };

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = (await getClassDetail(id));
  if (!detail) notFound();
  const { class: cls, instructors, sessions, enrollments } = detail;

  const db = getDb();
  const curriculum = (await db.prepare("SELECT title FROM curricula WHERE id = ?").get(cls.curriculumId)) as { title: string } | undefined;
  const org = cls.partnerOrgId ? ((await db.prepare("SELECT name FROM organizations WHERE id = ?").get(cls.partnerOrgId)) as { name: string } | undefined) : null;

  const instructorRows = (await Promise.all(instructors.map(async (ci: any) => {
      const instructorRow = (await db.prepare("SELECT * FROM instructors WHERE id = ?").get(ci.instructor_id)) as any;
      const personRow = instructorRow ? ((await db.prepare("SELECT * FROM people WHERE id = ?").get(instructorRow.person_id)) as any) : null;
      return { ...ci, name: personRow ? rowToPerson(personRow).name : ci.instructor_id };
    })));

  const enrolled = enrollments.filter(
    async (e) =>
      e.status === "enrolled" &&
      Boolean((await db.prepare("SELECT 1 FROM students WHERE id = ? AND enrollment_status = 'active'").get(e.studentId))),
  );
  const enrolledStudentRows = (await Promise.all(enrolled.map(async (e) => {
      const s = (await db.prepare("SELECT * FROM students WHERE id = ?").get(e.studentId)) as any;
      return { enrollment: e, name: s?.name ?? e.studentId };
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
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="Classes" title={cls.title} level={1} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <Badge status="info">{cls.status.replace(/_/g, " ")}</Badge>
        {flags.needsInstructor && <Badge status="warning">No eligible lead</Badge>}
        {flags.launchingSoonIncomplete && <Badge status="negative">Launching soon, incomplete</Badge>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 16 }}>
        <div style={cardStyle}>
          <span style={labelStyle}>Curriculum</span>
          <p style={valueStyle}>
            {curriculum ? <Link href={`/app/curriculum/${cls.curriculumId}`} style={{ color: "var(--bow-blue)" }}>{curriculum.title}</Link> : "—"}
          </p>
        </div>
        <div style={cardStyle}>
          <span style={labelStyle}>Partner org</span>
          <p style={valueStyle}>{org ? <Link href={`/app/partners/${cls.partnerOrgId}`} style={{ color: "var(--bow-blue)" }}>{org.name}</Link> : "—"}</p>
        </div>
        <div style={cardStyle}>
          <span style={labelStyle}>Location</span>
          <p style={valueStyle}>{cls.location || cls.onlineFormat || "—"}</p>
        </div>
        <div style={cardStyle}>
          <span style={labelStyle}>Dates</span>
          <p style={valueStyle}>{cls.startDate || "—"} – {cls.endDate || "—"}</p>
        </div>
        <div style={cardStyle}>
          <span style={labelStyle}>Delivery timezone</span>
          <p style={valueStyle}>{cls.scheduleTimezone || "Set when the first session is scheduled"}</p>
        </div>
        <div style={cardStyle}>
          <span style={labelStyle}>Age range</span>
          <p style={valueStyle}>{cls.ageRange || "—"}</p>
        </div>
        <div style={cardStyle}>
          <span style={labelStyle}>Capacity</span>
          <p style={valueStyle}>{enrolled.length}{cls.capacity ? ` / ${cls.capacity}` : ""}</p>
        </div>
      </div>

      {cls.internalNotes && (
        <div style={cardStyle}>
          <span style={labelStyle}>Internal notes</span>
          <p style={{ ...valueStyle, whiteSpace: "pre-wrap" }}>{cls.internalNotes}</p>
        </div>
      )}

      <div style={cardStyle}>
        <span style={{ ...labelStyle, display: "block", marginBottom: 12 }}>Instructors</span>
        {instructorRows.length === 0 && <p style={valueStyle}>No instructors assigned.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {instructorRows.map((ir: any) => (
            <div key={ir.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <Link href={`/app/instructors/${ir.instructor_id}`} style={{ ...valueStyle, color: "var(--bow-blue)" }}>{ir.name}</Link>{" "}
                <Badge status={ir.role === "lead" ? "positive" : "neutral"}>{ir.role}</Badge>
              </div>
              {!cls.programId && <RemoveInstructorButton classId={id} instructorId={ir.instructor_id} />}
            </div>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <span style={{ ...labelStyle, display: "block", marginBottom: 12 }}>Sessions</span>
        {sessions.length === 0 && <p style={valueStyle}>No sessions scheduled.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sessions.map((s) => (
            <Link key={s.id} href={sessionHref(id, s.id)} style={{ ...valueStyle, color: "var(--bow-blue)", display: "block" }}>
              {formatDateTimeInZone(s.sessionDate, s.timeZone ?? cls.scheduleTimezone)} {s.location ? `— ${s.location}` : ""}
            </Link>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <span style={{ ...labelStyle, display: "block", marginBottom: 12 }}>Enrolled students</span>
        {enrolledStudentRows.length === 0 && <p style={valueStyle}>No students enrolled.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {enrolledStudentRows.map((row) => (
            <div key={row.enrollment.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <Link href={`/app/students/${row.enrollment.studentId}`} style={{ ...valueStyle, color: "var(--bow-blue)" }}>{row.name}</Link>
                <span style={{ ...labelStyle, display: "block", marginTop: 3 }}>
                  {row.enrollment.confirmedAt
                    ? `Confirmed by ${row.enrollment.confirmationSource?.replace(/_/g, " ") ?? "recorded source"} · ${new Date(row.enrollment.confirmedAt).toLocaleDateString()}`
                    : "Confirmation not yet recorded"}
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
      </div>

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

      <div style={cardStyle}>
        <span style={{ ...labelStyle, display: "block", marginBottom: 12 }}>Activity</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {activity.length === 0 && <span style={valueStyle}>No activity yet.</span>}
          {activity.map((a) => (
            <div key={a.id} style={{ borderBottom: "1px solid var(--border-rule)", paddingBottom: 8 }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>
                {new Date(a.createdAt).toLocaleString()} · {a.kind}
              </span>
              <p style={{ ...valueStyle, margin: "2px 0 0" }}>{a.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
